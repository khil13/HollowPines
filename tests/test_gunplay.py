"""Gunplay: RDR2-style aiming and shooting. Quick aim-in, a camera that keeps up with the mouse, a soft lock that snaps
onto the target when you aim, shots that land where the reticle points with head/body/leg zones, recoil kick that
settles back, spread that blooms with rapid fire, and reticle feedback."""
import asyncio, json
from run import boot
from playwright.async_api import async_playwright
RESULTS = []
def check(name, ok, info=''):
    RESULTS.append((name, bool(ok), str(info)[:400])); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{str(info)[:400]}]' if info else ''))
async def ev(pg, js): return await pg.evaluate(js)

H = r"""window.G = {
  F: 1 / 60,
  reset() { const P = HP.Game.player; Input.aimToggle = false; Input.mouse.lp = false; P.setWeapon('revolver'); HP.S.ammoClip.revolver = 6; P.cool = 0; P.bloom = 0; P.reloading = false;
    for (const n of HP.NPC.all.slice()) if (n.key && n.key.startsWith('dummy')) HP.NPC.despawn(n);
    HP.S.time.hour = 12; HP.tp(-100, -20); P.yaw = 0; HP.Game.cam.yaw = 0; HP.Game.cam.pitch = 0.1; HP.Game.cam.kickR = 0; HP.sim(0.6, this.F); },
  dummy(k, dx, dz) { const P = HP.Game.player; const n = HP.NPC.spawn({ key: 'dummy' + k, name: 'Target ' + k, x: P.pos.x + dx, z: P.pos.z + dz, lawful: false, state: 'scripted', wild: true, hp: 90, maxHp: 90, tags: ['generic'], look: { skin: '#e8b48c', shirt: '#7a3b3b', hair: '#3b2a1e', hatColor: '#2b2b2b' } });
    n.script = (dt, me) => { me.sp = 0; me.face(HP.Game.player.pos); }; n.hostileToPlayer = true; return n; },
  aimAt(x, y, z, frames = 40) { const C = HP.Game.cam; for (let i = 0; i < frames; i++) { const d = C.dir(), tx = x - C.pos.x, ty = y - C.pos.y, tz = z - C.pos.z; C.yaw += angDiff(Math.atan2(d.x, d.z), Math.atan2(tx, tz)); C.pitch -= Math.atan2(ty, Math.hypot(tx, tz)) - Math.asin(d.y); HP.sim(this.F, this.F); } },
  err(x, y, z) { const C = HP.Game.cam, d = C.dir(), v = new THREE.Vector3(x - C.pos.x, y - C.pos.y, z - C.pos.z).normalize(); return Math.acos(Math.min(1, d.dot(v))); },
  fire() { const P = HP.Game.player; P.cool = 0; Input.mouse.lp = true; HP.sim(this.F, this.F); Input.mouse.lp = false; },
};"""

async def main():
    async with async_playwright() as p:
        b, pg, errs = await boot(p)
        await pg.click('#bNew'); await pg.wait_for_timeout(600); await ev(pg, H)
        await ev(pg, "G.reset()")

        # --- aim-in speed: shoulder camera and zoom settle within a quarter second ---
        r = await ev(pg, "(()=>{ const C = HP.Game.cam; Input.aimToggle = true; HP.sim(0.25, G.F); return { dist: +C.dist.toFixed(3), fov: +C.cam.fov.toFixed(2), aiming: HP.Game.player.aiming }; })()")
        check('aim-in: over-the-shoulder camera and zoom settle within 0.25 s', r['aiming'] and abs(r['dist'] - 2.1) < 0.15 and abs(r['fov'] - 48) < 2, r)

        # --- no trailing: after a sharp mouse turn the view points where the camera yaw says within two frames ---
        r = await ev(pg, """(()=>{ const C = HP.Game.cam; Input.mouse.dx = 120; HP.sim(G.F, G.F); HP.sim(G.F, G.F); const d = C.dir(); const f = { x: Math.sin(C.yaw), z: Math.cos(C.yaw) };
            const lag = Math.acos(Math.min(1, (d.x * f.x + d.z * f.z) / Math.hypot(d.x, d.z))); return { lag: +lag.toFixed(4) }; })()""")
        check('aim: the view keeps up with a sharp mouse turn (no camera trail)', r['lag'] < 0.04, r)

        # --- soft lock: pressing aim swings the reticle onto a target slightly off-centre ---
        r = await ev(pg, """(()=>{ G.reset(); const n = G.dummy('A', Math.sin(0.25) * 15, Math.cos(0.25) * 15); HP.sim(0.3, G.F); const before = G.err(n.pos.x, n.pos.y + n.hitH, n.pos.z);
            Input.aimToggle = true; HP.sim(0.35, G.F); const P = HP.Game.player; return { before: +before.toFixed(3), after: +G.err(n.pos.x, n.pos.y + n.hitH, n.pos.z).toFixed(3), hover: P.hover && P.hover.h === n, red: document.getElementById('cross').classList.contains('lock') }; })()""")
        check('soft lock: aiming snaps the reticle onto a nearby target and it turns red', r['before'] > 0.15 and r['after'] < 0.03 and r['hover'] and r['red'], r)

        # --- hits land where the reticle points: head, body, legs ---
        r = await ev(pg, """(()=>{ G.reset(); Input.aimToggle = true; const n = G.dummy('H', 0, 14); HP.sim(0.4, G.F); G.aimAt(n.pos.x, n.pos.y + 1.6, n.pos.z); G.fire(); HP.sim(0.1, G.F);
            const head = { alive: n.alive, zone: HP.Game.player.lastHit && HP.Game.player.lastHit.zone, mark: document.getElementById('cross').classList.contains('head') };
            G.reset(); Input.aimToggle = true; const m = G.dummy('L', 0, 14); HP.sim(0.4, G.F); G.aimAt(m.pos.x, m.pos.y + 0.45, m.pos.z); G.fire(); HP.sim(0.1, G.F);
            const legs = { hp: m.hp, zone: HP.Game.player.lastHit && HP.Game.player.lastHit.zone };
            G.reset(); Input.aimToggle = true; const q = G.dummy('B', 0, 14); HP.sim(0.4, G.F); G.aimAt(q.pos.x, q.pos.y + 1.1, q.pos.z); G.fire(); HP.sim(0.1, G.F);
            return { head, legs, body: { hp: q.hp, zone: HP.Game.player.lastHit && HP.Game.player.lastHit.zone } }; })()""")
        check('shooting: a reticle on the head is a one-shot headshot kill with a red hit marker', not r['head']['alive'] and r['head']['zone'] == 'head' and r['head']['mark'], r['head'])
        check('shooting: body and leg shots land in their zones (legs do less damage)', r['body']['zone'] == 'body' and r['legs']['zone'] == 'legs' and r['legs']['hp'] > r['body']['hp'], f"{r['body']} {r['legs']}")

        # --- misses are misses: reticle clearly beside the target ---
        r = await ev(pg, """(()=>{ G.reset(); Input.aimToggle = true; const n = G.dummy('M', 0, 14); HP.sim(0.4, G.F); G.aimAt(n.pos.x + 2.5, n.pos.y + 1.1, n.pos.z); const hp0 = n.hp; let hits = 0;
            for (let i = 0; i < 4; i++) { HP.Game.player.lastHit = null; G.aimAt(n.pos.x + 2.5, n.pos.y + 1.1, n.pos.z, 8); HP.Game.player.bloom = 0; G.fire(); HP.sim(0.05, G.F); if (n.hp < hp0) hits++; } return { hits, hp: n.hp }; })()""")
        check('shooting: aiming 2.5 m beside a target misses every time (no dice rolls)', r['hits'] == 0, r)

        # --- recoil kick and recovery ---
        r = await ev(pg, """(()=>{ G.reset(); Input.aimToggle = true; HP.sim(0.4, G.F); const C = HP.Game.cam; const p0 = C.pitch; G.fire(); const kicked = p0 - C.pitch; HP.sim(0.5, G.F);
            return { kicked: +kicked.toFixed(4), back: +Math.abs(C.pitch - p0).toFixed(4) }; })()""")
        check('recoil: each shot kicks the view up and it settles back within half a second', r['kicked'] > 0.015 and r['back'] < 0.003, r)

        # --- spread blooms with rapid fire and recovers ---
        r = await ev(pg, """(()=>{ G.reset(); Input.aimToggle = true; HP.sim(0.4, G.F); const P = HP.Game.player; const s0 = P.spread(); G.fire(); P.cool = 0; G.fire(); const s2 = P.spread(); HP.sim(1.0, G.F);
            const s3 = P.spread(); const scale = parseFloat(document.getElementById('cross').style.getPropertyValue('--s')); return { s0: +s0.toFixed(4), s2: +s2.toFixed(4), s3: +s3.toFixed(4), scale }; })()""")
        check('spread: rapid shots bloom the spread (and the reticle), which settles within a second', r['s2'] > r['s0'] * 3 and r['s3'] < r['s0'] * 1.5 and r['scale'] < 1.4, r)

        # --- hunting still works with real hitboxes ---
        r = await ev(pg, """(()=>{ G.reset(); const P = HP.Game.player; const a = HP.Animal.spawn('deer', P.pos.x, P.pos.z + 14); a.state = 'graze'; a.scare = () => {}; HP.sim(0.3, G.F); Input.aimToggle = true; HP.sim(0.4, G.F);
            for (let i = 0; i < 4 && a.alive; i++) { HP.Game.player.cool = 0; G.fire(); HP.sim(0.4, G.F); } return { alive: a.alive, lock: HP.Game.player.lock === a || !a.alive }; })()""")
        check('hunting: aim snaps onto a deer and gunfire brings it down', not r['alive'], r)

        bad = [e for e in errs if 'favicon' not in e]
        check('no page errors', not bad, bad[:5])
        await b.close()
    n = sum(1 for _, ok, _ in RESULTS if ok); print(f"\n{n}/{len(RESULTS)} gunplay checks passed")
    if n != len(RESULTS): raise SystemExit(1)

if __name__ == '__main__': asyncio.run(main())
