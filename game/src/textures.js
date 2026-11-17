// Procedural canvas textures for Solmar Bay.
// One job: every surface the player can see gets a painted texture — no flat
// colour is left on a major surface. All textures are drawn on offscreen
// canvases at load time, so the game needs no image files and no network.

import { BLOCK_MAX, BLOCK_MIN, CITY_EDGE, FACADE_PALETTES, ROAD_LINES, ROAD_SPACING, ROAD_WIDTH, WORLD_EDGE } from './config.js';

/** Draw on a fresh canvas and return it as a colour-space canvas texture. */
function canvasTexture(width, height, draw, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = 8;
  return texture;
}

/** Speckle noise over a base fill, for asphalt, concrete and sand. */
function speckle(ctx, width, height, colours, count, size, rng) {
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = colours[(rng.next() * colours.length) | 0];
    ctx.fillRect(rng.next() * width, rng.next() * height, size, size);
  }
}

/**
 * One building facade: a stucco wall with a grid of windows (some lit, some
 * dark, a few with blinds), a trim band between floors and a shopfront band
 * along the bottom. `palette` is one entry of FACADE_PALETTES.
 */
export function makeFacadeTexture(palette, floors, rng) {
  const cols = 5;
  const cellW = 256 / cols;
  const cellH = 256 / Math.max(2, Math.min(floors, 8));
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = palette.base;
    ctx.fillRect(0, 0, 256, 256);
    speckle(ctx, 256, 256, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.06)'], 500, 2, rng);
    // Shopfront band along the ground floor.
    ctx.fillStyle = palette.trim;
    ctx.fillRect(0, 232, 256, 24);
    ctx.fillStyle = 'rgba(40,60,80,0.85)';
    ctx.fillRect(10, 236, 90, 16);
    ctx.fillRect(156, 236, 90, 16);
    ctx.fillStyle = '#ffd977';
    ctx.fillRect(10, 236, 90, 3);
    ctx.fillRect(156, 236, 90, 3);
    for (let row = 0; row < Math.max(2, Math.min(floors, 8)); row += 1) {
      const y = row * cellH;
      ctx.fillStyle = palette.trim;
      ctx.fillRect(0, y + cellH - 3, 256, 3);
      for (let col = 0; col < cols; col += 1) {
        const x = col * cellW;
        const lit = rng.chance(0.28);
        const blind = !lit && rng.chance(0.3);
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(x + 6, y + 6, cellW - 12, cellH - 14);
        ctx.fillStyle = lit ? '#ffe9a8' : blind ? '#c9c2b2' : palette.glass;
        ctx.fillRect(x + 8, y + 8, cellW - 16, cellH - 18);
        if (!lit && !blind) {
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.beginPath();
          ctx.moveTo(x + 8, y + cellH - 10);
          ctx.lineTo(x + cellW - 16, y + 8);
          ctx.lineTo(x + cellW - 8, y + 8);
          ctx.lineTo(x + 16, y + cellH - 10);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x + cellW / 2 - 1, y + 8, 2, cellH - 18);
      }
    }
  });
}

/** A flat roof: gravel grey with vents, an AC unit and a darker edge. */
export function makeRoofTexture(rng) {
  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#8d8d88';
    ctx.fillRect(0, 0, 128, 128);
    speckle(ctx, 128, 128, ['#7a7a75', '#9a9a95', '#6e6e69'], 700, 2, rng);
    ctx.fillStyle = '#6e6e69';
    ctx.fillRect(0, 0, 128, 6);
    ctx.fillRect(0, 122, 128, 6);
    ctx.fillRect(0, 0, 6, 128);
    ctx.fillRect(122, 0, 6, 128);
    ctx.fillStyle = '#a8a8a2';
    ctx.fillRect(20 + rng.range(0, 40), 20 + rng.range(0, 40), 34, 24);
    ctx.fillStyle = '#5d5d58';
    ctx.beginPath();
    ctx.arc(90, 88, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7d7d78';
    ctx.beginPath();
    ctx.arc(90, 88, 6, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Subtle paint sheen for car bodies: noise + a soft highlight, tinted by the material colour. */
export function makePaintTexture(rng) {
  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 128);
    const gradient = ctx.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(0.45, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    speckle(ctx, 128, 128, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.08)'], 350, 1, rng);
  });
}

/**
 * The whole city ground in one 2048px canvas: grass base, asphalt streets
 * with dashed centrelines and edge lines, crosswalks at every intersection,
 * concrete sidewalks around every block, a parking lot, park paths, the
 * beach sand strip and the dock aprons. One texture keeps every marking
 * exactly aligned with the roads the cars drive on.
 */
export function makeGroundTexture(rng) {
  const size = 2048;
  const span = WORLD_EDGE * 2;
  const px = (metres) => ((metres + WORLD_EDGE) / span) * size;
  const scale = size / span;
  return canvasTexture(size, size, (ctx) => {
    // Base: dry coastal grass.
    ctx.fillStyle = '#7fae62';
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, size, ['#74a258', '#8abb6e', '#6d9a52'], 9000, 3, rng);
    // Beach sand along the south edge.
    ctx.fillStyle = '#e8d49a';
    ctx.fillRect(0, px(176), size, px(216) - px(176));
    // Dock aprons along the east edge.
    ctx.fillStyle = '#9a958c';
    ctx.fillRect(px(176), 0, px(216) - px(176), size);
    // Sidewalks: light concrete slabs around every block.
    ctx.fillStyle = '#b9b3a6';
    for (let bx = BLOCK_MIN; bx <= BLOCK_MAX; bx += 1) {
      for (let bz = BLOCK_MIN; bz <= BLOCK_MAX; bz += 1) {
        const x0 = bx * ROAD_SPACING - 2;
        const z0 = bz * ROAD_SPACING - 2;
        ctx.fillRect(px(x0), px(z0), (ROAD_SPACING + 4) * scale, (ROAD_SPACING + 4) * scale);
      }
    }
    // Block interiors: pale concrete lots the buildings sit on.
    ctx.fillStyle = '#a9a294';
    for (let bx = BLOCK_MIN; bx <= BLOCK_MAX; bx += 1) {
      for (let bz = BLOCK_MIN; bz <= BLOCK_MAX; bz += 1) {
        const x0 = bx * ROAD_SPACING + ROAD_WIDTH / 2 + 1.5;
        const z0 = bz * ROAD_SPACING + ROAD_WIDTH / 2 + 1.5;
        const w = ROAD_SPACING - ROAD_WIDTH - 3;
        ctx.fillRect(px(x0), px(z0), w * scale, w * scale);
      }
    }
    // Asphalt streets.
    ctx.fillStyle = '#3d3d40';
    for (const line of ROAD_LINES) {
      ctx.fillRect(px(-CITY_EDGE - 8), px(line - ROAD_WIDTH / 2), (CITY_EDGE * 2 + 16) * scale, ROAD_WIDTH * scale);
      ctx.fillRect(px(line - ROAD_WIDTH / 2), px(-CITY_EDGE - 8), ROAD_WIDTH * scale, (CITY_EDGE * 2 + 16) * scale);
    }
    speckle(ctx, size, size, ['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.12)'], 6000, 2, rng);
    // Centre dashes (yellow) and edge lines (white) on every street.
    ctx.fillStyle = '#e8c832';
    for (const line of ROAD_LINES) {
      for (let d = -CITY_EDGE; d < CITY_EDGE; d += 8) {
        ctx.fillRect(px(d), px(line - 0.25), 4 * scale, 0.5 * scale);
        ctx.fillRect(px(line - 0.25), px(d), 0.5 * scale, 4 * scale);
      }
    }
    ctx.fillStyle = 'rgba(240,240,240,0.85)';
    for (const line of ROAD_LINES) {
      ctx.fillRect(px(-CITY_EDGE - 8), px(line - ROAD_WIDTH / 2 + 0.4), (CITY_EDGE * 2 + 16) * scale, 0.35 * scale);
      ctx.fillRect(px(-CITY_EDGE - 8), px(line + ROAD_WIDTH / 2 - 0.75), (CITY_EDGE * 2 + 16) * scale, 0.35 * scale);
      ctx.fillRect(px(line - ROAD_WIDTH / 2 + 0.4), px(-CITY_EDGE - 8), 0.35 * scale, (CITY_EDGE * 2 + 16) * scale);
      ctx.fillRect(px(line + ROAD_WIDTH / 2 - 0.75), px(-CITY_EDGE - 8), 0.35 * scale, (CITY_EDGE * 2 + 16) * scale);
    }
    // Crosswalk stripes at every intersection.
    ctx.fillStyle = 'rgba(245,245,245,0.9)';
    for (const x of ROAD_LINES) {
      for (const z of ROAD_LINES) {
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(px(x + i * 1.6 - 0.6), px(z - ROAD_WIDTH / 2 - 1.5), 1.2 * scale, 3 * scale);
          ctx.fillRect(px(x + i * 1.6 - 0.6), px(z + ROAD_WIDTH / 2 - 1.5), 1.2 * scale, 3 * scale);
          ctx.fillRect(px(x - ROAD_WIDTH / 2 - 1.5), px(z + i * 1.6 - 0.6), 3 * scale, 1.2 * scale);
          ctx.fillRect(px(x + ROAD_WIDTH / 2 - 1.5), px(z + i * 1.6 - 0.6), 3 * scale, 1.2 * scale);
        }
      }
    }
  });
}

/** Animated-able water: deep blue with soft wave streaks (offset scrolls in the loop). */
export function makeWaterTexture(rng) {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#2e7f9e';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 90; i += 1) {
      ctx.strokeStyle = `rgba(255,255,255,${0.05 + rng.next() * 0.12})`;
      ctx.lineWidth = 1 + rng.next() * 2;
      const y = rng.next() * 256;
      const x = rng.next() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 20, y - 4, x + 44, y);
      ctx.stroke();
    }
    for (let i = 0; i < 40; i += 1) {
      ctx.strokeStyle = 'rgba(10,60,90,0.25)';
      ctx.lineWidth = 2 + rng.next() * 3;
      const y = rng.next() * 256;
      const x = rng.next() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 30 + rng.next() * 30, y);
      ctx.stroke();
    }
  }, 24, 24);
}

/** A face: skin tone, brows, eyes with pupils, nose shading and a mouth. */
export function makeFaceTexture(skin, hair, rng) {
  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = skin;
    ctx.fillRect(0, 0, 128, 128);
    // Hair fringe along the top.
    ctx.fillStyle = hair;
    ctx.fillRect(0, 0, 128, 26);
    ctx.beginPath();
    ctx.moveTo(0, 26);
    for (let x = 0; x <= 128; x += 16) ctx.lineTo(x, 26 + (rng.chance(0.5) ? 10 : 4));
    ctx.lineTo(128, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    // Brows.
    ctx.fillStyle = hair;
    ctx.fillRect(26, 46, 24, 6);
    ctx.fillRect(78, 46, 24, 6);
    // Eyes: white, iris, pupil.
    for (const ex of [30, 82]) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ex, 56, 18, 12);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(ex + 6, 57, 8, 10);
      ctx.fillStyle = '#000000';
      ctx.fillRect(ex + 8, 59, 4, 6);
    }
    // Nose shading + mouth.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(60, 72, 8, 14);
    ctx.fillStyle = '#8a4a3a';
    ctx.fillRect(48, 96, 32, 7);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(48, 96, 32, 2);
  });
}

/**
 * A torso: shirt colour with a vest (or jacket) in a second colour, drawn as
 * two panels with a centre opening and a collar — the colour separation that
 * keeps a character from reading as one flat box.
 */
export function makeTorsoTexture(shirt, vest) {
  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = shirt;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < 128; y += 16) ctx.fillRect(0, y, 128, 2);
    // Vest panels.
    ctx.fillStyle = vest;
    ctx.fillRect(6, 14, 48, 108);
    ctx.fillRect(74, 14, 48, 108);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(10, 18, 6, 100);
    ctx.fillRect(78, 18, 6, 100);
    // Pockets + zip.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(14, 78, 32, 20);
    ctx.fillRect(82, 78, 32, 20);
    ctx.fillRect(62, 14, 4, 108);
    // Collar.
    ctx.fillStyle = vest;
    ctx.fillRect(40, 0, 48, 14);
  });
}

/** Corrugated shipping container side, for the docks. */
export function makeContainerTexture(colour) {
  return canvasTexture(256, 128, (ctx) => {
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, 256, 128);
    for (let x = 0; x < 256; x += 16) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x, 0, 5, 128);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x + 8, 0, 4, 128);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, 256, 6);
    ctx.fillRect(0, 122, 256, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('SOLMAR', 96, 70);
  });
}

/** Weathered wooden planks, for the piers. */
export function makeWoodTexture(rng) {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#8a6b48';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) {
      ctx.fillStyle = y % 64 === 0 ? '#7d6040' : '#937552';
      ctx.fillRect(0, y, 256, 30);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, y + 30, 256, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 0; i < 6; i += 1) {
        ctx.fillRect(rng.next() * 256, y + 4 + rng.next() * 22, 20 + rng.next() * 40, 1);
      }
    }
  }, 4, 8);
}

/** One shared set of facade textures, built once per city seed. */
export function makeFacadeSet(rng) {
  return FACADE_PALETTES.map((palette) => ({
    low: makeFacadeTexture(palette, 3, rng),
    mid: makeFacadeTexture(palette, 6, rng),
    tall: makeFacadeTexture(palette, 8, rng),
  }));
}
