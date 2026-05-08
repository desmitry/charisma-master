"""FastAPI dependencies for authentication and authorization."""

from typing import Any, Dict, Tuple

from app.auth.jwt_utils import get_user_info_from_token
from app.nats_client import nats_client
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer

security = HTTPBearer()


async def get_current_user(request: Request) -> Dict[str, Any]:
    """Get current user from JWT token in Authorization header.

    Returns user payload if token is valid and not blacklisted.
    Raises 401 if token is missing/invalid/blacklisted.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header.split(" ", 1)[1]
    user_info = get_user_info_from_token(token)

    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user_info


async def get_current_user_with_roles(
    user_info: Dict[str, Any] = Depends(get_current_user),
) -> Tuple[str, str, list[str]]:
    """Get current user with roles.

    Returns tuple: (user_id, email, roles).
    """
    return user_info["sub"], user_info["email"], user_info.get("roles", [])


async def check_permission(
    required_permission: str,
    user_info: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Check if user has a specific permission.

    Queries account service via NATS to get user permissions.
    Raises 403 if user lacks the required permission.
    """
    user_id = user_info["sub"]

    # Get permissions from account service
    try:
        result = await nats_client.get_permissions(user_id)
        if result.get("success"):
            permissions = result["success"].get("permissions", [])
            if required_permission not in permissions:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not enough permissions",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Could not verify permissions",
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Permission check failed: {str(e)}",
        )

    return user_info


# Common permission checks
async def require_create_analysis(
    user_info: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Require 'user.analysis.create' permission."""
    return await check_permission("user.analysis.create", user_info)


async def require_view_own_analysis(
    user_info: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Require 'user.analysis.view.own' permission."""
    return await check_permission("user.analysis.view.own", user_info)
