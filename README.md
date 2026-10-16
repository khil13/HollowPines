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
- `src/08b_ch4.js` — Chapter 4, Night at Willow Bridge (tail, eavesdrop, confrontation)
- `src/09_ui.js` — HUD, panels, map, shop, camp, fishing
- `src/10_main.js` — boot, camera (including the two-shot conversation camera), main loop, test hooks (`window.HP`)

Placeholder art lives in the factory functions (`makeHumanoid`, `makeQuad`, `building`, `World.*`), so models can be swapped without touching gameplay code.

## Build and test
```
python3 build.py                     # writes game.html (CDN three.js) and test.html (local three.min.js)
cd tests
python3 test_mechanics.py            # 50 checks: movement, skeleton and gait, camera, touch UI, climbing, gathering, store, horse, hunting, camp, fishing, law, NPCs, doors, day/night, encounters, save slots
python3 test_story.py                # 91 checks: two full playthroughs with opposite choices, plus failure and retry
python3 test_controller.py           # 54 checks: movement, frame-rate independence, animation states and crossfades, camera, collision, real touch input, retargeted clips
python3 test_pwa.py                  # 6 checks: manifest, icons, installability, offline play
python3 test_camps.py                # 15 checks: traveler camps (routine, night theft, waking sleepers, hold-ups) and outlaw hideouts (takedowns, clearing, loot, reoccupation)
python3 test_gunplay.py              # 10 checks: aim-in speed, camera keeping up with the mouse, soft lock, hit zones, misses, recoil, spread
python3 test_ch4.py                  # 34 checks: Chapter 4 start, unseen tail, eavesdropping, four endings, failure, retry and reload
```
Tests need Playwright with Chromium (set `PW_CHROMIUM=/path/to/chrome` to use a specific browser build) and `three.min.js` (r128) next to `test.html`. Each playthrough saves, reloads the page, presses Continue, and verifies the decisions survived.

## Camps
Gameplay follows Red Dead Redemption 2; only the animation style takes after Sneaky Sasquatch. `src/07b_camps.js`:
- **Traveler camps** (Teague's Camp, Holt Hunting Camp): trappers work near camp by day, sit at the fire in the evening and sleep at night. Greet them, ask about the area (they'll mark the outlaw hideout on your map), or rob them. Sneak in crouched to loot their satchel and lockbox: sleepers only notice someone standing right beside them, and walking upright past a bedroll wakes them. Anyone who sees a theft is a witness, which brings honor loss and a bounty through the normal law system. Aim at someone until their hands go up, then choose **Rob** (a witnessed robbery: honor -8, bounty). They remember you.
- **Outlaw hideout** (Rattlesnake Hollow, Crane gang): two sentries patrol and two outlaws sit at the fire facing inward. Crouched, you aren't noticed from behind, so a punch from behind is a silent takedown; otherwise it's a shootout using the cover AI. Downed outlaws stay down. When nobody's left standing the hideout is cleared and its lockbox (gold, cash, ammo) is free loot; breaking it open while the gang is still around makes them suspicious. Killing outlaws costs no honor. Cleared hideouts are reoccupied after five days.

## Gunplay
RDR2-style aiming (`aimTick`, `shoot` and `rayHit` in `src/06_entities.js`; the aim camera in `src/10_main.js`):
- **Aim** (right mouse, or the Aim button on touch) moves the camera over the shoulder and zooms in within about 0.2 s. While aiming the camera doesn't trail behind the mouse, and mouse sensitivity drops slightly to match the zoom.
- **Soft lock:** pressing aim swings the reticle onto the nearest target near the middle of the screen, preferring anyone already fighting you. The reticle turns red over a target.
- **Shots go where the reticle points.** People have head, body and leg zones (head x2.5 damage, legs x0.65): a revolver headshot drops most men, a body shot takes 40. Animals keep their hit sphere. There's a little bullet magnetism toward the locked target, and no hidden dice rolls on aimed shots.
- **Recoil and spread:** each shot kicks the view up, and it settles back within a fraction of a second. Firing fast widens the spread, as does moving or shooting from horseback. The reticle widens with it. Hip fire is likelier to hit the closer the target is.
- Hit markers: white for a body hit, red for a headshot.

## Chapter 4: Night at Willow Bridge
Unlocks after Chapter 3. Ask Cora about the sheriff (Mae, if Cora is dead), then watch the jail after 11 pm; Cora can wait with you until then.
- **Tail.** Pike walks out of town, down the road and over Willow Bridge, stopping now and then to look back. Stay out of his sight and hearing: crouch, keep your distance, don't ride up behind him. Being seen up close fills his suspicion and fails the tail. So does falling more than 55 m behind for ten seconds, or drawing on him.
- **Eavesdrop.** Silas Vane and two railroad guns wait on the east bank. They only talk while you're within earshot (20 m), so creep in through the brush. What they say depends on earlier choices: whether Pike brings Vane Eli's journal, how Brock Harlan was faced down, whether the Greers kept their farm, and whether Dutchy is riding with you. Vane lets slip that Eli is alive at Tamarack Pass. Halfway through, the two lean on the bridge rail with their backs to the bank, which is your window to lift Vane's ledger off the crate. If you're spotted, the meeting breaks up and Vane calls you over.
- **Settle it.** Show Vane Eli's journal (Pike turns on him; this needs the journal or Mae's copy, so it's impossible if you gave the journal to Pike), take Vane's $100 to leave the valley, draw on them (his men fight, Pike fights too if he brought the journal, Vane always runs), back away, or slip off with the ledger. If Dutchy is your ally he waits on the west bank and can spook their horses to pull the guards away.
- A reload mid-mission restarts the night at the jail. The result is recorded in `S.decisions.ch4`, `S.chars.pike` (`turned`, `left`, `dead`), `S.evidence.ledger` and `S.evidence.eli_alive` for Chapter 5.

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
| crouchIdle / crouchWalk | Crouch_Idle_Loop / Crouch_Fwd_Loop (retargeted from the Universal Animation Library); procedural crouch only if those are missing |
| dodge | Roll clip |

Retargeted clips (Quaternius Universal Animation Library 1 and 2, CC0) are used where they read better:
- crouching and sneaking: Crouch_Idle_Loop and Crouch_Fwd_Loop
- swimming: Swim_Idle_Loop and Swim_Fwd_Loop, blended by speed
- seated NPCs: Sitting_Idle_Loop, with Sitting_Talking_Loop at one saloon seat
- NPCs chatting or in dialogue: Idle_Talking_Loop
- kneeling (clues, skinning, hogtying): Fixing_Kneeling; doors: Interact; jab: Punch_Jab; hit reaction: Hit_Chest
- jump take-off and landing: the NinjaJump crouches
- eating while standing: Consume; searching: Chest_Open; mantling: ClimbUp; getting up: LayToIdle
- Ezra's field work: Farm_Harvest

If the extra data is missing, every one falls back to the original clip or procedural pose.

Gait phase follows distance travelled using the stride measured from the clips, and two-bone leg IK keeps feet on slopes. Still missing: a jog that suits chibi proportions (the library's walk, jog and sprint retarget into a hunched scramble, so the rig's own Walk/Run blend stays), plus turn-in-place and start/stop clips.

## Install on your phone
The game is published at **https://khil13.github.io/HollowPines/** whenever `main` passes CI (the `deploy` job in `.github/workflows/tests.yml`). It's an installable web app: once loaded it works offline and opens full screen.
- **iPhone/iPad (Safari):** open the link, tap Share, then Add to Home Screen.
- **Android (Chrome):** open the link, tap the ⋮ menu, then Install app (or Add to Home screen).

How it's built: `build.py` writes `site/` with a full page head, `manifest.webmanifest`, icons (`tools/make_icons.py` draws them into `assets/icons/`), local copies of three.js and an offline cache (`pwa/sw.js`). Each build has its own cache name, so an installed copy updates the next time it's opened while online. Saved games live in that browser on that device, separate from the claude.ai preview. `tests/test_pwa.py` checks the manifest, icons, installability and that the game runs offline.

One-time setup: in the repository's Settings, open Pages and set the source to **GitHub Actions**.

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
python3 tools/retarget.py UAL2_Standard.glb --write       # writes assets/anim/UAL2_Standard.json (same for UAL1_Standard.glb)
python3 build.py
```
How it works: each target bone takes the source bone's rotation change, measured from matching relaxed standing poses (the character's Idle and a standing frame of the pack), so the chibi keeps its own posture. Hips use source motion scaled by hip height, and the IK foot targets sit at the end of each retargeted leg. Each pack needs a reference frame in `REF` and a reviewed clip list in `CLIPS`. Some clips don't survive the change in proportions; the list notes which ones were left out and why. The source packs aren't committed (they are 8 MB or more); download them from quaternius.com.

Credits: animations from the Universal Animation Library and Universal Animation Library 2 by Quaternius (quaternius.com), CC0 1.0.
