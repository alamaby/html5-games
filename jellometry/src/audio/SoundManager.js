export class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.masterGain = null;
    this.lastMorphSoundTime = 0;
    this.lastImpactSoundTime = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.35;
    this.masterGain.connect(this.ctx.destination);
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.35, this.ctx.currentTime);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  playJump() {
    this.init();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Pitch-bend sine wave mimics elastic tension release when the jelly launches upward.
    osc.type = 'sine';
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.28);

    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(85, now);
    subOsc.frequency.exponentialRampToValueAtTime(240, now + 0.18);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.45, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    subOsc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + 0.31);
    subOsc.stop(now + 0.31);
  }

  playMorph(morphRatio = 0) {
    this.init();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    // Throttle rapid wheel/key morph triggers to prevent oscillator stacking.
    if (now - this.lastMorphSoundTime < 0.065) return;
    this.lastMorphSoundTime = now;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    const baseFreq = 260 + morphRatio * 110;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(110, baseFreq * 1.25), now + 0.08);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600 + morphRatio * 250, now);
    filter.Q.setValueAtTime(4.5, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.095);
  }

  playBounce() {
    this.init();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    // FM wobble gives high-restitution slime pads a distinct springy resonance over normal jumps.
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.42);

    mod.type = 'sine';
    mod.frequency.setValueAtTime(28, now);
    modGain.gain.setValueAtTime(45, now);
    modGain.gain.exponentialRampToValueAtTime(4, now + 0.4);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.55, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);

    mod.connect(modGain);
    modGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    mod.start(now);
    osc.stop(now + 0.45);
    mod.stop(now + 0.45);
  }

  playImpact(intensity = 0.5) {
    this.init();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    if (now - this.lastImpactSoundTime < 0.08) return;
    this.lastImpactSoundTime = now;

    const clamped = Math.min(1, Math.max(0.15, intensity));
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(135 + clamped * 45, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.14);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.38 * clamped, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.17);
  }

  playCheckpoint() {
    this.init();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.065;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.32, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(start);
      osc.stop(start + 0.3);
    });
  }

  playSplash() {
    this.init();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Descending slide + bubble pop signals out-of-bounds fall before checkpoint reform.
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.26);
    osc.frequency.setValueAtTime(280, now + 0.27);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.36);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.42, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.39);
  }

  playVictory() {
    this.init();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    // Major fanfare cadence rewards crossing the finish arch.
    const sequence = [
      { freq: 523.25, delay: 0.0, duration: 0.14 },
      { freq: 659.25, delay: 0.11, duration: 0.14 },
      { freq: 783.99, delay: 0.22, duration: 0.14 },
      { freq: 1046.5, delay: 0.34, duration: 0.45 },
      { freq: 783.99, delay: 0.52, duration: 0.15 },
      { freq: 1046.5, delay: 0.66, duration: 0.65 }
    ];

    sequence.forEach(({ freq, delay, duration }) => {
      const start = now + delay;
      const osc = this.ctx.createOscillator();
      const harm = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      harm.type = 'sine';
      harm.frequency.setValueAtTime(freq * 1.5, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      harm.connect(gain);
      gain.connect(this.masterGain);

      osc.start(start);
      harm.start(start);
      osc.stop(start + duration + 0.02);
      harm.stop(start + duration + 0.02);
    });
  }

  playUiTick(pitch = 620) {
    this.init();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.3, now + 0.045);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.055);
  }
}
