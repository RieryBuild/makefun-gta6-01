// The city of Solmar Bay, built from a seed.
// One job: turn the seeded layout into meshes — ground, water, buildings,
// streetlights, trees, the beach and the docks — and hand back the solid
// colliders the player, cars and AI all bump into.

import {
  BLOCK_MAX, BLOCK_MIN, CITY_EDGE, DOCKS, FOG_COLOR, GARAGE, HOSPITAL, POLICE_STATION,
  ROAD_LINES, ROAD_SPACING, ROAD_WIDTH, SKY_COLOR, SUN_COLOR, SUN_INTENSITY, WORLD_EDGE,
} from './config.js';
import {
  makeContainerTexture, makeFacadeSet, makeGroundTexture, makeRoofTexture,
  makeWaterTexture, makeWoodTexture,
} from './textures.js';

/** A painted sign board: the garage, hospital and police station name themselves. */
function makeSignTexture(text, bg, fg, subtext) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 112);
  ctx.fillStyle = fg;
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, subtext ? 62 : 82);
  if (subtext) {
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(subtext, 256, 104);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

/** A box building with textured facades and a roof, registered as solid. */
function addBuilding(group, colliders, x, z, w, h, d, facade, roofMat, rng) {
  const facadeTex = facade.clone();
  facadeTex.needsUpdate = true;
  facadeTex.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 12)));
  const sideMat = new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.9 });
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    [sideMat, sideMat, roofMat, roofMat, sideMat, sideMat],
  );
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  return mesh;
}

/** A streetlight: pole, arm and a warm lamp head. */
function addStreetlight(group, x, z, poleGeo, armGeo, headGeo, poleMat, lampMat) {
  const lamp = new THREE.Group();
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 3.5;
  pole.castShadow = true;
  const arm = new THREE.Mesh(armGeo, poleMat);
  arm.position.set(0.8, 6.9, 0);
  const head = new THREE.Mesh(headGeo, lampMat);
  head.position.set(1.6, 6.8, 0);
  lamp.add(pole, arm, head);
  lamp.position.set(x, 0, z);
  lamp.rotation.y = (x + z) % 2 === 0 ? 0 : Math.PI;
  group.add(lamp);
}

/** A leafy street tree: trunk + three stacked foliage blobs. */
function addTree(group, x, z, rng, trunkGeo, leafGeo, trunkMat, leafMats) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 1.4;
  trunk.castShadow = true;
  tree.add(trunk);
  const leafMat = leafMats[rng.int(0, leafMats.length - 1)];
  for (let i = 0; i < 3; i += 1) {
    const blob = new THREE.Mesh(leafGeo, leafMat);
    blob.position.set(rng.range(-0.5, 0.5), 2.8 + i * 0.9, rng.range(-0.5, 0.5));
    const s = 1.5 - i * 0.3;
    blob.scale.set(s, s * 0.8, s);
    blob.castShadow = true;
    tree.add(blob);
  }
  tree.position.set(x, 0, z);
  tree.rotation.y = rng.range(0, Math.PI * 2);
  group.add(tree);
}

/** A palm: leaning trunk + drooping fronds, for the beach strip. */
function addPalm(group, x, z, rng, trunkGeo, frondGeo, trunkMat, frondMat) {
  const palm = new THREE.Group();
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 2.6;
  trunk.rotation.z = rng.range(-0.12, 0.12);
  trunk.castShadow = true;
  palm.add(trunk);
  for (let i = 0; i < 7; i += 1) {
    const frond = new THREE.Mesh(frondGeo, frondMat);
    frond.position.y = 5.1;
    frond.rotation.y = (i / 7) * Math.PI * 2;
    frond.rotation.x = 0; // set below via pivot trick: rotate the frond's own z after yaw
    frond.rotateZ(0.7);
    frond.translateY(1.1);
    frond.castShadow = true;
    palm.add(frond);
  }
  palm.position.set(x, 0, z);
  palm.rotation.y = rng.range(0, Math.PI * 2);
  group.add(palm);
}

/**
 * Build the whole city into `scene` from `rng` and return its live parts:
 * colliders for movement, clouds to drift, water textures to scroll.
 */
export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // ---- Sky, light and fog ----
  scene.background = new THREE.Color(SKY_COLOR);
  scene.fog = new THREE.Fog(FOG_COLOR, 140, 420);
  const sun = new THREE.DirectionalLight(SUN_COLOR, SUN_INTENSITY);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.85));

  // Sun disc + drifting clouds.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(18, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff6c9, fog: false }),
  );
  sunDisc.position.set(220, 190, -260);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);
  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  for (let i = 0; i < 10; i += 1) {
    const cloud = new THREE.Group();
    const puffs = rng.int(3, 5);
    for (let p = 0; p < puffs; p += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.range(5, 10), 8, 6), cloudMat);
      puff.position.set(p * rng.range(6, 9) - puffs * 3, rng.range(-1.5, 1.5), rng.range(-3, 3));
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set(rng.range(-300, 300), rng.range(70, 110), rng.range(-300, 300));
    scene.add(cloud);
    clouds.push(cloud);
  }

  // ---- Ground (one painted canvas: roads, markings, sidewalks, sand) ----
  const groundTex = makeGroundTexture(rng.fork(11));
  groundTex.anisotropy = 8;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_EDGE * 2, WORLD_EDGE * 2),
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // ---- Water: south bay + east harbour, one scrolling texture ----
  const waterTex = makeWaterTexture(rng.fork(12));
  const waterMat = new THREE.MeshStandardMaterial({
    map: waterTex, color: 0x9fd4e8, transparent: true, opacity: 0.94, roughness: 0.25, metalness: 0.1,
  });
  const southWater = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_EDGE * 2, WORLD_EDGE - 216), waterMat);
  southWater.rotation.x = -Math.PI / 2;
  southWater.position.set(0, 0.06, (216 + WORLD_EDGE) / 2);
  group.add(southWater);
  const eastWater = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_EDGE - 216, WORLD_EDGE * 2), waterMat);
  eastWater.rotation.x = -Math.PI / 2;
  eastWater.position.set((216 + WORLD_EDGE) / 2, 0.06, 0);
  group.add(eastWater);

  // ---- Buildings, block by block ----
  const facades = makeFacadeSet(rng.fork(13));
  const roofTex = makeRoofTexture(rng.fork(14));
  const roofMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 1 });
  const containerTexs = ['#c8553a', '#3a7bc8', '#4a9e5c', '#d8a03a'].map((c) => makeContainerTexture(c));
  const woodTex = makeWoodTexture(rng.fork(15));
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 1 });

  const isDowntown = (bx, bz) => Math.abs(bx) <= 1 && Math.abs(bz) <= 1;
  const pickFacade = (height) => {
    const set = facades[rng.int(0, facades.length - 1)];
    return height > 34 ? set.tall : height > 16 ? set.mid : set.low;
  };

  for (let bx = BLOCK_MIN; bx <= BLOCK_MAX; bx += 1) {
    for (let bz = BLOCK_MIN; bz <= BLOCK_MAX; bz += 1) {
      const cx = bx * ROAD_SPACING + ROAD_SPACING / 2;
      const cz = bz * ROAD_SPACING + ROAD_SPACING / 2;
      // Special blocks.
      if (bx === -1 && bz === -1) { // Rosa's garage: wide workshop + sign.
        addBuilding(group, colliders, cx, cz, 30, 9, 22, pickFacade(9), roofMat, rng);
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(16, 4),
          new THREE.MeshStandardMaterial({ map: makeSignTexture("ROSA'S GARAGE", '#274b63', '#ffd977', 'REPAIRS • MISSIONS'), roughness: 0.8 }),
        );
        sign.position.set(cx, 7.5, cz - 11.2);
        group.add(sign);
        continue;
      }
      if (bx === 1 && bz === 1) continue; // Central park: trees only (planted below).
      if (bx === 2 && bz === -1) continue; // Parking lot: cars only.
      if (bx === -2 && bz === -3) { // Hospital.
        addBuilding(group, colliders, cx, cz, 26, 14, 22, pickFacade(14), roofMat, rng);
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(12, 3),
          new THREE.MeshStandardMaterial({ map: makeSignTexture('SOLMAR GENERAL', '#f2f2f2', '#c83a3a', 'HOSPITAL'), roughness: 0.8 }),
        );
        sign.position.set(cx, 11, cz - 11.2);
        group.add(sign);
        continue;
      }
      if (bx === -3 && bz === 2) { // Police station.
        addBuilding(group, colliders, cx, cz, 26, 12, 22, pickFacade(12), roofMat, rng);
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(12, 3),
          new THREE.MeshStandardMaterial({ map: makeSignTexture('SBPD', '#1e3a5c', '#ffffff', 'SOLMAR BAY POLICE'), roughness: 0.8 }),
        );
        sign.position.set(cx, 9.5, cz - 11.2);
        group.add(sign);
        continue;
      }
      if (bx === BLOCK_MAX) { // Dock warehouses + container stacks.
        addBuilding(group, colliders, cx, cz, 26, 10, 30, pickFacade(10), roofMat, rng);
        for (let s = 0; s < 3; s += 1) {
          const stack = new THREE.Mesh(
            new THREE.BoxGeometry(12, 2.6, 2.6),
            new THREE.MeshStandardMaterial({ map: containerTexs[rng.int(0, 3)], roughness: 0.85 }),
          );
          stack.position.set(cx + rng.range(-8, 8), 1.3 + s * 2.6, cz + rng.range(-12, 12));
          stack.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
          stack.castShadow = true;
          group.add(stack);
          colliders.push({
            minX: stack.position.x - 6, maxX: stack.position.x + 6,
            minZ: stack.position.z - 1.5, maxZ: stack.position.z + 1.5,
          });
        }
        continue;
      }
      // Ordinary blocks: 1-3 buildings, taller downtown, low-rise by the beach.
      const count = rng.int(1, 3);
      for (let n = 0; n < count; n += 1) {
        const w = rng.range(12, 20);
        const d = rng.range(12, 20);
        const beach = bz === BLOCK_MAX;
        const h = beach ? rng.range(7, 12)
          : isDowntown(bx, bz) ? rng.range(24, 58)
            : rng.range(9, 22);
        const ox = count === 1 ? 0 : rng.range(-8, 8);
        const oz = count === 1 ? 0 : rng.range(-8, 8);
        addBuilding(group, colliders, cx + ox, cz + oz, w, h, d, pickFacade(h), roofMat, rng);
      }
    }
  }

  // ---- Streetlights at intersections (every other one, to keep draw calls sane) ----
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 7, 6);
  const armGeo = new THREE.BoxGeometry(1.8, 0.12, 0.12);
  const headGeo = new THREE.BoxGeometry(0.9, 0.18, 0.4);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.6, metalness: 0.6 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffedb0, emissiveIntensity: 0.7 });
  ROAD_LINES.forEach((x, xi) => {
    ROAD_LINES.forEach((z, zi) => {
      if ((xi + zi) % 2 === 0) addStreetlight(group, x + 8.2, z + 8.2, poleGeo, armGeo, headGeo, poleMat, lampMat);
    });
  });

  // ---- Trees: park grove, sidewalk rows, beach palms ----
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 2.8, 6);
  const leafGeo = new THREE.SphereGeometry(1.6, 7, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 1 });
  const leafMats = [0x4a8a3a, 0x5da244, 0x3f7a34].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
  for (let i = 0; i < 26; i += 1) { // central park grove
    addTree(group, 72 + rng.range(-14, 14), 72 + rng.range(-14, 14), rng, trunkGeo, leafGeo, trunkMat, leafMats);
  }
  for (let i = 0; i < 40; i += 1) { // sidewalk trees along random streets
    const along = ROAD_LINES[rng.int(0, ROAD_LINES.length - 1)];
    const across = rng.range(-CITY_EDGE, CITY_EDGE);
    if (rng.chance(0.5)) addTree(group, along + 8.6, across, rng, trunkGeo, leafGeo, trunkMat, leafMats);
    else addTree(group, across, along + 8.6, rng, trunkGeo, leafGeo, trunkMat, leafMats);
  }
  const palmTrunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 5.2, 6);
  const frondGeo = new THREE.BoxGeometry(0.7, 2.6, 0.08);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x3f8a3a, roughness: 1, side: THREE.DoubleSide });
  for (let x = -170; x <= 170; x += 14) {
    if (rng.chance(0.75)) addPalm(group, x + rng.range(-4, 4), 182 + rng.range(0, 18), rng, palmTrunkGeo, frondGeo, trunkMat, frondMat);
  }

  // ---- Beach umbrellas ----
  const umbrellaCols = [0xe84a5f, 0x2a9d8f, 0xf4a261, 0x4a7de8];
  for (let i = 0; i < 8; i += 1) {
    const u = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), poleMat);
    pole.position.y = 1.2;
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(1.9, 0.7, 8),
      new THREE.MeshStandardMaterial({ color: umbrellaCols[i % 4], roughness: 0.9 }),
    );
    top.position.y = 2.6;
    top.castShadow = true;
    u.add(pole, top);
    u.position.set(rng.range(-160, 160), 0, rng.range(182, 208));
    group.add(u);
  }

  // ---- Docks: three wooden piers + a loading crane ----
  for (const pierZ of [-96, 0, 96]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(58, 1.2, 10), woodMat);
    pier.position.set(192 + 29, 0.6, pierZ);
    pier.castShadow = true;
    pier.receiveShadow = true;
    group.add(pier);
    colliders.push({ minX: 192, maxX: 250, minZ: pierZ - 5, maxZ: pierZ + 5 });
    for (let px = 198; px <= 246; px += 12) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 6), trunkMat);
      post.position.set(px, 0.4, pierZ + 5.4);
      group.add(post);
    }
  }
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xd8a03a, roughness: 0.7, metalness: 0.3 });
  const crane = new THREE.Group();
  const legGeo = new THREE.BoxGeometry(1.2, 26, 1.2);
  const legA = new THREE.Mesh(legGeo, craneMat);
  legA.position.set(-5, 13, 0);
  const legB = new THREE.Mesh(legGeo, craneMat);
  legB.position.set(5, 13, 0);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(26, 1.4, 1.4), craneMat);
  beam.position.set(4, 26, 0);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 12, 4), poleMat);
  cable.position.set(14, 20, 0);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 2), poleMat);
  hook.position.set(14, 13.5, 0);
  crane.add(legA, legB, beam, cable, hook);
  crane.position.set(DOCKS.x + 6, 0, DOCKS.z - 40);
  crane.rotation.y = Math.PI / 2;
  crane.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  group.add(crane);
  colliders.push({ minX: DOCKS.x - 2, maxX: DOCKS.x + 14, minZ: DOCKS.z - 46, maxZ: DOCKS.z - 34 });

  // ---- Invisible walls at the world edge (keeps cars in the playable area) ----
  const edge = WORLD_EDGE - 4;
  colliders.push(
    { minX: -edge - 10, maxX: -edge, minZ: -edge, maxZ: edge },
    { minX: edge, maxX: edge + 10, minZ: -edge, maxZ: edge },
    { minX: -edge, maxX: edge, minZ: -edge - 10, maxZ: -edge },
    { minX: -edge, maxX: edge, minZ: edge, maxZ: edge + 10 },
  );

  // ---- The sea is not drivable: block the water south and east of the land ----
  // South sea: everything past the beach (z > 216).
  colliders.push({ minX: -edge, maxX: edge, minZ: 216, maxZ: edge });
  // East sea: everything past the docks (x > 216), with gaps at the three
  // piers (8 m wide, centred on z = -96, 0, 96) — and a stop at each pier's
  // end, so Dana cannot walk off the boards onto the water.
  for (const [minZ, maxZ] of [[-edge, -100], [-92, -4], [4, 92], [100, edge]]) {
    colliders.push({ minX: 216, maxX: edge, minZ, maxZ });
  }
  for (const pierZ of [-96, 0, 96]) {
    colliders.push({ minX: 250, maxX: edge, minZ: pierZ - 4, maxZ: pierZ + 4 });
  }

  return { colliders, clouds, waterTexture: waterTex, group };
}

/** Push a circle (x, z, radius) out of every solid AABB it overlaps. Mutates `pos`. */
export function resolveCircleCollisions(pos, radius, colliders) {
  for (const box of colliders) {
    const nearestX = Math.max(box.minX, Math.min(pos.x, box.maxX));
    const nearestZ = Math.max(box.minZ, Math.min(pos.z, box.maxZ));
    const dx = pos.x - nearestX;
    const dz = pos.z - nearestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq >= radius * radius) continue;
    if (distSq > 1e-6) {
      const dist = Math.sqrt(distSq);
      pos.x = nearestX + (dx / dist) * radius;
      pos.z = nearestZ + (dz / dist) * radius;
    } else {
      // Centre inside the box: push out along the smallest penetration axis.
      const pushLeft = pos.x - box.minX + radius;
      const pushRight = box.maxX - pos.x + radius;
      const pushBack = pos.z - box.minZ + radius;
      const pushFront = box.maxZ - pos.z + radius;
      const min = Math.min(pushLeft, pushRight, pushBack, pushFront);
      if (min === pushLeft) pos.x = box.minX - radius;
      else if (min === pushRight) pos.x = box.maxX + radius;
      else if (min === pushBack) pos.z = box.minZ - radius;
      else pos.z = box.maxZ + radius;
    }
  }
}

/** True when the point is inside any solid AABB (used for spawn checks). */
export function pointIsSolid(x, z, colliders) {
  return colliders.some((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);
}

/** True when no wall stands between (x1, z1) and (x2, z2) — sampled every 1.5 m. */
export function hasLineOfSight(x1, z1, x2, z2, colliders) {
  const dist = Math.hypot(x2 - x1, z2 - z1);
  const steps = Math.max(1, Math.ceil(dist / 1.5));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (pointIsSolid(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, colliders)) return false;
  }
  return true;
}
