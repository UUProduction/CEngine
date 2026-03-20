/* ═══════════════════════════════════════════
   CENGINE — INPUT SYSTEM
   Keyboard, mouse, gamepad
   ═══════════════════════════════════════════ */

window.CInput = (function () {
  'use strict';

  const keys     = {};
  const prevKeys = {};
  const mouse    = { x: 0, y: 0, dx: 0, dy: 0, buttons: {}, prevButtons: {} };
  let   gamepad  = null;
  let   locked   = false;

  function init() {
    window.addEventListener('keydown', e => {
      if (keys[e.code]) return; // prevent repeat
      keys[e.code] = true;
      keys[e.key.toLowerCase()] = true;
    });

    window.addEventListener('keyup', e => {
      keys[e.code] = false;
      keys[e.key.toLowerCase()] = false;
    });

    window.addEventListener('mousemove', e => {
      mouse.dx = e.movementX || 0;
      mouse.dy = e.movementY || 0;
      if (!locked) { mouse.x = e.clientX; mouse.y = e.clientY; }
    });

    window.addEventListener('mousedown', e => { mouse.buttons[e.button] = true; });
    window.addEventListener('mouseup',   e => { mouse.buttons[e.button] = false; });

    window.addEventListener('gamepadconnected',    e => { gamepad = e.gamepad; });
    window.addEventListener('gamepaddisconnected', e => { gamepad = null; });

    // Pointer lock for FPS style
    document.addEventListener('pointerlockchange', () => {
      locked = document.pointerLockElement !== null;
    });
  }

  /* ── Tick — call once per frame ── */
  function tick() {
    // Copy current to prev
    Object.keys(keys).forEach(k => { prevKeys[k] = keys[k]; });
    Object.keys(mouse.buttons).forEach(k => { mouse.prevButtons[k] = mouse.buttons[k]; });
    mouse.dx = 0; mouse.dy = 0;

    // Sync gamepad
    if (gamepad) {
      const gp = navigator.getGamepads()[gamepad.index];
      if (gp) {
        // Map common buttons
        if (gp.buttons[0].pressed) keys['gamepad_a'] = true;
        else keys['gamepad_a'] = false;
        if (gp.buttons[1].pressed) keys['gamepad_b'] = true;
        else keys['gamepad_b'] = false;
      }
    }
  }

  /* ── Held — is key currently down ── */
  function held(key) {
    return !!(keys[key] || keys['Key' + key.toUpperCase()] || keys[key.toLowerCase()]);
  }

  /* ── Pressed — just pressed this frame ── */
  function pressed(key) {
    return !!(keys[key] && !prevKeys[key]) ||
           !!(keys['Key' + key.toUpperCase()] && !prevKeys['Key' + key.toUpperCase()]);
  }

  /* ── Released — just released this frame ── */
  function released(key) {
    return !!(!keys[key] && prevKeys[key]);
  }

  /* ── Axis — returns -1 to 1 ── */
  function axis(name) {
    switch (name) {
      case 'horizontal':
        return (held('d') || held('ArrowRight') ? 1 : 0) - (held('a') || held('ArrowLeft') ? 1 : 0);
      case 'vertical':
        return (held('w') || held('ArrowUp') ? 1 : 0) - (held('s') || held('ArrowDown') ? 1 : 0);
      default:
        return 0;
    }
  }

  /* ── Mouse ── */
  function mouseButton(btn) { return !!mouse.buttons[btn]; }
  function mouseX() { return mouse.x; }
  function mouseY() { return mouse.y; }
  function mouseDX() { return mouse.dx; }
  function mouseDY() { return mouse.dy; }

  /* ── Lock pointer (FPS) ── */
  function lockPointer(el) {
    if (el && el.requestPointerLock) el.requestPointerLock();
  }

  function unlockPointer() {
    if (document.exitPointerLock) document.exitPointerLock();
  }

  /* ── Clear ── */
  function clear() {
    Object.keys(keys).forEach(k => { keys[k] = false; });
    Object.keys(mouse.buttons).forEach(k => { mouse.buttons[k] = false; });
  }

  return { init, tick, held, pressed, released, axis, mouseButton, mouseX, mouseY, mouseDX, mouseDY, lockPointer, unlockPointer, clear };
})();
