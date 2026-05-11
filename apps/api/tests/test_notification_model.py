from app.infrastructure.db.models.notification import FeedbackModel, NotificationModel


def test_notification_model_tablename():
    assert NotificationModel.__tablename__ == "notifications"


def test_feedback_model_tablename():
    assert FeedbackModel.__tablename__ == "feedback"


def test_notification_model_has_required_columns():
    cols = {c.key for c in NotificationModel.__table__.columns}
    assert {"id", "organization_id", "sender_id", "recipient_id", "content", "created_at"}.issubset(cols)


def test_feedback_model_has_required_columns():
    cols = {c.key for c in FeedbackModel.__table__.columns}
    assert {"id", "organization_id", "sender_id", "recipient_id", "content", "reply_content", "replied_at"}.issubset(cols)
