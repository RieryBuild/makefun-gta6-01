// Combat: the player's rifle, muzzle flash, tracers and the gang that shoots back.
// One job: resolve shots — a ray from the muzzle against enemy bodies and
// walls — and run the mission enemies' simple shoot-and-strafe AI.

import {
  WEAPON_DAMAGE, WEAPON_FIRE_INTERVAL, WEAPON_MAG_SIZE, WEAPON_RANGE, WEAPON_RELOAD_TIME,
} from './config.js';
import { createCharacter, gangLook, layCharacterDown, updateWalkCycle, weaponMuzzleWorld } from './characters.js';
import { hasLineOfSight } from './city.js';

/** A soft radial glow, for the muzzle flash and impact sparks. */
function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  gradient.addColorStop(0, 'rgba(255,240,180,1)');
  gradient.addColorStop(0.35, 'rgba(255,180,60,0.9)');
  gradient.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

/** Ray vs sphere: distance along the ray to the hit, or Infinity. */
function raySphere(origin, dir, centre, radius) {
  const ox = centre.x - origin.x;
  const oy = centre.y - origin.y;
  const oz = centre.z - origin.z;
  const t = ox * dir.x + oy * dir.y + oz * dir.z;
  if (t < 0) return Infinity;
  const dSq = ox * ox + oy * oy + oz * oz - t * t;
  if (dSq > radius * radius) return Infinity;
  return t - Math.sqrt(radius * radius - dSq);
}

/** Ray vs a flat AABB (walls are tall, so 2D XZ + a height check is enough). */
function rayBox(origin, dir, box) {
  let tMin = 0;
  let tMax = WEAPON_RANGE;
  for (const [o, d, lo, hi] of [
    [origin.x, dir.x, box.minX, box.maxX],
    [origin.z, dir.z, box.minZ, box.maxZ],
  ]) {
    if (Math.abs(d) < 1e-8) {
      if (o < lo || o > hi) return Infinity;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return Infinity;
    }
  }
  return tMin;
}

export class CombatManager {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.ammo = WEAPON_MAG_SIZE;
    this.reloading = false;
    this.reloadTimer = 0;
    this.lastShotTime = -10;
    this.enemies = [];
    // Muzzle flash: one sprite + one light, reused for every shot.
    this.flashTexture = makeGlowTexture();
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.flashTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.flash.scale.set(1.5, 1.5, 1);
    this.flash.visible = false;
    scene.add(this.flash);
    this.flashLight = new THREE.PointLight(0xffc860, 0, 12);
    scene.add(this.flashLight);
    this.flashTimer = 0;
    // Tracer pool: thin glowing cylinders stretched between two points.
    this.tracers = [];
    const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 8; i += 1) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 5), tracerMat.clone());
      mesh.visible = false;
      scene.add(mesh);
      this.tracers.push({ mesh, timer: 0 });
    }
    // Impact spark pool.
    this.sparks = [];
    for (let i = 0; i < 6; i += 1) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.flashTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      sprite.scale.set(0.5, 0.5, 1);
      sprite.visible = false;
      scene.add(sprite);
      this.sparks.push({ sprite, timer: 0 });
    }
  }

  /** Can the player fire right now (loaded, not reloading, cooled down)? */
  canFire(time) {
    return !this.reloading && this.ammo > 0 && time - this.lastShotTime >= WEAPON_FIRE_INTERVAL;
  }

  startReload() {
    if (this.reloading || this.ammo === WEAPON_MAG_SIZE) return false;
    this.reloading = true;
    this.reloadTimer = WEAPON_RELOAD_TIME;
    return true;
  }

  /** Show a tracer from `from` to `to` for a blink. */
  showTracer(from, to) {
    const tracer = this.tracers.find((t) => t.timer <= 0) || this.tracers[0];
    const length = from.distanceTo(to);
    tracer.mesh.position.copy(from).add(to).multiplyScalar(0.5);
    tracer.mesh.scale.set(1, length, 1);
    tracer.mesh.lookAt(to);
    tracer.mesh.rotateX(Math.PI / 2);
    tracer.mesh.material.opacity = 0.9;
    tracer.mesh.visible = true;
    tracer.timer = 0.09;
  }

  /** A spark burst where a bullet struck something solid. */
  showSpark(point) {
    const spark = this.sparks.find((s) => s.timer <= 0) || this.sparks[0];
    spark.sprite.position.copy(point);
    spark.sprite.material.opacity = 1;
    spark.sprite.visible = true;
    spark.timer = 0.18;
  }

  /** Flash at the muzzle + a light pop. */
  showMuzzleFlash(muzzlePos) {
    this.flash.position.copy(muzzlePos);
    this.flash.material.opacity = 1;
    this.flash.material.rotation = this.rng.range(0, Math.PI * 2);
    this.flash.visible = true;
    this.flashLight.position.copy(muzzlePos);
    this.flashLight.intensity = 2.2;
    this.flashTimer = 0.06;
  }

  /**
   * Fire the player's rifle along `dir` from `origin`. Hits the nearest of
   * (enemies, police officers, pedestrians, walls) and reports it through
   * the context callbacks. `flashAt` is where the muzzle flash and the
   * tracer start (the rifle's muzzle); the hit ray itself follows the
   * camera aim, so the shot lands where the crosshair points.
   * Returns 'enemy' | 'officer' | 'ped' | 'wall' | 'miss' | 'dry'.
   */
  playerShoot(origin, dir, time, context, flashAt) {
    if (!this.canFire(time)) return 'dry';
    this.lastShotTime = time;
    this.ammo -= 1;
    const flashOrigin = flashAt || origin;
    this.showMuzzleFlash(flashOrigin);
    let bestT = WEAPON_RANGE;
    let bestKind = 'miss';
    let bestTarget = null;
    // Walls first: nothing behind a wall can be hit.
    for (const box of this.colliders) {
      const t = rayBox(origin, dir, box);
      if (t < bestT) { bestT = t; bestKind = 'wall'; bestTarget = null; }
    }
    // Enemies (body sphere at chest height).
    for (const enemy of this.enemies) {
      if (enemy.state !== 'alive') continue;
      const t = raySphere(origin, dir, { x: enemy.x, y: 1.2, z: enemy.z }, 0.75);
      if (t < bestT) { bestT = t; bestKind = 'enemy'; bestTarget = enemy; }
    }
    // Police officers on foot.
    for (const officer of context.officers || []) {
      const t = raySphere(origin, dir, { x: officer.x, y: 1.2, z: officer.z }, 0.7);
      if (t < bestT) { bestT = t; bestKind = 'officer'; bestTarget = officer; }
    }
    // Pedestrians (shooting one is a crime — the world decides the stars).
    for (const ped of context.peds || []) {
      if (ped.state === 'down') continue;
      const px = ped.parts.group.position.x;
      const pz = ped.parts.group.position.z;
      const t = raySphere(origin, dir, { x: px, y: 1.2, z: pz }, 0.7);
      if (t < bestT) { bestT = t; bestKind = 'ped'; bestTarget = ped; }
    }
    const hitPoint = new THREE.Vector3(
      origin.x + dir.x * bestT, origin.y + dir.y * bestT, origin.z + dir.z * bestT,
    );
    this.showTracer(flashOrigin, hitPoint);
    if (bestKind === 'enemy') {
      this.damageEnemy(bestTarget, WEAPON_DAMAGE, context);
      context.onHitMarker?.();
    } else if (bestKind === 'officer') {
      context.onOfficerShot?.(bestTarget);
      context.onHitMarker?.();
    } else if (bestKind === 'ped') {
      context.onPedShot?.(bestTarget);
      context.onHitMarker?.();
    } else if (bestKind === 'wall') {
      this.showSpark(hitPoint);
    }
    return bestKind;
  }

  /** Damage an enemy; at 0 HP it goes down and the mission hears about it. */
  damageEnemy(enemy, damage, context) {
    enemy.hp -= damage;
    this.showSpark(new THREE.Vector3(enemy.x, 1.3, enemy.z));
    if (enemy.hp <= 0 && enemy.state === 'alive') {
      enemy.state = 'dead';
      layCharacterDown(enemy.parts);
      context.onEnemyKilled?.(enemy);
    }
  }

  /** Spawn a gang member at (x, z); a boss has triple HP and a bigger frame. */
  spawnEnemy(x, z, isBoss = false) {
    const parts = createCharacter(this.rng, 'gang', gangLook(this.rng));
    parts.group.position.set(x, 0, z);
    if (isBoss) parts.group.scale.set(1.15, 1.15, 1.15);
    this.scene.add(parts.group);
    const enemy = {
      parts, x, z, hp: isBoss ? 300 : 100, isBoss,
      state: 'alive', shootTimer: this.rng.range(0.5, 1.5),
      strafePhase: this.rng.range(0, Math.PI * 2), homeX: x, homeZ: z,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  clearEnemies() {
    for (const enemy of this.enemies) this.scene.remove(enemy.parts.group);
    this.enemies = [];
  }

  aliveEnemies() {
    return this.enemies.filter((e) => e.state === 'alive');
  }

  /** Enemy AI: face the player, strafe around their post, shoot with inaccuracy. */
  updateEnemies(dt, context) {
    for (const enemy of this.enemies) {
      if (enemy.state !== 'alive') continue;
      const dx = context.playerX - enemy.x;
      const dz = context.playerZ - enemy.z;
      const dist = Math.hypot(dx, dz);
      enemy.parts.group.rotation.y = Math.atan2(dx, dz);
      if (dist < 60) {
        enemy.strafePhase += dt * 1.4;
        const strafe = Math.sin(enemy.strafePhase) * 0.7;
        enemy.x = enemy.homeX + Math.cos(enemy.strafePhase) * strafe * 0.4;
        enemy.z = enemy.homeZ + Math.sin(enemy.strafePhase) * strafe * 0.4;
        enemy.parts.group.position.set(enemy.x, 0, enemy.z);
        updateWalkCycle(enemy.parts, dt, 1.2, true);
        enemy.shootTimer -= dt;
        if (enemy.shootTimer <= 0 && dist < 55
          && hasLineOfSight(enemy.x, enemy.z, context.playerX, context.playerZ, this.colliders)) {
          enemy.shootTimer = this.rng.range(0.9, 1.7);
          const muzzle = enemy.parts.weapon
            ? weaponMuzzleWorld(enemy.parts)
            : new THREE.Vector3(enemy.x, 1.4, enemy.z);
          this.showMuzzleFlash(muzzle);
          // Inaccurate: most shots whistle past, some connect.
          const hits = this.rng.chance(enemy.isBoss ? 0.45 : 0.3);
          const aimPoint = new THREE.Vector3(
            context.playerX + (hits ? 0 : this.rng.range(-2, 2)),
            1.2,
            context.playerZ + (hits ? 0 : this.rng.range(-2, 2)),
          );
          this.showTracer(muzzle, aimPoint);
          if (hits) context.onPlayerShot?.(this.rng.range(5, 11), enemy.x, enemy.z);
        }
      } else {
        updateWalkCycle(enemy.parts, dt, 0, false);
      }
    }
  }

  /** Fade flashes, tracers and sparks; finish reloads. */
  update(dt) {
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammo = WEAPON_MAG_SIZE;
      }
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.flashLight.intensity = Math.max(0, this.flashTimer / 0.06) * 2.2;
      if (this.flashTimer <= 0) this.flash.visible = false;
    }
    for (const tracer of this.tracers) {
      if (tracer.timer > 0) {
        tracer.timer -= dt;
        tracer.mesh.material.opacity = Math.max(0, tracer.timer / 0.09) * 0.9;
        if (tracer.timer <= 0) tracer.mesh.visible = false;
      }
    }
    for (const spark of this.sparks) {
      if (spark.timer > 0) {
        spark.timer -= dt;
        spark.sprite.material.opacity = Math.max(0, spark.timer / 0.18);
        if (spark.timer <= 0) spark.sprite.visible = false;
      }
    }
  }
}
