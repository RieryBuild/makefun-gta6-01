// Screenshot scenes behind ?shot=chase|city|mission|combat.
// One job: stage each shot by playing the real game forward from a fresh
// seeded world with a scripted autopilot — the frame is what real play
// looks like, and the same seed always gives the same frame. After staging,
// the simulation freezes on that exact frame for the screenshot.

import { createVehicle } from './vehicles.js';

const STEP = 1 / 30;

/** Finish a shot: hide the briefing banner and the E prompt, refresh the HUD, render the frozen frame. */
function finishShot(world) {
  world.hud.hideBanner();
  world.hud.hidePrompt();
  world.refreshHud();
  world.render();
}

/** Put the world in a fresh playing state for a shot. */
function freshWorldForShot(world, seed) {
  world.build(seed);
  world.state = 'playing';
  world.input.enabled = true;
  world.input.clear();
  world.hud.hideStart();
  world.hud.hideEndScreens();
  world.hud.setHintVisible(false);
  world.health = 100;
  world.cash = 2450;
}

/** Run the simulation forward `seconds` with `drive` held each step. */
function runForward(world, seconds, drive) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    drive(world, i * STEP);
    world.update(STEP);
  }
}

/** Hold W most of the time (a 0.25 s lift per second lets the cruisers keep up); steer by heading error toward the road's centreline. */
function pulsedChaseAutopilot(world, t) {
  const keys = world.input.keys;
  keys.delete('KeyW');
  if (t % 1 < 0.75) keys.add('KeyW');
  keys.delete('KeyA');
  keys.delete('KeyD');
  if (!world.player.inCar) return;
  const car = world.player.car;
  // Desired heading: mostly south, angled back toward x = 0 when off-centre.
  const desired = Math.atan2(-car.x * 0.06, 1);
  let error = desired - car.heading;
  while (error > Math.PI) error -= Math.PI * 2;
  while (error < -Math.PI) error += Math.PI * 2;
  if (error > 0.06) keys.add('KeyA');
  else if (error < -0.06) keys.add('KeyD');
}

/** Walk forward (W) with the camera already aimed where the shot wants. */
function walkAutopilot(world) {
  world.input.keys.add('KeyW');
}

/** Stand still: clear every movement key (the autopilot holds W otherwise). */
function standStill(world) {
  world.input.keys.delete('KeyW');
  world.input.keys.delete('KeyA');
  world.input.keys.delete('KeyS');
  world.input.keys.delete('KeyD');
}

/** Hold the aim pose (right mouse) while facing the nearest enemy. */
function aimPose(world) {
  world.input.rightDown = true;
  const enemies = world.combat.aliveEnemies();
  if (enemies.length > 0) aimCameraAt(world, enemies[0].x, enemies[0].z);
  standStill(world);
}

/** Put Dana in a fresh sports car at (x, z), facing `heading`. */
function putPlayerInSportsCar(world, x, z, heading) {
  const vehicle = createVehicle(world.rng.fork(201), 'sports', 0xc83a3a);
  vehicle.group.position.set(x, 0, z);
  vehicle.group.rotation.y = heading;
  world.scene.add(vehicle.group);
  const parked = { vehicle, x, z, heading, taken: false, own: true };
  world.traffic.parked.push(parked);
  world.player.enterCar(parked, { onCrime: () => {}, onEnterCar: () => {} });
}

/** Aim Dana's camera at a point (for the on-foot action shots). */
function aimCameraAt(world, x, z) {
  const dx = x - world.player.x;
  const dz = z - world.player.z;
  world.player.cameraYaw = Math.atan2(dx, dz);
  world.player.cameraPitch = 0.3;
}

/** Frame the nearest live enemy from just behind Dana's shoulder. */
function frameNearestEnemy(world) {
  const enemies = world.combat.aliveEnemies();
  if (enemies.length === 0) return;
  const enemy = enemies[0];
  aimCameraAt(world, enemy.x, enemy.z);
  world.player.snapCamera(world.camera, world.player.cameraYaw, 0.28, 5.5, 2.4);
}

/**
 * Stage the named shot and freeze the frame. Returns the shot's name.
 * Unknown names stage the chase (the cover).
 */
export function stageShot(name, world, seed) {
  if (name === 'city') {
    freshWorldForShot(world, seed);
    world.missions.startNext(world.missionContext()); // m1: objective + waypoint on the HUD
    world.player.spawnAt(0, -24, 0);
    world.player.cameraYaw = 0; // look south down Marlin Street
    world.player.cameraPitch = 0.3;
    runForward(world, 5, walkAutopilot);
    finishShot(world);
    return 'city';
  }

  if (name === 'mission') {
    freshWorldForShot(world, seed);
    world.missions.completedCount = 2;
    world.missions.startNext(world.missionContext()); // m3: Dockside Heat
    world.player.spawnAt(180, 0, -Math.PI / 2); // at the docks' edge, facing the apron
    runForward(world, 0.5, walkAutopilot); // cross the waypoint: the fight starts
    // Step south of the middle pier for a clear firing line over the apron.
    world.player.spawnAt(190, -16, -Math.PI / 2);
    runForward(world, 3, aimPose); // hold the aim while the Kings shoot back
    frameNearestEnemy(world);
    finishShot(world);
    return 'mission';
  }

  if (name === 'combat') {
    freshWorldForShot(world, seed);
    world.missions.completedCount = 2;
    world.missions.startNext(world.missionContext()); // m3: Dockside Heat
    world.player.spawnAt(182, -10, -Math.PI / 2);
    // Advance on the nearest King until close, then stand and trade fire —
    // a few shots only, so the mission stays live for the frame.
    let shotsFired = 0;
    runForward(world, 4.5, (w) => {
      const enemies = w.combat.aliveEnemies();
      if (enemies.length === 0) { standStill(w); return; }
      const enemy = enemies[0];
      const dist = Math.hypot(enemy.x - w.player.x, enemy.z - w.player.z);
      aimCameraAt(w, enemy.x, enemy.z);
      if (dist > 14) walkAutopilot(w);
      else {
        standStill(w);
        w.input.rightDown = true; // raise the rifle once in range
        if (shotsFired < 4) { w.tryShoot(); shotsFired += 1; }
      }
    });
    runForward(world, 0.4, aimPose); // settle the aim pose for the frame
    frameNearestEnemy(world);
    world.tryShoot(); // one last shot: muzzle flash + tracer lit in the frozen frame
    finishShot(world);
    return 'combat';
  }

  // 'chase' (the cover) and any other name: a 3-star pursuit with a mission live.
  freshWorldForShot(world, seed);
  world.missions.completedCount = 3;
  world.missions.startNext(world.missionContext()); // m4: The Getaway — wanted 3, objective live
  putPlayerInSportsCar(world, 0, -108, 0);
  world.player.cameraPitch = 0.22; // lower chase camera: more speed, more car
  // Cruisers staged for the camera, which looks forward from the chase car:
  // one oncoming ahead, one alongside, one behind (visible on the minimap).
  const cruiserSpots = [
    { x: 5, z: -44, heading: Math.PI },
    { x: -7, z: -96, heading: 0 },
    { x: 3, z: -160, heading: 0 },
  ];
  for (const spot of cruiserSpots) {
    const cruiser = world.police.spawnCruiser(world.player.x, world.player.z);
    cruiser.x = spot.x;
    cruiser.z = spot.z;
    cruiser.heading = spot.heading;
    cruiser.speed = 14;
    cruiser.vehicle.group.position.set(spot.x, 0, spot.z);
    cruiser.vehicle.group.rotation.y = spot.heading;
  }
  runForward(world, 6, pulsedChaseAutopilot);
  finishShot(world);
  return 'chase';
}
