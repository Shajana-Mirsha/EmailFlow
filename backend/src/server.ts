import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import nodemailer from "nodemailer";

import pool from "./config/db";
import { getTransporter } from "./worker";

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
  !allowedOrigins.includes(process.env.FRONTEND_URL)
) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("Blocked by CORS:", origin);

      return callback(
        new Error(`Origin ${origin} is not allowed by CORS`)
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

/* =========================
   GOOGLE AUTH
========================= */

passport.use(
  new GoogleStrategy(
    {
      clientID:
        process.env.GOOGLE_CLIENT_ID as string,

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

/* =========================
   BASIC ROUTES
========================= */

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

/* =========================
   HEALTH
========================= */

app.get(
  "/health",

  async (req: Request, res: Response) => {
    try {
      await pool.query("SELECT 1");

      res.json({
        status: "ok",
        database: "connected"
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: "Database is not connected"
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

/* =========================
   SCHEDULE SINGLE EMAIL
========================= */

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
            "All required fields must be provided"
        });
      }

      const scheduledDate =
        new Date(scheduled_time);

      if (
        isNaN(scheduledDate.getTime())
      ) {
        return res.status(400).json({
          message:
            "Invalid scheduled time"
        });
      }

      if (
        scheduledDate.getTime() <= Date.now()
      ) {
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
          scheduledDate
        ]
      );

      const email = result.rows[0];

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
   BULK EMAIL SCHEDULING
========================= */

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

      const startDate =
        new Date(start_time);

      if (
        isNaN(startDate.getTime())
      ) {
        return res.status(400).json({
          message:
            "Invalid start time"
        });
      }

      if (
        startDate.getTime() <= Date.now()
      ) {
        return res.status(400).json({
          message:
            "Start time must be in the future"
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
        const recipient =
          String(emails[i]).trim();

        if (!recipient) {
          continue;
        }

        const scheduledTime =
          new Date(
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

        createdEmails.push(
          result.rows[0]
        );
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
      const result = await pool.query(
        `
        SELECT *
        FROM emails
        WHERE status IN ('sent', 'failed')
        ORDER BY sent_time DESC NULLS LAST
        `
      );

      res.json({
        emails: result.rows
      });
    } catch (error) {
      console.error(
        "Failed to fetch sent emails:",
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

      await pool.query(
        `
        UPDATE emails
        SET status = 'cancelled'
        WHERE id = $1
          AND status = 'scheduled'
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
   POSTGRES EMAIL WORKER
========================= */

let workerRunning = false;

async function postgresFallbackWorker() {
  if (workerRunning) {
    return;
  }

  workerRunning = true;

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM emails
      WHERE status = 'scheduled'
        AND scheduled_time <= CURRENT_TIMESTAMP
      ORDER BY scheduled_time ASC
      LIMIT 10
      `
    );

    for (
      const email of result.rows
    ) {
      const emailId = email.id;

      try {
        console.log(
          `[Email Worker] Processing email ${emailId} to ${email.recipient_email}`
        );

        const updateResult =
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
          updateResult.rowCount === 0
        ) {
          continue;
        }

        const {
          transporter,
          account
        } =
          await getTransporter();

        console.log(
          `[Email Worker] Sending email ${emailId}`
        );

        const info =
          await transporter.sendMail({
            from: `"EmailFlow" <${account.user}>`,
            to: email.recipient_email,
            subject: email.subject,
            text: email.body
          });

        await pool.query(
          `
          UPDATE emails
          SET
            status = 'sent',
            sent_time = CURRENT_TIMESTAMP
          WHERE id = $1
          `,
          [emailId]
        );

        console.log(
          `[Email Worker] Email ${emailId} sent successfully`
        );

        console.log(
          "Ethereal preview:",
          nodemailer.getTestMessageUrl(info)
        );

      } catch (err: any) {
        console.error(
          `[Email Worker] Failed email ${emailId}:`,
          err.message
        );

        await pool.query(
          `
          UPDATE emails
          SET status = 'failed'
          WHERE id = $1
          `,
          [emailId]
        );
      }
    }
  } catch (err: any) {
    console.error(
      "[Email Worker] Error:",
      err.message
    );
  } finally {
    workerRunning = false;
  }
}

/* =========================
   START SERVER + WORKER
========================= */

const PORT =
  Number(process.env.PORT) ||
  5000;

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );

  console.log(
    "PostgreSQL email worker started."
  );

  postgresFallbackWorker();

  setInterval(
    postgresFallbackWorker,
    5000
  );
});