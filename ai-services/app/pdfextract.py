"""PDF text extraction with OCR fallback for scanned documents."""
from __future__ import annotations

import base64
import binascii
import io

MAX_BYTES_DEFAULT = 25 * 1024 * 1024
MAX_PAGES_DEFAULT = 20


class PdfTooLarge(Exception):
    pass


def decode_pdf(pdf_b64: str | None, max_bytes: int = MAX_BYTES_DEFAULT) -> bytes:
    if not pdf_b64:
        raise ValueError("missing pdf")
    try:
        raw = base64.b64decode(pdf_b64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("invalid base64 pdf") from exc
    if len(raw) > max_bytes:
        raise PdfTooLarge(f"pdf exceeds {max_bytes} bytes")
    if not raw.startswith(b"%PDF"):
        raise ValueError("not a pdf document")
    return raw


def extract_text(raw: bytes, max_pages: int = MAX_PAGES_DEFAULT) -> tuple[str, bool, int]:
    """Returns (text, scanned_fallback_used, pages). Never raises on parse issues."""
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(raw))
        pages = min(len(reader.pages), max_pages)
        parts: list[str] = []
        for i in range(pages):
            try:
                parts.append(reader.pages[i].extract_text() or "")
            except Exception:
                parts.append("")
        text = "\n".join(parts)
        if len(text.strip()) >= 50:
            return text, False, pages
        ocr_text = _ocr_fallback(raw, pages)
        if ocr_text.strip():
            return ocr_text, True, pages
        return text, False, pages
    except Exception:
        return "", False, 0


def _ocr_fallback(raw: bytes, pages: int) -> str:
    try:
        import pytesseract  # optional dependency
        from pdf2image import convert_from_bytes  # optional dependency
        from PIL import Image  # noqa: F401
    except ImportError:
        return ""
    try:
        images = convert_from_bytes(raw, first_page=1, last_page=min(pages, 5), dpi=200)
        out: list[str] = []
        for img in images:
            try:
                # Trilingual OCR: French, English, Arabic (ara data available via tesseract-ocr-ara)
                out.append(pytesseract.image_to_string(img, lang="ara+fra+eng"))
            except Exception:
                # Fallback to fra+eng if ara pack not installed
                try:
                    out.append(pytesseract.image_to_string(img, lang="fra+eng"))
                except Exception:
                    continue
        return "\n".join(out)
    except Exception:
        return ""
