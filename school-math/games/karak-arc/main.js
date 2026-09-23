// «منجنيق قلعة الكرك» 1 — the quadratic function (Jordan Grade 9, lesson 2.3). Embedded in
// school-math/algebra/quadratic-functions.html (its portal). The child is the siege engineer of Karak Castle; the
// stone's height is a quadratic in the distance.
// Taught as a lesson, in the book's order, with the explanation on screen (not hidden behind «لماذا؟»):
//   1 what a quadratic function is (standard form, a ≠ 0, the parent y = x², the parabola) → check;
//   2 symmetry: the table with two lost cells, the pair 0/60, the plumb line, PREDICT the lost heights, the vertex,
//     the maximum point vs the maximum value;
//   3 the axis formula derived line by line from the pair (ax² + bx + c = c → x = 0 or −b/a → −b/2a), the book's
//     worked Example 1, then a check;
//   4 the sign of a (predict the direction first), max/min, domain and range, reading a graph → check;
//   5 the five-step graph: the book's Example 5 worked on the board, then the player's own throw, fired to check.
// The siege workshop then works the book's items. The series' kit (renderer, castle, beats, board, explain(),
// workshop) is ../karak/stage.js; every number is computed in ../karak/quad.js from ../karak/data.js, and
// tools/tests/karak-arc.mjs checks them. Bilingual (tr()).
import { V, E, bg, wait, tween, setBeam } from '../engine/core.js';
import { Score } from '../engine/audio.js';
import { ltr, tr, mathify, objective, objProgress, objDone, caption, addEntry, veil, eqToCodex, setLabel } from '../engine/ui.js';
import { clean, poly, pt } from '../karak/quad.js';
import { T0, TABLE_X, T1, T1_EXTRA, BOOK, landing } from '../karak/data.js';
import { n, hx, pq, sub, axisCalc, cf, cam, S, stone, trail, ghost, pairB, point, vertexMark, landMark, setPlumb,
  showCard, redrawCard, explain, ask, showBoard, hideBoard, BD, renderBoard, boardPick, fiveStep, fireBeat, throwStone, plotBeat, plumbBeat, reflectBeat,
  freshPlane, shotP, shotV, shot, VIEW, TB, setFormula, workshop, boot } from '../karak/stage.js';

const Y = q => ltr('y = ' + pq(q));
const plus = (a, b) => tr(a.ar + b.ar, a.en + b.en);
const PAIRS = TABLE_X.filter(x => x < T0.h).map(x => [x, clean(2 * T0.h - x)]);   // equal heights either side of the axis
const PRE = [0, 60, 70], FROM_TABLE = [10, 20, 30], PREDICT = [40, 50];            // chapter 2: given, plotted, predicted
const CHECK = tr('أتحقق من فهمي', 'Check your understanding');

/* ======================================================================
   Notes («لماذا؟»): only the reasons that deserve a second paragraph
   ====================================================================== */
const NOTES = {
  a0: { title: tr('لماذا a ≠ 0؟', 'Why a ≠ 0?'),
    text: tr(`لو كان ${ltr('a = 0')} لاختفى الحد ${ltr('x²')} وصار ${ltr('f(x) = bx + c')}: اقتران خطي رسمه مستقيم، لا قطع مكافئ.`,
      `If ${ltr('a = 0')} the ${ltr('x²')} term vanishes and ${ltr('f(x) = bx + c')} is left: a linear function, whose graph is a line, not a parabola.`) },
  parabola: { title: tr('لماذا قطع مكافئ؟', 'Why a parabola?'),
    text: tr('الحجر يتقدّم أفقياً بسرعة ثابتة، والجاذبية تسحبه نحو الأسفل مسافةً تكبر مع مربّع الزمن. فالارتفاع اقتران تربيعي في المسافة، ورسم كل اقتران تربيعي قطع مكافئ (إذا أهملنا مقاومة الهواء).',
      'The stone moves forward at a steady speed while gravity pulls it down by a distance that grows with the square of the time. So its height is a quadratic function of the distance, and the graph of every quadratic is a parabola (leaving out air resistance).') },
  symmetry: { title: tr('لماذا المسار متماثل؟', 'Why is the path symmetric?'),
    text: tr('يصعد الحجر ويهبط بالطريقة نفسها: قبل القمة بزمن ما وبعدها بالزمن نفسه يكون على الارتفاع نفسه، وقد تقدّم المسافة نفسها لأن سرعته الأفقية ثابتة. لذلك يتكرر كل ارتفاع على بعدين متساويين من خط القمة.',
      'The stone rises and falls the same way: a given time before the top and the same time after it, it is at the same height, and it has moved the same distance because its forward speed is steady. So every height repeats at equal distances from the line through the top.') },
  range: { title: tr(`لماذا المدى ${ltr('y ≤ ' + n(T0.k))}؟`, `Why is the range ${ltr('y ≤ ' + n(T0.k))}?`),
    text: tr(`الرأس أعلى نقطة لأن ${ltr('a < 0')}، فكل ارتفاع آخر أقل من ${ltr(n(T0.k))}. أما المجال فكل الأعداد الحقيقية، لأن القاعدة تقبل أيّ x؛ وفي الرمية نفسها تهمّنا فقط ${ltr('0 ≤ x ≤ ' + n(landing(T0)))}.`,
      `The vertex is the highest point because ${ltr('a < 0')}, so every other height is below ${ltr(n(T0.k))}. The domain is all real numbers, because the rule accepts any x; for the throw itself only ${ltr('0 ≤ x ≤ ' + n(landing(T0)))} matters.`) },
};
const FORMULA = ['f(x) = ax² + bx + c', `h(${n(T0.h)} − d) = h(${n(T0.h)} + d)`, 'x = −b/2a'];
const EX1 = BOOK.ex1;
const codexHow = L => { const ar = L === 'ar', m = s => `<span class="m">${s}</span>`;
  return ar ? `<p><b>المصطلحات:</b> الاقتران التربيعي ${m('f(x) = ax² + bx + c')} حيث ${m('a ≠ 0')} (الصورة القياسية)، والاقتران الرئيس ${m('y = x²')}. رسمه قطع مكافئ له رأس ومحور تماثل. نقطة القيمة العظمى هي النقطة ${m('(x, y)')}، والقيمة العظمى هي ${m('y')} وحدها.</p>
<ol><li>المحور ${m('x = −b/2a')}، والرأس ${m('(−b/2a, f(−b/2a))')}. مثال: ${m(poly(EX1.a, EX1.b, EX1.c))}: المحور ${m('x = 1')} والرأس ${m('(1, −1)')}. رتّب الحدود أولاً: ${m('5 + 16x − 2x²')} فيه ${m('a = −2')}. إذا ${m('b = 0')} فالرأس على محور y: ${m('x² + 3')} رأسه ${m('(0, 3)')}.</li>
<li>${m('a > 0')}: يفتح للأعلى، والرأس نقطة قيمة صغرى، والمدى ${m('y ≥ k')}. ${m('a < 0')}: يفتح للأسفل، والرأس نقطة قيمة عظمى، والمدى ${m('y ≤ k')}. المجال كل الأعداد الحقيقية.</li>
<li>من الرسم نقرأ: الرأس، ومحور التماثل المارّ به، والقيمة العظمى أو الصغرى، والمجال والمدى.</li>
<li>الرسم بخمس خطوات: الاتجاه والمحور والرأس؛ المقطع y عند ${m('x = 0')}؛ نقطة أخرى في جهة المقطع؛ عيّن النقاط واعكسها حول المحور؛ صِلها بمنحنى أملس.</li></ol>`
  : `<p><b>Terms:</b> a quadratic function ${m('f(x) = ax² + bx + c')} with ${m('a ≠ 0')} (standard form); the parent function ${m('y = x²')}. Its graph is a parabola with a vertex and an axis of symmetry. The maximum point is the point ${m('(x, y)')}; the maximum value is its ${m('y')} alone.</p>
<ol><li>The axis is ${m('x = −b/2a')}, the vertex ${m('(−b/2a, f(−b/2a))')}. Example: ${m(poly(EX1.a, EX1.b, EX1.c))}: axis ${m('x = 1')}, vertex ${m('(1, −1)')}. Order the terms first: in ${m('5 + 16x − 2x²')}, ${m('a = −2')}. If ${m('b = 0')} the vertex is on the y-axis: ${m('x² + 3')} has its vertex at ${m('(0, 3)')}.</li>
<li>${m('a > 0')}: opens up, the vertex is a minimum point, range ${m('y ≥ k')}. ${m('a < 0')}: opens down, the vertex is a maximum point, range ${m('y ≤ k')}. The domain is all real numbers.</li>
<li>From a graph we read the vertex, the axis of symmetry through it, the maximum or minimum value, the domain and the range.</li>
<li>Graphing in five steps: direction, axis and vertex; the y-intercept at ${m('x = 0')}; one more point on the y-intercept's side; plot them and reflect them in the axis; join them with a smooth curve.</li></ol>`; };
const CODEX = {
  how: { get ar() { return codexHow('ar'); }, get en() { return codexHow('en'); } },
  why: tr(Object.values(NOTES).map(nt => `<p><b>${nt.title.ar}</b> ${mathify(nt.text.ar)}</p>`).join(''), Object.values(NOTES).map(nt => `<p><b>${nt.title.en}</b> ${mathify(nt.text.en)}</p>`).join('')),
};

/* ======================================================================
   1 — what a quadratic function is
   ====================================================================== */
async function ch1() {
  if (!E.INSTANT) { cam.cut(V(-80, 110, 230), V(10, 0, 0)); bg(veil(0, 2)); Score.set({ pad: 1, pedal: .5, arp: 0, high: .2 }); }
  await shotP(4.2);
  objective(tr('أطلِق المنجنيق وراقب الحجر', 'Fire the trebuchet and watch the stone'));
  caption(tr('منجنيق القلعة جاهز، والحجر في المقلاع.', 'The castle’s trebuchet is cocked, the stone in its sling.'));
  await fireBeat(); objDone();
  await throwStone(T0);
  caption(tr(`عبر الحجر السور والخندق وسقط على بعد ${ltr(n(landing(T0)))} م. ارتفاعه في كل لحظة تحكمه قاعدة واحدة.`, `The stone cleared the wall and the moat and landed ${ltr(n(landing(T0)) + ' m')} away. One rule gives its height at every moment.`)); await wait(3.8);
  showCard({ q: T0, title: tr('قاعدة ارتفاع الحجر', 'The rule of the stone’s height') });
  caption(tr(`في القاعدة حدّ فيه ${ltr('x²')}، وهو أعلى قوة: هذا اقتران تربيعي.`, `The rule has a term in ${ltr('x²')}, the highest power: this is a quadratic function.`)); await wait(3.6);
  caption(tr(`صورته القياسية ${ltr('f(x) = ax² + bx + c')} حيث ${ltr('a ≠ 0')}. في قاعدتنا ${ltr('a = ' + n(T0.a))} و ${ltr('b = ' + n(T0.b))} و ${ltr('c = ' + n(T0.c))}.`, `Its standard form is ${ltr('f(x) = ax² + bx + c')} with ${ltr('a ≠ 0')}. In our rule ${ltr('a = ' + n(T0.a))}, ${ltr('b = ' + n(T0.b))} and ${ltr('c = ' + n(T0.c))}.`), NOTES.a0); await wait(4.4);
  showCard(null);
  await shotV(VIEW.board, 2);
  showBoard({ win: { x0: -3, x1: 3, y0: -1, y1: 9 }, title: 'y = x²', curves: [{ f: x => x * x, color: '#9fd6df' }], pts: [-2, -1, 0, 1, 2].map(x => ({ x, y: x * x })) });
  caption(tr(`أبسط اقتران تربيعي هو الاقتران الرئيس ${ltr('y = x²')}. رسمه منحنى على شكل U اسمه القطع المكافئ.`, `The simplest quadratic is the parent function ${ltr('y = x²')}. Its graph is a U-shaped curve called a parabola.`)); await wait(4.2);
  caption(tr('مسار الحجر قطع مكافئ أيضاً، لكنه مقلوب: يفتح للأسفل.', 'The stone’s path is a parabola too, only upside down: it opens downward.')); await wait(3.4);
  objective(CHECK, '1/2', 0);
  await ask(tr('أيّ هذه اقتران تربيعي؟', 'Which of these is a quadratic function?'), [{ v: 'lin', f: 'f(x) = 3x + 2' }, { v: 'q', f: 'f(x) = 2x² − x' }, { v: 'cub', f: 'f(x) = x³ + 1' }], 'q',
    v => v === 'lin' ? tr(`لا يوجد ${ltr('x²')}: هذا اقتران خطي رسمه مستقيم.`, `There is no ${ltr('x²')}: this is linear, and its graph is a line.`) : tr(`أعلى قوة هنا ${ltr('3')}: هذا اقتران تكعيبي، لا تربيعي.`, `The highest power here is ${ltr('3')}: this is cubic, not quadratic.`));
  objProgress('2/2', .5);
  await ask(tr(`ما قيمة a في ${ltr('f(x) = 5 + 16x − 2x²')}؟`, `What is a in ${ltr('f(x) = 5 + 16x − 2x²')}?`), [5, 16, -2].map(v => ({ v, f: 'a = ' + n(v) })), -2,
    () => tr(`رتّب الحدود أولاً: ${ltr('−2x² + 16x + 5')}. a هو معامل ${ltr('x²')} أينما كُتب.`, `Put the terms in order first: ${ltr('−2x² + 16x + 5')}. a is the coefficient of ${ltr('x²')}, wherever it is written.`));
  objDone(); hideBoard();
  await eqToCodex(FORMULA[0], tr('الاقتران التربيعي بالصورة القياسية، و a ≠ 0', 'a quadratic function in standard form, with a ≠ 0'));
  setFormula(1);
  addEntry(tr(`الاقتران التربيعي ${ltr('f(x) = ax² + bx + c')} حيث ${ltr('a ≠ 0')}، والاقتران الرئيس ${ltr('y = x²')}. رسمه قطع مكافئ.`, `A quadratic function is ${ltr('f(x) = ax² + bx + c')} with ${ltr('a ≠ 0')}; the parent function is ${ltr('y = x²')}. Its graph is a parabola.`));
}

/* ======================================================================
   2 — symmetry: the axis, the vertex, the maximum point vs value
   ====================================================================== */
async function ch2() {
  freshPlane();
  await shotP(2);
  showCard({ table: { xs: TABLE_X, f: T0.f, skip: [T0.h, landing(T0)], hide: PREDICT }, title: tr('جدول الراصدين: ارتفاع الحجر <b>h</b> بالأمتار', 'The watchmen’s table: the stone’s height <b>h</b> in metres') });
  caption(tr('الراصدون على البرج سجّلوا ارتفاع الحجر كل 10 م، لكن خانتين ضاعتا.', 'The watchmen on the tower logged the stone’s height every 10 m, but two cells were lost.')); await wait(3.8);
  PRE.forEach(x => { point('' + x, x, T0.f(x)); S.cells.add(x); }); redrawCard();
  objective(tr('ضع ثلاث نقاط من الجدول', 'Plot three points from the table'), '0/3', 0);
  caption(tr('اسحب كل نقطة إلى ارتفاعها في الجدول.', 'Drag each point up to its height in the table.'));
  for (const [i, x] of FROM_TABLE.entries()) { await plotBeat('' + x, x, T0.f(x)); objProgress(`${i + 1}/3`, (i + 1) / 3); }
  objDone();
  setBeam(pairB[0], V(0, T0.c, 0), V(PAIRS[0][1], T0.c, 0), 1);
  caption(tr(`الارتفاع ${ltr(n(T0.c))} عند ${ltr('x = 0')} وعند ${ltr('x = ' + n(PAIRS[0][1]))}: الحجر نزل كما صعد.`, `The height is ${ltr(n(T0.c))} at ${ltr('x = 0')} and at ${ltr('x = ' + n(PAIRS[0][1]))}: the stone came down as it went up.`)); await wait(4);
  objective(tr(`علّق الشاقول في منتصف ${ltr('0')} و ${ltr(n(PAIRS[0][1]))}`, `Hang the plumb line halfway between ${ltr('0')} and ${ltr(n(PAIRS[0][1]))}`));
  await plumbBeat(T0.h, 6, x => tr(`عند ${ltr('x = ' + n(x))} لا يتساوى البعدان عن ${ltr('0')} و ${ltr(n(PAIRS[0][1]))}.`, `At ${ltr('x = ' + n(x))} the distances to ${ltr('0')} and ${ltr(n(PAIRS[0][1]))} are not equal.`)); objDone();
  caption(tr(`المسار متماثل حول المستقيم ${ltr('x = ' + n(T0.h))}: محور التماثل. كل ارتفاع يتكرر على بعدين متساويين منه.`, `The path is symmetric about the line ${ltr('x = ' + n(T0.h))}: the axis of symmetry. Every height repeats at equal distances from it.`), NOTES.symmetry); await wait(4.4);
  // predict the lost cells from the symmetry, then plot them
  objective(tr('توقّع الخانتين الضائعتين', 'Predict the two lost cells'), '0/2', 0);
  await ask(tr(`${ltr('x = 40')} على بعد 10 من المحور، مثل ${ltr('x = 20')}. كم الارتفاع عند ${ltr('x = 40')}؟`, `${ltr('x = 40')} is 10 from the axis, like ${ltr('x = 20')}. What is the height at ${ltr('x = 40')}?`), [24, 30, 32].map(v => ({ v, f: n(v) })), T0.f(40),
    v => v === 32 ? tr(`${ltr('32')} على المحور نفسه، عند ${ltr('x = 30')}.`, `${ltr('32')} is on the axis itself, at ${ltr('x = 30')}.`) : tr(`${ltr('24')} عند ${ltr('x = 10')}، على بعد 20 من المحور. توأم 40 هو 20.`, `${ltr('24')} is at ${ltr('x = 10')}, 20 from the axis. The twin of 40 is 20.`));
  objProgress('1/2', .5);
  await ask(tr(`وعند ${ltr('x = 50')}؟`, `And at ${ltr('x = 50')}?`), [14, 24, 30].map(v => ({ v, f: n(v) })), T0.f(50),
    v => v === 14 ? tr(`${ltr('14')} عند 0 و 60، على بعد 30 من المحور. ${ltr('50')} على بعد 20.`, `${ltr('14')} is at 0 and 60, 30 from the axis. ${ltr('50')} is 20 away.`) : tr(`${ltr('30')} توأم 40. توأم 50 هو ${ltr('10')}.`, `${ltr('30')} is the twin of 40. The twin of 50 is ${ltr('10')}.`));
  objDone();
  objective(tr('ضع النقطتين المتوقّعتين', 'Plot the two predicted points'), '0/2', 0);
  for (const [i, x] of PREDICT.entries()) {
    const tw = clean(2 * T0.h - x);
    await plotBeat('' + x, x, T0.f(x), { why: () => tr(`توأم ${ltr(n(x))} هو ${ltr(n(tw))}، وارتفاعه ${ltr(n(T0.f(tw)))}.`, `The twin of ${ltr(n(x))} is ${ltr(n(tw))}, and its height is ${ltr(n(T0.f(tw)))}.`) });
    objProgress(`${i + 1}/2`, (i + 1) / 2);
  }
  objDone(); redrawCard();
  caption(tr('الجدول يؤكد توقّعك: عرفنا الخانتين من التماثل وحده.', 'The table confirms your prediction: symmetry alone gave the two cells.')); await wait(3.6);
  trail.set(T0.f, 0, landing(T0)); trail.progress(0); await tween(1.6, t => trail.progress(t));
  caption(tr('النقاط كلها على منحنى أملس واحد: قطع مكافئ.', 'All the points lie on one smooth curve: a parabola.'), NOTES.parabola); await wait(3.8);
  S.pairs = true; redrawCard();
  PAIRS.forEach(([a, b], i) => setBeam(pairB[i], V(a, T0.f(a), 0), V(b, T0.f(b), 0), 1));
  pairB.forEach(b => { b.visible = false; }); vertexMark(T0); setLabel('p30', null, 0);
  caption(tr(`أعلى نقطة ${ltr(pt(T0.h, T0.k))} على المحور: رأس القطع.`, `The highest point ${ltr(pt(T0.h, T0.k))} is on the axis: the vertex.`)); await wait(3.6);
  objective(CHECK);
  await ask(tr(`أعلى نقطة ${ltr(pt(T0.h, T0.k))}. ما القيمة العظمى؟`, `The highest point is ${ltr(pt(T0.h, T0.k))}. What is the maximum value?`), [{ v: 'pt', f: pt(T0.h, T0.k) }, { v: 'k', f: n(T0.k) }, { v: 'h', f: n(T0.h) }], 'k',
    v => v === 'pt' ? tr(`${ltr(pt(T0.h, T0.k))} نقطة القيمة العظمى، أي (x, y). القيمة العظمى هي y وحدها.`, `${ltr(pt(T0.h, T0.k))} is the maximum point, (x, y). The maximum value is y alone.`) : tr(`${ltr(n(T0.h))} هو x: أين تقع القمة، لا كم ارتفاعها.`, `${ltr(n(T0.h))} is x: where the top is, not how high.`));
  objDone();
  landMark(landing(T0));
  caption(tr(`القيمة العظمى ${ltr(n(T0.k))} م. وعند ${ltr('x = ' + n(landing(T0)))} صار الارتفاع صفراً: هناك سقط الحجر.`, `The maximum value is ${ltr(n(T0.k) + ' m')}. And at ${ltr('x = ' + n(landing(T0)))} the height is zero: that is where the stone landed.`)); await wait(3.8);
  await eqToCodex(FORMULA[1], tr('كل ارتفاع يتكرر على بعدين متساويين من محور التماثل', 'every height repeats at equal distances from the axis of symmetry'));
  setFormula(2);
  addEntry(tr('القطع المكافئ متماثل حول مستقيم رأسي هو محور التماثل، والرأس عليه.', 'A parabola is symmetric about a vertical line, the axis of symmetry, and the vertex is on it.'));
  addEntry(tr(`نقطة القيمة العظمى ${ltr(pt(T0.h, T0.k))}؛ القيمة العظمى <span class="num">${n(T0.k)}</span>، أي y وحدها.`, `The maximum point is ${ltr(pt(T0.h, T0.k))}; the maximum value is <span class="num">${n(T0.k)}</span>, y alone.`));
  showCard(null);
}

/* ======================================================================
   3 — the axis formula, derived from the pair; a worked example; a check
   ====================================================================== */
async function ch3() {
  freshPlane(); trail.set(T0.f, 0, landing(T0)); trail.progress(1); vertexMark(T0); setPlumb(T0.h);
  await shotP(2);
  caption(tr(`وجدنا المحور من الزوج ${ltr('0')} و ${ltr(n(PAIRS[0][1]))}. هل نحتاج جدولاً كل مرة؟ لا: نجده من القاعدة.`, `We found the axis from the pair ${ltr('0')} and ${ltr(n(PAIRS[0][1]))}. Do we need a table every time? No: we find it from the rule.`)); await wait(4);
  objective(tr('ابنِ قانون المحور خطوة خطوة', 'Build the axis formula step by step'));
  await explain(tr('من أين يأتي المحور؟', 'Where does the axis come from?'), [
    { line: 'f(0) = c', say: tr(`عند ${ltr('x = 0')} يبقى ${ltr('c')} وحده: الارتفاع ${ltr(n(T0.c))} لحظة الإطلاق.`, `At ${ltr('x = 0')} only ${ltr('c')} is left: the height ${ltr(n(T0.c))} at launch.`) },
    { line: 'ax² + bx + c = c', say: tr(`أين يعود الارتفاع إلى ${ltr('c')} مرة أخرى؟ نحلّ هذه المعادلة.`, `Where does the height come back to ${ltr('c')}? We solve this equation.`) },
    { line: 'ax² + bx = 0', say: tr(`نطرح ${ltr('c')} من الطرفين.`, `Take ${ltr('c')} from both sides.`) },
    { line: 'x(ax + b) = 0', say: tr(`نخرج ${ltr('x')} عاملاً مشتركاً.`, `Take ${ltr('x')} out as a common factor.`) },
    { ask: { q: tr(`${ltr('x(ax + b) = 0')}. ما حلّاها؟`, `${ltr('x(ax + b) = 0')}. What are its solutions?`), opts: [{ v: 'a', f: 'x = 0, x = −b/a' }, { v: 'b', f: 'x = b/a' }, { v: 'c', f: 'x = −b/2a' }], answer: 'a',
        why: v => v === 'b' ? tr(`ضرب يساوي صفراً: إما ${ltr('x = 0')} أو ${ltr('ax + b = 0')}، أي ${ltr('x = −b/a')} (انتبه للإشارة).`, `A product is zero: either ${ltr('x = 0')} or ${ltr('ax + b = 0')}, so ${ltr('x = −b/a')} (mind the sign).`) : tr(`ليس بعد: ${ltr('ax + b = 0')} يعطي ${ltr('x = −b/a')}، والحل الآخر ${ltr('x = 0')}.`, `Not yet: ${ltr('ax + b = 0')} gives ${ltr('x = −b/a')}, and the other solution is ${ltr('x = 0')}.`) },
      line: 'x = 0 , x = −b/a', say: tr(`الارتفاع ${ltr('c')} عند نقطتين: ${ltr('0')} و ${ltr('−b/a')}.`, `The height ${ltr('c')} occurs at two points: ${ltr('0')} and ${ltr('−b/a')}.`) },
    { line: 'x = (0 + (−b/a)) ÷ 2 = −b/2a', say: tr('المحور في منتصف النقطتين: هذا قانون محور التماثل.', 'The axis is halfway between them: that is the formula for the axis of symmetry.') },
    { line: `−b/a = −(${n(T0.b)}) ÷ (${n(T0.a)}) = ${n(-T0.b / T0.a)} ,  x = ${n(T0.h)}`, say: tr(`في رميتنا ${ltr('−b/a = ' + n(-T0.b / T0.a))}: هو الزوج ${ltr('0')} و ${ltr(n(PAIRS[0][1]))} نفسه، والمحور ${ltr(n(T0.h))} حيث علّقنا الشاقول.`, `In our throw ${ltr('−b/a = ' + n(-T0.b / T0.a))}: the very pair ${ltr('0')} and ${ltr(n(PAIRS[0][1]))}, and the axis is ${ltr(n(T0.h))}, where we hung the plumb line.`) },
  ]);
  objDone();
  await eqToCodex('x = −b/2a', tr('محور التماثل، والرأس عليه: (−b/2a, f(−b/2a))', 'the axis of symmetry, with the vertex on it: (−b/2a, f(−b/2a))'));
  setFormula(3);
  // the book's worked Example 1
  objective(tr('تابع المثال المحلول', 'Follow the worked example'));
  await explain(tr(`مثال محلول: ${ltr('f(x) = 5x² − 10x + 4')}`, `Worked example: ${ltr('f(x) = 5x² − 10x + 4')}`), [
    { line: 'a = 5 ,  b = −10', say: tr('نقرأ a و b من الصورة القياسية.', 'Read a and b from the standard form.') },
    { line: 'x = −(−10) ÷ (2 × 5) = 1', say: tr(`نعوّض في ${ltr('x = −b/2a')}. انتبه: ${ltr('−(−10) = 10')}.`, `Substitute into ${ltr('x = −b/2a')}. Careful: ${ltr('−(−10) = 10')}.`) },
    { line: 'f(1) = 5(1)² − 10(1) + 4 = −1', say: tr('نعوّض x في القاعدة لنجد الإحداثي y للرأس.', 'Substitute x into the rule to find the vertex’s y.') },
    { line: tr(`الرأس ${ltr('(1, −1)')}`, `vertex ${ltr('(1, −1)')}`), say: tr(`المحور ${ltr('x = 1')} والرأس ${ltr('(1, −1)')}.`, `The axis is ${ltr('x = 1')} and the vertex is ${ltr('(1, −1)')}.`) },
  ]);
  objDone();
  // check: x² + 2x − 1
  const C = BOOK.checkAxis;
  objective(CHECK, '0/2', 0);
  await ask(tr(`${Y(C)}. أين محور التماثل؟`, `${Y(C)}. Where is the axis of symmetry?`), [C.h, -C.h, clean(-C.b)].map(v => ({ v, f: 'x = ' + n(v) })), C.h,
    v => v === -C.h ? tr(`نقصت إشارة السالب: ${ltr(`x = ${axisCalc(C)} = ${n(C.h)}`)}.`, `The minus sign is missing: ${ltr(`x = ${axisCalc(C)} = ${n(C.h)}`)}.`) : tr(`نسيت القسمة على ${ltr('2a')}: ${ltr(`x = ${axisCalc(C)} = ${n(C.h)}`)}.`, `You forgot to divide by ${ltr('2a')}: ${ltr(`x = ${axisCalc(C)} = ${n(C.h)}`)}.`));
  objProgress('1/2', .5);
  await ask(tr(`والرأس؟`, `And the vertex?`), [{ v: 'a', f: pt(C.h, C.k) }, { v: 'b', f: pt(C.h, -C.k) }, { v: 'c', f: pt(C.h, C.c) }], 'a',
    v => v === 'b' ? tr(`${ltr(`f(${n(C.h)}) = ${sub(C, C.h)} = ${n(C.k)}`)}.`, `${ltr(`f(${n(C.h)}) = ${sub(C, C.h)} = ${n(C.k)}`)}.`) : tr(`${ltr(n(C.c))} هو c، الارتفاع عند ${ltr('x = 0')}. عوّض ${ltr('x = ' + n(C.h))}.`, `${ltr(n(C.c))} is c, the height at ${ltr('x = 0')}. Substitute ${ltr('x = ' + n(C.h))}.`));
  objDone(); showCard(null);
  addEntry(tr(`المحور ${ltr('x = −b/2a')} لأن الارتفاع c يتكرر عند ${ltr('0')} و ${ltr('−b/a')}. الرأس ${ltr('(−b/2a, f(−b/2a))')}.`, `The axis is ${ltr('x = −b/2a')} because the height c repeats at ${ltr('0')} and ${ltr('−b/a')}. The vertex is ${ltr('(−b/2a, f(−b/2a))')}.`));
}

/* ======================================================================
   4 — the sign of a, max/min, domain and range, reading a graph
   ====================================================================== */
const DIR = [{ v: 'up', f: tr('للأعلى ∪', 'up ∪') }, { v: 'down', f: tr('للأسفل ∩', 'down ∩') }];
async function ch4() {
  freshPlane();
  await shotV(VIEW.board, 2);
  caption(tr('إشارة a تحدّد اتجاه القطع، ومنه نعرف إن كان للرأس قيمة عظمى أم صغرى.', 'The sign of a decides the parabola’s direction, and from it whether the vertex is a maximum or a minimum.')); await wait(4);
  // a > 0: predict, then see
  const U = BOOK.ex2up;
  showBoard({ win: { x0: -7, x1: 3, y0: -2, y1: 10 }, title: 'y = ' + pq(U) });
  objective(tr('توقّع الاتجاه، ثم تحقّق', 'Predict the direction, then check'));
  await ask(tr(`${Y(U)}: ${ltr('a = ' + cf(U.a) + ' > 0')}. كيف يفتح القطع؟`, `${Y(U)}: ${ltr('a = ' + cf(U.a) + ' > 0')}. Which way does it open?`), DIR, 'up',
    () => tr(`a موجب: ${ltr('ax²')} يكبر كلما ابتعدنا عن الرأس، فيفتح للأعلى.`, `a is positive: ${ltr('ax²')} grows as we move away from the vertex, so it opens up.`));
  BD.curves.push({ f: U.f, color: '#9fd6df' }); renderBoard();
  objective(tr(`انقر الرأس بعد حساب ${ltr('x = −b/2a')}`, `Click the vertex after working out ${ltr('x = −b/2a')}`));
  await boardPick([{ x: U.h, y: U.k }], { wrong: () => ltr(`x = ${axisCalc(U)} = ${n(U.h)}`) + '.' }); objDone();
  caption(tr(`يفتح للأعلى، فالرأس ${ltr(pt(U.h, U.k))} أدنى نقطة: نقطة القيمة الصغرى، والقيمة الصغرى ${ltr(n(U.k))}.`, `It opens up, so the vertex ${ltr(pt(U.h, U.k))} is the lowest point: the minimum point; the minimum value is ${ltr(n(U.k))}.`)); await wait(4.2);
  await ask(tr('ما مدى هذا الاقتران؟', 'What is the range of this function?'), [{ v: 'ge', f: 'y ≥ ' + n(U.k) }, { v: 'le', f: 'y ≤ ' + n(U.k) }, { v: 'all', f: tr('كل الأعداد الحقيقية', 'all real numbers') }], 'ge',
    v => v === 'le' ? tr('يفتح للأعلى: كل قيمه فوق القيمة الصغرى أو عليها.', 'It opens up: all its values are at or above the minimum.') : tr(`كل الأعداد الحقيقية هي المجال (أيّ x). أما y فلا تنزل تحت ${ltr(n(U.k))}.`, `All real numbers is the domain (any x). y never goes below ${ltr(n(U.k))}.`));
  // a < 0
  const D = BOOK.ex2down;
  showBoard({ win: { x0: -4, x1: 6, y0: -4, y1: 6 }, title: 'y = ' + pq(D) });
  await ask(tr(`${Y(D)}: ${ltr('a = ' + cf(D.a) + ' < 0')}. كيف يفتح القطع؟`, `${Y(D)}: ${ltr('a = ' + cf(D.a) + ' < 0')}. Which way does it open?`), DIR, 'down',
    () => tr('a سالب: القيم تصغر كلما ابتعدنا عن الرأس، فيفتح للأسفل مثل مسار الحجر.', 'a is negative: the values shrink away from the vertex, so it opens down, like the stone’s path.'));
  BD.curves.push({ f: D.f, color: '#f2b45a' }); renderBoard();
  objective(tr('انقر الرأس', 'Click the vertex'));
  await boardPick([{ x: D.h, y: D.k }], { wrong: () => ltr(`x = ${axisCalc(D)} = ${n(D.h)}`) + '.' }); objDone();
  await ask(tr(`الرأس ${ltr(pt(D.h, D.k))}. ما القيمة العظمى؟`, `The vertex is ${ltr(pt(D.h, D.k))}. What is the maximum value?`), [{ v: 'p', f: pt(D.h, D.k) }, { v: 'k', f: n(D.k) }, { v: 'h', f: n(D.h) }], 'k',
    v => v === 'p' ? tr('هذه نقطة القيمة العظمى (x, y). القيمة العظمى هي y وحدها.', 'That is the maximum point (x, y). The maximum value is y alone.') : tr(`${ltr(n(D.h))} هو x، موقع الرأس لا ارتفاعه.`, `${ltr(n(D.h))} is x, where the vertex is, not its height.`));
  caption(tr(`القيمة العظمى ${ltr(n(D.k))}، فالمدى ${ltr('y ≤ ' + n(D.k))}.`, `The maximum value is ${ltr(n(D.k))}, so the range is ${ltr('y ≤ ' + n(D.k))}.`)); await wait(3.6);
  // the domain
  await ask(tr('وما مجال أيّ اقتران تربيعي؟', 'And the domain of any quadratic function?'), [{ v: 'all', f: tr('كل الأعداد الحقيقية', 'all real numbers') }, { v: 'x0', f: 'x ≥ 0' }, { v: 'rng', f: 'y ≤ k' }], 'all',
    v => v === 'rng' ? tr('هذا مدى، يتحدث عن y. المجال عن x.', 'That is a range, about y. The domain is about x.') : tr('القاعدة تقبل أيّ عدد x، سالباً أو موجباً.', 'The rule accepts any number x, negative or positive.'));
  hideBoard(); await shotP(2);
  caption(tr(`رميتنا: ${ltr('a < 0')}، فالمجال كل الأعداد الحقيقية والمدى ${ltr('y ≤ ' + n(T0.k))}. أما الرمية نفسها فبين ${ltr('x = 0')} و ${ltr('x = ' + n(landing(T0)))}.`, `Our throw: ${ltr('a < 0')}, so the domain is all real numbers and the range ${ltr('y ≤ ' + n(T0.k))}. The throw itself runs from ${ltr('x = 0')} to ${ltr('x = ' + n(landing(T0)))}.`), NOTES.range); await wait(4.6);
  // reading the properties from a graph alone (Example 4)
  const G = BOOK.ex4graph;
  await shotV(VIEW.board, 1.6);
  showBoard({ win: { x0: -6, x1: 2, y0: -6, y1: 4 }, title: 'y = ?', curves: [{ f: G.f, color: '#f2b45a' }] });
  objective(tr('اقرأ الخصائص من الرسم وحده', 'Read the properties from the graph alone'));
  caption(tr('هنا لا قاعدة: الرسم وحده. انقر الرأس.', 'No rule here, only the graph. Click the vertex.'));
  await boardPick([{ x: G.h, y: G.k }], { wrong: () => tr('الرأس أعلى نقطة على هذا المنحنى.', 'The vertex is the highest point of this curve.') });
  await ask(tr(`الرأس ${ltr(pt(G.h, G.k))}. ما مدى الاقتران؟`, `The vertex is ${ltr(pt(G.h, G.k))}. What is the range?`), [{ v: 'le', f: 'y ≤ ' + n(G.k) }, { v: 'ge', f: 'y ≥ ' + n(G.k) }, { v: 'all', f: tr('كل الأعداد الحقيقية', 'all real numbers') }], 'le',
    v => v === 'ge' ? tr('المنحنى يفتح للأسفل: كل قيمه تحت الرأس أو عليه.', 'It opens down: all its values are at or below the vertex.') : tr('كل الأعداد الحقيقية هي المجال، لا المدى.', 'All real numbers is the domain, not the range.'));
  objDone();
  caption(tr(`من الرسم: الرأس ${ltr(pt(G.h, G.k))} نقطة قيمة عظمى، والمحور ${ltr('x = ' + n(G.h))}، والقيمة العظمى ${ltr(n(G.k))}، والمدى ${ltr('y ≤ ' + n(G.k))}.`, `From the graph: the vertex ${ltr(pt(G.h, G.k))} is a maximum point, the axis is ${ltr('x = ' + n(G.h))}, the maximum value ${ltr(n(G.k))}, the range ${ltr('y ≤ ' + n(G.k))}.`)); await wait(4.4);
  // check: 2x² − 2x + 8
  const C = BOOK.checkMin;
  objective(CHECK);
  await ask(tr(`${Y(C)}: قيمة عظمى أم صغرى، وكم هي؟`, `${Y(C)}: a maximum or a minimum, and how much?`), [{ v: 'min', f: tr(`صغرى، ${ltr(n(C.k))}`, `a minimum, ${ltr(n(C.k))}`) }, { v: 'max', f: tr(`عظمى، ${ltr(n(C.k))}`, `a maximum, ${ltr(n(C.k))}`) }, { v: 'minc', f: tr(`صغرى، ${ltr(n(C.c))}`, `a minimum, ${ltr(n(C.c))}`) }], 'min',
    v => v === 'max' ? tr(`${ltr('a = ' + n(C.a) + ' > 0')}: يفتح للأعلى، فالرأس قيمة صغرى.`, `${ltr('a = ' + n(C.a) + ' > 0')}: it opens up, so the vertex is a minimum.`) : tr(`${ltr(n(C.c))} هو c، الارتفاع عند ${ltr('x = 0')}. الرأس عند ${ltr(`x = ${axisCalc(C)} = ${n(C.h)}`)}، و ${ltr(`f(${n(C.h)}) = ${n(C.k)}`)}.`, `${ltr(n(C.c))} is c, the value at ${ltr('x = 0')}. The vertex is at ${ltr(`x = ${axisCalc(C)} = ${n(C.h)}`)}, and ${ltr(`f(${n(C.h)}) = ${n(C.k)}`)}.`));
  objDone(); hideBoard();
  addEntry(tr(`${ltr('a > 0')} يفتح للأعلى والرأس قيمة صغرى (${ltr('y ≥ k')})، و ${ltr('a < 0')} يفتح للأسفل والرأس قيمة عظمى (${ltr('y ≤ k')}). المجال كل الأعداد الحقيقية.`, `${ltr('a > 0')} opens up with a minimum at the vertex (${ltr('y ≥ k')}); ${ltr('a < 0')} opens down with a maximum (${ltr('y ≤ k')}). The domain is all real numbers.`));
}

/* ======================================================================
   5 — the five-step graph: the book's Example 5 worked, then the player's own throw
   ====================================================================== */
async function ch5() {
  freshPlane();
  await shotV(VIEW.board, 2);
  const Q5 = BOOK.ex5, x5 = BOOK.ex5extra, P = (x, y, color) => { BD.pts.push({ x, y, color, label: pt(x, y) }); renderBoard(); };
  showBoard({ win: { x0: -3, x1: 5, y0: -6, y1: 10 }, title: 'y = ' + pq(Q5) });
  objective(tr('تابع المثال المحلول: الرسم بخمس خطوات', 'Follow the worked example: graphing in five steps'));
  await explain(tr(`مثال محلول: ${Y(Q5)}`, `Worked example: ${Y(Q5)}`), [
    { line: tr(`1) ${ltr('a < 0')}: للأسفل. ${ltr(`x = ${axisCalc(Q5)} = ${n(Q5.h)}`)}، ${ltr(`f(${n(Q5.h)}) = ${n(Q5.k)}`)}`, `1) ${ltr('a < 0')}: down. ${ltr(`x = ${axisCalc(Q5)} = ${n(Q5.h)}`)}, ${ltr(`f(${n(Q5.h)}) = ${n(Q5.k)}`)}`),
      do: () => P(Q5.h, Q5.k, '#e8b45a'), say: tr(`الخطوة 1: الاتجاه، ثم المحور والرأس ${ltr(pt(Q5.h, Q5.k))}، وهو قيمة عظمى.`, `Step 1: the direction, then the axis and the vertex ${ltr(pt(Q5.h, Q5.k))}, a maximum.`) },
    { line: `2) f(0) = ${n(Q5.c)} → ${pt(0, Q5.c)}`, do: () => P(0, Q5.c), say: tr(`الخطوة 2: المقطع y، عند ${ltr('x = 0')}.`, `Step 2: the y-intercept, at ${ltr('x = 0')}.`) },
    { line: `3) f(${n(x5)}) = ${sub(Q5, x5)} = ${n(Q5.f(x5))} → ${pt(x5, Q5.f(x5))}`, do: () => P(x5, Q5.f(x5)), say: tr('الخطوة 3: نقطة أخرى في جهة المقطع y.', 'Step 3: one more point on the y-intercept’s side.') },
    { line: tr(`4) انعكاس حول ${ltr('x = ' + n(Q5.h))}: ${ltr(pt(2 * Q5.h, Q5.c))} و ${ltr(pt(2 * Q5.h - x5, Q5.f(x5)))}`, `4) reflect in ${ltr('x = ' + n(Q5.h))}: ${ltr(pt(2 * Q5.h, Q5.c))} and ${ltr(pt(2 * Q5.h - x5, Q5.f(x5)))}`),
      do: () => { P(2 * Q5.h, Q5.c, '#b9a4e6'); P(2 * Q5.h - x5, Q5.f(x5), '#b9a4e6'); }, say: tr('الخطوة 4: لكل نقطة توأم على البعد نفسه من المحور.', 'Step 4: every point has a twin at the same distance from the axis.') },
    { line: tr('5) منحنى أملس يمرّ بالنقاط الخمس', '5) a smooth curve through the five points'), do: () => { BD.curves.push({ f: Q5.f, color: '#9fd6df' }); renderBoard(); }, say: tr('الخطوة 5: نصل النقاط بمنحنى أملس.', 'Step 5: join the points with a smooth curve.') },
  ]);
  objDone(); hideBoard(); showCard(null);
  // the player's turn: a lighter counterweight, drawn in five steps, then fired along the drawing
  await shotP(2);
  showCard({ q: T1, title: tr('دورك: ثقل موازنة أخف', 'Your turn: a lighter counterweight') });
  caption(tr(`ثقل موازنة أخف يعطي رمية جديدة: ${ltr(hx(T1))}. ارسمها قبل أن نطلق.`, `A lighter counterweight gives a new throw: ${ltr(hx(T1))}. Draw it before we fire.`)); await wait(3.8);
  objective(tr('ارسم الرمية الجديدة بخمس خطوات', 'Graph the new throw in five steps'), '0/5', 0);
  caption(tr(`الخطوة 1: ${ltr('a < 0')} فيفتح للأسفل. علّق الشاقول على ${ltr('x = −b/2a')}.`, `Step 1: ${ltr('a < 0')}, so it opens down. Hang the plumb line on ${ltr('x = −b/2a')}.`));
  await plumbBeat(T1.h, 34, x => tr(`${ltr(`−b/2a = ${axisCalc(T1)} = ${n(T1.h)}`)}، لا ${ltr(n(x))}.`, `${ltr(`−b/2a = ${axisCalc(T1)} = ${n(T1.h)}`)}, not ${ltr(n(x))}.`));
  vertexMark(T1); objProgress('1/5', .2);
  caption(tr(`الرأس ${ltr(`(${n(T1.h)}, h(${n(T1.h)})) = ${pt(T1.h, T1.k)}`)}: قيمة عظمى.`, `The vertex is ${ltr(`(${n(T1.h)}, h(${n(T1.h)})) = ${pt(T1.h, T1.k)}`)}: a maximum.`)); await wait(3.6);
  caption(tr(`الخطوة 2: المقطع y عند ${ltr('x = 0')}.`, `Step 2: the y-intercept, at ${ltr('x = 0')}.`));
  await plotBeat('a', 0, T1.c, { color: 0x9fd6df, why: y => tr(`${ltr(`h(0) = c = ${n(T1.c)}`)}، لا ${ltr(n(y))}.`, `${ltr(`h(0) = c = ${n(T1.c)}`)}, not ${ltr(n(y))}.`) }); objProgress('2/5', .4);
  caption(tr(`الخطوة 3: نقطة أخرى في جهة المقطع: ${ltr('x = ' + T1_EXTRA)}.`, `Step 3: one more point on the y-intercept’s side: ${ltr('x = ' + T1_EXTRA)}.`));
  await plotBeat('b', T1_EXTRA, T1.f(T1_EXTRA), { color: 0x9fd6df, why: () => tr(`${ltr(`h(${n(T1_EXTRA)}) = ${sub(T1, T1_EXTRA)} = ${n(T1.f(T1_EXTRA))}`)}.`, `${ltr(`h(${n(T1_EXTRA)}) = ${sub(T1, T1_EXTRA)} = ${n(T1.f(T1_EXTRA))}`)}.`) }); objProgress('3/5', .6);
  caption(tr('الخطوة 4: اعكس النقطتين حول المحور.', 'Step 4: reflect both points in the axis.'));
  await reflectBeat(['a', 'b'], T1); objProgress('4/5', .8);
  caption(tr('الخطوة 5: صِل النقاط بمنحنى أملس.', 'Step 5: join the points with a smooth curve.'));
  ghost.set(T1.f, 0, landing(T1)); ghost.progress(0); await tween(1.6, t => ghost.progress(t)); objProgress('5/5', 1); objDone();
  objective(tr('أطلِق لتتحقق من رسمك', 'Fire to check your drawing'));
  caption(tr('إن كان الرسم صحيحاً سيمرّ الحجر بالنقاط الخمس.', 'If the drawing is right, the stone will pass through all five points.'));
  await fireBeat(); await throwStone(T1); objDone();
  caption(tr('مرّ الحجر بالنقاط الخمس: الرسم والرمية شيء واحد.', 'The stone went through all five points: the drawing and the throw are one.')); await wait(3.8);
  addEntry(tr('الرسم بخمس خطوات: الاتجاه والمحور والرأس، المقطع y، نقطة أخرى، الانعكاس حول المحور، ثم منحنى أملس.', 'Graphing in five steps: direction, axis and vertex; the y-intercept; one more point; reflect in the axis; then a smooth curve.'));
  showCard(null);
}

/* ======================================================================
   THE SIEGE WORKSHOP: the book's 2.3 items; a wrong answer points back to its chapter
   ====================================================================== */
const SEE = { axis: tr(' راجع فصل «قانون المحور».', ' See the chapter “The axis formula”.'), max: tr(' راجع فصل «العظمى والصغرى والمدى».', ' See the chapter “Max, min and range”.'), five: tr(' راجع فصل «الرسم بخمس خطوات».', ' See the chapter “Graphing in five steps”.') };
const FB = BOOK.football, FW = BOOK.fireworks, HS = BOOK.hisham, F2 = BOOK.five2;
const MISSIONS = [
  { id: 'order', obj: tr(`رتّب ${ltr('−8x + 2x²')} ثم انقر رأسه`, `Put ${ltr('−8x + 2x²')} in order, then click its vertex`),
    run: () => { showBoard({ win: { x0: -2, x1: 6, y0: -10, y1: 10 }, title: 'y = −8x + 2x²', curves: [{ f: BOOK.order.f, color: '#9fd6df' }] }); return boardPick([{ x: BOOK.order.h, y: BOOK.order.k }], { wrong: () => plus(tr(`رتّب: ${ltr(pq(BOOK.order))}، فالمحور ${ltr('x = ' + axisCalc(BOOK.order))}.`, `In order: ${ltr(pq(BOOK.order))}, so the axis is ${ltr('x = ' + axisCalc(BOOK.order))}.`), SEE.axis) }); },
    done: tr(`${ltr(pq(BOOK.order))}: ${ltr('a = ' + n(BOOK.order.a))} و ${ltr('b = ' + n(BOOK.order.b))}، فالمحور ${ltr('x = ' + n(BOOK.order.h))} والرأس ${ltr(pt(BOOK.order.h, BOOK.order.k))} قيمة صغرى.`, `${ltr(pq(BOOK.order))}: ${ltr('a = ' + n(BOOK.order.a))} and ${ltr('b = ' + n(BOOK.order.b))}, so the axis is ${ltr('x = ' + n(BOOK.order.h))} and the vertex ${ltr(pt(BOOK.order.h, BOOK.order.k))} is a minimum.`),
    log: tr(`رأس ${ltr('−8x + 2x²')}`, `the vertex of ${ltr('−8x + 2x²')}`), res: pt(BOOK.order.h, BOOK.order.k) },
  { id: 'hisham', obj: tr('من أصاب: هشام أم ملك؟', 'Who is right: Hisham or Malak?'),
    pre: () => showBoard({ win: { x0: -10, x1: 2, y0: -10, y1: 45 }, title: 'y = ' + pq(HS), curves: [{ f: HS.f, color: '#9fd6df' }] }),
    q: tr(`${Y(HS)}. كتب هشام ${ltr('x = ' + n(-HS.h))}، وكتبت ملك ${ltr('x = ' + n(HS.h))}. أين المحور؟`, `${Y(HS)}. Hisham wrote ${ltr('x = ' + n(-HS.h))}, Malak wrote ${ltr('x = ' + n(HS.h))}. Where is the axis?`),
    opts: [-HS.h, HS.h, clean(-HS.b / HS.a)].map(v => ({ v, f: 'x = ' + n(v) })), answer: HS.h,
    why: v => plus(v === -HS.h ? tr(`${ltr('b = ' + n(HS.b))}، فـ ${ltr('−b = ' + n(-HS.b))} و ${ltr('2a = ' + n(2 * HS.a))}: ${ltr(n(-HS.b) + ' ÷ (' + n(2 * HS.a) + ') = ' + n(HS.h))}. هشام أخطأ في الإشارة.`, `${ltr('b = ' + n(HS.b))}, so ${ltr('−b = ' + n(-HS.b))} and ${ltr('2a = ' + n(2 * HS.a))}: ${ltr(n(-HS.b) + ' ÷ (' + n(2 * HS.a) + ') = ' + n(HS.h))}. Hisham made a sign error.`) : tr(`${ltr('−b/a = ' + n(-HS.b / HS.a))}؛ المحور ${ltr('−b/2a')}، نصفه.`, `${ltr('−b/a = ' + n(-HS.b / HS.a))}; the axis is ${ltr('−b/2a')}, half of it.`), SEE.axis),
    done: tr(`${ltr(`x = ${axisCalc(HS)} = ${n(HS.h)}`)}: ملك على حق، والرأس ${ltr(pt(HS.h, HS.k))}.`, `${ltr(`x = ${axisCalc(HS)} = ${n(HS.h)}`)}: Malak is right, and the vertex is ${ltr(pt(HS.h, HS.k))}.`),
    log: tr('خطأ هشام', 'Hisham’s slip'), res: 'x = ' + n(HS.h) },
  { id: 'fireworks', obj: tr('جد أقصى ارتفاع للنجمة', 'Find the star’s greatest height'),
    pre: () => showBoard({ win: { x0: 0, x1: 5, y0: 400, y1: 640 }, vx: 't', title: 'h(t) = ' + pq(FW, 't'), curves: [{ f: FW.f, color: '#f2b45a' }] }),
    q: tr(`نجمة ألعاب نارية: ${ltr('h(t) = ' + pq(FW, 't'))}. ما أقصى ارتفاع تبلغه؟`, `A firework star: ${ltr('h(t) = ' + pq(FW, 't'))}. What is the greatest height it reaches?`),
    opts: [FW.c, FW.f(Math.floor(FW.h)), FW.k].map(v => ({ v, f: n(v) })), answer: FW.k,
    why: v => plus(v === FW.c ? tr(`${ltr('h(0) = ' + n(FW.c))} ارتفاعها لحظة الإطلاق، لا أعلاه.`, `${ltr('h(0) = ' + n(FW.c))} is its height at launch, not its greatest.`) : tr(`${ltr('h(' + n(Math.floor(FW.h)) + ') = ' + n(FW.f(Math.floor(FW.h))))}، لكن الرأس عند ${ltr('t = ' + axisCalc(FW) + ' = ' + n(FW.h))}.`, `${ltr('h(' + n(Math.floor(FW.h)) + ') = ' + n(FW.f(Math.floor(FW.h))))}, but the vertex is at ${ltr('t = ' + axisCalc(FW) + ' = ' + n(FW.h))}.`), SEE.max),
    done: tr(`${ltr(`t = ${n(FW.h)}`)} و ${ltr(`h(${n(FW.h)}) = ${n(FW.k)}`)} م: القيمة العظمى.`, `${ltr(`t = ${n(FW.h)}`)} and ${ltr(`h(${n(FW.h)}) = ${n(FW.k)} m`)}: the maximum value.`),
    log: tr('النجمة النارية', 'the firework star'), res: n(FW.k) + ' m' },
  { id: 'football', obj: tr('جد أقصى ارتفاع للكرة', 'Find the ball’s greatest height'),
    pre: () => showBoard({ win: { x0: -0.5, x1: 4.5, y0: -8, y1: 80 }, vx: 't', title: 'h(t) = ' + pq(FB, 't'), curves: [{ f: FB.f, color: '#9fd6df' }] }),
    q: tr(`كرة قدم ركلت للأعلى: ${ltr('h(t) = ' + pq(FB, 't'))}. ما أقصى ارتفاع تبلغه؟`, `A football kicked up: ${ltr('h(t) = ' + pq(FB, 't'))}. What is the greatest height it reaches?`),
    opts: [FB.f(3), FB.k, FB.h].map(v => ({ v, f: n(v) })), answer: FB.k,
    why: v => plus(v === FB.h ? tr(`${ltr('t = ' + n(FB.h))} زمن أعلى نقطة، لا ارتفاعها.`, `${ltr('t = ' + n(FB.h))} is the time of the highest point, not its height.`) : tr(`${ltr('h(3) = ' + n(FB.f(3)))}: ارتفاعها بعد 3 ثوانٍ، وهي نازلة.`, `${ltr('h(3) = ' + n(FB.f(3)))}: its height after 3 seconds, on the way down.`), SEE.max),
    done: tr(`${ltr(`t = ${axisCalc(FB)} = ${n(FB.h)}`)}، و ${ltr(`h(${n(FB.h)}) = ${n(FB.k)}`)}: القيمة العظمى.`, `${ltr(`t = ${axisCalc(FB)} = ${n(FB.h)}`)}, and ${ltr(`h(${n(FB.h)}) = ${n(FB.k)}`)}: the maximum value.`),
    log: tr('كرة القدم', 'the football'), res: n(FB.k) },
  { id: 'five', obj: tr(`ارسم ${Y(F2)} بخمس خطوات: الرأس، ثم المقطع y، ثم ${ltr('x = ' + n(BOOK.five2extra))}`, `Graph ${Y(F2)} in five steps: the vertex, then the y-intercept, then ${ltr('x = ' + n(BOOK.five2extra))}`),
    run: () => { showBoard({ win: { x0: -2, x1: 6, y0: -10, y1: 4 }, title: 'y = ' + pq(F2) }); return fiveStep(F2, BOOK.five2extra); },
    done: tr(`الرأس ${ltr(pt(F2.h, F2.k))} قيمة صغرى، و ${ltr(pt(0, F2.c))} و ${ltr(pt(BOOK.five2extra, F2.f(BOOK.five2extra)))}، وانعكاساهما ${ltr(pt(2 * F2.h, F2.c))} و ${ltr(pt(2 * F2.h - BOOK.five2extra, F2.f(BOOK.five2extra)))}.`, `The vertex ${ltr(pt(F2.h, F2.k))} is a minimum; then ${ltr(pt(0, F2.c))} and ${ltr(pt(BOOK.five2extra, F2.f(BOOK.five2extra)))}, reflected to ${ltr(pt(2 * F2.h, F2.c))} and ${ltr(pt(2 * F2.h - BOOK.five2extra, F2.f(BOOK.five2extra)))}.`),
    log: tr(`رسم ${ltr(pq(F2))}`, `graphing ${ltr(pq(F2))}`), res: pt(F2.h, F2.k) },
];

boot({
  chapters: [[tr('ما الاقتران التربيعي؟', 'What is a quadratic?'), ch1], [tr('التماثل والرأس', 'Symmetry and the vertex'), ch2], [tr('قانون المحور', 'The axis formula'), ch3],
    [tr('العظمى والصغرى والمدى', 'Max, min and range'), ch4], [tr('الرسم بخمس خطوات', 'Graphing in five steps'), ch5],
    [tr('ورشة الحصار', 'The siege workshop'), workshop({ missions: MISSIONS, intro: tr('ورشة الحصار: مسائل من الكتاب، واحدة تلو الأخرى.', 'The siege workshop: problems from the book, one at a time.') })]],
  audioKey: 'karak-arc-audio', formulas: FORMULA, codex: CODEX, next: '../../algebra/quadratic-transformations.html',
  rows: q => [[tr('القاعدة', 'rule'), 'h(x) = ' + poly(q.a, q.b, q.c)], [tr('المحور', 'axis'), 'x = ' + n(q.h)], [tr('الرأس', 'vertex'), pt(q.h, q.k)], [tr('القيمة العظمى', 'maximum value'), n(q.k)], [tr('المدى', 'range'), 'y ≤ ' + n(q.k)]],
  // the cover: the stone high over the north wall and the moat, its glowing track behind it, the trebuchet's arm
  // still swinging through, the castle's dark walls and the camp on the ridge beyond
  cover: () => { TB.settle(.28); const x = 27; stone.visible = true; stone.position.set(x, T0.f(x), 0); trail.set(T0.f, 0, landing(T0)); trail.progress(x / landing(T0)); const s = shot('cover'); cam.cut(s.pos, s.look); },
});
