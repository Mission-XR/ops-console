# Mission XR — AR/VR Operations Console

Vendor-neutral AR/VR operations console for multi-mission orchestration.

## Project Structure

```
mission-xr/
├── index.html          ← Login screen (entry point)
├── console.html        ← Operations dashboard
├── README.md           ← This file
├── assets/             ← 3D models (.glb), textures, icons
├── css/
│   └── ops-style.css   ← All visual styles
└── js/
    ├── data.js         ← Mission data (5 missions)
    ├── auth.js         ← Login & RBAC (Scenario 1)
    ├── dashboard.js    ← Panels, actions, events
    ├── map.js          ← Map canvas & agents
    ├── telemetry.js    ← Live telemetry simulation (Scenario 3)
    ├── xr-engine.js    ← WebXR / A-Frame engine (Scenario 2)
    └── main.js         ← App entry point, connects all modules
```

## Demo Users

| Email | Password | Role |
|-------|----------|------|
| supervisor@ops.net | super123 | SUPERVISOR |
| operator@ops.net   | oper123  | OPERATOR   |
| viewer@ops.net     | view123  | VIEWER     |

## Who edits what

| File | Responsible |
|------|-------------|
| js/data.js | Paola — mission data |
| js/map.js | Paola — map & agents |
| js/xr-engine.js | Paola — WebXR |
| js/auth.js | María — login & RBAC |
| js/dashboard.js | María — panels & events |
| js/telemetry.js | María — live data |
| js/main.js | Both |

## How to run

Open `index.html` in a browser — no server needed for 2D mode.
For WebXR: deploy to GitHub Pages (HTTPS required).

## GitHub Pages URL

```
https://mission-xr.github.io/ops-console/
```
