/* ============================================================
   auth.js — Authentication & RBAC (Scenario 1)
   Handles: login, logout, role-based access control
   Roles: VIEWER / OPERATOR / SUPERVISOR
   ============================================================ */

// ============================================================
//  AUTH
// ============================================================
var USERS = {
  'supervisor@ops.net': { password:'super123', role:'SUPERVISOR' },
  'operator@ops.net':   { password:'oper123',  role:'OPERATOR'   },
  'viewer@ops.net':     { password:'view123',  role:'VIEWER'     },
};
var failedAttempts = 0, blockedUntil = null;
var currentRole = 'OPERATOR', currentMission = 0;
var currentOverrideEvent = null;

document.getElementById('demo-sup').onclick  = function(){ fillDemo('supervisor@ops.net','super123'); };
document.getElementById('demo-op').onclick   = function(){ fillDemo('operator@ops.net','oper123'); };
document.getElementById('demo-view').onclick = function(){ fillDemo('viewer@ops.net','view123'); };
document.getElementById('btn-login').onclick = handleLogin;
document.addEventListener('keydown', function(e){ if(e.key==='Enter') handleLogin(); });

function fillDemo(u,p){ document.getElementById('input-user').value=u; document.getElementById('input-pass').value=p; hideAlert(); }
function showAlert(m,t){ var b=document.getElementById('alert-box'); b.textContent=m; b.className='alert '+(t||'danger')+' show'; }
function hideAlert(){ document.getElementById('alert-box').className='alert danger'; }

function handleLogin() {
  if(blockedUntil&&Date.now()<blockedUntil){ var s=Math.ceil((blockedUntil-Date.now())/1000); showAlert('Too many attempts. Wait '+s+'s.','warn'); return; }
  var u=document.getElementById('input-user').value.trim();
  var p=document.getElementById('input-pass').value;
  hideAlert();
  document.getElementById('err-user').className='field-error';
  document.getElementById('err-pass').className='field-error';
  if(!u){ document.getElementById('err-user').className='field-error show'; return; }
  if(!p){ document.getElementById('err-pass').className='field-error show'; return; }
  var btn=document.getElementById('btn-login');
  btn.disabled=true; btn.classList.add('loading');
  setTimeout(function(){ authenticate(u,p,btn); }, 1200);
}

function authenticate(u,p,btn) {
  var ud=USERS[u];
  if(!ud||ud.password!==p){
    failedAttempts++;
    btn.disabled=false; btn.classList.remove('loading');
    if(failedAttempts>=3){ blockedUntil=Date.now()+30000; showAlert('Blocked 30 seconds.','warn'); }
    else showAlert('Incorrect credentials.','danger');
    return;
  }
  failedAttempts=0; currentRole=ud.role;
  showAlert('Access granted — Role: '+ud.role,'info');
  setTimeout(function(){ showDashboard(ud.role,u); }, 800);
}

function showDashboard(role, user) {
  // Save session to localStorage for console.html to read
  try {
    sessionStorage.setItem('ops_role', role);
    sessionStorage.setItem('ops_user', user);
  } catch(e) {}
  // Redirect to console
  window.location.href = 'console.html';
}

function doLogout() {
  document.getElementById('dashboard-screen').style.display='none';
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('input-user').value='';
  document.getElementById('input-pass').value='';
  document.getElementById('btn-login').disabled=false;
  document.getElementById('btn-login').classList.remove('loading');
  hideAlert();
}

