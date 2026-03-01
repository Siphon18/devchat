import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from app import schemas

# SECURITY CONFIG — read from environment
_default_key = "DEVCHAT_DEV_ONLY_SECRET_CHANGE_IN_PROD"
SECRET_KEY = os.getenv("SECRET_KEY", _default_key)
if SECRET_KEY == _default_key:
    import warnings
    warnings.warn(
        "WARNING: Using default SECRET_KEY. Set the SECRET_KEY environment variable in production!",
        stacklevel=1,
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24)))

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
