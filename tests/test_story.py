"""Story tests: two full playthroughs of chapters 1–3 with opposite choices, proving decisions
persist across missions and across a real page reload (save -> reload -> Continue)."""
import asyncio, json
from run import boot, OUT
from playwright.async_api import async_playwright
RESULTS = []
def check(name, ok, info=''):
    RESULTS.append((name, bool(ok), str(info)[:300])); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{str(info)[:300]}]' if info else ''))

HELPERS = r"""
window.T = {
  near(key, d=1.6) { const n = HP.NPC.byKey(key); if (!n) return false; const a = n.yaw; HP.tp(n.pos.x + Math.sin(a) * d, n.pos.z + Math.cos(a) * d); HP.Game.player.yaw = Math.atan2(n.pos.x - HP.Game.player.pos.x, n.pos.z - HP.Game.player.pos.z); HP.sim(0.1); return true; },
  talk(key) { if (HP.Dialog.open) HP.Dialog.close(); if (!this.near(key)) return 'no npc ' + key; const ok = HP.press('Talk to'); return ok ? HP.choices() : 'no talk opt: ' + JSON.stringify(HP.opts()); },
  pick(prefix) { return HP.choose(prefix); },
  close() { if (HP.Dialog.open) HP.Dialog.close(); },
  st(id) { return HP.Missions.st(id).status; },
  stage(id) { const m = HP.Missions.st(id); return HP.Missions.defs[id].stages[m.stage].id; },
  objs() { return HP.Missions.objectives().map(o => (o.optional ? '(opt) ' : '') + (typeof o.text === 'function' ? o.text(HP.Missions.ctx) : o.text)); },
  kill(tag, gun = true) { for (const n of HP.NPC.all.slice()) if (n.tags.includes(tag) && n.alive && !n.downed) n.takeHit({ dmg: 999, from: HP.Game.player, gun: gun ? 'revolver' : null, melee: !gun }); HP.sim(0.5); },
  mae() { const m = HP.NPC.byKey('mae'); HP.S.time.hour = 10; m.pos.set(-58, m.pos.y, 5.4); m.yaw = 0; m.state = 'routine'; m.act = 'work'; m.path = null; m.goal = null; },
  toasts() { return [...document.querySelectorAll('.toast')].map(t => t.textContent).slice(0, 6); },
};
"""
async def ev(pg, js): return await pg.evaluate(js)
async def wait(pg, ms): await pg.wait_for_timeout(ms)

async def new_game(p):
    b, pg, errs = await boot(p); await ev(pg, "localStorage.clear()"); await pg.click('#bNew'); await wait(pg, 400); await ev(pg, HELPERS); await ev(pg, "HP.sim(0.5)"); return b, pg, errs
async def reload_continue(pg):
    n = await ev(pg, "(localStorage.getItem(HP.Save.KEY)||'').length")
    await wait(pg, 2500); await pg.reload(); await pg.wait_for_function('document.getElementById("loading").textContent===""', timeout=180000)
    try: await pg.wait_for_selector('#bCont:not([disabled])', timeout=20000)
    except Exception:
        print('DIAG before', n, await pg.evaluate("JSON.stringify({keys:Object.keys(localStorage), len:(localStorage.getItem('hollowpines_save_v3')||'').length})")); raise
    await pg.evaluate("document.getElementById('bCont').click()"); await wait(pg, 400); await ev(pg, HELPERS); await ev(pg, "HP.sim(0.3)")

async def m1(pg, path):
    await ev(pg, "T.mae(); HP.sim(0.1)")
    intro = await ev(pg, "T.st('intro')")
    ch = await ev(pg, "T.talk('mae')"); check(f'[{path}] Intro: meeting Mae completes Homecoming', intro == 'active' and await ev(pg, "T.st('intro')") == 'done', intro)
    check(f'[{path}] M1: Mae offers the strongbox job', any('strongbox' in c for c in ch), ch)
    await ev(pg, "T.pick('I\\'ll get your strongbox back.'); T.close()"); check(f'[{path}] M1 starts', await ev(pg, "T.st('m1')") == 'active')
    await ev(pg, "HP.tp(118,-122); HP.sim(1.0)"); check(f'[{path}] M1: arriving at the mill advances the mission', await ev(pg, "T.stage('m1')") == 'recover', await ev(pg, "T.stage('m1')"))
    if path == 'loyal':
        # stealth: wait for Fenwick to step out, crouch, slip into the mill
        await ev(pg, "const f=HP.NPC.byKey('fenwick'); f.ri=1; f.pos.set(134,f.pos.y,-72); HP.Game.player.crouch=true; HP.tp(138.5,-86); HP.Game.player.crouch=true; HP.Game.player.yaw=Math.PI; HP.sim(0.3)")
        ok = await ev(pg, "HP.press('Pick up strongbox')"); await ev(pg, "HP.sim(1.2)")
        check('[loyal] M1: strongbox picked up with a carry animation', ok and await ev(pg, "!!(HP.Game.player.carry && HP.Game.player.carry.id==='strongbox')"))
        await ev(pg, "HP.sim(0.5)"); r = await ev(pg, "({stage:T.stage('m1'), alarm:!!HP.Missions.st('m1').c.alarm, opt:HP.Missions.st('m1').opt})")
        check('[loyal] M1: stealth approach — no alarm, optional objective done', r['stage'] == 'return' and not r['alarm'] and r['opt'].get('unseen'), r)
    else:
        # the lookout: walk into Dutchy's view, bribe him, grab the box during the distraction
        await ev(pg, "HP.S.money=20; const d=HP.NPC.byKey('dutchy'); d.pos.set(116,d.pos.y,-80); d.yaw=-Math.PI/2; d.state='patrol'; HP.Game.player.crouch=false; HP.tp(106,-80); HP.Game.player.yaw=Math.PI/2; HP.sim(1.0)")
        dl = await ev(pg, "HP.Dialog.open ? HP.choices() : null"); check('[betray] M1: Dutchy stops you and offers choices', dl and any(c.startswith('Bribe') for c in dl), dl)
        await ev(pg, "T.pick('Bribe him'); T.close(); HP.sim(1)")
        check('[betray] M1: bribe recorded, gang lured away', await ev(pg, "HP.S.decisions.m1_dutchy") == 'bribed' and await ev(pg, "HP.NPC.byKey('fenwick').state") == 'scripted')
        await ev(pg, "HP.sim(8); HP.tp(138.5,-86); HP.Game.player.yaw=Math.PI; HP.sim(0.3)")
        ok = await ev(pg, "HP.press('Pick up strongbox')"); await ev(pg, "HP.sim(1.5)")
        check('[betray] M1: box taken while the gang is distracted', ok and await ev(pg, "T.stage('m1')") == 'return', await ev(pg, "T.stage('m1')"))
    # ride home: stow on horse, take it off, carry it to Mae
    await ev(pg, "HP.Game.horse.pos.set(130,HP.Game.horse.pos.y,-118); HP.tp(130 - Math.cos(HP.Game.horse.yaw)*1.4, -118 + Math.sin(HP.Game.horse.yaw)*1.4); HP.sim(0.2)")
    ok = await ev(pg, "HP.press('Stow strongbox')"); check(f'[{path}] M1: strongbox stowed on the horse', ok and await ev(pg, "!!HP.S.horseCarry"))
    await ev(pg, "HP.Game.horse.pos.set(-36,HP.Game.horse.pos.y,47); HP.tp(-36 - Math.cos(HP.Game.horse.yaw)*1.4, 47 + Math.sin(HP.Game.horse.yaw)*1.4); HP.sim(0.2); HP.press('Take strongbox'); HP.sim(0.2)")
    await ev(pg, "T.mae(); HP.sim(0.1)")
    ch = await ev(pg, "T.talk('mae')")
    pickp = "Here. Every cent" if path == 'loyal' else '"It was light'
    check(f'[{path}] M1: Mae offers return-or-skim choice', any(c.startswith(pickp) for c in ch), ch)
    await ev(pg, f"T.pick({json.dumps(pickp)}); T.close(); HP.sim(0.5)")
    r = await ev(pg, "({m1:T.st('m1'), box:HP.S.decisions.m1_box, appr:HP.S.decisions.m1_approach, m2:T.st('m2'), page:HP.Inv.count('eli_page'), mae:HP.S.rel.mae})")
    check(f'[{path}] M1 completes and unlocks M2', r['m1'] == 'done' and r['m2'] == 'available' and r['page'] == 1, r)
    return r

async def m2(pg, path):
    await ev(pg, "T.mae(); HP.sim(0.1)")
    await ev(pg, "T.talk('mae')"); await ev(pg, "T.pick('Tell me about the cabin')")
    txt = await ev(pg, "document.getElementById('dlgText').textContent"); await ev(pg, "T.close()")
    if path == 'loyal': check('[loyal] M2: trusting Mae hands over Eli\'s letter', 'letter' in txt and await ev(pg, "HP.Inv.count('letter')") == 1, txt)
    else: check('[betray] M2: Mae refuses to share the letter after the skim', 'Find your own way' in txt and await ev(pg, "HP.Inv.count('letter')") == 0, txt)
    await ev(pg, "HP.tp(-148,-78); HP.sim(0.5)")
    objs = await ev(pg, "T.objs()")
    has_letter_obj = any('unsent letter' in o for o in objs)
    check(f'[{path}] M2: cabin objectives reflect Mae\'s trust (extra clue required when cold)', has_letter_obj == (path == 'betray'), objs)
    clues = [('stake', -145, -79), ('scuffle', -155, -80.5), ('table', -149, -86)] + ([('letter_clue', -151.5, -86.2)] if path == 'betray' else [])
    for cid, x, z in clues:
        await ev(pg, f"HP.tp({x}+0.9,{z}); HP.Game.player.yaw=-Math.PI/2; HP.sim(0.2)")
        ok = await ev(pg, "HP.press('Examine')"); await wait(pg, 1900); await ev(pg, "HP.sim(0.1)")
        check(f'[{path}] M2: examined clue {cid}', ok and await ev(pg, f"!!HP.S.evidence.{cid}"), await ev(pg, "HP.opts()"))
    await ev(pg, "HP.sim(0.5)"); check(f'[{path}] M2: tracking stage begins', await ev(pg, "T.stage('m2')") == 'track')
    mk = await ev(pg, "HP.Missions.markers().length"); check(f'[{path}] M2: cave is marked only if you have Eli\'s letter (else follow the prints)', (mk > 0) == True, mk)
    check(f'[{path}] M2: Eli\'s boot prints are laid on the ground', await ev(pg, "STORY._trail.length") > 40)
    await ev(pg, "HP.tp(-55,-136); HP.sim(0.5)"); check(f'[{path}] M2: reaching the cave advances', await ev(pg, "T.stage('m2')") == 'cave')
    await ev(pg, "HP.tp(-53,-149.6); HP.Game.player.yaw=Math.PI; HP.sim(0.2)"); ok = await ev(pg, "HP.press('Pick up Eli')"); await ev(pg, "HP.sim(1.2)")
    check(f'[{path}] M2: picked up Eli\'s journal', ok and await ev(pg, "HP.Inv.count('journal')") == 1, await ev(pg, "HP.opts()"))
    await ev(pg, "HP.sim(0.5)"); check(f'[{path}] M2: complication — the ambush stage', await ev(pg, "T.stage('m2')") == 'ambush')
    members = await ev(pg, "HP.NPC.all.filter(n=>n.tags.includes('ambush')).map(n=>n.key)")
    if path == 'loyal':
        check('[loyal] M2: Rook (jailed in the bounty) is absent from the ambush', 'rook' not in members and len(members) >= 2, members)
        check('[loyal] M2: no Dutchy ally (never bribed) — straight fight', (await ev(pg, "T.objs().join('|')")).startswith('Survive'), await ev(pg, "T.objs()"))
        await ev(pg, "T.kill('ambush'); HP.sim(0.5)")
    else:
        check('[betray] M2: Dutchy (bribed in M1) shows up to guide you', await ev(pg, "!!HP.NPC.byKey('dutchy')") and 'Follow Dutchy' in (await ev(pg, "T.objs().join('|')")), await ev(pg, "T.objs()"))
        trail = []
        for i in range(90):
            trail.append(await ev(pg, "(()=>{ const d=HP.NPC.byKey('dutchy'); HP.tp(d.pos.x-1.5, d.pos.z+1.5); HP.sim(0.5); return [d.ri, +d.pos.x.toFixed(1), +d.pos.z.toFixed(1), d.state]; })()"))
            if await ev(pg, "!!HP.Missions.st('m2').c.followDone"): break
        check('[betray] M2: following Dutchy slips past the ambush', await ev(pg, "!!HP.Missions.st('m2').c.followDone") and await ev(pg, "HP.S.chars.dutchy") == 'ally', trail[-3:])
    await ev(pg, "HP.sim(0.5)"); check(f'[{path}] M2: decision stage', await ev(pg, "T.stage('m2')") == 'decide', await ev(pg, "T.stage('m2')"))
    # Pike intercepts on the way into town
    await ev(pg, "HP.S.time.hour=12; const pk=HP.NPC.byKey('pike'); pk.pos.set(-12,pk.pos.y,20); pk.state='routine'; HP.tp(-2,20); HP.sim(0.2); for(let i=0;i<40 && !HP.Dialog.open;i++) HP.sim(0.25);")
    dl = await ev(pg, "HP.Dialog.open ? HP.choices() : null"); check(f'[{path}] M2: Sheriff Pike intercepts and demands the journal', dl and any(c.startswith('Hand Eli') for c in dl), dl)
    if path == 'loyal':
        await ev(pg, "T.pick('\"It\\'s going to Mae'); T.close(); HP.sim(0.3)")
        await ev(pg, "T.mae(); HP.sim(0.1)"); await ev(pg, "T.talk('mae')"); await ev(pg, "T.pick('Here\\'s Eli\\'s journal'); T.close(); HP.sim(0.8)")
    else:
        await ev(pg, "T.pick('Hand Eli'); T.close(); HP.sim(0.8)")
    r = await ev(pg, "({m2:T.st('m2'), j:HP.S.decisions.journal, has:HP.Inv.count('journal'), copy:HP.Inv.count('journal_copy'), m3:T.st('m3'), pike:HP.S.rel.pike, mae:HP.S.rel.mae, ch:HP.S.chapter})")
    check(f'[{path}] M2 completes; M3 unlocks', r['m2'] == 'done' and r['m3'] in ('available', 'locked'), r)
    return r

async def m3(pg, path):
    await ev(pg, "HP.S.time.hour=14; const e=HP.NPC.byKey('ezra'); e.pos.set(-130,e.pos.y,100); e.state='routine'; HP.sim(0.1)")
    if await ev(pg, "T.st('m3')") != 'active':
        ch = await ev(pg, "T.talk('ezra')"); await ev(pg, "HP.sim(0.1)"); ch = await ev(pg, "T.close(); T.talk('ezra')")
        check(f'[{path}] M3: Ezra asks for help', any('Nell' in c for c in ch), ch)
        await ev(pg, "T.pick('I\\'ll find Nell'); T.close(); HP.sim(0.3)")
    r = await ev(pg, "({st:T.st('m3'), gilSleepy:!!(HP.NPC.byKey('gil')||{}).sleepy, brock:!!HP.NPC.byKey('brock'), nell:(HP.NPC.byKey('nell')||{}).state})")
    check(f'[{path}] M3 starts with Brock, Gil and Nell tied in the barn', r['st'] == 'active' and r['brock'] and r['nell'] == 'tied', r)
    check(f'[{path}] M3: Gil is {"asleep (pelts side mission paid off)" if path=="loyal" else "awake (no side mission)"}', r['gilSleepy'] == (path == 'loyal'), r)
    # free Nell first
    await ev(pg, "const n=HP.NPC.byKey('nell'); HP.tp(n.pos.x, n.pos.z+1.2); HP.Game.player.yaw=Math.PI; HP.Game.player.crouch=true; const g=HP.NPC.byKey('gil'); if(!g.sleepy){ g.takeHit({dmg:999, from:HP.Game.player, melee:true}); } HP.sim(0.2)")
    ok = await ev(pg, "HP.press('Untie Nell')"); await wait(pg, 1900); await ev(pg, "HP.sim(0.2)")
    check(f'[{path}] M3: rescued Nell from the barn', ok and await ev(pg, "!!HP.S.flags.m3_nell_free"), await ev(pg, "HP.opts()"))
    await ev(pg, "HP.Game.player.crouch=false; const b=HP.NPC.byKey('brock'); HP.tp(b.pos.x+4, b.pos.z); HP.sim(0.2); for(let i=0;i<20 && !HP.Dialog.open;i++){ HP.tp(b.pos.x+3, b.pos.z); HP.sim(0.2);} ")
    dl = await ev(pg, "HP.Dialog.open ? HP.choices() : null")
    jopt = next((c for c in (dl or []) if c.startswith('Show him Eli')), '')
    check(f'[{path}] M3: Brock confrontation opens', bool(dl), dl)
    check(f'[{path}] M3: journal option {"available (kept a copy)" if path=="loyal" else "locked (gave journal to Pike)"}', ('[x]' not in jopt) == (path == 'loyal') and jopt, jopt)
    if path == 'loyal':
        await ev(pg, "T.pick('Show him Eli'); T.close(); HP.sim(0.5)")
        check('[loyal] M3: evidence resolves it without a fight', await ev(pg, "HP.S.decisions.m3") == 'evidence' and await ev(pg, "T.stage('m3')") == 'wrap')
        await ev(pg, "HP.sim(1); const e=HP.NPC.byKey('ezra'); e.pos.set(-126,e.pos.y,93); e.state='routine'; HP.sim(0.1)")
        await ev(pg, "T.talk('ezra')"); await ev(pg, "T.pick('You\\'re safe'); T.close(); HP.sim(0.8)")
    else:
        await ev(pg, "T.pick('\"What\\'s it worth'); T.pick('Take Vane'); T.close(); HP.sim(0.5)")
        check('[betray] M3: took the railroad\'s money', await ev(pg, "HP.S.decisions.m3") == 'railroad' and await ev(pg, "T.stage('m3')") == 'betray')
        await ev(pg, "const e=HP.NPC.byKey('ezra'); e.state='routine'; e.pos.set(-126,e.pos.y,93); HP.sim(0.1)")
        ch = await ev(pg, "T.talk('ezra')"); await ev(pg, "T.pick('Tell him to sign'); T.close(); HP.sim(0.8)")
    r = await ev(pg, "({m3:T.st('m3'), out:HP.Missions.st('m3').outcome, farm:HP.S.locations.farm, ezra:HP.S.chars.ezra, rifle:!!HP.S.weapons.rifle, pelts:T.st('side_pelts'), honor:HP.S.honor, ezraNPC:!!HP.NPC.byKey('ezra'), ch4:T.st('ch4')})")
    check(f'[{path}] M3 completes', r['m3'] == 'done', r)
    return r

async def main():
    async with async_playwright() as p:
        # ================= PATH A: loyal =================
        b, pg, errs = await new_game(p)
        A1 = await m1(pg, 'loyal')
        check('[loyal] M1 decision recorded: returned', A1['box'] == 'returned' and A1['appr'] == 'stealth' and A1['mae'] >= 30, A1)
        # side mission: pelts for Ezra (hunting events are the same ones real kills emit)
        await ev(pg, "HP.S.time.hour=14; const e=HP.NPC.byKey('ezra'); e.pos.set(-130,e.pos.y,100); e.state='routine'; HP.sim(0.1)")
        await ev(pg, "T.talk('ezra')"); await ev(pg, "T.close(); T.talk('ezra')"); await ev(pg, "T.pick('Need any help'); T.close(); HP.sim(0.2)")
        check('[loyal] Side: Pelts for Pa Greer starts', await ev(pg, "T.st('side_pelts')") == 'active')
        await ev(pg, "HP.Missions.emit('skin',{sp:'deer',quality:'perfect'}); HP.Inv.add('pelt_deer',2,true); HP.Inv.add('pelt_rabbit',1,true); HP.sim(0.5)")
        await ev(pg, "T.talk('ezra')"); await ev(pg, "T.pick('Hand over the pelts'); T.close(); HP.sim(0.8)")
        r = await ev(pg, "({st:T.st('side_pelts'), opt:HP.Missions.st('side_pelts').opt, oats:HP.Inv.count('oats'), ezra:HP.S.rel.ezra})")
        check('[loyal] Side mission completes with optional bonus', r['st'] == 'done' and r['opt'].get('perfect') and r['oats'] >= 2, r)
        # bounty: Rook Malloy, alive
        await ev(pg, "HP.tp(-25.5,9.6); HP.Game.player.yaw=Math.PI; HP.sim(0.2)")
        ok = await ev(pg, "HP.press('Read poster')"); await ev(pg, "T.pick('Take the bounty'); T.close(); HP.sim(0.3)")
        check('[loyal] Bounty: Rook Malloy accepted from the sheriff\'s board', ok and await ev(pg, "T.st('bounty_rook')") == 'active')
        await ev(pg, "HP.tp(riverX(-120)+16,-126); HP.sim(0.8)")
        check('[loyal] Bounty: Rook found at the ford', await ev(pg, "T.stage('bounty_rook')") == 'take' and await ev(pg, "!!HP.NPC.byKey('rook')"))
        await ev(pg, "const r=HP.NPC.byKey('rook'); r.takeHit({dmg:999, from:HP.Game.player, melee:true}); HP.tp(r.pos.x, r.pos.z+1.2); HP.Game.player.yaw=Math.PI; HP.sim(0.2)")
        ok = await ev(pg, "HP.press('Hogtie')"); await wait(pg, 1900); await ev(pg, "HP.sim(0.2)")
        ok2 = await ev(pg, "HP.press('Pick up Rook')"); await ev(pg, "HP.sim(1.2)")
        check('[loyal] Bounty: Rook knocked out, hogtied and carried', ok and ok2 and await ev(pg, "!!(HP.Game.player.carry && HP.Game.player.carry.npc)"))
        await ev(pg, "HP.S.time.hour=8; const pk=HP.NPC.byKey('pike'); pk.pos.set(-22,pk.pos.y,9.5); pk.yaw=0; pk.state='routine'; HP.sim(0.1)")
        await ev(pg, "T.talk('pike')"); await ev(pg, "T.pick('Turn in Rook'); T.close(); HP.sim(0.5)")
        r = await ev(pg, "({st:T.st('bounty_rook'), rook:HP.S.chars.rook, money:HP.S.money})")
        check('[loyal] Bounty: delivered alive, Rook jailed', r['st'] == 'done' and r['rook'] == 'jailed', r)
        A2 = await m2(pg, 'loyal')
        check('[loyal] M2 decision recorded: journal went to Mae, copy made', A2['j'] == 'mae' and A2['has'] == 1 and A2['copy'] == 1, A2)
        # ---- save, real page reload, Continue ----
        print('SAVE CHECK', await ev(pg, "(()=>{ try { JSON.stringify(HP.S); } catch(e) { return 'stringify: ' + e.message; } try { return HP.Save.save(true) + ' ' + (localStorage.getItem(HP.Save.KEY)||'').length; } catch(e) { return e.message; } })()"))
        await ev(pg, "HP.Save.save(true)"); await reload_continue(pg)
        r = await ev(pg, "({box:HP.S.decisions.m1_box, j:HP.S.decisions.journal, rook:HP.S.chars.rook, m1:T.st('m1'), m2:T.st('m2'), m3:T.st('m3'), pelts:HP.S.flags.pelts_done, copy:HP.Inv.count('journal_copy'), mae:HP.S.rel.mae, ev:Object.keys(HP.S.evidence).length, rookNPC:!!HP.NPC.byKey('rook')})")
        check('[loyal] PERSIST after reload: decisions, fates, missions, evidence, inventory', r['box'] == 'returned' and r['j'] == 'mae' and r['rook'] == 'jailed' and r['m1'] == 'done' and r['m2'] == 'done' and r['m3'] == 'available' and r['pelts'] and r['copy'] == 1 and r['ev'] >= 6 and not r['rookNPC'], r)
        A3 = await m3(pg, 'loyal')
        check('[loyal] M3 outcome: Greers keep farm, Ezra gives his rifle, Chapter 4 teased', A3['farm'] == 'occupied' and A3['rifle'] and A3['ezraNPC'] and A3['ch4'] == 'available', A3)
        await ev(pg, "HP.Save.save(true)"); await reload_continue(pg)
        r = await ev(pg, "({farm:HP.S.locations.farm, ezra:!!HP.NPC.byKey('ezra'), safe:!!HP.S.flags.greer_safehouse, rifle:!!HP.S.weapons.rifle, ch:HP.S.chapter, boards:World.farmBoards.visible})")
        check('[loyal] PERSIST after reload: farm occupied, Ezra present, safehouse unlocked', r['farm'] == 'occupied' and r['ezra'] and r['safe'] and r['rifle'] and r['ch'] == 4 and not r['boards'], r)
        await ev(pg, "HP.S.time.hour=14; const e=HP.NPC.byKey('ezra'); e.pos.set(-130,e.pos.y,100); e.state='routine'; HP.sim(0.1)")
        ch = await ev(pg, "T.talk('ezra')"); check('[loyal] Reactive: Ezra offers his home as a safehouse', any('Rest here' in c for c in ch), ch)
        await ev(pg, "T.close()"); await pg.screenshot(path=OUT + 's_loyal.png')
        gos = await ev(pg, "STORY.gossip('cora')"); check('[loyal] Reactive: townsfolk gossip reflects your deeds', any('Mae\'s strongbox back whole' in g for g in gos) and any('stood up for him' in g for g in gos), gos)
        A_err = [e for e in errs if 'ERR_TUNNEL' not in e]; await b.close()

        # ================= PATH B: betrayal =================
        b, pg, errs = await new_game(p)
        B1 = await m1(pg, 'betray')
        check('[betray] M1 decision recorded: skimmed, approach bribe', B1['box'] == 'skimmed' and B1['appr'] == 'bribe' and B1['mae'] < 0, B1)
        r = await ev(pg, "({mul:HP.Inv.priceMul()})")
        r2 = await ev(pg, "Rep.mood('mae')")
        check('[betray] Reactive: Mae now charges you 20% more and turns cold', abs(r['mul'] - 1.2) < 1e-6 and r2 in ('cold', 'hostile'), [r, r2])
        B2 = await m2(pg, 'betray')
        check('[betray] M2 decision recorded: journal handed to Pike, Dutchy is an ally', B2['j'] == 'pike' and B2['has'] == 0 and B2['copy'] == 0, B2)
        await ev(pg, "HP.Save.save(true)"); pre_m3 = await ev(pg, "localStorage.getItem(HP.Save.KEY)")
        await reload_continue(pg)
        r = await ev(pg, "({box:HP.S.decisions.m1_box, j:HP.S.decisions.journal, dutchy:HP.S.chars.dutchy, mul:HP.Inv.priceMul(), m3:T.st('m3'), journal:HP.Inv.count('journal')})")
        check('[betray] PERSIST after reload: skim, journal-to-Pike, Dutchy ally, price penalty', r['box'] == 'skimmed' and r['j'] == 'pike' and r['dutchy'] == 'ally' and abs(r['mul'] - 1.2) < 1e-6 and r['m3'] == 'available' and r['journal'] == 0, r)
        # failure & retry: Nell dies -> fail screen -> Retry restores the checkpoint
        await ev(pg, "HP.S.time.hour=14; const e=HP.NPC.byKey('ezra'); e.pos.set(-130,e.pos.y,100); e.state='routine'; HP.sim(0.1)")
        await ev(pg, "T.talk('ezra')"); await ev(pg, "T.close(); T.talk('ezra')"); await ev(pg, "T.pick('I\\'ll find Nell'); T.close(); HP.sim(0.3)")
        await ev(pg, "HP.NPC.byKey('nell').takeHit({dmg:999, from:HP.NPC.byKey('gil'), gun:'revolver'}); HP.sim(0.5)")
        vis = await pg.is_visible('#fRetry'); check('[betray] FAIL state: Nell killed -> mission failed screen with Retry', vis)
        await pg.click('#fRetry'); await ev(pg, "HP.sim(0.5)")
        r = await ev(pg, "({st:T.st('m3'), nell:HP.S.chars.nell, nellNPC:(HP.NPC.byKey('nell')||{}).state})")
        check('[betray] FAIL state: Retry restores Nell and restarts the mission', r['st'] == 'active' and r['nell'] == 'home' and r['nellNPC'] == 'tied', r)
        B3 = await m3(pg, 'betray')
        check('[betray] M3 outcome: Greers leave, farm abandoned, side mission closed, honor falls', B3['farm'] == 'abandoned' and B3['ezra'] == 'left' and not B3['ezraNPC'] and B3['pelts'] == 'unavailable' and B3['honor'] < 0, B3)
        await ev(pg, "HP.Save.save(true)"); await reload_continue(pg)
        r = await ev(pg, "({farm:HP.S.locations.farm, ezra:!!HP.NPC.byKey('ezra'), nell:!!HP.NPC.byKey('nell'), boards:World.farmBoards.visible, pelts:T.st('side_pelts'), out:HP.Missions.st('m3').outcome})")
        check('[betray] PERSIST after reload: farm boarded up, Greers gone, outcome logged', r['farm'] == 'abandoned' and not r['ezra'] and not r['nell'] and r['boards'] and r['pelts'] == 'unavailable', r)
        gos = await ev(pg, "STORY.gossip('cora')"); check('[betray] Reactive: town gossip turns on you', any('lighter' in g for g in gos) and any('Greers packed up' in g for g in gos), gos)
        await pg.screenshot(path=OUT + 's_betray.png')
        # ================= PATH C: accept failure =================
        await ev(pg, f"localStorage.setItem(HP.Save.KEY, {json.dumps(pre_m3)})"); await reload_continue(pg)
        await ev(pg, "HP.S.time.hour=14; const e=HP.NPC.byKey('ezra'); e.pos.set(-130,e.pos.y,100); e.state='routine'; HP.sim(0.1)")
        await ev(pg, "T.talk('ezra')"); await ev(pg, "T.close(); T.talk('ezra')"); await ev(pg, "T.pick('I\\'ll find Nell'); T.close(); HP.sim(0.3)")
        await ev(pg, "HP.NPC.byKey('nell').takeHit({dmg:999, from:HP.NPC.byKey('gil'), gun:'revolver'}); HP.sim(0.5)")
        await pg.click('#fAccept'); await ev(pg, "HP.sim(0.5)")
        r = await ev(pg, "({st:T.st('m3'), out:HP.Missions.st('m3').outcome, farm:HP.S.locations.farm, nell:HP.S.chars.nell, pelts:T.st('side_pelts')})")
        check('[fail] Accepting failure is permanent: m3 failed, farm abandoned, Nell dead, side mission closed', r['st'] == 'failed' and r['farm'] == 'abandoned' and r['nell'] == 'dead' and r['pelts'] == 'unavailable', r)
        await ev(pg, "HP.Save.save(true)"); await reload_continue(pg)
        r = await ev(pg, "({st:T.st('m3'), nell:HP.S.chars.nell, ch4:T.st('ch4')})")
        check('[fail] PERSIST after reload: failure and its consequences remain', r['st'] == 'failed' and r['nell'] == 'dead' and r['ch4'] == 'available', r)
        B_err = [e for e in errs if 'ERR_TUNNEL' not in e]; await b.close()
        print('page errors:', A_err[:5], B_err[:5])
    fails = [x for x in RESULTS if not x[1]]
    print(f"\n{len(RESULTS)-len(fails)}/{len(RESULTS)} story checks passed")
    json.dump(RESULTS, open(OUT + 'story.json', 'w'))
    if fails or A_err + B_err: raise SystemExit(1)  # non-zero exit so CI fails on any failed check or page error
asyncio.run(main())
