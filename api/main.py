import os
import time
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Body, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import BaseModel
from passlib.hash import bcrypt
from twilio.rest import Client as TwilioClient
from twilio.base.exceptions import TwilioRestException

APP_NAME = "sipcha"
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALG = "HS256"
JWT_TTL = 60 * 60 * 24 * 7  # 7 days

# Master creds to enumerate/find subaccounts by friendly name
MASTER_SID = os.getenv("TWILIO_MASTER_ACCOUNT_SID", os.getenv("TWILIO_ACCOUNT_SID", ""))
MASTER_TOKEN = os.getenv("TWILIO_MASTER_AUTH_TOKEN", os.getenv("TWILIO_AUTH_TOKEN", ""))

# Twilio Verify service for password reset (can be master)
VERIFY_SERVICE_SID = os.getenv("VERIFY_SERVICE_SID", "")

# Resource names inside each subaccount
SYNC_SERVICE_FRIENDLY = f"{APP_NAME}-sync"
SYNC_MAP_ADMINS = "admins"
CRED_LIST_FRIENDLY = "admins"

if not MASTER_SID or not MASTER_TOKEN:
    raise RuntimeError("Set TWILIO_MASTER_ACCOUNT_SID and TWILIO_MASTER_AUTH_TOKEN")

master_client = TwilioClient(MASTER_SID, MASTER_TOKEN)
auth_scheme = HTTPBearer(auto_error=False)

app = FastAPI(title="Sipcha API")


# ---------- Models ----------
class LoginIn(BaseModel):
    username: str
    password: str

class TokenOut(BaseModel):
    token: str

class ChangePasswordIn(BaseModel):
    username: str
    old_password: str
    new_password: str

class ResetRequestIn(BaseModel):
    username: str

class ResetVerifyIn(BaseModel):
    username: str
    code: str
    new_password: str


# ---------- Helpers ----------
def issue_jwt(subaccount_sid: str, company: str, username: str) -> str:
    now = int(time.time())
    payload = {
        "sub": username,
        "acc": subaccount_sid,
        "cmp": company,
        "iat": now,
        "exp": now + JWT_TTL,
        "iss": APP_NAME,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def parse_jwt(token: str):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_subaccount_by_company(company: str):
    # We keep it simple: use subaccount friendly_name == company.
    # (You can later switch to a master Sync Map that maps company→subaccount SID)
    try:
        subs = master_client.api.accounts.list(friendly_name=company, limit=20)
        for acc in subs:
            if acc.friendly_name == company:
                return acc
    except TwilioRestException as e:
        raise HTTPException(500, f"Twilio error: {e.msg}")
    raise HTTPException(404, f"Company '{company}' not found")

def subaccount_client(company: str) -> TwilioClient:
    sub = get_subaccount_by_company(company)
    if sub.status == "closed":
        raise HTTPException(403, "Company subaccount is closed")
    # Use master creds but force the subaccount by account_sid override
    return TwilioClient(MASTER_SID, MASTER_TOKEN, account_sid=sub.sid)

def get_or_create_sync_service(sub_cli: TwilioClient) -> str:
    # Try to find by friendly name
    for svc in sub_cli.sync.v1.services.stream(limit=50):
        if getattr(svc, "friendly_name", "") == SYNC_SERVICE_FRIENDLY:
            return svc.sid
    # else create
    svc = sub_cli.sync.v1.services.create(friendly_name=SYNC_SERVICE_FRIENDLY)
    return svc.sid

def ensure_admins_map(sub_cli: TwilioClient, service_sid: str):
    try:
        sub_cli.sync.v1.services(service_sid).maps(SYNC_MAP_ADMINS).fetch()
    except TwilioRestException as e:
        if e.status == 404:
            sub_cli.sync.v1.services(service_sid).maps.create(unique_name=SYNC_MAP_ADMINS)
        else:
            raise

def ensure_admins_credlist(sub_cli: TwilioClient):
    # find by friendly name
    for cl in sub_cli.sip.credential_lists.stream(limit=50):
        if cl.friendly_name == CRED_LIST_FRIENDLY:
            return cl.sid
    # create if not exists
    created = sub_cli.sip.credential_lists.create(friendly_name=CRED_LIST_FRIENDLY)
    return created.sid

def sync_get_admin(sub_cli: TwilioClient, service_sid: str, username: str) -> Optional[dict]:
    try:
        item = sub_cli.sync.v1.services(service_sid).maps(SYNC_MAP_ADMINS).items(username).fetch()
        return item.data or {}
    except TwilioRestException as e:
        if e.status == 404:
            return None
        raise

def sync_upsert_admin(sub_cli: TwilioClient, service_sid: str, username: str, data: dict):
    sub_cli.sync.v1.services(service_sid).maps(SYNC_MAP_ADMINS).items(username).update(data=data)

def credlist_upsert_password(sub_cli: TwilioClient, credlist_sid: str, username: str, password: str):
    # Create or update credential in the list
    # Find existing
    existing = None
    for cred in sub_cli.sip.credential_lists(credlist_sid).credentials.stream(limit=200):
        if cred.username == username:
            existing = cred
            break
    if existing:
        sub_cli.sip.credential_lists(credlist_sid).credentials(existing.sid).update(password=password)
    else:
        sub_cli.sip.credential_lists(credlist_sid).credentials.create(username=username, password=password)


# ---------- Auth dependencies ----------
def require_auth(
    company: str = Query(..., description="Company slug (subaccount friendly_name)"),
    creds: HTTPAuthorizationCredentials = Depends(auth_scheme),
):
    if not creds or not creds.scheme.lower() == "bearer":
        raise HTTPException(401, "Missing bearer token")
    claims = parse_jwt(creds.credentials)
    if claims.get("cmp") != company:
        raise HTTPException(403, "Token company mismatch")
    return claims  # includes acc, cmp, sub=username


# ---------- Routes ----------
@app.get("/healthz")
def health():
    return {"ok": True}

@app.post("/auth/login", response_model=TokenOut)
def login(company: str = Query(...), body: LoginIn = Body(...)):
    sub_cli = subaccount_client(company)
    svc_sid = get_or_create_sync_service(sub_cli)
    ensure_admins_map(sub_cli, svc_sid)

    # validate user
    admin = sync_get_admin(sub_cli, svc_sid, body.username)
    if not admin or "password_hash" not in admin:
        raise HTTPException(401, "Invalid credentials")

    if not bcrypt.verify(body.password, admin["password_hash"]):
        raise HTTPException(401, "Invalid credentials")

    token = issue_jwt(sub_cli.account_sid, company, body.username)
    return TokenOut(token=token)

@app.post("/auth/change-password")
def change_password(
    company: str = Query(...),
    body: ChangePasswordIn = Body(...),
    claims: dict = Depends(require_auth),
):
    if claims["sub"] != body.username:
        raise HTTPException(403, "Can only change your own password")

    sub_cli = subaccount_client(company)
    svc_sid = get_or_create_sync_service(sub_cli)
    ensure_admins_map(sub_cli, svc_sid)
    credlist_sid = ensure_admins_credlist(sub_cli)

    admin = sync_get_admin(sub_cli, svc_sid, body.username)
    if not admin or "password_hash" not in admin:
        raise HTTPException(404, "User not found")

    if not bcrypt.verify(body.old_password, admin["password_hash"]):
        raise HTTPException(401, "Old password is incorrect")

    new_hash = bcrypt.hash(body.new_password)
    admin["password_hash"] = new_hash
    sync_upsert_admin(sub_cli, svc_sid, body.username, admin)

    # keep SIP credential list in sync
    credlist_upsert_password(sub_cli, credlist_sid, body.username, body.new_password)
    return {"ok": True}

@app.post("/auth/reset/request")
def reset_request(company: str = Query(...), body: ResetRequestIn = Body(...)):
    if not VERIFY_SERVICE_SID:
        raise HTTPException(500, "VERIFY_SERVICE_SID not configured")

    sub_cli = subaccount_client(company)
    svc_sid = get_or_create_sync_service(sub_cli)
    ensure_admins_map(sub_cli, svc_sid)

    admin = sync_get_admin(sub_cli, svc_sid, body.username)
    if not admin or "phone" not in admin:
        raise HTTPException(404, "User not found or no phone on file")

    phone = admin["phone"]
    try:
        master_client.verify.v2.services(VERIFY_SERVICE_SID).verifications.create(
            to=phone, channel="sms"
        )
    except TwilioRestException as e:
        raise HTTPException(502, f"Verify error: {e.msg}")

    return {"ok": True}

@app.post("/auth/reset/verify")
def reset_verify(company: str = Query(...), body: ResetVerifyIn = Body(...)):
    if not VERIFY_SERVICE_SID:
        raise HTTPException(500, "VERIFY_SERVICE_SID not configured")

    sub_cli = subaccount_client(company)
    svc_sid = get_or_create_sync_service(sub_cli)
    ensure_admins_map(sub_cli, svc_sid)
    credlist_sid = ensure_admins_credlist(sub_cli)

    admin = sync_get_admin(sub_cli, svc_sid, body.username)
    if not admin or "phone" not in admin:
        raise HTTPException(404, "User not found or no phone on file")

    phone = admin["phone"]

    # verify code
    try:
        check = master_client.verify.v2.services(VERIFY_SERVICE_SID).verification_checks.create(
            to=phone, code=body.code
        )
        if check.status != "approved":
            raise HTTPException(401, "Invalid code")
    except TwilioRestException as e:
        raise HTTPException(502, f"Verify error: {e.msg}")

    # set new password
    new_hash = bcrypt.hash(body.new_password)
    admin["password_hash"] = new_hash
    sync_upsert_admin(sub_cli, svc_sid, body.username, admin)
    credlist_upsert_password(sub_cli, credlist_sid, body.username, body.new_password)
    return {"ok": True}
