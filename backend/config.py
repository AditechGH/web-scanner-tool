import os

# --- Scanner Configuration ---
# Max file size in bytes (default 750KB)
MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE", "750000"))

# Max number of concurrent file fetching requests
MAX_CONCURRENT_REQUESTS: int = int(os.getenv("MAX_CONCURRENT_REQUESTS", "10"))

# Cap on total files to scan to prevent memory issues
MAX_FILES_PER_SCAN: int = int(os.getenv("MAX_FILES_PER_SCAN", "2000"))

# --- Detector Configuration ---
# File extensions to deny
FILE_EXT_DENYLIST: set[str] = {
    # Binaries / Media
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".ico", ".webp",
    ".mp3", ".wav", ".flac", ".ogg",
    ".mp4", ".mov", ".avi", ".wmv", ".mkv",
    ".zip", ".gz", ".tar", ".rar", ".7z",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".eot", ".ttf", ".woff", ".woff2",
    ".bin", ".exe", ".iso", ".img", ".dmg",
    ".log",
    
    # Bundled / Minified Assets
    ".min.js",
    ".bundle.js",
    ".map",
}

# File and directory paths to deny
FILE_PATH_DENYLIST: set[str] = {
    # Lockfiles
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "composer.lock",
    "Gemfile.lock",
    "go.sum",
    
    # Common vendor/build paths
    "vendor/",
    "node_modules/",
    "/dist/",
    "/build/",
    "/.next/",
    "/.vercel/",
    "/.venv/",
}

# Keywords to check for near a potential secret
KEYWORD_PATTERNS: set[str] = {
    "key", "token", "secret", "password", "passwd",
    "bearer", "auth", "api_key", "client_secret",
    "private_key", "aws_access_key_id", "aws_secret_access_key",
    "stripe_key", "github_token", "slack_token",
}