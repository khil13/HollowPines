"""Living world and character development: townsfolk run indoors at gunfire and the law comes to check; bounty
hunters ride after a bounty (sooner at low honor) and haul you in if they knock you out; Wren's own wanted poster;
road events (a stranded wagon, a duel); skills that level from use and unlock perks; the Wren character page."""
import asyncio
from run import boot
from playwright.async_api import async_playwright
RESULTS = []
def check(name, ok, info=''):
    RESULTS.append((name, bool(ok), str(info)[:400])); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{str(info)[:400]}]' if info else ''))
async def ev(pg, js): return await pg.evaluate(js)

H = r"""window.X = {
  F: 1 / 30,
  reset(x = -100, z = -20) { const P = HP.Game.player; if (HP.Missions.active) HP.Missions.abandon(true); Town.clear(); Brawl.clear(); for (const n of HP.NPC.all.slice()) if (n.key && (n.key.startsWith('tw') || n.tags.includes('hunter') || n.key === 'duelist' || n.key === 'wagon_otis')) { if (n.mount) Riders.despawnRider(n); else HP.NPC.despawn(n); }
    Input.keys.clear(); Input.mouse.lp = false; Input.mouse.r = false; Input.aimToggle = false; HP.S.time.hour = 12; HP.S.weather.kind = 'clear'; HP.S.weather.next = 99; HP.S.bounty = 0; HP.S.wanted = false; HP.S.honor = 0; Town.huntCD = 999; Town.warnedAt = -999; Town.lawT = 0;
    HP.tp(x, z); P.yaw = 0; HP.Game.cam.yaw = 0; P.inv = 1e9; HP.S.p.hp = HP.S.p.maxHp; P.setWeapon('fists'); HP.sim(0.4, this.F); },
  click() { Input.mouse.lp = true; HP.sim(this.F, this.F); Input.mouse.lp = false; },
  labels(o) { return o.opts(HP.Game.player).map(x => x.label); },
};"""

async def main():
    async with async_playwright() as p:
        b, pg, errs = await boot(p)
        await pg.click('#bNew'); await pg.wait_for_timeout(600); await ev(pg, H)
        await ev(pg, "(()=>{ for (const id of ['intro', 'm1']) HP.Missions.st(id).status = 'done'; HP.S.chapter = 2; })()")

        # --- town reacts to gunfire ---
        r = await ev(pg, """(()=>{ X.reset(-40, 24); const P = HP.Game.player; const n = HP.NPC.spawn({ key: 'twA', name: 'Townsman', x: -46, z: 23, lawful: true, brave: 0.2, tags: ['generic'] }); n.state = 'routine'; n.idleAt = { x: -46, z: 23 }; HP.sim(0.3, X.F);
            P.setWeapon('revolver'); HP.S.ammoClip.revolver = 6; P.yaw = Math.PI; P.cool = 0; HP.sim(0.4, X.F); X.click(); const panicked = n.panicked && n.state === 'scripted', alarm = Town.alarmT > 0; const pike = HP.NPC.byKey('pike');
            const law = { lawT: Town.lawT > 0, caller: Town.lawCaller ? Town.lawCaller.name : null }; HP.sim(10, X.F); const hid = n.hid; Town.alarmT = 0; HP.sim(26, X.F);
            return { panicked, alarm, hid, back: n.state === 'routine' && !n.panicked, law }; })()""")
        check('town: a gunshot in Juniper Gap sends townsfolk running for the nearest door, they cower inside, then come back out', r['panicked'] and r['alarm'] and r['hid'] and r['back'], r)
        check('town: the law hears it and comes to see who\'s shooting', r['law']['lawT'] and r['law']['caller'], r['law'])
        r = await ev(pg, """(()=>{ const c = Town.lawCaller || HP.NPC.all.find(n => n.lawman && n.alive); const P = HP.Game.player; Town.lawCaller = c; c.state = 'routine'; HP.tp(c.pos.x, c.pos.z - 3); P.yaw = 0; HP.sim(0.1, X.F); c.seesPlayer = true; c.perceiveT = 99; Town.update(0);
            const warned = Game.time - Town.warnedAt < 1, c0 = HP.S.stats.crimes; P.cool = 0; X.click(); HP.sim(0.2, X.F); return { warned, crime: HP.S.stats.crimes - c0 }; })()""")
        check('town: the lawman warns you once; shoot again in town and it\'s disturbing the peace', r['warned'] and r['crime'] == 1, r)
        r = await ev(pg, """(()=>{ X.reset(-40, 24); HP.S.bounty = 0; HP.S.wanted = false; for (const n of HP.NPC.all) if (n.lawman) n.calm(); const n = HP.NPC.spawn({ key: 'twB', name: 'Townswoman', x: -50, z: 25, lawful: true, brave: 0.1, tags: ['generic'] }); n.state = 'routine'; HP.sim(0.2, X.F);
            const o = HP.NPC.spawn({ key: 'twC', name: 'Outlaw', x: -44, z: 26, lawful: false, gun: 'revolver', wild: true, tags: ['generic'] }); Town.shot(o.pos.x, o.pos.z, o); return { panicked: !!n.panicked }; })()""")
        check('town: an outlaw\'s gunfire in town panics people too', r['panicked'], r)

        # --- bounty hunters ---
        r = await ev(pg, """(()=>{ X.reset(-150, -60); HP.S.bounty = 20; Town.huntCD = 0; HP.sim(0.2, X.F); const hs = Town.hunters(); return { n: hs.length, hostile: hs.every(h => h.hostileToPlayer && h.state === 'ride'), unlawful: hs.every(h => !h.lawful), d: Math.round(hs[0] ? Math.hypot(hs[0].pos.x - HP.Game.player.pos.x, hs[0].pos.z - HP.Game.player.pos.z) : 0) }; })()""")
        check('hunters: out in the country with a $20 bounty, three mounted bounty hunters ride after you', r['n'] == 3 and r['hostile'] and r['unlawful'] and 40 < r['d'] < 70, r)
        r = await ev(pg, """(()=>{ const P = HP.Game.player, c0 = HP.S.stats.crimes; for (const h of Town.hunters()) h.takeHit({ dmg: 999, from: P, gun: 'revolver', zone: 'head' }); HP.sim(0.6, X.F); return { done: Town.huntDone, crimes: HP.S.stats.crimes - c0 }; })()""")
        check('hunters: they\'re fair game; gunning them down is no crime', r['done'] and r['crimes'] == 0, r)
        r = await ev(pg, """(()=>{ X.reset(-150, -60); HP.S.bounty = 20; HP.S.money = 50; Town.huntCD = 0; HP.sim(0.2, X.F); const P = HP.Game.player; for (const h of Town.hunters()) { h.mount && (h.mount.pos.set(P.pos.x + 6, h.mount.pos.y, P.pos.z)); h.pos.set(P.pos.x + 6, h.pos.y, P.pos.z); }
            P.inv = 0; P.knockout(null); HP.sim(4.2, X.F); return { bounty: HP.S.bounty, money: HP.S.money, d: Math.round(Math.hypot(P.pos.x + 22, P.pos.z - 14.5)), hunters: Town.hunters().length }; })()""")
        check('hunters: knocked out by them, you wake at the sheriff\'s and the bounty is paid from your money (after the usual 10% lost while out cold)', r['bounty'] == 0 and r['money'] == 25 and r['d'] < 3 and r['hunters'] == 0, r)
        r = await ev(pg, """(()=>{ const t = (b, h) => { X.reset(-150, -60); HP.S.bounty = b; HP.S.honor = h; Town.huntCD = 0; HP.sim(0.2, X.F); const n = Town.hunters().length; for (const x of Town.hunters()) Riders.despawnRider(x); return n; };
            return { lowHonor: t(10, -50), fair: t(10, 0), inTown: (X.reset(-40, 20), HP.S.bounty = 30, Town.huntCD = 0, HP.sim(0.2, X.F), Town.hunters().length) }; })()""")
        check('hunters: a low-honor outlaw draws them at a smaller bounty; never inside town', r['lowHonor'] == 3 and r['fair'] == 0 and r['inTown'] == 0, r)

        # --- wanted poster ---
        r = await ev(pg, """(()=>{ X.reset(-19.6, 3); HP.S.bounty = 12; Town.update(0); const vis = Town.poster.visible; const it = Interact.list.find(o => o.opts(HP.Game.player).some(x => x.label === 'Read poster: Wren')); HP.S.bounty = 0; Town.update(0); return { vis, it: !!it, hidden: !Town.poster.visible }; })()""")
        check('poster: with a bounty, Wren\'s own wanted poster goes up outside the sheriff\'s office (and can be read)', r['vis'] and r['it'] and r['hidden'], r)

        # --- road events ---
        r = await ev(pg, """(()=>{ X.reset(70, -14); HP.S.flags.wagonDay = 0; Town.wagon(); const ev = Town.events.find(e => e.kind === 'wagon'); HP.tp(ev.g.position.x - 2, ev.g.position.z); HP.sim(0.2, X.F); window._ev = ev; return { labels: X.labels(ev.it), otis: !!HP.NPC.byKey('wagon_otis') }; })()""")
        check('road: a settler stuck with a broken wagon wheel: help or rob', r['otis'] and 'Help fix the wheel' in r['labels'] and 'Rob him' in r['labels'], r)
        h0 = await ev(pg, "(()=>{ const o = _ev.it.opts(HP.Game.player).find(x => x.label === 'Help fix the wheel'); window._h0 = HP.S.honor; window._m0 = HP.S.money; o.fn(); return HP.S.honor; })()")
        await pg.wait_for_timeout(2900)
        r = await ev(pg, "({ fixed: _ev.fixed, honor: HP.S.honor - _h0, paid: +(HP.S.money - _m0).toFixed(2), coffee: Inv.count('coffee') })")
        check('road: fixing the wheel earns honor, a few dollars and some coffee', r['fixed'] and r['honor'] == 3 and r['paid'] >= 2, r)
        r = await ev(pg, """(()=>{ X.reset(70, -14); HP.S.flags.wagonDay = 0; Town.wagon(); const ev = Town.events.find(e => e.kind === 'wagon'); HP.tp(ev.g.position.x - 2, ev.g.position.z); HP.sim(0.2, X.F); const c0 = HP.S.stats.crimes, m0 = HP.S.money;
            ev.it.opts(HP.Game.player).find(x => x.label === 'Rob him').fn(); return { robbed: ev.robbed, crime: HP.S.stats.crimes - c0, took: HP.S.money > m0 }; })()""")
        check('road: robbing the settler pays but is a crime', r['robbed'] and r['crime'] == 1 and r['took'], r)

        duel = """(how) => { X.reset(70, -14); HP.S.flags.duelDay = 0; Town.duelist(); const n = HP.NPC.byKey('duelist'); const t = n.talk(); const acc = t.start.choices.find(c => c.text.includes('Duel')); acc.do(); const P = HP.Game.player; P.inv = 0; const hp0 = HP.S.p.hp, d = Math.round(Math.hypot(n.pos.x - P.pos.x, n.pos.z - P.pos.z));
            if (how === 'early') { HP.sim(0.5, X.F); X.click(); } else { for (let i = 0; i < 200 && Duel.phase === 'walk'; i++) HP.sim(X.F, X.F); if (how === 'spare') Input.aimToggle = true; if (how !== 'slow') X.click(); else HP.sim(1.2, X.F); Input.aimToggle = false; }
            HP.sim(0.2, X.F); return { d, last: Duel.last, on: Duel.on, alive: n.alive, fists: !!n.fists, hpLost: Math.round(hp0 - HP.S.p.hp), duels: HP.S.stats.duels || 0, honor: HP.S.honor }; }"""
        r = await ev(pg, f"({duel})('win')")
        check('duel: a gunslinger calls you out; ten paces, wait for DRAW!, shoot first and win', r['d'] == 10 and r['last'] == 'win' and not r['alive'] and r['hpLost'] == 0 and r['duels'] == 1 and not r['on'], r)
        r = await ev(pg, f"({duel})('spare')")
        check('duel: hold aim as you draw to shoot the gun from their hand and spare them (+honor)', r['last'] == 'spare' and r['alive'] and r['fists'] and r['honor'] == 3, r)
        r = await ev(pg, f"({duel})('early')")
        check('duel: drawing early gets you shot (and costs honor)', r['last'] == 'early' and r['hpLost'] > 30 and r['honor'] < 0, r)
        r = await ev(pg, f"({duel})('slow')")
        check('duel: too slow on the draw and they beat you to it', r['last'] == 'slow' and r['hpLost'] > 30 and r['alive'], r)

        # --- skills ---
        r = await ev(pg, """(()=>{ X.reset(); HP.S.skills = { gun: 0, brawl: 0, survive: 0, ride: 0 }; const P = HP.Game.player; const s0 = P.spread(); const l0 = Skills.lv('brawl'); Skills.gain('brawl', 30); const l1 = Skills.lv('brawl'); Skills.gain('gun', 30); const s1 = P.spread();
            const n = HP.NPC.spawn({ key: 'twD', name: 'Sparring partner', x: P.pos.x, z: P.pos.z + 1.2, lawful: false, wild: true, hp: 300, maxHp: 300, tags: ['generic'], state: 'scripted' }); n.script = (dt, me) => { me.sp = 0; }; HP.sim(0.2, X.F); P.cool = 0; P.comboT = 0; X.click(); HP.sim(0.6, X.F);
            HP.S.skills.survive = 0; HP.Missions.emit('fish', {}); const fishXp = HP.S.skills.survive; return { l0, l1, s0: +s0.toFixed(4), s1: +s1.toFixed(4), punch: 300 - n.hp, fishXp, brawlXp: HP.S.skills.brawl }; })()""")
        check('skills: brawling earns Brawler xp, levelling unlocks perks (+15% punch damage), Gunslinger II tightens the spread', r['l0'] == 1 and r['l1'] == 2 and r['s1'] < r['s0'] and 19 <= r['punch'] <= 20 and r['brawlXp'] > 30, r)
        check('skills: fishing, hunting and foraging feed the Survivalist skill', r['fishXp'] == 3, r)
        r = await ev(pg, """(()=>{ X.reset(-95, 30); const P = HP.Game.player, H = HP.Game.horse; HP.S.skills.ride = 0; Skills.rideM = 0; H.pos.set(P.pos.x + 1, Col.ground(P.pos.x + 1, P.pos.z, 99), P.pos.z); H.yaw = -Math.PI / 2; H.speed = 0; P.mount && P.mount(H); HP.sim(1.5, X.F); Input.keys.add('w'); Input.keys.add('shift');
            let far = 0; for (let i = 0; i < 12; i++) { HP.Game.cam.yaw = -Math.PI / 2 + Math.sin(i) * 0.6; const x0 = H.pos.x, z0 = H.pos.z; HP.sim(2, X.F); far += Math.hypot(H.pos.x - x0, H.pos.z - z0); } Input.keys.clear(); return { ride: HP.S.skills.ride, riding: P.state, far: Math.round(far) }; })()""")  # open meadow, weaving so no single tree stops the horse
        check('skills: riding builds the Horseman skill', r['ride'] >= 1, r)
        r = await ev(pg, """(()=>{ UI.open('wren'); const html = document.getElementById('pBody').innerHTML; UI.close(); return { gun: html.includes('Gunslinger'), perk: html.includes('Heavy hands'), honor: html.includes('Drifter') || html.includes('Respected') || html.includes('Rough'), record: html.includes('Duels won') }; })()""")
        check('character page: the Wren tab shows standing, skills with perks, and a record of deeds', r['gun'] and r['perk'] and r['honor'] and r['record'], r)
        await ev(pg, "X.reset()")

        bad = [e for e in errs if 'favicon' not in e]
        check('no page errors', not bad, bad[:5])
        await b.close()
    n = sum(1 for _, ok, _ in RESULTS if ok); print(f"\n{n}/{len(RESULTS)} town checks passed")
    if n != len(RESULTS): raise SystemExit(1)

if __name__ == '__main__': asyncio.run(main())
