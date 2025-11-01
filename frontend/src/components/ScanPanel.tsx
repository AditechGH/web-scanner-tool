import { useEffect, useState } from "react";
import { useScanStore } from "../state/useScanStore";
import { ErrorBanner } from "./ErrorBanner";
import { FindingsTable } from "./FindingsTable";
import { CreateIssueModal } from "./CreateIssueModal";
import { RateLimitPanel } from "./RateLimitPanel";
import "./ScanPanel.css";

export function ScanPanel() {
  // Get all the state and actions we need from our store
  const { status, error, scanResult, startScan } = useScanStore();
  // State to manage if the modal is open
  const [isModalOpen, setIsModalOpen] = useState(false);

  // This useEffect will run when the component loads.
  // It checks if a scan is 'idle' (meaning it hasn't run yet)
  // and then triggers it.
  useEffect(() => {
    if (status === "idle") {
      startScan(); // Start the initial scan (unauthenticated)
    }
  }, [status, startScan]);

  // 1. Show Loading State
  if (status === "loading" || status === "idle") {
    return (
      <div className="scan-panel loading">
        <div className="spinner"></div>
        <h2>Scanning repository...</h2>
        <p>This may take a few moments. Please wait.</p>
      </div>
    );
  }

  // 2. Show Error State
  if (status === "error" && error) {
    // Check for 429 status
    if (error.status === 429) {
      return (
        <div className="scan-panel">
          <RateLimitPanel error={error} />
        </div>
      );
    }
    // Otherwise, show the normal error
    return (
      <div className="scan-panel">
        <ErrorBanner error={error} />
      </div>
    );
  }

  // 3. Show Success State
  if (status === "success" && scanResult) {
    const hasFindings = scanResult.findings.length > 0;

    return (
      <div className="scan-panel">
        {/* Only show the button if secrets were found */}
        {hasFindings && (
          <div className="report-header">
            <button
              className="report-button"
              onClick={() => setIsModalOpen(true)}
            >
              Report Findings to Maintainers
            </button>
          </div>
        )}

        <FindingsTable findings={scanResult.findings} />

        {/* Render the modal if it's open */}
        {isModalOpen && (
          <CreateIssueModal onClose={() => setIsModalOpen(false)} />
        )}
      </div>
    );
  }

  return null; // Should not be reachable
}
