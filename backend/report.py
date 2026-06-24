"""PDF care-summary report builder (offline, fpdf2).

Isolates all PDF layout so routes/crud stay clean. Consumes the plain dicts from
`crud.get_report_sessions` and returns PDF bytes ready for an HTTP Response.
"""

import json
from collections import Counter
from datetime import datetime
from typing import Any, Dict, List, Optional

from fpdf import FPDF

# On-brand colours pulled from the UI (Carelink teal / slate greys).
_TEAL = (84, 106, 123)
_GRAY = (90, 90, 90)
_LIGHT = (140, 140, 140)

# fpdf2 core fonts are latin-1 only; map the smart punctuation Ollama tends to emit.
_REPLACEMENTS = {
    "‘": "'", "’": "'", "“": '"', "”": '"',
    "–": "-", "—": "-", "…": "...", "•": "-",
}


def _latin1(text: Optional[str]) -> str:
    """Make text safe for fpdf2 core fonts: swap smart punctuation, drop the rest
    (e.g. emoji) so AI-generated text can never crash rendering."""
    if not text:
        return ""
    for bad, good in _REPLACEMENTS.items():
        text = text.replace(bad, good)
    return text.encode("latin-1", "ignore").decode("latin-1")


def _fmt_dt(ts_ms: Optional[int], fmt: str) -> str:
    if not ts_ms:
        return "-"
    return datetime.fromtimestamp(ts_ms / 1000).strftime(fmt)


def _range_label(rows: List[Dict[str, Any]], from_ts: Optional[int],
                 to_ts: Optional[int]) -> str:
    """Human-readable period covered by the report."""
    if from_ts or to_ts:
        start = _fmt_dt(from_ts, "%b %d, %Y") if from_ts else "the beginning"
        end = _fmt_dt(to_ts, "%b %d, %Y") if to_ts else "now"
        return f"Period: {start} - {end}"
    if rows:
        return (f"Period: {_fmt_dt(rows[0]['start_ts'], '%b %d, %Y')}"
                f" - {_fmt_dt(rows[-1]['start_ts'], '%b %d, %Y')}")
    return "Period: all sessions"


def _format_suggestions(raw: Any) -> Optional[str]:
    """Suggestions are stored as a JSON array string (sometimes empty, sometimes
    a plain string). Render a clean sentence, or None when there's nothing to show."""
    if not raw:
        return None
    items: Any = raw
    if isinstance(raw, str):
        try:
            items = json.loads(raw)
        except (ValueError, TypeError):
            return raw.strip() or None
    if isinstance(items, list):
        cleaned = [str(s).strip() for s in items if str(s).strip()]
        return "; ".join(cleaned) if cleaned else None
    text = str(items).strip()
    return text or None


def _top_phrase(rows: List[Dict[str, Any]]) -> Optional[str]:
    """Best-effort most-repeated phrase across sessions. Defensive: the
    repetition_json shape is AI-fed, so tolerate missing/odd structures."""
    counts: Counter = Counter()
    for row in rows:
        raw = row.get("repetition_json")
        if not raw:
            continue
        try:
            items = json.loads(raw)
        except (ValueError, TypeError):
            continue
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            phrase = item.get("phrase") or item.get("text") or item.get("word")
            count = item.get("count") or item.get("occurrences") or item.get("n") or 1
            if phrase and isinstance(count, (int, float)):
                counts[str(phrase)] += int(count)
    if not counts:
        return None
    phrase, count = counts.most_common(1)[0]
    return f'"{phrase}" (x{count})'


class _ReportPDF(FPDF):
    def footer(self) -> None:
        self.set_y(-16)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*_LIGHT)
        self.multi_cell(
            0, 4,
            "Generated offline by Carelink. This summary is a caregiving aid, "
            "not a medical diagnosis.",
            align="C",
        )
        self.cell(0, 4, f"Page {self.page_no()}", align="C")


def _divider(pdf: FPDF) -> None:
    pdf.set_draw_color(220, 220, 220)
    y = pdf.get_y()
    pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)
    pdf.ln(3)


def build_care_report_pdf(rows: List[Dict[str, Any]],
                          from_ts: Optional[int] = None,
                          to_ts: Optional[int] = None) -> bytes:
    """Render a multi-session care summary to PDF bytes. Always returns a valid
    one-page document, even when `rows` is empty."""
    pdf = _ReportPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # --- Title block -------------------------------------------------------
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(*_TEAL)
    pdf.cell(0, 12, "Carelink Care Summary", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*_GRAY)
    pdf.cell(0, 6, _latin1(_range_label(rows, from_ts, to_ts)),
             new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6,
             "Generated " + datetime.now().strftime("%B %d, %Y at %I:%M %p")
             + "  -  Patient: General",
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)
    _divider(pdf)

    if not rows:
        pdf.ln(4)
        pdf.set_font("Helvetica", "", 12)
        pdf.set_text_color(*_GRAY)
        pdf.multi_cell(0, 6, "No sessions were recorded in this period.",
                       new_x="LMARGIN", new_y="NEXT")
        return bytes(pdf.output())

    # --- Overview ----------------------------------------------------------
    agitations = [r["agitation_score"] for r in rows
                  if r.get("agitation_score") is not None]
    moods = Counter(r["mood_label"] for r in rows if r.get("mood_label"))

    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(*_TEAL)
    pdf.cell(0, 8, "Overview", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*_GRAY)
    pdf.cell(0, 6, f"Sessions recorded: {len(rows)}",
             new_x="LMARGIN", new_y="NEXT")
    if agitations:
        avg = sum(agitations) / len(agitations)
        pdf.cell(0, 6, f"Average agitation: {avg:.2f}",
                 new_x="LMARGIN", new_y="NEXT")
    if moods:
        mood_str = ", ".join(f"{m} x{c}" for m, c in moods.most_common())
        pdf.cell(0, 6, _latin1(f"Mood overview: {mood_str}"),
                 new_x="LMARGIN", new_y="NEXT")
    top = _top_phrase(rows)
    if top:
        pdf.cell(0, 6, _latin1(f"Most repeated phrase: {top}"),
                 new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    _divider(pdf)
    pdf.ln(2)

    # --- Per-session entries ----------------------------------------------
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(*_TEAL)
    pdf.cell(0, 8, "Sessions", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)

    for row in rows:
        when = _fmt_dt(row.get("start_ts"), "%a %b %d, %Y  %I:%M %p")
        stype = (row.get("session_type") or "session").replace("_", " ").title()

        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(40, 40, 40)
        pdf.cell(0, 6, _latin1(f"{when}  -  {stype}"),
                 new_x="LMARGIN", new_y="NEXT")

        meta = []
        if row.get("mood_label"):
            meta.append(f"Mood: {row['mood_label']}")
        if row.get("agitation_score") is not None:
            meta.append(f"Agitation: {row['agitation_score']:.2f}")
        if meta:
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*_LIGHT)
            pdf.cell(0, 5, _latin1("   ".join(meta)),
                     new_x="LMARGIN", new_y="NEXT")

        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*_GRAY)
        summary = row.get("summary_text") or "No summary available."
        pdf.multi_cell(0, 5, _latin1(summary), new_x="LMARGIN", new_y="NEXT")

        suggestions = _format_suggestions(row.get("suggestions"))
        if suggestions:
            pdf.set_font("Helvetica", "I", 10)
            pdf.set_text_color(*_TEAL)
            pdf.multi_cell(0, 5, _latin1(f"Suggestions: {suggestions}"),
                           new_x="LMARGIN", new_y="NEXT")

        pdf.ln(3)
        _divider(pdf)
        pdf.ln(2)

    return bytes(pdf.output())
