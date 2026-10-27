"""Journal PDF: ordering, grouping, completeness, isolation inputs, failures.

The renderer is the only place a journal layout is produced, so these tests
pin the guarantees the mobile app and the back-office verifier depend on:
chronological order, one bullet per recorded entry, nothing invented, nothing
dropped, a valid document even for an empty journal.
"""
import base64
import io
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("PYTHON_AI_SERVICE_TOKEN", "test-token")

from fastapi.testclient import TestClient  # noqa: E402
from pypdf import PdfReader  # noqa: E402

from app.journalpdf import (  # noqa: E402
    JournalRenderError,
    format_date,
    group_by_date,
    normalize_entries,
    render_journal_pdf,
    render_journal_pdf_base64,
)
from app.main import app  # noqa: E402

TOKEN = "test-token"


def entry(entry_id, day, title, description="travail", status="SUBMITTED", created=None):
    return {
        "id": entry_id,
        "entryDate": day,
        "title": title,
        "description": description,
        "status": status,
        "createdAt": created or f"{day}T08:00:00Z",
    }


def text_of(pdf: bytes) -> str:
    return "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(pdf)).pages)


def pdf_of(payload: dict) -> str:
    return text_of(render_journal_pdf(payload))


# ---------------------------------------------------------------------------
# Ordering + grouping
# ---------------------------------------------------------------------------

def test_entries_are_sorted_chronologically():
    rows = normalize_entries([
        entry("c", "2026-03-02", "Later"),
        entry("a", "2026-01-05", "Earlier"),
        entry("b", "2026-02-11", "Middle"),
    ])
    assert [r.title for r in rows] == ["Earlier", "Middle", "Later"]


def test_same_date_entries_keep_a_stable_creation_order():
    rows = normalize_entries([
        entry("z", "2026-01-07", "Second", created="2026-01-07T10:00:00Z"),
        entry("a", "2026-01-07", "First", created="2026-01-07T08:00:00Z"),
    ])
    assert [r.title for r in rows] == ["First", "Second"]


def test_group_by_date_collapses_a_day_into_one_row():
    days = group_by_date(normalize_entries([
        entry("1", "2026-01-05", "Accueil"),
        entry("2", "2026-01-07", "Reseau"),
        entry("3", "2026-01-07", "Configuration"),
    ]))
    assert len(days) == 2
    assert days[0][0].isoformat() == "2026-01-05"
    assert [e.title for e in days[1][1]] == ["Reseau", "Configuration"]


def test_format_date_is_day_first():
    assert format_date(normalize_entries([entry("1", "2026-01-05", "x")])[0].entry_date) == "05/01/2026"


# ---------------------------------------------------------------------------
# Completeness: nothing omitted, nothing duplicated
# ---------------------------------------------------------------------------

def test_every_entry_appears_in_the_pdf():
    entries = [entry(str(i), "2026-01-%02d" % (i + 1), f"Task {i}") for i in range(10)]
    text = pdf_of({"entries": entries})
    for i in range(10):
        assert f"Task {i}" in text, f"entry {i} missing from the document"


def test_every_task_on_a_date_is_a_bullet_on_the_same_row():
    text = pdf_of({"entries": [
        entry("1", "2026-01-07", "Reseau", "cabling"),
        entry("2", "2026-01-07", "Configuration", "switches"),
    ]})
    assert text.count("07/01/2026") == 1, "the date must appear once"
    assert "Reseau" in text and "Configuration" in text
    assert "cabling" in text and "switches" in text


def test_a_duplicated_entry_is_rendered_once():
    rows = normalize_entries([
        entry("same", "2026-01-05", "Accueil", "visite"),
        entry("same", "2026-01-05", "Accueil", "visite"),
    ])
    assert len(rows) == 1


def test_bullet_format_is_title_then_work_performed():
    text = pdf_of({"entries": [entry("1", "2026-01-05", "Accueil", "Visite du site")]})
    line = next(l for l in text.splitlines() if "Accueil" in l)
    assert "Accueil" in line and "Visite du site" in line


def test_input_order_does_not_change_the_document():
    rows = [entry("a", "2026-01-05", "A"), entry("b", "2026-01-09", "B"),
            entry("c", "2026-01-09", "C")]
    # Compared on the rendered text, not the bytes: the PDF carries a creation
    # timestamp. What must be stable is the content and its order.
    assert pdf_of({"entries": rows}) == pdf_of({"entries": list(reversed(rows))})


# ---------------------------------------------------------------------------
# Status filtering: an official document carries submitted work only
# ---------------------------------------------------------------------------

def test_drafts_and_rejected_entries_are_excluded():
    rows = normalize_entries([
        entry("1", "2026-01-05", "Submitted", status="SUBMITTED"),
        entry("2", "2026-01-06", "Validated", status="VALIDATED"),
        entry("3", "2026-01-07", "Draft", status="DRAFT"),
        entry("4", "2026-01-08", "Rejected", status="REJECTED"),
    ])
    assert [r.title for r in rows] == ["Submitted", "Validated"]


def test_an_entry_without_a_title_is_skipped():
    assert normalize_entries([entry("1", "2026-01-05", "   ")]) == []


# ---------------------------------------------------------------------------
# Content safety
# ---------------------------------------------------------------------------

def test_markup_in_a_title_is_shown_literally_not_interpreted():
    text = pdf_of({"entries": [entry("1", "2026-01-05", "<b>bold</b>", "ok")]})
    # Escaped, so the angle brackets survive as visible characters. Had the
    # title been passed as live markup, reportlab would have swallowed the
    # tags and only "bold" would remain.
    assert "<b>bold</b>" in text
    assert "&lt;" not in text and "&amp;" not in text


def test_an_unglyph_character_is_replaced_instead_of_failing():
    pdf = render_journal_pdf({"entries": [entry("1", "2026-01-05", "Cafe 🔧", "ok")]})
    assert pdf.startswith(b"%PDF")
    assert "Cafe" in text_of(pdf)


def test_french_accents_survive_the_pdf():
    assert "Étude réseau" in pdf_of({"entries": [entry("1", "2026-01-05", "Étude réseau", "Dépannage")]})
    assert "Tâches réalisées" in pdf_of({"entries": [entry("1", "2026-01-05", "x", "y")]})


def test_a_very_long_description_is_bounded_and_still_rendered():
    text = pdf_of({"entries": [entry("1", "2026-01-05", "Long", "detail " * 2000)]})
    assert "Long" in text
    assert len(text) < 60_000


# ---------------------------------------------------------------------------
# Layout: repeating header, page numbers, empty journal
# ---------------------------------------------------------------------------

def test_header_row_repeats_on_every_page():
    entries = [entry(str(i), "2026-%02d-%02d" % (1 + i // 20, 1 + i % 20), f"Task {i}",
                     "description " * 15) for i in range(60)]
    pdf = render_journal_pdf({"entries": entries})
    pages = PdfReader(io.BytesIO(pdf)).pages
    assert len(pages) > 1, "this fixture must exercise several pages"
    for page in pages:
        assert "Tâches réalisées" in (page.extract_text() or "")


def test_pages_are_numbered():
    entries = [entry(str(i), "2026-%02d-%02d" % (1 + i // 20, 1 + i % 20), f"Task {i}",
                     "description " * 15) for i in range(60)]
    pdf = render_journal_pdf({"entries": entries})
    reader = PdfReader(io.BytesIO(pdf))
    total = len(reader.pages)
    for index, page in enumerate(reader.pages, start=1):
        assert f"Page {index} / {total}" in (page.extract_text() or "")


def test_an_empty_journal_still_produces_a_valid_document():
    result = render_journal_pdf_base64({"entries": []})
    assert result["entryCount"] == 0 and result["dayCount"] == 0
    assert result["firstDate"] is None and result["lastDate"] is None
    text = text_of(base64.b64decode(result["pdfBase64"]))
    assert "Aucune entrée" in text
    assert "Date" in text


def test_document_header_carries_the_intern_and_the_period():
    text = pdf_of({
        "internFullName": "Amine Trabelsi",
        "internshipReference": "INT-2026-00001",
        "supervisorName": "M. Salah",
        "startDate": "2026-01-05",
        "endDate": "2026-04-30",
        "entries": [entry("1", "2026-01-05", "Accueil")],
    })
    assert "Amine Trabelsi" in text
    assert "INT-2026-00001" in text
    assert "2026-01-05" in text and "2026-04-30" in text
    assert "Période" in text


def test_counts_reported_back_match_the_document():
    result = render_journal_pdf_base64({"entries": [
        entry("1", "2026-01-05", "A"), entry("2", "2026-01-05", "B"),
        entry("3", "2026-01-09", "C"),
    ]})
    assert result["entryCount"] == 3
    assert result["dayCount"] == 2
    assert result["firstDate"] == "2026-01-05"
    assert result["lastDate"] == "2026-01-09"
    assert result["pageCount"] >= 1


# ---------------------------------------------------------------------------
# Bounded / invalid input
# ---------------------------------------------------------------------------

def test_a_non_iso_date_is_refused():
    try:
        normalize_entries([entry("1", "05-01-2026", "x")])
    except JournalRenderError as exc:
        assert "entryDate" in str(exc)
    else:
        raise AssertionError("a malformed date must be rejected")


def test_too_many_entries_is_refused():
    payload = {"entries": [entry(str(i), "2026-01-05", f"T{i}") for i in range(501)]}
    try:
        render_journal_pdf(payload)
    except JournalRenderError as exc:
        assert "too many" in str(exc)
    else:
        raise AssertionError("an unbounded entry list must be rejected")


# ---------------------------------------------------------------------------
# Service route: shared-token auth only
# ---------------------------------------------------------------------------

def test_route_rejects_a_caller_without_the_service_token():
    client = TestClient(app)
    assert client.post("/api/journal/render", json={"entries": []}).status_code == 401


def test_route_rejects_a_wrong_service_token():
    client = TestClient(app)
    response = client.post("/api/journal/render", json={"entries": []},
                           headers={"X-Service-Token": "not-the-token"})
    assert response.status_code == 401


def test_route_renders_a_pdf_and_its_counts():
    client = TestClient(app)
    response = client.post("/api/journal/render", headers={"X-Service-Token": TOKEN}, json={
        "internFullName": "Amine Trabelsi",
        "entries": [entry("1", "2026-01-05", "Accueil", "Visite"),
                    entry("2", "2026-01-06", "Reseau", "Cabling")],
    })
    assert response.status_code == 200
    body = response.json()
    assert body["entryCount"] == 2 and body["dayCount"] == 2
    pdf = base64.b64decode(body["pdfBase64"])
    assert pdf.startswith(b"%PDF")
    assert "Amine Trabelsi" in text_of(pdf)


def test_route_answers_422_on_a_malformed_payload():
    client = TestClient(app)
    response = client.post("/api/journal/render", headers={"X-Service-Token": TOKEN},
                           json={"entries": [entry("1", "nope", "x")]})
    assert response.status_code == 422
