import { RepoSearch } from "../components/RepoSearch";
import "../components/RepoSearch.css";

function SearchPage() {
  return (
    <div>
      <p>Search public GitHub repositories for exposed secrets.</p>
      <RepoSearch />
    </div>
  );
}

export default SearchPage;
