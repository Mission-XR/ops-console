// ============================================================
//  DASHBOARD — Rendering, actions, events, override, chat
//  Data comes from server via WS into global MISSIONS array
// ============================================================
var MISSIONS             = [];
var onlineUsers          = [];
var currentMission       = 0;
var currentOverrideEvent = null;
var currentOverrideIdx   = -1;

function initDashboard() {
    updateClock();
    setInterval(updateClock, 1000);
    if (typeof initCanvas === 'function') initCanvas();
    updateChatUI();
}

function updateClock() {
    var el = document.getElementById('clock');
    if (el) el.textContent = new Date().toTimeString().slice(0,8);
}

// ── renderPanels: full rebuild of left + right panels ──────
function renderPanels() {
    if (!MISSIONS.length) return;
    buildMissionTabs();
    renderMissionList();
    renderActionLane();
    renderGates();
    renderContext();
    renderEvents();
    updateMapLabel();
}

// ── Mission tabs ───────────────────────────────────────────
function buildMissionTabs() {
    var c = document.getElementById('mission-tabs'); if (!c) return;
    c.innerHTML = '';
    MISSIONS.forEach(function(m, i) {
        var b = document.createElement('button');
        b.className = 'mission-tab' + (i === currentMission ? ' active' : '');
        b.textContent = m.id.split('-').slice(0,2).join('-');
        b.onclick = (function(idx){ return function(){ selectMission(idx); }; })(i);
        c.appendChild(b);
    });
}

function renderMissionList() {
    var list = document.getElementById('mission-list'); if (!list) return;
    list.innerHTML = '';
    MISSIONS.forEach(function(m, i) {
        var el = document.createElement('div');
        el.className = 'mission-item' + (i === currentMission ? ' active' : '');
        el.onclick = (function(idx){ return function(){ selectMission(idx); }; })(i);
        var scls = {running:'status-running',planned:'status-planned',blocked:'status-blocked',done:'status-done'}[m.status]||'status-planned';
        el.innerHTML = '<div class="mission-name">'+m.label+'</div>'
            +'<div class="mission-meta"><div class="status-dot '+scls+'"></div><span class="mission-status">'+m.status.toUpperCase()+'</span></div>'
            +'<div class="mission-agents">'+m.agents.map(function(a){return a.id;}).join(' · ')+'</div>';
        list.appendChild(el);
    });
}

function selectMission(idx) {
    currentMission = idx;
    renderPanels();
    if (typeof xrActive !== 'undefined' && xrActive && typeof refreshXRScene === 'function') refreshXRScene();
}

function updateMapLabel() {
    var m = MISSIONS[currentMission]; if (!m) return;
    var el = document.getElementById('map-mission-label');
    if (el) el.innerHTML = 'SYSTEM_ID: ' + m.id;
    var latEl = document.getElementById('map-coords');
    var lonEl = document.getElementById('map-coords2');
    if (latEl) latEl.textContent = 'LAT ' + m.coords.lat + '° N';
    if (lonEl) lonEl.textContent = 'LON ' + m.coords.lon + '° E';
}

// ── Action lane ────────────────────────────────────────────
function renderActionLane() {
    var lane = document.getElementById('action-lane');
    if (!lane || !MISSIONS[currentMission]) return;
    lane.innerHTML = '';
    MISSIONS[currentMission].actions.forEach(function(a) {
        var el = document.createElement('div'); el.className = 'action-item';
        var canStart = a.state === 'planned' && currentRole && currentRole !== 'VIEWER';
        el.innerHTML = '<div class="action-item-top">'
            +'<div class="action-name">'+a.name+'</div>'
            +'<span class="action-state state-'+a.state+'">'+a.state.toUpperCase()+'</span></div>'
            +'<div class="action-item-bot"><span class="action-agent">'+a.agent+'</span>'
            +(canStart ? '<button class="map-btn" style="padding:2px 8px;font-size:10px;margin-left:auto;height:auto;border-color:var(--accent);color:var(--accent);" onclick="doStartAction(\''+a.id+'\')">START</button>' : '')
            +'</div>';
        lane.appendChild(el);
    });
}

function doStartAction(actionId) {
    if (!confirm('START action '+actionId+'?\nConfirm deployment?')) return;
    WS.send({type:'start_action', missionIdx:currentMission, actionId:actionId});
}

// ── Gates ──────────────────────────────────────────────────
function renderGates() {
    var lane = document.getElementById('gates-lane');
    if (!lane || !MISSIONS[currentMission]) return;
    lane.innerHTML = '';
    MISSIONS[currentMission].gates.forEach(function(g) {
        var el = document.createElement('div'); el.className = 'action-item';
        var stCls = (g.status==='open'||g.status==='OPEN') ? 'ok' : 'warn';
        el.innerHTML = '<div class="action-item-top"><div class="action-name" style="font-size:10px;">'+g.text+'</div>'
            +'<span class="action-state '+stCls+'">'+g.status.toUpperCase()+'</span></div>';
        lane.appendChild(el);
    });
}

// ── Context variables (updated every server tick) ──────────
function renderContext() {
    var c = document.getElementById('context-vars');
    if (!c || !MISSIONS[currentMission]) return;
    c.innerHTML = '';
    MISSIONS[currentMission].context.forEach(function(cv) {
        var row = document.createElement('div'); row.className = 'ctx-row';
        row.style = 'display:flex;justify-content:space-between;width:100%;font-size:11px;margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.05);';
        row.innerHTML = '<span style="color:var(--dim);">'+cv.key+'</span><span class="'+(cv.cls||'')+'">'+cv.val+'</span>';
        c.appendChild(row);
    });
}

// ── Events (updated every server tick) ─────────────────────
function renderEvents() {
    var list = document.getElementById('event-list');
    if (!list || !MISSIONS[currentMission]) return;
    list.innerHTML = '';
    var unacked = 0;
    MISSIONS[currentMission].events.forEach(function(ev, i) {
        if (!ev.acked) unacked++;
        var el = document.createElement('div'); el.className = 'event-item';
        el.style.opacity = ev.acked ? '0.45' : '1';
        el.innerHTML = '<div class="event-time">'+ev.time+'</div>'
            +'<div class="event-body"><div class="event-msg '+ev.type+'">'+ev.msg+'</div>'
            +'<div class="event-source">'+ev.source+'</div></div>';
        if (!ev.acked && currentRole && currentRole !== 'VIEWER') {
            var ab = document.createElement('button');
            ab.style = 'background:transparent;border:1px solid #5a7b8c;color:#5a7b8c;cursor:pointer;font-family:inherit;font-size:9px;padding:2px 5px;margin-left:5px;';
            ab.textContent = 'ACK';
            ab.onclick = (function(idx){ return function(){
                WS.send({type:'ack_event', missionIdx:currentMission, eventIdx:idx});
                MISSIONS[currentMission].events[idx].acked = true;
                renderEvents();
            }; })(i);
            el.appendChild(ab);
        }
        if (ev.override && !ev.acked && currentRole === 'SUPERVISOR') {
            var ob = document.createElement('button');
            ob.style = 'background:var(--danger);border:none;color:white;cursor:pointer;font-family:inherit;font-size:9px;padding:2px 5px;margin-left:5px;';
            ob.textContent = 'REVIEW';
            ob.onclick = (function(ev2,idx){ return function(){ openOverrideModal(ev2,idx); }; })(ev,i);
            el.appendChild(ob);
        }
        list.appendChild(el);
    });
    var uc = document.getElementById('unacked-count');
    if (uc) uc.textContent = unacked + ' UNACKED';
}

// ── Override modal ─────────────────────────────────────────
function openOverrideModal(ev, idx) {
    currentOverrideEvent = ev; currentOverrideIdx = idx;
    document.getElementById('modal-title').textContent = '⚠ OVERRIDE REQUEST';
    document.getElementById('modal-body').innerHTML = ev.overrideBody || ev.msg;
    document.getElementById('modal-comment').value = '';
    document.getElementById('modal-overlay').classList.add('show');
}

function closeModal(decision) {
    var comment = document.getElementById('modal-comment').value.trim();
    if (decision === 'APPROVED' && !comment) { alert('Mandatory comment required for audit trail.'); return; }
    document.getElementById('modal-overlay').classList.remove('show');
    WS.send({type:'override', missionIdx:currentMission, eventIdx:currentOverrideIdx, decision:decision, comment:comment});
    currentOverrideEvent = null; currentOverrideIdx = -1;
}

// ── Presence ───────────────────────────────────────────────
function renderPresence() {
    var c = document.querySelector('.user-presence'); if (!c) return;
    c.innerHTML = '';
    onlineUsers.slice(0,5).forEach(function(u) {
        var av = document.createElement('div'); av.className = 'avatar';
        av.textContent = (u.user||'?').charAt(0).toUpperCase();
        av.title = u.user + ' (' + u.role + ')';
        c.appendChild(av);
    });
    var ol = document.getElementById('online-count');
    if (ol) ol.textContent = '● ' + onlineUsers.length + ' USERS ONLINE';
}

// ── Toast ──────────────────────────────────────────────────
function showToast(msg) {
    var t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    setTimeout(function(){ t.classList.remove('show'); }, 2500);
}

// ── Chat ───────────────────────────────────────────────────
function appendChatEntry(entry) {
    var body = document.getElementById('chat-body'); if (!body) return;
    var isMe = entry.user === currentUser;
    var div = document.createElement('div');
    div.className = 'chat-msg ' + (isMe ? 'outgoing' : 'incoming');
    div.innerHTML = '<span class="chat-user">' + entry.user + ' [' + entry.role + ']:</span> ' + entry.text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    // Badge if collapsed
    var w = document.getElementById('chat-widget');
    if (!isMe && w && w.classList.contains('chat-collapsed')) {
        var badge = document.getElementById('chat-badge');
        if (badge) badge.style.display = 'inline-block';
    }
}

function updateChatUI() {
    var chatWidget = document.getElementById('chat-widget'); if (!chatWidget) return;
    var chatInput = document.getElementById('chat-input');
    var chatHeader = document.querySelector('#chat-widget .chat-header');
    if (!currentRole) { chatWidget.style.display = 'none'; return; }
    chatWidget.style.display = 'flex';
    if (currentRole === 'SUPERVISOR') {
        chatHeader.style.background = 'rgba(255,42,42,0.15)';
        chatHeader.style.borderBottom = '1px solid #ff2a2a';
        chatHeader.innerHTML = '<b>⚠ SECURE COMMS (SUPERVISOR)</b>';
        if (chatInput) { chatInput.disabled = false; chatInput.placeholder = 'Send priority order...'; }
    } else if (currentRole === 'OPERATOR') {
        chatHeader.style.background = 'rgba(0,255,157,0.15)';
        chatHeader.style.borderBottom = '1px solid #00ff9d';
        chatHeader.innerHTML = '<b>💬 TACTICAL COMMS (OPERATOR)</b>';
        if (chatInput) { chatInput.disabled = false; chatInput.placeholder = 'Acknowledge or command...'; }
    } else {
        chatHeader.style.background = 'rgba(255,255,255,0.05)';
        chatHeader.style.borderBottom = '1px solid #5a7b8c';
        chatHeader.innerHTML = '<b>👁 GLOBAL CHAT (READ-ONLY)</b>';
        if (chatInput) { chatInput.disabled = true; chatInput.placeholder = 'View only mode...'; }
    }
}
