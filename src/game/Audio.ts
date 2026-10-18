// All sound is synthesised with WebAudio so the game ships with no audio assets.

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  crowdGain!: GainNode;
  crowdFilter!: BiquadFilterNode;
  noise!: AudioBuffer;
  muted = false;
  private crowdOn = false;

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.value = m ? 0 : 0.7;
  }

  private noiseBurst(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'lowpass', delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', slide = 0, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  hit() {
    if (!this.ensure()) return;
    this.noiseBurst(0.12, 1800, 0.8, 0.9, 'bandpass');
    this.tone(140, 0.12, 0.6, 'sine', 0.5);
  }
  crunch() {
    if (!this.ensure()) return;
    this.noiseBurst(0.2, 2500, 0.5, 0.9, 'bandpass');
    this.noiseBurst(0.35, 400, 1, 0.9);
    this.tone(90, 0.25, 0.8, 'sine', 0.5);
  }
  thud() {
    if (!this.ensure()) return;
    this.noiseBurst(0.25, 300, 1, 0.8);
    this.tone(70, 0.3, 0.7, 'sine', 0.6);
  }
  slam() {
    if (!this.ensure()) return;
    // big mat slap + ring rattle
    this.noiseBurst(0.45, 500, 0.7, 1.2);
    this.noiseBurst(0.12, 3000, 0.6, 0.6, 'bandpass');
    this.tone(55, 0.5, 1.0, 'sine', 0.5);
    this.noiseBurst(0.5, 180, 4, 0.5, 'bandpass', 0.05);
  }
  whoosh() {
    if (!this.ensure()) return;
    this.noiseBurst(0.18, 900, 2, 0.25, 'bandpass');
  }
  rope() {
    if (!this.ensure()) return;
    this.tone(95, 0.35, 0.35, 'triangle', 0.7);
    this.noiseBurst(0.15, 600, 3, 0.3, 'bandpass');
  }
  clang() {
    if (!this.ensure()) return;
    for (const f of [420, 663, 1011, 1580]) this.tone(f, 0.6, 0.18, 'square', 0.98);
    this.noiseBurst(0.2, 4000, 0.7, 0.6, 'highpass');
  }
  slap() {
    if (!this.ensure()) return;
    this.noiseBurst(0.1, 1500, 0.8, 1.0, 'bandpass');
    this.tone(180, 0.08, 0.5, 'sine', 0.6);
  }
  bell(times = 1) {
    if (!this.ensure()) return;
    for (let i = 0; i < times; i++) {
      const d = i * 0.28;
      for (const [f, g] of [
        [880, 0.35],
        [1760, 0.15],
        [2637, 0.1],
        [1320, 0.12],
      ] as const)
        this.tone(f, 1.6, g, 'sine', 0.995, d);
    }
  }
  /** Crowd reaction: a filtered noise swell. */
  pop(intensity = 1) {
    if (!this.ensure() || !this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 0.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.25 * intensity + 0.01, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 2);
  }
  startCrowd() {
    if (!this.ensure() || !this.ctx || this.crowdOn) return;
    this.crowdOn = true;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    this.crowdFilter = this.ctx.createBiquadFilter();
    this.crowdFilter.type = 'bandpass';
    this.crowdFilter.frequency.value = 700;
    this.crowdFilter.Q.value = 0.5;
    this.crowdGain = this.ctx.createGain();
    this.crowdGain.gain.value = 0.04;
    src.connect(this.crowdFilter).connect(this.crowdGain).connect(this.master);
    src.start();
  }
  setCrowd(level: number) {
    if (!this.ctx || !this.crowdOn) return;
    const t = this.ctx.currentTime;
    this.crowdGain.gain.setTargetAtTime(0.025 + level * 0.11, t, 0.3);
    this.crowdFilter.frequency.setTargetAtTime(600 + level * 500, t, 0.3);
  }
  click() {
    if (!this.ensure()) return;
    this.tone(660, 0.06, 0.15, 'square', 1.3);
  }
}

export const audio = new AudioEngine();
