/* Flappy Kitty · звук. Всё синтезируется через Web Audio —
   ни одного аудиофайла, поэтому игра грузится мгновенно. */

const ROOTS = { living: 0, kitchen: 2, party: 5, night: -3, winter: 7, love: 0 };
// аккорды в полутонах от тоники: I – V – vi – IV (а ночью vi – IV – I – V)
const PROG = {
  major: [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0]],
  minor: [[-3, 0, 4], [-7, -3, 0], [0, 4, 7], [-5, -1, 2]],
};
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.sound = true;
    this.music = true;
    this.theme = 'living';
    this.musicOn = false;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.combo = 0;
    this.comboT = 0;
  }

  /** Вызывать из обработчика нажатия: браузеры разрешают звук только после жеста. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.connect(this.master);
      this.mus = this.ctx.createGain();
      this.mus.gain.value = 0.5;
      this.mus.connect(this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setSound(on) {
    this.sound = on;
  }
  setMusic(on) {
    this.music = on;
    if (!on) this.stopMusic();
  }

  tone(freq, dur, { type = 'sine', vol = 0.2, to = null, delay = 0, out = this.sfx, attack = 0.005 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.2, freq = 1200, q = 0.8, type = 'bandpass', delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t);
  }

  meow(delay = 0, pitch = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(520 * pitch, t);
    o.frequency.linearRampToValueAtTime(880 * pitch, t + 0.12);
    o.frequency.linearRampToValueAtTime(620 * pitch, t + 0.42);
    f.type = 'bandpass';
    f.Q.value = 4;
    f.frequency.setValueAtTime(900, t);
    f.frequency.linearRampToValueAtTime(2200, t + 0.14);
    f.frequency.linearRampToValueAtTime(1100, t + 0.42);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.5);
  }

  play(name) {
    if (!this.sound || !this.ctx) return;
    const now = this.ctx.currentTime;
    switch (name) {
      case 'flap':
        this.tone(430, 0.09, { type: 'triangle', vol: 0.1, to: 720 });
        this.noise(0.07, { vol: 0.05, freq: 2400 });
        break;
      case 'heart': {
        // собираешь подряд — нота поднимается
        if (now - this.comboT > 1.2) this.combo = 0;
        this.comboT = now;
        const scale = [0, 2, 4, 7, 9, 12, 14, 16];
        const n = 76 + scale[Math.min(this.combo, scale.length - 1)];
        this.combo++;
        this.tone(midi(n), 0.16, { type: 'sine', vol: 0.16 });
        this.tone(midi(n + 12), 0.2, { type: 'sine', vol: 0.06, delay: 0.03 });
        break;
      }
      case 'fish':
        [79, 83, 86, 91].forEach((n, i) => this.tone(midi(n), 0.2, { type: 'triangle', vol: 0.14, delay: i * 0.06 }));
        break;
      case 'power':
        this.tone(330, 0.4, { type: 'triangle', vol: 0.16, to: 1320 });
        this.tone(660, 0.4, { type: 'sine', vol: 0.08, to: 1980, delay: 0.05 });
        break;
      case 'powerEnd':
        this.tone(900, 0.25, { type: 'triangle', vol: 0.08, to: 400 });
        break;
      case 'pop':
        this.noise(0.12, { vol: 0.35, freq: 1800, q: 0.5 });
        this.tone(900, 0.08, { type: 'square', vol: 0.05, to: 300 });
        break;
      case 'shield':
        this.noise(0.18, { vol: 0.25, freq: 3200, q: 0.7 });
        this.tone(1200, 0.2, { type: 'sine', vol: 0.1, to: 500 });
        break;
      case 'hit':
        this.tone(190, 0.28, { type: 'sawtooth', vol: 0.2, to: 55 });
        this.noise(0.2, { vol: 0.3, freq: 500, q: 0.6, type: 'lowpass' });
        this.meow(0.05, 1.15);
        break;
      case 'gate':
        this.tone(1560, 0.07, { type: 'sine', vol: 0.05 });
        break;
      case 'warn':
        this.tone(980, 0.09, { type: 'square', vol: 0.06 });
        this.tone(980, 0.09, { type: 'square', vol: 0.06, delay: 0.16 });
        break;
      case 'wind':
        this.noise(1.3, { vol: 0.16, freq: 700, q: 0.4 });
        break;
      case 'win':
        [72, 76, 79, 84, 88].forEach((n, i) => this.tone(midi(n), 0.5, { type: 'triangle', vol: 0.16, delay: i * 0.11 }));
        this.meow(0.6, 1.3);
        break;
      case 'lose':
        [67, 63, 60, 55].forEach((n, i) => this.tone(midi(n), 0.34, { type: 'triangle', vol: 0.14, delay: 0.1 + i * 0.16 }));
        break;
      case 'star':
        this.tone(midi(88), 0.3, { type: 'sine', vol: 0.16 });
        this.tone(midi(95), 0.4, { type: 'sine', vol: 0.1, delay: 0.06 });
        break;
      case 'click':
        this.tone(660, 0.06, { type: 'triangle', vol: 0.1, to: 880 });
        break;
      case 'buy':
        [76, 81, 88].forEach((n, i) => this.tone(midi(n), 0.22, { type: 'sine', vol: 0.14, delay: i * 0.07 }));
        break;
      case 'nope':
        this.tone(220, 0.14, { type: 'square', vol: 0.06 });
        this.tone(196, 0.18, { type: 'square', vol: 0.06, delay: 0.12 });
        break;
      case 'meow':
        this.meow(0, 1.2);
        break;
      case 'paper':
        this.noise(0.25, { vol: 0.14, freq: 3000, q: 0.3 });
        break;
    }
  }

  /* ---------- музыка: тихая «музыкальная шкатулка» ---------- */

  startMusic(theme) {
    if (theme) this.theme = theme;
    if (!this.music || !this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 60);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setTheme(theme) {
    this.theme = theme;
  }

  schedule() {
    if (!this.ctx || !this.musicOn) return;
    const minor = this.theme === 'night';
    const bpm = this.theme === 'love' ? 92 : this.theme === 'party' ? 112 : 100;
    const eighth = 60 / bpm / 2;
    const root = 60 + (ROOTS[this.theme] || 0);
    const prog = minor ? PROG.minor : PROG.major;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      const n = this.step++;
      const pos = n % 8;
      const chord = prog[Math.floor(n / 8) % 4];
      const delay = this.nextTime - this.ctx.currentTime;
      const arp = [0, 1, 2, 1, 0, 2, 1, 2][pos];
      const high = this.theme === 'winter' ? 12 : 0;
      this.tone(midi(root + 12 + high + chord[arp]), 0.5, { type: 'sine', vol: 0.085, delay, out: this.mus, attack: 0.004 });
      if (pos === 0) this.tone(midi(root - 12 + chord[0]), eighth * 7, { type: 'triangle', vol: 0.09, delay, out: this.mus, attack: 0.02 });
      if (pos === 4 && Math.floor(n / 8) % 2 === 1) this.tone(midi(root + 24 + chord[2]), 0.8, { type: 'sine', vol: 0.05, delay, out: this.mus });
      if (pos === 6 && Math.floor(n / 32) % 2 === 1) this.tone(midi(root + 24 + chord[1]), 0.6, { type: 'sine', vol: 0.045, delay, out: this.mus });
      this.nextTime += eighth;
    }
  }
}
