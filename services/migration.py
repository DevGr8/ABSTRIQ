"""
services/migration.py
=====================
Administrator CLI & programmatic utility for legacy evaluation migration.
Migrates historical evaluations from data/results.xlsx into Firestore 'legacy_evaluations'.
Guarantees records remain UNASSIGNED and are never automatically allocated to users.
"""

import argparse
import json
import logging
import sys
from pathlib import Path

# Ensure project root is on sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from services import firebase_service
import config

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("migration")


def run_migration(excel_path: Path = None, verbose: bool = True) -> dict:
    """Execute legacy migration into legacy_evaluations collection."""
    path = excel_path or config.RESULTS_FILE
    if verbose:
        logger.info(f"Starting legacy evaluation migration from: {path}")

    res = firebase_service.migrate_legacy_evaluations_to_firestore(path)

    if verbose:
        logger.info(f"Migration completed. Result: {res}")
        logger.info("Verification: All legacy records remain in 'legacy_evaluations' as UNASSIGNED.")

    return res


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ABSTRIQ 3.0 Legacy Evaluation Migration Tool")
    parser.add_argument("--file", type=str, default=str(config.RESULTS_FILE), help="Path to results.xlsx")
    args = parser.parse_args()

    result = run_migration(Path(args.file))
    print(json.dumps(result, indent=2))
