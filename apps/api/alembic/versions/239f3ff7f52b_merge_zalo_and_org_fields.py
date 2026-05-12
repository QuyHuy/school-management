"""merge_zalo_and_org_fields

Revision ID: 239f3ff7f52b
Revises: a1b2c3d4e5f6, a9f3c2d5e1b4
Create Date: 2026-05-12 17:05:54.207154

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '239f3ff7f52b'
down_revision: Union[str, None] = ('a1b2c3d4e5f6', 'a9f3c2d5e1b4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
