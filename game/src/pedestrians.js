// Pedestrians: people walking the sidewalks who flee from trouble.
// One job: keep the pavements alive — each ped strolls a sidewalk line,
// turns at corners, and runs when gunfire or a speeding car comes close.
// A ped a car hits goes down and stays down (and the law notices).

import { CITY_EDGE, PEDESTRIAN_COUNT, PED_FLEE_SPEED, PED_WALK_SPEED, ROAD_LINES } from './config.js';
import { createCharacter, layCharacterDown, updateWalkCycle } from './characters.js';
import { resolveCircleCollisions } from './city.js';

const SIDEWALK = 8.6; // peds walk this far from their road's centreline

export class PedestrianManager {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.peds = [];
  }

  spawnAll() {
    for (let i = 0; i < PEDESTRIAN_COUNT; i += 1) this.spawnPed(true);
  }

  /** One ped on a random sidewalk, optionally anywhere in the city. */
  spawnPed(anywhere, nearX = 0, nearZ = 0) {
    const axis = this.rng.chance(0.5) ? 'x' : 'z';
    const road = this.rng.pick(ROAD_LINES);
    const side = this.rng.chance(0.5) ? 1 : -1;
    const dir = this.rng.chance(0.5) ? 1 : -1;
    let along = this.rng.range(-CITY_EDGE + 8, CITY_EDGE - 8);
    if (!anywhere) {
      const target = axis === 'x' ? nearX : nearZ;
      along = target + this.rng.pick([-1, 1]) * this.rng.range(30, 90);
      along = Math.max(-CITY_EDGE + 8, Math.min(CITY_EDGE - 8, along));
    }
    const parts = createCharacter(this.rng, 'ped');
    const pos = axis === 'x'
      ? { x: along, z: road + SIDEWALK * side }
      : { x: road + SIDEWALK * side, z: along };
    parts.group.position.set(pos.x, 0, pos.z);
    parts.group.rotation.y = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    this.scene.add(parts.group);
    const ped = {
      parts, axis, road, side, dir, along,
      speed: PED_WALK_SPEED * this.rng.range(0.8, 1.25),
      state: 'walk', fleeTimer: 0, downTimer: 0, turnCooldown: 1,
      fleeX: 0, fleeZ: 0,
    };
    this.peds.push(ped);
    return ped;
  }

  /** Gunfire or a near-miss: every ped within `radius` of the point runs. */
  scarePeds(x, z, radius) {
    for (const ped of this.peds) {
      if (ped.state !== 'walk') continue;
      const px = ped.parts.group.position.x;
      const pz = ped.parts.group.position.z;
      const dx = px - x;
      const dz = pz - z;
      const dist = Math.hypot(dx, dz);
      if (dist < radius) {
        ped.state = 'flee';
        ped.fleeTimer = this.rng.range(2.5, 4.5);
        const len = Math.max(0.01, dist);
        ped.fleeX = dx / len;
        ped.fleeZ = dz / len;
      }
    }
  }

  /** Knock a ped down (hit by a car or shot). Returns true when newly down. */
  knockPedDown(ped) {
    if (ped.state === 'down') return false;
    ped.state = 'down';
    ped.downTimer = 7;
    layCharacterDown(ped.parts);
    return true;
  }

  /** The nearest walking ped within `maxDist` of (x, z), or null. */
  nearestPed(x, z, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const ped of this.peds) {
      if (ped.state !== 'walk' && ped.state !== 'flee') continue;
      const px = ped.parts.group.position.x;
      const pz = ped.parts.group.position.z;
      const d = Math.hypot(px - x, pz - z);
      if (d < bestDist) { bestDist = d; best = ped; }
    }
    return best;
  }

  update(dt, context) {
    for (let i = this.peds.length - 1; i >= 0; i -= 1) {
      const ped = this.peds[i];
      const pos = ped.parts.group.position;
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          this.scene.remove(ped.parts.group);
          this.peds.splice(i, 1);
          this.spawnPed(false, context.playerX, context.playerZ);
        }
        continue;
      }
      if (Math.hypot(pos.x - context.playerX, pos.z - context.playerZ) > 180) {
        this.scene.remove(ped.parts.group);
        this.peds.splice(i, 1);
        this.spawnPed(false, context.playerX, context.playerZ);
        continue;
      }
      let speed = 0;
      if (ped.state === 'flee') {
        ped.fleeTimer -= dt;
        speed = PED_FLEE_SPEED;
        pos.x += ped.fleeX * speed * dt;
        pos.z += ped.fleeZ * speed * dt;
        ped.parts.group.rotation.y = Math.atan2(ped.fleeX, ped.fleeZ);
        if (ped.fleeTimer <= 0) {
          // Settle back onto the nearest sidewalk line and stroll again.
          ped.state = 'walk';
          const nearestRoad = ROAD_LINES.reduce((best, line) =>
            Math.abs(line - pos.z) < Math.abs(best - pos.z) ? line : best, ROAD_LINES[0]);
          ped.axis = 'x';
          ped.road = nearestRoad;
          ped.side = pos.z >= nearestRoad ? 1 : -1;
          ped.along = pos.x;
          ped.dir = this.rng.chance(0.5) ? 1 : -1;
          ped.turnCooldown = 1;
        }
      } else {
        speed = ped.speed;
        ped.along += ped.dir * speed * dt;
        ped.turnCooldown = Math.max(0, ped.turnCooldown - dt);
        const nearestLine = ROAD_LINES.reduce((best, line) =>
          Math.abs(line - ped.along) < Math.abs(best - ped.along) ? line : best, ROAD_LINES[0]);
        if (ped.turnCooldown <= 0 && Math.abs(nearestLine - ped.along) < speed * dt + 0.3 && this.rng.chance(0.2)) {
          const newRoad = nearestLine;
          ped.along = ped.road + SIDEWALK * ped.side;
          ped.road = newRoad;
          ped.axis = ped.axis === 'x' ? 'z' : 'x';
          ped.dir = this.rng.chance(0.5) ? 1 : -1;
          ped.side = this.rng.chance(0.5) ? 1 : -1;
          ped.turnCooldown = 2;
        }
        if (ped.along > CITY_EDGE - 8) { ped.along = CITY_EDGE - 8; ped.dir = -1; }
        if (ped.along < -CITY_EDGE + 8) { ped.along = -CITY_EDGE + 8; ped.dir = 1; }
        if (ped.axis === 'x') {
          pos.x = ped.along;
          pos.z = ped.road + SIDEWALK * ped.side;
          ped.parts.group.rotation.y = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          pos.x = ped.road + SIDEWALK * ped.side;
          pos.z = ped.along;
          ped.parts.group.rotation.y = ped.dir > 0 ? 0 : Math.PI;
        }
      }
      const posObj = { x: pos.x, z: pos.z };
      resolveCircleCollisions(posObj, 0.5, this.colliders);
      pos.x = posObj.x;
      pos.z = posObj.z;
      updateWalkCycle(ped.parts, dt, speed, false);
    }
  }
}
