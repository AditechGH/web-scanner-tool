import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useScanStore } from "../state/useScanStore";
import { searchRepos } from "../lib/githubApi";
import type { RepoLite } from "../lib/types";
import "./RepoSearch.css";

export function RepoSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RepoLite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get the 'selectRepo' action from our store
  const selectRepo = useScanStore((state) => state.selectRepo);
  const navigate = useNavigate();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setIsLoading(true);
    setError(null);
    setResults([]);
    setHasSearched(true);

    try {
      const data = await searchRepos(query);
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRepo = (repo: RepoLite) => {
    // 1. Set the repo in our global store
    selectRepo(repo);
    // 2. Navigate to the scan page for that repo
    navigate(`/scan/${repo.owner}/${repo.name}`);
  };

  const clearQuery = () => {
    setQuery("");
    setResults([]);
    setError(null);
    setHasSearched(false);
    inputRef.current?.focus(); // Re-focus the input
  };

  return (
    <div className="repo-search-container">
      <form onSubmit={handleSearch} className="search-form">
        <div className="input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a public repository (e.g., 'stripe-react')"
          />
          {query.length > 0 && (
            <button
              type="button"
              className="clear-btn"
              onClick={clearQuery}
              title="Clear search"
            >
              &times;
            </button>
          )}
        </div>
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <div className="error-banner">{error}</div>}

      <div className="search-results">
        {/* <-- NEW: Empty results message --> */}
        {hasSearched && !isLoading && !error && results.length === 0 && (
          <div className="no-results">
            <p>No repositories found for your query.</p>
          </div>
        )}

        {results.length > 0 && (
          <ul className="results-list">
            {results.map((repo) => (
              <li
                key={repo.fullName}
                onClick={() => handleSelectRepo(repo)}
                className="result-item"
              >
                <strong>{repo.fullName}</strong>
                <span>⭐ {repo.stars}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
