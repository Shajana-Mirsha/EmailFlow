import React from "react";
import type { Email } from "../types/email";
import { formatDateTime, getDelaySeconds, formatDelay, formatTimeFirst } from "../utils/dateUtils";

interface EmailTimingProps {
  email: Email;
  showSentInfo?: boolean;
}

export const EmailTiming: React.FC<EmailTimingProps> = ({ email, showSentInfo = false }) => {
  const isPastScheduled =
    email.status === "scheduled" && new Date(email.scheduled_time).getTime() < Date.now();

  if (!showSentInfo || !email.sent_time) {
    return (
      <div className="timing-container">
        <div className="timing-row">
          <span className="timing-icon">🕒</span>
          <span className="timing-val">{formatDateTime(email.scheduled_time)}</span>
        </div>
        {isPastScheduled && (
          <div className="timing-pending-text">
            <span>Scheduled time passed — pending processing</span>
          </div>
        )}
      </div>
    );
  }

  const delaySec = getDelaySeconds(email.scheduled_time, email.sent_time);
  const delayFormatted = delaySec !== null ? formatDelay(delaySec) : null;
  const isOnSchedule = delaySec !== null && delaySec <= 1;

  return (
    <div className="timing-flow">
      <div className="timing-node">
        <div className="timing-icon-wrapper scheduled-icon">🕒</div>
        <div className="timing-details">
          <span className="timing-label">Scheduled:</span>
          <span className="timing-val">{formatDateTime(email.scheduled_time)}</span>
        </div>
      </div>
      
      <div className="timing-line-connector">
        <div className="connector-dots"></div>
      </div>

      <div className="timing-node">
        <div className={`timing-icon-wrapper sent-icon ${email.status === "failed" ? "failed-icon" : ""}`}>
          {email.status === "failed" ? "✕" : "✓"}
        </div>
        <div className="timing-details">
          <span className="timing-label">
            {email.status === "failed" ? "Failed At:" : "Actually Sent:"}
          </span>
          <span className="timing-val">{formatTimeFirst(email.sent_time)}</span>
        </div>
      </div>

      {delayFormatted && (
        <div className={`timing-delay-badge ${isOnSchedule ? "on-schedule" : "late"}`}>
          {isOnSchedule ? (
            <span className="delay-badge-text">✓ {delayFormatted} delay</span>
          ) : (
            <span className="delay-badge-text">⌛ {delayFormatted} delay</span>
          )}
        </div>
      )}
    </div>
  );
};
