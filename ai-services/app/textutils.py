"""Shared text utilities: normalization, fuzzy name match, keyword scoring."""
from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher


def normalize(text: str | None) -> str:
    if not text:
        return ""
    ascii_folded = "".join(
        c for c in unicodedata.normalize("NFKD", text.lower()) if not unicodedata.combining(c)
    )
    return re.sub(r"\s+", " ", ascii_folded).strip()


def tokens(text: str) -> list[str]:
    return [t for t in normalize(text).split(" ") if t]


def name_present(full_name: str | None, document_text: str) -> tuple[bool, float]:
    """Accent-insensitive full-name check for wizard validation.

    Must match either `firstName lastName` or `lastName firstName` (requirement).
    Handles multi-word names correctly (e.g. first="Mohamed", last="Ben Ali"):
      full="Mohamed Ben Ali" is checked as "Mohamed Ben Ali" OR "Ben Ali Mohamed"
    by trying every split point, not just token reversal.
    Strategy: exact normalized substring for either order, then token-set fuzzy
    fallback (>= 0.8 recall). Returns (present, confidence).
    """
    if not full_name or not full_name.strip():
        return True, 0.5  # no identity to check against: neutral, never blocking
    norm_name = normalize(full_name)
    norm_doc = normalize(document_text)
    if not norm_name or not norm_doc:
        return False, 0.0
    if norm_name in norm_doc:
        return True, 0.97
    # Accept lastName firstName for any split (handles multi-word last names)
    toks = [t for t in norm_name.split(" ") if len(t) >= 1]
    if len(toks) >= 2:
        for k in range(1, len(toks)):
            # first = toks[:k], last = toks[k:]  →  last + first
            candidate = " ".join(toks[k:]) + " " + " ".join(toks[:k])
            if candidate in norm_doc:
                return True, 0.97
        # Fallback: full token reversal for edge cases like "Ali Ben Mohamed"
        reversed_name = " ".join(reversed(toks))
        if reversed_name in norm_doc:
            return True, 0.97
    name_toks = [t for t in norm_name.split(" ") if len(t) >= 2]
    if not name_toks:
        return False, 0.0
    hits = sum(1 for t in name_toks if t in norm_doc)
    if hits == len(name_toks):
        return True, 0.9
    ratio = SequenceMatcher(None, norm_name, norm_doc[: len(norm_doc)]).ratio()
    # token recall blended with sequence similarity
    confidence = round(0.6 * (hits / len(name_toks)) + 0.4 * min(ratio * 2, 1.0), 2)
    return (hits / len(name_toks)) >= 0.8, confidence


def keyword_hits(document_text: str, keywords: list[str]) -> list[str]:
    norm_doc = normalize(document_text)
    return [kw for kw in keywords if normalize(kw) in norm_doc]
