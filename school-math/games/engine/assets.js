// Lesson-games engine — real assets. CC0 photo textures (PBR sets), HDRI environments and glTF
// models from Poly Haven, stored in ../assets/ (see ../assets/README.md). Materials come back at once
// and fill in as their images load; whenLoaded() resolves when everything requested so far is in
// (the ?shot cover waits on it). Call initAssets(renderer) once before anything else.
// Per device tier (quality.js detectTier, ?q=<tier> forces it) a lighter variant is loaded when
// tools/build-assets.mjs has built one (listed in assets/variants.json), else the original:
//   high → the originals; medium → "mid" (≈50% triangles, KTX2 ≤1024); low and board → "low" (≈20%, KTX2 ≤512).
// window.__assetsTier shows what was chosen (tests read it).
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
// the models are compressed (gltf-transform: meshopt geometry, WebP textures, 2026-09-13); this decodes them
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const BASE = new URL('../assets/', import.meta.url).href;
// the Basis transcoder for KTX2, from the same CDN and version as three
const TRANSCODER = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/basis/';
const VARIANT = { high: null, medium: 'mid', low: 'low', board: 'low' };
const pending = [], texCache = new Map(), gltfCache = new Map(), listeners = new Set();
let reqN = 0, doneN = 0;
// every load is counted, so a loading screen can show real progress
const track = p => { reqN++; const q = p.catch(() => {}); q.then(() => { doneN++; listeners.forEach(f => f(doneN, reqN)); }); return q; };
export const onAssetProgress = f => { listeners.add(f); f(doneN, reqN); };
const texLoader = new THREE.TextureLoader(), gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
let renderer = null, aniso = 8, ktx2 = null;
// what was chosen, for tests: tier, variant, models { name: 'mid' | 'low' | '1k' }, textures { set_map: 'ktx2 512' | 'jpg' }
const ASSETS = { tier: null, variant: null, models: {}, textures: {}, ktx2: { loaded: 0, failed: 0 } };
// resolves to { variant, manifest } once the tier is known; every model and pbr() load waits on it
let ready = Promise.resolve({ variant: null, manifest: null });

export function initAssets(r) {
  renderer = r; aniso = Math.min(16, r.capabilities.getMaxAnisotropy());
  Object.defineProperty(ASSETS, 'renderer', { value: r, configurable: true });
  window.__assetsTier = ASSETS;
  // quality.js is imported late on purpose: it imports ui.js, which imports this file
  ready = import('./quality.js').then(q => q.detectTier(r)).catch(() => 'high').then(tier => {
    const variant = VARIANT[tier] ?? null;
    ASSETS.tier = tier; ASSETS.variant = variant;
    if (!variant) return { variant: null, manifest: null };
    ktx2 = new KTX2Loader().setTranscoderPath(TRANSCODER).detectSupport(r);
    gltfLoader.setKTX2Loader(ktx2);
    return fetch(BASE + 'variants.json').then(res => (res.ok ? res.json() : null)).catch(() => null).then(manifest => ({ variant, manifest }));
  });
  pending.push(track(ready));
}
export const whenLoaded = () => Promise.all(pending.splice(0)).then(() => pending.length ? whenLoaded() : undefined);

// one decode per file, shared by every use
function once(path, load) {
  if (!texCache.has(path)) { const p = load(BASE + path); texCache.set(path, p); pending.push(track(p)); }
  return texCache.get(path);
}
// a placeholder texture takes over a decoded KTX2 texture: it becomes compressed and shares the mip chain
// (and so the GPU upload), and keeps its own repeat/offset
function adopt(t, k) {
  t.isCompressedTexture = true; t.source = k.source; t.mipmaps = k.mipmaps; t.format = k.format; t.type = k.type;
  t.minFilter = k.minFilter; t.magFilter = k.magFilter; t.generateMipmaps = false; t.flipY = false; t.needsUpdate = true;
}
function image(name, m, srgb) {
  // each use gets its own texture object (own repeat/offset) sharing the one decoded image
  const t = new THREE.Texture(); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
  const jpg = () => once(`textures/${name}/${name}_${m}_1k.jpg`, u => texLoader.loadAsync(u)).then(src => { if (src) { t.image = src.image; t.needsUpdate = true; } });
  const p = ready.then(({ variant, manifest }) => {
    const px = variant && ktx2 && manifest?.textures?.[name]?.[m]?.[variant];
    ASSETS.textures[`${name}_${m}`] = px ? `ktx2 ${px}` : 'jpg';
    if (!px) return jpg();
    // KTX2 files are stored flipped, so flipY = false shows them the same way round as the JPEG
    return once(`textures/${name}/${name}_${m}_${px}.ktx2`, u => ktx2.loadAsync(u)).then(k => {
      if (k) { adopt(t, k); ASSETS.ktx2.loaded++; return; }
      ASSETS.ktx2.failed++; ASSETS.textures[`${name}_${m}`] = 'jpg'; return jpg();
    });
  });
  pending.push(p.catch(() => {}));
  return t;
}
/** A PBR material from a texture set (textures/<name>/<name>_{diff,nor_gl,rough,ao}_1k.jpg, or its KTX2 variant).
    repeat: [u, v] tiles across the surface's UVs. Extra options go to MeshStandardMaterial. */
export function pbr(name, { repeat = [1, 1], offset = [0, 0], rotation = 0, normalScale = 1, ao = 1, maps = ['diff', 'nor_gl', 'rough', 'ao'], ...o } = {}) {
  const set = t => { t.repeat.set(...repeat); t.offset.set(...offset); t.rotation = rotation; return t; };
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, ...o });
  if (maps.includes('diff')) mat.map = set(image(name, 'diff', true));
  if (maps.includes('nor_gl')) { mat.normalMap = set(image(name, 'nor_gl', false)); mat.normalScale.set(normalScale, normalScale); }
  if (maps.includes('rough')) mat.roughnessMap = set(image(name, 'rough', false));
  if (maps.includes('ao') && ao) { mat.aoMap = set(image(name, 'ao', false)); mat.aoMapIntensity = ao; }
  return mat;
}
/** An HDRI (hdri/<name>_1k.hdr) prefiltered for lighting and reflections: scene.environment = await hdri(…). */
export function hdri(name) {
  const p = new RGBELoader().loadAsync(BASE + `hdri/${name}_1k.hdr`).then(eq => {
    eq.mapping = THREE.EquirectangularReflectionMapping;
    const pm = new THREE.PMREMGenerator(renderer), env = pm.fromEquirectangular(eq).texture; pm.dispose(); return env;
  });
  pending.push(track(p)); return p;
}
/** A glTF model (models/<name>/<name>_1k.gltf, or <name>_mid / <name>_low by tier) as a fresh clone;
    casts and receives shadows. Poly Haven models are in metres, sitting on y = 0. */
export function model(name, { shadows = true } = {}) {
  if (!gltfCache.has(name)) {
    const orig = () => { ASSETS.models[name] = '1k'; return gltfLoader.loadAsync(BASE + `models/${name}/${name}_1k.gltf`); };
    const p = ready.then(({ variant, manifest }) => {
      if (!variant || !manifest?.models?.[name]?.includes(variant)) return orig();
      ASSETS.models[name] = variant;
      return gltfLoader.loadAsync(BASE + `models/${name}/${name}_${variant}.gltf`).then(g => {
        const seen = new Set();
        g.scene.traverse(o => { if (o.isMesh) for (const k in o.material) { const v = o.material[k]; if (v?.isCompressedTexture && !seen.has(v)) { seen.add(v); ASSETS.ktx2.loaded++; } } });
        return g;
      }, orig);
    });
    gltfCache.set(name, p); pending.push(track(p));
  }
  return gltfCache.get(name).then(g => {
    const s = g.scene.clone(true);
    s.traverse(o => { if (o.isMesh) { o.castShadow = shadows; o.receiveShadow = true; if (o.material.map) o.material.map.anisotropy = aniso; } });
    return s;
  });
}
/** Place a model: returns a group at pos with rotation y and uniform scale; the model loads into it. */
export function prop(scene, name, pos, { rotY = 0, scale = 1, tint = null, shadows = true } = {}) {
  const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = rotY; g.scale.setScalar(scale); scene.add(g);
  model(name, { shadows }).then(m => { if (tint) m.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(tint)); } }); g.add(m); });
  return g;
}
