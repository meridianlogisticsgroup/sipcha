import os, re, pathlib
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Depends, HTTPException, status, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from passlib.hash import bcrypt
from pydantic import BaseModel, Field
from fastapi.responses import PlainTextResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles

from twilio.rest import Client

# ==========================
# Settings / Security
# ==========================
JWT_SECRET = os.getenv("JWT_SECRET", "change-me")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))
ALGO = "HS256"

ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
if not ACCOUNT_SID or not AUTH_TOKEN:
    print("WARNING: TWILIO_ACCOUNT_SID/AUTH_TOKEN not set")

security = HTTPBearer()

def twilio_client_for(account_sid: Optional[str] = None) -> Client:
    base = Client(ACCOUNT_SID, AUTH_TOKEN)
    if account_sid and account_sid != ACCOUNT_SID:
        base = Client(ACCOUNT_SID, AUTH_TOKEN, account_sid=account_sid)
    return base

def create_access_token(data: dict, expires_minutes: int = JWT_EXPIRE_MINUTES) -> str:
    to_encode = data.copy()
    expire = datetime.now(tz=timezone.utc) + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGO)

def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[ALGO])

# ==========================
# Models
# ==========================
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

# ==========================
# Helpers: Subaccount & Sync
# ==========================
SYNC_SERVICE_NAME = "sipcha-admins"
SYNC_MAP_UNIQUE_NAME = "admins"
AC_SID_RX = re.compile(r"^AC[a-fA-F0-9]{32}$")

def find_subaccount_by_name(client: Client, friendly_name: str) -> Optional[Dict[str, Any]]:
    for acc in client.api.accounts.stream(status="active"):
        if (getattr(acc, "friendly_name", None) or "").strip() == friendly_name.strip():
            return {"sid": acc.sid, "friendly_name": acc.friendly_name}
    return None

def get_subaccount_by_sid(client: Client, sid: str) -> Optional[Dict[str, Any]]:
    try:
        acc = client.api.accounts(sid).fetch()
        if acc and acc.sid == sid:
            return {"sid": acc.sid, "friendly_name": getattr(acc, "friendly_name", sid)}
    except Exception:
        pass
    return None

def _choose_consistent_sync_service_sid(services: List[Any]) -> Optional[str]:
    """
    Given a list of service records (already filtered to name matches),
    return a stable choice: prefer unique_name matches, then friendly matches;
    within each group, pick lowest SID for stability.
    """
    def key_sid(svc): return getattr(svc, "sid", "")
    uniques = [s for s in services if (getattr(s, "unique_name", "") or "").strip() == SYNC_SERVICE_NAME]
    if uniques:
        return sorted(uniques, key=key_sid)[0].sid
    friendly = [s for s in services if (getattr(s, "friendly_name", "") or "").strip() == SYNC_SERVICE_NAME]
    if friendly:
        return sorted(friendly, key=key_sid)[0].sid
    return None

def get_or_attach_existing_sync_service(client: Client) -> Optional[str]:
    matches = []
    for svc in client.sync.v1.services.stream():
        uname = (getattr(svc, "unique_name", None) or "").strip()
        fname = (getattr(svc, "friendly_name", None) or "").strip()
        if uname == SYNC_SERVICE_NAME or fname == SYNC_SERVICE_NAME:
            matches.append(svc)
    return _choose_consistent_sync_service_sid(matches)

def get_or_create_sync_service(client: Client) -> str:
    sid = get_or_attach_existing_sync_service(client)
    if sid:
        return sid
    svc = client.sync.v1.services.create(unique_name=SYNC_SERVICE_NAME, friendly_name=SYNC_SERVICE_NAME)
    return svc.sid

def ensure_sync_map(client: Client, service_sid: str) -> None:
    for m in client.sync.v1.services(service_sid).sync_maps.stream():
        if getattr(m, "unique_name", None) == SYNC_MAP_UNIQUE_NAME:
            return
    client.sync.v1.services(service_sid).sync_maps.create(unique_name=SYNC_MAP_UNIQUE_NAME, ttl=0)

def read_admin_user(client: Client, service_sid: str, username: str) -> Optional[Dict[str, Any]]:
    try:
        mitem = client.sync.v1.services(service_sid).sync_maps(SYNC_MAP_UNIQUE_NAME).sync_map_items(username).fetch()
        if mitem and mitem.data:
            return mitem.data
    except Exception:
        pass
    # Fallback scan (in case of legacy stray services); normalized selection still applies.
    try:
        matches = []
        for svc in client.sync.v1.services.stream():
            uname = (getattr(svc, "unique_name", "") or "").strip()
            fname = (getattr(svc, "friendly_name", "") or "").strip()
            if uname == SYNC_SERVICE_NAME or fname == SYNC_SERVICE_NAME:
                matches.append(svc)
        chosen_sid = _choose_consistent_sync_service_sid(matches)
        if chosen_sid:
            try:
                item = client.sync.v1.services(chosen_sid).sync_maps(SYNC_MAP_UNIQUE_NAME).sync_map_items(username).fetch()
                if item and item.data:
                    return item.data
            except Exception:
                pass
    except Exception:
        pass
    return None

def write_admin_user(client: Client, service_sid: str, username: str, payload: Dict[str, Any]) -> None:
    try:
        client.sync.v1.services(service_sid).sync_maps(SYNC_MAP_UNIQUE_NAME).sync_map_items(username).update(data=payload)
    except Exception:
        client.sync.v1.services(service_sid).sync_maps(SYNC_MAP_UNIQUE_NAME).sync_map_items.create(key=username, data=payload)

# ==========================
# App structure:
# - app: main FastAPI serving SPA + mounting API under /api
# - api_app: all JSON endpoints
# ==========================
app = FastAPI(title="SIPCHA (SPA + API host)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Mount built SPA assets (/app/static from web-build) ----
STATIC_DIR = pathlib.Path("/app/static")
ASSETS_DIR = STATIC_DIR / "assets"
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR), check_dir=False), name="assets")

# ---- Sub-app for the JSON API under /api ----
api_app = FastAPI(title="SIPCHA API")

def get_current(identity: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = identity.credentials
    try:
        return decode_token(token)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

@api_app.get("/healthz")
def healthz():
    return {"ok": True}

@api_app.post("/auth/login", response_model=TokenOut)
def login(subaccount: str = Query(..., description="Subaccount FriendlyName or Account SID"), body: LoginIn = Body(...)):
    if not subaccount:
        raise HTTPException(400, "subaccount is required")

    root_client = twilio_client_for()

    # Resolve subaccount
    if AC_SID_RX.match(subaccount):
        sa = get_subaccount_by_sid(root_client, subaccount)
    else:
        sa = find_subaccount_by_name(root_client, subaccount)

    if not sa:
        raise HTTPException(404, f"Subaccount '{subaccount}' not found")

    sub_client = twilio_client_for(sa["sid"])

    # Deterministic service + map
    service_sid = get_or_create_sync_service(sub_client)
    ensure_sync_map(sub_client, service_sid)

    rec = read_admin_user(sub_client, service_sid, body.username)
    if not rec:
        raise HTTPException(401, "Invalid username or password")

    # Accept camelCase or snake_case
    pwd_hash = rec.get("password_hash") or rec.get("passwordHash")
    if not pwd_hash or not bcrypt.verify(body.password, pwd_hash):
        raise HTTPException(401, "Invalid username or password")

    roles = rec.get("roles") or []
    if not isinstance(roles, list):
        roles = ["admin"]

    token = create_access_token(
        {
            "subaccount_sid": sa["sid"],
            "subaccount_name": sa["friendly_name"],
            "username": body.username,
            "roles": roles or ["admin"],
        }
    )
    return TokenOut(access_token=token)

@api_app.get("/me", response_model=MeOut)
def me(ctx: dict = Depends(get_current)):
    return MeOut(
        subaccount_sid=ctx["subaccount_sid"],
        subaccount_name=ctx["subaccount_name"],
        username=ctx["username"],
    )

@api_app.get("/admin/users", response_model=List[AdminUserOut])
def list_admin_users(ctx: dict = Depends(get_current)):
    client = twilio_client_for(ctx["subaccount_sid"])
    service_sid = get_or_create_sync_service(client)
    ensure_sync_map(client, service_sid)
    out: List[AdminUserOut] = []
    try:
        for item in client.sync.v1.services(service_sid).sync_maps(SYNC_MAP_UNIQUE_NAME).sync_map_items.stream():
            data = item.data or {}
            out.append(
                AdminUserOut(
                    username=item.key,
                    roles=data.get("roles", ["admin"]),
                    updated_at=str(getattr(item, "date_updated", "") or ""),
                )
            )
        if out:
            return out
    except Exception:
        pass
    return out

@api_app.post("/admin/users", response_model=AdminUserOut)
def create_admin_user(item: AdminUserIn, ctx: dict = Depends(get_current)):
    client = twilio_client_for(ctx["subaccount_sid"])
    service_sid = get_or_create_sync_service(client)
    ensure_sync_map(client, service_sid)
    payload = {
        "password_hash": bcrypt.hash(item.password),
        "roles": item.roles,
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }
    write_admin_user(client, service_sid, item.username, payload)
    return AdminUserOut(username=item.username, roles=item.roles, updated_at=payload["updated_at"])

@api_app.get("/twilio/numbers")
def list_numbers(ctx: dict = Depends(get_current)):
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

@api_app.get("/twilio/sip/domains")
def list_sip_domains(ctx: dict = Depends(get_current)):
    client = twilio_client_for(ctx["subaccount_sid"])
    items = []
    for d in client.sip.domains.stream():
        items.append({"sid": d.sid, "domain_name": d.domain_name, "friendly_name": d.friendly_name})
    return {"items": items}

# Mount the API under /api
app.mount("/api", api_app)

# ==========================
# SPA routes
# ==========================
STATIC_DIR = pathlib.Path("/app/static")
INDEX_FILE = STATIC_DIR / "index.html"

def serve_index() -> Response:
    if INDEX_FILE.exists():
        return FileResponse(str(INDEX_FILE))
    return PlainTextResponse("SPA not built yet. Run the web-build service.", status_code=503)

@app.get("/", include_in_schema=False)
def spa_root():
    return serve_index()

@app.get("/{full_path:path}", include_in_schema=False)
def spa_catch_all(full_path: str):
    return serve_index()
