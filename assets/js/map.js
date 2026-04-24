// ============================================================
//  MAP — 2D Tactical Radar (pure renderer)
//  Agent positions (posX, posY as 0-100%) arrive from the server.
//  This file only DRAWS — no trajectory calculations.
// ============================================================

var mapCanvas, ctx;
var selectedAgent = null;
var agentHitboxes = [];

function initCanvas() {
  mapCanvas = document.getElementById('map-canvas');
  if (!mapCanvas) return;
  ctx = mapCanvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  mapCanvas.addEventListener('click', handleMapClick);

  // Start render loop (reads MISSIONS directly)
  (function loop() {
    renderTacticalMap();
    requestAnimationFrame(loop);
  })();
}

function resizeCanvas() {
  if (!mapCanvas) return;
  mapCanvas.width = mapCanvas.parentElement.clientWidth;
  mapCanvas.height = mapCanvas.parentElement.clientHeight;
}

function handleMapClick(e) {
  var rect = mapCanvas.getBoundingClientRect();
  var mx = e.clientX - rect.left;
  var my = e.clientY - rect.top;
  selectedAgent = null;
  for (var i = 0; i < agentHitboxes.length; i++) {
    var b = agentHitboxes[i];
    if (Math.sqrt((mx - b.x) * (mx - b.x) + (my - b.y) * (my - b.y)) < 20) {
      selectedAgent = b.agent;
      if (typeof showToast === 'function') showToast('Agent ' + selectedAgent.id + ' selected');
      break;
    }
  }
}

// ── Blueprint zone helper ──────────────────────────────────
function map3Dto2D(cx, cz, w, d) {
  var cw = mapCanvas.width, ch = mapCanvas.height;
  return {
    x: ((cx - w / 2 + 15) / 30) * cw,
    y: ((cz - d / 2 + 15) / 30) * ch,
    w: (w / 30) * cw,
    h: (d / 30) * ch,
  };
}

function drawBlueprintBox(cx, cz, w, d, label, r, g, b) {
  var rect = map3Dto2D(cx, cz, w, d);
  ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.1)';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.7)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  if (label) {
    ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    ctx.font = "bold 9px 'Share Tech Mono'";
    ctx.textAlign = 'left';
    ctx.fillText(label, rect.x + 4, rect.y + 12);
  }
}

// ── Main render ────────────────────────────────────────────
function renderTacticalMap() {
  if (!ctx || !mapCanvas) return;
  if (typeof MISSIONS === 'undefined' || !MISSIONS.length) return;
  var m = MISSIONS[currentMission];
  if (!m) return;

  var cw = mapCanvas.width, ch = mapCanvas.height;
  ctx.clearRect(0, 0, cw, ch);

  // Grid
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (var i = 30; i < cw; i += 30) { ctx.moveTo(i, 0); ctx.lineTo(i, ch); }
  for (var j = 30; j < ch; j += 30) { ctx.moveTo(0, j); ctx.lineTo(cw, j); }
  ctx.stroke();

  // Mission-specific zones
  drawMissionZones(m);

  // Emergency overlay
  if (emergencyStopped) {
    ctx.fillStyle = 'rgba(255,42,42,0.15)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#ff2a2a';
    ctx.font = "bold 20px 'Share Tech Mono'";
    ctx.textAlign = 'center';
    if (Math.floor(Date.now() / 500) % 2 === 0)
      ctx.fillText('⚠ SYSTEM HALTED — EMERGENCY STOP ACTIVE ⚠', cw / 2, ch / 2 - 20);
  }

  if (!m.agents) return;
  agentHitboxes = [];

  // Draw agents at positions provided by the server
  m.agents.forEach(function (ag) {
    var px = (ag.posX / 100) * cw;
    var py = (ag.posY / 100) * ch;
    var displayState = emergencyStopped ? 'blocked' : ag.state;
    var isSel = selectedAgent && selectedAgent.id === ag.id;
    drawAgentIcon(px, py, ag.id, displayState, ag.icon, isSel);
    agentHitboxes.push({ x: px, y: py, agent: ag });
  });

  if (selectedAgent) drawAgentTooltip(selectedAgent);
}

// ── Zone layouts per mission ───────────────────────────────
function drawMissionZones(m) {
  if (m.id === 'INFRA-INSPECT-01') {
    drawBlueprintBox(0, 0, 24, 3, 'ROAD N-S', 90, 123, 140);
    drawBlueprintBox(0, -6, 3, 14, 'ROAD E-W', 90, 123, 140);
    drawBlueprintBox(5, -6, 7, 3, 'BRIDGE', 0, 212, 255);
    drawBlueprintBox(8, 3, 6, 6, 'NO-FLY ZONE-C', 255, 43, 94);
  } else if (m.id === 'HOSPITAL-TRANSPORT-02') {
    drawBlueprintBox(-7, -5, 5, 5, 'BUILDING A', 0, 212, 255);
    drawBlueprintBox(7, -5, 5, 5, 'BUILDING B', 0, 212, 255);
    drawBlueprintBox(0, 6, 5, 5, 'BUILDING C', 0, 212, 255);
    drawBlueprintBox(0, 0, 10, 6, 'COURTYARD NO-FLY', 255, 43, 94);
  } else if (m.id === 'WILDFIRE-MAP-03') {
    drawBlueprintBox(4, 0, 12, 12, 'FIRE FRONT - ALPHA', 255, 107, 43);
    drawBlueprintBox(9, 7, 5, 4, 'PROTECTED ZONE', 255, 43, 94);
    drawBlueprintBox(-7, 0, 3, 14, 'SAFE CORRIDOR', 0, 255, 157);
  } else if (m.id === 'WAREHOUSE-LOG-04') {
    drawBlueprintBox(-8, -6, 9, 9, 'ZONE A', 0, 255, 157);
    drawBlueprintBox(8, -6, 9, 9, 'ZONE B', 255, 209, 102);
    drawBlueprintBox(-8, 6, 9, 9, 'ZONE C', 58, 96, 112);
    drawBlueprintBox(8, 6, 9, 9, 'ZONE D (FORKLIFT)', 255, 107, 43);
  } else if (m.id === 'OFFSHORE-WIND-05') {
    drawBlueprintBox(-10, 9, 6, 3, 'PIER / DOCK', 0, 212, 255);
    var turbines = [[-8, -8], [0, -10], [8, -6], [10, 2], [2, 6]];
    ctx.fillStyle = 'rgba(126,184,255,0.5)';
    var cw = mapCanvas.width, ch = mapCanvas.height;
    turbines.forEach(function (t, i) {
      var pos = map3Dto2D(t[0], t[1], 1, 1);
      ctx.beginPath();
      ctx.arc(pos.x + pos.w / 2, pos.y + pos.h / 2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = "bold 9px 'Share Tech Mono'";
      ctx.textAlign = 'center';
      ctx.fillText('T' + (i + 1), pos.x + pos.w / 2, pos.y + pos.h / 2 + 3);
      ctx.fillStyle = 'rgba(126,184,255,0.5)';
    });
  }
}

// ── Agent icon ─────────────────────────────────────────────
function drawAgentIcon(x, y, id, state, iconEmoji, isSelected) {
  var color =
    state === 'running' ? '#00ff9d' :
    state === 'blocked' ? '#ff2a2a' :
    state === 'planned' ? '#ffaa00' : '#00d4ff';

  if (state === 'running' || isSelected) {
    ctx.beginPath();
    ctx.arc(x, y, (isSelected ? 20 : 16) + Math.sin(Date.now() / 200) * 3, 0, Math.PI * 2);
    ctx.strokeStyle = isSelected ? '#fff' : 'rgba(0,255,157,0.15)';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(2,6,9,0.9)';
  ctx.fillRect(x - 12, y - 12, 24, 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 12, y - 12, 24, 24);
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(iconEmoji || '●', x, y);

  ctx.fillStyle = 'rgba(2,6,9,0.9)';
  ctx.fillRect(x - 25, y + 16, 50, 14);
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x - 25, y + 16, 50, 14);
  ctx.fillStyle = color;
  ctx.font = "bold 9px 'Share Tech Mono'";
  ctx.fillText(id, x, y + 23);
}

// ── Tooltip ────────────────────────────────────────────────
function drawAgentTooltip(agent) {
  var cw = mapCanvas.width;
  var px = (agent.posX / 100) * cw;
  var py = (agent.posY / 100) * mapCanvas.height;
  var boxW = 180, boxH = 95;
  var x = px + 25, y = py - 40;
  if (x + boxW > cw) x = px - boxW - 25;
  if (y < 0) y = 10;

  ctx.fillStyle = 'rgba(2,6,9,0.95)';
  ctx.fillRect(x, y, boxW, boxH);
  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, boxW, boxH);
  ctx.fillStyle = 'rgba(0,212,255,0.1)';
  ctx.fillRect(x, y, boxW, 20);

  ctx.fillStyle = '#00d4ff';
  ctx.font = "bold 11px 'Share Tech Mono'";
  ctx.textAlign = 'left';
  ctx.fillText('AGENT: ' + agent.id, x + 8, y + 14);

  ctx.fillStyle = '#fff';
  ctx.font = "10px 'Share Tech Mono'";
  ctx.fillText('TYPE:  ' + (agent.type || 'UNKNOWN').toUpperCase(), x + 8, y + 35);

  var sc = agent.state === 'running' ? '#00ff9d' : agent.state === 'blocked' ? '#ff2a2a' : '#ffaa00';
  ctx.fillText('STATE: ', x + 8, y + 50);
  ctx.fillStyle = sc;
  ctx.fillText(agent.state.toUpperCase(), x + 45, y + 50);

  ctx.fillStyle = '#fff';
  ctx.fillText('BATT:  ' + (agent.battery !== null ? agent.battery + '%' : 'N/A'), x + 8, y + 65);

  var task = agent.task || 'Standby';
  if (task.length > 25) task = task.substring(0, 25) + '...';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('TASK:  ' + task, x + 8, y + 80);
}
