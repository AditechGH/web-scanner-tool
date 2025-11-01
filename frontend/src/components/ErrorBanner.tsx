import type { ScanError } from "../lib/types";
import "./ErrorBanner.css";

interface ErrorBannerProps {
  error: ScanError;
}

export function ErrorBanner({ error }: ErrorBannerProps) {
  return (
    <div className="error-banner">
      <strong>Error:</strong> {error.message}
    </div>
  );
}
