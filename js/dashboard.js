/* ============================================================
   dashboard.js — Dashboard Logic
   Handles: mission list, action lane, gates, events, modal
   ============================================================ */

// ============================================================
//  DASHBOARD
// ============================================================
function initDashboard() {
  updateClock(); setInterval(updateClock,1000);
  buildMissionTabs();
  renderMissionList();
  selectMission(0, null);
  initCanvas();
  setTimeout(function(){ addLiveEvent(0,'UAS-01 battery below 60% — consider swap','warn','UAS-01'); }, 10000);
}

function updateClock() {
  var el=document.getElementById('clock');
  if(el) el.textContent=new Date().toTimeString().slice(0,8);
}

function buildMissionTabs() {
  var cont=document.getElementById('mission-tabs');
  cont.innerHTML='';
  MISSIONS.forEach(function(m,i){
    var btn=document.createElement('button');
    btn.className='mission-tab'+(i===0?' active':'');
    btn.textContent=m.id.split('-').slice(0,2).join('-');
    btn.onclick=(function(idx){ return function(){ selectMission(idx,btn); }; })(i);
    cont.appendChild(btn);
  });
}

function renderMissionList() {
  var list=document.getElementById('mission-list');
  list.innerHTML='';
  MISSIONS.forEach(function(m,i){
    var el=document.createElement('div');
    el.className='mission-item'+(i===currentMission?' active':'');
    el.onclick=(function(idx){ return function(){ selectMission(idx,null); }; })(i);
    var statusCls = {running:'status-running',planned:'status-planned',blocked:'status-blocked',done:'status-done'}[m.status]||'status-planned';
    el.innerHTML='<div class="mission-name">'+m.label+'</div>'
      +'<div class="mission-meta"><div class="status-dot '+statusCls+'"></div><span class="mission-status">'+m.status.toUpperCase()+'</span></div>'
      +'<div class="mission-agents">'+m.agents.map(function(a){return a.id;}).join(' · ')+'</div>'
      +'<span class="scenario-tag '+m.tag+'">'+m.tagLabel+'</span>';
    list.appendChild(el);
  });
}

function selectMission(idx, tabEl) {
  currentMission=idx;
  document.querySelectorAll('.mission-tab').forEach(function(t,i){ t.classList.toggle('active',i===idx); });
  document.querySelectorAll('.mission-item').forEach(function(t,i){ t.classList.toggle('active',i===idx); });
  renderActionLane();
  renderGates();
  renderAgents();
  renderContext();
  renderEvents();
  updateMapLabel();
}

function updateMapLabel() {
  var m=MISSIONS[currentMission];
  var el=document.getElementById('map-mission-label');
  if(el) el.innerHTML='<span class="scenario-tag '+m.tag+'" style="font-size:9px;">'+m.tagLabel+'</span> '+m.id;
  document.getElementById('map-coords').textContent='LAT '+m.coords.lat;
  document.getElementById('map-coords2').textContent='LON '+m.coords.lon;
}

function renderActionLane() {
  var lane=document.getElementById('action-lane');
  lane.innerHTML='';
  MISSIONS[currentMission].actions.forEach(function(a){
    var el=document.createElement('div');
    el.className='action-item';
    var canStart=a.state==='planned'&&currentRole!=='VIEWER';
    el.innerHTML='<div class="action-item-top">'
      +'<div class="action-name">'+a.name+'</div>'
      +'<span class="action-state state-'+a.state+'">'+a.state.toUpperCase()+'</span>'
      +'</div>'
      +'<div class="action-item-bot">'
      +'<span class="action-agent">'+a.agent+'</span>'
      +(a.dep?'<span class="action-dep">dep:'+a.dep+'</span>':'')
      +(a.note?'<span class="action-dep" style="color:rgba(58,96,112,.6);">'+a.note+'</span>':'')
      +(canStart?'<button style="padding:2px 7px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-family:Share Tech Mono,monospace;font-size:9px;cursor:pointer;letter-spacing:1px;" onclick="startAction('+currentMission+',\''+a.id+'\')">START</button>':'')
      +'</div>';
    lane.appendChild(el);
  });
}

function renderGates() {
  var lane=document.getElementById('gates-lane');
  lane.innerHTML='';
  MISSIONS[currentMission].gates.forEach(function(g){
    var el=document.createElement('div');
    el.className='gate-item';
    var stCls={open:'gate-open',closed:'gate-closed',fail:'gate-fail'}[g.status]||'gate-closed';
    var stTxt={open:'OPEN',closed:'PENDING',fail:'FAILED'}[g.status]||'PENDING';
    el.innerHTML='<span class="gate-icon">⬡</span>'
      +'<span class="gate-text">'+g.text+'</span>'
      +'<span class="gate-status '+stCls+'">'+stTxt+'</span>';
    lane.appendChild(el);
  });
}

function renderContext() {
  var cont=document.getElementById('context-vars');
  cont.innerHTML='';
  MISSIONS[currentMission].context.forEach(function(c){
    var row=document.createElement('div');
    row.className='ctx-row';
    row.innerHTML='<span class="ctx-key">'+c.key+'</span><span class="ctx-val '+c.cls+'">'+c.val+'</span>';
    cont.appendChild(row);
  });
}

function renderEvents() {
  var list=document.getElementById('event-list');
  list.innerHTML='';
  var unacked=0;
  MISSIONS[currentMission].events.forEach(function(ev,i){
    if(!ev.acked) unacked++;
    var el=document.createElement('div');
    el.className='event-item';
    el.style.opacity=ev.acked?'0.45':'1';
    el.innerHTML='<div class="event-time">'+ev.time+'</div>'
      +'<div class="event-body"><div class="event-msg '+ev.type+'">'+ev.msg+'</div>'
      +'<div class="event-source">'+ev.source+'</div></div>';
    if(!ev.acked){
      var ab=document.createElement('button'); ab.className='ack-btn'; ab.textContent='ACK';
      ab.onclick=(function(idx,mIdx){ return function(){ MISSIONS[mIdx].events[idx].acked=true; renderEvents(); showToast('ACK — event acknowledged'); }; })(i,currentMission);
      el.appendChild(ab);
    }
    if(ev.override&&!ev.acked&&currentRole==='SUPERVISOR'){
      var ob=document.createElement('button'); ob.className='review-btn'; ob.textContent='REVIEW';
      ob.onclick=(function(ev2){ return function(){ openOverrideModal(ev2); }; })(ev);
      el.appendChild(ob);
    }
    list.appendChild(el);
  });
  var uc=document.getElementById('unacked-count');
  if(uc) uc.textContent=unacked+' UNACKED';
}

function addLiveEvent(mIdx,msg,type,source){
  var now=new Date();
  MISSIONS[mIdx].events.unshift({time:now.toTimeString().slice(0,8),msg:msg,type:type,source:source,acked:false});
  if(mIdx===currentMission) renderEvents();
}

function startAction(mIdx, actionId) {
  var m=MISSIONS[mIdx];
  var a=m.actions.find(function(x){return x.id===actionId;});
  if(!a) return;
  if(!confirm('START: '+a.name+'\nAgent: '+a.agent+'\n\nConfirm?')) return;
  a.state='running';
  renderActionLane();
  showToast(a.agent+' → '+a.name+' STARTED');
  addLiveEvent(mIdx,'Action started: '+a.name,'ok',a.agent);
}

function setRole(role,el) {
  currentRole=role;
  document.querySelectorAll('.role-opt').forEach(function(b){ b.classList.remove('active'); });
  el.classList.add('active');
  document.getElementById('role-badge').textContent=role;
  renderActionLane(); renderEvents();
  showToast('Role switched: '+role);
}

// ============================================================
//  OVERRIDE MODAL
// ============================================================
function openOverrideModal(ev) {
  currentOverrideEvent=ev;
  document.getElementById('modal-title').textContent='⚠ OVERRIDE REQUEST — SUPERVISOR REQUIRED';
  document.getElementById('modal-body').innerHTML=ev.overrideBody||ev.msg;
  document.getElementById('modal-comment').value='';
  document.getElementById('modal-overlay').classList.add('show');
}

function closeModal(decision) {
  var comment=document.getElementById('modal-comment').value.trim();
  if(decision==='APPROVED'&&!comment){ alert('Mandatory comment required for audit trail.'); return; }
  document.getElementById('modal-overlay').classList.remove('show');
  if(currentOverrideEvent) currentOverrideEvent.acked=true;
  addLiveEvent(currentMission,'Override '+decision+' — "'+comment+'"','ok','AUDIT');
  showToast('Override '+decision);
  currentOverrideEvent=null;
}

