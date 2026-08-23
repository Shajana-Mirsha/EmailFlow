import React from "react";
import type { Email } from "../types/email";
import { StatusBadge } from "./StatusBadge";
import { EmailTiming } from "./EmailTiming";

interface EmailPreviewModalProps {
  email: Email;
  onClose: () => void;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  email,
  onClose,
}) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="preview-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="preview-modal-header">
          <div className="preview-header-brand">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="20"
              height="20"
              className="preview-envelope-icon"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
            <span className="preview-header-title">Email Dispatch Preview</span>
          </div>
          <button className="btn-close-modal" onClick={onClose} aria-label="Close preview">
            &times;
          </button>
        </div>

        <div className="preview-letter-sheet">
          {/* TO row */}
          <div className="preview-sheet-row">
            <span className="preview-sheet-label">TO</span>
            <span className="preview-sheet-value preview-recipient-text">
              {email.recipient_email}
            </span>
          </div>

          {/* SUBJECT row */}
          <div className="preview-sheet-row">
            <span className="preview-sheet-label">SUBJECT</span>
            <span className="preview-sheet-value preview-subject-text">
              {email.subject}
            </span>
          </div>

          {/* MESSAGE body card */}
          <div className="preview-sheet-body-container">
            {/* Vintage Paper Clip */}
            <div className="paper-clip-container">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="paper-clip-svg">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </div>
            <div className="preview-sheet-label" style={{ marginBottom: "0.75rem", opacity: 0.65 }}>
              MESSAGE
            </div>
            <div className="preview-sheet-message-content">
              {email.body}
            </div>
          </div>
        </div>

        {/* Footer timing metadata */}
        <div className="preview-modal-footer">
          <div className="preview-timing-box">
            <div className="preview-timing-item">
              <span className="preview-timing-label">Status</span>
              <StatusBadge status={email.status} />
            </div>
            <div className="preview-timing-item">
              <span className="preview-timing-label">Delivery Timeline</span>
              <EmailTiming email={email} showSentInfo={email.status === "sent" || email.status === "failed"} />
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
