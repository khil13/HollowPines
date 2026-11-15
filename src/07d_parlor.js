/* ===== The saloon parlor (as in Red Dead Redemption 2): things to do at the Pine Knot.
   - A whiskey at the bar when Cora is serving: steadies the hand (refills Dead Eye) and mends a little health. A few in
     a row and the room starts to sway, aim wanders, and Cora cuts you off.
   - Blackjack against the house at the card table: pick a stake, hit, stand or double. The dealer draws to 17,
     blackjack pays 3 to 2, a tie returns the stake.
   - The pianola plays ragtime through the evening. */
const Parlor = {
  b: null, bj: null, STAKES: [0.5, 1, 2, 5], noteT: 0, step: 0, rng: Math.random,
  build() {
    const b = this.b = Buildings.find(x => x.name === 'Saloon'); if (!b) return;
    Interact.add({ pos: () => ({ x: b.x + 1.2, y: b.floor, z: b.z - 1.5 }), r: 2.4, pri: 0.25, opts: p => this.barOpts(p) });
    Interact.add({ pos: () => ({ x: b.x + 3, y: b.floor, z: b.z + 2 }), r: 1.9, pri: 0.35, opts: p => this.open() ? [{ label: 'Play blackjack', fn: () => this.sit() }] : [{ label: 'Card table (closed until 10)', disabled: true }] });
  },
  open() { const h = S.time.hour; return h >= 10 || h < 2; },
  /* ---- the bar ---- */
  drunk() { return S.p.drunk || 0; },
  sway() { return clamp(this.drunk() - 1, 0, 3) / 3; }, // 0..1: nothing after one drink, the full wobble after four
  barOpts(p) {
    const c = NPC.byKey('cora'), b = this.b; if (!c || !c.alive || c.downed || c.state === 'combat' || c.state === 'flee' || Math.hypot(c.pos.x - b.x, c.pos.z - (b.z - 3.4)) > 5.5 || S.wanted) return [];
    if (this.drunk() >= 3.5) return [{ label: 'Whiskey (Cora has cut you off)', disabled: true }];
    return [{ label: 'Whiskey ($0.50)', disabled: S.money < 0.5, fn: () => this.drink(p) }];
  },
  drink(p) {
    if (S.money < 0.5) return; Inv.money(-0.5); p.anim.play('eat'); Sfx.tone(300, 0.15, 0.05, 'triangle');
    S.p.drunk = this.drunk() + 1; DeadEye.add(45); S.p.hp = Math.min(S.p.maxHp, S.p.hp + 8); S.stats.drinks = (S.stats.drinks || 0) + 1;
    const d = S.p.drunk; UI.toast(d < 2 ? 'Whiskey: Dead Eye restored' : d < 3 ? 'The room has started to tilt' : d < 4 ? 'You are drunk' : 'You are very drunk. Cora takes the bottle away', d < 2 ? 'good' : '');
  },
  /* ---- blackjack ---- */
  sit() { this.bj = { phase: 'bet', bet: Math.min(1, this.STAKES.filter(s => s <= S.money).pop() || 0.5), hand: [], dealer: [], deck: [], msg: 'Place your stake.', won: 0 }; UI.open('cards'); },
  shuffle() { const d = []; for (const s of '♠♥♦♣') for (const r of ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) d.push(r + s); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d; },
  val(h) { let t = 0, aces = 0; for (const c of h) { const r = c.slice(0, -1); if (r === 'A') { aces++; t += 11; } else t += 'JQK'.includes(r) ? 10 : +r; } while (t > 21 && aces) { t -= 10; aces--; } return t; },
  draw() { const g = this.bj; if (g.deck.length < 1) g.deck = this.shuffle(); return g.deck.pop(); },
  act(id) {
    const g = this.bj; if (!g) return;
    if (id === 'leave') { this.bj = null; UI.close(true); return; }
    if (g.phase !== 'play') { // between hands: change the stake or deal
      if (id.startsWith('bet')) { g.bet = +id.slice(3); return; }
      if (id === 'deal') { if (S.money < g.bet) { g.msg = 'You cannot cover that stake.'; return; } if (g.deck.length < 15) g.deck = this.shuffle(); Inv.money(-g.bet); g.staked = g.bet; g.hand = [this.draw(), this.draw()]; g.dealer = [this.draw(), this.draw()]; g.phase = 'play'; g.msg = ''; Sfx.tone(900, 0.03, 0.04, 'square'); S.time.hour = (S.time.hour + 0.08) % 24;
        if (this.val(g.hand) === 21) this.settle(true); }
      return; }
    if (id === 'hit') { g.hand.push(this.draw()); Sfx.tone(900, 0.03, 0.04, 'square'); if (this.val(g.hand) > 21) this.settle(); else if (this.val(g.hand) === 21) this.stand(); }
    else if (id === 'double' && g.hand.length === 2 && S.money >= g.staked) { Inv.money(-g.staked); g.staked *= 2; g.hand.push(this.draw()); if (this.val(g.hand) > 21) this.settle(); else this.stand(); }
    else if (id === 'stand') this.stand();
  },
  stand() { const g = this.bj; while (this.val(g.dealer) < 17) g.dealer.push(this.draw()); this.settle(); },
  settle(natural) {
    const g = this.bj, p = this.val(g.hand), d = this.val(g.dealer), dNat = d === 21 && g.dealer.length === 2; let pay = 0;
    if (natural) { if (dNat) { pay = g.staked; g.msg = 'Blackjack each. The stake comes back.'; } else { pay = g.staked * 2.5; g.msg = `Blackjack! You win $${(g.staked * 1.5).toFixed(2)}.`; } }
    else if (p > 21) g.msg = `Bust on ${p}. The house takes $${g.staked.toFixed(2)}.`;
    else if (d > 21) { pay = g.staked * 2; g.msg = `The dealer busts on ${d}. You win $${g.staked.toFixed(2)}.`; }
    else if (p > d) { pay = g.staked * 2; g.msg = `${p} beats ${d}. You win $${g.staked.toFixed(2)}.`; }
    else if (p === d) { pay = g.staked; g.msg = `${p} each. The stake comes back.`; }
    else g.msg = `${d} beats ${p}. The house takes $${g.staked.toFixed(2)}.`;
    if (pay) Inv.money(pay); g.won = Math.round((g.won + pay - g.staked) * 100) / 100; g.phase = 'done'; S.stats.bjHands = (S.stats.bjHands || 0) + 1; S.stats.bjNet = Math.round(((S.stats.bjNet || 0) + pay - g.staked) * 100) / 100;
    if (S.money < g.bet) g.bet = this.STAKES.filter(s => s <= S.money).pop() || g.bet;
  },
  render() {
    const g = this.bj; if (!g) return ''; const card = c => `<span class="card${'♥♦'.includes(c.slice(-1)) ? ' red' : ''}">${c}</span>`, play = g.phase === 'play';
    const dealer = g.dealer.length ? (play ? card(g.dealer[0]) + '<span class="card back">?</span>' : g.dealer.map(card).join('')) : '', dv = g.dealer.length && !play ? ` (${this.val(g.dealer)})` : '';
    let h = `<div class="stat"><span>Money</span><span>$${S.money.toFixed(2)}</span></div><div class="stat"><span>This sitting</span><span>${g.won >= 0 ? '+' : '−'}$${Math.abs(g.won).toFixed(2)}</span></div>`;
    h += `<div class="sec">Dealer${dv}</div><div class="cards">${dealer || '<span class="card back">&nbsp;</span>'}</div><div class="sec">Wren${g.hand.length ? ` (${this.val(g.hand)})` : ''}</div><div class="cards">${g.hand.map(card).join('') || '<span class="card back">&nbsp;</span>'}</div>`;
    h += `<p class="bjmsg">${esc(g.msg || (play ? 'Hit, stand or double?' : ''))}</p><div class="bjrow">`;
    if (play) h += `<button class="btn" data-act="bj:hit">Hit</button><button class="btn" data-act="bj:stand">Stand</button><button class="btn" data-act="bj:double" ${g.hand.length === 2 && S.money >= g.staked ? '' : 'disabled'}>Double</button>`;
    else h += this.STAKES.map(s => `<button class="btn${g.bet === s ? ' on' : ''}" data-act="bj:bet${s}" ${S.money < s ? 'disabled' : ''}>$${s.toFixed(2)}</button>`).join('') + `<button class="btn" data-act="bj:deal" ${S.money < g.bet ? 'disabled' : ''}>Deal</button>`;
    return h + `<button class="btn" data-act="bj:leave" ${play ? 'disabled' : ''}>Leave the table</button></div>`;
  },
  /* ---- the pianola, and the whiskey wearing off ---- */
  TUNE: [[523, 131], [659, 0], [784, 196], [659, 0], [880, 165], [784, 0], [659, 196], [523, 0], [587, 147], [698, 0], [880, 220], [698, 0], [784, 175], [659, 0], [587, 220], [494, 0],
    [523, 131], [784, 0], [1047, 196], [784, 0], [880, 175], [698, 0], [587, 220], [698, 0], [659, 131], [523, 0], [587, 196], [494, 0], [523, 131], [0, 196], [523, 131], [0, 0]],
  playing() { const h = S.time.hour; return (h >= 17 || h < 1) && !S.wanted && !NPC.all.some(n => n.panicked); },
  update(dt) {
    if (S.p.drunk > 0) S.p.drunk = Math.max(0, S.p.drunk - dt / 40);
    const b = this.b; if (!b) return; const P = Game.player, d = Math.hypot(P.pos.x - (b.x - 5), P.pos.z - (b.z + 1)); this.near = d < 22 && this.playing();
    if (!this.near) return; this.noteT -= dt; if (this.noteT > 0) return; this.noteT = 0.17;
    const inside = P.pos.x > b.minX && P.pos.x < b.maxX && P.pos.z > b.minZ && P.pos.z < b.maxZ, vol = (inside ? 0.05 : 0.02) * clamp(1.3 - d / 22, 0.15, 1), [m, bass] = this.TUNE[this.step++ % this.TUNE.length];
    if (m) Sfx.tone(m, 0.16, vol, 'triangle'); if (bass) Sfx.tone(bass, 0.22, vol * 0.9, 'triangle');
  },
  /* the camera rolls and drifts when Wren has had a few (called after the camera has been placed) */
  tilt(cam, t) { const k = this.sway(); if (k <= 0) return; cam.rotation.z += Math.sin(t * 1.1) * 0.05 * k; cam.rotation.y += Math.sin(t * 0.7 + 1) * 0.02 * k; },
};
