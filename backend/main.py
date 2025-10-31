import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Import our scanner, client, and models
from .models import ScanRequest, ScanResponse
from .scanner import RepoScanner
from .github_client import (
    GitHubClient,
    GitHubAPIError,
    RepositoryNotFoundError,
    RateLimitExceededError,
)

# --- Logging Setup ---
# Configure basic logging for the application
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)
logger.info("Starting Secret Hunter API...")

# --- FastAPI App Initialization ---
app = FastAPI(
    title="Public Repo Secret Hunter API",
    description="An API to scan public GitHub repositories for potential secrets.",
    version="0.1.0",
)

# Configure CORS (Cross-Origin Resource Sharing)
origins = [
    "http://localhost:5173",  # Vite dev
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Endpoints ---

@app.get("/api")
async def root():
    """
    Test endpoint to confirm the API is running.
    """
    return {"message": "Hello from the Secret Hunter API!"}

@app.post(
    "/api/scan",
    response_model=ScanResponse,
    response_model_exclude_none=True,  # optional
)
async def scan_repository(request: ScanRequest):
    """
    Main endpoint to scan a public GitHub repository.
    
    Takes an `owner` and `repo` and returns any findings.
    """
    logger.info(f"Received scan request for: {request.owner}/{request.repo}")
    # We must instantiate a new client for each request
    # to manage its own httpx session.
    client = GitHubClient(token=request.token)
    scanner = RepoScanner(client=client)

    try:
        scan_response = await scanner.scan(owner=request.owner, repo=request.repo)
        # Return the Pydantic model; FastAPI will serialize with aliases.
        return scan_response

    except RepositoryNotFoundError:
        logger.warning(f"Repo not found: {request.owner}/{request.repo}")
        raise HTTPException(status_code=404,
                            detail=f"Repository not found: {request.owner}/{request.repo}")

    except RateLimitExceededError as e:
        logger.warning(f"Rate limit exceeded for {request.owner}/{request.repo}: {e}")
        raise HTTPException(status_code=429,
                            detail=f"GitHub API rate limit exceeded. Please try again later. {e}")

    except GitHubAPIError as e:
        logger.error(f"GitHub upstream error for {request.owner}/{request.repo}: {e}")
        raise HTTPException(status_code=502, # Bad Gateway (error from upstream API)
                            detail=f"An error occurred while contacting GitHub: {e}")

    except Exception as e:
        # Catch-all for any other unexpected errors
        logger.critical(
            f"Unexpected error during scan of {request.owner}/{request.repo}: {e}",
            exc_info=True,
        )
        raise HTTPException(status_code=500,
                            detail=f"An internal server error occurred: {e}")

    finally:
        await client.close()
