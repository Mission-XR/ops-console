// ============================================================
//  XR-ENGINE — Three.js 3D scene (SYNCHRONIZED WITH 2D)
// ============================================================

var xrActive = false;
var xrInitialized = false; // El truco para que no cargue desde cero cada vez
var xrRenderer = null;
var xrScene = null;
var xrCamera = null;
var xrAnimId = null;
var xrClock = null;
var xrAgentMeshes = [];

var xrOrbit = { down: false, lastX: 0, lastY: 0, theta: 0.8, phi: 0.6, radius: 20 };

function enterXR() {
    if (xrActive) return;
    xrActive = true;
    
    // Mostramos la capa 3D por encima del 2D
    document.getElementById('xr-container').style.display = 'block';

    if (!xrInitialized) {
        _initRenderer();
        _buildScene();
        _startLoop();
        xrInitialized = true;
    }
    if (typeof showToast === 'function') showToast('3D ENGINE ACTIVE — Drag to orbit');
}

function exitXR() {
    if (!xrActive) return;
    xrActive = false;
    
    // Ocultamos la capa 3D para revelar el 2D instantáneamente
    document.getElementById('xr-container').style.display = 'none';
    if (typeof showToast === 'function') showToast('2D RADAR restored');
}

function refreshXRScene() {
    if (!xrInitialized) return;
    document.getElementById('xr-container').innerHTML = '';
    xrAgentMeshes = [];
    _initRenderer();
    _buildScene();
}

function _initRenderer() {
    var mapArea = document.getElementById('map-area');
    var container = document.getElementById('xr-container');

    xrRenderer = new THREE.WebGLRenderer({ antialias: true });
    xrRenderer.setSize(mapArea.clientWidth, mapArea.clientHeight);
    xrRenderer.setPixelRatio(window.devicePixelRatio);
    xrRenderer.shadowMap.enabled = true;
    xrRenderer.setClearColor(0x020609); // Color de fondo Cyberpunk
    container.appendChild(xrRenderer.domElement);

    var aspect = mapArea.clientWidth / mapArea.clientHeight;
    xrCamera = new THREE.PerspectiveCamera(55, aspect, 0.1, 500);

    xrClock = new THREE.Clock();
    _updateCameraPosition();

    var el = xrRenderer.domElement;
    el.addEventListener('mousedown', function(e) { xrOrbit.down = true; xrOrbit.lastX = e.clientX; xrOrbit.lastY = e.clientY; });
    el.addEventListener('mouseup', function() { xrOrbit.down = false; });
    el.addEventListener('mousemove', function(e) {
        if (!xrOrbit.down) return;
        xrOrbit.theta -= (e.clientX - xrOrbit.lastX) * 0.01;
        xrOrbit.phi -= (e.clientY - xrOrbit.lastY) * 0.01;
        xrOrbit.phi = Math.max(0.1, Math.min(1.4, xrOrbit.phi));
        xrOrbit.lastX = e.clientX;
        xrOrbit.lastY = e.clientY;
        _updateCameraPosition();
    });
    el.addEventListener('wheel', function(e) {
        xrOrbit.radius += e.deltaY * 0.03;
        xrOrbit.radius = Math.max(5, Math.min(50, xrOrbit.radius));
        _updateCameraPosition();
    });

    window.addEventListener('resize', function() {
        if (!xrActive) return;
        xrRenderer.setSize(mapArea.clientWidth, mapArea.clientHeight);
        xrCamera.aspect = mapArea.clientWidth / mapArea.clientHeight;
        xrCamera.updateProjectionMatrix();
    });
}

function _updateCameraPosition() {
    if (!xrCamera) return;
    var r = xrOrbit.radius;
    xrCamera.position.set(
        r * Math.sin(xrOrbit.phi) * Math.sin(xrOrbit.theta),
        r * Math.cos(xrOrbit.phi),
        r * Math.sin(xrOrbit.phi) * Math.cos(xrOrbit.theta)
    );
    xrCamera.lookAt(0, 0, 0);
}

function _buildScene() {
    xrScene = new THREE.Scene();
    xrScene.fog = new THREE.FogExp2(0x020609, 0.015);

    xrScene.add(new THREE.AmbientLight(0x223344, 1.5));
    var dir = new THREE.DirectionalLight(0x00d4ff, 1.2);
    dir.position.set(10, 20, 10);
    dir.castShadow = true;
    xrScene.add(dir);
    var pt = new THREE.PointLight(0x00ff9d, 0.8, 40);
    pt.position.set(0, 10, 0);
    xrScene.add(pt);

    xrScene.add(new THREE.GridHelper(60, 60, 0x0d2438, 0x080f17));

    var m = MISSIONS[currentMission];
    if (m.id === 'INFRA-INSPECT-01') _sceneInfra();
    else if (m.id === 'HOSPITAL-TRANSPORT-02') _sceneHospital();
    else if (m.id === 'WILDFIRE-MAP-03') _sceneWildfire();
    else if (m.id === 'WAREHOUSE-LOG-04') _sceneWarehouse();
    else if (m.id === 'OFFSHORE-WIND-05') _sceneOffshore();

    _buildAgentMeshes();
}

// ── MAPAS 3D ────────────────────────────────────────────
function _sceneInfra() {
  _box(0, 0, 0,  24, 0.15, 3,  0x1a3040);
  _box(0, 0, -6, 3,  0.15, 14, 0x1a3040);
  _box(5, 0.6, -6, 7, 0.4, 3,  0x243850);
  _box(3, 0,   -6, 0.4, 2, 3,  0x1a3040);
  _box(7, 0,   -6, 0.4, 2, 3,  0x1a3040);
  _sphere(-3, 0.5, 0, 0.35, 0xff6b2b);
  _sphere( 1, 0.5, 0, 0.35, 0xff6b2b);
  _sphere(-1, 0.5,-6, 0.35, 0xff6b2b);
  _wireBox(8, 2, 3, 6, 4, 6, 0xff2b5e);
  _floatLabel('SECTOR NORTH', -5, 1, -9, 0x00d4ff);
  _floatLabel('SECTOR SOUTH',  5, 1,  5, 0x00d4ff);
  _floatLabel('NO-FLY ZONE-C', 8, 5,  3, 0xff2b5e);
  _floatLabel('ROAD DAMAGE ×3',-1, 1,  2, 0xff6b2b);
}

function _sceneHospital() {
  _box(-7, 3, -5, 5, 6, 5, 0x0d2438); _wireBox(-7, 3, -5, 5, 6, 5, 0x00d4ff); _floatLabel('BUILDING A', -7, 6.5, -5, 0x00d4ff);
  _box(7, 3, -5, 5, 6, 5, 0x0d2438); _wireBox(7, 3, -5, 5, 6, 5, 0x00d4ff); _floatLabel('BUILDING B', 7, 6.5, -5, 0x00d4ff);
  _box(0, 3, 6, 5, 6, 5, 0x0d2438); _wireBox(0, 3, 6, 5, 6, 5, 0x00d4ff); _floatLabel('BUILDING C', 0, 6.5, 6, 0x00d4ff);
  _wireBox(0, 1.5, 0, 10, 3, 6, 0xff2b5e); _floatLabel('COURTYARD NO-FLY', 0, 3.5, 0, 0xff2b5e);
  var pts = [ new THREE.Vector3(-4.5, 0.2, -2.5), new THREE.Vector3(-2, 0.2, 0), new THREE.Vector3( 0, 0.2, 3.5) ];
  _path(pts, 0x00ff9d); _floatLabel('ROUTE A→C', -2, 1, 0.5, 0x00ff9d);
  _box(-4.5, 1, -2, 0.2, 2, 2, 0xff6b2b); _floatLabel('GATE 3 — LOCKED', -4.5, 3, -2, 0xff6b2b);
}

function _sceneWildfire() {
  _box(0, -0.1, 0, 40, 0.1, 40, 0x0a1505);
  for (var i = 0; i < 10; i++) {
    var fx = (Math.random() - 0.5) * 12 + 4; var fz = (Math.random() - 0.5) * 12; var fh = 0.5 + Math.random() * 2;
    _box(fx, fh/2, fz, 0.8 + Math.random(), fh, 0.8 + Math.random(), 0xff3300);
  }
  _wireBox(4, 2, 0, 12, 4, 12, 0xff6b2b); _floatLabel('FIRE FRONT — SECTOR ALPHA', 4, 5, 0, 0xff6b2b);
  _wireBox(9, 1, 7, 5, 2, 4, 0xff2b5e); _floatLabel('PROTECTED ZONE', 9, 3, 7, 0xff2b5e);
  _box(-7, 0.05, 0, 3, 0.1, 14, 0x003320); _floatLabel('SAFE CORRIDOR', -7, 1, 0, 0x00d4ff);
  for (var t = 0; t < 10; t++) { _tree((Math.random()-0.5)*20 - 2, (Math.random()-0.5)*20); }
  _sphere(-5, 0.5, -4, 0.3, 0x00ff9d); _sphere(-5, 0.5,  0, 0.3, 0x00ff9d); _sphere(-5, 0.5,  4, 0.3, 0x00ff9d);
  _floatLabel('RELAY BEACONS ×3', -5, 2, 0, 0x00ff9d);
}

function _sceneWarehouse() {
  _box(0, -0.05, 0, 36, 0.05, 28, 0x080f10);
  _zoneFloor(-8, -6, 9, 9, 0x00ff9d, 0.08); _floatLabel('ZONE A — COMPLETE', -8, 0.5, -6, 0x00ff9d); _racks(-8, -6, 4);
  _zoneFloor(8, -6, 9, 9, 0xffd166, 0.08); _floatLabel('ZONE B — IN PROGRESS', 8, 0.5, -6, 0xffd166); _racks(8, -6, 4);
  _zoneFloor(-8, 6, 9, 9, 0x3a6070, 0.06); _floatLabel('ZONE C', -8, 0.5, 6, 0x3a6070); _racks(-8, 6, 4);
  _zoneFloor(8, 6, 9, 9, 0xff6b2b, 0.06); _floatLabel('ZONE D — FORKLIFT', 8, 0.5, 6, 0xff6b2b);
  _box(8, 0.5, 5, 1.5, 1, 2.5, 0xff6b2b); _sphere(-6, 1.2, -4, 0.25, 0xff2b5e); _floatLabel('BIN 7C — UNREADABLE', -6, 2, -4, 0xff2b5e);
}

function _sceneOffshore() {
  _box(0, -0.1, 0, 60, 0.1, 60, 0x010a14);
  var seaGeo = new THREE.PlaneGeometry(60, 60);
  var seaMat = new THREE.MeshStandardMaterial({ color:0x003355, transparent:true, opacity:0.35, side:THREE.DoubleSide });
  var sea = new THREE.Mesh(seaGeo, seaMat); sea.rotation.x = -Math.PI/2; sea.position.y = 0.05; xrScene.add(sea);
  var tPos = [[-8,-8],[0,-10],[8,-6],[10,2],[2,6]];
  tPos.forEach(function(p, i){ _turbine(p[0], p[1], i+1); });
  _box(-10, 0.3, 9, 6, 0.6, 3, 0x1a3040); _floatLabel('PIER / RELAY DOCK', -10, 1.5, 9, 0x00d4ff); _box(-10, 0.9, 9, 1, 0.5, 1.5, 0x00ff9d);
}

// ── HERRAMIENTAS 3D ──────────────────────────────────────────
function _box(x, y, z, w, h, d, color) { var geo = new THREE.BoxGeometry(w, h, d); var mat = new THREE.MeshStandardMaterial({ color:color, roughness:0.7, metalness:0.3 }); var mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; xrScene.add(mesh); return mesh; }
function _wireBox(x, y, z, w, h, d, color) { var geo = new THREE.BoxGeometry(w, h, d); var mat = new THREE.MeshBasicMaterial({ color:color, wireframe:true, transparent:true, opacity:0.5 }); var mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); xrScene.add(mesh); return mesh; }
function _sphere(x, y, z, r, color) { var geo = new THREE.SphereGeometry(r, 12, 12); var mat = new THREE.MeshStandardMaterial({ color:color, emissive:color, emissiveIntensity:0.4 }); var mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); xrScene.add(mesh); return mesh; }
function _path(points, color) { var geo = new THREE.BufferGeometry().setFromPoints(points); var mat = new THREE.LineBasicMaterial({ color:color, linewidth:2 }); var line = new THREE.Line(geo, mat); xrScene.add(line); }
function _floatLabel(text, x, y, z, color) { var canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 48; var ctx = canvas.getContext('2d'); ctx.fillStyle = 'rgba(5,10,15,0.85)'; ctx.fillRect(0, 0, 256, 48); ctx.strokeStyle = '#' + color.toString(16).padStart(6, '0'); ctx.lineWidth = 1; ctx.strokeRect(1, 1, 254, 46); ctx.fillStyle = '#' + color.toString(16).padStart(6, '0'); ctx.font = 'bold 14px Share Tech Mono, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 24); var tex = new THREE.CanvasTexture(canvas); var matSprite = new THREE.SpriteMaterial({ map: tex, transparent: true }); var sprite = new THREE.Sprite(matSprite); sprite.scale.set(5, 1, 1); sprite.position.set(x, y, z); xrScene.add(sprite); }
function _zoneFloor(x, z, w, d, color, opacity) { var geo = new THREE.PlaneGeometry(w, d); var mat = new THREE.MeshBasicMaterial({ color:color, transparent:true, opacity:opacity, side:THREE.DoubleSide }); var mesh = new THREE.Mesh(geo, mat); mesh.rotation.x = -Math.PI/2; mesh.position.set(x, 0.02, z); xrScene.add(mesh); _wireBox(x, 0.5, z, w, 1, d, color); }
function _racks(cx, cz, count) { for (var i = 0; i < count; i++) { var rx = cx + (i - count/2) * 1.8; _box(rx, 1.0, cz - 2, 0.2, 2, 3, 0x1a3040); _box(rx, 1.0, cz + 2, 0.2, 2, 3, 0x1a3040); } }
function _tree(x, z) { _box(x, 1, z, 0.3, 2, 0.3, 0x2a1a0a); var geo = new THREE.ConeGeometry(1, 2.5, 6); var mat = new THREE.MeshStandardMaterial({ color:0x1a4a10, roughness:1 }); var cone = new THREE.Mesh(geo, mat); cone.position.set(x, 3, z); xrScene.add(cone); }
function _turbine(x, z, num) { _box(x, 5, z, 0.4, 10, 0.4, 0x7eb8ff); _sphere(x, 10, z, 0.5, 0x7eb8ff); [0, 120, 240].forEach(function(deg){ var rad = deg * Math.PI / 180; var bx = x + Math.cos(rad) * 3; var bz = z + Math.sin(rad) * 3; var geo = new THREE.BoxGeometry(0.2, 6, 0.1); var mat = new THREE.MeshStandardMaterial({ color:0x5a90cc }); var b = new THREE.Mesh(geo, mat); b.position.set(bx, 10, bz); b.rotation.z = rad; xrScene.add(b); }); _floatLabel('T' + num, x, 12, z, 0x7eb8ff); }

// ── ROBOTS 3D (Sincronizados) ──────────────────────────────────
function _buildAgentMeshes() {
    var agents = MISSIONS[currentMission].agents;
    var colors = { running: 0x00ff9d, blocked: 0xff6b2b, planned: 0x00d4ff, done: 0x3a6070 };

    agents.forEach(function(ag) {
        var color = colors[ag.state] || 0x00d4ff;
        var group = new THREE.Group();

        var geo = new THREE.BoxGeometry(0.8, 1.2, 0.8);
        var mat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.3 });
        var mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 0.6;
        group.add(mesh);

        var canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 48;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(5,10,15,0.85)'; ctx.fillRect(0, 0, 256, 48);
        ctx.strokeStyle = '#' + color.toString(16).padStart(6, '0'); ctx.lineWidth = 1; ctx.strokeRect(1, 1, 254, 46);
        ctx.fillStyle = '#' + color.toString(16).padStart(6, '0'); ctx.font = 'bold 14px Share Tech Mono, monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ag.id, 128, 24);

        var tex = new THREE.CanvasTexture(canvas);
        var matSprite = new THREE.SpriteMaterial({ map: tex, transparent: true });
        var sprite = new THREE.Sprite(matSprite);
        sprite.scale.set(5, 1, 1);
        sprite.position.set(0, 2.2, 0);
        group.add(sprite);

        xrScene.add(group);
        xrAgentMeshes.push({ group: group, mesh: mesh, ag: ag, color: color, t: Math.random() * Math.PI * 2 });
    });
}

function _startLoop() {
    function loop() {
        xrAnimId = requestAnimationFrame(loop);
        var delta = xrClock ? xrClock.getDelta() : 0.016;

        xrAgentMeshes.forEach(function(a) {
            // Efecto flotante
            a.t += delta * 1.5;
            a.mesh.position.y = 0.6 + Math.sin(a.t) * 0.15;
            a.mesh.rotation.y += delta * 0.5;

            // LEER EL CEREBRO DEL MAPA 2D
            if (a.ag.x !== undefined && a.ag.y !== undefined) {
                a.group.position.x = (a.ag.x / 100) * 30 - 15;
                a.group.position.z = (a.ag.y / 100) * 30 - 15;
            }
        });

        if (xrActive && xrRenderer && xrScene && xrCamera) {
            xrRenderer.render(xrScene, xrCamera);
        }
    }
    loop();
}