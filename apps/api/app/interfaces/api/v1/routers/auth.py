from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.auth.login import LoginUseCase
from app.application.use_cases.auth.logout import LogoutUseCase
from app.application.use_cases.auth.refresh_token import RefreshTokenUseCase
from app.infrastructure.cache.redis_client import get_redis
from app.infrastructure.db.repositories.user_repository import SQLUserRepository
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import get_current_user
from app.interfaces.api.v1.schemas.auth import (
    LoginRequest,
    LoginResponse,
    LogoutRequest,
    MeResponse,
    RefreshRequest,
    RefreshResponse,
)

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    use_case = LoginUseCase(SQLUserRepository(db), redis)
    result = await use_case.execute(body.email, body.password)
    return LoginResponse(access_token=result.access_token, refresh_token=result.refresh_token)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    use_case = RefreshTokenUseCase(SQLUserRepository(db), redis)
    access_token = await use_case.execute(body.refresh_token)
    return RefreshResponse(access_token=access_token)


@router.post("/logout", status_code=204)
async def logout(
    body: LogoutRequest,
    token_data=Depends(get_current_user),
    redis=Depends(get_redis),
):
    use_case = LogoutUseCase(redis)
    await use_case.execute(token_data, body.refresh_token)
    return Response(status_code=204)


@router.get("/me", response_model=MeResponse)
async def me(token_data=Depends(get_current_user)):
    return MeResponse(
        user_id=str(token_data.user_id),
        org_id=str(token_data.org_id),
        role=token_data.role,
    )
