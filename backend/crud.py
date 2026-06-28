import uuid
import time
import json
from typing import List, Optional, Dict, Any
from database import db_cursor, db_connection, DEFAULT_PATIENT_ID
from models import (
    SessionDB, AudioChunk, Transcript, Summary, SessionDetail, SessionListItem,
    Reminder, Caregiver, PatientWithRole, Member,
)


def create_session(session_type: str, start_ts: int) -> str:
    """Create a new session and return the session_id."""
    session_id = str(uuid.uuid4())

    with db_cursor() as cursor:
        cursor.execute(
            "INSERT INTO sessions (session_id, session_type, start_ts) VALUES (?, ?, ?)",
            (session_id, session_type, start_ts)
        )

    return session_id


def get_session(session_id: str) -> Optional[SessionDB]:
    """Get a session by ID."""
    with db_cursor() as cursor:
        cursor.execute(
            "SELECT session_id, session_type, start_ts, end_ts, notes FROM sessions WHERE session_id = ?",
            (session_id,)
        )
        row = cursor.fetchone()

        if row:
            return SessionDB(
                session_id=row["session_id"],
                session_type=row["session_type"],
                start_ts=row["start_ts"],
                end_ts=row["end_ts"],
                notes=row["notes"]
            )
    return None


def update_session_end(session_id: str, end_ts: int, notes: Optional[str] = None) -> bool:
    """Update session end timestamp and notes."""
    with db_cursor() as cursor:
        cursor.execute(
            "UPDATE sessions SET end_ts = ?, notes = ? WHERE session_id = ?",
            (end_ts, notes, session_id)
        )
        return cursor.rowcount > 0


def update_session_note(session_id: str, notes: str) -> bool:
    """Save the caregiver's reflection note onto a session."""
    with db_cursor() as cursor:
        cursor.execute(
            "UPDATE sessions SET notes = ? WHERE session_id = ?", (notes, session_id))
        return cursor.rowcount > 0


def update_summary_fields(session_id: str, summary_text: Optional[str] = None,
                          tags: Optional[List[str]] = None) -> bool:
    """Patch an existing summary's text and/or tags. tags is stored as JSON."""
    updates: List[str] = []
    params: List[Any] = []
    if summary_text is not None:
        updates.append("summary_text = ?")
        params.append(summary_text)
    if tags is not None:
        updates.append("tags = ?")
        params.append(json.dumps(tags))
    if not updates:
        return False
    params.append(session_id)
    with db_cursor() as cursor:
        cursor.execute(
            f"UPDATE summaries SET {', '.join(updates)} WHERE session_id = ?", params)
        return cursor.rowcount > 0


def insert_audio_chunk(session_id: str, file_path: str, duration_sec: Optional[int] = None) -> int:
    """Insert an audio chunk and return chunk_id."""
    created_ts = int(time.time() * 1000)

    with db_cursor() as cursor:
        cursor.execute(
            "INSERT INTO audio_chunks (session_id, file_path, duration_sec, created_ts) VALUES (?, ?, ?, ?)",
            (session_id, file_path, duration_sec, created_ts)
        )
        return cursor.lastrowid


def insert_transcript(session_id: str, text: str, chunk_id: Optional[int] = None,
                      language: Optional[str] = None) -> int:
    """Insert a transcript and return transcript_id."""
    created_ts = int(time.time() * 1000)
    word_count = len(text.split()) if text else 0

    with db_cursor() as cursor:
        cursor.execute(
            "INSERT INTO transcripts (session_id, chunk_id, text, language, word_count, created_ts) VALUES (?, ?, ?, ?, ?, ?)",
            (session_id, chunk_id, text, language, word_count, created_ts)
        )
        return cursor.lastrowid


def insert_summary(session_id: str, summary_text: str, repetition_json: Optional[List[Dict[str, Any]]] = None,
                   agitation_score: Optional[float] = None, mood_label: Optional[str] = None,
                   suggestions: Optional[str] = None, tags: Optional[List[str]] = None) -> int:
    """Insert a summary and return summary_id."""
    created_ts = int(time.time() * 1000)
    repetition_json_str = json.dumps(
        repetition_json) if repetition_json else None
    tags_str = json.dumps(tags) if tags else None

    with db_cursor() as cursor:
        cursor.execute(
            "INSERT INTO summaries (session_id, summary_text, repetition_json, agitation_score, mood_label, suggestions, tags, created_ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (session_id, summary_text, repetition_json_str,
             agitation_score, mood_label, suggestions, tags_str, created_ts)
        )
        return cursor.lastrowid


def get_session_detail(session_id: str) -> Optional[SessionDetail]:
    """Get full session details with all related data."""
    with db_connection() as conn:
        cursor = conn.cursor()

        # Get session
        cursor.execute(
            "SELECT session_id, session_type, start_ts, end_ts, notes FROM sessions WHERE session_id = ?",
            (session_id,)
        )
        session_row = cursor.fetchone()

        if not session_row:
            return None

        # Get audio chunks
        cursor.execute(
            "SELECT chunk_id, file_path, duration_sec, created_ts FROM audio_chunks WHERE session_id = ?",
            (session_id,)
        )
        audio_chunks = [
            AudioChunk(
                chunk_id=row["chunk_id"],
                file_path=row["file_path"],
                duration_sec=row["duration_sec"],
                created_ts=row["created_ts"]
            )
            for row in cursor.fetchall()
        ]

        # Get transcripts
        cursor.execute(
            "SELECT transcript_id, chunk_id, text, language, word_count, created_ts FROM transcripts WHERE session_id = ?",
            (session_id,)
        )
        transcripts = [
            Transcript(
                transcript_id=row["transcript_id"],
                chunk_id=row["chunk_id"],
                text=row["text"],
                language=row["language"],
                word_count=row["word_count"],
                created_ts=row["created_ts"]
            )
            for row in cursor.fetchall()
        ]

        # Get summary
        cursor.execute(
            "SELECT summary_id, summary_text, repetition_json, agitation_score, mood_label, suggestions, tags, created_ts FROM summaries WHERE session_id = ?",
            (session_id,)
        )
        summary_row = cursor.fetchone()
        summary = None
        if summary_row:
            summary = Summary(
                summary_id=summary_row["summary_id"],
                summary_text=summary_row["summary_text"],
                repetition_json=summary_row["repetition_json"],
                agitation_score=summary_row["agitation_score"],
                mood_label=summary_row["mood_label"],
                suggestions=summary_row["suggestions"],
                tags=summary_row["tags"],
                created_ts=summary_row["created_ts"]
            )

        return SessionDetail(
            session_id=session_row["session_id"],
            session_type=session_row["session_type"],
            start_ts=session_row["start_ts"],
            end_ts=session_row["end_ts"],
            notes=session_row["notes"],
            audio_chunks=audio_chunks,
            transcripts=transcripts,
            summary=summary
        )


def get_sessions_list(patient_id: str = DEFAULT_PATIENT_ID,
                      limit: int = 100, offset: int = 0) -> List[SessionListItem]:
    """Get list of sessions (for one patient) with summary snippets."""
    with db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                s.session_id,
                s.session_type,
                s.start_ts,
                s.end_ts,
                SUBSTR(sum.summary_text, 1, 200) as summary_text,
                sum.mood_label,
                sum.agitation_score
            FROM sessions s
            LEFT JOIN summaries sum ON s.session_id = sum.session_id
            WHERE s.patient_id = ?
            ORDER BY s.start_ts DESC
            LIMIT ? OFFSET ?
        """, (patient_id, limit, offset))

        return [
            SessionListItem(
                session_id=row["session_id"],
                session_type=row["session_type"],
                start_ts=row["start_ts"],
                end_ts=row["end_ts"],
                summary_text=row["summary_text"],
                mood_label=row["mood_label"],
                agitation_score=row["agitation_score"]
            )
            for row in cursor.fetchall()
        ]


def get_report_sessions(patient_id: str = DEFAULT_PATIENT_ID,
                        from_ts: Optional[int] = None,
                        to_ts: Optional[int] = None) -> List[Dict[str, Any]]:
    """Sessions joined with full summary fields for PDF report export.

    Ordered oldest -> newest (chronological, the natural reading order for a
    care report). Scoped to one patient; optional epoch-ms range filters on
    session start time. Returns plain dicts because this feeds the internal
    report builder, not an exposed JSON contract.
    """
    query = """
        SELECT
            s.session_id,
            s.session_type,
            s.start_ts,
            sum.summary_text,
            sum.mood_label,
            sum.agitation_score,
            sum.suggestions,
            sum.repetition_json
        FROM sessions s
        LEFT JOIN summaries sum ON s.session_id = sum.session_id
    """
    conditions = ["s.patient_id = ?"]
    params: List[Any] = [patient_id]
    if from_ts is not None:
        conditions.append("s.start_ts >= ?")
        params.append(from_ts)
    if to_ts is not None:
        conditions.append("s.start_ts <= ?")
        params.append(to_ts)
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY s.start_ts ASC"

    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


def get_trend_sessions(patient_id: str = DEFAULT_PATIENT_ID,
                       from_ts: Optional[int] = None,
                       to_ts: Optional[int] = None) -> List[Dict[str, Any]]:
    """Summarized sessions (for one patient) over an optional epoch-ms range.

    Inner-joins summaries (sessions without a summary contribute nothing to
    trends). Ordered oldest -> newest. Returns plain dicts feeding the internal
    aggregator in ``trends.py``, not an exposed JSON contract.
    """
    query = """
        SELECT
            s.session_id,
            s.start_ts,
            sum.agitation_score,
            sum.mood_label,
            sum.repetition_json
        FROM sessions s
        JOIN summaries sum ON s.session_id = sum.session_id
    """
    conditions = ["s.patient_id = ?"]
    params: List[Any] = [patient_id]
    if from_ts is not None:
        conditions.append("s.start_ts >= ?")
        params.append(from_ts)
    if to_ts is not None:
        conditions.append("s.start_ts <= ?")
        params.append(to_ts)
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY s.start_ts ASC"

    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


def delete_session(session_id: str) -> bool:
    """Delete a session (cascades to related tables)."""
    with db_cursor() as cursor:
        cursor.execute(
            "DELETE FROM sessions WHERE session_id = ?", (session_id,))
        return cursor.rowcount > 0


# ── Reminders (M3) ───────────────────────────────────────────────────────────

def _row_to_reminder(row) -> Reminder:
    return Reminder(
        reminder_id=row["reminder_id"],
        title=row["title"],
        kind=row["kind"],
        recurrence=row["recurrence"],
        due_ts=row["due_ts"],
        time_of_day=row["time_of_day"],
        notes=row["notes"],
        last_done_ts=row["last_done_ts"],
        active=row["active"],
        created_ts=row["created_ts"],
    )


def create_reminder(title: str, kind: str, recurrence: str = "once",
                    due_ts: Optional[int] = None, time_of_day: Optional[str] = None,
                    notes: Optional[str] = None,
                    patient_id: str = DEFAULT_PATIENT_ID) -> Reminder:
    """Insert a reminder (for one patient) and return the created row."""
    created_ts = int(time.time() * 1000)
    with db_cursor() as cursor:
        cursor.execute(
            """INSERT INTO reminders
               (title, kind, recurrence, due_ts, time_of_day, notes, created_ts, patient_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (title, kind, recurrence, due_ts, time_of_day, notes, created_ts, patient_id),
        )
        new_id = cursor.lastrowid
        cursor.execute("SELECT * FROM reminders WHERE reminder_id = ?", (new_id,))
        return _row_to_reminder(cursor.fetchone())


def get_reminders(patient_id: str = DEFAULT_PATIENT_ID,
                  include_inactive: bool = False) -> List[Reminder]:
    """List reminders for one patient, active-only by default. Newest first."""
    query = "SELECT * FROM reminders WHERE patient_id = ?"
    if not include_inactive:
        query += " AND active = 1"
    query += " ORDER BY created_ts DESC"
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, (patient_id,))
        return [_row_to_reminder(row) for row in cursor.fetchall()]


def get_reminder(reminder_id: int) -> Optional[Reminder]:
    with db_cursor() as cursor:
        cursor.execute("SELECT * FROM reminders WHERE reminder_id = ?", (reminder_id,))
        row = cursor.fetchone()
        return _row_to_reminder(row) if row else None


def update_reminder(reminder_id: int, fields: Dict[str, Any]) -> Optional[Reminder]:
    """Patch the given columns. Ignores unknown/None keys; no-op returns current."""
    allowed = {"title", "due_ts", "time_of_day", "notes", "last_done_ts", "active"}
    updates = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if not updates:
        return get_reminder(reminder_id)

    set_clause = ", ".join(f"{col} = ?" for col in updates)
    params = list(updates.values()) + [reminder_id]
    with db_cursor() as cursor:
        cursor.execute(
            f"UPDATE reminders SET {set_clause} WHERE reminder_id = ?", params)
        if cursor.rowcount == 0:
            return None
        cursor.execute("SELECT * FROM reminders WHERE reminder_id = ?", (reminder_id,))
        return _row_to_reminder(cursor.fetchone())


def mark_reminder_done(reminder_id: int) -> Optional[Reminder]:
    """Stamp last_done_ts = now. For daily reminders this marks today's
    occurrence handled; the client re-derives 'due again' the next day."""
    return update_reminder(reminder_id, {"last_done_ts": int(time.time() * 1000)})


def delete_reminder(reminder_id: int) -> bool:
    with db_cursor() as cursor:
        cursor.execute("DELETE FROM reminders WHERE reminder_id = ?", (reminder_id,))
        return cursor.rowcount > 0


# ── Caregivers / patients / memberships (M4) ─────────────────────────────────

def upsert_caregiver(caregiver_id: str, email: Optional[str],
                     display_name: Optional[str]) -> Caregiver:
    """Insert or refresh a caregiver, then bind any pending email invites to it.

    Called on the frontend's first contact after login. Invites created before
    this caregiver existed (status 'pending', matched by email) become active.
    """
    now = int(time.time() * 1000)
    with db_cursor() as cursor:
        cursor.execute(
            """INSERT INTO caregivers (caregiver_id, email, display_name, created_ts)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(caregiver_id) DO UPDATE SET
                   email = COALESCE(excluded.email, caregivers.email),
                   display_name = COALESCE(excluded.display_name, caregivers.display_name)""",
            (caregiver_id, email, display_name, now),
        )
        if email:
            # OR IGNORE: skip if the caregiver already has a membership for that patient.
            cursor.execute(
                """UPDATE OR IGNORE memberships
                   SET caregiver_id = ?, status = 'active'
                   WHERE caregiver_id IS NULL AND LOWER(invited_email) = LOWER(?)""",
                (caregiver_id, email),
            )
        cursor.execute("SELECT * FROM caregivers WHERE caregiver_id = ?", (caregiver_id,))
        row = cursor.fetchone()
        return Caregiver(
            caregiver_id=row["caregiver_id"], email=row["email"],
            display_name=row["display_name"], created_ts=row["created_ts"],
        )


def claim_default_patient_if_unowned(caregiver_id: str) -> None:
    """Give the first caregiver to appear ownership of the backfilled default
    patient (which holds all pre-M4 data), so existing sessions aren't orphaned."""
    with db_cursor() as cursor:
        cursor.execute(
            "SELECT COUNT(*) AS n FROM memberships WHERE patient_id = ?", (DEFAULT_PATIENT_ID,))
        if cursor.fetchone()["n"] == 0:
            cursor.execute(
                """INSERT INTO memberships (patient_id, caregiver_id, role, status, created_ts)
                   VALUES (?, ?, 'owner', 'active', ?)""",
                (DEFAULT_PATIENT_ID, caregiver_id, int(time.time() * 1000)),
            )


def get_caregiver_patients(caregiver_id: str) -> List[PatientWithRole]:
    """Patients this caregiver actively belongs to, with their role."""
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT p.patient_id, p.name, m.role
               FROM memberships m JOIN patients p ON m.patient_id = p.patient_id
               WHERE m.caregiver_id = ? AND m.status = 'active'
               ORDER BY p.created_ts""",
            (caregiver_id,),
        )
        return [
            PatientWithRole(patient_id=r["patient_id"], name=r["name"], role=r["role"])
            for r in cursor.fetchall()
        ]


def get_membership_role(patient_id: str, caregiver_id: str) -> Optional[str]:
    """The caregiver's role for a patient, or None if they're not a member."""
    with db_cursor() as cursor:
        cursor.execute(
            """SELECT role FROM memberships
               WHERE patient_id = ? AND caregiver_id = ? AND status = 'active'""",
            (patient_id, caregiver_id),
        )
        row = cursor.fetchone()
        return row["role"] if row else None


def create_patient(name: str, created_by: str) -> PatientWithRole:
    """Create a patient and make the creator its owner."""
    patient_id = str(uuid.uuid4())
    now = int(time.time() * 1000)
    with db_cursor() as cursor:
        cursor.execute(
            "INSERT INTO patients (patient_id, name, created_by, created_ts) VALUES (?, ?, ?, ?)",
            (patient_id, name, created_by, now),
        )
        cursor.execute(
            """INSERT INTO memberships (patient_id, caregiver_id, role, status, created_ts)
               VALUES (?, ?, 'owner', 'active', ?)""",
            (patient_id, created_by, now),
        )
    return PatientWithRole(patient_id=patient_id, name=name, role="owner")


def get_patient_members(patient_id: str) -> List[Member]:
    """All members (active + pending invites) for a patient."""
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT m.membership_id, m.caregiver_id, m.invited_email, m.role, m.status,
                      c.email AS c_email, c.display_name
               FROM memberships m
               LEFT JOIN caregivers c ON m.caregiver_id = c.caregiver_id
               WHERE m.patient_id = ?
               ORDER BY (m.role = 'owner') DESC, m.created_ts""",
            (patient_id,),
        )
        return [
            Member(
                membership_id=r["membership_id"],
                caregiver_id=r["caregiver_id"],
                email=r["c_email"] or r["invited_email"],
                display_name=r["display_name"],
                role=r["role"],
                status=r["status"],
            )
            for r in cursor.fetchall()
        ]


def invite_member(patient_id: str, email: str, role: str = "caregiver") -> Member:
    """Invite by email. If a caregiver with that email already exists, the
    membership is active immediately; otherwise it's pending until they sync.
    Raises ValueError if that person is already a member/invited."""
    email = email.strip()
    now = int(time.time() * 1000)
    with db_cursor() as cursor:
        cursor.execute("SELECT * FROM caregivers WHERE LOWER(email) = LOWER(?)", (email,))
        existing = cursor.fetchone()
        caregiver_id = existing["caregiver_id"] if existing else None
        status = "active" if existing else "pending"

        if caregiver_id:
            cursor.execute(
                "SELECT 1 FROM memberships WHERE patient_id = ? AND caregiver_id = ?",
                (patient_id, caregiver_id))
            if cursor.fetchone():
                raise ValueError("That caregiver is already on this patient's circle.")
        cursor.execute(
            "SELECT 1 FROM memberships WHERE patient_id = ? AND LOWER(invited_email) = LOWER(?)",
            (patient_id, email))
        if cursor.fetchone():
            raise ValueError("That email has already been invited.")

        cursor.execute(
            """INSERT INTO memberships
               (patient_id, caregiver_id, invited_email, role, status, created_ts)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (patient_id, caregiver_id, email, role, status, now),
        )
        membership_id = cursor.lastrowid
    return Member(
        membership_id=membership_id, caregiver_id=caregiver_id, email=email,
        display_name=existing["display_name"] if existing else None,
        role=role, status=status,
    )


def get_membership(membership_id: int) -> Optional[Dict[str, Any]]:
    with db_cursor() as cursor:
        cursor.execute("SELECT * FROM memberships WHERE membership_id = ?", (membership_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def count_active_owners(patient_id: str) -> int:
    with db_cursor() as cursor:
        cursor.execute(
            """SELECT COUNT(*) AS n FROM memberships
               WHERE patient_id = ? AND role = 'owner' AND status = 'active'""",
            (patient_id,))
        return cursor.fetchone()["n"]


def remove_member(membership_id: int) -> bool:
    with db_cursor() as cursor:
        cursor.execute("DELETE FROM memberships WHERE membership_id = ?", (membership_id,))
        return cursor.rowcount > 0


def get_session_transcripts(session_id: str) -> List[Transcript]:
    """Get all transcripts for a session."""
    with db_cursor() as cursor:
        cursor.execute(
            "SELECT transcript_id, chunk_id, text, language, word_count, created_ts FROM transcripts WHERE session_id = ? ORDER BY created_ts",
            (session_id,)
        )
        return [
            Transcript(
                transcript_id=row["transcript_id"],
                chunk_id=row["chunk_id"],
                text=row["text"],
                language=row["language"],
                word_count=row["word_count"],
                created_ts=row["created_ts"]
            )
            for row in cursor.fetchall()
        ]
