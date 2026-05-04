from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.student import Student
from app.domain.repositories.student_repository import IStudentRepository
from app.infrastructure.db.models.student import StudentModel


def _to_domain(row: StudentModel) -> Student:
    return Student(
        id=row.id,
        organization_id=row.organization_id,
        name=row.name,
        date_of_birth=row.date_of_birth,
        note=row.note,
        parent_id=row.parent_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
        deleted_at=row.deleted_at,
    )


class SQLStudentRepository(IStudentRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, student: Student) -> Student:
        row = StudentModel(
            id=student.id,
            organization_id=student.organization_id,
            name=student.name,
            date_of_birth=student.date_of_birth,
            note=student.note,
            parent_id=student.parent_id,
        )
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return _to_domain(row)

    async def get_by_id(self, student_id: UUID, org_id: UUID) -> Student | None:
        result = await self._session.execute(
            select(StudentModel).where(
                StudentModel.id == student_id,
                StudentModel.organization_id == org_id,
                StudentModel.deleted_at.is_(None),
            )
        )
        row = result.scalar_one_or_none()
        return _to_domain(row) if row else None

    async def list_by_org(self, org_id: UUID) -> list[Student]:
        result = await self._session.execute(
            select(StudentModel).where(
                StudentModel.organization_id == org_id,
                StudentModel.deleted_at.is_(None),
            ).order_by(StudentModel.name)
        )
        return [_to_domain(r) for r in result.scalars()]
