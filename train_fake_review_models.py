#!/usr/bin/env python3
"""Train leakage-aware fake-review text and behavior models from the supplied CSV."""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC
from sklearn.feature_extraction.text import TfidfVectorizer


RANDOM_SEED = 42
REQUIRED_COLUMNS = {
    "asin",
    "reviewer_id",
    "review_title",
    "review_text",
    "review_rating",
    "review_date",
    "reviewer_classified_fake",
    "reviewer_classified_honest",
}
BEHAVIOR_FEATURES = [
    "review_rating_numeric",
    "review_year",
    "review_month",
    "review_day_of_week",
    "review_day_of_year",
    "reviewer_prior_review_count",
    "reviewer_prior_mean_rating",
    "reviewer_prior_unique_related",
    "reviewer_days_since_prior_review",
    "product_prior_review_count",
    "product_prior_mean_rating",
    "product_prior_unique_related",
    "product_days_since_prior_review",
]
INPUT_COLUMNS = [
    "asin",
    "reviewer_id",
    "review_title",
    "review_text",
    "review_rating",
    "review_date",
    "reviewer_classified_fake",
    "reviewer_classified_honest",
]


def inspect_missing_values(csv_path: Path, chunksize: int = 50_000) -> dict[str, Any]:
    """Count blank cells in every CSV column without loading the full file at once."""
    missing: dict[str, int] | None = None
    row_count = 0
    column_names: list[str] = []
    for chunk in pd.read_csv(
        csv_path,
        dtype="string",
        keep_default_na=False,
        chunksize=chunksize,
    ):
        if missing is None:
            column_names = list(chunk.columns)
            missing = dict.fromkeys(column_names, 0)
            absent = sorted(REQUIRED_COLUMNS - set(column_names))
            if absent:
                raise ValueError(f"Dataset is missing required columns: {absent}")
        row_count += len(chunk)
        for column in column_names:
            missing[column] += int(chunk[column].str.strip().eq("").sum())
    if missing is None:
        raise ValueError(f"The dataset is empty: {csv_path}")
    return {
        "row_count": row_count,
        "column_count": len(column_names),
        "missing_counts": missing,
        "missing_percent": {
            column: round(count / row_count * 100, 4)
            for column, count in missing.items()
        },
    }


def load_dataset(csv_path: Path) -> pd.DataFrame:
    frame = pd.read_csv(
        csv_path,
        usecols=INPUT_COLUMNS,
        dtype="string",
        keep_default_na=False,
    )
    for column in INPUT_COLUMNS:
        frame[column] = frame[column].str.strip()

    fake = frame["reviewer_classified_fake"].eq("True")
    honest = frame["reviewer_classified_honest"].eq("True")
    if (fake & honest).any():
        raise ValueError(
            "Some rows are marked as both fake and honest; resolve conflicting labels."
        )

    labeled = fake | honest
    if not labeled.any():
        raise ValueError("No rows have an explicit fake or honest reviewer label.")

    labeled_frame = frame.loc[labeled].copy()
    labeled_frame["target"] = fake.loc[labeled].astype(np.int8).to_numpy()

    inconsistent = labeled_frame.groupby("reviewer_id", sort=False)["target"].nunique()
    if inconsistent.gt(1).any():
        raise ValueError(
            "A reviewer has conflicting labels; reviewer-grouped evaluation is unsafe."
        )

    labeled_frame["review_title"] = clean_text(labeled_frame["review_title"])
    labeled_frame["review_text"] = clean_text(labeled_frame["review_text"])
    labeled_frame["review_rating_numeric"] = pd.to_numeric(
        labeled_frame["review_rating"], errors="coerce"
    )
    labeled_frame["parsed_date"] = pd.to_datetime(
        labeled_frame["review_date"], errors="coerce", format="mixed"
    )
    return frame, labeled_frame


def clean_text(values: pd.Series) -> pd.Series:
    def normalize(value: str) -> str:
        text = unicodedata.normalize("NFKC", value)
        return re.sub(r"\s+", " ", text).strip()

    return values.fillna("").astype(str).map(normalize)


def _entity_history(
    frame: pd.DataFrame,
    entity_column: str,
    related_column: str,
    prefix: str,
) -> pd.DataFrame:
    valid = frame.loc[
        frame["parsed_date"].notna()
        & frame[entity_column].ne("")
        & frame[related_column].ne(""),
        [entity_column, related_column, "parsed_date", "review_rating_numeric"],
    ]
    daily = (
        valid.groupby(
            [entity_column, "parsed_date"],
            as_index=False,
            sort=False,
            observed=True,
        )
        .agg(
            current_review_count=("review_rating_numeric", "size"),
            current_rating_sum=("review_rating_numeric", "sum"),
            current_rated_count=("review_rating_numeric", "count"),
        )
        .sort_values([entity_column, "parsed_date"], kind="mergesort")
    )

    # Count related IDs only at their first observed date for this entity.
    first_seen = (
        valid.groupby([entity_column, related_column], sort=False, observed=True)[
            "parsed_date"
        ]
        .min()
        .reset_index()
    )
    new_related = (
        first_seen.groupby(
            [entity_column, "parsed_date"], sort=False, observed=True
        )
        .size()
        .rename("new_related_count")
        .reset_index()
    )
    daily = daily.merge(
        new_related,
        on=[entity_column, "parsed_date"],
        how="left",
        validate="one_to_one",
    )
    daily["new_related_count"] = daily["new_related_count"].fillna(0)

    grouped = daily.groupby(entity_column, sort=False, observed=True)
    daily[f"{prefix}_prior_review_count"] = (
        grouped["current_review_count"].cumsum() - daily["current_review_count"]
    )
    prior_rating_sum = (
        grouped["current_rating_sum"].cumsum() - daily["current_rating_sum"]
    )
    prior_rated_count = (
        grouped["current_rated_count"].cumsum() - daily["current_rated_count"]
    )
    daily[f"{prefix}_prior_mean_rating"] = (
        prior_rating_sum / prior_rated_count.replace(0, np.nan)
    )
    daily[f"{prefix}_prior_unique_related"] = (
        grouped["new_related_count"].cumsum() - daily["new_related_count"]
    )
    daily[f"{prefix}_days_since_prior_review"] = (
        grouped["parsed_date"].diff().dt.total_seconds() / 86_400
    )
    return daily[
        [
            entity_column,
            "parsed_date",
            f"{prefix}_prior_review_count",
            f"{prefix}_prior_mean_rating",
            f"{prefix}_prior_unique_related",
            f"{prefix}_days_since_prior_review",
        ]
    ]


def add_behavior_features(
    all_rows: pd.DataFrame, labeled_rows: pd.DataFrame
) -> pd.DataFrame:
    """Build timestamp-causal history features using metadata only, never labels."""
    history_source = all_rows.copy()
    history_source["review_rating_numeric"] = pd.to_numeric(
        history_source["review_rating"], errors="coerce"
    )
    history_source["parsed_date"] = pd.to_datetime(
        history_source["review_date"], errors="coerce", format="mixed"
    )
    result = labeled_rows.copy()
    result["review_year"] = result["parsed_date"].dt.year
    result["review_month"] = result["parsed_date"].dt.month
    result["review_day_of_week"] = result["parsed_date"].dt.day_of_week
    result["review_day_of_year"] = result["parsed_date"].dt.day_of_year

    reviewer_history = _entity_history(
        history_source, "reviewer_id", "asin", "reviewer"
    )
    product_history = _entity_history(
        history_source, "asin", "reviewer_id", "product"
    )
    result = result.merge(
        reviewer_history,
        on=["reviewer_id", "parsed_date"],
        how="left",
        validate="many_to_one",
    )
    result = result.merge(
        product_history,
        on=["asin", "parsed_date"],
        how="left",
        validate="many_to_one",
    )
    return result


def make_text_pipeline(classifier: Any, seed: int) -> Pipeline:
    vectorizers = ColumnTransformer(
        transformers=[
            (
                "title",
                TfidfVectorizer(
                    ngram_range=(1, 2),
                    min_df=2,
                    max_features=20_000,
                    sublinear_tf=True,
                    strip_accents="unicode",
                    dtype=np.float32,
                ),
                "review_title",
            ),
            (
                "body",
                TfidfVectorizer(
                    ngram_range=(1, 2),
                    min_df=2,
                    max_features=120_000,
                    sublinear_tf=True,
                    strip_accents="unicode",
                    dtype=np.float32,
                ),
                "review_text",
            ),
        ],
        remainder="drop",
    )
    return Pipeline(
        [
            ("tfidf", vectorizers),
            ("classifier", classifier),
        ]
    )


def make_behavior_pipeline(seed: int) -> Pipeline:
    return Pipeline(
        [
            ("imputer", SimpleImputer(strategy="median")),
            (
                "classifier",
                RandomForestClassifier(
                    n_estimators=300,
                    min_samples_leaf=3,
                    max_features="sqrt",
                    class_weight="balanced_subsample",
                    random_state=seed,
                    n_jobs=-1,
                ),
            ),
        ]
    )


def classification_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, Any]:
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision_fake": float(
            precision_score(y_true, y_pred, pos_label=1, zero_division=0)
        ),
        "recall_fake": float(recall_score(y_true, y_pred, pos_label=1, zero_division=0)),
        "f1_fake": float(f1_score(y_true, y_pred, pos_label=1, zero_division=0)),
        "confusion_matrix": confusion_matrix(
            y_true, y_pred, labels=[0, 1]
        ).tolist(),
    }


def split_by_reviewer(
    features: pd.DataFrame, target: np.ndarray, groups: pd.Series, seed: int
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    splitter = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=seed)
    fold_number = np.full(len(features), -1, dtype=np.int8)
    for fold, (_, held_out) in enumerate(
        splitter.split(features, target, groups=groups)
    ):
        fold_number[held_out] = fold
    if (fold_number < 0).any():
        raise RuntimeError("Stratified grouped splitting failed to assign all rows.")
    train = np.flatnonzero(fold_number >= 2)
    validation = np.flatnonzero(fold_number == 1)
    test = np.flatnonzero(fold_number == 0)
    if not all(len(indices) for indices in (train, validation, test)):
        raise RuntimeError("The grouped train/validation/test split is empty.")

    reviewer_sets = [
        set(groups.iloc[indices])
        for indices in (train, validation, test)
    ]
    if (
        reviewer_sets[0] & reviewer_sets[1]
        or reviewer_sets[0] & reviewer_sets[2]
        or reviewer_sets[1] & reviewer_sets[2]
    ):
        raise RuntimeError("Reviewer IDs overlap across data splits.")
    return train, validation, test


def _predict_binary_probabilities(model: Pipeline, data: pd.DataFrame) -> np.ndarray:
    return model.predict_proba(data)[:, 1]


def _metrics_for_probabilities(
    target: np.ndarray, probabilities: np.ndarray, threshold: float = 0.5
) -> dict[str, Any]:
    return classification_metrics(target, (probabilities >= threshold).astype(np.int8))


def run_training(
    csv_path: Path, output_dir: Path, seed: int = RANDOM_SEED
) -> dict[str, Any]:
    started = time.time()
    print(f"Inspecting all columns in {csv_path} ...", flush=True)
    inspection = inspect_missing_values(csv_path)
    print(
        f"Dataset: {inspection['row_count']:,} rows, "
        f"{inspection['column_count']} columns",
        flush=True,
    )
    print("Missing values by column:", flush=True)
    for column, count in inspection["missing_counts"].items():
        if count:
            print(
                f"  {column}: {count:,} "
                f"({inspection['missing_percent'][column]:.2f}%)",
                flush=True,
            )

    print("Loading model input columns and resolving explicit labels ...", flush=True)
    all_rows, labeled_rows = load_dataset(csv_path)
    y = labeled_rows["target"].to_numpy(dtype=np.int8)
    class_counts = {
        "genuine": int((y == 0).sum()),
        "fake": int((y == 1).sum()),
    }
    print(
        f"Labeled cohort: {len(y):,} rows; "
        f"{class_counts['fake']:,} fake, {class_counts['genuine']:,} genuine",
        flush=True,
    )

    print(
        "Building reviewer/product history features from earlier dates only ...",
        flush=True,
    )
    model_rows = add_behavior_features(all_rows, labeled_rows)
    y = model_rows["target"].to_numpy(dtype=np.int8)
    text_features = model_rows[["review_title", "review_text"]]
    behavior_features = model_rows[BEHAVIOR_FEATURES]
    groups = model_rows["reviewer_id"].reset_index(drop=True)
    text_features = text_features.reset_index(drop=True)
    behavior_features = behavior_features.reset_index(drop=True)

    train_idx, validation_idx, test_idx = split_by_reviewer(
        model_rows, y, groups, seed
    )
    split_sizes = {
        "train": int(len(train_idx)),
        "validation": int(len(validation_idx)),
        "test": int(len(test_idx)),
    }
    print(
        "Group split by reviewer: "
        f"train={len(train_idx):,}, validation={len(validation_idx):,}, "
        f"test={len(test_idx):,}",
        flush=True,
    )

    logistic = make_text_pipeline(
        LogisticRegression(
            max_iter=1_000,
            class_weight="balanced",
            solver="liblinear",
            random_state=seed,
        ),
        seed,
    )
    linear_svm = make_text_pipeline(
        LinearSVC(
            class_weight="balanced",
            random_state=seed,
            dual="auto",
            max_iter=5_000,
        ),
        seed,
    )
    behavior = make_behavior_pipeline(seed)
    print("Fitting validation models ...", flush=True)
    for name, model, inputs in (
        ("TF-IDF + Logistic Regression", logistic, text_features),
        ("TF-IDF + Linear SVM", linear_svm, text_features),
        ("Behavior + Random Forest", behavior, behavior_features),
    ):
        print(f"  {name}", flush=True)
        model.fit(inputs.iloc[train_idx], y[train_idx])

    validation_target = y[validation_idx]
    val_logistic = _predict_binary_probabilities(
        logistic, text_features.iloc[validation_idx]
    )
    val_svm = linear_svm.predict(text_features.iloc[validation_idx])
    val_behavior = _predict_binary_probabilities(
        behavior, behavior_features.iloc[validation_idx]
    )
    validation_metrics = {
        "tfidf_logistic_regression": classification_metrics(
            validation_target, (val_logistic >= 0.5).astype(np.int8)
        ),
        "tfidf_linear_svm": classification_metrics(validation_target, val_svm),
        "behavior_random_forest": _metrics_for_probabilities(
            validation_target, val_behavior
        ),
    }

    blend_candidates: list[tuple[float, float]] = []
    for weight in np.arange(0.1, 1.0, 0.1):
        blend_probability = weight * val_logistic + (1.0 - weight) * val_behavior
        blend_score = f1_score(
            validation_target,
            (blend_probability >= 0.5).astype(np.int8),
            pos_label=1,
            zero_division=0,
        )
        blend_candidates.append((float(blend_score), float(weight)))
    best_blend_f1, best_blend_weight = max(blend_candidates)
    validation_metrics["text_behavior_combined"] = classification_metrics(
        validation_target,
        (
            best_blend_weight * val_logistic
            + (1.0 - best_blend_weight) * val_behavior
            >= 0.5
        ).astype(np.int8),
    )
    validation_metrics["text_behavior_combined"]["text_probability_weight"] = (
        best_blend_weight
    )

    best_text_name = max(
        ("tfidf_logistic_regression", "tfidf_linear_svm"),
        key=lambda name: validation_metrics[name]["f1_fake"],
    )
    validation_candidates = {
        "tfidf_logistic_regression": validation_metrics[
            "tfidf_logistic_regression"
        ]["f1_fake"],
        "tfidf_linear_svm": validation_metrics["tfidf_linear_svm"]["f1_fake"],
        "behavior_random_forest": validation_metrics["behavior_random_forest"][
            "f1_fake"
        ],
        "text_behavior_combined": best_blend_f1,
    }
    selected_model_name = max(
        validation_candidates, key=validation_candidates.get
    )
    print(
        f"Validation-selected model: {selected_model_name} "
        f"(fake-class F1={validation_candidates[selected_model_name]:.4f})",
        flush=True,
    )

    final_train_idx = np.concatenate((train_idx, validation_idx))
    print("Refitting models on train + validation data ...", flush=True)
    final_logistic = make_text_pipeline(
        LogisticRegression(
            max_iter=1_000,
            class_weight="balanced",
            solver="liblinear",
            random_state=seed,
        ),
        seed,
    )
    final_svm = make_text_pipeline(
        LinearSVC(
            class_weight="balanced",
            random_state=seed,
            dual="auto",
            max_iter=5_000,
        ),
        seed,
    )
    final_behavior = make_behavior_pipeline(seed)
    final_logistic.fit(text_features.iloc[final_train_idx], y[final_train_idx])
    final_svm.fit(text_features.iloc[final_train_idx], y[final_train_idx])
    final_behavior.fit(
        behavior_features.iloc[final_train_idx], y[final_train_idx]
    )

    test_target = y[test_idx]
    test_logistic = _predict_binary_probabilities(
        final_logistic, text_features.iloc[test_idx]
    )
    test_svm = final_svm.predict(text_features.iloc[test_idx])
    test_behavior = _predict_binary_probabilities(
        final_behavior, behavior_features.iloc[test_idx]
    )
    test_combined = (
        best_blend_weight * test_logistic
        + (1.0 - best_blend_weight) * test_behavior
    )
    test_results = {
        "tfidf_logistic_regression": classification_metrics(
            test_target, (test_logistic >= 0.5).astype(np.int8)
        ),
        "tfidf_linear_svm": classification_metrics(test_target, test_svm),
        "behavior_random_forest": _metrics_for_probabilities(
            test_target, test_behavior
        ),
        "text_behavior_combined": _metrics_for_probabilities(
            test_target, test_combined
        ),
    }

    if selected_model_name == "tfidf_logistic_regression":
        best_pipeline: Any = final_logistic
        artifact = {"model": final_logistic}
    elif selected_model_name == "tfidf_linear_svm":
        best_pipeline = final_svm
        artifact = {"model": final_svm}
    elif selected_model_name == "behavior_random_forest":
        best_pipeline = final_behavior
        artifact = {"model": final_behavior}
    else:
        best_pipeline = None
        artifact = {
            "text_model": final_logistic,
            "behavior_model": final_behavior,
            "text_probability_weight": best_blend_weight,
            "behavior_probability_weight": 1.0 - best_blend_weight,
        }

    test_results["validation_selected_model"] = test_results[selected_model_name]
    best_text_test_f1 = test_results[best_text_name]["f1_fake"]
    combined_test_f1 = test_results["text_behavior_combined"]["f1_fake"]
    report: dict[str, Any] = {
        "dataset": {
            "path": str(csv_path.resolve()),
            "rows": inspection["row_count"],
            "columns": inspection["column_count"],
            "missing_counts": inspection["missing_counts"],
            "missing_percent": inspection["missing_percent"],
        },
        "label_definition": {
            "source": [
                "reviewer_classified_fake",
                "reviewer_classified_honest",
            ],
            "positive_class": "fake",
            "negative_class": "genuine",
            "excluded_unlabeled_rows": int(inspection["row_count"] - len(y)),
            "labeled_rows": int(len(y)),
            "class_counts": class_counts,
            "note": (
                "Rows with neither reviewer classification flag are unlabeled and "
                "were excluded, not treated as genuine."
            ),
        },
        "preprocessing": {
            "text": (
                "Unicode NFKC normalization, whitespace normalization, then separate "
                "title/body TF-IDF (lowercase, Unicode accent stripping, unigrams "
                "and bigrams, min_df=2)."
            ),
            "behavior_features": BEHAVIOR_FEATURES,
            "history_rule": (
                "Reviewer/product history uses only strictly earlier calendar dates; "
                "same-day rows do not contribute to each other's history."
            ),
            "excluded_predictors": [
                "reviewer_id",
                "asin",
                "all label columns",
            ],
        },
        "evaluation": {
            "seed": seed,
            "split": (
                "StratifiedGroupKFold with 5 folds: fold 0 test, fold 1 validation, "
                "folds 2-4 training; reviewer IDs are disjoint."
            ),
            "split_sizes": split_sizes,
            "validation_metrics": validation_metrics,
            "validation_selected_model": selected_model_name,
            "best_text_model_by_validation_f1": best_text_name,
            "combined_text_probability_weight": best_blend_weight,
            "test_metrics": test_results,
            "combined_f1_improvement_over_best_text": float(
                combined_test_f1 - best_text_test_f1
            ),
            "combined_improves_f1_over_best_text": bool(
                combined_test_f1 > best_text_test_f1
            ),
            "positive_class": "fake",
            "confusion_matrix_order": [
                ["true_genuine_pred_genuine", "true_genuine_pred_fake"],
                ["true_fake_pred_genuine", "true_fake_pred_fake"],
            ],
        },
        "software": {
            "python": sys.version.split()[0],
            "pandas": pd.__version__,
            "scikit_learn": sklearn.__version__,
            "numpy": np.__version__,
        },
        "elapsed_seconds": round(time.time() - started, 2),
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = output_dir / "best_fake_review_model.joblib"
    artifact.update(
        {
            "model_name": selected_model_name,
            "label_mapping": {0: "genuine", 1: "fake"},
            "behavior_feature_columns": BEHAVIOR_FEATURES,
            "text_input_columns": ["review_title", "review_text"],
            "selected_model_is_pipeline": best_pipeline is not None,
            "preprocessing_note": (
                "Text TF-IDF and behavior imputation are included in the saved "
                "scikit-learn pipelines. Reviewer/product history columns must be "
                "generated by the timestamp-causal feature procedure in this script."
            ),
        }
    )
    joblib.dump(artifact, artifact_path, compress=3)
    report_path = output_dir / "model_evaluation.json"
    report_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print("\nHeld-out test metrics (positive class: fake):", flush=True)
    for name, metrics in test_results.items():
        if name == "validation_selected_model":
            continue
        print(
            f"  {name}: accuracy={metrics['accuracy']:.4f}, "
            f"precision={metrics['precision_fake']:.4f}, "
            f"recall={metrics['recall_fake']:.4f}, "
            f"F1={metrics['f1_fake']:.4f}, "
            f"confusion_matrix={metrics['confusion_matrix']}",
            flush=True,
        )
    print(
        f"Combination vs validation-selected text model F1 change: "
        f"{combined_test_f1 - best_text_test_f1:+.4f}",
        flush=True,
    )
    print(f"Validation-selected model: {selected_model_name}", flush=True)
    print(f"Saved model: {artifact_path.resolve()}", flush=True)
    print(f"Saved evaluation: {report_path.resolve()}", flush=True)
    print(f"Elapsed: {report['elapsed_seconds']:.1f} seconds", flush=True)
    return report


def parse_args() -> argparse.Namespace:
    project_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(
        description="Compare leakage-aware fake-review text and behavior models."
    )
    parser.add_argument(
        "--data",
        type=Path,
        default=project_dir / "public_reviews_dataset_cleaned.csv",
        help="Path to the supplied CSV dataset.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=project_dir / "artifacts",
        help="Directory for the Joblib model and JSON metrics.",
    )
    parser.add_argument("--seed", type=int, default=RANDOM_SEED)
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    if not arguments.data.is_file():
        raise FileNotFoundError(f"Dataset file not found: {arguments.data}")
    run_training(arguments.data, arguments.output_dir, arguments.seed)

    
