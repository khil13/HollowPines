/* ===== Interaction, law & witnesses, dialogue, mission framework ===== */
const Interact = {
  list: [], cur: null, opts: [],
  add(o) { o.on = o.on !== false; this.list.push(o); return o; },
  remove(o) { const i = this.list.indexOf(o); if (i >= 0) this.list.splice(i, 1); },
  update(p) {
    let best = null, bs = 1e9;
    if (!p.busy()) for (const o of this.list) {
      if (!o.on) continue; const pos = o.pos(); const d = Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z), r = o.r || 1.8; if (d > r || Math.abs((pos.y ?? p.pos.y) - p.pos.y) > 2.2) continue;
      const a = Math.atan2(pos.x - p.pos.x, pos.z - p.pos.z), face = Math.cos(angDiff(p.yaw, a)); const sc = d - face * 0.9 - (o.pri || 0);
      if (sc < bs) { const opts = o.opts(p).filter(Boolean); if (opts.length) { bs = sc; best = { o, opts }; } }
    }
    this.cur = best; this.opts = best ? best.opts.slice(0, 3) : [];
    if (p.state === 'ride') this.opts = this.opts.concat(Game.horse.rideOpts());
    if (Law.canSurrender()) this.opts.unshift({ label: 'Surrender', fn: () => Law.surrender() });
    this.opts = this.opts.slice(0, 3);
    UI.prompts(this.opts);
    const keys = ['e', 'g', 't'];
    for (let i = 0; i < this.opts.length; i++) if (Input.hit(keys[i])) { this.trigger(i); break; }
  },
  trigger(i) { const o = this.opts[i]; if (!o || o.disabled) return; o.fn(); Missions.emit('interact', {}); },
};

/* ---------- Law: crimes only matter if someone actually witnesses them ---------- */
const Law = {
  searchC: null, searchR: 70, seenT: 0, recogT: 0, lastCrimeT: -99,
  VALUES: { disturb: 3, theft: 5, trespass: 2, assault: 10, murder: 35, brandish: 3, breakin: 6, looting: 4, robbery: 15 },
  NAMES: { disturb: 'Disturbing the peace', theft: 'Theft', trespass: 'Trespassing', assault: 'Assault', murder: 'Murder', brandish: 'Threatening', breakin: 'Breaking in', looting: 'Looting a body', robbery: 'Robbery' },
  crime(type, pos, o = {}) {
    if (o.region === 'wild' && !NPC.all.some(n => n.alive && n.lawful && Math.hypot(n.pos.x - pos.x, n.pos.z - pos.z) < 30)) return [];
    S.stats.crimes++; const value = (this.VALUES[type] || 3) + (o.value || 0); const ws = [];
    for (const n of NPC.all) {
      if (!n.alive || n.downed || !n.lawful || n === o.victimSkip) continue;
      const dx = Game.player.pos.x - n.pos.x, dz = Game.player.pos.z - n.pos.z, d = Math.hypot(dx, dz);
      if (d > 32) continue;
      if (n.isAsleep && n.isAsleep()) { if (d < 2.5 && !Game.player.crouch) n.wake(); else continue; } // sleepers only notice you right beside them, standing
      const facing = Math.cos(angDiff(n.yaw, Math.atan2(dx, dz))) > -0.2; const dark = Sky.night() ? 0.6 : 1;
      const sees = (d < 5 || (facing && d < 28 * dark)) && Col.los(n.pos.x, n.pos.y + 1.5, n.pos.z, Game.player.pos.x, Game.player.pos.y + 1.2, Game.player.pos.z);
      const heard = o.noise && d < o.noise;
      if (sees || n === o.victim || (heard && sees)) ws.push(n);
      else if (heard) n.investigate(pos);
    }
    if (o.victim && o.victim.alive && !ws.includes(o.victim)) ws.push(o.victim);
    if (!ws.length) { UI.toast(`${this.NAMES[type]} · unseen`, ''); return ws; }
    UI.toast(`${this.NAMES[type]} witnessed`, 'bad'); Rep.honor(type === 'murder' ? -15 : type === 'assault' ? -5 : type === 'robbery' ? -8 : -3);
    for (const w of ws) w.witnessed({ type, value, pos: { x: pos.x, z: pos.z }, t: Game.time });
    this.lastCrimeT = Game.time; return ws;
  },
  report(by, c) {
    S.bounty = Math.round((S.bounty + c.value) * 100) / 100; S.wanted = true; this.searchC = { x: c.pos.x, z: c.pos.z }; this.searchR = 70; this.seenT = 0;
    UI.toast(`${by.name} reported you: ${this.NAMES[c.type]}. Bounty $${S.bounty.toFixed(2)}`, 'bad'); Rep.faction('town', -4); if (by.key) Rep.rel(by.key, -10);
    S.npcMem[by.key || by.name] = Object.assign(S.npcMem[by.key || by.name] || {}, { reported: true });
    for (const n of NPC.all) if (n.lawman && n.alive && !n.downed) n.pursue();
  },
  canSurrender() { return S.wanted && NPC.all.some(n => n.lawman && n.alive && !n.downed && n.seesPlayer && n.distP < 16); },
  surrender() {
    const pay = Math.min(S.money, S.bounty); if (pay > 0) Inv.money(-pay, 'fine paid'); UI.toast(S.money < 0.01 && pay < S.bounty ? 'You could not cover it all. A night in the cell squared it.' : 'Fine paid. Charges cleared.', '');
    S.bounty = 0; S.wanted = false; this.searchC = null; Rep.honor(-2, 'arrested');
    Sky.advance(6); Game.player.teleport(-22, 14.5, 0); for (const n of NPC.all) if (n.lawman) n.calm(); journal('Arrested in Juniper Gap. Paid what I owed and lost a night to it.');
  },
  payAtOffice() { if (S.bounty <= 0) return; if (S.money < S.bounty) { UI.toast(`Need $${S.bounty.toFixed(2)} to clear your bounty.`, 'bad'); return; } Inv.money(-S.bounty, 'bounty paid'); S.bounty = 0; UI.toast('Bounty cleared.', 'good'); },
  update(dt) {
    const P = Game.player;
    if (S.wanted) {
      let seen = false; for (const n of NPC.all) if (n.lawman && n.alive && !n.downed && n.seesPlayer) { seen = true; }
      if (seen) { this.seenT = 0; this.searchC = { x: P.pos.x, z: P.pos.z }; this.searchR = 55; } else { this.seenT += dt; this.searchR = Math.max(35, this.searchR - dt * 0.6); }
      const out = Math.hypot(P.pos.x - this.searchC.x, P.pos.z - this.searchC.z) > this.searchR;
      if (out && this.seenT > 6) { S.wanted = false; this.searchC = null; UI.toast(`You lost the law. Bounty of $${S.bounty.toFixed(2)} stands.`, ''); for (const n of NPC.all) if (n.lawman) n.calm(); Missions.emit('escaped', {}); }
    } else if (S.bounty > 0) {
      const lm = NPC.all.find(n => n.lawman && n.alive && !n.downed && n.seesPlayer && n.distP < 9);
      this.recogT = lm ? this.recogT + dt : Math.max(0, this.recogT - dt);
      if (this.recogT > 3) { this.recogT = 0; S.wanted = true; this.searchC = { x: P.pos.x, z: P.pos.z }; this.searchR = 55; UI.toast(`${lm.name} recognized you. Wanted!`, 'bad'); lm.say('Hold it! There\'s paper on you.'); for (const n of NPC.all) if (n.lawman) n.pursue(); }
    }
  }
};

/* ---------- Dialogue ---------- */
const Dialog = {
  open: false, tree: null, node: null, npc: null,
  start(npc, tree, id = 'start') { this.open = true; this.tree = tree; this.npc = npc; Input.uiOpen = true; if (document.pointerLockElement) document.exitPointerLock(); if (npc && npc.talkTo) npc.talkTo(); this.go(id); },
  go(id) {
    if (id == null) return this.close(); const n = typeof this.tree === 'function' ? this.tree(id) : this.tree[id]; if (!n) return this.close(); this.node = n; if (n.on) n.on();
    const name = n.who || (this.npc && this.npc.name) || ''; const txt = typeof n.text === 'function' ? n.text() : n.text;
    const choices = (n.choices || [{ text: 'Continue', next: n.next ?? null }]).filter(c => !c.hide || !c.hide());
    UI.dialog(name, txt, choices.map(c => { const ok = !c.cond || c.cond(); return { text: typeof c.text === 'function' ? c.text() : c.text, disabled: !ok, why: !ok ? (c.why || '') : '', fn: () => { if (c.do) c.do(); this.go(typeof c.next === 'function' ? c.next() : c.next); } }; }));
  },
  close() { this.open = false; this.node = null; Input.uiOpen = UI.panelOpen; UI.dialog(null); if (this.npc && this.npc.endTalk) this.npc.endTalk(); this.npc = null; },
  update() { if (!this.open) return; for (let i = 1; i <= 4; i++) if (Input.hit(String(i))) UI.pickChoice(i - 1); },
};

/* ---------- Mission framework ----------
  Mission def: { id, title, type: main|side|stranger|bounty|hunt, chapter, giver, summary, prereq(), lockedWhy(),
                 stages: [{ id, text, objectives:[Obj], enter(ctx), update(dt,ctx), fail:[{check(ctx), why}], next(ctx) }],
                 complete(ctx), failOutcome(ctx) }
  Obj helpers return {id, text, optional, check(ctx), marker()}. State lives in S.missions[id]. */
const O = {
  goto: (id, text, x, z, r = 10, o = {}) => Object.assign({ id, text, check: () => Math.hypot(Game.player.pos.x - x, Game.player.pos.z - z) < r && (!o.mounted || Game.player.state === 'ride'), marker: () => ({ x, z }) }, o),
  flag: (id, text, flag, marker, o = {}) => Object.assign({ id, text, check: () => !!S.flags[flag], marker }, o),
  talk: (id, text, who, flag, o = {}) => Object.assign({ id, text, check: () => !!S.flags[flag], marker: () => { const n = NPC.byKey(who); return n && n.alive ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; } }, o),
  item: (id, text, item, n = 1, marker, o = {}) => Object.assign({ id, text: () => `${typeof text === 'function' ? text() : text} (${Math.min(Inv.count(item), n)}/${n})`, check: () => Inv.count(item) >= n, marker }, o),
  clues: (id, text, list, marker, o = {}) => Object.assign({ id, text: () => `${text} (${list.filter(c => S.evidence[c]).length}/${list.length})`, check: () => list.every(c => S.evidence[c]), marker: () => { const c = Clues.find(k => list.includes(k.id) && !S.evidence[k.id]); return c ? { x: c.x, z: c.z, y: c.y + 1.2 } : null; } }, o),
  count: (id, text, key, n, marker, o = {}) => Object.assign({ id, text: (ctx) => `${text} (${Math.min(ctx.m.c[key] || 0, n)}/${n})`, check: ctx => (ctx.m.c[key] || 0) >= n, marker }, o),
  defeat: (id, text, tag, o = {}) => Object.assign({ id, text: () => { const g = NPC.all.filter(n => n.tags.includes(tag)); return `${text} (${g.filter(n => !n.alive || n.downed || n.fled).length}/${g.length})`; }, check: () => NPC.all.filter(n => n.tags.includes(tag)).every(n => !n.alive || n.downed || n.fled), marker: () => { const n = NPC.all.find(n => n.tags.includes(tag) && n.alive && !n.downed && !n.fled); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.5, enemy: true } : null; } }, o),
  check: (id, text, fn, marker, o = {}) => Object.assign({ id, text, check: fn, marker }, o),
};
const Missions = {
  defs: {}, order: [], active: null, ctx: null, retryState: null, banner: null,
  def(d) { this.defs[d.id] = d; this.order.push(d.id); },
  st(id) { return S.missions[id] || (S.missions[id] = { status: 'locked', stage: 0, c: {}, opt: {}, outcome: null }); },
  refresh() { // unlock missions whose prerequisites are met; fail ones whose world state no longer allows them
    for (const id of this.order) { const d = this.defs[id], m = this.st(id);
      if (m.status === 'locked' && (!d.prereq || d.prereq())) { m.status = 'available'; if (!this._silent) { UI.toast(`New ${d.type === 'main' ? 'story mission' : d.type + ' mission'}: ${d.title}`, 'good'); journal(`New lead: ${d.title}. ${d.summary}`, 'mission'); } }
      if ((m.status === 'available' || m.status === 'locked') && d.blocked && d.blocked()) { m.status = 'unavailable'; m.outcome = d.blocked(); journal(`${d.title}: ${m.outcome}`, 'mission'); }
    }
  },
  available(giver) { return this.order.filter(id => this.defs[id].giver === giver && this.st(id).status === 'available'); },
  start(id) {
    const d = this.defs[id], m = this.st(id); if (this.active && this.active !== id) this.abandon(false); // say so when another job pauses the current one
    if (Game.syncState) Game.syncState(); this.retryState = JSON.stringify(S); m.status = 'active'; m.stage = 0; m.c = {}; m.opt = {}; this.active = id; S.activeMission = id;
    this.ctx = { d, m, t: 0, st: 0 }; UI.banner(d.chapter ? `Chapter ${d.chapter}` : d.type.toUpperCase(), d.title); journal(`Started: ${d.title}`, 'mission');
    this.enterStage();
  },
  resume() { const id = S.activeMission; if (!id || this.st(id).status !== 'active') { this.active = null; return; } this.active = id; const d = this.defs[id], m = this.st(id); this.ctx = { d, m, t: 0, st: 0, resumed: true }; this.retryState = JSON.stringify(S); const s = d.stages[m.stage]; if (s.enter) s.enter(this.ctx); },
  enterStage() { const { d, m } = this.ctx; const s = d.stages[m.stage]; this.ctx.st = 0; if (s.enter) s.enter(this.ctx); if (s.text) UI.toast(s.text, ''); },
  emit(ev, data) { if (!this.ctx || !this.active) { this.globalEmit(ev, data); return; } const s = this.ctx.d.stages[this.ctx.m.stage]; if (s.on && s.on[ev]) s.on[ev](data, this.ctx); this.globalEmit(ev, data); },
  globalEmit(ev, data) { for (const id of this.order) { const d = this.defs[id]; if (d.world && d.world[ev]) d.world[ev](data, this.st(id)); } },
  objectives() { if (!this.ctx) return []; const s = this.ctx.d.stages[this.ctx.m.stage]; return (s.objectives || []).filter(o => !o.hide || !o.hide(this.ctx)); },
  update(dt) {
    for (const id of this.order) { const d = this.defs[id]; if (d.tick && this.st(id).status !== 'active') d.tick(dt, this.st(id)); }
    if (!this.active || this.failing) return; const ctx = this.ctx, { d, m } = ctx, s = d.stages[m.stage]; ctx.t += dt; ctx.st += dt;
    if (s.update) s.update(dt, ctx); if (!this.active || this.ctx !== ctx) return;
    for (const f of s.fail || []) if (f.check(ctx)) return this.fail(f.why);
    const objs = this.objectives(); let ok = true;
    for (const o of objs) { const done = o.check(ctx); if (o.optional) { if (done && !m.opt[o.id]) { m.opt[o.id] = true; UI.toast(`Optional done: ${typeof o.text === 'function' ? o.text(ctx) : o.text}`, 'good'); } } else if (!done) ok = false; }
    if (ok && (!s.minTime || ctx.st > s.minTime)) this.advance();
  },
  advance() { const ctx = this.ctx, { d, m } = ctx, s = d.stages[m.stage]; if (s.exit) s.exit(ctx); const nx = s.next ? s.next(ctx) : m.stage + 1; if (nx === 'complete' || nx >= d.stages.length) return this.complete(); m.stage = typeof nx === 'string' ? d.stages.findIndex(x => x.id === nx) : nx; this.enterStage(); },
  complete() { const { d, m } = this.ctx; m.status = 'done'; if (d.complete) d.complete(this.ctx); this.active = null; S.activeMission = null; this.ctx = null; UI.banner('Mission complete', d.title, m.outcome || ''); journal(`Completed: ${d.title}${m.outcome ? ' — ' + m.outcome : ''}`, 'mission'); this._silent = false; this.refresh(); World.apply(); Save.save(true); },
  fail(why) { if (!this.ctx || this.failing) return; const { d, m } = this.ctx; this.failing = { id: d.id, why }; UI.failScreen(d.title, why); },
  retry() { // back to the start of the mission: clean up this run, and never re-enter a mid-mission stage from a loaded save
    if (UI.panelOpen) UI.close(true); const id = this.failing.id, d = this.defs[id]; if (this.ctx && d.cleanup) d.cleanup(this.ctx); this.failing = null; this.active = null; this.ctx = null;
    const st = JSON.parse(this.retryState); st.activeMission = null; if (st.missions && st.missions[id]) Object.assign(st.missions[id], { status: 'available', stage: 0 }); Save.apply(st); this.start(id); },
  acceptFail() { if (UI.panelOpen) UI.close(true); const id = this.failing.id, d = this.defs[id], m = this.st(id); this.failing = null; m.status = 'failed'; m.outcome = d.failOutcome ? d.failOutcome(this.ctx) : 'Failed'; if (d.onFail) d.onFail(this.ctx); if (d.cleanup) d.cleanup(this.ctx); m.status = 'failed'; this.active = null; S.activeMission = null; this.ctx = null; journal(`Failed: ${d.title} — ${m.outcome}`, 'mission'); this.refresh(); World.apply(); Save.save(true); },
  abandon(silent) { if (!this.active) return; const m = this.st(this.active); m.status = 'available'; m.stage = 0; if (this.ctx.d.cleanup) this.ctx.d.cleanup(this.ctx); if (!silent) UI.toast(`Mission paused: ${this.ctx.d.title}. Restart it from the giver.`, ''); this.active = null; S.activeMission = null; this.ctx = null; World.apply(); },
  markers() { const out = []; if (this.active) { for (const o of this.objectives()) { if (o.optional && this.ctx.m.opt[o.id]) continue; if (!o.optional && o.check(this.ctx)) continue; const mk = o.marker && o.marker(); if (mk) out.push(mk); } } else { for (const id of this.order) { const d = this.defs[id]; if (this.st(id).status === 'available' && d.start) { const p = d.start(); if (p) out.push(Object.assign({ giver: true }, p)); } } } return out; },
};
