# OPS::CONSOLE — Vendor-Neutral AR/VR Operations Console

Prototype v0.1.0

## Structure

```
ops-console/
├── index.html          ← Main entry point (HTML structure only)
├── README.md           ← This file
└── assets/
    ├── css/
    │   ├── base.css        ← Variables, reset, shared utilities
    │   ├── login.css       ← Login screen styles
    │   └── dashboard.css   ← Dashboard, map, panels, modal styles
    ├── js/
    │   ├── data.js         ← Mission data (5 missions from spec)
    │   ├── auth.js         ← Login, logout, RBAC logic
    │   ├── dashboard.js    ← Dashboard rendering, actions, events
    │   └── map.js          ← Map canvas, agents, tooltips
    └── data/               ← Reserved for future JSON mission files
```

## Demo Users

| User | Password | Role |
|------|----------|------|
| supervisor@ops.net | super123 | SUPERVISOR |
| operator@ops.net   | oper123  | OPERATOR   |
| viewer@ops.net     | view123  | VIEWER     |

## Deployment

Push to GitHub Pages (HTTPS required for WebXR):
```bash
git add .
git commit -m "Refactor: split into css/ and js/ modules"
git push origin main
```
