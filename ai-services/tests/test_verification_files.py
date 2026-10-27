"""Real-file contract tests for the S7 verification endpoints (pre-check (e)).

Every test below runs the REAL FastAPI app (`TestClient(app)`) on PDFs
generated in-test with pypdf — no committed binary fixtures. Covered:
report: all 7 checks pass, each check failing ALONE, page count 3 vs 4,
scanned/blank text -> INCONCLUSIVE, accents + name order, FR + EN dates;
journal: ratio exactly 75% passes / 74% fails, wrong period, missing task
table. The golden file `fixtures/verification_contract.json` pins the exact
live responses, and the Spring adapter suite replays the same bytes — one
shared fixture, both sides.
"""
import base64
import io
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("PYTHON_AI_SERVICE_TOKEN", "test-token")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

TOKEN = "test-token"

GOLDEN_REPORT_REQUEST = {
    "candidateName": "Sana Ben Ammar",
    "supervisorName": "Karim Feki",
    "internshipType": "PFE",
    "startDate": "2026-01-15",
    "endDate": "2026-04-15",
    "universityName": "INSAT Tunis",
}

GOLDEN_REPORT_PAGES = [
    "STEG Rapport de stage PFE. Stagiaire Sana Ben Ammar, ecole INSAT Tunis. "
    "Encadrant Karim Feki. Periode du 15/01/2026 au 15/04/2026. Introduction.",
    "Chapitre 1 : analyse de l existant a la Societe Tunisienne de l Electricite et du Gaz.",
    "Chapitre 2 : conception et realisation. Conclusion et remerciements.",
    "Annexes et glossaire. Fin du rapport de stage.",
]

GOLDEN_JOURNAL_REQUEST = {
    "startDate": "2026-01-15",
    "endDate": "2026-04-15",
    "completedApprovedTasks": 3,
    "totalTasks": 4,
}

GOLDEN_JOURNAL_PAGES = [
    "Journal de stage. Periode 2026-01-15 - 2026-04-15. "
    "Semaine 1 : taches d analyse et reunion de cadrage.",
    "Semaine 2 : tableau des taches, developpement et tests.",
    "Semaine 3 : activites de deploiement et documentation.",
    "Bilan de periode et signature de l encadrant.",
]

_FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "verification_contract.json")


def _pdf_pages(texts: list[str]) -> str:
    """Multi-page text-layer PDF (pypdf, generated in-test)."""
    from pypdf import PdfWriter
    from pypdf.generic import (
        ArrayObject,
        DecodedStreamObject,
        DictionaryObject,
        NameObject,
        NumberObject,
    )

    writer = PdfWriter()
    for text in texts:
        page = writer.add_blank_page(width=400, height=400)
        font = DictionaryObject()
        font[NameObject("/Type")] = NameObject("/Font")
        font[NameObject("/Subtype")] = NameObject("/Type1")
        font[NameObject("/BaseFont")] = NameObject("/Helvetica")
        font_ref = writer._add_object(font)
        resources = DictionaryObject()
        fonts = DictionaryObject()
        fonts[NameObject("/F1")] = font_ref
        resources[NameObject("/Font")] = fonts
        page[NameObject("/Resources")] = resources
        stream = DecodedStreamObject()
        escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream.set_data(f"BT /F1 12 Tf 20 350 Td ({escaped}) Tj ET".encode("latin-1", "ignore"))
        page[NameObject("/Contents")] = writer._add_object(stream)
    buf = io.BytesIO()
    writer.write(buf)
    return base64.b64encode(buf.getvalue()).decode()


def _blank_pdf(pages: int = 1) -> str:
    from pypdf import PdfWriter

    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=400, height=400)
    buf = io.BytesIO()
    writer.write(buf)
    return base64.b64encode(buf.getvalue()).decode()


def extract_all_text(texts: list[str]) -> str:
    """What the server extracts from `_pdf_pages(texts)` (same pypdf path)."""
    from pypdf import PdfReader

    raw = base64.b64decode(_pdf_pages(texts))
    reader = PdfReader(io.BytesIO(raw))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _report(text_pages: list[str], expected: dict | None = None) -> dict:
    client = TestClient(app)
    body = dict(GOLDEN_REPORT_REQUEST)
    body.update(expected or {})
    response = client.post(
        "/api/verification/report",
        json={**body, "pdfBase64": _pdf_pages(text_pages)},
        headers={"X-Service-Token": TOKEN},
    )
    assert response.status_code == 200
    return response.json()


def _journal(text_pages: list[str], expected: dict | None = None) -> dict:
    client = TestClient(app)
    body = dict(GOLDEN_JOURNAL_REQUEST)
    body.update(expected or {})
    response = client.post(
        "/api/verification/journal",
        json={**body, "pdfBase64": _pdf_pages(text_pages)},
        headers={"X-Service-Token": TOKEN},
    )
    assert response.status_code == 200
    return response.json()


def _statuses(result: dict) -> dict[str, str]:
    return {c["key"]: c["status"] for c in result["checks"]}


def test_report_all_seven_checks_pass_on_real_files():
    result = _report(list(GOLDEN_REPORT_PAGES))
    assert result["overall"] == "PASS"
    assert _statuses(result) == {
        "candidate_name": "PASSED",
        "supervisor_name": "PASSED",
        "internship_type": "PASSED",
        "university_name": "PASSED",
        "internship_period": "PASSED",
        "steg_name": "PASSED",
        "page_count": "PASSED",
    }


def _passing_pages(**overrides: str) -> list[str]:
    pages = list(GOLDEN_REPORT_PAGES)
    pages[0] = (
        f"STEG Rapport de stage {overrides.get('type', 'PFE')}. "
        f"Stagiaire {overrides.get('candidate', 'Sana Ben Ammar')}, "
        f"ecole {overrides.get('university', 'INSAT Tunis')}. "
        f"Encadrant {overrides.get('supervisor', 'Karim Feki')}. "
        f"Periode {overrides.get('period', 'du 15/01/2026 au 15/04/2026')}. Introduction."
    )
    return pages


def test_report_each_check_fails_alone():
    base = {
        "candidate": "Sana Ben Ammar",
        "supervisor": "Karim Feki",
        "type": "PFE",
        "university": "INSAT Tunis",
        "period": "du 15/01/2026 au 15/04/2026",
    }
    mutations = {
        "candidate_name": {"candidate": "Quelqu Un D Autre"},
        "supervisor_name": {"supervisor": "Inconnu Total"},
        "internship_type": {"type": "OBSERVATION"},
        "university_name": {"university": "Universite Lointaine"},
        "internship_period": {"period": "du 01/01/2020 au 01/04/2020"},
        "steg_name": None,  # handled below: strip every STEG marker
    }
    for key, change in mutations.items():
        pages = _passing_pages(**(change or {}))
        if key == "steg_name":
            pages = [p.replace("STEG", "").replace("Societe Tunisienne de l Electricite et du Gaz", "")
                     for p in pages]
        result = _report(pages)
        statuses = _statuses(result)
        assert result["overall"] == "FAIL", key
        assert statuses[key] == "FAILED", key
        assert all(s == "PASSED" for k, s in statuses.items() if k != key), key


def test_report_page_count_three_fails_four_passes():
    pages4 = _passing_pages()
    assert _report(pages4)["overall"] == "PASS"
    result3 = _report(pages4[:3])
    assert result3["overall"] == "FAIL"
    assert _statuses(result3)["page_count"] == "FAILED"
    assert all(s == "PASSED" for k, s in _statuses(result3).items() if k != "page_count")


def test_report_scanned_pdf_is_inconclusive():
    client = TestClient(app)
    response = client.post(
        "/api/verification/report",
        json={**GOLDEN_REPORT_REQUEST, "pdfBase64": _blank_pdf()},
        headers={"X-Service-Token": TOKEN},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["overall"] == "INCONCLUSIVE"
    assert {c["status"] for c in body["checks"]} == {"INCONCLUSIVE"}


def test_report_accents_and_name_order_pass():
    pages = _passing_pages(candidate="AMMAR Sana Ben", supervisor="FEKI Karim")
    result = _report(pages, {"candidateName": "Sana Ben Ammâr", "supervisorName": "Karim Féki"})
    statuses = _statuses(result)
    assert statuses["candidate_name"] == "PASSED"
    assert statuses["supervisor_name"] == "PASSED"


def test_report_french_and_english_dates_pass():
    fr = _report(_passing_pages(period="du 15/01/2026 au 15/04/2026"))
    assert _statuses(fr)["internship_period"] == "PASSED"
    en = _report(_passing_pages(period="January 15, 2026 - April 15, 2026"))
    assert _statuses(en)["internship_period"] == "PASSED"
    en2 = _report(_passing_pages(period="15 January 2026 - 15 April 2026"))
    assert _statuses(en2)["internship_period"] == "PASSED"


def test_journal_all_checks_pass_on_real_files():
    result = _journal(list(GOLDEN_JOURNAL_PAGES))
    assert result["overall"] == "PASS"
    assert _statuses(result) == {
        "task_completion": "PASSED",
        "internship_period": "PASSED",
        "structure": "PASSED",
    }


def test_journal_ratio_boundary_75_passes_74_fails():
    ok = _journal(list(GOLDEN_JOURNAL_PAGES),
                  {"completedApprovedTasks": 75, "totalTasks": 100})
    assert _statuses(ok)["task_completion"] == "PASSED"
    assert ok["overall"] == "PASS"
    ko = _journal(list(GOLDEN_JOURNAL_PAGES),
                  {"completedApprovedTasks": 74, "totalTasks": 100})
    assert _statuses(ko)["task_completion"] == "FAILED"
    assert ko["overall"] == "FAIL"


def test_journal_wrong_period_fails_period_only():
    result = _journal(
        [p.replace("2026-01-15 - 2026-04-15", "2025-01-15 - 2025-04-15")
         for p in GOLDEN_JOURNAL_PAGES],
        {"startDate": "2026-01-15", "endDate": "2026-04-15"})
    statuses = _statuses(result)
    assert result["overall"] == "FAIL"
    assert statuses["internship_period"] == "FAILED"
    assert statuses["task_completion"] == "PASSED"
    assert statuses["structure"] == "PASSED"


def test_journal_missing_task_table_fails_structure_only():
    pages = [
        "Journal de stage. Periode 2026-01-15 - 2026-04-15. Notes quotidiennes.",
        "Semaine 1 : notes personnelles et pensees.",
        "Semaine 2 : encore des notes personnelles.",
        "Bilan de periode et signature.",
    ]
    result = _journal(pages)
    statuses = _statuses(result)
    assert result["overall"] == "FAIL"
    assert statuses["structure"] == "FAILED"
    assert statuses["internship_period"] == "PASSED"


def test_journal_scanned_pdf_is_inconclusive():
    client = TestClient(app)
    response = client.post(
        "/api/verification/journal",
        json={**GOLDEN_JOURNAL_REQUEST, "pdfBase64": _blank_pdf()},
        headers={"X-Service-Token": TOKEN},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["overall"] == "INCONCLUSIVE"
    assert {c["status"] for c in body["checks"]} == {"INCONCLUSIVE"}


def test_live_responses_match_shared_golden_fixture():
    with open(_FIXTURE_PATH, encoding="utf-8") as fh:
        fixture = json.load(fh)
    report_live = _report(list(GOLDEN_REPORT_PAGES))
    assert report_live == fixture["report"]["response"]
    journal_live = _journal(list(GOLDEN_JOURNAL_PAGES))
    assert journal_live == fixture["journal"]["response"]
    assert fixture["report"]["request"] == GOLDEN_REPORT_REQUEST
    assert fixture["journal"]["request"] == GOLDEN_JOURNAL_REQUEST
