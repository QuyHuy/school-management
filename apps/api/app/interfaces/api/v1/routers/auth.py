from fastapi import APIRouter

router = APIRouter()


@router.get("/me")
async def me():
    return {"message": "auth endpoint — implemented in Phase 2"}
