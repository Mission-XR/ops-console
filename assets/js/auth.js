// ============================================================
//  AUTH — Login, logout, RBAC, session persistence
// ============================================================
var USERS = {
    'supervisor@ops.net': { password:'super123', role:'SUPERVISOR' },
    'operator@ops.net':   { password:'oper123',  role:'OPERATOR' },
    'viewer@ops.net':     { password:'view123',  role:'VIEWER' }
};

var failedAttempts = 0;
var blockedUntil   = null;
var currentRole    = '';
var currentUser    = '';
var emergencyStopped = false;

window.onload = function() {
    var saved = localStorage.getItem('ops_user_session');
    if (saved) { var s = JSON.parse(saved); showDashboard(s.role, s.user); }
};

document.getElementById('demo-sup').onclick  = function(){ fillDemo('supervisor@ops.net','super123'); };
document.getElementById('demo-op').onclick   = function(){ fillDemo('operator@ops.net','oper123'); };
document.getElementById('demo-view').onclick = function(){ fillDemo('viewer@ops.net','view123'); };
document.getElementById('btn-login').onclick = handleLogin;
document.addEventListener('keydown', function(e) {
    if (e.key==='Enter' && document.getElementById('login-screen').style.display!=='none') handleLogin();
});

function fillDemo(u,p) {
    document.getElementById('input-user').value=u;
    document.getElementById('input-pass').value=p;
    hideAlert();
}
function showAlert(m,t) {
    var b=document.getElementById('alert-box'); b.textContent=m; b.className='alert '+(t||'danger')+' show';
}
function hideAlert() { document.getElementById('alert-box').className='alert danger'; }

function handleLogin() {
    if (blockedUntil && Date.now()<blockedUntil) {
        showAlert('Too many attempts. Wait '+Math.ceil((blockedUntil-Date.now())/1000)+'s.','warn'); return;
    }
    var u=document.getElementById('input-user').value.trim();
    var p=document.getElementById('input-pass').value;
    hideAlert();
    document.getElementById('err-user').className='field-error';
    document.getElementById('err-pass').className='field-error';
    if (!u){document.getElementById('err-user').className='field-error show';return;}
    if (!p){document.getElementById('err-pass').className='field-error show';return;}
    var btn=document.getElementById('btn-login');
    btn.disabled=true; btn.classList.add('loading');
    setTimeout(function(){authenticate(u,p,btn);},800);
}

function authenticate(u,p,btn) {
    var ud=USERS[u];
    if (!ud||ud.password!==p) {
        failedAttempts++; btn.disabled=false; btn.classList.remove('loading');
        if (failedAttempts>=3){blockedUntil=Date.now()+30000;showAlert('Blocked 30 seconds.','warn');}
        else showAlert('Incorrect credentials.','danger');
        return;
    }
    failedAttempts=0; currentRole=ud.role; currentUser=u;
    showAlert('Access granted — Role: '+ud.role,'info');
    localStorage.setItem('ops_user_session',JSON.stringify({user:u,role:ud.role}));
    setTimeout(function(){showDashboard(ud.role,u);},600);
}

function showDashboard(role,user) {
    document.getElementById('login-screen').style.display='none';
    var overlay=document.getElementById('loading-overlay');
    if (overlay) overlay.style.display='flex';
    var progress=0,bar=document.getElementById('loader-bar'),txt=document.getElementById('loader-text');
    var iv=setInterval(function(){
        progress+=Math.floor(Math.random()*15)+5;
        if (progress>=100){
            progress=100; clearInterval(iv);
            setTimeout(function(){
                if (overlay) overlay.style.display='none';
                document.getElementById('dashboard-screen').style.display='flex';
                currentRole=role; currentUser=user;
                document.getElementById('role-badge').textContent=role;
                document.getElementById('user-avatar').textContent=user.charAt(0).toUpperCase();
                applyRoleUI(role);
                initDashboard();
                updateChatUI();
                // Connect WebSocket after dashboard is visible
                WS.connect();
                setTimeout(function(){WS.send({type:'login',user:user,role:role});},500);
            },400);
        }
        if (bar) bar.style.width=progress+'%';
        if (txt) txt.textContent='LOADING ASSETS... '+progress+'%';
    },80);
}

function applyRoleUI(role) {
    var old=document.getElementById('btn-emergency-stop'); if(old)old.remove();
    if (role==='SUPERVISOR') {
        var btn=document.createElement('button'); btn.id='btn-emergency-stop';
        _styleEmergencyBtn(btn);
        btn.onclick=function(){
            if (emergencyStopped){
                if(confirm('ALL CLEAR? Resume normal operations?'))
                    WS.send({type:'emergency',action:'resume',missionIdx:currentMission});
            } else {
                if(confirm('CONFIRM CRITICAL SYSTEM HALT?\nThis will stop all agents.'))
                    WS.send({type:'emergency',action:'stop',missionIdx:currentMission});
            }
        };
        document.querySelector('.topbar-right').prepend(btn);
    }
    var vs=document.getElementById('viewer-styles'); if(vs)vs.remove();
    if (role==='VIEWER'){
        var s=document.createElement('style');s.id='viewer-styles';
        s.innerHTML='.ack-btn{opacity:0.3!important;pointer-events:none!important}';
        document.head.appendChild(s);
    }
}

function updateEmergencyButton(){
    var btn=document.getElementById('btn-emergency-stop'); if(btn)_styleEmergencyBtn(btn);
}
function _styleEmergencyBtn(btn){
    if(emergencyStopped){
        btn.innerHTML='▶ RESUME SYSTEM';
        btn.style.cssText='background:#ffaa00;color:white;border:none;padding:4px 12px;margin-right:15px;cursor:pointer;font-weight:bold;font-family:"Share Tech Mono",monospace;letter-spacing:1px;border-radius:2px;';
    } else {
        btn.innerHTML='⚠ EMERGENCY STOP';
        btn.style.cssText='background:#ff2a2a;color:white;border:none;padding:4px 12px;margin-right:15px;cursor:pointer;font-weight:bold;font-family:"Share Tech Mono",monospace;letter-spacing:1px;border-radius:2px;';
    }
}

function doLogout(){
    localStorage.removeItem('ops_user_session');
    if(WS.socket)WS.socket.close();
    WS._initialised=false;
    document.getElementById('dashboard-screen').style.display='none';
    document.getElementById('login-screen').style.display='flex';
    document.getElementById('input-user').value='';
    document.getElementById('input-pass').value='';
    document.getElementById('btn-login').disabled=false;
    document.getElementById('btn-login').classList.remove('loading');
    hideAlert();
    var es=document.getElementById('btn-emergency-stop');if(es)es.remove();
    var vs=document.getElementById('viewer-styles');if(vs)vs.remove();
    currentRole='';currentUser='';emergencyStopped=false;
    updateChatUI();
}
