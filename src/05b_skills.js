/* ===== Character development: Wren gets better at what she does. Four skills (Gunslinger, Brawler, Survivalist,
   Horseman) earn experience from doing the thing itself, and each level from II to V unlocks a perk that changes play.
   Honor shows as a standing in the world (Outlaw ... Hero of the Gap), and the Wren tab in the satchel shows it all. */
const SKILLS = {
  gun: { name: 'Gunslinger', how: 'hits, headshots and disarms', perks: ['Steady aim: tighter spread', 'Quick hands: faster reloads', 'Dead shot: +20% headshot damage', 'Cool head: aim settles twice as fast after a shot'] },
  brawl: { name: 'Brawler', how: 'punches, counters and grabs', perks: ['Heavy hands: +15% punch damage', 'Read the swing: a wider window to counter', 'Second wind: punches cost less stamina', 'Iron grip: hold a grab longer, shoves hit twice as hard'] },
  survive: { name: 'Survivalist', how: 'hunting, fishing and foraging', perks: ['Light step: animals notice you later', 'Forager: an extra herb or berry when gathering', 'Skinner: extra meat from every carcass', 'Hardy: health and stamina cores drain slower'] },
  ride: { name: 'Horseman', how: 'riding and horse care', perks: ['Easy rider: your horse tires slower at a gallop', 'Trusted: bond grows half again as fast', 'Saddle shot: steadier aim on horseback', 'Spurs: a faster gallop'] },
};
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const Skills = {
  XP: [0, 25, 70, 140, 240], // experience needed for levels I..V
  st() { return S.skills || (S.skills = { gun: 0, brawl: 0, survive: 0, ride: 0 }); },
  lv(k) { const x = this.st()[k] || 0; let l = 1; for (let i = 1; i < this.XP.length; i++) if (x >= this.XP[i]) l = i + 1; return l; },
  has(k, level) { return this.lv(k) >= level; },
  next(k) { const l = this.lv(k); return l >= this.XP.length ? null : this.XP[l]; },
  gain(k, n) {
    const s = this.st(), l0 = this.lv(k); s[k] = (s[k] || 0) + n; const l1 = this.lv(k); if (l1 <= l0) return;
    const perk = SKILLS[k].perks[l1 - 2]; UI.banner(`${SKILLS[k].name} ${ROMAN[l1 - 1]}`, perk); journal(`Getting better as a ${SKILLS[k].name.toLowerCase()}. ${perk}.`); Sfx.coin(); Haptic.buzz([20, 40, 20]);
  },
  onEvent(ev, d) { // experience from what Wren does out in the world
    if (ev === 'skin') this.gain('survive', 4); else if (ev === 'fish') this.gain('survive', 3); else if (ev === 'horsecare') this.gain('ride', 2);
    else if (ev === 'item' && d && (d.id === 'berries' || d.id === 'sage')) this.gain('survive', 1);
  },
  rideM: 0,
  update(dt) { const P = Game.player; if (P.state === 'ride' && Game.horse.speed > 3) { this.rideM += Game.horse.speed * dt; if (this.rideM > 100) { this.rideM = 0; this.gain('ride', 1); } } },
  honorRank(h = S.honor) { return h >= 60 ? 'Hero of the Gap' : h >= 25 ? 'Respected' : h > -25 ? 'Drifter' : h > -60 ? 'Rough sort' : 'Outlaw'; },
  honorNote(h = S.honor) { return h >= 25 ? 'Shopkeepers knock 10% off at 40+. Folks greet you warmly.' : h > -25 ? 'Nobody knows quite what to make of you yet.' : 'Prices go up 15% at −40. Bounty hunters come after you sooner.'; },
};
{ const emit = Missions.emit.bind(Missions); Missions.emit = (ev, d) => { Skills.onEvent(ev, d); return emit(ev, d); }; }

/* phones buzz on the moments that matter (hits taken, counters, level-ups); a no-op where vibration isn't supported */
const Haptic = { buzz(p) { if (Settings.v.haptics === false || !Input.touch || !navigator.vibrate) return; try { navigator.vibrate(p); } catch (e) {} this.last = p; } };
