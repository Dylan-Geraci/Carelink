# /reminders - in-app medication & appointment reminders (M3)

import crud
from deps import get_patient_id
from fastapi import APIRouter, Depends, HTTPException, status
from models import Reminder, ReminderCreate, ReminderListResponse, ReminderUpdate

router = APIRouter(prefix="/api", tags=["reminders"])

_KINDS = {"medication", "appointment"}
_RECURRENCES = {"once", "daily"}


def _validate(kind: str, recurrence: str, due_ts, time_of_day):
    """Shared validation for create. Raises 400 with a caregiver-readable detail."""
    if kind not in _KINDS:
        raise HTTPException(status_code=400, detail=f"kind must be one of {sorted(_KINDS)}")
    if recurrence not in _RECURRENCES:
        raise HTTPException(status_code=400, detail=f"recurrence must be one of {sorted(_RECURRENCES)}")
    if recurrence == "once" and due_ts is None:
        raise HTTPException(status_code=400, detail="A one-off reminder needs a due date and time.")
    if recurrence == "daily" and not time_of_day:
        raise HTTPException(status_code=400, detail="A daily reminder needs a time of day.")


@router.get("/reminders", response_model=ReminderListResponse)
async def list_reminders(include_inactive: bool = False,
                         patient_id: str = Depends(get_patient_id)):
    try:
        return ReminderListResponse(reminders=crud.get_reminders(patient_id, include_inactive))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list reminders: {str(e)}")


@router.post("/reminders", response_model=Reminder, status_code=status.HTTP_201_CREATED)
async def create_reminder(req: ReminderCreate, patient_id: str = Depends(get_patient_id)):
    _validate(req.kind, req.recurrence, req.due_ts, req.time_of_day)
    try:
        return crud.create_reminder(
            title=req.title.strip(),
            kind=req.kind,
            recurrence=req.recurrence,
            due_ts=req.due_ts,
            time_of_day=req.time_of_day,
            notes=req.notes,
            patient_id=patient_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create reminder: {str(e)}")


@router.patch("/reminders/{reminder_id}", response_model=Reminder)
async def update_reminder(reminder_id: int, req: ReminderUpdate):
    updated = crud.update_reminder(reminder_id, req.model_dump(exclude_unset=True))
    if updated is None:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return updated


@router.post("/reminders/{reminder_id}/done", response_model=Reminder)
async def complete_reminder(reminder_id: int):
    """Mark a reminder done now (today's dose, or a one-off completed)."""
    updated = crud.mark_reminder_done(reminder_id)
    if updated is None:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return updated


@router.delete("/reminders/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(reminder_id: int):
    if not crud.delete_reminder(reminder_id):
        raise HTTPException(status_code=404, detail="Reminder not found")
