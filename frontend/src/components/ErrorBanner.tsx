import { useState, useEffect } from "react";
import type { ScanError } from "../lib/types";
import "./ErrorBanner.css";

interface ErrorBannerProps {
  error: ScanError;
}

// Helper function to format time
function formatTimeRemaining(resetAt: number): string {
  const now = Date.now() / 1000; // Convert now to seconds
  const remainingSeconds = Math.max(0, Math.ceil(resetAt - now));

  if (remainingSeconds === 0) {
    return "now. Please refresh and try again.";
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  if (minutes > 0) {
    return `in ${minutes} minute(s) and ${seconds} second(s).`;
  }
  return `in ${seconds} second(s).`;
}

export function ErrorBanner({ error }: ErrorBannerProps) {
  const [timeRemaining, setTimeRemaining] = useState(() =>
    typeof error.resetAt === "number" ? formatTimeRemaining(error.resetAt) : ""
  );

  // This effect creates a countdown timer
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
  }, [error.resetAt]); // Dependency is correct

  return (
    <div className="error-banner">
      <strong>Error:</strong> {error.message}
      {error.resetAt && (
        <p style={{ marginTop: "0.5rem", marginBottom: 0 }}>
          Please try again {timeRemaining}
        </p>
      )}
    </div>
  );
}
