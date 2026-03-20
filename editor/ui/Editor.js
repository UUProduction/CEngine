/* ═══════════════════════════════════════════
   CENGINE EDITOR.JS v0.3
   Full scene editor — Roblox+Blender+Unity
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
    ctx: null, muted: false, enabled: false,
    ambient: document.getElementById('audio-ambient'),

    init() {
      if (this.ambient) this.ambient.volume = 0.15;
      document.addEventListener('click', () => {
        if (!this.enabled) {
          this.enabled = true;
          if (this.ambient) this.ambient.play().catch(() => {});
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
      }, { once: true });
    },

    toggle() {
      this.muted = !this.muted;
      if (this.ambient) this.ambient.muted = this.muted;
      document.getElementById('btn-audio-toggle').classList.toggle('active', !this.muted);
      toast(this.muted ? 'Audio muted' : 'Audio on');
    },

    tone(freq = 660, dur = 0.08, vol = 0.04, type = 'sine') {
      if (this.muted || !this.ctx) return;
      try {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.connect(g); g.connect(this.ctx.destination);
        o.type = type;
        o.frequency.setValueAtTime(freq, this.ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(freq * 0.8, this.ctx.currentTime + dur);
        g.gain.setValueAtTime(vol, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        o.start(); o.stop(this.ctx.currentTime + dur);
      } catch (e) {}
    },

    click() { this.tone(780, 0.05, 0.03); },
    success() { this.tone(880, 0.15, 0.05); setTimeout(() => this.tone(1100, 0.1, 0.04), 120); },
    error() { this.tone(200, 0.2, 0.05, 'sawtooth'); }
  };

  /* ══════════════════════════════════════
     TOAST
  ══════════════════════════════════════ */
  function toast(msg, type = 'log', dur = 2500) {
    const c = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${msg}</span>`;
    c.appendChild(el);
    if (type === 'success') AudioSystem.success();
    else if (type === 'error') AudioSystem.error();
    else AudioSystem.tone(600, 0.08, 0.03);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, dur);
  }

  /* ══════════════════════════════════════
     CONSOLE
  ══════════════════════════════════════ */
  const Console = {
    el: document.getElementById('console-output'),
    counts: { log: 0, warn: 0, error: 0 },
    history: [], histIdx: -1,

    log(msg, type = 'log', src = 'Editor.js') {
      const t = (performance.now() / 1000).toFixed(3);
      const div = document.createElement('div');
      div.className = `log-entry ${type}`;
      div.dataset.type = type;
      const svgs = {
        log: `<svg class="log-icon" width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" stroke="#44ff88" stroke-width="1.2" fill="none"/></svg>`,
        warn: `<svg class="log-icon" width="10" height="10" viewBox="0 0 10 10"><path d="M5 1l4 8H1z" stroke="#ffaa00" stroke-width="1.2" fill="none"/></svg>`,
        error: `<svg class="log-icon" width="10" height="10" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6" stroke="#ff4455" stroke-width="1.2" stroke-linecap="round"/></svg>`
      };
      div.innerHTML = `${svgs[type]||svgs.log}<span class="log-time">${t}</span><span class="log-msg">${msg}</span><span class="log-source">${src}</span>`;
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
      this.el.innerHTML = '';
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
        const res = Function(`"use strict";with(window.CEngineAPI||{})return(${cmd})`)();
        if (res !== undefined) this.log(JSON.stringify(res), 'log', 'Console');
      } catch (e) { this.log(e.message, 'error', 'Console'); }
    }
  };

  /* ══════════════════════════════════════
     SCENE DATA MODEL
  ══════════════════════════════════════ */
  const SceneData = {
    entities: [],
    selected: null,
    nextId: 1,

    add(name, type, mesh3d = null) {
      const entity = {
        id: this.nextId++,
        name,
        type,
        active: true,
        mesh: mesh3d,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        components: [],
        children: []
      };
      this.entities.push(entity);
      return entity;
    },

    getById(id) {
      return this.entities.find(e => e.id === id);
    },

    remove(id) {
      const e = this.getById(id);
      if (e && e.mesh) {
        SceneView.scene.remove(e.mesh);
        e.mesh.geometry?.dispose();
        e.mesh.material?.dispose();
      }
      this.entities = this.entities.filter(e => e.id !== id);
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
        SceneView.focusEntity(e);
      }
    }
  };

  /* ══════════════════════════════════════
     THREE.JS SCENE VIEW
     Scene IS the game view — same render
  ══════════════════════════════════════ */
  const SceneView = {
    renderer: null, scene: null, camera: null,
    gizmoRenderer: null, gizmoScene: null, gizmoCamera: null,
    grid: null, ambientLight: null, dirLight: null,
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    transformGizmo: null,
    playing: false,

    // Camera orbit state
    theta: 0.6, phi: 1.0, radius: 12,
    orbitTarget: new THREE.Vector3(0, 0, 0),

    // Gyro state
    gyroEnabled: false,
    alpha: 0, beta: 0, gamma: 0,

    // Drag state
    isDragging: false,
    lastX: 0, lastY: 0,

    // Touch state
    isTouching: false,
    touchStartX: 0, touchStartY: 0,
    lastTouchDist: 0,

    // Transform mode
    transformMode: 'translate', // translate | rotate | scale
    transformAxis: null, // x | y | z | null
    isDraggingTransform: false,
    transformStart: null,

    init() {
      const canvas = document.getElementById('scene-canvas');
      if (!canvas || typeof THREE === 'undefined') return;

      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.2;

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x12121e);
      this.scene.fog = new THREE.FogExp2(0x12121e, 0.018);

      this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
      this._updateCameraPosition();

      // Lights
      this.ambientLight = new THREE.AmbientLight(0x334466, 1.5);
      this.scene.add(this.ambientLight);

      this.dirLight = new THREE.DirectionalLight(0xffeedd, 2.5);
      this.dirLight.position.set(8, 12, 6);
      this.dirLight.castShadow = true;
      this.dirLight.shadow.mapSize.set(2048, 2048);
      this.dirLight.shadow.camera.near = 0.1;
      this.dirLight.shadow.camera.far = 80;
      this.dirLight.shadow.camera.left = -20;
      this.dirLight.shadow.camera.right = 20;
      this.dirLight.shadow.camera.top = 20;
      this.dirLight.shadow.camera.bottom = -20;
      this.scene.add(this.dirLight);

      const fillLight = new THREE.PointLight(0x00d4ff, 1.5, 25);
      fillLight.position.set(-6, 4, -4);
      this.scene.add(fillLight);

      // Grid
      this.grid = new THREE.GridHelper(40, 40, 0x1a1a30, 0x111122);
      this.scene.add(this.grid);

      // Ground plane (invisible, receives shadows)
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshStandardMaterial({ color: 0x0d0d18, roughness: 1 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.001;
      ground.receiveShadow = true;
      this.scene.add(ground);

      // Gizmo viewport
      this._initGizmoView();

      // Transform gizmo arrows
      this._initTransformGizmo();

      // Event listeners
      this._bindEvents(canvas);

      // Gyroscope
      this._initGyro();

      // Resize
      window.addEventListener('resize', () => this._resize());
      this._resize();

      // Default entities
      this._addDefaultEntities();

      // Animate
      this._animate();

      Console.log('SceneView initialized — Scene IS Game view', 'log', 'SceneView.js');
    },

    _addDefaultEntities() {
      // Default cube
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshStandardMaterial({ color: 0x4488ff, metalness: 0.2, roughness: 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(0, 0.5, 0);
      this.scene.add(mesh);
      const e = SceneData.add('Cube', 'mesh', mesh);
      e.position = { x: 0, y: 0.5, z: 0 };

      // Update hierarchy
      HierarchyPanel.refresh();
    },

    _updateCameraPosition() {
      if (!this.camera) return;
      this.camera.position.set(
        this.orbitTarget.x + this.radius * Math.sin(this.phi) * Math.sin(this.theta),
        this.orbitTarget.y + this.radius * Math.cos(this.phi),
        this.orbitTarget.z + this.radius * Math.sin(this.phi) * Math.cos(this.theta)
      );
      this.camera.lookAt(this.orbitTarget);
    },

    _initGizmoView() {
      const gCanvas = document.getElementById('gizmo-canvas');
      if (!gCanvas) return;
      this.gizmoRenderer = new THREE.WebGLRenderer({ canvas: gCanvas, alpha: true, antialias: true });
      this.gizmoRenderer.setSize(80, 80);
      this.gizmoScene = new THREE.Scene();
      this.gizmoCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      this.gizmoCamera.position.set(0, 0, 3);

      const axes = [
        { dir: [1,0,0], color: 0xff4444, label: 'X' },
        { dir: [0,1,0], color: 0x44ff44, label: 'Y' },
        { dir: [0,0,1], color: 0x4488ff, label: 'Z' }
      ];

      axes.forEach(({ dir, color }) => {
        const mat = new THREE.MeshBasicMaterial({ color });
        const line = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6), mat);
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.12, 0.25, 8), mat);
        line.rotation.z = dir[0] ? Math.PI / 2 : (dir[2] ? Math.PI / 2 : 0);
        if (dir[2]) { line.rotation.x = Math.PI / 2; line.rotation.z = 0; }
        line.position.set(dir[0]*0.4, dir[1]*0.4, dir[2]*0.4);
        tip.position.set(dir[0]*0.9, dir[1]*0.9, dir[2]*0.9);
        tip.rotation.z = dir[0] ? -Math.PI / 2 : (dir[2] ? Math.PI / 2 : 0);
        if (dir[2]) { tip.rotation.x = Math.PI / 2; tip.rotation.z = 0; }
        this.gizmoScene.add(line, tip);
      });
    },

    _initTransformGizmo() {
      this.transformGizmoGroup = new THREE.Group();
      this.transformGizmoGroup.visible = false;

      const colors = { x: 0xff3333, y: 0x33ff33, z: 0x3333ff };
      const dirs = { x: [1,0,0], y: [0,1,0], z: [0,0,1] };

      Object.entries(colors).forEach(([axis, color]) => {
        const mat = new THREE.MeshBasicMaterial({ color, depthTest: false });
        const line = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8), mat);
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.1, 0.3, 8), mat);
        const [x,y,z] = dirs[axis];
        line.position.set(x*0.6, y*0.6, z*0.6);
        tip.position.set(x*1.3, y*1.3, z*1.3);
        if (axis === 'x') { line.rotation.z = -Math.PI/2; tip.rotation.z = -Math.PI/2; }
        if (axis === 'z') { line.rotation.x = Math.PI/2; tip.rotation.x = Math.PI/2; }
        line.userData.axis = axis;
        tip.userData.axis = axis;
        this.transformGizmoGroup.add(line, tip);
      });

      this.scene.add(this.transformGizmoGroup);
    },

    _bindEvents(canvas) {
      // RMB orbit
      canvas.addEventListener('mousedown', e => {
        if (e.button === 2) {
          this.isDragging = true;
          this.lastX = e.clientX;
          this.lastY = e.clientY;
          canvas.style.cursor = 'grabbing';
        }
        if (e.button === 0) {
          this._onLeftClick(e, canvas);
        }
      });

      document.addEventListener('mousemove', e => {
        if (this.isDragging) {
          const dx = e.clientX - this.lastX;
          const dy = e.clientY - this.lastY;
          this.theta -= dx * 0.008;
          this.phi = Math.max(0.05, Math.min(Math.PI - 0.05, this.phi + dy * 0.008));
          this.lastX = e.clientX;
          this.lastY = e.clientY;
          this._updateCameraPosition();
        }
      });

      document.addEventListener('mouseup', e => {
        if (e.button === 2) {
          this.isDragging = false;
          canvas.style.cursor = '';
        }
      });

      canvas.addEventListener('contextmenu', e => e.preventDefault());

      canvas.addEventListener('wheel', e => {
        this.radius = Math.max(1.5, Math.min(80, this.radius + e.deltaY * 0.025));
        this._updateCameraPosition();
        e.preventDefault();
      }, { passive: false });

      // Touch events (orbit + pinch zoom — works on phone holding screen)
      canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        if (e.touches.length === 1) {
          this.isTouching = true;
          this.touchStartX = e.touches[0].clientX;
          this.touchStartY = e.touches[0].clientY;
          this.lastX = this.touchStartX;
          this.lastY = this.touchStartY;
        }
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          this.lastTouchDist = Math.sqrt(dx*dx + dy*dy);
        }
      }, { passive: false });

      canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        if (e.touches.length === 1 && this.isTouching) {
          const dx = e.touches[0].clientX - this.lastX;
          const dy = e.touches[0].clientY - this.lastY;
          this.theta -= dx * 0.008;
          this.phi = Math.max(0.05, Math.min(Math.PI - 0.05, this.phi + dy * 0.008));
          this.lastX = e.touches[0].clientX;
          this.lastY = e.touches[0].clientY;
          this._updateCameraPosition();
        }
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          this.radius = Math.max(1.5, Math.min(80, this.radius - (dist - this.lastTouchDist) * 0.05));
          this.lastTouchDist = dist;
          this._updateCameraPosition();
        }
      }, { passive: false });

      canvas.addEventListener('touchend', e => {
        if (e.touches.length === 0) this.isTouching = false;
      });

      // WASD pan
      const keys = {};
      document.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
      document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

      const panSpeed = 0.06;
      setInterval(() => {
        if (!document.activeElement || document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
        const forward = new THREE.Vector3(
          -Math.sin(this.theta), 0, -Math.cos(this.theta)
        ).normalize();
        const right = new THREE.Vector3(
          Math.cos(this.theta), 0, -Math.sin(this.theta)
        ).normalize();
        if (keys['w']) { this.orbitTarget.addScaledVector(forward, panSpeed); this._updateCameraPosition(); }
        if (keys['s']) { this.orbitTarget.addScaledVector(forward, -panSpeed); this._updateCameraPosition(); }
        if (keys['a']) { this.orbitTarget.addScaledVector(right, -panSpeed); this._updateCameraPosition(); }
        if (keys['d']) { this.orbitTarget.addScaledVector(right, panSpeed); this._updateCameraPosition(); }
        if (keys['q']) { this.orbitTarget.y -= panSpeed; this._updateCameraPosition(); }
        if (keys['e']) { this.orbitTarget.y += panSpeed; this._updateCameraPosition(); }
      }, 16);
    },

    _onLeftClick(e, canvas) {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);

      // Check entities
      const meshes = SceneData.entities.filter(e => e.mesh).map(e => e.mesh);
      const hits = this.raycaster.intersectObjects(meshes, true);

      if (hits.length > 0) {
        const hitMesh = hits[0].object;
        const entity = SceneData.entities.find(e => e.mesh === hitMesh || (hitMesh.parent && e.mesh === hitMesh.parent));
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
    },

    _initGyro() {
      // Request permission on iOS 13+
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        // Will be triggered by user gesture
        window._requestGyro = () => {
          DeviceOrientationEvent.requestPermission()
            .then(state => {
              if (state === 'granted') this._startGyro();
            }).catch(console.error);
        };
      } else {
        this._startGyro();
      }
    },

    _startGyro() {
      window.addEventListener('deviceorientation', e => {
        if (!this.gyroEnabled) return;
        // Map device orientation to camera angles
        // beta = front-back tilt (0-180), gamma = left-right (-90 to 90)
        const beta = THREE.MathUtils.degToRad(e.beta || 0);
        const gamma = THREE.MathUtils.degToRad(e.gamma || 0);
        const alpha = THREE.MathUtils.degToRad(e.alpha || 0);

        // Smooth the gyro input
        this.phi = THREE.MathUtils.lerp(this.phi, Math.max(0.1, Math.min(Math.PI - 0.1, beta)), 0.1);
        this.theta = THREE.MathUtils.lerp(this.theta, -alpha * 0.5, 0.05);
        this._updateCameraPosition();
      }, true);

      this.gyroEnabled = true;
      Console.log('Gyroscope camera enabled', 'log', 'SceneView.js');
      toast('Gyroscope camera active — tilt your device to look around', 'success', 4000);
    },

    toggleGyro() {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function' &&
          !this.gyroEnabled) {
        window._requestGyro && window._requestGyro();
      } else {
        this.gyroEnabled = !this.gyroEnabled;
        toast(this.gyroEnabled ? 'Gyro look: ON' : 'Gyro look: OFF');
        Console.log(`Gyro: ${this.gyroEnabled}`, 'log', 'SceneView.js');
      }
    },

    setTransformMode(mode) {
      this.transformMode = mode;
      if (this.transformGizmoGroup) this._updateGizmoForMode();
      Console.log(`Transform mode: ${mode}`, 'log', 'SceneView.js');
    },

    _updateGizmoForMode() {
      // Tint gizmo based on mode
      // (for now just log — full gizmo interaction in next pass)
    },

    focusEntity(e) {
      if (!e || !e.mesh) return;
      const p = e.mesh.position;
      this.orbitTarget.set(p.x, p.y, p.z);
      this.radius = 5;
      this._updateCameraPosition();

      // Show transform gizmo on selected entity
      this.transformGizmoGroup.position.copy(e.mesh.position);
      this.transformGizmoGroup.position.y += 0;
      this.transformGizmoGroup.visible = true;
    },

    addPrimitive(type) {
      let geo, mat, color = 0x88aaff;
      switch (type) {
        case 'cube':     geo = new THREE.BoxGeometry(1,1,1);          color = 0x4488ff; break;
        case 'sphere':   geo = new THREE.SphereGeometry(0.5, 24, 24); color = 0xff8844; break;
        case 'cylinder': geo = new THREE.CylinderGeometry(0.5,0.5,1,24); color = 0x44ff88; break;
        case 'plane':    geo = new THREE.PlaneGeometry(2,2);          color = 0x888888; break;
        case 'torus':    geo = new THREE.TorusGeometry(0.5,0.2,16,32); color = 0xff44aa; break;
        case 'cone':     geo = new THREE.ConeGeometry(0.5,1,24);      color = 0xffdd44; break;
        case 'capsule':  geo = new THREE.CylinderGeometry(0.35,0.35,1,16); color = 0xaa44ff; break;
        default:         geo = new THREE.BoxGeometry(1,1,1);          color = 0xffffff;
      }

      mat = new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.6 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Drop at center, slightly above ground
      mesh.position.set(
        (Math.random() - 0.5) * 4,
        0.5,
        (Math.random() - 0.5) * 4
      );

      if (type === 'plane') {
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.01;
      }

      this.scene.add(mesh);
      const name = type.charAt(0).toUpperCase() + type.slice(1);
      const entity = SceneData.add(name, 'mesh', mesh);
      entity.position = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
      HierarchyPanel.refresh();
      SceneData.select(entity.id);
      HierarchyPanel.selectItem(entity.id);
      AudioSystem.tone(880, 0.12, 0.05);
      Console.log(`Added: ${name}`, 'log', 'Scene.js');
      toast(`Added ${name}`, 'success');
      return entity;
    },

    addLight(type) {
      let light, helper;
      const name = type === 'point' ? 'Point Light' : type === 'spot' ? 'Spot Light' : 'Dir Light';

      switch (type) {
        case 'point':
          light = new THREE.PointLight(0xffffff, 1.5, 20);
          light.position.set(2, 3, 2);
          helper = new THREE.PointLightHelper(light, 0.3);
          break;
        case 'spot':
          light = new THREE.SpotLight(0xffffff, 2, 30, Math.PI / 6);
          light.position.set(0, 6, 0);
          helper = new THREE.SpotLightHelper(light);
          break;
        default:
          light = new THREE.DirectionalLight(0xffffff, 1);
          light.position.set(3, 6, 3);
          helper = new THREE.DirectionalLightHelper(light, 1);
      }

      this.scene.add(light);
      if (helper) this.scene.add(helper);

      const group = new THREE.Group();
      group.add(light);
      const entity = SceneData.add(name, 'light', group);
      entity.position = { x: light.position.x, y: light.position.y, z: light.position.z };
      HierarchyPanel.refresh();
      AudioSystem.tone(660, 0.1, 0.04);
      toast(`Added ${name}`, 'success');
    },

    deleteSelected() {
      if (!SceneData.selected) return;
      const id = SceneData.selected;
      SceneData.remove(id);
      this.transformGizmoGroup.visible = false;
      HierarchyPanel.refresh();
      toast('Entity deleted', 'warn');
      Console.log(`Entity ${id} deleted`, 'warn', 'Scene.js');
    },

    duplicateSelected() {
      const e = SceneData.getById(SceneData.selected);
      if (!e || !e.mesh) return;
      const newMesh = e.mesh.clone();
      newMesh.position.x += 1.2;
      this.scene.add(newMesh);
      const ne = SceneData.add(e.name + ' (Copy)', e.type, newMesh);
      ne.position = { x: newMesh.position.x, y: newMesh.position.y, z: newMesh.position.z };
      HierarchyPanel.refresh();
      SceneData.select(ne.id);
      toast(`Duplicated: ${e.name}`, 'success');
    },

    toggleGrid(v) {
      if (this.grid) this.grid.visible = v;
    },

    toggleWireframe(v) {
      SceneData.entities.forEach(e => {
        if (e.mesh && e.mesh.material) {
          e.mesh.material.wireframe = v;
        }
      });
    },

    _resize() {
      const canvas = document.getElementById('scene-canvas');
      if (!canvas || !this.renderer) return;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    },

    _animate() {
      requestAnimationFrame(() => this._animate());
      if (!this.renderer) return;

      // Sync transform gizmo to selected entity
      const sel = SceneData.getById(SceneData.selected);
      if (sel && sel.mesh && this.transformGizmoGroup.visible) {
        this.transformGizmoGroup.position.copy(sel.mesh.position);
        // Scale gizmo with camera distance
        const dist = this.camera.position.distanceTo(sel.mesh.position);
        const s = dist * 0.12;
        this.transformGizmoGroup.scale.setScalar(s);
      }

      // Sync transform gizmo camera rotation (always face camera)
      if (this.transformGizmoGroup.visible) {
        this.transformGizmoGroup.quaternion.copy(new THREE.Quaternion());
      }

      this.renderer.render(this.scene, this.camera);

      // Gizmo view
      if (this.gizmoRenderer && this.gizmoScene && this.gizmoCamera) {
        // Mirror main camera rotation on gizmo
        const dir = new THREE.Vector3().subVectors(this.camera.position, this.orbitTarget).normalize();
        this.gizmoCamera.position.copy(dir.multiplyScalar(3));
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
      this.tree.innerHTML = '';
      SceneData.entities.forEach(entity => {
        const item = this._makeItem(entity);
        this.tree.appendChild(item);
      });
    },

    _makeItem(entity) {
      const item = document.createElement('div');
      item.className = 'tree-item' + (SceneData.selected === entity.id ? ' selected' : '');
      item.dataset.entityId = entity.id;

      const icons = {
        mesh: `<svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1l5 3v4l-5 3-5-3V4z" stroke="#aaaaff" stroke-width="1.2" fill="none"/></svg>`,
        light: `<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="5" r="2.5" stroke="#ffee88" stroke-width="1.2" fill="none"/><path d="M6 8v2M3 7l-1.5 1M9 7l1.5 1" stroke="#ffee88" stroke-width="1.2"/></svg>`,
        camera: `<svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="3" width="8" height="6" rx="1" stroke="#88aaff" stroke-width="1.2" fill="none"/><polygon points="9,5 11,4 11,8 9,7" stroke="#88aaff" stroke-width="1.2" fill="none"/></svg>`,
        empty: `<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4" stroke="#888" stroke-width="1.2" fill="none" stroke-dasharray="2 2"/></svg>`
      };

      item.innerHTML = `
        <span class="tree-indent"></span>
        <svg class="tree-arrow invisible" width="8" height="8" viewBox="0 0 8 8"><path d="M2 2l4 2-4 2" fill="currentColor"/></svg>
        ${icons[entity.type] || icons.empty}
        <span class="tree-label">${entity.name}</span>
        <button class="tree-eye" title="Toggle visibility" data-id="${entity.id}">
          <svg width="10" height="10" viewBox="0 0 10 10"><ellipse cx="5" cy="5" rx="4" ry="2.5" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="5" cy="5" r="1.2" fill="currentColor"/></svg>
        </button>
      `;

      item.addEventListener('click', e => {
        if (e.target.closest('.tree-eye')) return;
        AudioSystem.click();
        document.querySelectorAll('.tree-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        SceneData.select(entity.id);
      });

      item.querySelector('.tree-eye').addEventListener('click', e => {
        e.stopPropagation();
        AudioSystem.click();
        entity.active = !entity.active;
        if (entity.mesh) entity.mesh.visible = entity.active;
        item.querySelector('.tree-eye').style.opacity = entity.active ? '1' : '0.3';
      });

      item.addEventListener('contextmenu', e => {
        e.preventDefault();
        SceneData.select(entity.id);
        this.selectItem(entity.id);
        ContextMenu.show(e.clientX, e.clientY, 'entity');
      });

      return item;
    },

    selectItem(id) {
      document.querySelectorAll('.tree-item[data-entity-id]').forEach(el => {
        el.classList.toggle('selected', parseInt(el.dataset.entityId) === id);
      });
    },

    clearSelection() {
      document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
    }
  };

  /* ══════════════════════════════════════
     INSPECTOR PANEL
  ══════════════════════════════════════ */
  const Inspector = {
    body: document.getElementById('inspector-body'),

    update(entity) {
      this.body.innerHTML = `
        <div class="inspector-entity-header">
          <input type="checkbox" ${entity.active ? 'checked' : ''} id="entity-active"/>
          <input type="text" class="entity-name-input" value="${entity.name}" id="entity-name"/>
          <span class="entity-tag">${entity.type}</span>
        </div>

        <div class="component-block">
          <div class="component-header">
            <svg class="comp-arrow open" width="8" height="8" viewBox="0 0 8 8"><path d="M1 2l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
            <span class="component-title">Transform</span>
          </div>
          <div class="component-body">
            ${this._vec3Row('Position', 'pos', entity.position)}
            ${this._vec3Row('Rotation', 'rot', entity.rotation)}
            ${this._vec3Row('Scale', 'scl', entity.scale)}
          </div>
        </div>

        ${entity.type === 'mesh' ? this._meshBlock(entity) : ''}
        ${entity.type === 'light' ? this._lightBlock(entity) : ''}

        <div class="add-component-area">
          <button class="add-component-btn" id="btn-add-component">
            <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Add Component
          </button>
        </div>
      `;

      // Live transform update
      ['pos', 'rot', 'scl'].forEach(prefix => {
        ['x', 'y', 'z'].forEach(axis => {
          const input = document.getElementById(`${prefix}-${axis}`);
          if (!input) return;
          input.addEventListener('input', () => {
            const val = parseFloat(input.value) || 0;
            const key = prefix === 'pos' ? 'position' : prefix === 'rot' ? 'rotation' : 'scale';
            entity[key][axis] = val;
            if (entity.mesh) {
              if (key === 'position') entity.mesh.position[axis] = val;
              if (key === 'rotation') entity.mesh.rotation[axis] = THREE.MathUtils.degToRad(val);
              if (key === 'scale') entity.mesh.scale[axis] = val;
              SceneView.transformGizmoGroup.position.copy(entity.mesh.position);
            }
          });
        });
      });

      // Name update
      const nameInput = document.getElementById('entity-name');
      if (nameInput) {
        nameInput.addEventListener('input', () => {
          entity.name = nameInput.value;
          HierarchyPanel.refresh();
          HierarchyPanel.selectItem(entity.id);
        });
      }

      // Active toggle
      const activeCheck = document.getElementById('entity-active');
      if (activeCheck) {
        activeCheck.addEventListener('change', () => {
          entity.active = activeCheck.checked;
          if (entity.mesh) entity.mesh.visible = entity.active;
        });
      }

      // Add component
      const addBtn = document.getElementById('btn-add-component');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          AudioSystem.click();
          toast('Component picker coming in v0.3', 'warn');
        });
      }

      // Component collapse
      document.querySelectorAll('.component-header').forEach(header => {
        header.addEventListener('click', () => {
          AudioSystem.click();
          const body = header.nextElementSibling;
          if (body) {
            const open = body.style.display !== 'none';
            body.style.display = open ? 'none' : '';
            header.querySelector('.comp-arrow').classList.toggle('open', !open);
          }
        });
      });
    },

    _vec3Row(label, prefix, values) {
      const v = values || { x: 0, y: 0, z: 0 };
      return `
        <div class="prop-row">
          <span class="prop-label">${label}</span>
          <div class="vec3-inputs">
            <label class="x-label">X<input id="${prefix}-x" type="number" class="vec-input" value="${(v.x||0).toFixed(3)}" step="0.1"/></label>
            <label class="y-label">Y<input id="${prefix}-y" type="number" class="vec-input" value="${(v.y||0).toFixed(3)}" step="0.1"/></label>
            <label class="z-label">Z<input id="${prefix}-z" type="number" class="vec-input" value="${(v.z||0).toFixed(3)}" step="0.1"/></label>
          </div>
        </div>`;
    },

    _meshBlock(entity) {
      return `
        <div class="component-block">
          <div class="component-header">
            <svg class="comp-arrow open" width="8" height="8" viewBox="0 0 8 8"><path d="M1 2l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
            <span class="component-title">Mesh Renderer</span>
          </div>
          <div class="component-body">
            <div class="prop-row">
              <span class="prop-label">Color</span>
              <input type="color" class="prop-color" id="mesh-color" value="#4488ff"/>
            </div>
            <div class="prop-row">
              <span class="prop-label">Metalness</span>
              <input type="range" class="prop-slider" min="0" max="1" step="0.01" value="${entity.mesh?.material?.metalness ?? 0.1}"/>
            </div>
            <div class="prop-row">
              <span class="prop-label">Roughness</span>
              <input type="range" class="prop-slider" min="0" max="1" step="0.01" value="${entity.mesh?.material?.roughness ?? 0.6}"/>
            </div>
            <div class="prop-row">
              <span class="prop-label">Wireframe</span>
              <input type="checkbox" ${entity.mesh?.material?.wireframe ? 'checked' : ''}/>
            </div>
            <div class="prop-row">
              <span class="prop-label">Cast Shadow</span>
              <input type="checkbox" ${entity.mesh?.castShadow ? 'checked' : ''} checked/>
            </div>
          </div>
        </div>`;
    },

    _lightBlock(entity) {
      return `
        <div class="component-block">
          <div class="component-header">
            <svg class="comp-arrow open" width="8" height="8" viewBox="0 0 8 8"><path d="M1 2l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
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
      this.body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:var(--text-dim);">
          <svg width="32" height="32" viewBox="0 0 32 32" opacity="0.3"><circle cx="16" cy="12" r="6" stroke="#00d4ff" stroke-width="1.5" fill="none"/><path d="M6 26c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="#00d4ff" stroke-width="1.5" fill="none"/></svg>
          <p style="font-size:12px">Select an entity</p>
          <p style="font-size:10px">to view properties</p>
        </div>`;
    }
  };

  /* ══════════════════════════════════════
     OBJECT PLACEMENT TOOLBAR
     Roblox Studio style insert menu
  ══════════════════════════════════════ */
  function buildInsertToolbar() {
    // Inject the insert toolbar below menubar
    const menubar = document.getElementById('menubar');
    const bar = document.createElement('div');
    bar.id = 'insert-toolbar';
    bar.innerHTML = `
      <span class="insert-label">Insert</span>

      <div class="insert-group">
        <button class="insert-btn" data-type="cube" title="Cube">
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2l6 3.5v5L8 14l-6-3.5v-5L8 2z" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M8 2v5.5M14 5.5L8 7.5M2 5.5L8 7.5" stroke="currentColor" stroke-width="1" opacity="0.6"/></svg>
          Cube
        </button>
        <button class="insert-btn" data-type="sphere" title="Sphere">
          <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2" fill="none"/><ellipse cx="8" cy="8" rx="6" ry="2.5" stroke="currentColor" stroke-width="0.8" fill="none"/></svg>
          Sphere
        </button>
        <button class="insert-btn" data-type="cylinder" title="Cylinder">
          <svg width="16" height="16" viewBox="0 0 16 16"><ellipse cx="8" cy="4.5" rx="5" ry="2" stroke="currentColor" stroke-width="1.2" fill="none"/><ellipse cx="8" cy="11.5" rx="5" ry="2" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M3 4.5v7M13 4.5v7" stroke="currentColor" stroke-width="1.2"/></svg>
          Cylinder
        </button>
        <button class="insert-btn" data-type="plane" title="Plane">
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 10l6-4 6 4M2 10h12" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M2 10v2h12v-2" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
          Plane
        </button>
        <button class="insert-btn" data-type="cone" title="Cone">
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2l6 10H2L8 2z" stroke="currentColor" stroke-width="1.2" fill="none"/><ellipse cx="8" cy="12" rx="6" ry="1.5" stroke="currentColor" stroke-width="1" fill="none"/></svg>
          Cone
        </button>
        <button class="insert-btn" data-type="torus" title="Torus">
          <svg width="16" height="16" viewBox="0 0 16 16"><ellipse cx="8" cy="8" rx="5.5" ry="3" stroke="currentColor" stroke-width="1.2" fill="none"/><ellipse cx="8" cy="8" rx="2.5" ry="1.5" stroke="currentColor" stroke-width="1" fill="none" opacity="0.5"/></svg>
          Torus
        </button>
      </div>

      <div class="insert-divider"></div>

      <div class="insert-group">
        <button class="insert-btn" data-light="point" title="Point Light">
          <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="7" r="3" stroke="#ffee88" stroke-width="1.2" fill="none"/><path d="M8 1v2M8 12v2M1 7h2M12 7h2M3 3l1.5 1.5M11.5 11.5L13 13M3 11l1.5-1.5M11.5 3L13 1.5" stroke="#ffee88" stroke-width="1.2"/></svg>
          Point
        </button>
        <button class="insert-btn" data-light="spot" title="Spot Light">
          <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="5" r="2.5" stroke="#ffee88" stroke-width="1.2" fill="none"/><path d="M5 8l-2 5M11 8l2 5M5 8h6" stroke="#ffee88" stroke-width="1.2"/></svg>
          Spot
        </button>
        <button class="insert-btn" data-special="camera" title="Camera">
          <svg width="16" height="16" viewBox="0 0 16 16"><rect x="1" y="4" width="10" height="8" rx="1" stroke="#88aaff" stroke-width="1.2" fill="none"/><polygon points="11,6.5 15,5 15,11 11,9.5" stroke="#88aaff" stroke-width="1.2" fill="none"/></svg>
          Camera
        </button>
        <button class="insert-btn" data-special="empty" title="Empty">
          <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.2" fill="none" stroke-dasharray="2 2"/><path d="M8 5v6M5 8h6" stroke="currentColor" stroke-width="1" opacity="0.5"/></svg>
          Empty
        </button>
      </div>

      <div class="insert-divider"></div>

      <div class="insert-group" id="transform-tools">
        <button class="insert-btn transform-tool active" data-transform="translate" title="Move (G)">
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2v12M2 8h12M8 2l-2 3h4L8 2zM8 14l-2-3h4l-2 3zM2 8l3-2v4L2 8zM14 8l-3-2v4l3-2z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
          Move
        </button>
        <button class="insert-btn transform-tool" data-transform="rotate" title="Rotate (R)">
          <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M8 3 A5 5 0 0 1 13 8" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M12 6l1 2 2-1" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
          Rotate
        </button>
        <button class="insert-btn transform-tool" data-transform="scale" title="Scale (S)">
          <svg width="16" height="16" viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6" stroke="currentColor" stroke-width="1.2" fill="none"/><rect x="9" y="9" width="6" height="6" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M7 5h4M11 5v4" stroke="currentColor" stroke-width="1.2"/></svg>
          Scale
        </button>
      </div>

      <div class="insert-divider"></div>

      <button class="insert-btn danger-btn" id="btn-delete-selected" title="Delete Selected (Del)">
        <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 5h10M6 5V3h4v2M5 5v8h6V5M7 7v4M9 7v4" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>
        Delete
      </button>
      <button class="insert-btn" id="btn-duplicate-selected" title="Duplicate (Ctrl+D)">
        <svg width="16" height="16" viewBox="0 0 16 16"><rect x="1" y="4" width="8" height="9" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M5 4V3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-1" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
        Duplicate
      </button>

      <button class="insert-btn gyro-btn" id="btn-gyro" title="Toggle Gyroscope Camera">
        <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="#00d4ff" stroke-width="1.2" fill="none"/><ellipse cx="8" cy="8" rx="6" ry="2.5" stroke="#00d4ff" stroke-width="1" fill="none" opacity="0.6"/><circle cx="8" cy="8" r="1.5" fill="#00d4ff"/></svg>
        Gyro Look
      </button>
    `;

    // Insert below menubar
    menubar.parentNode.insertBefore(bar, menubar.nextSibling);

    // Adjust layout to account for new bar
    document.documentElement.style.setProperty('--insert-toolbar-h', '38px');

    // Bind primitive buttons
    bar.querySelectorAll('.insert-btn[data-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        AudioSystem.click();
        SceneView.addPrimitive(btn.dataset.type);
      });
    });

    // Bind light buttons
    bar.querySelectorAll('.insert-btn[data-light]').forEach(btn => {
      btn.addEventListener('click', () => {
        AudioSystem.click();
        SceneView.addLight(btn.dataset.light);
      });
    });

    // Bind special buttons
    bar.querySelectorAll('.insert-btn[data-special]').forEach(btn => {
      btn.addEventListener('click', () => {
        AudioSystem.click();
        if (btn.dataset.special === 'empty') {
          const e = SceneData.add('Empty', 'empty', null);
          HierarchyPanel.refresh();
          toast('Added Empty', 'success');
        } else {
          toast('Camera entity coming in v0.3', 'warn');
        }
      });
    });

    // Transform tools
    bar.querySelectorAll('.transform-tool').forEach(btn => {
      btn.addEventListener('click', () => {
        AudioSystem.click();
        bar.querySelectorAll('.transform-tool').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        SceneView.setTransformMode(btn.dataset.transform);
        toast(`Mode: ${btn.dataset.transform}`, 'log', 1200);
      });
    });

    // Delete
    document.getElementById('btn-delete-selected').addEventListener('click', () => {
      AudioSystem.tone(220, 0.15, 0.05, 'sawtooth');
      SceneView.deleteSelected();
    });

    // Duplicate
    document.getElementById('btn-duplicate-selected').addEventListener('click', () => {
      AudioSystem.click();
      SceneView.duplicateSelected();
    });

    // Gyro
    document.getElementById('btn-gyro').addEventListener('click', () => {
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

    show(x, y, context = 'entity') {
      this.el.style.left = Math.min(x, window.innerWidth - 180) + 'px';
      this.el.style.top = Math.min(y, window.innerHeight - 160) + 'px';
      this.el.classList.remove('hidden');
    },

    hide() { this.el.classList.add('hidden'); }
  };

  document.addEventListener('click', () => ContextMenu.hide());

  document.querySelectorAll('.ctx-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      AudioSystem.click();
      ContextMenu.hide();
      const action = item.dataset.action;
      if (action === 'delete') SceneView.deleteSelected();
      else if (action === 'duplicate') SceneView.duplicateSelected();
      else if (action === 'add-child') { SceneView.addPrimitive('cube'); }
      else toast(`${action} coming soon`, 'warn');
    });
  });

  /* ══════════════════════════════════════
     DROPDOWN MENUS
  ══════════════════════════════════════ */
  const MenuDefs = {
    file: document.getElementById('menu-file'),
    edit: document.getElementById('menu-edit'),
    assets: document.getElementById('menu-assets'),
    gameobject: document.getElementById('menu-gameobject'),
    component: document.getElementById('menu-component'),
    build: document.getElementById('menu-build'),
    window: document.getElementById('menu-window'),
    help: document.getElementById('menu-help'),
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
      document.getElementById('dropdown-overlay').classList.remove('hidden');
    });
  });

  function closeAllMenus() {
    Object.values(MenuDefs).forEach(m => m?.classList.add('hidden'));
    document.querySelectorAll('.menu-item.open').forEach(m => m.classList.remove('open'));
    document.getElementById('dropdown-overlay').classList.add('hidden');
    openMenuEl = null;
  }

  document.getElementById('dropdown-overlay').addEventListener('click', closeAllMenus);

  document.querySelectorAll('.dd-item[data-action]').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      AudioSystem.click();
      closeAllMenus();
      const a = item.dataset.action;
      const actionMap = {
        'new-scene': () => { SceneData.entities = []; SceneView._addDefaultEntities(); toast('New scene', 'success'); },
        'save-scene': () => { toast('Scene saved', 'success'); Console.log('Scene saved', 'log', 'Scene.js'); },
        'build-settings': () => openBuildModal(),
        'export': () => openBuildModal(),
        'build-web': () => openBuildModal('web'),
        'build-android': () => openBuildModal('android'),
        'build-desktop': () => openBuildModal('desktop'),
        'build-run': () => { openBuildModal(); setTimeout(() => document.getElementById('btn-start-build').click(), 400); },
        'undo': () => toast('Undo — coming in v0.3', 'warn'),
        'redo': () => toast('Redo — coming in v0.3', 'warn'),
        'create-empty': () => { const e = SceneData.add('Empty', 'empty', null); HierarchyPanel.refresh(); toast('Empty created', 'success'); },
        'create-camera': () => toast('Camera entity — coming in v0.3', 'warn'),
        'create-audio': () => toast('Audio source — coming in v0.3', 'warn'),
        'docs': () => window.open('https://github.com', '_blank'),
        'about': () => toast('CEngine v0.2 — Three.js + Monaco + CScript', 'log', 5000),
        'preferences': () => toast('Preferences — coming in v0.3', 'warn'),
        'reset-layout': () => location.reload(),
        'exit': () => { if (confirm('Exit CEngine?')) window.close(); }
      };
      if (actionMap[a]) actionMap[a]();
      else toast(`${a} — coming soon`, 'warn');
    });
  });

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
      if (tab.dataset.tab === 'scene' || tab.dataset.tab === 'game') {
        setTimeout(() => SceneView._resize(), 50);
      }
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
      const el = document.getElementById(`btab-${tab.dataset.tab}`);
      if (el) el.classList.add('active');
    });
  });

  /* ══════════════════════════════════════
     PLAY CONTROLS
  ══════════════════════════════════════ */
  let playing = false, fpsInterval = null, frameCount = 0;

  function startPlay() {
    playing = true;
    SceneView.playing = true;
    document.getElementById('btn-play').disabled = true;
    document.getElementById('btn-pause').disabled = false;
    document.getElementById('btn-stop').disabled = false;
    document.getElementById('btn-play').classList.add('playing');
    AudioSystem.tone(880, 0.2, 0.06);
    Console.log('Play mode entered', 'log', 'Engine.js');
    toast('Playing', 'success');

    // Show scene tab (game = scene view)
    document.querySelector('.center-tab[data-tab="scene"]').click();

    fpsInterval = setInterval(() => {
      document.getElementById('fps-counter').textContent = frameCount + ' FPS';
      frameCount = 0;
    }, 1000);

    (function tick() {
      if (!playing) return;
      frameCount++;
      requestAnimationFrame(tick);
    })();
  }

  function stopPlay() {
    playing = false;
    SceneView.playing = false;
    document.getElementById('btn-play').disabled = false;
    document.getElementById('btn-pause').disabled = true;
    document.getElementById('btn-stop').disabled = true;
    document.getElementById('btn-play').classList.remove('playing');
    document.getElementById('fps-counter').textContent = '-- FPS';
    clearInterval(fpsInterval);
    AudioSystem.tone(220, 0.15, 0.05);
    Console.log('Play mode exited', 'log', 'Engine.js');
    toast('Stopped', 'log');
  }

  document.getElementById('btn-play').addEventListener('click', startPlay);
  document.getElementById('btn-stop').addEventListener('click', stopPlay);
  document.getElementById('btn-pause').addEventListener('click', () => {
    playing = !playing;
    SceneView.playing = playing;
    AudioSystem.tone(440, 0.1, 0.05);
    toast(playing ? 'Resumed' : 'Paused', 'log');
  });

  /* ══════════════════════════════════════
     TOOLBAR TOOL BUTTONS
  ══════════════════════════════════════ */
  document.querySelectorAll('.tool-btn[id]').forEach(btn => {
    btn.addEventListener('click', () => {
      AudioSystem.click();
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const modeMap = { 'btn-translate': 'translate', 'btn-rotate': 'rotate', 'btn-scale': 'scale' };
      if (modeMap[btn.id]) SceneView.setTransformMode(modeMap[btn.id]);
    });
  });

  /* ══════════════════════════════════════
     BUILD MODAL — OUTPUTS REAL HTML GAME
     Opens in new tab with CEngine branding
  ══════════════════════════════════════ */
  function openBuildModal(platform = 'web') {
    AudioSystem.tone(660, 0.12, 0.05);
    document.getElementById('build-modal').classList.remove('hidden');
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.querySelectorAll('.build-platform').forEach(p => p.classList.remove('active'));
    const target = document.querySelector(`.build-platform[data-platform="${platform}"]`);
    if (target) target.classList.add('active');
  }

  function closeBuildModal() {
    AudioSystem.click();
    document.getElementById('build-modal').classList.add('hidden');
    document.getElementById('modal-overlay').classList.add('hidden');
  }

  function buildGame() {
    const name = document.getElementById('build-game-name')?.value || 'My Game';
    const log = document.getElementById('build-log');
    log.innerHTML = '';

    const steps = [
      { msg: `Compiling scene...`, delay: 0 },
      { msg: `Bundling scripts...`, delay: 500 },
      { msg: `Packaging assets...`, delay: 1000 },
      { msg: `Generating HTML5 export...`, delay: 1500 },
      { msg: `Build complete!`, delay: 2000, success: true }
    ];

    steps.forEach(({ msg, delay, success }) => {
      setTimeout(() => {
        const line = document.createElement('div');
        line.className = `build-log-line${success ? ' success' : ''}`;
        line.textContent = msg;
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
        Console.log(msg, success ? 'log' : 'log', 'Build.js');

        if (success) {
          AudioSystem.success();
          toast(`Build complete: ${name}`, 'success');
          setTimeout(() => {
            closeBuildModal();
            launchBuildTab(name);
          }, 600);
        }
      }, delay);
    });
  }

  function launchBuildTab(name = 'My Game') {
    // Serialize scene entities into a minimal Three.js game
    const entities = SceneData.entities.map(e => {
      if (!e.mesh) return null;
      const c = e.mesh.material?.color;
      return {
        type: e.type,
        name: e.name,
        position: { x: e.mesh.position.x, y: e.mesh.position.y, z: e.mesh.position.z },
        rotation: { x: e.mesh.rotation.x, y: e.mesh.rotation.y, z: e.mesh.rotation.z },
        scale: { x: e.mesh.scale.x, y: e.mesh.scale.y, z: e.mesh.scale.z },
        color: c ? '#' + c.getHexString() : '#4488ff',
        geometry: e.mesh.geometry?.type || 'BoxGeometry'
      };
    }).filter(Boolean);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${name}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#000; overflow:hidden; width:100vw; height:100vh; }
    canvas { display:block; width:100%; height:100%; }
    #loader {
      position:fixed; inset:0; background:#0a0a12;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      z-index:9999; transition:opacity 0.6s;
    }
    .loader-logo {
      font-family: monospace; font-size:28px; font-weight:800;
      color:#00d4ff; text-shadow:0 0 20px #00d4ff; letter-spacing:2px;
      margin-bottom:8px;
    }
    .loader-sub { font-family:monospace; font-size:11px; color:#44445a; letter-spacing:3px; margin-bottom:32px; }
    .loader-bar-wrap { width:240px; height:3px; background:#1a1a2a; border-radius:2px; overflow:hidden; }
    .loader-bar { height:100%; background:linear-gradient(90deg,#00d4ff,#7c4dff); border-radius:2px; width:0%; transition:width 0.3s; }
    .loader-credit { position:fixed; bottom:20px; font-family:monospace; font-size:10px; color:#333344; letter-spacing:2px; }
    #hud { position:fixed; top:12px; left:12px; font-family:monospace; color:#00d4ff; font-size:12px; pointer-events:none; }
  </style>
</head>
<body>
  <div id="loader">
    <div class="loader-logo">C<span style="color:#fff;font-weight:400;font-size:22px">Engine</span></div>
    <div class="loader-sub">BUILT WITH CENGINE</div>
    <div class="loader-bar-wrap"><div class="loader-bar" id="lbar"></div></div>
    <div class="loader-credit">BUILT BY CENGINE</div>
  </div>
  <canvas id="c"></canvas>
  <div id="hud">${name}</div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script>
    // ── Loader animation ──
    const lbar = document.getElementById('lbar');
    let pct = 0;
    const lInt = setInterval(() => {
      pct = Math.min(100, pct + Math.random() * 18 + 4);
      lbar.style.width = pct + '%';
      if (pct >= 100) {
        clearInterval(lInt);
        setTimeout(() => {
          const loader = document.getElementById('loader');
          loader.style.opacity = '0';
          setTimeout(() => loader.remove(), 600);
        }, 300);
      }
    }, 80);

    // ── Game scene ──
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x12121e);
    scene.fog = new THREE.FogExp2(0x12121e, 0.018);

    const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 1000);
    camera.position.set(5, 4, 8);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0x334466, 1.5));
    const dl = new THREE.DirectionalLight(0xffeedd, 2.5);
    dl.position.set(8, 12, 6);
    dl.castShadow = true;
    scene.add(dl);
    scene.add(new THREE.GridHelper(40, 40, 0x1a1a30, 0x111122));

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40,40),
      new THREE.MeshStandardMaterial({ color:0x0d0d18, roughness:1 })
    );
    ground.rotation.x = -Math.PI/2; ground.receiveShadow = true;
    scene.add(ground);

    // Spawn serialized entities
    const entities = ${JSON.stringify(entities)};
    const geoMap = {
      BoxGeometry: (e) => new THREE.BoxGeometry(e.scale.x, e.scale.y, e.scale.z),
      SphereGeometry: () => new THREE.SphereGeometry(0.5, 24, 24),
      CylinderGeometry: () => new THREE.CylinderGeometry(0.5,0.5,1,24),
      PlaneGeometry: () => new THREE.PlaneGeometry(2,2),
      TorusGeometry: () => new THREE.TorusGeometry(0.5,0.2,16,32),
      ConeGeometry: () => new THREE.ConeGeometry(0.5,1,24)
    };

    entities.forEach(e => {
      const geoFn = geoMap[e.geometry] || geoMap.BoxGeometry;
      const geo = geoFn(e);
      const mat = new THREE.MeshStandardMaterial({ color: e.color, metalness:0.1, roughness:0.6 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(e.position.x, e.position.y, e.position.z);
      mesh.rotation.set(e.rotation.x, e.rotation.y, e.rotation.z);
      if (e.geometry !== 'PlaneGeometry') mesh.scale.set(1,1,1);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    });

    window.addEventListener('resize', () => {
      renderer.setSize(innerWidth, innerHeight);
      camera.aspect = innerWidth/innerHeight;
      camera.updateProjectionMatrix();
    });

    // Basic orbit on mouse drag
    let drag=false, lx=0, ly=0, th=0.6, ph=1.0, rad=10;
    document.addEventListener('mousedown', e => { drag=e.button===2; lx=e.clientX; ly=e.clientY; });
    document.addEventListener('mouseup', () => drag=false);
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('mousemove', e => {
      if(!drag) return;
      th -= (e.clientX-lx)*0.008; ph=Math.max(0.05,Math.min(3.09,ph+(e.clientY-ly)*0.008));
      lx=e.clientX; ly=e.clientY;
    });
    document.addEventListener('wheel', e => { rad=Math.max(1.5,Math.min(80,rad+e.deltaY*0.025)); });

    // Touch orbit
    let touch=false, tlx=0, tly=0, tdist=0;
    document.addEventListener('touchstart', e => {
      if(e.touches.length===1){touch=true;tlx=e.touches[0].clientX;tly=e.touches[0].clientY;}
      if(e.touches.length===2){const dx=e.touches[0].clientX-e.touches[1].clientX;const dy=e.touches[0].clientY-e.touches[1].clientY;tdist=Math.sqrt(dx*dx+dy*dy);}
      e.preventDefault();
    },{passive:false});
    document.addEventListener('touchmove', e => {
      if(e.touches.length===1&&touch){th-=(e.touches[0].clientX-tlx)*0.008;ph=Math.max(0.05,Math.min(3.09,ph+(e.touches[0].clientY-tly)*0.008));tlx=e.touches[0].clientX;tly=e.touches[0].clientY;}
      if(e.touches.length===2){const dx=e.touches[0].clientX-e.touches[1].clientX;const dy=e.touches[0].clientY-e.touches[1].clientY;const d=Math.sqrt(dx*dx+dy*dy);rad=Math.max(1.5,Math.min(80,rad-(d-tdist)*0.05));tdist=d;}
      e.preventDefault();
    },{passive:false});
    document.addEventListener('touchend', () => touch=false);

    function animate() {
      requestAnimationFrame(animate);
      camera.position.set(rad*Math.sin(ph)*Math.sin(th), rad*Math.cos(ph), rad*Math.sin(ph)*Math.cos(th));
      camera.lookAt(0,0,0);
      renderer.render(scene, camera);
    }
    animate();
  </script>
</body>
</html>`;

    const tab = window.open('', '_blank');
    if (tab) {
      tab.document.write(html);
      tab.document.close();
      Console.log('Game launched in new tab', 'log', 'Build.js');
    } else {
      toast('Allow popups to open build tab', 'error');
    }
  }

  document.getElementById('btn-build-quick').addEventListener('click', () => openBuildModal());
  document.getElementById('btn-close-build').addEventListener('click', closeBuildModal);
  document.getElementById('btn-close-build-2').addEventListener('click', closeBuildModal);
  document.getElementById('modal-overlay').addEventListener('click', closeBuildModal);
  document.getElementById('btn-start-build').addEventListener('click', buildGame);
  document.getElementById('btn-build-and-run').addEventListener('click', buildGame);

  document.querySelectorAll('.build-platform').forEach(p => {
    p.addEventListener('click', () => {
      AudioSystem.click();
      document.querySelectorAll('.build-platform').forEach(b => b.classList.remove('active'));
      p.classList.add('active');
    });
  });

  /* ══════════════════════════════════════
     RESIZE HANDLES
  ══════════════════════════════════════ */
  function makeResizable(handleId, targetId, direction, min, invert = false) {
    const handle = document.getElementById(handleId);
    const target = document.getElementById(targetId);
    if (!handle || !target) return;
    let drag = false, start = 0, startSize = 0;

    handle.addEventListener('mousedown', e => {
      drag = true;
      start = direction === 'h' ? e.clientX : e.clientY;
      startSize = direction === 'h' ? target.offsetWidth : target.offsetHeight;
      handle.classList.add('dragging');
      document.body.style.cursor = direction === 'h' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', e => {
      if (!drag) return;
      const delta = direction === 'h' ? e.clientX - start : e.clientY - start;
      const size = Math.max(min, startSize + (invert ? -delta : delta));
      if (direction === 'h') target.style.width = size + 'px';
      else target.style.height = size + 'px';
      SceneView._resize();
    });

    document.addEventListener('mouseup', () => {
      if (!drag) return;
      drag = false;
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      SceneView._resize();
    });
  }

  makeResizable('resize-left', 'panel-hierarchy', 'h', 150);
  makeResizable('resize-right', 'panel-inspector', 'h', 180, true);
  makeResizable('resize-bottom', 'panel-bottom', 'v', 120, true);

  /* ══════════════════════════════════════
     MONACO CODE EDITOR
  ══════════════════════════════════════ */
  let monacoReady = false, monacoEditor = null;

  function initMonaco() {
    if (monacoReady) return;
    monacoReady = true;
    const placeholder = document.getElementById('monaco-placeholder');
    if (placeholder) placeholder.remove();

    if (!window.require) {
      const container = document.getElementById('monaco-container');
      container.innerHTML = '';
      const ta = document.createElement('textarea');
      ta.style.cssText = 'width:100%;height:100%;background:#0e0e13;color:#dddde8;border:none;padding:16px;font-family:"JetBrains Mono",monospace;font-size:13px;resize:none;outline:none;line-height:1.6;';
      ta.value = `// CEngine Script — player.js\n\nclass PlayerController {\n  onStart() {\n    this.speed = 5;\n    CEngine.log('Player ready');\n  }\n\n  onUpdate(dt) {\n    if (Input.held('right')) this.transform.position.x += this.speed * dt;\n    if (Input.held('left'))  this.transform.position.x -= this.speed * dt;\n    if (Input.held('up'))    this.transform.position.z -= this.speed * dt;\n    if (Input.held('down'))  this.transform.position.z += this.speed * dt;\n  }\n\n  onCollide(other) {\n    if (other.tag === 'Enemy') Scene.load('GameOver');\n  }\n}`;
      container.appendChild(ta);
      return;
    }

    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
    require(['vs/editor/editor.main'], () => {
      const container = document.getElementById('monaco-container');
      container.innerHTML = '';
      monacoEditor = monaco.editor.create(container, {
        value: `// CEngine Script — player.js\n\nclass PlayerController {\n  onStart() {\n    this.speed = 5;\n    CEngine.log('Player ready');\n  }\n\n  onUpdate(dt) {\n    if (Input.held('right')) this.transform.position.x += this.speed * dt;\n    if (Input.held('left'))  this.transform.position.x -= this.speed * dt;\n  }\n\n  onCollide(other) {\n    if (other.tag === 'Enemy') Scene.load('GameOver');\n  }\n}`,
        language: 'javascript',
        theme: 'vs-dark',
        fontSize: 13,
        fontFamily: '"JetBrains Mono", monospace',
        fontLigatures: true,
        minimap: { enabled: true },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        renderLineHighlight: 'gutter',
        cursorBlinking: 'smooth',
        bracketPairColorization: { enabled: true }
      });

      document.getElementById('code-lang-select')?.addEventListener('change', function () {
        const map = { javascript: 'javascript', cscript: 'javascript', python: 'python', lua: 'lua', glsl: 'glsl', css: 'css' };
        monaco.editor.setModelLanguage(monacoEditor.getModel(), map[this.value] || 'javascript');
        Console.log(`Language: ${this.value}`, 'log', 'CodeEditor.js');
      });

      Console.log('Monaco Editor ready', 'log', 'CodeEditor.js');
    });
  }

  document.getElementById('btn-save-script')?.addEventListener('click', () => {
    AudioSystem.click();
    toast('Script saved', 'success');
    Console.log('Script saved', 'log', 'CodeEditor.js');
  });

  document.getElementById('btn-run-script')?.addEventListener('click', () => {
    AudioSystem.tone(880, 0.15, 0.06);
    if (monacoEditor) {
      const code = monacoEditor.getValue();
      try {
        Console.log('Running script...', 'log', 'CodeEditor.js');
        new Function(code)();
        toast('Script ran', 'success');
      } catch (e) {
        Console.log(e.message, 'error', 'CodeEditor.js');
        toast('Script error: ' + e.message, 'error');
      }
    }
  });

  /* ══════════════════════════════════════
     CONSOLE INTERACTIONS
  ══════════════════════════════════════ */
  document.getElementById('btn-clear-console')?.addEventListener('click', () => {
    AudioSystem.click();
    Console.clear();
  });

  document.getElementById('btn-console-run')?.addEventListener('click', () => {
    const inp = document.getElementById('console-input');
    AudioSystem.tone(660, 0.08, 0.04);
    Console.exec(inp.value);
    inp.value = '';
  });

  document.getElementById('console-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-console-run').click();
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
      const m = el.querySelector('.log-msg')?.textContent.toLowerCase() || '';
      el.style.display = m.includes(q) ? '' : 'none';
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
        document.getElementById('code-file-name').textContent = file.dataset.name;
        document.querySelector('.center-tab[data-tab="code"]').click();
      }
    });
  });

  /* ══════════════════════════════════════
     AUDIO TOGGLE
  ══════════════════════════════════════ */
  document.getElementById('btn-audio-toggle')?.addEventListener('click', () => AudioSystem.toggle());

  /* ══════════════════════════════════════
     KEYBOARD SHORTCUTS
  ══════════════════════════════════════ */
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 's') { e.preventDefault(); toast('Scene saved', 'success'); }
      if (e.key === 'z') { e.preventDefault(); toast('Undo — coming in v0.3', 'warn'); }
      if (e.key === 'd') { e.preventDefault(); SceneView.duplicateSelected(); }
      if (e.key === 'p') { e.preventDefault(); document.getElementById('btn-play').click(); }
    }

    if (e.key === 'Delete') SceneView.deleteSelected();
    if (e.key === 'Escape') { closeAllMenus(); ContextMenu.hide(); closeBuildModal(); }
    if (e.key === 'f' || e.key === 'F') {
      const sel = SceneData.getById(SceneData.selected);
      if (sel) SceneView.focusEntity(sel);
    }

    // Blender-style transform keys
    if (e.key === 'g' || e.key === 'G') {
      document.querySelectorAll('.transform-tool').forEach(b => b.classList.remove('active'));
      document.querySelector('.transform-tool[data-transform="translate"]')?.classList.add('active');
      SceneView.setTransformMode('translate');
    }
    if (e.key === 'r' || e.key === 'R') {
      document.querySelectorAll('.transform-tool').forEach(b => b.classList.remove('active'));
      document.querySelector('.transform-tool[data-transform="rotate"]')?.classList.add('active');
      SceneView.setTransformMode('rotate');
    }
    if (e.key === 's' || e.key === 'S') {
      document.querySelectorAll('.transform-tool').forEach(b => b.classList.remove('active'));
      document.querySelector('.transform-tool[data-transform="scale"]')?.classList.add('active');
      SceneView.setTransformMode('scale');
    }
    if (e.key === 'n' || e.key === 'N') {
      SceneView.addPrimitive('cube');
    }
  });

  /* ══════════════════════════════════════
     GRID + RENDER MODE TOGGLES
  ══════════════════════════════════════ */
  document.getElementById('toggle-grid')?.addEventListener('change', function () {
    SceneView.toggleGrid(this.checked);
  });

  document.getElementById('render-mode')?.addEventListener('change', function () {
    AudioSystem.click();
    SceneView.toggleWireframe(this.value === 'Wireframe');
    Console.log(`Render mode: ${this.value}`, 'log', 'Renderer.js');
  });

  /* ══════════════════════════════════════
     EXPOSE CEngine API TO CONSOLE
  ══════════════════════════════════════ */
  window.CEngineAPI = {
    addCube: () => SceneView.addPrimitive('cube'),
    addSphere: () => SceneView.addPrimitive('sphere'),
    deleteSelected: () => SceneView.deleteSelected(),
    log: (m) => Console.log(String(m), 'log', 'Script'),
    entities: () => SceneData.entities.map(e => e.name),
    select: (name) => {
      const e = SceneData.entities.find(x => x.name === name);
      if (e) SceneData.select(e.id);
    }
  };

  /* ══════════════════════════════════════
     INSPECTOR ICON BTNS
  ══════════════════════════════════════ */
  document.querySelectorAll('.inspector-icon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AudioSystem.click();
      document.querySelectorAll('.inspector-icon-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  /* ══════════════════════════════════════
     INIT
  ══════════════════════════════════════ */
  AudioSystem.init();
  buildInsertToolbar();
  SceneView.init();
  Inspector.clear();

  setTimeout(() => Console.log('CEngine v0.2 ready', 'log', 'Engine.js'), 100);
  setTimeout(() => Console.log('Three.js r128 renderer active', 'log', 'Renderer3D.js'), 200);
  setTimeout(() => Console.log('Input system initialized', 'log', 'Input.js'), 300);
  setTimeout(() => toast('CEngine v0.2 — Welcome!', 'success', 3500), 600);
  setTimeout(() => Console.log('Tip: Press N to add a cube. G/R/S to transform. F to focus.', 'log', 'Editor.js'), 1000);

})();
