"""
tests/test_suggest.py - Unit Tests for Typo-squatting Suggestions
"""

import suggest


def test_typosquat_suggests_real_domain():
    # 'gooogle.com' should suggest 'google.com'
    suggestions = suggest.get_domain_suggestions("gooogle.com")
    assert "google.com" in suggestions

    # 'paypa1.com' should suggest 'paypal.com' or 'paytm.com'
    is_fake, suggs = suggest.is_typosquat("paypa1.com")
    assert is_fake is True
    assert len(suggs) > 0


def test_exact_trusted_domain_returns_empty():
    # If the domain is exactly legitimate, no suggestions should be returned
    assert suggest.get_domain_suggestions("google.com") == []
    assert suggest.get_domain_suggestions("facebook.com") == []
    assert suggest.get_domain_suggestions("github.com") == []
    assert suggest.get_domain_suggestions("paypal.com") == []


def test_clean_host_for_suggestion():
    assert suggest.clean_host_for_suggestion("www.google.com") == "google.com"
    assert suggest.clean_host_for_suggestion("GOOGLE.COM:8080") == "google.com"
    assert suggest.clean_host_for_suggestion("") == ""
