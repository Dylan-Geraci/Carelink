# /export/report - downloadable PDF care summary for medical visits

from datetime import datetime

import crud
import report
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response

router = APIRouter(prefix="/api", tags=["export"])


@router.get("/export/report")
async def export_report(from_ts: int | None = None, to_ts: int | None = None):
    """Generate a care-summary PDF over an optional epoch-ms range.

    Returns `application/pdf` as a file download. Always 200 with a valid PDF
    (an empty range yields a 'no sessions' document rather than an error).
    """
    try:
        rows = crud.get_report_sessions(from_ts, to_ts)
        pdf_bytes = report.build_care_report_pdf(rows, from_ts, to_ts)
        filename = f"carelink-care-report-{datetime.now():%Y%m%d}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report: {str(e)}",
        )
