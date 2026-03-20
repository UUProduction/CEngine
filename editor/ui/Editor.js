
/* ═══════════════════════════════════════════
   CENGINE EDITOR.JS — Complete Rewrite v0.5
   All buttons wired, scene working, no deps
   ═══════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══════════════════════════════════════
     MOBILE REDIRECT
  ══════════════════════════════════════ */
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
  if (isMobile) { window.location.href = 'mobile.html'; return; }

  /* ══════════════════════════════════════
     AUDIO
  ══════════════════════════════════════ */
  const Audio = {
    ctx: null, muted: false, enabled: false,
    ambient: document.getElementById('audio-ambient'),

    init() {
      if (this.ambient) this.ambient.volume = 0.12;
      document.addEventListener('click', () => {
        if (this.enabled) return;
        this.enabled = true;
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
        this.ambient?.play().catch(()=>{});
      }, { once: true });
    },

    tone(freq=660, dur=0.08, vol=0.03, type='sine') {
      if (this.muted || !this.ctx) return;
      try {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.connect(g); g.connect(this.ctx.destination);
        o.type = type;
        o.frequency.setValueAtTime(freq, this.ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(freq * 0.75, this.ctx.currentTime + dur);
        g.gain.setValueAtTime(vol, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        o.start(); o.stop(this.ctx.currentTime + dur);
      } catch(e){}
    },

    click()   { this.tone(700, 0.05, 0.025); },
    success() { this.tone(880, 0.1, 0.04); setTimeout(() => this.tone(1100, 0.08, 0.03), 100); },
    error()   { this.tone(180, 0.2, 0.04, 'sawtooth'); },
    warn()    { this.tone(440, 0.1, 0.03); },

    toggle() {
      this.muted = !this.muted;
      if (this.ambient) this.ambient.muted = this.muted;
      document.getElementById('btn-audio-toggle')?.classList.toggle('active', !this.muted);
      toast(this.muted ? 'Audio muted' : 'Audio on');
    }
  };

  /* ══════════════════════════════════════
     TOAST
  ══════════════════════════════════════ */
  function toast(msg, type='log', dur=2400) {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${msg}</span>`;
    c.appendChild(el);
    if      (type === 'success') Audio.success();
    else if (type === 'error')   Audio.error();
    else if (type === 'warn')    Audio.warn();
    else                         Audio.tone(580, 0.07, 0.025);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, dur);
  }

  /* ══════════════════════════════════════
     CONSOLE
  ══════════════════════════════════════ */
  const Con = {
    el: null,
    counts: { log:0, warn:0, error:0 },
    history: [], histIdx: -1,

    init() { this.el = document.getElementById('console-output'); },

    log(msg, type='log', src='Editor.js') {
      if (!this.el) return;
      const t = (performance.now()/1000).toFixed(3);
      const div = document.createElement('div');
      div.className = `log-entry ${type}`;
      div.dataset.type = type;
      const svgs = {
        log:   `<svg class="log-icon" width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" stroke="#27ae60" stroke-width="1.2" fill="none"/></svg>`,
        warn:  `<svg class="log-icon" width="10" height="10" viewBox="0 0 10 10"><path d="M5 1l4 8H1z" stroke="#d4a017" stroke-width="1.2" fill="none"/></svg>`,
        error: `<svg class="log-icon" width="10" height="10" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6" stroke="#c0392b" stroke-width="1.2" stroke-linecap="round"/></svg>`
      };
      div.innerHTML = `${svgs[type]||svgs.log}<span class="log-time">${t}</span><span class="log-msg">${msg}</span><span class="log-source">${src}</span>`;
      this.el.appendChild(div);
      this.el.scrollTop = this.el.scrollHeight;
      this.counts[type] = (this.counts[type]||0) + 1;
      this._updateCounts();
    },

    _updateCounts() {
      const lc = document.getElementById('log-count');
      const wc = document.getElementById('warn-count-num');
      const ec = document.getElementById('error-count-num');
      if (lc) lc.textContent = this.counts.log;
      if (wc) wc.textContent = this.counts.warn;
      if (ec) ec.textContent = this.counts.error;
    },

    clear() {
      if (this.el) this.el.innerHTML = '';
      this.counts = { log:0, warn:0, error:0 };
      this._updateCounts();
      this.log('Console cleared', 'log', 'Console');
    },

    exec(cmd) {
      if (!cmd.trim()) return;
      this.history.unshift(cmd);
      this.histIdx = -1;
      this.log(`> ${cmd}`, 'log', 'Console');
      try {
        const res = Function('"use strict"; with(window.CEngineAPI||{}) return (' + cmd + ')')();
        if (res !== undefined) this.log(JSON.stringify(res), 'log', 'Console');
      } catch(e) { this.log(e.message, 'error', 'Console'); }
    }
  };

  /* ══════════════════════════════════════
     SCENE DATA
  ══════════════════════════════════════ */
  const Scene = {
    entities: [],
    selected: null,
    nextId: 1,

    add(name, type, mesh=null) {
      const e = {
        id: this.nextId++, name, type,
        active: true, mesh,
        position: {x:0,y:0,z:0},
        rotation: {x:0,y:0,z:0},
        scale:    {x:1,y:1,z:1},
        components: []
      };
      this.entities.push(e);
      return e;
    },

    getById(id) { return this.entities.find(e => e.id === id) || null; },

    remove(id) {
      const e = this.getById(id);
      if (e?.mesh) {
        SceneView.scene?.remove(e.mesh);
        e.mesh.geometry?.dispose();
        e.mesh.material?.dispose();
      }
      this.entities = this.entities.filter(x => x.id !== id);
      if (this.selected === id) {
        this.selected = null;
        Inspector.clear();
      }
    },

    select(id) {
      this.selected = id;
      const e = this.getById(id);
      if (e) {
        Inspector.update(e);
        SceneView.showGizmo(e);
        Hierarchy.selectItem(id);
      }
    },

    duplicate(id) {
      const e = this.getById(id);
      if (!e?.mesh) return null;
      const nm = e.mesh.clone();
      nm.position.x += 1.5;
      SceneView.scene?.add(nm);
      const ne = this.add(e.name + ' (Copy)', e.type, nm);
      ne.position = { x:nm.position.x, y:nm.position.y, z:nm.position.z };
      ne.rotation = { ...e.rotation };
      ne.scale    = { ...e.scale };
      return ne;
    }
  };

  /* ══════════════════════════════════════
     SCENE SAVE / LOAD
  ══════════════════════════════════════ */
  const Save = {
    KEY:       'cengine_scene_v1',
    FILES_KEY: 'cengine_files_v1',

    saveScene() {
      try {
        const data = {
          name:      document.getElementById('scene-name')?.textContent || 'Untitled Scene',
          timestamp: Date.now(),
          entities:  Scene.entities.map(e => ({
            id:   e.id, name: e.name, type: e.type, active: e.active,
            position: {...e.position}, rotation: {...e.rotation}, scale: {...e.scale},
            color:     e.mesh?.material?.color?.getHexString() || '4488cc',
            geometry:  e.mesh?.geometry?.type || 'BoxGeometry',
            metalness: e.mesh?.material?.metalness ?? 0.1,
            roughness: e.mesh?.material?.roughness ?? 0.5
          }))
        };
        localStorage.setItem(this.KEY, JSON.stringify(data));
        toast('Scene saved', 'success');
        Con.log('Scene saved — ' + data.entities.length + ' entities', 'log', 'Scene.js');
      } catch(e) { toast('Save failed: ' + e.message, 'error'); }
    },

    loadScene() {
      try {
        const raw = localStorage.getItem(this.KEY);
        if (!raw) { toast('No saved scene found', 'warn'); return; }
        const data = JSON.parse(raw);

        // Clear
        Scene.entities.forEach(e => {
          if (e.mesh) { SceneView.scene?.remove(e.mesh); e.mesh.geometry?.dispose(); e.mesh.material?.dispose(); }
        });
        Scene.entities = []; Scene.selected = null; Scene.nextId = 1;

        const geoMap = {
          BoxGeometry:      () => new THREE.BoxGeometry(1,1,1),
          SphereGeometry:   () => new THREE.SphereGeometry(0.5,24,24),
          CylinderGeometry: () => new THREE.CylinderGeometry(0.5,0.5,1,24),
          PlaneGeometry:    () => new THREE.PlaneGeometry(2,2),
          ConeGeometry:     () => new THREE.ConeGeometry(0.5,1,24),
          TorusGeometry:    () => new THREE.TorusGeometry(0.5,0.18,16,48)
        };

        data.entities.forEach(ed => {
          const mesh = new THREE.Mesh(
            (geoMap[ed.geometry] || geoMap.BoxGeometry)(),
            new THREE.MeshStandardMaterial({ color:'#'+ed.color, metalness:ed.metalness??0.1, roughness:ed.roughness??0.5 })
          );
          mesh.position.set(ed.position.x, ed.position.y, ed.position.z);
          mesh.rotation.set(
            THREE.MathUtils.degToRad(ed.rotation.x||0),
            THREE.MathUtils.degToRad(ed.rotation.y||0),
            THREE.MathUtils.degToRad(ed.rotation.z||0)
          );
          mesh.scale.set(ed.scale.x||1, ed.scale.y||1, ed.scale.z||1);
          mesh.castShadow = mesh.receiveShadow = true;
          mesh.visible = ed.active;
          SceneView.scene?.add(mesh);
          const entity = Scene.add(ed.name, ed.type, mesh);
          entity.id = ed.id; entity.active = ed.active;
          entity.position = {...ed.position};
          entity.rotation = {...ed.rotation};
          entity.scale    = {...ed.scale};
        });

        Scene.nextId = Math.max(...Scene.entities.map(e=>e.id), 0) + 1;
        const nameEl = document.getElementById('scene-name');
        if (nameEl) nameEl.textContent = data.name;
        Hierarchy.refresh();
        Inspector.clear();
        SceneView.gizmoGroup.visible = false;
        const ago = Math.round((Date.now()-data.timestamp)/1000);
        toast(`Scene loaded (saved ${ago}s ago)`, 'success');
        Con.log('Scene loaded — ' + data.entities.length + ' entities', 'log', 'Scene.js');
      } catch(e) { toast('Load failed: '+e.message, 'error'); Con.log(e.message,'error','Scene.js'); }
    },

    getFiles()         { try { return JSON.parse(localStorage.getItem(this.FILES_KEY)||'{}'); } catch(e) { return {}; } },
    saveFile(n,c,t)    { const f=this.getFiles(); f[n]={name:n,content:c,type:t,modified:Date.now()}; localStorage.setItem(this.FILES_KEY,JSON.stringify(f)); },
    loadFile(n)        { return this.getFiles()[n]||null; },
    deleteFile(n)      { const f=this.getFiles(); delete f[n]; localStorage.setItem(this.FILES_KEY,JSON.stringify(f)); },
    getFileList()      { return Object.values(this.getFiles()); }
  };

  /* ══════════════════════════════════════
     THREE.JS SCENE VIEW
  ══════════════════════════════════════ */
  const SceneView = {
    renderer: null, scene: null, camera: null,
    gizmoRenderer: null, gizmoScene: null, gizmoCamera: null,
    gizmoGroup: null, raycaster: null, mouse: null, grid: null,

    // Camera orbit
    theta: 0.5, phi: 1.0, radius: 12,
    target: null,

    // Orbit drag
    orbitDrag: false, orbitLX: 0, orbitLY: 0,

    // Transform drag
    transformMode: 'translate',
    tDrag: false, tStartX: 0, tStartY: 0,
    tStartPos: null, tStartRot: null, tStartScl: null,
    tJustDone: false,

    // Touch
    touchOrbit: false, tLX: 0, tLY: 0, tDist: 0,
    touchTransform: false, txStartX: 0, txStartY: 0,
    txStartPos: null, txStartRot: null, txStartScl: null,

    // Gyro
    gyroEnabled: false,

    init() {
      const canvas = document.getElementById('scene-canvas');
      if (!canvas || typeof THREE === 'undefined') {
        Con.log('THREE.js not available', 'error', 'SceneView.js');
        return;
      }

      this.raycaster = new THREE.Raycaster();
      this.mouse     = new THREE.Vector2();
      this.target    = new THREE.Vector3(0, 0, 0);

      // Renderer
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping       = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.1;

      // Scene
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x111111);
      this.scene.fog = new THREE.FogExp2(0x111111, 0.016);

      // Camera
      this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
      this._syncCam();

      // Lights
      this.scene.add(new THREE.AmbientLight(0x303040, 1.8));
      const dl = new THREE.DirectionalLight(0xfff0e0, 2.2);
      dl.position.set(8, 14, 6);
      dl.castShadow = true;
      dl.shadow.mapSize.set(2048, 2048);
      dl.shadow.camera.near = 0.1; dl.shadow.camera.far = 80;
      dl.shadow.camera.left = dl.shadow.camera.bottom = -20;
      dl.shadow.camera.right = dl.shadow.camera.top = 20;
      this.scene.add(dl);
      const fill = new THREE.PointLight(0x204060, 1.2, 30);
      fill.position.set(-8, 4, -6);
      this.scene.add(fill);

      // Grid
      this.grid = new THREE.GridHelper(40, 40, 0x1e1e1e, 0x181818);
      this.scene.add(this.grid);

      // Ground
      const gnd = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 1 })
      );
      gnd.rotation.x = -Math.PI / 2;
      gnd.receiveShadow = true;
      this.scene.add(gnd);

      // Gizmo + transform arrows
      this._initGizmoViewport();
      this._initTransformGizmo();

      // Events
      this._bindOrbit(canvas);
      this._bindTransformDrag(canvas);
      this._initGyro();

      window.addEventListener('resize', () => this._resize());
      this._resize();

      // Default scene
      this._defaultScene();

      // Loop
      this._loop();

      Con.log('SceneView ready', 'log', 'SceneView.js');
    },

    _defaultScene() {
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 })
      );
      floor.position.y = -0.1;
      floor.receiveShadow = true;
      this.scene.add(floor);
      const fe = Scene.add('Floor', 'mesh', floor);
      fe.position = { x:0, y:-0.1, z:0 };

      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x4488cc, roughness: 0.4, metalness: 0.2 })
      );
      cube.position.y = 0.5;
      cube.castShadow = cube.receiveShadow = true;
      this.scene.add(cube);
      const ce = Scene.add('Cube', 'mesh', cube);
      ce.position = { x:0, y:0.5, z:0 };

      Hierarchy.refresh();
    },

    _syncCam() {
      if (!this.camera || !this.target) return;
      this.camera.position.set(
        this.target.x + this.radius * Math.sin(this.phi) * Math.sin(this.theta),
        this.target.y + this.radius * Math.cos(this.phi),
        this.target.z + this.radius * Math.sin(this.phi) * Math.cos(this.theta)
      );
      this.camera.lookAt(this.target);
    },

    _initGizmoViewport() {
      const gc = document.getElementById('gizmo-canvas');
      if (!gc) return;
      this.gizmoRenderer = new THREE.WebGLRenderer({ canvas: gc, alpha: true, antialias: true });
      this.gizmoRenderer.setSize(70, 70);
      this.gizmoScene  = new THREE.Scene();
      this.gizmoCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      this.gizmoCamera.position.set(0, 0, 3);
      const axes = [
        { dir: new THREE.Vector3(1,0,0), color: 0xcc3333 },
        { dir: new THREE.Vector3(0,1,0), color: 0x33aa33 },
        { dir: new THREE.Vector3(0,0,1), color: 0x3366cc }
      ];
      axes.forEach(({ dir, color }) => {
        const mat = new THREE.MeshBasicMaterial({ color, depthTest: false });
        const q   = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.7,8), mat);
        const tip  = new THREE.Mesh(new THREE.ConeGeometry(0.13,0.3,8), mat);
        body.position.copy(dir.clone().multiplyScalar(0.35)); body.quaternion.copy(q);
        tip.position.copy(dir.clone().multiplyScalar(0.85));  tip.quaternion.copy(q);
        this.gizmoScene.add(body, tip);
      });
    },

    _initTransformGizmo() {
      this.gizmoGroup = new THREE.Group();
      this.gizmoGroup.visible = false;
      this.gizmoGroup.renderOrder = 999;
      const axes = [
        { dir: new THREE.Vector3(1,0,0), color: 0xdd2222 },
        { dir: new THREE.Vector3(0,1,0), color: 0x22aa22 },
        { dir: new THREE.Vector3(0,0,1), color: 0x2244dd }
      ];
      axes.forEach(({ dir, color }) => {
        const mat = new THREE.MeshBasicMaterial({ color, depthTest: false });
        const q   = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,1.0,8), mat.clone());
        const tip  = new THREE.Mesh(new THREE.ConeGeometry(0.09,0.24,8), mat.clone());
        body.position.copy(dir.clone().multiplyScalar(0.5)); body.quaternion.copy(q);
        tip.position.copy(dir.clone().multiplyScalar(1.12)); tip.quaternion.copy(q);
        this.gizmoGroup.add(body, tip);
      });
      this.scene.add(this.gizmoGroup);
    },

    showGizmo(entity) {
      if (!entity?.mesh) { this.gizmoGroup.visible = false; return; }
      this.gizmoGroup.visible = true;
      this.gizmoGroup.position.copy(entity.mesh.position);
    },

    /* ── Orbit ── */
    _bindOrbit(canvas) {
      canvas.addEventListener('mousedown', e => {
        if (e.button === 2) {
          this.orbitDrag = true;
          this.orbitLX = e.clientX; this.orbitLY = e.clientY;
          canvas.style.cursor = 'grabbing';
          e.preventDefault();
        }
      });
      document.addEventListener('mousemove', e => {
        if (!this.orbitDrag) return;
        this.theta -= (e.clientX - this.orbitLX) * 0.007;
        this.phi    = Math.max(0.05, Math.min(Math.PI-0.05, this.phi + (e.clientY - this.orbitLY) * 0.007));
        this.orbitLX = e.clientX; this.orbitLY = e.clientY;
        this._syncCam();
      });
      document.addEventListener('mouseup', e => {
        if (e.button === 2) { this.orbitDrag = false; canvas.style.cursor = ''; }
      });
      canvas.addEventListener('contextmenu', e => e.preventDefault());
      canvas.addEventListener('wheel', e => {
        this.radius = Math.max(1.5, Math.min(100, this.radius + e.deltaY * 0.022));
        this._syncCam(); e.preventDefault();
      }, { passive: false });

      // Touch orbit + zoom
      canvas.addEventListener('touchstart', e => {
        if (e.touches.length === 1) {
          this.touchOrbit = true;
          this.tLX = e.touches[0].clientX; this.tLY = e.touches[0].clientY;
        }
        if (e.touches.length === 2) {
          this.touchOrbit = false;
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          this.tDist = Math.sqrt(dx*dx + dy*dy);
        }
        e.preventDefault();
      }, { passive: false });

      canvas.addEventListener('touchmove', e => {
        if (e.touches.length === 1 && this.touchOrbit && !this.touchTransform) {
          const dx = e.touches[0].clientX - this.tLX;
          const dy = e.touches[0].clientY - this.tLY;
          this.theta -= dx * 0.007;
          this.phi    = Math.max(0.05, Math.min(Math.PI-0.05, this.phi + dy * 0.007));
          this.tLX = e.touches[0].clientX; this.tLY = e.touches[0].clientY;
          this._syncCam();
        }
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          this.radius = Math.max(1.5, Math.min(100, this.radius - (dist - this.tDist) * 0.04));
          this.tDist = dist;
          this._syncCam();
        }
        e.preventDefault();
      }, { passive: false });

      canvas.addEventListener('touchend', e => {
        if (e.touches.length === 0) { this.touchOrbit = false; this.touchTransform = false; this.txStartPos = null; }
      });

      // WASD pan
      const keys = {};
      document.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
      document.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });
      setInterval(() => {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        const spd = 0.05;
        const fwd   = new THREE.Vector3(-Math.sin(this.theta), 0, -Math.cos(this.theta));
        const right = new THREE.Vector3(Math.cos(this.theta), 0, -Math.sin(this.theta));
        if (keys['w']) { this.target.addScaledVector(fwd, spd); this._syncCam(); }
        if (keys['s']) { this.target.addScaledVector(fwd, -spd); this._syncCam(); }
        if (keys['a']) { this.target.addScaledVector(right, -spd); this._syncCam(); }
        if (keys['d']) { this.target.addScaledVector(right, spd); this._syncCam(); }
        if (keys['q']) { this.target.y -= spd; this._syncCam(); }
        if (keys['e']) { this.target.y += spd; this._syncCam(); }
      }, 16);
    },

    /* ── Transform drag ── */
    _bindTransformDrag(canvas) {
      const THRESH = 4;

      const applyDelta = (entity, dx, dy) => {
        const sens   = this.radius * 0.0035;
        const cRight = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
        const cUp    = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1).normalize();

        if (this.transformMode === 'translate') {
          entity.mesh.position.copy(this.tStartPos);
          entity.mesh.position.addScaledVector(cRight,  dx * sens);
          entity.mesh.position.addScaledVector(cUp,    -dy * sens);
          entity.position = { x:entity.mesh.position.x, y:entity.mesh.position.y, z:entity.mesh.position.z };
        } else if (this.transformMode === 'rotate') {
          entity.mesh.rotation.y = this.tStartRot.y + dx * 0.012;
          entity.mesh.rotation.x = this.tStartRot.x + dy * 0.012;
          entity.rotation = {
            x: THREE.MathUtils.radToDeg(entity.mesh.rotation.x),
            y: THREE.MathUtils.radToDeg(entity.mesh.rotation.y),
            z: THREE.MathUtils.radToDeg(entity.mesh.rotation.z)
          };
        } else if (this.transformMode === 'scale') {
          const f = Math.max(0.01, 1 + dx * 0.009);
          entity.mesh.scale.copy(this.tStartScl).multiplyScalar(f);
          entity.scale = { x:entity.mesh.scale.x, y:entity.mesh.scale.y, z:entity.mesh.scale.z };
        }

        this.gizmoGroup.position.copy(entity.mesh.position);
        Inspector.update(entity);
      };

      // Mouse
      let mSX = 0, mSY = 0, mDragging = false;

      canvas.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        mSX = e.clientX; mSY = e.clientY; mDragging = false;
        const entity = Scene.getById(Scene.selected);
        if (!entity?.mesh) return;
        this.tStartPos = entity.mesh.position.clone();
        this.tStartRot = { x:entity.mesh.rotation.x, y:entity.mesh.rotation.y, z:entity.mesh.rotation.z };
        this.tStartScl = entity.mesh.scale.clone();
      });

      document.addEventListener('mousemove', e => {
        if (this.orbitDrag || !this.tStartPos) return;
        const dx = e.clientX - mSX, dy = e.clientY - mSY;
        if (!mDragging && Math.sqrt(dx*dx+dy*dy) < THRESH) return;
        mDragging = true; this.tDrag = true;
        const entity = Scene.getById(Scene.selected);
        if (entity?.mesh) applyDelta(entity, dx, dy);
      });

      document.addEventListener('mouseup', e => {
        if (e.button !== 0) return;
        if (mDragging) {
          this.tJustDone = true;
          setTimeout(() => { this.tJustDone = false; }, 60);
          const entity = Scene.getById(Scene.selected);
          if (entity) Con.log(`Transformed: ${entity.name}`, 'log', 'Transform.js');
        }
        mDragging = false; this.tDrag = false;
        this.tStartPos = null; this.tStartRot = null; this.tStartScl = null;
      });

      // Click to select
      canvas.addEventListener('click', e => {
        if (this.tJustDone) return;
        const rect = canvas.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const meshes = Scene.entities.filter(e => e.mesh && e.active).map(e => e.mesh);
        const hits   = this.raycaster.intersectObjects(meshes, true);
        if (hits.length > 0) {
          let hit = hits[0].object;
          while (hit.parent && hit.parent !== this.scene) {
            if (Scene.entities.find(e => e.mesh === hit)) break;
            hit = hit.parent;
          }
          const entity = Scene.entities.find(e => e.mesh === hit);
          if (entity) { Scene.select(entity.id); Audio.click(); }
        } else {
          Scene.selected = null;
          Inspector.clear();
          this.gizmoGroup.visible = false;
          Hierarchy.clearSelection();
        }
      });

      // Touch transform
      let txDragging = false, txSX = 0, txSY = 0;

      canvas.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return;
        const entity = Scene.getById(Scene.selected);
        if (!entity?.mesh) return;
        const t = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const mx = ((t.clientX - rect.left) / rect.width) * 2 - 1;
        const my = -((t.clientY - rect.top) / rect.height) * 2 + 1;
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(mx, my), this.camera);
        const hits = ray.intersectObject(entity.mesh, true);
        if (hits.length > 0) {
          txSX = t.clientX; txSY = t.clientY; txDragging = false;
          this.touchTransform = false;
          this.txStartPos = entity.mesh.position.clone();
          this.txStartRot = { x:entity.mesh.rotation.x, y:entity.mesh.rotation.y, z:entity.mesh.rotation.z };
          this.txStartScl = entity.mesh.scale.clone();
          this.touchOrbit = false;
        }
      }, { passive: true });

      canvas.addEventListener('touchmove', e => {
        if (e.touches.length !== 1 || !this.txStartPos) return;
        const t = e.touches[0];
        const dx = t.clientX - txSX, dy = t.clientY - txSY;
        if (!txDragging && Math.sqrt(dx*dx+dy*dy) < THRESH) return;
        txDragging = true; this.touchTransform = true; this.touchOrbit = false;
        const entity = Scene.getById(Scene.selected);
        if (!entity?.mesh) return;
        const prevP = this.tStartPos, prevR = this.tStartRot, prevS = this.tStartScl;
        this.tStartPos = this.txStartPos; this.tStartRot = this.txStartRot; this.tStartScl = this.txStartScl;
        applyDelta(entity, dx, dy);
        this.tStartPos = prevP; this.tStartRot = prevR; this.tStartScl = prevS;
      }, { passive: true });

      canvas.addEventListener('touchend', () => {
        txDragging = false; this.touchTransform = false; this.txStartPos = null;
      });
    },

    /* ── Gyro ── */
    _initGyro() {
      const start = () => {
        window.addEventListener('deviceorientation', e => {
          if (!this.gyroEnabled) return;
          const beta  = THREE.MathUtils.degToRad(e.beta  || 0);
          const alpha = THREE.MathUtils.degToRad(e.alpha || 0);
          this.phi   = THREE.MathUtils.lerp(this.phi, Math.max(0.1, Math.min(Math.PI-0.1, beta)), 0.08);
          this.theta = THREE.MathUtils.lerp(this.theta, -alpha * 0.5, 0.04);
          this._syncCam();
        }, true);
      };
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        window._requestGyro = () => DeviceOrientationEvent.requestPermission()
          .then(s => { if (s === 'granted') { start(); this.gyroEnabled = true; } }).catch(console.error);
      } else { start(); }
    },

    toggleGyro() {
      if (window._requestGyro && !this.gyroEnabled) { window._requestGyro(); toast('Gyro enabled','success'); }
      else { this.gyroEnabled = !this.gyroEnabled; toast(this.gyroEnabled ? 'Gyro ON' : 'Gyro OFF'); }
    },

    /* ── Primitives ── */
    addPrimitive(type) {
      const geos = {
        cube:     () => new THREE.BoxGeometry(1,1,1),
        sphere:   () => new THREE.SphereGeometry(0.5,24,24),
        cylinder: () => new THREE.CylinderGeometry(0.5,0.5,1,24),
        plane:    () => new THREE.PlaneGeometry(2,2),
        cone:     () => new THREE.ConeGeometry(0.5,1,24),
        torus:    () => new THREE.TorusGeometry(0.5,0.18,16,48)
      };
      const colors = { cube:0x4488cc, sphere:0xcc6633, cylinder:0x44aa66, plane:0x888888, cone:0xccaa22, torus:0xcc4488 };
      const geo  = (geos[type] || geos.cube)();
      const mat  = new THREE.MeshStandardMaterial({ color:colors[type]||0x888888, roughness:0.5, metalness:0.1 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      if (type === 'plane') { mesh.rotation.x = -Math.PI/2; mesh.position.y = 0.01; }
      else mesh.position.set((Math.random()-0.5)*3, 0.5, (Math.random()-0.5)*3);
      this.scene.add(mesh);
      const name   = type.charAt(0).toUpperCase() + type.slice(1);
      const entity = Scene.add(name, 'mesh', mesh);
      entity.position = { x:mesh.position.x, y:mesh.position.y, z:mesh.position.z };
      Hierarchy.refresh();
      Scene.select(entity.id);
      Audio.tone(880, 0.1, 0.04);
      toast('Added ' + name, 'success');
      Con.log('Added: ' + name, 'log', 'Scene.js');
      return entity;
    },

    addLight(type) {
      let light;
      const name = type==='point'?'Point Light':type==='spot'?'Spot Light':'Dir Light';
      if      (type==='point') { light=new THREE.PointLight(0xffffff,1.5,20); light.position.set(2,4,2); this.scene.add(new THREE.PointLightHelper(light,0.3)); }
      else if (type==='spot')  { light=new THREE.SpotLight(0xffffff,2,30,Math.PI/5); light.position.set(0,7,0); this.scene.add(new THREE.SpotLightHelper(light)); }
      else                     { light=new THREE.DirectionalLight(0xffffff,1.5); light.position.set(4,7,4); this.scene.add(new THREE.DirectionalLightHelper(light,1)); }
      this.scene.add(light);
      Scene.add(name, 'light', null);
      Hierarchy.refresh();
      toast('Added ' + name, 'success');
      Audio.tone(660, 0.1, 0.03);
    },

    deleteSelected() {
      if (!Scene.selected) return;
      Scene.remove(Scene.selected);
      this.gizmoGroup.visible = false;
      Hierarchy.refresh();
      toast('Deleted', 'warn');
    },

    duplicateSelected() {
      const ne = Scene.duplicate(Scene.selected);
      if (!ne) return;
      Hierarchy.refresh();
      Scene.select(ne.id);
      toast('Duplicated: ' + ne.name, 'success');
    },

    focusSelected() {
      const e = Scene.getById(Scene.selected);
      if (!e?.mesh) return;
      this.target.copy(e.mesh.position);
      this.radius = 4;
      this._syncCam();
    },

    setTransformMode(mode) {
      this.transformMode = mode;
      // Sync toolbar buttons
      document.querySelectorAll('.transform-tool').forEach(b => b.classList.toggle('active', b.dataset.transform === mode));
      document.getElementById('btn-translate')?.classList.toggle('active', mode==='translate');
      document.getElementById('btn-rotate')?.classList.toggle('active', mode==='rotate');
      document.getElementById('btn-scale')?.classList.toggle('active', mode==='scale');
    },

    toggleGrid(v) { if (this.grid) this.grid.visible = v; },
    toggleWireframe(v) { Scene.entities.forEach(e => { if (e.mesh?.material) e.mesh.material.wireframe = v; }); },

    _resize() {
      const canvas = document.getElementById('scene-canvas');
      if (!canvas || !this.renderer) return;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    },

    _loop() {
      requestAnimationFrame(() => this._loop());
      if (!this.renderer) return;

      // Sync gizmo to selected
      if (this.gizmoGroup.visible) {
        const sel = Scene.getById(Scene.selected);
        if (sel?.mesh) {
          this.gizmoGroup.position.copy(sel.mesh.position);
          const dist = this.camera.position.distanceTo(sel.mesh.position);
          this.gizmoGroup.scale.setScalar(dist * 0.1);
        }
      }

      this.renderer.render(this.scene, this.camera);

      // Gizmo viewport
      if (this.gizmoRenderer && this.gizmoScene && this.gizmoCamera) {
        const dir = new THREE.Vector3().subVectors(this.camera.position, this.target).normalize().multiplyScalar(3);
        this.gizmoCamera.position.copy(dir);
        this.gizmoCamera.lookAt(0, 0, 0);
        this.gizmoRenderer.render(this.gizmoScene, this.gizmoCamera);
      }
    }
  };

  /* ══════════════════════════════════════
     HIERARCHY
  ══════════════════════════════════════ */
  const Hierarchy = {
    get tree() { return document.getElementById('scene-children'); },

    refresh() {
      const tree = this.tree;
      if (!tree) return;
      tree.innerHTML = '';
      Scene.entities.forEach(entity => {
        const item = document.createElement('div');
        item.className = 'tree-item' + (Scene.selected === entity.id ? ' selected' : '');
        item.dataset.entityId = entity.id;
        const icons = {
          mesh:  `<svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1l5 3v4l-5 3-5-3V4z" stroke="#6688cc" stroke-width="1.2" fill="none"/></svg>`,
          light: `<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="5" r="2.5" stroke="#ccaa33" stroke-width="1.2" fill="none"/><path d="M6 8v2M3 7l-1 1M9 7l1 1" stroke="#ccaa33" stroke-width="1.2"/></svg>`,
          empty: `<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4" stroke="#555" stroke-width="1.2" fill="none" stroke-dasharray="2 2"/></svg>`
        };
        item.innerHTML = `
          <span class="tree-indent"></span>
          <svg class="tree-arrow invisible" width="8" height="8" viewBox="0 0 8 8"><path d="M2 2l4 2-4 2" fill="currentColor"/></svg>
          ${icons[entity.type]||icons.empty}
          <span class="tree-label">${entity.name}</span>
          <button class="tree-eye" title="Toggle visibility">
            <svg width="10" height="10" viewBox="0 0 10 10"><ellipse cx="5" cy="5" rx="4" ry="2.5" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="5" cy="5" r="1.2" fill="currentColor"/></svg>
          </button>`;

        item.addEventListener('click', e => {
          if (e.target.closest('.tree-eye')) return;
          Audio.click();
          Scene.select(entity.id);
        });

        item.querySelector('.tree-eye').addEventListener('click', e => {
          e.stopPropagation();
          entity.active = !entity.active;
          if (entity.mesh) entity.mesh.visible = entity.active;
          item.querySelector('.tree-eye').style.opacity = entity.active ? '1' : '0.3';
          Audio.click();
        });

        item.addEventListener('contextmenu', e => {
          e.preventDefault();
          Scene.select(entity.id);
          ContextMenu.show(e.clientX, e.clientY);
        });

        tree.appendChild(item);
      });
    },

    selectItem(id) {
      document.querySelectorAll('.tree-item[data-entity-id]').forEach(el => {
        el.classList.toggle('selected', parseInt(el.dataset.entityId) === id);
      });
    },

    clearSelection() {
      document.querySelectorAll('.tree-item[data-entity-id]').forEach(el => el.classList.remove('selected'));
    }
  };

  /* ══════════════════════════════════════
     INSPECTOR
  ══════════════════════════════════════ */
  const Inspector = {
    get body() { return document.getElementById('inspector-body'); },

    update(entity) {
      const body = this.body;
      if (!body) return;

      body.innerHTML = `
        <div class="inspector-entity-header">
          <input type="checkbox" id="ent-active" ${entity.active?'checked':''} style="accent-color:var(--accent);cursor:pointer"/>
          <input type="text" class="entity-name-input" id="ent-name" value="${entity.name}"/>
          <span class="entity-tag">${entity.type}</span>
        </div>

        <div class="component-block">
          <div class="component-header">
            <svg class="comp-arrow open" width="8" height="8" viewBox="0 0 8 8"><path d="M1 2l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
            <span class="component-title">Transform</span>
          </div>
          <div class="component-body">
            ${this._vec3('Position','pos',entity.position)}
            ${this._vec3('Rotation','rot',entity.rotation)}
            ${this._vec3('Scale','scl',entity.scale)}
          </div>
        </div>

        ${entity.type==='mesh' ? this._meshBlock(entity) : ''}
        ${entity.type==='light' ? this._lightBlock() : ''}

        <div class="add-component-area">
          <button class="add-component-btn" id="btn-add-comp">
            <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1v9M1 5.5h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Add Component
          </button>
        </div>`;

      // Wire transform inputs
      [['pos','position'],['rot','rotation'],['scl','scale']].forEach(([prefix,key]) => {
        ['x','y','z'].forEach(axis => {
          const inp = document.getElementById(`${prefix}-${axis}`);
          if (!inp) return;
          inp.addEventListener('input', () => {
            const v = parseFloat(inp.value) || 0;
            entity[key][axis] = v;
            if (entity.mesh) {
              if (key==='position') entity.mesh.position[axis] = v;
              if (key==='rotation') entity.mesh.rotation[axis] = THREE.MathUtils.degToRad(v);
              if (key==='scale')    entity.mesh.scale[axis]    = v;
              SceneView.gizmoGroup.position.copy(entity.mesh.position);
            }
          });
        });
      });

      document.getElementById('ent-name')?.addEventListener('input', function() {
        entity.name = this.value;
        Hierarchy.refresh();
        Hierarchy.selectItem(entity.id);
      });

      document.getElementById('ent-active')?.addEventListener('change', function() {
        entity.active = this.checked;
        if (entity.mesh) entity.mesh.visible = this.checked;
      });

      const colorPick = document.getElementById('mesh-color');
      if (colorPick && entity.mesh?.material) {
        colorPick.value = '#' + entity.mesh.material.color.getHexString();
        colorPick.addEventListener('input', function() { entity.mesh.material.color.set(this.value); });
      }

      // Sliders
      body.querySelectorAll('input[type="range"][data-mat]').forEach(sl => {
        sl.addEventListener('input', function() {
          if (entity.mesh?.material) entity.mesh.material[this.dataset.mat] = parseFloat(this.value);
        });
      });

      body.querySelectorAll('input[type="checkbox"][data-mat]').forEach(cb => {
        cb.addEventListener('change', function() {
          if (entity.mesh?.material) entity.mesh.material[this.dataset.mat] = this.checked;
        });
      });

      document.querySelectorAll('.component-header').forEach(hdr => {
        hdr.addEventListener('click', () => {
          Audio.click();
          const b = hdr.nextElementSibling;
          if (!b) return;
          const open = b.style.display !== 'none';
          b.style.display = open ? 'none' : '';
          hdr.querySelector('.comp-arrow')?.classList.toggle('open', !open);
        });
      });

      document.getElementById('btn-add-comp')?.addEventListener('click', () => {
        Audio.click();
        toast('Component picker — coming in v0.5', 'warn');
      });
    },

    _vec3(label, prefix, v={x:0,y:0,z:0}) {
      const f = n => (n||0).toFixed(3);
      return `<div class="prop-row">
        <span class="prop-label">${label}</span>
        <div class="vec3-inputs">
          <label class="x-label">X<input id="${prefix}-x" type="number" class="vec-input" value="${f(v.x)}" step="0.1"/></label>
          <label class="y-label">Y<input id="${prefix}-y" type="number" class="vec-input" value="${f(v.y)}" step="0.1"/></label>
          <label class="z-label">Z<input id="${prefix}-z" type="number" class="vec-input" value="${f(v.z)}" step="0.1"/></label>
        </div>
      </div>`;
    },

    _meshBlock(entity) {
      const metal = entity.mesh?.material?.metalness ?? 0.1;
      const rough = entity.mesh?.material?.roughness ?? 0.5;
      return `<div class="component-block">
        <div class="component-header">
          <svg class="comp-arrow open" width="8" height="8" viewBox="0 0 8 8"><path d="M1 2l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
          <span class="component-title">Mesh Renderer</span>
        </div>
        <div class="component-body">
          <div class="prop-row">
            <span class="prop-label">Color</span>
            <input type="color" class="prop-color" id="mesh-color" value="#4488cc"/>
          </div>
          <div class="prop-row">
            <span class="prop-label">Metalness</span>
            <input type="range" class="prop-slider" min="0" max="1" step="0.01" value="${metal}" data-mat="metalness"/>
          </div>
          <div class="prop-row">
            <span class="prop-label">Roughness</span>
            <input type="range" class="prop-slider" min="0" max="1" step="0.01" value="${rough}" data-mat="roughness"/>
          </div>
          <div class="prop-row">
            <span class="prop-label">Wireframe</span>
            <input type="checkbox" ${entity.mesh?.material?.wireframe?'checked':''} data-mat="wireframe" style="accent-color:var(--accent);cursor:pointer"/>
          </div>
          <div class="prop-row">
            <span class="prop-label">Cast Shadow</span>
            <input type="checkbox" ${entity.mesh?.castShadow?'checked':''} style="accent-color:var(--accent);cursor:pointer"
              onchange="const e=window._selEntity;if(e?.mesh)e.mesh.castShadow=this.checked"/>
          </div>
        </div>
      </div>`;
    },

    _lightBlock() {
      return `<div class="component-block">
        <div class="component-header">
          <svg class="comp-arrow open" width="8" height="8" viewBox="0 0 8 8"><path d="M1 2l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
          <span class="component-title">Light</span>
        </div>
        <div class="component-body">
          <div class="prop-row"><span class="prop-label">Color</span><input type="color" class="prop-color" value="#ffffff"/></div>
          <div class="prop-row"><span class="prop-label">Intensity</span><input type="range" class="prop-slider" min="0" max="5" step="0.1" value="1.5"/><span class="prop-value">1.5</span></div>
        </div>
      </div>`;
    },

    clear() {
      const body = this.body;
      if (!body) return;
      body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:var(--text-dim);padding:20px">
        <svg width="28" height="28" viewBox="0 0 28 28" opacity="0.3"><circle cx="14" cy="10" r="5" stroke="#888" stroke-width="1.5" fill="none"/><path d="M5 24c0-5 4-8 9-8s9 3 9 8" stroke="#888" stroke-width="1.5" fill="none"/></svg>
        <p style="font-size:11px">Select an entity</p>
        <p style="font-size:10px">to inspect properties</p>
      </div>`;
    }
  };

  /* ══════════════════════════════════════
     INSERT TOOLBAR
  ══════════════════════════════════════ */
  function buildInsertToolbar() {
    const menubar = document.getElementById('menubar');
    if (!menubar || document.getElementById('insert-toolbar')) return;

    const bar = document.createElement('div');
    bar.id = 'insert-toolbar';
    bar.innerHTML = `
      <span class="insert-label">Insert</span>
      <div class="insert-group">
        <button class="insert-btn" data-prim="cube"><svg width="13" height="13" viewBox="0 0 13 13"><path d="M6.5 1.5l5 2.5v5.5l-5 2.5-5-2.5V4z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>Cube</button>
        <button class="insert-btn" data-prim="sphere"><svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.2" fill="none"/><ellipse cx="6.5" cy="6.5" rx="5" ry="2" stroke="currentColor" stroke-width="0.8" fill="none"/></svg>Sphere</button>
        <button class="insert-btn" data-prim="cylinder"><svg width="13" height="13" viewBox="0 0 13 13"><ellipse cx="6.5" cy="4" rx="4" ry="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/><ellipse cx="6.5" cy="10" rx="4" ry="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="2.5" y1="4" x2="2.5" y2="10" stroke="currentColor" stroke-width="1.2"/><line x1="10.5" y1="4" x2="10.5" y2="10" stroke="currentColor" stroke-width="1.2"/></svg>Cyl</button>
        <button class="insert-btn" data-prim="plane"><svg width="13" height="13" viewBox="0 0 13 13"><path d="M1 9l5.5-3.5L12 9H1z" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M1 9v1.5h11V9" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>Plane</button>
        <button class="insert-btn" data-prim="cone"><svg width="13" height="13" viewBox="0 0 13 13"><path d="M6.5 1.5l5 9h-10z" stroke="currentColor" stroke-width="1.2" fill="none"/><ellipse cx="6.5" cy="10.5" rx="5" ry="1.5" stroke="currentColor" stroke-width="1" fill="none"/></svg>Cone</button>
        <button class="insert-btn" data-prim="torus"><svg width="13" height="13" viewBox="0 0 13 13"><ellipse cx="6.5" cy="6.5" rx="5" ry="2.5" stroke="currentColor" stroke-width="1.2" fill="none"/><ellipse cx="6.5" cy="6.5" rx="2.5" ry="1.2" stroke="currentColor" stroke-width="0.8" fill="none" opacity="0.5"/></svg>Torus</button>
      </div>
      <div class="insert-divider"></div>
      <div class="insert-group">
        <button class="insert-btn" data-light="point"><svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="6" r="2.5" stroke="#ccaa44" stroke-width="1.2" fill="none"/><path d="M6.5 1.5v1.5M6.5 10v1.5M1.5 6h1.5M10 6h1.5M3 3l1 1M9 9l1 1M3 9l1-1M9 3l1-1" stroke="#ccaa44" stroke-width="1.1"/></svg>Point</button>
        <button class="insert-btn" data-light="spot"><svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="4.5" r="2" stroke="#ccaa44" stroke-width="1.2" fill="none"/><path d="M4.5 7.5l-2 4M8.5 7.5l2 4M4.5 7.5h4" stroke="#ccaa44" stroke-width="1.1"/></svg>Spot</button>
        <button class="insert-btn" data-light="dir"><svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="5" r="2" stroke="#ccaa44" stroke-width="1.2" fill="none"/><path d="M6.5 8v4M4 9l-2 3M9 9l2 3" stroke="#ccaa44" stroke-width="1.1"/></svg>Dir</button>
        <button class="insert-btn" data-special="empty"><svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.2" fill="none" stroke-dasharray="2 2"/></svg>Empty</button>
      </div>
      <div class="insert-divider"></div>
      <div class="insert-group" id="transform-tools-group">
        <button class="insert-btn transform-tool active" data-transform="translate"><svg width="13" height="13" viewBox="0 0 13 13"><path d="M6.5 1v11M1 6.5h11M6.5 1l-2 3h4L6.5 1zM6.5 12l-2-3h4l-2 3zM1 6.5l3-2v4L1 6.5zM12 6.5l-3-2v4l3-2z" stroke="currentColor" stroke-width="1.1" fill="none"/></svg>Move</button>
        <button class="insert-btn transform-tool" data-transform="rotate"><svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M6.5 2 A4.5 4.5 0 0 1 11 6.5" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M10 4.5l1 2 2-1" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>Rotate</button>
        <button class="insert-btn transform-tool" data-transform="scale"><svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1" width="5" height="5" stroke="currentColor" stroke-width="1.2" fill="none"/><rect x="7" y="7" width="5" height="5" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M6 4h3M9 4v3" stroke="currentColor" stroke-width="1.2"/></svg>Scale</button>
      </div>
      <div class="insert-divider"></div>
      <div class="insert-group">
        <button class="insert-btn danger-btn" id="btn-del"><svg width="13" height="13" viewBox="0 0 13 13"><path d="M2.5 4h8M5 4V2.5h3V4M4 4v7h5V4M5.5 6v3M7.5 6v3" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>Delete</button>
        <button class="insert-btn" id="btn-dup"><svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="4" width="7" height="8" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M4 4V3a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H9" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>Dup</button>
        <button class="insert-btn" id="btn-focus"><svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="6.5" r="2.5" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M1 4V1h3M9 1h3v3M12 9v3H9M4 12H1V9" stroke="currentColor" stroke-width="1.2"/></svg>Focus</button>
        <button class="insert-btn gyro-btn" id="btn-gyro"><svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.2" fill="none"/><ellipse cx="6.5" cy="6.5" rx="5" ry="2" stroke="currentColor" stroke-width="0.8" fill="none" opacity="0.6"/><circle cx="6.5" cy="6.5" r="1.2" fill="currentColor"/></svg>Gyro</button>
      </div>`;

    menubar.parentNode.insertBefore(bar, menubar.nextSibling);

    // Bind all insert buttons
    bar.querySelectorAll('.insert-btn[data-prim]').forEach(btn => {
      btn.addEventListener('click', () => { Audio.click(); SceneView.addPrimitive(btn.dataset.prim); });
    });
    bar.querySelectorAll('.insert-btn[data-light]').forEach(btn => {
      btn.addEventListener('click', () => { Audio.click(); SceneView.addLight(btn.dataset.light); });
    });
    bar.querySelectorAll('.insert-btn[data-special]').forEach(btn => {
      btn.addEventListener('click', () => {
        Audio.click();
        Scene.add('Empty', 'empty', null);
        Hierarchy.refresh();
        toast('Empty created', 'success');
      });
    });
    bar.querySelectorAll('.transform-tool').forEach(btn => {
      btn.addEventListener('click', () => {
        Audio.click();
        bar.querySelectorAll('.transform-tool').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        SceneView.setTransformMode(btn.dataset.transform);
        toast('Mode: ' + btn.dataset.transform, 'log', 1000);
      });
    });

    document.getElementById('btn-del')?.addEventListener('click', () => { Audio.error(); SceneView.deleteSelected(); });
    document.getElementById('btn-dup')?.addEventListener('click', () => { Audio.click(); SceneView.duplicateSelected(); });
    document.getElementById('btn-focus')?.addEventListener('click', () => { Audio.click(); SceneView.focusSelected(); });
    document.getElementById('btn-gyro')?.addEventListener('click', () => {
      Audio.click();
      SceneView.toggleGyro();
      document.getElementById('btn-gyro')?.classList.toggle('active');
    });
  }

  /* ══════════════════════════════════════
     CONTEXT MENU
  ══════════════════════════════════════ */
  const ContextMenu = {
    el: document.getElementById('context-menu'),
    show(x, y) {
      if (!this.el) return;
      this.el.style.left = Math.min(x, innerWidth-170) + 'px';
      this.el.style.top  = Math.min(y, innerHeight-160) + 'px';
      this.el.classList.remove('hidden');
    },
    hide() { this.el?.classList.add('hidden'); }
  };

  document.addEventListener('click', () => ContextMenu.hide());

  document.querySelectorAll('.ctx-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      Audio.click();
      ContextMenu.hide();
      const a = item.dataset.action;
      if      (a === 'delete')       SceneView.deleteSelected();
      else if (a === 'duplicate')    SceneView.duplicateSelected();
      else if (a === 'focus-entity') SceneView.focusSelected();
      else if (a === 'add-child')    SceneView.addPrimitive('cube');
      else toast(a + ' coming soon', 'warn');
    });
  });

  /* ══════════════════════════════════════
     DROPDOWN MENUS
  ══════════════════════════════════════ */
  const Menus = {
    file:       document.getElementById('menu-file'),
    edit:       document.getElementById('menu-edit'),
    assets:     document.getElementById('menu-assets'),
    gameobject: document.getElementById('menu-gameobject'),
    component:  document.getElementById('menu-component'),
    build:      document.getElementById('menu-build'),
    window:     document.getElementById('menu-window'),
    help:       document.getElementById('menu-help')
  };

  let openMenu = null;

  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      Audio.click();
      const menu = Menus[item.dataset.menu];
      if (!menu) return;
      if (openMenu === menu) { closeMenus(); return; }
      closeMenus();
      const rect = item.getBoundingClientRect();
      menu.style.left = rect.left + 'px';
      menu.classList.remove('hidden');
      item.classList.add('open');
      openMenu = menu;
      document.getElementById('dropdown-overlay')?.classList.remove('hidden');
    });
  });

  function closeMenus() {
    Object.values(Menus).forEach(m => m?.classList.add('hidden'));
    document.querySelectorAll('.menu-item.open').forEach(m => m.classList.remove('open'));
    document.getElementById('dropdown-overlay')?.classList.add('hidden');
    openMenu = null;
  }

  document.getElementById('dropdown-overlay')?.addEventListener('click', closeMenus);

  // All menu actions in one map
  const actionMap = {
    'new-scene':       () => { if(confirm('New scene? Unsaved changes will be lost.')) { Scene.entities.forEach(e=>{if(e.mesh){SceneView.scene?.remove(e.mesh);e.mesh.geometry?.dispose();e.mesh.material?.dispose();}}); Scene.entities=[];Scene.selected=null;Scene.nextId=1; SceneView._defaultScene(); toast('New scene','success'); } },
    'save-scene':      () => Save.saveScene(),
    'load-scene':      () => Save.loadScene(),
    'build-settings':  () => openBuildModal(),
    'export':          () => openBuildModal(),
    'build-web':       () => openBuildModal('web'),
    'build-android':   () => openBuildModal('android'),
    'build-desktop':   () => openBuildModal('desktop'),
    'build-run':       () => { openBuildModal(); setTimeout(()=>document.getElementById('btn-start-build')?.click(), 400); },
    'undo':            () => toast('Undo — coming in v0.5','warn'),
    'redo':            () => toast('Redo — coming in v0.5','warn'),
    'duplicate':       () => SceneView.duplicateSelected(),
    'delete-selected': () => SceneView.deleteSelected(),
    'preferences':     () => toast('Preferences — coming in v0.5','warn'),
    'import-asset':    () => toast('Import dialog — coming in v0.5','warn'),
    'create-script':   () => { FileTree?.init(); document.querySelector('.center-tab[data-tab="code"]')?.click(); },
    'create-material': () => toast('Material editor — coming in v0.5','warn'),
    'create-shader':   () => toast('Shader editor — coming in v0.5','warn'),
    'refresh':         () => { Hierarchy.refresh(); toast('Refreshed','log'); },
    'create-empty':    () => { Scene.add('Empty','empty',null); Hierarchy.refresh(); toast('Empty created','success'); },
    'add-cube':        () => SceneView.addPrimitive('cube'),
    'add-sphere':      () => SceneView.addPrimitive('sphere'),
    'add-cylinder':    () => SceneView.addPrimitive('cylinder'),
    'add-plane':       () => SceneView.addPrimitive('plane'),
    'add-cone':        () => SceneView.addPrimitive('cone'),
    'add-torus':       () => SceneView.addPrimitive('torus'),
    'add-light-point': () => SceneView.addLight('point'),
    'add-light-spot':  () => SceneView.addLight('spot'),
    'add-light-dir':   () => SceneView.addLight('dir'),
    'create-camera':   () => toast('Camera entity — coming in v0.5','warn'),
    'add-rigidbody':   () => toast('Rigidbody — attach in play mode','warn'),
    'add-collider':    () => toast('Collider — attach in play mode','warn'),
    'add-script':      () => document.querySelector('.center-tab[data-tab="code"]')?.click(),
    'add-audio-source':() => toast('Audio Source — coming in v0.5','warn'),
    'add-particle-emitter':()=> toast('Particle Emitter — use the VFX tab','log'),
    'toggle-hierarchy':() => { const p=document.getElementById('panel-hierarchy'); if(p) p.style.display=p.style.display==='none'?'':'none'; },
    'toggle-inspector':() => { const p=document.getElementById('panel-inspector'); if(p) p.style.display=p.style.display==='none'?'':'none'; },
    'toggle-console':  () => document.querySelector('.bottom-tab[data-tab="console"]')?.click(),
    'toggle-project':  () => document.querySelector('.bottom-tab[data-tab="project"]')?.click(),
    'reset-layout':    () => location.reload(),
    'docs':            () => window.open('https://github.com','_blank'),
    'scripting-api':   () => window.open('https://github.com','_blank'),
    'about':           () => toast('CEngine v0.4 — Three.js + Monaco + Rapier','log',5000),
    'exit':            () => { if(confirm('Exit CEngine?')) window.close(); }
  };

  document.querySelectorAll('.dd-item[data-action]').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      Audio.click();
      closeMenus();
      (actionMap[item.dataset.action] || (() => toast(item.dataset.action+' coming soon','warn')))();
    });
  });

  /* ══════════════════════════════════════
     CENTER TABS
  ══════════════════════════════════════ */
  document.querySelectorAll('.center-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      Audio.click();
      document.querySelectorAll('.center-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab)?.classList.add('active');
      if (tab.dataset.tab === 'code') FileTree?.init();
      if (tab.dataset.tab === 'scene') setTimeout(() => SceneView._resize(), 50);
    });
  });

  /* ══════════════════════════════════════
     BOTTOM TABS
  ══════════════════════════════════════ */
  document.querySelectorAll('.bottom-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      Audio.click();
      document.querySelectorAll('.bottom-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.btab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('btab-' + tab.dataset.tab)?.classList.add('active');
      if (tab.dataset.tab === 'audio') window.SoundEngine?.buildEditorPanel();
    });
  });

  /* ══════════════════════════════════════
     PLAY CONTROLS
  ══════════════════════════════════════ */
  let playing = false, fpsInterval = null, frameCount = 0;

  document.getElementById('btn-play')?.addEventListener('click', async () => {
    if (window.CEngineRuntime) {
      const { Physics, Input, ScriptRuntime, GameLoop, makeSceneAPI } = window.CEngineRuntime;
      document.getElementById('btn-play').disabled  = true;
      document.getElementById('btn-pause').disabled = false;
      document.getElementById('btn-stop').disabled  = false;
      document.getElementById('btn-play').classList.add('playing');
      toast('Starting...', 'log', 1000);

      const physOK = await Physics.init();
      Scene.entities.forEach(entity => {
        if (entity.type==='mesh' && entity.name!=='Floor') Physics.addBody(entity,'dynamic');
        if (entity.name==='Floor') Physics.addBody(entity,'fixed');
      });
      window.ParticleSystem?.setScene(SceneView.scene);

      const sceneAPI = makeSceneAPI(Scene.entities, { scene:SceneView.scene, THREE }, (msg,t,s)=>Con.log(msg,t,s));
      Input.init();
      ScriptRuntime.init(Scene.entities, sceneAPI);

      playing = true;
      Audio.success();
      toast('Playing', 'success');
      Con.log('Play mode — physics: '+(physOK?'Rapier':'fallback'), 'log', 'Engine.js');

      fpsInterval = setInterval(() => {
        document.getElementById('fps-counter').textContent = frameCount + ' FPS';
        frameCount = 0;
      }, 1000);

      GameLoop.start(dt => {
        if (!playing) return;
        frameCount++;
        Input.tick();
        if (physOK) { Physics.step(dt); Physics.syncToMeshes(Scene.entities); }
        else Physics.stepFallback(Scene.entities, dt);
        ScriptRuntime.update(dt);
        window.ParticleSystem?.update(dt);
        const sel = Scene.getById(Scene.selected);
        if (sel) Inspector.update(sel);
      });
    } else {
      // Simple play mode without runtime
      playing = true;
      document.getElementById('btn-play').disabled  = true;
      document.getElementById('btn-pause').disabled = false;
      document.getElementById('btn-stop').disabled  = false;
      document.getElementById('btn-play').classList.add('playing');
      Audio.success();
      toast('Playing', 'success');
      fpsInterval = setInterval(() => {
        document.getElementById('fps-counter').textContent = frameCount + ' FPS';
        frameCount = 0;
      }, 1000);
      (function tick() { if(!playing) return; frameCount++; requestAnimationFrame(tick); })();
    }
  });

  document.getElementById('btn-pause')?.addEventListener('click', () => {
    playing = !playing;
    Audio.warn();
    toast(playing ? 'Resumed' : 'Paused');
  });

  document.getElementById('btn-stop')?.addEventListener('click', () => {
    playing = false;
    if (window.CEngineRuntime) {
      const { Physics, ScriptRuntime, GameLoop } = window.CEngineRuntime;
      GameLoop.stop();
      ScriptRuntime.stop();
      window.ParticleSystem?.stopAll();
      Scene.entities.forEach(e => Physics.removeBody(e.id));
    }
    document.getElementById('btn-play').disabled  = false;
    document.getElementById('btn-pause').disabled = true;
    document.getElementById('btn-stop').disabled  = true;
    document.getElementById('btn-play').classList.remove('playing');
    document.getElementById('fps-counter').textContent = '-- FPS';
    clearInterval(fpsInterval);
    Audio.error();
    toast('Stopped');
    Con.log('Stopped', 'log', 'Engine.js');
  });

  /* ══════════════════════════════════════
     TOOLBAR BUTTONS (menubar)
  ══════════════════════════════════════ */
  document.getElementById('btn-translate')?.addEventListener('click', () => { Audio.click(); SceneView.setTransformMode('translate'); document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active')); document.getElementById('btn-translate').classList.add('active'); });
  document.getElementById('btn-rotate')?.addEventListener('click',    () => { Audio.click(); SceneView.setTransformMode('rotate');    document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active')); document.getElementById('btn-rotate').classList.add('active'); });
  document.getElementById('btn-scale')?.addEventListener('click',     () => { Audio.click(); SceneView.setTransformMode('scale');     document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active')); document.getElementById('btn-scale').classList.add('active'); });
  document.getElementById('btn-audio-toggle')?.addEventListener('click', () => Audio.toggle());
  document.getElementById('btn-build-quick')?.addEventListener('click',  () => openBuildModal());
  document.getElementById('btn-focus-scene')?.addEventListener('click',  () => SceneView.focusSelected());
  document.getElementById('btn-frame-all')?.addEventListener('click',    () => { SceneView.target.set(0,0,0); SceneView.radius=12; SceneView._syncCam(); });

  /* ══════════════════════════════════════
     SCENE VIEW TOGGLES
  ══════════════════════════════════════ */
  document.getElementById('toggle-grid')?.addEventListener('change', function() { SceneView.toggleGrid(this.checked); });
  document.getElementById('render-mode')?.addEventListener('change', function() { Audio.click(); SceneView.toggleWireframe(this.value==='Wireframe'); Con.log('Render: '+this.value,'log','Renderer.js'); });

  /* ══════════════════════════════════════
     HIERARCHY SEARCH + ADD
  ══════════════════════════════════════ */
  document.getElementById('hierarchy-search')?.addEventListener('input', function() {
    const q = this.value.toLowerCase();
    document.querySelectorAll('.tree-item[data-entity-id]').forEach(el => {
      const name = el.querySelector('.tree-label')?.textContent.toLowerCase() || '';
      el.style.display = name.includes(q) ? '' : 'none';
    });
  });

  document.getElementById('btn-add-entity')?.addEventListener('click', () => {
    Audio.click();
    SceneView.addPrimitive('cube');
  });

  /* ══════════════════════════════════════
     PROJECT PANEL
  ══════════════════════════════════════ */
  document.querySelectorAll('.proj-folder').forEach(f => {
    f.addEventListener('click', () => {
      Audio.click();
      document.querySelectorAll('.proj-folder').forEach(x => x.classList.remove('active'));
      f.classList.add('active');
    });
  });

  document.querySelectorAll('.file-item').forEach(file => {
    file.addEventListener('click', () => {
      Audio.click();
      document.querySelectorAll('.file-item').forEach(x => x.classList.remove('selected'));
      file.classList.add('selected');
      if (file.dataset.type === 'script') {
        document.querySelector('.center-tab[data-tab="code"]')?.click();
      }
    });
  });

  /* ══════════════════════════════════════
     CONSOLE
  ══════════════════════════════════════ */
  document.getElementById('btn-clear-console')?.addEventListener('click', () => { Audio.click(); Con.clear(); });

  document.getElementById('btn-console-run')?.addEventListener('click', () => {
    const inp = document.getElementById('console-input');
    if (!inp) return;
    Audio.tone(660, 0.07, 0.03);
    Con.exec(inp.value);
    inp.value = '';
  });

  document.getElementById('console-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-console-run')?.click();
    if (e.key === 'ArrowUp')   { Con.histIdx = Math.min(Con.histIdx+1, Con.history.length-1); e.target.value = Con.history[Con.histIdx]||''; }
    if (e.key === 'ArrowDown') { Con.histIdx = Math.max(Con.histIdx-1,-1); e.target.value = Con.histIdx>=0?Con.history[Con.histIdx]:''; }
  });

  document.querySelectorAll('.console-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      Audio.click();
      document.querySelectorAll('.console-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.filter;
      document.querySelectorAll('.log-entry').forEach(el => {
        el.style.display = (f==='all'||el.dataset.type===f) ? '' : 'none';
      });
    });
  });

  document.getElementById('console-filter-input')?.addEventListener('input', function() {
    const q = this.value.toLowerCase();
    document.querySelectorAll('.log-entry').forEach(el => {
      el.style.display = (el.querySelector('.log-msg')?.textContent.toLowerCase()||'').includes(q) ? '' : 'none';
    });
  });

  /* ══════════════════════════════════════
     BUILD MODAL
  ══════════════════════════════════════ */
  function openBuildModal(platform='web') {
    Audio.click();
    document.getElementById('build-modal')?.classList.remove('hidden');
    document.getElementById('modal-overlay')?.classList.remove('hidden');
    document.querySelectorAll('.build-platform').forEach(p => p.classList.remove('active'));
    document.querySelector(`.build-platform[data-platform="${platform}"]`)?.classList.add('active');
  }

  function closeBuildModal() {
    Audio.click();
    document.getElementById('build-modal')?.classList.add('hidden');
    document.getElementById('modal-overlay')?.classList.add('hidden');
  }

  document.getElementById('btn-close-build')?.addEventListener('click', closeBuildModal);
  document.getElementById('btn-close-build-2')?.addEventListener('click', closeBuildModal);
  document.getElementById('modal-overlay')?.addEventListener('click', closeBuildModal);

  document.querySelectorAll('.build-platform').forEach(p => {
    p.addEventListener('click', () => {
      Audio.click();
      document.querySelectorAll('.build-platform').forEach(b => b.classList.remove('active'));
      p.classList.add('active');
    });
  });

  document.getElementById('btn-start-build')?.addEventListener('click', () => {
    const name = document.getElementById('build-game-name')?.value || 'My Game';
    const log  = document.getElementById('build-log');
    if (!log) return;
    log.innerHTML = '';
    const steps = [
      { msg:'Compiling scene...', delay:0 },
      { msg:'Bundling scripts...', delay:500 },
      { msg:'Packaging assets...', delay:1000 },
      { msg:'Generating HTML5 output...', delay:1500 },
      { msg:'✓ Build complete: '+name, delay:2100, ok:true }
    ];
    steps.forEach(({ msg, delay, ok }) => {
      setTimeout(() => {
        const line = document.createElement('div');
        line.className = 'build-log-line' + (ok?' success':'');
        line.textContent = msg;
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
        if (ok) {
          Audio.success();
          toast('Build complete: '+name, 'success');
          setTimeout(() => { closeBuildModal(); launchBuild(name); }, 500);
        }
      }, delay);
    });
  });

  document.getElementById('btn-build-and-run')?.addEventListener('click', () => {
    document.getElementById('btn-start-build')?.click();
  });

  function launchBuild(name='My Game') {
    const entities = Scene.entities.filter(e=>e.mesh).map(e=>({
      name:e.name, geo:e.mesh.geometry?.type||'BoxGeometry',
      color:'#'+(e.mesh.material?.color?.getHexString()||'4488cc'),
      px:e.mesh.position.x, py:e.mesh.position.y, pz:e.mesh.position.z,
      rx:e.mesh.rotation.x, ry:e.mesh.rotation.y, rz:e.mesh.rotation.z,
      sx:e.mesh.scale.x, sy:e.mesh.scale.y, sz:e.mesh.scale.z
    }));
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/><title>${name}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;overflow:hidden;width:100vw;height:100vh}canvas{display:block;width:100%;height:100%}#loader{position:fixed;inset:0;background:#0a0a0a;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;transition:opacity 0.5s}.ll{font-family:monospace;font-size:24px;font-weight:800;color:#00a4dc;letter-spacing:2px;margin-bottom:6px}.ls{font-family:monospace;font-size:9px;color:#333;letter-spacing:4px;margin-bottom:24px}.lb{width:160px;height:2px;background:#1a1a1a;overflow:hidden;border-radius:2px}.lf{height:100%;background:#00a4dc;width:0%;transition:width 0.25s}.lc{position:fixed;bottom:14px;font-family:monospace;font-size:8px;color:#222;letter-spacing:3px}#hud{position:fixed;top:10px;left:12px;font-family:monospace;color:#555;font-size:11px;pointer-events:none}</style></head><body><div id="loader"><div class="ll">C<span style="color:#888;font-weight:400;font-size:18px">Engine</span></div><div class="ls">LOADING</div><div class="lb"><div class="lf" id="lf"></div></div><div class="lc">BUILT WITH CENGINE</div></div><canvas id="c"></canvas><div id="hud">${name}</div><script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script><script>const lf=document.getElementById('lf');let p=0;const li=setInterval(()=>{p=Math.min(100,p+Math.random()*15+5);lf.style.width=p+'%';if(p>=100){clearInterval(li);setTimeout(()=>{const lo=document.getElementById('loader');lo.style.opacity='0';setTimeout(()=>lo.remove(),500);},200);}},80);const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('c'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;const scene=new THREE.Scene();scene.background=new THREE.Color(0x111111);scene.fog=new THREE.FogExp2(0x111111,0.016);const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.1,1000);scene.add(new THREE.AmbientLight(0x303040,1.8));const dl=new THREE.DirectionalLight(0xfff0e0,2.2);dl.position.set(8,14,6);dl.castShadow=true;scene.add(dl);scene.add(new THREE.GridHelper(40,40,0x1e1e1e,0x181818));const gm={BoxGeometry:()=>new THREE.BoxGeometry(1,1,1),SphereGeometry:()=>new THREE.SphereGeometry(0.5,20,20),CylinderGeometry:()=>new THREE.CylinderGeometry(0.5,0.5,1,20),PlaneGeometry:()=>new THREE.PlaneGeometry(2,2),ConeGeometry:()=>new THREE.ConeGeometry(0.5,1,20),TorusGeometry:()=>new THREE.TorusGeometry(0.5,0.18,14,36)};${JSON.stringify(entities)}.forEach(e=>{const geo=(gm[e.geo]||gm.BoxGeometry)();const mat=new THREE.MeshStandardMaterial({color:e.color,roughness:0.5,metalness:0.1});const mesh=new THREE.Mesh(geo,mat);mesh.position.set(e.px,e.py,e.pz);mesh.rotation.set(e.rx,e.ry,e.rz);mesh.scale.set(e.sx,e.sy,e.sz);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);});let th=0.5,ph=1.0,rad=12,drag=false,lx=0,ly=0;const ot=new THREE.Vector3();document.addEventListener('mousedown',e=>{if(e.button===2){drag=true;lx=e.clientX;ly=e.clientY;}});document.addEventListener('mouseup',()=>drag=false);document.addEventListener('contextmenu',e=>e.preventDefault());document.addEventListener('mousemove',e=>{if(!drag)return;th-=(e.clientX-lx)*0.007;ph=Math.max(0.05,Math.min(3.09,ph+(e.clientY-ly)*0.007));lx=e.clientX;ly=e.clientY;});document.addEventListener('wheel',e=>{rad=Math.max(1.5,Math.min(80,rad+e.deltaY*0.022));});let tch=false,tlx=0,tly=0,td=0;document.addEventListener('touchstart',e=>{if(e.touches.length===1){tch=true;tlx=e.touches[0].clientX;tly=e.touches[0].clientY;}if(e.touches.length===2){const dx=e.touches[0].clientX-e.touches[1].clientX;const dy=e.touches[0].clientY-e.touches[1].clientY;td=Math.sqrt(dx*dx+dy*dy);}e.preventDefault();},{passive:false});document.addEventListener('touchmove',e=>{if(e.touches.length===1&&tch){th-=(e.touches[0].clientX-tlx)*0.007;ph=Math.max(0.05,Math.min(3.09,ph+(e.touches[0].clientY-tly)*0.007));tlx=e.touches[0].clientX;tly=e.touches[0].clientY;}if(e.touches.length===2){const dx=e.touches[0].clientX-e.touches[1].clientX;const dy=e.touches[0].clientY-e.touches[1].clientY;const d=Math.sqrt(dx*dx+dy*dy);rad=Math.max(1.5,Math.min(80,rad-(d-td)*0.04));td=d;}e.preventDefault();},{passive:false});document.addEventListener('touchend',()=>tch=false);window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});function animate(){requestAnimationFrame(animate);camera.position.set(ot.x+rad*Math.sin(ph)*Math.sin(th),ot.y+rad*Math.cos(ph),ot.z+rad*Math.sin(ph)*Math.cos(th));camera.lookAt(ot);renderer.render(scene,camera);}animate();</script></body></html>`;
    const tab = window.open('','_blank');
    if (tab) { tab.document.write(html); tab.document.close(); }
    else toast('Allow popups to launch build','error');
  }

  /* ══════════════════════════════════════
     RESIZE HANDLES
  ══════════════════════════════════════ */
  function makeResizable(handleId, targetId, dir, min, invert=false) {
    const handle = document.getElementById(handleId);
    const target = document.getElementById(targetId);
    if (!handle || !target) return;
    let drag=false, start=0, startSize=0;
    handle.addEventListener('mousedown', e => {
      drag=true; start=dir==='h'?e.clientX:e.clientY;
      startSize=dir==='h'?target.offsetWidth:target.offsetHeight;
      handle.classList.add('dragging');
      document.body.style.cursor=dir==='h'?'col-resize':'row-resize';
      document.body.style.userSelect='none';
    });
    document.addEventListener('mousemove', e => {
      if (!drag) return;
      const delta = dir==='h'?e.clientX-start:e.clientY-start;
      const size  = Math.max(min, startSize+(invert?-delta:delta));
      target.style[dir==='h'?'width':'height'] = size+'px';
      SceneView._resize();
    });
    document.addEventListener('mouseup', () => {
      if (!drag) return;
      drag=false; handle.classList.remove('dragging');
      document.body.style.cursor=document.body.style.userSelect='';
      SceneView._resize();
    });
  }

  makeResizable('resize-left',   'panel-hierarchy', 'h', 150);
  makeResizable('resize-right',  'panel-inspector', 'h', 200, true);
  makeResizable('resize-bottom', 'panel-bottom',    'v', 120, true);

  /* ══════════════════════════════════════
     MONACO CODE EDITOR + FILE TREE
  ══════════════════════════════════════ */
  const FileTree = {
    openTabs: [], activeTab: null, ready: false,

    init() {
      if (this.ready) return;
      this.ready = true;
      const codeTab = document.getElementById('tab-code');
      if (!codeTab || document.getElementById('code-layout')) return;

      // Seed default files
      if (Save.getFileList().length === 0) {
        const defaults = [
          { name:'PlayerController.js', type:'script', content:`// PlayerController.js\nclass PlayerController {\n  onStart() {\n    this.speed = 5;\n    this.jumpForce = 8;\n    CEngine.log('Player ready');\n  }\n  onUpdate(dt) {\n    if (Input.held('ArrowRight')) this.transform.position.x += this.speed * dt;\n    if (Input.held('ArrowLeft'))  this.transform.position.x -= this.speed * dt;\n    if (Input.held('ArrowUp'))    this.transform.position.z -= this.speed * dt;\n    if (Input.held('ArrowDown'))  this.transform.position.z += this.speed * dt;\n    if (Input.pressed('Space')) this.rb.addForce(0, this.jumpForce, 0);\n  }\n  onCollide(other) {\n    if (other.tag === 'Enemy') Scene.load('GameOver');\n  }\n}` },
          { name:'EnemyAI.js', type:'script', content:`// EnemyAI.js\nclass EnemyAI {\n  onStart() {\n    this.speed = 2;\n    this.health = 100;\n  }\n  onUpdate(dt) {\n    const player = Scene.find('Player');\n    if (!player) return;\n    const dir = Vector3.normalize(Vector3.sub(player.transform.position, this.transform.position));\n    this.transform.position.x += dir.x * this.speed * dt;\n    this.transform.position.z += dir.z * this.speed * dt;\n  }\n  takeDamage(amount) {\n    this.health -= amount;\n    Sound.playEffect('hit');\n    if (this.health <= 0) { Particles.emit('explosion', this.transform.position); this.entity.destroy(); }\n  }\n}` },
          { name:'GameManager.js', type:'script', content:`// GameManager.js\nclass GameManager {\n  onStart() {\n    this.score = 0;\n    CEngine.log('Game started');\n  }\n  addScore(points) {\n    this.score += points;\n    Sound.playEffect('coin');\n    CEngine.log('Score: ' + this.score);\n  }\n  gameOver() {\n    Sound.playEffect('death');\n    CEngine.log('Game Over — Score: ' + this.score);\n  }\n}` },
          { name:'hud.css+', type:'css', content:`/* HUD Styles — CSS+ */\n@cengine hud;\n\n.health-bar {\n  position: engine-anchor(bottom-left);\n  width: var(--player-health)%;\n  background: #c0392b;\n  height: 12px;\n  border-radius: 6px;\n  margin: 12px;\n  transition: width 0.3s;\n}\n\n.score-label {\n  position: engine-anchor(top-right);\n  font: engine-font(pixel);\n  color: #00a4dc;\n  font-size: 24px;\n  margin: 16px;\n}\n\n.crosshair {\n  position: engine-anchor(center);\n  width: 20px;\n  height: 20px;\n  border: 2px solid rgba(255,255,255,0.8);\n  border-radius: 50%;\n}` }
        ];
        defaults.forEach(f => Save.saveFile(f.name, f.content, f.type));
      }

      // Build layout
      const layout = document.createElement('div');
      layout.id = 'code-layout';
      layout.innerHTML = `
        <div id="ft-sidebar-wrap">
          <div id="ft-header">
            <span>EXPLORER</span>
            <button id="ft-new-btn" title="New File">
              <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div id="ft-sidebar"></div>
        </div>
        <div id="ft-editor-area">
          <div id="ft-tabs"></div>
          <div id="ft-monaco-wrap">
            <div id="ft-monaco-placeholder">
              <svg width="36" height="36" viewBox="0 0 36 36" opacity="0.2"><path d="M6 28V8l22 10L6 28z" stroke="#00a4dc" stroke-width="2" fill="none"/></svg>
              <p style="font-size:12px;color:var(--text-dim);margin-top:8px">Select a file to edit</p>
            </div>
            <div id="monaco-container" style="display:none;flex:1;overflow:hidden;width:100%;height:100%;"></div>
          </div>
        </div>`;
      codeTab.appendChild(layout);

      document.getElementById('ft-new-btn')?.addEventListener('click', () => {
        const name = prompt('File name (e.g. MyScript.js):');
        if (!name?.trim()) return;
        const ext = name.split('.').pop().toLowerCase();
        const typeMap = { js:'script', ts:'script', py:'script', lua:'script', css:'css', json:'scene' };
        Save.saveFile(name.trim(), `// ${name.trim()}\n\n`, typeMap[ext]||'script');
        this.refresh();
        this.openFile(name.trim());
        toast('Created: '+name.trim(), 'success');
      });

      this.refresh();
    },

    refresh() {
      const sidebar = document.getElementById('ft-sidebar');
      if (!sidebar) return;
      sidebar.innerHTML = '';
      const files = Save.getFileList();
      const folders = { script:[], css:[], scene:[], other:[] };
      files.forEach(f => { const k=f.type in folders?f.type:'other'; folders[k].push(f); });
      const fNames = { script:'Scripts', css:'Styles', scene:'Scenes', other:'Other' };
      Object.entries(folders).forEach(([type, flist]) => {
        if (!flist.length) return;
        const group = document.createElement('div');
        group.className = 'ft-group';
        const hdr = document.createElement('div');
        hdr.className = 'ft-group-header';
        hdr.innerHTML = `<svg class="ft-group-arrow open" width="8" height="8" viewBox="0 0 8 8"><path d="M1 2l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg><span>${fNames[type]}</span><span class="ft-count">${flist.length}</span>`;
        hdr.addEventListener('click', () => {
          const list = group.querySelector('.ft-group-list');
          const arrow = hdr.querySelector('.ft-group-arrow');
          const open = list.style.display !== 'none';
          list.style.display = open ? 'none' : '';
          arrow.classList.toggle('open', !open);
        });
        const list = document.createElement('div');
        list.className = 'ft-group-list';
        const extColors = { js:'#44cc88', ts:'#4488ff', py:'#ffaa44', lua:'#cc44cc', json:'#44cccc', css:'#cc44cc' };
        flist.forEach(f => {
          const ext = f.name.split('.').pop();
          const item = document.createElement('div');
          item.className = 'ft-file' + (this.activeTab===f.name?' active':'');
          item.dataset.name = f.name;
          item.innerHTML = `<svg width="11" height="11" viewBox="0 0 11 11"><rect x="1" y="1" width="9" height="9" rx="1" stroke="${extColors[ext]||'#888'}" stroke-width="1.1" fill="none"/></svg><span class="ft-filename">${f.name}</span><button class="ft-delete-btn" title="Delete"><svg width="9" height="9" viewBox="0 0 9 9"><path d="M1 1l7 7M8 1L1 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg></button>`;
          item.addEventListener('click', e => { if(e.target.closest('.ft-delete-btn'))return; Audio.click(); this.openFile(f.name); });
          item.querySelector('.ft-delete-btn').addEventListener('click', e => {
            e.stopPropagation(); Audio.click();
            if (confirm('Delete '+f.name+'?')) { this.closeTab(f.name); Save.deleteFile(f.name); this.refresh(); toast('Deleted: '+f.name,'warn'); }
          });
          list.appendChild(item);
        });
        group.appendChild(hdr); group.appendChild(list);
        sidebar.appendChild(group);
      });
    },

    openFile(name) {
      const file = Save.loadFile(name);
      if (!file) return;
      if (!this.openTabs.find(t=>t.name===name)) this.openTabs.push({ name, modified:false });
      this.activeTab = name;
      this._renderTabs();
      this._loadIntoMonaco(file);
      document.querySelectorAll('.ft-file').forEach(el => el.classList.toggle('active', el.dataset.name===name));
    },

    closeTab(name) {
      this.openTabs = this.openTabs.filter(t=>t.name!==name);
      if (this.activeTab===name) {
        this.activeTab = this.openTabs.length>0?this.openTabs[this.openTabs.length-1].name:null;
        if (this.activeTab) { const f=Save.loadFile(this.activeTab); if(f) this._loadIntoMonaco(f); }
        else this._showPlaceholder();
      }
      this._renderTabs();
    },

    _renderTabs() {
      const tabsEl = document.getElementById('ft-tabs');
      if (!tabsEl) return;
      tabsEl.innerHTML = '';
      this.openTabs.forEach(tab => {
        const ext = tab.name.split('.').pop();
        const extColors = { js:'#44cc88', ts:'#4488ff', py:'#ffaa44', lua:'#cc44cc', json:'#44cccc', css:'#cc44cc' };
        const el = document.createElement('div');
        el.className = 'ft-tab'+(this.activeTab===tab.name?' active':'');
        el.innerHTML = `<span class="ft-tab-dot" style="background:${extColors[ext]||'#888'}"></span><span class="ft-tab-name">${tab.name}${tab.modified?' ●':''}</span><button class="ft-tab-close"><svg width="9" height="9" viewBox="0 0 9 9"><path d="M1 1l7 7M8 1L1 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg></button>`;
        el.addEventListener('click', e => { if(e.target.closest('.ft-tab-close'))return; Audio.click(); this.openFile(tab.name); });
        el.querySelector('.ft-tab-close').addEventListener('click', e => { e.stopPropagation(); Audio.click(); this.closeTab(tab.name); });
        tabsEl.appendChild(el);
      });
    },

    _loadIntoMonaco(file) {
      const ph  = document.getElementById('ft-monaco-placeholder');
      const con = document.getElementById('monaco-container');
      if (!ph||!con) return;
      ph.style.display='none'; con.style.display='flex';
      const langMap = { js:'javascript',ts:'typescript',py:'python',lua:'lua',glsl:'glsl',css:'css',json:'json' };
      const ext     = (file.name||'').split('.').pop();
      const lang    = langMap[ext]||'javascript';

      if (window.monacoInst) {
        window.monacoInst.setValue(file.content||'');
        monaco.editor.setModelLanguage(window.monacoInst.getModel(), lang);
        return;
      }
      if (!window.require) {
        con.innerHTML='';
        const ta=document.createElement('textarea');
        ta.style.cssText='width:100%;height:100%;background:#111;color:#ccc;border:none;padding:14px;font-family:"JetBrains Mono",monospace;font-size:13px;resize:none;outline:none;line-height:1.7;';
        ta.value=file.content||'';
        ta.addEventListener('input',()=>{ const t=this.openTabs.find(t=>t.name===this.activeTab); if(t){t.modified=true;this._renderTabs();} });
        con.appendChild(ta); return;
      }
      require.config({ paths:{ vs:'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
      require(['vs/editor/editor.main'],()=>{
        con.innerHTML='';
        const editor=monaco.editor.create(con,{ value:file.content||'',language:lang,theme:'vs-dark',fontSize:13,fontFamily:'"JetBrains Mono",monospace',fontLigatures:true,minimap:{enabled:true},automaticLayout:true,scrollBeyondLastLine:false,wordWrap:'on',cursorBlinking:'smooth',bracketPairColorization:{enabled:true} });
        window.monacoInst=editor;
        editor.onDidChangeModelContent(()=>{ const t=this.openTabs.find(t=>t.name===this.activeTab); if(t){t.modified=true;this._renderTabs();} });
        editor.addCommand(monaco.KeyMod.CtrlCmd|monaco.KeyCode.KeyS,()=>{ const c=editor.getValue(); Save.saveFile(this.activeTab,c); const t=this.openTabs.find(t=>t.name===this.activeTab); if(t){t.modified=false;this._renderTabs();} toast('Saved','success'); });
        Con.log('Monaco ready','log','CodeEditor.js');
      });
    },

    _showPlaceholder() {
      const ph=document.getElementById('ft-monaco-placeholder');
      const con=document.getElementById('monaco-container');
      if(ph) ph.style.display='';
      if(con) con.style.display='none';
    }
  };

  /* ══════════════════════════════════════
     KEYBOARD SHORTCUTS
  ══════════════════════════════════════ */
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (tag==='INPUT'||tag==='TEXTAREA') return;

    if (e.ctrlKey||e.metaKey) {
      if (e.key==='s') { e.preventDefault(); Save.saveScene(); }
      if (e.key==='l') { e.preventDefault(); Save.loadScene(); }
      if (e.key==='d') { e.preventDefault(); SceneView.duplicateSelected(); }
      if (e.key==='p') { e.preventDefault(); document.getElementById('btn-play')?.click(); }
      if (e.key==='z') { e.preventDefault(); toast('Undo — coming in v0.5','warn'); }
      return;
    }

    if (e.key==='Delete'||e.key==='Backspace') SceneView.deleteSelected();
    if (e.key==='f'||e.key==='F') SceneView.focusSelected();
    if (e.key==='g'||e.key==='G') SceneView.setTransformMode('translate');
    if (e.key==='r'||e.key==='R') SceneView.setTransformMode('rotate');
    if (e.key==='s'||e.key==='S') SceneView.setTransformMode('scale');
    if (e.key==='n'||e.key==='N') SceneView.addPrimitive('cube');
    if (e.key==='Escape') { closeMenus(); ContextMenu.hide(); closeBuildModal(); }
  });

  /* ══════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════ */
  window.CEngineAPI = {
    add:    type => SceneView.addPrimitive(type),
    delete: ()   => SceneView.deleteSelected(),
    focus:  ()   => SceneView.focusSelected(),
    list:   ()   => Scene.entities.map(e=>e.name),
    log:    msg  => Con.log(String(msg),'log','Script'),
    select: name => { const e=Scene.entities.find(x=>x.name===name); if(e) Scene.select(e.id); },
    save:   ()   => Save.saveScene(),
    load:   ()   => Save.loadScene(),
    emit:   (type,pos) => window.ParticleSystem?.emit(type,pos||{x:0,y:1,z:0}),
    sound:  type => window.SoundEngine?.Synth.play(type,{volume:0.5})
  };

  // Sync selected entity for inspector
  setInterval(() => {
    const e = Scene.getById(Scene.selected);
    window._selEntity = e || null;
    window._selMesh   = e?.mesh || null;
  }, 100);

  /* ══════════════════════════════════════
     INIT
  ══════════════════════════════════════ */
  Audio.init();
  Con.init();
  buildInsertToolbar();
  SceneView.init();
  Inspector.clear();

  // Build sound panel when audio tab opened (lazy)
  // Particle editor in VFX tab
  setTimeout(() => {
    window.SoundEngine?.buildEditorPanel();
    const vfxWrap = document.getElementById('particle-editor-wrap');
    if (vfxWrap && window.ParticleSystem) window.ParticleSystem.buildEditorPanel();
  }, 800);

  // Animation timeline
  setTimeout(() => {
    const animTab = document.getElementById('btab-animation');
    if (animTab) animTab.innerHTML = '';
    // AnimationSystem would init here if available
  }, 600);

  // Startup logs
  setTimeout(() => Con.log('CEngine v0.4 ready','log','Engine.js'),     100);
  setTimeout(() => Con.log('Three.js r128 renderer','log','Renderer.js'), 200);
  setTimeout(() => Con.log('Tip: N = add cube  |  G/R/S = transform  |  F = focus  |  Ctrl+S = save','log','Editor.js'), 600);
  setTimeout(() => toast('CEngine v0.4 — Ready','success',3000), 500);

})();
```
