"""Deterministic analysers: doc-intel, report analysis, finance verification."""
from __future__ import annotations

from .textutils import keyword_hits, name_present, normalize

VERSION = "1"


def _check(key: str, label: str, status: str, expected: str, found: str, evidence: str) -> dict:
    return {
        "key": key,
        "label": label,
        "status": status,
        "expected": expected,
        "found": found,
        "evidence": evidence,
    }


def _contains(text: str, expected: str | None) -> tuple[str, str]:
    if not expected:
        return "INCONCLUSIVE", "No expected value was provided."
    if normalize(expected) in normalize(text):
        return "PASSED", "Expected value found after normalization."
    return "FAILED", "Expected value was not found after normalization."


def _overall(checks: list[dict]) -> str:
    statuses = {check["status"] for check in checks}
    if "FAILED" in statuses:
        return "FAIL"
    if "INCONCLUSIVE" in statuses:
        return "INCONCLUSIVE"
    return "PASS"


_MONTHS_FR = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]

_MONTHS_EN = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
]


def _period_candidates(start_iso: str | None, end_iso: str | None) -> list[str]:
    """Accepted spellings of an internship period (§7.3: FR/EN date tolerance).

    The backend always sends ISO dates; reports are written by humans in FR or
    EN, so the ISO range alone would false-FAIL. Every candidate below denotes
    the same period: ISO, FR numeric (unambiguous — the backend only sends
    real calendar dates), FR long, and EN long forms.
    """
    import datetime as _dt

    def parse(value: str | None) -> _dt.date | None:
        if not value:
            return None
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d"):
            try:
                return _dt.datetime.strptime(value.strip(), fmt).date()
            except ValueError:
                continue
        return None

    start, end = parse(start_iso), parse(end_iso)
    if start is None or end is None:
        iso = " - ".join(filter(None, [start_iso, end_iso]))
        return [iso] if iso else []
    fr_s = f"{start.day:02d}/{start.month:02d}/{start.year}"
    fr_e = f"{end.day:02d}/{end.month:02d}/{end.year}"
    fr_ls = f"{start.day} {_MONTHS_FR[start.month - 1]} {start.year}"
    fr_le = f"{end.day} {_MONTHS_FR[end.month - 1]} {end.year}"
    en_ls = f"{_MONTHS_EN[start.month - 1].capitalize()} {start.day}, {start.year}"
    en_le = f"{_MONTHS_EN[end.month - 1].capitalize()} {end.day}, {end.year}"
    en_ss = f"{start.day} {_MONTHS_EN[start.month - 1].capitalize()} {start.year}"
    en_se = f"{end.day} {_MONTHS_EN[end.month - 1].capitalize()} {end.year}"
    out = [
        f"{start.isoformat()} - {end.isoformat()}",
        f"{fr_s} - {fr_e}",
        f"du {fr_s} au {fr_e}",
        f"{fr_ls} - {fr_le}",
        f"du {fr_ls} au {fr_le}",
        f"{en_ls} - {en_le}",
        f"from {en_ls} to {en_le}",
        f"{en_ss} - {en_se}",
    ]
    return out


def _period_matches(text: str, start_iso: str | None, end_iso: str | None) -> tuple[str, str]:
    """Period check with FR/EN tolerance; evidence names the matched spelling."""
    norm_text = normalize(text)
    for candidate in _period_candidates(start_iso, end_iso):
        if normalize(candidate) and normalize(candidate) in norm_text:
            return "PASSED", f"Period found as {candidate!r} after normalization."
    if not start_iso and not end_iso:
        return "INCONCLUSIVE", "No expected period was provided."
    return "FAILED", "No accepted spelling of the internship period was found after normalization."


def _name_matches(text: str, expected: str | None) -> tuple[str, str]:
    """Name check with accent/case/punctuation/whitespace AND name-order
    tolerance (§7.3): `first last` and `last first` both count."""
    if not expected or not expected.strip():
        return "INCONCLUSIVE", "No expected value was provided."
    present, _confidence = name_present(expected, text)
    if present:
        return "PASSED", "Name found after normalization (order-tolerant)."
    return "FAILED", "Name was not found after normalization."


def verify_report_contract(text: str, pages: int, expected: dict) -> dict:
    if not text.strip():
        keys = [
            ("candidate_name", "Candidate name"),
            ("supervisor_name", "Supervisor name"),
            ("internship_type", "Internship type"),
            ("internship_period", "Internship period"),
            ("steg_name", "STEG company name"),
            ("university_name", "University name"),
            ("page_count", "Page count"),
        ]
        return {"overall": "INCONCLUSIVE", "checks": [
            _check(key, label, "INCONCLUSIVE", "", "", "PDF text could not be extracted.")
            for key, label in keys
        ]}

    period = " - ".join(filter(None, [expected.get("startDate"), expected.get("endDate")]))
    period_status, period_evidence = _period_matches(
        text, expected.get("startDate"), expected.get("endDate"))
    checks = []
    for key, label, value in [
        ("candidate_name", "Candidate name", expected.get("candidateName")),
        ("supervisor_name", "Supervisor name", expected.get("supervisorName")),
        ("internship_type", "Internship type", expected.get("internshipType")),
        ("university_name", "University name", expected.get("universityName")),
    ]:
        if key in ("candidate_name", "supervisor_name"):
            status, evidence = _name_matches(text, value)
        else:
            status, evidence = _contains(text, value)
        checks.append(_check(key, label, status, value or "", text[:500], evidence))
    checks.append(_check("internship_period", "Internship period", period_status,
                         period, text[:500], period_evidence))
    steg_status = "PASSED" if "steg" in normalize(text) else "FAILED"
    checks.append(_check("steg_name", "STEG company name", steg_status, "STEG", text[:500],
                         "STEG marker found." if steg_status == "PASSED" else "STEG marker missing."))
    page_status = "PASSED" if pages >= 4 else "FAILED"
    checks.append(_check("page_count", "Page count", page_status, ">= 4", str(pages),
                         "Report has at least four pages." if page_status == "PASSED" else "Report must contain at least four pages."))
    return {"overall": _overall(checks), "checks": checks}


def verify_journal_contract(text: str, pages: int, expected: dict) -> dict:
    if not text.strip():
        return {"overall": "INCONCLUSIVE", "checks": [
            _check("task_completion", "Task completion", "INCONCLUSIVE", "", "", "PDF text could not be extracted."),
            _check("internship_period", "Internship period", "INCONCLUSIVE", "", "", "PDF text could not be extracted."),
            _check("structure", "Journal structure", "INCONCLUSIVE", "", "", "PDF text could not be extracted."),
        ]}
    completed = int(expected.get("completedApprovedTasks") or 0)
    total = int(expected.get("totalTasks") or 0)
    ratio = completed / total if total else 0
    completion_status = "PASSED" if total > 0 and ratio >= 0.75 else "FAILED"
    period = " - ".join(filter(None, [expected.get("startDate"), expected.get("endDate")]))
    period_status, period_evidence = _period_matches(
        text, expected.get("startDate"), expected.get("endDate"))
    normalized = normalize(text)
    has_period = "periode" in normalized or "period" in normalized
    has_tasks = "tache" in normalized or "task" in normalized or "activite" in normalized
    structure_status = "PASSED" if has_period and has_tasks else "FAILED"
    checks = [
        _check("task_completion", "Task completion", completion_status, ">= 75%",
               f"{completed}/{total} ({ratio:.0%})", "Completed and approved task ratio."),
        _check("internship_period", "Internship period", period_status, period, text[:500], period_evidence),
        _check("structure", "Journal structure", structure_status, "period section and task table",
               text[:500], "Period and task markers found." if structure_status == "PASSED" else "Required period/task markers missing."),
    ]
    return {"overall": _overall(checks), "checks": checks}

# Configurable keyword/pattern sets – must cover all three required trilingual checks:
#  - INTERNSHIP_APPLICATION: "Demande de Stage" / "internship application" / "طلب تدريب"
#  - ASSIGNMENT_LETTER:     "lettre d'affectation" / "assignment letter" / "خطاب التكليف"
# Included variants capture common phrasing/accents/definite-article forms;
# matching is accent-insensitive via normalize().
TYPE_KEYWORDS: dict[str, list[str]] = {
    "INTERNSHIP_APPLICATION": [
        "demande de stage",
        "internship application",
        "طلب تدريب",
        "طلب تربص",
        "demande d'admission en stage",
        "objet : demande de stage",
        "je sollicite un stage",
        "application for internship",
        "request for internship",
    ],
    "ASSIGNMENT_LETTER": [
        "lettre d'affectation",
        "lettre d affectation",
        "assignment letter",
        "خطاب التكليف",
        "خطاب تكليف",
        "affectation de stage",
        "lettre d'affectation de stage",
        "lettre d affectation de stage",
        "est affecté",
        "est affecte",
        "assignment of internship",
    ],
}

STEG_KEYWORDS = [
    "steg", "société tunisienne de l'électricité et du gaz", "électricité", "electricité",
    "gaz", "tunisie", "tunis", "stage", "stagiaire", "superviseur", "département",
    "direction", "unité", "encadrant", "tuteur",
]
ACTIVITY_KEYWORDS = [
    "activité", "activités", "tâche", "tâches", "mission", "projet", "objectif",
    "résultat", "compétence", "rapport", "journal", "livrable", "évaluation",
]
STRUCTURE_EXPECTED = ["introduction", "objectif", "activité", "conclusion", "remerciement"]
COMPLETION_KEYWORDS = [
    "terminé", "terminée", "complété", "complétée", "achevé", "validé", "validée",
    "certifié", "completed", "accompli",
]
TYPE_TOKENS = {
    "OBSERVATION": ["observation"],
    "PERFECTIONNEMENT": ["perfectionnement"],
    "PFE": ["pfe", "projet de fin d'études", "projet de fin d'etudes"],
}


def validate_document(text: str, expected_type: str, full_name: str | None) -> dict:
    type_keywords = TYPE_KEYWORDS.get((expected_type or "").upper(), [])
    type_hits = keyword_hits(text, type_keywords)
    type_ok = bool(type_hits) if type_keywords else None
    name_ok, name_conf = name_present(full_name, text)

    # Human-readable expected keyword label per type (for guidance)
    EXPECTED_LABELS = {
        "INTERNSHIP_APPLICATION": "« Demande de Stage » / « internship application » / « طلب تدريب »",
        "ASSIGNMENT_LETTER": "« lettre d'affectation » / « assignment letter » / « خطاب التكليف »",
    }
    expected_label = EXPECTED_LABELS.get((expected_type or "").upper(), expected_type or "—")

    # Build display name with both permutations for transparency
    display_name = (full_name or "").strip()
    if display_name:
        toks = [t for t in normalize(display_name).split(" ") if t]
        if len(toks) >= 2:
            # Show first+last and at least the primary last+first (k=1)
            alt = " ".join(toks[1:]) + " " + toks[0] if len(toks) == 2 else " ".join(toks[1:]) + " " + toks[0]  # simplified display
            # For multi-word, show generic both-orders hint
            name_display = f"« {display_name} » (ou « {' '.join(reversed(toks))} » vérifié)"
            if len(toks) > 2:
                # More accurate last+first for display: try split 1
                primary_alt = " ".join(toks[1:]) + " " + toks[0]
                name_display = f"« {display_name} » (ou « {primary_alt} » vérifié)"
        else:
            name_display = f"« {display_name} »"
    else:
        name_display = "—"

    if type_ok is None:  # unknown expected type: judge on name only
        valid = bool(name_ok)
        confidence = round(name_conf, 2)
        reason = "Type de document inconnu ; vérification du nom uniquement."
    else:
        valid = bool(type_ok and name_ok)
        confidence = round((0.55 if type_ok else 0.15) + (0.45 * name_conf if name_ok else 0.0), 2)
        if valid:
            reason = (
                f"Document valide : type « {expected_type} » détecté via {expected_label} "
                f"(trouvé : « {', '.join(type_hits[:2])} ») et nom complet {name_display} présent. "
                f"Confiance {int(confidence*100)} % — vous pouvez continuer."
            )
        else:
            parts: list[str] = []
            if not type_ok:
                parts.append(
                    f"Type non reconnu : attendu {expected_label} introuvable dans le texte extrait "
                    f"(texte + OCR si scanné). Veuillez remplacer par le bon document : "
                    f"{'une lettre de demande de stage' if expected_type == 'INTERNSHIP_APPLICATION' else 'une lettre d\'affectation'}."
                )
            else:
                parts.append(f"Type détecté : « {', '.join(type_hits[:2])} » ✓")
            if not name_ok:
                parts.append(
                    f"Nom introuvable : {name_display} absent du texte extrait. "
                    f"Vérifiez que votre nom complet apparaît exactement comme saisi (prénom + nom ou nom + prénom), "
                    f"ou remplacez le document par une version correcte."
                )
            else:
                parts.append(f"Nom détecté : {name_display} ✓")
            reason = " ".join(parts)

    return {
        "version": VERSION, "valid": valid, "documentTypeValid": bool(type_ok),
        "candidateNameValid": bool(name_ok), "confidence": confidence, "reason": reason,
    }


def analyze_report(text: str, application_reference: str | None) -> dict:
    steg_hits = keyword_hits(text, STEG_KEYWORDS)
    act_hits = keyword_hits(text, ACTIVITY_KEYWORDS)
    missing = [s for s in STRUCTURE_EXPECTED if normalize(s) not in normalize(text)]
    words = len(text.split())
    relevance = 0.0
    relevance += min(0.45, 0.09 * len(set(steg_hits)))
    relevance += min(0.30, 0.06 * len(set(act_hits)))
    relevance += 0.15 if words >= 300 else (0.07 if words >= 120 else 0.0)
    relevance += 0.10 if not missing else 0.0
    relevance = round(min(1.0, relevance), 2)
    sentences = [s.strip() for s in text.replace("\n", " ").split(".") if len(s.strip()) > 40]
    norm = normalize(text)

    def density(s: str) -> int:
        n = normalize(s)
        return sum(1 for kw in STEG_KEYWORDS + ACTIVITY_KEYWORDS if normalize(kw) in n)

    top = sorted(sentences, key=density, reverse=True)[:3]
    summary = ". ".join(s[:220] for s in top) + ("." if top else "")
    explanation = (
        "Analyse déterministe : le score mesure la présence de vocabulaire STEG/stage "
        "(%d marqueurs), d'activités (%d marqueurs), la longueur (%d mots) et la structure "
        "(éléments manquants : %s). Avis consultatif — la décision revient au superviseur."
        % (len(set(steg_hits)), len(set(act_hits)), words, ", ".join(missing) if missing else "aucun")
    )
    return {
        "version": VERSION, "relevanceScore": relevance,
        "detectedStegContent": ", ".join(sorted(set(steg_hits))[:12]),
        "detectedActivities": ", ".join(sorted(set(act_hits))[:12]),
        "missingElements": ", ".join(missing),
        "summary": summary[:1200],
        "explanation": explanation,
        "confidence": round(min(0.95, 0.5 + relevance / 2), 2),
    }


def verify_finance(cert_text: str | None, report_text: str | None, intern_name: str | None,
                   period: str | None, internship_type: str | None) -> dict:
    issues: list[str] = []
    confirmations: list[str] = []
    cert_text = cert_text or ""
    report_text = report_text or ""
    if not cert_text.strip():
        issues.append("Certificat manquant ou illisible.")
    if not report_text.strip():
        issues.append("Rapport manquant ou illisible.")

    name_ok_cert, conf_cert = name_present(intern_name, cert_text) if cert_text.strip() else (False, 0.0)
    name_ok_report, conf_report = name_present(intern_name, report_text) if report_text.strip() else (False, 0.0)
    if intern_name:
        if cert_text.strip():
            (confirmations if name_ok_cert else issues).append(
                "Nom de l'interne %s sur le certificat." % ("présent" if name_ok_cert else "introuvable"))
        if report_text.strip():
            (confirmations if name_ok_report else issues).append(
                "Nom de l'interne %s dans le rapport." % ("présent" if name_ok_report else "introuvable"))

    if period:
        norm_period = normalize(period)
        in_cert = bool(norm_period) and norm_period in normalize(cert_text)
        in_report = bool(norm_period) and norm_period in normalize(report_text)
        if in_cert or in_report:
            confirmations.append("Période %s retrouvée dans les documents." % period)
        else:
            issues.append("Période %s non retrouvée (vérification manuelle requise)." % period)

    if internship_type:
        toks = TYPE_TOKENS.get(internship_type.upper(), [internship_type.lower()])
        found = any(normalize(t) in normalize(cert_text + " " + report_text) for t in toks)
        if found:
            confirmations.append("Type de stage %s mentionné." % internship_type)
        else:
            issues.append("Type de stage %s non mentionné (vérification manuelle requise)." % internship_type)

    completion = keyword_hits(cert_text + " " + report_text, COMPLETION_KEYWORDS)
    if completion:
        confirmations.append("Marqueurs d'achèvement détectés (%s)." % ", ".join(completion[:3]))
    else:
        issues.append("Aucun marqueur d'achèvement détecté.")

    blocking = (not cert_text.strip() or not report_text.strip()
                or (bool(intern_name) and not (name_ok_cert or name_ok_report)))
    if blocking:
        verdict = "INVALID" if not cert_text.strip() or (bool(intern_name) and not name_ok_cert and not name_ok_report) else "NEEDS_REVIEW"
    elif issues:
        verdict = "NEEDS_REVIEW"
    else:
        verdict = "VERIFIED"
    confidence = round(0.9 if verdict == "VERIFIED" else (0.6 if verdict == "NEEDS_REVIEW" else 0.85), 2)
    reasons = "Confirmé : %s. Points d'attention : %s." % (
        "; ".join(confirmations) if confirmations else "aucun",
        "; ".join(issues) if issues else "aucun")
    return {"version": VERSION, "verdict": verdict, "reasons": reasons[:2000], "confidence": confidence}
