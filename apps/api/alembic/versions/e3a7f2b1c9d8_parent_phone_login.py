"""parent_phone_login

Revision ID: e3a7f2b1c9d8
Revises: fd5fe20f1357
Create Date: 2026-05-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e3a7f2b1c9d8"
down_revision: Union[str, None] = "fd5fe20f1357"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Allow email to be NULL (parents log in with phone, no email required)
    op.alter_column("users", "email", existing_type=sa.String(255), nullable=True)
    # Partial unique index: only parents need unique phones (their login identifier)
    op.execute(
        "CREATE UNIQUE INDEX ix_users_parent_phone ON users (phone) "
        "WHERE role = 'parent' AND phone IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_users_parent_phone")
    op.alter_column("users", "email", existing_type=sa.String(255), nullable=False)
