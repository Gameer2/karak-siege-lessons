// Lesson-games engine — core. Helpers, the abortable timeline that makes chapters rewindable,
// the camera spring, and small 3D builders. Every lesson game imports this instead of copying it.
// Read school-math/games/GAME_PLAYBOOK.md before building a game.
import * as THREE from 'three';

export const $ = s => document.querySelector(s);
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- timeline ----------
   E.RUN   — bump it and every tween/wait/hook in flight rejects with ABORT (rewind, chapter jump).
   E.INSTANT — fast-forward: tweens apply their end state immediately, so earlier chapters can be
               replayed to their final state when the player jumps ahead from the menu.
   E.PAUSED — game time stops (menu open). E.now is game time in seconds, advanced by the loop. */
export const E = { RUN: 0, INSTANT: false, PAUSED: false, now: 0 };
export const ABORT = Symbol('abort');
const tweens = [];
export const hooks = new Set();   // per-frame callbacks (dt) — remove themselves when done
export const ease = {
  io: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  out: t => 1 - Math.pow(1 - t, 3), in: t => t * t * t, lin: t => t,
  back: t => { const c1 = 1.3, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
export function tween(dur, fn, e = ease.io) {
  return new Promise((res, rej) => {
    if (E.INSTANT || dur <= 0) { fn(1); res(); return; }
    tweens.push({ t0: E.now, dur, fn, e, res, rej, tok: E.RUN });
  });
}
/* reading pace, learner-paced (Mayer's segmenting principle): the wait that follows a caption
   (caption(…); await wait(n)) is a gate. It doesn't end until the reader moves on with «التالي» (ui.js hands
   out the gate with pace.arm() and says whether it still holds with pace.gate()). Every other wait is timed. */
export const pace = { arm: () => false, gate: () => false };
export function wait(s) {
  return new Promise((res, rej) => {
    if (E.INSTANT || s <= 0) { res(); return; }
    tweens.push({ t0: E.now, dur: s, fn: () => {}, e: ease.lin, res, rej, tok: E.RUN, gate: s >= 1 && pace.arm() });
  });
}
export const hasGate = () => tweens.some(t => t.gate);
export const atGate = () => tweens.some(t => t.gate && E.now - t.t0 >= t.dur);
export function skipWaits() { for (const t of tweens) if (t.gate) { t.gate = false; t.t0 = E.now - t.dur; } }
export const bg = p => p.catch(() => {});   // fire-and-forget: swallow the ABORT of a rewind
export function tickTweens() {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    if (tw.tok !== E.RUN) { tweens.splice(i, 1); tw.rej(ABORT); continue; }
    const p = Math.min(1, (E.now - tw.t0) / tw.dur); tw.fn(tw.e(p));
    if (p >= 1) { if (tw.gate && pace.gate()) continue; tweens.splice(i, 1); tw.res(); }
  }
}
/** Resolves when fn() returns true (checked every frame); rejects with ABORT on rewind. */
export function loopUntil(fn) {
  const tok = E.RUN;
  return new Promise((res, rej) => {
    const h = () => { if (tok !== E.RUN) { hooks.delete(h); rej(ABORT); return; } if (fn()) { hooks.delete(h); res(); } };
    hooks.add(h);
  });
}

/* ---------- camera spring (Unity-style SmoothDamp): one motion law for every move ---------- */
export function smoothDamp(cur, target, vel, st, dt) {
  const omega = 2 / Math.max(.0001, st), x = omega * dt, exp = 1 / (1 + x + .48 * x * x + .235 * x * x * x);
  const change = cur.clone().sub(target), temp = vel.clone().addScaledVector(change, omega).multiplyScalar(dt);
  vel.sub(temp.clone().multiplyScalar(omega)).multiplyScalar(exp);
  cur.copy(target).add(change.add(temp).multiplyScalar(exp));
}
/** The camera rig every game uses: shot() glides to a framing (awaitable), follow() tracks a moving
    target, cut() jumps. update(dt, t) each frame; drift adds a slow handheld breath (0 = locked). */
export function camRig(camera, pos, look) {
  return {
    pos: pos.clone(), look: look.clone(), tPos: pos.clone(), tLook: look.clone(), vPos: V(), vLook: V(), st: .8, drift: 1,
    shot(p, l, { time = 1.6 } = {}) { this.tPos.copy(p); this.tLook.copy(l); this.st = time * .42; if (E.INSTANT) { this.cut(p, l); return Promise.resolve(); } const w = wait(time); w.catch(() => {}); return w; },
    follow(p, l, st = .4) { this.tPos.copy(p); this.tLook.copy(l); this.st = st; },
    cut(p, l) { this.pos.copy(p); this.look.copy(l); this.tPos.copy(p); this.tLook.copy(l); this.vPos.set(0, 0, 0); this.vLook.set(0, 0, 0); },
    update(dt, t) {
      smoothDamp(this.pos, this.tPos, this.vPos, this.st, dt); smoothDamp(this.look, this.tLook, this.vLook, this.st * .9, dt);
      camera.position.copy(this.pos).add(V(Math.sin(t * .23) + Math.sin(t * .51) * .4, Math.sin(t * .31 + 1) * .7, 0).multiplyScalar(this.drift * .03));
      camera.lookAt(this.look);
    },
  };
}

/* ---------- builders ---------- */
export const canvasTex = (w, h, draw) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
};
export const hdr = (h, k) => new THREE.Color(h).multiplyScalar(k);
export const UP = V(0, 1, 0), CYL = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
/** A glowing line segment (cylinder). setBeam(m, p, q, grow) places/grows it from p toward q. */
export function makeBeam(color, r = .03, k = 1.4) {
  const m = new THREE.Mesh(CYL, new THREE.MeshBasicMaterial({ color: hdr(color, k), transparent: true, depthWrite: false }));
  m.userData.r = r; m.visible = false; return m;
}
export function setBeam(m, p, q, grow = 1) {
  grow = clamp(grow, 0, 1); if (grow <= .001) { m.visible = false; return; }
  const end = p.clone().lerp(q, grow), d = end.clone().sub(p), len = d.length(); if (len < 1e-4) { m.visible = false; return; }
  m.visible = true; m.position.copy(p).addScaledVector(d, .5); m.scale.set(m.userData.r, len, m.userData.r); m.quaternion.setFromUnitVectors(UP, d.normalize());
}
export const NOISE_GLSL = `
  float h3(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float n3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
    return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
  float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*n3(p); p*=2.03; a*=.5; } return s; }`;
