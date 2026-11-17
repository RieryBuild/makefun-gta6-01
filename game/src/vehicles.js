// Vehicles of Solmar Bay: multi-part cars with a readable silhouette.
// One job: build a car from separate pieces — painted body with a sheen
// texture, glass cabin, four spinning wheels with hubcaps, headlights and
// taillights — plus the police, taxi, van and truck variants. Forward is
// local +Z; heading is rotation.y.

import { makePaintTexture } from './textures.js';

export const CAR_COLORS = [
  0xc83a3a, 0x2a6bc8, 0xe8e8e8, 0x2a2a2a, 0x4a9e5c, 0xd8a03a,
  0x7a5fc8, 0x8a8a8a, 0xe87a3a, 0x3aa8c8, 0x5c8a3a, 0xb8b8b8,
];

/** Shared materials, built once: glass, tyres, chrome, lights. */
let shared = null;
function getShared(rng) {
  if (shared) return shared;
  shared = {
    paintTex: makePaintTexture(rng),
    glass: new THREE.MeshStandardMaterial({ color: 0x1c2f3e, roughness: 0.15, metalness: 0.8 }),
    tyre: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 }),
    hub: new THREE.MeshStandardMaterial({ color: 0xc8c8c8, roughness: 0.3, metalness: 0.8 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.25, metalness: 0.9 }),
    headlight: new THREE.MeshStandardMaterial({ color: 0xfff6c9, emissive: 0xfff2b0, emissiveIntensity: 0.9 }),
    taillight: new THREE.MeshStandardMaterial({ color: 0xc81e1e, emissive: 0xaa1414, emissiveIntensity: 0.8 }),
    bumper: new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6, metalness: 0.4 }),
    grille: new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.8 }),
  };
  return shared;
}

/** One wheel: tyre cylinder + hubcap, in a group that spins around X. */
function makeWheel(mats, radius = 0.34, width = 0.26) {
  const spin = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 14), mats.tyre);
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.02, 10), mats.hub);
  hub.rotation.z = Math.PI / 2;
  spin.add(tyre, hub);
  return spin;
}

/**
 * Build a car. `type` is 'sedan' | 'taxi' | 'sports' | 'van' | 'truck' | 'police'.
 * Returns { group, wheels, steerL, steerR, type, length, width }.
 */
export function createVehicle(rng, type, color) {
  const mats = getShared(rng);
  const paint = new THREE.MeshStandardMaterial({
    map: mats.paintTex,
    color: new THREE.Color(type === 'police' ? 0xf2f2f2 : type === 'taxi' ? 0xf2c832 : (color ?? rng.pick(CAR_COLORS))),
    roughness: 0.35,
    metalness: 0.4,
  });
  const darkPaint = new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.4, metalness: 0.4 });
  const group = new THREE.Group();
  const isVan = type === 'van' || type === 'truck';
  const isSports = type === 'sports';
  const bodyW = isVan ? 2.0 : 1.9;
  const bodyH = isSports ? 0.45 : isVan ? 0.9 : 0.55;
  const bodyL = isSports ? 4.7 : isVan ? 4.8 : 4.4;
  const bodyY = isSports ? 0.45 : isVan ? 0.75 : 0.55;

  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyL), paint);
  body.position.y = bodyY;
  body.castShadow = true;
  group.add(body);

  // Cabin: glass box + painted roof plate (vans/trucks get a cargo box instead).
  if (!isVan) {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.52, isSports ? 2.0 : 2.2), mats.glass);
    cabin.position.set(0, bodyY + bodyH / 2 + 0.24, isSports ? -0.3 : -0.2);
    cabin.castShadow = true;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, isSports ? 1.5 : 1.7), paint);
    roof.position.set(0, bodyY + bodyH / 2 + 0.52, isSports ? -0.3 : -0.2);
    roof.castShadow = true;
    group.add(cabin, roof);
  } else {
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.15, 3.1), type === 'truck' ? darkPaint : paint);
    cargo.position.set(0, 1.55, -0.7);
    cargo.castShadow = true;
    const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 0.9), mats.glass);
    cabGlass.position.set(0, 1.35, 1.7);
    group.add(cargo, cabGlass);
  }

  // Bumpers, grille, mirrors.
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(bodyW + 0.04, 0.18, 0.18), mats.bumper);
  bumperF.position.set(0, 0.32, bodyL / 2 + 0.05);
  const bumperR = bumperF.clone();
  bumperR.position.z = -bodyL / 2 - 0.05;
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.06), mats.grille);
  grille.position.set(0, 0.55, bodyL / 2 + 0.02);
  group.add(bumperF, bumperR, grille);
  for (const side of [-1, 1]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.2), mats.bumper);
    mirror.position.set(side * (bodyW / 2 + 0.06), bodyY + bodyH / 2 + 0.1, bodyL / 2 - 1.1);
    group.add(mirror);
  }

  // Headlights (front, +Z) and taillights (rear).
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), mats.headlight);
    head.position.set(side * 0.62, 0.62, bodyL / 2 + 0.03);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), mats.taillight);
    tail.position.set(side * 0.62, 0.62, -bodyL / 2 - 0.03);
    group.add(head, tail);
  }

  // Police extras: black door band + flashing light bar.
  let lightBar = null;
  if (type === 'police') {
    const band = new THREE.Mesh(new THREE.BoxGeometry(bodyW + 0.02, 0.34, 2.0), darkPaint);
    band.position.set(0, bodyY + 0.05, -0.2);
    group.add(band);
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1.6 }));
    red.position.x = -0.32;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x2050ff, emissive: 0x2050ff, emissiveIntensity: 1.6 }));
    blue.position.x = 0.32;
    lightBar.add(red, blue);
    lightBar.position.set(0, bodyY + bodyH / 2 + 0.62, -0.2);
    group.add(lightBar);
    const pushBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.1), mats.bumper);
    pushBar.position.set(0, 0.5, bodyL / 2 + 0.14);
    group.add(pushBar);
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffe977, emissiveIntensity: 0.6 }));
    sign.position.set(0, bodyY + bodyH / 2 + 0.62, -0.2);
    group.add(sign);
  }

  // Wheels: front pair steers, all four spin.
  const wheelR = isVan ? 0.38 : 0.34;
  const wheelY = wheelR;
  const wheelX = bodyW / 2 - 0.05;
  const wheelZ = bodyL / 2 - 0.85;
  const wheels = {};
  const steerL = new THREE.Group();
  const steerR = new THREE.Group();
  steerL.position.set(-wheelX, wheelY, wheelZ);
  steerR.position.set(wheelX, wheelY, wheelZ);
  wheels.fl = makeWheel(mats, wheelR);
  wheels.fr = makeWheel(mats, wheelR);
  steerL.add(wheels.fl);
  steerR.add(wheels.fr);
  wheels.rl = makeWheel(mats, wheelR);
  wheels.rl.position.set(-wheelX, wheelY, -wheelZ);
  wheels.rr = makeWheel(mats, wheelR);
  wheels.rr.position.set(wheelX, wheelY, -wheelZ);
  group.add(steerL, steerR, wheels.rl, wheels.rr);

  return { group, wheels, steerL, steerR, lightBar, type, length: bodyL, width: bodyW };
}

/** Spin the wheels with the road speed and steer the front pair. */
export function updateVehicleWheels(vehicle, speed, steer, dt) {
  const spin = (speed / 0.34) * dt;
  vehicle.wheels.fl.rotation.x += spin;
  vehicle.wheels.fr.rotation.x += spin;
  vehicle.wheels.rl.rotation.x += spin;
  vehicle.wheels.rr.rotation.x += spin;
  const target = steer * 0.45;
  vehicle.steerL.rotation.y = target;
  vehicle.steerR.rotation.y = target;
}

/** Alternate the police light bar's red/blue flash. Returns the lit side. */
export function flashLightBar(vehicle, time) {
  if (!vehicle.lightBar) return;
  const redOn = Math.floor(time * 6) % 2 === 0;
  const red = vehicle.lightBar.children[0];
  const blue = vehicle.lightBar.children[1];
  red.material.emissiveIntensity = redOn ? 2.4 : 0.25;
  blue.material.emissiveIntensity = redOn ? 0.25 : 2.4;
}
