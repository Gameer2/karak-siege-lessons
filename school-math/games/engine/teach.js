// Lesson-games engine — the teaching kit (GAMES_PLAN.md phase 1; piloted in karak-arc-v2). A game opts in; a game
// that never calls configureTeach() behaves exactly as before.
//   configureTeach({ slug, sfx })   once, at boot: the game's key for its saved progress and its sounds
//   answer(host, { id, q, expect, why, unit, tol })
//                                   a typed answer: the student types a number (an on-screen keypad on touch, the
//                                   keyboard on a desktop); a wrong value shakes, gives why(v) and is recorded;
//                                   resolves when the value is right. ?auto types the answer; E.INSTANT skips it.
//   progress                        what this learner finished and missed, per game, kept in localStorage
//                                   (lesson-games:<slug>). Shown in the codex's «سجلّك» (#misses).
//   teacher                         teacher mode (?teach, or the menu): big text for the board, a question shows
//                                   before its options, a bar to step between ideas (clicker: PageUp/PageDown),
//                                   «تجميد» hides the whole HUD so only the maths is on screen.
//   pickReview(pool, n)             a mixed review: the questions this learner missed first, then the rest shuffled
import { $, E, loopUntil, wait } from './core.js';
import { T, tr, mathify, caption, onLang, typeset } from './ui.js';

const Q = new URLSearchParams(location.search), AUTO = Q.has('auto');
const SFX = { ok() {}, no() {}, tick() {} };
const TXT = {
  check: tr('تحقّق', 'Check'), type: tr('اكتب عدداً.', 'Type a number.'),
  wrong: v => tr(`${v} ليس الجواب. راجع الخطوة وجرّب مرة أخرى.`, `${v} is not the answer. Look at the step again and retry.`),
  reveal: tr('اعرض الخيارات', 'Show the options'), missed: tr('أسئلة تستحق المراجعة', 'Questions worth another look'),
  none: tr('لا شيء بعد: كل سؤال أجبته صحيحاً من أول مرة.', 'Nothing yet: every question answered right first time.'),
  teach: tr('وضع المعلّم', 'Teacher mode'), freeze: tr('تجميد', 'Freeze'), prev: tr('الفكرة السابقة', 'Previous idea'), next: tr('الفكرة التالية', 'Next idea'),
};

/* ======================================================================
   Progress: finished chapters and missed questions, per game
   ====================================================================== */
export const progress = {
  slug: null, d: { done: [], miss: {} },
  load(slug) { this.slug = slug; try { const s = JSON.parse(localStorage.getItem('lesson-games:' + slug) || 'null'); if (s && s.miss) this.d = { done: s.done || [], miss: s.miss }; } catch (e) { /* no storage: this visit only */ } },
  save() { if (!this.slug) return; try { localStorage.setItem('lesson-games:' + this.slug, JSON.stringify(this.d)); } catch (e) {} renderMisses(); },
  finish(i) { if (!this.slug || E.INSTANT || this.d.done.includes(i)) return; this.d.done.push(i); this.save(); },
  isDone(i) { return this.d.done.includes(i); },
  /** A wrong answer: id names the question, q is its text (tr()), v what was given. */
  miss(id, q, v) { if (!this.slug || !id || E.INSTANT) return; const m = this.d.miss[id] || { n: 0, q }; m.n++; m.q = q; m.v = String(v); m.t = Date.now(); this.d.miss[id] = m; this.save(); },
  /** Right on the first try: the question no longer needs review. */
  hit(id) { if (!this.slug || !id || E.INSTANT || !this.d.miss[id]) return; delete this.d.miss[id]; this.save(); },
};
function renderMisses() {
  const el = $('#misses'); if (!el) return;
  const list = Object.values(progress.d.miss).sort((a, b) => b.n - a.n);
  el.innerHTML = `<h6>${T(TXT.missed)}</h6>` + (list.length ? `<ul>${list.map(m => `<li><span>${mathify(T(m.q))}</span><span class="num">×${m.n}</span></li>`).join('')}</ul>` : `<p>${T(TXT.none)}</p>`);
  typeset(el);
}
onLang(renderMisses);

export function configureTeach({ slug, sfx = {} } = {}) {
  Object.assign(SFX, sfx);
  if (slug) progress.load(slug);
  renderMisses();
}

/** Missed questions first (most missed first), then the rest shuffled; n of them. pool: [{ id, … }]. */
export function pickReview(pool, n) {
  const miss = progress.d.miss, rnd = pool.filter(p => !miss[p.id]).map(p => [Math.random(), p]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  return [...pool.filter(p => miss[p.id]).sort((a, b) => miss[b.id].n - miss[a.id].n), ...rnd].slice(0, n);
}

/* ======================================================================
   A typed answer
   ====================================================================== */
// what a learner types, as a number: Arabic-Indic digits, a minus of any kind, a decimal comma all accepted
const DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
export function parseNum(s) {
  s = String(s).trim().replace(/[٠-٩۰-۹]/g, c => DIGITS[c]).replace(/[−–—]/g, '-').replace(/[٫,]/g, '.').replace(/\s+/g, '');
  return /^-?(\d+\.?\d*|\.\d+)$/.test(s) ? +s : null;
}
const show = v => String(v).replace('-', '−');
const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '−', '0', '.'];
const coarse = matchMedia('(pointer: coarse)').matches;
let ANS = null;
function renderAnswer() {
  const a = ANS; if (!a) return; const h = a.host; h.hidden = false;
  const typed = h.querySelector('.ans-in')?.value ?? '';
  h.innerHTML = `<h5>${mathify(T(a.q))}</h5><div class="ans-row"><input class="ans-in" dir="ltr" autocomplete="off" spellcheck="false" inputmode="${coarse ? 'none' : 'decimal'}" aria-label="${String(T(a.q)).replace(/[‪‬"<>&]/g, '')}">${a.unit ? `<span class="ans-unit">${T(a.unit)}</span>` : ''}<button class="ans-go">${T(TXT.check)}</button></div>`
    + `<div class="keypad">${KEYS.map(k => `<button data-k="${k}">${k}</button>`).join('')}<button data-k="del" aria-label="⌫">⌫</button></div>`;
  const inp = h.querySelector('.ans-in'); inp.value = typed;
  h.querySelector('.ans-go').onclick = submit;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } e.stopPropagation(); });
  h.querySelectorAll('.keypad button').forEach(b => b.onclick = () => { const k = b.dataset.k; inp.value = k === 'del' ? inp.value.slice(0, -1) : inp.value + (k === '−' ? '-' : k); inp.classList.remove('no'); SFX.tick(); if (!coarse) inp.focus(); });
  typeset(h);
  if (!coarse && !E.INSTANT) setTimeout(() => inp.focus({ preventScroll: true }), 60);
}
function submit() {
  const a = ANS; if (!a || a.done) return; const inp = a.host.querySelector('.ans-in'), v = parseNum(inp.value);
  if (v === null) { caption(TXT.type); inp.classList.remove('no'); void inp.offsetWidth; inp.classList.add('no'); SFX.no(); return; }
  if (Math.abs(v - a.expect) <= a.tol) { a.done = true; inp.classList.add('ok'); inp.disabled = true; SFX.ok(); if (!a.tries) progress.hit(a.id); return; }
  a.tries++; progress.miss(a.id, a.q, v);
  inp.classList.remove('no'); void inp.offsetWidth; inp.classList.add('no'); SFX.no();
  caption(a.why?.(v) || TXT.wrong(show(v)), null, 'bad');
}
onLang(renderAnswer);
/** Ask for a number. expect: the right value (within tol); why(v): the reason a wrong v is wrong (tr()). */
export function answer(host, { id, q, expect, why, unit = '', tol = 1e-6 }) {
  if (E.INSTANT) return Promise.resolve(expect);
  ANS = { id, q, expect, why, unit, tol, host, tries: 0, done: false }; host.innerHTML = ''; renderAnswer();
  if (AUTO) { const tok = E.RUN; setTimeout(() => { if (tok !== E.RUN || !ANS || ANS.done) return; ANS.host.querySelector('.ans-in').value = String(expect); submit(); }, 1200); }
  return loopUntil(() => ANS && ANS.done).then(() => wait(.7)).then(() => { host.hidden = true; host.innerHTML = ''; ANS = null; return expect; });
}
export const answerOpen = () => !!ANS;

/* ======================================================================
   Teacher mode
   ====================================================================== */
export const teacher = { on: false, frozen: false };
let STEP = null, bar = null;
function applyTeacher() {
  document.body.classList.toggle('teach', teacher.on);
  if (!teacher.on) { teacher.frozen = false; document.body.classList.remove('freeze'); }
  const tg = $('#tg-teach'); if (tg) tg.classList.toggle('on', teacher.on);
  if (bar) bar.hidden = !teacher.on;
  renderBar();
}
function renderBar() {
  if (!bar || !STEP) return;
  const cur = STEP.current(), en = document.body.classList.contains('en');
  // the bar reads in the page's direction: previous first (on the right in Arabic, pointing right), next after it
  bar.innerHTML = `<button data-d="-1" aria-label="${T(TXT.prev)}" title="${T(TXT.prev)}">${en ? '‹' : '›'}</button><span>${cur ? mathify(T(cur)) : ''}</span><button data-d="1" aria-label="${T(TXT.next)}" title="${T(TXT.next)}">${en ? '›' : '‹'}</button><button class="fz" aria-pressed="${teacher.frozen}">${T(TXT.freeze)}</button>`;
  bar.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { SFX.tick(); STEP.go(+b.dataset.d); });
  bar.querySelector('.fz').onclick = toggleFreeze;
}
function toggleFreeze() { teacher.frozen = !teacher.frozen; document.body.classList.toggle('freeze', teacher.frozen); SFX.tick(); renderBar(); }
/** Wire teacher mode: step.go(±1) moves one idea back or forward, step.current() names the idea now showing. */
export function initTeacher(step) {
  STEP = step;
  let on = Q.has('teach'); try { if (!on && localStorage.getItem('lesson-games-teach') === '1') on = true; } catch (e) {}
  teacher.on = on;
  bar = document.createElement('div'); bar.id = 'tbar'; bar.className = 'panel'; bar.hidden = true; document.body.appendChild(bar);
  // the menu's switch, above the sound toggles
  const tg = document.createElement('button'); tg.id = 'tg-teach'; tg.className = 'teach-tg';
  const label = () => { tg.textContent = T(TXT.teach); }; label(); onLang(() => { label(); renderBar(); });
  tg.onclick = () => { teacher.on = !teacher.on; try { localStorage.setItem('lesson-games-teach', teacher.on ? '1' : '0'); } catch (e) {} applyTeacher(); SFX.tick(); };
  $('#menu .toggles')?.before(tg);
  addEventListener('keydown', e => {
    if (!teacher.on || /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
    if (e.key === 'PageDown') { e.preventDefault(); const nx = $('#cap-next'); if (nx && !nx.hidden) nx.click(); else STEP.go(1); }
    else if (e.key === 'PageUp') { e.preventDefault(); STEP.go(-1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const fwd = (e.key === 'ArrowRight') === document.body.classList.contains('en'); STEP.go(fwd ? 1 : -1); }
    else if (e.key === 'f' || e.key === 'F') toggleFreeze();
  });
  applyTeacher();
}
/** Redraw the bar's idea name (the game calls it when the idea changes). */
export const teacherIdea = () => renderBar();
