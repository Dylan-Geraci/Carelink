"""Trend aggregation for the M2 insights panel.

Pure functions over the raw rows from ``crud.get_trend_sessions`` — no DB or
network access, so this is straightforward to unit-test. We aggregate on the
fly rather than reading the ``trend_cache`` table: for a local single-user
SQLite DB the cost is negligible and live computation can never go stale.

Agitation is on a 0.0-10.0 scale (0 = calm), per the prompt templates.
"""

import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from models import MoodSlice, TrendPoint, TrendsResponse

# Agitation thresholds (0-10) for the at-a-glance calm label.
_CALM_MAX = 3.5
_MIXED_MAX = 6.5


def _week_start_ms(ts_ms: int) -> int:
    """Epoch ms of the local Sunday 00:00 for the week containing ``ts_ms``.

    Sunday-based to match the frontend export presets (``getDay()``).
    """
    dt = datetime.fromtimestamp(ts_ms / 1000)
    days_since_sunday = (dt.weekday() + 1) % 7  # weekday(): Mon=0..Sun=6
    sunday = (dt - timedelta(days=days_since_sunday)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return int(sunday.timestamp() * 1000)


def _calm_label(avg_agitation: Optional[float]) -> str:
    if avg_agitation is None:
        return "No data"
    if avg_agitation < _CALM_MAX:
        return "Calm"
    if avg_agitation < _MIXED_MAX:
        return "Mixed"
    return "Elevated"


def _top_phrase(rows: List[Dict[str, Any]]) -> tuple[Optional[str], int]:
    """Most-repeated phrase across all sessions, summing per-session counts.

    ``repetition_json`` is a JSON array string like
    ``[{"phrase": "where are we", "count": 3}]`` (often ``None`` or ``"[]"``).
    """
    totals: Counter[str] = Counter()
    for row in rows:
        raw = row.get("repetition_json")
        if not raw:
            continue
        try:
            items = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            continue
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            phrase = item.get("phrase")
            if not phrase:
                continue
            count = item.get("count", 1)
            totals[str(phrase).strip()] += int(count) if isinstance(count, (int, float)) else 1
    if not totals:
        return None, 0
    phrase, count = totals.most_common(1)[0]
    return phrase, count


def compute_trends(rows: List[Dict[str, Any]],
                   from_ts: Optional[int] = None,
                   to_ts: Optional[int] = None) -> TrendsResponse:
    """Aggregate summarized-session rows into a :class:`TrendsResponse`."""
    # Per-week buckets: (sum_of_scores, scored_count, session_count).
    weeks: Dict[int, List[float]] = defaultdict(lambda: [0.0, 0, 0])
    all_scores: List[float] = []
    moods: Counter[str] = Counter()

    for row in rows:
        bucket = weeks[_week_start_ms(row["start_ts"])]
        bucket[2] += 1  # session_count

        score = row.get("agitation_score")
        if score is not None:
            bucket[0] += score
            bucket[1] += 1
            all_scores.append(score)

        mood = (row.get("mood_label") or "").strip()
        if mood and mood.lower() != "unknown":
            moods[mood.lower()] += 1

    weekly = [
        TrendPoint(
            week_start_ts=week_start,
            session_count=int(b[2]),
            avg_agitation=round(b[0] / b[1], 2) if b[1] else None,
        )
        for week_start, b in sorted(weeks.items())
    ]

    avg_agitation = round(sum(all_scores) / len(all_scores), 2) if all_scores else None
    top_phrase, top_phrase_count = _top_phrase(rows)

    return TrendsResponse(
        from_ts=from_ts,
        to_ts=to_ts,
        total_sessions=len(rows),
        avg_agitation=avg_agitation,
        calm_label=_calm_label(avg_agitation),
        mood_distribution=[
            MoodSlice(mood_label=label, count=count)
            for label, count in moods.most_common()
        ],
        top_phrase=top_phrase,
        top_phrase_count=top_phrase_count,
        weekly=weekly,
    )
