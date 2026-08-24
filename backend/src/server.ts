import express, {
  Request,
  Response
} from "express";

import dotenv from "dotenv";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import GoogleStrategy from "passport-google-oauth20";

import pool from "./config/db";
import { emailQueue } from "./queue/emailQueue";

dotenv.config();

const app = express();

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "https://emailflow-k7d4.onrender.com";

const isProduction =
  process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

/* =========================
   CORS
========================= */

const allowedOrigins = [
  "https://emailflow-k7d4.onrender.com",
  "http://localhost:5173",
  "http://localhost:3000"
];

if (
  process.env.FRONTEND_URL &&
  !allowedOrigins.includes(
    process.env.FRONTEND_URL
  )
) {
  allowedOrigins.push(
    process.env.FRONTEND_URL
  );
}

app.use(
  cors({
    origin: (
      origin,
      callback
    ) => {
      if (!origin) {
        return callback(null, true);
      }

      if (
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      console.log(
        "Blocked by CORS:",
        origin
      );

      return callback(
        new Error(
          `Origin ${origin} is not allowed by CORS`
        )
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
  })
);

app.use(express.json());

/* =========================
   SESSION
========================= */

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
      sameSite:
        isProduction
          ? "none"
          : "lax"
    }
  })
);

app.use(
  passport.initialize()
);

app.use(
  passport.session()
);

passport.serializeUser(
  (user: any, done) => {
    done(null, user);
  }
);

passport.deserializeUser(
  (user: any, done) => {
    done(null, user);
  }
);

/* =========================
   GOOGLE OAUTH
========================= */

passport.use(
  new GoogleStrategy(
    {
      clientID:
        process.env
          .GOOGLE_CLIENT_ID as string,

      clientSecret:
        process.env
          .GOOGLE_CLIENT_SECRET as string,

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

          name:
            profile.displayName,

          email:
            profile.emails?.[0]?.value,

          avatar:
            profile.photos?.[0]?.value
        });
      } catch (error) {
        return done(
          error as Error
        );
      }
    }
  )
);

/* =========================
   BASIC ROUTES
========================= */

app.get(
  "/",
  (
    req: Request,
    res: Response
  ) => {
    res.json({
      message:
        "EmailFlow API is running!"
    });
  }
);

app.get(
  "/auth/google",

  passport.authenticate(
    "google",
    {
      scope: [
        "profile",
        "email"
      ]
    }
  )
);

app.get(
  "/auth/google/callback",

  passport.authenticate(
    "google",
    {
      failureRedirect:
        `${FRONTEND_URL}/login`
    }
  ),

  (
    req,
    res
  ) => {
    res.redirect(
      `${FRONTEND_URL}/dashboard`
    );
  }
);

app.get(
  "/auth/me",

  (
    req: any,
    res: Response
  ) => {
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

  (
    req: any,
    res: Response
  ) => {
    req.logout(
      (error: any) => {
        if (error) {
          return res
            .status(500)
            .json({
              message:
                "Logout failed"
            });
        }

        req.session.destroy(() => {
          res.clearCookie(
            "connect.sid"
          );

          res.json({
            message:
              "Logged out successfully"
          });
        });
      }
    );
  }
);

/* =========================
   HEALTH CHECK
========================= */

app.get(
  "/health",

  async (
    req: Request,
    res: Response
  ) => {
    try {
      await pool.query(
        "SELECT 1"
      );

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
          "Database or Redis is not connected"
      });
    }
  }
);

/* =========================
   TEST DATABASE
========================= */

app.get(
  "/test-db",

  async (
    req: Request,
    res: Response
  ) => {
    try {
      const result =
        await pool.query(
          "SELECT NOW()"
        );

      res.json({
        message:
          "Database connected successfully!",
        time:
          result.rows[0].now
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

/* =========================
   SCHEDULE SINGLE EMAIL
========================= */

app.post(
  "/emails",

  async (
    req: Request,
    res: Response
  ) => {
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
        return res
          .status(400)
          .json({
            message:
              "All fields are required"
          });
      }

      const scheduledDate =
        new Date(
          scheduled_time
        );

      if (
        isNaN(
          scheduledDate.getTime()
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "Invalid scheduled time"
          });
      }

      const delay =
        scheduledDate.getTime() -
        Date.now();

      if (delay < 0) {
        return res
          .status(400)
          .json({
            message:
              "Scheduled time must be in the future"
          });
      }

      const result =
        await pool.query(
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
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            'scheduled'
          )
          RETURNING *
          `,
          [
            recipient_email,
            sender_email || null,
            subject,
            body,
            scheduledDate
          ]
        );

      const email =
        result.rows[0];

      await emailQueue.add(
        "send-email",
        {
          emailId: email.id
        },
        {
          delay,

          jobId:
            `email-${email.id}`,

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

/* =========================
   SCHEDULE BULK EMAILS
========================= */

app.post(
  "/emails/bulk",

  async (
    req: Request,
    res: Response
  ) => {
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
        return res
          .status(400)
          .json({
            message:
              "Required fields are missing"
          });
      }

      const startDate =
        new Date(start_time);

      if (
        isNaN(
          startDate.getTime()
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "Invalid start time"
          });
      }

      const delayBetween =
        Number(
          delay_between_emails
        ) ||
        Number(
          process.env
            .MIN_EMAIL_DELAY_MS
        ) ||
        2000;

      const createdEmails = [];

      for (
        let i = 0;
        i < emails.length;
        i++
      ) {
        const recipient =
          String(
            emails[i]
          ).trim();

        if (!recipient) {
          continue;
        }

        const scheduledTime =
          new Date(
            startDate.getTime() +
            i * delayBetween
          );

        const result =
          await pool.query(
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
            VALUES
            (
              $1,
              $2,
              $3,
              $4,
              $5,
              'scheduled'
            )
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

        const email =
          result.rows[0];

        const jobDelay =
          Math.max(
            scheduledTime.getTime() -
              Date.now(),
            0
          );

        await emailQueue.add(
          "send-email",
          {
            emailId: email.id
          },
          {
            delay: jobDelay,

            jobId:
              `email-${email.id}`,

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
        message:
          `${createdEmails.length} emails scheduled successfully`,

        count:
          createdEmails.length,

        emails:
          createdEmails
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

/* =========================
   GET ALL EMAILS
========================= */

app.get(
  "/emails",

  async (
    req: Request,
    res: Response
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT *
          FROM emails
          ORDER BY scheduled_time ASC
          `
        );

      res.json({
        emails:
          result.rows
      });
    } catch (error) {
      console.error(
        "Failed to fetch emails:",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch emails"
      });
    }
  }
);

/* =========================
   GET SCHEDULED EMAILS
========================= */

app.get(
  "/emails/scheduled",

  async (
    req: Request,
    res: Response
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT *
          FROM emails
          WHERE status IN
          (
            'scheduled',
            'processing'
          )
          ORDER BY scheduled_time ASC
          `
        );

      res.json({
        emails:
          result.rows
      });
    } catch (error) {
      console.error(
        "Failed to fetch scheduled emails:",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch scheduled emails"
      });
    }
  }
);

/* =========================
   GET SENT / FAILED EMAILS
========================= */

app.get(
  "/emails/sent",

  async (
    req: Request,
    res: Response
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT *
          FROM emails
          WHERE status IN
          (
            'sent',
            'failed'
          )
          ORDER BY sent_time DESC NULLS LAST,
                   scheduled_time DESC
          `
        );

      res.json({
        emails:
          result.rows
      });
    } catch (error) {
      console.error(
        "Failed to fetch sent emails:",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch sent emails"
      });
    }
  }
);

/* =========================
   CANCEL EMAIL
========================= */

app.delete(
  "/emails/:id",

  async (
    req: Request,
    res: Response
  ) => {
    try {
      const id =
        Number(req.params.id);

      const result =
        await pool.query(
          `
          SELECT *
          FROM emails
          WHERE id = $1
          `,
          [id]
        );

      const email =
        result.rows[0];

      if (!email) {
        return res
          .status(404)
          .json({
            message:
              "Email not found"
          });
      }

      if (
        email.status !==
        "scheduled"
      ) {
        return res
          .status(400)
          .json({
            message:
              "Only scheduled emails can be cancelled"
          });
      }

      const job =
        await emailQueue.getJob(
          `email-${id}`
        );

      if (job) {
        try {
          await job.remove();
        } catch (error) {
          console.warn(
            `Could not remove queue job for email ${id}`
          );
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
      console.error(
        "Failed to cancel email:",
        error
      );

      res.status(500).json({
        message:
          "Failed to cancel email"
      });
    }
  }
);

/* =========================
   START SERVER + WORKER
========================= */

const PORT =
  Number(
    process.env.PORT
  ) || 5000;

app.listen(
  PORT,
  async () => {
    console.log(
      `Server running on port ${PORT}`
    );

    try {
      await import("./worker");

      console.log(
        "Background email queue worker started."
      );
    } catch (error) {
      console.error(
        "Failed to start email worker:",
        error
      );
    }
  }
);