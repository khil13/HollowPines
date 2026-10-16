/* ===== Camps: traveler camps and outlaw hideouts (RDR2-style) =====
   Traveler camps: trappers work nearby by day, sit at the fire in the evening and sleep at night. They're lawful:
   greet them, ask about the area, or rob them. Sneak in crouched to loot satchels and the lockbox; standing up or
   walking close wakes a sleeper, and whoever sees a crime witnesses it (bounty, honor) through the normal law
   system. Aiming at someone until their hands go up lets you rob them.
   Outlaw hideouts: sentries patrol, the rest sit at the fire facing inward. Take them out quietly or loudly; once
   everyone is down the hideout is cleared and the lockbox is safe to break open. Killing outlaws costs no honor.
   A cleared hideout is reoccupied after REOCCUPY days. State lives in S.camps. */
const Camps = {
  REOCCUPY: 5,
  st(id) { return S.camps[id] || (S.camps[id] = {}); },
  isCleared(id) { const c = S.camps[id]; return !!(c && c.cleared !== undefined && S.time.day < c.cleared + this.REOCCUPY); },
  members(id) { return NPC.all.filter(n => n.tags.includes('camp_' + id)); },
  def(id) { return CAMPS.find(c => c.id === id); },

  /* ---------- props (built once with the world) ---------- */
  build() { for (const c of CAMPS) { c.y = Terrain.height(c.x, c.z); this.props(c); } },
  props(c) {
    const sc = Game.scene, at = (dx, dz) => ({ x: c.x + dx, z: c.z + dz, y: Terrain.height(c.x + dx, c.z + dz) });
    const G = (dx, dz, yaw = 0) => { const p = at(dx, dz), g = new THREE.Group(); g.position.set(p.x, p.y, p.z); g.rotation.y = yaw; sc.add(g); return g; };
    World.campfire(c.x, c.z, c.type === 'outlaw');
    // log benches around the fire (seat height matches the sitting animation)
    for (const s of c.seats) { const g = G(s.dx, s.dz, s.yaw); const log = M(GEO.cyl, '#7a5a3c', 0.23, 1.6, 0.23, 0, 0.23, 0); log.rotation.z = Math.PI / 2; g.add(log); const p = at(s.dx, s.dz);
      const cs = Math.abs(Math.cos(s.yaw)), sn = Math.abs(Math.sin(s.yaw)); Col.box(p.x - (cs * 0.8 + sn * 0.25), p.x + (cs * 0.8 + sn * 0.25), p.z - (sn * 0.8 + cs * 0.25), p.z + (sn * 0.8 + cs * 0.25), p.y - 1, p.y + 0.46, { walk: true, block: true }); }
    for (const t of c.tents) { const g = G(t.dx, t.dz, t.yaw || 0); const cone = M(GEO.cone, t.col || '#d9c58f', 1.7, 1.9, 1.7, 0, 0.95, 0); cone.geometry = new THREE.ConeGeometry(1, 1, 4); g.add(cone); const p = at(t.dx, t.dz); Col.circle(p.x, p.z, 1.2, p.y - 1, p.y + 1.9, { block: true, cover: true }); }
    for (const b of c.beds) { const g = G(b.dx, b.dz, b.yaw || 0); g.add(M(GEO.box, '#5a6e8a', 0.85, 0.12, 1.9, 0, 0.06, 0)); g.add(M(GEO.box, '#e6dcc5', 0.6, 0.14, 0.35, 0, 0.12, -0.72)); }
    for (const k of c.crates || []) { const g = G(k.dx, k.dz, k.yaw || 0); g.add(M(GEO.box, '#8b6a47', 1.2, 1.0, 0.9, 0, 0.5, 0)); const p = at(k.dx, k.dz); Col.box(p.x - 0.65, p.x + 0.65, p.z - 0.65, p.z + 0.65, p.y - 1, p.y + 1.0, { walk: true, block: true, cover: true }); }
    if (c.rack) { const g = G(c.rack.dx, c.rack.dz, c.rack.yaw); for (const s of [-1, 1]) g.add(M(GEO.box, '#6b4a2f', 0.1, 1.6, 0.1, s * 0.8, 0.8, 0)); g.add(M(GEO.box, '#6b4a2f', 1.8, 0.08, 0.08, 0, 1.55, 0)); g.add(M(GEO.box, '#a0794f', 0.7, 0.9, 0.05, -0.35, 1.05, 0)); g.add(M(GEO.box, '#cfc2a8', 0.45, 0.6, 0.05, 0.45, 1.15, 0)); }
    // containers: owned ones (travelers) are theft; the outlaw lockbox is free loot but loud to break while the gang is around
    for (const k of c.loot) { const p = at(k.dx, k.dz), g = G(k.dx, k.dz, k.yaw || 0);
      if (k.kind === 'lockbox') { g.add(M(GEO.box, '#4a3a2a', 0.6, 0.4, 0.42, 0, 0.2, 0)); g.add(M(GEO.box, '#c9a227', 0.62, 0.05, 0.44, 0, 0.33, 0)); g.add(M(GEO.box, '#2b2b2b', 0.1, 0.12, 0.04, 0, 0.22, 0.22)); }
      else { g.add(M(GEO.sph, '#7a5232', 0.28, 0.22, 0.2, 0, 0.18, 0)); g.add(M(GEO.box, '#5a3a20', 0.32, 0.05, 0.22, 0, 0.36, 0)); }
      container({ id: `${c.id}_${k.kind}`, label: k.kind === 'lockbox' ? (c.type === 'outlaw' ? 'gang lockbox' : 'lockbox') : 'satchel', x: p.x, z: p.z, y: p.y, owner: c.type === 'traveler' ? c.members[0].key : null,
        loot: k.items, money: k.money, restock: k.restock || this.REOCCUPY, onLoot: () => this.looted(c, k, p) }); }
    // places for the travelers' daily routine
    if (c.type === 'traveler') { c.members.forEach((m, i) => { const s = c.seats[i], b = c.beds[i];
      place(`${c.id}_fire${i}`, c.x + s.dx, c.z + s.dz, s.yaw, 'sit', { clip: i ? 'Sitting_Idle_Loop' : 'Sitting_Talking_Loop' });
      place(`${c.id}_bed${i}`, c.x + b.dx, c.z + b.dz, (b.yaw || 0) + Math.PI, 'sleep');
      const w = m.work; place(`${c.id}_work${i}`, c.x + w.dx, c.z + w.dz, w.yaw, 'work', { clip: w.clip }); }); }
  },
  looted(c, k, p) {
    if (c.type === 'outlaw' && !this.isCleared(c.id)) { // prying a lockbox open is loud: nearby outlaws get suspicious
      for (const n of this.members(c.id)) if (n.alive && !n.downed && n.state === 'patrol' && Math.hypot(n.pos.x - p.x, n.pos.z - p.z) < 16) { n.alert = Math.min(1, (n.alert || 0) + 0.6); n.lastSeen = { x: p.x, z: p.z }; n.say('What was that?', 2); }
    }
    if (c.type === 'traveler') { this.st(c.id).robbed = S.time.day; }
    Missions.emit('campLoot', { id: c.id, kind: k.kind });
  },

  /* ---------- people ---------- */
  configs(c) {
    if (c.type === 'traveler') return c.members.map((m, i) => ({ key: m.key, name: m.name, x: c.x + c.seats[i].dx, z: c.z + c.seats[i].dz, look: m.look, brave: m.brave, gun: m.gun || null, hp: 100, maxHp: 100,
      tags: ['generic', 'camp', 'camp_' + c.id, 'traveler'], wild: true, region: 'wild', lawful: true,
      schedule: [[6, 9, `${c.id}_fire${i}`], [9, 18, `${c.id}_work${i}`], [18, 22, `${c.id}_fire${i}`], [22, 6, `${c.id}_bed${i}`]],
      talk: n => this.talkTraveler(n, c), greetLine: () => S.npcMem[m.key] && S.npcMem[m.key].robbed ? 'You. Get away from our camp.' : null }));
    return c.members.map(m => ({ key: m.key, name: m.name, x: c.x + m.dx, z: c.z + m.dz, look: m.look, lawful: false, group: 'camp_' + c.id, state: 'patrol', gun: m.gun || 'revolver', hp: 80, maxHp: 80,
      accuracy: 0.38, dmg: 12, fleeHp: m.fleeHp || 0, sense: m.sitter ? 0.75 : 1, tags: ['generic', 'camp', 'camp_' + c.id, 'outlaw'], wild: true,
      route: m.route ? m.route.map(([dx, dz, wait]) => ({ x: c.x + dx, z: c.z + dz, wait })) : [{ x: c.x + m.dx, z: c.z + m.dz, wait: 1e9 }],
      sitter: m.sitter ? { x: c.x + m.dx, z: c.z + m.dz, yaw: m.yaw, clip: 'Sitting_Talking_Loop' } : null, cond: () => !this.isCleared(c.id) }));
  },
  apply() { // spawn whoever should be at each camp (after a load, a new day, or when a hideout is reoccupied)
    for (const c of CAMPS) {
      if (c.type === 'outlaw' && this.isCleared(c.id)) continue;
      if (c.type === 'outlaw' && S.camps[c.id] && S.camps[c.id].cleared !== undefined) { delete S.camps[c.id].cleared; journal(`Word is ${c.name} has new occupants.`); }
      for (const cfg of this.configs(c)) if (!NPC.byKey(cfg.key)) NPC.spawn(cfg);
    }
  },
  update(dt) {
    this.t = (this.t || 0) - dt; if (this.t > 0) return; this.t = 0.5;
    for (const c of CAMPS) {
      if (c.type !== 'outlaw' || this.isCleared(c.id)) continue; const ms = this.members(c.id); if (!ms.length) continue;
      if (ms.every(n => !n.alive || n.downed || n.fled)) { this.st(c.id).cleared = S.time.day; UI.banner('Hideout cleared', c.name, 'The lockbox is yours.'); journal(`Cleared ${c.name}. Nobody left to stop me opening their lockbox.`); Missions.emit('campCleared', { id: c.id }); }
    }
  },
  talkTraveler(n, c) {
    const robbed = S.npcMem[n.key] && S.npcMem[n.key].robbed, hide = CAMPS.find(k => k.type === 'outlaw');
    return { start: { text: () => robbed ? 'I remember your face. Say your piece and move along.' : STORY.smalltalk(n, [c.line, 'Pelts are thin this season. Wolves are taking the deer.', 'Sit by the fire if you like. Just keep your hands where I can see them.']), choices: [
      { text: 'Ask about the area', hide: () => !!robbed, next: 'area' },
      { text: 'Goodbye', next: null }] },
      area: { text: `Crane boys have a camp at ${hide.name}, east past the old mill. Keep clear unless you're looking for a fight.`, on: () => { if (!S.discovered[hide.id]) { S.discovered[hide.id] = true; journal(`${n.name} says the Crane gang camps at ${hide.name}, east of Coyote Mill.`); UI.toast(`${hide.name} marked on your map`, 'good'); } } } };
  },
};

/* camp layouts: positions relative to the fire; seats face the fire */
const TRAPPER_LOOK = { skin: '#d9a07a', shirt: '#7a5232', coat: '#6b4a2f', hair: '#5a3a20', beard: '#5a3a20', hatColor: '#4a3b30' };
CAMPS.forEach(c => {
  if (c.id === 'camp_teague') Object.assign(c, { name: "Teague's Camp", type: 'traveler', line: 'Trapping the creeks till the snow comes, then selling in Juniper Gap.',
    seats: [{ dx: -1.9, dz: 0, yaw: Math.PI / 2 }, { dx: 1.9, dz: 0, yaw: -Math.PI / 2 }], tents: [{ dx: 0, dz: -4.6 }], beds: [{ dx: -1.2, dz: -2.8 }, { dx: 1.2, dz: -2.8 }],
    rack: { dx: -4.2, dz: 3.2, yaw: 0.4 },
    members: [{ key: 'amos_teague', name: 'Amos Teague', look: TRAPPER_LOOK, brave: 0.65, gun: 'rifle', work: { dx: -4.0, dz: 2.0, yaw: 0.4, clip: 'Fixing_Kneeling' } },
              { key: 'june_teague', name: 'June Teague', look: { skin: '#f0c4a0', shirt: '#8a5a5a', apron: '#cfc3a6', hair: '#7a4a2a', longHair: true, hat: false }, brave: 0.35, work: { dx: 3.5, dz: 2.6, yaw: -2.2, clip: 'Farm_Harvest' } }],
    loot: [{ kind: 'lockbox', dx: 3.0, dz: -2.6, yaw: -0.4, money: 11, items: [['watch', 1]] }, { kind: 'satchel', dx: -2.3, dz: -3.4, money: 3, items: [['pelt_rabbit', 2], ['beans', 1]] }] });
  if (c.id === 'camp_holt') Object.assign(c, { name: 'Holt Hunting Camp', type: 'traveler', line: "Elk up on the ridge, if you've the patience. I don't, some days.",
    seats: [{ dx: 0, dz: -1.9, yaw: 0 }, { dx: 0, dz: 1.9, yaw: Math.PI }], tents: [{ dx: 4.4, dz: 0, col: '#c9b18b' }], beds: [{ dx: 2.6, dz: -1.4, yaw: Math.PI / 2 }, { dx: 2.6, dz: 1.4, yaw: Math.PI / 2 }],
    rack: { dx: -3.8, dz: -3.5, yaw: -0.6 },
    members: [{ key: 'wes_holt', name: 'Wes Holt', look: { skin: '#c98a62', shirt: '#4a6a4a', vest: '#3b2a1e', hair: '#1b1b1b', mustache: '#1b1b1b', hatColor: '#3b2a1e' }, brave: 0.7, gun: 'rifle', work: { dx: -3.4, dz: -2.4, yaw: -0.6, clip: 'Fixing_Kneeling' } },
              { key: 'caleb_holt', name: 'Caleb Holt', look: { skin: '#e8b48c', shirt: '#9a7b4f', hair: '#a0522d', hatColor: '#8b7d6b', scale: 0.92 }, brave: 0.3, work: { dx: -3.2, dz: 2.8, yaw: -2.4, clip: 'Farm_Harvest' } }],
    loot: [{ kind: 'lockbox', dx: 4.2, dz: -2.4, yaw: 0.3, money: 9, items: [['ammo_rifle', 10]] }, { kind: 'satchel', dx: 2.2, dz: 2.6, money: 2, items: [['meat_raw', 2], ['pelt_deer', 1]] }] });
  if (c.id === 'camp_rattlesnake') Object.assign(c, { name: 'Rattlesnake Hollow', type: 'outlaw',
    seats: [{ dx: -2.0, dz: 0.3, yaw: Math.PI / 2 }, { dx: 2.0, dz: -0.3, yaw: -Math.PI / 2 }, { dx: 0.2, dz: 2.1, yaw: Math.PI }],
    tents: [{ dx: -4.5, dz: -4.2, col: '#a0794f' }, { dx: 4.6, dz: -4.0, col: '#a0794f' }], beds: [{ dx: -2.6, dz: -4.6 }, { dx: 2.6, dz: -4.6 }],
    crates: [{ dx: -6.5, dz: 2.5 }, { dx: 6.2, dz: 3.0 }, { dx: 0.5, dz: -6.8 }, { dx: -2.5, dz: 6.6 }],
    members: [
      { key: 'rs_vic', name: 'Vic Dunn', dx: -2.0, dz: 0.3, yaw: Math.PI / 2, sitter: true, look: { skin: '#d9a07a', shirt: '#5a2a2a', hair: '#2b1d14', mustache: '#2b1d14', hatColor: '#1b1b1b', stout: 1.1 } },
      { key: 'rs_moe', name: 'Moe Sutter', dx: 2.0, dz: -0.3, yaw: -Math.PI / 2, sitter: true, gun: 'rifle', look: { skin: '#b07a55', shirt: '#4a4a3a', hair: '#1b1b1b', hatColor: '#4a3b30' } },
      { key: 'rs_tad', name: 'Tad Pryor', dx: -10, dz: -10, fleeHp: 20, route: [[-10, -10, 6], [10, -10, 4], [10, 9, 6], [-10, 9, 4]], look: { skin: '#e8b48c', shirt: '#6b6b4a', hair: '#6b4a2f', hatColor: '#3b2a1e' } },
      { key: 'rs_gus', name: 'Gus Ketter', dx: 12, dz: 6, route: [[12, 6, 8], [12, -8, 8]], look: { skin: '#e2a57c', shirt: '#3b3b5b', hair: '#3b2a1e', beard: '#3b2a1e', hatColor: '#2b2b2b' } }],
    loot: [{ kind: 'lockbox', dx: 0.6, dz: -4.4, yaw: 0, money: 22, items: [['gold', 1], ['ammo_rev', 12]] }] });
});
