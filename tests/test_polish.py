"""Polish pass regressions: each check pins down a bug found in the full-game review so it can't come back."""
import asyncio
from run import boot
from playwright.async_api import async_playwright
RESULTS = []
def check(name, ok, info=''):
    RESULTS.append((name, bool(ok), str(info)[:400])); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{str(info)[:400]}]' if info else ''))
async def ev(pg, js): return await pg.evaluate(js)

H = r"""window.X = {
  F: 1 / 30,
  reset(x = -100, z = -20) { const P = HP.Game.player; if (HP.Missions.active) HP.Missions.abandon(true); Town.clear(); Brawl.clear(); for (const n of HP.NPC.all.slice()) if (n.key && n.key.startsWith('po')) HP.NPC.despawn(n); Input.reset();
    HP.S.time.hour = 12; HP.S.weather.kind = 'clear'; HP.S.weather.next = 99; HP.S.bounty = 0; HP.S.wanted = false; HP.tp(x, z); P.yaw = 0; HP.Game.cam.yaw = 0; P.inv = 1e9; HP.S.p.hp = HP.S.p.maxHp; HP.S.p.st = HP.S.p.maxSt; if (P.carry) P.dropCarry(); P.setWeapon('fists'); HP.sim(0.5, this.F); },
  foe(key, dz, o = {}) { const P = HP.Game.player; const n = HP.NPC.spawn(Object.assign({ key, name: 'Outlaw', x: P.pos.x + (o.dx || 0), z: P.pos.z + dz, lawful: false, wild: true, hp: 300, maxHp: 300, tags: ['generic'] }, o)); n.brave = o.brave ?? 0.9; return n; },
};"""

async def main():
    async with async_playwright() as p:
        b, pg, errs = await boot(p)
        await pg.click('#bNew'); await pg.wait_for_timeout(600); await ev(pg, H)
        await ev(pg, "(()=>{ for (const id of ['intro', 'm1']) HP.Missions.st(id).status = 'done'; HP.S.chapter = 2; })()")

        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; P.inv = 0; const n = X.foe('poA', 1.3); n.fightPlayer(true); n.stunT = 0.4; HP.sim(1, X.F); const st = n.stunT; const hp0 = HP.S.p.hp; n.shootT = 0.05;
            for (let i = 0; i < 90 && HP.S.p.hp === hp0; i++) HP.sim(X.F, X.F); return { st, hurt: hp0 - HP.S.p.hp }; })()""")
        check('combat: after a stun wears off, an enemy\'s punches hurt again (stun ends at exactly 0)', r['st'] == 0 and r['hurt'] > 0, r)
        r = await ev(pg, """(()=>{ X.reset(); const n = Riders.spawnRider({ key: 'poR', name: 'Rider', lawful: false, gun: 'revolver', tags: ['generic'] }, 'chase', -90, -10, 0); const h = n.mount; HP.sim(0.2, X.F); HP.NPC.despawn(n); const gone1 = !Riders.horses.includes(h);
            const n2 = Riders.spawnRider({ key: 'poR2', name: 'Rider', lawful: false, gun: 'revolver', tags: ['generic'] }, 'chase', -90, -10, 0); HP.sim(0.2, X.F); HP.Game.restoreFromState(); return { gone1, after: Riders.horses.length }; })()""")
        check('riders: despawning a rider (or loading a save) takes the horse too: no saddled horses frozen in place', r['gone1'] and r['after'] == 0, r)
        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; const n = X.foe('poC', 3, { gun: 'revolver' }); n.fightPlayer(); HP.sim(0.3, X.F); n.takeHit({ dmg: 1, from: P, gun: 'revolver', zone: 'hand' }); const ko = X.foe('poD', 1, { lawful: false }); ko.knockdown();
            ko.hogtied = true; P.pickCarry(ko.asCarry()); HP.sim(1, X.F); P.weapon = 'revolver'; HP.S.ammoClip.revolver = 6; P.cool = 0; Input.mouse.lp = true; HP.sim(X.F, X.F); Input.mouse.lp = false; return { carrying: !!P.carry, clip: HP.S.ammoClip.revolver, alive: ko.alive }; })()""")
        check('carry: no shooting with someone over your shoulder (hip fire used to hit them)', r['carrying'] and r['clip'] == 6 and r['alive'], r)
        r = await ev(pg, """(()=>{ X.reset(); const n = Riders.spawnRider({ key: 'poE', name: 'Rider', lawful: false, gun: 'revolver', tags: ['generic'], accuracy: 1 }, 'chase', -100, -8, Math.PI); n.hostileToPlayer = true; HP.sim(0.3, X.F); n.takeHit({ dmg: 1, from: HP.Game.player, gun: 'revolver', zone: 'hand' });
            const speed = n.mount.speed, st = n.stunT || 0; const hp0 = HP.S.p.hp; HP.Game.player.inv = 0; for (let i = 0; i < 6; i++) { n.shootT = 0; n.seesPlayer = true; HP.sim(0.1, X.F); } const r = { gun: n.gun, stunned: st > 0, hurt: hp0 - HP.S.p.hp }; Riders.despawnRider(n); return r; })()""")
        check('riders: shooting a rider\'s gun hand disarms them without freezing the horse, and they stop shooting', r['gun'] is None and not r['stunned'] and r['hurt'] == 0, r)
        r = await ev(pg, """(()=>{ X.reset(-40, 24); const n = HP.NPC.spawn({ key: 'poF', name: 'Townsman', x: -46, z: 23, lawful: true, brave: 0.2, tags: ['generic'] }); n.state = 'routine'; HP.sim(0.2, X.F); Town.shot(-40, 24, null); n.hearShot({ x: -40, z: 24 }, HP.Game.player); const p1 = n.panicked && n.state === 'scripted';
            n.hearShot({ x: -40, z: 24 }, HP.Game.player); const stay = n.state === 'scripted'; n.knockdown(); HP.sim(0.1, X.F); return { p1, stay, cleared: !n.panicked && !n.crouchC }; })()""")
        check('town: a hiding townsperson stays hidden at the next shot, and being knocked down clears the panic', r['p1'] and r['stay'] and r['cleared'], r)
        r = await ev(pg, """(()=>{ X.reset(-150, -60); HP.S.bounty = 20; HP.S.money = 40; Town.huntCD = 0; HP.sim(0.2, X.F); const P = HP.Game.player; for (const h of Town.hunters()) h.pos.set(P.pos.x + 8, h.pos.y, P.pos.z); const wolf = { tags: [] }; P.inv = 0; P.knockout(wolf); HP.sim(4.2, X.F); const r = { bounty: HP.S.bounty }; for (const h of Town.hunters()) Riders.despawnRider(h); return r; })()""")
        check('hunters: a knockout by something else (a wolf, a fall) doesn\'t count as the hunters hauling you in', r['bounty'] == 20, r)
        r = await ev(pg, """(()=>{ X.reset(-150, -90); HP.S.camp = null; Camp.fire && Camp.pack(); HP.S.inv.kit = 1; Camp.spawn(-150, -88); HP.S.camp = { x: -150, z: -88 }; HP.Save.save(true, 3); HP.Save.load(3); return { camp: !!HP.S.camp, fire: !!Camp.fire }; })()""")
        check('camp: loading a save made at camp keeps the camp (it used to be packed away)', r['camp'] and r['fire'], r)
        r = await ev(pg, """(()=>{ X.reset(); HP.Missions.st('bounty_rook').status = 'available'; HP.Missions.start('bounty_rook'); HP.sim(0.2, X.F); HP.Missions.advance(); HP.sim(0.2, X.F); HP.Save.save(true, 2); HP.Save.load(2); HP.sim(0.2, X.F);
            HP.Missions.fail('test'); HP.sim(0.2, X.F); const paused = HP.Game.time; HP.Missions.retry(); HP.sim(0.2, X.F); const r = { stage: HP.Missions.st('bounty_rook').stage, active: HP.Missions.active, rooks: HP.NPC.all.filter(n => n.key === 'rook').length }; HP.Missions.abandon(true); return r; })()""")
        check('missions: retrying after loading a mid-mission save restarts cleanly from the first stage (no doubled spawns)', r['stage'] == 0 and r['active'] == 'bounty_rook' and r['rooks'] <= 1, r)
        r = await ev(pg, """(()=>{ X.reset(-55, 30); const mae = HP.NPC.byKey('mae'); if (!mae) return { mae: false }; const c0 = HP.S.stats.crimes; mae.takeHit({ dmg: 999, from: HP.Game.player, gun: 'revolver', zone: 'head' }); return { mae: true, alive: mae.alive, downed: mae.downed, fate: HP.S.chars.mae }; })()""")
        check('story: Mae is essential: shot, she goes down but lives (the main story can\'t silently end)', r['mae'] and r['alive'] and r['downed'] and r['fate'] != 'dead', r)
        r = await ev(pg, """(()=>{ HP.S.chars.sal = 'dead'; HP.S.chars.dutchy = 'ally'; const sal = HP.NPC.spawn({ key: 'sal', name: 'Sal', x: -100, z: -10, lawful: false, tags: ['generic'] }); sal.setDead(true); const lead = CH5.lead(); HP.NPC.despawn(sal); return { lead: lead ? lead.key : null }; })()""")
        check('story: Chapter 5\'s Crane plan never hands the lead to a dead man', r['lead'] != 'sal', r)
        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; HP.S.weapons.revolver = 1; P.setWeapon('fists'); HP.sim(0.5, X.F); dispatchEvent(new KeyboardEvent('keydown', { key: '@', code: 'Digit2' })); HP.sim(X.F, X.F); dispatchEvent(new KeyboardEvent('keyup', { key: '@', code: 'Digit2' })); return { w: P.weapon }; })()""")
        check('input: Shift+2 (sent as "@") still draws the revolver', r['w'] == 'revolver', r)
        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; P.setWeapon('revolver'); HP.sim(0.5, X.F); const am = document.getElementById('ammo'); return { shown: !am.hidden, text: am.textContent }; })()""")
        check('hud: the desktop ammo counter shows with a gun drawn (a stray comment had hidden it)', r['shown'] and '|' in r['text'], r)
        r = await ev(pg, "(()=>{ const out = []; for (const [k, l] of World.canopy) { out.push(l[0]); if (out.length > 3) break; } const c = out[0]; return { some: World.canopy.size > 20, inside: World.inCanopy(c[0], c[1], c[2]), below: World.inCanopy(c[0] + 0.01, c[1] - c[3] * 2, c[2]) }; })()")
        check('camera: tree canopies are solid to the camera (no more views from inside the leaves)', r['some'] and r['inside'] and not r['below'], r)
        r = await ev(pg, """(()=>{ X.reset(); HP.S.time.hour = 23; HP.sim(0.1, X.F); const mae = HP.NPC.byKey('mae'); if (!mae) return {}; HP.sim(0.1, X.F); mae.downed = false; mae.hp = mae.maxHp; mae.state = 'routine'; mae.atPlace = true; mae.act = 'sleep'; mae.wakeT = 0; const P = HP.Game.player; P.crouch = false; const o = mae.it.opts(P).map(x => x.label); P.crouch = true; const sneak = mae.it.opts(P).length; P.crouch = false; HP.S.time.hour = 12; return { o, sneak }; })()""")
        check('npcs: a sleeping Mae can be woken (standing, not when sneaking) so night-time missions don\'t stall', r.get('o') == ['Wake Mae Holloway'] and r.get('sneak') == 0, r)
        r = await ev(pg, "(()=>{ const pz = Town.poster.position.z; return { z: +pz.toFixed(2) }; })()")
        check('town: Wren\'s wanted poster hangs on the street side of the sheriff\'s office', r['z'] > 11, r)
        r = await ev(pg, """(()=>{ X.reset(); HP.S.time.hour = 23; HP.sim(0.2, X.F); const night = { hemi: Sky.hemi.intensity, amb: Sky.amb.intensity }; HP.S.time.hour = 12; HP.sim(0.1, X.F); return night; })()""")
        check('night: dark but readable (a little more moonlight than before)', 0.15 < r['hemi'] < 0.2 and 0.06 < r['amb'] < 0.08, r)
        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; const n = X.foe('poG', 1.1); n.fightPlayer(true); n.shootT = 99; Input.keys.add('q'); HP.sim(X.F, X.F); Input.mouse.lp = true; HP.sim(X.F, X.F); Input.mouse.lp = false; Input.keys.delete('q');
            HP.Game.cam.idleT = 1; HP.sim(1.2, X.F); const r = { grab: P.grab === n, cine: +HP.Game.cam.cine.toFixed(2), dist: +HP.Game.cam.dist.toFixed(2), foe: HP.Game.cam.closeFoe === n }; Brawl.release(P); HP.NPC.despawn(n); HP.sim(2, X.F); r.after = +HP.Game.cam.cine.toFixed(2); return r; })()""")
        check('camera: a grab pulls the camera in over the shoulder to frame both fighters, and it eases back out after', r['grab'] and r['cine'] > 0.8 and r['dist'] < 3 and r['foe'] and r['after'] < 0.3, r)
        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; P.inv = 0; const n = X.foe('poH', 6, { gun: 'revolver' }); HP.sim(0.2, X.F); const z0 = P.pos.z; P.hurt(10, n, 'gun'); const st = P.stagger; HP.sim(0.3, X.F); const back = z0 - P.pos.z;
            HP.S.p.hp = HP.S.p.maxHp * 0.2; Input.keys.add('w'); Input.keys.add('shift'); HP.sim(1.5, X.F); const sp = Math.hypot(P.vel.x, P.vel.z); Input.keys.clear(); HP.S.p.hp = HP.S.p.maxHp; return { st: +st.toFixed(2), back: +back.toFixed(2), limp: +sp.toFixed(2), jog: PLAYER.JOG }; })()""")
        check('wren: a hit knocks her back a step and staggers her; badly hurt, she limps and can\'t run', r['st'] > 0.3 and r['back'] > 0.2 and r['limp'] <= r['jog'] * 0.81, r)
        await ev(pg, "X.reset()")

        bad = [e for e in errs if 'favicon' not in e]
        check('no page errors', not bad, bad[:5])
        await b.close()
    n = sum(1 for _, ok, _ in RESULTS if ok); print(f"\n{n}/{len(RESULTS)} polish checks passed")
    if n != len(RESULTS): raise SystemExit(1)

if __name__ == '__main__': asyncio.run(main())
