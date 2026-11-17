// The law: wanted stars and the SBPD response.
// One job: turn crimes into heat — stars rise on car theft, hitting people
// and shooting, police cruisers chase and ram, officers on foot run the
// player down and arrest them, and the heat fades when the player stays
// out of sight long enough.

import {
  ARREST_HOLD_TIME, POLICE_SPAWN_DISTANCE, ROAD_LINES, WANTED_DECAY_DELAY, WANTED_MAX,
} from './config.js';
import { copLook, createCharacter, updateWalkCycle } from './characters.js';
import { createVehicle, flashLightBar, updateVehicleWheels } from './vehicles.js';
import { hasLineOfSight, resolveCircleCollisions } from './city.js';

const OFFICER_RUN_SPEED = 6.4;
const OFFICER_SHOOT_RANGE = 42;
const CRUISER_MAX_SPEED = 30;

export class PoliceManager {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.wanted = 0;
    this.cruisers = [];  // { vehicle, x, z, heading, speed, sirenPhase }
    this.officers = [];  // { parts, x, z, arrestTimer, shootTimer }
    this.unseenTimer = 0;
    this.lastCrimeTime = -100;
  }

  /** Raise the heat (clamped at 5 stars) and note the time of the crime. */
  addWanted(stars, time) {
    this.wanted = Math.min(WANTED_MAX, this.wanted + stars);
    this.lastCrimeTime = time;
    this.unseenTimer = 0;
  }

  /** All units stand down (hideout reached, mission cleared). */
  clearWanted() {
    this.wanted = 0;
    this.unseenTimer = 0;
    for (const cruiser of this.cruisers) this.scene.remove(cruiser.vehicle.group);
    for (const officer of this.officers) this.scene.remove(officer.parts.group);
    this.cruisers = [];
    this.officers = [];
  }

  /** How many cruisers and officers the current heat calls for. */
  desiredUnits() {
    if (this.wanted === 0) return { cruisers: 0, officers: 0 };
    return {
      cruisers: Math.min(4, this.wanted),
      officers: this.wanted >= 4 ? 4 : this.wanted >= 2 ? 2 : 1,
    };
  }

  spawnCruiser(playerX, playerZ) {
    const road = this.rng.pick(ROAD_LINES);
    const along = this.rng.range(-120, 120);
    const axis = this.rng.chance(0.5) ? 'x' : 'z';
    let x = axis === 'x' ? along : road;
    let z = axis === 'x' ? road : along;
    // Push the spawn out to a ring around the player.
    const dx = x - playerX;
    const dz = z - playerZ;
    const dist = Math.max(1, Math.hypot(dx, dz));
    x = playerX + (dx / dist) * POLICE_SPAWN_DISTANCE;
    z = playerZ + (dz / dist) * POLICE_SPAWN_DISTANCE;
    const vehicle = createVehicle(this.rng, 'police');
    vehicle.group.position.set(x, 0, z);
    this.scene.add(vehicle.group);
    const cruiser = {
      vehicle, x, z, heading: Math.atan2(playerX - x, playerZ - z),
      speed: 6, steer: 0, ramCooldown: 0,
    };
    vehicle.group.rotation.y = cruiser.heading;
    this.cruisers.push(cruiser);
    return cruiser;
  }

  spawnOfficer(playerX, playerZ) {
    const angle = this.rng.range(0, Math.PI * 2);
    const dist = this.rng.range(24, 40);
    const x = playerX + Math.cos(angle) * dist;
    const z = playerZ + Math.sin(angle) * dist;
    const parts = createCharacter(this.rng, 'cop', copLook(this.rng));
    parts.group.position.set(x, 0, z);
    this.scene.add(parts.group);
    const officer = { parts, x, z, arrestTimer: 0, shootTimer: this.rng.range(0.5, 1.5) };
    this.officers.push(officer);
    return officer;
  }

  /** Nearest police unit distance to the player (for the unseen timer). */
  nearestUnitDistance(playerX, playerZ) {
    let best = Infinity;
    for (const c of this.cruisers) best = Math.min(best, Math.hypot(c.x - playerX, c.z - playerZ));
    for (const o of this.officers) best = Math.min(best, Math.hypot(o.x - playerX, o.z - playerZ));
    return best;
  }

  /** Blips for the minimap. */
  getBlips() {
    const blips = [];
    for (const c of this.cruisers) blips.push({ x: c.x, z: c.z, kind: 'cruiser' });
    for (const o of this.officers) blips.push({ x: o.x, z: o.z, kind: 'officer' });
    return blips;
  }

  update(dt, context) {
    const { playerX, playerZ, playerSpeed, playerInCar, time } = context;
    // Match the force to the heat.
    const desired = this.desiredUnits();
    while (this.cruisers.length < desired.cruisers) this.spawnCruiser(playerX, playerZ);
    while (this.officers.length < desired.officers) this.spawnOfficer(playerX, playerZ);
    while (this.cruisers.length > desired.cruisers) {
      const removed = this.cruisers.pop();
      this.scene.remove(removed.vehicle.group);
    }
    while (this.officers.length > desired.officers) {
      const removed = this.officers.pop();
      this.scene.remove(removed.parts.group);
    }
    if (this.wanted === 0) return;

    // Heat fades when no unit can see the player for a while.
    const nearest = this.nearestUnitDistance(playerX, playerZ);
    if (nearest > 60 && time - this.lastCrimeTime > 6) {
      this.unseenTimer += dt;
      if (this.unseenTimer >= WANTED_DECAY_DELAY) {
        this.wanted = Math.max(0, this.wanted - 1);
        this.unseenTimer = 0;
        context.onWantedChanged?.(this.wanted);
      }
    } else {
      this.unseenTimer = 0;
    }

    // Cruisers: steer at the player, ram speed when close.
    for (const cruiser of this.cruisers) {
      const dx = playerX - cruiser.x;
      const dz = playerZ - cruiser.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(dx, dz);
      let delta = targetHeading - cruiser.heading;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      const turn = Math.max(-1, Math.min(1, delta * 2.2));
      cruiser.heading += turn * 2.4 * dt;
      cruiser.steer = turn;
      const targetSpeed = dist < 8 ? 12 : CRUISER_MAX_SPEED;
      cruiser.speed += (targetSpeed - cruiser.speed) * Math.min(1, dt * 1.2);
      cruiser.x += Math.sin(cruiser.heading) * cruiser.speed * dt;
      cruiser.z += Math.cos(cruiser.heading) * cruiser.speed * dt;
      const pos = { x: cruiser.x, z: cruiser.z };
      resolveCircleCollisions(pos, 2.2, this.colliders);
      cruiser.x = pos.x;
      cruiser.z = pos.z;
      cruiser.vehicle.group.position.set(cruiser.x, 0, cruiser.z);
      cruiser.vehicle.group.rotation.y = cruiser.heading;
      updateVehicleWheels(cruiser.vehicle, cruiser.speed, turn, dt);
      flashLightBar(cruiser.vehicle, time);
      // Ramming the player's car shoves it — at most once a second per cruiser,
      // so a cruiser riding the bumper cannot drain all speed every frame.
      cruiser.ramCooldown = Math.max(0, cruiser.ramCooldown - dt);
      if (playerInCar && dist < 4.6 && cruiser.ramCooldown <= 0) {
        cruiser.ramCooldown = 0.9;
        context.onRam?.(cruiser, dx, dz, dist);
      }
    }

    // Officers: run the player down on foot; hold close to arrest.
    for (const officer of this.officers) {
      const dx = playerX - officer.x;
      const dz = playerZ - officer.z;
      const dist = Math.hypot(dx, dz);
      if (!playerInCar && dist > 1.4) {
        const speed = OFFICER_RUN_SPEED;
        officer.x += (dx / dist) * speed * dt;
        officer.z += (dz / dist) * speed * dt;
        const pos = { x: officer.x, z: officer.z };
        resolveCircleCollisions(pos, 0.5, this.colliders);
        officer.x = pos.x;
        officer.z = pos.z;
        officer.parts.group.position.set(officer.x, 0, officer.z);
        officer.parts.group.rotation.y = Math.atan2(dx, dz);
        updateWalkCycle(officer.parts, dt, speed, false);
      } else {
        updateWalkCycle(officer.parts, dt, 0, false);
      }
      if (!playerInCar && dist < 2.2) {
        if (playerSpeed < 3) {
          officer.arrestTimer += dt;
          context.onArrestProgress?.(officer.arrestTimer / ARREST_HOLD_TIME);
          if (officer.arrestTimer >= ARREST_HOLD_TIME) context.onBusted?.();
        } else {
          officer.arrestTimer = 0;
        }
      } else {
        officer.arrestTimer = 0;
      }
      // At 3+ stars officers open fire from range (only with a clear line of fire).
      if (this.wanted >= 3 && !playerInCar && dist < OFFICER_SHOOT_RANGE && dist > 4
        && hasLineOfSight(officer.x, officer.z, playerX, playerZ, this.colliders)) {
        officer.shootTimer -= dt;
        if (officer.shootTimer <= 0) {
          officer.shootTimer = this.rng.range(0.7, 1.4);
          context.onPlayerShot?.(this.rng.range(4, 9), officer.x, officer.z);
          context.onEnemyShotFired?.(officer.x, officer.z, playerX, playerZ);
        }
      }
    }
  }
}
