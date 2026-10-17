/* ===== Riders: NPCs on horseback =====
   RDR2-style mounted enemies: posses ride after you when you're wanted out in the country, bounty runners flee on
   horseback, ambushers ride in. Riders shoot from the saddle; shooting the rider drops them, shooting the horse throws
   them. Riderless horses bolt, then wander off. (Weather effects on play live in Sky and Person.perceive.) */
class NPCHorse {
  constructor(x, z, yaw, color = pick(['#4b3a2a', '#7a5232', '#2b2018', '#a0673a', '#d9c7a3'])) {
    this.rig = makeQuad({ type: 'horse', color, dark: '#2b1d14', mane: '#2b1d14', tail: '#2b1d14', muzzle: '#5a4030', scale: 0.98 }); this.rig.saddle.visible = true; Game.scene.add(this.rig.root);
    this.anim = new QuadAnimator(this.rig, this); this.pos = new THREE.Vector3(x, Col.ground(x, z, 99), z); this.yaw = yaw || 0; this.speed = 0; this.gait = 'walk'; this.turnRate = 0;
    this.alive = true; this.hp = 150; this.hitR = 0.7; this.hitH = 1.05; // body sphere stops at the saddle, so shots at the rider hit the rider
    this.isMount = true; this.rider = null; this.t = 0; this.fleeT = 0; HURTABLE.push(this); Riders.horses.push(this);
  }
  seat() { const p = new THREE.Vector3(); this.rig.seat.getWorldPosition(p); return p; }
  steer(tx, tz, want, dt) { // limited turn rate and acceleration, like a real horse; mud slows it down
    const a = Math.atan2(tx - this.pos.x, tz - this.pos.z), d = angDiff(this.yaw, a), maxT = (this.speed > 8 ? 1.4 : 2.4) * dt; const turn = clamp(d * (1 - Math.exp(-3 * dt)), -maxT, maxT); this.yaw += turn; this.turnRate = turn / Math.max(dt, 1e-4);
    const top = want * (1 - Sky.wet * 0.18); this.speed = damp(this.speed, Math.abs(d) > 1.6 ? Math.min(top, 3) : top, top > this.speed ? 1.5 : 2.5, dt); this.move(dt);
  }
  move(dt) {
    const f = fwd(this.yaw); this.pos.x += f.x * this.speed * dt; this.pos.z += f.z * this.speed * dt;
    if (Col.resolve(this.pos, 0.55, this.pos.y, 1.6)) this.speed *= 0.85; if (WORLD.waterY - Terrain.height(this.pos.x, this.pos.z) > 1.4 && Col.ground(this.pos.x, this.pos.z, this.pos.y + 1) < WORLD.waterY + 0.2) this.speed = Math.min(this.speed, 2.6); /* swimming pace only off the bridge */
    this.pos.x = clamp(this.pos.x, -WORLD.half + 8, WORLD.half - 8); this.pos.z = clamp(this.pos.z, -WORLD.half + 8, WORLD.half - 8); this.pos.y = damp(this.pos.y, Col.ground(this.pos.x, this.pos.z, this.pos.y + 1), 14, dt);
    this.gait = this.speed < 3.2 ? 'walk' : this.speed < 6.4 ? 'trot' : this.speed < 10.5 ? 'canter' : 'gallop';
  }
  takeHit(o) {
    if (!this.alive) return; FX.impact({ x: this.pos.x, y: this.pos.y + this.hitH, z: this.pos.z }, 'blood'); this.hp -= o.dmg; Sfx.neigh && Sfx.neigh();
    if (this.hp <= 0) { this.alive = false; this.speed = 0; if (o.from && o.from.isPlayer) Rep.honor(-1); if (this.rider) Riders.throwRider(this.rider, true); }
  }
  update(dt) {
    this.t += dt; const P = Game.player, dP = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z); this.distP = dP;
    if (!this.alive) { this.anim.update(dt, { speed: 0, dead: 1 }); this.rig.root.position.copy(this.pos); this.rig.root.rotation.y = this.yaw; if (dP > 170) this.remove(); return; }
    if (!this.rider && this.tethered) { this.speed = 0; } // a saddled horse waiting for its owner stays put
    else if (!this.rider) { // riderless: bolt for a few seconds, then graze; disappear once far away
      this.fleeT -= dt; if (this.fleeT > 0) { const a = this.yaw; this.steer(this.pos.x + Math.sin(a) * 10, this.pos.z + Math.cos(a) * 10, 9, dt); } else { this.speed = damp(this.speed, 0, 2, dt); this.move(dt); }
      if (dP > 160) { this.remove(); return; }
    }
    if (this.speed > 6 && this.speed > 0) { this.dustT = (this.dustT || 0) - dt; if (this.dustT <= 0) { this.dustT = 0.09; const b = fwd(this.yaw); FX.puff(this.pos.x - b.x * 0.9, this.pos.y + 0.15, this.pos.z - b.z * 0.9, { color: Sky.wet > 0.4 ? 0x7d6646 : 0xc9b48a, n: 1, size: 0.55, life: 1.0, rise: 0.35, burst: 0.3, op: 0.4, grow: 2.4 }); } }
    this.anim.update(dt, { speed: this.speed, gait: this.gait, roll: -this.turnRate * 0.03 * clamp(this.speed / 8, 0, 1), graze: !this.rider && this.speed < 0.3 ? 1 : 0 });
    this.rig.root.position.copy(this.pos); this.rig.root.rotation.y = this.yaw; const cp = Game.cam.pos; this.rig.root.visible = (this.pos.x - cp.x) ** 2 + (this.pos.z - cp.z) ** 2 < 150 * 150;
  }
  remove() { Game.scene.remove(this.rig.root); const i = HURTABLE.indexOf(this); if (i >= 0) HURTABLE.splice(i, 1); Riders.horses = Riders.horses.filter(h => h !== this); if (this.rider) { this.rider.mount = null; } }
}

const Riders = {
  horses: [], posseCD: 0,
  mount(n, horse) { n.mount = horse; horse.rider = n; horse.tethered = false; n.prevState = n.state; n.state = 'ride'; n.path = null; if (n.gunM && n.gun) n.gunM.visible = true; },
  spawnRider(cfg, mode, x, z, yaw) { const h = new NPCHorse(x, z, yaw); const n = NPC.spawn(Object.assign({ x, z, wild: true }, cfg)); this.mount(n, h); n.rideMode = mode; n.shootT = rand(1.5, 2.5); return n; },
  throwRider(n, stun) { // off the horse: thrown riders are stunned on the ground (a bounty can then be hogtied); dead ones just fall
    const h = n.mount; if (!h) return; h.rider = null; h.fleeT = 6; n.mount = null; const s = fwd(h.yaw + Math.PI / 2); n.pos.set(h.pos.x + s.x * 1.2, Col.ground(h.pos.x + s.x * 1.2, h.pos.z + s.z * 1.2, 99), h.pos.z + s.z * 1.2);
    if (!n.alive) { n.state = 'dead'; return; } if (n.downed) { n.state = 'down'; return; }
    if (stun) { n.knockdown(); if (!n.tags.includes('bounty') && !n.tags.includes('outlaw')) n.downT = 4; UI.toast(`${n.name} was thrown from the saddle`, 'good'); return; }
    n.state = 'combat'; n.fightPlayer(!n.gun);
  },
  ai(n, dt) { // runs from Person.update while n.state === 'ride'
    const h = n.mount; if (!h || !h.alive) { n.state = 'combat'; n.mount = null; return; }
    const P = Game.player, d = n.distP || 0; let tx = h.pos.x, tz = h.pos.z, want = 0;
    if (n.rideMode === 'chase') { // close in, then ride alongside at pistol range
      if (n.lawman && !S.wanted) n.rideMode = 'leave';
      const side = n.flankSide || (n.flankSide = Math.random() < 0.5 ? -1 : 1), r = fwd(Math.atan2(P.pos.x - h.pos.x, P.pos.z - h.pos.z) + Math.PI / 2);
      if (d > 22) { tx = P.pos.x; tz = P.pos.z; want = 11.5; } else { tx = P.pos.x + r.x * side * 10; tz = P.pos.z + r.z * side * 10; want = P.state === 'ride' ? Math.max(4, Game.horse.speed) : 4; }
    } else if (n.rideMode === 'flee') { const a = Math.atan2(h.pos.x - P.pos.x, h.pos.z - P.pos.z); tx = h.pos.x + Math.sin(a) * 20; tz = h.pos.z + Math.cos(a) * 20; want = d < 120 ? 12 : 6; if (d > 160 && n.onEscape) { n.onEscape(n); n.onEscape = null; }
    } else if (n.rideMode === 'leave') { tx = -40; tz = 20; want = 7; if (d > 150 || Math.hypot(h.pos.x + 40, h.pos.z - 20) < 8) { this.despawnRider(n); return; } // home, or out of sight
    } else if (n.rideMode === 'travel' && n.dest) { tx = n.dest.x; tz = n.dest.z; want = n.destSpeed || 5; if (Math.hypot(tx - h.pos.x, tz - h.pos.z) < 4) want = 0; }
    h.steer(tx, tz, want, dt);
    const seat = h.seat(); n.pos.set(seat.x, seat.y - (n.rig.isModel ? 0.24 : 0.62), seat.z); n.yaw = h.yaw; n.sp = 0;
    // shooting from the saddle
    n.allyAim = false;
    if ((n.hostileToPlayer || (n.lawman && S.wanted)) && n.rideMode === 'chase' && P.alive && d < 40 && n.gun && !n.fists) { // a disarmed rider can't shoot
      n.allyAim = true; n.anim.layers.aim = 1; n.face(P.pos); n.shootT -= dt;
      if (n.shootT <= 0 && n.seesPlayer) { n.shootT = rand(1.6, 2.8); const m = new THREE.Vector3(); n.rig.R.hand.getWorldPosition(m);
        const acc = n.accuracy * 0.65 * (d < 12 ? 1.2 : d > 25 ? 0.55 : 1) * (P.state === 'ride' ? 0.75 : 1) * Sky.visMul(); const hit = Math.random() < acc;
        const tgt = new THREE.Vector3(P.pos.x + (hit ? 0 : rand(-2, 2)), P.pos.y + (hit ? 1.2 : rand(-0.2, 1.8)), P.pos.z + (hit ? 0 : rand(-2, 2))); if (!hit && tgt.y < P.pos.y + 0.6) tgt.y = Terrain.height(tgt.x, tgt.z);
        FX.tracer(m, tgt, hit ? 'none' : 'auto'); Sfx.shot(n.gun === 'rifle'); n.anim.play('recoil'); if (hit) P.hurt(n.dmg, n, 'gun'); Town.shot(h.pos.x, h.pos.z, n); }
    }
  },
  clear() { for (const h of this.horses.slice()) { h.rider = null; h.remove(); } this.posseCD = 0; }, // loading or retrying: no riderless horses frozen in place
  despawnRider(n) { const h = n.mount; if (h) { h.rider = null; h.remove(); } NPC.despawn(n); },
  /* ---------- the law rides out ---------- */
  posse(dt) {
    this.posseCD -= dt; const P = Game.player, posse = NPC.all.filter(n => n.tags.includes('posse'));
    if (!S.wanted || this.posseCD > 0 || posse.length || Missions.active === 'ch4') return;
    if (Math.hypot(P.pos.x + 40, P.pos.z - 20) < 75) return; // in town the deputies on foot handle it
    this.posseCD = 90; const a = Math.atan2(-40 - P.pos.x, 20 - P.pos.z); // they ride out from Juniper Gap
    for (let i = 0; i < 2; i++) { const x = P.pos.x + Math.sin(a + (i ? 0.25 : -0.25)) * 95, z = P.pos.z + Math.cos(a + (i ? 0.25 : -0.25)) * 95;
      this.spawnRider({ key: 'posse' + i + '_' + Math.floor(Math.random() * 1e5), name: i ? 'Posse rider' : 'Deputy Marshal', lawful: true, lawman: true, gun: i ? 'rifle' : 'revolver', hp: 110, maxHp: 110, accuracy: 0.45, tags: ['generic', 'posse'], look: { skin: '#e8b48c', shirt: '#6b6b6b', vest: '#2b2b2b', hair: '#3b2a1e', hatColor: '#2b2b2b', badge: true } }, 'chase', x, z, a + Math.PI); }
    UI.toast('A posse is riding out after you!', 'bad');
  },
  update(dt) {
    if (!Game.running) return; this.posse(dt);
    for (const h of this.horses.slice()) h.update(dt);
    for (const n of NPC.all) if (n.mount && (!n.alive || n.downed)) this.throwRider(n, false); // shot out of the saddle
  },
};

// mounted people are driven by Riders.ai; lawmen on horseback keep riding instead of switching to foot pursuit
const _pursue = Person.prototype.pursue, _calm = Person.prototype.calm;
Person.prototype.pursue = function () { if (this.state === 'ride') { this.rideMode = 'chase'; return; } return _pursue.call(this); };
Person.prototype.calm = function () { if (this.state === 'ride') { this.hostileToPlayer = false; this.rideMode = 'leave'; return; } return _calm.call(this); };
