/* ===== Game: boot, camera, loop, persistence glue ===== */
const Game = {
  running: false, time: 0, lamps: [], fires: [], shakeA: 0, treeCasters: [], quality: 'high',
  async init() {
    await Assets.init();
    const canvas = $('view'); this.mobile = matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent); this.quality = Settings.v.quality === 'auto' ? (this.mobile ? 'medium' : 'high') : Settings.v.quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.mobile, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality === 'high' ? 1.6 : this.quality === 'medium' ? 1.25 : 0.9)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900); this.resize(); addEventListener('resize', () => this.resize());
    Input.init(canvas); this.cam = new CamRig(this.camera);
    Terrain.build(this.scene); Sky.init(this.scene); FX.init(this.scene); World.build(); Fishing.init(); Ambient.init(); this.applyQuality();
    this.player = new Player(); this.horse = new Horse(); UI.init();
    this.restoreFromState(true);
    $('loading').textContent = ''; $('bNew').onclick = () => this.start(false); $('bCont').disabled = !Save.has(); $('bCont').onclick = () => this.start(true);
    this.last = performance.now(); requestAnimationFrame(t => this.frame(t));
    try { const hot = window.claude && window.claude.hot; if (hot && hot.snapshot) hot.snapshot(() => this.running ? Save.snapshot() : null); } catch (e) {}
  },
  applyQuality() {
    const q = Settings.v.quality === 'auto' ? (this.mobile ? 'medium' : 'high') : Settings.v.quality; this.quality = q;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, q === 'high' ? 1.6 : q === 'medium' ? 1.25 : 0.9)); this.resize();
    this.renderer.shadowMap.enabled = q !== 'low'; const ms = q === 'high' ? 2048 : 1024; if (Sky.sun.shadow.mapSize.x !== ms) { Sky.sun.shadow.mapSize.set(ms, ms); if (Sky.sun.shadow.map) { Sky.sun.shadow.map.dispose(); Sky.sun.shadow.map = null; } }
    for (const m of this.treeCasters) m.castShadow = q === 'high'; this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  },
  resize() { const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); },
  start(cont) {
    Sfx.init(); $('title').hidden = true; ['tl', 'tr'].forEach(id => $(id).hidden = false); this.running = true; Input.setTouch(Input.touch || matchMedia('(pointer:coarse)').matches);
    if (cont && Save.load()) return;
    S = freshState(); this.restoreFromState(); journal('Eli\'s letters stopped coming in April. Eight years since I rode out of Juniper Gap. Mae Holloway runs the store now. Eli trusted her.', 'note');
    UI.banner('Chapter 1', 'The Long Way Home', 'Juniper Gap is just over the rise.'); Missions._silent = true; Missions.refresh(); Missions._silent = false; Missions.start('intro');
  },
  restoreFromState(silent) {
    // rebuild dynamic world from S (used for new game, load, mission retry)
    for (const n of NPC.all.slice()) NPC.despawn(n); for (const a of Animal.all.slice()) Animal.remove(a); for (const c of Carry.list.slice()) Carry.remove(c);
    STORY._cab = STORY._cave = false; if (STORY._trail) { for (const m of STORY._trail) this.scene.remove(m); STORY._trail = null; }
    const P = this.player; P.state = 'ground'; P.carry = null; P.alive = true; P.weapon = 'fists'; P.teleport(S.p.x, S.p.z, S.p.yaw); P.buildRig();
    const H = this.horse; H.pos.set(S.h.x, Col.ground(S.h.x, S.h.z, 99), S.h.z); H.yaw = S.h.yaw; H.rider = null; H.speed = 0; H.state = 'idle'; H.box.visible = !!S.horseCarry; H.cargoMesh = null;
    if (S.horseCarry && S.horseCarry.id.startsWith('npc:')) S.horseCarry = null;
    Camp.fire && Camp.pack(); if (S.camp) Camp.spawn(S.camp.x, S.camp.z);
    World.apply(); this.populateWildlife();
    Missions.active = null; Missions.ctx = null; Missions._silent = true; Missions.refresh(); Missions._silent = false; Missions.resume();
    if (S.carry) { const c = Carry.make(S.carry, P.pos.x, P.pos.z); P.carry = c; c.carried = true; S.carry = null; }
    Sky.weather = S.weather.kind; this.cam.snap = true; this.cam.yaw = P.state === 'ride' ? H.yaw : P.yaw; this.cam.pitch = 0.3; Law.searchC = S.wanted ? { x: S.p.x, z: S.p.z } : null;
  },
  syncState() { const P = this.player; S.p.x = P.pos.x; S.p.z = P.pos.z; S.p.yaw = P.yaw; S.h.x = this.horse.pos.x; S.h.z = this.horse.pos.z; S.carry = P.carry && !P.carry.npc ? P.carry.id : null; },
  newDay() { S.h.fed = Math.max(0, S.h.fed - 25); for (const n of NPC.all.slice()) if (!n.alive && n.tags.includes('generic')) NPC.despawn(n); if (this.running) { World.apply(); journal(`Day ${S.time.day}.`); } },
  populateWildlife() {
    const herds = [[-95, -30], [40, 75], [-170, 40], [90, 150], [-110, 150], [170, -20]]; for (const [x, z] of herds) for (let i = 0; i < 3; i++) Animal.spawn('deer', x + rand(-6, 6), z + rand(-6, 6));
    const bunnies = [[-80, 60], [-20, 60], [20, -40], [-130, -40], [100, 30], [-60, -100], [130, 100], [-180, 120]]; for (const [x, z] of bunnies) Animal.spawn('rabbit', x, z);
  },
  wildlifeTick(dt) {
    this.wT = (this.wT || 0) - dt; if (this.wT > 0) return; this.wT = 8; const P = this.player.pos;
    for (const a of Animal.all.slice()) if (a.alive && Math.hypot(a.pos.x - P.x, a.pos.z - P.z) > 260) Animal.remove(a);
    const count = sp => Animal.all.filter(a => a.alive && a.sp === sp).length; const far = () => { for (let k = 0; k < 20; k++) { const x = rand(-200, 200), z = rand(-200, 200), d = Math.hypot(x - P.x, z - P.z); if (d > 90 && d < 220 && Terrain.height(x, z) > WORLD.waterY + 1 && Terrain.height(x, z) < 20 && Math.hypot(x + 40, z - 20) > 60) return [x, z]; } return null; };
    if (count('deer') < 14) { const s = far(); if (s) for (let i = 0; i < 3; i++) Animal.spawn('deer', s[0] + rand(-5, 5), s[1] + rand(-5, 5)); }
    if (count('rabbit') < 8) { const s = far(); if (s) Animal.spawn('rabbit', s[0], s[1]); }
    const wolves = count('wolf'); if (Sky.night() && wolves < 3 && Math.random() < 0.3) { const s = far(); if (s && Math.hypot(s[0] + 40, s[1] - 20) > 90) for (let i = 0; i < 3; i++) Animal.spawn('wolf', s[0] + rand(-4, 4), s[1] + rand(-4, 4), { pack: s }); }
    if (!Sky.night()) for (const a of Animal.all.slice()) if (a.sp === 'wolf' && a.alive && a.state !== 'attack' && Math.hypot(a.pos.x - P.x, a.pos.z - P.z) > 70) Animal.remove(a);
  },
  shake(a) { this.shakeA = Math.max(this.shakeA, a); },
  frame(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t; this.time += dt;
    try { if (this.paused) {} else if (this.running) this.update(dt); else this.titleUpdate(dt); } catch (e) { console.error(e); if (!this._errShown) { this._errShown = true; UI.toast('Something went wrong: ' + e.message, 'bad'); } }
    this.renderer.render(this.scene, this.camera); Input.endFrame(); requestAnimationFrame(tt => this.frame(tt));
  },
  titleUpdate(dt) { this.tT = (this.tT || 0) + dt; World.cullChunks(); Ambient.update(dt); Terrain.waterU.uTime.value = this.time; const a = this.tT * 0.05; this.camera.position.set(-40 + Math.cos(a) * 42, 16, 20 + Math.sin(a) * 42); this.camera.lookAt(-40, 3, 20); this.cam.pos.copy(this.camera.position); S.time.hour = 17.2; Sky.update(0); for (const n of NPC.all) n.update(dt, false); FX.update(dt); this.fireFlicker(); },
  fireFlicker() { for (const f of this.fires) { const k = 0.85 + Math.sin(this.time * 13 + f.x) * 0.1 + Math.random() * 0.08; f.fl.scale.set(0.3 * k, 0.7 * k * 1.1, 0.3 * k); f.light.intensity = 1.2 * k; } },
  update(dt) {
    const P = this.player, H = this.horse;
    if (!Dialog.open && !UI.panelOpen) { if (Input.hit('tab') || Input.hit('i') || Input.tb('menu')) UI.open('items'); else if (Input.hit('m')) UI.open('map'); else if (Input.hit('j')) UI.open('journal'); }
    else if (UI.panelOpen && (Input.hit('escape') || Input.hit('tab') || Input.tb('menu'))) UI.close();
    if (UI.panelOpen && !Missions.failing) { UI.update(0); return; } // menus pause the world
    Sky.update(dt); P.update(dt); H.update(dt); Fishing.update(dt);
    for (const n of NPC.all) { const d = Math.hypot(n.pos.x - P.pos.x, n.pos.z - P.pos.z); n.update(dt, d > 110 && !n.tags.includes('story')); }
    for (const a of Animal.all) a.update(dt, a.distP > 150);
    DoorSys.update(dt); Law.update(dt); Missions.update(dt); Encounters.update(dt); Camps.update(dt); SIDE.update(dt); this.wildlifeTick(dt); Dialog.update();
    if (!Dialog.open && !UI.panelOpen) Interact.update(P); else UI.prompts([]);
    FX.update(dt); this.fireFlicker(); this.cam.update(dt); World.cullChunks(); Ambient.update(dt); Terrain.waterU.uTime.value = this.time;
    // discovery
    for (const p of POIS) if (!S.discovered[p.id] && Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < p.r) { S.discovered[p.id] = true; UI.banner('Discovered', p.name); journal(`Found ${p.name}.`); Missions.emit('discover', { id: p.id }); }
    // ambience
    const inTown = Math.hypot(P.pos.x + 40, P.pos.z - 20) < 50; Sfx.music(dt, inTown && !S.wanted && !NPC.all.some(n => n.state === 'combat'), Sky.night());
    const nf = this.fires.reduce((m, f) => Math.min(m, Math.hypot(f.x - P.pos.x, f.z - P.pos.z)), 99); Sfx.bed('fire', clamp(1 - nf / 10, 0, 1) * 0.05);
    UI.update(dt); this.autosaveT = (this.autosaveT || 0) + dt; if (this.autosaveT > 120 && !Missions.active && !S.wanted) { this.autosaveT = 0; Save.save(true); }
  },
};

class CamRig {
  constructor(cam) { this.cam = cam; this.yaw = Math.PI; this.pitch = 0.3; this.dist = 4.6; this.zoom = Settings.v.zoom; this.pos = new THREE.Vector3(); this.tgt = new THREE.Vector3(); this.idleT = 0; this.snap = true; this.ray = new THREE.Raycaster(); this.lookOff = new THREE.Vector3(); this.collD = 99; this.groundY = 0; this.kickR = 0; this.snapT = 0; this.snapTgt = null;
    this.v = [...Array(6)].map(() => new THREE.Vector3()); this._dir = new THREE.Vector3(); this._bl = []; this._cn = []; }
  dir() { return this.cam.getWorldDirection(this._dir); }
  kick(a) { this.pitch -= a; this.kickR += a; } // gun recoil: the view jumps up, then settles back (see update)
  snapTo(t) { this.snapTgt = t; this.snapT = 0.2; } // soft lock: swing the reticle onto a target over a moment
  blockers(base) { const out = this._bl; out.length = 0; for (const m of WallMeshes) { if (!m._wp) { m._wp = new THREE.Vector3(); m.getWorldPosition(m._wp); } if (m._wp.distanceToSquared(base) < 500) out.push(m); } return out; }
  // solid world colliders (buildings, rocks, wagons, wide trunks) block the camera; thin posts and trunks are ignored so the view doesn't pop
  solidAt(x, y, z) { for (const c of Col.near(x, z, 0.2, this._cn)) { if (!c.block || y < c.y0 || y > c.y1) continue; if (c.type === 'circle') { if (c.r >= 0.6 && Math.hypot(x - c.x, z - c.z) < c.r + 0.2) return true; } else if (x > c.minX - 0.2 && x < c.maxX + 0.2 && z > c.minZ - 0.2 && z < c.maxZ + 0.2 && Math.min(c.maxX - c.minX, c.maxZ - c.minZ) > 0.5) return true; } return false; }
  update(dt) {
    const P = Game.player, sens = Settings.v.sens, V = this.v; let dx = (Input.mouse.dx * 0.0025 + Input.look.dx * 0.0065) * sens, dy = (Input.mouse.dy * 0.0025 + Input.look.dy * 0.0055) * sens * (Settings.v.invertY ? -1 : 1);
    if (Input.uiOpen) dx = dy = 0;
    if (!Input.uiOpen) { if (Input.wheel) this.zoom = clamp(this.zoom + Input.wheel * 0.45, 2.4, 9); if (Input.pinch) this.zoom = clamp(this.zoom - Input.pinch * 0.015, 2.4, 9); if (Input.wheel || Input.pinch) Settings.v.zoom = this.zoom; }
    // clamp per-frame rotation so a big mouse jump or touch glitch can never spin the camera
    dx = clamp(dx, -0.35, 0.35); dy = clamp(dy, -0.25, 0.25); if (P.aiming && !Input.touch) { dx *= 0.8; dy *= 0.8; } // zoomed in: same feel per degree
    this.yaw -= dx; this.pitch = clamp(this.pitch + dy, -0.42, 1.15); const manual = Math.abs(dx) + Math.abs(dy) > 0.0005; this.idleT = manual ? 0 : this.idleT + dt;
    if (Dialog.open && Dialog.npc && Dialog.npc.pos && P.state !== 'ride') return this.convo(dt);
    const riding = P.state === 'ride', aim = P.aiming, H = Game.horse;
    // auto-recenter behind the direction of travel when the player isn't steering the camera
    const moveSp = riding ? H.speed : Math.hypot(P.vel.x, P.vel.z);
    if (Settings.v.autoCam && this.idleT > 1.4 && moveSp > 1.5 && !aim) { const heading = riding ? H.yaw : Math.atan2(P.vel.x, P.vel.z); const k = clamp(moveSp / 7, 0.15, 1) * (riding ? 1.6 : 0.9); if (Math.cos(angDiff(this.yaw, heading)) > -0.3) this.yaw = dampAngle(this.yaw, heading, k, dt); this.pitch = damp(this.pitch, riding ? 0.32 : 0.28, 0.6, dt); }
    if (this.kickR > 0) { const r = this.kickR * (1 - Math.exp(-11 * dt)); this.pitch += r; this.kickR -= r; if (this.kickR < 1e-4) this.kickR = 0; }
    if (this.snapT > 0) { this.snapT -= dt; const t = this.snapTgt; if (!aim || !t || !t.alive) this.snapT = 0; else { // steer the actual view ray onto the target's chest
      const d = this.dir(), tx = t.pos.x - this.pos.x, ty = t.pos.y + t.hitH - this.pos.y, tz = t.pos.z - this.pos.z, k = 1 - Math.exp(-28 * dt);
      this.yaw += angDiff(Math.atan2(d.x, d.z), Math.atan2(tx, tz)) * k; this.pitch = clamp(this.pitch - (Math.atan2(ty, Math.hypot(tx, tz)) - Math.asin(clamp(d.y, -1, 1))) * k, -0.42, 1.15); } }
    if (aim && P.lock && Input.touch) { const l = P.lock; const a = Math.atan2(l.pos.x - P.pos.x, l.pos.z - P.pos.z); this.yaw = dampAngle(this.yaw, a, 6, dt); }
    // combat framing: pull back and bias the view toward the nearest active threat
    let foe = null, fd = 26; for (const n of NPC.all) if (n.alive && !n.downed && n.state === 'combat' && n.distP < fd) { fd = n.distP; foe = n; } for (const a of Animal.all) if (a.alive && a.state === 'attack' && a.distP < fd) { fd = a.distP; foe = a; }
    const want = aim ? 2.1 : riding ? this.zoom + 2.4 : P.state === 'swim' ? this.zoom + 0.4 : DoorSys.inside ? Math.min(this.zoom, 3.4) : this.zoom + (foe ? 1.0 : 0);
    this.dist = damp(this.dist, want, aim ? 16 : 8, dt); // aiming in is quick, like RDR2's over-the-shoulder snap
    let ty = P.pos.y + (riding ? 2.4 : P.crouch ? 1.15 : 1.45) + (P.state === 'swim' ? 0.4 : 0);
    // during a jump hold the take-off height so hops don't bob the view; drops below it are followed
    if (P.state === 'air') ty = Math.min(ty, this.groundY + 0.35); else this.groundY = ty;
    const tgt = V[0].set(P.pos.x, ty, P.pos.z);
    if (this.snap) this.tgt.copy(tgt); else { this.tgt.x = damp(this.tgt.x, tgt.x, 12, dt); this.tgt.z = damp(this.tgt.z, tgt.z, 12, dt); this.tgt.y = damp(this.tgt.y, tgt.y, P.state === 'air' ? 5 : 8, dt); }
    const lo = V[1].set(0, 0, 0); if (foe && !aim) lo.set((foe.pos.x - P.pos.x) * 0.25, 0, (foe.pos.z - P.pos.z) * 0.25).clampLength(0, 4); this.lookOff.lerp(lo, 1 - Math.exp(-3 * dt));
    const f = fwd(this.yaw), rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw); const sh = aim ? 0.7 : 0.35;
    const base = V[2].set(this.tgt.x + rx * sh, this.tgt.y, this.tgt.z + rz * sh);
    const cp = Math.cos(this.pitch), toC = V[3].set(-f.x * cp, Math.sin(this.pitch), -f.z * cp); const len = this.dist; // unit vector from the target out to the camera
    // spring arm: walls (raycast), solid colliders and terrain (sampled along the arm); pull in fast, ease back out slowly
    this.ray.set(base, toC); this.ray.far = len;
    const hit = this.ray.intersectObjects(this.blockers(base), false)[0]; let d = hit ? Math.max(0.5, hit.distance - 0.3) : len;
    for (let i = 1; i <= 8; i++) { const t = d * i / 8, x = base.x + toC.x * t, z = base.z + toC.z * t, y = base.y + toC.y * t; if (Terrain.height(x, z) + 0.35 > y || (t > 0.6 && this.solidAt(x, y, z))) { d = Math.max(0.5, t - d / 8); break; } }
    this.collD = d < this.collD ? d : damp(this.collD, d, 3, dt); const p = V[4].copy(base).addScaledVector(toC, Math.min(this.collD, len));
    const gh = Terrain.height(p.x, p.z) + 0.35; if (p.y < gh) p.y = gh;
    if (this.snap) { this.pos.copy(p); this.collD = d; this.snap = false; } else this.pos.lerp(p, 1 - Math.exp(-(aim ? 60 : 18) * dt)); // no trailing while aiming: the reticle stays glued to the mouse
    this.cam.position.copy(this.pos); const look = V[5].copy(base).add(this.lookOff); look.y += aim ? 0.15 : 0; this.cam.lookAt(look);
    if (Game.shakeA > 0) { this.cam.position.x += rand(-1, 1) * Game.shakeA * 0.12; this.cam.position.y += rand(-1, 1) * Game.shakeA * 0.12; Game.shakeA = Math.max(0, Game.shakeA - dt * 2); }
    const fov = damp(this.cam.fov, aim ? 48 : riding && H.speed > 10 ? 68 : (innerWidth < innerHeight ? 66 : 60), aim ? 16 : 7, dt); if (Math.abs(fov - this.cam.fov) > 1e-3) { this.cam.fov = fov; this.cam.updateProjectionMatrix(); }
  }
  convo(dt) { // two-shot conversation framing
    const P = Game.player, N = Dialog.npc.pos, dxx = N.x - P.pos.x, dzz = N.z - P.pos.z, L = Math.hypot(dxx, dzz) || 1, ux = dxx / L, uz = dzz / L; const mid = new THREE.Vector3((N.x + P.pos.x) / 2, Math.max(N.y, P.pos.y) + 1.45, (N.z + P.pos.z) / 2);
    let best = null; for (const sgn of [1, -1]) { const c = mid.clone().add(new THREE.Vector3(-uz * sgn * 2.6 - ux * 1.1, 0.25, ux * sgn * 2.6 - uz * 1.1)); const dir = c.clone().sub(mid); const len = dir.length(); this.ray.set(mid, dir.normalize()); this.ray.far = len; const hit = this.ray.intersectObjects(this.blockers(mid), false)[0]; const d = hit ? hit.distance : len; if (!best || d > best.d) best = { c: mid.clone().addScaledVector(dir, Math.max(0.8, d - 0.3)), d }; }
    this.pos.lerp(best.c, 1 - Math.exp(-6 * dt)); this.cam.position.copy(this.pos); this.cam.lookAt(new THREE.Vector3(N.x * 0.65 + P.pos.x * 0.35, N.y + 1.35, N.z * 0.65 + P.pos.z * 0.35)); P.yaw = dampAngle(P.yaw, Math.atan2(dxx, dzz), 8, dt);
    this.yaw = Math.atan2(N.x - this.pos.x, N.z - this.pos.z);
  }
}

/* ---------- Debug/test surface (used by automated tests) ---------- */
window.HP = { get S() { return S; }, Game, Missions, NPC, Inv, Save, Law, Interact, Dialog, UI, STORY, Animal, Sky, Col,
  sim(sec, dt = 0.05) { const n = Math.round(sec / dt); for (let i = 0; i < n; i++) { Game.time += dt; Game.update(dt); Input.endFrame(); } },
  tp(x, z) { Game.player.teleport(x, z); Game.cam.snap = true; }, opts() { return Interact.opts.map(o => o.label); }, press(label) { const i = Interact.opts.findIndex(o => o.label.startsWith(label)); if (i < 0) return false; Interact.trigger(i); return true; },
  choices() { return UI.choices.map(c => c.text + (c.disabled ? ' [x]' : '')); }, choose(prefix) { const i = UI.choices.findIndex(c => c.text.replace(/^\d+\.\s*/, '').startsWith(prefix)); if (i < 0) return false; UI.pickChoice(i); return true; } };

addEventListener('load', () => { Game.init().catch(e => { console.error(e); $('loading').textContent = 'The game failed to start: ' + e.message; }); });
