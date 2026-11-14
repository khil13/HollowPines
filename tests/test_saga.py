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
  talk(key) { if (HP.Dialog.open) HP.Dialog.close(); if (!this.near(key)) return 'no npc ' + key; const ok = HP.press('Talk to'); return ok ? HP.choices() : 'no talk opt: ' + JSON.stringify(HP.opts()); },
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
        check('camp: feeding the outfit ends Chapter 1 (Chapter 2 unlocked in the journal, a share from the camp tin, Marlowe talks about the Cranes)', r['ok'] and r['s2'] == 'done' and r['chapter'] == 2 and r['paid'] == 3 and any('What happens now' in c for c in r['jos']), r)
        r = await ev(pg, """(()=>{ UI.open('story'); const t = document.getElementById('pBody').textContent; UI.close(); return { ashes: t.includes('Ashes'), marlowe: t.includes('Josiah Marlowe'), noOld: !t.includes('Cold Trail') }; })()""")
        check('journal: the Story tab shows the saga\'s chapters and people', r['ashes'] and r['marlowe'] and r['noOld'], r)
        # save, reload, continue
        await ev(pg, "HP.Save.save(true)"); await pg.wait_for_timeout(500); await pg.reload(); await pg.wait_for_function('document.getElementById("loading").textContent===""', timeout=180000); await pg.click('#bCont'); await pg.wait_for_timeout(500); await ev(pg, H)
        r = await ev(pg, "(()=>{ HP.sim(1); return { story: HP.S.story, s1: Q.st('s1'), s2: Q.st('s2'), how: HP.S.decisions.s1_med, gang: !!HP.NPC.byKey('marlowe'), m1: Q.st('m1') }; })()")
        check('save: continuing keeps the saga, its decisions and the camp', r == {'story': 'saga', 's1': 'done', 's2': 'done', 'how': 'favor', 'gang': True, 'm1': 'locked'}, r)
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
        check('no page errors (kit routes)', not [e for e in errs if 'favicon' not in e], errs[:3]); await b.close()

        # the classic story from its own button
        b, pg, errs = await new_game(p, '#bClassic')
        r = await ev(pg, "(()=>{ HP.sim(1); return { story: HP.S.story, active: HP.Missions.active, gang: !!HP.NPC.byKey('marlowe'), s1: Q.st('s1'), s2: Q.st('s2'), x: Math.round(HP.Game.player.pos.x) }; })()")
        check('classic: its button starts The Long Way Home with no outfit at the cabin and the saga locked', r == {'story': 'classic', 'active': 'intro', 'gang': False, 's1': 'locked', 's2': 'locked', 'x': 16}, r)
        check('no page errors (classic)', not [e for e in errs if 'favicon' not in e], errs[:3]); await b.close()
    n = sum(1 for r in RESULTS if r[1]); print(f'\n{n}/{len(RESULTS)} saga checks passed')
    if n != len(RESULTS): raise SystemExit(1)
if __name__ == '__main__': asyncio.run(main())
