"""WebSocket endpoint: live metrics stream.

The broadcast loop (started in main.py lifespan) pushes a summary payload
every `SYSSTATUS_WS_INTERVAL_SECONDS` seconds. This handler only manages
the connection lifecycle; disconnections and errors are handled without
crashing the server.
"""

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ...ws.manager import manager

logger = logging.getLogger("app.ws")

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/metrics")
async def ws_metrics(websocket: WebSocket) -> None:
    client_id = await manager.connect(websocket)
    logger.info("websocket client connected", extra={"client_id": client_id, "client_count": manager.count()})
    try:
        while True:
            # Waiting for a text frame detects disconnects (clients send
            # periodic pings at the protocol level; receive raises on close).
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001 - never crash on client errors
        logger.warning("websocket error", extra={"client_id": client_id, "error": str(exc)})
    finally:
        await manager.disconnect(client_id)
        logger.info("websocket client disconnected", extra={"client_id": client_id, "client_count": manager.count()})