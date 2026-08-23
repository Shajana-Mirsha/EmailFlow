import React from "react";
import type { Email } from "../types/email";
import { StatusBadge } from "./StatusBadge";
import { EmailTiming } from "./EmailTiming";

interface SentEmailsTableProps {
  emails: Email[];
  onPreview: (email: Email) => void;
}

export const SentEmailsTable: React.FC<SentEmailsTableProps> = ({
  emails,
  onPreview,
}) => {
  return (
    <div className="table-card">
      <div className="table-responsive">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th style={{ width: "25%" }}>Recipient</th>
              <th style={{ width: "30%" }}>
                Message
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "normal", marginTop: "0.25rem" }}>
                  Click the mail icon to view the message
                </div>
              </th>
              <th style={{ width: "35%" }}>Transmission Timeline</th>
              <th style={{ width: "10%" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {emails.map((email) => (
              <tr key={email.id}>
                <td>
                  <div className="recipient-cell">
                    <div className="recipient-icon">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        width="12"
                        height="12"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                    <span className="recipient-email-text" title={email.recipient_email}>
                      {email.recipient_email}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="subject-cell-row">
                    <button
                      className="btn-preview-trigger"
                      style={{ color: "#a855f7", marginLeft: 0 }}
                      onClick={() => onPreview(email)}
                      title="Preview email"
                      aria-label="Preview email"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        width="24"
                        height="24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
                <td>
                  <EmailTiming email={email} showSentInfo={true} />
                </td>
                <td>
                  <StatusBadge status={email.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
