import json
import pytest
import httpx
import respx
from app.infrastructure.external.zalo.client import ZaloOAClient


@pytest.mark.asyncio
@respx.mock
async def test_send_text_calls_zalo_api():
    mock = respx.post("https://openapi.zalo.me/v2.0/oa/message").mock(
        return_value=httpx.Response(200, json={"error": 0, "message": "Success"})
    )

    client = ZaloOAClient(access_token="test-token")
    result = await client.send_text(zalo_user_id="123456789", text="Xin chào!")

    assert mock.called
    sent = mock.calls[0].request
    body = json.loads(sent.content)
    assert body["recipient"]["user_id"] == "123456789"
    assert body["message"]["text"] == "Xin chào!"
    assert result["error"] == 0


@pytest.mark.asyncio
@respx.mock
async def test_send_text_raises_on_zalo_error():
    respx.post("https://openapi.zalo.me/v2.0/oa/message").mock(
        return_value=httpx.Response(200, json={"error": -201, "message": "Invalid access token"})
    )

    client = ZaloOAClient(access_token="bad-token")
    with pytest.raises(ValueError, match="Zalo OA error"):
        await client.send_text(zalo_user_id="123", text="hello")
