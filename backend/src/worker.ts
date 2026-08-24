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

let etherealAccount: nodemailer.TestAccount | null = null;

async function getEtherealTransporter() {
  if (!etherealAccount) {
    console.log("Creating Ethereal test account...");

    etherealAccount =
      await nodemailer.createTestAccount();

    console.log(
      "Ethereal account created successfully"
    );
  }

  const transporter =
    nodemailer.createTransport({
      host: etherealAccount.smtp.host,
      port: etherealAccount.smtp.port,
      secure: etherealAccount.smtp.secure,
      auth: {
        user: etherealAccount.user,
        pass: etherealAccount.pass
      },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 30000
    });

  return {
    transporter,
    account: etherealAccount
  };
}

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

async function reserveHourlySlot(
  sender: string
) {
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
    console.log(
      `Email ${emailId} no longer exists`
    );

    return;
  }

  if (email.status === "sent") {
    console.log(
      `Email ${emailId} already sent. Skipping duplicate job.`
    );

    return;
  }

  if (email.status === "cancelled") {
    console.log(
      `Email ${emailId} was cancelled. Skipping.`
    );

    return;
  }

  if (email.status === "failed") {
    console.log(
      `Email ${emailId} already failed. Skipping.`
    );

    return;
  }

  const sender =
    email.sender_email ||
    "EmailFlow";

  const allowed =
    await reserveHourlySlot(sender);

  if (allowed === 0) {
    const delay =
      getNextHourDelay();

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
        jobId:
          `email-${emailId}-hour-${Date.now()}`,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        }
      }
    );

    return;
  }

  const processingResult =
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

  if (processingResult.rowCount === 0) {
    console.log(
      `Email ${emailId} is already being processed or completed.`
    );

    return;
  }

  const currentEmail =
    processingResult.rows[0];

  try {
    console.log(
      `Sending email ${emailId} to ${currentEmail.recipient_email}`
    );

    const {
      transporter,
      account
    } =
      await getEtherealTransporter();

    const fromName =
      currentEmail.sender_email ||
      "EmailFlow";

    const info =
      await transporter.sendMail({
        from: `"${fromName}" <${account.user}>`,
        to: currentEmail.recipient_email,
        subject: currentEmail.subject,
        text: currentEmail.body
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
      `Email ${emailId} sent successfully to ${currentEmail.recipient_email}`
    );

    const previewUrl =
      nodemailer.getTestMessageUrl(info);

    console.log(
      "Ethereal preview:",
      previewUrl
    );
  } catch (error: any) {
    console.error(
      `Failed to send email ${emailId}:`,
      error.message
    );

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

    throw error;
  }
}

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
      `Job ${job.id} completed`
    );
  }
);

worker.on(
  "failed",
  (job, error) => {
    console.error(
      `Job ${job?.id} failed:`,
      error.message
    );
  }
);

worker.on(
  "error",
  (error) => {
    console.error(
      "BullMQ Worker Error:",
      error.message
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