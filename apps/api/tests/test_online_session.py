import re
import uuid
from datetime import date, time
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.application.use_cases.attendance.create_session import CreateSessionUseCase
from app.application.use_cases.attendance.update_session import UpdateSessionUseCase
from app.domain.entities.attendance import ClassSession
from app.infrastructure.utils.meet import generate_meet_link

CLASS_ID = uuid.uuid4()
ORG_ID = uuid.uuid4()
SESSION_ID = uuid.uuid4()
TODAY = date.today()


def _make_class_repo(found: bool = True) -> AsyncMock:
    repo = AsyncMock()
    repo.get_by_id = AsyncMock(return_value=MagicMock() if found else None)
    return repo


def _make_att_repo(session_exists: bool = False) -> AsyncMock:
    repo = AsyncMock()
    repo.session_exists_for_date = AsyncMock(return_value=session_exists)
    repo.create_session = AsyncMock(side_effect=lambda s: s)
    repo.get_session = AsyncMock(return_value=ClassSession(
        id=SESSION_ID, class_id=CLASS_ID, date=TODAY, notes=None,
        created_at=MagicMock(), mode="offline", start_time=None, meet_link=None,
    ))
    repo.update_session = AsyncMock(side_effect=lambda sid, cid, notes, mode, st, ml: ClassSession(
        id=SESSION_ID, class_id=CLASS_ID, date=TODAY, notes=notes,
        created_at=MagicMock(), mode=mode, start_time=st, meet_link=ml,
    ))
    return repo


def test_generate_meet_link_format():
    link = generate_meet_link()
    assert re.fullmatch(r"https://meet\.google\.com/[a-z]{3}-[a-z]{4}-[a-z]{3}", link)


def test_generate_meet_link_is_random():
    links = {generate_meet_link() for _ in range(20)}
    assert len(links) > 10


@pytest.mark.asyncio
async def test_create_offline_session_no_link():
    uc = CreateSessionUseCase(_make_class_repo(), _make_att_repo())
    session = await uc.execute(CLASS_ID, ORG_ID, TODAY, None, mode="offline", start_time=None)
    assert session.mode == "offline"
    assert session.meet_link is None
    assert session.start_time is None


@pytest.mark.asyncio
async def test_create_online_session_generates_link():
    uc = CreateSessionUseCase(_make_class_repo(), _make_att_repo())
    t = time(14, 0)
    session = await uc.execute(CLASS_ID, ORG_ID, TODAY, None, mode="online", start_time=t)
    assert session.mode == "online"
    assert session.meet_link is not None
    assert session.meet_link.startswith("https://meet.google.com/")
    assert session.start_time == t


@pytest.mark.asyncio
async def test_update_offline_to_online_generates_link():
    att_repo = _make_att_repo()
    uc = UpdateSessionUseCase(_make_class_repo(), att_repo)
    session = await uc.execute(CLASS_ID, SESSION_ID, ORG_ID, None, mode="online", start_time=time(9, 0))
    assert session.mode == "online"
    assert session.meet_link is not None


@pytest.mark.asyncio
async def test_update_online_to_online_keeps_existing_link():
    att_repo = _make_att_repo()
    existing_link = "https://meet.google.com/abc-defg-hij"
    att_repo.get_session = AsyncMock(return_value=ClassSession(
        id=SESSION_ID, class_id=CLASS_ID, date=TODAY, notes=None,
        created_at=MagicMock(), mode="online", start_time=time(14, 0), meet_link=existing_link,
    ))
    uc = UpdateSessionUseCase(_make_class_repo(), att_repo)
    session = await uc.execute(CLASS_ID, SESSION_ID, ORG_ID, None, mode="online", start_time=time(14, 0))
    assert session.meet_link == existing_link
