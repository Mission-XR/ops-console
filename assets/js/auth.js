// ============================================================
//  AUTH — Login, logout, RBAC logic
// ============================================================

// Variable global para controlar la pausa del sistema sin romper datos
window.emergencyStopped = false;

var USERS = {
  'supervisor@ops.net': { password:'super123', role:'SUPERVISOR' },
  'operator@ops.net':   { password:'oper123',  role:'OPERATOR'   },
  'viewer@ops.net':     { password:'view123',  role:'VIEWER'     },
};

var failedAttempts = 0;
var blockedUntil   = null;
var currentRole    = 'OPERATOR';

// 1. COMPROBAR SESIÓN AL CARGAR LA PÁGINA (Persistencia)
window.onload = function() {
  var savedSession = localStorage.getItem('ops_user_session');
  if (savedSession) {
    var sessionData = JSON.parse(savedSession);
    showDashboard(sessionData.role, sessionData.user);
  }
};

document.getElementById('demo-sup').onclick  = function(){ fillDemo('supervisor@ops.net','super123'); };
document.getElementById('demo-op').onclick   = function(){ fillDemo('operator@ops.net','oper123'); };
document.getElementById('demo-view').onclick = function(){ fillDemo('viewer@ops.net','view123'); };
document.getElementById('btn-login').onclick = handleLogin;
document.addEventListener('keydown', function(e){ if(e.key==='Enter') handleLogin(); });

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
  setTimeout(function(){ authenticate(u, p, btn); }, 1200);
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
  showAlert('Access granted — Role: ' + ud.role, 'info');

  // GUARDAR SESIÓN EN LOCALSTORAGE
  localStorage.setItem('ops_user_session', JSON.stringify({ user: u, role: ud.role }));

  setTimeout(function(){ showDashboard(ud.role, u); }, 800);
}

// ============================================================
// HITO 2: LA PANTALLA DE CARGA AL 100%
// ============================================================
function showDashboard(role, user) {
  // 1. Ocultar login
  document.getElementById('login-screen').style.display = 'none';
  
  // 2. Mostrar la pantalla negra de carga que metimos en el HTML
  var loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'flex';
  }

  var progress = 0;
  var bar = document.getElementById('loader-bar');
  var txt = document.getElementById('loader-text');

  // 3. Animación: hacer que los números suban hasta 100
  var interval = setInterval(function() {
    progress += Math.floor(Math.random() * 15) + 5; // Sube a saltos
    
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      
      // Cuando llega a 100, espera medio segundo, oculta la carga y te deja entrar al panel
      setTimeout(function() {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        
        var d = document.getElementById('dashboard-screen');
        d.style.display = 'flex';
        
        currentRole = role;
        document.getElementById('role-badge').textContent = role;
        document.getElementById('user-avatar').textContent = user.charAt(0).toUpperCase();
        
        applyRoleUI(role);
        initDashboard();

        // --- ACTUALIZAR CHAT AL ENTRAR SEGÚN EL ROL ---
        if (typeof updateChatUI === 'function') updateChatUI();

      }, 500); 
    }
    
    // Actualizar visualmente la barra y el porcentaje
    if (bar) bar.style.width = progress + '%';
    if (txt) txt.textContent = 'LOADING ASSETS... ' + progress + '%';
  }, 100); 
}

function applyRoleUI(role) {
  var eStop = document.getElementById('btn-emergency-stop');
  if (eStop) eStop.remove();

  if (role === 'SUPERVISOR') {
    var btn = document.createElement('button');
    btn.id = 'btn-emergency-stop';
    
    // Función para pintar el botón rojo o naranja según si hay pausa o no
    function updateBtnStyle() {
        if (window.emergencyStopped) {
            btn.innerHTML = '▶ RESUME SYSTEM';
            btn.style.cssText = 'background: #ffaa00; color: white; border: none; padding: 4px 12px; margin-right: 15px; cursor: pointer; font-weight: bold; font-family: "Share Tech Mono", monospace; letter-spacing: 1px; border-radius: 2px;';
        } else {
            btn.innerHTML = '⚠ EMERGENCY STOP';
            btn.style.cssText = 'background: #ff2a2a; color: white; border: none; padding: 4px 12px; margin-right: 15px; cursor: pointer; font-weight: bold; font-family: "Share Tech Mono", monospace; letter-spacing: 1px; border-radius: 2px;';
        }
    }
    
    updateBtnStyle(); // Pintar el botón la primera vez
    
    // Al hacer clic, simplemente encendemos o apagamos la "Pausa Global"
    btn.onclick = function() { 
      if (window.emergencyStopped) {
        if (confirm('ALL CLEAR?\nResume normal operations?')) {
          window.emergencyStopped = false; // QUITAMOS LA PAUSA
          updateBtnStyle();
          if (typeof addLiveEvent === 'function') addLiveEvent(currentMission, 'Emergency lifted. Resuming operations.', 'ok', 'SUPERVISOR');
        }
      } 
      else {
        if (confirm('CONFIRM CRITICAL SYSTEM HALT?\nThis action will stop all agents immediately.')) {
          window.emergencyStopped = true; // PONEMOS LA PAUSA
          updateBtnStyle();
          if (typeof addLiveEvent === 'function') addLiveEvent(currentMission, 'CRITICAL HALT initiated.', 'danger', 'SUPERVISOR');
        }
      }
    };
    document.querySelector('.topbar-right').prepend(btn);
  }

  var viewerStyles = document.getElementById('viewer-styles');
  if (viewerStyles) viewerStyles.remove();

  if (role === 'VIEWER') {
    var style = document.createElement('style');
    style.id = 'viewer-styles';
    style.innerHTML = '.ack-btn { opacity: 0.3 !important; pointer-events: none !important; }';
    document.head.appendChild(style);
  }
}

function doLogout() {
  localStorage.removeItem('ops_user_session');

  document.getElementById('dashboard-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('input-user').value = '';
  document.getElementById('input-pass').value = '';
  document.getElementById('btn-login').disabled = false;
  document.getElementById('btn-login').classList.remove('loading');
  hideAlert();

  var eStop = document.getElementById('btn-emergency-stop');
  if (eStop) eStop.remove();
  var viewerStyles = document.getElementById('viewer-styles');
  if (viewerStyles) viewerStyles.remove();

  // Resetear la emergencia por si salen con ella puesta
  window.emergencyStopped = false;

  // --- ACTUALIZAR CHAT AL SALIR ---
  currentRole = null;
  if (typeof updateChatUI === 'function') updateChatUI();
}