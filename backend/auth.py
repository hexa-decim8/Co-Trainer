from datetime import datetime, timedelta
from typing import Optional
import hmac
import secrets
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db, UserDB
from config import settings

# Password hashing - use argon2 instead of bcrypt to avoid 72-byte limitation
# Argon2 is more secure and has no password length restrictions
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# JWT settings
# Read secret_key via property so it always reflects the current value from
# settings, even if it was regenerated after module import (e.g. after a
# container restart where the encrypted config had to be re-created).
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
REFRESH_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days
REFRESH_TOKEN_PREFIX = "rt"


def _get_secret_key() -> str:
    return settings.secret_key


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password. Argon2 has no password length restrictions."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, _get_secret_key(), algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create an opaque refresh token with embedded expiration timestamp.

    Opaque refresh tokens avoid coupling session continuity to JWT signing
    secret stability across container updates. The token is still one-time
    rotatable because we persist a single active value per user in the DB.
    """
    _ = data  # Kept for compatibility with existing call sites.
    expire = datetime.utcnow() + timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES)
    expire_ts = int(expire.timestamp())
    random_part = secrets.token_urlsafe(48)
    return f"{REFRESH_TOKEN_PREFIX}.{expire_ts}.{random_part}"


def _verify_opaque_refresh_token(db: Session, refresh_token: str) -> Optional[UserDB]:
    """Verify opaque refresh token format, expiration, and DB match."""
    try:
        prefix, expire_ts_raw, _ = refresh_token.split(".", 2)
        if prefix != REFRESH_TOKEN_PREFIX:
            return None
        expire_ts = int(expire_ts_raw)
    except (ValueError, AttributeError):
        return None

    if expire_ts < int(datetime.utcnow().timestamp()):
        return None

    user = db.query(UserDB).filter(UserDB.refresh_token == refresh_token).first()
    if user is None:
        return None

    # Constant-time comparison to avoid leaking equality timing details.
    if not hmac.compare_digest((user.refresh_token or ""), refresh_token):
        return None

    return user


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> UserDB:
    """Get the current authenticated user from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, _get_secret_key(), algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(UserDB).filter(UserDB.email == email).first()
    if user is None:
        raise credentials_exception
    return user


def authenticate_user(db: Session, email: str, password: str) -> Optional[UserDB]:
    """Authenticate a user by email and password."""
    user = db.query(UserDB).filter(UserDB.email == email).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def verify_refresh_token(db: Session, refresh_token: str) -> Optional[UserDB]:
    """Verify a refresh token and return the user.

    Supports both:
    - current opaque refresh tokens (preferred)
    - legacy JWT refresh tokens (backward compatibility)
    """
    opaque_user = _verify_opaque_refresh_token(db, refresh_token)
    if opaque_user is not None:
        return opaque_user

    # Legacy JWT fallback for already-issued refresh tokens.
    try:
        payload = jwt.decode(refresh_token, _get_secret_key(), algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if email is None or token_type != "refresh":
            return None
            
        user = db.query(UserDB).filter(UserDB.email == email).first()
        if user is None:
            return None

        if not hmac.compare_digest((user.refresh_token or ""), refresh_token):
            return None
            
        return user
    except JWTError:
        return None


async def require_admin(current_user: UserDB = Depends(get_current_user)) -> UserDB:
    """Dependency to require admin role."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


async def require_coach_or_admin(current_user: UserDB = Depends(get_current_user)) -> UserDB:
    """Dependency to require coach or admin role."""
    if current_user.role not in ["coach", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Coach or admin access required"
        )
    return current_user
