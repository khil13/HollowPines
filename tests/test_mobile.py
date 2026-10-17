"""Phone controls: the touch HUD on a landscape phone, a floating stick wherever the thumb lands, push to the rim to
run, contextual Grab/Shove buttons and a counter cue, vibration, the left-handed layout and button sizes, the
rotate-your-phone screen, and duels drawn from the Attack button."""
import asyncio
from run import boot
from playwright.async_api import async_playwright
RESULTS = []
def check(name, ok, info=''):
    RESULTS.append((name, bool(ok), str(info)[:400])); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{str(info)[:400]}]' if info else ''))
async def ev(pg, js): return await pg.evaluate(js)

H = r"""window.X = {
  F: 1 / 30, vib: [],
  reset() { const P = HP.Game.player; if (HP.Missions.active) HP.Missions.abandon(true); Town.clear(); Brawl.clear(); for (const n of HP.NPC.all.slice()) if (n.key && n.key.startsWith('mb')) HP.NPC.despawn(n); Input.reset(); Input.autoSprint = false; Input.rimT = 0;
    HP.S.time.hour = 12; HP.tp(-100, -20); P.yaw = 0; HP.Game.cam.yaw = 0; P.inv = 1e9; HP.S.p.hp = HP.S.p.maxHp; HP.S.p.st = HP.S.p.maxSt; P.setWeapon('fists'); HP.sim(0.4, this.F); },
  pe(el, type, x, y, id = 7) { el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true })); },
  btn(name) { return document.querySelector(`#touch [data-b="${name}"]`); },
  press(name) { const b = this.btn(name), r = b.getBoundingClientRect(); this.pe(b, 'pointerdown', r.left + 5, r.top + 5, 30); HP.sim(this.F, this.F); this.pe(b, 'pointerup', r.left + 5, r.top + 5, 30); },
};
navigator.vibrate = p => { X.vib.push(p); return true; };"""

async def main():
    async with async_playwright() as p:
        b, pg, errs = await boot(p, w=844, h=390, mobile=True)
        await pg.click('#bNew'); await pg.wait_for_timeout(800); await ev(pg, H)

        r = await ev(pg, "({ touch: document.body.classList.contains('touch'), hud: !document.getElementById('touch').hidden, zone: document.getElementById('lzone').getBoundingClientRect().width > 200, playing: document.body.classList.contains('playing') })")
        check('phone: the touch HUD is up on a landscape phone, with a stick zone over the left of the screen', r['touch'] and r['hud'] and r['zone'] and r['playing'], r)

        # --- floating stick + run at the rim ---
        r = await ev(pg, """(()=>{ X.reset(); const z = document.getElementById('lzone'), st = document.getElementById('stick'); X.pe(z, 'pointerdown', 230, 250); const r0 = st.getBoundingClientRect(); X.pe(z, 'pointermove', 275, 250);
            const mv = { x: +Input.move.x.toFixed(2), mag: +Input.move.mag.toFixed(2) }; const P = HP.Game.player, x0 = P.pos.x; HP.sim(0.8, X.F); const moved = +(P.pos.x - x0).toFixed(2), sp0 = Math.hypot(P.vel.x, P.vel.z);
            X.pe(z, 'pointermove', 300, 250); HP.sim(0.8, X.F); const run = Input.autoSprint, sp1 = Math.hypot(P.vel.x, P.vel.z); X.pe(z, 'pointerup', 300, 250); HP.sim(0.1, X.F);
            return { centre: [Math.round(r0.left + r0.width / 2), Math.round(r0.top + r0.height / 2)], mv, moved: Math.abs(moved) > 0.5, run, faster: sp1 > sp0 + 1, released: Input.move.mag === 0 && !Input.autoSprint, idle: st.classList.contains('idle') }; })()""")
        check('stick: wherever the left thumb lands becomes the centre of the stick, and dragging moves Wren', abs(r['centre'][0] - 230) < 4 and abs(r['centre'][1] - 250) < 4 and r['mv']['mag'] > 0.75 and r['moved'], r)
        check('stick: push to the rim and hold to break into a run; let go and it settles back', r['run'] and r['faster'] and r['released'] and r['idle'], r)

        # --- contextual combat buttons ---
        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; const n = HP.NPC.spawn({ key: 'mbA', name: 'Outlaw', x: P.pos.x, z: P.pos.z + 1.2, lawful: false, wild: true, hp: 300, maxHp: 300, tags: ['generic'] }); n.fightPlayer(true); n.shootT = 99; HP.sim(0.3, X.F);
            const grabShown = !X.btn('grab').hidden; X.press('grab'); HP.sim(0.1, X.F); const grabbed = P.grab === n; const shoveShown = !X.btn('shove').hidden, punch = document.querySelector('#tcluster [data-b="attack"]').textContent;
            X.press('shove'); HP.sim(0.3, X.F); return { grabShown, grabbed, shoveShown, punch, shoved: !P.grab && n.floorT > 0, shoveHidden: (HP.sim(0.1, X.F), X.btn('shove').hidden) }; })()""")
        check('buttons: a Grab button appears beside a brawler; while holding, Attack reads Punch and Shove throws them down', r['grabShown'] and r['grabbed'] and r['shoveShown'] and r['punch'] == 'Punch' and r['shoved'] and r['shoveHidden'], r)
        r = await ev(pg, """(()=>{ X.reset(); const P = HP.Game.player; const n = HP.NPC.spawn({ key: 'mbB', name: 'Outlaw', x: P.pos.x, z: P.pos.z + 1.3, lawful: false, wild: true, hp: 300, maxHp: 300, tags: ['generic'] }); n.fightPlayer(true); n.shootT = 99; HP.sim(0.3, X.F);
            n.windT = 0.3; HP.sim(X.F, X.F); const cue = !document.getElementById('cue').hidden, pulse = X.btn('block').classList.contains('cue'); n.windT = 0; HP.sim(X.F, X.F); return { cue, pulse, gone: document.getElementById('cue').hidden }; })()""")
        check('buttons: when an enemy winds up a punch the Block button pulses and "Block!" flashes (the moment to counter)', r['cue'] and r['pulse'] and r['gone'], r)

        # --- haptics ---
        r = await ev(pg, """(()=>{ X.reset(); X.vib = []; const P = HP.Game.player; P.inv = 0; P.hurt(5, null, 'gun'); const hurt = X.vib.slice(); Settings.set('haptics', false); P.hurt(5, null, 'melee'); const off = X.vib.length; Settings.set('haptics', true); return { hurt, off }; })()""")
        check('haptics: the phone buzzes when Wren is shot, and the setting turns it off', r['hurt'] == [70] and r['off'] == 1, r)

        # --- layout settings ---
        r = await ev(pg, """(()=>{ Settings.set('lefty', true); Input.applyLayout(); const c = document.getElementById('tcluster').getBoundingClientRect(), z = document.getElementById('lzone').getBoundingClientRect(); const lefty = { cluster: Math.round(c.left), zone: Math.round(z.left) };
            Settings.set('lefty', false); Settings.set('btnScale', 1.2); Input.applyLayout(); const big = document.getElementById('tcluster').getBoundingClientRect().width; Settings.set('btnScale', 1); Input.applyLayout(); const med = document.getElementById('tcluster').getBoundingClientRect().width;
            return { lefty, back: document.getElementById('tcluster').getBoundingClientRect().left > 400, big: Math.round(big), med: Math.round(med) }; })()""")
        check('layout: the left-handed option swaps the stick and buttons; button size scales the cluster', r['lefty']['cluster'] < 100 and r['lefty']['zone'] > 400 and r['back'] and r['big'] > r['med'] * 1.15, r)
        await ev(pg, "UI.open('system')")
        r = await ev(pg, "({ ts: !!document.getElementById('setTsens'), btn: !!document.getElementById('setBtn'), lefty: !!document.getElementById('setLefty'), run: !!document.getElementById('setRun'), hap: !!document.getElementById('setHap') })")
        await ev(pg, "UI.close()")
        check('settings: touch look speed, button size, left-handed, push-to-run and vibration are all in the Game menu', all(r.values()), r)

        # --- duel from the Attack button ---
        r = await ev(pg, """(()=>{ X.reset(); HP.S.flags.duelDay = 0; HP.Missions.st('intro').status = 'done'; HP.S.chapter = 2; Town.duelist(); const n = HP.NPC.byKey('duelist'); n.talk().start.choices[0].do(); for (let i = 0; i < 200 && Duel.phase === 'walk'; i++) HP.sim(X.F, X.F);
            const draw = document.getElementById('duel').textContent; X.press('attack'); HP.sim(0.1, X.F); return { draw, last: Duel.last, dead: !n.alive }; })()""")
        check('duel: on a phone, DRAW! shows big on screen and tapping Attack fires', r['draw'] == 'DRAW!' and r['last'] == 'win' and r['dead'], r)

        # --- portrait ---
        await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.wait_for_timeout(300)
        rot = await ev(pg, "getComputedStyle(document.getElementById('rotate')).display")
        await pg.set_viewport_size({'width': 844, 'height': 390}); await pg.wait_for_timeout(300)
        rot2 = await ev(pg, "getComputedStyle(document.getElementById('rotate')).display")
        check('portrait: held upright, the phone asks to be turned sideways (and the notice clears in landscape)', rot == 'grid' and rot2 == 'none', [rot, rot2])
        await ev(pg, "X.reset()")

        bad = [e for e in errs if 'favicon' not in e]
        check('no page errors', not bad, bad[:5])
        await b.close()
    n = sum(1 for _, ok, _ in RESULTS if ok); print(f"\n{n}/{len(RESULTS)} mobile checks passed")
    if n != len(RESULTS): raise SystemExit(1)

if __name__ == '__main__': asyncio.run(main())
