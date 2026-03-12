/* ============================================================
   main.js — REPARADO Y BLINDADO
   ============================================================ */

var APP_VERSION = 'v0.2.0';
var APP_NAME    = 'OPS CONSOLE — Mission XR';

// 1. RECUPERAMOS LAS VARIABLES GLOBALES PERDIDAS
var currentRole = 'OPERATOR';
var currentMission = 0;
var currentOverrideEvent = null;

// 2. RECUPERAMOS LA FUNCIÓN DE NOTIFICACIONES (Evita que xr-engine.js rompa todo)
function showToast(msg) {
  var t = document.getElementById('toast');
  if(!t) { 
    console.log("Sistema:", msg); 
    return; 
  }
  t.textContent = msg;
  t.className = 'show'; // Asegúrate de tener una clase .show para #toast en tu CSS
  setTimeout(function(){ t.className = ''; }, 3000);
}

// 3. FUNCIÓN DE LOGOUT INDEPENDIENTE
function doLogout() {
  if (typeof stopTelemetry === 'function') stopTelemetry();
  sessionStorage.removeItem('ops_role');
  sessionStorage.removeItem('ops_user');
  window.location.href = 'index.html';
}

// 4. CONECTAMOS LA TELEMETRÍA DE FORMA SEGURA
var _originalInitDashboard = window.initDashboard || function(){};
window.initDashboard = function() {
  _originalInitDashboard();
  if (typeof initTelemetry === 'function') initTelemetry(currentMission);
};

var _originalSelectMission = window.selectMission || function(){};
window.selectMission = function(idx, tabEl) {
  _originalSelectMission(idx, tabEl);
  if (typeof stopTelemetry === 'function') stopTelemetry();
  if (typeof initTelemetry === 'function') initTelemetry(idx);
};

// 5. ARRANQUE PRINCIPAL AL CARGAR LA PÁGINA
document.addEventListener('DOMContentLoaded', function() {
  // Leemos la "llave" del usuario
  var role = sessionStorage.getItem('ops_role');
  var user = sessionStorage.getItem('ops_user');

  // Si alguien intenta entrar directo a console.html sin login, lo echamos
  if (!role || !user) {
    window.location.href = 'index.html';
    return;
  }

  // Aplicamos los datos del usuario a la interfaz
  currentRole = role;
  var badge = document.getElementById('role-badge');
  if (badge) badge.textContent = role;

  var avatar = document.getElementById('user-avatar');
  if (avatar) avatar.textContent = user.charAt(0).toUpperCase();

  document.querySelectorAll('.role-opt').forEach(function(b) {
    b.classList.toggle('active', b.textContent === role);
  });

  // 6. ¡FORZAMOS LA LUZ! ENCENDEMOS LA CONSOLA (Quita la pantalla negra)
  var dash = document.getElementById('dashboard-screen');
  if (dash) {
    dash.style.display = 'flex'; // Enciende la interfaz
  }

  // Arrancamos los botones del mapa (2D / VR)
  var mapBtns = document.querySelectorAll('.map-btn');
  mapBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      mapBtns.forEach(function(b){ b.classList.remove('active-view'); });
      btn.classList.add('active-view');
      var mode = btn.textContent.trim();
      if      (mode === 'VR')   { if(typeof enterVR === 'function') enterVR(); }
      else if (mode === '3D/AR'){ if(typeof enterAR === 'function') enterAR(); }
      else showToast('2D Map view active');
    });
  });

  // Ponemos la versión
  var versionEl = document.querySelector('.version');
  if (versionEl) versionEl.textContent = APP_VERSION + ' — PROTOTYPE';

  // ¡QUE EMPIECE LA MISIÓN!
  initDashboard();
});