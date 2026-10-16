"""Atmosphere and combat effects: the sun's arc matches the day, a long golden hour, dark nights where lanterns
matter, valley mist at dawn, and gunfight effects (muzzle flash and smoke, dirt where misses land, blood on hits,
enemy muzzle smoke, gallop dust) that clean themselves up."""
import asyncio, json
from run import boot
from playwright.async_api import async_playwright
RESULTS = []
def check(name, ok, info=''):
    RESULTS.append((name, bool(ok), str(info)[:400])); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{str(info)[:400]}]' if info else ''))
async def ev(pg, js): return await pg.evaluate(js)

H = r"""window.X = {
  F: 1 / 60,
  at(hour) { HP.S.weather.kind = 'clear'; HP.S.weather.next = 99; Sky.cloud = 0; HP.S.time.hour = hour; HP.sim(0.05, this.F); HP.S.time.hour = hour; HP.sim(this.F, this.F); return { golden: +Sky.golden.toFixed(2), sunUp: Sky.sunM.visible && Sky.sunM.position.y > HP.Game.cam.pos.y, hemi: +Sky.hemi.intensity.toFixed(3), amb: +Sky.amb.intensity.toFixed(3), lamp: Game.lamps.length ? +Game.lamps[0].intensity.toFixed(2) : null, mist: +Sky.mistU.uOp.value.toFixed(2), sunR: +Sky.sun.color.r.toFixed(2), sunB: +Sky.sun.color.b.toFixed(2) }; },
  sprites(near, r = 2.5) { return FX.parts.filter(p => p.sprite && (!near || p.m.position.distanceTo(near) < r)); },
  reset() { const P = HP.Game.player; if (HP.Missions.active) HP.Missions.abandon(true); for (const n of HP.NPC.all.slice()) if (n.key && n.key.startsWith('fx')) HP.NPC.despawn(n); HP.S.time.hour = 12; HP.tp(-100, -20); P.yaw = 0; HP.Game.cam.yaw = 0; HP.Game.cam.pitch = 0.1; P.inv = 1e9; P.setWeapon('revolver'); HP.S.ammoClip.revolver = 6; Input.aimToggle = false; HP.sim(0.3, this.F); HP.sim(3, this.F); },
  fire() { const P = HP.Game.player; P.cool = 0; Input.mouse.lp = true; HP.sim(this.F, this.F); Input.mouse.lp = false; },
};"""

async def main():
    async with async_playwright() as p:
        b, pg, errs = await boot(p)
        await pg.click('#bNew'); await pg.wait_for_timeout(600); await ev(pg, H)
        await ev(pg, "HP.Missions.abandon(true); HP.tp(-100, -20); HP.sim(0.3)")

        # --- light and atmosphere ---
        noon, gold, night, dawn = [await ev(pg, f"X.at({h})") for h in (12.5, 19.3, 23.2, 6.4)]
        check('sky: the sun is still up at 19:20 and the golden hour is in full swing, warm orange light', gold['sunUp'] and gold['golden'] > 0.5 and gold['sunR'] > 0.9 and gold['sunB'] < 0.5, gold)
        check('sky: noon is plain daylight (no golden tint)', noon['golden'] < 0.05 and noon['sunUp'], noon)
        check('sky: nights are dark (low ambient light) and the street lamps burn brighter', night['hemi'] < 0.2 and night['amb'] < 0.08 and night['lamp'] and night['lamp'] > 1.5 and night['hemi'] < noon['hemi'] / 3, f"night={night} noon={noon}")
        check('sky: low mist fills the valleys at dawn and burns off by noon', dawn['mist'] > 0.35 and noon['mist'] < 0.15, f"dawn={dawn['mist']} noon={noon['mist']}")

        # --- combat effects ---
        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; Input.aimToggle = true; HP.sim(0.4, X.F); HP.Game.cam.pitch = 0.45; HP.sim(0.2, X.F); const n0 = X.sprites().length; X.fire(); HP.sim(0.02, X.F);
            const m = new THREE.Vector3(); P.rig.R.hand.getWorldPosition(m); const muzzle = X.sprites(m, 1.6).length, flash = FX.parts.some(p => p.sprite && p.m.material.blending === THREE.AdditiveBlending);
            const dir = HP.Game.cam.dir(), g = FX.groundHit(HP.Game.cam.pos, dir, 45); const dirt = g ? X.sprites(g, 2).length : 0; return { n0, muzzle, flash, dirt, ground: !!g }; })()""")
        check('gunfire: each shot throws a muzzle flash and a cloud of powder smoke', r['flash'] and r['muzzle'] >= 3, r)
        check('gunfire: a missed shot kicks up dirt where it hits the ground', r['ground'] and r['dirt'] >= 2, r)
        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; const n = HP.NPC.spawn({ key: 'fxA', name: 'Target', x: P.pos.x, z: P.pos.z + 12, lawful: false, state: 'scripted', wild: true, hp: 500, maxHp: 500, tags: ['generic'] }); n.script = (dt, me) => { me.sp = 0; };
            HP.sim(0.3, X.F); n.takeHit({ dmg: 10, from: P, gun: 'revolver', zone: 'body' }); HP.sim(0.02, X.F); const chest = new THREE.Vector3(n.pos.x, n.pos.y + 1.1, n.pos.z);
            return { blood: FX.parts.filter(p => p.sprite && p.m.material.color.r > 0.5 && p.m.material.color.g < 0.2 && p.m.position.distanceTo(chest) < 1.5).length }; })()""")
        check('gunfire: a hit draws a puff of blood', r['blood'] >= 2, r)
        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; const n = HP.NPC.spawn({ key: 'fxB', name: 'Outlaw', x: P.pos.x, z: P.pos.z + 12, lawful: false, gun: 'revolver', wild: true, hp: 500, maxHp: 500, tags: ['generic'] }); n.fightPlayer(); HP.sim(0.5, X.F); let near = 0;
            for (let i = 0; i < 6 && !near; i++) { n.shootT = 0; n.seesPlayer = true; HP.sim(X.F * 2, X.F); const m = new THREE.Vector3(); n.rig.R.hand.getWorldPosition(m); near = X.sprites(m, 1.8).length; } return { near }; })()""")
        check('gunfire: enemies\' shots smoke at the muzzle too', r['near'] >= 2, r)
        r = await ev(pg, "(()=>{ for (const n of HP.NPC.all.slice()) if (n.key && n.key.startsWith('fx')) HP.NPC.despawn(n); HP.sim(3.5, X.F); return { left: X.sprites().length }; })()")  # stop the shooter first, or a late shot leaves fresh smoke
        check('effects: smoke, dust and blood fade and clean up within a few seconds', r['left'] == 0, r)
        r = await ev(pg, """(()=>{ X.reset(); const H = HP.Game.horse; H.pos.set(-90, H.pos.y, -20); H.yaw = 0; const n0 = X.sprites().length; let made = 0; for (let i = 0; i < 40; i++) { H.speed = 12; H.onG = true; HP.sim(X.F, X.F); } const b = fwd(H.yaw);
            return { dust: X.sprites().filter(p => p.m.position.y < H.pos.y + 1.5).length, speed: +H.speed.toFixed(1) }; })()""")
        check('horses: a galloping horse kicks up a trail of dust', r['dust'] >= 4, r)

        bad = [e for e in errs if 'favicon' not in e]
        check('no page errors', not bad, bad[:5])
        await b.close()
    n = sum(1 for _, ok, _ in RESULTS if ok); print(f"\n{n}/{len(RESULTS)} graphics checks passed")
    if n != len(RESULTS): raise SystemExit(1)

if __name__ == '__main__': asyncio.run(main())
