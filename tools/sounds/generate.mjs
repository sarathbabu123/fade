/**
 * Synthesises FADE's sound effects (our own, so no licensing questions).
 * node tools/sounds/generate.mjs → app/assets/sounds/*.wav (16-bit mono 44.1 kHz)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44100;
const out = join(dirname(fileURLToPath(import.meta.url)), '../../app/assets/sounds');
mkdirSync(out, { recursive: true });

let seed = 12345;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const noise = () => rand() * 2 - 1;

function buffer(seconds) {
  return new Float32Array(Math.ceil(seconds * RATE));
}

/** Biquad band-pass (RBJ cookbook), frequency can change per sample. */
function bandpass() {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x, f, q) => {
    const w = (2 * Math.PI * f) / RATE;
    const a = Math.sin(w) / (2 * q);
    const b0 = a, b2 = -a, a0 = 1 + a, a1 = -2 * Math.cos(w), a2 = 1 - a;
    const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

const env = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

function addTone(buf, start, dur, freq, gain, { attack = 0.005, decay = dur / 4, type = 'sine', glide = 0 } = {}) {
  let phase = 0;
  const s0 = Math.floor(start * RATE);
  for (let i = 0; i < dur * RATE && s0 + i < buf.length; i++) {
    const t = i / RATE;
    const f = freq * (1 + glide * (t / dur));
    phase += (2 * Math.PI * f) / RATE;
    let v = Math.sin(phase);
    if (type === 'tri') v = (2 / Math.PI) * Math.asin(Math.sin(phase));
    if (type === 'soft-square') v = Math.tanh(3 * Math.sin(phase));
    buf[s0 + i] += v * gain * env(t, attack, decay);
  }
}

function addNoise(buf, start, dur, gain, freqAt, q, { attack = 0.004, decay = dur / 3 } = {}) {
  const bp = bandpass();
  const s0 = Math.floor(start * RATE);
  for (let i = 0; i < dur * RATE && s0 + i < buf.length; i++) {
    const t = i / RATE;
    buf[s0 + i] += bp(noise(), freqAt(t / dur), q) * gain * env(t, attack, decay);
  }
}

function write(name, buf) {
  // Normalise to -3 dBFS with a short fade-out to avoid clicks.
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const k = peak > 0 ? 0.7 / peak : 1;
  const tail = Math.min(buf.length, Math.floor(0.01 * RATE));
  const data = Buffer.alloc(buf.length * 2);
  for (let i = 0; i < buf.length; i++) {
    const fade = i > buf.length - tail ? (buf.length - i) / tail : 1;
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i] * k * fade)) * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(join(out, `${name}.wav`), Buffer.concat([header, data]));
}

// Pen stroke for X: two quick scratches.
{
  const b = buffer(0.3);
  addNoise(b, 0, 0.11, 1, (p) => 2400 + 2600 * p, 1.4, { decay: 0.05 });
  addNoise(b, 0.13, 0.12, 0.9, (p) => 2800 + 2200 * p, 1.4, { decay: 0.05 });
  addTone(b, 0, 0.08, 180, 0.15, { decay: 0.03 });
  write('place-x', b);
}
// Pen stroke for O: one curved sweep.
{
  const b = buffer(0.3);
  addNoise(b, 0, 0.24, 1, (p) => 1800 + 3200 * Math.sin(Math.PI * p), 1.6, { attack: 0.02, decay: 0.09 });
  addTone(b, 0, 0.08, 200, 0.12, { decay: 0.03 });
  write('place-o', b);
}
// Airy dissolve when a mark fades.
{
  const b = buffer(0.6);
  addNoise(b, 0, 0.55, 0.8, (p) => 5000 - 2500 * p, 0.8, { attack: 0.03, decay: 0.18 });
  for (let i = 0; i < 5; i++) addTone(b, 0.02 + i * 0.06, 0.25, 1800 + i * 420, 0.06, { decay: 0.08 });
  write('fade', b);
}
// Quiet clock tick for the last second.
{
  const b = buffer(0.05);
  addTone(b, 0, 0.03, 2200, 0.6, { attack: 0.001, decay: 0.006 });
  addNoise(b, 0, 0.02, 0.4, () => 6000, 2, { attack: 0.0005, decay: 0.004 });
  write('tick', b);
}
// Glass crack for a timeout.
{
  const b = buffer(0.7);
  addNoise(b, 0, 0.08, 1.2, () => 4500, 0.7, { attack: 0.0005, decay: 0.02 });
  [3170, 4410, 5230, 6930].forEach((f, i) => addTone(b, 0.005 + i * 0.012, 0.6, f, 0.18, { attack: 0.001, decay: 0.12 }));
  addNoise(b, 0.05, 0.4, 0.3, (p) => 7000 - 3000 * p, 3, { decay: 0.1 });
  write('timeout', b);
}
// Chord hit for a round win.
{
  const b = buffer(1.0);
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => addTone(b, i * 0.012, 0.95, f, 0.3, { attack: 0.004, decay: 0.3, type: 'tri' }));
  addNoise(b, 0, 0.15, 0.25, () => 8000, 0.6, { decay: 0.04 });
  write('win', b);
}
// Low tone for a round loss.
{
  const b = buffer(0.9);
  addTone(b, 0, 0.85, 196, 0.5, { attack: 0.02, decay: 0.35, glide: -0.12 });
  addTone(b, 0, 0.85, 233.08, 0.3, { attack: 0.02, decay: 0.3, glide: -0.12 });
  write('lose', b);
}
// Short fanfare for a match win.
{
  const b = buffer(1.6);
  [523.25, 659.25, 783.99].forEach((f, i) => addTone(b, i * 0.11, 0.3, f, 0.35, { decay: 0.12, type: 'tri' }));
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f) => addTone(b, 0.36, 1.2, f, 0.22, { attack: 0.01, decay: 0.45, type: 'tri' }));
  write('fanfare', b);
}
// Soft low tone for a match loss.
{
  const b = buffer(1.3);
  addTone(b, 0, 0.6, 261.63, 0.35, { attack: 0.03, decay: 0.25 });
  addTone(b, 0.3, 1.0, 196, 0.4, { attack: 0.03, decay: 0.4 });
  write('match-lose', b);
}
// Alarm sting when sudden death starts.
{
  const b = buffer(0.6);
  addTone(b, 0, 0.14, 880, 0.35, { attack: 0.003, decay: 0.08, type: 'soft-square' });
  addTone(b, 0.16, 0.14, 660, 0.35, { attack: 0.003, decay: 0.08, type: 'soft-square' });
  addTone(b, 0.32, 0.25, 880, 0.35, { attack: 0.003, decay: 0.12, type: 'soft-square' });
  write('sudden', b);
}
// GO! beep for the start race.
{
  const b = buffer(0.35);
  addTone(b, 0, 0.3, 1318.5, 0.5, { attack: 0.002, decay: 0.12, type: 'tri' });
  addTone(b, 0, 0.3, 1975.5, 0.2, { attack: 0.002, decay: 0.08 });
  write('go', b);
}
// Ready blip before GO.
{
  const b = buffer(0.15);
  addTone(b, 0, 0.12, 660, 0.4, { attack: 0.002, decay: 0.05, type: 'tri' });
  write('ready', b);
}
// Soft whoosh when the board appears.
{
  const b = buffer(0.5);
  addNoise(b, 0, 0.45, 1, (p) => 400 + 2400 * p, 0.9, { attack: 0.15, decay: 0.1 });
  write('whoosh', b);
}
// Rejected move / error.
{
  const b = buffer(0.25);
  addTone(b, 0, 0.2, 180, 0.5, { attack: 0.002, decay: 0.08, type: 'soft-square' });
  write('error', b);
}

console.log('wrote sounds to', out);
