import React, { useState, useMemo } from "react";
import { useScanStore } from "../state/useScanStore";
import { createIssue } from "../lib/githubApi";
import { buildIssueBody } from "../lib/issueTemplate";
import "./CreateIssueModal.css";
import { ErrorBanner } from "./ErrorBanner";
import type { ScanError } from "../lib/types";

// Simple regex to check for GitHub PAT format
const GITHUB_PAT_REGEX = /^(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,255}$/;

interface CreateIssueModalProps {
  onClose: () => void;
}

export function CreateIssueModal({ onClose }: CreateIssueModalProps) {
  const [pat, setPat] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ScanError | null>(null); // <-- Use ScanError type
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);

  const { selectedRepo, scanResult } = useScanStore();

  const isTokenValid = useMemo(() => {
    if (!pat) return false;
    return GITHUB_PAT_REGEX.test(pat);
  }, [pat]);

  if (!selectedRepo || !scanResult || scanResult.findings.length === 0) {
    return null;
  }

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newToken = e.target.value;
    setPat(newToken);
    if (newToken.length > 0 && !GITHUB_PAT_REGEX.test(newToken)) {
      setTokenError(
        "Invalid format. Token must be at least 40 characters long and start with `ghp_`, `gho_`, etc."
      );
    } else {
      setTokenError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTokenValid) {
      setError({ message: "A valid Personal Access Token is required." });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const issueBody = buildIssueBody(scanResult.findings);
      const url = await createIssue(selectedRepo.fullName, issueBody, pat);
      setSuccessUrl(url);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : "Failed to create issue",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show success message
  if (successUrl) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h2 className="success-header">✅ Issue Created!</h2>
          <p>The maintainers have been notified.</p>

          <div className="success-actions">
            <a href={successUrl} target="_blank" rel="noopener noreferrer">
              View the issue on GitHub
            </a>
            <button onClick={onClose} className="close-btn-success">
              Close
            </button>
          </div>
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
            onChange={handleTokenChange}
            placeholder="ghp_..."
            className={`pat-input ${tokenError ? "invalid" : ""}`}
            aria-describedby="token-error"
          />
          {tokenError && (
            <div id="token-error" className="token-error-msg">
              {tokenError}
            </div>
          )}
          <button
            type="submit"
            disabled={isLoading || !isTokenValid}
            className="submit-btn"
          >
            {isLoading ? "Creating..." : "Create Issue"}
          </button>
          {error && <ErrorBanner error={error} />}
        </form>
      </div>
    </div>
  );
}
