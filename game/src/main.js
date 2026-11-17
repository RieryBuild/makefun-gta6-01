// Bootstrap: build the world, wire the menus, run the loop.
// One job: start everything — the start screen's buttons, the pause menu,
// the fixed game loop, and the ?shot= staging mode that freezes one frame
// of real play for the screenshots.

import { DEFAULT_SEED, GAME_SUBTITLE, GAME_TITLE, STORY_INTRO } from './config.js';
import { seedFromUrl } from './random.js';
import { World } from './world.js';
import { stageShot } from './shots.js';
import { hasSave } from './save.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(window.location.search);
const seed = seedFromUrl(DEFAULT_SEED);
const shotName = params.get('shot');

// The 3D engine must be present: without it there is no game to play.
if (!window.THREE) {
  document.getElementById('fatal').textContent =
    'Three.js did not load — the game cannot start. Check game/vendor/three.min.js.';
  document.getElementById('fatal').classList.add('show');
  throw new Error('THREE is not defined');
}

const world = new World(canvas, seed);
window.__solmarWorld = world; // the play-test harness reads the world through this

// ---- Start screen copy (from the story in config.js) ----
document.getElementById('game-title').textContent = GAME_TITLE;
document.getElementById('game-subtitle').textContent = GAME_SUBTITLE;
document.getElementById('story-intro').textContent = STORY_INTRO;

// ---- Menu buttons ----
document.getElementById('btn-new').addEventListener('click', () => world.startNewGame());
document.getElementById('btn-continue').addEventListener('click', () => world.continueGame());
document.getElementById('btn-resume').addEventListener('click', () => world.resumeGame());
document.getElementById('btn-restart').addEventListener('click', () => {
  world.hud.showPause(false);
  world.startNewGame();
});
document.getElementById('btn-quit').addEventListener('click', () => world.quitToMenu());
document.getElementById('btn-mute').addEventListener('click', () => {
  const muted = world.audio.toggleMute();
  document.getElementById('btn-mute').textContent = muted ? 'Sound: OFF' : 'Sound: ON';
});
// Clicking the canvas while playing (re)locks the pointer.
canvas.addEventListener('click', () => {
  if (world.state === 'playing' && !world.input.locked) world.input.requestLock();
});

// ---- Screenshot mode: stage one frame of real play, then freeze it ----
let frozen = false;
if (shotName) {
  const staged = stageShot(shotName, world, seed);
  frozen = true;
  window.__shotReady = true;
  window.__shotName = staged;
} else {
  world.hud.showStart(hasSave());
}

// ---- The game loop: fixed-step simulation, capped delta ----
const clock = new THREE.Clock();
let accumulator = 0;
const FIXED_STEP = 1 / 60;
const MAX_FRAME = 0.1;

function frame() {
  if (frozen) {
    world.render();
    return;
  }
  const dt = Math.min(clock.getDelta(), MAX_FRAME);
  accumulator += dt;
  let steps = 0;
  while (accumulator >= FIXED_STEP && steps < 5) {
    world.update(FIXED_STEP);
    accumulator -= FIXED_STEP;
    steps += 1;
  }
  if (steps === 5) accumulator = 0; // drop backlog rather than spiral
  world.render();
}

world.renderer.setAnimationLoop(frame);
