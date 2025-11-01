import { useParams } from "react-router-dom";

function ScanPage() {
  // This hook grabs the :owner and :repo from the URL
  const { owner, repo } = useParams();

  return (
    <div>
      <h2>
        Scanning: {owner}/{repo}
      </h2>
      {/* We will build the ScanPanel component here */}
    </div>
  );
}

export default ScanPage;
