import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.domain.repositories.zalo_repository import ZaloBinding
from app.infrastructure.db.models.zalo import ZaloBindingModel
from app.infrastructure.db.repositories.zalo_repository import SQLZaloRepository


def _make_model(**kwargs) -> ZaloBindingModel:
    m = ZaloBindingModel()
    m.id = kwargs.get("id", uuid.uuid4())
    m.organization_id = kwargs.get("organization_id", uuid.uuid4())
    m.user_id = kwargs.get("user_id", uuid.uuid4())
    m.zalo_user_id = kwargs.get("zalo_user_id", "zalo123")
    m.is_following = kwargs.get("is_following", True)
    m.bound_at = datetime.now(UTC)
    m.updated_at = datetime.now(UTC)
    return m


@pytest.mark.asyncio
async def test_get_by_user_id_returns_none_when_missing():
    db = MagicMock()
    db.scalar = AsyncMock(return_value=None)
    repo = SQLZaloRepository(db)
    result = await repo.get_by_user_id(uuid.uuid4())
    assert result is None


@pytest.mark.asyncio
async def test_get_by_user_id_returns_entity():
    user_id = uuid.uuid4()
    model = _make_model(user_id=user_id, zalo_user_id="zalo999")
    db = MagicMock()
    db.scalar = AsyncMock(return_value=model)
    repo = SQLZaloRepository(db)
    result = await repo.get_by_user_id(user_id)
    assert isinstance(result, ZaloBinding)
    assert result.zalo_user_id == "zalo999"


@pytest.mark.asyncio
async def test_set_following_calls_execute():
    db = MagicMock()
    db.execute = AsyncMock(return_value=None)
    repo = SQLZaloRepository(db)
    await repo.set_following("zalo123", uuid.uuid4(), False)
    db.execute.assert_called_once()
