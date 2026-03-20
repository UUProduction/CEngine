/* ═══════════════════════════════════════════
   CENGINE — GAME SYSTEMS v0.1
   Collision, Projectiles, Health/Damage,
   VFX Particles, Animation Timeline,
   Enemy AI Pathfinding
   ═══════════════════════════════════════════ */

/* ══════════════════════════════════════
   COLLISION SYSTEM
   Simple AABB collision between entities
══════════════════════════════════════ */
window.CCollision = (function () {
  'use strict';

  const boxes = new Map(); // entityId → THREE.Box3

  function update(entities) {
    // Rebuild all boxes
    boxes.clear();
    entities.forEach(entity => {
      if (!entity.mesh || !entity.active) return;
      const box = new THREE.Box3().setFromObject(entity.mesh);
      boxes.set(entity.id, box);
    });

    // Check all pairs
    const ids = Array.from(boxes.keys());
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = boxes.get(ids[i]);
        const b = boxes.get(ids[j]);
        if (!a || !b) continue;
        if (a.intersectsBox(b)) {
          const ea = entities.find(e => e.id === ids[i]);
          const eb = entities.find(e => e.id === ids[j]);
          if (!ea || !eb) continue;
          _resolve(ea, eb, a, b);
          _fireCallbacks(ea, eb);
        }
      }
    }

    // Player rig collision
    _playerCollision(entities);
  }

  function _resolve(ea, eb, boxA, boxB) {
    // Only push dynamic entities
    const aDynamic = ea._phys && ea._phys.type !== 'fixed' && ea.name !== 'Floor';
    const bDynamic = eb._phys && eb._phys.type !== 'fixed' && eb.name !== 'Floor';
    if (!aDynamic && !bDynamic) return;

    // Find overlap on each axis
    const centerA = new THREE.Vector3(), centerB = new THREE.Vector3();
    boxA.getCenter(centerA); boxB.getCenter(centerB);
    const sizeA = new THREE.Vector3(), sizeB = new THREE.Vector3();
    boxA.getSize(sizeA); boxB.getSize(sizeB);

    const dx = centerA.x - centerB.x;
    const dy = centerA.y - centerB.y;
    const dz = centerA.z - centerB.z;
    const ox = (sizeA.x + sizeB.x) / 2 - Math.abs(dx);
    const oy = (sizeA.y + sizeB.y) / 2 - Math.abs(dy);
    const oz = (sizeA.z + sizeB.z) / 2 - Math.abs(dz);

    if (ox <= 0 || oy <= 0 || oz <= 0) return;

    // Push on smallest overlap axis
    let pushX = 0, pushY = 0, pushZ = 0;
    if (oy < ox && oy < oz) {
      pushY = oy * Math.sign(dy);
      if (aDynamic && ea._phys) { ea.mesh.position.y += pushY * 0.5; ea._phys.vy = 0; ea._phys.grounded = true; }
      if (bDynamic && eb._phys) { eb.mesh.position.y -= pushY * 0.5; eb._phys.vy = 0; eb._phys.grounded = true; }
    } else if (ox < oz) {
      pushX = ox * Math.sign(dx);
      if (aDynamic && ea.mesh) ea.mesh.position.x += pushX * 0.5;
      if (bDynamic && eb.mesh) eb.mesh.position.x -= pushX * 0.5;
    } else {
      pushZ = oz * Math.sign(dz);
      if (aDynamic && ea.mesh) ea.mesh.position.z += pushZ * 0.5;
      if (bDynamic && eb.mesh) eb.mesh.position.z -= pushZ * 0.5;
    }

    // Sync entity position data
    if (aDynamic && ea.mesh) ea.position = { x: ea.mesh.position.x, y: ea.mesh.position.y, z: ea.mesh.position.z };
    if (bDynamic && eb.mesh) eb.position = { x: eb.mesh.position.x, y: eb.mesh.position.y, z: eb.mesh.position.z };
  }

  function _fireCallbacks(ea, eb) {
    ea._collideWith && ea._collideWith(eb);
    eb._collideWith && eb._collideWith(ea);
  }

  function _playerCollision(entities) {
    if (!window.CPlayerRig || !window.CPlayerRig.group || !window.CPlayerRig.active) return;
    const rig = window.CPlayerRig.group;
    const rigBox = new THREE.Box3().setFromObject(rig);

    entities.forEach(entity => {
      if (!entity.mesh || !entity.active || entity.name === 'Floor') return;
      if (entity.type === 'rig') return;
      const box = new THREE.Box3().setFromObject(entity.mesh);
      if (!rigBox.intersectsBox(box)) return;

      // Push player out
      const rigCenter = new THREE.Vector3(), eCenter = new THREE.Vector3();
      rigBox.getCenter(rigCenter); box.getCenter(eCenter);
      const rigSize = new THREE.Vector3(), eSize = new THREE.Vector3();
      rigBox.getSize(rigSize); box.getSize(eSize);

      const dx = rigCenter.x - eCenter.x;
      const dy = rigCenter.y - eCenter.y;
      const dz = rigCenter.z - eCenter.z;
      const ox = (rigSize.x + eSize.x) / 2 - Math.abs(dx);
      const oy = (rigSize.y + eSize.y) / 2 - Math.abs(dy);
      const oz = (rigSize.z + eSize.z) / 2 - Math.abs(dz);

      if (ox <= 0 || oy <= 0 || oz <= 0) return;

      if (oy < ox && oy < oz) {
        if (dy > 0) {
          rig.position.y += oy;
          window.CPlayerRig.vy = 0;
          window.CPlayerRig.grounded = true;
        } else {
          rig.position.y -= oy;
          window.CPlayerRig.vy = 0;
        }
      } else if (ox < oz) {
        rig.position.x += ox * Math.sign(dx);
      } else {
        rig.position.z += oz * Math.sign(dz);
      }

      // Fire entity hit callback
      if (entity._collideWith) entity._collideWith({ name: 'Player', tag: 'player' });
      if (window.CHealth) {
        const hp = window.CHealth.get('player');
        if (hp && entity.tag === 'hazard') window.CHealth.damage('player', 10);
      }
    });
  }

  function getBox(entityId) { return boxes.get(entityId) || null; }

  function raycast(origin, direction, entities, maxDist) {
    maxDist = maxDist || 100;
    const ray = new THREE.Ray(
      new THREE.Vector3(origin.x, origin.y, origin.z),
      new THREE.Vector3(direction.x, direction.y, direction.z).normalize()
    );
    let closest = null, closestDist = maxDist;
    entities.forEach(entity => {
      if (!entity.mesh || !entity.active) return;
      const box = new THREE.Box3().setFromObject(entity.mesh);
      const target = new THREE.Vector3();
      const hit = ray.intersectBox(box, target);
      if (hit) {
        const dist = origin ? new THREE.Vector3(origin.x, origin.y, origin.z).distanceTo(target) : 0;
        if (dist < closestDist) { closestDist = dist; closest = { entity, point: target, distance: dist }; }
      }
    });
    return closest;
  }

  return { update, raycast, getBox };
})();

/* ══════════════════════════════════════
   HEALTH SYSTEM
══════════════════════════════════════ */
window.CHealth = (function () {
  'use strict';

  const healths = new Map(); // id → { hp, maxHp, dead, callbacks }

  function register(id, maxHp) {
    maxHp = maxHp || 100;
    healths.set(id, { hp: maxHp, maxHp, dead: false, onDeath: null, onDamage: null });
    return healths.get(id);
  }

  function get(id) { return healths.get(id) || null; }

  function damage(id, amount, source) {
    const h = healths.get(id);
    if (!h || h.dead) return;
    h.hp = Math.max(0, h.hp - amount);
    h.onDamage && h.onDamage(amount, source);
    if (window.CVfx) window.CVfx.spawnHit(source || { x: 0, y: 1, z: 0 });
    if (id === 'player') _updatePlayerHUD(h);
    if (h.hp <= 0) _die(id, h);
    return h.hp;
  }

  function heal(id, amount) {
    const h = healths.get(id);
    if (!h || h.dead) return;
    h.hp = Math.min(h.maxHp, h.hp + amount);
    if (id === 'player') _updatePlayerHUD(h);
    return h.hp;
  }

  function _die(id, h) {
    h.dead = true;
    h.onDeath && h.onDeath();
    if (id === 'player') {
      window.AudioSystem?.error();
      _showDeathScreen();
    } else {
      // Kill entity
      const entity = window._gameEntities?.find(e => e.id === id || e.name === id);
      if (entity) {
        if (window.CVfx) window.CVfx.spawnExplosion(entity.mesh?.position || { x: 0, y: 1, z: 0 });
        if (window.CSceneData) window.CSceneData.remove(entity.id);
      }
    }
    healths.delete(id);
  }

  function _updatePlayerHUD(h) {
    // Update HUD bar if exists in play mode
    const pct = (h.hp / h.maxHp) * 100;
    const bar = document.getElementById('play-hp-bar');
    const val = document.getElementById('play-hp-val');
    if (bar) { bar.style.width = pct + '%'; bar.style.background = pct > 50 ? '#27ae60' : pct > 25 ? '#d4a017' : '#c0392b'; }
    if (val) val.textContent = Math.round(h.hp);
  }

  function _showDeathScreen() {
    const el = document.getElementById('play-death-screen');
    if (el) el.classList.remove('hidden');
  }

  function clear() { healths.clear(); }

  function setCallbacks(id, onDamage, onDeath) {
    const h = healths.get(id);
    if (!h) return;
    h.onDamage = onDamage;
    h.onDeath  = onDeath;
  }

  return { register, get, damage, heal, clear, setCallbacks };
})();

/* ══════════════════════════════════════
   PROJECTILE SYSTEM
   Bullets, hitscan, thrown objects
══════════════════════════════════════ */
window.CProjectiles = (function () {
  'use strict';

  const active = []; // { mesh, velocity, damage, owner, life, type, trailParts }

  function fire(scene, origin, direction, opts) {
    opts = opts || {};
    const damage   = opts.damage   || 10;
    const speed    = opts.speed    || 30;
    const lifetime = opts.lifetime || 3;
    const type     = opts.type     || 'bullet'; // bullet | rocket | laser
    const owner    = opts.owner    || 'player';
    const color    = opts.color    || (type === 'laser' ? 0xff4400 : type === 'rocket' ? 0xff8800 : 0xffff00);

    // Hitscan mode — instant raycast
    if (type === 'hitscan') {
      _doHitscan(scene, origin, direction, damage, owner);
      return null;
    }

    // Physical projectile
    const geo = type === 'rocket'
      ? new THREE.CylinderGeometry(0.05, 0.08, 0.4, 8)
      : type === 'laser'
      ? new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6)
      : new THREE.SphereGeometry(0.06, 6, 6);

    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(origin.x, origin.y, origin.z);

    // Orient along direction
    if (type !== 'bullet') {
      const dir = new THREE.Vector3(direction.x, direction.y, direction.z).normalize();
      const up  = new THREE.Vector3(0, 1, 0);
      const q   = new THREE.Quaternion().setFromUnitVectors(up, dir);
      mesh.quaternion.copy(q);
    }

    scene.add(mesh);

    // Muzzle flash VFX
    if (window.CVfx) window.CVfx.spawnMuzzleFlash(origin);

    const vel = new THREE.Vector3(direction.x, direction.y, direction.z).normalize().multiplyScalar(speed);
    const proj = { mesh, velocity: vel, damage, owner, life: lifetime, type, age: 0, trail: [] };
    active.push(proj);

    // Sound
    if (type === 'rocket') window.AudioSystem?.synth('shoot', { volume: 0.5, pitch: 0.6 });
    else if (type === 'laser') window.AudioSystem?.synth('shoot', { volume: 0.4, pitch: 1.5 });
    else window.AudioSystem?.synth('shoot', { volume: 0.35 });

    return proj;
  }

  function _doHitscan(scene, origin, direction, damage, owner) {
    const entities = window._gameEntities || [];
    const hit = window.CCollision?.raycast(origin, direction, entities, 100);

    // Tracer line
    const points = [
      new THREE.Vector3(origin.x, origin.y, origin.z),
      hit ? hit.point.clone() : new THREE.Vector3(origin.x + direction.x * 100, origin.y + direction.y * 100, origin.z + direction.z * 100)
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffff88, transparent: true, opacity: 0.8 }));
    scene.add(line);
    setTimeout(() => scene.remove(line), 80);

    if (window.CVfx) window.CVfx.spawnMuzzleFlash(origin);
    window.AudioSystem?.synth('shoot', { volume: 0.35 });

    if (hit) {
      if (window.CVfx) window.CVfx.spawnHit(hit.point);
      if (hit.entity && owner !== hit.entity.name) {
        const hp = window.CHealth.get(hit.entity.id) || window.CHealth.get(hit.entity.name);
        if (hp !== null) window.CHealth.damage(hit.entity.id || hit.entity.name, damage);
        else if (hit.entity._phys) window.CHealth.damage(hit.entity.name, damage);
      }
    }
  }

  function update(dt, scene, entities) {
    for (let i = active.length - 1; i >= 0; i--) {
      const proj = active[i];
      proj.age += dt;

      // Move
      proj.mesh.position.addScaledVector(proj.velocity, dt);

      // Gravity for rockets
      if (proj.type === 'rocket') proj.velocity.y -= 4 * dt;

      // Trail particles
      if (proj.type === 'rocket' || proj.type === 'laser') {
        if (window.CVfx) window.CVfx.spawnTrail(proj.mesh.position, proj.type === 'rocket' ? 0xff8800 : 0xff4400);
      }

      // Check lifetime
      if (proj.age >= proj.life) {
        _removeProj(proj, scene, i);
        if (proj.type === 'rocket' && window.CVfx) window.CVfx.spawnExplosion(proj.mesh.position);
        continue;
      }

      // Floor collision
      if (proj.mesh.position.y < 0) {
        if (proj.type === 'rocket' && window.CVfx) window.CVfx.spawnExplosion(proj.mesh.position);
        _removeProj(proj, scene, i);
        continue;
      }

      // Entity hit detection
      let hit = false;
      for (const entity of entities) {
        if (!entity.mesh || !entity.active) continue;
        if (entity.name === proj.owner || entity.type === 'rig') continue;
        const box = new THREE.Box3().setFromObject(entity.mesh);
        if (box.containsPoint(proj.mesh.position)) {
          // Hit!
          if (proj.type === 'rocket') {
            if (window.CVfx) window.CVfx.spawnExplosion(proj.mesh.position);
            // Splash damage
            entities.forEach(e => {
              if (!e.mesh) return;
              const dist = proj.mesh.position.distanceTo(e.mesh.position);
              if (dist < 4) {
                const d = Math.round(proj.damage * (1 - dist / 4));
                const h = window.CHealth.get(e.id) || window.CHealth.get(e.name);
                if (h !== null) window.CHealth.damage(e.id || e.name, d);
              }
            });
          } else {
            if (window.CVfx) window.CVfx.spawnHit(proj.mesh.position);
            const hp = window.CHealth.get(entity.id) || window.CHealth.get(entity.name);
            if (hp !== null) window.CHealth.damage(entity.id || entity.name, proj.damage);
          }
          window.AudioSystem?.synth('hit', { volume: 0.4 });
          _removeProj(proj, scene, i);
          hit = true;
          break;
        }
      }
    }
  }

  function _removeProj(proj, scene, idx) {
    scene.remove(proj.mesh);
    proj.mesh.geometry?.dispose();
    proj.mesh.material?.dispose();
    active.splice(idx, 1);
  }

  function clear(scene) {
    active.forEach(p => scene.remove(p.mesh));
    active.length = 0;
  }

  return { fire, update, clear };
})();

/* ══════════════════════════════════════
   VFX PARTICLE SYSTEM
   Explosions, muzzle flash, blood,
   hit sparks, trails, dust
══════════════════════════════════════ */
window.CVfx = (function () {
  'use strict';

  const particles = []; // { mesh, velocity, life, age, type }
  let scene = null;

  function init(threeScene) { scene = threeScene; }

  function _spawnParticle(pos, velocity, color, size, lifetime) {
    if (!scene) return;
    const geo = new THREE.SphereGeometry(size || 0.06, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color: color || 0xffffff });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x || 0, pos.y || 0, pos.z || 0);
    scene.add(mesh);
    particles.push({ mesh, velocity: velocity.clone(), life: lifetime || 0.6, age: 0, gravity: true });
  }

  function spawnExplosion(pos) {
    if (!scene || !pos) return;
    const colors = [0xff6600, 0xff9900, 0xffcc00, 0xff3300, 0xffffff];
    for (let i = 0; i < 24; i++) {
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        Math.random() * 10 + 2,
        (Math.random() - 0.5) * 12
      );
      _spawnParticle(pos, vel, colors[Math.floor(Math.random() * colors.length)], 0.08 + Math.random() * 0.12, 0.8 + Math.random() * 0.4);
    }
    // Shockwave ring
    const ringGeo = new THREE.RingGeometry(0.1, 0.3, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(pos.x, pos.y + 0.1, pos.z);
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);
    particles.push({ mesh: ring, velocity: new THREE.Vector3(0, 0, 0), life: 0.3, age: 0, gravity: false, scale: true, fade: true });
    window.AudioSystem?.synth('explosion', { volume: 0.6 });
  }

  function spawnMuzzleFlash(pos) {
    if (!scene || !pos) return;
    const colors = [0xffffff, 0xffff88, 0xff8800];
    for (let i = 0; i < 6; i++) {
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4
      );
      _spawnParticle(pos, vel, colors[Math.floor(Math.random() * colors.length)], 0.04, 0.08);
    }
  }

  function spawnHit(pos) {
    if (!scene || !pos) return;
    const colors = [0xffffff, 0xffdd88, 0xff8844];
    for (let i = 0; i < 8; i++) {
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 4 + 1,
        (Math.random() - 0.5) * 6
      );
      _spawnParticle(pos, vel, colors[Math.floor(Math.random() * colors.length)], 0.04, 0.3);
    }
  }

  function spawnBlood(pos) {
    if (!scene || !pos) return;
    for (let i = 0; i < 10; i++) {
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        Math.random() * 5,
        (Math.random() - 0.5) * 5
      );
      _spawnParticle(pos, vel, 0xcc0000, 0.05, 0.5 + Math.random() * 0.3);
    }
  }

  function spawnDust(pos) {
    if (!scene || !pos) return;
    for (let i = 0; i < 5; i++) {
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.5,
        (Math.random() - 0.5) * 2
      );
      _spawnParticle(pos, vel, 0x888866, 0.07, 0.4);
    }
  }

  function spawnTrail(pos, color) {
    if (!scene || !pos) return;
    _spawnParticle(pos, new THREE.Vector3(0, 0, 0), color || 0xff6600, 0.04, 0.15);
  }

  function spawnJumpDust(pos) {
    spawnDust(pos);
  }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        scene.remove(p.mesh);
        p.mesh.geometry?.dispose();
        p.mesh.material?.dispose();
        particles.splice(i, 1);
        continue;
      }
      const t = p.age / p.life;
      p.mesh.position.addScaledVector(p.velocity, dt);
      if (p.gravity) p.velocity.y -= 9 * dt;
      p.velocity.multiplyScalar(0.97);
      if (p.mesh.material) p.mesh.material.opacity = 1 - t;
      if (!p.mesh.material.transparent) p.mesh.material.transparent = true;
      if (p.scale) p.mesh.scale.setScalar(1 + t * 4);
    }
  }

  function clear() {
    particles.forEach(p => { scene?.remove(p.mesh); p.mesh.geometry?.dispose(); p.mesh.material?.dispose(); });
    particles.length = 0;
  }

  return { init, update, clear, spawnExplosion, spawnMuzzleFlash, spawnHit, spawnBlood, spawnDust, spawnTrail, spawnJumpDust };
})();

/* ══════════════════════════════════════
   ENEMY AI SYSTEM
   Patrol, chase, attack, flee
══════════════════════════════════════ */
window.CEnemyAI = (function () {
  'use strict';

  const agents = new Map(); // entityId → agent state

  function register(entity, opts) {
    opts = opts || {};
    const agent = {
      entity,
      state:       'patrol',      // patrol | chase | attack | flee | dead
      speed:       opts.speed       || 2.5,
      chaseSpeed:  opts.chaseSpeed  || 4.5,
      attackRange: opts.attackRange || 1.8,
      sightRange:  opts.sightRange  || 12,
      damage:      opts.damage      || 10,
      attackCool:  opts.attackCool  || 1.2,
      health:      opts.health      || 100,
      maxHealth:   opts.health      || 100,
      _attackTimer: 0,
      _patrolTimer: 0,
      _patrolTarget: null,
      _stuckTimer: 0,
      _lastPos: null
    };

    // Register health
    if (window.CHealth) {
      window.CHealth.register(entity.id, opts.health || 100);
      window.CHealth.setCallbacks(
        entity.id,
        (dmg) => {
          agent.state = 'chase';
          if (window.CVfx && entity.mesh) window.CVfx.spawnBlood(entity.mesh.position);
          window.AudioSystem?.synth('hit', { volume: 0.3 });
        },
        () => {
          agent.state = 'dead';
          if (entity.mesh) {
            entity.mesh.rotation.z = Math.PI / 2;
            if (window.CVfx) window.CVfx.spawnExplosion(entity.mesh.position);
          }
          window.AudioSystem?.synth('death', { volume: 0.4 });
          setTimeout(() => { if (entity.mesh) entity.mesh.visible = false; }, 1500);
        }
      );
    }

    agents.set(entity.id, agent);
    return agent;
  }

  function update(dt, entities) {
    if (!window.CPlayerRig || !window.CPlayerRig.group) return;
    const playerPos = window.CPlayerRig.group.position;

    agents.forEach((agent, id) => {
      const entity = agent.entity;
      if (!entity.mesh || agent.state === 'dead') return;

      const pos     = entity.mesh.position;
      const toPlayer = new THREE.Vector3().subVectors(playerPos, pos);
      const dist     = toPlayer.length();

      agent._attackTimer = Math.max(0, agent._attackTimer - dt);

      switch (agent.state) {
        case 'patrol':
          _patrol(agent, dt, pos, dist);
          if (dist < agent.sightRange) {
            agent.state = 'chase';
            window.AudioSystem?.synth('hit', { volume: 0.15, pitch: 1.8 });
          }
          break;

        case 'chase':
          _moveTo(agent, pos, playerPos, agent.chaseSpeed, dt);
          _faceTarget(entity, playerPos);
          if (dist <= agent.attackRange) agent.state = 'attack';
          if (dist > agent.sightRange * 1.5) agent.state = 'patrol';
          break;

        case 'attack':
          _faceTarget(entity, playerPos);
          if (dist > agent.attackRange * 1.3) { agent.state = 'chase'; break; }
          if (agent._attackTimer <= 0) {
            agent._attackTimer = agent.attackCool;
            if (window.CHealth) window.CHealth.damage('player', agent.damage);
            window.AudioSystem?.synth('hit', { volume: 0.4 });
            if (window.CVfx) window.CVfx.spawnHit(playerPos);
          }
          break;

        case 'flee':
          const fleeDir = new THREE.Vector3().subVectors(pos, playerPos).normalize();
          _moveTo(agent, pos, new THREE.Vector3().addVectors(pos, fleeDir.multiplyScalar(5)), agent.chaseSpeed, dt);
          if (dist > agent.sightRange * 2) agent.state = 'patrol';
          break;
      }

      // Update entity position data
      if (entity.mesh) entity.position = { x: pos.x, y: pos.y, z: pos.z };
    });
  }

  function _patrol(agent, dt, pos, distToPlayer) {
    agent._patrolTimer -= dt;
    if (!agent._patrolTarget || agent._patrolTimer <= 0) {
      agent._patrolTarget = new THREE.Vector3(
        pos.x + (Math.random() - 0.5) * 8,
        pos.y,
        pos.z + (Math.random() - 0.5) * 8
      );
      agent._patrolTimer = 2 + Math.random() * 3;
    }
    _moveTo(agent, pos, agent._patrolTarget, agent.speed * 0.6, 0.016);
  }

  function _moveTo(agent, pos, target, speed, dt) {
    const dir = new THREE.Vector3().subVectors(target, pos);
    dir.y = 0;
    const dist = dir.length();
    if (dist < 0.3) return;
    dir.normalize();
    pos.addScaledVector(dir, speed * dt);
    // Simple gravity
    if (agent.entity._phys) {
      pos.y = Math.max(0.5, pos.y);
    } else {
      pos.y = Math.max(0.5, pos.y);
    }
  }

  function _faceTarget(entity, target) {
    if (!entity.mesh) return;
    const dx = target.x - entity.mesh.position.x;
    const dz = target.z - entity.mesh.position.z;
    entity.mesh.rotation.y = Math.atan2(dx, dz);
  }

  function spawnEnemy(scene, pos, opts) {
    opts = opts || {};
    const color = opts.color || 0xcc3322;
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const eyeMat  = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.25), bodyMat);
    body.position.y = 0.9; body.castShadow = true; group.add(body);
    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), bodyMat);
    head.position.y = 1.45; head.castShadow = true; group.add(head);
    // Eyes
    const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
    lEye.position.set(-0.08, 1.48, 0.18); group.add(lEye);
    const rEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
    rEye.position.set(0.08, 1.48, 0.18); group.add(rEye);
    // Arms
    const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), bodyMat);
    lArm.position.set(-0.36, 0.88, 0); group.add(lArm);
    const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), bodyMat);
    rArm.position.set(0.36, 0.88, 0); group.add(rArm);
    // Legs
    const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), bodyMat);
    lLeg.position.set(-0.14, 0.3, 0); group.add(lLeg);
    const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), bodyMat);
    rLeg.position.set(0.14, 0.3, 0); group.add(rLeg);

    group.position.set(pos?.x || 0, pos?.y || 0.5, pos?.z || 0);
    scene.add(group);

    // Walk animation state
    group._walkCycle = 0;
    group._lArm = lArm; group._rArm = rArm;
    group._lLeg = lLeg; group._rLeg = rLeg;

    return group;
  }

  function animateAgents(dt) {
    agents.forEach((agent) => {
      const mesh = agent.entity.mesh;
      if (!mesh || agent.state === 'dead') return;
      const moving = agent.state === 'chase' || agent.state === 'patrol' || agent.state === 'flee';
      if (moving) {
        mesh._walkCycle = (mesh._walkCycle || 0) + dt * 7;
        if (mesh._lArm) mesh._lArm.rotation.x =  Math.sin(mesh._walkCycle) * 0.5;
        if (mesh._rArm) mesh._rArm.rotation.x = -Math.sin(mesh._walkCycle) * 0.5;
        if (mesh._lLeg) mesh._lLeg.rotation.x = -Math.sin(mesh._walkCycle) * 0.6;
        if (mesh._rLeg) mesh._rLeg.rotation.x =  Math.sin(mesh._walkCycle) * 0.6;
      }
    });
  }

  function clear() { agents.clear(); }

  return { register, update, spawnEnemy, animateAgents, clear };
})();

/* ══════════════════════════════════════
   ANIMATION TIMELINE
   Moon Animator style keyframe system
══════════════════════════════════════ */
window.CAnimator = (function () {
  'use strict';

  const clips    = new Map(); // name → { tracks: [{entityId, property, keyframes:[{frame,value}]}] }
  const playing  = new Map(); // name → { time, loop }
  let   fps      = 30;
  let   entities = [];

  function setEntities(ents) { entities = ents; }
  function setFPS(f) { fps = f; }

  function createClip(name) {
    clips.set(name, { tracks: [] }); return name;
  }

  function addKeyframe(clipName, entityId, property, frame, value) {
    const clip = clips.get(clipName);
    if (!clip) return;
    let track = clip.tracks.find(t => t.entityId === entityId && t.property === property);
    if (!track) { track = { entityId, property, keyframes: [] }; clip.tracks.push(track); }
    track.keyframes = track.keyframes.filter(k => k.frame !== frame);
    track.keyframes.push({ frame, value });
    track.keyframes.sort((a, b) => a.frame - b.frame);
  }

  function play(clipName, loop) {
    playing.set(clipName, { time: 0, loop: loop || false });
  }

  function stop(clipName) { playing.delete(clipName); }
  function stopAll() { playing.clear(); }

  function update(dt) {
    playing.forEach((state, clipName) => {
      const clip = clips.get(clipName);
      if (!clip) return;
      state.time += dt;
      const frame = state.time * fps;

      // Find max frame
      let maxFrame = 0;
      clip.tracks.forEach(t => { t.keyframes.forEach(k => { if (k.frame > maxFrame) maxFrame = k.frame; }); });

      if (frame > maxFrame) {
        if (state.loop) state.time = 0;
        else { playing.delete(clipName); return; }
      }

      // Apply interpolated values
      clip.tracks.forEach(track => {
        const entity = entities.find(e => e.id === track.entityId);
        if (!entity || !entity.mesh) return;

        const kfs = track.keyframes;
        if (!kfs.length) return;

        // Find surrounding keyframes
        let prev = kfs[0], next = kfs[kfs.length - 1];
        for (let i = 0; i < kfs.length - 1; i++) {
          if (kfs[i].frame <= frame && kfs[i+1].frame >= frame) {
            prev = kfs[i]; next = kfs[i+1]; break;
          }
        }

        // Lerp
        const t = prev.frame === next.frame ? 1 : (frame - prev.frame) / (next.frame - prev.frame);
        const val = prev.value + (next.value - prev.value) * Math.max(0, Math.min(1, t));

        // Apply to mesh property
        const parts = track.property.split('.');
        if (parts[0] === 'position')  entity.mesh.position[parts[1]]  = val;
        if (parts[0] === 'rotation')  entity.mesh.rotation[parts[1]]  = THREE.MathUtils.degToRad(val);
        if (parts[0] === 'scale')     entity.mesh.scale[parts[1]]     = val;
        if (parts[0] === 'material' && entity.mesh.material) entity.mesh.material[parts[1]] = val;
      });
    });
  }

  function getClips() { return Array.from(clips.keys()); }
  function getClip(name) { return clips.get(name) || null; }

  function saveClips() {
    const data = {};
    clips.forEach((clip, name) => { data[name] = clip; });
    localStorage.setItem('cengine_animations', JSON.stringify(data));
  }

  function loadClips() {
    try {
      const raw = localStorage.getItem('cengine_animations');
      if (!raw) return;
      const data = JSON.parse(raw);
      Object.entries(data).forEach(([name, clip]) => clips.set(name, clip));
    } catch(e) {}
  }

  return { setEntities, setFPS, createClip, addKeyframe, play, stop, stopAll, update, getClips, getClip, saveClips, loadClips };
})();

/* ══════════════════════════════════════
   PLAY MODE HUD
   Injected into scene canvas area
══════════════════════════════════════ */
window.CPlayHUD = (function () {
  'use strict';

  let el = null;

  function show() {
    remove();
    el = document.createElement('div');
    el.id = 'play-hud';
    el.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:100;font-family:Inter,sans-serif;';
    el.innerHTML = `
      <!-- Crosshair -->
      <div id="play-crosshair" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:18px;height:18px;pointer-events:none">
        <div style="position:absolute;top:50%;left:0;right:0;height:1px;background:rgba(255,255,255,0.7);transform:translateY(-50%)"></div>
        <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.7);transform:translateX(-50%)"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,0.5)"></div>
      </div>

      <!-- HP Bar -->
      <div style="position:absolute;bottom:70px;left:20px;display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.5);padding:6px 12px;border-radius:20px;border:1px solid rgba(255,255,255,0.1)">
        <span style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.5);letter-spacing:0.1em">HP</span>
        <div style="width:80px;height:5px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden">
          <div id="play-hp-bar" style="height:100%;width:100%;background:#27ae60;border-radius:3px;transition:width 0.2s,background 0.3s"></div>
        </div>
        <span id="play-hp-val" style="font-size:11px;font-weight:700;color:#fff;min-width:24px;text-align:right;font-family:monospace">100</span>
      </div>

      <!-- Ammo -->
      <div style="position:absolute;bottom:70px;right:20px;display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.5);padding:6px 12px;border-radius:20px;border:1px solid rgba(255,255,255,0.1)">
        <span style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.5);letter-spacing:0.1em">AMM</span>
        <span id="play-ammo-val" style="font-size:14px;font-weight:800;color:#fff;font-family:monospace">30</span>
      </div>

      <!-- Score -->
      <div style="position:absolute;top:12px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.45);padding:4px 14px;border-radius:14px;border:1px solid rgba(255,255,255,0.06)">
        <span id="play-score-val" style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.7);font-family:monospace">Score: 0</span>
      </div>

      <!-- Kill feed -->
      <div id="play-killfeed" style="position:absolute;top:50px;right:12px;display:flex;flex-direction:column;gap:4px;max-width:200px"></div>

      <!-- Death screen -->
      <div id="play-death-screen" class="hidden" style="position:absolute;inset:0;background:rgba(0,0,0,0.75);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;pointer-events:auto">
        <div style="font-size:36px;font-weight:900;color:#c0392b;font-family:monospace;letter-spacing:4px">YOU DIED</div>
        <div style="font-size:14px;color:#888;font-family:monospace">Press Stop to reset</div>
      </div>

      <!-- Shoot button (phone) -->
      <button id="play-shoot-btn" style="position:absolute;bottom:140px;right:20px;width:64px;height:64px;border-radius:50%;background:rgba(192,57,43,0.2);border:2px solid rgba(192,57,43,0.5);color:#c0392b;font-size:10px;font-weight:700;font-family:monospace;letter-spacing:0.05em;cursor:pointer;pointer-events:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px">
        <svg width="18" height="18" viewBox="0 0 18 18"><path d="M2 9h10M14 7l4 2-4 2V7z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><rect x="1" y="7" width="10" height="4" rx="1" stroke="currentColor" stroke-width="1" fill="none"/></svg>
        FIRE
      </button>`;

    const sceneWrap = document.getElementById('tab-scene');
    if (sceneWrap) sceneWrap.style.position = 'relative';
    sceneWrap?.appendChild(el);

    // Shoot button
    let ammo = 30;
    document.getElementById('play-shoot-btn')?.addEventListener('click', () => {
      if (ammo <= 0) { toast('Out of ammo!', 'warn'); return; }
      ammo--;
      const ammoEl = document.getElementById('play-ammo-val');
      if (ammoEl) ammoEl.textContent = ammo;
      _fireFromPlayer();
    });

    // Also fire on F key or mouse click in scene
    window._playShootHandler = (e) => {
      if (!window._playingNow) return;
      if (e.code === 'KeyF' || e.button === 0) {
        if (ammo <= 0) return;
        ammo--;
        const ammoEl = document.getElementById('play-ammo-val');
        if (ammoEl) ammoEl.textContent = ammo;
        _fireFromPlayer();
      }
    };
    window.addEventListener('keydown', window._playShootHandler);
  }

  function _fireFromPlayer() {
    if (!window.CProjectiles || !window.CPlayerRig?.group) return;
    const rig = window.CPlayerRig.group;
    const scene = window.CPlayerRig.scene;
    if (!scene) return;

    // Fire forward from player position
    const yaw = window.CPlayerRig.yaw || 0;
    const origin = {
      x: rig.position.x - Math.sin(yaw) * 0.3,
      y: rig.position.y + 1.4,
      z: rig.position.z - Math.cos(yaw) * 0.3
    };
    const direction = { x: -Math.sin(yaw), y: -0.05, z: -Math.cos(yaw) };

    window.CProjectiles.fire(scene, origin, direction, {
      type: 'hitscan',
      damage: 20,
      owner: 'player'
    });

    // Score on hit
    if (window._gameEntities) {
      const hitCheck = window.CCollision?.raycast(origin, direction, window._gameEntities, 50);
      if (hitCheck) {
        const score = document.getElementById('play-score-val');
        if (score) {
          const cur = parseInt(score.textContent.replace('Score: ', '')) || 0;
          score.textContent = 'Score: ' + (cur + 100);
        }
        _addKillFeed(hitCheck.entity.name);
      }
    }
  }

  function _addKillFeed(name) {
    const feed = document.getElementById('play-killfeed');
    if (!feed) return;
    const item = document.createElement('div');
    item.style.cssText = 'background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.1);padding:4px 8px;border-radius:4px;font-size:10px;color:#ff8844;font-family:monospace;animation:fadeIn 0.2s';
    item.textContent = '✕ ' + name;
    feed.appendChild(item);
    setTimeout(() => item.remove(), 3000);
  }

  function remove() {
    document.getElementById('play-hud')?.remove();
    el = null;
    if (window._playShootHandler) {
      window.removeEventListener('keydown', window._playShootHandler);
      window._playShootHandler = null;
    }
  }

  function setHP(val, max) {
    const pct = Math.max(0, Math.min(100, (val / (max || 100)) * 100));
    const bar = document.getElementById('play-hp-bar');
    const txt = document.getElementById('play-hp-val');
    if (bar) { bar.style.width = pct + '%'; bar.style.background = pct > 50 ? '#27ae60' : pct > 25 ? '#d4a017' : '#c0392b'; }
    if (txt) txt.textContent = Math.round(val);
  }

  return { show, remove, setHP };
})();
