// ============================================================
//  NetworkManager — Phase 1 (Robustez y Networking)
// ============================================================
(function (global) {
    'use strict';
    var STATE = { IDLE:'IDLE', CONNECTING:'CONNECTING', OPEN:'OPEN', RECONNECTING:'RECONNECTING', CLOSED:'CLOSED' };
    var BACKOFF_BASE_MS=500, BACKOFF_MAX_MS=30000, BACKOFF_JITTER_MS=250, STABLE_RESET_MS=5000;
    var PING_INTERVAL_MS=15000, PONG_TIMEOUT_MS=5000, PING_INTERVAL_BG=60000;
    var QUEUE_MAX=100, DEFAULT_TTL_MS=10000, STATIC_FALLBACK_MS=3000;

    function NetworkManager(opts){
        opts=opts||{};
        this._url=opts.url||(location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/ws';
        this._state=STATE.IDLE; this._socket=null; this._attempt=0; this._mode='unknown';
        this._queue=[]; this._listeners={}; this._rootCtrl=new AbortController();
        this._pingTimer=null; this._pongWatchdog=null; this._stableTimer=null;
        this._reconnectTO=null; this._fallbackTO=null; this._destroyed=false;
        this._bindLifecycle();
    }
    NetworkManager.STATE=STATE;
    NetworkManager.prototype.on=function(e,f){(this._listeners[e]=this._listeners[e]||[]).push(f);return this;};
    NetworkManager.prototype.off=function(e,f){var a=this._listeners[e];if(!a)return;this._listeners[e]=a.filter(function(x){return x!==f;});};
    NetworkManager.prototype._emit=function(e,p){var a=this._listeners[e];if(!a)return;a.slice().forEach(function(f){try{f(p);}catch(x){console.error('[NET]',x);}});};
    NetworkManager.prototype._setState=function(n){if(this._state===n)return;var p=this._state;this._state=n;console.log('[NET]',p,'→',n);this._emit('state',{from:p,to:n});};
    NetworkManager.prototype.getState=function(){return this._state;};
    NetworkManager.prototype.getMode=function(){return this._mode;};
    NetworkManager.prototype.isOpen=function(){return this._state===STATE.OPEN;};
    NetworkManager.prototype.connect=function(){
        if(this._destroyed){console.warn('[NET] destroyed');return;}
        if(this._state===STATE.CONNECTING||this._state===STATE.OPEN)return;
        this._setState(STATE.CONNECTING); this._openSocket();
    };
    NetworkManager.prototype._openSocket=function(){
        var self=this;
        try{this._socket=new WebSocket(this._url);}catch(e){console.error('[NET] ctor',e);this._scheduleReconnect();return;}
        if(this._mode==='unknown'){
            clearTimeout(this._fallbackTO);
            this._fallbackTO=setTimeout(function(){
                if(self._mode==='unknown'&&self._state!==STATE.OPEN){
                    console.log('[NET] backend unreachable — static');
                    try{self._socket.close();}catch(e){}
                    self._enterStaticMode();
                }
            },STATIC_FALLBACK_MS);
        }
        var s=this._rootCtrl.signal;
        this._socket.addEventListener('open',this._onOpen.bind(this),{signal:s});
        this._socket.addEventListener('message',this._onMessage.bind(this),{signal:s});
        this._socket.addEventListener('close',this._onClose.bind(this),{signal:s});
        this._socket.addEventListener('error',this._onError.bind(this),{signal:s});
    };
    NetworkManager.prototype._onOpen=function(){
        var self=this; clearTimeout(this._fallbackTO);
        this._mode='backend'; this._setState(STATE.OPEN);
        clearTimeout(this._stableTimer);
        this._stableTimer=setTimeout(function(){self._attempt=0;},STABLE_RESET_MS);
        this._startHeartbeat(); this._flushQueue(); this._emit('open',{});
    };
    NetworkManager.prototype._onMessage=function(evt){
        var m; try{m=JSON.parse(evt.data);}catch(e){return;}
        if(m&&m.type==='pong'){this._handlePong();return;}
        this._emit('message',m);
    };
    NetworkManager.prototype._onClose=function(evt){
        this._stopHeartbeat(); clearTimeout(this._stableTimer);
        if(this._destroyed||this._state===STATE.CLOSED)return;
        if(this._mode==='static')return;
        this._scheduleReconnect(evt);
    };
    NetworkManager.prototype._onError=function(e){console.warn('[NET] error',e);};
    NetworkManager.prototype._scheduleReconnect=function(){
        if(this._destroyed)return;
        if(this._state===STATE.RECONNECTING)return;
        this._setState(STATE.RECONNECTING);
        var d=Math.min(BACKOFF_BASE_MS*Math.pow(2,this._attempt),BACKOFF_MAX_MS)+Math.random()*BACKOFF_JITTER_MS;
        this._attempt++;
        this._emit('reconnecting',{attempt:this._attempt,delayMs:d});
        var self=this; clearTimeout(this._reconnectTO);
        this._reconnectTO=setTimeout(function(){
            if(self._destroyed)return;
            self._setState(STATE.CONNECTING); self._openSocket();
        },d);
    };
    NetworkManager.prototype._startHeartbeat=function(){
        var self=this; this._stopHeartbeat();
        var iv=document.hidden?PING_INTERVAL_BG:PING_INTERVAL_MS;
        this._pingTimer=setInterval(function(){self._sendPing();},iv);
    };
    NetworkManager.prototype._stopHeartbeat=function(){
        clearInterval(this._pingTimer); clearTimeout(this._pongWatchdog);
        this._pingTimer=null; this._pongWatchdog=null;
    };
    NetworkManager.prototype._sendPing=function(){
        var self=this;
        if(!this._socket||this._socket.readyState!==WebSocket.OPEN)return;
        try{this._socket.send(JSON.stringify({type:'ping',ts:Date.now()}));}catch(e){return;}
        clearTimeout(this._pongWatchdog);
        this._pongWatchdog=setTimeout(function(){
            console.warn('[NET] heartbeat timeout');
            try{self._socket.close(4000,'heartbeat_timeout');}catch(e){}
        },PONG_TIMEOUT_MS);
    };
    NetworkManager.prototype._handlePong=function(){clearTimeout(this._pongWatchdog);this._pongWatchdog=null;};
    NetworkManager.prototype.send=function(payload,opts){
        opts=opts||{};
        if(this._mode==='static'){this._emit('static_send',payload);return;}
        if(this._state===STATE.OPEN&&this._socket&&this._socket.readyState===WebSocket.OPEN){
            try{this._socket.send(JSON.stringify(payload));return;}catch(e){}
        }
        if(opts.queueable===false)return;
        if(opts.dedupeKey){this._queue=this._queue.filter(function(q){return q.dedupeKey!==opts.dedupeKey;});}
        if(this._queue.length>=QUEUE_MAX){this._queue.shift();this._emit('queue_overflow',{dropped:1});}
        this._queue.push({payload:payload,expiresAt:Date.now()+(opts.ttl||DEFAULT_TTL_MS),dedupeKey:opts.dedupeKey||null});
    };
    NetworkManager.prototype._flushQueue=function(){
        var now=Date.now(),kept=[];
        while(this._queue.length){
            var it=this._queue.shift();
            if(it.expiresAt<now)continue;
            try{this._socket.send(JSON.stringify(it.payload));}catch(e){kept.push(it);}
        }
        this._queue=kept;
    };
    NetworkManager.prototype.queueSize=function(){return this._queue.length;};
    NetworkManager.prototype._enterStaticMode=function(){
        if(this._mode==='static')return;
        this._mode='static'; this._setState(STATE.OPEN); this._emit('static_mode',{});
    };
    NetworkManager.prototype._bindLifecycle=function(){
        var self=this,s=this._rootCtrl.signal;
        window.addEventListener('beforeunload',function(){self.destroy();},{signal:s});
        document.addEventListener('visibilitychange',function(){
            if(self._state===STATE.OPEN&&self._mode==='backend')self._startHeartbeat();
        },{signal:s});
    };
    NetworkManager.prototype.destroy=function(){
        if(this._destroyed)return;
        this._destroyed=true; console.log('[NET] destroy');
        clearTimeout(this._reconnectTO); clearTimeout(this._stableTimer); clearTimeout(this._fallbackTO);
        this._stopHeartbeat();
        try{this._rootCtrl.abort();}catch(e){}
        if(this._socket){try{this._socket.close(1000,'client_destroy');}catch(e){}this._socket=null;}
        this._queue=[]; this._listeners={};
        this._setState(STATE.CLOSED);
    };
    global.NetworkManager=NetworkManager;
})(window);
