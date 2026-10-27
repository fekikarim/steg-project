"""Deterministic internship-journal PDF renderer.

The journal is a faithful compilation of what the student actually recorded:
every submitted/validated :class:`JournalEntry` becomes one bullet
``Title: work performed`` under its ``entry_date``. Nothing here invents,
rewrites, summarises or drops content — there is no LLM in this module by
design (the backend already validated the eligibility window; this service only
lays out persisted rows).

Guarantees, in order of importance:
  * every input entry appears exactly once (deduplicated by id);
  * dates ascend, and within a date the entries keep a stable creation order;
  * several entries on one date share a single table row, as bullets;
  * the header row repeats on every page and pages are numbered;
  * empty input still yields a valid, clearly-labelled document.

The Spring Boot service is the only caller and it never lets the database reach
this process: entries are passed in the request body.
"""
from __future__ import annotations

import base64
import datetime as dt
import io
from dataclasses import dataclass

from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as _canvas
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

VERSION = "1"

# Hard bounds, mirroring the backend's defensive limits: a journal is a
# student's own work, so these are generous but never unbounded.
MAX_ENTRIES = 500
MAX_TITLE = 300
MAX_DESCRIPTION = 4000

# Only entries the student actually submitted reach an official document:
# DRAFT is still being written and REJECTED was sent back for rework.
INCLUDED_STATUSES = ("SUBMITTED", "VALIDATED")

_BRAND = colors.HexColor("#0B61A0")
_BRAND_DARK = colors.HexColor("#084A7A")
_RULE = colors.HexColor("#C9D6E2")
_ZEBRA = colors.HexColor("#F4F8FB")
_MUTED = colors.HexColor("#5A6B7B")


class JournalRenderError(ValueError):
    """Raised for a payload this renderer refuses to lay out."""


@dataclass(frozen=True)
class _Entry:
    """One validated, de-duplicated journal entry, ready to render."""

    entry_date: dt.date
    title: str
    description: str


def _clean(value: object, limit: int) -> str:
    """Collapse whitespace and bound the length without cutting mid-word."""
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return (cut or text[:limit]).rstrip(" ,;:") + "…"


def _safe(text: str) -> str:
    """Keep only glyphs the built-in PDF fonts can encode.

    Helvetica is WinAnsi-encoded: an exotic character (emoji, CJK) would raise
    mid-build and 500 the whole request, so it is replaced instead.
    """
    out = []
    for ch in text:
        try:
            ch.encode("cp1252")
            out.append(ch)
        except UnicodeEncodeError:
            out.append("?")
    return "".join(out)


def _escape(text: str) -> str:
    return _safe(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _parse_date(value: object) -> dt.date:
    try:
        return dt.date.fromisoformat(str(value or "").strip()[:10])
    except ValueError as exc:
        raise JournalRenderError(f"entryDate is not an ISO date: {value!r}") from exc


def normalize_entries(raw_entries: object) -> list[_Entry]:
    """Validate, de-duplicate, order and return the journal entries.

    Ordering is (entry_date, createdAt, id): chronological for the reader,
    deterministic for two runs over the same data, and never dependent on the
    order the backend happened to serialise the rows in.
    """
    if not isinstance(raw_entries, list):
        raise JournalRenderError("entries must be a list")
    if len(raw_entries) > MAX_ENTRIES:
        raise JournalRenderError(f"too many entries: {len(raw_entries)} > {MAX_ENTRIES}")

    seen: set[str] = set()
    rows: list[tuple[dt.date, str, str, _Entry]] = []
    for position, item in enumerate(raw_entries):
        if not isinstance(item, dict):
            raise JournalRenderError(f"entry #{position} is not an object")

        status = str(item.get("status") or "SUBMITTED").upper()
        if status not in INCLUDED_STATUSES:
            continue

        entry_id = str(item.get("id") or f"#{position}")
        # Identical id = the same row twice; keep the first, never duplicate it.
        if entry_id in seen:
            continue
        seen.add(entry_id)

        title = _clean(item.get("title"), MAX_TITLE)
        if not title:
            # A row with no work recorded carries no information.
            continue
        rows.append((
            _parse_date(item.get("entryDate")),
            str(item.get("createdAt") or ""),
            entry_id,
            _Entry(
                entry_date=_parse_date(item.get("entryDate")),
                title=title,
                description=_clean(item.get("description"), MAX_DESCRIPTION),
            ),
        ))

    rows.sort(key=lambda row: (row[0], row[1], row[2]))
    return [row[3] for row in rows]


def group_by_date(entries: list[_Entry]) -> list[tuple[dt.date, list[_Entry]]]:
    """One row per date, dates ascending, entry order preserved within a day."""
    days: dict[dt.date, list[_Entry]] = {}
    for entry in entries:
        days.setdefault(entry.entry_date, []).append(entry)
    return [(day, days[day]) for day in sorted(days)]


def format_date(day: dt.date) -> str:
    return day.strftime("%d/%m/%Y")


def _bullets(day_entries: list[_Entry]) -> str:
    """``• Title: work performed`` — one bullet per entry, never merged."""
    lines = []
    for entry in day_entries:
        body = entry.description or "—"
        lines.append(f'• <b>{_escape(entry.title)}</b> : {_escape(body)}')
    return "<br/>".join(lines)


class _NumberedCanvas(_canvas.Canvas):
    """Canvas that knows the final page count, so it can print "n / N"."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved: list[dict] = []

    def showPage(self) -> None:  # noqa: N802 (reportlab API)
        self._saved.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        total = len(self._saved)
        for state in self._saved:
            self.__dict__.update(state)
            self._draw_page(total)
            super().showPage()
        super().save()

    def _draw_page(self, total: int) -> None:
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(_MUTED)
        self.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {self._pageNumber} / {total}")
        self.drawString(18 * mm, 10 * mm, "STEG — Journal de stage")
        self.setStrokeColor(_RULE)
        self.setLineWidth(0.5)
        self.line(18 * mm, 13 * mm, A4[0] - 18 * mm, 13 * mm)
        self.restoreState()


def _styles() -> dict[str, ParagraphStyle]:
    return {
        "title": ParagraphStyle("jTitle", fontName="Helvetica-Bold", fontSize=17,
                                leading=21, textColor=_BRAND_DARK, spaceAfter=2),
        "subtitle": ParagraphStyle("jSub", fontName="Helvetica", fontSize=10,
                                   leading=14, textColor=_MUTED),
        "metaLabel": ParagraphStyle("jMetaL", fontName="Helvetica-Bold", fontSize=9,
                                    leading=12, textColor=_BRAND),
        "metaValue": ParagraphStyle("jMetaV", fontName="Helvetica", fontSize=9,
                                    leading=12, textColor=colors.black),
        "head": ParagraphStyle("jHead", fontName="Helvetica-Bold", fontSize=10,
                               leading=13, textColor=colors.white),
        "date": ParagraphStyle("jDate", fontName="Helvetica-Bold", fontSize=9,
                               leading=12, textColor=_BRAND_DARK),
        "body": ParagraphStyle("jBody", fontName="Helvetica", fontSize=9, leading=13,
                               alignment=TA_JUSTIFY),
        "empty": ParagraphStyle("jEmpty", fontName="Helvetica-Oblique", fontSize=10,
                                leading=14, textColor=_MUTED, alignment=TA_JUSTIFY),
    }


def _info_table(payload: dict, styles: dict[str, ParagraphStyle]) -> Table:
    period = " — ".join(
        p for p in (str(payload.get("startDate") or ""), str(payload.get("endDate") or "")) if p)
    rows = [
        ("Stagiaire / Intern", payload.get("internFullName")),
        ("Référence / Reference", payload.get("internshipReference")),
        ("Type de stage", payload.get("internshipType")),
        ("Encadrant / Supervisor", payload.get("supervisorName")),
        ("Période / Period", period),
    ]
    data = [
        [Paragraph(_escape(label), styles["metaLabel"]),
         Paragraph(_escape(value or "—"), styles["metaValue"])]
        for label, value in rows
    ]
    table = Table(data, colWidths=[45 * mm, 121 * mm], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, _RULE),
    ]))
    return table


def render_journal_pdf(payload: dict) -> bytes:
    """Render the journal PDF. Pure function of ``payload`` (bytes out)."""
    if not isinstance(payload, dict):
        raise JournalRenderError("payload must be an object")

    entries = normalize_entries(payload.get("entries"))
    days = group_by_date(entries)
    styles = _styles()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=18 * mm, bottomMargin=20 * mm,
        title=_safe(str(payload.get("documentTitle") or "Journal de stage")),
        author=_safe(str(payload.get("internFullName") or "STEG")),
    )

    story: list = [
        Paragraph(_escape(payload.get("documentTitle") or "Journal de stage"), styles["title"]),
        Paragraph(_escape("Document généré à partir des entrées de journal soumises."),
                  styles["subtitle"]),
        Spacer(1, 6 * mm),
        _info_table(payload, styles),
        Spacer(1, 8 * mm),
    ]

    header = [Paragraph("Date", styles["head"]), Paragraph("Tâches réalisées / Tasks", styles["head"])]
    if days:
        body = [[Paragraph(format_date(day), styles["date"]),
                 Paragraph(_bullets(day_entries), styles["body"])]
                for day, day_entries in days]
        table_data = [header] + body
    else:
        table_data = [header, [Paragraph("—", styles["date"]),
                               Paragraph("Aucune entrée de journal soumise à la date de génération.",
                                         styles["empty"])]]

    table = Table(table_data, colWidths=[28 * mm, 138 * mm], repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), _BRAND),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, _RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]
    # Zebra striping restarts with the repeated header, so both are keyed to
    # the data rows rather than to absolute row numbers.
    for index in range(1, len(table_data)):
        if index % 2 == 0:
            style.append(("BACKGROUND", (0, index), (-1, index), _ZEBRA))
    table.setStyle(TableStyle(style))
    story.append(table)

    if entries:
        story.append(Spacer(1, 6 * mm))
        story.append(Paragraph(
            _escape(f"{len(entries)} entrée(s) — {len(days)} jour(s) documenté(s)."),
            styles["subtitle"]))

    doc.build(story, canvasmaker=_NumberedCanvas)
    return buffer.getvalue()


def render_journal_pdf_base64(payload: dict) -> dict:
    """Service-level result: the PDF plus the counts the UI reports back."""
    pdf = render_journal_pdf(payload)
    entries = normalize_entries(payload.get("entries"))
    days = group_by_date(entries)
    return {
        "version": VERSION,
        "pdfBase64": base64.b64encode(pdf).decode("ascii"),
        "entryCount": len(entries),
        "dayCount": len(days),
        "firstDate": days[0][0].isoformat() if days else None,
        "lastDate": days[-1][0].isoformat() if days else None,
        "pageCount": _page_count(pdf),
    }


def _page_count(pdf: bytes) -> int:
    from pypdf import PdfReader

    return len(PdfReader(io.BytesIO(pdf)).pages)


def self_check() -> None:
    """Prove the renderer can actually produce a PDF.

    Used by the readiness probe: a process that imported cleanly but cannot lay
    out a table (missing font, broken ReportLab install, no write permission in
    the temp dir) must NOT be reported as ready, because the very next call
    would fail at the worst possible moment.
    """
    probe = render_journal_pdf_base64({
        "documentTitle": "readiness probe",
        "entries": [{
            "id": "probe",
            "entryDate": "2026-01-01",
            "title": "Probe",
            "description": "Probe",
            "status": "SUBMITTED",
        }],
    })
    raw = base64.b64decode(probe["pdfBase64"])
    if not raw.startswith(b"%PDF-"):
        raise RuntimeError("readiness probe did not produce a PDF")


__all__ = [
    "VERSION",
    "self_check",
    "MAX_ENTRIES",
    "INCLUDED_STATUSES",
    "JournalRenderError",
    "format_date",
    "group_by_date",
    "normalize_entries",
    "render_journal_pdf",
    "render_journal_pdf_base64",
]