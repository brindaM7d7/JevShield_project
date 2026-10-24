"""
tests/test_features.py - Unit Tests for Feature Extraction and Cleaning
"""

import numpy as np
import features


def test_clean_url_for_features():
    # Should lowercase
    assert features.clean_url_for_features("HTTP://EXAMPLE.COM/PATH") == "example.com/path"
    # Should remove https://
    assert features.clean_url_for_features("https://secure.example.com") == "secure.example.com"
    # Should remove leading www.
    assert features.clean_url_for_features("https://www.google.com") == "google.com"
    assert features.clean_url_for_features("http://www.test.org/login") == "test.org/login"
    # Empty input
    assert features.clean_url_for_features("") == ""


def test_extract_features_count():
    urls = [
        "https://google.com",
        "http://192.168.1.1:8080/admin",
        "bit.ly/xyz123",
        "https://www.paypal.com-login-verify.secure-update.tk/account?user=test@bank",
    ]
    for url in urls:
        feat = features.extract_features(url)
        assert isinstance(feat, dict)
        assert len(feat) == 20
        # Verify all feature names exist
        for name in features.FEATURE_NAMES:
            assert name in feat
            assert isinstance(feat[name], (int, float))


def test_ip_flag():
    # IP host
    feat_ip = features.extract_features("http://192.168.1.100/login")
    assert feat_ip["is_ip"] == 1.0

    feat_ip_port = features.extract_features("http://10.0.0.1:8080/test")
    assert feat_ip_port["is_ip"] == 1.0

    # Domain host
    feat_domain = features.extract_features("https://google.com/search")
    assert feat_domain["is_ip"] == 0.0


def test_shortener_flag():
    # Shortened domains
    feat_short = features.extract_features("http://bit.ly/3xY7zq")
    assert feat_short["is_shortened"] == 1.0

    feat_tiny = features.extract_features("https://tinyurl.com/abc")
    assert feat_tiny["is_shortened"] == 1.0

    # Normal domain
    feat_normal = features.extract_features("https://wikipedia.org/wiki/Phishing")
    assert feat_normal["is_shortened"] == 0.0


def test_handmade_feature_extractor_transformer():
    urls = ["https://google.com", "http://fake-login-bank.tk:8080"]
    extractor = features.HandmadeFeatureExtractor()
    arr = extractor.transform(urls)
    assert isinstance(arr, np.ndarray)
    assert arr.shape == (2, 20)
