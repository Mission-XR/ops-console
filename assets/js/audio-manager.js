// ============================================================
//  AUDIO-MANAGER — UI feedback sounds + emergency alarm + red flash
//  ------------------------------------------------------------
//  - Plays a short "beep" on any UI interaction (delegate on document)
//  - Plays a looping "alarm" while emergency-stop is active
//  - Tints the screen + 3D scene RED while emergency is active
//    (works in 2D radar, desktop 3D and immersive WebXR)
//
//  Drop two files at:
//      assets/audio/ui_beep.mp3
//      assets/audio/alarm.mp3
//  If the files are missing, the module falls back to Web Audio
//  synthesis (oscillator beep + siren) so nothing breaks.
// ============================================================
(function (global) {
    'use strict';

    var AUDIO_BASE = 'assets/audio/';
    var BEEP_FILE  = 'ui_beep.mp3';
    var ALARM_FILE = 'alarm.mp3';

    var AudioFX = {
        _beep:        null,
        _alarm:       null,
        _enabled:     true,
        _unlocked:    false,
        _ready:       false,
        _lastBeep:    0,
        _overlay:     null,
        _flashing:    false,
        _xrPlane:     null,
        _xrPlanePulseRAF: null,
        _fogPrev:     null,
        _bgPrev:      null,
        _ac:          null,  // AudioContext fallback
        _beepOK:      false,
        _alarmOK:     false,
        _synthAlarm:  null,

        // ── INIT ─────────────────────────────────────────────
        init: function () {
            if (this._ready) return;
            this._ready = true;

            try {
                this._beep = new Audio(AUDIO_BASE + BEEP_FILE);
                this._beep.preload = 'auto';
                this._beep.volume  = 0.4;
                this._beep.addEventListener('canplaythrough', function(){ AudioFX._beepOK = true; }, { once:true });
                this._beep.addEventListener('error', function(){
                    console.warn('[AUDIO] ui_beep.mp3 missing — using synth fallback');
                    AudioFX._beepOK = false;
                }, { once:true });

                this._alarm = new Audio(AUDIO_BASE + ALARM_FILE);
                this._alarm.preload = 'auto';
                this._alarm.loop    = true;
                this._alarm.volume  = 0.6;
                this._alarm.addEventListener('canplaythrough', function(){ AudioFX._alarmOK = true; }, { once:true });
                this._alarm.addEventListener('error', function(){
                    console.warn('[AUDIO] alarm.mp3 missing — using synth fallback');
                    AudioFX._alarmOK = false;
                }, { once:true });
            } catch (e) {
                console.warn('[AUDIO] HTMLAudio not available, fallback only', e);
            }

            this._installOverlay();
            this._installClickDelegate();
            this._installUnlockOnce();
            this._installEmergencyHook();
            console.log('[AUDIO] ready');
        },

        // Most browsers block audio until first user gesture.
        _installUnlockOnce: function () {
            var self = this;
            function unlock() {
                self._unlocked = true;
                if (self._beep) {
                    var p = self._beep.play();
                    if (p && p.then) p.then(function(){ self._beep.pause(); self._beep.currentTime = 0; }).catch(function(){});
                }
                try {
                    self._ac = self._ac || new (window.AudioContext || window.webkitAudioContext)();
                    if (self._ac.state === 'suspended') self._ac.resume();
                } catch (e) {}
                window.removeEventListener('pointerdown', unlock, true);
                window.removeEventListener('keydown', unlock, true);
            }
            window.addEventListener('pointerdown', unlock, true);
            window.addEventListener('keydown', unlock, true);
        },

        // ── PUBLIC: BEEP ─────────────────────────────────────
        beep: function () {
            if (!this._enabled) return;
            var now = Date.now();
            if (now - this._lastBeep < 40) return;
            this._lastBeep = now;

            if (this._beepOK && this._beep) {
                try {
                    var clip = this._beep.cloneNode();
                    clip.volume = this._beep.volume;
                    var pr = clip.play();
                    if (pr && pr.catch) pr.catch(function(){ AudioFX._synthBeep(); });
                    return;
                } catch (e) {}
            }
            this._synthBeep();
        },

        _synthBeep: function () {
            try {
                if (!this._ac) this._ac = new (window.AudioContext || window.webkitAudioContext)();
                var ac = this._ac, t = ac.currentTime;
                var osc = ac.createOscillator(), gn = ac.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(880, t);
                gn.gain.setValueAtTime(0.0001, t);
                gn.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
                gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
                osc.connect(gn); gn.connect(ac.destination);
                osc.start(t); osc.stop(t + 0.08);
            } catch (e) {}
        },

        // ── PUBLIC: ALARM ────────────────────────────────────
        alarm: function () {
            if (!this._enabled) return;
            if (this._alarmOK && this._alarm) {
                try {
                    this._alarm.currentTime = 0;
                    var p = this._alarm.play();
                    if (p && p.catch) p.catch(function(){ AudioFX._synthAlarmStart(); });
                    return;
                } catch (e) {}
            }
            this._synthAlarmStart();
        },

        stopAlarm: function () {
            if (this._alarm) { try { this._alarm.pause(); this._alarm.currentTime = 0; } catch (e) {} }
            this._synthAlarmStop();
        },

        _synthAlarmStart: function () {
            this._synthAlarmStop();
            try {
                if (!this._ac) this._ac = new (window.AudioContext || window.webkitAudioContext)();
                var ac = this._ac;
                var osc = ac.createOscillator(), gn = ac.createGain();
                var lfo = ac.createOscillator(), lfoGain = ac.createGain();
                osc.type = 'sawtooth';
                osc.frequency.value = 440;
                lfo.type = 'sine';
                lfo.frequency.value = 3.5;
                lfoGain.gain.value = 180;
                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);
                gn.gain.value = 0.18;
                osc.connect(gn); gn.connect(ac.destination);
                osc.start(); lfo.start();
                this._synthAlarm = { osc: osc, lfo: lfo, gn: gn };
            } catch (e) {}
        },

        _synthAlarmStop: function () {
            if (!this._synthAlarm) return;
            try { this._synthAlarm.osc.stop(); } catch (e) {}
            try { this._synthAlarm.lfo.stop(); } catch (e) {}
            this._synthAlarm = null;
        },

        // ── PUBLIC: EMERGENCY VISUAL FLASH ───────────────────
        flashEmergency: function (active) {
            if (active === this._flashing) return;
            this._flashing = !!active;

            if (this._overlay) {
                if (active) this._overlay.classList.add('show');
                else        this._overlay.classList.remove('show');
            }

            if (active) this._tintXROn();
            else        this._tintXROff();
        },

        // ── STRONG, HIGH-Z DOM OVERLAY (covers 2D + 3D views) ─
        _installOverlay: function () {
            if (document.getElementById('emergency-overlay')) {
                this._overlay = document.getElementById('emergency-overlay');
                return;
            }
            var style = document.createElement('style');
            style.textContent =
                // z-index 99999 → above body::after scanlines (999),
                // topbar (100), modal (200). pointer-events:none so it
                // never blocks clicks on the UI underneath.
                '#emergency-overlay{' +
                    'position:fixed;inset:0;pointer-events:none;z-index:99999;' +
                    'opacity:0;transition:opacity 0.25s ease;' +
                '}' +
                // Solid red wash that pulses
                '#emergency-overlay::before{' +
                    'content:"";position:absolute;inset:0;' +
                    'background:rgba(255,0,40,0.30);' +
                    'animation:emergWash 0.9s ease-in-out infinite alternate;' +
                '}' +
                // Bright pulsing border + inner glow ring
                '#emergency-overlay::after{' +
                    'content:"";position:absolute;inset:0;' +
                    'box-shadow:inset 0 0 140px 30px rgba(255,0,40,0.95),' +
                                'inset 0 0 0 8px rgba(255,0,40,0.95);' +
                    'animation:emergBorder 0.55s ease-in-out infinite alternate;' +
                '}' +
                '#emergency-overlay.show{opacity:1;}' +
                '@keyframes emergWash{from{background:rgba(255,0,40,0.22);}to{background:rgba(255,0,40,0.45);}}' +
                '@keyframes emergBorder{' +
                    'from{box-shadow:inset 0 0 90px 20px rgba(255,0,40,0.70),inset 0 0 0 5px rgba(255,0,40,0.65);}' +
                    'to  {box-shadow:inset 0 0 180px 45px rgba(255,0,40,1.0),inset 0 0 0 10px rgba(255,0,40,1.0);}' +
                '}';
            document.head.appendChild(style);
            var div = document.createElement('div');
            div.id = 'emergency-overlay';
            document.body.appendChild(div);
            this._overlay = div;
        },

        // ── 3D / WebXR scene tint (visible inside Quest headset) ─
        _tintXROn: function () {
            if (typeof xrScene === 'undefined' || !xrScene) return;
            try {
                if (xrScene.fog && this._fogPrev === null) {
                    this._fogPrev = xrScene.fog.color.getHex();
                    xrScene.fog.color.setHex(0xff0028);
                }
                if (typeof xrRenderer !== 'undefined' && xrRenderer && this._bgPrev === null) {
                    var prev = xrRenderer.getClearColor(new THREE.Color());
                    this._bgPrev = prev.getHex();
                    xrRenderer.setClearColor(0x4a0010);
                }
                // Red plane glued to the camera. In immersive VR the DOM overlay
                // is invisible, so this is what the user actually sees through
                // the Quest headset.
                if (typeof xrCamera !== 'undefined' && xrCamera && !this._xrPlane) {
                    if (!xrCamera.parent && typeof xrScene !== 'undefined') {
                        xrScene.add(xrCamera);
                    }
                    var geo = new THREE.PlaneGeometry(6, 6);
                    var mat = new THREE.MeshBasicMaterial({
                        color: 0xff0028,
                        transparent: true,
                        opacity: 0.42,
                        depthTest: false,
                        depthWrite: false,
                        side: THREE.DoubleSide
                    });
                    var plane = new THREE.Mesh(geo, mat);
                    plane.position.set(0, 0, -1.0);
                    plane.renderOrder = 9999;
                    plane.frustumCulled = false;
                    plane.userData._emergencyFX = true;
                    xrCamera.add(plane);
                    this._xrPlane = plane;

                    var t0 = performance.now();
                    var self = this;
                    (function pulse() {
                        if (!self._xrPlane) return;
                        var dt = (performance.now() - t0) / 1000;
                        self._xrPlane.material.opacity = 0.30 + 0.22 * Math.abs(Math.sin(dt * 4.2));
                        self._xrPlanePulseRAF = requestAnimationFrame(pulse);
                    })();
                }
            } catch (e) { console.warn('[AUDIO] XR tint on failed', e); }
        },

        _tintXROff: function () {
            try {
                if (typeof xrScene !== 'undefined' && xrScene && xrScene.fog && this._fogPrev !== null) {
                    xrScene.fog.color.setHex(this._fogPrev);
                    this._fogPrev = null;
                }
                if (typeof xrRenderer !== 'undefined' && xrRenderer && this._bgPrev !== null) {
                    xrRenderer.setClearColor(this._bgPrev);
                    this._bgPrev = null;
                }
                if (this._xrPlane) {
                    if (this._xrPlanePulseRAF) cancelAnimationFrame(this._xrPlanePulseRAF);
                    this._xrPlanePulseRAF = null;
                    if (this._xrPlane.parent) this._xrPlane.parent.remove(this._xrPlane);
                    if (this._xrPlane.geometry) this._xrPlane.geometry.dispose();
                    if (this._xrPlane.material) this._xrPlane.material.dispose();
                    this._xrPlane = null;
                }
            } catch (e) { console.warn('[AUDIO] XR tint off failed', e); }
        },

        // ── INSTANT LOCAL FEEDBACK ON EMERGENCY BUTTON ───────
        // Don't wait for the WS round-trip (~300ms). Poll the global
        // `emergencyStopped` flag for a short window after the user clicks
        // the button. The first time it flips, fire the FX. The WS state
        // sync that arrives afterwards is a no-op (flashEmergency is
        // idempotent — early-returns if state hasn't changed).
        _installEmergencyHook: function () {
            var self = this;
            document.addEventListener('click', function (e) {
                if (!e.target || !e.target.closest) return;
                var btn = e.target.closest('#btn-emergency-stop');
                if (!btn) return;
                var before = (typeof emergencyStopped !== 'undefined') ? emergencyStopped : null;
                var deadline = Date.now() + 2000;
                var iv = setInterval(function () {
                    if (typeof emergencyStopped === 'undefined') { return; }
                    if (emergencyStopped !== before) {
                        clearInterval(iv);
                        if (emergencyStopped) { self.alarm(); self.flashEmergency(true); }
                        else                  { self.stopAlarm(); self.flashEmergency(false); }
                    } else if (Date.now() > deadline) {
                        clearInterval(iv);
                    }
                }, 40);
            }, false);
        },

        // ── GLOBAL CLICK DELEGATE FOR UI BEEPS ───────────────
        _installClickDelegate: function () {
            var self = this;
            var SELECTOR =
                'button, ' +                                  // every <button>
                'a[href], ' +                                 // links
                '.map-btn, ' +                                // 2D/3D/VR + START buttons
                '.mission-tab, .mission-item, ' +             // mission selection
                '.demo-user, ' +                              // login demo accounts
                '.avatar, ' +                                 // presence avatars
                '.chat-toggle, .chat-header, ' +              // chat widget
                '.sidebar-toggle, ' +                         // hamburger
                '.panel-badge, ' +                            // unacked counter
                '.action-item, ' +                            // action lane rows
                '#btn-login, .btn-logout, ' +
                '.btn-approve, .btn-reject, ' +               // override modal
                '.ack-btn, ' +                                // event ACK
                '[role="button"], [onclick]';
            document.addEventListener('click', function (e) {
                if (!self._enabled) return;
                var t = e.target;
                if (!t || !t.closest) return;
                var tag = (t.tagName || '').toLowerCase();
                if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
                var hit = t.closest(SELECTOR);
                if (!hit) return;
                if (hit.disabled) return;
                if (hit.getAttribute && hit.getAttribute('aria-disabled') === 'true') return;
                self.beep();
            }, true);
        },

        setEnabled: function (on) { this._enabled = !!on; if (!on) this.stopAlarm(); }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { AudioFX.init(); });
    } else {
        AudioFX.init();
    }

    global.AudioFX = AudioFX;
})(window);