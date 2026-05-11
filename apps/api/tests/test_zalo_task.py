from app.infrastructure.tasks import send_zalo_message


def test_send_zalo_message_task_exists():
    assert callable(send_zalo_message)


def test_send_zalo_message_is_celery_task():
    assert hasattr(send_zalo_message, "delay")
    assert hasattr(send_zalo_message, "apply_async")
