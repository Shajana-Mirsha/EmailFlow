import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import GoogleStrategy from "passport-google-oauth20";
import pool from "./config/db";
import { emailQueue } from "./queue/emailQueue";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
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
      secure: false,
      httpOnly: true
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
        "http://localhost:5000/auth/google/callback"
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
    failureRedirect:
      "http://localhost:5173/login"
  }),
  (req, res) => {
    res.redirect(
      "http://localhost:5173/dashboard"
    );
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

        await emailQueue.add(
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

      const job =
        await emailQueue.getJob(
          `email-${id}`
        );

      if (job) {
        await job.remove();
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

const PORT =
  Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running on http://localhost:${PORT}`
  );
});