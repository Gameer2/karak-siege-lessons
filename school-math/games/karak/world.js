// Karak Castle — the shared world of the series «منجنيق قلعة الكرك» (Jordan Grade 9, one game per book lesson:
// karak-arc = 2.3, karak-move = 2.4, karak-land = 3.1; later karak-factor = 3.2, then 3.3 and 3.4). The games'
// shared kit (renderer, beats, board, workshop) is ./stage.js. The real Crusader castle (1142) on the ridge above Wadi Karak:
// dark brown rubble walls, a sloping glacis, a rock-cut moat on the town side, long vaulted halls, the pale
// Mamluk keep at the south end, the town on the hill to the north. A counterweight trebuchet in the north court
// throws stones over the north wall, across the moat, onto the ridge. Everything is in metres.
//
// ============================== API (read this first) ==============================
// import { buildKarak, makeTrebuchet, makeFlight, makeStone, graphGrid, groundH, WALL, MOAT, COURT, SHOTS, shot,
//          SUN, RELEASE_Y } from '../karak/world.js';
//
// Coordinates. The throw plane is z = 0. x runs north, measured from the trebuchet's release point (x = 0 when
// the trebuchet stands at its home), y is the height above the court floor (y = 0), so a stone's height is
// literally its y. The camera usually stands east (+z) looking west (−z): x then grows to the right, as on a graph.
//   COURT   the north court, x ∈ [−196, 20], |z| < 31, floor y = 0
//   WALL    the north curtain wall, x ∈ [20, 24], top y = 24 (merlons above that), glacis into the moat
//   MOAT    the dry moat cut in the rock, x ∈ [24, 44], floor y = −18; the ridge north of it is level with the
//           court (y = 0) from x = 44 to about 160, then rises to the town
//   Wadi Karak falls ~330 m on both sides (|z| > 31 by the castle, > 45 on the ridge); the Dead Sea basin is far west (−z)
//   RELEASE_Y = 14: the trebuchet releases its stone 14 m above the ground it stands on
// groundH(x, z) → the terrain height (pure maths)
// SHOTS[name] = { pos, look }: plane (the whole throw as a graph), trebuchet, court, ridge, landing, wall, overview,
//   cover. shot(name) returns fresh clones: cam.shot(s.pos, s.look).
//
// Build:  const K = buildKarak(scene, { lite: true, renderer })
//   renderer (or tier) picks the lighting: on the 'board' and 'low' tiers (engine/quality.js detectTier) the world
//   brings its own light, baked once offline (./baked/, tools/bake-karak.mjs): no sun shadow map, the static meshes
//   read a per-vertex sun + sky bake, the ground a 0.5 m map, the moving things get soft blob shadows. K.baked says so;
//   K.bakeReady resolves when the data is in. On 'medium' and 'high' nothing changes (real-time shadows, GTAO).
//   Changing the static geometry here means re-running the bake (a stale mesh only warns and stays unshadowed).
//   K.update(dt, t, camera)   every frame (dust, the sky follows the camera, banners)
//   K.mats                    { wall, ashlar, glacis, rock, dirt, floor, wood, woodR, iron, rope, hide, stone }
//   K.groups                  { castle, terrain, town, camp }
//   K.mantlet(x) → Group      a wooden mantlet (pavise wall) standing on the plane at x; .hit() knocks it down (tween it)
//   K.tower(x) → Group        a siege tower on the plane at x; .userData.top is its height
//   K.dust(p, k = 1)          a dust burst at p (a landing)
//   Everything glowing or transparent is tagged userData.noAO: hide it during a GTAO pass.
// const TB = makeTrebuchet(K)  the hero: frame, axle, tapered arm with iron bands, hinged counterweight box full of
//   stones, sling and pouch, windlass, trough, log rollers, a timber crib to raise it
//   TB.group                  add it to the scene
//   TB.place(s, lift)         roll it so its release point is x = s, and raise it on the crib to height lift
//   TB.release() → Vector3    the release point (s, RELEASE_Y + lift, 0)
//   TB.swing(u) → Vector3     the throw, u ∈ [0, 1] (0 cocked, 1 the stone leaves the pouch); returns the pouch
//   TB.settle(v)              after the release, v ∈ [0, 1]: the arm overshoots and comes to rest upright
//   TB.cock(w)                the crew winds it back down, w ∈ [0, 1] from rest upright to cocked
//   TB.pouch() → Vector3      where the pouch is now; TB.hitbox: meshes to pick the trebuchet with
// makeFlight(scene, { color, r, dashed, opacity }) → F   a glowing tube along y = f(x) in the plane z = 0
//   F.set(f, x0, x1)  F.progress(p ∈ [0, 1])  F.hide()  F.mesh
// makeStone(K) → Group        a rough stone (0.42 m) with a faint halo so it reads from far away
// graphGrid(scene, { x0, x1, y0, y1, step }) → Group   the graph's paper in the throw plane: a dark glass sheet with a
//   painted metric grid (5 m, 10 m bold) and thick arrowed axes; .userData.fade(k) shows it
// ================================================================================
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { V, clamp, lerp, canvasTex, hdr, NOISE_GLSL } from '../engine/core.js';
import { pbr, prop, hdri } from '../engine/assets.js';
import { detectTier, QUALITY } from '../engine/quality.js';
import { bakeAttr, bakedMat, groundMap, loadBake, tess } from './bake.js';
const BAKE_URL = new URL('./baked/karak', import.meta.url).href;   // made by tools/bake-karak.mjs

const rad = d => d * Math.PI / 180;
const rng = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7 + 17.3) * 43758.5453; return s - Math.floor(s); };
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const n2 = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return lerp(lerp(hash(xi, zi), hash(xi + 1, zi), u), lerp(hash(xi, zi + 1), hash(xi + 1, zi + 1), u), v); };
const fbm = (x, z) => n2(x, z) * .5 + n2(x * 2.07, z * 2.07) * .3 + n2(x * 4.3, z * 4.3) * .2;

/* ---------------- dimensions ---------------- */
export const COURT = { x0: -196, x1: 20, z: 31 };
export const WALL = { x0: 20, x1: 24, top: 24, z: 34 };
export const MOAT = { x0: 24, x1: 44, floor: -18 };
export const RELEASE_Y = 14;
export const SUN = V(-.42, .62, .66).normalize();   // morning: low light from the south-east, behind the usual camera
const EAST = { z0: 31, z1: 34, top: 3 }, WEST = { z0: -34, z1: -31, top: 14 };

/** The terrain: the flat crest (the court and the ridge, y = 0), the rock-cut moat, the fall into Wadi Karak on
    both sides, the far plateau, the town's hill rising to the north. */
export function groundH(x, z) {
  const inCastle = x > COURT.x0 - 8 && x < MOAT.x0;
  let w = inCastle ? 32.5 : x >= MOAT.x0 ? 44 + 26 * sstep(150, 420, x) : 32.5 - (COURT.x0 - 8 - x) * .9;   // the crest's half-width
  w += (fbm(x * .02, 3.1) - .5) * (inCastle ? 0 : 10);
  const crest = x > 160 ? (x - 160) * .075 * (1 - sstep(420, 700, x) * .4) : 0;
  const d = Math.abs(z) - w;
  let h = crest;
  if (d > 0) h = crest - 330 * (1 - Math.exp(-d / 85)) + (fbm(x * .012, z * .012) - .5) * 60 * sstep(0, 60, d) + 340 * sstep(650, 1150, Math.abs(z)) + 110 * fbm(x * .004 + 7, z * .004) * sstep(900, 1500, Math.abs(z));
  if (x < COURT.x0 - 8 && d <= 0) h = Math.min(h, -(COURT.x0 - 8 - x) * 1.1);   // the castle stands at the ridge's southern tip
  if (x < COURT.x0 - 8) h = Math.min(h, crest - 330 * (1 - Math.exp(-Math.max(0, COURT.x0 - 8 - x) / 70)) + 340 * sstep(650, 1150, Math.hypot(x + 200, z)));
  // the moat: cut straight across the ridge, a glacis on the castle side, the rock face on the town side
  if (x > MOAT.x0 - 1 && x < MOAT.x1 + 1 && Math.abs(z) < w + 40) {
    const cut = x < 30 ? lerp(0, MOAT.floor, sstep(MOAT.x0, 30, x)) : x < 41 ? MOAT.floor : lerp(MOAT.floor, 0, sstep(41, MOAT.x1, x));
    h = Math.min(h, cut + (fbm(x * .3, z * .3) - .5) * .8);
  }
  if (inCastle && d <= 0) h = 0;
  return h;
}

/* ---------------- named framings ---------------- */
export const SHOTS = {
  plane: { pos: V(36, 27, 90), look: V(36, 15, 0) },
  trebuchet: { pos: V(5, 8, 21), look: V(-4.5, 6.5, 0) },
  court: { pos: V(-34, 13, 34), look: V(-4, 6, 0) },
  wall: { pos: V(4, 20, 46), look: V(22, 18, 0) },
  ridge: { pos: V(62, 16, 52), look: V(62, 6, 0) },
  landing: { pos: V(82, 10, 34), look: V(70, 2, 0) },
  overview: { pos: V(-70, 95, 190), look: V(0, 0, 0) },
  cover: { pos: V(-17, 5.5, 13), look: V(16, 15, -6) },
};
export const shot = n => ({ pos: SHOTS[n].pos.clone(), look: SHOTS[n].look.clone() });

/* ======================================================================
   Geometry helpers
   ====================================================================== */
const flat = g => (g.index ? g.toNonIndexed() : g);
const merge = gs => mergeGeometries(gs.map(g => { const n = flat(g); if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; }));
// a box with its texture laid in metres on every face
function boxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]); }
  return g;
}
const box = (x0, x1, y0, y1, z0, z1) => boxGeo(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
// a sloping glacis: a prism with its profile in (u across, y) extruded along the other axis
function glacisGeo(profile, len, alongX) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(profile.map(([u, y]) => new THREE.Vector2(u, y))), { depth: len, bevelEnabled: false });
  const uv = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getZ(i) + p.getX(i), p.getY(i));   // metres, whichever way the face runs
  if (alongX) g.rotateY(-Math.PI / 2);   // the profile's u becomes z, the extrusion runs along −x
  return g;
}
// a tapered timber: a box from x = 0 to L whose section scales from s0 at x = 0 to s1 at x = L
function taperBeam(L, s0, s1, t0 = s0, t1 = s1) {
  const g = new RoundedBoxGeometry(1, 1, 1, 2, .08).translate(.5, 0, 0), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const u = p.getX(i); p.setX(i, u * L); p.setY(i, p.getY(i) * lerp(s0, s1, u)); p.setZ(i, p.getZ(i) * lerp(t0, t1, u)); uv.setXY(i, uv.getX(i) * .6, uv.getY(i) * L * .5); }
  g.computeVertexNormals(); return g;
}
// a beam of a given section between two points
function strut(a, b, w, d = w) {
  const dir = b.clone().sub(a), L = dir.length(), g = new RoundedBoxGeometry(w, L, d, 1, Math.min(w, d) * .18);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * .5, uv.getY(i) * L * .5);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.normalize())); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
// a rough stone: an icosphere pushed in and out by noise
function roughStone(r, detail = 3, seed = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail), p = g.attributes.position, v = V();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const n = v.clone().normalize();
    const k = 1 + (n2(n.x * 2.3 + seed, n.y * 2.3 + n.z * 1.7) - .5) * .42 + (n2(n.x * 6 + seed * 3, n.z * 6 - n.y * 2) - .5) * .12;
    p.setXYZ(i, v.x * k * 1.08, v.y * k * .86, v.z * k);
  }
  g.computeVertexNormals(); return g;
}

/* ======================================================================
   Materials
   ====================================================================== */
const lift = (m, r, g, b) => { m.color.setRGB(r, g, b); return m; };
// the tiled world materials skip their AO map: GTAO (high) and the bake (board/low) already darken the creases, and each map
// was one more download and texture upload per set
const NOAO = ['diff', 'nor_gl', 'rough'];
function makeMats() {
  return {
    // castle_wall_slates is a warm grey rubble (lightness .47): pulled toward Karak's dark brown-grey Crusader stone
    wall: lift(pbr('castle_wall_slates', { maps: NOAO, repeat: [1 / 3.2, 1 / 3.2], envMapIntensity: .1, normalScale: 1.3 }), .9, .8, .68),
    // the Mamluk keep and the tower facings: dressed ashlar, lifted to a warm pale limestone
    ashlar: lift(pbr('large_sandstone_blocks', { maps: NOAO, repeat: [1 / 4, 1 / 4], envMapIntensity: .1 }), 1.9, 1.68, 1.35),
    glacis: lift(pbr('large_sandstone_blocks', { maps: NOAO, repeat: [1 / 4.5, 1 / 4.5], envMapIntensity: .1, normalScale: 1.4 }), 1.55, 1.36, 1.1),
    rock: lift(pbr('rocky_trail', { maps: NOAO, repeat: [1 / 7, 1 / 7], envMapIntensity: .1 }), 1.12, 1.0, .86),
    dirt: lift(pbr('brown_mud_02', { maps: NOAO, repeat: [1 / 3, 1 / 3], envMapIntensity: .1 }), 2.1, 1.85, 1.5),
    floor: lift(pbr('monastery_stone_floor', { maps: NOAO, repeat: [1 / 3, 1 / 3], envMapIntensity: .1 }), 1.35, 1.22, 1.06),
    wood: pbr('medieval_wood', { maps: NOAO, repeat: [1, 1], color: 0xcaa57c, envMapIntensity: .15 }),
    woodR: pbr('rough_wood', { maps: NOAO, repeat: [1, 1], color: 0xb39170, envMapIntensity: .15 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x2b2926, roughness: .5, metalness: .7, envMapIntensity: .25 }),
    rope: pbr('hessian_230', { maps: NOAO, repeat: [3, .4], color: 0xd6bf97, envMapIntensity: .1 }),
    hide: pbr('hessian_230', { maps: NOAO, repeat: [1 / 1.4, 1 / 1.4], color: 0xa4825e, envMapIntensity: .1, side: THREE.DoubleSide }),
    stone: lift(pbr('castle_wall_slates', { maps: ['diff', 'nor_gl', 'rough'], repeat: [1.3, 1.3], envMapIntensity: .1 }), .78, .72, .64),
    dark: new THREE.MeshStandardMaterial({ color: 0x17120e, roughness: 1, envMapIntensity: .05 }),
  };
}

/* ======================================================================
   buildKarak
   ====================================================================== */
// lite (default): a coarser terrain grid and fewer town houses, for weak devices
// bake: 'build' = the bake page (baked geometry, no data loaded), 'off' = never baked; default: by the tier
export const GROUND_MAP = { x0: -212, z0: -64, x1: 152, z1: 64, res: .5 };   // the baked ground map: the castle, the moat, the ridge
// side: 'castle' (default: the trebuchet in the north court throws out over the wall, as the Crusader defenders') or
// 'saladin' (the world mirrored about x = 42: the trebuchet stands on the ridge in Salah al-Din's camp and throws AT the
// castle; the moat is then x ∈ [40, 60], the north wall's face is x = 60, its top 24; the tall middle north tower stands
// just behind it). The game frame stays the same (x from the release point, y up, the throw plane z = 0); only the world
// under it changes. K.ground(x, z), K.wall and K.moat give the terrain in the game frame on either side.
export const SALADIN_D = 84;
export function buildKarak(scene, { lite = true, renderer = null, tier = null, bake = null, side = 'castle' } = {}) {
  tier = tier || (renderer ? detectTier(renderer) : QUALITY.tier) || 'high';
  const baked = bake === 'build' || (bake !== 'off' && (tier === 'board' || tier === 'low'));
  const M = makeMats(), K = { mats: M, groups: {}, tier, baked, bakeList: [], bakeMaps: [] };
  const sal = side === 'saladin', D = SALADIN_D;
  // the world's root: mirrored in x on Salah al-Din's side (three.js flips the winding of mirrored meshes itself)
  const root = new THREE.Group(); root.name = 'world'; if (sal) { root.scale.x = -1; root.position.x = D; } scene.add(root); root.updateMatrixWorld(true);
  K.side = side; K.root = root;
  K.toOld = x => (sal ? D - x : x);   // a game-frame x as the world's own x
  K.ground = sal ? (x, z) => groundH(D - x, z) : groundH;
  K.wall = sal ? { x0: D - WALL.x1, x1: D - WALL.x0, top: WALL.top, z: WALL.z } : WALL;
  K.moat = sal ? { x0: D - MOAT.x1, x1: D - MOAT.x0, floor: MOAT.floor } : MOAT;
  const SUNW = sal ? V(-SUN.x, SUN.y, SUN.z) : SUN;   // the sun is mirrored with the world, so the light still comes from the camera's side
  const G = n => { const g = new THREE.Group(); g.name = n; root.add(g); K.groups[n] = g; return g; };
  const castle = G('castle'), terrain = G('terrain'), town = G('town'), camp = G('camp');
  const mesh = (geo, mat, parent, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
  // baked tiers: split the big faces so per-vertex light has vertices L metres apart (the buried parts go); register a
  // static mesh by a stable id
  const buried = (...t) => t.every(p => p[1] < groundH(p[0], p[2]) - .6);
  const TS = (g, L) => (baked ? tess(g, L, buried) : g);
  const gmap = baked ? { id: 'ground', ...GROUND_MAP, ...groundMap(GROUND_MAP) } : null;
  if (gmap && sal) gmap.u.uBakeInv.value.copy(root.matrixWorld).invert();   // the map is in the world's own coordinates
  const bk = (obj, id, map = null) => { if (!baked) return obj; bakeAttr(obj); if (bake !== 'build') obj.material = bakedMat(obj.material, map); K.bakeList.push({ id, obj }); return obj; };
  const R = rng(20260913), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();

  /* ---------- sky, haze, sun ---------- */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uSun: { value: SUNW }, uNight: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: NOISE_GLSL + `varying vec3 vDir; uniform vec3 uSun; uniform float uNight;
      void main(){ vec3 d=normalize(vDir); float h=d.y, s=max(dot(d,uSun),0.);
        float az=pow(max(dot(normalize(vec3(d.x,0.,d.z)),normalize(vec3(uSun.x,0.,uSun.z))),0.),2.);
        vec3 zen=vec3(.26,.45,.74), hor=vec3(.86,.83,.78), warm=vec3(1.,.86,.66);
        vec3 col=mix(mix(hor,warm,az*.35),zen,smoothstep(.0,.45,h));
        col+=vec3(1.,.9,.75)*pow(s,12.)*.4+vec3(1.,.93,.8)*pow(s,600.)*1.6;
        float c=fbm(vec3(d.x/(h+.22)*1.3,d.z/(h+.22)*1.3,.4));
        col=mix(col,col*.92+vec3(.3,.29,.27)*az,smoothstep(.58,.86,c)*smoothstep(.42,.06,h)*step(0.,h)*.6);
        if(h<0.) col=hor*.92;
        col=mix(col, vec3(.035,.05,.1)+col*vec3(.1,.11,.16)+vec3(.35,.18,.08)*pow(1.-abs(h),18.)*.5, uNight);   // night: a deep blue sky, a last glow on the horizon
        gl_FragColor=vec4(col,1.); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2600, 48, 32), skyMat); sky.userData.noAO = true; scene.add(sky); K.sky = sky;
  const HAZE = new THREE.Color(.84, .81, .76);   // the dusty haze over the Jordan Rift
  scene.background = HAZE.clone(); scene.fog = new THREE.FogExp2(HAZE.clone(), .00075);
  // the image-based light comes from this sky itself, prefiltered once: the 1.1 MB HDR it replaces lit every material at
  // 10–15 % anyway, and its parse was a long frame at boot. (The bake page has no renderer: it keeps the HDR.)
  if (renderer) { const es = new THREE.Scene(), pm = new THREE.PMREMGenerator(renderer); es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat)); scene.environment = pm.fromScene(es, 0, 1, 200).texture; pm.dispose(); }
  else hdri('qwantani_dusk_2_puresky').then(env => { scene.environment = env; });
  const hemi = new THREE.HemisphereLight(0xe4ddd2, 0x9c8a74, 1.35); scene.add(hemi); K.hemi = hemi;
  const sun = new THREE.DirectionalLight(0xfff0dc, 3.3);
  sun.position.copy(SUNW).multiplyScalar(220).add(V(K.toOld(20), 0, 0)); sun.target.position.set(K.toOld(20), 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);   // 11 cm texels over the whole scene: sharp enough, a quarter of 4096's fill sun.shadow.bias = -.0004; sun.shadow.normalBias = .06;
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 80, bottom: -80, near: 60, far: 420 }); sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun, sun.target); K.sun = sun;
  // K.setNight(k), k ∈ [0, 1]: day → night (the sun and the sky dim, the haze turns blue-black). No extra lights: cheap on every tier
  { const day = { sun: sun.intensity, hemi: hemi.intensity, bg: scene.background.clone() }, night = new THREE.Color(.04, .055, .1);
    K.night = 0; K.setNight = k => { K.night = k; sun.intensity = day.sun * (1 - .82 * k); hemi.intensity = day.hemi * (1 - .72 * k); scene.background.copy(day.bg).lerp(night, k); scene.fog.color.copy(scene.background); skyMat.uniforms.uNight.value = k; }; }
  if (baked) { sun.castShadow = false; sun.userData.baked = true; }   // the bake carries the shadows: no shadow map at all

  /* ---------- the terrain: a detailed near patch and a coarse far ring (the wadi, the plateau) ---------- */
  const terrMat = M.rock.clone();
  terrMat.onBeforeCompile = s => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGw; varying vec3 vGn;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGw = (modelMatrix * vec4(transformed, 1.)).xyz; vGn = normal;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGw; varying vec3 vGn;\n' + NOISE_GLSL).replace('#include <map_fragment>', `#include <map_fragment>
      float gv = fbm(vec3(vGw.xz * .015, 1.7)), gg = n3(vec3(vGw.xz * .09, 4.2)), flatK = smoothstep(.78, .97, normalize(vGn).y);
      vec3 dust = vec3(1.08, .96, .8), scrub = vec3(.8, .8, .62);
      diffuseColor.rgb *= mix(.82, 1.12, gv);
      diffuseColor.rgb *= mix(vec3(1.), mix(dust, scrub, smoothstep(.55, .8, gg) * .55), flatK);
      diffuseColor.rgb *= mix(1., .86, smoothstep(-60., -300., vGw.y));`);
  };
  terrMat.customProgramCacheKey = () => 'karak-ground';
  const terrainMesh = (size, seg, cx, cz, sink) => {
    const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2); g.translate(cx, 0, cz);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); let y = groundH(x, z); if (sink && Math.abs(x - 40) < 380 && Math.abs(z) < 380) y -= 12; p.setY(i, y); uv.setXY(i, x, z); }
    g.computeVertexNormals(); const m = mesh(g, terrMat, terrain, false); return m;
  };
  const NEAR = { size: 800, seg: lite ? 200 : 300, cx: 40, cz: 0 };
  const near = bk(terrainMesh(NEAR.size, NEAR.seg, NEAR.cx, NEAR.cz, false), 'terrain', gmap);
  const far = terrainMesh(6000, lite ? 110 : 160, 40, 0, true); far.userData.noBake = true;   // the far ring: no bake, no occluder
  if (gmap) {   // a point on the near patch's real triangles (PlaneGeometry: vertex (i, j) = i + (seg + 1) j, diagonal b–d)
    const { size, seg, cx, cz } = NEAR, s = size / seg, W = seg + 1, P = near.geometry.attributes.position, Nr = near.geometry.attributes.normal;
    gmap.at = (x, z) => {
      const fx = (x - cx + size / 2) / s, fz = (z - cz + size / 2) / s, i = clamp(Math.floor(fx), 0, seg - 1), j = clamp(Math.floor(fz), 0, seg - 1), u = fx - i, v = fz - j;
      const a = i + W * j, b = a + W, c = b + 1, d = a + 1, w = u + v <= 1 ? [[a, 1 - u - v], [b, v], [d, u]] : [[c, u + v - 1], [b, 1 - u], [d, 1 - v]];
      const p = V(), n = V(); for (const [k, t] of w) { p.x += P.getX(k) * t; p.y += P.getY(k) * t; p.z += P.getZ(k) * t; n.x += Nr.getX(k) * t; n.y += Nr.getY(k) * t; n.z += Nr.getZ(k) * t; }
      return { p, n: n.normalize() };
    };
    K.bakeMaps.push(gmap);
  }
  // paving in the court around the trebuchet, and a trodden path to the gate
  { const pv = new THREE.PlaneGeometry(64, 44).rotateX(-Math.PI / 2), uv = pv.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 64, uv.getY(i) * 44);
    const m = bk(mesh(pv, M.floor, castle, false), 'paving', gmap); m.position.set(-14, .02, -2); }

  /* ---------- the castle walls ---------- */
  const wallG = [], ashG = [], glaG = [], darkG = [];
  // the north curtain wall (the throw goes over it) and its glacis into the moat
  wallG.push(box(WALL.x0, WALL.x1, -4, WALL.top, -WALL.z, WALL.z));
  glaG.push(glacisGeo([[WALL.x1 - .01, 4], [WALL.x1 - .01, MOAT.floor - 1], [30.5, MOAT.floor - 1]], 2 * WALL.z + 12, false).translate(0, 0, -WALL.z - 6));
  // the east curtain (toward the usual camera): its top is just above the court; its face falls down the slope to a glacis
  wallG.push(box(COURT.x0, WALL.x1, -18, EAST.top, EAST.z0, EAST.z1));
  { const g = glacisGeo([[EAST.z1 - .01, -6], [EAST.z1 - .01, -60], [44, -60], [44, -24]], WALL.x1 - COURT.x0, true); g.translate(WALL.x1, 0, 0); glaG.push(g); }
  // the west curtain (the backdrop) and its glacis
  wallG.push(box(COURT.x0, WALL.x1, -18, WEST.top, WEST.z0, WEST.z1));
  // east towers: rectangular, projecting down the slope, their tops a little above the court
  const eastTowers = [-150, -96, -42, 20.5];
  eastTowers.forEach((x, i) => { const w = i === 3 ? 11 : 9, top = i === 3 ? 7 : 6; wallG.push(box(x - w / 2, x + w / 2, -34, top, EAST.z0, EAST.z1 + 6)); });
  // the north towers: a tall one in the middle of the front and the north-west corner, both behind the throw plane
  const northTowers = [{ z0: -14, z1: -4, top: 30 }, { z0: -44, z1: -31, top: 28 }];
  northTowers.forEach(t => { wallG.push(box(16, 28, -6, t.top, t.z0, t.z1)); glaG.push(glacisGeo([[28 - .01, 3], [28 - .01, MOAT.floor - 1], [33, MOAT.floor - 1]], t.z1 - t.z0, false).translate(0, 0, t.z0)); });
  // the vaulted halls along the west wall: two storeys of arches facing the court, dark vaults behind
  const hall = (() => {
    const L = 21, H = 12.5, sh = new THREE.Shape([[0, 0], [L, 0], [L, H], [0, H]].map(([x, y]) => new THREE.Vector2(x, y)));
    const arch = (x, y, w, h) => { const p = new THREE.Path(); p.moveTo(x - w / 2, y); p.lineTo(x + w / 2, y); p.lineTo(x + w / 2, y + h - w / 2); p.absarc(x, y + h - w / 2, w / 2, 0, Math.PI, false); p.lineTo(x - w / 2, y); return p; };
    for (let k = 0; k < 4; k++) { sh.holes.push(arch(2.6 + k * 5.25, 0, 3.4, 5.6)); sh.holes.push(arch(2.6 + k * 5.25, 7.2, 2.2, 3.6)); }
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1.4, bevelEnabled: false, curveSegments: 10 }); return { g, L };
  })();
  for (let x = -176; x < 2; x += hall.L) { wallG.push(hall.g.clone().translate(x, 0, -21.4)); darkG.push(box(x + .2, x + hall.L - .2, 0, 12.3, -30.8, -21.5)); }
  wallG.push(box(-176, 2, 12.5, 13.4, -31, -20));   // the roof terrace over the halls
  // the Mamluk keep at the south end: pale ashlar, a battered base
  ashG.push(box(-196, -176, -20, 34, -26, 20));
  glaG.push(glacisGeo([[-176 + .01, 6], [-176 + .01, -6], [-170, -6]], 46, false).translate(0, 0, -26));
  // ruined walls in the court (the old church and store rooms)
  const RG = rng(77);
  [[-120, -104, 8], [-120, -118, -6], [-70, -52, 12], [-70, -68, 2], [-24, -18, 18]].forEach(([x0, x1, z]) => {
    const pts = [[x0, 0], [x1, 0]], n = 6; for (let k = n; k >= 0; k--) pts.push([lerp(x0, x1, k / n), 1.2 + RG() * 3.2]);
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); const g = new THREE.ExtrudeGeometry(s, { depth: 1.1, bevelEnabled: false }); g.translate(0, 0, z);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i)); wallG.push(g);
  });
  bk(mesh(TS(merge(wallG), 4), M.wall, castle), 'wall'); bk(mesh(TS(merge(ashG), 4), M.ashlar, castle), 'ashlar'); bk(mesh(TS(merge(glaG), 6), M.glacis, castle), 'glacis'); mesh(merge(darkG), M.dark, castle, false);
  // merlons along every wall top, and arrow slits in the east face
  { const mer = [];
    for (let z = -WALL.z + 1; z <= WALL.z - 1; z += 2.3) mer.push([V(WALL.x1 - .5, WALL.top + .8, z), V(1, 1.6, 1.3)]);
    for (let x = COURT.x0 + 2; x <= WALL.x0 - 1; x += 2.3) { if (eastTowers.some(t => Math.abs(x - t) < 6)) continue; mer.push([V(x, EAST.top + .75, EAST.z1 - .45), V(1.3, 1.5, .9)]); mer.push([V(x, WEST.top + .8, WEST.z0 + .45), V(1.3, 1.6, .9)]); }
    eastTowers.forEach((x, i) => { const w = i === 3 ? 11 : 9, top = i === 3 ? 7 : 6; for (let u = -w / 2 + .7; u <= w / 2 - .6; u += 2.1) mer.push([V(x + u, top + .75, EAST.z1 + 5.5), V(1.2, 1.5, .9)]); for (let v = EAST.z0 + .8; v <= EAST.z1 + 5; v += 2.1) { mer.push([V(x - w / 2 + .45, top + .75, v), V(.9, 1.5, 1.2)]); mer.push([V(x + w / 2 - .45, top + .75, v), V(.9, 1.5, 1.2)]); } });
    northTowers.forEach(t => { for (let z = t.z0 + .7; z <= t.z1 - .6; z += 2.1) mer.push([V(27.55, t.top + .8, z), V(.9, 1.6, 1.2)]); for (let x = 16.7; x <= 27.3; x += 2.1) { mer.push([V(x, t.top + .8, t.z0 + .45), V(1.2, 1.6, .9)]); mer.push([V(x, t.top + .8, t.z1 - .45), V(1.2, 1.6, .9)]); } });
    for (let x = -195; x <= -177; x += 2.2) for (const z of [-25.5, 19.5]) mer.push([V(x, 34.8, z), V(1.3, 1.6, .9)]);
    const im = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 1, .06), M.wall, mer.length); im.castShadow = im.receiveShadow = true;
    mer.forEach(([p, s], i) => { q.setFromEuler(e.set(0, (hash(i) - .5) * .06, (hash(i, 3) - .5) * .05)); im.setMatrixAt(i, m4.compose(p, q, s.multiplyScalar(.96 + hash(i, 7) * .08))); }); castle.add(im); bk(im, 'merlons');
    const slits = [];
    for (let x = COURT.x0 + 6; x < 16; x += 7.5) { if (eastTowers.some(t => Math.abs(x - t) < 6)) continue; slits.push(V(x, -3.5, EAST.z1 + .02), V(x + 3.7, -9, EAST.z1 + .02)); }
    eastTowers.forEach(x => { slits.push(V(x, -1, EAST.z1 + 6.02), V(x, -8, EAST.z1 + 6.02), V(x - 2.5, -15, EAST.z1 + 6.02), V(x + 2.5, -15, EAST.z1 + 6.02)); });
    for (let z = -12; z >= -40; z -= 14) slits.push(V(28.02, 12, z + 3), V(28.02, 20, z + 3));
    const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(.28, 1.9, .3), M.dark, slits.length);
    slits.forEach((p, i) => { q.identity(); if (p.x > 27) q.setFromEuler(e.set(0, Math.PI / 2, 0)); sl.setMatrixAt(i, m4.compose(p, q, V(1, 1, 1))); }); castle.add(sl); if (baked) sl.castShadow = sl.receiveShadow = false; }

  /* ---------- props in the court: the ammunition pile, crates, a ladder, buckets ---------- */
  { const pile = [], rs = rng(5);
    for (let i = 0; i < 26; i++) { const a = rs() * Math.PI * 2, r = rs() * 2.1, y = .38 + (2.1 - r) * .32; pile.push([V(-15 + Math.cos(a) * r, y, -6.5 + Math.sin(a) * r), rs() * 6, .85 + rs() * .35]); }
    const im = new THREE.InstancedMesh(roughStone(.42, 2, 3), M.stone, pile.length); im.castShadow = im.receiveShadow = true;
    pile.forEach(([p, r, s], i) => { q.setFromEuler(e.set(r, r * 1.7, r * .5)); im.setMatrixAt(i, m4.compose(p, q, V(s, s, s))); }); castle.add(im); K.stonePile = bk(im, 'pile'); }
  prop(castle, 'wooden_crate_01', V(-18.5, 0, -2.2), { rotY: .4, scale: 1.4 }); prop(castle, 'wooden_crate_01', V(-17.4, 0, -3.6), { rotY: -.3, scale: 1.4 });
  prop(castle, 'wooden_bucket_01', V(-12.5, 0, -8.8), { rotY: .8, scale: 1.2 });
  prop(castle, 'wooden_ladder', V(18.9, 0, -8)).rotation.set(0, Math.PI / 2, .26, 'ZYX');
  prop(castle, 'sledgehammer_01', V(-11.6, .06, -9.6), { rotY: 1.2 }).rotation.z = Math.PI / 2 - .15;
  prop(castle, 'wooden_stool_01', V(-19, 0, 1.4), { rotY: .3 });

  /* ---------- the siege camp on the ridge: tents, banners, the targets ---------- */
  const flags = [];
  { const tg = [], tr = rng(31);
    for (let i = 0; i < 9; i++) { const x = 96 + i * 8 + tr() * 5, z = -30 + tr() * 16, r = 2.4 + tr() * 1.4, h = 3 + tr() * 1.4, c = new THREE.ConeGeometry(r, h, 9, 1, true); c.translate(x, groundH(x, z) + h / 2 - .1, z); tg.push(c);
      const pole = new THREE.CylinderGeometry(.06, .06, h + 1.2, 6); pole.translate(x, groundH(x, z) + (h + 1.2) / 2, z); tg.push(pole); }
    bk(mesh(merge(tg), M.hide, camp), 'tents');
    [[104, -12], [140, -20], [62, -16]].forEach(([x, z], i) => {
      const y = groundH(x, z); bk(mesh(new THREE.CylinderGeometry(.07, .09, 8, 8).translate(x, y + 4, z), M.woodR, camp), 'pole' + i);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.2, 10, 3).translate(1.1, 0, 0), new THREE.MeshStandardMaterial({ color: 0x8c2f24, roughness: .85, side: THREE.DoubleSide, envMapIntensity: .1 }));
      f.position.set(x, y + 7.2, z); f.castShadow = !baked; f.userData.noBake = true; camp.add(f); flags.push(f);
    }); }
  K.mantlet = x => {
    const g = new THREE.Group(), pg = [];
    for (let k = 0; k < 11; k++) pg.push(new RoundedBoxGeometry(.3, 2.6 + (k % 3) * .1, .12, 1, .03).translate(0, 1.3, -1.6 + k * .32));
    pg.push(new RoundedBoxGeometry(.14, .16, 3.5, 1, .03).translate(-.12, .6, 0), new RoundedBoxGeometry(.14, .16, 3.5, 1, .03).translate(-.12, 2.1, 0));
    const body = mesh(merge(pg), M.woodR, g);
    for (const z of [-1.1, 1.1]) mesh(strut(V(.05, 1.9, z), V(1.5, 0, z), .12), M.wood, g);
    const hideM = mesh(new THREE.PlaneGeometry(3.2, 2.2, 6, 4).rotateY(-Math.PI / 2).translate(-.12, 1.4, 0), M.hide, g, false);
    { const p = hideM.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) - Math.sin(p.getZ(i) * 2.1 + p.getY(i)) * .05); hideM.geometry.computeVertexNormals(); }
    g.position.set(K.toOld(x), groundH(K.toOld(x), 0), 0); g.userData.body = body; camp.add(g); K.follow(g, 2.6, 4.4, .5); return g;
  };
  K.tower = x => {
    const g = new THREE.Group(), H = 13, B = 4.2, wd = [], hd = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) wd.push(new RoundedBoxGeometry(.34, H, .34, 1, .05).translate(sx * B / 2, H / 2 + .9, sz * B / 2));
    for (let y = 1; y <= H; y += 3.2) { wd.push(new RoundedBoxGeometry(B + .3, .26, .26, 1, .04).translate(0, y + .9, -B / 2), new RoundedBoxGeometry(B + .3, .26, .26, 1, .04).translate(0, y + .9, B / 2), new RoundedBoxGeometry(.26, .26, B + .3, 1, .04).translate(B / 2, y + .9, 0), new RoundedBoxGeometry(.26, .26, B + .3, 1, .04).translate(-B / 2, y + .9, 0)); }
    for (const sz of [-1, 1]) for (let y = 1; y < H - 2; y += 3.2) wd.push(strut(V(-B / 2, y + .9, sz * B / 2), V(B / 2, y + 4.1, sz * B / 2), .16));
    // the front (facing the castle, −x) and the sides are hung with hides; the top is open behind a parapet
    hd.push(new THREE.PlaneGeometry(B, H - 1.6, 4, 6).rotateY(-Math.PI / 2).translate(-B / 2 - .2, H / 2 + .3, 0));
    for (const sz of [-1, 1]) hd.push(new THREE.PlaneGeometry(B, H - 1.6, 4, 6).translate(0, H / 2 + .3, sz * (B / 2 + .2)));
    mesh(merge(wd), M.woodR, g); const hm = mesh(merge(hd), M.hide, g);
    { const p = hm.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setY(i, y - Math.abs(Math.sin(y * 1.9 + p.getX(i) + p.getZ(i))) * .06); } hm.geometry.computeVertexNormals(); }
    const wheel = new THREE.CylinderGeometry(.85, .85, .3, 20).rotateX(Math.PI / 2);
    for (const sx of [-1.4, 1.4]) for (const sz of [-1, 1]) { mesh(wheel.clone().translate(sx, .85, sz * (B / 2 + .35)), M.wood, g); mesh(new THREE.CylinderGeometry(.14, .14, .4, 10).rotateX(Math.PI / 2).translate(sx, .85, sz * (B / 2 + .5)), M.iron, g); }
    mesh(new RoundedBoxGeometry(B + .6, .3, B + .6, 1, .05).translate(0, 1.0, 0), M.wood, g);
    g.position.set(K.toOld(x), groundH(K.toOld(x), 0), 0); g.userData.top = H + .9; camp.add(g); K.follow(g, 7.5, 7.5); return g;
  };

  /* ---------- the town of Karak on the hill to the north: pale stone houses, flat roofs, two minarets ---------- */
  {
    const RT = rng(4411), FW = 512, FH = 256;
    const facade = canvasTex(FW, FH, x => {
      x.fillStyle = '#d9cdb8'; x.fillRect(0, 0, FW, FH);
      for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(${120 + RT() * 50},${105 + RT() * 45},${85 + RT() * 40},${.05 + RT() * .08})`; x.fillRect(RT() * FW, RT() * FH, 8 + RT() * 22, 5 + RT() * 10); }
      for (let r = 0; r < 12; r++) { x.fillStyle = 'rgba(100,88,70,.13)'; x.fillRect(0, r * 22, FW, 1.5); }
      for (let f = 0; f < 3; f++) for (let c = 0; c < 8; c++) { if (RT() < .25) continue; const X = 18 + c * 62 + RT() * 8, Y = 24 + f * 80; x.fillStyle = '#c7b9a0'; x.fillRect(X - 3, Y - 3, 28, 40); const gr = x.createLinearGradient(0, Y, 0, Y + 34); gr.addColorStop(0, '#3a3a38'); gr.addColorStop(1, '#262422'); x.fillStyle = gr; x.fillRect(X, Y, 22, 34); if (RT() < .3) { x.beginPath(); x.arc(X + 11, Y, 11, Math.PI, 0); x.fill(); } }
    });
    facade.wrapS = facade.wrapT = THREE.RepeatWrapping;
    const walls = [], roofs = [], col = new THREE.Color();
    const n = lite ? 150 : 260;
    for (let i = 0; i < n; i++) {
      const x = 178 + RT() * 300, z = (RT() - .5) * 2 * (40 + (x - 170) * .28);
      if (Math.abs(z) > 44 + 26 * sstep(150, 420, x) + 6) continue;
      const w = 7 + RT() * 6, d = 7 + RT() * 6, fl = 1 + Math.floor(RT() * 3), rot = (RT() - .5) * .5, g0 = Math.min(groundH(x - w / 2, z - d / 2), groundH(x + w / 2, z + d / 2)) - 1.5, top = Math.max(groundH(x, z), g0 + 1.5) + fl * 3.3, h = top - g0;
      const b = new THREE.BoxGeometry(w, h, d), uv = b.attributes.uv, uo = RT();
      for (let k = 0; k < uv.count; k++) { const face = Math.floor(k / 4), across = face < 2 ? d : w; if (face === 2 || face === 3) { uv.setXY(k, .01, .01); continue; } uv.setXY(k, uo + uv.getX(k) * across / 26, uv.getY(k) * h / 13); }
      col.setHSL(.09 + RT() * .02, .16 + RT() * .1, .62 + RT() * .12);
      b.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: uv.count }, () => [col.r, col.g, col.b]).flat(), 3));
      b.rotateY(rot); b.translate(x, g0 + h / 2, z); walls.push(b);
      const pr = new THREE.BoxGeometry(w + .2, .5, d + .2); pr.rotateY(rot); pr.translate(x, top + .25, z); roofs.push(pr);
    }
    const cm = new THREE.Mesh(mergeGeometries(walls), new THREE.MeshStandardMaterial({ map: facade, vertexColors: true, roughness: .92, envMapIntensity: .1 })); cm.receiveShadow = true; cm.userData.noAO = true; town.add(cm); bk(cm, 'town');
    const rm = new THREE.Mesh(mergeGeometries(roofs), new THREE.MeshStandardMaterial({ color: 0xc8baa2, roughness: .9, envMapIntensity: .1 })); rm.userData.noAO = true; town.add(rm); bk(rm, 'roofs');
    const stone = new THREE.MeshStandardMaterial({ color: 0xe2d6c0, roughness: .85, envMapIntensity: .1 });
    let mk = 0;
    for (const [x, z] of [[262, -18], [340, 26]]) { const y = groundH(x, z); const add = (geo, yy) => { const m = new THREE.Mesh(geo, stone); m.position.set(x, y + yy, z); m.userData.noAO = true; town.add(m); m.updateMatrixWorld(); bk(m, 'minaret' + mk++); };
      add(new THREE.CylinderGeometry(1.4, 1.7, 26, 10), 13); add(new THREE.CylinderGeometry(2.2, 1.6, 1.1, 12), 25); add(new THREE.CylinderGeometry(1.1, 1.2, 4, 10), 27.5); add(new THREE.ConeGeometry(1.25, 3.4, 10), 31.2); }
  }

  /* ---------- dust bursts (landings) ---------- */
  const dustTex = canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.5, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const DN = 48, bursts = [];
  K.dust = (p, k = 1) => {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(DN * 3), vel = [];
    for (let i = 0; i < DN; i++) { pos[i * 3] = p.x; pos[i * 3 + 1] = p.y + .3; pos[i * 3 + 2] = p.z; const a = Math.random() * Math.PI * 2, s = (2 + Math.random() * 5) * k; vel.push(V(Math.cos(a) * s, (2 + Math.random() * 6) * k, Math.sin(a) * s)); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: dustTex, color: 0xc9b393, size: 2.4 * k, transparent: true, opacity: .8, depthWrite: false }));
    pts.userData.noAO = true; pts.frustumCulled = false; scene.add(pts); bursts.push({ pts, vel, t: 0, floor: sal ? Math.min(0, K.ground(p.x - 1.5, p.z)) : 0 });   // Salah al-Din's side: dust off the wall falls into the moat
  };

  /* ---------- baked tiers: soft blob shadows under the moving things, the static occluders, the data ---------- */
  const blobTex = canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(.5, 'rgba(0,0,0,.36)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  // K.blob(parent, w, d, x, z) → a soft dark ellipse on the ground (baked tiers only; null otherwise)
  K.blob = (parent, w, d, x = 0, z = 0) => {
    if (!baked) return null;
    const b = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    b.position.set(x, .06, z); b.userData.noAO = true; b.userData.noBake = true; b.renderOrder = 1; parent.add(b); return b;
  };
  // K.follow(obj, w, d, dx) → a blob that stays on the ground under obj (a scene or camp child), fading as it rises
  const follows = [];
  const _fw = V();
  K.follow = (obj, w = 1.4, d = w, dx = 0) => { const b = K.blob(scene, w, d); if (b) follows.push({ obj, b, dx }); };
  K.bakeOcc = [];
  if (baked) [castle, terrain, town, camp].forEach(g => g.traverse(o => { if (o.isMesh && !o.userData.noBake && !(o.isInstancedMesh && o.material === M.dark)) K.bakeOcc.push(o); }));
  window.__karak = K;   // test hook: K.tier, K.baked, K.bakeInfo
  K.bakeReady = baked && bake !== 'build' ? loadBake(BAKE_URL, K.bakeList, K.bakeMaps).then(r => (K.bakeInfo = r)).catch(err => { console.warn('bake: no baked light', err); return null; }) : Promise.resolve(null);

  K.update = (dt, t, camera) => {
    if (camera) sky.position.copy(camera.position);
    for (const f of follows) { const p = f.obj.getWorldPosition(_fw), x = p.x + f.dx, g = K.ground(x, p.z), h = Math.max(0, p.y - g); f.b.visible = f.obj.visible && h < 30; f.b.position.set(x, g + .06, p.z); f.b.scale.setScalar(1 + h * .05); f.b.material.opacity = 1 - h / 30; }
    flags.forEach((f, i) => { const p = f.geometry.attributes.position; for (let k = 0; k < p.count; k++) { const u = p.getX(k); p.setZ(k, Math.sin(u * 2.2 - t * 5 - i) * .18 * u / 2.2); } p.needsUpdate = true; });
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]; b.t += dt; const p = b.pts.geometry.attributes.position;
      for (let k = 0; k < DN; k++) { const v = b.vel[k]; v.y -= 6 * dt; v.multiplyScalar(1 - 1.6 * dt); p.setXYZ(k, p.getX(k) + v.x * dt, Math.max(p.getY(k) + v.y * dt, b.floor), p.getZ(k) + v.z * dt); }
      p.needsUpdate = true; b.pts.material.opacity = .8 * (1 - b.t / 2.4); b.pts.material.size = (2.4 + b.t * 2.2);
      if (b.t > 2.4) { scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i, 1); }
    }
  };
  return K;
}

/* ======================================================================
   The trebuchet (the hero). Local frame: x forward (the throw), y up, origin on the ground under the release point.
   Axle at (−5, 6.2); the long arm (6.5 m) is cocked back and down at 220°, releases at 60.5°, where the sling
   (2.8 m) points 50° up and the pouch sits exactly at (0, RELEASE_Y).
   ====================================================================== */
export function makeTrebuchet(K) {
  const M = K.mats, T = new THREE.Group(), base = new THREE.Group(); T.add(base);
  const mesh = (geo, mat, parent = base, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
  const AX = V(-5, 6.2, 0), SL = 2.8, SDIR = rad(50);
  const ROLL_Y = .44, tipRel = V(0, RELEASE_Y - ROLL_Y, 0).sub(V(Math.cos(SDIR), Math.sin(SDIR), 0).multiplyScalar(SL)), ARM_L = tipRel.clone().sub(AX).length();
  const TH_REL = Math.atan2(tipRel.y - AX.y, tipRel.x - AX.x), TH_REST = rad(220), SHORT = 1.8;
  base.position.y = ROLL_Y;   // the whole frame rides on three log rollers
  const wood = [], woodR = [], iron = [];
  // the base: two sole beams and three cross sills
  for (const z of [-1.8, 1.8]) wood.push(new RoundedBoxGeometry(12.6, .44, .44, 2, .06).translate(-4.9, .22, z));
  for (const x of [-10.6, -5, .8]) wood.push(new RoundedBoxGeometry(.42, .38, 4.6, 2, .06).translate(x, .2, 0));
  // the two A-frames with a king post, a tie beam and side props, and the bearing blocks at the apex
  for (const z of [-1.8, 1.8]) {
    wood.push(strut(V(-8.7, .4, z), V(-5.25, 6.0, z), .36), strut(V(-1.3, .4, z), V(-4.75, 6.0, z), .36), strut(V(-5, .4, z), V(-5, 5.8, z), .3));
    woodR.push(strut(V(-7.4, 2.9, z), V(-2.6, 2.9, z), .24, .26), strut(V(-6.6, 1.2, z), V(-5, 4.9, z), .18), strut(V(-3.4, 1.2, z), V(-5, 4.9, z), .18));
    const sz = Math.sign(z); woodR.push(new RoundedBoxGeometry(2.6, .3, .34, 1, .05).translate(-5, .15, sz * 3.7), strut(V(-5.9, .3, sz * 3.6), V(-5.1, 3.4, z + sz * .2), .22), strut(V(-4.1, .3, sz * 3.6), V(-4.9, 3.4, z + sz * .2), .22));
    wood.push(new RoundedBoxGeometry(1.1, .56, .6, 2, .08).translate(-5, 5.95, z));
    iron.push(new THREE.BoxGeometry(1.14, .05, .64).translate(-5, 6.25, z), new THREE.BoxGeometry(.06, .6, .64).translate(-5.5, 5.95, z), new THREE.BoxGeometry(.06, .6, .64).translate(-4.5, 5.95, z));
    for (const x of [-10.6, -5, .8]) iron.push(new THREE.CylinderGeometry(.05, .05, .5, 8).translate(x, .48, z));
  }
  iron.push(new THREE.CylinderGeometry(.12, .12, 4.3, 16).rotateX(Math.PI / 2).translate(AX.x, AX.y, 0));
  for (const z of [-2.2, 2.2]) iron.push(new THREE.CylinderGeometry(.2, .2, .1, 16).rotateX(Math.PI / 2).translate(AX.x, AX.y, z));
  // the trough the pouch slides along, and the windlass at the back
  for (const z of [-.45, .45]) woodR.push(new RoundedBoxGeometry(6.2, .3, .16, 1, .04).translate(-7.3, .58, z));
  woodR.push(new RoundedBoxGeometry(6.2, .08, 1.06, 1, .02).translate(-7.3, .45, 0));
  const drumZ = 1.3, wx = -11.3;
  woodR.push(new THREE.CylinderGeometry(.28, .28, 2.5, 16).rotateX(Math.PI / 2).translate(wx, 1.25, 0));
  for (const z of [-drumZ, drumZ]) {
    wood.push(strut(V(-10.6, .4, z), V(wx, 1.3, z), .2), strut(V(-12, .3, z), V(wx, 1.3, z), .2));
    iron.push(new THREE.TorusGeometry(.95, .045, 8, 32).translate(wx, 1.25, z * 1.12));
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; woodR.push(strut(V(wx, 1.25, z * 1.12), V(wx + Math.cos(a) * .95, 1.25 + Math.sin(a) * .95, z * 1.12), .07)); }
  }
  mesh(merge(wood), M.wood); mesh(merge(woodR), M.woodR); mesh(merge(iron), M.iron);
  // the log rollers under the sole beams (they turn as it rolls)
  const rollers = [-9.4, -4.9, -.4].map(x => { const r = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, 4.4, 14).rotateX(Math.PI / 2), M.woodR); r.position.set(x, .22, 0); r.castShadow = r.receiveShadow = true; T.add(r); return r; });
  // the crib of timbers that raises it (log-cabin courses, 0.44 m each), hidden until lifted
  const CRIB_N = 40, crib = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 1, .06), M.woodR, CRIB_N); crib.castShadow = crib.receiveShadow = true; crib.count = 0; T.add(crib);
  // the arm: tapered, iron-banded, pivoting on the axle
  const arm = new THREE.Group(); arm.position.copy(AX); base.add(arm);
  mesh(taperBeam(ARM_L + SHORT + .3, .56, .26, .5, .24).translate(-SHORT - .2, 0, 0), M.wood, arm);
  { const bands = []; [-1.6, -.5, .6, 1.8, 3.2, 4.6, 5.8].forEach(u => { const s = lerp(.56, .26, (u + SHORT + .2) / (ARM_L + SHORT + .3)) + .04; bands.push(new THREE.BoxGeometry(.16, s, s * .92).translate(u, 0, 0)); });
    bands.push(new THREE.CylinderGeometry(.045, .03, .5, 8).rotateZ(-Math.PI / 2 + .5).translate(ARM_L + .12, .12, 0));   // the release prong
    bands.push(new THREE.CylinderGeometry(.08, .08, .7, 12).rotateX(Math.PI / 2).translate(-SHORT, 0, 0));          // the counterweight pin
    mesh(merge(bands), M.iron, arm); }
  // the hinged counterweight: two iron hangers and a timber box full of stones (it always hangs straight down)
  const cw = new THREE.Group(); base.add(cw);
  { const ir = [], wd = []; for (const z of [-.62, .62]) ir.push(new THREE.BoxGeometry(.1, 1.3, .08).translate(0, -.6, z));
    wd.push(new RoundedBoxGeometry(2.1, 1.7, 1.9, 2, .08).translate(0, -2.1, 0));
    for (const y of [-1.35, -2.85]) for (const z of [-.97, .97]) ir.push(new THREE.BoxGeometry(2.16, .1, .05).translate(0, y, z));
    for (const x of [-1.07, 1.07]) for (const z of [-.97, .97]) ir.push(new THREE.BoxGeometry(.06, 1.76, .06).translate(x, -2.1, z));
    mesh(merge(wd), M.woodR, cw); mesh(merge(ir), M.iron, cw);
    const st = new THREE.InstancedMesh(roughStone(.26, 1, 9), M.stone, 14), rs = rng(12), sq = new THREE.Quaternion(); st.castShadow = true;
    for (let i = 0; i < 14; i++) { sq.setFromEuler(new THREE.Euler(rs() * 6, rs() * 6, 0)); st.setMatrixAt(i, new THREE.Matrix4().compose(V((rs() - .5) * 1.6, -1.2 + rs() * .12, (rs() - .5) * 1.4), sq, V(1, 1, 1))); } cw.add(st); }
  // the sling: two ropes from the prong to a hessian pouch
  const ropeGeo = new THREE.CylinderGeometry(.022, .022, 1, 6).translate(0, .5, 0), ropes = [0, 1].map(() => mesh(ropeGeo, M.rope, T));
  const pouch = mesh(new THREE.SphereGeometry(.5, 16, 10, 0, Math.PI * 2, Math.PI * .45, Math.PI * .55), M.rope, T); pouch.scale.set(1, .7, .9);
  const winchRope = mesh(ropeGeo, M.rope, T);
  K.blob?.(T, 15, 7.5, -4.9, 0);   // baked tiers: its soft shadow on the court (it rolls with it, stays on the ground when raised)
  const TB = { group: T, hitbox: [], s: 0, lift: 0, theta: TH_REST, phi: rad(-34) };
  T.traverse(o => { if (o.isMesh) TB.hitbox.push(o); });
  const ax = () => AX.clone().add(base.position);
  const tipAt = th => ax().add(V(Math.cos(th), Math.sin(th), 0).multiplyScalar(ARM_L));
  const ropeTo = (m, a, b) => { const d = b.clone().sub(a), L = d.length(); m.position.copy(a); m.scale.set(1, Math.max(L, .01), 1); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); };
  let pouchP = V();
  function pose(th, phi, winch = 0) {
    TB.theta = th; TB.phi = phi; arm.rotation.z = th;
    const hinge = ax().add(V(Math.cos(th + Math.PI), Math.sin(th + Math.PI), 0).multiplyScalar(SHORT)); cw.position.copy(hinge).sub(base.position);
    const tip = tipAt(th); pouchP = tip.clone().add(V(Math.cos(phi), Math.sin(phi), 0).multiplyScalar(SL)); pouchP.y = Math.max(pouchP.y, base.position.y + .78);
    ropeTo(ropes[0], tip, pouchP.clone().add(V(0, 0, -.2))); ropeTo(ropes[1], tip, pouchP.clone().add(V(0, 0, .2)));
    pouch.position.copy(pouchP).add(V(0, -.12, 0)); pouch.rotation.z = phi + Math.PI / 2 + Math.PI;
    winchRope.visible = winch > .01; if (winchRope.visible) ropeTo(winchRope, V(wx, base.position.y + 1.5, 0), tip);
    return pouchP.clone();
  }
  // release: the whole trebuchet is placed so the pouch leaves at (s, RELEASE_Y + lift)
  TB.place = (s, L = 0) => {
    const ds = s - TB.s; TB.s = s; TB.lift = L; T.position.x = s;
    rollers.forEach(r => { r.rotation.z -= ds / .22; r.position.y = L + .22; });
    base.position.y = L + ROLL_Y;
    const courses = Math.round(L / .44); let n = 0;
    for (let c = 0; c < courses && n < CRIB_N - 1; c++) {
      const y = c * .44 + .22 + (L - courses * .44);
      if (c % 2) { for (const z of [-1.8, 1.8]) crib.setMatrixAt(n++, new THREE.Matrix4().compose(V(-4.9, y, z), new THREE.Quaternion(), V(12.4, .42, .46))); }
      else { for (const x of [-10.2, -4.9, .4]) crib.setMatrixAt(n++, new THREE.Matrix4().compose(V(x, y, 0), new THREE.Quaternion(), V(.46, .42, 4.4))); }
      if (n >= CRIB_N - 3) break;
    }
    crib.count = L > .05 ? n : 0; crib.instanceMatrix.needsUpdate = true;
    pose(TB.theta, TB.phi);
  };
  TB.release = () => V(TB.s, RELEASE_Y + TB.lift, 0);
  TB.pouch = () => pouchP.clone().add(V(T.position.x, 0, 0));
  const PHI0 = rad(-34), PHI1 = SDIR - Math.PI * 2;
  TB.swing = u => { u = clamp(u, 0, 1); const k = u * u * (1.6 - .6 * u); pose(lerp(TH_REST, TH_REL, k), lerp(PHI0, PHI1, Math.pow(u, 2.3))); return TB.pouch(); };
  // after the release: the arm overshoots, swings back and hangs upright, the empty sling flops
  TB.settle = v => { v = clamp(v, 0, 1); const th = TH_REL - rad(28) * Math.sin(v * Math.PI * .9) * Math.exp(-v * 1.2) + (rad(88) - TH_REL) * (1 - Math.cos(v * Math.PI)) / 2;
    const ph = lerp(SDIR, rad(-90), 1 - Math.pow(1 - v, 3)); pose(th, ph); };
  TB.cock = w => { w = clamp(w, 0, 1); const k = w * w * (3 - 2 * w); pose(lerp(rad(88), TH_REST, k), lerp(rad(-90), PHI0, k), 1 - Math.abs(2 * w - 1)); };
  TB.place(0, 0); pose(TH_REST, PHI0);
  return TB;
}

/* ======================================================================
   The flight: a glowing tube along y = f(x) in the plane z = 0, drawn up to a progress p
   ====================================================================== */
const dashTex = (() => { let t = null; return () => t || (t = canvasTex(64, 8, (x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.fillRect(0, 0, w * .55, h); })); })();
export function makeFlight(scene, { color = 0xf2b45a, r = .14, dashed = false, opacity = .9, k = 1.5, seg = 160 } = {}) {
  const mat = new THREE.MeshBasicMaterial({ color: hdr(color, k), transparent: true, opacity, depthWrite: false });
  if (dashed) { const t = dashTex().clone(); t.wrapS = THREE.RepeatWrapping; t.needsUpdate = true; mat.alphaMap = t; }
  const m = new THREE.Mesh(new THREE.BufferGeometry(), mat); m.visible = false; m.userData.noAO = true; m.renderOrder = 3; m.frustumCulled = false; scene.add(m);
  class Arc extends THREE.Curve { constructor(f, a, b) { super(); this.f = f; this.a = a; this.b = b; } getPoint(t, out = V()) { const x = lerp(this.a, this.b, t); return out.set(x, this.f(x), 0); } }
  const F = { mesh: m, p: 1 };
  F.set = (f, x0, x1) => {
    m.geometry.dispose(); m.geometry = new THREE.TubeGeometry(new Arc(f, x0, x1), seg, r, 6, false);
    if (dashed) mat.alphaMap.repeat.set(Math.max(1, Math.round(Math.abs(x1 - x0) / 2.2)), 1);
    F.progress(F.p); m.visible = true; return F;
  };
  F.progress = p => { F.p = clamp(p, 0, 1); m.geometry.setDrawRange(0, Math.floor(F.p * seg) * 6 * 6); m.visible = F.p > 0; };
  F.hide = () => { m.visible = false; };
  return F;
}

export function makeStone(K) {
  const g = new THREE.Group(), m = new THREE.Mesh(roughStone(.42, 3, 5), K.mats.stone); m.castShadow = true; g.add(m);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(64, 64, (x, w, h) => { const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,236,200,.9)'); gr.addColorStop(.35, 'rgba(255,220,170,.25)'); gr.addColorStop(1, 'rgba(255,220,170,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); }), transparent: true, opacity: .45, depthWrite: false }));
  halo.scale.setScalar(2.4); halo.userData.noAO = true; g.add(halo); g.userData.halo = halo; g.userData.rock = m;
  K.follow?.(g, 1.3);   // baked tiers: a small shadow on the ground under it, fading with height
  return g;
}

/** A faint metric grid in the throw plane z = 0: lines every step (bolder every 2 steps). */
// ink (optional): { fill, mid, major, axisR } — the paper's tint, the 5 m and 10 m line colours and the axes' radius;
// soft: true → no frame, edges that fade, the paper hidden by what stands in front of it; pole, rope (materials) and
// ground(x) → the axes as a graduated mast and a rope on stakes, part of the scene
const INK0 = { fill: 'rgba(6,10,14,.38)', mid: 'rgba(255,250,240,.42)', major: 'rgba(255,250,240,.78)', axisR: .16 };
export function graphGrid(scene, { x0 = -20, x1 = 100, y0 = 0, y1 = 45, step = 5, ink = null } = {}) {
  const I = { ...INK0, ...ink };
  // the graph's paper: a dark glass sheet in the throw plane with the grid painted on it (crisp at any distance,
  // unlike 1-pixel GL lines), thick x and y axes with arrowheads, so the plane reads clearly over the castle
  const W = x1 - x0, H = y1 - y0, ppm = 16, cw = Math.round(W * ppm), ch = Math.round(H * ppm);
  const tex = canvasTex(cw, ch, (c, w, h) => {
    c.fillStyle = I.fill; c.fillRect(0, 0, w, h);
    const X = x => (x - x0) * ppm, Y = y => h - (y - y0) * ppm;
    for (let x = Math.ceil(x0 / 1) * 1; x <= x1; x += 1) { const major = x % (step * 2) === 0, mid = x % step === 0; if (!mid && !major) continue; c.strokeStyle = major ? I.major : I.mid; c.lineWidth = major ? 4 : 2.5; c.beginPath(); c.moveTo(X(x), 0); c.lineTo(X(x), h); c.stroke(); }
    for (let y = Math.ceil(y0); y <= y1; y += 1) { const major = y % (step * 2) === 0, mid = y % step === 0; if (!mid && !major) continue; c.strokeStyle = major ? I.major : I.mid; c.lineWidth = major ? 4 : 2.5; c.beginPath(); c.moveTo(0, Y(y)); c.lineTo(w, Y(y)); c.stroke(); }
    if (!I.soft) { c.strokeStyle = I.major; c.lineWidth = 4; c.strokeRect(1.5, 1.5, w - 3, h - 3); }
    else {   // soft: no frame; the paper and its lines thin out toward the edges like chalk lines in the dusk air
      c.save(); c.globalCompositeOperation = 'destination-in'; c.translate(w / 2, h / 2); c.scale(w * .5, h * .5);   // every edge fades to nothing
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.6, 'rgba(0,0,0,.94)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gr; c.fillRect(-2, -2, 4, 4); c.restore();
    }
  });
  tex.anisotropy = 8;
  const g = new THREE.Group();
  // soft: the paper sits in the scene (what stands in front of it hides it); the curves drawn on it still read through
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 1, depthWrite: false, depthTest: !!I.soft, fog: false, toneMapped: false }));
  sheet.position.set((x0 + x1) / 2, (y0 + y1) / 2, -.06); sheet.userData.noAO = true; sheet.userData.op = 1; sheet.renderOrder = 1; g.add(sheet);
  // the axes: solid bars with arrowheads (x to the right, y up), drawn over the paper
  const axMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .95, depthWrite: false, depthTest: false, fog: false, toneMapped: false });
  const bar = (len, rot, pos) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(I.axisR, I.axisR, len, 10), axMat); m.rotation.z = rot; m.position.copy(pos); m.userData.noAO = true; m.renderOrder = 2; g.add(m); };
  const tip = (rot, pos) => { const m = new THREE.Mesh(new THREE.ConeGeometry(I.axisR * 3.4, 1.6 + I.axisR * 2, 14), axMat); m.rotation.z = rot; m.position.copy(pos); m.userData.noAO = true; m.renderOrder = 2; g.add(m); };
  const solids = [], rig = { bands: [], stakes: [] };
  if (!I.pole) { bar(W + 2, Math.PI / 2, V((x0 + x1) / 2 + 1, .05, 0)); tip(-Math.PI / 2, V(x1 + 2.6, .05, 0)); bar(H + 2, 0, V(0, (y0 + y1) / 2 + 1, 0)); tip(0, V(0, y1 + 2.6, 0)); }
  else {
    // the axes as the engineers' own survey: a graduated wooden mast for heights beside the trebuchet, a taut rope on
    // stakes for distances, stretched across the moat to the wall. A thin light line on each keeps the reading exact.
    const solid = (geo, mat, x, y, z = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.z = rz; m.castShadow = true; m.receiveShadow = true; g.add(m); solids.push(m); return m; };
    const gy = I.ground ? I.ground(0) : 0, mh = y1 + 2 - gy, rl = W + 2;
    // built from their base, so reveal(u) can raise the mast and run the rope out along the ground
    rig.mast = solid(new THREE.CylinderGeometry(.2, .26, mh, 10).translate(0, mh / 2, 0), I.pole, 0, gy, -.35);
    const band = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: .8 });
    for (let y = 10; y <= y1; y += 10) rig.bands.push([y, solid(new THREE.CylinderGeometry(.27, .27, .35, 10), band, 0, y, -.35)]);
    rig.top = solid(new THREE.ConeGeometry(.34, 1.2, 10), I.pole, 0, y1 + 2.6, -.35);
    rig.rope = solid(new THREE.CylinderGeometry(.11, .11, rl, 6).translate(0, rl / 2, 0), I.rope, x0, .12, -.2, -Math.PI / 2);
    for (let x = Math.ceil(x0 / 10) * 10; x <= x1; x += 10) { const gr = I.ground ? I.ground(x) : 0; if (x === 0 || Math.abs(gr) > .6) continue; rig.stakes.push([x, solid(new THREE.CylinderGeometry(.13, .16, 2, 6), I.pole, x, gr + .6, -.2)]); }
    rig.mh = mh; rig.gy = gy; rig.rl = rl;
    bar(W + 2, Math.PI / 2, V((x0 + x1) / 2 + 1, .05, 0)); bar(H + 2, 0, V(0, (y0 + y1) / 2 + 1, 0));
  }
  axMat.userData = { op: .95 };
  // the paper is drawn over everything (depthTest off, so the graph reads through the walls). Seen from the side it would
  // cover things standing in front of it like a pane of glass, so it also fades with the view: full face-on, gone edge-on.
  // view(camera) runs every frame (stage.js); fade(k) is the lesson's own fade on top of that.
  let base = 1, vk = 1;
  const apply = () => { const k = base * vk; sheet.material.opacity = k; axMat.opacity = (I.pole ? .5 : .95) * k; g.visible = k > .01 || (!!I.pole && solids.some(o => o.visible)); };
  const mid = V((x0 + x1) / 2, (y0 + y1) / 2, 0), dir = V();
  g.userData.fade = k => { base = k; if (rig.mast) { rig.mast.scale.y = rig.rope.scale.y = 1; rig.top.position.y = rig.gy + rig.mh + .6; solids.forEach(o => { o.visible = k > .5; }); } apply(); };
  // reveal(u), u ∈ [0, 1]: the survey is set up in front of the viewer: the mast rises, the rope runs out to the wall and its
  // stakes go in as it passes, the paper's lines come up with them (only with pole/rope; otherwise it is fade(u))
  g.userData.reveal = u => {
    if (!rig.mast) { g.userData.fade(u); return; }
    const m = Math.max(.001, Math.min(1, u * 1.25)), r = Math.max(.001, Math.min(1, (u - .15) * 1.3)), top = rig.gy + rig.mh * m, reach = x0 + rig.rl * r;
    rig.mast.scale.y = m; rig.top.position.y = top + .6; rig.rope.scale.y = r;
    base = Math.max(0, Math.min(1, (u - .35) / .65)); apply();
    solids.forEach(o => { o.visible = u > .001; });
    rig.bands.forEach(([y, o]) => { o.visible = u > .001 && top >= y; }); rig.stakes.forEach(([x, o]) => { o.visible = u > .001 && reach >= x; });
  };
  g.userData.view = cam => { dir.copy(mid).sub(cam.position).normalize(); const t = clamp((Math.abs(dir.z) - .35) / .4, 0, 1), v = t * t * (3 - 2 * t); if (Math.abs(v - vk) > .005) { vk = v; apply(); } return vk; };
  g.renderOrder = 1; scene.add(g); return g;
}
