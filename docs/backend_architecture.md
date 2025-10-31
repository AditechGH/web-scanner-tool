# Backend Architecture

> Internal reference for maintainers and reviewers.  
> This document details the modular structure and interaction between backend components,
> built to be testable, maintainable, and resilient.

## 1. Design Philosophy

The architecture follows a clear **Separation of Concerns (SoC)**, dividing responsibilities into distinct layers:

1. **Web Layer (`main.py`):** Handles HTTP requests, responses, and top-level error handling. It knows *nothing* about how to scan.
2. **Orchestration Layer (`scanner.py`):** Coordinates the scan. It knows *what* to do (get tree, fetch files, run detectors) but not *how* to do it.
3. **Service Layer (`github_client.py`):** Manages all external communication with the GitHub API. It handles auth, rate-limiting, and data fetching.
4. **Business Logic Layer (`detectors.py`):** Contains the core "secret sauce." This module is pure Python and knows nothing about GitHub or the web.
5. **Data Layer (`models.py`):** Defines the data contracts (Pydantic models) used for API requests and responses.
6. **Configuration (`config.py`):** Centralizes tunable parameters like file sizes and concurrency limits.

## 2. Class & Module Diagram (Mermaid)

This diagram shows how the different modules interact.

```mermaid
classDiagram
    direction LR

    class main {
        +FastAPI app
        +POST /api/scan(ScanRequest) ScanResponse
    }

    class scanner.RepoScanner {
        -client: GitHubClient
        -semaphore: asyncio.Semaphore
        +scan(owner, repo) ScanResponse
        -_fetch_and_scan_file(blob_url) list[Finding]
    }

    class github_client.GitHubClient {
        -client: httpx.AsyncClient
        -rate_info: RateInfo
        +get_repo_tree(owner, repo) list[GitHubFile]
        +get_file_content(blob_url) str
        +close()
        -_make_request(url)
    }

    class detectors {
        <<module>>
        +SECRET_PATTERNS
        +FILE_EXT_DENYLIST
        +is_file_scannable(path, size) bool
        +find_secrets(content) list[Finding]
        -_calculate_entropy(text) float
    }

    class models {
        <<module>>
        +ScanRequest
        +ScanResponse
        +Finding
        +ScanStats
        +RateInfo
        +GitHubFile
    }

    class config {
        <<module>>
        +MAX_FILE_SIZE
        +MAX_CONCURRENT_REQUESTS
    }

    main ..> scanner.RepoScanner : uses
    main ..> models.ScanRequest : validates
    main ..> models.ScanResponse : returns
    scanner.RepoScanner ..> github_client.GitHubClient : uses
    scanner.RepoScanner ..> detectors : uses
    scanner.RepoScanner ..> config : uses
    scanner.RepoScanner ..> models.Finding : creates
    github_client.GitHubClient ..> models.GitHubFile : creates
    github_client.GitHubClient ..> models.RateInfo : updates
    detectors ..> models.Finding : creates
````

## 3\. Data Flow (Request Lifecycle)

1. **Request:** `main.py` receives the `POST /api/scan` request and validates the `ScanRequest` model.
2. **Orchestration:** `main.py` instantiates a `GitHubClient` and a `RepoScanner`, then calls `scanner.scan()`.
3. **Tree Fetch:** `RepoScanner` calls `client.get_repo_tree()` to get the file list.
4. **Parallel Fetch:** `RepoScanner` filters the file list and uses its `asyncio.Semaphore` to fetch scannable files in controlled, parallel batches via `client.get_file_content()`.
5. **Analysis:** As file contents arrive, `RepoScanner` calls `detectors.find_secrets()` for each file.
6. **Aggregation:** `RepoScanner` collects all `Finding` objects, calculates `ScanStats`, and bundles the `ScanResponse`.
7. **Response:** `main.py` returns the `ScanResponse` as JSON.

## 4\. Testing Strategy

Each component is designed to be tested at the appropriate level:

* **`detectors.py` (Unit Tests):** Will be tested in complete isolation. We will pass in sample strings and assert that the correct secrets are found (or not found).
* **`github_client.py` (Integration Tests):** Will be tested using `httpx-mock`. We will mock GitHub API responses (200s, 404s, 429s) and assert that our client handles them, parses data, and manages rate-limits correctly.
* **`scanner.py` (Unit Tests):** Will be tested by passing in a *mocked* `GitHubClient`. We will assert that the scanner calls the client correctly, respects the semaphore, and uses the `detectors` module as expected.
* **`main.py` (E2E / API Tests):** Will be tested using FastAPI's `TestClient`. We will make mock HTTP requests to the `/api/scan` endpoint and assert that we get the correct status codes and JSON responses.

## 5\. Key Architectural Decisions

* **Dependency Injection:** `RepoScanner` receives the `GitHubClient` in its constructor. This allows us to easily mock the `GitHubClient` in tests, enabling fast and reliable unit testing of the orchestration logic.
* **Controlled Concurrency:** We use an `asyncio.Semaphore` to limit the number of concurrent file fetch requests. This prevents us from being aggressively rate-limited by GitHub for firing off hundreds of parallel requests.
* **Centralized HTTP Client:** All GitHub API calls are routed through the `GitHubClient`. This is the only place in the app that handles rate-limit headers (`X-RateLimit-Remaining`), manages `httpx` connections, and knows how to parse GitHub API errors.
* **Pure Business Logic:** The `detectors.py` module is 100% decoupled. It can be tested in complete isolation, as it only operates on string inputs and produces data outputs.
