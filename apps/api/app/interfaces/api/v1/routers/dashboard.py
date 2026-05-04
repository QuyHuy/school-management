from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.dashboard.get_teacher_dashboard import GetTeacherDashboardUseCase
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import require_role
from app.interfaces.api.v1.schemas.dashboard import DashboardSummarySchema

router = APIRouter()
_teacher = require_role("teacher", "admin")


@router.get("/dashboard", response_model=DashboardSummarySchema)
async def get_dashboard(
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = GetTeacherDashboardUseCase(db)
    return await uc.execute(token.user_id, token.org_id)
