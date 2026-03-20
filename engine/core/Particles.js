/* ═══════════════════════════════════════════
   CENGINE — PARTICLE SYSTEM v0.4
   GPU-friendly Three.js particles
   + Visual editor panel
   ═══════════════════════════════════════════ */

window.ParticleSystem = (function () {
  'use strict';

  const emitters = new Map(); // name → Emitter

  /* ══════════════════════════════════════
     PARTICLE EMITTER
  ══════════════════════════════════════ */
  class Emitter {
    constructor(scene, config = {}) {
      this.scene    = scene;
      this.config   = {
        count:      config.count      ?? 80,
        lifetime:   config.lifetime   ?? 1.2,
        speed:      config.speed      ?? 3,
        spread:     config.spread     ?? 0.8,
        size:       config.size       ?? 0.12,
        sizeEnd:    config.sizeEnd    ?? 0.0,
        gravity:    config.gravity    ?? -2,
        color:      config.color      ?? '#ff8844',
        colorEnd:   config.colorEnd   ?? '#ff2200',
        opacity:    config.opacity    ?? 1.0,
        opacityEnd: config.opacityEnd ?? 0.0,
        loop:       config.loop       ?? false,
        burst:      config.burst      ?? true,
        shape:      config.shape      ?? 'sphere', // sphere|cone|box|ring
        texture:    config.texture    ?? 'circle', // circle|spark|smoke|star
        blending:   config.blending   ?? 'additive',
        rotSpeed:   config.rotSpeed   ?? 0,
        ...config
      };

      this.particles = [];
      this.active    = false;
      this._initGeometry();
    }

    _initGeometry() {
      const c   = this.config;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(c.count * 3);
      const col = new Float32Array(c.count * 3);
      const siz = new Float32Array(c.count);
      const opa = new Float32Array(c.count);

      geo.setAttribute('position',  new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color',     new THREE.BufferAttribute(col, 3));
      geo.setAttribute('size',      new THREE.BufferAttribute(siz, 1));
      geo.setAttribute('opacity',   new THREE.BufferAttribute(opa, 1));

      const blending = c.blending === 'additive'
        ? THREE.AdditiveBlending
        : THREE.NormalBlending;

      const mat = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 } },
        vertexShader: `
          attribute float size;
          attribute vec3 color;
          attribute float opacity;
          varying vec3  vColor;
          varying float vOpacity;
          void main() {
            vColor   = color;
            vOpacity = opacity;
            vec4 mvp = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (300.0 / -mvp.z);
            gl_Position  = projectionMatrix * mvp;
          }`,
        fragmentShader: `
          varying vec3  vColor;
          varying float vOpacity;
          void main() {
            vec2  uv   = gl_PointCoord - 0.5;
            float dist = length(uv);
            if (dist > 0.5) discard;
            float alpha = (1.0 - dist * 2.0) * vOpacity;
            gl_FragColor = vec4(vColor, alpha);
          }`,
        transparent:  true,
        depthWrite:   false,
        blending,
        vertexColors: true
      });

      this.points = new THREE.Points(geo, mat);
      this.points.frustumCulled = false;
      this.geo = geo;
      this.mat = mat;
    }

    emit(position, direction = null) {
      this.scene.add(this.points);
      this.active   = true;
      this.particles = [];

      const c   = this.config;
      const col = new THREE.Color(c.color);
      const colEnd = new THREE.Color(c.colorEnd);

      for (let i = 0; i < c.count; i++) {
        const dir = this._randomDir(direction);
        this.particles.push({
          x: position.x, y: position.y, z: position.z,
          vx: dir.x * c.speed * (0.5 + Math.random()),
          vy: dir.y * c.speed * (0.5 + Math.random()),
          vz: dir.z * c.speed * (0.5 + Math.random()),
          life:    0,
          maxLife: c.lifetime * (0.7 + Math.random() * 0.6),
          size:    c.size * (0.5 + Math.random()),
          rot:     Math.random() * Math.PI * 2,
          col:     col.clone(),
          colEnd:  colEnd.clone()
        });
      }
    }

    _randomDir(base) {
      const s = this.config.spread;
      switch (this.config.shape) {
        case 'cone':
          return new THREE.Vector3(
            (Math.random()-0.5)*s,
            0.5 + Math.random()*0.5,
            (Math.random()-0.5)*s
          ).normalize();
        case 'ring':
          const a = Math.random()*Math.PI*2;
          return new THREE.Vector3(Math.cos(a)*s, (Math.random()-0.5)*0.2, Math.sin(a)*s).normalize();
        case 'box':
          return new THREE.Vector3(
            (Math.random()-0.5)*s*2,
            (Math.random()-0.5)*s*2,
            (Math.random()-0.5)*s*2
          ).normalize();
        default: // sphere
          return new THREE.Vector3(
            (Math.random()-0.5),
            (Math.random()-0.5),
            (Math.random()-0.5)
          ).normalize();
      }
    }

    update(dt) {
      if (!this.active || this.particles.length === 0) return;

      const pos = this.geo.attributes.position.array;
      const col = this.geo.attributes.color.array;
      const siz = this.geo.attributes.size.array;
      const opa = this.geo.attributes.opacity.array;
      const c   = this.config;

      let alive = 0;
      this.particles.forEach((p, i) => {
        p.life += dt;
        const t = p.life / p.maxLife;
        if (t >= 1) {
          pos[i*3] = pos[i*3+1] = pos[i*3+2] = 99999;
          siz[i] = 0; opa[i] = 0;
          return;
        }
        alive++;

        p.vy += c.gravity * dt;
        p.x  += p.vx * dt;
        p.y  += p.vy * dt;
        p.z  += p.vz * dt;

        pos[i*3]   = p.x;
        pos[i*3+1] = p.y;
        pos[i*3+2] = p.z;

        // Color lerp
        const r = p.col.r + (p.colEnd.r - p.col.r) * t;
        const g = p.col.g + (p.colEnd.g - p.col.g) * t;
        const b = p.col.b + (p.colEnd.b - p.col.b) * t;
        col[i*3] = r; col[i*3+1] = g; col[i*3+2] = b;

        siz[i] = p.size * (1 - (1 - c.sizeEnd/c.size) * t);
        opa[i] = c.opacity * (1 - t * (1 - c.opacityEnd/Math.max(c.opacity,0.001)));
      });

      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate    = true;
      this.geo.attributes.size.needsUpdate     = true;
      this.geo.attributes.opacity.needsUpdate  = true;

      if (alive === 0 && !c.loop) {
        this.active = false;
        this.scene.remove(this.points);
      }
    }

    dispose() {
      this.active = false;
      this.scene.remove(this.points);
      this.geo.dispose();
      this.mat.dispose();
    }
  }

  /* ══════════════════════════════════════
     BUILT-IN EFFECT PRESETS
  ══════════════════════════════════════ */
  const Presets = {
    explosion: {
      count:80, lifetime:1.0, speed:5, spread:1.0,
      gravity:-3, color:'#ff6600', colorEnd:'#220000',
      size:0.2, sizeEnd:0.0, opacity:1, opacityEnd:0,
      blending:'additive', shape:'sphere', burst:true
    },
    fire: {
      count:60, lifetime:0.8, speed:2, spread:0.3,
      gravity:-4, color:'#ff8800', colorEnd:'#ff2200',
      size:0.15, sizeEnd:0.05, opacity:0.8, opacityEnd:0,
      blending:'additive', shape:'cone', loop:true, burst:false
    },
    smoke: {
      count:40, lifetime:2.0, speed:0.5, spread:0.4,
      gravity:-0.3, color:'#444444', colorEnd:'#888888',
      size:0.3, sizeEnd:0.8, opacity:0.6, opacityEnd:0,
      blending:'normal', shape:'cone', loop:true, burst:false
    },
    sparks: {
      count:50, lifetime:0.6, speed:6, spread:0.8,
      gravity:-8, color:'#ffee44', colorEnd:'#ff8800',
      size:0.06, sizeEnd:0.0, opacity:1, opacityEnd:0,
      blending:'additive', shape:'sphere', burst:true
    },
    magic: {
      count:60, lifetime:1.5, speed:2, spread:0.6,
      gravity:0, color:'#aa44ff', colorEnd:'#4444ff',
      size:0.1, sizeEnd:0.0, opacity:1, opacityEnd:0,
      blending:'additive', shape:'ring', loop:true
    },
    snow: {
      count:100, lifetime:4.0, speed:0.5, spread:1.5,
      gravity:0.5, color:'#ffffff', colorEnd:'#aaddff',
      size:0.05, sizeEnd:0.04, opacity:0.8, opacityEnd:0.2,
      blending:'normal', shape:'box', loop:true, burst:false
    },
    blood: {
      count:30, lifetime:0.8, speed:3, spread:0.7,
      gravity:-6, color:'#cc0000', colorEnd:'#440000',
      size:0.1, sizeEnd:0.0, opacity:1, opacityEnd:0,
      blending:'normal', shape:'sphere', burst:true
    },
    confetti: {
      count:80, lifetime:3.0, speed:2, spread:1.2,
      gravity:2, color:'#ff44aa', colorEnd:'#44aaff',
      size:0.08, sizeEnd:0.05, opacity:1, opacityEnd:0,
      blending:'normal', shape:'sphere', burst:true
    },
    portal: {
      count:80, lifetime:2.0, speed:1, spread:0.1,
      gravity:0, color:'#00ffcc', colorEnd:'#0044ff',
      size:0.08, sizeEnd:0.0, opacity:1, opacityEnd:0,
      blending:'additive', shape:'ring', loop:true
    },
    rain: {
      count:150, lifetime:1.5, speed:8, spread:2.0,
      gravity:10, color:'#88aaff', colorEnd:'#4466cc',
      size:0.04, sizeEnd:0.02, opacity:0.6, opacityEnd:0,
      blending:'normal', shape:'box', loop:true, burst:false
    }
  };

  /* ══════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════ */
  let _scene = null;

  function setScene(scene) { _scene = scene; }

  function emit(name, position, customConfig = {}) {
    if (!_scene) { console.warn('[Particles] No scene set'); return; }
    const preset = Presets[name] || {};
    const config = { ...preset, ...customConfig };
    const emitter = new Emitter(_scene, config);
    const id = name + '_' + Date.now();
    emitters.set(id, emitter);
    emitter.emit(position);
    return id;
  }

  function emitCustom(position, config) {
    if (!_scene) return;
    const emitter = new Emitter(_scene, config);
    const id = 'custom_' + Date.now();
    emitters.set(id, emitter);
    emitter.emit(position);
    return id;
  }

  function update(dt) {
    emitters.forEach((emitter, id) => {
      emitter.update(dt);
      if (!emitter.active && !emitter.config.loop) {
        emitter.dispose();
        emitters.delete(id);
      }
    });
  }

  function stopAll() {
    emitters.forEach(e => e.dispose());
    emitters.clear();
  }

  /* ── Particle Editor Panel ───────────────── */
  function buildEditorPanel() {
    const wrap = document.getElementById('particle-editor-wrap');
    if (!wrap) return;

    const presetNames = Object.keys(Presets);

    wrap.innerHTML = `
      <div id="particle-editor">
        <div id="pe-sidebar">
          <div class="sound-panel-hdr">
            <span>EFFECTS</span>
            <button class="sound-add-btn" id="pe-new-btn">
              <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1v9M1 5.5h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div id="pe-preset-list">
            ${presetNames.map(name => `
              <div class="pe-preset-item" data-preset="${name}">
                <span class="pe-preset-dot" style="background:${Presets[name].color}"></span>
                <span>${name.charAt(0).toUpperCase()+name.slice(1)}</span>
                <button class="pe-emit-btn" data-preset="${name}" title="Emit preview">
                  <svg width="9" height="9" viewBox="0 0 9 9"><polygon points="1,1 8,4.5 1,8" fill="currentColor"/></svg>
                </button>
              </div>`).join('')}
          </div>
        </div>

        <div id="pe-config">
          <div class="pe-config-hdr">
            <span id="pe-editing-name">Select a preset to edit</span>
            <button class="sound-test-btn" id="pe-emit-now">
              <svg width="11" height="11" viewBox="0 0 11 11"><polygon points="1.5,1 10,5.5 1.5,10" fill="currentColor"/></svg>
              Emit at Origin
            </button>
          </div>
          <div id="pe-props">
            ${_buildParticlePropRows()}
          </div>
        </div>

        <div id="pe-preview-wrap">
          <canvas id="pe-preview-canvas"></canvas>
          <div id="pe-preview-label">Preview (2D)</div>
        </div>
      </div>`;

    _bindParticleEditor();
  }

  function _buildParticlePropRows() {
    return `
      <div class="pe-prop-row">
        <span class="pe-prop-label">Count</span>
        <input type="range" class="sound-synth-ctrl" id="pe-count" min="5" max="500" value="80"/>
        <span class="sound-synth-val" id="pe-count-val">80</span>
      </div>
      <div class="pe-prop-row">
        <span class="pe-prop-label">Lifetime</span>
        <input type="range" class="sound-synth-ctrl" id="pe-life" min="10" max="5000" value="1200"/>
        <span class="sound-synth-val" id="pe-life-val">1.2s</span>
      </div>
      <div class="pe-prop-row">
        <span class="pe-prop-label">Speed</span>
        <input type="range" class="sound-synth-ctrl" id="pe-speed" min="1" max="200" value="30"/>
        <span class="sound-synth-val" id="pe-speed-val">3.0</span>
      </div>
      <div class="pe-prop-row">
        <span class="pe-prop-label">Spread</span>
        <input type="range" class="sound-synth-ctrl" id="pe-spread" min="1" max="200" value="80"/>
        <span class="sound-synth-val" id="pe-spread-val">0.8</span>
      </div>
      <div class="pe-prop-row">
        <span class="pe-prop-label">Gravity</span>
        <input type="range" class="sound-synth-ctrl" id="pe-gravity" min="-200" max="50" value="-20"/>
        <span class="sound-synth-val" id="pe-gravity-val">-2.0</span>
      </div>
      <div class="pe-prop-row">
        <span class="pe-prop-label">Size Start</span>
        <input type="range" class="sound-synth-ctrl" id="pe-size" min="1" max="200" value="12"/>
        <span class="sound-synth-val" id="pe-size-val">0.12</span>
      </div>
      <div class="pe-prop-row">
        <span class="pe-prop-label">Size End</span>
        <input type="range" class="sound-synth-ctrl" id="pe-size-end" min="0" max="200" value="0"/>
        <span class="sound-synth-val" id="pe-size-end-val">0.0</span>
      </div>
      <div class="pe-prop-row">
        <span class="pe-prop-label">Color</span>
        <input type="color" class="prop-color" id="pe-color" value="#ff8844"/>
        <span class="pe-prop-label" style="margin-left:6px">→</span>
        <input type="color" class="prop-color" id="pe-color-end" value="#ff2200"/>
      </div>
      <div class="pe-prop-row">
        <span class="pe-prop-label">Opacity</span>
        <input type="range" class="sound-synth-ctrl" id="pe-opacity" min="0" max="100" value="100"/>
        <span class="pe-prop-label" style="margin-left:6px">→</span>
        <input type="range" class="sound-synth-ctrl" id="pe-opacity-end" min="0" max="100" value="0"/>
      </div>
      <div class="pe-prop-row">
        <span class="pe-prop-label">Shape</span>
        <select class="sound-synth-ctrl" id="pe-shape">
          <option>sphere</option><option>cone</option><option>box</option><option>ring</option>
        </select>
        <span class="pe-prop-label" style="margin-left:6px">Blend</span>
        <select class="sound-synth-ctrl" id="pe-blend">
          <option value="additive">Additive</option><option value="normal">Normal</option>
        </select>
      </div>
      <div class="pe-prop-row">
        <label class="sound-synth-label">
          <input type="checkbox" id="pe-loop" style="margin-right:4px;accent-color:var(--accent)"/> Loop
        </label>
        <label class="sound-synth-label" style="margin-left:10px">
          <input type="checkbox" id="pe-burst" checked style="margin-right:4px;accent-color:var(--accent)"/> Burst
        </label>
      </div>`;
  }

  let _currentPreset = null;

  function _bindParticleEditor() {
    // Preset clicks
    document.querySelectorAll('.pe-preset-item').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.closest('.pe-emit-btn')) return;
        const name = item.dataset.preset;
        _currentPreset = name;
        _loadPresetIntoEditor(Presets[name]);
        document.getElementById('pe-editing-name').textContent = name;
        document.querySelectorAll('.pe-preset-item').forEach(i=>i.classList.remove('active'));
        item.classList.add('active');
      });
    });

    // Emit buttons
    document.querySelectorAll('.pe-emit-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const name = btn.dataset.preset;
        if (_scene) emit(name, { x: 0, y: 1, z: 0 });
        _drawPreviewCanvas(Presets[name]);
      });
    });

    // Emit at origin button
    document.getElementById('pe-emit-now')?.addEventListener('click', () => {
      const config = _getConfigFromEditor();
      if (_scene) emitCustom({ x: 0, y: 1, z: 0 }, config);
      _drawPreviewCanvas(config);
    });

    // New preset
    document.getElementById('pe-new-btn')?.addEventListener('click', () => {
      const name = prompt('Effect name:');
      if (!name?.trim()) return;
      const config = _getConfigFromEditor();
      Presets[name] = config;
      buildEditorPanel(); // Refresh
    });

    // Live sliders
    const binds = [
      ['pe-count',   'pe-count-val',   v => v],
      ['pe-life',    'pe-life-val',    v => (v/1000).toFixed(1)+'s'],
      ['pe-speed',   'pe-speed-val',   v => (v/10).toFixed(1)],
      ['pe-spread',  'pe-spread-val',  v => (v/100).toFixed(2)],
      ['pe-gravity', 'pe-gravity-val', v => (v/10).toFixed(1)],
      ['pe-size',    'pe-size-val',    v => (v/100).toFixed(2)],
      ['pe-size-end','pe-size-end-val',v => (v/100).toFixed(2)]
    ];

    binds.forEach(([id, valId, fmt]) => {
      const el = document.getElementById(id);
      const vl = document.getElementById(valId);
      if (!el || !vl) return;
      el.addEventListener('input', () => { vl.textContent = fmt(+el.value); });
    });
  }

  function _loadPresetIntoEditor(p) {
    const set = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
    set('pe-count',    p.count);
    set('pe-life',     p.lifetime * 1000);
    set('pe-speed',    p.speed * 10);
    set('pe-spread',   p.spread * 100);
    set('pe-gravity',  p.gravity * 10);
    set('pe-size',     p.size * 100);
    set('pe-size-end', (p.sizeEnd ?? 0) * 100);
    set('pe-color',    p.color);
    set('pe-color-end',p.colorEnd);
    set('pe-opacity',  (p.opacity ?? 1) * 100);
    set('pe-opacity-end', (p.opacityEnd ?? 0) * 100);
    set('pe-shape',    p.shape);
    set('pe-blend',    p.blending);
    const loopEl  = document.getElementById('pe-loop');
    const burstEl = document.getElementById('pe-burst');
    if (loopEl)  loopEl.checked  = !!p.loop;
    if (burstEl) burstEl.checked = p.burst !== false;
    _drawPreviewCanvas(p);
  }

  function _getConfigFromEditor() {
    const g = id => document.getElementById(id);
    return {
      count:      parseInt(g('pe-count')?.value || 80),
      lifetime:   parseFloat(g('pe-life')?.value || 1200) / 1000,
      speed:      parseFloat(g('pe-speed')?.value || 30) / 10,
      spread:     parseFloat(g('pe-spread')?.value || 80) / 100,
      gravity:    parseFloat(g('pe-gravity')?.value || -20) / 10,
      size:       parseFloat(g('pe-size')?.value || 12) / 100,
      sizeEnd:    parseFloat(g('pe-size-end')?.value || 0) / 100,
      color:      g('pe-color')?.value || '#ff8844',
      colorEnd:   g('pe-color-end')?.value || '#ff2200',
      opacity:    parseFloat(g('pe-opacity')?.value || 100) / 100,
      opacityEnd: parseFloat(g('pe-opacity-end')?.value || 0) / 100,
      shape:      g('pe-shape')?.value || 'sphere',
      blending:   g('pe-blend')?.value || 'additive',
      loop:       g('pe-loop')?.checked || false,
      burst:      g('pe-burst')?.checked !== false
    };
  }

  function _drawPreviewCanvas(config) {
    const canvas = document.getElementById('pe-preview-canvas');
    if (!canvas) return;
    const W = canvas.clientWidth  || 200;
    const H = canvas.clientHeight || 150;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    const col    = config.color    || '#ff8844';
    const colEnd = config.colorEnd || '#ff2200';
    const count  = Math.min(config.count || 80, 120);
    const cx = W/2, cy = H*0.6;

    for (let i = 0; i < count; i++) {
      const t   = Math.random();
      const dir = _randomDir2D(config.shape || 'sphere', config.spread || 0.8);
      const spd = (config.speed || 3) * (0.5 + Math.random()) * 12;
      const x   = cx + dir.x * spd * t;
      const y   = cy + (-dir.y * spd + (config.gravity || -2) * t * t * 8) * t;
      const sz  = Math.max(1, (config.size || 0.12) * 80 * (1 - t * 0.8));
      const opa = (config.opacity || 1) * (1 - t);
      const r   = parseInt(col.slice(1,3),16)/255;
      const g   = parseInt(col.slice(3,5),16)/255;
      const b   = parseInt(col.slice(5,7),16)/255;
      const re  = parseInt(colEnd.slice(1,3),16)/255;
      const ge  = parseInt(colEnd.slice(3,5),16)/255;
      const be  = parseInt(colEnd.slice(5,7),16)/255;
      const pr  = r + (re-r)*t, pg = g + (ge-g)*t, pb = b + (be-b)*t;

      ctx.globalAlpha = Math.max(0, Math.min(1, opa));
      ctx.fillStyle   = config.blending === 'additive'
        ? `rgb(${Math.round(pr*255)},${Math.round(pg*255)},${Math.round(pb*255)})`
        : `rgb(${Math.round(pr*255)},${Math.round(pg*255)},${Math.round(pb*255)})`;
      ctx.beginPath();
      ctx.arc(x, y, sz/2, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function _randomDir2D(shape, spread) {
    switch(shape) {
      case 'cone': return { x:(Math.random()-0.5)*spread, y:0.5+Math.random()*0.5 };
      case 'ring': { const a=Math.random()*Math.PI*2; return { x:Math.cos(a)*spread, y:Math.sin(a)*0.1 }; }
      case 'box':  return { x:(Math.random()-0.5)*spread*2, y:(Math.random()-0.5)*spread*2 };
      default:     return { x:(Math.random()-0.5), y:(Math.random()-0.5) };
    }
  }

  return {
    setScene, emit, emitCustom, update, stopAll,
    Presets, Emitter, buildEditorPanel
  };
})();
