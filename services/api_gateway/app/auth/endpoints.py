"""Authentication endpoints for Charisma Master."""

from typing import Any, Dict

from app.auth.dependencies import (
    get_current_user,
)
from app.auth.jwt_utils import (
    blacklist_token,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.nats_client import nats_client
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])
security = HTTPBearer()


@router.post("/register", response_model=Dict[str, Any])
async def register(credentials: Dict[str, Any]):
    """Register a new user via account service."""
    email = credentials.get("email")
    password = credentials.get("password")

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password required",
        )

    # Call account service via NATS
    result = await nats_client.create_user(email, password)

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"],
        )

    return {"user_id": result.get("success", {}).get("id")}


@router.post("/login", response_model=Dict[str, Any])
async def login(credentials: Dict[str, Any]):
    """Login user and return JWT tokens."""
    email = credentials.get("email")
    password = credentials.get("password")

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password required",
        )

    # Verify credentials via NATS
    verify_result = await nats_client.verify_user(email, password)

    if "error" in verify_result or not verify_result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user_id = verify_result["success"]["id"]

    # Get user info and roles
    permissions_result = await nats_client.get_permissions(user_id)

    roles = []
    if "success" in permissions_result:
        roles = permissions_result["success"].get("roles", [])

    # Create tokens
    access_token = create_access_token(user_id, email, roles)
    refresh_token = create_refresh_token(user_id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
    }


@router.post("/refresh", response_model=Dict[str, Any])
async def refresh_token(credentials: Dict[str, Any]):
    """Refresh access token using refresh token."""
    refresh_token = credentials.get("refresh_token")

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Refresh token required",
        )

    # Decode and validate refresh token
    result = decode_token(refresh_token)
    if not result["valid"] or result["payload"].get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = result["payload"]["sub"]
    roles = result["payload"].get("roles", [])

    # Create new access token
    access_token = create_access_token(user_id, "", roles)

    return {
        "access_token": access_token,
        "token_type": "Bearer",
    }


@router.get("/me", response_model=Dict[str, Any])
async def get_me(user_info: Dict[str, Any] = Depends(get_current_user)):
    """Get current user info and permissions."""
    user_id = user_info["sub"]
    email = user_info.get("email", "")

    # Get permissions from account service
    permissions_result = await nats_client.get_permissions(user_id)

    roles = []
    permissions = []
    if "success" in permissions_result:
        roles = permissions_result["success"].get("roles", [])
        permissions = permissions_result["success"].get("permissions", [])

    return {
        "id": user_id,
        "email": email,
        "roles": roles,
        "permissions": permissions,
    }


@router.post("/logout")
async def logout(user_info: Dict[str, Any] = Depends(get_current_user)):
    """Logout user by blacklisting tokens."""
    # Blacklist access token
    jti = user_info.get("jti")
    exp = user_info.get("exp")

    if jti and exp:
        blacklist_token(jti, exp)

    # Also blacklist refresh token if provided
    # (Client should send refresh_token in body)
    return {"message": "Logged out successfully"}
