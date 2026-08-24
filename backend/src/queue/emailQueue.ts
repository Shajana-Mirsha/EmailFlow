import { Queue } from "bullmq";
import IORedis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.REDIS_URL) {
  console.warn(
    "WARNING: REDIS_URL is not configured. Using local Redis."
  );
}

export const connection = process.env.REDIS_URL
  ? new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    })
  : new IORedis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: null
    });

connection.on("connect", () => {
  console.log("Redis connected.");
});

connection.on("error", (error) => {
  console.error(
    "Redis connection error:",
    error.message
  );
});

export const emailQueue = new Queue(
  "email-queue",
  {
    connection,

    defaultJobOptions: {
      attempts: Number(
        process.env.EMAIL_MAX_ATTEMPTS
      ) || 3,

      backoff: {
        type: "exponential",
        delay: 5000
      },

      removeOnComplete: false,
      removeOnFail: false
    }
  }
);

emailQueue.on("error", (error) => {
  console.error(
    "BullMQ queue error:",
    error.message
  );
});