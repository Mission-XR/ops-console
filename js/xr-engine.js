/* ============================================================
   xr-engine.js — WebXR Engine (Scenario 2)
   Handles: VR/AR mode, A-Frame scene init, asset loading,
            headset recenter, browser compatibility check
   ============================================================ */

// ── WebXR Support Check ──────────────────────────────────────
function checkXRSupport() {
  if (!navigator.xr) {
    showToast('WebXR not supported in this browser');
    return false;
  }
  navigator.xr.isSessionSupported('immersive-vr').then(function(supported) {
    if (supported) {
      showToast('VR headset detected — ready');
      document.querySelectorAll('.map-btn').forEach(function(btn) {
        if (btn.textContent === 'VR') {
          btn.style.borderColor = 'var(--accent2)';
          btn.style.color = 'var(--accent2)';
        }
      });
    } else {
      showToast('No VR headset detected — running in 2D mode');
    }
  });
  return true;
}

// ── Asset Loading Progress ───────────────────────────────────
var assetsLoaded = 0;
var assetsTotal  = 0;

function loadAssets(assetList, onComplete) {
  assetsTotal  = assetList.length;
  assetsLoaded = 0;

  if (assetsTotal === 0) { onComplete(); return; }

  assetList.forEach(function(url) {
    fetch(url)
      .then(function() {
        assetsLoaded++;
        var progress = Math.round((assetsLoaded / assetsTotal) * 100);
        showToast('Loading assets: ' + progress + '%');
        if (assetsLoaded === assetsTotal) onComplete();
      })
      .catch(function() {
        assetsLoaded++;
        if (assetsLoaded === assetsTotal) onComplete();
      });
  });
}

// ── Enter VR Mode ────────────────────────────────────────────
function enterVR() {
  if (!navigator.xr) {
    showToast('WebXR not available — use Chrome on Meta Quest');
    return;
  }
  navigator.xr.requestSession('immersive-vr', {
    requiredFeatures: ['local-floor'],
    optionalFeatures: ['hand-tracking']
  }).then(function(session) {
    showToast('VR session started');
    // TODO: connect A-Frame scene here
  }).catch(function(err) {
    showToast('VR session failed: ' + err.message);
  });
}

// ── Enter AR Mode ────────────────────────────────────────────
function enterAR() {
  if (!navigator.xr) {
    showToast('WebXR not available');
    return;
  }
  navigator.xr.isSessionSupported('immersive-ar').then(function(supported) {
    if (!supported) { showToast('AR not supported on this device'); return; }
    navigator.xr.requestSession('immersive-ar').then(function(session) {
      showToast('AR session started');
      // TODO: connect A-Frame AR scene here
    });
  });
}

// ── Recenter / Calibrate ─────────────────────────────────────
function recenterXR() {
  // Called when user presses recenter button on Meta Quest
  showToast('Recentering XR view...');
  // TODO: implement reference space recenter
}

// ── Init ─────────────────────────────────────────────────────
checkXRSupport();
