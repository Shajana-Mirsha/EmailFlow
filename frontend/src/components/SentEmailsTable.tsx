import React from "react";
import type { Email } from "../types/email";
import { StatusBadge } from "./StatusBadge";
import { EmailTiming } from "./EmailTiming";

interface SentEmailsTableProps {
  emails: Email[];
}

export const SentEmailsTable: React.FC<SentEmailsTableProps> = ({ emails }) => {
  return (
    <div className="table-card">
      <div className="table-responsive">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th style={{ width: "25%" }}>Recipient</th>
              <th style={{ width: "30%" }}>Campaign Details</th>
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
                  <div className="subject-cell">
                    <span className="email-subject-text" title={email.subject}>
                      {email.subject}
                    </span>
                    <p className="email-body-preview" title={email.body}>
                      {email.body}
                    </p>
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
