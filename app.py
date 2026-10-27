"""We-Review Fake Review Detection — Flask API.

Loads the pre-trained model from artifacts/best_fake_review_model.joblib
and exposes health-check and prediction endpoints.
"""

from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "artifacts" / "best_fake_review_model.joblib"
EVALUATION_PATH = BASE_DIR / "artifacts" / "model_evaluation.json"

# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------
app = Flask(__name__)

# ---------------------------------------------------------------------------
# Model loading (runs once at startup — no retraining)
# ---------------------------------------------------------------------------
_artifact: dict | None = None
_load_time: float | None = None
_evaluation: dict | None = None


def _load_model() -> dict:
    """Load the saved model artifact from disk. Raises if the file is missing."""
    global _artifact, _load_time, _evaluation

    if not MODEL_PATH.is_file():
        raise FileNotFoundError(
            f"Trained model not found at {MODEL_PATH}. "
            "Run train_fake_review_models.py first."
        )

    print(f"Loading model from {MODEL_PATH} ...", flush=True)
    start = time.time()
    _artifact = joblib.load(MODEL_PATH)
    _load_time = round(time.time() - start, 3)
    print(f"Model loaded in {_load_time}s — type: {_artifact['model_name']}", flush=True)

    if EVALUATION_PATH.is_file():
        _evaluation = json.loads(EVALUATION_PATH.read_text(encoding="utf-8"))
        print("Evaluation metrics loaded.", flush=True)

    return _artifact


_load_model()


def clean_text_value(value: str | None) -> str:
    """Normalize text matching training preprocessing (NFKC, whitespace trim)."""
    if value is None:
        return ""
    text = unicodedata.normalize("NFKC", str(value))
    return re.sub(r"\s+", " ", text).strip()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    """Health-check endpoint. Returns model metadata and API status."""
    model_info = {
        "model_name": _artifact["model_name"],
        "label_mapping": _artifact["label_mapping"],
        "text_input_columns": _artifact["text_input_columns"],
        "behavior_feature_columns": _artifact["behavior_feature_columns"],
        "is_combined_model": not _artifact["selected_model_is_pipeline"],
    }

    if not _artifact["selected_model_is_pipeline"]:
        model_info["text_probability_weight"] = _artifact["text_probability_weight"]
        model_info["behavior_probability_weight"] = _artifact[
            "behavior_probability_weight"
        ]

    test_summary = None
    if _evaluation is not None:
        selected = _evaluation["evaluation"]["test_metrics"].get(
            "validation_selected_model", {}
        )
        test_summary = {
            "accuracy": selected.get("accuracy"),
            "precision_fake": selected.get("precision_fake"),
            "recall_fake": selected.get("recall_fake"),
            "f1_fake": selected.get("f1_fake"),
            "labeled_rows_used": _evaluation["label_definition"]["labeled_rows"],
        }

    return jsonify(
        {
            "status": "healthy",
            "api": "We-Review Fake Review Detection",
            "model_load_time_seconds": _load_time,
            "model": model_info,
            "test_metrics": test_summary,
            "python_version": sys.version.split()[0],
        }
    )


@app.route("/predict", methods=["POST"])
def predict():
    """Predict whether a review is fake or genuine using text and/or behavior features."""
    if not request.is_json:
        return (
            jsonify({"error": "Invalid request: Content-Type must be application/json"}),
            400,
        )

    payload = request.get_json(silent=True)
    if payload is None or not isinstance(payload, dict):
        return jsonify({"error": "Invalid JSON body: Expected a JSON object"}), 400

    required_behavior_fields = _artifact["behavior_feature_columns"]

    # Validate review text/title fields
    review_text = payload.get("review_text")
    review_title = payload.get("review_title", "")

    if review_text is None or not isinstance(review_text, str) or not review_text.strip():
        return (
            jsonify(
                {
                    "error": "Validation error: 'review_text' is required and must be a non-empty string."
                }
            ),
            400,
        )

    if review_title is not None and not isinstance(review_title, str):
        return (
            jsonify({"error": "Validation error: 'review_title' must be a string if provided."}),
            400,
        )

    # Validate required behavior features
    missing_fields = [f for f in required_behavior_fields if f not in payload]
    if missing_fields:
        return (
            jsonify(
                {
                    "error": f"Missing required behavior features: {missing_fields}",
                    "required_behavior_features": required_behavior_fields,
                }
            ),
            400,
        )

    behavior_values = {}
    invalid_numeric_fields = []
    for field in required_behavior_fields:
        val = payload[field]
        if val is None or val == "":
            behavior_values[field] = np.nan
        else:
            try:
                behavior_values[field] = float(val)
            except (ValueError, TypeError):
                invalid_numeric_fields.append(field)

    if invalid_numeric_fields:
        return (
            jsonify(
                {
                    "error": (
                        "Invalid numerical values for behavior features: "
                        f"{invalid_numeric_fields}. Expected float, int, or null."
                    )
                }
            ),
            400,
        )

    # Prepare DataFrame inputs matching pipeline expectations
    text_df = pd.DataFrame(
        [
            {
                "review_title": clean_text_value(review_title),
                "review_text": clean_text_value(review_text),
            }
        ]
    )
    behavior_df = pd.DataFrame([behavior_values], columns=required_behavior_fields)

    # Generate predictions according to model configuration
    model_name = _artifact.get("model_name", "unknown")
    if not _artifact["selected_model_is_pipeline"]:
        text_model = _artifact["text_model"]
        behavior_model = _artifact["behavior_model"]
        w_text = float(_artifact.get("text_probability_weight", 0.5))
        w_behavior = float(_artifact.get("behavior_probability_weight", 0.5))

        p_fake_text = float(text_model.predict_proba(text_df)[0, 1])
        p_fake_behavior = float(behavior_model.predict_proba(behavior_df)[0, 1])
        fake_prob = float(w_text * p_fake_text + w_behavior * p_fake_behavior)
        details = {
            "text_fake_probability": round(p_fake_text, 4),
            "behavior_fake_probability": round(p_fake_behavior, 4),
            "text_weight": w_text,
            "behavior_weight": w_behavior,
        }
    else:
        pipeline = _artifact["model"]
        if "behavior" in model_name:
            fake_prob = float(pipeline.predict_proba(behavior_df)[0, 1])
        else:
            fake_prob = float(pipeline.predict_proba(text_df)[0, 1])
        details = {}

    # If genuine probability is 40% or above (fake_prob <= 0.60), classify as genuine.
    # Only tag as fake when fake confidence is high (> 60%).
    predicted_label = "fake" if fake_prob > 0.60 else "genuine"

    return jsonify(
        {
            "prediction": predicted_label,
            "fake_probability": round(fake_prob, 4),
            "genuine_probability": round(1.0 - fake_prob, 4),
            "model_used": model_name,
            "details": details,
        }
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("\n=== We-Review API ===", flush=True)
    print("Health check:  http://127.0.0.1:5000/health", flush=True)
    print("Prediction:    POST http://127.0.0.1:5000/predict", flush=True)
    print("Press Ctrl+C to stop.\n", flush=True)
    app.run(host="127.0.0.1", port=5000, debug=True)
