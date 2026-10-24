"""
features.py - URL Cleaning and Feature Extraction for JevShield

This module contains:
1. clean_url_for_features: Shared URL cleaning logic used in both training and prediction.
2. extract_features: Extracts 20 hand-crafted lexical, structural, and statistical features.
3. HandmadeFeatureExtractor: Scikit-learn compatible transformer for ML pipelines.
"""

import math
import re
import ipaddress
from collections import Counter
import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin

# List of known URL shortening domains
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

# Suspicious keywords commonly found in phishing lures
SUSPICIOUS_WORDS = [
    "login",
    "verify",
    "secure",
    "account",
    "update",
    "bank",
    "confirm",
    "password",
    "signin",
    "paypal",
]

# Ordered names of the 20 hand-crafted features
FEATURE_NAMES = [
    "url_length",
    "host_length",
    "path_length",
    "nb_dots_host",
    "nb_subdomains",
    "nb_hyphens_host",
    "count_at",
    "count_question",
    "count_equals",
    "count_ampersand",
    "count_percent",
    "count_slash",
    "nb_digits",
    "digit_ratio",
    "is_ip",
    "is_shortened",
    "suspicious_words_count",
    "has_port",
    "longest_token_length",
    "host_entropy",
]


def clean_url_for_features(url: str) -> str:
    """
    Clean URL to standard format used for both training and serving:
    - Strips whitespace
    - Converts to lowercase
    - Removes scheme (http://, https://)
    - Removes leading 'www.'
    """
    if not url:
        return ""
    cleaned = str(url).strip().lower()

    # Remove http:// or https:// scheme
    cleaned = re.sub(r"^https?://", "", cleaned)

    # Remove leading www.
    if cleaned.startswith("www."):
        cleaned = cleaned[4:]

    return cleaned


def _is_ip_address(host: str) -> int:
    """Check if the host is an IPv4 or IPv6 address."""
    # Strip port if present
    h = host.split(":")[0]
    try:
        ipaddress.ip_address(h)
        return 1
    except ValueError:
        return 0


def _calculate_entropy(text: str) -> float:
    """Calculate Shannon entropy for a given string."""
    if not text:
        return 0.0
    counts = Counter(text)
    length = len(text)
    return -sum((c / length) * math.log2(c / length) for c in counts.values())


def extract_features(url: str) -> dict:
    """
    Extract ~20 hand-crafted features from a URL.
    Returns a dictionary mapping feature name to numeric value.
    """
    cleaned = clean_url_for_features(url)
    if not cleaned:
        return {name: 0.0 for name in FEATURE_NAMES}

    # Split host and path/query
    # Host is everything before the first '/', '?', or '#'
    match = re.match(r"^([^/?#]+)(.*)$", cleaned)
    if match:
        raw_host = match.group(1)
        path = match.group(2)
    else:
        raw_host = cleaned
        path = ""

    # Check for explicit port in host (e.g. domain.com:8080)
    has_port = 1 if re.search(r":\d{1,5}$", raw_host) else 0
    host_clean = raw_host.split(":")[0]

    # Host and Path metrics
    url_len = len(cleaned)
    host_len = len(host_clean)
    path_len = len(path)

    # Dots and subdomains in host
    dots_in_host = host_clean.count(".")
    # If host is an IP, subdomains don't apply
    is_ip = _is_ip_address(host_clean)
    if is_ip:
        subdomains = 0
    else:
        host_parts = host_clean.split(".")
        # A standard domain like example.com has 2 parts (0 subdomains)
        # sub.example.com has 3 parts (1 subdomain)
        subdomains = max(0, len(host_parts) - 2)

    hyphens_in_host = host_clean.count("-")

    # Character counts in the full cleaned URL
    count_at = cleaned.count("@")
    count_question = cleaned.count("?")
    count_equals = cleaned.count("=")
    count_ampersand = cleaned.count("&")
    count_percent = cleaned.count("%")
    count_slash = cleaned.count("/")

    # Digit counts and ratio
    digits_count = sum(1 for c in cleaned if c.isdigit())
    digit_ratio = digits_count / max(url_len, 1)

    # Shortener check
    is_shortened = 1 if host_clean in KNOWN_SHORTENERS else 0

    # Suspicious words count in the full cleaned URL
    suspicious_count = sum(cleaned.count(word) for word in SUSPICIOUS_WORDS)

    # Longest token in URL
    tokens = re.split(r"[^a-zA-Z0-9]", cleaned)
    longest_token = max((len(t) for t in tokens if t), default=0)

    # Shannon entropy of the host string
    host_entropy = _calculate_entropy(host_clean)

    return {
        "url_length": float(url_len),
        "host_length": float(host_len),
        "path_length": float(path_len),
        "nb_dots_host": float(dots_in_host),
        "nb_subdomains": float(subdomains),
        "nb_hyphens_host": float(hyphens_in_host),
        "count_at": float(count_at),
        "count_question": float(count_question),
        "count_equals": float(count_equals),
        "count_ampersand": float(count_ampersand),
        "count_percent": float(count_percent),
        "count_slash": float(count_slash),
        "nb_digits": float(digits_count),
        "digit_ratio": float(digit_ratio),
        "is_ip": float(is_ip),
        "is_shortened": float(is_shortened),
        "suspicious_words_count": float(suspicious_count),
        "has_port": float(has_port),
        "longest_token_length": float(longest_token),
        "host_entropy": float(host_entropy),
    }


def extract_features_array(url: str) -> np.ndarray:
    """Extract features as a 1D numpy array in standard feature order."""
    feat_dict = extract_features(url)
    return np.array([feat_dict[name] for name in FEATURE_NAMES], dtype=np.float32)


class HandmadeFeatureExtractor(BaseEstimator, TransformerMixin):
    """
    Scikit-learn compatible transformer that extracts the 20 hand-crafted
    features from a sequence of raw or semi-cleaned URL strings.
    """

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        features = [extract_features_array(url) for url in X]
        return np.array(features, dtype=np.float32)
