# JevShield: Phishing Detection & Analysis System

JevShield is a responsive, animated, web-based phishing detection and URL analysis platform designed with full-stack and DevOps best practices.

## Overview
- **Detection**: ML model trained on URL lexical, structural, and character n-gram features.
- **Explainability**: Plain-language threat indicators, domain typo suggestions ("did you mean"), and safe website summaries.
- **Assistant**: AI-powered explanation chatbot and screenshot analyzer with fallback rules.
- **DevOps Pipeline**: Automated testing (pytest), accuracy gate enforcement, containerization (Docker), and CI/CD (Jenkins).

## Project Structure
```text
jevshield/
  app.py                # Flask web app and all API endpoints
  features.py           # Shared feature extraction and URL cleaning
  train.py              # ML model training, evaluation, and accuracy gate
  url_utils.py          # URL validation and normalization helpers
  suggest.py            # Typo-squatting / domain similarity detection
  summary.py            # Safe web fetch & page summarizer
  db.py                 # SQLite scan history database helpers
  templates/index.html  # Responsive frontend UI
  static/style.css      # Custom styling & animations
  static/script.js      # Frontend interaction logic
  data/                 # Datasets (phishing_urls.csv, sample_urls.csv)
  model/                # Trained artifacts, metrics, and plots
  tests/                # Automated pytest suite
  Dockerfile            # Container specification
  Jenkinsfile           # Declarative CI/CD pipeline
  requirements.txt      # Python dependencies
  README.md             # Documentation
```

*Detailed installation and execution instructions will be documented as each development stage completes.*
