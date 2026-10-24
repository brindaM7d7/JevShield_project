"""
tests/test_app.py - Integration Tests for Flask Endpoints using Test Client
"""

import io
import pytest
from app import app
import db


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_health_endpoint(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"


def test_index_endpoint(client):
    res = client.get("/")
    assert res.status_code == 200
    assert b"JEVSHIELD" in res.data
    assert b"id=\"scanner\"" in res.data
    assert b"id=\"chat\"" in res.data
    assert b"id=\"history\"" in res.data
    assert b"id=\"how\"" in res.data


def test_predict_valid_safe_url(client):
    res = client.post("/predict", json={"url": "https://google.com"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["result"] == "safe"
    assert data["safety_score"] >= 70
    assert "reasons" in data
    assert isinstance(data["reasons"], list)


def test_predict_phishing_url(client):
    res = client.post(
        "/predict",
        json={"url": "http://paypal.com-login-verify.secure-update.tk:8080/account"},
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["result"] == "phishing"
    assert data["safety_score"] <= 30
    assert data["summary"] is None
    assert "We didn't open this site" in data["summary_note"]


def test_predict_typosquat_url(client):
    res = client.post("/predict", json={"url": "http://gooogle.com"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["result"] == "phishing"
    assert "google.com" in data["suggestions"]


def test_predict_invalid_urls(client):
    # Empty
    res1 = client.post("/predict", json={"url": ""})
    assert res1.status_code == 400
    assert "error" in res1.get_json()

    # Bare word without dot
    res2 = client.post("/predict", json={"url": "hello"})
    assert res2.status_code == 400

    # Non-http scheme
    res3 = client.post("/predict", json={"url": "mailto:attacker@mail.com"})
    assert res3.status_code == 400


def test_compare_endpoint(client):
    # Safe vs Phishing
    res = client.post(
        "/compare",
        json={"url_a": "google.com", "url_b": "http://paypal-login-verify-account.tk"},
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["safer"] == "a"
    assert "a" in data and "b" in data

    # Both Phishing
    res_both = client.post(
        "/compare",
        json={
            "url_a": "http://fake-bank-login.com",
            "url_b": "http://paypal-login-verify-account.tk",
        },
    )
    assert res_both.status_code == 200
    data_both = res_both.get_json()
    assert data_both["note"] == "Neither website looks safe."

    # Missing arguments
    res_err = client.post("/compare", json={"url_a": "google.com"})
    assert res_err.status_code == 400


def test_chat_fallback(client):
    scan_ctx = {
        "url": "http://fake-paypal.tk",
        "result": "phishing",
        "safety_score": 0,
        "confidence": 0.99,
        "reasons": ["Contains security-sensitive words (paypal)"],
    }

    # Why question
    res_why = client.post(
        "/chat", json={"question": "Why was this flagged?", "scan": scan_ctx}
    )
    assert res_why.status_code == 200
    assert "paypal" in res_why.get_json()["answer"].lower()

    # Safe to open question
    res_safe = client.post(
        "/chat", json={"question": "Is it safe to open?", "scan": scan_ctx}
    )
    assert res_safe.status_code == 200
    assert "dangerous" in res_safe.get_json()["answer"].lower() or "no" in res_safe.get_json()["answer"].lower()

    # What to do question
    res_action = client.post(
        "/chat", json={"question": "What should I do now?", "scan": scan_ctx}
    )
    assert res_action.status_code == 200
    assert "do not click" in res_action.get_json()["answer"].lower()


def test_scan_image_validation(client):
    # Missing file
    res_none = client.post("/scan-image")
    assert res_none.status_code == 400

    # Invalid extension
    data_txt = {"image": (io.BytesIO(b"text content"), "sample.txt")}
    res_txt = client.post(
        "/scan-image", data=data_txt, content_type="multipart/form-data"
    )
    assert res_txt.status_code == 400
    assert "Only PNG, JPG, and WEBP" in res_txt.get_json()["error"]

    # File exceeding 5 MB
    large_payload = b"0" * (5 * 1024 * 1024 + 10)
    data_large = {"image": (io.BytesIO(large_payload), "large.png")}
    res_large = client.post(
        "/scan-image", data=data_large, content_type="multipart/form-data"
    )
    assert res_large.status_code == 400
    assert "too large" in res_large.get_json()["error"].lower()

    # Valid image without API key returns 503
    data_valid = {"image": (io.BytesIO(b"\x89PNG\r\n\x1a\nfake"), "shot.png")}
    res_valid = client.post(
        "/scan-image", data=data_valid, content_type="multipart/form-data"
    )
    assert res_valid.status_code == 503
    assert "requires an Anthropic API key" in res_valid.get_json()["error"]


def test_history_endpoint(client):
    res = client.get("/history")
    assert res.status_code == 200
    data = res.get_json()
    assert isinstance(data, list)
    if len(data) > 0:
        item = data[0]
        assert "url" in item
        assert "result" in item
        assert "safety_score" in item
