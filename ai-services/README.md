# STEG Document Intelligence & AI Services

[![Python 3.11](https://img.shields.io/badge/Python-3.11%2B-blue.svg?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-1.0.0-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Internal Only](https://img.shields.io/badge/Access-Backend%20Only-red.svg)](README.md)

Dedicated internal microservice providing document intelligence, automated text extraction, optical character recognition (OCR), report quality scoring, finance verification, and deterministic PDF journal rendering for the STEG platform.

---

## 🔒 Security & Calling Boundary

> [!CAUTION]
> **This service is strictly internal.** Browsers, mobile applications, and third-party clients must **NEVER** call this service directly. The Spring Boot backend (`steg-backend`) is the sole authorized caller.

Every endpoint under `/api/*` enforces authorization using a shared secret via the `X-Service-Token` header. Calls lacking this token or providing an incorrect value receive an immediate `401 Unauthorized`. To assist operations without leaking secrets, the public `/health` endpoint exposes a safe 8-character SHA-256 fingerprint (`tokenFingerprint`) of the configured token.

---

## ✨ Features & Capabilities

- **Document Classification & Pre-screening (`/api/doc-intel/validate`):** Inspects candidate uploads (CIN, passport, assignment letters), verifying that the document contains valid expected content and corresponds to the applicant's name.
- **OCR Fallback (`extract_text`):** Employs PyMuPDF for native vector PDF text extraction and automatically falls back to Tesseract OCR when processing scanned or image-only documents.
- **Internship Report Technical Analysis (`/api/report/analyze`):** Analyzes submitted technical reports for STEG-specific content, completed engineering activities, and structural completeness, assigning an objective relevance score.
- **Finance Stipend Clearance Verification (`/api/finance/verify`):** Cross-checks completion certificates against final internship reports, validating matching student identities, duration, and departments before funds release.
- **Contract & Spec Verifications (`/api/verification/*`):** Assesses conformity between submitted deliverables and initial project specifications.
- **Deterministic Journal PDF Rendering (`/api/journal/render`):** Compiles verified logbook entries into an official, print-ready STEG internship journal using ReportLab, ensuring tasks are neither dropped nor hallucinated.

---

## 🛠 Tech Stack & Dependencies

- **Runtime:** Python 3.11+
- **API Framework:** FastAPI, Uvicorn, Starlette
- **Data Validation:** Pydantic v2
- **PDF Extraction:** PyMuPDF (`fitz`), pdfplumber
- **OCR Engine:** pytesseract (requires local Tesseract binary)
- **PDF Generation:** ReportLab
- **Testing:** Pytest, pytest-asyncio

---

## 📁 Folder Structure

```
ai-services/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application, route declarations, token auth
│   ├── analysis.py          # Document intelligence rules, scoring heuristics
│   ├── journalpdf.py        # ReportLab PDF template generator for internship journals
│   ├── pdfextract.py        # Text extraction pipeline (PyMuPDF + Tesseract fallback)
│   └── textutils.py         # Normalization, regex helpers, and token sanitizers
├── tests/
│   ├── fixtures/            # Test PDFs, JSON contract payloads
│   ├── test_doc_intel.py    # Document validation unit tests
│   ├── test_journal_pdf.py  # PDF compilation tests
│   ├── test_readiness.py    # Service health and configuration tests
│   └── test_verification_files.py
├── Dockerfile               # Production container image definition
├── requirements.txt         # Pinned Python package dependencies
├── .env.example             # Configuration template
└── pytest.ini               # Test configuration
```

---

## ⚙️ Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Shared secret token (must exactly match backend's ai.service.token)
PYTHON_AI_SERVICE_TOKEN=steg_shared_internal_ai_token_2026

# Document extraction limits
PYTHON_AI_MAX_BYTES=26214400 # 25 MB ceiling
PYTHON_AI_MAX_PAGES=50       # 50 page ceiling
```

---

## 🚀 Installation & Running

### Local Environment
```bash
# 1. Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 3. Launch service with hot reload
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Running Unit Tests
```bash
pytest
```

### Health Check Verification
```bash
curl http://localhost:8000/health
```
*Expected response:*
```json
{
  "status": "UP",
  "service": "steg-doc-intel",
  "version": "1.0.0",
  "configured": true,
  "tokenFingerprint": "a1b2c3d4",
  "maxBytes": 26214400,
  "maxPages": 50
}
```

