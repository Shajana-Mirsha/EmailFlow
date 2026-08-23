import React from "react";
import type { User } from "../types/email";

interface HeaderProps {
  user: User;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="header-container">
      <div className="header-brand">
        <div className="logo-icon">
          <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 4l-7 4.5L5 7V5l7 4.5L19 5v2z" />
          </svg>
        </div>
        <span className="logo-text">EmailFlow</span>
      </div>

      <div className="header-user-nav">
        <div className="user-profile-menu">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="user-avatar" />
          ) : (
            <div className="user-avatar-fallback">
              {user.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
          )}
          <div className="user-text-info">
            <span className="user-name">{user.name}</span>
            <span className="user-email">{user.email}</span>
          </div>
        </div>

        <button className="btn btn-logout" onClick={onLogout}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            width="14"
            height="14"
            className="logout-svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Logout
        </button>
      </div>
    </header>
  );
};
