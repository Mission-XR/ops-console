// ============================================================
//  MAP — Radar Canvas & 2D Navigation (FIXED POSITIONS)
// ============================================================
var mapCanvas, ctx;

function initCanvas() {
    mapCanvas = document.getElementById('map-canvas');
    if (!mapCanvas) return;
    ctx = mapCanvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    function mapLoop() {
        renderAgents();
        requestAnimationFrame(mapLoop);
    }
    mapLoop();
}

function resizeCanvas() {
    if (!mapCanvas) return;
    mapCanvas.width = mapCanvas.parentElement.clientWidth;
    mapCanvas.height = mapCanvas.parentElement.clientHeight;
    
    // Al redimensionar la pantalla, reseteamos las posiciones para que se ajusten
    if (typeof MISSIONS !== 'undefined') {
        MISSIONS.forEach(m => {
            m.agents.forEach(a => { a.posX = undefined; a.posY = undefined; });
        });
    }
}

function renderAgents() {
    if (!ctx || !mapCanvas || mapCanvas.style.display === 'none') return;
    ctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    
    var m = MISSIONS[currentMission];
    if (!m || !m.agents) return;

    m.agents.forEach(function(agent) {
        // LEER COORDENADAS DE DATA.JS: agent.x y agent.y son porcentajes (0 a 100)
        if (agent.posX === undefined) {
            // Repartirlos por el mapa usando sus coordenadas originales
            var xPercent = agent.x || 50; 
            var yPercent = agent.y || 50;
            agent.posX = (xPercent / 100) * mapCanvas.width;
            agent.posY = (yPercent / 100) * mapCanvas.height;
        }

        // MOVIMIENTO: Solo si la misión está activa y NO hay emergencia
        if (typeof emergencyStopped !== 'undefined' && !emergencyStopped && m.status === 'running') {
            agent.posX += (Math.random() * 0.4 - 0.2);
            agent.posY += (Math.random() * 0.4 - 0.2);
        }

        drawAgentIcon(agent.posX, agent.posY, agent.id, agent.type);
    });
}

function drawAgentIcon(x, y, id, type) {
    var color = type === 'uav' ? '#00ff9d' : '#00aaff';
    
    // Círculo de pulso (Efecto radar)
    ctx.beginPath();
    ctx.arc(x, y, 8 + Math.sin(Date.now()/500)*2, 0, Math.PI*2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Punto central del agente
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI*2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.stroke();

    // Texto del ID
    ctx.fillStyle = "#fff";
    ctx.font = "10px 'Share Tech Mono'";
    ctx.fillText(id, x + 8, y - 8);
}