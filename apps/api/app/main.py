from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.domain.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
)

if settings.sentry_dsn:
    sentry_sdk.init(dsn=settings.sentry_dsn, environment=settings.environment)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize DB pool, Redis, etc.
    from app.infrastructure.db.session import engine  # noqa: F401
    yield
    # Shutdown


app = FastAPI(
    title="School Management API",
    version="1.0.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Domain exception → HTTP error mapping
@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(ForbiddenError)
async def forbidden_handler(request: Request, exc: ForbiddenError):
    return JSONResponse(status_code=403, content={"detail": str(exc)})


@app.exception_handler(UnauthorizedError)
async def unauthorized_handler(request: Request, exc: UnauthorizedError):
    return JSONResponse(status_code=401, content={"detail": str(exc)})


@app.exception_handler(ValidationError)
async def validation_handler(request: Request, exc: ValidationError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.exception_handler(ConflictError)
async def conflict_handler(request: Request, exc: ConflictError):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "version": "1.0.0"}


# Routers — imported lazily to avoid circular deps at import time
from app.interfaces.api.v1.routers import auth  # noqa: E402

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])

from app.interfaces.api.v1.routers import classes, students  # noqa: E402

app.include_router(students.router, prefix="/api/v1/students", tags=["students"])
app.include_router(classes.router, prefix="/api/v1/classes", tags=["classes"])

from app.interfaces.api.v1.routers import attendance  # noqa: E402

app.include_router(attendance.router, prefix="/api/v1/classes", tags=["attendance"])

from app.interfaces.api.v1.routers import exams  # noqa: E402

app.include_router(exams.router, prefix="/api/v1/classes", tags=["exams"])

from app.interfaces.api.v1.routers import dashboard  # noqa: E402

app.include_router(dashboard.router, prefix="/api/v1", tags=["dashboard"])

from app.interfaces.api.v1.routers import parent  # noqa: E402

app.include_router(parent.router, prefix="/api/v1/parent", tags=["parent"])
