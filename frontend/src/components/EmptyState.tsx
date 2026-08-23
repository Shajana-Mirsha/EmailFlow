import React from "react";

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = "No data found",
  message = "Get started by composing a new email.",
  icon,
}) => {
  return (
    <div className="empty-state-container">
      <div className="empty-state-illustration-box">
        {icon || (
          <svg viewBox="0 0 320 180" fill="none" width="280" height="150" className="empty-state-svg">
            {/* Dotted curve representing journey route */}
            <path
              d="M30,120 Q120,40 210,100 T290,60"
              stroke="#cbd5e1"
              strokeWidth="2"
              strokeDasharray="6 6"
            />
            
            {/* Mailbox / Hub outline in center */}
            <g transform="translate(140, 60)">
              <rect x="0" y="0" width="40" height="40" rx="8" fill="none" stroke="#94a3b8" strokeWidth="2.5" />
              {/* Mail slot */}
              <rect x="8" y="10" width="24" height="6" rx="1" fill="#cbd5e1" />
              {/* Inbox tray lines */}
              <line x1="12" y1="26" x2="28" y2="26" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
            </g>

            {/* Tiny envelope floating along route */}
            <g transform="translate(68, 62) rotate(-15)" opacity="0.6">
              <rect width="24" height="16" rx="2" fill="#fbcfe8" stroke="#f472b6" strokeWidth="1.5" />
              <path d="M0,0 L12,8 L24,0" stroke="#f472b6" strokeWidth="1.5" fill="none" />
            </g>

            {/* Clock icon representing scheduling */}
            <g transform="translate(245, 68)" opacity="0.6">
              <circle cx="10" cy="10" r="9" stroke="#93c5fd" strokeWidth="1.5" />
              <path d="M10,5 L10,10 L14,10" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          </svg>
        )}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-message">{message}</p>
    </div>
  );
};
