// Synthesised sound effects (Web Audio). No audio files to ship.

const PITCH = { H: 880, C: 523, N: 587, O: 659, P: 440, S: 494, Cl: 392 };

const SOUNDS = {
  throw: (s, el) => s.tone(PITCH[el] || 600, 0.09, { type: 'triangle', vol: 0.16, to: (PITCH[el] || 600) * 1.3 }),
  toggle: (s) => s.tone(320, 0.05, { type: 'square', vol: 0.07, to: 480 }),
  deny: (s) => s.tone(140, 0.12, { type: 'sawtooth', vol: 0.09, to: 100 }),
  start: (s) => {
    s.tone(300, 0.08, { vol: 0.1, to: 520 });
    s.tone(420, 0.08, { vol: 0.08, to: 700, delay: 0.07 });
  },
  fizzle: (s) => s.noise(0.3, { vol: 0.12, freq: 2400, to: 300 }),
  bolt: (s) => s.tone(900, 0.16, { type: 'sawtooth', vol: 0.1, to: 240 }),
  hit: (s) => {
    s.noise(0.12, { vol: 0.2, freq: 900 });
    s.tone(160, 0.14, { type: 'square', vol: 0.12, to: 70 });
  },
  burn: (s) => s.noise(0.14, { vol: 0.1, freq: 1800, to: 700 }),
  heal: (s) => {
    s.tone(523, 0.1, { vol: 0.12 });
    s.tone(659, 0.1, { vol: 0.12, delay: 0.08 });
    s.tone(784, 0.16, { vol: 0.12, delay: 0.16 });
  },
  shield: (s) => s.tone(440, 0.3, { type: 'triangle', vol: 0.12, to: 880 }),
  boom: (s) => {
    s.noise(0.5, { vol: 0.34, freq: 700, to: 80 });
    s.tone(90, 0.4, { type: 'sine', vol: 0.3, to: 35 });
  },
  splash: (s) => s.noise(0.28, { vol: 0.16, freq: 1400, to: 500 }),
  freeze: (s) => {
    s.tone(1800, 0.2, { type: 'triangle', vol: 0.08, to: 2600 });
    s.tone(2400, 0.25, { type: 'sine', vol: 0.06, delay: 0.05 });
  },
  gas: (s) => s.noise(0.45, { vol: 0.09, freq: 3200, to: 1500 }),
  warn: (s) => s.tone(700, 0.06, { type: 'square', vol: 0.04 }),
  buff: (s) => {
    s.tone(660, 0.08, { type: 'triangle', vol: 0.1 });
    s.tone(990, 0.14, { type: 'triangle', vol: 0.1, delay: 0.07 });
  },
  count: (s) => s.tone(440, 0.12, { type: 'square', vol: 0.08 }),
  go: (s) => s.tone(880, 0.3, { type: 'square', vol: 0.1 }),
  ko: (s) => {
    s.noise(0.6, { vol: 0.25, freq: 500, to: 60 });
    s.tone(300, 0.7, { type: 'sawtooth', vol: 0.14, to: 50 });
  },
  menu: (s) => s.tone(520, 0.05, { type: 'square', vol: 0.06 }),
  select: (s) => s.tone(520, 0.12, { type: 'square', vol: 0.08, to: 1040 }),
};

export class Sfx {
  constructor() {
    this.ac = null;
    this.muted = false;
  }

  // Browsers only allow audio after a user gesture; call this from one.
  unlock() {
    if (!this.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ac = new AC();
      this.out = this.ac.createGain();
      this.out.gain.value = 0.6;
      this.out.connect(this.ac.destination);
    }
    if (this.ac.state === 'suspended') this.ac.resume();
  }

  play(name, arg) {
    if (!this.ac || this.muted || this.ac.state !== 'running') return;
    const sound = SOUNDS[name];
    if (sound) sound(this, arg);
  }

  envelope(vol, start, dur) {
    const gain = this.ac.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    gain.connect(this.out);
    return gain;
  }

  tone(freq, dur, { type = 'sine', vol = 0.15, to = null, delay = 0 } = {}) {
    const start = this.ac.currentTime + delay;
    const osc = this.ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur);
    osc.connect(this.envelope(vol, start, dur));
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  noise(dur, { vol = 0.15, freq = 1200, to = null, delay = 0 } = {}) {
    const start = this.ac.currentTime + delay;
    const frames = Math.ceil(this.ac.sampleRate * dur);
    const buffer = this.ac.createBuffer(1, frames, this.ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ac.createBufferSource();
    src.buffer = buffer;
    const filter = this.ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq, start);
    if (to) filter.frequency.exponentialRampToValueAtTime(to, start + dur);
    src.connect(filter);
    filter.connect(this.envelope(vol, start, dur));
    src.start(start);
  }
}
