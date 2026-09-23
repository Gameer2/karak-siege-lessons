// Lesson-games engine — sound, v2 (2026-09-13). The user found the all-synthesised v1 "annoying and very
// poor", so it now plays real CC0 recordings from assets/audio/ (sources in assets/audio/README.md):
//   - the bed: the place's own recorded ambience, very quiet. 60 s excerpts are crossfaded; short
//     clock recordings loop as they are.
//   - music: whole calm tracks, one at a time. Each track is followed by 60–120 s of silence, and the
//     same track never plays twice in a row (the long-session rule in GAME_PLAYBOOK.md). Milestones
//     (Score.swell) play a short vibraphone and glockenspiel phrase from the game's chord.
//   - effects: blip() plays a real mallet note (glockenspiel, vibraphone or marimba by register, pitched
//     to the MIDI note). burst() plays a real click or knock. play(name) plays any file in sfx/.
// The v1 API is kept (configureAudio, Score.set/swell/chord, blip, burst, voice, loopNoise, lfo, AU),
// so every game keeps working. A game's own noise ambience still runs, but into a muted bus.
import { $, E } from './core.js';

export const MIDI = m => 440 * Math.pow(2, (m - 69) / 12);
const BASE = new URL('../assets/audio/', import.meta.url).href;
const CFG = { key: 'lesson-game-audio', chords: [{ bass: 33, pad: [57, 60, 64, 71], arp: [69, 72, 76, 71] }], ambience: null, world: null };
export const AU = { ctx: null, music: true, sfx: true };

/* ---------- one sound for every game (the user's choice, 2026-09-13: "something unified for everything,
   to start with"): a soft wind bed and one calm playlist. A game may still pass its own place later. ---------- */
const UNIFIED = { bed: [['wind-grass', .55]], music: ['a-place-i-call-home', 'peaceful-days', 'contemplation'] };
const PLACE_OF = () => UNIFIED;

/** chords: [{ bass, pad:[3-4 midi], arp:[4 midi] }], which tunes the effects and milestone phrases.
    ambience(C): the game's v1 synthesised bed (kept only as a silent fallback). key: the localStorage
    key, which also picks the recorded place. place: { bed, music } overrides that. */
export function configureAudio({ key, chords, ambience, place }) {
  Object.assign(CFG, { key: key || CFG.key, chords: chords || CFG.chords, ambience: ambience || null });
  CFG.world = place || PLACE_OF(CFG.key);
  try { const s = JSON.parse(localStorage.getItem(CFG.key) || 'null'); if (s) { AU.music = !!s.music; AU.sfx = !!s.sfx; } } catch (e) {}
}

/* ---------- loading: fetch + decode once, lazily ---------- */
const buffers = new Map();
function load(path) {
  if (!buffers.has(path)) buffers.set(path, fetch(BASE + path).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(b => AU.ctx.decodeAudioData(b)).catch(() => null));
  return buffers.get(path);
}
function impulse(C, sec = 2.2, decay = 3.5) {
  const len = Math.floor(C.sampleRate * sec), b = C.createBuffer(2, len, C.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 80 ? i / 80 : 1); }
  return b;
}
/** v1 helper: a filtered noise loop. It now feeds the muted synth bus, so the old hiss is gone. */
export const loopNoise = (C, freq, q, type) => {
  const s = C.createBufferSource(); s.buffer = AU.noise; s.loop = true;
  const f = C.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = C.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(AU.ambGain); s.start(); return { f, g };
};
export const lfo = (C, rate, depth, param) => { const o = C.createOscillator(); o.frequency.value = rate; const g = C.createGain(); g.gain.value = depth; o.connect(g); g.connect(param); o.start(); };

export function audioInit() {
  if (AU.ctx) return;
  const C = new (window.AudioContext || window.webkitAudioContext)(); AU.ctx = C;
  const comp = C.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 2.5; comp.connect(C.destination);
  const verb = C.createConvolver(); verb.buffer = impulse(C); const wet = C.createGain(); wet.gain.value = .5; verb.connect(wet); wet.connect(comp);
  AU.musicGain = C.createGain(); AU.sfxGain = C.createGain(); AU.bedGain = C.createGain();
  AU.musicGain.connect(comp); AU.bedGain.connect(comp);
  const ds = C.createGain(); ds.gain.value = .9; AU.sfxGain.connect(ds); ds.connect(comp); const ss = C.createGain(); ss.gain.value = .14; AU.sfxGain.connect(ss); ss.connect(verb);
  // v1 buses a game may still touch: muted (ambGain) or quiet (the milestone phrases go through mus)
  AU.ambGain = C.createGain(); AU.ambGain.gain.value = 0; AU.ambGain.connect(comp);
  AU.mus = C.createGain(); AU.mus.gain.value = 1; AU.mus.connect(AU.musicGain); const mv = C.createGain(); mv.gain.value = .25; AU.mus.connect(mv); mv.connect(verb);
  AU.tension = C.createGain(); AU.tension.gain.value = 0;   // the v1 tritone drone is retired; games may still set its gain
  const buf = C.createBuffer(1, C.sampleRate * 2, C.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; AU.noise = buf;
  try { CFG.ambience?.(C); } catch (e) { /* a v1 bed that touches missing nodes must not stop the sound */ }
  applyAudio();
  setTimeout(warm, 8000);   // the files wait for the first click (or 8 s): until then the browser can't play them anyway
}
// the bed and the effects are fetched once sound can actually play, so ~1 MB of audio never competes with the game's boot
let warmed = false;
function warm() {
  if (warmed || !AU.ctx) return; warmed = true;
  startBed();
  ['click', 'tick', 'soft-tap', 'wood', 'soft-no'].forEach(n => load(`sfx/${n}.mp3`));
  for (const n of VIB) load(`inst/vib_${n}.mp3`);
}
/** Browsers only allow sound after a gesture: call once at boot. */
export function startAudioOnGesture() {
  const wake = () => { audioInit(); if (AU.ctx.state !== 'running') AU.ctx.resume(); warm(); Score.start(); };
  addEventListener('pointerdown', wake, { once: true }); addEventListener('keydown', wake, { once: true });
  audioInit(); Score.start();
}

/* ---------- the bed ---------- */
function startBed() {
  const C = AU.ctx;
  (CFG.world?.bed || []).forEach(([name, level]) => load(`amb/${name}.mp3`).then(buf => {
    if (!buf) return; const g = C.createGain(); g.gain.value = level; g.connect(AU.bedGain);
    if (buf.duration < 50) { const s = C.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(g); s.start(C.currentTime + Math.random() * 2); return; }
    // a 60 s excerpt with 2 s fades baked in: overlap the copies by 2 s so the seams cross-fade
    let next = C.currentTime + .05;
    const sched = () => { while (next < C.currentTime + 6) { const s = C.createBufferSource(); s.buffer = buf; s.connect(g); s.start(next); next += buf.duration - 2; } };
    sched(); setInterval(sched, 2500);
  }));
}

/* ---------- effects ---------- */
const lastPlay = new Map();
/** Play a file from assets/audio/sfx/: play('wood', { vol, rate, when }). Repeats within 30 ms are dropped. */
export function play(name, { vol = .6, rate = 1, when = 0, bus = null } = {}) {
  if (!AU.ctx || E.INSTANT) return;
  const now = performance.now(); if (now - (lastPlay.get(name) || 0) < 30) return; lastPlay.set(name, now);
  const C = AU.ctx; load(`sfx/${name}.mp3`).then(buf => {
    if (!buf) return; const s = C.createBufferSource(), g = C.createGain(); s.buffer = buf; s.playbackRate.value = rate; g.gain.value = vol;
    s.connect(g); g.connect(bus || AU.sfxGain); s.start(C.currentTime + when);
  });
}
// the mallet samples: one soft hit per note; a MIDI note plays the nearest sample, re-pitched
const NOTE = n => { const k = n.match(/^([A-G])(#?)(\d)$/); return 12 * (+k[3] + 1) + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[k[1]] + (k[2] ? 1 : 0); };
const VIB = ['F2', 'A2', 'C3', 'E3', 'G3', 'B3', 'D4', 'F4', 'A4', 'C5', 'E5'], MAR = ['C2', 'G2', 'B2', 'F3', 'C4', 'G4', 'B4', 'F5', 'C6'], GLOCK = ['G4', 'C5', 'G5', 'C6', 'G6'];
const INST = { vib: VIB, mar: MAR, glock: GLOCK };
/** A real mallet note at a MIDI pitch: inst 'vib' | 'mar' | 'glock'. */
export function mallet(inst, midi, { vol = .35, when = 0, dur = 0, bus = null } = {}) {
  if (!AU.ctx || E.INSTANT) return;
  const list = INST[inst], root = list.reduce((a, b) => Math.abs(NOTE(b) - midi) < Math.abs(NOTE(a) - midi) ? b : a), C = AU.ctx;
  load(`inst/${inst}_${root}.mp3`).then(buf => {
    if (!buf) return; const s = C.createBufferSource(), g = C.createGain(), t = C.currentTime + when;
    s.buffer = buf; s.playbackRate.value = Math.pow(2, (midi - NOTE(root)) / 12); g.gain.setValueAtTime(vol, t);
    if (dur > 0) g.gain.setTargetAtTime(0, t + dur, dur * .35);
    s.connect(g); g.connect(bus || AU.sfxGain); s.start(t);
  });
}
/** v1 signature: now a real mallet note (glockenspiel up high, vibraphone in the middle, marimba low). */
export function blip(midi, dur = 1.1, vol = .05, when = 0) {
  const inst = midi >= 84 ? 'glock' : midi >= 55 ? 'vib' : 'mar';
  mallet(inst, midi, { vol: Math.min(.7, vol * (inst === 'glock' ? 5 : 8)), when, dur: dur < .6 ? dur : 0 });
}
/** v1 signature: a noise click or thud, now a real recorded one chosen by its filter, pitch and length. */
export function burst(dur = .012, freq = 3400, vol = .05, type = 'highpass', when = 0) {
  let name, k;
  if (type === 'lowpass' || freq < 900) { name = dur >= .1 ? 'wood-heavy' : 'wood'; k = 2.4; }
  else if (type === 'bandpass') { name = freq < 1600 ? 'plank' : 'soft-tap'; k = 3; }
  else { name = dur <= .015 ? 'tick' : 'click'; k = 3.2; }
  play(name, { vol: Math.min(.6, vol * k), rate: .94 + Math.random() * .12, when });
}
/** v1 synth voice: still used by nothing in the engine; kept for games that call it. */
export function voice(midi, t, { attack = .01, hold = 0, release = 2.5, vol = .05, partials = [[1, 1]] } = {}) {
  const C = AU.ctx, f = MIDI(midi), g = C.createGain(), end = t + attack + hold + release;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack);
  if (hold > 0) g.gain.setValueAtTime(vol, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(.0001, end); g.connect(AU.mus);
  for (const [h, a] of partials) { const o = C.createOscillator(); o.type = 'triangle'; o.frequency.value = f * h; const og = C.createGain(); og.gain.value = a; o.connect(og); og.connect(g); o.start(t); o.stop(end + .05); }
}

/* ---------- music: whole tracks with long rests; Score keeps its v1 API ---------- */
export const Score = {
  started: false, target: { pad: 0, pedal: 0, arp: 0, high: 0 }, energy: 0, ci: 0, last: '', src: null, timer: 0,
  start() {
    if (this.started || !AU.ctx) return; this.started = true;
    this.timer = setTimeout(() => this.track(), 6000);   // a moment of the place first, then the first track
  },
  chord() { return CFG.chords[this.ci % CFG.chords.length]; },
  set(mix) { Object.assign(this.target, mix); const m = this.target; this.energy = Math.min(1, Math.max(0, .3 * m.pad + .55 * m.arp + .2 * m.high + .15 * m.pedal)); },
  async track() {
    const list = CFG.world?.music || []; if (!list.length || !AU.ctx) return;
    if (AU.ctx.state !== 'running') { this.timer = setTimeout(() => this.track(), 3000); return; }   // no click yet: don't download a track nobody can hear
    const pool = list.length > 1 ? list.filter(n => n !== this.last) : list, name = pool[Math.floor(Math.random() * pool.length)];
    this.last = name; this.ci = (this.ci + 1) % CFG.chords.length;
    const buf = await load(`music/${name}.mp3`); if (!buf) return this.rest();
    const C = AU.ctx, s = C.createBufferSource(), g = C.createGain(), t = C.currentTime + .1;
    s.buffer = buf; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 2.5);
    s.connect(g); g.connect(AU.musicGain); s.start(t); this.src = { s, g };
    s.onended = () => { if (this.src?.s === s) this.src = null; this.rest(); };
  },
  rest() { clearTimeout(this.timer); this.timer = setTimeout(() => this.track(), (60 + Math.random() * 60) * 1000); },
  /** A milestone: a short rising vibraphone phrase on the current chord, a glockenspiel sparkle on top. */
  swell(hold = 7) {
    if (E.INSTANT || !AU.ctx || CFG.world?.phrases === false) return; const ch = this.chord();
    ch.pad.slice(0, 4).forEach((m, i) => mallet('vib', m + (m < 57 ? 12 : 0), { vol: .3, when: i * .16, bus: AU.mus }));
    ch.arp.slice(0, 2).forEach((m, i) => mallet('glock', m + 12, { vol: .16, when: .75 + i * .22, bus: AU.mus }));
  },
};
export function applyAudio() {
  if (AU.ctx) {
    const t = AU.ctx.currentTime;
    AU.musicGain.gain.setTargetAtTime(AU.music ? .3 : 0, t, .4);
    AU.sfxGain.gain.setTargetAtTime(AU.sfx ? .8 : 0, t, .1);
    AU.bedGain.gain.setTargetAtTime(AU.sfx ? .8 : 0, t, .6);
  }
  $('#tg-music')?.classList.toggle('on', AU.music); $('#tg-sfx')?.classList.toggle('on', AU.sfx);
  const w = $('#snd-wave'); if (w) w.style.opacity = AU.music || AU.sfx ? 1 : .2;
  try { localStorage.setItem(CFG.key, JSON.stringify({ music: AU.music, sfx: AU.sfx })); } catch (e) {}
}
