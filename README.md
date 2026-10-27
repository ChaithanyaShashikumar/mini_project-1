# Fake-review model training

This project trains and compares text and behavior models using the supplied
`public_reviews_dataset_cleaned.csv`. It does not modify or integrate a website
and does not use blockchain.

## Labels and leakage controls

- The dataset contains `reviewer_classified_fake` and
  `reviewer_classified_honest`. A row marked fake is the positive class; a row
  marked honest is the negative class.
- Rows with neither flag are unlabeled, not assumed genuine, and are excluded
  from supervised training and evaluation.
- The target is assigned at reviewer level in this dataset. The script checks
  this and keeps each `reviewer_id` in exactly one train, validation, or test
  partition. The split is stratified and reviewer-grouped.
- Reviewer and product IDs are not direct model inputs. They are used to
  construct behavior history features, using only data from strictly earlier
  calendar dates. Same-day reviews do not contribute to each other's history.
- Label-related columns and campaign fields are not used as predictors.
- Validation selects the model and the text/behavior blend weight. The held-out
  test partition is used only for the final comparison.

The dataset's `fake_review_product` field is product-level and is not treated
as an individual review label. The separate reviewer classification flags
provide the explicit fake/genuine cohort.

## Requirements

Python 3.10 or newer is recommended. On Windows, open PowerShell in this
folder and run:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

## Run

With the CSV beside the script:

```powershell
python .\train_fake_review_models.py
```

Or pass explicit paths:

```powershell
python .\train_fake_review_models.py `
  --data .\public_reviews_dataset_cleaned.csv `
  --output-dir .\artifacts `
  --seed 42
```

The script first scans the CSV in chunks to report missing values across all
columns, then preprocesses labeled rows and trains:

1. TF-IDF + Logistic Regression
2. TF-IDF + Linear SVM
3. Timestamp-causal behavior features + Random Forest
4. A validation-tuned probability blend of the logistic-regression and
   behavior models

For each model, the held-out test report includes accuracy, fake-class
precision/recall/F1, and a confusion matrix ordered as
`[[true genuine, predicted genuine/fake], [true fake, predicted genuine/fake]]`.

## Outputs

- `artifacts/best_fake_review_model.joblib` — validation-selected model
  pipeline(s), including TF-IDF or behavior imputation preprocessing.
- `artifacts/model_evaluation.json` — dataset missingness, label counts,
  validation/test metrics, confusion matrices, selected model, and whether the
  blend improved test F1 over the validation-selected text baseline.

The saved behavior pipeline expects the behavior columns named in the artifact;
those history columns must be produced by the timestamp-causal procedure in
`train_fake_review_models.py` before inference.
"# MiniProject" 
