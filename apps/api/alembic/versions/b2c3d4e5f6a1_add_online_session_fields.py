"""add online session fields

Revision ID: b2c3d4e5f6a1
Revises: f1a2b3c4d5e6
Create Date: 2026-05-14 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "b2c3d4e5f6a1"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS mode VARCHAR(10) NOT NULL DEFAULT 'offline'"
    )
    op.execute("ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS start_time TIME")
    op.execute("ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS meet_link VARCHAR(100)")
    op.execute(
        "ALTER TABLE class_sessions ADD CONSTRAINT ck_session_mode CHECK (mode IN ('online', 'offline'))"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE class_sessions DROP CONSTRAINT IF EXISTS ck_session_mode")
    op.execute("ALTER TABLE class_sessions DROP COLUMN IF EXISTS meet_link")
    op.execute("ALTER TABLE class_sessions DROP COLUMN IF EXISTS start_time")
    op.execute("ALTER TABLE class_sessions DROP COLUMN IF EXISTS mode")
