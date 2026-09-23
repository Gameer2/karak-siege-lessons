// The numbers of the Karak series' first three games: every throw, table, target and book item they show, built
// with the series' maths (./quad.js). karak-arc = 2.3, karak-move = 2.4, karak-land = 3.1. The tests
// (tools/tests/karak-*.mjs) check each one against the book's own answers. Heights and distances are in metres,
// x from the trebuchet.
import { quad, fromVertex, shift, level } from './quad.js';

/* ---------- the throws (all three games) ---------- */
// the first throw: the stone leaves the sling 14 m up; it lands 70 m away; the top of its path is (30, 32)
export const T0 = quad(-0.02, 1.2, 14);
export const landing = q => { const r = q.roots; return r.length ? r[r.length - 1] : null; };
/** The roll s that lands the first throw at distance d (the larger root of −0.02(x − 30 − s)² + 32 = 0). */
export const rollFor = d => d - landing(T0);

/* ---------- karak-arc (2.3): the watchmen's table, the lighter counterweight ---------- */
export const TABLE_X = [0, 10, 20, 30, 40, 50, 60, 70];     // the watchmen's table
export const PLOT_X = [10, 20, 40, 50];                       // the points the player plots by hand
export const T1 = quad(-0.04, 1.6, 14);                       // the five-step graph: axis x = 20, vertex (20, 30)
export const T1_EXTRA = 10;                                   // its "one more point" on the y-intercept's side

/* ---------- karak-move (2.4): moving the trebuchet is a transformation ---------- */
export const ROLL = -10;                                      // roll it back 10 m on its log rollers
export const LIFT = 6;                                        // then raise it 6 m on a timber crib
export const rolled = s => shift(T0, s, 0);
export const lifted = (s, L) => shift(T0, s, L);
// the board's targets from y = x², [a, h, k]: 2.4 Ex 1 (x² + 2, x² − 3), Ex 2 ((x − 3)², (x + 2)²)
export const TRANSLATE = [[1, 0, 2], [1, 0, -3], [1, 3, 0], [1, -2, 0]];
// 2.4 Ex 3 (2x², ½x²), the reflection −x², Ex 4 (−4x², −⅓x² + 2)
export const SHAPE = [[2, 0, 0], [0.5, 0, 0], [-1, 0, 0], [-4, 0, 0], [-1 / 3, 0, 2]];
export const TOWER = 50;                                      // the siege tower on the ridge, just across the moat

/* ---------- karak-land (3.1): where it lands ---------- */
export const MANTLET = 75;                                    // hit the mantlet: roll forward until a root is 75
export const LEVELS = { two: 24, one: T0.k };                 // a height with 2 crossings (the wall top), with 1 (the top)

/* ---------- the book's items ---------- */
export const BOOK = {
  // 2.3
  ex1: quad(5, -10, 4),                   // Ex 1 (worked): axis x = 1, vertex (1, −1)
  order: quad(2, -8, 0),                  // −8x + 2x²: put it in order, then the vertex (2, −8)
  ex2up: quad(1, 6, 9),                   // Ex 2: up, vertex (−3, 0), minimum 0, range y ≥ 0
  ex2down: quad(-0.5, 1, 4),              // Ex 2: down, vertex (1, 4.5), maximum 4.5, range y ≤ 4.5
  ex4graph: fromVertex(-1, -2, 2),        // Ex 4: read it from the graph: vertex (−2, 2), maximum 2, range y ≤ 2
  ex5: quad(-3, 6, 5),                    // Ex 5: graph it in five steps
  ex5extra: -1,                           //   its "one more point": x = −1
  hisham: quad(-2, -16, 7),               // find the error: the axis is x = −4
  fireworks: quad(-16, 72, 520),          // Ex 3: the firework star, h(t) = −16t² + 72t + 520
  football: quad(-16, 64, 0),             // check: the football h(t) = −16t² + 64t, highest 64 at t = 2
  checkAxis: quad(1, 2, -1),              // check: the axis and vertex of x² + 2x − 1 → x = −1, (−1, −2)
  checkMin: quad(2, -2, 8),               // check: 2x² − 2x + 8 has a minimum, 7.5 at x = 0.5
  five2: quad(1, -4, -5),                 // check: graph x² − 4x − 5: vertex (2, −9), (0, −5), x = 1 → (1, −8)
  five2extra: 1,
  // 2.4
  desc: fromVertex(-2, -2, 3),            // Ex 5: reflect, stretch 2, left 2, up 3
  check: fromVertex(-0.5, 3, -5),         // check: reflect, shrink ½, right 3, down 5
  described: [2, 3, -10],                 // practice: describe 2(x − 3)² − 10
  matchC: fromVertex(-0.5, -3, 8),        // practice: match c(x) = −½(x + 3)² + 8 to its graph
  fuel: quad(-10, 0, 200),                // context: fuel left in a machine, l(t) = −10t² + 200
  kick: fromVertex(-6, 2, 24),            // international: highest 24 m at 2 s, lands at 4 s
  // 3.1
  ex1roots: quad(1, 2, -3),               // Ex 1: x² + 2x = 3 → x² + 2x − 3 = 0, roots −3 and 1
  ex1extra: 1,                            //   the book's "one more point": x = 1
  ex2one: quad(-1, -4, -4),               // Ex 2: one root, −2
  ex3none: quad(1, 2, 4),                 // Ex 3: no real root
  dolphin: quad(-5, 10, 0),               // problem of the day: h(t) = −5t² + 10t
  fountain: quad(-1, 3, 0),               // Ex 4: the fountain's drop, 3x − x² = 0
  nine: quad(1, 0, -9),                   // no x term: x² − 9 = 0
  twelve: quad(-12, 0, -16),              // −12x² = 16 → −12x² − 16 = 0: no real root
  sixteen: quad(1, -8, 16),               // check: x² − 8x = −16, one root
  sumprod: quad(-1, 2, 8),                // workbook: two integers with sum 2 and product −8
};
export { level };
