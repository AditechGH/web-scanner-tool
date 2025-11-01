// --- GitHub API Types ---
export interface GitHubRepo {
  full_name: string;
  owner: { login: string };
  name: string;
  stargazers_count: number;
  updated_at: string;
  description: string;
}

// Our internal, simplified repo object
export interface RepoLite {
  owner: string;
  name: string;
  fullName: string; // "owner/name"
  stars: number;
  updatedAt: string; // ISO
}

// --- Backend API Types ---
export type Confidence = "low" | "medium" | "high";

export interface Finding {
  filePath: string;
  line: number;
  snippet: string; // Redacted by backend
  ruleId: "regex" | "entropy";
  confidence: Confidence;
}

export interface ScanStats {
  filesScanned: number;
  filesSkipped: number;
  durationMs: number;
}

export interface RateInfo {
  remaining: number;
  resetAt: number; // epoch seconds
}

export interface ScanResponse {
  stats: ScanStats;
  findings: Finding[];
  rateLimit: RateInfo;
}

// --- State Management Types ---
export type ScanStatus = "idle" | "loading" | "success" | "error";

export interface ScanError {
  message: string;
  status?: number; // 404, 429, etc.
  resetAt?: number;
}
