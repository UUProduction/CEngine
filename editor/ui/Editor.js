/* ═══════════════════════════════════════════
   CENGINE EDITOR.JS v0.6
   Full rewrite — Model Builder, AI Helper fix,
   Roblox/Fortnite camera, all systems
   ═══════════════════════════════════════════ */
(function () {
'use strict';

/* ══ MOBILE REDIRECT ══ */
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && window.innerWidth < 768);
if (isMobile) { window.location.href = 'mobile.html'; return; }

/* ══════════════════════════════════════
   AUDIO
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
  synth(type, opts) {
    opts=opts||{}; const vol=opts.volume||0.4, pitch=opts.pitch||1;
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
    div.className='log-entry '+type; div.dataset.type=type;
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
    this.history.unshift(cmd); this.histIdx=-1;
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
  keys:{}, prevKeys:{},
  mouse:{x:0,y:0,dx:0,dy:0,buttons:{},prevButtons:{}},
  active:false,
  init() {
    if(this.active) return; this.active=true;
    window.addEventListener('keydown',e=>{this.keys[e.code]=true;this.keys[e.key.toLowerCase()]=true;});
    window.addEventListener('keyup',  e=>{this.keys[e.code]=false;this.keys[e.key.toLowerCase()]=false;});
    window.addEventListener('mousemove',e=>{this.mouse.dx=e.movementX||0;this.mouse.dy=e.movementY||0;this.mouse.x=e.clientX;this.mouse.y=e.clientY;});
    window.addEventListener('mousedown',e=>this.mouse.buttons[e.button]=true);
    window.addEventListener('mouseup',  e=>this.mouse.buttons[e.button]=false);
  },
  tick() {
    Object.keys(this.keys).forEach(k=>this.prevKeys[k]=this.keys[k]);
    Object.keys(this.mouse.buttons).forEach(k=>this.mouse.prevButtons[k]=this.mouse.buttons[k]);
    this.mouse.dx=0; this.mouse.dy=0;
  },
  held(key)    { return !!(this.keys[key]||this.keys['Key'+key.toUpperCase()]||this.keys[key.toLowerCase()]); },
  pressed(key) { return !!(this.keys[key]&&!this.prevKeys[key]); },
  axis(name) {
    if(name==='horizontal') return (this.held('d')||this.held('ArrowRight')?1:0)-(this.held('a')||this.held('ArrowLeft')?1:0);
    if(name==='vertical')   return (this.held('w')||this.held('ArrowUp')?1:0)-(this.held('s')||this.held('ArrowDown')?1:0);
    return 0;
  },
  clear() { this.keys={}; this.mouse.buttons={}; this.active=false; }
};

/* ══════════════════════════════════════
   SCENE DATA
══════════════════════════════════════ */
const SceneData = {
  entities:[], selected:null, nextId:1,
  add(name,type,mesh=null) {
    const e={id:this.nextId++,name,type,active:true,mesh,
      position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1},components:[]};
    this.entities.push(e); return e;
  },
  getById(id) { return this.entities.find(e=>e.id===id)||null; },
  remove(id) {
    const e=this.getById(id);
    if(e&&e.mesh) {
      SceneView.scene.remove(e.mesh);
      e.mesh.traverse(child=>{
        if(child.isMesh||child.isLine||child.isPoints) {
          child.geometry?.dispose();
          if(Array.isArray(child.material)) child.material.forEach(m=>m.dispose());
          else child.material?.dispose();
        }
      });
    }
    this.entities=this.entities.filter(x=>x.id!==id);
    if(this.selected===id){this.selected=null;Inspector.clear();}
  },
  select(id) {
    this.selected=id;
    const e=this.getById(id);
    if(e){Inspector.update(e);SceneView.showGizmo(e);}
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
        entities:this.entities.filter(e=>e.mesh&&e.type!=='model').map(e=>({
          id:e.id,name:e.name,type:e.type,active:e.active,
          position:{...e.position},rotation:{...e.rotation},scale:{...e.scale},
          color:e.mesh?.material?.color?.getHexString()||'4488cc',
          geometry:e.mesh?.geometry?.type||'BoxGeometry',
          components:e.components||[]
        }))
      };
      localStorage.setItem('cengine_scene_v1',JSON.stringify(data));
      toast('Scene saved','success');
      Console.log('Saved — '+data.entities.length+' entities','log','Scene.js');
    } catch(e){toast('Save failed','error');}
  },
  load() {
    try {
      const raw=localStorage.getItem('cengine_scene_v1');
      if(!raw){toast('No saved scene','warn');return;}
      const data=JSON.parse(raw);
      this.entities.forEach(e=>{if(e.mesh)SceneView.scene?.remove(e.mesh);});
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
    } catch(e){toast('Load failed: '+e.message,'error');}
  }
};

/* ══════════════════════════════════════
   SCRIPT RUNTIME
══════════════════════════════════════ */
const ScriptRuntime = {
  instances:[],
  init(entities,scene) {
    this.instances=[];
    const SceneAPI={
      find:name=>entities.find(e=>e.name===name)||null,
      destroy:entity=>{if(entity)SceneData.remove(entity.id);},
      spawn:(name,pos)=>{
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5),new THREE.MeshStandardMaterial({color:0xff8844}));
        mesh.position.set(pos?.x||0,pos?.y||0,pos?.z||0);
        scene.add(mesh); return SceneData.add(name,'mesh',mesh);
      }
    };
    entities.forEach(entity=>{
      (entity.components||[]).forEach(comp=>{
        if(comp.type!=='script'||!comp.code) return;
        const match=comp.code.match(/class\s+(\w+)/);
        if(!match) return;
        const className=match[1];
        const rbProxy={
          addForce:(x,y,z)=>{if(entity._phys)entity._phys.vy+=y*0.1;},
          setVelocity:(x,y,z)=>{if(entity._phys)entity._phys.vy=y;},
          get grounded(){return entity._phys?.grounded||false;}
        };
        const sandbox={
          transform:{get position(){return entity.mesh?.position||entity.position;},get rotation(){return entity.mesh?.rotation||entity.rotation;},get scale(){return entity.mesh?.scale||entity.scale;}},
          rb:rbProxy,
          entity:{get name(){return entity.name;},get active(){return entity.active;},destroy(){SceneData.remove(entity.id);}},
          Input,
          Sound:{Synth:{play:(t,o)=>AudioSystem.synth(t,o)}},
          Scene:SceneAPI,
          CEngine:{log:msg=>Console.log(String(msg),'log',className)},
          Vector3:{
            add:(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z}),
            sub:(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),
            scale:(v,s)=>({x:v.x*s,y:v.y*s,z:v.z*s}),
            length:v=>Math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z),
            normalize:v=>{const l=Math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z)||1;return{x:v.x/l,y:v.y/l,z:v.z/l};},
            distance:(a,b)=>Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2)
          },
          THREE,Math,console
        };
        try {
          const keys=Object.keys(sandbox),vals=Object.values(sandbox);
          const fn=new Function(...keys,comp.code+';return new '+className+'();');
          const inst=fn(...vals);
          this.instances.push({entity,instance:inst,name:className});
          try{inst.onStart?.();}catch(e){Console.log('onStart error: '+e.message,'error',className);}
        } catch(e){Console.log('Script error: '+e.message,'error',className);}
      });
    });
  },
  update(dt) {
    this.instances.forEach(({entity,instance,name})=>{
      try{instance.onUpdate?.(dt);}
      catch(e){if(!instance._ec)instance._ec=0;if(++instance._ec<3)Console.log('onUpdate error: '+e.message,'error',name);}
    });
  },
  stop() {
    this.instances.forEach(({instance})=>{try{instance.onStop?.();}catch(e){}});
    this.instances=[];
  }
};

/* ══════════════════════════════════════
   PLAYER RIG — Roblox/Fortnite camera
══════════════════════════════════════ */
const PlayerRig = {
  group:null, active:false, scene:null, camera:null,
  vy:0, grounded:false, speed:6, jumpForce:8,
  camYaw:0, camPitch:0.3, camDist:6,
  camMinPitch:-0.4, camMaxPitch:1.1,
  camMinDist:2, camMaxDist:14,
  mouseLookActive:false,
  walkCycle:0, stepTimer:0,
  joyX:0, joyY:0, joyActive:false, joyId:null, joyBaseX:0, joyBaseY:0,

  spawn(scene,camera,pos) {
    this.scene=scene; this.camera=camera;
    if(this.group){scene.remove(this.group);}
    const g=new THREE.Group();
    const bm=new THREE.MeshStandardMaterial({color:0x4488ff,roughness:0.5,metalness:0.1});
    const hm=new THREE.MeshStandardMaterial({color:0xffcc99,roughness:0.8});
    const lm=new THREE.MeshStandardMaterial({color:0x2255aa,roughness:0.5});
    const pm=new THREE.MeshStandardMaterial({color:0x334466,roughness:0.7});
    const sm=new THREE.MeshStandardMaterial({color:0x111111,roughness:0.9});
    const torso=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.7,0.28),bm); torso.position.y=1.0; torso.castShadow=true; g.add(torso);
    const head=new THREE.Mesh(new THREE.BoxGeometry(0.38,0.38,0.38),hm); head.position.y=1.58; head.castShadow=true; g.add(head);
    const lUA=new THREE.Mesh(new THREE.BoxGeometry(0.19,0.33,0.19),bm); lUA.position.set(-0.4,1.08,0); g.add(lUA);
    const rUA=new THREE.Mesh(new THREE.BoxGeometry(0.19,0.33,0.19),bm); rUA.position.set(0.4,1.08,0); g.add(rUA);
    const lUL=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.35,0.22),pm); lUL.position.set(-0.16,0.55,0); g.add(lUL);
    const rUL=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.35,0.22),pm); rUL.position.set(0.16,0.55,0); g.add(rUL);
    const lLL=new THREE.Mesh(new THREE.BoxGeometry(0.20,0.32,0.20),pm); lLL.position.set(-0.16,0.22,0); g.add(lLL);
    const rLL=new THREE.Mesh(new THREE.BoxGeometry(0.20,0.32,0.20),pm); rLL.position.set(0.16,0.22,0); g.add(rLL);
    g.position.set(pos?.x||0,pos?.y||1.0,pos?.z||4);
    scene.add(g);
    this.group=g;
    g._lUA=lUA;g._rUA=rUA;g._lUL=lUL;g._rUL=rUL;g._lLL=lLL;g._rLL=rLL;
    this.vy=0; this.grounded=false; this.camYaw=0; this.camPitch=0.3; this.camDist=6;
    this.walkCycle=0; this.stepTimer=0; this.active=true;
    this._bindMouseLook(); this._buildJoystick();
    Console.log('Player spawned — RMB drag to look, WASD to move, Space jump','log','PlayerRig.js');
  },

  _bindMouseLook() {
    const canvas=document.getElementById('scene-canvas');
    if(!canvas) return;
    canvas.addEventListener('mousedown',e=>{
      if(e.button===2&&this.active){this.mouseLookActive=true;canvas.requestPointerLock?.();}
    });
    document.addEventListener('mouseup',e=>{
      if(e.button===2){this.mouseLookActive=false;document.exitPointerLock?.();}
    });
    document.addEventListener('mousemove',e=>{
      if(!this.active) return;
      if(this.mouseLookActive||document.pointerLockElement){
        this.camYaw  -=(e.movementX||0)*0.003;
        this.camPitch-=(e.movementY||0)*0.003;
        this.camPitch=Math.max(this.camMinPitch,Math.min(this.camMaxPitch,this.camPitch));
      }
    });
    canvas.addEventListener('wheel',e=>{
      if(!this.active) return;
      this.camDist=Math.max(this.camMinDist,Math.min(this.camMaxDist,this.camDist+e.deltaY*0.01));
      e.stopPropagation();
    },{passive:true});
  },

  _buildJoystick() {
    document.getElementById('rig-joy-overlay')?.remove();
    const overlay=document.createElement('div');
    overlay.id='rig-joy-overlay';
    overlay.style.cssText='position:fixed;bottom:0;left:0;right:0;height:200px;z-index:999;pointer-events:none;';
    const lZone=document.createElement('div');
    lZone.style.cssText='position:absolute;left:0;bottom:0;width:50%;height:100%;pointer-events:auto;';
    const lBase=document.createElement('div');
    lBase.id='rig-joy-base';
    lBase.style.cssText='position:absolute;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,0.05);border:2px solid rgba(255,255,255,0.15);display:none;pointer-events:none;';
    const lStick=document.createElement('div');
    lStick.id='rig-joy-stick';
    lStick.style.cssText='position:absolute;top:50%;left:50%;width:44px;height:44px;border-radius:50%;background:rgba(0,164,220,0.55);border:2px solid rgba(0,164,220,1);transform:translate(-50%,-50%);';
    lBase.appendChild(lStick); lZone.appendChild(lBase); overlay.appendChild(lZone);
    const hint=document.createElement('div');
    hint.style.cssText='position:absolute;bottom:6px;left:50%;transform:translateX(-50%);font-size:9px;color:rgba(255,255,255,0.18);font-family:monospace;pointer-events:none;white-space:nowrap;';
    hint.textContent='LEFT: move  •  RMB drag: look  •  SPACE: jump  •  F: shoot';
    overlay.appendChild(hint);
    document.body.appendChild(overlay);
    lZone.addEventListener('touchstart',e=>{
      e.preventDefault(); if(this.joyActive) return;
      const t=e.changedTouches[0]; this.joyId=t.identifier; this.joyActive=true;
      this.joyBaseX=t.clientX; this.joyBaseY=t.clientY;
      lBase.style.display='block';
      lBase.style.left=(t.clientX-60)+'px';
      lBase.style.top=(t.clientY-60-overlay.getBoundingClientRect().top)+'px';
    },{passive:false});
    document.addEventListener('touchmove',e=>{
      if(!this.joyActive) return;
      Array.from(e.changedTouches).forEach(t=>{
        if(t.identifier!==this.joyId) return;
        const dx=t.clientX-this.joyBaseX,dy=t.clientY-this.joyBaseY;
        const dist=Math.sqrt(dx*dx+dy*dy),max=55;
        const nx=dist>max?dx/dist*max:dx, ny=dist>max?dy/dist*max:dy;
        this.joyX=nx/max; this.joyY=ny/max;
        lStick.style.transform='translate(calc(-50% + '+nx+'px), calc(-50% + '+ny+'px))';
      });
    });
    document.addEventListener('touchend',e=>{
      Array.from(e.changedTouches).forEach(t=>{
        if(t.identifier===this.joyId){
          this.joyActive=false; this.joyId=null; this.joyX=0; this.joyY=0;
          lBase.style.display='none'; lStick.style.transform='translate(-50%,-50%)';
        }
      });
    });
  },

  update(dt) {
    if(!this.active||!this.group) return;
    let moveX=Input.axis('horizontal'), moveZ=-Input.axis('vertical');
    if(Math.abs(this.joyX)>0.1) moveX=this.joyX;
    if(Math.abs(this.joyY)>0.1) moveZ=this.joyY;
    const moving=Math.abs(moveX)>0.05||Math.abs(moveZ)>0.05;
    if(moving) {
      const fwd=new THREE.Vector3(-Math.sin(this.camYaw),0,-Math.cos(this.camYaw));
      const right=new THREE.Vector3(Math.cos(this.camYaw),0,-Math.sin(this.camYaw));
      this.group.position.addScaledVector(right,moveX*this.speed*dt);
      this.group.position.addScaledVector(fwd,moveZ*this.speed*dt);
      const moveAngle=Math.atan2(moveX,-moveZ)+this.camYaw;
      this.group.rotation.y=THREE.MathUtils.lerp(this.group.rotation.y,moveAngle,0.18);
      this.walkCycle+=dt*9;
      const g=this.group;
      if(g._lUA) g._lUA.rotation.x= Math.sin(this.walkCycle)*0.55;
      if(g._rUA) g._rUA.rotation.x=-Math.sin(this.walkCycle)*0.55;
      if(g._lUL) g._lUL.rotation.x=-Math.sin(this.walkCycle)*0.65;
      if(g._rUL) g._rUL.rotation.x= Math.sin(this.walkCycle)*0.65;
      if(g._lLL) g._lLL.rotation.x= Math.max(0,Math.sin(this.walkCycle)*0.5);
      if(g._rLL) g._rLL.rotation.x= Math.max(0,-Math.sin(this.walkCycle)*0.5);
      this.stepTimer+=dt;
      if(this.stepTimer>0.38){this.stepTimer=0;AudioSystem.synth('footstep',{volume:0.12});}
    } else {
      this.walkCycle=0; this.stepTimer=0;
      const g=this.group;
      [g._lUA,g._rUA,g._lUL,g._rUL,g._lLL,g._rLL].forEach(m=>{if(m)m.rotation.x*=0.75;});
    }
    this.vy+=(-16)*dt;
    this.group.position.y+=this.vy*dt;
    if(this.group.position.y<=1.0){
      if(this.vy<-4)AudioSystem.synth('land',{volume:0.2});
      this.group.position.y=1.0; this.vy=0; this.grounded=true;
    } else { this.grounded=false; }
    if((Input.pressed('Space')||Input.pressed(' '))&&this.grounded){
      this.vy=this.jumpForce; this.grounded=false;
      AudioSystem.synth('jump',{volume:0.3});
      if(window.CVfx) window.CVfx.spawnDust(this.group.position);
    }
    // Camera — Roblox/Fortnite third-person
    const camTarget=new THREE.Vector3(this.group.position.x,this.group.position.y+1.4,this.group.position.z);
    const cx=camTarget.x+this.camDist*Math.sin(this.camYaw)*Math.cos(this.camPitch);
    const cy=camTarget.y+this.camDist*Math.sin(this.camPitch);
    const cz=camTarget.z+this.camDist*Math.cos(this.camYaw)*Math.cos(this.camPitch);
    this.camera.position.lerp(new THREE.Vector3(cx,cy,cz),0.15);
    this.camera.lookAt(camTarget);
  },

  despawn() {
    this.active=false;
    if(this.group&&this.scene){this.scene.remove(this.group);this.group=null;}
    document.getElementById('rig-joy-overlay')?.remove();
    document.exitPointerLock?.();
    this.joyX=0; this.joyY=0; this.joyActive=false;
  }
};

/* ══════════════════════════════════════
   CODE EDITOR
══════════════════════════════════════ */
const CodeEditor = {
  files:{}, activeFile:null,
  init() {
    const saved=localStorage.getItem('cengine_scripts');
    if(saved) try{this.files=JSON.parse(saved);}catch(e){this.files={};}
    if(!this.files['PlayerController.js']) this.files['PlayerController.js']=`// PlayerController.js\nclass PlayerController {\n  onStart() {\n    this.speed = 5;\n    CEngine.log('Player ready');\n  }\n  onUpdate(dt) {\n    const h = Input.axis('horizontal');\n    const v = Input.axis('vertical');\n    this.transform.position.x += h * this.speed * dt;\n    this.transform.position.z -= v * this.speed * dt;\n    if (Input.pressed('Space') && this.rb.grounded) {\n      this.rb.addForce(0, 8, 0);\n    }\n  }\n}`;
    if(!this.files['EnemyAI.js']) this.files['EnemyAI.js']=`// EnemyAI.js\nclass EnemyAI {\n  onStart() { this.speed = 2; this.health = 100; }\n  onUpdate(dt) {\n    const player = Scene.find('Player');\n    if (!player) return;\n    const dir = Vector3.normalize(Vector3.sub(player.transform.position, this.transform.position));\n    const dist = Vector3.distance(player.transform.position, this.transform.position);\n    if (dist < 10 && dist > 1.5) {\n      this.transform.position.x += dir.x * this.speed * dt;\n      this.transform.position.z += dir.z * this.speed * dt;\n    }\n  }\n}`;
    if(!this.files['GameManager.js']) this.files['GameManager.js']=`// GameManager.js\nclass GameManager {\n  onStart() { this.score = 0; CEngine.log('Game started'); }\n  addScore(pts) { this.score += pts; Sound.Synth.play('coin'); }\n  gameOver() { Sound.Synth.play('death'); CEngine.log('GAME OVER: ' + this.score); }\n}`;
    this._save(); this.activeFile='PlayerController.js';
  },
  _save() { localStorage.setItem('cengine_scripts',JSON.stringify(this.files)); },
  getContent() {
    if(window.monacoEditor) return window.monacoEditor.getValue();
    const ta=document.querySelector('#monaco-container textarea');
    return ta?ta.value:null;
  },
  setContent(text) {
    if(window.monacoEditor) window.monacoEditor.setValue(text);
    else{const ta=document.querySelector('#monaco-container textarea');if(ta)ta.value=text;}
  },
  newFile() {
    const name=prompt('Script name (e.g. MyScript.js):');
    if(!name?.trim()) return;
    const safe=name.trim();
    const cls=safe.replace(/\.js$/,'').replace(/[^a-zA-Z0-9]/g,'');
    this.files[safe]='// '+safe+'\nclass '+cls+' {\n  onStart() {\n    CEngine.log(\''+cls+' started\');\n  }\n  onUpdate(dt) {\n    \n  }\n}';
    this._save(); this.open(safe); toast('Created: '+safe,'success');
  },
  open(name) {
    this.activeFile=name; this.setContent(this.files[name]||'');
    const fn=document.getElementById('code-file-name');
    if(fn) fn.textContent=name;
    document.querySelector('.center-tab[data-tab="code"]')?.click();
  },
  save() {
    if(!this.activeFile) return;
    const c=this.getContent(); if(c===null) return;
    this.files[this.activeFile]=c; this._save();
    toast('Saved: '+this.activeFile,'success');
    Console.log('Saved: '+this.activeFile,'log','CodeEditor.js');
  },
  run() {
    if(!this.activeFile) return;
    const c=this.getContent(); if(!c) return;
    this.files[this.activeFile]=c; this._save();
    try{new Function(c)();toast('Executed: '+this.activeFile,'success');}
    catch(e){Console.log('Error: '+e.message,'error',this.activeFile);toast('Error: '+e.message,'error',4000);}
  },
  attachToSelected() {
    const entity=SceneData.getById(SceneData.selected);
    if(!entity){toast('Select an entity first','warn');return;}
    const c=this.getContent(); if(!c) return;
    if(!entity.components) entity.components=[];
    const idx=entity.components.findIndex(x=>x.name===this.activeFile);
    if(idx!==-1) entity.components[idx].code=c;
    else entity.components.push({type:'script',name:this.activeFile,code:c});
    toast('Attached '+this.activeFile+' → '+entity.name,'success');
    HierarchyPanel.refresh();
  }
};

/* ══════════════════════════════════════
   MODEL BUILDER
   Built-in model creator — combine
   primitives, CSG-style, export as entity
══════════════════════════════════════ */
const ModelBuilder = {
  open: false,
  builderScene: null,
  builderRenderer: null,
  builderCamera: null,
  builderParts: [],
  selectedPart: null,
  builderTheta: 0.5,
  builderPhi: 1.0,
  builderRadius: 8,
  builderTarget: null,
  orbitDrag: false,
  orbitLastX: 0, orbitLastY: 0,
  modelName: 'MyModel',

  init() {
    this._buildUI();
  },

  _buildUI() {
    // Build the model builder tab content
    const tabBlueprint = document.getElementById('tab-blueprint');
    if (!tabBlueprint) return;

    tabBlueprint.innerHTML = `
      <div id="model-builder-wrap" style="display:flex;width:100%;height:100%;background:#0d0d0d;">

        <!-- Left panel: parts list + add buttons -->
        <div id="mb-left" style="width:200px;flex-shrink:0;border-right:1px solid #2a2a2a;display:flex;flex-direction:column;background:#141414;">
          <div style="padding:8px 10px;border-bottom:1px solid #2a2a2a;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:11px;font-weight:700;color:#ccc;text-transform:uppercase;letter-spacing:0.05em;">Model Builder</span>
          </div>

          <!-- Model name -->
          <div style="padding:6px 8px;border-bottom:1px solid #1a1a1a;">
            <input id="mb-model-name" type="text" value="MyModel" placeholder="Model name"
              style="width:100%;background:#0a0a0a;border:1px solid #2a2a2a;color:#ccc;padding:4px 7px;border-radius:3px;font-size:11px;outline:none;font-family:monospace;"/>
          </div>

          <!-- Add primitives -->
          <div style="padding:6px 8px;border-bottom:1px solid #1a1a1a;">
            <div style="font-size:9px;color:#555;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px;">Add Part</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;">
              ${['cube','sphere','cylinder','cone','plane','torus','ring','capsule'].map(type=>
                `<button class="mb-add-btn" data-type="${type}" style="background:#1a1a1a;border:1px solid #2a2a2a;color:#888;padding:4px 0;border-radius:3px;font-size:9px;cursor:pointer;font-family:inherit;text-transform:capitalize;">${type}</button>`
              ).join('')}
            </div>
          </div>

          <!-- Parts list -->
          <div style="font-size:9px;color:#555;text-transform:uppercase;letter-spacing:0.08em;padding:6px 8px 3px;">Parts</div>
          <div id="mb-parts-list" style="flex:1;overflow-y:auto;padding:0 6px 6px;"></div>

          <!-- Export button -->
          <div style="padding:8px;">
            <button id="mb-export-btn" style="width:100%;background:#1e3a5a;border:1px solid rgba(0,164,220,0.4);color:#00a4dc;padding:8px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">
              ✓ Add to Scene
            </button>
          </div>
        </div>

        <!-- Center: 3D viewport -->
        <div id="mb-viewport" style="flex:1;position:relative;overflow:hidden;">
          <canvas id="mb-canvas" style="width:100%;height:100%;display:block;"></canvas>
          <div style="position:absolute;top:6px;left:6px;font-size:9px;color:rgba(255,255,255,0.2);font-family:monospace;pointer-events:none;">RMB: orbit  •  Scroll: zoom  •  Click: select</div>
        </div>

        <!-- Right panel: selected part properties -->
        <div id="mb-right" style="width:200px;flex-shrink:0;border-left:1px solid #2a2a2a;display:flex;flex-direction:column;background:#141414;">
          <div style="padding:8px 10px;border-bottom:1px solid #2a2a2a;">
            <span style="font-size:11px;font-weight:700;color:#ccc;text-transform:uppercase;letter-spacing:0.05em;">Properties</span>
          </div>
          <div id="mb-props" style="flex:1;overflow-y:auto;padding:8px;">
            <div style="color:#444;font-size:11px;text-align:center;margin-top:20px;">Click a part to edit</div>
          </div>
        </div>
      </div>`;

    // Wire add buttons
    document.querySelectorAll('.mb-add-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        AudioSystem.click();
        this._addPart(btn.dataset.type);
      });
    });

    document.getElementById('mb-export-btn')?.addEventListener('click', () => {
      AudioSystem.click();
      this._exportToScene();
    });

    document.getElementById('mb-model-name')?.addEventListener('input', function() {
      ModelBuilder.modelName = this.value || 'MyModel';
    });
  },

  _initRenderer() {
    if (this.builderRenderer) return;
    const canvas = document.getElementById('mb-canvas');
    if (!canvas || typeof THREE === 'undefined') return;

    this.builderTarget = new THREE.Vector3(0, 0, 0);

    this.builderRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.builderRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.builderRenderer.shadowMap.enabled = true;
    this.builderRenderer.setClearColor(0x0d0d0d);

    this.builderScene = new THREE.Scene();
    this.builderScene.fog = new THREE.FogExp2(0x0d0d0d, 0.04);

    this.builderCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
    this._syncBuilderCam();

    // Lights
    this.builderScene.add(new THREE.AmbientLight(0x404040, 2));
    const dl = new THREE.DirectionalLight(0xffffff, 2);
    dl.position.set(5, 10, 5); dl.castShadow = true;
    this.builderScene.add(dl);
    const fill = new THREE.PointLight(0x2244aa, 1, 20);
    fill.position.set(-5, 3, -5);
    this.builderScene.add(fill);

    // Grid
    const grid = new THREE.GridHelper(20, 20, 0x222222, 0x181818);
    this.builderScene.add(grid);

    // Ground
    const gnd = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1 })
    );
    gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true;
    this.builderScene.add(gnd);

    // Axis helper
    this.builderScene.add(new THREE.AxesHelper(2));

    // Events
    this._bindBuilderEvents(canvas);

    // Resize observer
    const ro = new ResizeObserver(() => this._resizeBuilder());
    ro.observe(canvas.parentElement);
    this._resizeBuilder();

    // Render loop
    const loop = () => {
      requestAnimationFrame(loop);
      if (!this.builderRenderer) return;
      this.builderRenderer.render(this.builderScene, this.builderCamera);
    };
    loop();
  },

  _syncBuilderCam() {
    if (!this.builderCamera || !this.builderTarget) return;
    this.builderCamera.position.set(
      this.builderTarget.x + this.builderRadius * Math.sin(this.builderPhi) * Math.sin(this.builderTheta),
      this.builderTarget.y + this.builderRadius * Math.cos(this.builderPhi),
      this.builderTarget.z + this.builderRadius * Math.sin(this.builderPhi) * Math.cos(this.builderTheta)
    );
    this.builderCamera.lookAt(this.builderTarget);
  },

  _resizeBuilder() {
    const canvas = document.getElementById('mb-canvas');
    if (!canvas || !this.builderRenderer) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    this.builderRenderer.setSize(w, h, false);
    this.builderCamera.aspect = w / h;
    this.builderCamera.updateProjectionMatrix();
  },

  _bindBuilderEvents(canvas) {
    const raycaster = new THREE.Raycaster();

    canvas.addEventListener('mousedown', e => {
      if (e.button === 2) {
        this.orbitDrag = true;
        this.orbitLastX = e.clientX; this.orbitLastY = e.clientY;
        canvas.style.cursor = 'grabbing'; e.preventDefault();
      }
    });

    document.addEventListener('mousemove', e => {
      if (!this.orbitDrag) return;
      this.builderTheta -= (e.clientX - this.orbitLastX) * 0.007;
      this.builderPhi    = Math.max(0.05, Math.min(Math.PI - 0.05, this.builderPhi + (e.clientY - this.orbitLastY) * 0.007));
      this.orbitLastX = e.clientX; this.orbitLastY = e.clientY;
      this._syncBuilderCam();
    });

    document.addEventListener('mouseup', e => {
      if (e.button === 2) { this.orbitDrag = false; canvas.style.cursor = ''; }
    });

    canvas.addEventListener('contextmenu', e => e.preventDefault());

    canvas.addEventListener('wheel', e => {
      this.builderRadius = Math.max(1, Math.min(40, this.builderRadius + e.deltaY * 0.015));
      this._syncBuilderCam(); e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('click', e => {
      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width)  * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, this.builderCamera);
      const meshes = this.builderParts.map(p => p.mesh);
      const hits = raycaster.intersectObjects(meshes, true);
      if (hits.length > 0) {
        const part = this.builderParts.find(p => p.mesh === hits[0].object || p.mesh.children.includes(hits[0].object));
        if (part) { this._selectPart(part); AudioSystem.click(); }
      } else {
        this._selectPart(null);
      }
    });
  },

  _addPart(type) {
    const geoMap = {
      cube:     () => new THREE.BoxGeometry(1, 1, 1),
      sphere:   () => new THREE.SphereGeometry(0.5, 20, 20),
      cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
      cone:     () => new THREE.ConeGeometry(0.5, 1, 20),
      plane:    () => new THREE.PlaneGeometry(1, 1),
      torus:    () => new THREE.TorusGeometry(0.5, 0.18, 14, 36),
      ring:     () => new THREE.RingGeometry(0.3, 0.5, 16),
      capsule:  () => new THREE.CylinderGeometry(0.3, 0.3, 0.8, 16)
    };

    const colors = [0x4488cc, 0xcc6633, 0x44aa66, 0xcc4488, 0xccaa22, 0x8844cc, 0x44ccaa, 0xcc2244];
    const color  = colors[this.builderParts.length % colors.length];

    const geo  = (geoMap[type] || geoMap.cube)();
    const mat  = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.position.set(0, 0.5, 0);

    this.builderScene.add(mesh);

    const part = {
      id: Date.now(),
      type,
      mesh,
      name: type + '_' + (this.builderParts.length + 1),
      color: '#' + color.toString(16).padStart(6, '0')
    };

    this.builderParts.push(part);
    this._refreshPartsList();
    this._selectPart(part);
    Console.log('Added part: ' + type, 'log', 'ModelBuilder');
  },

  _refreshPartsList() {
    const list = document.getElementById('mb-parts-list');
    if (!list) return;
    list.innerHTML = '';

    if (this.builderParts.length === 0) {
      list.innerHTML = '<div style="color:#333;font-size:10px;text-align:center;padding:10px;">No parts yet</div>';
      return;
    }

    this.builderParts.forEach(part => {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;gap:5px;padding:5px 4px;border-radius:3px;cursor:pointer;border:1px solid transparent;margin-bottom:2px;' +
        (this.selectedPart === part ? 'background:#1e3a5a;border-color:rgba(0,164,220,0.3);' : '');
      item.innerHTML =
        '<div style="width:10px;height:10px;border-radius:2px;background:' + part.color + ';flex-shrink:0;"></div>' +
        '<span style="font-size:10px;color:#aaa;flex:1;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + part.name + '</span>' +
        '<button style="background:transparent;border:none;color:#444;cursor:pointer;font-size:11px;padding:0 2px;line-height:1;" data-delete="' + part.id + '">✕</button>';

      item.addEventListener('click', e => {
        if (e.target.dataset.delete) {
          e.stopPropagation();
          this._deletePart(parseInt(e.target.dataset.delete));
          return;
        }
        this._selectPart(part); AudioSystem.click();
      });

      list.appendChild(item);
    });
  },

  _deletePart(id) {
    const part = this.builderParts.find(p => p.id === id);
    if (!part) return;
    this.builderScene.remove(part.mesh);
    part.mesh.geometry?.dispose();
    part.mesh.material?.dispose();
    this.builderParts = this.builderParts.filter(p => p.id !== id);
    if (this.selectedPart?.id === id) this._selectPart(null);
    this._refreshPartsList();
    AudioSystem.warn();
  },

  _selectPart(part) {
    // Clear outline on previous
    if (this.selectedPart) {
      this.selectedPart.mesh.material.emissive?.setHex(0x000000);
    }

    this.selectedPart = part;

    // Highlight selected
    if (part) {
      part.mesh.material.emissive = new THREE.Color(0x004488);
    }

    this._refreshPartsList();
    this._showPartProps(part);
  },

  _showPartProps(part) {
    const props = document.getElementById('mb-props');
    if (!props) return;

    if (!part) {
      props.innerHTML = '<div style="color:#444;font-size:11px;text-align:center;margin-top:20px;">Click a part to edit</div>';
      return;
    }

    const fmt = n => (n || 0).toFixed(2);
    const p = part.mesh.position, r = part.mesh.rotation, s = part.mesh.scale;

    props.innerHTML =
      // Name
      '<div style="margin-bottom:8px;">' +
        '<div style="font-size:9px;color:#555;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:3px;">Name</div>' +
        '<input id="mb-part-name" type="text" value="' + part.name + '" style="width:100%;background:#0a0a0a;border:1px solid #2a2a2a;color:#ccc;padding:4px 7px;border-radius:3px;font-size:11px;outline:none;font-family:monospace;box-sizing:border-box;"/>' +
      '</div>' +
      // Color
      '<div style="margin-bottom:8px;">' +
        '<div style="font-size:9px;color:#555;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:3px;">Color</div>' +
        '<input id="mb-part-color" type="color" value="' + part.color + '" style="width:100%;height:28px;border:1px solid #2a2a2a;border-radius:3px;cursor:pointer;background:none;padding:1px;"/>' +
      '</div>' +
      // Position
      this._mbVec3('Position', 'mb-pos', p.x, p.y, p.z) +
      // Rotation (degrees)
      this._mbVec3('Rotation°', 'mb-rot',
        THREE.MathUtils.radToDeg(r.x),
        THREE.MathUtils.radToDeg(r.y),
        THREE.MathUtils.radToDeg(r.z)
      ) +
      // Scale
      this._mbVec3('Scale', 'mb-scl', s.x, s.y, s.z) +
      // Material
      '<div style="margin-bottom:8px;">' +
        '<div style="font-size:9px;color:#555;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:3px;">Metalness</div>' +
        '<input id="mb-metal" type="range" min="0" max="1" step="0.01" value="' + (part.mesh.material.metalness || 0.1) + '" style="width:100%;accent-color:#00a4dc;"/>' +
      '</div>' +
      '<div style="margin-bottom:8px;">' +
        '<div style="font-size:9px;color:#555;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:3px;">Roughness</div>' +
        '<input id="mb-rough" type="range" min="0" max="1" step="0.01" value="' + (part.mesh.material.roughness || 0.4) + '" style="width:100%;accent-color:#00a4dc;"/>' +
      '</div>' +
      // Wireframe toggle
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
        '<span style="font-size:9px;color:#555;text-transform:uppercase;letter-spacing:0.07em;">Wireframe</span>' +
        '<input id="mb-wire" type="checkbox" ' + (part.mesh.material.wireframe ? 'checked' : '') + ' style="accent-color:#00a4dc;width:14px;height:14px;cursor:pointer;"/>' +
      '</div>' +
      // Delete
      '<button id="mb-del-part" style="width:100%;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.3);color:#c0392b;padding:6px;border-radius:3px;font-size:10px;cursor:pointer;font-family:inherit;">Delete Part</button>';

    // Wire events
    document.getElementById('mb-part-name')?.addEventListener('input', function() {
      part.name = this.value; ModelBuilder._refreshPartsList();
    });

    document.getElementById('mb-part-color')?.addEventListener('input', function() {
      part.color = this.value;
      part.mesh.material.color.set(this.value);
      ModelBuilder._refreshPartsList();
    });

    // Position inputs
    ['x','y','z'].forEach(axis => {
      document.getElementById('mb-pos-'+axis)?.addEventListener('input', function() {
        part.mesh.position[axis] = parseFloat(this.value) || 0;
      });
      document.getElementById('mb-rot-'+axis)?.addEventListener('input', function() {
        part.mesh.rotation[axis] = THREE.MathUtils.degToRad(parseFloat(this.value) || 0);
      });
      document.getElementById('mb-scl-'+axis)?.addEventListener('input', function() {
        part.mesh.scale[axis] = parseFloat(this.value) || 1;
      });
    });

    document.getElementById('mb-metal')?.addEventListener('input', function() {
      part.mesh.material.metalness = parseFloat(this.value);
    });
    document.getElementById('mb-rough')?.addEventListener('input', function() {
      part.mesh.material.roughness = parseFloat(this.value);
    });
    document.getElementById('mb-wire')?.addEventListener('change', function() {
      part.mesh.material.wireframe = this.checked;
    });
    document.getElementById('mb-del-part')?.addEventListener('click', () => {
      this._deletePart(part.id);
    });
  },

  _mbVec3(label, prefix, x=0, y=0, z=0) {
    const fmt = n => (n || 0).toFixed(2);
    return '<div style="margin-bottom:8px;">' +
      '<div style="font-size:9px;color:#555;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:3px;">' + label + '</div>' +
      '<div style="display:flex;gap:3px;">' +
        '<div style="flex:1;display:flex;flex-direction:column;gap:1px;"><span style="font-size:8px;color:#c05555;font-weight:700;">X</span><input id="' + prefix + '-x" type="number" value="' + fmt(x) + '" step="0.1" style="width:100%;background:#0a0a0a;border:1px solid #2a2a2a;color:#ccc;padding:3px 4px;border-radius:2px;font-size:10px;outline:none;font-family:monospace;text-align:right;"/></div>' +
        '<div style="flex:1;display:flex;flex-direction:column;gap:1px;"><span style="font-size:8px;color:#55aa55;font-weight:700;">Y</span><input id="' + prefix + '-y" type="number" value="' + fmt(y) + '" step="0.1" style="width:100%;background:#0a0a0a;border:1px solid #2a2a2a;color:#ccc;padding:3px 4px;border-radius:2px;font-size:10px;outline:none;font-family:monospace;text-align:right;"/></div>' +
        '<div style="flex:1;display:flex;flex-direction:column;gap:1px;"><span style="font-size:8px;color:#5588dd;font-weight:700;">Z</span><input id="' + prefix + '-z" type="number" value="' + fmt(z) + '" step="0.1" style="width:100%;background:#0a0a0a;border:1px solid #2a2a2a;color:#ccc;padding:3px 4px;border-radius:2px;font-size:10px;outline:none;font-family:monospace;text-align:right;"/></div>' +
      '</div>' +
    '</div>';
  },

  _exportToScene() {
    if (this.builderParts.length === 0) { toast('Add at least one part', 'warn'); return; }

    const name = this.modelName || 'MyModel';

    // Create a group containing all parts
    const group = new THREE.Group();
    this.builderParts.forEach(part => {
      const clonedMesh = part.mesh.clone();
      // Clone material so it's independent
      clonedMesh.material = part.mesh.material.clone();
      clonedMesh.castShadow = true;
      clonedMesh.receiveShadow = true;
      group.add(clonedMesh);
    });

    // Center the group
    const box = new THREE.Box3().setFromObject(group);
    const center = new THREE.Vector3();
    box.getCenter(center);
    group.children.forEach(child => child.position.sub(center));
    group.position.set(0, 1, 0);

    SceneView.scene.add(group);

    const entity = SceneData.add(name, 'model', group);
    entity.position = { x: 0, y: 1, z: 0 };
    entity._isCustomModel = true;
    entity._parts = this.builderParts.map(p => ({
      type: p.type, name: p.name, color: p.color,
      position: { x: p.mesh.position.x, y: p.mesh.position.y, z: p.mesh.position.z },
      rotation: { x: p.mesh.rotation.x, y: p.mesh.rotation.y, z: p.mesh.rotation.z },
      scale: { x: p.mesh.scale.x, y: p.mesh.scale.y, z: p.mesh.scale.z },
      metalness: p.mesh.material.metalness,
      roughness: p.mesh.material.roughness
    }));

    HierarchyPanel.refresh();
    SceneData.select(entity.id);
    HierarchyPanel.selectItem(entity.id);

    // Switch back to scene tab
    document.querySelector('.center-tab[data-tab="scene"]')?.click();

    toast('Model "' + name + '" added to scene!', 'success');
    Console.log('Exported model: ' + name + ' (' + this.builderParts.length + ' parts)', 'log', 'ModelBuilder');
    AudioSystem.success();
  },

  // Initialize renderer when blueprint tab is clicked
  onTabOpen() {
    setTimeout(() => {
      this._initRenderer();
    }, 50);
  }
};

/* ══════════════════════════════════════
   AI HELPER — fixed, no CORS issues
══════════════════════════════════════ */
const AIHelper = {
  open: false,
  history: [],
  panel: null,

  init() {
    this.panel = document.createElement('div');
    this.panel.id = 'ai-helper-panel';
    this.panel.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:80px',
      'width:340px',
      'max-height:500px',
      'background:#1a1a1a',
      'border:1px solid #333',
      'border-top:2px solid #00a4dc',
      'border-radius:6px',
      'display:flex',
      'flex-direction:column',
      'z-index:10000',
      'box-shadow:0 12px 40px rgba(0,0,0,0.6)',
      'font-family:Inter,sans-serif',
      'overflow:hidden'
    ].join(';');
    this.panel.classList.add('hidden');

    this.panel.innerHTML =
      // Header
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#111;border-bottom:1px solid #2a2a2a;flex-shrink:0;">' +
        '<div style="display:flex;align-items:center;gap:7px;">' +
          '<div style="width:7px;height:7px;border-radius:50%;background:#00a4dc;box-shadow:0 0 6px #00a4dc;"></div>' +
          '<span style="font-size:12px;font-weight:700;color:#e0e0e0;letter-spacing:0.04em;">CEngine AI</span>' +
          '<span style="font-size:9px;color:#444;font-family:monospace;">claude-sonnet</span>' +
        '</div>' +
        '<button id="ai-close-btn" style="background:transparent;border:none;color:#555;font-size:18px;cursor:pointer;line-height:1;padding:0 2px;" title="Close">✕</button>' +
      '</div>' +
      // Messages
      '<div id="ai-msgs" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;min-height:80px;max-height:340px;"></div>' +
      // Input row
      '<div style="padding:8px;border-top:1px solid #252525;display:flex;gap:6px;flex-shrink:0;background:#111;">' +
        '<textarea id="ai-input" rows="2" placeholder="Ask anything — how to make enemies, shooting, scripts..." ' +
          'style="flex:1;background:#0a0a0a;border:1px solid #2a2a2a;color:#ccc;padding:7px 9px;border-radius:4px;font-size:11px;outline:none;font-family:inherit;resize:none;line-height:1.4;"></textarea>' +
        '<button id="ai-send-btn" style="background:#00a4dc;border:none;color:#000;padding:0 12px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:900;align-self:flex-end;height:32px;flex-shrink:0;">↑</button>' +
      '</div>';

    document.body.appendChild(this.panel);

    document.getElementById('ai-close-btn')?.addEventListener('click', () => this.toggle());
    document.getElementById('ai-send-btn')?.addEventListener('click', () => this.send());
    document.getElementById('ai-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
    });

    // Welcome message
    this._addMsg('assistant', 'Hey! I\'m your CEngine AI assistant. I can help you:\n\n• Write scripts for your game\n• Set up enemies, shooting, health systems\n• Debug problems\n• Design game mechanics\n\nWhat are you building?');
  },

  toggle() {
    this.open = !this.open;
    this.panel.classList.toggle('hidden', !this.open);
    if (this.open) {
      document.getElementById('ai-input')?.focus();
      // Scroll to bottom
      const msgs = document.getElementById('ai-msgs');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }
  },

  _addMsg(role, text) {
    const msgs = document.getElementById('ai-msgs');
    if (!msgs) return;

    const div = document.createElement('div');

    if (role === 'user') {
      div.style.cssText = 'align-self:flex-end;max-width:85%;background:#1e3a52;border:1px solid #254d6e;padding:8px 11px;border-radius:8px 8px 2px 8px;font-size:11px;color:#cce8ff;line-height:1.5;word-break:break-word;';
      div.textContent = text;
    } else if (role === 'assistant') {
      div.style.cssText = 'align-self:flex-start;max-width:92%;display:flex;gap:8px;align-items:flex-start;';
      const avatar = document.createElement('div');
      avatar.style.cssText = 'width:20px;height:20px;border-radius:50%;background:#00a4dc;display:flex;align-items:center;justify-content:center;font-size:10px;color:#000;font-weight:900;flex-shrink:0;margin-top:2px;';
      avatar.textContent = 'C';
      const bubble = document.createElement('div');
      bubble.style.cssText = 'background:#202020;border:1px solid #2e2e2e;padding:8px 11px;border-radius:8px 8px 8px 2px;font-size:11px;color:#d0d0d0;line-height:1.6;word-break:break-word;white-space:pre-wrap;flex:1;';
      // Format code blocks
      bubble.innerHTML = text
        .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
          '<pre style="background:#0a0a0a;border:1px solid #2a2a2a;border-radius:4px;padding:8px;margin:6px 0;overflow-x:auto;font-family:\'JetBrains Mono\',monospace;font-size:10px;color:#88ccff;line-height:1.5;">' + code.trim().replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</pre>'
        )
        .replace(/`([^`]+)`/g, '<code style="background:#0a0a0a;padding:1px 5px;border-radius:3px;font-family:\'JetBrains Mono\',monospace;color:#88ccff;font-size:10px;">$1</code>');
      div.appendChild(avatar);
      div.appendChild(bubble);
    } else if (role === 'loading') {
      div.id = 'ai-loading-msg';
      div.style.cssText = 'align-self:flex-start;display:flex;gap:8px;align-items:center;';
      div.innerHTML =
        '<div style="width:20px;height:20px;border-radius:50%;background:#00a4dc;display:flex;align-items:center;justify-content:center;font-size:10px;color:#000;font-weight:900;">C</div>' +
        '<div style="display:flex;gap:3px;align-items:center;padding:8px 12px;background:#202020;border:1px solid #2e2e2e;border-radius:8px;">' +
          '<div style="width:5px;height:5px;border-radius:50%;background:#444;animation:ai-dot 1.2s ease-in-out infinite;"></div>' +
          '<div style="width:5px;height:5px;border-radius:50%;background:#444;animation:ai-dot 1.2s ease-in-out 0.2s infinite;"></div>' +
          '<div style="width:5px;height:5px;border-radius:50%;background:#444;animation:ai-dot 1.2s ease-in-out 0.4s infinite;"></div>' +
        '</div>';
      // Inject animation if not present
      if (!document.getElementById('ai-dot-style')) {
        const style = document.createElement('style');
        style.id = 'ai-dot-style';
        style.textContent = '@keyframes ai-dot{0%,60%,100%{opacity:0.2;transform:scale(0.8)}30%{opacity:1;transform:scale(1.2)}}';
        document.head.appendChild(style);
      }
    }

    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  },

  async send() {
    const inp = document.getElementById('ai-input');
    if (!inp || !inp.value.trim()) return;
    const msg = inp.value.trim(); inp.value = '';

    this._addMsg('user', msg);
    const loadingEl = this._addMsg('loading', '');
    this.history.push({ role: 'user', content: msg });

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-dangerous-allow-browser': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are a helpful assistant built into CEngine, a browser-based 3D game engine powered by Three.js r128.

CEngine scripting uses class-based JavaScript with these lifecycle hooks:
- onStart() — runs once when Play is pressed
- onUpdate(dt) — runs every frame (dt = delta time in seconds)
- onStop() — runs when Stop is pressed
- onCollide(other) — runs on collision

Available APIs inside scripts:
\`\`\`
// Input
Input.held('d')          // is key held
Input.pressed('Space')   // just pressed this frame
Input.axis('horizontal') // returns -1 to 1
Input.axis('vertical')

// Sound
Sound.Synth.play('jump')         // presets: jump land shoot explosion hit coin death footstep
Sound.Synth.play('shoot', { volume: 0.4, pitch: 1.5 })

// Scene
Scene.find('EntityName')        // find entity by name
Scene.spawn('Bullet', {x,y,z})  // create new entity
Scene.destroy(entity)           // remove entity

// Transform
this.transform.position.x/y/z
this.transform.rotation.x/y/z
this.transform.scale.x/y/z

// Rigidbody
this.rb.addForce(x, y, z)
this.rb.setVelocity(x, y, z)
this.rb.grounded  // boolean

// Entity info
this.entity.name
this.entity.active
this.entity.destroy()

// Math helpers
Vector3.add(a, b)
Vector3.sub(a, b)
Vector3.scale(v, scalar)
Vector3.normalize(v)
Vector3.distance(a, b)
Vector3.length(v)

// Logging
CEngine.log('message')
\`\`\`

Game systems available (when GameSystems.js is loaded):
- \`CHealth.damage('player', 10)\` — deal damage
- \`CHealth.heal('player', 10)\` — heal
- \`CProjectiles.fire(scene, origin, direction, opts)\` — fire projectile
- \`CVfx.spawnExplosion(pos)\` — spawn explosion VFX
- \`CVfx.spawnHit(pos)\` — spawn hit sparks
- \`CEnemyAI.register(entity, opts)\` — make entity an AI enemy
- \`CAnimator.play('clipName')\` — play animation clip

Name any entity "Enemy" and it auto-registers as an AI agent that chases the player.

Be concise and helpful. When writing code use proper markdown code blocks. Focus on practical working examples.`,
          messages: this.history.slice(-12)
        })
      });

      // Remove loading indicator
      loadingEl?.remove();

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const errMsg = err.error?.message || ('HTTP ' + response.status);
        this._addMsg('assistant', '**Error:** ' + errMsg + '\n\nMake sure your CEngine is running on a server (not file://) and the API key is configured.');
        this.history.pop();
        return;
      }

      const data = await response.json();
      const reply = data.content?.[0]?.text || 'Sorry, I got an empty response. Try again.';
      this._addMsg('assistant', reply);
      this.history.push({ role: 'assistant', content: reply });

    } catch(err) {
      loadingEl?.remove();
      let errorText = 'Connection failed.';
      if (err.message?.includes('fetch')) {
        errorText = 'Network error — make sure CEngine is running on a server (not file://). The AI requires an internet connection.';
      } else {
        errorText = 'Error: ' + err.message;
      }
      this._addMsg('assistant', errorText);
      this.history.pop();
      Console.log('AI Helper error: ' + err.message, 'error', 'AIHelper.js');
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
    if(!canvas||typeof THREE==='undefined'){Console.log('THREE.js not loaded','error','SceneView.js');return;}
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
    const fill=new THREE.PointLight(0x204060,1.2,30);
    fill.position.set(-8,4,-6); this.scene.add(fill);

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
    const floorMesh=new THREE.Mesh(new THREE.BoxGeometry(12,0.3,12),new THREE.MeshStandardMaterial({color:0x2a2a2a,roughness:0.9}));
    floorMesh.receiveShadow=true; floorMesh.position.set(0,-0.15,0);
    this.scene.add(floorMesh);
    const fe=SceneData.add('Floor','mesh',floorMesh); fe.position={x:0,y:-0.15,z:0};

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
    if(!entity||!entity.mesh){this.transformGizmoGroup.visible=false;return;}
    this.transformGizmoGroup.visible=true;
    this.transformGizmoGroup.position.copy(entity.mesh.position);
  },

  _bindOrbitEvents(canvas) {
    canvas.addEventListener('mousedown',e=>{
      if(e.button===2&&!this.playing){this.orbitDragging=true;this.orbitLastX=e.clientX;this.orbitLastY=e.clientY;canvas.style.cursor='grabbing';e.preventDefault();}
    });
    document.addEventListener('mousemove',e=>{
      if(!this.orbitDragging) return;
      this.theta-=(e.clientX-this.orbitLastX)*0.007;
      this.phi=Math.max(0.05,Math.min(Math.PI-0.05,this.phi+(e.clientY-this.orbitLastY)*0.007));
      this.orbitLastX=e.clientX; this.orbitLastY=e.clientY;
      this._syncCamera();
    });
    document.addEventListener('mouseup',e=>{if(e.button===2){this.orbitDragging=false;canvas.style.cursor='';}});
    canvas.addEventListener('contextmenu',e=>{if(!this.playing)e.preventDefault();});
    canvas.addEventListener('wheel',e=>{
      if(this.playing) return;
      this.radius=Math.max(1.5,Math.min(100,this.radius+e.deltaY*0.022));
      this._syncCamera(); e.preventDefault();
    },{passive:false});

    canvas.addEventListener('touchstart',e=>{
      if(this.playing) return;
      if(e.touches.length===1){this.touchOrbit=true;this.touchLastX=e.touches[0].clientX;this.touchLastY=e.touches[0].clientY;}
      if(e.touches.length===2){this.touchOrbit=false;const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;this.touchLastDist=Math.sqrt(dx*dx+dy*dy);}
      e.preventDefault();
    },{passive:false});
    canvas.addEventListener('touchmove',e=>{
      if(this.playing) return;
      if(e.touches.length===1&&this.touchOrbit&&!this.touchTransform){
        this.theta-=(e.touches[0].clientX-this.touchLastX)*0.007;
        this.phi=Math.max(0.05,Math.min(Math.PI-0.05,this.phi+(e.touches[0].clientY-this.touchLastY)*0.007));
        this.touchLastX=e.touches[0].clientX; this.touchLastY=e.touches[0].clientY;
        this._syncCamera();
      }
      if(e.touches.length===2){
        const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;
        const dist=Math.sqrt(dx*dx+dy*dy);
        this.radius=Math.max(1.5,Math.min(100,this.radius-(dist-this.touchLastDist)*0.04));
        this.touchLastDist=dist; this._syncCamera();
      }
      e.preventDefault();
    },{passive:false});
    canvas.addEventListener('touchend',e=>{if(e.touches.length===0){this.touchOrbit=false;this.touchTransform=false;this.touchTransformStartPos=null;}});

    const keys={};
    document.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;});
    document.addEventListener('keyup',  e=>{keys[e.key.toLowerCase()]=false;});
    setInterval(()=>{
      if(this.playing) return;
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
      if(this.transformMode==='translate'){
        entity.mesh.position.copy(this.transformStartPos);
        entity.mesh.position.addScaledVector(camRight,dx*sensitivity);
        entity.mesh.position.addScaledVector(camUp,-dy*sensitivity);
        entity.position={x:entity.mesh.position.x,y:entity.mesh.position.y,z:entity.mesh.position.z};
      }else if(this.transformMode==='rotate'){
        entity.mesh.rotation.y=this.transformStartRot.y+dx*0.012;
        entity.mesh.rotation.x=this.transformStartRot.x+dy*0.012;
        entity.rotation={x:THREE.MathUtils.radToDeg(entity.mesh.rotation.x),y:THREE.MathUtils.radToDeg(entity.mesh.rotation.y),z:THREE.MathUtils.radToDeg(entity.mesh.rotation.z)};
      }else if(this.transformMode==='scale'){
        const factor=Math.max(0.01,1+dx*0.009);
        entity.mesh.scale.copy(this.transformStartScl).multiplyScalar(factor);
        entity.scale={x:entity.mesh.scale.x,y:entity.mesh.scale.y,z:entity.mesh.scale.z};
      }
      this.transformGizmoGroup.position.copy(entity.mesh.position);
      Inspector.update(entity);
    };

    let mouseStartX=0,mouseStartY=0,mouseDragging=false;
    canvas.addEventListener('mousedown',e=>{
      if(e.button!==0||this.playing) return;
      mouseStartX=e.clientX; mouseStartY=e.clientY; mouseDragging=false;
      const entity=SceneData.getById(SceneData.selected);
      if(!entity||!entity.mesh) return;
      this.transformStartPos=entity.mesh.position.clone();
      this.transformStartRot={x:entity.mesh.rotation.x,y:entity.mesh.rotation.y,z:entity.mesh.rotation.z};
      this.transformStartScl=entity.mesh.scale.clone();
    });
    document.addEventListener('mousemove',e=>{
      if(this.orbitDragging||!this.transformStartPos||this.playing) return;
      const dx=e.clientX-mouseStartX,dy=e.clientY-mouseStartY;
      if(!mouseDragging&&Math.sqrt(dx*dx+dy*dy)<THRESHOLD) return;
      mouseDragging=true; this.transformDragging=true;
      const entity=SceneData.getById(SceneData.selected);
      if(!entity||!entity.mesh) return;
      applyDelta(entity,dx,dy);
    });
    document.addEventListener('mouseup',e=>{
      if(e.button!==0) return;
      if(mouseDragging){this._justFinishedDrag=true;setTimeout(()=>{this._justFinishedDrag=false;},50);}
      mouseDragging=false; this.transformDragging=false;
      this.transformStartPos=null; this.transformStartRot=null; this.transformStartScl=null;
    });

    canvas.addEventListener('click',e=>{
      if(this._justFinishedDrag||this.playing) return;
      const rect=canvas.getBoundingClientRect();
      this.mouse.x=((e.clientX-rect.left)/rect.width)*2-1;
      this.mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
      this.raycaster.setFromCamera(this.mouse,this.camera);
      const meshes=SceneData.entities.filter(en=>en.mesh&&en.active).map(en=>en.mesh);
      const hits=this.raycaster.intersectObjects(meshes,true);
      if(hits.length>0){
        let hit=hits[0].object;
        while(hit.parent&&hit.parent!==this.scene){if(SceneData.entities.find(en=>en.mesh===hit))break;hit=hit.parent;}
        const entity=SceneData.entities.find(en=>en.mesh===hit||en.mesh?.getObjectById?.(hit.id));
        if(entity){SceneData.select(entity.id);HierarchyPanel.selectItem(entity.id);AudioSystem.click();}
      }else{SceneData.selected=null;Inspector.clear();this.transformGizmoGroup.visible=false;HierarchyPanel.clearSelection();}
    });

    let touchDragStartX=0,touchDragStartY=0,touchDragging=false;
    canvas.addEventListener('touchstart',e=>{
      if(e.touches.length!==1||this.playing) return;
      const entity=SceneData.getById(SceneData.selected);
      if(!entity||!entity.mesh) return;
      const touch=e.touches[0],rect=canvas.getBoundingClientRect();
      const mx=((touch.clientX-rect.left)/rect.width)*2-1;
      const my=-((touch.clientY-rect.top)/rect.height)*2+1;
      const tempRay=new THREE.Raycaster();
      tempRay.setFromCamera(new THREE.Vector2(mx,my),this.camera);
      const hits=tempRay.intersectObject(entity.mesh,true);
      if(hits.length>0){
        touchDragStartX=touch.clientX; touchDragStartY=touch.clientY;
        touchDragging=false; this.touchTransform=false;
        this.touchTransformStartPos=entity.mesh.position.clone();
        this.touchTransformStartRot={x:entity.mesh.rotation.x,y:entity.mesh.rotation.y,z:entity.mesh.rotation.z};
        this.touchTransformStartScl=entity.mesh.scale.clone();
        this.touchOrbit=false;
      }
    },{passive:true});
    canvas.addEventListener('touchmove',e=>{
      if(e.touches.length!==1||!this.touchTransformStartPos||this.playing) return;
      const touch=e.touches[0],dx=touch.clientX-touchDragStartX,dy=touch.clientY-touchDragStartY;
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
    canvas.addEventListener('touchend',()=>{touchDragging=false;this.touchTransform=false;this.touchTransformStartPos=null;});
  },

  _bindKeyboard() {
    document.addEventListener('keydown',e=>{
      const tag=document.activeElement?.tagName;
      if(tag==='INPUT'||tag==='TEXTAREA') return;
      if(e.ctrlKey||e.metaKey){
        if(e.key==='s'){e.preventDefault();SceneData.save();}
        if(e.key==='d'){e.preventDefault();this.duplicateSelected();}
        if(e.key==='p'){e.preventDefault();document.getElementById('btn-play')?.click();}
        return;
      }
      const modeMap={'g':'translate','r':'rotate','s':'scale'};
      if(!this.playing&&modeMap[e.key.toLowerCase()]){
        this.setTransformMode(modeMap[e.key.toLowerCase()]);
        document.querySelectorAll('.transform-tool').forEach(b=>b.classList.toggle('active',b.dataset.transform===modeMap[e.key.toLowerCase()]));
        return;
      }
      if(!this.playing){
        if(e.key==='Delete'||e.key==='Backspace') this.deleteSelected();
        if(e.key==='f'||e.key==='F') this.focusSelected();
        if(e.key==='n'||e.key==='N') this.addPrimitive('cube');
      }
      if(e.key==='Escape'){closeAllMenus();ContextMenu.hide();closeBuildModal();}
    });
  },

  _initGyro() {
    const start=()=>{
      window.addEventListener('deviceorientation',e=>{
        if(!this.gyroEnabled||this.playing) return;
        const beta=THREE.MathUtils.degToRad(e.beta||0),alpha=THREE.MathUtils.degToRad(e.alpha||0);
        this.phi=THREE.MathUtils.lerp(this.phi,Math.max(0.1,Math.min(Math.PI-0.1,beta)),0.08);
        this.theta=THREE.MathUtils.lerp(this.theta,-alpha*0.5,0.04);
        this._syncCamera();
      },true);
    };
    if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
      window._requestGyro=()=>DeviceOrientationEvent.requestPermission().then(s=>{if(s==='granted'){start();this.gyroEnabled=true;}}).catch(console.error);
    }else{start();}
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
    AudioSystem.tone(880,0.1,0.04); toast('Added '+name,'success');
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
    HierarchyPanel.refresh(); toast('Deleted','warn');
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

  setTransformMode(mode){this.transformMode=mode;Console.log('Transform mode: '+mode,'log','Editor.js');},
  toggleGrid(v){if(this.grid)this.grid.visible=v;},
  toggleWireframe(v){SceneData.entities.forEach(e=>{if(e.mesh?.material)e.mesh.material.wireframe=v;});},

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
    if(this.transformGizmoGroup.visible){
      const sel=SceneData.getById(SceneData.selected);
      if(sel?.mesh){
        this.transformGizmoGroup.position.copy(sel.mesh.position);
        const dist=this.camera.position.distanceTo(sel.mesh.position);
        this.transformGizmoGroup.scale.setScalar(dist*0.1);
      }
    }
    this.renderer.render(this.scene,this.camera);
    if(this.gizmoRenderer&&this.gizmoScene&&this.gizmoCamera){
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
        model:'<svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1l5 3v4l-5 3-5-3V4z" stroke="#44cc88" stroke-width="1.2" fill="none"/><path d="M6 4v5M2.5 3l3.5 1 3.5-1" stroke="#44cc88" stroke-width="0.8"/></svg>',
        empty:'<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4" stroke="#555" stroke-width="1.2" fill="none" stroke-dasharray="2 2"/></svg>'
      };
      const hasScript=entity.components?.some(c=>c.type==='script');
      item.innerHTML=
        '<span class="tree-indent"></span>'+
        '<svg class="tree-arrow invisible" width="8" height="8" viewBox="0 0 8 8"><path d="M2 2l4 2-4 2" fill="currentColor"/></svg>'+
        (icons[entity.type]||icons.empty)+
        '<span class="tree-label">'+entity.name+'</span>'+
        (hasScript?'<span style="font-size:8px;color:#44cc88;margin-left:2px">●</span>':'')+
        '<button class="tree-eye" data-id="'+entity.id+'"><svg width="10" height="10" viewBox="0 0 10 10"><ellipse cx="5" cy="5" rx="4" ry="2.5" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="5" cy="5" r="1.2" fill="currentColor"/></svg></button>';
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
      item.addEventListener('contextmenu',e=>{e.preventDefault();SceneData.select(entity.id);this.selectItem(entity.id);ContextMenu.show(e.clientX,e.clientY);});
      this.tree.appendChild(item);
    });
  },
  selectItem(id){document.querySelectorAll('.tree-item[data-entity-id]').forEach(el=>el.classList.toggle('selected',parseInt(el.dataset.entityId)===id));},
  clearSelection(){document.querySelectorAll('.tree-item[data-entity-id]').forEach(el=>el.classList.remove('selected'));}
};

/* ══════════════════════════════════════
   INSPECTOR PANEL
══════════════════════════════════════ */
const Inspector = {
  body: document.getElementById('inspector-body'),
  update(entity) {
    if(!this.body) return;
    this.body.innerHTML=
      '<div class="inspector-entity-header">'+
        '<input type="checkbox" id="ent-active" '+(entity.active?'checked':'')+'/>' +
        '<input type="text" class="entity-name-input" id="ent-name" value="'+entity.name+'"/>' +
        '<span class="entity-tag">'+entity.type+'</span>'+
      '</div>'+
      '<div class="component-block">'+
        '<div class="component-header"><svg class="comp-arrow open" width="8" height="8" viewBox="0 0 8 8"><path d="M1 2l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg><span class="component-title">Transform</span></div>'+
        '<div class="component-body">'+this._vec3('Position','pos',entity.position)+this._vec3('Rotation','rot',entity.rotation)+this._vec3('Scale','scl',entity.scale)+'</div>'+
      '</div>'+
      (entity.type==='mesh'  ? this._meshBlock(entity)  : '')+
      (entity.type==='model' ? this._modelBlock(entity) : '')+
      (entity.type==='light' ? this._lightBlock()       : '')+
      this._scriptsBlock(entity)+
      '<div class="add-component-area">'+
        '<button class="add-component-btn" id="btn-add-comp"><svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1v9M1 5.5h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Add Component</button>'+
        '<button class="add-component-btn" id="btn-attach-script" style="margin-top:4px;color:#44cc88;border-color:rgba(68,204,136,0.3);"><svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 3L0.5 5.5 2 8M9 3l1.5 2.5L9 8M6 1.5l-2 8" stroke="currentColor" stroke-width="1.3" fill="none"/></svg> Attach Current Script</button>'+
      '</div>';

    [['pos','position'],['rot','rotation'],['scl','scale']].forEach(([prefix,key])=>{
      ['x','y','z'].forEach(axis=>{
        const inp=document.getElementById(prefix+'-'+axis);
        if(!inp) return;
        inp.addEventListener('input',()=>{
          const v=parseFloat(inp.value)||0; entity[key][axis]=v;
          if(entity.mesh){
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
    const cp=document.getElementById('mesh-color');
    if(cp&&entity.mesh?.material){cp.value='#'+entity.mesh.material.color.getHexString();cp.addEventListener('input',function(){entity.mesh.material.color.set(this.value);});}
    document.querySelectorAll('.component-header').forEach(hdr=>{
      hdr.addEventListener('click',()=>{AudioSystem.click();const body=hdr.nextElementSibling;if(!body)return;const open=body.style.display!=='none';body.style.display=open?'none':'';hdr.querySelector('.comp-arrow')?.classList.toggle('open',!open);});
    });
    document.getElementById('btn-add-comp')?.addEventListener('click',()=>{AudioSystem.click();toast('Component system — coming soon','warn');});
    document.getElementById('btn-attach-script')?.addEventListener('click',()=>{AudioSystem.click();CodeEditor.attachToSelected();});
  },

  _vec3(label,prefix,v={x:0,y:0,z:0}) {
    const fmt=n=>(n||0).toFixed(3);
    return '<div class="prop-row"><span class="prop-label">'+label+'</span>'+
      '<div class="vec3-inputs">'+
        '<label class="x-label">X<input id="'+prefix+'-x" type="number" class="vec-input" value="'+fmt(v.x)+'" step="0.1"/></label>'+
        '<label class="y-label">Y<input id="'+prefix+'-y" type="number" class="vec-input" value="'+fmt(v.y)+'" step="0.1"/></label>'+
        '<label class="z-label">Z<input id="'+prefix+'-z" type="number" class="vec-input" value="'+fmt(v.z)+'" step="0.1"/></label>'+
      '</div></div>';
  },

  _meshBlock(entity) {
    const metal=entity.mesh?.material?.metalness??0.1;
    const rough=entity.mesh?.material?.roughness??0.5;
    return '<div class="component-block"><div class="component-header"><svg class="comp-arrow open" width="8" height="8" viewBox="0 0 8 8"><path d="M1 2l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg><span class="component-title">Mesh Renderer</span></div>'+
      '<div class="component-body">'+
        '<div class="prop-row"><span class="prop-label">Color</span><input type="color" class="prop-color" id="mesh-color" value="#4488cc"/></div>'+
        '<div class="prop-row"><span class="prop-label">Metalness</span><input type="range" class="prop-slider" min="0" max="1" step="0.01" value="'+metal+'" oninput="if(window._selMesh)window._selMesh.material.metalness=+this.value"/></div>'+
        '<div class="prop-row"><span class="prop-label">Roughness</span><input type="range" class="prop-slider" min="0" max="1" step="0.01" value="'+rough+'" oninput="if(window._selMesh)window._selMesh.material.roughness=+this.value"/></div>'+
        '<div class="prop-row"><span class="prop-label">Wireframe</span><input type="checkbox" '+(entity.mesh?.material?.wireframe?'checked':'')+' onchange="if(window._selMesh)window._selMesh.material.wireframe=this.checked" style="accent-color:var(--accent);cursor:pointer"/></div>'+
      '</div></div>';
  },

  _modelBlock(entity) {
    const parts=entity._parts||[];
    return '<div class="component-block"><div class="component-header"><svg class="comp-arrow open" width="8" height="8" viewBox="0 0 8 8"><path d="M1 2l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg><span class="component-title">Custom Model</span></div>'+
      '<div class="component-body">'+
        '<div class="prop-row"><span class="prop-label">Parts</span><span style="font-size:11px;color:#aaa;font-family:monospace;">'+parts.length+' part'+( parts.length!==1?'s':'')+'</span></div>'+
        '<div class="prop-row">'+
          '<button onclick="document.querySelector(\'.center-tab[data-tab=\\\"blueprint\\\"]\')||document.querySelector(\'.center-tab[data-tab=blueprint]\')?.click();document.querySelector(\'.center-tab[data-tab=\\\"blueprint\\\"]\')?.click();" style="background:transparent;border:1px solid #3a3a3a;color:#44cc88;padding:4px 8px;border-radius:3px;font-size:10px;cursor:pointer;font-family:inherit;width:100%;">Edit in Model Builder</button>'+
        '</div>'+
      '</div></div>';
  },

  _lightBlock() {
    return '<div class="component-block"><div class="component-header"><svg class="comp-arrow open" width="8" height="8" viewBox="0 0 8 8"><path d="M1 2l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg><span class="component-title">Light</span></div>'+
      '<div class="component-body">'+
        '<div class="prop-row"><span class="prop-label">Color</span><input type="color" class="prop-color" value="#ffffff"/></div>'+
        '<div class="prop-row"><span class="prop-label">Intensity</span><input type="range" class="prop-slider" min="0" max="5" step="0.1" value="1.5"/></div>'+
      '</div></div>';
  },

  _scriptsBlock(entity) {
    const scripts=entity.components?.filter(c=>c.type==='script')||[];
    if(!scripts.length) return '';
    const items=scripts.map(s=>
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid #2a2a2a;">'+
        '<span style="font-size:10px;color:#44cc88;font-family:monospace;">● '+s.name+'</span>'+
        '<button onclick="CodeEditor.open(\''+s.name+'\')" style="background:transparent;border:1px solid #3a3a3a;color:#888;padding:2px 6px;border-radius:3px;font-size:9px;cursor:pointer">Edit</button>'+
      '</div>'
    ).join('');
    return '<div class="component-block"><div class="component-header"><svg class="comp-arrow open" width="8" height="8" viewBox="0 0 8 8"><path d="M1 2l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg><span class="component-title">Scripts</span></div>'+
      '<div class="component-body" style="gap:0">'+items+'</div></div>';
  },

  clear() {
    if(!this.body) return;
    this.body.innerHTML=
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:var(--text-dim);padding:20px">'+
        '<svg width="28" height="28" viewBox="0 0 28 28" opacity="0.3"><circle cx="14" cy="10" r="5" stroke="#888" stroke-width="1.5" fill="none"/><path d="M5 24c0-5 4-8 9-8s9 3 9 8" stroke="#888" stroke-width="1.5" fill="none"/></svg>'+
        '<p style="font-size:11px">Select an entity</p>'+
        '<p style="font-size:10px;color:var(--text-dim)">to inspect properties</p>'+
      '</div>';
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
  bar.innerHTML=
    '<span class="insert-label">Insert</span>'+
    '<div class="insert-group">'+
      '<button class="insert-btn" data-prim="cube"><svg width="13" height="13" viewBox="0 0 13 13"><path d="M6.5 1.5l5 2.5v5l-5 2.5-5-2.5v-5z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>Cube</button>'+
      '<button class="insert-btn" data-prim="sphere"><svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>Sphere</button>'+
      '<button class="insert-btn" data-prim="cylinder"><svg width="13" height="13" viewBox="0 0 13 13"><ellipse cx="6.5" cy="4" rx="4" ry="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/><ellipse cx="6.5" cy="10" rx="4" ry="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="2.5" y1="4" x2="2.5" y2="10" stroke="currentColor" stroke-width="1.2"/><line x1="10.5" y1="4" x2="10.5" y2="10" stroke="currentColor" stroke-width="1.2"/></svg>Cyl</button>'+
      '<button class="insert-btn" data-prim="plane">Plane</button>'+
      '<button class="insert-btn" data-prim="cone">Cone</button>'+
      '<button class="insert-btn" data-prim="torus">Torus</button>'+
    '</div>'+
    '<div class="insert-divider"></div>'+
    '<div class="insert-group">'+
      '<button class="insert-btn" data-light="point"><svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="6" r="2.5" stroke="#ccaa44" stroke-width="1.2" fill="none"/></svg>Point</button>'+
      '<button class="insert-btn" data-light="spot">Spot</button>'+
      '<button class="insert-btn" data-light="dir">Dir</button>'+
    '</div>'+
    '<div class="insert-divider"></div>'+
    '<div class="insert-group" id="transform-tools-group">'+
      '<button class="insert-btn transform-tool active" data-transform="translate">Move</button>'+
      '<button class="insert-btn transform-tool" data-transform="rotate">Rotate</button>'+
      '<button class="insert-btn transform-tool" data-transform="scale">Scale</button>'+
    '</div>'+
    '<div class="insert-divider"></div>'+
    '<div class="insert-group">'+
      '<button class="insert-btn danger-btn" id="btn-del">Delete</button>'+
      '<button class="insert-btn" id="btn-dup">Dup</button>'+
      '<button class="insert-btn" id="btn-focus">Focus</button>'+
      '<button class="insert-btn" id="btn-save-toolbar">Save</button>'+
    '</div>'+
    '<div class="insert-divider"></div>'+
    '<button class="insert-btn gyro-btn" id="btn-gyro">Gyro</button>'+
    '<div style="margin-left:auto;flex-shrink:0;display:flex;gap:4px;">'+
      '<button id="btn-model-builder" class="insert-btn" style="background:rgba(68,204,136,0.1);border-color:rgba(68,204,136,0.3);color:#44cc88;padding:0 8px;height:28px;font-size:10px;font-weight:700;">⬡ Build</button>'+
      '<button id="btn-ai-helper" class="insert-btn" style="background:rgba(0,84,112,0.3);border-color:rgba(0,164,220,0.3);color:#00a4dc;padding:0 10px;height:28px;font-size:10px;font-weight:700;">✦ AI</button>'+
    '</div>';

  menubar.parentNode.insertBefore(bar,menubar.nextSibling);

  bar.querySelectorAll('.insert-btn[data-prim]').forEach(btn=>btn.addEventListener('click',()=>{AudioSystem.click();SceneView.addPrimitive(btn.dataset.prim);}));
  bar.querySelectorAll('.insert-btn[data-light]').forEach(btn=>btn.addEventListener('click',()=>{AudioSystem.click();SceneView.addLight(btn.dataset.light);}));
  bar.querySelectorAll('.transform-tool').forEach(btn=>btn.addEventListener('click',()=>{AudioSystem.click();bar.querySelectorAll('.transform-tool').forEach(b=>b.classList.remove('active'));btn.classList.add('active');SceneView.setTransformMode(btn.dataset.transform);toast('Mode: '+btn.dataset.transform,'log',1000);}));
  document.getElementById('btn-del')?.addEventListener('click',()=>{AudioSystem.error();SceneView.deleteSelected();});
  document.getElementById('btn-dup')?.addEventListener('click',()=>{AudioSystem.click();SceneView.duplicateSelected();});
  document.getElementById('btn-focus')?.addEventListener('click',()=>{AudioSystem.click();SceneView.focusSelected();});
  document.getElementById('btn-save-toolbar')?.addEventListener('click',()=>{AudioSystem.click();SceneData.save();});
  document.getElementById('btn-gyro')?.addEventListener('click',()=>{AudioSystem.click();SceneView.toggleGyro();document.getElementById('btn-gyro').classList.toggle('active');});
  document.getElementById('btn-ai-helper')?.addEventListener('click',()=>AIHelper.toggle());
  document.getElementById('btn-model-builder')?.addEventListener('click',()=>{
    AudioSystem.click();
    document.querySelector('.center-tab[data-tab="blueprint"]')?.click();
  });
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
  hide(){this.el?.classList.add('hidden');}
};

document.addEventListener('click',()=>ContextMenu.hide());
document.addEventListener('contextmenu',e=>{if(!e.target.closest('#panel-hierarchy')&&!e.target.closest('#scene-canvas'))ContextMenu.hide();});
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

function closeAllMenus(){
  Object.values(MenuDefs).forEach(m=>m?.classList.add('hidden'));
  document.querySelectorAll('.menu-item.open').forEach(m=>m.classList.remove('open'));
  document.getElementById('dropdown-overlay')?.classList.add('hidden');
  openMenuEl=null;
}

document.getElementById('dropdown-overlay')?.addEventListener('click',closeAllMenus);
document.querySelectorAll('.dd-item[data-action]').forEach(item=>{
  item.addEventListener('click',e=>{e.stopPropagation();AudioSystem.click();closeAllMenus();handleAction(item.dataset.action);});
});

function handleAction(a){
  const map={
    'new-scene':()=>{if(confirm('New scene? Unsaved changes lost.')){SceneData.entities.forEach(e=>{if(e.mesh)SceneView.scene.remove(e.mesh);});SceneData.entities=[];SceneData.selected=null;SceneData.nextId=1;SceneView._buildDefaultScene();toast('New scene','success');}},
    'save-scene':()=>SceneData.save(),
    'open-scene':()=>SceneData.load(),
    'build-settings':openBuildModal,'export':openBuildModal,
    'build-web':()=>openBuildModal('web'),'build-android':()=>openBuildModal('android'),'build-desktop':()=>openBuildModal('desktop'),
    'build-run':()=>{openBuildModal();setTimeout(()=>document.getElementById('btn-start-build')?.click(),400);},
    'undo':()=>toast('Undo — coming soon','warn'),'redo':()=>toast('Redo — coming soon','warn'),
    'create-empty':()=>{SceneData.add('Empty','empty',null);HierarchyPanel.refresh();toast('Empty created','success');},
    'docs':()=>window.open('https://github.com','_blank'),
    'about':()=>toast('CEngine v0.6 — Three.js + Model Builder + AI','log',4000),
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
    if(tab.dataset.tab==='blueprint') ModelBuilder.onTabOpen();
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
   PLAY CONTROLS
══════════════════════════════════════ */
let playing=false, fpsInterval=null, frameCount=0, lastTime=0;

document.getElementById('btn-play')?.addEventListener('click',()=>{
  playing=true; SceneView.playing=true; window._playingNow=true;
  document.getElementById('btn-play').disabled=true;
  document.getElementById('btn-pause').disabled=false;
  document.getElementById('btn-stop').disabled=false;
  document.getElementById('btn-play').classList.add('playing');

  Input.init();
  if(window.CVfx) window.CVfx.init(SceneView.scene);
  if(window.CAnimator){window.CAnimator.setEntities(SceneData.entities);window.CAnimator.loadClips();}

  if(window.CHealth){
    window.CHealth.register('player',100);
    window.CHealth.setCallbacks('player',
      dmg=>{Console.log('Player took '+dmg+' damage','warn','Health.js');if(window.CPlayHUD)window.CPlayHUD.setHP(window.CHealth.get('player')?.hp||0,100);},
      ()=>{Console.log('Player died','error','Health.js');}
    );
  }

  SceneData.entities.forEach(entity=>{
    if(entity.type==='mesh'&&entity.name!=='Floor'){
      entity._phys={vy:0,grounded:false,floor:0.01,type:'dynamic'};
    }
  });

  if(window.CEnemyAI){
    SceneData.entities.forEach(entity=>{
      if(entity.name.toLowerCase().includes('enemy')||entity.tag==='enemy'){
        window.CEnemyAI.register(entity,{speed:2.5,health:100,damage:10});
      }
    });
  }

  PlayerRig.spawn(SceneView.scene,SceneView.camera,{x:0,y:2,z:4});
  if(window.CPlayHUD) window.CPlayHUD.show();
  window._gameEntities=SceneData.entities;
  ScriptRuntime.init(SceneData.entities,SceneView.scene);

  AudioSystem.success();
  Console.log('Play mode — WASD move, Space jump, F shoot, RMB drag camera','log','Engine.js');
  toast('Playing — RMB drag to look around','success',3000);

  fpsInterval=setInterval(()=>{document.getElementById('fps-counter').textContent=frameCount+' FPS';frameCount=0;},1000);
  lastTime=performance.now();

  function gameLoop(){
    if(!playing) return;
    requestAnimationFrame(gameLoop);
    frameCount++;
    const now=performance.now(), dt=Math.min((now-lastTime)/1000,0.05); lastTime=now;
    Input.tick();
    SceneData.entities.forEach(entity=>{
      if(!entity._phys||!entity.mesh) return;
      entity._phys.vy+=(-12)*dt;
      entity.mesh.position.y+=entity._phys.vy*dt;
      entity.position.y=entity.mesh.position.y;
      if(entity.mesh.position.y<=0.5){entity.mesh.position.y=0.5;entity.position.y=0.5;entity._phys.vy=0;entity._phys.grounded=true;}
      else entity._phys.grounded=false;
    });
    if(window.CCollision) window.CCollision.update(SceneData.entities);
    if(window.CProjectiles) window.CProjectiles.update(dt,SceneView.scene,SceneData.entities);
    if(window.CVfx) window.CVfx.update(dt);
    if(window.CEnemyAI){window.CEnemyAI.update(dt,SceneData.entities);window.CEnemyAI.animateAgents(dt);}
    if(window.CAnimator) window.CAnimator.update(dt);
    PlayerRig.update(dt);
    ScriptRuntime.update(dt);
  }
  gameLoop();
});

document.getElementById('btn-pause')?.addEventListener('click',()=>{
  playing=!playing; SceneView.playing=playing;
  AudioSystem.warn(); toast(playing?'Resumed':'Paused');
  if(playing){
    lastTime=performance.now();
    function resumeLoop(){
      if(!playing) return;
      requestAnimationFrame(resumeLoop);
      frameCount++;
      const now=performance.now(),dt=Math.min((now-lastTime)/1000,0.05);lastTime=now;
      Input.tick();
      if(window.CVfx)window.CVfx.update(dt);
      if(window.CEnemyAI){window.CEnemyAI.update(dt,SceneData.entities);window.CEnemyAI.animateAgents(dt);}
      if(window.CAnimator)window.CAnimator.update(dt);
      PlayerRig.update(dt);
      ScriptRuntime.update(dt);
    }
    resumeLoop();
  }
});

document.getElementById('btn-stop')?.addEventListener('click',()=>{
  playing=false; SceneView.playing=false; window._playingNow=false; window._gameEntities=null;
  PlayerRig.despawn(); ScriptRuntime.stop(); Input.clear();
  if(window.CHealth)      window.CHealth.clear();
  if(window.CProjectiles) window.CProjectiles.clear(SceneView.scene);
  if(window.CVfx)         window.CVfx.clear();
  if(window.CEnemyAI)     window.CEnemyAI.clear();
  if(window.CAnimator)    window.CAnimator.stopAll();
  if(window.CPlayHUD)     window.CPlayHUD.remove();
  SceneData.entities.forEach(e=>{delete e._phys;if(e.mesh)e.mesh.position.set(e.position.x,e.position.y,e.position.z);});
  document.getElementById('btn-play').disabled=false;
  document.getElementById('btn-pause').disabled=true;
  document.getElementById('btn-stop').disabled=true;
  document.getElementById('btn-play').classList.remove('playing');
  document.getElementById('fps-counter').textContent='-- FPS';
  clearInterval(fpsInterval);
  SceneView.theta=0.5;SceneView.phi=1.0;SceneView.radius=12;
  SceneView.orbitTarget.set(0,0,0);SceneView._syncCamera();
  AudioSystem.error(); Console.log('Stopped','log','Engine.js'); toast('Stopped');
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
function openBuildModal(platform='web'){
  AudioSystem.click();
  document.getElementById('build-modal')?.classList.remove('hidden');
  document.getElementById('modal-overlay')?.classList.remove('hidden');
  document.querySelectorAll('.build-platform').forEach(p=>p.classList.remove('active'));
  document.querySelector('.build-platform[data-platform="'+platform+'"]')?.classList.add('active');
}
function closeBuildModal(){
  AudioSystem.click();
  document.getElementById('build-modal')?.classList.add('hidden');
  document.getElementById('modal-overlay')?.classList.add('hidden');
}

document.getElementById('btn-build-quick')?.addEventListener('click',()=>openBuildModal());
document.getElementById('btn-close-build')?.addEventListener('click',closeBuildModal);
document.getElementById('btn-close-build-2')?.addEventListener('click',closeBuildModal);
document.getElementById('modal-overlay')?.addEventListener('click',closeBuildModal);
document.querySelectorAll('.build-platform').forEach(p=>{p.addEventListener('click',()=>{AudioSystem.click();document.querySelectorAll('.build-platform').forEach(b=>b.classList.remove('active'));p.classList.add('active');});});

document.getElementById('btn-start-build')?.addEventListener('click',()=>{
  const name=document.getElementById('build-game-name')?.value||'My Game';
  const log=document.getElementById('build-log');
  if(!log) return;
  log.innerHTML='';
  const steps=[{msg:'Compiling scene...',delay:0},{msg:'Bundling scripts...',delay:500},{msg:'Packaging assets...',delay:1000},{msg:'Generating HTML5...',delay:1500},{msg:'✓ Build complete: '+name,delay:2100,ok:true}];
  steps.forEach(({msg,delay,ok})=>{
    setTimeout(()=>{
      const line=document.createElement('div');
      line.className='build-log-line'+(ok?' success':'');
      line.textContent=msg;
      log.appendChild(line);log.scrollTop=log.scrollHeight;
      if(ok){AudioSystem.success();toast('Build complete: '+name,'success');setTimeout(()=>{closeBuildModal();launchBuild(name);},500);}
    },delay);
  });
});
document.getElementById('btn-build-and-run')?.addEventListener('click',()=>document.getElementById('btn-start-build')?.click());

function launchBuild(name='My Game'){
  const entities=SceneData.entities.filter(e=>e.mesh).map(e=>({
    name:e.name,geo:e.mesh.geometry?.type||'BoxGeometry',
    color:'#'+(e.mesh.material?.color?.getHexString()||'4488cc'),
    px:e.mesh.position.x,py:e.mesh.position.y,pz:e.mesh.position.z,
    rx:e.mesh.rotation.x,ry:e.mesh.rotation.y,rz:e.mesh.rotation.z,
    sx:e.mesh.scale.x,sy:e.mesh.scale.y,sz:e.mesh.scale.z,
    parts:e._parts||null
  }));

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
#hud{position:fixed;top:10px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.6);font-size:12px;pointer-events:none;background:rgba(0,0,0,0.4);padding:3px 12px;border-radius:12px}
#hp-wrap{position:fixed;bottom:60px;left:16px;display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.5);padding:5px 10px;border-radius:16px}
#hp-bar-wrap{width:80px;height:5px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden}
#hp-bar{height:100%;width:100%;background:#27ae60;transition:width 0.2s}
#hp-val{font-size:11px;font-weight:700;color:#fff;min-width:22px;text-align:right}
#crosshair{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none}
#joy-overlay{position:fixed;bottom:0;left:0;right:0;height:200px;z-index:100;pointer-events:none}
#joy-zone{position:absolute;left:0;bottom:0;width:50%;height:100%;pointer-events:auto}
#joy-base{position:absolute;width:110px;height:110px;border-radius:50%;background:rgba(255,255,255,0.04);border:2px solid rgba(255,255,255,0.12);display:none;pointer-events:none}
#joy-stick{position:absolute;top:50%;left:50%;width:42px;height:42px;border-radius:50%;background:rgba(0,164,220,0.55);border:2px solid #00a4dc;transform:translate(-50%,-50%)}
#shoot-btn{position:fixed;bottom:130px;right:20px;width:64px;height:64px;border-radius:50%;background:rgba(192,57,43,0.2);border:2px solid rgba(192,57,43,0.5);color:#c0392b;font-size:9px;font-weight:700;cursor:pointer;pointer-events:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
#jump-btn{position:fixed;bottom:60px;right:100px;width:58px;height:58px;border-radius:50%;background:rgba(39,174,96,0.2);border:2px solid rgba(39,174,96,0.4);color:#27ae60;font-size:9px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center}
</style></head><body>
<div id="loader">
  <div class="ll">C<span style="color:#888;font-weight:400;font-size:20px">Engine</span></div>
  <div class="ls">LOADING</div>
  <div class="lb"><div class="lf" id="lf"></div></div>
  <div class="lc">BUILT WITH CENGINE</div>
</div>
<canvas id="c"></canvas>
<div id="hud">${name}</div>
<div id="hp-wrap"><span style="font-size:8px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:0.1em">HP</span><div id="hp-bar-wrap"><div id="hp-bar"></div></div><span id="hp-val">100</span></div>
<div id="crosshair"><svg width="18" height="18" viewBox="0 0 18 18"><line x1="9" y1="0" x2="9" y2="18" stroke="rgba(255,255,255,0.6)" stroke-width="1"/><line x1="0" y1="9" x2="18" y2="9" stroke="rgba(255,255,255,0.6)" stroke-width="1"/><circle cx="9" cy="9" r="2" fill="rgba(255,255,255,0.4)"/></svg></div>
<div id="joy-overlay">
  <div id="joy-zone"><div id="joy-base"><div id="joy-stick"></div></div></div>
</div>
<button id="shoot-btn">FIRE</button>
<button id="jump-btn">JUMP</button>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
const lf=document.getElementById('lf');let p=0;
const li=setInterval(()=>{p=Math.min(100,p+Math.random()*15+5);lf.style.width=p+'%';
if(p>=100){clearInterval(li);setTimeout(()=>{const lo=document.getElementById('loader');lo.style.opacity='0';setTimeout(()=>lo.remove(),500);},200);}},80);

const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('c'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x111111);scene.fog=new THREE.FogExp2(0x111111,0.016);
const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.1,1000);
scene.add(new THREE.AmbientLight(0x303040,1.8));
const dl=new THREE.DirectionalLight(0xfff0e0,2.2);dl.position.set(8,14,6);dl.castShadow=true;scene.add(dl);
scene.add(new THREE.GridHelper(40,40,0x1e1e1e,0x181818));
const gm={BoxGeometry:()=>new THREE.BoxGeometry(1,1,1),SphereGeometry:()=>new THREE.SphereGeometry(0.5,24,24),CylinderGeometry:()=>new THREE.CylinderGeometry(0.5,0.5,1,24),PlaneGeometry:()=>new THREE.PlaneGeometry(2,2),ConeGeometry:()=>new THREE.ConeGeometry(0.5,1,24),TorusGeometry:()=>new THREE.TorusGeometry(0.5,0.18,16,48),RingGeometry:()=>new THREE.RingGeometry(0.3,0.5,16)};
${JSON.stringify(entities)}.forEach(e=>{
  if(e.parts){
    // Custom model — rebuild from parts
    const group=new THREE.Group();
    e.parts.forEach(pt=>{
      const pgeo=(gm[pt.type+'Geometry']||gm['BoxGeometry'])();
      if(!pgeo) return;
      const pmat=new THREE.MeshStandardMaterial({color:pt.color,roughness:pt.roughness||0.4,metalness:pt.metalness||0.1});
      const pmesh=new THREE.Mesh(pgeo,pmat);
      pmesh.position.set(pt.position.x,pt.position.y,pt.position.z);
      pmesh.rotation.set(pt.rotation.x,pt.rotation.y,pt.rotation.z);
      pmesh.scale.set(pt.scale.x,pt.scale.y,pt.scale.z);
      pmesh.castShadow=true;pmesh.receiveShadow=true;
      group.add(pmesh);
    });
    group.position.set(e.px,e.py,e.pz);group.rotation.set(e.rx,e.ry,e.rz);group.scale.set(e.sx,e.sy,e.sz);
    scene.add(group);
  }else{
    const geo=(gm[e.geo]||gm.BoxGeometry)();
    const mat=new THREE.MeshStandardMaterial({color:e.color,roughness:0.5,metalness:0.1});
    const mesh=new THREE.Mesh(geo,mat);
    mesh.position.set(e.px,e.py,e.pz);mesh.rotation.set(e.rx,e.ry,e.rz);mesh.scale.set(e.sx,e.sy,e.sz);
    mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  }
});

// Player rig
const rig=new THREE.Group();
const bm=new THREE.MeshStandardMaterial({color:0x4488ff,roughness:0.5});
const hm=new THREE.MeshStandardMaterial({color:0xffcc99,roughness:0.8});
const pm=new THREE.MeshStandardMaterial({color:0x334466,roughness:0.7});
const torso=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.7,0.28),bm);torso.position.y=1.0;rig.add(torso);
const head=new THREE.Mesh(new THREE.BoxGeometry(0.38,0.38,0.38),hm);head.position.y=1.58;rig.add(head);
const lUA=new THREE.Mesh(new THREE.BoxGeometry(0.19,0.33,0.19),bm);lUA.position.set(-0.4,1.08,0);rig.add(lUA);
const rUA=new THREE.Mesh(new THREE.BoxGeometry(0.19,0.33,0.19),bm);rUA.position.set(0.4,1.08,0);rig.add(rUA);
const lUL=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.35,0.22),pm);lUL.position.set(-0.16,0.55,0);rig.add(lUL);
const rUL=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.35,0.22),pm);rUL.position.set(0.16,0.55,0);rig.add(rUL);
const lLL=new THREE.Mesh(new THREE.BoxGeometry(0.20,0.32,0.20),pm);lLL.position.set(-0.16,0.22,0);rig.add(lLL);
const rLL=new THREE.Mesh(new THREE.BoxGeometry(0.20,0.32,0.20),pm);rLL.position.set(0.16,0.22,0);rig.add(rLL);
rig.position.set(0,1,4);scene.add(rig);
[torso,head,lUA,rUA,lUL,rUL,lLL,rLL].forEach(m=>m.castShadow=true);

const keys={};
window.addEventListener('keydown',e=>keys[e.code]=true);
window.addEventListener('keyup',  e=>keys[e.code]=false);
function held(k){return !!(keys[k]||keys['Key'+k.toUpperCase()]||keys[k.toLowerCase()]);}

let camYaw=Math.PI,camPitch=0.3,camDist=6,camLook=false;
let hp=100;
const camTarget=new THREE.Vector3();

document.addEventListener('mousedown',e=>{if(e.button===2){camLook=true;document.body.requestPointerLock?.();}});
document.addEventListener('mouseup',  e=>{if(e.button===2){camLook=false;document.exitPointerLock?.();}});
document.addEventListener('mousemove',e=>{if(camLook||document.pointerLockElement){camYaw-=(e.movementX||0)*0.003;camPitch-=(e.movementY||0)*0.003;camPitch=Math.max(-0.4,Math.min(1.1,camPitch));}});
document.addEventListener('wheel',e=>{camDist=Math.max(2,Math.min(14,camDist+e.deltaY*0.01));});
document.addEventListener('contextmenu',e=>e.preventDefault());

let joyX=0,joyY=0,joyActive=false,joyId=null,joyBx=0,joyBy=0;
const joyBase=document.getElementById('joy-base'),joyStick=document.getElementById('joy-stick'),jz=document.getElementById('joy-zone');
jz.addEventListener('touchstart',e=>{e.preventDefault();if(joyActive)return;const t=e.changedTouches[0];joyId=t.identifier;joyActive=true;joyBx=t.clientX;joyBy=t.clientY;joyBase.style.display='block';joyBase.style.left=(t.clientX-55)+'px';joyBase.style.top=(t.clientY-55-jz.getBoundingClientRect().top)+'px';},{passive:false});
document.addEventListener('touchmove',e=>{Array.from(e.changedTouches).forEach(t=>{if(t.identifier!==joyId)return;const dx=t.clientX-joyBx,dy=t.clientY-joyBy;const d=Math.sqrt(dx*dx+dy*dy),max=50;const nx=d>max?dx/d*max:dx,ny=d>max?dy/d*max:dy;joyX=nx/max;joyY=ny/max;joyStick.style.transform='translate(calc(-50% + '+nx+'px),calc(-50% + '+ny+'px))';});});
document.addEventListener('touchend',e=>{Array.from(e.changedTouches).forEach(t=>{if(t.identifier===joyId){joyActive=false;joyId=null;joyX=0;joyY=0;joyBase.style.display='none';joyStick.style.transform='translate(-50%,-50%)';}});});

let jumpPressed=false;
document.getElementById('jump-btn').addEventListener('touchstart',e=>{e.preventDefault();jumpPressed=true;},{passive:false});
document.getElementById('jump-btn').addEventListener('touchend',()=>jumpPressed=false);
document.getElementById('jump-btn').addEventListener('click',()=>{jumpPressed=true;setTimeout(()=>jumpPressed=false,100);});

const projectiles=[];
function shoot(){
  const origin=new THREE.Vector3(rig.position.x-Math.sin(camYaw)*0.3,rig.position.y+1.5,rig.position.z-Math.cos(camYaw)*0.3);
  const dir=new THREE.Vector3(-Math.sin(camYaw),-0.05,-Math.cos(camYaw)).normalize();
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(0.06,6,6),new THREE.MeshBasicMaterial({color:0xffff44}));
  mesh.position.copy(origin);scene.add(mesh);
  projectiles.push({mesh,vel:dir.multiplyScalar(25),life:3,age:0});
}
document.getElementById('shoot-btn').addEventListener('click',shoot);
window.addEventListener('keydown',e=>{if(e.code==='KeyF')shoot();});

let vy=0,grounded=false,wc=0;
const SPEED=6,JUMP=8;
let lastT=performance.now();

function animate(){
  requestAnimationFrame(animate);
  const now=performance.now(),dt=Math.min((now-lastT)/1000,0.05);lastT=now;
  let mx=(held('d')||held('ArrowRight')?1:0)-(held('a')||held('ArrowLeft')?1:0);
  let mz=(held('w')||held('ArrowUp')?1:0)-(held('s')||held('ArrowDown')?1:0);
  if(Math.abs(joyX)>0.1)mx=joyX;
  if(Math.abs(joyY)>0.1)mz=-joyY;
  const moving=Math.abs(mx)>0.05||Math.abs(mz)>0.05;
  if(moving){
    const fwd=new THREE.Vector3(-Math.sin(camYaw),0,-Math.cos(camYaw));
    const right=new THREE.Vector3(Math.cos(camYaw),0,-Math.sin(camYaw));
    rig.position.addScaledVector(right,mx*SPEED*dt);
    rig.position.addScaledVector(fwd,mz*SPEED*dt);
    const ma=Math.atan2(mx,-mz)+camYaw;
    rig.rotation.y=THREE.MathUtils.lerp(rig.rotation.y,ma,0.18);
    wc+=dt*9;
    lUA.rotation.x=Math.sin(wc)*0.55;rUA.rotation.x=-Math.sin(wc)*0.55;
    lUL.rotation.x=-Math.sin(wc)*0.65;rUL.rotation.x=Math.sin(wc)*0.65;
    lLL.rotation.x=Math.max(0,Math.sin(wc)*0.5);rLL.rotation.x=Math.max(0,-Math.sin(wc)*0.5);
  }else{wc=0;[lUA,rUA,lUL,rUL,lLL,rLL].forEach(m=>m.rotation.x*=0.8);}
  vy+=(-16)*dt;rig.position.y+=vy*dt;
  if(rig.position.y<=1.0){rig.position.y=1.0;vy=0;grounded=true;}else grounded=false;
  if((keys['Space']||jumpPressed)&&grounded){vy=JUMP;grounded=false;}
  for(let i=projectiles.length-1;i>=0;i--){const pr=projectiles[i];pr.age+=dt;pr.mesh.position.addScaledVector(pr.vel,dt);if(pr.age>pr.life||pr.mesh.position.y<0){scene.remove(pr.mesh);projectiles.splice(i,1);}}
  camTarget.set(rig.position.x,rig.position.y+1.4,rig.position.z);
  const cx=camTarget.x+camDist*Math.sin(camYaw)*Math.cos(camPitch);
  const cy=camTarget.y+camDist*Math.sin(camPitch);
  const cz=camTarget.z+camDist*Math.cos(camYaw)*Math.cos(camPitch);
  camera.position.lerp(new THREE.Vector3(cx,cy,cz),0.15);
  camera.lookAt(camTarget);
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
function makeResizable(handleId,targetId,dir,min,invert=false){
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

function initMonaco(){
  if(monacoReady) return; monacoReady=true;
  document.getElementById('monaco-placeholder')?.remove();
  const container=document.getElementById('monaco-container');
  if(!container) return;
  if(!window.require){
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
      language:'javascript',theme:'vs-dark',fontSize:13,
      fontFamily:'"JetBrains Mono",monospace',fontLigatures:true,
      minimap:{enabled:true},automaticLayout:true,
      scrollBeyondLastLine:false,wordWrap:'on',cursorBlinking:'smooth',
      bracketPairColorization:{enabled:true}
    });
    window.monacoEditor.onDidChangeModelContent(()=>{
      if(CodeEditor.activeFile)CodeEditor.files[CodeEditor.activeFile]=window.monacoEditor.getValue();
    });
    document.getElementById('code-lang-select')?.addEventListener('change',function(){
      const map={javascript:'javascript',cscript:'javascript',python:'python',lua:'lua',glsl:'glsl',css:'css'};
      monaco.editor.setModelLanguage(window.monacoEditor.getModel(),map[this.value]||'javascript');
    });
    Console.log('Monaco Editor ready','log','CodeEditor.js');
  });
}

document.getElementById('btn-new-script')?.addEventListener('click', ()=>{AudioSystem.click();CodeEditor.newFile();});
document.getElementById('btn-save-script')?.addEventListener('click',()=>{AudioSystem.click();CodeEditor.save();});
document.getElementById('btn-run-script')?.addEventListener('click', ()=>{AudioSystem.success();CodeEditor.run();});
document.querySelectorAll('.file-item').forEach(file=>{
  file.addEventListener('click',()=>{
    AudioSystem.click();
    document.querySelectorAll('.file-item').forEach(x=>x.classList.remove('selected'));
    file.classList.add('selected');
    if(file.dataset.type==='script') CodeEditor.open(file.dataset.name);
  });
});

/* ══════════════════════════════════════
   CONSOLE WIRING
══════════════════════════════════════ */
document.getElementById('btn-clear-console')?.addEventListener('click',()=>{AudioSystem.click();Console.clear();});
document.getElementById('btn-console-run')?.addEventListener('click',()=>{
  const inp=document.getElementById('console-input');
  if(!inp) return;
  AudioSystem.tone(660,0.07,0.03); Console.exec(inp.value); inp.value='';
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
   MISC UI
══════════════════════════════════════ */
document.querySelectorAll('.proj-folder').forEach(f=>{f.addEventListener('click',()=>{AudioSystem.click();document.querySelectorAll('.proj-folder').forEach(x=>x.classList.remove('active'));f.classList.add('active');});});
document.getElementById('toggle-grid')?.addEventListener('change',function(){SceneView.toggleGrid(this.checked);});
document.getElementById('render-mode')?.addEventListener('change',function(){AudioSystem.click();SceneView.toggleWireframe(this.value==='Wireframe');});
document.getElementById('btn-audio-toggle')?.addEventListener('click',()=>AudioSystem.toggle());
document.querySelectorAll('.inspector-icon-btn').forEach(btn=>{btn.addEventListener('click',()=>{AudioSystem.click();document.querySelectorAll('.inspector-icon-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');});});

/* ══════════════════════════════════════
   PUBLIC API
══════════════════════════════════════ */
window.CEngineAPI={
  add:type=>SceneView.addPrimitive(type),
  delete:()=>SceneView.deleteSelected(),
  focus:()=>SceneView.focusSelected(),
  select:name=>{const e=SceneData.entities.find(x=>x.name===name);if(e)SceneData.select(e.id);},
  list:()=>SceneData.entities.map(e=>e.name),
  log:msg=>Console.log(String(msg),'log','Script'),
  mode:mode=>SceneView.setTransformMode(mode),
  save:()=>SceneData.save(),
  load:()=>SceneData.load(),
  ai:()=>AIHelper.toggle(),
  build:()=>document.querySelector('.center-tab[data-tab="blueprint"]')?.click()
};

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
AudioSystem.init();
CodeEditor.init();
ModelBuilder.init();
buildInsertToolbar();
SceneView.init();
Inspector.clear();
AIHelper.init();

setInterval(()=>{const e=SceneData.getById(SceneData.selected);window._selMesh=e?.mesh||null;},100);

setTimeout(()=>Console.log('CEngine v0.6 ready','log','Engine.js'),100);
setTimeout(()=>Console.log('Renderer: Three.js r128','log','Renderer3D.js'),200);
setTimeout(()=>Console.log('Model Builder ready — click Blueprint tab or ⬡ Build button','log','ModelBuilder.js'),300);
setTimeout(()=>Console.log('AI Helper ready — click ✦ AI in toolbar','log','AIHelper.js'),400);
setTimeout(()=>Console.log('Tip: Play → Roblox/Fortnite camera, WASD move, RMB drag to look, F to shoot','log','Editor.js'),800);
setTimeout(()=>toast('CEngine v0.6 — Ready','success',3000),600);

})();
