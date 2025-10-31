import os
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Depends, HTTPException, status, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from passlib.hash import bcrypt
from pydantic import BaseModel, Field

from twilio.rest import Client

# --------------------------
# Settings / Security
# --------------------------
JWT_SECRET = os.getenv("JWT_SECRET", "change-me")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))
ALGO = "HS256"

ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
if not ACCOUNT_SID or not AUTH_TOKEN:
    print("WARNING: TWILIO_ACCOUNT_SID/AUTH_TOKEN not set")

security = HTTPBearer()

def twilio_client_for(account_sid: Optional[str] = None) -> Client:
    """
    Return a Twilio client. If account_sid is provided and differs,
    set the 'account_sid' on the client for subaccount scoped calls.
    """
    base = Client(ACCOUNT_SID, AUTH_TOKEN)
    if account_sid and account_sid != ACCOUNT_SID:
        # Subaccount scoping
        base = Client(ACCOUNT_SID, AUTH_TOKEN, account_sid=account_sid)
    return base

def create_access_token(data: dict, expires_minutes: int = JWT_EXPIRE_MINUTES) -> str:
    to_encode = data.copy()
    expire = datetime.now(tz=timezone.utc) + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGO)

def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[ALGO])

# --------------------------
# Models
# --------------------------
class LoginIn(BaseModel):
    username: str
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class MeOut(BaseModel):
    subaccount_sid: str
    subaccount_name: str
    username: str

class AdminUserIn(BaseModel):
    username: str
    password: str
    roles: List[str] = Field(default_factory=lambda: ["admin"])

class AdminUserOut(BaseModel):
    username: str
    roles: List[str]
    updated_at: Optional[str] = None

# --------------------------
# App
# --------------------------
app = FastAPI(title="SIPCHA API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # lock down later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------
# Helpers: Subaccount & Sync
# --------------------------
def find_subaccount_by_name(client: Client, friendly_name: str) -> Optional[Dict[str, Any]]:
    """
    Find a subaccount by FriendlyName (exact match). Returns dict with sid/name or None.
    """
    # Twilio Accounts API does not provide a direct filter,
    # so we list a small page and check. If many subaccounts, consider caching.
    for acc in client.api.accounts.stream(status="active"):
        if getattr(acc, "friendly_name", None) == friendly_name:
            return {"sid": acc.sid, "friendly_name": acc.friendly_name}
    return None

def get_or_create_sync_service(client: Client) -> str:
    """
    Use the default Sync Service if one exists; otherwise create one named SIPCHA.
    Returns service SID.
    """
    services = list(client.sync.v1.services.stream())
    if services:
        return services[0].sid
    svc = client.sync.v1.services.create(friendly_name="SIPCHA")
    return svc.sid

def sync_doc_key_for_admin(username: str) -> str:
    return f"admin:{username}"

def read_admin_user(client: Client, service_sid: str, username: str) -> Optional[Dict[str, Any]]:
    key = sync_doc_key_for_admin(username)
    try:
        doc = client.sync.v1.services(service_sid).documents(key).fetch()
        return doc.data
    except Exception:
        return None

def write_admin_user(client: Client, service_sid: str, username: str, payload: Dict[str, Any]) -> None:
    key = sync_doc_key_for_admin(username)
    try:
        client.sync.v1.services(service_sid).documents(key).update(data=payload)
    except Exception:
        client.sync.v1.services(service_sid).documents.create(unique_name=key, data=payload)

# --------------------------
# Auth
# --------------------------
def get_current(identity: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = identity.credentials
    try:
        payload = decode_token(token)
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

@app.get("/healthz")
def healthz():
    return {"ok": True}

@app.post("/auth/login", response_model=TokenOut)
def login(subaccount: str = Query(..., description="Subaccount FriendlyName"), body: LoginIn = Body(...)):
    """
    Auth via Twilio Sync in the target subaccount:
    - Locate subaccount by FriendlyName
    - Ensure/locate Sync Service
    - Read document 'admin:{username}' -> { password_hash, roles }
    - bcrypt verify
    """
    if not subaccount:
        raise HTTPException(400, "subaccount is required")

    root = twilio_client_for()  # main account
    sa = find_subaccount_by_name(root, subaccount)
    if not sa:
        raise HTTPException(404, f"Subaccount '{subaccount}' not found")

    sub_client = twilio_client_for(sa["sid"])
    service_sid = get_or_create_sync_service(sub_client)

    rec = read_admin_user(sub_client, service_sid, body.username)
    if not rec:
        raise HTTPException(401, "Invalid username or password")

    pwd_hash = rec.get("password_hash")
    if not pwd_hash or not bcrypt.verify(body.password, pwd_hash):
        raise HTTPException(401, "Invalid username or password")

    roles = rec.get("roles", ["admin"])
    token = create_access_token(
        {
            "subaccount_sid": sa["sid"],
            "subaccount_name": sa["friendly_name"],
            "username": body.username,
            "roles": roles,
        }
    )
    return TokenOut(access_token=token)

@app.get("/me", response_model=MeOut)
def me(ctx: dict = Depends(get_current)):
    return MeOut(
        subaccount_sid=ctx["subaccount_sid"],
        subaccount_name=ctx["subaccount_name"],
        username=ctx["username"],
    )

# --------------------------
# Admin Users (Sync) CRUD (minimal)
# --------------------------
@app.get("/admin/users", response_model=List[AdminUserOut])
def list_admin_users(ctx: dict = Depends(get_current)):
    client = twilio_client_for(ctx["subaccount_sid"])
    service_sid = get_or_create_sync_service(client)
    out: List[AdminUserOut] = []
    for doc in client.sync.v1.services(service_sid).documents.stream():
        if doc.unique_name.startswith("admin:"):
            data = doc.data or {}
            out.append(
                AdminUserOut(
                    username=doc.unique_name.split("admin:", 1)[1],
                    roles=data.get("roles", ["admin"]),
                    updated_at=str(getattr(doc, "date_updated", None) or ""),
                )
            )
    return out

@app.post("/admin/users", response_model=AdminUserOut)
def create_admin_user(item: AdminUserIn, ctx: dict = Depends(get_current)):
    client = twilio_client_for(ctx["subaccount_sid"])
    service_sid = get_or_create_sync_service(client)
    payload = {
        "password_hash": bcrypt.hash(item.password),
        "roles": item.roles,
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }
    write_admin_user(client, service_sid, item.username, payload)
    return AdminUserOut(username=item.username, roles=item.roles, updated_at=payload["updated_at"])

# --------------------------
# Numbers / SIP (read-only to start)
# --------------------------
@app.get("/twilio/numbers")
def list_numbers(ctx: dict = Depends(get_current)):
    """
    List IncomingPhoneNumbers for the subaccount.
    """
    client = twilio_client_for(ctx["subaccount_sid"])
    items = []
    for n in client.incoming_phone_numbers.stream():
        items.append(
            {
                "sid": n.sid,
                "phone_number": n.phone_number,
                "friendly_name": n.friendly_name,
                "voice_url": n.voice_url,
                "sms_url": n.sms_url,
            }
        )
    return {"items": items}

@app.get("/twilio/sip/domains")
def list_sip_domains(ctx: dict = Depends(get_current)):
    client = twilio_client_for(ctx["subaccount_sid"])
    items = []
    for d in client.sip.domains.stream():
        items.append({"sid": d.sid, "domain_name": d.domain_name, "friendly_name": d.friendly_name})
    return {"items": items}
