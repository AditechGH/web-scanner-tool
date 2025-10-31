from pydantic import BaseModel, Field, ConfigDict
from typing import List, Literal, Optional

# --- Base Model ---
# Defines common configuration for all Pydantic models
# - populate_by_name=True allows us to use aliases in the
#   final JSON output (e.g., .model_dump(by_alias=True))
class APIModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

# --- API Request Models ---

class ScanRequest(APIModel):
    """
    The request body for the /api/scan endpoint.
    """
    owner: str
    repo: str
    token: Optional[str] = None  # Optional PAT to increase scan rate-limit

# --- API Response Models ---

class Finding(APIModel):
    """
    Represents a single potential secret found in a file.
    """
    file_path: str = Field(..., alias="filePath", description="The path to the file in the repo")
    line: int = Field(..., description="The line number where the secret was found")
    snippet: str = Field(..., description="The line of code containing the secret, with secret redacted")
    rule_id: Literal["regex", "entropy"] = Field(..., alias="ruleId", description="The type of rule that triggered this finding")
    confidence: Literal["low", "medium", "high"]

class ScanStats(APIModel):
    """
    Statistics about the completed scan.
    """
    files_scanned: int = Field(..., alias="filesScanned")
    files_skipped: int = Field(..., alias="filesSkipped", description="Files skipped (e.g., binaries, large files)")
    duration_ms: int = Field(..., alias="durationMs", description="Total scan duration in milliseconds")

class RateInfo(APIModel):
    """
    Represents the GitHub API rate limit status *after* the scan.
    """
    remaining: int = Field(..., description="API requests remaining in the current window")
    reset_at: int = Field(..., alias="resetAt", description="UTC timestamp of when the rate limit window resets")

class ScanResponse(APIModel):
    """
    The full response body for a successful /api/scan request.
    """
    stats: ScanStats
    findings: List[Finding]
    rate_limit: RateInfo = Field(..., alias="rateLimit")

# --- Internal Models ---

class GitHubFile(APIModel):
    """
    A lightweight internal model for a file from the GitHub tree.
    """
    path: str
    url: str  # This will be the blob URL
    sha: str
    size: Optional[int] = None # size is not always present in the recursive tree