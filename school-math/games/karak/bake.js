// Baked light for the weak tiers (board, low): the sun's shadow and the sky's occlusion, computed once offline and
// stored per vertex (plus a world-space ground map), so a weak GPU draws no shadow map, no GTAO and no bloom and the
// world still has its shadows. Generic: any world can use it (see tools/bake-karak.mjs for the recipe).
//
// Runtime (the world, on board/low):
//   bakeAttr(obj)                   give a mesh (or InstancedMesh: one value per instance) its 'bake' attribute, all lit
//   bakedMat(mat, map?)             a clone of a MeshStandardMaterial whose sun is multiplied by bake.x and whose
//                                   ambient (hemisphere + environment) by bake.y; with map = { u, box } it reads a
//                                   top-down ground map at the fragment's world x, z instead (inside the box)
//   groundMap({ x0, z0, x1, z1 })   the map's uniforms, a white 1×1 until the data arrives
//   loadBake(url, list, maps)       fetch <url>.json + <url>.bin and fill the attributes and maps
// Bake time (karak/bake.html in headless Chromium on the GPU):
//   tess(geo, L)                    split every edge longer than L metres (crack-free), then index: per-vertex light
//                                   needs vertices close enough together; the runtime builds the same geometry
//   bakeGPU(renderer, { list, maps, occluders, sun, lift }) → { index, bytes }
//     For each direction: an orthographic depth map of the occluders, then every sample point (a vertex, an instance,
//     a map texel) drawn as one pixel that tests itself against it, summed with additive blending.
//     sun  32 directions jittered inside a 1.2° cone around the sun: soft visibility 0…1
//     sky  256 directions over the upper hemisphere, weighted by max(n·d, 0): the fraction of the sky the point sees
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/* ======================================================================
   Runtime
   ====================================================================== */
export function bakeAttr(obj) {
  const g = obj.geometry, n = obj.isInstancedMesh ? obj.count : g.attributes.position.count, a = new Uint8Array(n * 2).fill(255);
  g.setAttribute('bake', obj.isInstancedMesh ? new THREE.InstancedBufferAttribute(a, 2, true) : new THREE.BufferAttribute(a, 2, true));
  obj.castShadow = obj.receiveShadow = false;
  return obj;
}
export function groundMap({ x0, z0, x1, z1 }) {
  const t = new THREE.DataTexture(new Uint8Array([255, 255]), 1, 1, THREE.RGFormat); t.unpackAlignment = 1; t.needsUpdate = true;
  // uBakeInv: scene → the world's own frame (identity unless the world is placed with a transform, e.g. mirrored)
  return { box: { x0, z0, x1, z1 }, u: { uBakeMap: { value: t }, uBakeBox: { value: new THREE.Vector4(x0, z0, 1 / (x1 - x0), 1 / (z1 - z0)) }, uBakeSize: { value: new THREE.Vector2(x1 - x0, z1 - z0) }, uBakeInv: { value: new THREE.Matrix4() } } };
}
// one clone per (material, map): meshes sharing a material keep sharing its baked twin
const twins = new WeakMap();
export function bakedMat(mat, map = null) {
  let per = twins.get(mat); if (!per) twins.set(mat, per = new Map());
  if (per.has(map)) return per.get(map);
  const m = mat.clone(), prev = mat.onBeforeCompile, key = mat.customProgramCacheKey.call(mat);
  m.onBeforeCompile = (s, r) => {
    prev.call(m, s, r);
    if (map) Object.assign(s.uniforms, map.u);
    const lb = THREE.ShaderChunk.lights_fragment_begin, dl = 'getDirectionalLightInfo( directionalLight, directLight );';
    if (!lb.includes(dl)) console.warn('bake: three.js light chunk changed, the baked sun is off');
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 bake; varying vec2 vBake;' + (map ? ' varying vec3 vBakeW; uniform mat4 uBakeInv;' : ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBake = bake;' + (map ? ' vBakeW = (uBakeInv * modelMatrix * vec4(transformed, 1.)).xyz;' : ''));
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vBake;' + (map ? ' varying vec3 vBakeW; uniform sampler2D uBakeMap; uniform vec4 uBakeBox; uniform vec2 uBakeSize;' : ''))
      .replace('#include <lights_fragment_begin>', 'vec2 bakeK = vBake;\n' + (map ? `{ vec2 bu = (vBakeW.xz - uBakeBox.xy) * uBakeBox.zw, e = min(bu, 1. - bu) * uBakeSize;
        bakeK = mix(bakeK, texture2D(uBakeMap, bu).rg, clamp(min(e.x, e.y) / 4., 0., 1.)); }\n` : '') + lb.replace(dl, dl + ' directLight.color *= bakeK.x;'))
      // the sky's share: never fully black (light bounces off the pale stone)
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n{ float bakeAO = .2 + .8 * bakeK.y; reflectedLight.indirectDiffuse *= bakeAO; reflectedLight.indirectSpecular *= bakeAO; }');
  };
  m.customProgramCacheKey = () => key + '|baked' + (map ? '+map' : '');
  per.set(map, m); return m;
}
/** Fill the bake attributes (by stable id) and the ground maps. A mesh whose vertex count changed since the bake keeps
    its all-lit default (a warning, not an error): re-run the bake after editing the world's geometry. */
export async function loadBake(url, list, maps = []) {
  const [ix, buf] = await Promise.all([fetch(url + '.json').then(r => r.json()), fetch(url + '.bin').then(r => r.arrayBuffer())]);
  const u8 = new Uint8Array(buf), byId = new Map(list.map(e => [e.id, e])), stale = [];
  let n = 0;
  for (const e of ix.entries) {
    const a = byId.get(e.id)?.obj.geometry.attributes.bake;
    if (!a || a.count !== e.n) { stale.push(e.id); continue; }
    a.array.set(u8.subarray(e.at, e.at + e.n * 2)); a.needsUpdate = true; n++;
  }
  for (const e of ix.maps) {
    const M = maps.find(m => m.id === e.id); if (!M) { stale.push(e.id); continue; }
    const t = new THREE.DataTexture(u8.slice(e.at, e.at + e.nx * e.nz * 2), e.nx, e.nz, THREE.RGFormat);
    t.unpackAlignment = 1; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
    M.u.uBakeMap.value = t; M.u.uBakeBox.value.set(e.x0, e.z0, 1 / (e.x1 - e.x0), 1 / (e.z1 - e.z0)); M.u.uBakeSize.value.set(e.x1 - e.x0, e.z1 - e.z0); n++;
  }
  if (stale.length) console.warn('bake: stale or unknown entries (re-run the bake):', stale.join(', '));
  return { loaded: n, stale, bytes: u8.length };
}

/* ======================================================================
   Bake time
   ====================================================================== */
/** Split every edge longer than L (all triangles that share an edge split it at the same midpoint, so no cracks),
    then merge equal vertices. Deterministic: the runtime and the bake get the same vertices in the same order.
    drop(a, b, c) → true removes a finished triangle (e.g. buried in the ground: never seen, and it would bake black). */
export function tess(geo, L, drop = null) {
  const g = geo.index ? geo.toNonIndexed() : geo, names = Object.keys(g.attributes), A = names.map(k => g.attributes[k]);
  const nOff = names.includes('normal') ? A.slice(0, names.indexOf('normal')).reduce((s, a) => s + a.itemSize, 0) : -1;
  const rec = i => { const r = []; for (const a of A) for (let k = 0; k < a.itemSize; k++) r.push(a.array[i * a.itemSize + k]); return r; };
  const P = g.attributes.position; let tris = [];
  for (let i = 0; i < P.count; i += 3) tris.push([rec(i), rec(i + 1), rec(i + 2)]);
  const vk = p => Math.round(p[0] * 1000) + ',' + Math.round(p[1] * 1000) + ',' + Math.round(p[2] * 1000);
  const ek = (p, q) => { const a = vk(p), b = vk(q); return a < b ? a + '|' + b : b + '|' + a; };
  const len = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  const mid = (p, q) => { const m = p.map((v, k) => (v + q[k]) / 2); if (nOff >= 0) { const l = Math.hypot(m[nOff], m[nOff + 1], m[nOff + 2]) || 1; for (let k = 0; k < 3; k++) m[nOff + k] /= l; } return m; };
  for (let pass = 0; pass < 24; pass++) {
    const cut = new Set();
    for (const t of tris) for (let e = 0; e < 3; e++) if (len(t[e], t[(e + 1) % 3]) > L) cut.add(ek(t[e], t[(e + 1) % 3]));
    if (!cut.size) break;
    const next = [];
    for (const t of tris) {
      const c = [0, 1, 2].map(e => cut.has(ek(t[e], t[(e + 1) % 3]))), n = c[0] + c[1] + c[2];
      if (!n) { next.push(t); continue; }
      // rotate so the pattern is canonical: one cut → edge 0; two cuts → edges 0 and 1
      const r = n === 1 ? c.indexOf(true) : n === 2 ? (c.indexOf(false) + 1) % 3 : 0, [a, b, d] = [t[r], t[(r + 1) % 3], t[(r + 2) % 3]];
      const ab = mid(a, b), bd = mid(b, d), da = mid(d, a);
      if (n === 1) next.push([a, ab, d], [ab, b, d]);
      else if (n === 2) next.push([ab, b, bd], [a, ab, bd], [a, bd, d]);
      else next.push([a, ab, da], [ab, b, bd], [da, bd, d], [ab, bd, da]);
    }
    tris = next;
  }
  if (drop) tris = tris.filter(t => !drop(t[0], t[1], t[2]));
  const out = new THREE.BufferGeometry(); let o = 0;
  A.forEach((a, j) => {
    const arr = new Float32Array(tris.length * 3 * a.itemSize); let w = 0;
    for (const t of tris) for (const v of t) for (let k = 0; k < a.itemSize; k++) arr[w++] = v[o + k];
    o += a.itemSize; out.setAttribute(names[j], new THREE.BufferAttribute(arr, a.itemSize));
  });
  return mergeVertices(out);
}

const fib = (i, n) => [(i + .5) / n, i * Math.PI * (3 - Math.sqrt(5))];   // evenly spread points: [t ∈ (0,1), angle]
export async function bakeGPU(renderer, { list, maps = [], occluders, sun, lift = null, nSky = 256, nSun = 32, cone = .021, offset = .3, bias = .12, size = 8192, log = () => {} }) {
  const gl = renderer.getContext();
  if (!renderer.extensions.has('EXT_float_blend') || !renderer.extensions.has('EXT_color_buffer_float')) throw new Error('bake: needs EXT_float_blend + EXT_color_buffer_float (run it on the GPU)');
  size = Math.min(size, renderer.capabilities.maxTextureSize);
  /* ---------- the sample points: position (pushed off the surface along its normal, never under the ground) and normal ---------- */
  const P = [], N = [], entries = [], mapsOut = [], v = new THREE.Vector3(), nv = new THREE.Vector3(), m4 = new THREE.Matrix4(), sc = new THREE.Vector3(), nm = new THREE.Matrix3();
  const push = (p, n) => { const x = p.x + n.x * offset, z = p.z + n.z * offset; let y = p.y + n.y * offset; if (lift) y = Math.max(y, lift(x, z) + .2); P.push(x, y, z); N.push(n.x, n.y, n.z); };
  for (const { id, obj: o } of list) {
    o.updateMatrixWorld(true); const at = P.length / 3;
    if (o.isInstancedMesh) {   // one sample just above each instance (merlons, a stone pile)
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld); v.setFromMatrixPosition(m4); sc.setFromMatrixScale(m4); v.y += sc.y * .5 - offset + .15; push(v, nv.set(0, 1, 0)); }
    } else {
      const pos = o.geometry.attributes.position, nor = o.geometry.attributes.normal; nm.getNormalMatrix(o.matrixWorld);
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); nv.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); push(v, nv); }
    }
    entries.push({ id, n: P.length / 3 - at, first: at });
  }
  for (const M of maps) {   // a texel grid over the box, each texel on the real surface (M.at(x, z) → { p, n })
    const nx = Math.round((M.x1 - M.x0) / M.res), nz = Math.round((M.z1 - M.z0) / M.res), at = P.length / 3;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const s = M.at(M.x0 + (i + .5) * M.res, M.z0 + (j + .5) * M.res); push(s.p, s.n); }
    mapsOut.push({ id: M.id, x0: M.x0, z0: M.z0, x1: M.x0 + nx * M.res, z1: M.z0 + nz * M.res, nx, nz, first: at });
  }
  const NP = P.length / 3, W = 2048, H = Math.ceil(NP / W);
  log(`${NP} sample points, depth maps ${size}²`);

  /* ---------- the occluders' depth scene ---------- */
  const occ = new THREE.Scene(), dm = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false }), box = new THREE.Box3();
  for (const o of occluders) {
    o.updateMatrixWorld(true);
    const c = o.isInstancedMesh ? new THREE.InstancedMesh(o.geometry, dm, o.count) : new THREE.Mesh(o.geometry, dm);
    if (o.isInstancedMesh) c.instanceMatrix = o.instanceMatrix;
    c.matrixAutoUpdate = false; c.matrix.copy(o.matrixWorld); c.matrixWorld.copy(o.matrixWorld); c.frustumCulled = false; occ.add(c);
    if (!o.isInstancedMesh) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); }
  }
  for (let i = 0; i < NP; i++) box.expandByPoint(v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]));
  const depth = new THREE.WebGLRenderTarget(size, size, { depthTexture: new THREE.DepthTexture(size, size, THREE.FloatType), type: THREE.UnsignedByteType });
  const acc = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });

  /* ---------- the gather: one point per sample, written to its own pixel ---------- */
  const pg = new THREE.BufferGeometry(), idx = new Float32Array(NP); for (let i = 0; i < NP; i++) idx[i] = i;
  pg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); pg.setAttribute('nrm', new THREE.Float32BufferAttribute(N, 3)); pg.setAttribute('idx', new THREE.BufferAttribute(idx, 1));
  const U = { uDepth: { value: depth.depthTexture }, uLight: { value: new THREE.Matrix4() }, uDir: { value: new THREE.Vector3() }, uBias: { value: 0 }, uSky: { value: 0 }, uK: { value: 1 }, uGrid: { value: new THREE.Vector2(W, H) } };
  const gm = new THREE.ShaderMaterial({
    uniforms: U, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
    vertexShader: `uniform sampler2D uDepth; uniform mat4 uLight; uniform vec3 uDir; uniform float uBias, uSky, uK; uniform vec2 uGrid;
      attribute vec3 nrm; attribute float idx; varying vec3 vOut;
      void main(){ vec4 l = uLight * vec4(position, 1.); vec3 c = l.xyz / l.w * .5 + .5;
        float vis = (c.z - uBias <= texture2D(uDepth, c.xy).r) ? 1. : 0.;
        if (any(lessThan(c.xy, vec2(0.))) || any(greaterThan(c.xy, vec2(1.)))) vis = 1.;
        float w = max(dot(nrm, uDir), 0.);
        vOut = uSky > .5 ? vec3(0., vis * w, w) * uK : vec3(vis * uK, 0., 0.);
        float x = mod(idx, uGrid.x), y = floor(idx / uGrid.x);
        gl_Position = vec4((x + .5) / uGrid.x * 2. - 1., (y + .5) / uGrid.y * 2. - 1., 0., 1.); gl_PointSize = 1.; }`,
    fragmentShader: `varying vec3 vOut; void main(){ gl_FragColor = vec4(vOut, 1.); }`,
  });
  const pts = new THREE.Points(pg, gm); pts.frustumCulled = false; const ps = new THREE.Scene(); ps.add(pts);

  /* ---------- the directions ---------- */
  const dirs = [], s0 = sun.clone().normalize(), t1 = new THREE.Vector3().crossVectors(s0, Math.abs(s0.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize(), t2 = new THREE.Vector3().crossVectors(s0, t1);
  for (let i = 0; i < nSun; i++) { const [t, a] = fib(i, nSun), r = Math.sqrt(t) * cone; dirs.push({ d: s0.clone().addScaledVector(t1, Math.cos(a) * r).addScaledVector(t2, Math.sin(a) * r).normalize(), sky: 0 }); }
  for (let i = 0; i < nSky; i++) { const [y, a] = fib(i, nSky), r = Math.sqrt(1 - y * y); dirs.push({ d: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), sky: 1 }); }

  const cam = new THREE.OrthographicCamera(), C = box.getCenter(new THREE.Vector3()), R = box.getSize(new THREE.Vector3()).length() / 2;
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(k => new THREE.Vector3(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z));
  const auto = renderer.autoClear, cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
  renderer.autoClear = false; renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(acc); renderer.clear(true, false, false);
  for (let k = 0; k < dirs.length; k++) {
    const { d, sky } = dirs[k];
    cam.position.copy(C).addScaledVector(d, R + 20); cam.up.set(Math.abs(d.y) > .99 ? 1 : 0, Math.abs(d.y) > .99 ? 0 : 1, 0); cam.lookAt(C); cam.updateMatrixWorld(true);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const c of corners) { v.copy(c).applyMatrix4(cam.matrixWorldInverse); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); z0 = Math.min(z0, -v.z); z1 = Math.max(z1, -v.z); }
    Object.assign(cam, { left: x0, right: x1, bottom: y0, top: y1, near: Math.max(.1, z0 - 1), far: z1 + 1 }); cam.updateProjectionMatrix();
    renderer.setRenderTarget(depth); renderer.clear(true, true, false); renderer.render(occ, cam);
    U.uLight.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); U.uDir.value.copy(d);
    U.uBias.value = bias / (cam.far - cam.near); U.uSky.value = sky; U.uK.value = 1 / (sky ? nSky : nSun);
    renderer.setRenderTarget(acc); renderer.render(ps, cam);
    if (k % 16 === 15) { gl.finish(); log(`${k + 1}/${dirs.length} directions`); await new Promise(r => setTimeout(r, 0)); }
  }
  const out = new Float32Array(W * H * 4); renderer.readRenderTargetPixels(acc, 0, 0, W, H, out);
  renderer.setRenderTarget(null); renderer.autoClear = auto; renderer.setClearColor(cc, ca);
  depth.dispose(); acc.dispose(); pg.dispose(); gm.dispose(); dm.dispose();

  /* ---------- encode: two bytes per sample (sun visibility, sky visibility); a point that faces no sky at all
     (the underside of a vault) reads as 0.3 ---------- */
  const bytes = new Uint8Array(NP * 2), e0 = .01;
  for (let i = 0; i < NP; i++) {
    const sunV = Math.min(1, out[i * 4]), skyV = (out[i * 4 + 1] + .3 * e0) / (out[i * 4 + 2] + e0);
    bytes[i * 2] = Math.round(Math.min(1, Math.max(0, sunV)) * 255); bytes[i * 2 + 1] = Math.round(Math.min(1, Math.max(0, skyV)) * 255);
  }
  const index = {
    entries: entries.map(e => ({ id: e.id, n: e.n, at: e.first * 2 })),
    maps: mapsOut.map(m => ({ id: m.id, x0: m.x0, z0: m.z0, x1: m.x1, z1: m.z1, nx: m.nx, nz: m.nz, at: m.first * 2 })),
    samples: NP, dirs: { sun: nSun, sky: nSky, cone }, depthMap: size, bytes: bytes.length,
  };
  return { index, bytes };
}
