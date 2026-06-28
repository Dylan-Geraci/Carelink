# /start-session, /store-session, /session/{id}, /sessions

from models import (
    StartSessionRequest, StartSessionResponse,
    StoreSessionRequest, SessionDetail, SessionListResponse,
    SessionNoteUpdate, SummaryUpdate
)
import crud
from deps import get_patient_id
from fastapi import APIRouter, Depends, HTTPException, status


router = APIRouter(prefix="/api", tags=["sessions"])


@router.post("/start-session", response_model=StartSessionResponse)
async def start_session(request: StartSessionRequest):
    """Start a new session and return session_id."""
    try:
        session_id = crud.create_session(
            request.session_type, request.timestamp)
        return StartSessionResponse(session_id=session_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create session: {str(e)}"
        )


@router.post("/store-session")
async def store_session(request: StoreSessionRequest):
    """Finalize a session by updating end timestamp, notes, and storing summary."""
    try:
        # Check if session exists
        session = crud.get_session(request.session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )

        # Update session end timestamp and notes
        success = crud.update_session_end(
            request.session_id,
            request.timestamp,
            request.notes
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update session"
            )

        # Store the transcript if provided
        if request.transcript:
            crud.insert_transcript(request.session_id, request.transcript)

        # Store the summary if provided
        if request.summary:
            crud.insert_summary(request.session_id, request.summary)

        return {"message": "Session stored successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store session: {str(e)}"
        )


@router.get("/session/{session_id}", response_model=SessionDetail)
async def get_session(session_id: str):
    """Get full session details including transcripts and summary."""
    try:
        session_detail = crud.get_session_detail(session_id)
        if not session_detail:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        return session_detail
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve session: {str(e)}"
        )


@router.get("/sessions", response_model=SessionListResponse)
async def get_sessions(limit: int = 100, offset: int = 0,
                       patient_id: str = Depends(get_patient_id)):
    """Get list of sessions (for the active patient) with summary snippets."""
    try:
        sessions = crud.get_sessions_list(patient_id, limit, offset)
        return SessionListResponse(sessions=sessions)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve sessions: {str(e)}"
        )


@router.patch("/session/{session_id}/note", response_model=SessionDetail)
async def update_session_note(session_id: str, req: SessionNoteUpdate):
    """Save the caregiver's reflection note onto a session."""
    if not crud.update_session_note(session_id, req.notes):
        raise HTTPException(status_code=404, detail="Session not found")
    return crud.get_session_detail(session_id)


@router.patch("/session/{session_id}/summary", response_model=SessionDetail)
async def update_session_summary(session_id: str, req: SummaryUpdate):
    """Edit a session's AI summary text and/or its tags."""
    if req.summary_text is None and req.tags is None:
        raise HTTPException(status_code=400, detail="Provide summary_text or tags to update.")
    if not crud.update_summary_fields(session_id, req.summary_text, req.tags):
        raise HTTPException(status_code=404, detail="No summary found for this session yet.")
    return crud.get_session_detail(session_id)


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and all related data."""
    try:
        success = crud.delete_session(session_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        return {"message": "Session deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete session: {str(e)}"
        )
