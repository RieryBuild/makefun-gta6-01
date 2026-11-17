// Sound: everything synthesised with WebAudio, no audio files.
// One job: engine hum, police sirens, gunshots, UI blips and jingles —
// all generated from oscillators and filtered noise, started only after
// the player clicks (autoplay policy) and mutable with M.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineNodes = null;
    this.sirenNodes = null;
    this.noiseBuffer = null;
  }

  /** Create the context on the first user gesture; safe to call twice. */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    // One second of white noise, reused by every burst sound.
    const length = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    this.startEngineLoop();
    this.startSirenLoop();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  /** The engine: two detuned saws through a lowpass, pitch follows speed. */
  startEngineLoop() {
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 55;
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 110;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc1.start();
    osc2.start();
    this.engineNodes = { osc1, osc2, filter, gain };
  }

  /** speedNorm 0..1; silent on foot. */
  setEngine(speedNorm, running) {
    if (!this.engineNodes) return;
    const { osc1, osc2, filter, gain } = this.engineNodes;
    const now = this.ctx.currentTime;
    const target = running ? 0.05 + speedNorm * 0.09 : 0;
    gain.gain.setTargetAtTime(target, now, 0.1);
    osc1.frequency.setTargetAtTime(50 + speedNorm * 130, now, 0.1);
    osc2.frequency.setTargetAtTime(100 + speedNorm * 260, now, 0.1);
    filter.frequency.setTargetAtTime(350 + speedNorm * 900, now, 0.1);
  }

  /** The siren: a triangle wave swept up and down by an LFO. */
  startSirenLoop() {
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 850;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.7;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 220;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    lfo.start();
    this.sirenNodes = { gain };
  }

  setSiren(on) {
    if (!this.sirenNodes) return;
    this.sirenNodes.gain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.2);
  }

  /** A noise burst + a low thump: one gunshot. */
  gunshot() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(now);
    noise.stop(now + 0.15);
    const thump = this.ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(120, now);
    thump.frequency.exponentialRampToValueAtTime(45, now + 0.1);
    const thumpGain = this.ctx.createGain();
    thumpGain.gain.setValueAtTime(0.5, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    thump.connect(thumpGain);
    thumpGain.connect(this.master);
    thump.start(now);
    thump.stop(now + 0.13);
  }

  /** A dull filtered thud for crashes; `strength` 0..1. */
  crash(strength) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25 + strength * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(now);
    noise.stop(now + 0.26);
  }

  /** Two clicks: a reload. */
  reload() {
    if (!this.ctx) return;
    this.blip(660, 0.05, 0.12);
    window.setTimeout(() => this.blip(440, 0.06, 0.12), 160);
  }

  /** A short UI blip. */
  blip(frequency = 880, duration = 0.07, volume = 0.12) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = frequency;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /** A four-note rising jingle for mission complete. */
  missionComplete() {
    if (!this.ctx) return;
    [523, 659, 784, 1047].forEach((freq, i) => {
      window.setTimeout(() => this.blip(freq, 0.16, 0.16), i * 130);
    });
  }

  /** A falling two-tone for wasted / busted. */
  failSting() {
    if (!this.ctx) return;
    this.blip(392, 0.25, 0.18);
    window.setTimeout(() => this.blip(262, 0.4, 0.18), 220);
  }
}
