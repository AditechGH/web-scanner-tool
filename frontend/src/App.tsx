import { Routes, Route } from "react-router-dom";
import SearchPage from "./routes/SearchPage";
import ScanPage from "./routes/ScanPage";
import "./index.css";

function App() {
  return (
    <div className="app-container">
      <h1>Public Repo Secret Hunter</h1>

      <Routes>
        <Route path="/" element={<SearchPage />} />
        {/* We'll use a dynamic route for the scan page */}
        <Route path="/scan/:owner/:repo" element={<ScanPage />} />
        {/* We can add a simple 404 route later if we want */}
      </Routes>
    </div>
  );
}

export default App;
