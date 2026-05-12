"""sync_model_schema

Revision ID: f1a2b3c4d5e6
Revises: 239f3ff7f52b
Create Date: 2026-05-12 18:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "239f3ff7f52b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("classes", sa.Column("grade", sa.SmallInteger(), nullable=True))
    op.add_column("students", sa.Column("student_code", sa.String(length=50), nullable=True))
    op.add_column("students", sa.Column("grade", sa.SmallInteger(), nullable=True))

    # Revert e3a7f2b1c9d8: email was made nullable for parent phone login;
    # parents now have an email column populated, so NOT NULL is enforced again.
    op.execute("DROP INDEX IF EXISTS ix_users_parent_phone")
    op.alter_column("users", "email", existing_type=sa.String(255), nullable=False)

    # Remove redundant unnamed unique constraint on zalo_bindings.user_id
    # (uniqueness is already enforced by unique index ix_zalo_bindings_user_id).
    op.drop_constraint("zalo_bindings_user_id_key", "zalo_bindings", type_="unique")


def downgrade() -> None:
    op.create_unique_constraint("zalo_bindings_user_id_key", "zalo_bindings", ["user_id"])
    op.alter_column("users", "email", existing_type=sa.String(255), nullable=True)
    op.execute(
        "CREATE UNIQUE INDEX ix_users_parent_phone ON users (phone) "
        "WHERE role = 'parent' AND phone IS NOT NULL"
    )
    op.drop_column("students", "grade")
    op.drop_column("students", "student_code")
    op.drop_column("classes", "grade")
