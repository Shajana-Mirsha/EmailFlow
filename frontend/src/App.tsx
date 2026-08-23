import { useEffect, useState } from "react";
import "./App.css";
import type { Email, User } from "./types/email";
import { Header } from "./components/Header";
import { Tabs } from "./components/Tabs";
import { ComposeEmailModal } from "./components/ComposeEmailModal";
import { ScheduledEmailsTable } from "./components/ScheduledEmailsTable";
import { SentEmailsTable } from "./components/SentEmailsTable";
import { LoadingState } from "./components/LoadingState";
import { EmptyState } from "./components/EmptyState";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [scheduledEmails, setScheduledEmails] = useState<Email[]>([]);
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(true);

  const [activeTab, setActiveTab] = useState<"scheduled" | "sent">("scheduled");
  const [showCompose, setShowCompose] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const fetchUser = async () => {
    try {
      const response = await fetch("http://localhost:5000/auth/me", {
        credentials: "include",
      });

      if (!response.ok) {
        setUser(null);
        return;
      }

      const data = await response.json();
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchEmails = async () => {
    try {
      setLoadingEmails(true);
      const response = await fetch("http://localhost:5000/emails");
      if (!response.ok) {
        throw new Error("Failed to fetch");
      }
      const data = await response.json();
      const allEmails: Email[] = data.emails || [];

      // Filter scheduled emails: status is 'scheduled' or 'cancelled'
      const scheduled = allEmails.filter(
        (e) => e.status === "scheduled" || e.status === "cancelled" || e.status === "delayed"
      );

      // Filter sent emails: status is 'sent' or 'failed'
      const sent = allEmails.filter(
        (e) => e.status === "sent" || e.status === "failed"
      );

      // Order scheduled emails by scheduled_time ASC
      scheduled.sort(
        (a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
      );

      // Order sent emails by sent_time DESC (newest first)
      sent.sort((a, b) => {
        const timeA = a.sent_time ? new Date(a.sent_time).getTime() : 0;
        const timeB = b.sent_time ? new Date(b.sent_time).getTime() : 0;
        return timeB - timeA;
      });

      setScheduledEmails(scheduled);
      setSentEmails(sent);
    } catch {
      setMessage("Failed to load emails");
    } finally {
      setLoadingEmails(false);
    }
  };

  useEffect(() => {
    fetchUser();
    fetchEmails();
  }, []);

  const loginWithGoogle = () => {
    window.location.href = "http://localhost:5000/auth/google";
  };

  const logout = async () => {
    try {
      await fetch("http://localhost:5000/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      setUser(null);
      setMessage("Logged out successfully");
    } catch {
      setMessage("Failed to logout");
    }
  };

  const scheduleBulkEmails = async (formData: {
    subject: string;
    body: string;
    emails: string[];
    start_time: string;
    delay_between_emails: number;
    hourly_limit: number;
  }) => {
    try {
      setScheduling(true);
      const response = await fetch("http://localhost:5000/emails/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Failed to schedule emails");
        return;
      }

      setMessage(`${data.count} emails scheduled successfully!`);
      setShowCompose(false);
      fetchEmails();
    } catch {
      setMessage("Failed to connect to server");
    } finally {
      setScheduling(false);
    }
  };

  const cancelEmail = async (id: number) => {
    try {
      setCancellingId(id);
      const response = await fetch(`http://localhost:5000/emails/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      setMessage(data.message || "Email cancelled successfully");
      fetchEmails();
    } catch {
      setMessage("Failed to cancel email");
    } finally {
      setCancellingId(null);
    }
  };

  // Automatically clear message after 6 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (authLoading) {
    return (
      <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
        <LoadingState message="Loading EmailFlow..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-card-container">
        {/* Background decorative path SVG */}
        <div className="login-bg-decor">
          <svg viewBox="0 0 1440 800" fill="none" className="login-decor-svg">
            {/* Curved Path 1 (Rose Pink) */}
            <path
              d="M-100,200 Q250,550 650,350 T1500,100"
              stroke="#f472b6"
              strokeWidth="3.5"
              strokeDasharray="10 10"
              opacity="0.25"
            />
            {/* Curved Path 2 (Muted Brown) */}
            <path
              d="M100,750 Q550,250 950,700 T1600,350"
              stroke="#b45309"
              strokeWidth="2.5"
              strokeDasharray="8 8"
              opacity="0.18"
            />
            
            {/* Mail Icon 1 along Path 1 (Pink) */}
            <g transform="translate(420, 410) rotate(-12)" opacity="0.65">
              <rect width="42" height="28" rx="4" fill="#fbcfe8" stroke="#f472b6" strokeWidth="2" />
              <path d="M0,0 L21,13 L42,0" stroke="#f472b6" strokeWidth="2" fill="none" />
            </g>

            {/* Mail Icon 2 along Path 2 (Brown) */}
            <g transform="translate(720, 520) rotate(15)" opacity="0.55">
              <rect width="38" height="26" rx="4" fill="#ffedd5" stroke="#b45309" strokeWidth="2" />
              <path d="M0,0 L19,12 L38,0" stroke="#b45309" strokeWidth="2" fill="none" />
            </g>

            {/* Mail Icon 3 (Pink) */}
            <g transform="translate(1080, 240) rotate(-8)" opacity="0.6">
              <rect width="40" height="28" rx="4" fill="#fbcfe8" stroke="#f472b6" strokeWidth="2" />
              <path d="M0,0 L20,13 L40,0" stroke="#f472b6" strokeWidth="2" fill="none" />
            </g>

            {/* Mail Icon 4 (Brown) */}
            <g transform="translate(160, 290) rotate(18)" opacity="0.5">
              <rect width="38" height="26" rx="4" fill="#ffedd5" stroke="#b45309" strokeWidth="2" />
              <path d="M0,0 L19,12 L38,0" stroke="#b45309" strokeWidth="2" fill="none" />
            </g>
          </svg>
        </div>

        <div className="login-card-box">
          <div className="login-logo">
            <svg viewBox="0 0 24 24" fill="currentColor" width="56" height="56">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 4l-7 4.5L5 7V5l7 4.5L19 5v2z" />
            </svg>
          </div>
          <h1 className="login-title">EmailFlow</h1>
          <p className="login-desc">
            Schedule and manage your email campaigns.
          </p>
          <button className="btn btn-google-login" onClick={loginWithGoogle}>
            <svg className="google-icon-svg" viewBox="0 0 24 24" width="22" height="22">
              <path fill="#EA4335" d="M12 5.04c1.67 0 3.2.58 4.38 1.69l3.27-3.27C17.67 1.55 15 0 12 0 7.35 0 3.4 2.67 1.5 6.57l3.9 3.02C6.35 6.94 8.94 5.04 12 5.04z" />
              <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.54h6.48c-.28 1.48-1.11 2.73-2.37 3.58l3.69 2.87c2.16-1.99 3.69-4.92 3.69-8.65z" />
              <path fill="#FBBC05" d="M5.4 14.97c-.24-.73-.38-1.5-.38-2.3s.14-1.57.38-2.3L1.5 7.35C.54 9.27 0 11.4 0 13.67s.54 4.4 1.5 6.32l3.9-3.02z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.97-1.07 7.96-2.92l-3.69-2.87c-1.02.68-2.33 1.09-4.27 1.09-3.06 0-5.65-1.9-6.58-4.55l-3.9 3.02C3.4 21.33 7.35 24 12 24z" />
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  // Real-time Analytics Calculations
  const totalSentCount = sentEmails.filter(e => e.status === "sent").length;
  const totalFailedCount = sentEmails.filter(e => e.status === "failed").length;
  const totalCancelledCount = scheduledEmails.filter(e => e.status === "cancelled").length;
  const activeScheduledCount = scheduledEmails.filter(e => e.status === "scheduled").length;
  
  const totalProcessedCount = totalSentCount + totalFailedCount;
  const successRatePercentage = totalProcessedCount > 0 
    ? Math.round((totalSentCount / totalProcessedCount) * 100) 
    : 100;

  return (
    <div className="container">
      <Header user={user} onLogout={logout} />

      <div className="dashboard-top">
        <div className="dashboard-title-area">
          <h2>Email Scheduler</h2>
          <p>Orchestrate and coordinate bulk email campaigns with precise delay settings.</p>
        </div>

        <button
          className="btn btn-compose"
          onClick={() => {
            setShowCompose(true);
            setMessage("");
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          + Compose New Email
        </button>
      </div>

      {message && (
        <div className="message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {message}
        </div>
      )}

      {/* Real-time Analytics Dashboard Grid */}
      <div className="stats-overview-grid">
        <div className="stat-card">
          <div className="stat-card-label">
            <span className="stat-card-dot pulse-scheduled"></span>
            Scheduled Queue
          </div>
          <div className="stat-card-value">{activeScheduledCount}</div>
          <div className="stat-card-desc">Active campaign segments</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">
            <span className="stat-card-dot pulse-sent"></span>
            Successful Deliveries
          </div>
          <div className="stat-card-value">{totalSentCount}</div>
          <div className="stat-card-desc">Dispatched to outbox</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">
            <span className="stat-card-dot pulse-rate"></span>
            Deliverability Rate
          </div>
          <div className="stat-card-value">{successRatePercentage}%</div>
          <div className="stat-card-desc">Success ratio vs failures</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">
            <span className="stat-card-dot pulse-cancelled"></span>
            Cancelled Sequences
          </div>
          <div className="stat-card-value">{totalCancelledCount}</div>
          <div className="stat-card-desc">Manually stopped queues</div>
        </div>
      </div>

      <Tabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        scheduledCount={scheduledEmails.length}
        sentCount={sentEmails.length}
      />

      <main style={{ marginTop: "1rem" }}>
        {activeTab === "scheduled" ? (
          loadingEmails ? (
            <LoadingState message="Loading scheduled emails..." />
          ) : scheduledEmails.length === 0 ? (
            <EmptyState
              title="No scheduled emails yet"
              message="Your scheduled campaigns and processing queue will appear here. Click '+ Compose New Email' to get started."
            />
          ) : (
            <ScheduledEmailsTable
              emails={scheduledEmails}
              onCancel={cancelEmail}
              cancellingId={cancellingId}
            />
          )
        ) : loadingEmails ? (
          <LoadingState message="Loading sent emails..." />
        ) : sentEmails.length === 0 ? (
          <EmptyState
            title="No sent emails yet"
            message="Your sent outbox and deliverability statuses will appear here once campaign processing begins."
            icon={
              <svg
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                width="48"
                height="48"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            }
          />
        ) : (
          <SentEmailsTable emails={sentEmails} />
        )}
      </main>

      {showCompose && (
        <ComposeEmailModal
          onClose={() => setShowCompose(false)}
          onSchedule={scheduleBulkEmails}
          scheduling={scheduling}
        />
      )}
    </div>
  );
}

export default App;