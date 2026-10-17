/* ===== Imported animal models (optional): drop animated .glb files into assets/animals/ named horse.glb, deer.glb,
   wolf.glb or rabbit.glb and build.py embeds them. Each one replaces that species' code-built body; missing files keep
   the procedural rig. The model is cloned per animal and driven by the same QuadAnimator interface: clips are picked by
   name (Idle, Walk, Trot, Gallop/Run, Eating, Death, Attack, Jump...), played at a rate that matches ground speed, and
   the rider's seat, saddle and saddlebags hang off the same rig fields as before, so gameplay code is unchanged. */
const ANIMAL_SIZE = { horse: 2.45, deer: 1.75, wolf: 1.45, rabbit: 0.42 }; // nose-to-tail length the model is scaled to (m)
const ANIMAL_CLIPS = { // first match wins, case-insensitive, on the clip name without any "Armature|" prefix
  idle: [/^idle$/, /idle(?!.*hit)/], walk: [/^walk$/, /walk/], trot: [/trot/, /canter/, /^run$/, /gallop(?!.*jump)/, /^walk$/, /walk/], run: [/gallop(?!.*jump)/, /^run$/, /run/, /canter/, /walk/],
  eat: [/^eat/, /eating/, /graze/, /headlow/, /idle/], death: [/death/, /die/, /dead/], attack: [/attack/, /bite/, /headbutt/], rear: [/rear/, /jump/, /idle_2/, /idle/], lie: [/lie/, /lay/, /sit/, /sleep/, /rest/],
};
const ANIMAL_SPEED = { walk: 1.6, trot: 3.6, run: 8.5 }; // ground speed (m/s per metre of body length / 2.45) each clip is authored for
const AnimalAssets = {
  models: {},
  async init() {
    const src = window.ANIMAL_GLB || {}; if (!THREE.GLTFLoader || !THREE.SkeletonUtils) return;
    for (const sp in src) {
      try {
        const bin = atob(src[sp]), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        const gltf = await new Promise((res, rej) => new THREE.GLTFLoader().parse(u.buffer, '', res, rej));
        const clips = {}; for (const c of gltf.animations) clips[c.name.split('|').pop().toLowerCase()] = c;
        const pick = k => { for (const re of ANIMAL_CLIPS[k]) { const n = Object.keys(clips).find(n => re.test(n)); if (n) return clips[n]; } return null; };
        const map = {}; for (const k in ANIMAL_CLIPS) map[k] = pick(k);
        if (!map.idle && gltf.animations[0]) map.idle = gltf.animations[0];
        // measure the rest pose: length along its long horizontal axis, and the forward direction (glTF faces +z)
        gltf.scene.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(gltf.scene), sz = box.getSize(new THREE.Vector3());
        const alongX = sz.x > sz.z * 1.15, len = alongX ? sz.x : sz.z;
        // the back: the highest rest-pose point near the middle of the body (the saddle goes there)
        const c = box.getCenter(new THREE.Vector3()), v = new THREE.Vector3(); let back = -1e9;
        gltf.scene.traverse(m => { if (!m.isMesh) return; const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
          const along = alongX ? v.x - c.x : v.z - c.z, across = alongX ? v.z - c.z : v.x - c.x; if (Math.abs(along) < len * 0.12 && Math.abs(across) < (alongX ? sz.z : sz.x) * 0.25) back = Math.max(back, v.y); } });
        const hit = new THREE.Raycaster(new THREE.Vector3(c.x, box.max.y + 1, c.z), new THREE.Vector3(0, -1, 0)).intersectObject(gltf.scene, true)[0]; // straight down through the middle, where coarse models have no vertices
        if (hit) back = Math.max(back, hit.point.y); if (back < box.min.y) back = box.min.y + sz.y * 0.7;
        const scale = ANIMAL_SIZE[sp] / Math.max(0.01, len);
        this.models[sp] = { gltf, map, scale, yaw: alongX ? -Math.PI / 2 : 0, box, back: back - box.min.y, speed: this.gaitSpeeds(gltf, map, alongX, scale, ANIMAL_SIZE[sp] / 2.45) };
      } catch (e) { console.warn(`Animal model ${sp}.glb failed to load, using the built-in ${sp}`, e); }
    }
  },
  /* the ground speed each locomotion clip is authored for: how far a foot sweeps back while planted, over the time it is
     planted (a typical share of the cycle per gait), so playback can match the animal's real speed with no foot sliding */
  gaitSpeeds(gltf, map, alongX, scale, k) {
    const out = {}, tmp = THREE.SkeletonUtils.clone(gltf.scene), mixer = new THREE.AnimationMixer(tmp), feet = [], p = new THREE.Vector3();
    tmp.traverse(o => { if (o.isBone && /foot|hoof|paw/i.test(o.name) && !/_end$/i.test(o.name)) feet.push(o); });
    for (const [g, duty] of [['walk', 0.6], ['trot', 0.45], ['run', 0.35]]) {
      const clip = map[g]; out[g] = ANIMAL_SPEED[g] * k; if (!clip || !feet.length) continue;
      const act = mixer.clipAction(clip); act.play(); const N = 48, zs = feet.map(() => []);
      for (let i = 0; i < N; i++) { act.time = clip.duration * i / N; mixer.update(0); tmp.updateMatrixWorld(true); feet.forEach((f, j) => { f.getWorldPosition(p); zs[j].push(alongX ? p.x : p.z); }); }
      act.stop(); let range = 0, cycles = 1;
      zs.forEach(z => { const lo = Math.min(...z), hi = Math.max(...z), mid = (lo + hi) / 2; if (hi - lo <= range) return; range = hi - lo; /* a clip can hold more than one stride: count forward swings through the middle */
        let n = 0; for (let i = 0; i < N; i++) if (z[i] < mid && z[(i + 1) % N] >= mid) n++; cycles = Math.max(1, n); });
      const v = range * scale * cycles / (duty * clip.duration); if (v > 0.2 && v < 30) out[g] = v;
    }
    return out;
  },
  has(sp) { return !!this.models[sp]; },
};
const _animalSkinMats = {};
function makeModelQuad(o) {
  const t = o.type, A = AnimalAssets.models[t], s = o.scale || 1, dims = { horse: { bl: 1.0, bw: 0.42, bh: 0.48, leg: 0.95, neck: 0.8, head: 0.52 }, deer: { bl: 0.7, bw: 0.28, bh: 0.32, leg: 0.82, neck: 0.6, head: 0.32 }, wolf: { bl: 0.62, bw: 0.24, bh: 0.28, leg: 0.52, neck: 0.32, head: 0.3 }, rabbit: { bl: 0.2, bw: 0.15, bh: 0.15, leg: 0.12, neck: 0.05, head: 0.14 } }[t];
  const root = new THREE.Group(), vis = new THREE.Group(); vis.scale.setScalar(s); root.add(vis);
  const model = THREE.SkeletonUtils.clone(A.gltf.scene); model.scale.setScalar(A.scale); model.rotation.y = A.yaw; vis.add(model);
  model.position.y = -A.box.min.y * A.scale; // feet on the ground
  // soft toon shading like the rest of the world; the main coat takes this animal's colour so horses can differ
  // the coat is whichever material covers the most triangles; very dark materials (mane, tail, hooves) take the mane colour
  const mats = m => Array.isArray(m.material) ? m.material : [m.material]; let coat = null, coatN = -1;
  model.traverse(m => { if (!m.isMesh) return; m.castShadow = true; m.frustumCulled = false; const g = m.geometry, total = g.index ? g.index.count : g.attributes.position.count;
    const groups = g.groups.length ? g.groups : [{ count: total, materialIndex: 0 }];
    for (const gr of groups) { const mt = mats(m)[gr.materialIndex || 0]; if (mt && gr.count > coatN && !/eye/i.test(mt.name || '')) { coatN = gr.count; coat = mt; } } });
  const toonFor = (src, skin) => { const nm = (src.name || '').toLowerCase(); let c = '#' + (src.color ? src.color.getHexString() : '888888'); const lum = src.color ? src.color.r * 0.3 + src.color.g * 0.59 + src.color.b * 0.11 : 1;
    if (src === coat || /main|body|coat|fur/.test(nm)) c = o.color || c; else if ((/mane|hair|tail/.test(nm) || (lum < 0.06 && !/eye/.test(nm))) && o.mane) c = o.mane;
    animalMat(c); /* makes sure the shared gradient exists */ const k = c + (skin ? 's' : ''); return _animalSkinMats[k] || (_animalSkinMats[k] = new THREE.MeshToonMaterial({ color: c, gradientMap: GRAD8, skinning: skin })); };
  model.traverse(m => { if (!m.isMesh) return; const list = mats(m).map(mt => toonFor(mt, !!m.isSkinnedMesh)); m.material = Array.isArray(m.material) ? list : list[0]; });
  const backY = A.back * A.scale;
  const body = new THREE.Group(); body.position.y = backY - dims.bh; vis.add(body);
  const seat = new THREE.Object3D(); seat.position.set(0, dims.bh + 0.02, 0.05); body.add(seat);
  let saddle = null;
  if (t === 'horse') { saddle = new THREE.Group(); saddle.position.z = -0.14; /* under the rider's hips, which sit a little behind the seat point */ const Q = c => animalMat(c), bh = dims.bh;
    saddle.add(M(GEO.box, Q('#b23a2e'), 0.82, 0.04, 0.6, 0, bh * 0.98, 0)); saddle.add(M(GEO.sph, Q('#6b3b1f'), 0.3, 0.1, 0.38, 0, bh * 1.05, 0)); saddle.add(M(GEO.sph, Q('#5a3218'), 0.22, 0.1, 0.08, 0, bh * 1.1, -0.28)); saddle.add(M(GEO.cyl, Q('#4a2a14'), 0.035, 0.12, 0.035, 0, bh * 1.14, 0.28));
    for (const ex of [-1, 1]) { saddle.add(M(GEO.box, Q('#5a361c'), 0.03, 0.42, 0.05, ex * 0.38, bh * 0.62, 0.05)); saddle.add(M(GEO.box, Q('#3a2a1a'), 0.1, 0.03, 0.12, ex * 0.4, bh * 0.4, 0.05)); }
    body.add(saddle); }
  const mixer = new THREE.AnimationMixer(model);
  return { root, vis, body, seat, saddle, dims, type: t, scale: s, isModel: true, model, mixer, clips: A.map, legs: [], neck: new THREE.Object3D(), head: new THREE.Object3D(), tail: new THREE.Object3D(), baseNeck: 0, baseHead: 0, baseTail: 0, grazeNeck: 0, grazeHead: 0 };
}
/* an imported horse is hit as three spheres along its body (rump, barrel, chest) sized to the model, topping out just
   under the saddle so shots at the rider still find the rider */
function modelBodyHit(h) { const R = h.rig; if (!R.isModel) return; const back = (R.body.position.y + R.dims.bh) * R.scale, len = ANIMAL_SIZE[R.type] * R.scale;
  h.hitR = 0.42 * R.scale; h.hitH = back - h.hitR - 0.12; h.hitLen = len * 0.22; }
/* QuadAnimator for an imported model: cross-fades between clips and keeps the same phase/onStep contract */
function quadModelUpdate(an, dt, st) {
  const R = an.rig, C = R.clips, sp = st.speed, g = st.gait || 'walk';
  an.t += dt; const prev = an.phase; an.phase += sp * dt / ((GAITS[g] || GAITS.walk).stride * R.scale);
  if (Math.floor(prev * 2) !== Math.floor(an.phase * 2) && an.owner.onStep && sp > 0.25) an.owner.onStep();
  let want = 'idle', rate = 1;
  if ((st.dead || 0) > 0.5 && C.death) want = 'death';
  else if ((st.rear || 0) > 0.4) want = 'rear';
  else if ((st.lie || 0) > 0.5 && C.lie) want = 'lie';
  else if ((st.attack || (R.type === 'wolf' && st.rear > 0)) && C.attack) want = 'attack'; /* a wolf's lunge */
  else if (sp > 0.3) { want = g === 'walk' ? 'walk' : g === 'trot' ? 'trot' : 'run'; rate = clamp(sp / (AnimalAssets.models[R.type].speed[want] * R.scale), 0.45, 2.2); }
  else if ((st.graze || 0) > 0.5) want = 'eat';
  const clip = C[want] || C.idle; if (!clip) return;
  if (an.cur !== clip) { const next = R.mixer.clipAction(clip); next.reset(); next.enabled = true; next.setEffectiveWeight(1);
    if (want === 'death') { next.setLoop(THREE.LoopOnce); next.clampWhenFinished = true; }
    next.play(); if (an.curAction) next.crossFadeFrom(an.curAction, want === 'death' ? 0.15 : 0.3, false); an.cur = clip; an.curAction = next; }
  an.curAction.timeScale = rate; R.mixer.update(dt);
  R.vis.rotation.z = damp(R.vis.rotation.z, st.dead && !C.death ? 1.45 : st.roll || 0, 5, dt);
  an.pitch = damp(an.pitch, st.slope || 0, 8, dt); R.vis.rotation.x = an.pitch;
}
