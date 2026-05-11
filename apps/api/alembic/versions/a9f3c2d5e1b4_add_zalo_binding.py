"""add_zalo_binding

Revision ID: a9f3c2d5e1b4
Revises: c8b4e1a3f7d2
Create Date: 2026-05-11 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a9f3c2d5e1b4'
down_revision: Union[str, None] = 'c8b4e1a3f7d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'zalo_bindings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('zalo_user_id', sa.String(length=64), nullable=False),
        sa.Column('is_following', sa.Boolean(), nullable=False),
        sa.Column('bound_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', 'zalo_user_id', name='uq_zalo_user_per_org'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index(op.f('ix_zalo_bindings_organization_id'), 'zalo_bindings', ['organization_id'], unique=False)
    op.create_index(op.f('ix_zalo_bindings_user_id'), 'zalo_bindings', ['user_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_zalo_bindings_user_id'), table_name='zalo_bindings')
    op.drop_index(op.f('ix_zalo_bindings_organization_id'), table_name='zalo_bindings')
    op.drop_table('zalo_bindings')
