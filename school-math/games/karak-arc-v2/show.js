// The lesson shown by motion, not by words (the user's brief of 2026-09-23): the graph paper folds on a line, rulers
// measure, a point is tied to its twin. Everything is computed from the rule itself, so a fold only closes exactly when
// the line really is the axis; a wrong line visibly fails. Quiet by design: one colour per meaning, eased moves, no flicker.
//   ruler(id, color)          a dimension line with end ticks and a label: .set(p, q, text), .hide()
//   foldAt(f, h, x0, pts)     fold the path's part x0…h (and the points pts on it) over the line x = h; resolves true if it
//                             lands on the real path (h is the axis), false after it has shown the miss and unfolded
//   twin(x, y, tx, ty, h)     while a point at x is dragged to y: its twin at tx, the equal distances to the axis h, and
//                             a level line between them that turns green only when the heights match; twinOff()
//   xy(h, k)                  the vertex's two numbers as lengths: x along the ground, y straight up; xyOff()
//   level(c, x1), halve(c, x1) the line y = c, its two crossings 0 and x1 = −b/a, and their gap split into two halves; levelOff()
//   aim(s), drops(f, s)       the straight aim line from the release point, and gravity's pull under it every 10 m
//   reset()                   hide everything (a chapter's start, a rewind)
import * as THREE from 'three';
import { V, E, tween, wait, makeBeam, setBeam, hdr, ease } from '../engine/core.js';
import { label, setLabel, ltr } from '../engine/ui.js';
import { scene, sfx, n } from '../karak/stage.js';
import { makeFlight } from '../karak/world.js';

export const INK = { h: 0xffc233, d: 0x38e1ff, ok: 0x7dffb0, bad: 0xff5a4a, pt: 0xffffff };
const BRIGHT = 2.3;   // as stage.js PURE_K: the maths goes in brighter than the world, so the tone-mapped frame keeps it vivid
function beam(color, r) { const b = makeBeam(color, r, 1.5); b.material.color.copy(hdr(color, BRIGHT)); b.material.depthTest = false; b.userData.noAO = true; b.renderOrder = 4; scene.add(b); return b; }
const tint = (b, c) => b.material.color.copy(hdr(c, BRIGHT));

/* ---------- a ruler: a dimension line p → q with ticks at its ends, and its length as a label ---------- */
export function ruler(id, color = INK.d, r = .11) {
  const R = { main: beam(color, r), a: beam(color, r * .8), b: beam(color, r * .8), at: V(), id };
  label(id, color === INK.h ? 'dim dimh' : 'dim', () => R.at, [0, -16]);   // the label's frame in the ruler's colour
  R.set = (p, q, text, grow = 1) => {
    const d = q.clone().sub(p), L = d.length(); if (L < 1e-3) { R.hide(); return R; }
    const u = d.clone().divideScalar(L), w = V(-u.y, u.x, 0).multiplyScalar(.75), end = p.clone().addScaledVector(d, grow);
    setBeam(R.main, p, end, 1); setBeam(R.a, p.clone().sub(w), p.clone().add(w), 1); setBeam(R.b, end.clone().sub(w), end.clone().add(w), grow > .98 ? 1 : 0);
    R.at.copy(p).lerp(end, .5); const on = grow > .98 && text != null; setLabel(id, on ? text : null, on ? 1 : 0); return R;
  };
  R.color = c => { [R.main, R.a, R.b].forEach(b => tint(b, c)); return R; };
  R.hide = () => { R.main.visible = R.a.visible = R.b.visible = false; setLabel(id, null, 0); return R; };
  R.hide(); rulers.push(R); return R;
}
const rulers = [];
/** A ruler that grows from p to q (eased), then holds. */
export const grow = (R, p, q, text, t = .7) => (E.INSTANT ? Promise.resolve(R.set(p, q, text)) : tween(t, u => R.set(p, q, text, u), ease.out));

/* ---------- the fold: the path's left part turns over the line x = h like a page ---------- */
const fold = { g: new THREE.Group(), run: 0, dots: [] };
fold.g.name = 'fold'; scene.add(fold.g);
fold.path = makeFlight(fold.g, { color: INK.d, r: .22, opacity: .95, k: 1.6 });
fold.path.mesh.material.depthTest = false; fold.path.mesh.renderOrder = 5;
fold.page = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: INK.d, transparent: true, opacity: .07, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
fold.page.renderOrder = 3; fold.page.userData.noAO = true; fold.g.add(fold.page);
fold.edge = beam(INK.d, .06); fold.g.add(fold.edge);
const DOT = new THREE.SphereGeometry(.6, 18, 12);
function foldReset() { fold.g.visible = false; fold.g.rotation.y = 0; fold.dots.forEach(d => { d.visible = false; }); }
/** Fold the part x0…h of y = f(x) over x = h. ok: whether h is the axis (decides the colour and what happens after). */
export async function foldAt(f, h, x0, pts = [], ok = false) {
  const run = ++fold.run; if (E.INSTANT) { foldReset(); return ok; }
  const W = h - x0; if (W < .5) return ok;
  fold.g.position.set(h, 0, 0); fold.g.rotation.y = 0; fold.g.visible = true;
  fold.path.set(f, x0, h); fold.path.progress(1); fold.path.mesh.position.set(-h, 0, 0);
  fold.path.mesh.material.color.copy(hdr(INK.d, BRIGHT)); fold.path.mesh.material.opacity = .95;
  fold.page.scale.set(W, 46, 1); fold.page.position.set(-W / 2, 22, 0); fold.page.material.opacity = .07;
  setBeam(fold.edge, V(-W, -.5, 0), V(-W, 45, 0), 1);   // the page's outer edge
  while (fold.dots.length < pts.length) { const d = new THREE.Mesh(DOT, new THREE.MeshBasicMaterial({ color: hdr(INK.pt, 1.4), depthTest: false, transparent: true })); d.renderOrder = 6; d.userData.noAO = true; fold.g.add(d); fold.dots.push(d); }
  fold.dots.forEach((d, i) => { d.visible = i < pts.length; if (i < pts.length) d.position.set(pts[i] - h, f(pts[i]), 0); });
  // turn the page toward the viewer and over
  await tween(1.5, u => { if (run === fold.run) fold.g.rotation.y = Math.PI * u; });
  if (run !== fold.run) return ok;
  const c = ok ? INK.ok : INK.bad;
  fold.path.mesh.material.color.copy(hdr(c, BRIGHT)); ok ? sfx.lock() : sfx.wrong();
  await wait(ok ? 1.1 : 1.4); if (run !== fold.run) return ok;
  if (ok) await tween(.6, u => { fold.path.mesh.material.opacity = .95 * (1 - u); fold.page.material.opacity = .07 * (1 - u); });
  else await tween(.9, u => { if (run === fold.run) fold.g.rotation.y = Math.PI * (1 - u); });
  if (run === fold.run) foldReset();
  return ok;
}

/* ---------- twins: the point being dragged, its twin, the equal distances, the level line ---------- */
const tw = { link: beam(INK.bad, .13), d1: null, d2: null };
tw.d1 = ruler('twd1', INK.d); tw.d2 = ruler('twd2', INK.d);
/** Draw the twin relation while the point at x is at height y (the twin at tx has height ty, the axis is x = h). */
export function twin(x, y, tx, ty, h) {
  if (E.INSTANT) return;
  const g = 2.6;   // the distance rulers run just above the ground line: below it the caption would cover them
  tw.d1.set(V(h, g, 0), V(x, g, 0), ltr(n(Math.abs(x - h)))); tw.d2.set(V(tx, g, 0), V(h, g, 0), ltr(n(Math.abs(h - tx))));   // metres, as every length on the paper
  const same = Math.abs(y - ty) < 1e-6;
  tint(tw.link, same ? INK.ok : INK.bad); setBeam(tw.link, V(tx, ty, 0), V(x, y, 0), 1);
}
export function twinOff() { tw.link.visible = false; tw.d1.hide(); tw.d2.hide(); }

/* ---------- a point and its value: x along the ground, y straight up ---------- */
const XY = { x: ruler('xyx', INK.d), y: ruler('xyy', INK.h) };
export async function xy(h, k) {
  if (E.INSTANT) return;
  await grow(XY.x, V(0, 2.6, 0), V(h, 2.6, 0), ltr('x = ' + n(h)));
  await grow(XY.y, V(h + 1.2, 0, 0), V(h + 1.2, k, 0), ltr('y = ' + n(k)));
}
export function xyOff() { XY.x.hide(); XY.y.hide(); }

/* ---------- the level y = c: where the path is back at its launch height, and the midpoint of the two crossings ---------- */
const RING = new THREE.RingGeometry(.8, 1.1, 40);
const ringMesh = color => { const m = new THREE.Mesh(RING, new THREE.MeshBasicMaterial({ color: hdr(color, BRIGHT), transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide })); m.renderOrder = 6; m.userData.noAO = true; m.visible = false; scene.add(m); return m; };
const LV = { line: beam(INK.h, .07), r0: ringMesh(INK.h), r1: ringMesh(INK.h), span: ruler('lvspan', INK.d), h0: ruler('lvh0', INK.d), h1: ruler('lvh1', INK.d) };
/** The line y = c across the throw; with crossings, its two points (0 and x1 = −b/a) ringed and the gap measured. */
export function level(c, x1, { crossings = true, span = true } = {}) {
  if (E.INSTANT) return;
  setBeam(LV.line, V(-8, c, 0), V(Math.max(x1, 0) + 8, c, 0), 1);
  LV.r0.visible = LV.r1.visible = crossings; LV.r0.position.set(0, c, 0); LV.r1.position.set(x1, c, 0);
  if (crossings && span) LV.span.set(V(0, c - 3.4, 0), V(x1, c - 3.4, 0), ltr('−b/a = ' + n(x1))); else LV.span.hide();
}
/** The gap 0 … x1 split in two equal halves: the midpoint is the axis. */
export async function halve(c, x1) {
  if (E.INSTANT) return;
  LV.span.hide(); const m = x1 / 2, y = c - 3.4;
  await grow(LV.h0, V(0, y, 0), V(m, y, 0), ltr(n(m)), .6);
  await grow(LV.h1, V(m, y, 0), V(x1, y, 0), ltr(n(m)), .6);
}
export function levelOff() { LV.line.visible = LV.r0.visible = LV.r1.visible = false; LV.span.hide(); LV.h0.hide(); LV.h1.hide(); }

/* ---------- the aim: where the engineer points (a straight line), and how far gravity pulls the stone under it ---------- */
const aimF = makeFlight(scene, { color: INK.h, dashed: true, r: .16, opacity: .95, k: 1.6 });
aimF.mesh.material.depthTest = false; aimF.mesh.material.color.copy(hdr(INK.h, BRIGHT)); aimF.mesh.renderOrder = 4;
/** The straight line of the aim from the release point (0, c) with slope s, as far as x1. */
export function aim(s, x1 = 60, c = 14) { if (E.INSTANT) return; aimF.set(x => c + s * x, 0, x1); aimF.progress(1); }
export function aimOff() { aimF.hide(); }
const DROP_X = [10, 20, 30, 40, 50, 60], DROPS = DROP_X.map(x => ruler('drop' + x, INK.d, .12));
/** The gap between the aim line and the path at every 10 m, one after another: gravity's pull, 0.02x². */
export async function drops(f, s, c = 14) {
  for (const [i, x] of DROP_X.entries()) { const top = c + s * x; await grow(DROPS[i], V(x, top, 0), V(x, f(x), 0), ltr(n(top - f(x))), E.INSTANT ? 0 : .45); }
}
export function dropsOff() { DROPS.forEach(r => r.hide()); }

/** Hide everything this file draws. */
export function reset() { fold.run++; foldReset(); twinOff(); xyOff(); levelOff(); aimOff(); rulers.forEach(r => r.hide()); }
reset();
