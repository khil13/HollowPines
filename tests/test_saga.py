"""The new story, "The Last Good Country": Chapter 1 played through. A new game opens at the outfit's camp at Hollow
Cabin; Wren fetches Doc Pell's kit for her wounded brother (paid, on the truth, at gunpoint or stolen), then hunts to
feed the camp. Also: the classic story still starts from its own button, and the two don't leak into each other."""
import asyncio, json
from run import boot
from playwright.async_api import async_playwright
RESULTS = []
def check(name, ok, info=''):
    RESULTS.append((name, bool(ok), str(info)[:500])); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{str(info)[:500]}]' if info else ''))
async def ev(pg, js): return await pg.evaluate(js)
H = r"""window.Q = {
  near(key, d = 1.6) { const n = HP.NPC.byKey(key); if (!n) return false; const a = n.yaw; HP.tp(n.pos.x + Math.sin(a) * d, n.pos.z + Math.cos(a) * d); HP.Game.player.yaw = Math.atan2(n.pos.x - HP.Game.player.pos.x, n.pos.z - HP.Game.player.pos.z); HP.sim(0.1); return true; },
  talk(key) { if (HP.Dialog.open) HP.Dialog.close(); if (!this.near(key)) return 'no npc ' + key; const ok = HP.press('Talk to ' + HP.NPC.byKey(key).name.split(' ')[0]); return ok ? HP.choices() : 'no talk opt: ' + JSON.stringify(HP.opts()); },
  say() { return document.querySelector('#dlg .txt, #dlgText, #dlg p') ? (document.querySelector('#dlgText') || document.querySelector('#dlg .txt') || document.querySelector('#dlg p')).textContent : ''; },
  pick(p) { return HP.choose(p); }, close() { if (HP.Dialog.open) HP.Dialog.close(); },
  st(id) { return HP.Missions.st(id).status; }, stage(id) { return SAGA.stage(id); },
  objs() { return HP.Missions.objectives().map(o => (o.optional ? '(opt) ' : '') + (typeof o.text === 'function' ? o.text(HP.Missions.ctx) : o.text)); },
  doc() { const d = HP.NPC.byKey('doc'); HP.S.time.hour = 9; d.pos.set(-40, d.pos.y, 33); d.state = 'routine'; d.act = 'work'; d.path = null; d.goal = null; d.atPlace = true; HP.sim(0.2); },
};"""
async def new_game(p, button='#bNew'):
    b, pg, errs = await boot(p, classic=False); await ev(pg, "localStorage.clear()"); await pg.click(button); await pg.wait_for_timeout(400); await ev(pg, H); await ev(pg, "HP.sim(0.5)"); return b, pg, errs

async def main():
    async with async_playwright() as p:
        b, pg, errs = await new_game(p)
        r = await ev(pg, """(()=>{ const P = HP.Game.player; HP.sim(3); return { story: HP.S.story, active: HP.Missions.active, stage: Q.stage('s1'), campD: +Math.hypot(P.pos.x - SAGA.CAMP.x, P.pos.z - SAGA.CAMP.z).toFixed(1), gang: ['marlowe', 'tess', 'bill', 'cole', 'eli'].map(k => { const n = HP.NPC.byKey(k); return n ? +Math.hypot(n.pos.x - SAGA.CAMP.x, n.pos.z - SAGA.CAMP.z).toFixed(0) : null; }),
          classic: ['intro', 'm1'].map(id => Q.st(id)), mae: !!HP.NPC.byKey('mae'), objs: Q.objs(), money: HP.S.money, horseD: +HP.Game.horse.distP.toFixed(0), log: HP.S.log[0].text.slice(0, 40) }; })()""")
        check('new game: the saga opens at the Hollow Cabin camp with the outfit around the fire and "A Bullet in the Boy" active', r['story'] == 'saga' and r['active'] == 's1' and r['stage'] == 'camp' and r['campD'] < 8 and all(d is not None and d < 14 for d in r['gang']) and r['horseD'] < 12, r)
        check('new game: the classic missions stay locked, but the town and its people are still there', r['classic'] == ['locked', 'locked'] and r['mae'], r)
        r = await ev(pg, """(()=>{ const c = Q.talk('marlowe'); const briefed = HP.S.flags.saga_briefed; Q.pick('What do I tell'); Q.pick('Continue'); Q.pick('Continue'); Q.close(); HP.sim(0.3); const st = Q.stage('s1'); const b = Q.talk('bill'); Q.pick('How bad'); Q.close(); HP.sim(0.3);
          const tess = Q.talk('tess'); Q.pick('You don'); Q.close(); const cole = Q.talk('cole'); Q.close(); return { c, briefed, st, b, tess, cole, objs: Q.objs() }; })()""")
        check('camp: Marlowe sends Wren for the doctor\'s kit; Bill, Tess and Cole each have something to say', r['briefed'] and r['st'] == 'ride' and isinstance(r['b'], list) and isinstance(r['tess'], list) and isinstance(r['cole'], list) and any('Juniper Gap' in o for o in r['objs']), r)
        r = await ev(pg, """(()=>{ HP.tp(-40, 24); HP.sim(0.5); const st = Q.stage('s1'); Q.doc(); const c = Q.talk('doc'); Q.pick('Your surgical kit'); const price = HP.choices(); Q.pick('I don'); Q.pick('There'); Q.pick('He'); const how = HP.S.decisions.s1_med, kit = HP.S.inv.medkit, honor = HP.S.honor, owes = HP.S.flags.owes_doc; Q.close(); HP.sim(0.5);
          return { st, c, price, how, kit, honor, owes, st2: Q.stage('s1'), objs: Q.objs() }; })()""")
        check('town: reaching Juniper Gap moves on to the doctor; $10 is out of reach on $7, and the truth gets the kit on a promise (honor up)', r['st'] == 'med' and any('[x]' in c for c in r['price']) and r['how'] == 'favor' and r['kit'] == 1 and r['honor'] > 0 and r['owes'] and r['st2'] == 'back', r)
        r = await ev(pg, """(()=>{ Q.near('bill'); HP.sim(0.3); const c = Q.talk('bill'); const ok = Q.pick('[Give him the kit]'); Q.pick('Continue'); Q.close(); HP.sim(1); return { c, ok, s1: Q.st('s1'), out: HP.Missions.st('s1').outcome, eli: HP.S.chars.eli, s2: Q.st('s2'), kit: HP.S.inv.medkit || 0 }; })()""")
        check('camp: giving Bill the kit completes the mission, Eli mends, and "Empty Bellies" opens', r['ok'] and r['s1'] == 'done' and 'truth' in r['out'] and r['eli'] == 'mending' and r['s2'] == 'available' and r['kit'] == 0, r)
        r = await ev(pg, """(()=>{ const c = Q.talk('bill'); Q.pick('I\\'ll hunt'); Q.pick('Continue'); Q.close(); HP.sim(0.3); const st = Q.stage('s2'), P = HP.Game.player; HP.tp(-128, -52); HP.sim(0.3); const d = Animal.spawn('deer', P.pos.x + 3, P.pos.z + 3); d.takeHit({ dmg: 999, from: P, gun: 'rifle' }); HP.sim(0.5); Q_d = d;
          HP.tp(d.pos.x + 0.8, d.pos.z); HP.sim(0.3); const o = HP.opts(); const sk = HP.press('Skin'); return { c, st, o, sk }; })()""")
        await pg.wait_for_timeout(3500)  # skinning runs on a real-time timer
        r.update(await ev(pg, "(()=>{ HP.sim(1); return { meat: HP.S.inv.meat_raw || 0, st2: Q.stage('s2'), clean: HP.Missions.ctx && HP.Missions.ctx.m.c.clean }; })()"))
        check('hunt: Bill asks for venison; a deer brought down and skinned moves the mission on (one shot counts as a clean kill)', r['st'] == 'hunt' and r['sk'] and r['meat'] >= 2 and r['st2'] == 'deliver' and r['clean'], r)
        r = await ev(pg, """(()=>{ const m0 = HP.S.money; const c = Q.talk('bill'); const ok = Q.pick('[Give him the venison]'); Q.pick('Continue'); Q.close(); HP.sim(1); const jos = Q.talk('marlowe'); Q.pick('What happens now'); Q.close();
          return { ok, s2: Q.st('s2'), chapter: HP.S.chapter, paid: +(HP.S.money - m0).toFixed(2), jos, meat: HP.S.inv.meat_raw || 0 }; })()""")
        check('camp: feeding the outfit ends Chapter 1 (Chapter 2 unlocked in the journal, a share from the camp tin, Marlowe has the mill job ready)', r['ok'] and r['s2'] == 'done' and r['chapter'] == 2 and r['paid'] == 3 and any('Tell me what you know' in c for c in r['jos']), r)
        # ---------- Chapter 2: Crane Money ----------
        r = await ev(pg, """(()=>{ HP.sim(6); document.querySelectorAll('.toast').forEach(t => t.remove()); const st0 = Q.st('s3'); const c = Q.talk('marlowe'); Q.pick('Why the Cranes'); Q.pick('Continue'); const ok = Q.pick('I'); Q.pick('Continue'); Q.close(); HP.sim(0.3);
          const st = Q.stage('s3'); HP.tp(MILL.x - 40, MILL.z + 5); HP.sim(1); const st2 = Q.stage('s3'), cranes = HP.NPC.all.filter(n => n.group === 'crane').length, d = HP.NPC.byKey('dutchy');
          HP.Dialog.start(d, SAGA.dutchyTree(d)); const ch = HP.choices(); Q.pick('"You look hungry'); Q.close(); HP.sim(0.5); const offer = [HP.S.decisions.s3_dutchy, HP.S.flags.dutchy_offer];
          const P = HP.Game.player, box = Carry.list.find(c => c.id === 'strongbox'); HP.tp(box.mesh.position.x + 0.6, box.mesh.position.z); HP.sim(0.3); const pk = HP.press('Pick up strongbox'); HP.sim(1.5);
          return { st0, c, ok, st, st2, cranes, ch, offer, pk, carrying: !!(P.carry && P.carry.id === 'strongbox'), st3: Q.stage('s3'), alarm: HP.Missions.ctx.m.c.alarm || 0 }; })()""")
        check('ch2: Marlowe gives the mill job; the Cranes are at Coyote Mill; Dutchy can be offered a way out; the box comes out unseen', r['st0'] == 'available' and r['ok'] and r['st'] == 'ride' and r['st2'] == 'take' and r['cranes'] >= 3 and r['offer'] == ['offered', True] and r['pk'] and r['carrying'] and r['st3'] == 'return' and not r['alarm'], r)
        r = await ev(pg, """(()=>{ const m0 = HP.S.money, h0 = HP.S.honor; Q.near('marlowe', 1.4); HP.sim(0.3); const c = Q.talk('marlowe'); const ok = Q.pick('[Hand it over]'); Q.pick('Continue'); Q.close(); HP.sim(1);
          return { c, ok, s3: Q.st('s3'), out: HP.Missions.st('s3').outcome, paid: +(HP.S.money - m0).toFixed(2), honor: HP.S.honor - h0, chapter: HP.S.chapter, mill: HP.S.locations.mill, cranes: HP.NPC.all.filter(n => n.group === 'crane').length, dutchy: HP.S.chars.dutchy, carry: !!HP.Game.player.carry, unaware: HP.S.flags.crane_unaware }; })()""")
        check('ch2: handing Josiah the whole box pays a share and honor, ends the chapter, and the Cranes never learn who robbed them', r['ok'] and r['s3'] == 'done' and r['paid'] == 18 and r['honor'] > 0 and r['chapter'] == 3 and r['cranes'] == 0 and r['dutchy'] == 'deserted' and not r['carry'] and r['unaware'] and 'every dollar' in r['out'], r)
        # ---------- Chapter 3: The Halvorsen Payroll ----------
        r = await ev(pg, """(()=>{ HP.sim(6); document.querySelectorAll('.toast').forEach(t => t.remove()); const st0 = Q.st('s4'); const c = Q.talk('marlowe'); Q.pick('How do we take it'); Q.pick('Continue'); const plans = HP.choices(); Q.pick('Tess'); Q.pick('Continue'); Q.close(); HP.sim(0.3);
          const st = Q.stage('s4'), plan = HP.S.decisions.s4_plan, guards = HP.NPC.all.filter(n => n.tags.includes('s4foe')).length, tess = HP.NPC.byKey('tess'), tessD = +Math.hypot(tess.pos.x - T_OVERLOOK.x, tess.pos.z - T_OVERLOOK.z).toFixed(0);
          HP.S.time.hour = 22; HP.tp(T_OVERLOOK.x + 3, T_OVERLOOK.z + 2); HP.sim(1); const st2 = Q.stage('s4'), dark = HP.Missions.ctx.m.c.dark;
          const P = HP.Game.player; P.inv = 1e9; for (const n of HP.NPC.all) if (n.tags.includes('s4foe')) n.sense = 0; HP.tp(88.8, -157.2); HP.sim(0.4); const o = HP.opts(); const took = HP.press('Pick up Paymaster'); return { st0, c, plans, st, plan, guards, tessD, st2, dark, o, took }; })()""")
        await pg.wait_for_timeout(2500)
        r.update(await ev(pg, """(()=>{ HP.sim(1); const letter = HP.S.inv.rail_letter || 0; const box = Carry.list.find(c => c.id === 'strongbox'); HP.tp(box.mesh.position.x + 0.7, box.mesh.position.z + 0.3); HP.sim(0.3); const pk = HP.press('Pick up strongbox'); HP.sim(1.5); return { letter, pk, st3: Q.stage('s4'), alarm: HP.Missions.ctx.m.c.alarm || 0 }; })()"""))
        check('ch3: Marlowe lays out two plans; choosing Tess\'s puts her on the overlook and four guards in the camp; after dark Wren lifts the telegram and the chest unseen', r['st0'] == 'available' and len(r['plans']) == 2 and r['plan'] == 'quiet' and r['st'] == 'ride' and r['guards'] == 4 and r['tessD'] < 3 and r['st2'] == 'camp' and r['dark'] and r['took'] and r['letter'] == 1 and r['pk'] and r['st3'] == 'return' and not r['alarm'], r)
        r = await ev(pg, """(()=>{ const m0 = HP.S.money, h0 = HP.S.honor; Q.near('marlowe', 1.4); HP.sim(0.3); const c = Q.talk('marlowe'); const ok = Q.pick('[Hand over the chest; show the telegram to Tess'); Q.pick('Continue'); Q.close(); HP.sim(1.5);
          const tess = HP.NPC.byKey('tess'); return { c, ok, s4: Q.st('s4'), out: HP.Missions.st('s4').outcome, paid: +(HP.S.money - m0).toFixed(2), honor: HP.S.honor - h0, chapter: HP.S.chapter, letter: HP.S.decisions.s4_letter, guards: HP.NPC.all.filter(n => n.tags.includes('s4')).length, tessHome: !!tess && tess.state !== 'scripted', bounty: HP.S.bounty }; })()""")
        check('ch3: bringing Josiah the chest pays $60, honor for a bloodless job, the telegram choice is remembered, Tess comes home and Chapter 4 unlocks', r['ok'] and r['s4'] == 'done' and r['paid'] == 60 and r['honor'] > 0 and r['chapter'] == 4 and r['letter'] == 'tess' and r['guards'] == 0 and r['tessHome'] and r['bounty'] == 0 and 'unseen' in r['out'], r)
        r = await ev(pg, """(()=>{ UI.open('story'); const t = document.getElementById('pBody').textContent; UI.close(); return { ashes: t.includes('Ashes'), marlowe: t.includes('Josiah Marlowe'), noOld: !t.includes('Cold Trail') }; })()""")
        check('journal: the Story tab shows the saga\'s chapters and people', r['ashes'] and r['marlowe'] and r['noOld'], r)
        # save, reload, continue
        await ev(pg, "HP.Save.save(true)"); await pg.wait_for_timeout(500); await pg.reload(); await pg.wait_for_function('document.getElementById("loading").textContent===""', timeout=180000); await pg.click('#bCont'); await pg.wait_for_timeout(500); await ev(pg, H)
        r = await ev(pg, "(()=>{ HP.sim(1); return { story: HP.S.story, s1: Q.st('s1'), s2: Q.st('s2'), how: HP.S.decisions.s1_med, gang: !!HP.NPC.byKey('marlowe'), m1: Q.st('m1') }; })()")
        r2 = await ev(pg, "[Q.st('s3'), HP.S.decisions.s3_box, HP.S.chapter, Q.st('s4')]")
        check('save: continuing keeps the saga, its decisions and the camp', r == {'story': 'saga', 's1': 'done', 's2': 'done', 'how': 'favor', 'gang': True, 'm1': 'locked'} and r2 == ['done', 'all', 4, 'done'], [r, r2])
        check('no page errors (saga)', not [e for e in errs if 'favicon' not in e], errs[:3]); await b.close()

        # the other three ways to get the kit
        b, pg, errs = await new_game(p)
        r = await ev(pg, """(()=>{ const go = () => { HP.S.flags.saga_briefed = true; HP.sim(0.3); HP.tp(-40, 24); HP.sim(0.5); Q.doc(); }; const snap = JSON.stringify(HP.S); const out = {};
          go(); HP.S.money = 12; Q.talk('doc'); Q.pick('Your surgical kit'); Q.pick('Ten dollars'); Q.close(); HP.sim(0.3); out.paid = { how: HP.S.decisions.s1_med, money: HP.S.money, kit: HP.S.inv.medkit, st: Q.stage('s1') };
          HP.Save.apply(JSON.parse(snap)); HP.Missions.resume(); go(); const h0 = HP.S.honor; Q.talk('doc'); Q.pick('[Draw]'); Q.pick('[Take it]'); Q.close(); HP.sim(0.3); out.threat = { how: HP.S.decisions.s1_med, honor: HP.S.honor - h0, kit: HP.S.inv.medkit, robbed: HP.S.flags.doc_robbed };
          HP.Save.apply(JSON.parse(snap)); HP.Missions.resume(); go(); const d = HP.NPC.byKey('doc'); d.pos.set(-60, d.pos.y, 20); const B = Buildings.find(x => x.name === "Doc Pell's"); HP.tp(B.x + 2.6, B.z - 1.4); HP.sim(0.3); const o = HP.opts(); const took = HP.press('Steal'); HP.sim(2.5); out.stole = { o, took, how: HP.S.decisions.s1_med, kit: HP.S.inv.medkit, st: Q.stage('s1') }; return out; })()""")
        check('kit: paying $10 works when Wren has it', r['paid']['how'] == 'paid' and r['paid']['money'] == 2 and r['paid']['kit'] == 1 and r['paid']['st'] == 'back', r['paid'])
        check('kit: taking it at gunpoint costs honor and the doctor remembers', r['threat']['how'] == 'threat' and r['threat']['honor'] <= -8 and r['threat']['kit'] == 1 and r['threat']['robbed'], r['threat'])
        check('kit: it can be lifted from the washstand while the doctor is out', r['stole']['took'] and r['stole']['how'] == 'stole' and r['stole']['kit'] == 1 and r['stole']['st'] == 'back', r['stole'])
        r = await ev(pg, """(()=>{ HP.S.missions.s1.status = 'done'; HP.S.missions.s2 = { status: 'done', stage: 0, c: {}, opt: {}, outcome: '' }; HP.Missions.active = null; HP.S.activeMission = null; HP.Missions.ctx = null; HP.Missions.refresh(); HP.Missions.start('s3'); HP.tp(MILL.x - 40, MILL.z + 5); HP.sim(1);
          const P = HP.Game.player, f = HP.NPC.byKey('fenwick'); f.alertGroup(P.pos); HP.sim(0.5); const alarm = HP.Missions.ctx.m.c.alarm; const box = Carry.list.find(c => c.id === 'strongbox'); HP.tp(box.mesh.position.x + 0.6, box.mesh.position.z); P.inv = 1e9; HP.sim(0.2); HP.press('Pick up strongbox'); HP.sim(1.2); const st = Q.stage('s3');
          for (const n of HP.NPC.all.slice()) if (n.group === 'crane' && n.alive) n.takeHit({ dmg: 999, from: P, gun: 'revolver' }); HP.sim(1); const st2 = Q.stage('s3'); const m0 = HP.S.money, h0 = HP.S.honor; Q.near('marlowe', 1.4); HP.sim(0.3); Q.talk('marlowe'); Q.pick('[Lie]'); Q.pick('Continue'); Q.close(); HP.sim(1);
          return { alarm, st, st2, s3: Q.st('s3'), paid: +(HP.S.money - m0).toFixed(2), honor: HP.S.honor - h0, war: HP.S.flags.crane_war, out: HP.Missions.st('s3').outcome, fen: HP.S.chars.fenwick }; })()""")
        check('ch2: going in loud means fighting clear of the Cranes; keeping $45 back costs honor and starts a feud', r['alarm'] and r['st'] == 'escape' and r['st2'] == 'return' and r['s3'] == 'done' and r['paid'] == 45 and r['honor'] < 0 and r['war'] and 'Kept $45' in r['out'], r)
        r = await ev(pg, """(()=>{ HP.Missions.refresh(); HP.S.decisions.s4_plan = 'loud'; HP.Missions.start('s4'); HP.S.time.hour = 13; HP.tp(T_OVERLOOK.x + 3, T_OVERLOOK.z + 2); HP.sim(1); const P = HP.Game.player; P.inv = 1e9; HP.tp(T_GATE.x, T_GATE.z + 4); HP.sim(0.1); return { st: Q.stage('s4') }; })()""")
        await pg.wait_for_timeout(2200)
        r.update(await ev(pg, """(()=>{ const P = HP.Game.player; HP.sim(3); const alarm = HP.Missions.ctx.m.c.alarm; const hp0 = HP.NPC.all.filter(n => n.tags.includes('s4foe')).reduce((a, n) => a + Math.max(0, n.hp), 0); for (let i = 0; i < 40 && !(HP.Missions.ctx.m.c.tessHits > 0); i++) HP.sim(1);
          const tessHits = HP.Missions.ctx.m.c.tessHits || 0; const box = Carry.list.find(c => c.id === 'strongbox'); HP.tp(box.mesh.position.x + 0.7, box.mesh.position.z + 0.3); HP.sim(0.2); HP.press('Pick up strongbox'); HP.sim(1.2); const st = Q.stage('s4');
          for (const n of HP.NPC.all.slice()) if (n.tags.includes('s4foe') && n.alive) n.takeHit({ dmg: 999, from: P, gun: 'revolver' }); HP.sim(1); const st2 = Q.stage('s4'); Q.near('marlowe', 1.4); HP.sim(0.3); Q.talk('marlowe'); Q.pick('[Hand over the chest]'); Q.pick('Continue'); Q.close(); HP.sim(1.5);
          return { alarm, tessHits, st2: st, st3: st2, s4: Q.st('s4'), bounty: HP.S.bounty, knows: HP.S.flags.rail_knows, out: HP.Missions.st('s4').outcome }; })()"""))
        check('ch3: Cole\'s plan wakes the camp, Tess shoots from the ridge, and the railroad puts a price on Wren', r['st'] == 'camp' and r['alarm'] and r['tessHits'] > 0 and r['st2'] == 'escape' and r['st3'] == 'return' and r['s4'] == 'done' and r['bounty'] >= 25 and r['knows'] and 'never saw the telegram' in r['out'], r)
        check('no page errors (kit routes)', not [e for e in errs if 'favicon' not in e], errs[:3]); await b.close()

        # the classic story from its own button
        b, pg, errs = await new_game(p, '#bClassic')
        r = await ev(pg, "(()=>{ HP.sim(1); return { story: HP.S.story, active: HP.Missions.active, gang: !!HP.NPC.byKey('marlowe'), s1: Q.st('s1'), s2: Q.st('s2'), x: Math.round(HP.Game.player.pos.x) }; })()")
        check('classic: its button starts The Long Way Home with no outfit at the cabin and the saga locked', r == {'story': 'classic', 'active': 'intro', 'gang': False, 's1': 'locked', 's2': 'locked', 'x': 16}, r)
        check('no page errors (classic)', not [e for e in errs if 'favicon' not in e], errs[:3]); await b.close()
    n = sum(1 for r in RESULTS if r[1]); print(f'\n{n}/{len(RESULTS)} saga checks passed')
    if n != len(RESULTS): raise SystemExit(1)
if __name__ == '__main__': asyncio.run(main())
