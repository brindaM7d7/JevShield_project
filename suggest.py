"""
suggest.py - Domain Typo-Squatting Detection and "Did You Mean" Suggestions

Compares cleaned URL hosts against a curated list of popular trusted domains
using difflib sequence matching to detect typo domains (e.g., 'gooogle.com' -> 'google.com').
"""

import difflib

# Curated list of ~40 popular and high-traffic domains
TRUSTED_DOMAINS = [
    "google.com",
    "google.co.in",
    "facebook.com",
    "instagram.com",
    "amazon.com",
    "amazon.in",
    "flipkart.com",
    "paypal.com",
    "microsoft.com",
    "apple.com",
    "netflix.com",
    "github.com",
    "linkedin.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "wikipedia.org",
    "yahoo.com",
    "whatsapp.com",
    "reddit.com",
    "paytm.com",
    "phonepe.com",
    "sbi.co.in",
    "hdfcbank.com",
    "icicibank.com",
    "axisbank.com",
    "kotak.com",
    "irctc.co.in",
    "uidai.gov.in",
    "incometax.gov.in",
    "dropbox.com",
    "spotify.com",
    "zoom.us",
    "adobe.com",
    "salesforce.com",
    "ebay.com",
    "pinterest.com",
    "telegram.org",
    "quora.com",
    "bing.com",
]


def clean_host_for_suggestion(host: str) -> str:
    """Normalize host by converting to lowercase, stripping port and 'www.'"""
    if not host:
        return ""
    h = host.split(":")[0].strip().lower()
    if h.startswith("www."):
        h = h[4:]
    return h


def get_domain_suggestions(host: str) -> list[str]:
    """
    Find close matching trusted domains for the given host.
    - If host exactly matches a trusted domain, returns empty list [].
    - Otherwise, returns up to 3 close matches with similarity cutoff >= 0.75.
    """
    cleaned_host = clean_host_for_suggestion(host)
    if not cleaned_host:
        return []

    # If the host is exactly in the trusted list, it's legitimate -> no suggestions
    if cleaned_host in TRUSTED_DOMAINS:
        return []

    # Check for close typo matches
    matches = difflib.get_close_matches(cleaned_host, TRUSTED_DOMAINS, n=3, cutoff=0.75)
    return matches


def is_typosquat(host: str) -> tuple[bool, list[str]]:
    """
    Convenience function returning (is_fake_copy, suggestions_list).
    """
    suggestions = get_domain_suggestions(host)
    return (len(suggestions) > 0, suggestions)
