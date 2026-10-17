"""Side content: the rotating bounty board (alive and dead turn-ins, runners), three stranger missions (Hank's
Strike, Doc's Medicine, Still Life), road encounters (hold-up, snakebite, ambush), travelers on the trails, and the
new landmarks (telegraph line, cemetery, wreck, dock, vultures)."""
import asyncio, json
from run import boot
from playwright.async_api import async_playwright
RESULTS = []
def check(name, ok, info=''):
    RESULTS.append((name, bool(ok), str(info)[:400])); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{str(info)[:400]}]' if info else ''))
async def ev(pg, js): return await pg.evaluate(js)

H = r"""window.Q = {
  fresh(hour = 12) { if (HP.Missions.failing) HP.Missions.acceptFail(); if (HP.Missions.active) HP.Missions.abandon(true); if (HP.Dialog.open) HP.Dialog.close();
    const S = HP.S; for (const id of ['intro', 'm1']) HP.Missions.st(id).status = 'done'; S.chapter = 2; S.locations.mill = 'abandoned'; for (const n of HP.NPC.all.slice()) if (n.group === 'crane') HP.NPC.despawn(n);
    S.bounty = 0; S.wanted = false; S.p.hp = S.p.maxHp; S.time.hour = hour; HP.Game.player.carry = null; HP.Game.player.inv = 1e9; HP.Missions._silent = true; HP.Missions.refresh(); HP.Missions._silent = false; World.apply(); HP.tp(-36, 10); HP.sim(0.5); },
  st(id) { return HP.Missions.st(id).status; },
  stage(id) { const m = HP.Missions.st(id); return HP.Missions.active === id ? HP.Missions.defs[id].stages[m.stage].id : m.status; },
  press(label) { for (let i = 0; i < 40; i++) { if (HP.press(label)) return true; HP.sim(0.05); } return false; }, // prompts hide while Wren is busy (landing, swapping weapons): step until it's there
  near(key, d = 1.4) { const n = HP.NPC.byKey(key); const P = HP.Game.player; HP.tp(n.pos.x + d, n.pos.z); P.yaw = Math.atan2(n.pos.x - P.pos.x, n.pos.z - P.pos.z); HP.sim(0.1); },
  talk(key) { if (HP.Dialog.open) HP.Dialog.close(); this.near(key); return Q.press('Talk to') ? HP.choices() : 'no talk: ' + JSON.stringify(HP.opts()); },
  board() { const P = HP.Game.player; HP.tp(-25.5, 9.8); P.yaw = Math.PI; HP.sim(0.2); return HP.opts(); },
  ko(n) { const P = HP.Game.player; P.setWeapon('fists'); n.hp = 1; n.takeHit({ dmg: 50, from: P, melee: true, dir: { x: 0, z: 0 } }); HP.sim(0.2); },
};"""

async def main():
    async with async_playwright() as p:
        b, pg, errs = await boot(p)
        await pg.click('#bNew'); await pg.wait_for_timeout(600); await ev(pg, H)
        await ev(pg, "Q.fresh()")

        # ---------- landmarks ----------
        r = await ev(pg, """(()=>{ const d = { x: riverX(28) - 9, z: 28 }; const v0 = SIDE.vultures[0].v.position.clone(); HP.sim(1); return { poles: HP.Game.scene.children.filter(o => o.type === 'LineSegments').length, grave: !!Clues.find(c => c.id === 'calloway_grave'), dock: +(Col.ground(d.x, d.z, 5) - WORLD.waterY).toFixed(2), vult: +SIDE.vultures[0].v.position.distanceTo(v0).toFixed(2), signs: !!POIS }; })()""")
        check('world: telegraph wire, Calloway grave, a walkable dock over the river, circling vultures', r['poles'] >= 1 and r['grave'] and r['dock'] > 0.3 and r['vult'] > 0.1, r)

        # ---------- bounty board: alive ----------
        o = await ev(pg, "Q.board()")
        posters = [x for x in o if x.startswith('Read poster') and 'Rook' not in x]
        check('bounty board: two rotating wanted posters are up after Chapter 1', len(posters) == 2, o)
        await ev(pg, "HP.S.bounties.posted = [{ o: 'ned', h: 'drycreek' }, { o: 'lottie', h: 'antelope' }]; Q.board(); Q.press('Read poster: \"Two-Bit\"')")
        ch = await ev(pg, "HP.choices()"); txt = await ev(pg, "document.getElementById('dlgText').textContent")
        check('bounty board: a poster names the crime, both rewards and where the outlaw was seen', '$35 ALIVE' in txt and 'Dry Creek' in txt and any('Take the bounty' in c for c in ch), txt)
        await ev(pg, "HP.choose('Take the bounty'); HP.sim(0.3); HP.tp(-185, 30); HP.sim(1)")
        r = await ev(pg, "({ stage: Q.stage('bounty_board'), target: !!HP.NPC.byKey('bgen_ned'), gang: HP.NPC.all.filter(n => n.tags.includes('bgen')).length, posted: HP.S.bounties.posted.length })")
        check('bounty: taking it starts the hunt; at Dry Creek Ned and his two men are camped', r['stage'] == 'take' and r['target'] and r['gang'] == 3 and r['posted'] == 1, r)
        await ev(pg, "for (const n of HP.NPC.all.slice()) if (n.key.startsWith('bgen_g')) n.takeHit({ dmg: 999, from: HP.Game.player, gun: 'revolver' }); Q.ko(HP.NPC.byKey('bgen_ned')); Q.near('bgen_ned', 1.0); Q.press('Hogtie')")
        await pg.wait_for_function("HP.NPC.byKey('bgen_ned').hogtied === true", polling=200, timeout=30000)
        po = await ev(pg, "(()=>{ HP.sim(0.5); Q.near('bgen_ned', 1.0); return HP.opts(); })()"); await ev(pg, "Q.press('Pick up'); HP.sim(1.5); HP.sim(0.5)")
        r = await ev(pg, "({ carry: !!(HP.Game.player.carry && HP.Game.player.carry.npc), stage: Q.stage('bounty_board') })")
        check('bounty: knocked out, hogtied and carried, the stage moves to delivery', r['carry'] and r['stage'] == 'deliver', f'{r} opts={po}')
        m0 = await ev(pg, "HP.S.money"); o = await ev(pg, "Q.board()")
        await ev(pg, "Q.press('Turn in'); HP.sim(1)")
        r = await ev(pg, "({ st: Q.st('bounty_board'), money: HP.S.money, done: HP.S.bounties.done, active: HP.S.bounties.active, carry: !!HP.Game.player.carry })")
        check('bounty: turning Ned in alive at the sheriff\'s board pays $35; the board is ready for the next poster', any(x.startswith('Turn in') for x in o) and r['money'] - m0 >= 34.9 and r['done'] == 1 and r['active'] is None and r['st'] == 'locked' and not r['carry'], f"{o} {r}")
        r = await ev(pg, "(()=>{ HP.Missions.st('bounty_board').status; HP.Sky.advance ? 0 : 0; Sky.advance(24); return Q.board().filter(x => x.startsWith('Read poster') && !x.includes('Rook')).length; })()")
        check('bounty board: a fresh poster goes up the next day', r == 2, r)

        # ---------- bounty: runner, dead with proof ----------
        await ev(pg, "HP.S.bounties.posted = [{ o: 'lottie', h: 'antelope' }]; Q.board(); Q.press('Read poster: Lottie'); HP.choose('Take the bounty'); HP.sim(0.3); HP.tp(170, 98); HP.sim(0.5)")
        r = await ev(pg, "(()=>{ const t = HP.NPC.byKey('bgen_lottie'), P = HP.Game.player; P.crouch = false; t.state = 'patrol'; t.route = [{ x: t.pos.x, z: t.pos.z, wait: 99 }]; t.face(P.pos); HP.tp(t.pos.x, t.pos.z + 12); HP.sim(1.5); const d0 = t.distP; HP.sim(2); return { ran: !!t._ran, d0: +d0.toFixed(1), d1: +t.distP.toFixed(1) }; })()")
        check('bounty: a runner bolts when she sees you', r['ran'] and r['d1'] > r['d0'], r)
        await ev(pg, "const t = HP.NPC.byKey('bgen_lottie'); t.takeHit({ dmg: 999, from: HP.Game.player, gun: 'revolver' }); HP.sim(0.3); Q.near('bgen_lottie', 1.0)")
        o = await ev(pg, "HP.opts()"); await ev(pg, "Q.press('Loot') || Q.press('Search')")
        await pg.wait_for_function("HP.S.bounties.active && HP.S.bounties.active.proof === true", polling=200, timeout=30000)
        m0 = await ev(pg, "HP.S.money"); await ev(pg, "HP.sim(0.5); Q.board(); Q.press('Turn in'); HP.sim(1)")
        r = await ev(pg, "({ st: Q.st('bounty_board'), money: HP.S.money })")
        check('bounty: shot dead, her gun belt is proof enough for the lower reward', r['money'] - m0 >= 11.9 and r['money'] - m0 < 13 and r['st'] == 'locked', f"{o} {r} m0={m0}")

        # ---------- Hank's Strike ----------
        await ev(pg, "Q.fresh(12); const h = HP.NPC.byKey('hank'); h.state = 'routine';")
        ch = await ev(pg, "Q.talk('hank')")
        check('stranger: Hank offers his strike', isinstance(ch, list) and any('gold' in c for c in ch), ch)
        await ev(pg, "HP.choose('Tell me about this gold'); HP.choose('Continue'); HP.sim(0.3)")
        r = await ev(pg, "({ stage: Q.stage('stranger_hank'), map: HP.Inv.count('hank_map') })"); check('stranger: Hank hands over his map and sends you for a shovel', r['stage'] == 'shovel' and r['map'] == 1, r)
        await ev(pg, "HP.Inv.add('shovel'); HP.sim(0.3); HP.tp(HANK_X.x + 1, HANK_X.z); HP.sim(0.3); Q.press('Dig here'); HP.sim(3)")
        r = await ev(pg, "({ gold: HP.Inv.count('gold'), stage: Q.stage('stranger_hank'), open: HP.Dialog.open, jumpers: HP.NPC.all.filter(n => n.tags.includes('jumper')).length, ch: HP.Dialog.open ? HP.choices() : null })")
        check('stranger: digging at the X turns up three nuggets, and claim jumpers step in', r['gold'] == 3 and r['stage'] == 'jumpers' and r['jumpers'] == 2 and r['open'], r)
        await ev(pg, "HP.choose('Give them one nugget'); HP.choose('Continue'); HP.sim(1)")
        r = await ev(pg, "({ stage: Q.stage('stranger_hank'), gold: HP.Inv.count('gold') })"); check('stranger: paying them a nugget sends them off', r['stage'] == 'return' and r['gold'] == 2, r)
        await ev(pg, "const h = HP.NPC.byKey('hank'); h.state = 'routine'; HP.sim(0.2)"); h0 = await ev(pg, "HP.S.honor")
        ch = await ev(pg, "Q.talk('hank')"); await ev(pg, "HP.choose('Here\\'s your share'); HP.choose('Continue'); HP.sim(1)")
        r = await ev(pg, "({ st: Q.st('stranger_hank'), gold: HP.Inv.count('gold'), honor: HP.S.honor, out: HP.Missions.st('stranger_hank').outcome })")
        check('stranger: sharing the gold with Hank completes it with honor', r['st'] == 'done' and r['gold'] == 0 and r['honor'] > h0 and 'Split' in (r['out'] or ''), f"{ch} {r}")

        # ---------- Doc's Medicine ----------
        await ev(pg, "Q.fresh(12); const d = HP.NPC.byKey('doc'); d.state = 'routine';")
        ch = await ev(pg, "Q.talk('doc')"); await ev(pg, "HP.choose('Need help'); HP.choose('Continue'); HP.sim(0.3)")
        check('stranger: Doc Pell asks for help with his robbed wagon', await ev(pg, "Q.stage('stranger_doc')") == 'wreck', ch)
        for cid in ('doc_wheel', 'doc_tracks'):
            await ev(pg, f"const c = Clues.find(k => k.id === '{cid}'); HP.tp(c.x + 1, c.z); HP.Game.player.yaw = -Math.PI / 2; HP.sim(0.2); Q.press('Examine')")
            await pg.wait_for_function(f"HP.S.evidence['{cid}'] === true", polling=200, timeout=30000); await ev(pg, "HP.sim(0.3)")
        r = await ev(pg, "({ stage: Q.stage('stranger_doc'), thieves: HP.NPC.all.filter(n => n.group === 'docband').length, crate: !!SIDE._medCrate })")
        check('stranger: the wreck\'s clues point to the quarry, where two thieves guard the crate', r['stage'] == 'quarry' and r['thieves'] == 2 and r['crate'], r)
        await ev(pg, "for (const n of HP.NPC.all) if (n.group === 'docband') n.sense = 0; const c = SIDE._medCrate.mesh.position; HP.Game.player.crouch = true; HP.tp(c.x + 1, c.z); HP.Game.player.yaw = -Math.PI / 2; HP.sim(0.2); Q.press('Pick up'); HP.sim(1.5)")
        r = await ev(pg, "({ stage: Q.stage('stranger_doc'), carry: HP.Game.player.carry && HP.Game.player.carry.id, quiet: HP.Missions.st('stranger_doc').opt.quiet === true })")
        check('stranger: the crate is lifted without a fight (optional objective)', r['stage'] == 'home' and r['carry'] == 'medcrate' and r['quiet'], r)
        await ev(pg, "const d = HP.NPC.byKey('doc'); d.state = 'routine'; HP.Game.player.crouch = false; HP.sim(0.2)")
        ch = await ev(pg, "Q.talk('doc')"); await ev(pg, "HP.choose('Here\\'s your medicine'); HP.choose('Continue'); HP.sim(1)")
        r = await ev(pg, "({ st: Q.st('stranger_doc'), free: !!HP.S.flags.doc_free, ch: (() => { const d = HP.NPC.byKey('doc'); return STORY.talkDoc(d).start.choices.map(c => typeof c.text === 'function' ? c.text() : c.text); })() })")
        check('stranger: bringing it home completes it; Doc treats you free from now on', r['st'] == 'done' and r['free'] and any('free' in c for c in r['ch']), f"{ch} {r}")

        # ---------- Still Life ----------
        await ev(pg, "Q.fresh(12)")
        ch = await ev(pg, "Q.talk('percival')"); await ev(pg, "HP.choose('I\\'ll keep watch'); HP.sim(0.3)")
        check('stranger: Percival the photographer waits at Pine Hollow with a job', await ev(pg, "Q.stage('stranger_photo')") == 'shoot', ch)
        r = await ev(pg, "(()=>{ const P = HP.Game.player; P.crouch = true; HP.tp(PINE_HOLLOW.x - 6, PINE_HOLLOW.z - 4); P.crouch = true; let t = 0; while (t < 40 && Q.stage('stranger_photo') === 'shoot') { P.crouch = true; HP.sim(0.5); t += 0.5; } return { t, stage: Q.stage('stranger_photo'), plates: HP.Missions.st('stranger_photo').c.plates, opt: HP.Missions.st('stranger_photo').opt.unspooked === true, wolves: Animal.all.filter(a => a.tagPhoto && a.alive).length }; })()")
        check('stranger: crouched and still, three plates are exposed and the deer never spook; then wolves come', r['stage'] == 'wolves' and r['plates'] == 3 and r['opt'] and r['wolves'] == 3, r)
        await ev(pg, "for (const a of Animal.all) if (a.tagPhoto) a.takeHit({ dmg: 999, from: HP.Game.player, gun: 'revolver' }); HP.sim(1)")
        r = await ev(pg, "({ st: Q.st('stranger_photo'), photo: HP.Inv.count('photo') })")
        check('stranger: seeing off the wolves completes it with a print of the deer', r['st'] == 'done' and r['photo'] == 1, r)

        # ---------- road encounters ----------
        r = await ev(pg, """(()=>{ Q.fresh(12); HP.tp(-100, -20); HP.Game.player.yaw = Math.atan2(-150 + 100, -85 + 20); HP.sim(0.3); SIDE.holdup(); HP.sim(0.3);
            const v = HP.NPC.byKey('enc_victim'), rs = [0, 1].map(i => HP.NPC.byKey('enc_bandit' + i)); return { v: v && v.state, rs: rs.filter(Boolean).length }; })()""")
        check('encounter: two road agents hold up a traveler on the trail ahead', r['v'] == 'handsup' and r['rs'] == 2, r)
        m0 = await ev(pg, "HP.S.money"); await ev(pg, "for (const i of [0, 1]) HP.NPC.byKey('enc_bandit' + i).takeHit({ dmg: 999, from: HP.Game.player, gun: 'revolver' }); HP.sim(0.5)")
        await pg.wait_for_function(f"HP.S.money > {m0}", polling=200, timeout=30000)
        check('encounter: shooting the robbers saves the traveler, who pays you something', await ev(pg, "HP.NPC.byKey('enc_victim').state") == 'scripted', await ev(pg, "HP.S.money"))
        await ev(pg, "HP.tp(-100, -20); HP.Game.player.yaw = Math.atan2(-50, -65); HP.sim(0.2); SIDE.snakebite(); HP.sim(0.3); Q.near('enc_snake', 1.2)")
        m0 = await ev(pg, "HP.S.money"); ok = await ev(pg, "Q.press('Suck out the venom')")
        await pg.wait_for_function(f"HP.S.money > {m0}", polling=200, timeout=30000)
        check('encounter: sucking the venom from a snakebit traveler saves him', ok, await ev(pg, "HP.S.money"))
        r = await ev(pg, """(()=>{ HP.tp(-100, -20); HP.Game.player.yaw = Math.atan2(-50, -65); HP.sim(0.2); SIDE.trap(); HP.sim(0.3); const b = HP.NPC.byKey('enc_bait'); HP.tp(b.pos.x + 4, b.pos.z); HP.sim(0.5);
            return { amb: HP.NPC.all.filter(n => n.group === 'enc_amb' && n.state === 'combat').length }; })()""")
        check('encounter: the cry for help on the trail is an ambush', r['amb'] == 2, r)

        # ---------- travelers ----------
        r = await ev(pg, "(()=>{ Q.fresh(12); for (const n of HP.NPC.all.slice()) if (n.tags.includes('encounter')) HP.NPC.despawn(n); HP.tp(70, -20); HP.sim(0.2); SIDE.travT = 0; SIDE.travelers(0.1); const t = HP.NPC.all.find(n => n.tags.includes('wayfarer')); if (!t) return { t: null }; const p0 = t.pos.clone(); HP.sim(3); return { t: t.name, moved: +t.pos.distanceTo(p0).toFixed(1), greet: t.greetLine() }; })()")
        check('world: travelers walk the trails out in the country (and greet you)', r.get('t') and r['moved'] > 2 and r['greet'], r)

        bad = [e for e in errs if 'favicon' not in e]
        check('no page errors', not bad, bad[:5])
        await b.close()
    n = sum(1 for _, ok, _ in RESULTS if ok); print(f"\n{n}/{len(RESULTS)} side-content checks passed")
    if n != len(RESULTS): raise SystemExit(1)

if __name__ == '__main__': asyncio.run(main())
