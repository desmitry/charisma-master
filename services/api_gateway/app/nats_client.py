import logging
import sys
from pathlib import Path
from typing import Any, Dict, Optional

import nats
from google.protobuf.json_format import MessageToDict

from app.config import settings

_proto_gen = str(Path(__file__).parent / "proto_gen")
if _proto_gen not in sys.path:
    sys.path.insert(0, _proto_gen)

from account import credentials_pb2, permissions_pb2, users_pb2  # noqa: E402

logger = logging.getLogger(__name__)


class NatsClient:
    def __init__(self, nats_url: str):
        self.nats_url = nats_url
        self.nc: Optional[nats.NATS] = None

    async def connect(self):
        if self.nc is None or self.nc.is_closed:
            self.nc = await nats.connect(self.nats_url)

    async def close(self):
        if self.nc and not self.nc.is_closed:
            await self.nc.close()

    async def _request(
        self, subject: str, request_msg, response_class, timeout: float = 5.0
    ) -> Optional[Any]:
        await self.connect()
        payload = request_msg.SerializeToString()
        try:
            resp = await self.nc.request(subject, payload, timeout=timeout)
            response = response_class()
            response.ParseFromString(resp.data)
            return response
        except nats.errors.TimeoutError:
            logger.warning("NATS request timed out for %s", subject)
            return None

    def _normalize(self, msg) -> Dict[str, Any]:
        data = MessageToDict(msg, preserving_proto_field_name=True)
        for error_field in (
            "email_exists",
            "internal",
            "invalid_credentials",
            "user_not_found",
            "invalid_password",
        ):
            if error_field in data:
                return {"error": data[error_field].get("message", error_field)}
        return {"success": data.get("success", {})}

    async def create_user(self, email: str, password: str) -> Dict[str, Any]:
        req = users_pb2.CreateRequest(email=email, password=password)
        resp = await self._request(
            "account.users.create", req, users_pb2.CreateResponse
        )
        if resp is None:
            return {"error": "Request timeout"}
        return self._normalize(resp)

    async def verify_user(self, email: str, password: str) -> Dict[str, Any]:
        req = credentials_pb2.VerifyRequest(email=email, password=password)
        resp = await self._request(
            "account.users.verify", req, credentials_pb2.VerifyResponse
        )
        if resp is None:
            return {"error": "Request timeout"}
        return self._normalize(resp)

    async def get_permissions(self, user_id: str) -> Dict[str, Any]:
        req = permissions_pb2.PermissionsByIdRequest(id=user_id)
        resp = await self._request(
            "account.users.permissions.get",
            req,
            permissions_pb2.PermissionsByIdResponse,
        )
        if resp is None:
            return {"error": "Request timeout"}
        return self._normalize(resp)


nats_client = NatsClient(settings.nats_url)
