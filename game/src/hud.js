// HUD: every DOM overlay the player reads — cash, health, wanted stars,
// speed, ammo, objectives, banners, dialogue, prompts and end screens.
// One job: the game logic calls these setters; this file owns the DOM.

export class Hud {
  constructor() {
    this.el = {};
    for (const id of [
      'cash', 'goal', 'postcards', 'health-fill', 'health-text', 'stars', 'speed', 'speed-unit', 'ammo',
      'objective', 'mission-name', 'banner', 'banner-title', 'banner-text',
      'dialogue', 'dialogue-speaker', 'dialogue-text', 'crosshair', 'prompt',
      'damage-flash', 'arrest-wrap', 'arrest-fill', 'wasted', 'busted',
      'start-screen', 'pause-menu', 'hint', 'toast',
    ]) {
      this.el[id] = document.getElementById(id);
    }
    this.bannerTimer = 0;
    this.dialogueTimer = 0;
    this.toastTimer = 0;
    this.hitmarkerTimer = 0;
  }

  setCash(cash, goal) {
    this.el.cash.textContent = `$${Math.floor(cash).toLocaleString('en-US')}`;
    if (goal) {
      const pct = Math.min(100, Math.floor((cash / goal) * 100));
      this.el.goal.textContent = `SAVE THE GARAGE — $${goal.toLocaleString('en-US')} GOAL · ${pct}%`;
      this.el.goal.classList.toggle('done', cash >= goal);
    }
  }

  /** The postcard count (found / total) in the status panel. */
  setPostcards(found, total) {
    this.el.postcards.textContent = `✉ POSTCARDS ${found} / ${total}`;
  }

  setHealth(health) {
    const pct = Math.max(0, Math.min(100, health));
    this.el['health-fill'].style.width = `${pct}%`;
    this.el['health-fill'].style.background = pct > 50 ? '#7ddb4a' : pct > 25 ? '#f2c832' : '#e84a3a';
    this.el['health-text'].textContent = `${Math.ceil(pct)}`;
  }

  setWanted(stars) {
    let html = '';
    for (let i = 0; i < 5; i += 1) {
      html += `<span class="star ${i < stars ? 'lit' : ''}">★</span>`;
    }
    this.el.stars.innerHTML = html;
  }

  setSpeed(kmh, inCar) {
    this.el.speed.textContent = inCar ? `${Math.round(kmh)}` : '';
    this.el['speed-unit'].textContent = inCar ? 'km/h' : '';
  }

  setAmmo(ammo, reloading) {
    this.el.ammo.textContent = reloading ? 'RELOADING…' : `AMMO ${ammo} / 12`;
  }

  setObjective(text) {
    this.el.objective.textContent = text;
  }

  setMissionName(name) {
    this.el['mission-name'].textContent = name;
  }

  /** A big centre banner with a title and a line of text, for seconds. */
  showBanner(title, text, seconds = 4) {
    this.el['banner-title'].textContent = title;
    this.el['banner-text'].textContent = text;
    this.el.banner.classList.add('show');
    this.bannerTimer = seconds;
  }

  hideBanner() {
    this.el.banner.classList.remove('show');
    this.bannerTimer = 0;
  }

  /** A dialogue line from a named speaker, bottom-centre, for 5 seconds. */
  showDialogue(speaker, text) {
    this.el['dialogue-speaker'].textContent = speaker;
    this.el['dialogue-text'].textContent = text;
    this.el.dialogue.classList.add('show');
    this.dialogueTimer = 5;
  }

  /** A small one-line toast (pickups, saves, hints). */
  showToast(text, seconds = 3) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    this.toastTimer = seconds;
  }

  /** A context prompt ("Press E — …") above the crosshair. */
  showPrompt(text) {
    this.el.prompt.textContent = text;
    this.el.prompt.classList.add('show');
  }

  hidePrompt() {
    this.el.prompt.classList.remove('show');
  }

  setCrosshairVisible(visible) {
    this.el.crosshair.classList.toggle('show', visible);
  }

  /** The crosshair flashes white for a blink when a shot lands. */
  flashHitmarker() {
    this.el.crosshair.classList.add('hit');
    this.hitmarkerTimer = 0.15;
  }

  /** A red vignette flash when Dana takes damage. */
  damageFlash() {
    this.el['damage-flash'].classList.add('show');
    window.setTimeout(() => this.el['damage-flash'].classList.remove('show'), 220);
  }

  /** The arrest progress bar (0..1), hidden at 0. */
  setArrestProgress(p) {
    this.el['arrest-wrap'].classList.toggle('show', p > 0.01);
    this.el['arrest-fill'].style.width = `${Math.max(0, Math.min(1, p)) * 100}%`;
  }

  showWasted() { this.el.wasted.classList.add('show'); }
  showBusted() { this.el.busted.classList.add('show'); }
  hideEndScreens() {
    this.el.wasted.classList.remove('show');
    this.el.busted.classList.remove('show');
  }

  showStart(canContinue) {
    this.el['start-screen'].classList.add('show');
    document.body.classList.add('in-menu');
    const continueBtn = document.getElementById('btn-continue');
    if (continueBtn) continueBtn.style.display = canContinue ? '' : 'none';
  }

  hideStart() {
    this.el['start-screen'].classList.remove('show');
    document.body.classList.remove('in-menu');
  }
  showPause(show) { this.el['pause-menu'].classList.toggle('show', show); }
  setHintVisible(visible) { this.el.hint.classList.toggle('show', visible); }

  /** Tick the banner / dialogue / toast timers. */
  update(dt) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.el.banner.classList.remove('show');
    }
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.el.dialogue.classList.remove('show');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.classList.remove('show');
    }
    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer -= dt;
      if (this.hitmarkerTimer <= 0) this.el.crosshair.classList.remove('hit');
    }
  }
}
