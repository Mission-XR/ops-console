// ============================================================
//  DASHBOARD — Rendering, actions, events, override modal, chat
// ============================================================
var currentMission       = 0;
var currentOverrideEvent = null;

function initDashboard() {
  updateClock();
  setInterval(updateClock, 1000);
  buildMissionTabs();
  renderMissionList();
  selectMission(0, null);

  // --- INICIAR MAPA 2D ---
  if (typeof initCanvas === 'function') initCanvas();

  // --- CONFIGURAR CHAT SEGÚN ROL AL ENTRAR ---
  updateChatUI();

  // --- COMPROBAR GAFAS VR ---
  checkVRSupport();

  // Evento simulado de prueba a los 10s
  setTimeout(function(){
    addLiveEvent(0, 'UAS-01 battery below 60% — consider swap', 'warn', 'UAS-01');
  }, 10000);
}

function updateClock() {
  var el = document.getElementById('clock');
  if (el) el.textContent = new Date().toTimeString().slice(0, 8);
}

function buildMissionTabs() {
  var cont = document.getElementById('mission-tabs');
  if (!cont) return;
  cont.innerHTML = '';
  MISSIONS.forEach(function(m, i){
    var btn = document.createElement('button');
    btn.className = 'mission-tab' + (i === 0 ? ' active' : '');
    btn.textContent = m.id.split('-').slice(0, 2).join('-');
    btn.onclick = (function(idx){ return function(){ selectMission(idx, btn); }; })(i);
    cont.appendChild(btn);
  });
}

function renderMissionList() {
  var list = document.getElementById('mission-list');
  if (!list) return;
  list.innerHTML = '';
  MISSIONS.forEach(function(m, i){
    var el = document.createElement('div');
    el.className = 'mission-item' + (i === currentMission ? ' active' : '');
    el.onclick = (function(idx){ return function(){ selectMission(idx, null); }; })(i);
    var statusCls = { running:'status-running', planned:'status-planned', blocked:'status-blocked', done:'status-done' }[m.status] || 'status-planned';
    el.innerHTML = '<div class="mission-name">' + m.label + '</div>'
      + '<div class="mission-meta"><div class="status-dot ' + statusCls + '"></div><span class="mission-status">' + m.status.toUpperCase() + '</span></div>'
      + '<div class="mission-agents">' + m.agents.map(function(a){ return a.id; }).join(' · ') + '</div>';
    list.appendChild(el);
  });
}

function selectMission(idx, tabEl) {
  currentMission = idx;
  document.querySelectorAll('.mission-tab').forEach(function(t, i){ t.classList.toggle('active', i === idx); });
  
  renderActionLane();
  renderGates();
  if (typeof renderTacticalMap === 'function') renderTacticalMap(); 
  renderContext();
  renderEvents();
  updateMapLabel();

  if (typeof xrActive !== 'undefined' && xrActive) {
    if (typeof refreshXRScene === 'function') refreshXRScene(); 
  }
}

function updateMapLabel() {
  var m  = MISSIONS[currentMission];
  var el = document.getElementById('map-mission-label');
  if (el) el.innerHTML = 'SYSTEM_ID: ' + m.id;
  
  var latEl = document.getElementById('map-coords');
  var lonEl = document.getElementById('map-coords2');
  if (latEl) latEl.textContent = 'LAT ' + m.coords.lat + '° N';
  if (lonEl) lonEl.textContent = 'LON ' + m.coords.lon + '° E';
}

function renderActionLane() {
  var lane = document.getElementById('action-lane');
  if (!lane) return;
  lane.innerHTML = '';
  MISSIONS[currentMission].actions.forEach(function(a){
    var el = document.createElement('div');
    el.className = 'action-item';
    var canStart = a.state === 'planned' && typeof currentRole !== 'undefined' && currentRole !== 'VIEWER';
    el.innerHTML = '<div class="action-item-top">'
      + '<div class="action-name">' + a.name + '</div>'
      + '<span class="action-state state-' + a.state + '">' + a.state.toUpperCase() + '</span>'
      + '</div>'
      + '<div class="action-item-bot">'
      + '<span class="action-agent">' + a.agent + '</span>'
      + (canStart ? '<button class="map-btn" style="padding:2px 8px; font-size:10px; margin-left:auto; height:auto; border-color:var(--accent); color:var(--accent);" onclick="startAction(' + currentMission + ',\'' + a.id + '\')">START</button>' : '')
      + '</div>';
    lane.appendChild(el);
  });
}

function renderGates() {
  var lane = document.getElementById('gates-lane');
  if (!lane) return;
  lane.innerHTML = '';
  MISSIONS[currentMission].gates.forEach(function(g){
    var el = document.createElement('div');
    el.className = 'action-item'; 
    var stCls = (g.status === 'open' || g.status === 'OPEN') ? 'ok' : 'warn';
    el.innerHTML = '<div class="action-item-top">'
      + '<div class="action-name" style="font-size:10px;">' + g.text + '</div>'
      + '<span class="action-state ' + stCls + '">' + g.status.toUpperCase() + '</span>'
      + '</div>';
    lane.appendChild(el);
  });
}

function renderContext() {
  var cont = document.getElementById('context-vars');
  if (!cont) return;
  cont.innerHTML = '';
  MISSIONS[currentMission].context.forEach(function(c){
    var row = document.createElement('div');
    row.className = 'ctx-row';
    row.style = "display:flex; justify-content:space-between; width:100%; font-size:11px; margin-bottom:4px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.05);";
    row.innerHTML = '<span style="color:var(--text-dim);">' + c.key + '</span><span class="' + (c.cls || '') + '">' + c.val + '</span>';
    cont.appendChild(row);
  });
}

function renderEvents() {
  var list = document.getElementById('event-list');
  if (!list) return;
  list.innerHTML = '';
  var unacked = 0;
  MISSIONS[currentMission].events.forEach(function(ev, i){
    if (!ev.acked) unacked++;
    var el = document.createElement('div');
    el.className  = 'event-item';
    el.style.opacity = ev.acked ? '0.45' : '1';
    el.innerHTML = '<div class="event-time">' + ev.time + '</div>'
      + '<div class="event-body"><div class="event-msg ' + ev.type + '">' + ev.msg + '</div>'
      + '<div class="event-source">' + ev.source + '</div></div>';
    
    if (!ev.acked && typeof currentRole !== 'undefined' && currentRole !== 'VIEWER') {
      var ab = document.createElement('button');
      ab.style = "background:transparent; border:1px solid #5a7b8c; color:#5a7b8c; cursor:pointer; font-family:inherit; font-size:9px; padding:2px 5px; margin-left:5px;";
      ab.textContent = 'ACK';
      ab.onclick = (function(idx, mIdx){ return function(){
        MISSIONS[mIdx].events[idx].acked = true;
        renderEvents();
      }; })(i, currentMission);
      el.appendChild(ab);
    }
    
    if (ev.override && !ev.acked && typeof currentRole !== 'undefined' && currentRole === 'SUPERVISOR') {
      var ob = document.createElement('button');
      ob.style = "background:var(--danger); border:none; color:white; cursor:pointer; font-family:inherit; font-size:9px; padding:2px 5px; margin-left:5px;";
      ob.textContent = 'REVIEW';
      ob.onclick = (function(ev2){ return function(){ openOverrideModal(ev2); }; })(ev);
      el.appendChild(ob);
    }
    list.appendChild(el);
  });
  var uc = document.getElementById('unacked-count');
  if (uc) uc.textContent = unacked + ' UNACKED';
}

function addLiveEvent(mIdx, msg, type, source) {
  var now = new Date();
  MISSIONS[mIdx].events.unshift({ time:now.toTimeString().slice(0,8), msg:msg, type:type, source:source, acked:false });
  if (mIdx === currentMission) renderEvents();
}

function startAction(mIdx, actionId) {
  var m = MISSIONS[mIdx];
  var a = m.actions.find(function(x){ return x.id === actionId; });
  if (!a) return;
  if (!confirm('START: ' + a.name + '\nConfirm deployment?')) return;
  
  a.state = 'running';
  var agent = m.agents.find(function(x){ return x.id === a.agent; });
  if (agent) agent.state = 'running';
  
  // Despertar la misión para que se mueva en el mapa
  m.status = 'running'; 

  renderActionLane();
  if (typeof renderTacticalMap === 'function') renderTacticalMap();
  showToast(a.agent + ' STARTED');
}

function openOverrideModal(ev) {
  currentOverrideEvent = ev;
  document.getElementById('modal-title').textContent = '⚠ OVERRIDE REQUEST';
  document.getElementById('modal-body').innerHTML = ev.overrideBody || ev.msg;
  document.getElementById('modal-comment').value = '';
  document.getElementById('modal-overlay').classList.add('show');
}

function closeModal(decision) {
  var comment = document.getElementById('modal-comment').value.trim();
  if (decision === 'APPROVED' && !comment) {
    alert('Mandatory comment required for audit trail.');
    return;
  }
  document.getElementById('modal-overlay').classList.remove('show');
  
  if (currentOverrideEvent) {
    currentOverrideEvent.acked = true;
    var m = MISSIONS[currentMission];

    if (decision === 'APPROVED') {
      m.agents.forEach(function(ag) { if (ag.state === 'blocked') ag.state = 'running'; });
      m.actions.forEach(function(act) { if (act.state === 'blocked') act.state = 'running'; });
      m.status = 'running'; // Reactivar la misión general
      addLiveEvent(currentMission, 'Override APPROVED. Note: "' + comment + '"', 'ok', 'SUPERVISOR');
    } else {
      addLiveEvent(currentMission, 'Override REJECTED. Note: "' + comment + '"', 'danger', 'SUPERVISOR');
    }
  }
  
  currentOverrideEvent = null;
  renderEvents();
  renderActionLane();
  if (typeof renderTacticalMap === 'function') renderTacticalMap();
  showToast('Override ' + decision);
}

function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 2500);
}

function checkVRSupport() {
  var vrBtn = document.querySelector('.btn-vr');
  if (!vrBtn) return;

  function disableVRButton(reason) {
    vrBtn.disabled = true;
    vrBtn.style.opacity = '0.3';
    vrBtn.style.cursor = 'not-allowed';
    vrBtn.title = reason;
    setTimeout(function() { showToast('⚠ ' + reason); }, 1500);
  }

  if (navigator.xr) {
    navigator.xr.isSessionSupported('immersive-vr').then(function(supported) {
      if (!supported) disableVRButton('VR NOT DETECTED — Headset required');
    }).catch(function() { 
      disableVRButton('VR ERROR — Access denied'); 
    });
  } else {
    disableVRButton('VR NOT SUPPORTED — Browser lacks WebXR');
  }
}

// --- ACTUALIZAR CHAT SEGÚN EL ROL ---
function updateChatUI() {
    var chatWidget = document.getElementById('chat-widget');
    if (!chatWidget) return;

    var chatInput = document.querySelector('#chat-widget input'); 
    var chatHeader = document.querySelector('#chat-widget .chat-header') || chatWidget.firstElementChild;

    // 1. Si no hay rol (pantalla de login), ocultar el chat
    if (typeof currentRole === 'undefined' || !currentRole || currentRole === '') {
        chatWidget.style.display = 'none';
        return;
    }

    // 2. Mostrar chat
    chatWidget.style.display = 'flex';

    // 3. Permisos y estilos según el rol
    if (currentRole === 'SUPERVISOR') {
        chatHeader.style.background = 'rgba(255, 42, 42, 0.15)'; 
        chatHeader.style.borderBottom = '1px solid #ff2a2a';
        chatHeader.innerHTML = '<b>⚠ SECURE COMMS (SUPERVISOR)</b>';
        if (chatInput) { chatInput.disabled = false; chatInput.placeholder = "Send priority order..."; }

    } else if (currentRole === 'OPERATOR') {
        chatHeader.style.background = 'rgba(0, 255, 157, 0.15)'; 
        chatHeader.style.borderBottom = '1px solid #00ff9d';
        chatHeader.innerHTML = '<b>💬 TACTICAL COMMS (OPERATOR)</b>';
        if (chatInput) { chatInput.disabled = false; chatInput.placeholder = "Acknowledge or command..."; }

    } else { // VIEWER
        chatHeader.style.background = 'rgba(255, 255, 255, 0.05)'; 
        chatHeader.style.borderBottom = '1px solid #5a7b8c';
        chatHeader.innerHTML = '<b>👁 GLOBAL CHAT (READ-ONLY)</b>';
        if (chatInput) { chatInput.disabled = true; chatInput.placeholder = "View only mode..."; }
    }
}