/* ===== Close-range combat: counters, grabs and shoves; where a bullet lands changes how people react; outlaw squads
   that flank, keep their heads down under fire, and rush you when you reload.
   - Counter: start blocking (Q) just before a punch lands and Wren slips it and hits back; the attacker reels.
   - Grab: block + attack on someone in reach. While holding: attack = punch, X (or Q again) = shove them to the ground.
   - Gunshots: legs make them limp (sometimes drop to a knee), the gun hand knocks the gun away, the body makes them flinch.
   - Squads: one in three goes around your side, near misses pin them in cover, and they charge while you reload. */
const _hv = new THREE.Vector3();
const Brawl = {
  drops: [],
  handRay(o, d, h) { // distance along the ray to the gun hand, or -1
    if (!h.gunM || !h.gunM.visible || h.fists || !h.rig || !h.rig.R || !h.rig.R.hand) return -1; h.rig.R.hand.getWorldPosition(_hv);
    const t = (_hv.x - o.x) * d.x + (_hv.y - o.y) * d.y + (_hv.z - o.z) * d.z; if (t <= 0) return -1;
    const px = o.x + d.x * t - _hv.x, py = o.y + d.y * t - _hv.y, pz = o.z + d.z * t - _hv.z; return px * px + py * py + pz * pz < 0.17 * 0.17 ? t : -1;
  },
  windup(n) { Sfx.tone(300, 0.14, 0.04, 'triangle', 260); n.windT = 0.3; }, // a cue before the punch: the moment to block for a counter
  counter(P, n) { // called when an enemy punch lands: true if Wren countered it
    if (!P.blocking || P.blockT > (Skills.has('brawl', 3) ? 0.6 : 0.45) || P.grab) return false;
    const a = Math.atan2(n.pos.x - P.pos.x, n.pos.z - P.pos.z); n.pos.x += Math.sin(a) * 0.5; n.pos.z += Math.cos(a) * 0.5; Col.resolve(n.pos, 0.34, n.pos.y, 1.6); n.stunT = 1.4; n.stunKnee = false; n.anim.play('hit', { replace: false }); n.anim.expr = 'alarm';
    P.yaw = a; P.blockT = 9; this.lastCounter = { n, t: Game.time }; P.anim.play('hook', { on: { hit: () => { if (n.alive && !n.downed) { n.takeHit({ dmg: 14, from: P, melee: true, dir: fwd(P.yaw) }); Sfx.punch(); } } } });
    Sfx.burst(1300, 0.07, 0.12, 'bandpass', 2); Game.shake(0.2); UI.hitmark(true); S.stats.counters = (S.stats.counters || 0) + 1; Skills.gain('brawl', 3); Haptic.buzz([30, 40, 30]); return true;
  },
  canGrab(n) { return n.alive && !n.downed && !n.carried && !n.grabbed && n.state !== 'ride' && n.state !== 'tied' && !n.hogtied; },
  tryGrab(P) {
    const f = fwd(P.yaw); let tgt = null, td = 1.8;
    for (const n of NPC.all) { if (!this.canGrab(n)) continue; const dx = n.pos.x - P.pos.x, dz = n.pos.z - P.pos.z, d = Math.hypot(dx, dz); if (d < td && (dx * f.x + dz * f.z) / (d || 1) > 0.3 && Math.abs(n.pos.y - P.pos.y) < 1) { td = d; tgt = n; } }
    if (!tgt || S.p.st < 10 || P.carry || !Col.los(P.pos.x, P.pos.y + 1.2, P.pos.z, tgt.pos.x, tgt.pos.y + 1.2, tgt.pos.z)) return false;
    S.p.st -= 10; P.stDelay = 0.8; Sfx.burst(300, 0.12, 0.15); tgt.takeHit({ dmg: 1, from: P, melee: true }); // grabbing someone is assault, and wakes the fight
    if (!tgt.alive || tgt.downed) return true; // a crouched grab from behind is a silent takedown
    P.grab = tgt; P.grabT = 0; P.grabHits = 0; tgt.grabbed = true; Skills.gain('brawl', 1); tgt.stunT = 0; tgt.anim.expr = 'alarm'; tgt.say(pick(['Get off me!', 'Let go of me!', 'Hey!'])); return true;
  },
  release(P) { if (P.grab) P.grab.grabbed = false; P.grab = null; },
  hold(P, dt) { // each frame while Wren holds someone
    const n = P.grab; if (!n.alive || n.downed || !NPC.all.includes(n) || P.state !== 'ground') return this.release(P);
    P.grabT += dt; const f = fwd(P.yaw); n.pos.x = damp(n.pos.x, P.pos.x + f.x * 0.75, 14, dt); n.pos.z = damp(n.pos.z, P.pos.z + f.z * 0.75, 14, dt); Col.resolve(n.pos, 0.34, n.pos.y, 1.6); n.yaw = P.yaw + Math.PI; n.place(); P.vel.set(0, 0, 0);
    if ((Input.mouse.lp || Input.hit('f') || Input.tb('attack')) && P.cool <= 0 && !P.anim.busy()) { P.cool = 0.45; P.grabT = Math.max(0, P.grabT - 0.6); S.p.st -= 4;
      P.anim.play(P.grabHits++ % 2 ? 'hook' : 'punch', { on: { hit: () => { if (P.grab !== n) return; n.takeHit({ dmg: 20, from: P, melee: true }); Sfx.punch(); Game.shake(0.15); if (n.downed || !n.alive) this.release(P); } } }); return; }
    if (Input.hit('x') || Input.hit('q') || Input.tb('dodge') || Input.tb('shove')) return this.shove(P, n);
    if (P.grabT > (Skills.has('brawl', 5) ? 4.5 : 3.2)) { this.release(P); n.say(pick(['Ha!', 'Not today!'])); P.anim.play('hit', { replace: false }); const a = Math.atan2(P.pos.x - n.pos.x, P.pos.z - n.pos.z); P.vel.x = Math.sin(a) * 4; P.vel.z = Math.cos(a) * 4; } // they wriggle free
  },
  shove(P, n) {
    this.release(P); const f = fwd(P.yaw); n.shoveV = new THREE.Vector3(f.x * 9, 0, f.z * 9); n.floorT = 2.4; P.anim.play('punch'); Sfx.burst(240, 0.25, 0.25); Game.shake(0.2);
    n.takeHit({ dmg: Skills.has('brawl', 5) ? 16 : 8, from: P, melee: true }); if (n.downed) n.floorT = 0; Skills.gain('brawl', 1);
    for (const o of NPC.all) if (o !== n && this.canGrab(o) && Math.hypot(o.pos.x - (n.pos.x + f.x * 1.6), o.pos.z - (n.pos.z + f.z * 1.6)) < 1.1) { o.stunT = 1.2; o.anim.play('hit', { replace: false }); } // knocked into a friend
  },
  npcTick(n, dt) { // reactions that take over an NPC's turn; true when it used the frame
    if (n.limpT > 0) n.limpT -= dt; if (n.windT > 0) n.windT -= dt;
    if (n.grabbed) { if (Game.player.grab !== n) n.grabbed = false; else { n.sp = 0; n.anim.update(dt, { state: 'ground', speed: 0 }); n.place(); return true; } }
    if (n.floorT > 0) { n.floorT = Math.max(0, n.floorT - dt);
      if (n.shoveV) { n.pos.addScaledVector(n.shoveV, dt); Col.resolve(n.pos, 0.34, n.pos.y, 1.6); n.shoveV.multiplyScalar(Math.exp(-5 * dt)); n.pos.y = Col.ground(n.pos.x, n.pos.z, n.pos.y + 0.5); }
      n.anim.update(dt, { state: 'down', speed: 0 }); n.place(); if (n.floorT <= 0) { n.shoveV = null; n.anim.play('standup'); } return true; }
    if (n.stunT > 0) { n.stunT = Math.max(0, n.stunT - dt); n.sp = 0; n.anim.update(dt, { state: 'ground', speed: 0, crouch: n.stunKnee }); n.place(); return true; }
    return false;
  },
  react(n, o) { // how a person reacts to where a bullet landed (they survived it)
    if (!o.gun || n.hp <= 0 || !n.alive) return; if (n.state === 'ride') { if (o.zone === 'hand') this.disarm(n, true); return; } // in the saddle a hit can only cost them the gun
    if (o.zone === 'legs') { n.limpT = 12; if (Math.random() < 0.4) { n.stunT = 1.1; n.stunKnee = true; } if (n.hostileToPlayer) Tactics.call(n, pick(['Agh, my leg!', 'I\'m hit!']), true); }
    else if (o.zone === 'hand') this.disarm(n);
    else if (o.zone === 'body') { n.stunT = Math.max(n.stunT || 0, 0.35); n.stunKnee = false; n.shootT = Math.max(n.shootT || 0, 0.8); }
  },
  disarm(n, riding) {
    if (!n.gun || n.fists) return; const g = n.gun, f = fwd(n.yaw), x = n.pos.x + f.x * 1.1 + rand(-0.3, 0.3), z = n.pos.z + f.z * 1.1 + rand(-0.3, 0.3);
    n.gun = null; n.fists = true; if (n.gunM) n.gunM.visible = false; if (!riding) { n.stunT = 0.6; n.stunKnee = false; }
    const m = new THREE.Mesh(GEO.box, toon('#2b2522')); m.scale.set(0.09, 0.07, g === 'rifle' ? 0.9 : 0.3); m.position.set(x, Col.ground(x, z, n.pos.y + 1) + 0.04, z); m.rotation.y = rand(0, TAU); Game.scene.add(m);
    const dr = { x, z, m, gun: g, t: 0 }; this.drops.push(dr); FX.puff(n.pos.x, n.pos.y + 1.1, n.pos.z, { n: 2, size: 0.3, color: 0x9a948a, life: 0.5 });
    Sfx.tone(1800, 0.05, 0.08, 'square'); n.say(pick(['My hand!', 'Argh, my gun!']), 2); UI.toast('Disarmed', 'good'); S.stats.disarms = (S.stats.disarms || 0) + 1; Skills.gain('gun', 4);
    if (n.hostileToPlayer && !riding && (n.brave > 0.5 || n.group)) n.regun = dr; // the brave ones go for it
  },
  regunTick(n, dt) { // a disarmed outlaw dives for the gun; true while busy with it
    const dr = n.regun, P = Game.player; if (!this.drops.includes(dr) || Math.hypot(P.pos.x - dr.x, P.pos.z - dr.z) < 2.5) { n.regun = null; return false; }
    if (n.moveTo(dr.x, dr.z, 4.8, dt, 0.5)) { n.pickT = (n.pickT || 0) + dt; n.crouchC = true; if (n.pickT > 0.8) { n.pickT = 0; n.crouchC = false; this.takeDrop(dr); n.gun = dr.gun; n.fists = false; if (n.gunM) n.gunM.visible = true; n.regun = null; n.say('Now where were we?'); } }
    return true;
  },
  takeDrop(dr) { Game.scene.remove(dr.m); this.drops = this.drops.filter(d => d !== dr); },
  update(dt) {
    const P = Game.player; if (P.grab) this.hold(P, dt);
    for (const dr of this.drops.slice()) { dr.t += dt; if (dr.t > 90) this.takeDrop(dr); else if (P.state === 'ground' && Math.hypot(P.pos.x - dr.x, P.pos.z - dr.z) < 1.1 && !NPC.all.some(n => n.regun === dr && n.pickT > 0 && n.alive && !n.downed)) { this.takeDrop(dr); Inv.add(dr.gun === 'rifle' ? 'ammo_rifle' : 'ammo_rev', 3); Sfx.pickup(); UI.toast('Took their ' + (dr.gun === 'rifle' ? 'rifle' : 'revolver') + ' (+3 rounds)', 'good'); } }
  },
  clear() { for (const dr of this.drops) Game.scene.remove(dr.m); this.drops = []; if (Game.player) this.release(Game.player); },
};

const Tactics = {
  t: 0, cd: 0,
  call(n, line, force) { if (this.cd > 0 && !force) return; this.cd = 4; n.say(line, 2); },
  foes() { return NPC.all.filter(n => n.alive && !n.downed && n.state === 'combat' && n.hostileToPlayer && n.gun && !n.fists && n.distP < 60); },
  update(dt) {
    this.cd -= dt; this.t -= dt; if (this.t > 0) return; this.t = 0.5; const P = Game.player, foes = this.foes(); if (!P.alive || P.state === 'down') return;
    if (foes.length >= 3) { const want = Math.floor(foes.length / 3); let have = foes.filter(n => n.flanker).length;
      for (const n of foes.slice().sort((a, b) => a.distP - b.distP)) { if (have >= want) break; if (n.flanker || n.flankDone || n.distP < 6) continue;
        const side = have % 2 ? -1 : 1, a = Math.atan2(n.pos.x - P.pos.x, n.pos.z - P.pos.z) + side * 1.35, r = clamp(n.distP, 10, 16); // swing around to the player's side
        n.flanker = true; n.flankT = 7; n.flankTo = { x: P.pos.x + Math.sin(a) * r, z: P.pos.z + Math.cos(a) * r }; n.cover = null; have++; this.call(n, pick(['Flank her!', 'Go around!', 'Cut him off!'])); } }
    if ((P.reloading || S.p.hp < S.p.maxHp * 0.3) && !foes.some(n => n.rushT > 0)) for (const n of foes) if (!n.rushT && n.distP < 18 && (n.brave ?? 0.6) > 0.45) { n.rushT = 2.4; n.cover = null; this.call(n, P.reloading ? 'She\'s reloading! Rush her!' : 'She\'s hurt! Finish it!', true); break; }
  },
  move(n, dt, d) { // squad movement that overrides cover: true when it moved the NPC this frame
    const P = Game.player;
    if (n.rushT > 0) { n.rushT -= dt; n.crouchC = false; if (d > 3.2) n.moveTo(P.pos.x, P.pos.z, 5.2, dt, 3); else n.sp = damp(n.sp, 0, 8, dt); if (n.rushT <= 0) n.rushT = -5; return true; } // then a few seconds before rushing again
    if (n.rushT < 0) n.rushT = Math.min(0, n.rushT + dt);
    if (n.flanker && n.flankT > 0) { n.flankT -= dt; n.crouchC = false; if (n.moveTo(n.flankTo.x, n.flankTo.z, 4.8, dt, 1) || n.flankT <= 0) { n.flankT = 0; n.flankDone = true; n.cover = n.pickCover(); n.coverT = rand(5, 9); } return true; }
    return false;
  },
  nearMiss(a, b, hitH) { // a bullet from a to b that whizzed past people pins them down
    const ab = new THREE.Vector3().subVectors(b, a), L = ab.length(); if (L < 0.1) return; ab.divideScalar(L);
    for (const n of NPC.all) { if (n === hitH || !n.alive || n.downed || n.state !== 'combat' || !n.hostileToPlayer) continue;
      const cx = n.pos.x - a.x, cy = n.pos.y + 1.2 - a.y, cz = n.pos.z - a.z, t = clamp(cx * ab.x + cy * ab.y + cz * ab.z, 0, L), dx = cx - ab.x * t, dy = cy - ab.y * t, dz = cz - ab.z * t;
      if (dx * dx + dy * dy + dz * dz < 1.6 * 1.6 && t > 1) { n.suppressT = rand(1.6, 2.4); if (!n.cover) n.coverT = 0; if (Math.random() < 0.3) this.call(n, pick(['Whoa, that was close!', 'Keep your head down!', 'She\'s got us pinned!'])); } }
  },
};
