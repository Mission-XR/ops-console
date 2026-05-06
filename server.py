"""
OPS::CONSOLE — Backend Server (FastAPI + WebSockets)
Run:  uvicorn server:app --host 0.0.0.0 --port 8000 --reload
"""
import asyncio, json, time, random
from pathlib import Path
from typing import Dict, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI(title="OPS::CONSOLE", version="0.2.0")

class ConnMgr:
    def __init__(self):
        self.active: List[WebSocket] = []
    async def connect(self, ws: WebSocket):
        await ws.accept(); self.active.append(ws)
    def disconnect(self, ws: WebSocket):
        if ws in self.active: self.active.remove(ws)
    async def broadcast(self, msg: dict):
        payload = json.dumps(msg); dead = []
        for ws in self.active:
            try: await ws.send_text(payload)
            except: dead.append(ws)
        for ws in dead: self.disconnect(ws)
    async def send_one(self, ws: WebSocket, msg: dict):
        try: await ws.send_text(json.dumps(msg))
        except: pass

mgr = ConnMgr()

MISSIONS_FILE = Path(__file__).parent / "assets" / "data" / "missions.json"
missions: List[dict] = []
chat_history: List[dict] = []
emergency_stopped: bool = False
connected_users: Dict[str, dict] = {}

# ─── Trajectories ────────────────────────────────────────────
def init_paths(m: dict):
    mid = m["id"]
    for ag in m["agents"]:
        sx, sy = float(ag["x"]), float(ag["y"])
        ex, ey, cx, cy = sx, sy, sx, sy
        straight = False
        if mid == "INFRA-INSPECT-01":
            if "UAS" in ag["id"]: ex = min(sx+45,95); straight=True
            else: ey = min(sy+35,95); straight=True
        elif mid == "HOSPITAL-TRANSPORT-02":
            ex=min(sx+35,95); ey=max(sy-18,5); cx=sx+15; cy=max(sy-35,5)
        elif mid == "WILDFIRE-MAP-03":
            ex=min(sx+45,95); ey=min(sy+8,95); cx=sx+22; cy=min(sy+35,95)
        elif mid == "WAREHOUSE-LOG-04":
            if "UGV" in ag["id"] or "HUM" in ag["id"]: ex=min(sx+30,95); straight=True
            else: ey=min(sy+30,95); straight=True
        elif mid == "OFFSHORE-WIND-05":
            ex=min(sx+30,95); ey=max(sy-15,5); straight=True
        if straight: cx=(sx+ex)/2; cy=(sy+ey)/2
        ag["_path"] = {"p0":[sx,sy],"p1":[cx,cy],"p2":[ex,ey],"t":random.random(),"dir":1}
        ag["posX"] = sx; ag["posY"] = sy

def tick_agents(m: dict, dt: float):
    if emergency_stopped or m["status"] != "running": return
    spd = 0.012 * dt
    for ag in m["agents"]:
        if ag["state"] != "running": continue
        p = ag.get("_path")
        if not p: continue
        p["t"] += spd * p["dir"]
        if p["t"] >= 1.0: p["t"]=1.0; p["dir"]=-1
        elif p["t"] <= 0.0: p["t"]=0.0; p["dir"]=1
        t = p["t"]
        ag["posX"] = (1-t)**2*p["p0"][0] + 2*(1-t)*t*p["p1"][0] + t**2*p["p2"][0]
        ag["posY"] = (1-t)**2*p["p0"][1] + 2*(1-t)*t*p["p1"][1] + t**2*p["p2"][1]
        ag["x"] = ag["posX"]; ag["y"] = ag["posY"]

def tick_telemetry(m: dict):
    if emergency_stopped: return
    for c in m.get("context", []):
        k = c["key"].upper()
        if "BAT" in k:
            try:
                v = int(c["val"].replace("%",""))
                if v > 1 and random.random() > 0.9: c["val"] = f"{v-1}%"
            except: pass
        if any(x in k for x in ("SPEED","WIND")):
            try:
                parts = c["val"].split(); n = float(parts[0]); u = parts[1] if len(parts)>1 else "km/h"
                n += random.uniform(-0.2,0.2); c["val"] = f"{n:.1f} {u}"
            except: pass

def snapshot() -> dict:
    out = []
    for m in missions:
        mc = {}
        for k,v in m.items():
            if k == "agents":
                mc["agents"] = [{kk:vv for kk,vv in a.items() if not kk.startswith("_")} for a in v]
            else:
                mc[k] = v
        out.append(mc)
    return {"type":"state","missions":out,"emergency":emergency_stopped,
            "users":list(connected_users.values()),"ts":time.time()}

TICK = 0.3
async def sim_loop():
    while True:
        for m in missions: tick_agents(m, TICK); tick_telemetry(m)
        if mgr.active: await mgr.broadcast(snapshot())
        await asyncio.sleep(TICK)

@app.on_event("startup")
async def startup():
    global missions
    if MISSIONS_FILE.exists():
        missions = json.loads(MISSIONS_FILE.read_text("utf-8"))
    for m in missions: init_paths(m)
    asyncio.create_task(sim_loop())

@app.websocket("/ws")
async def ws_ep(ws: WebSocket):
    global emergency_stopped
    await mgr.connect(ws); wid = str(id(ws))
    try:
        init = snapshot(); init["chat_history"] = chat_history[-200:]
        await mgr.send_one(ws, init)
        while True:
            raw = await ws.receive_text(); msg = json.loads(raw); kind = msg.get("type")
            if kind == "login":
                connected_users[wid] = {"user":msg.get("user","anon"),"role":msg.get("role","VIEWER")}
                await mgr.broadcast({"type":"presence","users":list(connected_users.values())})
            elif kind == "chat":
                entry = {"user":msg.get("user","anon"),"role":msg.get("role","OPERATOR"),
                         "text":msg.get("text",""),"time":time.strftime("%H:%M:%S")}
                chat_history.append(entry)
                await mgr.broadcast({"type":"chat","entry":entry})
            elif kind == "start_action":
                mi=msg.get("missionIdx",0); aid=msg.get("actionId")
                if 0<=mi<len(missions):
                    m=missions[mi]
                    for a in m["actions"]:
                        if a["id"]==aid and a["state"]=="planned":
                            a["state"]="running"
                            for ag in m["agents"]:
                                if ag["id"]==a["agent"]: ag["state"]="running"
                            m["status"]="running"
                            await mgr.broadcast({"type":"toast","msg":f'{a["agent"]} STARTED — {a["name"]}'})
                            break
            elif kind == "ack_event":
                mi=msg.get("missionIdx",0); ei=msg.get("eventIdx",0)
                if 0<=mi<len(missions):
                    evts=missions[mi].get("events",[])
                    if 0<=ei<len(evts): evts[ei]["acked"]=True
            elif kind == "override":
                mi=msg.get("missionIdx",0); dec=msg.get("decision","REJECTED")
                cmt=msg.get("comment",""); ei=msg.get("eventIdx",0)
                if 0<=mi<len(missions):
                    m=missions[mi]; evts=m.get("events",[])
                    if 0<=ei<len(evts): evts[ei]["acked"]=True
                    if dec=="APPROVED":
                        for ag in m["agents"]:
                            if ag["state"]=="blocked": ag["state"]="running"
                        for act in m["actions"]:
                            if act["state"]=="blocked": act["state"]="running"
                        m["status"]="running"
                    m["events"].insert(0,{"time":time.strftime("%H:%M:%S"),
                        "msg":f'Override {dec}. Note: "{cmt}"',"type":"ok" if dec=="APPROVED" else "danger",
                        "source":"SUPERVISOR","acked":False})
                    await mgr.broadcast({"type":"toast","msg":f"Override {dec}"})
            elif kind == "emergency":
                act=msg.get("action","stop"); emergency_stopped=(act=="stop")
                lbl="CRITICAL HALT initiated." if emergency_stopped else "Emergency lifted."
                mi=msg.get("missionIdx",0)
                if 0<=mi<len(missions):
                    missions[mi]["events"].insert(0,{"time":time.strftime("%H:%M:%S"),
                        "msg":lbl,"type":"danger" if emergency_stopped else "ok","source":"SUPERVISOR","acked":False})
                await mgr.broadcast({"type":"emergency","stopped":emergency_stopped})
    except WebSocketDisconnect: pass
    finally:
        mgr.disconnect(ws); connected_users.pop(wid,None)
        await mgr.broadcast({"type":"presence","users":list(connected_users.values())})

@app.get("/api/health")
async def health(): return {"status":"ok","clients":len(mgr.active)}

app.mount("/assets", StaticFiles(directory="assets"), name="assets")

@app.get("/")
async def root(): return FileResponse("index.html")
