/* ═══════════════════════════════════════════
   CENGINE — SOUND ENGINE v0.4
   Web Audio synthesis + file loader
   + Editor sound panel
   ═══════════════════════════════════════════ */

window.SoundEngine = (function () {
  'use strict';

  let ctx = null;
  const sounds    = new Map(); // name → AudioBuffer
  const instances = new Map(); // name → { source, gain }
  let masterGain  = null;
  let masterVol   = 0.7;

  function getCtx() {
    if (!ctx) {
      ctx        = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = masterVol;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* ── Synthesizer ────────────────────────── */
  const Synth = {
    // Generate procedural sound effects
    play(type, options = {}) {
      const c = getCtx();
      const cfg = {
        volume: options.volume ?? 0.4,
        pitch:  options.pitch  ?? 1.0,
        pan:    options.pan    ?? 0,
        ...options
      };

      switch (type) {
        case 'explosion':  return this._explosion(c, cfg);
        case 'laser':      return this._laser(c, cfg);
        case 'jump':       return this._jump(c, cfg);
        case 'coin':       return this._coin(c, cfg);
        case 'hit':        return this._hit(c, cfg);
        case 'powerup':    return this._powerup(c, cfg);
        case 'footstep':   return this._footstep(c, cfg);
        case 'click':      return this._click(c, cfg);
        case 'whoosh':     return this._whoosh(c, cfg);
        case 'beep':       return this._beep(c, cfg);
        case 'death':      return this._death(c, cfg);
        case 'pickup':     return this._pickup(c, cfg);
        case 'engine':     return this._engineSound(c, cfg);
        default:           return this._beep(c, cfg);
      }
    },

    _makeChain(c, vol = 0.4, pan = 0) {
      const g  = c.createGain();
      const p  = c.createStereoPanner();
      g.gain.value  = vol;
      p.pan.value   = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      p.connect(masterGain || c.destination);
      return { g, p };
    },

    _explosion(c, cfg) {
      const { g } = this._makeChain(c, cfg.volume, cfg.pan);
      const buf = c.createBuffer(1, c.sampleRate * 1.2, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5);
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 400;
      src.connect(lp); lp.connect(g);
      g.gain.setValueAtTime(cfg.volume, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.2);
      src.start();
    },

    _laser(c, cfg) {
      const { g } = this._makeChain(c, cfg.volume, cfg.pan);
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1400 * cfg.pitch, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200 * cfg.pitch, c.currentTime + 0.18);
      osc.connect(g);
      g.gain.setValueAtTime(cfg.volume, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
      osc.start(); osc.stop(c.currentTime + 0.2);
    },

    _jump(c, cfg) {
      const { g } = this._makeChain(c, cfg.volume, cfg.pan);
      const osc = c.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220 * cfg.pitch, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880 * cfg.pitch, c.currentTime + 0.15);
      osc.connect(g);
      g.gain.setValueAtTime(cfg.volume, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
      osc.start(); osc.stop(c.currentTime + 0.2);
    },

    _coin(c, cfg) {
      const { g } = this._makeChain(c, cfg.volume, cfg.pan);
      [0, 0.08].forEach((delay, i) => {
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = (1046 + i * 400) * cfg.pitch;
        osc.connect(g);
        g.gain.setValueAtTime(cfg.volume, c.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.15);
        osc.start(c.currentTime + delay);
        osc.stop(c.currentTime + delay + 0.15);
      });
    },

    _hit(c, cfg) {
      const { g } = this._makeChain(c, cfg.volume, cfg.pan);
      const buf  = c.createBuffer(1, c.sampleRate * 0.1, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(g);
      g.gain.setValueAtTime(cfg.volume, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
      src.start();
    },

    _powerup(c, cfg) {
      const { g } = this._makeChain(c, cfg.volume, cfg.pan);
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440 * cfg.pitch, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760 * cfg.pitch, c.currentTime + 0.4);
      osc.connect(g);
      g.gain.setValueAtTime(0, c.currentTime);
      g.gain.linearRampToValueAtTime(cfg.volume, c.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
      osc.start(); osc.stop(c.currentTime + 0.5);
    },

    _footstep(c, cfg) {
      const { g } = this._makeChain(c, cfg.volume * 0.5, cfg.pan);
      const buf  = c.createBuffer(1, c.sampleRate * 0.06, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (0.5 + Math.random() * 0.5) * (1 - i/data.length);
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const lp = c.createBiquadFilter();
      lp.type = 'bandpass'; lp.frequency.value = 300 + Math.random() * 200;
      src.connect(lp); lp.connect(g);
      src.start();
    },

    _click(c, cfg) {
      const { g } = this._makeChain(c, cfg.volume * 0.3, cfg.pan);
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 800 * cfg.pitch;
      osc.connect(g);
      g.gain.setValueAtTime(cfg.volume * 0.3, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.04);
      osc.start(); osc.stop(c.currentTime + 0.04);
    },

    _whoosh(c, cfg) {
      const { g } = this._makeChain(c, cfg.volume, cfg.pan);
      const buf  = c.createBuffer(1, c.sampleRate * 0.4, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const env = Math.sin((i / data.length) * Math.PI);
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const hp = c.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 1200;
      src.connect(hp); hp.connect(g);
      g.gain.setValueAtTime(cfg.volume, c.currentTime);
      src.start();
    },

    _beep(c, cfg) {
      const { g } = this._makeChain(c, cfg.volume, cfg.pan);
      const osc = c.createOscillator();
      osc.frequency.value = 660 * cfg.pitch;
      osc.connect(g);
      g.gain.setValueAtTime(cfg.volume, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
      osc.start(); osc.stop(c.currentTime + 0.1);
    },

    _death(c, cfg) {
      const { g } = this._makeChain(c, cfg.volume, cfg.pan);
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440 * cfg.pitch, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(55 * cfg.pitch, c.currentTime + 0.8);
      osc.connect(g);
      g.gain.setValueAtTime(cfg.volume, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.0);
      osc.start(); osc.stop(c.currentTime + 1.0);
    },

    _pickup(c, cfg) {
      const { g } = this._makeChain(c, cfg.volume, cfg.pan);
      [0, 0.05, 0.1].forEach((delay, i) => {
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = (523 + i * 262) * cfg.pitch;
        osc.connect(g);
        osc.start(c.currentTime + delay);
        osc.stop(c.currentTime + delay + 0.1);
      });
      g.gain.setValueAtTime(cfg.volume, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
    },

    _engineSound(c, cfg) {
      const { g } = this._makeChain(c, cfg.volume * 0.3, cfg.pan);
      const osc1 = c.createOscillator();
      const osc2 = c.createOscillator();
      osc1.type = 'sawtooth'; osc1.frequency.value = 80 * cfg.pitch;
      osc2.type = 'square';   osc2.frequency.value = 82 * cfg.pitch;
      osc1.connect(g); osc2.connect(g);
      osc1.start(); osc2.start();
      return { osc1, osc2, stop: () => { osc1.stop(); osc2.stop(); } };
    }
  };

  /* ── File-based audio ────────────────────── */
  async function loadFile(name, url) {
    const c   = getCtx();
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const decoded = await c.decodeAudioData(buf);
    sounds.set(name, decoded);
    return decoded;
  }

  function play(name, options = {}) {
    const c = getCtx();
    const buf = sounds.get(name);
    if (!buf) { console.warn('[SoundEngine] Sound not found:', name); return; }

    const src  = c.createBufferSource();
    const gain = c.createGain();
    src.buffer       = buf;
    src.loop         = options.loop ?? false;
    src.playbackRate.value = options.pitch ?? 1;
    gain.gain.value  = (options.volume ?? 1) * masterVol;

    const pan = c.createStereoPanner();
    pan.pan.value = options.pan ?? 0;

    src.connect(gain); gain.connect(pan); pan.connect(masterGain || c.destination);
    src.start(0, options.offset ?? 0);

    instances.set(name, { source: src, gain });
    src.onended = () => instances.delete(name);
    return src;
  }

  function stop(name) {
    const i = instances.get(name);
    if (!i) return;
    i.source.stop();
    instances.delete(name);
  }

  function stopAll() { instances.forEach((v,k) => stop(k)); }

  function setVolume(vol) {
    masterVol = Math.max(0, Math.min(1, vol));
    if (masterGain) masterGain.gain.value = masterVol;
  }

  /* ── Sound Editor Panel ──────────────────── */
  function buildEditorPanel() {
    const panel = document.getElementById('btab-audio');
    if (!panel) return;

    panel.innerHTML = `
      <div id="sound-editor">
        <div id="sound-sidebar">
          <div class="sound-panel-hdr">
            <span>SOUNDS</span>
            <button class="sound-add-btn" id="sound-add">
              <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1v9M1 5.5h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div id="sound-list"></div>
        </div>

        <div id="sound-main">
          <div id="sound-top-bar">
            <span id="sound-selected-name" class="sound-sel-name">— No sound selected —</span>
            <div id="sound-transport">
              <button class="sound-transport-btn" id="sound-play-btn" title="Preview">
                <svg width="11" height="11" viewBox="0 0 11 11"><polygon points="1.5,1 10,5.5 1.5,10" fill="currentColor"/></svg>
              </button>
              <button class="sound-transport-btn" id="sound-stop-btn" title="Stop">
                <svg width="11" height="11" viewBox="0 0 11 11"><rect x="1.5" y="1.5" width="8" height="8" fill="currentColor"/></svg>
              </button>
            </div>
          </div>

          <div id="sound-waveform-wrap">
            <canvas id="sound-waveform" height="80"></canvas>
            <div id="sound-waveform-placeholder">
              <svg width="32" height="32" viewBox="0 0 32 32" opacity="0.3">
                <path d="M2 16h4v-8h4v16h4V8h4v20h4V4h4v24h4v-8" stroke="#00a4dc" stroke-width="1.5" fill="none" stroke-linecap="round"/>
              </svg>
              <p>Select a sound to preview</p>
            </div>
          </div>

          <div id="sound-synth-grid">
            <div class="sound-synth-hdr">SYNTHESIZER PRESETS</div>
            <div id="sound-preset-btns">
              ${['explosion','laser','jump','coin','hit','powerup','footstep','whoosh','death','pickup'].map(t => `
                <button class="sound-preset-btn" data-type="${t}">
                  ${_synthIcon(t)}
                  <span>${t.charAt(0).toUpperCase()+t.slice(1)}</span>
                </button>`).join('')}
            </div>
          </div>

          <div id="sound-custom-synth">
            <div class="sound-synth-hdr">CUSTOM SYNTHESIZER</div>
            <div class="sound-synth-row">
              <label class="sound-synth-label">Wave</label>
              <select class="sound-synth-ctrl" id="syn-wave">
                <option>sine</option><option>square</option><option>sawtooth</option><option>triangle</option>
              </select>
              <label class="sound-synth-label">Freq</label>
              <input type="range" class="sound-synth-ctrl" id="syn-freq" min="20" max="2000" value="440"/>
              <span class="sound-synth-val" id="syn-freq-val">440 Hz</span>
            </div>
            <div class="sound-synth-row">
              <label class="sound-synth-label">Attack</label>
              <input type="range" class="sound-synth-ctrl" id="syn-atk" min="0" max="1000" value="10"/>
              <label class="sound-synth-label">Release</label>
              <input type="range" class="sound-synth-ctrl" id="syn-rel" min="50" max="3000" value="300"/>
            </div>
            <div class="sound-synth-row">
              <label class="sound-synth-label">Volume</label>
              <input type="range" class="sound-synth-ctrl" id="syn-vol" min="0" max="100" value="60"/>
              <label class="sound-synth-label">Pitch ×</label>
              <input type="range" class="sound-synth-ctrl" id="syn-pitch" min="25" max="400" value="100"/>
              <span class="sound-synth-val" id="syn-pitch-val">1.0×</span>
            </div>
            <div class="sound-synth-row">
              <button class="sound-test-btn" id="syn-test">
                <svg width="11" height="11" viewBox="0 0 11 11"><polygon points="1.5,1 10,5.5 1.5,10" fill="currentColor"/></svg>
                Test Sound
              </button>
              <button class="sound-test-btn" id="syn-save">
                <svg width="11" height="11" viewBox="0 0 11 11"><rect x="1" y="1" width="9" height="9" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
                Save as Preset
              </button>
            </div>
          </div>
        </div>
      </div>`;

    _bindSoundPanel();
    _refreshSoundList();
  }

  function _synthIcon(type) {
    const icons = {
      explosion: `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2l2 4h4l-3 3 1 4-4-2.5L4 13l1-4-3-3h4z" stroke="#ffaa44" stroke-width="1.2" fill="none"/></svg>`,
      laser:     `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 8h10M14 6l2 2-2 2" stroke="#00d4ff" stroke-width="1.4" stroke-linecap="round"/></svg>`,
      jump:      `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 14V4M5 7l3-4 3 4" stroke="#44ff88" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>`,
      coin:      `<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" stroke="#ffee44" stroke-width="1.3" fill="none"/><text x="8" y="11" text-anchor="middle" fill="#ffee44" font-size="6" font-weight="700">$</text></svg>`,
      hit:       `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="#ff4455" stroke-width="1.8" stroke-linecap="round"/></svg>`,
      powerup:   `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2v5h-4l5 7 5-7H10V2z" stroke="#aa44ff" stroke-width="1.3" fill="none"/></svg>`,
      footstep:  `<svg width="16" height="16" viewBox="0 0 16 16"><ellipse cx="6" cy="7" rx="3" ry="4" stroke="#888" stroke-width="1.2" fill="none"/><ellipse cx="11" cy="10" rx="3" ry="4" stroke="#888" stroke-width="1.2" fill="none"/></svg>`,
      whoosh:    `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 8c2-4 8-4 12 0M2 8c2 4 8 4 12 0" stroke="#44aaff" stroke-width="1.3" fill="none"/></svg>`,
      death:     `<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" stroke="#ff3344" stroke-width="1.3" fill="none"/><path d="M6 6l4 4M10 6l-4 4" stroke="#ff3344" stroke-width="1.3" stroke-linecap="round"/></svg>`,
      pickup:    `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 3l2 4h4l-3.5 2.5L12 14l-4-2.5L4 14l1.5-4.5L2 7h4z" stroke="#44ffee" stroke-width="1.2" fill="none"/></svg>`
    };
    return icons[type] || '';
  }

  function _bindSoundPanel() {
    // Preset buttons
    document.querySelectorAll('.sound-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        Synth.play(type, { volume: 0.5 });
        document.getElementById('sound-selected-name').textContent = type + ' (preset)';
        _drawWaveformPreview(type);
        document.querySelectorAll('.sound-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Custom synth controls
    const freqSlider  = document.getElementById('syn-freq');
    const pitchSlider = document.getElementById('syn-pitch');

    freqSlider?.addEventListener('input',  () => {
      document.getElementById('syn-freq-val').textContent = freqSlider.value + ' Hz';
    });
    pitchSlider?.addEventListener('input', () => {
      document.getElementById('syn-pitch-val').textContent = (pitchSlider.value/100).toFixed(2) + '×';
    });

    document.getElementById('syn-test')?.addEventListener('click', () => {
      const c    = getCtx();
      const wave = document.getElementById('syn-wave')?.value || 'sine';
      const freq = parseFloat(document.getElementById('syn-freq')?.value || 440);
      const atk  = parseFloat(document.getElementById('syn-atk')?.value || 10) / 1000;
      const rel  = parseFloat(document.getElementById('syn-rel')?.value || 300) / 1000;
      const vol  = parseFloat(document.getElementById('syn-vol')?.value || 60) / 100;
      const pitch= parseFloat(document.getElementById('syn-pitch')?.value || 100) / 100;

      const osc  = c.createOscillator();
      const gain = c.createGain();
      osc.type             = wave;
      osc.frequency.value  = freq * pitch;
      gain.gain.setValueAtTime(0, c.currentTime);
      gain.gain.linearRampToValueAtTime(vol, c.currentTime + atk);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + atk + rel);
      osc.connect(gain);
      gain.connect(masterGain || c.destination);
      osc.start();
      osc.stop(c.currentTime + atk + rel + 0.05);
    });

    document.getElementById('syn-save')?.addEventListener('click', () => {
      const name = prompt('Name this sound preset:');
      if (!name?.trim()) return;
      // Save to localStorage
      const presets = JSON.parse(localStorage.getItem('cengine_sound_presets') || '{}');
      presets[name] = {
        wave:  document.getElementById('syn-wave')?.value,
        freq:  document.getElementById('syn-freq')?.value,
        atk:   document.getElementById('syn-atk')?.value,
        rel:   document.getElementById('syn-rel')?.value,
        vol:   document.getElementById('syn-vol')?.value,
        pitch: document.getElementById('syn-pitch')?.value
      };
      localStorage.setItem('cengine_sound_presets', JSON.stringify(presets));
      _refreshSoundList();
      console.log('[SoundEngine] Preset saved:', name);
    });

    document.getElementById('sound-add')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type   = 'file';
      input.accept = 'audio/*';
      input.onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        await loadFile(file.name, url);
        _refreshSoundList();
        console.log('[SoundEngine] Loaded:', file.name);
      };
      input.click();
    });
  }

  function _refreshSoundList() {
    const list = document.getElementById('sound-list');
    if (!list) return;
    list.innerHTML = '';

    // Presets from localStorage
    const presets = JSON.parse(localStorage.getItem('cengine_sound_presets') || '{}');
    Object.keys(presets).forEach(name => {
      const item = _makeSoundListItem(name, 'preset');
      list.appendChild(item);
    });

    // Loaded audio files
    sounds.forEach((buf, name) => {
      const item = _makeSoundListItem(name, 'file');
      list.appendChild(item);
    });

    // Built-in synth sounds
    ['explosion','laser','jump','coin','hit','powerup','footstep','whoosh','death','pickup'].forEach(name => {
      const item = _makeSoundListItem(name, 'synth');
      list.appendChild(item);
    });
  }

  function _makeSoundListItem(name, type) {
    const typeColors = { synth:'#00a4dc', preset:'#44cc88', file:'#cc8844' };
    const item = document.createElement('div');
    item.className = 'sound-list-item';
    item.innerHTML = `
      <span class="sound-list-dot" style="background:${typeColors[type]||'#888'}"></span>
      <span class="sound-list-name">${name}</span>
      <span class="sound-list-type">${type}</span>
      <button class="sound-list-play">
        <svg width="9" height="9" viewBox="0 0 9 9"><polygon points="1,1 8,4.5 1,8" fill="currentColor"/></svg>
      </button>`;
    item.querySelector('.sound-list-play').addEventListener('click', e => {
      e.stopPropagation();
      if (type === 'synth') Synth.play(name, { volume: 0.5 });
      else if (type === 'file') play(name, { volume: 0.5 });
      _drawWaveformPreview(name);
    });
    item.addEventListener('click', () => {
      document.querySelectorAll('.sound-list-item').forEach(i=>i.classList.remove('active'));
      item.classList.add('active');
      document.getElementById('sound-selected-name').textContent = name;
    });
    return item;
  }

  function _drawWaveformPreview(type) {
    const canvas = document.getElementById('sound-waveform');
    const ph     = document.getElementById('sound-waveform-placeholder');
    if (!canvas) return;
    if (ph) ph.style.display = 'none';
    canvas.style.display = 'block';

    const W = canvas.clientWidth || 400;
    canvas.width = W;
    const ctx2 = canvas.getContext('2d');
    ctx2.clearRect(0, 0, W, 80);
    ctx2.fillStyle = '#0e0e0e';
    ctx2.fillRect(0, 0, W, 80);

    // Draw synthetic waveform visualization
    ctx2.strokeStyle = '#00a4dc';
    ctx2.lineWidth   = 1.5;
    ctx2.beginPath();
    const points = 200;
    for (let i = 0; i < points; i++) {
      const x = (i / points) * W;
      const t = i / points;
      let y;
      switch(type) {
        case 'explosion':
          y = 40 + (Math.random()-0.5)*60*Math.pow(1-t,0.7);
          break;
        case 'laser':
          y = 40 + Math.sin(t*80*(1-t*0.8))*30*(1-t);
          break;
        case 'jump':
          y = 40 - Math.sin(t*Math.PI)*28;
          break;
        case 'coin':
          y = 40 + Math.sin(t*120)*20*Math.pow(1-t,1.5) + Math.sin(t*200+1)*10*Math.pow(1-t,2);
          break;
        case 'death':
          y = 40 + Math.sin(t*30*(1-t*0.9))*25*(1-t);
          break;
        default:
          y = 40 + Math.sin(t*60)*20*(1-t*0.8);
      }
      if (i===0) ctx2.moveTo(x,y); else ctx2.lineTo(x,y);
    }
    ctx2.stroke();

    // Center line
    ctx2.strokeStyle = '#222';
    ctx2.lineWidth   = 0.5;
    ctx2.beginPath();
    ctx2.moveTo(0,40); ctx2.lineTo(W,40);
    ctx2.stroke();
  }

  return {
    Synth, play, stop, stopAll, loadFile, setVolume,
    buildEditorPanel, getCtx,
    // Convenience wrappers for scripts
    playEffect: (type, opts) => Synth.play(type, opts),
    playSound:  (name, opts) => play(name, opts)
  };
})();
