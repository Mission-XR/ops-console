// ============================================================
//  WS-CLIENT — Phase 1 adapter over NetworkManager
// ============================================================
var WS = {
    _net:null, _initialised:false, _mode:'unknown', _staticTimer:null, connected:false,

    connect: function(){
        var self=this;
        if(this._net && this._net.getState && this._net.getState()==='CLOSED'){this._net=null;}
        if(this._net) return;
        this._initialised=false; this._mode='unknown'; this.connected=false;
        this._net=new NetworkManager();

        this._net.on('state', function(e){
            self.connected = (e.to==='OPEN' && self._mode!=='static');
            if(e.to==='OPEN' && self._net.getMode()==='backend'){
                showToast('SERVER LINK ESTABLISHED');
                if(typeof currentRole!=='undefined' && currentRole){
                    self._net.send({type:'login',user:currentUser||'anon',role:currentRole},{queueable:true,dedupeKey:'login'});
                }
            }
            if(e.to==='RECONNECTING') showToast('LINK LOST — reconnecting...');
        });
        this._net.on('message', function(m){ WS.handle(m); });
        this._net.on('static_mode', function(){ self._mode='static'; WS._startStaticMode(); });
        this._net.on('static_send', function(p){ WS._handleStaticCommand(p); });
        this._net.on('queue_overflow', function(){ showToast('Command queue full'); });
        this._net.connect();
    },

    send: function(obj){
        if(!this._net) return;
        var opts={queueable:true, ttl:10000};
        if(obj && obj.type==='override' && obj.eventIdx!=null) opts.dedupeKey='override:'+obj.missionIdx+':'+obj.eventIdx;
        else if(obj && obj.type==='ack_event') opts.dedupeKey='ack:'+obj.missionIdx+':'+obj.eventIdx;
        else if(obj && obj.type==='emergency') opts.dedupeKey='emergency';
        this._net.send(obj, opts);
    },

    destroy: function(){
        if(this._staticTimer){clearInterval(this._staticTimer); this._staticTimer=null;}
        if(this._net){this._net.destroy(); this._net=null;}
        this._initialised=false; this.connected=false;
    },

    handle: function(msg){
        switch(msg.type){
        case 'state':
            MISSIONS=msg.missions; emergencyStopped=msg.emergency; onlineUsers=msg.users||[];
            if(!WS._initialised){
                WS._initialised=true;
                if(msg.chat_history && msg.chat_history.length) msg.chat_history.forEach(function(e){appendChatEntry(e);});
                renderPanels();
            }
            renderContext(); renderEvents(); renderPresence();
            break;
        case 'not_ready': showToast('Server initializing...'); break;
        case 'chat': if(msg.entry) appendChatEntry(msg.entry); break;
        case 'toast': showToast(msg.msg); renderPanels(); break;
        case 'emergency': emergencyStopped=msg.stopped; updateEmergencyButton(); renderPanels(); break;
        case 'presence': onlineUsers=msg.users||[]; renderPresence(); break;
        }
    },

    _startStaticMode: function(){
        console.log('[WS] Static mode'); showToast('OFFLINE MODE — local simulation');
        var base=document.querySelector('base')?document.querySelector('base').href:'';
        fetch(base+'assets/data/missions.json').then(function(r){return r.json();}).then(function(data){
            MISSIONS=data;
            MISSIONS.forEach(function(m){m.agents.forEach(function(ag){ag.posX=ag.x;ag.posY=ag.y;ag._t=Math.random();ag._dir=1;});});
            WS._initialised=true; renderPanels();
            showToast('Loaded '+MISSIONS.length+' missions (offline)');
            WS._staticTimer=setInterval(WS._staticTick,300);
        }).catch(function(e){console.error('[WS]',e);showToast('ERROR: missions');});
    },

    _staticTick: function(){
        if(emergencyStopped) return;
        MISSIONS.forEach(function(m){
            if(m.status!=='running') return;
            m.agents.forEach(function(ag){
                if(ag.state!=='running') return;
                ag._t += 0.004*ag._dir;
                if(ag._t>=1){ag._t=1;ag._dir=-1;} if(ag._t<=0){ag._t=0;ag._dir=1;}
                ag.posX = ag.x + Math.sin(ag._t*Math.PI)*8;
                ag.posY = ag.y + Math.cos(ag._t*Math.PI*0.7)*5;
                ag.posX = Math.max(2,Math.min(98,ag.posX));
                ag.posY = Math.max(2,Math.min(98,ag.posY));
            });
            m.context.forEach(function(c){
                if(c.key.toUpperCase().indexOf('BAT')>=0){
                    try{var v=parseInt(c.val); if(v>1 && Math.random()>0.92) c.val=(v-1)+'%';}catch(e){}
                }
            });
        });
        renderContext(); renderEvents();
    },

    _handleStaticCommand: function(obj){
        if(obj.type==='chat'){appendChatEntry({user:obj.user,role:obj.role,text:obj.text,time:new Date().toTimeString().slice(0,8)});}
        else if(obj.type==='start_action'){
            var m=MISSIONS[obj.missionIdx]; if(!m)return;
            m.actions.forEach(function(a){
                if(a.id===obj.actionId && a.state==='planned'){
                    a.state='running';
                    m.agents.forEach(function(ag){if(ag.id===a.agent) ag.state='running';});
                    m.status='running'; showToast(a.agent+' STARTED');
                }
            });
            renderPanels();
        } else if(obj.type==='ack_event'){
            var ev=MISSIONS[obj.missionIdx].events;
            if(ev[obj.eventIdx]) ev[obj.eventIdx].acked=true;
            renderEvents();
        } else if(obj.type==='override'){
            var m2=MISSIONS[obj.missionIdx];
            if(m2.events[obj.eventIdx]) m2.events[obj.eventIdx].acked=true;
            if(obj.decision==='APPROVED'){
                m2.agents.forEach(function(ag){if(ag.state==='blocked')ag.state='running';});
                m2.actions.forEach(function(a){if(a.state==='blocked')a.state='running';});
                m2.status='running';
            }
            showToast('Override '+obj.decision); renderPanels();
        } else if(obj.type==='emergency'){
            emergencyStopped=(obj.action==='stop'); updateEmergencyButton(); renderPanels();
        }
    }
};
