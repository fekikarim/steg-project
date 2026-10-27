"""STEG Python document-intelligence service (FastAPI).

Backend-only: every /api/* route requires X-Service-Token. Browsers and mobile
clients must NEVER call this service directly (Spring Boot is the authority).
Deterministic rules + OCR fallback first; ML/LLM only if real documents prove
rules insufficient.
"""
from __future__ import annotations

import hashlib
import os

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .analysis import (
    analyze_report,
    validate_document,
    verify_finance,
    verify_report_contract,
    verify_journal_contract,
)
from .journalpdf import JournalRenderError, render_journal_pdf_base64, self_check
from .pdfextract import (
    MAX_BYTES_DEFAULT,
    MAX_PAGES_DEFAULT,
    PdfTooLarge,
    decode_pdf,
    extract_text,
)

SERVICE_TOKEN = os.environ.get("PYTHON_AI_SERVICE_TOKEN", "")
MAX_BYTES = int(os.environ.get("PYTHON_AI_MAX_BYTES", str(MAX_BYTES_DEFAULT)))
MAX_PAGES = int(os.environ.get("PYTHON_AI_MAX_PAGES", str(MAX_PAGES_DEFAULT)))

import logging as _logging

_logger = _logging.getLogger("steg-doc-intel")
if not SERVICE_TOKEN:
    _logger.warning(
        "PYTHON_AI_SERVICE_TOKEN is empty: every /api/* call will return 401 "
        "and Spring Boot will degrade to AI_UNAVAILABLE. Set the shared token "
        "from the backend .env (PYTHON_AI_SERVICE_TOKEN)."
    )

app = FastAPI(title="STEG Document Intelligence", version="1.0.0")


class ValidateRequest(BaseModel):
    pdfBase64: str = Field(default="")
    expectedType: str = Field(default="")
    fullName: str | None = None
    version: str = Field(default="1")


class ReportRequest(BaseModel):
    pdfBase64: str = Field(default="")
    applicationReference: str | None = None
    version: str = Field(default="1")


class FinanceRequest(BaseModel):
    certificatePdfBase64: str | None = None
    reportPdfBase64: str | None = None
    internFullName: str | None = None
    period: str | None = None
    internshipType: str | None = None
    version: str = Field(default="1")


class ReportVerificationRequest(BaseModel):
    pdfBase64: str = Field(default="")
    candidateName: str | None = None
    supervisorName: str | None = None
    internshipType: str | None = None
    startDate: str | None = None
    endDate: str | None = None
    universityName: str | None = None


class JournalVerificationRequest(BaseModel):
    pdfBase64: str = Field(default="")
    startDate: str | None = None
    endDate: str | None = None
    completedApprovedTasks: int = Field(default=0, ge=0)
    totalTasks: int = Field(default=0, ge=0)


class JournalRenderRequest(BaseModel):
    """A journal PDF request.

    The entries are sent by Spring Boot, which read them from the database
    after enforcing authentication and student-level isolation: this service
    never connects to the database and never learns who the student is beyond
    the label fields used on the document header.
    """

    documentTitle: str = Field(default="")
    internFullName: str = Field(default="")
    internshipReference: str = Field(default="")
    internshipType: str = Field(default="")
    supervisorName: str = Field(default="")
    startDate: str = Field(default="")
    endDate: str = Field(default="")
    entries: list[dict] = Field(default_factory=list)
    version: str = Field(default="1")


def token_fingerprint() -> str:
    """Short, non-secret fingerprint of the configured service token.

    The backend and this service must agree on the same shared secret. They
    each hold it independently (two .env files, two containers), so they CAN
    drift — and when they do, every /api/* call answers 401, which the backend
    then reports as a generic "AI unavailable" with nothing actionable in it.

    This fingerprint lets the caller compare the two sides WITHOUT the secret
    ever leaving the service: 8 hex chars of SHA-256 is enough to tell two
    different secrets apart and far too little to recover one.
    """
    if not SERVICE_TOKEN:
        return ""
    return hashlib.sha256(SERVICE_TOKEN.encode("utf-8")).hexdigest()[:8]


def require_token(x_service_token: str | None) -> None:
    if not SERVICE_TOKEN or x_service_token != SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="unauthorized caller")


@app.get("/health")
def health() -> dict:
    # `configured` exposes only whether the shared service token is set
    # (never the token itself) so ops/Spring can verify sync without auth.
    return {"status": "UP", "service": "steg-doc-intel", "version": "1.0.0",
            "configured": bool(SERVICE_TOKEN),
            "tokenFingerprint": token_fingerprint(),
            "maxBytes": MAX_BYTES, "maxPages": MAX_PAGES}


@app.get("/ready")
def ready() -> JSONResponse:
    """True readiness — what Docker and Spring Boot gate on.

    A running process is NOT readiness. This probe fails unless the service
    can actually do its job:

    1. the shared token is configured (otherwise every call would 401);
    2. the journal PDF renderer is importable;
    3. the renderer really emits a valid PDF.

    Returning 503 here is what stops Spring Boot from calling before this
    service can answer, and what restarts a container that came up broken.

    `tokenFingerprint` is included so the caller can confirm both sides share
    the SAME secret — see token_fingerprint().
    """
    problems = []
    if not SERVICE_TOKEN:
        problems.append("PYTHON_AI_SERVICE_TOKEN is not configured")
    try:
        self_check()
    except Exception as exc:  # noqa: BLE001 - readiness must report, not raise
        problems.append(f"journal PDF renderer unavailable: {exc}")

    if problems:
        return JSONResponse(
            status_code=503,
            content={"status": "DOWN", "service": "steg-doc-intel",
                     "version": "1.0.0", "problems": problems},
        )
    return JSONResponse(
        status_code=200,
        content={"status": "UP", "service": "steg-doc-intel",
                 "version": "1.0.0", "configured": True,
                 "capabilities": ["journal-render"],
                 "tokenFingerprint": token_fingerprint()},
    )


@app.post("/api/doc-intel/validate")
def doc_validate(req: ValidateRequest, x_service_token: str | None = Header(default=None)) -> dict:
    require_token(x_service_token)
    try:
        raw = decode_pdf(req.pdfBase64, MAX_BYTES)
    except PdfTooLarge as exc:
        raise HTTPException(status_code=413, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    text, _ocr, _pages = extract_text(raw, MAX_PAGES)
    if not text.strip():
        return {"version": "1", "valid": False, "documentTypeValid": False,
                "candidateNameValid": False, "confidence": 0.0,
                "reason": "Document illisible : aucune couche texte et repli OCR indisponible."}
    return validate_document(text, req.expectedType, req.fullName)


@app.post("/api/report/analyze")
def report_analyze(req: ReportRequest, x_service_token: str | None = Header(default=None)) -> dict:
    require_token(x_service_token)
    try:
        raw = decode_pdf(req.pdfBase64, MAX_BYTES)
    except PdfTooLarge as exc:
        raise HTTPException(status_code=413, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    text, _ocr, _pages = extract_text(raw, MAX_PAGES)
    if not text.strip():
        return {"version": "1", "relevanceScore": 0.0, "detectedStegContent": "",
                "detectedActivities": "", "missingElements": "document illisible",
                "summary": "", "explanation": "Document illisible.", "confidence": 0.0}
    return analyze_report(text, req.applicationReference)


@app.post("/api/finance/verify")
def finance_verify(req: FinanceRequest, x_service_token: str | None = Header(default=None)) -> dict:
    require_token(x_service_token)
    cert_text, report_text = "", ""
    for label, b64 in (("cert", req.certificatePdfBase64), ("report", req.reportPdfBase64)):
        if not b64:
            continue
        try:
            raw = decode_pdf(b64, MAX_BYTES)
        except PdfTooLarge as exc:
            raise HTTPException(status_code=413, detail=str(exc))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="invalid %s pdf" % label)
        text, _ocr, _pages = extract_text(raw, MAX_PAGES)
        if label == "cert":
            cert_text = text
        else:
            report_text = text
    return verify_finance(cert_text or None, report_text or None, req.internFullName,
                          req.period, req.internshipType)


@app.post("/api/verification/report")
def verification_report(req: ReportVerificationRequest, x_service_token: str | None = Header(default=None)) -> dict:
    require_token(x_service_token)
    try:
        raw = decode_pdf(req.pdfBase64, MAX_BYTES)
    except PdfTooLarge as exc:
        raise HTTPException(status_code=413, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    text, _ocr, pages = extract_text(raw, MAX_PAGES)
    return verify_report_contract(text, pages, req.model_dump())


@app.post("/api/verification/journal")
def verification_journal(req: JournalVerificationRequest, x_service_token: str | None = Header(default=None)) -> dict:
    require_token(x_service_token)
    try:
        raw = decode_pdf(req.pdfBase64, MAX_BYTES)
    except PdfTooLarge as exc:
        raise HTTPException(status_code=413, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    text, _ocr, pages = extract_text(raw, MAX_PAGES)
    return verify_journal_contract(text, pages, req.model_dump())


@app.post("/api/journal/render")
def journal_render(
    req: JournalRenderRequest, x_service_token: str | None = Header(default=None)
) -> dict:
    """Render the internship-journal PDF from the student's persisted entries.

    Deterministic by construction: no model is called, so a task can neither be
    invented, reworded nor dropped. Auth is the shared service token, and the
    backend is the only caller.
    """
    require_token(x_service_token)
    try:
        return render_journal_pdf_base64(req.model_dump())
    except JournalRenderError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:  # pragma: no cover - defensive: never 500 silently
        _logger.exception("journal pdf render failed")
        raise HTTPException(status_code=500, detail="journal render failed") from exc


@app.exception_handler(HTTPException)
def _http_handler(_request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
