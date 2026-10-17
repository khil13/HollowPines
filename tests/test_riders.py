"""Mounted enemies and weather that matters: posses ride out when you're wanted, riders shoot from the saddle, seated
hitboxes, shooting a rider or their horse brings them down, losing the law sends the posse home, bounty runners flee
on horseback, Crane ambushers ride in; rain/storm/fog shorten sight and muffle footsteps, storms throw lightning,
and mud slows horses."""
import asyncio, json
from run import boot
from playwright.async_api import async_playwright
RESULTS = []
def check(name, ok, info=''):
    RESULTS.append((name, bool(ok), str(info)[:400])); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{str(info)[:400]}]' if info else ''))
async def ev(pg, js): return await pg.evaluate(js)

H = r"""window.R = {
  F: 1 / 60,
  reset(weather = 'clear') { const S = HP.S, P = HP.Game.player; if (HP.Missions.failing) HP.Missions.acceptFail(); if (HP.Missions.active) HP.Missions.abandon(true); if (HP.Dialog.open) HP.Dialog.close();
    for (const n of HP.NPC.all.slice()) if (n.mount || n.tags.includes('posse') || n.tags.includes('random') || (n.key || '').startsWith('rt')) Riders.despawnRider ? (n.mount ? Riders.despawnRider(n) : HP.NPC.despawn(n)) : 0; for (const h of Riders.horses.slice()) h.remove();
    S.wanted = false; S.bounty = 0; Law.searchC = null; S.weather.kind = weather; S.weather.next = 99; Sky.wet = 0; S.time.hour = 13; S.p.hp = S.p.maxHp; P.inv = 1e9; Riders.posseCD = 0; Encounters.t = 1e9;
    for (const id of ['intro', 'm1']) HP.Missions.st(id).status = 'done'; HP.tp(60, -40); P.yaw = 0; HP.Game.cam.yaw = 0; HP.sim(0.5, this.F); },
  wanted() { HP.S.wanted = true; HP.S.bounty = 20; Law.searchC = { x: HP.Game.player.pos.x, z: HP.Game.player.pos.z }; Law.searchR = 70; Law.seenT = 0; },
  posse() { return HP.NPC.all.filter(n => n.tags.includes('posse')); },
  rider(o = {}) { const P = HP.Game.player; return Riders.spawnRider(Object.assign({ key: 'rt' + Math.floor(Math.random() * 1e6), name: 'Rider', lawful: false, gun: 'revolver', hp: 90, maxHp: 90, tags: ['generic'], look: { skin: '#e8b48c', shirt: '#5a3a2a', hatColor: '#1b1b1b' } }, o), o.mode || 'travel', P.pos.x, P.pos.z + 14, 0); },
};"""

async def main():
    async with async_playwright() as p:
        b, pg, errs = await boot(p)
        await pg.click('#bNew'); await pg.wait_for_timeout(600); await ev(pg, H)

        # ---------- posse ----------
        r = await ev(pg, "(()=>{ R.reset(); R.wanted(); HP.sim(1, R.F); const ps = R.posse(); return { n: ps.length, riding: ps.every(x => x.state === 'ride' && x.mount), d: ps.map(x => +x.distP.toFixed(0)) }; })()")
        check('posse: wanted out in the country, two lawmen ride out from Juniper Gap after you', r['n'] == 2 and r['riding'] and all(d > 70 for d in r['d']), r)
        r = await ev(pg, "(()=>{ const ps = R.posse(); let t = 0; while (t < 25 && Math.min(...ps.map(x => x.distP)) > 30) { R.wanted(); HP.sim(0.5, R.F); t += 0.5; } return { t, d: ps.map(x => +x.distP.toFixed(0)), sp: ps.map(x => +x.mount.speed.toFixed(1)) }; })()")
        check('posse: they gallop in and close the distance', min(r['d']) <= 30 and max(r['sp']) > 6, r)
        r = await ev(pg, "(()=>{ const P = HP.Game.player; P.inv = 0; HP.S.p.hp = 9999; const hp0 = HP.S.p.hp; let shots = 0; for (let i = 0; i < 100; i++) { R.wanted(); const before = FX.tracers.length, hp1 = HP.S.p.hp; HP.sim(0.25, R.F); if (FX.tracers.length > before || HP.S.p.hp < hp1) shots++; } /* a tracer can come and go between samples; a hit landing counts too */ P.inv = 1e9; return { shots, lost: hp0 - HP.S.p.hp }; })()")
        check('posse: riders shoot from the saddle', r['shots'] >= 2, r)
        r = await ev(pg, "(()=>{ HP.S.wanted = false; Law.searchC = null; for (const n of R.posse()) n.calm(); HP.sim(0.5, R.F); const modes = R.posse().map(x => x.rideMode); HP.tp(200, 150); let t = 0; while (t < 20 && R.posse().length) { HP.sim(0.5, R.F); t += 0.5; } return { modes, left: R.posse().length, horses: Riders.horses.length }; })()")
        check('posse: once you lose the law they turn back and ride off', all(m == 'leave' for m in r['modes']) and r['left'] == 0, r)

        # ---------- hitting riders ----------
        r = await ev(pg, """(()=>{ R.reset(); const n = R.rider(); n.dest = { x: n.pos.x, z: n.pos.z }; HP.sim(0.5, R.F); const C = HP.Game.cam.pos, aim = y => { const d = new THREE.Vector3(n.pos.x - C.x, y - C.y, n.pos.z - C.z).normalize(); const h = rayHit(C, d, 60, HP.Game.player); return h && h.h === n ? h.zone : (h ? 'other' : null); };
            return { head: aim(n.pos.y + 1.0), body: aim(n.pos.y + 0.35), horseHit: (() => { const d = new THREE.Vector3(n.mount.pos.x - C.x, n.mount.pos.y + 1.0 - C.y, n.mount.pos.z - C.z).normalize(); const h = rayHit(C, d, 60, HP.Game.player); return h && h.h === n.mount; })() }; })()""")
        check('riders: seated hitboxes (head and body line up on a rider; the horse is its own target)', r['head'] == 'head' and r['body'] == 'body' and r['horseHit'], r)
        r = await ev(pg, "(()=>{ R.reset(); const n = R.rider(); HP.sim(0.5, R.F); const h = n.mount; n.takeHit({ dmg: 999, from: HP.Game.player, gun: 'revolver', zone: 'head' }); HP.sim(0.5, R.F); return { dead: !n.alive, onGround: Math.abs(n.pos.y - Terrain.height(n.pos.x, n.pos.z)) < 0.4, riderless: !h.rider, bolting: h.fleeT > 0 || h.speed > 2 }; })()")
        check('riders: shot out of the saddle, the body falls and the horse bolts', r['dead'] and r['onGround'] and r['riderless'] and r['bolting'], r)
        r = await ev(pg, "(()=>{ R.reset(); const n = R.rider({ lawful: false }); HP.sim(0.5, R.F); const h = n.mount; h.takeHit({ dmg: 999, from: HP.Game.player, gun: 'revolver' }); HP.sim(0.3, R.F); const thrown = n.downed && !n.mount; HP.sim(5, R.F); return { horseDead: !h.alive, thrown, after: n.state }; })()")
        check('riders: shooting the horse throws the rider, who gets up and fights on foot', r['horseDead'] and r['thrown'] and r['after'] == 'combat', r)

        # ---------- bounty runner on horseback ----------
        r = await ev(pg, """(()=>{ R.reset(); HP.S.bounties = { posted: [{ o: 'lottie', h: 'antelope' }], next: 99, done: 0, active: null, recent: [] }; SIDE.accept(HP.S.bounties.posted[0]); HP.tp(170, 98); HP.sim(0.5, R.F);
            const t = HP.NPC.byKey('bgen_lottie'), P = HP.Game.player; P.crouch = false; t.state = 'patrol'; t.route = [{ x: t.pos.x, z: t.pos.z, wait: 99 }]; t.face(P.pos); HP.tp(t.pos.x, t.pos.z + 12); HP.sim(1.5, R.F); const d0 = t.distP; HP.sim(3, R.F);
            return { riding: t.state === 'ride' && !!t.mount, d0: +d0.toFixed(1), d1: +t.distP.toFixed(1), sp: t.mount ? +t.mount.speed.toFixed(1) : 0 }; })()""")
        check('bounty: a runner leaps on her horse and gallops off', r['riding'] and r['d1'] - r['d0'] > 10 and r['sp'] > 6, r)
        r = await ev(pg, "(()=>{ const t = HP.NPC.byKey('bgen_lottie'); t.mount.takeHit({ dmg: 999, from: HP.Game.player, gun: 'rifle' }); HP.sim(0.5, R.F); HP.tp(t.pos.x + 1, t.pos.z); HP.Game.player.yaw = -Math.PI / 2; HP.sim(0.2, R.F); return { downed: t.downed, alive: t.alive, opts: HP.opts() }; })()")
        check('bounty: shooting her horse throws her, stunned, ready to hogtie', r['downed'] and r['alive'] and any('Hogtie' in o for o in r['opts']), r)
        await ev(pg, "HP.Missions.abandon(true)")

        # ---------- mounted ambush ----------
        r = await ev(pg, "(()=>{ R.reset(); Encounters.craneAmbush(); HP.sim(0.3, R.F); const a = HP.NPC.all.filter(n => (n.key || '').startsWith('crane_amb')); return { n: a.length, mounted: a.every(x => x.state === 'ride' && x.mount && x.hostileToPlayer) }; })()")
        check('encounter: Crane gunmen ride in on horseback', r['n'] == 2 and r['mounted'], r)

        # ---------- weather ----------
        r = await ev(pg, """(()=>{ const out = {}; for (const w of ['clear', 'rain', 'storm', 'fog']) { R.reset(w); HP.tp(-100, -20); HP.sim(0.3, R.F); const P = HP.Game.player; const n = HP.NPC.spawn({ key: 'rtw_' + w, name: 'Watcher', x: P.pos.x, z: P.pos.z + 22, lawful: false, state: 'scripted', wild: true, tags: ['generic'] }); n.script = (dt, me) => { me.sp = 0; me.face(P.pos); };
            HP.sim(0.6, R.F); P.crouch = false; Input.keys.add('w'); HP.sim(0.3, R.F); out[w] = { sees: n.seesPlayer, mul: Sky.visMul(), noise: +P.noise.toFixed(2), label: document.getElementById('clock').textContent.split('·').pop().trim() }; Input.keys.clear(); HP.NPC.despawn(n); } return out; })()""")
        check('weather: someone 22 m away sees you in clear weather but not in fog', r['clear']['sees'] and not r['fog']['sees'], r)
        check('weather: sight shrinks with weather (clear > rain > storm > fog)', r['clear']['mul'] > r['rain']['mul'] > r['storm']['mul'] > r['fog']['mul'], {k: v['mul'] for k, v in r.items()})
        check('weather: rain and storms muffle your footsteps', r['rain']['noise'] < r['clear']['noise'] and r['storm']['noise'] < r['clear']['noise'], {k: v['noise'] for k, v in r.items()})
        check('weather: the HUD names thunderstorms and fog', r['storm']['label'] == 'Thunderstorm' and r['fog']['label'] == 'Fog', {k: v['label'] for k, v in r.items()})
        r = await ev(pg, "(()=>{ R.reset('storm'); const b0 = Sky.bolts || 0; let flash = 0; for (let i = 0; i < 900; i++) { HP.sim(R.F, R.F); flash = Math.max(flash, Sky.flash || 0); } /* every frame: a flash fades in a few frames */ return { bolts: (Sky.bolts || 0) - b0, flash: +flash.toFixed(2) }; })()")
        check('weather: thunderstorms throw lightning across the sky', r['bolts'] >= 1 and r['flash'] > 0.3, r)
        r = await ev(pg, """(()=>{ const top = wet => { R.reset(wet ? 'rain' : 'clear'); Sky.wet = wet; const h = new NPCHorse(HP.Game.player.pos.x + 20, HP.Game.player.pos.z, 0); for (let i = 0; i < 240; i++) { Sky.wet = wet; h.steer(h.pos.x, h.pos.z + 50, 12, R.F); } const s = h.speed; h.remove(); return +s.toFixed(2); };
            return { dry: top(0), mud: top(1) }; })()""")
        check('weather: mud slows horses down', r['mud'] < r['dry'] * 0.9, r)

        bad = [e for e in errs if 'favicon' not in e]
        check('no page errors', not bad, bad[:5])
        await b.close()
    n = sum(1 for _, ok, _ in RESULTS if ok); print(f"\n{n}/{len(RESULTS)} rider and weather checks passed")
    if n != len(RESULTS): raise SystemExit(1)

if __name__ == '__main__': asyncio.run(main())
