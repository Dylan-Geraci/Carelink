from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# Request Models


class StartSessionRequest(BaseModel):
    session_type: str
    timestamp: int = Field(..., description="Timestamp in milliseconds")


class TranscribeRequest(BaseModel):
    session_id: str
    audio_path: str


class SummarizeRequest(BaseModel):
    session_id: str
    transcript: str
    session_type: str


class StoreSessionRequest(BaseModel):
    session_id: str
    session_type: str
    transcript: str
    summary: str
    notes: Optional[str] = None
    timestamp: int = Field(..., description="End timestamp in milliseconds")


# Prompt Chaining Request/Response Models


class ExtractRequest(BaseModel):
    transcript: str


class ExtractResponse(BaseModel):
    data: Dict[str, Any]


class AnalyzeRequest(BaseModel):
    extracted_data: Dict[str, Any]


class AnalyzeResponse(BaseModel):
    data: Dict[str, Any]


class ChainSummarizeRequest(BaseModel):
    session_id: str
    extracted_data: Dict[str, Any]
    analyzed_data: Dict[str, Any]


class SummarizeResponse(BaseModel):
    summary: str
    tone: str
    repeated_questions: List[str]
    key_moments: List[str]
    tags: List[str]
    agitation_score: float
    mood_label: str

# Response Models


class StartSessionResponse(BaseModel):
    session_id: str


class TranscribeResponse(BaseModel):
    transcript: str


class AudioChunk(BaseModel):
    chunk_id: int
    file_path: str
    duration_sec: Optional[int]
    created_ts: int


class Transcript(BaseModel):
    transcript_id: int
    chunk_id: Optional[int]
    text: str
    language: Optional[str]
    word_count: Optional[int]
    created_ts: int


class Summary(BaseModel):
    summary_id: int
    summary_text: str
    repetition_json: Optional[str]
    agitation_score: Optional[float]
    mood_label: Optional[str]
    suggestions: Optional[str]
    created_ts: int


class SessionDetail(BaseModel):
    session_id: str
    session_type: str
    start_ts: int
    end_ts: Optional[int]
    notes: Optional[str]
    audio_chunks: List[AudioChunk]
    transcripts: List[Transcript]
    summary: Optional[Summary]


class SessionListItem(BaseModel):
    session_id: str
    session_type: str
    start_ts: int
    end_ts: Optional[int] = None
    summary_text: Optional[str] = None
    mood_label: Optional[str] = None
    agitation_score: Optional[float] = None


class SessionListResponse(BaseModel):
    sessions: List[SessionListItem]


# Trend analysis (M2)


class TrendPoint(BaseModel):
    """One week's worth of aggregated session data."""
    week_start_ts: int                      # epoch ms, local Sunday 00:00
    session_count: int
    avg_agitation: Optional[float] = None   # 0-10 scale; None if no scored sessions


class MoodSlice(BaseModel):
    mood_label: str
    count: int


class TrendsResponse(BaseModel):
    from_ts: Optional[int] = None
    to_ts: Optional[int] = None
    total_sessions: int                     # sessions with a summary in range
    avg_agitation: Optional[float] = None   # mean across all scored sessions, 0-10
    calm_label: str                         # "Calm" | "Mixed" | "Elevated" | "No data"
    mood_distribution: List[MoodSlice]
    top_phrase: Optional[str] = None
    top_phrase_count: int = 0
    weekly: List[TrendPoint]


# Smart reminders (M3)


class ReminderCreate(BaseModel):
    title: str
    kind: str                               # 'medication' | 'appointment'
    recurrence: str = "once"                # 'once' | 'daily'
    due_ts: Optional[int] = None            # one-off: absolute epoch ms
    time_of_day: Optional[str] = None       # daily: 'HH:MM' local
    notes: Optional[str] = None


class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    due_ts: Optional[int] = None
    time_of_day: Optional[str] = None
    notes: Optional[str] = None
    last_done_ts: Optional[int] = None
    active: Optional[int] = None


class Reminder(BaseModel):
    reminder_id: int
    title: str
    kind: str
    recurrence: str
    due_ts: Optional[int] = None
    time_of_day: Optional[str] = None
    notes: Optional[str] = None
    last_done_ts: Optional[int] = None
    active: int
    created_ts: int


class ReminderListResponse(BaseModel):
    reminders: List[Reminder]


# Local multi-profile team collaboration (M4)


class Caregiver(BaseModel):
    caregiver_id: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    created_ts: int


class CaregiverSyncRequest(BaseModel):
    caregiver_id: str
    email: Optional[str] = None
    display_name: Optional[str] = None


class PatientWithRole(BaseModel):
    patient_id: str
    name: str
    role: str                               # 'owner' | 'caregiver'


class PatientCreate(BaseModel):
    name: str


class CaregiverSyncResponse(BaseModel):
    caregiver: Caregiver
    patients: List[PatientWithRole]


class PatientListResponse(BaseModel):
    patients: List[PatientWithRole]


class Member(BaseModel):
    membership_id: int
    caregiver_id: Optional[str] = None
    email: Optional[str] = None
    display_name: Optional[str] = None
    role: str                               # 'owner' | 'caregiver'
    status: str                             # 'active' | 'pending'


class MemberListResponse(BaseModel):
    members: List[Member]


class MemberInviteRequest(BaseModel):
    email: str
    role: str = "caregiver"

# Database Models (for internal use)


class SessionDB(BaseModel):
    session_id: str
    session_type: str
    start_ts: int
    end_ts: Optional[int]
    notes: Optional[str]
