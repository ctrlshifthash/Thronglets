'use client';

// ─────────────────────────────────────────────────────────────────────
// Grove music: a tiny procedural chiptune — soft pentatonic lead,
// round sine bass, brushed noise hats — generated entirely in
// WebAudio. No files, loops forever, deliberately gentle.
// ─────────────────────────────────────────────────────────────────────

interface MusicHandle {
  ctx: AudioContext;
  master: GainNode;
  timer: ReturnType<typeof setInterval>;
}

let handle: MusicHandle | null = null;

const BPM = 96;
const STEP = 60 / BPM / 2; // eighth notes

// C major pentatonic, two octaves (Hz).
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

// A wandering 32-step melody (index into SCALE, -1 = rest).
const LEAD = [
  0, 2, 4, -1, 5, 4, 2, -1, 3, 5, 7, -1, 5, -1, 4, 2,
  0, 2, 4, 5, -1, 7, 5, 4, -1, 3, 2, 3, 4, -1, 2, -1,
];
// Bass roots per 8-step bar (C, A, F, G).
const BASS = [130.81, 110.0, 87.31, 98.0];

function pluck(ctx: AudioContext, out: GainNode, freq: number, t: number, dur: number, type: OscillatorType, vol: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function hat(ctx: AudioContext, out: GainNode, t: number) {
  const len = 0.04;
  const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6000;
  const g = ctx.createGain();
  g.gain.value = 0.05;
  src.connect(hp).connect(g).connect(out);
  src.start(t);
}

export function startMusic(): void {
  if (handle) return;
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.14;
  master.connect(ctx.destination);

  // Autoplay policy: until the user touches the page the context stays
  // suspended — resume it on the very first interaction, silently.
  if (ctx.state === 'suspended') {
    const resume = () => {
      void ctx.resume().catch(() => undefined);
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
    void ctx.resume().catch(() => undefined);
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
  }

  let step = 0;
  let nextAt = ctx.currentTime + 0.1;

  const schedule = () => {
    // Keep ~0.6s of audio queued ahead.
    while (nextAt < ctx.currentTime + 0.6) {
      const i = step % LEAD.length;
      const note = LEAD[i];
      if (note >= 0) {
        pluck(ctx, master, SCALE[note], nextAt, STEP * 1.8, 'triangle', 0.5);
        // A soft echo a fifth below, sometimes.
        if (i % 4 === 0) pluck(ctx, master, SCALE[note] / 2, nextAt, STEP * 2.4, 'sine', 0.18);
      }
      if (i % 8 === 0) {
        pluck(ctx, master, BASS[(Math.floor(step / 8)) % BASS.length], nextAt, STEP * 6, 'sine', 0.4);
      }
      if (i % 2 === 1) hat(ctx, master, nextAt);
      nextAt += STEP;
      step++;
    }
  };
  schedule();
  const timer = setInterval(schedule, 200);
  handle = { ctx, master, timer };
}

export function stopMusic(): void {
  if (!handle) return;
  clearInterval(handle.timer);
  const { ctx, master } = handle;
  master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
  setTimeout(() => void ctx.close().catch(() => undefined), 600);
  handle = null;
}

export function musicPlaying(): boolean {
  return handle !== null;
}
