# حصار الكرك: درسان في الاقتران التربيعي

Two versions of one 3D lesson game (Grade 9, unit 2.3, the quadratic function), taken out of the school-math site so they
can be opened and compared on their own.

- `school-math/games/karak-arc/`: the first version.
- `school-math/games/karak-arc-v2/`: the rebuilt version, «حصار الكرك، 1183». It follows Salah al-Din's side of the siege.
  Every mission starts with a try by feel that fails, and then the lesson's tool succeeds.

## Run it

The games are ES modules, so they need a local server (opening the file directly will not work):

```bash
python3 school-math/games/tools/serve.py 8753
```

Then open http://127.0.0.1:8753/ and pick a version.

Useful URL options: `?lang=en` (English), `?q=board|low|medium|high` (quality tier), `?teach` (teacher mode).

## What is inside

- `school-math/games/engine/`: the shared lesson-games engine (Three.js 0.160 from a CDN).
- `school-math/games/karak/`: the Karak world, stage and lab shared by both versions.
- `school-math/games/assets/`: only the CC0 Poly Haven models and textures these two lessons load (see its README).
- `math-lab/assets/`: KaTeX and one font, kept at the same paths the lessons expect.
