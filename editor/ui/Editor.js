/* ═══════════════════════════════════════════
   CENGINE EDITOR.JS v0.4
   Full rewrite — drag transforms, gyro,
   mobile touch, UE5-style organization
   ═══════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══════════════════════════════════════
     MOBILE DETECTION
  ══════════════════════════════════════ */
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.innerWidth < 768);

  if (isMobile) {
    window.location.href = 'mobile.html';
    return;
  }

  /* ══════════════════════════════════════
     AUDIO SYSTEM
  ══════════════════════════════════════ */
  const AudioSystem = {
    ctx: null,
    muted: false,
    enabled: false,
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

    tone(freq = 660, dur = 0.08, vol = 0.03, type = 'sine') {
      if (this.muted || !this.ctx) return;
      try {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.connect(g);
        g.connect(this.ctx.destination);
        o.type = type;
        o.frequency.setValueAtTime(freq, this.ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(freq * 0.75, this.ctx.currentTime + dur);
        g.gain.setValueAtTime(vol, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        o.start();
        o.stop(this.ctx.currentTime + dur);
      } catch (e) {}
    },

    click()   { this.tone(700, 0.05, 0.025); },
    success() { this.tone(880, 0.1, 0.04); setTimeout(() => this.tone(1100, 0.08, 0.03), 100); },
    error()   { this.tone(180, 0.2, 0.04, 'sawtooth'); },
    warn()    { this.tone(440, 0.1, 0.03); }
  };

  /* ══════════════════════════════════════
     TOAST
  ══════════════════════════════════════ */
  function toast(msg, type = 'log', dur = 2500) {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${msg}</span>`;
    c.appendChild(el);
    if      (type === 'success') AudioSystem.success();
    else if (type === 'error')   AudioSystem.error();
    else if (type === 'warn')    AudioSystem.warn();
    else                         AudioSystem.tone(580, 0.07, 0.025);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, dur);
  }

  /* ══════════════════════════════════════
     CONSOLE
  ══════════════════════════════════════ */
  const Console = {
    el: document.getElementById('console-output'),
    counts: { log: 0, warn: 0, error: 0 },
    history: [],
    histIdx: -1,

    log(msg, type = 'log', src = 'Editor.js') {
      if (!this.el) return;
      const t = (performance.now() / 1000).toFixed(3);
      const div = document.createElement('div');
      div.className = `log-entry ${type}`;
      div.dataset.type = type;
      const svgs = {
        log:   `<svg class="log-icon" width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" stroke="#27ae60" stroke-width="1.2" fill="none"/></svg>`,
        warn:  `<svg class="log-icon" width="10" height="10" viewBox="0 0 10 10"><path d="M5 1l4 8H1z" stroke="#d4a017" stroke-width="1.2" fill="none"/></svg>`,
        error: `<svg class="log-icon" width="10" height="10" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6" stroke="#c0392b" stroke-width="1.2" stroke-linecap="round"/></svg>`
      };
      div.innerHTML = `${svgs[type] || svgs.log}
        <span class="log-time">${t}</span>
        <span class="log-msg">${msg}</span>
        <span class="log-source">${src}</span>`;
      this.el.appendChild(div);
      this.el.scrollTop = this.el.scrollHeight;
      this.counts[type] = (this.counts[type] || 0) + 1;
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
      this.counts = { log: 0, warn: 0, error: 0 };
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
      } catch (e) {
        this.log(e.message, 'error', 'Console');
      }
    }
  };

  /* ══════════════════════════════════════
     SCENE DATA MODEL
  ══════════════════════════════════════ */
  const SceneData = {
    entities: [],
    selected: null,
    nextId: 1,

    add(name, type, mesh = null) {
      const e = {
        id: this.nextId++,
        name, type,
        active: true,
        mesh,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale:    { x: 1, y: 1, z: 1 },
        components: []
      };
      this.entities.push(e);
      return e;
    },

    getById(id) {
      return this.entities.find(e => e.id === id) || null;
    },

    remove(id) {
      const e = this.getById(id);
      if (e && e.mesh) {
        SceneView.scene.remove(e.mesh);
        e.mesh.geometry?.dispose();
        if (Array.isArray(e.mesh.material)) e.mesh.material.forEach(m => m.dispose());
        else e.mesh.material?.dispose();
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
      }
    },

    duplicate(id) {
      const e = this.getById(id);
      if (!e || !e.mesh) return null;
      const newMesh = e.mesh.clone();
      newMesh.position.x += 1.5;
      SceneView.scene.add(newMesh);
      const ne = this.add(e.name + ' (Copy)', e.type, newMesh);
      ne.position = { x: newMesh.position.x, y: newMesh.position.y, z: newMesh.position.z };
      ne.rotation = { ...e.rotation };
      ne.scale    = { ...e.scale };
      return ne;
    }
  };

  /* ══════════════════════════════════════
     THREE.JS SCENE VIEW
  ══════════════════════════════════════ */
  const SceneView = {
    renderer: null,
    scene: null,
    camera: null,
    gizmoRenderer: null,
    gizmoScene: null,
    gizmoCamera: null,
    transformGizmoGroup: null,
    raycaster: null,
    mouse: null,
    grid: null,

    /* Camera orbit */
    theta: 0.5,
    phi: 1.0,
    radius: 12,
    orbitTarget: null,

    /* Drag-to-orbit state */
    orbitDragging: false,
    orbitLastX: 0,
    orbitLastY: 0,

    /* Drag-to-transform state */
    transformDragging: false,
    transformStartMouse: null,
    transformStartPos: null,
    transformStartRot: null,
    transformStartScl: null,
    _justFinishedDrag: false,

    /* Touch state */
    touchOrbit: false,
    touchLastX: 0,
    touchLastY: 0,
    touchLastDist: 0,

    /* Touch transform */
    touchTransform: false,
    touchTransformStartX: 0,
    touchTransformStartY: 0,
    touchTransformStartPos: null,
    touchTransformStartRot: null,
    touchTransformStartScl: null,

    /* Gyro */
    gyroEnabled: false,

    /* Transform mode */
    transformMode: 'translate',

    /* Playing */
    playing: false,

    init() {
      const canvas = document.getElementById('scene-canvas');
      if (!canvas || typeof THREE === 'undefined') {
        Console.log('THREE.js not loaded', 'error', 'SceneView.js');
        return;
      }

      this.raycaster = new THREE.Raycaster();
      this.mouse     = new THREE.Vector2();
      this.orbitTarget = new THREE.Vector3(0, 0, 0);

      /* Renderer */
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.1;

      /* Scene */
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x111111);
      this.scene.fog = new THREE.FogExp2(0x111111, 0.016);

      /* Camera */
      this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
      this._syncCamera();

      /* Lights */
      const ambient = new THREE.AmbientLight(0x303040, 1.8);
      this.scene.add(ambient);

      const dirLight = new THREE.DirectionalLight(0xfff0e0, 2.2);
      dirLight.position.set(8, 14, 6);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.set(2048, 2048);
      dirLight.shadow.camera.near = 0.1;
      dirLight.shadow.camera.far  = 80;
      dirLight.shadow.camera.left = dirLight.shadow.camera.bottom = -20;
      dirLight.shadow.camera.right = dirLight.shadow.camera.top   =  20;
      this.scene.add(dirLight);

      const fill = new THREE.PointLight(0x204060, 1.2, 30);
      fill.position.set(-8, 4, -6);
      this.scene.add(fill);

      /* Grid */
      this.grid = new THREE.GridHelper(40, 40, 0x1e1e1e, 0x181818);
      this.scene.add(this.grid);

      /* Ground (receives shadows) */
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 1 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.001;
      ground.receiveShadow = true;
      this.scene.add(ground);

      /* Gizmo viewport */
      this._initGizmoViewport();

      /* Transform gizmo arrows */
      this._initTransformGizmo();

      /* Events */
      this._bindOrbitEvents(canvas);
      this._bindTransformDrag(canvas);
      this._bindKeyboard();
      this._initGyro();

      /* Resize */
      window.addEventListener('resize', () => this._resize());
      this._resize();

      /* Default scene */
      this._buildDefaultScene();

      /* Loop */
      this._loop();

      Console.log('SceneView ready — Three.js r128', 'log', 'SceneView.js');
    },

    /* ── Default scene ────────────────────── */
    _buildDefaultScene() {
      // Ground cube (floor block)
      const floorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9, metalness: 0.05 })
      );
      floorMesh.receiveShadow = true;
      floorMesh.castShadow = false;
      floorMesh.position.set(0, -0.1, 0);
      this.scene.add(floorMesh);
      const floorEntity = SceneData.add('Floor', 'mesh', floorMesh);
      floorEntity.position = { x: 0, y: -0.1, z: 0 };

      // Default cube
      const cubeMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x4488cc, roughness: 0.4, metalness: 0.2 })
      );
      cubeMesh.castShadow = true;
      cubeMesh.receiveShadow = true;
      cubeMesh.position.set(0, 0.5, 0);
      this.scene.add(cubeMesh);
      const cubeEntity = SceneData.add('Cube', 'mesh', cubeMesh);
      cubeEntity.position = { x: 0, y: 0.5, z: 0 };

      HierarchyPanel.refresh();
    },

    /* ── Camera sync ──────────────────────── */
    _syncCamera() {
      if (!this.camera || !this.orbitTarget) return;
      this.camera.position.set(
        this.orbitTarget.x + this.radius * Math.sin(this.phi) * Math.sin(this.theta),
        this.orbitTarget.y + this.radius * Math.cos(this.phi),
        this.orbitTarget.z + this.radius * Math.sin(this.phi) * Math.cos(this.theta)
      );
      this.camera.lookAt(this.orbitTarget);
    },

    /* ── Gizmo viewport ───────────────────── */
    _initGizmoViewport() {
      const gc = document.getElementById('gizmo-canvas');
      if (!gc) return;
      this.gizmoRenderer = new THREE.WebGLRenderer({ canvas: gc, alpha: true, antialias: true });
      this.gizmoRenderer.setSize(70, 70);
      this.gizmoScene  = new THREE.Scene();
      this.gizmoCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      this.gizmoCamera.position.set(0, 0, 3);

      const axes = [
        { dir: new THREE.Vector3(1,0,0), color: 0xcc3333, label: 'X' },
        { dir: new THREE.Vector3(0,1,0), color: 0x33aa33, label: 'Y' },
        { dir: new THREE.Vector3(0,0,1), color: 0x3366cc, label: 'Z' }
      ];

      axes.forEach(({ dir, color }) => {
        const mat  = new THREE.MeshBasicMaterial({ color, depthTest: false });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.7, 8), mat);
        const tip  = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 8), mat);

        // Rotate to correct axis direction
        const q = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0), dir
        );
        body.position.copy(dir.clone().multiplyScalar(0.35));
        body.quaternion.copy(q);
        tip.position.copy(dir.clone().multiplyScalar(0.84));
        tip.quaternion.copy(q);

        this.gizmoScene.add(body, tip);
      });
    },

    /* ── Transform gizmo ──────────────────── */
    _initTransformGizmo() {
      this.transformGizmoGroup = new THREE.Group();
      this.transformGizmoGroup.visible = false;
      this.transformGizmoGroup.renderOrder = 999;

      const axes = [
        { axis: 'x', dir: new THREE.Vector3(1,0,0), color: 0xdd2222 },
        { axis: 'y', dir: new THREE.Vector3(0,1,0), color: 0x22aa22 },
        { axis: 'z', dir: new THREE.Vector3(0,0,1), color: 0x2244dd }
      ];

      axes.forEach(({ dir, color }) => {
        const mat  = new THREE.MeshBasicMaterial({ color, depthTest: false });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8), mat);
        const tip  = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 8), mat);

        const q = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0), dir
        );
        body.position.copy(dir.clone().multiplyScalar(0.5));
        body.quaternion.copy(q);
        tip.position.copy(dir.clone().multiplyScalar(1.12));
        tip.quaternion.copy(q);

        body.material = mat.clone();
        tip.material  = mat.clone();

        this.transformGizmoGroup.add(body, tip);
      });

      this.scene.add(this.transformGizmoGroup);
    },

    showGizmo(entity) {
      if (!entity || !entity.mesh) {
        this.transformGizmoGroup.visible = false;
        return;
      }
      this.transformGizmoGroup.visible = true;
      this.transformGizmoGroup.position.copy(entity.mesh.position);
    },

    /* ══════════════════════════════════════
       ORBIT EVENTS (RMB + touch 2-finger)
    ══════════════════════════════════════ */
    _bindOrbitEvents(canvas) {
      /* ── Mouse RMB orbit ── */
      canvas.addEventListener('mousedown', e => {
        if (e.button === 2) {
          this.orbitDragging = true;
          this.orbitLastX = e.clientX;
          this.orbitLastY = e.clientY;
          canvas.style.cursor = 'grabbing';
          e.preventDefault();
        }
      });

      document.addEventListener('mousemove', e => {
        if (!this.orbitDragging) return;
        const dx = e.clientX - this.orbitLastX;
        const dy = e.clientY - this.orbitLastY;
        this.theta -= dx * 0.007;
        this.phi    = Math.max(0.05, Math.min(Math.PI - 0.05, this.phi + dy * 0.007));
        this.orbitLastX = e.clientX;
        this.orbitLastY = e.clientY;
        this._syncCamera();
      });

      document.addEventListener('mouseup', e => {
        if (e.button === 2) {
          this.orbitDragging = false;
          canvas.style.cursor = '';
        }
      });

      canvas.addEventListener('contextmenu', e => e.preventDefault());

      canvas.addEventListener('wheel', e => {
        this.radius = Math.max(1.5, Math.min(100, this.radius + e.deltaY * 0.022));
        this._syncCamera();
        e.preventDefault();
      }, { passive: false });

      /* ── Touch orbit (1 finger = orbit, 2 finger = zoom)
           Works both on mobile browser visiting desktop URL
           AND on the actual mobile layout              ── */
      canvas.addEventListener('touchstart', e => {
        if (e.touches.length === 1) {
          this.touchOrbit = true;
          this.touchLastX = e.touches[0].clientX;
          this.touchLastY = e.touches[0].clientY;
        }
        if (e.touches.length === 2) {
          this.touchOrbit = false;
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          this.touchLastDist = Math.sqrt(dx*dx + dy*dy);
        }
        e.preventDefault();
      }, { passive: false });

      canvas.addEventListener('touchmove', e => {
        if (e.touches.length === 1 && this.touchOrbit) {
          // Only orbit if no entity selected + dragging, else transform drag handles it
          if (!this.touchTransform) {
            const dx = e.touches[0].clientX - this.touchLastX;
            const dy = e.touches[0].clientY - this.touchLastY;
            this.theta -= dx * 0.007;
            this.phi    = Math.max(0.05, Math.min(Math.PI - 0.05, this.phi + dy * 0.007));
            this.touchLastX = e.touches[0].clientX;
            this.touchLastY = e.touches[0].clientY;
            this._syncCamera();
          }
        }
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          this.radius = Math.max(1.5, Math.min(100, this.radius - (dist - this.touchLastDist) * 0.04));
          this.touchLastDist = dist;
          this._syncCamera();
        }
        e.preventDefault();
      }, { passive: false });

      canvas.addEventListener('touchend', e => {
        if (e.touches.length === 0) {
          this.touchOrbit = false;
          this.touchTransform = false;
          this.touchTransformStartPos = null;
        }
      });

      /* ── WASD pan ── */
      const keys = {};
      document.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
      document.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });

      setInterval(() => {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        const speed = 0.05;
        const fwd   = new THREE.Vector3(-Math.sin(this.theta), 0, -Math.cos(this.theta));
        const right = new THREE.Vector3(Math.cos(this.theta), 0, -Math.sin(this.theta));
        if (keys['w']) { this.orbitTarget.addScaledVector(fwd,   speed); this._syncCamera(); }
        if (keys['s']) { this.orbitTarget.addScaledVector(fwd,  -speed); this._syncCamera(); }
        if (keys['a']) { this.orbitTarget.addScaledVector(right, -speed); this._syncCamera(); }
        if (keys['d']) { this.orbitTarget.addScaledVector(right,  speed); this._syncCamera(); }
        if (keys['q']) { this.orbitTarget.y -= speed; this._syncCamera(); }
        if (keys['e']) { this.orbitTarget.y += speed; this._syncCamera(); }
      }, 16);
    },

    /* ══════════════════════════════════════
       TRANSFORM DRAG
       Left click + drag on selected entity
       Works with MOUSE and TOUCH
    ══════════════════════════════════════ */
    _bindTransformDrag(canvas) {
      const THRESHOLD = 4; // px before drag begins

      /* ── Helper: apply transform delta ── */
      const applyDelta = (entity, dx, dy) => {
        const sensitivity = this.radius * 0.0035;
        const camRight = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
        const camUp    = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1).normalize();

        if (this.transformMode === 'translate') {
          entity.mesh.position.copy(this.transformStartPos);
          entity.mesh.position.addScaledVector(camRight,  dx * sensitivity);
          entity.mesh.position.addScaledVector(camUp,    -dy * sensitivity);
          entity.position = {
            x: entity.mesh.position.x,
            y: entity.mesh.position.y,
            z: entity.mesh.position.z
          };

        } else if (this.transformMode === 'rotate') {
          entity.mesh.rotation.y = this.transformStartRot.y + dx * 0.012;
          entity.mesh.rotation.x = this.transformStartRot.x + dy * 0.012;
          entity.rotation = {
            x: THREE.MathUtils.radToDeg(entity.mesh.rotation.x),
            y: THREE.MathUtils.radToDeg(entity.mesh.rotation.y),
            z: THREE.MathUtils.radToDeg(entity.mesh.rotation.z)
          };

        } else if (this.transformMode === 'scale') {
          const factor = Math.max(0.01, 1 + dx * 0.009);
          entity.mesh.scale.copy(this.transformStartScl).multiplyScalar(factor);
          entity.scale = {
            x: entity.mesh.scale.x,
            y: entity.mesh.scale.y,
            z: entity.mesh.scale.z
          };
        }

        // Sync gizmo position
        this.transformGizmoGroup.position.copy(entity.mesh.position);

        // Live update inspector
        Inspector.update(entity);
      };

      /* ── MOUSE drag ── */
      let mouseStartX = 0, mouseStartY = 0;
      let mouseDragging = false;

      canvas.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        mouseStartX = e.clientX;
        mouseStartY = e.clientY;
        mouseDragging = false;

        const entity = SceneData.getById(SceneData.selected);
        if (!entity || !entity.mesh) return;

        this.transformStartPos = entity.mesh.position.clone();
        this.transformStartRot = { x: entity.mesh.rotation.x, y: entity.mesh.rotation.y, z: entity.mesh.rotation.z };
        this.transformStartScl = entity.mesh.scale.clone();
      });

      document.addEventListener('mousemove', e => {
        // Don't run if right-mouse orbit is active
        if (this.orbitDragging) return;
        if (!this.transformStartPos) return;

        const dx = e.clientX - mouseStartX;
        const dy = e.clientY - mouseStartY;

        if (!mouseDragging && Math.sqrt(dx*dx + dy*dy) < THRESHOLD) return;
        mouseDragging = true;
        this.transformDragging = true;

        const entity = SceneData.getById(SceneData.selected);
        if (!entity || !entity.mesh) return;

        applyDelta(entity, dx, dy);
      });

      document.addEventListener('mouseup', e => {
        if (e.button !== 0) return;

        if (mouseDragging) {
          this._justFinishedDrag = true;
          const entity = SceneData.getById(SceneData.selected);
          if (entity) {
            Console.log(
              `Transformed: ${entity.name}`,
              'log', 'Transform.js'
            );
          }
          setTimeout(() => { this._justFinishedDrag = false; }, 50);
        }

        mouseDragging = false;
        this.transformDragging = false;
        this.transformStartPos = null;
        this.transformStartRot = null;
        this.transformStartScl = null;
      });

      /* ── Left click pick (only if NOT dragging) ── */
      canvas.addEventListener('click', e => {
        if (this._justFinishedDrag) return;

        const rect = canvas.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const meshes = SceneData.entities
          .filter(en => en.mesh && en.active)
          .map(en => en.mesh);

        const hits = this.raycaster.intersectObjects(meshes, true);

        if (hits.length > 0) {
          let hit = hits[0].object;
          // Walk up to find root entity mesh
          while (hit.parent && hit.parent !== this.scene) {
            const found = SceneData.entities.find(en => en.mesh === hit);
            if (found) break;
            hit = hit.parent;
          }
          const entity = SceneData.entities.find(en => en.mesh === hit);
          if (entity) {
            SceneData.select(entity.id);
            HierarchyPanel.selectItem(entity.id);
            AudioSystem.click();
          }
        } else {
          SceneData.selected = null;
          Inspector.clear();
          this.transformGizmoGroup.visible = false;
          HierarchyPanel.clearSelection();
        }
      });

      /* ══════════════════════════════════
         TOUCH TRANSFORM DRAG
         Single finger drag on a selected
         entity — works on desktop Chrome
         with touch simulation AND on real
         mobile devices visiting this URL
      ══════════════════════════════════ */
      let touchDragStartX = 0, touchDragStartY = 0;
      let touchDragging = false;

      canvas.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return;

        const entity = SceneData.getById(SceneData.selected);
        if (!entity || !entity.mesh) return;

        // Check if the touch is near the selected entity
        const touch = e.touches[0];
        const rect  = canvas.getBoundingClientRect();
        const mx = ((touch.clientX - rect.left) / rect.width)  * 2 - 1;
        const my = -((touch.clientY - rect.top)  / rect.height) * 2 + 1;

        const tempRay = new THREE.Raycaster();
        tempRay.setFromCamera(new THREE.Vector2(mx, my), this.camera);
        const hits = tempRay.intersectObject(entity.mesh, true);

        if (hits.length > 0) {
          // Touch is on the selected entity — prepare transform drag
          touchDragStartX = touch.clientX;
          touchDragStartY = touch.clientY;
          touchDragging   = false;
          this.touchTransform = false;

          this.touchTransformStartPos = entity.mesh.position.clone();
          this.touchTransformStartRot = { x: entity.mesh.rotation.x, y: entity.mesh.rotation.y, z: entity.mesh.rotation.z };
          this.touchTransformStartScl = entity.mesh.scale.clone();

          // Prevent orbit from triggering
          this.touchOrbit = false;
        }
      }, { passive: true });

      // Override touchmove to handle transform if over entity
      const origTouchMove = canvas.ontouchmove;
      canvas.addEventListener('touchmove', e => {
        if (e.touches.length !== 1) return;
        if (!this.touchTransformStartPos) return;

        const touch = e.touches[0];
        const dx = touch.clientX - touchDragStartX;
        const dy = touch.clientY - touchDragStartY;

        if (!touchDragging && Math.sqrt(dx*dx + dy*dy) < THRESHOLD) return;

        touchDragging = true;
        this.touchTransform = true;
        this.touchOrbit = false;

        const entity = SceneData.getById(SceneData.selected);
        if (!entity || !entity.mesh) return;

        // Use stored start values for touch
        const prevStartPos = this.transformStartPos;
        const prevStartRot = this.transformStartRot;
        const prevStartScl = this.transformStartScl;

        this.transformStartPos = this.touchTransformStartPos;
        this.transformStartRot = this.touchTransformStartRot;
        this.transformStartScl = this.touchTransformStartScl;

        applyDelta(entity, dx, dy);

        this.transformStartPos = prevStartPos;
        this.transformStartRot = prevStartRot;
        this.transformStartScl = prevStartScl;

      }, { passive: true });

      canvas.addEventListener('touchend', e => {
        if (touchDragging && this.touchTransform) {
          const entity = SceneData.getById(SceneData.selected);
          if (entity) Console.log(`Touch transformed: ${entity.name}`, 'log', 'Transform.js');
        }
        touchDragging = false;
        this.touchTransform = false;
        this.touchTransformStartPos = null;
      });
    },

    /* ══════════════════════════════════════
       KEYBOARD SHORTCUTS
    ══════════════════════════════════════ */
    _bindKeyboard() {
      document.addEventListener('keydown', e => {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        if (e.ctrlKey || e.metaKey) {
          if (e.key === 's') { e.preventDefault(); toast('Scene saved', 'success'); Console.log('Scene saved', 'log', 'Scene.js'); }
          if (e.key === 'd') { e.preventDefault(); this.duplicateSelected(); }
          if (e.key === 'p') { e.preventDefault(); document.getElementById('btn-play')?.click(); }
          if (e.key === 'z') { e.preventDefault(); toast('Undo — v0.4', 'warn'); }
          return;
        }

        // Transform mode keys (Blender-style)
        const modeMap = { 'g': 'translate', 'r': 'rotate', 's': 'scale' };
        if (modeMap[e.key.toLowerCase()]) {
          this.setTransformMode(modeMap[e.key.toLowerCase()]);
          // Sync insert toolbar buttons
          document.querySelectorAll('.transform-tool').forEach(b => {
            b.classList.toggle('active', b.dataset.transform === modeMap[e.key.toLowerCase()]);
          });
          return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') this.deleteSelected();
        if (e.key === 'f' || e.key === 'F') this.focusSelected();
        if (e.key === 'n' || e.key === 'N') this.addPrimitive('cube');
        if (e.key === 'Escape') {
          closeAllMenus();
          ContextMenu.hide();
          closeBuildModal();
        }
      });
    },

    /* ══════════════════════════════════════
       GYROSCOPE
    ══════════════════════════════════════ */
    _initGyro() {
      const start = () => {
        window.addEventListener('deviceorientation', e => {
          if (!this.gyroEnabled) return;
          const beta  = THREE.MathUtils.degToRad(e.beta  || 0);
          const alpha = THREE.MathUtils.degToRad(e.alpha || 0);
          this.phi   = THREE.MathUtils.lerp(this.phi,   Math.max(0.1, Math.min(Math.PI - 0.1, beta)), 0.08);
          this.theta = THREE.MathUtils.lerp(this.theta, -alpha * 0.5, 0.04);
          this._syncCamera();
        }, true);
      };

      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        window._requestGyro = () => {
          DeviceOrientationEvent.requestPermission()
            .then(s => { if (s === 'granted') { start(); this.gyroEnabled = true; } })
            .catch(console.error);
        };
      } else {
        start();
      }
    },

    toggleGyro() {
      if (window._requestGyro && !this.gyroEnabled) {
        window._requestGyro();
        toast('Gyro enabled — tilt to look', 'success');
      } else {
        this.gyroEnabled = !this.gyroEnabled;
        toast(this.gyroEnabled ? 'Gyro ON' : 'Gyro OFF');
      }
    },

    /* ══════════════════════════════════════
       PRIMITIVES + LIGHTS
    ══════════════════════════════════════ */
    addPrimitive(type) {
      const geoMap = {
        cube:     () => new THREE.BoxGeometry(1, 1, 1),
        sphere:   () => new THREE.SphereGeometry(0.5, 24, 24),
        cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 24),
        plane:    () => new THREE.PlaneGeometry(2, 2),
        cone:     () => new THREE.ConeGeometry(0.5, 1, 24),
        torus:    () => new THREE.TorusGeometry(0.5, 0.18, 16, 48),
        capsule:  () => new THREE.CylinderGeometry(0.35, 0.35, 1, 16)
      };

      const colors = {
        cube: 0x4488cc, sphere: 0xcc6633, cylinder: 0x44aa66,
        plane: 0x888888, cone: 0xccaa22, torus: 0xcc4488, capsule: 0x8844cc
      };

      const geo = (geoMap[type] || geoMap.cube)();
      const mat = new THREE.MeshStandardMaterial({
        color: colors[type] || 0x888888,
        roughness: 0.5, metalness: 0.1
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      if (type === 'plane') {
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.01;
      } else {
        mesh.position.set(
          (Math.random() - 0.5) * 3,
          0.5,
          (Math.random() - 0.5) * 3
        );
      }

      this.scene.add(mesh);
      const name   = type.charAt(0).toUpperCase() + type.slice(1);
      const entity = SceneData.add(name, 'mesh', mesh);
      entity.position = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };

      HierarchyPanel.refresh();
      SceneData.select(entity.id);
      HierarchyPanel.selectItem(entity.id);

      AudioSystem.tone(880, 0.1, 0.04);
      toast(`Added ${name}`, 'success');
      Console.log(`Added: ${name}`, 'log', 'Scene.js');
      return entity;
    },

    addLight(type) {
      let light;
      const name = type === 'point' ? 'Point Light' : type === 'spot' ? 'Spot Light' : 'Dir Light';

      if (type === 'point') {
        light = new THREE.PointLight(0xffffff, 1.5, 20);
        light.position.set(2, 4, 2);
        this.scene.add(light);
        this.scene.add(new THREE.PointLightHelper(light, 0.3));
      } else if (type === 'spot') {
        light = new THREE.SpotLight(0xffffff, 2, 30, Math.PI / 5);
        light.position.set(0, 7, 0);
        this.scene.add(light);
        this.scene.add(new THREE.SpotLightHelper(light));
      } else {
        light = new THREE.DirectionalLight(0xffffff, 1.5);
        light.position.set(4, 7, 4);
        this.scene.add(light);
        this.scene.add(new THREE.DirectionalLightHelper(light, 1));
      }

      const entity = SceneData.add(name, 'light', null);
      HierarchyPanel.refresh();
      toast(`Added ${name}`, 'success');
      AudioSystem.tone(660, 0.1, 0.03);
    },

    /* ══════════════════════════════════════
       ENTITY OPERATIONS
    ══════════════════════════════════════ */
    deleteSelected() {
      if (!SceneData.selected) return;
      SceneData.remove(SceneData.selected);
      this.transformGizmoGroup.visible = false;
      HierarchyPanel.refresh();
      toast('Deleted', 'warn');
      Console.log('Entity deleted', 'warn', 'Scene.js');
    },

    duplicateSelected() {
      const ne = SceneData.duplicate(SceneData.selected);
      if (!ne) return;
      HierarchyPanel.refresh();
      SceneData.select(ne.id);
      HierarchyPanel.selectItem(ne.id);
      toast(`Duplicated: ${ne.name}`, 'success');
    },

    focusSelected() {
      const e = SceneData.getById(SceneData.selected);
      if (!e || !e.mesh) return;
      this.orbitTarget.copy(e.mesh.position);
      this.radius = 4;
      this._syncCamera();
    },

    setTransformMode(mode) {
      this.transformMode = mode;
      Console.log(`Transform mode: ${mode}`, 'log', 'Editor.js');
    },

    toggleGrid(v) {
      if (this.grid) this.grid.visible = v;
    },

    toggleWireframe(v) {
      SceneData.entities.forEach(e => {
        if (e.mesh?.material) e.mesh.material.wireframe = v;
      });
    },

    /* ══════════════════════════════════════
       RENDER LOOP
    ══════════════════════════════════════ */
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

      // Sync gizmo scale to distance
      if (this.transformGizmoGroup.visible) {
        const sel = SceneData.getById(SceneData.selected);
        if (sel?.mesh) {
          this.transformGizmoGroup.position.copy(sel.mesh.position);
          const dist = this.camera.position.distanceTo(sel.mesh.position);
          this.transformGizmoGroup.scale.setScalar(dist * 0.1);
        }
      }

      this.renderer.render(this.scene, this.camera);

      // Gizmo viewport mirrors main camera rotation
      if (this.gizmoRenderer && this.gizmoScene && this.gizmoCamera) {
        const dir = new THREE.Vector3()
          .subVectors(this.camera.position, this.orbitTarget)
          .normalize()
          .multiplyScalar(3);
        this.gizmoCamera.position.copy(dir);
        this.gizmoCamera.lookAt(0, 0, 0);
        this.gizmoRenderer.render(this.gizmoScene, this.gizmoCamera);
      }
    }
  };

  /* ══════════════════════════════════════
     HIERARCHY PANEL
  ══════════════════════════════════════ */
  const HierarchyPanel = {
    tree: document.getElementById('scene-children'),

    refresh() {
      if (!this.tree) return;
      this.tree.innerHTML = '';

      SceneData.entities.forEach(entity => {
        const item = document.createElement('div');
        item.className = 'tree-item' + (SceneData.selected === entity.id ? ' selected' : '');
        item.dataset.entityId = entity.id;

        const icons = {
          mesh:  `<svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1l5 3v4l-5 3-5-3V4z" stroke="#6688cc" stroke-width="1.2" fill="none"/></svg>`,
          light: `<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="5" r="2.5" stroke="#ccaa33" stroke-width="1.2" fill="none"/><path d="M6 8v2M3 7l-1 1M9 7l1 1" stroke="#ccaa33" stroke-width="1.2"/></svg>`,
          empty: `<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4" stroke="#555" stroke-width="1.2" fill="none" stroke-dasharray="2 2"/></svg>`
        };

        item.innerHTML = `
          <span class="tree-indent"></span>
          <svg class="tree-arrow invisible" width="8" height="8" viewBox="0 0 8 8">
            <path d="M2 2l4 2-4 2" fill="currentColor"/>
          </svg>
          ${icons[entity.type] || icons.empty}
          <span class="tree-label">${entity.name}</span>
          <button class="tree-eye" title="Toggle visibility" data-id="${entity.id}">
            <svg width="10" height="10" viewBox="0 0 10 10">
              <ellipse cx="5" cy="5" rx="4" ry="2.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
              <circle cx="5" cy="5" r="1.2" fill="currentColor"/>
            </svg>
          </button>`;

        item.addEventListener('click', e => {
          if (e.target.closest('.tree-eye')) return;
          AudioSystem.click();
          document.querySelectorAll('.tree-item[data-entity-id]')
            .forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
          SceneData.select(entity.id);
        });

        item.querySelector('.tree-eye').addEventListener('click', e => {
          e.stopPropagation();
          entity.active = !entity.active;
          if (entity.mesh) entity.mesh.visible = entity.active;
          item.querySelector('.tree-eye').style.opacity = entity.active ? '1' : '0.3';
          AudioSystem.click();
        });

        item.addEventListener('contextmenu', e => {
          e.preventDefault();
          SceneData.select(entity.id);
          this.selectItem(entity.id);
          ContextMenu.show(e.clientX, e.clientY);
        });

        this.tree.appendChild(item);
      });
    },

    selectItem(id) {
      document.querySelectorAll('.tree-item[data-entity-id]').forEach(el => {
        el.classList.toggle('selected', parseInt(el.dataset.entityId) === id);
      });
    },

    clearSelection() {
      document.querySelectorAll('.tree-item[data-entity-id]')
        .forEach(el => el.classList.remove('selected'));
    }
  };

  /* ══════════════════════════════════════
     INSPECTOR PANEL
  ══════════════════════════════════════ */
  const Inspector = {
    body: document.getElementById('inspector-body'),

    update(entity) {
      if (!this.body) return;
      this.body.innerHTML = `
        <div class="inspector-entity-header">
          <input type="checkbox" id="ent-active" ${entity.active ? 'checked' : ''}/>
          <input type="text" class="entity-name-input" id="ent-name" value="${entity.name}"/>
          <span class="entity-tag">${entity.type}</span>
        </div>

        <div class="component-block">
          <div class="component-header">
            <svg class="comp-arrow open" width="8" height="8" viewBox="0 0 8 8">
              <path d="M1 2l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.2"/>
            </svg>
            <span class="component-title">Transform</span>
          </div>
          <div class="component-body">
            ${this._vec3('Position', 'pos', entity.position)}
            ${this._vec3('Rotation', 'rot', entity.rotation)}
            ${this._vec3('Scale',    'scl', entity.scale)}
          </div>
        </div>

        ${entity.type === 'mesh'  ? this._meshBlock(entity)  : ''}
        ${entity.type === 'light' ? this._lightBlock()       : ''}

        <div class="add-component-area">
          <button class="add-component-btn" id="btn-add-comp">
            <svg width="11" height="11" viewBox="0 0 11 11">
              <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Add Component
          </button>
        </div>`;

      // Wire transform inputs
      [['pos','position'], ['rot','rotation'], ['scl','scale']].forEach(([prefix, key]) => {
        ['x','y','z'].forEach(axis => {
          const inp = document.getElementById(`${prefix}-${axis}`);
          if (!inp) return;
          inp.addEventListener('input', () => {
            const v = parseFloat(inp.value) || 0;
            entity[key][axis] = v;
            if (entity.mesh) {
              if (key === 'position') entity.mesh.position[axis] = v;
              if (key === 'rotation') entity.mesh.rotation[axis] = THREE.MathUtils.degToRad(v);
              if (key === 'scale')    entity.mesh.scale[axis]    = v;
              SceneView.transformGizmoGroup.position.copy(entity.mesh.position);
            }
          });
        });
      });

      // Name input
      document.getElementById('ent-name')?.addEventListener('input', function() {
        entity.name = this.value;
        HierarchyPanel.refresh();
        HierarchyPanel.selectItem(entity.id);
      });

      // Active checkbox
      document.getElementById('ent-active')?.addEventListener('change', function() {
        entity.active = this.checked;
        if (entity.mesh) entity.mesh.visible = this.checked;
      });

      // Color picker
      const colorPick = document.getElementById('mesh-color');
      if (colorPick && entity.mesh?.material) {
        colorPick.value = '#' + entity.mesh.material.color.getHexString();
        colorPick.addEventListener('input', function() {
          entity.mesh.material.color.set(this.value);
        });
      }

      // Component collapse
      document.querySelectorAll('.component-header').forEach(hdr => {
        hdr.addEventListener('click', () => {
          AudioSystem.click();
          const body = hdr.nextElementSibling;
          if (!body) return;
          const open = body.style.display !== 'none';
          body.style.display = open ? 'none' : '';
          hdr.querySelector('.comp-arrow')?.classList.toggle('open', !open);
        });
      });

      document.getElementById('btn-add-comp')?.addEventListener('click', () => {
        AudioSystem.click();
        toast('Component picker — v0.4', 'warn');
      });
    },

    _vec3(label, prefix, v = { x:0, y:0, z:0 }) {
      const fmt = n => (n || 0).toFixed(3);
      return `
        <div class="prop-row">
          <span class="prop-label">${label}</span>
          <div class="vec3-inputs">
            <label class="x-label">X<input id="${prefix}-x" type="number" class="vec-input" value="${fmt(v.x)}" step="0.1"/></label>
            <label class="y-label">Y<input id="${prefix}-y" type="number" class="vec-input" value="${fmt(v.y)}" step="0.1"/></label>
            <label class="z-label">Z<input id="${prefix}-z" type="number" class="vec-input" value="${fmt(v.z)}" step="0.1"/></label>
          </div>
        </div>`;
    },

    _meshBlock(entity) {
      const metal = entity.mesh?.material?.metalness ?? 0.1;
      const rough = entity.mesh?.material?.roughness ?? 0.5;
      return `
        <div class="component-block">
          <div class="component-header">
            <svg class="comp-arrow open" width="8" height="8" viewBox="0 0 8 8">
              <path d="M1 2l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.2"/>
            </svg>
            <span class="component-title">Mesh Renderer</span>
          </div>
          <div class="component-body">
            <div class="prop-row">
              <span class="prop-label">Color</span>
              <input type="color" class="prop-color" id="mesh-color" value="#4488cc"/>
            </div>
            <div class="prop-row">
              <span class="prop-label">Metalness</span>
              <input type="range" class="prop-slider" min="0" max="1" step="0.01" value="${metal}"
                oninput="if(window._selMesh)window._selMesh.material.metalness=+this.value"/>
            </div>
            <div class="prop-row">
              <span class="prop-label">Roughness</span>
              <input type="range" class="prop-slider" min="0" max="1" step="0.01" value="${rough}"
                oninput="if(window._selMesh)window._selMesh.material.roughness=+this.value"/>
            </div>
            <div class="prop-row">
              <span class="prop-label">Wireframe</span>
              <input type="checkbox" ${entity.mesh?.material?.wireframe ? 'checked' : ''}
                onchange="if(window._selMesh)window._selMesh.material.wireframe=this.checked"
                style="accent-color:var(--accent);cursor:pointer"/>
            </div>
          </div>
        </div>`;
    },

    _lightBlock() {
      return `
        <div class="component-block">
          <div class="component-header">
            <svg class="comp-arrow open" width="8" height="8" viewBox="0 0 8 8">
              <path d="M1 2l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.2"/>
            </svg>
            <span class="component-title">Light</span>
          </div>
          <div class="component-body">
            <div class="prop-row">
              <span class="prop-label">Color</span>
              <input type="color" class="prop-color" value="#ffffff"/>
            </div>
            <div class="prop-row">
              <span class="prop-label">Intensity</span>
              <input type="range" class="prop-slider" min="0" max="5" step="0.1" value="1.5"/>
              <span class="prop-value">1.5</span>
            </div>
          </div>
        </div>`;
    },

    clear() {
      if (!this.body) return;
      this.body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;
          justify-content:center;height:100%;gap:8px;color:var(--text-dim);padding:20px">
          <svg width="28" height="28" viewBox="0 0 28 28" opacity="0.3">
            <circle cx="14" cy="10" r="5" stroke="#888" stroke-width="1.5" fill="none"/>
            <path d="M5 24c0-5 4-8 9-8s9 3 9 8" stroke="#888" stroke-width="1.5" fill="none"/>
          </svg>
          <p style="font-size:11px">Select an entity</p>
          <p style="font-size:10px;color:var(--text-dim)">to inspect properties</p>
        </div>`;
    }
  };

  /* ══════════════════════════════════════
     INSERT TOOLBAR
  ══════════════════════════════════════ */
  function buildInsertToolbar() {
    const menubar = document.getElementById('menubar');
    if (!menubar) return;

    const bar = document.createElement('div');
    bar.id = 'insert-toolbar';
    bar.innerHTML = `
      <span class="insert-label">Insert</span>

      <div class="insert-group">
        <button class="insert-btn" data-prim="cube">
          <svg width="13" height="13" viewBox="0 0 13 13"><path d="M6.5 1.5l5 2.5v5l-5 2.5-5-2.5v-5z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
          Cube
        </button>
        <button class="insert-btn" data-prim="sphere">
          <svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.2" fill="none"/><ellipse cx="6.5" cy="6.5" rx="5" ry="2" stroke="currentColor" stroke-width="0.8" fill="none"/></svg>
          Sphere
        </button>
        <button class="insert-btn" data-prim="cylinder">
          <svg width="13" height="13" viewBox="0 0 13 13"><ellipse cx="6.5" cy="4" rx="4" ry="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/><ellipse cx="6.5" cy="10" rx="4" ry="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="2.5" y1="4" x2="2.5" y2="10" stroke="currentColor" stroke-width="1.2"/><line x1="10.5" y1="4" x2="10.5" y2="10" stroke="currentColor" stroke-width="1.2"/></svg>
          Cylinder
        </button>
        <button class="insert-btn" data-prim="plane">
          <svg width="13" height="13" viewBox="0 0 13 13"><path d="M1 9l5.5-3.5L12 9M1 9h11" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M1 9v1.5h11V9" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
          Plane
        </button>
        <button class="insert-btn" data-prim="cone">
          <svg width="13" height="13" viewBox="0 0 13 13"><path d="M6.5 1.5l5 9h-10z" stroke="currentColor" stroke-width="1.2" fill="none"/><ellipse cx="6.5" cy="10.5" rx="5" ry="1.5" stroke="currentColor" stroke-width="1" fill="none"/></svg>
          Cone
        </button>
        <button class="insert-btn" data-prim="torus">
          <svg width="13" height="13" viewBox="0 0 13 13"><ellipse cx="6.5" cy="6.5" rx="5" ry="2.5" stroke="currentColor" stroke-width="1.2" fill="none"/><ellipse cx="6.5" cy="6.5" rx="2.5" ry="1.2" stroke="currentColor" stroke-width="0.8" fill="none" opacity="0.5"/></svg>
          Torus
        </button>
      </div>

      <div class="insert-divider"></div>

      <div class="insert-group">
        <button class="insert-btn" data-light="point">
          <svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="6" r="2.5" stroke="#ccaa44" stroke-width="1.2" fill="none"/><path d="M6.5 1v1.5M6.5 10.5V12M1 6H2.5M10.5 6H12M2.5 2.5l1 1M10 10l-1-1M2.5 9.5l1-1M10 3l-1 1" stroke="#ccaa44" stroke-width="1.2"/></svg>
          Point
        </button>
        <button class="insert-btn" data-light="spot">
          <svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="4" r="2" stroke="#ccaa44" stroke-width="1.2" fill="none"/><path d="M4 7l-2 5M9 7l2 5M4 7h5" stroke="#ccaa44" stroke-width="1.2"/></svg>
          Spot
        </button>
        <button class="insert-btn" data-light="dir">
          <svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="4.5" r="2" stroke="#ccaa44" stroke-width="1.2" fill="none"/><path d="M6.5 7v5M4 8l-2 4M9 8l2 4" stroke="#ccaa44" stroke-width="1.2"/></svg>
          Dir
        </button>
      </div>

      <div class="insert-divider"></div>

      <div class="insert-group" id="transform-tools-group">
        <button class="insert-btn transform-tool active" data-transform="translate">
          <svg width="13" height="13" viewBox="0 0 13 13"><path d="M6.5 1v11M1 6.5h11M6.5 1l-2 3h4L6.5 1zM6.5 12l-2-3h4l-2 3zM1 6.5l3-2v4L1 6.5zM12 6.5l-3-2v4l3-2z" stroke="currentColor" stroke-width="1.1" fill="none"/></svg>
          Move
        </button>
        <button class="insert-btn transform-tool" data-transform="rotate">
          <svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M6.5 2 A4.5 4.5 0 0 1 11 6.5" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M10 4.5l1 2 2-1" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
          Rotate
        </button>
        <button class="insert-btn transform-tool" data-transform="scale">
          <svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1" width="5" height="5" stroke="currentColor" stroke-width="1.2" fill="none"/><rect x="7" y="7" width="5" height="5" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M6 4h3M9 4v3" stroke="currentColor" stroke-width="1.2"/></svg>
          Scale
        </button>
      </div>

      <div class="insert-divider"></div>

      <div class="insert-group">
        <button class="insert-btn danger-btn" id="btn-del">
          <svg width="13" height="13" viewBox="0 0 13 13"><path d="M2.5 4h8M5 4V2.5h3V4M4 4v7h5V4M5.5 6v3M7.5 6v3" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>
          Delete
        </button>
        <button class="insert-btn" id="btn-dup">
          <svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="4" width="7" height="8" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M4 4V3a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H9" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
          Duplicate
        </button>
        <button class="insert-btn" id="btn-focus">
          <svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="6.5" r="2.5" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M1 3V1h2M10 1h2v2M12 10v2h-2M3 12H1v-2" stroke="currentColor" stroke-width="1.2"/></svg>
          Focus
        </button>
      </div>

      <div class="insert-divider"></div>

      <button class="insert-btn gyro-btn" id="btn-gyro">
        <svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.2" fill="none"/><ellipse cx="6.5" cy="6.5" rx="5" ry="2" stroke="currentColor" stroke-width="0.8" fill="none" opacity="0.6"/><circle cx="6.5" cy="6.5" r="1.2" fill="currentColor"/></svg>
        Gyro
      </button>`;

    menubar.parentNode.insertBefore(bar, menubar.nextSibling);

    // Primitives
    bar.querySelectorAll('.insert-btn[data-prim]').forEach(btn => {
      btn.addEventListener('click', () => {
        AudioSystem.click();
        SceneView.addPrimitive(btn.dataset.prim);
      });
    });

    // Lights
    bar.querySelectorAll('.insert-btn[data-light]').forEach(btn => {
      btn.addEventListener('click', () => {
        AudioSystem.click();
        SceneView.addLight(btn.dataset.light);
      });
    });

    // Transform tools
    bar.querySelectorAll('.transform-tool').forEach(btn => {
      btn.addEventListener('click', () => {
        AudioSystem.click();
        bar.querySelectorAll('.transform-tool').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        SceneView.setTransformMode(btn.dataset.transform);
        toast(`Mode: ${btn.dataset.transform}`, 'log', 1000);
      });
    });

    document.getElementById('btn-del')?.addEventListener('click', () => {
      AudioSystem.error();
      SceneView.deleteSelected();
    });

    document.getElementById('btn-dup')?.addEventListener('click', () => {
      AudioSystem.click();
      SceneView.duplicateSelected();
    });

    document.getElementById('btn-focus')?.addEventListener('click', () => {
      AudioSystem.click();
      SceneView.focusSelected();
    });

    document.getElementById('btn-gyro')?.addEventListener('click', () => {
      AudioSystem.click();
      SceneView.toggleGyro();
      document.getElementById('btn-gyro').classList.toggle('active');
    });
  }

  /* ══════════════════════════════════════
     CONTEXT MENU
  ══════════════════════════════════════ */
  const ContextMenu = {
    el: document.getElementById('context-menu'),

    show(x, y) {
      if (!this.el) return;
      this.el.style.left = Math.min(x, window.innerWidth  - 170) + 'px';
      this.el.style.top  = Math.min(y, window.innerHeight - 160) + 'px';
      this.el.classList.remove('hidden');
    },

    hide() { this.el?.classList.add('hidden'); }
  };

  document.addEventListener('click',       () => ContextMenu.hide());
  document.addEventListener('contextmenu', e  => {
    if (!e.target.closest('#panel-hierarchy') && !e.target.closest('#scene-canvas')) {
      ContextMenu.hide();
    }
  });

  document.querySelectorAll('.ctx-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      AudioSystem.click();
      ContextMenu.hide();
      const a = item.dataset.action;
      if      (a === 'delete')      SceneView.deleteSelected();
      else if (a === 'duplicate')   SceneView.duplicateSelected();
      else if (a === 'add-child')   SceneView.addPrimitive('cube');
      else if (a === 'add-component') toast('Component picker — v0.4', 'warn');
      else toast(`${a} coming soon`, 'warn');
    });
  });

  /* ══════════════════════════════════════
     DROPDOWN MENUS
  ══════════════════════════════════════ */
  const MenuDefs = {
    file:       document.getElementById('menu-file'),
    edit:       document.getElementById('menu-edit'),
    assets:     document.getElementById('menu-assets'),
    gameobject: document.getElementById('menu-gameobject'),
    component:  document.getElementById('menu-component'),
    build:      document.getElementById('menu-build'),
    window:     document.getElementById('menu-window'),
    help:       document.getElementById('menu-help')
  };

  let openMenuEl = null;

  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      AudioSystem.click();
      const menu = MenuDefs[item.dataset.menu];
      if (!menu) return;
      if (openMenuEl === menu) { closeAllMenus(); return; }
      closeAllMenus();
      const rect = item.getBoundingClientRect();
      menu.style.left = rect.left + 'px';
      menu.classList.remove('hidden');
      item.classList.add('open');
      openMenuEl = menu;
      document.getElementById('dropdown-overlay')?.classList.remove('hidden');
    });
  });

  function closeAllMenus() {
    Object.values(MenuDefs).forEach(m => m?.classList.add('hidden'));
    document.querySelectorAll('.menu-item.open').forEach(m => m.classList.remove('open'));
    document.getElementById('dropdown-overlay')?.classList.add('hidden');
    openMenuEl = null;
  }

  document.getElementById('dropdown-overlay')?.addEventListener('click', closeAllMenus);

  document.querySelectorAll('.dd-item[data-action]').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      AudioSystem.click();
      closeAllMenus();
      handleAction(item.dataset.action);
    });
  });

  function handleAction(a) {
    const map = {
      'new-scene':    () => { SceneData.entities = []; SceneView._buildDefaultScene(); toast('New scene', 'success'); },
      'save-scene':   () => { toast('Scene saved', 'success'); Console.log('Scene saved', 'log', 'Scene.js'); },
      'build-settings': openBuildModal,
      'export':         openBuildModal,
      'build-web':    () => openBuildModal('web'),
      'build-android':() => openBuildModal('android'),
      'build-desktop':() => openBuildModal('desktop'),
      'build-run':    () => { openBuildModal(); setTimeout(() => document.getElementById('btn-start-build')?.click(), 400); },
      'undo':         () => toast('Undo — v0.4', 'warn'),
      'redo':         () => toast('Redo — v0.4', 'warn'),
      'create-empty': () => { SceneData.add('Empty', 'empty', null); HierarchyPanel.refresh(); toast('Empty created', 'success'); },
      'create-camera':() => toast('Camera entity — v0.4', 'warn'),
      'docs':         () => window.open('https://github.com', '_blank'),
      'about':        () => toast('CEngine v0.3 — Three.js + Monaco', 'log', 4000),
      'preferences':  () => toast('Preferences — v0.4', 'warn'),
      'reset-layout': () => location.reload(),
      'exit':         () => { if (confirm('Exit CEngine?')) window.close(); }
    };
    (map[a] || (() => toast(`${a} coming soon`, 'warn')))();
  }

  /* ══════════════════════════════════════
     CENTER TABS
  ══════════════════════════════════════ */
  document.querySelectorAll('.center-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      AudioSystem.click();
      document.querySelectorAll('.center-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const el = document.getElementById(`tab-${tab.dataset.tab}`);
      if (el) el.classList.add('active');
      if (tab.dataset.tab === 'code') initMonaco();
      if (tab.dataset.tab === 'scene') setTimeout(() => SceneView._resize(), 50);
    });
  });

  /* ══════════════════════════════════════
     BOTTOM TABS
  ══════════════════════════════════════ */
  document.querySelectorAll('.bottom-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      AudioSystem.click();
      document.querySelectorAll('.bottom-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.btab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`btab-${tab.dataset.tab}`)?.classList.add('active');
    });
  });

  /* ══════════════════════════════════════
     PLAY CONTROLS
  ══════════════════════════════════════ */
  let playing = false, fpsInterval = null, frameCount = 0;

  document.getElementById('btn-play')?.addEventListener('click', () => {
    playing = true;
    SceneView.playing = true;
    document.getElementById('btn-play').disabled  = true;
    document.getElementById('btn-pause').disabled = false;
    document.getElementById('btn-stop').disabled  = false;
    document.getElementById('btn-play').classList.add('playing');
    AudioSystem.success();
    Console.log('Play mode', 'log', 'Engine.js');
    toast('Playing', 'success');
    fpsInterval = setInterval(() => {
      document.getElementById('fps-counter').textContent = frameCount + ' FPS';
      frameCount = 0;
    }, 1000);
    (function tick() { if (!playing) return; frameCount++; requestAnimationFrame(tick); })();
  });

  document.getElementById('btn-pause')?.addEventListener('click', () => {
    playing = !playing;
    SceneView.playing = playing;
    AudioSystem.warn();
    toast(playing ? 'Resumed' : 'Paused');
  });

  document.getElementById('btn-stop')?.addEventListener('click', () => {
    playing = false;
    SceneView.playing = false;
    document.getElementById('btn-play').disabled  = false;
    document.getElementById('btn-pause').disabled = true;
    document.getElementById('btn-stop').disabled  = true;
    document.getElementById('btn-play').classList.remove('playing');
    document.getElementById('fps-counter').textContent = '-- FPS';
    clearInterval(fpsInterval);
    AudioSystem.error();
    Console.log('Stopped', 'log', 'Engine.js');
    toast('Stopped');
  });

  /* ══════════════════════════════════════
     TOOLBAR TOOL BUTTONS
  ══════════════════════════════════════ */
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AudioSystem.click();
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const modes = { 'btn-translate': 'translate', 'btn-rotate': 'rotate', 'btn-scale': 'scale' };
      if (modes[btn.id]) SceneView.setTransformMode(modes[btn.id]);
    });
  });

  /* ══════════════════════════════════════
     BUILD MODAL
  ══════════════════════════════════════ */
  function openBuildModal(platform = 'web') {
    AudioSystem.click();
    document.getElementById('build-modal')?.classList.remove('hidden');
    document.getElementById('modal-overlay')?.classList.remove('hidden');
    document.querySelectorAll('.build-platform').forEach(p => p.classList.remove('active'));
    document.querySelector(`.build-platform[data-platform="${platform}"]`)?.classList.add('active');
  }

  function closeBuildModal() {
    AudioSystem.click();
    document.getElementById('build-modal')?.classList.add('hidden');
    document.getElementById('modal-overlay')?.classList.add('hidden');
  }

  document.getElementById('btn-build-quick')?.addEventListener('click', () => openBuildModal());
  document.getElementById('btn-close-build')?.addEventListener('click', closeBuildModal);
  document.getElementById('btn-close-build-2')?.addEventListener('click', closeBuildModal);
  document.getElementById('modal-overlay')?.addEventListener('click', closeBuildModal);

  document.querySelectorAll('.build-platform').forEach(p => {
    p.addEventListener('click', () => {
      AudioSystem.click();
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
      { msg: `Compiling scene...`,          delay: 0 },
      { msg: `Bundling scripts...`,          delay: 500 },
      { msg: `Packaging assets...`,          delay: 1000 },
      { msg: `Generating HTML5 output...`,   delay: 1500 },
      { msg: `✓ Build complete: ${name}`,    delay: 2100, ok: true }
    ];
    steps.forEach(({ msg, delay, ok }) => {
      setTimeout(() => {
        const line = document.createElement('div');
        line.className = 'build-log-line' + (ok ? ' success' : '');
        line.textContent = msg;
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
        if (ok) {
          AudioSystem.success();
          toast(`Build complete: ${name}`, 'success');
          setTimeout(() => { closeBuildModal(); launchBuild(name); }, 500);
        }
      }, delay);
    });
  });

  document.getElementById('btn-build-and-run')?.addEventListener('click', () => {
    document.getElementById('btn-start-build')?.click();
  });

  function launchBuild(name = 'My Game') {
    const entities = SceneData.entities
      .filter(e => e.mesh)
      .map(e => ({
        name: e.name,
        geo:  e.mesh.geometry?.type || 'BoxGeometry',
        color: '#' + (e.mesh.material?.color?.getHexString() || '4488cc'),
        px: e.mesh.position.x, py: e.mesh.position.y, pz: e.mesh.position.z,
        rx: e.mesh.rotation.x, ry: e.mesh.rotation.y, rz: e.mesh.rotation.z,
        sx: e.mesh.scale.x,    sy: e.mesh.scale.y,    sz: e.mesh.scale.z
      }));

    const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;overflow:hidden;width:100vw;height:100vh}
canvas{display:block;width:100%;height:100%}
#loader{position:fixed;inset:0;background:#0a0a0a;display:flex;flex-direction:column;
  align-items:center;justify-content:center;z-index:9999;transition:opacity 0.5s}
.ll{font-family:monospace;font-size:26px;font-weight:800;color:#00a4dc;
  letter-spacing:2px;margin-bottom:6px}
.ls{font-family:monospace;font-size:10px;color:#444;letter-spacing:4px;margin-bottom:28px}
.lb{width:200px;height:2px;background:#1a1a1a;border-radius:2px;overflow:hidden}
.lf{height:100%;background:#00a4dc;width:0%;transition:width 0.25s}
.lc{position:fixed;bottom:16px;font-family:monospace;font-size:9px;color:#2a2a2a;letter-spacing:3px}
#hud{position:fixed;top:10px;left:12px;font-family:monospace;color:#555;font-size:11px;pointer-events:none}
</style></head><body>
<div id="loader">
  <div class="ll">C<span style="color:#888;font-weight:400;font-size:20px">Engine</span></div>
  <div class="ls">LOADING GAME</div>
  <div class="lb"><div class="lf" id="lf"></div></div>
  <div class="lc">BUILT WITH CENGINE</div>
</div>
<canvas id="c"></canvas>
<div id="hud">${name}</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
const lf=document.getElementById('lf');
let p=0;const li=setInterval(()=>{p=Math.min(100,p+Math.random()*15+5);lf.style.width=p+'%';
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
camera.position.set(5,4,8);camera.lookAt(0,0,0);

scene.add(new THREE.AmbientLight(0x303040,1.8));
const dl=new THREE.DirectionalLight(0xfff0e0,2.2);
dl.position.set(8,14,6);dl.castShadow=true;scene.add(dl);
scene.add(new THREE.GridHelper(40,40,0x1e1e1e,0x181818));

const gm={BoxGeometry:()=>new THREE.BoxGeometry(1,1,1),
SphereGeometry:()=>new THREE.SphereGeometry(0.5,24,24),
CylinderGeometry:()=>new THREE.CylinderGeometry(0.5,0.5,1,24),
PlaneGeometry:()=>new THREE.PlaneGeometry(2,2),
ConeGeometry:()=>new THREE.ConeGeometry(0.5,1,24),
TorusGeometry:()=>new THREE.TorusGeometry(0.5,0.18,16,48)};

${JSON.stringify(entities)}.forEach(e=>{
const geo=(gm[e.geo]||gm.BoxGeometry)();
const mat=new THREE.MeshStandardMaterial({color:e.color,roughness:0.5,metalness:0.1});
const mesh=new THREE.Mesh(geo,mat);
mesh.position.set(e.px,e.py,e.pz);
mesh.rotation.set(e.rx,e.ry,e.rz);
mesh.scale.set(e.sx,e.sy,e.sz);
mesh.castShadow=true;mesh.receiveShadow=true;
scene.add(mesh);});

let th=0.5,ph=1.0,rad=12,drag=false,lx=0,ly=0;
const ot=new THREE.Vector3();
document.addEventListener('mousedown',e=>{if(e.button===2){drag=true;lx=e.clientX;ly=e.clientY;}});
document.addEventListener('mouseup',()=>drag=false);
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('mousemove',e=>{if(!drag)return;th-=(e.clientX-lx)*0.007;
ph=Math.max(0.05,Math.min(3.09,ph+(e.clientY-ly)*0.007));lx=e.clientX;ly=e.clientY;});
document.addEventListener('wheel',e=>{rad=Math.max(1.5,Math.min(80,rad+e.deltaY*0.022));});

let tch=false,tlx=0,tly=0,td=0;
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

    const tab = window.open('', '_blank');
    if (tab) { tab.document.write(html); tab.document.close(); }
    else toast('Allow popups to launch build', 'error');
  }

  /* ══════════════════════════════════════
     RESIZE HANDLES
  ══════════════════════════════════════ */
  function makeResizable(handleId, targetId, dir, min, invert = false) {
    const handle = document.getElementById(handleId);
    const target = document.getElementById(targetId);
    if (!handle || !target) return;
    let dragging = false, start = 0, startSize = 0;

    handle.addEventListener('mousedown', e => {
      dragging  = true;
      start     = dir === 'h' ? e.clientX : e.clientY;
      startSize = dir === 'h' ? target.offsetWidth : target.offsetHeight;
      handle.classList.add('dragging');
      document.body.style.cursor     = dir === 'h' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const delta = dir === 'h' ? e.clientX - start : e.clientY - start;
      const size  = Math.max(min, startSize + (invert ? -delta : delta));
      if (dir === 'h') target.style.width  = size + 'px';
      else             target.style.height = size + 'px';
      SceneView._resize();
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      document.body.style.cursor = document.body.style.userSelect = '';
      SceneView._resize();
    });
  }

  makeResizable('resize-left',   'panel-hierarchy', 'h', 150);
  makeResizable('resize-right',  'panel-inspector', 'h', 200, true);
  makeResizable('resize-bottom', 'panel-bottom',    'v', 120, true);

  /* ══════════════════════════════════════
     MONACO CODE EDITOR
  ══════════════════════════════════════ */
  let monacoReady = false, monacoEditor = null;

  function initMonaco() {
    if (monacoReady) return;
    monacoReady = true;
    document.getElementById('monaco-placeholder')?.remove();

    const container = document.getElementById('monaco-container');
    if (!container) return;

    if (!window.require) {
      container.innerHTML = '';
      const ta = document.createElement('textarea');
      ta.style.cssText = 'width:100%;height:100%;background:#111;color:#ccc;border:none;padding:14px;font-family:"JetBrains Mono",monospace;font-size:13px;resize:none;outline:none;line-height:1.6;';
      ta.value = `// CEngine Script\n\nclass PlayerController {\n  onStart() {\n    this.speed = 5;\n    CEngine.log('Player ready');\n  }\n\n  onUpdate(dt) {\n    if (Input.held('right')) this.transform.position.x += this.speed * dt;\n    if (Input.held('left'))  this.transform.position.x -= this.speed * dt;\n    if (Input.held('jump') && this.grounded()) this.rb.addForce(0, 8, 0);\n  }\n\n  onCollide(other) {\n    if (other.tag === 'Enemy') Scene.load('GameOver');\n  }\n}`;
      container.appendChild(ta);
      Console.log('Code editor ready (fallback)', 'log', 'CodeEditor.js');
      return;
    }

    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
    require(['vs/editor/editor.main'], () => {
      container.innerHTML = '';
      monacoEditor = monaco.editor.create(container, {
        value: `// CEngine Script\n\nclass PlayerController {\n  onStart() {\n    this.speed = 5;\n    CEngine.log('Player ready');\n  }\n\n  onUpdate(dt) {\n    if (Input.held('right')) this.transform.position.x += this.speed * dt;\n    if (Input.held('left'))  this.transform.position.x -= this.speed * dt;\n  }\n}`,
        language: 'javascript',
        theme: 'vs-dark',
        fontSize: 13,
        fontFamily: '"JetBrains Mono", monospace',
        fontLigatures: true,
        minimap: { enabled: true },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        cursorBlinking: 'smooth',
        bracketPairColorization: { enabled: true }
      });

      document.getElementById('code-lang-select')?.addEventListener('change', function () {
        const map = { javascript:'javascript', cscript:'javascript', python:'python', lua:'lua', glsl:'glsl', css:'css' };
        monaco.editor.setModelLanguage(monacoEditor.getModel(), map[this.value] || 'javascript');
      });

      Console.log('Monaco Editor ready', 'log', 'CodeEditor.js');
    });
  }

  document.getElementById('btn-save-script')?.addEventListener('click', () => {
    AudioSystem.click();
    toast('Script saved', 'success');
  });

  document.getElementById('btn-run-script')?.addEventListener('click', () => {
    AudioSystem.success();
    if (monacoEditor) {
      try {
        new Function(monacoEditor.getValue())();
        toast('Script executed', 'success');
      } catch (e) {
        Console.log(e.message, 'error', 'Script');
        toast('Error: ' + e.message, 'error');
      }
    }
  });

  /* ══════════════════════════════════════
     CONSOLE WIRING
  ══════════════════════════════════════ */
  document.getElementById('btn-clear-console')?.addEventListener('click', () => {
    AudioSystem.click();
    Console.clear();
  });

  document.getElementById('btn-console-run')?.addEventListener('click', () => {
    const inp = document.getElementById('console-input');
    if (!inp) return;
    AudioSystem.tone(660, 0.07, 0.03);
    Console.exec(inp.value);
    inp.value = '';
  });

  document.getElementById('console-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      document.getElementById('btn-console-run')?.click();
    }
    if (e.key === 'ArrowUp') {
      Console.histIdx = Math.min(Console.histIdx + 1, Console.history.length - 1);
      e.target.value = Console.history[Console.histIdx] || '';
    }
    if (e.key === 'ArrowDown') {
      Console.histIdx = Math.max(Console.histIdx - 1, -1);
      e.target.value = Console.histIdx >= 0 ? Console.history[Console.histIdx] : '';
    }
  });

  document.querySelectorAll('.console-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AudioSystem.click();
      document.querySelectorAll('.console-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.filter;
      document.querySelectorAll('.log-entry').forEach(el => {
        el.style.display = (f === 'all' || el.dataset.type === f) ? '' : 'none';
      });
    });
  });

  document.getElementById('console-filter-input')?.addEventListener('input', function () {
    const q = this.value.toLowerCase();
    document.querySelectorAll('.log-entry').forEach(el => {
      const msg = el.querySelector('.log-msg')?.textContent.toLowerCase() || '';
      el.style.display = msg.includes(q) ? '' : 'none';
    });
  });

  /* ══════════════════════════════════════
     PROJECT PANEL
  ══════════════════════════════════════ */
  document.querySelectorAll('.proj-folder').forEach(f => {
    f.addEventListener('click', () => {
      AudioSystem.click();
      document.querySelectorAll('.proj-folder').forEach(x => x.classList.remove('active'));
      f.classList.add('active');
    });
  });

  document.querySelectorAll('.file-item').forEach(file => {
    file.addEventListener('click', () => {
      AudioSystem.click();
      document.querySelectorAll('.file-item').forEach(x => x.classList.remove('selected'));
      file.classList.add('selected');
      if (file.dataset.type === 'script') {
        const fn = document.getElementById('code-file-name');
        if (fn) fn.textContent = file.dataset.name;
        document.querySelector('.center-tab[data-tab="code"]')?.click();
      }
    });
  });

  /* ══════════════════════════════════════
     GRID + RENDER MODE
  ══════════════════════════════════════ */
  document.getElementById('toggle-grid')?.addEventListener('change', function () {
    SceneView.toggleGrid(this.checked);
  });

  document.getElementById('render-mode')?.addEventListener('change', function () {
    AudioSystem.click();
    SceneView.toggleWireframe(this.value === 'Wireframe');
  });

  /* ══════════════════════════════════════
     AUDIO TOGGLE
  ══════════════════════════════════════ */
  document.getElementById('btn-audio-toggle')?.addEventListener('click', () => {
    AudioSystem.toggle();
  });

  /* ══════════════════════════════════════
     INSPECTOR ICON ROW
  ══════════════════════════════════════ */
  document.querySelectorAll('.inspector-icon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AudioSystem.click();
      document.querySelectorAll('.inspector-icon-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  /* ══════════════════════════════════════
     CENGINE PUBLIC API (console access)
  ══════════════════════════════════════ */
  window.CEngineAPI = {
    add:      type  => SceneView.addPrimitive(type),
    delete:   ()    => SceneView.deleteSelected(),
    focus:    ()    => SceneView.focusSelected(),
    select:   name  => {
      const e = SceneData.entities.find(x => x.name === name);
      if (e) SceneData.select(e.id);
    },
    list:     ()    => SceneData.entities.map(e => e.name),
    log:      msg   => Console.log(String(msg), 'log', 'Script'),
    mode:     mode  => SceneView.setTransformMode(mode)
  };

  /* ══════════════════════════════════════
     PLAY MODE — full runtime integration
  ══════════════════════════════════════ */
  async function startPlayMode() {
    const { Physics, Input, ScriptRuntime, GameLoop, makeSceneAPI } = window.CEngineRuntime;

    document.getElementById('btn-play').disabled  = true;
    document.getElementById('btn-pause').disabled = false;
    document.getElementById('btn-stop').disabled  = false;
    document.getElementById('btn-play').classList.add('playing');
    toast('Starting engine...', 'log', 1000);

    // Init physics
    const physicsOK = await Physics.init();
    if (physicsOK) {
      Console.log('Rapier physics ready', 'log', 'Physics.js');
    } else {
      Console.log('Using fallback physics', 'warn', 'Physics.js');
    }

    // Add rigidbodies to all mesh entities
    SceneData.entities.forEach(entity => {
      if (entity.type === 'mesh' && entity.name !== 'Floor') {
        Physics.addBody(entity, 'dynamic');
        entity._physics = { type:'dynamic', vy:0 };
      }
      if (entity.name === 'Floor') {
        Physics.addBody(entity, 'fixed');
      }
    });

    // Set up particle scene
    window.ParticleSystem?.setScene(SceneView.scene);

    // Build scene API
    const logFn = (msg, type, src) => Console.log(msg, type || 'log', src || 'Script');
    const sceneAPI = makeSceneAPI(
      SceneData.entities,
      { scene: SceneView.scene, THREE },
      logFn
    );

    // Load scripts from FileTree
    const files = SceneSave.getFileList().filter(f => f.type === 'script');
    files.forEach(f => {
      // Attach scripts to entities by matching name
      SceneData.entities.forEach(entity => {
        if (!entity.components) entity.components = [];
        // Auto-attach if script name matches entity name
        const scriptName = f.name.replace(/\.(js|ts|cscript)$/, '');
        if (entity.name.toLowerCase().includes(scriptName.toLowerCase()) ||
            scriptName.toLowerCase().includes(entity.name.toLowerCase())) {
          const existing = entity.components.find(c => c.name === f.name);
          if (!existing) {
            entity.components.push({ type:'script', name:f.name, code:f.content });
          }
        }
      });
    });

    // Init script runtime
    Input.init();
    ScriptRuntime.init(SceneData.entities, sceneAPI);

    playing = true;
    SceneView.playing = true;
    AudioSystem.success();
    Console.log('Play mode started — physics + scripts active', 'log', 'Engine.js');
    toast('Playing', 'success');

    // FPS counter
    fpsInterval = setInterval(() => {
      document.getElementById('fps-counter').textContent = frameCount + ' FPS';
      frameCount = 0;
    }, 1000);

    // Game loop
    GameLoop.start(dt => {
      if (!playing) return;
      frameCount++;

      Input.tick();

      // Physics step
      if (physicsOK) {
        Physics.step(dt);
        Physics.syncToMeshes(SceneData.entities);
      } else {
        Physics.stepFallback(SceneData.entities, dt);
      }

      // Script update
      ScriptRuntime.update(dt);

      // Particle update
      window.ParticleSystem?.update(dt);

      // Animation update
      AnimationSystem._applyFrame(AnimationSystem.currentFrame);
      if (AnimationSystem.playing) {
        AnimationSystem.currentFrame = Math.min(
          AnimationSystem.totalFrames,
          AnimationSystem.currentFrame + dt * AnimationSystem.fps
        );
      }

      // Update inspector if something selected
      const sel = SceneData.getById(SceneData.selected);
      if (sel) Inspector.update(sel);
    });
  }

  function stopPlayMode() {
    const { Physics, ScriptRuntime, GameLoop } = window.CEngineRuntime;

    playing = false;
    SceneView.playing = false;
    GameLoop.stop();
    ScriptRuntime.stop();
    window.ParticleSystem?.stopAll();

    // Clean up physics bodies
    SceneData.entities.forEach(e => Physics.removeBody(e.id));

    document.getElementById('btn-play').disabled  = false;
    document.getElementById('btn-pause').disabled = true;
    document.getElementById('btn-stop').disabled  = true;
    document.getElementById('btn-play').classList.remove('playing');
    document.getElementById('fps-counter').textContent = '-- FPS';
    clearInterval(fpsInterval);

    AudioSystem.tone(220, 0.15, 0.05);
    Console.log('Play mode stopped', 'log', 'Engine.js');
    toast('Stopped');
  }

  /* ══════════════════════════════════════
     INIT
  ══════════════════════════════════════ */
  AudioSystem.init();
  buildInsertToolbar();
  SceneView.init();
  Inspector.clear();
  FileTree.init();
  AnimationSystem.init();

  // Build sound + particle panels
  setTimeout(() => {
    window.SoundEngine?.buildEditorPanel();
    // Inject particle editor into blueprint tab for now
    const bpWrap = document.getElementById('tab-blueprint');
    if (bpWrap) {
      const peWrap = document.createElement('div');
      peWrap.id = 'particle-editor-wrap';
      peWrap.style.cssText = 'flex:1;overflow:hidden;display:flex;';
      bpWrap.appendChild(peWrap);
      window.ParticleSystem?.buildEditorPanel();
    }
  }, 500);

  // Wire play/stop to full runtime
  document.getElementById('btn-play')?.addEventListener('click', startPlayMode);
  document.getElementById('btn-stop')?.addEventListener('click', stopPlayMode);
  document.getElementById('btn-pause')?.addEventListener('click', () => {
    playing = !playing;
    SceneView.playing = playing;
    AudioSystem.warn();
    toast(playing ? 'Resumed' : 'Paused');
  });

  // Sync _selMesh for inspector sliders
  setInterval(() => {
    const e = SceneData.getById(SceneData.selected);
    window._selMesh = e?.mesh || null;
  }, 100);

  setTimeout(() => Console.log('CEngine v0.4 ready', 'log', 'Engine.js'),    100);
  setTimeout(() => Console.log('Three.js r128 renderer active', 'log', 'Renderer.js'), 200);
  setTimeout(() => Console.log('Physics: Rapier.js — loading...', 'log', 'Physics.js'), 300);
  setTimeout(() => Console.log('Tip: Place objects → hit Play → they fall with physics!', 'log', 'Editor.js'), 800);
  setTimeout(() => toast('CEngine v0.4 — Physics + Sound + Particles', 'success', 4000), 600);
