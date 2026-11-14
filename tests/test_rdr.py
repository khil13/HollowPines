"""Red Dead-style play: Dead Eye (slow time, painted marks, the burst that lands them, the meter), and the saloon
parlor (a whiskey at the bar, getting drunk, blackjack against the house, the piano), plus the furnished parlors."""
import asyncio, json
from run import boot
from playwright.async_api import async_playwright
RESULTS = []
def check(name, ok, info=''):
    RESULTS.append((name, bool(ok), str(info)[:400])); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{str(info)[:400]}]' if info else ''))
async def ev(pg, js): return await pg.evaluate(js)

H = r"""window.T = { F: 1 / 60,
  reset() { const P = HP.Game.player; if (HP.Missions.active) HP.Missions.abandon(true); for (const n of HP.NPC.all.slice()) if (n.key && n.key.startsWith('de')) HP.NPC.despawn(n); DeadEye.stop(); HP.S.time.hour = 12; HP.tp(-100, -20); P.yaw = 0; HP.Game.cam.yaw = 0; HP.Game.cam.pitch = 0.1; P.inv = 1e9; P.setWeapon('revolver'); HP.S.ammoClip.revolver = 6; HP.S.p.de = 100; Input.aimToggle = true; HP.sim(0.5, this.F); },
  foe(i, dx, dz) { const P = HP.Game.player; const n = HP.NPC.spawn({ key: 'de' + i, name: 'Outlaw', x: P.pos.x + dx, z: P.pos.z + dz, lawful: false, wild: true, hp: 60, maxHp: 60, tags: ['generic'], look: {} }); n.update = () => {}; n.place && n.place(); return n; },
  aimAt(n, y = 1.0) { const C = HP.Game.cam; C.snapT = 0; C.snapTgt = null; const dx = n.pos.x - C.pos.x, dy = n.pos.y + y - C.pos.y, dz = n.pos.z - C.pos.z; C.yaw = Math.atan2(dx, dz); C.pitch = -Math.atan2(dy, Math.hypot(dx, dz)); for (let i = 0; i < 14; i++) { HP.sim(this.F, this.F); const d = C.dir(), ex = n.pos.x - C.pos.x, ey = n.pos.y + y - C.pos.y, ez = n.pos.z - C.pos.z; C.yaw += Math.atan2(ex, ez) - Math.atan2(d.x, d.z); C.pitch -= Math.atan2(ey, Math.hypot(ex, ez)) - Math.atan2(d.y, Math.hypot(d.x, d.z)); } const h = rayHit(C.pos, C.dir(), 45, HP.Game.player); return h && h.h === n ? h.zone : null; },
  key(k) { Input.pressed.add(k); HP.sim(this.F, this.F); Input.pressed.delete(k); },
  pull() { Input.mouse.lp = true; HP.sim(this.F, this.F); Input.mouse.lp = false; for (let i = 0; i < 12; i++) HP.sim(this.F, this.F); },
};"""

async def main():
    async with async_playwright() as p:
        b, pg, errs = await boot(p)
        await pg.click('#bNew'); await pg.wait_for_timeout(600); await ev(pg, H)

        # ---------- Dead Eye ----------
        r = await ev(pg, """(()=>{ T.reset(); const a = T.foe(1, -2.5, 14), b = T.foe(2, 2.5, 15); HP.sim(0.3, T.F); const t0 = HP.S.time.hour, w0 = HP.Game.time; HP.sim(1, T.F); const normal = HP.S.time.hour - t0;
          T.key('q'); const on = DeadEye.on; for (let i = 0; i < 30; i++) HP.sim(T.F, T.F); const t1 = HP.S.time.hour, m0 = HP.S.p.de; HP.sim(1, T.F); const slow = HP.S.time.hour - t1;
          return { on, ratio: +(slow / normal).toFixed(2), drained: +(m0 - HP.S.p.de).toFixed(1), tint: +document.getElementById('deTint').style.opacity, ring: !!document.getElementById('r_de') }; })()""")
        check('dead eye: Q while aiming starts it, the world runs at about a fifth speed, the screen turns amber and the meter drains', r['on'] and 0.15 < r['ratio'] < 0.32 and 8 < r['drained'] < 14 and r['tint'] > 0.8 and r['ring'], r)
        r = await ev(pg, """(()=>{ const a = HP.NPC.byKey('de1'), b = HP.NPC.byKey('de2'); const okA = T.aimAt(a, 1.55); T.pull(); const okB = T.aimAt(b, 1.0); T.pull(); T.pull();
          const marks = DeadEye.marks.map(m => [m.h.key, m.zone]), ammo = HP.S.ammoClip.revolver, shown = [...document.querySelectorAll('.demark')].filter(d => !d.hidden).length;
          HP.Game.cam.yaw += 0.6; HP.sim(0.1, T.F); T.key('q'); const firing = DeadEye.firing; let n = 0; while (DeadEye.on && n++ < 240) HP.sim(T.F, T.F);
          return { okA, okB, marks, ammo, shown, firing, off: !DeadEye.on, ammoAfter: HP.S.ammoClip.revolver, a: [a.alive, a.hp], b: [b.alive, b.hp], last: HP.Game.player.lastHit }; })()""")
        check('dead eye: trigger pulls paint marks without firing (one on a head, two on a body), each shown as an X', r['okA'] == 'head' and r['okB'] == 'body' and r['marks'] == [['de1', 'head'], ['de2', 'body'], ['de2', 'body']] and r['ammo'] == 6 and r['shown'] == 3, r)
        check('dead eye: releasing fires every mark in a burst, even after looking away; the headshot kills, the body shots land', r['firing'] and r['off'] and r['ammoAfter'] == 3 and not r['a'][0] and (not r['b'][0] or r['b'][1] < 60), r)
        r = await ev(pg, """(()=>{ T.reset(); HP.S.p.de = 40; const a = T.foe(3, 0, 12); HP.sim(0.3, T.F); T.aimAt(a, 1.55); const d0 = HP.S.p.de; Input.mouse.lp = true; HP.sim(T.F, T.F); Input.mouse.lp = false; HP.sim(0.2, T.F); const gained = HP.S.p.de - d0;
          HP.S.p.de = 5; T.key('q'); const refused = !DeadEye.on; HP.S.p.de = 30; T.key('q'); const on = DeadEye.on; let n = 0; while (DeadEye.on && n++ < 400) HP.sim(T.F, T.F); const ranOut = !DeadEye.on && HP.S.p.de < 2;
          HP.S.p.de = 100; HP.sim(0.3, T.F); T.key('q'); Input.aimToggle = false; HP.sim(0.2, T.F); const lowered = !DeadEye.on; HP.sim(1.5, T.F); return { dead: !a.alive, gained: +gained.toFixed(1), refused, on, ranOut, lowered, scale: DeadEye.scale }; })()""")
        check('dead eye: a headshot kill refills the meter; it will not start when spent, ends when the meter runs dry or the gun is lowered, and time returns to normal', r['dead'] and r['gained'] > 25 and r['refused'] and r['on'] and r['ranOut'] and r['lowered'] and r['scale'] == 1, r)
        await ev(pg, "T.reset(); Input.aimToggle = false; HP.sim(0.3)")

        # ---------- the saloon parlor ----------
        r = await ev(pg, """(()=>{ const b = Parlor.b, c = HP.NPC.byKey('cora'); HP.S.time.hour = 14; HP.S.money = 10; HP.S.p.de = 20; HP.S.p.hp = 50; HP.S.p.drunk = 0; HP.tp(b.x + 1.2, b.z - 1.3); for (let i = 0; i < 60 && Math.hypot(c.pos.x - b.x, c.pos.z - (b.z - 3.4)) > 1.5; i++) HP.sim(1); HP.sim(1.5); const cora = [c.alive, +Math.hypot(c.pos.x - b.x, c.pos.z - (b.z - 3.4)).toFixed(1)];
          const o1 = HP.opts(); const ok = HP.press('Whiskey'); HP.sim(1.5); const a = { money: HP.S.money, de: Math.round(HP.S.p.de), hp: Math.round(HP.S.p.hp), drunk: +HP.S.p.drunk.toFixed(2), sway: Parlor.sway() };
          for (let i = 0; i < 3; i++) { HP.press('Whiskey'); HP.sim(1.2); } const sway = +Parlor.sway().toFixed(2), sp = HP.Game.player.spread(); const o2 = HP.opts(); HP.S.p.drunk = 0; const sp0 = HP.Game.player.spread(); HP.S.p.drunk = 3; const roll0 = HP.Game.camera.rotation.z; HP.sim(1); 
          HP.S.p.drunk = 0.5; HP.sim(30, 0.05); const sober = HP.S.p.drunk; return { cora, o1, ok, a, sway, sp, sp0, o2, sober }; })()""")
        check('bar: Cora sells a whiskey for 50 cents; it restores Dead Eye and a little health, and the first one leaves you steady', r['ok'] and any('Whiskey ($0.50)' in o for o in r['o1']) and r['a']['money'] == 9.5 and r['a']['de'] >= 64 and r['a']['hp'] >= 57 and r['a']['sway'] == 0, r)
        check('bar: four in a row and the room sways, aim wanders, and Cora cuts you off; it wears off with time', r['sway'] > 0.8 and r['sp'] > r['sp0'] + 0.01 and any('cut you off' in o for o in r['o2']) and r['sober'] == 0, r)
        r = await ev(pg, """(()=>{ const b = Parlor.b; HP.S.money = 10; HP.S.time.hour = 14; HP.tp(b.x + 3, b.z + 3.2); HP.sim(0.5); const o = HP.opts(); const sat = HP.press('Play blackjack'); HP.sim(0.1); const open = UI.panelOpen && UI.kind === 'cards';
          const click = a => { const el = document.querySelector(`#pBody [data-act="bj:${a}"]`); if (!el || el.disabled) return false; el.click(); return true; }; const g = Parlor.bj; const out = { o, sat, open };
          const hand = (deck, moves) => { g.deck = Array(20).fill('2♣').concat(deck.slice().reverse()); const m0 = HP.S.money; click('deal'); for (const m of moves) click(m); return { net: +(HP.S.money - m0).toFixed(2), msg: g.msg, phase: g.phase, p: Parlor.val(g.hand), d: Parlor.val(g.dealer) }; };
          click('bet2'); out.stake = g.bet;
          out.win = hand(['10♠', '9♥', '10♦', '7♣'], ['stand']);            /* 19 v 17 */
          out.lose = hand(['10♠', '6♥', '10♦', '9♣'], ['stand']);           /* 16 v 19 */
          out.bust = hand(['10♠', '6♥', '10♦', '9♣', 'K♣'], ['hit']);       /* 26 */
          out.push = hand(['10♠', '8♥', '10♦', '8♣'], ['stand']);
          out.natural = hand(['A♠', 'K♥', '10♦', '9♣'], []);                 /* pays 3:2 */
          out.dbl = hand(['5♠', '6♥', '10♦', '7♣', '10♥'], ['double']);     /* 21 v 17 on a doubled stake */
          out.dealerDraws = hand(['10♠', '8♥', '6♦', '5♣', '4♣', 'Q♣'], ['stand']); /* dealer 11, 15, bust 25 */
          out.aces = [Parlor.val(['A♠', 'A♥', '9♦']), Parlor.val(['A♠', 'K♥']), Parlor.val(['A♠', '6♥', 'K♦'])];
          out.cards = document.querySelectorAll('#pBody .card').length; HP.S.money = 0.2; UI.render(); out.broke = !click('deal'); HP.S.money = 10; UI.render(); out.left = click('leave') && !UI.panelOpen;
          HP.S.time.hour = 5; HP.sim(0.3); out.closed = HP.opts(); return out; })()""")
        check('blackjack: sit at the table, pick a $2 stake; winning pays even money, losing and busting cost the stake, a tie returns it', r['sat'] and r['open'] and r['stake'] == 2 and r['win']['net'] == 2 and r['lose']['net'] == -2 and r['bust']['net'] == -2 and r['bust']['p'] == 26 and r['push']['net'] == 0, r)
        check('blackjack: a natural pays 3 to 2, doubling doubles the stake, the dealer draws to 17, aces count 1 or 11', r['natural']['net'] == 3 and r['dbl']['net'] == 4 and r['dealerDraws']['d'] == 25 and r['dealerDraws']['net'] == 2 and r['aces'] == [21, 21, 17], r)
        check('blackjack: cards are shown, no dealing without the money, leaving closes the table, and it is shut before 10', r['cards'] >= 4 and r['broke'] and r['left'] and any('closed' in o for o in r['closed']), r)
        r = await ev(pg, """(()=>{ const b = Parlor.b; HP.S.wanted = 0; HP.S.time.hour = 20; HP.tp(b.x, b.z + 2); let n = 0; const t = Sfx.tone; Sfx.tone = (...a) => { n++; }; HP.sim(3); const evening = n; n = 0; HP.S.time.hour = 11; HP.sim(3); const day = n; n = 0; HP.S.time.hour = 20; HP.tp(b.x + 80, b.z); HP.sim(3); const far = n; Sfx.tone = t; return { evening, day, far }; })()""")
        check('pianola: ragtime in the saloon through the evening, quiet by day and out of earshot', r['evening'] > 15 and r['day'] == 0 and r['far'] == 0, r)
        check('no page errors', not [e for e in errs if 'favicon' not in e], errs[:3])
        await b.close()
    n = sum(1 for r in RESULTS if r[1]); print(f'\n{n}/{len(RESULTS)} Red Dead-style checks passed')
    if n != len(RESULTS): raise SystemExit(1)
if __name__ == '__main__': asyncio.run(main())
