/* A worked explanation built line by line in a panel, as at the board (GAME_PLAYBOOK "Teach the lesson").
   Each step may first ask the player a question (the game's own question panel; the player predicts the line),
   then shows its line, runs do() (a point on the board, a piece on the bench…), and waits on its caption until
   the player presses «التالي». The newest line is bright; the panel redraws on a language switch.
   Usage: await explain(hostElement, tr(title), [{ ask, line, do, say, note, t }], { ask: a => game's question(a) })
   A line is a plain maths string (shown left to right) or a tr() object; say is a caption (tr()). */
import { E, wait } from './core.js';
import { T, ltr, mathify, caption, onLang } from './ui.js';

const LIVE = new Map();   // host → { title, lines }
function render(host) {
  const s = LIVE.get(host); if (!s || E.INSTANT) return;
  host.hidden = false;
  host.innerHTML = `<h5 class="ex-h">${mathify(T(s.title))}</h5><ol class="steps">${s.lines.map((l, i) => `<li dir="auto" class="${i === s.lines.length - 1 ? 'on' : ''}">${mathify(typeof l === 'string' ? ltr(l) : T(l))}</li>`).join('')}</ol>`;
}
onLang(() => LIVE.forEach((s, h) => render(h)));

export async function explain(host, title, steps, { ask } = {}) {
  const s = { title, lines: [] }; LIVE.set(host, s); render(host);
  for (const st of steps) {
    if (st.ask) await ask(st.ask);
    if (st.line) { s.lines.push(st.line); render(host); }
    await st.do?.();   // do() may animate (a cart opening, a point placed) before the caption
    if (st.say && !E.INSTANT) { caption(st.say, st.note || null); await wait(st.t || 3.6); }
  }
}
/** Forget a host's explanation (the host is about to show something else); hide it unless keep. */
export function endExplain(host, keep = false) { LIVE.delete(host); if (!keep && host) { host.hidden = true; host.innerHTML = ''; } }
