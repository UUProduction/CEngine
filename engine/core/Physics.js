/* ═══════════════════════════════════════════
   CENGINE — PHYSICS ENGINE
   Rapier.js wrapper with fallback gravity
   ═══════════════════════════════════════════ */

window.CPhysics = (function () {
  'use strict';

  let rapier = null;
  let world  = null;
  const bodies = new Map(); // entityId → { rb, collider, mesh, type }

  /* ── Init ── */
  async function init() {
    try {
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
      rapier = window.RAPIER;
      world  = new rapier.World({ x: 0, y: -9.81, z: 0 });
      console.log('[CPhysics] Rapier ready');
      return true;
    } catch (e) {
      console.warn('[CPhysics] Rapier failed, using fallback:', e.message);
      return false;
    }
  }

  /* ── Add body ── */
  function addBody(entity, type) {
    type = type || 'dynamic';
    if (!rapier || !world || !entity.mesh) return null;

    const p = entity.mesh.position;

    let rbDesc;
    if      (type === 'dynamic')   rbDesc = rapier.RigidBodyDesc.dynamic();
    else if (type === 'kinematic') rbDesc = rapier.RigidBodyDesc.kinematicPositionBased();
    else                           rbDesc = rapier.RigidBodyDesc.fixed();

    rbDesc.setTranslation(p.x, p.y, p.z);
    const rb = world.createRigidBody(rbDesc);

    // Auto collider from geometry type
    const geoType = entity.mesh.geometry && entity.mesh.geometry.type;
    let collDesc;
    if (geoType === 'SphereGeometry') {
      collDesc = rapier.ColliderDesc.ball(entity.scale ? entity.scale.x * 0.5 : 0.5);
    } else if (geoType === 'CylinderGeometry') {
      collDesc = rapier.ColliderDesc.cylinder(
        entity.scale ? entity.scale.y * 0.5 : 0.5,
        entity.scale ? entity.scale.x * 0.5 : 0.5
      );
    } else {
      // Default box
      collDesc = rapier.ColliderDesc.cuboid(
        entity.scale ? entity.scale.x * 0.5 : 0.5,
        entity.scale ? entity.scale.y * 0.5 : 0.5,
        entity.scale ? entity.scale.z * 0.5 : 0.5
      );
    }

    collDesc.setRestitution(0.3);
    collDesc.setFriction(0.7);
    const col = world.createCollider(collDesc, rb);

    bodies.set(entity.id, { rb, col, mesh: entity.mesh, type, entity });
    return rb;
  }

  /* ── Remove body ── */
  function removeBody(entityId) {
    const b = bodies.get(entityId);
    if (!b) return;
    if (world) {
      world.removeCollider(b.col, false);
      world.removeRigidBody(b.rb);
    }
    bodies.delete(entityId);
  }

  /* ── Step ── */
  function step(dt) {
    if (!rapier || !world) return;
    world.timestep = Math.min(dt, 0.05);
    world.step();
  }

  /* ── Sync meshes from physics ── */
  function sync() {
    bodies.forEach((b) => {
      if (!b.mesh || b.type === 'fixed') return;
      const t = b.rb.translation();
      const r = b.rb.rotation();
      b.mesh.position.set(t.x, t.y, t.z);
      b.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      if (b.entity) {
        b.entity.position = { x: t.x, y: t.y, z: t.z };
      }
    });
  }

  /* ── Fallback gravity (no Rapier) ── */
  function stepFallback(entities, dt) {
    entities.forEach(entity => {
      if (!entity.mesh || !entity._phys) return;
      if (entity._phys.type !== 'dynamic') return;
      entity._phys.vy = (entity._phys.vy || 0) + (-9.81) * dt;
      entity.mesh.position.y += entity._phys.vy * dt;
      entity.position.y = entity.mesh.position.y;
      if (entity.mesh.position.y < entity._phys.floor) {
        entity.mesh.position.y = entity._phys.floor;
        entity.position.y      = entity._phys.floor;
        entity._phys.vy        = 0;
        entity._phys.grounded  = true;
      } else {
        entity._phys.grounded = false;
      }
    });
  }

  /* ── Get body ── */
  function getBody(entityId) {
    return bodies.get(entityId) || null;
  }

  /* ── Clear all ── */
  function clear() {
    bodies.forEach((b, id) => removeBody(id));
    bodies.clear();
  }

  /* ── Is ready ── */
  function isReady() {
    return rapier !== null && world !== null;
  }

  return { init, addBody, removeBody, step, sync, stepFallback, getBody, clear, isReady };
})();
