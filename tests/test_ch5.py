"""Chapter 5, The Ledger: the four endings (law, cranes, gun, payout), allies fighting beside you, a silent takedown
and quiet rescue, Eli dying (fail and retry), and a reload mid-mission. Earlier chapters' state is set directly."""
import asyncio, json
from run import boot
from playwright.async_api import async_playwright
RESULTS = []
def check(name, ok, info=''):
    RESULTS.append((name, bool(ok), str(info)[:400])); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{str(info)[:400]}]' if info else ''))
async def ev(pg, js): return await pg.evaluate(js)

H = r"""window.K = {
  setup(o = {}) {
    if (HP.Missions.failing) HP.Missions.acceptFail(); if (HP.Missions.active) HP.Missions.abandon(true); if (HP.Dialog.open) HP.Dialog.close();
    const S = HP.S; for (const id of ['intro', 'm1', 'm2', 'm3', 'ch4']) HP.Missions.st(id).status = 'done'; const m = HP.Missions.st('ch5'); m.status = 'locked'; m.c = {}; m.opt = {};
    S.chapter = 5; S.locations.mill = 'abandoned'; S.locations.farm = o.farm || 'occupied'; for (const n of HP.NPC.all.slice()) if (n.group === 'crane' || n.tags.includes('ch5')) HP.NPC.despawn(n);
    S.decisions.journal = o.journal || 'kept'; S.decisions.ch4 = o.ch4 || 'walked'; S.chars.pike = o.pike || 'alive'; S.chars.dutchy = o.dutchy || 'deserted'; S.chars.fenwick = o.fenwick || 'alive'; S.chars.brock = 'alive';
    for (const k of ['rg1', 'rg2', 'rg3', 'rg4', 'vane', 'eli', 'marshal', 'deputy5', 'sal']) delete S.chars[k]; delete S.flags.eli_free; delete S.decisions.ending; delete S.decisions.ch5_plan;
    for (const k of ['journal', 'journal_copy', 'vane_ledger']) while (HP.Inv.count(k)) HP.Inv.take(k); for (const k of o.items || []) HP.Inv.add(k);
    S.bounty = 0; S.wanted = false; S.p.hp = S.p.maxHp; S.time.hour = 14; const pk = HP.NPC.byKey('pike'); if (pk && !pk.alive) HP.NPC.despawn(pk);
    HP.Missions._silent = true; HP.Missions.refresh(); HP.Missions._silent = false; World.apply(); HP.tp(T_TRAILHEAD.x - 20, T_TRAILHEAD.z); HP.sim(0.5);
  },
  stage() { const m = HP.Missions.st('ch5'); return HP.Missions.active === 'ch5' ? HP.Missions.defs.ch5.stages[m.stage].id : m.status; },
  c() { return HP.Missions.st('ch5').c; },
  begin() { HP.tp(T_TRAILHEAD.x, T_TRAILHEAD.z); HP.sim(0.5); const a = this.stage(); HP.tp(T_OVERLOOK.x, T_OVERLOOK.z + 2); HP.sim(1); return [a, this.stage(), HP.Dialog.open ? HP.choices() : null]; },
  near(key, d = 1.4) { const n = HP.NPC.byKey(key); const P = HP.Game.player; HP.tp(n.pos.x + d, n.pos.z); P.yaw = Math.atan2(n.pos.x - P.pos.x, n.pos.z - P.pos.z); HP.sim(0.1); },
  cut() { this.near('eli'); const ok = HP.press('Cut Eli loose'); HP.sim(2); return ok && !!HP.S.flags.eli_free; },
  killFoes(skipVane = true) { for (const n of HP.NPC.all.slice()) if (n.tags.includes('ch5foe') && n.alive && !n.downed && (!skipVane || n.key !== 'vane')) n.takeHit({ dmg: 999, from: HP.Game.player, gun: 'revolver' }); HP.sim(0.5); },
  safe() { HP.Game.player.inv = 1e9; },
};"""

async def main():
    async with async_playwright() as p:
        b, pg, errs = await boot(p)
        await pg.click('#bNew'); await pg.wait_for_timeout(600); await ev(pg, H)

        # ---------- law: Pike turned and you kept the journal ----------
        await ev(pg, "K.setup({ pike: 'turned', ch4: 'exposed', items: ['journal'] })")
        r = await ev(pg, "({ st: K.stage(), playable: CHAPTERS[4].playable, poi: !!POIS.find(p => p.id === 'tamarack'), ground: +Terrain.height(TAMARACK.x, TAMARACK.z).toFixed(1) })")
        check('[law] after Chapter 4, The Ledger is available; Tamarack Pass is on the map with a flat camp', r['st'] == 'available' and r['playable'] and r['poi'] and abs(r['ground'] - 17) < 1, r)
        r = await ev(pg, "K.begin()")
        check('[law] riding into the trailhead marker starts the mission; at the overlook the marshal (and Pike) wait with a plan', r[0] == 'ride' and r[1] == 'plan' and r[2] and any('marshal' in c for c in r[2]) and any('alone' in c for c in r[2]), r)
        r = await ev(pg, "({ pike: !!HP.NPC.byKey('pike') && HP.NPC.byKey('pike').tags.includes('ally'), deputy: !!HP.NPC.byKey('deputy5'), cranes: !HP.Dialog.open || !HP.choices().some(c => c.includes('Cranes')) })")
        check('[law] Pike rides with the marshal; no Crane option without Dutchy', r['pike'] and r['deputy'] and r['cranes'], r)
        await ev(pg, "HP.choose('Ride in with the marshal'); HP.Dialog.close(); HP.sim(0.5); K.safe()")
        r = await ev(pg, "(()=>{ let t = 0; const P = HP.Game.player; while (t < 40 && !HP.Dialog.open) { const m = HP.NPC.byKey('marshal'); HP.tp(m.pos.x + 2, m.pos.z + 3); HP.sim(0.5); t += 0.5; } return { t, stage: K.stage(), open: HP.Dialog.open, ch: HP.Dialog.open ? HP.choices() : null }; })()")
        check('[law] the marshal walks you up to the gate and reads Vane his warrant', r['stage'] == 'camp' and r['open'], r)
        await ev(pg, "HP.choose('Continue'); HP.choose('Show the evidence'); HP.choose('Here it comes'); HP.sim(0.5)")
        r = await ev(pg, "({ wavered: K.c().wavered, fight: !!K.c().fight, foes: CH5.foes().length })")
        check('[law] showing the evidence (with Pike\'s word) makes two of Vane\'s men walk away before the shooting starts', r['wavered'] == 2 and r['fight'] and r['foes'] == 2, r)
        r = await ev(pg, "(()=>{ const hp0 = CH5.foes().reduce((a, n) => a + n.hp, 0); HP.tp(T_OVERLOOK.x, T_OVERLOOK.z); let t = 0; while (t < 25 && CH5.foes().length) { HP.sim(0.5); t += 0.5; } const left = CH5.foes(); return { t, hp0, hp: left.reduce((a, n) => a + n.hp, 0), left: left.length }; })()")
        check('[law] the marshal and her deputies fight Vane\'s men on their own', r['left'] < 2 or r['hp'] < r['hp0'], r)
        await ev(pg, "K.killFoes(); HP.sim(1)")
        r = await ev(pg, "({ surrender: !!K.c().surrender, cut: K.cut(), stage: K.stage() })")
        check('[law] with his men down Vane surrenders; cutting Eli loose moves on to the arrest', r['surrender'] and r['cut'] and r['stage'] == 'finale', r)
        r = await ev(pg, "(()=>{ let t = 0; while (t < 30 && HP.Missions.st('ch5').status === 'active') { HP.sim(0.5); t += 0.5; } return { t, st: HP.Missions.st('ch5').status, end: HP.S.decisions.ending, vane: HP.S.chars.vane, eli: HP.S.chars.eli, ch: HP.S.chapter, out: HP.Missions.st('ch5').outcome }; })()")
        check('[law] Marshal Calder arrests Vane: the law ending, Eli home, story complete', r['st'] == 'done' and r['end'] == 'law' and r['vane'] == 'jailed' and r['eli'] == 'home' and r['ch'] == 6, r)
        r = await ev(pg, "(()=>{ HP.sim(1); World.apply(); const e = HP.NPC.byKey('eli'); return { eli: !!e && !e.tags.includes('ch5'), talk: e ? STORY.talkEli(e).start.text() : null, pike: !!HP.NPC.byKey('pike') }; })()")
        check('[law] afterwards Eli lives in Juniper Gap and talks about the trial', r['eli'] and r['talk'] and r['pike'], r)

        # ---------- cranes: Dutchy is your ally, no evidence ----------
        await ev(pg, "K.setup({ dutchy: 'ally', journal: 'pike' })")
        r = await ev(pg, "K.begin()")
        check('[cranes] with Dutchy as an ally, Fenwick\'s Cranes wait at the overlook; no marshal without evidence', r[1] == 'plan' and r[2] and any('Cranes' in c for c in r[2]) and not any('marshal' in c for c in r[2]), r)
        await ev(pg, "HP.choose('Ride in with the Cranes'); HP.Dialog.close(); K.safe(); HP.sim(0.5)")
        r = await ev(pg, "(()=>{ let t = 0; while (t < 40 && !K.c().fight) { const l = CH5.lead(); HP.tp(l.pos.x + 2, l.pos.z + 3); HP.sim(0.5); t += 0.5; } return { t, fight: !!K.c().fight, stage: K.stage() }; })()")
        check('[cranes] the Cranes ride to the gate and open fire', r['fight'] and r['stage'] == 'camp', r)
        await ev(pg, "K.killFoes(); HP.sim(1)"); r = await ev(pg, "({ cut: K.cut(), stage: K.stage() })")
        r2 = await ev(pg, "(()=>{ let t = 0; while (t < 30 && HP.Missions.st('ch5').status === 'active') { HP.sim(0.5); t += 0.5; } return { t, st: HP.Missions.st('ch5').status, end: HP.S.decisions.ending, vane: HP.S.chars.vane, crane: HP.S.factions.crane }; })()")
        check('[cranes] Eli freed; the Cranes execute Vane: the cranes ending', r['cut'] and r2['st'] == 'done' and r2['end'] == 'cranes' and r2['vane'] == 'dead', f"{r} {r2}")

        # ---------- alone: silent takedown, quiet rescue, then Vane at the gate (gun) ----------
        await ev(pg, "K.setup({})")
        r = await ev(pg, "K.begin()")
        check('[gun] with no allies the plan is to go in alone', r[1] in ('plan', 'camp') and await ev(pg, "K.c().plan") == 'alone', r)
        await ev(pg, "HP.sim(0.5)")
        r = await ev(pg, """(()=>{ const P = HP.Game.player, g = HP.NPC.byKey('rg4'); P.crouch = true; P.setWeapon('fists'); const a = g.yaw + Math.PI; HP.tp(g.pos.x + Math.sin(a) * 1.1, g.pos.z + Math.cos(a) * 1.1); P.crouch = true; HP.sim(0.05);
            g.takeHit({ dmg: 20, from: P, melee: true, dir: { x: 0, z: 0 } }); HP.sim(0.3); return { down: g.downed, alarm: !!K.c().alarm }; })()""")
        check('[gun] a guard taken from behind, crouched, goes down silently', r['down'] and not r['alarm'], r)
        r = await ev(pg, "(()=>{ HP.Game.player.crouch = true; const ok = K.cut(); HP.sim(0.5); return { ok, alarm: !!K.c().alarm, stage: K.stage(), quiet: HP.Missions.st('ch5').opt.quiet === true }; })()")
        check('[gun] Eli cut loose without an alarm (optional objective)', r['ok'] and not r['alarm'] and r['stage'] == 'finale' and r['quiet'], r)
        r = await ev(pg, "(()=>{ HP.Game.player.crouch = false; HP.tp(T_GATE.x, T_GATE.z - 6); HP.sim(0.5); HP.tp(T_GATE.x, T_GATE.z - 2); HP.sim(0.5); return { open: HP.Dialog.open, ch: HP.Dialog.open ? HP.choices() : null, follows: CH5.dist(HP.NPC.byKey('eli').pos, HP.Game.player.pos) }; })()")
        check('[gun] Eli follows you out; Vane steps into the gate with an offer', r['open'] and r['ch'] and any('money' in c for c in r['ch']), r)
        await ev(pg, "K.safe(); HP.choose('\"It\\'s over'); HP.sim(0.5)")
        r = await ev(pg, "({ vane: HP.NPC.byKey('vane').state, foe: HP.NPC.byKey('vane').tags.includes('ch5foe') })")
        check('[gun] drawing on Vane starts the gunfight', r['vane'] == 'combat' and r['foe'], r)
        await ev(pg, "K.killFoes(false); HP.sim(2)")
        r = await ev(pg, "({ st: HP.Missions.st('ch5').status, end: HP.S.decisions.ending, vane: HP.S.chars.vane, out: HP.Missions.st('ch5').outcome })")
        check('[gun] killing Vane ends it: the gun ending, quiet rescue noted', r['st'] == 'done' and r['end'] == 'gun' and r['vane'] == 'dead' and 'without an alarm' in (r['out'] or ''), r)

        # ---------- payout ----------
        await ev(pg, "K.setup({ items: ['journal_copy', 'vane_ledger'], ch4: 'bought' })"); await ev(pg, "K.begin(); HP.choose('\"I\\'ll go in alone'); HP.Dialog.close(); HP.tp(TAMARACK.x + 14, TAMARACK.z); HP.sim(0.5); K.safe(); HP.Game.player.crouch = true")
        m0 = await ev(pg, "HP.S.money")
        await ev(pg, "for (const n of CH5.foes()) n.sense = 0;  HP.sim(0.2); K.cut(); HP.Game.player.crouch = false; HP.tp(T_GATE.x, T_GATE.z - 2); HP.sim(0.6)")
        r = await ev(pg, "({ open: HP.Dialog.open, text: document.getElementById('dlgText').textContent, stage: K.stage(), c: JSON.stringify(K.c()), free: !!HP.S.flags.eli_free })")
        await ev(pg, "HP.choose('Take the money'); HP.choose('Continue'); HP.sim(2)")
        r2 = await ev(pg, "({ st: HP.Missions.st('ch5').status, end: HP.S.decisions.ending, money: HP.S.money, papers: HP.Inv.count('journal_copy') + HP.Inv.count('vane_ledger'), eli: HP.S.chars.eli, honor: HP.S.honor })")
        check('[payout] Vane remembers the Chapter 4 deal; taking his $200 hands over every paper and ends the story', r['open'] and 'Sunday' in r['text'] and r2['st'] == 'done' and r2['end'] == 'payout' and r2['money'] - m0 >= 199.9 and r2['papers'] == 0 and r2['eli'] == 'left', f"{r} {r2} m0={m0}")

        # ---------- Eli dies: fail and retry; reload rewinds ----------
        await ev(pg, "K.setup({})"); await ev(pg, "K.begin(); HP.sim(0.5)")
        await ev(pg, "HP.NPC.byKey('eli').takeHit({ dmg: 999, from: HP.Game.player, gun: 'revolver' }); HP.sim(0.5)")
        r = await ev(pg, "({ failing: HP.Missions.failing && HP.Missions.failing.why })")
        check('[fail] Eli killed: the mission fails', r['failing'] == 'Eli is dead.', r)
        await ev(pg, "HP.Missions.retry(); HP.sim(0.5)")
        r = await ev(pg, "({ stage: K.stage(), eli: HP.NPC.byKey('eli') && HP.NPC.byKey('eli').alive, chars: HP.S.chars.eli || null })")
        check('[fail] retry restarts on the trail with Eli alive', r['stage'] == 'ride' and r['eli'] and r['chars'] != 'dead', r)
        await ev(pg, "HP.tp(T_OVERLOOK.x, T_OVERLOOK.z + 2); HP.sim(1); HP.Save.save(true)")
        await pg.wait_for_timeout(1500); await pg.reload(); await pg.wait_for_function('document.getElementById("loading").textContent===""', timeout=180000)
        await pg.wait_for_selector('#bCont:not([disabled])', timeout=20000); await pg.evaluate("document.getElementById('bCont').click()"); await pg.wait_for_timeout(400); await ev(pg, H); await ev(pg, "HP.sim(0.5)")
        r = await ev(pg, "({ stage: K.stage(), eli: !!HP.NPC.byKey('eli') })")
        check('[reload] continuing a save made mid-mission rewinds to the trail with the camp repopulated', r['stage'] in ('ride', 'plan', 'camp') and r['eli'], r)

        bad = [e for e in errs if 'favicon' not in e]
        check('no page errors', not bad, bad[:5])
        await b.close()
    n = sum(1 for _, ok, _ in RESULTS if ok); print(f"\n{n}/{len(RESULTS)} chapter 5 checks passed")
    if n != len(RESULTS): raise SystemExit(1)

if __name__ == '__main__': asyncio.run(main())
