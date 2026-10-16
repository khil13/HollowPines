"""Chapter 4, Night at Willow Bridge: start from Cora, wait for midnight, tail Pike unseen, eavesdrop on Vane, then
settle it four ways (expose, buy-off with Dutchy's distraction and the ledger, shootout, getting spotted on the tail),
plus a reload mid-tail. Earlier chapters' state is set directly; test_story.py plays those."""
import asyncio, json
from run import boot
from playwright.async_api import async_playwright
RESULTS = []
def check(name, ok, info=''):
    RESULTS.append((name, bool(ok), str(info)[:400])); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{str(info)[:400]}]' if info else ''))
async def ev(pg, js): return await pg.evaluate(js)

H = r"""window.K = {
  setup(o = {}) { // the world as Chapter 3 left it
    if (HP.Missions.failing) HP.Missions.acceptFail(); if (HP.Missions.active) HP.Missions.abandon(true); const pk0 = HP.NPC.byKey('pike'); if (pk0 && !pk0.alive) HP.NPC.despawn(pk0); if (HP.Dialog.open) HP.Dialog.close();
    const S = HP.S; for (const id of ['intro', 'm1', 'm2', 'm3']) HP.Missions.st(id).status = 'done'; HP.Missions.st('ch4').status = 'locked'; HP.Missions.st('ch4').c = {}; HP.Missions.st('ch5').status = 'locked';
    S.chapter = 4; S.decisions.journal = o.journal || 'mae'; S.decisions.m3 = o.m3 || 'evidence'; S.locations.farm = o.farm || 'occupied'; S.chars.dutchy = o.dutchy || 'deserted';
    S.locations.mill = 'abandoned'; for (const n of HP.NPC.all.slice()) if (n.group === 'crane') HP.NPC.despawn(n); delete S.chars.hoyt; S.chars.pike = 'alive'; S.chars.brock = 'alive'; S.chars.cora = 'alive'; S.flags.vane_warned = S.decisions.m3 === 'evidence';
    delete S.evidence.ledger; delete S.evidence.eli_alive; delete S.decisions.ch4; S.bounty = 0; S.wanted = false;
    if (S.decisions.journal !== 'pike' && !HP.Inv.count('journal')) HP.Inv.add('journal');
    if (S.decisions.journal === 'pike') { while (HP.Inv.count('journal')) HP.Inv.take('journal'); while (HP.Inv.count('journal_copy')) HP.Inv.take('journal_copy'); }
    S.p.hp = S.p.maxHp; S.time.hour = o.hour ?? 21; HP.Missions._silent = true; HP.Missions.refresh(); HP.Missions._silent = false; World.apply(); HP.tp(-36, 10); HP.sim(0.5);
  },
  near(key, d = 1.6) { const n = HP.NPC.byKey(key); if (!n) return false; const a = n.yaw; HP.tp(n.pos.x + Math.sin(a) * d, n.pos.z + Math.cos(a) * d); HP.Game.player.yaw = Math.atan2(n.pos.x - HP.Game.player.pos.x, n.pos.z - HP.Game.player.pos.z); HP.sim(0.1); return true; },
  talk(key) { if (HP.Dialog.open) HP.Dialog.close(); if (!this.near(key)) return 'no npc ' + key; return HP.press('Talk to') ? HP.choices() : 'no talk: ' + JSON.stringify(HP.opts()); },
  cora() { const c = HP.NPC.byKey('cora'); c.pos.set(-40, c.pos.y, 3.2); c.yaw = 0; c.state = 'routine'; c.path = null; return this.talk('cora'); },
  stage() { const m = HP.Missions.st('ch4'); return HP.Missions.active === 'ch4' ? HP.Missions.defs.ch4.stages[m.stage].id : HP.Missions.st('ch4').status; },
  c() { return HP.Missions.st('ch4').c; },
  pike() { return HP.NPC.byKey('pike'); },
  // shadow Pike at a fixed distance behind him, crouched, until he reaches the meeting (or the mission ends)
  follow(dist, crouch = true, maxS = 160) { const P = HP.Game.player; let t = 0;
    while (t < maxS && HP.Missions.active === 'ch4' && this.stage() === 'tail' && !this.c().arrived && !HP.Missions.failing) {
      const pk = this.pike(), c = this.c(), y = c.looking ? c.baseYaw : pk.yaw; P.crouch = crouch; HP.tp(pk.pos.x - Math.sin(y) * dist, pk.pos.z - Math.cos(y) * dist); P.crouch = crouch; P.yaw = y; HP.sim(0.5); t += 0.5; }
    return { t, stage: this.stage(), failing: HP.Missions.failing && HP.Missions.failing.why, susMax: this.c().susMax, pike: [+this.pike().pos.x.toFixed(1), +this.pike().pos.z.toFixed(1)] }; },
  hide() { const P = HP.Game.player; P.crouch = true; HP.tp(MEET.x - 2, MEET.z + 14); P.crouch = true; P.yaw = Math.PI; HP.sim(0.2); },
  listen(maxS = 90) { let t = 0; while (t < maxS && this.stage() === 'listen' && !HP.Missions.failing) { HP.Game.player.crouch = true; HP.sim(0.5); t += 0.5; } return { t, stage: this.stage(), heard: this.c().heard, total: this.c().total, spotted: !!this.c().spotted, failing: HP.Missions.failing && HP.Missions.failing.why }; },
  toasts() { return [...document.querySelectorAll('.toast')].map(t => t.textContent).slice(0, 8); },
};"""

async def start_and_wait(pg, tag):
    ch = await ev(pg, "K.cora()")
    check(f'[{tag}] Cora offers the Chapter 4 lead', isinstance(ch, list) and any('sheriff' in c for c in ch), ch)
    await ev(pg, "HP.choose('Anything about the sheriff?'); HP.Dialog.close(); HP.sim(0.3)")
    st = await ev(pg, "K.stage()")
    ch = await ev(pg, "K.cora()"); await ev(pg, "HP.choose('Wait here with you until eleven'); HP.Dialog.close()")
    r = await ev(pg, "({hour: HP.S.time.hour, stage: K.stage()})")
    check(f'[{tag}] ch4 starts at the jail stage; waiting with Cora moves the clock to 11 pm', st == 'night' and r['hour'] >= 23 and isinstance(ch, list) and any('Wait here' in c for c in ch), f"{st} {r} {ch}")
    await ev(pg, "HP.tp(-24, 16); HP.sim(1)")
    r = await ev(pg, "({stage: K.stage(), pike: K.pike().state, vane: !!HP.NPC.byKey('vane'), guards: HP.NPC.all.filter(n => n.group === 'rail4').length})")
    check(f'[{tag}] at the jail after eleven Pike walks out; Vane and two guns wait at the bridge', r['stage'] == 'tail' and r['pike'] == 'scripted' and r['vane'] and r['guards'] == 2, r)

async def main():
    async with async_playwright() as p:
        b, pg, errs = await boot(p)
        await pg.click('#bNew'); await pg.wait_for_timeout(600); await ev(pg, H)

        # ---------- 1. the clean run: unseen tail, whole conversation, expose Vane with the journal ----------
        await ev(pg, "K.setup({ journal: 'mae' })")
        r = await ev(pg, "({ ch4: K.stage(), playable: CHAPTERS[3].playable, marker: !!HP.Missions.defs.ch4.start() })")
        check('[expose] after Chapter 3, Night at Willow Bridge is available with a giver marker, and listed as playable', r['ch4'] == 'available' and r['playable'] and r['marker'], r)
        await start_and_wait(pg, 'expose')
        r = await ev(pg, "K.follow(18)")
        check('[expose] tailing Pike at a distance, crouched: he walks over Willow Bridge to Vane and never grows suspicious', r['stage'] == 'listen' and not r['failing'] and r['susMax'] < 0.5, r)
        looks = await ev(pg, "HP.Missions.st('ch4').opt.unseen === true")
        check('[expose] optional objective: never let Pike grow suspicious', looks)
        await ev(pg, "K.hide()"); r = await ev(pg, "K.listen()")
        check('[expose] crouched in the brush within earshot: the whole conversation plays and nobody spots you', r['stage'] == 'confront' and r['heard'] == r['total'] and not r['spotted'], r)
        r = await ev(pg, "({ eli: !!HP.S.evidence.eli_alive, all: HP.Missions.st('ch4').opt.all === true, rail: (() => { const v = HP.NPC.byKey('vane'); return Math.hypot(v.pos.x - RAIL.v.x, v.pos.z - RAIL.v.z) < 1.5; })() })")
        check('[expose] Vane lets slip that Eli is alive at Tamarack Pass; mid-talk they move to the bridge rail', r['eli'] and r['all'] and r['rail'], r)
        ch = await ev(pg, "K.talk('vane')")
        check('[expose] walking up to Vane opens the confrontation with talk, price, draw and back-away choices', isinstance(ch, list) and any(c.startswith('Show Eli') for c in ch) and any('Draw' in c for c in ch) and any('price' in c for c in ch), ch)
        await ev(pg, "HP.choose('Where is Eli?'); HP.choose('Continue'); HP.choose('Show Eli'); for (let i = 0; i < 4 && HP.Dialog.open; i++) HP.choose('Continue'); HP.sim(1)")
        r = await ev(pg, "({ st: HP.Missions.st('ch4').status, d: HP.S.decisions.ch4, pike: HP.S.chars.pike, ch: HP.S.chapter, ch5: HP.Missions.st('ch5').status, out: HP.Missions.st('ch4').outcome })")
        check('[expose] showing the journal turns Pike against Vane; Chapter 4 completes and Chapter 5 unlocks', r['st'] == 'done' and r['d'] == 'exposed' and r['pike'] == 'turned' and r['ch'] == 5 and r['ch5'] == 'available' and 'Pike turned' in (r['out'] or ''), r)
        r = await ev(pg, "(()=>{ HP.sim(1); const pk = K.pike(); return { gone: !HP.NPC.byKey('vane'), pikeState: pk && pk.state, talk: (() => { const t = STORY.talkPike(pk); return t.start.text(); })() }; })()")
        check('[expose] afterwards Vane is gone, Pike is back on his routine and talks like a man who turned', r['gone'] and r['pikeState'] == 'routine' and 'marshal' in r['talk'], r)

        # ---------- 2. careless tail: walking upright right behind Pike gets you made ----------
        await ev(pg, "K.setup({ journal: 'kept' })"); await start_and_wait(pg, 'spotted')
        r = await ev(pg, "K.follow(4, false, 40)")
        check('[spotted] following Pike upright, a few steps behind, fails the tail', r['failing'] == 'Pike spotted you following him.', r)
        await ev(pg, "HP.Missions.retry(); HP.sim(0.5)")
        r = await ev(pg, "({ stage: K.stage(), vane: !!HP.NPC.byKey('vane'), pike: K.pike().state })")
        check('[spotted] retrying restarts the night at the jail with the bridge party cleared', r['stage'] == 'night' and not r['vane'] and r['pike'] != 'scripted', r)
        # reload mid-tail: the checkpoint is the jail
        await ev(pg, "HP.S.time.hour = 23.2; HP.tp(-24, 16); HP.sim(1)")
        await ev(pg, "HP.Save.save(true)"); await pg.wait_for_timeout(1500); await pg.reload(); await pg.wait_for_function('document.getElementById("loading").textContent===""', timeout=180000)
        await pg.wait_for_selector('#bCont:not([disabled])', timeout=20000); await pg.evaluate("document.getElementById('bCont').click()"); await pg.wait_for_timeout(400); await ev(pg, H); await ev(pg, "HP.sim(0.5)")
        r = await ev(pg, "({ stage: K.stage(), vane: !!HP.NPC.byKey('vane') })")
        check('[reload] continuing a save made mid-tail rewinds to the jail stage', r['stage'] in ('night', 'tail') and (r['stage'] == 'night' or r['vane']), r)

        # ---------- 3. Pike has the journal: no evidence to show; spotted at the meeting, then a shootout ----------
        await ev(pg, "HP.Missions.abandon(true); K.setup({ journal: 'pike', m3: 'fight' })"); await start_and_wait(pg, 'fight')
        r = await ev(pg, "K.follow(18)"); check('[fight] tail completes', r['stage'] == 'listen', r)
        await ev(pg, "HP.sim(6)"); r = await ev(pg, "(()=>{ const P = HP.Game.player, v = HP.NPC.byKey('vane'); P.crouch = false; HP.tp(v.pos.x - Math.sin(v.yaw) * -5, v.pos.z - Math.cos(v.yaw) * -5); P.crouch = false; return K.listen(15); })()")
        dl = await ev(pg, "HP.Dialog.open ? HP.choices() : null")
        check('[fight] walking into the lantern light gets you spotted: Vane calls you over instead of the meeting going on', r['spotted'] and r['stage'] == 'confront' and dl, f"{r} {dl}")
        dis = await ev(pg, "[...document.querySelectorAll('#dlgCh button[disabled]')].map(b => b.textContent)")
        check('[fight] with the journal handed to Pike in Chapter 2 there is nothing to show Vane', dl and any(c.startswith('Show Eli') for c in dl) and any('Pike gave' in d or 'Show Eli' in d for d in dis), f"{dl} disabled={dis}")
        await ev(pg, "HP.choose('Draw on them'); HP.sim(0.5)")
        r = await ev(pg, "({ foes: HP.NPC.all.filter(n => n.tags.includes('ch4foe')).map(n => [n.key, n.state]), vane: HP.NPC.byKey('vane').fled })")
        check('[fight] drawing on them: the guns and Pike (who brought Vane the journal) fight; Vane runs', len(r['foes']) == 3 and all(s == 'combat' for _, s in r['foes']) and any(k == 'pike' for k, _ in r['foes']) and r['vane'], r)
        await ev(pg, "for (const n of HP.NPC.all.slice()) if (n.tags.includes('ch4foe') && n.alive) n.takeHit({ dmg: 999, from: HP.Game.player, gun: 'revolver' }); HP.sim(1.5)")
        r = await ev(pg, "({ st: HP.Missions.st('ch4').status, d: HP.S.decisions.ch4, pike: HP.S.chars.pike, bounty: HP.S.bounty, out: HP.Missions.st('ch4').outcome })")
        check('[fight] once Vane\'s men and Pike are down the chapter completes as a shootout; self-defense carries no bounty', r['st'] == 'done' and r['d'] == 'fight' and r['pike'] == 'dead' and r['bounty'] == 0, r)

        # ---------- 4. Dutchy's distraction, the ledger, and Vane's money ----------
        await ev(pg, "K.setup({ journal: 'kept', dutchy: 'ally', m3: 'railroad', farm: 'abandoned' })"); await start_and_wait(pg, 'bought')
        r = await ev(pg, "K.follow(20)"); check('[bought] tail completes with Dutchy keeping watch on the west bank', r['stage'] == 'listen' and await ev(pg, "!!HP.NPC.byKey('dutchy')"), r)
        await ev(pg, "K.hide(); HP.sim(10)")
        await ev(pg, "(()=>{ const d = HP.NPC.byKey('dutchy'); HP.tp(d.pos.x + 1.2, d.pos.z); HP.Game.player.yaw = -Math.PI / 2; HP.sim(0.1); })()")
        o1 = await ev(pg, "HP.opts()"); ok = await ev(pg, "HP.press('Have Dutchy spook their horses')"); await pg.wait_for_timeout(4500); await ev(pg, "HP.sim(9)")
        r = await ev(pg, "HP.NPC.all.filter(n => n.group === 'rail4').map(n => +Math.hypot(n.pos.x - MEET.x, n.pos.z - MEET.z).toFixed(1))")
        check('[bought] Dutchy spooks their horses and both guns run off east', ok and len(r) == 2 and all(d > 18 for d in r), f'{r} ok={ok} opts={o1} toasts={await ev(pg, "K.toasts()")} st={await ev(pg, "HP.NPC.all.filter(n => n.group === \'rail4\').map(n => n.state)")}')
        await ev(pg, "(()=>{ HP.sim(30); const P = HP.Game.player; P.crouch = true; HP.tp(MEET.x + 1.5, MEET.z + 3.5); P.crouch = true; P.yaw = Math.PI; HP.sim(0.2); })()")
        ok = await ev(pg, "HP.press('Steal Vane')")
        # the pickup animation runs on game time, so step the game rather than waiting on the wall clock
        await ev(pg, "(()=>{ for (let i = 0; i < 40 && !HP.S.evidence.ledger; i++) { HP.Game.player.crouch = true; HP.sim(0.1, 1/60); } })()")
        r = await ev(pg, "({ ledger: !!HP.S.evidence.ledger, item: HP.Inv.count('vane_ledger'), stage: K.stage(), spotted: !!K.c().spotted })")
        check('[bought] with their backs to the bank, the ledger is lifted off the crate unseen', ok and r['ledger'] and r['item'] == 1 and not r['spotted'], r)
        await ev(pg, "K.hide(); K.listen()")
        m0 = await ev(pg, "HP.S.money"); ch = await ev(pg, "K.talk('vane')")
        await ev(pg, "HP.choose('\"Name your price.\"'); HP.choose('Take Vane'); for (let i = 0; i < 3 && HP.Dialog.open; i++) HP.choose('Continue'); HP.sim(1)")
        r = await ev(pg, "({ st: HP.Missions.st('ch4').status, d: HP.S.decisions.ch4, money: HP.S.money, honor: HP.S.honor, out: HP.Missions.st('ch4').outcome, pike: HP.S.chars.pike })")
        check('[bought] taking Vane\'s offer pays $100, costs honor and completes the chapter, ledger noted', r['st'] == 'done' and r['d'] == 'bought' and r['money'] - m0 >= 99.9 and 'ledger' in (r['out'] or '') and r['pike'] == 'alive', f"{r} m0={m0} {ch}")
        lines = await ev(pg, "CH4.lines().map(l => l[1]).join(' | ')")
        check('[bought] Vane\'s lines reflect the world: the Greer land bought cheap and Dutchy riding with you', 'came cheap' in lines and 'Moss boy' in lines, lines)

        bad = [e for e in errs if 'favicon' not in e]
        check('no page errors', not bad, bad[:5])
        await b.close()
    n = sum(1 for _, ok, _ in RESULTS if ok); print(f"\n{n}/{len(RESULTS)} chapter 4 checks passed")
    if n != len(RESULTS): raise SystemExit(1)

if __name__ == '__main__': asyncio.run(main())
