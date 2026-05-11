from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.auth.login import LoginUseCase
from app.application.use_cases.auth.logout import LogoutUseCase
from app.application.use_cases.auth.parent_login import ParentLoginUseCase
from app.application.use_cases.auth.refresh_token import RefreshTokenUseCase
from app.application.use_cases.auth.request_otp import RequestOTPUseCase
from app.application.use_cases.auth.verify_otp import VerifyOTPUseCase
from app.application.use_cases.parent.update_profile import UpdateParentProfileUseCase, UpdateProfileInput
from app.infrastructure.cache.redis_client import get_redis
from app.infrastructure.db.repositories.user_repository import SQLUserRepository
from app.infrastructure.db.repositories.zalo_repository import SQLZaloRepository
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import get_current_user, require_role
from app.interfaces.api.v1.schemas.auth import (
    LoginRequest,
    LoginResponse,
    LogoutRequest,
    MeResponse,
    OTPRequestSchema,
    OTPVerifySchema,
    ParentLoginRequest,
    ProfileResponse,
    RefreshRequest,
    RefreshResponse,
    UpdateProfileRequest,
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


@router.post("/login/parent", response_model=LoginResponse)
async def login_parent(
    body: ParentLoginRequest,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    use_case = ParentLoginUseCase(SQLUserRepository(db), redis)
    result = await use_case.execute(body.phone, body.password)
    return LoginResponse(access_token=result.access_token, refresh_token=result.refresh_token)


@router.get("/me", response_model=MeResponse)
async def me(token_data=Depends(get_current_user)):
    return MeResponse(
        user_id=str(token_data.user_id),
        org_id=str(token_data.org_id),
        role=token_data.role,
    )


@router.get("/me/profile", response_model=ProfileResponse)
async def get_profile(
    token_data=Depends(require_role("parent")),
    db: AsyncSession = Depends(get_db),
):
    user = await SQLUserRepository(db).get_by_id(token_data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return ProfileResponse(
        user_id=str(user.id),
        name=user.name,
        phone=user.phone,
        email=user.email,
        role=user.role.value,
    )


@router.patch("/me/profile", response_model=ProfileResponse)
async def update_profile(
    body: UpdateProfileRequest,
    token_data=Depends(require_role("parent")),
    db: AsyncSession = Depends(get_db),
):
    uc = UpdateParentProfileUseCase(SQLUserRepository(db))
    user = await uc.execute(token_data.user_id, UpdateProfileInput(
        name=body.name,
        phone=body.phone,
        email=body.email,
    ))
    return ProfileResponse(
        user_id=str(user.id),
        name=user.name,
        phone=user.phone,
        email=user.email,
        role=user.role.value,
    )


@router.post("/otp/request", status_code=204)
async def request_otp(
    body: OTPRequestSchema,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    use_case = RequestOTPUseCase(SQLUserRepository(db), SQLZaloRepository(db), redis)
    await use_case.execute(body.phone)
    return Response(status_code=204)


@router.post("/otp/verify", response_model=LoginResponse)
async def verify_otp(
    body: OTPVerifySchema,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    result = await VerifyOTPUseCase(SQLUserRepository(db), redis).execute(body.phone, body.code)
    return LoginResponse(access_token=result.access_token, refresh_token=result.refresh_token)
