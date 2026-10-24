"""
train.py - ML Model Training, Evaluation, and Quality Gate for JevShield

This script:
1. Loads URL data (from data/phishing_urls.csv or data/sample_urls.csv).
2. Cleans and balances the data, dropping duplicate URLs before splitting.
3. Performs a stratified 80/20 train/test split (random_state=42).
4. Compares 3 candidate models on 5-fold cross-validation inside the training set:
   - Candidate A: Random Forest (200 trees) on hand-made features
   - Candidate B: HistGradientBoosting on hand-made features
   - Candidate C: TF-IDF char n-grams (3-5) + scaled hand-made features + Logistic Regression
5. Selects the best candidate based on phishing-class F1 score.
6. Trains the chosen candidate on the full training set.
7. Evaluates once on the held-out test set (accuracy, precision, recall, F1, confusion matrix).
8. Generates:
   - model/model.joblib (serialized scikit-learn pipeline)
   - model/metrics.json (summary metrics for CI and reporting)
   - model/comparison.csv (cross-validation comparison of all candidates)
   - model/feature_importance.png (visualization of feature importance)
9. Enforces the accuracy gate:
   - MIN_ACCURACY (default 0.90) and Phishing Recall >= 0.90.
   - Exits with code 1 if thresholds are not met.
"""

import os
import sys
import json
import time
from datetime import datetime
import pandas as pd
import numpy as np
import joblib
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend for headless / server environments
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_validate
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
)

import features


def load_and_prepare_data(data_file: str = None, max_per_class: int = 25000):
    """
    Load, deduplicate, and balance the dataset.
    Prioritizes DATA_FILE environment variable if set.
    """
    if data_file is None:
        data_file = os.environ.get("DATA_FILE")

    if not data_file:
        if os.path.exists("data/phishing_urls.csv"):
            data_file = "data/phishing_urls.csv"
        elif os.path.exists("data/sample_urls.csv"):
            data_file = "data/sample_urls.csv"
        else:
            raise FileNotFoundError("No dataset found in data/ folder.")

    print(f"[DATA] Loading dataset from: {data_file}")
    df = pd.read_csv(data_file)
    print(f"[DATA] Raw rows loaded: {len(df)}")

    # Clean text columns
    df["URL"] = df["URL"].astype(str).str.strip()
    df["Label"] = df["Label"].astype(str).str.strip().str.lower()
    df = df.dropna(subset=["URL", "Label"])
    df = df[df["URL"] != ""]

    # Deduplicate URLs BEFORE splitting to guarantee zero leakage between train and test
    initial_count = len(df)
    df = df.drop_duplicates(subset=["URL"])
    print(f"[DATA] Deduplicated: {len(df)} unique URLs (dropped {initial_count - len(df)} duplicates)")

    # Balance classes if on full dataset or if imbalanced
    good_df = df[df["Label"] == "good"]
    bad_df = df[df["Label"] == "bad"]
    print(f"[DATA] Available class counts - Good: {len(good_df)}, Bad: {len(bad_df)}")

    # Check if max_per_class applies
    n_sample = min(len(good_df), len(bad_df), max_per_class)
    print(f"[DATA] Sampling {n_sample} rows per class for balanced training...")
    good_sampled = good_df.sample(n=n_sample, random_state=42)
    bad_sampled = bad_df.sample(n=n_sample, random_state=42)

    balanced_df = (
        pd.concat([good_sampled, bad_sampled])
        .sample(frac=1.0, random_state=42)
        .reset_index(drop=True)
    )
    print(f"[DATA] Final balanced dataset size: {len(balanced_df)} rows")

    X = balanced_df["URL"].values
    # Label mapping: bad = 1 (phishing), good = 0 (safe)
    y = (balanced_df["Label"] == "bad").astype(int).values

    return X, y


def build_candidate_pipelines():
    """
    Define the three candidate models for cross-validation comparison.
    All are wrapped in pipelines for consistent preprocessing and serving.
    """
    # Candidate A: Random Forest (200 trees) on hand-made features
    pipe_a = Pipeline([
        ("extract", features.HandmadeFeatureExtractor()),
        ("clf", RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1))
    ])

    # Candidate B: HistGradientBoosting on hand-made features
    pipe_b = Pipeline([
        ("extract", features.HandmadeFeatureExtractor()),
        ("clf", HistGradientBoostingClassifier(random_state=42))
    ])

    # Candidate C: TF-IDF char n-grams + scaled hand-made features + Logistic Regression
    pipe_c = Pipeline([
        ("union", FeatureUnion([
            ("tfidf", TfidfVectorizer(
                analyzer="char",
                ngram_range=(3, 5),
                sublinear_tf=True,
                max_features=200000,
                preprocessor=features.clean_url_for_features
            )),
            ("feat", Pipeline([
                ("extract", features.HandmadeFeatureExtractor()),
                ("scale", StandardScaler(with_mean=False))
            ]))
        ])),
        ("clf", LogisticRegression(C=5.0, max_iter=1000, random_state=42))
    ])

    return {
        "Random Forest (200 trees)": pipe_a,
        "HistGradientBoosting": pipe_b,
        "TF-IDF + Features + Logistic Regression": pipe_c,
    }


def compare_candidates(candidates: dict, X_train: np.ndarray, y_train: np.ndarray):
    """
    Run 5-fold cross-validation on the training set for each candidate.
    Returns comparison DataFrame and the name of the winning model.
    """
    print("\n" + "=" * 60)
    print("5-FOLD CROSS-VALIDATION COMPARISON (Training Set Only)")
    print("=" * 60)

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scoring = ["accuracy", "precision", "recall", "f1"]
    results = []

    # Pre-extract hand-made features for faster CV on Candidates A and B
    print("[CV] Extracting hand-made features for Candidates A and B...")
    t0 = time.time()
    extractor = features.HandmadeFeatureExtractor()
    X_train_feat = extractor.transform(X_train)
    print(f"[CV] Feature extraction completed in {time.time() - t0:.2f}s")

    for name, pipeline in candidates.items():
        print(f"\n[CV] Evaluating {name}...")
        t_start = time.time()

        if name == "Random Forest (200 trees)":
            model = RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1)
            scores = cross_validate(model, X_train_feat, y_train, cv=cv, scoring=scoring, n_jobs=-1)
        elif name == "HistGradientBoosting":
            model = HistGradientBoostingClassifier(random_state=42)
            scores = cross_validate(model, X_train_feat, y_train, cv=cv, scoring=scoring, n_jobs=-1)
        else:
            # Candidate C runs the full pipeline
            scores = cross_validate(pipeline, X_train, y_train, cv=cv, scoring=scoring, n_jobs=2)

        elapsed = time.time() - t_start
        mean_acc = float(np.mean(scores["test_accuracy"]))
        mean_prec = float(np.mean(scores["test_precision"]))
        mean_rec = float(np.mean(scores["test_recall"]))
        mean_f1 = float(np.mean(scores["test_f1"]))

        print(f"     Time: {elapsed:.2f}s")
        print(f"     CV Accuracy : {mean_acc:.4f}")
        print(f"     CV Precision: {mean_prec:.4f}")
        print(f"     CV Recall   : {mean_rec:.4f}")
        print(f"     CV F1 Score : {mean_f1:.4f}")

        results.append({
            "Model": name,
            "CV_F1": round(mean_f1, 4),
            "CV_Accuracy": round(mean_acc, 4),
            "CV_Precision": round(mean_prec, 4),
            "CV_Recall": round(mean_rec, 4),
            "CV_Time_Sec": round(elapsed, 2),
        })

    comparison_df = pd.DataFrame(results)
    # Sort by F1 score descending
    comparison_df = comparison_df.sort_values(by="CV_F1", ascending=False).reset_index(drop=True)

    best_model_name = comparison_df.iloc[0]["Model"]
    print("\n" + "=" * 60)
    print("CROSS-VALIDATION SUMMARY TABLE:")
    print(comparison_df.to_string(index=False))
    print(f"\n>>> Selected Best Model (by Phishing F1): {best_model_name}")
    print("=" * 60)

    return comparison_df, best_model_name


def plot_feature_importance(X_train_raw, y_train, output_path: str = "model/feature_importance.png"):
    """
    Fit Random Forest on hand-made features and plot feature importance chart.
    Provides clear visual evidence of lexical and domain signal relevance.
    """
    print("[PLOT] Computing feature importances for report...")
    extractor = features.HandmadeFeatureExtractor()
    X_feat = extractor.transform(X_train_raw)
    rf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    rf.fit(X_feat, y_train)

    importances = rf.feature_importances_
    indices = np.argsort(importances)[::-1]

    # Plot
    plt.figure(figsize=(10, 6))
    plt.title("Feature Importances of Hand-Crafted URL Features", fontsize=14, fontweight="bold")
    plt.barh(
        range(len(features.FEATURE_NAMES)),
        importances[indices][::-1],
        color="#7F9468",
        edgecolor="#3E2A1C",
        align="center",
    )
    plt.yticks(
        range(len(features.FEATURE_NAMES)),
        [features.FEATURE_NAMES[i] for i in indices][::-1],
        fontsize=10,
    )
    plt.xlabel("Relative Importance (Gini Impurity)", fontsize=11)
    plt.tight_layout()
    plt.savefig(output_path, dpi=200)
    plt.close()
    print(f"[PLOT] Feature importance chart saved to: {output_path}")


def main():
    os.makedirs("model", exist_ok=True)

    # 1. Load and prepare dataset
    X_raw, y = load_and_prepare_data()

    # 2. Stratified 80/20 train/test split (random_state=42)
    # The test set is held out and used ONCE at the end
    print("\n[SPLIT] Performing Stratified 80/20 Train/Test Split (random_state=42)...")
    X_train_raw, X_test_raw, y_train, y_test = train_test_split(
        X_raw, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"[SPLIT] Training samples: {len(X_train_raw)}, Testing samples: {len(X_test_raw)}")

    # 3. Compare candidates via 5-fold CV inside the training set
    candidates = build_candidate_pipelines()
    comparison_df, best_name = compare_candidates(candidates, X_train_raw, y_train)

    # Save comparison table
    comparison_path = "model/comparison.csv"
    comparison_df.to_csv(comparison_path, index=False)
    print(f"[OUTPUT] Candidate comparison saved to: {comparison_path}")

    # Generate feature importance chart for report/viva
    plot_feature_importance(X_train_raw, y_train, "model/feature_importance.png")

    # 4. Train winning model on the entire training set
    print(f"\n[TRAIN] Fitting selected best model ({best_name}) on full training set...")
    best_pipeline = candidates[best_name]
    t0 = time.time()
    best_pipeline.fit(X_train_raw, y_train)
    fit_duration = time.time() - t0
    print(f"[TRAIN] Fit completed in {fit_duration:.2f}s")

    # 5. Evaluate ONCE on the held-out test set
    print("\n" + "=" * 60)
    print("FINAL EVALUATION ON HELD-OUT TEST SET")
    print("=" * 60)
    y_pred = best_pipeline.predict(X_test_raw)

    test_acc = float(accuracy_score(y_test, y_pred))
    test_prec = float(precision_score(y_test, y_pred))
    test_rec = float(recall_score(y_test, y_pred))
    test_f1 = float(f1_score(y_test, y_pred))
    cm = confusion_matrix(y_test, y_pred).tolist()

    print(f"Test Accuracy        : {test_acc:.4f} ({test_acc * 100:.2f}%)")
    print(f"Phishing Precision   : {test_prec:.4f} ({test_prec * 100:.2f}%)")
    print(f"Phishing Recall      : {test_rec:.4f} ({test_rec * 100:.2f}%)")
    print(f"Phishing F1 Score    : {test_f1:.4f} ({test_f1 * 100:.2f}%)")
    print("\nConfusion Matrix [TN, FP] / [FN, TP]:")
    print(np.array(cm))
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=["Safe (0)", "Phishing (1)"]))

    # 6. Save model and metrics
    model_path = "model/model.joblib"
    print(f"[OUTPUT] Saving trained model to: {model_path}")
    joblib.dump(best_pipeline, model_path)

    metrics = {
        "model_name": best_name,
        "accuracy": round(test_acc, 4),
        "precision": round(test_prec, 4),
        "recall": round(test_rec, 4),
        "f1": round(test_f1, 4),
        "confusion_matrix": cm,
        "rows_used": int(len(X_raw)),
        "train_rows": int(len(X_train_raw)),
        "test_rows": int(len(X_test_raw)),
        "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }

    metrics_path = "model/metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"[OUTPUT] Metrics saved to: {metrics_path}")

    # 7. Quality Gate Enforcement
    min_acc_env = os.environ.get("MIN_ACCURACY", "0.90")
    min_accuracy = float(min_acc_env)
    min_recall = 0.90

    print("\n" + "=" * 60)
    print(f"ACCURACY GATE CHECK (Thresholds: Accuracy >= {min_accuracy:.2f}, Recall >= {min_recall:.2f})")
    print("=" * 60)

    passed = True
    if test_acc < min_accuracy:
        print(f"[GATE FAILED] Test accuracy {test_acc:.4f} is below minimum {min_accuracy:.4f}")
        passed = False
    else:
        print(f"[GATE PASSED] Test accuracy: {test_acc:.4f} >= {min_accuracy:.4f}")

    if test_rec < min_recall:
        print(f"[GATE FAILED] Phishing recall {test_rec:.4f} is below minimum {min_recall:.4f}")
        passed = False
    else:
        print(f"[GATE PASSED] Phishing recall: {test_rec:.4f} >= {min_recall:.4f}")

    if not passed:
        print("\n>>> Quality Gate enforcement failed! Exiting with code 1.")
        sys.exit(1)

    print("\n>>> ALL QUALITY GATES PASSED! Exiting with code 0.")
    sys.exit(0)


if __name__ == "__main__":
    main()
