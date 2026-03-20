/* ═══════════════════════════════════════════
   CENGINE — SOUND ENGINE
   Web Audio synth + file loader
   ═══════════════════════════════════════════ */

window.CSound = (function () {
  'use strict';

  let ctx        = null;
  let masterGain = null;
  let masterVol  = 0.7;
  const sounds   = new Map();
  const loops    = new Map();

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = masterVol;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* ══════════════════════════════════════
     SYNTHESIZER PRESETS
  ══════════════════════════════════════ */
  const Synth = {

    _chain(vol, pan) {
      const c = getCtx();
      const g = c.createGain();
      const p = c.createStereoPanner();
      g.gain.value = (vol || 0.4) * masterVol;
      p.pan.value  = Math.max(-1, Math.min(1, pan || 0));
      g.connect(p);
      p.connect(masterGain);
      return { c, g, p };
    },

    play(type, opts) {
      opts = opts || {};
      const vol   = opts.volume || 0.4;
      const pitch = opts.pitch  || 1.0;
      const pan   = opts.pan    || 0;

      switch (type) {
        case 'jump':       return this._jump(vol, pitch, pan);
        case 'land':       return this._land(vol, pitch, pan);
        case 'shoot':
        case 'laser':      return this._laser(vol, pitch, pan);
        case 'explosion':  return this._explosion(vol, pitch, pan);
        case 'hit':        return this._hit(vol, pitch, pan);
        case 'coin':
        case 'pickup':     return this._coin(vol, pitch, pan);
        case 'powerup':    return this._powerup(vol, pitch, pan);
        case 'death':      return this._death(vol, pitch, pan);
        case 'footstep':   return this._footstep(vol, pitch, pan);
        case 'whoosh':     return this._whoosh(vol, pitch, pan);
        case 'click':      return this._click(vol, pitch, pan);
        case 'beep':       return this._beep(vol, pitch, pan);
        default:           return this._beep(vol, pitch, pan);
      }
    },

    _jump(vol, pitch, pan) {
      const { c, g } = this._chain(vol, pan);
      const o = c.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(220 * pitch, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(880 * pitch, c.currentTime + 0.15);
      o.connect(g);
      g.gain.setValueAtTime(vol * masterVol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
      o.start(); o.stop(c.currentTime + 0.2);
    },

    _land(vol, pitch, pan) {
      const { c, g } = this._chain(vol * 0.6, pan);
      const buf  = c.createBuffer(1, c.sampleRate * 0.08, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 400;
      src.connect(lp); lp.connect(g);
      src.start();
    },

    _laser(vol, pitch, pan) {
      const { c, g } = this._chain(vol, pan);
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(1400 * pitch, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(200 * pitch, c.currentTime + 0.18);
      o.connect(g);
      g.gain.setValueAtTime(vol * masterVol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
      o.start(); o.stop(c.currentTime + 0.2);
    },

    _explosion(vol, pitch, pan) {
      const { c, g } = this._chain(vol, pan);
      const buf  = c.createBuffer(1, c.sampleRate * 1.2, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5);
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 400;
      src.connect(lp); lp.connect(g);
      g.gain.setValueAtTime(vol * masterVol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.2);
      src.start();
    },

    _hit(vol, pitch, pan) {
      const { c, g } = this._chain(vol, pan);
      const buf  = c.createBuffer(1, c.sampleRate * 0.1, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(g);
      g.gain.setValueAtTime(vol * masterVol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
      src.start();
    },

    _coin(vol, pitch, pan) {
      const { c, g } = this._chain(vol, pan);
      [0, 0.08].forEach((delay, i) => {
        const o = c.createOscillator();
        o.type = 'sine';
        o.frequency.value = (1046 + i * 400) * pitch;
        o.connect(g);
        g.gain.setValueAtTime(vol * masterVol, c.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.15);
        o.start(c.currentTime + delay);
        o.stop(c.currentTime + delay + 0.15);
      });
    },

    _powerup(vol, pitch, pan) {
      const { c, g } = this._chain(vol, pan);
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(440 * pitch, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(1760 * pitch, c.currentTime + 0.4);
      o.connect(g);
      g.gain.setValueAtTime(0, c.currentTime);
      g.gain.linearRampToValueAtTime(vol * masterVol, c.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
      o.start(); o.stop(c.currentTime + 0.5);
    },

    _death(vol, pitch, pan) {
      const { c, g } = this._chain(vol, pan);
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(440 * pitch, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(55 * pitch, c.currentTime + 0.8);
      o.connect(g);
      g.gain.setValueAtTime(vol * masterVol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.0);
      o.start(); o.stop(c.currentTime + 1.0);
    },

    _footstep(vol, pitch, pan) {
      const { c, g } = this._chain(vol * 0.4, pan);
      const buf  = c.createBuffer(1, c.sampleRate * 0.06, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 300 + Math.random() * 200;
      src.connect(bp); bp.connect(g);
      src.start();
    },

    _whoosh(vol, pitch, pan) {
      const { c, g } = this._chain(vol, pan);
      const buf  = c.createBuffer(1, c.sampleRate * 0.4, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((i / data.length) * Math.PI);
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const hp = c.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 1200;
      src.connect(hp); hp.connect(g);
      src.start();
    },

    _click(vol, pitch, pan) {
      const { c, g } = this._chain(vol * 0.3, pan);
      const o = c.createOscillator();
      o.frequency.value = 800 * pitch;
      o.connect(g);
      g.gain.setValueAtTime(vol * 0.3 * masterVol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.04);
      o.start(); o.stop(c.currentTime + 0.04);
    },

    _beep(vol, pitch, pan) {
      const { c, g } = this._chain(vol, pan);
      const o = c.createOscillator();
      o.frequency.value = 660 * pitch;
      o.connect(g);
      g.gain.setValueAtTime(vol * masterVol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
      o.start(); o.stop(c.currentTime + 0.1);
    }
  };

  /* ══════════════════════════════════════
     FILE AUDIO
  ══════════════════════════════════════ */
  async function load(name, url) {
    const c   = getCtx();
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const decoded = await c.decodeAudioData(buf);
    sounds.set(name, decoded);
    return decoded;
  }

  function play(name, opts) {
    opts = opts || {};
    const c   = getCtx();
    const buf = sounds.get(name);
    if (!buf) { console.warn('[CSound] Not found:', name); return null; }

    const src  = c.createBufferSource();
    const gain = c.createGain();
    src.buffer = buf;
    src.loop   = opts.loop   || false;
    src.playbackRate.value = opts.pitch || 1;
    gain.gain.value = (opts.volume || 1) * masterVol;

    const pan = c.createStereoPanner();
    pan.pan.value = opts.pan || 0;

    src.connect(gain);
    gain.connect(pan);
    pan.connect(masterGain);
    src.start(0, opts.offset || 0);

    if (opts.loop) loops.set(name, src);
    src.onended = () => { if (loops.get(name) === src) loops.delete(name); };
    return src;
  }

  function stop(name) {
    const src = loops.get(name);
    if (src) { try { src.stop(); } catch(e) {} loops.delete(name); }
  }

  function stopAll() {
    loops.forEach((src, name) => stop(name));
  }

  function setVolume(vol) {
    masterVol = Math.max(0, Math.min(1, vol));
    if (masterGain) masterGain.gain.value = masterVol;
  }

  return { Synth, load, play, stop, stopAll, setVolume, getCtx };
})();
