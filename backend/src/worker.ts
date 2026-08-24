import dotenv from "dotenv";
import { Worker, Job } from "bullmq";
import nodemailer from "nodemailer";
import pool from "./config/db";
import { connection, emailQueue } from "./queue/emailQueue";

dotenv.config();

const CONCURRENCY =
  Number(process.env.WORKER_CONCURRENCY) || 1;

const MIN_DELAY_MS =
  Number(process.env.MIN_EMAIL_DELAY_MS) || 2000;

const MAX_EMAILS_PER_HOUR =
  Number(process.env.MAX_EMAILS_PER_HOUR) || 200;

type EmailJob = {
  emailId: number;
};

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/* =========================
   HOURLY RATE LIMIT
========================= */

function getHourWindow() {
  const now = new Date();

  return `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`;
}

function getNextHourDelay() {
  const now = new Date();

  const nextHour = new Date(now);

  nextHour.setUTCMinutes(60, 0, 0);

  return Math.max(
    nextHour.getTime() - now.getTime(),
    1000
  );
}

async function reserveHourlySlot(sender: string) {
  const key =
    `emailflow:hourly:${sender}:${getHourWindow()}`;

  const ttl = Math.ceil(
    getNextHourDelay() / 1000
  );

  const result = await connection.eval(
    `
    local current = redis.call("GET", KEYS[1])

    if not current then
      redis.call(
        "SET",
        KEYS[1],
        1,
        "EX",
        ARGV[1]
      )

      return 1
    end

    if tonumber(current) >= tonumber(ARGV[2]) then
      return 0
    end

    return redis.call("INCR", KEYS[1])
    `,
    1,
    key,
    ttl,
    MAX_EMAILS_PER_HOUR
  );

  return Number(result);
}

/* =========================
   GLOBAL EMAIL DELAY
========================= */

async function waitForGlobalEmailSpacing() {
  const key =
    "emailflow:last-email-send";

  while (true) {
    const lastValue =
      await connection.get(key);

    const now = Date.now();

    if (!lastValue) {
      const locked =
        await connection.set(
          key,
          String(now),
          "PX",
          MIN_DELAY_MS,
          "NX"
        );

      if (locked === "OK") {
        return;
      }

      continue;
    }

    const lastSend =
      Number(lastValue);

    const remaining =
      MIN_DELAY_MS -
      (now - lastSend);

    if (remaining <= 0) {
      const locked =
        await connection.set(
          key,
          String(now),
          "PX",
          MIN_DELAY_MS,
          "XX"
        );

      if (locked === "OK") {
        return;
      }

      continue;
    }

    await sleep(
      Math.min(remaining, 500)
    );
  }
}

/* =========================
   EMAIL TRANSPORTER
========================= */

/*
  Ethereal is useful for testing.

  For real sending later, you can replace
  these environment variables with a real
  SMTP provider.
*/

let transporter:
  | nodemailer.Transporter
  | null = null;

let emailAccount:
  | nodemailer.TestAccount
  | null = null;

export async function getTransporter(
  sender?: string
) {
  if (transporter && emailAccount) {
    return {
      transporter,
      account: emailAccount
    };
  }

  /*
    If SMTP environment variables exist,
    use them.
  */

  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  ) {
    const smtpPort =
      Number(process.env.SMTP_PORT) || 587;

    transporter =
      nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: smtpPort,
        secure:
          process.env.SMTP_SECURE === "true",

        auth: {
          user:
            process.env.SMTP_USER,

          pass:
            process.env.SMTP_PASS
        },

        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000
      });

    emailAccount = {
      user:
        process.env.SMTP_USER,

      pass:
        process.env.SMTP_PASS,

      smtp: {
        host:
          process.env.SMTP_HOST,

        port:
          smtpPort,

        secure:
          process.env.SMTP_SECURE ===
          "true"
      },

      imap: {
        host: "",
        port: 0,
        secure: false
      },

      pop3: {
        host: "",
        port: 0,
        secure: false
      },

      web: ""
    };

    console.log(
      "Using configured SMTP server:",
      process.env.SMTP_HOST
    );

    return {
      transporter,
      account: emailAccount
    };
  }

  /*
    Otherwise use Ethereal test account.
  */

  console.log(
    "Creating Ethereal test account..."
  );

  try {
    emailAccount =
      await nodemailer.createTestAccount();

    transporter =
      nodemailer.createTransport({
        host:
          emailAccount.smtp.host,

        port:
          emailAccount.smtp.port,

        secure:
          emailAccount.smtp.secure,

        auth: {
          user:
            emailAccount.user,

          pass:
            emailAccount.pass
        },

        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000
      });

    console.log(
      "Ethereal account created successfully"
    );

    return {
      transporter,
      account: emailAccount
    };
  } catch (error: any) {
    console.error(
      "Could not create Ethereal account:",
      error.message
    );

    throw new Error(
      "Email transporter could not be created"
    );
  }
}

/* =========================
   PROCESS EMAIL
========================= */

async function processEmail(
  job: Job<EmailJob>
) {
  const emailId =
    job.data.emailId;

  const result =
    await pool.query(
      `
      SELECT *
      FROM emails
      WHERE id = $1
      `,
      [emailId]
    );

  const email =
    result.rows[0];

  if (!email) {
    throw new Error(
      "Email not found"
    );
  }

  if (
    email.status === "sent"
  ) {
    console.log(
      `Email ${emailId} already sent. Skipping.`
    );

    return;
  }

  if (
    email.status === "cancelled"
  ) {
    console.log(
      `Email ${emailId} cancelled. Skipping.`
    );

    return;
  }

  /*
    Claim the email before sending.

    This prevents the fallback worker
    or another job from sending it twice.
  */

  const claimResult =
    await pool.query(
      `
      UPDATE emails
      SET status = 'processing'
      WHERE id = $1
        AND status = 'scheduled'
      RETURNING *
      `,
      [emailId]
    );

  if (
    claimResult.rowCount === 0
  ) {
    console.log(
      `Email ${emailId} is already being processed.`
    );

    return;
  }

  const latestEmail =
    claimResult.rows[0];

  const sender =
    latestEmail.sender_email ||
    process.env.SMTP_USER ||
    "EmailFlow";

  const allowed =
    await reserveHourlySlot(
      sender
    );

  if (allowed === 0) {
    const delay =
      getNextHourDelay();

    await pool.query(
      `
      UPDATE emails
      SET status = 'scheduled'
      WHERE id = $1
      `,
      [emailId]
    );

    console.log(
      `Hourly limit reached. Rescheduling email ${emailId}.`
    );

    await emailQueue.add(
      "send-email",
      {
        emailId
      },
      {
        delay,

        jobId:
          `email-${emailId}-hour-${Date.now()}`,

        attempts: 3,

        backoff: {
          type:
            "exponential",

          delay:
            5000
        }
      }
    );

    return;
  }

  await waitForGlobalEmailSpacing();

  const {
    transporter,
    account
  } =
    await getTransporter(
      sender
    );

  console.log(
    `Sending email ${emailId} to ${latestEmail.recipient_email}`
  );

  const info =
    await transporter.sendMail({
      from: account.user,

      to:
        latestEmail.recipient_email,

      subject:
        latestEmail.subject,

      text:
        latestEmail.body
    });

  await pool.query(
    `
    UPDATE emails
    SET
      status = 'sent',
      sent_time = CURRENT_TIMESTAMP,
      error_message = NULL
    WHERE id = $1
    `,
    [emailId]
  );

  console.log(
    `Email ${emailId} sent successfully to ${latestEmail.recipient_email}`
  );

  const previewUrl =
    nodemailer.getTestMessageUrl(info);

  if (previewUrl) {
    console.log(
      "Ethereal preview:",
      previewUrl
    );
  }
}

/* =========================
   BULLMQ WORKER
========================= */

const worker =
  new Worker<EmailJob>(
    "email-queue",
    processEmail,
    {
      connection,
      concurrency:
        CONCURRENCY,

      lockDuration:
        60000
    }
  );

worker.on(
  "completed",
  (job) => {
    console.log(
      `Job ${job.id} completed`
    );
  }
);

worker.on(
  "failed",
  async (
    job,
    error
  ) => {
    console.error(
      `Job ${job?.id} failed:`,
      error.message
    );

    if (
      !job?.data.emailId
    ) {
      return;
    }

    const attempts =
      job.opts.attempts || 1;

    /*
      BullMQ increments attemptsMade
      before the next retry.
    */

    if (
      job.attemptsMade >= attempts
    ) {
      await pool.query(
        `
        UPDATE emails
        SET
          status = 'failed',
          error_message = $2
        WHERE id = $1
          AND status != 'sent'
        `,
        [
          job.data.emailId,
          error.message
        ]
      );
    } else {
      /*
        Allow the retry to process it.
      */

      await pool.query(
        `
        UPDATE emails
        SET status = 'scheduled'
        WHERE id = $1
          AND status = 'processing'
        `,
        [
          job.data.emailId
        ]
      );
    }
  }
);

worker.on(
  "error",
  (err) => {
    console.error(
      "BullMQ Worker Error:",
      err
    );
  }
);

console.log(
  `Email worker running with concurrency ${CONCURRENCY}`
);

console.log(
  `Minimum global delay: ${MIN_DELAY_MS}ms`
);

console.log(
  `Maximum emails per sender per hour: ${MAX_EMAILS_PER_HOUR}`
);