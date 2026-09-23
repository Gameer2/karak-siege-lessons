// The rule lab of the Karak series (piloted in karak-arc-v2; GAMES_PLAN.md "change → predict → see"): sliders for
// a, b and c of y = ax² + bx + c, live-linked to what the lesson is looking at. Every move redraws, at once:
//   target 'world'  the dashed path in the throw plane (the rule the trebuchet would follow), its vertex and the plumb
//                   line on its axis, the rule card with its coloured coefficients;
//   target 'board'  the curve on the engineer's board, its vertex, and a readout under it.
// The student drags; the beat resolves when until(q) holds (after the slider is let go). ?auto moves the sliders
// to auto by itself; E.INSTANT jumps there.
//   await lab({ start: { a, b, c }, keys: ['a'], range: { a: [min, max, step] }, target, until, auto, readout })
//   closeLab()   hides the panel and what it drew
import { $, V, E, lerp, tween, loopUntil, wait, bg } from '../engine/core.js';
import { T, tr, ltr, mathify, texInto, typeset, setLabel } from '../engine/ui.js';
import { quad, clean, poly, pt, num } from './quad.js';
import { S, ghost, trail, dot, noDot, setPlumb, AN, n, BD, renderBoard, sfx, AUTO } from './stage.js';

const COLOR = { a: 'ca', b: 'cb', c: 'cc' };
/** y = ax² + bx + c for any a, including 0 (then a line, with no vertex). */
export function rule(a, b, c) {
  if (Math.abs(a) < 1e-12) { const f = x => clean(b * x + c); return { a: 0, b, c, f, line: true }; }
  return quad(a, b, c);
}
const text = q => poly(q.a, q.b, q.c);   // poly drops a zero term, so a = 0 reads as the line bx + c
// the longest run of x in the throw plane where the curve stays on the paper (0 ≤ y ≤ 46)
function onPaper(f, x0 = -20, x1 = 100) {
  let best = null, run = null;
  for (let x = x0; x <= x1 + 1e-9; x += .25) { const y = f(x), ok = y >= -.5 && y <= 46; if (ok) { if (!run) run = [x, x]; run[1] = x; } else run = null; if (run && (!best || run[1] - run[0] > best[1] - best[0])) best = [...run]; }
  return best;
}
let L = null;
function draw() {
  const key = L.v.a + '|' + L.v.b + '|' + L.v.c; if (key === L.drawn) return; L.drawn = key;
  const q = rule(L.v.a, L.v.b, L.v.c); L.q = q;
  if (L.target === 'world' && L.preview === false) { /* by feel: the slider moves, nothing shows where the stone will go */ }
  else if (L.target === 'world') {
    const r = onPaper(q.f); if (r && r[1] - r[0] > .5) { ghost.set(q.f, r[0], r[1]); ghost.progress(1); } else ghost.hide();
    if (!q.line && q.k <= 46 && q.k >= -.5 && q.h > -20 && q.h < 100) { dot('lab', q.h, q.k, 0xe8b45a); AN.vx = V(q.h, q.k + .2, 0); setLabel('vx', ltr(pt(q.h, q.k)), 1); }
    else { noDot('lab'); setLabel('vx', null, 0); }
    if (L.axis) { if (!q.line && q.h > -15 && q.h < 90) setPlumb(q.h); else setPlumb(0, 0); }
  } else {
    BD.curves = [{ f: q.f, color: q.line ? '#98989d' : q.up ? '#9fd6df' : '#f2b45a' }];
    BD.pts = q.line ? [] : [{ x: q.h, y: q.k, color: '#e8b45a', label: pt(q.h, q.k) }];
    BD.out = L.readout ? L.readout(q) : null; renderBoard();
  }
  L.onDraw?.(q);   // the game draws what follows the rule (a level line, its crossings) in the same frame
  render();
}
function render() {
  const el = $('#lab'); if (!L || E.INSTANT) { if (el) el.hidden = true; return; }
  const q = L.q; el.hidden = false;
  if (!el.__built) {
    el.__built = true;
    el.innerHTML = `<h5 id="lab-t"></h5><div class="rule" id="lab-rule"></div>` + ['a', 'b', 'c'].map(k => `<div class="lrow" data-k="${k}"><b class="${COLOR[k]}">${k}</b><input type="range" id="lab-${k}"><output id="lab-${k}-v"></output></div>`).join('') + `<div id="lab-ends"><span></span><span></span></div><div id="lab-out"></div>`;
    ['a', 'b', 'c'].forEach(k => {
      const s = $('#lab-' + k);
      s.addEventListener('pointerdown', () => { if (L && !L.touched) { L.touched = true; el.querySelectorAll('.lrow.live').forEach(r => r.classList.remove('live')); } });
      s.addEventListener('input', () => { if (!L || !L.keys.includes(k)) return; const v = clean(+s.value); if (v === L.v[k]) return; L.v[k] = v; if (L.link) Object.assign(L.v, L.link(L.v)); sfx.tick(); draw(); });
      s.addEventListener('change', () => { if (L) L.let = true; });
      s.addEventListener('pointerup', () => { if (L) L.let = true; });
    });
  }
  const put = (el, html) => { if (el.__h !== html) { el.__h = html; el.innerHTML = html; } };   // touch the DOM only on a change
  put($('#lab-t'), mathify(T(L.title)));
  // blind: a throw by feel. No rule, no numbers, nothing to compute with: only the lever and which way is lighter
  el.classList.toggle('blind', !!L.blind);
  if (L.blind) { const [lo, hi] = el.querySelectorAll('#lab-ends span'); lo.textContent = T(L.blind[0]); hi.textContent = T(L.blind[1]); }
  for (const k of ['a', 'b', 'c']) {
    const row = el.querySelector(`.lrow[data-k="${k}"]`), s = $('#lab-' + k), live = L.keys.includes(k), [lo, hi, st] = L.range[k] || [L.v[k], L.v[k], 1];
    row.classList.toggle('fixed', !live); row.classList.toggle('live', live && !L.touched); s.disabled = !live; s.min = lo; s.max = hi; s.step = st;
    if (document.activeElement !== s && +s.value !== L.v[k]) s.value = L.v[k];
    const o = $('#lab-' + k + '-v'), t = num(L.v[k], 4); if (o.textContent !== t) o.textContent = t;   // exact: −0.025 must not read −0.03
  }
  // the rule with its coefficients in their colours (a line when a = 0)
  texInto($('#lab-rule'), 'y = ' + text(q));
  put($('#lab-out'), L.target === 'world' && L.readout ? mathify(T(L.readout(q))) : '');
}
/** Open the lab and resolve when until(q) holds. start: { a, b, c }; keys: the sliders the student may move;
    range: { a: [min, max, step] }; target: 'world' | 'board'; axis: hang the plumb on the axis (world);
    link(v) → the other coefficients when one moves (a family, e.g. a(x − 1)² + 2: { b: −2a, c: a + 2 });
    onDraw(q) → the game's own drawing that follows the rule; preview: false hides the path (a throw by feel);
    blind: [tr(low end), tr(high end)] also hides the rule and every number, leaving a lever with its two ends named;
    auto: the values ?auto and E.INSTANT go to; readout(q) → tr() under the rule. Resolves to the rule. */
export async function lab({ title, start, keys, range, target = 'world', axis = false, until, auto, readout, link = null, onDraw = null, preview = true, blind = null }) {
  L = { title, v: { ...start }, keys, range, target, axis, until, readout, link, onDraw, preview, blind, let: false, q: null, drawn: null };
  // the world lab: the thrown path steps back so the dashed rule reads on top of it
  if (target === 'world' && !E.INSTANT) { L.trailOp = trail.mesh.material.opacity; trail.mesh.material.opacity = .22; ghost.mesh.renderOrder = 4; }
  const linked = () => { if (L.link) Object.assign(L.v, L.link(L.v)); };
  if (E.INSTANT) { Object.assign(L.v, auto); linked(); draw(); return L.q; }
  S.beat = 'lab'; draw();
  if (AUTO) {
    const tok = E.RUN, from = { ...L.v };
    bg(wait(.9).then(() => tween(1.6, t => { if (tok !== E.RUN || !L) return; for (const k in auto) L.v[k] = clean(Math.round(lerp(from[k], auto[k], t) / (range[k]?.[2] || 1)) * (range[k]?.[2] || 1)); linked(); draw(); })).then(() => { if (tok === E.RUN && L) { Object.assign(L.v, auto); linked(); draw(); L.let = true; } }));
  }
  // done once the student lets go on a rule that satisfies until(); a release anywhere else just waits for the next
  await loopUntil(() => { if (!L || !L.let) return false; L.let = false; return until(L.q); });
  sfx.lock(); return L.q;
}
/** Set the lab's values from the game (an animated reset), keeping it open. */
export function labSet(v, dur = .8) {
  if (!L) return Promise.resolve(); const from = { ...L.v };
  if (E.INSTANT) { Object.assign(L.v, v); draw(); return Promise.resolve(); }
  return tween(dur, t => { if (!L) return; for (const k in v) L.v[k] = clean(lerp(from[k], v[k], t)); draw(); }).then(() => { if (L) { Object.assign(L.v, v); L.drawn = null; draw(); } });
}
export function closeLab({ keep = false } = {}) {
  const el = $('#lab'); if (el) el.hidden = true;
  if (L && L.trailOp != null) trail.mesh.material.opacity = L.trailOp;
  if (L && L.target === 'world' && !keep) { ghost.hide(); noDot('lab'); setLabel('vx', null, 0); if (L.axis) setPlumb(0, 0); }
  L = null;
}
export const labRule = () => L?.q;
