import React from "react";

interface LoadingStateProps {
  message?: string;
  type?: "table" | "spinner";
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Loading...",
  type = "table",
}) => {
  if (type === "spinner") {
    return (
      <div className="loading-state-container">
        <div className="loading-spinner"></div>
        <p className="loading-message">{message}</p>
      </div>
    );
  }

  return (
    <div className="skeleton-table-container">
      <div className="skeleton-table-header">
        <div className="skeleton-header-cell" style={{ width: "25%" }}></div>
        <div className="skeleton-header-cell" style={{ width: "30%" }}></div>
        <div className="skeleton-header-cell" style={{ width: "25%" }}></div>
        <div className="skeleton-header-cell" style={{ width: "10%" }}></div>
        <div className="skeleton-header-cell" style={{ width: "10%" }}></div>
      </div>

      <div className="skeleton-table-body">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="skeleton-table-row">
            {/* Recipient Cell */}
            <div className="skeleton-cell" style={{ width: "25%" }}>
              <div className="skeleton-recipient-group">
                <div className="skeleton-avatar"></div>
                <div className="skeleton-line" style={{ width: "75%" }}></div>
              </div>
            </div>

            {/* Campaign Cell */}
            <div className="skeleton-cell" style={{ width: "30%" }}>
              <div className="skeleton-campaign-group">
                <div className="skeleton-line" style={{ width: "85%", height: "14px" }}></div>
                <div className="skeleton-line" style={{ width: "55%", height: "10px", marginTop: "8px" }}></div>
              </div>
            </div>

            {/* Timing Cell */}
            <div className="skeleton-cell" style={{ width: "25%" }}>
              <div className="skeleton-timing-group">
                <div className="skeleton-line" style={{ width: "80%" }}></div>
                <div className="skeleton-line" style={{ width: "45%", marginTop: "8px" }}></div>
              </div>
            </div>

            {/* Status Cell */}
            <div className="skeleton-cell" style={{ width: "10%" }}>
              <div className="skeleton-badge"></div>
            </div>

            {/* Actions Cell */}
            <div className="skeleton-cell" style={{ width: "10%", display: "flex", justifyContent: "flex-end" }}>
              <div className="skeleton-btn"></div>
            </div>
          </div>
        ))}
      </div>
      <p className="skeleton-sr-message">{message}</p>
    </div>
  );
};
