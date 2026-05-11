import httpx


class ZaloOAClient:
    _BASE = "https://openapi.zalo.me/v2.0/oa"

    def __init__(self, access_token: str) -> None:
        self._token = access_token

    async def send_text(self, zalo_user_id: str, text: str) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{self._BASE}/message",
                headers={"access_token": self._token},
                json={
                    "recipient": {"user_id": zalo_user_id},
                    "message": {"text": text},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("error", 0) != 0:
                raise ValueError(f"Zalo OA error {data['error']}: {data.get('message')}")
            return data
