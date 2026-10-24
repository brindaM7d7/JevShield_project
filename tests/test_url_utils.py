"""
tests/test_url_utils.py - Unit Tests for URL Cleaning and Validation
"""

import pytest
import url_utils


def test_clean_url_adds_scheme():
    assert url_utils.clean_url("google.com") == "http://google.com"
    assert url_utils.clean_url("example.com/path?a=1") == "http://example.com/path?a=1"
    # Preserves existing https://
    assert url_utils.clean_url("https://secure.bank.com") == "https://secure.bank.com"


def test_clean_url_strips_spaces():
    assert url_utils.clean_url("   github.com   ") == "http://github.com"
    assert url_utils.clean_url("\t https://python.org \n") == "https://python.org"


def test_clean_url_rejects_empty():
    with pytest.raises(ValueError, match="Please enter a valid website address"):
        url_utils.clean_url("")
    with pytest.raises(ValueError, match="Please enter a valid website address"):
        url_utils.clean_url("   ")
    with pytest.raises(ValueError, match="Please enter a valid website address"):
        url_utils.clean_url(None)


def test_clean_url_rejects_no_dot():
    # Bare words without dot
    with pytest.raises(ValueError, match="Please enter a valid website address"):
        url_utils.clean_url("hello")
    with pytest.raises(ValueError, match="Please enter a valid website address"):
        url_utils.clean_url("google")


def test_clean_url_rejects_invalid_schemes():
    # mailto:, javascript:, file:, ftp:
    with pytest.raises(ValueError, match="Please enter a valid website address"):
        url_utils.clean_url("mailto:victim@example.com")
    with pytest.raises(ValueError, match="Please enter a valid website address"):
        url_utils.clean_url("javascript:alert(1)")
    with pytest.raises(ValueError, match="Please enter a valid website address"):
        url_utils.clean_url("file:///etc/passwd")


def test_clean_url_rejects_overlong():
    long_url = "http://example.com/" + ("a" * 2050)
    with pytest.raises(ValueError, match="Please enter a valid website address"):
        url_utils.clean_url(long_url)


def test_is_ip():
    assert url_utils.is_ip("192.168.1.1") is True
    assert url_utils.is_ip("10.0.0.1:8080") is True
    assert url_utils.is_ip("127.0.0.1") is True
    assert url_utils.is_ip("google.com") is False
    assert url_utils.is_ip("sub.example.com") is False
    assert url_utils.is_ip("") is False


def test_is_shortened():
    assert url_utils.is_shortened("bit.ly") is True
    assert url_utils.is_shortened("tinyurl.com") is True
    assert url_utils.is_shortened("t.co") is True
    assert url_utils.is_shortened("google.com") is False
    assert url_utils.is_shortened("github.com") is False


def test_extract_host():
    assert url_utils.extract_host("https://www.google.com/search") == "google.com"
    assert url_utils.extract_host("http://test.example.com:8080/path") == "test.example.com"
