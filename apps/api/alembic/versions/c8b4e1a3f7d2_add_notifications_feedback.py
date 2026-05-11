"""add_notifications_feedback

Revision ID: c8b4e1a3f7d2
Revises: fd5fe20f1357
Create Date: 2026-05-11 00:01:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c8b4e1a3f7d2'
down_revision: Union[str, None] = 'fd5fe20f1357'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'notifications',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('sender_id', sa.UUID(), nullable=False),
        sa.Column('recipient_id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=True),
        sa.Column('session_id', sa.UUID(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id']),
        sa.ForeignKeyConstraint(['recipient_id'], ['users.id']),
        sa.ForeignKeyConstraint(['student_id'], ['students.id']),
        sa.ForeignKeyConstraint(['session_id'], ['class_sessions.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_notifications_organization_id'), 'notifications', ['organization_id'])
    op.create_index(op.f('ix_notifications_sender_id'), 'notifications', ['sender_id'])
    op.create_index(op.f('ix_notifications_recipient_id'), 'notifications', ['recipient_id'])
    op.create_index(op.f('ix_notifications_student_id'), 'notifications', ['student_id'])

    op.create_table(
        'feedback',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('notification_id', sa.UUID(), nullable=True),
        sa.Column('sender_id', sa.UUID(), nullable=False),
        sa.Column('recipient_id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('reply_content', sa.Text(), nullable=True),
        sa.Column('replied_by_id', sa.UUID(), nullable=True),
        sa.Column('replied_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['notification_id'], ['notifications.id']),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id']),
        sa.ForeignKeyConstraint(['recipient_id'], ['users.id']),
        sa.ForeignKeyConstraint(['student_id'], ['students.id']),
        sa.ForeignKeyConstraint(['replied_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_feedback_organization_id'), 'feedback', ['organization_id'])
    op.create_index(op.f('ix_feedback_sender_id'), 'feedback', ['sender_id'])
    op.create_index(op.f('ix_feedback_recipient_id'), 'feedback', ['recipient_id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_feedback_recipient_id'), table_name='feedback')
    op.drop_index(op.f('ix_feedback_sender_id'), table_name='feedback')
    op.drop_index(op.f('ix_feedback_organization_id'), table_name='feedback')
    op.drop_table('feedback')
    op.drop_index(op.f('ix_notifications_student_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_recipient_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_sender_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_organization_id'), table_name='notifications')
    op.drop_table('notifications')
