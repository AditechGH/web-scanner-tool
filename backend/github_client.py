import httpx
import asyncio
import time
import base64
import logging
import binascii
from typing import List, Dict, Any, Optional

from .models import RateInfo, GitHubFile
from . import config

# --- Custom Exceptions ---
class GitHubAPIError(Exception):
    """Base exception for all GitHub API client errors."""
    pass

class RepositoryNotFoundError(GitHubAPIError):
    """Raised when a repository (or its default branch) is not found (404)."""
    pass

class RateLimitExceededError(GitHubAPIError):
    """Raised when we hit a rate limit that we can't recover from (403)."""
    pass

# Setup logger
logger = logging.getLogger(__name__)


class GitHubClient:
    """
    An async client for interacting with the GitHub API.
    
    Handles rate-limit-aware requests, authentication,
    and response parsing.
    """
    
    BASE_URL = "https://api.github.com"

    def __init__(self, token: Optional[str] = None):
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "web-scanner-tool/0.1.0"
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        # Use a more specific timeout
        self._client = httpx.AsyncClient(
            headers=headers, 
            timeout=httpx.Timeout(30.0, connect=10.0)
        )
        
        self._rate_info = RateInfo(
            remaining=5000, 
            reset_at=int(time.time()) + 3600
        )

    async def close(self):
        """Gracefully closes the httpx client."""
        await self._client.aclose()

    @property
    def rate_info(self) -> RateInfo:
        """Public property to get the current rate limit info."""
        return self._rate_info

    async def _make_request(self, method: str, url: str) -> httpx.Response:
        """
        A private, rate-limit-aware and resilient request helper.
        """

        full_url = url if url.startswith("https://") else f"{self.BASE_URL}{url}"
        
        backoff = 0.5
        for attempt in range(4):
            try:
                response = await self._client.request(method, full_url)
            except httpx.RequestError as e:
                if attempt == 3:
                    logger.error(f"HTTPX request error (final): {e}")
                    raise GitHubAPIError(f"HTTP request failed: {e}")
                
                logger.debug(f"Retrying {method} {full_url} (attempt {attempt+1}) after {backoff}s")
                await asyncio.sleep(backoff)
                continue

            if "X-RateLimit-Remaining" in response.headers and "X-RateLimit-Reset" in response.headers:
                try:
                    self._rate_info = RateInfo(
                        remaining=int(response.headers["X-RateLimit-Remaining"]),
                        reset_at=int(response.headers["X-RateLimit-Reset"]),
                    )
                except ValueError:
                    pass 

            if response.status_code in (403, 429):
                retry_after_str = response.headers.get("Retry-After")
                if retry_after_str:
                    try:
                        wait = int(retry_after_str)
                        logger.warning(f"{response.status_code} received. Sleeping {wait}s per Retry-After. Retrying...")
                        await asyncio.sleep(wait)
                        continue
                    except ValueError:
                        pass
                
                if self._rate_info.remaining == 0:
                    raise RateLimitExceededError("GitHub API rate limit exceeded.")
                
                if attempt < 3:
                    logger.debug(f"Retrying {method} {full_url} (attempt {attempt+1}) after {backoff}s")
                    await asyncio.sleep(backoff)
                    backoff *= 2
                    continue
                
                raise GitHubAPIError(f"Forbidden: Check permissions. {full_url}")

            if 500 <= response.status_code < 600 and attempt < 3:
                logger.debug(f"Retrying {method} {full_url} (attempt {attempt+1}) after {backoff}s")
                await asyncio.sleep(backoff)
                backoff *= 2
                continue

            if response.status_code == 404:
                raise RepositoryNotFoundError(f"Resource not found: {full_url}")

            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                raise GitHubAPIError(f"GitHub error {response.status_code}: {e.response.text[:200]}")
            
            return response

        raise GitHubAPIError("Max retries exceeded for request.")


    async def get_repo_tree(self, owner: str, repo: str) -> List[GitHubFile]:
        """
        Fetches the complete recursive file tree for the repo's default branch.
        Uses the correct tree_sha for robustness.
        """
        try:
            repo_info_res = await self._make_request("GET", f"/repos/{owner}/{repo}")
            repo_info = repo_info_res.json()
            default_branch = repo_info.get("default_branch")
            if not default_branch:
                raise GitHubAPIError(f"Could not determine default branch for {owner}/{repo}")
        except RepositoryNotFoundError:
            raise RepositoryNotFoundError(f"Repository {owner}/{repo} not found.")

        try:
            branch_res = await self._make_request("GET", f"/repos/{owner}/{repo}/branches/{default_branch}")
            branch_data = branch_res.json()
            tree_sha = branch_data["commit"]["commit"]["tree"]["sha"]
        except KeyError:
            raise GitHubAPIError(f"Could not find tree SHA for branch {default_branch}")
        except Exception as e:
             raise GitHubAPIError(f"Error getting branch info: {e}")

        tree_res = await self._make_request(
            "GET", 
            f"/repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=1"
        )
        tree_data = tree_res.json()

        if tree_data.get("truncated", False):
            logger.warning(f"Repo {owner}/{repo} tree is truncated. Not all files may be scanned.")
        
        files: List[GitHubFile] = []
        for item in tree_data.get("tree", []):
            if item.get("type") == "blob":
                files.append(
                    GitHubFile(
                        path=item.get("path"),
                        url=item.get("url"),
                        sha=item.get("sha"),
                        size=item.get("size")
                    )
                )
        return files

    async def get_file_content(self, blob_url: str) -> str:
        """
        Fetches the content of a single file (blob) given its API URL.
        
        The content is returned as a decoded UTF-8 string, with
        defensive decoding.
        """
        try:
            response = await self._make_request("GET", blob_url)
            blob_data = response.json()
            
            content_b64 = blob_data.get("content")
            encoding = blob_data.get("encoding", "")
            
            if not content_b64 or encoding != "base64":
                return "" 

            # Use the suggested b64decode fallback order
            try:
                decoded_bytes = base64.b64decode(content_b64.encode('utf-8'), validate=False)
            except binascii.Error:
                # Fallback to plain (also validate=False, but good to have)
                decoded_bytes = base64.b64decode(content_b64.encode('utf-8'))
            
            return decoded_bytes.decode("utf-8", errors="replace")
        
        except RateLimitExceededError:
            # Bubble up so the scanner can stop early and return 429
            raise
        except (UnicodeDecodeError, binascii.Error):
            logger.warning(f"Binary or non-UTF content at {blob_url}, skipping.")
            return ""
        except Exception as e:
            logger.error(f"Failed to get or decode blob {blob_url}: {e}")
            return ""