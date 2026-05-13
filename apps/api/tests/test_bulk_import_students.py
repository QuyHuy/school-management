from datetime import date
from unittest.mock import AsyncMock, patch

import pytest

from app.application.use_cases.students.bulk_import_students import (
    BulkImportStudentsUseCase,
    PreviewRow,
)

ORG = "00000000-0000-0000-0000-000000000001"
TEACHER = "00000000-0000-0000-0000-000000000002"


def _csv(rows: list[str]) -> bytes:
    return ("name,grade,date_of_birth,note\n" + "\n".join(rows)).encode()


@pytest.mark.asyncio
async def test_preview_valid_rows():
    csv_bytes = _csv(["Nguyễn Văn An,5,2015-03-20,ghi chú", "Trần Thị Bình,3,,"])
    uc = BulkImportStudentsUseCase(student_repo=AsyncMock(), user_repo=AsyncMock())
    result = await uc.preview(csv_bytes, ORG)
    assert result.total_rows == 2
    assert len(result.valid) == 2
    assert len(result.invalid) == 0
    assert result.valid[0].name == "Nguyễn Văn An"
    assert result.valid[0].grade == 5
    assert result.valid[0].date_of_birth == date(2015, 3, 20)
    assert result.valid[1].date_of_birth is None


@pytest.mark.asyncio
async def test_preview_invalid_name():
    csv_bytes = _csv([",5,,"])
    uc = BulkImportStudentsUseCase(student_repo=AsyncMock(), user_repo=AsyncMock())
    result = await uc.preview(csv_bytes, ORG)
    assert len(result.invalid) == 1
    assert any("tên" in e.lower() for e in result.invalid[0].errors)


@pytest.mark.asyncio
async def test_preview_invalid_grade():
    csv_bytes = _csv(["An,abc,,"])
    uc = BulkImportStudentsUseCase(student_repo=AsyncMock(), user_repo=AsyncMock())
    result = await uc.preview(csv_bytes, ORG)
    assert len(result.invalid) == 1
    assert any("khối" in e.lower() for e in result.invalid[0].errors)


@pytest.mark.asyncio
async def test_preview_grade_out_of_range():
    csv_bytes = _csv(["An,13,,"])
    uc = BulkImportStudentsUseCase(student_repo=AsyncMock(), user_repo=AsyncMock())
    result = await uc.preview(csv_bytes, ORG)
    assert len(result.invalid) == 1


@pytest.mark.asyncio
async def test_preview_invalid_date():
    csv_bytes = _csv(["An,5,20-03-2015,"])
    uc = BulkImportStudentsUseCase(student_repo=AsyncMock(), user_repo=AsyncMock())
    result = await uc.preview(csv_bytes, ORG)
    assert len(result.invalid) == 1
    assert any("ngày" in e.lower() for e in result.invalid[0].errors)


@pytest.mark.asyncio
async def test_preview_mixed():
    csv_bytes = _csv(["An,5,,", ",3,,", "Bình,15,,"])
    uc = BulkImportStudentsUseCase(student_repo=AsyncMock(), user_repo=AsyncMock())
    result = await uc.preview(csv_bytes, ORG)
    assert result.total_rows == 3
    assert len(result.valid) == 1
    assert len(result.invalid) == 2


@pytest.mark.asyncio
async def test_confirm_creates_students():
    rows = [
        PreviewRow(row=1, name="An", grade=5, date_of_birth=None, note=None, errors=[]),
        PreviewRow(row=2, name="Bình", grade=3, date_of_birth=None, note=None, errors=[]),
    ]
    student_repo = AsyncMock()
    user_repo = AsyncMock()
    uc = BulkImportStudentsUseCase(student_repo=student_repo, user_repo=user_repo)

    with patch(
        "app.application.use_cases.students.bulk_import_students.CreateStudentUseCase"
    ) as MockUC:
        mock_instance = MockUC.return_value
        mock_instance.execute = AsyncMock(return_value=AsyncMock())
        result = await uc.confirm(rows, ORG, TEACHER)

    assert mock_instance.execute.call_count == 2
    assert result.created == 2
    assert result.failed == []


@pytest.mark.asyncio
async def test_confirm_skips_invalid_rows():
    rows = [
        PreviewRow(row=1, name="An", grade=5, date_of_birth=None, note=None, errors=[]),
        PreviewRow(row=2, name="", grade=None, date_of_birth=None, note=None, errors=["Tên là bắt buộc"]),
    ]
    student_repo = AsyncMock()
    user_repo = AsyncMock()
    uc = BulkImportStudentsUseCase(student_repo=student_repo, user_repo=user_repo)

    with patch(
        "app.application.use_cases.students.bulk_import_students.CreateStudentUseCase"
    ) as MockUC:
        mock_instance = MockUC.return_value
        mock_instance.execute = AsyncMock(return_value=AsyncMock())
        result = await uc.confirm(rows, ORG, TEACHER)

    assert mock_instance.execute.call_count == 1  # only valid row processed
    assert result.created == 1
    assert len(result.failed) == 1
    assert result.failed[0]["row"] == 2


@pytest.mark.asyncio
async def test_template_endpoint():
    from unittest.mock import MagicMock

    from httpx import ASGITransport, AsyncClient

    import app.interfaces.api.v1.routers.students as students_router
    from app.main import app as fastapi_app

    fake_token = MagicMock()
    fastapi_app.dependency_overrides[students_router._teacher_or_admin] = lambda: fake_token

    transport = ASGITransport(app=fastapi_app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/students/import/template")
        assert resp.status_code == 200
        assert "text/csv" in resp.headers["content-type"]
        assert "name,grade,date_of_birth,note" in resp.text
    finally:
        fastapi_app.dependency_overrides.clear()
