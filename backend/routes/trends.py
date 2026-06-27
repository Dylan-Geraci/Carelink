# /trends - aggregated mood/agitation/repetition trends for the insights panel

import crud
import trends
from fastapi import APIRouter, HTTPException, status
from models import TrendsResponse

router = APIRouter(prefix="/api", tags=["trends"])


@router.get("/trends", response_model=TrendsResponse)
async def get_trends(from_ts: int | None = None, to_ts: int | None = None):
    """Aggregate summarized sessions over an optional epoch-ms range.

    Always 200 with a valid (possibly empty) payload — an empty range yields
    zero sessions and a "No data" calm label rather than an error.
    """
    try:
        rows = crud.get_trend_sessions(from_ts, to_ts)
        return trends.compute_trends(rows, from_ts, to_ts)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute trends: {str(e)}",
        )
