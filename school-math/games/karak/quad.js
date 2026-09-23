// The maths of the Karak series (Jordan Grade 9, Units 2–3): pure functions of the quadratic, no scene.
// Every number the games show comes from here, and tools/tests/karak-arc.mjs brute-forces all of it.
// Every game of the series (karak-arc, karak-move, karak-land, later karak-factor …) imports this file; don't copy it.
//
// quad(a, b, c)            standard form y = ax² + bx + c (a ≠ 0) with what the lesson reads off it:
//                          f, axis (= h), vertex [h, k], up, ext ('min' | 'max'), yInt, disc, roots, range
// fromVertex(a, h, k)      vertex form y = a(x − h)² + k, as a quad
// roots(a, b, c)           the real roots, sorted: [], [x] (a double root) or [x1, x2]
// level(q, k)              where the curve is at height k: the roots of ax² + bx + (c − k) = 0
// shift(q, dx, dy)         the same curve moved dx right and dy up (a translation)
// mirror(q, x)             the x on the other side of the axis at the same height
// PARENT, movePt           the point-by-point method: the five points of y = x² and where a(x − h)² + k sends them
// moves(a, h, k)           the transformations of y = x² that give a(x − h)² + k, in the book's order
// num, poly, vform         text: Western numerals, a real minus sign, no floating-point noise

/** A number without floating-point noise (0.1 + 0.2 → 0.3), and never −0. */
export const clean = v => { const r = +(+v).toFixed(10); return Object.is(r, -0) ? 0 : r; };
export const near = (a, b, e = 1e-7) => Math.abs(a - b) <= e * Math.max(1, Math.abs(a), Math.abs(b));

export function roots(a, b, c) {
  const d = b * b - 4 * a * c, tol = 1e-12 * Math.max(1, b * b, Math.abs(4 * a * c));
  if (d < -tol) return [];
  if (Math.abs(d) <= tol) return [clean(-b / (2 * a))];
  const r = Math.sqrt(d), x1 = (-b - r) / (2 * a), x2 = (-b + r) / (2 * a);
  return [clean(Math.min(x1, x2)), clean(Math.max(x1, x2))];
}
export function quad(a, b, c) {
  if (!a) throw new Error('a = 0: the function is not quadratic');
  const f = x => clean(a * x * x + b * x + c);
  const h = clean(-b / (2 * a)), k = f(h);
  return {
    a, b, c, f, h, k, axis: h, vertex: [h, k], up: a > 0, ext: a > 0 ? 'min' : 'max', yInt: c,
    disc: clean(b * b - 4 * a * c), roots: roots(a, b, c), range: [a > 0 ? '≥' : '≤', k],
  };
}
export const fromVertex = (a, h, k) => quad(a, clean(-2 * a * h), clean(a * h * h + k));
export const level = (q, k) => roots(q.a, q.b, clean(q.c - k));
export const shift = (q, dx = 0, dy = 0) => fromVertex(q.a, clean(q.h + dx), clean(q.k + dy));
export const mirror = (q, x) => clean(2 * q.h - x);
export const PARENT = [-2, -1, 0, 1, 2].map(x => [x, x * x]);
export const movePt = ([x, y], a, h, k) => [clean(x + h), clean(a * y + k)];
/** y = a(x − h)² + k from y = x²: reflect in the x-axis (a < 0), stretch (|a| > 1) or shrink (|a| < 1),
    then move right/left |h| and up/down |k|. */
export function moves(a, h, k) {
  const out = [];
  if (a < 0) out.push({ kind: 'reflect' });
  if (Math.abs(a) !== 1) out.push({ kind: Math.abs(a) > 1 ? 'stretch' : 'shrink', v: Math.abs(a) });
  if (h) out.push({ kind: h > 0 ? 'right' : 'left', v: Math.abs(h) });
  if (k) out.push({ kind: k > 0 ? 'up' : 'down', v: Math.abs(k) });
  return out;
}

/* ---------- text ---------- */
const MINUS = '−';
/** A number as the lesson writes it: at most dp decimals, trailing zeros dropped, '−' for minus. */
export function num(v, dp = 3) {
  const s = String(clean(+(+v).toFixed(dp)));
  return s.startsWith('-') ? MINUS + s.slice(1) : s;
}
const FR = [[.5, '½'], [.25, '¼'], [.75, '¾'], [1 / 3, '⅓']];
// a coefficient in front of a letter: 1 → '', −1 → '−', ½ → '½'
function coef(v) {
  const m = Math.abs(v), f = FR.find(([x]) => near(m, x));
  const body = near(m, 1) ? '' : f ? f[1] : num(m);
  return { neg: v < 0, body };
}
/** The standard form ax² + bx + c as text; v = the variable's name ('x' or 't'). */
export function poly(a, b, c, v = 'x') {
  const terms = [];
  if (a) { const k = coef(a); terms.push({ neg: k.neg, s: k.body + v + '²' }); }
  if (b) { const k = coef(b); terms.push({ neg: k.neg, s: k.body + v }); }
  if (c || !terms.length) terms.push({ neg: c < 0, s: num(Math.abs(c)) });
  return terms.map((t, i) => (i ? (t.neg ? ` ${MINUS} ` : ' + ') : t.neg ? MINUS : '') + t.s).join('');
}
/** The vertex form a(x − h)² + k as text. */
export function vform(a, h, k, v = 'x') {
  const A = coef(a), sq = h ? `(${v} ${h > 0 ? MINUS : '+'} ${num(Math.abs(h))})²` : v + '²';
  return (A.neg ? MINUS : '') + A.body + sq + (k ? ` ${k < 0 ? MINUS : '+'} ${num(Math.abs(k))}` : '');
}
export const pt = (x, y) => `(${num(x)}, ${num(y)})`;
