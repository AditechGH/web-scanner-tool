import { useState, useEffect, useMemo } from "react";
import type { ScanError } from "../lib/types";
import { useScanStore } from "../state/useScanStore";
import "./RateLimitPanel.css";

function formatTimeRemaining(resetAt: number): string {
  const now = Date.now() / 1000;
  const remainingSeconds = Math.max(0, Math.ceil(resetAt - now));
  if (remainingSeconds === 0) return "now. Please refresh.";
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  if (minutes > 0) return `in ${minutes}m ${seconds}s.`;
  return `in ${seconds}s.`;
}

// Simple regex to check for GitHub PAT format
const GITHUB_PAT_REGEX = /^(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,255}$/;

interface RateLimitPanelProps {
  error: ScanError;
}

export function RateLimitPanel({ error }: RateLimitPanelProps) {
  const [token, setToken] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const startScan = useScanStore((state) => state.startScan);

  const isTokenValid = useMemo(() => {
    if (!token) return false;
    return GITHUB_PAT_REGEX.test(token);
  }, [token]);

  const [timeRemaining, setTimeRemaining] = useState(() =>
    typeof error.resetAt === "number" ? formatTimeRemaining(error.resetAt) : ""
  );

  useEffect(() => {
    if (typeof error.resetAt === "number") {
      const resetAt = error.resetAt;

      const interval = setInterval(() => {
        const remaining = formatTimeRemaining(resetAt);
        setTimeRemaining(remaining);
        if (remaining.startsWith("now")) {
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [error.resetAt]);

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newToken = e.target.value;
    setToken(newToken);
    // Provide instant feedback if the token format is wrong
    if (newToken.length > 0 && !GITHUB_PAT_REGEX.test(newToken)) {
      setTokenError("Invalid token format. Must start with ghp_, gho_, etc.");
    } else {
      setTokenError(null);
    }
  };

  const handleRetry = () => {
    if (!isTokenValid) {
      setTokenError("A valid GitHub token is required.");
      return;
    }
    setTokenError(null);
    startScan(token); // Retry the scan with the valid token
  };

  return (
    <div className="rate-limit-panel">
      <h3>Rate Limit Exceeded</h3>
      <p>
        You've hit the GitHub API rate limit for unauthenticated requests
        (60/hour).
      </p>

      <div className="option-box">
        <h4>Option 1: Wait for Reset</h4>
        <p>Your limit will reset {timeRemaining}</p>
      </div>

      <div className="option-box">
        <h4>Option 2: Add a Token</h4>
        <p>
          Provide a GitHub PAT to increase your limit to 5,000 requests/hour.
        </p>
        <div className="token-form">
          <input
            type="password"
            value={token}
            onChange={handleTokenChange}
            placeholder="ghp_..."
            className={`pat-input ${tokenError ? "invalid" : ""}`}
            aria-describedby="token-error"
          />
          {/* --- FIX: Show validation error --- */}
          {tokenError && (
            <div id="token-error" className="token-error-msg">
              {tokenError}
            </div>
          )}
          <button
            onClick={handleRetry}
            disabled={!isTokenValid} // <-- Use new validity check
            className="submit-btn"
          >
            Retry Scan with Token
          </button>
        </div>
      </div>
    </div>
  );
}
