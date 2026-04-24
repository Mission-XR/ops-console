// ============================================================
//  AUTH — Login, logout, RBAC (refactored: no simulation)
// ============================================================

var USERS = {
  'supervisor@ops.net': { password: 'super123', role: 'SUPERVISOR' },
  'operator@ops.net':   { password: 'oper123',  role: 'OPERATOR' },
  'viewer@ops.net':     { password: 'view123',  role: 'VIEWER' },
};

var failedAttempts = 0;
var blockedUntil   = null;
var currentRole    = '';
var currentUser    = '';
var emergencyStopped = false;

// ── Startup: check session ─────────────────────────────────
window.onload = function () {
  var saved = localStorage.getItem('ops_user_session');
  if (saved) {
    var s = JSON.parse(saved);
    showDashboard(s.role, s.user);
  }
};

// ── Demo autofill buttons ──────────────────────────────────
document.getElementById('demo-sup').onclick  = function () { fillDemo('supervisor@ops.net', 'super123'); };
document.getElementById('demo-op').onclick   = function () { fillDemo('operator@ops.net',   'oper123'); };
document.getElementById('demo-view').onclick = function () { fillDemo('viewer@ops.net',     'view123'); };
document.getElementById('btn-login').onclick = handleLogin;
document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') handleLogin();
});

function fillDemo(u, p) {
  document.getElementById('input-user').value = u;
  document.getElementById('input-pass').value = p;
  hideAlert();
}

function showAlert(m, t) {
  var b = document.getElementById('alert-box');
  b.textContent = m;
  b.className = 'alert ' + (t || 'danger') + ' show';
}
function hideAlert() {
  document.getElementById('alert-box').className = 'alert danger';
}

function handleLogin() {
  if (blockedUntil && Date.now() < blockedUntil) {
    var s = Math.ceil((blockedUntil - Date.now()) / 1000);
    showAlert('Too many attempts. Wait ' + s + 's.', 'warn');
    return;
  }
  var u = document.getElementById('input-user').value.trim();
  var p = document.getElementById('input-pass').value;
  hideAlert();
  document.getElementById('err-user').className = 'field-error';
  document.getElementById('err-pass').className = 'field-error';
  if (!u) { document.getElementById('err-user').className = 'field-error show'; return; }
  if (!p) { document.getElementById('err-pass').className = 'field-error show'; return; }

  var btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.classList.add('loading');
  setTimeout(function () { authenticate(u, p, btn); }, 800);
}

function authenticate(u, p, btn) {
  var ud = USERS[u];
  if (!ud || ud.password !== p) {
    failedAttempts++;
    btn.disabled = false;
    btn.classList.remove('loading');
    if (failedAttempts >= 3) {
      blockedUntil = Date.now() + 30000;
      showAlert('Blocked 30 seconds.', 'warn');
    } else {
      showAlert('Incorrect credentials.', 'danger');
    }
    return;
  }
  failedAttempts = 0;
  currentRole = ud.role;
  currentUser = u;
  showAlert('Access granted — Role: ' + ud.role, 'info');
  localStorage.setItem('ops_user_session', JSON.stringify({ user: u, role: ud.role }));
  setTimeout(function () { showDashboard(ud.role, u); }, 600);
}

// ── Loading screen → Dashboard ─────────────────────────────
function showDashboard(role, user) {
  document.getElementById('login-screen').style.display = 'none';

  var overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'flex';

  var progress = 0;
  var bar = document.getElementById('loader-bar');
  var txt = document.getElementById('loader-text');

  var interval = setInterval(function () {
    progress += Math.floor(Math.random() * 15) + 5;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      setTimeout(function () {
        if (overlay) overlay.style.display = 'none';
        document.getElementById('dashboard-screen').style.display = 'flex';

        currentRole = role;
        currentUser = user;
        document.getElementById('role-badge').textContent = role;
        document.getElementById('user-avatar').textContent = user.charAt(0).toUpperCase();

        applyRoleUI(role);
        initDashboard();
        updateChatUI();

        // Connect WebSocket AFTER dashboard is visible
        WS.connect();
        // Announce ourselves once connected
        setTimeout(function () {
          WS.send({ type: 'login', user: user, role: role });
        }, 500);
      }, 400);
    }
    if (bar) bar.style.width = progress + '%';
    if (txt) txt.textContent = 'LOADING ASSETS... ' + progress + '%';
  }, 80);
}

// ── Role-specific UI (emergency stop for Supervisor) ───────
function applyRoleUI(role) {
  var old = document.getElementById('btn-emergency-stop');
  if (old) old.remove();

  if (role === 'SUPERVISOR') {
    var btn = document.createElement('button');
    btn.id = 'btn-emergency-stop';
    updateEmergencyButtonStyle(btn);

    btn.onclick = function () {
      if (emergencyStopped) {
        if (confirm('ALL CLEAR?\nResume normal operations?')) {
          WS.send({ type: 'emergency', action: 'resume', missionIdx: currentMission });
        }
      } else {
        if (confirm('CONFIRM CRITICAL SYSTEM HALT?\nThis will stop all agents.')) {
          WS.send({ type: 'emergency', action: 'stop', missionIdx: currentMission });
        }
      }
    };
    document.querySelector('.topbar-right').prepend(btn);
  }

  var vs = document.getElementById('viewer-styles');
  if (vs) vs.remove();
  if (role === 'VIEWER') {
    var style = document.createElement('style');
    style.id = 'viewer-styles';
    style.innerHTML = '.ack-btn { opacity: 0.3 !important; pointer-events: none !important; }';
    document.head.appendChild(style);
  }
}

function updateEmergencyButton() {
  var btn = document.getElementById('btn-emergency-stop');
  if (btn) updateEmergencyButtonStyle(btn);
}

function updateEmergencyButtonStyle(btn) {
  if (emergencyStopped) {
    btn.innerHTML = '▶ RESUME SYSTEM';
    btn.style.cssText = 'background:#ffaa00;color:white;border:none;padding:4px 12px;margin-right:15px;cursor:pointer;font-weight:bold;font-family:"Share Tech Mono",monospace;letter-spacing:1px;border-radius:2px;';
  } else {
    btn.innerHTML = '⚠ EMERGENCY STOP';
    btn.style.cssText = 'background:#ff2a2a;color:white;border:none;padding:4px 12px;margin-right:15px;cursor:pointer;font-weight:bold;font-family:"Share Tech Mono",monospace;letter-spacing:1px;border-radius:2px;';
  }
}

// ── Logout ─────────────────────────────────────────────────
function doLogout() {
  localStorage.removeItem('ops_user_session');
  if (WS.socket) WS.socket.close();
  document.getElementById('dashboard-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('input-user').value = '';
  document.getElementById('input-pass').value = '';
  document.getElementById('btn-login').disabled = false;
  document.getElementById('btn-login').classList.remove('loading');
  hideAlert();
  var es = document.getElementById('btn-emergency-stop');
  if (es) es.remove();
  var vs = document.getElementById('viewer-styles');
  if (vs) vs.remove();
  currentRole = '';
  currentUser = '';
  emergencyStopped = false;
  updateChatUI();
}
