// The world: everything wired together.
// One job: own the game state machine (menu / playing / paused / wasted /
// busted), build every subsystem from the seed, run the frame update, and
// translate between systems — crimes become wanted stars, damage becomes
// WASTED, mission events become banners and cash.

import {
  BUSTED_FINE, CITY_EDGE, GARAGE_FORECOURT, HEALTH_REGEN_DELAY, HEALTH_REGEN_RATE,
  HOSPITAL_EXIT, PLAYER_MAX_HEALTH, PLAYER_START, PLAYER_START_CASH,
  STATION_EXIT, STORY_GOAL, WASTED_FINE,
} from './config.js';
import { makeRandom } from './random.js';
import { buildCity } from './city.js';
import { Player } from './player.js';
import { TrafficManager } from './traffic.js';
import { PedestrianManager } from './pedestrians.js';
import { PoliceManager } from './police.js';
import { CombatManager } from './combat.js';
import { MissionManager } from './missions.js';
import { CollectiblesManager } from './collectibles.js';
import { Hud } from './hud.js';
import { Minimap } from './minimap.js';
import { AudioEngine } from './audio.js';
import { InputManager } from './input.js';
import { clearSave, loadGame, saveGame } from './save.js';
import { createVehicle } from './vehicles.js';

export class World {
  constructor(canvas, seed) {
    this.canvas = canvas;
    this.seed = seed;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 40, 120);

    this.state = 'menu'; // menu | playing | paused | wasted | busted
    this.time = 0;
    this.shake = 0;
    this.health = PLAYER_MAX_HEALTH;
    this.cash = PLAYER_START_CASH;
    this.lastDamageTime = -100;
    this.endTimer = 0;
    this.saveTimer = 0;
    this.menuOrbit = 0;
    this.smokePuffs = [];

    this.hud = new Hud();
    this.minimap = new Minimap(document.getElementById('minimap'));
    this.audio = new AudioEngine();
    this.input = new InputManager(canvas);
    this.input.onUnlock = () => {
      if (this.state === 'playing') this.pauseGame();
    };

    this.build(seed);
    this.refreshHud();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /** Build (or rebuild) every subsystem from the seed. */
  build(seed) {
    // Clear the previous city, if any (New Game / shot staging rebuilds).
    while (this.scene.children.length > 0) this.scene.remove(this.scene.children[0]);
    const rng = makeRandom(seed);
    this.rng = rng;
    const city = buildCity(this.scene, rng.fork(101));
    this.city = city;
    this.colliders = city.colliders;
    this.player = new Player(this.scene, rng.fork(102), this.colliders);
    this.player.spawnAt(PLAYER_START.x, PLAYER_START.z, Math.PI);
    this.traffic = new TrafficManager(this.scene, rng.fork(103));
    this.traffic.spawnAll();
    this.spawnPlayerVan();
    this.peds = new PedestrianManager(this.scene, rng.fork(104), this.colliders);
    this.peds.spawnAll();
    this.police = new PoliceManager(this.scene, rng.fork(105), this.colliders);
    this.combat = new CombatManager(this.scene, rng.fork(106), this.colliders);
    this.missions = new MissionManager(this.scene, rng.fork(107));
    this.collectibles = new CollectiblesManager(this.scene);
    this.smokePuffs = [];
  }

  /** Dana's own courier van, parked by the garage — free to drive, no heat. */
  spawnPlayerVan() {
    const vehicle = createVehicle(this.rng.fork(108), 'van');
    vehicle.group.position.set(-14, 0, -43);
    vehicle.group.rotation.y = Math.PI / 2;
    this.scene.add(vehicle.group);
    this.traffic.parked.push({ vehicle, x: -14, z: -43, heading: Math.PI / 2, taken: false, own: true });
  }

  // ---- Game flow ----

  startNewGame() {
    clearSave();
    this.build(this.seed);
    this.health = PLAYER_MAX_HEALTH;
    this.cash = PLAYER_START_CASH;
    this.state = 'playing';
    this.input.enabled = true;
    this.input.clear();
    this.hud.hideStart();
    this.hud.hideEndScreens();
    this.hud.setHintVisible(true);
    this.hud.showDialogue('Rosa', 'Dana! The garage needs you — come inside and I will brief you on the first job.');
    this.audio.init();
    this.audio.blip();
    this.input.requestLock();
    this.refreshHud();
  }

  continueGame() {
    const data = loadGame();
    this.build(this.seed);
    if (data) {
      this.cash = data.cash ?? PLAYER_START_CASH;
      this.health = data.health ?? PLAYER_MAX_HEALTH;
      this.missions.completedCount = data.missionsCompleted ?? 0;
      this.missions.storyComplete = data.storyComplete ?? false;
      this.collectibles.restore(data.collectibles);
      this.player.spawnAt(data.x ?? PLAYER_START.x, data.z ?? PLAYER_START.z, Math.PI);
    }
    this.state = 'playing';
    this.input.enabled = true;
    this.input.clear();
    this.hud.hideStart();
    this.hud.hideEndScreens();
    this.hud.setHintVisible(true);
    this.audio.init();
    this.audio.blip();
    this.input.requestLock();
    this.refreshHud();
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.clear();
    this.input.releaseLock();
    this.hud.showPause(true);
    this.autosave();
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.hud.showPause(false);
    this.input.requestLock();
  }

  quitToMenu() {
    this.autosave();
    this.state = 'menu';
    this.input.enabled = false;
    this.input.clear();
    this.input.releaseLock();
    this.hud.showPause(false);
    this.hud.showStart(true);
    this.hud.setHintVisible(false);
  }

  autosave() {
    saveGame({
      cash: this.cash,
      health: this.health,
      missionsCompleted: this.missions.completedCount,
      storyComplete: this.missions.storyComplete,
      collectibles: this.collectibles.collectedIds(),
      x: this.player.x,
      z: this.player.z,
    });
  }

  refreshHud() {
    this.hud.setCash(this.cash, STORY_GOAL);
    this.hud.setPostcards(this.collectibles.collectedCount, this.collectibles.cards.length);
    this.hud.setHealth(this.health);
    this.hud.setWanted(this.police.wanted);
    this.hud.setAmmo(this.combat.ammo, this.combat.reloading);
    this.hud.setMissionName(this.missions.active ? this.missions.active.def.title : 'SOLMAR BAY');
    this.hud.setObjective(this.missions.objectiveText());
  }

  // ---- Crimes, damage and the end screens ----

  /** A crime raises the heat and makes nearby peds run. */
  onCrime(kind, stars) {
    this.police.addWanted(stars, this.time);
    this.hud.setWanted(this.police.wanted);
    if (kind === 'shoot') this.peds.scarePeds(this.player.x, this.player.z, 45);
    if (kind === 'hitPed' || kind === 'shoot') this.peds.scarePeds(this.player.x, this.player.z, 60);
  }

  /** Dana takes damage: flash, shake, and WASTED at zero health. */
  damagePlayer(amount) {
    if (this.state !== 'playing') return;
    this.health = Math.max(0, this.health - amount);
    this.lastDamageTime = this.time;
    this.shake = Math.min(1, this.shake + 0.35);
    this.hud.damageFlash();
    this.hud.setHealth(this.health);
    if (this.health <= 0) this.wasted();
  }

  wasted() {
    this.state = 'wasted';
    this.endTimer = 3.5;
    this.input.clear();
    this.input.releaseLock();
    this.hud.showWasted();
    this.hud.setArrestProgress(0);
    this.audio.failSting();
    this.audio.setSiren(false);
    this.missions.failActive('WASTED', this.missionContext());
  }

  busted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.endTimer = 3.5;
    this.input.clear();
    this.input.releaseLock();
    this.hud.showBusted();
    this.hud.setArrestProgress(0);
    this.audio.failSting();
    this.audio.setSiren(false);
    this.missions.failActive('BUSTED', this.missionContext());
  }

  /** Respawn after WASTED (hospital) or BUSTED (police station). */
  respawn() {
    const wasWasted = this.state === 'wasted';
    const fine = wasWasted ? WASTED_FINE : BUSTED_FINE;
    const spot = wasWasted ? HOSPITAL_EXIT : STATION_EXIT;
    this.cash = Math.max(0, this.cash - fine);
    this.health = PLAYER_MAX_HEALTH;
    this.police.clearWanted();
    this.combat.clearEnemies();
    this.player.spawnAt(spot.x, spot.z, Math.PI);
    this.state = 'playing';
    this.hud.hideEndScreens();
    this.hud.showToast(wasWasted ? `Patched up at Solmar General — $${fine} bill` : `Released from SBPD — $${fine} fine`, 4);
    this.input.requestLock();
    this.refreshHud();
    this.autosave();
  }

  // ---- Contexts handed to the subsystems ----

  missionContext() {
    return {
      combat: this.combat, traffic: this.traffic, police: this.police, time: this.time,
      playerX: this.player.x, playerZ: this.player.z,
      playerCar: this.player.inCar ? this.player.car : null,
      onBanner: (title, text, seconds) => this.hud.showBanner(title, text, seconds),
      onDialogue: (speaker, text) => this.hud.showDialogue(speaker, text),
      onCash: (amount) => {
        this.cash += amount;
        this.hud.setCash(this.cash, STORY_GOAL);
        this.audio.missionComplete();
        this.autosave();
      },
      onMissionComplete: () => this.refreshHud(),
    };
  }

  policeContext() {
    return {
      playerX: this.player.x, playerZ: this.player.z,
      playerSpeed: this.player.currentSpeed, playerInCar: this.player.inCar, time: this.time,
      onRam: (cruiser) => {
        this.player.takeRam(cruiser.x, cruiser.z);
        this.shake = Math.min(1, this.shake + 0.25);
        this.audio.crash(0.3);
      },
      onBusted: () => this.busted(),
      onArrestProgress: (p) => this.hud.setArrestProgress(p),
      onPlayerShot: (damage) => this.damagePlayer(damage),
      onEnemyShotFired: (fx, fz, tx, tz) => {
        this.combat.showTracer(new THREE.Vector3(fx, 1.4, fz), new THREE.Vector3(tx, 1.2, tz));
      },
      onWantedChanged: (wanted) => {
        this.hud.setWanted(wanted);
        if (wanted === 0) this.hud.showToast('You lost the cops.', 3);
      },
    };
  }

  combatContext() {
    return {
      officers: this.police.officers,
      peds: this.peds.peds,
      onHitMarker: () => this.hud.flashHitmarker(),
      onEnemyKilled: () => this.missions.onEnemyKilled(),
      onOfficerShot: (officer) => {
        this.onCrime('shootCop', 2);
        const index = this.police.officers.indexOf(officer);
        if (index !== -1) {
          this.police.officers.splice(index, 1);
          this.scene.remove(officer.parts.group);
        }
      },
      onPedShot: (ped) => {
        this.peds.knockPedDown(ped);
        this.onCrime('shoot', 2);
      },
      onPlayerShot: (damage) => this.damagePlayer(damage),
    };
  }

  // ---- Shooting ----

  /** Fire the rifle along the camera's aim; the tracer starts at the muzzle. */
  tryShoot() {
    if (this.player.inCar) return;
    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const muzzle = this.player.muzzleWorldPosition();
    const result = this.combat.playerShoot(origin, dir, this.time, this.combatContext(), muzzle);
    if (result !== 'dry') {
      this.audio.gunshot();
      this.shake = Math.min(1, this.shake + 0.06);
      // Gunfire draws heat only when the law is close enough to hear it.
      const policeNear = this.police.nearestUnitDistance(this.player.x, this.player.z) < 60;
      this.onCrime('shoot', policeNear ? 1 : 0);
      this.hud.setAmmo(this.combat.ammo, this.combat.reloading);
    } else if (this.combat.ammo === 0 && !this.combat.reloading) {
      if (this.combat.startReload()) this.audio.reload();
    }
  }

  // ---- Tyre smoke ----

  spawnSmoke(x, z) {
    if (this.smokePuffs.length > 24) return;
    if (!this.smokeTexture) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      gradient.addColorStop(0, 'rgba(220,220,220,0.7)');
      gradient.addColorStop(1, 'rgba(220,220,220,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      this.smokeTexture = new THREE.CanvasTexture(canvas);
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.smokeTexture, transparent: true, depthWrite: false,
    }));
    sprite.position.set(x, 0.5, z);
    sprite.scale.set(1.4, 1.4, 1);
    this.scene.add(sprite);
    this.smokePuffs.push({ sprite, timer: 0.9 });
  }

  updateSmoke(dt) {
    for (let i = this.smokePuffs.length - 1; i >= 0; i -= 1) {
      const puff = this.smokePuffs[i];
      puff.timer -= dt;
      puff.sprite.position.y += dt * 1.2;
      puff.sprite.material.opacity = Math.max(0, puff.timer / 0.9) * 0.7;
      puff.sprite.scale.multiplyScalar(1 + dt * 1.5);
      if (puff.timer <= 0) {
        this.scene.remove(puff.sprite);
        this.smokePuffs.splice(i, 1);
      }
    }
  }

  // ---- The frame update ----

  /** The one-shot E key: start a mission, get in a car, or get out. */
  handleInteract() {
    if (this.player.inCar) {
      this.player.exitCar({ onExitCar: () => this.audio.blip(520, 0.06, 0.1) });
      return;
    }
    const nearGarage = Math.hypot(this.player.x - GARAGE_FORECOURT.x, this.player.z - GARAGE_FORECOURT.z) < 9;
    const next = this.missions.nextMission();
    if (nearGarage && next && !this.missions.active) {
      this.missions.startNext(this.missionContext());
      this.refreshHud();
      return;
    }
    const car = this.traffic.nearestParkedCar(this.player.x, this.player.z, 4.5);
    if (car) {
      this.player.enterCar(car, {
        onCrime: (kind, stars) => {
          this.onCrime(kind, stars);
          this.hud.showToast('Car stolen — keep an eye out for SBPD.', 3);
        },
        onEnterCar: () => this.audio.blip(520, 0.06, 0.1),
      });
      this.refreshHud();
    }
  }

  /** The context prompt under the crosshair, recomputed every frame. */
  updatePrompt() {
    if (this.player.inCar) {
      this.hud.showPrompt('E — Get out of the car');
      return;
    }
    const nearGarage = Math.hypot(this.player.x - GARAGE_FORECOURT.x, this.player.z - GARAGE_FORECOURT.z) < 9;
    const next = this.missions.nextMission();
    if (nearGarage && next && !this.missions.active) {
      this.hud.showPrompt(`E — Start mission: ${next.title}`);
      return;
    }
    if (nearGarage && !this.missions.active && !next) {
      this.hud.showPrompt('Story complete — free roam. Enjoy Solmar Bay.');
      return;
    }
    const car = this.traffic.nearestParkedCar(this.player.x, this.player.z, 4.5);
    if (car) {
      this.hud.showPrompt(car.own ? 'E — Get in your van' : 'E — Steal the car');
      return;
    }
    this.hud.hidePrompt();
  }

  /** Advance the whole simulation by `dt` seconds. */
  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    // The living background runs in every state (menu included).
    this.city.waterTexture.offset.x += dt * 0.008;
    this.city.waterTexture.offset.y += dt * 0.005;
    for (const cloud of this.city.clouds) {
      cloud.position.x += dt * 0.9;
      if (cloud.position.x > 340) cloud.position.x = -340;
    }
    const ambient = {
      playerX: this.player.x, playerZ: this.player.z,
      playerCar: this.player.inCar ? { x: this.player.car.x, z: this.player.car.z } : null,
    };
    this.traffic.update(dt, ambient);
    this.peds.update(dt, ambient);
    this.combat.update(dt);
    this.updateSmoke(dt);
    this.hud.update(dt);

    if (this.state === 'menu') {
      this.menuOrbit += dt * 0.03;
      const radius = 130;
      this.camera.position.set(
        Math.cos(this.menuOrbit) * radius, 62, Math.sin(this.menuOrbit) * radius,
      );
      this.camera.lookAt(0, 0, 0);
      return;
    }
    if (this.state === 'wasted' || this.state === 'busted') {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.respawn();
      return;
    }
    if (this.state !== 'playing') return;

    // --- Input: look, fire, reload, interact, pause, mute ---
    const mouse = this.input.takeMouseDelta();
    if (mouse.dx !== 0 || mouse.dy !== 0) this.player.applyMouseLook(mouse.dx, mouse.dy);
    this.player.aiming = this.input.rightDown;
    this.player.firing = this.input.mouseDown && !this.player.inCar;
    if (this.player.firing) this.tryShoot();
    if (this.input.consumePress('KeyR') && !this.player.inCar) {
      if (this.combat.startReload()) this.audio.reload();
    }
    if (this.input.consumePress('KeyE')) this.handleInteract();
    if (this.input.consumePress('KeyP')) this.pauseGame();
    if (this.input.consumePress('KeyM')) {
      const muted = this.audio.toggleMute();
      this.hud.showToast(muted ? 'Sound muted (M to unmute)' : 'Sound on', 2);
    }

    // --- Player + systems ---
    const carCircles = this.traffic.carCircles();
    const playerContext = {
      carCircles,
      peds: this.peds,
      onCrime: (kind, stars) => this.onCrime(kind, stars),
      onCrash: (speed) => {
        this.audio.crash(Math.min(1, speed / 30));
        this.shake = Math.min(1, this.shake + 0.2);
      },
      onTireSmoke: (x, z) => this.spawnSmoke(x, z),
      onEnterCar: () => {},
      onExitCar: () => {},
    };
    if (this.player.inCar) this.player.updateDriving(dt, this.input, playerContext);
    else this.player.updateOnFoot(dt, this.input, playerContext);
    this.player.updateCamera(this.camera, dt, this.shake);
    this.police.update(dt, this.policeContext());
    this.combat.updateEnemies(dt, { playerX: this.player.x, playerZ: this.player.z, onPlayerShot: (d) => this.damagePlayer(d) });
    this.missions.update(dt, this.missionContext());
    this.collectibles.update(dt, {
      playerX: this.player.x,
      playerZ: this.player.z,
      onPickup: (card, reward, found, total) => {
        this.cash += reward;
        this.hud.setCash(this.cash, STORY_GOAL);
        this.hud.setPostcards(found, total);
        this.hud.showToast(`Sunset Postcard ${found}/${total} — ${card.spot.name} (+$${reward})`, 4);
        this.audio.blip(880, 0.12, 0.12);
        this.autosave();
      },
    });

    // --- Health regen after a quiet spell ---
    if (this.health > 0 && this.health < PLAYER_MAX_HEALTH && this.time - this.lastDamageTime > HEALTH_REGEN_DELAY) {
      this.health = Math.min(PLAYER_MAX_HEALTH, this.health + HEALTH_REGEN_RATE * dt);
      this.hud.setHealth(this.health);
    }

    // --- Audio beds ---
    const speedNorm = this.player.inCar ? Math.abs(this.player.carSpeed) / 34 : 0;
    this.audio.setEngine(speedNorm, this.player.inCar);
    this.audio.setSiren(this.police.wanted > 0 && this.police.cruisers.length > 0);

    // --- HUD + minimap, every frame ---
    this.hud.setSpeed(this.player.inCar ? Math.abs(this.player.carSpeed) * 3.6 : 0, this.player.inCar);
    this.hud.setAmmo(this.combat.ammo, this.combat.reloading);
    this.hud.setObjective(this.missions.objectiveText());
    this.hud.setMissionName(this.missions.active ? this.missions.active.def.title : 'SOLMAR BAY');
    this.hud.setCrosshairVisible(!this.player.inCar);
    this.updatePrompt();
    this.minimap.draw({
      playerX: this.player.x, playerZ: this.player.z,
      heading: this.player.inCar ? this.player.car.heading : this.player.heading,
      waypoint: this.missions.waypoint(),
      police: this.police.getBlips(),
      enemies: this.combat.aliveEnemies(),
      collectibles: this.collectibles.remaining(),
      time: this.time,
    });

    // --- Autosave every 30 seconds of play ---
    this.saveTimer += dt;
    if (this.saveTimer > 30) {
      this.saveTimer = 0;
      this.autosave();
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
