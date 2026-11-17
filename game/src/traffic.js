// Traffic: cars that drive the city's road grid, plus parked cars to steal.
// One job: keep the streets alive — cars follow the roads on the right-hand
// side, turn at intersections, slow for the car ahead, and respawn near the
// player so the city never feels empty.

import { CITY_EDGE, ROAD_LINES, TRAFFIC_COUNT, TRAFFIC_SPEED } from './config.js';
import { createVehicle, updateVehicleWheels } from './vehicles.js';

const LANE = 3.5; // half a lane: cars sit this far right of their road's centreline

/** Shortest-arc angle lerp, so cars swing through turns instead of snapping. */
function lerpAngle(current, target, t) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * t;
}

/** Heading (rotation.y) for a car travelling along `axis` in direction `dir`. */
function headingFor(axis, dir) {
  if (axis === 'x') return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  return dir > 0 ? 0 : Math.PI;
}

/** The fixed lateral coordinate of a car on its road (right-hand traffic). */
function lanePosition(car) {
  if (car.axis === 'x') return { x: car.along, z: car.road + LANE * car.dir };
  return { x: car.road - LANE * car.dir, z: car.along };
}

export class TrafficManager {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.cars = [];
    this.parked = [];
  }

  /** Spawn the moving fleet and the parked cars, all from the seed. */
  spawnAll() {
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) this.spawnTrafficCar(true);
    // Parked cars: a row in the parking lot + a few at kerbs around town.
    const spots = [
      { x: 112, z: -32, h: 0 }, { x: 116, z: -32, h: 0 }, { x: 120, z: -32, h: 0 },
      { x: 112, z: -16, h: Math.PI }, { x: 120, z: -16, h: Math.PI },
      { x: -40, z: 52, h: Math.PI / 2 }, { x: 52, z: -40, h: 0 },
      { x: 100, z: 100, h: -Math.PI / 2 }, { x: -100, z: -100, h: Math.PI },
      { x: 8, z: 148, h: Math.PI / 2 },
    ];
    const types = ['sedan', 'sedan', 'taxi', 'sports', 'sedan', 'van', 'sedan', 'sports', 'sedan', 'sports'];
    spots.forEach((spot, i) => this.addParkedCar(spot.x, spot.z, spot.h, types[i]));
  }

  /** Park a fresh car of `type` at (x, z); returns the parked record. */
  addParkedCar(x, z, heading, type) {
    const vehicle = createVehicle(this.rng, type);
    vehicle.group.position.set(x, 0, z);
    vehicle.group.rotation.y = heading;
    this.scene.add(vehicle.group);
    const record = { vehicle, x, z, heading, taken: false };
    this.parked.push(record);
    return record;
  }

  /** One traffic car on a random road, optionally anywhere (initial fill). */
  spawnTrafficCar(anywhere, nearX = 0, nearZ = 0) {
    const axis = this.rng.chance(0.5) ? 'x' : 'z';
    const road = this.rng.pick(ROAD_LINES);
    const dir = this.rng.chance(0.5) ? 1 : -1;
    let along = this.rng.range(-CITY_EDGE + 10, CITY_EDGE - 10);
    if (!anywhere) {
      // Respawn on a road near the player but out of immediate sight.
      const target = axis === 'x' ? nearX : nearZ;
      along = target + this.rng.pick([-1, 1]) * this.rng.range(50, 110);
      along = Math.max(-CITY_EDGE + 10, Math.min(CITY_EDGE - 10, along));
    }
    const type = this.rng.chance(0.14) ? 'taxi' : this.rng.chance(0.12) ? 'van' : this.rng.chance(0.12) ? 'sports' : 'sedan';
    const vehicle = createVehicle(this.rng, type);
    const car = { vehicle, axis, road, dir, along, speed: TRAFFIC_SPEED * this.rng.range(0.85, 1.15), wait: 0, turnCooldown: 1 };
    const pos = lanePosition(car);
    vehicle.group.position.set(pos.x, 0, pos.z);
    vehicle.group.rotation.y = headingFor(axis, dir);
    this.scene.add(vehicle.group);
    this.cars.push(car);
    return car;
  }

  /** Is anything (another car, the player's car) stopped ahead of `car`? */
  blockedAhead(car, playerCar) {
    const pos = lanePosition(car);
    const fx = car.axis === 'x' ? car.dir : 0;
    const fz = car.axis === 'z' ? car.dir : 0;
    const ahead = (x, z, radius) => {
      const dx = x - pos.x;
      const dz = z - pos.z;
      const forward = dx * fx + dz * fz;
      const lateral = Math.abs(dx * fz - dz * fx);
      return forward > 0 && forward < 11 && lateral < radius;
    };
    for (const other of this.cars) {
      if (other === car) continue;
      const op = lanePosition(other);
      if (ahead(op.x, op.z, 2.6)) return true;
    }
    if (playerCar && ahead(playerCar.x, playerCar.z, 3.2)) return true;
    return false;
  }

  /** Drive every car one step; turn at intersections; recycle far cars. */
  update(dt, context) {
    for (let i = this.cars.length - 1; i >= 0; i -= 1) {
      const car = this.cars[i];
      const pos = lanePosition(car);
      const distToPlayer = Math.hypot(pos.x - context.playerX, pos.z - context.playerZ);
      if (distToPlayer > 190) {
        this.scene.remove(car.vehicle.group);
        this.cars.splice(i, 1);
        this.spawnTrafficCar(false, context.playerX, context.playerZ);
        continue;
      }
      // Slow for the car ahead; otherwise cruise.
      const blocked = this.blockedAhead(car, context.playerCar);
      car.speed += ((blocked ? 0 : TRAFFIC_SPEED) - car.speed) * Math.min(1, dt * 2);
      car.along += car.dir * car.speed * dt;
      car.turnCooldown = Math.max(0, car.turnCooldown - dt);
      // At an intersection, sometimes turn onto the crossing road.
      const nearestLine = ROAD_LINES.reduce((best, line) =>
        Math.abs(line - car.along) < Math.abs(best - car.along) ? line : best, ROAD_LINES[0]);
      if (car.turnCooldown <= 0 && Math.abs(nearestLine - car.along) < car.speed * dt + 0.4 && this.rng.chance(0.12)) {
        const newRoad = nearestLine;
        const newAlong = car.road;
        car.road = newRoad;
        car.along = newAlong;
        car.axis = car.axis === 'x' ? 'z' : 'x';
        car.dir = this.rng.chance(0.5) ? 1 : -1;
        car.turnCooldown = 2.5;
      }
      // City edge: turn around rather than drive into the sea.
      if (car.along > CITY_EDGE - 6) { car.along = CITY_EDGE - 6; car.dir = -1; }
      if (car.along < -CITY_EDGE + 6) { car.along = -CITY_EDGE + 6; car.dir = 1; }
      const next = lanePosition(car);
      car.vehicle.group.position.set(next.x, 0, next.z);
      const targetHeading = headingFor(car.axis, car.dir);
      car.vehicle.group.rotation.y = lerpAngle(car.vehicle.group.rotation.y, targetHeading, Math.min(1, dt * 6));
      updateVehicleWheels(car.vehicle, car.speed, 0, dt);
    }
  }

  /** The nearest parked car within `maxDist` of (x, z), or null. */
  nearestParkedCar(x, z, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const car of this.parked) {
      if (car.taken) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestDist) { bestDist = d; best = car; }
    }
    return best;
  }

  /** All cars (moving + parked) as circles, for the player's collision. */
  carCircles() {
    const circles = [];
    for (const car of this.cars) {
      const pos = lanePosition(car);
      circles.push({ x: pos.x, z: pos.z, radius: 2.6, traffic: car });
    }
    for (const car of this.parked) {
      if (!car.taken) circles.push({ x: car.x, z: car.z, radius: 2.6, parked: car });
    }
    return circles;
  }
}
