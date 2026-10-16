/* ===== Entities: player, horse, NPCs (townsfolk, law, outlaws), wildlife, items, containers ===== */
const fwd = y => ({ x: Math.sin(y), z: Math.cos(y) });
const HURTABLE = []; // things with hit spheres: {pos, alive, hitR, hitH, takeHit(o)}

/* ---------- FX: dust, tracers, muzzle flash, tracks, speech ---------- */
const FX = {
  parts: [], tracks: [], tracers: [],
  init(scene) { this.scene = scene; this.dustMat = toon('#d8c9a3', { transparent: true, opacity: 0.7 }); this.trackMat = new THREE.MeshBasicMaterial({ color: 0x3d2f22, transparent: true, opacity: 0.55, depthWrite: false }); this.trackGeo = new THREE.CircleGeometry(0.09, 8); this.trackGeo.rotateX(-Math.PI / 2); this.trackGeo.scale(1, 1, 1.6);
    this.flash = new THREE.PointLight(0xffc070, 0, 8, 2); scene.add(this.flash); },
  dust(x, y, z, n = 3, s = 0.12) { for (let i = 0; i < n; i++) { const m = new THREE.Mesh(GEO.sphLo, this.dustMat); m.scale.setScalar(s); m.position.set(x + rand(-.2, .2), y + 0.05, z + rand(-.2, .2)); this.scene.add(m); this.parts.push({ m, v: new THREE.Vector3(rand(-.5, .5), rand(.4, 1.2), rand(-.5, .5)), life: 0.6, s }); } },
  splash(x, y, z) { for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(GEO.sphLo, toon('#cfe9f7')); m.scale.setScalar(0.1); m.position.set(x, y, z); this.scene.add(m); this.parts.push({ m, v: new THREE.Vector3(rand(-1.5, 1.5), rand(2, 4), rand(-1.5, 1.5)), life: 0.7, s: 0.1, g: true }); } },
  track(x, z, yaw, kind = 'deer') { const y = Terrain.height(x, z) + 0.03; const m = new THREE.Mesh(this.trackGeo, this.trackMat); m.position.set(x, y, z); m.rotation.y = yaw; if (kind === 'boot') m.scale.set(1.2, 1, 1.5); this.scene.add(m); this.tracks.push({ m, life: kind === 'clue' ? 1e9 : 140 }); if (this.tracks.length > 260) { const t = this.tracks.shift(); this.scene.remove(t.m); } return m; },
  tracer(a, b) { const g = new THREE.BufferGeometry().setFromPoints([a, b]); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.9 })); this.scene.add(l); this.tracers.push({ l, life: 0.08 }); this.flash.position.copy(a); this.flash.intensity = 3; },
  update(dt) {
    this.parts = this.parts.filter(p => { p.life -= dt; p.m.position.addScaledVector(p.v, dt); if (p.g) p.v.y -= 12 * dt; else p.v.multiplyScalar(0.94); p.m.scale.setScalar(p.s * (p.g ? 1 : 1 + (0.6 - p.life) * 2)); if (p.life <= 0) { this.scene.remove(p.m); return false; } return true; });
    this.tracers = this.tracers.filter(t => { t.life -= dt; if (t.life <= 0) { this.scene.remove(t.l); t.l.geometry.dispose(); return false; } return true; });
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 30);
    for (const t of this.tracks) { t.life -= dt; if (t.life < 20) t.m.material = t.m.material; }
    this.tracks = this.tracks.filter(t => { if (t.life <= 0) { this.scene.remove(t.m); return false; } return true; });
  }
};

/* ---------- Shooting (shared by player and NPCs) ---------- */
function noiseEvent(x, z, r, src) { for (const a of Animal.all) if (a.alive && Math.hypot(a.pos.x - x, a.pos.z - z) < r) a.scare(x, z); for (const n of NPC.all) if (n.alive && n !== src && Math.hypot(n.pos.x - x, n.pos.z - z) < r) n.hearShot({ x, z }, src); if (Game.horse) Game.horse.spook(x, z, r); }
/* Gunplay hit tests. People get a standing capsule split into head, body and legs; animals keep their hit sphere. */
const GUN = { revolver: { dmg: 40, range: 45, cool: 0.38, spread: 0.004, bloom: 0.02, kick: 0.028 }, rifle: { dmg: 75, range: 90, cool: 1.0, spread: 0.0012, bloom: 0.03, kick: 0.05 }, ZONE: { head: 2.5, body: 1, legs: 0.65 } };
function rayPerson(o, d, h) { // ray against an upright cylinder (r 0.36, ground to 1.75 m): distance and which part was hit
  const px = o.x - h.pos.x, pz = o.z - h.pos.z, a = d.x * d.x + d.z * d.z; if (a < 1e-8) return null; const b = px * d.x + pz * d.z, c = px * px + pz * pz - 0.36 * 0.36, disc = b * b - a * c; if (disc < 0) return null;
  const sq = Math.sqrt(disc); for (const t of [(-b - sq) / a, (-b + sq) / a]) { if (t <= 0) continue; const y = o.y + d.y * t - h.pos.y; if (y < 0 || y > (h.downed ? 0.5 : 1.75)) continue; return { t, zone: y > 1.42 ? 'head' : y < 0.85 ? 'legs' : 'body' }; } return null;
}
function rayHit(o, d, range, skip) { // nearest living thing the ray hits within range, with line of sight to the hit point
  let best = null; for (const h of HURTABLE) { if (h === skip || !h.alive) continue; let r = null;
    if (h instanceof Person) r = rayPerson(o, d, h); else { const t = raySphere(o, d, { x: h.pos.x, y: h.pos.y + h.hitH, z: h.pos.z }, h.hitR + 0.08); if (t > 0) r = { t, zone: 'body' }; }
    if (r && r.t < range && (!best || r.t < best.t)) best = Object.assign(r, { h }); }
  if (best) { const x = o.x + d.x * best.t, y = o.y + d.y * best.t, z = o.z + d.z * best.t; if (!Col.los(o.x, o.y, o.z, x - d.x * 0.3, y - d.y * 0.3, z - d.z * 0.3)) return null; }
  return best;
}
function raySphere(o, d, c, r) { const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z; const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, h = b * b - cc; if (h < 0) return -1; const t = -b - Math.sqrt(h); return t > 0 ? t : -1; }

/* ---------- Player ---------- */
// controller tuning (m/s, m/s², seconds); STEP is the fixed physics sub-step
const PLAYER = { WALK: 1.7, JOG: 3.9, SPRINT: 6.8, CROUCH: 1.5, ACCEL: 7.5, DECEL: 9.5, AIR_ACCEL: 2.2, TURN: 11, MAX_TURN: 12, GRAVITY: 23, JUMP_V: 7.4, JUMP_PREP: 0.09, COYOTE: 0.12, JUMP_BUFFER: 0.15, STEP: 1 / 120 };
class Player {
  constructor() { this.pos = new THREE.Vector3(S.p.x, 0, S.p.z); this.vel = new THREE.Vector3(); this.yaw = S.p.yaw; this.state = 'ground'; this.crouch = false; this.weapon = 'fists'; this.combo = 0; this.comboT = 0; this.cool = 0; this.inv = 0; this.alive = true; this.downT = 0; this.coyote = 0; this.aimT = 0; this.lock = null; this.bloom = 0; this.aimWas = false; this.hover = null; this.reloading = false; this.hurtT = 0; this.stDelay = 0; this.blocking = false; this.dodgeT = 0; this.carry = null; this.rest = 0; this.brandish = new Map(); this.loco = new LocoFSM(); this.buildRig(); this.pos.y = Col.ground(this.pos.x, this.pos.z, 99); HURTABLE.push(this); this.hitR = 0.45; this.hitH = 1.1; this.isPlayer = true; this.name = 'Wren'; }
  buildRig() { if (this.rig) Game.scene.remove(this.rig.root); const o = OUTFITS[S.outfit] || OUTFITS.duster; this.rig = makeCharacter({ skin: '#e2a57c', shirt: o.shirt, sleeve: o.coat || o.shirt, coat: o.coat, vest: o.vest, pants: '#3e3a4a', hat: true, hatColor: o.hat, hair: '#7a3b1e', longHair: true, scarf: '#e8833a', scale: 1.05 }); Game.scene.add(this.rig.root); const old = this.anim; this.anim = makeAnimator(this.rig, this); if (old) { this.anim.cur = old.cur; if (old.dispose) old.dispose(); }
    this.gun = new THREE.Group(); this.gun.add(M(GEO.box, '#2b2b2b', 0.05, 0.08, 0.26, 0, 0, 0.1)); this.gun.add(M(GEO.box, '#6b4226', 0.05, 0.12, 0.06, 0, -0.07, -0.02)); this.gun.position.set(0, -0.08, 0.05); this.rig.R.hand.add(this.gun);
    this.rifle = new THREE.Group(); this.rifle.add(M(GEO.box, '#2b2b2b', 0.05, 0.06, 0.8, 0, 0, 0.3)); this.rifle.add(M(GEO.box, '#7a4a26', 0.07, 0.1, 0.4, 0, -0.04, -0.12)); this.rifle.position.set(0, -0.06, 0.05); this.rig.R.hand.add(this.rifle);
    this.held = new THREE.Group(); this.rig.R.hand.add(this.held); }
  get hp() { return S.p.hp; } set hp(v) { S.p.hp = v; }
  get maxHp() { return S.p.maxHp; }
  busy() { return this.anim.busy() || ['mount', 'dismount', 'climb', 'down', 'fish'].includes(this.state) || Dialog.open; }
  teleport(x, z, yaw) { for (const n of NPC.all) { n.seesPlayer = false; n.perceiveT = 0; } this.pos.set(x, Col.ground(x, z, 99), z); this.vel.set(0, 0, 0); if (yaw !== undefined) this.yaw = yaw; if (this.state === 'ride') this.state = 'ground'; Game.cam.snap = true; }
  canAct() { return !Dialog.open && !UI.panelOpen && this.alive && this.state !== 'down' && !Fishing.on; }
  onStep() { const w = Terrain.height(this.pos.x, this.pos.z) < WORLD.waterY + 0.05; if (w) { Sfx.burst(1500, 0.08, 0.06, 'bandpass'); } else Sfx.step(this.crouch ? 0.02 : 0.05, this.crouch); if (!this.crouch && this.vel.length() > 5) FX.dust(this.pos.x, this.pos.y, this.pos.z, 2, 0.09); if (inBuilding(this.pos.x, this.pos.z, this.pos.y) === null && Math.random() < 0.3) S.stats.distance += 1; }
  input() {
    const c = Game.cam; let mx = 0, my = 0, walk = false;
    if (this.canAct()) { if (Input.down('w') || Input.down('arrowup')) my += 1; if (Input.down('s') || Input.down('arrowdown')) my -= 1; if (Input.down('a') || Input.down('arrowleft')) mx -= 1; if (Input.down('d') || Input.down('arrowright')) mx += 1; walk = Input.down('control');
      if (Input.move.mag > 0.05) { mx = Input.move.x; my = Input.move.y; walk = Input.move.mag < 0.55; } }
    const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
    const f = fwd(c.yaw), r = { x: -Math.cos(c.yaw), z: Math.sin(c.yaw) };
    return { x: f.x * my + r.x * mx, z: f.z * my + r.z * mx, mag: Math.min(1, m), walk, sprint: this.canAct() && (Input.down('shift') || Input.sprintToggle), jump: this.canAct() && (Input.hit(' ') || Input.tb('jump')) };
  }
  update(dt) {
    const I = this.input(); this.cool -= dt; this.comboT -= dt; this.inv -= dt; this.hurtT -= dt; this.stDelay -= dt; this.dodgeT -= dt;
    this.jumpBuf = I.jump ? PLAYER.JUMP_BUFFER : Math.max(0, (this.jumpBuf || 0) - dt); // a press shortly before landing still jumps
    if (this.state === 'down') { this.feedLoco(dt, 0, false); return this.updDown(dt); }
    if (this.state === 'ride' || this.state === 'mount' || this.state === 'dismount') { this.feedLoco(dt, 0, false); return this.updRide(dt, I); }
    if (this.state === 'climb') { this.climbT += dt; const u = clamp(this.climbT / 0.75, 0, 1), e = ease(u); this.pos.lerpVectors(this.climbA, this.climbB, e); this.pos.y = lerp(this.climbA.y, this.climbB.y, ease(clamp(u * 1.6, 0, 1))); if (u >= 1) { this.state = 'ground'; this.vel.set(0, 0, 0); } this.feedLoco(dt, 0, false); this.anim.update(dt, { state: 'ground', speed: 0, k: 0, loco: this.loco }); this.place(); return; }
    // toggles
    if (this.canAct()) {
      if (Input.hit('c') || Input.tb('crouch')) { this.crouch = !this.crouch; Input.setBtnState('crouch', this.crouch); }
      if (Input.hit('1')) this.setWeapon('fists'); if (Input.hit('2') && S.weapons.revolver) this.setWeapon('revolver'); if (Input.hit('3') && S.weapons.rifle) this.setWeapon('rifle');
      if (Input.hit('v') || Input.tb('weapon')) this.cycleWeapon();
      if (Input.hit('h') || Input.tb('whistle')) this.whistle();
      if ((Input.hit('r') || Input.tb('reload')) && this.weapon !== 'fists') this.reload();
      if (Input.hit('b') || Input.tb('camp')) Camp.make();
      if ((Input.hit('x') || Input.tb('dodge')) && this.state === 'ground' && S.p.st > 15 && !this.carry) this.dodge(I);
    }
    const aiming = this.canAct() && this.weapon !== 'fists' && !this.carry && this.state !== 'swim' && (Input.mouse.r || Input.aimToggle);
    this.blocking = this.canAct() && (Input.down('q') || Input.btn.block) && !this.carry && !aiming && this.state === 'ground';
    this.anim.layers.aim = aiming ? 1 : 0; this.anim.layers.block = this.blocking ? 1 : 0; this.anim.layers.carry = this.carry ? 1 : 0; this.anim.layers.rifle = this.weapon === 'rifle' ? 1 : 0;
    this.aiming = aiming; this.anim.lookPitch = aiming ? Game.cam.pitch - 0.15 : 0; this.aimTick(dt, aiming);
    // physics in fixed sub-steps: speed, jump height and stopping distance are the same at 30, 60 or 144 fps
    if (this.state === 'ground' && Math.hypot(this.vel.x, this.vel.z) > 5.2 && I.mag < 0.1 && !(this.jumpT > 0) && !this.anim.playing('skid') && !this.anim.busy()) this.anim.play('skid'); // once per frame, never over a jump start
    const n = Math.max(1, Math.ceil(dt / PLAYER.STEP - 1e-6)), h = dt / n; this._turn = 0;
    for (let i = 0; i < n && (this.state === 'ground' || this.state === 'air' || this.state === 'swim'); i++) this.step(h, I, aiming);
    const hs = Math.hypot(this.vel.x, this.vel.z), g = Col.ground(this.pos.x, this.pos.z, this.pos.y), swimming = this.state === 'swim';
    // stamina / health regen with cores
    if (this.stDelay <= 0) S.p.st = Math.min(S.p.maxSt, S.p.st + (8 + S.p.stCore * 0.2) * dt); S.p.st = Math.max(0, S.p.st);
    if (this.hurtT < -4 && S.p.hpCore > 0) S.p.hp = Math.min(S.p.maxHp, S.p.hp + S.p.hpCore * 0.03 * dt);
    S.p.hpCore = Math.max(0, S.p.hpCore - dt * 0.035); S.p.stCore = Math.max(0, S.p.stCore - dt * 0.05 * (hs > 5 ? 2 : 1));
    // combat
    if (this.canAct()) this.combat(dt, aiming);
    // stealth: crouched in tall grass/dark is quieter
    this.noise = this.crouch ? 0.35 : hs > 5 ? 1.3 : 1; if (Sky.night()) this.noise *= 0.8;
    let la = null, ld = 7; for (const nn of NPC.all) { if (!nn.alive || nn.downed) continue; const d = Math.hypot(nn.pos.x - this.pos.x, nn.pos.z - this.pos.z); if (d < ld) { ld = d; la = nn.pos; } } if (!la && Interact.cur) la = Interact.cur.o.pos(); this.anim.lookAt = aiming ? null : la;
    this.feedLoco(dt, hs, I.mag > 0.1);
    this.anim.update(dt, { state: swimming ? 'swim' : this.state === 'air' ? 'air' : 'ground', speed: hs, vy: this.vel.y, fallH: this.pos.y - g, crouch: this.crouch, ground: (x, z, y) => Col.ground(x, z, y), turn: this._turn, tired: S.p.st < 1 && hs > 1, loco: this.loco });
    this.place();
    S.p.x = this.pos.x; S.p.z = this.pos.z; S.p.yaw = this.yaw;
  }
  feedLoco(dt, hs, moving) { this.loco.update(dt, { grounded: this.state !== 'air', vy: this.vel.y, speed: this.state === 'ground' ? hs : 0, moving, crouch: this.crouch && this.state === 'ground', jumpPrep: this.jumpT > 0, dodge: this.dodgeT > 0 && this.state === 'ground' }); }
  step(dt, I, aiming) { // one fixed physics step: speed, facing, gravity, jumping, collision
    const swimming = this.state === 'swim', tired = S.p.st < 1; let spd = this.crouch ? PLAYER.CROUCH : I.walk ? PLAYER.WALK : PLAYER.JOG;
    if (I.sprint && !tired && !this.crouch && !this.carry && !aiming && I.mag > 0.2) { spd = PLAYER.SPRINT * (1 + S.p.xpSt * 0.0004); S.p.st -= 13 * dt; this.stDelay = 0.9; S.p.xpSt += dt * 0.5; }
    if (this.carry) spd = Math.min(spd, 2.3); if (aiming) spd = Math.min(spd, 2.2); if (this.blocking) spd = 1.2; if (this.anim.busy() || !this.canAct()) spd = 0;
    if (swimming) { spd = I.sprint && S.p.st > 1 ? 3.4 : 2.1; if (I.sprint) { S.p.st -= 8 * dt; this.stDelay = 1; } }
    this.landSlow = Math.max(0, (this.landSlow || 0) - dt); if (this.landSlow > 0 && !swimming) spd *= 0.45; // brief recovery after a hard landing
    const onG = this.state === 'ground'; const wantSp = Math.hypot(I.x, I.z) * spd, curSp = Math.hypot(this.vel.x, this.vel.z); const accel = swimming ? 6 : onG ? (wantSp > curSp ? PLAYER.ACCEL : PLAYER.DECEL) : PLAYER.AIR_ACCEL;
    if (this.dodgeT <= 0) { this.vel.x = damp(this.vel.x, I.x * spd, accel, dt); this.vel.z = damp(this.vel.z, I.z * spd, accel, dt); }
    // facing: toward the movement direction (camera direction while aiming or blocking)
    let ty = this.yaw; if (aiming || this.blocking) ty = Game.cam.yaw; else if (I.mag > 0.1 && spd > 0) ty = Math.atan2(I.x, I.z);
    this._turn = angDiff(this.yaw, ty); const rate = aiming ? 20 : onG ? PLAYER.TURN : PLAYER.TURN * 0.5, maxT = (aiming ? 30 : PLAYER.MAX_TURN) * dt; this.yaw += clamp(this._turn * (1 - Math.exp(-rate * dt)), -maxT, maxT); // eased, with a top turn speed so reversing sweeps around instead of flipping
    // vertical
    const g = Col.ground(this.pos.x, this.pos.z, this.pos.y);
    const depth = WORLD.waterY - Terrain.height(this.pos.x, this.pos.z);
    if (depth > 1.15 && this.pos.y < WORLD.waterY - 0.4) { if (!swimming) { Sfx.splash(); FX.splash(this.pos.x, WORLD.waterY, this.pos.z); if (this.carry && this.carry.kind === 'item') this.dropCarry(); } this.state = 'swim'; this.vel.y = 0; this.pos.y = damp(this.pos.y, WORLD.waterY - 1.0, 6, dt); this.crouch = false; }
    else if (swimming && depth <= 1.15) { this.state = 'ground'; }
    else if (this.state !== 'swim') {
      if (onG && this.pos.y - g > 0.6) { this.state = 'air'; this.coyote = PLAYER.COYOTE; }
      if (this.state === 'air') { this.vel.y -= PLAYER.GRAVITY * dt; this.coyote -= dt; this.pos.y += this.vel.y * dt; if (this.pos.y <= g) { this.land(g); } }
      else { this.pos.y = g; this.vel.y = 0; }
    }
    if (this.jumpBuf > 0 && (this.state === 'ground' || this.coyote > 0) && !this.anim.busy() && !this.carry && !(this.jumpT > 0) && this.canAct()) { this.jumpBuf = 0; if (!this.tryClimb()) { this.jumpT = PLAYER.JUMP_PREP; this.anim.play('jumpPrep'); if (this.crouch) { this.crouch = false; Input.setBtnState('crouch', false); } } }
    if (this.jumpT > 0) { this.jumpT -= dt; if (this.jumpT <= 0) { this.state = 'air'; this.vel.y = PLAYER.JUMP_V; this.coyote = 0; this.anim.squash(-1.4); Sfx.burst(400, 0.1, 0.05); } }
    if (this.state === 'climb') return;
    const px = this.pos.x, pz = this.pos.z; this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    Col.resolve(this.pos, 0.36, this.pos.y, 1.6); this.pos.x = clamp(this.pos.x, -WORLD.half + 6, WORLD.half - 6); this.pos.z = clamp(this.pos.z, -WORLD.half + 6, WORLD.half - 6);
    // keep only the velocity that actually happened (pushing into a wall leaves just the slide along it),
    // but never more than was intended, so being pushed out of an overlap can't fling the player
    const ax = (this.pos.x - px) / dt, az = (this.pos.z - pz) / dt, m0 = Math.hypot(this.vel.x, this.vel.z), m1 = Math.hypot(ax, az), k = m1 > m0 ? (m1 > 0 ? m0 / m1 : 0) : 1;
    this.vel.x = ax * k; this.vel.z = az * k;
  }
  place() { const r = this.rig.root; r.position.copy(this.pos); r.rotation.y = this.yaw; if (this.state === 'swim') r.position.y = this.pos.y + 0.55; this.gun.visible = this.weapon === 'revolver' && !this.carry; this.rifle.visible = this.weapon === 'rifle' && !this.carry; if (this.carry && this.carry.npc) { this.carry.npc.place(); } else if (this.carry && this.carry.mesh) { const fw = fwd(this.yaw); this.carry.mesh.position.set(this.pos.x + fw.x * 0.5, this.pos.y + 1.0, this.pos.z + fw.z * 0.5); this.carry.mesh.rotation.y = this.yaw; } }
  land(g) { const v = this.vel.y; this.pos.y = g; this.state = 'ground'; this.vel.y = 0; this.anim.squash(clamp(v * 0.12, -1.8, 0)); this.anim.play('land', { k: clamp(-v / 11, 0.25, 1) }); FX.dust(this.pos.x, g, this.pos.z, 4); Sfx.step(0.1); if (v < -10) this.landSlow = 0.25; if (v < -13) this.hurt(Math.round((-v - 12) * 9), null, 'fall'); }
  tryClimb() {
    const f = fwd(this.yaw), px = this.pos.x + f.x * 0.9, pz = this.pos.z + f.z * 0.9; let best = null;
    for (const c of Col.near(px, pz, 0.6, [])) { if (!c.walk) continue; const h = c.y1 - this.pos.y; if (h < 0.6 || h > 2.3) continue; if (px > c.minX - 0.45 && px < c.maxX + 0.45 && pz > c.minZ - 0.45 && pz < c.maxZ + 0.45) best = c; }
    if (!best) return false; const tx = clamp(this.pos.x + f.x * 1.1, best.minX + 0.3, best.maxX - 0.3), tz = clamp(this.pos.z + f.z * 1.1, best.minZ + 0.3, best.maxZ - 0.3);
    this.state = 'climb'; this.climbT = 0; this.climbA = this.pos.clone(); this.climbB = new THREE.Vector3(tx, best.y1, tz); this.anim.play('climb'); Sfx.burst(300, 0.2, 0.08); return true;
  }
  dodge(I) { const d = I.mag > 0.1 ? { x: I.x, z: I.z } : fwd(this.yaw); const m = Math.hypot(d.x, d.z) || 1; this.vel.x = d.x / m * 8; this.vel.z = d.z / m * 8; this.dodgeT = 0.45; this.inv = 0.45; S.p.st -= 15; this.stDelay = 0.8; this.yaw = Math.atan2(d.x, d.z); this.anim.play('dodge'); Sfx.burst(500, 0.15, 0.06); }
  setWeapon(w) { if (this.weapon === w) return; this.weapon = w; this.anim.play('reload', { dur: 0.35 }); Sfx.tone(300, 0.05, 0.05, 'square'); UI.toast(w === 'fists' ? 'Fists' : w === 'revolver' ? 'Revolver' : 'Bolt rifle'); }
  cycleWeapon() { const ws = ['fists', 'revolver', 'rifle'].filter(w => w === 'fists' || S.weapons[w]); this.setWeapon(ws[(ws.indexOf(this.weapon) + 1) % ws.length]); }
  whistle() { if (this.state === 'ride') return; this.anim.play('whistle'); Sfx.whistle(); Game.horse.call(); }
  reload() { const w = this.weapon, ammo = w === 'revolver' ? 'ammo_rev' : 'ammo_rifle', cap = w === 'revolver' ? 6 : 5; if (this.reloading || S.ammoClip[w] >= cap) return; if (!Inv.count(ammo)) { UI.toast('Out of ammunition', 'bad'); return; } this.reloading = true; this.anim.play('reload', { on: { done: () => { const n = Math.min(cap - S.ammoClip[w], Inv.count(ammo)); Inv.take(ammo, n); S.ammoClip[w] += n; this.reloading = false; Sfx.tone(800, 0.04, 0.06, 'square'); } } }); }
  combat(dt, aiming) {
    const atk = Input.mouse.lp || Input.hit('f') || Input.tb('attack');
    // target lock (aim assist): nearest hostile/animal in the camera cone
    const prevLock = this.lock; this.lock = null; if (aiming) { const cf = Game.cam.dir(); let best = 0.0; if (prevLock && prevLock.alive && !prevLock.downed) { const dx = prevLock.pos.x - Game.cam.pos.x, dy = (prevLock.pos.y + prevLock.hitH) - Game.cam.pos.y, dz = prevLock.pos.z - Game.cam.pos.z, d = Math.hypot(dx, dy, dz); if ((dx * cf.x + dy * cf.y + dz * cf.z) / d > 0.94 && d < 45) { this.lock = prevLock; best = 2; } } for (const h of HURTABLE) { if (h === this || !h.alive || h.isHorse) continue; const dx = h.pos.x - Game.cam.pos.x, dy = (h.pos.y + h.hitH) - Game.cam.pos.y, dz = h.pos.z - Game.cam.pos.z, d = Math.hypot(dx, dy, dz); if (d > (this.weapon === 'rifle' ? 70 : 40)) continue; const dot = (dx * cf.x + dy * cf.y + dz * cf.z) / d; const cone = Input.touch ? 0.95 : 0.985; if (dot > cone && dot > best && Col.los(Game.cam.pos.x, Game.cam.pos.y, Game.cam.pos.z, h.pos.x, h.pos.y + h.hitH, h.pos.z)) { best = dot; this.lock = h; } } }
    // brandishing at townsfolk
    if (aiming && this.lock && this.lock.lawful && !this.lock.hostileToPlayer) { const t = (this.brandish.get(this.lock) || 0) + dt; this.brandish.set(this.lock, t); this.lock.aimedAt(t); } else this.brandish.clear();
    if (!atk || this.cool > 0 || this.anim.busy()) return;
    if (this.weapon !== 'fists' && (aiming || this.state === 'swim' ? false : true) && !aiming) { return this.shoot(false); }
    if (this.weapon !== 'fists' && aiming) return this.shoot(true);
    if (this.carry) return; if (S.p.st < 6) { UI.toast('Too tired to swing', 'bad'); return; }
    const names = ['punch', 'hook', 'uppercut']; if (this.comboT <= 0) this.combo = 0; const nm = names[this.combo % 3]; this.combo++; this.comboT = 0.9; this.cool = 0.32; S.p.st -= 7; this.stDelay = 0.7;
    // auto-face nearest target in front
    let tgt = null, td = 2.6; for (const h of HURTABLE) { if (h === this || !h.alive || h.isHorse) continue; const d = Math.hypot(h.pos.x - this.pos.x, h.pos.z - this.pos.z); if (d < td) { td = d; tgt = h; } } if (tgt) this.yaw = Math.atan2(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z);
    this.anim.play(nm, { on: { hit: () => { const f = fwd(this.yaw); let any = false; for (const h of HURTABLE) { if (h === this || !h.alive || h.isHorse) continue; const dx = h.pos.x - this.pos.x, dz = h.pos.z - this.pos.z, d = Math.hypot(dx, dz); if (d < 1.75 && (dx * f.x + dz * f.z) / (d || 1) > 0.4 && Math.abs(h.pos.y - this.pos.y) < 1.2) { h.takeHit({ dmg: nm === 'uppercut' ? 28 : 17, from: this, melee: true, dir: f }); any = true; } } if (any) { Sfx.punch(); Game.shake(0.15); } else Sfx.burst(700, 0.08, 0.04); } } });
    this.vel.x += Math.sin(this.yaw) * 1.5; this.vel.z += Math.cos(this.yaw) * 1.5;
  }
  // RDR2-style aiming: pressing aim snaps the reticle onto the nearest target in front (soft lock), the shot goes where
  // the reticle points, and each shot kicks the view and widens the spread (bloom), which settles in a fraction of a second
  aimTick(dt, aiming) {
    this.bloom *= Math.exp(-5 * dt); if (this.bloom < 1e-4) this.bloom = 0;
    if (aiming && !this.aimWas) { const t = this.softLockTarget(); if (t) Game.cam.snapTo(t); }
    this.aimWas = aiming;
    this.hover = aiming ? rayHit(Game.cam.pos, Game.cam.dir(), (GUN[this.weapon] || GUN.revolver).range, this) : null;
  }
  softLockTarget() { // hostiles first, then anyone (or any animal) near the middle of the screen
    const cf = Game.cam.dir(), range = (GUN[this.weapon] || GUN.revolver).range; let best = null, bs = -1;
    for (const h of HURTABLE) { if (h === this || !h.alive || h.downed || h.isHorse) continue; const dx = h.pos.x - Game.cam.pos.x, dy = (h.pos.y + h.hitH) - Game.cam.pos.y, dz = h.pos.z - Game.cam.pos.z, d = Math.hypot(dx, dy, dz); if (d > range) continue;
      const dot = (dx * cf.x + dy * cf.y + dz * cf.z) / d; if (dot < 0.9) continue; const sc = dot + (h.hostileToPlayer || h.state === 'combat' ? 0.1 : 0) - d * 0.0005; if (sc > bs && Col.los(Game.cam.pos.x, Game.cam.pos.y, Game.cam.pos.z, h.pos.x, h.pos.y + h.hitH, h.pos.z)) { bs = sc; best = h; } }
    return best;
  }
  spread() { const g = GUN[this.weapon] || GUN.revolver; return g.spread + this.bloom + (Math.hypot(this.vel.x, this.vel.z) > 1 ? 0.006 : 0) + (this.state === 'ride' ? 0.008 : 0); }
  shoot(aimed) {
    const w = this.weapon; if (this.reloading) return; if (S.ammoClip[w] <= 0) { Sfx.tone(1200, 0.03, 0.05, 'square'); this.reload(); return; }
    const g = GUN[w], boost = S.upgrades.barrel && w === 'revolver' ? 1.25 : 1, range = g.range * boost;
    S.ammoClip[w]--; this.cool = g.cool; this.anim.play('recoil'); Sfx.shot(w === 'rifle');
    const muzzle = new THREE.Vector3(); this.rig.R.hand.getWorldPosition(muzzle);
    let hit = null, point = null;
    if (aimed) {
      const o = Game.cam.pos.clone(), dir = Game.cam.dir().clone(), sp = this.spread(); // jitter inside the spread cone
      if (sp > 0) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * sp, up = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), u = new THREE.Vector3().crossVectors(dir, up).normalize(), v = new THREE.Vector3().crossVectors(u, dir); dir.addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r).normalize(); }
      hit = rayHit(o, dir, range, this);
      if (!hit && this.lock && this.lock.alive) { // a little bullet magnetism toward the locked target, like RDR2's aim assist
        const c = new THREE.Vector3(this.lock.pos.x, this.lock.pos.y + this.lock.hitH, this.lock.pos.z), t = c.clone().sub(o).dot(dir);
        if (t > 0 && t < range && o.clone().addScaledVector(dir, t).distanceTo(c) < this.lock.hitR + 0.12 + t * 0.003 && Col.los(o.x, o.y, o.z, c.x, c.y, c.z)) hit = { h: this.lock, t, zone: 'body' }; }
      point = hit ? o.clone().addScaledVector(dir, hit.t) : o.clone().addScaledVector(dir, range);
      this.bloom = Math.min(0.05, this.bloom + g.bloom); Game.cam.kick(g.kick);
    } else { // hip fire: whatever is in front, likelier the closer it is
      let best = 0.94, target = null; const f = fwd(this.yaw); for (const h of HURTABLE) { if (h === this || !h.alive || h.isHorse) continue; const dx = h.pos.x - this.pos.x, dz = h.pos.z - this.pos.z, d = Math.hypot(dx, dz); if (d > range * 0.6) continue; const dot = (dx * f.x + dz * f.z) / d; if (dot > best && Col.los(this.pos.x, this.pos.y + 1.4, this.pos.z, h.pos.x, h.pos.y + h.hitH, h.pos.z)) { best = dot; target = h; } }
      if (target && Math.random() < clamp(0.85 - Math.hypot(target.pos.x - this.pos.x, target.pos.z - this.pos.z) / 30, 0.25, 0.85)) hit = { h: target, zone: 'body' };
      point = hit ? new THREE.Vector3(hit.h.pos.x, hit.h.pos.y + hit.h.hitH, hit.h.pos.z) : muzzle.clone().add(new THREE.Vector3(f.x * 30, 0, f.z * 30)); Game.cam.kick(g.kick * 0.5);
    }
    if (hit) { const dmg = g.dmg * boost * GUN.ZONE[hit.zone]; hit.h.takeHit({ dmg, from: this, gun: w, dir: fwd(this.yaw), zone: hit.zone }); UI.hitmark(hit.zone === 'head'); this.lastHit = { key: hit.h.key || hit.h.sp, zone: hit.zone, dmg }; }
    FX.tracer(muzzle, point); noiseEvent(this.pos.x, this.pos.z, w === 'rifle' ? 110 : 80, this);
  }
  takeHit(o) { this.hurt(o.dmg, o.from, o.melee ? 'melee' : 'gun'); }
  hurt(d, from, kind) {
    if (this.inv > 0 || this.state === 'down') return; if (this.blocking && kind === 'melee') { d *= 0.2; Sfx.burst(900, 0.1, 0.2); } S.p.hp -= d; S.p.xpHp += d * 0.05; this.hurtT = 0;
    if (this.state !== 'ride') { const back = from && from.pos && Math.cos(angDiff(this.yaw, Math.atan2(from.pos.x - this.pos.x, from.pos.z - this.pos.z))) < 0; this.anim.play(back ? 'hitB' : 'hit', { replace: false }); } UI.flash(); Game.shake(0.25); this.anim.expr = 'alarm'; setTimeout(() => this.anim.expr = 'calm', 900);
    if (S.p.hp <= 0) this.knockout(from);
  }
  knockout(from) { S.p.hp = 0; this.state = 'down'; this.downT = 0; this.dropCarry(); if (Game.horse.rider === this) Game.horse.rider = null; UI.toast('You were knocked out', 'bad'); if (Missions.active) setTimeout(() => Missions.fail('Wren was knocked out.'), 1800); }
  updDown(dt) { this.downT += dt; this.anim.update(dt, { state: 'down', speed: 0 }); this.place();
    if (this.downT > 3.5 && !Missions.failing) { this.state = 'ground'; this.anim.play('standup'); S.p.hp = S.p.maxHp * 0.5; const lose = Math.round(S.money * 0.1 * 100) / 100; if (lose > 0) Inv.money(-lose, 'lost while out cold');
      if (S.wanted) { Law.surrender(); } else { Sky.advance(3); this.teleport(-30, 34, 0); UI.toast('Doc Pell patched you up.', ''); } for (const n of NPC.all) if (n.hostileToPlayer && !n.tags.includes('story')) n.calm(); } }
  // carrying world objects (strongbox, hogtied outlaw)
  pickCarry(obj) { this.anim.play('pickup', { on: { grab: () => { this.carry = obj; obj.carried = true; if (obj.onPick) obj.onPick(); Sfx.pickup(); } } }); if (this.weapon !== 'fists') this.weapon = 'fists'; }
  dropCarry() { if (!this.carry) return; const c = this.carry; this.carry = null; c.carried = false; const f = fwd(this.yaw); const x = this.pos.x + f.x * 0.9, z = this.pos.z + f.z * 0.9; c.mesh.position.set(x, Col.ground(x, z, this.pos.y + 1) + (c.h || 0.2), z); if (c.onDrop) c.onDrop(x, z); }
  // riding
  updRide(dt, I) {
    const H = Game.horse; const seat = new THREE.Vector3(); H.rig.seat.getWorldPosition(seat);
    if (this.state === 'mount' || this.state === 'dismount') { this.mt += dt; const u = clamp(this.mt / 0.8, 0, 1); const side = new THREE.Vector3(H.pos.x - Math.cos(H.yaw) * 0.9, H.pos.y, H.pos.z + Math.sin(H.yaw) * 0.9);
      const a = this.state === 'mount' ? side : seat, b = this.state === 'mount' ? seat : side; this.pos.lerpVectors(a, b, ease(u)); const sd = this.rig.isModel ? 0.24 : 0.64; this.pos.y += Math.sin(u * Math.PI) * 0.5 - (this.state === 'mount' ? sd * ease(u) : sd * (1 - ease(u))); this.yaw = dampAngle(this.yaw, H.yaw, 10, dt);
      this.anim.update(dt, { state: u > 0.6 && this.state === 'mount' ? 'ride' : 'ground', speed: 0 }); this.place();
      if (u >= 1) { if (this.state === 'mount') { this.state = 'ride'; H.rider = this; } else { this.state = 'ground'; this.pos.y = Col.ground(this.pos.x, this.pos.z, this.pos.y + 1); } } return; }
    if (this.canAct()) { const aiming = this.weapon !== 'fists' && (Input.mouse.r || Input.aimToggle); this.aiming = aiming; this.anim.layers.aim = aiming ? 1 : 0; this.anim.layers.rifle = this.weapon === 'rifle' ? 1 : 0; this.anim.layers.carry = 0; this.anim.layers.block = 0; this.anim.lookPitch = aiming ? Game.cam.pitch - 0.15 : 0; this.aimTick(dt, aiming);
      if (Input.hit('v') || Input.tb('weapon')) this.cycleWeapon(); if (Input.hit('2') && S.weapons.revolver) this.setWeapon('revolver'); if (Input.hit('3') && S.weapons.rifle) this.setWeapon('rifle'); if (Input.hit('1')) this.setWeapon('fists');
      if ((Input.hit('r') || Input.tb('reload')) && this.weapon !== 'fists') this.reload();
      if (this.weapon !== 'fists' && (Input.mouse.lp || Input.hit('f') || Input.tb('attack')) && this.cool <= 0) { if (aiming) this.combat(dt, true); else this.shoot(false); } else if (aiming) this.combat(dt, true); }
    H.control(dt, I);
    this.pos.copy(seat); this.pos.y -= this.rig.isModel ? 0.24 : 0.62; this.yaw = H.yaw + (this.aiming ? angDiff(H.yaw, Game.cam.yaw) * 0.0 : 0);
    const bounce = H.anim ? Math.sin(H.anim.phase * TAU * (H.gait === 'trot' ? 2 : 1)) * (H.speed > 1 ? 0.04 : 0) : 0;
    this.anim.update(dt, { state: 'ride', speed: 0, ride: { bounce, lean: clamp(H.speed / 12, 0, 1), roll: -H.turnRate * 0.05 } }); this.place();
    if (this.aiming) this.rig.root.rotation.y = Game.cam.yaw;
  }
  mount() { const H = Game.horse; if (this.carry) { UI.toast('Stow what you\'re carrying first.', 'bad'); return; } this.state = 'mount'; this.mt = 0; this.anim.play('mount'); H.stop(); Sfx.neigh(); Missions.emit('mount', {}); }
  dismount() { const H = Game.horse; H.speed = Math.min(H.speed, 0.5); H.rider = null; this.state = 'dismount'; this.mt = 0; this.anim.play('mount'); }
}

/* ---------- Horse ---------- */
class Horse {
  constructor() { this.rig = makeQuad({ type: 'horse', color: '#a0673a', dark: '#2b1d14', mane: '#3b2618', tail: '#3b2618', muzzle: '#8a5530', blaze: true, sock: '#a0673a', scale: 1.0 }); Game.scene.add(this.rig.root); this.anim = new QuadAnimator(this.rig, this); this.pos = new THREE.Vector3(S.h.x, 0, S.h.z); this.pos.y = Col.ground(this.pos.x, this.pos.z, 99); this.yaw = S.h.yaw; this.speed = 0; this.vy = 0; this.gait = 'walk'; this.gl = 0; this.state = 'idle'; this.rider = null; this.fear = 0; this.rear = 0; this.turnRate = 0; this.gallopT = 0; this.wander = 0; this.alive = true; this.isHorse = true; this.hitR = 0.7; this.hitH = 1.3; HURTABLE.push(this); this.patT = 0;
    this.bags = M(GEO.box, '#5a361c', 0.9, 0.3, 0.3, 0, 0.35, -0.4); this.rig.body.add(this.bags);
    this.box = M(GEO.box, '#5a4a3a', 0.5, 0.35, 0.4, 0, 0.75, -0.55); this.box.visible = false; this.rig.body.add(this.box);
    Interact.add({ pos: () => this.pos, r: 2.6, pri: 0.2, opts: p => this.opts(p) });
    this.cargoMesh = null; }
  get bond() { return S.h.bond; } bondLevel() { const b = S.h.bond; return b >= 90 ? 4 : b >= 50 ? 3 : b >= 20 ? 2 : 1; }
  maxSt() { return 100 + (this.bondLevel() - 1) * 15 + (S.upgrades.saddle ? 30 : 0); }
  addBond(d, why) { const lv = this.bondLevel(); S.h.bond = Math.min(120, S.h.bond + d); if (why) UI.toast(`${S.h.name} trusts you more`, 'good'); if (this.bondLevel() > lv) { UI.banner('Horse bond', `${S.h.name} reached bond level ${this.bondLevel()}`); journal(`${S.h.name} and I understand each other a little better now (bond ${this.bondLevel()}).`); } }
  opts(p) {
    if (p.state === 'ride' || !this.alive) return [];
    const o = [{ label: `Mount ${S.h.name}`, fn: () => p.mount() }];
    if (p.carry && p.carry.stowable) o.unshift({ label: `Stow ${p.carry.label}`, fn: () => this.stow(p) });
    if (S.horseCarry && !p.carry) o.unshift({ label: `Take ${S.horseCarry.label}`, fn: () => this.unstow(p) });
    const food = ['oats', 'apple', 'carrot'].find(i => Inv.count(i)); if (food) o.push({ label: `Feed ${ITEMS[food].name.toLowerCase()}`, fn: () => this.feed(p, food) });
    if (S.h.dirt > 0.15 && Inv.count('brush')) o.push({ label: 'Brush', fn: () => this.brush(p) }); else o.push({ label: 'Saddlebags', fn: () => UI.open('horse') });
    return o;
  }
  rideOpts() { return [{ label: 'Dismount', fn: () => Game.player.dismount() }]; }
  feed(p, it) { p.anim.play('feed', { on: { give: () => { Inv.take(it); S.h.fed = Math.min(100, S.h.fed + ITEMS[it].horse * 2); S.h.st = Math.min(this.maxSt(), S.h.st + ITEMS[it].horse * 2); this.addBond(ITEMS[it].horse > 10 ? 6 : 3, true); Sfx.tone(300, 0.2, 0.06, 'triangle'); Missions.emit('horsecare', {}); } } }); }
  brush(p) { p.anim.play('brush', { loop: true }); setTimeout(() => { p.anim.stop('brush'); S.h.dirt = 0; this.addBond(4, true); Missions.emit('horsecare', {}); }, 1800); }
  stow(p) { const c = p.carry; p.carry = null; c.carried = false; c.mesh.visible = false; S.horseCarry = { id: c.id, label: c.label }; this.cargoMesh = c; this.box.visible = true; UI.toast(`${c.label} stowed on ${S.h.name}`); Missions.emit('stow', { id: c.id }); }
  unstow(p) { const c = this.cargoMesh || Carry.make(S.horseCarry.id); S.horseCarry = null; this.box.visible = false; c.mesh.visible = true; p.carry = c; c.carried = true; this.cargoMesh = null; Sfx.pickup(); }
  stop() { this.speed = 0; this.state = 'idle'; }
  call() { const d = Math.hypot(this.pos.x - Game.player.pos.x, this.pos.z - Game.player.pos.z); const range = 120 + this.bondLevel() * 40; if (d > range) { this.pos.set(Game.player.pos.x - 30, 0, Game.player.pos.z - 30); this.pos.y = Col.ground(this.pos.x, this.pos.z, 99); } this.state = 'follow'; Sfx.neigh(); }
  spook(x, z, r) { const d = Math.hypot(this.pos.x - x, this.pos.z - z); if (d > r * 0.5) return; this.fear += (this.rider && this.rider.isPlayer && d < 2 ? 0.25 : 0.6) / this.bondLevel(); }
  onStep() { if (this.speed > 0.5) { Sfx.hoof(this.speed > 6 ? 0.1 : 0.06); if (this.speed > 7) FX.dust(this.pos.x, this.pos.y, this.pos.z, 2, 0.15); } }
  control(dt, I) {
    if (this.rearT > 0) return; const fw = I.mag > 0.15; const sprint = I.sprint; const H = this; let target = 0;
    if (fw) { target = I.walk ? 1 : 2; if (sprint && S.h.st > 5) { this.gallopT += dt; target = this.gallopT > 1.4 && S.h.st > 25 ? 4 : 3; } else this.gallopT = 0; } else this.gallopT = 0;
    // heading: steer toward camera-relative input
    let want = this.yaw; if (fw) { want = Math.atan2(I.x, I.z); const back = Math.cos(angDiff(this.yaw, want)) < -0.5; if (back && this.speed > 3) { target = 1; } }
    const maxTurn = lerp(2.6, 1.15, clamp(this.speed / 13, 0, 1)); const dy = clamp(angDiff(this.yaw, want), -maxTurn * dt, maxTurn * dt); this.yaw += dy; this.turnRate = dy / dt;
    this.gl = target; if (I.jump && this.speed > 5 && this.onG) { this.vy = 5.6; this.onG = false; }
    this.drive(dt, target);
  }
  drive(dt, gl) {
    const speeds = [0, 2.1, 4.7, 8.4, 13.2], names = ['walk', 'walk', 'trot', 'canter', 'gallop']; const ts = speeds[gl] * (S.h.st < 5 ? 0.6 : 1);
    this.speed = damp(this.speed, ts, ts > this.speed ? 1.6 : 2.6, dt); this.gait = this.speed < 3.2 ? 'walk' : this.speed < 6.4 ? 'trot' : this.speed < 10.5 ? 'canter' : 'gallop';
    if (this.gait === 'gallop') S.h.st -= (S.upgrades.saddle ? 6 : 9) * dt; else if (this.gait === 'canter') S.h.st -= 1.5 * dt; else S.h.st = Math.min(this.maxSt(), S.h.st + (S.upgrades.saddle ? 9 : 6) * dt);
    if (S.h.st <= 0) { S.h.st = 0; if (Math.random() < dt) Sfx.neigh(); }
    if (this.rider && this.speed > 1) { this.addBond(dt / 40); S.h.dirt = Math.min(1, S.h.dirt + dt * (Sky.wet > 0.3 ? 0.01 : 0.002)); }
  }
  update(dt) {
    const P = Game.player, dP = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z); this.distP = dP;
    // fear from wolves
    for (const a of Animal.all) if (a.alive && a.sp === 'wolf' && Math.hypot(a.pos.x - this.pos.x, a.pos.z - this.pos.z) < 16) this.fear += dt * 0.8 / this.bondLevel();
    this.fear = Math.max(0, this.fear - dt * 0.35); this.rearT = (this.rearT || 0) - dt;
    if (this.fear > 0.9 && this.rearT <= 0) { this.fear = 0.2; this.rearT = 1.2; Sfx.neigh(); this.speed *= 0.3; if (this.rider && this.bondLevel() < 2 && Math.random() < 0.45) setTimeout(() => { if (this.rider) { P.dismount(); P.hurt(8, null, 'fall'); UI.toast(`${S.h.name} threw you!`, 'bad'); } }, 500); else if (!this.rider) { this.state = 'flee'; this.fleeT = 6; } }
    if (!this.rider) {
      if (this.state === 'follow') { const want = Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z); this.yaw = dampAngle(this.yaw, want, 3, dt); this.drive(dt, dP > 40 ? 4 : dP > 12 ? 3 : dP > 4 ? 1 : 0); if (dP < 3.5) { this.state = 'idle'; } }
      else if (this.state === 'flee') { this.fleeT -= dt; this.drive(dt, 3); if (this.fleeT <= 0) this.state = 'idle'; }
      else { this.wander -= dt; if (this.wander <= 0) { this.wander = rand(4, 10); this.state = Math.random() < 0.6 ? 'graze' : 'idle'; this.yaw += rand(-1, 1); } this.drive(dt, this.state === 'idle' && Math.random() < 0.002 ? 1 : 0); }
    }
    // motion
    const f = fwd(this.yaw); this.pos.x += f.x * this.speed * dt; this.pos.z += f.z * this.speed * dt;
    const front = { x: this.pos.x + f.x * 1.0, z: this.pos.z + f.z * 1.0 }; const gF = Col.ground(front.x, front.z, this.pos.y + 0.6);
    if (gF - this.pos.y > 1.5 && this.onG) { this.pos.x -= f.x * this.speed * dt * 1.5; this.pos.z -= f.z * this.speed * dt * 1.5; this.speed *= 0.5; }
    const hitF = Col.resolve(front, 0.45, this.pos.y, 1.6); if (hitF) { this.pos.x += (front.x - (this.pos.x + f.x)) ; this.pos.z += (front.z - (this.pos.z + f.z)); if (this.speed > 7 && this.rider) Game.shake(0.2); this.speed *= 0.7; }
    Col.resolve(this.pos, 0.55, this.pos.y, 1.6); this.pos.x = clamp(this.pos.x, -WORLD.half + 6, WORLD.half - 6); this.pos.z = clamp(this.pos.z, -WORLD.half + 6, WORLD.half - 6);
    const g = Col.ground(this.pos.x, this.pos.z, this.pos.y), depth = WORLD.waterY - Terrain.height(this.pos.x, this.pos.z);
    this.swim = depth > 1.5; if (this.swim) { this.pos.y = damp(this.pos.y, WORLD.waterY - 1.35, 5, dt); this.speed = Math.min(this.speed, 2.6); this.onG = true; this.vy = 0; }
    else if (!this.onG || this.vy > 0 || this.pos.y - g > 0.5) { this.vy -= 22 * dt; this.pos.y += this.vy * dt; this.onG = false; if (this.pos.y <= g) { this.pos.y = g; this.vy = 0; this.onG = true; Sfx.hoof(0.15); } }
    else { this.pos.y = damp(this.pos.y, g, 18, dt); this.onG = true; }
    const gb = Terrain.height(this.pos.x - f.x * 0.9, this.pos.z - f.z * 0.9), gf2 = Terrain.height(this.pos.x + f.x * 0.9, this.pos.z + f.z * 0.9);
    this.anim.update(dt, { speed: this.speed, gait: this.gait, graze: this.state === 'graze' && !this.rider ? 1 : 0, rear: this.rearT > 0 ? 1 : 0, slope: this.swim ? -0.25 : clamp(-Math.atan2(gf2 - gb, 1.8), -0.5, 0.5), alert: this.fear > 0.3, roll: -this.turnRate * 0.03 * clamp(this.speed / 8, 0, 1), lookYaw: this.rider ? clamp(this.turnRate * 0.15, -0.4, 0.4) : 0 });
    this.rig.root.position.copy(this.pos); this.rig.root.rotation.y = this.yaw; this.rig.saddle.visible = true;
    S.h.x = this.pos.x; S.h.z = this.pos.z; S.h.yaw = this.yaw;
  }
  takeHit(o) { if (o.from && o.from.isPlayer) { this.fear += 1; this.addBond(-5); UI.toast(`${S.h.name} is upset with you`, 'bad'); } }
}

/* ---------- Carryable world objects ---------- */
const Carry = {
  list: [],
  make(id, x, z) {
    const def = { medcrate: { label: 'medicine crate', h: 0.3, mesh: () => { const g = new THREE.Group(); g.add(M(GEO.box, '#e6dcc5', 0.7, 0.5, 0.5)); g.add(M(GEO.box, '#c8443a', 0.3, 0.08, 0.52, 0, 0, 0)); g.add(M(GEO.box, '#c8443a', 0.08, 0.3, 0.52, 0, 0, 0)); return g; } }, strongbox: { label: 'strongbox', h: 0.2, mesh: () => { const g = new THREE.Group(); g.add(M(GEO.box, '#5a4a3a', 0.6, 0.4, 0.45)); g.add(M(GEO.box, '#c9a227', 0.62, 0.06, 0.47, 0, 0.12, 0)); g.add(M(GEO.box, '#2b2b2b', 0.1, 0.12, 0.05, 0, 0, 0.24)); return g; } } }[id];
    const o = { id, label: def.label, h: def.h, mesh: def.mesh(), stowable: true, carried: false };
    Game.scene.add(o.mesh); if (x !== undefined) o.mesh.position.set(x, Col.ground(x, z, 99) + def.h, z);
    o.it = Interact.add({ pos: () => o.mesh.position, r: 1.8, pri: 0.5, opts: p => o.carried || !o.mesh.visible ? [] : [{ label: `Pick up ${o.label}`, fn: () => p.pickCarry(o) }] });
    this.list.push(o); return o;
  },
  remove(o) { Game.scene.remove(o.mesh); Interact.remove(o.it); this.list = this.list.filter(x => x !== o); if (Game.player.carry === o) Game.player.carry = null; },
};

/* ---------- NPCs ---------- */
const TOWN_NODES = {}; const PLACES = {};
const NPC = {
  all: [], byKey(k) { return this.all.find(n => n.key === k); },
  spawn(cfg) { const n = new Person(cfg); this.all.push(n); return n; },
  despawn(n) { Game.scene.remove(n.rig.root); if (n.anim.dispose) n.anim.dispose(); Interact.remove(n.it); const i = HURTABLE.indexOf(n); if (i >= 0) HURTABLE.splice(i, 1); this.all = this.all.filter(x => x !== n); },
};
function townPath(fx, fz, tx, tz) {
  // BFS over town graph from nearest node to node nearest target
  const ids = Object.keys(TOWN_NODES); if (!ids.length) return [{ x: tx, z: tz }];
  const near = (x, z) => { let b = null, bd = 1e9; for (const id of ids) { const n = TOWN_NODES[id]; const d = Math.hypot(n.x - x, n.z - z); if (d < bd && (n.vis ? n.vis(x, z) : true)) { bd = d; b = id; } } return b; };
  const a = near(fx, fz), b = near(tx, tz); if (!a || !b) return [{ x: tx, z: tz }];
  const prev = { [a]: null }, q = [a]; while (q.length) { const c = q.shift(); if (c === b) break; for (const nb of TOWN_NODES[c].adj) if (!(nb in prev)) { prev[nb] = c; q.push(nb); } }
  const path = []; let c = b; while (c) { path.unshift({ x: TOWN_NODES[c].x, z: TOWN_NODES[c].z, node: c }); c = prev[c]; } path.push({ x: tx, z: tz }); return path;
}
class Person {
  constructor(c) {
    Object.assign(this, { brave: 0.5, lawful: true, lawman: false, hp: 100, maxHp: 100, tags: [], gun: null, schedule: null, sense: 1, accuracy: 0.42, dmg: 13, hostileTo: null }, c);
    this.rig = makeCharacter(c.look || {}); Game.scene.add(this.rig.root); this.anim = makeAnimator(this.rig, this);
    this.pos = new THREE.Vector3(c.x, 0, c.z); this.pos.y = Col.ground(c.x, c.z, 99); this.yaw = c.yaw || 0; this.vel = new THREE.Vector3(); this.state = c.state || 'routine'; this.path = null; this.alive = true; this.downed = false; this.t = 0; this.perceiveT = rand(0, 0.3); this.lines = 0; this.say_t = 0; this.alert = 0; this.lastSeen = null; this.cover = null; this.coverT = 0; this.shootT = rand(1, 2); this.stuck = 0; this.hitR = 0.42; this.hitH = 1.1; this.sp = 0; this.antagonized = 0;
    if (c.gun) { this.gunM = new THREE.Group(); this.gunM.add(M(GEO.box, '#2b2b2b', 0.05, 0.08, c.gun === 'rifle' ? 0.8 : 0.26, 0, 0, c.gun === 'rifle' ? 0.3 : 0.1)); this.gunM.position.set(0, -0.08, 0.05); this.rig.R.hand.add(this.gunM); this.gunM.visible = false; }
    HURTABLE.push(this); this.it = Interact.add({ pos: () => this.pos, r: 2.4, pri: 0.3, opts: p => this.opts(p) });
    if (this.key && S.chars[this.key] === 'dead') this.setDead(true);
  }
  get mem() { const k = this.key || this.name; return S.npcMem[k] || (S.npcMem[k] = {}); }
  say(t, dur = 3) { this.speech = t; this.say_t = dur; }
  opts(p) {
    if (!this.alive) { if (this.looted || !this.lootable) return []; return [{ label: `Search ${this.name}`, crime: this.lawful, fn: () => this.lootBody(p) }]; }
    if (this.downed) { const o = []; if (this.tags.includes('bounty') && !this.hogtied) o.push({ label: `Hogtie ${this.name}`, fn: () => this.hogtie(p) }); if (this.hogtied && !this.carried) o.push({ label: `Pick up ${this.name}`, fn: () => p.pickCarry(this.asCarry()) }); return o; }
    if (this.hostileToPlayer || this.state === 'flee' || this.state === 'combat') {
      if (this.witness && this.state !== 'combat') return [{ label: `Pay off ($8)`, disabled: S.money < 8, fn: () => this.payoff() }, { label: 'Intimidate', crime: true, fn: () => this.intimidate() }];
      return [];
    }
    if (this.isAsleep()) return []; // no prompts on a sleeper (and none crowding the lockbox beside the bedroll)
    if (this.state === 'handsup') return Game.player.aiming && !this.robbed ? [{ label: `Rob ${this.name}`, crime: true, fn: () => this.rob() }] : [];
    const o = []; const tree = this.talk ? this.talk(this) : null;
    if (tree) o.push({ label: `Talk to ${this.name}`, fn: () => Dialog.start(this, tree) });
    o.push({ label: 'Greet', fn: () => this.greeted(p) });
    o.push({ label: 'Antagonize', crime: true, fn: () => this.antagonize(p) });
    return o;
  }
  talkTo() { this.prevState = this.state; this.state = 'talk'; this.path = null; this.anim.expr = 'calm'; }
  endTalk() { if (this.state === 'talk') this.state = this.prevState === 'talk' ? 'routine' : (this.prevState || 'routine'); }
  greeted(p) { p.anim.play('tip'); this.face(p.pos); const m = this.mem; const mood = Rep.mood(this.key);
    const line = (this.greetLine && this.greetLine(mood, m)) || (S.npcMem[this.key || this.name]?.reported ? 'You\'ve got some nerve showing your face.' : mood === 'friend' ? `Wren! Good to see you.` : mood === 'warm' ? 'Afternoon, Miss Calloway.' : mood === 'cold' ? 'Hmph.' : mood === 'hostile' ? 'Keep walking.' : pick(['Howdy.', 'Afternoon.', 'Ma\'am.', 'Fine day.']));
    this.say(line); this.anim.play('greet'); if (!m.greetedDay || m.greetedDay !== S.time.day) { m.greetedDay = S.time.day; if (this.key) Rep.rel(this.key, 2); S.honor = clamp(S.honor + 0.5, -100, 100); } m.greets = (m.greets || 0) + 1; Missions.emit('greet', { npc: this }); }
  antagonize(p) { p.anim.play('taunt'); this.face(p.pos); this.antagonized++; this.mem.antagonized = (this.mem.antagonized || 0) + 1; if (this.key) Rep.rel(this.key, -4);
    if (this.antagonized >= 3 && this.brave > 0.55 && !this.lawman) { this.say('That\'s it!'); this.fightPlayer(true); }
    else if (this.antagonized >= 3) { this.say('Leave me be!'); this.state = 'flee'; this.fleeFrom = p.pos.clone(); this.fleeT = 6; }
    else this.say(this.lawman ? 'Watch your mouth, or I\'ll find you a cell.' : pick(['Mind yourself.', 'What\'s your problem?', 'You lookin\' for trouble?']));
    this.anim.expr = 'angry'; }
  face(p) { this.yaw = Math.atan2(p.x - this.pos.x, p.z - this.pos.z); }
  aimedAt(t) { if (this.state === 'handsup' || this.hostileToPlayer || this.lawman) { if (this.lawman && t > 1) { this.say('Put it down!'); this.fightPlayer(); } return; } if (t > 0.8) { this.state = 'handsup'; this.handsT = 0; this.say(pick(['Don\'t shoot!', 'Easy now!', 'Please!'])); this.anim.expr = 'alarm'; if (!this.brandished) { this.brandished = true; Law.crime('brandish', this.pos, { victim: this }); } } }
  witnessed(c) { this.witness = c; this.anim.expr = 'alarm'; this.mem.sawCrime = c.type;
    if (this.lawman) { this.say('Stop right there!'); Law.report(this, c); return; }
    if (this.brave > 0.6 && c.type !== 'murder') { this.state = 'confront'; this.confrontT = 3; this.say(pick(['Hey! I saw that!', 'You can\'t do that here!'])); }
    else { this.state = 'report'; this.say(pick(['Sheriff! Sheriff!', 'Help!', 'Somebody get the law!'])); this.path = null; }
  }
  isAsleep() { return this.state === 'routine' && this.atPlace && this.act === 'sleep' && !(this.wakeT > 0); }
  wake() { this.wakeT = 25; this.anim.expr = 'alarm'; this.face(Game.player.pos); this.say(pick(['Huh? Who\'s there?', 'Hey! What are you doing here?', 'Wake up! Someone\'s in camp!']), 3); }
  // a hold-up: once their hands are up at gunpoint, take what they carry (a witnessed robbery: bounty and honor)
  rob() { this.robbed = true; const cash = Math.round(rand(3, 10) * 100) / 100; Inv.money(cash, `robbed from ${this.name}`); this.mem.robbed = S.time.day; Game.player.anim.play('taunt');
    this.say(pick(['Take it! Just take it!', 'That\'s all I have!', 'You\'ll hang for this.']), 3); Law.crime('robbery', this.pos, { victim: this }); Missions.emit('robbery', { npc: this }); }
  payoff() { Inv.money(-8, `paid off ${this.name}`); this.witness = null; this.state = 'routine'; this.say('I didn\'t see nothin\'.'); if (this.key) Rep.rel(this.key, -6); this.anim.expr = 'calm'; }
  intimidate() { Game.player.anim.play('taunt'); const ok = Math.random() < (Game.player.weapon !== 'fists' ? 0.8 : 0.5); if (ok) { this.witness = null; this.state = 'routine'; this.say('A-alright. I never saw a thing.'); Rep.honor(-3, 'intimidation'); if (this.key) Rep.rel(this.key, -12); } else { this.say('You don\'t scare me!'); this.state = 'report'; this.sp = 6; } }
  investigate(pos) { if (this.hostileToPlayer || this.lawman && S.wanted) return; if (this.brave > 0.5 && this.state === 'routine') { this.state = 'investigate'; this.invPos = pos; this.invT = 10; this.path = null; this.say('What was that?'); } }
  hearShot(pos, src) {
    if (!this.alive || this.downed) return; if (this.group && this.state !== 'combat') { this.alertGroup(src && src.isPlayer ? src.pos : pos); return; }
    if (this.hostileToPlayer || this.state === 'combat') return;
    if (this.lawful && !this.lawman) { if (this.brave < 0.5) { this.state = 'flee'; this.fleeFrom = new THREE.Vector3(pos.x, 0, pos.z); this.fleeT = 6; this.anim.expr = 'alarm'; this.say(pick(['Gunshots!', 'Lord!', 'Get down!'])); } else this.investigate(pos); }
    if (this.lawman && !S.wanted && src && src.isPlayer && Math.hypot(pos.x - this.pos.x, pos.z - this.pos.z) < 35) this.investigate(pos);
  }
  fightPlayer(fists) { this.hostileToPlayer = true; this.state = 'combat'; this.fists = fists || !this.gun; this.anim.expr = 'angry'; if (this.gunM && !this.fists) this.gunM.visible = true; }
  pursue() { this.state = 'pursue'; this.path = null; this.warned = false; if (this.gunM) this.gunM.visible = true; this.anim.expr = 'angry'; }
  calm() { this.hostileToPlayer = false; if (this.alive && !this.downed && !this.tags.includes('story')) this.state = 'routine'; this.path = null; if (this.gunM) this.gunM.visible = false; this.anim.expr = 'calm'; this.warned = false; }
  alertGroup(pos) { for (const n of NPC.all) if (n.group === this.group && n.alive && !n.downed && n.state !== 'combat' && Math.hypot(n.pos.x - this.pos.x, n.pos.z - this.pos.z) < 45) { n.fightPlayer(); n.alert = 1; n.lastSeen = pos ? { x: pos.x, z: pos.z } : null; } Missions.emit('alarm', { group: this.group }); }
  takeHit(o) {
    if (!this.alive) return; const fromP = o.from && o.from.isPlayer;
    if (fromP && o.melee && !this.hostileToPlayer && this.state !== 'combat' && (this.alert || 0) < 0.5 && Game.player.crouch && !this.seesPlayer && (this.group || !this.lawful)) { this.knockdown(); Sfx.punch(); UI.toast('Silent takedown', 'good'); return; }
    this.hp -= o.dmg; this.anim.play('hit', { replace: false }); this.anim.expr = 'alarm'; if (o.dir) { this.pos.x += o.dir.x * (o.melee ? 0.35 : 0.15); this.pos.z += o.dir.z * (o.melee ? 0.35 : 0.15); }
    if (fromP && this.lawful && !this.hostileToPlayer && !this.witness) { Law.crime(this.hp <= 0 && !o.melee ? 'murder' : 'assault', this.pos, { victim: this, noise: o.gun ? 60 : 0 }); }
    if (fromP && this.group) this.alertGroup(Game.player.pos);
    if (fromP && this.lawful && !this.lawman && this.alive && this.hp > 0 && o.melee && this.brave > 0.55) { this.fightPlayer(true); this.say(pick(['You want a fight? You got one!', 'Why you...!'])); }
    if (this.hp <= 0) { if (o.melee || this.knockoutOnly) this.knockdown(); else { this.setDead(); if (fromP) { S.stats.kills++; Missions.emit('kill', { npc: this }); } } }
  }
  knockdown() { this.downed = true; this.downT = this.tags.includes('bounty') || this.tags.includes('outlaw') ? 1e9 : 30; /* hideout outlaws stay down */ this.state = 'down'; this.hp = 0; Sfx.burst(250, 0.3, 0.2); Missions.emit('ko', { npc: this }); if (this.gunM) this.gunM.visible = false; }
  setDead(silent) { this.alive = false; this.state = 'dead'; this.lootable = !silent; if (this.key && !this.tags.includes('generic')) { S.chars[this.key] = 'dead'; if (!silent) journal(`${this.name} is dead.`, 'fate'); } if (this.gunM) this.gunM.visible = false; this.anim.expr = 'calm'; }
  lootBody(p) { p.anim.play('kneel', { loop: true }); setTimeout(() => { p.anim.stop('kneel'); this.looted = true; const cash = Math.round(rand(1, 6) * 100) / 100; Inv.money(cash, 'from the body'); if (this.gun) Inv.add(this.gun === 'rifle' ? 'ammo_rifle' : 'ammo_rev', 4); if (this.loot) this.loot(); if (this.lawful) Law.crime('looting', this.pos, {}); }, 1300); }
  hogtie(p) { p.anim.play('kneel', { loop: true }); setTimeout(() => { p.anim.stop('kneel'); this.hogtied = true; UI.toast(`${this.name} is hogtied`); Missions.emit('hogtie', { npc: this }); }, 1500); }
  asCarry() { const n = this; return { id: 'npc:' + this.key, label: this.name, h: 0.3, stowable: true, mesh: this.rig.root, npc: this, onPick() { n.carried = true; }, onDrop(x, z) { n.carried = false; n.pos.set(x, Col.ground(x, z, 99), z); } }; }
  perceive() {
    const P = Game.player; const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, d = Math.hypot(dx, dz); this.distP = d;
    const facing = Math.cos(angDiff(this.yaw, Math.atan2(dx, dz))); const range = (Sky.night() ? 20 : 34) * this.sense;
    this.seesPlayer = P.alive && d < range && (facing > -0.1 || (d < 5 && !P.crouch)) && Col.los(this.pos.x, this.pos.y + 1.5, this.pos.z, P.pos.x, P.pos.y + 1.2, P.pos.z);
    if (this.sleepy) this.seesPlayer = this.seesPlayer && d < 2.2 && !P.crouch;
    if (this.isAsleep()) this.seesPlayer = P.alive && d < 2.2 && !P.crouch; // eyes closed: only someone standing right beside the bedroll
  }
  moveTo(tx, tz, speed, dt, arrive = 0.6) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz); if (d < arrive) { this.sp = damp(this.sp, 0, 10, dt); return true; }
    this.sp = damp(this.sp, speed, 6, dt); const a = Math.atan2(dx, dz); this.yaw = dampAngle(this.yaw, a, 8, dt);
    const ox = this.pos.x, oz = this.pos.z; this.pos.x += Math.sin(this.yaw) * this.sp * dt; this.pos.z += Math.cos(this.yaw) * this.sp * dt;
    if (Col.resolve(this.pos, 0.34, this.pos.y, 1.6)) { this.stuck += dt; if (this.stuck > 0.8) { this.pos.x += Math.cos(this.yaw) * 0.6 * dt * 4; this.pos.z -= Math.sin(this.yaw) * 0.6 * dt * 4; } } else this.stuck = Math.max(0, this.stuck - dt);
    return false;
  }
  followPath(dt, speed) { if (!this.path || !this.path.length) return true; const p = this.path[0]; if (this.moveTo(p.x, p.z, speed, dt, this.path.length > 1 ? 0.9 : 0.5)) { this.path.shift(); if (!this.path.length) return true; } return false; }
  go(tx, tz, wild) { this.path = wild ? [{ x: tx, z: tz }] : townPath(this.pos.x, this.pos.z, tx, tz); this.goal = { x: tx, z: tz }; }
  schedEntry() { if (!this.schedule) return null; const h = S.time.hour; const rain = Sky.weather === 'rain'; for (const e of this.schedule) { const [a, b] = e; if (a <= b ? (h >= a && h < b) : (h >= a || h < b)) { if (rain && e[3] && e[3].rain) return Object.assign({}, e, { 2: e[3].rain }); return e; } } return this.schedule[0]; }
  update(dt, far) {
    this.t += dt; this.say_t -= dt; if (this.say_t <= 0) this.speech = null; this.wakeT = Math.max(0, (this.wakeT || 0) - dt); this.it.r = this.state === 'handsup' ? 7 : 2.4; // hold-ups work at gunpoint range
    if (this.carried) { this.anim.update(dt, { state: 'down', speed: 0 }); this.place(); return; }
    if (!this.alive) { this.anim.update(dt, { state: 'down', speed: 0 }); this.place(); return; }
    if (this.downed) { this.downT -= dt; this.anim.update(dt, { state: 'down', speed: 0 }); this.place(); if (this.downT <= 0 && !this.hogtied) { this.downed = false; this.hp = this.maxHp * 0.5; this.anim.play('standup'); if (this.lawful && !this.lawman) { this.state = 'report'; this.witness = { type: 'assault', value: Law.VALUES.assault, pos: { x: this.pos.x, z: this.pos.z } }; this.say('You\'ll pay for that!'); } else this.fightPlayer(); } return; }
    this.perceiveT -= dt; if (this.perceiveT <= 0) { this.perceiveT = far ? 1 : 0.2; this.perceive(); }
    if (far && this.state === 'routine' && !this.group) { const e = this.schedEntry(); if (e) { const pl = PLACES[e[2]]; if (pl && Math.hypot(pl.x - this.pos.x, pl.z - this.pos.z) > 2) { this.pos.set(pl.x, Col.ground(pl.x, pl.z, 99), pl.z); this.yaw = pl.yaw || 0; this.path = null; } this.act = pl ? pl.act : 'idle'; this.atPlace = true; } this.place(); return; }
    let animState = 'ground'; this.poseClip = null;
    switch (this.state) {
      case 'routine': { const e = this.schedEntry(); if (!e) { if (this.idleAt) this.moveTo(this.idleAt.x, this.idleAt.z, 1.3, dt); break; } const pl = PLACES[e[2]]; if (!pl) break;
        if (!this.goal || this.goal.x !== pl.x || this.goal.z !== pl.z) this.go(pl.x, pl.z, this.wild);
        const there = this.followPath(dt, 1.35); this.atPlace = there;
        if (this.isAsleep() && this.distP < 3.2 && !Game.player.crouch && Math.hypot(Game.player.vel.x, Game.player.vel.z) > 0.6) this.wake(); // footsteps right beside a sleeper
        if (there) { this.sp = damp(this.sp, 0, 8, dt); this.yaw = dampAngle(this.yaw, pl.yaw || 0, 4, dt); animState = pl.act === 'sit' ? 'sit' : pl.act === 'sleep' ? 'lie' : pl.act === 'work' ? 'work' : pl.act === 'chat' ? 'chat' : 'ground'; this.poseClip = pl.clip || null; if (this.wakeT > 0 && pl.act === 'sleep') { animState = 'ground'; this.poseClip = null; this.face(Game.player.pos); } if (pl.wander) { this.wT = (this.wT || 0) - dt; if (this.wT <= 0) { this.wT = rand(5, 12); const a = rand(0, TAU), r = rand(0, pl.wander); this.goal = null; this.path = [{ x: pl.x + Math.cos(a) * r, z: pl.z + Math.sin(a) * r }]; } } } this.act = pl.act; break; }
      case 'talk': this.sp = 0; this.face(Game.player.pos); animState = 'chat'; break;
      case 'handsup': this.sp = 0; animState = 'handsup'; this.handsT += dt; if (!Game.player.aiming || Game.player.lock !== this) { if (this.handsT > 2) { this.state = this.witness ? 'report' : 'flee'; this.fleeFrom = Game.player.pos.clone(); this.fleeT = 6; } } else this.handsT = 0; break;
      case 'flee': { const a = Math.atan2(this.pos.x - this.fleeFrom.x, this.pos.z - this.fleeFrom.z); this.moveTo(this.pos.x + Math.sin(a) * 5, this.pos.z + Math.cos(a) * 5, 5.2, dt); this.fleeT -= dt; if (this.fleeT <= 0) { this.state = this.witness ? 'report' : 'routine'; this.goal = null; this.anim.expr = 'calm'; } break; }
      case 'confront': this.sp = 0; this.face(Game.player.pos); this.confrontT -= dt; animState = 'chat'; if (this.confrontT <= 0) { this.state = 'report'; this.say('I\'m telling the sheriff!'); } break;
      case 'report': { const sh = NPC.byKey('pike'); const tgt = sh && sh.alive ? sh.pos : PLACES.sheriffDesk; if (!this.path || !this.goal || Math.hypot(this.goal.x - tgt.x, this.goal.z - tgt.z) > 3) this.go(tgt.x, tgt.z, this.wild); this.followPath(dt, 4.8); this.anim.expr = 'alarm';
        if (Math.hypot(tgt.x - this.pos.x, tgt.z - this.pos.z) < 3.5 && this.witness) { Law.report(this, this.witness); this.witness = null; this.state = 'routine'; this.goal = null; this.anim.expr = 'calm'; } break; }
      case 'investigate': { this.invT -= dt; this.moveTo(this.invPos.x, this.invPos.z, 2.2, dt, 2.5); if (this.invT <= 0) { this.state = 'routine'; this.goal = null; } break; }
      case 'pursue': { if (!S.wanted) { this.calm(); break; } if (this.seesPlayer && this.distP < 26) { if (!this.warned) { this.warned = true; this.warnT = 3.5; this.say('Hands where I can see \'em! You\'re under arrest!', 4); } this.face(Game.player.pos); this.sp = damp(this.sp, 0, 8, dt); this.anim.layers.aim = 1; this.warnT -= dt; if (this.warnT <= 0) this.fightPlayer(); }
        else { const c = Law.searchC || Game.player.pos; this.moveTo(c.x + Math.sin(this.t * 0.3) * 8, c.z + Math.cos(this.t * 0.3) * 8, 4.5, dt, 2); } break; }
      case 'combat': this.combat(dt); break;
      case 'patrol': this.patrol(dt); if (this.sitter && this.alert < 0.3) { const s = this.sitter; if (Math.hypot(this.pos.x - s.x, this.pos.z - s.z) < 1.2) { this.pos.x = damp(this.pos.x, s.x, 8, dt); this.pos.z = damp(this.pos.z, s.z, 8, dt); this.yaw = dampAngle(this.yaw, s.yaw, 6, dt); this.sp = 0; animState = 'sit'; this.poseClip = s.clip; } } break; // fireside sitters face the fire
      case 'scripted': if (this.script) this.script(dt, this); break;
      case 'tied': this.sp = 0; animState = 'sit'; break;
    }
    if (this.state !== 'pursue' && this.state !== 'combat' && !this.allyAim) this.anim.layers.aim = 0;
    const g = Col.ground(this.pos.x, this.pos.z, this.pos.y); this.pos.y = damp(this.pos.y, g, 20, dt);
    this.anim.lookAt = (this.distP < 6 && Game.player.alive && !this.hostileToPlayer && animState !== 'lie') ? Game.player.pos : null;
    this.anim.update(dt, { state: animState, speed: this.sp, crouch: this.crouchC, ground: (x, z, y) => Col.ground(x, z, y), poseClip: this.poseClip });
    this.place();
  }
  place() { const r = this.rig.root; const cp = Game.cam.pos; r.visible = (this.pos.x - cp.x) ** 2 + (this.pos.z - cp.z) ** 2 < 125 * 125; if (this.carried) { const P = Game.player, f = fwd(P.yaw); r.position.set(P.pos.x + f.x * 0.1, P.pos.y + 1.15, P.pos.z + f.z * 0.1); r.rotation.set(0, P.yaw + Math.PI / 2, Math.PI / 2); this.pos.copy(r.position); return; } r.position.copy(this.pos); r.rotation.set(0, this.yaw, 0); }
  patrol(dt) { // outlaw idle/patrol with stealth detection meter
    const P = Game.player; const pts = this.route; if (pts && pts.length) { const p = pts[this.ri || 0]; if (this.moveTo(p.x, p.z, 1.2, dt, 0.8)) { this.waitT = (this.waitT || 0) + dt; if (this.waitT > (p.wait || 4)) { this.waitT = 0; this.ri = ((this.ri || 0) + 1) % pts.length; } } }
    if (this.seesPlayer && P.alive) { const vis = (P.crouch ? 0.35 : 1) * (Sky.night() ? 0.55 : 1) * (P.carry ? 1.6 : 1) * (1 - this.distP / 34); this.alert = clamp(this.alert + vis * 1.3 * dt, 0, 1); this.lastSeen = { x: P.pos.x, z: P.pos.z }; if (this.alert > 0.35) { this.face(P.pos); this.sp = 0; } }
    else this.alert = Math.max(0, this.alert - dt * 0.15);
    if (this.distP < 2.2 && this.seesPlayer) this.alert = 1;
    if (this.alert >= 1) { this.say(pick(['There! Get \'em!', 'We got company!', 'Intruder!'])); this.alertGroup(P.pos); }
    if (this.onPatrol) this.onPatrol(dt, this);
  }
  combat(dt) {
    const P = Game.player; this.face(P.pos); this.anim.expr = 'angry'; const d = this.distP;
    if (this.fleeHp && this.hp < this.fleeHp) { this.state = 'retreat'; this.fled = true; this.say('I\'m done! I\'m done!'); this.script = null; this.state = 'scripted'; this.script = (dt2, me) => { const a = Math.atan2(me.pos.x - P.pos.x, me.pos.z - P.pos.z); me.moveTo(me.pos.x + Math.sin(a) * 5, me.pos.z + Math.cos(a) * 5, 5.5, dt2); }; return; }
    if (!P.alive || P.state === 'down') { this.sp = 0; return; }
    if (this.fists || !this.gun || d < 2.4) { // melee
      if (d > 1.5) this.moveTo(P.pos.x, P.pos.z, 4.6, dt, 1.4); else { this.sp = 0; this.shootT -= dt; if (this.shootT <= 0) { this.shootT = rand(0.9, 1.6); this.anim.play(pick(['punch', 'hook']), { on: { hit: () => { if (Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z) < 1.9) { P.hurt(this.fists ? 9 : 12, this, 'melee'); Sfx.punch(); } } } }); } }
      return;
    }
    if (this.gunM) this.gunM.visible = true; this.anim.layers.aim = 1; this.anim.layers.rifle = this.gun === 'rifle' ? 1 : 0;
    // cover logic
    this.coverT -= dt; if (!this.cover || this.coverT <= 0) { this.coverT = rand(5, 9); this.cover = this.pickCover(); }
    if (this.cover) { const there = this.moveTo(this.cover.x, this.cover.z, 4.6, dt, 0.5); this.crouchC = there && this.peek <= 0; if (there) { this.face(P.pos); } }
    else if (d > 22) this.moveTo(P.pos.x, P.pos.z, 3.5, dt, 18); else this.sp = damp(this.sp, 0, 6, dt);
    this.peek = (this.peek || 0) - dt; this.shootT -= dt;
    if (this.shootT <= 0) { this.shootT = rand(1.3, 2.4); this.peek = 0.7; this.crouchC = false;
      if (this.seesPlayer && d < 45) { const m = new THREE.Vector3(); this.rig.R.hand.getWorldPosition(m); let acc = this.accuracy * (d < 10 ? 1.2 : d > 25 ? 0.6 : 1) * (Math.hypot(P.vel.x, P.vel.z) > 4 ? 0.6 : 1) * (Sky.night() ? 0.8 : 1) * (P.state === 'ride' ? 0.8 : 1);
        const hit = Math.random() < acc; const tgt = new THREE.Vector3(P.pos.x + (hit ? 0 : rand(-1.5, 1.5)), P.pos.y + 1.2 + (hit ? 0 : rand(-0.5, 1)), P.pos.z + (hit ? 0 : rand(-1.5, 1.5))); FX.tracer(m, tgt); Sfx.shot(this.gun === 'rifle'); this.anim.play('recoil'); if (hit) P.hurt(this.dmg, this, 'gun'); if (Game.horse.distP < 30) Game.horse.spook(this.pos.x, this.pos.z, 30); } }
  }
  pickCover() { const P = Game.player; let best = null, bs = 1e9; for (const c of Col.near(this.pos.x, this.pos.z, 16, [])) { if (!c.cover && !c.block) continue; if (c.y1 - c.y0 < 0.9) continue; const cx = c.type === 'box' ? (c.minX + c.maxX) / 2 : c.x, cz = c.type === 'box' ? (c.minZ + c.maxZ) / 2 : c.z, cr = c.type === 'box' ? Math.max(c.maxX - c.minX, c.maxZ - c.minZ) / 2 : c.r; const ax = cx - P.pos.x, az = cz - P.pos.z, al = Math.hypot(ax, az) || 1; const sx = cx + ax / al * (cr + 0.6), sz = cz + az / al * (cr + 0.6); const dpl = Math.hypot(sx - P.pos.x, sz - P.pos.z); if (dpl < 6) continue; const sc = Math.hypot(sx - this.pos.x, sz - this.pos.z) + (this.flanker ? -dpl * 0.3 : 0); if (sc < bs && Math.abs(Terrain.height(sx, sz) - this.pos.y) < 1.5) { bs = sc; best = { x: sx, z: sz }; } } return best; }
}

/* ---------- Wildlife ---------- */
const SPECIES = {
  deer: { hp: 60, run: 9.5, walk: 1.2, sense: 26, color: '#b07a48', belly: '#efe1c8', pelt: 'pelt_deer', meat: ['meat_raw', 2], day: true, tracks: true },
  rabbit: { hp: 10, run: 7, walk: 0.8, sense: 12, color: '#a89580', belly: '#efe6d8', pelt: 'pelt_rabbit', meat: ['game_raw', 1], day: true, hop: true },
  wolf: { hp: 70, run: 8.5, walk: 1.6, sense: 30, color: '#7d7b78', belly: '#c9c4bb', pelt: 'pelt_wolf', meat: ['game_raw', 1], night: true, predator: true },
};
const Animal = {
  all: [], spawn(sp, x, z, o = {}) { const a = new Beast(sp, x, z, o); this.all.push(a); return a; },
  remove(a) { Game.scene.remove(a.rig.root); Interact.remove(a.it); const i = HURTABLE.indexOf(a); if (i >= 0) HURTABLE.splice(i, 1); this.all = this.all.filter(x => x !== a); },
};
class Beast {
  constructor(sp, x, z, o) { this.sp = sp; this.cfg = SPECIES[sp]; const c = this.cfg; this.rig = makeQuad({ type: sp, color: c.color, belly: c.belly, tail: sp === 'deer' ? '#f4f0e6' : c.color, antlers: sp === 'deer' && Math.random() < 0.5, scale: sp === 'rabbit' ? 1.3 : 1 }); Game.scene.add(this.rig.root); this.anim = new QuadAnimator(this.rig, this); this.pos = new THREE.Vector3(x, Terrain.height(x, z), z); this.home = { x, z }; this.yaw = rand(0, TAU); this.speed = 0; this.state = 'graze'; this.t = rand(0, 5); this.hp = c.hp; this.alive = true; this.hitR = sp === 'rabbit' ? 0.3 : 0.55; this.hitH = sp === 'rabbit' ? 0.25 : sp === 'wolf' ? 0.7 : 1.0; this.trackD = 0; this.shots = 0; this.pack = o.pack; this.atkT = 0; HURTABLE.push(this);
    this.it = Interact.add({ pos: () => this.pos, r: 2, pri: 0.4, opts: p => !this.alive && !this.skinned ? [{ label: `Skin ${sp}`, fn: () => this.skin(p) }] : [] }); }
  scare(x, z) { if (!this.alive || this.cfg.predator) return; this.state = 'flee'; this.fleeFrom = { x, z }; this.fleeT = rand(6, 10); }
  onStep() { if (this.sp === 'deer' && this.speed > 3) Sfx.burst(300, 0.04, 0.03); }
  takeHit(o) { if (!this.alive) return; this.hp -= o.dmg; this.shots++; if (o.from && o.from.isPlayer) this.lastWeapon = o.gun || 'fists';
    if (this.hp <= 0) { this.alive = false; this.state = 'dead'; this.speed = 0; Missions.emit('hunt', { sp: this.sp, quality: this.shots === 1 && o.gun === 'rifle' ? 3 : this.shots <= 2 ? 2 : 1, beast: this }); return; }
    if (this.cfg.predator) { this.state = 'attack'; } else this.scare(o.from ? o.from.pos.x : this.pos.x, o.from ? o.from.pos.z : this.pos.z); }
  skin(p) { p.anim.play('kneel', { loop: true }); setTimeout(() => { p.anim.stop('kneel'); this.skinned = true; const q = this.shots === 1 ? 'perfect' : this.shots === 2 ? 'good' : 'poor'; Inv.add(this.cfg.pelt, 1); Inv.add(this.cfg.meat[0], this.cfg.meat[1]); S.stats.pelts++; UI.toast(`${q[0].toUpperCase() + q.slice(1)} ${this.sp} pelt`, 'good'); Missions.emit('skin', { sp: this.sp, quality: q }); setTimeout(() => Animal.remove(this), 20000); this.rig.vis.scale.multiplyScalar(0.85); }, 1600); }
  update(dt, far) {
    if (!this.alive) { this.anim.update(dt, { speed: 0, dead: 1 }); this.rig.root.position.copy(this.pos); return; }
    const c = this.cfg, P = Game.player; this.t += dt; const dP = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z); this.distP = dP;
    if (far) { const cp = Game.cam.pos; this.rig.root.visible = (this.pos.x - cp.x) ** 2 + (this.pos.z - cp.z) ** 2 < 150 * 150; return; }
    const night = Sky.night(); let tgtSpeed = 0, graze = 0, lie = 0, alert = false;
    const sense = c.sense * (P.noise || 1) * (P.state === 'ride' ? 1.3 : 1);
    if (!c.predator && this.state !== 'flee' && dP < sense) { if (dP < sense * 0.6 || P.vel.length() > 4) this.scare(P.pos.x, P.pos.z); else { this.state = 'alert'; } }
    if (c.predator) { // wolves: hunt deer, stalk then attack player
      if (this.state !== 'attack' && this.state !== 'flee' && dP < 26 && P.alive) this.state = dP < 12 ? 'attack' : 'stalk';
      if (this.hp < c.hp * 0.3 && this.state !== 'flee') { this.state = 'flee'; this.fleeFrom = { x: P.pos.x, z: P.pos.z }; this.fleeT = 12; }
      if (this.state === 'graze' || this.state === 'wander') { const prey = Animal.all.find(a => a.alive && a.sp === 'deer' && Math.hypot(a.pos.x - this.pos.x, a.pos.z - this.pos.z) < 30); if (prey) { this.prey = prey; this.state = 'hunt'; } }
    }
    switch (this.state) {
      case 'graze': graze = 1; if (night && c.day) { this.state = 'sleep'; } this.wT = (this.wT || rand(3, 8)) - dt; if (this.wT <= 0) { this.wT = rand(4, 10); this.state = 'wander'; this.wTo = { x: this.home.x + rand(-15, 15), z: this.home.z + rand(-15, 15) }; } break;
      case 'wander': tgtSpeed = c.walk; this.steer(this.wTo.x, this.wTo.z, dt); if (Math.hypot(this.wTo.x - this.pos.x, this.wTo.z - this.pos.z) < 1.5) this.state = 'graze'; break;
      case 'sleep': lie = 1; if (!night) this.state = 'graze'; break;
      case 'alert': alert = true; this.yaw = dampAngle(this.yaw, Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z), 3, dt); if (dP > sense * 1.2) this.state = 'graze'; break;
      case 'flee': { tgtSpeed = c.run; const a = Math.atan2(this.pos.x - this.fleeFrom.x, this.pos.z - this.fleeFrom.z) + Math.sin(this.t * 2) * 0.4; this.yaw = dampAngle(this.yaw, a, 5, dt); this.fleeT -= dt; if (this.fleeT <= 0) { this.state = 'graze'; this.home = { x: this.pos.x, z: this.pos.z }; } break; }
      case 'stalk': tgtSpeed = 2; this.steer(P.pos.x, P.pos.z, dt); break;
      case 'hunt': { const pr = this.prey; if (!pr || !pr.alive) { this.state = 'graze'; break; } tgtSpeed = 8; this.steer(pr.pos.x, pr.pos.z, dt); pr.scare(this.pos.x, this.pos.z); if (Math.hypot(pr.pos.x - this.pos.x, pr.pos.z - this.pos.z) < 1.4) { pr.takeHit({ dmg: 30 }); } break; }
      case 'attack': { const tgtH = Game.horse.rider ? null : (Game.horse.distP < dP && dP > 6 ? Game.horse : null); tgtSpeed = dP > 1.6 ? c.run : 0; this.steer(P.pos.x, P.pos.z, dt); this.atkT -= dt; if (dP < 1.8 && this.atkT <= 0) { this.atkT = 1.3; P.hurt(11, this, 'melee'); Sfx.burst(600, 0.15, 0.2); this.rear = 0.4; } if (dP > 45) this.state = 'graze'; break; }
    }
    if (c.day && night && this.state === 'wander') this.state = 'sleep'; if (c.night && !night && this.state !== 'attack' && this.state !== 'flee' && dP > 40) { this.state = 'graze'; }
    this.speed = damp(this.speed, tgtSpeed, 4, dt); const f = fwd(this.yaw); this.pos.x += f.x * this.speed * dt; this.pos.z += f.z * this.speed * dt;
    if (WORLD.waterY - Terrain.height(this.pos.x, this.pos.z) > 0.6) { this.pos.x -= f.x * this.speed * dt * 2; this.pos.z -= f.z * this.speed * dt * 2; this.yaw += 1.5 * dt * 3; }
    Col.resolve(this.pos, 0.4, this.pos.y, 1); this.pos.y = Terrain.height(this.pos.x, this.pos.z);
    if (c.tracks) { this.trackD += this.speed * dt; if (this.trackD > 1.4) { this.trackD = 0; FX.track(this.pos.x + Math.cos(this.yaw) * 0.12 * (this.tr = -(this.tr || 1)), this.pos.z - Math.sin(this.yaw) * 0.12 * this.tr, this.yaw); } }
    this.rear = Math.max(0, (this.rear || 0) - dt);
    this.anim.update(dt, { speed: this.speed, gait: c.hop ? 'hop' : this.speed > 5 ? 'gallop' : this.speed > 2.5 ? 'trot' : 'walk', graze, lie, alert, rear: this.rear > 0 ? 0.3 : 0 });
    this.rig.root.position.copy(this.pos); this.rig.root.rotation.y = this.yaw; const cp = Game.cam.pos; this.rig.root.visible = (this.pos.x - cp.x) ** 2 + (this.pos.z - cp.z) ** 2 < 150 * 150;
  }
  steer(x, z, dt) { this.yaw = dampAngle(this.yaw, Math.atan2(x - this.pos.x, z - this.pos.z), 4, dt); }
}
