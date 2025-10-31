from fastapi import FastAPI, HTTPException, status, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
import jwt
from datetime import datetime, timedelta

from .twilio_sync_auth import (
    resolve_subaccount_sid_by_friendly_name,
    ensure_sync_primitives,
    get_user_record,
    upsert_user_record,
    verify_password,
)

JWT_SECRET = os.getenv("JWT_SECRET", "change-me")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))
ADMIN_PROVISIONING_TOKEN = os.getenv("ADMIN_PROVISIONING_TOKEN", "")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

app = FastAPI(title="SIPCHA API", version="0.1.0")

# Allow Refine SPA to talk to API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # lock down to your domains later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    subaccount_sid: str
    username: str

class UpsertUserRequest(BaseModel):
    username: str
    password: str
    roles: Optional[List[str]] = None

def create_jwt(subaccount_sid: str, username: str) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": username,
        "sc": subaccount_sid,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=JWT_EXPIRE_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

@app.get("/healthz")
def healthz():
    return {"ok": True, "ts": datetime.utcnow().isoformat()}

@app.post("/auth/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    subaccount: str = Query(..., description="Subaccount friendly_name"),
):
    sub_sid = resolve_subaccount_sid_by_friendly_name(subaccount)
    if not sub_sid:
        raise HTTPException(status_code=404, detail="Subaccount not found")

    service_sid = ensure_sync_primitives(sub_sid)
    record = get_user_record(sub_sid, service_sid, body.username)

    if not record or "password_hash" not in record:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(body.password, record["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_jwt(sub_sid, body.username)
    return TokenResponse(access_token=token, subaccount_sid=sub_sid, username=body.username)

@app.post("/auth/upsert-user")
def upsert_user(
    body: UpsertUserRequest,
    subaccount: str = Query(..., description="Subaccount friendly_name"),
    x_admin_provisioning_token: Optional[str] = Header(None),
):
    if not ADMIN_PROVISIONING_TOKEN or x_admin_provisioning_token != ADMIN_PROVISIONING_TOKEN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    sub_sid = resolve_subaccount_sid_by_friendly_name(subaccount)
    if not sub_sid:
        raise HTTPException(status_code=404, detail="Subaccount not found")

    service_sid = ensure_sync_primitives(sub_sid)
    upsert_user_record(sub_sid, service_sid, body.username, body.password, roles=body.roles or ["admin"])
    return {"ok": True, "username": body.username, "subaccount_sid": sub_sid}
