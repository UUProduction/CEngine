/* ═══════════════════════════════════════════
   CENGINE EDITOR.JS v0.5
   Full rewrite — Physics, Rigs, Scripts,
   Sound, Input, Mobile Joystick, AI Helper
   ═══════════════════════════════════════════ */
(function () {
'use strict';

/* ══ MOBILE REDIRECT ══ */
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && window.innerWidth < 768);
if (isMobile) { window.location.href = 'mobile.html'; return; }

/* ══════════════════════════════════════
   AUDIO SYSTEM
══════════════════════════════════════ */
const AudioSystem = {
  ctx: null, muted: false, enabled: false,
  ambient: document.getElementById('audio-ambient'),
  init() {
    if (this.ambient) this.ambient.volume = 0.12;
    document.addEventListener('click', () => {
      if (!this.enabled) {
        this.enabled = true;
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
        if (this.ambient) this.ambient.play().catch(() => {});
      }
    }, { once: true });
  },
  toggle() {
    this.muted = !this.muted;
    if (this.ambient) this.ambient.muted = this.muted;
    document.getElementById('btn-audio-toggle')?.classList.toggle('active', !this.muted);
    toast(this.muted ? 'Audio muted' : 'Audio on');
  },
  tone(freq=660, dur=0.08, vol=0.03, type='sine') {
    if (this.muted || !this.ctx) return;
    try {
      const o=this.ctx.createOscillator(), g=this.ctx.createGain();
      o.connect(g); g.connect(this.ctx.destination);
      o.type=type;
      o.frequency.setValueAtTime(freq, this.ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(freq*0.75, this.ctx.currentTime+dur);
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime+dur);
      o.start(); o.stop(this.ctx.currentTime+dur);
    } catch(e) {}
  },
  click()   { this.tone(700,0.05,0.025); },
  success() { this.tone(880,0.1,0.04); setTimeout(()=>this.tone(1100,0.08,0.03),100); },
  error()   { this.tone(180,0.2,0.04,'sawtooth'); },
  warn()    { this.tone(440,0.1,0.03); },

  /* ── Synth presets for game sounds ── */
  synth(type, opts) {
    opts = opts||{};
    const vol=(opts.volume||0.4), pitch=(opts.pitch||1);
    switch(type) {
      case 'jump':      this.tone(220*pitch,0.15,vol,'square'); setTimeout(()=>this.tone(440*pitch,0.1,vol*0.5,'square'),80); break;
      case 'land':      this.tone(80*pitch,0.08,vol,'sawtooth'); break;
      case 'shoot':     this.tone(1400*pitch,0.05,vol,'sawtooth'); setTimeout(()=>this.tone(200*pitch,0.1,vol*0.3,'sawtooth'),50); break;
      case 'explosion': this.tone(100*pitch,0.3,vol,'sawtooth'); setTimeout(()=>this.tone(60*pitch,0.4,vol*0.6,'sawtooth'),100); break;
      case 'hit':       this.tone(300*pitch,0.1,vol,'square'); break;
      case 'coin':      this.tone(1046*pitch,0.1,vol,'sine'); setTimeout(()=>this.tone(1318*pitch,0.1,vol,'sine'),80); break;
      case 'death':     this.tone(440*pitch,0.8,vol,'sawtooth'); setTimeout(()=>this.tone(220*pitch,0.6,vol*0.5,'sawtooth'),400); break;
      case 'footstep':  this.tone(120+Math.random()*60,0.05,vol*0.3,'sawtooth'); break;
      default:          this.tone(660*pitch,0.1,vol,'sine');
    }
  }
};

/* ══════════════════════════════════════
   TOAST
══════════════════════════════════════ */
function toast(msg, type='log', dur=2500) {
  const c=document.getElementById('toast-container');
  if (!c) return;
  const el=document.createElement('div');
  el.className='toast '+type;
  el.innerHTML='<span>'+msg+'</span>';
  c.appendChild(el);
  if (type==='success') AudioSystem.success();
  else if (type==='error') AudioSystem.error();
  else if (type==='warn') AudioSystem.warn();
  else AudioSystem.tone(580,0.07,0.025);
  setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(),300); },dur);
}

/* ══════════════════════════════════════
   CONSOLE
══════════════════════════════════════ */
const Console = {
  el: document.getElementById('console-output'),
  counts: {log:0,warn:0,error:0},
  history: [], histIdx: -1,
  log(msg, type='log', src='Editor.js') {
    if (!this.el) return;
    const t=(performance.now()/1000).toFixed(3);
    const div=document.createElement('div');
    div.className='log-entry '+type;
    div.dataset.type=type;
    const svgs={
      log:'<svg class="log-icon" width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" stroke="#27ae60" stroke-width="1.2" fill="none"/></svg>',
      warn:'<svg class="log-icon" width="10" height="10" viewBox="0 0 10 10"><path d="M5 1l4 8H1z" stroke="#d4a017" stroke-width="1.2" fill="none"/></svg>',
      error:'<svg class="log-icon" width="10" height="10" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6" stroke="#c0392b" stroke-width="1.2" stroke-linecap="round"/></svg>'
    };
    div.innerHTML=(svgs[type]||svgs.log)+'<span class="log-time">'+t+'</span><span class="log-msg">'+msg+'</span><span class="log-source">'+src+'</span>';
    this.el.appendChild(div);
    this.el.scrollTop=this.el.scrollHeight;
    this.counts[type]=(this.counts[type]||0)+1;
    this._updateCounts();
  },
  _updateCounts() {
    const lc=document.getElementById('log-count');
    const wc=document.getElementById('warn-count-num');
    const ec=document.getElementById('error-count-num');
    if(lc) lc.textContent=this.counts.log;
    if(wc) wc.textContent=this.counts.warn;
    if(ec) ec.textContent=this.counts.error;
  },
  clear() {
    if(this.el) this.el.innerHTML='';
    this.counts={log:0,warn:0,error:0};
    this._updateCounts();
    this.log('Console cleared','log','Console');
  },
  exec(cmd) {
    if(!cmd.trim()) return;
    this.history.unshift(cmd);
    this.histIdx=-1;
    this.log('> '+cmd,'log','Console');
    try {
      const res=Function('"use strict";with(window.CEngineAPI||{})return('+cmd+')')();
      if(res!==undefined) this.log(JSON.stringify(res),'log','Console');
    } catch(e) { this.log(e.message,'error','Console'); }
  }
};

/* ══════════════════════════════════════
   INPUT SYSTEM
══════════════════════════════════════ */
const Input = {
  keys: {}, prevKeys: {},
  mouse: {x:0,y:0,dx:0,dy:0,buttons:{},prevButtons:{}},
  active: false,
  init() {
    this.active=true;
    window.addEventListener('keydown', e=>{ this.keys[e.code]=true; this.keys[e.key.toLowerCase()]=true; });
    window.addEventListener('keyup',   e=>{ this.keys[e.code]=false; this.keys[e.key.toLowerCase()]=false; });
    window.addEventListener('mousemove', e=>{ this.mouse.dx=e.movementX||0; this.mouse.dy=e.movementY||0; this.mouse.x=e.clientX; this.mouse.y=e.clientY; });
    window.addEventListener('mousedown', e=>this.mouse.buttons[e.button]=true);
    window.addEventListener('mouseup',   e=>this.mouse.buttons[e.button]=false);
  },
  tick() {
    Object.keys(this.keys).forEach(k=>this.prevKeys[k]=this.keys[k]);
    Object.keys(this.mouse.buttons).forEach(k=>this.mouse.prevButtons[k]=this.mouse.buttons[k]);
    this.mouse.dx=0; this.mouse.dy=0;
  },
  held(key)     { return !!(this.keys[key]||this.keys['Key'+key.toUpperCase()]||this.keys[key.toLowerCase()]); },
  pressed(key)  { return !!(this.keys[key]&&!this.prevKeys[key]); },
  released(key) { return !!(!this.keys[key]&&this.prevKeys[key]); },
  axis(name) {
    if(name==='horizontal') return (this.held('d')||this.held('ArrowRight')?1:0)-(this.held('a')||this.held('ArrowLeft')?1:0);
    if(name==='vertical')   return (this.held('w')||this.held('ArrowUp')?1:0)-(this.held('s')||this.held('ArrowDown')?1:0);
    return 0;
  },
  clear() { this.keys={}; this.mouse.buttons={}; }
};

/* ══════════════════════════════════════
   SCENE DATA MODEL
══════════════════════════════════════ */
const SceneData = {
  entities: [], selected: null, nextId: 1,
  add(name, type, mesh=null) {
    const e={id:this.nextId++,name,type,active:true,mesh,
      position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1},components:[]};
    this.entities.push(e); return e;
  },
  getById(id) { return this.entities.find(e=>e.id===id)||null; },
  remove(id) {
    const e=this.getById(id);
    if(e&&e.mesh) {
      SceneView.scene.remove(e.mesh);
      e.mesh.geometry?.dispose();
      if(Array.isArray(e.mesh.material)) e.mesh.material.forEach(m=>m.dispose());
      else e.mesh.material?.dispose();
    }
    this.entities=this.entities.filter(x=>x.id!==id);
    if(this.selected===id) { this.selected=null; Inspector.clear(); }
  },
  select(id) {
    this.selected=id;
    const e=this.getById(id);
    if(e) { Inspector.update(e); SceneView.showGizmo(e); }
  },
  duplicate(id) {
    const e=this.getById(id);
    if(!e||!e.mesh) return null;
    const nm=e.mesh.clone();
    nm.position.x+=1.5;
    SceneView.scene.add(nm);
    const ne=this.add(e.name+' (Copy)',e.type,nm);
    ne.position={x:nm.position.x,y:nm.position.y,z:nm.position.z};
    ne.rotation={...e.rotation}; ne.scale={...e.scale};
    return ne;
  },
  save() {
    try {
      const data={
        name:document.getElementById('scene-name')?.textContent||'Untitled',
        timestamp:Date.now(),
        entities:this.entities.filter(e=>e.mesh).map(e=>({
          id:e.id, name:e.name, type:e.type, active:e.active,
          position:{...e.position}, rotation:{...e.rotation}, scale:{...e.scale},
          color:e.mesh?.material?.color?.getHexString()||'4488cc',
          geometry:e.mesh?.geometry?.type||'BoxGeometry',
          components:e.components||[]
        }))
      };
      localStorage.setItem('cengine_scene_v1',JSON.stringify(data));
      toast('Scene saved','success');
      Console.log('Scene saved — '+data.entities.length+' entities','log','Scene.js');
    } catch(e) { toast('Save failed: '+e.message,'error'); }
  },
  load() {
    try {
      const raw=localStorage.getItem('cengine_scene_v1');
      if(!raw) { toast('No saved scene','warn'); return; }
      const data=JSON.parse(raw);
      this.entities.forEach(e=>{ if(e.mesh) SceneView.scene?.remove(e.mesh); });
      this.entities=[]; this.selected=null; this.nextId=1;
      const geoMap={
        BoxGeometry:      ()=>new THREE.BoxGeometry(1,1,1),
        SphereGeometry:   ()=>new THREE.SphereGeometry(0.5,24,24),
        CylinderGeometry: ()=>new THREE.CylinderGeometry(0.5,0.5,1,24),
        PlaneGeometry:    ()=>new THREE.PlaneGeometry(2,2),
        ConeGeometry:     ()=>new THREE.ConeGeometry(0.5,1,24),
        TorusGeometry:    ()=>new THREE.TorusGeometry(0.5,0.18,16,48)
      };
      data.entities.forEach(ed=>{
        const mesh=new THREE.Mesh(
          (geoMap[ed.geometry]||geoMap.BoxGeometry)(),
          new THREE.MeshStandardMaterial({color:'#'+ed.color,roughness:0.5,metalness:0.1})
        );
        mesh.position.set(ed.position.x,ed.position.y,ed.position.z);
        mesh.scale.set(ed.scale.x||1,ed.scale.y||1,ed.scale.z||1);
        mesh.castShadow=true; mesh.receiveShadow=true;
        SceneView.scene?.add(mesh);
        const entity=this.add(ed.name,ed.type,mesh);
        entity.id=ed.id; entity.active=ed.active;
        entity.position={...ed.position}; entity.scale={...ed.scale};
        entity.components=ed.components||[];
      });
      this.nextId=Math.max(...this.entities.map(e=>e.id),0)+1;
      HierarchyPanel.refresh(); Inspector.clear();
      toast('Scene loaded','success');
      Console.log('Loaded '+data.entities.length+' entities','log','Scene.js');
    } catch(e) { toast('Load failed: '+e.message,'error'); }
  }
};

/* ══════════════════════════════════════
   SCRIPT RUNTIME
══════════════════════════════════════ */
const ScriptRuntime = {
  instances: [],
  init(entities, scene) {
    this.instances=[];
    const SceneAPI={
      find:(name)=>entities.find(e=>e.name===name)||null,
      destroy:(entity)=>{ if(entity) SceneData.remove(entity.id); },
      spawn:(name,pos)=>{
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5),new THREE.MeshStandardMaterial({color:0xff8844}));
        mesh.position.set(pos?.x||0,pos?.y||0,pos?.z||0);
        scene.add(mesh);
        const e=SceneData.add(name,'mesh',mesh);
        return e;
      }
    };
    entities.forEach(entity=>{
      (entity.components||[]).forEach(comp=>{
        if(comp.type!=='script'||!comp.code) return;
        const match=comp.code.match(/class\s+(\w+)/);
        if(!match) return;
        const className=match[1];
        const rbProxy={
          addForce:(x,y,z)=>{ if(entity._phys) entity._phys.vy+=y*0.1; },
          setVelocity:(x,y,z)=>{ if(entity._phys) entity._phys.vy=y; },
          get grounded(){ return entity._phys?.grounded||false; }
        };
        const sandbox={
          transform:{ get position(){return entity.mesh?.position||entity.position;}, get rotation(){return entity.mesh?.rotation||entity.rotation;}, get scale(){return entity.mesh?.scale||entity.scale;} },
          rb:rbProxy,
          entity:{ get name(){return entity.name;}, get active(){return entity.active;}, destroy(){SceneData.remove(entity.id);} },
          Input,
          Sound:{ Synth:{ play:(t,o)=>AudioSystem.synth(t,o) } },
          Scene:SceneAPI,
          CEngine:{ log:(msg)=>Console.log(String(msg),'log',className) },
          Vector3:{
            add:(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z}),
            sub:(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),
            scale:(v,s)=>({x:v.x*s,y:v.y*s,z:v.z*s}),
            length:(v)=>Math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z),
            normalize:(v)=>{ const l=Math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z)||1; return {x:v.x/l,y:v.y/l,z:v.z/l}; },
            distance:(a,b)=>Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2)
          },
          THREE, Math, console
        };
        try {
          const keys=Object.keys(sandbox), vals=Object.values(sandbox);
          const fn=new Function(...keys,comp.code+';return new '+className+'();');
          const inst=fn(...vals);
          this.instances.push({entity,instance:inst,name:className});
          try { inst.onStart?.(); } catch(e) { Console.log('onStart error: '+e.message,'error',className); }
        } catch(e) { Console.log('Script error: '+e.message,'error',className); }
      });
    });
  },
  update(dt) {
    this.instances.forEach(({entity,instance,name})=>{
      try { instance.onUpdate?.(dt); }
      catch(e) {
        if(!instance._ec) instance._ec=0;
        if(++instance._ec<3) Console.log('onUpdate error: '+e.message,'error',name);
      }
    });
  },
  stop() {
    this.instances.forEach(({instance,name})=>{ try { instance.onStop?.(); } catch(e){} });
    this.instances=[];
  }
};

/* ══════════════════════════════════════
   PLAYER RIG
   Camera directly above head — 1v1.lol style
══════════════════════════════════════ */
const PlayerRig = {
  group: null, active: false,
  vy: 0, grounded: false,
  speed: 6, jumpForce: 8,
  yaw: 0,
  walkCycle: 0,
  stepTimer: 0,

  // Joystick state (for mobile/phone use on desktop too)
  joyX: 0, joyY: 0,
  joyActive: false,
  joyId: null,
  joyBaseX: 0, joyBaseY: 0,

  spawn(scene, camera, pos) {
    this.scene=scene; this.camera=camera;
    if(this.group) { scene.remove(this.group); }

    // Build humanoid
    const g=new THREE.Group();
    const bodyMat=new THREE.MeshStandardMaterial({color:0x4488ff,roughness:0.6});
    const headMat=new THREE.MeshStandardMaterial({color:0xffcc99,roughness:0.8});
    const limbMat=new THREE.MeshStandardMaterial({color:0x3366cc,roughness:0.6});

    // Torso
    const torso=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.65,0.25),bodyMat);
    torso.position.y=0.9; torso.castShadow=true; g.add(torso);

    // Head
    const head=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.35,0.35),headMat);
    head.position.y=1.45; head.castShadow=true; g.add(head);

    // Arms
    const lArm=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.55,0.18),limbMat);
    lArm.position.set(-0.36,0.88,0); lArm.castShadow=true; g.add(lArm);
    const rArm=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.55,0.18),limbMat);
    rArm.position.set(0.36,0.88,0); rArm.castShadow=true; g.add(rArm);

    // Legs
    const lLeg=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.6,0.2),limbMat);
    lLeg.position.set(-0.14,0.3,0); lLeg.castShadow=true; g.add(lLeg);
    const rLeg=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.6,0.2),limbMat);
    rLeg.position.set(0.14,0.3,0); rLeg.castShadow=true; g.add(rLeg);

    g.position.set(pos?.x||0, pos?.y||2, pos?.z||3);
    scene.add(g);
    this.group=g;
    this.vy=0; this.grounded=false; this.yaw=0;
    this.active=true;

    // Show joystick overlay
    this._buildJoystick();
    Console.log('Player rig spawned — WASD or joystick to move, Space to jump','log','PlayerRig.js');
  },

  _buildJoystick() {
    // Remove existing
    document.getElementById('rig-joy-overlay')?.remove();

    const overlay=document.createElement('div');
    overlay.id='rig-joy-overlay';
    overlay.style.cssText='position:fixed;bottom:0;left:0;right:0;height:220px;z-index:999;pointer-events:none;';

    // Left zone — movement joystick
    const lZone=document.createElement('div');
    lZone.id='rig-joy-left-zone';
    lZone.style.cssText='position:absolute;left:0;bottom:0;width:50%;height:100%;pointer-events:auto;';

    const lBase=document.createElement('div');
    lBase.id='rig-joy-base';
    lBase.style.cssText='position:absolute;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,0.05);border:2px solid rgba(255,255,255,0.15);display:none;pointer-events:none;';
    const lStick=document.createElement('div');
    lStick.id='rig-joy-stick';
    lStick.style.cssText='position:absolute;top:50%;left:50%;width:44px;height:44px;border-radius:50%;background:rgba(0,164,220,0.6);border:2px solid rgba(0,164,220,1);transform:translate(-50%,-50%);';
    lBase.appendChild(lStick);
    lZone.appendChild(lBase);
    overlay.appendChild(lZone);

    // Hint text
    const hint=document.createElement('div');
    hint.style.cssText='position:absolute;bottom:8px;left:50%;transform:translateX(-50%);font-size:10px;color:rgba(255,255,255,0.2);font-family:monospace;pointer-events:none;white-space:nowrap;';
    hint.textContent='LEFT: move  •  SPACE: jump  •  ESC: stop';
    overlay.appendChild(hint);

    document.body.appendChild(overlay);

    // Touch events
    lZone.addEventListener('touchstart', e=>{
      e.preventDefault();
      if(this.joyActive) return;
      const t=e.changedTouches[0];
      this.joyId=t.identifier; this.joyActive=true;
      this.joyBaseX=t.clientX; this.joyBaseY=t.clientY;
      lBase.style.display='block';
      lBase.style.left=(t.clientX-60)+'px';
      lBase.style.top=(t.clientY-60-(overlay.getBoundingClientRect().top))+'px';
    },{passive:false});

    document.addEventListener('touchmove', e=>{
      if(!this.joyActive) return;
      Array.from(e.changedTouches).forEach(t=>{
        if(t.identifier!==this.joyId) return;
        const dx=t.clientX-this.joyBaseX, dy=t.clientY-this.joyBaseY;
        const dist=Math.sqrt(dx*dx+dy*dy), max=55;
        const nx=dist>max?(dx/dist)*max:dx;
        const ny=dist>max?(dy/dist)*max:dy;
        this.joyX=nx/max; this.joyY=ny/max;
        lStick.style.transform='translate(calc(-50% + '+nx+'px), calc(-50% + '+ny+'px))';
      });
    });

    document.addEventListener('touchend', e=>{
      Array.from(e.changedTouches).forEach(t=>{
        if(t.identifier===this.joyId) {
          this.joyActive=false; this.joyId=null;
          this.joyX=0; this.joyY=0;
          lBase.style.display='none';
          lStick.style.transform='translate(-50%,-50%)';
        }
      });
    });
  },

  update(dt) {
    if(!this.active||!this.group) return;

    // ── Input — WASD + joystick ──
    let moveX=Input.axis('horizontal');
    let moveZ=-Input.axis('vertical');

    // Joystick overrides if active
    if(this.joyActive||Math.abs(this.joyX)>0.1||Math.abs(this.joyY)>0.1) {
      moveX=this.joyX;
      moveZ=this.joyY;
    }

    const moving=Math.abs(moveX)>0.05||Math.abs(moveZ)>0.05;

    if(moving) {
      const fwd=new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw));
      const right=new THREE.Vector3(Math.cos(this.yaw),0,-Math.sin(this.yaw));
      this.group.position.addScaledVector(right, moveX*this.speed*dt);
      this.group.position.addScaledVector(fwd,   moveZ*this.speed*dt);

      // Walk animation
      this.walkCycle+=dt*8;
      const lArm=this.group.children[2], rArm=this.group.children[3];
      const lLeg=this.group.children[4], rLeg=this.group.children[5];
      if(lArm) lArm.rotation.x= Math.sin(this.walkCycle)*0.4;
      if(rArm) rArm.rotation.x=-Math.sin(this.walkCycle)*0.4;
      if(lLeg) lLeg.rotation.x=-Math.sin(this.walkCycle)*0.5;
      if(rLeg) rLeg.rotation.x= Math.sin(this.walkCycle)*0.5;

      // Footstep sounds
      this.stepTimer+=dt;
      if(this.stepTimer>0.38) {
        this.stepTimer=0;
        AudioSystem.synth('footstep',{volume:0.15});
      }
    } else {
      this.walkCycle=0; this.stepTimer=0;
      [2,3,4,5].forEach(i=>{ if(this.group.children[i]) this.group.children[i].rotation.x*=0.8; });
    }

    // ── Simple gravity ──
    this.vy+=(-14)*dt;
    this.group.position.y+=this.vy*dt;
    if(this.group.position.y<=1.0) {
      this.group.position.y=1.0;
      if(this.vy<-2) AudioSystem.synth('land',{volume:0.2});
      this.vy=0; this.grounded=true;
    } else { this.grounded=false; }

    // ── Jump — keyboard Space ──
    if((Input.pressed('Space')||Input.pressed(' '))&&this.grounded) {
      this.vy=this.jumpForce;
      this.grounded=false;
      AudioSystem.synth('jump',{volume:0.3});
    }

    // ── Camera — directly above head, slight angle (1v1.lol style) ──
    const headPos=new THREE.Vector3(
      this.group.position.x,
      this.group.position.y+1.45, // head height
      this.group.position.z
    );

    // Camera sits above and slightly behind
    const camHeight=5.5;
    const camBack=1.2;
    const camX=headPos.x - Math.sin(this.yaw)*camBack;
    const camY=headPos.y + camHeight;
    const camZ=headPos.z - Math.cos(this.yaw)*camBack;

    this.camera.position.set(camX,camY,camZ);
    // Look at a point just in front of the player at head level
    const lookTarget=new THREE.Vector3(
      this.group.position.x + Math.sin(this.yaw)*2,
      this.group.position.y+0.8,
      this.group.position.z + Math.cos(this.yaw)*2  // Wait — should be negative for forward
    );
    // Forward is -Z in three.js
    lookTarget.set(
      this.group.position.x - Math.sin(this.yaw)*1.5,
      this.group.position.y+0.5,
      this.group.position.z - Math.cos(this.yaw)*1.5
    );
    this.camera.lookAt(lookTarget);

    // Rotate rig body to face movement direction
    if(moving) {
      const targetYaw=Math.atan2(moveX,-moveZ)+this.yaw;
      this.group.rotation.y=THREE.MathUtils.lerp(this.group.rotation.y,this.yaw,0.15);
    }
  },

  despawn() {
    this.active=false;
    if(this.group&&this.scene) { this.scene.remove(this.group); this.group=null; }
    document.getElementById('rig-joy-overlay')?.remove();
    this.joyX=0; this.joyY=0; this.joyActive=false;
  }
};

/* ══════════════════════════════════════
   CODE EDITOR
══════════════════════════════════════ */
const CodeEditor = {
  files: {}, activeFile: null,

  init() {
    const saved=localStorage.getItem('cengine_scripts');
    if(saved) try { this.files=JSON.parse(saved); } catch(e) { this.files={}; }

    // Seed defaults
    if(!this.files['PlayerController.js']) this.files['PlayerController.js']=`// PlayerController.js
// Attach to your Player entity

class PlayerController {
  onStart() {
    this.speed = 5;
    this.jumpForce = 8;
    CEngine.log('Player ready');
  }

  onUpdate(dt) {
    const h = Input.axis('horizontal');
    const v = Input.axis('vertical');
    if (h !== 0 || v !== 0) {
      this.transform.position.x += h * this.speed * dt;
      this.transform.position.z -= v * this.speed * dt;
    }
    if (Input.pressed('Space') && this.rb.grounded) {
      this.rb.addForce(0, this.jumpForce, 0);
      Sound.Synth.play('jump', { volume: 0.3 });
    }
  }

  onCollide(other) {
    CEngine.log('Hit: ' + other.name);
  }
}`;

    if(!this.files['EnemyAI.js']) this.files['EnemyAI.js']=`// EnemyAI.js
class EnemyAI {
  onStart() {
    this.speed = 2;
    this.health = 100;
    CEngine.log('Enemy ready');
  }

  onUpdate(dt) {
    const player = Scene.find('Player');
    if (!player) return;
    const dir = Vector3.normalize(Vector3.sub(player.transform.position, this.transform.position));
    const dist = Vector3.distance(player.transform.position, this.transform.position);
    if (dist < 10 && dist > 1) {
      this.transform.position.x += dir.x * this.speed * dt;
      this.transform.position.z += dir.z * this.speed * dt;
    }
  }

  takeDamage(amount) {
    this.health -= amount;
    Sound.Synth.play('hit', { volume: 0.4 });
    if (this.health <= 0) {
      Sound.Synth.play('explosion', { volume: 0.5 });
      this.entity.destroy();
    }
  }
}`;

    if(!this.files['GameManager.js']) this.files['GameManager.js']=`// GameManager.js
class GameManager {
  onStart() {
    this.score = 0;
    this.lives = 3;
    CEngine.log('Game started');
  }

  addScore(points) {
    this.score += points;
    Sound.Synth.play('coin', { volume: 0.4 });
    CEngine.log('Score: ' + this.score);
  }

  gameOver() {
    Sound.Synth.play('death', { volume: 0.6 });
    CEngine.log('GAME OVER — Score: ' + this.score);
  }
}`;

    this._save();
    this.activeFile='PlayerController.js';
  },

  _save() { localStorage.setItem('cengine_scripts',JSON.stringify(this.files)); },

  getContent() {
    if(window.monacoEditor) return window.monacoEditor.getValue();
    const ta=document.querySelector('#monaco-container textarea');
    return ta?ta.value:null;
  },

  setContent(text) {
    if(window.monacoEditor) window.monacoEditor.setValue(text);
    else {
      const ta=document.querySelector('#monaco-container textarea');
      if(ta) ta.value=text;
    }
  },

  newFile() {
    const name=prompt('Script name (e.g. MyScript.js):');
    if(!name?.trim()) return;
    const safe=name.trim();
    const cls=safe.replace(/\.js$/,'').replace(/[^a-zA-Z0-9]/g,'');
    this.files[safe]=`// ${safe}\nclass ${cls} {\n  onStart() {\n    CEngine.log('${cls} started');\n  }\n\n  onUpdate(dt) {\n    \n  }\n}`;
    this._save();
    this.open(safe);
    toast('Created: '+safe,'success');
  },

  open(name) {
    this.activeFile=name;
    const content=this.files[name]||'';
    this.setContent(content);
    const fn=document.getElementById('code-file-name');
    if(fn) fn.textContent=name;
    // Open code tab
    document.querySelector('.center-tab[data-tab="code"]')?.click();
  },

  save() {
    if(!this.activeFile) return;
    const c=this.getContent();
    if(c===null) return;
    this.files[this.activeFile]=c;
    this._save();
    toast('Saved: '+this.activeFile,'success');
    Console.log('Saved: '+this.activeFile,'log','CodeEditor.js');
  },

  run() {
    if(!this.activeFile) return;
    const c=this.getContent();
    if(!c) return;
    this.files[this.activeFile]=c;
    this._save();
    try {
      new Function(c)();
      toast('Executed: '+this.activeFile,'success');
    } catch(e) {
      Console.log('Error: '+e.message,'error',this.activeFile);
      toast('Error: '+e.message,'error',4000);
    }
  },

  attachToSelected() {
    const entity=SceneData.getById(SceneData.selected);
    if(!entity) { toast('Select an entity first','warn'); return; }
    const c=this.getContent();
    if(!c) return;
    if(!entity.components) entity.components=[];
    const idx=entity.components.findIndex(x=>x.name===this.activeFile);
    if(idx!==-1) entity.components[idx].code=c;
    else entity.components.push({type:'script',name:this.activeFile,code:c});
    toast('Attached '+this.activeFile+' → '+entity.name,'success');
    Console.log('Attached script to: '+entity.name,'log','CodeEditor.js');
  }
};

/* ══════════════════════════════════════
   AI HELPER
══════════════════════════════════════ */
const AIHelper = {
  open: false,
  history: [],

  init() {
    // Build UI
    const panel=document.createElement('div');
    panel.id='ai-helper-panel';
    panel.style.cssText=`
      position:fixed;right:16px;bottom:80px;width:320px;max-height:480px;
      background:#1e1e1e;border:1px solid #3a3a3a;border-radius:8px;
      display:flex;flex-direction:column;z-index:1000;
      box-shadow:0 8px 32px rgba(0,0,0,0.5);font-family:Inter,sans-serif;
    `;
    panel.classList.add('hidden');
    panel.innerHTML=`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #3a3a3a;background:#111;border-radius:8px 8px 0 0">
        <span style="font-size:12px;font-weight:700;color:#00a4dc;letter-spacing:0.05em">✦ AI HELPER</span>
        <button id="ai-helper-close" style="background:transparent;border:none;color:#666;font-size:16px;cursor:pointer;line-height:1">✕</button>
      </div>
      <div id="ai-helper-msgs" style="flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px;min-height:100px;max-height:320px;"></div>
      <div style="padding:8px;border-top:1px solid #3a3a3a;display:flex;gap:6px;">
        <input id="ai-helper-input" type="text" placeholder="Ask anything about CEngine..." autocomplete="off"
          style="flex:1;background:#141414;border:1px solid #3a3a3a;color:#ccc;padding:8px;border-radius:4px;font-size:12px;outline:none;font-family:inherit"/>
        <button id="ai-helper-send" style="background:#005570;border:1px solid rgba(0,164,220,0.4);color:#00a4dc;padding:8px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:700;">Send</button>
      </div>`;
    document.body.appendChild(panel);

    document.getElementById('ai-helper-close')?.addEventListener('click',()=>this.toggle());
    document.getElementById('ai-helper-send')?.addEventListener('click',()=>this.send());
    document.getElementById('ai-helper-input')?.addEventListener('keydown',e=>{ if(e.key==='Enter') this.send(); });

    // Add button to toolbar
    const bar=document.getElementById('insert-toolbar');
    if(bar) {
      const div=document.createElement('div');
      div.style.cssText='margin-left:auto;flex-shrink:0;';
      div.innerHTML='<button id="btn-ai-helper" class="insert-btn" style="background:rgba(0,84,112,0.3);border-color:rgba(0,164,220,0.3);color:#00a4dc;padding:0 10px;height:28px;font-size:10px;font-weight:700;letter-spacing:0.05em;">✦ AI</button>';
      bar.appendChild(div);
      document.getElementById('btn-ai-helper')?.addEventListener('click',()=>this.toggle());
    }

    this._addMsg('assistant','Hi! I\'m your CEngine AI helper. Ask me how to make scripts, add physics, create enemies, build shooting mechanics — anything!');
  },

  toggle() {
    this.open=!this.open;
    const panel=document.getElementById('ai-helper-panel');
    if(panel) panel.classList.toggle('hidden',!this.open);
    if(this.open) document.getElementById('ai-helper-input')?.focus();
  },

  _addMsg(role, text) {
    const msgs=document.getElementById('ai-helper-msgs');
    if(!msgs) return;
    const div=document.createElement('div');
    div.style.cssText=role==='user'
      ?'background:#1a3a4a;border:1px solid rgba(0,164,220,0.2);padding:8px 10px;border-radius:6px;font-size:11px;color:#ccc;line-height:1.5;align-self:flex-end;max-width:90%'
      :'background:#252525;border:1px solid #3a3a3a;padding:8px 10px;border-radius:6px;font-size:11px;color:#ccc;line-height:1.5;max-width:95%;white-space:pre-wrap';
    if(role==='assistant') div.innerHTML='<span style="color:#00a4dc;font-weight:700;font-size:10px;">✦ AI  </span>'+text.replace(/`([^`]+)`/g,'<code style="background:#111;padding:1px 4px;border-radius:3px;font-family:monospace;color:#88ccff;font-size:10px">$1</code>');
    else div.textContent=text;
    msgs.appendChild(div);
    msgs.scrollTop=msgs.scrollHeight;
  },

  async send() {
    const inp=document.getElementById('ai-helper-input');
    if(!inp||!inp.value.trim()) return;
    const msg=inp.value.trim();
    inp.value='';
    this._addMsg('user',msg);

    // Loading indicator
    const loading=document.createElement('div');
    loading.style.cssText='color:#555;font-size:11px;padding:4px 10px;';
    loading.textContent='✦ thinking...';
    document.getElementById('ai-helper-msgs')?.appendChild(loading);

    this.history.push({role:'user',content:msg});

    try {
      const response=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          model:'claude-sonnet-4-20250514',
          max_tokens:1000,
          system:`You are a helpful assistant for CEngine, a browser-based 3D game engine built with Three.js r128.

CEngine uses class-based scripts with these lifecycle methods:
- onStart() — runs once when play is pressed
- onUpdate(dt) — runs every frame, dt is delta time in seconds  
- onStop() — runs when stop is pressed
- onCollide(other) — runs on collision

Available APIs in scripts:
- Input.held('d'), Input.pressed('Space'), Input.axis('horizontal')
- Sound.Synth.play('jump'/'shoot'/'explosion'/'hit'/'coin'/'death', {volume, pitch})
- Scene.find('EntityName'), Scene.spawn('name', {x,y,z}), Scene.destroy(entity)
- this.transform.position.x/y/z, this.transform.rotation, this.transform.scale
- this.rb.addForce(x,y,z), this.rb.setVelocity(x,y,z), this.rb.grounded
- this.entity.name, this.entity.destroy()
- Vector3.add/sub/scale/normalize/distance/length
- CEngine.log('message')

Be concise. Give working code examples when relevant. Use backticks for code.`,
          messages:this.history.slice(-10)
        })
      });

      loading.remove();

      if(!response.ok) {
        const err=await response.json();
        this._addMsg('assistant','API error: '+( err.error?.message||response.status));
        this.history.pop();
        return;
      }

      const data=await response.json();
      const reply=data.content?.[0]?.text||'No response';
      this._addMsg('assistant',reply);
      this.history.push({role:'assistant',content:reply});
    } catch(e) {
      loading.remove();
      this._addMsg('assistant','Connection error. Make sure you\'re running CEngine from a server, not file://');
      this.history.pop();
    }
  }
};

/* ══════════════════════════════════════
   THREE.JS SCENE VIEW
══════════════════════════════════════ */
const SceneView = {
  renderer:null, scene:null, camera:null,
  gizmoRenderer:null, gizmoScene:null, gizmoCamera:null,
  transformGizmoGroup:null, raycaster:null, mouse:null, grid:null,
  theta:0.5, phi:1.0, radius:12, orbitTarget:null,
  orbitDragging:false, orbitLastX:0, orbitLastY:0,
  transformDragging:false, transformStartPos:null, transformStartRot:null, transformStartScl:null,
  _justFinishedDrag:false,
  touchOrbit:false, touchLastX:0, touchLastY:0, touchLastDist:0,
  touchTransform:false, touchTransformStartPos:null, touchTransformStartRot:null, touchTransformStartScl:null,
  gyroEnabled:false, transformMode:'translate', playing:false,

  init() {
    const canvas=document.getElementById('scene-canvas');
    if(!canvas||typeof THREE==='undefined') { Console.log('THREE.js not loaded','error','SceneView.js'); return; }
    this.raycaster=new THREE.Raycaster();
    this.mouse=new THREE.Vector2();
    this.orbitTarget=new THREE.Vector3(0,0,0);

    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.1;

    this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color(0x111111);
    this.scene.fog=new THREE.FogExp2(0x111111,0.016);

    this.camera=new THREE.PerspectiveCamera(60,1,0.1,1000);
    this._syncCamera();

    this.scene.add(new THREE.AmbientLight(0x303040,1.8));
    const dl=new THREE.DirectionalLight(0xfff0e0,2.2);
    dl.position.set(8,14,6); dl.castShadow=true;
    dl.shadow.mapSize.set(2048,2048);
    dl.shadow.camera.near=0.1; dl.shadow.camera.far=80;
    dl.shadow.camera.left=dl.shadow.camera.bottom=-20;
    dl.shadow.camera.right=dl.shadow.camera.top=20;
    this.scene.add(dl);
    this.scene.add(new THREE.PointLight(0x204060,1.2,30).position.set(-8,4,-6) && new THREE.PointLight(0x204060,1.2,30));

    this.grid=new THREE.GridHelper(40,40,0x1e1e1e,0x181818);
    this.scene.add(this.grid);

    const ground=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:0x0d0d0d,roughness:1}));
    ground.rotation.x=-Math.PI/2; ground.position.y=-0.001; ground.receiveShadow=true;
    this.scene.add(ground);

    this._initGizmoViewport();
    this._initTransformGizmo();
    this._bindOrbitEvents(canvas);
    this._bindTransformDrag(canvas);
    this._bindKeyboard();
    this._initGyro();

    window.addEventListener('resize',()=>this._resize());
    this._resize();
    this._buildDefaultScene();
    this._loop();

    Console.log('SceneView ready — Three.js r128','log','SceneView.js');
  },

  _buildDefaultScene() {
    const floorMesh=new THREE.Mesh(new THREE.BoxGeometry(8,0.2,8),new THREE.MeshStandardMaterial({color:0x2a2a2a,roughness:0.9}));
    floorMesh.receiveShadow=true; floorMesh.position.set(0,-0.1,0);
    this.scene.add(floorMesh);
    const fe=SceneData.add('Floor','mesh',floorMesh); fe.position={x:0,y:-0.1,z:0};

    const cubeMesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x4488cc,roughness:0.4,metalness:0.2}));
    cubeMesh.castShadow=true; cubeMesh.receiveShadow=true; cubeMesh.position.set(0,0.5,0);
    this.scene.add(cubeMesh);
    const ce=SceneData.add('Cube','mesh',cubeMesh); ce.position={x:0,y:0.5,z:0};

    HierarchyPanel.refresh();
  },

  _syncCamera() {
    if(!this.camera||!this.orbitTarget) return;
    this.camera.position.set(
      this.orbitTarget.x+this.radius*Math.sin(this.phi)*Math.sin(this.theta),
      this.orbitTarget.y+this.radius*Math.cos(this.phi),
      this.orbitTarget.z+this.radius*Math.sin(this.phi)*Math.cos(this.theta)
    );
    this.camera.lookAt(this.orbitTarget);
  },

  _initGizmoViewport() {
    const gc=document.getElementById('gizmo-canvas');
    if(!gc) return;
    this.gizmoRenderer=new THREE.WebGLRenderer({canvas:gc,alpha:true,antialias:true});
    this.gizmoRenderer.setSize(70,70);
    this.gizmoScene=new THREE.Scene();
    this.gizmoCamera=new THREE.PerspectiveCamera(50,1,0.1,100);
    this.gizmoCamera.position.set(0,0,3);
    [{dir:new THREE.Vector3(1,0,0),color:0xcc3333},{dir:new THREE.Vector3(0,1,0),color:0x33aa33},{dir:new THREE.Vector3(0,0,1),color:0x3366cc}].forEach(({dir,color})=>{
      const mat=new THREE.MeshBasicMaterial({color,depthTest:false});
      const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir);
      const body=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.7,8),mat);
      const tip=new THREE.Mesh(new THREE.ConeGeometry(0.12,0.28,8),mat);
      body.position.copy(dir.clone().multiplyScalar(0.35)); body.quaternion.copy(q);
      tip.position.copy(dir.clone().multiplyScalar(0.84));  tip.quaternion.copy(q);
      this.gizmoScene.add(body,tip);
    });
  },

  _initTransformGizmo() {
    this.transformGizmoGroup=new THREE.Group();
    this.transformGizmoGroup.visible=false;
    this.transformGizmoGroup.renderOrder=999;
    [{dir:new THREE.Vector3(1,0,0),color:0xdd2222},{dir:new THREE.Vector3(0,1,0),color:0x22aa22},{dir:new THREE.Vector3(0,0,1),color:0x2244dd}].forEach(({dir,color})=>{
      const mat=new THREE.MeshBasicMaterial({color,depthTest:false});
      const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir);
      const body=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,1.0,8),mat.clone());
      const tip=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.24,8),mat.clone());
      body.position.copy(dir.clone().multiplyScalar(0.5)); body.quaternion.copy(q);
      tip.position.copy(dir.clone().multiplyScalar(1.12)); tip.quaternion.copy(q);
      this.transformGizmoGroup.add(body,tip);
    });
    this.scene.add(this.transformGizmoGroup);
  },

  showGizmo(entity) {
    if(!entity||!entity.mesh) { this.transformGizmoGroup.visible=false; return; }
    this.transformGizmoGroup.visible=true;
    this.transformGizmoGroup.position.copy(entity.mesh.position);
  },

  _bindOrbitEvents(canvas) {
    canvas.addEventListener('mousedown',e=>{
      if(e.button===2) { this.orbitDragging=true; this.orbitLastX=e.clientX; this.orbitLastY=e.clientY; canvas.style.cursor='grabbing'; e.preventDefault(); }
    });
    document.addEventListener('mousemove',e=>{
      if(!this.orbitDragging) return;
      this.theta-=(e.clientX-this.orbitLastX)*0.007;
      this.phi=Math.max(0.05,Math.min(Math.PI-0.05,this.phi+(e.clientY-this.orbitLastY)*0.007));
      this.orbitLastX=e.clientX; this.orbitLastY=e.clientY;
      this._syncCamera();
    });
    document.addEventListener('mouseup',e=>{ if(e.button===2) { this.orbitDragging=false; canvas.style.cursor=''; } });
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('wheel',e=>{ this.radius=Math.max(1.5,Math.min(100,this.radius+e.deltaY*0.022)); this._syncCamera(); e.preventDefault(); },{passive:false});

    canvas.addEventListener('touchstart',e=>{
      if(e.touches.length===1) { this.touchOrbit=true; this.touchLastX=e.touches[0].clientX; this.touchLastY=e.touches[0].clientY; }
      if(e.touches.length===2) { this.touchOrbit=false; const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY; this.touchLastDist=Math.sqrt(dx*dx+dy*dy); }
      e.preventDefault();
    },{passive:false});

    canvas.addEventListener('touchmove',e=>{
      if(e.touches.length===1&&this.touchOrbit&&!this.touchTransform) {
        this.theta-=(e.touches[0].clientX-this.touchLastX)*0.007;
        this.phi=Math.max(0.05,Math.min(Math.PI-0.05,this.phi+(e.touches[0].clientY-this.touchLastY)*0.007));
        this.touchLastX=e.touches[0].clientX; this.touchLastY=e.touches[0].clientY;
        this._syncCamera();
      }
      if(e.touches.length===2) {
        const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;
        const dist=Math.sqrt(dx*dx+dy*dy);
        this.radius=Math.max(1.5,Math.min(100,this.radius-(dist-this.touchLastDist)*0.04));
        this.touchLastDist=dist; this._syncCamera();
      }
      e.preventDefault();
    },{passive:false});

    canvas.addEventListener('touchend',e=>{ if(e.touches.length===0) { this.touchOrbit=false; this.touchTransform=false; this.touchTransformStartPos=null; } });

    // WASD pan (editor mode only)
    const keys={};
    document.addEventListener('keydown',e=>{ keys[e.key.toLowerCase()]=true; });
    document.addEventListener('keyup',  e=>{ keys[e.key.toLowerCase()]=false; });
    setInterval(()=>{
      if(this.playing) return; // WASD goes to player rig in play mode
      const tag=document.activeElement?.tagName;
      if(tag==='INPUT'||tag==='TEXTAREA') return;
      const speed=0.05;
      const fwd=new THREE.Vector3(-Math.sin(this.theta),0,-Math.cos(this.theta));
      const right=new THREE.Vector3(Math.cos(this.theta),0,-Math.sin(this.theta));
      if(keys['w']){this.orbitTarget.addScaledVector(fwd,speed);this._syncCamera();}
      if(keys['s']){this.orbitTarget.addScaledVector(fwd,-speed);this._syncCamera();}
      if(keys['a']){this.orbitTarget.addScaledVector(right,-speed);this._syncCamera();}
      if(keys['d']){this.orbitTarget.addScaledVector(right,speed);this._syncCamera();}
      if(keys['q']){this.orbitTarget.y-=speed;this._syncCamera();}
      if(keys['e']){this.orbitTarget.y+=speed;this._syncCamera();}
    },16);
  },

  _bindTransformDrag(canvas) {
    const THRESHOLD=4;
    const applyDelta=(entity,dx,dy)=>{
      const sensitivity=this.radius*0.0035;
      const camRight=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0).normalize();
      const camUp=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,1).normalize();
      if(this.transformMode==='translate') {
        entity.mesh.position.copy(this.transformStartPos);
        entity.mesh.position.addScaledVector(camRight,dx*sensitivity);
        entity.mesh.position.addScaledVector(camUp,-dy*sensitivity);
        entity.position={x:entity.mesh.position.x,y:entity.mesh.position.y,z:entity.mesh.position.z};
      } else if(this.transformMode==='rotate') {
        entity.mesh.rotation.y=this.transformStartRot.y+dx*0.012;
        entity.mesh.rotation.x=this.transformStartRot.x+dy*0.012;
        entity.rotation={x:THREE.MathUtils.radToDeg(entity.mesh.rotation.x),y:THREE.MathUtils.radToDeg(entity.mesh.rotation.y),z:THREE.MathUtils.radToDeg(entity.mesh.rotation.z)};
      } else if(this.transformMode==='scale') {
        const factor=Math.max(0.01,1+dx*0.009);
        entity.mesh.scale.copy(this.transformStartScl).multiplyScalar(factor);
        entity.scale={x:entity.mesh.scale.x,y:entity.mesh.scale.y,z:entity.mesh.scale.z};
      }
      this.transformGizmoGroup.position.copy(entity.mesh.position);
      Inspector.update(entity);
    };

    let mouseStartX=0,mouseStartY=0,mouseDragging=false;
    canvas.addEventListener('mousedown',e=>{
      if(e.button!==0) return;
      mouseStartX=e.clientX; mouseStartY=e.clientY; mouseDragging=false;
      const entity=SceneData.getById(SceneData.selected);
      if(!entity||!entity.mesh) return;
      this.transformStartPos=entity.mesh.position.clone();
      this.transformStartRot={x:entity.mesh.rotation.x,y:entity.mesh.rotation.y,z:entity.mesh.rotation.z};
      this.transformStartScl=entity.mesh.scale.clone();
    });
    document.addEventListener('mousemove',e=>{
      if(this.orbitDragging||!this.transformStartPos) return;
      const dx=e.clientX-mouseStartX,dy=e.clientY-mouseStartY;
      if(!mouseDragging&&Math.sqrt(dx*dx+dy*dy)<THRESHOLD) return;
      mouseDragging=true; this.transformDragging=true;
      const entity=SceneData.getById(SceneData.selected);
      if(!entity||!entity.mesh) return;
      applyDelta(entity,dx,dy);
    });
    document.addEventListener('mouseup',e=>{
      if(e.button!==0) return;
      if(mouseDragging) { this._justFinishedDrag=true; setTimeout(()=>{this._justFinishedDrag=false;},50); }
      mouseDragging=false; this.transformDragging=false;
      this.transformStartPos=null; this.transformStartRot=null; this.transformStartScl=null;
    });

    canvas.addEventListener('click',e=>{
      if(this._justFinishedDrag) return;
      const rect=canvas.getBoundingClientRect();
      this.mouse.x=((e.clientX-rect.left)/rect.width)*2-1;
      this.mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
      this.raycaster.setFromCamera(this.mouse,this.camera);
      const meshes=SceneData.entities.filter(en=>en.mesh&&en.active).map(en=>en.mesh);
      const hits=this.raycaster.intersectObjects(meshes,true);
      if(hits.length>0) {
        let hit=hits[0].object;
        while(hit.parent&&hit.parent!==this.scene) { if(SceneData.entities.find(en=>en.mesh===hit)) break; hit=hit.parent; }
        const entity=SceneData.entities.find(en=>en.mesh===hit);
        if(entity) { SceneData.select(entity.id); HierarchyPanel.selectItem(entity.id); AudioSystem.click(); }
      } else {
        SceneData.selected=null; Inspector.clear(); this.transformGizmoGroup.visible=false; HierarchyPanel.clearSelection();
      }
    });

    // Touch transform
    let touchDragStartX=0,touchDragStartY=0,touchDragging=false;
    canvas.addEventListener('touchstart',e=>{
      if(e.touches.length!==1) return;
      const entity=SceneData.getById(SceneData.selected);
      if(!entity||!entity.mesh) return;
      const touch=e.touches[0], rect=canvas.getBoundingClientRect();
      const mx=((touch.clientX-rect.left)/rect.width)*2-1;
      const my=-((touch.clientY-rect.top)/rect.height)*2+1;
      const tempRay=new THREE.Raycaster();
      tempRay.setFromCamera(new THREE.Vector2(mx,my),this.camera);
      const hits=tempRay.intersectObject(entity.mesh,true);
      if(hits.length>0) {
        touchDragStartX=touch.clientX; touchDragStartY=touch.clientY;
        touchDragging=false; this.touchTransform=false;
        this.touchTransformStartPos=entity.mesh.position.clone();
        this.touchTransformStartRot={x:entity.mesh.rotation.x,y:entity.mesh.rotation.y,z:entity.mesh.rotation.z};
        this.touchTransformStartScl=entity.mesh.scale.clone();
        this.touchOrbit=false;
      }
    },{passive:true});

    canvas.addEventListener('touchmove',e=>{
      if(e.touches.length!==1||!this.touchTransformStartPos) return;
      const touch=e.touches[0];
      const dx=touch.clientX-touchDragStartX,dy=touch.clientY-touchDragStartY;
      if(!touchDragging&&Math.sqrt(dx*dx+dy*dy)<THRESHOLD) return;
      touchDragging=true; this.touchTransform=true; this.touchOrbit=false;
      const entity=SceneData.getById(SceneData.selected);
      if(!entity||!entity.mesh) return;
      const pp=this.transformStartPos,pr=this.transformStartRot,ps=this.transformStartScl;
      this.transformStartPos=this.touchTransformStartPos;
      this.transformStartRot=this.touchTransformStartRot;
      this.transformStartScl=this.touchTransformStartScl;
      applyDelta(entity,dx,dy);
      this.transformStartPos=pp; this.transformStartRot=pr; this.transformStartScl=ps;
    },{passive:true});

    canvas.addEventListener('touchend',e=>{
      touchDragging=false; this.touchTransform=false; this.touchTransformStartPos=null;
    });
  },

  _bindKeyboard() {
    document.addEventListener('keydown',e=>{
      const tag=document.activeElement?.tagName;
      if(tag==='INPUT'||tag==='TEXTAREA') return;
      if(e.ctrlKey||e.metaKey) {
        if(e.key==='s'){e.preventDefault();SceneData.save();}
        if(e.key==='d'){e.preventDefault();this.duplicateSelected();}
        if(e.key==='p'){e.preventDefault();document.getElementById('btn-play')?.click();}
        if(e.key==='z'){e.preventDefault();toast('Undo — coming soon','warn');}
        return;
      }
      const modeMap={'g':'translate','r':'rotate','s':'scale'};
      if(modeMap[e.key.toLowerCase()]) {
        this.setTransformMode(modeMap[e.key.toLowerCase()]);
        document.querySelectorAll('.transform-tool').forEach(b=>b.classList.toggle('active',b.dataset.transform===modeMap[e.key.toLowerCase()]));
        return;
      }
      if(e.key==='Delete'||e.key==='Backspace') this.deleteSelected();
      if(e.key==='f'||e.key==='F') this.focusSelected();
      if(e.key==='n'||e.key==='N') this.addPrimitive('cube');
      if(e.key==='Escape') { closeAllMenus(); ContextMenu.hide(); closeBuildModal(); }
    });
  },

  _initGyro() {
    const start=()=>{
      window.addEventListener('deviceorientation',e=>{
        if(!this.gyroEnabled) return;
        const beta=THREE.MathUtils.degToRad(e.beta||0),alpha=THREE.MathUtils.degToRad(e.alpha||0);
        this.phi=THREE.MathUtils.lerp(this.phi,Math.max(0.1,Math.min(Math.PI-0.1,beta)),0.08);
        this.theta=THREE.MathUtils.lerp(this.theta,-alpha*0.5,0.04);
        this._syncCamera();
      },true);
    };
    if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function') {
      window._requestGyro=()=>DeviceOrientationEvent.requestPermission().then(s=>{if(s==='granted'){start();this.gyroEnabled=true;}}).catch(console.error);
    } else { start(); }
  },

  toggleGyro() {
    if(window._requestGyro&&!this.gyroEnabled){window._requestGyro();toast('Gyro enabled','success');}
    else{this.gyroEnabled=!this.gyroEnabled;toast(this.gyroEnabled?'Gyro ON':'Gyro OFF');}
  },

  addPrimitive(type) {
    const geoMap={
      cube:()=>new THREE.BoxGeometry(1,1,1),sphere:()=>new THREE.SphereGeometry(0.5,24,24),
      cylinder:()=>new THREE.CylinderGeometry(0.5,0.5,1,24),plane:()=>new THREE.PlaneGeometry(2,2),
      cone:()=>new THREE.ConeGeometry(0.5,1,24),torus:()=>new THREE.TorusGeometry(0.5,0.18,16,48),
      capsule:()=>new THREE.CylinderGeometry(0.35,0.35,1,16)
    };
    const colors={cube:0x4488cc,sphere:0xcc6633,cylinder:0x44aa66,plane:0x888888,cone:0xccaa22,torus:0xcc4488,capsule:0x8844cc};
    const geo=(geoMap[type]||geoMap.cube)();
    const mat=new THREE.MeshStandardMaterial({color:colors[type]||0x888888,roughness:0.5,metalness:0.1});
    const mesh=new THREE.Mesh(geo,mat);
    mesh.castShadow=true; mesh.receiveShadow=true;
    if(type==='plane'){mesh.rotation.x=-Math.PI/2;mesh.position.y=0.01;}
    else mesh.position.set((Math.random()-0.5)*3,0.5,(Math.random()-0.5)*3);
    this.scene.add(mesh);
    const name=type.charAt(0).toUpperCase()+type.slice(1);
    const entity=SceneData.add(name,'mesh',mesh);
    entity.position={x:mesh.position.x,y:mesh.position.y,z:mesh.position.z};
    HierarchyPanel.refresh(); SceneData.select(entity.id); HierarchyPanel.selectItem(entity.id);
    AudioSystem.tone(880,0.1,0.04); toast('Added '+name,'success'); Console.log('Added: '+name,'log','Scene.js');
    return entity;
  },

  addLight(type) {
    let light;
    const name=type==='point'?'Point Light':type==='spot'?'Spot Light':'Dir Light';
    if(type==='point'){light=new THREE.PointLight(0xffffff,1.5,20);light.position.set(2,4,2);this.scene.add(light);this.scene.add(new THREE.PointLightHelper(light,0.3));}
    else if(type==='spot'){light=new THREE.SpotLight(0xffffff,2,30,Math.PI/5);light.position.set(0,7,0);this.scene.add(light);this.scene.add(new THREE.SpotLightHelper(light));}
    else{light=new THREE.DirectionalLight(0xffffff,1.5);light.position.set(4,7,4);this.scene.add(light);this.scene.add(new THREE.DirectionalLightHelper(light,1));}
    SceneData.add(name,'light',null); HierarchyPanel.refresh();
    toast('Added '+name,'success'); AudioSystem.tone(660,0.1,0.03);
  },

  deleteSelected() {
    if(!SceneData.selected) return;
    SceneData.remove(SceneData.selected);
    this.transformGizmoGroup.visible=false;
    HierarchyPanel.refresh(); toast('Deleted','warn'); Console.log('Entity deleted','warn','Scene.js');
  },

  duplicateSelected() {
    const ne=SceneData.duplicate(SceneData.selected);
    if(!ne) return;
    HierarchyPanel.refresh(); SceneData.select(ne.id); HierarchyPanel.selectItem(ne.id);
    toast('Duplicated: '+ne.name,'success');
  },

  focusSelected() {
    const e=SceneData.getById(SceneData.selected);
    if(!e||!e.mesh) return;
    this.orbitTarget.copy(e.mesh.position); this.radius=4; this._syncCamera();
  },

  setTransformMode(mode) { this.transformMode=mode; Console.log('Transform mode: '+mode,'log','Editor.js'); },
  toggleGrid(v) { if(this.grid) this.grid.visible=v; },
  toggleWireframe(v) { SceneData.entities.forEach(e=>{ if(e.mesh?.material) e.mesh.material.wireframe=v; }); },

  _resize() {
    const canvas=document.getElementById('scene-canvas');
    if(!canvas||!this.renderer) return;
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if(!w||!h) return;
    this.renderer.setSize(w,h,false);
    this.camera.aspect=w/h; this.camera.updateProjectionMatrix();
  },

  _loop() {
    requestAnimationFrame(()=>this._loop());
    if(!this.renderer) return;
    if(this.transformGizmoGroup.visible) {
      const sel=SceneData.getById(SceneData.selected);
      if(sel?.mesh) {
        this.transformGizmoGroup.position.copy(sel.mesh.position);
        const dist=this.camera.position.distanceTo(sel.mesh.position);
        this.transformGizmoGroup.scale.setScalar(dist*0.1);
      }
    }
    this.renderer.render(this.scene,this.camera);
    if(this.gizmoRenderer&&this.gizmoScene&&this.gizmoCamera) {
      const dir=new THREE.Vector3().subVectors(this.camera.position,this.orbitTarget).normalize().multiplyScalar(3);
      this.gizmoCamera.position.copy(dir); this.gizmoCamera.lookAt(0,0,0);
      this.gizmoRenderer.render(this.gizmoScene,this.gizmoCamera);
    }
  }
};

/* ══════════════════════════════════════
   HIERARCHY PANEL
══════════════════════════════════════ */
const HierarchyPanel = {
  tree: document.getElementById('scene-children'),
  refresh() {
    if(!this.tree) return;
    this.tree.innerHTML='';
    SceneData.entities.forEach(entity=>{
      const item=document.createElement('div');
      item.className='tree-item'+(SceneData.selected===entity.id?' selected':'');
      item.dataset.entityId=entity.id;
      const icons={
        mesh:'<svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1l5 3v4l-5 3-5-3V4z" stroke="#6688cc" stroke-width="1.2" fill="none"/></svg>',
        light:'<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="5" r="2.5" stroke="#ccaa33" stroke-width="1.2" fill="none"/><path d="M6 8v2M3 7l-1 1M9 7l1 1" stroke="#ccaa33" stroke-width="1.2"/></svg>',
        empty:'<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4" stroke="#555" stroke-width="1.2" fill="none" stroke-dasharray="2 2"/></svg>'
      };
      // Show script component badge
      const hasScript=entity.components?.some(c=>c.type==='script');
      item.innerHTML=`<span class="tree-indent"></span><svg class="tree-arrow invisible" width="8" height="8" viewBox="0 0 8 8"><path d="M2 2l4 2-4 2" fill="currentColor"/></svg>${icons[entity.type]||icons.empty}<span class="tree-label">${entity.name}</span>${hasScript?'<span style="font-size:8px;color:#44cc88;margin-left:2px">●</span>':''}<button class="tree-eye" data-id="${entity.id}"><svg width="10" height="10" viewBox="0 0 10 10"><ellipse cx="5" cy="5" rx="4" ry="2.5" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="5" cy="5" r="1.2" fill="currentColor"/></svg></button>`;
      item.addEventListener('click',e=>{
        if(e.target.closest('.tree-eye')) return;
        AudioSystem.click();
        document.querySelectorAll('.tree-item[data-entity-id]').forEach(el=>el.classList.remove('selected'));
        item.classList.add('selected');
        SceneData.select(entity.id);
      });
      item.querySelector('.tree-eye').addEventListener('click',e=>{
        e.stopPropagation();
        entity.active=!entity.active;
        if(entity.mesh) entity.mesh.visible=entity.active;
        item.querySelector('.tree-eye').style.opacity=entity.active?'1':'0.3';
        AudioSystem.click();
      });
      item.addEventListener('contextmenu',e=>{ e.preventDefault(); SceneData.select(entity.id); this.selectItem(entity.id); ContextMenu.show(e.clientX,e.clientY); });
      this.tree.appendChild(item);
    });
  },
  selectItem(id) { document.querySelectorAll('.tree-item[data-entity-id]').forEach(el=>el.classList.toggle('selected',parseInt(el.dataset.entityId)===id)); },
  clearSelection() { document.querySelectorAll('.tree-item[data-entity-id]').forEach(el=>el.classList.remove('selected')); }
};

/* ══════════════════════════════════════
   INSPECTOR PANEL
══════════════════════════════════════ */
const Inspector = {
  body: document.getElementById('inspector-body'),
  update(entity) {
    if(!this.body) return;
    this.body.innerHTML=`
      <div class="inspector-entity-header">
        <input type="checkbox" id="ent-active" ${entity.active?'checked':''}/>
        <input type="text" class="entity-name-input" id="ent-name" value="${entity.name}"/>
        <span class="entity-tag">${entity.type}</span>
      </div>
      <div class="component-block">
        <div class="component-header"><svg class="comp-arrow open" width="8" height="8" viewBox="0 0 8 8"><path d="M1 2l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg><span class="component-title">Transform</span></div>
        <div class="component-body">${this._vec3('Position','pos',entity.position)}${this._vec3('Rotation','rot',entity.rotation)}${this._vec3('Scale','scl',entity.scale)}</div>
      </div>
      ${entity.type==='mesh'?this._meshBlock(entity):''}
      ${entity.type==='light'?this._lightBlock():''}
      ${this._scriptsBlock(entity)}
      <div class="add-component-area">
        <button class="add-component-btn" id="btn-add-comp"><svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1v9M1 5.5h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Add Component</button>
        <button class="add-component-btn" id="btn-attach-script" style="margin-top:4px;color:#44cc88;border-color:rgba(68,204,136,0.3);"><svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 3L0.5 5.5 2 8M9 3l1.5 2.5L9 8M6 1.5l-2 8" stroke="currentColor" stroke-width="1.3" fill="none"/></svg> Attach Script</button>
      </div>`;

    [['pos','position'],['rot','rotation'],['scl','scale']].forEach(([prefix,key])=>{
      ['x','y','z'].forEach(axis=>{
        const inp=document.getElementById(prefix+'-'+axis);
        if(!inp) return;
        inp.addEventListener('input',()=>{
          const v=parseFloat(inp.value)||0;
          entity[key][axis]=v;
          if(entity.mesh) {
            if(key==='position') entity.mesh.position[axis]=v;
            if(key==='rotation') entity.mesh.rotation[axis]=THREE.MathUtils.degToRad(v);
            if(key==='scale')    entity.mesh.scale[axis]=v;
            SceneView.transformGizmoGroup.position.copy(entity.mesh.position);
          }
        });
      });
    });

    document.getElementById('ent-name')?.addEventListener('input',function(){entity.name=this.value;HierarchyPanel.refresh();HierarchyPanel.selectItem(entity.id);});
    document.getElementById('ent-active')?.addEventListener('change',function(){entity.active=this.checked;if(entity.mesh)entity.mesh.visible=this.checked;});

    const colorPick=document.getElementById('mesh-color');
    if(colorPick&&entity.mesh?.material) {
      colorPick.value='#'+entity.mesh.material.color.getHexString();
      colorPick.addEventListener('input',function(){entity.mesh.material.color.set(this.value);});
    }

    document.querySelectorAll('.component-header').forEach(hdr=>{
      hdr.addEventListener('click',()=>{
        AudioSystem.click();
        const body=hdr.nextElementSibling;
        if(!body) return;
        const open=body.style.display!=='none';
        body.style.display=open?'none':'';
        hdr.querySelector('.comp-arrow')?.classList.toggle('open',!open);
      });
    });

    document.getElementById('btn-add-comp')?.addEventListener('click',()=>{ AudioSystem.click(); toast('Component system — coming soon','warn'); });
    document.getElementById('btn-attach-script')?.addEventListener('click',()=>{ AudioSystem.click(); CodeEditor.attachToSelected(); });
  },

  _vec3(label,prefix,v={x:0,y:0,z:0}) {
    const fmt=n=>(n||0).toFixed(3);
    return `<div class="prop-row"><span class="prop-label">${label}</span><div class="vec3-inputs"><label class="x-label">X<input id="${prefix}-x" type="number" class="vec-input" value="${fmt(v.x)}" step="0.1"/></label><label class="y-label">Y<input id="${prefix}-y" type="number" class="vec-input" value="${fmt(v.y)}" step="0.1"/></label><label class="z-label">Z<input id="${prefix}-z" type="number" class="vec-input" value="${fmt(v.z)}" step="0.1"/></label></div></div>`;
  },

  _meshBlock(entity) {
    const metal=entity.mesh?.material?.metalness??0.1;
    const rough=entity.mesh?.material?.roughness??0.5;
    return `<div class="component-block"><div class="component-header"><svg class="comp-arrow open" width="8" height="8" viewBox="0 0 8 8"><path d="M1 2l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg><span class="component-title">Mesh Renderer</span></div><div class="component-body"><div class="prop-row"><span class="prop-label">Color</span><input type="color" class="prop-color" id="mesh-color" value="#4488cc"/></div><div class="prop-row"><span class="prop-label">Metalness</span><input type="range" class="prop-slider" min="0" max="1" step="0.01" value="${metal}" oninput="if(window._selMesh)window._selMesh.material.metalness=+this.value"/></div><div class="prop-row"><span class="prop-label">Roughness</span><input type="range" class="prop-slider" min="0" max="1" step="0.01" value="${rough}" oninput="if(window._selMesh)window._selMesh.material.roughness=+this.value"/></div><div class="prop-row"><span class="prop-label">Wireframe</span><input type="checkbox" ${entity.mesh?.material?.wireframe?'checked':''} onchange="if(window._selMesh)window._selMesh.material.wireframe=this.checked" style="accent-color:var(--accent);cursor:pointer"/></div></div></div>`;
  },

  _lightBlock() {
    return `<div class="component-block"><div class="component-header"><svg class="comp-arrow open" width="8" height="8" viewBox="0 0 8 8"><path d="M1 2l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg><span class="component-title">Light</span></div><div class="component-body"><div class="prop-row"><span class="prop-label">Color</span><input type="color" class="prop-color" value="#ffffff"/></div><div class="prop-row"><span class="prop-label">Intensity</span><input type="range" class="prop-slider" min="0" max="5" step="0.1" value="1.5"/></div></div></div>`;
  },

  _scriptsBlock(entity) {
    const scripts=entity.components?.filter(c=>c.type==='script')||[];
    if(!scripts.length) return '';
    const items=scripts.map(s=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid #2a2a2a"><span style="font-size:10px;color:#44cc88;font-family:monospace">● ${s.name}</span><button onclick="CodeEditor.open('${s.name}')" style="background:transparent;border:1px solid #3a3a3a;color:#888;padding:2px 6px;border-radius:3px;font-size:9px;cursor:pointer">Edit</button></div>`).join('');
    return `<div class="component-block"><div class="component-header"><svg class="comp-arrow open" width="8" height="8" viewBox="0 0 8 8"><path d="M1 2l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg><span class="component-title">Scripts</span></div><div class="component-body" style="gap:0">${items}</div></div>`;
  },

  clear() {
    if(!this.body) return;
    this.body.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:var(--text-dim);padding:20px"><svg width="28" height="28" viewBox="0 0 28 28" opacity="0.3"><circle cx="14" cy="10" r="5" stroke="#888" stroke-width="1.5" fill="none"/><path d="M5 24c0-5 4-8 9-8s9 3 9 8" stroke="#888" stroke-width="1.5" fill="none"/></svg><p style="font-size:11px">Select an entity</p><p style="font-size:10px;color:var(--text-dim)">to inspect properties</p></div>`;
  }
};

/* ══════════════════════════════════════
   INSERT TOOLBAR
══════════════════════════════════════ */
function buildInsertToolbar() {
  const menubar=document.getElementById('menubar');
  if(!menubar) return;
  const bar=document.createElement('div');
  bar.id='insert-toolbar';
  bar.innerHTML=`
    <span class="insert-label">Insert</span>
    <div class="insert-group">
      <button class="insert-btn" data-prim="cube"><svg width="13" height="13" viewBox="0 0 13 13"><path d="M6.5 1.5l5 2.5v5l-5 2.5-5-2.5v-5z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>Cube</button>
      <button class="insert-btn" data-prim="sphere"><svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>Sphere</button>
      <button class="insert-btn" data-prim="cylinder"><svg width="13" height="13" viewBox="0 0 13 13"><ellipse cx="6.5" cy="4" rx="4" ry="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/><ellipse cx="6.5" cy="10" rx="4" ry="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="2.5" y1="4" x2="2.5" y2="10" stroke="currentColor" stroke-width="1.2"/><line x1="10.5" y1="4" x2="10.5" y2="10" stroke="currentColor" stroke-width="1.2"/></svg>Cylinder</button>
      <button class="insert-btn" data-prim="plane"><svg width="13" height="13" viewBox="0 0 13 13"><path d="M1 9l5.5-3.5L12 9H1z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>Plane</button>
      <button class="insert-btn" data-prim="cone"><svg width="13" height="13" viewBox="0 0 13 13"><path d="M6.5 1.5l5 9h-10z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>Cone</button>
      <button class="insert-btn" data-prim="torus"><svg width="13" height="13" viewBox="0 0 13 13"><ellipse cx="6.5" cy="6.5" rx="5" ry="2.5" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>Torus</button>
    </div>
    <div class="insert-divider"></div>
    <div class="insert-group">
      <button class="insert-btn" data-light="point"><svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="6" r="2.5" stroke="#ccaa44" stroke-width="1.2" fill="none"/></svg>Point</button>
      <button class="insert-btn" data-light="spot"><svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="4" r="2" stroke="#ccaa44" stroke-width="1.2" fill="none"/><path d="M4 7l-2 5M9 7l2 5M4 7h5" stroke="#ccaa44" stroke-width="1.2"/></svg>Spot</button>
      <button class="insert-btn" data-light="dir"><svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="4.5" r="2" stroke="#ccaa44" stroke-width="1.2" fill="none"/><path d="M6.5 7v5" stroke="#ccaa44" stroke-width="1.2"/></svg>Dir</button>
    </div>
    <div class="insert-divider"></div>
    <div class="insert-group" id="transform-tools-group">
      <button class="insert-btn transform-tool active" data-transform="translate"><svg width="13" height="13" viewBox="0 0 13 13"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>Move</button>
      <button class="insert-btn transform-tool" data-transform="rotate"><svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>Rotate</button>
      <button class="insert-btn transform-tool" data-transform="scale"><svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1" width="5" height="5" stroke="currentColor" stroke-width="1.2" fill="none"/><rect x="7" y="7" width="5" height="5" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>Scale</button>
    </div>
    <div class="insert-divider"></div>
    <div class="insert-group">
      <button class="insert-btn danger-btn" id="btn-del"><svg width="13" height="13" viewBox="0 0 13 13"><path d="M2.5 4h8M5 4V2.5h3V4M4 4v7h5V4" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>Delete</button>
      <button class="insert-btn" id="btn-dup"><svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="4" width="7" height="8" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M4 4V3a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H9" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>Duplicate</button>
      <button class="insert-btn" id="btn-focus"><svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="6.5" r="2.5" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M1 3V1h2M10 1h2v2M12 10v2h-2M3 12H1v-2" stroke="currentColor" stroke-width="1.2"/></svg>Focus</button>
      <button class="insert-btn" id="btn-save"><svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1" width="11" height="11" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/><rect x="3" y="1" width="6" height="4" stroke="currentColor" stroke-width="1" fill="none"/><rect x="2" y="7" width="9" height="5" stroke="currentColor" stroke-width="1" fill="none"/></svg>Save</button>
    </div>
    <div class="insert-divider"></div>
    <button class="insert-btn gyro-btn" id="btn-gyro"><svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="6.5" cy="6.5" r="1.2" fill="currentColor"/></svg>Gyro</button>`;

  menubar.parentNode.insertBefore(bar,menubar.nextSibling);

  bar.querySelectorAll('.insert-btn[data-prim]').forEach(btn=>btn.addEventListener('click',()=>{AudioSystem.click();SceneView.addPrimitive(btn.dataset.prim);}));
  bar.querySelectorAll('.insert-btn[data-light]').forEach(btn=>btn.addEventListener('click',()=>{AudioSystem.click();SceneView.addLight(btn.dataset.light);}));
  bar.querySelectorAll('.transform-tool').forEach(btn=>btn.addEventListener('click',()=>{AudioSystem.click();bar.querySelectorAll('.transform-tool').forEach(b=>b.classList.remove('active'));btn.classList.add('active');SceneView.setTransformMode(btn.dataset.transform);toast('Mode: '+btn.dataset.transform,'log',1000);}));
  document.getElementById('btn-del')?.addEventListener('click',()=>{AudioSystem.error();SceneView.deleteSelected();});
  document.getElementById('btn-dup')?.addEventListener('click',()=>{AudioSystem.click();SceneView.duplicateSelected();});
  document.getElementById('btn-focus')?.addEventListener('click',()=>{AudioSystem.click();SceneView.focusSelected();});
  document.getElementById('btn-save')?.addEventListener('click',()=>{AudioSystem.click();SceneData.save();});
  document.getElementById('btn-gyro')?.addEventListener('click',()=>{AudioSystem.click();SceneView.toggleGyro();document.getElementById('btn-gyro').classList.toggle('active');});
}

/* ══════════════════════════════════════
   CONTEXT MENU
══════════════════════════════════════ */
const ContextMenu = {
  el: document.getElementById('context-menu'),
  show(x,y) {
    if(!this.el) return;
    this.el.style.left=Math.min(x,window.innerWidth-170)+'px';
    this.el.style.top=Math.min(y,window.innerHeight-160)+'px';
    this.el.classList.remove('hidden');
  },
  hide() { this.el?.classList.add('hidden'); }
};

document.addEventListener('click',()=>ContextMenu.hide());
document.addEventListener('contextmenu',e=>{ if(!e.target.closest('#panel-hierarchy')&&!e.target.closest('#scene-canvas')) ContextMenu.hide(); });

document.querySelectorAll('.ctx-item').forEach(item=>{
  item.addEventListener('click',e=>{
    e.stopPropagation(); AudioSystem.click(); ContextMenu.hide();
    const a=item.dataset.action;
    if(a==='delete') SceneView.deleteSelected();
    else if(a==='duplicate') SceneView.duplicateSelected();
    else if(a==='add-child') SceneView.addPrimitive('cube');
    else toast(a+' coming soon','warn');
  });
});

/* ══════════════════════════════════════
   DROPDOWN MENUS
══════════════════════════════════════ */
const MenuDefs={
  file:document.getElementById('menu-file'),edit:document.getElementById('menu-edit'),
  assets:document.getElementById('menu-assets'),gameobject:document.getElementById('menu-gameobject'),
  component:document.getElementById('menu-component'),build:document.getElementById('menu-build'),
  window:document.getElementById('menu-window'),help:document.getElementById('menu-help')
};
let openMenuEl=null;

document.querySelectorAll('.menu-item').forEach(item=>{
  item.addEventListener('click',e=>{
    e.stopPropagation(); AudioSystem.click();
    const menu=MenuDefs[item.dataset.menu];
    if(!menu) return;
    if(openMenuEl===menu){closeAllMenus();return;}
    closeAllMenus();
    const rect=item.getBoundingClientRect();
    menu.style.left=rect.left+'px';
    menu.classList.remove('hidden');
    item.classList.add('open');
    openMenuEl=menu;
    document.getElementById('dropdown-overlay')?.classList.remove('hidden');
  });
});

function closeAllMenus() {
  Object.values(MenuDefs).forEach(m=>m?.classList.add('hidden'));
  document.querySelectorAll('.menu-item.open').forEach(m=>m.classList.remove('open'));
  document.getElementById('dropdown-overlay')?.classList.add('hidden');
  openMenuEl=null;
}

document.getElementById('dropdown-overlay')?.addEventListener('click',closeAllMenus);

document.querySelectorAll('.dd-item[data-action]').forEach(item=>{
  item.addEventListener('click',e=>{
    e.stopPropagation(); AudioSystem.click(); closeAllMenus();
    handleAction(item.dataset.action);
  });
});

function handleAction(a) {
  const map={
    'new-scene':()=>{ if(confirm('New scene? Unsaved changes lost.')) { SceneData.entities.forEach(e=>{if(e.mesh)SceneView.scene.remove(e.mesh);}); SceneData.entities=[]; SceneData.selected=null; SceneData.nextId=1; SceneView._buildDefaultScene(); toast('New scene','success'); } },
    'save-scene':()=>SceneData.save(),
    'open-scene':()=>SceneData.load(),
    'build-settings':openBuildModal,
    'export':openBuildModal,
    'build-web':()=>openBuildModal('web'),
    'build-android':()=>openBuildModal('android'),
    'build-desktop':()=>openBuildModal('desktop'),
    'build-run':()=>{openBuildModal();setTimeout(()=>document.getElementById('btn-start-build')?.click(),400);},
    'undo':()=>toast('Undo — coming soon','warn'),
    'redo':()=>toast('Redo — coming soon','warn'),
    'create-empty':()=>{SceneData.add('Empty','empty',null);HierarchyPanel.refresh();toast('Empty created','success');},
    'docs':()=>window.open('https://github.com','_blank'),
    'about':()=>toast('CEngine v0.5 — Three.js + Monaco + AI','log',4000),
    'preferences':()=>toast('Preferences — coming soon','warn'),
    'reset-layout':()=>location.reload(),
    'exit':()=>{if(confirm('Exit CEngine?'))window.close();}
  };
  (map[a]||(() =>toast(a+' coming soon','warn')))();
}

/* ══════════════════════════════════════
   CENTER TABS
══════════════════════════════════════ */
document.querySelectorAll('.center-tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    AudioSystem.click();
    document.querySelectorAll('.center-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
    tab.classList.add('active');
    const el=document.getElementById('tab-'+tab.dataset.tab);
    if(el) el.classList.add('active');
    if(tab.dataset.tab==='code') initMonaco();
    if(tab.dataset.tab==='scene') setTimeout(()=>SceneView._resize(),50);
  });
});

/* ══════════════════════════════════════
   BOTTOM TABS
══════════════════════════════════════ */
document.querySelectorAll('.bottom-tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    AudioSystem.click();
    document.querySelectorAll('.bottom-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.btab-content').forEach(c=>c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('btab-'+tab.dataset.tab)?.classList.add('active');
  });
});

/* ══════════════════════════════════════
   PLAY CONTROLS — with full game loop
══════════════════════════════════════ */
let playing=false, fpsInterval=null, frameCount=0, lastTime=0;

document.getElementById('btn-play')?.addEventListener('click',()=>{
  playing=true; SceneView.playing=true;
  document.getElementById('btn-play').disabled=true;
  document.getElementById('btn-pause').disabled=false;
  document.getElementById('btn-stop').disabled=false;
  document.getElementById('btn-play').classList.add('playing');

  // Init input
  Input.init();

  // Add simple gravity to all dynamic meshes
  SceneData.entities.forEach(entity=>{
    if(entity.type==='mesh'&&entity.name!=='Floor') {
      entity._phys={vy:0,grounded:false,floor:0.01};
    }
  });

  // Spawn player rig
  PlayerRig.spawn(SceneView.scene,SceneView.camera,{x:0,y:2,z:3});

  // Init scripts
  ScriptRuntime.init(SceneData.entities,SceneView.scene);

  AudioSystem.success();
  Console.log('Play mode — WASD or joystick to move, Space to jump','log','Engine.js');
  toast('Playing','success');

  fpsInterval=setInterval(()=>{
    document.getElementById('fps-counter').textContent=frameCount+' FPS';
    frameCount=0;
  },1000);

  lastTime=performance.now();

  function gameLoop() {
    if(!playing) return;
    requestAnimationFrame(gameLoop);
    frameCount++;

    const now=performance.now();
    const dt=Math.min((now-lastTime)/1000,0.05);
    lastTime=now;

    // Tick input
    Input.tick();

    // Simple physics for all dynamic entities
    SceneData.entities.forEach(entity=>{
      if(!entity._phys||!entity.mesh) return;
      entity._phys.vy+=(-12)*dt;
      entity.mesh.position.y+=entity._phys.vy*dt;
      entity.position.y=entity.mesh.position.y;
      if(entity.mesh.position.y<=0.5) {
        entity.mesh.position.y=0.5;
        entity.position.y=0.5;
        entity._phys.vy=0;
        entity._phys.grounded=true;
      } else { entity._phys.grounded=false; }
    });

    // Update player rig
    PlayerRig.update(dt);

    // Update scripts
    ScriptRuntime.update(dt);
  }

  gameLoop();
});

document.getElementById('btn-pause')?.addEventListener('click',()=>{
  playing=!playing; SceneView.playing=playing;
  AudioSystem.warn(); toast(playing?'Resumed':'Paused');
  if(playing) { lastTime=performance.now(); (function gameLoop(){if(!playing)return;requestAnimationFrame(gameLoop);frameCount++;const now=performance.now();const dt=Math.min((now-lastTime)/1000,0.05);lastTime=now;Input.tick();PlayerRig.update(dt);ScriptRuntime.update(dt);})(); }
});

document.getElementById('btn-stop')?.addEventListener('click',()=>{
  playing=false; SceneView.playing=false;

  // Cleanup
  PlayerRig.despawn();
  ScriptRuntime.stop();
  Input.clear();

  // Reset entity physics
  SceneData.entities.forEach(e=>{
    delete e._phys;
    // Reset mesh positions from saved scene data
    if(e.mesh) {
      e.mesh.position.set(e.position.x,e.position.y,e.position.z);
    }
  });

  document.getElementById('btn-play').disabled=false;
  document.getElementById('btn-pause').disabled=true;
  document.getElementById('btn-stop').disabled=true;
  document.getElementById('btn-play').classList.remove('playing');
  document.getElementById('fps-counter').textContent='-- FPS';
  clearInterval(fpsInterval);

  // Restore editor camera
  SceneView.theta=0.5; SceneView.phi=1.0; SceneView.radius=12;
  SceneView.orbitTarget.set(0,0,0); SceneView._syncCamera();

  AudioSystem.error();
  Console.log('Stopped','log','Engine.js');
  toast('Stopped');
});

/* ══════════════════════════════════════
   TOOLBAR TOOL BUTTONS
══════════════════════════════════════ */
document.querySelectorAll('.tool-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    AudioSystem.click();
    document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const modes={'btn-translate':'translate','btn-rotate':'rotate','btn-scale':'scale'};
    if(modes[btn.id]) SceneView.setTransformMode(modes[btn.id]);
  });
});

/* ══════════════════════════════════════
   BUILD MODAL
══════════════════════════════════════ */
function openBuildModal(platform='web') {
  AudioSystem.click();
  document.getElementById('build-modal')?.classList.remove('hidden');
  document.getElementById('modal-overlay')?.classList.remove('hidden');
  document.querySelectorAll('.build-platform').forEach(p=>p.classList.remove('active'));
  document.querySelector('.build-platform[data-platform="'+platform+'"]')?.classList.add('active');
}

function closeBuildModal() {
  AudioSystem.click();
  document.getElementById('build-modal')?.classList.add('hidden');
  document.getElementById('modal-overlay')?.classList.add('hidden');
}

document.getElementById('btn-build-quick')?.addEventListener('click',()=>openBuildModal());
document.getElementById('btn-close-build')?.addEventListener('click',closeBuildModal);
document.getElementById('btn-close-build-2')?.addEventListener('click',closeBuildModal);
document.getElementById('modal-overlay')?.addEventListener('click',closeBuildModal);

document.querySelectorAll('.build-platform').forEach(p=>{
  p.addEventListener('click',()=>{
    AudioSystem.click();
    document.querySelectorAll('.build-platform').forEach(b=>b.classList.remove('active'));
    p.classList.add('active');
  });
});

document.getElementById('btn-start-build')?.addEventListener('click',()=>{
  const name=document.getElementById('build-game-name')?.value||'My Game';
  const log=document.getElementById('build-log');
  if(!log) return;
  log.innerHTML='';
  const steps=[
    {msg:'Compiling scene...',delay:0},
    {msg:'Bundling scripts...',delay:500},
    {msg:'Packaging assets...',delay:1000},
    {msg:'Generating HTML5...',delay:1500},
    {msg:'✓ Build complete: '+name,delay:2100,ok:true}
  ];
  steps.forEach(({msg,delay,ok})=>{
    setTimeout(()=>{
      const line=document.createElement('div');
      line.className='build-log-line'+(ok?' success':'');
      line.textContent=msg;
      log.appendChild(line); log.scrollTop=log.scrollHeight;
      if(ok) { AudioSystem.success(); toast('Build complete: '+name,'success'); setTimeout(()=>{closeBuildModal();launchBuild(name);},500); }
    },delay);
  });
});

document.getElementById('btn-build-and-run')?.addEventListener('click',()=>document.getElementById('btn-start-build')?.click());

function launchBuild(name='My Game') {
  const scripts=CodeEditor.files;
  const entities=SceneData.entities.filter(e=>e.mesh).map(e=>({
    name:e.name, geo:e.mesh.geometry?.type||'BoxGeometry',
    color:'#'+(e.mesh.material?.color?.getHexString()||'4488cc'),
    px:e.mesh.position.x, py:e.mesh.position.y, pz:e.mesh.position.z,
    rx:e.mesh.rotation.x, ry:e.mesh.rotation.y, rz:e.mesh.rotation.z,
    sx:e.mesh.scale.x,    sy:e.mesh.scale.y,    sz:e.mesh.scale.z,
    components:e.components||[]
  }));

  const scriptCode=Object.entries(scripts).map(([name,code])=>`// === ${name} ===\n${code}`).join('\n\n');

  const html=`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<title>${name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;overflow:hidden;width:100vw;height:100vh;font-family:monospace}
canvas{display:block;width:100%;height:100%}
#loader{position:fixed;inset:0;background:#0a0a0a;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;transition:opacity 0.5s}
.ll{font-size:26px;font-weight:800;color:#00a4dc;letter-spacing:2px;margin-bottom:6px}
.ls{font-size:10px;color:#444;letter-spacing:4px;margin-bottom:28px}
.lb{width:200px;height:2px;background:#1a1a1a;border-radius:2px;overflow:hidden}
.lf{height:100%;background:#00a4dc;width:0%;transition:width 0.25s}
.lc{position:fixed;bottom:16px;font-size:9px;color:#2a2a2a;letter-spacing:3px}
#hud{position:fixed;top:10px;left:12px;color:#555;font-size:11px;pointer-events:none}
#joy-overlay{position:fixed;bottom:0;left:0;right:0;height:200px;z-index:100;pointer-events:none}
#joy-left-zone{position:absolute;left:0;bottom:0;width:50%;height:100%;pointer-events:auto}
#joy-base{position:absolute;width:110px;height:110px;border-radius:50%;background:rgba(255,255,255,0.04);border:2px solid rgba(255,255,255,0.12);display:none;pointer-events:none}
#joy-stick{position:absolute;top:50%;left:50%;width:42px;height:42px;border-radius:50%;background:rgba(0,164,220,0.55);border:2px solid #00a4dc;transform:translate(-50%,-50%)}
#jump-btn{position:absolute;right:30px;bottom:40px;width:60px;height:60px;border-radius:50%;background:rgba(39,174,96,0.2);border:2px solid rgba(39,174,96,0.5);color:#27ae60;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;pointer-events:auto;cursor:pointer;font-family:monospace}
#jump-btn:active{background:rgba(39,174,96,0.4)}
</style></head><body>
<div id="loader">
  <div class="ll">C<span style="color:#888;font-weight:400;font-size:20px">Engine</span></div>
  <div class="ls">LOADING</div>
  <div class="lb"><div class="lf" id="lf"></div></div>
  <div class="lc">BUILT WITH CENGINE</div>
</div>
<canvas id="c"></canvas>
<div id="hud">${name}</div>
<div id="joy-overlay">
  <div id="joy-left-zone">
    <div id="joy-base"><div id="joy-stick"></div></div>
  </div>
  <button id="jump-btn">JUMP</button>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
// Loader
const lf=document.getElementById('lf');let p=0;
const li=setInterval(()=>{p=Math.min(100,p+Math.random()*15+5);lf.style.width=p+'%';
if(p>=100){clearInterval(li);setTimeout(()=>{const lo=document.getElementById('loader');lo.style.opacity='0';setTimeout(()=>lo.remove(),500);},200);}},80);

// Scene
const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('c'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x111111);scene.fog=new THREE.FogExp2(0x111111,0.016);
const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.1,1000);
scene.add(new THREE.AmbientLight(0x303040,1.8));
const dl=new THREE.DirectionalLight(0xfff0e0,2.2);dl.position.set(8,14,6);dl.castShadow=true;scene.add(dl);
scene.add(new THREE.GridHelper(40,40,0x1e1e1e,0x181818));

// Load entities
const gm={BoxGeometry:()=>new THREE.BoxGeometry(1,1,1),SphereGeometry:()=>new THREE.SphereGeometry(0.5,24,24),CylinderGeometry:()=>new THREE.CylinderGeometry(0.5,0.5,1,24),PlaneGeometry:()=>new THREE.PlaneGeometry(2,2),ConeGeometry:()=>new THREE.ConeGeometry(0.5,1,24),TorusGeometry:()=>new THREE.TorusGeometry(0.5,0.18,16,48)};
const gameEntities=[];
${JSON.stringify(entities)}.forEach(e=>{
  const geo=(gm[e.geo]||gm.BoxGeometry)();
  const mat=new THREE.MeshStandardMaterial({color:e.color,roughness:0.5,metalness:0.1});
  const mesh=new THREE.Mesh(geo,mat);
  mesh.position.set(e.px,e.py,e.pz);mesh.rotation.set(e.rx,e.ry,e.rz);mesh.scale.set(e.sx,e.sy,e.sz);
  mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  gameEntities.push({name:e.name,mesh,position:mesh.position,components:e.components||[]});
});

// Player rig
const rigGroup=new THREE.Group();
const bm=new THREE.MeshStandardMaterial({color:0x4488ff,roughness:0.6});
const hm=new THREE.MeshStandardMaterial({color:0xffcc99,roughness:0.8});
const lm=new THREE.MeshStandardMaterial({color:0x3366cc,roughness:0.6});
const torso=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.65,0.25),bm);torso.position.y=0.9;rigGroup.add(torso);
const head=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.35,0.35),hm);head.position.y=1.45;rigGroup.add(head);
const lArm=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.55,0.18),lm);lArm.position.set(-0.36,0.88,0);rigGroup.add(lArm);
const rArm=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.55,0.18),lm);rArm.position.set(0.36,0.88,0);rigGroup.add(rArm);
const lLeg=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.6,0.2),lm);lLeg.position.set(-0.14,0.3,0);rigGroup.add(lLeg);
const rLeg=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.6,0.2),lm);rLeg.position.set(0.14,0.3,0);rigGroup.add(rLeg);
rigGroup.position.set(0,2,3);scene.add(rigGroup);
[torso,head,lArm,rArm,lLeg,rLeg].forEach(m=>m.castShadow=true);

// Input
const keys={};let joyX=0,joyY=0,joyActive=false,joyId=null,joyBx=0,joyBy=0;
window.addEventListener('keydown',e=>keys[e.code]=true);
window.addEventListener('keyup',e=>keys[e.code]=false);
function held(k){return !!(keys[k]||keys['Key'+k.toUpperCase()]||keys[k.toLowerCase()]);}

// Joystick
const joyBase=document.getElementById('joy-base'),joyStick=document.getElementById('joy-stick');
const lz=document.getElementById('joy-left-zone');
lz.addEventListener('touchstart',e=>{e.preventDefault();if(joyActive)return;const t=e.changedTouches[0];joyId=t.identifier;joyActive=true;joyBx=t.clientX;joyBy=t.clientY;joyBase.style.display='block';joyBase.style.left=(t.clientX-55)+'px';joyBase.style.top=(t.clientY-55-lz.getBoundingClientRect().top)+'px';},{passive:false});
document.addEventListener('touchmove',e=>{Array.from(e.changedTouches).forEach(t=>{if(t.identifier!==joyId)return;const dx=t.clientX-joyBx,dy=t.clientY-joyBy;const d=Math.sqrt(dx*dx+dy*dy),max=50;const nx=d>max?dx/d*max:dx,ny=d>max?dy/d*max:dy;joyX=nx/max;joyY=ny/max;joyStick.style.transform='translate(calc(-50% + '+nx+'px),calc(-50% + '+ny+'px))';});});
document.addEventListener('touchend',e=>{Array.from(e.changedTouches).forEach(t=>{if(t.identifier===joyId){joyActive=false;joyId=null;joyX=0;joyY=0;joyBase.style.display='none';joyStick.style.transform='translate(-50%,-50%)';}});});

// Jump button
let jumpPressed=false;
document.getElementById('jump-btn').addEventListener('touchstart',e=>{e.preventDefault();jumpPressed=true;},{passive:false});
document.getElementById('jump-btn').addEventListener('touchend',()=>jumpPressed=false);

// Physics
let vy=0,grounded=false,yaw=0,wc=0;
const SPEED=6,JUMP=8;

// Game loop
let lastT=performance.now();
function animate(){
  requestAnimationFrame(animate);
  const now=performance.now(),dt=Math.min((now-lastT)/1000,0.05);lastT=now;

  // Movement
  let mx=(held('d')||held('ArrowRight')?1:0)-(held('a')||held('ArrowLeft')?1:0);
  let mz=(held('w')||held('ArrowUp')?1:0)-(held('s')||held('ArrowDown')?1:0);
  if(Math.abs(joyX)>0.1) mx=joyX;
  if(Math.abs(joyY)>0.1) mz=-joyY;
  const moving=Math.abs(mx)>0.05||Math.abs(mz)>0.05;

  if(moving) {
    const fwd=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
    const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    rigGroup.position.addScaledVector(right,mx*SPEED*dt);
    rigGroup.position.addScaledVector(fwd,mz*SPEED*dt);
    wc+=dt*8;
    lArm.rotation.x=Math.sin(wc)*0.4;rArm.rotation.x=-Math.sin(wc)*0.4;
    lLeg.rotation.x=-Math.sin(wc)*0.5;rLeg.rotation.x=Math.sin(wc)*0.5;
  } else { wc=0; [lArm,rArm,lLeg,rLeg].forEach(m=>m.rotation.x*=0.8); }

  // Gravity
  vy+=(-12)*dt;rigGroup.position.y+=vy*dt;
  if(rigGroup.position.y<=1.0){rigGroup.position.y=1.0;vy=0;grounded=true;}else grounded=false;

  // Jump
  if((keys['Space']||jumpPressed)&&grounded){vy=JUMP;grounded=false;}

  // Camera — above head, 1v1.lol style
  const hx=rigGroup.position.x,hy=rigGroup.position.y+1.45,hz=rigGroup.position.z;
  camera.position.set(hx-Math.sin(yaw)*1.2,hy+5.5,hz-Math.cos(yaw)*1.2);
  camera.lookAt(hx-Math.sin(yaw)*1.5,hy+0.5,hz-Math.cos(yaw)*1.5);

  renderer.render(scene,camera);
}

window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
animate();
</script></body></html>`;

  const tab=window.open('','_blank');
  if(tab){tab.document.write(html);tab.document.close();}
  else toast('Allow popups to launch build','error');
}

/* ══════════════════════════════════════
   RESIZE HANDLES
══════════════════════════════════════ */
function makeResizable(handleId,targetId,dir,min,invert=false) {
  const handle=document.getElementById(handleId),target=document.getElementById(targetId);
  if(!handle||!target) return;
  let dragging=false,start=0,startSize=0;
  handle.addEventListener('mousedown',e=>{dragging=true;start=dir==='h'?e.clientX:e.clientY;startSize=dir==='h'?target.offsetWidth:target.offsetHeight;handle.classList.add('dragging');document.body.style.cursor=dir==='h'?'col-resize':'row-resize';document.body.style.userSelect='none';});
  document.addEventListener('mousemove',e=>{if(!dragging)return;const delta=dir==='h'?e.clientX-start:e.clientY-start;const size=Math.max(min,startSize+(invert?-delta:delta));if(dir==='h')target.style.width=size+'px';else target.style.height=size+'px';SceneView._resize();});
  document.addEventListener('mouseup',()=>{if(!dragging)return;dragging=false;handle.classList.remove('dragging');document.body.style.cursor=document.body.style.userSelect='';SceneView._resize();});
}

makeResizable('resize-left','panel-hierarchy','h',150);
makeResizable('resize-right','panel-inspector','h',200,true);
makeResizable('resize-bottom','panel-bottom','v',120,true);

/* ══════════════════════════════════════
   MONACO CODE EDITOR
══════════════════════════════════════ */
let monacoReady=false;
window.monacoEditor=null;

function initMonaco() {
  if(monacoReady) return;
  monacoReady=true;
  document.getElementById('monaco-placeholder')?.remove();
  const container=document.getElementById('monaco-container');
  if(!container) return;

  if(!window.require) {
    container.innerHTML='';
    const ta=document.createElement('textarea');
    ta.style.cssText='width:100%;height:100%;background:#111;color:#ccc;border:none;padding:14px;font-family:"JetBrains Mono",monospace;font-size:13px;resize:none;outline:none;line-height:1.6;';
    ta.value=CodeEditor.files['PlayerController.js']||'';
    container.appendChild(ta);
    ta.addEventListener('input',()=>{if(CodeEditor.activeFile)CodeEditor.files[CodeEditor.activeFile]=ta.value;});
    Console.log('Code editor ready (fallback)','log','CodeEditor.js');
    return;
  }

  require.config({paths:{vs:'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs'}});
  require(['vs/editor/editor.main'],()=>{
    container.innerHTML='';
    window.monacoEditor=monaco.editor.create(container,{
      value:CodeEditor.files['PlayerController.js']||'',
      language:'javascript',
      theme:'vs-dark',
      fontSize:13,
      fontFamily:'"JetBrains Mono",monospace',
      fontLigatures:true,
      minimap:{enabled:true},
      automaticLayout:true,
      scrollBeyondLastLine:false,
      wordWrap:'on',
      cursorBlinking:'smooth',
      bracketPairColorization:{enabled:true}
    });
    window.monacoEditor.onDidChangeModelContent(()=>{
      if(CodeEditor.activeFile) CodeEditor.files[CodeEditor.activeFile]=window.monacoEditor.getValue();
    });
    document.getElementById('code-lang-select')?.addEventListener('change',function(){
      const map={javascript:'javascript',cscript:'javascript',python:'python',lua:'lua',glsl:'glsl',css:'css'};
      monaco.editor.setModelLanguage(window.monacoEditor.getModel(),map[this.value]||'javascript');
    });
    Console.log('Monaco Editor ready','log','CodeEditor.js');
  });
}

// Wire code editor buttons
document.getElementById('btn-new-script')?.addEventListener('click',()=>{AudioSystem.click();CodeEditor.newFile();});
document.getElementById('btn-save-script')?.addEventListener('click',()=>{AudioSystem.click();CodeEditor.save();});
document.getElementById('btn-run-script')?.addEventListener('click',()=>{AudioSystem.success();CodeEditor.run();});

// File items
document.querySelectorAll('.file-item').forEach(file=>{
  file.addEventListener('click',()=>{
    AudioSystem.click();
    document.querySelectorAll('.file-item').forEach(x=>x.classList.remove('selected'));
    file.classList.add('selected');
    if(file.dataset.type==='script') {
      CodeEditor.open(file.dataset.name);
    }
  });
});

/* ══════════════════════════════════════
   CONSOLE WIRING
══════════════════════════════════════ */
document.getElementById('btn-clear-console')?.addEventListener('click',()=>{AudioSystem.click();Console.clear();});
document.getElementById('btn-console-run')?.addEventListener('click',()=>{
  const inp=document.getElementById('console-input');
  if(!inp) return;
  AudioSystem.tone(660,0.07,0.03);
  Console.exec(inp.value); inp.value='';
});
document.getElementById('console-input')?.addEventListener('keydown',e=>{
  if(e.key==='Enter') document.getElementById('btn-console-run')?.click();
  if(e.key==='ArrowUp'){Console.histIdx=Math.min(Console.histIdx+1,Console.history.length-1);e.target.value=Console.history[Console.histIdx]||'';}
  if(e.key==='ArrowDown'){Console.histIdx=Math.max(Console.histIdx-1,-1);e.target.value=Console.histIdx>=0?Console.history[Console.histIdx]:'';}
});
document.querySelectorAll('.console-filter-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    AudioSystem.click();
    document.querySelectorAll('.console-filter-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const f=btn.dataset.filter;
    document.querySelectorAll('.log-entry').forEach(el=>{el.style.display=(f==='all'||el.dataset.type===f)?'':'none';});
  });
});
document.getElementById('console-filter-input')?.addEventListener('input',function(){
  const q=this.value.toLowerCase();
  document.querySelectorAll('.log-entry').forEach(el=>{
    const msg=el.querySelector('.log-msg')?.textContent.toLowerCase()||'';
    el.style.display=msg.includes(q)?'':'none';
  });
});

/* ══════════════════════════════════════
   PROJECT PANEL
══════════════════════════════════════ */
document.querySelectorAll('.proj-folder').forEach(f=>{
  f.addEventListener('click',()=>{AudioSystem.click();document.querySelectorAll('.proj-folder').forEach(x=>x.classList.remove('active'));f.classList.add('active');});
});

/* ══════════════════════════════════════
   GRID + RENDER MODE
══════════════════════════════════════ */
document.getElementById('toggle-grid')?.addEventListener('change',function(){SceneView.toggleGrid(this.checked);});
document.getElementById('render-mode')?.addEventListener('change',function(){AudioSystem.click();SceneView.toggleWireframe(this.value==='Wireframe');});
document.getElementById('btn-audio-toggle')?.addEventListener('click',()=>AudioSystem.toggle());
document.querySelectorAll('.inspector-icon-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{AudioSystem.click();document.querySelectorAll('.inspector-icon-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');});
});

/* ══════════════════════════════════════
   PUBLIC API
══════════════════════════════════════ */
window.CEngineAPI={
  add:type=>SceneView.addPrimitive(type),
  delete:()=>SceneView.deleteSelected(),
  focus:()=>SceneView.focusSelected(),
  select:name=>{ const e=SceneData.entities.find(x=>x.name===name); if(e) SceneData.select(e.id); },
  list:()=>SceneData.entities.map(e=>e.name),
  log:msg=>Console.log(String(msg),'log','Script'),
  mode:mode=>SceneView.setTransformMode(mode),
  save:()=>SceneData.save(),
  load:()=>SceneData.load(),
  ai:()=>AIHelper.toggle()
};

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
AudioSystem.init();
CodeEditor.init();
buildInsertToolbar();
SceneView.init();
Inspector.clear();
AIHelper.init();

setInterval(()=>{ const e=SceneData.getById(SceneData.selected); window._selMesh=e?.mesh||null; },100);

setTimeout(()=>Console.log('CEngine v0.5 ready','log','Engine.js'),100);
setTimeout(()=>Console.log('Renderer: Three.js r128','log','Renderer3D.js'),200);
setTimeout(()=>Console.log('Input system ready','log','Input.js'),300);
setTimeout(()=>Console.log('Script runtime ready','log','ScriptRuntime.js'),400);
setTimeout(()=>Console.log('AI Helper ready — click ✦ AI button','log','AIHelper.js'),500);
setTimeout(()=>Console.log('Tip: Hit Play → humanoid spawns, WASD/joystick to move, Space to jump. Ctrl+S to save.','log','Editor.js'),800);
setTimeout(()=>toast('CEngine v0.5 — Ready','success',3000),600);

})();
