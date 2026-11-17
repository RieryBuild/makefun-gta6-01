// Minimap: a top-down canvas of Solmar Bay in the HUD's corner.
// One job: draw the static city once (roads, water, sand, park, docks),
// then every frame add the live blips — the player arrow, police, enemies
// and the pulsing mission waypoint.

import { CITY_EDGE, GARAGE, ROAD_LINES, WORLD_EDGE } from './config.js';

const VIEW = 520; // world metres across the whole map (city + beach + piers)

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = canvas.width;
    this.staticLayer = document.createElement('canvas');
    this.staticLayer.width = canvas.width;
    this.staticLayer.height = canvas.height;
    this.paintStaticLayer();
  }

  /** World (x, z) to map pixels. North (-z) is up. */
  toMap(x, z) {
    const s = this.size / VIEW;
    return { x: this.size / 2 + x * s, y: this.size / 2 + z * s };
  }

  /** The city, painted once: water, sand, roads, park, docks, blocks. */
  paintStaticLayer() {
    const ctx = this.staticLayer.getContext('2d');
    const s = this.size / VIEW;
    // Sea.
    ctx.fillStyle = '#1d5a78';
    ctx.fillRect(0, 0, this.size, this.size);
    // Land: everything up to the waterline (south z > 216, east x > 216).
    const land = this.toMap(-WORLD_EDGE, -WORLD_EDGE);
    ctx.fillStyle = '#2e4030';
    ctx.fillRect(land.x, land.y, (216 + WORLD_EDGE) * s, (216 + WORLD_EDGE) * s);
    // Beach sand (south) + dock aprons (east).
    ctx.fillStyle = '#c8b078';
    const sand = this.toMap(-WORLD_EDGE, 176);
    ctx.fillRect(sand.x, sand.y, (216 + WORLD_EDGE) * s, 40 * s);
    ctx.fillStyle = '#5a5a58';
    const docks = this.toMap(176, -WORLD_EDGE);
    ctx.fillRect(docks.x, docks.y, 40 * s, (216 + WORLD_EDGE) * s);
    // City blocks.
    ctx.fillStyle = '#3a4a3e';
    for (let bx = -4; bx <= 3; bx += 1) {
      for (let bz = -4; bz <= 3; bz += 1) {
        const p = this.toMap(bx * 48 + 7, bz * 48 + 7);
        ctx.fillRect(p.x, p.y, 34 * s, 34 * s);
      }
    }
    // Central park.
    ctx.fillStyle = '#4a8a3a';
    const park = this.toMap(48 + 7, 48 + 7);
    ctx.fillRect(park.x, park.y, 34 * s, 34 * s);
    // Roads.
    ctx.strokeStyle = '#8a8a86';
    ctx.lineWidth = Math.max(2, 14 * s);
    for (const line of ROAD_LINES) {
      const a = this.toMap(-CITY_EDGE - 8, line);
      const b = this.toMap(CITY_EDGE + 8, line);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const c = this.toMap(line, -CITY_EDGE - 8);
      const d = this.toMap(line, CITY_EDGE + 8);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }
    // Piers.
    ctx.strokeStyle = '#a8845c';
    ctx.lineWidth = Math.max(2, 8 * s);
    for (const pierZ of [-96, 0, 96]) {
      const a = this.toMap(192, pierZ);
      const b = this.toMap(250, pierZ);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Garage marker.
    const g = this.toMap(GARAGE.x, GARAGE.z);
    ctx.fillStyle = '#7ddb4a';
    ctx.fillRect(g.x - 3, g.y - 3, 6, 6);
  }

  /**
   * Draw one frame: the static city + live blips.
   * `view` is { playerX, playerZ, heading, waypoint, police, enemies, collectibles, time }.
   */
  draw(view) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size, this.size);
    ctx.drawImage(this.staticLayer, 0, 0);
    // Mission waypoint: a pulsing yellow diamond.
    if (view.waypoint) {
      const p = this.toMap(view.waypoint.x, view.waypoint.z);
      const pulse = 5 + Math.sin(view.time * 5) * 1.5;
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - pulse);
      ctx.lineTo(p.x + pulse, p.y);
      ctx.lineTo(p.x, p.y + pulse);
      ctx.lineTo(p.x - pulse, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Postcards still out there: small gold dots.
    ctx.fillStyle = '#ffd23a';
    for (const card of view.collectibles || []) {
      const p = this.toMap(card.x, card.z);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Enemies: red dots.
    ctx.fillStyle = '#ff3a3a';
    for (const enemy of view.enemies || []) {
      const p = this.toMap(enemy.x, enemy.z);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police: flashing blue dots.
    const policeOn = Math.floor(view.time * 3) % 2 === 0;
    ctx.fillStyle = policeOn ? '#3a8aff' : '#a8d0ff';
    for (const blip of view.police || []) {
      const p = this.toMap(blip.x, blip.z);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player: a white arrow rotated to the heading.
    const p = this.toMap(view.playerX, view.playerZ);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.PI - view.heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
