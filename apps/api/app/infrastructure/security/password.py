from passlib.context import CryptContext

_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return str(_ctx.hash(plain))


def verify_password(plain: str, hashed: str) -> bool:
    return bool(_ctx.verify(plain, hashed))
