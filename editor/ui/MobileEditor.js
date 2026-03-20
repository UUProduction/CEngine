/* ═══════════════════════════════════════════
   CENGINE MOBILE EDITOR v0.1
   Touch-first game editor for phones/tablets
   ═══════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══════════════════════════════════════
     DESKTOP REDIRECT
  ══════════════════════════════════════ */
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || navigator.maxTouchPoints > 1;

  // If on desktop and user didn't force mobile, go to desktop
  if (!isMobile && !localStorage.getItem('cengine-force-mobile')) {
    window.location.href = 'index.html';
    return;
  }

  /* ══════════════════════════════════════
     AUDIO
  ══════════════════════════════════════ */
  const Audio = {
    ctx: null, muted: false, enabled: false,
    ambient: document.getElementById('audio-ambient'),

    init() {
      if (this.ambient) this.ambient.volume = 0.1;
      document.addEventListener('touchstart', () => {
        if (!this.enabled) {
          this.enabled = true;
          try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
          this.ambient?.play().catch(()=>{});
        }
      }, { once: true });
    },

    tone(freq=660, dur=0.07, vol=0.025) {
      if (this.muted || !this.ctx) return;
      try {
        const o=this.ctx.createOscillator(), g=this.ctx.createGain();
        o.connect(g); g.connect(this.ctx.destination);
        o.frequency.setValueAtTime(freq, this.ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(freq*0.75, this.ctx.currentTime+dur);
        g.gain.setValueAtTime(vol, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime+dur);
        o.start(); o.stop(this.ctx.currentTime+dur);
      } catch(e){}
    },

    tap()     { this.tone(700, 0.05, 0.02); },
    success() { this.tone(880, 0.1, 0.03); setTimeout(()=>this.tone(1100,0.08,0.025),100); },
    error()   { this.tone(180, 0.15, 0.03, 'sawtooth'); }
  };

  /* ══════════════════════════════════════
     TOAST
  ══════════════════════════════════════ */
  function toast(msg, type='log', dur=2200) {
    const c = document.getElementById('m-toast-container');
    if (!c) return;
    const el = document.createElement('div');
    el.className = `m-toast ${type}`;
    el.textContent = msg;
    c.appendChild(el);
    if (type==='success') Audio.success();
    else if (type==='error') Audio.error();
    else Audio.tap();
    setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(),300); }, dur);
  }

  /* ══════════════════════════════════════
     SCENE DATA
  ══════════════════════════════════════ */
  const SceneData = {
    entities: [],
    selected: null,
    nextId: 1,

    add(name, type, mesh=null) {
      const e = { id:this.nextId++, name, type, active:true, mesh,
        position:{x:0,y:0,z:0}, rotation:{x:0,y:0,z:0}, scale:{x:1,y:1,z:1} };
      this.entities.push(e);
      return e;
    },

    getById(id) { return this.entities.find(e=>e.id===id)||null; },

    remove(id) {
      const e = this.getById(id);
      if (e?.mesh) {
        SceneView.scene.remove(e.mesh);
        e.mesh.geometry?.dispose();
        e.mesh.material?.dispose();
      }
      this.entities = this.entities.filter(x=>x.id!==id);
      if (this.selected===id) { this.selected=null; MobileInspector.clear(); }
    },

    select(id) {
      this.selected = id;
      const e = this.getById(id);
      if (e) {
        MobileInspector.update(e);
        SceneView.showGizmo(e);
        updateSelectionBar(e);
      }
    }
  };

  /* ══════════════════════════════════════
     THREE.JS SCENE VIEW
  ══════════════════════════════════════ */
  const SceneView = {
    renderer:null, scene:null, camera:null,
    gizmoRenderer:null, gizmoScene:null, gizmoCamera:null,
    transformGizmoGroup:null, raycaster:null,
    grid:null,

    // Camera
    theta:0.5, phi:1.0, radius:12,
    orbitTarget: null,

    // Touch state
    t1x:0, t1y:0,          // single finger last pos
    t1StartX:0, t1StartY:0, // single finger start pos
    lastPinchDist:0,
    isTouching:false,

    // Transform drag
    transformMode:'translate',
    isDraggingEntity:false,
    dragStartX:0, dragStartY:0,
    dragStartPos:null, dragStartRot:null, dragStartScl:null,
    DRAG_THRESHOLD:6,

    // Gyro
    gyroEnabled:false,

    init() {
      const canvas = document.getElementById('m-scene-canvas');
      if (!canvas || typeof THREE==='undefined') return;

      this.raycaster = new THREE.Raycaster();
      this.orbitTarget = new THREE.Vector3(0,0,0);

      // Renderer
      this.renderer = new THREE.WebGLRenderer({canvas, antialias:true});
      this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.1;

      // Scene
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x111111);
      this.scene.fog = new THREE.FogExp2(0x111111, 0.016);

      // Camera
      this.camera = new THREE.PerspectiveCamera(60,1,0.1,1000);
      this._syncCam();

      // Lights
      this.scene.add(new THREE.AmbientLight(0x303040, 1.8));
      const dl = new THREE.DirectionalLight(0xfff0e0, 2.2);
      dl.position.set(8,14,6);
      dl.castShadow = true;
      dl.shadow.mapSize.set(1024,1024);
      this.scene.add(dl);
      this.scene.add(new THREE.PointLight(0x204060,1.2,30).position.set(-8,4,-6));

      // Grid
      this.grid = new THREE.GridHelper(40,40,0x1e1e1e,0x181818);
      this.scene.add(this.grid);

      // Ground
      const gnd = new THREE.Mesh(
        new THREE.PlaneGeometry(40,40),
        new THREE.MeshStandardMaterial({color:0x0d0d0d,roughness:1})
      );
      gnd.rotation.x = -Math.PI/2;
      gnd.receiveShadow = true;
      this.scene.add(gnd);

      this._initGizmoViewport();
      this._initTransformGizmo();
      this._bindTouchEvents(canvas);
      this._initGyro();

      window.addEventListener('resize', ()=>this._resize());
      window.addEventListener('orientationchange', ()=>{ setTimeout(()=>this._resize(),300); });
      this._resize();
      this._buildDefaultScene();
      this._loop();

      mLog('SceneView ready', 'log', 'SceneView.js');
    },

    _buildDefaultScene() {
      // Floor
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(8,0.2,8),
        new THREE.MeshStandardMaterial({color:0x2a2a2a,roughness:0.9})
      );
      floor.position.y = -0.1;
      floor.receiveShadow = true;
      this.scene.add(floor);
      SceneData.add('Floor','mesh',floor).position={x:0,y:-0.1,z:0};

      // Default cube
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(1,1,1),
        new THREE.MeshStandardMaterial({color:0x4488cc,roughness:0.4,metalness:0.2})
      );
      cube.position.y = 0.5;
      cube.castShadow = true;
      this.scene.add(cube);
      SceneData.add('Cube','mesh',cube).position={x:0,y:0.5,z:0};

      MobileHierarchy.refresh();
    },

    _syncCam() {
      if (!this.camera||!this.orbitTarget) return;
      this.camera.position.set(
        this.orbitTarget.x + this.radius*Math.sin(this.phi)*Math.sin(this.theta),
        this.orbitTarget.y + this.radius*Math.cos(this.phi),
        this.orbitTarget.z + this.radius*Math.sin(this.phi)*Math.cos(this.theta)
      );
      this.camera.lookAt(this.orbitTarget);
    },

    _initGizmoViewport() {
      const gc = document.getElementById('m-gizmo-canvas');
      if (!gc) return;
      this.gizmoRenderer = new THREE.WebGLRenderer({canvas:gc,alpha:true,antialias:true});
      this.gizmoRenderer.setSize(60,60);
      this.gizmoScene  = new THREE.Scene();
      this.gizmoCamera = new THREE.PerspectiveCamera(50,1,0.1,100);
      this.gizmoCamera.position.set(0,0,3);

      const axes=[
        {dir:new THREE.Vector3(1,0,0),color:0xcc3333},
        {dir:new THREE.Vector3(0,1,0),color:0x33aa33},
        {dir:new THREE.Vector3(0,0,1),color:0x3366cc}
      ];
      axes.forEach(({dir,color})=>{
        const mat=new THREE.MeshBasicMaterial({color,depthTest:false});
        const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir);
        const body=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.7,8),mat);
        const tip =new THREE.Mesh(new THREE.ConeGeometry(0.13,0.3,8),mat);
        body.position.copy(dir.clone().multiplyScalar(0.35)); body.quaternion.copy(q);
        tip.position.copy(dir.clone().multiplyScalar(0.85));  tip.quaternion.copy(q);
        this.gizmoScene.add(body,tip);
      });
    },

    _initTransformGizmo() {
      this.transformGizmoGroup = new THREE.Group();
      this.transformGizmoGroup.visible = false;
      this.transformGizmoGroup.renderOrder = 999;

      const axes=[
        {dir:new THREE.Vector3(1,0,0),color:0xdd2222},
        {dir:new THREE.Vector3(0,1,0),color:0x22aa22},
        {dir:new THREE.Vector3(0,0,1),color:0x2244dd}
      ];
      axes.forEach(({dir,color})=>{
        const mat=new THREE.MeshBasicMaterial({color,depthTest:false});
        const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir);
        const body=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,1.0,8),mat.clone());
        const tip =new THREE.Mesh(new THREE.ConeGeometry(0.1,0.26,8),mat.clone());
        body.position.copy(dir.clone().multiplyScalar(0.5)); body.quaternion.copy(q);
        tip.position.copy(dir.clone().multiplyScalar(1.13)); tip.quaternion.copy(q);
        this.transformGizmoGroup.add(body,tip);
      });
      this.scene.add(this.transformGizmoGroup);
    },

    showGizmo(entity) {
      if (!entity?.mesh) { this.transformGizmoGroup.visible=false; return; }
      this.transformGizmoGroup.visible = true;
      this.transformGizmoGroup.position.copy(entity.mesh.position);
    },

    /* ══════════════════════════════════
       TOUCH EVENTS
       Single finger = orbit OR transform drag
       Two fingers   = pinch zoom
       Tap           = select entity
    ══════════════════════════════════ */
    _bindTouchEvents(canvas) {
      let tapTimer=null, tapCount=0;

      canvas.addEventListener('touchstart', e=>{
        e.preventDefault();
        const touches = e.touches;

        if (touches.length===1) {
          this.isTouching = true;
          this.t1x = this.t1StartX = touches[0].clientX;
          this.t1y = this.t1StartY = touches[0].clientY;
          this.isDraggingEntity = false;

          // Check if touching selected entity
          const entity = SceneData.getById(SceneData.selected);
          if (entity?.mesh) {
            const hit = this._raycastPoint(touches[0].clientX, touches[0].clientY, [entity.mesh]);
            if (hit) {
              // Prepare transform drag
              this.dragStartPos = entity.mesh.position.clone();
              this.dragStartRot = {x:entity.mesh.rotation.x,y:entity.mesh.rotation.y,z:entity.mesh.rotation.z};
              this.dragStartScl = entity.mesh.scale.clone();
            } else {
              this.dragStartPos = null;
            }
          }
        }

        if (touches.length===2) {
          this.isTouching = false;
          this.isDraggingEntity = false;
          const dx=touches[0].clientX-touches[1].clientX;
          const dy=touches[0].clientY-touches[1].clientY;
          this.lastPinchDist = Math.sqrt(dx*dx+dy*dy);
        }
      },{passive:false});

      canvas.addEventListener('touchmove', e=>{
        e.preventDefault();
        const touches = e.touches;

        if (touches.length===1) {
          const dx = touches[0].clientX - this.t1x;
          const dy = touches[0].clientY - this.t1y;
          const totalDx = touches[0].clientX - this.t1StartX;
          const totalDy = touches[0].clientY - this.t1StartY;
          const totalDist = Math.sqrt(totalDx*totalDx+totalDy*totalDy);

          // Transform drag — if started on selected entity
          if (this.dragStartPos && totalDist > this.DRAG_THRESHOLD) {
            this.isDraggingEntity = true;
            const entity = SceneData.getById(SceneData.selected);
            if (entity?.mesh) {
              this._applyTransformDrag(entity, totalDx, totalDy);
              MobileInspector.update(entity);
              updateSelectionBar(entity);
            }
          } else if (!this.isDraggingEntity) {
            // Orbit
            this.theta -= dx * 0.007;
            this.phi = Math.max(0.05, Math.min(Math.PI-0.05, this.phi + dy*0.007));
            this._syncCam();
          }

          this.t1x = touches[0].clientX;
          this.t1y = touches[0].clientY;
        }

        if (touches.length===2) {
          // Pinch zoom
          const dx=touches[0].clientX-touches[1].clientX;
          const dy=touches[0].clientY-touches[1].clientY;
          const dist = Math.sqrt(dx*dx+dy*dy);
          this.radius = Math.max(1.5, Math.min(80, this.radius-(dist-this.lastPinchDist)*0.04));
          this.lastPinchDist = dist;
          this._syncCam();

          // Two-finger pan
          const midX=(touches[0].clientX+touches[1].clientX)/2;
          const midY=(touches[0].clientY+touches[1].clientY)/2;
          // (store mid for pan delta next frame if needed)
        }
      },{passive:false});

      canvas.addEventListener('touchend', e=>{
        e.preventDefault();
        const wasDragging = this.isDraggingEntity;
        this.isTouching = false;
        this.isDraggingEntity = false;
        this.dragStartPos = null;

        // Tap to select (only if didn't drag)
        if (!wasDragging && e.changedTouches.length===1) {
          const t = e.changedTouches[0];
          const totalDx = t.clientX - this.t1StartX;
          const totalDy = t.clientY - this.t1StartY;
          if (Math.sqrt(totalDx*totalDx+totalDy*totalDy) < this.DRAG_THRESHOLD) {
            this._handleTap(t.clientX, t.clientY);
          }
        }
      },{passive:false});
    },

    _handleTap(x, y) {
      const meshes = SceneData.entities.filter(e=>e.mesh&&e.active).map(e=>e.mesh);
      const hits = this._raycastPoint(x, y, meshes, true);
      if (hits) {
        let hit = hits.object;
        while (hit.parent && hit.parent!==this.scene) {
          if (SceneData.entities.find(e=>e.mesh===hit)) break;
          hit = hit.parent;
        }
        const entity = SceneData.entities.find(e=>e.mesh===hit);
        if (entity) {
          SceneData.select(entity.id);
          MobileHierarchy.selectItem(entity.id);
          Audio.tap();
          document.getElementById('m-selection-bar')?.classList.remove('hidden');
          document.getElementById('m-controls-hint')?.classList.add('hidden');
          return;
        }
      }
      // Tap empty space — deselect
      SceneData.selected = null;
      MobileInspector.clear();
      this.transformGizmoGroup.visible = false;
      MobileHierarchy.clearSelection();
      document.getElementById('m-selection-bar')?.classList.add('hidden');
      document.getElementById('m-controls-hint')?.classList.remove('hidden');
    },

    _raycastPoint(x, y, meshes, returnHit=false) {
      const canvas = document.getElementById('m-scene-canvas');
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const mx = ((x-rect.left)/rect.width)*2-1;
      const my = -((y-rect.top)/rect.height)*2+1;
      this.raycaster.setFromCamera(new THREE.Vector2(mx,my), this.camera);
      const hits = this.raycaster.intersectObjects(meshes, true);
      if (hits.length===0) return null;
      return returnHit ? hits[0] : hits[0];
    },

    _applyTransformDrag(entity, dx, dy) {
      const sens = this.radius * 0.0035;
      const camRight = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0).normalize();
      const camUp    = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,1).normalize();

      if (this.transformMode==='translate') {
        entity.mesh.position.copy(this.dragStartPos);
        entity.mesh.position.addScaledVector(camRight,  dx*sens);
        entity.mesh.position.addScaledVector(camUp,    -dy*sens);
        entity.position={x:entity.mesh.position.x,y:entity.mesh.position.y,z:entity.mesh.position.z};
      } else if (this.transformMode==='rotate') {
        entity.mesh.rotation.y = this.dragStartRot.y + dx*0.012;
        entity.mesh.rotation.x = this.dragStartRot.x + dy*0.012;
        entity.rotation={
          x:THREE.MathUtils.radToDeg(entity.mesh.rotation.x),
          y:THREE.MathUtils.radToDeg(entity.mesh.rotation.y),
          z:THREE.MathUtils.radToDeg(entity.mesh.rotation.z)
        };
      } else if (this.transformMode==='scale') {
        const f = Math.max(0.01, 1+dx*0.009);
        entity.mesh.scale.copy(this.dragStartScl).multiplyScalar(f);
        entity.scale={x:entity.mesh.scale.x,y:entity.mesh.scale.y,z:entity.mesh.scale.z};
      }
      this.transformGizmoGroup.position.copy(entity.mesh.position);
    },

    // Gyroscope
    _initGyro() {
      const start = ()=>{
        window.addEventListener('deviceorientation', e=>{
          if (!this.gyroEnabled) return;
          const beta  = THREE.MathUtils.degToRad(e.beta||0);
          const alpha = THREE.MathUtils.degToRad(e.alpha||0);
          this.phi   = THREE.MathUtils.lerp(this.phi, Math.max(0.1,Math.min(Math.PI-0.1,beta)), 0.08);
          this.theta = THREE.MathUtils.lerp(this.theta, -alpha*0.5, 0.04);
          this._syncCam();
        },true);
      };

      if (typeof DeviceOrientationEvent!=='undefined' &&
          typeof DeviceOrientationEvent.requestPermission==='function') {
        window._requestGyro = ()=>{
          DeviceOrientationEvent.requestPermission()
            .then(s=>{ if(s==='granted'){start();this.gyroEnabled=true;} })
            .catch(console.error);
        };
      } else { start(); }
    },

    toggleGyro() {
      if (window._requestGyro && !this.gyroEnabled) {
        window._requestGyro();
        toast('Gyro enabled', 'success');
      } else {
        this.gyroEnabled = !this.gyroEnabled;
        toast(this.gyroEnabled ? 'Gyro ON' : 'Gyro OFF');
      }
      document.getElementById('m-btn-gyro-mobile')?.classList.toggle('active', this.gyroEnabled);
    },

    setTransformMode(mode) {
      this.transformMode = mode;
      document.getElementById('m-transform-label').textContent = mode.toUpperCase();
      document.querySelectorAll('.m-transform-tool').forEach(b=>{
        b.classList.toggle('active', b.dataset.transform===mode);
      });
    },

    // Primitives
    addPrimitive(type) {
      const geos={
        cube:     ()=>new THREE.BoxGeometry(1,1,1),
        sphere:   ()=>new THREE.SphereGeometry(0.5,20,20),
        cylinder: ()=>new THREE.CylinderGeometry(0.5,0.5,1,20),
        plane:    ()=>new THREE.PlaneGeometry(2,2),
        cone:     ()=>new THREE.ConeGeometry(0.5,1,20),
        torus:    ()=>new THREE.TorusGeometry(0.5,0.18,14,36)
      };
      const colors={cube:0x4488cc,sphere:0xcc6633,cylinder:0x44aa66,plane:0x888888,cone:0xccaa22,torus:0xcc4488};

      const geo=(geos[type]||geos.cube)();
      const mat=new THREE.MeshStandardMaterial({color:colors[type]||0x888888,roughness:0.5,metalness:0.1});
      const mesh=new THREE.Mesh(geo,mat);
      mesh.castShadow=true; mesh.receiveShadow=true;

      if (type==='plane') { mesh.rotation.x=-Math.PI/2; mesh.position.y=0.01; }
      else mesh.position.set((Math.random()-0.5)*3, 0.5, (Math.random()-0.5)*3);

      this.scene.add(mesh);
      const name=type.charAt(0).toUpperCase()+type.slice(1);
      const entity=SceneData.add(name,'mesh',mesh);
      entity.position={x:mesh.position.x,y:mesh.position.y,z:mesh.position.z};

      MobileHierarchy.refresh();
      SceneData.select(entity.id);
      MobileHierarchy.selectItem(entity.id);
      Audio.success();
      toast(`Added ${name}`, 'success');
      mLog(`Added: ${name}`, 'log', 'Scene.js');
      document.getElementById('m-selection-bar')?.classList.remove('hidden');
      return entity;
    },

    addLight(type) {
      const name = type==='point'?'Point Light':type==='spot'?'Spot Light':'Dir Light';
      let light;
      if (type==='point') { light=new THREE.PointLight(0xffffff,1.5,20); light.position.set(2,4,2); }
      else if (type==='spot') { light=new THREE.SpotLight(0xffffff,2,30,Math.PI/5); light.position.set(0,7,0); }
      else { light=new THREE.DirectionalLight(0xffffff,1.5); light.position.set(4,7,4); }
      this.scene.add(light);
      SceneData.add(name,'light',null);
      MobileHierarchy.refresh();
      toast(`Added ${name}`, 'success');
    },

    deleteSelected() {
      if (!SceneData.selected) return;
      SceneData.remove(SceneData.selected);
      this.transformGizmoGroup.visible=false;
      MobileHierarchy.refresh();
      document.getElementById('m-selection-bar')?.classList.add('hidden');
      toast('Deleted','warn');
    },

    duplicateSelected() {
      const e=SceneData.getById(SceneData.selected);
      if (!e?.mesh) return;
      const nm=e.mesh.clone(); nm.position.x+=1.5;
      this.scene.add(nm);
      const ne=SceneData.add(e.name+' (Copy)',e.type,nm);
      ne.position={x:nm.position.x,y:nm.position.y,z:nm.position.z};
      MobileHierarchy.refresh();
      SceneData.select(ne.id);
      toast(`Copied: ${ne.name}`,'success');
    },

    focusSelected() {
      const e=SceneData.getById(SceneData.selected);
      if (!e?.mesh) return;
      this.orbitTarget.copy(e.mesh.position);
      this.radius=5;
      this._syncCam();
      toast('Focused','log',1000);
    },

    toggleGrid(v) { if(this.grid) this.grid.visible=v; },
    toggleWireframe(v) { SceneData.entities.forEach(e=>{ if(e.mesh?.material) e.mesh.material.wireframe=v; }); },

    _resize() {
      const canvas=document.getElementById('m-scene-canvas');
      if (!canvas||!this.renderer) return;
      const w=canvas.clientWidth, h=canvas.clientHeight;
      if (!w||!h) return;
      this.renderer.setSize(w,h,false);
      this.camera.aspect=w/h;
      this.camera.updateProjectionMatrix();
    },

    _loop() {
      requestAnimationFrame(()=>this._loop());
      if (!this.renderer) return;

      // Sync gizmo
      if (this.transformGizmoGroup.visible) {
        const sel=SceneData.getById(SceneData.selected);
        if (sel?.mesh) {
          this.transformGizmoGroup.position.copy(sel.mesh.position);
          const dist=this.camera.position.distanceTo(sel.mesh.position);
          this.transformGizmoGroup.scale.setScalar(dist*0.1);
        }
      }

      this.renderer.render(this.scene, this.camera);

      // Gizmo viewport
      if (this.gizmoRenderer&&this.gizmoScene&&this.gizmoCamera) {
        const dir=new THREE.Vector3().subVectors(this.camera.position,this.orbitTarget).normalize().multiplyScalar(3);
        this.gizmoCamera.position.copy(dir);
        this.gizmoCamera.lookAt(0,0,0);
        this.gizmoRenderer.render(this.gizmoScene,this.gizmoCamera);
      }
    }
  };

  /* ══════════════════════════════════════
     HIERARCHY
  ══════════════════════════════════════ */
  const MobileHierarchy = {
    list: document.getElementById('m-hierarchy-list'),

    refresh() {
      if (!this.list) return;
      this.list.innerHTML='';
      SceneData.entities.forEach(entity=>{
        const item=document.createElement('div');
        item.className='m-hierarchy-item'+(SceneData.selected===entity.id?' selected':'');
        item.dataset.entityId=entity.id;

        const icons={
          mesh:`<svg class="m-hier-icon" width="16" height="16" viewBox="0 0 16 16"><path d="M8 2l6 3.5v5.5L8 14l-6-3.5V5.5z" stroke="#6688cc" stroke-width="1.2" fill="none"/></svg>`,
          light:`<svg class="m-hier-icon" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="7" r="3" stroke="#ccaa33" stroke-width="1.2" fill="none"/><path d="M8 11v2M5 10l-1.5 1M11 10l1.5 1" stroke="#ccaa33" stroke-width="1.2"/></svg>`,
          empty:`<svg class="m-hier-icon" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" stroke="#555" stroke-width="1.2" fill="none" stroke-dasharray="2 2"/></svg>`
        };

        item.innerHTML=`
          ${icons[entity.type]||icons.empty}
          <span class="m-hier-name">${entity.name}</span>
          <span class="m-hier-type">${entity.type}</span>
          <button class="m-hier-eye" data-id="${entity.id}">
            <svg width="14" height="14" viewBox="0 0 14 14"><ellipse cx="7" cy="7" rx="5" ry="3" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/></svg>
          </button>`;

        item.addEventListener('click', e=>{
          if (e.target.closest('.m-hier-eye')) return;
          Audio.tap();
          document.querySelectorAll('.m-hierarchy-item').forEach(i=>i.classList.remove('selected'));
          item.classList.add('selected');
          SceneData.select(entity.id);
          document.getElementById('m-selection-bar')?.classList.remove('hidden');
          closeDrawer('hierarchy');
        });

        item.querySelector('.m-hier-eye')?.addEventListener('click', e=>{
          e.stopPropagation();
          entity.active=!entity.active;
          if(entity.mesh) entity.mesh.visible=entity.active;
          item.querySelector('.m-hier-eye').style.opacity=entity.active?'1':'0.3';
          Audio.tap();
        });

        this.list.appendChild(item);
      });
    },

    selectItem(id) {
      document.querySelectorAll('.m-hierarchy-item[data-entity-id]').forEach(el=>{
        el.classList.toggle('selected', parseInt(el.dataset.entityId)===id);
      });
    },

    clearSelection() {
      document.querySelectorAll('.m-hierarchy-item').forEach(el=>el.classList.remove('selected'));
    }
  };

  /* ══════════════════════════════════════
     INSPECTOR
  ══════════════════════════════════════ */
  const MobileInspector = {
    body: document.getElementById('m-inspector-body'),

    update(entity) {
      if (!this.body) return;
      this.body.innerHTML=`
        <div class="m-inspector-entity-header">
          <input type="checkbox" class="m-entity-active" ${entity.active?'checked':''} id="m-ent-active"/>
          <input type="text" class="m-entity-name-input" id="m-ent-name" value="${entity.name}"/>
          <span class="m-entity-tag">${entity.type}</span>
        </div>

        <div class="m-component-block">
          <div class="m-component-header">
            <svg class="m-comp-arrow open" width="10" height="10" viewBox="0 0 10 10"><path d="M2 3l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>
            <span class="m-comp-title">Transform</span>
          </div>
          <div class="m-component-body" id="m-comp-transform">
            ${this._vec3('Position','mpos',entity.position)}
            ${this._vec3('Rotation','mrot',entity.rotation)}
            ${this._vec3('Scale','mscl',entity.scale)}
          </div>
        </div>

        ${entity.type==='mesh'?this._meshBlock(entity):''}

        <button class="m-add-component-btn">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          Add Component
        </button>`;

      // Wire transform inputs
      [['mpos','position'],['mrot','rotation'],['mscl','scale']].forEach(([prefix,key])=>{
        ['x','y','z'].forEach(axis=>{
          const inp=document.getElementById(`${prefix}-${axis}`);
          if (!inp) return;
          inp.addEventListener('input',()=>{
            const v=parseFloat(inp.value)||0;
            entity[key][axis]=v;
            if (entity.mesh) {
              if(key==='position') entity.mesh.position[axis]=v;
              if(key==='rotation') entity.mesh.rotation[axis]=THREE.MathUtils.degToRad(v);
              if(key==='scale')    entity.mesh.scale[axis]=v;
              SceneView.transformGizmoGroup.position.copy(entity.mesh.position);
            }
          });
        });
      });

      document.getElementById('m-ent-name')?.addEventListener('input',function(){
        entity.name=this.value;
        MobileHierarchy.refresh();
        MobileHierarchy.selectItem(entity.id);
      });

      document.getElementById('m-ent-active')?.addEventListener('change',function(){
        entity.active=this.checked;
        if(entity.mesh) entity.mesh.visible=this.checked;
      });

      const colorPick=document.getElementById('m-mesh-color');
      if (colorPick&&entity.mesh?.material) {
        colorPick.value='#'+entity.mesh.material.color.getHexString();
        colorPick.addEventListener('input',function(){ entity.mesh.material.color.set(this.value); });
      }

      // Collapse component headers
      document.querySelectorAll('.m-component-header').forEach(hdr=>{
        hdr.addEventListener('click',()=>{
          Audio.tap();
          const body=hdr.nextElementSibling;
          if (!body) return;
          const open=body.style.display!=='none';
          body.style.display=open?'none':'';
          hdr.querySelector('.m-comp-arrow')?.classList.toggle('open',!open);
        });
      });
    },

    _vec3(label, prefix, v={x:0,y:0,z:0}) {
      const f=n=>(n||0).toFixed(2);
      return `
        <div class="m-prop-row">
          <div class="m-prop-label">${label}</div>
          <div class="m-vec3-row">
            <label class="m-x-label">X<input id="${prefix}-x" type="number" class="m-vec-input" value="${f(v.x)}" step="0.1"/></label>
            <label class="m-y-label">Y<input id="${prefix}-y" type="number" class="m-vec-input" value="${f(v.y)}" step="0.1"/></label>
            <label class="m-z-label">Z<input id="${prefix}-z" type="number" class="m-vec-input" value="${f(v.z)}" step="0.1"/></label>
          </div>
        </div>`;
    },

    _meshBlock(entity) {
      return `
        <div class="m-component-block">
          <div class="m-component-header">
            <svg class="m-comp-arrow open" width="10" height="10" viewBox="0 0 10 10"><path d="M2 3l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>
            <span class="m-comp-title">Mesh Renderer</span>
          </div>
          <div class="m-component-body">
            <div class="m-prop-row-inline">
              <span class="m-prop-label">Color</span>
              <input type="color" class="m-prop-color" id="m-mesh-color" value="#4488cc"/>
            </div>
            <div class="m-prop-row-inline">
              <span class="m-prop-label">Metalness</span>
              <input type="range" class="m-prop-slider" min="0" max="1" step="0.01"
                value="${entity.mesh?.material?.metalness??0.1}"
                oninput="if(window._mSelMesh)window._mSelMesh.material.metalness=+this.value"/>
            </div>
            <div class="m-prop-row-inline">
              <span class="m-prop-label">Roughness</span>
              <input type="range" class="m-prop-slider" min="0" max="1" step="0.01"
                value="${entity.mesh?.material?.roughness??0.5}"
                oninput="if(window._mSelMesh)window._mSelMesh.material.roughness=+this.value"/>
            </div>
            <div class="m-prop-row-inline">
              <span class="m-prop-label">Wireframe</span>
              <input type="checkbox" style="accent-color:var(--accent);width:18px;height:18px"
                ${entity.mesh?.material?.wireframe?'checked':''}
                onchange="if(window._mSelMesh)window._mSelMesh.material.wireframe=this.checked"/>
            </div>
          </div>
        </div>`;
    },

    clear() {
      if (!this.body) return;
      this.body.innerHTML=`
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
          padding:40px 20px;gap:10px;color:var(--text-dim)">
          <svg width="32" height="32" viewBox="0 0 32 32" opacity="0.3">
            <circle cx="16" cy="11" r="6" stroke="#888" stroke-width="1.5" fill="none"/>
            <path d="M6 28c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="#888" stroke-width="1.5" fill="none"/>
          </svg>
          <p style="font-size:13px">Tap an entity to inspect</p>
        </div>`;
    }
  };

  /* ══════════════════════════════════════
     DRAWER SYSTEM
  ══════════════════════════════════════ */
  const openDrawers = new Set();

  function openDrawer(id) {
    const drawer = document.getElementById(`m-drawer-${id}`);
    const overlay = document.getElementById('m-drawer-overlay');
    if (!drawer) return;
    // Close other drawers first
    openDrawers.forEach(d=>{ if(d!==id) closeDrawer(d); });
    drawer.classList.remove('hidden');
    overlay.classList.remove('hidden');
    openDrawers.add(id);
    Audio.tap();

    // Refresh content when opened
    if (id==='hierarchy') MobileHierarchy.refresh();
  }

  function closeDrawer(id) {
    const drawer = document.getElementById(`m-drawer-${id}`);
    if (drawer) drawer.classList.add('hidden');
    openDrawers.delete(id);
    if (openDrawers.size===0) {
      document.getElementById('m-drawer-overlay')?.classList.add('hidden');
    }
  }

  // Close buttons
  document.querySelectorAll('.m-drawer-close').forEach(btn=>{
    btn.addEventListener('click',()=>{
      Audio.tap();
      closeDrawer(btn.dataset.drawer);
    });
  });

  // Overlay tap closes all
  document.getElementById('m-drawer-overlay')?.addEventListener('click',()=>{
    openDrawers.forEach(d=>closeDrawer(d));
  });

  // Swipe down to close drawer
  let drawerSwipeStartY = 0;
  document.querySelectorAll('.m-drawer-handle').forEach(handle=>{
    const drawer = handle.parentElement;
    handle.addEventListener('touchstart', e=>{
      drawerSwipeStartY = e.touches[0].clientY;
    },{passive:true});
    handle.addEventListener('touchend', e=>{
      const dy = e.changedTouches[0].clientY - drawerSwipeStartY;
      if (dy > 50) { // swipe down 50px
        const drawerId = drawer.id.replace('m-drawer-','');
        closeDrawer(drawerId);
      }
    },{passive:true});
  });

  /* ══════════════════════════════════════
     CONSOLE
  ══════════════════════════════════════ */
  const mConsole = {
    output: document.getElementById('m-console-output'),
    counts: {log:0,warn:0,error:0},
    history: [], histIdx: -1,

    log(msg, type='log', src='Editor') {
      if (!this.output) return;
      const t=(performance.now()/1000).toFixed(3);
      const div=document.createElement('div');
      div.className=`m-log-entry ${type}`;
      div.innerHTML=`<span class="m-log-time">${t}</span><span class="m-log-msg">${msg}</span><span class="m-log-src">${src}</span>`;
      this.output.appendChild(div);
      this.output.scrollTop=this.output.scrollHeight;
      this.counts[type]=(this.counts[type]||0)+1;
    },

    clear() {
      if(this.output) this.output.innerHTML='';
      this.counts={log:0,warn:0,error:0};
      this.log('Console cleared','log','Console');
    },

    exec(cmd) {
      if (!cmd.trim()) return;
      this.history.unshift(cmd);
      this.histIdx=-1;
      this.log(`> ${cmd}`,'log','Console');
      try {
        const res=Function('"use strict";with(window.MEngineAPI||{})return('+cmd+')')();
        if(res!==undefined) this.log(JSON.stringify(res),'log','Console');
      } catch(e) { this.log(e.message,'error','Console'); }
    }
  };

  function mLog(msg, type='log', src='Editor') { mConsole.log(msg,type,src); }

  // Wire console
  document.getElementById('m-btn-clear-console')?.addEventListener('click',()=>{
    Audio.tap(); mConsole.clear();
  });

  document.getElementById('m-btn-console-run')?.addEventListener('click',()=>{
    const inp=document.getElementById('m-console-input');
    if(!inp) return;
    Audio.tap();
    mConsole.exec(inp.value);
    inp.value='';
  });

  document.getElementById('m-console-input')?.addEventListener('keydown',e=>{
    if(e.key==='Enter') document.getElementById('m-btn-console-run')?.click();
  });

  /* ══════════════════════════════════════
     SELECTION BAR
  ══════════════════════════════════════ */
  function updateSelectionBar(entity) {
    const nameEl=document.getElementById('m-selection-name');
    if(nameEl) nameEl.textContent=entity.name;
  }

  document.getElementById('m-btn-focus-sel')?.addEventListener('click',()=>{
    Audio.tap(); SceneView.focusSelected();
  });

  document.getElementById('m-btn-dup-sel')?.addEventListener('click',()=>{
    Audio.tap(); SceneView.duplicateSelected();
  });

  document.getElementById('m-btn-del-sel')?.addEventListener('click',()=>{
    Audio.tap(); SceneView.deleteSelected();
  });

  /* ══════════════════════════════════════
     TOOLBAR BUTTONS
  ══════════════════════════════════════ */
  // Primitives
  document.querySelectorAll('.m-tool-btn[data-prim]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      Audio.tap();
      SceneView.addPrimitive(btn.dataset.prim);
      closeAllDrawers();
    });
  });

  // Lights
  document.querySelectorAll('.m-tool-btn[data-light]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      Audio.tap();
      SceneView.addLight(btn.dataset.light);
    });
  });

  // Empty
  document.querySelectorAll('.m-tool-btn[data-special="empty"]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      Audio.tap();
      SceneData.add('Empty','empty',null);
      MobileHierarchy.refresh();
      toast('Empty added','success');
    });
  });

  // Transform tools
  document.querySelectorAll('.m-transform-tool').forEach(btn=>{
    btn.addEventListener('click',()=>{
      Audio.tap();
      SceneView.setTransformMode(btn.dataset.transform);
    });
  });

  // Panel buttons → open drawers
  document.getElementById('m-btn-hierarchy')?.addEventListener('click',()=>openDrawer('hierarchy'));
  document.getElementById('m-btn-inspector')?.addEventListener('click',()=>{
    const e=SceneData.getById(SceneData.selected);
    if(e) MobileInspector.update(e);
    openDrawer('inspector');
  });
  document.getElementById('m-btn-console-tab')?.addEventListener('click',()=>openDrawer('console'));
  document.getElementById('m-btn-assets')?.addEventListener('click',()=>openDrawer('assets'));
  document.getElementById('m-btn-build-mobile')?.addEventListener('click',()=>openDrawer('build'));
  document.getElementById('m-btn-gyro-mobile')?.addEventListener('click',()=>SceneView.toggleGyro());
  document.getElementById('m-btn-menu')?.addEventListener('click',()=>openDrawer('menu'));

  // Hierarchy add button
  document.getElementById('m-btn-add-entity-drawer')?.addEventListener('click',()=>{
    Audio.tap();
    SceneView.addPrimitive('cube');
  });

  // Asset folders
  document.querySelectorAll('.m-asset-folder').forEach(f=>{
    f.addEventListener('click',()=>{
      Audio.tap();
      document.querySelectorAll('.m-asset-folder').forEach(x=>x.classList.remove('active'));
      f.classList.add('active');
    });
  });

  // Asset items
  document.querySelectorAll('.m-asset-item').forEach(item=>{
    item.addEventListener('click',()=>{
      Audio.tap();
      document.querySelectorAll('.m-asset-item').forEach(x=>x.style.borderColor='');
      item.style.borderColor='var(--accent)';
    });
  });

  /* ══════════════════════════════════════
     TOP BAR BUTTONS
  ══════════════════════════════════════ */
  let playing=false, fpsInterval=null, frameCount=0;

  document.getElementById('m-btn-play')?.addEventListener('click',()=>{
    playing=true;
    document.getElementById('m-btn-play')?.classList.add('hidden');
    document.getElementById('m-btn-stop')?.classList.remove('hidden');
    document.getElementById('m-fps')?.classList.remove('hidden');
    Audio.success();
    toast('Playing','success');
    mLog('Play mode','log','Engine.js');

    fpsInterval=setInterval(()=>{
      const el=document.getElementById('m-fps');
      if(el) el.textContent=frameCount+' FPS';
      frameCount=0;
    },1000);
    (function tick(){if(!playing)return;frameCount++;requestAnimationFrame(tick);})();
  });

  document.getElementById('m-btn-stop')?.addEventListener('click',()=>{
    playing=false;
    document.getElementById('m-btn-play')?.classList.remove('hidden');
    document.getElementById('m-btn-stop')?.classList.add('hidden');
    document.getElementById('m-fps')?.classList.add('hidden');
    clearInterval(fpsInterval);
    Audio.error();
    toast('Stopped');
    mLog('Stopped','log','Engine.js');
  });

  document.getElementById('m-btn-undo')?.addEventListener('click',()=>{
    Audio.tap(); toast('Undo — v0.4','warn');
  });
  document.getElementById('m-btn-redo')?.addEventListener('click',()=>{
    Audio.tap(); toast('Redo — v0.4','warn');
  });

  /* ══════════════════════════════════════
     MENU ITEMS
  ══════════════════════════════════════ */
  document.querySelectorAll('.m-menu-item').forEach(item=>{
    item.addEventListener('click',()=>{
      Audio.tap();
      closeDrawer('menu');
      const a=item.dataset.action;
      if(a==='new-scene') {
        SceneData.entities=[]; SceneView._buildDefaultScene(); toast('New scene','success');
      } else if(a==='save-scene') {
        toast('Scene saved','success'); mLog('Scene saved','log','Scene.js');
      } else if(a==='build-web'||a==='build-android') {
        openDrawer('build');
      } else if(a==='toggle-grid') {
        SceneView.toggleGrid(true); toast('Grid toggled');
      } else if(a==='toggle-wireframe') {
        SceneView.toggleWireframe(true); toast('Wireframe toggled');
      } else if(a==='switch-desktop') {
        localStorage.removeItem('cengine-force-mobile');
        window.location.href='index.html';
      } else if(a==='about') {
        toast('CEngine v0.3 Mobile — Three.js + Touch','log',4000);
      } else {
        toast(`${a} coming soon`,'warn');
      }
    });
  });

  /* ══════════════════════════════════════
     BUILD
  ══════════════════════════════════════ */
  document.querySelectorAll('.m-build-platform').forEach(p=>{
    p.addEventListener('click',()=>{
      Audio.tap();
      document.querySelectorAll('.m-build-platform').forEach(b=>b.classList.remove('active'));
      p.classList.add('active');
    });
  });

  document.getElementById('m-btn-start-build')?.addEventListener('click',()=>{
    const name=document.getElementById('m-build-name')?.value||'My Game';
    const log=document.getElementById('m-build-log');
    if(!log) return;
    log.innerHTML='';
    Audio.tap();

    const steps=[
      {msg:`Compiling scene...`,delay:0},
      {msg:`Bundling scripts...`,delay:500},
      {msg:`Packaging assets...`,delay:1000},
      {msg:`Generating HTML5...`,delay:1500},
      {msg:`✓ Build complete!`,delay:2000,ok:true}
    ];

    steps.forEach(({msg,delay,ok})=>{
      setTimeout(()=>{
        const line=document.createElement('div');
        line.className='m-build-log-line'+(ok?' success':'');
        line.textContent=msg;
        log.appendChild(line);
        log.scrollTop=log.scrollHeight;
        if(ok) {
          Audio.success();
          toast(`Built: ${name}`,'success');
          setTimeout(()=>{
            closeDrawer('build');
            launchBuild(name);
          },600);
        }
      },delay);
    });
  });

  function launchBuild(name='My Game') {
    const entities=SceneData.entities.filter(e=>e.mesh).map(e=>({
      name:e.name, geo:e.mesh.geometry?.type||'BoxGeometry',
      color:'#'+(e.mesh.material?.color?.getHexString()||'4488cc'),
      px:e.mesh.position.x, py:e.mesh.position.y, pz:e.mesh.position.z,
      rx:e.mesh.rotation.x, ry:e.mesh.rotation.y, rz:e.mesh.rotation.z,
      sx:e.mesh.scale.x,    sy:e.mesh.scale.y,    sz:e.mesh.scale.z
    }));

    const html=`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<title>${name}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;overflow:hidden;width:100vw;height:100vh}
canvas{display:block;width:100%;height:100%}
#loader{position:fixed;inset:0;background:#0a0a0a;display:flex;flex-direction:column;
  align-items:center;justify-content:center;z-index:9999;transition:opacity 0.5s}
.ll{font-family:monospace;font-size:24px;font-weight:800;color:#00a4dc;letter-spacing:2px;margin-bottom:6px}
.ls{font-family:monospace;font-size:9px;color:#333;letter-spacing:4px;margin-bottom:24px}
.lb{width:160px;height:2px;background:#1a1a1a;overflow:hidden;border-radius:2px}
.lf{height:100%;background:#00a4dc;width:0%;transition:width 0.25s}
.lc{position:fixed;bottom:14px;font-family:monospace;font-size:8px;color:#222;letter-spacing:3px}
</style></head><body>
<div id="loader"><div class="ll">C<span style="color:#888;font-weight:400;font-size:18px">Engine</span></div>
<div class="ls">LOADING</div><div class="lb"><div class="lf" id="lf"></div></div>
<div class="lc">BUILT WITH CENGINE</div></div>
<canvas id="c"></canvas>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
const lf=document.getElementById('lf');let p=0;
const li=setInterval(()=>{p=Math.min(100,p+Math.random()*15+5);lf.style.width=p+'%';
if(p>=100){clearInterval(li);setTimeout(()=>{const lo=document.getElementById('loader');
lo.style.opacity='0';setTimeout(()=>lo.remove(),500);},200);}},80);

const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('c'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x111111);
scene.fog=new THREE.FogExp2(0x111111,0.016);
const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.1,1000);
scene.add(new THREE.AmbientLight(0x303040,1.8));
const dl=new THREE.DirectionalLight(0xfff0e0,2.2);
dl.position.set(8,14,6);dl.castShadow=true;scene.add(dl);
scene.add(new THREE.GridHelper(40,40,0x1e1e1e,0x181818));
const gm={BoxGeometry:()=>new THREE.BoxGeometry(1,1,1),
SphereGeometry:()=>new THREE.SphereGeometry(0.5,20,20),
CylinderGeometry:()=>new THREE.CylinderGeometry(0.5,0.5,1,20),
PlaneGeometry:()=>new THREE.PlaneGeometry(2,2),
ConeGeometry:()=>new THREE.ConeGeometry(0.5,1,20),
TorusGeometry:()=>new THREE.TorusGeometry(0.5,0.18,14,36)};
${JSON.stringify(entities)}.forEach(e=>{
const geo=(gm[e.geo]||gm.BoxGeometry)();
const mat=new THREE.MeshStandardMaterial({color:e.color,roughness:0.5,metalness:0.1});
const mesh=new THREE.Mesh(geo,mat);
mesh.position.set(e.px,e.py,e.pz);mesh.rotation.set(e.rx,e.ry,e.rz);mesh.scale.set(e.sx,e.sy,e.sz);
mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);});

let th=0.5,ph=1.0,rad=12,tch=false,tlx=0,tly=0,td=0;
const ot=new THREE.Vector3();
document.addEventListener('touchstart',e=>{
if(e.touches.length===1){tch=true;tlx=e.touches[0].clientX;tly=e.touches[0].clientY;}
if(e.touches.length===2){const dx=e.touches[0].clientX-e.touches[1].clientX;
const dy=e.touches[0].clientY-e.touches[1].clientY;td=Math.sqrt(dx*dx+dy*dy);}
e.preventDefault();},{passive:false});
document.addEventListener('touchmove',e=>{
if(e.touches.length===1&&tch){th-=(e.touches[0].clientX-tlx)*0.007;
ph=Math.max(0.05,Math.min(3.09,ph+(e.touches[0].clientY-tly)*0.007));
tlx=e.touches[0].clientX;tly=e.touches[0].clientY;}
if(e.touches.length===2){const dx=e.touches[0].clientX-e.touches[1].clientX;
const dy=e.touches[0].clientY-e.touches[1].clientY;const d=Math.sqrt(dx*dx+dy*dy);
rad=Math.max(1.5,Math.min(80,rad-(d-td)*0.04));td=d;}
e.preventDefault();},{passive:false});
document.addEventListener('touchend',()=>tch=false);
window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);
camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
function animate(){requestAnimationFrame(animate);
camera.position.set(ot.x+rad*Math.sin(ph)*Math.sin(th),ot.y+rad*Math.cos(ph),ot.z+rad*Math.sin(ph)*Math.cos(th));
camera.lookAt(ot);renderer.render(scene,camera);}
animate();
</script></body></html>`;

    const tab=window.open('','_blank');
    if(tab){tab.document.write(html);tab.document.close();}
    else toast('Allow popups to launch build','error');
  }

  function closeAllDrawers() {
    [...openDrawers].forEach(d=>closeDrawer(d));
  }

  /* ══════════════════════════════════════
     MOBILE API (console access)
  ══════════════════════════════════════ */
  window.MEngineAPI = {
    add:    type=>SceneView.addPrimitive(type),
    delete: ()=>SceneView.deleteSelected(),
    list:   ()=>SceneData.entities.map(e=>e.name),
    log:    msg=>mConsole.log(String(msg),'log','Script'),
    focus:  ()=>SceneView.focusSelected()
  };

  /* ══════════════════════════════════════
     SYNC _mSelMesh for inspector sliders
  ══════════════════════════════════════ */
  setInterval(()=>{
    const e=SceneData.getById(SceneData.selected);
    window._mSelMesh=e?.mesh||null;
  },100);

  /* ══════════════════════════════════════
     INIT
  ══════════════════════════════════════ */
  Audio.init();
  SceneView.init();
  MobileInspector.clear();

  setTimeout(()=>mLog('CEngine Mobile v0.3 ready','log','Engine.js'),100);
  setTimeout(()=>mLog('Three.js r128 renderer active','log','Renderer.js'),200);
  setTimeout(()=>mLog('Touch input system ready','log','Input.js'),300);
  setTimeout(()=>toast('CEngine Mobile — Ready','success',3000),500);

})();
