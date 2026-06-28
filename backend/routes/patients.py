# /caregivers + /patients - local multi-profile team collaboration (M4)

import crud
from deps import get_caregiver_id
from fastapi import APIRouter, Depends, HTTPException, status
from models import (
    CaregiverSyncRequest, CaregiverSyncResponse, Member, MemberInviteRequest,
    MemberListResponse, PatientCreate, PatientListResponse, PatientWithRole,
)

router = APIRouter(prefix="/api", tags=["patients"])

_ROLES = {"owner", "caregiver"}


def _require_membership(patient_id: str, caregiver_id: str) -> str:
    """Ensure the caregiver belongs to the patient; return their role."""
    role = crud.get_membership_role(patient_id, caregiver_id)
    if role is None:
        raise HTTPException(status_code=403, detail="You don't have access to this patient.")
    return role


def _require_owner(patient_id: str, caregiver_id: str) -> None:
    if _require_membership(patient_id, caregiver_id) != "owner":
        raise HTTPException(status_code=403, detail="Only an owner can manage the care circle.")


@router.post("/caregivers/sync", response_model=CaregiverSyncResponse)
async def sync_caregiver(req: CaregiverSyncRequest):
    """Upsert the caregiver on login, bind pending invites, and return their
    patients. The first caregiver to sync claims the backfilled default patient."""
    try:
        caregiver = crud.upsert_caregiver(req.caregiver_id, req.email, req.display_name)
        crud.claim_default_patient_if_unowned(req.caregiver_id)
        patients = crud.get_caregiver_patients(req.caregiver_id)
        return CaregiverSyncResponse(caregiver=caregiver, patients=patients)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync caregiver: {str(e)}")


@router.get("/patients", response_model=PatientListResponse)
async def list_patients(caregiver_id: str = Depends(get_caregiver_id)):
    return PatientListResponse(patients=crud.get_caregiver_patients(caregiver_id))


@router.post("/patients", response_model=PatientWithRole, status_code=status.HTTP_201_CREATED)
async def create_patient(req: PatientCreate, caregiver_id: str = Depends(get_caregiver_id)):
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Give the patient a name.")
    return crud.create_patient(name, caregiver_id)


@router.get("/patients/{patient_id}/members", response_model=MemberListResponse)
async def list_members(patient_id: str, caregiver_id: str = Depends(get_caregiver_id)):
    _require_membership(patient_id, caregiver_id)
    return MemberListResponse(members=crud.get_patient_members(patient_id))


@router.post("/patients/{patient_id}/members", response_model=Member,
             status_code=status.HTTP_201_CREATED)
async def invite_member(patient_id: str, req: MemberInviteRequest,
                        caregiver_id: str = Depends(get_caregiver_id)):
    _require_owner(patient_id, caregiver_id)
    if req.role not in _ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of {sorted(_ROLES)}")
    if not req.email.strip():
        raise HTTPException(status_code=400, detail="An email is required to invite someone.")
    try:
        return crud.invite_member(patient_id, req.email, req.role)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.delete("/patients/{patient_id}/members/{membership_id}",
               status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(patient_id: str, membership_id: int,
                        caregiver_id: str = Depends(get_caregiver_id)):
    _require_owner(patient_id, caregiver_id)
    member = crud.get_membership(membership_id)
    if not member or member["patient_id"] != patient_id:
        raise HTTPException(status_code=404, detail="Member not found")
    # Don't strand a patient with no owner.
    if member["role"] == "owner" and member["status"] == "active" \
            and crud.count_active_owners(patient_id) <= 1:
        raise HTTPException(status_code=409, detail="A patient must keep at least one owner.")
    crud.remove_member(membership_id)
