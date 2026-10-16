"""Close-range combat and squad tactics: counters, grabs and shoves; leg, hand and body shots change how people
react (limp, disarm, flinch); outlaw squads flank, get pinned by near misses and rush while you reload."""
import asyncio
from run import boot
from playwright.async_api import async_playwright
RESULTS = []
def check(name, ok, info=''):
    RESULTS.append((name, bool(ok), str(info)[:400])); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{str(info)[:400]}]' if info else ''))
async def ev(pg, js): return await pg.evaluate(js)

H = r"""window.X = {
  F: 1 / 60,
  reset() { const P = HP.Game.player; if (HP.Missions.active) HP.Missions.abandon(true); Brawl.clear(); for (const n of HP.NPC.all.slice()) if (n.key && n.key.startsWith('br')) HP.NPC.despawn(n); Input.keys.clear(); Input.mouse.lp = false; Input.aimToggle = false;
    HP.S.time.hour = 12; HP.tp(-100, -20); P.yaw = 0; HP.Game.cam.yaw = 0; HP.Game.cam.pitch = 0.1; P.inv = 1e9; P.setWeapon('fists'); HP.S.p.hp = HP.S.p.maxHp; HP.S.p.st = HP.S.p.maxSt; Tactics.cd = 0; HP.sim(0.6, this.F); },
  foe(key, dz, o = {}) { const P = HP.Game.player; const n = HP.NPC.spawn(Object.assign({ key, name: 'Outlaw', x: P.pos.x + (o.dx || 0), z: P.pos.z + dz, lawful: false, wild: true, hp: 300, maxHp: 300, tags: ['generic'] }, o)); n.brave = o.brave ?? 0.9; return n; },
  click() { Input.mouse.lp = true; HP.sim(this.F, this.F); Input.mouse.lp = false; },
  tap(k) { Input.pressed.add(k); HP.sim(this.F, this.F); },
  d(n) { const P = HP.Game.player; return Math.hypot(n.pos.x - P.pos.x, n.pos.z - P.pos.z); },
};"""

async def main():
    async with async_playwright() as p:
        b, pg, errs = await boot(p)
        await pg.click('#bNew'); await pg.wait_for_timeout(600); await ev(pg, H)

        # --- counters ---
        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; P.inv = 0; const n = X.foe('brA', 1.3); n.fightPlayer(true); n.shootT = 0.2; n.windT = 0; let w = 0;
            for (let i = 0; i < 120 && !n.windT; i++) HP.sim(X.F, X.F); w = n.windT; const hp0 = HP.S.p.hp, c0 = HP.S.stats.counters || 0; Input.keys.add('q'); HP.sim(0.7, X.F); Input.keys.delete('q');
            return { windup: w > 0, counters: (HP.S.stats.counters || 0) - c0, hpLost: +(hp0 - HP.S.p.hp).toFixed(1), stunned: n.stunT > 0 || n.hp < 300, foeHp: n.hp }; })()""")
        check('melee: raising the guard just as a punch comes in counters it: no damage, and the attacker reels and gets hit back', r['windup'] and r['counters'] == 1 and r['hpLost'] == 0 and r['stunned'] and r['foeHp'] < 300, r)
        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; P.inv = 0; const n = X.foe('brB', 1.3); n.fightPlayer(true); Input.keys.add('q'); HP.sim(1.2, X.F); n.shootT = 0.05; n.windT = 0; const hp0 = HP.S.p.hp, c0 = HP.S.stats.counters || 0;
            for (let i = 0; i < 120 && hp0 === HP.S.p.hp; i++) HP.sim(X.F, X.F); Input.keys.delete('q'); return { counters: (HP.S.stats.counters || 0) - c0, hpLost: +(hp0 - HP.S.p.hp).toFixed(1) }; })()""")
        check('melee: a guard held up long before the punch only blocks (most of the damage soaked, no counter)', r['counters'] == 0 and 0 < r['hpLost'] <= 3, r)

        # --- grab, punch, shove ---
        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; const n = X.foe('brC', 1.1); n.fightPlayer(true); n.shootT = 99; Input.keys.add('q'); HP.sim(X.F, X.F); X.click(); Input.keys.delete('q'); HP.sim(0.1, X.F); const grabbed = P.grab === n && n.grabbed;
            const hp0 = n.hp; P.cool = 0; X.click(); HP.sim(0.6, X.F); const punched = hp0 - n.hp; const held = P.grab === n; const d0 = X.d(n); X.tap('x'); HP.sim(0.6, X.F);
            return { grabbed, punched: +punched.toFixed(1), held, shoved: P.grab === null && n.floorT > 0, moved: +(X.d(n) - d0).toFixed(2), standsUp: (HP.sim(2.5, X.F), n.floorT <= 0 && n.alive) }; })()""")
        check('melee: block + attack grabs an outlaw; attack while holding punches them, X shoves them to the ground and they get back up', r['grabbed'] and r['punched'] >= 15 and r['held'] and r['shoved'] and r['moved'] > 1.2 and r['standsUp'], r)
        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; const n = X.foe('brE', 1.1); n.fightPlayer(true); n.shootT = 99; Input.keys.add('q'); HP.sim(X.F, X.F); X.click(); Input.keys.delete('q'); const g = P.grab === n; HP.sim(3.6, X.F); return { g, free: !P.grab && !n.grabbed }; })()""")
        check('melee: hold someone too long and they wriggle free', r['g'] and r['free'], r)

        # --- where a bullet lands ---
        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; const n = X.foe('brD', 14, { gun: 'revolver' }); n.script = (dt, me) => { me.moveTo(me.pos.x + 10, me.pos.z, 4.6, dt); }; n.state = 'scripted'; HP.sim(0.3, X.F);
            n.takeHit({ dmg: 10, from: P, gun: 'revolver', zone: 'legs', dir: fwd(P.yaw) }); n.stunT = 0; HP.sim(1, X.F); return { limp: n.limpT > 0, sp: +n.sp.toFixed(2) }; })()""")
        check('gunshots: a leg shot leaves them limping (they can barely run)', r['limp'] and r['sp'] <= 1.85, r)
        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; const n = X.foe('brG', 12, { gun: 'revolver' }); n.fightPlayer(); n.shootT = 99; HP.sim(0.6, X.F); n.shootT = 99;
            const hand = new THREE.Vector3(); n.rig.R.hand.getWorldPosition(hand); const o = HP.Game.cam.pos.clone(), dir = hand.clone().sub(o).normalize(); const hit = rayHit(o, dir, 45, P);
            const body = rayHit(o, new THREE.Vector3(n.pos.x, n.pos.y + 1.1, n.pos.z).sub(o).normalize(), 45, P); return { zone: hit && hit.h === n ? hit.zone : null, body: body && body.zone }; })()""")
        check('gunshots: a ray through the outlaw’s gun hand counts as a hand hit (a chest ray is still a body hit)', r['zone'] == 'hand' and r['body'] == 'body', r)
        r = await ev(pg, """(()=>{ const P = HP.Game.player, n = HP.NPC.byKey('brG'); n.takeHit({ dmg: 14, from: P, gun: 'revolver', zone: 'hand', dir: fwd(P.yaw) }); const dis = { gun: n.gun, drops: Brawl.drops.length, regun: !!n.regun };
            HP.sim(4, X.F); return Object.assign(dis, { reGunned: n.gun === 'revolver' && !n.fists, dropsAfter: Brawl.drops.length }); })()""")
        check('gunshots: shooting the gun hand knocks the gun to the ground; a brave outlaw dives for it and picks it back up', r['gun'] is None and r['drops'] == 1 and r['regun'] and r['reGunned'] and r['dropsAfter'] == 0, r)
        r = await ev(pg, """(()=>{ const P = HP.Game.player, n = HP.NPC.byKey('brG'); n.brave = 0; n.takeHit({ dmg: 1, from: P, gun: 'revolver', zone: 'hand' }); const dr = Brawl.drops[0]; const a0 = Inv.count('ammo_rev'); n.stunT = 5;
            HP.tp(dr.x, dr.z); HP.sim(0.2, X.F); return { took: Brawl.drops.length === 0, ammo: Inv.count('ammo_rev') - a0, fists: n.fists }; })()""")
        check('gunshots: walk over a dropped gun to take it (and its rounds); the disarmed outlaw is left with their fists', r['took'] and r['ammo'] == 3 and r['fists'], r)
        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; const n = X.foe('brH', 12, { gun: 'revolver' }); n.fightPlayer(); HP.sim(0.3, X.F); n.shootT = 0.05; n.takeHit({ dmg: 1, from: P, gun: 'revolver', zone: 'body' }); return { flinch: n.stunT > 0, delay: n.shootT >= 0.8 }; })()""")
        check('gunshots: a body hit makes them flinch and throws off their next shot', r['flinch'] and r['delay'], r)

        # --- squad tactics ---
        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; const n = X.foe('brI', 15, { gun: 'revolver' }); n.fightPlayer(); HP.sim(0.3, X.F);
            const a = new THREE.Vector3(P.pos.x, P.pos.y + 1.4, P.pos.z), b = new THREE.Vector3(n.pos.x + 0.9, n.pos.y + 1.2, n.pos.z + 6); Tactics.nearMiss(a, b, null); const pinned = n.suppressT > 0;
            const m = X.foe('brJ', 15, { dx: 12, gun: 'revolver' }); m.fightPlayer(); HP.sim(0.1, X.F); Tactics.nearMiss(a, b, null); return { pinned, farOk: !(m.suppressT > 0) }; })()""")
        check('squads: a bullet whizzing past pins an outlaw down (one well clear of it keeps shooting)', r['pinned'] and r['farOk'], r)
        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; const n = X.foe('brK', 13, { gun: 'revolver' }); n.fightPlayer(); HP.sim(0.6, X.F); const d0 = X.d(n); P.reloading = true; Tactics.t = 0; Tactics.update(X.F); const rush = n.rushT > 0;
            HP.sim(1.2, X.F); P.reloading = false; return { rush, closed: +(d0 - X.d(n)).toFixed(1) }; })()""")
        check('squads: reload in the open and the nearest outlaw charges you', r['rush'] and r['closed'] > 2.5, r)
        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; const ns = [0, 1, 2, 3].map(i => X.foe('brL' + i, 24, { dx: (i - 1.5) * 3, gun: 'revolver' })); ns.forEach(n => n.fightPlayer()); HP.sim(0.6, X.F); Tactics.t = 0; Tactics.update(X.F);
            const f = ns.find(n => n.flanker); if (!f) return { flankers: 0 }; const d0 = Math.hypot(f.pos.x - f.flankTo.x, f.pos.z - f.flankTo.z); const side = Math.abs(Math.atan2(f.flankTo.x - P.pos.x, f.flankTo.z - P.pos.z));
            HP.sim(2, X.F); return { flankers: ns.filter(n => n.flanker).length, toward: +(d0 - Math.hypot(f.pos.x - f.flankTo.x, f.pos.z - f.flankTo.z)).toFixed(1), side: +side.toFixed(2) }; })()""")
        check('squads: with four outlaws, one swings around to the player’s side instead of waiting in front', r['flankers'] == 1 and r['toward'] > 3 and r['side'] > 0.9, r)
        await ev(pg, "X.reset()")

        bad = [e for e in errs if 'favicon' not in e]
        check('no page errors', not bad, bad[:5])
        await b.close()
    n = sum(1 for _, ok, _ in RESULTS if ok); print(f"\n{n}/{len(RESULTS)} brawl checks passed")
    if n != len(RESULTS): raise SystemExit(1)

if __name__ == '__main__': asyncio.run(main())
