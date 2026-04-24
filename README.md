# OPS::CONSOLE — Vendor-Neutral AR/VR Operations Console

**v0.2.0 — Client-Server Architecture**

## Architecture

```
┌─────────────┐   WebSocket (ws://…/ws)   ┌──────────────────┐
│  Browser UI  │ ◄──────────────────────► │  Python Backend  │
│  (index.html │   JSON state packets      │  (server.py)     │
│   + JS)      │   every 250ms             │  FastAPI + WS    │
└─────────────┘                            └──────────────────┘
                                               │
                                               ▼
                                     assets/data/missions.json
                                     (seed data, loaded at startup)
```

The **backend** (Python/FastAPI) is the single source of truth:
- Loads mission data from `missions.json`
- Computes agent trajectories (Bézier paths) in real-time
- Simulates telemetry fluctuations (battery drain, wind changes)
- Manages chat history, override decisions, emergency stop state
- Broadcasts full state to all connected clients every 250ms

The **frontend** (vanilla JS) is a "dumb" renderer:
- Receives state via WebSocket → draws the UI
- Sends user actions (start, ack, override, chat) back to the server
- Zero simulation logic — all math lives in Python

## Project Structure

```
ops-console/
├── server.py               ← Python backend (FastAPI + WebSocket)
├── requirements.txt         ← Python dependencies
├── index.html               ← Main entry point
├── README.md
└── assets/
    ├── css/
    │   ├── base.css         ← Variables, reset, shared utilities
    │   ├── login.css        ← Login screen styles
    │   └── dashboard.css    ← Dashboard, panels, modal styles
    ├── js/
    │   ├── ws-client.js     ← WebSocket client ("the cable")
    │   ├── auth.js          ← Login/logout, RBAC, session
    │   ├── dashboard.js     ← Pure rendering (panels, events, actions)
    │   └── map.js           ← 2D tactical map canvas (renderer only)
    └── data/
        └── missions.json    ← Seed data (5 missions)
```

### Removed Files (vs. v0.1.0)

| Old file | Reason |
|---|---|
| `assets/js/data.js` | Replaced by `assets/data/missions.json` (loaded by server) |
| `assets/js/telemetry.js` | Telemetry simulation moved to `server.py` |
| `assets/js/xr-engine.js` | Three.js 3D view removed; simplified to 2D canvas |

## Quick Start

### 1. Install Python dependencies

```bash
cd ops-console
pip install -r requirements.txt
```

### 2. Run the server

```bash
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Open in browser

Navigate to **http://localhost:8000**

### 4. Login with demo credentials

| User | Password | Role |
|---|---|---|
| supervisor@ops.net | super123 | SUPERVISOR |
| operator@ops.net   | oper123  | OPERATOR   |
| viewer@ops.net     | view123  | VIEWER     |

## Multi-User Demo

Open **two browser tabs** (or two different browsers) at `http://localhost:8000`.
Log in as different users — you will see:
- Real-time presence indicators (avatars in the top bar)
- Chat messages broadcast to all connected clients
- Actions started by one user update on all screens instantly
- Override decisions by a Supervisor appear everywhere

## WebSocket Protocol

All messages are JSON. Direction: `C→S` = client to server, `S→C` = server to client.

### C→S Messages

| type | fields | description |
|---|---|---|
| `login` | user, role | Announce identity |
| `chat` | user, role, text | Send chat message |
| `start_action` | missionIdx, actionId | Start a planned action |
| `ack_event` | missionIdx, eventIdx | Acknowledge an event |
| `override` | missionIdx, eventIdx, decision, comment | Approve/reject override |
| `emergency` | action (`stop`/`resume`), missionIdx | Emergency halt |

### S→C Messages

| type | description |
|---|---|
| `state` | Full state snapshot (missions, chat, emergency, users) — sent every 250ms |
| `chat` | New chat entry (broadcast) |
| `toast` | Toast notification text |
| `emergency` | Emergency state change |
| `user_joined` / `user_left` | Presence update |

## Offline Demo

The entire system runs locally — no internet required after initial `pip install`.
The server serves the frontend files directly, so no separate web server is needed.
