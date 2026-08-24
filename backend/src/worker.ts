import dotenv from "dotenv";
import { Worker, Job } from "bullmq";
import nodemailer from "nodemailer";
import pool from "./config/db";
import { connection, emailQueue } from "./queue/emailQueue";

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

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

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

async function waitForGlobalEmailSpacing() {
  const key = "emailflow:last-email-send";

  while (true) {
    const lastValue = await connection.get(key);

    const now = Date.now();

    if (!lastValue) {
      const locked = await connection.set(
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

    const lastSend = Number(lastValue);

    const remaining =
      MIN_DELAY_MS - (now - lastSend);

    if (remaining <= 0) {
      const locked = await connection.set(
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

    await sleep(Math.min(remaining, 500));
  }
}

export const testAccounts = new Map<
  string,
  nodemailer.TestAccount
>();

export async function getTransporter(sender: string) {
  let account = testAccounts.get(sender);

  if (!account) {
    try {
      account = await nodemailer.createTestAccount();
      testAccounts.set(sender, account);
    } catch (err) {
      console.warn("Failed to dynamically generate Ethereal SMTP account. Using static fallback:", err);
      account = {
        user: "adrian.crist23@ethereal.email",
        pass: "8X9984kMuzj684s7uN",
        smtp: {
          host: "smtp.ethereal.email",
          port: 587,
          secure: false
        },
        imap: {
          host: "imap.ethereal.email",
          port: 993,
          secure: true
        },
        pop3: {
          host: "pop3.ethereal.email",
          port: 995,
          secure: true
        },
        web: "https://ethereal.email"
      };
      testAccounts.set(sender, account);
    }
  }

  const transporter = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: {
      user: account.user,
      pass: account.pass
    }
  });

  return {
    transporter,
    account
  };
}

async function processEmail(
  job: Job<EmailJob>
) {
  const emailId = job.data.emailId;

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
    throw new Error("Email not found");
  }

  if (email.status === "sent") {
    console.log(
      `Email ${emailId} already sent. Skipping duplicate job.`
    );

    return;
  }

  if (email.status === "cancelled") {
    console.log(
      `Email ${emailId} cancelled. Skipping.`
    );

    return;
  }

  const sender =
    email.sender_email || "default";

  const allowed =
    await reserveHourlySlot(sender);

  if (allowed === 0) {
    const delay = getNextHourDelay();

    console.log(
      `Hourly limit reached for ${sender}. Rescheduling email ${emailId}.`
    );

    await emailQueue.add(
      "send-email",
      {
        emailId
      },
      {
        delay,
        jobId: `email-${emailId}-hour-${Date.now()}`,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        }
      }
    );

    return;
  }

  await waitForGlobalEmailSpacing();

  const latestResult = await pool.query(
    `
    SELECT *
    FROM emails
    WHERE id = $1
    `,
    [emailId]
  );

  const latestEmail =
    latestResult.rows[0];

  if (
    !latestEmail ||
    latestEmail.status === "sent" ||
    latestEmail.status === "cancelled"
  ) {
    return;
  }

  const {
    transporter,
    account
  } = await getTransporter(sender);

  const info = await transporter.sendMail({
    from: `${sender} <${account.user}>`,
    to: latestEmail.recipient_email,
    subject: latestEmail.subject,
    text: latestEmail.body
  });

  await pool.query(
    `
    UPDATE emails
    SET
      status = 'sent',
      sent_time = CURRENT_TIMESTAMP,
      failed_reason = NULL
    WHERE id = $1
      AND status = 'scheduled'
    `,
    [emailId]
  );

  console.log(
    `Email sent to ${latestEmail.recipient_email}`
  );

  console.log(
    "Ethereal preview:",
    nodemailer.getTestMessageUrl(info)
  );
}

const worker = new Worker<EmailJob>(
  "email-queue",
  processEmail,
  {
    connection,
    concurrency: CONCURRENCY
  }
);

worker.on("completed", (job) => {
  console.log(
    `Job ${job.id} completed`
  );
});

worker.on(
  "failed",
  async (job, error) => {
    console.error(
      `Job ${job?.id} failed:`,
      error.message
    );

    if (!job?.data.emailId) {
      return;
    }

    const attempts =
      job.opts.attempts || 1;

    const attemptsMade =
      job.attemptsMade;

    if (attemptsMade >= attempts) {
      await pool.query(
        `
        UPDATE emails
        SET
          status = 'failed',
          failed_reason = $2
        WHERE id = $1
          AND status != 'sent'
        `,
        [
          job.data.emailId,
          error.message
        ]
      );
    }
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