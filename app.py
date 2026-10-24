"""
app.py - Flask Web Application and REST API for JevShield

Implements:
- GET  /            Serves the frontend user interface
- GET  /health      Health check endpoint for Docker & CI/CD
- POST /predict     Single URL phishing scan with rules, ML, suggestions, and summary
- POST /compare     Side-by-side URL comparison
- POST /chat        Context-aware security assistant (Claude or rule-based fallback)
- POST /scan-image  Screenshot threat detection (in-memory parsing with Claude vision)
- GET  /history     Recent 10 scans retrieval
"""

import os
import re
import json
import base64
import joblib
from flask import Flask, request, jsonify, render_template
import anthropic

import features
import url_utils
import suggest
import summary as summary_module
import db

app = Flask(__name__)

# Initialize database tables on application start
db.init_db()

# Load the trained machine learning model
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "model.joblib")
model = None
if os.path.exists(MODEL_PATH):
    try:
        model = joblib.load(MODEL_PATH)
        print(f"[STARTUP] ML Model successfully loaded from {MODEL_PATH}")
    except Exception as e:
        print(f"[STARTUP] Warning: Could not load model ({e}). Will need training.")
else:
    print(f"[STARTUP] Warning: Model file not found at {MODEL_PATH}")


def extract_rule_reasons(cleaned_url: str, host: str, is_phishing: bool, suggestions: list) -> list[str]:
    """
    Generate plain-language security observations based on URL structure and rules.
    """
    reasons = []

    # 1. IP address in host
    if url_utils.is_ip(host):
        reasons.append("Uses an IP address instead of a domain name")

    # 2. Known shortener
    if url_utils.is_shortened(host):
        reasons.append("Shortened link hides the real destination")

    # 3. Contains @
    if "@" in cleaned_url:
        reasons.append("Contains an @ symbol which can deceive browsers and users")

    # 4. Long URL
    if len(cleaned_url) > 75:
        reasons.append("Unusually long web address (over 75 characters)")

    # 5. Many subdomains
    host_parts = host.split(".")
    if len(host_parts) > 4:
        reasons.append("Contains many subdomains (more than 3)")

    # 6. Many hyphens in host
    if host.count("-") >= 2:
        reasons.append("Host contains multiple hyphens, often used to disguise brand names")

    # 7. Suspicious keywords
    url_lower = cleaned_url.lower()
    found_words = [w for w in features.SUSPICIOUS_WORDS if w in url_lower]
    if found_words:
        reasons.append(f"Contains security-sensitive words ({', '.join(found_words[:3])})")

    # 8. Non-standard port
    if re.search(r":\d{2,5}(/|$)", cleaned_url):
        reasons.append("Uses a non-standard port number")

    # 9. Typo-squatting / imitation of trusted brand
    if suggestions:
        reasons.append(f"Looks like a fake copy of a real site ({', '.join(suggestions)})")

    # Fallbacks if list is empty
    if is_phishing and not reasons:
        reasons.append("The address pattern is similar to known phishing links")
    elif not is_phishing and not reasons:
        reasons.append("No common phishing signs found")

    return reasons


def analyze_url(raw_url: str, fetch_summary: bool = True) -> dict:
    """
    Full security analysis pipeline for a single URL:
    1. Validation and normalization
    2. ML model inference
    3. Typo-domain detection
    4. Plain-language reason generation
    5. Optional safe website summarization (only for safe URLs)
    6. Database persistence
    """
    # Normalize URL (raises ValueError if invalid)
    clean_url = url_utils.clean_url(raw_url)
    host = url_utils.extract_host(clean_url)

    # Check for brand typosquatting suggestions
    suggestions = suggest.get_domain_suggestions(host)
    is_trusted = host in suggest.TRUSTED_DOMAINS

    # ML Model inference
    if model is not None:
        try:
            # Predict probabilities: Class 0 = safe, Class 1 = phishing
            probs = model.predict_proba([clean_url])[0]
            phishing_prob = float(probs[1])
        except Exception:
            phishing_prob = 0.5
    else:
        # Fallback if model binary is missing
        phishing_prob = 0.5

    # If the domain is an exact match for a trusted brand domain, it is legitimate
    if is_trusted:
        phishing_prob = min(phishing_prob, 0.05)
    # If it is a confirmed typosquat of a major trusted brand, treat as strong warning
    elif suggestions:
        phishing_prob = max(phishing_prob, 0.88)

    # Determine verdict and confidence
    if phishing_prob >= 0.5:
        result = "phishing"
        confidence = round(phishing_prob, 4)
    else:
        result = "safe"
        confidence = round(1.0 - phishing_prob, 4)

    # Safety score from 0 to 100
    safety_score = int(round((1.0 - phishing_prob) * 100))
    safety_score = max(0, min(100, safety_score))

    # Plain-language explanation reasons
    reasons = extract_rule_reasons(clean_url, host, result == "phishing", suggestions)

    # Website content summary (strictly for safe sites only)
    summary_data = None
    summary_note = ""
    if result == "phishing":
        summary_note = "We didn't open this site because it looks dangerous."
    elif fetch_summary:
        summary_data, summary_note = summary_module.fetch_and_summarize(clean_url)

    # Save scan to SQLite database
    try:
        db.save_scan(
            url=clean_url,
            result=result,
            confidence=confidence,
            safety_score=safety_score,
        )
    except Exception as e:
        print(f"[DB] Error saving scan: {e}")

    return {
        "url": clean_url,
        "result": result,
        "confidence": confidence,
        "safety_score": safety_score,
        "reasons": reasons,
        "suggestions": suggestions,
        "summary": summary_data,
        "summary_note": summary_note,
    }


# ==============================================================================
# HTTP ROUTES
# ==============================================================================

@app.route("/")
def index():
    """Serves the single-page web application."""
    return render_template("index.html")


@app.route("/health", methods=["GET"])
def health():
    """Healthcheck endpoint for Docker container checks and CI smoke tests."""
    return jsonify({"status": "ok"}), 200


@app.route("/predict", methods=["POST"])
def predict():
    """
    Scans a single URL.
    Request body: {"url": "..."}
    """
    data = request.get_json(silent=True) or {}
    url = data.get("url")

    if not url:
        return jsonify({"error": "Please enter a valid website address"}), 400

    try:
        result = analyze_url(url, fetch_summary=True)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return jsonify({"error": "An unexpected error occurred while analyzing the URL"}), 500


@app.route("/compare", methods=["POST"])
def compare():
    """
    Compares two URLs side by side without fetching website summaries.
    Request body: {"url_a": "...", "url_b": "..."}
    """
    data = request.get_json(silent=True) or {}
    url_a = data.get("url_a")
    url_b = data.get("url_b")

    if not url_a or not url_b:
        return jsonify({"error": "Please enter two valid website addresses to compare"}), 400

    try:
        res_a = analyze_url(url_a, fetch_summary=False)
        res_b = analyze_url(url_b, fetch_summary=False)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return jsonify({"error": "An error occurred while comparing the URLs"}), 500

    score_a = res_a["safety_score"]
    score_b = res_b["safety_score"]

    if abs(score_a - score_b) < 5:
        safer = "similar"
    elif score_a > score_b:
        safer = "a"
    else:
        safer = "b"

    note = ""
    if res_a["result"] == "phishing" and res_b["result"] == "phishing":
        note = "Neither website looks safe."

    return jsonify({
        "a": res_a,
        "b": res_b,
        "safer": safer,
        "note": note,
    }), 200


@app.route("/chat", methods=["POST"])
def chat():
    """
    Context-aware security assistant.
    Request body: {"question": "...", "scan": {...}}
    Uses Claude when ANTHROPIC_API_KEY is available, otherwise rule-based fallback.
    """
    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()
    scan = data.get("scan") or {}

    if not question:
        return jsonify({"error": "Please enter a question"}), 400
    if len(question) > 300:
        question = question[:300]

    if not scan or not isinstance(scan, dict):
        return jsonify({"error": "No scan context provided"}), 400

    url = scan.get("url", "the website")
    result = scan.get("result", "unknown")
    safety_score = scan.get("safety_score", 0)
    confidence = scan.get("confidence", 0)
    reasons = scan.get("reasons", [])

    # Check for Anthropic API key
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key:
        try:
            client = anthropic.Anthropic(api_key=api_key)
            system_prompt = (
                "You are JevShield's assistant. Explain phishing results in simple, plain English. "
                "Use ONLY the scan details provided. Never tell the user to open a link flagged as phishing. "
                "Keep answers short and beginner-friendly (2 to 3 sentences maximum)."
            )
            user_message = (
                f"Scan Details:\n"
                f"- URL: {url}\n"
                f"- Result: {result}\n"
                f"- Safety Score: {safety_score}/100\n"
                f"- Confidence: {confidence * 100:.1f}%\n"
                f"- Detected Reasons: {', '.join(reasons)}\n\n"
                f"User Question: {question}"
            )
            model_name = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-5-5")
            try:
                response = client.messages.create(
                    model=model_name,
                    max_tokens=300,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_message}],
                )
            except Exception:
                response = client.messages.create(
                    model="claude-3-5-haiku-20241022",
                    max_tokens=300,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_message}],
                )
            answer = response.content[0].text.strip()
            return jsonify({"answer": answer}), 200
        except Exception as e:
            print(f"[CHAT] Anthropic API failed ({e}), falling back to rule-based answers.")

    # Rule-based fallback answers
    q_lower = question.lower()
    if "why" in q_lower or "flag" in q_lower or "reason" in q_lower:
        if reasons:
            answer = f"This link was evaluated as {result} because: " + "; ".join(reasons) + "."
        else:
            answer = f"This link has characteristic patterns associated with {result} websites."
    elif "safe" in q_lower or "open" in q_lower or "click" in q_lower:
        if result == "phishing":
            answer = "No, this link was flagged as phishing and is dangerous to open. Do not click it or enter personal information."
        else:
            answer = "This link appears safe based on our automated checks, but always make sure the address bar matches before entering credentials."
    elif "what" in q_lower and ("do" in q_lower or "action" in q_lower or "now" in q_lower):
        if result == "phishing":
            answer = "1. Do not click or open the link. 2. Do not submit any login or personal details. 3. Delete or report the message."
        else:
            answer = "You can proceed to browse, but keep your browser updated and avoid submitting passwords over unsecured (HTTP) connections."
    else:
        answer = (
            f"JevShield evaluated {url} as {result} (safety score: {safety_score}/100). "
            f"Key observations: {', '.join(reasons)}."
        )

    return jsonify({"answer": answer}), 200


@app.route("/scan-image", methods=["POST"])
def scan_image():
    """
    Analyzes an uploaded screenshot for phishing indicators using Claude vision.
    The image is processed strictly in-memory and is never stored on disk.
    """
    if "image" not in request.files:
        return jsonify({"error": "Please select an image to upload"}), 400

    file = request.files["image"]
    if not file or not file.filename:
        return jsonify({"error": "Please select a valid image file"}), 400

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ("png", "jpg", "jpeg", "webp"):
        return jsonify({"error": "Only PNG, JPG, and WEBP images are supported"}), 400

    # Read image into memory
    image_bytes = file.read()
    if len(image_bytes) > 5 * 1024 * 1024:
        return jsonify({"error": "Image file is too large (maximum allowed size is 5 MB)"}), 400

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return jsonify({
            "error": "Screenshot analysis requires an Anthropic API key. Please check text links instead."
        }), 503

    media_map = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
    }
    media_type = media_map.get(ext, "image/png")
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    prompt = (
        "You are an expert cybersecurity visual analyst for JevShield. "
        "Examine this screenshot carefully for phishing signs: fake login forms, copied brand logos, "
        "urgent security threats, deceptive design, grammatical mistakes, or suspicious addresses.\n"
        "Reply ONLY with a raw JSON object formatted as follows:\n"
        '{"result": "phishing" or "safe", "confidence": 0.0 to 1.0, "reasons": ["short reason 1", "short reason 2"], "url_seen": "extracted URL string or null"}\n'
        "Do not include markdown fences or any other text outside the JSON."
    )

    try:
        client = anthropic.Anthropic(api_key=api_key)
        model_name = os.environ.get("ANTHROPIC_VISION_MODEL", "claude-sonnet-5-5")
        try:
            response = client.messages.create(
                model=model_name,
                max_tokens=500,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_b64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }],
            )
        except Exception:
            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=500,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_b64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }],
            )

        content = response.content[0].text.strip()
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)

        parsed_vision = json.loads(content)
        img_result = parsed_vision.get("result", "safe").lower()
        img_conf = float(parsed_vision.get("confidence", 0.5))
        img_reasons = parsed_vision.get("reasons", [])
        url_seen = parsed_vision.get("url_seen")

        # If a URL was clearly visible in the image, also run text URL analysis
        final_result = img_result
        final_conf = img_conf
        final_reasons = list(img_reasons)
        suggestions = []

        if url_seen and isinstance(url_seen, str) and "." in url_seen:
            try:
                url_scan = analyze_url(url_seen, fetch_summary=False)
                suggestions = url_scan.get("suggestions", [])
                if url_scan["result"] == "phishing":
                    final_result = "phishing"
                    final_conf = max(final_conf, url_scan["confidence"])
                    final_reasons.extend(url_scan["reasons"])
            except Exception:
                pass

        safety_score = int(round((1.0 - final_conf if final_result == "phishing" else final_conf) * 100))
        if final_result == "phishing":
            safety_score = min(safety_score, 25)
        else:
            safety_score = max(safety_score, 75)

        # Save record in database with "screenshot" label
        try:
            db.save_scan(
                url="screenshot",
                result=final_result,
                confidence=final_conf,
                safety_score=safety_score,
            )
        except Exception:
            pass

        return jsonify({
            "url": url_seen or "screenshot",
            "result": final_result,
            "confidence": round(final_conf, 4),
            "safety_score": safety_score,
            "reasons": final_reasons if final_reasons else ["Screenshot visual inspection completed"],
            "suggestions": suggestions,
            "summary": None,
            "summary_note": "",
            "note": "Image analysis is a best guess. Always check the address bar.",
        }), 200

    except Exception:
        return jsonify({"error": "Failed to analyze image content"}), 500


@app.route("/history", methods=["GET"])
def history():
    """Returns the last 10 scans, newest first."""
    try:
        scans = db.get_recent_scans(limit=10)
        return jsonify(scans), 200
    except Exception:
        return jsonify([]), 200


# Application entry point for development
if __name__ == "__main__":
    # debug=False as specified
    app.run(host="0.0.0.0", port=5000, debug=False)
