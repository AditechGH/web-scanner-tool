import React, { useState } from "react";
import { useScanStore } from "../state/useScanStore";
import { createIssue } from "../lib/githubApi";
import { buildIssueBody } from "../lib/issueTemplate";
import "./CreateIssueModal.css";
import { ErrorBanner } from "./ErrorBanner";

interface CreateIssueModalProps {
  onClose: () => void;
}

export function CreateIssueModal({ onClose }: CreateIssueModalProps) {
  const [pat, setPat] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);

  const { selectedRepo, scanResult } = useScanStore();

  if (!selectedRepo || !scanResult || scanResult.findings.length === 0) {
    return null; // Should not be rendered if there are no findings
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pat) {
      setError("A Personal Access Token is required.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const issueBody = buildIssueBody(scanResult.findings);
      const url = await createIssue(selectedRepo.fullName, issueBody, pat);
      setSuccessUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create issue");
    } finally {
      setIsLoading(false);
    }
  };

  // Show success message
  if (successUrl) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h2 style={{ color: "#6ee66e" }}>✅ Issue Created!</h2>
          <p>The maintainers have been notified.</p>
          <a href={successUrl} target="_blank" rel="noopener noreferrer">
            View the issue on GitHub
          </a>
          <button onClick={onClose} style={{ marginTop: "1rem" }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  // Show the form
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>
          &times;
        </button>
        <h2>Report Findings to Maintainers</h2>
        <p>
          This will create a public issue on the{" "}
          <strong>{selectedRepo.fullName}</strong> repository.
        </p>
        <p className="pat-warning">
          A GitHub Personal Access Token (PAT) with `public_repo` scope is
          required. This token is **not** stored and is used only for this
          single request.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="pat">GitHub Personal Access Token:</label>
          <input
            id="pat"
            type="password"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            placeholder="ghp_..."
            className="pat-input"
          />
          <button type="submit" disabled={isLoading} className="submit-btn">
            {isLoading ? "Creating..." : "Create Issue"}
          </button>
          {error && <ErrorBanner message={error} />}
        </form>
      </div>
    </div>
  );
}
