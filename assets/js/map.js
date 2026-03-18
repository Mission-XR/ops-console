// ============================================================
//  MAP — Canvas rendering, agent markers, tooltips
// ============================================================
var canvasT = 0;

function initCanvas() {
  var canvas = document.getElementById('map-canvas');
  var ctx    = canvas.getContext('2d');

  function resize() {
    canvas.width  = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }
  resize();
  window.addEventListener('resize', function(){ resize(); renderAgents(); });

  function draw() {
    var W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#020609';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(0,60,90,0.4)';
    ctx.lineWidth   = 0.5;
    for (var x = 0; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (var y = 0; y < H; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Mission-specific zones
    drawMissionZones(ctx, W, H);

    // Scan pulse on running missions
    var m  = MISSIONS[currentMission];
    if (m.status === 'running') {
      var ag = m.agents.find(function(a){ return a.state === 'running'; });
      if (ag) {
        var cx = (ag.x / 100) * W;
        var cy = (ag.y / 100) * H;
        var r  = 25 + 15 * Math.abs(Math.sin(canvasT * 0.04));
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,255,157,' + (0.25 - 0.2 * Math.abs(Math.sin(canvasT * 0.04))) + ')';
        ctx.lineWidth   = 1;
        ctx.stroke();
      }
    }
    canvasT++;
    requestAnimationFrame(draw);
  }
  draw();
}

function drawMissionZones(ctx, W, H) {
  var m = MISSIONS[currentMission];

  if (m.id === 'INFRA-INSPECT-01') {
    ctx.fillStyle = 'rgba(255,43,94,0.05)'; ctx.strokeStyle = 'rgba(255,43,94,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.rect(W*.55, H*.25, W*.22, H*.22); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,43,94,0.6)'; ctx.font = '9px Share Tech Mono,monospace';
    ctx.fillText('NO-FLY ZONE-C', W*.56, H*.27);
    ctx.fillStyle = 'rgba(0,212,255,0.04)'; ctx.strokeStyle = 'rgba(0,212,255,0.15)';
    ctx.beginPath(); ctx.rect(W*.2, H*.28, W*.18, H*.42); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,212,255,0.5)'; ctx.fillText('SECTOR NORTH', W*.21, H*.30);
    ctx.beginPath(); ctx.rect(W*.2, H*.72, W*.35, H*.18); ctx.fill(); ctx.stroke();
    ctx.fillText('SECTOR SOUTH', W*.21, H*.74);

  } else if (m.id === 'HOSPITAL-TRANSPORT-02') {
    var buildings = [
      { x:.15, y:.2,  w:.2, h:.25, label:'BUILDING A' },
      { x:.55, y:.2,  w:.2, h:.25, label:'BUILDING B' },
      { x:.35, y:.6,  w:.22,h:.25, label:'BUILDING C' },
    ];
    buildings.forEach(function(b){
      ctx.fillStyle = 'rgba(0,212,255,0.05)'; ctx.strokeStyle = 'rgba(0,212,255,0.2)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.rect(W*b.x, H*b.y, W*b.w, H*b.h); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(0,212,255,0.5)'; ctx.font = '9px Share Tech Mono,monospace';
      ctx.fillText(b.label, W*(b.x+.01), H*(b.y+.04));
    });
    ctx.fillStyle = 'rgba(255,43,94,0.04)'; ctx.strokeStyle = 'rgba(255,43,94,0.2)';
    ctx.beginPath(); ctx.rect(W*.35, H*.45, W*.22, H*.12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,43,94,0.5)'; ctx.font = '9px Share Tech Mono,monospace';
    ctx.fillText('COURTYARD NO-FLY', W*.36, H*.47);

  } else if (m.id === 'WILDFIRE-MAP-03') {
    ctx.fillStyle = 'rgba(255,107,43,0.08)'; ctx.strokeStyle = 'rgba(255,107,43,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.rect(W*.4, H*.25, W*.35, H*.35); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,107,43,0.7)'; ctx.font = '9px Share Tech Mono,monospace';
    ctx.fillText('FIRE FRONT — SECTOR ALPHA', W*.41, H*.28);
    ctx.fillStyle = 'rgba(255,43,94,0.05)'; ctx.strokeStyle = 'rgba(255,43,94,0.2)';
    ctx.beginPath(); ctx.rect(W*.55, H*.55, W*.25, H*.2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,43,94,0.5)'; ctx.fillText('PROTECTED ZONE', W*.56, H*.57);
    ctx.fillStyle = 'rgba(0,212,255,0.04)'; ctx.strokeStyle = 'rgba(0,212,255,0.15)';
    ctx.beginPath(); ctx.rect(W*.1, H*.5, W*.2, H*.35); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,212,255,0.5)'; ctx.fillText('SAFE CORRIDOR', W*.11, H*.52);

  } else if (m.id === 'WAREHOUSE-LOG-04') {
    var zones = [
      { x:.1,  y:.15, w:.35, h:.3, label:'ZONE A',            col:'green'  },
      { x:.55, y:.15, w:.35, h:.3, label:'ZONE B',            col:'yellow' },
      { x:.1,  y:.55, w:.35, h:.3, label:'ZONE C',            col:'dim'    },
      { x:.55, y:.55, w:.35, h:.3, label:'ZONE D — FORKLIFT', col:'warn'   },
    ];
    var cols = { green:'rgba(0,255,157', yellow:'rgba(255,209,102', dim:'rgba(58,96,112', warn:'rgba(255,107,43' };
    zones.forEach(function(z){
      var c = cols[z.col] || cols.dim;
      ctx.fillStyle = c + ',.05)'; ctx.strokeStyle = c + ',.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.rect(W*z.x, H*z.y, W*z.w, H*z.h); ctx.fill(); ctx.stroke();
      ctx.fillStyle = c + ',.7)'; ctx.font = '9px Share Tech Mono,monospace';
      ctx.fillText(z.label, W*(z.x+.01), H*(z.y+.04));
      ctx.strokeStyle = c + ',.15)'; ctx.lineWidth = 0.5;
      for (var ry = H*(z.y+.07); ry < H*(z.y+z.h-.02); ry += 12) {
        ctx.beginPath(); ctx.moveTo(W*(z.x+.01), ry); ctx.lineTo(W*(z.x+z.w-.01), ry); ctx.stroke();
      }
    });

  } else if (m.id === 'OFFSHORE-WIND-05') {
    ctx.fillStyle = 'rgba(0,20,40,0.4)';
    ctx.fillRect(0, 0, W, H);
    var turbines = [{ x:.25,y:.3 },{ x:.4,y:.25 },{ x:.55,y:.3 },{ x:.65,y:.45 },{ x:.45,y:.55 }];
    turbines.forEach(function(t, i){
      ctx.strokeStyle = 'rgba(126,184,255,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W*t.x, H*t.y+20); ctx.lineTo(W*t.x, H*t.y-20); ctx.stroke();
      [0, 120, 240].forEach(function(deg){
        var rad = deg * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(W*t.x, H*t.y);
        ctx.lineTo(W*t.x + Math.cos(rad)*22, H*t.y + Math.sin(rad)*22);
        ctx.stroke();
      });
      ctx.fillStyle = 'rgba(126,184,255,0.7)'; ctx.font = '8px Share Tech Mono,monospace';
      ctx.fillText('T'+(i+1), W*t.x-5, H*t.y+30);
    });
    ctx.fillStyle = 'rgba(0,212,255,0.04)'; ctx.strokeStyle = 'rgba(0,212,255,0.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.rect(W*.05, H*.7, W*.25, H*.2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,212,255,0.5)'; ctx.font = '9px Share Tech Mono,monospace';
    ctx.fillText('PIER / RELAY DOCK', W*.06, H*.72);
  }
}

// ── Agent markers ────────────────────────────────────────────
function renderAgents() {
  var layer = document.getElementById('agents-layer');
  var svg   = document.getElementById('path-overlay');
  if (!layer || !svg) return;
  layer.innerHTML = '';
  svg.innerHTML   = '';
  var map = document.getElementById('map-area');
  var W = map.clientWidth, H = map.clientHeight;
  var ags = MISSIONS[currentMission].agents;

  // Dashed connector lines
  for (var i = 0; i < ags.length - 1; i++) {
    var a = ags[i], b = ags[i+1];
    var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', (a.x/100)*W); line.setAttribute('y1', (a.y/100)*H);
    line.setAttribute('x2', (b.x/100)*W); line.setAttribute('y2', (b.y/100)*H);
    line.setAttribute('stroke', 'rgba(0,212,255,0.15)');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('stroke-dasharray', '5 4');
    svg.appendChild(line);
  }

  ags.forEach(function(ag){
    var marker = document.createElement('div');
    marker.className = 'agent-marker';
    marker.style.left = ag.x + '%';
    marker.style.top  = ag.y + '%';
    marker.innerHTML = '<div class="agent-icon ' + ag.state + '">' + ag.icon + '</div>'
      + '<div class="agent-label ' + ag.state + '">' + ag.id + '</div>';
    marker.onmouseenter = function(e){ showAgentTooltip(ag, e); };
    marker.onmouseleave = function(){  hideAgentTooltip(); };
    marker.onclick      = function(){  showToast(ag.id + ' — ' + ag.state.toUpperCase() + ' — ' + ag.task); };
    layer.appendChild(marker);
  });
}

// ── Agent tooltip ─────────────────────────────────────────────
function showAgentTooltip(ag, e) {
  hideAgentTooltip();
  var tt = document.createElement('div');
  tt.className = 'agent-tooltip';
  tt.id        = 'agent-tooltip';
  var batRow = ag.battery !== null
    ? '<div class="agent-tooltip-row"><span class="agent-tooltip-key">BATTERY</span><span class="agent-tooltip-val">' + ag.battery + '%</span></div>'
    : '';
  tt.innerHTML = '<div class="agent-tooltip-name">' + ag.id + '</div>'
    + '<div class="agent-tooltip-row"><span class="agent-tooltip-key">TYPE</span><span class="agent-tooltip-val">'   + ag.type + '</span></div>'
    + '<div class="agent-tooltip-row"><span class="agent-tooltip-key">STATUS</span><span class="agent-tooltip-val" style="color:var(--accent2)">' + ag.state.toUpperCase() + '</span></div>'
    + batRow
    + '<div class="agent-tooltip-row"><span class="agent-tooltip-key">TASK</span><span class="agent-tooltip-val" style="color:var(--dim)">' + ag.task + '</span></div>'
    + '<div style="margin-top:5px;color:var(--dim);font-size:9px;">' + ag.capabilities.join(' · ') + '</div>';

  var map  = document.getElementById('map-area');
  var rect = map.getBoundingClientRect();
  var x    = e.clientX - rect.left + 14;
  var y    = e.clientY - rect.top  - 10;
  if (x + 190 > rect.width) x = e.clientX - rect.left - 200;
  tt.style.left = x + 'px';
  tt.style.top  = y + 'px';
  map.appendChild(tt);
}

function hideAgentTooltip() {
  var tt = document.getElementById('agent-tooltip');
  if (tt) tt.remove();
}
