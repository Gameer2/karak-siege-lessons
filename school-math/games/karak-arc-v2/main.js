// «حصار الكرك، 1183» — the quadratic function (Jordan Grade 9, lesson 2.3), rebuilt (GAMES_PLAN.md, the user's brief of
// 2026-09-23: rebuild the story and how it explains the maths; the lines and the view easy to read; light but high quality;
// no music). It is not linked from the lesson page yet: open it beside ../karak-arc to compare.
//
// The story (a real siege): autumn 1183, Salah al-Din besieges the Crusader castle of Karak. A deep rock-cut moat keeps his
// army from the walls, so it all rests on his trebuchets. Inside the castle a wedding is under way; the groom's mother sent
// dishes from the feast out to his camp, and he asked which tower the couple were in and ordered it spared. The player is
// the young engineer at his trebuchet on the ridge: hit the north wall across the moat, and never throw a stone over it.
// Every idea of the lesson is a tool that job needs, in the book's order:
//   1 the stone's rule: what a quadratic is; take gravity away (a → 0) and the stone never comes down, so a ≠ 0; y = x²
//   2 the scouts' table: 14 m at the trebuchet and 14 m at the wall, so the path is symmetric about x = 30; two lost cells
//     found from symmetry; the vertex, the maximum point vs the maximum value; a lighter throw's axis found before firing
//   3 the master's formula: x = −b/2a derived; the book's worked example; a heavier stone: find b so it strikes the wall at
//     its launch height (axis 30), then move b and fire; a check
//   4 the drawbridge chain: a > 0 opens up (the chain's minimum), a < 0 opens down (the stone's maximum); flipping a;
//     the book's examples; domain and range; reading a graph; a check
//   5 the night strike: no test shots in the dark; the book's five-step example, then the player draws the night throw
//     (its reflected y-intercept is exactly where it meets the wall) and fires along the drawing
//   6 the council at dawn: a mixed review, what this learner missed first
//   the siege workshop: the book's items, then the wedding order: choose b so the stone hits the wall, not over it
// The world is the series' Karak mirrored (karak/world.js side 'saladin', switched on by <html data-karak="v2">): the
// trebuchet on the ridge at x = 0, the moat x ∈ [40, 60], the north wall's face x = 60 (top 24 m), the wedding tower just
// behind it. Every number is computed from its rule; tools/tests/karak-arc-v2.mjs checks them.
import * as THREE from 'three';
import { V, E, bg, wait, tween, setBeam, canvasTex } from '../engine/core.js';
import { ltr, tr, T, mathify, objective, objProgress, objDone, caption, addEntry, veil, eqToCodex, setLabel, label, chip, clearChip } from '../engine/ui.js';
import { awaitInput, setCursor, ray, setNdc } from '../engine/input.js';
import { pickReview } from '../engine/teach.js';
import { clean, poly, pt, quad, num } from '../karak/quad.js';
import { T0, BOOK } from '../karak/data.js';
import { n, hx, pq, sub, axisCalc, cf, cam, S, K, scene, trail, ghost, turned, pairB, point, vertexMark, setPlumb,
  showCard, redrawCard, explain, ask, predict, typed, idea, showBoard, hideBoard, BD, renderBoard, boardPick, fiveStep, fireBeat, throwStone, plotBeat, plumbBeat, reflectBeat,
  freshPlane, shotP, shotV, VIEW, TB, stone, setFormula, workshop, boot, ring, noRing, sfx, AUTO, grid, ticks, revealGrid, hideGrid } from '../karak/stage.js';
import { lab, labSet, closeLab } from '../karak/lab.js';
import * as SHOW from './show.js';
import * as STORY from './story.js';

/* ======================================================================
   The siege's numbers (all from their rules)
   ====================================================================== */
const WX = K.wall.x0, WTOP = K.wall.top;                     // the north wall's face: x = 60, its top 24 m
const GIVEN = [0, 10, 20, 30, 60], LOST = [40, 50];        // the scouts' readings of the first throw; two were lost
const TL = quad(-0.02, 1, 14);      // chapter 2: a lighter counterweight: 14 m at 0 and at 50, axis 25; it hits the wall's foot (2 m)
const TH = quad(-0.025, 1.5, 14);   // chapter 3: a heavier stone (a = −0.025): b = 1.5 puts the axis at 30, so it strikes at 14 m
const CH = quad(0.05, -5, 120);     // chapter 4: the drawbridge chain over the moat: fixed at (40, 0) and (60, 0), lowest (50, −5)
// chapter 5: the night throw. Every throw before it strikes the wall at 14 m (its axis halfway, at 30), so a guess of 14
// would be copied, not felt. The night's new counterweight puts the axis past halfway, and each play draws one of three:
// the extra point x = 2h − 60 reflects exactly onto the wall's face, and that is where it strikes (20, 23 or 17 m).
const NIGHTS = [quad(-0.01, 0.7, 14), quad(-0.0075, 0.6, 14), quad(-0.0025, 0.2, 14)];   // axes 35, 40, 40; tops 26.25, 26, 18
let TN = NIGHTS[0], TN_EXTRA = 10;
const drawNight = () => { TN = NIGHTS[Math.floor(Math.random() * NIGHTS.length)]; TN_EXTRA = clean(2 * TN.h - WX); };
drawNight();
const Y = q => ltr('y = ' + pq(q));
const plus = (a, b) => tr(a.ar + b.ar, a.en + b.en);
const at60 = q => clean(q.f(WX));
const CHECK = tr('أتحقق من فهمي', 'Check your understanding');

/* ======================================================================
   Notes («لماذا؟») and the codex
   ====================================================================== */
const NOTES = {
  wedding: { title: tr('لماذا لا نرمي فوق السور؟', 'Why never over the wall?'),
    text: tr('في أثناء الحصار كان داخل القلعة عرس. أرسلت أمّ العريس أطباقاً من طعام العرس إلى معسكر صلاح الدين، فسأل عن البرج الذي فيه العروسان وأمر ألّا تُرمى عليه حجارة. لذلك يجب أن يصيب كل حجر وجه السور، ولا يطير فوقه إلى داخل القلعة.',
      'During the siege a wedding was held inside the castle. The groom’s mother sent dishes from the feast out to Salah al-Din’s camp; he asked which tower the couple were in and ordered that no stone be thrown at it. So every stone must strike the face of the wall, never fly over it into the castle.') },
  a0: { title: tr(`لماذا ${ltr('a ≠ 0')}؟`, `Why ${ltr('a ≠ 0')}?`),
    text: tr(`لو كان ${ltr('a = 0')} لاختفى الحد ${ltr('x²')} وصار ${ltr('f(x) = bx + c')}: اقتران خطي رسمه مستقيم، لا قطع مكافئ. في الرمية، a هو أثر الجاذبية: من دونه لا يعود الحجر إلى الأرض.`,
      `If ${ltr('a = 0')} the ${ltr('x²')} term vanishes and ${ltr('f(x) = bx + c')} is left: a linear function, whose graph is a line, not a parabola. In the throw, a is gravity’s mark: without it the stone never comes back down.`) },
  parabola: { title: tr('لماذا قطع مكافئ؟', 'Why a parabola?'),
    text: tr('الحجر يتقدّم أفقياً بسرعة ثابتة، والجاذبية تسحبه نحو الأسفل مسافةً تكبر مع مربّع الزمن. فالارتفاع اقتران تربيعي في المسافة، ورسم كل اقتران تربيعي قطع مكافئ (إذا أهملنا مقاومة الهواء).',
      'The stone moves forward at a steady speed while gravity pulls it down by a distance that grows with the square of the time. So its height is a quadratic function of the distance, and the graph of every quadratic is a parabola (leaving out air resistance).') },
  symmetry: { title: tr('لماذا المسار متماثل؟', 'Why is the path symmetric?'),
    text: tr('يصعد الحجر ويهبط بالطريقة نفسها: قبل القمة بزمن ما وبعدها بالزمن نفسه يكون على الارتفاع نفسه، وقد تقدّم المسافة نفسها لأن سرعته الأفقية ثابتة. لذلك يتكرر كل ارتفاع على بعدين متساويين من خط القمة.',
      'The stone rises and falls the same way: a given time before the top and the same time after it, it is at the same height, and it has moved the same distance because its forward speed is steady. So every height repeats at equal distances from the line through the top.') },
  chain: { title: tr('هل السلسلة قطع مكافئ حقاً؟', 'Is the chain really a parabola?'),
    text: tr('السلسلة المعلّقة بين نقطتين تأخذ منحنى قريباً جداً من القطع المكافئ حين يكون ترهّلها صغيراً مقارنة بطولها. أما الجسر المعلّق الذي يحمل طريقاً ثقيلاً فكابله قطع مكافئ بدقة.',
      'A chain hanging between two points takes a curve very close to a parabola when its sag is small compared with its length. The cable of a suspension bridge carrying a heavy road is exactly a parabola.') },
  range: { title: tr(`لماذا المدى ${ltr('y ≤ ' + n(T0.k))}؟`, `Why is the range ${ltr('y ≤ ' + n(T0.k))}?`),
    text: tr(`الرأس أعلى نقطة لأن ${ltr('a < 0')}، فكل ارتفاع آخر أقل من ${ltr(n(T0.k))}. أما المجال فكل الأعداد الحقيقية، لأن القاعدة تقبل أيّ x؛ وفي الرمية نفسها تهمّنا فقط ${ltr('0 ≤ x ≤ 60')}، من المنجنيق إلى السور.`,
      `The vertex is the highest point because ${ltr('a < 0')}, so every other height is below ${ltr(n(T0.k))}. The domain is all real numbers, because the rule accepts any x; for the throw itself only ${ltr('0 ≤ x ≤ 60')} matters, from the trebuchet to the wall.`) },
};
const FORMULA = ['f(x) = ax² + bx + c', `h(${n(T0.h)} − d) = h(${n(T0.h)} + d)`, 'x = −b/2a'];
const EX1 = BOOK.ex1;
const codexHow = L => { const ar = L === 'ar', m = s => `<span class="m">${s}</span>`;
  return ar ? `<p><b>المصطلحات:</b> الاقتران التربيعي ${m('f(x) = ax² + bx + c')} حيث ${m('a ≠ 0')} (الصورة القياسية)، والاقتران الرئيس ${m('y = x²')}. رسمه قطع مكافئ له رأس ومحور تماثل. نقطة القيمة العظمى هي النقطة ${m('(x, y)')}، والقيمة العظمى هي ${m('y')} وحدها.</p>
<ol><li>المحور ${m('x = −b/2a')}، والرأس ${m('(−b/2a, f(−b/2a))')}. مثال: ${m(poly(EX1.a, EX1.b, EX1.c))}: المحور ${m('x = 1')} والرأس ${m('(1, −1)')}. رتّب الحدود أولاً: ${m('5 + 16x − 2x²')} فيه ${m('a = −2')}. إذا ${m('b = 0')} فالرأس على محور y.</li>
<li>${m('a > 0')}: يفتح للأعلى (السلسلة)، والرأس نقطة قيمة صغرى، والمدى ${m('y ≥ k')}. ${m('a < 0')}: يفتح للأسفل (الحجر)، والرأس نقطة قيمة عظمى، والمدى ${m('y ≤ k')}. المجال كل الأعداد الحقيقية.</li>
<li>من الرسم نقرأ: الرأس، ومحور التماثل المارّ به، والقيمة العظمى أو الصغرى، والمجال والمدى.</li>
<li>الرسم بخمس خطوات: الاتجاه والمحور والرأس؛ المقطع y عند ${m('x = 0')}؛ نقطة أخرى في جهة المقطع؛ عيّن النقاط واعكسها حول المحور؛ صِلها بمنحنى أملس.</li></ol>`
  : `<p><b>Terms:</b> a quadratic function ${m('f(x) = ax² + bx + c')} with ${m('a ≠ 0')} (standard form); the parent function ${m('y = x²')}. Its graph is a parabola with a vertex and an axis of symmetry. The maximum point is the point ${m('(x, y)')}; the maximum value is its ${m('y')} alone.</p>
<ol><li>The axis is ${m('x = −b/2a')}, the vertex ${m('(−b/2a, f(−b/2a))')}. Example: ${m(poly(EX1.a, EX1.b, EX1.c))}: axis ${m('x = 1')}, vertex ${m('(1, −1)')}. Order the terms first: in ${m('5 + 16x − 2x²')}, ${m('a = −2')}. If ${m('b = 0')} the vertex is on the y-axis.</li>
<li>${m('a > 0')}: opens up (the chain), the vertex is a minimum point, range ${m('y ≥ k')}. ${m('a < 0')}: opens down (the stone), the vertex is a maximum point, range ${m('y ≤ k')}. The domain is all real numbers.</li>
<li>From a graph we read the vertex, the axis of symmetry through it, the maximum or minimum value, the domain and the range.</li>
<li>Graphing in five steps: direction, axis and vertex; the y-intercept at ${m('x = 0')}; one more point on the y-intercept's side; plot them and reflect them in the axis; join them with a smooth curve.</li></ol>`; };
const CODEX = {
  how: { get ar() { return codexHow('ar'); }, get en() { return codexHow('en'); } },
  why: tr(Object.values(NOTES).map(nt => `<p><b>${nt.title.ar}</b> ${mathify(nt.text.ar)}</p>`).join(''), Object.values(NOTES).map(nt => `<p><b>${nt.title.en}</b> ${mathify(nt.text.en)}</p>`).join('')),
};

/* ======================================================================
   The siege's own pieces: the drawbridge chain over the moat, the wedding tower's lanterns, torches on the wall
   ====================================================================== */
const glowTex = canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,236,190,1)'); g.addColorStop(.25, 'rgba(255,190,90,.75)'); g.addColorStop(1, 'rgba(255,150,60,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .35 });
const lights = new THREE.Group(); lights.name = 'siege-lights'; scene.add(lights);
const glow = (x, y, z, s) => { const sp = new THREE.Sprite(glowMat); sp.position.set(x, y, z); sp.scale.setScalar(s); sp.userData.noAO = true; lights.add(sp); };
// the wedding tower (the tall middle north tower just behind the wall): lanterns round its top and down its face
for (let x = WX - 3.6; x <= WX + 7.6; x += 2.8) { glow(x, WTOP + 7.6, -3.6, 1.6); glow(x, WTOP + 7.6, -14.4, 1.6); }
for (const y of [9, 15, 21]) glow(WX - 4.3, y, -9, 1.3);
// torches along the wall's walk
for (let z = -30; z <= 30; z += 7.5) if (z < -15 || z > -3) glow(WX + .4, WTOP + 2.4, z, 1.9);
// the wedding banner on the tower's face
{ const t = canvasTex(64, 128, (c, w, h) => { c.fillStyle = '#1f6b4a'; c.fillRect(0, 0, w, h); c.fillStyle = '#d9a441'; for (let y = 10; y < h; y += 24) c.fillRect(0, y, w, 6); c.fillStyle = '#f5efe4'; c.beginPath(); c.moveTo(0, h); c.lineTo(w / 2, h - 18); c.lineTo(w, h); c.fill(); });
  const b = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 7), new THREE.MeshStandardMaterial({ map: t, roughness: .9, side: THREE.DoubleSide, envMapIntensity: .2 }));
  b.position.set(WX + 2, WTOP + 1, -3.9); scene.add(b); }
// the old drawbridge's chain, fastened at the moat's two edges: y = 0.05x² − 5x + 120, links along the curve
{
  const pts = []; let prev = V(40, CH.f(40), 0);
  for (let x = 40; x <= 60.001; x += .02) { const p = V(x, CH.f(x), 0); if (!pts.length || p.distanceTo(prev) >= .34) { pts.push(p); prev = p; } }
  const geo = new THREE.TorusGeometry(.19, .055, 6, 12), im = new THREE.InstancedMesh(geo, K.mats.iron, pts.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  pts.forEach((p, i) => { const d = (pts[i + 1] || p).clone().sub(pts[i - 1] || p); e.set(i % 2 ? Math.PI / 2 : 0, 0, Math.atan2(d.y, d.x)); q.setFromEuler(e); im.setMatrixAt(i, m.compose(p, q, V(1.25, 1, 1))); });
  im.castShadow = true; scene.add(im);
  for (const x of [40, 60]) { const r = new THREE.Mesh(new THREE.TorusGeometry(.4, .09, 8, 16), K.mats.iron); r.position.set(x, .2, 0); scene.add(r); }
}
/** Day (0) → night (1): the world's light, and the lanterns burning brighter. */
const night = k => { K.setNight(k); glowMat.opacity = .35 + .65 * k; };
// the siege is told at dusk: a darker sky and a dimmer castle make the glowing lines of the maths stand out (the user's
// brief of 2026-09-23: the lines and colours must read clearly); the night strike goes to 1, the dawn council back to DUSK
const DUSK = .65;
const toNight = (k, t = 2.4) => { const k0 = K.night; return tween(t, u => night(k0 + (k - k0) * u)); };
/** Where a throw ends up, in words: over the wall, on its face, or short in the moat. */
const verdict = q => { const h = at60(q); return h > WTOP ? tr(`عند السور ${ltr(`h(${WX}) = ${n(h)}`)}: فوق السور، نحو برج العرس!`, `At the wall ${ltr(`h(${WX}) = ${n(h)}`)}: over the wall, toward the wedding tower!`)
  : h < 0 ? tr(`عند السور ${ltr(`h(${WX}) = ${n(h)}`)}: يسقط في الخندق.`, `At the wall ${ltr(`h(${WX}) = ${n(h)}`)}: it falls into the moat.`)
  : tr(`عند السور ${ltr(`h(${WX}) = ${n(h)}`)}: يصيب وجه السور.`, `At the wall ${ltr(`h(${WX}) = ${n(h)}`)}: it strikes the wall’s face.`); };

// the motion kit's rulers used across the chapters (show.js): the heights in gold
const H0 = SHOW.ruler('h0', SHOW.INK.h, .14), H1 = SHOW.ruler('h1', SHOW.INK.h, .14), C_BAR = SHOW.ruler('cbar', SHOW.INK.h, .14);

/* ======================================================================
   Try by feel, then with the lesson's tool (the user's brief of 2026-09-23): every mission opens with the engineer doing
   what anyone would do without the maths, the throw shows why it fails, and the lesson's tool then gets it right.
   ====================================================================== */
const BREACH = { x: 60, y: 14 };   // the target all along: the patched breach in the north wall, 14 m up
const PLANE0 = new THREE.Plane(V(0, 0, 1), 0);
const planeHit = e => { setNdc(e); const p = V(); return ray.ray.intersectPlane(PLANE0, p) ? p : null; };
const snap = (v, st) => clean(Math.round(v / st) * st);
label('breach', 'tag', () => V(BREACH.x + 3.2, BREACH.y + 3, 0), [0, 0]);
const showBreach = (on = true) => { if (on) ring('breach', BREACH.x, SHOW.INK.h, BREACH.y); else noRing('breach'); setLabel('breach', on ? tr('الثغرة', 'the breach') : null, on ? 1 : 0); };
/** Where a throw really ends: along the ground, into the wall's face, or over it into the castle. */
function impactX(q) { for (let x = .3; x < 130; x += .1) { const y = q.f(x); if (x > K.wall.x0 && x < K.wall.x1 && y < K.wall.top) return x; if (y <= K.ground(x, 0)) return x; } return 130; }
/** What a landing means for the engineer. */
function outcome(I) {
  if (I.what === 'wall') return Math.abs(I.y - BREACH.y) <= 1.5 ? 'breach' : 'wall';
  return I.x > K.wall.x1 ? 'over' : I.x >= K.moat.x0 ? 'moat' : 'short';
}
const SAY = {
  short: I => tr(`سقط الحجر على الأرض بعد ${ltr(n(Math.round(I.x)))} م فقط، قبل الخندق.`, `The stone came down after only ${ltr(n(Math.round(I.x)) + ' m')}, before the moat.`),
  moat: () => tr('سقط الحجر في الخندق، دون السور.', 'The stone fell into the moat, short of the wall.'),
  over: () => tr('طار الحجر فوق السور نحو برج العرس! هذا ما نهى عنه صلاح الدين.', 'The stone flew over the wall toward the wedding tower! Exactly what Salah al-Din forbade.'),
  wall: I => tr(`ضرب الحجر السور على ${ltr(n(Math.round(I.y)))} م، لا عند الثغرة (${ltr('14')} م).`, `The stone hit the wall ${ltr(n(Math.round(I.y)) + ' m')} up, not at the breach (${ltr('14 m')}).`),
  breach: () => tr('أصاب الحجر الثغرة!', 'The stone hit the breach!'),
};
/** Aim by pointing: the slope of the line from the release point (0, 14) toward the pointer. predict: the lesson's tool,
    the path the rule gives for that aim, drawn live. Resolves to the slope when the pointer is let go. */
function aimBeat({ predict = false, auto = 1.2 } = {}) {
  let s = .3, drag = false, done = false;
  const put = v => { s = Math.min(2, Math.max(0, snap(v, .05))); SHOW.aim(s); if (predict) { const q = quad(-0.02, s, 14); ghost.set(q.f, 0, impactX(q)); ghost.progress(1); } };
  if (E.INSTANT) return Promise.resolve(auto);
  S.beat = 'aim'; put(s);
  chip('aim', tr('اسحب لتصوّب', 'Drag to aim'), () => V(9, 14 + s * 9 + 4, 0), { passive: true });
  if (AUTO) { const tok = E.RUN, s0 = s; bg(wait(.9).then(() => tween(1.2, t => { if (tok === E.RUN) put(s0 + (auto - s0) * t); })).then(() => { if (tok === E.RUN) { put(auto); done = true; } })); }
  return awaitInput({
    down(e) { const p = planeHit(e); if (!p) return; clearChip('aim'); drag = true; setCursor('grabbing'); put((p.y - 14) / Math.max(p.x, 3)); },
    move(e) { const p = planeHit(e); if (!p) return; if (drag) { const s0 = s; put((p.y - 14) / Math.max(p.x, 3)); if (s !== s0) sfx.tick(); } else setCursor('crosshair'); },
    up() { if (!drag) return; drag = false; setCursor('default'); done = true; },
  }, () => done).then(() => { clearChip('aim'); return s; });
}
/** A guess on the wall's face: drag the torch up or down it; resolves to the height when let go. */
label('torch', 'tag', () => V(BREACH.x - 7.5, S.torch ?? 0, 0), [0, 0]);   // on the moat side, clear of the breach's own tag
function torchBeat(auto = 20) {
  let y = 6, drag = false, done = false;
  const put = v => { y = Math.min(24, Math.max(0, Math.round(v))); S.torch = y; ring('torch', BREACH.x, SHOW.INK.bad, y); setLabel('torch', tr(`المشعل ${ltr(n(y))} م`, `torch ${ltr(n(y) + ' m')}`), 1); };
  if (E.INSTANT) { S.torch = auto; return Promise.resolve(auto); }
  S.beat = 'torch'; put(y);
  chip('torch', tr('اسحب المشعل', 'Drag the torch'), () => V(BREACH.x - 6, y + 3, 0), { passive: true });
  if (AUTO) { const tok = E.RUN; bg(wait(.9).then(() => tween(1, t => { if (tok === E.RUN) put(6 + (auto - 6) * t); })).then(() => { if (tok === E.RUN) done = true; })); }
  return awaitInput({
    down(e) { const p = planeHit(e); if (!p || Math.abs(p.x - BREACH.x) > 6) return; clearChip('torch'); drag = true; setCursor('grabbing'); put(p.y); },
    move(e) { const p = planeHit(e); if (!p) return; if (drag) { const y0 = y; put(p.y); if (y !== y0) sfx.tick(); } else setCursor(Math.abs(p.x - BREACH.x) < 6 ? 'ns-resize' : 'default'); },
    up() { if (!drag) return; drag = false; setCursor('default'); done = true; },
  }, () => done).then(() => { clearChip('torch'); return y; });
}
const torchOff = () => { noRing('torch'); setLabel('torch', null, 0); };
const left = k => tr(k === 2 ? 'بقي حجران' : 'بقي حجر واحد', k === 2 ? 'two stones left' : 'one stone left');

/* ======================================================================
   1 — the stone's rule. By feel: aim straight at the breach, and the stone falls short. Why: gravity pulls it under the
   aim line by 0.02x². With the rule: aim while seeing the path the rule gives, and hit. Then the rule read as what was seen.
   ====================================================================== */
const IDEAS1 = [tr('رمية بالحدس', 'A throw by feel'), tr('لماذا أخطأ الحجر؟', 'Why the stone missed'), tr('صوّب بالقاعدة', 'Aim with the rule'), tr('قاعدة الحجر', 'The stone’s rule'), tr('من دون جاذبية', 'Without gravity'), tr('الاقتران الرئيس', 'The parent function'), CHECK];
const GRAV_VIEW = { pos: V(30, 38, 165), look: V(30, 38, 0) };   // the throw and its aim line up to 86 m, straight on
async function ch1() {
  if (!E.INSTANT) { cam.cut(V(-70, 48, 130), V(40, 8, 0)); bg(veil(0, 2.4)); }
  await shotV({ pos: V(-26, 21, 60), look: V(36, 13, 0) }, 3.4);
  await STORY.title(0, tr('قاعدة الحجر', 'The stone’s rule'), tr('مهمتك الأولى: أن تصيب الثغرة في السور الشمالي.', 'Your first task: hit the breach in the north wall.'));
  await STORY.story([tr('خريف سنة 1183.', 'Autumn, 1183.'),
    tr('جيش صلاح الدين يحاصر قلعة الكرك، ويفصله عن أسوارها خندقٌ عميق نُحت في الصخر.', 'Salah al-Din’s army besieges Karak Castle, cut off from its walls by a deep moat carved into the rock.'),
    { t: tr('أنت مهندس المنجنيق. في السور الشمالي ثغرةٌ رُمّمت على عجل، على ارتفاع 14 متراً. اضربها، ولا تدع حجراً يطير فوق السور: خلفه عرس.', 'You are the trebuchet’s engineer. In the north wall is a breach, patched in a hurry, 14 metres up. Strike it, and let no stone fly over the wall: behind it is a wedding.'), small: true }]);
  await shotP(2, -14, 74); showBreach(); hideGrid();   // by feel: the plain siege, no measuring yet
  // by feel: point at the breach the way the eye would
  let lucky = false;
  for (let k = 0; k < 2 && !lucky; k++) {
    objective(tr('صوّب نحو الثغرة، ثم أطلِق', 'Aim at the breach, then fire'), T(left(2 - k)));
    if (!k) caption(tr('اسحب من المنجنيق نحو الهدف، كما تصوّب بعينك.', 'Drag from the trebuchet toward the target, the way your eye would aim.'));
    const s = await aimBeat({ auto: [0, .6][k] });
    caption(null); await fireBeat();
    const I = await throwStone(quad(-0.02, s, 14)), o = outcome(I);
    caption(SAY[o](I), null, o === 'breach' ? 'ok' : 'bad'); await wait(3.4);
    SHOW.aimOff(); lucky = o === 'breach';
  }
  objDone();
  if (!lucky) await STORY.story([tr('ضاع حجران.', 'Two stones wasted.'), { t: tr('الحجر لا يطير حيث تصوّب. لماذا؟', 'A stone does not fly where you aim it. Why?'), small: true }]);

  await idea(1);
  trail.hide(); await shotV(GRAV_VIEW, 2.2);
  caption(tr('لنقِس الرمية كما يقيسها المهندسون: ساريةٌ للارتفاع، وحبلٌ مشدود للمسافة.', 'Let us measure the throw the way engineers do: a mast for height, a taut rope for distance.'));
  await revealGrid(2.4);
  SHOW.aim(1.2); trail.set(T0.f, 0, WX); trail.progress(0); await tween(1.4, t => trail.progress(t));
  caption(tr('هذه رميةٌ أصابت الثغرة. الخط المستقيم هو اتجاه التصويب، والقوس هو ما طار فيه الحجر.', 'This throw hit the breach. The straight line is where it was aimed; the arc is where the stone flew.')); await wait(3.6);
  await SHOW.drops(T0.f, 1.2);
  caption(tr(`الجاذبية تسحب الحجر تحت خط التصويب: ⟦d|2⟧ م بعد 10 أمتار، و⟦d|8⟧ بعد 20، و⟦d|18⟧ بعد 30. ضاعِف المسافة، يتضاعف السحب أربع مرات.`, `Gravity pulls the stone under the aim line: ⟦d|2⟧ m after 10 metres, ⟦d|8⟧ after 20, ⟦d|18⟧ after 30. Double the distance and the pull grows four times.`)); await wait(4.6);
  caption(tr(`هذا السحب هو ${ltr('0.02x²')}. عند السور يبلغ ${ltr('72')} م، فمن أراد الثغرة صوّب فوقها بـ ${ltr('72')} م.`, `That pull is ${ltr('0.02x²')}. At the wall it reaches ${ltr('72 m')}, so to hit the breach you aim ${ltr('72 m')} above it.`), NOTES.parabola); await wait(4.4);
  SHOW.dropsOff(); SHOW.aimOff();

  // with the rule: the path it gives is drawn while aiming
  await idea(2);
  trail.hide(); await shotP(2, -14, 74); showBreach();
  objective(tr('صوّب من جديد، وهذه المرة ترى أين سيطير الحجر', 'Aim again; this time you see where the stone will fly'));
  caption(tr('المسار المتقطّع هو ما تقوله القاعدة. حرّكه حتى يمرّ بالثغرة.', 'The dashed path is what the rule says. Move it until it passes through the breach.'));
  for (;;) {
    const s = await aimBeat({ predict: true, auto: T0.b });
    if (Math.abs(quad(-0.02, s, 14).f(WX) - BREACH.y) < 1e-9) break;
    caption(tr('المسار لا يمرّ بالثغرة بعد. صوّب أعلى أو أخفض.', 'The path does not pass through the breach yet. Aim higher or lower.'), null, 'bad');
  }
  objDone(); objective(tr('أطلِق', 'Fire')); caption(null);
  await fireBeat(); await throwStone(T0); objDone(); ghost.hide(); SHOW.aimOff();
  await STORY.story([tr('أصاب الحجر الثغرة.', 'The stone hit the breach.'), { t: tr('عينك لم تتغيّر. الذي تغيّر أنك صرت ترى القاعدة.', 'Your eye did not change. What changed is that you can now see the rule.'), small: true }]);

  await idea(3);
  showCard({ q: T0, title: tr('قاعدة الرمية', 'The rule of the throw') });
  await SHOW.grow(C_BAR, V(.9, 0, 0), V(.9, T0.c, 0), ltr('c = ' + n(T0.c)));
  caption(tr(`⟦c|c⟧ هو ارتفاع الحجر لحظة الإطلاق: ${ltr(n(T0.c))} م.`, `⟦c|c⟧ is the stone’s height at the release: ${ltr(n(T0.c) + ' m')}.`)); await wait(3.2);
  SHOW.aim(1.2);
  caption(tr(`${ltr('1.2x + 14')} هو ⟦b|خط التصويب⟧، و${ltr('−0.02x²')} هو ⟦a|سحب الجاذبية⟧.`, `${ltr('1.2x + 14')} is ⟦b|the aim line⟧, and ${ltr('−0.02x²')} is ⟦a|gravity’s pull⟧.`)); await wait(4);
  caption(tr(`أعلى أُسٍّ في القاعدة ${ltr('2')}، لذلك نسمّيها ⟦em|اقتراناً تربيعياً⟧. صورتها القياسية ${ltr('f(x) = ax² + bx + c')}، بشرط ${ltr('a ≠ 0')}.`, `The highest power in the rule is ${ltr('2')}, so we call it ⟦em|a quadratic function⟧. Its standard form is ${ltr('f(x) = ax² + bx + c')}, provided ${ltr('a ≠ 0')}.`)); await wait(4.2);
  C_BAR.hide(); SHOW.aimOff(); showCard(null);

  await idea(4);
  objective(tr(`اسحب ⟦a|a⟧ إلى ${ltr('0')}: ماذا لو لم تكن جاذبية؟`, `Drag ⟦a|a⟧ to ${ltr('0')}: what if there were no gravity?`));
  caption(tr(`ماذا لو لم تكن جاذبية؟ اسحب مؤشر ⟦a|a⟧ في اللوحة إلى ${ltr('0')}، وراقب المسار المتقطّع.`, `What if there were no gravity? Drag the ⟦a|a⟧ slider in the panel to ${ltr('0')}, and watch the dashed path.`));
  await lab({ title: tr(`اسحب a إلى ${ltr('0')}`, `Drag a to ${ltr('0')}`), start: { a: T0.a, b: T0.b, c: T0.c }, keys: ['a'], range: { a: [-0.06, 0.02, 0.01] },
    until: q => q.a === 0, auto: { a: 0 },
    readout: q => q.line ? tr(`${ltr('a = 0')}: خط مستقيم، والحجر لا يعود.`, `${ltr('a = 0')}: a straight line; the stone never comes back.`) : plus(tr(`${ltr('a = ' + num(q.a, 3))}: قطع مكافئ. `, `${ltr('a = ' + num(q.a, 3))}: a parabola. `), verdict(q)) });
  objDone();
  caption(tr(`صار المسار خطَّ التصويب نفسه: هكذا ظننتَ أن الحجر سيطير في رميتك الأولى. لكن الحجر يسقط، لذلك ${ltr('a ≠ 0')}.`, `The path became the aim line itself: that is how you thought the stone would fly on your first throw. But stones fall, so ${ltr('a ≠ 0')}.`), NOTES.a0); await wait(4.4);
  await labSet({ a: T0.a }); closeLab();

  await idea(5);
  await shotV(VIEW.board, 1.8);
  showBoard({ win: { x0: -3, x1: 3, y0: -1, y1: 9 }, title: 'y = x²', curves: [{ f: x => x * x, color: '#38e1ff', w: 3 }], pts: [-2, -1, 0, 1, 2].map(x => ({ x, y: x * x, color: '#ffc233' })) });
  caption(tr(`أبسط أفراد العائلة ${ltr('y = x²')}: ⟦em|الاقتران الرئيس⟧، على شكل حرف U. مسار حجرك من هذه العائلة، لكنه مقلوب.`, `The simplest member of the family is ${ltr('y = x²')}: ⟦em|the parent function⟧, shaped like a U. Your stone’s path belongs to this family, upside down.`)); await wait(4.2);
  hideBoard();

  await idea(6);
  objective(CHECK, '1/2', 0);
  await ask(tr('أيّ هذه اقتران تربيعي؟', 'Which of these is a quadratic function?'), [{ v: 'lin', f: 'f(x) = 3x + 2' }, { v: 'q', f: 'f(x) = 2x² − x' }, { v: 'cub', f: 'f(x) = x³ + 1' }], 'q',
    v => v === 'lin' ? tr(`لا يوجد ${ltr('x²')}: هذا خط تصويب بلا جاذبية، اقتران خطي.`, `There is no ${ltr('x²')}: an aim line with no gravity, a linear function.`) : tr(`أعلى أُسٍّ هنا ${ltr('3')}: اقتران تكعيبي، لا تربيعي.`, `The highest power here is ${ltr('3')}: cubic, not quadratic.`), 'c1-which');
  objProgress('2/2', .5);
  await typed({ id: 'c1-a', q: tr(`اكتب قيمة a في ${ltr('f(x) = 5 + 16x − 2x²')}`, `Type the value of a in ${ltr('f(x) = 5 + 16x − 2x²')}`), expect: -2,
    why: v => v === 5 ? tr(`${ltr('5')} هو الحد الثابت c.`, `${ltr('5')} is the constant term, c.`) : v === 16 ? tr(`${ltr('16')} معامل x، أي b.`, `${ltr('16')} is the coefficient of x: that is b.`)
      : v === 2 ? tr(`انتبه للإشارة: الحد هو ${ltr('−2x²')}.`, `Mind the sign: the term is ${ltr('−2x²')}.`) : tr(`رتّب الحدود أولاً: ${ltr('−2x² + 16x + 5')}. a معامل ${ltr('x²')}.`, `Put the terms in order first: ${ltr('−2x² + 16x + 5')}. a is the coefficient of ${ltr('x²')}.`) });
  objDone();
  await eqToCodex(FORMULA[0], tr(`الاقتران التربيعي بالصورة القياسية، و ${ltr('a ≠ 0')}`, `a quadratic function in standard form, with ${ltr('a ≠ 0')}`));
  setFormula(1);
  addEntry(tr(`الاقتران التربيعي ${ltr('f(x) = ax² + bx + c')} حيث ${ltr('a ≠ 0')}: في الرمية، c ارتفاع الإطلاق، و bx + c خط التصويب، و ax² سحب الجاذبية. رسمه قطع مكافئ.`, `A quadratic function is ${ltr('f(x) = ax² + bx + c')} with ${ltr('a ≠ 0')}: in the throw, c is the release height, bx + c the aim line, ax² gravity’s pull. Its graph is a parabola.`));
}

/* ======================================================================
   2 — the scouts' table: symmetry by folding, the lost readings by twins, the vertex as a point and a value
   ====================================================================== */
const IDEAS2 = [tr('ارتفاعان متساويان', 'Two equal heights'), tr('طيّ الورقة', 'Folding the paper'), tr('القياسان الضائعان', 'The two lost readings'), tr('الرأس: نقطة وقيمة', 'The vertex: a point and a value'), tr('ثقل موازنة أخف', 'A lighter counterweight')];
const qMark = x => { label('q' + x, 'pt', () => V(x, 3.2, 0), [0, 0]); return 'q' + x; };
const Q40 = qMark(40), Q50 = qMark(50);
/** The fold on a wrong line: the page turns and misses; the caption names the line. */
const foldMiss = (f, x, pts) => { bg(SHOW.foldAt(f, x, 0, pts, false)); return tr(`عند ${ltr('x = ' + n(x))} لا ينطبق النصفان.`, `At ${ltr('x = ' + n(x))} the halves don’t meet.`); };
async function ch2() {
  freshPlane(); SHOW.reset(); [Q40, Q50].forEach(id => setLabel(id, null, 0));
  trail.set(T0.f, 0, WX); trail.progress(0);
  await shotP(2, -14, 74);
  await STORY.title(1, tr('جدول الكشّافة', 'The scouts’ table'), tr('أين تبلغ الرمية قمّتها؟ الورقة نفسها ستجيبك.', 'Where does the throw reach its top? The paper itself will answer.'));
  await tween(1.4, t => trail.progress(t));
  for (const x of GIVEN) point('' + x, x, T0.f(x));
  [Q40, Q50].forEach(id => setLabel(id, '?', 1));
  caption(tr('سجّل الكشّافة ارتفاع الحجر كل 10 أمتار، وضاع منهم قياسان.', 'The scouts logged the stone’s height every 10 metres; two readings were lost.')); await wait(3.2);

  await idea(1);
  await SHOW.grow(H0, V(.9, 0, 0), V(.9, T0.c, 0), null);
  await SHOW.grow(H1, V(WX - .9, 0, 0), V(WX - .9, T0.f(WX), 0), null);
  caption(tr('الحجر على ارتفاع ⟦h|14⟧ م عند المنجنيق، وعلى ⟦h|14⟧ م عند السور. أين قمّته إذن؟', 'The stone is ⟦h|14⟧ m up at the trebuchet, and ⟦h|14⟧ m up at the wall. So where is its top?')); await wait(3);
  objective(tr('ضع الشاقول تحت القمّة', 'Put the plumb line under the top'));
  await plumbBeat(T0.h, 8, x => foldMiss(T0.f, x, [0]));
  objDone(); caption(null);
  await SHOW.foldAt(T0.f, T0.h, 0, [0], true);
  caption(tr(`عند ${ltr('x = ' + n(T0.h))} انطبق النصفان تماماً. هذا الخط هو ⟦ax|محور التماثل⟧.`, `At ${ltr('x = ' + n(T0.h))} the halves meet exactly. This line is ⟦ax|the axis of symmetry⟧.`), NOTES.symmetry, 'ok'); await wait(3.6);
  H0.hide(); H1.hide();

  await idea(2);
  objective(tr('جد القياسين الضائعين', 'Find the two lost readings'), '0/2', 0);
  for (const [i, x] of LOST.entries()) {
    const tx = clean(2 * T0.h - x), ty = T0.f(tx);
    setLabel('q' + x, null, 0);
    await plotBeat('' + x, x, T0.f(x), { onMove: y => SHOW.twin(x, y, tx, ty, T0.h), why: () => tr(`توأم ${ltr(n(x))} هو ${ltr(n(tx))}: على البعد نفسه من المحور.`, `The twin of ${ltr(n(x))} is ${ltr(n(tx))}: the same distance from the axis.`) });
    await wait(.6); SHOW.twinOff(); objProgress(`${i + 1}/2`, (i + 1) / 2);
  }
  objDone();
  caption(tr('لكل نقطة ⟦em|توأم⟧ على البعد نفسه من المحور، وبالارتفاع نفسه.', 'Every point has ⟦em|a twin⟧ the same distance from the axis, at the same height.'), NOTES.parabola, 'ok'); await wait(3.4);

  await idea(3);
  vertexMark(T0); setLabel('p30', null, 0);
  objective(CHECK);
  await typed({ id: 'c2-max', q: tr('ما أعلى ارتفاع بلغه الحجر؟', 'What is the greatest height the stone reached?'), expect: T0.k, unit: tr('م', 'm'),
    why: v => { if (v === T0.h) bg(SHOW.xy(T0.h, T0.k)); return v === T0.h ? tr(`${ltr(n(T0.h))} بُعد القمّة على الأرض. الارتفاع هو الطول الصاعد.`, `${ltr(n(T0.h))} is how far along the ground the top is. The height is the length going up.`) : tr('انظر إلى الرأس: كم يرتفع عن الأرض؟', 'Look at the vertex: how high above the ground is it?'); } });
  objDone();
  await SHOW.xy(T0.h, T0.k);
  caption(tr(`⟦vx|الرأس⟧ ${ltr(pt(T0.h, T0.k))} نقطة لها عددان. ⟦em|القيمة العظمى⟧ هي ${ltr(n(T0.k))} وحدها: الارتفاع.`, `⟦vx|The vertex⟧ ${ltr(pt(T0.h, T0.k))} is a point with two numbers. ⟦em|The maximum value⟧ is ${ltr(n(T0.k))} alone: the height.`)); await wait(3.8);
  SHOW.xyOff();
  await eqToCodex(FORMULA[1], tr('كل ارتفاع يتكرر على بعدين متساويين من محور التماثل', 'every height repeats at equal distances from the axis of symmetry'));
  setFormula(2);
  addEntry(tr('القطع المكافئ متماثل حول مستقيم رأسي هو محور التماثل، والرأس عليه.', 'A parabola is symmetric about a vertical line, the axis of symmetry, and the vertex is on it.'));
  addEntry(tr(`نقطة القيمة العظمى ${ltr(pt(T0.h, T0.k))}؛ القيمة العظمى <span class="num">${n(T0.k)}</span>، أي y وحدها.`, `The maximum point is ${ltr(pt(T0.h, T0.k))}; the maximum value is <span class="num">${n(T0.k)}</span>, y alone.`));

  await idea(4);
  freshPlane(); SHOW.reset();
  showCard({ q: TL, title: tr('ثقل موازنة أخف', 'A lighter counterweight') });
  await SHOW.grow(H0, V(.9, 0, 0), V(.9, TL.c, 0), null);
  await SHOW.grow(H1, V(50 - .9, 0, 0), V(50 - .9, TL.f(50), 0), null);
  point('0', 0, TL.c); point('50', 50, TL.f(50));
  caption(tr(`بثقل أخف رأى الكشّافة الحجر على ${ltr('14')} م عند ${ltr('x = 0')} وعند ${ltr('x = 50')}.`, `With a lighter counterweight the scouts saw the stone ${ltr('14 m')} up at ${ltr('x = 0')} and at ${ltr('x = 50')}.`)); await wait(3.2);
  objective(tr('ضع الشاقول تحت القمّة الجديدة، قبل أن ترمي', 'Put the plumb line under the new top, before you throw'));
  await plumbBeat(TL.h, 8, x => foldMiss(TL.f, x, [0]));
  objDone(); showCard(null); caption(null);
  await SHOW.foldAt(TL.f, TL.h, 0, [0], true);
  H0.hide(); H1.hide();
  objective(tr('أطلِق لتتأكد', 'Fire to make sure'));
  await fireBeat(); await throwStone(TL); objDone();
  vertexMark(TL);
  caption(tr(`القمّة فوق ${ltr('x = ' + n(TL.h))}، حيث علّقت الشاقول. والحجر ضرب أسفل السور.`, `The top is over ${ltr('x = ' + n(TL.h))}, where you hung the plumb line. The stone struck the foot of the wall.`), null, 'ok'); await wait(3.8);
}

/* ======================================================================
   3 — the master's formula. By feel: a heavier stone, the counterweight moved by feel, two stones, and a miss. The tool:
   x = −b/2a, built on the paper line by line. With it: b worked out first, one stone, the breach.
   ====================================================================== */
const IDEAS3 = [tr('حجر أثقل بالإحساس', 'A heavier stone by feel'), tr('من أين يأتي المحور؟', 'Where the axis comes from'), tr('مثال محلول', 'A worked example'), tr('احسب ثم ارمِ', 'Work it out, then throw'), CHECK];
async function ch3() {
  freshPlane(); SHOW.reset();
  await shotP(2, -14, 74);
  await STORY.title(2, tr('قانون المعلّم', 'The master’s formula'), tr('حجارة أثقل وصلت، ومعك حجران فقط للتجربة.', 'Heavier stones have arrived, and you have only two to try with.'));
  showBreach(); hideGrid();
  caption(tr('الحجر الأثقل تسحبه الجاذبية أكثر. اضبط ثقل الموازنة بإحساسك، وأطلق.', 'Gravity pulls the heavier stone harder. Set the counterweight by feel, and fire.')); await wait(3.4);
  // the lever's two ends move each play (b from 0.6, 0.8 or 1.0 to 1.2 more): where 1.5 sits on it is never the same
  let lucky = false; const lo = [0.6, 0.8, 1][Math.floor(Math.random() * 3)], b0 = clean(lo + 0.1 * Math.floor(Math.random() * 5));
  for (let k = 0; k < 2 && !lucky; k++) {
    objective(tr('اضبط ثقل الموازنة بإحساسك، ثم أطلِق', 'Set the counterweight by feel, then fire'), T(left(2 - k)));
    if (k) caption(tr('اسحب ثقل الموازنة في اللوحة إلى موضع آخر، ثم أطلق.', 'Drag the counterweight in the panel to another position, then fire.'));
    const q = await lab({ title: tr('ثقل الموازنة', 'The counterweight'), start: { a: TH.a, b: b0, c: TH.c }, keys: ['b'], range: { b: [lo, clean(lo + 1.2), 0.1] }, preview: false,
      blind: [tr('أخف', 'lighter'), tr('أثقل', 'heavier')], until: () => true, auto: { b: [1.1, 1.8][k] } });
    closeLab(); objDone(); await fireBeat();
    const I = await throwStone(quad(TH.a, q.b, TH.c)), o = outcome(I);
    caption(SAY[o](I), null, o === 'breach' ? 'ok' : 'bad'); await wait(3.4); lucky = o === 'breach';
  }
  if (!lucky) await STORY.story([tr('نفدت حجارة التجربة.', 'The trial stones are gone.'), { t: tr('كل تخمين يكلّف حجراً. نحتاج قانوناً يدلّنا على القمّة قبل أن نرمي.', 'Every guess costs a stone. We need a law that shows us the top before we throw.'), small: true }]);

  await idea(1);
  freshPlane(); SHOW.reset(); hideGrid();
  await shotP(2, -14, 74); await revealGrid(1.6);
  trail.set(T0.f, 0, WX); trail.progress(1); vertexMark(T0); setPlumb(T0.h);
  objective(tr('ابنِ قانون المحور خطوة خطوة', 'Build the axis formula step by step'));
  await explain(tr('من أين يأتي المحور؟', 'Where does the axis come from?'), [
    { line: 'f(0) = c', do: () => SHOW.grow(C_BAR, V(.9, 0, 0), V(.9, T0.c, 0), ltr('c = ' + n(T0.c))), say: tr(`عند ${ltr('x = 0')} يبقى ⟦c|c⟧ وحده: ارتفاع الإطلاق.`, `At ${ltr('x = 0')} only ⟦c|c⟧ is left: the release height.`) },
    { line: 'ax² + bx + c = c', do: () => { C_BAR.hide(); SHOW.level(T0.c, -T0.b / T0.a, { crossings: false }); }, say: tr(`أين يعود الحجر إلى الارتفاع ⟦c|c⟧ نفسه؟ هذا ما تسأله المعادلة.`, `Where is the stone back at the same height ⟦c|c⟧? That is what this equation asks.`) },
    { line: 'ax² + bx = 0', say: tr(`نطرح ${ltr('c')} من الطرفين.`, `Take ${ltr('c')} from both sides.`) },
    { line: 'x(ax + b) = 0', say: tr(`نُخرج ${ltr('x')} عاملاً مشتركاً.`, `Take ${ltr('x')} out as a common factor.`) },
    { ask: { q: tr(`${ltr('x(ax + b) = 0')}. ما حلّاها؟`, `${ltr('x(ax + b) = 0')}. What are its solutions?`), opts: [{ v: 'a', f: 'x = 0, x = −b/a' }, { v: 'b', f: 'x = b/a' }, { v: 'c', f: 'x = −b/2a' }], answer: 'a',
        why: v => v === 'b' ? tr(`حاصل ضرب يساوي صفراً: إما ${ltr('x = 0')} أو ${ltr('ax + b = 0')}، أي ${ltr('x = −b/a')}. انتبه للإشارة.`, `A product is zero: either ${ltr('x = 0')} or ${ltr('ax + b = 0')}, so ${ltr('x = −b/a')}. Mind the sign.`) : tr(`ليس بعد: ${ltr('ax + b = 0')} يعطي ${ltr('x = −b/a')}، والحل الآخر ${ltr('x = 0')}.`, `Not yet: ${ltr('ax + b = 0')} gives ${ltr('x = −b/a')}, and the other solution is ${ltr('x = 0')}.`) },
      line: 'x = 0 , x = −b/a', do: () => SHOW.level(T0.c, -T0.b / T0.a), say: tr(`يعود الحجر إلى ارتفاعه في نقطتين: ${ltr('0')} و ${ltr('−b/a')}.`, `The stone is back at its height at two points: ${ltr('0')} and ${ltr('−b/a')}.`) },
    { line: 'x = (0 + (−b/a)) ÷ 2 = −b/2a', do: () => SHOW.halve(T0.c, -T0.b / T0.a), say: tr('و⟦ax|المحور⟧ في منتصفهما تماماً. هذا قانون محور التماثل.', 'And ⟦ax|the axis⟧ is exactly halfway between them. That is the formula for the axis of symmetry.') },
    { line: `−b/a = −(${n(T0.b)}) ÷ (${n(T0.a)}) = ${n(-T0.b / T0.a)} ,  x = ${n(T0.h)}`, say: tr(`في الرمية الأولى ${ltr('−b/a = ' + n(-T0.b / T0.a))}: السور نفسه، والمحور ${ltr(n(T0.h))} حيث علّقت الشاقول.`, `In the first throw ${ltr('−b/a = ' + n(-T0.b / T0.a))}: the wall itself, and the axis is ${ltr(n(T0.h))}, where you hung the plumb line.`) },
  ]);
  objDone(); SHOW.levelOff();
  await eqToCodex('x = −b/2a', tr(`محور التماثل، والرأس عليه: ${ltr('(−b/2a, f(−b/2a))')}`, `the axis of symmetry, with the vertex on it: ${ltr('(−b/2a, f(−b/2a))')}`));
  setFormula(3); showCard(null);

  await idea(2);
  objective(tr('تابع المثال المحلول', 'Follow the worked example'));
  await explain(tr(`مثال محلول: ${ltr('f(x) = 5x² − 10x + 4')}`, `Worked example: ${ltr('f(x) = 5x² − 10x + 4')}`), [
    { line: 'a = 5 ,  b = −10', say: tr('نقرأ a و b من الصورة القياسية.', 'Read a and b from the standard form.') },
    { line: 'x = −(−10) ÷ (2 × 5) = 1', say: tr(`نعوّض في ${ltr('x = −b/2a')}. انتبه: ${ltr('−(−10) = 10')}.`, `Substitute into ${ltr('x = −b/2a')}. Careful: ${ltr('−(−10) = 10')}.`) },
    { line: 'f(1) = 5(1)² − 10(1) + 4 = −1', say: tr('ونعوّض x في القاعدة لنجد ارتفاع الرأس.', 'Then substitute x into the rule for the vertex’s height.') },
    { line: tr(`الرأس ${ltr('(1, −1)')}`, `vertex ${ltr('(1, −1)')}`), say: tr(`المحور ${ltr('x = 1')}، والرأس ${ltr('(1, −1)')}.`, `The axis is ${ltr('x = 1')}, and the vertex is ${ltr('(1, −1)')}.`) },
  ]);
  objDone(); showCard(null);

  // with the tool: the axis must be halfway to the wall, so b is worked out before a single stone is spent
  await idea(3);
  freshPlane(); SHOW.reset(); await shotP(1.6, -14, 74); showBreach();
  caption(tr(`ليضرب الحجر الثقيل الثغرة على ارتفاع إطلاقه، يجب أن يكون ⟦ax|المحور⟧ في منتصف الطريق إلى السور: ${ltr('x = 30')}.`, `For the heavy stone to strike the breach at its release height, ⟦ax|the axis⟧ must be halfway to the wall: ${ltr('x = 30')}.`)); await wait(4);
  objective(tr('احسب b أولاً', 'Work out b first'));
  await typed({ id: 'c3-b', q: tr(`${ltr('a = −0.025')}. أيّ قيمة لـ b تجعل ${ltr('−b/2a = 30')}؟`, `${ltr('a = −0.025')}. Which b makes ${ltr('−b/2a = 30')}?`), expect: TH.b,
    why: v => tr(`${ltr(`x = −(${n(v)}) ÷ (2 × (−0.025)) = ${n(clean(v / 0.05))}`)}، لا ${ltr('30')}.${v === 0.75 ? ` ${ltr('2a = −0.05')}، لا ${ltr('−0.025')}.` : ''}`, `${ltr(`x = −(${n(v)}) ÷ (2 × (−0.025)) = ${n(clean(v / 0.05))}`)}, not ${ltr('30')}.${v === 0.75 ? ` ${ltr('2a = −0.05')}, not ${ltr('−0.025')}.` : ''}`) });
  objDone();
  objective(tr(`اضبط b على ${ltr(n(TH.b))} وراقب الشاقول`, `Set b to ${ltr(n(TH.b))} and watch the plumb line`));
  caption(tr(`اسحب مؤشر ⟦b|b⟧ في اللوحة إلى ${ltr(n(TH.b))}.`, `Drag the ⟦b|b⟧ slider in the panel to ${ltr(n(TH.b))}.`));
  await lab({ title: tr(`غيّر b: الشاقول يتبع ${ltr('−b/2a')}`, `Change b: the plumb line follows ${ltr('−b/2a')}`), start: { a: TH.a, b: 1.1, c: TH.c }, keys: ['b'], range: { b: [0.8, 2, 0.1] }, axis: true,
    until: q => q.h === TH.h, auto: { b: TH.b }, onDraw: q => SHOW.level(q.c, clean(-q.b / q.a)),
    readout: q => plus(tr(`${ltr(`x = −b/2a = ${n(q.h)}`)} · `, `${ltr(`x = −b/2a = ${n(q.h)}`)} · `), verdict(q)) });
  objDone(); closeLab({ keep: true }); SHOW.levelOff();
  objective(tr('أطلِق حجراً واحداً', 'Fire one stone'));
  await fireBeat(); await throwStone(TH); objDone(); ghost.hide();
  vertexMark(TH);
  await STORY.story([tr('أصاب الحجر الثقيل الثغرة من أول رمية.', 'The heavy stone hit the breach on the first throw.'), { t: tr('لم تُضِع حجراً: حسبتَ قبل أن ترمي.', 'Not a stone wasted: you worked it out before you threw.'), small: true }]);

  await idea(4);
  const C = BOOK.checkAxis;
  objective(CHECK, '0/2', 0);
  await typed({ id: 'c3-axis', q: tr(`${Y(C)}. اكتب x لمحور التماثل.`, `${Y(C)}. Type the x of the axis of symmetry.`), expect: C.h,
    why: v => v === -C.h ? tr(`نقصت إشارة السالب: ${ltr(`x = ${axisCalc(C)} = ${n(C.h)}`)}.`, `The minus sign is missing: ${ltr(`x = ${axisCalc(C)} = ${n(C.h)}`)}.`) : v === clean(-C.b / C.a) ? tr(`هذا ${ltr('−b/a')}. المحور نصفه.`, `That is ${ltr('−b/a')}. The axis is half of it.`)
      : tr(`${ltr(`x = −b/2a = ${axisCalc(C)}`)}.`, `${ltr(`x = −b/2a = ${axisCalc(C)}`)}.`) });
  objProgress('1/2', .5);
  await typed({ id: 'c3-k', q: tr(`الرأس عند ${ltr('x = ' + n(C.h))}. اكتب الإحداثي y للرأس.`, `The vertex is at ${ltr('x = ' + n(C.h))}. Type its y.`), expect: C.k,
    why: v => v === C.h ? tr(`${ltr(n(C.h))} هو x. عوّضه في القاعدة.`, `${ltr(n(C.h))} is x. Substitute it into the rule.`) : tr(`${ltr(`f(${n(C.h)}) = ${sub(C, C.h)}`)}.`, `${ltr(`f(${n(C.h)}) = ${sub(C, C.h)}`)}.`) });
  objDone();
  addEntry(tr(`المحور ${ltr('x = −b/2a')} لأن الارتفاع c يتكرر عند ${ltr('0')} و ${ltr('−b/a')}. الرأس ${ltr('(−b/2a, f(−b/2a))')}. تغيير b (و a ثابت) ينقل المحور.`, `The axis is ${ltr('x = −b/2a')} because the height c repeats at ${ltr('0')} and ${ltr('−b/a')}. The vertex is ${ltr('(−b/2a, f(−b/2a))')}. Changing b (a fixed) moves the axis.`));
}

/* ======================================================================
   4 — the drawbridge chain: the sign of a, maximum and minimum, domain and range, reading a graph
   ====================================================================== */
const IDEAS4 = [tr('سلسلة الجسر', 'The drawbridge chain'), tr('قلب إشارة a', 'Flipping a'), tr('يفتح للأعلى: قيمة صغرى', 'Opening up: a minimum'), tr('يفتح للأسفل: قيمة عظمى', 'Opening down: a maximum'), tr('القراءة من الرسم', 'Reading a graph'), CHECK];
const DIR = [{ v: 'up', f: tr('للأعلى ∪', 'up ∪') }, { v: 'down', f: tr('للأسفل ∩', 'down ∩') }];
const MOAT_VIEW = { pos: V(50, 8, 72), look: V(50, 8, 0) };   // the moat and the chain's low point (50, −5), with the first throw above
async function ch4() {
  freshPlane(); SHOW.reset(); trail.set(T0.f, 0, WX); trail.progress(1);
  await shotV(MOAT_VIEW, 2.4);
  await STORY.title(3, tr('سلسلة الجسر', 'The drawbridge chain'), tr('كيف تعرف من القاعدة وحدها أين أعلى نقطة، أو أدناها؟', 'How can the rule alone tell you where the highest point is, or the lowest?'));
  caption(tr(`فوق الخندق سلسلة الجسر القديم، مثبّتة عند حافتيه ${ltr('x = 40')} و ${ltr('x = 60')}. شكلها قطع مكافئ أيضاً.`, `Over the moat hangs the old drawbridge’s chain, fixed at its two edges ${ltr('x = 40')} and ${ltr('x = 60')}. Its shape is a parabola too.`), NOTES.chain); await wait(4);
  showCard({ q: CH, title: tr('قاعدة السلسلة', 'The chain’s rule') });
  objective(tr('توقّع أولاً', 'Predict first'));
  const guess = await predict(tr(`في قاعدة السلسلة ${ltr('a = 0.05 > 0')}، وفي قاعدة الحجر ${ltr('a < 0')}. كيف يفتح قطع السلسلة؟`, `In the chain’s rule ${ltr('a = 0.05 > 0')}; in the stone’s ${ltr('a < 0')}. Which way does the chain’s parabola open?`), DIR);
  turned.set(CH.f, 38, 62); turned.progress(0); await tween(1.4, t => turned.progress(t));
  vertexMark(CH);
  caption(guess === 'up' ? tr(`نعم: ${ltr('a > 0')} يفتح للأعلى. أدنى نقطة ${ltr(pt(CH.h, CH.k))} هي الرأس: قيمة صغرى. والحجر (${ltr('a < 0')}) يفتح للأسفل: رأسه قيمة عظمى.`, `Yes: ${ltr('a > 0')} opens up. The lowest point ${ltr(pt(CH.h, CH.k))} is the vertex: a minimum. The stone (${ltr('a < 0')}) opens down: its vertex is a maximum.`)
    : tr(`لا: ${ltr('a > 0')} يفتح للأعلى. أدنى نقطة ${ltr(pt(CH.h, CH.k))} هي الرأس: قيمة صغرى. والحجر (${ltr('a < 0')}) هو الذي يفتح للأسفل.`, `No: ${ltr('a > 0')} opens up. The lowest point ${ltr(pt(CH.h, CH.k))} is the vertex: a minimum. It is the stone (${ltr('a < 0')}) that opens down.`)); await wait(4.4);
  objective(CHECK);
  await typed({ id: 'c4-chain', q: tr('اكتب القيمة الصغرى للسلسلة.', 'Type the chain’s minimum value.'), expect: CH.k, unit: tr('م', 'm'),
    why: v => v === CH.h ? tr(`${ltr(n(CH.h))} هو x، موقع أدنى نقطة لا ارتفاعها.`, `${ltr(n(CH.h))} is x, where the lowest point is, not its height.`) : v === -CH.k ? tr('انتبه للإشارة: السلسلة تتدلّى تحت حافة الخندق.', 'Mind the sign: the chain sags below the moat’s edge.') : tr('القيمة الصغرى هي y للرأس.', 'The minimum value is the vertex’s y.') });
  objDone();
  await ask(tr('ما مدى قاعدة السلسلة؟', 'What is the range of the chain’s rule?'), [{ v: 'ge', f: 'y ≥ ' + n(CH.k) }, { v: 'le', f: 'y ≤ ' + n(CH.k) }, { v: 'all', f: tr('كل الأعداد الحقيقية', 'all real numbers') }], 'ge',
    v => v === 'le' ? tr('تفتح للأعلى: كل قيمها فوق القيمة الصغرى أو عليها.', 'It opens up: all its values are at or above the minimum.') : tr(`كل الأعداد الحقيقية هي المجال (أيّ x). أما y فلا تنزل تحت ${ltr(n(CH.k))}.`, `All real numbers is the domain (any x). y never goes below ${ltr(n(CH.k))}.`), 'c4-range');
  caption(tr(`السلسلة: قيمة صغرى والمدى ${ltr('y ≥ ' + n(CH.k))}. الحجر: قيمة عظمى والمدى ${ltr('y ≤ ' + n(T0.k))}. والمجال في الحالتين كل الأعداد الحقيقية.`, `The chain: a minimum, range ${ltr('y ≥ ' + n(CH.k))}. The stone: a maximum, range ${ltr('y ≤ ' + n(T0.k))}. In both, the domain is all real numbers.`), NOTES.range); await wait(4.4);
  showCard(null);

  await idea(1);
  await shotV(VIEW.board, 2);
  showBoard({ win: { x0: -3, x1: 5, y0: -6, y1: 10 }, title: 'y = a(x − 1)² + 2' });
  objective(tr('اسحب a حتى يصير موجباً، ومرّ بالصفر', 'Drag a until it is positive, passing through zero'));
  caption(tr(`اسحب مؤشر ⟦a|a⟧ في اللوحة نحو اليمين: من السالب، مروراً بـ ${ltr('0')}، إلى الموجب. راقب الرأس.`, `Drag the ⟦a|a⟧ slider in the panel from negative, through ${ltr('0')}, to positive. Watch the vertex.`));
  await lab({ title: tr(`غيّر a: الرأس ثابت عند ${ltr('(1, 2)')}`, `Change a: the vertex stays at ${ltr('(1, 2)')}`), target: 'board', start: { a: -1, b: 2, c: 1 }, keys: ['a'], range: { a: [-2, 2, 0.5] },
    link: v => ({ b: clean(-2 * v.a), c: clean(v.a + 2) }), until: q => q.a > 0, auto: { a: 1 },
    readout: q => q.line ? tr(`${ltr('a = 0')}: ${ltr('y = 2')} مستقيم أفقي، لا قطع مكافئ.`, `${ltr('a = 0')}: ${ltr('y = 2')}, a flat line, not a parabola.`)
      : q.up ? tr(`${ltr('a > 0')}: يفتح للأعلى مثل السلسلة، و ${ltr('(1, 2)')} قيمة صغرى، والمدى ${ltr('y ≥ 2')}.`, `${ltr('a > 0')}: opens up like the chain; ${ltr('(1, 2)')} is a minimum; range ${ltr('y ≥ 2')}.`)
      : tr(`${ltr('a < 0')}: يفتح للأسفل مثل الحجر، و ${ltr('(1, 2)')} قيمة عظمى، والمدى ${ltr('y ≤ 2')}.`, `${ltr('a < 0')}: opens down like the stone; ${ltr('(1, 2)')} is a maximum; range ${ltr('y ≤ 2')}.`) });
  objDone(); closeLab();
  caption(tr('الرأس لم يتحرّك، لكنه صار أدنى نقطة بعد أن كان أعلاها: إشارة a وحدها تقلب القطع، ومعها العظمى والمدى.', 'The vertex did not move, but it went from the highest point to the lowest: the sign of a alone flips the parabola, and with it the maximum and the range.')); await wait(4.2);
  hideBoard();

  await idea(2);
  const U = BOOK.ex2up;
  showBoard({ win: { x0: -7, x1: 3, y0: -2, y1: 10 }, title: 'y = ' + pq(U) });
  objective(tr('الاتجاه، ثم الرأس', 'The direction, then the vertex'));
  await ask(tr(`${Y(U)}: ${ltr('a = ' + cf(U.a) + ' > 0')}. كيف يفتح القطع؟`, `${Y(U)}: ${ltr('a = ' + cf(U.a) + ' > 0')}. Which way does it open?`), DIR, 'up',
    () => tr(`a موجب: ${ltr('ax²')} يكبر كلما ابتعدنا عن الرأس، فيفتح للأعلى.`, `a is positive: ${ltr('ax²')} grows as we move away from the vertex, so it opens up.`), 'c4-up');
  BD.curves.push({ f: U.f, color: '#38e1ff', w: 3 }); renderBoard();
  objective(tr(`انقر الرأس بعد حساب ${ltr('x = −b/2a')}`, `Click the vertex after working out ${ltr('x = −b/2a')}`));
  await boardPick([{ x: U.h, y: U.k, color: '#ff4fa3' }], { wrong: () => ltr(`x = ${axisCalc(U)} = ${n(U.h)}`) + '.' }); objDone();
  await ask(tr('ما مدى هذا الاقتران؟', 'What is the range of this function?'), [{ v: 'ge', f: 'y ≥ ' + n(U.k) }, { v: 'le', f: 'y ≤ ' + n(U.k) }, { v: 'all', f: tr('كل الأعداد الحقيقية', 'all real numbers') }], 'ge',
    v => v === 'le' ? tr('يفتح للأعلى: كل قيمه فوق القيمة الصغرى أو عليها.', 'It opens up: all its values are at or above the minimum.') : tr(`كل الأعداد الحقيقية هي المجال. أما y فلا تنزل تحت ${ltr(n(U.k))}.`, `All real numbers is the domain. y never goes below ${ltr(n(U.k))}.`), 'c4-urange');
  hideBoard();

  await idea(3);
  const D = BOOK.ex2down;
  showBoard({ win: { x0: -4, x1: 6, y0: -4, y1: 6 }, title: 'y = ' + pq(D) });
  await ask(tr(`${Y(D)}: ${ltr('a = ' + cf(D.a) + ' < 0')}. كيف يفتح القطع؟`, `${Y(D)}: ${ltr('a = ' + cf(D.a) + ' < 0')}. Which way does it open?`), DIR, 'down',
    () => tr('a سالب: القيم تصغر كلما ابتعدنا عن الرأس، فيفتح للأسفل مثل مسار الحجر.', 'a is negative: the values shrink away from the vertex, so it opens down, like the stone’s path.'), 'c4-down');
  BD.curves.push({ f: D.f, color: '#ffc233', w: 3 }); renderBoard();
  objective(tr('انقر الرأس', 'Click the vertex'));
  await boardPick([{ x: D.h, y: D.k, color: '#ff4fa3' }], { wrong: () => ltr(`x = ${axisCalc(D)} = ${n(D.h)}`) + '.' }); objDone();
  await typed({ id: 'c4-max', q: tr(`الرأس ${ltr(pt(D.h, D.k))}. اكتب القيمة العظمى.`, `The vertex is ${ltr(pt(D.h, D.k))}. Type the maximum value.`), expect: D.k,
    why: v => v === D.h ? tr(`${ltr(n(D.h))} هو x، موقع الرأس لا ارتفاعه.`, `${ltr(n(D.h))} is x, where the vertex is, not its height.`) : tr('القيمة العظمى هي y للرأس.', 'The maximum value is the vertex’s y.') });
  await ask(tr('وما مجال أيّ اقتران تربيعي؟', 'And the domain of any quadratic function?'), [{ v: 'all', f: tr('كل الأعداد الحقيقية', 'all real numbers') }, { v: 'x0', f: 'x ≥ 0' }, { v: 'rng', f: 'y ≤ k' }], 'all',
    v => v === 'rng' ? tr('هذا مدى، يتحدث عن y. المجال عن x.', 'That is a range, about y. The domain is about x.') : tr('القاعدة تقبل أيّ عدد x، سالباً أو موجباً.', 'The rule accepts any number x, negative or positive.'), 'c4-domain');
  hideBoard();

  await idea(4);
  const G = BOOK.ex4graph;
  await shotV(VIEW.board, 1.4);
  showBoard({ win: { x0: -6, x1: 2, y0: -6, y1: 4 }, title: 'y = ?', curves: [{ f: G.f, color: '#ffc233', w: 3 }] });
  objective(tr('اقرأ الخصائص من الرسم وحده', 'Read the properties from the graph alone'));
  caption(tr('رسالة من كشّاف: رسم بلا قاعدة. انقر الرأس.', 'A note from a scout: a graph with no rule. Click the vertex.'));
  await boardPick([{ x: G.h, y: G.k, color: '#ff4fa3' }], { wrong: () => tr('الرأس أعلى نقطة على هذا المنحنى.', 'The vertex is the highest point of this curve.') });
  await ask(tr(`الرأس ${ltr(pt(G.h, G.k))}. ما مدى الاقتران؟`, `The vertex is ${ltr(pt(G.h, G.k))}. What is the range?`), [{ v: 'le', f: 'y ≤ ' + n(G.k) }, { v: 'ge', f: 'y ≥ ' + n(G.k) }, { v: 'all', f: tr('كل الأعداد الحقيقية', 'all real numbers') }], 'le',
    v => v === 'ge' ? tr('المنحنى يفتح للأسفل: كل قيمه تحت الرأس أو عليه.', 'It opens down: all its values are at or below the vertex.') : tr('كل الأعداد الحقيقية هي المجال، لا المدى.', 'All real numbers is the domain, not the range.'), 'c4-graph');
  objDone();
  caption(tr(`من الرسم: الرأس ${ltr(pt(G.h, G.k))} قيمة عظمى، والمحور ${ltr('x = ' + n(G.h))}، والمدى ${ltr('y ≤ ' + n(G.k))}.`, `From the graph: the vertex ${ltr(pt(G.h, G.k))} is a maximum, the axis is ${ltr('x = ' + n(G.h))}, the range ${ltr('y ≤ ' + n(G.k))}.`)); await wait(3.8);
  hideBoard();

  await idea(5);
  const C = BOOK.checkMin;
  objective(CHECK, '0/2', 0);
  await ask(tr(`${Y(C)}: للرأس قيمة عظمى أم صغرى؟`, `${Y(C)}: is the vertex a maximum or a minimum?`), [{ v: 'min', f: tr('صغرى', 'a minimum') }, { v: 'max', f: tr('عظمى', 'a maximum') }], 'min',
    () => tr(`${ltr('a = ' + n(C.a) + ' > 0')}: يفتح للأعلى، فالرأس قيمة صغرى.`, `${ltr('a = ' + n(C.a) + ' > 0')}: it opens up, so the vertex is a minimum.`), 'c4-minmax');
  objProgress('1/2', .5);
  await typed({ id: 'c4-min', q: tr('اكتب القيمة الصغرى.', 'Type the minimum value.'), expect: C.k,
    why: v => v === C.c ? tr(`${ltr(n(C.c))} هو c، القيمة عند ${ltr('x = 0')}. الرأس عند ${ltr(`x = ${axisCalc(C)} = ${n(C.h)}`)}.`, `${ltr(n(C.c))} is c, the value at ${ltr('x = 0')}. The vertex is at ${ltr(`x = ${axisCalc(C)} = ${n(C.h)}`)}.`)
      : v === C.h ? tr(`${ltr(n(C.h))} هو x للرأس. عوّضه: ${ltr(`f(${n(C.h)}) = ${sub(C, C.h)}`)}.`, `${ltr(n(C.h))} is the vertex’s x. Substitute it: ${ltr(`f(${n(C.h)}) = ${sub(C, C.h)}`)}.`)
      : tr(`الرأس عند ${ltr(`x = ${axisCalc(C)} = ${n(C.h)}`)}، ثم ${ltr(`f(${n(C.h)}) = ${sub(C, C.h)}`)}.`, `The vertex is at ${ltr(`x = ${axisCalc(C)} = ${n(C.h)}`)}, then ${ltr(`f(${n(C.h)}) = ${sub(C, C.h)}`)}.`) });
  objDone();
  addEntry(tr(`${ltr('a > 0')} يفتح للأعلى والرأس قيمة صغرى (${ltr('y ≥ k')})، مثل السلسلة. ${ltr('a < 0')} يفتح للأسفل والرأس قيمة عظمى (${ltr('y ≤ k')})، مثل الحجر. المجال كل الأعداد الحقيقية.`, `${ltr('a > 0')} opens up with a minimum at the vertex (${ltr('y ≥ k')}), like the chain. ${ltr('a < 0')} opens down with a maximum (${ltr('y ≤ k')}), like the stone. The domain is all real numbers.`));
}

/* ======================================================================
   5 — the night strike. By feel: in the dark, set the torch on the wall where you think the stone will strike. The tool:
   the five-step graph (the book's worked example first). With it: the reflected y-intercept lands on the wall at 14 m,
   the stone follows the drawing there.
   ====================================================================== */
const IDEAS5 = [tr('الليل والمشعل', 'The night and the torch'), tr('مثال محلول', 'A worked example'), tr('ارسم الرمية ثم ارمِ', 'Draw the throw, then throw')];
async function ch5() {
  freshPlane(); SHOW.reset(); night(K.night); hideGrid();
  await shotV({ pos: V(20, 28, 120), look: V(30, 18, 0) }, 2.2);
  await STORY.title(4, tr('رمية الليل', 'The night strike'), tr('في الظلام لا ترى الحجر. سترسمه قبل أن تراه.', 'In the dark you cannot see the stone. You will draw it before you see it.'));
  await toNight(1, 3);
  await STORY.story([tr('حلّ الليل على الكرك.', 'Night falls over Karak.'), { t: tr('صلاح الدين يأمر برمية واحدة في الظلام، بثقل موازنة جديد. لا رمية للتجربة.', 'Salah al-Din orders a single throw in the dark, with a new counterweight. No trial throws.'), small: true }]);
  await shotP(2, -14, 74); showBreach();
  objective(tr('ضع المشعل حيث تظنّ أن الحجر سيضرب السور', 'Put the torch where you think the stone will strike the wall'));
  caption(tr('ثقل الموازنة الجديد لم يُجرَّب بعد، والظلام يخفي المسار. ضع المشعل على السور بإحساسك.', 'The new counterweight has never been tried, and the dark hides the path. Put the torch on the wall by feel.'));
  if (!E.INSTANT) drawNight();   // a rewind keeps this play's night; a new play draws again
  const guess = await torchBeat(20);
  objDone();
  caption(tr(`وضعتَ المشعل على ارتفاع ${ltr(n(guess))} م. قبل أن نرمي، لنسأل الرياضيات: قاعدة الثقل الجديد تخبرنا أين سيضرب.`, `You set the torch ${ltr(n(guess) + ' m')} up. Before we throw, let us ask the maths: the new counterweight’s rule tells us where it will strike.`)); await wait(3.4);

  await idea(1);
  await shotV(VIEW.board, 2);
  const Q5 = BOOK.ex5, x5 = BOOK.ex5extra, P = (x, y, color) => { BD.pts.push({ x, y, color, label: pt(x, y) }); renderBoard(); };
  showBoard({ win: { x0: -3, x1: 5, y0: -6, y1: 10 }, title: 'y = ' + pq(Q5) });
  objective(tr('تابع المثال المحلول: الرسم بخمس خطوات', 'Follow the worked example: graphing in five steps'));
  await explain(tr(`مثال محلول: ${Y(Q5)}`, `Worked example: ${Y(Q5)}`), [
    { line: tr(`1) ${ltr('a < 0')}: للأسفل. ${ltr(`x = ${axisCalc(Q5)} = ${n(Q5.h)}`)}، ${ltr(`f(${n(Q5.h)}) = ${n(Q5.k)}`)}`, `1) ${ltr('a < 0')}: down. ${ltr(`x = ${axisCalc(Q5)} = ${n(Q5.h)}`)}, ${ltr(`f(${n(Q5.h)}) = ${n(Q5.k)}`)}`),
      do: () => P(Q5.h, Q5.k, '#ff4fa3'), say: tr(`الخطوة 1: الاتجاه، ثم ⟦ax|المحور⟧ و⟦vx|الرأس⟧ ${ltr(pt(Q5.h, Q5.k))}.`, `Step 1: the direction, then ⟦ax|the axis⟧ and ⟦vx|the vertex⟧ ${ltr(pt(Q5.h, Q5.k))}.`) },
    { line: `2) f(0) = ${n(Q5.c)} → ${pt(0, Q5.c)}`, do: () => P(0, Q5.c, '#ffc233'), say: tr(`الخطوة 2: المقطع y، عند ${ltr('x = 0')}.`, `Step 2: the y-intercept, at ${ltr('x = 0')}.`) },
    { line: `3) f(${n(x5)}) = ${sub(Q5, x5)} = ${n(Q5.f(x5))} → ${pt(x5, Q5.f(x5))}`, do: () => P(x5, Q5.f(x5), '#ffc233'), say: tr('الخطوة 3: نقطة أخرى في جهة المقطع y.', 'Step 3: one more point on the y-intercept’s side.') },
    { line: tr(`4) انعكاس حول ${ltr('x = ' + n(Q5.h))}: ${ltr(pt(2 * Q5.h, Q5.c))} و ${ltr(pt(2 * Q5.h - x5, Q5.f(x5)))}`, `4) reflect in ${ltr('x = ' + n(Q5.h))}: ${ltr(pt(2 * Q5.h, Q5.c))} and ${ltr(pt(2 * Q5.h - x5, Q5.f(x5)))}`),
      do: () => { P(2 * Q5.h, Q5.c, '#b69cff'); P(2 * Q5.h - x5, Q5.f(x5), '#b69cff'); }, say: tr('الخطوة 4: لكل نقطة ⟦em|توأم⟧ على البعد نفسه من المحور.', 'Step 4: every point has ⟦em|a twin⟧ the same distance from the axis.') },
    { line: tr('5) منحنى أملس يمرّ بالنقاط الخمس', '5) a smooth curve through the five points'), do: () => { BD.curves.push({ f: Q5.f, color: '#38e1ff', w: 3 }); renderBoard(); }, say: tr('الخطوة 5: نصل النقاط بمنحنى أملس.', 'Step 5: join the points with a smooth curve.') },
  ]);
  objDone(); hideBoard(); showCard(null);

  await idea(2);
  await shotP(2, -14, 74); showBreach(); await revealGrid(1.8);
  showCard({ q: TN, title: tr('ارسم رمية الليل', 'Draw the night throw') });
  objective(tr('ارسم الرمية بخمس خطوات', 'Graph the throw in five steps'), '0/5', 0);
  caption(tr(`الخطوة 1: ${ltr('a < 0')}، فالقطع يفتح للأسفل. علّق الشاقول على ${ltr('x = −b/2a')}.`, `Step 1: ${ltr('a < 0')}, so it opens down. Hang the plumb line on ${ltr('x = −b/2a')}.`));
  await plumbBeat(TN.h, 12, x => tr(`${ltr(`−b/2a = ${axisCalc(TN)} = ${n(TN.h)}`)}، لا ${ltr(n(x))}.`, `${ltr(`−b/2a = ${axisCalc(TN)} = ${n(TN.h)}`)}, not ${ltr(n(x))}.`));
  vertexMark(TN); objProgress('1/5', .2);
  caption(tr(`⟦vx|الرأس⟧ ${ltr(`(${n(TN.h)}, h(${n(TN.h)})) = ${pt(TN.h, TN.k)}`)}: أعلى نقطة في الرمية.`, `⟦vx|The vertex⟧ is ${ltr(`(${n(TN.h)}, h(${n(TN.h)})) = ${pt(TN.h, TN.k)}`)}: the top of the throw.`)); await wait(3.2);
  caption(tr(`الخطوة 2: المقطع y، عند ${ltr('x = 0')}.`, `Step 2: the y-intercept, at ${ltr('x = 0')}.`));
  await plotBeat('a', 0, TN.c, { color: 0xffc233, why: y => tr(`${ltr(`h(0) = c = ${n(TN.c)}`)}، لا ${ltr(n(y))}.`, `${ltr(`h(0) = c = ${n(TN.c)}`)}, not ${ltr(n(y))}.`) }); objProgress('2/5', .4);
  caption(tr(`الخطوة 3: نقطة أخرى في جهة المقطع، عند ${ltr('x = ' + TN_EXTRA)}. احسب ارتفاعها أولاً.`, `Step 3: one more point on the y-intercept’s side, at ${ltr('x = ' + TN_EXTRA)}. Work out its height first.`));
  await plotBeat('b', TN_EXTRA, TN.f(TN_EXTRA), { color: 0xffc233, why: () => tr(`${ltr(`h(${n(TN_EXTRA)}) = ${sub(TN, TN_EXTRA)} = ${n(TN.f(TN_EXTRA))}`)}.`, `${ltr(`h(${n(TN_EXTRA)}) = ${sub(TN, TN_EXTRA)} = ${n(TN.f(TN_EXTRA))}`)}.`) }); objProgress('3/5', .6);
  caption(tr('الخطوة 4: اعكس النقطتين حول المحور.', 'Step 4: reflect both points in the axis.'));
  await reflectBeat(['a', 'b'], TN); objProgress('4/5', .8);
  const hit = at60(TN);
  caption(tr(`انعكاس ${ltr(pt(0, TN.c))} هو ${ltr(pt(2 * TN.h, TN.c))}، خلف السور: الحجر لن يصل إليه.`, `The reflection of ${ltr(pt(0, TN.c))} is ${ltr(pt(2 * TN.h, TN.c))}, behind the wall: the stone never gets there.`)); await wait(3.6);
  caption(tr(`وانعكاس ${ltr(pt(TN_EXTRA, hit))} هو ${ltr(pt(WX, hit))}: على وجه السور، على ارتفاع ⟦h|${n(hit)}⟧ م. ` + (guess === hit ? 'حيث وضعتَ المشعل تماماً.' : `مشعلك على ${n(guess)} م.`),
    `And the reflection of ${ltr(pt(TN_EXTRA, hit))} is ${ltr(pt(WX, hit))}: on the wall’s face, ⟦h|${n(hit)}⟧ m up. ` + (guess === hit ? 'Exactly where you set the torch.' : `Your torch is at ${n(guess)} m.`)), null, guess === hit ? 'ok' : ''); await wait(4.2);
  caption(tr('الخطوة 5: صِل النقاط بمنحنى أملس.', 'Step 5: join the points with a smooth curve.'));
  ghost.set(TN.f, 0, WX); ghost.progress(0); await tween(1.6, t => ghost.progress(t)); objProgress('5/5', 1); objDone(); showCard(null);
  torchOff(); ring('torch', WX, SHOW.INK.ok, hit);
  objective(tr('أطلِق على رسمك', 'Fire along your drawing')); caption(null);
  await fireBeat(); await throwStone(TN); objDone(); torchOff();
  await STORY.story([tr('ضرب الحجر السور حيث قال الرسم.', 'The stone struck the wall where the drawing said.'), { t: tr('رسمتَ الرمية في الظلام، قبل أن تراها.', 'You drew the throw in the dark, before you could see it.'), small: true }]);
  addEntry(tr('الرسم بخمس خطوات: الاتجاه والمحور والرأس، المقطع y، نقطة أخرى، الانعكاس حول المحور، ثم منحنى أملس.', 'Graphing in five steps: direction, axis and vertex; the y-intercept; one more point; reflect in the axis; then a smooth curve.'));
}

/* ======================================================================
   6 — the council at dawn: a mixed review, what this learner missed first (engine/teach.js)
   ====================================================================== */
const R = { a: quad(-1, 3, 7), axis: quad(2, -12, 1), max: quad(-1, 4, 1), yint: quad(-4, 1, -6), dir: quad(0.5, 0, -3), rng: quad(-3, 6, 0) };
const REVIEW = [
  { id: 'r-a', run: () => typed({ id: 'r-a', q: tr(`اكتب a في ${ltr('y = 3x − x² + 7')}`, `Type a in ${ltr('y = 3x − x² + 7')}`), expect: R.a.a,
    why: v => v === 3 ? tr('3 معامل x، أي b.', '3 is the coefficient of x: b.') : v === 7 ? tr('7 هو c.', '7 is c.') : v === 1 ? tr(`انتبه للإشارة: ${ltr('−x²')} يعني ${ltr('a = −1')}.`, `Mind the sign: ${ltr('−x²')} means ${ltr('a = −1')}.`) : tr(`a معامل ${ltr('x²')}.`, `a is the coefficient of ${ltr('x²')}.`) }) },
  { id: 'r-axis', run: () => typed({ id: 'r-axis', q: tr(`اكتب x لمحور ${Y(R.axis)}`, `Type the x of the axis of ${Y(R.axis)}`), expect: R.axis.h,
    why: v => v === -R.axis.h ? tr(`انتبه للإشارة: ${ltr(`${axisCalc(R.axis)} = ${n(R.axis.h)}`)}.`, `Mind the sign: ${ltr(`${axisCalc(R.axis)} = ${n(R.axis.h)}`)}.`) : v === clean(-R.axis.b / R.axis.a) ? tr(`هذا ${ltr('−b/a')}. المحور نصفه.`, `That is ${ltr('−b/a')}. The axis is half of it.`) : tr(`${ltr(`x = −b/2a = ${axisCalc(R.axis)}`)}.`, `${ltr(`x = −b/2a = ${axisCalc(R.axis)}`)}.`) }) },
  { id: 'r-sym', run: () => typed({ id: 'r-sym', q: tr(`حجر ارتفاعه ${ltr('9')} م عند ${ltr('x = −1')} وعند ${ltr('x = 7')}. اكتب x لمحوره.`, `A stone is ${ltr('9 m')} up at ${ltr('x = −1')} and at ${ltr('x = 7')}. Type the x of its axis.`), expect: 3,
    why: v => v === 8 ? tr('8 هي المسافة بين النقطتين. المحور في منتصفهما.', '8 is the distance between them. The axis is halfway.') : v === 4 ? tr(`نصف المسافة 4، لكن نبدأ من ${ltr('−1')}: ${ltr('−1 + 4 = 3')}.`, `Half the distance is 4, but start from ${ltr('−1')}: ${ltr('−1 + 4 = 3')}.`) : tr(`المنتصف: ${ltr('(−1 + 7) ÷ 2')}.`, `The midpoint: ${ltr('(−1 + 7) ÷ 2')}.`) }) },
  { id: 'r-max', run: () => typed({ id: 'r-max', q: tr(`اكتب القيمة العظمى لـ ${Y(R.max)}`, `Type the maximum value of ${Y(R.max)}`), expect: R.max.k,
    why: v => v === R.max.h ? tr(`${ltr(n(R.max.h))} هو x للرأس. عوّضه في القاعدة.`, `${ltr(n(R.max.h))} is the vertex’s x. Substitute it into the rule.`) : tr(`${ltr(`x = ${axisCalc(R.max)} = ${n(R.max.h)}`)}، ثم ${ltr(`f(${n(R.max.h)}) = ${sub(R.max, R.max.h)}`)}.`, `${ltr(`x = ${axisCalc(R.max)} = ${n(R.max.h)}`)}, then ${ltr(`f(${n(R.max.h)}) = ${sub(R.max, R.max.h)}`)}.`) }) },
  { id: 'r-yint', run: () => typed({ id: 'r-yint', q: tr(`اكتب المقطع y لـ ${Y(R.yint)}`, `Type the y-intercept of ${Y(R.yint)}`), expect: R.yint.c,
    why: v => v === -R.yint.c ? tr('انتبه للإشارة.', 'Mind the sign.') : v === R.yint.a ? tr(`${ltr(n(R.yint.a))} هو a. المقطع y هو ${ltr('f(0)')}.`, `${ltr(n(R.yint.a))} is a. The y-intercept is ${ltr('f(0)')}.`) : tr(`عوّض ${ltr('x = 0')}: يبقى c.`, `Substitute ${ltr('x = 0')}: c is left.`) }) },
  { id: 'r-dir', run: () => ask(tr(`${Y(R.dir)}: كيف يفتح القطع؟`, `${Y(R.dir)}: which way does it open?`), DIR, 'up', () => tr(`${ltr('a = 0.5 > 0')}: يفتح للأعلى، مثل السلسلة.`, `${ltr('a = 0.5 > 0')}: it opens up, like the chain.`), 'r-dir') },
  { id: 'r-rng', run: () => ask(tr(`ما مدى ${Y(R.rng)}؟`, `What is the range of ${Y(R.rng)}?`), [{ v: 'le', f: 'y ≤ ' + n(R.rng.k) }, { v: 'ge', f: 'y ≥ ' + n(R.rng.k) }, { v: 'leh', f: 'y ≤ ' + n(R.rng.h) }], 'le',
    v => v === 'ge' ? tr(`${ltr('a < 0')}: يفتح للأسفل، فالقيم تحت الرأس.`, `${ltr('a < 0')}: it opens down, so the values are below the vertex.`) : tr(`${ltr(n(R.rng.h))} هو x للرأس. المدى عن y: ${ltr(`f(${n(R.rng.h)}) = ${n(R.rng.k)}`)}.`, `${ltr(n(R.rng.h))} is the vertex’s x. The range is about y: ${ltr(`f(${n(R.rng.h)}) = ${n(R.rng.k)}`)}.`), 'r-rng') },
];
const IDEAS6 = [tr('مجلس الفجر', 'The council at dawn')];
async function ch6() {
  freshPlane(); night(K.night);
  await shotV({ pos: V(-40, 30, 92), look: V(20, 12, 0) }, 2);
  await toNight(DUSK, 3);
  await STORY.title(5, tr('مجلس الفجر', 'The council at dawn'), tr('يجمع صلاح الدين مجلسه ويسألك عمّا تعلّمته. ما أخطأت فيه يُسأل أولاً.', 'Salah al-Din gathers his council and asks what you have learned. What you got wrong comes first.'));
  const items = pickReview(REVIEW, 5);
  for (const [i, it] of items.entries()) { objective(tr('المجلس', 'The council'), `${i + 1}/${items.length}`, i / items.length); await it.run(); }
  objDone();
  caption(tr('انتهى المجلس. الأسئلة التي تستحق عودة في «سجلّك» داخل الخلاصة.', 'The council is over. Questions worth another look are in “Your log” in the notebook.')); await wait(3.2);
}

/* ======================================================================
   THE SIEGE WORKSHOP: the book's 2.3 items, then the wedding order
   ====================================================================== */
const SEE = { axis: tr(' راجع فصل «قانون المعلّم».', ' See the chapter “The master’s formula”.'), max: tr(' راجع فصل «سلسلة الجسر».', ' See the chapter “The drawbridge chain”.') };
const FB = BOOK.football, FW = BOOK.fireworks, HS = BOOK.hisham, F2 = BOOK.five2;
let WED_B = 1.2;
const MISSIONS = [
  { id: 'order', obj: tr(`رتّب ${ltr('−8x + 2x²')} ثم انقر رأسه`, `Put ${ltr('−8x + 2x²')} in order, then click its vertex`),
    run: () => { showBoard({ win: { x0: -2, x1: 6, y0: -10, y1: 10 }, title: 'y = −8x + 2x²', curves: [{ f: BOOK.order.f, color: '#38e1ff', w: 3 }] }); return boardPick([{ x: BOOK.order.h, y: BOOK.order.k, color: '#ff4fa3' }], { wrong: () => plus(tr(`رتّب: ${ltr(pq(BOOK.order))}، فالمحور ${ltr('x = ' + axisCalc(BOOK.order))}.`, `In order: ${ltr(pq(BOOK.order))}, so the axis is ${ltr('x = ' + axisCalc(BOOK.order))}.`), SEE.axis) }); },
    done: tr(`${ltr(pq(BOOK.order))}: المحور ${ltr('x = ' + n(BOOK.order.h))} والرأس ${ltr(pt(BOOK.order.h, BOOK.order.k))} قيمة صغرى.`, `${ltr(pq(BOOK.order))}: the axis is ${ltr('x = ' + n(BOOK.order.h))} and the vertex ${ltr(pt(BOOK.order.h, BOOK.order.k))} is a minimum.`),
    log: tr(`رأس ${ltr('−8x + 2x²')}`, `the vertex of ${ltr('−8x + 2x²')}`), res: pt(BOOK.order.h, BOOK.order.k) },
  { id: 'hisham', obj: tr('من أصاب: هشام أم ملك؟', 'Who is right: Hisham or Malak?'),
    pre: () => showBoard({ win: { x0: -10, x1: 2, y0: -10, y1: 45 }, title: 'y = ' + pq(HS), curves: [{ f: HS.f, color: '#ffc233', w: 3 }] }),
    q: tr(`${Y(HS)}. كتب هشام ${ltr('x = ' + n(-HS.h))}، وكتبت ملك ${ltr('x = ' + n(HS.h))}. أين المحور؟`, `${Y(HS)}. Hisham wrote ${ltr('x = ' + n(-HS.h))}, Malak wrote ${ltr('x = ' + n(HS.h))}. Where is the axis?`),
    opts: [-HS.h, HS.h, clean(-HS.b / HS.a)].map(v => ({ v, f: 'x = ' + n(v) })), answer: HS.h,
    why: v => plus(v === -HS.h ? tr(`${ltr('−b = ' + n(-HS.b))} و ${ltr('2a = ' + n(2 * HS.a))}: ${ltr(n(-HS.b) + ' ÷ (' + n(2 * HS.a) + ') = ' + n(HS.h))}. هشام أخطأ في الإشارة.`, `${ltr('−b = ' + n(-HS.b))} and ${ltr('2a = ' + n(2 * HS.a))}: ${ltr(n(-HS.b) + ' ÷ (' + n(2 * HS.a) + ') = ' + n(HS.h))}. Hisham made a sign error.`) : tr(`${ltr('−b/a = ' + n(-HS.b / HS.a))}؛ المحور نصفه.`, `${ltr('−b/a = ' + n(-HS.b / HS.a))}; the axis is half of it.`), SEE.axis),
    done: tr(`${ltr(`x = ${axisCalc(HS)} = ${n(HS.h)}`)}: ملك على حق، والرأس ${ltr(pt(HS.h, HS.k))}.`, `${ltr(`x = ${axisCalc(HS)} = ${n(HS.h)}`)}: Malak is right, and the vertex is ${ltr(pt(HS.h, HS.k))}.`),
    log: tr('خطأ هشام', 'Hisham’s slip'), res: 'x = ' + n(HS.h) },
  { id: 'fireworks', obj: tr('جد أقصى ارتفاع لسهم النار', 'Find the fire arrow’s greatest height'),
    pre: () => showBoard({ win: { x0: 0, x1: 5, y0: 400, y1: 640 }, vx: 't', title: 'h(t) = ' + pq(FW, 't'), curves: [{ f: FW.f, color: '#ffc233', w: 3 }] }),
    run: () => typed({ id: 'w-fireworks', q: tr(`سهم نار يُطلق من برج مراقبة: ${ltr('h(t) = ' + pq(FW, 't'))}. اكتب أقصى ارتفاع يبلغه.`, `A fire arrow shot from a watchtower: ${ltr('h(t) = ' + pq(FW, 't'))}. Type the greatest height it reaches.`), expect: FW.k,
      why: v => plus(v === FW.c ? tr(`${ltr('h(0) = ' + n(FW.c))} ارتفاعه لحظة الإطلاق، لا أعلاه.`, `${ltr('h(0) = ' + n(FW.c))} is its height at launch, not its greatest.`) : v === FW.h ? tr(`${ltr('t = ' + n(FW.h))} زمن القمة، لا ارتفاعها.`, `${ltr('t = ' + n(FW.h))} is the time of the top, not its height.`) : tr(`الرأس عند ${ltr('t = ' + axisCalc(FW) + ' = ' + n(FW.h))}؛ عوّضه في القاعدة.`, `The vertex is at ${ltr('t = ' + axisCalc(FW) + ' = ' + n(FW.h))}; substitute it into the rule.`), SEE.max) }),
    done: tr(`${ltr(`t = ${n(FW.h)}`)} و ${ltr(`h(${n(FW.h)}) = ${n(FW.k)}`)}: القيمة العظمى.`, `${ltr(`t = ${n(FW.h)}`)} and ${ltr(`h(${n(FW.h)}) = ${n(FW.k)}`)}: the maximum value.`),
    log: tr('سهم النار', 'the fire arrow'), res: n(FW.k) },
  { id: 'football', obj: tr('جد أقصى ارتفاع للكرة', 'Find the ball’s greatest height'),
    pre: () => showBoard({ win: { x0: -0.5, x1: 4.5, y0: -8, y1: 80 }, vx: 't', title: 'h(t) = ' + pq(FB, 't'), curves: [{ f: FB.f, color: '#38e1ff', w: 3 }] }),
    run: () => typed({ id: 'w-football', q: tr(`جنود يلعبون الكرة في المعسكر: ${ltr('h(t) = ' + pq(FB, 't'))}. اكتب أقصى ارتفاع تبلغه.`, `Soldiers play ball in the camp: ${ltr('h(t) = ' + pq(FB, 't'))}. Type the greatest height it reaches.`), expect: FB.k,
      why: v => plus(v === FB.h ? tr(`${ltr('t = ' + n(FB.h))} زمن أعلى نقطة، لا ارتفاعها.`, `${ltr('t = ' + n(FB.h))} is the time of the highest point, not its height.`) : v === FB.f(3) ? tr(`${ltr('h(3) = ' + n(FB.f(3)))}: ارتفاعها بعد 3 ثوانٍ، وهي نازلة.`, `${ltr('h(3) = ' + n(FB.f(3)))}: its height after 3 seconds, on the way down.`) : tr(`${ltr(`t = ${axisCalc(FB)} = ${n(FB.h)}`)}، ثم عوّض.`, `${ltr(`t = ${axisCalc(FB)} = ${n(FB.h)}`)}, then substitute.`), SEE.max) }),
    done: tr(`${ltr(`t = ${n(FB.h)}`)}، و ${ltr(`h(${n(FB.h)}) = ${n(FB.k)}`)}: القيمة العظمى.`, `${ltr(`t = ${n(FB.h)}`)}, and ${ltr(`h(${n(FB.h)}) = ${n(FB.k)}`)}: the maximum value.`),
    log: tr('كرة المعسكر', 'the camp’s ball'), res: n(FB.k) },
  { id: 'five', obj: tr(`ارسم ${Y(F2)} بخمس خطوات: الرأس، ثم المقطع y، ثم ${ltr('x = ' + n(BOOK.five2extra))}`, `Graph ${Y(F2)} in five steps: the vertex, then the y-intercept, then ${ltr('x = ' + n(BOOK.five2extra))}`),
    run: () => { showBoard({ win: { x0: -2, x1: 6, y0: -10, y1: 4 }, title: 'y = ' + pq(F2) }); return fiveStep(F2, BOOK.five2extra); },
    done: tr(`الرأس ${ltr(pt(F2.h, F2.k))} قيمة صغرى، و ${ltr(pt(0, F2.c))} و ${ltr(pt(BOOK.five2extra, F2.f(BOOK.five2extra)))}، وانعكاساهما.`, `The vertex ${ltr(pt(F2.h, F2.k))} is a minimum; then ${ltr(pt(0, F2.c))} and ${ltr(pt(BOOK.five2extra, F2.f(BOOK.five2extra)))}, and their reflections.`),
    log: tr(`رسم ${ltr(pq(F2))}`, `graphing ${ltr(pq(F2))}`), res: pt(F2.h, F2.k) },
  // the wedding order: any b that strikes the wall's face below its top (not over it, not short in the moat)
  { id: 'wedding', obj: tr('أمر صلاح الدين: أصب السور، ولا ترمِ فوقه', 'Salah al-Din’s order: hit the wall, never over it'),
    run: async () => {
      hideBoard(); await shotP(1.6);
      caption(tr(`${ltr('a = −0.02')} و ${ltr('c = 14')}. اختر b بحيث يكون ${ltr(`0 < h(${WX}) < ${WTOP}`)}: على وجه السور، تحت أعلاه.`, `${ltr('a = −0.02')} and ${ltr('c = 14')}. Choose b so that ${ltr(`0 < h(${WX}) < ${WTOP}`)}: on the wall’s face, below its top.`), NOTES.wedding);
      const q = await lab({ title: tr(`اختر b: السور بين ${ltr('0')} و ${ltr('24')} م`, `Choose b: the wall is ${ltr('0')} to ${ltr('24 m')}`), start: { a: -0.02, b: 1.6, c: 14 }, keys: ['b'], range: { b: [0.6, 1.8, 0.1] },
        until: q => at60(q) > 0 && at60(q) < WTOP, auto: { b: 1.2 }, readout: verdict });
      WED_B = q.b; closeLab({ keep: true });
      await fireBeat(); await throwStone(quad(-0.02, WED_B, 14)); ghost.hide();
    },
    done: tr('أصاب الحجر السور، وبرج العرس سالم. هكذا يعمل المهندس: يحسب قبل أن يرمي.', 'The stone struck the wall, and the wedding tower is safe. That is the engineer’s way: work it out before you throw.'),
    log: tr('أمر العرس', 'the wedding order'), get res() { return 'b = ' + n(WED_B); } },
];

const WORKSHOP = workshop({ missions: MISSIONS, intro: tr('المسائل واحدة تلو الأخرى، والرسم أمامك.', 'The problems one by one, with the graph in front of you.') });
boot({
  chapters: [[tr('قاعدة الحجر', 'The stone’s rule'), ch1, IDEAS1], [tr('جدول الكشّافة', 'The scouts’ table'), ch2, IDEAS2], [tr('قانون المعلّم', 'The master’s formula'), ch3, IDEAS3],
    [tr('سلسلة الجسر', 'The drawbridge chain'), ch4, IDEAS4], [tr('رمية الليل', 'The night strike'), ch5, IDEAS5], [tr('مجلس الفجر', 'The council at dawn'), ch6, IDEAS6],
    [tr('ورشة الحصار', 'The siege workshop'), async () => { await STORY.title(6, tr('ورشة الحصار', 'The siege workshop'), tr('مسائل من الكتاب، ثم أمرُ صلاح الدين الأخير.', 'Problems from the book, then Salah al-Din’s last order.')); await WORKSHOP(); }]],
  audioKey: 'karak-arc-v2-audio', formulas: FORMULA, codex: CODEX, next: '../../algebra/quadratic-transformations.html',
  slug: 'karak-arc-v2', teach: true, music: false, cleanup: () => { closeLab(); STORY.hide(); }, reset: () => { night(DUSK); SHOW.reset(); showBreach(false); torchOff(); },
  rows: q => [[tr('القاعدة', 'rule'), 'h(x) = ' + poly(q.a, q.b, q.c)], [tr('المحور', 'axis'), 'x = ' + n(q.h)], [tr('الرأس', 'vertex'), pt(q.h, q.k)], [tr('عند السور', 'at the wall'), 'h(60) = ' + n(at60(q))]],
  // the cover: dusk, the stone high over the moat on its way to the wall, its glowing track behind it
  cover: () => { night(.45); TB.settle(.28); const x = 36; stone.visible = true; stone.position.set(x, T0.f(x), 0); trail.set(T0.f, 0, WX); trail.progress(x / WX); cam.cut(V(-22, 18, 64), V(34, 16, 0)); },
});
