/* ═══════════════════════════════════════════
   CENGINE — SCRIPT RUNTIME
   Runs class-based scripts attached to entities
   ═══════════════════════════════════════════ */

window.CScriptRuntime = (function () {
  'use strict';

  const instances = []; // { entity, instance, name }

  /* ══════════════════════════════════════
     SCENE API — available inside scripts
  ══════════════════════════════════════ */
  function makeSceneAPI(entities, threeScene) {
    return {
      find(name) {
        return entities.find(e => e.name === name) || null;
      },
      findAll(tag) {
        return entities.filter(e => e.tag === tag);
      },
      destroy(entity) {
        if (!entity) return;
        if (entity.mesh) {
          threeScene.remove(entity.mesh);
          if (entity.mesh.geometry) entity.mesh.geometry.dispose();
          if (entity.mesh.material) entity.mesh.material.dispose();
        }
        const idx = entities.indexOf(entity);
        if (idx !== -1) entities.splice(idx, 1);
        if (window.CPhysics) window.CPhysics.removeBody(entity.id);
      },
      spawn(name, position) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.5, 0.5),
          new THREE.MeshStandardMaterial({ color: 0xff8844 })
        );
        mesh.position.set(position ? position.x : 0, position ? position.y : 0, position ? position.z : 0);
        mesh.castShadow = true;
        threeScene.add(mesh);
        const entity = {
          id: Date.now() + Math.random(),
          name, active: true, mesh,
          position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
          rotation: { x: 0, y: 0, z: 0 },
          scale:    { x: 1, y: 1, z: 1 },
          components: []
        };
        entities.push(entity);
        return entity;
      },
      load(sceneName) {
        console.log('[Scene] Load:', sceneName);
      }
    };
  }

  /* ══════════════════════════════════════
     INSTANTIATE — compile + run a script
  ══════════════════════════════════════ */
  function instantiate(code, entity, sceneAPI) {
    // Extract class name
    const match = code.match(/class\s+(\w+)/);
    if (!match) return null;
    const className = match[1];

    // Build rigidbody proxy
    const rbProxy = {
      addForce(x, y, z) {
        const b = window.CPhysics && window.CPhysics.getBody(entity.id);
        if (b && b.rb) {
          b.rb.applyImpulse({ x, y, z }, true);
        } else if (entity._phys) {
          entity._phys.vy += y * 0.1;
        }
      },
      setVelocity(x, y, z) {
        const b = window.CPhysics && window.CPhysics.getBody(entity.id);
        if (b && b.rb) b.rb.setLinvel({ x, y, z }, true);
      },
      get grounded() {
        return entity._phys ? entity._phys.grounded : false;
      }
    };

    // Build transform proxy
    const transformProxy = {
      get position() { return entity.mesh ? entity.mesh.position : entity.position; },
      set position(v) { if (entity.mesh) entity.mesh.position.set(v.x, v.y, v.z); },
      get rotation() { return entity.mesh ? entity.mesh.rotation : entity.rotation; },
      get scale()    { return entity.mesh ? entity.mesh.scale    : entity.scale;    }
    };

    // Sandbox
    const sandbox = {
      transform:  transformProxy,
      rb:         rbProxy,
      entity: {
        get name()   { return entity.name; },
        get tag()    { return entity.tag || ''; },
        get active() { return entity.active; },
        destroy()    { sceneAPI.destroy(entity); }
      },
      Input:   window.CInput,
      Sound:   window.CSound,
      Scene:   sceneAPI,
      CEngine: {
        log: (msg) => {
          console.log('[Script]', msg);
          if (window._CEngineLog) window._CEngineLog(String(msg), 'log', className);
        }
      },
      Vector3: {
        add:       (a, b) => ({ x: a.x+b.x, y: a.y+b.y, z: a.z+b.z }),
        sub:       (a, b) => ({ x: a.x-b.x, y: a.y-b.y, z: a.z-b.z }),
        scale:     (v, s) => ({ x: v.x*s,   y: v.y*s,   z: v.z*s   }),
        length:    (v)    => Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z),
        normalize: (v)    => {
          const l = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z) || 1;
          return { x: v.x/l, y: v.y/l, z: v.z/l };
        },
        dot:       (a, b) => a.x*b.x + a.y*b.y + a.z*b.z,
        distance:  (a, b) => Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2 + (a.z-b.z)**2),
        zero:      ()     => ({ x: 0, y: 0, z: 0 }),
        up:        ()     => ({ x: 0, y: 1, z: 0 }),
        forward:   ()     => ({ x: 0, y: 0, z: -1 })
      },
      THREE,
      Math,
      console
    };

    try {
      const keys = Object.keys(sandbox);
      const vals = Object.values(sandbox);
      const fn   = new Function(...keys, `${code}; return new ${className}();`);
      return fn(...vals);
    } catch (e) {
      console.error('[ScriptRuntime] Compile error:', e.message);
      if (window._CEngineLog) window._CEngineLog('Script error: ' + e.message, 'error', className);
      return null;
    }
  }

  /* ══════════════════════════════════════
     INIT — run all scripts onStart
  ══════════════════════════════════════ */
  function init(entities, threeScene) {
    instances.length = 0;
    const sceneAPI = makeSceneAPI(entities, threeScene);

    entities.forEach(entity => {
      if (!entity.components) return;
      entity.components.forEach(comp => {
        if (comp.type !== 'script' || !comp.code) return;
        const inst = instantiate(comp.code, entity, sceneAPI);
        if (!inst) return;
        instances.push({ entity, instance: inst, name: comp.name || 'Script' });
        try { inst.onStart && inst.onStart(); }
        catch(e) {
          console.error('[ScriptRuntime] onStart error:', e.message);
          if (window._CEngineLog) window._CEngineLog(e.message, 'error', comp.name);
        }
      });
    });
  }

  /* ══════════════════════════════════════
     UPDATE — call every frame
  ══════════════════════════════════════ */
  function update(dt) {
    instances.forEach(({ entity, instance, name }) => {
      try { instance.onUpdate && instance.onUpdate(dt); }
      catch(e) {
        if (!instance._errCount) instance._errCount = 0;
        instance._errCount++;
        if (instance._errCount < 3) {
          console.error('[ScriptRuntime] onUpdate error:', e.message);
          if (window._CEngineLog) window._CEngineLog(e.message, 'error', name);
        }
      }
    });
  }

  /* ══════════════════════════════════════
     STOP — cleanup
  ══════════════════════════════════════ */
  function stop() {
    instances.forEach(({ instance }) => {
      try { instance.onStop && instance.onStop(); } catch(e) {}
    });
    instances.length = 0;
  }

  return { init, update, stop };
})();
