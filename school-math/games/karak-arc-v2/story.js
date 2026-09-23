// The story's voice on screen (the user's brief of 2026-09-23: the language is a strong part of the game and must have
// presence, not sit in a small grey box). Two forms, beside the ordinary captions:
//   title(i, name, mission)   a chapter opens: its ordinal, its name and its mission, large, over a dimmed scene (~3 s)
//   story(lines)              a moment of the story in the display face, centred, line after line; the reader moves on with
//                             «متابعة» (or Space / Enter). A line is tr(); { t: tr(), small: true } is a quieter line.
// ?fast skips the waiting; ?auto moves on after the reading time; E.INSTANT (a rewind replay) shows nothing. hide() clears.
import { E, wait, loopUntil } from '../engine/core.js';
import { T, tr, mathify, typeset, UI } from '../engine/ui.js';

const Q = new URLSearchParams(location.search), AUTO = Q.has('auto'), FAST = Q.has('fast');
const el = document.createElement('div'); el.id = 'story'; el.setAttribute('aria-live', 'polite'); document.body.appendChild(el);
const ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع'], ORD_EN = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];
const words = t => String(T(t)).replace(/[‪-‮⁦-⁩]/g, '').split(/\s+/).filter(Boolean).length;
const GO = tr('متابعة', 'Continue');
let run = 0;

export function hide() { run++; el.classList.remove('on'); setTimeout(() => { if (!el.classList.contains('on')) el.innerHTML = ''; }, 650); }

/** A chapter's title card. */
export async function title(i, name, mission) {
  if (E.INSTANT) return;
  const r = ++run;
  el.innerHTML = `<div class="st-title"><small>${T(tr('الفصل ' + ORD[i], 'Chapter ' + ORD_EN[i]))}</small><h2>${mathify(T(name))}</h2>${mission ? `<p>${mathify(T(mission))}</p>` : ''}</div>`;
  typeset(el); el.classList.add('on');
  await wait(FAST ? .3 : 2.2 + words(mission || '') * .12);
  if (r === run) hide();
  await wait(FAST ? 0 : .5);
}

/** A moment of the story, told large. Resolves when the reader moves on. */
export async function story(lines) {
  if (E.INSTANT) return;
  const r = ++run, L = lines.map(l => (l && l.t ? l : { t: l }));
  el.innerHTML = L.map((l, k) => `<p class="st-line${l.small ? ' small' : ''}" style="animation-delay:${(k * .9).toFixed(1)}s">${mathify(T(l.t))}</p>`).join('')
    + `<button class="st-go" style="animation-delay:${(L.length * .9).toFixed(1)}s">${T(GO)} ‹</button>`;
  typeset(el); el.classList.add('on');
  let go = false; const done = () => { if (!go) { go = true; UI.tick(); } };
  el.querySelector('.st-go').onclick = done;
  const key = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); done(); } };
  addEventListener('keydown', key);
  const read = L.length * .9 + L.reduce((s, l) => s + words(l.t), 0) * .32 + 1;
  if (FAST) setTimeout(done, 300); else if (AUTO) setTimeout(done, read * 1000);
  try { await loopUntil(() => go); } finally { removeEventListener('keydown', key); }
  if (r === run) hide();
  await wait(.4);
}
