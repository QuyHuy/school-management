from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.parent.get_child_attendance import GetChildAttendanceUseCase
from app.application.use_cases.parent.get_child_grades import GetChildGradesUseCase
from app.application.use_cases.parent.get_children import GetChildrenUseCase
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import require_role
from app.interfaces.api.v1.schemas.parent import (
    ChildAttendanceRowSchema,
    ChildGradeRowSchema,
    ChildInfoSchema,
)

router = APIRouter()
_parent = require_role("parent")


@router.get("/children", response_model=list[ChildInfoSchema])
async def list_children(
    token=Depends(_parent),
    db: AsyncSession = Depends(get_db),
):
    uc = GetChildrenUseCase(db)
    return await uc.execute(token.user_id, token.org_id)


@router.get("/children/{student_id}/grades", response_model=list[ChildGradeRowSchema])
async def get_child_grades(
    student_id: UUID,
    token=Depends(_parent),
    db: AsyncSession = Depends(get_db),
):
    uc = GetChildGradesUseCase(db)
    return await uc.execute(token.user_id, student_id, token.org_id)


@router.get("/children/{student_id}/attendance", response_model=list[ChildAttendanceRowSchema])
async def get_child_attendance(
    student_id: UUID,
    token=Depends(_parent),
    db: AsyncSession = Depends(get_db),
):
    uc = GetChildAttendanceUseCase(db)
    return await uc.execute(token.user_id, student_id, token.org_id)
