from unittest.mock import AsyncMock, MagicMock

from app.infrastructure.db.repositories.user_repository import SQLUserRepository


async def test_get_by_email_returns_none_when_not_found():
    session = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    session.execute.return_value = result_mock

    repo = SQLUserRepository(session)
    user = await repo.get_by_email("notfound@example.com")
    assert user is None


async def test_get_by_id_returns_none_when_not_found():
    import uuid
    session = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    session.execute.return_value = result_mock

    repo = SQLUserRepository(session)
    user = await repo.get_by_id(uuid.uuid4())
    assert user is None
