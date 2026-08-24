import dotenv from "dotenv";
import { Worker, Job } from "bullmq";

import pool from "./config/db";
import { connection } from "./queue/emailQueue";

dotenv.config();

const CONCURRENCY =
  Number(process.env.WORKER_CONCURRENCY) || 5;

const MIN_DELAY_MS =
  Number(process.env.MIN_EMAIL_DELAY_MS) || 2000;

type EmailJob = {
  emailId: number;
};

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

  if (
    email.status === "sent" ||
    email.status === "cancelled"
  ) {
    console.log(
      `Email ${emailId} already completed`
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

  if (
    processingResult.rowCount === 0
  ) {
    console.log(
      `Email ${emailId} is already being processed`
    );
    return;
  }

  const currentEmail =
    processingResult.rows[0];

  try {
    console.log(
      `[SIMULATED SEND] Sending email ${emailId} to ${currentEmail.recipient_email}`
    );
    console.log(`[EMAIL METADATA] Subject: "${currentEmail.subject}"`);
    console.log(`[EMAIL BODY] ${currentEmail.body}`);

    // Simulate sending network latency
    await new Promise((resolve) => setTimeout(resolve, 500));

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
      `Email ${emailId} sent successfully (Simulated)`
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
      "Worker error:",
      error.message
    );
  }
);

console.log(
  "Email worker started"
);