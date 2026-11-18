
# from fastapi import FastAPI, HTTPException, Response, Request, UploadFile, File
# from fastapi.middleware.cors import CORSMiddleware
# from pathlib import Path
# import jwt
# from jwt import PyJWKClient
# from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
# from uuid import uuid4
# from fastapi import Cookie
# from fastapi.responses import JSONResponse
# from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
# from pydantic import BaseModel, Field
# from fastapi import Depends, Security
# from fastapi.security import APIKeyHeader
# import sqlite3
# import zlib
# from fastapi.staticfiles import StaticFiles
# from fastapi.responses import FileResponse
# import os
# import asyncio
# import qrcode
# import io
# import httpx
# import secrets
# import time
# import hashlib
# import base64
# from collections import defaultdict
# from threading import Lock
# from backend.device_bridge import (
#     router as device_router,
#     connected_devices,
#     send_to_device,
#     store_browser_chunk,
#     retrieve_browser_chunk,
#     delete_browser_chunk,
#     disconnect_device,
# )
# # ---------------------------------------
# # CONFIGURATION
# # ---------------------------------------

# BASE_PATH = Path(__file__).resolve().parent.parent
# DB_PATH = BASE_PATH / "puffpress.db"
# STORAGE_PATH = BASE_PATH / "storage"

# CHUNK_SIZE = 256 * 1024
# GB = 1024 ** 3
# PAIRING_EXPIRY = 300

# pairing_sessions = {}

# login_attempts = defaultdict(list)
# login_attempts_lock = Lock()

# pairing_attempts_lock = Lock()

# LOGIN_MAX_ATTEMPTS = 5
# LOGIN_WINDOW_SECONDS = 300
# PAIRING_MAX_ATTEMPTS = 5
# # ---------------------------------------
# # DATABASE
# # ---------------------------------------

# def get_db():
#     conn = sqlite3.connect(DB_PATH, timeout=30)
#     conn.row_factory = sqlite3.Row
#     return conn


# def init_database():
#     with get_db() as conn:
#         conn.execute("""
#             CREATE TABLE IF NOT EXISTS files (
#                 id TEXT PRIMARY KEY,
#                 name TEXT,
#                 size INTEGER,
#                 path TEXT
#             )
#         """)

#         conn.execute("""
#             CREATE TABLE IF NOT EXISTS devices (
#                 id TEXT PRIMARY KEY,
#                 name TEXT NOT NULL,
#                 url TEXT NOT NULL,
#                 total_gb REAL NOT NULL,
#                 used_gb REAL DEFAULT 0
#             )
#         """)

#         conn.execute("""
#             CREATE TABLE IF NOT EXISTS chunks (
#                 id TEXT PRIMARY KEY,
#                 file_id TEXT NOT NULL,
#                 chunk_index INTEGER NOT NULL,
#                 device_id TEXT NOT NULL,
#                 size INTEGER NOT NULL,
#                 FOREIGN KEY (file_id) REFERENCES files(id),
#                 FOREIGN KEY (device_id) REFERENCES devices(id),
#                 UNIQUE(file_id, chunk_index)
#             )
#         """)

#         conn.execute("""
#             CREATE TABLE IF NOT EXISTS device_auth (
#                 device_id TEXT PRIMARY KEY,
#                 token TEXT NOT NULL
#             )
#         """)

#         # Multi-user migration: preserve existing data.
#         for table in ("files", "devices"):
#             columns = {
#                 row["name"]
#                 for row in conn.execute(
#                     f"PRAGMA table_info({table})"
#                 ).fetchall()
#             }

#             if "user_id" not in columns:
#                 conn.execute(
#                     f"ALTER TABLE {table} ADD COLUMN user_id TEXT"
#                 )
#         # Recalculate usage from recorded chunks.
#         conn.execute("""
#             UPDATE devices
#             SET used_gb = COALESCE((
#                 SELECT SUM(chunks.size) / 1073741824.0
#                 FROM chunks
#                 WHERE chunks.device_id = devices.id
#             ), 0)
#         """)


# init_database()


# # ---------------------------------------
# # FASTAPI
# # ---------------------------------------

# app = FastAPI(title="PuffPress API")

# app.include_router(device_router)

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=[
#         "http://localhost:5173",
#         "http://127.0.0.1:5173",
#         "http://localhost:5174",
#         "http://127.0.0.1:5174",
#         "http://10.241.119.38:5173",
#         "http://192.168.0.108:5173",
#         "http://10.93.125.38:5173"
#     ],
#     allow_methods=["GET", "POST", "DELETE"],
#     allow_headers=["*"],
# )

# api_key_header = APIKeyHeader(
#     name="X-PuffPress-Key",
#     auto_error=False
# )

# def require_api_key(api_key: str = Security(api_key_header)):
#     expected = os.environ.get("PUFFPRESS_API_KEY")

#     if not expected:
#         raise HTTPException(
#             status_code=503,
#             detail="Backend API key not configured"
#         )

#     if not api_key or not secrets.compare_digest(api_key, expected):
#         raise HTTPException(
#             status_code=401,
#             detail="Unauthorized"
#         )
# def get_session_serializer():
#     secret = os.environ.get("PUFFPRESS_API_KEY")

#     if not secret:
#         raise HTTPException(
#             status_code=503,
#             detail="Session secret not configured"
#         )

#     return URLSafeTimedSerializer(
#         secret,
#         salt="puffpress-owner-session"
#     )

# def require_owner_session(request: Request):
#     token = request.cookies.get("puffpress_session")

#     if not token:
#         raise HTTPException(
#             status_code=401,
#             detail="Login required"
#         )

#     try:
#         data = get_session_serializer().loads(
#             token,
#             max_age=86400
#         )
#     except (BadSignature, SignatureExpired):
#         raise HTTPException(
#             status_code=401,
#             detail="Session expired or invalid"
#         )

#     if data.get("role") != "owner":
#         raise HTTPException(
#             status_code=401,
#             detail="Invalid session"
#         )

#     if request.method not in ("GET", "HEAD", "OPTIONS"):
#         origin = request.headers.get("origin")

#         public_origin = os.environ.get(
#             "PUFFPRESS_PUBLIC_ORIGIN",
#             ""
#         ).rstrip("/")

#         allowed_origins = {
#             "http://localhost:5173",
#             "http://127.0.0.1:5173",
#             "http://localhost:4173",
#             "http://127.0.0.1:4173"
#         }

#         if public_origin:
#             allowed_origins.add(public_origin)

#         if origin not in allowed_origins:
#             raise HTTPException(
#                 status_code=403,
#                 detail="Untrusted request origin"
#             )

#     return data
# SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")

# supabase_bearer = HTTPBearer(auto_error=False)


# def require_supabase_user(
#     credentials: HTTPAuthorizationCredentials = Depends(supabase_bearer)
# ):
#     if not credentials:
#         raise HTTPException(
#             status_code=401,
#             detail="Login required"
#         )

#     if not SUPABASE_URL:
#         raise HTTPException(
#             status_code=500,
#             detail="Supabase backend URL not configured"
#         )

#     try:
#         jwks_client = PyJWKClient(
#             f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
#         )

#         signing_key = jwks_client.get_signing_key_from_jwt(
#             credentials.credentials
#         )

#         payload = jwt.decode(
#             credentials.credentials,
#             signing_key.key,
#             algorithms=["ES256", "RS256"],
#             audience="authenticated",
#             issuer=f"{SUPABASE_URL}/auth/v1",
#         )

#         user_id = payload.get("sub")

#         if not user_id:
#             raise ValueError("Missing user ID")

#         return user_id

#     except (jwt.PyJWTError, ValueError):
#         raise HTTPException(
#             status_code=401,
#             detail="Invalid or expired login"
#         )
# # ---------------------------------------
# # MODELS
# # ---------------------------------------
# class OwnerLoginRequest(BaseModel):
#     password: str

# @app.post("/auth/login")
# def owner_login(
#     data: OwnerLoginRequest,
#     request: Request,
#     response: Response
# ):
#     expected = os.environ.get("PUFFPRESS_API_KEY")

#     if not expected:
#         raise HTTPException(
#             status_code=503,
#             detail="Login not configured"
#         )

#     client_ip = (
#         request.client.host
#         if request.client
#         else "unknown"
#     )

#     now = time.time()

#     with login_attempts_lock:
#         attempts = login_attempts[client_ip]

#         attempts[:] = [
#             timestamp
#             for timestamp in attempts
#             if now - timestamp < LOGIN_WINDOW_SECONDS
#         ]

#         if len(attempts) >= LOGIN_MAX_ATTEMPTS:
#             raise HTTPException(
#                 status_code=429,
#                 detail="Too many login attempts. Try again in 5 minutes."
#             )

#         if not secrets.compare_digest(
#             data.password,
#             expected
#         ):
#             attempts.append(now)

#             raise HTTPException(
#                 status_code=401,
#                 detail="Invalid password"
#             )

#         login_attempts.pop(client_ip, None)

#     serializer = get_session_serializer()
#     token = serializer.dumps({"role": "owner"})

#     public_origin = os.environ.get(
#         "PUFFPRESS_PUBLIC_ORIGIN",
#         ""
#     ).strip()

#     response.set_cookie(
#         key="puffpress_session",
#         value=token,
#         httponly=True,
#         secure=public_origin.startswith("https://"),
#         samesite="lax",
#         max_age=86400,
#         path="/"
#     )

#     return {"message": "Login successful"}

# @app.get("/auth/check")
# def check_owner_session(
#     session=Depends(require_owner_session)
# ):
#     return {"authenticated": True}
# class DeviceRegister(BaseModel):
#     id: str
#     name: str
#     url: str
#     total_gb: float = Field(gt=0)


# class PairingVerifyRequest(BaseModel):
#     pairing_id: str
#     passcode: str
#     device_id: str
#     device_name: str = Field(
#         default="Paired Phone",
#         min_length=1,
#         max_length=50
#     )


# # ---------------------------------------
# # BASIC ENDPOINTS
# # ---------------------------------------


# @app.get("/")
# def home():
#     index_file = BASE_PATH / "frontend" / "dist" / "index.html"

#     if index_file.is_file():
#         return FileResponse(index_file)

#     return {
#         "app": "PuffPress",
#         "status": "running",
#         "message": "Frontend build not found"
#     }

# @app.get("/about")
# def about():
#     return {
#         "app": "PuffPress",
#         "message": "Distributed storage across your devices",
#         "status": "development",
#     }


# # ---------------------------------------
# # PAIRING
# # ---------------------------------------

# @app.post("/pairing/create", dependencies=[Depends(require_owner_session)])
# def create_pairing():
#     pairing_id = secrets.token_urlsafe(16)
#     passcode = f"{secrets.randbelow(1000000):06d}"

#     pairing_sessions[pairing_id] = {
#         "passcode": passcode,
#         "expires_at": time.time() + PAIRING_EXPIRY,
#         "used": False,
#     }

#     return {
#         "pairing_id": pairing_id,
#         "passcode": passcode,
#         "expires_in": PAIRING_EXPIRY,
#     }


# @app.get("/pairing/qr/{pairing_id}")
# def pairing_qr(pairing_id: str, request: Request):
#     session = pairing_sessions.get(pairing_id)

#     if session is None:
#         raise HTTPException(
#             status_code=404,
#             detail="Pairing session not found",
#         )

#     if session["used"] or time.time() > session["expires_at"]:
#         raise HTTPException(
#             status_code=410,
#             detail="Pairing session expired or used",
#         )

#     host = request.url.hostname
#     public_origin = os.environ.get("PUFFPRESS_PUBLIC_ORIGIN")

#     if public_origin:
#         base_url = public_origin.rstrip("/")
#     else:
#         host = request.url.hostname

#         if host in ("localhost", "127.0.0.1"):
#             raise HTTPException(
#                 status_code=400,
#                 detail="Open this endpoint using your laptop's LAN IP",
#             )

#         base_url = f"http://{host}:5173"

#     pairing_url = (
#         f"{base_url}/pair.html?pairing_id={pairing_id}"
#     )

#     qr = qrcode.make(pairing_url)
#     buffer = io.BytesIO()
#     qr.save(buffer, format="PNG")

#     return Response(
#         content=buffer.getvalue(),
#         media_type="image/png",
#     )



# @app.post("/pairing/verify")
# def verify_pairing(data: PairingVerifyRequest):
#     with pairing_attempts_lock:
#         session = pairing_sessions.get(data.pairing_id)

#         if session is None:
#             raise HTTPException(
#                 status_code=404,
#                 detail="Pairing session not found",
#             )

#         if time.time() > session["expires_at"]:
#             pairing_sessions.pop(data.pairing_id, None)

#             raise HTTPException(
#                 status_code=410,
#                 detail="Pairing code expired",
#             )

#         if session["used"]:
#             raise HTTPException(
#                 status_code=400,
#                 detail="Pairing code already used",
#             )

#         attempts = session.setdefault("attempts", 0)

#         if attempts >= PAIRING_MAX_ATTEMPTS:
#             raise HTTPException(
#                 status_code=429,
#                 detail="Too many incorrect attempts. Create a new pairing code.",
#             )

#         if not secrets.compare_digest(
#             session["passcode"],
#             data.passcode
#         ):
#             session["attempts"] = attempts + 1

#             raise HTTPException(
#                 status_code=401,
#                 detail="Incorrect passcode",
#             )

#         device_token = secrets.token_urlsafe(32)

#         with get_db() as conn:
#             existing = conn.execute(
#                 "SELECT id FROM devices WHERE id = ?",
#                 (data.device_id,),
#             ).fetchone()

#             if existing is not None:
#                 raise HTTPException(
#                     status_code=409,
#                     detail=(
#                         "Device ID already registered. "
#                         "Use a new device ID for pairing."
#                     ),
#                 )

#             conn.execute("""
#                 INSERT INTO device_auth (device_id, token)
#                 VALUES (?, ?)
#             """, (
#                 data.device_id,
#                 device_token
#             ))

#             conn.execute("""
#                 INSERT INTO devices (
#                     id, name, url, total_gb, used_gb
#                 )
#                 VALUES (?, ?, ?, ?, ?)
#             """, (
#                 data.device_id,
#                 data.device_name.strip() or "Paired Phone",
#                 f"browser://{data.device_id}",
#                 0.1,
#                 0,
#             ))

#         session["used"] = True

#     return {
#         "message": "Device paired successfully!",
#         "device_id": data.device_id,
#         "device_token": device_token,
#     }

# # ---------------------------------------
# # STORAGE ACCOUNTING
# # ---------------------------------------


# def get_device_usage_rows():
#     with get_db() as conn:
#         rows = conn.execute("""
#             SELECT
#                 devices.id,
#                 devices.user_id,
#                 devices.name,
#                 devices.url,
#                 devices.total_gb,
#                 COALESCE(SUM(chunks.size), 0)
#                     AS used_bytes
#             FROM devices
#             LEFT JOIN chunks
#                 ON chunks.device_id = devices.id
#             GROUP BY devices.id
#         """).fetchall()

#         return [dict(row) for row in rows]
# @app.get("/storage", dependencies=[Depends(require_owner_session)])
# def storage():
#     rows = get_device_usage_rows()

#     total_gb = sum(
#         row["total_gb"] for row in rows
#     )

#     used_bytes = sum(
#         row["used_bytes"] for row in rows
#     )

#     used_gb = used_bytes / GB
#     free_gb = max(0, total_gb - used_gb)

#     percentage = (
#         used_gb / total_gb * 100
#         if total_gb > 0
#         else 0
#     )

#     return {
#         "total_storage": round(total_gb, 4),
#         "used_storage": round(used_gb, 8),
#         "free_storage": round(free_gb, 8),
#         "used_percentage": round(percentage, 4),
#         "used_mb": round(
#             used_bytes / (1024 ** 2), 4
#         ),
#         "used_bytes": used_bytes,
#         "total_mb": round(total_gb * 1024, 2),
#     }


# @app.get("/devices", dependencies=[Depends(require_owner_session)])
# def device():
#     rows = get_device_usage_rows()
#     result = []

#     for row in rows:
#         item = dict(row)

#         item["used_gb"] = (
#             item["used_bytes"] / GB
#         )

#         allocated_free = max(
#             0,
#             item["total_gb"] - item["used_gb"],
#         )

#         url = item["url"]

#         if url.startswith("browser://"):
#             item["status"] = (
#                 "online"
#                 if item["id"] in connected_devices
#                 else "offline"
#             )

#             item["free_gb"] = allocated_free

#         else:
#             try:
#                 response = httpx.get(
#                     f"{url.rstrip('/')}/health",
#                     timeout=2.0,
#                 )

#                 response.raise_for_status()

#                 health = response.json()
#                 disk_free = health.get("free_gb")

#                 item["status"] = "online"

#                 if disk_free is None:
#                     item["free_gb"] = allocated_free
#                 else:
#                     item["free_gb"] = min(
#                         allocated_free,
#                         max(0, float(disk_free)),
#                     )

#             except (
#                 httpx.HTTPError,
#                 ValueError,
#                 TypeError,
#             ):
#                 item["status"] = "offline"
#                 item["free_gb"] = 0

#         result.append(item)

#     return {"devices": result}


# # ---------------------------------------
# # STORAGE NODES
# # ---------------------------------------

# def get_storage_nodes(user_id):
#     rows = get_device_usage_rows()

#     unique_nodes = []
#     seen_urls = set()

#     for row in rows:
#         # Only use devices owned by this user.
#         if row["user_id"] != user_id:
#             continue

#         url = row["url"]

#         if url in seen_urls:
#             continue

#         if url.startswith("browser://"):
#             if row["id"] not in connected_devices:
#                 continue
#         else:
#             try:
#                 response = httpx.get(
#                     f"{url.rstrip('/')}/health",
#                     timeout=2.0,
#                 )
#                 response.raise_for_status()
#             except httpx.HTTPError:
#                 continue

#         unique_nodes.append({
#             "id": row["id"],
#             "name": row["name"],
#             "url": url,
#             "total_gb": row["total_gb"],
#             "used_bytes": row["used_bytes"],
#         })

#         seen_urls.add(url)

#     return unique_nodes



# def split_into_chunk(data: bytes):
#     return [
#         data[start:start + CHUNK_SIZE]
#         for start in range(0, len(data), CHUNK_SIZE)
#     ]


# def node_token():
#     token = os.environ.get("NODE_TOKEN")

#     if not token:
#         raise RuntimeError(
#             "Coordinator NODE_TOKEN is missing"
#         )

#     return token


# def send_chunks(node, chunk_id, chunk_data):
#     token = node_token()

#     response = httpx.post(
#         f"{node['url'].rstrip('/')}/chunks/{chunk_id}",
#         files={
#             "file": ("chunk.bin", chunk_data)
#         },
#         headers={
#             "X-Node-Token": token
#         },
#         timeout=20.0,
#     )

#     response.raise_for_status()
#     return response.json()


# async def send_chunk_to_node(
#     node, chunk_id, chunk_data
# ):
#     if node["url"].startswith("browser://"):
#         return await store_browser_chunk(
#             node["id"],
#             chunk_id,
#             chunk_data,
#         )

#     return await asyncio.to_thread(
#         send_chunks,
#         node,
#         chunk_id,
#         chunk_data,
#     )


# async def retrieve_chunk_from_node(
#     device_id, node_url, chunk_id
# ):
#     if node_url.startswith("browser://"):
#         return await retrieve_browser_chunk(
#             device_id,
#             chunk_id,
#         )

#     response = await asyncio.to_thread(
#         httpx.get,
#         (
#             f"{node_url.rstrip('/')}"
#             f"/chunks/{chunk_id}/download"
#         ),
#         headers={
#             "X-Node-Token": node_token()
#         },
#         timeout=20.0,
#     )

#     response.raise_for_status()
#     return response.content


# async def delete_chunk_from_node(
#     device_id, node_url, chunk_id
# ):
#     if node_url.startswith("browser://"):
#         return await delete_browser_chunk(
#             device_id,
#             chunk_id,
#         )

#     response = await asyncio.to_thread(
#         httpx.delete,
#         f"{node_url.rstrip('/')}/chunks/{chunk_id}",
#         headers={
#             "X-Node-Token": node_token()
#         },
#         timeout=20.0,
#     )

#     response.raise_for_status()
#     return response.json()


# # ---------------------------------------
# # FILE UPLOAD
# # ---------------------------------------

# @app.post("/upload", dependencies=[Depends(require_owner_session)])
# async def upload_file(file: UploadFile = File(...)):
#     content = await file.read()

#     compressed_content = zlib.compress(content)
#     chunks = split_into_chunk(compressed_content)

#     nodes = get_storage_nodes()

#     if not nodes:
#         raise HTTPException(
#             status_code=503,
#             detail="No storage nodes available",
#         )

#     # Round-robin chunk distribution.
#     placements = []

#     for index, chunk in enumerate(chunks):
#         node = nodes[index % len(nodes)]
#         placements.append((index, node, chunk))

#     # Check allocated storage capacity.
#     required = {
#         node["id"]: 0
#         for node in nodes
#     }

#     for _, node, chunk in placements:
#         required[node["id"]] += len(chunk)

#     for node in nodes:
#         remaining_bytes = max(
#             0,
#             node["total_gb"] * GB
#             - node["used_bytes"],
#         )

#         if required[node["id"]] > remaining_bytes:
#             raise HTTPException(
#                 status_code=507,
#                 detail=(
#                     "Not enough allocated storage "
#                     f"on device {node['id']}"
#                 ),
#             )

#     file_id = str(uuid4())

#     STORAGE_PATH.mkdir(
#         parents=True,
#         exist_ok=True,
#     )

#     file_path = STORAGE_PATH / f"{file_id}.bin"

#     stored_chunks = []

#     try:
#         # Preserve existing local compressed backup.
#         file_path.write_bytes(compressed_content)

#         # Store chunks on selected nodes.
#         for index, node, chunk in placements:
#             chunk_id = (
#                 f"{file_id.replace('-', '')}_{index}"
#             )

#             # Track before sending so cleanup can
#             # also attempt a partially completed write.
#             stored_chunks.append((
#                 node["id"],
#                 node["url"],
#                 chunk_id,
#             ))

#             await send_chunk_to_node(
#                 node,
#                 chunk_id,
#                 chunk,
#             )

#         # Commit metadata only after all writes succeed.
#         with get_db() as conn:
#             conn.execute("""
#                 INSERT INTO files (
#                     id, name, size, path, status
#                 )
#                 VALUES (?, ?, ?, ?, 'ready')
#             """, (
#                 file_id,
#                 file.filename,
#                 len(compressed_content),
#                 str(file_path),
#             ))

#             for index, node, chunk in placements:
#                 chunk_id = (
#                     f"{file_id.replace('-', '')}_{index}"
#                 )

#                 conn.execute("""
#                     INSERT INTO chunks (
#                         id, file_id, chunk_index,
#                         device_id, size
#                     )
#                     VALUES (?, ?, ?, ?, ?)
#                 """, (
#                     chunk_id,
#                     file_id,
#                     index,
#                     node["id"],
#                     len(chunk),
#                 ))

#                 conn.execute("""
#                     UPDATE devices
#                     SET used_gb = used_gb + ?
#                     WHERE id = ?
#                 """, (
#                     len(chunk) / GB,
#                     node["id"],
#                 ))

#     except Exception as error:
#         cleanup_failed = []

#         for device_id, node_url, chunk_id in reversed(
#             stored_chunks
#         ):
#             try:
#                 await delete_chunk_from_node(
#                     device_id,
#                     node_url,
#                     chunk_id,
#                 )
#             except Exception as cleanup_error:
#                 cleanup_failed.append(chunk_id)
#                 print(
#                     "Upload cleanup failed:",
#                     chunk_id,
#                     cleanup_error,
#                 )

#         # Only remove backup when remote cleanup
#         # completed; otherwise retain recovery copy.
#         if not cleanup_failed:
#             file_path.unlink(missing_ok=True)

#         raise HTTPException(
#             status_code=500,
#             detail=(
#                 "Upload failed. "
#                 "Check backend logs for cleanup details."
#             ),
#         ) from error

#     return {
#         "filename": file.filename,
#         "file_id": file_id,
#         "size_byte": len(compressed_content),
#         "original_size_byte": len(content),
#         "message": "File uploaded successfully",
#     }


# # ---------------------------------------
# # FILE LIST
# # ---------------------------------------

# @app.get("/files", dependencies=[Depends(require_owner_session)])
# def get_files():
#     with get_db() as conn:
#         rows = conn.execute("""
#             SELECT *
#             FROM files
#             ORDER BY rowid DESC
#         """).fetchall()

#     return {
#         "files": [dict(row) for row in rows]
#     }


# # ---------------------------------------
# # FILE DOWNLOAD
# # ---------------------------------------

# @app.get("/files/{file_id}/download", dependencies=[Depends(require_owner_session)])
# async def download_file(file_id: str):
#     with get_db() as conn:
#         file_row = conn.execute(
#             "SELECT * FROM files WHERE id = ?",
#             (file_id,),
#         ).fetchone()

#         chunks = conn.execute("""
#             SELECT
#                 chunks.id,
#                 chunks.chunk_index,
#                 chunks.device_id,
#                 devices.url
#             FROM chunks
#             JOIN devices
#                 ON chunks.device_id = devices.id
#             WHERE chunks.file_id = ?
#             ORDER BY chunks.chunk_index ASC
#         """, (file_id,)).fetchall()

#     if file_row is None:
#         raise HTTPException(
#             status_code=404,
#             detail="File not found",
#         )

#     if file_row["status"] == "deleting":
#         raise HTTPException(
#             status_code=409,
#             detail="File deletion is in progress",
#         )

#     if not chunks:
#         raise HTTPException(
#             status_code=404,
#             detail="No chunks found for this file",
#         )

#     retrieved_chunks = []

#     for chunk in chunks:
#         try:
#             data = await retrieve_chunk_from_node(
#                 chunk["device_id"],
#                 chunk["url"],
#                 chunk["id"],
#             )

#             retrieved_chunks.append(data)

#         except Exception as error:
#             raise HTTPException(
#                 status_code=503,
#                 detail=(
#                     "Unable to retrieve chunk "
#                     f"{chunk['id']}: {error}"
#                 ),
#             ) from error

#     compressed_data = b"".join(retrieved_chunks)

#     try:
#         original_data = zlib.decompress(
#             compressed_data
#         )
#     except zlib.error as error:
#         raise HTTPException(
#             status_code=500,
#             detail="File reconstruction failed",
#         ) from error

#     # Safe filename for Content-Disposition.
#     original_name = (
#         Path(file_row["name"] or "download.bin").name
#     )

#     safe_name = original_name.replace(
#         '"', "_"
#     ).replace("\r", "_").replace("\n", "_")

#     return Response(
#         content=original_data,
#         media_type="application/octet-stream",
#         headers={
#             "Content-Disposition": (
#                 f'attachment; filename="{safe_name}"'
#             )
#         },
#     )


# # ---------------------------------------
# # FILE DELETE
# # ---------------------------------------

# @app.delete("/files/{file_id}", dependencies=[Depends(require_owner_session)])
# async def deleteFile(file_id: str):
#     with get_db() as conn:
#         file_row = conn.execute(
#             "SELECT * FROM files WHERE id = ?",
#             (file_id,),
#         ).fetchone()

#         if file_row is None:
#             raise HTTPException(
#                 status_code=404,
#                 detail="File not found",
#             )

#         chunks = conn.execute("""
#             SELECT
#                 chunks.id,
#                 chunks.size,
#                 chunks.device_id,
#                 devices.url
#             FROM chunks
#             JOIN devices
#                 ON chunks.device_id = devices.id
#             WHERE chunks.file_id = ?
#             ORDER BY chunks.chunk_index ASC
#         """, (file_id,)).fetchall()

#         conn.execute("""
#             UPDATE files
#             SET status = 'deleting'
#             WHERE id = ?
#         """, (file_id,))

#     # Each successfully deleted chunk updates usage.
#     # If a device is offline, remaining metadata stays
#     # available for retrying deletion later.
#     for chunk in chunks:
#         try:
#             await delete_chunk_from_node(
#                 chunk["device_id"],
#                 chunk["url"],
#                 chunk["id"],
#             )

#         except Exception as error:
#             raise HTTPException(
#                 status_code=503,
#                 detail=(
#                     "Failed to delete chunk "
#                     f"{chunk['id']}: {error}"
#                 ),
#             ) from error

#         with get_db() as conn:
#             conn.execute(
#                 "DELETE FROM chunks WHERE id = ?",
#                 (chunk["id"],),
#             )

#             conn.execute("""
#                 UPDATE devices
#                 SET used_gb = MAX(0, used_gb - ?)
#                 WHERE id = ?
#             """, (
#                 chunk["size"] / GB,
#                 chunk["device_id"],
#             ))

#     backup_path = Path(file_row["path"])

#     if backup_path.is_file():
#         backup_path.unlink()

#     with get_db() as conn:
#         conn.execute(
#             "DELETE FROM files WHERE id = ?",
#             (file_id,),
#         )

#     return {
#         "message": (
#             "File and all distributed chunks "
#             "deleted successfully"
#         )
#     }


# # ---------------------------------------
# # SAFE DEVICE REMOVAL
# # ---------------------------------------

# @app.delete("/devices/{device_id}", dependencies=[Depends(require_owner_session)])
# async def remove_device(device_id: str):
#     with get_db() as conn:
#         device = conn.execute(
#             "SELECT id, name FROM devices WHERE id = ?",
#             (device_id,)
#         ).fetchone()

#         if device is None:
#             raise HTTPException(
#                 status_code=404,
#                 detail="Device not found"
#             )

#         chunk_count = conn.execute(
#             "SELECT COUNT(*) FROM chunks WHERE device_id = ?",
#             (device_id,)
#         ).fetchone()[0]

#         if chunk_count > 0:
#             raise HTTPException(
#                 status_code=409,
#                 detail=(
#                     f"Cannot remove device. It contains "
#                     f"{chunk_count} stored file chunks. "
#                     "Delete or safely migrate those files first."
#                 )
#             )

#         conn.execute(
#             "DELETE FROM device_auth WHERE device_id = ?",
#             (device_id,)
#         )

#         conn.execute(
#             "DELETE FROM devices WHERE id = ?",
#             (device_id,)
#         )
#     await disconnect_device(device_id)
#     return {
#         "message": "Device removed successfully",
#         "device_id": device_id
#     }

# # ---------------------------------------
# # REGISTER LAPTOP / AGENT
# # ---------------------------------------

# @app.post("/devices/register", dependencies=[Depends(require_owner_session)])
# def register_device(device: DeviceRegister):
#     try:
#         response = httpx.get(
#             f"{device.url.rstrip('/')}/health",
#             timeout=2.0,
#         )
#         response.raise_for_status()

#         free_gb = response.json().get("free_gb")

#     except httpx.HTTPError as error:
#         raise HTTPException(
#             status_code=503,
#             detail="Device agent is unreachable",
#         ) from error

#     if free_gb is None:
#         raise HTTPException(
#             status_code=400,
#             detail="Agent did not report free storage",
#         )

#     with get_db() as conn:
#         used_bytes = conn.execute("""
#             SELECT COALESCE(SUM(size), 0)
#             FROM chunks
#             WHERE device_id = ?
#         """, (device.id,)).fetchone()[0]

#         if device.total_gb * GB < used_bytes:
#             raise HTTPException(
#                 status_code=400,
#                 detail="Allocation is below current usage",
#             )

#         if (
#             device.total_gb - used_bytes / GB
#             > float(free_gb)
#         ):
#             raise HTTPException(
#                 status_code=400,
#                 detail="Not enough free disk storage",
#             )

#         conn.execute("""
#             INSERT INTO devices (
#                 id, name, url, total_gb, used_gb
#             )
#             VALUES (?, ?, ?, ?, ?)
#             ON CONFLICT(id) DO UPDATE SET
#                 url = excluded.url,
#                 total_gb = excluded.total_gb
#         """, (
#             device.id,
#             device.name,
#             device.url,
#             device.total_gb,
#             used_bytes / GB,
#         ))

#     return {
#         "message": "Device registered successfully"
#     }


# # ---------------------------------------
# # PHONE STORAGE TESTS
# # ---------------------------------------

# @app.post("/test-device-storage/{device_id}", dependencies=[Depends(require_owner_session)])
# async def test_device_storage(device_id: str):
#     if device_id not in connected_devices:
#         raise HTTPException(
#             status_code=404,
#             detail="Device is offline",
#         )

#     chunk_id = f"text-test-{uuid4().hex}"
#     original_data = "Hello from PuffPress!"

#     try:
#         stored = await send_to_device(
#             device_id,
#             {
#                 "action": "STORE",
#                 "chunk_id": chunk_id,
#                 "data": original_data,
#             },
#         )

#         if stored.get("status") != "stored":
#             raise HTTPException(
#                 status_code=500,
#                 detail=str(stored),
#             )

#         retrieved = await send_to_device(
#             device_id,
#             {
#                 "action": "GET",
#                 "chunk_id": chunk_id,
#             },
#         )

#         if retrieved.get("data") != original_data:
#             raise HTTPException(
#                 status_code=500,
#                 detail="Data mismatch",
#             )

#         return {
#             "message": "Real device storage verified!",
#             "device_id": device_id,
#             "stored": stored["status"],
#             "retrieved": retrieved["data"],
#         }

#     finally:
#         try:
#             await delete_browser_chunk(
#                 device_id,
#                 chunk_id,
#             )
#         except Exception:
#             pass


# @app.post("/test-binary-storage/{device_id}", dependencies=[Depends(require_owner_session)])
# async def test_binary_storage(device_id: str):
#     if device_id not in connected_devices:
#         raise HTTPException(
#             status_code=404,
#             detail="Device is offline",
#         )

#     original = os.urandom(256 * 1024)
#     chunk_id = f"binary-test-{uuid4().hex}"

#     try:
#         await store_browser_chunk(
#             device_id,
#             chunk_id,
#             original,
#         )

#         retrieved = await retrieve_browser_chunk(
#             device_id,
#             chunk_id,
#         )

#         original_hash = hashlib.sha256(
#             original
#         ).hexdigest()

#         retrieved_hash = hashlib.sha256(
#             retrieved
#         ).hexdigest()

#         if original_hash != retrieved_hash:
#             raise HTTPException(
#                 status_code=500,
#                 detail="Chunk integrity verification failed",
#             )

#         return {
#             "message": (
#                 "Binary chunk stored and "
#                 "retrieved successfully!"
#             ),
#             "bytes": len(original),
#             "sha256_match": True,
#             "device_id": device_id,
#         }

#     finally:
#         try:
#             await delete_browser_chunk(
#                 device_id,
#                 chunk_id,
#             )
#         except Exception:
#             pass


# # ---------------------------------------
# # BROWSER DEVICE REGISTRATION
# # ---------------------------------------


# @app.post("/register-browser-device/{device_id}")
# async def register_browser_device(
#     device_id: str,
#     request: Request
# ):
#     # Only the authenticated owner can update
#     # registration information.
#     require_owner_session(request)

#     if device_id not in connected_devices:
#         raise HTTPException(
#             status_code=404,
#             detail="Device is offline",
#         )

#     # The device must already be paired.
#     with get_db() as conn:
#         existing = conn.execute("""
#             SELECT id
#             FROM device_auth
#             WHERE device_id = ?
#         """, (device_id,)).fetchone()

#         if existing is None:
#             raise HTTPException(
#                 status_code=403,
#                 detail="Device is not paired",
#             )

#         conn.execute("""
#             INSERT INTO devices (
#                 id, name, url, total_gb, used_gb
#             )
#             VALUES (?, ?, ?, ?, ?)
#             ON CONFLICT(id) DO UPDATE SET
#                 url = excluded.url
#         """, (
#             device_id,
#             "Connected Phone",
#             f"browser://{device_id}",
#             0.1,
#             0,
#         ))

#     return {
#         "message": "Browser device registered successfully!",
#         "device_id": device_id,
#     }


# # ---------------------------------------
# # DEBUG: DEVICE CHUNK COUNTS
# # ---------------------------------------

# @app.get("/debug/device-chunks", dependencies=[Depends(require_owner_session)])
# def device_chunk_counts():
#     with get_db() as conn:
#         rows = conn.execute("""
#             SELECT
#                 devices.id,
#                 devices.name,
#                 devices.url,
#                 COUNT(chunks.id) AS chunk_count,
#                 COALESCE(SUM(chunks.size), 0)
#                     AS used_bytes
#             FROM devices
#             LEFT JOIN chunks
#                 ON chunks.device_id = devices.id
#             GROUP BY devices.id
#         """).fetchall()

#     return {
#         "devices": [
#             {
#                 "id": row["id"],
#                 "name": row["name"],
#                 "url": row["url"],
#                 "chunk_count": row["chunk_count"],
#                 "used_bytes": row["used_bytes"],
#                 "used_mb": round(
#                     row["used_bytes"] / (1024 ** 2),
#                     4,
#                 ),
#             }
#             for row in rows
#         ]
#     }

# # ---------------------------------------
# # PRODUCTION FRONTEND
# # ---------------------------------------

# FRONTEND_DIST = BASE_PATH / "frontend" / "dist"

# if FRONTEND_DIST.is_dir():
#     @app.get("/pair.html", include_in_schema=False)
#     def serve_pair_page():
#         return FileResponse(FRONTEND_DIST / "pair.html")

#     @app.get("/device.html", include_in_schema=False)
#     def serve_device_page():
#         return FileResponse(FRONTEND_DIST / "device.html")

#     app.mount(
#         "/",
#         StaticFiles(
#             directory=FRONTEND_DIST,
#             html=True
#         ),
#         name="frontend"
#     )

from fastapi import FastAPI, HTTPException, Response, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import jwt
from jwt import PyJWKClient
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from uuid import uuid4
from fastapi import Cookie
from fastapi.responses import JSONResponse
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from pydantic import BaseModel, Field
from fastapi import Depends, Security
from fastapi.security import APIKeyHeader
import sqlite3
import zlib
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import asyncio
import qrcode
import io
import httpx
import secrets
import time
import hashlib
import base64
from collections import defaultdict
from threading import Lock
from backend.device_bridge import (
    router as device_router,
    connected_devices,
    send_to_device,
    store_browser_chunk,
    retrieve_browser_chunk,
    delete_browser_chunk,
    disconnect_device,
)
# ---------------------------------------
# CONFIGURATION
# ---------------------------------------

BASE_PATH = Path(__file__).resolve().parent.parent
DB_PATH = BASE_PATH / "puffpress.db"
STORAGE_PATH = BASE_PATH / "storage"

CHUNK_SIZE = 256 * 1024
GB = 1024 ** 3
PAIRING_EXPIRY = 300

pairing_sessions = {}

login_attempts = defaultdict(list)
login_attempts_lock = Lock()

pairing_attempts_lock = Lock()

LOGIN_MAX_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 300
PAIRING_MAX_ATTEMPTS = 5
# ---------------------------------------
# DATABASE
# ---------------------------------------

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                name TEXT,
                size INTEGER,
                path TEXT
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS devices (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                total_gb REAL NOT NULL,
                used_gb REAL DEFAULT 0
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS chunks (
                id TEXT PRIMARY KEY,
                file_id TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                device_id TEXT NOT NULL,
                size INTEGER NOT NULL,
                FOREIGN KEY (file_id) REFERENCES files(id),
                FOREIGN KEY (device_id) REFERENCES devices(id),
                UNIQUE(file_id, chunk_index)
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS device_auth (
                device_id TEXT PRIMARY KEY,
                token TEXT NOT NULL
            )
        """)

        # Multi-user migration: preserve existing data.
        for table in ("files", "devices"):
            columns = {
                row["name"]
                for row in conn.execute(
                    f"PRAGMA table_info({table})"
                ).fetchall()
            }

            if "user_id" not in columns:
                conn.execute(
                    f"ALTER TABLE {table} ADD COLUMN user_id TEXT"
                )
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(devices)")}
        if "priority" not in columns:
            conn.execute("ALTER TABLE devices ADD COLUMN priority INTEGER NOT NULL DEFAULT 3")
        # Recalculate usage from recorded chunks.
        conn.execute("""
            UPDATE devices
            SET used_gb = COALESCE((
                SELECT SUM(chunks.size) / 1073741824.0
                FROM chunks
                WHERE chunks.device_id = devices.id
            ), 0)
        """)


init_database()


# ---------------------------------------
# FASTAPI
# ---------------------------------------

app = FastAPI(title="PuffPress API")

app.include_router(device_router)

frontend_origin = os.environ.get(
    "PUFFPRESS_FRONTEND_ORIGIN", ""
).rstrip("/")

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://10.241.119.38:5173",
    "http://192.168.0.108:5173",
    "http://10.93.125.38:5173",
    "https://puffpress-frontend.vercel.app",
]

if frontend_origin:
    allowed_origins.append(frontend_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "PATCH"],
    allow_headers=["*"],
)

api_key_header = APIKeyHeader(
    name="X-PuffPress-Key",
    auto_error=False
)

def require_api_key(api_key: str = Security(api_key_header)):
    expected = os.environ.get("PUFFPRESS_API_KEY")

    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Backend API key not configured"
        )

    if not api_key or not secrets.compare_digest(api_key, expected):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized"
        )
def get_session_serializer():
    secret = os.environ.get("PUFFPRESS_API_KEY")

    if not secret:
        raise HTTPException(
            status_code=503,
            detail="Session secret not configured"
        )

    return URLSafeTimedSerializer(
        secret,
        salt="puffpress-owner-session"
    )

def require_owner_session(request: Request):
    token = request.cookies.get("puffpress_session")

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Login required"
        )

    try:
        data = get_session_serializer().loads(
            token,
            max_age=86400
        )
    except (BadSignature, SignatureExpired):
        raise HTTPException(
            status_code=401,
            detail="Session expired or invalid"
        )

    if data.get("role") != "owner":
        raise HTTPException(
            status_code=401,
            detail="Invalid session"
        )

    if request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("origin")

        public_origin = os.environ.get(
            "PUFFPRESS_PUBLIC_ORIGIN",
            ""
        ).rstrip("/")

        allowed_origins = {
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173"
        }

        if public_origin:
            allowed_origins.add(public_origin)
        if frontend_origin:
            allowed_origins.add(frontend_origin)
        if origin not in allowed_origins:
            raise HTTPException(
                status_code=403,
                detail="Untrusted request origin"
            )

    return data
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")

supabase_bearer = HTTPBearer(auto_error=False)


def require_supabase_user(
    credentials: HTTPAuthorizationCredentials = Depends(supabase_bearer)
):
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Login required"
        )

    if not SUPABASE_URL:
        raise HTTPException(
            status_code=500,
            detail="Supabase backend URL not configured"
        )

    try:
        jwks_client = PyJWKClient(
            f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        )

        signing_key = jwks_client.get_signing_key_from_jwt(
            credentials.credentials
        )

        payload = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=f"{SUPABASE_URL}/auth/v1",
        )

        user_id = payload.get("sub")

        if not user_id:
            raise ValueError("Missing user ID")

        return user_id

    except (jwt.PyJWTError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired login"
        )
# ---------------------------------------
# MODELS
# ---------------------------------------
class OwnerLoginRequest(BaseModel):
    password: str

@app.post("/auth/login")
def owner_login(
    data: OwnerLoginRequest,
    request: Request,
    response: Response
):
    expected = os.environ.get("PUFFPRESS_API_KEY")

    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Login not configured"
        )

    client_ip = (
        request.client.host
        if request.client
        else "unknown"
    )

    now = time.time()

    with login_attempts_lock:
        attempts = login_attempts[client_ip]

        attempts[:] = [
            timestamp
            for timestamp in attempts
            if now - timestamp < LOGIN_WINDOW_SECONDS
        ]

        if len(attempts) >= LOGIN_MAX_ATTEMPTS:
            raise HTTPException(
                status_code=429,
                detail="Too many login attempts. Try again in 5 minutes."
            )

        if not secrets.compare_digest(
            data.password,
            expected
        ):
            attempts.append(now)

            raise HTTPException(
                status_code=401,
                detail="Invalid password"
            )

        login_attempts.pop(client_ip, None)

    serializer = get_session_serializer()
    token = serializer.dumps({"role": "owner"})

    public_origin = os.environ.get(
        "PUFFPRESS_PUBLIC_ORIGIN",
        ""
    ).strip()

    response.set_cookie(
        key="puffpress_session",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=86400,
        path="/"
    )

    return {"message": "Login successful"}

@app.get("/auth/check")
def check_owner_session(
    session=Depends(require_owner_session)
):
    return {"authenticated": True}
class DeviceRegister(BaseModel):
    id: str
    name: str
    url: str
    total_gb: float = Field(gt=0)


class PairingVerifyRequest(BaseModel):
    pairing_id: str
    passcode: str
    device_id: str
    device_name: str = Field(
        default="Paired Phone",
        min_length=1,
        max_length=50
    )
    allocated_gb: float


# ---------------------------------------
# BASIC ENDPOINTS
# ---------------------------------------


@app.get("/")
def home():
    index_file = BASE_PATH / "frontend" / "dist" / "index.html"

    if index_file.is_file():
        return FileResponse(index_file)

    return {
        "app": "PuffPress",
        "status": "running",
        "message": "Frontend build not found"
    }

@app.get("/about")
def about():
    return {
        "app": "PuffPress",
        "message": "Distributed storage across your devices",
        "status": "development",
    }


# ---------------------------------------
# PAIRING
# ---------------------------------------

def get_pairing_frontend_origin(request: Request):
    configured = os.environ.get("PUFFPRESS_FRONTEND_ORIGIN", "").rstrip("/")
    if configured:
        return configured

    # Local development: use the frontend origin that initiated pairing.
    origin = request.headers.get("origin", "").rstrip("/")
    if origin in (
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
    ):
        return origin

    raise HTTPException(
        status_code=503,
        detail="PUFFPRESS_FRONTEND_ORIGIN is not configured",
    )



def make_pairing_qr_png(pairing_id: str, frontend_origin: str):
    # Always direct the phone to the pairing page.
    frontend_origin = frontend_origin.rstrip("/")
    pairing_url = (
        f"{frontend_origin}/pair.html"
        f"?pairing_id={pairing_id}"
    )

    print("QR destination:", pairing_url)

    qr = qrcode.make(pairing_url)
    buffer = io.BytesIO()
    qr.save(buffer, format="PNG")
    return buffer.getvalue()


@app.post("/pairing/create", dependencies=[Depends(require_supabase_user)])
def create_pairing(request: Request, user_id: str = Depends(require_supabase_user)):
    frontend_url = get_pairing_frontend_origin(request)
    pairing_id = secrets.token_urlsafe(16)
    passcode = f"{secrets.randbelow(1000000):06d}"

    pairing_sessions[pairing_id] = {
        "passcode": passcode,
        "expires_at": time.time() + PAIRING_EXPIRY,
        "used": False,
        "user_id": user_id,
    }

    qr_png = make_pairing_qr_png(pairing_id, frontend_url)
    qr_image = "data:image/png;base64," + base64.b64encode(qr_png).decode("ascii")

    return {
        "pairing_id": pairing_id,
        "passcode": passcode,
        "expires_in": PAIRING_EXPIRY,
        "qr_image": qr_image,
    }


@app.get("/pairing/qr/{pairing_id}")
def pairing_qr(pairing_id: str, request: Request):
    # Kept for backwards compatibility. The web app uses qr_image from create.
    session = pairing_sessions.get(pairing_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Pairing session not found")
    if session["used"] or time.time() > session["expires_at"]:
        raise HTTPException(status_code=410, detail="Pairing session expired or used")

    frontend_url = get_pairing_frontend_origin(request)
    return Response(
        content=make_pairing_qr_png(pairing_id, frontend_url),
        media_type="image/png",
        headers={"Cache-Control": "no-store"},
    )


@app.post("/pairing/verify")
def verify_pairing(data: PairingVerifyRequest):
    with pairing_attempts_lock:
        session = pairing_sessions.get(data.pairing_id)

        if session is None:
            raise HTTPException(
                status_code=404,
                detail="Pairing session not found",
            )

        if time.time() > session["expires_at"]:
            pairing_sessions.pop(data.pairing_id, None)

            raise HTTPException(
                status_code=410,
                detail="Pairing code expired",
            )

        if session["used"]:
            raise HTTPException(
                status_code=400,
                detail="Pairing code already used",
            )

        attempts = session.setdefault("attempts", 0)

        if attempts >= PAIRING_MAX_ATTEMPTS:
            raise HTTPException(
                status_code=429,
                detail="Too many incorrect attempts. Create a new pairing code.",
            )

        if not secrets.compare_digest(
            session["passcode"],
            data.passcode
        ):
            session["attempts"] = attempts + 1

            raise HTTPException(
                status_code=401,
                detail="Incorrect passcode",
            )

        device_token = secrets.token_urlsafe(32)

        with get_db() as conn:
            existing = conn.execute(
                "SELECT id FROM devices WHERE id = ?",
                (data.device_id,),
            ).fetchone()

            if existing is not None:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Device ID already registered. "
                        "Use a new device ID for pairing."
                    ),
                )

            conn.execute("""
                INSERT INTO device_auth (device_id, token)
                VALUES (?, ?)
            """, (
                data.device_id,
                device_token
            ))

            conn.execute("""
                INSERT INTO devices (
                    id, name, url, total_gb, used_gb, user_id
                )
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                data.device_id,
                data.device_name.strip() or "Paired Phone",
                f"browser://{data.device_id}",
                data.allocated_gb,
                0,
                session["user_id"],
            ))

        session["used"] = True

    return {
        "message": "Device paired successfully!",
        "device_id": data.device_id,
        "device_token": device_token,
    }

# ---------------------------------------
# STORAGE ACCOUNTING
# ---------------------------------------


def get_device_usage_rows():
    with get_db() as conn:
        rows = conn.execute("""
            SELECT
                devices.id,
                devices.user_id,
                devices.name,
                devices.url,
                devices.total_gb,
                devices.priority,
                COALESCE(SUM(chunks.size), 0)
                    AS used_bytes
            FROM devices
            LEFT JOIN chunks
                ON chunks.device_id = devices.id
            GROUP BY devices.id
        """).fetchall()

        return [dict(row) for row in rows]
@app.get("/storage", dependencies=[Depends(require_supabase_user)])
def storage(user_id: str = Depends(require_supabase_user)):
    rows = [r for r in get_device_usage_rows() if r["user_id"] == user_id]

    total_gb = sum(
        row["total_gb"] for row in rows
    )

    used_bytes = sum(
        row["used_bytes"] for row in rows
    )

    used_gb = used_bytes / GB
    free_gb = max(0, total_gb - used_gb)

    percentage = (
        used_gb / total_gb * 100
        if total_gb > 0
        else 0
    )

    return {
        "total_storage": round(total_gb, 4),
        "used_storage": round(used_gb, 8),
        "free_storage": round(free_gb, 8),
        "used_percentage": round(percentage, 4),
        "used_mb": round(
            used_bytes / (1024 ** 2), 4
        ),
        "used_bytes": used_bytes,
        "total_mb": round(total_gb * 1024, 2),
    }


@app.get("/devices", dependencies=[Depends(require_supabase_user)])
def device(user_id: str = Depends(require_supabase_user)):
    rows = [r for r in get_device_usage_rows() if r["user_id"] == user_id]
    result = []

    for row in rows:
        item = dict(row)

        item["used_gb"] = (
            item["used_bytes"] / GB
        )

        allocated_free = max(
            0,
            item["total_gb"] - item["used_gb"],
        )

        url = item["url"]

        if url.startswith("browser://"):
            item["status"] = (
                "online"
                if item["id"] in connected_devices
                else "offline"
            )

            item["free_gb"] = allocated_free

        else:
            try:
                response = httpx.get(
                    f"{url.rstrip('/')}/health",
                    timeout=2.0,
                )

                response.raise_for_status()

                health = response.json()
                disk_free = health.get("free_gb")

                item["status"] = "online"

                if disk_free is None:
                    item["free_gb"] = allocated_free
                else:
                    item["free_gb"] = min(
                        allocated_free,
                        max(0, float(disk_free)),
                    )

            except (
                httpx.HTTPError,
                ValueError,
                TypeError,
            ):
                item["status"] = "offline"
                item["free_gb"] = 0

        result.append(item)

    return {"devices": result}


# ---------------------------------------
# STORAGE NODES
# ---------------------------------------

def get_storage_nodes(user_id):
    rows = get_device_usage_rows()

    unique_nodes = []
    seen_urls = set()

    for row in rows:
        # Only use devices owned by this user.
        if row["user_id"] != user_id:
            continue

        url = row["url"]

        if url in seen_urls:
            continue

        if url.startswith("browser://"):
            if row["id"] not in connected_devices:
                continue
        else:
            try:
                response = httpx.get(
                    f"{url.rstrip('/')}/health",
                    timeout=2.0,
                )
                response.raise_for_status()
            except httpx.HTTPError:
                continue

        unique_nodes.append({
            "id": row["id"],
            "name": row["name"],
            "url": url,
            "total_gb": row["total_gb"],
            "used_bytes": row["used_bytes"],
            "priority": row["priority"],
        })

        seen_urls.add(url)

    return sorted(unique_nodes, key=lambda n: n["priority"])



def split_into_chunk(data: bytes):
    return [
        data[start:start + CHUNK_SIZE]
        for start in range(0, len(data), CHUNK_SIZE)
    ]


def node_token():
    token = os.environ.get("NODE_TOKEN")

    if not token:
        raise RuntimeError(
            "Coordinator NODE_TOKEN is missing"
        )

    return token


def send_chunks(node, chunk_id, chunk_data):
    token = node_token()

    response = httpx.post(
        f"{node['url'].rstrip('/')}/chunks/{chunk_id}",
        files={
            "file": ("chunk.bin", chunk_data)
        },
        headers={
            "X-Node-Token": token
        },
        timeout=20.0,
    )

    response.raise_for_status()
    return response.json()


async def send_chunk_to_node(
    node, chunk_id, chunk_data
):
    if node["url"].startswith("browser://"):
        return await store_browser_chunk(
            node["id"],
            chunk_id,
            chunk_data,
        )

    return await asyncio.to_thread(
        send_chunks,
        node,
        chunk_id,
        chunk_data,
    )


async def retrieve_chunk_from_node(
    device_id, node_url, chunk_id
):
    if node_url.startswith("browser://"):
        return await retrieve_browser_chunk(
            device_id,
            chunk_id,
        )

    response = await asyncio.to_thread(
        httpx.get,
        (
            f"{node_url.rstrip('/')}"
            f"/chunks/{chunk_id}/download"
        ),
        headers={
            "X-Node-Token": node_token()
        },
        timeout=20.0,
    )

    response.raise_for_status()
    return response.content


async def delete_chunk_from_node(
    device_id, node_url, chunk_id
):
    if node_url.startswith("browser://"):
        return await delete_browser_chunk(
            device_id,
            chunk_id,
        )

    response = await asyncio.to_thread(
        httpx.delete,
        f"{node_url.rstrip('/')}/chunks/{chunk_id}",
        headers={
            "X-Node-Token": node_token()
        },
        timeout=20.0,
    )

    response.raise_for_status()
    return response.json()


# ---------------------------------------
# FILE UPLOAD
# ---------------------------------------

@app.post("/upload", dependencies=[Depends(require_supabase_user)])
async def upload_file(file: UploadFile = File(...), user_id: str = Depends(require_supabase_user)):
    content = await file.read()

    compressed_content = zlib.compress(content)
    chunks = split_into_chunk(compressed_content)

    nodes = get_storage_nodes(user_id)

    if not nodes:
        raise HTTPException(
            status_code=503,
            detail="No storage nodes available",
        )

    # Round-robin chunk distribution.
    placements = []

    for index, chunk in enumerate(chunks):
        node = nodes[index % len(nodes)]
        placements.append((index, node, chunk))

    # Check allocated storage capacity.
    required = {
        node["id"]: 0
        for node in nodes
    }

    for _, node, chunk in placements:
        required[node["id"]] += len(chunk)

    for node in nodes:
        remaining_bytes = max(
            0,
            node["total_gb"] * GB
            - node["used_bytes"],
        )

        if required[node["id"]] > remaining_bytes:
            raise HTTPException(
                status_code=507,
                detail=(
                    "Not enough allocated storage "
                    f"on device {node['id']}"
                ),
            )

    file_id = str(uuid4())

    STORAGE_PATH.mkdir(
        parents=True,
        exist_ok=True,
    )

    file_path = STORAGE_PATH / f"{file_id}.bin"

    stored_chunks = []

    try:
        # Preserve existing local compressed backup.
        file_path.write_bytes(compressed_content)

        # Store chunks on selected nodes.
        for index, node, chunk in placements:
            chunk_id = (
                f"{file_id.replace('-', '')}_{index}"
            )

            # Track before sending so cleanup can
            # also attempt a partially completed write.
            stored_chunks.append((
                node["id"],
                node["url"],
                chunk_id,
            ))

            await send_chunk_to_node(
                node,
                chunk_id,
                chunk,
            )

        # Commit metadata only after all writes succeed.
        with get_db() as conn:
            conn.execute("""
                INSERT INTO files (
                    id, name, size, path, status, user_id
                )
                VALUES (?, ?, ?, ?, 'ready', ?)
            """, (
                file_id,
                file.filename,
                len(compressed_content),
                str(file_path),
                user_id,
            ))

            for index, node, chunk in placements:
                chunk_id = (
                    f"{file_id.replace('-', '')}_{index}"
                )

                conn.execute("""
                    INSERT INTO chunks (
                        id, file_id, chunk_index,
                        device_id, size
                    )
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    chunk_id,
                    file_id,
                    index,
                    node["id"],
                    len(chunk),
                ))

                conn.execute("""
                    UPDATE devices
                    SET used_gb = used_gb + ?
                    WHERE id = ?
                """, (
                    len(chunk) / GB,
                    node["id"],
                ))

    except Exception as error:
        cleanup_failed = []

        for device_id, node_url, chunk_id in reversed(
            stored_chunks
        ):
            try:
                await delete_chunk_from_node(
                    device_id,
                    node_url,
                    chunk_id,
                )
            except Exception as cleanup_error:
                cleanup_failed.append(chunk_id)
                print(
                    "Upload cleanup failed:",
                    chunk_id,
                    cleanup_error,
                )

        # Only remove backup when remote cleanup
        # completed; otherwise retain recovery copy.
        if not cleanup_failed:
            file_path.unlink(missing_ok=True)

        raise HTTPException(
            status_code=500,
            detail=(
                "Upload failed. "
                "Check backend logs for cleanup details."
            ),
        ) from error

    return {
        "filename": file.filename,
        "file_id": file_id,
        "size_byte": len(compressed_content),
        "original_size_byte": len(content),
        "message": "File uploaded successfully",
    }


# ---------------------------------------
# FILE LIST
# ---------------------------------------

@app.get("/files", dependencies=[Depends(require_supabase_user)])
def get_files(user_id: str = Depends(require_supabase_user)):
    with get_db() as conn:
        rows = conn.execute("""
            SELECT *
            FROM files
            WHERE user_id = ?
            ORDER BY rowid DESC
        """, (user_id,)).fetchall()

    return {
        "files": [dict(row) for row in rows]
    }


# ---------------------------------------
# FILE DOWNLOAD
# ---------------------------------------

@app.get("/files/{file_id}/download", dependencies=[Depends(require_supabase_user)])
async def download_file(file_id: str, user_id: str = Depends(require_supabase_user)):
    with get_db() as conn:
        file_row = conn.execute(
            "SELECT * FROM files WHERE id = ? AND user_id = ?",
            (file_id, user_id),
        ).fetchone()

        chunks = conn.execute("""
            SELECT
                chunks.id,
                chunks.chunk_index,
                chunks.device_id,
                devices.url
            FROM chunks
            JOIN devices
                ON chunks.device_id = devices.id
            WHERE chunks.file_id = ?
            ORDER BY chunks.chunk_index ASC
        """, (file_id,)).fetchall()

    if file_row is None:
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    if file_row["status"] == "deleting":
        raise HTTPException(
            status_code=409,
            detail="File deletion is in progress",
        )

    if not chunks:
        raise HTTPException(
            status_code=404,
            detail="No chunks found for this file",
        )

    retrieved_chunks = []

    for chunk in chunks:
        try:
            data = await retrieve_chunk_from_node(
                chunk["device_id"],
                chunk["url"],
                chunk["id"],
            )

            retrieved_chunks.append(data)

        except Exception as error:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Unable to retrieve chunk "
                    f"{chunk['id']}: {error}"
                ),
            ) from error

    compressed_data = b"".join(retrieved_chunks)

    try:
        original_data = zlib.decompress(
            compressed_data
        )
    except zlib.error as error:
        raise HTTPException(
            status_code=500,
            detail="File reconstruction failed",
        ) from error

    # Safe filename for Content-Disposition.
    original_name = (
        Path(file_row["name"] or "download.bin").name
    )

    safe_name = original_name.replace(
        '"', "_"
    ).replace("\r", "_").replace("\n", "_")

    return Response(
        content=original_data,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{safe_name}"'
            )
        },
    )


# ---------------------------------------
# FILE DELETE
# ---------------------------------------

@app.delete("/files/{file_id}", dependencies=[Depends(require_supabase_user)])
async def deleteFile(file_id: str, user_id: str = Depends(require_supabase_user)):
    with get_db() as conn:
        file_row = conn.execute(
            "SELECT * FROM files WHERE id = ? AND user_id = ?",
            (file_id, user_id),
        ).fetchone()

        if file_row is None:
            raise HTTPException(
                status_code=404,
                detail="File not found",
            )

        chunks = conn.execute("""
            SELECT
                chunks.id,
                chunks.size,
                chunks.device_id,
                devices.url
            FROM chunks
            JOIN devices
                ON chunks.device_id = devices.id
            WHERE chunks.file_id = ?
            ORDER BY chunks.chunk_index ASC
        """, (file_id,)).fetchall()

        conn.execute("""
            UPDATE files
            SET status = 'deleting'
            WHERE id = ?
        """, (file_id,))

    # Each successfully deleted chunk updates usage.
    # If a device is offline, remaining metadata stays
    # available for retrying deletion later.
    for chunk in chunks:
        try:
            await delete_chunk_from_node(
                chunk["device_id"],
                chunk["url"],
                chunk["id"],
            )

        except Exception as error:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Failed to delete chunk "
                    f"{chunk['id']}: {error}"
                ),
            ) from error

        with get_db() as conn:
            conn.execute(
                "DELETE FROM chunks WHERE id = ?",
                (chunk["id"],),
            )

            conn.execute("""
                UPDATE devices
                SET used_gb = MAX(0, used_gb - ?)
                WHERE id = ?
            """, (
                chunk["size"] / GB,
                chunk["device_id"],
            ))

    backup_path = Path(file_row["path"])

    if backup_path.is_file():
        backup_path.unlink()

    with get_db() as conn:
        conn.execute(
            "DELETE FROM files WHERE id = ?",
            (file_id,),
        )

    return {
        "message": (
            "File and all distributed chunks "
            "deleted successfully"
        )
    }


# ---------------------------------------
# SAFE DEVICE REMOVAL
# ---------------------------------------

@app.delete("/devices/{device_id}", dependencies=[Depends(require_supabase_user)])
async def remove_device(device_id: str, user_id: str = Depends(require_supabase_user)):
    with get_db() as conn:
        device = conn.execute(
            "SELECT id, name FROM devices WHERE id = ? AND user_id = ?",
            (device_id, user_id)
        ).fetchone()

        if device is None:
            raise HTTPException(
                status_code=404,
                detail="Device not found"
            )

        chunk_count = conn.execute(
            "SELECT COUNT(*) FROM chunks WHERE device_id = ?",
            (device_id,)
        ).fetchone()[0]

        if chunk_count > 0:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Cannot remove device. It contains "
                    f"{chunk_count} stored file chunks. "
                    "Delete or safely migrate those files first."
                )
            )

        conn.execute(
            "DELETE FROM device_auth WHERE device_id = ?",
            (device_id,)
        )

        conn.execute(
            "DELETE FROM devices WHERE id = ?",
            (device_id,)
        )
    await disconnect_device(device_id)
    return {
        "message": "Device removed successfully",
        "device_id": device_id
    }

# ---------------------------------------
# REGISTER LAPTOP / AGENT
# ---------------------------------------

@app.post("/devices/register", dependencies=[Depends(require_supabase_user)])
def register_device(device: DeviceRegister, user_id: str = Depends(require_supabase_user)):
    try:
        response = httpx.get(
            f"{device.url.rstrip('/')}/health",
            timeout=2.0,
        )
        response.raise_for_status()

        free_gb = response.json().get("free_gb")

    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=503,
            detail="Device agent is unreachable",
        ) from error

    if free_gb is None:
        raise HTTPException(
            status_code=400,
            detail="Agent did not report free storage",
        )

    with get_db() as conn:
        existing = conn.execute("SELECT user_id FROM devices WHERE id = ?", (device.id,)).fetchone()
        if existing is not None and existing["user_id"] != user_id:
            raise HTTPException(status_code=409, detail="Device ID already registered")
        used_bytes = conn.execute("""
            SELECT COALESCE(SUM(size), 0)
            FROM chunks
            WHERE device_id = ?
        """, (device.id,)).fetchone()[0]

        if device.total_gb * GB < used_bytes:
            raise HTTPException(
                status_code=400,
                detail="Allocation is below current usage",
            )

        if (
            device.total_gb - used_bytes / GB
            > float(free_gb)
        ):
            raise HTTPException(
                status_code=400,
                detail="Not enough free disk storage",
            )

        conn.execute("""
            INSERT INTO devices (
                id, name, url, total_gb, used_gb, user_id
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                url = excluded.url,
                total_gb = excluded.total_gb
        """, (
            device.id,
            device.name,
            device.url,
            device.total_gb,
            used_bytes / GB,
            user_id,
        ))

    return {
        "message": "Device registered successfully"
    }


class PriorityUpdate(BaseModel):
    priority: int = Field(ge=1, le=5)


@app.patch("/devices/{device_id}/priority")
def update_device_priority(device_id: str, data: PriorityUpdate, user_id: str = Depends(require_supabase_user)):
    with get_db() as conn:
        cursor = conn.execute(
            "UPDATE devices SET priority = ? WHERE id = ? AND user_id = ?",
            (data.priority, device_id, user_id),
        )
        if cursor.rowcount != 1:
            raise HTTPException(status_code=404, detail="Device not found")
    return {"message": "Priority updated", "priority": data.priority}


# ---------------------------------------
# PHONE STORAGE TESTS
# ---------------------------------------

@app.post("/test-device-storage/{device_id}", dependencies=[Depends(require_supabase_user)])
async def test_device_storage(device_id: str, user_id: str = Depends(require_supabase_user)):
    with get_db() as conn:
        owned = conn.execute("SELECT 1 FROM devices WHERE id = ? AND user_id = ?", (device_id, user_id)).fetchone()
    if not owned:
        raise HTTPException(status_code=404, detail="Device not found")

    if device_id not in connected_devices:
        raise HTTPException(
            status_code=404,
            detail="Device is offline",
        )

    chunk_id = f"text-test-{uuid4().hex}"
    original_data = "Hello from PuffPress!"

    try:
        stored = await send_to_device(
            device_id,
            {
                "action": "STORE",
                "chunk_id": chunk_id,
                "data": original_data,
            },
        )

        if stored.get("status") != "stored":
            raise HTTPException(
                status_code=500,
                detail=str(stored),
            )

        retrieved = await send_to_device(
            device_id,
            {
                "action": "GET",
                "chunk_id": chunk_id,
            },
        )

        if retrieved.get("data") != original_data:
            raise HTTPException(
                status_code=500,
                detail="Data mismatch",
            )

        return {
            "message": "Real device storage verified!",
            "device_id": device_id,
            "stored": stored["status"],
            "retrieved": retrieved["data"],
        }

    finally:
        try:
            await delete_browser_chunk(
                device_id,
                chunk_id,
            )
        except Exception:
            pass


@app.post(
    "/test-binary-storage/{device_id}",
    dependencies=[Depends(require_supabase_user)]
)
async def test_binary_storage(device_id: str, user_id: str = Depends(require_supabase_user)):
    with get_db() as conn:
        owned = conn.execute("SELECT 1 FROM devices WHERE id = ? AND user_id = ?", (device_id, user_id)).fetchone()
    if not owned:
        raise HTTPException(status_code=404, detail="Device not found")

    if device_id not in connected_devices:
        raise HTTPException(
            status_code=404,
            detail="Device is offline",
        )

    original = os.urandom(256 * 1024)
    chunk_id = f"binary-test-{uuid4().hex}"

    try:
        await store_browser_chunk(
            device_id,
            chunk_id,
            original,
        )

        retrieved = await retrieve_browser_chunk(
            device_id,
            chunk_id,
        )

        original_hash = hashlib.sha256(
            original
        ).hexdigest()

        retrieved_hash = hashlib.sha256(
            retrieved
        ).hexdigest()

        if original_hash != retrieved_hash:
            raise HTTPException(
                status_code=500,
                detail="Chunk integrity verification failed",
            )

        return {
            "message": (
                "Binary chunk stored and "
                "retrieved successfully!"
            ),
            "bytes": len(original),
            "sha256_match": True,
            "device_id": device_id,
        }

    finally:
        try:
            await delete_browser_chunk(
                device_id,
                chunk_id,
            )
        except Exception:
            pass


# ---------------------------------------
# BROWSER DEVICE REGISTRATION
# ---------------------------------------


@app.post("/register-browser-device/{device_id}")
async def register_browser_device(
    device_id: str,
    user_id: str = Depends(require_supabase_user)
):

    if device_id not in connected_devices:
        raise HTTPException(
            status_code=404,
            detail="Device is offline",
        )

    # The device must already be paired.
    with get_db() as conn:
        existing = conn.execute("""
            SELECT device_auth.device_id
            FROM device_auth JOIN devices ON devices.id = device_auth.device_id
            WHERE device_auth.device_id = ? AND devices.user_id = ?
        """, (device_id, user_id)).fetchone()

        if existing is None:
            raise HTTPException(
                status_code=403,
                detail="Device is not paired",
            )

        conn.execute("UPDATE devices SET url = ? WHERE id = ? AND user_id = ?", (f"browser://{device_id}", device_id, user_id))

    return {
        "message": "Browser device registered successfully!",
        "device_id": device_id,
    }


# ---------------------------------------
# DEBUG: DEVICE CHUNK COUNTS
# ---------------------------------------

@app.get("/debug/device-chunks", dependencies=[Depends(require_supabase_user)])
def device_chunk_counts(user_id: str = Depends(require_supabase_user)):
    with get_db() as conn:
        rows = conn.execute("""
            SELECT
                devices.id,
                devices.name,
                devices.url,
                COUNT(chunks.id) AS chunk_count,
                COALESCE(SUM(chunks.size), 0)
                    AS used_bytes
            FROM devices
            LEFT JOIN chunks
                ON chunks.device_id = devices.id
            WHERE devices.user_id = ?
            GROUP BY devices.id
        """, (user_id,)).fetchall()

    return {
        "devices": [
            {
                "id": row["id"],
                "name": row["name"],
                "url": row["url"],
                "chunk_count": row["chunk_count"],
                "used_bytes": row["used_bytes"],
                "used_mb": round(
                    row["used_bytes"] / (1024 ** 2),
                    4,
                ),
            }
            for row in rows
        ]
    }

# ---------------------------------------
# PRODUCTION FRONTEND
# ---------------------------------------

FRONTEND_DIST = BASE_PATH / "frontend" / "dist"

if FRONTEND_DIST.is_dir():
    @app.get("/pair.html", include_in_schema=False)
    def serve_pair_page():
        return FileResponse(FRONTEND_DIST / "pair.html")

    @app.get("/device.html", include_in_schema=False)
    def serve_device_page():
        return FileResponse(FRONTEND_DIST / "device.html")

    app.mount(
        "/",
        StaticFiles(
            directory=FRONTEND_DIST,
            html=True
        ),
        name="frontend"
    )
