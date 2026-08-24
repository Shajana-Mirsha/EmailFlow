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
  const [recipientSource, setRecipientSource] = useState<"file" | "manual">("file");
  const [manualEmailsText, setManualEmailsText] = useState("");

  const handleSourceChange = (source: "file" | "manual") => {
    setRecipientSource(source);
    setEmailList([]);
    setFileName("");
    setManualEmailsText("");
    setFileError("");
  };

  const handleManualEmailsChange = (val: string) => {
    setManualEmailsText(val);
    const foundEmails = val.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    const uniqueEmails = [
      ...new Set(foundEmails.map((email) => email.trim().toLowerCase())),
    ];
    setEmailList(uniqueEmails);
  };

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
      setFileError("Please provide at least one valid recipient email address.");
      return;
    }
    if (!startTime) {
      return;
    }
    onSchedule({
      subject,
      body,
      emails: emailList,
      start_time: new Date(startTime).toISOString(),
      delay_between_emails: Number(delayBetweenEmails),
      hourly_limit: Number(hourlyLimit),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Compose New Email</h2>
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
              style={{ minHeight: "180px" }}
              placeholder="Write your email body here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              disabled={scheduling}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Recipient List</label>
            
            {/* Recipient Source Toggler Tabs */}
            <div className="recipient-tabs" style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <button
                type="button"
                className={`tab-btn ${recipientSource === "file" ? "active" : ""}`}
                onClick={() => handleSourceChange("file")}
                style={{
                  flex: 1,
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  border: recipientSource === "file" ? "2px solid #4f46e5" : "1px solid #cbd5e1",
                  backgroundColor: recipientSource === "file" ? "#e0e7ff" : "white",
                  color: recipientSource === "file" ? "#4f46e5" : "#4b5563",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Upload File (.csv, .txt)
              </button>
              <button
                type="button"
                className={`tab-btn ${recipientSource === "manual" ? "active" : ""}`}
                onClick={() => handleSourceChange("manual")}
                style={{
                  flex: 1,
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  border: recipientSource === "manual" ? "2px solid #4f46e5" : "1px solid #cbd5e1",
                  backgroundColor: recipientSource === "manual" ? "#e0e7ff" : "white",
                  color: recipientSource === "manual" ? "#4f46e5" : "#4b5563",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Enter Manually
              </button>
            </div>

            {recipientSource === "file" ? (
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
            ) : (
              <div className="manual-entry-wrapper">
                <textarea
                  className="form-textarea"
                  style={{ width: "100%", minHeight: "160px", resize: "vertical", fontFamily: "var(--font-sans)", fontSize: "0.9375rem" }}
                  placeholder="Enter recipient email addresses (separated by commas, spaces, or newlines)..."
                  value={manualEmailsText}
                  onChange={(e) => handleManualEmailsChange(e.target.value)}
                  required={emailList.length === 0}
                  disabled={scheduling}
                />
              </div>
            )}

             {emailList.length > 0 && (
              <>
                <div className="detected-badge">
                  <span className="dot-pulse"></span>
                  <strong>{emailList.length}</strong> email addresses detected
                </div>
                
                {/* Scrollable Recipient Emails Preview List */}
                <div className="email-preview-list" style={{
                  marginTop: "0.75rem",
                  padding: "0.75rem",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  maxHeight: "120px",
                  overflowY: "auto",
                  fontSize: "0.875rem",
                  color: "#334155"
                }}>
                  <div style={{ fontWeight: 600, marginBottom: "0.375rem", fontSize: "0.8125rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Detected Recipient Emails:
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                    {emailList.map((email, idx) => (
                      <span key={idx} style={{
                        backgroundColor: "#e0e7ff",
                        color: "#4f46e5",
                        padding: "0.125rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        border: "1px solid #c7d2fe"
                      }}>
                        {email}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
            {fileError && <p className="form-error-msg">{fileError}</p>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="start-time">Start Time</label>
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
