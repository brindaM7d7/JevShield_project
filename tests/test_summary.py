"""
tests/test_summary.py - Unit Tests for SSRF Protection and Safe Summarization
"""

from unittest.mock import patch, MagicMock
import summary


def test_is_public_ip_blocks_private_and_loopback():
    # Loopback
    assert summary.is_public_ip("127.0.0.1") is False
    assert summary.is_public_ip("127.0.0.2") is False
    assert summary.is_public_ip("::1") is False

    # Private ranges (RFC 1918)
    assert summary.is_public_ip("192.168.0.1") is False
    assert summary.is_public_ip("192.168.1.254") is False
    assert summary.is_public_ip("10.0.0.1") is False
    assert summary.is_public_ip("172.16.0.1") is False
    assert summary.is_public_ip("172.31.255.255") is False

    # Link-local
    assert summary.is_public_ip("169.254.1.1") is False

    # Valid Public IPs
    assert summary.is_public_ip("8.8.8.8") is True
    assert summary.is_public_ip("1.1.1.1") is True
    assert summary.is_public_ip("93.184.216.34") is True


def test_validate_host_ip_blocks_localhost():
    assert summary.validate_host_ip("127.0.0.1") is False
    assert summary.validate_host_ip("localhost") is False
    assert summary.validate_host_ip("192.168.1.1") is False


@patch("summary.safe_fetch_page_text")
@patch("summary.summarize_with_claude")
def test_fetch_and_summarize_success(mock_claude, mock_fetch):
    mock_fetch.return_value = "Title: Example Domain\nDescription: An illustrative example."
    mock_claude.return_value = {
        "category": "Documentation",
        "points": [
            "Official demonstration website.",
            "Used in illustrative documentation.",
            "Free for testing and examples.",
        ],
    }

    data, note = summary.fetch_and_summarize("http://example.com")
    assert note == ""
    assert data is not None
    assert data["category"] == "Documentation"
    assert len(data["points"]) == 3


@patch("summary.safe_fetch_page_text")
def test_fetch_and_summarize_fetch_failure(mock_fetch):
    mock_fetch.return_value = None
    data, note = summary.fetch_and_summarize("http://example.com")
    assert data is None
    assert note == "Could not read this website's content."


@patch("summary.requests.Session.get")
@patch("summary.validate_host_ip")
def test_safe_fetch_page_text_blocks_invalid_host(mock_val, mock_get):
    mock_val.return_value = False
    result = summary.safe_fetch_page_text("http://192.168.1.1/secret")
    assert result is None
    mock_get.assert_not_called()
