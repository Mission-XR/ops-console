// ============================================================
//  TELEMETRY — Motor de Datos y Control de Emergencia
// ============================================================
var telemetryActive = true;
var emergencyStopped = false;

function startTelemetry() {
    console.log("Telemetry engine online.");
    
    setInterval(function() {
        if (!telemetryActive || emergencyStopped) return;
        if (typeof currentMission === 'undefined' || typeof MISSIONS === 'undefined') return;
        
        var m = MISSIONS[currentMission];
        if (!m || !m.context) return;

        // Simulación de fluctuación de datos realistas
        m.context.forEach(function(c) {
            var key = c.key.toUpperCase();
            if (key.includes('BATT') || key.includes('BATTERY')) {
                var val = parseInt(c.val);
                if (val > 1 && Math.random() > 0.8) c.val = (val - 1) + '%';
            }
            if (key.includes('SPEED') || key.includes('VEL') || key.includes('WIND')) {
                var val = parseFloat(c.val);
                c.val = (val + (Math.random() * 0.4 - 0.2)).toFixed(1) + ' m/s';
            }
        });

        if (typeof renderContext === 'function') renderContext();
    }, 2000);
}

// FUNCIÓN CRÍTICA: Se activa desde el botón rojo en auth.js
function triggerEmergencyStop() {
    if (emergencyStopped) return;
    emergencyStopped = true;
    telemetryActive = false;

    // A. Registrar el evento en ROJO en la lista de eventos
    if (typeof addLiveEvent === 'function') {
        addLiveEvent(currentMission, '⚠ EMERGENCY STOP: ALL SYSTEMS HALTED', 'danger', 'SUPERVISOR');
    }

    // B. Resetear todas las velocidades a 0.0 en todas las misiones
    if (typeof MISSIONS !== 'undefined') {
        MISSIONS.forEach(function(m) {
            if (m.context) {
                m.context.forEach(function(c) {
                    var key = c.key.toUpperCase();
                    if (key.includes('SPEED') || key.includes('VEL') || key.includes('WIND')) {
                        c.val = '0.0 m/s';
                        c.cls = 'danger'; // Esto hace que el texto se vea rojo en el panel
                    }
                });
            }
        });
    }

    // C. Actualizar visualmente los paneles
    if (typeof renderContext === 'function') renderContext();
    if (typeof renderEvents === 'function') renderEvents();
    if (typeof showToast === 'function') showToast('SYSTEM WIDE HALT ACTIVATED');
}

setTimeout(startTelemetry, 3000);