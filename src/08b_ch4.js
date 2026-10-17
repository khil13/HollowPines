/* ===== Chapter 4: Night at Willow Bridge =====
   Tail Sheriff Pike out of town at midnight without being made, listen in on his meeting with Silas Vane, then settle
   it by talking, stealing Vane's ledger, shooting, or walking away. What Pike carries to the meeting comes from Chapter
   2 (who got Eli's journal); what Vane says depends on the Greers' farm and on Dutchy. A reload rewinds to the jail. */
const WB = { x: riverX(0), z: 0 }, MEET = { x: riverX(0) + 21, z: 2 }, JAIL = { x: -22, z: 9 };
const RAIL = { v: { x: riverX(0) + 13, z: -1.3 }, p: { x: riverX(0) + 13, z: 1.3 } }; // mid-talk they lean on the bridge rail, backs to the bank
const CH4 = {
  TAIL: [[-5, 18], [WB.x - 16, 0], [WB.x + 6, 0], [MEET.x - 3, 1]], // Pike's walk: out of town, down the road, over the bridge
  SEE: 15, HEAR: 20, LOSE: 55, LEAVE: 70,
  inWindow() { const h = S.time.hour; return h >= 23 || h < 3; },
  c() { return Missions.st('ch4').c; },
  stage() { const m = Missions.st('ch4'); return Missions.active === 'ch4' ? Missions.defs.ch4.stages[m.stage].id : null; },
  distMeet() { const P = Game.player; return Math.hypot(P.pos.x - MEET.x, P.pos.z - MEET.z); },
  waitForMidnight() { Sky.advance((23 - S.time.hour + 24) % 24); },

  /* ---------- the meeting party and props ---------- */
  props() {
    if (this._props) { this._props.visible = true; return; }
    const g = new THREE.Group(), x = MEET.x + 1.5, z = MEET.z + 2.2, y = Terrain.height(x, z); g.position.set(x, y, z);
    g.add(M(GEO.box, '#7a5232', 0.8, 0.6, 0.6, 0, 0.3, 0)); // crate
    g.add(M(GEO.box, '#ffd27a', 0.16, 0.24, 0.16, -0.22, 0.72, 0, { emissive: '#ffb84a', emissiveIntensity: 0.8 })); // lantern
    const sat = M(GEO.box, '#5a3a22', 0.36, 0.1, 0.26, 0.15, 0.65, 0.02); g.add(sat); this._satchel = sat;
    const l = new THREE.PointLight(0xffb867, 1.1, 11, 2); l.position.set(-0.22, 1.1, 0); g.add(l);
    Game.scene.add(g); this._props = g; Col.circle(x, z, 0.45, y, y + 0.6, { block: true });
    Interact.add({ pos: () => ({ x, y: y + 0.6, z }), r: 1.8, pri: 0.7, opts: p => { const st = this.stage(); return (st === 'listen' || st === 'confront') && !S.evidence.ledger && !this.c().fight ? [{ label: 'Steal Vane\'s ledger', crime: true, fn: () => this.steal(p) }] : []; } });
  },
  spawn() {
    this.despawn(); this.props(); if (this._satchel) this._satchel.visible = !S.evidence.ledger;
    const v = NPC.spawn({ key: 'vane', name: 'Silas Vane', x: MEET.x, z: MEET.z, yaw: -Math.PI / 2, lawful: false, state: 'scripted', wild: true, hp: 160, maxHp: 160, sense: 0.6, tags: ['story', 'ch4'], look: { skin: '#f0c4a0', shirt: '#e6dcc5', coat: '#2b2b3b', vest: '#5a3a5a', hair: '#c9c9c9', mustache: '#c9c9c9', hatColor: '#1b1b1b' } });
    v.script = (dt, me) => { if (this.c().atRail) { if (me.moveTo(RAIL.v.x, RAIL.v.z, 1.4, dt, 0.4)) me.yaw = dampAngle(me.yaw, -Math.PI / 2, 4, dt); return; } me.sp = 0; const pk = NPC.byKey('pike'); if (this.c().arrived && pk) me.face(pk.pos); };
    v.talk = n => (this.c().over || this.c().spotted) && !this.c().done && !this.c().fight ? this.vaneTree(n) : null;
    v.takeHit = o => { // Vane is never in the fight: a bullet sends him running for his horse
      if (!v.alive) return; v.hp = Math.max(v.maxHp * 0.5, v.hp - o.dmg); v.anim.play('hit', { replace: false }); if (!this.c().fight) this.startFight(); if (!v._yelped) { v._yelped = 1; v.say('Ahh! Kill her!', 3); } };
    const brock = S.chars.brock !== 'dead';
    const gun = (k, nm, x, z, route, o) => NPC.spawn(Object.assign({ key: k, name: nm, x, z, lawful: false, group: 'rail4', state: 'patrol', gun: 'revolver', hp: 90, maxHp: 90, fleeHp: 25, accuracy: 0.42, sense: 0.75, wild: true, tags: ['story', 'ch4', 'ch4foe'], route, look: { skin: '#e8b48c', shirt: '#3b3b5b', vest: '#5a5a5a', hair: '#3b2a1e', hatColor: '#2b2b2b' } }, o));
    gun(brock ? 'brock' : 'rail_gun', brock ? 'Brock Harlan' : 'Railroad gun', MEET.x + 12, MEET.z - 6, [{ x: MEET.x + 12, z: MEET.z - 6, wait: 7 }, { x: MEET.x + 12, z: MEET.z + 4, wait: 7 }], brock ? { hp: 130, maxHp: 130, fleeHp: 45, look: { skin: '#d9a07a', shirt: '#e6dcc5', vest: '#3b3b3b', hair: '#5a3a20', mustache: '#5a3a20', hatColor: '#1b1b1b', stout: 1.25 } } : {});
    gun('hoyt', 'Hoyt', MEET.x - 1, MEET.z - 11, [{ x: MEET.x - 1, z: MEET.z - 11, wait: 10 }, { x: MEET.x + 4, z: MEET.z - 13, wait: 6 }]);
    if (S.chars.dutchy === 'ally') { // Dutchy keeps watch on the west bank and can spook their horses
      const old = NPC.byKey('dutchy'); if (old) NPC.despawn(old);
      const d = NPC.spawn({ key: 'dutchy', name: 'Dutchy Moss', x: WB.x - 24, z: 12, lawful: false, state: 'scripted', wild: true, tags: ['story', 'ch4'], look: { skin: '#f0c4a0', shirt: '#b5a17a', hair: '#e2c06a', hatColor: '#8b7d6b', scale: 0.95 } });
      d.script = (dt, me) => { if (me.goTo) { if (me.moveTo(me.goTo.x, me.goTo.z, 4.5, dt, 1)) me.goTo = null; return; } me.sp = 0; if (me.distP < 12) me.face(Game.player.pos); };
      d.talk = null; d.opts = p => { const st = this.stage(); return (st === 'listen' || st === 'confront') && !this.c().dutchyUsed && !this.c().fight && !this.c().done ? [{ label: 'Have Dutchy spook their horses', fn: () => this.dutchyDistract(d) }] : []; };
    }
  },
  despawn() { for (const k of ['vane', 'brock', 'rail_gun', 'hoyt']) { const n = NPC.byKey(k); if (n) NPC.despawn(n); } const d = NPC.byKey('dutchy'); if (d && d.tags.includes('ch4')) NPC.despawn(d); },
  resetPike() { const pk = NPC.byKey('pike'); if (!pk) return; pk.script = null; pk.sense = 1; pk.tags = pk.tags.filter(t => t !== 'ch4foe'); if (pk.alive && !pk.downed && !pk.hostileToPlayer) { pk.state = 'routine'; pk.path = null; pk.goal = null; } },
  cleanup() { this.despawn(); this.resetPike(); if (this._props) this._props.visible = false; },

  /* ---------- stage 2: the tail ---------- */
  startTail(m) {
    const pk = NPC.byKey('pike'); if (!pk) return; m.c.leg = 0; m.c.lookT = 10; m.c.sus = 0; m.c.susMax = 0; m.c.lostT = 0;
    pk.state = 'scripted'; pk.sense = 0.75; pk.go(this.TAIL[0][0], this.TAIL[0][1]); pk.say('Back before sunup.', 3); this.spawn();
    pk.script = (dt, me) => {
      const c = m.c; if (c.atRail) { if (me.moveTo(RAIL.p.x, RAIL.p.z, 1.4, dt, 0.4)) me.yaw = dampAngle(me.yaw, -Math.PI / 2, 4, dt); return; } if (c.arrived) { me.sp = 0; const v = NPC.byKey('vane'); if (v) me.face(v.pos); return; }
      c.lookT -= dt;
      if (c.lookT < 0) { // RDR2-style check over the shoulder: stop, turn, stare back down the road
        me.sp = damp(me.sp, 0, 10, dt); if (!c.looking) { c.looking = 1; c.baseYaw = me.yaw; if (Math.random() < 0.5) me.say(pick(['...', 'Hm.', 'Who\'s there?']), 2); }
        me.yaw = dampAngle(me.yaw, c.baseYaw + Math.PI, 4, dt); if (c.lookT < -2.6) { c.looking = 0; c.lookT = rand(8, 12); } return;
      }
      if (c.leg === 0) { if (me.followPath(dt, 1.8)) c.leg = 1; return; }
      const p = this.TAIL[c.leg]; if (me.moveTo(p[0], p[1], 1.8, dt, 0.8)) { c.leg++; if (c.leg >= this.TAIL.length) { c.arrived = 1; me.say('Silas.', 2); } }
    };
  },
  tailUpdate(dt, ctx) {
    const c = ctx.m.c, P = Game.player, pk = NPC.byKey('pike'); if (!pk || !pk.alive || c.arrived) return; const d = pk.distP;
    let rate = 0;
    if (pk.seesPlayer && d < this.SEE) rate += (P.crouch ? 0.35 : 1) * (1.4 - d / this.SEE) * (c.looking ? 1.6 : 1);
    if (d < 5 && !P.crouch) rate += 0.5; // footsteps right behind him
    if (P.state === 'ride' && d < 14) rate += 0.45; // hoofbeats
    c.sus = clamp(c.sus + (rate > 0 ? rate * 0.9 : -0.12) * dt, 0, 1); c.susMax = Math.max(c.susMax, c.sus);
    if (c.sus > 0.5 && !c.warned) { c.warned = 1; pk.say('Somebody there?', 2.5); c.lookT = Math.min(c.lookT, 0); }
    if (c.sus < 0.2) c.warned = 0;
    if (d > this.LOSE) { c.lostT += dt; if (!c.lostWarn) { c.lostWarn = 1; UI.toast('Pike is getting away. Close the distance.', 'bad'); } } else { c.lostT = 0; c.lostWarn = 0; }
  },

  /* ---------- stage 3: the conversation ---------- */
  lines() {
    const L = [['p', 'You said midnight, Silas.'], ['v', 'And here I am. You\'re early, Amos, because you\'re frightened.']];
    if (S.decisions.journal === 'pike') L.push(['p', 'Here. The Calloway boy\'s book. Every page.'], ['v', 'Good. Without this, Eli Calloway is a man who wrote stories.', () => { S.evidence.journal_given_vane = true; }]);
    else if (S.flags.vane_warned) L.push(['v', 'Harlan tells me the sister waved Eli\'s journal in his face at the Greer place. In front of witnesses.'], ['p', 'She won\'t give it up. Not to me. Not to anybody.']);
    else L.push(['v', 'And the journal?'], ['p', 'The sister\'s got it. She won\'t hand it over.']);
    L.push(['v', 'Walk with me, Amos.', () => { this.c().atRail = 1; }]);
    if (S.locations.farm === 'occupied') L.push(['v', 'The Greers are still on their land. That costs me a mile of track, Amos.']);
    else if (S.decisions.m3 === 'railroad') L.push(['v', 'At least the Greer land came cheap. The sister saw to that herself.']);
    else L.push(['v', 'The Greer place is empty. A pity about the family.']);
    if (S.chars.dutchy === 'ally') L.push(['p', 'And the Moss boy\'s quit the Cranes. Folks say he rides with her now.']);
    L.push(['v', 'Eli Calloway is at Tamarack Pass, finishing my survey. When the last stake is in, he goes in the river.', () => { this.learnEli(); }],
      ['p', 'That wasn\'t the deal. Nobody was supposed to get killed.'],
      S.decisions.journal === 'pike' ? ['v', 'The deal is whatever I pay for. Here is this month. Count it.'] : ['v', 'Then get me that journal, or I\'ll find a sheriff who can.'],
      ['v', 'We\'re done here, Amos.']);
    return L;
  },
  learnEli() { if (S.evidence.eli_alive) return; S.evidence.eli_alive = true; journal('Eli is alive. Vane is holding him at Survey Camp 3, Tamarack Pass, until the survey is finished.', 'evidence'); UI.toast('Eli is alive', 'good'); },
  listenEnter(ctx) { const c = ctx.m.c; const pk = NPC.byKey('pike'); if (pk) pk.sense = 0.6; // eyes on Vane now, not the road
    c.lineI = c.lineI || 0; c.lineT = 1.2; c.sus = 0; c.heard = c.heard || 0; c.total = this.lines().length; STORY.hint('Crouch and creep within earshot. Vane and Pike stop talking if you\'re too far away to hear.'); },
  distractTick(dt, c) { if (c.distractT > 0) { c.distractT -= dt; if (c.distractT <= 0 && this._distract) { this._distract(); this._distract = null; } } },
  listenUpdate(dt, ctx) {
    this.distractTick(dt, ctx.m.c); const c = ctx.m.c, P = Game.player, v = NPC.byKey('vane'), pk = NPC.byKey('pike'); if (!v || c.fight || c.done) return; const L = this.lines();
    if (c.lineI < L.length) {
      if (v.distP < this.HEAR) { c.farT = 0; c.lineT -= dt; if (c.lineT <= 0) { const [who, txt, fx] = L[c.lineI]; const sp = who === 'v' ? v : pk; if (sp && sp.alive) sp.say(txt, 4.4); c.heard++; if (fx) fx(); c.lineI++; c.lineT = 4.6; if (c.lineI >= L.length) c.over = 1; } }
      else { c.farT = (c.farT || 0) + dt; if (c.farT > 6 && !c.farHint) { c.farHint = 1; UI.toast('Too far to make out what they\'re saying. Get closer.', ''); } }
    }
    // Vane and Pike watching for eavesdroppers: being seen up close ends the secret meeting, it doesn't fail it
    let rate = 0; for (const n of [v, pk]) if (n && n.alive && n.seesPlayer && n.distP < 12) rate += (P.crouch ? 0.35 : 1) * (1.4 - n.distP / 12);
    c.sus = clamp(c.sus + (rate > 0 ? rate : -0.15) * dt, 0, 1);
    if (c.sus >= 1 && !c.spotted) this.spotted(v);
    if (!c.done && S.evidence.ledger && this.distMeet() > this.LEAVE) this.resolve('stole');
  },
  spotted(v) { const c = this.c(); if (!v) return; c.spotted = 1; v.say('Miss Calloway. Come into the light.', 3); if (!Dialog.open && Game.player.state !== 'ride') Dialog.start(v, this.vaneTree(v)); },
  steal(p) {
    const c = this.c(); p.yaw = Math.atan2(MEET.x + 1.5 - p.pos.x, MEET.z + 2.2 - p.pos.z);
    if (NPC.all.some(n => n.tags.includes('ch4') && n.key !== 'dutchy' && n.alive && !n.downed && n.seesPlayer && n.distP < 10)) { if (!c.spotted) this.spotted(NPC.byKey('vane')); return; }
    p.anim.play('pickup', { on: { end: () => { if (this._satchel) this._satchel.visible = false; S.evidence.ledger = true; Inv.add('vane_ledger'); Sfx.pickup(); journal('Lifted Silas Vane\'s ledger off the crate at Willow Bridge: payments to Sheriff Pike and the Crane gang, in Vane\'s own hand.', 'evidence'); UI.toast('Took Vane\'s ledger', 'good'); Missions.emit('ledger'); } } });
  },
  dutchyDistract(d) {
    const c = this.c(); c.dutchyUsed = 1; d.say('Leave it to me.', 3); d.goTo = { x: MEET.x + 30, z: MEET.z + 16 };
    c.distractT = 4; this._distract = () => { if (Missions.active !== 'ch4' || c.fight) return; UI.toast('Horses screaming east of the bridge. Vane\'s men run to them.', 'good');
      for (const n of NPC.all) if (n.group === 'rail4' && n.alive && !n.downed && n.state === 'patrol') { n.state = 'scripted'; n.away = 45; n.script = (dt, me) => { me.moveTo(MEET.x + 34, MEET.z + 12, 4.2, dt, 2); me.away -= dt; if (me.away <= 0) { me.state = 'patrol'; me.script = null; } }; }
      NPC.despawn(d); }; // runs on game time from the stage updates
  },

  /* ---------- stage 4: settle it ---------- */
  vaneTree(v) {
    const c = this.c(), pk = () => NPC.byKey('pike'), ev = () => Inv.count('journal') || Inv.count('journal_copy');
    return {
      start: { text: () => S.decisions.journal === 'pike' ? 'Miss Calloway. Amos was just giving me something of your brother\'s. Careless of you, trusting him with it.' : 'Miss Calloway. Amos tells me you\'re holding something of your brother\'s. I would like to buy it.', choices: [
        { text: 'Where is Eli?', hide: () => !!c.askedEli, do: () => { c.askedEli = 1; this.learnEli(); }, next: 'eli' },
        { text: 'Show Eli\'s journal: "The territorial marshal reads this next."', cond: ev, why: S.decisions.journal === 'pike' ? 'Pike gave Eli\'s journal to Vane' : 'You have nothing to show him', do: () => this.resolve('exposed'), next: 'exposed' },
        { text: '"Name your price."', next: 'offer' },
        { text: 'Draw on them', do: () => this.startFight(), next: null },
        { text: 'Back away', do: () => this.resolve('walked'), next: 'back' },
      ] },
      eli: { text: 'Your brother is a guest of the railroad at Tamarack Pass. Survey Camp 3. He is finishing my maps. How he leaves depends on how sensible his sister is.', next: 'start' },
      exposed: { text: 'Vane reads a page by the lantern and stops smiling.', who: '', next: 'pike' },
      pike: { who: 'Sheriff Pike', text: 'That\'s enough, Silas. I\'m done taking your money. Twenty years I wore this star, and I won\'t watch you drown a boy for a railroad.', next: 'vaneOut' },
      vaneOut: { text: 'Then you are done, Amos. Good night, Miss Calloway. Enjoy your sheriff. He won\'t live long enough to testify.' },
      offer: { text: 'One hundred dollars, tonight. Ride out of the valley by Sunday, and your brother walks free when the last stake is in.', choices: [
        { text: 'Take Vane\'s money', do: () => this.resolve('bought'), next: 'deal' },
        { text: 'Refuse', next: 'start' },
      ] },
      deal: { text: 'A sensible family after all. Sunday, Miss Calloway.' },
      back: { text: 'Wise. Good night, Miss Calloway.' },
    };
  },
  leave() { // the party breaks up: Vane and his men ride east, Pike walks home
    for (const n of NPC.all) if (n.tags.includes('ch4') && n.key !== 'dutchy' && n.alive && !n.downed && n.state !== 'combat') { n.state = 'scripted'; n.script = (dt, me) => me.moveTo(MEET.x + 60, MEET.z - 40, 3.2, dt); }
    const pk = NPC.byKey('pike'); if (pk && pk.alive && !pk.downed && !pk.hostileToPlayer) { pk.state = 'scripted'; pk.script = (dt, me) => me.moveTo(WB.x - 20, 0, 1.8, dt); }
  },
  resolve(how) {
    const c = this.c(); if (c.done) return; c.done = how; S.decisions.ch4 = how;
    if (how === 'exposed') { S.chars.pike = 'turned'; Rep.honor(6, 'stood up to Vane'); Rep.faction('railroad', -30); Rep.rel('pike', 10); journal('Showed Vane Eli\'s journal by his own lantern. Pike broke with him on the spot. He says he\'ll testify.', 'decision'); }
    if (how === 'bought') { Inv.money(100, 'from Silas Vane'); Rep.honor(-15, 'took Vane\'s money'); Rep.faction('railroad', 25); Rep.rel('mae', -20); journal('Took a hundred dollars from Silas Vane to leave the valley by Sunday. He says Eli walks free when the line is staked.', 'decision'); }
    if (how === 'walked') journal('Backed away from Vane and his men at Willow Bridge.', 'decision');
    if (how === 'stole') journal('Slipped away from Willow Bridge with Vane\'s ledger. Nobody saw me.', 'decision');
    if (how !== 'fight') this.leave();
  },
  startFight() {
    const c = this.c(); if (c.fight || c.done) return; c.fight = 1; if (Dialog.open) Dialog.close();
    for (const n of NPC.all) if (n.group === 'rail4' && n.alive && !n.downed) { n.script = null; n.fightPlayer(); }
    const v = NPC.byKey('vane'); if (v) { v.state = 'scripted'; v.fled = true; v.say('Deal with her!', 3); v.script = (dt, me) => me.moveTo(MEET.x + 70, MEET.z - 45, 5.2, dt); }
    const pk = NPC.byKey('pike'); if (pk && pk.alive && !pk.downed) {
      if (S.decisions.journal === 'pike') { pk.tags.push('ch4foe'); pk.lawful = false; pk.say('Should\'ve left it alone, Calloway.', 3); pk.fightPlayer(); }
      else { pk.state = 'scripted'; pk.fled = true; pk.say('I\'m not dying for you, Silas!', 3); pk.script = (dt, me) => me.moveTo(WB.x - 30, 4, 4.5, dt); }
    }
    UI.toast('Vane\'s men draw on you!', 'bad');
  },
  confrontEnter(ctx) {
    const c = ctx.m.c, v = NPC.byKey('vane'); if (c.fight) { c.fight = 0; this.startFight(); return; }
    if (c.spotted && v && !Dialog.open && !c.done) Dialog.start(v, this.vaneTree(v));
    else if (v && !c.done) v.say('We\'re done here, Amos.', 2);
  },
  confrontUpdate(dt, ctx) {
    const c = ctx.m.c; this.distractTick(dt, c); if (c.done) return;
    if (c.fight) { if (NPC.all.filter(n => n.tags.includes('ch4foe')).every(n => !n.alive || n.downed || n.fled)) this.resolve('fight'); return; }
    if (this.distMeet() > this.LEAVE) this.resolve(S.evidence.ledger ? 'stole' : 'walked');
  },
  complete(ctx) {
    const m = ctx.m, how = S.decisions.ch4, pk = NPC.byKey('pike');
    if (how === 'fight') { if (S.decisions.journal === 'pike' && S.chars.pike !== 'dead') { S.chars.pike = 'left'; journal('Pike drew on me at Willow Bridge and lost. By morning he had ridden out of the valley.', 'fate'); if (pk) NPC.despawn(pk); } journal('Shot it out with Vane\'s men at Willow Bridge. Vane got away east.', 'decision'); }
    m.outcome = { exposed: 'Faced Vane down with Eli\'s journal. Sheriff Pike turned on him.', bought: 'Took $100 of Vane\'s money to leave the valley.', stole: 'Stole Vane\'s ledger from under his nose.', fight: 'Shot it out at Willow Bridge. Vane got away.', walked: 'Let the meeting go.' }[how] || 'The meeting broke up.';
    if (S.evidence.eli_alive) m.outcome += ' · Eli is alive at Tamarack Pass'; if (how !== 'stole' && S.evidence.ledger) m.outcome += ' · took Vane\'s ledger';
    S.chapter = Math.max(S.chapter, 5); this.cleanup();
  },
};

Missions.def({ id: 'ch4', type: 'main', chapter: 4, title: 'Night at Willow Bridge', giver: 'cora', summary: 'Sheriff Pike asked Cora for a late supper and a full flask. He\'s meeting someone at midnight.',
  prereq: () => ['done', 'failed', 'unavailable'].includes(Missions.st('m3').status), // the story goes on even if the Greers' stand never happened
  blocked: () => S.chars.pike === 'dead' ? 'Sheriff Pike is dead. Whatever he was hiding died with him.' : S.chars.pike === 'left' || S.chars.pike === 'jailed' ? 'Sheriff Pike is gone from the valley.' : null,
  start: () => { const n = NPC.byKey(S.chars.cora === 'dead' ? 'mae' : 'cora'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; },
  stages: [
    { id: 'night', text: 'Pike meets someone at midnight. Watch the jail after 11 pm.', enter: () => { CH4.cleanup(); STORY.hint('Ask Cora to wait with you until eleven, or rest at a camp.'); },
      objectives: [O.check('jail', 'Watch the sheriff\'s office after 11 pm', () => CH4.inWindow() && Math.hypot(Game.player.pos.x - JAIL.x, Game.player.pos.z - JAIL.z) < 30, () => ({ x: JAIL.x, z: JAIL.z, y: 6 }))] },
    { id: 'tail', text: 'Follow Pike. Keep your distance and stay out of his sight.', enter: ctx => { if (ctx.resumed && !ctx.rew) return CH4.rewind(ctx); CH4.startTail(ctx.m); },
      objectives: [O.check('follow', 'Follow Sheriff Pike', c => !!c.m.c.arrived, () => { const n = NPC.byKey('pike'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; }),
        O.check('unseen', 'Optional: never let Pike grow suspicious', c => c.m.c.arrived && c.m.c.susMax < 0.5, null, { optional: true })],
      update: (dt, ctx) => CH4.tailUpdate(dt, ctx), on: { alarm: (d, ctx) => { if (d.group === 'rail4') ctx.m.c.gunsSaw = 1; } },
      fail: [{ check: ctx => ctx.m.c.gunsSaw, why: 'Vane\'s men spotted you before Pike got there.' }, { check: () => !NPC.byKey('pike') || !NPC.byKey('pike').alive, why: 'Sheriff Pike is dead.' }, { check: ctx => ctx.m.c.sus >= 1, why: 'Pike spotted you following him.' },
        { check: () => { const n = NPC.byKey('pike'); return n && (n.state === 'combat' || n.hostileToPlayer); }, why: 'You drew on the sheriff. The meeting is off.' }, { check: ctx => ctx.m.c.lostT > 10, why: 'You lost Pike in the dark.' }] },
    { id: 'listen', text: 'Pike is meeting Silas Vane. Get close enough to hear without being seen.', enter: ctx => { if (ctx.resumed && !ctx.rew) return CH4.rewind(ctx); CH4.listenEnter(ctx); },
      objectives: [O.check('listen', 'Listen in on Pike and Vane', c => c.m.c.over || c.m.c.spotted || c.m.c.fight || c.m.c.done, () => ({ x: MEET.x, z: MEET.z, y: 4 })),
        O.check('all', 'Optional: hear the whole conversation', c => c.m.c.over && !c.m.c.spotted, null, { optional: true }),
        O.check('ledger', 'Optional: steal Vane\'s ledger from the crate', () => !!S.evidence.ledger, () => S.evidence.ledger ? null : { x: MEET.x + 1.5, z: MEET.z + 2.2, y: 3 }, { optional: true })],
      update: (dt, ctx) => CH4.listenUpdate(dt, ctx), on: { alarm: (d, ctx) => { if (d.group === 'rail4') ctx.m.c.fight = 1; } },
      fail: [{ check: ctx => !S.evidence.ledger && !ctx.m.c.fight && CH4.distMeet() > 95, why: 'You left before the meeting was over.' }] },
    { id: 'confront', text: 'Settle it: confront Vane, take his ledger, fight, or slip away.', enter: ctx => { if (ctx.resumed && !ctx.rew) return CH4.rewind(ctx); CH4.confrontEnter(ctx); },
      objectives: [O.check('settle', () => CH4.c().fight ? 'Defeat Vane\'s men' : 'Confront Vane, or leave the bridge', c => !!c.m.c.done, () => { if (CH4.c().fight) { const n = NPC.all.find(x => x.tags.includes('ch4foe') && x.alive && !x.downed && !x.fled); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.5, enemy: true } : null; } const v = NPC.byKey('vane'); return v ? { x: v.pos.x, z: v.pos.z, y: v.pos.y + 2.4 } : null; }),
        O.check('ledger', 'Optional: steal Vane\'s ledger from the crate', () => !!S.evidence.ledger, () => S.evidence.ledger || CH4.c().fight ? null : { x: MEET.x + 1.5, z: MEET.z + 2.2, y: 3 }, { optional: true })],
      update: (dt, ctx) => CH4.confrontUpdate(dt, ctx), on: { alarm: (d, ctx) => { if (d.group === 'rail4' && !ctx.m.c.done) CH4.startFight(); } },
      minTime: 0.5 },
  ],
  complete: ctx => CH4.complete(ctx),
  cleanup: () => CH4.cleanup(),
  onFail: () => { CH4.cleanup(); S.chapter = Math.max(S.chapter, 5); },
  failOutcome: () => 'Pike\'s meeting went on without you.',
});
CH4.rewind = ctx => { // a reload mid-tail restarts the night from the jail, like an RDR2 checkpoint
  ctx.rew = 1; ctx.m.stage = 0; ctx.m.c = {}; CH4.cleanup(); UI.toast('Back at the jail. Pike hasn\'t left yet.', '');
};
