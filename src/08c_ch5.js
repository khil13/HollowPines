/* ===== Chapter 5: The Ledger =====
   Eli is held at Survey Camp 3, Tamarack Pass. Who rides up the trail with you depends on the whole story so far:
   the territorial marshal (if you kept evidence, or Pike turned), the Cranes (if Dutchy is your ally), or nobody.
   Endings: Vane arrested (law), shot by the Cranes (cranes), killed by you at the gate (gun), or you take his money
   and hand over Eli's papers (payout). A reload rewinds to the trail. */
const TAMARACK = { x: 92, z: -166 }, T_GATE = { x: 93, z: -150 }, T_OVERLOOK = { x: 101, z: -126 }, T_TRAILHEAD = { x: 110, z: -104 };
const T_TENT = { x: 99, z: -178 }, T_OFFICE = { x: 84, z: -176 }; // Eli's survey tent (back right), Vane's office tent (back left)
const CH5 = {
  c() { return Missions.st('ch5').c; },
  stage() { const m = Missions.st('ch5'); return Missions.active === 'ch5' ? Missions.defs.ch5.stages[m.stage].id : null; },
  evidence() { return Inv.count('journal') + Inv.count('journal_copy') + Inv.count('vane_ledger') > 0; },
  marshalComes() { return this.evidence() || (S.chars.pike === 'turned'); },
  cranesCome() { return S.chars.dutchy === 'ally'; },
  foes() { return NPC.all.filter(n => n.tags.includes('ch5foe') && n.alive && !n.downed && !n.fled); },
  dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); },

  /* ---------- the camp itself: always in the world ---------- */
  build() {
    const sc = Game.scene, at = (x, z) => ({ x, y: Terrain.height(x, z), z });
    const tent = (x, z, yaw, col) => { const p = at(x, z), g = new THREE.Group(); g.position.set(p.x, p.y, p.z); g.rotation.y = yaw; g.add(M(GEO.box, col, 3.2, 1.3, 4, 0, 0.65, 0)); const roof = M(GEO.box, col, 2.4, 0.12, 4.1, 0.9, 1.75, 0); roof.rotation.z = -0.75; g.add(roof); const roof2 = M(GEO.box, col, 2.4, 0.12, 4.1, -0.9, 1.75, 0); roof2.rotation.z = 0.75; g.add(roof2); g.add(M(GEO.box, '#3b2a1e', 0.9, 1.1, 0.05, 0, 0.55, 2.02)); sc.add(g);
      const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw)), hx = c * 1.6 + s * 2, hz = s * 1.6 + c * 2; Col.box(p.x - hx, p.x + hx, p.z - hz, p.z + hz, p.y - 1, p.y + 2.2, { block: true }); };
    tent(T_OFFICE.x, T_OFFICE.z, 0, '#e6dcc5'); tent(T_TENT.x, T_TENT.z, 0, '#d9c58f'); tent(80, -164, Math.PI / 2, '#d9c58f'); tent(104, -163, -Math.PI / 2, '#cfc3a6');
    for (const [x, z] of [[88, -158], [97, -158], [92, -170]]) { const p = at(x, z); sc.add(M(GEO.box, '#8b6a47', 1.2, 1.0, 0.9, p.x, p.y + 0.5, p.z)); Col.box(p.x - 0.65, p.x + 0.65, p.z - 0.5, p.z + 0.5, p.y - 1, p.y + 1, { walk: true, block: true }); }
    for (const [x, z] of [[89, -151], [97, -151], [86, -170], [100, -170]]) { const p = at(x, z); sc.add(M(GEO.cyl, '#2b2b2b', 0.06, 2.6, 0.06, p.x, p.y + 1.3, p.z)); sc.add(M(GEO.box, '#ffd27a', 0.22, 0.3, 0.22, p.x, p.y + 2.65, p.z, { emissive: '#ffb84a', emissiveIntensity: 0.7 })); const l = new THREE.PointLight(0xffb867, 0, 10, 2); l.position.set(p.x, p.y + 2.6, p.z); sc.add(l); Game.lamps.push(l); }
    const sign = at(T_GATE.x + 2.5, T_GATE.z), sg = new THREE.Group(); sg.position.set(sign.x, sign.y, sign.z); sg.add(M(GEO.box, '#6b4a2f', 0.12, 2.2, 0.12, 0, 1.1, 0)); sg.add(M(GEO.box, '#d9c58f', 1.6, 0.5, 0.06, 0, 2.0, 0)); sc.add(sg);
    World.campfire(92, -164);
  },

  /* ---------- people ---------- */
  spawn() {
    this.despawn(); const brock = S.chars.brock !== 'dead';
    const look = { skin: '#e8b48c', shirt: '#3b3b5b', vest: '#5a5a5a', hair: '#3b2a1e', hatColor: '#2b2b2b' };
    const gun = (k, nm, x, z, route, o) => NPC.spawn(Object.assign({ key: k, name: nm, x, z, lawful: false, group: 'rail5', state: 'patrol', gun: 'revolver', hp: 90, maxHp: 90, fleeHp: 20, accuracy: 0.4, sense: 0.85, wild: true, tags: ['story', 'ch5', 'ch5foe'], route, look }, o));
    gun('rg1', brock ? 'Brock Harlan' : 'Railroad foreman', 92, -153, [{ x: 92, z: -153, wait: 10 }, { x: 98, z: -156, wait: 6 }], brock ? { hp: 130, maxHp: 130, look: { skin: '#d9a07a', shirt: '#e6dcc5', vest: '#3b3b3b', hair: '#5a3a20', mustache: '#5a3a20', hatColor: '#1b1b1b', stout: 1.25 } } : {});
    gun('rg2', 'Railroad gun', 84, -160, [{ x: 84, z: -160, wait: 8 }, { x: 84, z: -170, wait: 8 }]);
    gun('rg3', 'Railroad gun', 104, -168, [{ x: 104, z: -168, wait: 8 }, { x: 104, z: -158, wait: 8 }]);
    gun('rg4', 'Railroad gun', 92, -175, [{ x: 92, z: -175, wait: 12 }, { x: 95, z: -170, wait: 5 }], { gun: 'rifle', accuracy: 0.45 });
    const v = NPC.spawn({ key: 'vane', name: 'Silas Vane', x: T_OFFICE.x + 1, z: T_OFFICE.z + 3.2, yaw: 0, lawful: false, state: 'scripted', wild: true, gun: 'revolver', hp: 140, maxHp: 140, accuracy: 0.5, dmg: 16, sense: 0.7, tags: ['story', 'ch5'], look: { skin: '#f0c4a0', shirt: '#e6dcc5', coat: '#2b2b3b', vest: '#5a3a5a', hair: '#c9c9c9', mustache: '#c9c9c9', hatColor: '#1b1b1b' } });
    v.script = (dt, me) => { if (me.goTo) { if (me.moveTo(me.goTo.x, me.goTo.z, me.goTo.sp || 2, dt, 0.8)) me.goTo = null; return; } me.sp = 0; };
    v.knockoutOnly = this.c().plan === 'law'; // the marshal wants him breathing
    const e = NPC.spawn({ key: 'eli', name: 'Eli Calloway', x: T_TENT.x, z: T_TENT.z + 2.6, yaw: Math.PI, lawful: true, state: 'tied', wild: true, hp: 80, maxHp: 80, tags: ['story', 'ch5'], look: { skin: '#f0c4a0', shirt: '#4a6a8a', pants: '#5a4a3a', hair: '#c97b3a', hat: false, beard: '#b5763a' } });
    e.talk = null; e.opts = p => e.state === 'tied' && !this.c().cutT ? [{ label: 'Cut Eli loose', fn: () => this.cut(p) }] : [];
    // allies wait at the overlook
    if (this.marshalComes()) {
      const mk = (k, nm, x, z, lk, o) => NPC.spawn(Object.assign({ key: k, name: nm, x, z, lawful: true, state: 'scripted', wild: true, gun: 'rifle', hp: 160, maxHp: 160, tags: ['story', 'ch5', 'ally'], look: lk }, o));
      mk('marshal', 'Marshal Ruth Calder', T_OVERLOOK.x - 2, T_OVERLOOK.z - 1, { skin: '#d9a07a', shirt: '#6b5a4a', coat: '#3b3b3b', hair: '#5a3a20', longHair: true, hatColor: '#3b2a1e', badge: true, scarf: '#8a3b3b' });
      mk('deputy5', 'Deputy Hale', T_OVERLOOK.x + 1, T_OVERLOOK.z - 2, { skin: '#e8b48c', shirt: '#9a7b4f', hair: '#3b2a1e', hatColor: '#6b4a2f', badge: true }, { gun: 'revolver' });
      if (S.chars.pike === 'turned') { const pk = NPC.byKey('pike'); if (pk) NPC.despawn(pk); mk('pike', 'Sheriff Pike', T_OVERLOOK.x + 3, T_OVERLOOK.z, { skin: '#d9a07a', shirt: '#6b6b6b', vest: '#2b2b2b', hair: '#9a9a9a', mustache: '#cfcfcf', hatColor: '#222', stout: 1.15, scarf: '#2b2b2b', badge: true }, { gun: 'revolver', lawman: true }); }
    }
    if (this.cranesCome()) {
      const cr = (k, nm, x, z, lk, o) => { const old = NPC.byKey(k); if (old) NPC.despawn(old); return NPC.spawn(Object.assign({ key: k, name: nm, x, z, lawful: false, state: 'scripted', wild: true, gun: 'revolver', hp: 120, maxHp: 120, tags: ['story', 'ch5', 'ally', 'crane'], look: lk }, o)); };
      cr('dutchy', 'Dutchy Moss', T_OVERLOOK.x - 3, T_OVERLOOK.z + 3, { skin: '#f0c4a0', shirt: '#b5a17a', hair: '#e2c06a', hatColor: '#8b7d6b', scale: 0.95 });
      if (S.chars.fenwick !== 'dead') cr('fenwick', 'Fenwick Crane', T_OVERLOOK.x - 5, T_OVERLOOK.z + 1, { skin: '#d9a07a', shirt: '#3b3b3b', coat: '#5a3a2a', hair: '#2b1d14', mustache: '#2b1d14', hatColor: '#1b1b1b', stout: 1.1 }, { gun: 'rifle' });
      else cr('sal', 'Sal', T_OVERLOOK.x - 5, T_OVERLOOK.z + 1, { skin: '#b07a55', shirt: '#7a3b3b', hair: '#1b1b1b', hatColor: '#4a3b30' });
    }
    for (const a of this.allies()) { a.script = (dt, me) => this.allyAI(me, dt); a.talk = n => this.stage() === 'plan' ? this.council() : null; }
  },
  allies() { return NPC.all.filter(n => n.tags.includes('ally') && n.tags.includes('ch5') && n.alive); },
  lead() { return NPC.byKey('marshal') || NPC.byKey('fenwick') || NPC.byKey('sal') || NPC.byKey('dutchy'); },
  despawn() { for (const n of NPC.all.slice()) if (n.tags.includes('ch5')) NPC.despawn(n); },
  cleanup() { this.despawn(); if (S.chars.pike !== 'dead' && S.chars.pike !== 'left' && !NPC.byKey('pike')) World.apply(); },

  /* ---------- allies fight beside you (other NPCs only ever target the player) ---------- */
  allyAI(me, dt) {
    const c = this.c(), P = Game.player, foes = c.fight ? this.foes() : []; me.allyAim = false;
    if (!foes.length) {
      if (c.march && !c.fight) { if (me.moveTo(T_GATE.x + (me.slot || 0), T_GATE.z + 4, 2.6, dt, 1)) { me.face(TAMARACK); } return; }
      if (c.plan && c.plan !== 'alone' && this.stage() !== 'plan') { const d = me.distP; if (d > 5) me.moveTo(P.pos.x, P.pos.z, d > 12 ? 4.6 : 2.4, dt, 3.5); else me.sp = 0; return; }
      me.sp = 0; if (me.distP < 15) me.face(P.pos); return;
    }
    let t = null, td = 1e9; for (const f of foes) { const d = this.dist(me.pos, f.pos); if (d < td) { td = d; t = f; } }
    if (td > 17) me.moveTo(t.pos.x, t.pos.z, 4.4, dt, 14); else { me.sp = damp(me.sp, 0, 6, dt); me.face(t.pos); }
    me.allyAim = true; me.anim.layers.aim = 1; me.anim.layers.rifle = me.gun === 'rifle' ? 1 : 0; if (me.gunM) me.gunM.visible = true;
    me.shootT = (me.shootT ?? rand(0.6, 1.4)) - dt;
    if (me.shootT <= 0 && td < 32) { me.shootT = rand(1.3, 2.4); if (!Col.los(me.pos.x, me.pos.y + 1.5, me.pos.z, t.pos.x, t.pos.y + 1.2, t.pos.z)) return;
      const m = new THREE.Vector3(); me.rig.R.hand.getWorldPosition(m); const hit = Math.random() < 0.45; FX.tracer(m, new THREE.Vector3(t.pos.x + (hit ? 0 : rand(-1.2, 1.2)), t.pos.y + 1.2, t.pos.z + (hit ? 0 : rand(-1.2, 1.2)))); Sfx.shot(me.gun === 'rifle'); me.anim.play('recoil');
      if (hit) t.takeHit({ dmg: me.gun === 'rifle' ? 45 : 32, from: me, gun: me.gun, dir: fwd(me.yaw) }); }
  },

  /* ---------- the plan at the overlook ---------- */
  council() {
    const law = !!NPC.byKey('marshal'), cr = !!(NPC.byKey('dutchy') && this.cranesCome()), lead = this.lead();
    const intro = law && cr ? 'Marshal Calder eyes the Cranes like she\'d rather arrest them too. "Your call, Calloway. It\'s your brother."' : law ? (S.chars.pike === 'turned' ? 'Marshal Ruth Calder. Amos Pike wired me, and he\'ll swear to every word. I have a warrant for Silas Vane and two good guns. We take him alive.' : 'Marshal Ruth Calder. Mae Holloway sent me your brother\'s pages. If they hold up, I\'ve a warrant for Silas Vane. We take him alive.') : (S.chars.fenwick !== 'dead' ? 'Fenwick Crane spits. "Vane paid us in scraps to do his dirty work. Kid says you want your brother back. We want Vane. Ride in with us."' : 'Dutchy grins. "Sal and me. Ain\'t much, but we shoot straight when it counts."');
    return { start: { who: lead ? lead.name : '', text: intro, choices: [
      { text: 'Ride in with the marshal', hide: () => !law, do: () => this.choose('law'), next: 'law' },
      { text: 'Ride in with the Cranes', hide: () => !cr, do: () => this.choose('cranes'), next: 'cranes' },
      { text: '"I\'ll go in alone. Quiet."', do: () => this.choose('alone'), next: 'alone' },
    ] },
      law: { text: 'Then we walk up to the gate like honest folk and read the man his warrant. Stay close.' },
      cranes: { text: 'Now you\'re talking. We hit \'em from the gate. Get your brother; Vane\'s ours.' },
      alone: { text: law || cr ? 'Suit yourself. We\'ll be here if it goes bad.' : '' },
    };
  },
  choose(plan) { const c = this.c(); c.plan = plan; S.decisions.ch5_plan = plan; const v = NPC.byKey('vane'); if (v) { v.knockoutOnly = plan === 'law'; if (plan === 'law' && !v.tags.includes('outlaw')) v.tags.push('outlaw'); } /* knocked down, he stays down for the marshal */ let i = -2; for (const a of this.allies()) a.slot = (i += 2) - 2; },

  /* ---------- the camp ---------- */
  campEnter(ctx) {
    const c = ctx.m.c; if (c.plan === 'alone') { STORY.hint('Eli is tied up in the survey tent at the back of the camp. Crouch, stay out of the lantern light, and take guards down quietly from behind.'); return; }
    c.march = 1; UI.toast(c.plan === 'law' ? 'Walk up to the gate with Marshal Calder.' : 'The Cranes ride for the gate.', '');
  },
  campUpdate(dt, ctx) {
    const c = ctx.m.c, P = Game.player, v = NPC.byKey('vane'), lead = this.lead();
    if (c.cutT > 0) { c.cutT -= dt; if (c.cutT <= 0) this.freeEli(); }
    if (c.march && !c.fight && lead && this.dist(lead.pos, T_GATE) < 7 && !c.parley) {
      if (c.plan === 'cranes') { c.parley = 1; lead.say(S.chars.fenwick !== 'dead' ? 'VANE! Fenwick Crane sends his regards!' : 'Light \'em up, boys!', 3); this.startFight(); }
      else if (this.dist(P.pos, T_GATE) < 14 && !Dialog.open) { c.parley = 1; if (v) { v.goTo = { x: T_GATE.x, z: T_GATE.z - 6, sp: 2.2 }; } Dialog.start(lead, this.lawTree()); }
    }
    if (c.fight && !c.surrender && v && v.alive && !this.foes().filter(f => f !== v).length && c.plan !== 'alone') this.vaneSurrenders(v);
  },
  lawTree() {
    return { start: { who: 'Marshal Calder', text: 'Silas Vane! Territorial Marshal Ruth Calder. I have a warrant for your arrest: fraud, conspiracy, and the false imprisonment of Eli Calloway. Step out with your hands empty.', next: 'vane' },
      vane: { who: 'Silas Vane', text: () => S.chars.pike === 'turned' ? 'On whose word, Marshal? A drunk sheriff who took my money for two years?' : 'On whose word, Marshal? A dead man\'s diary and a shopkeeper\'s copy?', choices: [
        { text: 'Show the evidence: "Every payment, in your hand."', cond: () => this.evidence(), why: 'You have nothing to show him', do: () => this.waver(), next: 'waver' },
        { text: 'Draw on him', do: () => this.startFight(), next: null } ] },
      waver: { who: '', text: () => `Vane's men look at each other. ${S.chars.pike === 'turned' ? 'Two of them' : 'One of them'} drops his gun and walks off down the trail. Vane's smile goes thin. "Then bury them all."`, on: () => {}, next: null, choices: [{ text: 'Here it comes', do: () => this.startFight(), next: null }] } };
  },
  waver() { const n = S.chars.pike === 'turned' ? 2 : 1; let k = 0; for (const g of this.foes()) { if (g.key === 'rg1' || k >= n) continue; k++; g.fled = true; g.state = 'scripted'; g.say('Not for this. Not for him.', 3); g.script = (dt, me) => me.moveTo(T_TRAILHEAD.x, T_TRAILHEAD.z, 3.4, dt); } this.c().wavered = k; },
  startFight() {
    const c = this.c(); if (c.fight) return; c.fight = 1; c.alarm = 1; c.march = 0; if (Dialog.open) Dialog.close();
    for (const n of this.foes()) { n.script = null; n.fightPlayer(); }
    const v = NPC.byKey('vane'); if (v && v.alive && !c.surrender) { if (c.plan === 'alone') { v.tags.push('ch5foe'); v.fightPlayer(); } else { v.goTo = { x: T_OFFICE.x, z: T_OFFICE.z + 3, sp: 4.5 }; v.say('Kill them!', 3); } }
  },
  vaneSurrenders(v) { const c = this.c(); c.surrender = 1; v.goTo = null; v.state = 'scripted'; v.fled = false; v.hostileToPlayer = false; v.script = (dt, me) => { me.sp = 0; }; v.say('Enough! ENOUGH. I\'m unarmed.', 4); v.anim.expr = 'alarm'; UI.toast('Silas Vane surrenders', 'good'); },
  cut(p) { const c = this.c(); c.cutT = 1.5; p.yaw = Math.atan2(NPC.byKey('eli').pos.x - p.pos.x, NPC.byKey('eli').pos.z - p.pos.z); p.anim.play('kneel', { loop: true }); },
  freeEli() {
    const e = NPC.byKey('eli'), P = Game.player; P.anim.stop('kneel'); if (!e || !e.alive) return; S.flags.eli_free = true; e.state = 'scripted'; e.say('Wren?! You came. You actually came.', 4);
    e.script = (dt, me) => { const d = me.distP; if (d > 3.2) me.moveTo(P.pos.x, P.pos.z, d > 9 ? 4.8 : 2.4, dt, 2.6); else me.sp = 0; };
    journal('Cut Eli loose in the survey tent at Tamarack Pass. Thinner, angrier, alive.', 'decision'); UI.toast('Eli is free. Get him out.', 'good');
  },

  /* ---------- finale ---------- */
  finaleEnter(ctx) {
    const c = ctx.m.c, v = NPC.byKey('vane');
    if (!v || !v.alive) return this.end(c.plan === 'cranes' ? 'cranes' : 'gun');
    if (c.plan === 'law') { const m = NPC.byKey('marshal'); if (m) { m.script = (dt, me) => { if (me.moveTo(v.pos.x, v.pos.z, 3, dt, 1.4)) { me.face(v.pos); c.cuffT = (c.cuffT || 0) + dt; if (c.cuffT > 2 && !c.ended) { me.say('Silas Vane, you\'re under arrest.', 4); this.end('law'); } } }; } else this.end('law'); }
    else if (c.plan === 'cranes') { const k = NPC.byKey('fenwick') || NPC.byKey('sal') || NPC.byKey('dutchy'); if (k) { k.script = (dt, me) => { if (me.moveTo(v.pos.x, v.pos.z, 3.4, dt, 4)) { me.face(v.pos); c.execT = (c.execT || 0) + dt; if (c.execT > 0.4 && !c.execSaid) { c.execSaid = 1; me.say('The Cranes don\'t hold with courts, Vane.', 3); } if (c.execT > 2.2 && v.alive) { const m = new THREE.Vector3(); me.rig.R.hand.getWorldPosition(m); FX.tracer(m, new THREE.Vector3(v.pos.x, v.pos.y + 1.2, v.pos.z)); Sfx.shot(false); v.setDead(); this.end('cranes'); } } }; } else this.end('cranes'); }
    else { // alone: Vane blocks the way out
      c.standoff = 0; STORY.hint('Get Eli out through the gate.');
    }
  },
  finaleUpdate(dt, ctx) {
    const c = ctx.m.c, P = Game.player, v = NPC.byKey('vane'); if (c.ended || c.plan !== 'alone') return;
    if (!v || !v.alive || v.downed) return this.end('gun');
    if (!c.standoff && (this.dist(P.pos, T_GATE) < 10 || c.fight)) { c.standoff = 1;
      if (c.fight) { v.tags.includes('ch5foe') || v.tags.push('ch5foe'); v.fightPlayer(); }
      else { v.state = 'scripted'; v.pos.set(T_GATE.x - 1, Col.ground(T_GATE.x - 1, T_GATE.z + 3, 99), T_GATE.z + 3); v.goTo = null; v.face(P.pos); v.say('Going somewhere, Miss Calloway?', 3); if (!Dialog.open) Dialog.start(v, this.vaneTree(v)); } }
    if (c.standoff && c.fight && !this.foes().length && !v.alive) this.end('gun');
  },
  vaneTree(v) {
    const ev = () => this.evidence();
    return { start: { text: () => S.decisions.ch4 === 'bought' ? 'Sunday came and went, Miss Calloway, and here you are stealing my surveyor. Two hundred dollars. Leave me your brother\'s papers and you can both ride out.' : 'You\'ve cost me a good deal of money. I\'ll make you an offer anyway: two hundred dollars and every scrap of your brother\'s papers. Then you both ride away and never come back.', choices: [
      { text: 'Take the money and hand over the papers', do: () => this.end('payout'), next: 'payout' },
      { text: '"It\'s over, Silas." (Draw)', do: () => this.duel(v), next: null },
      { text: ev() ? '"These papers go to a marshal." (Draw)' : '"No deal." (Draw)', do: () => this.duel(v), next: null },
    ] }, payout: { text: 'A sensible family at last. Go on, Eli. Your sister is waiting.' } };
  },
  duel(v) { const c = this.c(); c.fight = 1; if (!v.tags.includes('ch5foe')) v.tags.push('ch5foe'); v.say('So be it.', 2); v.fightPlayer(); for (const n of this.foes()) if (n !== v) { n.script = null; n.fightPlayer(); } },
  end(how) {
    const c = this.c(); if (c.ended) return; c.ended = how; S.decisions.ending = how; const v = NPC.byKey('vane');
    if (how === 'payout') { Inv.money(200, 'from Silas Vane'); for (const k of ['journal', 'journal_copy', 'vane_ledger']) while (Inv.count(k)) Inv.take(k); Rep.honor(-25, 'sold Eli\'s papers'); Rep.faction('railroad', 40); S.flags.railroad_wins = true; S.chars.vane = 'alive';
      for (const n of this.foes()) { n.state = 'scripted'; n.script = (dt, me) => { me.sp = 0; }; } if (!S.flags.eli_free) this.freeEli(); }
    if (how === 'law') { S.chars.vane = 'jailed'; Rep.honor(15, 'brought Vane to justice'); Rep.faction('town', 25); Rep.faction('railroad', -40); }
    if (how === 'cranes') { S.chars.vane = 'dead'; Rep.honor(-5); Rep.faction('crane', 40); Rep.faction('railroad', -40); }
    if (how === 'gun') { S.chars.vane = v && v.alive ? 'beaten' : 'dead'; Rep.honor(3); Rep.faction('railroad', -40); }
    if (v && v.alive && how !== 'payout') { v.state = 'scripted'; v.script = (dt, me) => { me.sp = 0; }; }
  },
  epilogue(how) {
    const greers = S.locations.farm === 'occupied';
    return { law: `Silas Vane rode to Cheyenne in irons. Eli's testimony and ${S.evidence.ledger ? 'Vane\'s own ledger' : 'his journal'} hanged the Halvorsen land scheme${greers ? ', and the Greers kept every acre' : ''}. ${S.chars.pike === 'turned' ? 'Amos Pike turned in his star and testified. He was never charged.' : ''}`,
      cranes: `The Cranes shot Silas Vane at his own gate and took the camp's payroll for their trouble. Eli came home. Nobody in Juniper Gap asked too many questions${greers ? ', and the Greers kept their land' : ''}.`,
      gun: `Wren Calloway killed Silas Vane at the gate of Survey Camp 3 and walked her brother home. Without Vane, the Halvorsen survey died in committee${greers ? ', and the Greers kept their land' : ''}.`,
      payout: 'Wren took two hundred dollars and burned her brother\'s papers in Vane\'s stove. The railroad came through the valley on Vane\'s maps. Eli has not spoken to her since.' }[how] || '';
  },
  complete(ctx) {
    const m = ctx.m, how = S.decisions.ending; S.chars.eli = how === 'payout' ? 'left' : 'home'; S.chapter = 6;
    m.outcome = { law: 'Vane arrested by Marshal Calder. Eli is free.', cranes: 'The Cranes executed Vane. Eli is free.', gun: 'Killed Silas Vane. Eli is free.', payout: 'Took Vane\'s $200 and handed over Eli\'s papers.' }[how] + (m.opt.quiet ? ' · got Eli out without an alarm' : '');
    const ep = this.epilogue(how); journal(ep, 'fate'); this.cleanup(); setTimeout(() => UI.banner('Epilogue', 'Hollow Pines', ep), 2600);
  },
  rewind(ctx) { ctx.rew = 1; ctx.m.stage = 0; ctx.m.c = {}; delete S.flags.eli_free; this.cleanup(); this.spawn(); UI.toast('Back on the trail to Tamarack Pass.', ''); }, // re-enter the first stage: camp and allies repopulated
};

Missions.def({ id: 'ch5', type: 'main', chapter: 5, title: 'The Ledger', giver: 'none', summary: 'Eli is held at Survey Camp 3, Tamarack Pass, up the trail north of Coyote Mill.',
  prereq: () => ['done', 'failed', 'unavailable'].includes(Missions.st('ch4').status),
  start: () => ({ x: T_TRAILHEAD.x, z: T_TRAILHEAD.z, y: Terrain.height(T_TRAILHEAD.x, T_TRAILHEAD.z) + 2.4 }),
  tick: (dt, m) => { if (m.status === 'available' && !Missions.active && !Missions.failing && CH5.dist(Game.player.pos, T_TRAILHEAD) < 10) Missions.start('ch5'); }, // RDR2-style: riding into the marker starts it
  stages: [
    { id: 'ride', text: 'Ride up the trail to Tamarack Pass.', enter: ctx => { if (ctx.resumed && !ctx.rew) return CH5.rewind(ctx); CH5.spawn(); },
      objectives: [O.goto('overlook', 'Ride to the overlook below Survey Camp 3', T_OVERLOOK.x, T_OVERLOOK.z, 9)] },
    { id: 'plan', text: 'Decide how to get Eli out.', enter: ctx => { if (ctx.resumed && !ctx.rew) return CH5.rewind(ctx); const l = CH5.lead(); if (!l) { CH5.choose('alone'); return; } l.say('Calloway! Over here.', 3); if (!Dialog.open) Dialog.start(l, CH5.council()); },
      objectives: [O.check('plan', 'Talk to your allies, or head in alone', c => !!c.m.c.plan, () => { const l = CH5.lead(); return l ? { x: l.pos.x, z: l.pos.z, y: l.pos.y + 2.4 } : null; })],
      update: (dt, ctx) => { if (!ctx.m.c.plan && CH5.dist(Game.player.pos, TAMARACK) < 34) CH5.choose('alone'); } },
    { id: 'camp', text: 'Get Eli out of Survey Camp 3.', enter: ctx => { if (ctx.resumed && !ctx.rew) return CH5.rewind(ctx); CH5.campEnter(ctx); },
      objectives: [O.check('eli', 'Free Eli from the survey tent', () => !!S.flags.eli_free, () => S.flags.eli_free ? null : { x: T_TENT.x, z: T_TENT.z + 2.6, y: Terrain.height(T_TENT.x, T_TENT.z) + 2.6 }),
        O.check('foes', () => `Defeat Vane's men (${CH5.foes().filter(n => n.key !== 'vane').length} left)`, () => !CH5.foes().filter(n => n.key !== 'vane').length, () => { const n = CH5.foes()[0]; return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.5, enemy: true } : null; }, { hide: c => c.m.c.plan === 'alone' }),
        O.check('quiet', 'Optional: free Eli without raising the alarm', c => S.flags.eli_free && !c.m.c.alarm, null, { optional: true, hide: c => c.m.c.plan !== 'alone' })],
      update: (dt, ctx) => CH5.campUpdate(dt, ctx), on: { alarm: (d, ctx) => { if (d.group === 'rail5') { ctx.m.c.alarm = 1; CH5.startFight(); } } },
      fail: [{ check: () => S.chars.eli === 'dead' || (NPC.byKey('eli') && !NPC.byKey('eli').alive), why: 'Eli is dead.' }],
      next: ctx => ctx.m.c.ended ? 'complete' : 'finale' },
    { id: 'finale', text: 'Settle it with Silas Vane.', enter: ctx => { if (ctx.resumed && !ctx.rew) return CH5.rewind(ctx); CH5.finaleEnter(ctx); },
      objectives: [O.check('end', () => CH5.c().plan === 'alone' ? (CH5.c().fight ? 'Stop Silas Vane' : 'Get Eli out through the gate') : CH5.c().plan === 'law' ? 'See Vane arrested' : 'Let the Cranes settle it', c => !!c.m.c.ended, () => { const v = NPC.byKey('vane'); return CH5.c().plan === 'alone' && !CH5.c().fight ? { x: T_GATE.x, z: T_GATE.z, y: Terrain.height(T_GATE.x, T_GATE.z) + 2.4 } : v && v.alive ? { x: v.pos.x, z: v.pos.z, y: v.pos.y + 2.4, enemy: CH5.c().fight } : null; })],
      update: (dt, ctx) => CH5.finaleUpdate(dt, ctx), on: { alarm: (d, ctx) => { if (d.group === 'rail5') { ctx.m.c.fight = 1; } } }, minTime: 1,
      fail: [{ check: () => NPC.byKey('eli') && !NPC.byKey('eli').alive, why: 'Eli is dead.' }] },
  ],
  complete: ctx => CH5.complete(ctx),
  cleanup: () => CH5.cleanup(),
  onFail: () => CH5.cleanup(),
  failOutcome: () => 'Eli was never seen again.',
});
