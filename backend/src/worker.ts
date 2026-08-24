import dotenv from "dotenv";
import { Worker, Job } from "bullmq";
import nodemailer from "nodemailer";

import pool from "./config/db";
import {
  connection,
  emailQueue
} from "./queue/emailQueue";

dotenv.config();

const CONCURRENCY =
  Number(process.env.WORKER_CONCURRENCY) || 5;

const MIN_DELAY_MS =
  Number(process.env.MIN_EMAIL_DELAY_MS) || 2000;

const MAX_EMAILS_PER_HOUR =
  Number(process.env.MAX_EMAILS_PER_HOUR) || 200;

type EmailJob = {
  emailId: number;
};

let transporter: nodemailer.Transporter | null =
  null;

let etherealAccount:
  | nodemailer.TestAccount
  | null = null;

/* =========================================
   ETHEREAL TRANSPORTER
========================================= */

async function getTransporter() {
  if (transporter && etherealAccount) {
    return {
      transporter,
      account: etherealAccount
    };
  }

  console.log(
    "Creating Ethereal test account..."
  );

  etherealAccount =
    await nodemailer.createTestAccount();

  console.log(
    "Ethereal account created successfully"
  );

  transporter =
    nodemailer.createTransport({
      host: etherealAccount.smtp.host,

      port: etherealAccount.smtp.port,

      secure: etherealAccount.smtp.secure,

      auth: {
        user: etherealAccount.user,
        pass: etherealAccount.pass
      },

      connectionTimeout: 60000,

      greetingTimeout: 60000,

      socketTimeout: 60000,

      pool: true,

      maxConnections: CONCURRENCY,

      maxMessages: 100
    });

  return {
    transporter,
    account: etherealAccount
  };
}

/* =========================================
   HOURLY RATE LIMIT
========================================= */

function getHourWindow() {
  const now = new Date();

  return [
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    now.getUTCDate(),
    now.getUTCHours()
  ].join("-");
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

async function reserveHourlySlot(
  sender: string
): Promise<boolean> {
  const key =
    `emailflow:hourly:${sender}:${getHourWindow()}`;

  const ttl = Math.ceil(
    getNextHourDelay() / 1000
  );

  const result = await connection.eval(
    `
    local current =
      redis.call("GET", KEYS[1])

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

    return redis.call(
      "INCR",
      KEYS[1]
    )
    `,
    1,
    key,
    ttl,
    MAX_EMAILS_PER_HOUR
  );

  return Number(result) !== 0;
}

/* =========================================
   PROCESS EMAIL
========================================= */

async function processEmail(
  job: Job<EmailJob>
) {
  const { emailId } = job.data;

  console.log(
    `[Worker] Processing email ${emailId}`
  );

  const result = await pool.query(
    `
    SELECT *
    FROM emails
    WHERE id = $1
    `,
    [emailId]
  );

  const email = result.rows[0];

  if (!email) {
    console.log(
      `[Worker] Email ${emailId} not found`
    );

    return;
  }

  /* -------------------------
     IDEMPOTENCY CHECK
  ------------------------- */

  if (email.status === "sent") {
    console.log(
      `[Worker] Email ${emailId} already sent. Skipping duplicate.`
    );

    return;
  }

  if (email.status === "cancelled") {
    console.log(
      `[Worker] Email ${emailId} was cancelled.`
    );

    return;
  }

  if (email.status === "failed") {
    console.log(
      `[Worker] Email ${emailId} permanently failed.`
    );

    return;
  }

  /* -------------------------
     ATOMIC PROCESSING LOCK
  ------------------------- */

  const lockResult = await pool.query(
    `
    UPDATE emails
    SET status = 'processing'
    WHERE id = $1
      AND status = 'scheduled'
    RETURNING *
    `,
    [emailId]
  );

  if (lockResult.rowCount === 0) {
    console.log(
      `[Worker] Email ${emailId} is already being processed.`
    );

    return;
  }

  const currentEmail =
    lockResult.rows[0];

  const sender =
    currentEmail.sender_email ||
    "EmailFlow";

  /* -------------------------
     HOURLY RATE LIMIT
  ------------------------- */

  const allowed =
    await reserveHourlySlot(sender);

  if (!allowed) {
    const delay =
      getNextHourDelay();

    console.log(
      `[Worker] Hourly limit reached for ${sender}.`
    );

    console.log(
      `[Worker] Rescheduling email ${emailId} in ${delay}ms`
    );

    await pool.query(
      `
      UPDATE emails
      SET status = 'scheduled'
      WHERE id = $1
      `,
      [emailId]
    );

    await emailQueue.add(
      "send-email",
      {
        emailId
      },
      {
        delay,

        jobId:
          `email-${emailId}-rate-${Date.now()}`,

        attempts: Number(
          process.env.EMAIL_MAX_ATTEMPTS
        ) || 3,

        backoff: {
          type: "exponential",
          delay: 5000
        }
      }
    );

    return;
  }

  /* -------------------------
     SEND EMAIL
  ------------------------- */

  try {
    console.log(
      `[Worker] Sending email ${emailId} to ${currentEmail.recipient_email}`
    );

    const {
      transporter,
      account
    } =
      await getTransporter();

    const info =
      await transporter.sendMail({
        from: `"EmailFlow" <${account.user}>`,

        to:
          currentEmail.recipient_email,

        subject:
          currentEmail.subject,

        text:
          currentEmail.body
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
      `[Worker] Email ${emailId} sent successfully`
    );

    const previewUrl =
      nodemailer.getTestMessageUrl(info);

    console.log(
      `[Worker] Ethereal preview:`,
      previewUrl
    );
  } catch (error: any) {
    console.error(
      `[Worker] Send failed for email ${emailId}:`,
      error.message
    );

    /*
      IMPORTANT:
      Do NOT mark failed immediately.

      BullMQ must be allowed to retry.
    */

    const attempts =
      job.opts.attempts || 1;

    const attemptsMade =
      job.attemptsMade + 1;

    if (attemptsMade >= attempts) {
      await pool.query(
        `
        UPDATE emails
        SET
          status = 'failed',
          error_message = $2
        WHERE id = $1
        `,
        [
          emailId,
          error.message
        ]
      );

      console.log(
        `[Worker] Email ${emailId} permanently failed after ${attemptsMade} attempts`
      );
    } else {
      await pool.query(
        `
        UPDATE emails
        SET
          status = 'scheduled',
          error_message = $2
        WHERE id = $1
        `,
        [
          emailId,
          error.message
        ]
      );

      console.log(
        `[Worker] Email ${emailId} will be retried. Attempt ${attemptsMade}/${attempts}`
      );
    }

    throw error;
  }
}

/* =========================================
   BULLMQ WORKER
========================================= */

const worker =
  new Worker<EmailJob>(
    "email-queue",
    processEmail,
    {
      connection,

      concurrency: CONCURRENCY,

      limiter: {
        max: 1,
        duration: MIN_DELAY_MS
      }
    }
  );

worker.on(
  "completed",
  (job) => {
    console.log(
      `[Worker] Job ${job.id} completed`
    );
  }
);

worker.on(
  "failed",
  (job, error) => {
    console.error(
      `[Worker] Job ${job?.id} failed:`,
      error.message
    );
  }
);

worker.on(
  "error",
  (error) => {
    console.error(
      "[Worker] BullMQ error:",
      error.message
    );
  }
);

console.log(
  `Email worker running with concurrency ${CONCURRENCY}`
);

console.log(
  `Minimum delay between sends: ${MIN_DELAY_MS}ms`
);

console.log(
  `Maximum emails per sender per hour: ${MAX_EMAILS_PER_HOUR}`
);