/* Flappy Kitty · звук. Всё синтезируется через Web Audio —
   ни одного аудиофайла, поэтому игра грузится мгновенно. */

const ROOTS = {
  living: 0, kitchen: 2, party: 5, night: -3, winter: 7, rain: -5, rainbow: -5, pond: 4, plush: 9, gothic: -1, love: 0, letter: -2,
  email: 3, // музыка второго письма
  attic: -7, vacuum: 1, yarn: 6, bath: 8, street: -4, bakery: 3, toybox: 5, fireplace: -2, storm: -9, dawn: 2,
};
// Характер музыки по мирам. Чего нет в таблице — играет как «шкатулка» по умолчанию (100 ударов, мажор).
//   bpm — темп; minor — минорный круг аккордов; high — на сколько полутонов поднят перебор;
//   arp — рисунок перебора (номера нот аккорда); wave — тембр перебора; len — длина ноты перебора.
// «rainbow» — тот же мир «Под дождём», но после дождя: main.js включает его по событию «clear».
const STYLE = {
  party: { bpm: 112 },
  night: { minor: true },
  winter: { high: 12 },
  love: { bpm: 92 },
  rain: { bpm: 88, minor: true, arp: [0, 2, 1, 2, 0, 2, 1, 2], len: 0.3 },
  rainbow: { bpm: 96, high: 12, len: 0.6 },
  pond: { bpm: 106, arp: [0, 2, 0, 1, 2, 1, 0, 2], len: 0.22, wave: 'triangle' },
  plush: { bpm: 84, high: 12, arp: [0, 1, 2, 1, 2, 1, 0, 1], len: 0.9 },
  gothic: { bpm: 108, minor: true, arp: [0, 1, 2, 0, 2, 1, 2, 1], len: 0.28, wave: 'square' },
  // ---- вторая глава ----
  attic: { bpm: 88, minor: true, arp: [0, 1, 2, 1, 0, 1, 2, 1], len: 0.5, wave: 'triangle' }, // медленно, как пыль в луче света
  vacuum: { bpm: 116, arp: [0, 2, 0, 2, 1, 2, 0, 2], len: 0.24, wave: 'square' }, // ритмично, как моторчик
  yarn: { bpm: 100, high: 12, arp: [0, 2, 1, 2, 0, 2, 1, 2], len: 0.34 }, // игриво
  bath: { bpm: 94, arp: [0, 1, 2, 1, 2, 1, 0, 1], len: 0.42, wave: 'triangle' }, // капли
  street: { bpm: 104, arp: [0, 2, 1, 2, 0, 2, 1, 2], len: 0.4 }, // прогулка
  bakery: { bpm: 92, high: 12, arp: [0, 1, 2, 1, 0, 1, 2, 1], len: 0.7 }, // тепло и мягко
  toybox: { bpm: 122, arp: [0, 2, 1, 2, 0, 1, 2, 1], len: 0.2 }, // марш солдатиков
  fireplace: { bpm: 80, arp: [0, 1, 2, 1, 0, 2, 1, 2], len: 0.8, wave: 'triangle' }, // у огня
  storm: { bpm: 112, minor: true, arp: [0, 1, 2, 0, 2, 1, 2, 1], len: 0.26, wave: 'square' }, // тревожно
  dawn: { bpm: 76, high: 12, arp: [0, 2, 1, 2, 0, 2, 1, 2], len: 0.9 }, // рассвет, медленно и светло
  email: { bpm: 70, high: 12, arp: [0, 1, 2, 1, 0, 1, 2, 1], len: 1.1, wave: 'triangle' }, // второе письмо
};
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
    // «живая» музыка: слои добавляются по ходу уровня (см. setMood)
    this.intensity = 0;
    this.danger = false;
    this.boost = false;
  }

  /** Вызывать из обработчика нажатия: браузеры разрешают звук только после жеста.
      Звук — украшение: что бы ни случилось со звуковой системой, игра должна остаться играбельной,
      поэтому ни одна ошибка отсюда наружу не выходит. */
  unlock() {
    if (this.broken) return;
    try {
      this.open();
    } catch (e) {
      // без звука, но играть можно; повторно не пробуем, чтобы не плодить звуковые устройства
      this.broken = true;
      this.ctx = null;
    }
  }

  open() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      // iPhone: без этого беззвучный режим (рычажок сбоку) глушит игру целиком. Работает с iOS 17.
      try {
        if (navigator.audioSession) navigator.audioSession.type = 'playback';
      } catch (e) {
        /* не страшно */
      }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      // мягкий ограничитель: когда звуков много сразу, они не хрипят
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -10;
      this.limiter.knee.value = 12;
      this.limiter.ratio.value = 6;
      this.limiter.attack.value = 0.004;
      this.limiter.release.value = 0.18;
      this.master.connect(this.limiter).connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.connect(this.master);
      // музыка идёт через фильтр: в начале уровня она «приглушена», к финишу раскрывается
      this.mus = this.ctx.createGain();
      this.mus.gain.value = 0.5;
      this.musFilter = this.ctx.createBiquadFilter();
      this.musFilter.type = 'lowpass';
      this.musFilter.frequency.value = 2400;
      this.musFilter.Q.value = 0.4;
      this.mus.connect(this.musFilter).connect(this.master);
      // Safari считает звук «включённым жестом» только после первого проигранного буфера
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = this.ctx.createBuffer(1, 1, 22050);
        src.connect(this.ctx.destination);
        src.start(0);
      } catch (e) {
        /* не страшно */
      }
      // после звонка, будильника или блокировки экрана iOS ставит звук в 'interrupted' — будим сами
      this.ctx.onstatechange = () => {
        if (this.ctx.state === 'interrupted' && !document.hidden) this.ctx.resume().catch(() => {});
      };
    }
    // 'suspended' — обычная пауза, 'interrupted' — iOS после звонка или блокировки экрана
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  /** Вкладку свернули — отпускаем звуковое устройство, чтобы не тратить батарею. */
  sleep() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }
  /** Вкладку вернули. Если браузер не разрешит — звук вернётся с первым касанием (unlock). */
  wake() {
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
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

  noise(dur, { vol = 0.2, freq = 1200, q = 0.8, type = 'bandpass', delay = 0, out = this.sfx, to = null } = {}) {
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
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(out);
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

  play(name, opt = {}) {
    try {
      this.emitSound(name, opt);
    } catch (e) {
      /* звук не должен ломать игру */
    }
  }

  emitSound(name, opt) {
    if (!this.sound || !this.ctx) return;
    const now = this.ctx.currentTime;
    switch (name) {
      case 'flap':
        this.tone(430, 0.09, { type: 'triangle', vol: 0.1, to: 720 });
        this.noise(0.07, { vol: 0.05, freq: 2400 });
        break;
      case 'heart': {
        // собираешь подряд — нота поднимается по гамме и раз в десять сердечек начинает круг заново
        if (opt.streak) this.combo = (opt.streak - 1) % 10;
        else {
          if (now - this.comboT > 1.2) this.combo = 0;
          else this.combo++;
        }
        this.comboT = now;
        const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
        const n = 76 + scale[Math.min(this.combo, scale.length - 1)];
        this.tone(midi(n), 0.16, { type: 'sine', vol: 0.16 });
        this.tone(midi(n + 12), 0.2, { type: 'sine', vol: 0.06, delay: 0.03 });
        break;
      }
      case 'streak':
        // серия из десяти сердечек — короткий перелив вверх
        [84, 88, 91, 96].forEach((n, i) => this.tone(midi(n), 0.22, { type: 'triangle', vol: 0.12, delay: i * 0.045 }));
        this.tone(midi(100), 0.5, { type: 'sine', vol: 0.07, delay: 0.2 });
        break;
      case 'streakEnd':
        this.tone(midi(72), 0.16, { type: 'sine', vol: 0.06, to: midi(64) });
        break;
      case 'near':
        // пролёт впритирку: свист ветра
        this.noise(0.22, { vol: 0.16, freq: 900, q: 1.4, to: 3600 });
        this.tone(1300, 0.14, { type: 'sine', vol: 0.04, to: 2100, delay: 0.03 });
        break;
      case 'purr':
        // мурчание: низкий «моторчик» с дрожанием громкости
        for (let i = 0; i < 9; i++) this.tone(46 + (i % 2) * 3, 0.07, { type: 'sawtooth', vol: 0.11, delay: i * 0.055, attack: 0.012 });
        break;
      case 'seal':
        // сургуч на конверте
        this.noise(0.09, { vol: 0.3, freq: 700, q: 0.7, type: 'lowpass' });
        this.tone(180, 0.12, { type: 'triangle', vol: 0.14, to: 90 });
        break;
      case 'envelope':
        this.noise(0.5, { vol: 0.16, freq: 1800, q: 0.3, to: 4200 });
        [72, 76, 79, 84].forEach((n, i) => this.tone(midi(n), 0.9, { type: 'sine', vol: 0.09, delay: 0.25 + i * 0.14 }));
        break;
      case 'photo':
        // щелчок затвора
        this.noise(0.04, { vol: 0.3, freq: 3800, q: 0.6 });
        this.noise(0.06, { vol: 0.22, freq: 2200, q: 0.6, delay: 0.07 });
        break;
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
      case 'yarn':
        // клубок: мягкий «пуф» и две тёплые ноты — подарок, а не хлопок
        this.noise(0.14, { vol: 0.12, freq: 900, q: 0.5, type: 'lowpass' });
        this.tone(midi(79), 0.16, { type: 'sine', vol: 0.12 });
        this.tone(midi(86), 0.24, { type: 'sine', vol: 0.1, delay: 0.07 });
        break;
      case 'squeak':
        // летучая мышь на подлёте: два тонких писка
        this.tone(2500, 0.07, { type: 'triangle', vol: 0.07, to: 3300 });
        this.tone(2700, 0.09, { type: 'triangle', vol: 0.07, to: 3600, delay: 0.13 });
        break;
      case 'plop':
        // лягушонок вернулся в воду
        this.tone(520, 0.12, { type: 'sine', vol: 0.11, to: 170 });
        this.noise(0.1, { vol: 0.08, freq: 1400, q: 0.6, delay: 0.03 });
        break;
      case 'clear':
        // дождь кончился: светлый перелив вверх
        [67, 72, 76, 79, 84, 88].forEach((n, i) => this.tone(midi(n), 0.5, { type: 'sine', vol: 0.11, delay: i * 0.09 }));
        this.tone(midi(91), 0.9, { type: 'triangle', vol: 0.06, delay: 0.56 });
        break;
      case 'croak':
        // «ква»: два коротких хриплых звука — лягушонок сейчас прыгнет
        this.tone(210, 0.09, { type: 'sawtooth', vol: 0.07, to: 150 });
        this.tone(250, 0.13, { type: 'sawtooth', vol: 0.08, to: 140, delay: 0.11 });
        break;
      case 'buzz':
        // робот-пылесос: низкое жужжание моторчика
        this.tone(96, 0.5, { type: 'sawtooth', vol: 0.07, to: 118 });
        this.tone(192, 0.5, { type: 'square', vol: 0.03, to: 236 });
        break;
      case 'pop2':
        // мыльный пузырь лопнул
        this.noise(0.09, { vol: 0.2, freq: 2600, q: 0.7 });
        this.tone(1400, 0.07, { type: 'sine', vol: 0.06, to: 2400 });
        break;
      case 'coo':
        // голубь: мягкое воркование перед взлётом
        this.tone(380, 0.16, { type: 'sine', vol: 0.08, to: 300 });
        this.tone(340, 0.2, { type: 'sine', vol: 0.07, to: 270, delay: 0.17 });
        break;
      case 'crumble':
        // булочка раскрошилась
        this.noise(0.13, { vol: 0.18, freq: 1100, q: 0.5, type: 'lowpass' });
        this.tone(midi(72), 0.12, { type: 'triangle', vol: 0.07, to: midi(64) });
        break;
      case 'clank':
        // оловянный солдатик: короткий металлический стук
        this.tone(560, 0.06, { type: 'square', vol: 0.06, to: 380 });
        this.noise(0.05, { vol: 0.12, freq: 3200, q: 1.2 });
        break;
      case 'fizz':
        // уголёк: короткое шипение
        this.noise(0.16, { vol: 0.14, freq: 2000, q: 0.4, to: 900 });
        break;
      case 'whistle':
        // пар из пекарни
        this.noise(0.3, { vol: 0.1, freq: 1500, q: 0.35, to: 2600 });
        break;
      case 'thunder':
        // молния: резкий щелчок и низкий раскат
        this.noise(0.09, { vol: 0.3, freq: 4200, q: 0.3 });
        this.tone(70, 0.7, { type: 'sawtooth', vol: 0.1, to: 38, delay: 0.03 });
        this.noise(0.6, { vol: 0.1, freq: 300, q: 0.4, type: 'lowpass', delay: 0.05 });
        break;
      case 'letter2':
        // второе письмо: те же ноты, что у первого, но выше и светлее
        [76, 80, 83, 88].forEach((n, i) => this.tone(midi(n), 1, { type: 'sine', vol: 0.08, delay: 0.2 + i * 0.15 }));
        this.tone(midi(95), 1.2, { type: 'triangle', vol: 0.05, delay: 0.8 });
        break;
      case 'shield':
        this.noise(0.18, { vol: 0.25, freq: 3200, q: 0.7 });
        this.tone(1200, 0.2, { type: 'sine', vol: 0.1, to: 500 });
        break;
      case 'hit':
        this.duck(0.5);
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
        this.duck(1.4);
        [72, 76, 79, 84, 88].forEach((n, i) => this.tone(midi(n), 0.5, { type: 'triangle', vol: 0.16, delay: i * 0.11 }));
        [60, 67, 72].forEach((n) => this.tone(midi(n), 1.3, { type: 'sine', vol: 0.07, delay: 0.5, attack: 0.05 }));
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
    this.timer = setInterval(() => {
      try {
        this.schedule();
      } catch (e) {
        /* звук не должен ломать игру */
      }
    }, 60);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setTheme(theme) {
    this.theme = theme;
  }

  /** На мгновение приглушает музыку, чтобы важный звук (удар, победа) было слышно. */
  duck(sec) {
    if (!this.ctx || !this.mus) return;
    const t = this.ctx.currentTime;
    const g = this.mus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.16, t + 0.04);
    g.linearRampToValueAtTime(0.5, t + 0.04 + sec);
  }

  /** Настроение музыки. intensity 0…1 — насколько «раскрыта» мелодия (растёт к финишу и с серией сердечек);
      danger — осталась последняя жизнь; boost — действует кошачья мята. Можно вызывать каждый кадр. */
  setMood({ intensity = 0, danger = false, boost = false } = {}) {
    this.intensity = Math.max(0, Math.min(1, intensity));
    this.danger = danger;
    this.boost = boost;
    if (!this.ctx || !this.musFilter) return;
    // Функцию зовут каждый кадр, а браузер копит каждую команду параметру в очереди.
    // Поэтому цель округляем до 200 Гц и отправляем, только когда она изменилась.
    const target = Math.round((danger ? 1500 : 1900 + this.intensity * 5200 + (boost ? 1500 : 0)) / 200) * 200;
    if (target === this.filterTarget) return;
    this.filterTarget = target;
    try {
      this.musFilter.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.35);
    } catch (e) {
      /* звук не должен ломать игру */
    }
  }

  schedule() {
    if (!this.ctx || !this.musicOn) return;
    const letter = this.theme === 'letter';
    const style = STYLE[this.theme] || {};
    const minor = !!style.minor;
    const bpm = letter ? 66 : style.bpm || 100;
    const eighth = 60 / bpm / 2;
    const root = 60 + (ROOTS[this.theme] || 0);
    const prog = minor ? PROG.minor : PROG.major;
    const out = this.mus;
    // Если страница подвисла, не доигрываем пропущенные ноты разом — продолжаем с текущего момента.
    if (this.nextTime < this.ctx.currentTime) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      const n = this.step++;
      const pos = n % 8;
      const bar = Math.floor(n / 8);
      const chord = prog[bar % 4];
      const delay = this.nextTime - this.ctx.currentTime;
      const lvl = this.intensity;

      if (letter) {
        // музыка письма: медленные переборы и длинный тёплый аккорд, без ударных
        const arp = [0, 1, 2, 1, 2, 1, 0, 1][pos];
        this.tone(midi(root + 12 + chord[arp] + (pos === 4 ? 12 : 0)), 1.5, { type: 'sine', vol: 0.085, delay, out, attack: 0.012 });
        if (pos === 0) {
          this.tone(midi(root - 12 + chord[0]), eighth * 8, { type: 'triangle', vol: 0.085, delay, out, attack: 0.08 });
          chord.forEach((c) => this.tone(midi(root + c), eighth * 8, { type: 'sine', vol: 0.03, delay, out, attack: 0.5 }));
        }
        if (pos === 6 && bar % 2 === 1) this.tone(midi(root + 24 + chord[2] + 2), 1.8, { type: 'sine', vol: 0.04, delay, out, attack: 0.02 });
        this.nextTime += eighth;
        continue;
      }

      // слой 1 — перебор «музыкальной шкатулки», звучит всегда
      const arp = (style.arp || [0, 1, 2, 1, 0, 2, 1, 2])[pos];
      const high = style.high || 0;
      const wave = style.wave || 'sine';
      // «квадратный» тембр (клавесин готического мира) громче на слух — играем его тише
      const arpVol = (this.danger ? 0.06 : 0.085) * (wave === 'square' ? 0.42 : 1);
      this.tone(midi(root + 12 + high + chord[arp]), style.len || 0.5, { type: wave, vol: arpVol, delay, out, attack: 0.004 });
      // краски миров
      if (this.theme === 'rain') {
        // шум дождя и редкие «капли» высоко
        this.noise(eighth * 1.1, { vol: 0.02, freq: 5200, q: 0.4, delay, out });
        if (pos === 3 || (pos === 6 && bar % 2 === 0)) this.tone(midi(root + 36 + chord[(bar + pos) % 3]), 0.09, { type: 'sine', vol: 0.035, delay, out, to: midi(root + 31 + chord[(bar + pos) % 3]) });
      } else if (this.theme === 'pond') {
        // сверчок: две коротких трели в конце каждого второго такта
        if (bar % 2 === 1 && pos === 7) for (let k = 0; k < 3; k++) this.tone(4300, 0.035, { type: 'sine', vol: 0.016, delay: delay + k * 0.06, out });
        // и булькающий бас на слабую долю
        if (pos === 4) this.tone(midi(root - 12 + chord[2]), 0.18, { type: 'sine', vol: 0.07, delay, out, to: midi(root - 7 + chord[2]) });
      } else if (this.theme === 'plush') {
        // колыбельная: тёплая терция под мелодией
        if (pos === 0 || pos === 4) this.tone(midi(root + chord[1]), eighth * 3.5, { type: 'sine', vol: 0.035, delay, out, attack: 0.08 });
      } else if (this.theme === 'gothic') {
        // орган: длинная квинта внизу и редкий колокол
        if (pos === 0) this.tone(midi(root - 5 + chord[0]), eighth * 8, { type: 'sawtooth', vol: 0.018, delay, out, attack: 0.2 });
        if (pos === 0 && bar % 4 === 3) this.tone(midi(root + 24 + chord[0]), 1.6, { type: 'triangle', vol: 0.04, delay, out, attack: 0.004 });
      } else if (this.theme === 'rainbow') {
        // после дождя: звонкая октава на сильную долю
        if (pos === 0 || pos === 4) this.tone(midi(root + 36 + chord[pos === 0 ? 0 : 2]), 0.7, { type: 'sine', vol: 0.03, delay, out });
      }
      // слой 2 — бас; на последней жизни он стучит чаще, как сердце
      if (pos === 0) this.tone(midi(root - 12 + chord[0]), eighth * 7, { type: 'triangle', vol: 0.09, delay, out, attack: 0.02 });
      if (this.danger && (pos === 3 || pos === 4)) this.tone(midi(root - 12 + chord[0]), 0.16, { type: 'sine', vol: 0.1, delay, out, attack: 0.01 });
      // слой 3 — редкие «колокольчики»
      if (pos === 4 && bar % 2 === 1) this.tone(midi(root + 24 + chord[2]), 0.8, { type: 'sine', vol: 0.05, delay, out });
      if (pos === 6 && Math.floor(n / 32) % 2 === 1) this.tone(midi(root + 24 + chord[1]), 0.6, { type: 'sine', vol: 0.045, delay, out });
      if (!this.danger) {
        // слой 4 — мягкие аккорды на слабую долю: появляются к середине уровня
        if (lvl > 0.3 && (pos === 2 || pos === 6)) {
          const v = 0.022 + (lvl - 0.3) * 0.03;
          this.tone(midi(root + chord[1]), 0.22, { type: 'triangle', vol: v, delay, out, attack: 0.006 });
          this.tone(midi(root + chord[2]), 0.22, { type: 'triangle', vol: v, delay, out, attack: 0.006 });
        }
        // слой 5 — тихий «шейкер» и ответ мелодии октавой выше: ближе к финишу
        if (lvl > 0.6) {
          if (pos % 2 === 1) this.noise(0.04, { vol: 0.03 + (lvl - 0.6) * 0.05, freq: 6500, q: 0.8, delay, out });
          if (pos === 1 || pos === 5) this.tone(midi(root + 24 + high + chord[arp]), 0.3, { type: 'sine', vol: 0.03, delay, out });
        }
      }
      // кошачья мята — эхо мелодии шестнадцатыми
      if (this.boost) this.tone(midi(root + 24 + chord[(arp + 1) % 3]), 0.18, { type: 'triangle', vol: 0.04, delay: delay + eighth / 2, out });
      this.nextTime += eighth;
    }
  }
}
