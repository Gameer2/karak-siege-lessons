// Lesson-games engine — the HUD. It drives the shared DOM in every game's index.html
// (#obj, #caption/#why/#note, #toast, #codex/#entries/#formula, #eqcard, #menu/#chapters, #veil).
// Text rules (one short caption per beat, «لماذا؟» only with a real reason) are in GAME_PLAYBOOK.md.
import * as THREE from 'three';
import { $, E, lerp, tween, wait, ease, pace, skipWaits, hasGate, atGate } from './core.js';
import { AU, applyAudio } from './audio.js';
import { whenLoaded, onAssetProgress } from './assets.js';

/** Wrap every number or formula inside an Arabic sentence: ltr('(1, −2)'). Unwrapped, it reverses to
    (2- ,1). LRE…PDF and LRI…PDI both work. For HTML, use <span class="num"> instead. When the game loads
    KaTeX, every wrapped segment is also typeset (see mathify below). */
export const ltr = s => '‪' + s + '‬';

/* ---------- maths typesetting ----------
   A game that loads KaTeX (the copy the lesson pages use: math-lab/assets/vendor) gets real maths
   everywhere the engine writes text: ltr() segments in captions, objectives, notes and labels, and
   <span class="num">/.m spans in the codex, toasts and the equation card. Plain notation is converted
   (× → \times, x² → x^{2}, sin → \sin, 50° → 50^{\circ} …). A segment with Arabic letters stays as it is,
   and without KaTeX everything falls back to the plain text. */
const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+', 'ⁿ': 'n' };
const SUB = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
const SYM = { '×': '\\times ', '÷': '\\div ', '·': '\\cdot ', '−': '-', '–': '-', '≈': '\\approx ', '≤': '\\le ', '≥': '\\ge ', '≠': '\\ne ', '±': '\\pm ', '∞': '\\infty ', '→': '\\to ', '…': '\\ldots ',
  '°': '^{\\circ}', 'θ': '\\theta ', 'φ': '\\varphi ', 'α': '\\alpha ', 'β': '\\beta ', 'π': '\\pi ', 'Δ': '\\Delta ', '½': '\\tfrac{1}{2}', '¼': '\\tfrac{1}{4}', '¾': '\\tfrac{3}{4}', '′': "'", '″': "''", '‖': '\\|', '%': '\\%' };
const ARABIC = /[\u0600-\u06FF]/;
export function toTex(s) {
  s = String(s).replace(/[\u202A-\u202E\u2066-\u2069]/g, '').replace(/\.\.\./g, '…');
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺ⁿ]+/g, m => '^{' + [...m].map(c => SUP[c]).join('') + '}');
  s = s.replace(/[₀-₉]+/g, m => '_{' + [...m].map(c => SUB[c]).join('') + '}');
  s = s.replace(/√\s*(\([^()]*\)|[\w.]+)/g, (_, a) => '\\sqrt{' + a.replace(/^\((.*)\)$/, '$1') + '}');
  s = s.replace(/\b(\d+(?:\.\d+)?)\s*(cm|mm|km|m|kg|kWh|W)(?=[\s^,.)]|$)/g, '$1\\,\\mathrm{$2}');
  s = s.replace(/\b(arcsin|arccos|arctan|sin|cos|tan|log|ln|max|min|gcd)\b/g, '\\$1 ').replace(/\blcm\b/g, '\\operatorname{lcm}');
  s = s.replace(/\b([A-Z]{3,})\b/g, '\\mathrm{$1}');   // acronyms (GCF, LCM, GPS) stay upright; two-letter names like AB stay maths
  return [...s].map(c => SYM[c] ?? c).join('');
}
/** Plain notation → KaTeX HTML, or null (no KaTeX loaded, Arabic inside, or a parse error).
    trusted allows \htmlClass, for the engine's own formula markup only. */
export function tex(src, display = false, trusted = false) {
  const k = window.katex; src = String(src); if (!k || ARABIC.test(src)) return null;
  try { return k.renderToString(toTex(src), { displayMode: display, throwOnError: true, output: 'html', strict: 'ignore', trust: trusted ? c => c.command === '\\htmlClass' : false }); } catch { return null; }
}
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/** Text with ltr() segments → HTML with each segment typeset. A segment that can't be (Arabic inside)
    becomes an isolated .num span, so it still never reads backwards. */
// ⟦k|words⟧ in a text marks a key term: it is drawn in the colour of what it names on screen (class k-<k>; the game's css
// gives the colours). Plain text elsewhere is unchanged, so games that never write ⟦ are unaffected.
const keys = h => h.replace(/⟦([\w-]+)\|([^⟧]+)⟧/g, (_, k, w) => `<b class="k k-${k}">${w}</b>`);
export function mathify(text) {
  return String(text).split(/(‪[^‬]*‬|⁦[^⁩]*⁩)/).map(p => {
    if (p[0] !== '‪' && p[0] !== '⁦') return keys(esc(p));
    const h = tex(p); if (h) return `<span class="tx">${h}</span>`;
    return window.katex ? `<span class="num">${esc(p.slice(1, -1))}</span>` : esc(p);
  }).join('');
}
// a game's formula markup → TeX: <sup>/<sub> become indices; <i>, <u>, <b>, <em> keep their look as the classes
// t-i, t-u, t-b, t-em, and <span class="x"> keeps its class x
const htmlToTex = h => String(h).replace(/<sup>(.*?)<\/sup>/g, '^{$1}').replace(/<sub>(.*?)<\/sub>/g, '_{$1}')
  .replace(/<span class="([\w -]+)">([^<]*)<\/span>/g, (_, c, x) => `\\htmlClass{${c}}{${x}}`)
  .replace(/<(i|u|b|em)>(.*?)<\/\1>/g, (_, t, x) => (t === 'em' ? '\\quad ' : '') + `\\htmlClass{t-${t}}{${x}}`)
  .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
/** Put formula markup into el, typeset line by line (split at <br>); the HTML as it is when it can't be.
    Unchanged markup is skipped, so it is cheap to call every frame. */
export function texInto(el, html) {
  html = String(html); if (!el || el.__tx === html) return; el.__tx = html;
  const out = html.split(/<br\s*\/?>/i).map(l => tex(htmlToTex(l), false, true));
  el.innerHTML = out.every(Boolean) ? out.join('<br>') : html;
}
/** Typeset the maths spans already in the page (.num, .m, the formula, the equation card). */
export function typeset(root = document) {
  if (!window.katex || !root) return;
  root.querySelectorAll('.num, .m, .formula:not(.locked), #eq-f').forEach(el => {
    const plain = c => /^(SUP|SUB|BR|I|U|B|EM)$/.test(c.tagName) || (c.tagName === 'SPAN' && [...c.attributes].every(a => a.name === 'class') && !c.children.length);
    if (el.querySelector('.katex') || ![...el.children].every(plain)) return;
    texInto(el, el.innerHTML);
  });
}
/* ---------- language: Arabic by default, English when the lesson page asks (?lang=en at load, or a
   {type:'lang'} message when its toggle changes). Only a game whose <html> declares data-langs="ar en"
   switches; every text it shows is written tr('عربي', 'English'). The layout doesn't mirror: in English
   only the text direction changes (hud.css, body.en). Static HTML swaps with data-en / data-en-title. ---------- */
const supports = l => l === 'ar' || (document.documentElement.dataset.langs || '').split(/\s+/).includes(l);
export const LANG = { cur: new URLSearchParams(location.search).get('lang') === 'en' && supports('en') ? 'en' : 'ar', fns: new Set() };
export const tr = (ar, en) => ({ ar, en });
/** A text in the current language: tr objects resolve, plain strings pass through. */
export const T = v => (v && typeof v === 'object' && 'ar' in v ? (LANG.cur === 'en' && v.en != null ? v.en : v.ar) : v);
/** Re-render a game's own panels when the language changes. */
export const onLang = f => { LANG.fns.add(f); };
export function setLang(l) { if (!supports(l) || l === LANG.cur) return; LANG.cur = l; applyLang(); }
const EMPTY = tr('ما تكتشفه يُدوَّن هنا.', 'What you discover is written here.'), LOADING = tr('جارٍ التحميل', 'Loading');
let OBJ = null, CAP = null;
function applyLang() {
  const en = LANG.cur === 'en';
  document.documentElement.lang = LANG.cur; document.body.classList.toggle('en', en);
  document.querySelectorAll('[data-en]').forEach(el => { if (el.dataset.ar === undefined) el.dataset.ar = el.innerHTML; el.innerHTML = en ? el.dataset.en : el.dataset.ar; });
  document.querySelectorAll('[data-en-title]').forEach(el => { if (el.dataset.arTitle === undefined) el.dataset.arTitle = el.title || el.getAttribute('aria-label') || ''; const t = en ? el.dataset.enTitle : el.dataset.arTitle; el.title = t; el.setAttribute('aria-label', t); });
  if (OBJ && !$('#obj').hidden) $('#obj-text').innerHTML = mathify(T(OBJ));
  if (CAP && $('#caption').classList.contains('on')) $('#cap-text').innerHTML = mathify(T(CAP));
  if (NOTE && !$('#note').hidden) { $('#note-t').innerHTML = mathify(T(NOTE.title)); $('#note-p').innerHTML = mathify(T(NOTE.text)); }
  document.querySelectorAll('#entries li').forEach(li => { if (li.__src !== undefined) { li.innerHTML = T(li.__src); typeset(li); } else if (li.classList.contains('empty')) li.textContent = T(EMPTY); });
  for (const L of LB.values()) if (L.src != null) { const t = T(L.src); L.el.innerHTML = mathify(t); L.text = t; }
  for (const { el } of PR.values()) if (el.__src !== undefined) el.innerHTML = T(el.__src);
  const ld = document.querySelector('#loader p'); if (ld) ld.firstChild.textContent = T(LOADING) + ' ';
  renderChapters(); LANG.fns.forEach(f => f(LANG.cur)); typeset(document);
}
addEventListener('message', e => { if (e.data && e.data.type === 'lang') setLang(e.data.lang); });

/** Hooks a game fills in: tick() for UI clicks, chime() for discoveries, onObjectiveDone() optional. */
export const UI = { tick: () => {}, chime: () => {}, onObjectiveDone: null };

/* ---------- objective card (top-right): what to do now + progress ---------- */
let objT = 0;
export function objective(text, count = '', frac = null) {
  const o = $('#obj'); OBJ = text || null; if (!text) { o.hidden = true; return; }
  const apply = () => { o.classList.remove('done', 'swap'); $('#obj-text').innerHTML = mathify(T(text)); $('#obj-count').textContent = count; $('#obj-bar').style.width = (frac === null ? 0 : frac * 100) + '%'; };
  o.hidden = false; if (E.INSTANT) { apply(); return; } o.classList.add('swap'); clearTimeout(objT); objT = setTimeout(apply, 260);
}
export function objProgress(count, frac) { $('#obj-count').textContent = count; $('#obj-bar').style.width = frac * 100 + '%'; }
export function objDone() { $('#obj').classList.add('done'); $('#obj-bar').style.width = '100%'; if (!E.INSTANT) UI.onObjectiveDone?.(); }

/* ---------- caption (bottom): one sentence; note = {title, text} shows «لماذا؟» ----------
   Learner-paced: the story waits on each explanation until the reader presses «التالي» (or Space); the
   button glows once the caption's reading time (1.4 s + 0.42 s a word) is up. The demo autopilot (?auto)
   moves on by itself after that reading time; the test tools (?fast) never wait. «لماذا؟» and the codex
   pause the game while they are open. */
let NOTE = null, capT = 0;
const Q = new URLSearchParams(location.search), FAST = Q.has('fast'), AUTO_PACE = Q.has('auto');
const READ = { at: 0, need: 0, ack: true, armed: false }, NEXT = tr('التالي ‹', 'Next ›');
const readSecs = t => Math.min(12, 1.4 + .42 * String(T(t)).replace(/[‪-‮⁦-⁩]/g, '').split(/\s+/).filter(Boolean).length);
pace.arm = () => { if (!READ.armed) return false; READ.armed = false; return true; };
pace.gate = () => { if (FAST || !$('#caption').classList.contains('on')) return false; return AUTO_PACE ? E.now - READ.at < READ.need : !READ.ack; };
function nextBeat() { READ.ack = true; skipWaits(); UI.tick(); }
const syncPause = () => { E.PAUSED = !$('#menu').hidden || !$('#note').hidden || !$('#codex').hidden; };
export function caption(text, note = null, kind = '') {
  if (E.INSTANT) return;
  const c = $('#caption'); $('#note').hidden = true; syncPause(); clearTimeout(capT); CAP = text || null;
  c.dataset.kind = kind || '';   // 'bad' (a wrong move), 'ok' (it worked), 'story': a game may style each kind
  if (!text) { c.classList.remove('on'); READ.need = 0; READ.ack = true; return; }
  READ.armed = true; queueMicrotask(() => { READ.armed = false; });   // the wait right after this call is the gate
  const apply = () => { READ.at = E.now; READ.need = readSecs(text); READ.ack = false; $('#cap-text').innerHTML = mathify(T(text)); NOTE = note; $('#why').hidden = !note; c.classList.add('on'); };
  if (c.classList.contains('on')) { c.classList.remove('on'); capT = setTimeout(apply, 260); } else apply();
}
let toastT = 0;
export function toast(html) { if (E.INSTANT) return; const t = $('#toast'); t.innerHTML = T(html); typeset(t); t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3600); }

/* ---------- codex («الخلاصة»): what the player has discovered ---------- */
let badge = 0;
export function addEntry(html) {
  const ul = $('#entries'); ul.querySelector('.empty')?.remove();
  const li = document.createElement('li'); li.__src = html; li.innerHTML = T(html); typeset(li); if (!E.INSTANT) li.className = 'new'; ul.appendChild(li); $('#btn-codex').hidden = false;
  if (!E.INSTANT) { badge++; $('#badge').textContent = badge; $('#badge').classList.add('on'); const b = $('#btn-codex'); b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); }
}
export function resetCodexBase(formulaPlaceholder) {
  $('#entries').innerHTML = `<li class="empty">${T(EMPTY)}</li>`;
  $('#formula').textContent = formulaPlaceholder; $('#formula').classList.add('locked');
  badge = 0; $('#badge').classList.remove('on'); $('#btn-codex').hidden = true;
}
export function veil(to, dur) { const el = $('#veil'), f = +getComputedStyle(el).opacity; return tween(dur, p => { el.style.opacity = lerp(f, to, p); }, ease.lin); }
/** The discovery card: shows the result big, then flies it into the codex button. Needs #eq-f and #eq-s. */
export async function eqToCodex(html, small) {
  if (E.INSTANT) return;
  const card = $('#eqcard'); $('#eq-f').innerHTML = T(html); $('#eq-s').innerHTML = mathify(T(small)); typeset(card);
  card.classList.remove('fly'); card.style.transform = ''; card.style.opacity = ''; card.classList.add('on'); UI.chime();
  await wait(2.6);
  const r = card.getBoundingClientRect(), b = $('#btn-codex').getBoundingClientRect();
  card.classList.add('fly'); card.style.transform = `translate(calc(-50% + ${b.left + b.width / 2 - (r.left + r.width / 2)}px), calc(-50% + ${b.top + b.height / 2 - (r.top + r.height / 2)}px)) scale(.08)`; card.style.opacity = '0';
  await wait(1); card.classList.remove('on', 'fly'); card.style.transform = ''; card.style.opacity = '';
}

/* ---------- menu: chapters (rewind), music/effects toggles ---------- */
let CH = null;
export function renderChapters() {
  if (!CH) return; const box = $('#chapters'); box.innerHTML = '';
  CH.chapters.forEach(([name, , ideas], i) => {
    const b = document.createElement('button'); b.innerHTML = `<span>${i + 1}</span>${T(name)}${CH.done?.(i) ? '<i class="ok">✓</i>' : ''}`; if (i === CH.getCur()) b.className = 'now'; b.onclick = () => { closeMenu(); CH.startFrom(i); }; box.appendChild(b);
    // a game that names its ideas (chapters[i][2]) lists them under the chapter: a teacher jumps straight to one
    if (ideas && CH.getIdea) ideas.forEach((nm, k) => { if (!k) return; const s = document.createElement('button'); s.className = 'idea' + (i === CH.getCur() && k === CH.getIdea() ? ' now' : ''); s.innerHTML = mathify(T(nm)); s.onclick = () => { closeMenu(); CH.startFrom(i, k); }; box.appendChild(s); });
  });
}
export function toggleMenu() { if ($('#menu').hidden) { $('#menu').hidden = false; syncPause(); renderChapters(); } else closeMenu(); }
export function closeMenu() { $('#menu').hidden = true; syncPause(); }
/** Wire every shared HUD control once. chapters: [[name, fn], …]; startFrom(i); getCur() → index.
    Optional: chapters[i][2] = the chapter's idea names with getIdea() → the idea now showing and startFrom(i, k)
    (the menu lists the ideas), and done(i) → a ✓ on finished chapters. */
export function wireHud({ chapters, startFrom, getCur, getIdea, done }) {
  CH = { chapters, startFrom, getCur, getIdea, done };
  $('#why').onclick = () => { if (!NOTE) return; $('#note-t').innerHTML = mathify(T(NOTE.title)); $('#note-p').innerHTML = mathify(T(NOTE.text)); $('#note').hidden = false; syncPause(); UI.tick(); };
  $('#note-x').onclick = () => { $('#note').hidden = true; syncPause(); };
  $('#btn-menu').onclick = toggleMenu; $('#resume').onclick = closeMenu;
  $('#menu').addEventListener('click', e => { if (e.target.id === 'menu') closeMenu(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#codex').hidden || !$('#note').hidden) { $('#codex').hidden = true; $('#note').hidden = true; syncPause(); } else toggleMenu(); } });
  $('#tg-music').onclick = () => { AU.music = !AU.music; applyAudio(); };
  $('#tg-sfx').onclick = () => { AU.sfx = !AU.sfx; applyAudio(); };
  $('#btn-mute').onclick = () => { const on = !(AU.music || AU.sfx); AU.music = AU.sfx = on; applyAudio(); };
  $('#btn-codex').onclick = () => { const c = $('#codex'); c.hidden = !c.hidden; syncPause(); if (!c.hidden) { typeset(c); badge = 0; $('#badge').classList.remove('on'); UI.tick(); } };
  $('#codex-x').onclick = () => { $('#codex').hidden = true; syncPause(); };
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
    document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('.tab').forEach(t => t.hidden = t.dataset.tab !== b.dataset.tab);
  });
  // «التالي»: shown only while the story waits on the reader
  const nx = document.createElement('button'); nx.className = 'next'; nx.id = 'cap-next'; nx.hidden = true;
  nx.innerHTML = `<span data-ar="${NEXT.ar}" data-en="${NEXT.en}">${T(NEXT)}</span>`; nx.onclick = nextBeat; $('#caption').appendChild(nx);
  addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !nx.hidden && !/INPUT|TEXTAREA|BUTTON|SELECT/.test(document.activeElement?.tagName || '')) { e.preventDefault(); nextBeat(); } });
  typeset($('#codex'));
  applyAudio();
}
/** Boot a game: a loading ring with real progress stays over the black veil until every asset
    requested so far has arrived (at most maxWait), then prepare() (optional: e.g. compiling the shaders) and start() run. The first beat plays on a
    finished scene instead of textures popping in. */
export async function bootWhenLoaded(start, maxWait = 25000, prepare = null) {
  const el = document.createElement('div'); el.id = 'loader'; el.innerHTML = `<i></i><p>${T(LOADING)} <b class="num">0%</b></p>`; document.body.appendChild(el);
  const pct = el.querySelector('b'); onAssetProgress((d, r) => { pct.textContent = Math.round(100 * d / Math.max(1, r)) + '%'; });
  await Promise.race([whenLoaded(), new Promise(r => setTimeout(r, maxWait))]);
  if (prepare) { try { await prepare(); } catch (e) { /* a failed warm-up only costs the first-use stutter it was meant to save */ } }
  el.classList.add('out'); setTimeout(() => el.remove(), 600); start();
}
/** What the tools print as a game's state: the objective, its counter and the caption. */
export const hudState = () => ({ obj: $('#obj')?.hidden ? '' : $('#obj-text')?.textContent, count: $('#obj')?.hidden ? '' : $('#obj-count')?.textContent, cap: $('#caption')?.classList.contains('on') ? $('#cap-text')?.textContent : '' });   // only what is on screen

/* ---------- world-anchored HTML (crisp text over the 3D scene; call setCamera once) ----------
   label(): a tag that follows a 3D point, optionally offset with a leader line (#labels, #leaders).
   chip(): a small clickable action anchored to a 3D point (#prompts). Update both every frame. */
let CAM = null; const _v = new THREE.Vector3(), svgNS = 'http://www.w3.org/2000/svg';
export function setCamera(c) { CAM = c; }
export function project(v) { _v.copy(v).project(CAM); return _v.z > 1 ? null : { x: (_v.x + 1) / 2 * innerWidth, y: (1 - _v.y) / 2 * innerHeight }; }
export const LB = new Map();
export function label(id, cls, anchor, offset = null) {
  const el = document.createElement('div'); el.className = 'lbl ' + cls; $('#labels').appendChild(el);
  let line = null; if (offset) { line = document.createElementNS(svgNS, 'line'); $('#leaders').appendChild(line); }
  LB.set(id, { el, line, anchor, offset, text: null, vis: 0 });
}
export function setLabel(id, text, vis = 1) { const L = LB.get(id); if (text !== null) { L.src = text; const t = T(text); if (t !== L.text) { L.el.innerHTML = mathify(t); L.text = t; } } L.vis = vis; }
// labels keep clear of each other, of the HUD panels and of the chips: a label that would overlap moves up
// or down to the nearest free spot (smoothed, so it never jitters), with its leader line following it
let OBST = [], obstT = 0;
const hit = (a, b, m = 3) => a.left < b.right + m && a.right > b.left - m && a.top < b.bottom + m && a.bottom > b.top - m;
export function updateLabels() {
  const now = performance.now();
  if (now - obstT > 200) { obstT = now; OBST = [...document.querySelectorAll('#hud .panel, #prompts .chip')].filter(el => el.offsetParent !== null && +getComputedStyle(el).opacity > .05).map(el => { const b = el.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, chip: el.classList.contains('chip') }; }).filter(r => r.width > 0); }
  const nx = document.getElementById('cap-next');
  if (nx) { const show = !FAST && $('#caption').classList.contains('on') && hasGate(); if (nx.hidden === show) nx.hidden = !show; nx.classList.toggle('ready', show && atGate() && E.now - READ.at >= READ.need); }
  const placed = [];
  for (const L of LB.values()) {
    const s = L.vis > .01 ? project(L.anchor()) : null;
    if (!s) { L.el.style.opacity = 0; if (L.line) L.line.style.opacity = 0; continue; }
    const w = L.el.offsetWidth, h = L.el.offsetHeight, lx = L.offset ? s.x + L.offset[0] : s.x, ly = L.offset ? s.y + L.offset[1] : s.y;
    const R = dy => ({ left: lx - w / 2, right: lx + w / 2, top: ly - h / 2 + dy, bottom: ly + h / 2 + dy });
    const clear = r => !placed.some(p => hit(r, p)) && !OBST.some(p => hit(r, p));
    let want = 0;
    if (!clear(R(0))) { const st = h + 6; for (const k of [-1, 1, -2, 2, -3, 3]) if (clear(R(k * st))) { want = k * st; break; } }
    L.dy = L.dy === undefined ? want : L.dy + (want - L.dy) * .25; if (Math.abs(L.dy - want) < .5) L.dy = want;
    if (L.vis > .3) placed.push(R(L.dy));
    L.el.style.transform = `translate(${lx - w / 2}px,${ly - h / 2 + L.dy}px)`; L.el.style.opacity = L.vis;
    if (L.line) { L.line.setAttribute('x1', s.x); L.line.setAttribute('y1', s.y); L.line.setAttribute('x2', lx); L.line.setAttribute('y2', ly + L.dy + h / 2); L.line.style.opacity = L.vis * .9; }
  }
}
const PR = new Map();
export function chip(id, html, anchor, { click = null, passive = false } = {}) {
  clearChip(id, true);
  const el = document.createElement(click ? 'button' : 'div'); el.className = 'chip' + (passive ? ' passive' : ''); el.__src = html; el.innerHTML = T(html);
  if (click) el.onclick = e => { e.stopPropagation(); click(); };
  $('#prompts').appendChild(el); PR.set(id, { el, anchor }); return el;
}
export function clearChip(id, now) { const p = PR.get(id); if (!p) return; PR.delete(id); if (now) p.el.remove(); else { p.el.classList.add('out'); setTimeout(() => p.el.remove(), 320); } }
export function clearChips() { [...PR.keys()].forEach(k => clearChip(k, true)); }
// a chip that would sit on a HUD panel (the caption, the objective…) rises until it is clear of it
export function updateChips() {
  const panels = OBST.filter(r => !r.chip);
  for (const { el, anchor } of PR.values()) {
    const s = project(anchor()); if (!s) { el.style.visibility = 'hidden'; continue; }
    el.style.visibility = ''; const w = el.offsetWidth, h = el.offsetHeight; let y = s.y;
    for (let i = 0; i < 4; i++) { const r = { left: s.x - w / 2, right: s.x + w / 2, top: y - h / 2, bottom: y + h / 2 }, p = panels.find(q => hit(r, q, 6)); if (!p) break; y = p.top - h / 2 - 8; }
    el.style.left = s.x + 'px'; el.style.top = y + 'px';
  }
}
// a game opened with ?lang=en: swap its static HTML and set the text direction before the first frame
if (LANG.cur === 'en') applyLang();
