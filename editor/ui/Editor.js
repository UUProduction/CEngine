/* ═══════════════════════════════════════
   CENGINE EDITOR.JS — Full interactivity
   ═══════════════════════════════════════ */

(function() {
  'use strict';

  /* ── AUDIO SYSTEM ─────────────────────── */

  const AudioSystem = {
    ctx: null,
    ambient: document.getElementById('audio-ambient'),
    muted: false,
    enabled: false,

    init() {
      this.ambient.volume = 0.18;
      document.addEventListener('click', () => {
        if (!this.enabled) {
          this.enabled = true;
          this.ambient.play().catch(() => {});
        }
      }, { once: true });
    },

    toggle() {
      this.muted = !this.muted;
      this.ambient.muted = this.muted;
      const icon = document.getElementById('audio-icon');
      const btn = document.getElementById('btn-audio-toggle');
      btn.classList.toggle('active', !this.muted);
      toast(this.muted ? 'Ambient audio muted' : 'Ambient audio on', 'log');
    },

    click() {
      if (this.muted) return;
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.frequency.setValueAtTime(880, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
      } catch(e) {}
    },

    playTone(freq = 660, duration = 0.08, vol = 0.05) {
      if (this.muted) return;
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch(e) {}
    }
  };

  /* ── TOAST NOTIFICATIONS ─────────────── */

  function toast(msg, type = 'log', duration = 2800) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icons = {
      log: `<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" stroke="#33ee88" stroke-width="1.2" fill="none"/></svg>`,
      warn: `<svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1l5 9H1z" stroke="#ffaa00" stroke-width="1.2" fill="none"/></svg>`,
      error: `<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="#ff3344" stroke-width="1.5" stroke-linecap="round"/></svg>`,
      success: `<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" stroke="#33ee88" stroke-width="1.2" fill="none"/><path d="M3 6l2 2 4-4" stroke="#33ee88" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>`
    };
    el.innerHTML = `${icons[type] || ''}<span>${msg}</span>`;
    container.appendChild(el);
    AudioSystem.playTone(type === 'error' ? 220 : type === 'warn' ? 440 : 660, 0.1, 0.04);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  /* ── CONSOLE LOG ──────────────────────── */

  const Console = {
    output: document.getElementById('console-output'),
    count: { log: 2, warn: 1, error: 0 },

    log(msg, type = 'log', source = 'Editor.js') {
      const time = (performance.now() / 1000).toFixed(3);
      const entry = document.createElement('div');
      entry.className = `log-entry ${type}`;
      entry.dataset.type = type;

      const icons = {
        log: `<svg class="log-icon" width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" stroke="#44ff88" stroke-width="1.2" fill="none"/></svg>`,
        warn: `<svg class="log-icon" width="10" height="10" viewBox="0 0 10 10"><path d="M5 1l4 8H1z" stroke="#ffaa00" stroke-width="1.2" fill="none"/></svg>`,
        error: `<svg class="log-icon" width="10" height="10" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6" stroke="#ff4455" stroke-width="1.2" stroke-linecap="round"/></svg>`
      };

      entry.innerHTML = `
        ${icons[type] || icons.log}
        <span class="log-time">${time}</span>
        <span class="log-msg">${msg}</span>
        <span class="log-source">${source}</span>
      `;

      this.output.appendChild(entry);
      this.output.scrollTop = this.output.scrollHeight;
      this.count[type] = (this.count[type] || 0) + 1;
      this.updateCounts();
    },

    updateCounts() {
      document.getElementById('log-count').textContent = this.count.log;
      document.getElementById('warn-count-num').textContent = this.count.warn;
      document.getElementById('error-count-num').textContent = this.count.error;
    },

    clear() {
      this.output.innerHTML = '';
      this.count = { log: 0, warn: 0, error: 0 };
      this.updateCounts();
      this.log('Console cleared', 'log', 'Console');
    },

    execute(cmd) {
      if (!cmd.trim()) return;
      this.log(`> ${cmd}`, 'log', 'Console');
      try {
        const result = Function(`"use strict"; return (${cmd})`)();
        if (result !== undefined) this.log(String(result), 'log', 'Console');
      } catch(e) {
        this.log(e.message, 'error', 'Console');
      }
    }
  };

  /* ── DROPDOWN MENUS ──────────────────── */

  const menus = {
    file: document.getElementById('menu-file'),
    edit: document.getElementById('menu-edit'),
    assets: document.getElementById('menu-assets'),
    gameobject: document.getElementById('menu-gameobject'),
    component: document.getElementById('menu-component'),
    build: document.getElementById('menu-build'),
    window: document.getElementById('menu-window'),
    help: document.getElementById('menu-help'),
  };

  let openMenu = null;

  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      AudioSystem.click();
      const key = item.dataset.menu;
      const menu = menus[key];
      if (!menu) return;

      if (openMenu === menu) {
        closeAllMenus();
        return;
      }

      closeAllMenus();
      const rect = item.getBoundingClientRect();
      menu.style.left = rect.left + 'px';
      menu.classList.remove('hidden');
      item.classList.add('open');
      openMenu = menu;
      document.getElementById('dropdown-overlay').classList.remove('hidden');
    });
  });

  function closeAllMenus() {
    Object.values(menus).forEach(m => m.classList.add('hidden'));
    document.querySelectorAll('.menu-item.open').forEach(m => m.classList.remove('open'));
    document.getElementById('dropdown-overlay').classList.add('hidden');
    openMenu = null;
  }

  document.getElementById('dropdown-overlay').addEventListener('click', () => {
    closeAllMenus();
    AudioSystem.click();
  });

  /* ── MENU ACTIONS ─────────────────────── */

  document.querySelectorAll('.dd-item[data-action]').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      AudioSystem.click();
      closeAllMenus();
      const action = item.dataset.action;

      const actions = {
        'new-scene': () => { document.getElementById('scene-name').textContent = 'New Scene'; toast('New scene created', 'success'); Console.log('New scene created', 'log', 'Scene.js'); },
        'save-scene': () => { toast('Scene saved', 'success'); Console.log('Scene saved successfully', 'log', 'Scene.js'); },
        'open-scene': () => toast('Open Scene dialog — filesystem access coming in v0.2', 'warn'),
        'build-settings': () => openBuildModal(),
        'export': () => openBuildModal(),
        'build-web': () => openBuildModal('web'),
        'build-android': () => openBuildModal('android'),
        'build-desktop': () => openBuildModal('desktop'),
        'build-run': () => openBuildModal(),
        'undo': () => { toast('Undo', 'log'); Console.log('Undo action', 'log', 'Editor.js'); },
        'redo': () => { toast('Redo', 'log'); Console.log('Redo action', 'log', 'Editor.js'); },
        'create-empty': () => addHierarchyEntity('Empty Object', 'empty'),
        'create-camera': () => addHierarchyEntity('Camera', 'camera'),
        'create-audio': () => addHierarchyEntity('Audio Source', 'audio'),
        'import-asset': () => toast('Import dialog — drag & drop assets in v0.2', 'warn'),
        'create-script': () => { setCodeTab(); toast('New script created', 'success'); },
        'refresh': () => { toast('Assets refreshed', 'log'); Console.log('Asset database refreshed', 'log', 'Assets.js'); },
        'docs': () => window.open('https://github.com', '_blank'),
        'about': () => toast('CEngine v0.1 — Built with Three.js + Monaco', 'log', 4000),
        'preferences': () => toast('Preferences panel coming in v0.2', 'warn'),
        'reset-layout': () => { toast('Layout reset', 'log'); },
        'exit': () => { if(confirm('Exit CEngine?')) window.close(); }
      };

      if (actions[action]) actions[action]();
      else toast(`${action} — coming soon`, 'warn');
    });
  });

  /* ── CENTER TABS ──────────────────────── */

  document.querySelectorAll('.center-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      AudioSystem.click();
      document.querySelectorAll('.center-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const id = `tab-${tab.dataset.tab}`;
      const el = document.getElementById(id);
      if (el) el.classList.add('active');
      if (tab.dataset.tab === 'code') initMonaco();
    });
  });

  function setCodeTab() {
    document.querySelectorAll('.center-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.center-tab[data-tab="code"]').classList.add('active');
    document.getElementById('tab-code').classList.add('active');
    initMonaco();
  }

  /* ── BOTTOM TABS ──────────────────────── */

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

  /* ── PLAY CONTROLS ────────────────────── */

  let playing = false;

  document.getElementById('btn-play').addEventListener('click', () => {
    AudioSystem.playTone(880, 0.15, 0.06);
    playing = true;
    document.getElementById('btn-play').disabled = true;
    document.getElementById('btn-pause').disabled = false;
    document.getElementById('btn-stop').disabled = false;
    document.getElementById('btn-play').classList.add('playing');
    document.getElementById('game-status').textContent = 'Playing...';
    document.getElementById('game-overlay').style.opacity = '0';
    document.querySelectorAll('.center-tab[data-tab="game"]')[0].click();
    toast('Game started', 'success');
    Console.log('Scene entered play mode', 'log', 'Engine.js');
    startFPS();
  });

  document.getElementById('btn-pause').addEventListener('click', () => {
    AudioSystem.playTone(440, 0.1, 0.05);
    playing = !playing;
    toast(playing ? 'Resumed' : 'Paused', 'log');
    Console.log(playing ? 'Resumed' : 'Paused', 'log', 'Engine.js');
  });

  document.getElementById('btn-stop').addEventListener('click', () => {
    AudioSystem.playTone(220, 0.15, 0.05);
    playing = false;
    document.getElementById('btn-play').disabled = false;
    document.getElementById('btn-pause').disabled = true;
    document.getElementById('btn-stop').disabled = true;
    document.getElementById('btn-play').classList.remove('playing');
    document.getElementById('game-status').textContent = 'Press ▶ to Play';
    document.getElementById('game-overlay').style.opacity = '1';
    document.getElementById('fps-counter').textContent = '-- FPS';
    toast('Stopped', 'log');
    Console.log('Scene exited play mode', 'log', 'Engine.js');
    stopFPS();
  });

  /* ── FPS COUNTER ──────────────────────── */

  let fpsInterval, lastFrame = performance.now(), frames = 0;

  function startFPS() {
    fpsInterval = setInterval(() => {
      document.getElementById('fps-counter').textContent = frames + ' FPS';
      frames = 0;
    }, 1000);
    function tick() {
      if (!playing) return;
      frames++;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function stopFPS() { clearInterval(fpsInterval); frames = 0; }

  /* ── TOOLBAR TOOLS ────────────────────── */

  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AudioSystem.click();
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  /* ── BUILD MODAL ──────────────────────── */

  function openBuildModal(platform = 'web') {
    AudioSystem.playTone(660, 0.12, 0.05);
    document.getElementById('build-modal').classList.remove('hidden');
    document.getElementById('modal-overlay').classList.remove('hidden');
    if (platform) {
      document.querySelectorAll('.build-platform').forEach(p => p.classList.remove('active'));
      const target = document.querySelector(`.build-platform[data-platform="${platform}"]`);
      if (target) target.classList.add('active');
    }
  }

  function closeBuildModal() {
    AudioSystem.click();
    document.getElementById('build-modal').classList.add('hidden');
    document.getElementById('modal-overlay').classList.add('hidden');
  }

  document.getElementById('btn-build-quick').addEventListener('click', () => openBuildModal());
  document.getElementById('btn-close-build').addEventListener('click', closeBuildModal);
  document.getElementById('btn-close-build-2').addEventListener('click', closeBuildModal);
  document.getElementById('modal-overlay').addEventListener('click', closeBuildModal);

  document.querySelectorAll('.build-platform').forEach(p => {
    p.addEventListener('click', () => {
      AudioSystem.click();
      document.querySelectorAll('.build-platform').forEach(b => b.classList.remove('active'));
      p.classList.add('active');
    });
  });

  document.getElementById('btn-start-build').addEventListener('click', () => {
    AudioSystem.playTone(880, 0.2, 0.07);
    const platform = document.querySelector('.build-platform.active')?.dataset.platform || 'web';
    const gameName = document.getElementById('build-game-name').value;
    const log = document.getElementById('build-log');
    log.innerHTML = '';
    const steps = [
      { msg: `Building "${gameName}" for ${platform}...`, delay: 0, type: '' },
      { msg: '  Compiling scripts...', delay: 600, type: '' },
      { msg: '  Bundling assets...', delay: 1200, type: '' },
      { msg: '  Optimizing shaders...', delay: 1800, type: '' },
      { msg: '  Generating output files...', delay: 2400, type: '' },
      { msg: `✓ Build complete — ${gameName} ready!`, delay: 3000, type: 'success' }
    ];
    steps.forEach(({ msg, delay, type }) => {
      setTimeout(() => {
        const line = document.createElement('div');
        line.className = `build-log-line ${type}`;
        line.textContent = msg;
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
        Console.log(msg, type === 'success' ? 'log' : 'log', 'Build.js');
        if (type === 'success') {
          toast(`Build complete: ${gameName}`, 'success');
          AudioSystem.playTone(1100, 0.3, 0.06);
        }
      }, delay);
    });
  });

  document.getElementById('btn-build-and-run').addEventListener('click', () => {
    document.getElementById('btn-start-build').click();
    setTimeout(() => {
      closeBuildModal();
      document.getElementById('btn-play').click();
    }, 3200);
  });

  /* ── HIERARCHY ────────────────────────── */

  let selectedEntity = null;

  document.querySelectorAll('.tree-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      AudioSystem.click();
      document.querySelectorAll('.tree-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      selectedEntity = item.dataset.id;
      updateInspectorForEntity(selectedEntity);
    });

    item.addEventListener('contextmenu', e => {
      e.preventDefault();
      AudioSystem.click();
      showContextMenu(e.clientX, e.clientY);
    });
  });

  function addHierarchyEntity(name, type) {
    const children = document.getElementById('scene-children');
    const item = document.createElement('div');
    item.className = 'tree-item';
    item.dataset.id = `entity-${Date.now()}`;

    const icons = {
      empty: `<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4" stroke="#888" stroke-width="1.2" fill="none" stroke-dasharray="2 2"/></svg>`,
      camera: `<svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="3" width="8" height="6" rx="1" stroke="#88aaff" stroke-width="1.2" fill="none"/><polygon points="9,5 11,4 11,8 9,7" stroke="#88aaff" stroke-width="1.2" fill="none"/></svg>`,
      audio: `<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 4h2l3-2v8l-3-2H2V4z" stroke="#ffee88" stroke-width="1.2" fill="none"/></svg>`
    };

    item.innerHTML = `
      <span class="tree-indent"></span>
      <svg class="tree-arrow invisible" width="8" height="8" viewBox="0 0 8 8"><path d="M2 2l4 2-4 2" fill="currentColor"/></svg>
      ${icons[type] || icons.empty}
      <span class="tree-label">${name}</span>
    `;

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      AudioSystem.click();
      document.querySelectorAll('.tree-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
    });

    item.addEventListener('contextmenu', e => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY);
    });

    children.appendChild(item);
    toast(`Created: ${name}`, 'success');
    Console.log(`Entity created: ${name}`, 'log', 'Hierarchy.js');
    AudioSystem.playTone(660, 0.12, 0.05);
  }

  document.getElementById('btn-add-entity').addEventListener('click', () => {
    AudioSystem.click();
    addHierarchyEntity('Empty Object', 'empty');
  });

  /* ── INSPECTOR UPDATES ────────────────── */

  function updateInspectorForEntity(id) {
    const names = {
      'main-camera': 'Main Camera',
      'dir-light': 'Directional Light',
      'player': 'Player',
      'player-mesh': 'Mesh',
      'player-collider': 'Collider'
    };
    const name = names[id] || id;
    document.getElementById('entity-name').value = name;
    Console.log(`Inspecting: ${name}`, 'log', 'Inspector.js');
  }

  document.getElementById('fov-slider').addEventListener('input', function() {
    document.getElementById('fov-val').textContent = this.value + '°';
  });

  /* ── ADD COMPONENT ────────────────────── */

  document.getElementById('btn-add-component').addEventListener('click', () => {
    AudioSystem.click();
    const components = ['Rigidbody', 'BoxCollider', 'MeshRenderer', 'AudioSource', 'ParticleSystem', 'Light', 'Script'];
    const pick = components[Math.floor(Math.random() * components.length)];
    toast(`Added component: ${pick}`, 'success');
    Console.log(`Component added: ${pick}`, 'log', 'Inspector.js');
  });

  /* ── COMPONENT COLLAPSE ───────────────── */

  document.querySelectorAll('.component-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.component-menu-btn')) return;
      AudioSystem.click();
      const body = header.nextElementSibling;
      const arrow = header.querySelector('.comp-arrow');
      if (body) {
        const collapsed = body.style.display === 'none';
        body.style.display = collapsed ? '' : 'none';
        arrow.classList.toggle('open', collapsed);
      }
    });
  });

  /* ── CONSOLE OUTPOST ──────────────────── */

  document.getElementById('btn-clear-console').addEventListener('click', () => {
    AudioSystem.click();
    Console.clear();
  });

  document.getElementById('btn-console-run').addEventListener('click', () => {
    const input = document.getElementById('console-input');
    AudioSystem.playTone(660, 0.08, 0.04);
    Console.execute(input.value);
    input.value = '';
  });

  document.getElementById('console-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      document.getElementById('btn-console-run').click();
    }
  });

  document.querySelectorAll('.console-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AudioSystem.click();
      document.querySelectorAll('.console-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      document.querySelectorAll('.log-entry').forEach(entry => {
        entry.style.display = (filter === 'all' || entry.dataset.type === filter) ? '' : 'none';
      });
    });
  });

  document.getElementById('console-filter-input').addEventListener('input', function() {
    const q = this.value.toLowerCase();
    document.querySelectorAll('.log-entry').forEach(entry => {
      const msg = entry.querySelector('.log-msg')?.textContent.toLowerCase() || '';
      entry.style.display = msg.includes(q) ? '' : 'none';
    });
  });

  /* ── PROJECT PANEL ────────────────────── */

  document.querySelectorAll('.proj-folder').forEach(folder => {
    folder.addEventListener('click', () => {
      AudioSystem.click();
      document.querySelectorAll('.proj-folder').forEach(f => f.classList.remove('active'));
      folder.classList.add('active');
      Console.log(`Browsing: ${folder.dataset.folder}`, 'log', 'Project.js');
    });
  });

  document.querySelectorAll('.file-item').forEach(file => {
    file.addEventListener('click', () => {
      AudioSystem.click();
      document.querySelectorAll('.file-item').forEach(f => f.classList.remove('selected'));
      file.classList.add('selected');
      if (file.dataset.type === 'script') {
        document.getElementById('code-file-name').textContent = file.dataset.name;
        setCodeTab();
      }
      Console.log(`Selected: ${file.dataset.name}`, 'log', 'Project.js');
    });
  });

  /* ── CONTEXT MENU ─────────────────────── */

  const ctxMenu = document.getElementById('context-menu');

  function showContextMenu(x, y) {
    ctxMenu.style.left = Math.min(x, window.innerWidth - 180) + 'px';
    ctxMenu.style.top = Math.min(y, window.innerHeight - 160) + 'px';
    ctxMenu.classList.remove('hidden');
  }

  document.addEventListener('click', () => ctxMenu.classList.add('hidden'));

  ctxMenu.querySelectorAll('.ctx-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      AudioSystem.click();
      ctxMenu.classList.add('hidden');
      const action = item.dataset.action;
      if (action === 'delete' && selectedEntity) {
        const el = document.querySelector(`.tree-item[data-id="${selectedEntity}"]`);
        if (el) { el.remove(); toast('Entity deleted', 'warn'); Console.log(`Deleted: ${selectedEntity}`, 'warn', 'Hierarchy.js'); }
      } else if (action === 'add-child') {
        addHierarchyEntity('Child Object', 'empty');
      } else {
        toast(`${action} — coming soon`, 'warn');
      }
    });
  });

  /* ── RESIZE HANDLES ───────────────────── */

  function makeResizable(handleId, targetId, direction, minSize) {
    const handle = document.getElementById(handleId);
    const target = document.getElementById(targetId);
    if (!handle || !target) return;

    let dragging = false, start = 0, startSize = 0;

    handle.addEventListener('mousedown', e => {
      dragging = true;
      start = direction === 'h' ? e.clientX : e.clientY;
      startSize = direction === 'h' ? target.offsetWidth : target.offsetHeight;
      handle.classList.add('dragging');
      document.body.style.cursor = direction === 'h' ? 'col-resize' : 'row-resize';
      document.body.style.pointerEvents = 'none';
      handle.style.pointerEvents = 'auto';
    });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const delta = direction === 'h' ? e.clientX - start : e.clientY - start;
      const newSize = Math.max(minSize, startSize + (direction === 'h' && handleId === 'resize-right' ? -delta : delta));
      if (direction === 'h') target.style.width = newSize + 'px';
      else target.style.height = newSize + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.pointerEvents = '';
    });
  }

  makeResizable('resize-left', 'panel-hierarchy', 'h', 150);
  makeResizable('resize-right', 'panel-inspector', 'h', 180);
  makeResizable('resize-bottom', 'panel-bottom', 'v', 120);

  /* ── THREE.JS SCENE VIEW ──────────────── */

  function initSceneView() {
    if (typeof THREE === 'undefined') return;
    const canvas = document.getElementById('scene-canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x12121e);
    scene.fog = new THREE.Fog(0x12121e, 20, 80);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(5, 5, 8);
    camera.lookAt(0, 0, 0);

    // Grid
    const grid = new THREE.GridHelper(20, 20, 0x222233, 0x1a1a2a);
    scene.add(grid);

    // Ambient + directional light
    scene.add(new THREE.AmbientLight(0x334455, 1.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Accent point light
    const ptLight = new THREE.PointLight(0x00d4ff, 2, 15);
    ptLight.position.set(-3, 3, 3);
    scene.add(ptLight);

    // Demo cube (Player)
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x4488ff, metalness: 0.3, roughness: 0.5 })
    );
    cube.castShadow = true;
    scene.add(cube);

    // Ground plane
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x111120, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    // Orbit-like controls via mouse
    let mouseDown = false, lastX = 0, lastY = 0;
    let theta = 0.6, phi = 0.8, radius = 10;

    canvas.addEventListener('mousedown', e => { if (e.button === 2) { mouseDown = true; lastX = e.clientX; lastY = e.clientY; } });
    document.addEventListener('mouseup', () => mouseDown = false);
    document.addEventListener('mousemove', e => {
      if (!mouseDown) return;
      theta -= (e.clientX - lastX) * 0.01;
      phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi + (e.clientY - lastY) * 0.01));
      lastX = e.clientX; lastY = e.clientY;
    });

    canvas.addEventListener('wheel', e => {
      radius = Math.max(2, Math.min(40, radius + e.deltaY * 0.02));
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('contextmenu', e => e.preventDefault());

    let t = 0;
    function animate() {
      requestAnimationFrame(animate);
      t += 0.01;
      cube.rotation.y = t * 0.5;
      cube.position.y = Math.sin(t) * 0.15;
      ptLight.intensity = 1.5 + Math.sin(t * 2) * 0.5;

      camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = radius * Math.cos(phi);
      camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(0, 0, 0);

      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (renderer.domElement.width !== w || renderer.domElement.height !== h) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }

      renderer.render(scene, camera);
    }
    animate();
    Console.log('Three.js scene view initialized', 'log', 'SceneView.js');
  }

  /* ── MONACO EDITOR ────────────────────── */

  let monacoReady = false;

  function initMonaco() {
    if (monacoReady) return;
    monacoReady = true;

    const placeholder = document.getElementById('monaco-placeholder');
    if (placeholder) placeholder.remove();

    if (!window.require) {
      Console.log('Monaco loader not found — using textarea fallback', 'warn', 'CodeEditor.js');
      const container = document.getElementById('monaco-container');
      container.innerHTML = '';
      const ta = document.createElement('textarea');
      ta.style.cssText = 'width:100%;height:100%;background:#0e0e13;color:#dddde8;border:none;padding:16px;font-family:JetBrains Mono,monospace;font-size:13px;resize:none;outline:none;';
      ta.value = `// CEngine Script — player.js
// Language: JavaScript

class PlayerController {
  constructor(entity) {
    this.entity = entity;
    this.speed = 5.0;
    this.jumpForce = 10.0;
  }

  onStart() {
    this.rb = this.entity.getComponent('Rigidbody');
    CEngine.log('Player ready');
  }

  onUpdate(dt) {
    if (Input.held('right')) {
      this.rb.velocity.x = this.speed;
    }
    if (Input.held('left')) {
      this.rb.velocity.x = -this.speed;
    }
    if (Input.pressed('jump') && this.isGrounded()) {
      this.rb.addForce(0, this.jumpForce, 0);
    }
  }

  onCollide(other) {
    if (other.tag === 'Enemy') {
      Scene.load('GameOver');
    }
  }

  isGrounded() {
    return Physics.raycast(
      this.entity.position,
      Vector3.down,
      0.6
    );
  }
}`;
      container.appendChild(ta);
      Console.log('Code editor ready (fallback mode)', 'log', 'CodeEditor.js');
      return;
    }

    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }});
    require(['vs/editor/editor.main'], function() {
      const container = document.getElementById('monaco-container');
      container.innerHTML = '';

      const editor = monaco.editor.create(container, {
        value: `// CEngine Script — player.js\n// Language: JavaScript\n\nclass PlayerController {\n  constructor(entity) {\n    this.entity = entity;\n    this.speed = 5.0;\n  }\n\n  onStart() {\n    CEngine.log('Player ready');\n  }\n\n  onUpdate(dt) {\n    if (Input.held('right')) this.entity.position.x += this.speed * dt;\n    if (Input.held('left'))  this.entity.position.x -= this.speed * dt;\n  }\n}`,
        language: 'javascript',
        theme: 'vs-dark',
        fontSize: 13,
        fontFamily: 'JetBrains Mono, Cascadia Code, monospace',
        fontLigatures: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: 'on',
        lineNumbers: 'on',
        renderLineHighlight: 'gutter',
        cursorBlinking: 'smooth',
      });

      document.getElementById('code-lang-select').addEventListener('change', function() {
        const map = { javascript:'javascript', cscript:'javascript', python:'python', lua:'lua', glsl:'glsl', css:'css' };
        monaco.editor.setModelLanguage(editor.getModel(), map[this.value] || 'javascript');
        Console.log(`Language switched to ${this.value}`, 'log', 'CodeEditor.js');
      });

      document.getElementById('btn-save-script').addEventListener('click', () => {
        toast('Script saved', 'success');
        Console.log(`Script saved: ${document.getElementById('code-file-name').textContent}`, 'log', 'CodeEditor.js');
      });

      document.getElementById('btn-run-script').addEventListener('click', () => {
        AudioSystem.playTone(880, 0.15, 0.06);
        toast('Script executed', 'success');
        Console.log('Script executed in scene context', 'log', 'CodeEditor.js');
      });

      Console.log('Monaco Editor loaded', 'log', 'CodeEditor.js');
    });
  }

  /* ── AUDIO TOGGLE ─────────────────────── */

  document.getElementById('btn-audio-toggle').addEventListener('click', () => {
    AudioSystem.toggle();
  });

  /* ── KEYBOARD SHORTCUTS ───────────────── */

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 's') { e.preventDefault(); toast('Scene saved', 'success'); Console.log('Scene saved (Ctrl+S)', 'log', 'Scene.js'); }
      if (e.key === 'n') { e.preventDefault(); document.querySelector('.dd-item[data-action="new-scene"]').click(); }
      if (e.key === 'z') { e.preventDefault(); toast('Undo', 'log'); }
      if (e.key === 'p') { e.preventDefault(); document.getElementById('btn-play').click(); }
    }
    if (e.key === 'Escape') { closeAllMenus(); ctxMenu.classList.add('hidden'); closeBuildModal(); }
    if (e.key === 'Delete' && selectedEntity) {
      const el = document.querySelector(`.tree-item[data-id="${selectedEntity}"]`);
      if (el) { el.remove(); toast('Entity deleted', 'warn'); }
    }
  });

  /* ── INSPECTOR ICON TABS ──────────────── */

  document.querySelectorAll('.inspector-icon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AudioSystem.click();
      document.querySelectorAll('.inspector-icon-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  /* ── ADD GLOBAL CLICK SFX ─────────────── */

  document.querySelectorAll('button, .menu-item, .tree-item, .file-item, .proj-folder, .dd-item, .bottom-tab, .center-tab').forEach(el => {
    if (!el._sfxBound) {
      el._sfxBound = true;
      el.addEventListener('click', () => AudioSystem.click(), { passive: true });
    }
  });

  /* ── INIT ─────────────────────────────── */

  AudioSystem.init();
  initSceneView();

  // Startup logs
  setTimeout(() => Console.log('Editor UI initialized', 'log', 'Editor.js'), 100);
  setTimeout(() => Console.log('Input manager ready', 'log', 'Input.js'), 200);
  setTimeout(() => toast('CEngine loaded — Welcome!', 'success', 3000), 500);

})();
