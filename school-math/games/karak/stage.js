// The shared kit of the Karak series' games (karak-arc 2.3, karak-move 2.4, karak-land 3.1): the renderer, the
// castle and its trebuchet, the graph drawn in the world, the dock (the table, the rule card, a question), the
// engineer's board, every beat the player's hands do, the camera, the siege workshop and the boot.
// Each game's main.js keeps only its own lesson: its chapters, notes, codex, missions and cover.
//
// import { … } from '../karak/stage.js'; then, at the end of main.js:
//   boot({ chapters, audioKey, formulas, next, codex: { how, why }, rows, reset, cover })
//     chapters  [[tr(name), async fn], …]; the last one is usually workshop({ missions, intro })
//     formulas  the codex's formula lines, unlocked one by one with setFormula(k)
//     next      the next lesson's page, relative to the game folder ('../../algebra/…html')
//     rows(q)   the free-throw panel's rows for the current throw q: [[tr(label), text], …]
//     reset()   the game's own reset before a chapter replay; cover() lays out the ?shot still (no text)
//   opt-in (karak-arc-v2; see engine/teach.js): chapters[i][2] names the chapter's ideas, the game calls idea(k) at
//   each; slug saves the learner's progress; teach adds teacher mode; cleanup() closes the game's own panels
//   whenever the HUD is cleared. typed({ id, q, expect, why }) asks for a number in #answer.
// A mission is { id, obj, log, res, done, run() } or { id, obj, log, res, done, pre(), q, opts, answer, why },
// with an optional after() once it is logged.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { $, V, clamp, lerp, E, ABORT, hooks, ease, tween, wait, bg, loopUntil, tickTweens, camRig, hdr, makeBeam, setBeam } from '../engine/core.js';
import { configureAudio, startAudioOnGesture, blip, burst, Score, play } from '../engine/audio.js';
import { UI, ltr, tr, T, onLang, LANG, tex, mathify, texInto, typeset, objective, objProgress, objDone, caption, toast, resetCodexBase, closeMenu, wireHud, hudState, bootWhenLoaded, setCamera, label, setLabel, updateLabels, chip, clearChip, clearChips, updateChips, renderChapters } from '../engine/ui.js';
import { initInput, awaitInput, setInput, setCursor, pick, ray, setNdc } from '../engine/input.js';
import { initAssets, whenLoaded } from '../engine/assets.js';
import { setupQuality } from '../engine/quality.js';
import { explain as explainIn, endExplain } from '../engine/explain.js';
import { configureTeach, progress, teacher, initTeacher, teacherIdea, answer as answerIn } from '../engine/teach.js';
import { buildKarak, makeTrebuchet, makeFlight, makeStone, graphGrid, groundH, WALL, RELEASE_Y, shot } from './world.js';
import { near, level, shift, mirror, PARENT, movePt, num, poly, vform, pt } from './quad.js';
import { T0, TABLE_X, MANTLET, TOWER, landing } from './data.js';

export const params = new URLSearchParams(location.search);
export const AUTO = params.has('auto'), SHOT = params.has('shot'), FAST = params.has('fast');
// <html data-karak="v2">: the Salah al-Din rebuild of the series. The world is mirrored (the trebuchet on the ridge throws
// AT the castle), the maths views are straight-on through a narrower lens, and the graph is drawn in high-contrast ink:
// dark paper, a gold throw, cyan predictions, a magenta vertex, a lime axis. The games without it are unchanged.
export const V2 = document.documentElement.dataset.karak === 'v2';
/* ---------- text helpers ---------- */
export const n = v => num(v, 2);
export const hx = q => 'h(x) = ' + poly(q.a, q.b, q.c);
export const pq = (q, v = 'x') => poly(q.a, q.b, q.c, v);
// a substitution written out from the rule itself: sub(T0, 20) → '−0.02(20)² + 1.2(20) + 14'
export const sub = (q, x) => { const X = `(${n(x)})`; return [[q.a, X + '²'], [q.b, X], [q.c, '']].filter(([k]) => k).map(([k, t], i) => (i ? (k < 0 ? ' − ' : ' + ') : k < 0 ? '−' : '') + (Math.abs(k) === 1 && t ? '' : n(Math.abs(k))) + t).join(''); };
export const axisCalc = q => `${q.b < 0 ? '−(' + n(q.b) + ')' : '−' + n(q.b)} ÷ (2 × ${n(q.a)})`;   // −b ÷ (2 × a)
export const cf = a => vform(a, 0, 0).replace('x²', '') || '1';   // a coefficient as written: ½, −½, 2
await Promise.all([document.fonts.load('400 40px "Azeret Mono"'), document.fonts.load('600 30px "Vazirmatn"')]).catch(() => {});

/* ======================================================================
   Renderer + post: GTAO for contact shadows, low bloom, a soft vignette
   ====================================================================== */
export const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: SHOT || FAST });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
initAssets(renderer);
export const camera = new THREE.PerspectiveCamera(V2 ? 34 : 42, innerWidth / innerHeight, .1, 6000);
export const scene = new THREE.Scene();
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight); gtao.blendIntensity = .7;
gtao.updateGtaoMaterial({ radius: 1.2, distanceExponent: 1.5, thickness: 2, scale: 1, samples: 8 }); composer.addPass(gtao);
// the AO is computed at half resolution and blended up (soft by nature, so it looks the same): at full resolution with 12
// samples a large screen queued more GPU work than a GTX 1060 could finish, and the browser froze for seconds to catch up
{ const size = gtao.setSize.bind(gtao); gtao.setSize = (w, h) => size(Math.max(1, Math.ceil(w / 2)), Math.max(1, Math.ceil(h / 2))); gtao.setSize(innerWidth, innerHeight); }
if (FAST && !SHOT) gtao.enabled = false;
// the AO pass ignores transparency: overlays, glows, lines, sprites and dust hide while it draws
if (gtao.overrideVisibility) { const hide0 = gtao.overrideVisibility.bind(gtao); gtao.overrideVisibility = function () { hide0(); this.scene.traverse(o => { if (o.isSprite || o.isPoints || o.isLine || o.userData.noAO || (o.isMesh && !Array.isArray(o.material) && o.material?.transparent)) o.visible = false; }); }; }
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .34, .5, .88); composer.addPass(bloom);
const fxPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec2 cc=vUv-.5; vec3 col=texture2D(tDiffuse,vUv).rgb;
      col*=mix(1.,smoothstep(1.05,.3,length(cc*vec2(1.05,1.))),.34);
      col+=(hash(vUv*vec2(1731.,977.)+fract(uTime))-.5)*.007; gl_FragColor=vec4(col,1.); }`,
});
composer.addPass(fxPass); composer.addPass(new OutputPass());
setupQuality({ renderer, composer, gtao, bloom, scene, force: SHOT });   // GTAO, bloom, pixel ratio and shadow maps scale to the device
setCamera(camera); initInput(canvas, camera);

/* ======================================================================
   Sound: the engine's one recorded set for every game; effects are real recordings
   ====================================================================== */
const CHORDS = [{ bass: 38, pad: [57, 62, 65, 69], arp: [62, 65, 69, 72] }, { bass: 36, pad: [55, 60, 64, 67], arp: [64, 67, 72, 74] },
  { bass: 34, pad: [58, 62, 65, 70], arp: [65, 70, 74, 77] }, { bass: 33, pad: [57, 60, 64, 69], arp: [60, 64, 69, 71] }];
let lastTick = 0;
export const sfx = {
  ui: () => burst(),
  tick() { const t = performance.now(); if (t - lastTick < 50) return; lastTick = t; burst(.006, 4200, .03); },
  lock() { const ch = Score.chord(); blip(ch.arp[1] + 24, .35, .03); blip(ch.arp[3] + 24, .55, .028, .09); },
  creak() { play('plank', { vol: .35, rate: .8 }); },
  launch() { play('wood-heavy', { vol: .55, rate: .85 }); play('plank', { vol: .3, rate: .7, when: .5 }); },
  land() { play('stone', { vol: .6, rate: .8 }); burst(.2, 200, .2, 'lowpass', .02); },
  crash() { play('wood-heavy', { vol: .6 }); play('plank', { vol: .5, rate: 1.1, when: .08 }); },
  wrong() { play('soft-no', { vol: .5 }); },
  chime() { const ch = Score.chord(); ch.arp.forEach((m, i) => blip(m + 12, 2.2, .04, i * .11)); },
};
UI.tick = sfx.ui; UI.chime = sfx.chime; UI.onObjectiveDone = sfx.chime;

/* ======================================================================
   The place: Karak Castle, the court's trebuchet, the camp on the ridge
   ====================================================================== */
export const K = buildKarak(scene, { renderer, side: V2 ? 'saladin' : 'castle' });   // the renderer gives the tier: board/low use the baked light (world.js)
export const TB = makeTrebuchet(K); scene.add(TB.group);
export const stone = makeStone(K); scene.add(stone);          // the stone in the sling (and in flight)
export const spent = makeStone(K); spent.userData.halo.visible = false; spent.visible = false; scene.add(spent);   // the last stone thrown, lying where it landed
export const mantlet = K.mantlet(MANTLET), tower = K.tower(TOWER);
mantlet.visible = tower.visible = false;                      // a game shows the ones it uses
export const COL = V2 ? { fl: 0xffc233, gh: 0x38e1ff, vx: 0xff4fa3, ax: 0x9bff5a, rt: 0x7dffb0, lv: 0xff8a4c, pt: 0xffffff, mir: 0xb69cff, bad: 0xff5a4a, accent: 0x5c939f }
  : { fl: 0xf2b45a, gh: 0x9fd6df, vx: 0xe8b45a, ax: 0x7fc4cf, rt: 0x9fd08a, lv: 0xd98f6b, pt: 0xf5efe4, mir: 0xb9a4e6, bad: 0xe0634f, accent: 0x5c939f };
const LW = V2 ? 1.9 : 1;   // v2 draws every path thicker
const S0 = () => ({ mode: 'lesson', beat: '', pairs: false, plumb: null, level: null, nsol: null, cases: [], roots: [], landed: null, hit: '', jobs: [], tf: null, plotX: null });
export const S = { ...S0(), cells: new Set() };

/* ---------- the graph in the world: the grid, the tracks, the markers ---------- */
export const grid = graphGrid(scene, { x0: -20, x1: 100, y0: V2 ? -20 : 0, y1: 45, step: 5, ink: V2 ? { fill: 'rgba(2,6,14,.62)', mid: 'rgba(170,205,255,.14)', major: 'rgba(210,228,255,.3)', axisR: .07, soft: true, pole: K.mats.wood, rope: new THREE.MeshStandardMaterial({ color: 0xd9c49a, roughness: .9 }), ground: x => K.ground(x, 0) } : null }); grid.userData.fade(0);
export const trail = makeFlight(scene, { color: COL.fl, r: .14 * LW });                                              // the stone's real track
export const ghost = makeFlight(scene, { color: COL.gh, dashed: true, r: .11 * LW, opacity: .9, k: 1.3 });    // a predicted path
export const ext = makeFlight(scene, { color: COL.fl, dashed: true, r: .09 * LW, opacity: .55 });               // the rule beyond the throw
export const sunk = makeFlight(scene, { color: COL.lv, dashed: true, r: .09, opacity: .7 });               // h(x) − k
export const turned = makeFlight(scene, { color: COL.mir, dashed: true, r: .1, opacity: .75 });            // h(−x): the trebuchet turned round
const FLIGHTS = [trail, ghost, ext, sunk, turned];
// v2: the maths is drawn brighter than the world: the final pass tone-maps the whole frame (ACES), which turned plain gold
// to mustard on the dusk ground, so the lines go in at PURE_K times their colour and come out saturated and bright
export const PURE_K = 2.3;
export const pure = (m, c) => { m.color.copy(hdr(c, PURE_K)); return m; };
if (V2) [[trail, COL.fl], [ghost, COL.gh], [ext, COL.fl], [sunk, COL.lv], [turned, COL.mir]].forEach(([f, c]) => { const m = f.mesh.material; pure(m, c); m.opacity = Math.max(m.opacity, .95); });
const LINES = [];
function line(color, r = .05, k = 1.4) { const b = makeBeam(color, r, k); if (V2) pure(b.material, color); b.material.depthTest = false; b.userData.noAO = true; b.userData.px = r; b.renderOrder = 3; scene.add(b); LINES.push(b); return b; }
function thickLines() { for (const b of LINES) { if (!b.visible) continue; const s = clamp(camera.position.distanceTo(b.position) * .0013, b.userData.px * .6, .4); b.scale.x = b.scale.z = s; } }
export const axisB = line(COL.ax, .06), levelB = line(COL.lv, .06), guideB = line(0xf5efe4, .04, 1), pairB = [0, 1, 2, 3].map(() => line(COL.vx, .04, 1.1)), reflB = [0, 1].map(() => line(COL.mir, .04, 1.1));
guideB.material.opacity = V2 ? .16 : .35; pairB.forEach(b => { b.material.opacity = .55; });
// the plumb bob that marks the axis of symmetry, and the knob of the height line
const brass = new THREE.MeshStandardMaterial({ color: 0xc09048, roughness: .35, metalness: .85, envMapIntensity: .6 });
const bob = new THREE.Mesh(new THREE.LatheGeometry([[0, -.9], [.18, -.55], [.34, -.1], [.34, .05], [.2, .22], [.06, .3], [0, .3]].map(([r, y]) => new THREE.Vector2(r, y)), 24), brass); bob.visible = false; bob.castShadow = true; scene.add(bob);
export const knob = new THREE.Mesh(new THREE.SphereGeometry(.55, 20, 14), new THREE.MeshBasicMaterial({ color: hdr(COL.lv, 1.5), depthTest: false, transparent: true })); knob.userData.noAO = true; knob.renderOrder = 5; knob.visible = false; scene.add(knob);
const DOT = new THREE.SphereGeometry(.42 * (V2 ? 1.35 : 1), 18, 12), dots = {};
export function dot(key, x, y, color = COL.pt) {
  let d = dots[key]; if (!d) { d = dots[key] = new THREE.Mesh(DOT, new THREE.MeshBasicMaterial({ color: hdr(color, 1.4), transparent: true, depthWrite: false, depthTest: false })); d.userData.noAO = true; d.renderOrder = 5; scene.add(d); }   // graph markers read through the walls
  if (V2) pure(d.material, color); else d.material.color.copy(hdr(color, 1.4)); d.position.set(x, y, 0); d.visible = true; return d;
}
export const noDot = (...ks) => ks.forEach(k => { if (dots[k]) dots[k].visible = false; });
const RING = new THREE.RingGeometry(.75, 1.02, 40), rings = {};
export function ring(key, x, color, y = 0) { let r = rings[key]; if (!r) { r = rings[key] = new THREE.Mesh(RING, new THREE.MeshBasicMaterial({ color: hdr(color, 1.6), transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide })); r.userData.noAO = true; r.renderOrder = 5; scene.add(r); } if (V2) pure(r.material, color); else r.material.color.copy(hdr(color, 1.6)); r.position.set(x, y, 0); r.visible = true; return r; }
export const noRing = (...ks) => ks.forEach(k => { if (rings[k]) rings[k].visible = false; });
export function setPlumb(x, vis = 1) { S.plumb = vis ? x : null; setBeam(axisB, V(x, 44.5, 0), V(x, 1.3, 0), vis); bob.visible = !!vis; bob.position.set(x, .95, 0); AN.axis = V(x, 44, 0); setLabel('axis', vis ? ltr('x = ' + n(x)) : null, vis ? 1 : 0); }

/* ---------- labels ---------- */
export const AN = {};
const LBL = new Set();
function lab(id, cls, off = [0, -24]) { label(id, cls, () => AN[id] || V(), off); LBL.add(id); }
for (let x = -10; x <= 90; x += 10) { lab('tx' + x, 'tick', [0, 14]); AN['tx' + x] = V(x, 0, 0); }
for (let y = 10; y <= 40; y += 10) { lab('ty' + y, 'tick', [-12, 0]); AN['ty' + y] = V(-20, y, 0); }
lab('ux', 'unit', [0, 32]); AN.ux = V(84, 0, 0); lab('uy', 'unit', [0, -14]); AN.uy = V(-20, 45, 0);
['axis', 'vx', 'land', 'tb', 'tgt', 'lv', 'Lgv', 'Lgl', 'Lr0', 'Lr1', 'Lc0', 'Lc1', 'tag'].forEach(id => lab(id, id === 'axis' ? 'ax' : id === 'vx' || id === 'Lgv' ? 'vx' : id[0] === 'L' || id === 'land' ? 'rt' : id === 'lv' ? 'lv' : 'tag'));
for (const x of [...TABLE_X, 'a', 'b', 'am', 'bm']) lab('p' + x, 'pt', [0, -20]);
const hideLabels = () => LBL.forEach(id => { if (!id.startsWith('t') || id === 'tb' || id === 'tgt' || id === 'tag') setLabel(id, null, 0); });
export function ticks(k) { for (let x = -10; x <= 90; x += 10) setLabel('tx' + x, ltr(String(x)), k); for (let y = 10; y <= 40; y += 10) setLabel('ty' + y, ltr(String(y)), k); setLabel('ux', tr('المسافة x (م)', 'distance x (m)'), k); setLabel('uy', tr('الارتفاع (م)', 'height (m)'), k); }
export function point(key, x, y, color = COL.pt, text = null) { dot(key, x, y, color); AN['p' + key] = V(x, y, 0); setLabel('p' + key, text ?? ltr(n(y)), 1); }
export function vertexMark(q, color = COL.vx) { dot('vx', q.h, q.k, color); AN.vx = V(q.h, q.k + .2, 0); setLabel('vx', ltr(pt(q.h, q.k)), 1); }
export function landMark(x, color = COL.rt) { ring('land', x, color); AN.land = V(x, 0, 0); setLabel('land', ltr('x = ' + n(x)), 1); }
export function hideAll() {
  FLIGHTS.forEach(f => f.hide()); LINES.forEach(b => { b.visible = false; }); Object.values(dots).forEach(d => { d.visible = false; }); Object.values(rings).forEach(r => { r.visible = false; });
  bob.visible = knob.visible = false; S.plumb = null; hideLabels();
}
/** The survey (the coordinate plane) set up in front of the viewer: the mast rises, the rope runs out, the lines come up,
    then the numbers. The v2 story brings it out when the maths starts, not before. hideGrid() takes it away. */
export function revealGrid(time = 2) {
  if (E.INSTANT) { grid.userData.reveal(1); ticks(1); return Promise.resolve(); }
  ticks(0); return tween(time, u => grid.userData.reveal(u)).then(() => ticks(1));
}
export function hideGrid() { grid.userData.fade(0); ticks(0); }
/** The chapter's opening: nothing drawn, the trebuchet at home, the grid and its numbers on. */
export function freshPlane() { S.beat = ''; hideAll(); homeTB(); grid.userData.fade(1); ticks(1); S.pairs = false; showCard(null); hideBoard(); }

/* ======================================================================
   Input on the throw plane (z = 0) and the autopilot
   ====================================================================== */
const PLANE = new THREE.Plane(V(0, 0, 1), 0);
function planeHit(e) { setNdc(e); const p = V(); return ray.ray.intersectPlane(PLANE, p) ? p : null; }
function autoRun(fn, delay = .9) { if (!AUTO) return; const tok = E.RUN; bg(wait(delay).then(() => { if (tok === E.RUN) return fn(); })); }

/* ======================================================================
   The dock: a table, the rule card, a question with options
   ====================================================================== */
let CARD = null;
/** showCard({ table: { xs, f, skip, hide }, title }), showCard({ q, title, sub }) or showCard(null); explain() also
    writes into the card. A hidden table cell shows '?' until its x is plotted. */
function renderCard() {
  const c = $('#card'); if (!CARD) { c.hidden = true; return; } c.hidden = false;
  if (CARD.table) {
    const { xs, f, skip = [], hide = [] } = CARD.table;
    c.innerHTML = `<h5>${T(CARD.title)}</h5><table class="tbl"><tr><th>x (m)</th>${xs.map(x => `<td>${x}</td>`).join('')}</tr><tr><th>h (m)</th>${xs.map(x => `<td class="${S.cells.has(x) ? 'on' : ''}${S.pairs && !skip.includes(x) ? ' pair' : ''}${hide.includes(x) && !S.cells.has(x) ? ' gap' : ''}">${hide.includes(x) && !S.cells.has(x) ? '?' : n(f(x))}</td>`).join('')}</tr></table>`;
  } else {
    const q = CARD.q;
    c.innerHTML = `<h5>${T(CARD.title)}</h5><div class="rule" id="rule"></div><div class="rule-sub" id="rule-sub"></div>`;
    const cf = v => `<span class="${v[0]}">${v[1]}</span>`, A = n(q.a), B = n(q.b), C = n(q.c);
    texInto($('#rule'), `h(x) = ${cf(['ca', A])}x<sup>2</sup> + ${cf(['cb', B])}x + ${cf(['cc', C])}`.replace('+ <span class="cb">−', '− <span class="cb">').replace('+ <span class="cc">−', '− <span class="cc">'));
    $('#rule-sub').innerHTML = mathify(T(CARD.sub || tr(`${ltr('a = ' + A)}، ${ltr('b = ' + B)}، ${ltr('c = ' + C)}`, `${ltr('a = ' + A)}, ${ltr('b = ' + B)}, ${ltr('c = ' + C)}`)));
  }
}
export const showCard = c => { endExplain($('#card'), true); CARD = c; if (!E.INSTANT) renderCard(); else $('#card').hidden = true; };
export const redrawCard = () => { if (!E.INSTANT) renderCard(); };
/** A worked explanation built line by line on the dock (engine/explain.js); its questions use ask(). */
export const explain = (title, steps) => { CARD = null; return explainIn($('#card'), title, steps, { ask: a => ask(a.q, a.opts, a.answer, a.why) }); };
let ASK = null;
function renderAsk() {
  if (!ASK) return; $('#ask-q').innerHTML = mathify(T(ASK.q)); const box = $('#ask-opts'); box.innerHTML = '';
  // teacher mode: the question first, so the class thinks before it sees choices; the options on a tap
  if (teacher.on && !ASK.shown) { const r = document.createElement('button'); r.className = 'opt reveal'; r.textContent = T(tr('اعرض الخيارات', 'Show the options')); r.onclick = () => { ASK.shown = true; sfx.ui(); renderAsk(); }; box.appendChild(r); return; }
  ASK.opts.forEach(o => { const b = document.createElement('button'); b.className = 'opt'; b.dataset.v = o.v; b.innerHTML = typeof o.f === 'string' ? (tex(o.f) ?? o.f) : mathify(T(o.f));
    b.onclick = () => { if (!ASK || ASK.done) return; if (ASK.any) { ASK.answer = o.v; ASK.done = true; b.classList.add('on'); sfx.ui(); return; } if (o.v === ASK.answer) { ASK.done = true; b.classList.add('on'); sfx.lock(); if (!ASK.tries) progress.hit(ASK.id); } else { ASK.tries++; progress.miss(ASK.id, ASK.q, o.v); b.classList.remove('no'); void b.offsetWidth; b.classList.add('no'); sfx.wrong(); caption(ASK.why(o.v), null, 'bad'); } };
    box.appendChild(b); });
}
/** A question with options: resolves once the right one is clicked; a wrong one shakes and explains.
    id (optional) names the question for the learner's saved progress (engine/teach.js). */
export function ask(q, opts, answer, why, id = null) {
  if (E.INSTANT) return Promise.resolve(answer);
  ASK = { q, opts, answer, why, id, tries: 0, done: false }; S.beat = 'ask'; renderAsk(); $('#ask').hidden = false;
  if (AUTO) { const tok = E.RUN; setTimeout(() => { if (tok !== E.RUN || !ASK) return; if (!ASK.shown && teacher.on) { ASK.shown = true; renderAsk(); } $('#ask-opts').querySelector(`[data-v="${answer}"]`)?.click(); }, 1200); }
  return loopUntil(() => ASK.done).then(() => wait(.7)).then(() => { $('#ask').hidden = true; ASK = null; return answer; });
}
/** A prediction: the same panel, but every option is accepted; resolves to the one chosen. The scene then shows
    what really happens, and the game's caption confirms or corrects the guess. */
export function predict(q, opts) {
  if (E.INSTANT) return Promise.resolve(opts[0].v);
  ASK = { q, opts, answer: null, any: true, tries: 0, done: false }; S.beat = 'predict'; renderAsk(); $('#ask').hidden = false;
  if (AUTO) { const tok = E.RUN; setTimeout(() => { if (tok !== E.RUN || !ASK) return; if (!ASK.shown && teacher.on) { ASK.shown = true; renderAsk(); } $('#ask-opts .opt')?.click(); }, 1200); }
  return loopUntil(() => ASK.done).then(() => { const v = ASK.answer; return wait(.5).then(() => { $('#ask').hidden = true; ASK = null; return v; }); });
}
/** A typed answer in the dock (#answer, on pages that have it): engine/teach.js answer({ id, q, expect, why, unit }). */
export const typed = o => { S.beat = 'answer'; return answerIn($('#answer'), o); };

/* ======================================================================
   Ideas: named steps inside a chapter (boot's chapters[i][2]). The menu lists them and a teacher steps
   between them; jumping to one replays everything before it instantly, as a chapter rewind does.
   Put idea(k) where the dock is clear (no card, board or question open); view() frames the camera on arrival.
   ====================================================================== */
const IDEA = { ch: 0, k: 0, stop: null, resume: null };
export async function idea(k, view) {
  IDEA.k = k; teacherIdea(); if (!E.INSTANT) { objective(null); caption(null); }   // a new idea starts clean: no stale task, no stale sentence
  if (E.INSTANT && IDEA.stop && IDEA.stop[0] === IDEA.ch && IDEA.stop[1] === k) { IDEA.stop = null; await IDEA.resume(view); }
}

/* ======================================================================
   The engineer's board: the book's items on squared paper (an SVG plan, x to the right as on the page)
   ====================================================================== */
export const BD = { win: null, curves: [], pts: [], tf: null, target: null, title: null, onDown: null, onMove: null, onUp: null, out: null };
const bdEl = $('#bd'), BW = 320, BH = 250, PAD = 18;
const bx = x => PAD + (x - BD.win.x0) / (BD.win.x1 - BD.win.x0) * (BW - 2 * PAD);
const by = y => BH - PAD - (y - BD.win.y0) / (BD.win.y1 - BD.win.y0) * (BH - 2 * PAD);
function niceStep(r) { const raw = r / 10, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
const AV = [-4, -3, -2, -1, -.5, -1 / 3, 1 / 3, .5, 1, 2, 3, 4];   // the widths the side handle snaps to
const nearestA = v => AV.reduce((b, a) => Math.abs(a - v) < Math.abs(b - v) ? a : b);
function curvePath(f) { const { x0, x1, y0, y1 } = BD.win; let d = '', pen = false; for (let i = 0; i <= 200; i++) { const x = lerp(x0, x1, i / 200), y = f(x); if (!isFinite(y) || y < y0 - (y1 - y0) || y > y1 + (y1 - y0)) { pen = false; continue; } d += (pen ? 'L' : 'M') + bx(x).toFixed(1) + ' ' + by(y).toFixed(1); pen = true; } return d; }
export function renderBoard() {
  if (!BD.win || $('#board').hidden) return;
  const { x0, x1, y0, y1 } = BD.win, sx = niceStep(x1 - x0), sy = niceStep(y1 - y0);
  let h = `<defs><clipPath id="bdc"><rect x="${PAD}" y="${PAD}" width="${BW - 2 * PAD}" height="${BH - 2 * PAD}"/></clipPath></defs>`;
  for (let x = Math.ceil(x0 / sx) * sx; x <= x1 + 1e-9; x += sx) h += `<line class="grid" x1="${bx(x)}" y1="${PAD}" x2="${bx(x)}" y2="${BH - PAD}"/>`;
  for (let y = Math.ceil(y0 / sy) * sy; y <= y1 + 1e-9; y += sy) h += `<line class="grid" x1="${PAD}" y1="${by(y)}" x2="${BW - PAD}" y2="${by(y)}"/>`;
  const ax = y0 <= 0 && y1 >= 0 ? by(0) : BH - PAD, ay = x0 <= 0 && x1 >= 0 ? bx(0) : PAD;
  h += `<line class="axis" x1="${PAD}" y1="${ax}" x2="${BW - PAD}" y2="${ax}"/><line class="axis" x1="${ay}" y1="${PAD}" x2="${ay}" y2="${BH - PAD}"/>`;
  for (let x = Math.ceil(x0 / sx) * sx; x <= x1 + 1e-9; x += sx) if (Math.abs(x) > 1e-9 && Math.round(x / sx) % 2 === 0) h += `<text x="${bx(x)}" y="${ax + 11}" text-anchor="middle">${n(x)}</text>`;
  for (let y = Math.ceil(y0 / sy) * sy; y <= y1 + 1e-9; y += sy) if (Math.abs(y) > 1e-9 && Math.round(y / sy) % 2 === 0) h += `<text x="${ay - 4}" y="${by(y) + 3}" text-anchor="end">${n(y)}</text>`;
  h += `<text x="${BW - PAD + 2}" y="${ax - 4}" text-anchor="end">${BD.vx || 'x'}</text><text x="${ay + 4}" y="${PAD + 8}">y</text><g clip-path="url(#bdc)">`;
  const tf = BD.tf;
  if (tf) {   // the transformation bench: the parent, the target, the current curve with its five moved points
    h += `<path d="${curvePath(x => x * x)}" fill="none" stroke="#98989d" stroke-width="1.3" stroke-dasharray="4 4"/>`;
    if (BD.target) { const [a, hh, k] = BD.target; h += `<path d="${curvePath(x => a * (x - hh) ** 2 + k)}" fill="none" stroke="#d9a441" stroke-width="2" stroke-dasharray="7 5" opacity=".9"/>`; }
    h += `<path d="${curvePath(x => tf.a * (x - tf.h) ** 2 + tf.k)}" fill="none" stroke="#9fd6df" stroke-width="2.4"/>`;
    PARENT.forEach(p => { const [u, v] = movePt(p, tf.a, tf.h, tf.k); h += `<line x1="${bx(p[0])}" y1="${by(p[1])}" x2="${bx(u)}" y2="${by(v)}" stroke="rgba(159,214,223,.35)" stroke-width="1"/><circle cx="${bx(p[0])}" cy="${by(p[1])}" r="3" fill="none" stroke="#98989d"/><circle cx="${bx(u)}" cy="${by(v)}" r="3.6" fill="#9fd6df"/>`; });
    h += `<rect class="hdl" x="${bx(tf.h + 1) - 6}" y="${by(tf.k + tf.a) - 6}" width="12" height="12" rx="2" fill="none" stroke="#f5f5f7" stroke-width="1.6"/><circle class="hdl" cx="${bx(tf.h)}" cy="${by(tf.k)}" r="7" fill="#e8b45a" stroke="#fff" stroke-width="1.5"/>`;
  }
  BD.curves.forEach(c => { h += `<path d="${curvePath(c.f)}" fill="none" stroke="${c.color}" stroke-width="${c.w || 2.2}"${c.dash ? ' stroke-dasharray="6 5"' : ''}/>`; if (c.label) h += `<text x="${bx(c.lx)}" y="${by(c.ly)}" style="fill:${c.color};font-size:12px" text-anchor="middle">${c.label}</text>`; });
  BD.pts.forEach(p => { h += `<circle cx="${bx(p.x)}" cy="${by(p.y)}" r="5" fill="${p.color || '#e8b45a'}" stroke="#000" stroke-width=".8"/>`; if (p.label) h += `<text x="${bx(p.x) + 7}" y="${by(p.y) - 7}" style="fill:#f5f5f7">${p.label}</text>`; });
  if (BD.miss) h += `<circle cx="${bx(BD.miss.x)}" cy="${by(BD.miss.y)}" r="5" fill="none" stroke="#e0634f" stroke-width="1.6"/>`;
  bdEl.innerHTML = h + '</g>';
  $('#bd-f').innerHTML = BD.title ? mathify(ltr(T(BD.title))) : '';
  $('#bd-out').innerHTML = BD.out ? mathify(T(typeof BD.out === 'function' ? BD.out() : BD.out)) : '';
}
export function showBoard(o) { Object.assign(BD, { curves: [], pts: [], tf: null, target: null, miss: null, out: null, vx: null, title: null }, o); $('#board').hidden = E.INSTANT; $('#bd-ctl').hidden = !BD.tf; renderBoard(); }
export function hideBoard() { $('#board').hidden = true; BD.onDown = BD.onMove = BD.onUp = null; BD.win = null; }
function bdPoint(e) { const p = bdEl.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(bdEl.getScreenCTM().inverse()), { x0, x1, y0, y1 } = BD.win; return { x: x0 + (q.x - PAD) / (BW - 2 * PAD) * (x1 - x0), y: y0 + (BH - PAD - q.y) / (BH - 2 * PAD) * (y1 - y0) }; }
bdEl.addEventListener('pointerdown', e => { if (E.PAUSED || !BD.win || !BD.onDown) return; bdEl.setPointerCapture(e.pointerId); BD.onDown(bdPoint(e)); });
bdEl.addEventListener('pointermove', e => { if (!E.PAUSED && BD.win && BD.onMove) BD.onMove(bdPoint(e)); });
bdEl.addEventListener('pointerup', e => { if (!E.PAUSED && BD.win && BD.onUp) BD.onUp(bdPoint(e)); });
/** Click points on the board: each target locks when a click lands near it (ordered: one at a time). */
export function boardPick(list, { ordered = false, wrong, onLock } = {}) {
  const got = new Set(), tx = () => (BD.win.x1 - BD.win.x0) / 16, ty = () => (BD.win.y1 - BD.win.y0) / 16;
  const lock = i => { got.add(i); const t = list[i]; BD.pts.push({ x: t.x, y: t.y, color: t.color, label: t.label ?? pt(t.x, t.y) }); BD.miss = null; sfx.lock(); onLock?.(i, got.size); renderBoard(); };
  if (E.INSTANT) { list.forEach((t, i) => lock(i)); return Promise.resolve(); }
  S.beat = 'board';
  if (AUTO) { const tok = E.RUN; (async () => { for (let i = 0; i < list.length; i++) { await new Promise(r => setTimeout(r, 900)); if (tok !== E.RUN) return; if (!got.has(i)) lock(i); } })(); }
  BD.onDown = p => {
    const next = list.findIndex((t, i) => !got.has(i)), i = list.findIndex((t, j) => !got.has(j) && (!ordered || j === next) && Math.abs(p.x - t.x) < tx() && Math.abs(p.y - t.y) < ty());
    if (i >= 0) { lock(i); return; }
    sfx.wrong(); BD.miss = p; renderBoard(); caption(wrong(p, next));
  };
  return loopUntil(() => got.size === list.length).then(() => { BD.onDown = null; });
}
/** The transformation bench: move the vertex (h, k) and the side handle (a) until the curve lies on the target. */
export function boardMatch([ta, th, tk], { show = true } = {}) {
  BD.tf = { a: 1, h: 0, k: 0 }; BD.target = show ? [ta, th, tk] : null; $('#bd-ctl').hidden = E.INSTANT;
  const ok = () => near(BD.tf.a, ta) && BD.tf.h === th && BD.tf.k === tk;
  const setTf = (a, h, k) => { if (a === BD.tf.a && h === BD.tf.h && k === BD.tf.k) return; BD.tf = { a, h, k }; S.tf = [a, h, k]; sfx.tick(); renderBoard(); };
  if (E.INSTANT) { BD.tf = { a: ta, h: th, k: tk }; S.tf = [ta, th, tk]; return Promise.resolve(); }
  S.beat = 'match'; S.tf = [1, 0, 0]; BD.out = () => ltr('y = ' + vform(BD.tf.a, BD.tf.h, BD.tf.k)); renderBoard();
  let drag = null;
  const apply = p => { const { a, h, k } = BD.tf; if (drag === 'a') setTf(nearestA(p.y - k) || a, h, k); else setTf(a, clamp(Math.round(p.x), Math.ceil(BD.win.x0), Math.floor(BD.win.x1)), clamp(Math.round(p.y), Math.ceil(BD.win.y0), Math.floor(BD.win.y1))); };
  BD.onDown = p => { drag = Math.abs(p.x - (BD.tf.h + 1)) < .5 && Math.abs(p.x - BD.tf.h) > .5 ? 'a' : 'v'; apply(p); };
  BD.onMove = p => { if (drag) apply(p); };
  BD.onUp = () => { drag = null; };
  $('#bd-flip').onclick = () => setTf(-BD.tf.a, BD.tf.h, BD.tf.k);
  if (AUTO) { const tok = E.RUN; setTimeout(() => { if (tok === E.RUN) setTf(ta, th, tk); }, 1300); }
  return loopUntil(ok).then(() => { BD.onDown = BD.onMove = BD.onUp = null; sfx.lock(); $('#bd-ctl').hidden = true; });
}
/** The five-step graph on the board: click the vertex, the y-intercept, then the point at x = extra; the two are reflected. */
export async function fiveStep(q, extra) {
  const pts = [{ x: q.h, y: q.k, label: pt(q.h, q.k) }, { x: 0, y: q.c }, { x: extra, y: q.f(extra) }];
  await boardPick(pts, { ordered: true, wrong: (p, i) => [tr(`ابدأ بالرأس: ${ltr('x = −b/2a = ' + n(q.h))}.`, `Start with the vertex: ${ltr('x = −b/2a = ' + n(q.h))}.`), tr(`الآن المقطع y: ${ltr('x = 0')}.`, `Now the y-intercept: ${ltr('x = 0')}.`), tr(`الآن النقطة عند ${ltr('x = ' + n(extra))}: ${ltr('f(' + n(extra) + ')')}.`, `Now the point at ${ltr('x = ' + n(extra))}: ${ltr('f(' + n(extra) + ')')}.`)][i] });
  for (const p of pts.slice(1)) BD.pts.push({ x: mirror(q, p.x), y: p.y, color: '#b9a4e6', label: pt(mirror(q, p.x), p.y) });
  BD.curves.push({ f: q.f, color: '#9fd6df' }); renderBoard(); if (!E.INSTANT) await wait(1.2);
}
/** Click where a curve on the board meets the x-axis. */
export const boardRoots = (q, color = '#9fd08a') => boardPick(q.roots.map(x => ({ x, y: 0, color, label: 'x = ' + n(x) })), { wrong: p => tr(`هنا ${ltr('y = ' + n(q.f(Math.round(p.x))))}. الجذر حيث ${ltr('y = 0')}.`, `Here ${ltr('y = ' + n(q.f(Math.round(p.x))))}. A root is where ${ltr('y = 0')}.`) });

/* ======================================================================
   The player's hands. Each beat installs one input handler and resolves when its maths is done.
   Every drag also works as a click; ?auto plays each beat by itself (the tests depend on it).
   ====================================================================== */
export function homeTB() { TB.place(0, 0); TB.cock(1); loadStone(); }
export function loadStone() { stone.visible = true; stone.userData.halo.visible = true; stone.position.copy(TB.pouch()); }
/* ---------- fire: click the trebuchet (or the chip) ---------- */
export function fireBeat() {
  if (E.INSTANT) return Promise.resolve();
  S.beat = 'fire'; let go = false;
  chip('fire', tr('أطلِق', 'Fire'), () => TB.release().add(V(-6.5, 3.4, 0)), { click: () => { go = true; } });
  autoRun(() => { go = true; });
  return awaitInput({ down(e) { if (pick(e, TB.hitbox)) go = true; }, move(e) { setCursor(pick(e, TB.hitbox) ? 'pointer' : 'default'); } }, () => go).then(() => { clearChip('fire'); });
}
/* ---------- where a flight really ends: the wall, the siege tower, or the ground ---------- */
function impact(q, s) {
  for (let x = s + .3; x < 220; x += .02) {
    const y = q.f(x);
    const W = K.wall, outer = K.side === 'saladin' ? x < W.x0 + 1 : x > W.x1 - 1;   // the merlons stand on the moat side
    if (x > W.x0 && x < W.x1 && y < (outer ? W.top + 1.6 : W.top)) return { x, y, what: 'wall' };
    if (tower.visible && x > tower.position.x - 2.35 && x < tower.position.x + 2.1 && y < tower.userData.top && y > 0) return { x, y, what: 'tower' };
    const g = K.ground(x, 0) + .35; if (y <= g) return { x, y: g, what: mantlet.visible && Math.abs(x - mantlet.position.x) < 1.6 && !mantlet.userData.down ? 'mantlet' : 'ground' };
  }
  return { x: 220, y: 0, what: 'ground' };
}
/* ---------- throw: the swing, the flight (horizontal speed constant), the landing ---------- */
export async function throwStone(q) {
  const s = TB.s, I = impact(q, s);
  const land = () => { spent.visible = true; spent.position.set(I.x, I.y, 0); S.landed = I.x; S.hit = I.what;
    if (I.what === 'mantlet') { mantlet.userData.down = true; bg(tween(.9, t => { mantlet.rotation.z = -1.42 * t; }, ease.in)); }
    if (I.what === 'tower') bg(tween(1.4, t => { tower.rotation.z = Math.sin(t * Math.PI * 4) * .03 * (1 - t); })); };
  if (E.INSTANT) { trail.set(q.f, s, I.x); trail.progress(1); land(); TB.cock(1); loadStone(); if (I.what === 'mantlet') mantlet.rotation.z = -1.42; return I; }
  S.beat = 'throw'; clearChips(); spent.visible = false; loadStone(); trail.set(q.f, s, I.x); trail.progress(0);
  sfx.launch();
  await tween(1.05, u => { stone.position.copy(TB.swing(u)); stone.rotation.z += .05; }, ease.lin);
  const dur = Math.max(.6, (I.x - s) / 24);
  bg(tween(1.8, v => TB.settle(v), ease.lin));
  await tween(dur, t => { const x = lerp(s, I.x, t); stone.position.set(x, q.f(x), 0); stone.rotation.z -= .12; trail.progress(t); }, ease.lin);
  stone.visible = false; K.dust(V(I.x, I.y, 0), I.what === 'ground' ? 1 : .7); land();
  if (I.what === 'mantlet' || I.what === 'tower') sfx.crash(); else sfx.land();
  const tok = E.RUN; bg(wait(1.6).then(() => tween(2.2, w => { if (tok === E.RUN) TB.cock(w); })).then(() => { if (tok === E.RUN) loadStone(); }));
  await wait(.8);
  return I;
}
/* ---------- plot a point: drag a marker up its vertical line to a height ---------- */
export function plotBeat(key, x, yT, { color = COL.pt, why, onMove } = {}) {
  let y = 0, drag = false, lock = false;
  const put = v => { y = v; point(key, x, y, color, ltr(n(y))); onMove?.(y); };   // onMove(y): the game draws what follows the point (its twin's link)
  const snapY = v => { let s = Math.round(clamp(v, 0, 44) * 2) / 2; if (Math.abs(s - yT) < 1.01) s = yT; return s; };
  const fin = () => { put(yT); guideB.visible = false; S.cells.add(x); if (CARD?.table) redrawCard(); };
  if (E.INSTANT) { fin(); return Promise.resolve(); }
  S.beat = 'plot'; S.plotX = x; put(0); setBeam(guideB, V(x, 0, 0), V(x, 44, 0), 1);
  chip('plot', tr('اسحب للأعلى', 'Drag up'), () => V(x, y + 3.4, 0), { passive: true });
  autoRun(() => tween(1.2, t => put(snapY(lerp(0, yT, t)))).then(() => { put(yT); lock = true; }));
  const check = () => { if (y === yT) lock = true; else { sfx.wrong(); caption(why ? why(y) : tr(`الجدول يقول ${ltr(n(yT))} عند ${ltr(x)} م، لا ${ltr(n(y))}.`, `The table says ${ltr(n(yT))} at ${ltr(x + ' m')}, not ${ltr(n(y))}.`), null, 'bad'); } };
  return awaitInput({
    down(e) { const p = planeHit(e); if (!p || Math.abs(p.x - x) > 3.2) return; clearChip('plot'); if (Math.abs(p.y - y) < 3.2) { drag = true; setCursor('grabbing'); } else { put(snapY(p.y)); sfx.tick(); check(); } },
    move(e) { const p = planeHit(e); if (!p) return; if (drag) { const v = snapY(p.y); if (v !== y) { put(v); sfx.tick(); } return; } setCursor(Math.abs(p.x - x) < 3.2 ? (Math.abs(p.y - y) < 3.2 ? 'grab' : 'pointer') : 'default'); },
    up() { if (!drag) return; drag = false; setCursor('default'); check(); },
  }, () => lock).then(() => { clearChip('plot'); sfx.lock(); fin(); });
}
/* ---------- hang the plumb line on the axis of symmetry ---------- */
export function plumbBeat(xT, x0, why) {
  let x = x0, drag = false, lock = false;
  const snapX = v => { let s = Math.round(clamp(v, -15, 90)); if (Math.abs(s - xT) < 1.6) s = xT; return s; };
  if (E.INSTANT) { setPlumb(xT); return Promise.resolve(); }
  S.beat = 'plumb'; setPlumb(x);
  chip('plumb', tr('اسحب الشاقول', 'Drag the plumb line'), () => V(x, 5, 0), { passive: true });
  autoRun(() => tween(1.3, t => setPlumb(x = snapX(lerp(x0, xT, t)))).then(() => { setPlumb(x = xT); lock = true; }));
  const check = () => { if (x === xT) lock = true; else { sfx.wrong(); caption(why(x), null, 'bad'); } };
  return awaitInput({
    down(e) { const p = planeHit(e); if (!p) return; clearChip('plumb'); if (Math.abs(p.x - x) < 3.5) { drag = true; setCursor('grabbing'); } else { setPlumb(x = snapX(p.x)); sfx.tick(); check(); } },
    move(e) { const p = planeHit(e); if (!p) return; if (drag) { const v = snapX(p.x); if (v !== x) { setPlumb(x = v); sfx.tick(); } return; } setCursor(Math.abs(p.x - x) < 3.5 ? 'grab' : 'pointer'); },
    up() { if (!drag) return; drag = false; setCursor('default'); check(); },
  }, () => lock).then(() => { clearChip('plumb'); sfx.lock(); setPlumb(xT); });
}
/* ---------- reflect points across the axis: click each point (or its chip) ---------- */
export function reflectBeat(keys, q) {
  const done = new Set();
  const fly = (k, instant) => {
    const d = dots[k], x0 = d.position.x, y = d.position.y, x1 = mirror(q, x0), km = k + 'm'; done.add(k); clearChip('rf' + k);
    const put = x => { point(km, x, y, COL.mir, ltr(pt(x, y))); };
    const i = keys.indexOf(k);
    if (instant) { put(x1); setBeam(reflB[i], V(x0, y, 0), V(x1, y, 0), 1); return; }
    sfx.ui(); bg(tween(.9, t => { put(lerp(x0, x1, t)); setBeam(reflB[i], V(x0, y, 0), V(lerp(x0, x1, t), y, 0), 1); }).then(() => { put(x1); sfx.lock(); }));
  };
  if (E.INSTANT) { keys.forEach(k => fly(k, true)); return Promise.resolve(); }
  S.beat = 'reflect';
  keys.forEach(k => chip('rf' + k, tr('اعكس', 'Reflect'), () => dots[k].position.clone().add(V(0, 3, 0)), { click: () => { if (!done.has(k)) fly(k); } }));
  autoRun(async () => { for (const k of keys) { if (!done.has(k)) fly(k); await wait(.7); } });
  return awaitInput({
    down(e) { const p = planeHit(e); if (!p) return; const k = keys.find(k => !done.has(k) && dots[k].position.distanceTo(p) < 3); if (k) fly(k); },
    move(e) { const p = planeHit(e); setCursor(p && keys.some(k => !done.has(k) && dots[k].position.distanceTo(p) < 3) ? 'pointer' : 'default'); },
  }, () => done.size === keys.length).then(() => wait(1.1));
}
/* ---------- roll the trebuchet on its log rollers (and raise it on the crib): the flight is translated ---------- */
export function trebPreview() {
  const q = shift(T0, TB.s, TB.lift), xl = landing(q);
  ghost.set(q.f, TB.s, xl); dot('gv', q.h, q.k, COL.vx); AN.Lgv = V(q.h, q.k + .2, 0); setLabel('Lgv', ltr(pt(q.h, q.k)), 1);
  ring('gl', xl, COL.gh); AN.Lgl = V(xl, 0, 0); setLabel('Lgl', ltr('x = ' + n(xl)), 1);
  AN.tb = V(TB.s - 5, RELEASE_Y + TB.lift + 6, 0); setLabel('tb', ltr('h(x) = ' + vform(q.a, q.h, q.k)), 1);
  return q;
}
export function noPreview() { ghost.hide(); noDot('gv'); noRing('gl'); ['Lgv', 'Lgl', 'tb'].forEach(id => setLabel(id, null, 0)); }
const S_MIN = -20, S_MAX = 10, L_MAX = 10;
export function rollBeat(sT, msg) {
  let drag = false, lock = false, off = 0;
  const put = v => { TB.place(v, TB.lift); loadStone(); trebPreview(); };
  const snapS = v => Math.round(clamp(v, S_MIN, S_MAX));
  const onTB = p => p.x > TB.s - 12.5 && p.x < TB.s + 2.5 && p.y < RELEASE_Y + TB.lift + 3 && p.y > TB.lift - 1;
  if (E.INSTANT) { put(sT); return Promise.resolve(); }
  S.beat = 'roll'; trebPreview();
  chip('roll', tr('اسحب المنجنيق', 'Drag the trebuchet'), () => V(TB.s - 5, TB.lift + 11, 0), { passive: true });
  autoRun(() => { const f = TB.s; return tween(1.6, t => { const v = Math.round(lerp(f, sT, t)); if (v !== TB.s) put(v); }).then(() => { put(sT); lock = true; }); });
  const check = () => { if (TB.s === sT) lock = true; else { sfx.wrong(); caption(msg(TB.s)); } };
  return awaitInput({
    down(e) { const p = planeHit(e); if (!p) return; clearChip('roll'); if (onTB(p)) { drag = true; off = p.x - TB.s; setCursor('grabbing'); sfx.creak(); } else if (p.y < TB.lift + 4 && p.x < K.wall.x0 - 8) { put(snapS(p.x)); sfx.creak(); check(); } },
    move(e) { const p = planeHit(e); if (!p) return; if (drag) { const v = snapS(p.x - off); if (v !== TB.s) { put(v); sfx.tick(); } return; } setCursor(onTB(p) ? 'grab' : 'default'); },
    up() { if (!drag) return; drag = false; setCursor('default'); check(); },
  }, () => lock).then(() => { clearChip('roll'); sfx.lock(); });
}
export function liftBeat(LT, msg) {
  let drag = false, lock = false, y0 = 0, L0 = 0;
  const put = v => { TB.place(TB.s, v); loadStone(); trebPreview(); };
  const snapL = v => Math.round(clamp(v, 0, L_MAX));
  const onTB = p => p.x > TB.s - 12.5 && p.x < TB.s + 2.5 && p.y < RELEASE_Y + TB.lift + 3 && p.y > -1;
  if (E.INSTANT) { put(LT); return Promise.resolve(); }
  S.beat = 'lift'; trebPreview();
  chip('lift', tr('اسحبه للأعلى', 'Drag it up'), () => V(TB.s - 5, TB.lift + 11, 0), { passive: true });
  autoRun(() => { const f = TB.lift; return tween(1.4, t => { const v = Math.round(lerp(f, LT, t)); if (v !== TB.lift) put(v); }).then(() => { put(LT); lock = true; }); });
  const check = () => { if (TB.lift === LT) lock = true; else { sfx.wrong(); caption(msg(TB.lift)); } };
  return awaitInput({
    down(e) { const p = planeHit(e); if (!p) return; clearChip('lift'); if (onTB(p)) { drag = true; y0 = p.y; L0 = TB.lift; setCursor('grabbing'); sfx.creak(); } else if (Math.abs(p.x - TB.s) < 9 && p.y > RELEASE_Y) { put(snapL(p.y - RELEASE_Y)); sfx.creak(); check(); } },
    move(e) { const p = planeHit(e); if (!p) return; if (drag) { const v = snapL(L0 + p.y - y0); if (v !== TB.lift) { put(v); sfx.tick(); } return; } setCursor(onTB(p) ? 'ns-resize' : 'default'); },
    up() { if (!drag) return; drag = false; setCursor('default'); check(); },
  }, () => lock).then(() => { clearChip('lift'); sfx.lock(); });
}
/** Glide the trebuchet from where it stands to (s, lift). */
export const glideTB = (s, L) => { const s0 = TB.s, L0 = TB.lift; return tween(1.2, t => { TB.place(Math.round(lerp(s0, s, t)), Math.round(lerp(L0, L, t))); loadStone(); }); };
/* ---------- click the points where the curve meets the ground (y = 0) ---------- */
export function rootsBeat(q) {
  const xs = q.roots, got = new Set();
  const lock = i => { got.add(i); S.roots = [...got].map(j => xs[j]); ring('r' + i, xs[i], COL.rt); dot('rt' + i, xs[i], 0, COL.rt); AN['Lr' + i] = V(xs[i], 0, 0); setLabel('Lr' + i, ltr('x = ' + n(xs[i])), 1); sfx.lock(); objProgress(`${got.size}/${xs.length}`, got.size / xs.length); };
  if (E.INSTANT) { xs.forEach((x, i) => lock(i)); return Promise.resolve(); }
  S.beat = 'roots';
  autoRun(async () => { for (let i = xs.length - 1; i >= 0; i--) { lock(i); await wait(.6); } });
  return awaitInput({
    down(e) { const p = planeHit(e); if (!p) return; const i = xs.findIndex((x, j) => !got.has(j) && Math.abs(p.x - x) < 3 && Math.abs(p.y) < 5); if (i >= 0) { lock(i); return; }
      if (Math.abs(p.y) < 9) { const x = Math.round(p.x); sfx.wrong(); caption(tr(`عند ${ltr('x = ' + n(x))} ارتفاع المنحنى ${ltr(n(q.f(x)))}، لا صفر.`, `At ${ltr('x = ' + n(x))} the curve is ${ltr(n(q.f(x)))} high, not zero.`)); } },
    move(e) { const p = planeHit(e); setCursor(p && Math.abs(p.y) < 9 ? 'crosshair' : 'default'); },
  }, () => got.size === xs.length);
}
/* ---------- the height line: drag it and count its crossings with the flight (2, 1, 0) ---------- */
export function levelBeat(q, auto) {
  const seen = new Set(); let k = 8, drag = false;
  const put = v => {
    k = v; S.level = k; setBeam(levelB, V(-17, k, 0), V(96, k, 0), 1); knob.visible = true; knob.position.set(-17, k, 0);
    const xs = level(q, k); S.nsol = xs.length;
    sunk.set(x => q.f(x) - k, -16, 76);
    [0, 1].forEach(i => { if (xs[i] !== undefined) { dot('c' + i, xs[i], k, COL.lv); ring('s' + i, xs[i], COL.lv); AN['Lc' + i] = V(xs[i], k, 0); setLabel('Lc' + i, ltr('x = ' + n(xs[i])), 1); } else { noDot('c' + i); noRing('s' + i); setLabel('Lc' + i, null, 0); } });
    AN.lv = V(-17, k + 1.6, 0); setLabel('lv', tr(`${ltr('h(x) = ' + n(k))}: ${['لا حل', 'حلّ واحد', 'حلّان'][xs.length]}`, `${ltr('h(x) = ' + n(k))}: ${['no solution', 'one solution', 'two solutions'][xs.length]}`), 1);
  };
  const snapK = v => { let s = Math.round(clamp(v, 1, 44)); if (Math.abs(v - q.k) < .8) s = q.k; return s; };
  const visit = () => { S.cases = [...seen]; if (!seen.has(S.nsol)) { seen.add(S.nsol); S.cases = [...seen]; sfx.lock(); objProgress(`${seen.size}/3`, seen.size / 3); } };
  if (E.INSTANT) { [2, 1, 0].forEach(c => seen.add(c)); S.cases = [2, 1, 0]; put(auto[0]); return Promise.resolve(); }
  S.beat = 'level'; put(k);
  chip('level', tr('اسحب الخط', 'Drag the line'), () => V(-17, k + 4.5, 0), { passive: true });
  autoRun(async () => { for (const v of auto) { const f = k; await tween(1.1, t => { const w = Math.round(lerp(f, v, t)); if (w !== k) put(w); }); put(v); visit(); await wait(.7); } });
  return awaitInput({
    down(e) { const p = planeHit(e); if (!p) return; clearChip('level'); if (Math.abs(p.y - k) < 2.6) { drag = true; setCursor('grabbing'); } else if (p.y > 0) { put(snapK(p.y)); sfx.tick(); visit(); } },
    move(e) { const p = planeHit(e); if (!p) return; if (drag) { const v = snapK(p.y); if (v !== k) { put(v); sfx.tick(); } return; } setCursor(Math.abs(p.y - k) < 2.6 ? 'ns-resize' : 'default'); },
    up() { if (!drag) return; drag = false; setCursor('default'); visit(); },
  }, () => seen.size >= 3 && !drag);
}
export const noLevel = () => { levelB.visible = false; knob.visible = false; sunk.hide(); noDot('c0', 'c1'); noRing('s0', 's1'); ['Lc0', 'Lc1', 'lv'].forEach(id => setLabel(id, null, 0)); };

/* ======================================================================
   The codex's formula lines
   ====================================================================== */
let FORMULAS = [], formulaN = 0;
export function setFormula(k) { formulaN = k; if (E.INSTANT && !k) return; texInto($('#formula'), FORMULAS.slice(0, k).join('<br>')); $('#formula').classList.toggle('locked', !k); }

/* ======================================================================
   Camera
   ====================================================================== */
export const cam = camRig(camera, V(-80, 110, 230), V(10, 0, 0));
export const VIEW = {
  board: { pos: V(18, 22, 70), look: V(48, 14, 0) },   // the throw to the right of the board
  high: { pos: V(34, 30, 96), look: V(34, 18, 0) },
};
/** The throw seen as a graph: the camera backs off until x0…x1 (and the heights 0…45) fit this screen's shape. */
function frameX(x0 = -24, x1 = 92) {
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), cx = (x0 + x1) / 2;
  // v2: straight at the paper (no tilt), far enough to fit the heights −4…46 too, so the grid is square on screen
  if (V2) { const D = Math.max((x1 - x0) / 2 / (t * camera.aspect), 27 / t, 60); return { pos: V(cx, 21, D), look: V(cx, 21, 0) }; }
  const D = Math.max((x1 - x0) / 2 / (t * camera.aspect), 66); return { pos: V(cx, 15 + D * .13, D), look: V(cx, 15, 0) }; }
export const shotV = (v, time = 2) => cam.shot(v.pos, v.look, { time });
export const shotP = (time = 2, x0, x1) => shotV(frameX(x0, x1), time);
export { shot };

/* ======================================================================
   THE SIEGE WORKSHOP (sandbox): the game's book items in order, then free throwing
   ====================================================================== */
let MISSIONS = [], mi = 0, ROWS = () => [];
function renderWork() {
  $('#work').innerHTML = MISSIONS.map((m, i) => `<div style="display:flex;justify-content:space-between;gap:8px;${i === mi && S.mode === 'play' ? 'color:var(--text)' : 'color:var(--ash)'}"><span>${i + 1}. ${mathify(T(m.log))}</span><span class="m">${S.jobs.includes(m.id) ? m.res : ''}</span></div>`).join('');
}
function logJob(m) { if (E.INSTANT) return; const li = document.createElement('li'); li.className = 'new'; li.__m = m; $('#log').appendChild(li); renderLog(); }
function renderLog() { $('#log').querySelectorAll('li').forEach(li => { li.innerHTML = `<span>${mathify(T(li.__m.log))}</span><span class="num">${li.__m.res}</span>`; typeset(li); }); }
// free throwing: drag the trebuchet, set the crib, fire; the panel reads the throw live
function renderLive() {
  const q = shift(T0, TB.s, TB.lift);
  $('#live').innerHTML = ROWS(q).map(([k, v]) => `<div><span class="k">${T(k)}:</span> <span class="m">${v}</span></div>`).join('');
  $('#out-lift').textContent = TB.lift + ' m'; $('#in-lift').value = TB.lift;
  typeset($('#live'));
}
let freeBusy = false;
function freePlay() {
  $('#free').hidden = false; renderLive(); trebPreview();
  let drag = false, off = 0;
  const onTB = p => p.x > TB.s - 12.5 && p.x < TB.s + 2.5 && p.y < RELEASE_Y + TB.lift + 3 && p.y > -1;
  setInput({
    down(e) { if (freeBusy) return; const p = planeHit(e); if (p && onTB(p)) { drag = true; off = p.x - TB.s; setCursor('grabbing'); sfx.creak(); } },
    move(e) { const p = planeHit(e); if (!p) return; if (drag) { const v = Math.round(clamp(p.x - off, S_MIN, S_MAX)); if (v !== TB.s) { TB.place(v, TB.lift); loadStone(); trebPreview(); renderLive(); sfx.tick(); } return; } setCursor(onTB(p) ? 'grab' : 'default'); },
    up() { if (drag) { drag = false; setCursor('default'); } },
  });
}
$('#in-lift').addEventListener('input', () => { if (S.mode !== 'play' || freeBusy || $('#free').hidden) return; TB.place(TB.s, +$('#in-lift').value); loadStone(); trebPreview(); renderLive(); sfx.tick(); });
$('#btn-fire').onclick = async () => {
  if (freeBusy || S.mode !== 'play' || $('#free').hidden) return; freeBusy = true; $('#btn-fire').disabled = true;
  const q = shift(T0, TB.s, TB.lift);
  try { ghost.hide(); await throwStone(q); caption(S.hit === 'wall' ? tr('اصطدم الحجر بالسور: قرّب المنجنيق أو ارفعه.', 'The stone hit the wall: move the trebuchet forward or raise it.') : tr(`سقط عند ${ltr(n(S.landed))} م، والجذر ${ltr(n(landing(q)))}.`, `It landed at ${ltr(n(S.landed) + ' m')}; the root is ${ltr(n(landing(q)))}.`)); await wait(3.6); }
  catch (e) { if (e !== ABORT) throw e; } finally { freeBusy = false; $('#btn-fire').disabled = false; if (S.mode === 'play') trebPreview(); }
};
/** The last chapter: the missions in order, then free throwing. */
export function workshop({ missions, intro }) {
  MISSIONS = missions;
  return async function chWorkshop() {
    freshPlane(); $('#free').hidden = true;
    S.mode = 'play'; $('#props').hidden = false; mi = 0; renderWork();
    Score.set({ pad: .9, pedal: .5, arp: .2, high: .25 });
    await shotP(2);
    caption(intro); await wait(2.8);
    for (mi = 0; mi < MISSIONS.length; mi++) {
      const m = MISSIONS[mi]; S.beat = ''; renderWork(); objective(m.obj, `${mi + 1}/${MISSIONS.length}`, mi / MISSIONS.length);
      if (m.pre) { m.pre(); await shotV(VIEW.board, 1.6); }
      if (m.run) await m.run(); else await ask(m.q, m.opts, m.answer, m.why, m.id);
      objDone(); S.jobs.push(m.id); logJob(m); renderWork(); caption(m.done, m.note || null); await wait(4.2);
      if (m.after) await m.after();
    }
    hideBoard(); mi = MISSIONS.length; renderWork();
    objective(tr('أنهيت مسائل الورشة. ارمِ بحرية، أو انتقل إلى الدرس التالي.', 'The workshop’s problems are done. Throw freely, or go on to the next lesson.'), `${MISSIONS.length}/${MISSIONS.length}`, 1); objDone();
    $('#btn-next').classList.add('go'); Score.swell(8);
    toast(tr('اسحب المنجنيق وارفعه على القاعدة، ثم أطلِق. السجلّ في <b>الخلاصة</b>.', 'Drag the trebuchet, raise it on the crib, then fire. Your log is in the <b>notebook</b>.'));
    await shotP(2, -36, 96);
    if (!E.INSTANT) freePlay();
    await loopUntil(() => false);
  };
}

/* ======================================================================
   Boot: chapters, rewind, HUD, the loop, the cover still
   ====================================================================== */
export function boot({ chapters, audioKey, formulas = [], next, codex, rows, reset, cover, cleanup, slug = null, teach = false, music = true }) {
  // music: false drops everything in the background (the tracks, the milestone phrases, the wind bed) and the menu's music
  // switch; only the short effects stay (the throw, the impact, the clicks, right and wrong)
  configureAudio({ key: audioKey, chords: CHORDS, ambience: null, ...(music ? {} : { place: { bed: [], music: [], phrases: false } }) });
  if (!music) { const b = $('#tg-music'); if (b) b.style.display = 'none'; }
  // opt-in teaching kit (engine/teach.js): saved progress under slug, teacher mode when teach is set
  if (slug) configureTeach({ slug, sfx: { ok: sfx.lock, no: sfx.wrong, tick: sfx.ui } });
  FORMULAS = formulas; if (rows) ROWS = rows;
  $('#btn-next').onclick = () => { const u = new URL(next, location.href).href; try { window.top.location.href = u; } catch (e) { location.href = u; } };
  const renderCodex = () => { $('#codex .tab[data-tab="how"]').innerHTML = T(codex.how); $('#codex .tab[data-tab="why"]').innerHTML = T(codex.why); typeset($('#codex')); };
  renderCodex();
  let CUR = 0;
  const cleanupAll = () => { objective(null); caption(null); clearChips(); setInput(null); setCursor('default'); $('#note').hidden = true; $('#codex').hidden = true; closeMenu(); $('#eqcard').classList.remove('on', 'fly'); $('#ask').hidden = true; ASK = null; if ($('#answer')) $('#answer').hidden = true; cleanup?.(); };
  function resetWorld() {
    Object.assign(S, S0()); S.cells.clear();
    hideAll(); homeTB(); spent.visible = false; grid.userData.fade(0); ticks(0);
    mantlet.rotation.z = 0; mantlet.userData.down = false; tower.rotation.z = 0;
    showCard(null); hideBoard(); $('#card').hidden = true;
    resetCodexBase('?'); formulaN = 0; $('#log').innerHTML = ''; $('#props').hidden = true; $('#free').hidden = true;
    $('#btn-next').classList.remove('go'); mi = 0; freeBusy = false; $('#btn-fire').disabled = false;
    reset?.();
  }
  // arriving at an idea: the replay stops being instant; the dock shows what the replay left open
  IDEA.resume = async view => {
    E.INSTANT = false; cleanupAll(); if (formulaN) setFormula(formulaN); $('#veil').style.opacity = 0;
    if (CARD) renderCard(); if (BD.win) { $('#board').hidden = false; renderBoard(); }
    await (view ? view() : shotP(1.4));
  };
  async function startFrom(i, k = 0) {
    const tok = ++E.RUN; cleanupAll(); $('#veil').style.opacity = i === 0 && !k ? 1 : 0;
    try {
      resetWorld(); E.INSTANT = true; IDEA.stop = k ? [i, k] : null;
      for (let j = 0; j < i; j++) { IDEA.ch = j; IDEA.k = 0; await chapters[j][1](); }
      if (!k) { E.INSTANT = false; cleanupAll(); if (formulaN) setFormula(formulaN); }
      for (let j = i; j < chapters.length; j++) {
        if (tok !== E.RUN) return; CUR = j; IDEA.ch = j; IDEA.k = 0; renderChapters(); teacherIdea();
        await chapters[j][1]();
        if (E.INSTANT) { E.INSTANT = false; IDEA.stop = null; cleanupAll(); if (formulaN) setFormula(formulaN); }   // the idea asked for was never reached
        else if (tok === E.RUN) progress.finish(j);
      }
    } catch (e) { E.INSTANT = false; if (e !== ABORT) throw e; }
  }
  // every idea in order, as [chapter, k]; a chapter without named ideas is one idea
  const flatIdeas = () => chapters.flatMap((c, i) => (c[2] || [c[0]]).map((_, k) => [i, k]));
  const step = {
    go(d) { const L = flatIdeas(), at = L.findIndex(([i, k]) => i === CUR && k === IDEA.k), t = L[clamp(at + d, 0, L.length - 1)]; if (t && at + d >= 0 && at + d < L.length) startFrom(t[0], t[1]); },
    current() { const c = chapters[CUR]; return c[2] ? c[2][IDEA.k] : c[0]; },
  };
  if (teach) initTeacher(step);
  wireHud({ chapters, startFrom, getCur: () => CUR, ...(chapters.some(c => c[2]) ? { getIdea: () => IDEA.k } : {}), ...(slug ? { done: i => progress.isDone(i) } : {}) });
  onLang(() => { renderCodex(); renderAsk(); if (!E.INSTANT) renderCard(); renderBoard(); renderWork(); renderLog(); if (!$('#free').hidden) renderLive(); if (formulaN) setFormula(formulaN); if (grid.visible) ticks(1); });
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); bloom.setSize(innerWidth, innerHeight); gtao.setSize(innerWidth, innerHeight); });

  const clock = new THREE.Clock(), DT_MAX = FAST ? .3 : .05;
  let shotFrames = -1, shotT0 = 0;   // ?shot: once the still is laid out, draw a few frames, then stop the loop so the capture is instant
  function frame() {
    if (shotFrames >= 0 && ++shotFrames > 6 && E.now - shotT0 > 3) { window.__shotReady = true; return; }
    requestAnimationFrame(frame);
    const raw = Math.min(clock.getDelta(), DT_MAX), dt = E.PAUSED ? 0 : raw; E.now += dt; const t = E.now;
    if (!E.PAUSED) { tickTweens(); hooks.forEach(h => h(dt)); }
    cam.update(raw, t); K.update(dt, t, camera); thickLines();
    // the graph's markers read through the walls face-on; seen from the side they fade with the paper instead of floating
    const vk = grid.userData.view(camera);
    for (const m of [...Object.values(dots), ...Object.values(rings), ...LINES]) { if (!m.visible) continue; const u = m.material.userData; if (u.op0 === undefined) u.op0 = m.material.opacity; m.material.opacity = u.op0 * vk; }
    const ds = d => clamp(camera.position.distanceTo(d.position) / 90, .3, 1.3);
    for (const d of Object.values(dots)) if (d.visible) d.scale.setScalar(ds(d));
    for (const r of Object.values(rings)) if (r.visible) r.scale.setScalar(ds(r) * (1 + Math.sin(t * 4) * .06));
    if (bob.visible) { bob.scale.setScalar(ds(bob) * 1.2); bob.rotation.y = t * .4; }
    if (knob.visible) knob.scale.setScalar(ds(knob));
    stone.userData.halo.material.opacity = clamp(camera.position.distanceTo(stone.position) / 120, .1, .45);
    fxPass.uniforms.uTime.value = t;
    composer.render(); updateLabels(); updateChips();
  }
  // every material the lesson can show is compiled behind the loading ring, hidden things included (the mantlet, the tower,
  // the markers, the dashed paths): otherwise each one stalls a frame the first time it appears (a throw, a new chapter)
  async function warmShaders() {
    K.dust(V(0, -400, 0), .01);   // the landing dust is made on the spot: one burst deep underground teaches the GPU its shader now
    const shown = []; scene.traverse(o => { if (!o.visible) { o.visible = true; shown.push(o); } });
    try { await (renderer.compileAsync ? renderer.compileAsync(scene, camera) : renderer.compile(scene, camera)); }
    finally { shown.forEach(o => { o.visible = false; }); }
    composer.render(0);   // one frame through every pass (shadow map, AO, bloom) under the ring
  }
  const screenOf = v => { const r = canvas.getBoundingClientRect(), p = V(v.x, v.y, v.z || 0).project(camera); return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }; };
  window.__game = {
    S, cam, TB, BD, scene, startFrom, get chapters() { return chapters.map(c => T(c[0])); }, get chapter() { return T(chapters[CUR][0]); }, get beat() { return S.beat; }, get lang() { return LANG.cur; },
    screenOf, dotPos: k => dots[k]?.position.clone(),
    bdClient(x, y) { const m = bdEl.getScreenCTM(), p = bdEl.createSVGPoint(); p.x = bx(x); p.y = by(y); const q = p.matrixTransform(m); return { x: q.x, y: q.y }; },
    step, get idea() { return IDEA.k; },
    state() { return { ...hudState(), chapter: T(chapters[CUR][0]), idea: IDEA.k, teach: teacher.on, mode: S.mode, beat: S.beat, lang: LANG.cur, s: TB.s, lift: TB.lift, plumb: S.plumb, cells: [...S.cells], level: S.level, nsol: S.nsol, cases: S.cases, roots: S.roots, landed: S.landed == null ? null : Math.round(S.landed * 100) / 100, hit: S.hit, tf: S.tf, jobs: [...S.jobs], mission: mi, next: $('#btn-next').classList.contains('go'), board: !$('#board').hidden }; },
  };
  frame();
  if (SHOT) {
    document.body.classList.add('shot'); $('#veil').style.opacity = 0;
    (async () => { ++E.RUN; resetWorld(); await cover(); await whenLoaded(); shotFrames = 0; shotT0 = E.now; })();
  } else {
    startAudioOnGesture();
    bootWhenLoaded(() => startFrom(clamp(+(params.get('ch') || 0), 0, chapters.length - 1)), 25000, warmShaders);
  }
}
