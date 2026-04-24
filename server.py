"""
OPS::CONSOLE — Backend Server (FastAPI + WebSockets)
====================================================
The "brain" of the system: holds all mission data, computes agent
trajectories in real-time, manages chat history, and pushes state
to every connected frontend via WebSocket.

Run:  uvicorn server:app --host 0.0.0.0 --port 8000 --reload
"""

import asyncio
import json
import math
import time
import random
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# ─── App ────────────────────────────────────────────────────
app = FastAPI(title="OPS::CONSOLE Backend", version="0.2.0")

# ─── Connection Manager ────────────────────────────────────
class ConnectionManager:
    """Tracks every connected WebSocket client."""
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: dict):
        payload = json.dumps(message)
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

manager = ConnectionManager()

# ─── In-Memory State ───────────────────────────────────────
# Load seed missions from the JSON fixture
MISSIONS_FILE = Path(__file__).parent / "assets" / "data" / "missions.json"

missions: List[dict] = []          # loaded at startup
chat_history: List[dict] = []      # {user, role, text, time}
emergency_stopped: bool = False
connected_users: Dict[str, dict] = {}  # ws_id -> {user, role}

# ─── Trajectory helpers ───────────────────────────────────
def _init_agent_paths(mission: dict, idx: int):
    """Assign a quadratic Bézier path to each agent based on mission type."""
    mid = mission["id"]
    for ag in mission["agents"]:
        sx, sy = ag["x"], ag["y"]  # percent coords 0-100
        ex, ey = sx, sy
        cx, cy = sx, sy
        straight = False

        if mid == "INFRA-INSPECT-01":
            if "UAS" in ag["id"]:
                ex = min(sx + 45, 95); straight = True
            else:
                ey = min(sy + 35, 95); straight = True
        elif mid == "HOSPITAL-TRANSPORT-02":
            ex = min(sx + 35, 95); ey = max(sy - 18, 5)
            cx = sx + 15; cy = max(sy - 35, 5)
        elif mid == "WILDFIRE-MAP-03":
            ex = min(sx + 45, 95); ey = min(sy + 8, 95)
            cx = sx + 22; cy = min(sy + 35, 95)
        elif mid == "WAREHOUSE-LOG-04":
            if "UGV" in ag["id"] or "HUM" in ag["id"]:
                ex = min(sx + 30, 95); straight = True
            else:
                ey = min(sy + 30, 95); straight = True
        elif mid == "OFFSHORE-WIND-05":
            ex = min(sx + 30, 95); ey = max(sy - 15, 5); straight = True

        if straight:
            cx = (sx + ex) / 2; cy = (sy + ey) / 2

        ag["_path"] = {"p0": [sx, sy], "p1": [cx, cy], "p2": [ex, ey],
                       "t": random.random(), "dir": 1}
        ag["posX"] = sx
        ag["posY"] = sy


def _tick_agents(mission: dict, dt: float):
    """Advance every running agent along its path by dt seconds."""
    if emergency_stopped:
        return
    if mission["status"] != "running":
        return
    speed = 0.02 * dt  # tuneable
    for ag in mission["agents"]:
        if ag["state"] != "running":
            continue
        p = ag.get("_path")
        if not p:
            continue
        p["t"] += speed * p["dir"]
        if p["t"] >= 1.0:
            p["t"] = 1.0; p["dir"] = -1
        elif p["t"] <= 0.0:
            p["t"] = 0.0; p["dir"] = 1
        t = p["t"]
        ag["posX"] = (1-t)**2 * p["p0"][0] + 2*(1-t)*t * p["p1"][0] + t**2 * p["p2"][0]
        ag["posY"] = (1-t)**2 * p["p0"][1] + 2*(1-t)*t * p["p1"][1] + t**2 * p["p2"][1]
        ag["x"] = ag["posX"]
        ag["y"] = ag["posY"]


def _tick_telemetry(mission: dict):
    """Randomly fluctuate context values to simulate live telemetry."""
    if emergency_stopped:
        return
    for c in mission.get("context", []):
        key = c["key"].upper()
        if "BAT" in key:
            try:
                val = int(c["val"].replace("%", ""))
                if val > 1 and random.random() > 0.85:
                    c["val"] = f"{val - 1}%"
            except ValueError:
                pass
        if any(k in key for k in ("SPEED", "WIND")):
            try:
                num = float(c["val"].split()[0])
                num += random.uniform(-0.3, 0.3)
                c["val"] = f"{num:.1f} km/h"
            except (ValueError, IndexError):
                pass


# ─── Build sanitised snapshot for the frontend ─────────────
def _public_agents(agents: list) -> list:
    """Strip internal path data before sending to clients."""
    out = []
    for ag in agents:
        a = {k: v for k, v in ag.items() if not k.startswith("_")}
        # round positions
        a["posX"] = round(ag.get("posX", ag["x"]), 2)
        a["posY"] = round(ag.get("posY", ag["y"]), 2)
        out.append(a)
    return out


def build_state_snapshot() -> dict:
    """Full state packet sent to every client on each tick."""
    sanitised = []
    for m in missions:
        mc = {k: v for k, v in m.items() if k != "agents"}
        mc["agents"] = _public_agents(m["agents"])
        sanitised.append(mc)
    return {
        "type": "state",
        "missions": sanitised,
        "chat": chat_history[-50:],  # last 50 messages
        "emergency": emergency_stopped,
        "users": list(connected_users.values()),
        "ts": time.time(),
    }


# ─── Background tick loop ──────────────────────────────────
TICK_RATE = 0.25  # seconds between ticks

async def simulation_loop():
    """Runs forever: advances simulation, broadcasts state."""
    while True:
        for m in missions:
            _tick_agents(m, TICK_RATE)
            _tick_telemetry(m)
        snapshot = build_state_snapshot()
        await manager.broadcast(snapshot)
        await asyncio.sleep(TICK_RATE)


@app.on_event("startup")
async def startup():
    global missions
    if MISSIONS_FILE.exists():
        missions = json.loads(MISSIONS_FILE.read_text(encoding="utf-8"))
    else:
        missions = []
    for i, m in enumerate(missions):
        _init_agent_paths(m, i)
    asyncio.create_task(simulation_loop())


# ─── WebSocket endpoint ────────────────────────────────────
@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    global emergency_stopped
    await manager.connect(ws)
    ws_id = str(id(ws))
    try:
        # send full state immediately on connect
        await ws.send_text(json.dumps(build_state_snapshot()))
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            kind = msg.get("type")

            if kind == "login":
                connected_users[ws_id] = {
                    "user": msg.get("user", "anon"),
                    "role": msg.get("role", "VIEWER"),
                }
                await manager.broadcast({
                    "type": "user_joined",
                    "users": list(connected_users.values()),
                })

            elif kind == "chat":
                entry = {
                    "user": msg.get("user", "anon"),
                    "role": msg.get("role", "OPERATOR"),
                    "text": msg.get("text", ""),
                    "time": time.strftime("%H:%M:%S"),
                }
                chat_history.append(entry)
                await manager.broadcast({"type": "chat", "entry": entry})

            elif kind == "start_action":
                mi = msg.get("missionIdx", 0)
                aid = msg.get("actionId")
                if 0 <= mi < len(missions):
                    m = missions[mi]
                    for a in m["actions"]:
                        if a["id"] == aid and a["state"] == "planned":
                            a["state"] = "running"
                            for ag in m["agents"]:
                                if ag["id"] == a["agent"]:
                                    ag["state"] = "running"
                            m["status"] = "running"
                            await manager.broadcast({
                                "type": "toast",
                                "msg": f'{a["agent"]} STARTED — {a["name"]}',
                            })
                            break

            elif kind == "ack_event":
                mi = msg.get("missionIdx", 0)
                ei = msg.get("eventIdx", 0)
                if 0 <= mi < len(missions):
                    evts = missions[mi].get("events", [])
                    if 0 <= ei < len(evts):
                        evts[ei]["acked"] = True

            elif kind == "override":
                mi = msg.get("missionIdx", 0)
                decision = msg.get("decision", "REJECTED")
                comment = msg.get("comment", "")
                ei = msg.get("eventIdx", 0)
                if 0 <= mi < len(missions):
                    m = missions[mi]
                    evts = m.get("events", [])
                    if 0 <= ei < len(evts):
                        evts[ei]["acked"] = True
                    if decision == "APPROVED":
                        for ag in m["agents"]:
                            if ag["state"] == "blocked":
                                ag["state"] = "running"
                        for act in m["actions"]:
                            if act["state"] == "blocked":
                                act["state"] = "running"
                        m["status"] = "running"
                    new_evt = {
                        "time": time.strftime("%H:%M:%S"),
                        "msg": f'Override {decision}. Note: "{comment}"',
                        "type": "ok" if decision == "APPROVED" else "danger",
                        "source": "SUPERVISOR",
                        "acked": False,
                    }
                    m["events"].insert(0, new_evt)
                    await manager.broadcast({
                        "type": "toast",
                        "msg": f"Override {decision}",
                    })

            elif kind == "emergency":
                action = msg.get("action", "stop")
                emergency_stopped = (action == "stop")
                label = "CRITICAL HALT initiated." if emergency_stopped else "Emergency lifted. Resuming operations."
                etype = "danger" if emergency_stopped else "ok"
                mi = msg.get("missionIdx", 0)
                if 0 <= mi < len(missions):
                    missions[mi]["events"].insert(0, {
                        "time": time.strftime("%H:%M:%S"),
                        "msg": label,
                        "type": etype,
                        "source": "SUPERVISOR",
                        "acked": False,
                    })
                await manager.broadcast({
                    "type": "emergency",
                    "stopped": emergency_stopped,
                })

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(ws)
        connected_users.pop(ws_id, None)
        await manager.broadcast({
            "type": "user_left",
            "users": list(connected_users.values()),
        })


# ─── REST endpoints (optional, for debugging) ──────────────
@app.get("/api/missions")
async def get_missions():
    return [
        {k: v for k, v in m.items() if not k.startswith("_") and k != "agents"}
        for m in missions
    ]

@app.get("/api/health")
async def health():
    return {"status": "ok", "clients": len(manager.active)}


# ─── Serve static frontend files ───────────────────────────
app.mount("/assets", StaticFiles(directory="assets"), name="assets")

@app.get("/")
async def root():
    return FileResponse("index.html")
