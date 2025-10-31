import re
import math
from typing import List, Dict, Optional
from collections import Counter

from . import config
from .models import Finding

# --- Detector Constants ---
ENTROPY_THRESHOLD: float = 4.5
SNIPPET_MAX_LEN: int = 200

# --- Regex Patterns ---
REGEX_RULES = {
    "AWS_ACCESS_KEY": {
        "pattern": re.compile(r"AKIA[0-9A-Z]{16}"),
        "confidence": "high",
    },
    "SLACK_TOKEN_LEGACY": {
        "pattern": re.compile(r"xox[abop]-[0-9a-zA-Z-]{10,48}"),
        "confidence": "high",
    },
    "SLACK_WEBHOOK": {
        "pattern": re.compile(r"T[A-Za-z0-9_]{8}/B[A-Za-z0-9_]{8,12}/[A-Za-z0-9_]{24}"),
        "confidence": "high",
    },
    "GITHUB_TOKEN": {
        "pattern": re.compile(r"gh[pousr]_[A-Za-z0-9_]{36,255}"),
        "confidence": "high",
    },
    "STRIPE_API_KEY": {
        "pattern": re.compile(r"sk_(live|test)_[A-Za-z0-9]{24,99}"),
        "confidence": "high",
    },
    "GENERIC_HIGH_ENTROPY_STRING": {
        "pattern": re.compile(r"[\"']?[A-Za-z0-9_.+-]{32,128}[\"']?"),
        "confidence": "low",
    },
}

# --- Main Detector Functions ---

def is_file_scannable(file_path: str, file_size: Optional[int]) -> bool:
    """
    Checks if a file should be scanned based on its path, extension, and size.
    Accepts Optional[int] for size as the GitHub API doesn't always provide it.
    """
    # 1. Check size (if available)
    if file_size is not None and file_size > config.MAX_FILE_SIZE:
        return False

    lower_path = file_path.lower()

    # 2. Check extension
    if any(lower_path.endswith(ext) for ext in config.FILE_EXT_DENYLIST):
        return False

    # 3. Check path fragments
    if any(denied in lower_path for denied in config.FILE_PATH_DENYLIST):
        return False

    return True



def find_secrets(file_path: str, content: str) -> List[Finding]:
    """
    Scans the given content for secrets.
    """
    findings: List[Finding] = []
    lines = content.splitlines()

    for line_number, line in enumerate(lines, 1):
        # 1. Check Regex Rules
        for rule_id, rule in REGEX_RULES.items():
            for match in rule["pattern"].finditer(line):
                confidence = rule["confidence"]
                
                if confidence != "high" and _keywords_are_present(line):
                    confidence = "medium"

                findings.append(
                    Finding(
                        file_path=file_path, 
                        line=line_number,
                        snippet=_create_snippet_with_redaction(line, match.start(), match.end()),
                        rule_id="regex",
                        confidence=confidence,
                    )
                )
        
        # 2. Check High Entropy
        generic_rule = REGEX_RULES["GENERIC_HIGH_ENTROPY_STRING"]
        for match in generic_rule["pattern"].finditer(line):
            matched_string = match.group(0)
            entropy = _calculate_shannon_entropy(matched_string)

            if entropy > ENTROPY_THRESHOLD:
                confidence = "medium" if _keywords_are_present(line) else "low"
                
                if not any(f.line == line_number and f.confidence == "high" for f in findings):
                    findings.append(
                        Finding(
                            file_path=file_path,
                            line=line_number,
                            snippet=_create_snippet_with_redaction(line, match.start(), match.end()),
                            rule_id="entropy",
                            confidence=confidence,
                        )
                    )

    return _deduplicate_findings(findings)


# --- Helper Functions ---

def _keywords_are_present(line: str) -> bool:
    line_lower = line.lower()
    for keyword in config.KEYWORD_PATTERNS:
        if keyword in line_lower:
            return True
    return False

def _mask(s: str) -> str:
    """Masks the middle of a string, showing first/last 4 chars."""
    if len(s) <= 8:
        return "*" * len(s)
    return s[:4] + "*" * (len(s) - 8) + s[-4:]

def _truncate(s: str, center_at: int, max_len: int) -> str:
    """Truncates a string to max_len, centered around center_at."""
    if len(s) <= max_len:
        return s
    half = max_len // 2
    start = max(0, center_at - half)
    end = min(len(s), start + max_len)
    
    if start == 0:
        end = min(len(s), max_len)
    elif end == len(s):
        start = max(0, len(s) - max_len)

    prefix = "... " if start > 0 else ""
    suffix = " ..." if end < len(s) else ""
    return prefix + s[start:end] + suffix

def _create_snippet_with_redaction(line: str, start: int, end: int) -> str:
    """Masks the secret and truncates the line."""
    redacted_line = line[:start] + _mask(line[start:end]) + line[end:]
    return _truncate(redacted_line.strip(), center_at=start, max_len=SNIPPET_MAX_LEN)


def _deduplicate_findings(findings: List[Finding]) -> List[Finding]:
    """
    Removes duplicate findings from a list, keeping the highest confidence one.
    """
    unique_findings: Dict[str, Finding] = {}
    
    findings.sort(key=lambda f: 1 if f.confidence == "low" else (2 if f.confidence == "medium" else 3))

    for finding in findings:
        key = f"{finding.file_path}:{finding.line}"
        unique_findings[key] = finding
        
    return list(unique_findings.values())


def _calculate_shannon_entropy(text: str) -> float:
    """
    Calculates the Shannon entropy of a given string.
    """
    if not text:
        return 0
    
    entropy = 0
    length = len(text)
    counts = Counter(text)
    
    for count in counts.values():
        probability = count / length
        entropy -= probability * math.log2(probability)
        
    return entropy