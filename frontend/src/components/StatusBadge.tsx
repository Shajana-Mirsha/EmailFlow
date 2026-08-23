import React from "react";

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const normStatus = status.toLowerCase();

  let label = status;
  let className = "badge-scheduled";
  let icon: React.ReactNode = null;

  switch (normStatus) {
    case "scheduled":
      label = "Scheduled";
      className = "badge-scheduled";
      icon = (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12" style={{ marginRight: "0.375rem" }}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
      break;
    case "delayed":
      label = "Delayed";
      className = "badge-delayed";
      icon = (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12" style={{ marginRight: "0.375rem" }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
      break;
    case "cancelled":
      label = "Cancelled";
      className = "badge-cancelled";
      icon = (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12" style={{ marginRight: "0.375rem" }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
      break;
    case "sent":
      label = "Sent";
      className = "badge-sent";
      icon = (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="12" height="12" style={{ marginRight: "0.375rem" }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
      break;
    case "failed":
      label = "Failed";
      className = "badge-failed";
      icon = (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12" style={{ marginRight: "0.375rem" }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
      break;
    default:
      label = status.charAt(0).toUpperCase() + status.slice(1);
      className = "badge-default";
  }

  return (
    <span className={`badge ${className}`} style={{ display: "inline-flex", alignItems: "center" }}>
      {icon}
      {label}
    </span>
  );
};
