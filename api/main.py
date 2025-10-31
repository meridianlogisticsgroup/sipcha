from fastapi import FastAPI, Request, HTTPException, Depends
from pydantic import BaseModel
import os, time, jwt

app = FastAPI(title="Sipcha API", version="0.1.0")

JWT_SECRET = os.getenv("JWT_SECRET", "change-me")

@app.get("/healthz")
def healthz():
    return {"ok": True, "time": int(time.time())}

# ---------- Auth (mock for now; wire Twilio Verify later) ----------
class StartReq(BaseModel):
    to: str

class CheckReq(BaseModel):
    to: str
    code: str

@app.post("/api/auth/request")
def auth_request(_: StartReq):
    # TODO: twilio.verify.services(...).verifications.create(...)
    return {"ok": True}

@app.post("/api/auth/verify")
def auth_verify(req: CheckReq):
    # TODO: twilio.verify.services(...).verification_checks.create(...)
    if not req.code:
        raise HTTPException(401, "Invalid code")
    payload = {"tenant_id":"t_demo","subaccount_sid":"AC_SUB","role":"admin","iat":int(time.time())}
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    return {"token": token}

def require_auth(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Unauthorized")
    token = auth.removeprefix("Bearer ").strip()
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        raise HTTPException(401, "Unauthorized")

# ---------- Example resource (swap to Twilio Sync later) ----------
@app.get("/api/agents")
def list_agents(user=Depends(require_auth)):
    # TODO: fetch from Twilio Sync "agents" map
    return [{"id": "agent_1", "name": "Alice"}, {"id": "agent_2", "name": "Bob"}]
