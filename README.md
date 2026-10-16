# Hollow Pines — vertical slice

Stylized frontier open-world game: rounded, expressive characters with procedural animation, and systemic RDR2-style gameplay. Three.js (r128), plain JavaScript, no build step beyond concatenation.

## Layout
- `src/shell.html` — HUD, menus, touch controls, styles
- `src/01_core.js` — utilities, noise, input (keyboard/mouse/touch), synthesized audio
- `src/02_world.js` — terrain heightfield, colliders and line of sight, building generator
- `src/03_rig.js` — character and quadruped rigs, animator (blending, layered actions, foot IK, squash and stretch), horse gaits
- `src/03b_gltf.js` — imported character model and `ClipAnimator` (AnimationMixer clips, crossfades, leg IK)
- `src/03c_animstate.js` — locomotion state machine (`LocoFSM`) shared by the player and NPCs
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
python3 test_controller.py           # 45 checks: movement, frame-rate independence, animation states and crossfades, camera, collision, real touch input
```
Tests need Playwright with Chromium (set `PW_CHROMIUM=/path/to/chrome` to use a specific browser build) and `three.min.js` (r128) next to `test.html`. Each playthrough saves, reloads the page, presses Continue, and verifies the decisions survived.

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

## Character controller
`Player` (`src/06_entities.js`) reads keyboard, mouse and the touch joystick into one camera-relative input vector (diagonals normalized, opposite keys cancel). Physics runs in fixed 1/120 s sub-steps, so speed, stopping distance and jump height are the same at any frame rate. Tuning lives in `PLAYER`: walk 1.7 m/s (Ctrl or a light stick push), jog 3.9 (default), sprint 6.8 (Shift / Run), crouch 1.5 (C). Acceleration and deceleration are eased, turning is eased with a top turn speed, and jumps have anticipation, coyote time and input buffering. Collision uses the existing `Col` spatial hash; velocity is replaced by the motion that actually happened after collision, so walking into a wall stops the run cycle and leaves only the slide along it. Hard landings slow you briefly.

Input is released when the window loses focus or is hidden, and when a touch is cancelled, so keys, the stick and buttons can't stay stuck. Touches that start on the stick or a button never rotate the camera.

## Animation states
`LocoFSM` picks one explicit state from measured speed, grounded state, vertical speed, input, crouch and dodge: `idle, startWalk, walk, jog, sprint, jumpStart, rising, falling, landing, crouchIdle, crouchWalk, dodge`. `ClipAnimator` crossfades every clip toward that state's target weights over `LOCO.FADE[state]` (frame-rate independent) and normalizes the weights, so blends never drift toward the bind pose.

| State | Source |
|---|---|
| idle | Idle clip |
| startWalk | Idle→Walk clips blended by speed, plus a procedural forward lean |
| walk | Walk clip |
| jog | Walk + Run clips blended by speed (no jog clip in the model) |
| sprint | Run clip, plus a procedural forward lean |
| jumpStart / rising / falling / landing | sections of the Jump clip |
| crouchIdle / crouchWalk | Idle / Walk clips with procedural crouch (hips lowered, spine bent, legs re-solved by IK); no crouch clips in the model |
| dodge | Roll clip |

Retargeted clips (Quaternius Universal Animation Library 2, CC0) replace originals where they read better: jump take-off and landing use the NinjaJump crouches, eating standing still uses Consume, searching uses Chest_Open, mantling uses ClimbUp, getting up after a knockout uses LayToIdle, and Ezra harvests his field with Farm_Harvest. If the extra data is missing, every action falls back to the original clip.

Gait phase follows distance travelled using the stride measured from the clips, and two-bone leg IK keeps feet on slopes. Missing assets that would improve this: dedicated jog, crouch-idle/crouch-walk, jump start/land, turn-in-place and start/stop clips for the same 23-bone rig.

## Run locally
```
python3 build.py
python3 -m http.server 8000         # then open http://localhost:8000/game.html
```

## Retargeted animation clips
`tools/retarget.py` moves clips from Quaternius's Universal Animation Library (a UE5-style 65-bone skeleton) onto the game's 23-bone character and writes `assets/anim/<pack>.json`; `build.py` embeds every file there as `window.EXTRA_ANIMS`.
```
python3 build.py                                          # test.html is needed by the tool
python3 tools/retarget.py UAL2_Standard.glb --preview     # contact sheets in tools/out/ (game character above, source below)
python3 tools/retarget.py UAL2_Standard.glb --write       # writes assets/anim/UAL2_Standard.json
python3 build.py
```
How it works: each target bone takes the source bone's rotation change, measured from matching relaxed standing poses (the character's Idle and a standing frame of the pack), so the chibi keeps its own posture. Hips use source motion scaled by hip height, and the IK foot targets sit at the end of each retargeted leg. Each pack needs a reference frame in `REF` and a reviewed clip list in `CLIPS`. Some clips don't survive the change in proportions; the list notes which ones were left out and why. The source packs aren't committed (they are 8 MB or more); download them from quaternius.com.

Credits: animations from the Universal Animation Library 2 by Quaternius (quaternius.com), CC0 1.0.
