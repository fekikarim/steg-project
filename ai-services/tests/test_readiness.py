"""Startup/readiness contract for the Python AI service.

The journal PDF feature broke for a long time because the service reported
itself healthy while it could not do the job: the container was running, but
the image predated the journal endpoint. These tests pin the rule that a
service is READY only when it can actually render a PDF.
"""
import base64
import io
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("PYTHON_AI_SERVICE_TOKEN", "test-token")

from fastapi.testclient import TestClient  # noqa: E402
from pypdf import PdfReader  # noqa: E402

from app import journalpdf  # noqa: E402
from app.main import app  # noqa: E402

TOKEN = "test-token"


def _text_of(pdf_b64: str) -> str:
    raw = base64.b64decode(pdf_b64)
    return "\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(raw)).pages)


# ---------------------------------------------------------------------------
# /ready — the probe Docker and Spring Boot gate on
# ---------------------------------------------------------------------------

def test_ready_is_200_when_the_service_can_render_a_pdf():
    response = TestClient(app).get("/ready")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "UP"
    assert body["configured"] is True
    # Declares the capability the journal workflow depends on.
    assert "journal-render" in body["capabilities"]


def test_health_is_about_liveness_not_capability():
    """`/health` stays cheap; `/ready` is the capability probe."""
    body = TestClient(app).get("/health").json()
    assert body["status"] == "UP"
    assert "capabilities" not in body


def test_ready_requires_a_configured_service_token(monkeypatch):
    monkeypatch.setenv("PYTHON_AI_SERVICE_TOKEN", "")
    import importlib

    import app.main as main_module

    importlib.reload(main_module)
    response = TestClient(main_module.app).get("/ready")
    assert response.status_code == 503
    assert any("TOKEN" in p for p in response.json()["problems"])
    # Restore for the remaining tests in this module.
    monkeypatch.setenv("PYTHON_AI_SERVICE_TOKEN", TOKEN)
    importlib.reload(main_module)


def test_ready_fails_when_the_renderer_is_broken(monkeypatch):
    """A service that cannot lay out a PDF must NOT report ready."""
    import app.main as main_module

    def broken():
        raise RuntimeError("simulated renderer failure")

    monkeypatch.setattr(main_module, "self_check", broken)
    response = TestClient(main_module.app).get("/ready")
    assert response.status_code == 503
    assert any("renderer" in p for p in response.json()["problems"])


def test_self_check_detects_a_broken_renderer(monkeypatch):
    monkeypatch.setattr(journalpdf, "normalize_entries", lambda *_: 1 / 0)
    try:
        journalpdf.self_check()
    except Exception:
        return
    raise AssertionError("self_check must fail when the renderer cannot work")


def test_self_check_passes_on_a_healthy_renderer():
    journalpdf.self_check()  # must not raise


# ---------------------------------------------------------------------------
# The capability the journal workflow actually needs
# ---------------------------------------------------------------------------

def test_ready_capability_matches_what_journal_render_produces():
    """What /ready advertises is what /api/journal/render actually delivers."""
    client = TestClient(app)
    capabilities = client.get("/ready").json()["capabilities"]
    response = client.post(
        "/api/journal/render",
        headers={"X-Service-Token": TOKEN},
        json={
            "entries": [{
                "id": "e1",
                "entryDate": "2026-01-05",
                "title": "Accueil",
                "description": "Visite du site",
                "status": "SUBMITTED",
            }]
        },
    )
    assert response.status_code == 200
    assert "journal-render" in capabilities
    assert response.json()["pdfBase64"].startswith("")  # decodes below
    text = _text_of(response.json()["pdfBase64"])
    assert "Accueil" in text
    assert "05/01/2026" in text


def test_journal_route_requires_the_shared_token():
    assert TestClient(app).post("/api/journal/render", json={"entries": []}).status_code == 401


def test_journal_render_rejects_a_malformed_payload_instead_of_crashing():
    response = TestClient(app).post(
        "/api/journal/render",
        headers={"X-Service-Token": TOKEN},
        json={"entries": [{"id": "e1", "entryDate": "not-a-date", "title": "x"}]},
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Token fingerprint — lets the backend prove both sides share one secret
# ---------------------------------------------------------------------------

def test_ready_exposes_a_token_fingerprint():
    """/ready must publish a non-secret fingerprint of the configured token.

    The backend cannot detect a drifted shared secret without this, and the
    drift otherwise shows up as an unexplained 401 that looks like an outage.
    """
    body = TestClient(app).get("/ready").json()
    assert body["tokenFingerprint"] == _fingerprint(TOKEN)


def test_fingerprint_is_short_and_never_the_secret():
    fingerprint = _fingerprint(TOKEN)
    assert len(fingerprint) == 8
    assert TOKEN not in fingerprint
    assert fingerprint.isalnum()


def test_fingerprint_differs_for_a_different_token():
    """The whole point: two different secrets must never look identical."""
    assert _fingerprint("token-a") != _fingerprint("token-b")


def _fingerprint(token: str) -> str:
    import hashlib

    return hashlib.sha256(token.encode("utf-8")).hexdigest()[:8]
