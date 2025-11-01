import asyncio
import time
import logging
from typing import List

from .github_client import GitHubClient, GitHubAPIError
from .models import Finding, ScanResponse, ScanStats, GitHubFile
from . import detectors
from . import config

# Setup logger
logger = logging.getLogger(__name__)

class RepoScanner:
    """
    Orchestrates the scanning of a repository.
    
    This class ties together the GitHub client (for fetching data)
    and the detectors (for finding secrets).
    """

    def __init__(self, client: GitHubClient):
        self.client = client
        # Create a semaphore to limit concurrent requests
        # to the number specified in our config.
        self.semaphore = asyncio.Semaphore(config.MAX_CONCURRENT_REQUESTS)
    
    async def _fetch_and_scan_file(self, file: GitHubFile) -> List[Finding]:
        """
        A helper function to be run concurrently.
        It fetches a single file's content, scans it, and returns findings.
        """
        # Wait for a spot in the semaphore to become available
        async with self.semaphore:
            try:
                # 1. Fetch file content
                logger.debug(f"Fetching content for: {file.path}")
                content = await self.client.get_file_content(file.url)
                
                if not content:
                    return []
                
                # 2. Scan content
                findings = detectors.find_secrets(file_path=file.path, content=content)
                
                if findings:
                    logger.info(f"Found {len(findings)} potential secrets in: {file.path}")
                
                return findings

            except GitHubAPIError:
                # Re-raise API errors to be caught by asyncio.gather
                raise
            except Exception as e:
                # Log other errors but don't stop the whole scan
                logger.error(f"Failed to scan file {file.path}: {e}")
                return []

    async def scan(self, owner: str, repo: str) -> ScanResponse:
        """
        Performs a complete scan of the given repository.
        """
        start_time = time.monotonic()
        logger.info(f"Starting scan for {owner}/{repo}")
        
        all_findings: List[Finding] = []
        files_scanned = 0
        files_skipped = 0
        
        try:
            # 1. Get the full list of files from the repo
            all_files = await self.client.get_repo_tree(owner, repo)
        except GitHubAPIError as e:
            # If we can't get the tree, we can't scan.
            # This will be caught by main.py and turned into a 4xx/5xx.
            logger.error(f"Failed to get repo tree for {owner}/{repo}: {e}")
            raise e

        # 2. Filter files
        scannable_files: List[GitHubFile] = []
        for file in all_files:
            # We correctly pass file.size (Optional[int])
            if detectors.is_file_scannable(file.path, file.size):
                scannable_files.append(file)
            else:
                files_skipped += 1
        
        # 3. Apply the MAX_FILES_PER_SCAN cap
        if len(scannable_files) > config.MAX_FILES_PER_SCAN:
            logger.warning(
                f"Repo has {len(scannable_files)} scannable files. "
                f"Capping scan at {config.MAX_FILES_PER_SCAN}."
            )
            files_skipped += (len(scannable_files) - config.MAX_FILES_PER_SCAN)
            scannable_files = scannable_files[:config.MAX_FILES_PER_SCAN]
        
        files_scanned = len(scannable_files)
        logger.info(f"Scanning {files_scanned} files, skipping {files_skipped}...")

        # Fast-return if nothing to scan 
        if not scannable_files:
            logger.info("No scannable files found. Returning empty results.")
            end_time = time.monotonic()
            duration_ms = int((end_time - start_time) * 1000)
            
            scan_stats = ScanStats(
                files_scanned=files_scanned, # Will be 0
                files_skipped=files_skipped,
                duration_ms=duration_ms
            )
            
            return ScanResponse(
                stats=scan_stats,
                findings=[],
                rate_limit=self.client.rate_info
            )

        # 4. Create and run all scan tasks
        tasks = [self._fetch_and_scan_file(file) for file in scannable_files]

        try:
            results = await asyncio.gather(*tasks)
        except GitHubAPIError as e:
            # If any task fails with an API error, stop the scan
            # and re-raise the error to be caught by main.py
            logger.warning(f"Scan stopped due to API error: {e}")
            raise e
        
        # 5. Aggregate results
        for file_findings in results:
            all_findings.extend(file_findings)
            
        end_time = time.monotonic()
        duration_ms = int((end_time - start_time) * 1000)
        
        logger.info(f"Scan complete for {owner}/{repo} in {duration_ms}ms. Found {len(all_findings)} total secrets.")
        
        # 6. Assemble the final ScanResponse
        scan_stats = ScanStats(
            files_scanned=files_scanned,
            files_skipped=files_skipped,
            duration_ms=duration_ms
        )
        
        return ScanResponse(
            stats=scan_stats,
            findings=all_findings,
            rate_limit=self.client.rate_info
        )