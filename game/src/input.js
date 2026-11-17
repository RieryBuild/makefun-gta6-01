// Input: keyboard, mouse and pointer lock.
// One job: collect raw device state into one object the game polls —
// held keys, one-shot key presses, mouse deltas, mouse buttons — and own
// the pointer-lock dance (click to lock, Esc to release, P to pause).

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // one-shot presses, consumed by the game
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;   // left button held (fire)
    this.rightDown = false;   // right button held (aim)
    this.locked = false;
    this.enabled = false;     // only track keys while the game is playing

    window.addEventListener('keydown', (event) => {
      if (!this.enabled) return;
      if (event.code === 'Space') event.preventDefault();
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
      this.rightDown = false;
    });
    document.addEventListener('mousemove', (event) => {
      if (!this.enabled) return;
      if (this.locked || this.mouseDown) {
        this.mouseDX += event.movementX || 0;
        this.mouseDY += event.movementY || 0;
      }
    });
    document.addEventListener('mousedown', (event) => {
      if (!this.enabled) return;
      if (event.button === 0) this.mouseDown = true;
      if (event.button === 2) this.rightDown = true;
    });
    document.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
      if (event.button === 2) this.rightDown = false;
    });
    document.addEventListener('contextmenu', (event) => {
      if (this.enabled) event.preventDefault();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this.onUnlock?.();
    });
  }

  /** True once for each physical press; the game consumes the press. */
  consumePress(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  /** Mouse movement since the last frame, then zeroed. */
  takeMouseDelta() {
    const delta = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return delta;
  }

  /** Ask the browser for pointer lock (must come from a user gesture). */
  requestLock() {
    if (this.locked) return;
    try {
      const promise = this.canvas.requestPointerLock();
      if (promise && promise.catch) promise.catch(() => { /* lock refused; drag-look still works */ });
    } catch {
      // Headless or old browsers: the game still plays with drag-look.
    }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Forget every held key (used when pausing / respawning). */
  clear() {
    this.keys.clear();
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.rightDown = false;
  }
}
