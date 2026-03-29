// ============================================================
//  MAP — Radar Canvas 2D (PROYECCIÓN + INTERACTIVIDAD + RUTAS)
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
                a.posX = undefined; a.posY = undefined; 
                a.targetX = undefined; a.targetY = undefined; // Resetear ruta al cambiar tamaño
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
        var dx = mouseX - box.x;
        var dy = mouseY - box.y;
        if (Math.sqrt(dx * dx + dy * dy) < 20) {
            selectedAgent = box.agent;
            clicked = true;
            break;
        }
    }

    if (clicked && typeof showToast === 'function') {
        showToast('Agent ' + selectedAgent.id + ' selected');
    }
}

function map3Dto2D(cx, cz, w, d) {
    var cw = mapCanvas.width;
    var ch = mapCanvas.height;
    return {
        x: ((cx - w/2 + 15) / 30) * cw,
        y: ((cz - d/2 + 15) / 30) * ch,
        w: (w / 30) * cw,
        h: (d / 30) * ch
    };
}

function drawBlueprintBox(cx, cz, w, d, label, r, g, b) {
    var rect = map3Dto2D(cx, cz, w, d);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.1)`;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    if (label) {
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.font = "bold 9px 'Share Tech Mono'";
        ctx.textAlign = "left";
        ctx.fillText(label, rect.x + 4, rect.y + 12);
    }
}

function renderTacticalMap() {
    if (!ctx || !mapCanvas || mapCanvas.style.display === 'none') return;
    ctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);

    var m = MISSIONS[currentMission];
    if (!m) return;

    var cw = mapCanvas.width;
    var ch = mapCanvas.height;

    // 1. DIBUJAR FONDO
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for(let i=30; i<cw; i+=30) { ctx.moveTo(i, 0); ctx.lineTo(i, ch); }
    for(let i=30; i<ch; i+=30) { ctx.moveTo(0, i); ctx.lineTo(cw, i); }
    ctx.stroke();

    // 2. DIBUJAR ZONAS
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
        var turbines = [[-8,-8],[0,-10],[8,-6],[10,2],[2,6]];
        ctx.fillStyle = "rgba(126, 184, 255, 0.5)";
        turbines.forEach((t, i) => {
            var pos = map3Dto2D(t[0], t[1], 1, 1);
            ctx.beginPath(); ctx.arc(pos.x + pos.w/2, pos.y + pos.h/2, 10, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#fff"; ctx.fillText("T"+(i+1), pos.x + pos.w/2 - 6, pos.y + pos.h/2 + 3);
        });
    }

    // --- ALARMA VISUAL DE EMERGENCY STOP ---
    if (typeof emergencyStopped !== 'undefined' && emergencyStopped) {
        ctx.fillStyle = "rgba(255, 42, 42, 0.15)";
        ctx.fillRect(0, 0, cw, ch); // Tiñe el mapa de rojo translúcido
        
        ctx.fillStyle = "#ff2a2a";
        ctx.font = "bold 20px 'Share Tech Mono'";
        ctx.textAlign = "center";
        
        // Efecto parpadeo cada medio segundo
        if (Math.floor(Date.now() / 500) % 2 === 0) {
            ctx.fillText("⚠ SYSTEM HALTED - EMERGENCY STOP ACTIVE ⚠", cw / 2, ch / 2 - 20);
        }
    }

    if (!m.agents) return;
    agentHitboxes = [];

    // 3. DIBUJAR RUTAS Y WAYPOINTS
    m.agents.forEach(function(agent) {
        if (agent.posX === undefined) {
            agent.posX = getPosX(agent);
            agent.posY = getPosY(agent);
            
            var offsetX = (agent.id.length % 2 === 0) ? 60 : -60;
            var offsetY = (agent.id.charCodeAt(0) % 2 === 0) ? 50 : -50;
            agent.targetX = Math.max(20, Math.min(cw - 20, agent.posX + offsetX));
            agent.targetY = Math.max(20, Math.min(ch - 20, agent.posY + offsetY));
        }

        if (agent.state === 'running' || agent.state === 'planned') {
            var pathColor = agent.state === 'running' ? 'rgba(0, 255, 157, 0.4)' : 'rgba(255, 170, 0, 0.4)';
            var markerColor = agent.state === 'running' ? '#00ff9d' : '#ffaa00';

            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = pathColor;
            ctx.lineWidth = 1;
            ctx.moveTo(agent.posX, agent.posY);
            ctx.lineTo(agent.targetX, agent.targetY);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = markerColor;
            ctx.font = "12px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("✕", agent.targetX, agent.targetY);
            ctx.font = "8px 'Share Tech Mono'";
            ctx.fillText("WP", agent.targetX, agent.targetY - 10);
        }
    });

    // 4. DIBUJAR AGENTES (Y MOVERLOS SI TOCA)
    m.agents.forEach(function(agent) {
        // Solo se mueven si NO hay emergencia, la misión está activa y el agente está corriendo
        if (typeof telemetryActive !== 'undefined' && telemetryActive && !emergencyStopped && m.status === 'running' && agent.state === 'running') {
            var dx = agent.targetX - agent.posX;
            var dy = agent.targetY - agent.posY;
            
            agent.posX += dx * 0.0025; 
            agent.posY += dy * 0.0025;
            
            // --- ¡NUEVO! SINCRONIZACIÓN 3D ---
            // Convertimos los píxeles del canvas a porcentajes globales (0 a 100)
            agent.x = (agent.posX / mapCanvas.width) * 100;
            agent.y = (agent.posY / mapCanvas.height) * 100;
        }

        // Si hay emergencia, pintamos a todos los agentes de rojo
        var displayState = emergencyStopped ? 'blocked' : agent.state;
        var isSelected = (selectedAgent && selectedAgent.id === agent.id);
        drawAgentIcon(agent.posX, agent.posY, agent.id, displayState, agent.icon, isSelected);
        
        agentHitboxes.push({ x: agent.posX, y: agent.posY, agent: agent });
    });

    if (selectedAgent) drawAgentTooltip(selectedAgent);
}

// ── UTILIDADES PARA AGENTES ──────────────────────────────────
function getPosX(agent) { return (agent.x / 100) * mapCanvas.width; }
function getPosY(agent) { return (agent.y / 100) * mapCanvas.height; }

function drawAgentIcon(x, y, id, state, iconEmoji, isSelected) {
    var color = state === 'running' ? '#00ff9d' : (state === 'blocked' ? '#ff2a2a' : '#00d4ff');
    if (state === 'planned') color = '#ffaa00';

    if (state === 'running' || isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, (isSelected ? 20 : 16) + Math.sin(Date.now()/200)*3, 0, Math.PI*2);
        ctx.strokeStyle = isSelected ? "#fff" : "rgba(0, 255, 157, 0.15)";
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();
    }

    ctx.fillStyle = "rgba(2, 6, 9, 0.9)";
    ctx.fillRect(x - 12, y - 12, 24, 24);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 12, y - 12, 24, 24);

    ctx.fillStyle = "#fff";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(iconEmoji || '●', x, y);

    ctx.fillStyle = "rgba(2, 6, 9, 0.9)";
    ctx.fillRect(x - 25, y + 16, 50, 14);
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x - 25, y + 16, 50, 14);

    ctx.fillStyle = color;
    ctx.font = "bold 9px 'Share Tech Mono'";
    ctx.fillText(id, x, y + 23);
}

function drawAgentTooltip(agent) {
    var boxW = 180;
    var boxH = 95;
    var x = agent.posX + 25;
    var y = agent.posY - 40;

    if (x + boxW > mapCanvas.width) x = agent.posX - boxW - 25;
    if (y < 0) y = 10;

    ctx.fillStyle = "rgba(2, 6, 9, 0.95)";
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = "#00d4ff";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, boxW, boxH);

    ctx.fillStyle = "rgba(0, 212, 255, 0.1)";
    ctx.fillRect(x, y, boxW, 20);
    ctx.fillStyle = "#00d4ff";
    ctx.font = "bold 11px 'Share Tech Mono'";
    ctx.textAlign = "left";
    ctx.fillText("AGENT: " + agent.id, x + 8, y + 14);

    ctx.fillStyle = "#fff";
    ctx.font = "10px 'Share Tech Mono'";
    ctx.fillText("TYPE:  " + (agent.type || "UNKNOWN").toUpperCase(), x + 8, y + 35);
    
    var stateColor = agent.state === 'running' ? '#00ff9d' : (agent.state === 'blocked' ? '#ff2a2a' : '#ffaa00');
    ctx.fillText("STATE: ", x + 8, y + 50);
    ctx.fillStyle = stateColor;
    ctx.fillText(agent.state.toUpperCase(), x + 45, y + 50);
    
    ctx.fillStyle = "#fff";
    ctx.fillText("BATT:  " + (agent.battery !== null ? agent.battery + "%" : "N/A"), x + 8, y + 65);
    
    var task = agent.task || "Standby";
    if(task.length > 25) task = task.substring(0, 25) + "...";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("TASK:  " + task, x + 8, y + 80);
}