"""
tests/test_model.py - Model Metrics Gate Verification and Prediction Checks
"""

import os
import json
import joblib


def test_metrics_json_quality_gate():
    metrics_path = "model/metrics.json"
    assert os.path.exists(metrics_path), "model/metrics.json does not exist. Train the model first."

    with open(metrics_path, "r") as f:
        metrics = json.load(f)

    # Check required fields
    assert "accuracy" in metrics
    assert "recall" in metrics
    assert "precision" in metrics
    assert "f1" in metrics
    assert "confusion_matrix" in metrics

    # Enforce accuracy and phishing recall >= 0.90
    print(f"Recorded Accuracy: {metrics['accuracy']}")
    print(f"Recorded Recall: {metrics['recall']}")

    assert (
        metrics["accuracy"] >= 0.90
    ), f"Test accuracy {metrics['accuracy']} is below required 0.90 threshold"
    assert (
        metrics["recall"] >= 0.90
    ), f"Phishing recall {metrics['recall']} is below required 0.90 threshold"


def test_model_artifact_predictions():
    model_path = "model/model.joblib"
    assert os.path.exists(model_path), "model/model.joblib does not exist."

    model = joblib.load(model_path)
    assert hasattr(model, "predict_proba")

    # Predict on test URLs
    test_urls = ["https://google.com", "http://paypal-login-verify-account.tk:8080/"]
    probs = model.predict_proba(test_urls)

    assert probs.shape == (2, 2)
    # Probabilities sum to 1
    assert round(float(probs[0].sum()), 4) == 1.0
    assert round(float(probs[1].sum()), 4) == 1.0
