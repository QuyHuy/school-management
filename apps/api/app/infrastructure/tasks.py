import asyncio

from app.infrastructure.celery_app import celery_app


@celery_app.task(name="send_zalo_message", queue="zalo_notifications", bind=True, max_retries=3)
def send_zalo_message(self, zalo_user_id: str, text: str, access_token: str) -> None:
    from app.infrastructure.external.zalo.client import ZaloOAClient

    async def _run() -> None:
        client = ZaloOAClient(access_token=access_token)
        await client.send_text(zalo_user_id=zalo_user_id, text=text)

    try:
        asyncio.run(_run())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)
