"""WebSocket connection manager.

Tracks connected clients, broadcasts JSON payloads and removes dead
connections safely. A module-level singleton keeps a single source of
truth shared by the broadcast loop and the websocket route.
"""

import asyncio
import uuid

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, WebSocket] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> str:
        await websocket.accept()
        client_id = uuid.uuid4().hex[:8]
        async with self._lock:
            self._connections[client_id] = websocket
        return client_id

    async def disconnect(self, client_id: str) -> None:
        async with self._lock:
            self._connections.pop(client_id, None)

    def count(self) -> int:
        return len(self._connections)

    async def broadcast(self, payload: dict) -> None:
        async with self._lock:
            connections = list(self._connections.items())
        for client_id, websocket in connections:
            try:
                await websocket.send_json(payload)
            except Exception:  # noqa: BLE001 - dead/closed connection
                await self.disconnect(client_id)


manager = ConnectionManager()