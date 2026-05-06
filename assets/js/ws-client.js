// ============================================================
//  WS-CLIENT — WebSocket connection to Python backend
// ============================================================
var WS = {
    socket: null,
    connected: false,
    reconnectDelay: 1000,
    _initialised: false,
    _lastMissionData: null,

    connect: function() {
        var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        var url = proto + '//' + location.host + '/ws';
        console.log('[WS] Connecting to', url);
        this.socket = new WebSocket(url);

        this.socket.onopen = function() {
            WS.connected = true; WS.reconnectDelay = 1000;
            console.log('[WS] Connected');
            showToast('SERVER LINK ESTABLISHED');
            if (currentRole) WS.send({type:'login', user:currentUser||'anon', role:currentRole});
        };
        this.socket.onmessage = function(evt) {
            try { WS.handle(JSON.parse(evt.data)); }
            catch(e) { console.error('[WS] parse error', e); }
        };
        this.socket.onclose = function() {
            WS.connected = false;
            setTimeout(function() {
                WS.reconnectDelay = Math.min(WS.reconnectDelay * 2, 8000);
                WS.connect();
            }, WS.reconnectDelay);
        };
        this.socket.onerror = function(e) { console.error('[WS]', e); };
    },

    send: function(obj) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN)
            this.socket.send(JSON.stringify(obj));
    },

    handle: function(msg) {
        switch(msg.type) {
        case 'state':
            // Always update global mission data (positions, context, etc.)
            MISSIONS = msg.missions;
            emergencyStopped = msg.emergency;
            onlineUsers = msg.users || [];

            // First time: load chat history + build all panels
            if (!WS._initialised) {
                WS._initialised = true;
                if (msg.chat_history && msg.chat_history.length) {
                    msg.chat_history.forEach(function(e) { appendChatEntry(e); });
                }
                renderPanels();
            }
            // Every tick: update context vars + events (they change with telemetry)
            renderContext();
            renderEvents();
            renderPresence();
            break;

        case 'chat':
            if (msg.entry) appendChatEntry(msg.entry);
            break;

        case 'toast':
            showToast(msg.msg);
            renderPanels(); // Something changed (action started, override, etc.)
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
    }
};
