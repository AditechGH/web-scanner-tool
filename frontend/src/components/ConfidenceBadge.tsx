import type { Confidence } from "../lib/types";
import "./ConfidenceBadge.css";

interface ConfidenceBadgeProps {
  confidence: Confidence;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  // Use the confidence level as a class name for styling
  const confidenceClass = `badge-${confidence}`;

  return <span className={`badge ${confidenceClass}`}>{confidence}</span>;
}
