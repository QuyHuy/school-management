"""add_org_fields

Revision ID: a1b2c3d4e5f6
Revises: e3a7f2b1c9d8
Create Date: 2026-05-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "e3a7f2b1c9d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('organizations', sa.Column('phone', sa.String(length=20), nullable=True))
    op.add_column('organizations', sa.Column('address', sa.Text(), nullable=True))
    op.add_column('organizations', sa.Column('academic_year', sa.String(length=20), nullable=True))
    op.add_column('organizations', sa.Column('logo_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('organizations', 'logo_url')
    op.drop_column('organizations', 'academic_year')
    op.drop_column('organizations', 'address')
    op.drop_column('organizations', 'phone')
