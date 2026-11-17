// The player: Dana Vega on foot and behind the wheel.
// One job: turn keyboard + mouse into motion — third-person running with a
// mouse camera on foot, arcade driving in a car, and getting in and out of
// cars with E. Collisions, crimes and effects report back via the context.

import {
  CAR_ACCEL, CAR_BRAKE, CAR_DRAG, CAR_MAX_REVERSE, CAR_MAX_SPEED, CAR_TURN_RATE,
  PLAYER_RUN_SPEED, PLAYER_WALK_SPEED,
} from './config.js';
import { createCharacter, playerLook, updateWalkCycle, weaponMuzzleWorld } from './characters.js';
import { updateVehicleWheels } from './vehicles.js';
import { resolveCircleCollisions } from './city.js';

const CAMERA_DISTANCE_FOOT = 6.5;
const CAMERA_DISTANCE_CAR = 9;
const CAMERA_HEIGHT_FOOT = 2.6;
const CAMERA_HEIGHT_CAR = 3.6;

function lerpAngle(current, target, t) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * t;
}

export class Player {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.parts = createCharacter(rng, 'player', playerLook());
    scene.add(this.parts.group);
    this.mode = 'foot'; // 'foot' | 'car'
    this.heading = 0;
    this.cameraYaw = Math.PI;
    this.cameraPitch = 0.32;
    this.speed = 0;       // on-foot speed, m/s
    this.car = null;      // driven car: { vehicle, x, z, heading, speed, steer, own }
    this.carSpeed = 0;
    this.firing = false;
    this.aiming = false;
    this.lastDamageTime = -100;
  }

  get x() { return this.mode === 'car' ? this.car.x : this.parts.group.position.x; }
  get z() { return this.mode === 'car' ? this.car.z : this.parts.group.position.z; }
  get inCar() { return this.mode === 'car'; }
  get currentSpeed() { return this.mode === 'car' ? Math.abs(this.carSpeed) : this.speed; }

  spawnAt(x, z, heading = 0) {
    this.parts.group.position.set(x, 0, z);
    this.parts.group.rotation.y = heading;
    this.heading = heading;
    this.cameraYaw = heading + Math.PI;
    this.mode = 'foot';
    this.car = null;
    this.parts.group.visible = true;
    this.parts.group.rotation.x = 0;
  }

  /** Camera look direction from the current yaw. */
  lookDirection() {
    return { x: Math.sin(this.cameraYaw), z: Math.cos(this.cameraYaw) };
  }

  /** World position of the rifle's muzzle (for tracers and flash). */
  muzzleWorldPosition() {
    return weaponMuzzleWorld(this.parts);
  }

  /** Step into a parked car (or the player's own van). */
  enterCar(parked, context) {
    parked.taken = true;
    this.car = {
      vehicle: parked.vehicle, x: parked.x, z: parked.z,
      heading: parked.heading, speed: 0, steer: 0, own: parked.own === true,
      parkedRef: parked,
    };
    this.carSpeed = 0;
    this.mode = 'car';
    this.parts.group.visible = false;
    this.cameraYaw = parked.heading + Math.PI;
    if (!parked.own) context.onCrime?.('steal', 1);
    context.onEnterCar?.(this.car);
  }

  /** Step out beside the car; it stays where it is, re-enterable. */
  exitCar(context) {
    if (!this.car) return;
    const sideX = Math.cos(this.car.heading);
    const sideZ = -Math.sin(this.car.heading);
    const px = this.car.x + sideX * 2.6;
    const pz = this.car.z + sideZ * 2.6;
    const parked = this.car.parkedRef;
    if (parked) {
      parked.x = this.car.x;
      parked.z = this.car.z;
      parked.heading = this.car.heading;
      parked.taken = false;
    }
    this.car = null;
    this.mode = 'foot';
    this.parts.group.visible = true;
    this.parts.group.position.set(px, 0, pz);
    this.parts.group.rotation.y = this.cameraYaw;
    this.heading = this.cameraYaw;
    context.onExitCar?.();
  }

  /** On-foot update: WASD relative to the camera, Shift to run. */
  updateOnFoot(dt, input, context) {
    const forward = this.lookDirection();
    const right = { x: -Math.cos(this.cameraYaw), z: Math.sin(this.cameraYaw) };
    let mx = 0;
    let mz = 0;
    if (input.keys.has('KeyW')) { mx += forward.x; mz += forward.z; }
    if (input.keys.has('KeyS')) { mx -= forward.x; mz -= forward.z; }
    if (input.keys.has('KeyD')) { mx += right.x; mz += right.z; }
    if (input.keys.has('KeyA')) { mx -= right.x; mz -= right.z; }
    const moving = mx !== 0 || mz !== 0;
    const running = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
    const targetSpeed = moving ? (running ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED) : 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 8);
    if (moving) {
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      const pos = this.parts.group.position;
      pos.x += mx * this.speed * dt;
      pos.z += mz * this.speed * dt;
      const posObj = { x: pos.x, z: pos.z };
      resolveCircleCollisions(posObj, 0.55, this.colliders);
      pos.x = posObj.x;
      pos.z = posObj.z;
      // Face the way Dana runs — unless aiming, when she faces the camera.
      const targetHeading = this.aiming || this.firing
        ? this.cameraYaw
        : Math.atan2(mx, mz);
      this.heading = lerpAngle(this.heading, targetHeading, Math.min(1, dt * 12));
      this.parts.group.rotation.y = this.heading;
    }
    updateWalkCycle(this.parts, dt, this.speed, this.aiming || this.firing);
  }

  /** Driving update: arcade throttle, steering, handbrake, collisions. */
  updateDriving(dt, input, context) {
    const car = this.car;
    const throttle = input.keys.has('KeyW') ? 1 : 0;
    const brake = input.keys.has('KeyS') ? 1 : 0;
    const handbrake = input.keys.has('Space');
    const steerInput = (input.keys.has('KeyA') ? -1 : 0) + (input.keys.has('KeyD') ? 1 : 0);
    // Steering: left is negative, but a car's nose swings the other way in
    // heading space, so the sign flips here (verified in the play test).
    const steerTarget = -steerInput;
    car.steer += (steerTarget - car.steer) * Math.min(1, dt * 6);

    if (throttle) car.speed += CAR_ACCEL * dt;
    if (brake) {
      if (car.speed > 0.5) car.speed -= CAR_BRAKE * dt;
      else car.speed -= CAR_ACCEL * 0.6 * dt;
    }
    car.speed -= car.speed * CAR_DRAG * dt * (handbrake ? 4 : 1);
    if (!throttle && !brake) car.speed -= car.speed * 0.4 * dt;
    car.speed = Math.max(-CAR_MAX_REVERSE, Math.min(CAR_MAX_SPEED, car.speed));
    if (Math.abs(car.speed) < 0.05 && !throttle && !brake) car.speed = 0;
    this.carSpeed = car.speed;

    const speedFactor = Math.max(-1, Math.min(1, car.speed / 9));
    const turnRate = CAR_TURN_RATE * (handbrake ? 1.5 : 1);
    car.heading += car.steer * turnRate * speedFactor * dt;

    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const beforeX = car.x;
    const beforeZ = car.z;
    car.x = nx;
    car.z = nz;
    // Two-circle body (nose + tail) against buildings.
    for (const offset of [1.4, -1.4]) {
      const cx = car.x + Math.sin(car.heading) * offset;
      const cz = car.z + Math.cos(car.heading) * offset;
      const posObj = { x: cx, z: cz };
      resolveCircleCollisions(posObj, 1.25, this.colliders);
      car.x += posObj.x - cx;
      car.z += posObj.z - cz;
    }
    // Traffic and parked cars: a solid bump, not a pass-through.
    for (const circle of context.carCircles) {
      const dx = car.x - circle.x;
      const dz = car.z - circle.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3.4 && dist > 0.01) {
        car.x = circle.x + (dx / dist) * 3.4;
        car.z = circle.z + (dz / dist) * 3.4;
        // A moving traffic car gets shoved along its road instead of
        // deadlocking the player behind it; parked cars stay put.
        if (circle.traffic) circle.traffic.along += circle.traffic.dir * 2.5;
        if (Math.abs(car.speed) > 6) context.onCrash?.(Math.abs(car.speed));
        car.speed *= 0.45;
      }
    }
    const pushed = Math.hypot(car.x - beforeX, car.z - beforeZ);
    const travelled = Math.hypot(nx - beforeX, nz - beforeZ);
    if (travelled > 0.01 && pushed < travelled * 0.4 && Math.abs(car.speed) > 5) {
      context.onCrash?.(Math.abs(car.speed));
      car.speed *= 0.35;
    }
    // Pedestrians in the way get hit.
    const frontX = car.x + Math.sin(car.heading) * 2.2;
    const frontZ = car.z + Math.cos(car.heading) * 2.2;
    if (Math.abs(car.speed) > 3) {
      const ped = context.peds?.nearestPed(frontX, frontZ, 2.2);
      if (ped && context.peds.knockPedDown(ped)) {
        context.onCrime?.('hitPed', 1);
        context.onCrash?.(Math.abs(car.speed) * 0.5);
      }
    }
    car.vehicle.group.position.set(car.x, 0, car.z);
    car.vehicle.group.rotation.y = car.heading;
    updateVehicleWheels(car.vehicle, car.speed, car.steer, dt);
    if (handbrake && Math.abs(car.speed) > 8) context.onTireSmoke?.(car.x, car.z);
    // The chase camera swings behind the car.
    const behind = car.heading + Math.PI;
    this.cameraYaw = lerpAngle(this.cameraYaw, behind, Math.min(1, dt * 1.6));
  }

  /** A police ram shoves the car: lose speed, jolt the heading, get pushed sideways. */
  takeRam(fromX, fromZ) {
    if (!this.car) return;
    const dx = this.car.x - fromX;
    const dz = this.car.z - fromZ;
    const dist = Math.max(0.5, Math.hypot(dx, dz));
    const pushHeading = Math.atan2(dx, dz);
    let delta = pushHeading - this.car.heading;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.car.heading += delta * 0.1;
    this.car.x += (dx / dist) * 1.4;
    this.car.z += (dz / dist) * 1.4;
    this.car.speed *= 0.78;
  }

  /** Mouse look: yaw follows the mouse, pitch clamps to a usable band. */
  applyMouseLook(dx, dy) {
    this.cameraYaw -= dx * 0.0024;
    this.cameraPitch = Math.max(0.05, Math.min(0.85, this.cameraPitch + dy * 0.002));
  }

  /** Place the third-person camera behind the player (or the car). */
  updateCamera(camera, dt, shake) {
    const inCar = this.mode === 'car';
    const distance = inCar ? CAMERA_DISTANCE_CAR : CAMERA_DISTANCE_FOOT;
    const height = inCar ? CAMERA_HEIGHT_CAR : CAMERA_HEIGHT_FOOT;
    const look = this.lookDirection();
    const targetX = this.x - look.x * Math.cos(this.cameraPitch) * distance;
    const targetZ = this.z - look.z * Math.cos(this.cameraPitch) * distance;
    const targetY = height + Math.sin(this.cameraPitch) * distance;
    const ease = Math.min(1, dt * 8);
    camera.position.x += (targetX - camera.position.x) * ease;
    camera.position.y += (targetY - camera.position.y) * ease;
    camera.position.z += (targetZ - camera.position.z) * ease;
    if (shake > 0.01) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake * 0.6;
    }
    // Look well ahead (12 m), not at Dana's feet: the sight line stays flat
    // enough for the crosshair ray to reach a target 20 m away instead of
    // digging into the ground halfway there.
    camera.lookAt(this.x + look.x * 12, 1.5, this.z + look.z * 12);
  }

  /** Direct camera placement for screenshot scenes (no smoothing). */
  snapCamera(camera, yaw, pitch, distance, height) {
    this.cameraYaw = yaw;
    this.cameraPitch = pitch;
    const look = this.lookDirection();
    camera.position.set(
      this.x - look.x * Math.cos(pitch) * distance,
      height + Math.sin(pitch) * distance,
      this.z - look.z * Math.cos(pitch) * distance,
    );
    camera.lookAt(this.x + look.x * 12, 1.5, this.z + look.z * 12);
  }
}
