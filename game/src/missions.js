// Missions and story: five jobs for Rosa's garage.
// One job: run the story — staged objectives with a waypoint beacon,
// dialogue from Rosa and Dana, cash rewards, and progression that unlocks
// the next job. Free roam continues after the final job.

import { DOCKS, GARAGE_FORECOURT, HIDEOUT } from './config.js';

/** The story, in order. Each mission is stages of goto / enterCar / deliver / eliminate. */
export const MISSIONS = [
  {
    id: 'm1', title: 'First Delivery', reward: 800,
    briefing: 'Rosa: "A parts crate is waiting at the docks warehouse. Pick it up and bring it back — and Dana? Drive like the van is yours. It is."',
    stages: [
      { type: 'goto', x: 168, z: -48, radius: 6, text: 'Pick up the parts crate at the docks warehouse', say: ['Rosa', 'The crate is by the north warehouse. Grab it and come home.'] },
      { type: 'goto', x: GARAGE_FORECOURT.x, z: GARAGE_FORECOURT.z, radius: 7, text: 'Deliver the crate to Rosa\u2019s garage', say: ['Dana', 'One crate, no scratches. Rosa owes me coffee.'] },
    ],
  },
  {
    id: 'm2', title: 'Hot Wheels', reward: 1500,
    briefing: 'Rosa: "The Kings left a sports car by the beach lot — keys in it, because they are idiots. Bring it to me. Try not to bring the cops too."',
    stages: [
      { type: 'goto', x: 8, z: 148, radius: 7, text: 'Find the sports car at the beach lot', say: ['Dana', 'There it is. Cherry red, keys in. Too easy.'] },
      { type: 'enterCar', x: 8, z: 148, text: 'Steal the sports car', say: ['Dana', 'Borrowed. Permanently.'] },
      { type: 'deliverCar', x: GARAGE_FORECOURT.x, z: GARAGE_FORECOURT.z, radius: 8, text: 'Deliver the car to Rosa\u2019s garage', say: ['Rosa', 'Beautiful. The Kings will miss this one.'] },
    ],
  },
  {
    id: 'm3', title: 'Dockside Heat', reward: 2500,
    briefing: 'Rosa: "The Kings sent collectors to the docks to lean on my supplier. Go lean back. Take the rifle — and come home in one piece."',
    stages: [
      { type: 'goto', x: DOCKS.x, z: DOCKS.z, radius: 12, text: 'Reach the docks', say: ['Dana', 'The docks. Time to lean back.'] },
      { type: 'eliminate', count: 4, text: 'Clear the Kings out of the docks', say: ['Dana', 'There they are. Four of them — and the rifle and I say hello.'] },
      { type: 'goto', x: GARAGE_FORECOURT.x, z: GARAGE_FORECOURT.z, radius: 7, text: 'Report back to Rosa\u2019s garage', say: ['Dana', 'Docks are clear. Tell your supplier Rosa says hi.'] },
    ],
  },
  {
    id: 'm4', title: 'The Getaway', reward: 3000,
    briefing: 'Rosa: "The Kings tipped off SBPD — there is a warrant out with your name on it. Get to the beach house and stay out of sight. Do NOT get arrested."',
    stages: [
      { type: 'reachHideout', x: HIDEOUT.x, z: HIDEOUT.z, radius: 8, text: 'Lose the cops — reach the beach house', say: ['Dana', 'Three stars and a beach house. Just another Tuesday.'] },
      { type: 'goto', x: GARAGE_FORECOURT.x, z: GARAGE_FORECOURT.z, radius: 7, text: 'Sneak back to Rosa\u2019s garage', say: ['Rosa', 'The warrant vanished. I know a guy. Go figure.'] },
    ],
  },
  {
    id: 'm5', title: 'Harbor Showdown', reward: 42000,
    briefing: 'Rosa: "Kane himself is at the docks tonight, collecting — and his stash is in the dock office: forty-two thousand of protection money. End this, Dana, and bring the stash home. The garage — and this city — is worth more than his whole crew."',
    stages: [
      { type: 'goto', x: DOCKS.x, z: DOCKS.z, radius: 12, text: 'Reach the docks', say: ['Kane', 'Vega. You walk in here, you do not walk out.'] },
      { type: 'eliminate', count: 5, boss: true, text: 'Take down Kane and his crew', say: ['Dana', 'Kane\u2019s crew first. Then Kane.'] },
      { type: 'goto', x: GARAGE_FORECOURT.x, z: GARAGE_FORECOURT.z, radius: 7, text: 'Come home to Rosa\u2019s garage', say: ['Rosa', 'Fifty thousand? We just bought the whole street, Dana.'] },
    ],
  },
];

// Gang posts for the dock fights: the open apron east of the warehouses,
// so the shootout happens in the open with the piers and water behind it.
const DOCK_SPAWNS = [
  { x: 198, z: -24 }, { x: 204, z: 8 }, { x: 194, z: 30 },
  { x: 208, z: -6 }, { x: 200, z: 44 }, { x: 210, z: 20 },
];

export class MissionManager {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.completedCount = 0;
    this.storyComplete = false;
    this.active = null;      // { def, stageIndex }
    this.markedCar = null;   // the car m2 wants stolen
    this.enemiesToKill = 0;
    this.kills = 0;
    // Waypoint beacon: a light pillar + a floating diamond over the target.
    this.beacon = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 60, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 30;
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1),
      new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0xaa7a00, emissiveIntensity: 0.8 }),
    );
    diamond.position.y = 7;
    this.beacon.add(beam, diamond);
    this.beacon.visible = false;
    scene.add(this.beacon);
  }

  /** The next mission the player has not finished, or null when the story is done. */
  nextMission() {
    return this.completedCount < MISSIONS.length ? MISSIONS[this.completedCount] : null;
  }

  currentStage() {
    return this.active ? this.active.def.stages[this.active.stageIndex] : null;
  }

  objectiveText() {
    if (!this.active) {
      const next = this.nextMission();
      return next ? `Go to Rosa\u2019s garage — next job: ${next.title}` : 'Free roam — Solmar Bay is yours';
    }
    const stage = this.currentStage();
    if (stage.type === 'eliminate') {
      const left = Math.max(0, this.enemiesToKill - this.kills);
      return `${stage.text} (${left} left)`;
    }
    return stage.text;
  }

  waypoint() {
    const stage = this.currentStage();
    if (!stage) return null;
    if (stage.type === 'eliminate') return { x: DOCKS.x, z: DOCKS.z };
    return { x: stage.x, z: stage.z };
  }

  /** Begin the next mission: briefing, first stage, any stage setup. */
  startNext(context) {
    const def = this.nextMission();
    if (!def || this.active) return false;
    this.active = { def, stageIndex: 0 };
    this.kills = 0;
    this.enemiesToKill = 0;
    context.onBanner?.(def.title, def.briefing, 6);
    context.onDialogue?.('Rosa', def.briefing);
    this.setupStage(context);
    return true;
  }

  /** Per-stage setup: spawn enemies, mark the steal car, set the heat. */
  setupStage(context) {
    const stage = this.currentStage();
    if (!stage) return;
    this.placeBeacon();
    if (stage.say) context.onDialogue?.(stage.say[0], stage.say[1]);
    if (stage.type === 'eliminate') {
      const count = stage.count;
      this.enemiesToKill = count;
      this.kills = 0;
      for (let i = 0; i < count; i += 1) {
        const spot = DOCK_SPAWNS[i % DOCK_SPAWNS.length];
        const isBoss = stage.boss === true && i === count - 1;
        context.combat.spawnEnemy(spot.x + this.rng.range(-4, 4), spot.z + this.rng.range(-4, 4), isBoss);
      }
    }
    if (stage.type === 'enterCar') {
      this.markedCar = context.traffic.nearestParkedCar(stage.x, stage.z, 25);
      if (!this.markedCar) {
        // The beach car is gone (stolen in free roam, or driven away):
        // the Kings left another one — park a fresh sports car at the lot
        // so the job can never soft-lock.
        this.markedCar = context.traffic.addParkedCar(stage.x, stage.z, Math.PI / 2, 'sports');
      }
    }
    if (this.active.def.id === 'm4' && this.active.stageIndex === 0) {
      context.police.addWanted(3, context.time);
    }
  }

  placeBeacon() {
    const waypoint = this.waypoint();
    if (!waypoint) {
      this.beacon.visible = false;
      return;
    }
    this.beacon.position.set(waypoint.x, 0, waypoint.z);
    this.beacon.visible = true;
  }

  /** Advance one stage, or finish the mission with its reward. */
  advanceStage(context) {
    this.active.stageIndex += 1;
    if (this.active.stageIndex >= this.active.def.stages.length) {
      this.completeMission(context);
      return;
    }
    this.setupStage(context);
  }

  completeMission(context) {
    const def = this.active.def;
    this.completedCount += 1;
    this.active = null;
    this.markedCar = null;
    this.beacon.visible = false;
    context.onCash?.(def.reward);
    if (this.completedCount >= MISSIONS.length) {
      this.storyComplete = true;
      context.onBanner?.('SOLMAR BAY IS YOURS', 'Kane is finished and the garage is saved — $50,000 raised, the whole street is Dana\u2019s. Free roam — drive, explore, cause trouble.', 7);
    } else {
      context.onBanner?.('MISSION COMPLETE', `${def.title} — $${def.reward.toLocaleString('en-US')} earned`, 4);
      context.onDialogue?.('Rosa', `Job done. Come back to the garage when you are ready for the next one.`);
    }
    context.onMissionComplete?.(def);
  }

  /** The mission failed (wasted, busted): clean up, offer it again. */
  failActive(reason, context) {
    if (!this.active) return;
    const def = this.active.def;
    this.active = null;
    this.markedCar = null;
    this.beacon.visible = false;
    context.combat.clearEnemies();
    context.onBanner?.('MISSION FAILED', `${def.title} — ${reason}. Return to the garage to try again.`, 4);
  }

  /** Called by the world when the player kills a mission enemy. */
  onEnemyKilled() {
    this.kills += 1;
  }

  update(dt, context) {
    this.beacon.children[1].rotation.y += dt * 2;
    if (!this.active) return;
    const stage = this.currentStage();
    const px = context.playerX;
    const pz = context.playerZ;
    if (stage.type === 'goto' || stage.type === 'reachHideout') {
      if (Math.hypot(px - stage.x, pz - stage.z) < stage.radius) {
        if (stage.type === 'reachHideout') context.police.clearWanted();
        this.advanceStage(context);
      }
    } else if (stage.type === 'enterCar') {
      if (context.playerCar && this.markedCar && context.playerCar.parkedRef === this.markedCar) {
        this.advanceStage(context);
      }
    } else if (stage.type === 'deliverCar') {
      if (context.playerCar && this.markedCar && context.playerCar.parkedRef === this.markedCar
        && Math.hypot(px - stage.x, pz - stage.z) < stage.radius) {
        this.advanceStage(context);
      }
    } else if (stage.type === 'eliminate') {
      if (this.kills >= this.enemiesToKill) this.advanceStage(context);
    }
  }
}
