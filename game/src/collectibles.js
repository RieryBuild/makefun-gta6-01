// Collectibles: ten Sunset Postcards hidden around Solmar Bay.
// One job: a reason to explore the whole map — each postcard is a small
// spinning card on a gold light beam, worth $200 when Dana walks or drives
// through it. Collected ids persist in the save file.

import { COLLECTIBLE_REWARD } from './config.js';

/** The ten postcard spots — all on open ground (roads, beach, piers, park). */
export const POSTCARD_SPOTS = [
  { x: 0, z: 205, name: 'South Beach' },
  { x: 245, z: 0, name: 'Middle Pier' },
  { x: 72, z: 72, name: 'Central Park' },
  { x: 210, z: -60, name: 'Docks Apron' },
  { x: 144, z: 144, name: 'Beach House Corner' },
  { x: -144, z: -144, name: 'North-West Corner' },
  { x: -144, z: 144, name: 'South-West Corner' },
  { x: 144, z: -144, name: 'North-East Corner' },
  { x: -72, z: -96, name: 'Hospital Row' },
  { x: -150, z: 200, name: 'West Beach' },
];

const PICKUP_RADIUS = 3;

/** Paint the postcard face: a sunset over the bay, drawn on a canvas. */
function makePostcardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 176;
  const ctx = canvas.getContext('2d');
  // Sunset sky.
  const sky = ctx.createLinearGradient(0, 0, 0, 120);
  sky.addColorStop(0, '#2b1d5e');
  sky.addColorStop(0.45, '#c94b7c');
  sky.addColorStop(0.8, '#ff9e5e');
  sky.addColorStop(1, '#ffd23a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 128, 120);
  // Sun.
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.arc(64, 92, 22, 0, Math.PI * 2);
  ctx.fill();
  // Sea.
  ctx.fillStyle = '#2e7f9e';
  ctx.fillRect(0, 120, 128, 24);
  ctx.fillStyle = '#7fc4d8';
  for (let i = 0; i < 4; i += 1) ctx.fillRect(10 + i * 30, 128 + (i % 2) * 6, 18, 3);
  // Palm silhouette.
  ctx.strokeStyle = '#1d1d2e';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(20, 120);
  ctx.quadraticCurveTo(28, 88, 40, 72);
  ctx.stroke();
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i += 1) {
    const angle = Math.PI * (0.15 + i * 0.18);
    ctx.beginPath();
    ctx.moveTo(40, 72);
    ctx.lineTo(40 + Math.cos(angle) * 22, 72 - Math.sin(angle) * 16);
    ctx.stroke();
  }
  // Caption band.
  ctx.fillStyle = '#fdf6e3';
  ctx.fillRect(0, 144, 128, 32);
  ctx.fillStyle = '#c94b7c';
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMAR BAY', 64, 166);
  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

export class CollectiblesManager {
  constructor(scene) {
    this.scene = scene;
    this.texture = makePostcardTexture();
    this.cards = POSTCARD_SPOTS.map((spot, i) => {
      const group = new THREE.Group();
      // The card itself: a thin box with the sunset on both faces.
      const face = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.6 });
      const edge = new THREE.MeshStandardMaterial({ color: 0xfdf6e3, roughness: 0.6 });
      const card = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.95, 0.06),
        [edge, edge, edge, edge, face, face],
      );
      card.position.y = 1.6;
      // A gold beam so the card reads from across the street.
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 14, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
      );
      beam.position.y = 7;
      group.add(card, beam);
      group.position.set(spot.x, 0, spot.z);
      scene.add(group);
      return { id: i, spot, group, card, collected: false, bobPhase: i * 0.7 };
    });
    this.collectedCount = 0;
  }

  /** Postcards still out there, for the minimap. */
  remaining() {
    return this.cards.filter((c) => !c.collected).map((c) => ({ x: c.spot.x, z: c.spot.z }));
  }

  collectedIds() {
    return this.cards.filter((c) => c.collected).map((c) => c.id);
  }

  /** Re-hide the postcards a save says are already collected. */
  restore(ids) {
    for (const id of ids || []) {
      const card = this.cards[id];
      if (card && !card.collected) {
        card.collected = true;
        card.group.visible = false;
        this.collectedCount += 1;
      }
    }
  }

  /** Spin, bob, and pick up any card Dana is close to. */
  update(dt, context) {
    for (const card of this.cards) {
      if (card.collected) continue;
      card.bobPhase += dt;
      card.card.rotation.y += dt * 1.2;
      card.card.position.y = 1.6 + Math.sin(card.bobPhase * 1.6) * 0.25;
      const d = Math.hypot(context.playerX - card.spot.x, context.playerZ - card.spot.z);
      if (d < PICKUP_RADIUS) {
        card.collected = true;
        card.group.visible = false;
        this.collectedCount += 1;
        context.onPickup?.(card, COLLECTIBLE_REWARD, this.collectedCount, this.cards.length);
      }
    }
  }
}
