/* ===== Items, persistent world state, inventory, save/load ===== */
const ITEMS = {
  beans: { name: 'Canned beans', cat: 'food', price: 2, eat: { hp: 35, core: 30 }, col: '#b5651d', d: 'Restores health.' },
  coffee: { name: 'Coffee', cat: 'food', price: 1.5, eat: { st: 60, core: 10 }, col: '#4b3621', d: 'Restores stamina.' },
  apple: { name: 'Apple', cat: 'food', price: 0.75, eat: { hp: 10, core: 10 }, horse: 8, col: '#c8443a', d: 'Snack. Horses love them.' },
  carrot: { name: 'Carrot', cat: 'food', price: 0.5, eat: { hp: 6 }, horse: 6, col: '#e8833a', d: 'Horse treat.' },
  oats: { name: 'Sack of oats', cat: 'horse', price: 3, horse: 25, col: '#d9c58f', d: 'Fills a horse up and builds trust.' },
  berries: { name: 'Huckleberries', cat: 'food', sell: 0.5, eat: { hp: 8, core: 5 }, col: '#5b4a9c', d: 'Gathered from bushes.' },
  sage: { name: 'Blue sage', cat: 'herb', sell: 0.6, col: '#7fa7a0', d: 'Herb for tonics.' },
  meat_raw: { name: 'Raw venison', cat: 'food', sell: 2, eat: { hp: 5, sick: 1 }, cook: 'meat_cooked', col: '#a33', d: 'Cook it at a campfire.' },
  meat_cooked: { name: 'Seasoned venison', cat: 'food', sell: 3, eat: { hp: 60, core: 50, st: 30 }, col: '#8b4a2b', d: 'Hearty. Restores a lot.' },
  game_raw: { name: 'Small game meat', cat: 'food', sell: 1, cook: 'game_cooked', col: '#b55', d: 'Cook it at a campfire.' },
  game_cooked: { name: 'Roast rabbit', cat: 'food', sell: 1.5, eat: { hp: 30, core: 30 }, col: '#9a5a33', d: 'Restores health.' },
  fish_raw: { name: 'Raw trout', cat: 'food', sell: 1.5, cook: 'fish_cooked', col: '#7ea6b8', d: 'Cook it at a campfire.' },
  fish_cooked: { name: 'Grilled trout', cat: 'food', sell: 2, eat: { hp: 40, core: 35 }, col: '#c49a6c', d: 'Restores health.' },
  tonic: { name: 'Sage tonic', cat: 'food', price: 6, sell: 3, eat: { hp: 100, st: 100, core: 40 }, col: '#4f9c8a', d: 'Craft: 1 blue sage + 2 huckleberries.' },
  pelt_deer: { name: 'Deer pelt', cat: 'pelt', sell: 9, col: '#a0794f', d: 'Sells well at the store.' },
  pelt_rabbit: { name: 'Rabbit pelt', cat: 'pelt', sell: 2.5, col: '#cfc2a8', d: 'Small but useful.' },
  pelt_wolf: { name: 'Wolf pelt', cat: 'pelt', sell: 8, col: '#777', d: 'Thick winter fur.' },
  ammo_rev: { name: 'Revolver cartridges', cat: 'ammo', price: 2, pack: 12, col: '#c9a227', d: 'Box of 12.' },
  ammo_rifle: { name: 'Rifle cartridges', cat: 'ammo', price: 3, pack: 10, col: '#9b7b1e', d: 'Box of 10.' },
  watch: { name: 'Pocket watch', cat: 'valuable', sell: 8, col: '#e9c46a', d: 'Someone will miss this.' },
  ring: { name: 'Silver ring', cat: 'valuable', sell: 12, col: '#cfd8dc', d: 'Engraved: "N.G."' },
  gold: { name: 'Gold nugget', cat: 'valuable', sell: 25, col: '#e9c46a', d: 'Heavy and bright.' },
  brush: { name: 'Horse brush', cat: 'tool', col: '#8d6e63', d: 'Groom your horse.' },
  rod: { name: 'Fishing rod', cat: 'tool', price: 6, col: '#6d8b5a', d: 'Fish at the river.' },
  kit: { name: 'Camp kit', cat: 'tool', col: '#6b4a2f', d: 'Make camp in the wild.' },
  shovel: { name: 'Shovel', cat: 'tool', price: 4, col: '#888', d: 'Dig where the map says.' },
  // story items
  strongbox: { name: "Mae's strongbox", cat: 'quest', carry: true, col: '#5a4a3a', d: 'Heavy. Carry it or stow it on your horse.' },
  eli_page: { name: "Eli's survey page", cat: 'quest', col: '#f4ead3', d: 'A survey grid of the valley, marked in Eli\'s hand.' },
  journal: { name: "Eli's field journal", cat: 'quest', col: '#6b3e1f', d: 'Eli\'s notes on the railroad\'s land scheme.' },
  journal_copy: { name: 'Copied journal pages', cat: 'quest', col: '#cfc3a6', d: 'Mae copied the key pages for you.' },
  letter: { name: "Eli's letter to Mae", cat: 'quest', col: '#e8dcc0', d: 'Unsent. Mentions "the cave above the cabin."' },
  deed: { name: 'Greer homestead deed', cat: 'quest', col: '#efe1bd', d: 'Proof the Greers own their land.' },
  vane_ledger: { name: "Vane's ledger", cat: 'quest', col: '#5a3a22', d: 'Payments to Sheriff Pike and the Crane gang, in Silas Vane\'s own hand.' },
  hank_map: { name: "Hank's claim map", cat: 'quest', col: '#d6c49a', d: 'An X near Lookout Ridge.' },
};
const OUTFITS = { duster: { name: 'Trail duster', price: 0, shirt: '#4f7ca8', coat: '#8a6a4a', hat: '#6b4a2f' }, poncho: { name: 'Red poncho', price: 15, shirt: '#b23a2e', coat: '#c8443a', hat: '#3b2a1e' }, vest: { name: 'Town vest', price: 10, shirt: '#e6dcc5', coat: null, vest: '#2f4f4f', hat: '#2b2b2b' } };
const UPGRADES = { barrel: { name: 'Long revolver barrel', price: 20, d: '+25% revolver damage and range.' }, rifle: { name: 'Bolt rifle', price: 45, d: 'Long-range rifle for hunting.' }, saddle: { name: 'Cartwright saddle', price: 30, d: '+30 horse stamina, faster recovery.' }, satchel: { name: 'Leather satchel', price: 12, d: 'Carry 2x stacks of food and herbs.' } };

function freshState() {
  return {
    v: 3, time: { day: 1, hour: 8.0 }, weather: { kind: 'clear', t: 0, next: 5 },
    money: 12, honor: 0, bounty: 0, wanted: false,
    inv: { beans: 2, coffee: 1, apple: 3, ammo_rev: 18, brush: 1, kit: 1, rod: 1 },
    outfit: 'duster', owned: { duster: 1 }, upgrades: {}, weapons: { fists: 1, revolver: 1 }, ammoClip: { revolver: 6, rifle: 5 },
    p: { x: 16, z: 15, yaw: -Math.PI / 2, hp: 100, st: 100, hpCore: 80, stCore: 80, maxHp: 100, maxSt: 100, xpHp: 0, xpSt: 0 },
    h: { x: 16.3, z: 16.9, yaw: -Math.PI / 2, hp: 100, st: 100, bond: 6, dirt: 0.2, bags: { oats: 1 }, name: 'Biscuit', fed: 60, called: false },
    flags: {}, decisions: {}, evidence: {}, discovered: {}, containers: {}, gathered: {}, npcMem: {}, log: [],
    rel: { mae: 10, pike: 0, ezra: 0, dutchy: -10, fenwick: -20, hank: 0, cora: 0, doc: 0 },
    factions: { town: 0, crane: -20, railroad: 0, greer: 0 },
    chars: { eli: 'missing', fenwick: 'alive', dutchy: 'alive', rook: 'alive', ezra: 'home', nell: 'home', mae: 'alive', pike: 'alive', brock: 'alive' },
    locations: { farm: 'occupied', mill: 'gang', cabin: 'abandoned' },
    missions: {}, camps: {}, chapter: 1, stats: { kills: 0, pelts: 0, fish: 0, crimes: 0, distance: 0 }, camp: null, carry: null, horseCarry: null,
  };
}
let S = freshState();

const Inv = {
  count(id) { return S.inv[id] || 0; },
  add(id, n = 1, quiet) { S.inv[id] = (S.inv[id] || 0) + n; if (!quiet) UI.toast(`+${n > 1 ? n + ' ' : ''}${ITEMS[id]?.name || id}`, 'good'); Missions.emit('item', { id, n }); },
  take(id, n = 1) { if ((S.inv[id] || 0) < n) return false; S.inv[id] -= n; if (S.inv[id] <= 0) delete S.inv[id]; return true; },
  money(d, why) { S.money = Math.round((S.money + d) * 100) / 100; if (d > 0) Sfx.coin(); if (why) UI.toast(`${d > 0 ? '+' : '−'}$${Math.abs(d).toFixed(2)} ${why}`, d > 0 ? 'good' : ''); },
  priceMul() { let m = 1; if (S.honor >= 40) m *= 0.9; if (S.honor <= -40) m *= 1.15; if (S.decisions.m1_box === 'skimmed') m *= 1.2; if (S.decisions.m3_side === 'greer') m *= 0.95; return m; },
};

/* Relationships & reputation: one place that changes them, so every change is logged and saved */
const Rep = {
  rel(who, d, why) { S.rel[who] = clamp((S.rel[who] || 0) + d, -100, 100); if (why) UI.toast(`${NPCNAMES[who] || who}: ${why}`, d > 0 ? 'good' : 'bad'); },
  honor(d, why) { S.honor = clamp(S.honor + d, -100, 100); UI.toast(`Honor ${d > 0 ? '+' : '−'}${Math.abs(d)}${why ? ' · ' + why : ''}`, d > 0 ? 'good' : 'bad'); },
  faction(f, d) { S.factions[f] = clamp(S.factions[f] + d, -100, 100); },
  mood(who) { const r = S.rel[who] || 0; return r >= 40 ? 'friend' : r >= 10 ? 'warm' : r > -20 ? 'neutral' : r > -50 ? 'cold' : 'hostile'; },
};
const NPCNAMES = { mae: 'Mae Holloway', pike: 'Sheriff Pike', ezra: 'Ezra Greer', nell: 'Nell Greer', dutchy: 'Dutchy Moss', fenwick: 'Fenwick Crane', hank: 'Hank Dorsey', cora: 'Cora Vance', doc: 'Doc Pell', lyle: 'Deputy Bramble', brock: 'Brock Harlan', rook: 'Rook Malloy', ida: 'Ida Fairweather', sal: 'Sal', vane: 'Silas Vane' };

function journal(text, kind = 'note') { S.log.unshift({ d: S.time.day, h: Math.floor(S.time.hour), text, kind }); if (S.log.length > 80) S.log.length = 80; }

const Save = {
  KEY: 'hollowpines_save_v3', // autosave slot; manual slots use KEY + '_' + n
  key(slot) { return !slot || slot === 'auto' ? this.KEY : this.KEY + '_' + slot; },
  snapshot() { Game.syncState(); S.savedAt = Date.now(); return JSON.stringify(S); },
  save(quiet, slot) { try { localStorage.setItem(this.key(slot), this.snapshot()); if (!quiet) UI.toast(slot && slot !== 'auto' ? `Saved to slot ${slot}` : 'Game saved', 'good'); if (UI.panelOpen) UI.render(); return true; } catch (e) { UI.toast('Could not save: browser storage is blocked here.', 'bad'); return false; } },
  meta(slot) { try { const j = localStorage.getItem(this.key(slot)); if (!j) return null; const d = JSON.parse(j); return { day: d.time.day, ch: d.chapter, money: d.money, at: d.savedAt || 0 }; } catch (e) { return null; } },
  slots() { return ['auto', 1, 2, 3].map(id => ({ id, meta: this.meta(id) })); },
  latest() { let best = null; for (const sl of this.slots()) if (sl.meta && (!best || sl.meta.at > best.meta.at)) best = sl; return best; },
  has() { return !!this.latest(); },
  load(slot) { try { if (slot === undefined) { const l = this.latest(); if (!l) return false; slot = l.id; } const j = localStorage.getItem(this.key(slot)); if (!j) return false; this.apply(JSON.parse(j)); UI.toast('Game loaded', 'good'); return true; } catch (e) { UI.toast('Save could not be read.', 'bad'); return false; } },
  apply(data) { S = Object.assign(freshState(), data); Game.restoreFromState(); },
};
