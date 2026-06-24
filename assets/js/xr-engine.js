// ============================================================
//  XR-ENGINE v3 — Three.js 3D + WebXR VR + Controllers
//  FIXED: deferred init waits for container size + mission data
// ============================================================

var xrActive = false;
var xrInitialized = false;
var xrRenderer = null;
var xrScene = null;
var xrCamera = null;
var xrClock = null;
var xrAgentMeshes = [];
var xrVRSession = null;
var xrCameraRig = null;

var xrOrbit = { down:false, lastX:0, lastY:0, theta:0.8, phi:0.6, radius:20 };
var vrControllers = [];
var vrLaserLines = [];
var vrRaycaster = null;
var vrTempMatrix = null;
var vrSelectedAgent = null;

// ─── PUBLIC API ─────────────────────────────────────────────
var _xrAssetsLoaded = false;
var _xrAssetsLoading = null;

function _ensureAssets() {
    if (_xrAssetsLoaded) return Promise.resolve(true);
    if (_xrAssetsLoading) return _xrAssetsLoading;
    if (!window.AssetManager) return Promise.resolve(false);
    showToast('Loading 3D models...');
    _xrAssetsLoading = AssetManager.loadAll({
        uav:     'assets/models/uav.glb',
        ugv:     'assets/models/ugv.glb',
        turbine: 'assets/models/turbine.glb'
    }, function (done, total) {
        showToast('Models ' + done + '/' + total);
    }).then(function (ok) {
        _xrAssetsLoaded = true;
        showToast('3D MODELS LOADED');
        return ok;
    }).catch(function (e) {
        console.warn('[XR] asset load error — using procedural fallbacks', e);
        _xrAssetsLoaded = true;
        return false;
    });
    return _xrAssetsLoading;
}

function enterXR() {
    if (xrActive) return;
    xrActive = true;
    document.getElementById('xr-container').style.display = 'block';

    _ensureAssets().then(function () {
        if (!xrInitialized) {
            requestAnimationFrame(function() {
                var mapArea = document.getElementById('map-area');
                if (!mapArea || mapArea.clientWidth < 10 || mapArea.clientHeight < 10) {
                    setTimeout(function(){ _doInit(); }, 100);
                } else {
                    _doInit();
                }
            });
        } else {
            if (typeof MISSIONS !== 'undefined' && MISSIONS.length) {
                xrAgentMeshes = [];
                _buildScene();
            }
        }
    });
    showToast('3D ENGINE — Drag to orbit');
}

function _doInit() {
    _initRenderer();
    _buildScene();
    _startLoop();
    xrInitialized = true;
}

function exitXR() {
    if (!xrActive) return;
    if (xrVRSession) { xrVRSession.end().catch(function(){}); xrVRSession = null; }
    xrActive = false;
    document.getElementById('xr-container').style.display = 'none';
    showToast('2D RADAR restored');
}

function refreshXRScene() {
    if (!xrInitialized) return;
    xrAgentMeshes = [];
    _buildScene();
}

// ─── VR SESSION (Meta Quest) ────────────────────────────────
function enterImmersiveVR() {
    if (!navigator.xr) { showToast('WebXR not available — need HTTPS'); return; }
    navigator.xr.isSessionSupported('immersive-vr').then(function(ok) {
        if (!ok) { showToast('No VR headset detected'); return; }
        if (!xrActive) enterXR();
        // Wait until renderer exists
        var waitForRenderer = setInterval(function() {
            if (!xrRenderer) return;
            clearInterval(waitForRenderer);

            xrRenderer.xr.setReferenceSpaceType('local-floor');
            navigator.xr.requestSession('immersive-vr', {
                requiredFeatures: ['local-floor'],
                optionalFeatures: ['bounded-floor', 'hand-tracking']
            }).then(function(session) {
                xrVRSession = session;
                xrRenderer.xr.enabled = true;
                xrRenderer.xr.setSession(session);
                if (xrCameraRig) xrCameraRig.position.set(0, 0, 8);
                showToast('VR ACTIVE — put on headset');
                vrControllers.forEach(function(c, i) {
                    if (vrLaserLines[i]) vrLaserLines[i].visible = true;
                });
                session.addEventListener('end', function() {
                    xrVRSession = null; xrRenderer.xr.enabled = false;
                    vrControllers.forEach(function(c, i) {
                        if (vrLaserLines[i]) vrLaserLines[i].visible = false;
                    });
                    _updateOrbitCamera();
                    showToast('VR ended');
                });
            }).catch(function(e) { showToast('VR failed: ' + e.message); });
        }, 100);
    });
}

// ─── RENDERER ───────────────────────────────────────────────
function _initRenderer() {
    var mapArea = document.getElementById('map-area');
    var container = document.getElementById('xr-container');
    var w = mapArea.clientWidth || 800;
    var h = mapArea.clientHeight || 600;

    xrRenderer = new THREE.WebGLRenderer({ antialias:true });
    xrRenderer.setSize(w, h);
    xrRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    xrRenderer.shadowMap.enabled = true;
    xrRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    xrRenderer.setClearColor(0x020609);
    xrRenderer.xr.enabled = false;
    container.innerHTML = ''; // clear previous
    container.appendChild(xrRenderer.domElement);

    xrClock = new THREE.Clock();
    vrRaycaster = new THREE.Raycaster();
    vrTempMatrix = new THREE.Matrix4();

    var el = xrRenderer.domElement;
    el.addEventListener('mousedown', function(e){ xrOrbit.down=true; xrOrbit.lastX=e.clientX; xrOrbit.lastY=e.clientY; });
    el.addEventListener('mouseup', function(){ xrOrbit.down=false; });
    el.addEventListener('mousemove', function(e){
        if (!xrOrbit.down) return;
        xrOrbit.theta -= (e.clientX-xrOrbit.lastX)*0.01;
        xrOrbit.phi -= (e.clientY-xrOrbit.lastY)*0.01;
        xrOrbit.phi = Math.max(0.1, Math.min(1.4, xrOrbit.phi));
        xrOrbit.lastX = e.clientX; xrOrbit.lastY = e.clientY;
        _updateOrbitCamera();
    });
    el.addEventListener('wheel', function(e){
        xrOrbit.radius += e.deltaY*0.03;
        xrOrbit.radius = Math.max(5, Math.min(50, xrOrbit.radius));
        _updateOrbitCamera();
    });
    el.addEventListener('click', function(e) {
        if (xrVRSession) return;
        var rect = el.getBoundingClientRect();
        var mouse = new THREE.Vector2(
            ((e.clientX-rect.left)/rect.width)*2-1,
            -((e.clientY-rect.top)/rect.height)*2+1);
        vrRaycaster.setFromCamera(mouse, xrCamera);
        _doAgentRaycast();
    });
    window.addEventListener('resize', function(){
        if (!xrActive || xrVRSession) return;
        var nw = mapArea.clientWidth || 800, nh = mapArea.clientHeight || 600;
        xrRenderer.setSize(nw, nh);
        xrCamera.aspect = nw/nh;
        xrCamera.updateProjectionMatrix();
    });
}

function _updateOrbitCamera() {
    if (!xrCamera || xrVRSession) return;
    var r = xrOrbit.radius;
    xrCamera.position.set(r*Math.sin(xrOrbit.phi)*Math.sin(xrOrbit.theta), r*Math.cos(xrOrbit.phi), r*Math.sin(xrOrbit.phi)*Math.cos(xrOrbit.theta));
    xrCamera.lookAt(0,0,0);
}

// ─── SCENE ──────────────────────────────────────────────────
function _buildScene() {
    xrScene = new THREE.Scene();
    xrScene.fog = new THREE.FogExp2(0x020609, 0.012);

    var w = (xrRenderer.domElement.width||800), h = (xrRenderer.domElement.height||600);
    xrCamera = new THREE.PerspectiveCamera(55, w/h, 0.1, 500);
    xrCameraRig = new THREE.Group();
    xrCameraRig.add(xrCamera);
    xrScene.add(xrCameraRig);
    _updateOrbitCamera();

    // Lighting
    xrScene.add(new THREE.HemisphereLight(0x1a2a44, 0x050a0f, 0.6));
    xrScene.add(new THREE.AmbientLight(0x223344, 0.8));
    var sun = new THREE.DirectionalLight(0x88bbff, 1.5);
    sun.position.set(15,30,10); sun.castShadow = true;
    sun.shadow.mapSize.width = 2048; sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near=0.5; sun.shadow.camera.far=80;
    sun.shadow.camera.left=-35; sun.shadow.camera.right=35;
    sun.shadow.camera.top=35; sun.shadow.camera.bottom=-35;
    xrScene.add(sun);
    xrScene.add(new THREE.PointLight(0x00ff9d, 0.6, 30));

    // Ground
    xrScene.add(new THREE.GridHelper(60,60,0x0d2438,0x080f17));
    var gnd = new THREE.Mesh(new THREE.PlaneGeometry(80,80), new THREE.MeshStandardMaterial({color:0x050a0f,roughness:0.95}));
    gnd.rotation.x=-Math.PI/2; gnd.position.y=-0.01; gnd.receiveShadow=true; xrScene.add(gnd);

    // Mission-specific environment
    if (typeof MISSIONS !== 'undefined' && MISSIONS.length && MISSIONS[currentMission]) {
        var m = MISSIONS[currentMission];
        if (m.id==='INFRA-INSPECT-01') _sceneInfra();
        else if (m.id==='HOSPITAL-TRANSPORT-02') _sceneHospital();
        else if (m.id==='WILDFIRE-MAP-03') _sceneWildfire();
        else if (m.id==='WAREHOUSE-LOG-04') _sceneWarehouse();
        else if (m.id==='OFFSHORE-WIND-05') _sceneOffshore();
    }

    _buildAgentMeshes();
    _setupVRControllers();
}

// ─── VR CONTROLLERS ─────────────────────────────────────────
function _setupVRControllers() {
    vrControllers = []; vrLaserLines = [];
    for (var i = 0; i < 2; i++) {
        var ctrl = xrRenderer.xr.getController(i);
        xrCameraRig.add(ctrl);
        var grip = xrRenderer.xr.getControllerGrip(i);
        xrCameraRig.add(grip);
        // Grip visual
        var gv = new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.02,0.12,8), new THREE.MeshStandardMaterial({color:0x222233,metalness:0.8,roughness:0.3}));
        gv.rotation.x=-0.3; grip.add(gv);
        // Laser
        var color = i===0 ? 0x00d4ff : 0x00ff9d;
        var laser = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-15)]),
            new THREE.LineBasicMaterial({color:color, transparent:true, opacity:0.5}));
        laser.visible = false; ctrl.add(laser);
        // Hit dot
        var dot = new THREE.Mesh(new THREE.SphereGeometry(0.015,8,8), new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:0}));
        dot.name='laser-dot'; ctrl.add(dot);
        ctrl.addEventListener('connected', (function(l){return function(){l.visible=true;};})(laser));
        ctrl.addEventListener('disconnected', (function(l){return function(){l.visible=false;};})(laser));
        ctrl.addEventListener('selectstart', _onVRSelect);
        ctrl.addEventListener('squeezestart', function(){ if(vrSelectedAgent){showToast('Deselected');vrSelectedAgent=null;} });
        vrControllers.push(ctrl); vrLaserLines.push(laser);
    }
}

function _onVRSelect() {
    vrTempMatrix.identity().extractRotation(this.matrixWorld);
    vrRaycaster.ray.origin.setFromMatrixPosition(this.matrixWorld);
    vrRaycaster.ray.direction.set(0,0,-1).applyMatrix4(vrTempMatrix);
    _doAgentRaycast();
}

function _doAgentRaycast() {
    var targets = xrAgentMeshes.map(function(a){return a.mesh;});
    var hits = vrRaycaster.intersectObjects(targets, false);
    if (hits.length > 0) {
        for (var i=0; i<xrAgentMeshes.length; i++) {
            if (xrAgentMeshes[i].mesh === hits[0].object) {
                _onAgentSelected(xrAgentMeshes[i].ag, i); break;
            }
        }
    }
}

function _onAgentSelected(ag, idx) {
    vrSelectedAgent = ag;
    showToast('SELECTED: ' + ag.id + ' [' + ag.state + ']');
    if (typeof MISSIONS!=='undefined' && MISSIONS[currentMission]) {
        var events = MISSIONS[currentMission].events;
        for (var e=0; e<events.length; e++) {
            if (events[e].override && !events[e].acked) {
                if (currentRole==='SUPERVISOR') { openOverrideModal(events[e],e); }
                else { showToast('Override pending — SUPERVISOR required'); }
                return;
            }
        }
    }
}

// ─── AGENT MESHES (procedural — no .glb files needed) ──────
function _buildAgentMeshes() {
    xrAgentMeshes = [];
    if (typeof MISSIONS==='undefined' || !MISSIONS.length || !MISSIONS[currentMission]) return;
    var agents = MISSIONS[currentMission].agents;
    var colors = {running:0x00ff9d, blocked:0xff6b2b, planned:0x00d4ff, done:0x3a6070};

    agents.forEach(function(ag) {
        var color = colors[ag.state]||0x00d4ff;
        var wrapper = new THREE.Group();

        // Build mesh based on agent type
        var body;
        if (ag.type==='uav') {
            // GLB pipeline (Phase 2). Fallback to procedural if unavailable.
            var glb = (window.AssetManager && AssetManager.has('uav')) ? AssetManager.getLOD('uav', 1.2) : null;
            if (glb) {
                body = new THREE.Group();
                glb.position.y = 0.6;
                body.add(glb);
            } else {
                body = new THREE.Group();
                var core = new THREE.Mesh(new THREE.OctahedronGeometry(0.5,0), new THREE.MeshStandardMaterial({color:color,roughness:0.3,metalness:0.7,emissive:color,emissiveIntensity:0.2}));
                core.scale.set(1,0.4,1); core.position.y=0.8; core.castShadow=true; body.add(core);
                [[0.6,0,0.6],[-0.6,0,0.6],[0.6,0,-0.6],[-0.6,0,-0.6]].forEach(function(p){
                    var rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.25,0.02,16), new THREE.MeshStandardMaterial({color:0x00d4ff,transparent:true,opacity:0.3}));
                    rotor.position.set(p[0],0.85,p[2]); body.add(rotor);
                });
            }
        } else if (ag.type==='ugv'||ag.type==='humanoid') {
            var glbU = (ag.type==='ugv' && window.AssetManager && AssetManager.has('ugv')) ? AssetManager.getLOD('ugv', 1.5) : null;
            if (glbU) {
                body = new THREE.Group();
                body.add(glbU);
            } else {
                body = new THREE.Group();
                var chassis = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.5,1.4), new THREE.MeshStandardMaterial({color:color,roughness:0.4,metalness:0.6,emissive:color,emissiveIntensity:0.15}));
                chassis.position.y=0.45; chassis.castShadow=true; body.add(chassis);
                if (ag.type==='humanoid') {
                    var head = new THREE.Mesh(new THREE.SphereGeometry(0.25,8,8), new THREE.MeshStandardMaterial({color:0xcccccc}));
                    head.position.y=1.0; body.add(head);
                }
                [[-0.5,0.15,0.5],[0.5,0.15,0.5],[-0.5,0.15,-0.5],[0.5,0.15,-0.5]].forEach(function(p){
                    var w = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,0.1,12), new THREE.MeshStandardMaterial({color:0x222222}));
                    w.rotation.z=Math.PI/2; w.position.set(p[0],p[1],p[2]); body.add(w);
                });
            }
        } else {
            body = new THREE.Group();
            var sphere = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4,1), new THREE.MeshStandardMaterial({color:color,roughness:0.1,metalness:0.9,emissive:color,emissiveIntensity:0.5}));
            sphere.position.y=0.6; sphere.castShadow=true; body.add(sphere);
            var ring = new THREE.Mesh(new THREE.TorusGeometry(0.55,0.02,8,32), new THREE.MeshStandardMaterial({color:color,emissive:color,emissiveIntensity:0.8,transparent:true,opacity:0.4}));
            ring.position.y=0.6; ring.rotation.x=Math.PI/2; body.add(ring);
        }
        wrapper.add(body);

        // Label
        var lbl = _makeLabel(ag.id, color); lbl.position.set(0,2.5,0); wrapper.add(lbl);

        // Invisible hitbox for raycasting
        var hitBox = new THREE.Mesh(new THREE.BoxGeometry(1.5,2.5,1.5), new THREE.MeshBasicMaterial({visible:false}));
        hitBox.position.y=1.0; wrapper.add(hitBox);

        // Selection ring
        var selRing = new THREE.Mesh(new THREE.RingGeometry(0.8,1.0,32), new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,side:THREE.DoubleSide}));
        selRing.rotation.x=-Math.PI/2; selRing.position.y=0.05; wrapper.add(selRing);

        xrScene.add(wrapper);
        xrAgentMeshes.push({group:wrapper, mesh:hitBox, selRing:selRing, ag:ag, color:color, t:Math.random()*Math.PI*2});
    });
}

function _makeLabel(text, color) {
    var cv=document.createElement('canvas'); cv.width=256; cv.height=48;
    var ct=cv.getContext('2d'); ct.fillStyle='rgba(5,10,15,0.85)'; ct.fillRect(0,0,256,48);
    var hex='#'+color.toString(16).padStart(6,'0');
    ct.strokeStyle=hex; ct.lineWidth=1; ct.strokeRect(1,1,254,46);
    ct.fillStyle=hex; ct.font='bold 14px Share Tech Mono,monospace'; ct.textAlign='center'; ct.textBaseline='middle';
    ct.fillText(text,128,24);
    var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),transparent:true}));
    sp.scale.set(5,1,1); return sp;
}

// ─── ANIMATION LOOP ─────────────────────────────────────────
function _startLoop() {
    xrRenderer.setAnimationLoop(_renderFrame);
}

function _renderFrame() {
    if (!xrActive || !xrScene || !xrCamera) return;
    var delta = xrClock ? xrClock.getDelta() : 0.016;
    var agents = (typeof MISSIONS!=='undefined' && MISSIONS.length && MISSIONS[currentMission]) ? MISSIONS[currentMission].agents : [];

    xrAgentMeshes.forEach(function(a, i) {
        a.t += delta*1.5;
        var sag = agents[i];
        if (sag && sag.posX!==undefined) {
            a.group.position.x = (sag.posX/100)*30-15;
            a.group.position.z = (sag.posY/100)*30-15;
            a.group.position.y = Math.sin(a.t)*0.1;
        }
        if (a.group.children[0] && a.group.children[0].type==='Group') a.group.children[0].rotation.y += delta*0.3;
        a.selRing.material.opacity = (vrSelectedAgent && vrSelectedAgent.id===a.ag.id) ? 0.4+Math.sin(a.t*3)*0.3 : 0;
    });

    if (xrVRSession) {
        vrControllers.forEach(function(ctrl,ci){
            if (!vrLaserLines[ci]||!vrLaserLines[ci].visible) return;
            vrTempMatrix.identity().extractRotation(ctrl.matrixWorld);
            vrRaycaster.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
            vrRaycaster.ray.direction.set(0,0,-1).applyMatrix4(vrTempMatrix);
            var hits = vrRaycaster.intersectObjects(xrAgentMeshes.map(function(a){return a.mesh;}),false);
            var pts=vrLaserLines[ci].geometry.attributes.position;
            var dot=ctrl.getObjectByName('laser-dot');
            if(hits.length>0){pts.setZ(1,-hits[0].distance);if(dot){dot.position.set(0,0,-hits[0].distance);dot.material.opacity=0.8;}vrLaserLines[ci].material.opacity=0.9;}
            else{pts.setZ(1,-15);if(dot)dot.material.opacity=0;vrLaserLines[ci].material.opacity=0.4;}
            pts.needsUpdate=true;
        });
    }
    xrRenderer.render(xrScene, xrCamera);
}

// ─── SCENE BUILDERS ─────────────────────────────────────────
function _box(x,y,z,w,h,d,c){var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:c,roughness:0.7,metalness:0.3}));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;xrScene.add(m);return m;}
function _wireBox(x,y,z,w,h,d,c){var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color:c,wireframe:true,transparent:true,opacity:0.5}));m.position.set(x,y,z);xrScene.add(m);}
function _sphere(x,y,z,r,c){var m=new THREE.Mesh(new THREE.SphereGeometry(r,16,16),new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:0.4}));m.position.set(x,y,z);m.castShadow=true;xrScene.add(m);}
function _floatLabel(t,x,y,z,c){var s=_makeLabel(t,c);s.position.set(x,y,z);xrScene.add(s);}
function _zoneFloor(x,z,w,d,c,o){var m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:o,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(x,0.02,z);xrScene.add(m);_wireBox(x,0.5,z,w,1,d,c);}
function _racks(cx,cz,n){for(var i=0;i<n;i++){var rx=cx+(i-n/2)*1.8;_box(rx,1,cz-2,0.2,2,3,0x1a3040);_box(rx,1,cz+2,0.2,2,3,0x1a3040);}}
function _tree(x,z){_box(x,1,z,0.3,2,0.3,0x2a1a0a);var c=new THREE.Mesh(new THREE.ConeGeometry(1,2.5,6),new THREE.MeshStandardMaterial({color:0x1a4a10}));c.position.set(x,3,z);c.castShadow=true;xrScene.add(c);}
function _turbine(x,z,n){
    // Phase 2: use GLB when available, fallback to procedural
    if (window.AssetManager && AssetManager.has('turbine')) {
        var t = AssetManager.get('turbine', 12);  // ~12 units tall
        t.position.set(x, 0, z);
        xrScene.add(t);
    } else {
        _box(x,5,z,0.4,10,0.4,0x7eb8ff);
        _sphere(x,10,z,0.5,0x7eb8ff);
        [0,120,240].forEach(function(d){
            var r=d*Math.PI/180;
            var b=new THREE.Mesh(new THREE.BoxGeometry(0.2,6,0.1),new THREE.MeshStandardMaterial({color:0x5a90cc}));
            b.position.set(x+Math.cos(r)*3,10,z+Math.sin(r)*3); b.rotation.z=r; b.castShadow=true;
            xrScene.add(b);
        });
    }
    _floatLabel('T'+n,x,13,z,0x7eb8ff);
}

function _sceneInfra(){_box(0,0,0,24,0.15,3,0x1a3040);_box(0,0,-6,3,0.15,14,0x1a3040);_box(5,0.6,-6,7,0.4,3,0x243850);_box(3,0,-6,0.4,2,3,0x1a3040);_box(7,0,-6,0.4,2,3,0x1a3040);_sphere(-3,0.5,0,0.35,0xff6b2b);_sphere(1,0.5,0,0.35,0xff6b2b);_sphere(-1,0.5,-6,0.35,0xff6b2b);_wireBox(8,2,3,6,4,6,0xff2b5e);_floatLabel('SECTOR NORTH',-5,1,-9,0x00d4ff);_floatLabel('SECTOR SOUTH',5,1,5,0x00d4ff);_floatLabel('NO-FLY ZONE-C',8,5,3,0xff2b5e);_floatLabel('ROAD DAMAGE x3',-1,1,2,0xff6b2b);}
function _sceneHospital(){_box(-7,3,-5,5,6,5,0x0d2438);_wireBox(-7,3,-5,5,6,5,0x00d4ff);_floatLabel('BUILDING A',-7,6.5,-5,0x00d4ff);_box(7,3,-5,5,6,5,0x0d2438);_wireBox(7,3,-5,5,6,5,0x00d4ff);_floatLabel('BUILDING B',7,6.5,-5,0x00d4ff);_box(0,3,6,5,6,5,0x0d2438);_wireBox(0,3,6,5,6,5,0x00d4ff);_floatLabel('BUILDING C',0,6.5,6,0x00d4ff);_wireBox(0,1.5,0,10,3,6,0xff2b5e);_floatLabel('COURTYARD NO-FLY',0,3.5,0,0xff2b5e);}
function _sceneWildfire(){_box(0,-0.1,0,40,0.1,40,0x0a1505);for(var i=0;i<10;i++){_box((Math.random()-0.5)*12+4,0.5+Math.random(),(Math.random()-0.5)*12,0.8+Math.random(),0.5+Math.random()*2,0.8+Math.random(),0xff3300);}_wireBox(4,2,0,12,4,12,0xff6b2b);_floatLabel('FIRE FRONT',4,5,0,0xff6b2b);_wireBox(9,1,7,5,2,4,0xff2b5e);_floatLabel('PROTECTED ZONE',9,3,7,0xff2b5e);_box(-7,0.05,0,3,0.1,14,0x003320);_floatLabel('SAFE CORRIDOR',-7,1,0,0x00d4ff);for(var t=0;t<10;t++){_tree((Math.random()-0.5)*20-2,(Math.random()-0.5)*20);}_sphere(-5,0.5,-4,0.3,0x00ff9d);_sphere(-5,0.5,0,0.3,0x00ff9d);_sphere(-5,0.5,4,0.3,0x00ff9d);_floatLabel('RELAY BEACONS',-5,2,0,0x00ff9d);}
function _sceneWarehouse(){_box(0,-0.05,0,36,0.05,28,0x080f10);_zoneFloor(-8,-6,9,9,0x00ff9d,0.08);_floatLabel('ZONE A',-8,0.5,-6,0x00ff9d);_racks(-8,-6,4);_zoneFloor(8,-6,9,9,0xffd166,0.08);_floatLabel('ZONE B',8,0.5,-6,0xffd166);_racks(8,-6,4);_zoneFloor(-8,6,9,9,0x3a6070,0.06);_floatLabel('ZONE C',-8,0.5,6,0x3a6070);_racks(-8,6,4);_zoneFloor(8,6,9,9,0xff6b2b,0.06);_floatLabel('ZONE D',8,0.5,6,0xff6b2b);}
function _sceneOffshore(){_box(0,-0.1,0,60,0.1,60,0x010a14);var sea=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({color:0x003355,transparent:true,opacity:0.35,side:THREE.DoubleSide}));sea.rotation.x=-Math.PI/2;sea.position.y=0.05;xrScene.add(sea);[[-8,-8],[0,-10],[8,-6],[10,2],[2,6]].forEach(function(p,i){_turbine(p[0],p[1],i+1);});_box(-10,0.3,9,6,0.6,3,0x1a3040);_floatLabel('PIER',-10,1.5,9,0x00d4ff);}
