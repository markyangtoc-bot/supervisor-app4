# Question Card Images

Put manually cropped question-card images in this folder.

## Rules

- Use the exact filename from `data/question_image_manifest.csv`.
- One file can serve multiple questions if they share the same `image_asset_filename`.
- Keep the original file extension from the manifest.
- Prefer clean crops with minimal surrounding whitespace.
- If a crop hint exists, use it as a starting point rather than a strict rule.

## Source Of Truth

- Manifest CSV: `../../data/question_image_manifest.csv`
- Manifest JSON: `../../data/question_image_manifest.json`
- Validation script: `../../scripts/validate_question_images.py`

## Quick Check

```bash
python scripts/validate_question_images.py
```
