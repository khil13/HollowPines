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

        # --- Call of Duty Mobile style controls ---
        r = await ev(pg, """(()=>{ const P = HP.Game.player; if (HP.Missions.active) HP.Missions.abandon(true); HP.tp(-100, -20); HP.S.weapons.rifle = 1; HP.S.ammoClip.revolver = 6; HP.S.ammoClip.rifle = 5; P.inv = 1e9; HP.sim(0.3);
          const rc = id => { const e = typeof id === 'string' ? document.querySelector(id) : id, r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, hid: e.hidden || !e.offsetParent }; };
          const ev = (el, type, x, y, id = 7) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
          const tapB = sel => { const el = document.querySelector(sel), c = rc(el); ev(el, 'pointerdown', c.x, c.y); HP.sim(1 / 30, 1 / 30); ev(el, 'pointerup', c.x, c.y); HP.sim(0.2, 1 / 30); };
          const out = {}; tapB('#tweap [data-b="w2"]'); out.rev = P.weapon; tapB('#tweap [data-b="w3"]'); out.rifle = P.weapon; tapB('#tweap [data-b="w2"]'); HP.sim(0.2);
          const fire = rc('#tcluster [data-b="attack"]'), aim = rc('#tAim'), jump = rc('#tJump'), left = rc('#tFireL'), stick = rc('#stick'), rel = rc('#tReload');
          out.layout = { fireBig: fire.w >= 70, aimAboveRight: aim.y < fire.y && aim.x > fire.x, jumpRight: jump.x > fire.x, leftFire: !left.hid && left.x < 200 && left.y < stick.y, slotOn: document.querySelector('#tweap [data-b="w2"]').classList.contains('on') };
          /* hold the fire button: keeps shooting; drag it: the view turns */
          const fb = document.querySelector('#tcluster [data-b="attack"]'), yaw0 = HP.Game.cam.yaw, a0 = HP.S.ammoClip.revolver; ev(fb, 'pointerdown', fire.x, fire.y); HP.sim(0.1, 1 / 30); for (let i = 1; i <= 20; i++) { ev(fb, 'pointermove', fire.x - i * 3, fire.y); HP.sim(0.1, 1 / 30); } ev(fb, 'pointerup', fire.x - 60, fire.y); HP.sim(0.3, 1 / 30);
          out.held = { shots: a0 - HP.S.ammoClip.revolver, turned: +Math.abs(HP.Game.cam.yaw - yaw0).toFixed(2) }; out.reloadShown = !rc('#tReload').hid;
          /* auto-fire: sights on an attacker fires; sights on a bystander does not */
          HP.S.ammoClip.revolver = 6; const mk = (k, hostile) => { const n = HP.NPC.spawn({ key: k, name: 'T', x: P.pos.x, z: P.pos.z + 10, lawful: !hostile, wild: true, hp: 500, maxHp: 500, tags: ['generic'], look: {} }); n.update = () => {}; n.hostileToPlayer = hostile; return n; };
          const look = n => { const C = HP.Game.cam; for (let i = 0; i < 14; i++) { const d = C.dir(), ex = n.pos.x - C.pos.x, ey = n.pos.y + 1.0 - C.pos.y, ez = n.pos.z - C.pos.z; C.yaw += Math.atan2(ex, ez) - Math.atan2(d.x, d.z); C.pitch -= Math.atan2(ey, Math.hypot(ex, ez)) - Math.atan2(d.y, Math.hypot(d.x, d.z)); C.snapT = 0; C.snapTgt = null; HP.sim(1 / 60, 1 / 60); } };
          Input.aimToggle = true; const by = mk('afB', false); HP.sim(0.3); look(by); const b0 = HP.S.ammoClip.revolver; HP.sim(1, 1 / 60); look(by); HP.sim(0.5, 1 / 60); out.bystander = b0 - HP.S.ammoClip.revolver; HP.NPC.despawn(by);
          const foe = mk('afF', true); HP.sim(0.3); const f0 = HP.S.ammoClip.revolver; for (let i = 0; i < 5; i++) { look(foe); HP.sim(0.35, 1 / 60); } /* re-aim after each shot's kick */ out.attacker = f0 - HP.S.ammoClip.revolver; out.hurt = foe.hp < 500;
          Settings.v.autoFire = false; HP.S.ammoClip.revolver = 6; look(foe); HP.sim(1, 1 / 60); out.off = 6 - HP.S.ammoClip.revolver; delete Settings.v.autoFire; HP.NPC.despawn(foe); Input.aimToggle = false; tapB('#tweap [data-b="w1"]'); out.fists = P.weapon; HP.S.wanted = 0; HP.S.bounty = 0; return out; })()""")
        check('cod: weapon slots along the bottom switch between fists, revolver and rifle', r['rev'] == 'revolver' and r['rifle'] == 'rifle' and r['fists'] == 'fists' and r['layout']['slotOn'], r)
        check('cod: big fire button with aim above it, jump at the edge, a second fire button above the stick, reload beside fire', all(r['layout'].values()) and r['reloadShown'], r['layout'])
        check('cod: holding fire keeps shooting, and dragging the fire button turns the view', r['held']['shots'] >= 3 and r['held']['turned'] > 0.15, r['held'])
        check('cod: sights on an attacker fire by themselves, never at a bystander, and the setting turns it off', r['attacker'] >= 2 and r['hurt'] and r['bystander'] == 0 and r['off'] == 0, r)
        # --- aim assist on phones ---
        r = await ev(pg, """(()=>{ const P = HP.Game.player, C = HP.Game.cam; if (HP.Missions.active) HP.Missions.abandon(true); HP.tp(-100, -20); P.yaw = 0; C.yaw = 0; C.pitch = 0.1; P.inv = 1e9; P.setWeapon('revolver'); HP.S.ammoClip.revolver = 6; Settings.v.autoFire = false; HP.sim(0.4, 1 / 60);
          const mk = (k, dx, dz) => { const n = HP.NPC.spawn({ key: k, name: 'T', x: P.pos.x + dx, z: P.pos.z + dz, lawful: false, wild: true, hp: 60, maxHp: 60, tags: ['generic'], look: {} }); n.update = () => {}; n.hostileToPlayer = true; return n; };
          const off = n => { const d = C.dir(), ex = n.pos.x - C.pos.x, ey = n.pos.y + 1.15 - C.pos.y, ez = n.pos.z - C.pos.z, l = Math.hypot(ex, ey, ez); return +(Math.acos(Math.min(1, (d.x * ex + d.y * ey + d.z * ez) / l)) * 57.3).toFixed(1); };
          const a = mk('aaA', 0, 14); HP.sim(0.2, 1 / 60); C.yaw = Math.atan2(a.pos.x - C.pos.x, a.pos.z - C.pos.z) + 0.16; C.pitch = 0.02; Input.aimToggle = true; HP.sim(1 / 60, 1 / 60); C.snapT = 0; C.yaw += 0.16; const before = off(a); HP.sim(0.8, 1 / 60); const after = off(a), onA = !!(P.hover && P.hover.h === a);
          /* it follows a target that moves */ for (let i = 0; i < 60; i++) { a.pos.x += 0.05; HP.sim(1 / 60, 1 / 60); } const tracked = off(a), stillOn = !!(P.hover && P.hover.h === a);
          /* a near miss on the locked target still lands */ Settings.v.aimAssist = 0; HP.sim(0.1, 1 / 60); C.yaw += 0.065; HP.sim(0.4, 1 / 60); const missAim = !(P.hover && P.hover.h === a); const hp0 = a.hp; Input.mouse.lp = true; HP.sim(1 / 60, 1 / 60); Input.mouse.lp = false; HP.sim(0.3, 1 / 60); const nearHit = a.hp < hp0;
          /* when a target drops, the sights swing to the next attacker */ delete Settings.v.aimAssist; const b = mk('aaB', 4, 13); HP.sim(0.4, 1 / 60); a.takeHit({ dmg: 999, from: P, gun: 'revolver' }); HP.sim(0.9, 1 / 60); const next = off(b), onB = !!(P.hover && P.hover.h === b);
          Settings.v.aimAssist = 0; C.yaw += 0.2; HP.sim(0.6, 1 / 60); const offStays = off(b) > 6; delete Settings.v.aimAssist; delete Settings.v.autoFire; Input.aimToggle = false; for (const k of ['aaA', 'aaB']) { const n = HP.NPC.byKey(k); if (n) HP.NPC.despawn(n); } P.setWeapon('fists'); HP.sim(0.3);
          return { before, after, onA, tracked, stillOn, missAim, nearHit, next, onB, offStays, sel: (UI.open('system'), !!document.getElementById('setAA') && !!document.getElementById('setAsens')) }; })()""")
        await ev(pg, "UI.close()")
        check('aim assist: sights a few degrees off an attacker are pulled onto them, and follow as they move', r['after'] < 2.5 and r['onA'] and r['tracked'] < 3.5 and r['stillOn'], r)
        check('aim assist: a near miss on the locked target still lands; when one drops the sights swing to the next attacker', r['missAim'] and r['nearHit'] and r['onB'] and r['next'] < 3, r)
        check('aim assist: turning it off leaves the sights where you put them, and the settings offer strength and aim speed', r['offStays'] and r['sel'], r)
        # --- hip fire, Call of Duty Mobile style ---
        r = await ev(pg, """(()=>{ const P = HP.Game.player, C = HP.Game.cam; HP.tp(-100, -20); P.yaw = 0; C.yaw = 0; C.pitch = 0.1; P.inv = 1e9; Input.aimToggle = false; P.setWeapon('revolver'); HP.S.ammoClip.revolver = 6; Settings.v.autoFire = false; HP.sim(0.6, 1 / 60);
          const n = HP.NPC.spawn({ key: 'hipT', name: 'T', x: P.pos.x, z: P.pos.z + 12, lawful: false, wild: true, hp: 400, maxHp: 400, tags: ['generic'], look: {} }); n.update = () => {}; n.hostileToPlayer = true; HP.sim(1.2, 1 / 60);
          const out = { aiming: P.aiming, hip: P.hipOnly, cross: !document.getElementById('cross').hidden, on: !!(P.hover && P.hover.h === n), fov: Math.round(HP.Game.camera.fov) };
          const hp0 = n.hp; Input.btnP.add('attack'); HP.sim(1 / 60, 1 / 60); HP.sim(0.3, 1 / 60); out.hit = hp0 - n.hp > 0; const sHip = P.spread();
          Input.aimToggle = true; HP.sim(0.8, 1 / 60); out.ads = { hip: P.hipOnly, fov: Math.round(HP.Game.camera.fov), tighter: P.spread() < sHip }; Input.aimToggle = false;
          Settings.v.codAim = false; HP.sim(0.3, 1 / 60); out.offAiming = P.aiming; delete Settings.v.codAim; P.setWeapon('fists'); HP.sim(0.3, 1 / 60); out.fists = P.aiming; delete Settings.v.autoFire; HP.NPC.despawn(n); return out; })()""")
        check('hip fire: with a gun out the crosshair is up without pressing Aim, the sights find the attacker, and Fire hits where it points', r['aiming'] and r['hip'] and r['cross'] and r['on'] and r['hit'] and r['fov'] >= 58, r)
        check('hip fire: Aim zooms in and tightens the shot; the setting and putting the gun away turn the crosshair off', not r['ads']['hip'] and r['ads']['fov'] <= 50 and r['ads']['tighter'] and not r['offAiming'] and not r['fists'], r)
        bad = [e for e in errs if 'favicon' not in e]
        check('no page errors', not bad, bad[:5])
        await b.close()
    n = sum(1 for _, ok, _ in RESULTS if ok); print(f"\n{n}/{len(RESULTS)} mobile checks passed")
    if n != len(RESULTS): raise SystemExit(1)

if __name__ == '__main__': asyncio.run(main())
