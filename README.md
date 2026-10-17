# Hollow Pines — vertical slice

Stylized frontier open-world game. Three.js (r128), plain JavaScript, no build step beyond concatenation.

**Design direction:** gameplay, combat and graphics ideas come from Red Dead Redemption 2 (systemic open world, honor and witnesses, hold-ups, gunplay, golden-hour light, weather). Sneaky Sasquatch was only early inspiration for the rounded look; everything else is our own.

## Layout
- `src/shell.html` — HUD, menus, touch controls, styles
- `src/01_core.js` — utilities, noise, input (keyboard/mouse/touch), synthesized audio
- `src/02_world.js` — terrain heightfield, water shader, colliders and line of sight, procedural wood textures, building generator
- `src/02c_grass.js` — the dense wind-blown grass field around the camera
- `src/03_rig.js` — character and quadruped rigs, animator (blending, layered actions, foot IK, squash and stretch), horse gaits
- `src/03b_gltf.js` — imported character model and `ClipAnimator` (AnimationMixer clips, crossfades, leg IK)
- `src/03c_animstate.js` — locomotion state machine (`LocoFSM`) shared by the player and NPCs
- `src/04_state.js` — items, persistent world state `S`, inventory, reputation, save/load
- `src/05b_skills.js` — skills and perks (Gunslinger, Brawler, Survivalist, Horseman), honor standing, phone vibration
- `src/05_systems.js` — interaction prompts, law and witnesses, dialogue engine, mission framework
- `src/06_entities.js` — player, horse, NPC AI (schedules, witnesses, combat, cover), wildlife
- `src/06b_brawl.js` — counters, grabs and shoves, hit reactions (limp, disarm, flinch), squad tactics (flank, suppression, rushes)
- `src/07_content.js` — sky, time and weather, world layout, containers, clues, doors
- `src/07c_interiors.js` — furnished interiors for every building
- `src/08_story.js` — cast, reactive dialogue, missions, encounters
- `src/08b_ch4.js` — Chapter 4, Night at Willow Bridge (tail, eavesdrop, confrontation)
- `src/08c_ch5.js` — Chapter 5, The Ledger (Survey Camp 3, allies, four endings)
- `src/08d_side.js` — bounty board, stranger missions, road encounters, travelers, landmarks
- `src/08f_town.js` — the living town (gunfire panic, the law's response), bounty hunters, Wren's wanted poster, road events, duels
- `src/08e_riders.js` — NPCs on horseback: posses, fleeing outlaws, mounted ambushers
- `src/09_ui.js` — HUD, panels, map, shop, camp, fishing
- `src/09b_post.js` — post-processing: ambient occlusion, bloom, colour grade, vignette, grain, anti-aliasing
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
python3 test_riders.py               # 17 checks: posses, riders shooting from the saddle, seated hitboxes, throwing riders, mounted runners and ambushers, weather sight/noise/lightning/mud
python3 test_gfx.py                  # 11 checks: sun arc and golden hour, dark nights, dawn mist, muzzle smoke, impacts, blood, gallop dust
python3 test_side.py                 # 27 checks: bounty board (alive, dead, runner), three stranger missions, road encounters, travelers, landmarks
python3 test_ch5.py                  # 23 checks: Chapter 5's four endings, allies fighting, silent takedown, quiet rescue, fail/retry, reload
```
Tests need Playwright with Chromium (set `PW_CHROMIUM=/path/to/chrome` to use a specific browser build) and `three.min.js` (r128) next to `test.html`. Each playthrough saves, reloads the page, presses Continue, and verifies the decisions survived.

## Camps
Gameplay follows Red Dead Redemption 2. `src/07b_camps.js`:
- **Traveler camps** (Teague's Camp, Holt Hunting Camp): trappers work near camp by day, sit at the fire in the evening and sleep at night. Greet them, ask about the area (they'll mark the outlaw hideout on your map), or rob them. Sneak in crouched to loot their satchel and lockbox: sleepers only notice someone standing right beside them, and walking upright past a bedroll wakes them. Anyone who sees a theft is a witness, which brings honor loss and a bounty through the normal law system. Aim at someone until their hands go up, then choose **Rob** (a witnessed robbery: honor -8, bounty). They remember you.
- **Outlaw hideout** (Rattlesnake Hollow, Crane gang): two sentries patrol and two outlaws sit at the fire facing inward. Crouched, you aren't noticed from behind, so a punch from behind is a silent takedown; otherwise it's a shootout using the cover AI. Downed outlaws stay down. When nobody's left standing the hideout is cleared and its lockbox (gold, cash, ammo) is free loot; breaking it open while the gang is still around makes them suspicious. Killing outlaws costs no honor. Cleared hideouts are reoccupied after five days.

## Living world
`Town` and `Duel` in `src/08f_town.js`:
- **Gunfire in Juniper Gap:** townsfolk run for the nearest door and cower inside until it's quiet. The sheriff or a deputy comes to see who's shooting and warns you once; shoot in town again and it's *disturbing the peace*. Outlaws' gunfire panics people too.
- **Bounty hunters:** with a bounty of $15 or more on you, out in the country, three mounted hunters ride you down. At low honor they come at $8. They're fair game. If they knock you out, you wake in the sheriff's office with the bounty paid from your money. They never come into town.
- **Wanted poster:** with a bounty, Wren's own poster goes up outside the sheriff's office. It has a sketch in your outfit colours and the reward, and you can read it or tear it down.
- **Road events:**
  - A settler's wagon with a broken wheel: help him for honor, a few dollars and coffee, or rob him.
  - From Chapter 2, a gunslinger calls you out to a duel. Ten paces, then wait for **DRAW!** and shoot first. Hold aim as you draw to shoot the gun from their hand and spare them (+honor). Draw early and they shoot you for cheating; too slow and they win.

## Character development
`Skills` in `src/05b_skills.js`. Four skills level from I to V by doing the thing itself, and each level unlocks a perk:
- **Gunslinger** (hits, headshots, disarms, duels): tighter spread → faster reloads → +20% headshot damage → aim settles twice as fast.
- **Brawler** (punches, counters, grabs, shoves): +15% punch damage → wider counter window → cheaper punches → longer grabs and harder shoves.
- **Survivalist** (skinning, fishing, foraging): animals notice you later → extra herbs and berries → extra meat → slower core drain.
- **Horseman** (riding, brushing and feeding): horse tires slower → faster bond → steadier saddle aim → faster gallop.

Honor shows as a standing, from Outlaw through Drifter to Hero of the Gap. The **Wren** tab in the satchel shows standing, health and stamina cores, skills and perks, and a record (duels, counters, disarming shots, kills, pelts, fish, crimes).

## Phone controls
- **Stick:** a floating stick appears wherever your left thumb lands. Push it to the rim and hold to break into a run.
- **Context buttons:** they appear when needed: Grab beside a brawler, Shove while holding, and a pulsing Block with a "Block!" cue when an enemy winds up (the moment to counter).
- **Aiming:** look is slower while aiming, for finer thumb aim.
- **Other:**
  - The phone vibrates on hits, counters and level-ups.
  - Duels fire from the Attack button.
  - Held upright, the phone asks to be turned sideways.
- **Settings → Touch controls:** touch look speed, button size (small/medium/large), left-handed layout, push-to-run and vibration.

## Polish pass
A full review of every system fixed about 50 issues.
- **Story:** no more soft-locks.
  - Mae, and Ezra until Chapter 3 is settled, are essential characters: they can be knocked down but not killed.
  - Chapter 4 unlocks even if the Greers' stand never happened.
  - The Chapter 2 goat path turns into a fight if Dutchy can't guide you.
  - Rook's proof drops however he falls.
  - Chapter 5's Crane plan works with any surviving Crane.
- **Missions:**
  - Retry always restarts cleanly from the first stage, and the fail screen pauses the world.
  - Timers from before a load or retry stand down (the `later()` helper).
  - Loading at camp keeps the camp.
  - Townsfolk you know can be woken at night.
- **Combat:**
  - Punches hurt again after a stun ends.
  - Grabs and pushes respect walls.
  - No shooting while carrying someone.
  - Disarmed riders and allies stop firing.
  - Hits on a rider never freeze the horse.
  - Despawned or loaded-away riders take their horses with them.
- **Town:**
  - Hiding townsfolk stay hidden.
  - Only the bounty hunters themselves can haul you in.
  - Road events stay on dry, open trail.
  - Wren's poster hangs on the street side.
- **Combat feel:**
  - Grabs, counters, duels and close fistfights pull the camera in over Wren's shoulder with both fighters in frame, unless you're steering it yourself.
  - Hits knock Wren back a step and stagger her.
  - Badly hurt, she limps and can't run, while the colour drains and the screen edges pulse red.
- **Performance:**
  - Rain darkens the ground in the shader instead of re-uploading the terrain colours.
  - The animators share one ground probe.
  - Chimney smoke puffs fade on their own.
- **Story threads that now pay off:** Ezra repays the $40 the Greers owe you, and once you've stood by them, the Greers' hay barn hides you from the law.
- **World:**
  - Picked bushes stay bare until they grow back.
  - Morning fog lifts within a few hours.
  - The stranded wagon is solid end to end.
- **Accuracy:**
  - A crouched outlaw's hitbox shrinks, so no headshots on empty air over cover.
  - A body on the ground counts as body.
  - A gun-hand hit no longer wins over a closer body hit.
  - Punch auto-aim ignores downed bodies.
  - No punches while swimming.
- **Input:**
  - The click that closes a menu isn't also a punch.
  - Scroll zoom is remembered.
  - Fishing can be stopped with a tap.
  - The floating stick resets cleanly.
  - Old banners don't replay after a load.
- **Look and feel:**
  - Nights are moonlit rather than black.
  - The camera stops at tree canopies and never looks out from inside Wren's head.
  - The desktop ammo counter is back.
  - The saloon lamps hang again.
  - Shift+number still switches weapons.
  - Squad callouts get Wren right ("She's reloading!").

## Close combat and squads
RDR2-style close combat, in our own style (`Brawl` and `Tactics` in `src/06b_brawl.js`):
- **Counter:** an enemy's swing has an audible wind-up. Raise your guard (Q) just before it lands and Wren slips the punch and hits back, and the attacker reels. A guard held up early only blocks.
- **Grab:** block + attack on someone in reach grabs them. While holding:
  - attack punches them;
  - X (or Q again) shoves them to the ground, and anyone behind them stumbles;
  - hold on too long and they wriggle free.
- **Where a bullet lands matters:**
  - Legs: they limp, sometimes dropping to a knee, and shoot worse.
  - Gun hand: the gun flies to the ground. Brave outlaws dive for it, or you can walk over and take it along with its rounds. Otherwise they come at you with their fists.
  - Body: a flinch that throws off their next shot.
- **Squads:**
  - With three or more gunmen, one in three swings around to your side.
  - Bullets whizzing past pin outlaws down in cover.
  - Reload in the open, or get badly hurt, and the nearest one charges you, with a shout.

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

## Chapter 5: The Ledger
The finale. Ride into the marker at the foot of the trail north of Coyote Mill and up to Survey Camp 3 at Tamarack Pass, where Vane holds Eli. Who waits at the overlook depends on the whole story:
- **Marshal Ruth Calder and a deputy** come if you still have evidence (Eli's journal, Mae's copy or Vane's ledger) or if Pike turned in Chapter 4. A turned Pike rides with them. They walk you to the gate and read Vane his warrant. Show the evidence and some of his men walk away, two if Pike is there to testify. The rest fight, Vane surrenders when they're down, and the marshal arrests him. **Ending: law.**
- **The Cranes** come if Dutchy is your ally, led by Fenwick (or Sal if Fenwick is dead). They open fire from the gate, and once Eli is free they execute Vane. **Ending: cranes.**
- **Alone:** cut Eli loose from the survey tent at the back of camp. Crouched takedowns from behind are silent, and getting him out with no alarm is an optional objective. Vane steps into the gate on the way out. Draw on him (**ending: gun**), or take his $200 and hand over every paper you carry (**ending: payout**). If you took his money in Chapter 4, he remembers.
- Allies fight Vane's men on their own: they pick targets, close in and shoot. Eli dying fails the mission, and a reload restarts it on the trail. Afterwards Eli lives in Juniper Gap (unless you took the payout), and an epilogue sums up the valley's fate.

## Interiors
Every building has a real interior. `building()` in `src/02_world.js` gives each one:
- Plank walls with darker wainscoting and a skirting board.
- Window frames on the inside and floorboard seams.
- Ceiling beams, and a ceiling that casts shadow, so rooms are shaded once the roof hides as you step in.

`src/07c_interiors.js` furnishes each building:
- **Sheriff's office:** desk with papers and a candle, chair, gun rack and cabinet, filing cabinet, map, stove, coat rack and hat. The jail cell has a cot and bucket.
- **Store:** flour sacks, crates, a goods table, candy jars, a scale, pans on the wall, extra shelves.
- **Saloon:** mirror behind the bar, bar stools, cards and chips on the tables, a candle chandelier, antlers, paintings, spittoons.
- **Mae's house:** table and chairs, stove, dish shelf, rug.
- **Doc's:** medicine shelf, washstand, folding screen.
- **Boarding house:** nightstands, washstand, coat hooks.
- **Greer farmhouse:** Nell's bed, table, stove, pantry shelf.
- **Barn, mill and Hollow Cabin:** furnished to match.

Furniture next to NPC paths and places (behind the counter, the end of the bar, beds, the sheriff's chair, the cabin's clue spots) has no collision, so routines and story scenes aren't blocked.

## Light, atmosphere and combat effects
RDR2-inspired, in our own style (`Sky` in `src/07_content.js`, `FX` in `src/06_entities.js`):
- The sun rises around 5:30 and sets around 20:00, so evenings match the street lamps and the night stealth. A long golden hour gives warm orange sunlight, a pink-orange sky, warm fog and a soft glare when you look toward the low sun.
- Nights are dark: ambient light drops, the moon gives a dim blue light, and lanterns burn brighter so they actually matter.
- At dawn (and in rain) low mist fills the valleys while hilltops rise out of it, then burns off by mid-morning.
- Gunfights: every shot (yours, enemies', allies') throws a muzzle flash and a drifting cloud of powder smoke. Misses kick up dirt and debris where they hit the ground, and hits draw a puff of blood. Galloping horses leave a trail of dust (darker mud when it's wet). Particles fade out and clean up, and the low quality setting uses fewer.

## Riders and weather
- **Mounted enemies** (`src/08e_riders.js`):
  - **Posses:** wanted out in the country (away from Juniper Gap), two lawmen ride out after you. They gallop in, ride alongside at pistol range and shoot from the saddle. Lose them and they turn back.
  - **Bounty runners** keep a horse saddled and flee on it.
  - **Crane ambushers** ride in.
  - **Shooting riders:** they have seated hitboxes, so head and body zones line up. Shooting the rider drops them out of the saddle while the horse bolts. Shooting the horse throws the rider, who is stunned (a bounty can then be hogtied) and gets up to fight on foot.
  - **Riderless horses** wander off.
- **Weather that matters:**
  - **Weather types:** clear, overcast, rain, thunderstorm and fog (fog in the mornings).
  - **Sight:** rain, storms and fog cut how far people see (to 75%, 60% and 45%).
  - **Noise:** rain and storms muffle your footsteps.
  - **Storms:** lightning lights up the valley, with thunder a moment later.
  - **Mud:** wet ground slows horses, both yours and NPCs'.

## Side content
RDR2-style things to do between (and after) story chapters, in `src/08d_side.js`:
- **Bounty board** at the sheriff's office. After Chapter 1, two wanted posters are always up, with a new one each day. Each poster names the outlaw, the crime, an alive and a dead reward, and the hideout they were seen near. There are six outlaws at five hideouts:
  - **Gangs** ride with two or three men.
  - **Runners** bolt the moment they see you, then fight if you catch them.
  - **The sleeper** dozes by the fire; sneak up and knock him out.
  - **The brawler** fights only with his fists, so beat him down with yours.
  - To turn one in, knock them out, hogtie them and carry them (or stow them on your horse) to the board for the full reward. Or bring proof from the body for the lower one.
- **Stranger missions:**
  - **Hank's Strike:** Hank's map, a shovel from Mae's, gold below Lookout Ridge, and claim jumpers you can persuade (honor 10+), pay or fight. Then split the gold with Hank, or lie.
  - **Doc's Medicine:** examine the robbed wagon on the cabin road, follow the tracks to the old quarry, and steal or fight for the crate. Doc treats you free afterwards.
  - **Still Life:** keep low and quiet while Percival Lumley photographs deer at Pine Hollow (standing or moving near them ruins the plate), then drive off the wolves.
- **Road encounters** near trails, once a day each:
  - **Hold-up:** road agents robbing a traveler. Shoot them, cut yourself in, or ride on.
  - **Snakebite:** a bitten traveler. Suck out the venom or give him a tonic.
  - **Ambush:** a cry for help that's really a trap.
- **Travelers** walk the trails in daylight (prospectors, farmhands, drifters, a preacher). You can greet or rob them like anyone else.
- **Landmarks:**
  - A telegraph line along the main road.
  - Juniper Gap Cemetery, with the Calloways' headstone.
  - Doc's wrecked wagon on the cabin road.
  - A fishing dock below the bridge.
  - Hay bales and a scarecrow at the Greer farm.
  - A carcass with circling vultures.
  - New signposts.

## Mission framework
Missions are data: stages, objectives (`O.goto`, `O.talk`, `O.item`, `O.clues`, `O.defeat`, `O.check`), optional objectives, fail rules, branching `next`, `prereq` and `blocked` conditions, and `complete`/`failOutcome` hooks that write to world state. Mission types: main, side, hunt, bounty, plus dynamic encounters. A failed mission offers Retry (restores a checkpoint taken at mission start) or Accept (the failure becomes part of the story).

## Animation system
Characters are `THREE.Bone` skeletons (17 bones) driving skinned meshes, so joints bend smoothly. `Animator` blends: a locomotion blend tree over authored walk/jog/run/sneak cycles (Catmull-Rom keyframes, stride derived from leg geometry so phase follows distance travelled), upper-body layers (aim, carry, block), one-shot clips with events (jump anticipation, landing, skid, punches, hits, pickup, search, mount…), two-bone leg IK with stance-foot weighting on slopes, head look-at, and spring secondary motion (hat, hair, coat, squash and stretch). The procedural rig is now the fallback.

## Rendering
All our own code, with no extra libraries, so the installed app still works offline:
- **Post-processing** (`Post`): the scene renders into a colour and depth target. A composite pass then adds:
  - normal-aware screen-space ambient occlusion, which darkens creases and contact shadows where crates, walls and steps meet the ground;
  - bloom for lanterns at night and the low sun;
  - a colour grade with contrast, richer colour, cool shadows and warm highlights (warmer at golden hour, cooler at night);
  - a vignette, fine film grain and an FXAA-style edge smooth.
- **Textures**: wall siding, interior panelling, floor planks and roof shingles are painted procedurally on canvases, then tinted by each building's colours. UVs are in metres so boards keep their size on any wall.
- **Grass field** (`Grass`): up to 70,000 single blades in one draw call.
  - Each blade has a fixed spot in the world, and the patch wraps around the camera.
  - The shader reads terrain height, ground colour and a grass mask from small textures. The mask keeps grass off trails, water, buildings, porches, rocks and steep slopes, and the town is thinned out.
  - Gusts roll across the field in waves, the player and horse push blades aside, and rain darkens it.
- **Grass reach:** past the dense patch, a sparser ring of wider blades carries the meadow out to about 50 m, so there's no hard edge.
- **Trees:** canopies and bushes are leafy clumps. Noise pushes the silhouette in and out, and light and dark clumps of leaves are painted across it.
- **Light shafts:** a screen-space pass marches from each pixel toward the sun, gathering open sky, so a low golden sun streams between trunks and branches. It's faint at noon and off at night.
- **Mud and puddles:** rain darkens trails and pond edges to mud, and puddles gather in them. The puddles reflect the sky, with rings where drops land.
- **Footprints:** boots and hooves leave prints in mud after rain, in snow and on the sandy river banks. Prints fade after a minute.
- **Water**: a height texture gives every pixel its depth.
  - Shallows are clear, the depths dark, and foam laps the shore.
  - Ripple normals reflect the current sky with fresnel and catch a hard sun glint.
  - Rain roughens the surface.

## Quality presets
Settings → Quality, which now applies immediately:
- Low: no shadows, no post-processing, sparse grass.
- Medium: character and building shadows, colour grade, bloom and a 26k-blade grass field.
- High: tree shadows, a 2048 shadow map, ambient occlusion, FXAA and a 70k-blade grass field.

 Auto picks Medium on phones and High on desktop. Grass is chunked and distance-culled; distant characters are hidden.

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
