# Hollow Pines — vertical slice

Stylized frontier open-world game: rounded, expressive characters with procedural animation, and systemic RDR2-style gameplay. Three.js (r128), plain JavaScript, no build step beyond concatenation.

## Layout
- `src/shell.html` — HUD, menus, touch controls, styles
- `src/01_core.js` — utilities, noise, input (keyboard/mouse/touch), synthesized audio
- `src/02_world.js` — terrain heightfield, colliders and line of sight, building generator
- `src/03_rig.js` — character and quadruped rigs, animator (blending, layered actions, foot IK, squash and stretch), horse gaits
- `src/04_state.js` — items, persistent world state `S`, inventory, reputation, save/load
- `src/05_systems.js` — interaction prompts, law and witnesses, dialogue engine, mission framework
- `src/06_entities.js` — player, horse, NPC AI (schedules, witnesses, combat, cover), wildlife
- `src/07_content.js` — sky, time and weather, world layout, containers, clues, doors
- `src/08_story.js` — cast, reactive dialogue, missions, encounters
- `src/09_ui.js` — HUD, panels, map, shop, camp, fishing
- `src/10_main.js` — boot, camera (including the two-shot conversation camera), main loop, test hooks (`window.HP`)

Placeholder art lives in the factory functions (`makeHumanoid`, `makeQuad`, `building`, `World.*`), so models can be swapped without touching gameplay code.

## Build and test
```
python3 build.py                     # writes game.html (CDN three.js) and test.html (local three.min.js)
cd tests
python3 test_mechanics.py            # 50 checks: movement, skeleton and gait, camera, touch UI, climbing, gathering, store, horse, hunting, camp, fishing, law, NPCs, doors, day/night, encounters, save slots
python3 test_story.py                # 91 checks: two full playthroughs with opposite choices, plus failure and retry
```
Tests need Playwright with Chromium and `three.min.js` (r128) next to `test.html`. Each playthrough saves, reloads the page, presses Continue, and verifies the decisions survived.

## Mission framework
Missions are data: stages, objectives (`O.goto`, `O.talk`, `O.item`, `O.clues`, `O.defeat`, `O.check`), optional objectives, fail rules, branching `next`, `prereq` and `blocked` conditions, and `complete`/`failOutcome` hooks that write to world state. Mission types: main, side, hunt, bounty, plus dynamic encounters. A failed mission offers Retry (restores a checkpoint taken at mission start) or Accept (the failure becomes part of the story).

## Animation system
Characters are `THREE.Bone` skeletons (17 bones) driving skinned meshes, so joints bend smoothly. `Animator` blends: a locomotion blend tree over authored walk/jog/run/sneak cycles (Catmull-Rom keyframes, stride derived from leg geometry so phase follows distance travelled), upper-body layers (aim, carry, block), one-shot clips with events (jump anticipation, landing, skid, punches, hits, pickup, search, mount…), two-bone leg IK with stance-foot weighting on slopes, head look-at, and spring secondary motion (hat, hair, coat, squash and stretch). The procedural rig is now the fallback.

## Quality presets
Settings → Quality: Low (no shadows, sparse grass), Medium (character and building shadows), High (tree shadows, 2048 shadow map). Auto picks Medium on phones and High on desktop. Grass is chunked and distance-culled; distant characters are hidden.

## Imported character model
`assets/character.glb` (Quaternius-style rig: 23 bones, 17 clips) is embedded into game.html as base64 by build.py and cloned for every person (`makeModelHumanoid` in `src/03b_gltf.js`). `ClipAnimator` keeps the same interface as the procedural animator:
- Idle/Walk/Run (and the carry versions) blend by speed; clip time follows distance travelled, using the stride measured from the clips at load.
- Gameplay actions map to clips (`CLIPMAP`): Punch, PickUp, Roll, RecieveHit, Jump, StandUp, SwordSlash. Arm gestures without a clip (`GESTURES`) are layered on top.
- Aim, carry, hands-up and reins are pose snapshots taken from the clips.
- Two-bone leg IK re-plants the feet every frame (slopes, crouching, stirrups).
Materials are recoloured per character and the helmet is replaced by the game's hats. To swap the model, replace `assets/character.glb` with another rig that uses the same bone names, then run `python3 build.py`. If the model fails to load, the game falls back to the procedural characters.
