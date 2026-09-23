// Lesson-games engine — pointer input. These games live on a website: everything is mouse/touch
// (click, drag, hover), never keyboard holds. A beat installs a handler with awaitInput() and the
// promise resolves when its done-test passes; a rewind (E.RUN bump) removes the handler cleanly.
import * as THREE from 'three';
import { E, ABORT, hooks } from './core.js';

let canvas = null, camera = null, INPUT = null;
export const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
export function initInput(c, cam) {
  canvas = c; camera = cam;
  canvas.addEventListener('pointerdown', e => { if (E.PAUSED) return; canvas.setPointerCapture(e.pointerId); INPUT?.down?.(e); });
  canvas.addEventListener('pointermove', e => { if (!E.PAUSED) INPUT?.move?.(e); });
  addEventListener('pointerup', e => { if (!E.PAUSED) INPUT?.up?.(e); });
}
/** A handler that stays until replaced (a sandbox's input): { down(e), move(e), up(e) }. */
export const setInput = h => { INPUT = h; };
export const setCursor = c => { if (canvas) canvas.style.cursor = c; };
export function setNdc(e) { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
/** The nearest hit among objects under the pointer, or null. */
export const pick = (e, objects) => { setNdc(e); return ray.intersectObjects(objects, true)[0] || null; };
/** Where the pointer meets the horizontal plane y = h (for dragging things along the ground). */
export function floorHit(e, h = 0) { setNdc(e); plane.constant = -h; const p = new THREE.Vector3(); return ray.ray.intersectPlane(plane, p) ? p : null; }
/** Install handler until doneFn() is true; rejects with ABORT on rewind. */
export function awaitInput(handler, doneFn) {
  const tok = E.RUN; INPUT = handler;
  return new Promise((res, rej) => {
    const h = () => {
      if (tok !== E.RUN) { hooks.delete(h); if (INPUT === handler) INPUT = null; rej(ABORT); return; }
      if (doneFn()) { hooks.delete(h); if (INPUT === handler) INPUT = null; setCursor('default'); res(); }
    };
    hooks.add(h);
  });
}
