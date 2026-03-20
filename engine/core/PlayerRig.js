/* ═══════════════════════════════════════════
   CENGINE — PLAYER RIG
   Default humanoid body spawned on Play
   ═══════════════════════════════════════════ */

window.CPlayerRig = (function () {
  'use strict';

  let rigGroup   = null;
  let rigEntity  = null;
  let camera     = null;
  let scene      = null;
  let isActive   = false;

  // Movement state
  const state = {
    vy: 0,
    grounded: false,
    speed: 5,
    jumpForce: 6,
    mouseSensitivity: 0.002,
    yaw: 0,
    pitch: 0
  };

  /* ══════════════════════════════════════
     BUILD RIG MESH
  ══════════════════════════════════════ */
  function buildRig() {
    const group = new THREE.Group();

    const mat = new THREE.MeshStandardMaterial({ color: 0x4488ff, roughness: 0.6, metalness: 0.1 });
    const matHead = new THREE.MeshStandardMaterial({ color: 0xffcc99, roughness: 0.8 });
    const matLimb = new THREE.MeshStandardMaterial({ color: 0x3366cc, roughness: 0.6, metalness: 0.1 });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.25), mat);
    torso.position.y = 0.9;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), matHead);
    head.position.y = 1.45;
    head.castShadow = true;
    group.add(head);

    // Left arm
    const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), matLimb);
    lArm.position.set(-0.36, 0.88, 0);
    lArm.castShadow = true;
    group.add(lArm);

    // Right arm
    const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), matLimb);
    rArm.position.set(0.36, 0.88, 0);
    rArm.castShadow = true;
    group.add(rArm);

    // Left leg
    const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), matLimb);
    lLeg.position.set(-0.14, 0.3, 0);
    lLeg.castShadow = true;
    group.add(lLeg);

    // Right leg
    const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), matLimb);
    rLeg.position.set(0.14, 0.3, 0);
    rLeg.castShadow = true;
    group.add(rLeg);

    return group;
  }

  /* ══════════════════════════════════════
     SPAWN
  ══════════════════════════════════════ */
  function spawn(threeScene, threeCamera, spawnPos) {
    scene  = threeScene;
    camera = threeCamera;

    // Remove existing
    if (rigGroup) { scene.remove(rigGroup); rigGroup = null; }

    rigGroup = buildRig();
    rigGroup.position.set(
      spawnPos ? spawnPos.x : 0,
      spawnPos ? spawnPos.y : 2,
      spawnPos ? spawnPos.z : 3
    );
    scene.add(rigGroup);

    // Physics body for rig
    rigEntity = {
      id: 'player_rig',
      name: 'Player',
      type: 'rig',
      active: true,
      mesh: rigGroup,
      position: { x: rigGroup.position.x, y: rigGroup.position.y, z: rigGroup.position.z },
      _phys: { type: 'dynamic', vy: 0, grounded: false, floor: 0.01 }
    };

    if (window.CPhysics && window.CPhysics.isReady()) {
      window.CPhysics.addBody(rigEntity, 'dynamic');
    }

    // Mouse look
    state.yaw   = 0;
    state.pitch = 0;
    isActive    = true;

    // Request pointer lock on canvas click
    const canvas = document.getElementById('scene-canvas');
    if (canvas) {
      canvas.addEventListener('click', _requestLock, { once: true });
    }

    document.addEventListener('mousemove', _onMouseMove);

    console.log('[PlayerRig] Spawned at', rigGroup.position);
  }

  /* ══════════════════════════════════════
     UPDATE — call every frame in play mode
  ══════════════════════════════════════ */
  function update(dt) {
    if (!isActive || !rigGroup || !window.CInput) return;

    const Input = window.CInput;

    // ── Movement ──
    const moveX = Input.axis('horizontal');
    const moveZ = -Input.axis('vertical');

    if (moveX !== 0 || moveZ !== 0) {
      const fwd   = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
      const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
      const vel   = new THREE.Vector3();
      vel.addScaledVector(right, moveX * state.speed * dt);
      vel.addScaledVector(fwd,   moveZ * state.speed * dt);

      const physBody = window.CPhysics && window.CPhysics.getBody('player_rig');
      if (physBody && physBody.rb) {
        const cur = physBody.rb.linvel();
        physBody.rb.setLinvel({ x: vel.x * 10, y: cur.y, z: vel.z * 10 }, true);
      } else {
        // Fallback movement
        rigGroup.position.x += vel.x;
        rigGroup.position.z += vel.z;
        rigEntity.position.x = rigGroup.position.x;
        rigEntity.position.z = rigGroup.position.z;

        // Simple gravity fallback
        if (!state.grounded) {
          state.vy += -9.81 * dt;
          rigGroup.position.y += state.vy * dt;
          rigEntity.position.y = rigGroup.position.y;
          if (rigGroup.position.y <= 1.0) {
            rigGroup.position.y = 1.0;
            rigEntity.position.y = 1.0;
            state.vy = 0;
            state.grounded = true;
          }
        }
      }

      // Footstep sound
      if (!update._stepTimer) update._stepTimer = 0;
      update._stepTimer += dt;
      if (update._stepTimer > 0.4) {
        update._stepTimer = 0;
        if (window.CSound) window.CSound.Synth.play('footstep', { volume: 0.2 });
      }
    } else {
      if (!update._stepTimer) update._stepTimer = 0;
      update._stepTimer = 0;
    }

    // ── Jump ──
    if (Input.pressed('Space') || Input.pressed(' ')) {
      const physBody = window.CPhysics && window.CPhysics.getBody('player_rig');
      if (physBody && physBody.rb) {
        const vel = physBody.rb.linvel();
        if (Math.abs(vel.y) < 0.5) {
          physBody.rb.setLinvel({ x: vel.x, y: state.jumpForce, z: vel.z }, true);
          if (window.CSound) window.CSound.Synth.play('jump', { volume: 0.3 });
        }
      } else if (state.grounded) {
        state.vy = state.jumpForce;
        state.grounded = false;
        if (window.CSound) window.CSound.Synth.play('jump', { volume: 0.3 });
      }
    }

    // ── Sync position from physics ──
    const physBody = window.CPhysics && window.CPhysics.getBody('player_rig');
    if (physBody && physBody.rb) {
      const t = physBody.rb.translation();
      rigGroup.position.set(t.x, t.y, t.z);
      rigEntity.position = { x: t.x, y: t.y, z: t.z };
    }

    // ── Rotate rig to face movement direction ──
    rigGroup.rotation.y = state.yaw;

    // ── Camera follow ──
    if (camera) {
      const camOffset = new THREE.Vector3(0, 1.6, 0);
      camera.position.copy(rigGroup.position).add(camOffset);
      camera.rotation.order = 'YXZ';
      camera.rotation.y     = state.yaw;
      camera.rotation.x     = state.pitch;
    }

    // ── Animate arms/legs ──
    _animateRig(dt, moveX !== 0 || moveZ !== 0);
  }

  /* ── Rig walk animation ── */
  let walkCycle = 0;
  function _animateRig(dt, moving) {
    if (!rigGroup) return;
    if (moving) {
      walkCycle += dt * 8;
      // Arms swing opposite to legs
      const lArm = rigGroup.children[2];
      const rArm = rigGroup.children[3];
      const lLeg = rigGroup.children[4];
      const rLeg = rigGroup.children[5];
      if (lArm) lArm.rotation.x =  Math.sin(walkCycle) * 0.4;
      if (rArm) rArm.rotation.x = -Math.sin(walkCycle) * 0.4;
      if (lLeg) lLeg.rotation.x = -Math.sin(walkCycle) * 0.5;
      if (rLeg) rLeg.rotation.x =  Math.sin(walkCycle) * 0.5;
    } else {
      // Return to rest
      walkCycle = 0;
      [2,3,4,5].forEach(i => {
        if (rigGroup.children[i]) {
          rigGroup.children[i].rotation.x *= 0.8;
        }
      });
    }
  }

  /* ── Mouse look ── */
  function _onMouseMove(e) {
    if (!isActive) return;
    if (!document.pointerLockElement) return;
    state.yaw   -= e.movementX * state.mouseSensitivity;
    state.pitch -= e.movementY * state.mouseSensitivity;
    state.pitch  = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, state.pitch));
  }

  function _requestLock() {
    const canvas = document.getElementById('scene-canvas');
    if (canvas && canvas.requestPointerLock) canvas.requestPointerLock();
  }

  /* ══════════════════════════════════════
     DESPAWN
  ══════════════════════════════════════ */
  function despawn() {
    isActive = false;
    if (rigGroup && scene) { scene.remove(rigGroup); rigGroup = null; }
    if (window.CPhysics) window.CPhysics.removeBody('player_rig');
    document.removeEventListener('mousemove', _onMouseMove);
    if (document.exitPointerLock) document.exitPointerLock();
    rigEntity = null;
  }

  /* ══════════════════════════════════════
     PUBLIC
  ══════════════════════════════════════ */
  return { spawn, update, despawn, state };
})();
