import React from "react";

interface TabsProps {
  activeTab: "scheduled" | "sent";
  setActiveTab: (tab: "scheduled" | "sent") => void;
  scheduledCount: number;
  sentCount: number;
}

export const Tabs: React.FC<TabsProps> = ({
  activeTab,
  setActiveTab,
  scheduledCount,
  sentCount,
}) => {
  return (
    <div className="segmented-tabs-container">
      <div className="segmented-tabs-track">
        <button
          className={`segmented-tab-btn ${activeTab === "scheduled" ? "active" : ""}`}
          onClick={() => setActiveTab("scheduled")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            width="16"
            height="16"
            className="tab-icon"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="tab-label-text">Scheduled Emails</span>
          <span className="segmented-tab-badge">{scheduledCount}</span>
        </button>

        <button
          className={`segmented-tab-btn ${activeTab === "sent" ? "active" : ""}`}
          onClick={() => setActiveTab("sent")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            width="16"
            height="16"
            className="tab-icon"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="tab-label-text">Sent Emails</span>
          <span className="segmented-tab-badge">{sentCount}</span>
        </button>
      </div>
    </div>
  );
};
