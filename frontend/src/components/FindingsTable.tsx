import type { Finding } from "../lib/types";
import { ConfidenceBadge } from "./ConfidenceBadge";
import "./FindingsTable.css";

interface FindingsTableProps {
  findings: Finding[];
}

export function FindingsTable({ findings }: FindingsTableProps) {
  if (findings.length === 0) {
    return (
      <div className="no-findings">
        <h2>✅ No Secrets Found</h2>
        <p>This repository appears to be clean.</p>
      </div>
    );
  }

  return (
    <div className="findings-container">
      <h2>Found {findings.length} Potential Secrets</h2>
      <table className="findings-table">
        <thead>
          <tr>
            <th>Confidence</th>
            <th>File Path</th>
            <th>Line</th>
            <th>Snippet</th>
          </tr>
        </thead>
        <tbody>
          {findings.map((finding, index) => (
            <tr key={index}>
              <td>
                <ConfidenceBadge confidence={finding.confidence} />
              </td>
              <td className="cell-path">{finding.filePath}</td>
              <td className="cell-line">{finding.line}</td>
              <td className="cell-snippet">
                <code>{finding.snippet}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
