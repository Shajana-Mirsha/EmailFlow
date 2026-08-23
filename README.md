# EmailFlow 📧

A full-stack email scheduling application built for the ReachInbox Software Development Intern assignment.

## Features

- Google OAuth login
- Schedule emails
- Upload CSV/TXT email lists
- View Scheduled and Sent emails
- Shows scheduled time and actual sent time
- BullMQ + Redis for background scheduling
- PostgreSQL for storing email data
- Ethereal Email for testing
- No cron jobs

## Tech Stack

React + TypeScript | Express + TypeScript | PostgreSQL | Redis | BullMQ | Ethereal Email

## Run the Project

### Start Redis

```bash
redis-server
```

### Start Backend

```bash
cd backend
npm install
npm run dev
```

### Start Worker

Open another terminal:

```bash
cd backend
npm run worker
```

### Start Frontend

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
Frontend → Express API → PostgreSQL
                     ↓
               BullMQ + Redis
                     ↓
                   Worker
                     ↓
               Ethereal Email
```

Scheduled jobs are stored in Redis using BullMQ, so cron jobs are not used. Email data and status are stored in PostgreSQL.

## Screenshots

_Add project screenshots here._

---

Created for the ReachInbox Software Development Intern Assignment.
