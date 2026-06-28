"""Request-scoped identity for the trusted-local backend (M4).

The backend does not verify tokens — it's a local single-machine service. The
frontend passes the caregiver identity and the active patient as headers; we
fall back to a local caregiver / the default patient when they're absent, so
direct/legacy calls keep working.
"""

from typing import Optional

from fastapi import Header

from database import DEFAULT_PATIENT_ID

LOCAL_CAREGIVER_ID = "local-caregiver"


def get_patient_id(x_patient_id: Optional[str] = Header(default=None)) -> str:
    return x_patient_id or DEFAULT_PATIENT_ID


def get_caregiver_id(x_caregiver_id: Optional[str] = Header(default=None)) -> str:
    return x_caregiver_id or LOCAL_CAREGIVER_ID
