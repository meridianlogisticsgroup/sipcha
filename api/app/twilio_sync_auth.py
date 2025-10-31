import os
from typing import Optional, Dict, Any, List
from twilio.rest import Client
from twilio.base.exceptions import TwilioException
import bcrypt

MAIN_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
MAIN_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")

SYNC_SERVICE_UNIQUE_NAME = "mlg-auth"
SYNC_MAP_UNIQUE_NAME = "admins"

def _main_client() -> Client:
    if not (MAIN_ACCOUNT_SID and MAIN_AUTH_TOKEN):
        raise RuntimeError("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN must be set")
    return Client(MAIN_ACCOUNT_SID, MAIN_AUTH_TOKEN)

def _sub_client(sub_sid: str) -> Client:
    # operate on subaccount with parent creds but target account_sid
    return Client(MAIN_ACCOUNT_SID, MAIN_AUTH_TOKEN, account_sid=sub_sid)

def resolve_subaccount_sid_by_friendly_name(friendly_name: str) -> Optional[str]:
    client = _main_client()
    try:
        for acc in client.api.accounts.stream():  # paginated
            if acc.sid == MAIN_ACCOUNT_SID:
                continue
            if (acc.friendly_name or "").strip() == friendly_name.strip():
                return acc.sid
    except TwilioException:
        return None
    return None

def _ensure_sync_service(sub_sid: str) -> str:
    client = _sub_client(sub_sid)
    for svc in client.sync.services.list(limit=50):
        if getattr(svc, "unique_name", None) == SYNC_SERVICE_UNIQUE_NAME:
            return svc.sid
    svc = client.sync.services.create(
        unique_name=SYNC_SERVICE_UNIQUE_NAME,
        friendly_name="MLG Auth Service",
    )
    return svc.sid

def _ensure_sync_map(sub_sid: str, service_sid: str) -> str:
    client = _sub_client(sub_sid)
    for m in client.sync.services(service_sid).sync_maps.list(limit=50):
        if getattr(m, "unique_name", None) == SYNC_MAP_UNIQUE_NAME:
            return m.sid
    m = client.sync.services(service_sid).sync_maps.create(
        unique_name=SYNC_MAP_UNIQUE_NAME,
        ttl=0,
    )
    return m.sid

def ensure_sync_primitives(sub_sid: str) -> str:
    service_sid = _ensure_sync_service(sub_sid)
    _ensure_sync_map(sub_sid, service_sid)
    return service_sid

def _map_item_client(sub_sid: str, service_sid: str):
    client = _sub_client(sub_sid)
    return client.sync.services(service_sid).sync_maps(SYNC_MAP_UNIQUE_NAME)

def get_user_record(sub_sid: str, service_sid: str, username: str) -> Optional[Dict[str, Any]]:
    items = _map_item_client(sub_sid, service_sid)
    try:
        item = items.sync_map_items(username).fetch()
        return item.data or {}
    except TwilioException:
        return None

def upsert_user_record(sub_sid: str, service_sid: str, username: str, password_plain: str, roles=None) -> None:
    roles = roles or ["admin"]
    password_hash = hash_password(password_plain)
    data = {"password_hash": password_hash, "roles": roles}
    items = _map_item_client(sub_sid, service_sid)
    try:
        items.sync_map_items(username).update(data=data)
    except TwilioException:
        items.sync_map_items.create(key=username, data=data)

def hash_password(password_plain: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password_plain.encode("utf-8"), salt).decode("utf-8")

def verify_password(password_plain: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password_plain.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False
