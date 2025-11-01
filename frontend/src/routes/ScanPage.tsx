import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useScanStore } from "../state/useScanStore";
import { ScanPanel } from "../components/ScanPanel";
import type { RepoLite } from "../lib/types";
import "./ScanPage.css";

function ScanPage() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();

  // Get state and actions from the store
  const selectedRepo = useScanStore((state) => state.selectedRepo);
  const selectRepo = useScanStore((state) => state.selectRepo);
  const clearScan = useScanStore((state) => state.clearScan);

  useEffect(() => {
    // This effect runs if the user lands directly on this URL
    // (e.g., from a bookmark) or refreshes the page.
    if (!selectedRepo && owner && repo) {
      const repoFromUrl: RepoLite = {
        owner,
        name: repo,
        fullName: `${owner}/${repo}`,
        stars: 0, // We don't have this info, but it's not critical here
        updatedAt: "",
      };
      // Set the repo in the store so the scan can start
      selectRepo(repoFromUrl);
    }

    // This return function is a "cleanup" effect
    // It runs when the component unmounts (e.g., user navigates away)
    return () => {
      // We don't want to clear the scan *results*
      // but if we were navigating back, we might clear the *repo*
    };
  }, [selectedRepo, owner, repo, selectRepo]);

  return (
    <div className="scan-page-container">
      <div className="back-link-container">
        {/* Link back to the search page */}
        <Link to="/" onClick={clearScan}>
          &larr; Back to Search
        </Link>
      </div>

      <h2>
        Scan Results for: {owner}/{repo}
      </h2>

      {/* The ScanPanel handles all the logic */}
      <ScanPanel />
    </div>
  );
}

export default ScanPage;
