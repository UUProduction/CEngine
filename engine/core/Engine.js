/* ═══════════════════════════════════════════
   CENGINE — CORE RUNTIME ENGINE v0.4
   Physics + Script Runtime + Input
   ═══════════════════════════════════════════ */

window.CEngineRuntime = (function () {
  'use strict';

  /* ══════════════════════════════════════
     RAPIER PHYSICS
  ══════════════════════════════════════ */
  const Physics = {
    world:      null,
    bodies:     new Map(), // entityId → { rigidBody, collider }
    rapier:     null,
    gravity:    { x: 0, y: -9.81, z: 0 },
    initialized: false,

    async init() {
      try {
        // Load Rapier WASM
        if (!window.RAPIER) {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.11.2/rapier.min.js';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
          });
        }
        await window.RAPIER.init();
        this.rapier = window.RAPIER;
        this.world  = new this.rapier.World(this.gravity);
        this.initialized = true;
        console.log('[CEngine] Rapier physics ready');
        return true;
      } catch (e) {
        console.warn('[CEngine] Rapier not loaded — using fallback physics:', e.message);
        this.initialized = false;
        return false;
      }
    },

    addBody(entity, type = 'dynamic') {
      if (!this.initialized || !entity.mesh) return null;
      const p = entity.mesh.position;

      let rbDesc;
      if      (type === 'dynamic')   rbDesc = this.rapier.RigidBodyDesc.dynamic();
      else if (type === 'kinematic') rbDesc = this.rapier.RigidBodyDesc.kinematicPositionBased();
      else                           rbDesc = this.rapier.RigidBodyDesc.fixed();

      rbDesc.setTranslation(p.x, p.y, p.z);
      const rb = this.world.createRigidBody(rbDesc);

      // Auto collider from geometry
      const geo  = entity.mesh.geometry;
      let collDesc;
      if (geo?.type === 'SphereGeometry') {
        collDesc = this.rapier.ColliderDesc.ball(0.5);
      } else if (geo?.type === 'CylinderGeometry') {
        collDesc = this.rapier.ColliderDesc.cylinder(0.5, 0.5);
      } else {
        collDesc = this.rapier.ColliderDesc.cuboid(
          (entity.scale?.x ?? 1) * 0.5,
          (entity.scale?.y ?? 1) * 0.5,
          (entity.scale?.z ?? 1) * 0.5
        );
      }

      collDesc.setRestitution(0.3).setFriction(0.7);
      const collider = this.world.createCollider(collDesc, rb);

      this.bodies.set(entity.id, { rigidBody: rb, collider, type });
      return rb;
    },

    removeBody(entityId) {
      const body = this.bodies.get(entityId);
      if (!body) return;
      this.world.removeCollider(body.collider, false);
      this.world.removeRigidBody(body.rigidBody);
      this.bodies.delete(entityId);
    },

    step(dt) {
      if (!this.initialized) return;
      this.world.timestep = Math.min(dt, 0.05);
      this.world.step();
    },

    syncToMeshes(entities) {
      if (!this.initialized) return;
      entities.forEach(entity => {
        const body = this.bodies.get(entity.id);
        if (!body || !entity.mesh || body.type === 'fixed') return;
        const t = body.rigidBody.translation();
        const r = body.rigidBody.rotation();
        entity.mesh.position.set(t.x, t.y, t.z);
        entity.mesh.quaternion.set(r.x, r.y, r.z, r.w);
        entity.position = { x: t.x, y: t.y, z: t.z };
      });
    },

    // Fallback gravity when Rapier isn't loaded
    stepFallback(entities, dt) {
      entities.forEach(entity => {
        if (!entity.mesh || !entity._physics) return;
        if (entity._physics.type !== 'dynamic') return;
        entity._physics.vy = (entity._physics.vy || 0) + this.gravity.y * dt;
        entity.mesh.position.y += entity._physics.vy * dt;
        entity.position.y = entity.mesh.position.y;
        if (entity.mesh.position.y < 0.5) {
          entity.mesh.position.y = 0.5;
          entity.position.y      = 0.5;
          entity._physics.vy     = 0;
        }
      });
    }
  };

  /* ══════════════════════════════════════
     INPUT SYSTEM
  ══════════════════════════════════════ */
  const Input = {
    keys:       {},
    prevKeys:   {},
    mouse:      { x: 0, y: 0, buttons: {} },
    gamepad:    null,
    touchAxes:  { lx: 0, ly: 0, rx: 0, ry: 0 },

    init() {
      window.addEventListener('keydown',  e => { this.keys[e.code] = true;  this.keys[e.key.toLowerCase()] = true;  });
      window.addEventListener('keyup',    e => { this.keys[e.code] = false; this.keys[e.key.toLowerCase()] = false; });
      window.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
      window.addEventListener('mousedown', e => { this.mouse.buttons[e.button] = true; });
      window.addEventListener('mouseup',   e => { this.mouse.buttons[e.button] = false; });
      window.addEventListener('gamepadconnected', e => { this.gamepad = e.gamepad; });
    },

    tick() {
      this.prevKeys = { ...this.keys };
      // Sync gamepad
      if (this.gamepad) {
        const gp = navigator.getGamepads()[this.gamepad.index];
        if (gp) {
          this.touchAxes.lx = Math.abs(gp.axes[0]) > 0.1 ? gp.axes[0] : 0;
          this.touchAxes.ly = Math.abs(gp.axes[1]) > 0.1 ? gp.axes[1] : 0;
          this.touchAxes.rx = Math.abs(gp.axes[2]) > 0.1 ? gp.axes[2] : 0;
          this.touchAxes.ry = Math.abs(gp.axes[3]) > 0.1 ? gp.axes[3] : 0;
        }
      }
      // Sync virtual joystick axes from mobile
      if (window.VirtualJoystick) {
        this.touchAxes.lx = window.VirtualJoystick.leftX  || 0;
        this.touchAxes.ly = window.VirtualJoystick.leftY  || 0;
        this.touchAxes.rx = window.VirtualJoystick.rightX || 0;
        this.touchAxes.ry = window.VirtualJoystick.rightY || 0;
      }
    },

    held(key)    { return !!this.keys[key] || !!this.keys[key.toLowerCase()] || !!this.keys['Key' + key.toUpperCase()]; },
    pressed(key) { return !!this.keys[key] && !this.prevKeys[key]; },
    released(key){ return !this.keys[key]  &&  !!this.prevKeys[key]; },

    axis(name) {
      const map = {
        'horizontal':  this.touchAxes.lx || (this.held('d') || this.held('ArrowRight') ? 1 : this.held('a') || this.held('ArrowLeft') ? -1 : 0),
        'vertical':    this.touchAxes.ly || (this.held('s') || this.held('ArrowDown')  ? 1 : this.held('w') || this.held('ArrowUp')   ? -1 : 0),
        'lookX':       this.touchAxes.rx,
        'lookY':       this.touchAxes.ry
      };
      return map[name] ?? 0;
    }
  };

  /* ══════════════════════════════════════
     SCRIPT RUNTIME
  ══════════════════════════════════════ */
  const ScriptRuntime = {
    instances: [], // { entity, instance, scriptName }

    init(entities, sceneAPI) {
      this.instances = [];
      entities.forEach(entity => {
        if (!entity.components) return;
        entity.components
          .filter(c => c.type === 'script' && c.code)
          .forEach(comp => {
            try {
              const instance = this._instantiate(comp.code, entity, sceneAPI);
              if (instance) {
                this.instances.push({ entity, instance, name: comp.name || 'Script' });
                instance.onStart?.();
              }
            } catch (e) {
              console.error('[Script] onStart error:', e.message);
              sceneAPI.log(`Script error (${entity.name}): ${e.message}`, 'error');
            }
          });
      });
    },

    _instantiate(code, entity, sceneAPI) {
      // Build the script sandbox
      const sandbox = {
        // Transform proxy
        transform: {
          get position() { return entity.mesh?.position || { x:0,y:0,z:0 }; },
          set position(v) { if(entity.mesh) entity.mesh.position.set(v.x,v.y,v.z); },
          get rotation() { return entity.mesh?.rotation || { x:0,y:0,z:0 }; },
          get scale()    { return entity.mesh?.scale    || { x:1,y:1,z:1 }; }
        },
        rb: {
          velocity:   { x:0, y:0, z:0 },
          addForce(x,y,z) {
            const body = Physics.bodies.get(entity.id);
            if (body?.rigidBody) {
              body.rigidBody.applyImpulse({ x, y, z }, true);
            } else {
              entity._physics = entity._physics || { type:'dynamic', vy:0 };
              entity._physics.vy += y * 0.1;
            }
          },
          setVelocity(x,y,z) {
            const body = Physics.bodies.get(entity.id);
            if (body?.rigidBody) body.rigidBody.setLinvel({ x,y,z }, true);
          }
        },
        entity: {
          get name()   { return entity.name; },
          get tag()    { return entity.tag || ''; },
          get active() { return entity.active; },
          destroy()    { sceneAPI.destroy(entity.id); }
        },
        Input,
        Sound:     window.SoundEngine,
        Particles: window.ParticleSystem,
        Scene:     sceneAPI,
        CEngine:   { log: (m) => sceneAPI.log(String(m), 'log', entity.name) },
        Vector3: {
          add:       (a,b) => ({ x:a.x+b.x, y:a.y+b.y, z:a.z+b.z }),
          sub:       (a,b) => ({ x:a.x-b.x, y:a.y-b.y, z:a.z-b.z }),
          scale:     (v,s) => ({ x:v.x*s,   y:v.y*s,   z:v.z*s   }),
          length:    (v)   => Math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z),
          normalize: (v)   => { const l=Math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z)||1; return {x:v.x/l,y:v.y/l,z:v.z/l}; },
          dot:       (a,b) => a.x*b.x+a.y*b.y+a.z*b.z,
          distance:  (a,b) => Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2),
          zero:      () => ({ x:0,y:0,z:0 }),
          up:        () => ({ x:0,y:1,z:0 }),
          forward:   () => ({ x:0,y:0,z:-1 })
        },
        Math, console,
        THREE: window.THREE
      };

      // Extract class name from code
      const classMatch = code.match(/class\s+(\w+)/);
      if (!classMatch) return null;
      const className = classMatch[1];

      // Build sandboxed function
      const keys = Object.keys(sandbox);
      const vals = Object.values(sandbox);
      const fn   = new Function(...keys, `${code}; return new ${className}();`);
      return fn(...vals);
    },

    update(dt) {
      this.instances.forEach(({ entity, instance, name }) => {
        try {
          instance.onUpdate?.(dt);
        } catch (e) {
          // Throttle error logging
          if (!instance._errCount) instance._errCount = 0;
          instance._errCount++;
          if (instance._errCount < 4) console.error(`[Script:${name}] ${e.message}`);
        }
      });
    },

    onCollide(entityA, entityB) {
      const a = this.instances.find(i => i.entity.id === entityA);
      const b = this.instances.find(i => i.entity.id === entityB);
      a?.instance?.onCollide?.({ tag: b?.entity?.tag, name: b?.entity?.name });
      b?.instance?.onCollide?.({ tag: a?.entity?.tag, name: a?.entity?.name });
    },

    stop() {
      this.instances.forEach(({ instance }) => instance.onStop?.());
      this.instances = [];
    }
  };

  /* ══════════════════════════════════════
     SCENE API (exposed to scripts)
  ══════════════════════════════════════ */
  function makeSceneAPI(entities, three, logFn) {
    return {
      find: (name) => entities.find(e => e.name === name) || null,
      findAll: (tag) => entities.filter(e => e.tag === tag),
      destroy: (id)  => {
        const e = entities.find(x => x.id === id);
        if (!e) return;
        if (e.mesh) { three.scene.remove(e.mesh); e.mesh.geometry?.dispose(); e.mesh.material?.dispose(); }
        const idx = entities.indexOf(e);
        if (idx !== -1) entities.splice(idx, 1);
        Physics.removeBody(id);
      },
      spawn: (prefabName, pos) => {
        // Spawn a new entity at runtime
        const mesh = new three.THREE.Mesh(
          new three.THREE.BoxGeometry(0.5,0.5,0.5),
          new three.THREE.MeshStandardMaterial({ color: 0xff8844 })
        );
        mesh.position.set(pos?.x||0, pos?.y||0, pos?.z||0);
        mesh.castShadow = true;
        three.scene.add(mesh);
        const entity = { id: Date.now(), name: prefabName, type:'mesh', active:true, mesh, components:[], position:{...pos||{x:0,y:0,z:0}} };
        entities.push(entity);
        return entity;
      },
      load:    (name) => console.log('[Scene] Load:', name),
      score:   0,
      log:     logFn || console.log
    };
  }

  /* ══════════════════════════════════════
     GAME LOOP
  ══════════════════════════════════════ */
  const GameLoop = {
    running:   false,
    lastTime:  0,
    frameId:   null,
    onTick:    null, // callback(dt)

    start(callback) {
      this.running  = true;
      this.lastTime = performance.now();
      this.onTick   = callback;
      this._tick();
    },

    _tick() {
      if (!this.running) return;
      const now = performance.now();
      const dt  = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;
      this.onTick?.(dt);
      this.frameId = requestAnimationFrame(() => this._tick());
    },

    stop() {
      this.running = false;
      if (this.frameId) cancelAnimationFrame(this.frameId);
    }
  };

  /* ══════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════ */
  return { Physics, Input, ScriptRuntime, GameLoop, makeSceneAPI };

})();
