import React, { useState } from "react";

interface ComposeEmailModalProps {
  onClose: () => void;
  onSchedule: (data: {
    subject: string;
    body: string;
    emails: string[];
    start_time: string;
    delay_between_emails: number;
    hourly_limit: number;
  }) => Promise<void>;
  scheduling: boolean;
}

export const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({
  onClose,
  onSchedule,
  scheduling,
}) => {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [emailList, setEmailList] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [fileError, setFileError] = useState("");

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setFileName(file.name);
    setFileError("");

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result?.toString() || "";
      const foundEmails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
      const uniqueEmails = [
        ...new Set(foundEmails.map((email) => email.trim().toLowerCase())),
      ];

      if (uniqueEmails.length === 0) {
        setFileError("No valid email addresses found in this file.");
        setEmailList([]);
      } else {
        setEmailList(uniqueEmails);
      }
    };
    reader.onerror = () => {
      setFileError("Failed to read the file.");
    };
    reader.readAsText(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailList.length === 0) {
      setFileError("Please upload a file containing at least one valid email address.");
      return;
    }
    if (!startTime) {
      return;
    }
    onSchedule({
      subject,
      body,
      emails: emailList,
      start_time: startTime,
      delay_between_emails: Number(delayBetweenEmails),
      hourly_limit: Number(hourlyLimit),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Compose New Campaign</h2>
            <p className="modal-subtitle">
              Upload your contacts list, design the message, and schedule delivery settings.
            </p>
          </div>
          <button className="btn-close-modal" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="compose-form">
          <div className="form-group">
            <label className="form-label" htmlFor="subject">Subject</label>
            <input
              id="subject"
              type="text"
              className="form-input"
              placeholder="e.g. Monthly Newsletter & Product Updates"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              disabled={scheduling}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="body">Email Body</label>
            <textarea
              id="body"
              className="form-textarea"
              placeholder="Write your email body here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              disabled={scheduling}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Upload Leads</label>
            <div className="file-upload-wrapper">
              <input
                id="file-upload"
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="file-upload-input"
                required={emailList.length === 0}
                disabled={scheduling}
              />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40" style={{ color: "var(--slate-700)", marginBottom: "0.25rem" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
              <label htmlFor="file-upload" className="file-upload-btn">
                Choose CSV or TXT
              </label>
              {fileName && <span className="uploaded-file-name">{fileName}</span>}
            </div>

            {emailList.length > 0 && (
              <div className="detected-badge">
                <span className="dot-pulse"></span>
                <strong>{emailList.length}</strong> email addresses detected
              </div>
            )}
            {fileError && <p className="form-error-msg">{fileError}</p>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="start-time">Campaign Start Time</label>
            <input
              id="start-time"
              type="datetime-local"
              className="form-input"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              disabled={scheduling}
            />
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label" htmlFor="delay">
                Delay Between Emails
              </label>
              <input
                id="delay"
                type="number"
                min="0"
                className="form-input"
                value={delayBetweenEmails}
                onChange={(e) => setDelayBetweenEmails(Number(e.target.value))}
                required
                disabled={scheduling}
              />
              <span className="input-helper-desc">
                Minimum time gap between individual email sends.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="hourly-limit">
                Hourly Limit
              </label>
              <input
                id="hourly-limit"
                type="number"
                min="1"
                className="form-input"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                required
                disabled={scheduling}
              />
              <span className="input-helper-desc">
                Maximum number of emails allowed to be sent within one hour.
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={scheduling}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-submit-campaign"
              disabled={scheduling || emailList.length === 0}
            >
              {scheduling ? (
                <>
                  <span className="btn-spinner"></span>
                  Scheduling...
                </>
              ) : (
                `Schedule ${emailList.length > 0 ? emailList.length : ""} Emails`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
