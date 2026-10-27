"""Shared golden fixture for the S7 verification contract (pre-check (e)).

The JSON file `verification_contract.json` next to this script holds golden
request/response pairs for `/api/verification/report` and
`/api/verification/journal`. The Python suite (`test_verification_files.py`)
asserts the LIVE FastAPI app returns these responses byte-for-byte, and the
Spring adapter suite replays the same response bytes through its strict
contract parser — so both sides prove against one shared file.

Regenerate ONLY when the contract itself changes (never to make a red test
green without a contract reason):
    python3.13 tests/gen_verification_fixture.py
"""
import base64
import io
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.analysis import verify_journal_contract, verify_report_contract  # noqa: E402
from tests.test_verification_files import (  # noqa: E402
    GOLDEN_JOURNAL_PAGES,
    GOLDEN_JOURNAL_REQUEST,
    GOLDEN_REPORT_PAGES,
    GOLDEN_REPORT_REQUEST,
    extract_all_text,
)

_HERE = os.path.dirname(os.path.abspath(__file__))


def main() -> None:
    report_text = extract_all_text(GOLDEN_REPORT_PAGES)
    journal_text = extract_all_text(GOLDEN_JOURNAL_PAGES)
    fixture = {
        "report": {
            "request": GOLDEN_REPORT_REQUEST,
            "response": verify_report_contract(
                report_text, len(GOLDEN_REPORT_PAGES), dict(GOLDEN_REPORT_REQUEST)),
        },
        "journal": {
            "request": GOLDEN_JOURNAL_REQUEST,
            "response": verify_journal_contract(
                journal_text, len(GOLDEN_JOURNAL_PAGES), dict(GOLDEN_JOURNAL_REQUEST)),
        },
    }
    assert fixture["report"]["response"]["overall"] == "PASS"
    assert fixture["journal"]["response"]["overall"] == "PASS"
    with open(os.path.join(_HERE, "verification_contract.json"), "w", encoding="utf-8") as fh:
        json.dump(fixture, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print("wrote verification_contract.json")


if __name__ == "__main__":
    main()
