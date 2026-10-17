/* ===== Side content: the rotating bounty board, stranger missions, road encounters, travelers and landmarks =====
   RDR2-style open-world filler that keeps the valley worth riding through after (and between) story chapters. */
const HIDEOUTS = [
  { id: 'drycreek', name: 'Dry Creek', x: -185, z: 15 }, { id: 'antelope', name: 'Antelope Flats', x: 170, z: 75 },
  { id: 'sawtooth', name: 'Sawtooth Draw', x: -60, z: 125 }, { id: 'coulee', name: 'Hangman\'s Coulee', x: -150, z: 140 }, { id: 'bigbend', name: 'Big Bend', x: 100, z: 170 },
];
const OUTLAWS = [
  { id: 'ned', name: '"Two-Bit" Ned Harrow', crime: 'Stagecoach robbery', alive: 35, dead: 15, kind: 'gang', gang: 2, look: { skin: '#e2a57c', shirt: '#6b4a2f', hair: '#3b2a1e', hatColor: '#1b1b1b', mustache: '#3b2a1e' } },
  { id: 'lottie', name: 'Lottie Blaine', crime: 'Cattle rustling', alive: 30, dead: 12, kind: 'runner', gang: 0, look: { skin: '#f0c4a0', shirt: '#8a3b3b', hair: '#c97b3a', longHair: true, hatColor: '#6b4a2f' } },
  { id: 'kilgore', name: 'Bart Kilgore', crime: 'Murder', alive: 60, dead: 40, kind: 'gang', gang: 3, hp: 130, gun: 'rifle', look: { skin: '#d9a07a', shirt: '#2b2b2b', coat: '#4a3b30', hair: '#1b1b1b', beard: '#1b1b1b', hatColor: '#2b2b2b', stout: 1.15 } },
  { id: 'jem', name: 'Jem Whitlock', crime: 'Horse theft', alive: 25, dead: 10, kind: 'sleeper', gang: 1, look: { skin: '#e8b48c', shirt: '#9a7b4f', hair: '#a0522d', hatColor: '#8b7d6b' } },
  { id: 'mercy', name: 'Mercy Vale', crime: 'Counterfeiting', alive: 40, dead: 15, kind: 'runner', gang: 1, look: { skin: '#c98a62', shirt: '#4a6a4a', hair: '#1b1b1b', longHair: true, hatColor: '#3b2a1e' } },
  { id: 'ox', name: 'Oxley "Ox" Brandt', crime: 'Assaulting a deputy', alive: 45, dead: 20, kind: 'brawler', gang: 0, hp: 200, look: { skin: '#d9a07a', shirt: '#7a5232', hair: '#5a3a20', beard: '#5a3a20', hat: false, stout: 1.35 } },
];
const GRAVEYARD = { x: 12, z: 45 }, WRECK = { x: -109, z: -38 }, PINE_HOLLOW = { x: 20, z: 60 }, QUARRY = { x: -30, z: -60 }, HANK_X = { x: 141, z: 131 };

const SIDE = {
  bs() { return S.bounties || (S.bounties = { posted: [], next: 0, done: 0, active: null, recent: [] }); },
  outlaw(id) { return OUTLAWS.find(o => o.id === id); },
  hideout(id) { return HIDEOUTS.find(h => h.id === id); },

  /* ---------- bounty board ---------- */
  refresh() { // lazily keep two posters up once the first chapter is done; a new one goes up each day
    const b = this.bs(); if (Missions.st('m1').status !== 'done') return;
    while (b.posted.length < 2 && S.time.day >= b.next) {
      const used = b.posted.map(p => p.o).concat(b.recent, b.active ? [b.active.o] : []); const pool = OUTLAWS.filter(o => !used.includes(o.id)); if (!pool.length) { b.recent = []; break; }
      const o = pick(pool), hs = HIDEOUTS.filter(h => !b.posted.some(p => p.h === h.id)); b.posted.push({ o: o.id, h: pick(hs).id }); if (b.posted.length >= 2) b.next = S.time.day + 1;
    }
  },
  boardOpts(p) {
    this.refresh(); const b = this.bs(), o = [];
    if (b.active) { const t = NPC.byKey('bgen_' + b.active.o), a = this.outlaw(b.active.o); const alive = p.carry && p.carry.npc && p.carry.npc === t; if (alive || (b.active.proof && (!t || !t.alive))) o.push({ label: `Turn in ${a.name}${alive ? '' : ' (proof of death)'}`, fn: () => this.turnIn(alive) }); }
    if (!Missions.active && !b.active) for (const q of b.posted) { const a = this.outlaw(q.o); o.push({ label: `Read poster: ${a.name}`, fn: () => Dialog.start(null, this.poster(q)) }); }
    return o;
  },
  poster(q) {
    const a = this.outlaw(q.o), h = this.hideout(q.h);
    return { start: { who: 'Wanted poster', text: `WANTED: ${a.name.toUpperCase()}. ${a.crime}. $${a.alive} ALIVE, $${a.dead} DEAD. Last seen near ${h.name}.${a.kind === 'runner' ? ' Known to run.' : a.kind === 'brawler' ? ' Dangerous with his fists.' : a.gang ? ` Rides with ${a.gang} others.` : ''}`, choices: [
      { text: 'Take the bounty', cond: () => !this.bs().active && !Missions.active, why: 'Finish what you\'re doing first', do: () => this.accept(q), next: null }, { text: 'Leave it', next: null }] } };
  },
  accept(q) { const b = this.bs(); b.posted = b.posted.filter(x => x !== q); b.active = { o: q.o, h: q.h }; const m = Missions.st('bounty_board'); m.status = 'available'; Missions.start('bounty_board'); },
  spawnBounty() {
    const b = this.bs(), q = b.active; if (!q) return; for (const n of NPC.all.slice()) if (n.tags.includes('bgen')) NPC.despawn(n);
    const a = this.outlaw(q.o), h = this.hideout(q.h); q.proof = false; q.fled = false;
    const t = NPC.spawn({ key: 'bgen_' + a.id, name: a.name, x: h.x, z: h.z, lawful: false, group: 'bgen', state: 'patrol', gun: a.kind === 'brawler' ? null : (a.gun || 'revolver'), hp: a.hp || 90, maxHp: a.hp || 90, accuracy: 0.4, wild: true, tags: ['bounty', 'bgen', 'generic'], look: a.look, route: [{ x: h.x, z: h.z, wait: 14 }, { x: h.x + 5, z: h.z + 3, wait: 6 }], fists: a.kind === 'brawler' });
    t.loot = () => { this.bs().active && (this.bs().active.proof = true); UI.toast(`Took ${a.name}'s gun belt as proof`); };
    if (a.kind === 'sleeper') { t.state = 'scripted'; t.sleepy = true; t.sense = 0.25; t.script = (dt, me) => { me.sp = 0; me.anim.expr = 'calm'; }; }
    if (a.kind === 'runner') { t.onPatrol = (dt, me) => { if (me.seesPlayer && me.distP < 22 && !me._ran) this.run(me); }; for (const hh of Riders.horses.filter(x => x.bountyHorse)) hh.remove(); const hr = new NPCHorse(h.x + 3, h.z + 2, 0); hr.bountyHorse = true; hr.tethered = true; t.horse = hr; } // runners keep a horse saddled
    for (let i = 0; i < a.gang; i++) { const ang = i / Math.max(1, a.gang) * TAU; NPC.spawn({ key: `bgen_g${i}`, name: 'Outlaw', x: h.x + Math.cos(ang) * 6, z: h.z + Math.sin(ang) * 6, lawful: false, group: 'bgen', state: 'patrol', gun: 'revolver', hp: 80, maxHp: 80, fleeHp: 20, accuracy: 0.38, wild: true, tags: ['bgen', 'generic'], look: { skin: '#e8b48c', shirt: pick(['#5a3a2a', '#3b3b5b', '#4a6a4a']), hair: '#3b2a1e', hatColor: '#2b2b2b' }, route: [{ x: h.x + Math.cos(ang) * 6, z: h.z + Math.sin(ang) * 6, wait: 9 }, { x: h.x + Math.cos(ang + 1) * 10, z: h.z + Math.sin(ang + 1) * 10, wait: 6 }] }); }
    this._fires = this._fires || {}; if (!this._fires[h.id]) { this._fires[h.id] = 1; World.campfire(h.x + 2, h.z - 2); }
  },
  run(me) { // runners bolt the moment they see you, then turn and fight if you catch up
    me._ran = 1; me.say(pick(['Not today, lawdog!', 'You ain\'t taking me in!']), 3);
    if (me.horse && me.horse.alive && !me.horse.rider && Riders.horses.includes(me.horse) && me.horse.pos.distanceTo(me.pos) < 12) { Riders.mount(me, me.horse); me.rideMode = 'flee'; me.onEscape = () => { const b = this.bs(); if (b.active) b.active.fled = true; }; return; } // on horseback: shoot the horse to throw them
    me.state = 'scripted'; let t = 0;
    me.script = (dt, x) => { t += dt; const P = Game.player, a = Math.atan2(x.pos.x - P.pos.x, x.pos.z - P.pos.z); x.moveTo(x.pos.x + Math.sin(a) * 6, x.pos.z + Math.cos(a) * 6, 5.4, dt); if (x.distP < 3.5 || t > 22) { x.script = null; x.fightPlayer(!x.gun); } if (x.distP > 140) { const b = this.bs(); if (b.active) b.active.fled = true; } };
  },
  turnIn(alive) {
    const b = this.bs(), q = b.active, a = this.outlaw(q.o), P = Game.player;
    if (alive && P.carry) { const n = P.carry.npc; P.carry = null; if (n) NPC.despawn(n); }
    Inv.money(alive ? a.alive : a.dead, 'bounty reward'); Rep.honor(alive ? 3 : 1); Rep.faction('town', 2); q.turnedIn = alive ? 'alive' : 'dead'; journal(`Turned in ${a.name} ${alive ? 'alive' : 'dead'} for $${alive ? a.alive : a.dead}.`);
  },
  bountyComplete(ctx) {
    const b = this.bs(), q = b.active, a = this.outlaw(q.o); ctx.m.outcome = `Brought ${a.name} in ${q.turnedIn} ($${q.turnedIn === 'alive' ? a.alive : a.dead})`;
    b.done++; b.recent = b.recent.concat(q.o).slice(-3); b.active = null; for (const hh of Riders.horses.filter(x => x.bountyHorse)) hh.remove(); ctx.m.status = 'locked'; for (const n of NPC.all.slice()) if (n.tags.includes('bgen')) NPC.despawn(n); // repeatable: the next poster reuses this mission
  },

  /* ---------- road encounters ---------- */
  roadSpot(dist) { // a point on the nearest trail about `dist` metres ahead of the player
    const P = Game.player, f = fwd(P.yaw); let best = null, bd = 1e9;
    for (const tr of TRAILS) for (let i = 0; i < tr.length - 1; i++) { const [ax, az] = tr[i], [bx, bz] = tr[i + 1], L = Math.hypot(bx - ax, bz - az); for (let s = 0; s <= L; s += 4) { const x = ax + (bx - ax) * s / L, z = az + (bz - az) * s / L, d = Math.hypot(x - P.pos.x, z - P.pos.z); if (d < dist * 0.7 || d > dist * 1.5) continue; const ahead = ((x - P.pos.x) * f.x + (z - P.pos.z) * f.z) / d; const sc = Math.abs(d - dist) - ahead * 20; if (sc < bd && Math.hypot(x + 40, z - 20) > 50) { bd = sc; best = { x, z }; } } }
    return best;
  },
  tempNPC(o) { const n = NPC.spawn(Object.assign({ wild: true, tags: ['generic', 'encounter'] }, o)); const sweep = setInterval(() => { if (!NPC.all.includes(n)) return clearInterval(sweep); if (n.distP > 60) { NPC.despawn(n); clearInterval(sweep); } }, 60000); return n; }, // once you're well away, they go on their way
  holdup() { // two bandits robbing a traveler: step in, cut yourself in, or ride on
    const s = this.roadSpot(40); if (!s) return; S.flags.holdupDay = S.time.day; let resolved = false, cut = false;
    const v = this.tempNPC({ key: 'enc_victim', name: 'Traveler', x: s.x, z: s.z, brave: 0.2, state: 'scripted', look: { skin: '#f0c4a0', shirt: '#4f7ca8', hair: '#8b5a2b', hatColor: '#d9c58f' } });
    v.state = 'handsup'; v.handsT = -1e9; v.anim.expr = 'alarm'; // hands up until someone settles it
    const robbers = [0, 1].map(i => this.tempNPC({ key: 'enc_bandit' + i, name: 'Road agent', x: s.x + (i ? 3 : -3), z: s.z + 2.5, lawful: false, group: 'enc_bandits', state: 'scripted', gun: 'revolver', hp: 80, maxHp: 80, fleeHp: 20, accuracy: 0.38, look: { skin: '#e8b48c', shirt: '#5a3a2a', hair: '#3b2a1e', hatColor: '#1b1b1b', scarf: '#8a3b3b' } }));
    for (const r of robbers) { r.script = (dt, me) => { me.sp = 0; me.face(v.pos); me.anim.layers.aim = 1; if (me.gunM) me.gunM.visible = true; if (me.distP < 14 && !me._warned) { me._warned = 1; me.face(Game.player.pos); me.say('Keep riding, friend. This ain\'t your business.', 4); } };
      r.talk = () => resolved ? null : { start: { text: 'Keep riding. Or are you looking for a cut?', choices: [
        { text: '"Cut me in."', do: () => { resolved = true; cut = true; Inv.money(6, 'your cut'); Rep.honor(-8, 'joined a robbery'); v.say('Thieves! All of you!', 3); v.state = 'flee'; v.fleeFrom = Game.player.pos.clone(); v.fleeT = 10; v.script = null; for (const x of robbers) { x.script = (dt, me) => me.moveTo(s.x + 60, s.z + 60, 3, dt); } }, next: null },
        { text: '"Let him go." (Draw)', do: () => { resolved = true; for (const x of robbers) x.fightPlayer(); }, next: null }, { text: 'Ride on', next: null }] } }; }
    const watch = setInterval(() => { // the robbery plays out whether or not you stay
      if (!NPC.all.includes(v)) return clearInterval(watch);
      if (robbers.every(r => !r.alive || r.downed || r.fled)) { clearInterval(watch); if (v.alive && !v.downed && !cut && (!resolved || robbers.some(r => r.hostileToPlayer))) { resolved = true; v.state = 'scripted'; v.say('Bless you! Here, it\'s not much.', 4); Inv.money(5, 'from the traveler'); Rep.honor(5, 'stopped a robbery'); journal('Stopped two road agents robbing a traveler.'); v.script = (dt, me) => me.moveTo(-34, 24, 1.6, dt, 2); } else resolved = true; /* no reward from the dead or after taking a cut */ return; }
      if (!resolved && Game.player.pos.distanceTo(v.pos) > 90) { clearInterval(watch); resolved = true; for (const x of [v, ...robbers]) NPC.despawn(x); }
    }, 1000);
    UI.toast('Shouting on the road ahead', '');
  },
  snakebite() {
    const s = this.roadSpot(32); if (!s) return; S.flags.snakeDay = S.time.day; let done = false;
    const m = this.tempNPC({ key: 'enc_snake', name: 'Bitten traveler', x: s.x + 2, z: s.z, brave: 0.3, state: 'tied', look: { skin: '#e8b48c', shirt: '#9a7b4f', hair: '#6b4a2f', hatColor: '#8b6a47', beard: '#6b4a2f' } });
    m.say('Snake got me! Please, somebody!', 5); m.talk = null;
    m.opts = p => done ? [] : [{ label: 'Suck out the venom', fn: () => { done = true; p.anim.play('kneel', { loop: true }); later(() => { p.anim.stop('kneel'); this.saved(m, 4); }, 1800); } }].concat(Inv.count('tonic') ? [{ label: 'Give him a sage tonic', fn: () => { done = true; Inv.take('tonic'); this.saved(m, 7); } }] : []);
    UI.toast('Someone is crying out by the trail', '');
  },
  saved(m, cash) { m.state = 'scripted'; m.say('I thought I was done for. Thank you, ma\'am.', 4); Inv.money(cash, 'from the traveler'); Rep.honor(4, 'helped a snakebit stranger'); journal('Sucked the venom from a snakebit stranger\'s leg on the trail.'); m.script = (dt, me) => me.moveTo(-40, 20, 1.4, dt); },
  trap() { // RDR2's classic: a cry for help that's really an ambush
    const s = this.roadSpot(34); if (!s) return; S.flags.trapDay = S.time.day; let sprung = false;
    const bait = this.tempNPC({ key: 'enc_bait', name: 'Woman', x: s.x, z: s.z, brave: 0.5, state: 'scripted', look: { skin: '#f0c4a0', shirt: '#c97b5a', hair: '#3b2618', longHair: true, hat: false } });
    bait.say('Please! My husband\'s hurt, over here!', 5);
    bait.script = (dt, me) => { me.sp = 0; if (!sprung && me.distP < 7) { sprung = true; me.say('Now, boys!', 2); const P = Game.player; [-1, 1].forEach((k, i) => { const a = P.yaw + Math.PI + k * 0.7, b = this.tempNPC({ key: 'enc_amb' + i, name: 'Bushwhacker', x: P.pos.x + Math.sin(a) * 13, z: P.pos.z + Math.cos(a) * 13, lawful: false, group: 'enc_amb', gun: 'revolver', hp: 80, maxHp: 80, fleeHp: 20, accuracy: 0.36, look: { skin: '#e2a57c', shirt: '#4a3b30', hair: '#1b1b1b', hatColor: '#2b2b2b' } }); b.fightPlayer(); }); me.script = (dt2, x) => { const a = Math.atan2(x.pos.x - P.pos.x, x.pos.z - P.pos.z); x.moveTo(x.pos.x + Math.sin(a) * 6, x.pos.z + Math.cos(a) * 6, 5, dt2); }; journal('A woman on the trail cried for help. It was an ambush.'); } };
    UI.toast('Someone is calling for help on the trail', '');
  },
  encounter(r) { // called by Encounters.update off-town, near a trail
    const d = S.time.day, day = S.time.hour > 6 && S.time.hour < 20;
    if (r < 0.35 && S.flags.holdupDay !== d && day) return this.holdup(), true;
    if (r < 0.55 && S.flags.snakeDay !== d && day) return this.snakebite(), true;
    if (r < 0.7 && S.flags.trapDay !== d && Missions.st('m1').status === 'done') return this.trap(), true;
    return false;
  },

  /* ---------- travelers walking the trails ---------- */
  travT: 6,
  travelers(dt) {
    this.travT -= dt; if (this.travT > 0) return; this.travT = 8; const P = Game.player;
    for (const n of NPC.all.slice()) if (n.tags.includes('wayfarer') && (n.distP > 150 || n.arrived)) NPC.despawn(n);
    if (Missions.active || NPC.all.filter(n => n.tags.includes('wayfarer')).length >= 2 || Math.hypot(P.pos.x + 40, P.pos.z - 20) < 60 || Sky.night()) return;
    const cands = []; TRAILS.forEach(t => t.forEach(([x, z], i) => { const d = Math.hypot(x - P.pos.x, z - P.pos.z); if (d > 45 && d < 120 && Math.hypot(x + 40, z - 20) > 45) cands.push([t, i]); })); if (!cands.length) return; const [tr, bi] = pick(cands); // any trail point out of sight but nearby
    const dir = bi === 0 ? 1 : bi === tr.length - 1 ? -1 : (Math.random() < 0.5 ? 1 : -1); const kinds = [
      { name: 'Prospector', look: { skin: '#d9a07a', shirt: '#8a6a4a', hair: '#bbb', beard: '#ccc', hatColor: '#8b7d6b', stout: 1.1 }, lines: ['Gold up in them hills, I swear it.', 'Morning.'] },
      { name: 'Farmhand', look: { skin: '#e8b48c', shirt: '#9dbf8a', pants: '#5a4a3a', hair: '#c9a227', hatColor: '#d9c58f' }, lines: ['Hot one today.', 'Ma\'am.'] },
      { name: 'Drifter', look: { skin: '#c98a62', shirt: '#5a3a2a', coat: '#3b2a1e', hair: '#1b1b1b', hatColor: '#2b2b2b' }, lines: ['...', 'Keep moving.'] },
      { name: 'Preacher', look: { skin: '#f0c4a0', shirt: '#2b2b2b', hair: '#ddd', hatColor: '#1b1b1b' }, lines: ['Bless you, child.', 'The Lord keeps all roads.'] },
    ]; const k = pick(kinds), [sx, sz] = tr[bi];
    const n = NPC.spawn({ key: 'trav_' + Math.floor(Math.random() * 1e6), name: k.name, x: sx, z: sz, wild: true, brave: 0.4, state: 'scripted', tags: ['generic', 'wayfarer'], look: k.look, greetLine: () => pick(k.lines) });
    n.wi = bi + dir; n.script = (dt2, me) => { const p = tr[me.wi]; if (!p) { me.arrived = true; me.sp = 0; return; } if (me.moveTo(p[0], p[1], 1.35, dt2, 2)) me.wi += dir; };
  },

  /* ---------- landmarks ---------- */
  build() {
    const sc = Game.scene, G = (x, z) => { const g = new THREE.Group(); g.position.set(x, Terrain.height(x, z), z); sc.add(g); return g; };
    // telegraph line along the main road from town to the mill
    const main = TRAILS[0]; const tops = []; let acc = 0;
    for (let i = 0; i < main.length - 1; i++) { const [ax, az] = main[i], [bx, bz] = main[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L; for (let s = (22 - acc) % 22; s < L; s += 22) { const x = ax + (bx - ax) * s / L + nx * 5, z = az + (bz - az) * s / L + nz * 5; if (Math.abs(x - riverX(z)) < 13 || Math.hypot(x + 40, z - 20) < 30) continue; const g = G(x, z); g.add(M(GEO.cyl, '#6b4a2f', 0.12, 5.2, 0.12, 0, 2.6, 0)); const arm = M(GEO.box, '#6b4a2f', 1.1, 0.1, 0.1, 0, 4.9, 0); arm.rotation.y = Math.atan2(bx - ax, bz - az) + Math.PI / 2; g.add(arm); tops.push(new THREE.Vector3(x, g.position.y + 4.95, z)); Col.circle(x, z, 0.15, g.position.y - 1, g.position.y + 5, { block: true }); } acc = (acc + L) % 22; }
    if (tops.length > 1) { const pts = []; for (let i = 0; i < tops.length - 1; i++) { if (tops[i].distanceTo(tops[i + 1]) > 40) continue; const a = tops[i], b = tops[i + 1]; for (let k = 0; k < 6; k++) { const u0 = k / 6, u1 = (k + 1) / 6, sag = u => Math.sin(u * Math.PI) * 0.6; pts.push(new THREE.Vector3().lerpVectors(a, b, u0).setY(a.y + (b.y - a.y) * u0 - sag(u0)), new THREE.Vector3().lerpVectors(a, b, u1).setY(a.y + (b.y - a.y) * u1 - sag(u1))); } } sc.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x2b2b2b }))); }
    // graveyard on the rise east of town, with the Calloways' stones
    { const g = G(GRAVEYARD.x, GRAVEYARD.z); const yy = g.position.y; World.fence(GRAVEYARD.x - 7, GRAVEYARD.z - 5, GRAVEYARD.x + 7, GRAVEYARD.z - 5); World.fence(GRAVEYARD.x - 7, GRAVEYARD.z + 5, GRAVEYARD.x + 7, GRAVEYARD.z + 5); World.fence(GRAVEYARD.x + 7, GRAVEYARD.z - 5, GRAVEYARD.x + 7, GRAVEYARD.z + 5);
      for (let i = 0; i < 9; i++) { const lx = -5 + (i % 5) * 2.4, lz = -2.5 + Math.floor(i / 5) * 4; const cross = i % 3 === 0; if (cross) { g.add(M(GEO.box, '#8b6a47', 0.1, 1.1, 0.08, lx, 0.55, lz)); g.add(M(GEO.box, '#8b6a47', 0.55, 0.09, 0.08, lx, 0.8, lz)); } else { const st = M(GEO.box, '#9a958c', 0.6, 0.8, 0.14, lx, 0.4, lz); st.rotation.z = (i % 2 ? 0.06 : -0.08); g.add(st); } g.add(M(GEO.box, '#6e8a46', 0.6, 0.04, 1.4, lx, 0.02, lz + 0.8)); }
      const cal = M(GEO.box, '#b0aba0', 1.4, 0.9, 0.16, 4.8, 0.45, 2); g.add(cal); clue({ id: 'calloway_grave', label: 'Calloway headstone', x: GRAVEYARD.x + 4.8, z: GRAVEYARD.z + 2.8, y: yy, note: 'THOMAS & RUTH CALLOWAY. "Taken by the fever, 1871. Their children are their monument." Wren hasn\'t been here since the funeral.' }); }
    // a wrecked supply wagon on the cabin road (Doc's medicine was on it)
    { const g = G(WRECK.x, WRECK.z); g.rotation.set(0, 0.9, 0.22); g.add(M(GEO.box, '#7a5232', 1.8, 0.7, 3.2, 0, 0.6, 0)); const w = M(GEO.cyl, '#4b3a2a', 0.55, 0.1, 0.55, 1.0, 0.3, 1.1); w.rotation.z = Math.PI / 2; g.add(w); const w2 = M(GEO.cyl, '#4b3a2a', 0.55, 0.1, 0.55, -1.8, 0.05, -0.4); w2.rotation.x = Math.PI / 2; g.add(w2); g.add(M(GEO.box, '#8b6a47', 0.8, 0.5, 0.6, 1.5, 0.25, -1.5)); Col.box(WRECK.x - 1.6, WRECK.x + 1.6, WRECK.z - 1.6, WRECK.z + 1.6, g.position.y - 1, g.position.y + 1.2, { block: true, cover: true }); }
    // fishing dock on the river below the bridge
    { const z = 28, x0 = riverX(z) - 12, y = WORLD.waterY + 0.55, g = new THREE.Group(); g.position.set(x0, y, z); sc.add(g); g.add(M(GEO.box, '#8b6a47', 7, 0.14, 1.8, 3.5, 0, 0)); for (let i = 0; i < 4; i++) for (const s of [-0.8, 0.8]) g.add(M(GEO.cyl, '#5a3a22', 0.1, 2.2, 0.1, 1 + i * 1.9, -0.9, s)); Col.box(x0, x0 + 7, z - 0.9, z + 0.9, y - 0.4, y + 0.07, { walk: true, block: false }); }
    // farm: hay bales and a scarecrow
    if (S.locations.farm !== 'abandoned' || true) { for (const [x, z] of [[-112, 112], [-114, 113.5], [-113, 111]]) { const g = G(x, z); const b = M(GEO.cyl, '#e0c068', 0.7, 1.2, 0.7, 0, 0.7, 0); b.rotation.z = Math.PI / 2; g.add(b); Col.circle(x, z, 0.7, g.position.y - 1, g.position.y + 1.2, { block: true, cover: true }); }
      const g = G(-108, 108); g.add(M(GEO.box, '#6b4a2f', 0.1, 2.2, 0.1, 0, 1.1, 0)); g.add(M(GEO.box, '#6b4a2f', 1.5, 0.08, 0.08, 0, 1.6, 0)); g.add(M(GEO.box, '#7a3b3b', 0.6, 0.7, 0.3, 0, 1.45, 0)); g.add(M(GEO.sphLo, '#e0c068', 0.25, 0.25, 0.25, 0, 2.1, 0)); g.add(M(GEO.cone, '#6b4a2f', 0.4, 0.3, 0.4, 0, 2.35, 0)); }
    // a carcass the vultures have found
    { const g = G(-140, -20); g.add(M(GEO.box, '#b07a48', 1.3, 0.35, 0.5, 0, 0.18, 0)); for (let i = 0; i < 5; i++) g.add(M(GEO.box, '#efe6d0', 0.06, 0.3, 0.06, -0.4 + i * 0.2, 0.42, 0.18)); this.vultures = [0, 1, 2].map(i => { const v = new THREE.Group(); v.add(M(GEO.box, '#1b1b1b', 0.25, 0.12, 0.45)); v.add(M(GEO.box, '#2b2b2b', 1.4, 0.03, 0.3)); sc.add(v); return { v, a: i * 2.1, r: 6 + i * 2, h: 16 + i * 3 }; }); this.vultureC = { x: -140, z: -20, y: g.position.y }; }
    // more signposts
    const sign = (x, z, yaw, t) => { const g = G(x, z); g.rotation.y = yaw; g.add(M(GEO.box, '#6b4a2f', 0.14, 2.4, 0.14, 0, 1.2, 0)); const b = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.4), labelTex(t, '#8b6a47', '#f4ead3', 360, 64)); b.position.set(0, 2.05, 0.09); g.add(b); const bb = b.clone(); bb.rotation.y = Math.PI; bb.position.z = -0.09; g.add(bb); Col.circle(x, z, 0.15, g.position.y - 1, g.position.y + 2.4, { block: true }); };
    sign(T_TRAILHEAD.x + 4, T_TRAILHEAD.z - 3, -0.5, 'Tamarack Pass ↑'); sign(riverX(-120) - 15, -114, 0.3, 'Shallow Ford'); sign(GRAVEYARD.x - 8, GRAVEYARD.z - 6, 0, 'Juniper Gap Cemetery');
  },
  update(dt) {
    if (this.vultures) for (const u of this.vultures) { u.a += dt * 0.35; const c = this.vultureC; u.v.position.set(c.x + Math.cos(u.a) * u.r, c.y + u.h + Math.sin(u.a * 2) * 0.5, c.z + Math.sin(u.a) * u.r); u.v.rotation.set(0, -u.a, 0.35); }
    if (Game.running) this.travelers(dt);
  },
};

/* ---------- missions ---------- */
Missions.def({ id: 'bounty_board', type: 'bounty', title: 'Bounty', giver: 'board', summary: 'A wanted poster from the sheriff\'s office.', prereq: () => false,
  stages: [
    { id: 'find', text: 'Track down the outlaw from the poster.', enter: ctx => { if (ctx.resumed && !ctx.rew) { ctx.rew = 1; } SIDE.spawnBounty(); },
      objectives: [O.check('find', () => { const q = SIDE.bs().active; return q ? `Find ${SIDE.outlaw(q.o).name} near ${SIDE.hideout(q.h).name}` : 'Find the outlaw'; }, () => { const q = SIDE.bs().active; if (!q) return false; const h = SIDE.hideout(q.h); return CH5.dist(Game.player.pos, h) < 28; }, () => { const q = SIDE.bs().active; if (!q) return null; const h = SIDE.hideout(q.h); return { x: h.x, z: h.z, y: Terrain.height(h.x, h.z) + 4 }; })] },
    { id: 'take', text: 'Bring them in. Knock them out and hogtie them for the full reward.', enter: ctx => { if (ctx.resumed && SIDE.bs().active && !NPC.byKey('bgen_' + SIDE.bs().active.o)) SIDE.spawnBounty(); // loaded mid-hunt: put the outlaw back
 const q = SIDE.bs().active; if (q && SIDE.outlaw(q.o).kind === 'brawler') STORY.hint('Ox only fights with his fists. Beat him down with yours, then hogtie him.'); },
      objectives: [O.check('sub', () => `Subdue ${SIDE.outlaw(SIDE.bs().active.o).name}`, () => { const t = NPC.byKey('bgen_' + SIDE.bs().active.o); return !t || !t.alive || t.hogtied; }, () => { const t = NPC.byKey('bgen_' + SIDE.bs().active.o); return t && t.alive ? { x: t.pos.x, z: t.pos.z, y: t.pos.y + 2.4, enemy: true } : null; })],
      fail: [{ check: () => SIDE.bs().active && SIDE.bs().active.fled, why: 'The outlaw got away.' }] },
    { id: 'deliver', text: 'Bring them (or proof) to the sheriff\'s office.', enter: ctx => { const q = SIDE.bs().active; if (ctx.resumed && q && !NPC.byKey('bgen_' + q.o)) q.proof = true; }, // loaded after the body was gone: the deed counts
      objectives: [O.check('turn', () => { const t = NPC.byKey('bgen_' + SIDE.bs().active.o); return t && t.alive ? 'Carry them into the sheriff\'s office (your horse can haul them most of the way)' : 'Search the body for proof, then go to the sheriff\'s office'; }, () => !!SIDE.bs().active.turnedIn, () => ({ x: -25.5, z: 8.6, y: 5 }))] },
  ],
  complete: ctx => SIDE.bountyComplete(ctx),
  cleanup: () => { const b = SIDE.bs(); if (b.active) { b.posted.push({ o: b.active.o, h: b.active.h }); b.active = null; } for (const n of NPC.all.slice()) if (n.tags.includes('bgen')) NPC.despawn(n); Missions.st('bounty_board').status = 'locked'; },
  onFail: () => { const b = SIDE.bs(); if (b.active) { b.recent.push(b.active.o); b.active = null; } for (const n of NPC.all.slice()) if (n.tags.includes('bgen')) NPC.despawn(n); Missions.st('bounty_board').status = 'locked'; },
  failOutcome: () => 'The outlaw got away.',
});

// Hank's Strike: a prospector's map, a shovel, and claim jumpers
Missions.def({ id: 'stranger_hank', type: 'stranger', title: 'Hank\'s Strike', giver: 'hank', summary: 'Hank Dorsey swears his map marks gold near Lookout Ridge. He\'s too old to dig.',
  prereq: () => Missions.st('m1').status === 'done', blocked: () => S.chars.hank === 'dead' ? 'Hank Dorsey is dead.' : null,
  start: () => { const n = NPC.byKey('hank'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; },
  stages: [
    { id: 'shovel', text: 'You\'ll need a shovel. Mae sells them.', enter: () => { if (!Inv.count('hank_map')) Inv.add('hank_map'); }, objectives: [O.item('shovel', 'Get a shovel', 'shovel', 1, () => { const n = NPC.byKey('mae'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; })] },
    { id: 'dig', text: 'Dig at the X on Hank\'s map, below Lookout Ridge.', enter: ctx => { if (!SIDE._digIt) { SIDE._digIt = Interact.add({ pos: () => ({ x: HANK_X.x, y: Terrain.height(HANK_X.x, HANK_X.z), z: HANK_X.z }), r: 2.2, pri: 0.8, opts: p => Missions.active === 'stranger_hank' && Missions.st('stranger_hank').stage === 1 && !Missions.st('stranger_hank').c.digT ? [{ label: Inv.count('shovel') ? 'Dig here' : 'Dig here (need a shovel)', disabled: !Inv.count('shovel'), fn: () => { Missions.st('stranger_hank').c.digT = 2.5; p.anim.play('kneel', { loop: true }); } }] : [] }); } },
      update: (dt, ctx) => { const c = ctx.m.c; if (c.digT > 0) { c.digT -= dt; if (c.digT <= 0) { Game.player.anim.stop('kneel'); Inv.add('gold', 3); c.dug = 1; journal('Dug up three gold nuggets where Hank\'s map said. Somebody was watching.', 'decision'); } } },
      objectives: [O.check('dig', 'Dig at the X below Lookout Ridge', c => !!c.m.c.dug, () => ({ x: HANK_X.x, z: HANK_X.z, y: Terrain.height(HANK_X.x, HANK_X.z) + 2 }))] },
    { id: 'jumpers', text: 'Claim jumpers! Talk your way out, pay them off, or fight.', enter: ctx => {
        const P = Game.player, mk = (i) => { const a = P.yaw + Math.PI + (i ? 0.5 : -0.5), n = NPC.spawn({ key: 'jumper' + i, name: i ? 'Claim jumper' : 'Lem Tackett', x: P.pos.x + Math.sin(a) * 9, z: P.pos.z + Math.cos(a) * 9, lawful: false, group: 'jumpers', state: 'scripted', gun: 'revolver', hp: 80, maxHp: 80, fleeHp: 20, accuracy: 0.38, wild: true, tags: ['generic', 'jumper'], look: { skin: '#d9a07a', shirt: '#6b5a4a', hair: '#5a3a20', hatColor: '#3b2a1e', beard: i ? null : '#5a3a20' } }); n.script = (dt, me) => { me.sp = 0; me.face(P.pos); }; return n; };
        const lem = mk(0); mk(1); lem.say('That\'s our gold, lady. This claim\'s registered to Tackett.', 4); lem.talk = () => ctx.m.c.jdone ? null : SIDE.jumperTree(ctx); if (!Dialog.open) Dialog.start(lem, SIDE.jumperTree(ctx)); },
      on: { alarm: (d, ctx) => { if (d.group === 'jumpers') ctx.m.c.jdone = 'fight'; } },
      objectives: [O.check('deal', 'Deal with the claim jumpers', c => !!c.m.c.jdone && NPC.all.filter(n => n.tags.includes('jumper') && n.alive && !n.downed && !n.fled && n.state === 'combat').length === 0, () => { const n = NPC.byKey('jumper0'); return n && n.alive ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; })] },
    { id: 'return', text: 'Take the gold back to Hank.', objectives: [O.flag('hank', 'Talk to Hank in Juniper Gap', 'hank_paid', () => { const n = NPC.byKey('hank'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; })] },
  ],
  complete: ctx => { ctx.m.outcome = S.decisions.hank === 'shared' ? 'Split the gold with Hank. He cried a little.' : S.decisions.hank === 'kept' ? 'Told Hank the claim was empty and kept the gold.' : 'Hank\'s gold is gone, but he\'s still got his map.'; for (const n of NPC.all.slice()) if (n.tags.includes('jumper')) NPC.despawn(n); },
  cleanup: () => { for (const n of NPC.all.slice()) if (n.tags.includes('jumper')) NPC.despawn(n); },
});

// Doc's Medicine: a robbed supply wagon, tracks, and a crate to bring home
Missions.def({ id: 'stranger_doc', type: 'stranger', title: 'Doc\'s Medicine', giver: 'doc', summary: 'Doc Pell\'s supply wagon was robbed on the cabin road. The town needs that medicine.',
  prereq: () => Missions.st('m1').status === 'done', blocked: () => S.chars.doc === 'dead' ? 'Doc Pell is dead.' : null,
  start: () => { const n = NPC.byKey('doc'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; },
  stages: [
    { id: 'wreck', text: 'Find Doc\'s wagon on the cabin road.', enter: () => { if (!SIDE._docClues) { SIDE._docClues = 1; clue({ id: 'doc_wheel', label: 'smashed crate', x: WRECK.x + 1.8, z: WRECK.z + 2.2, note: 'Bandages and empty bottles in the dirt. Whoever robbed the wagon wanted the laudanum and the quinine, not the bandages.', when: () => Missions.active === 'stranger_doc' }); clue({ id: 'doc_tracks', label: 'hoof prints', x: WRECK.x - 3, z: WRECK.z + 4, note: 'Two horses heading east, toward the old quarry. One of them throws its left shoe.', when: () => Missions.active === 'stranger_doc' }); } },
      objectives: [O.clues('clues', 'Examine the wreck', ['doc_wheel', 'doc_tracks'], null)] },
    { id: 'quarry', text: 'Follow the tracks to the old quarry and get the medicine back.', enter: ctx => SIDE.docCamp(ctx),
      objectives: [O.check('crate', 'Recover the medicine crate', c => !!c.m.c.crate, () => SIDE._medCrate && !SIDE._medCrate.carried ? { x: SIDE._medCrate.mesh.position.x, z: SIDE._medCrate.mesh.position.z, y: SIDE._medCrate.mesh.position.y + 1.5 } : null),
        O.check('quiet', 'Optional: take it without a fight', c => c.m.c.crate && !c.m.c.alarm, null, { optional: true })],
      on: { alarm: (d, ctx) => { if (d.group === 'docband') ctx.m.c.alarm = 1; } } },
    { id: 'home', text: 'Bring the medicine to Doc Pell.', objectives: [O.flag('deliver', 'Carry the crate to Doc Pell (or stow it on your horse)', 'doc_delivered', () => { const n = NPC.byKey('doc'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; })] },
  ],
  complete: ctx => { S.flags.doc_free = true; Inv.money(10, 'from Doc Pell'); Rep.rel('doc', 25, 'is grateful'); Rep.honor(4); Rep.faction('town', 6); ctx.m.outcome = 'Doc Pell treats you free from now on' + (ctx.m.opt.quiet ? ' · nobody got hurt' : ''); for (const n of NPC.all.slice()) if (n.group === 'docband') NPC.despawn(n); },
  cleanup: () => { for (const n of NPC.all.slice()) if (n.group === 'docband') NPC.despawn(n); if (SIDE._medCrate) { Carry.remove(SIDE._medCrate); SIDE._medCrate = null; } },
});

// The Photographer: keep still while Percival Lumley photographs the deer, then see off the wolves
Missions.def({ id: 'stranger_photo', type: 'stranger', title: 'Still Life', giver: 'percival', summary: 'A traveling photographer at Pine Hollow wants pictures of wild deer, and someone to keep watch.',
  prereq: () => Missions.st('m1').status === 'done', start: () => { const n = NPC.byKey('percival'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : { x: PINE_HOLLOW.x, z: PINE_HOLLOW.z }; },
  stages: [
    { id: 'shoot', text: 'Keep low and quiet while Percival exposes his plates. Don\'t spook the deer.', enter: ctx => SIDE.photoStart(ctx), update: (dt, ctx) => SIDE.photoUpdate(dt, ctx),
      objectives: [O.count('plates', 'Plates exposed', 'plates', 3), O.check('unspooked', 'Optional: don\'t spook the deer once', c => c.m.c.plates >= 3 && !c.m.c.spooked, null, { optional: true })] },
    { id: 'wolves', text: 'Wolves! Protect Percival and his camera.', enter: ctx => { const P = Game.player; for (let i = 0; i < 3; i++) { const a = rand(0, TAU), w = Animal.spawn('wolf', PINE_HOLLOW.x + Math.cos(a) * 28, PINE_HOLLOW.z + Math.sin(a) * 28); w.state = 'attack'; w.tagPhoto = 1; } UI.toast('Wolves are circling the hollow!', 'bad'); },
      objectives: [O.check('wolves', 'Drive off the wolves', () => Animal.all.filter(a => a.tagPhoto && a.alive && a.state !== 'flee').length === 0)] },
  ],
  complete: ctx => { Inv.money(20, 'from Percival'); Inv.add('photo'); Rep.honor(3); ctx.m.outcome = 'Percival gave you a print of the deer' + (ctx.m.opt.unspooked ? ' · a perfect set of plates' : ''); const n = NPC.byKey('percival'); if (n) { n.say('Splendid! Simply splendid. Do come by my studio, if I ever have one.', 4); } },
  cleanup: () => { for (const a of Animal.all) if (a.tagPhoto) a.tagPhoto = 0; },
});

Object.assign(SIDE, {
  jumperTree(ctx) {
    const c = ctx.m.c, leave = () => { for (const n of NPC.all) if (n.tags.includes('jumper')) { n.state = 'scripted'; n.script = (dt, me) => me.moveTo(HANK_X.x + 60, HANK_X.z - 40, 3, dt); } };
    return { start: { text: 'Hand over that gold and walk away. Tackett\'s claim, Tackett\'s gold.', choices: [
      { text: '"Hank Dorsey filed on this hill before you were born." (Persuade)', cond: () => S.honor >= 10, why: 'Your word doesn\'t carry enough weight (honor 10+)', do: () => { c.jdone = 'talked'; leave(); }, next: 'talked' },
      { text: 'Give them one nugget', cond: () => Inv.count('gold'), do: () => { Inv.take('gold'); c.jdone = 'paid'; leave(); }, next: 'paid' },
      { text: 'Draw', do: () => { c.jdone = 'fight'; for (const n of NPC.all) if (n.tags.includes('jumper')) n.fightPlayer(); }, next: null } ] },
      talked: { text: '...Dorsey? That old coot\'s still alive? Hell. Come on, Ab. Ain\'t worth a hanging.' }, paid: { text: 'Smart lady. Pleasure doing business.' } };
  },
  docCamp(ctx) {
    for (const n of NPC.all.slice()) if (n.group === 'docband') NPC.despawn(n);
    const q = QUARRY; if (!SIDE._qfire) { SIDE._qfire = 1; World.campfire(q.x, q.z); }
    [[3, 2], [-4, -3]].forEach(([dx, dz], i) => { const n = NPC.spawn({ key: 'docband' + i, name: 'Thief', x: q.x + dx, z: q.z + dz, lawful: false, group: 'docband', state: 'patrol', gun: 'revolver', hp: 80, maxHp: 80, fleeHp: 20, accuracy: 0.38, sense: 0.8, wild: true, tags: ['generic', 'docband'], look: { skin: '#e8b48c', shirt: '#5a5a5a', hair: '#3b2a1e', hatColor: '#3b2a1e' }, route: [{ x: q.x + dx, z: q.z + dz, wait: 12 }, { x: q.x + dx * 2, z: q.z - dz, wait: 6 }] }); });
    if (!SIDE._medCrate || !Carry.list.includes(SIDE._medCrate)) { const cr = Carry.make('medcrate', q.x - 1, q.z + 5); cr.onPick = () => { ctx.m.c.crate = 1; }; SIDE._medCrate = cr; }
  },
  deliverMed(p) { const c = p.carry; p.carry = null; if (c) Carry.remove(c); SIDE._medCrate = null; S.flags.doc_delivered = true; },
  photoStart(ctx) {
    const c = ctx.m.c; c.plates = c.plates || 0; c.t = 0; for (const a of Animal.all.slice()) if (a.tagPhotoDeer) a.tagPhotoDeer = 0;
    c.deer = 0; for (let i = 0; i < 3; i++) { const d = Animal.spawn('deer', PINE_HOLLOW.x + 16 + i * 2.5, PINE_HOLLOW.z + 10 - i * 3); d.state = 'graze'; d.tagPhotoDeer = 1; d.home = { x: d.pos.x, z: d.pos.z }; }
    const n = NPC.byKey('percival'); if (n) { n.state = 'scripted'; n.script = (dt, me) => { me.sp = 0; me.face({ x: PINE_HOLLOW.x + 18, z: PINE_HOLLOW.z + 7 }); }; n.say('Not a sound now. The plates need eight seconds each.', 4); }
  },
  photoUpdate(dt, ctx) {
    const c = ctx.m.c, deer = Animal.all.filter(a => a.tagPhotoDeer && a.alive), calm = deer.length && deer.every(d => d.state !== 'flee' && Math.hypot(d.pos.x - PINE_HOLLOW.x, d.pos.z - PINE_HOLLOW.z) < 40);
    if (!calm) { if (c.t > 0) { c.spooked = 1; c.t = 0; const n = NPC.byKey('percival'); if (n) n.say('Blast! The plate\'s ruined. They\'ll settle, give them a moment.', 4); } for (const d of deer) if (d.state === 'flee' && d.fleeT < 1) { d.state = 'graze'; } if (!deer.length) { for (let i = 0; i < 3; i++) { const d = Animal.spawn('deer', PINE_HOLLOW.x + 16 + i * 2.5, PINE_HOLLOW.z + 10 - i * 3); d.state = 'graze'; d.tagPhotoDeer = 1; } } return; }
    c.t += dt; if (c.t >= 8) { c.t = 0; c.plates = (c.plates || 0) + 1; Sfx.tone(1800, 0.05, 0.08, 'square'); UI.toast(`Plate ${c.plates} of 3 exposed`, 'good'); }
  },
  percival() { // a traveling photographer camps at Pine Hollow until his job is done
    if (Missions.st('stranger_photo').status === 'done' && Missions.active !== 'stranger_photo') { const n = NPC.byKey('percival'); if (n && n.distP > 80) { NPC.despawn(n); if (this._cam) { Game.scene.remove(this._cam); this._cam = null; } } return; }
    if (NPC.byKey('percival') || Missions.st('m1').status !== 'done') return;
    const n = NPC.spawn({ key: 'percival', name: 'Percival Lumley', x: PINE_HOLLOW.x, z: PINE_HOLLOW.z, wild: true, brave: 0.3, state: 'scripted', tags: ['generic'], look: { skin: '#f0c4a0', shirt: '#e6dcc5', vest: '#5a3a5a', hair: '#c9a227', mustache: '#c9a227', hatColor: '#3b3b3b' } });
    n.script = (dt, me) => { me.sp = 0; }; n.talk = () => Missions.st('stranger_photo').status === 'available' ? { start: { text: 'Percival Lumley, photographic artist! I\'m assembling a portfolio of the American wilderness, but the deer simply will not sit still for me. Would you keep watch, and keep quiet?', choices: [{ text: 'I\'ll keep watch.', do: () => Missions.start('stranger_photo'), next: null }, { text: 'Not now.', next: null }] } } : { start: { text: Missions.st('stranger_photo').status === 'done' ? 'My finest plates yet. I owe you a great deal.' : 'Shh!', choices: [{ text: 'Goodbye', next: null }] } };
    const cam = new THREE.Group(); cam.position.set(PINE_HOLLOW.x + 1.2, Terrain.height(PINE_HOLLOW.x + 1.2, PINE_HOLLOW.z + 0.8), PINE_HOLLOW.z + 0.8); for (const a of [0, 2.1, 4.2]) { const l = M(GEO.box, '#5a3a22', 0.05, 1.3, 0.05, Math.cos(a) * 0.25, 0.6, Math.sin(a) * 0.25); l.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); cam.add(l); } cam.add(M(GEO.box, '#2b2b2b', 0.35, 0.3, 0.45, 0, 1.35, 0)); cam.add(M(GEO.cyl, '#1b1b1b', 0.08, 0.15, 0.08, 0, 1.35, 0.28)); if (this._cam) Game.scene.remove(this._cam); this._cam = cam; Game.scene.add(cam); // one tripod, however often he's respawned n._cam = cam;
  },
});
