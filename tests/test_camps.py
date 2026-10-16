"""Camps: traveler camps (routine, night stealth theft, waking sleepers, hold-ups) and outlaw hideouts (silent
takedowns, clearing, loot, persistence, reoccupation). Runs against the real build like the other suites."""
import asyncio, json
from run import boot, OUT
from playwright.async_api import async_playwright
RESULTS = []
def check(name, ok, info=''):
    RESULTS.append((name, bool(ok), info)); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{info}]' if info else ''))
async def ev(pg, js): return await pg.evaluate(js)
# searching takes 1.3s of real time; the first night render can stall the page while shaders compile, so wait for the result
async def searched(pg, cid):
    try: await pg.wait_for_function(f"HP.S.containers['{cid}'] !== undefined", timeout=30000)
    except Exception: pass
H = """window.C = {
  at(id, dx, dz) { const c = CAMPS.find(k => k.id === id); return { x: c.x + dx, z: c.z + dz }; },
  fresh(hour) { HP.S.bounty = 0; HP.S.wanted = false; HP.S.containers = {}; HP.S.camps = {}; for (const k in HP.S.npcMem) delete HP.S.npcMem[k]; HP.S.time.hour = hour; HP.Game.restoreFromState(); HP.tp(-40, 20); HP.sim(0.5); },
  npc(k) { return HP.NPC.byKey(k); },
  lockbox(id) { const c = CAMPS.find(k => k.id === id), l = c.loot.find(x => x.kind === 'lockbox'); return { x: c.x + l.dx, z: c.z + l.dz }; },
};"""

async def main():
    async with async_playwright() as p:
        b, pg, errs = await boot(p)
        await pg.click('#bNew'); await pg.wait_for_timeout(600); await ev(pg, H)
        r = await ev(pg, "(()=>{ C.fresh(12); return CAMPS.map(c => ({ id: c.id, type: c.type, members: Camps.members(c.id).map(n => n.lawful), containers: Containers.filter(k => k.id.startsWith(c.id)).length, poi: !!POIS.find(q => q.id === c.id) })); })()")
        ok = len(r) == 3 and sum(c['type'] == 'traveler' for c in r) == 2 and all(c['containers'] >= 1 and c['poi'] for c in r) and all(all(c['members']) if c['type'] == 'traveler' else (len(c['members']) == 4 and not any(c['members'])) for c in r)
        check('camps: two traveler camps and an outlaw hideout with people, loot and map entries', ok, json.dumps(r))
        r = await ev(pg, "(()=>{ const a = C.npc('amos_teague'), out = {}; for (const h of [12, 20, 23]) { HP.S.time.hour = h; HP.sim(0.3); out[h] = [a.act, a.isAsleep()]; } return out; })()")
        check('travelers: work by day, sit at the fire in the evening, sleep at night', r['12'][0] == 'work' and r['20'][0] == 'sit' and r['23'] == ['sleep', True], json.dumps(r))
        r = await ev(pg, "(()=>{ C.fresh(20); const s = PLACES.camp_teague_fire0; HP.tp(s.x + 6, s.z + 4); HP.sim(2.5, 1/60); const a = C.npc('amos_teague'); return { sit: a.anim.acts.Sitting_Talking_Loop ? a.anim.acts.Sitting_Talking_Loop.getEffectiveWeight() : 0, d: Math.hypot(a.pos.x - s.x, a.pos.z - s.z) }; })()")
        check('travelers: evening fireside sitting uses the sitting clip on the log bench', r['sit'] > 0.8 and r['d'] < 0.8, json.dumps(r))
        # --- night stealth theft: crouched, nobody wakes, no crime ---
        await ev(pg, "C.fresh(23); HP.sim(0.3); const l = C.lockbox('camp_teague'); const P = HP.Game.player; P.crouch = true; HP.tp(l.x + 1.0, l.z + 0.6); P.yaw = Math.atan2(l.x - P.pos.x, l.z - P.pos.z); HP.sim(0.3, 1/60)")
        m0 = await ev(pg, "HP.S.money"); opts = await ev(pg, "HP.opts()"); pressed = await ev(pg, "HP.press('Search lockbox')")
        await searched(pg, 'camp_teague_lockbox'); r = await ev(pg, "(()=>{ HP.sim(0.3, 1/60); const ms = Camps.members('camp_teague'); return { money: HP.S.money, watch: HP.Inv.count('watch'), bounty: HP.S.bounty, asleep: ms.map(n => n.isAsleep()), witness: ms.some(n => !!n.witness) }; })()")
        check('night theft: crouched, the lockbox is looted while both trappers sleep, nothing witnessed', pressed and r['money'] > m0 and r['watch'] >= 1 and all(r['asleep']) and not r['witness'] and r['bounty'] == 0, f"opts={opts} {json.dumps(r)}")
        # --- careless: walking past a bedroll wakes the sleeper, who then witnesses the theft ---
        r = await ev(pg, """(()=>{ C.fresh(23); HP.sim(0.3); const P = HP.Game.player; P.crouch = false; const bed = PLACES.camp_teague_bed1; HP.tp(bed.x - 2.2, bed.z + 0.4); P.yaw = Math.PI / 2;
            Input.keys.add('w'); HP.Game.cam.yaw = Math.PI / 2; HP.sim(0.5, 1/60); Input.keys.clear(); HP.sim(0.3, 1/60); const j = C.npc('june_teague'); return { woke: j.wakeT > 0, asleep: j.isAsleep() }; })()""")
        check('night: walking upright past a bedroll wakes the sleeper', r['woke'] and not r['asleep'], json.dumps(r))
        h0 = await ev(pg, "HP.S.honor")
        await ev(pg, "const l = C.lockbox('camp_teague'); const P = HP.Game.player; HP.tp(l.x + 1.0, l.z + 0.6); P.yaw = Math.atan2(l.x - P.pos.x, l.z - P.pos.z); HP.sim(0.3, 1/60); HP.press('Search lockbox')")
        await searched(pg, 'camp_teague_lockbox'); r = await ev(pg, "(()=>{ HP.sim(0.5, 1/60); const j = C.npc('june_teague'); return { witness: !!j.witness || j.state === 'report' || j.state === 'confront', state: j.state, honor: HP.S.honor }; })()")
        check('night: the woken trapper witnesses the theft (reports it, honor drops)', r['witness'] and r['honor'] < h0, f"{json.dumps(r)} honor0={h0}")
        # --- hold-up by day ---
        r = await ev(pg, """(()=>{ C.fresh(12); const a = C.npc('amos_teague'), P = HP.Game.player; HP.tp(a.pos.x, a.pos.z - 5); a.state = 'routine'; P.yaw = 0; HP.Game.cam.yaw = 0; HP.Game.cam.pitch = 0.1;
            a.pos.set(P.pos.x, a.pos.y, P.pos.z + 5); a.goal = { x: a.pos.x, z: a.pos.z }; a.path = []; P.setWeapon('revolver'); Input.aimToggle = true; HP.sim(2.0); return { st: a.state, opts: HP.opts() }; })()""")
        check('hold-up: aiming at a trapper puts their hands up and offers Rob', r['st'] == 'handsup' and any(o.startswith('Rob Amos') for o in r['opts']), json.dumps(r))
        r = await ev(pg, "(()=>{ const m0 = HP.S.money, h0 = HP.S.honor, c0 = HP.S.stats.crimes; HP.press('Rob Amos'); HP.sim(0.3); Input.aimToggle = false; HP.Game.player.setWeapon('fists'); HP.sim(2.5); const a = C.npc('amos_teague'); return { gained: +(HP.S.money - m0).toFixed(2), honor: HP.S.honor - h0, crimes: HP.S.stats.crimes - c0, st: a.state, robbed: !!HP.S.npcMem.amos_teague.robbed }; })()")
        check('hold-up: robbing pays out, is a witnessed robbery (honor -8) and is remembered', r['gained'] >= 3 and r['honor'] <= -8 and r['crimes'] == 1 and r['robbed'] and r['st'] in ('confront', 'report', 'flee'), json.dumps(r))  # hands stay up while you aim; lowering the gun sends them off
        r = await ev(pg, "(()=>{ HP.sim(2); const a = C.npc('amos_teague'); a.state = 'routine'; a.witness = null; HP.S.wanted = false; HP.S.bounty = 0; const t = a.talk(a); return typeof t.start.text === 'function' ? t.start.text() : t.start.text; })()")
        check('hold-up: the robbed trapper remembers you', 'remember your face' in r, r)
        # --- asking about the area marks the hideout ---
        r = await ev(pg, "(()=>{ C.fresh(12); const w = C.npc('wes_holt'); Dialog.start(w, w.talk(w)); HP.choose('Ask about the area'); const t = document.getElementById('dlgText').textContent; Dialog.close(); return { t, marked: !!HP.S.discovered.camp_rattlesnake }; })()")
        check('travelers: asking about the area marks Rattlesnake Hollow on the map', r['marked'] and 'Rattlesnake Hollow' in r['t'], json.dumps(r))
        # --- outlaw hideout: silent takedown from behind a fireside sitter ---
        r = await ev(pg, """(()=>{ C.fresh(12); const ms = Camps.members('camp_rattlesnake'); for (const n of ms) if (!n.sitter) { n.pos.set(n.pos.x + 60, n.pos.y, n.pos.z + 60); n.route = [{ x: n.pos.x, z: n.pos.z, wait: 1e9 }]; }
            const v = C.npc('rs_vic'), P = HP.Game.player; P.crouch = true; HP.tp(v.pos.x - 1.1, v.pos.z); P.yaw = Math.PI / 2; HP.sim(0.2, 1/60);
            return { sitting: v.anim.acts.Sitting_Talking_Loop ? v.anim.acts.Sitting_Talking_Loop.getEffectiveWeight() : 0, sees: v.seesPlayer, alert: v.alert }; })()""")
        await pg.keyboard.press('f'); r2 = await ev(pg, "(()=>{ HP.sim(0.8, 1/60); const v = C.npc('rs_vic'), m = C.npc('rs_moe'); return { down: v.downed, moe: m.state, moeHostile: !!m.hostileToPlayer, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).slice(0, 3) }; })()")
        check('hideout: sitters face the fire, and a crouched punch from behind is a silent takedown', r['sitting'] > 0.8 and not r['sees'] and r2['down'] and r2['moe'] == 'patrol' and not r2['moeHostile'], f"{json.dumps(r)} {json.dumps(r2)}")
        # --- clearing the hideout: no honor for outlaws, lockbox is free loot ---
        h0 = await ev(pg, "HP.S.honor")
        r = await ev(pg, "(()=>{ const P = HP.Game.player; for (const n of Camps.members('camp_rattlesnake')) if (n.alive && !n.downed) n.takeHit({ dmg: 999, from: P, gun: 'revolver', dir: { x: 0, z: 1 } }); HP.sim(1.0); return { cleared: Camps.isCleared('camp_rattlesnake'), honor: HP.S.honor, log: HP.S.log[0].text }; })()")
        check('hideout: once everyone is down it is cleared, with no honor lost for the outlaws', r['cleared'] and r['honor'] == h0 and 'Rattlesnake Hollow' in r['log'], f"{json.dumps(r)} honor0={h0}")
        await ev(pg, "const l = C.lockbox('camp_rattlesnake'); const P = HP.Game.player; P.crouch = false; HP.tp(l.x + 1.0, l.z + 0.6); P.yaw = Math.atan2(l.x - P.pos.x, l.z - P.pos.z); HP.sim(0.3, 1/60)")
        g0 = await ev(pg, "HP.Inv.count('gold')"); pr = await ev(pg, "HP.press('Search gang lockbox')"); await searched(pg, 'camp_rattlesnake_lockbox')
        r = await ev(pg, "(()=>{ HP.sim(0.3); return { gold: HP.Inv.count('gold'), bounty: HP.S.bounty }; })()")
        check('hideout: the gang lockbox holds gold and opening it is no crime', pr and r['gold'] == g0 + 1 and r['bounty'] == 0, f"{json.dumps(r)} opts={await ev(pg, 'HP.opts()')}")
        r = await ev(pg, "(()=>{ HP.Save.save(true); HP.Save.load(); HP.sim(0.3); const after = Camps.members('camp_rattlesnake').length; HP.S.time.day += 5; HP.Game.restoreFromState(); HP.sim(0.3); return { afterLoad: after, cleared: Camps.isCleared('camp_rattlesnake'), back: Camps.members('camp_rattlesnake').filter(n => n.alive).length, log: HP.S.log[0].text }; })()")
        check('hideout: stays cleared after save/load, and is reoccupied five days later', r['afterLoad'] == 0 and not r['cleared'] and r['back'] == 4 and 'new occupants' in r['log'], json.dumps(r))
        for nm, js in [('camp_day', "C.fresh(12); const c = C.at('camp_teague', 0, 0); HP.tp(c.x + 7, c.z + 7); HP.sim(2, 1/60); HP.Game.cam.yaw = Math.atan2(c.x - HP.Game.player.pos.x, c.z - HP.Game.player.pos.z); HP.Game.cam.pitch = 0.35; HP.Game.cam.zoom = 6"),
                       ('camp_evening', "C.fresh(20); const c = C.at('camp_teague', 0, 0); HP.tp(c.x + 5, c.z + 5); HP.sim(2.5, 1/60); HP.Game.cam.yaw = Math.atan2(c.x - HP.Game.player.pos.x, c.z - HP.Game.player.pos.z); HP.Game.cam.pitch = 0.3; HP.Game.cam.zoom = 4.5"),
                       ('camp_night', "C.fresh(23.5); const c = C.at('camp_teague', 0, -2); HP.Game.player.crouch = true; HP.tp(c.x + 4, c.z + 3); HP.sim(1.5, 1/60); HP.Game.cam.yaw = Math.atan2(c.x - HP.Game.player.pos.x, c.z - HP.Game.player.pos.z); HP.Game.cam.pitch = 0.35; HP.Game.cam.zoom = 4"),
                       ('camp_hideout', "C.fresh(12); HP.Game.player.crouch = true; const c = C.at('camp_rattlesnake', 0, 0); HP.tp(c.x - 14, c.z + 2); HP.sim(1.5, 1/60); HP.Game.cam.yaw = Math.atan2(c.x - HP.Game.player.pos.x, c.z - HP.Game.player.pos.z); HP.Game.cam.pitch = 0.3; HP.Game.cam.zoom = 5")]:
            await ev(pg, js + "; HP.Game.cam.idleT = -999; HP.Game.cam.snap = true; HP.Game.cam.update(0)"); await pg.wait_for_timeout(1500); await pg.screenshot(path=OUT + nm + '.png')
        bad = [e for e in errs if 'ERR_TUNNEL' not in e]
        check('no page errors', not bad, str(bad[:3]))
        await b.close()
    n = sum(1 for _, ok, _ in RESULTS if ok); print(f"\n{n}/{len(RESULTS)} camp checks passed")
    if n != len(RESULTS): raise SystemExit(1)

if __name__ == '__main__': asyncio.run(main())
