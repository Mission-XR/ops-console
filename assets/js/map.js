// ============================================================
//  MAP — Radar Canvas 2D (RUTAS LARGAS Y MOVIMIENTO REALISTA)
// ============================================================
var mapCanvas, ctx;
var agentHitboxes = [];
var selectedAgent = null;

function initCanvas() {
    mapCanvas = document.getElementById('map-canvas');
    if (!mapCanvas) return;
    ctx = mapCanvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    mapCanvas.addEventListener('click', handleMapClick);

    function mapLoop() {
        renderTacticalMap();
        requestAnimationFrame(mapLoop);
    }
    mapLoop();
}

function resizeCanvas() {
    if (!mapCanvas) return;
    mapCanvas.width = mapCanvas.parentElement.clientWidth;
    mapCanvas.height = mapCanvas.parentElement.clientHeight;
    if (typeof MISSIONS !== 'undefined') {
        MISSIONS.forEach(m => {
            if(m.agents) m.agents.forEach(a => { 
                a.pathParams = undefined; 
            });
        });
    }
}

function handleMapClick(e) {
    var rect = mapCanvas.getBoundingClientRect();
    var mouseX = e.clientX - rect.left;
    var mouseY = e.clientY - rect.top;
    selectedAgent = null;
    var clicked = false;

    for (var i = 0; i < agentHitboxes.length; i++) {
        var box = agentHitboxes[i];
        if (Math.sqrt((mouseX - box.x)**2 + (mouseY - box.y)**2) < 20) {
            selectedAgent = box.agent;
            clicked = true;
            break;
        }
    }
    if (clicked && typeof showToast === 'function') showToast('Agent ' + selectedAgent.id + ' selected');
}

function map3Dto2D(cx, cz, w, d) {
    var cw = mapCanvas.width; var ch = mapCanvas.height;
    return { x: ((cx - w/2 + 15) / 30) * cw, y: ((cz - d/2 + 15) / 30) * ch, w: (w / 30) * cw, h: (d / 30) * ch };
}

function drawBlueprintBox(cx, cz, w, d, label, r, g, b) {
    var rect = map3Dto2D(cx, cz, w, d);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.1)`; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.7)`; ctx.lineWidth = 1.5; ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    if (label) {
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`; ctx.font = "bold 9px 'Share Tech Mono'"; ctx.textAlign = "left";
        ctx.fillText(label, rect.x + 4, rect.y + 12);
    }
}

function renderTacticalMap() {
    if (!ctx || !mapCanvas || mapCanvas.style.display === 'none') return;
    ctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);

    var m = MISSIONS[currentMission];
    if (!m) return;

    var cw = mapCanvas.width; var ch = mapCanvas.height;

    // 1. DIBUJAR FONDO
    ctx.beginPath(); ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
    for(let i=30; i<cw; i+=30) { ctx.moveTo(i, 0); ctx.lineTo(i, ch); }
    for(let i=30; i<ch; i+=30) { ctx.moveTo(0, i); ctx.lineTo(cw, i); }
    ctx.stroke();

    // 2. DIBUJAR ZONAS
    if (m.id === 'INFRA-INSPECT-01') {
        drawBlueprintBox(0, 0, 24, 3, 'ROAD N-S', 90, 123, 140); drawBlueprintBox(0, -6, 3, 14, 'ROAD E-W', 90, 123, 140); drawBlueprintBox(5, -6, 7, 3, 'BRIDGE', 0, 212, 255); drawBlueprintBox(8, 3, 6, 6, 'NO-FLY ZONE-C', 255, 43, 94);
    } else if (m.id === 'HOSPITAL-TRANSPORT-02') {
        drawBlueprintBox(-7, -5, 5, 5, 'BUILDING A', 0, 212, 255); drawBlueprintBox(7, -5, 5, 5, 'BUILDING B', 0, 212, 255); drawBlueprintBox(0, 6, 5, 5, 'BUILDING C', 0, 212, 255); drawBlueprintBox(0, 0, 10, 6, 'COURTYARD NO-FLY', 255, 43, 94);
    } else if (m.id === 'WILDFIRE-MAP-03') {
        drawBlueprintBox(4, 0, 12, 12, 'FIRE FRONT - ALPHA', 255, 107, 43); drawBlueprintBox(9, 7, 5, 4, 'PROTECTED ZONE', 255, 43, 94); drawBlueprintBox(-7, 0, 3, 14, 'SAFE CORRIDOR', 0, 255, 157);
    } else if (m.id === 'WAREHOUSE-LOG-04') {
        drawBlueprintBox(-8, -6, 9, 9, 'ZONE A', 0, 255, 157); drawBlueprintBox(8, -6, 9, 9, 'ZONE B', 255, 209, 102); drawBlueprintBox(-8, 6, 9, 9, 'ZONE C', 58, 96, 112); drawBlueprintBox(8, 6, 9, 9, 'ZONE D (FORKLIFT)', 255, 107, 43);
    } else if (m.id === 'OFFSHORE-WIND-05') {
        drawBlueprintBox(-10, 9, 6, 3, 'PIER / DOCK', 0, 212, 255);
        var turbines = [[-8,-8],[0,-10],[8,-6],[10,2],[2,6]];
        ctx.fillStyle = "rgba(126, 184, 255, 0.5)";
        turbines.forEach((t, i) => { var pos = map3Dto2D(t[0], t[1], 1, 1); ctx.beginPath(); ctx.arc(pos.x + pos.w/2, pos.y + pos.h/2, 10, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillText("T"+(i+1), pos.x + pos.w/2 - 6, pos.y + pos.h/2 + 3); ctx.fillStyle = "rgba(126, 184, 255, 0.5)"; });
    }

    if (typeof emergencyStopped !== 'undefined' && emergencyStopped) {
        ctx.fillStyle = "rgba(255, 42, 42, 0.15)"; ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = "#ff2a2a"; ctx.font = "bold 20px 'Share Tech Mono'"; ctx.textAlign = "center";
        if (Math.floor(Date.now() / 500) % 2 === 0) ctx.fillText("⚠ SYSTEM HALTED - EMERGENCY STOP ACTIVE ⚠", cw / 2, ch / 2 - 20);
    }

    if (!m.agents) return;
    agentHitboxes = [];

    // 3. RUTAS MÁS LARGAS SEGÚN LA MISIÓN
    m.agents.forEach(function(agent) {
        if (!agent.pathParams) {
            var startX = (agent.x / 100) * cw;
            var startY = (agent.y / 100) * ch;
            var endX = startX, endY = startY, cX = startX, cY = startY;
            var isStraight = false;

            if (m.id === 'INFRA-INSPECT-01') {
                if (agent.type.includes('UAS')) {
                    endX = startX + 450; endY = startY; isStraight = true; // Ruta 2 veces más larga
                } else {
                    endX = startX; endY = startY + 350; isStraight = true;
                }
            } 
            else if (m.id === 'HOSPITAL-TRANSPORT-02') {
                endX = startX + 350; endY = startY - 180;
                cX = startX + 150; cY = startY - 350; // Curva más profunda
            } 
            else if (m.id === 'WILDFIRE-MAP-03') {
                endX = startX + 450; endY = startY + 80;
                cX = startX + 225; cY = startY + 350; // Barrido de fuego enorme
            } 
            else if (m.id === 'WAREHOUSE-LOG-04') {
                if (agent.id.includes('UGV') || agent.id.includes('HUM')) {
                    endX = startX + 300; endY = startY; isStraight = true; // Recorre todo el pasillo
                } else {
                    endX = startX; endY = startY + 300; isStraight = true;
                }
            }
            else if (m.id === 'OFFSHORE-WIND-05') {
                endX = startX + 300; endY = startY - 150; isStraight = true;
            }
            else {
                endX = startX + 250; endY = startY; isStraight = true;
            }

            // Evitar que el destino se salga de la pantalla
            endX = Math.max(20, Math.min(cw - 20, endX));
            endY = Math.max(20, Math.min(ch - 20, endY));

            if (isStraight) { cX = (startX + endX) / 2; cY = (startY + endY) / 2; }

            agent.pathParams = { 
                p0: {x: startX, y: startY}, p1: {x: cX, y: cY}, p2: {x: endX, y: endY},
                t: 0, dir: 1
            };
            agent.posX = startX; agent.posY = startY;
        }

        // VELOCIDAD REDUCIDA AL 40% (0.0008 en vez de 0.002)
        var canMove = typeof telemetryActive !== 'undefined' && telemetryActive && !emergencyStopped && m.status === 'running' && agent.state === 'running';
        
        if (canMove) {
            agent.pathParams.t += 0.0008 * agent.pathParams.dir; // <-- AQUÍ SE CONTROLA LA VELOCIDAD
            
            if (agent.pathParams.t >= 1) { agent.pathParams.t = 1; agent.pathParams.dir = -1; }
            if (agent.pathParams.t <= 0) { agent.pathParams.t = 0; agent.pathParams.dir = 1; }

            var t = agent.pathParams.t; var pp = agent.pathParams;
            agent.posX = Math.pow(1-t, 2)*pp.p0.x + 2*(1-t)*t*pp.p1.x + Math.pow(t, 2)*pp.p2.x;
            agent.posY = Math.pow(1-t, 2)*pp.p0.y + 2*(1-t)*t*pp.p1.y + Math.pow(t, 2)*pp.p2.y;
            agent.x = (agent.posX / cw) * 100; agent.y = (agent.posY / ch) * 100;
        }

        // DIBUJAR LA RUTA
        if (agent.state === 'running' || agent.state === 'planned') {
            var colorPath = agent.state === 'running' ? 'rgba(0, 255, 157, 0.3)' : 'rgba(255, 170, 0, 0.3)';
            var colorAccent = agent.state === 'running' ? '#00ff9d' : '#ffaa00';
            var pp = agent.pathParams;

            ctx.beginPath(); ctx.moveTo(pp.p0.x, pp.p0.y); ctx.quadraticCurveTo(pp.p1.x, pp.p1.y, pp.p2.x, pp.p2.y);
            ctx.strokeStyle = colorPath; ctx.lineWidth = 4; ctx.stroke();

            ctx.beginPath(); ctx.moveTo(pp.p0.x, pp.p0.y); ctx.quadraticCurveTo(pp.p1.x, pp.p1.y, pp.p2.x, pp.p2.y);
            ctx.strokeStyle = colorAccent; ctx.lineWidth = 1; ctx.setLineDash([5, 8]); ctx.stroke(); ctx.setLineDash([]);

            ctx.fillStyle = colorAccent; ctx.beginPath(); ctx.arc(pp.p2.x, pp.p2.y, 4, 0, Math.PI*2); ctx.fill();
            ctx.font = "8px 'Share Tech Mono'"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText("DEST", pp.p2.x, pp.p2.y - 8);
        }
    });

    // 4. DIBUJAR AGENTES
    m.agents.forEach(function(agent) {
        var displayState = (typeof emergencyStopped !== 'undefined' && emergencyStopped) ? 'blocked' : agent.state;
        var isSelected = (selectedAgent && selectedAgent.id === agent.id);
        drawAgentIcon(agent.posX, agent.posY, agent.id, displayState, agent.icon, isSelected);
        agentHitboxes.push({ x: agent.posX, y: agent.posY, agent: agent });
    });

    if (selectedAgent) drawAgentTooltip(selectedAgent);
}

// ── UTILIDADES ──────────────────────────────────────────────
function drawAgentIcon(x, y, id, state, iconEmoji, isSelected) {
    var color = state === 'running' ? '#00ff9d' : (state === 'blocked' ? '#ff2a2a' : '#00d4ff');
    if (state === 'planned') color = '#ffaa00';

    if (state === 'running' || isSelected) {
        ctx.beginPath(); ctx.arc(x, y, (isSelected ? 20 : 16) + Math.sin(Date.now()/200)*3, 0, Math.PI*2);
        ctx.strokeStyle = isSelected ? "#fff" : "rgba(0, 255, 157, 0.15)"; ctx.lineWidth = isSelected ? 2 : 1; ctx.stroke();
    }
    ctx.fillStyle = "rgba(2, 6, 9, 0.9)"; ctx.fillRect(x - 12, y - 12, 24, 24);
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.strokeRect(x - 12, y - 12, 24, 24);
    ctx.fillStyle = "#fff"; ctx.font = "12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(iconEmoji || '●', x, y);
    ctx.fillStyle = "rgba(2, 6, 9, 0.9)"; ctx.fillRect(x - 25, y + 16, 50, 14);
    ctx.strokeStyle = color; ctx.lineWidth = 0.5; ctx.strokeRect(x - 25, y + 16, 50, 14);
    ctx.fillStyle = color; ctx.font = "bold 9px 'Share Tech Mono'"; ctx.fillText(id, x, y + 23);
}

function drawAgentTooltip(agent) {
    var boxW = 180; var boxH = 95;
    var x = agent.posX + 25; var y = agent.posY - 40;
    if (x + boxW > mapCanvas.width) x = agent.posX - boxW - 25;
    if (y < 0) y = 10;

    ctx.fillStyle = "rgba(2, 6, 9, 0.95)"; ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = "#00d4ff"; ctx.lineWidth = 1; ctx.strokeRect(x, y, boxW, boxH);
    ctx.fillStyle = "rgba(0, 212, 255, 0.1)"; ctx.fillRect(x, y, boxW, 20);
    ctx.fillStyle = "#00d4ff"; ctx.font = "bold 11px 'Share Tech Mono'"; ctx.textAlign = "left"; ctx.fillText("AGENT: " + agent.id, x + 8, y + 14);
    ctx.fillStyle = "#fff"; ctx.font = "10px 'Share Tech Mono'"; ctx.fillText("TYPE:  " + (agent.type || "UNKNOWN").toUpperCase(), x + 8, y + 35);
    
    var stateColor = agent.state === 'running' ? '#00ff9d' : (agent.state === 'blocked' ? '#ff2a2a' : '#ffaa00');
    ctx.fillText("STATE: ", x + 8, y + 50); ctx.fillStyle = stateColor; ctx.fillText(agent.state.toUpperCase(), x + 45, y + 50);
    ctx.fillStyle = "#fff"; ctx.fillText("BATT:  " + (agent.battery !== null ? agent.battery + "%" : "N/A"), x + 8, y + 65);
    var task = agent.task || "Standby"; if(task.length > 25) task = task.substring(0, 25) + "...";
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fillText("TASK:  " + task, x + 8, y + 80);
}