import json
from pathlib import Path

import pandas as pd


# =========================================================
# Configuration
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent

PROCESSED_DIR = BASE_DIR / "data" / "processed"
OUTPUT_FILE = PROCESSED_DIR / "dashboard.json"


# =========================================================
# Build dashboard JSON
# =========================================================

def main():
    print("=" * 60)
    print("BUILD DASHBOARD JSON")
    print("=" * 60)

    if not PROCESSED_DIR.exists():
        raise FileNotFoundError(
            f"Processed data directory not found: {PROCESSED_DIR}"
        )

    csv_files = sorted(PROCESSED_DIR.glob("*.csv"))

    if not csv_files:
        raise FileNotFoundError(
            f"No CSV files found in: {PROCESSED_DIR}"
        )

    dashboard = {}

    for csv_file in csv_files:
        print(f"Loading: {csv_file.name}")

        df = pd.read_csv(csv_file)

        # Convert NaN / NaT to empty strings so JSON is clean
        df = df.fillna("")

        # Convert filename into a simple dataset name
        dataset_name = csv_file.stem

        dashboard[dataset_name] = {
            "rows": len(df),
            "columns": list(df.columns),
            "data": df.to_dict(orient="records"),
        }

        print(
            f"  → {len(df):,} rows × {len(df.columns)} columns"
        )

    # Write JSON
    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(
            dashboard,
            f,
            ensure_ascii=False,
            separators=(",", ":"),
        )

    file_size_mb = OUTPUT_FILE.stat().st_size / 1024 / 1024

    print()
    print("=" * 60)
    print("DONE")
    print("=" * 60)
    print(f"Output: {OUTPUT_FILE}")
    print(f"Size:   {file_size_mb:.2f} MB")
    print(f"Datasets: {len(dashboard)}")


if __name__ == "__main__":
    main()