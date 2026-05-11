from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: str
    password: str


class ParentLoginRequest(BaseModel):
    phone: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class MeResponse(BaseModel):
    user_id: str
    org_id: str
    role: str


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None


class ProfileResponse(BaseModel):
    user_id: str
    name: str
    phone: str | None
    email: str | None
    role: str


class OTPRequestSchema(BaseModel):
    phone: str


class OTPVerifySchema(BaseModel):
    phone: str
    code: str
