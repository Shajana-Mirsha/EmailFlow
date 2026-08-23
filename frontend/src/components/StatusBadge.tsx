import React from "react";

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const normStatus = status.toLowerCase();

  let label = status;
  let className = "badge-scheduled";

  switch (normStatus) {
    case "scheduled":
      label = "Scheduled";
      className = "badge-scheduled";
      break;
    case "delayed":
      label = "Delayed";
      className = "badge-delayed";
      break;
    case "cancelled":
      label = "Cancelled";
      className = "badge-cancelled";
      break;
    case "sent":
      label = "Sent";
      className = "badge-sent";
      break;
    case "failed":
      label = "Failed";
      className = "badge-failed";
      break;
    default:
      label = status.charAt(0).toUpperCase() + status.slice(1);
      className = "badge-default";
  }

  return <span className={`badge ${className}`}>{label}</span>;
};
