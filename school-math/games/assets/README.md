# Lesson-games assets

All files here are from [Poly Haven](https://polyhaven.com) and are **CC0** (public domain: free to
use, modify and ship, with no attribution required). They were downloaded at 1k resolution on
2026-09-11 through the Poly Haven API. Load them with `engine/assets.js`: `pbr()` for textures,
`hdri()` for HDRIs, and `model()` / `prop()` for models.

## HDRI (lighting and reflections)

| File | Used by |
|---|---|
| `industrial_sunset_02` | pythagoras: dusk light on the site |
| `empty_warehouse_01` | prime-vault: reflections on the steel |
| `bell_tower` | clock-tower: light inside the tower |
| `qwantani_dusk_2_puresky` | roman theatre series: the dusk sky over Amman |

## Textures (PBR sets: diff, nor_gl, rough, ao)

| File | Used by |
|---|---|
| `brown_mud_02` | pythagoras: the ground |
| `concrete_block_wall` | pythagoras: the block wall |
| `rough_wood` | pythagoras: stakes and the pallet |
| `floor_tiles_06` | pythagoras: floor tiles |
| `concrete_wall_008` | prime-vault: walls |
| `concrete_floor_02` | prime-vault: floor |
| `metal_plate_02` | prime-vault: door and frame steel |
| `corrugated_iron_02` | date-factory: walls |
| `concrete_floor_painted` | date-factory: floor |
| `hessian_230` | date-factory: date sacks |
| `castle_wall_slates` | clock-tower: stone walls |
| `old_wooden_floor_01` | clock-tower: floor |
| `medieval_wood` | clock-tower: beams |
| `large_sandstone_blocks` | roman theatre series: the seat rows |
| `white_sandstone_blocks_02` | roman theatre series: walls |
| `monastery_stone_floor` | roman theatre series: the orchestra paving |
| `old_mosaic_floor` | roman theatre series: the stage mosaic |
| `sandstone_cracks` | roman theatre series: broken stones |
| `rocky_trail` | roman theatre series: the hillside |

## Models (glTF, in metres)

| File | Used by |
|---|---|
| `cement_bag` | pythagoras |
| `concrete_road_barrier` | pythagoras |
| `measuring_tape_01` | pythagoras |
| `portable_searchlight` | pythagoras |
| `wooden_crate_01` | pythagoras |
| `trowel_01` | pythagoras |
| `sledgehammer_01` | pythagoras |
| `classic_laptop` | prime-vault |
| `metal_office_desk` | prime-vault |
| `security_camera_01` | prime-vault |
| `mounted_fluorescent_lights` | prime-vault |
| `cardboard_box_01` | date-factory |
| `plastic_crate_01` | date-factory |
| `hanging_industrial_lamp` | date-factory |
| `hand_truck` | date-factory |
| `bench_vice_01` | clock-tower |
| `small_oil_can_01` | clock-tower |
| `pliers` | clock-tower |
| `screwdriver` | clock-tower |
| `Lantern_01` | clock-tower |
| `wooden_stool_01` | clock-tower |
| `vintage_pocket_watch` | clock-tower |
| `marble_bust_01` | roman theatre series |
| `boulder_01` | roman theatre series |
| `stone_01` | roman theatre series |
| `wooden_ladder` | roman theatre series |
| `wooden_bucket_01` | roman theatre series |

Add new assets the same way: 1k, CC0, with a row here.

**Compressed for the web (2026-09-11).** Every game loaded 10–23 MB of textures, so starting a game
took seconds even locally. Files keep their `_1k` names so no code changes, but:
- colour maps (`_diff_`) stay 1024 px, re-encoded as JPEG quality 80;
- normal, roughness, AO and ARM maps are 512 px, quality 88 (enough at our view distances);
- emission maps are unchanged.

The untouched 1k originals are in `archive/assets-1k-originals/` (local only). New assets must be
compressed the same way.

## Tier variants: lighter models and KTX2 textures (2026-09-14)

Weak GPUs and smart boards get lighter copies of every model and PBR set. `engine/assets.js` asks
`quality.js` `detectTier()` for the device tier (`?q=high|medium|low|board` forces it) and loads:

| Tier | Models | PBR sets (`pbr()`) |
|---|---|---|
| high | the originals, `<name>_1k.gltf` (WebP) | the originals, `_1k.jpg` |
| medium | `<name>_mid.gltf`: ≈50% of the triangles, KTX2 ≤1024 (normals ≤512) | `_<px>.ktx2`, colour ≤1024 |
| low, board | `<name>_low.gltf`: ≈20% of the triangles, KTX2 ≤512 (normals ≤256) | `_<px>.ktx2`, ≤512 (normals ≤256) |

**Names.** Originals are never touched; variants sit next to them:
- `models/<name>/<name>_mid.gltf` + `<name>_mid.bin` + `textures/<name>_<map>_mid.ktx2` (and `_low` the same way);
- `textures/<set>/<set>_<map>_<px>.ktx2`, where `<px>` is the long side (1024, 512 or 256). Mid and low share
  a file when they use the same size. These are stored flipped vertically, so they show the same way round as
  the JPEGs with `flipY = false`.
- `variants.json` lists what exists; `assets.js` reads it and falls back to the original for anything missing.
  `variants-stats.json` holds the numbers below.

**Encoding.** ETC1S (Basis LZ) for colour, ORM/ARM, roughness, AO and emission; UASTC + Zstd for normal maps;
meshopt geometry as before. The Basis transcoder comes from the jsdelivr CDN, with three 0.160.

**Rebuild** after adding or changing a model or PBR set (idempotent: only stale variants are rebuilt, and
`--force` rebuilds everything, about 2 minutes):

```
npm i @gltf-transform/cli@4.5.0 --prefix <tools>        # and extract KTX-Software-4.4.2-Linux-x86_64.tar.bz2 into <tools>
node school-math/games/tools/build-assets.mjs --tools <tools> [--only boulder_01,rough_wood] [--force]
```

**Totals** (VRAM is estimated: RGBA8 for WebP/JPEG, 4 bpp ETC1S, 8 bpp UASTC, +⅓ for mipmaps):

| | Triangles | Download | Texture VRAM |
|---|---|---|---|
| 27 models, original → mid → low | 389k → 207k → 91k | 6.9 → 12.4 → 4.9 MB | 224 → 33 → 12 MB |
| 19 PBR sets, original → mid → low | – | 7.0 → 9.1 → 3.6 MB | 177 → 25 → 11 MB |

Mid downloads more than the originals: UASTC normal maps are about 4× bigger than WebP. It still takes a
seventh of the GPU memory. Models that simplify badly: `plastic_crate_01` keeps 56% of its triangles
on low (its grid of holes is locked). `stone_01` and `bench_vice_01` keep over 80% on mid. `cement_bag`
(844 triangles) is left whole on mid.
