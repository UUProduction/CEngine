/* ═══════════════════════════════════════════
   CENGINE MOBILE EDITOR v0.4
   Roblox Studio layout — fully wired
   ═══════════════════════════════════════════ */
(function () {
'use strict';

/* ══ DESKTOP REDIRECT ══ */
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
if (!isMobile && !localStorage.getItem('cengine-force-mobile')) {
  window.location.href = 'index.html'; return;
}

/* ══ AUDIO ══ */
const Audio = {
  ctx: null, enabled: false, muted: false,
  init() {
    document.addEventListener('touchstart', () => {
      if (this.enabled) return;
      this.enabled = true;
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
    }, { once: true });
  },
  tone(f,d,v,t) {
    if (!this.ctx||this.muted) return;
    f=f||660;d=d||0.07;v=v||0.02;t=t||'sine';
    try {
      const o=this.ctx.createOscillator(),g=this.ctx.createGain();
      o.type=t;o.frequency.value=f;
      g.gain.setValueAtTime(v,this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+d);
      o.connect(g);g.connect(this.ctx.destination);
      o.start();o.stop(this.ctx.currentTime+d);
    }catch(e){}
  },
  tap()     { this.tone(700,0.05,0.018); },
  success() { this.tone(880,0.08,0.028); setTimeout(()=>this.tone(1100,0.07,0.022),90); },
  error()   { this.tone(180,0.14,0.025,'sawtooth'); },
  warn()    { this.tone(440,0.09,0.022); }
};

/* ══ TOAST ══ */
function toast(msg, type, dur) {
  type=type||'log'; dur=dur||2000;
  const c=document.getElementById('m-toasts');
  if (!c) return;
  const el=document.createElement('div');
  el.className='m-toast '+(type||'log');
  el.textContent=msg;
  c.appendChild(el);
  if (type==='success') Audio.success();
  else if (type==='error') Audio.error();
  else if (type==='warn') Audio.warn();
  else Audio.tap();
  setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(),250); }, dur);
}

/* ══ CONSOLE ══ */
const Con = {
  out: null,
  history: [], histIdx: -1,
  init() { this.out = document.getElementById('m-console-out'); },
  log(msg, type, src) {
    if (!this.out) return;
    type=type||'log'; src=src||'Editor';
    const t=(performance.now()/1000).toFixed(3);
    const div=document.createElement('div');
    div.className='m-log '+type;
    div.innerHTML='<span class="m-log-time">'+t+'</span><span class="m-log-msg">'+String(msg)+'</span>';
    this.out.appendChild(div);
    this.out.scrollTop=this.out.scrollHeight;
  },
  clear() { if(this.out) this.out.innerHTML=''; this.log('Cleared','log','Console'); },
  exec(cmd) {
    if (!cmd.trim()) return;
    this.history.unshift(cmd);
    this.histIdx=-1;
    this.log('> '+cmd,'log','Console');
    try {
      const r=Function('"use strict";return('+cmd+')')();
      if(r!==undefined) this.log(JSON.stringify(r),'log','Console');
    }catch(e){this.log(e.message,'error','Console');}
  }
};

/* ══ SCENE DATA ══ */
const SceneData = {
  entities:[], selected:null, nextId:1,
  add(name,type,mesh){
    const e={id:this.nextId++,name:name,type:type||'mesh',active:true,mesh:mesh||null,
      position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1}};
    this.entities.push(e); return e;
  },
  getById(id){return this.entities.find(e=>e.id===id)||null;},
  remove(id){
    const e=this.getById(id);
    if(e&&e.mesh){SV.scene.remove(e.mesh);e.mesh.geometry&&e.mesh.geometry.dispose();e.mesh.material&&e.mesh.material.dispose();}
    this.entities=this.entities.filter(x=>x.id!==id);
    if(this.selected===id){this.selected=null;Inspector.clear();document.getElementById('m-selection-bar').classList.add('hidden');}
  },
  select(id){
    this.selected=id;
    const e=this.getById(id);
    if(e){Inspector.update(e);SV.showGizmo(e);Hierarchy.selectItem(id);document.getElementById('m-sel-name').textContent=e.name;document.getElementById('m-selection-bar').classList.remove('hidden');}
  }
};

/* ══ SAVE/LOAD ══ */
const Save={
  KEY:'cengine_scene_v1',
  save(){
    try{
      const data={name:(document.getElementById('m-scene-name')||{}).textContent||'Untitled',timestamp:Date.now(),
        entities:SceneData.entities.map(e=>({id:e.id,name:e.name,type:e.type,active:e.active,
          position:{...e.position},rotation:{...e.rotation},scale:{...e.scale},
          color:e.mesh&&e.mesh.material&&e.mesh.material.color?e.mesh.material.color.getHexString():'4488cc',
          geometry:e.mesh&&e.mesh.geometry?e.mesh.geometry.type:'BoxGeometry'}))};
      localStorage.setItem(this.KEY,JSON.stringify(data));
      toast('Scene saved','success'); Con.log('Saved','log','Scene');
    }catch(e){toast('Save failed','error');}
  },
  load(){
    try{
      const raw=localStorage.getItem(this.KEY);
      if(!raw){toast('No saved scene','warn');return;}
      const data=JSON.parse(raw);
      SceneData.entities.forEach(e=>{if(e.mesh)SV.scene.remove(e.mesh);});
      SceneData.entities=[];SceneData.selected=null;SceneData.nextId=1;
      const gm={BoxGeometry:()=>new THREE.BoxGeometry(1,1,1),SphereGeometry:()=>new THREE.SphereGeometry(0.5,20,20),CylinderGeometry:()=>new THREE.CylinderGeometry(0.5,0.5,1,20),PlaneGeometry:()=>new THREE.PlaneGeometry(2,2),ConeGeometry:()=>new THREE.ConeGeometry(0.5,1,20),TorusGeometry:()=>new THREE.TorusGeometry(0.5,0.18,14,36)};
      data.entities.forEach(ed=>{
        const mesh=new THREE.Mesh((gm[ed.geometry]||gm.BoxGeometry)(),new THREE.MeshStandardMaterial({color:'#'+ed.color,roughness:0.5,metalness:0.1}));
        mesh.position.set(ed.position.x,ed.position.y,ed.position.z);mesh.scale.set(ed.scale.x||1,ed.scale.y||1,ed.scale.z||1);
        mesh.castShadow=true;SV.scene.add(mesh);
        const entity=SceneData.add(ed.name,ed.type,mesh);entity.id=ed.id;entity.position={...ed.position};entity.scale={...ed.scale};
      });
      SceneData.nextId=Math.max.apply(null,SceneData.entities.map(e=>e.id).concat([0]))+1;
      Hierarchy.refresh();Inspector.clear();
      toast('Scene loaded','success');Con.log('Loaded','log','Scene');
    }catch(e){toast('Load failed','error');Con.log(e.message,'error','Scene');}
  }
};

/* ══ THREE.JS SCENE VIEW ══ */
const SV={
  renderer:null,scene:null,camera:null,
  gizmoRenderer:null,gizmoScene:null,gizmoCamera:null,
  gizmoGroup:null,raycaster:null,grid:null,
  theta:0.5,phi:1.0,radius:12,
  orbitTarget:null,
  t1x:0,t1y:0,t1sx:0,t1sy:0,
  lastPinch:0,
  touchingEntity:false,isDragging:false,
  DRAG_THRESH:5,
  transformMode:'translate',
  dragStartPos:null,dragStartRot:null,dragStartScl:null,
  gyroEnabled:false,
  playing:false,

  init(){
    const canvas=document.getElementById('m-scene-canvas');
    if(!canvas||typeof THREE==='undefined'){Con.log('THREE not loaded','error','SV');return;}
    this.raycaster=new THREE.Raycaster();
    this.orbitTarget=new THREE.Vector3(0,0,0);

    this.renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.1;

    this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color(0x111111);
    this.scene.fog=new THREE.FogExp2(0x111111,0.016);

    this.camera=new THREE.PerspectiveCamera(60,1,0.1,1000);
    this._syncCam();

    this.scene.add(new THREE.AmbientLight(0x303040,1.8));
    const dl=new THREE.DirectionalLight(0xfff0e0,2.2);
    dl.position.set(8,14,6);dl.castShadow=true;dl.shadow.mapSize.set(1024,1024);
    this.scene.add(dl);
    const fill=new THREE.PointLight(0x204060,1.2,30);fill.position.set(-8,4,-6);this.scene.add(fill);

    this.grid=new THREE.GridHelper(40,40,0x1e1e1e,0x181818);this.scene.add(this.grid);
    const gnd=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:0x0d0d0d,roughness:1}));
    gnd.rotation.x=-Math.PI/2;gnd.receiveShadow=true;this.scene.add(gnd);

    this._initGizmoViewport();
    this._initTransformGizmo();
    this._bindTouch(canvas);
    this._initGyro();

    window.addEventListener('resize',()=>this._resize());
    window.addEventListener('orientationchange',()=>setTimeout(()=>this._resize(),300));
    this._resize();
    this._defaultScene();
    this._loop();
    Con.log('SceneView ready','log','SV');
  },

  _defaultScene(){
    const floor=new THREE.Mesh(new THREE.BoxGeometry(8,0.2,8),new THREE.MeshStandardMaterial({color:0x2a2a2a,roughness:0.9}));
    floor.position.y=-0.1;floor.receiveShadow=true;this.scene.add(floor);
    SceneData.add('Floor','mesh',floor).position={x:0,y:-0.1,z:0};

    const cube=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x4488cc,roughness:0.4,metalness:0.2}));
    cube.position.y=0.5;cube.castShadow=true;this.scene.add(cube);
    SceneData.add('Cube','mesh',cube).position={x:0,y:0.5,z:0};
    Hierarchy.refresh();
  },

  _syncCam(){
    if(!this.camera||!this.orbitTarget)return;
    this.camera.position.set(
      this.orbitTarget.x+this.radius*Math.sin(this.phi)*Math.sin(this.theta),
      this.orbitTarget.y+this.radius*Math.cos(this.phi),
      this.orbitTarget.z+this.radius*Math.sin(this.phi)*Math.cos(this.theta)
    );
    this.camera.lookAt(this.orbitTarget);
  },

  _initGizmoViewport(){
    const gc=document.getElementById('m-gizmo-canvas');
    if(!gc)return;
    this.gizmoRenderer=new THREE.WebGLRenderer({canvas:gc,alpha:true,antialias:true});
    this.gizmoRenderer.setSize(50,50);
    this.gizmoScene=new THREE.Scene();
    this.gizmoCamera=new THREE.PerspectiveCamera(50,1,0.1,100);
    this.gizmoCamera.position.set(0,0,3);
    [{dir:new THREE.Vector3(1,0,0),color:0xcc3333},{dir:new THREE.Vector3(0,1,0),color:0x33aa33},{dir:new THREE.Vector3(0,0,1),color:0x3366cc}].forEach(a=>{
      const mat=new THREE.MeshBasicMaterial({color:a.color,depthTest:false});
      const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),a.dir);
      const body=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.7,8),mat);
      const tip=new THREE.Mesh(new THREE.ConeGeometry(0.13,0.3,8),mat);
      body.position.copy(a.dir.clone().multiplyScalar(0.35));body.quaternion.copy(q);
      tip.position.copy(a.dir.clone().multiplyScalar(0.85));tip.quaternion.copy(q);
      this.gizmoScene.add(body,tip);
    });
  },

  _initTransformGizmo(){
    this.gizmoGroup=new THREE.Group();
    this.gizmoGroup.visible=false;this.gizmoGroup.renderOrder=999;
    [{dir:new THREE.Vector3(1,0,0),color:0xdd2222},{dir:new THREE.Vector3(0,1,0),color:0x22aa22},{dir:new THREE.Vector3(0,0,1),color:0x2244dd}].forEach(a=>{
      const mat=new THREE.MeshBasicMaterial({color:a.color,depthTest:false});
      const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),a.dir);
      const body=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,1.0,8),mat.clone());
      const tip=new THREE.Mesh(new THREE.ConeGeometry(0.1,0.26,8),mat.clone());
      body.position.copy(a.dir.clone().multiplyScalar(0.5));body.quaternion.copy(q);
      tip.position.copy(a.dir.clone().multiplyScalar(1.13));tip.quaternion.copy(q);
      this.gizmoGroup.add(body,tip);
    });
    this.scene.add(this.gizmoGroup);
  },

  showGizmo(entity){
    if(!entity||!entity.mesh){this.gizmoGroup.visible=false;return;}
    this.gizmoGroup.visible=true;this.gizmoGroup.position.copy(entity.mesh.position);
  },

  _bindTouch(canvas){
    canvas.addEventListener('touchstart',e=>{
      e.preventDefault();
      const touches=e.touches;
      if(touches.length===1){
        this.t1sx=this.t1x=touches[0].clientX;
        this.t1sy=this.t1y=touches[0].clientY;
        this.isDragging=false;this.touchingEntity=false;
        const entity=SceneData.getById(SceneData.selected);
        if(entity&&entity.mesh){
          const hit=this._raycast(touches[0].clientX,touches[0].clientY,[entity.mesh]);
          if(hit){
            this.touchingEntity=true;
            this.dragStartPos=entity.mesh.position.clone();
            this.dragStartRot={x:entity.mesh.rotation.x,y:entity.mesh.rotation.y,z:entity.mesh.rotation.z};
            this.dragStartScl=entity.mesh.scale.clone();
          }
        }
      }
      if(touches.length===2){
        this.touchingEntity=false;
        const dx=touches[0].clientX-touches[1].clientX,dy=touches[0].clientY-touches[1].clientY;
        this.lastPinch=Math.sqrt(dx*dx+dy*dy);
      }
    },{passive:false});

    canvas.addEventListener('touchmove',e=>{
      e.preventDefault();
      const touches=e.touches;
      if(touches.length===1){
        const dx=touches[0].clientX-this.t1x,dy=touches[0].clientY-this.t1y;
        const tdx=touches[0].clientX-this.t1sx,tdy=touches[0].clientY-this.t1sy;
        const dist=Math.sqrt(tdx*tdx+tdy*tdy);
        if(this.touchingEntity&&dist>this.DRAG_THRESH){
          this.isDragging=true;
          const entity=SceneData.getById(SceneData.selected);
          if(entity&&entity.mesh)this._applyDrag(entity,tdx,tdy);
        }else if(!this.isDragging&&!this.touchingEntity){
          this.theta-=dx*0.007;
          this.phi=Math.max(0.05,Math.min(Math.PI-0.05,this.phi+dy*0.007));
          this._syncCam();
        }
        this.t1x=touches[0].clientX;this.t1y=touches[0].clientY;
      }
      if(touches.length===2){
        const dx=touches[0].clientX-touches[1].clientX,dy=touches[0].clientY-touches[1].clientY;
        const dist=Math.sqrt(dx*dx+dy*dy);
        this.radius=Math.max(1.5,Math.min(80,this.radius-(dist-this.lastPinch)*0.04));
        this.lastPinch=dist;this._syncCam();
      }
    },{passive:false});

    canvas.addEventListener('touchend',e=>{
      e.preventDefault();
      const was=this.isDragging;
      this.isDragging=false;this.touchingEntity=false;this.dragStartPos=null;
      if(!was&&e.changedTouches.length===1){
        const t=e.changedTouches[0];
        const dx=t.clientX-this.t1sx,dy=t.clientY-this.t1sy;
        if(Math.sqrt(dx*dx+dy*dy)<this.DRAG_THRESH)this._handleTap(t.clientX,t.clientY);
      }
    },{passive:false});
  },

  _handleTap(x,y){
    const meshes=SceneData.entities.filter(e=>e.mesh&&e.active).map(e=>e.mesh);
    const hit=this._raycast(x,y,meshes);
    if(hit){
      let obj=hit.object;
      while(obj.parent&&obj.parent!==this.scene){if(SceneData.entities.find(e=>e.mesh===obj))break;obj=obj.parent;}
      const entity=SceneData.entities.find(e=>e.mesh===obj);
      if(entity){SceneData.select(entity.id);Audio.tap();return;}
    }
    SceneData.selected=null;Inspector.clear();this.gizmoGroup.visible=false;
    Hierarchy.clearSelection();document.getElementById('m-selection-bar').classList.add('hidden');
  },

  _raycast(x,y,meshes){
    const canvas=document.getElementById('m-scene-canvas');
    if(!canvas)return null;
    const rect=canvas.getBoundingClientRect();
    const mx=((x-rect.left)/rect.width)*2-1;
    const my=-((y-rect.top)/rect.height)*2+1;
    this.raycaster.setFromCamera(new THREE.Vector2(mx,my),this.camera);
    const hits=this.raycaster.intersectObjects(meshes,true);
    return hits.length>0?hits[0]:null;
  },

  _applyDrag(entity,dx,dy){
    if(!this.dragStartPos)return;
    const sens=this.radius*0.0035;
    const cRight=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0).normalize();
    const cUp=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,1).normalize();
    if(this.transformMode==='translate'){
      entity.mesh.position.copy(this.dragStartPos);
      entity.mesh.position.addScaledVector(cRight,dx*sens);
      entity.mesh.position.addScaledVector(cUp,-dy*sens);
      entity.position={x:entity.mesh.position.x,y:entity.mesh.position.y,z:entity.mesh.position.z};
    }else if(this.transformMode==='rotate'){
      entity.mesh.rotation.y=this.dragStartRot.y+dx*0.012;
      entity.mesh.rotation.x=this.dragStartRot.x+dy*0.012;
      entity.rotation={x:THREE.MathUtils.radToDeg(entity.mesh.rotation.x),y:THREE.MathUtils.radToDeg(entity.mesh.rotation.y),z:THREE.MathUtils.radToDeg(entity.mesh.rotation.z)};
    }else if(this.transformMode==='scale'){
      const f=Math.max(0.01,1+dx*0.009);
      entity.mesh.scale.copy(this.dragStartScl).multiplyScalar(f);
      entity.scale={x:entity.mesh.scale.x,y:entity.mesh.scale.y,z:entity.mesh.scale.z};
    }
    this.gizmoGroup.position.copy(entity.mesh.position);
    Inspector.update(entity);
  },

  _initGyro(){
    const start=()=>{
      window.addEventListener('deviceorientation',e=>{
        if(!this.gyroEnabled)return;
        const beta=THREE.MathUtils.degToRad(e.beta||0);
        const alpha=THREE.MathUtils.degToRad(e.alpha||0);
        this.phi=THREE.MathUtils.lerp(this.phi,Math.max(0.1,Math.min(Math.PI-0.1,beta)),0.08);
        this.theta=THREE.MathUtils.lerp(this.theta,-alpha*0.5,0.04);
        this._syncCam();
      },true);
    };
    if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
      window._requestGyro=()=>DeviceOrientationEvent.requestPermission().then(s=>{if(s==='granted'){start();this.gyroEnabled=true;}}).catch(console.error);
    }else{start();}
  },

  toggleGyro(){
    if(window._requestGyro&&!this.gyroEnabled){window._requestGyro();toast('Gyro enabled','success');}
    else{this.gyroEnabled=!this.gyroEnabled;toast(this.gyroEnabled?'Gyro ON':'Gyro OFF');}
    document.getElementById('m-gyro-btn').classList.toggle('active',this.gyroEnabled);
  },

  addPrimitive(type){
    const geos={cube:()=>new THREE.BoxGeometry(1,1,1),sphere:()=>new THREE.SphereGeometry(0.5,20,20),cylinder:()=>new THREE.CylinderGeometry(0.5,0.5,1,20),plane:()=>new THREE.PlaneGeometry(2,2),cone:()=>new THREE.ConeGeometry(0.5,1,20),torus:()=>new THREE.TorusGeometry(0.5,0.18,14,36)};
    const colors={cube:0x4488cc,sphere:0xcc6633,cylinder:0x44aa66,plane:0x888888,cone:0xccaa22,torus:0xcc4488};
    const mesh=new THREE.Mesh((geos[type]||geos.cube)(),new THREE.MeshStandardMaterial({color:colors[type]||0x888888,roughness:0.5,metalness:0.1}));
    mesh.castShadow=true;mesh.receiveShadow=true;
    if(type==='plane'){mesh.rotation.x=-Math.PI/2;mesh.position.y=0.01;}
    else mesh.position.set((Math.random()-0.5)*3,0.5,(Math.random()-0.5)*3);
    this.scene.add(mesh);
    const name=type.charAt(0).toUpperCase()+type.slice(1);
    const entity=SceneData.add(name,'mesh',mesh);
    entity.position={x:mesh.position.x,y:mesh.position.y,z:mesh.position.z};
    Hierarchy.refresh();SceneData.select(entity.id);
    Audio.success();toast('Added '+name,'success');Con.log('Added: '+name,'log','Scene');
    return entity;
  },

  addLight(type){
    let light;
    const name=type==='point'?'Point Light':type==='spot'?'Spot Light':'Dir Light';
    if(type==='point'){light=new THREE.PointLight(0xffffff,1.5,20);light.position.set(2,4,2);}
    else if(type==='spot'){light=new THREE.SpotLight(0xffffff,2,30,Math.PI/5);light.position.set(0,7,0);}
    else{light=new THREE.DirectionalLight(0xffffff,1.5);light.position.set(4,7,4);}
    this.scene.add(light);SceneData.add(name,'light',null);Hierarchy.refresh();
    toast('Added '+name,'success');Audio.success();
  },

  deleteSelected(){
    if(!SceneData.selected){toast('Nothing selected','warn');return;}
    SceneData.remove(SceneData.selected);this.gizmoGroup.visible=false;Hierarchy.refresh();toast('Deleted','warn');
  },

  duplicateSelected(){
    const e=SceneData.getById(SceneData.selected);
    if(!e||!e.mesh){toast('Nothing selected','warn');return;}
    const nm=e.mesh.clone();nm.position.x+=1.5;this.scene.add(nm);
    const ne=SceneData.add(e.name+' (Copy)',e.type,nm);
    ne.position={x:nm.position.x,y:nm.position.y,z:nm.position.z};
    Hierarchy.refresh();SceneData.select(ne.id);toast('Copied','success');
  },

  focusSelected(){
    const e=SceneData.getById(SceneData.selected);
    if(!e||!e.mesh){toast('Nothing selected','warn');return;}
    this.orbitTarget.copy(e.mesh.position);this.radius=5;this._syncCam();toast('Focused','log',1000);
  },

  setTransformMode(mode){
    this.transformMode=mode;
    document.getElementById('m-transform-label').textContent=mode.toUpperCase();
    document.querySelectorAll('.m-transform-btn').forEach(b=>b.classList.toggle('active',b.dataset.transform===mode));
    toast('Mode: '+mode,'log',800);
  },

  toggleGrid(v){if(this.grid)this.grid.visible=v;},

  _resize(){
    const canvas=document.getElementById('m-scene-canvas');
    if(!canvas||!this.renderer)return;
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if(!w||!h)return;
    this.renderer.setSize(w,h,false);
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
  },

  _loop(){
    requestAnimationFrame(()=>this._loop());
    if(!this.renderer)return;
    if(this.gizmoGroup.visible){
      const sel=SceneData.getById(SceneData.selected);
      if(sel&&sel.mesh){
        this.gizmoGroup.position.copy(sel.mesh.position);
        const dist=this.camera.position.distanceTo(sel.mesh.position);
        this.gizmoGroup.scale.setScalar(dist*0.1);
      }
    }
    this.renderer.render(this.scene,this.camera);
    if(this.gizmoRenderer&&this.gizmoScene&&this.gizmoCamera){
      const dir=new THREE.Vector3().subVectors(this.camera.position,this.orbitTarget).normalize().multiplyScalar(3);
      this.gizmoCamera.position.copy(dir);this.gizmoCamera.lookAt(0,0,0);
      this.gizmoRenderer.render(this.gizmoScene,this.gizmoCamera);
    }
  }
};

/* ══ HIERARCHY ══ */
const Hierarchy={
  get list(){return document.getElementById('m-hier-list');},
  refresh(){
    const list=this.list;if(!list)return;list.innerHTML='';
    SceneData.entities.forEach(entity=>{
      const item=document.createElement('div');
      item.className='m-hier-item'+(SceneData.selected===entity.id?' selected':'');
      item.dataset.entityId=entity.id;
      const icons={mesh:'<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1.5l5.5 3v6.5L7 14.5l-5.5-3.5V4.5z" stroke="#6688cc" stroke-width="1.1" fill="none"/></svg>',light:'<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="6" r="2.5" stroke="#ccaa33" stroke-width="1.1" fill="none"/></svg>',empty:'<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="4.5" stroke="#555" stroke-width="1.1" fill="none" stroke-dasharray="2 2"/></svg>'};
      item.innerHTML=(icons[entity.type]||icons.empty)+'<span class="m-hier-name">'+entity.name+'</span><span class="m-hier-type">'+entity.type+'</span><button class="m-hier-eye" data-id="'+entity.id+'"><svg width="12" height="12" viewBox="0 0 12 12"><ellipse cx="6" cy="6" rx="4.5" ry="2.5" stroke="currentColor" stroke-width="1.1" fill="none"/><circle cx="6" cy="6" r="1.3" fill="currentColor"/></svg></button>';
      item.addEventListener('click',e=>{
        if(e.target.closest('.m-hier-eye'))return;
        Audio.tap();SceneData.select(entity.id);closeDrawer('hierarchy');
      });
      item.querySelector('.m-hier-eye').addEventListener('click',e=>{
        e.stopPropagation();entity.active=!entity.active;
        if(entity.mesh)entity.mesh.visible=entity.active;
        item.querySelector('.m-hier-eye').style.opacity=entity.active?'1':'0.3';Audio.tap();
      });
      list.appendChild(item);
    });
  },
  selectItem(id){document.querySelectorAll('.m-hier-item[data-entity-id]').forEach(el=>el.classList.toggle('selected',parseInt(el.dataset.entityId)===id));},
  clearSelection(){document.querySelectorAll('.m-hier-item').forEach(el=>el.classList.remove('selected'));}
};

/* ══ INSPECTOR ══ */
const Inspector={
  get body(){return document.getElementById('m-insp-body');},
  update(entity){
    const body=this.body;if(!body)return;
    body.innerHTML=
      '<div class="m-insp-header"><input type="checkbox" '+(entity.active?'checked':'')+'id="m-ent-active" style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer"/><input type="text" class="m-ent-name" id="m-ent-name" value="'+entity.name+'"/><span class="m-ent-tag">'+entity.type+'</span></div>'+
      '<div class="m-comp-block"><div class="m-comp-header"><svg class="m-comp-arrow open" width="9" height="9" viewBox="0 0 9 9"><path d="M1.5 3l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.2"/></svg><span class="m-comp-title">Transform</span></div>'+
      '<div class="m-comp-body">'+this._vec3('Position','mpos',entity.position)+this._vec3('Rotation','mrot',entity.rotation)+this._vec3('Scale','mscl',entity.scale)+'</div></div>'+
      (entity.type==='mesh'?this._meshBlock(entity):'')+
      '<button class="m-add-comp" id="m-add-comp-btn"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg> Add Component</button>';

    [['mpos','position'],['mrot','rotation'],['mscl','scale']].forEach(([prefix,key])=>{
      ['x','y','z'].forEach(axis=>{
        const inp=document.getElementById(prefix+'-'+axis);
        if(!inp)return;
        inp.addEventListener('input',()=>{
          const v=parseFloat(inp.value)||0;entity[key][axis]=v;
          if(entity.mesh){
            if(key==='position')entity.mesh.position[axis]=v;
            if(key==='rotation')entity.mesh.rotation[axis]=THREE.MathUtils.degToRad(v);
            if(key==='scale')entity.mesh.scale[axis]=v;
            SV.gizmoGroup.position.copy(entity.mesh.position);
          }
        });
      });
    });

    document.getElementById('m-ent-name')&&document.getElementById('m-ent-name').addEventListener('input',function(){entity.name=this.value;Hierarchy.refresh();Hierarchy.selectItem(entity.id);document.getElementById('m-sel-name').textContent=entity.name;});
    document.getElementById('m-ent-active')&&document.getElementById('m-ent-active').addEventListener('change',function(){entity.active=this.checked;if(entity.mesh)entity.mesh.visible=this.checked;});

    const cp=document.getElementById('m-mesh-color');
    if(cp&&entity.mesh&&entity.mesh.material){cp.value='#'+entity.mesh.material.color.getHexString();cp.addEventListener('input',function(){entity.mesh.material.color.set(this.value);});}

    body.querySelectorAll('input[type="range"][data-mat]').forEach(sl=>{sl.addEventListener('input',function(){if(entity.mesh&&entity.mesh.material)entity.mesh.material[this.dataset.mat]=parseFloat(this.value);});});
    body.querySelectorAll('input[type="checkbox"][data-mat]').forEach(cb=>{cb.addEventListener('change',function(){if(entity.mesh&&entity.mesh.material)entity.mesh.material[this.dataset.mat]=this.checked;});});

    document.querySelectorAll('.m-comp-header').forEach(hdr=>{hdr.addEventListener('click',()=>{Audio.tap();const b=hdr.nextElementSibling;if(!b)return;const open=b.style.display!=='none';b.style.display=open?'none':'';hdr.querySelector('.m-comp-arrow')&&hdr.querySelector('.m-comp-arrow').classList.toggle('open',!open);});});
    document.getElementById('m-add-comp-btn')&&document.getElementById('m-add-comp-btn').addEventListener('click',()=>toast('Components — coming in v0.5','warn'));
  },

  _vec3(label,prefix,v){
    v=v||{x:0,y:0,z:0};const f=n=>(n||0).toFixed(2);
    return '<div class="m-prop-row"><div class="m-prop-label">'+label+'</div><div class="m-vec3"><label class="m-x">X<input id="'+prefix+'-x" type="number" class="m-num" value="'+f(v.x)+'" step="0.1"/></label><label class="m-y">Y<input id="'+prefix+'-y" type="number" class="m-num" value="'+f(v.y)+'" step="0.1"/></label><label class="m-z">Z<input id="'+prefix+'-z" type="number" class="m-num" value="'+f(v.z)+'" step="0.1"/></label></div></div>';
  },

  _meshBlock(entity){
    const metal=entity.mesh&&entity.mesh.material?entity.mesh.material.metalness||0.1:0.1;
    const rough=entity.mesh&&entity.mesh.material?entity.mesh.material.roughness||0.5:0.5;
    return '<div class="m-comp-block"><div class="m-comp-header"><svg class="m-comp-arrow open" width="9" height="9" viewBox="0 0 9 9"><path d="M1.5 3l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.2"/></svg><span class="m-comp-title">Mesh Renderer</span></div><div class="m-comp-body"><div class="m-prop-inline"><span class="m-prop-label">Color</span><input type="color" class="m-prop-color" id="m-mesh-color" value="#4488cc"/></div><div class="m-prop-inline"><span class="m-prop-label">Metalness</span><input type="range" class="m-prop-slider" min="0" max="1" step="0.01" value="'+metal+'" data-mat="metalness"/></div><div class="m-prop-inline"><span class="m-prop-label">Roughness</span><input type="range" class="m-prop-slider" min="0" max="1" step="0.01" value="'+rough+'" data-mat="roughness"/></div><div class="m-prop-inline"><span class="m-prop-label">Wireframe</span><input type="checkbox" '+(entity.mesh&&entity.mesh.material&&entity.mesh.material.wireframe?'checked':'')+'data-mat="wireframe" style="accent-color:var(--accent);width:16px;height:16px"/></div></div></div>';
  },

  clear(){
    const body=this.body;if(!body)return;
    body.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px 16px;gap:8px;color:var(--text-dim)"><svg width="28" height="28" viewBox="0 0 28 28" opacity="0.3"><circle cx="14" cy="10" r="5" stroke="#888" stroke-width="1.4" fill="none"/><path d="M5 25c0-5 4-9 9-9s9 4 9 9" stroke="#888" stroke-width="1.4" fill="none"/></svg><p style="font-size:12px">Tap an entity to inspect</p></div>';
  }
};

/* ══ DRAWER SYSTEM ══ */
const openDrawers=new Set();

function openDrawer(id){
  const drawer=document.getElementById('m-drawer-'+id);
  const overlay=document.getElementById('m-drawer-overlay');
  if(!drawer)return;
  openDrawers.forEach(d=>{if(d!==id)closeDrawer(d);});
  drawer.classList.remove('hidden');
  overlay&&overlay.classList.remove('hidden');
  openDrawers.add(id);Audio.tap();
  if(id==='hierarchy')Hierarchy.refresh();
  if(id==='inspector'){const e=SceneData.getById(SceneData.selected);if(e)Inspector.update(e);else Inspector.clear();}
}

function closeDrawer(id){
  document.getElementById('m-drawer-'+id)&&document.getElementById('m-drawer-'+id).classList.add('hidden');
  openDrawers.delete(id);
  if(openDrawers.size===0)document.getElementById('m-drawer-overlay')&&document.getElementById('m-drawer-overlay').classList.add('hidden');
}

document.querySelectorAll('.m-drawer-close').forEach(btn=>{btn.addEventListener('click',()=>{Audio.tap();closeDrawer(btn.dataset.drawer);});});
document.getElementById('m-drawer-overlay')&&document.getElementById('m-drawer-overlay').addEventListener('click',()=>{openDrawers.forEach(d=>closeDrawer(d));});

document.querySelectorAll('.m-drawer-handle').forEach(handle=>{
  let sy=0;
  handle.addEventListener('touchstart',e=>{sy=e.touches[0].clientY;},{passive:true});
  handle.addEventListener('touchend',e=>{if(e.changedTouches[0].clientY-sy>40){const id=handle.parentElement.id.replace('m-drawer-','');closeDrawer(id);}},{passive:true});
});

/* ══ TAB SYSTEM ══ */
const tabRibbons={home:'ribbon-home',model:'ribbon-model',script:'ribbon-script',animate:'ribbon-animate',test:'ribbon-test'};
const tabViews={home:'m-scene-wrap',model:'m-scene-wrap',script:'m-code-wrap',animate:'m-anim-wrap',test:'m-scene-wrap'};

function switchTab(tab){
  document.querySelectorAll('.m-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
  document.querySelectorAll('.ribbon-panel').forEach(p=>p.classList.add('hidden'));
  const ribbon=document.getElementById(tabRibbons[tab]);
  if(ribbon)ribbon.classList.remove('hidden');
  // Show/hide views
  const allViews=['m-scene-wrap','m-code-wrap','m-anim-wrap'];
  allViews.forEach(v=>{const el=document.getElementById(v);if(el)el.classList.add('hidden');});
  const view=document.getElementById(tabViews[tab]);
  if(view)view.classList.remove('hidden');
  if(tab==='home'||tab==='model'||tab==='test')setTimeout(()=>SV._resize(),50);
  Audio.tap();
}

document.querySelectorAll('.m-tab').forEach(tab=>{tab.addEventListener('click',()=>switchTab(tab.dataset.tab));});

/* ══ RIBBON BUTTONS ══ */
// Primitives
document.querySelectorAll('.m-ribbon-btn[data-prim]').forEach(btn=>{btn.addEventListener('click',()=>{Audio.tap();SV.addPrimitive(btn.dataset.prim);});});
// Lights
document.querySelectorAll('.m-ribbon-btn[data-light]').forEach(btn=>{btn.addEventListener('click',()=>{Audio.tap();SV.addLight(btn.dataset.light);});});
// Empty
document.querySelectorAll('.m-ribbon-btn[data-special="empty"]').forEach(btn=>{btn.addEventListener('click',()=>{Audio.tap();SceneData.add('Empty','empty',null);Hierarchy.refresh();toast('Empty added','success');});});
// Transform tools
document.querySelectorAll('.m-transform-btn').forEach(btn=>{btn.addEventListener('click',()=>{Audio.tap();SV.setTransformMode(btn.dataset.transform);});});
// Action buttons
document.getElementById('m-del-btn')&&document.getElementById('m-del-btn').addEventListener('click',()=>{Audio.tap();SV.deleteSelected();});
document.getElementById('m-dup-btn')&&document.getElementById('m-dup-btn').addEventListener('click',()=>{Audio.tap();SV.duplicateSelected();});
document.getElementById('m-focus-btn')&&document.getElementById('m-focus-btn').addEventListener('click',()=>{Audio.tap();SV.focusSelected();});
document.getElementById('m-gyro-btn')&&document.getElementById('m-gyro-btn').addEventListener('click',()=>SV.toggleGyro());
// Model tab
document.getElementById('m-hier-btn')&&document.getElementById('m-hier-btn').addEventListener('click',()=>openDrawer('hierarchy'));
document.getElementById('m-insp-btn')&&document.getElementById('m-insp-btn').addEventListener('click',()=>openDrawer('inspector'));
document.getElementById('m-assets-btn')&&document.getElementById('m-assets-btn').addEventListener('click',()=>openDrawer('assets'));
// Script tab
document.getElementById('m-new-script-btn')&&document.getElementById('m-new-script-btn').addEventListener('click',()=>{Audio.tap();const name=prompt('Script name (e.g. MyScript.js):');if(name&&name.trim()){const tab=document.createElement('div');tab.className='m-file-tab';tab.dataset.file=name.trim();tab.textContent=name.trim();document.getElementById('m-code-files').insertBefore(tab,document.querySelector('.m-file-tab[data-file="+ New"]'));document.getElementById('m-code-textarea').value='// '+name.trim()+'\n\nclass '+name.replace(/\.js$/,'').replace(/[^a-zA-Z0-9]/g,'')+'{\n  onStart() {\n    CEngine.log("Started");\n  }\n\n  onUpdate(dt) {\n    \n  }\n}';toast('Created: '+name.trim(),'success');}});
document.getElementById('m-save-script-btn')&&document.getElementById('m-save-script-btn').addEventListener('click',()=>{Audio.tap();toast('Script saved','success');});
document.getElementById('m-run-script-btn')&&document.getElementById('m-run-script-btn').addEventListener('click',()=>{Audio.tap();const code=document.getElementById('m-code-textarea')&&document.getElementById('m-code-textarea').value;try{new Function(code)();toast('Script executed','success');}catch(e){Con.log(e.message,'error','Script');toast('Error: '+e.message,'error');}});
document.getElementById('m-console-btn')&&document.getElementById('m-console-btn').addEventListener('click',()=>openDrawer('console'));
// Test tab
document.getElementById('m-play-here-btn')&&document.getElementById('m-play-here-btn').addEventListener('click',()=>document.getElementById('m-play-btn').click());
document.getElementById('m-build-btn')&&document.getElementById('m-build-btn').addEventListener('click',()=>openDrawer('build'));
document.getElementById('m-desktop-btn')&&document.getElementById('m-desktop-btn').addEventListener('click',()=>{localStorage.removeItem('cengine-force-mobile');window.location.href='index.html';});

/* ══ TOP BAR BUTTONS ══ */
document.getElementById('m-save-btn')&&document.getElementById('m-save-btn').addEventListener('click',()=>{Audio.tap();Save.save();});
document.getElementById('m-menu-btn')&&document.getElementById('m-menu-btn').addEventListener('click',()=>openDrawer('menu'));

/* ══ PLAY / STOP ══ */
let playing=false,fpsInterval=null,frameCount=0;

const JOY={
  leftActive:false,rightActive:false,leftId:null,rightId:null,
  leftX:0,leftY:0,rightX:0,rightY:0,
  leftBaseX:0,leftBaseY:0,rightBaseX:0,rightBaseY:0,
  SIZE:55,DEAD:0.12,moveInterval:null,
  show(){
    document.getElementById('m-joy-overlay').classList.remove('hidden');
    this._bind();
    this.moveInterval=setInterval(()=>this._move(),16);
  },
  hide(){
    document.getElementById('m-joy-overlay').classList.add('hidden');
    clearInterval(this.moveInterval);
    this.leftX=this.leftY=this.rightX=this.rightY=0;
    this.leftActive=this.rightActive=false;
    document.getElementById('m-joy-left-base').classList.add('hidden');
    document.getElementById('m-joy-right-base').classList.add('hidden');
  },
  _bind(){
    const lz=document.getElementById('m-joy-left'),rz=document.getElementById('m-joy-right');
    if(!lz||!rz)return;
    lz.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();if(this.leftActive)return;const t=e.changedTouches[0];this.leftId=t.identifier;this.leftActive=true;this.leftBaseX=t.clientX;this.leftBaseY=t.clientY;this._showBase('left',t.clientX,t.clientY);},{passive:false});
    rz.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();if(this.rightActive)return;const t=e.changedTouches[0];this.rightId=t.identifier;this.rightActive=true;this.rightBaseX=t.clientX;this.rightBaseY=t.clientY;this._showBase('right',t.clientX,t.clientY);},{passive:false});
    document.addEventListener('touchmove',e=>{Array.from(e.changedTouches).forEach(t=>{if(t.identifier===this.leftId)this._stick('left',t.clientX,t.clientY);if(t.identifier===this.rightId)this._stick('right',t.clientX,t.clientY);});},{passive:false});
    document.addEventListener('touchend',e=>{Array.from(e.changedTouches).forEach(t=>{if(t.identifier===this.leftId){this.leftActive=false;this.leftId=null;this.leftX=0;this.leftY=0;this._hideBase('left');}if(t.identifier===this.rightId){this.rightActive=false;this.rightId=null;this.rightX=0;this.rightY=0;this._hideBase('right');}});});
    ['m-btn-jump','m-btn-shoot','m-btn-act'].forEach(id=>{const btn=document.getElementById(id);if(btn)btn.addEventListener('touchstart',e=>{e.preventDefault();Audio.tap();btn.style.transform='scale(0.9)';setTimeout(()=>btn.style.transform='',150);},{passive:false});});
  },
  _showBase(side,x,y){const base=document.getElementById('m-joy-'+side+'-base');if(!base)return;base.classList.remove('hidden');base.style.left=(x-this.SIZE)+'px';base.style.top=(y-this.SIZE)+'px';const stick=document.getElementById('m-joy-'+side+'-stick');if(stick)stick.style.transform='translate(-50%,-50%)';},
  _hideBase(side){const base=document.getElementById('m-joy-'+side+'-base');if(base)base.classList.add('hidden');},
  _stick(side,x,y){const bx=side==='left'?this.leftBaseX:this.rightBaseX,by=side==='left'?this.leftBaseY:this.rightBaseY;const stick=document.getElementById('m-joy-'+side+'-stick');if(!stick)return;let dx=x-bx,dy=y-by;const dist=Math.sqrt(dx*dx+dy*dy),max=this.SIZE*0.65;if(dist>max){dx=(dx/dist)*max;dy=(dy/dist)*max;}const nx=dx/max,ny=dy/max;if(side==='left'){this.leftX=nx;this.leftY=ny;}else{this.rightX=nx;this.rightY=ny;}stick.style.transform='translate(calc(-50% + '+dx+'px), calc(-50% + '+dy+'px))';},
  _move(){
    const MOVE=0.06,LOOK=0.025;
    const lx=Math.abs(this.leftX)>this.DEAD?this.leftX:0,ly=Math.abs(this.leftY)>this.DEAD?this.leftY:0;
    const rx=Math.abs(this.rightX)>this.DEAD?this.rightX:0,ry=Math.abs(this.rightY)>this.DEAD?this.rightY:0;
    if(lx!==0||ly!==0){const fwd=new THREE.Vector3(-Math.sin(SV.theta),0,-Math.cos(SV.theta)),right=new THREE.Vector3(Math.cos(SV.theta),0,-Math.sin(SV.theta));SV.orbitTarget.addScaledVector(right,lx*MOVE);SV.orbitTarget.addScaledVector(fwd,-ly*MOVE);SV._syncCam();}
    if(rx!==0||ry!==0){SV.theta-=rx*LOOK;SV.phi=Math.max(0.05,Math.min(Math.PI-0.05,SV.phi+ry*LOOK));SV._syncCam();}
  }
};

document.getElementById('m-play-btn')&&document.getElementById('m-play-btn').addEventListener('click',()=>{
  playing=true;SV.playing=true;
  document.getElementById('m-play-btn').classList.add('hidden');
  document.getElementById('m-stop-btn').classList.remove('hidden');
  document.getElementById('m-fps').classList.remove('hidden');
  JOY.show();Audio.success();toast('Playing','success');Con.log('Play mode','log','Engine');
  fpsInterval=setInterval(()=>{const el=document.getElementById('m-fps');if(el)el.textContent=frameCount+' FPS';frameCount=0;},1000);
  (function tick(){if(!playing)return;frameCount++;requestAnimationFrame(tick);})();
});

document.getElementById('m-stop-btn')&&document.getElementById('m-stop-btn').addEventListener('click',()=>{
  playing=false;SV.playing=false;
  document.getElementById('m-play-btn').classList.remove('hidden');
  document.getElementById('m-stop-btn').classList.add('hidden');
  document.getElementById('m-fps').classList.add('hidden');
  JOY.hide();clearInterval(fpsInterval);Audio.error();toast('Stopped');Con.log('Stopped','log','Engine');
});

/* ══ SELECTION BAR ══ */
document.getElementById('m-sel-focus')&&document.getElementById('m-sel-focus').addEventListener('click',()=>{Audio.tap();SV.focusSelected();});
document.getElementById('m-sel-dup')&&document.getElementById('m-sel-dup').addEventListener('click',()=>{Audio.tap();SV.duplicateSelected();});
document.getElementById('m-sel-del')&&document.getElementById('m-sel-del').addEventListener('click',()=>{Audio.tap();SV.deleteSelected();});

/* ══ HIERARCHY DRAWER BUTTONS ══ */
document.getElementById('m-add-entity-btn')&&document.getElementById('m-add-entity-btn').addEventListener('click',()=>{Audio.tap();SV.addPrimitive('cube');});
document.getElementById('m-hier-search')&&document.getElementById('m-hier-search').addEventListener('input',function(){const q=this.value.toLowerCase();document.querySelectorAll('.m-hier-item').forEach(el=>{el.style.display=(el.querySelector('.m-hier-name').textContent.toLowerCase().includes(q))?'':'none';});});

/* ══ CONSOLE WIRING ══ */
document.getElementById('m-clear-console')&&document.getElementById('m-clear-console').addEventListener('click',()=>{Audio.tap();Con.clear();});
document.getElementById('m-console-run')&&document.getElementById('m-console-run').addEventListener('click',()=>{const inp=document.getElementById('m-console-in');if(!inp)return;Audio.tap();Con.exec(inp.value);inp.value='';});
document.getElementById('m-console-in')&&document.getElementById('m-console-in').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('m-console-run').click();});

/* ══ CODE FILE TABS ══ */
const scripts={
  'PlayerController.js':'// PlayerController.js\n\nclass PlayerController {\n  onStart() {\n    this.speed = 5;\n    CEngine.log(\'Player ready\');\n  }\n  onUpdate(dt) {\n    if (Input.held(\'ArrowRight\')) this.transform.position.x += this.speed * dt;\n    if (Input.held(\'ArrowLeft\'))  this.transform.position.x -= this.speed * dt;\n    if (Input.held(\'ArrowUp\'))    this.transform.position.z -= this.speed * dt;\n    if (Input.held(\'ArrowDown\'))  this.transform.position.z += this.speed * dt;\n    if (Input.pressed(\'Space\'))   this.rb.addForce(0, 8, 0);\n  }\n  onCollide(other) {\n    if (other.tag === \'Enemy\') Scene.load(\'GameOver\');\n  }\n}',
  'EnemyAI.js':'// EnemyAI.js\n\nclass EnemyAI {\n  onStart() {\n    this.speed = 2;\n    this.health = 100;\n  }\n  onUpdate(dt) {\n    const player = Scene.find(\'Player\');\n    if (!player) return;\n    const dir = Vector3.normalize(Vector3.sub(player.transform.position, this.transform.position));\n    this.transform.position.x += dir.x * this.speed * dt;\n    this.transform.position.z += dir.z * this.speed * dt;\n  }\n  takeDamage(amount) {\n    this.health -= amount;\n    if (this.health <= 0) this.entity.destroy();\n  }\n}',
  'GameManager.js':'// GameManager.js\n\nclass GameManager {\n  onStart() {\n    this.score = 0;\n    CEngine.log(\'Game started\');\n  }\n  addScore(points) {\n    this.score += points;\n    CEngine.log(\'Score: \' + this.score);\n  }\n  gameOver() {\n    CEngine.log(\'Game Over\');\n  }\n}'
};

document.querySelectorAll('.m-file-tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    if(tab.dataset.file==='+ New'){document.getElementById('m-new-script-btn')&&document.getElementById('m-new-script-btn').click();return;}
    Audio.tap();
    document.querySelectorAll('.m-file-tab').forEach(t=>t.classList.toggle('active',t===tab));
    const content=scripts[tab.dataset.file];
    if(content)document.getElementById('m-code-textarea').value=content;
  });
});

/* ══ ASSETS ══ */
document.querySelectorAll('.m-asset-folder').forEach(f=>{f.addEventListener('click',()=>{Audio.tap();document.querySelectorAll('.m-asset-folder').forEach(x=>x.classList.remove('active'));f.classList.add('active');});});
document.querySelectorAll('.m-asset-item').forEach(item=>{
  item.addEventListener('click',()=>{
    Audio.tap();
    document.querySelectorAll('.m-asset-item').forEach(x=>x.style.borderColor='');
    item.style.borderColor='var(--accent)';
    if(item.dataset.type==='script'){
      switchTab('script');
      const name=item.dataset.name;
      if(scripts[name])document.getElementById('m-code-textarea').value=scripts[name];
    }
  });
});

/* ══ MENU ACTIONS ══ */
document.querySelectorAll('.m-menu-btn[data-action]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    Audio.tap();closeDrawer('menu');
    const a=btn.dataset.action;
    const actions={
      'new-scene':()=>{if(confirm('New scene?')){SceneData.entities.forEach(e=>{if(e.mesh)SV.scene.remove(e.mesh);});SceneData.entities=[];SceneData.selected=null;SceneData.nextId=1;SV._defaultScene();toast('New scene','success');}},
      'save-scene':()=>Save.save(),
      'load-scene':()=>Save.load(),
      'toggle-grid':()=>{SV.toggleGrid(true);toast('Grid toggled');},
      'switch-desktop':()=>{localStorage.removeItem('cengine-force-mobile');window.location.href='index.html';},
      'about':()=>toast('CEngine v0.4 Mobile','log',3000)
    };
    (actions[a]||(() =>toast(a+' coming soon','warn')))();
  });
});

/* ══ BUILD ══ */
document.querySelectorAll('.m-build-plat').forEach(p=>{p.addEventListener('click',()=>{Audio.tap();document.querySelectorAll('.m-build-plat').forEach(b=>b.classList.remove('active'));p.classList.add('active');});});

document.getElementById('m-build-go')&&document.getElementById('m-build-go').addEventListener('click',()=>{
  const name=document.getElementById('m-build-name')&&document.getElementById('m-build-name').value||'My Game';
  const log=document.getElementById('m-build-log');if(!log)return;
  log.innerHTML='';Audio.tap();
  const steps=[{msg:'Compiling...',delay:0},{msg:'Bundling...',delay:400},{msg:'Packaging...',delay:800},{msg:'Generating HTML5...',delay:1200},{msg:'✓ Done!',delay:1600,ok:true}];
  steps.forEach(({msg,delay,ok})=>{setTimeout(()=>{const line=document.createElement('div');line.className='m-build-line'+(ok?' ok':'');line.textContent=msg;log.appendChild(line);log.scrollTop=log.scrollHeight;if(ok){Audio.success();toast('Built: '+name,'success');setTimeout(()=>{closeDrawer('build');launchBuild(name);},500);}},delay);});
});

function launchBuild(name){
  const entities=SceneData.entities.filter(e=>e.mesh).map(e=>({name:e.name,geo:e.mesh.geometry?e.mesh.geometry.type:'BoxGeometry',color:'#'+(e.mesh.material&&e.mesh.material.color?e.mesh.material.color.getHexString():'4488cc'),px:e.mesh.position.x,py:e.mesh.position.y,pz:e.mesh.position.z,rx:e.mesh.rotation.x,ry:e.mesh.rotation.y,rz:e.mesh.rotation.z,sx:e.mesh.scale.x,sy:e.mesh.scale.y,sz:e.mesh.scale.z}));
  const html='<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/><title>'+name+'</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;overflow:hidden;width:100vw;height:100vh}canvas{display:block;width:100%;height:100%}#l{position:fixed;inset:0;background:#0a0a0a;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;transition:opacity 0.4s}.lt{font-family:monospace;font-size:22px;font-weight:800;color:#00a4dc;letter-spacing:2px;margin-bottom:6px}.ls{font-family:monospace;font-size:8px;color:#333;letter-spacing:4px;margin-bottom:20px}.lb{width:140px;height:2px;background:#1a1a1a;overflow:hidden;border-radius:2px}.lf{height:100%;background:#00a4dc;width:0%;transition:width 0.2s}.lc{position:fixed;bottom:12px;font-family:monospace;font-size:8px;color:#222;letter-spacing:3px}</style></head><body><div id="l"><div class="lt">C<span style="color:#888;font-weight:400;font-size:16px">Engine</span></div><div class="ls">LOADING</div><div class="lb"><div class="lf" id="lf"></div></div><div class="lc">BUILT WITH CENGINE</div></div><canvas id="c"></canvas><script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script><script>const lf=document.getElementById("lf");let p=0;const li=setInterval(()=>{p=Math.min(100,p+Math.random()*15+5);lf.style.width=p+"%";if(p>=100){clearInterval(li);setTimeout(()=>{const lo=document.getElementById("l");lo.style.opacity="0";setTimeout(()=>lo.remove(),400);},200);}},70);const renderer=new THREE.WebGLRenderer({canvas:document.getElementById("c"),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;const scene=new THREE.Scene();scene.background=new THREE.Color(0x111111);scene.fog=new THREE.FogExp2(0x111111,0.016);const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.1,1000);scene.add(new THREE.AmbientLight(0x303040,1.8));const dl=new THREE.DirectionalLight(0xfff0e0,2.2);dl.position.set(8,14,6);dl.castShadow=true;scene.add(dl);scene.add(new THREE.GridHelper(40,40,0x1e1e1e,0x181818));const gm={BoxGeometry:()=>new THREE.BoxGeometry(1,1,1),SphereGeometry:()=>new THREE.SphereGeometry(0.5,20,20),CylinderGeometry:()=>new THREE.CylinderGeometry(0.5,0.5,1,20),PlaneGeometry:()=>new THREE.PlaneGeometry(2,2),ConeGeometry:()=>new THREE.ConeGeometry(0.5,1,20),TorusGeometry:()=>new THREE.TorusGeometry(0.5,0.18,14,36)};'+JSON.stringify(entities)+'.forEach(e=>{const geo=(gm[e.geo]||gm.BoxGeometry)();const mat=new THREE.MeshStandardMaterial({color:e.color,roughness:0.5,metalness:0.1});const mesh=new THREE.Mesh(geo,mat);mesh.position.set(e.px,e.py,e.pz);mesh.rotation.set(e.rx,e.ry,e.rz);mesh.scale.set(e.sx,e.sy,e.sz);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);});let th=0.5,ph=1.0,rad=12,tch=false,tlx=0,tly=0,td=0;const ot=new THREE.Vector3();document.addEventListener("touchstart",e=>{if(e.touches.length===1){tch=true;tlx=e.touches[0].clientX;tly=e.touches[0].clientY;}if(e.touches.length===2){const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;td=Math.sqrt(dx*dx+dy*dy);}e.preventDefault();},{passive:false});document.addEventListener("touchmove",e=>{if(e.touches.length===1&&tch){th-=(e.touches[0].clientX-tlx)*0.007;ph=Math.max(0.05,Math.min(3.09,ph+(e.touches[0].clientY-tly)*0.007));tlx=e.touches[0].clientX;tly=e.touches[0].clientY;}if(e.touches.length===2){const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;const d=Math.sqrt(dx*dx+dy*dy);rad=Math.max(1.5,Math.min(80,rad-(d-td)*0.04));td=d;}e.preventDefault();},{passive:false});document.addEventListener("touchend",()=>tch=false);window.addEventListener("resize",()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});function animate(){requestAnimationFrame(animate);camera.position.set(ot.x+rad*Math.sin(ph)*Math.sin(th),ot.y+rad*Math.cos(ph),ot.z+rad*Math.sin(ph)*Math.cos(th));camera.lookAt(ot);renderer.render(scene,camera);}animate();</script></body></html>';
  const tab=window.open('','_blank');
  if(tab){tab.document.write(html);tab.document.close();}else toast('Allow popups','error');
}

/* ══ ANIMATION SIMPLE ══ */
const Anim={
  playing:false,recording:false,frame:0,total:120,fps:30,interval:null,tracks:{},
  drawCanvas(){
    const canvas=document.getElementById('m-anim-canvas'),wrap=document.getElementById('m-anim-keys');
    if(!canvas||!wrap)return;
    const W=wrap.clientWidth||300,H=Math.max(50,Object.keys(this.tracks).length*24+10);
    canvas.width=W;canvas.height=H;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#111';ctx.fillRect(0,0,W,H);
    const step=W/this.total;
    ctx.strokeStyle='#222';ctx.lineWidth=1;
    for(let f=0;f<=this.total;f+=10){const x=f*step;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    let row=0;
    Object.entries(this.tracks).forEach(([id,track])=>{
      const y=row*24+12;row++;
      Object.values(track.properties||{}).forEach(keys=>{keys.forEach(k=>{const x=(k.frame/this.total)*W;ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillStyle='#00a4dc';ctx.fillRect(-4,-4,8,8);ctx.restore();});});
    });
    if(!Object.keys(this.tracks).length){ctx.fillStyle='#333';ctx.font='10px Inter,sans-serif';ctx.textAlign='center';ctx.fillText('Select entity → Add Key to start',W/2,H/2);}
  },
  addKey(){
    const e=SceneData.getById(SceneData.selected);
    if(!e){toast('Select an entity first','warn');return;}
    if(!this.tracks[e.id])this.tracks[e.id]={name:e.name,properties:{'pos.x':[],'pos.y':[],'pos.z':[]}};
    ['pos.x','pos.y','pos.z'].forEach(prop=>{
      const axis=prop.split('.')[1];
      this.tracks[e.id].properties[prop]=this.tracks[e.id].properties[prop].filter(k=>k.frame!==this.frame);
      this.tracks[e.id].properties[prop].push({frame:this.frame,value:e.position[axis]});
      this.tracks[e.id].properties[prop].sort((a,b)=>a.frame-b.frame);
    });
    this.drawCanvas();toast('Key @ frame '+this.frame,'success',1000);
  },
  play(){this.playing=true;this.interval=setInterval(()=>{this.frame++;if(this.frame>this.total)this.frame=0;const fi=document.getElementById('m-anim-frame');if(fi)fi.value=this.frame;},1000/this.fps);},
  stop(){this.playing=false;clearInterval(this.interval);}
};

document.getElementById('m-anim-rec')&&document.getElementById('m-anim-rec').addEventListener('click',()=>{Audio.tap();Anim.recording=!Anim.recording;document.getElementById('m-anim-rec').classList.toggle('active',Anim.recording);toast(Anim.recording?'Recording':'Stopped recording');});
document.getElementById('m-anim-play')&&document.getElementById('m-anim-play').addEventListener('click',()=>{Audio.tap();Anim.playing?Anim.stop():Anim.play();});
document.getElementById('m-anim-addkey')&&document.getElementById('m-anim-addkey').addEventListener('click',()=>{Audio.tap();Anim.addKey();});
document.getElementById('m-anim-frame')&&document.getElementById('m-anim-frame').addEventListener('input',function(){Anim.frame=parseInt(this.value)||0;});

/* ══ PUBLIC API ══ */
window.MEngineAPI={add:type=>SV.addPrimitive(type),delete:()=>SV.deleteSelected(),list:()=>SceneData.entities.map(e=>e.name),log:msg=>Con.log(String(msg),'log','Script'),save:()=>Save.save(),load:()=>Save.load()};

setInterval(()=>{const e=SceneData.getById(SceneData.selected);window._mSelMesh=e&&e.mesh?e.mesh:null;},100);

/* ══ INIT ══ */
Audio.init();
Con.init();
SV.init();
Inspector.clear();
// Start on home tab — scene visible
switchTab('home');

setTimeout(()=>Con.log('CEngine Mobile v0.4','log','Engine'),100);
setTimeout(()=>Con.log('Three.js r128 ready','log','Renderer'),200);
setTimeout(()=>Con.log('Tip: Home=scene  Script=code  Animate=timeline','log','Editor'),500);
setTimeout(()=>toast('CEngine Mobile v0.4','success',2500),400);

})();
