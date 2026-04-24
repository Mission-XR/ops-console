// ============================================================
//  WS-CLIENT — WebSocket connection to the Python backend
//  This is "the cable": it receives state from the server
//  and forwards user actions back.
// ============================================================

var WS = {
  socket: null,
  connected: false,
  reconnectDelay: 1000,

  // ── Connect ──────────────────────────────────────────────
  connect: function () {
    var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var url = protocol + '//' + location.host + '/ws';
    console.log('[WS] Connecting to', url);

    this.socket = new WebSocket(url);

    this.socket.onopen = function () {
      WS.connected = true;
      WS.reconnectDelay = 1000;
      console.log('[WS] Connected');
      if (typeof showToast === 'function') showToast('SERVER LINK ESTABLISHED');

      // Tell the server who we are
      if (typeof currentRole !== 'undefined' && currentRole) {
        WS.send({
          type: 'login',
          user: currentUser || 'anon',
          role: currentRole,
        });
      }
    };

    this.socket.onmessage = function (evt) {
      try {
        var msg = JSON.parse(evt.data);
        WS.handleMessage(msg);
      } catch (e) {
        console.error('[WS] Bad message', e);
      }
    };

    this.socket.onclose = function () {
      WS.connected = false;
      console.log('[WS] Disconnected — retrying in', WS.reconnectDelay, 'ms');
      setTimeout(function () {
        WS.reconnectDelay = Math.min(WS.reconnectDelay * 2, 10000);
        WS.connect();
      }, WS.reconnectDelay);
    };

    this.socket.onerror = function (err) {
      console.error('[WS] Error', err);
    };
  },

  // ── Send a message to the backend ────────────────────────
  send: function (obj) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(obj));
    }
  },

  // ── Route incoming messages ──────────────────────────────
  handleMessage: function (msg) {
    switch (msg.type) {
      case 'state':
        // Full state tick — update everything
        MISSIONS = msg.missions;
        emergencyStopped = msg.emergency;
        onlineUsers = msg.users || [];
        if (typeof renderAll === 'function') renderAll();
        break;

      case 'chat':
        if (typeof appendChatFromServer === 'function') {
          appendChatFromServer(msg.entry);
        }
        break;

      case 'toast':
        if (typeof showToast === 'function') showToast(msg.msg);
        break;

      case 'emergency':
        emergencyStopped = msg.stopped;
        if (typeof updateEmergencyButton === 'function')
          updateEmergencyButton();
        break;

      case 'user_joined':
      case 'user_left':
        onlineUsers = msg.users || [];
        if (typeof renderPresence === 'function') renderPresence();
        break;

      default:
        console.log('[WS] Unknown message type:', msg.type);
    }
  },
};
