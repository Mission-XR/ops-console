# XR-Ops Console

**Vendor-Neutral AR/VR Operations Console for Collaborative Robotic Mission Orchestration**

*Cyber Physical Systems — Montanuniversität Leoben — SS 2026*

---

## Overview

**XR-Ops Console** is a vendor-neutral, web-based Extended Reality (XR) platform designed for the collaborative, real-time supervision of heterogeneous robotic fleets (UAS, UGV, optical sensors and human agents). The system centralises the telemetry of five concurrent mission scenarios over a single authoritative Python backend, synchronising the 2D tactical radar and the 3D/VR immersive scene through a bidirectional WebSocket channel with a deterministic 300 ms tick.

The prototype has been developed as a Bachelor's Thesis project under the supervision of **Prof. Günther Hutter** at the Chair of Cyber Physical Systems, Montanuniversität Leoben.

---

## Key Features

- **Single authoritative backend.** All simulation logic (Bézier trajectories, stochastic telemetry noise, override decisions) is executed inside `server.py`. The frontend operates as a pure renderer with zero computation in the browser.
- **Native WebXR** running on top of Three.js r128, providing direct support for the Meta Quest 3 without intermediate frameworks (A-Frame was evaluated and discarded).
- **Hierarchical RBAC** with three roles (Supervisor, Operator, Viewer). Permissions are enforced on every action, chat message and override approval.
- **Full 300 ms synchronisation.** The 2D radar, 3D scene, dashboard, chat and Audit Trail panel all consume the same source of truth over WebSocket.
- **Static fallback mode.** If `ws-client.js` does not detect the backend within 3 s, it loads `missions.json` locally. The frontend remains deployable on GitHub Pages.
- **Pure Python stack.** No Node.js, no Vite, no npm. A single command launches the whole system: `python start.py`.
- **Auto-generated HTTPS.** `start.py` issues local certificates through the `cryptography` library with SANs for `localhost` and the LAN IP, which is a hard requirement for WebXR activation.
- **Hybrid mesh optimisation.** `THREE.InstancedMesh` is used for identical agent swarms and `THREE.LOD` together with Draco compression for detailed GLB assets.

---

## Architecture

```
+----------------------------------------------------------------------+
|                     CLIENTS (Browser / Meta Quest 3)                 |
|  +----------+  +----------+  +------------+  +----------+            |
|  |  map.js  |  | xr-engine|  |dashboard.js|  | auth.js  |            |
|  | 2D radar |  |  WebXR   |  |  Override  |  |   RBAC   |            |
|  +----+-----+  +----+-----+  +-----+------+  +----+-----+            |
|       +------------+----------------+--------------+                 |
|                            |                                         |
|                     +------+------+                                  |
|                     | ws-client.js|  <-- fallback --> missions.json  |
|                     +------+------+                                  |
+----------------------------+-----------------------------------------+
                             | WSS  (300 ms tick)
+----------------------------+-----------------------------------------+
|                     +------+------+                                  |
|                     |  server.py  |   FastAPI + Uvicorn + Pydantic   |
|                     |  sim_loop() |                                  |
|                     +------+------+                                  |
|                            |                                         |
|  +-----------------+-------+--------+--------------------+           |
|  |  missions.json  | Bezier engine  |  Chat / Audit Log  |           |
|  |   (seed data)   | Telemetry tick |  RBAC validation   |           |
|  +-----------------+----------------+--------------------+           |
|                          BACKEND (Python 3.10+)                      |
+----------------------------------------------------------------------+
```

### Core Modules

| Layer | File | Responsibility |
|-------|------|----------------|
| Infrastructure | `start.py` | Single bootstrap: SSL generation, Uvicorn launch, static serving |
| Backend | `server.py` | Event-driven simulation engine, deterministic 300 ms broadcast |
| Backend | `missions.json` | Seed-data contract: five missions, waypoints and agents |
| Frontend | `index.html` | Web orchestrator, login flow and Audit Trail panel |
| Frontend | `auth.js` | RBAC (Supervisor / Operator / Viewer) and Emergency Stop |
| Frontend | `xr-engine.js` | Immersive 3D core (Three.js r128 + WebXR Device API) |
| Frontend | `map.js` | Tactical 2D radar over HTML5 Canvas |
| Frontend | `ws-client.js` | WebSocket bridge with automatic static fallback |
| Frontend | `audio-manager.js` | Centralised audio alerts for critical events |

---

## Installation and Launch

### Prerequisites

- Python 3.10 or higher
- A browser with WebGL2 support (Chrome, Edge or Firefox)
- *(Optional)* Meta Quest 3 connected to the same local network for VR mode

### Procedure

```bash
# 1. Clone the repository
git clone https://github.com/paolagarrido/webxr-ops-console.git
cd webxr-ops-console

# 2. Install dependencies
pip install fastapi uvicorn websockets pydantic cryptography

# 3. Launch the full system (single command)
python start.py
```

The `start.py` script performs the following operations automatically:

1. Generation of local SSL certificates with SANs (`localhost` and the LAN IP).
2. Uvicorn launch on port **8443** with HTTPS enabled.
3. Static serving of the frontend from the project root.
4. WebSocket activation on the `/ws` endpoint.

### Access

| Environment | URL |
|-------------|-----|
| Local desktop | `https://localhost:8443` |
| Meta Quest 3 | `https://<LAN-IP>:8443` |
| Static demo (no backend) | `https://mission-xr.github.io/ops-console/` |

> On the first access, the browser will warn about the self-signed certificate. The exception must be accepted in order to enable WebXR.

---

## Demo Users

| User | Password | Role | Permissions |
|------|----------|------|-------------|
| `supervisor@ops.net` | `super123` | **SUPERVISOR** | Global override, Emergency Stop, broadcast chat |
| `operator@ops.net` | `oper123` | **OPERATOR** | Action ACK, tactical chat, telemetry |
| `viewer@ops.net` | `view123` | **VIEWER** | Read-only (chat read-only, no override) |

---

## Mission Scenarios

The backend runs the five scenarios in parallel. The operator selects one of them from the top bar of the interface.

| Identifier | Scenario | Agents |
|------------|----------|--------|
| `INFRA-INSPECT-01` | Infrastructure inspection | UAS-01, UGV-02, VISION-02 |
| `HOSPITAL-TRANSPORT-02` | Hospital logistics | UGV-02, HUM-03, OPS-HUMAN |
| `WILDFIRE-MAP-03` | Wildfire mapping | UAS-01, UGV-02, LLM-01, VISION-02 |
| `WAREHOUSE-LOG-04` | Warehouse logistics | UGV-02 (fleet), OPS-HUMAN |
| `OFFSHORE-WIND-05` | Offshore wind farm inspection | UAS-01, VISION-02 |

---

## Code Updates

### Backend

- **`server.py`** replaces the former client-side `simulation.js`. The entire physics, telemetry and Bézier trajectory pipeline now resides in Python, using `asyncio.sleep(0.3)` to guarantee the deterministic broadcast tick.
- **`missions.json`** is established as a seed-data contract fully decoupled from the frontend, replacing `data.js`. It is loaded only once during server startup.
- **Pydantic** strictly validates every telemetry payload, ensuring that no malformed state ever reaches the client.
- **Deterministic LLM-01.** The cognitive agent operates exclusively on local seed-data. No runtime calls are issued to cloud APIs, a deliberate decision adopted to guarantee the academic reproducibility of the prototype.

### Frontend

- **`ws-client.js`** (newly introduced module) implements the WebSocket bridge with backend auto-detection. If no response is received within 3 s, it falls back automatically to `missions.json`, enabling static-mode operation (compatible with GitHub Pages).
- **`xr-engine.js`** has been migrated to **Three.js r128 with the native WebXR Device API**. A-Frame was evaluated during the early stage and discarded due to unnecessary overhead.
- **Hybrid mesh optimisation.** `THREE.InstancedMesh` is combined with `THREE.LOD` and `DRACOLoader` for identical agent swarms and high-detail GLB assets respectively. Procedural geometry is retained as a fallback when GLB assets are not available.
- **`dashboard.js`** has been refactored as a pure renderer. All simulation logic is delegated to the backend.
- **`audio-manager.js`** centralises the emission of audio alerts (pending override, Emergency Stop, action ACK).

### Infrastructure

- **`start.py`** is consolidated as the single entry point of the system, removing all dependencies on Node.js, Vite and npm.
- **Automatic HTTPS.** Local certificate issuance is handled through the `cryptography` library, generating SANs for `localhost` and the LAN IP, which is a strict requirement of the WebXR Device API.

### Post-Defence Fixes

- Restoration of the chat widget across logout / re-login sequences, addressed by invoking `_resetChatWidget()` at every login.
- Restoration of the emergency button, addressed by adding `_styleEmergencyBtn()` to the WebSocket `state` handler.
- Explicit reset of the reconnection counter `WS._attempt` inside `doLogout()`, avoiding cumulative counters across sessions.

---

## RBAC Permission Matrix

| Action | Viewer | Operator | Supervisor |
|--------|:------:|:--------:|:----------:|
| Telemetry observation | Yes | Yes | Yes |
| Chat message transmission | No | Yes | Yes |
| Waypoint and action ACK | No | Yes | Yes |
| Override approval (two-step + auditable comment) | No | No | Yes |
| Global Emergency Stop | No | No | Yes |

Trajectory override requires two confirmation steps and a mandatory comment, which is recorded in the Audit Trail.

---

## Performance Metrics

| Metric | Target | Measured |
|--------|--------|----------|
| Server broadcast tick | 300 ms | 300 ms ± 5 ms |
| Mean round-trip latency (τ_RTL) | < 100 ms | < 60 ms |
| Emergency Stop response time | < 100 ms | sub-100 ms |
| VR frame rate (Meta Quest 3) | 72 fps | 72 fps stable |

---

## Repository Structure

```
webxr-ops-console/
├── start.py                  ← Single bootstrap (SSL + Uvicorn + static)
├── server.py                 ← FastAPI backend + sim_loop()
├── missions.json             ← Seed-data for the five scenarios
├── requirements.txt
├── certs/                    ← Auto-generated SSL (gitignored)
├── index.html                ← Web orchestrator
├── assets/
│   ├── css/
│   │   ├── base.css
│   │   ├── login.css
│   │   └── dashboard.css
│   ├── js/
│   │   ├── auth.js           ← RBAC and Emergency Stop
│   │   ├── dashboard.js      ← Override renderer and chat
│   │   ├── map.js            ← 2D HTML5 Canvas radar
│   │   ├── xr-engine.js      ← WebXR + Three.js r128
│   │   ├── ws-client.js      ← WebSocket bridge + fallback
│   │   └── audio-manager.js  ← Audio alerts
│   └── models/               ← Draco-compressed GLBs + procedural fallback
└── README.md
```

---

## Technology Stack

**Backend:** Python 3.10+, FastAPI, Uvicorn, Pydantic, WebSockets, cryptography.
**Frontend:** Vanilla JavaScript, Three.js r128, WebXR Device API, HTML5 Canvas, GLTFLoader, DRACOLoader.
**Target hardware:** Meta Quest 3 and desktop browsers with WebGL2 support.
**Build tooling:** none required — the system does not include a build step.

---

## Authorship

Bachelor's Thesis co-authored by:

- **Paola Garrido López**
- **María Segovia**

*Development of a Vendor-Neutral AR/VR Operations Console for Collaborative Robotic Mission Orchestration.* Montanuniversität Leoben, Chair of Cyber Physical Systems (Prof. Günther Hutter), SS 2026.

---

## License

Academic project developed within the framework of Montanuniversität Leoben. Use restricted to educational and research purposes.
