// ============================================================
//  WS-CLIENT — Dual mode: WebSocket (dev) / Static (GitHub Pages)
//
//  Mode 1 (Backend): Connects to ws://host/ws, receives state ticks
//  Mode 2 (Static):  Loads missions.json, runs local simulation
//
//  Auto-detects which mode to use by trying to connect.
// ============================================================
var WS = {
    socket: null,
    connected: false,
    reconnectDelay: 1000,
    _initialised: false,
    _mode: 'unknown', // 'backend' or 'static'
    _staticTimer: null,

    connect: function() {
        var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        var url = proto + '//' + location.host + '/ws';
        console.log('[WS] Trying backend at', url);

        this.socket = new WebSocket(url);

        // Give it 3 seconds to connect; if it fails, switch to static mode
        var timeout = setTimeout(function() {
            if (!WS.connected) {
                console.log('[WS] Backend not reachable — switching to static mode');
                WS.socket.close();
                WS._startStaticMode();
            }
        }, 3000);

        this.socket.onopen = function() {
            clearTimeout(timeout);
            WS.connected = true;
            WS._mode = 'backend';
            WS.reconnectDelay = 1000;
            console.log('[WS] Connected to backend');
            showToast('SERVER LINK ESTABLISHED');
            if (currentRole) WS.send({type:'login', user:currentUser||'anon', role:currentRole});
        };
        this.socket.onmessage = function(evt) {
            try { WS.handle(JSON.parse(evt.data)); }
            catch(e) { console.error('[WS] parse error', e); }
        };
        this.socket.onclose = function() {
            clearTimeout(timeout);
            if (WS._mode === 'backend' && WS.connected) {
                // Was connected, lost connection — try to reconnect
                WS.connected = false;
                setTimeout(function() {
                    WS.reconnectDelay = Math.min(WS.reconnectDelay * 2, 8000);
                    WS.connect();
                }, WS.reconnectDelay);
            } else if (WS._mode === 'unknown') {
                // Never connected — go static
                WS._startStaticMode();
            }
        };
        this.socket.onerror = function() {
            clearTimeout(timeout);
            if (WS._mode === 'unknown') {
                WS._startStaticMode();
            }
        };
    },

    send: function(obj) {
        if (this._mode === 'backend' && this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(obj));
        } else if (this._mode === 'static') {
            // Handle commands locally in static mode
            WS._handleStaticCommand(obj);
        }
    },

    handle: function(msg) {
        switch(msg.type) {
        case 'state':
            MISSIONS = msg.missions;
            emergencyStopped = msg.emergency;
            onlineUsers = msg.users || [];
            if (!WS._initialised) {
                WS._initialised = true;
                if (msg.chat_history && msg.chat_history.length) {
                    msg.chat_history.forEach(function(e) { appendChatEntry(e); });
                }
                renderPanels();
            }
            renderContext();
            renderEvents();
            renderPresence();
            break;
        case 'chat':
            if (msg.entry) appendChatEntry(msg.entry);
            break;
        case 'toast':
            showToast(msg.msg);
            renderPanels();
            break;
        case 'emergency':
            emergencyStopped = msg.stopped;
            updateEmergencyButton();
            renderPanels();
            break;
        case 'presence':
            onlineUsers = msg.users || [];
            renderPresence();
            break;
        }
    },

    // ── STATIC MODE (GitHub Pages — no backend) ────────────
    _startStaticMode: function() {
        if (WS._mode === 'static') return;
        WS._mode = 'static';
        console.log('[WS] Static mode — loading missions.json');
        showToast('OFFLINE MODE — local simulation');

        // Determine base path (handles GitHub Pages subdirectory)
        var base = document.querySelector('base') ? document.querySelector('base').href : '';
        var jsonUrl = base + 'assets/data/missions.json';

        fetch(jsonUrl).then(function(r) { return r.json(); }).then(function(data) {
            MISSIONS = data;
            // Initialize positions
            MISSIONS.forEach(function(m) {
                m.agents.forEach(function(ag) {
                    ag.posX = ag.x;
                    ag.posY = ag.y;
                    ag._t = Math.random();
                    ag._dir = 1;
                });
            });
            WS._initialised = true;
            renderPanels();
            showToast('Loaded ' + MISSIONS.length + ' missions (offline)');
            // Start local simulation tick
            WS._staticTimer = setInterval(WS._staticTick, 300);
        }).catch(function(e) {
            console.error('[WS] Failed to load missions.json:', e);
            showToast('ERROR: Could not load mission data');
        });
    },

    _staticTick: function() {
        if (emergencyStopped) return;
        MISSIONS.forEach(function(m) {
            if (m.status !== 'running') return;
            m.agents.forEach(function(ag) {
                if (ag.state !== 'running') return;
                ag._t += 0.004 * ag._dir;
                if (ag._t >= 1) { ag._t = 1; ag._dir = -1; }
                if (ag._t <= 0) { ag._t = 0; ag._dir = 1; }
                // Simple oscillation around start position
                ag.posX = ag.x + Math.sin(ag._t * Math.PI) * 8;
                ag.posY = ag.y + Math.cos(ag._t * Math.PI * 0.7) * 5;
                ag.posX = Math.max(2, Math.min(98, ag.posX));
                ag.posY = Math.max(2, Math.min(98, ag.posY));
            });
            // Telemetry fluctuation
            m.context.forEach(function(c) {
                if (c.key.toUpperCase().indexOf('BAT') >= 0) {
                    try {
                        var v = parseInt(c.val);
                        if (v > 1 && Math.random() > 0.92) c.val = (v-1)+'%';
                    } catch(e) {}
                }
            });
        });
        renderContext();
        renderEvents();
    },

    _handleStaticCommand: function(obj) {
        if (obj.type === 'chat') {
            appendChatEntry({user:obj.user, role:obj.role, text:obj.text,
                time: new Date().toTimeString().slice(0,8)});
        } else if (obj.type === 'start_action') {
            var m = MISSIONS[obj.missionIdx];
            if (!m) return;
            m.actions.forEach(function(a) {
                if (a.id === obj.actionId && a.state === 'planned') {
                    a.state = 'running';
                    m.agents.forEach(function(ag) { if (ag.id === a.agent) ag.state = 'running'; });
                    m.status = 'running';
                    showToast(a.agent + ' STARTED');
                }
            });
            renderPanels();
        } else if (obj.type === 'ack_event') {
            var evts = MISSIONS[obj.missionIdx].events;
            if (evts[obj.eventIdx]) evts[obj.eventIdx].acked = true;
            renderEvents();
        } else if (obj.type === 'override') {
            var m2 = MISSIONS[obj.missionIdx];
            if (m2.events[obj.eventIdx]) m2.events[obj.eventIdx].acked = true;
            if (obj.decision === 'APPROVED') {
                m2.agents.forEach(function(ag) { if (ag.state==='blocked') ag.state='running'; });
                m2.actions.forEach(function(a) { if (a.state==='blocked') a.state='running'; });
                m2.status = 'running';
            }
            showToast('Override ' + obj.decision);
            renderPanels();
        } else if (obj.type === 'emergency') {
            emergencyStopped = (obj.action === 'stop');
            updateEmergencyButton();
            renderPanels();
        }
    }
};
