# EmailFlow 

A full-stack email scheduling application built using React, Express, BullMQ, Redis, PostgreSQL, and TypeScript.

## Features

### Backend
- Schedule emails using BullMQ delayed jobs
- PostgreSQL for storing email data
- Redis for persistent job queues
- Configurable worker concurrency
- Configurable delay between emails
- Configurable hourly rate limiting
- Simulated email dispatcher (Console Delivery Logging) for seamless cloud deployment
- No cron jobs
- Scheduled jobs remain persistent after server restarts

### Frontend
- Google OAuth login
- Compose and schedule emails
- Upload CSV/TXT email lists
- View Scheduled emails
- View Sent emails
- Email status and timing details
- Responsive dashboard

## Tech Stack

React + TypeScript | Express + TypeScript | PostgreSQL | Redis | BullMQ | Resend

## Run the Project

Start Redis and PostgreSQL first. Configure the backend `.env` file with your database, Redis, and Google OAuth credentials (no SMTP setup required!).

### Backend & Worker

The background email dispatch worker is built directly into the server startup process. Simply running the backend automatically starts both the API server and the BullMQ worker:

```bash
cd backend
npm install
npm run dev
```

*(Optional: If you wish to run the worker in a separate terminal process during development, you can start it with `npm run worker`.)*

### Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## How It Works

```text
Frontend
   ↓
Express API
   ↓
PostgreSQL
   ↓
BullMQ + Redis
   ↓
Worker (Runs concurrently inside server)
   ↓
Simulated Dispatcher (Console Logs)
```

Emails are stored in PostgreSQL and scheduled using BullMQ delayed jobs. Redis keeps queued jobs persistent after server restarts. Worker concurrency, delay between emails, and hourly limits are configurable. When the rate limit is reached, emails remain queued and are processed later.

## Screenshots

### Login

![Login](./screenshots/login.png)

### Dashboard

![Dashboard](./screenshots/dashboard.png)

### Compose Email

![Compose Email](./screenshots/compose.png)
