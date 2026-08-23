import { useEffect, useState } from "react";
import "./App.css";

type Email = {
  id: number;
  recipient_email: string;
  subject: string;
  body: string;
  scheduled_time: string;
  status: string;
  sent_time: string | null;
};

type User = {
  id: string;
  name: string;
  email: string;
  avatar: string;
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [scheduledEmails, setScheduledEmails] = useState<Email[]>([]);
  const [sentEmails, setSentEmails] = useState<Email[]>([]);

  const [loadingEmails, setLoadingEmails] = useState(true);

  const [showCompose, setShowCompose] = useState(false);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [emailList, setEmailList] = useState<string[]>([]);

  const [startTime, setStartTime] = useState("");

  const [delayBetweenEmails, setDelayBetweenEmails] =
    useState(2000);

  const [hourlyLimit, setHourlyLimit] =
    useState(200);

  const [message, setMessage] = useState("");

  const [scheduling, setScheduling] = useState(false);

  const fetchUser = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/auth/me",
        {
          credentials: "include"
        }
      );

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

      const [scheduledResponse, sentResponse] =
        await Promise.all([
          fetch(
            "http://localhost:5000/emails/scheduled"
          ),
          fetch(
            "http://localhost:5000/emails/sent"
          )
        ]);

      const scheduledData =
        await scheduledResponse.json();

      const sentData =
        await sentResponse.json();

      setScheduledEmails(
        scheduledData.emails || []
      );

      setSentEmails(
        sentData.emails || []
      );
    } catch {
      setMessage(
        "Failed to load emails"
      );
    } finally {
      setLoadingEmails(false);
    }
  };

  useEffect(() => {
    fetchUser();
    fetchEmails();
  }, []);

  const loginWithGoogle = () => {
    window.location.href =
      "http://localhost:5000/auth/google";
  };

  const logout = async () => {
    try {
      await fetch(
        "http://localhost:5000/auth/logout",
        {
          method: "POST",
          credentials: "include"
        }
      );

      setUser(null);
      setMessage("Logged out successfully");
    } catch {
      setMessage("Failed to logout");
    }
  };

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const text =
        reader.result?.toString() || "";

      const foundEmails =
        text.match(
          /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
        ) || [];

      const uniqueEmails = [
        ...new Set(
          foundEmails.map((email) =>
            email.trim().toLowerCase()
          )
        )
      ];

      setEmailList(uniqueEmails);
    };

    reader.readAsText(file);
  };

  const scheduleBulkEmails = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (emailList.length === 0) {
      setMessage(
        "Please upload a file containing email addresses"
      );
      return;
    }

    if (!startTime) {
      setMessage(
        "Please select a start time"
      );
      return;
    }

    try {
      setScheduling(true);

      const response = await fetch(
        "http://localhost:5000/emails/bulk",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            emails: emailList,
            subject,
            body,
            start_time: startTime,
            delay_between_emails:
              Number(delayBetweenEmails),
            hourly_limit:
              Number(hourlyLimit)
          })
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            "Failed to schedule emails"
        );

        return;
      }

      setMessage(
        `${data.count} emails scheduled successfully!`
      );

      setShowCompose(false);

      setSubject("");
      setBody("");
      setEmailList([]);
      setStartTime("");
      setDelayBetweenEmails(2000);
      setHourlyLimit(200);

      fetchEmails();
    } catch {
      setMessage(
        "Failed to connect to server"
      );
    } finally {
      setScheduling(false);
    }
  };

  const cancelEmail = async (
    id: number
  ) => {
    try {
      const response = await fetch(
        `http://localhost:5000/emails/${id}`,
        {
          method: "DELETE"
        }
      );

      const data =
        await response.json();

      setMessage(data.message);

      fetchEmails();
    } catch {
      setMessage(
        "Failed to cancel email"
      );
    }
  };

  if (authLoading) {
    return (
      <div className="container">
        <div className="loading-page">
          Loading EmailFlow...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container">
        <div className="card login-card">
          <h1>EmailFlow</h1>

          <p className="subtitle">
            Schedule and manage your emails
          </p>

          <button
            className="google-login-btn"
            onClick={loginWithGoogle}
          >
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">

      <header className="header">

        <div>
          <h1>EmailFlow</h1>

          <p className="subtitle">
            Schedule and manage your emails
          </p>
        </div>

        <div className="user-info">

          {user.avatar && (
            <img
              src={user.avatar}
              alt={user.name}
              className="avatar"
            />
          )}

          <div className="user-details">
            <strong>{user.name}</strong>

            <span>
              {user.email}
            </span>
          </div>

          <button
            className="logout-btn"
            onClick={logout}
          >
            Logout
          </button>

        </div>

      </header>

      <div className="dashboard-top">

        <div>
          <h2>Email Dashboard</h2>

          <p>
            Schedule, track and manage
            your email campaigns.
          </p>
        </div>

        <button
          className="compose-btn"
          onClick={() => {
            setShowCompose(true);
            setMessage("");
          }}
        >
          + Compose New Email
        </button>

      </div>

      {message && (
        <div className="message">
          {message}
        </div>
      )}

      <section className="card">

        <div className="section-header">

          <h2>
            Scheduled Emails
          </h2>

          <span className="count">
            {scheduledEmails.length}
          </span>

        </div>

        {loadingEmails ? (
          <p className="loading-text">
            Loading scheduled emails...
          </p>
        ) : scheduledEmails.length === 0 ? (
          <div className="empty-state">
            No scheduled emails found.
          </div>
        ) : (
          <div className="table-wrapper">

            <table>

              <thead>
                <tr>
                  <th>Email</th>
                  <th>Subject</th>
                  <th>Scheduled Time</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>

                {scheduledEmails.map(
                  (email) => (
                    <tr key={email.id}>

                      <td>
                        {email.recipient_email}
                      </td>

                      <td>
                        {email.subject}
                      </td>

                      <td>
                        {new Date(
                          email.scheduled_time
                        ).toLocaleString()}
                      </td>

                      <td>
                        <span className="status scheduled">
                          {email.status}
                        </span>
                      </td>

                      <td>
                        <button
                          className="cancel-btn"
                          onClick={() =>
                            cancelEmail(
                              email.id
                            )
                          }
                        >
                          Cancel
                        </button>
                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>
        )}

      </section>

      <section className="card">

        <div className="section-header">

          <h2>
            Sent Emails
          </h2>

          <span className="count">
            {sentEmails.length}
          </span>

        </div>

        {loadingEmails ? (
          <p className="loading-text">
            Loading sent emails...
          </p>
        ) : sentEmails.length === 0 ? (
          <div className="empty-state">
            No sent emails found.
          </div>
        ) : (
          <div className="table-wrapper">

            <table>

              <thead>
                <tr>
                  <th>Email</th>
                  <th>Subject</th>
                  <th>Sent Time</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>

                {sentEmails.map(
                  (email) => (
                    <tr key={email.id}>

                      <td>
                        {email.recipient_email}
                      </td>

                      <td>
                        {email.subject}
                      </td>

                      <td>
                        {email.sent_time
                          ? new Date(
                              email.sent_time
                            ).toLocaleString()
                          : "-"}
                      </td>

                      <td>

                        <span
                          className={`status ${email.status}`}
                        >
                          {email.status}
                        </span>

                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>
        )}

      </section>

      {showCompose && (

        <div className="modal-overlay">

          <div className="modal">

            <div className="modal-header">

              <div>
                <h2>
                  Compose New Email
                </h2>

                <p>
                  Upload your leads and
                  schedule your campaign.
                </p>
              </div>

              <button
                className="close-btn"
                onClick={() =>
                  setShowCompose(false)
                }
              >
                ×
              </button>

            </div>

            <form
              onSubmit={
                scheduleBulkEmails
              }
            >

              <label>
                Subject
              </label>

              <input
                type="text"
                placeholder="Enter email subject"
                value={subject}
                onChange={(e) =>
                  setSubject(
                    e.target.value
                  )
                }
                required
              />

              <label>
                Email Body
              </label>

              <textarea
                placeholder="Write your email message"
                value={body}
                onChange={(e) =>
                  setBody(
                    e.target.value
                  )
                }
                required
              />

              <label>
                Upload Leads
                (CSV or TXT)
              </label>

              <input
                type="file"
                accept=".csv,.txt"
                onChange={
                  handleFileUpload
                }
                required
              />

              <div className="detected-emails">
                Emails detected:{" "}
                <strong>
                  {emailList.length}
                </strong>
              </div>

              <label>
                Start Time
              </label>

              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) =>
                  setStartTime(
                    e.target.value
                  )
                }
                required
              />

              <div className="form-row">

                <div>

                  <label>
                    Delay Between Emails
                    (milliseconds)
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={
                      delayBetweenEmails
                    }
                    onChange={(e) =>
                      setDelayBetweenEmails(
                        Number(
                          e.target.value
                        )
                      )
                    }
                  />

                </div>

                <div>

                  <label>
                    Hourly Limit
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={
                      hourlyLimit
                    }
                    onChange={(e) =>
                      setHourlyLimit(
                        Number(
                          e.target.value
                        )
                      )
                    }
                  />

                </div>

              </div>

              <button
                type="submit"
                className="schedule-btn"
                disabled={scheduling}
              >
                {scheduling
                  ? "Scheduling..."
                  : `Schedule ${emailList.length} Emails`}
              </button>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}

export default App;