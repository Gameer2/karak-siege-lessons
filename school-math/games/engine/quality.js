/* Render quality for the lesson games, scaled to the device (the numbers come from the weak-GPU research, 2026-09-14):
   - a drawing-buffer pixel budget per tier: a 4K smart board draws about 1280×720 and CSS stretches it; the HTML HUD stays sharp;
   - four tiers: 'board' (no post passes at all, 30 fps paced, a CSS vignette, one 1024 shadow map redrawn twice a second),
     'low' (no GTAO or bloom, 30 fps paced), 'medium' (bloom), 'high' (GTAO and bloom);
   - auto starts at the GPU's tier (detectTier), steps down fast on a frame-time budget and up slowly, scales the resolution
     (0.6–1.0) inside a tier, and locks after 3 flip-flops;
   - no WebGL 2, software GL and a lost context get a clear message; nothing is drawn while the tab is hidden.
   The menu gets a «الجودة» button (Auto → High → Medium → Low → Board), kept in localStorage 'lesson-games-quality'.
   ?q=<tier> forces a tier, ?px=<pixels> forces the budget (device tests), ?debug=1 shows a stats panel, ?shot keeps the full look.
   Usage, after the composer's last pass: setupQuality({ renderer, composer, gtao, bloom, scene, force: SHOT }). */
import { tr, T, onLang } from './ui.js';

const KEY = 'lesson-games-quality', P = new URLSearchParams(location.search), SHOT = P.has('shot');
export const TIERS = ['board', 'low', 'medium', 'high'];
const MODES = ['auto', 'high', 'medium', 'low', 'board'];
const NAME = { auto: tr('تلقائية', 'Auto'), high: tr('عالية', 'High'), medium: tr('متوسطة', 'Medium'), low: tr('منخفضة', 'Low'), board: tr('الشاشة الذكية', 'Board') };
const LABEL = tr('الجودة', 'Quality');
// per tier: the drawing-buffer pixel budget, GTAO, bloom, the largest shadow-map side, straight-to-canvas rendering, 30 fps pacing
const LEVEL = {
  board: { px: 921600, ao: false, bloom: false, shadow: 1024, direct: true, pace: true },
  low: { px: 1400000, ao: false, bloom: false, shadow: 1024, direct: false, pace: true },
  medium: { px: 2100000, ao: false, bloom: true, shadow: 2048, direct: false, pace: false },
  high: { px: 3700000, ao: true, bloom: true, shadow: 4096, direct: false, pace: false },
};
const FRAME30 = 1000 / 30, SHADOW_EVERY = 15;   // board: the one shadow map is redrawn every 15th drawn frame (twice a second)
export const QUALITY = { mode: 'auto', level: 'high', tier: null, device: null, scale: 1, pr: 1, direct: false, locked: false, fps: 0, fpsMed: 0, fpsP10: 0, lost: 0, gpu: '', report };

/* ---------- the GPU, read once from a throwaway context before the game makes its own ---------- */
const SOFT = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i;
const gpuName = gl => { const x = gl.getExtension('WEBGL_debug_renderer_info'); return String((x && gl.getParameter(x.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || ''); };
let WGL2 = false;
try { const gl = document.createElement('canvas').getContext('webgl2'); if (gl) { WGL2 = true; QUALITY.gpu = gpuName(gl); gl.getExtension('WEBGL_lose_context')?.loseContext(); } } catch (e) { /* no WebGL 2 */ }

/** The GPU's tier from its renderer string (research R3; tune the lists with QUALITY.report() data from real devices). */
function classify(r) {
  if (SOFT.test(r)) return 'board';
  const big = Math.max(screen.width, screen.height) * (devicePixelRatio || 1) >= 3000 && Math.min(screen.width, screen.height) >= 500;   // a 4K panel, not a phone
  if (/Android/i.test(navigator.userAgent) && big) return 'board';   // Android smart boards: a phone GPU driving 4K
  if (/PowerVR|Mali-(G31|G51|G52|G71|G72|T\d)|Adreno \(TM\) ([345]\d\d|6[01]\d)|VideoCore|Vivante/i.test(r)) return 'board';
  if (/Mali-G57|Mali-G68 MC[24]|Adreno \(TM\) 6[23]\d|Intel.*(HD|UHD) Graphics/i.test(r)) return 'low';
  if (/Mali-G(68|77|78|610|710)|Adreno \(TM\) (6[4-9]\d|7\d\d)|Iris|Radeon(?! RX)/i.test(r)) return 'medium';
  return matchMedia('(pointer: coarse)').matches ? 'medium' : 'high';   // an unknown touch GPU doesn't start on GTAO
}
const saved = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
QUALITY.device = classify(QUALITY.gpu);
const q0 = P.get('q'), m0 = saved();
let tier0 = TIERS.includes(q0) ? q0 : SHOT ? 'high' : q0 !== 'auto' && TIERS.includes(m0) ? m0 : QUALITY.device, started = false;
QUALITY.tier = QUALITY.level = tier0;

/** The starting tier, decided once before any model loads: 'board' | 'low' | 'medium' | 'high'. ?q=<tier> wins, then the menu's
    saved choice, then the GPU. Shared contract: engine/assets.js (which model and texture variant to load) and the worlds (baked
    lighting on board/low) read it; setupQuality starts there. Keep this signature. */
export function detectTier(renderer) {
  if (!QUALITY.gpu && renderer) {   // the probe saw nothing: try the game's own context
    try { QUALITY.gpu = gpuName(renderer.getContext()); } catch (e) { /* no context info */ }
    if (QUALITY.gpu) { const d = classify(QUALITY.gpu); if (tier0 === QUALITY.device) tier0 = d; QUALITY.device = d; if (!started) QUALITY.tier = QUALITY.level = tier0; }
  }
  return tier0;
}

// board: no MSAA on the game's canvas. antialias is fixed when the context is made, so it is decided before three.js asks for one
if (tier0 === 'board') {
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, a) { return gc.call(this, type, /webgl/.test(type) && a ? { ...a, antialias: false } : a); };
}

/* ---------- messages: no WebGL 2 (blocks the page), software GL (a banner; the game runs on the board tier) ---------- */
const MSG = ['جهازك أو متصفحك لا يدعم الرسوميات ثلاثية الأبعاد. حدّث Chrome أو Android System WebView، أو استخدم مدخل الكمبيوتر.',
  "Your device or browser can't draw 3D graphics well. Update Chrome or Android System WebView, or switch the board to its computer input."];
function message(kind) {
  const el = document.createElement('div'); el.className = 'q-msg ' + kind; el.setAttribute('role', 'alert');
  el.innerHTML = `<p dir="rtl" lang="ar">${MSG[0]}</p><p dir="ltr" lang="en">${MSG[1]}</p>` + (kind === 'banner' ? '<button class="x" aria-label="Close">×</button>' : '');
  el.querySelector('.x')?.addEventListener('click', () => el.remove());
  document.body.appendChild(el); return el;
}
const onBody = f => document.body ? f() : addEventListener('DOMContentLoaded', f);
if (!WGL2) onBody(() => message('block'));
else if (SOFT.test(QUALITY.gpu)) onBody(() => message('banner'));

/* ---------- frame stats (drawn frames only) ---------- */
const FT = [];   // the last 240 intervals between drawn frames, ms
const sorted = a => [...a].sort((x, y) => x - y), med = a => sorted(a)[a.length >> 1] || 0, pct = (a, p) => { const s = sorted(a); return s[Math.min(s.length - 1, Math.floor(s.length * p))] || 0; };
function stats() { if (FT.length < 5) return; QUALITY.fps = QUALITY.fpsMed = Math.round(1000 / med(FT)); QUALITY.fpsP10 = Math.round(1000 / pct(FT, .9)); }
let CANVAS = null;
/** An anonymous record for a future fps beacon (research R8). Nothing is sent anywhere. */
function report() {
  stats(); const ua = navigator.userAgent, r2 = x => Math.round(x * 100) / 100;
  return { g: location.pathname.split('/').filter(Boolean).slice(-2, -1)[0] || '', r: QUALITY.gpu.slice(0, 80), tier: QUALITY.tier, device: QUALITY.device, mode: QUALITY.mode,
    bw: CANVAS?.width || 0, bh: CANVAS?.height || 0, dpr: r2(devicePixelRatio || 1), sw: screen.width, sh: screen.height,
    cores: navigator.hardwareConcurrency || 0, mem: navigator.deviceMemory || 0, fpsMed: QUALITY.fpsMed, fpsP10: QUALITY.fpsP10,
    scale: r2(QUALITY.scale), lost: QUALITY.lost, wgl2: WGL2, ua: /Android/i.test(ua) ? 'android' : /iPhone|iPad/i.test(ua) ? 'ios' : 'desktop' };
}

export function setupQuality({ renderer, composer, gtao = null, bloom = null, scene, force = false }) {
  detectTier(renderer); started = true;
  const canvas = CANVAS = renderer.domElement, rp = composer.passes[0], scn = scene || rp.scene, aoAllowed = !!gtao?.enabled;
  let mode = P.get('q'); if (!MODES.includes(mode)) mode = saved();
  QUALITY.mode = MODES.includes(mode) ? mode : 'auto';
  let tier = force ? 'high' : tier0, scale = 1, PR = 0, W = 0, H = 0, probing = 0;
  const direct = () => !force && LEVEL[tier].direct, paced = () => !force && LEVEL[tier].pace && !probing;
  const dpr = () => window.devicePixelRatio || 1;

  // the pixel budget: pr = min(dpr, √(budget / css pixels)) × scale. It is re-checked before every drawn frame, so a game's own
  // resize handler (renderer.setSize(innerWidth, innerHeight), bloom/gtao.setSize) and full-screen switches are corrected first
  const prFor = (w, h) => force ? Math.min(dpr(), 2) : Math.min(dpr(), Math.sqrt((+P.get('px') || LEVEL[tier].px) / (w * h))) * scale;
  function fit(hard) {
    const w = innerWidth, h = innerHeight; if (!w || !h) return;
    const want = prFor(w, h); if (hard || w !== W || h !== H || Math.abs(want - PR) > PR * .05) PR = want;   // ignore drifts under 5%
    const d = direct(), cw = d ? 64 : w, ch = d ? 64 : h, cpr = d ? 1 : PR;   // board: the unused composer targets shrink to nothing
    if (w === W && h === H && canvas.width === Math.floor(w * PR) && canvas.height === Math.floor(h * PR) && composer._width === cw && composer._height === ch && composer._pixelRatio === cpr) return;
    W = w; H = h; QUALITY.pr = PR;
    renderer.setPixelRatio(PR); renderer.setSize(w, h, false);   // false: CSS keeps the canvas full size and stretches it
    if (composer._pixelRatio !== cpr) composer.setPixelRatio(cpr);
    composer.setSize(cw, ch);   // every pass (bloom, GTAO) follows the same buffer size
  }

  // shadows: maps capped per tier; board keeps only the main light's map and redraws it on a slow cadence
  function shadows() {
    const one = direct(), cap = force ? Infinity : LEVEL[tier].shadow, lights = [];
    scn.traverse(o => { if (!o.isLight || !o.shadow) return; const u = o.userData; if (u.qCast === undefined) u.qCast = o.castShadow; if (u.qCast) lights.push(o); });
    const main = one ? lights.reduce((a, o) => !a || (o.isDirectionalLight && !a.isDirectionalLight) || (!!o.isDirectionalLight === !!a.isDirectionalLight && o.intensity > a.intensity) ? o : a, null) : null;
    for (const o of lights) {
      o.castShadow = !one || o === main;
      const s = o.shadow, u = o.userData; if (!u.q0) u.q0 = s.mapSize.clone();
      const k = Math.min(1, cap / Math.max(u.q0.x, u.q0.y)), w = Math.round(u.q0.x * k), h = Math.round(u.q0.y * k);
      if (s.mapSize.x !== w || s.mapSize.y !== h) { s.mapSize.set(w, h); if (s.map) { s.map.dispose(); s.map = null; } }
    }
    renderer.shadowMap.autoUpdate = !one; renderer.shadowMap.needsUpdate = true;
  }

  // board: the fxPass's vignette, and the flash / "broken maths" tint two games keep in it, as CSS layers over the canvas (no GPU cost)
  const fxp = composer.passes.find(p => p.uniforms && /smoothstep/.test(p.material?.fragmentShader || '')), U = fxp?.uniforms || {};
  const vk = +((fxp?.material.fragmentShader.match(/vec2\(1\.05,1\.\)\)\),([\d.]+)\)/) || [])[1] || .38);
  const over = document.createElement('div'); over.className = 'q-over'; over.hidden = true;
  over.innerHTML = '<div class="q-vig"></div><div class="q-tint"></div><div class="q-flash"></div>';
  over.style.setProperty('--q-v1', (.2 * vk).toFixed(3)); over.style.setProperty('--q-v2', (.6 * vk).toFixed(3));
  canvas.after(over);
  const [, tint, flash] = over.children;
  const mirror = () => { if (U.uBreak) tint.style.opacity = (U.uBreak.value * .3).toFixed(3); if (U.uFlash) flash.style.opacity = (U.uFlash.value * .35).toFixed(3); };

  function apply(t) {
    tier = t; const L = LEVEL[t];
    QUALITY.level = QUALITY.tier = t; QUALITY.direct = direct(); QUALITY.scale = scale;
    if (gtao) gtao.enabled = aoAllowed && (force || L.ao);
    if (bloom) bloom.enabled = force || L.bloom;
    over.hidden = !direct(); shadows(); fit(true); label(); skip = 2; bad = good = 0;
    dispatchEvent(new CustomEvent('lesson-quality', { detail: { tier: t } }));   // for worlds that swap lighting when the tier changes
  }

  // every drawn frame goes through here: hidden tab, lost context, 30 fps pacing, the budget check, then the composer or, on board, the scene straight to the canvas
  const render0 = composer.render.bind(composer), iv = [];
  let lastR = 0, drawn = 0, lost = false;
  renderer.info.autoReset = false;   // the counts cover the whole frame (shadow, AO and post passes), reset below
  composer.render = function (dt) {
    if (document.hidden || lost) return;
    const now = performance.now();
    if (paced() && now - lastR < FRAME30 - 4) return;   // a steady 30 on a 60 Hz panel; the game's logic still runs every frame
    if (lastR) { iv.push(now - lastR); FT.push(now - lastR); if (FT.length > 240) FT.shift(); }
    lastR = now; fit(false); renderer.info.reset();
    if (!direct()) return render0(dt);
    if (++drawn % SHADOW_EVERY === 0) renderer.shadowMap.needsUpdate = true;
    mirror(); renderer.setRenderTarget(null); renderer.render(scn, rp.camera);   // tone mapping and sRGB happen in the materials when drawing to the canvas
  };

  // a lost context: three.js restores it; show a note meanwhile, then come back one tier lower in auto
  let note = null;
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault(); lost = true; QUALITY.lost++;
    if (!note) { note = document.createElement('div'); note.className = 'q-msg note'; note.textContent = T(tr('جارٍ إعادة تحميل الرسوميات…', 'Reloading graphics…')); document.body.appendChild(note); }
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; note?.remove(); note = null; lastR = 0;
    if (!(QUALITY.mode === 'auto' && !force && step(-1))) { shadows(); fit(true); }
  });

  // the menu button: cycles Auto → High → Medium → Low → Board
  const host = document.querySelector('#menu .toggles'); let btn = null;
  if (host) {
    host.style.flexWrap = 'wrap'; btn = document.createElement('button'); btn.id = 'tg-quality'; btn.style.flexBasis = '100%'; host.appendChild(btn);
    btn.onclick = () => {
      QUALITY.mode = MODES[(MODES.indexOf(QUALITY.mode) + 1) % MODES.length];
      try { localStorage.setItem(KEY, QUALITY.mode); } catch (e) { /* private mode: the choice lasts this visit */ }
      flip.tier = { n: 0, d: 0 }; flip.scale = { n: 0, d: 0 }; QUALITY.locked = false; scale = 1; probing = 0;
      apply(QUALITY.mode === 'auto' ? QUALITY.device : QUALITY.mode);
    };
  }
  function label() { if (btn) btn.textContent = `${T(LABEL)}: ${T(NAME[QUALITY.mode])}` + (QUALITY.mode === 'auto' ? ` · ${T(NAME[tier])}` : ''); }
  onLang(label);

  /* auto, in 0.5 s windows once the loader is gone. Budget per drawn frame: 33.3 ms on the paced tiers, 16.7 ms otherwise (never
     under the panel's own refresh). Three bad windows in a row: resolution −15% (floor 0.6), and at the floor a tier down; a window
     over 2× the budget twice in a row drops a tier at once. Ten good windows (5 s): back to full resolution in one step (every change of the
     buffer size is a visible blink, so there are as few as possible). At full resolution, 20 good windows (10 s; longer
     after each flip-flop) try a tier up; a paced tier first runs 1 s uncapped and must reach about 55 fps. 3 reversals lock it. */
  const flip = { tier: { n: 0, d: 0 }, scale: { n: 0, d: 0 } }, raf = [], probe = [];
  let vs = 20, t0 = 0, tPrev = 0, bad = 0, good = 0, skip = 2, probeAt = 0, sev = 0;
  function turn(f, d) {   // false = locked; the last allowed move after the 3rd reversal is a step down
    if (f.locked) return false;
    if (f.d && d !== f.d) f.n++; f.d = d;
    if (f.n >= 3) { f.locked = true; QUALITY.locked = !!flip.tier.locked; return d < 0; }
    return true;
  }
  function setScale(s) {
    s = Math.min(1, Math.max(.6, s)); if (s === scale || (Math.abs(s - scale) < scale * .045 && s !== 1 && s !== .6)) return false;
    if (!turn(flip.scale, s > scale ? 1 : -1)) return false;
    scale = QUALITY.scale = s; fit(true); skip = 2; good = 0; return true;
  }
  function step(d) {
    const i = TIERS.indexOf(tier) + d; if (i < 0 || i >= TIERS.length || !turn(flip.tier, d)) return false;
    scale = 1; apply(TIERS[i]); return true;
  }
  function tick(t) {
    requestAnimationFrame(tick);
    if (tPrev) raf.push(t - tPrev); tPrev = t; if (!t0) t0 = t;
    if (t - t0 < 500) return;
    t0 = t; const w = iv.splice(0);
    if (raf.length > 5) vs = Math.max(4, Math.min(vs, pct(raf, .1)));   // the panel's refresh period (paced tiers show it on their idle frames)
    raf.length = 0;
    if (force || QUALITY.mode !== 'auto' || w.length < 3) return;
    if (skip > 0) { skip--; return; }
    if (probing) {   // an uncapped second on a paced tier: is there clear headroom for the next tier?
      probe.push(...w); if (t < probing) return;
      const pm = med(probe); probing = 0; probeAt = t; good = 0;
      if (pm <= Math.max(vs, 1000 / 60) * 1.1) step(1);
      return;
    }
    const im = med(w), budget = LEVEL[tier].pace ? vs * Math.ceil((FRAME30 - 4) / vs) : Math.max(1000 / 60, vs);
    // one very slow window is usually a single heavy moment (a landing's dust, a new chapter): only two in a row count as severe
    sev = im > budget * 2 ? sev + 1 : 0; const severe = sev >= 2;
    if (im > budget * 1.15) {
      good = 0;
      if (++bad >= 3 || severe) { bad = 0; if (!((severe || scale <= .6) && step(-1))) setScale(severe ? .6 : scale * .85); }   // 1.5 s of real trouble, not one busy moment
      return;
    }
    bad = 0; good = im <= budget * 1.05 ? good + 1 : 0;
    if (scale < 1) { if (good >= 10) setScale(1); }   // back to full resolution in one step: creeping up 5 % at a time was a visible blink every few seconds
    else if (good >= 20 << flip.tier.n && tier !== 'high' && !flip.tier.locked) {   // 10 s steady before a tier up: every tier change is a visible change of look
      if (!LEVEL[tier].pace) step(1);
      else if (t - probeAt > 20000) { probing = t + 1000; probe.length = 0; skip = 0; }
    }
  }
  document.addEventListener('visibilitychange', () => { lastR = 0; tPrev = 0; t0 = 0; iv.length = 0; skip = 2; probing = 0; });   // a hidden tab stops frames: don't count the gap

  apply(tier);
  requestAnimationFrame(shadows);   // again once the scene's lights exist
  // start measuring once the loading ring (bootWhenLoaded's #loader) has come and gone, so uploads don't count as slow
  // (not whenLoaded(): it drains the engine's pending list, and the loader would then stop waiting for those assets)
  let seen = false;
  const waitBoot = () => {
    const l = document.getElementById('loader'); if (l) seen = true;
    if ((seen && !l) || performance.now() > 30000) { shadows(); iv.length = 0; skip = 2; requestAnimationFrame(tick); } else setTimeout(waitBoot, 400);
  };
  waitBoot();

  // ?debug=1: renderer, buffer, tier, scale, fps and draw counts
  if (P.get('debug') === '1') {
    const el = document.createElement('div'); el.id = 'q-debug'; document.body.appendChild(el);
    setInterval(() => {
      stats(); const i = renderer.info.render;
      el.textContent = [QUALITY.gpu || '(renderer string hidden)',
        `buffer ${canvas.width}×${canvas.height} (${(canvas.width * canvas.height / 1e6).toFixed(2)} MP)  css ${innerWidth}×${innerHeight}  dpr ${dpr()}`,
        `tier ${tier}  mode ${QUALITY.mode}  device ${QUALITY.device}  scale ${scale.toFixed(2)}  pr ${PR.toFixed(3)}${direct() ? '  direct' : ''}${paced() ? '  30 fps' : ''}${QUALITY.locked ? '  locked' : ''}`,
        `fps median ${QUALITY.fpsMed}  p10 ${QUALITY.fpsP10}`, `triangles ${i.triangles}  calls ${i.calls}`].join('\n');
    }, 500);
  }
  window.__quality = QUALITY;
  return QUALITY;
}
