"""Imported animal models: an animated .glb dropped into assets/animals/ replaces that species' code-built body. The
test makes a small skinned, animated horse with the glTF exporter, hands it to the game the way build.py embeds it,
and checks it is scaled, grounded, coloured, saddled and animated by speed (walk, gallop, grazing, death), that
riding it works, and that species without a model keep the procedural rig. Then it checks the horse that ships in
assets/animals/horse.glb (Quaternius, CC0)."""
import asyncio, json
from run import boot, URL
from playwright.async_api import async_playwright
RESULTS = []
def check(name, ok, info=''):
    RESULTS.append((name, bool(ok), str(info)[:400])); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{str(info)[:400]}]' if info else ''))
async def ev(pg, js): return await pg.evaluate(js)
BASE = URL.rsplit('/', 1)[0]

# a 2 m long four-legged creature along +z: one skinned mesh (body + legs), leg bones swung by each clip
MAKE = r"""(async () => {
  const bones = [new THREE.Bone()]; bones[0].name = 'Root'; bones[0].position.y = 1.0;
  const legPos = [[0.3, 0.7], [-0.3, 0.7], [0.3, -0.7], [-0.3, -0.7]];
  legPos.forEach(([x, z], i) => { const b = new THREE.Bone(); b.name = 'Leg' + i; b.position.set(x, 0, z); bones[0].add(b); bones.push(b); });
  const geos = [new THREE.BoxGeometry(0.7, 0.6, 2.0).translate(0, 1.2, 0)]; legPos.forEach(([x, z]) => geos.push(new THREE.BoxGeometry(0.15, 1.0, 0.15).translate(x, 0.5, z)));
  const pos = [], idx = [], si = [], sw = []; let off = 0;
  geos.forEach((g, gi) => { const p = g.attributes.position, ix = g.index.array; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); si.push(gi, 0, 0, 0); sw.push(1, 0, 0, 0); } for (const v of ix) idx.push(v + off); off += p.count; });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); geo.setIndex(idx); geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: '#ff0000', skinning: true }); mat.name = 'Main';
  const mesh = new THREE.SkinnedMesh(geo, mat); mesh.name = 'Body'; const arm = new THREE.Group(); arm.name = 'AnimalArmature'; arm.add(bones[0]); arm.add(mesh); arm.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(bones));
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06), new THREE.MeshStandardMaterial({ color: '#111111' })); eye.material.name = 'Eye'; eye.position.set(0.3, 1.4, 1.0); arm.add(eye);
  const swing = (name, amp, dur) => new THREE.AnimationClip('AnimalArmature|' + name, dur, [1, 2, 3, 4].map(i => { const q = a => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a).toArray(); const s = i % 2 ? 1 : -1;
    return new THREE.QuaternionKeyframeTrack('Leg' + (i - 1) + '.quaternion', [0, dur / 2, dur], [...q(amp * s), ...q(-amp * s), ...q(amp * s)]); }));
  const clips = [swing('Idle', 0.02, 2), swing('Walk', 0.3, 1), swing('Gallop', 0.8, 0.6), swing('Eating', 0.05, 2), swing('Death', 1.2, 1)];
  const scene = new THREE.Scene(); scene.add(arm);
  const buf = await new Promise(res => new THREE.GLTFExporter().parse(scene, res, { binary: true, animations: clips }));
  let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s);
})()"""

async def main():
    async with async_playwright() as p:
        b0, pg0, _ = await boot(p)
        for f in ('three.min.js', 'GLTFLoader.js', 'tests/vendor/GLTFExporter.js'): await pg0.add_script_tag(url=f'{BASE}/{f}')
        glb = await pg0.evaluate(MAKE); await b0.close()
        check('fixture: an animated skinned horse exported as .glb', len(glb) > 2000, len(glb))

        b, pg, errs = await boot(p, init=f"window.ANIMAL_GLB = {{ horse: {json.dumps(glb)} }};")
        await pg.click('#bNew'); await pg.wait_for_timeout(600)
        info = await ev(pg, """(() => { const A = AnimalAssets.models.horse, H = HP.Game.horse, R = H.rig; return { has: AnimalAssets.has('horse'), deer: AnimalAssets.has('deer'), model: !!R.isModel,
          clips: Object.fromEntries(Object.entries(A.map).map(([k, c]) => [k, c ? c.name.split('|').pop() : null])), saddle: !!R.saddle, bags: R.body.children.length }; })()""")
        check('loader: the horse model is parsed and replaces the code-built horse; deer without a model stay procedural', info['has'] and info['model'] and not info['deer'], info)
        c = info['clips']
        check('loader: clips are matched by name (Idle, Walk, Gallop also for a trot, Eating, Death)', c['idle'] == 'Idle' and c['walk'] == 'Walk' and c['run'] == 'Gallop' and c['eat'] == 'Eating' and c['death'] == 'Death' and c['trot'] == 'Gallop', c)
        geo = await ev(pg, """(() => { const H = HP.Game.horse, R = H.rig; H.rider = null; HP.sim(0.2); R.vis.rotation.x = 0; /* level, whatever the slope */ R.root.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(R.model), s = box.getSize(new THREE.Vector3()), seat = new THREE.Vector3(); R.seat.getWorldPosition(seat);
          let main = null, eye = null; R.model.traverse(m => { if (m.isMesh) { if (m.isSkinnedMesh) main = m.material; else eye = m.material; } });
          let skMin = 1e9, skMax = -1e9; const v = new THREE.Vector3(); R.model.traverse(m => { if (m.isSkinnedMesh) { m.skeleton.update(); for (let i = 0; i < m.geometry.attributes.position.count; i++) { m.boneTransform(i, v); v.applyMatrix4(m.matrixWorld); skMin = Math.min(skMin, v.y); skMax = Math.max(skMax, v.y); } } });
          return { skFoot: +(skMin - H.pos.y).toFixed(2), skTop: +(skMax - H.pos.y).toFixed(2), len: +Math.max(s.x, s.z).toFixed(2), foot: +(box.min.y - H.pos.y).toFixed(2), seat: +(seat.y - H.pos.y).toFixed(2), main: '#' + main.color.getHexString(), toon: main.isMeshToonMaterial && main.skinning, eye: '#' + eye.color.getHexString(), coat: '#a0673a' }; })()""")
        check('model: scaled to a horse\'s length and standing on the ground', 2.2 < geo['len'] < 2.7 and abs(geo['foot']) < 0.15, geo)
        check('model: the saddle seat sits on its back', 1.1 < geo['seat'] < 1.9, geo)
        check('model: the rendered (skinned) pose stands on the ground with the seat at its back', abs(geo['skFoot']) < 0.2 and abs(geo['skTop'] - geo['seat']) < 0.25, geo)
        check('model: toon shaded with skinning, the main coat takes the horse\'s colour, small parts keep theirs', geo['toon'] and geo['main'] == geo['coat'] and geo['eye'] == '#111111', geo)

        an = await ev(pg, """(() => { const H = HP.Game.horse, A = H.anim, R = H.rig, leg = R.model.getObjectByName('Leg0'), st = []; let steps = 0; const os = H.onStep; H.onStep = () => steps++;
          const run = (o, sec) => { const qs = []; for (let i = 0; i < sec * 30; i++) { A.update(1 / 30, o); qs.push(leg.quaternion.x); } return { clip: A.cur ? A.cur.name.split('|').pop() : null, swing: +(Math.max(...qs) - Math.min(...qs)).toFixed(3), rate: +A.curAction.timeScale.toFixed(2) }; };
          const r = { walk: run({ speed: 1.6, gait: 'walk' }, 2), gallop: run({ speed: 11, gait: 'gallop' }, 2), graze: run({ speed: 0, graze: 1 }, 1.5), idle: run({ speed: 0 }, 1.5), death: run({ speed: 0, dead: 1 }, 2) };
          r.steps = steps; H.onStep = os; A.update(1 / 30, { speed: 0 }); A.cur = null; return r; })()""")
        check('anim: walking plays Walk and swings the legs', an['walk']['clip'] == 'Walk' and an['walk']['swing'] > 0.1, an['walk'])
        check('anim: galloping plays Gallop, sped up to match ground speed', an['gallop']['clip'] == 'Gallop' and an['gallop']['swing'] > 0.3 and an['gallop']['rate'] > 1.05, an['gallop'])
        check('anim: grazing plays Eating, standing plays Idle, dying plays Death', an['graze']['clip'] == 'Eating' and an['idle']['clip'] == 'Idle' and an['death']['clip'] == 'Death', an)
        check('anim: hoofbeats still fire while moving', an['steps'] > 4, an['steps'])

        await ev(pg, "HP.Missions.abandon(true); HP.tp(-20,40); const H = HP.Game.horse; H.pos.set(-22, Col.ground(-22, 41, 99), 41); H.state = 'idle'; HP.sim(0.3)")
        await ev(pg, "HP.tp(HP.Game.horse.pos.x - Math.cos(HP.Game.horse.yaw)*1.4, HP.Game.horse.pos.z + Math.sin(HP.Game.horse.yaw)*1.4); HP.sim(0.1)")
        okm = await ev(pg, "HP.press('Mount')"); await ev(pg, "HP.sim(1.2)")
        await ev(pg, "HP.Game.horse.yaw = 0.3; HP.Game.cam.yaw = 0.3; HP.sim(0.1)")
        await pg.keyboard.down('w'); await pg.keyboard.down('Shift'); await ev(pg, "HP.sim(4)")
        ride = await ev(pg, "(() => { const H = HP.Game.horse, P = HP.Game.player, seat = new THREE.Vector3(); H.rig.seat.getWorldPosition(seat); return { st: P.state, sp: +H.speed.toFixed(1), clip: H.anim.cur ? H.anim.cur.name.split('|').pop() : null, seatGap: +(P.pos.distanceTo(seat)).toFixed(2) }; })()")
        await pg.keyboard.up('Shift'); await pg.keyboard.up('w')
        check('ride: mount and gallop on the imported horse, the rider stays in the saddle', okm and ride['st'] == 'ride' and ride['sp'] > 6 and ride['clip'] == 'Gallop' and ride['seatGap'] < 1.2, ride)
        deco = await ev(pg, "World.decoHorses.map(h => { let c = null; h.rig.model.traverse(m => { if (m.isSkinnedMesh) c = '#' + m.material.color.getHexString(); }); return c; })")
        check('variety: each horse wears its own coat colour', deco == ['#4b3a2a', '#e2d3b0'], deco)
        await ev(pg, "HP.sim(2)")
        check('no page errors', not [e for e in errs if 'favicon' not in e], errs[:3])
        await b.close()

        # --- the horse that ships with the game ---
        import os
        if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'animals', 'horse.glb')):
            b, pg, errs = await boot(p); await pg.click('#bNew'); await pg.wait_for_timeout(600)
            real = await ev(pg, """(() => { const A = AnimalAssets.models.horse, R = HP.Game.horse.rig; const cols = []; R.model.traverse(m => { if (m.isMesh) for (const x of [].concat(m.material)) cols.push('#' + x.color.getHexString()); });
              return { model: !!R.isModel, clips: Object.fromEntries(['idle', 'walk', 'trot', 'run', 'eat', 'death', 'rear'].map(k => [k, A.map[k] && A.map[k].name])), speed: Object.fromEntries(Object.entries(A.speed).map(([k, v]) => [k, +v.toFixed(2)])), cols, back: +(A.back * A.scale).toFixed(2) }; })()""")
            c = real['clips']
            check('shipped horse: loads with Idle, Walk, Run (trot and gallop), Death and Jump (rearing); grazing is not mistaken for Death', real['model'] and c['idle'] == 'Idle' and c['walk'] == 'Walk' and c['run'] == 'Run' and c['trot'] == 'Run' and c['death'] == 'Death' and c['rear'] == 'Jump' and c['eat'] != 'Death', real)
            check('shipped horse: coat in the horse\'s colour, mane and tail in its mane colour', sorted(set(real['cols'])) == ['#3b2618', '#a0673a'], real['cols'])
            check('shipped horse: stride-matched clip speeds are sane and rise with the gait, saddle height is a horse\'s back', 0.2 < real['speed']['walk'] < real['speed']['run'] < 15 and 1.2 < real['back'] < 1.7, real)
            await ev(pg, "HP.sim(2)"); check('shipped horse: no page errors', not [e for e in errs if 'favicon' not in e], errs[:3]); await b.close()
    n = sum(1 for r in RESULTS if r[1]); print(f'\n{n}/{len(RESULTS)} animal model checks passed')
    if n != len(RESULTS): raise SystemExit(1)
if __name__ == '__main__': asyncio.run(main())
