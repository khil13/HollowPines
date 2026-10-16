"""Controller, animation state machine, camera and touch tests (Milestone 1.0), run against the real game build."""
import asyncio, math
from run import boot, OUT
from playwright.async_api import async_playwright
RESULTS = []
def check(name, ok, info=''):
    RESULTS.append((name, bool(ok), info)); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{info}]' if info else ''))
async def ev(pg, js): return await pg.evaluate(js)

# page-side helpers: put the player on open flat ground away from NPCs, read the animation state
SETUP = """
window.T = {
  reset(x=-8, z=-18, yaw=0) { HP.Game.restoreFromState(); for (const n of HP.NPC.all) n.pos.set(-200,0,-200); for (const a of HP.Animal.all) a.pos.set(200,0,200);
    const P=HP.Game.player; Input.keys.clear(); P.crouch=false; P.vel.set(0,0,0); HP.tp(x,z); P.yaw=yaw; HP.Game.cam.yaw=yaw; HP.Game.cam.idleT=-999; S.p.st=S.p.maxSt; HP.sim(0.6); P.loco.log=[]; },
  loco() { const P=HP.Game.player; return { s:P.loco.state, log:P.loco.log.slice(), W:Object.assign({}, P.anim.W), sp:Math.hypot(P.vel.x,P.vel.z), y:P.pos.y, st:P.state }; },
  baseSum() { const W=HP.Game.player.anim.W; return ['Idle','Walk','Run','Walk_Carry','Run_Carry','Jump','SitDown','Death','PickUp'].reduce((a,n)=>a+(W[n]||0),0); },
  // run `sec` seconds of game time at a fixed frame step, holding keys; returns distance, max height above start, max per-frame yaw change
  run(keys, sec, dt) { const P=HP.Game.player; keys.forEach(k=>Input.keys.add(k)); const x0=P.pos.x, z0=P.pos.z, y0=P.pos.y; let maxY=0, maxTurn=0, prevYaw=P.yaw; const n=Math.round(sec/dt);
    for (let i=0;i<n;i++) { HP.Game.time+=dt; HP.Game.update(dt); Input.endFrame(); maxY=Math.max(maxY,P.pos.y-y0); maxTurn=Math.max(maxTurn, Math.abs(angDiff(prevYaw,P.yaw))); prevYaw=P.yaw; }
    keys.forEach(k=>Input.keys.delete(k)); return { d:Math.hypot(P.pos.x-x0,P.pos.z-z0), maxY, maxTurn, x:P.pos.x, z:P.pos.z }; },
  jump(dt) { const P=HP.Game.player; const y0=P.pos.y; Input.pressed.add(' '); let maxY=0, t=0; HP.Game.update(dt); Input.endFrame(); t+=dt;
    while (t<3) { HP.Game.time+=dt; HP.Game.update(dt); Input.endFrame(); t+=dt; maxY=Math.max(maxY,P.pos.y-y0); if (P.state==='ground' && t>0.3) break; } return { maxY, air:t }; },
};
"""

async def main():
    async with async_playwright() as p:
        # ================= desktop =================
        b, pg, errs = await boot(p)
        await pg.click('#bNew'); await pg.wait_for_timeout(600); await ev(pg, SETUP); await ev(pg, "T.reset()")
        r = await ev(pg, "T.loco()")
        check('load: game starts, player idles on the ground with no errors', r['s'] == 'idle' and r['st'] == 'ground' and not errs, f"{r['s']} errs={errs[:2]}")
        check('anim: imported model with an AnimationMixer drives the player', await ev(pg, "HP.Game.player.rig.isModel && !!HP.Game.player.anim.mixer"))
        # --- walk / jog / sprint states from real speed ---
        await ev(pg, "T.reset()"); r = await ev(pg, "(()=>{ T.run(['w','control'], 1.5, 1/60); return T.loco(); })()")
        check('fsm: walking starts with startWalk, then settles into walk', r['log'][:2] == ['startWalk', 'walk'] and r['s'] == 'walk' and 1.4 < r['sp'] < 2.0, f"log={r['log'][:4]} sp={r['sp']:.2f}")
        check('anim: walk uses the Walk clip only', r['W'].get('Walk', 0) > 0.95 and r['W'].get('Run', 0) < 0.05, f"W.Walk={r['W'].get('Walk',0):.2f}")
        await ev(pg, "T.reset()"); r = await ev(pg, "(()=>{ T.run(['w'], 2, 1/60); return T.loco(); })()")
        check('fsm: default movement is a jog (Walk+Run blend)', r['s'] == 'jog' and 3.5 < r['sp'] < 4.2 and 0.2 < r['W'].get('Run', 0) < 0.9, f"{r['s']} sp={r['sp']:.2f} run={r['W'].get('Run',0):.2f}")
        await ev(pg, "T.reset()"); r = await ev(pg, "(()=>{ T.run(['w','shift'], 2, 1/60); return T.loco(); })()")
        check('fsm: shift sprints with the Run clip', r['s'] == 'sprint' and r['sp'] > 6 and r['W'].get('Run', 0) > 0.95, f"{r['s']} sp={r['sp']:.2f}")
        r = await ev(pg, "(()=>{ T.run([], 1.0, 1/60); return T.loco(); })()")
        check('anim: no walk or run cycle once the player stops', r['s'] == 'idle' and r['sp'] < 0.05 and r['W'].get('Walk', 0) + r['W'].get('Run', 0) < 0.03, f"{r['s']} sp={r['sp']:.3f} walk+run={r['W'].get('Walk',0)+r['W'].get('Run',0):.3f}")
        # --- blending: weights always sum to one (no drift toward the bind pose) ---
        sums = await ev(pg, "(()=>{ T.reset(); const out=[]; Input.keys.add('w'); for(let i=0;i<40;i++){ T.run([],0.05,1/60); out.push(T.baseSum()); } Input.keys.add('shift'); for(let i=0;i<40;i++){ T.run([],0.05,1/60); out.push(T.baseSum()); } Input.keys.clear(); for(let i=0;i<40;i++){ T.run([],0.05,1/60); out.push(T.baseSum()); } return [Math.min(...out), Math.max(...out)]; })()")
        check('anim: crossfade weights stay normalized through idle/jog/sprint/stop', abs(sums[0] - 1) < 1e-3 and abs(sums[1] - 1) < 1e-3, f"sum in [{sums[0]:.4f},{sums[1]:.4f}]")
        smooth = await ev(pg, "(()=>{ T.reset(); let mx=0, prev=HP.Game.player.anim.W.Run||0; Input.keys.add('w'); Input.keys.add('shift'); for(let i=0;i<90;i++){ T.run([],1/60,1/60); const w=HP.Game.player.anim.W.Run||0; mx=Math.max(mx,Math.abs(w-prev)); prev=w; } Input.keys.clear(); return mx; })()")
        check('anim: idle-to-sprint crossfade has no snap (max weight change per 60fps frame)', smooth < 0.25, f"max dW={smooth:.3f}")
        # --- jump phases ---
        await ev(pg, "T.reset()"); r = await ev(pg, "(()=>{ const P=HP.Game.player; Input.pressed.add(' '); const seen=[]; let jumpW=0, runAir=0; for(let i=0;i<150;i++){ HP.Game.time+=1/60; HP.Game.update(1/60); Input.endFrame(); if(P.state==='air'){ jumpW=Math.max(jumpW,P.anim.W.Jump||0); runAir=Math.max(runAir,(P.anim.W.Run||0)+(P.anim.W.Walk||0)); } } return { log:P.loco.log, jumpW, runAir, st:P.state }; })()")
        want = ['jumpStart', 'rising', 'falling', 'landing', 'idle']
        check('fsm: jump goes jumpStart -> rising -> falling -> landing -> idle', r['log'] == want and r['st'] == 'ground', str(r['log']))
        check('anim: airborne pose is the Jump clip, no run cycle in the air', r['jumpW'] > 0.9 and r['runAir'] < 0.1, f"jump={r['jumpW']:.2f} walk+run in air={r['runAir']:.2f}")
        r = await ev(pg, "(()=>{ T.reset(); const P=HP.Game.player; Input.keys.add('w'); Input.keys.add('shift'); T.run([],1.0,1/60); Input.pressed.add(' '); T.run([],1.6,1/60); Input.keys.clear(); return T.loco(); })()")
        check('fsm: a running jump lands back into movement', 'landing' in r['log'] and r['log'][-1] in ('sprint', 'jog', 'idle'), str(r['log'][-4:]))
        r = await ev(pg, "(()=>{ T.reset(); const P=HP.Game.player; P.pos.y+=6; P.state='air'; P.vel.y=0; T.run([],2,1/60); return {log:P.loco.log, slow:P.landSlow||0, st:P.state}; })()")
        check('jump: falling off a height uses the falling state, then lands', r['log'][:2] == ['falling', 'landing'] and r['st'] == 'ground', str(r['log'][:3]))
        r = await ev(pg, "(()=>{ T.reset(); const P=HP.Game.player; P.state='air'; P.pos.y+=0.05; P.vel.y=-1; Input.pressed.add(' '); HP.Game.update(1/60); Input.endFrame(); for(let i=0;i<8;i++){ HP.Game.update(1/60); Input.endFrame(); } return {jt:P.jumpT>0||P.state==='air', vy:P.vel.y, log:P.loco.log}; })()")
        check('jump: a press just before landing is buffered and still jumps', r['jt'] and 'jumpStart' in r['log'], str(r['log']))
        # --- crouch ---
        r = await ev(pg, "(()=>{ T.reset(); Input.pressed.add('c'); T.run([],0.5,1/60); const a=T.loco().s; T.run(['w'],1,1/60); const b=T.loco(); Input.pressed.add('c'); T.run([],0.6,1/60); return [a,b.s,b.sp,T.loco().s]; })()")
        check('fsm: crouch idle, crouch walk, and standing back up', r[0] == 'crouchIdle' and r[1] == 'crouchWalk' and r[2] < 1.6 and r[3] == 'idle', str(r))
        # --- dodge roll ---
        r = await ev(pg, "(()=>{ T.reset(); T.run(['w'],0.6,1/60); Input.keys.add('w'); Input.pressed.add('x'); HP.Game.update(1/60); Input.endFrame(); let roll=0; for(let i=0;i<20;i++){ HP.Game.update(1/60); Input.endFrame(); roll=Math.max(roll,HP.Game.player.anim.acts.Roll ? HP.Game.player.anim.acts.Roll.getEffectiveWeight() : 0); } Input.keys.clear(); return {log:HP.Game.player.loco.log, roll}; })()")
        check('fsm: dodge state plays the Roll clip', 'dodge' in r['log'] and r['roll'] > 0.8, f"roll={r['roll']:.2f}")
        # --- frame-rate independence ---
        fr = {}
        for fps in (30, 60, 144):
            fr[fps] = await ev(pg, f"(()=>{{ T.reset(); const m=T.run(['w'],2,1/{fps}); T.run([],1.5,1/{fps}); const P=HP.Game.player; const j=T.jump(1/{fps}); return {{d:m.d, stop:Math.hypot(P.pos.x-m.x,P.pos.z-m.z), jump:j.maxY, air:j.air}}; }})()")
        ds = [fr[f]['d'] for f in fr]; js = [fr[f]['jump'] for f in fr]; st = [fr[f]['stop'] for f in fr]
        check('framerate: distance moved in 2s is the same at 30/60/144 fps (within 2%)', (max(ds) - min(ds)) / max(ds) < 0.02, ' '.join(f"{f}:{fr[f]['d']:.2f}m" for f in fr))
        check('framerate: stopping distance matches across frame rates (within 5cm)', max(st) - min(st) < 0.05, ' '.join(f"{f}:{fr[f]['stop']:.2f}" for f in fr))
        check('framerate: jump height matches across frame rates (within 3%)', (max(js) - min(js)) / max(js) < 0.03, ' '.join(f"{f}:{fr[f]['jump']:.3f}m" for f in fr))
        # --- acceleration and turning ---
        r = await ev(pg, "(()=>{ T.reset(); const P=HP.Game.player; T.run(['w'],0.1,1/60); const a=Math.hypot(P.vel.x,P.vel.z); T.run(['w'],0.6,1/60); const b=Math.hypot(P.vel.x,P.vel.z); return [a,b]; })()")
        check('move: speed ramps up smoothly instead of jumping to full', 0.5 < r[0] < r[1] * 0.7, f"0.1s:{r[0]:.2f} 0.7s:{r[1]:.2f}")
        r = await ev(pg, "(()=>{ T.reset(); T.run(['w'],1,1/60); return T.run(['s'],1,1/60); })()")
        check('move: reversing turns the character smoothly (no instant flip)', 0.05 < r['maxTurn'] < 0.35, f"max yaw change/frame={r['maxTurn']:.3f} rad")
        r = await ev(pg, "(()=>{ T.reset(); return [T.run(['w','d'],1.5,1/60).d, (T.reset(), T.run(['w'],1.5,1/60).d)]; })()")
        check('move: diagonal input is normalized (not faster than straight)', abs(r[0] - r[1]) / r[1] < 0.03, f"diag={r[0]:.2f} straight={r[1]:.2f}")
        r = await ev(pg, "(()=>{ T.reset(); return T.run(['w','s'],1,1/60).d; })()")
        check('move: opposite keys cancel instead of jittering', r < 0.05, f"d={r:.3f}")
        dirs = await ev(pg, "(()=>{ const out={}; for (const [k,a] of [['w',0],['s',Math.PI],['a',Math.PI/2],['d',-Math.PI/2]]) { T.reset(-8,-18,0.7); const P=HP.Game.player, x0=P.pos.x, z0=P.pos.z; T.run([k],1,1/60); const f=fwd(0.7+a); out[k]=((P.pos.x-x0)*f.x+(P.pos.z-z0)*f.z)/Math.hypot(P.pos.x-x0,P.pos.z-z0); } return out; })()")
        check('move: W/A/S/D move forward/left/back/right relative to the camera', all(v > 0.97 for v in dirs.values()), ' '.join(f"{k}:{v:.2f}" for k, v in dirs.items()))
        r = await ev(pg, "(()=>{ T.reset(); const P=HP.Game.player; let below=0; Input.keys.add('w'); Input.keys.add('shift'); for(let i=0;i<600;i++){ HP.Game.cam.yaw+=0.004; T.run([],1/60,1/60); below=Math.min(below, P.pos.y-Terrain.height(P.pos.x,P.pos.z)); } Input.keys.clear(); return below; })()")
        check('physics: 10s of running over hills never sinks into the terrain', r > -0.05, f"min clearance={r:.3f}")
        # --- collision with solid geometry ---
        r = await ev(pg, "(()=>{ T.reset(-66,8,Math.PI/2); const P=HP.Game.player; let maxX=-99; Input.keys.add('w'); for(let i=0;i<240;i++){ T.run([],1/60,1/60); maxX=Math.max(maxX,P.pos.x); } Input.keys.clear(); return {maxX, s:P.loco.state}; })()")
        check('collision: walking into the store wall stops at the wall', r['maxX'] < -63.2, f"max x={r['maxX']:.2f} (wall at -63)")
        check('anim: pushing against a wall does not keep playing the run cycle', r['s'] in ('idle', 'startWalk', 'walk'), r['s'])
        # --- camera ---
        r = await ev(pg, "(()=>{ T.reset(); const C=HP.Game.cam; let minClear=99; Input.keys.add('w'); Input.keys.add('shift'); for(let i=0;i<480;i++){ C.yaw+=0.006; T.run([],1/60,1/60); minClear=Math.min(minClear, C.pos.y-Terrain.height(C.pos.x,C.pos.z)); } Input.keys.clear(); return minClear; })()")
        check('camera: never goes below the terrain while orbiting a running player', r > 0.3, f"min clearance={r:.2f}")
        r = await ev(pg, "(()=>{ T.reset(); const C=HP.Game.cam, P=HP.Game.player; HP.sim(0.5); const cy=[], py=[]; Input.pressed.add(' '); for(let i=0;i<70;i++){ T.run([],1/60,1/60); cy.push(C.pos.y); py.push(P.pos.y); } return [Math.max(...cy)-Math.min(...cy), Math.max(...py)-Math.min(...py)]; })()")
        check('camera: a jump barely moves the camera height (no bobbing)', r[0] < 0.4 * r[1], f"camera dy={r[0]:.2f}m vs player dy={r[1]:.2f}m")
        r = await ev(pg, "(()=>{ T.reset(-50,-40,0); const C=HP.Game.cam; const R=Col.all.find(c=>c.type==='box'&&c.block&&c.walk&&(c.maxX-c.minX)>2&&Math.hypot((c.minX+c.maxX)/2-HP.Game.player.pos.x,(c.minZ+c.maxZ)/2-HP.Game.player.pos.z)<400&&Math.abs(Terrain.height((c.minX+c.maxX)/2,(c.minZ+c.maxZ)/2)-c.y1)<3); if(!R) return null; const cx=(R.minX+R.maxX)/2, cz=(R.minZ+R.maxZ)/2; HP.tp(cx, R.maxZ+1.2); C.yaw=Math.PI; C.pitch=0.1; C.zoom=6; HP.sim(1.0); return {inside: C.solidAt(C.pos.x,C.pos.y,C.pos.z), d:C.collD}; })()")
        check('camera: a large rock or crate behind the player pulls the camera in front of it', r is not None and not r['inside'], str(r))
        r = await ev(pg, "(()=>{ T.reset(); const C=HP.Game.cam, P=HP.Game.player; const y0=C.yaw, x0=P.pos.x; return [y0,x0]; })()")
        await pg.mouse.move(640, 380); await pg.mouse.down(button='right'); await pg.mouse.move(760, 380, steps=6); await pg.mouse.up(button='right')
        r2 = await ev(pg, "(()=>{ HP.sim(0.1); return [HP.Game.cam.yaw, HP.Game.player.pos.x, Math.hypot(HP.Game.player.vel.x,HP.Game.player.vel.z)]; })()")
        check('camera: right-drag rotates the camera without moving the player', abs(r2[0] - r[0]) > 0.1 and r2[2] < 0.05, f"yaw {r[0]:.2f}->{r2[0]:.2f}")
        z0 = await ev(pg, "HP.Game.cam.zoom=4.6"); await pg.mouse.wheel(0, 300); await pg.wait_for_timeout(200); z1 = await ev(pg, "(()=>{ HP.sim(0.05); return HP.Game.cam.zoom; })()")
        check('camera: mouse wheel zooms', z1 > z0 + 0.3, f"{z0}->{z1:.2f}")
        # --- focus loss releases held input ---
        await ev(pg, "T.reset()"); await pg.keyboard.down('w'); held = await ev(pg, "Input.keys.has('w')")
        await ev(pg, "window.dispatchEvent(new Event('blur'))"); r = await ev(pg, "(()=>{ HP.sim(0.5); return [Input.keys.size, Math.hypot(HP.Game.player.vel.x,HP.Game.player.vel.z)]; })()"); await pg.keyboard.up('w')
        check('input: losing window focus releases held keys (no runaway movement)', held and r[0] == 0 and r[1] < 0.2, f"keys={r[0]} speed={r[1]:.2f}")
        # --- UI still works ---
        r = await ev(pg, "(()=>{ HP.sim(0.3); const c=document.getElementById('mini'), g=c.getContext('2d'), d=g.getImageData(c.width/2-20,c.height/2-20,40,40).data; let lit=0; for(let i=3;i<d.length;i+=4) if(d[i]>0) lit++; return {lit, hud:!document.getElementById('tl').hidden, cash:document.getElementById('cash').textContent, clock:document.getElementById('clock').textContent}; })()")
        check('ui: minimap draws and the HUD (rings, cash, clock) is shown', r['lit'] > 1000 and r['hud'] and r['cash'].startswith('$') and 'Day' in r['clock'], str(r))
        await ev(pg, "HP.UI.open('system')"); has = await ev(pg, "!!document.getElementById('setLock') && !!document.getElementById('setSens')"); await ev(pg, "HP.UI.close()")
        check('ui: settings expose sensitivity and an optional mouse lock', has)
        # --- resource cleanup ---
        r = await ev(pg, "(()=>{ const n=HP.NPC.byKey('abe')||HP.NPC.all[0]; const a=n.anim; HP.NPC.despawn(n); return {disposed:!!a.disposed, actions:a.mixer._actions.length}; })()")
        check('cleanup: despawning a character stops and uncaches its animation mixer', r['disposed'] and r['actions'] == 0, str(r))
        ms = await ev(pg, "(()=>{ HP.Game.restoreFromState(); HP.tp(-40,20); HP.sim(0.5); const t0=performance.now(); HP.sim(5,1/60); return (performance.now()-t0)/300; })()")
        print(f"INFO  simulation cost in town (all NPCs, no rendering): {ms:.2f} ms per 60fps frame")
        for nm, js in [('c_idle', "T.reset(); HP.sim(0.6)"), ('c_jog', "T.reset(); T.run(['w'],1.2,1/60)"), ('c_sprint', "T.reset(); T.run(['w','shift'],1.5,1/60)"), ('c_jump', "T.reset(); Input.pressed.add(' '); T.run([],0.32,1/60)"), ('c_crouch', "T.reset(); Input.pressed.add('c'); T.run(['w'],1.2,1/60)")]:
            await ev(pg, js + "; HP.Game.cam.yaw=HP.Game.player.yaw+2.1; HP.Game.cam.idleT=-999; HP.Game.cam.snap=true; HP.Game.cam.update(0)"); await pg.wait_for_timeout(1500); await pg.screenshot(path=OUT + nm + '.png')
        # --- retargeted Universal Animation Library clips ---
        r = await ev(pg, "(()=>{ const n=['NinjaJump_Start','NinjaJump_Land','ClimbUp_1m_RM','LayToIdle','Consume','Chest_Open','Farm_Harvest']; return {missing:n.filter(c=>!Assets.clips[c]), tracks:Assets.clips.Consume ? Assets.clips.Consume.tracks.length : 0, map:[CLIPMAP.eat[0], CLIPMAP.search[0], CLIPMAP.standup[0], CLIPMAP.climb[0], CLIPMAP.land[0], CLIPMAP.hook[0]]}; })()")
        check('clips: retargeted clips load and replace the originals for eat/search/standup/climb/land (hook keeps Punch)', not r['missing'] and r['tracks'] > 20 and r['map'] == ['Consume', 'Chest_Open', 'LayToIdle', 'ClimbUp_1m_RM', 'NinjaJump_Land', 'Punch'], str(r))
        w = lambda clip: f"(HP.Game.player.anim.acts['{clip}'] ? HP.Game.player.anim.acts['{clip}'].getEffectiveWeight() : 0)"
        r = await ev(pg, f"(()=>{{ T.reset(); const P=HP.Game.player; P.anim.play('eat'); let still=0; for(let i=0;i<40;i++){{ T.run([],1/60,1/60); still=Math.max(still,{w('Consume')}); }} T.reset(); Input.keys.add('w'); T.run([],0.6,1/60); P.anim.play('eat'); let moving=0, walk=0; for(let i=0;i<40;i++){{ T.run([],1/60,1/60); moving=Math.max(moving,{w('Consume')}); walk=Math.max(walk,P.anim.W.Run||0); }} Input.keys.clear(); return [still, moving, walk]; }})()")
        check('clips: eating standing still plays Consume; eating on the move keeps the legs walking', r[0] > 0.8 and r[1] < 0.01 and r[2] > 0.3, f"still={r[0]:.2f} moving={r[1]:.2f} run={r[2]:.2f}")
        r = await ev(pg, f"(()=>{{ T.reset(-67,14.4,0); HP.sim(0.3); Input.pressed.add(' '); let st='', mx=0; for(let i=0;i<50;i++){{ T.run([],1/60,1/60); if(HP.Game.player.state==='climb') st='climb'; mx=Math.max(mx,{w('ClimbUp_1m_RM')}); }} return [st, mx]; }})()")
        check('clips: mantling a ledge plays the ClimbUp clip', r[0] == 'climb' and r[1] > 0.8, str(r))
        r = await ev(pg, f"(()=>{{ T.reset(); Input.pressed.add(' '); let land=0, prep=0; for(let i=0;i<120;i++){{ T.run([],1/60,1/60); prep=Math.max(prep,{w('NinjaJump_Start')}); if(HP.Game.player.loco.state==='landing') land=Math.max(land,{w('NinjaJump_Land')}); }} return [prep, land]; }})()")
        check('clips: jump take-off and landing use the NinjaJump crouches', r[0] > 0.5 and r[1] > 0.5, f"start={r[0]:.2f} land={r[1]:.2f}")
        r = await ev(pg, f"(()=>{{ T.reset(); const P=HP.Game.player; P.anim.play('standup'); let mx=0; for(let i=0;i<100;i++){{ T.run([],1/60,1/60); mx=Math.max(mx,{w('LayToIdle')}); }} return [mx, P.anim.playing('standup')]; }})()")
        check('clips: getting up after a knockout plays LayToIdle and finishes', r[0] > 0.8 and not r[1], str(r))
        r = await ev(pg, """(()=>{ HP.Game.restoreFromState(); HP.S.time.hour=8; const e=HP.NPC.byKey('ezra'), pl=PLACES.field;
            e.pos.set(pl.x, Col.ground(pl.x,pl.z,99), pl.z); e.state='routine'; e.goal=null; e.path=null; HP.tp(pl.x+4, pl.z+4); HP.sim(1.5,1/60);
            const ew = e.anim.acts.Farm_Harvest ? e.anim.acts.Farm_Harvest.getEffectiveWeight() : 0; const esum=[...e.anim.baseSet].reduce((a,n)=>a+(e.anim.W[n]||0),0);
            return {ew, esum, ezra:e.poseClip}; })()""")
        check('clips: Ezra harvests in his field with normalized weights', r['ew'] > 0.8 and abs(r['esum'] - 1) < 1e-3 and r['ezra'] == 'Farm_Harvest', str(r))
        for nm, js in [('u_eat', "T.reset(); HP.Game.player.anim.play('eat'); T.run([],0.55,1/60)"), ('u_climb', "T.reset(-67,14.4,0); HP.sim(0.3); Input.pressed.add(' '); T.run([],0.35,1/60)"), ('u_land', "T.reset(); Input.pressed.add(' '); for(let i=0;i<120 && HP.Game.player.loco.state!=='landing';i++) T.run([],1/60,1/60); T.run([],0.08,1/60)")]:
            await ev(pg, js + "; HP.Game.cam.yaw=HP.Game.player.yaw+2.1; HP.Game.cam.idleT=-999; HP.Game.cam.snap=true; HP.Game.cam.update(0)"); await pg.wait_for_timeout(1200); await pg.screenshot(path=OUT + nm + '.png')
        await ev(pg, "HP.Game.restoreFromState(); HP.S.time.hour=8; const e=HP.NPC.byKey('ezra'); const pl=PLACES.field; e.pos.set(pl.x, Col.ground(pl.x,pl.z,99), pl.z); e.state='routine'; e.goal=null; e.path=null; HP.tp(pl.x+2.5, pl.z+1.5); HP.sim(1.2,1/60); HP.Game.cam.yaw=Math.atan2(pl.x-HP.Game.player.pos.x, pl.z-HP.Game.player.pos.z); HP.Game.cam.pitch=0.15; HP.Game.cam.zoom=3.5; HP.Game.cam.idleT=-999; HP.Game.cam.snap=true; HP.Game.cam.update(0)"); await pg.wait_for_timeout(1200); await pg.screenshot(path=OUT + 'u_ezra.png')
        desk_errs = [e for e in errs]
        await b.close()

        # ================= mobile (real touch events through CDP) =================
        b, pg, errs = await boot(p, 844, 390, mobile=True)
        cdp = await pg.context.new_cdp_session(pg)
        async def touch(kind, pts): await cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, x, y in pts]})
        await pg.tap('#bNew'); await pg.wait_for_timeout(600); await ev(pg, SETUP); await ev(pg, "T.reset(-8,-18,0.9); HP.sim(0.2)")
        vis = await ev(pg, "({touch:!document.getElementById('touch').hidden, stick:document.getElementById('stick').getBoundingClientRect().toJSON(), run:document.getElementById('tRun').getBoundingClientRect().toJSON()})")
        check('mobile: virtual joystick and touch buttons are shown and on screen', vis['touch'] and vis['stick']['left'] >= 0 and vis['run']['right'] <= 844 and vis['stick']['bottom'] <= 390, f"stick={vis['stick']['left']:.0f},{vis['stick']['top']:.0f}")
        sx, sy = vis['stick']['left'] + vis['stick']['width'] / 2, vis['stick']['top'] + vis['stick']['height'] / 2
        await touch('touchStart', [(1, sx, sy)]); await touch('touchMove', [(1, sx, sy - 50)])
        r = await ev(pg, "(()=>{ const P=HP.Game.player, x0=P.pos.x, z0=P.pos.z, cy=HP.Game.cam.yaw; HP.sim(1, 1/60); const f=fwd(cy); return {my:Input.move.y, dot:((P.pos.x-x0)*f.x+(P.pos.z-z0)*f.z)/Math.hypot(P.pos.x-x0,P.pos.z-z0), d:Math.hypot(P.pos.x-x0,P.pos.z-z0), s:P.loco.state}; })()")
        check('mobile: pushing the joystick up moves the player forward relative to the camera', r['my'] > 0.8 and r['dot'] > 0.97 and r['d'] > 1, str(r))
        await touch('touchCancel', [])
        r = await ev(pg, "(()=>{ HP.sim(0.6,1/60); return {m:Input.move.mag, knob:document.getElementById('knob').style.transform, sp:Math.hypot(HP.Game.player.vel.x,HP.Game.player.vel.z)}; })()")
        check('mobile: a cancelled joystick touch releases the stick (no stuck movement)', r['m'] == 0 and r['knob'] == '' and r['sp'] < 0.2, str(r))
        await ev(pg, "T.reset(-8,-18,0.9)"); y0 = await ev(pg, "HP.Game.cam.yaw")
        await touch('touchStart', [(2, 560, 150)]);
        for i in range(1, 7): await touch('touchMove', [(2, 560 + i * 15, 150)]); await ev(pg, "HP.sim(1/60,1/60)")
        await touch('touchEnd', [])
        r = await ev(pg, "({yaw:HP.Game.cam.yaw, m:Input.move.mag, sp:Math.hypot(HP.Game.player.vel.x,HP.Game.player.vel.z)})")
        check('mobile: dragging on the view rotates the camera and does not move the player', abs(r['yaw'] - y0) > 0.15 and r['m'] == 0 and r['sp'] < 0.05, f"yaw {y0:.2f}->{r['yaw']:.2f} move={r['m']}")
        await ev(pg, "T.reset(-8,-18,0.9)"); y0 = await ev(pg, "HP.Game.cam.yaw")
        await touch('touchStart', [(1, sx, sy)]); await touch('touchMove', [(1, sx, sy - 50)]); await touch('touchStart', [(1, sx, sy - 50), (2, 560, 150)])
        for i in range(1, 7): await touch('touchMove', [(1, sx, sy - 50), (2, 560 + i * 15, 150)]); await ev(pg, "HP.sim(1/60,1/60)")
        r = await ev(pg, "(()=>{ HP.sim(0.5,1/60); return {yaw:HP.Game.cam.yaw, m:Input.move.mag, sp:Math.hypot(HP.Game.player.vel.x,HP.Game.player.vel.z)}; })()")
        await touch('touchEnd', [])
        check('mobile: multi-touch moves with the stick and looks with a second finger at once', r['m'] > 0.8 and r['sp'] > 1 and abs(r['yaw'] - y0) > 0.15, str(r))
        await ev(pg, "T.reset(-8,-18,0.9)")
        bb = await ev(pg, "document.querySelector('#tcluster [data-b=attack]').getBoundingClientRect().toJSON()")
        ax, ay = bb['left'] + bb['width'] / 2, bb['top'] + bb['height'] / 2
        await touch('touchStart', [(3, ax, ay)]); held = await ev(pg, "Input.btn.attack === true")
        await touch('touchCancel', []); r = await ev(pg, "({btn:Input.btn.attack, yaw:HP.Game.cam.yaw})")
        check('mobile: a cancelled button touch does not leave the button held', held and r['btn'] is False, str(r))
        await touch('touchStart', [(4, ax, ay)]); await ev(pg, "window.dispatchEvent(new Event('blur'))"); r = await ev(pg, "Input.btn.attack"); await touch('touchEnd', [])
        check('mobile: losing focus while a button is held releases it', r is False, str(r))
        y0 = await ev(pg, "HP.Game.cam.yaw"); rb = await ev(pg, "document.getElementById('tRun').getBoundingClientRect().toJSON()")
        await touch('touchStart', [(5, rb['left'] + 20, rb['top'] + 20)]); await touch('touchMove', [(5, rb['left'] + 90, rb['top'] + 20)]); await touch('touchEnd', [])
        r = await ev(pg, "(()=>{ HP.sim(0.05); return {yaw:HP.Game.cam.yaw, sprint:Input.sprintToggle}; })()")
        check('mobile: dragging from a button does not rotate the camera', abs(r['yaw'] - y0) < 0.02, f"yaw {y0:.3f}->{r['yaw']:.3f}")
        await pg.screenshot(path=OUT + 'c_mobile.png')
        check('no page errors on desktop or mobile', not desk_errs and not errs, str((desk_errs + errs)[:3]))
        await b.close()
    n = sum(1 for _, ok, _ in RESULTS if ok); print(f"\n{n}/{len(RESULTS)} controller checks passed")
    if n != len(RESULTS): raise SystemExit(1)

if __name__ == '__main__': asyncio.run(main())
