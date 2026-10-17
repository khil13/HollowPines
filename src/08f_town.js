/* ===== A living frontier: the town reacts to gunfire, the law answers it, bounty hunters ride after the paper on your
   head, your own face goes up on a wanted poster, and new things happen on the road (a stranded settler, a duel).
   - Gunfire in Juniper Gap: townsfolk run for the nearest door and cower inside until it's quiet; the sheriff or a
     deputy comes to see who's shooting and warns you once; fire again and it's disturbing the peace.
   - Bounty hunters: with a bounty on you (sooner at low honor), out in the country a band of hunters rides you down.
     Fight them off (they're fair game), or get knocked out and they haul you in to pay up.
   - Road: a settler's wagon with a broken wheel (help, rob, or ride on); a gunslinger calls you out to a duel. */
const TOWN_C = { x: -40, z: 20 };
const Town = {
  alarmT: 0, lawT: 0, warnedAt: -999, disturbAt: -999, huntCD: 150, events: [],
  inTown(x, z) { return Math.hypot(x - TOWN_C.x, z - TOWN_C.z) < 48; },
  shot(x, z, src) { // any gunshot: NPC-fired shots alert people too (the player's go through noiseEvent → hearShot)
    if (!this.inTown(x, z)) return; this.alarmT = 30; const P = Game.player;
    if (src && src.isPlayer) { if (Game.time - this.warnedAt < 90 && Game.time - this.disturbAt > 20 && !S.wanted) { this.disturbAt = Game.time; Law.crime('disturb', P.pos, { noise: 45 }); } }
    else for (const n of NPC.all) if (n !== src && n.alive && Math.hypot(n.pos.x - x, n.pos.z - z) < 40) n.hearShot({ x, z }, src);
  },
  panic(n, pos) { // a townsperson runs for the nearest door; true if they did
    if (n.state !== 'routine' || n.lawman || n.panicked) return false; let best = null, bd = 1e9;
    for (const b of Buildings) if (b.door && b.door.inner) { const d = Math.hypot(b.door.outer.x - n.pos.x, b.door.outer.z - n.pos.z); if (d < bd) { bd = d; best = b; } }
    if (!best || bd > 45) return false;
    n.panicked = true; n.hid = false; n.state = 'scripted'; n.go(best.door.inner.x, best.door.inner.z, false); n.anim.expr = 'alarm'; n.say(pick(['Gunfire! Get inside!', 'Lord, not again!', 'Everybody down!']), 2);
    n.script = (dt, me) => { me.anim.expr = 'alarm';
      if (!me.hid) { if (me.followPath(dt, 4.8) || me.stuck > 3) { me.hid = true; me.hideT = rand(16, 24); } }
      else { me.sp = 0; me.crouchC = true; me.hideT -= dt; if (me.hideT <= 0 && Town.alarmT <= 0) Town.calm(me); } };
    return true;
  },
  calm(n) { n.panicked = false; n.hid = false; n.crouchC = false; n.script = null; n.state = 'routine'; n.goal = null; n.path = null; n.anim.expr = 'calm'; },
  lawCheck(n, pos) { // the sheriff or a deputy comes to see who's shooting
    if (S.wanted || n.state === 'combat' || n.state === 'pursue' || this.lawT > 0) return; this.lawT = 20; this.lawCaller = n; n.investigate(pos); n.invT = 14; n.say('Who\'s shooting?!', 2);
  },
  // ---------- bounty hunters ----------
  hunters() { return NPC.all.filter(n => n.tags.includes('hunter')); },
  huntersNear() { const P = Game.player; return this.hunters().some(n => n.alive && !n.downed && Math.hypot(n.pos.x - P.pos.x, n.pos.z - P.pos.z) < 60); },
  huntTick(dt) {
    this.huntCD -= dt; const P = Game.player, hs = this.hunters();
    if (hs.length) { for (const n of hs) if (n.distP > 220) { if (n.mount) Riders.despawnRider(n); else NPC.despawn(n); }
      if (hs.every(n => !n.alive || n.downed)) { if (!this.huntDone) { this.huntDone = true; UI.toast('The bounty hunters won\'t be collecting today.', 'good'); journal('Bounty hunters came for the paper on me. They didn\'t get it.'); } }
      return; }
    const thr = S.honor <= -40 ? 8 : 15;
    if (S.bounty < thr || S.wanted || Missions.active || this.huntCD > 0 || Math.hypot(P.pos.x - TOWN_C.x, P.pos.z - TOWN_C.z) < 75 || P.state === 'down' || inBuilding(P.pos.x, P.pos.z, P.pos.y)) return;
    this.huntCD = S.honor <= -40 ? 200 : 320; this.huntDone = false;
    const back = Math.atan2(-Math.sin(P.yaw), -Math.cos(P.yaw)), names = ['Abel Kincaid', 'Bounty hunter', 'Bounty hunter'];
    for (let i = 0; i < 3; i++) { const a = back + (i - 1) * 0.35, x = clamp(P.pos.x + Math.sin(a) * 55, -WORLD.half + 10, WORLD.half - 10), z = clamp(P.pos.z + Math.cos(a) * 55, -WORLD.half + 10, WORLD.half - 10);
      const n = Riders.spawnRider({ key: 'hunter' + i + '_' + Math.floor(Math.random() * 1e5), name: names[i], lawful: false, gun: i === 1 ? 'rifle' : 'revolver', hp: 120, maxHp: 120, accuracy: 0.42, brave: 0.9, tags: ['generic', 'hunter'], look: { skin: i === 2 ? '#8d5a3b' : '#e2a57c', shirt: ['#4a3b2a', '#3f4a3a', '#5a4030'][i], coat: '#2e2a26', hair: '#2b2018', hatColor: '#1e1a16', beard: i === 0 ? '#2b2018' : null } }, 'chase', x, z, a + Math.PI);
      n.hostileToPlayer = true; }
    UI.toast(`Bounty hunters are riding after the $${S.bounty.toFixed(2)} on your head!`, 'bad'); this.hunters()[0].say('That paper\'s ours, Wren. Come quiet or come dead.', 4); Haptic.buzz([40, 60, 40]);
  },
  captured() { // knocked out by bounty hunters: they haul you to the sheriff and you pay what you owe
    const pay = Math.min(S.money, S.bounty); Inv.money(-pay, 'bounty collected'); S.bounty = 0; S.wanted = false; Law.searchC = null;
    for (const n of this.hunters()) { if (n.mount) Riders.despawnRider(n); else NPC.despawn(n); }
    Sky.advance(5); Game.player.teleport(-22, 14.5, 0); UI.toast('Bounty hunters dragged you in to the sheriff. Charges settled.', 'bad'); journal('Woke up in Pike\'s office. The bounty hunters got their money.');
  },
  // ---------- your own wanted poster outside the sheriff's office ----------
  posterInit() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 176; this.posterC = c; this.posterTex = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.85), new THREE.MeshLambertMaterial({ map: this.posterTex })); const y = Col.ground(-19.6, 4.3, 99); m.position.set(-19.6, y + 1.75, 4.42); m.rotation.y = Math.PI; Game.scene.add(m); this.poster = m; this.drawn = -1;
    Interact.add({ pos: () => ({ x: -19.6, y, z: 3.9 }), r: 1.8, pri: 0.3, opts: () => S.bounty >= 5 ? [{ label: 'Read poster: Wren', fn: () => Dialog.start(null, { start: { who: 'Wanted poster', text: `WANTED: "WREN", a drifter. ${S.bounty >= 30 ? 'Armed and dangerous. ' : ''}$${S.bounty.toFixed(2)} REWARD. Bring to Sheriff Pike, Juniper Gap. ${S.honor <= -40 ? 'Dead or alive.' : 'Alive preferred.'}`, choices: [{ text: 'Tear it down', do: () => { UI.toast('Torn down. Pike will put up another.', ''); this.torn = S.time.day; }, next: null }, { text: 'Leave it', next: null }] } }) }] : [] });
  },
  posterDraw() {
    const show = S.bounty >= 5 && this.torn !== S.time.day; this.poster.visible = show; if (!show) return; const key = Math.round(S.bounty) + S.outfit; if (key === this.drawn) return; this.drawn = key;
    const g = this.posterC.getContext('2d'), o = OUTFITS[S.outfit] || OUTFITS.duster; g.fillStyle = '#efe2c2'; g.fillRect(0, 0, 128, 176); g.strokeStyle = '#6b5a3e'; g.lineWidth = 3; g.strokeRect(4, 4, 120, 168);
    g.fillStyle = '#3b2a1e'; g.font = 'bold 22px Georgia, serif'; g.textAlign = 'center'; g.fillText('WANTED', 64, 30);
    g.fillStyle = '#e2b48c'; g.beginPath(); g.arc(64, 78, 22, 0, TAU); g.fill(); g.fillStyle = '#7a4a2a'; g.fillRect(42, 70, 8, 26); g.fillRect(78, 70, 8, 26); // face and hair
    g.fillStyle = o.hat || '#6b4a2f'; g.fillRect(34, 54, 60, 6); g.fillRect(46, 38, 36, 18); g.fillStyle = '#2b2018'; g.fillRect(55, 76, 4, 4); g.fillRect(69, 76, 4, 4);
    g.fillStyle = o.coat || o.shirt; g.fillRect(40, 102, 48, 18); g.fillStyle = '#3b2a1e'; g.font = 'bold 15px Georgia, serif'; g.fillText('"WREN"', 64, 138); g.font = 'bold 17px Georgia, serif'; g.fillText('$' + S.bounty.toFixed(0) + ' REWARD', 64, 160);
    this.posterTex.needsUpdate = true;
  },
  // ---------- road events ----------
  roadEvent(r) { const d = S.time.day, day = S.time.hour > 7 && S.time.hour < 19;
    if (r < 0.3 && S.flags.wagonDay !== d && day) return this.wagon(), true;
    if (r < 0.5 && S.flags.duelDay !== d && day && S.chapter >= 2) return this.duelist(), true;
    return false; },
  wagon() {
    S.flags.wagonDay = S.time.day; const s = Encounters.spot(26), y = Terrain.height(s.x, s.z), P = Game.player, yaw = P.yaw + Math.PI / 2;
    const g = new THREE.Group(); g.position.set(s.x, y, s.z); g.rotation.y = yaw; Game.scene.add(g);
    const bed = M(GEO.box, '#7a5a3c', 2.8, 0.5, 1.4, 0, 0.85, 0); bed.rotation.z = 0.14; g.add(bed); g.add(M(GEO.box, '#e8dfc8', 2.6, 1.0, 1.3, 0.1, 1.55, 0)); // canvas cover
    for (const [wx, wz] of [[-1.1, 0.75], [-1.1, -0.75], [1.1, 0.75]]) { const w = M(GEO.cyl, '#4a3a2a', 0.5, 0.1, 0.5, wx, 0.5, wz); w.rotation.x = Math.PI / 2; g.add(w); }
    const broke = M(GEO.cyl, '#4a3a2a', 0.5, 0.1, 0.5, 1.8, 0.06, -1.3); g.add(broke); // the broken wheel lies in the dirt
    const c = Col.circle(s.x, s.z, 1.5, y - 1, y + 2, { block: true, cover: true });
    const n = NPC.spawn({ key: 'wagon_otis', name: 'Otis Pruitt', x: s.x + Math.cos(yaw) * 2.4, z: s.z - Math.sin(yaw) * 2.4, lawful: true, wild: true, brave: 0.3, state: 'scripted', tags: ['generic', 'wayfarer'], look: { skin: '#e2a57c', shirt: '#6a7a4a', hair: '#9a8a7a', beard: '#9a8a7a', hatColor: '#7a6a4a' } });
    n.script = (dt, me) => { me.sp = 0; if (me.distP < 9) me.face(Game.player.pos); if (me.distP < 12 && !ev.called) { ev.called = true; me.say('Wheel came clean off! Could you lend a hand?', 4); } };
    const ev = { kind: 'wagon', g, c, n, fixed: false, robbed: false };
    ev.it = Interact.add({ pos: () => ({ x: s.x, y, z: s.z }), r: 3, pri: 0.6, opts: p => ev.fixed || ev.robbed || !n.alive ? [] : [
      { label: 'Help fix the wheel', fn: () => { p.anim.play('kneel', { loop: true }); setTimeout(() => { p.anim.stop('kneel'); ev.fixed = true; broke.position.set(1.1, 0.5, -0.75); broke.rotation.x = Math.PI / 2; bed.rotation.z = 0; Rep.honor(3, 'helped a stranded settler'); Inv.money(Math.round(rand(2, 4) * 100) / 100, 'from Otis'); Inv.add('coffee', 1); n.say('Bless you! There\'s coffee in it for you.', 4); Skills.gain('survive', 2); }, 2600); } },
      { label: 'Rob him', crime: true, fn: () => { ev.robbed = true; n.state = 'handsup'; n.handsT = -6; n.say('Take it, take it! Just don\'t shoot!', 3); Inv.money(Math.round(rand(3, 6) * 100) / 100, 'robbed from Otis'); Law.crime('robbery', p.pos, { victim: n }); } }] });
    this.events.push(ev); UI.toast('A wagon is stuck on the trail ahead', '');
  },
  duelist() {
    S.flags.duelDay = S.time.day; const s = Encounters.spot(16), P = Game.player, nm = pick(['"Quick" Jack Tolliver', 'Vera Slade', 'Hollis Crow']);
    const n = NPC.spawn({ key: 'duelist', name: nm, x: s.x, z: s.z, lawful: false, wild: true, gun: 'revolver', hp: 100, maxHp: 100, brave: 1, state: 'scripted', tags: ['generic'], look: { skin: '#d8a57c', shirt: '#2b2b2b', coat: '#4a2a2a', hair: '#1b1b1b', hatColor: '#111' } });
    n.script = (dt, me) => { me.sp = 0; me.face(Game.player.pos); if (me.distP < 14 && !ev.called) { ev.called = true; me.say('They say you\'re quick, Wren. I\'d like to find out.', 4); } };
    n.talk = () => ev.done ? null : { start: { who: nm, text: 'Main street rules. We stand ten paces apart and draw on the word. Unless you\'re yellow.', choices: [
      { text: 'Let\'s settle it. (Duel)', cond: () => S.weapons.revolver, do: () => Duel.start(n), next: null },
      { text: 'Not today.', do: () => { ev.done = true; n.say('Figured. Yellow as mustard.', 3); n.script = (dt, me) => me.moveTo(me.pos.x + 30, me.pos.z, 1.6, dt); }, next: null }] } };
    const ev = { kind: 'duel', n }; this.events.push(ev); UI.toast(`${nm} blocks the trail`, '');
  },
  eventsTick() {
    const P = Game.player;
    for (const ev of this.events.slice()) { const far = !ev.n || !NPC.all.includes(ev.n) || ev.n.distP > 130;
      if (far) { if (ev.g) Game.scene.remove(ev.g); if (ev.c) ev.c.on = false; if (ev.it) Interact.remove(ev.it); if (ev.n && NPC.all.includes(ev.n) && !Duel.on) NPC.despawn(ev.n); this.events = this.events.filter(e => e !== ev); } }
  },
  update(dt) {
    this.alarmT -= dt; this.lawT -= dt; Skills.update(dt); this.huntTick(dt); this.eventsTick(); Duel.update(dt); if (this.poster) this.posterDraw();
    const c = this.lawCaller, P = Game.player; // the lawman who came to check gives one warning when he finds you
    if (c && c.alive && c.state !== 'pursue' && c.state !== 'combat' && c.distP < 8 && c.seesPlayer && Game.time - this.warnedAt > 90) { this.warnedAt = Game.time; this.lawCaller = null; c.face(P.pos); c.say('Keep that iron holstered in my town. Next shot costs you.', 4); UI.toast('Warned by the law: no more shooting in town', 'bad'); }
  },
  clear() { for (const ev of this.events) { if (ev.g) Game.scene.remove(ev.g); if (ev.c) ev.c.on = false; if (ev.it) Interact.remove(ev.it); } this.events = []; Duel.stop(); this.alarmT = 0; this.lawCaller = null; },
};

/* A frontier duel: ten paces, a long wait, then DRAW! Shoot first (attack) to win; hold aim as you draw to shoot the gun
   out of their hand and spare them. Draw early and they shoot you for cheating; too slow and they beat you to it. */
const Duel = {
  on: false,
  start(n) {
    const P = Game.player; if (P.state === 'ride') return; this.on = true; this.n = n; this.phase = 'walk'; this.t = 0; n.script = (dt, me) => { me.sp = 0; me.face(Game.player.pos); };
    const a = Math.atan2(n.pos.x - P.pos.x, n.pos.z - P.pos.z); n.pos.x = P.pos.x + Math.sin(a) * 10; n.pos.z = P.pos.z + Math.cos(a) * 10; n.pos.y = Col.ground(n.pos.x, n.pos.z, 99);
    P.yaw = a; Game.cam.yaw = a; Game.cam.pitch = 0.08; P.setWeapon('revolver'); P.vel.set(0, 0, 0); Input.aimToggle = false; this.wait = rand(2, 4.5);
    this.react = rand(0.42, 0.7) + (Skills.lv('gun') - 1) * 0.05; this.show('Steady…'); Sfx.tone(180, 0.6, 0.05, 'triangle');
  },
  show(t, cls = '') { const e = $('duel'); if (!e) return; e.hidden = !t; e.textContent = t || ''; e.className = 'hud ' + cls; },
  fire() { return Input.mouse.lp || Input.hit('f') || Input.tb('attack'); },
  update(dt) {
    if (!this.on) return; const P = Game.player, n = this.n; if (!n || !n.alive || P.state === 'down') return this.stop(); this.t += dt; P.vel.set(0, 0, 0);
    if (this.phase === 'walk') { if (this.fire()) return this.end('early'); if (this.t > this.wait) { this.phase = 'draw'; this.t = 0; this.show('DRAW!', 'draw'); Sfx.tone(900, 0.15, 0.12, 'square'); Haptic.buzz(50); } return; }
    if (this.phase === 'draw') { if (this.fire()) return this.end(Input.mouse.r || Input.aimToggle || Input.btn.aim ? 'spare' : 'win'); if (this.t > this.react) return this.end('slow'); }
  },
  end(how) {
    const P = Game.player, n = this.n, muzzle = new THREE.Vector3(); this.phase = 'done'; P.anim.play('recoil'); P.rig.R.hand.getWorldPosition(muzzle);
    const chest = new THREE.Vector3(n.pos.x, n.pos.y + 1.2, n.pos.z), me = new THREE.Vector3(P.pos.x, P.pos.y + 1.2, P.pos.z);
    if (how === 'win' || how === 'spare') { Sfx.shot(false); FX.tracer(muzzle, chest, 'none'); S.stats.duels = (S.stats.duels || 0) + 1; Skills.gain('gun', 6);
      if (how === 'spare') { Brawl.disarm(n); n.hostileToPlayer = false; n.state = 'scripted'; n.say('You could\'ve killed me. I won\'t forget it.', 4); Rep.honor(3, 'spared a duelist'); n.script = (dt, me2) => me2.moveTo(me2.pos.x + 30, me2.pos.z, 2.4, dt); this.show('You shot the gun from their hand', 'won'); }
      else { n.takeHit({ dmg: 999, from: P, gun: 'revolver', zone: 'body' }); Inv.money(Math.round(rand(6, 14) * 100) / 100, 'from the duelist\'s purse'); this.show('You were faster', 'won'); journal(`Outdrew ${n.name} on the trail.`); } }
    else { Sfx.shot(false); FX.tracer(new THREE.Vector3(n.pos.x, n.pos.y + 1.3, n.pos.z), me, 'none'); P.hurt(how === 'early' ? 45 : 55, n, 'gun'); n.say(how === 'early' ? 'Cheat! You drew early!' : 'Too slow, Wren.', 3); if (how === 'early') Rep.honor(-3, 'drew early in a duel');
      this.show(how === 'early' ? 'You drew too early' : 'Too slow', 'lost'); n.script = (dt, me2) => me2.moveTo(me2.pos.x + 30, me2.pos.z, 1.8, dt); }
    const ev = Town.events.find(e => e.n === n); if (ev) ev.done = true; setTimeout(() => this.show(null), 2200); this.on = false; this.last = how;
  },
  stop() { this.on = false; this.show(null); },
};
