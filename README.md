# OPS::CONSOLE — AR/VR Operations Console

WebXR operations console for multi-mission robotic orchestration.
Three.js + FastAPI + WebSocket.

## Directory Tree

```
ops-console/
├── index.html                  ← HTML (login + dashboard + chat + 3D/VR)
├── server.py                   ← Python backend (FastAPI + WebSocket)
├── requirements.txt            ← Python: fastapi, uvicorn, websockets
├── package.json                ← Node: Vite dev server
├── vite.config.js              ← Vite: proxy, HTTPS, GitHub Pages build
├── generate_certs.py           ← SSL certs for Meta Quest (Python puro)
├── tests.py                    ← 114 tests automaticos
├── .gitignore
│
├── assets/
│   ├── css/
│   │   ├── base.css            ← Variables, reset, animaciones
│   │   ├── login.css           ← Pantalla de login
│   │   └── dashboard.css       ← Dashboard, sidebar colapsable, modal
│   ├── data/
│   │   └── missions.json       ← 5 misiones (datos seed)
│   └── js/
│       ├── ws-client.js        ← WebSocket dual: backend o modo estatico
│       ├── auth.js             ← Login/logout/RBAC/sesion
│       ├── dashboard.js        ← Paneles, acciones, eventos, chat, toast
│       ├── map.js              ← Mapa 2D radar canvas
│       └── xr-engine.js        ← Three.js 3D + WebXR VR + mandos
│
├── certs/                      ← (generado) Certificados SSL
│   ├── server.key
│   └── server.crt
│
├── node_modules/               ← (generado) npm install
└── docs/                       ← (generado) npm run build → GitHub Pages
```

## Prerequisites

- Python 3.10+ → https://www.python.org/downloads/
- Node.js 18+ → https://nodejs.org/
- Git → https://git-scm.com/

## Setup (once)

Open PowerShell in the project folder:

```powershell
# 1. Python dependencies
pip install -r requirements.txt
pip install cryptography

# 2. Node dependencies (Vite)
npm install

# 3. SSL certificates (for Meta Quest VR)
python generate_certs.py
```

## Daily Development

You need TWO terminals:

### Terminal 1 — Backend (Python)

```powershell
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

### Terminal 2 — Frontend (Vite)

```powershell
npm run dev
```

Open **http://localhost:5173** in browser.
Vite auto-proxies /ws and /api to the Python backend.
Any code change refreshes instantly.

### Demo Users

| User                | Password  | Role       |
|---------------------|-----------|------------|
| supervisor@ops.net  | super123  | SUPERVISOR |
| operator@ops.net    | oper123   | OPERATOR   |
| viewer@ops.net      | view123   | VIEWER     |

## Meta Quest 3 — Step by Step

### 1. Your PC and the Quest must be on the same WiFi

### 2. Generate HTTPS certificates (once)

```powershell
python generate_certs.py
```

The script prints your local IP (e.g. `192.168.1.50`).

### 3. Start with HTTPS (two terminals)

```powershell
# Terminal 1: Backend with SSL
uvicorn server:app --host 0.0.0.0 --port 8443 --ssl-keyfile certs/server.key --ssl-certfile certs/server.crt

# Terminal 2: Vite with SSL
npm run dev:ssl
```

### 4. On your PC browser

Go to **https://localhost:5173**
Accept the certificate warning (Advanced → Proceed).
Login and verify the dashboard works.

### 5. On the Meta Quest 3 browser

Open the Quest browser and type:

```
https://YOUR_IP:5173
```

(Replace YOUR_IP with the IP from step 2, e.g. `https://192.168.1.50:5173`)

Accept the certificate warning:
- Tap "Advanced" or "Details"
- Tap "Proceed to site" or "Accept risk"

### 6. Enter VR

1. Login with any demo user
2. Tap **3D/AR** button (top right of map)
3. The **ENTER VR** button turns green if the headset is detected
4. Tap **ENTER VR**
5. Put on the headset — you are inside the 3D scene

### 7. Using the Quest controllers

- **Trigger (index finger)** → Laser selects an agent (robot/drone)
- **Squeeze (side grip)** → Deselects current agent
- If the selected agent has a pending Override, the modal opens automatically (Supervisor role)
- The laser turns brighter when pointing at an agent

### Troubleshooting Meta Quest

| Problem | Solution |
|---------|----------|
| ENTER VR button says "NEEDS HTTPS" | You opened with http:// instead of https:// |
| ENTER VR button says "NO HEADSET" | Open the URL in the Quest browser, not PC |
| ENTER VR button says "NO WEBXR" | Use Meta Quest Browser (not Firefox Reality) |
| Certificate error loops | Clear Quest browser cache, re-accept cert |
| Black screen after Enter VR | Check the Python backend is running |
| Controllers not visible | Press trigger once to wake them up |

## GitHub Pages (Static Demo)

```powershell
npm run build
git add docs/
git commit -m "Build for GitHub Pages"
git push
```

In GitHub repo Settings → Pages → Source: Deploy from branch → `/docs` folder.

The static version works without the Python backend.
It loads missions.json directly and runs a local simulation.
VR still works if accessed via HTTPS (GitHub Pages provides this).

## Running Tests

```powershell
pip install httpx websockets
python tests.py
```

## Architecture

```
┌──────────────┐     WebSocket      ┌─────────────────┐
│  Browser UI  │ ◄────────────────► │  Python Backend  │
│  (Three.js   │   JSON state       │  (FastAPI)       │
│   + WebXR)   │   every 300ms      │                  │
└──────────────┘                    └─────────────────┘
       │                                    │
       │  If no backend (GitHub Pages):     │
       │  loads missions.json               ▼
       │  runs local simulation      missions.json
       ▼                             (seed data)
  Meta Quest 3
  (immersive-vr via WebXR)
```
