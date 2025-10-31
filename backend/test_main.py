import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock

# Import our app and the exceptions it needs to handle
from .main import app
from .models import ScanResponse, ScanStats, Finding, RateInfo
from .github_client import RepositoryNotFoundError, RateLimitExceededError, GitHubAPIError

# Create a TestClient instance
client = TestClient(app)

# --- Test Data ---
# A mock scan response that our patched scanner will return
MOCK_FINDING = Finding(
    filePath="keys.js",
    line=1,
    snippet="key = '...'",
    ruleId="regex",
    confidence="high"
)
MOCK_RATE_INFO = RateInfo(remaining=1000, resetAt=1234567890)
MOCK_STATS = ScanStats(filesScanned=1, filesSkipped=0, durationMs=100)
MOCK_SCAN_RESPONSE = ScanResponse(
    stats=MOCK_STATS,
    findings=[MOCK_FINDING],
    rate_limit=MOCK_RATE_INFO
)
MOCK_REPO_PAYLOAD = {"owner": "test-owner", "repo": "test-repo"}

# --- Tests ---

def test_root_endpoint():
    """Test the root /api endpoint."""
    response = client.get("/api")
    assert response.status_code == 200
    assert response.json() == {"message": "Hello from the Secret Hunter API!"}

@patch("backend.main.RepoScanner", autospec=True)
def test_scan_repository_success(MockRepoScanner):
    """Test the /api/scan endpoint on a successful scan."""
    # Configure the mock scanner to return our mock response
    mock_scanner_instance = MockRepoScanner.return_value
    mock_scanner_instance.scan = AsyncMock(return_value=MOCK_SCAN_RESPONSE)

    # Make the API call
    response = client.post("/api/scan", json=MOCK_REPO_PAYLOAD)

    # Assert the response is correct
    assert response.status_code == 200
    # Check that the JSON response uses the camelCase aliases
    assert response.json()["stats"]["filesScanned"] == 1
    assert response.json()["findings"][0]["filePath"] == "keys.js"
    assert response.json()["rateLimit"]["resetAt"] == 1234567890
    
    # Assert our scanner was called correctly
    mock_scanner_instance.scan.assert_called_once_with(
        owner="test-owner", repo="test-repo"
    )

@patch("backend.main.RepoScanner", autospec=True)
def test_scan_repository_not_found(MockRepoScanner):
    """Test the /api/scan endpoint when the repo is not found (404)."""
    # Configure the mock scanner to raise a 404 error
    mock_scanner_instance = MockRepoScanner.return_value
    mock_scanner_instance.scan = AsyncMock(side_effect=RepositoryNotFoundError("Repo not found"))

    # Make the API call
    response = client.post("/api/scan", json=MOCK_REPO_PAYLOAD)

    # Assert we get a 404
    assert response.status_code == 404
    assert "Repository not found" in response.json()["detail"]

@patch("backend.main.RepoScanner", autospec=True)
def test_scan_repository_rate_limited(MockRepoScanner):
    """Test the /api/scan endpoint when the rate limit is exceeded (429)."""
    # Configure the mock scanner to raise a 429 error
    mock_scanner_instance = MockRepoScanner.return_value
    mock_scanner_instance.scan = AsyncMock(side_effect=RateLimitExceededError("Rate limit hit"))

    # Make the API call
    response = client.post("/api/scan", json=MOCK_REPO_PAYLOAD)

    # Assert we get a 429
    assert response.status_code == 429
    assert "rate limit exceeded" in response.json()["detail"]

@patch("backend.main.RepoScanner", autospec=True)
def test_scan_repository_github_api_error(MockRepoScanner):
    """Test the /api/scan endpoint when GitHub returns a generic error (502)."""
    # Configure the mock scanner to raise a generic API error
    mock_scanner_instance = MockRepoScanner.return_value
    mock_scanner_instance.scan = AsyncMock(side_effect=GitHubAPIError("GitHub is down"))

    # Make the API call
    response = client.post("/api/scan", json=MOCK_REPO_PAYLOAD)

    # Assert we get a 502 (Bad Gateway)
    assert response.status_code == 502
    assert "contacting GitHub" in response.json()["detail"]

@patch("backend.main.RepoScanner", autospec=True)
def test_scan_repository_internal_error(MockRepoScanner):
    """Test the /api/scan endpoint for an unexpected server error (500)."""
    # Configure the mock scanner to raise a generic Python exception
    mock_scanner_instance = MockRepoScanner.return_value
    mock_scanner_instance.scan = AsyncMock(side_effect=Exception("Something broke"))

    # Make the API call
    response = client.post("/api/scan", json=MOCK_REPO_PAYLOAD)

    # Assert we get a 500
    assert response.status_code == 500
    assert "internal server error" in response.json()["detail"]