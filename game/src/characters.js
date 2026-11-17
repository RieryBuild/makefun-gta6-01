// People of Solmar Bay: multi-part characters with a walk cycle.
// One job: build a person the camera can read at a glance — a head with a
// painted face, a torso with a vest in a second colour, separate arms and
// legs that swing when walking, and a weapon made of several visible parts.
// Never a ball on a stick: every limb is its own pivoted piece.

import { makeFaceTexture, makeTorsoTexture } from './textures.js';

const SKIN_TONES = ['#f2c9a0', '#d9a06b', '#a5713f', '#8a5a30', '#e8b88a', '#c98d5f'];
const HAIR_COLORS = ['#1a1a1a', '#3a2a1a', '#6b4a2a', '#8a8a8a', '#4a2a1a'];
const SHIRT_COLORS = ['#e84a5f', '#2a9d8f', '#f4a261', '#4a7de8', '#e8e8e8', '#9b5de5', '#43aa8b'];
const VEST_COLORS = ['#274b63', '#5c374c', '#3a3a3a', '#7a2e2e', '#2e5c3a'];
const PANTS_COLORS = ['#2a3a4a', '#4a4a4a', '#5c4632', '#1e2a3a', '#6b7a8a'];

/** A rifle from separate parts: body, barrel, grip, magazine, sight. Reads as a weapon at a glance. */
export function createRifle() {
  const gun = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.45, metalness: 0.7 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x4a3421, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.52), metal);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 8), metal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.03, 0.44);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 8), metal);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 0.03, 0.66);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.09), gripMat);
  grip.position.set(0, -0.15, -0.08);
  grip.rotation.x = 0.35;
  const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.1), metal);
  magazine.position.set(0, -0.16, 0.12);
  magazine.rotation.x = -0.12;
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.1), metal);
  sight.position.set(0, 0.11, 0.05);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.18), gripMat);
  stock.position.set(0, -0.01, -0.32);
  gun.add(body, barrel, muzzle, grip, magazine, sight, stock);
  // Muzzle tip in local space, for flash + tracer origin.
  gun.userData.muzzleTip = new THREE.Vector3(0, 0.03, 0.72);
  return gun;
}

/** A pistol from separate parts: slide, barrel, grip, trigger guard. */
export function createPistol() {
  const gun = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.45, metalness: 0.7 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 });
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.26), metal);
  slide.position.set(0, 0.05, 0.05);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), metal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.05, 0.22);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.08), gripMat);
  grip.position.set(0, -0.07, -0.04);
  grip.rotation.x = 0.25;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), metal);
  guard.position.set(0, -0.02, 0.08);
  gun.add(slide, barrel, grip, guard);
  gun.userData.muzzleTip = new THREE.Vector3(0, 0.05, 0.28);
  return gun;
}

/**
 * Build one person. `look` picks colours (randomised when omitted);
 * `role` is 'player' | 'ped' | 'cop' | 'gang' and sets the outfit rules.
 * Returns the rig: group + named pivots the walk cycle drives.
 */
export function createCharacter(rng, role, look = {}) {
  const skin = look.skin || rng.pick(SKIN_TONES);
  const hair = look.hair || rng.pick(HAIR_COLORS);
  const shirt = look.shirt || rng.pick(SHIRT_COLORS);
  const vest = look.vest || rng.pick(VEST_COLORS);
  const pants = look.pants || rng.pick(PANTS_COLORS);

  const skinMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(skin), roughness: 0.8 });
  const hairMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(hair), roughness: 1 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(pants), roughness: 0.95 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.7 });
  const torsoMat = new THREE.MeshStandardMaterial({ map: makeTorsoTexture(shirt, vest), roughness: 0.9 });
  const faceTex = makeFaceTexture(skin, hair, rng);

  const group = new THREE.Group();
  const parts = { walkPhase: rng.range(0, Math.PI * 2), aiming: false };

  // ---- Legs: thigh + shin + shoe, pivoted at the hip (y 0.95) ----
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(0.11 * side, 0.95, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.45, 0.2), pantsMat);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.42, 0.18), pantsMat);
    shin.position.y = -0.66;
    shin.castShadow = true;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.3), shoeMat);
    shoe.position.set(0, -0.9, 0.05);
    shoe.castShadow = true;
    hip.add(thigh, shin, shoe);
    group.add(hip);
    return hip;
  }
  parts.legL = makeLeg(-1);
  parts.legR = makeLeg(1);

  // ---- Torso: shirt + vest texture, pivoted at the hips ----
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.62, 0.3), torsoMat);
  torso.position.y = 1.26;
  torso.castShadow = true;
  group.add(torso);
  parts.torso = torso;

  // ---- Arms: upper + forearm + hand, pivoted at the shoulder ----
  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.34 * side, 1.52, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.38, 0.17), torsoMat);
    upper.position.y = -0.19;
    upper.castShadow = true;
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.34, 0.15), skinMat);
    forearm.position.y = -0.52;
    forearm.castShadow = true;
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), skinMat);
    hand.position.y = -0.74;
    shoulder.add(upper, forearm, hand);
    group.add(shoulder);
    return shoulder;
  }
  parts.armL = makeArm(-1);
  parts.armR = makeArm(1);

  // ---- Head: face texture on the front, hair on top and back ----
  const headMats = [skinMat, skinMat, hairMat, skinMat,
    new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.8 }), hairMat];
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.34), headMats);
  head.position.y = 1.82;
  head.castShadow = true;
  group.add(head);
  parts.head = head;

  // Role extras.
  if (role === 'cop') {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.22, 0.1, 10),
      new THREE.MeshStandardMaterial({ color: 0x1e3a5c, roughness: 0.8 }));
    cap.position.y = 2.04;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.5 }));
    brim.position.set(0, 2.0, 0.22);
    group.add(cap, brim);
  }
  if (role === 'gang') {
    const bandana = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.36),
      new THREE.MeshStandardMaterial({ color: 0xc83a3a, roughness: 0.9 }));
    bandana.position.y = 1.94;
    group.add(bandana);
  }

  // ---- Weapon in the right hand (rifle for the player and gang, pistol for cops) ----
  if (role !== 'ped') {
    const weapon = role === 'cop' ? createPistol() : createRifle();
    weapon.position.set(0, -0.78, 0.08);
    weapon.rotation.x = role === 'cop' ? 0 : -0.15;
    parts.armR.add(weapon);
    parts.weapon = weapon;
  }

  parts.group = group;
  return parts;
}

/** The player's look: teal jacket, dark jeans, dark tied-back hair. */
export function playerLook() {
  return { skin: '#d9a06b', hair: '#1a1a1a', shirt: '#2a9d8f', vest: '#274b63', pants: '#2a3a4a' };
}

/** A police officer's look: navy uniform, dark cap. */
export function copLook(rng) {
  return { skin: rng.pick(SKIN_TONES), hair: rng.pick(HAIR_COLORS), shirt: '#1e3a5c', vest: '#16283e', pants: '#16283e' };
}

/** A Dockside Kings look: red vest over a dark shirt, bandana. */
export function gangLook(rng) {
  return { skin: rng.pick(SKIN_TONES), hair: rng.pick(HAIR_COLORS), shirt: '#3a3a3a', vest: '#c83a3a', pants: '#2a2a2a' };
}

/**
 * Drive the walk cycle: legs and arms swing in opposition, the body bobs.
 * `speed` is metres per second; at rest the limbs ease back to neutral.
 * While aiming, the right arm stays raised and the legs keep walking.
 */
export function updateWalkCycle(parts, dt, speed, aiming) {
  const swing = Math.min(1, speed / 5) * 0.65;
  parts.walkPhase += dt * (2.2 + speed * 1.35);
  const s = Math.sin(parts.walkPhase);
  const targetLegL = s * swing;
  const targetLegR = -s * swing;
  const targetArmL = aiming ? -0.4 : -s * swing * 0.8;
  const targetArmR = aiming ? -1.35 : s * swing * 0.8;
  const ease = Math.min(1, dt * 10);
  parts.legL.rotation.x += (targetLegL - parts.legL.rotation.x) * ease;
  parts.legR.rotation.x += (targetLegR - parts.legR.rotation.x) * ease;
  parts.armL.rotation.x += (targetArmL - parts.armL.rotation.x) * ease;
  parts.armR.rotation.x += (targetArmR - parts.armR.rotation.x) * ease;
  parts.group.position.y = Math.abs(Math.cos(parts.walkPhase)) * 0.045 * Math.min(1, speed / 5);
  // Keep the weapon level: counter-rotate it against the arm, so the rifle
  // points where its owner looks. Without this the aiming pose (arm swung
  // forward) points the barrel at the sky and the muzzle flash with it.
  if (parts.weapon) {
    parts.weapon.rotation.x = -parts.armR.rotation.x - 0.12;
  }
}

/** Lay a character flat on the ground (shot, run over, or arrested). */
export function layCharacterDown(parts) {
  parts.group.rotation.x = -Math.PI / 2;
  parts.group.position.y = 0.25;
  parts.legL.rotation.x = 0;
  parts.legR.rotation.x = 0.2;
  parts.armL.rotation.x = 0.6;
  parts.armR.rotation.x = -0.6;
}

/**
 * The world position of a character's muzzle. Forces the rig's matrices
 * fresh first: screenshot staging calls this before any render has run,
 * and localToWorld alone trusts the (still identity) parent matrices.
 */
export function weaponMuzzleWorld(parts) {
  if (!parts.weapon) return parts.group.position.clone();
  parts.group.updateMatrixWorld(true, true);
  return parts.weapon.localToWorld(parts.weapon.userData.muzzleTip.clone());
}
