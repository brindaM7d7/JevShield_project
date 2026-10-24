"""
url_utils.py - URL Validation, Normalization, and Security Parsing for JevShield

Handles:
- URL cleaning, trimming, and scheme normalization (adds http:// if missing)
- Validation: length limits, character checks, dot presence, scheme restrictions
- Extraction of host, path, port
- IP address detection
- Shortened domain detection
"""

import re
import ipaddress
from urllib.parse import urlparse

# Trusted URL shortening services
KNOWN_SHORTENERS = {
    "bit.ly",
    "tinyurl.com",
    "t.co",
    "goo.gl",
    "ow.ly",
    "is.gd",
    "cutt.ly",
    "buff.ly",
    "adf.ly",
    "bit.do",
    "tiny.cc",
}


def is_ip(host: str) -> bool:
    """
    Check if the given host string is an IPv4 or IPv6 address.
    Strips port number if present.
    """
    if not host:
        return False
    # Strip port if present
    h = host.split(":")[0].strip("[]")
    try:
        ipaddress.ip_address(h)
        return True
    except ValueError:
        return False


def is_shortened(host: str) -> bool:
    """
    Check if host belongs to a known URL shortener service.
    """
    if not host:
        return False
    h = host.split(":")[0].lower()
    if h.startswith("www."):
        h = h[4:]
    return h in KNOWN_SHORTENERS


def clean_url(raw_url: str) -> str:
    """
    Validate and normalize input URL.
    - Trims whitespace
    - Checks length limit (max 2048 chars)
    - Rejects disallowed schemes (mailto:, ftp:, javascript:, file:)
    - Requires a dot '.' (rejects bare words like 'hello')
    - Adds 'http://' scheme if missing
    - Supports internationalized domain names (IDN / punycode)
    
    Raises ValueError with a clear user message if validation fails.
    """
    if not raw_url or not isinstance(raw_url, str):
        raise ValueError("Please enter a valid website address")

    cleaned = raw_url.strip()

    if not cleaned:
        raise ValueError("Please enter a valid website address")

    if len(cleaned) > 2048:
        raise ValueError("Please enter a valid website address")

    # Reject non-http schemes (mailto:, javascript:, file:, data:, ftp:, etc.)
    scheme_match = re.match(r"^([a-zA-Z][a-zA-Z0-9+.-]*):", cleaned)
    if scheme_match:
        scheme = scheme_match.group(1).lower()
        if scheme not in ("http", "https"):
            raise ValueError("Please enter a valid website address")

    # If no scheme provided, prepend http:// for consistent parsing
    if not re.match(r"^https?://", cleaned, re.IGNORECASE):
        cleaned = "http://" + cleaned

    try:
        parsed = urlparse(cleaned)
    except Exception:
        raise ValueError("Please enter a valid website address")

    host = parsed.netloc or parsed.path.split("/")[0]
    # Remove port for dot check
    host_no_port = host.split(":")[0].strip("[]")

    if not host_no_port:
        raise ValueError("Please enter a valid website address")

    # Require at least one dot in the host (unless it's a valid IP address)
    if not is_ip(host_no_port) and "." not in host_no_port:
        raise ValueError("Please enter a valid website address")

    # Support IDN (convert Unicode domain to Punycode if needed)
    try:
        host_no_port.encode("idna")
    except Exception:
        raise ValueError("Please enter a valid website address")

    return cleaned


def extract_host(url: str) -> str:
    """
    Extract clean, lowercase host name without port or leading www.
    """
    try:
        if not re.match(r"^https?://", url, re.IGNORECASE):
            url = "http://" + url
        parsed = urlparse(url)
        host = (parsed.netloc or "").split(":")[0].lower()
        if host.startswith("www."):
            host = host[4:]
        return host
    except Exception:
        return ""
