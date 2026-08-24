import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import GoogleStrategy from "passport-google-oauth20";
import nodemailer from "nodemailer";
import pool from "./config/db";
import { emailQueue } from "./queue/emailQueue";
import { getTransporter } from "./worker";

dotenv.config();

const timeoutPromise = (ms: number) =>
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), ms)
  );

async function runWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  try {
    return (await Promise.race([promise, timeoutPromise(ms)])) as T;
  } catch (err: any) {
    console.warn("Operation timed out or failed (likely Redis is offline):", err.message);
    return null;
  }
}

const app = express();

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "https://emailflow-k7d4.onrender.com";

const isProduction =
  process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true
  })
);

app.use(express.json());

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "emailflow_super_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax"
    }
  })
);

app.use(passport.initialize());

app.use(passport.session());

passport.serializeUser((user: any, done) => {
  done(null, user);
});

passport.deserializeUser((user: any, done) => {
  done(null, user);
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID as string,

      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET as string,

      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        "https://emailflow-api-zhwz.onrender.com/auth/google/callback"
    },

    async (
      accessToken,
      refreshToken,
      profile,
      done
    ) => {
      try {
        return done(null, {
          id: profile.id,
          name: profile.displayName,
          email: profile.emails?.[0]?.value,
          avatar: profile.photos?.[0]?.value
        });
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "EmailFlow API is running!"
  });
});

app.get(
  "/auth/google",

  passport.authenticate("google", {
    scope: ["profile", "email"]
  })
);

app.get(
  "/auth/google/callback",

  passport.authenticate("google", {
    failureRedirect: `${FRONTEND_URL}/login`
  }),

  (req, res) => {
    res.redirect(`${FRONTEND_URL}/dashboard`);
  }
);

app.get(
  "/auth/me",

  (req: any, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        authenticated: false
      });
    }

    res.json({
      authenticated: true,
      user: req.user
    });
  }
);

app.post(
  "/auth/logout",

  (req: any, res: Response) => {
    req.logout((error: any) => {
      if (error) {
        return res.status(500).json({
          message: "Logout failed"
        });
      }

      req.session.destroy(() => {
        res.clearCookie("connect.sid");

        res.json({
          message: "Logged out successfully"
        });
      });
    });
  }
);

app.get(
  "/health",

  async (req: Request, res: Response) => {
    try {
      await pool.query("SELECT 1");

      await emailQueue.count();

      res.json({
        status: "ok",
        database: "connected",
        redis: "connected"
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message:
          "A service is not connected"
      });
    }
  }
);

app.get(
  "/test-db",

  async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        "SELECT NOW()"
      );

      res.json({
        message:
          "Database connected successfully!",
        time: result.rows[0].now
      });
    } catch (error) {
      console.error(
        "Database error:",
        error
      );

      res.status(500).json({
        message:
          "Database connection failed"
      });
    }
  }
);

app.post(
  "/emails",

  async (req: Request, res: Response) => {
    try {
      const {
        recipient_email,
        sender_email,
        subject,
        body,
        scheduled_time
      } = req.body;

      if (
        !recipient_email ||
        !subject ||
        !body ||
        !scheduled_time
      ) {
        return res.status(400).json({
          message:
            "All fields are required"
        });
      }

      const scheduledDate = new Date(
        scheduled_time
      );

      if (
        isNaN(scheduledDate.getTime())
      ) {
        return res.status(400).json({
          message:
            "Invalid scheduled time"
        });
      }

      const delay =
        scheduledDate.getTime() -
        Date.now();

      if (delay < 0) {
        return res.status(400).json({
          message:
            "Scheduled time must be in the future"
        });
      }

      const result = await pool.query(
        `
        INSERT INTO emails
        (
          recipient_email,
          sender_email,
          subject,
          body,
          scheduled_time,
          status
        )
        VALUES ($1, $2, $3, $4, $5, 'scheduled')
        RETURNING *
        `,
        [
          recipient_email,
          sender_email || null,
          subject,
          body,
          scheduled_time
        ]
      );

      const email = result.rows[0];

      await emailQueue.add(
        "send-email",
        {
          emailId: email.id
        },
        {
          delay,
          jobId: `email-${email.id}`,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000
          }
        }
      );

      res.status(201).json({
        message:
          "Email scheduled successfully",
        email
      });
    } catch (error) {
      console.error(
        "Error scheduling email:",
        error
      );

      res.status(500).json({
        message:
          "Failed to schedule email"
      });
    }
  }
);

app.post(
  "/emails/bulk",

  async (req: Request, res: Response) => {
    try {
      const {
        emails,
        sender_email,
        subject,
        body,
        start_time,
        delay_between_emails
      } = req.body;

      if (
        !Array.isArray(emails) ||
        emails.length === 0 ||
        !subject ||
        !body ||
        !start_time
      ) {
        return res.status(400).json({
          message:
            "Required fields are missing"
        });
      }

      const startDate = new Date(
        start_time
      );

      if (
        isNaN(startDate.getTime())
      ) {
        return res.status(400).json({
          message:
            "Invalid start time"
        });
      }

      const delayBetween =
        Number(delay_between_emails) ||
        Number(
          process.env.MIN_EMAIL_DELAY_MS
        ) ||
        2000;

      const createdEmails = [];

      for (
        let i = 0;
        i < emails.length;
        i++
      ) {
        const recipient = String(
          emails[i]
        ).trim();

        if (!recipient) {
          continue;
        }

        const scheduledTime = new Date(
          startDate.getTime() +
            i * delayBetween
        );

        const result = await pool.query(
          `
          INSERT INTO emails
          (
            recipient_email,
            sender_email,
            subject,
            body,
            scheduled_time,
            status
          )
          VALUES ($1, $2, $3, $4, $5, 'scheduled')
          RETURNING *
          `,
          [
            recipient,
            sender_email || null,
            subject,
            body,
            scheduledTime
          ]
        );

        const email = result.rows[0];

        const jobDelay =
          scheduledTime.getTime() -
          Date.now();

        await runWithTimeout(
          emailQueue.add(
            "send-email",
            {
              emailId: email.id
            },
            {
              delay: Math.max(
                jobDelay,
                0
              ),
              jobId: `email-${email.id}`,
              attempts: 3,
              backoff: {
                type: "exponential",
                delay: 5000
              }
            }
          ),
          1500
        );

        createdEmails.push(email);
      }

      res.status(201).json({
        message: `${createdEmails.length} emails scheduled successfully`,
        count: createdEmails.length,
        emails: createdEmails
      });
    } catch (error) {
      console.error(
        "Bulk scheduling error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to schedule emails"
      });
    }
  }
);

app.get(
  "/emails",

  async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `
        SELECT *
        FROM emails
        ORDER BY scheduled_time ASC
        `
      );

      res.json({
        emails: result.rows
      });
    } catch (error) {
      res.status(500).json({
        message:
          "Failed to fetch emails"
      });
    }
  }
);

app.get(
  "/emails/scheduled",

  async (
    req: Request,
    res: Response
  ) => {
    try {
      const result = await pool.query(
        `
        SELECT *
        FROM emails
        WHERE status = 'scheduled'
        ORDER BY scheduled_time ASC
        `
      );

      res.json({
        emails: result.rows
      });
    } catch (error) {
      res.status(500).json({
        message:
          "Failed to fetch scheduled emails"
      });
    }
  }
);

app.get(
  "/emails/sent",

  async (
    req: Request,
    res: Response
  ) => {
    try {
      const result = await pool.query(
        `
        SELECT *
        FROM emails
        WHERE status IN ('sent', 'failed')
        ORDER BY sent_time DESC
        `
      );

      res.json({
        emails: result.rows
      });
    } catch (error) {
      res.status(500).json({
        message:
          "Failed to fetch sent emails"
      });
    }
  }
);

app.delete(
  "/emails/:id",

  async (
    req: Request,
    res: Response
  ) => {
    try {
      const id = Number(req.params.id);

      const result = await pool.query(
        "SELECT * FROM emails WHERE id = $1",
        [id]
      );

      const email = result.rows[0];

      if (!email) {
        return res.status(404).json({
          message:
            "Email not found"
        });
      }

      if (
        email.status !== "scheduled"
      ) {
        return res.status(400).json({
          message:
            "Only scheduled emails can be cancelled"
        });
      }

      const job = await runWithTimeout(
        emailQueue.getJob(`email-${id}`),
        1500
      );

      if (job) {
        try {
          await runWithTimeout(job.remove(), 1500);
        } catch (err) {
          console.warn("Failed to remove job from queue:", err);
        }
      }

      await pool.query(
        `
        UPDATE emails
        SET status = 'cancelled'
        WHERE id = $1
        `,
        [id]
      );

      res.json({
        message:
          "Email cancelled successfully"
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Failed to cancel email"
      });
    }
  }
);

// Fallback background polling worker to send emails directly via PostgreSQL if Redis is down
async function postgresFallbackWorker() {
  try {
    const result = await pool.query(
      `
      SELECT * FROM emails
      WHERE status = 'scheduled'
        AND scheduled_time <= CURRENT_TIMESTAMP
      ORDER BY scheduled_time ASC
      LIMIT 10
      `
    );

    for (const email of result.rows) {
      const emailId = email.id;
      const sender = email.sender_email || "default";

      try {
        console.log(`[Fallback Worker] Processing scheduled email ID ${emailId} to ${email.recipient_email}`);

        const updateResult = await pool.query(
          `
          UPDATE emails
          SET status = 'processing'
          WHERE id = $1 AND status = 'scheduled'
          RETURNING *
          `,
          [emailId]
        );

        if (updateResult.rowCount === 0) {
          continue;
        }

        const { transporter, account } = await getTransporter(sender);
        const info = await transporter.sendMail({
          from: `${sender} <${account.user}>`,
          to: email.recipient_email,
          subject: email.subject,
          text: email.body
        });

        await pool.query(
          `
          UPDATE emails
          SET
            status = 'sent',
            sent_time = CURRENT_TIMESTAMP,
            failed_reason = NULL
          WHERE id = $1
          `,
          [emailId]
        );

        console.log(`[Fallback Worker] Email ${emailId} successfully sent to ${email.recipient_email}`);
      } catch (err: any) {
        console.error(`[Fallback Worker] Failed to send email ID ${emailId}:`, err.message);
        await pool.query(
          `
          UPDATE emails
          SET
            status = 'failed',
            failed_reason = $2
          WHERE id = $1
          `,
          [emailId, err.message]
        );
      }
    }
  } catch (err: any) {
    console.error("[Fallback Worker] Error in database polling loop:", err.message);
  }
}

// Start the fallback polling loop every 5 seconds
setInterval(postgresFallbackWorker, 5000);

const PORT =
  Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );

  // Start the background queue worker in the same process for simplified cloud deployment (e.g. on Render)
  import("./worker")
    .then(() => {
      console.log("Background email queue worker started inside server process.");
    })
    .catch((err) => {
      console.error("Failed to start background queue worker:", err);
    });
});