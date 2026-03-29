// ============================================================
//  DASHBOARD — Rendering, actions, events, override modal (HITL)
// ============================================================
var currentMission       = 0;
var currentOverrideEvent = null;

function initDashboard() {
  updateClock();
  setInterval(updateClock, 1000);
  buildMissionTabs();
  renderMissionList();
  selectMission(0, null);

  // --- ARREGLO MAPA 2D ---
  // Encendemos el radar al iniciar el dashboard
  if (typeof initCanvas === 'function') initCanvas();

  // --- MOSTRAR CHAT ---
  // Mostramos el chat que estaba oculto en la pantalla de login
  var chatWidget = document.getElementById('chat-widget');
  if (chatWidget) chatWidget.style.display = 'flex';

  checkVRSupport();

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
  if (typeof renderAgents === 'function') renderAgents();
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
  if (el) el.innerHTML = 'ID: ' + m.id;
  
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
    var canStart = a.state === 'planned' && currentRole !== 'VIEWER';
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
    el.className = 'action-item'; // Usamos estilo similar a action lane
    var stCls = g.status === 'open' ? 'ok' : 'warn';
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
    row.style = "display:flex; justify-content:space-between; width:100%; font-size:11px; margin-bottom:4px;";
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
    
    if (!ev.acked && currentRole !== 'VIEWER') {
      var ab = document.createElement('button');
      ab.style = "background:transparent; border:1px solid #5a7b8c; color:#5a7b8c; cursor:pointer; font-family:inherit; font-size:9px; padding:2px 5px; margin-left:5px;";
      ab.textContent = 'ACK';
      ab.onclick = (function(idx, mIdx){ return function(){
        MISSIONS[mIdx].events[idx].acked = true;
        renderEvents();
      }; })(i, currentMission);
      el.appendChild(ab);
    }
    
    if (ev.override && !ev.acked && currentRole === 'SUPERVISOR') {
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
  renderActionLane();
  if (typeof renderAgents === 'function') renderAgents();
  showToast(a.agent + ' STARTED');
}

function openOverrideModal(ev) {
  currentOverrideEvent = ev;
  document.getElementById('modal-title').textContent = '⚠ OVERRIDE REQUEST';
  document.getElementById('modal-body').innerHTML = ev.msg;
  document.getElementById('modal-comment').value = '';
  document.getElementById('modal-overlay').classList.add('show');
}

function closeModal(decision) {
  var comment = document.getElementById('modal-comment').value.trim();
  if (decision === 'APPROVED' && !comment) {
    alert('Mandatory comment required.');
    return;
  }
  document.getElementById('modal-overlay').classList.remove('show');
  if (currentOverrideEvent) {
    currentOverrideEvent.acked = true;
    if (decision === 'APPROVED') {
      var m = MISSIONS[currentMission];
      m.agents.forEach(function(ag) { if (ag.state === 'blocked') ag.state = 'running'; });
      m.actions.forEach(function(act) { if (act.state === 'blocked') act.state = 'running'; });
    }
  }
  renderEvents();
  renderActionLane();
  if (typeof renderAgents === 'function') renderAgents();
}

function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 2500);
}

function checkVRSupport() {
  // Lógica de detección WebXR
}