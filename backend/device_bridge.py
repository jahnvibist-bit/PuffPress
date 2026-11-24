from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import base64
import os
import secrets
import sqlite3
import uuid
from pathlib import Path

router = APIRouter()

DB_PATH = (
    Path(os.environ.get("PUFFPRESS_DATA_DIR") or Path(__file__).resolve().parent.parent)
    / "puffpress.db"
)

connected_devices = {}
pending_requests = {}


def verify_device_token(device_id: str, token: str) -> bool:
    if not token or not DB_PATH.exists():
        return False

    try:
        with sqlite3.connect(DB_PATH) as conn:
            row = conn.execute(
                """
                SELECT device_auth.token
                FROM device_auth
                JOIN devices
                    ON devices.id = device_auth.device_id
                WHERE device_auth.device_id = ?
                    AND devices.user_id IS NOT NULL
                """,
                (device_id,),
            ).fetchone()

        return (
            row is not None
            and secrets.compare_digest(row[0], token)
        )

    except sqlite3.Error:
        return False


def fail_pending(device_id: str, reason: str):
    for request_id, item in list(pending_requests.items()):
        if item["device_id"] == device_id:
            pending_requests.pop(request_id, None)

            if not item["future"].done():
                item["future"].set_exception(
                    ConnectionError(reason)
                )


async def disconnect_device(device_id: str):
    websocket = connected_devices.pop(device_id, None)

    fail_pending(device_id, "Device has been removed")

    if websocket is not None:
        try:
            await websocket.close(code=1008)
        except Exception:
            pass


@router.websocket("/ws/device/{device_id}")
async def device_socket(websocket: WebSocket, device_id: str):
    origin = websocket.headers.get("origin")

    allowed_origins = {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://10.93.125.38:5173",
        "https://puffpress-frontend.vercel.app",
    }

    frontend_origin = os.environ.get(
        "PUFFPRESS_FRONTEND_ORIGIN", ""
    ).rstrip("/")

    if os.getenv("RENDER") == "true":
        allowed_origins = {frontend_origin} if frontend_origin.startswith("https://") else set()
    elif frontend_origin:
        allowed_origins.add(frontend_origin)

    if origin not in allowed_origins:
        print("WebSocket rejected: origin", origin, flush=True)
        await websocket.close(code=1008)
        return

    token = websocket.query_params.get("token", "")

    if not verify_device_token(device_id, token):
        print("WebSocket rejected: device authentication", flush=True)
        await websocket.close(code=1008)
        return

    previous = connected_devices.get(device_id)

    if previous is not None:
        connected_devices.pop(device_id, None)

        fail_pending(
            device_id,
            "Device reconnected during request",
        )

        try:
            await previous.close(code=1000)
        except Exception:
            pass

    await websocket.accept()
    connected_devices[device_id] = websocket

    try:
        while True:
            message = await websocket.receive_json()

            if not verify_device_token(device_id, token):
                await websocket.close(code=1008)
                break

            request_id = message.get("request_id")
            item = pending_requests.get(request_id)

            if (
                item is None
                or item["device_id"] != device_id
            ):
                continue

            if connected_devices.get(device_id) is not websocket:
                continue

            pending_requests.pop(request_id, None)

            if not item["future"].done():
                item["future"].set_result(message)

    except WebSocketDisconnect:
        pass

    except Exception as exc:
        print(
            f"Device socket error ({device_id}): {exc}"
        )

    finally:
        if connected_devices.get(device_id) is websocket:
            connected_devices.pop(device_id, None)

            fail_pending(
                device_id,
                "Device disconnected",
            )



async def send_to_device(device_id: str, message: dict):
    last_error = None

    for attempt in range(3):
        websocket = connected_devices.get(device_id)

        if websocket is None:
            last_error = ConnectionError(
                f"Device {device_id} is offline"
            )
            if attempt < 2:
                await asyncio.sleep(2)
                continue
            raise last_error

        request_id = str(uuid.uuid4())
        future = asyncio.get_running_loop().create_future()

        pending_requests[request_id] = {
            "device_id": device_id,
            "future": future,
        }

        try:
            await websocket.send_json({
                **message,
                "request_id": request_id,
            })

            response = await asyncio.wait_for(
                future,
                timeout=20,
            )

            return response

        except (
            ConnectionError,
            WebSocketDisconnect,
            RuntimeError,
            OSError,
            asyncio.TimeoutError,
        ) as exc:
            last_error = exc

            if attempt < 2:
                await asyncio.sleep(2)

        finally:
            pending_requests.pop(request_id, None)

            if not future.done():
                future.cancel()

    raise ConnectionError(
        f"Device {device_id} transfer failed: {last_error}"
    )

async def store_browser_chunk(
    device_id: str,
    chunk_id: str,
    chunk: bytes,
):
    response = await send_to_device(
        device_id,
        {
            "action": "STORE",
            "chunk_id": chunk_id,
            "data": base64.b64encode(
                chunk
            ).decode("ascii"),
        },
    )

    if response.get("status") != "stored":
        raise RuntimeError(
            f"Chunk storage failed: {response}"
        )

    return response


async def retrieve_browser_chunk(
    device_id: str,
    chunk_id: str,
) -> bytes:
    response = await send_to_device(
        device_id,
        {
            "action": "GET",
            "chunk_id": chunk_id,
        },
    )

    if response.get("status") != "found":
        raise RuntimeError(
            f"Chunk retrieval failed: {response}"
        )

    return base64.b64decode(
        response["data"],
        validate=True,
    )


async def delete_browser_chunk(
    device_id: str,
    chunk_id: str,
):
    response = await send_to_device(
        device_id,
        {
            "action": "DELETE",
            "chunk_id": chunk_id,
        },
    )

    if response.get("status") != "deleted":
        raise RuntimeError(
            f"Chunk deletion failed: {response}"
        )

    return response
