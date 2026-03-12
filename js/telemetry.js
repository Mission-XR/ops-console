/* ============================================================
   telemetry.js — Live Telemetry (Scenario 3)
   Simulates real-time agent data: battery, altitude, speed,
   signal strength, GPS position updates
   ============================================================ */

var telemetryInterval = null;
var telemetryData = {};

// ── Initialize telemetry for current mission ─────────────────
function initTelemetry(missionIdx) {
  stopTelemetry();

  var agents = MISSIONS[missionIdx].agents;
  agents.forEach(function(ag) {
    telemetryData[ag.id] = {
      battery:  ag.battery || 100,
      altitude: ag.type === 'Unmanned Aerial System' ? Math.round(40 + Math.random()*60) : 0,
      speed:    ag.state === 'running' ? Math.round(5 + Math.random()*15) : 0,
      signal:   Math.round(80 + Math.random()*20),
      lat:      47.3769 + (Math.random()-0.5)*0.01,
      lon:      15.0908 + (Math.random()-0.5)*0.01,
    };
  });

  // Update every 3 seconds
  telemetryInterval = setInterval(function() {
    updateTelemetry(missionIdx);
  }, 3000);
}

// ── Update telemetry values with realistic drift ─────────────
function updateTelemetry(missionIdx) {
  var agents = MISSIONS[missionIdx].agents;
  agents.forEach(function(ag) {
    if (!telemetryData[ag.id]) return;
    var t = telemetryData[ag.id];

    // Battery drains slowly if running
    if (ag.state === 'running' && t.battery > 0) {
      t.battery = Math.max(0, t.battery - (Math.random() * 0.3));
    }

    // Altitude fluctuates for aerial agents
    if (ag.type === 'Unmanned Aerial System' && ag.state === 'running') {
      t.altitude = Math.max(0, t.altitude + (Math.random()-0.5)*5);
      t.speed    = Math.max(0, t.speed + (Math.random()-0.5)*3);
    }

    // Signal strength varies
    t.signal = Math.min(100, Math.max(40, t.signal + (Math.random()-0.5)*5));

    // GPS drift
    t.lat += (Math.random()-0.5)*0.0001;
    t.lon += (Math.random()-0.5)*0.0001;

    // Sync battery back to agent
    ag.battery = Math.round(t.battery);

    // Warn if battery critical
    if (ag.battery < 20 && ag.battery > 18) {
      addLiveEvent(missionIdx,
        ag.id + ' battery CRITICAL: ' + ag.battery + '% — return to base',
        'critical', ag.id
      );
    }
  });

  // Update context panel if this is the current mission
  if (missionIdx === currentMission) {
    renderContext();
  }
}

// ── Get telemetry for a specific agent ───────────────────────
function getAgentTelemetry(agentId) {
  return telemetryData[agentId] || null;
}

// ── Stop telemetry ───────────────────────────────────────────
function stopTelemetry() {
  if (telemetryInterval) {
    clearInterval(telemetryInterval);
    telemetryInterval = null;
  }
}
