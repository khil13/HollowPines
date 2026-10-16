/* In-page retargeter (runs in test.html, which already loads three.js, GLTFLoader, SkeletonUtils and the game's
   character as Assets.gltf). Retargets clips from a UE5-style 65-bone skeleton (Quaternius Universal Animation
   Library) onto the game's 23-bone character:
   - every mapped target bone is rotated so it points where its source bone points (C aligns the two rest
     directions once), keeping the source's rotation changes for twist: W_t = D(t) * C * Q_t0, D(t) = Q_s(t) Q_s0^-1
   - hips (Body_1) and the IK foot targets use source positions scaled by the hip-height ratio
   Output: compact sampled tracks (local quaternions / positions) keyed by target bone name. */
window.RT = (() => {
  const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
  const MAP = { Body_1: 'pelvis', Hips: 'spine_01', Abdomen: 'spine_02', Torso: 'spine_03', Neck: 'neck_01', Head: 'Head',
    ShoulderL: 'clavicle_l', UpperArmL: 'upperarm_l', LowerArmL: 'lowerarm_l', FistL: 'hand_l',
    ShoulderR: 'clavicle_r', UpperArmR: 'upperarm_r', LowerArmR: 'lowerarm_r', FistR: 'hand_r',
    UpperLegL: 'thigh_l', LowerLegL: 'calf_l', UpperLegR: 'thigh_r', LowerLegR: 'calf_r', FootL: 'foot_l', FootR: 'foot_r' };
  // bone -> the joint it points at (target, source); bones without one inherit their parent's alignment
  // By default every bone carries only the source's rotation changes, measured from matching relaxed standing poses,
  // so the character keeps its own posture (chibi arms stay clear of the wide body). align:true additionally points
  // limbs exactly where the source's point, which suits rigs with similar proportions.
  const DIR = {
    ShoulderL: ['UpperArmL', 'upperarm_l'], UpperArmL: ['LowerArmL', 'lowerarm_l'], LowerArmL: ['FistL', 'hand_l'],
    ShoulderR: ['UpperArmR', 'upperarm_r'], UpperArmR: ['LowerArmR', 'lowerarm_r'], LowerArmR: ['FistR', 'hand_r'],
    UpperLegL: ['LowerLegL', 'calf_l'], LowerLegL: ['FootL', 'foot_l'], UpperLegR: ['LowerLegR', 'calf_r'], LowerLegR: ['FootR', 'foot_r'] };
  const INHERIT = { FistL: 'LowerArmL', FistR: 'LowerArmR' };
  const ORDER = ['Body_1', 'Hips', 'Abdomen', 'Torso', 'Neck', 'Head', 'ShoulderL', 'UpperArmL', 'LowerArmL', 'FistL', 'ShoulderR', 'UpperArmR', 'LowerArmR', 'FistR', 'UpperLegL', 'LowerLegL', 'UpperLegR', 'LowerLegR', 'FootL', 'FootR'];
  const wq = (o) => o.getWorldQuaternion(Q()), wp = (o) => o.getWorldPosition(V());
  let src = null, refSpec = null; // refSpec: [source clip, time] giving a relaxed standing pose to measure changes from
  async function loadSource(b64) {
    const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    src = await new Promise((res, rej) => new THREE.GLTFLoader().parse(u.buffer, '', res, rej));
    return src.animations.map(a => [a.name, +a.duration.toFixed(3)]);
  }
  function setRef(spec) { refSpec = spec; }
  function setup(align = false) {
    const T = THREE.SkeletonUtils.clone(Assets.gltf.scene), S = THREE.SkeletonUtils.clone(src.scene);
    const tb = {}, sb = {}; T.traverse(o => { if (o.isBone) tb[o.name] = o; }); S.traverse(o => { if (o.isBone) sb[o.name] = o; });
    // reference poses: the character's Idle frame 0 and a relaxed standing frame of the source pack
    const tm = new THREE.AnimationMixer(T), ia = tm.clipAction(Assets.clips.Idle); ia.play(); tm.update(0); T.updateMatrixWorld(true); ia.stop();
    const ref = {}; for (const n of ORDER) ref[n] = { q: wq(tb[n]), p: wp(tb[n]), local: tb[n].quaternion.clone() };
    const sm0 = new THREE.AnimationMixer(S); if (refSpec) { const rc = src.animations.find(a => a.name === refSpec[0]); if (!rc) throw new Error('no ref clip ' + refSpec[0]); const ra = sm0.clipAction(rc); ra.play(); ra.time = refSpec[1]; sm0.update(0); }
    S.updateMatrixWorld(true); const sref = {}; for (const n of Object.values(MAP).concat(['spine_02', 'spine_03', 'neck_01', 'Head', 'upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r', 'calf_l', 'foot_l', 'calf_r', 'foot_r', 'ball_l'])) sref[n] = { q: wq(sb[n]), p: wp(sb[n]) };
    // facing: forward is the toe direction (foot -> ball) for the source; the game's character faces +Z
    const sf = sref.ball_l.p.clone().sub(sref.foot_l.p); sf.y = 0; sf.normalize(); const F = Q().setFromUnitVectors(sf, new THREE.Vector3(0, 0, 1));
    const Fi = F.clone().invert(); for (const k in sref) { sref[k].q.premultiply(F); sref[k].p.applyQuaternion(F); }
    // per-bone direction alignment C (world), from target rest direction to source rest direction
    const C = {}; for (const n of ORDER) { if (align && DIR[n]) { const dt = ref[DIR[n][0]].p.clone().sub(ref[n].p).normalize(), ds = sref[DIR[n][1]].p.clone().sub(sref[MAP[n]].p).normalize(); C[n] = Q().setFromUnitVectors(dt, ds); } }
    for (const n of ORDER) if (!C[n]) C[n] = INHERIT[n] ? C[INHERIT[n]].clone() : Q();
    // positions: scale by hip height (pelvis above the feet) so strides fit the shorter legs
    const tHip = ref.Body_1.p.y - (ref.FootL.p.y + ref.FootR.p.y) / 2, sHip = sref.pelvis.p.y - (sref.foot_l.p.y + sref.foot_r.p.y) / 2, k = tHip / sHip;
    return { T, S, tb, sb, ref, sref, C, F, k, tHip, sHip };
  }
  function bake(name, o = {}) {
    const ctx = setup(!!o.align), { T, S, tb, sb, ref, sref, C, F, k } = ctx, clip = src.animations.find(a => a.name === name); if (!clip) throw new Error('no clip ' + name);
    const sm = new THREE.AnimationMixer(S), act = sm.clipAction(clip); act.play();
    const fps = o.fps || 30, n = Math.max(2, Math.round(clip.duration * fps) + 1), out = {}; for (const b of ORDER) out[b] = { q: [] };
    out.Body_1.p = []; out.FootL.p = []; out.FootR.p = [];
    const sp0 = sref.pelvis.p.clone(); let root0 = null;
    const footOff = {}; { const tm = new THREE.AnimationMixer(T), ia = tm.clipAction(Assets.clips.Idle); ia.play(); tm.update(0); T.updateMatrixWorld(true); for (const f of ['FootL', 'FootR']) footOff[f] = tb[f === 'FootL' ? 'LowerLegL' : 'LowerLegR'].worldToLocal(wp(tb[f])); ia.stop(); tm.uncacheRoot(T); }
    for (let i = 0; i < n; i++) {
      act.time = Math.min(clip.duration, i / fps); sm.update(0); S.updateMatrixWorld(true);
      const sw = {}; for (const b of ORDER) { const s = sb[MAP[b]]; sw[b] = { q: wq(s).premultiply(F), p: wp(s).applyQuaternion(F) }; }
      // root motion: keep the clip in place (the game moves the character itself)
      const drift = V(); if (o.inPlace) { const pp = sw.Body_1.p; if (!root0) root0 = pp.clone(); drift.set(pp.x - root0.x, o.inPlace === 'xyz' ? pp.y - root0.y : 0, pp.z - root0.z); } // inPlace 'xyz' also drops vertical travel
      for (const b of ORDER) {
        const bone = tb[b], D = sw[b].q.clone().multiply(sref[MAP[b]].q.clone().invert());
        const W = D.multiply(C[b]).multiply(ref[b].q); const pw = wq(bone.parent); bone.quaternion.copy(pw.invert().multiply(W));
        if (b === 'Body_1') { const w = ref.Body_1.p.clone().add(sw.Body_1.p.clone().sub(drift).sub(sp0).multiplyScalar(k)); bone.position.copy(bone.parent.worldToLocal(w)); }
        // feet are IK targets: put each at the end of its retargeted leg (same offset as in the Idle pose), so the foot
        // mesh never stretches away from the leg; the game's leg IK then re-plants them on the ground
        if (b === 'FootL' || b === 'FootR') { const leg = tb[b === 'FootL' ? 'LowerLegL' : 'LowerLegR']; bone.position.copy(bone.parent.worldToLocal(leg.localToWorld(footOff[b].clone()))); }
        bone.updateMatrixWorld(true);
        out[b].q.push(...bone.quaternion.toArray().map(v => +v.toFixed(4))); if (out[b].p) out[b].p.push(...bone.position.toArray().map(v => +v.toFixed(4)));
      }
    }
    return { duration: +((n - 1) / fps).toFixed(4), fps, frames: n, tracks: out };
  }
  // turn baked data into a THREE.AnimationClip (same code the game uses at runtime)
  function toClip(name, d) { const times = Array.from({ length: d.frames }, (_, i) => i / d.fps), tr = [];
    for (const b in d.tracks) { tr.push(new THREE.QuaternionKeyframeTrack(b + '.quaternion', times, d.tracks[b].q)); if (d.tracks[b].p) tr.push(new THREE.VectorKeyframeTrack(b + '.position', times, d.tracks[b].p)); }
    return new THREE.AnimationClip(name, d.duration, tr); }
  // contact sheet: the game character posed at a few points of a clip, plus the source mannequin for comparison
  function sheet(name, d, cols = 5) {
    const W = 220, H = 260, cv = document.createElement('canvas'); cv.width = W * cols; cv.height = H * 2; const g = cv.getContext('2d'); g.fillStyle = '#d8e4d0'; g.fillRect(0, 0, cv.width, cv.height);
    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(W, H); r.setClearColor(0xd8e4d0);
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x777766, 1.1)); const dl = new THREE.DirectionalLight(0xffffff, 0.6); dl.position.set(2, 4, 3); sc.add(dl);
    const cam = new THREE.PerspectiveCamera(32, W / H, 0.1, 50);
    const T = THREE.SkeletonUtils.clone(Assets.gltf.scene); const PAL = { Skin: '#e8b48c', Main: '#4f7ca8', Black: '#3b2a1e', Grey: '#5a4a3a', Face: '#1b1b1b' }; T.traverse(m => { if (!m.isMesh) return; if (m.material.name === 'Helmet') { m.visible = false; return; } m.material = new THREE.MeshLambertMaterial({ color: PAL[m.material.name] || '#888', skinning: true }); });
    const S = THREE.SkeletonUtils.clone(src.scene); const box = new THREE.Box3();
    const clip = toClip(name, d), srcClip = src.animations.find(a => a.name === name);
    for (const [row, obj, c] of [[0, T, clip], [1, S, srcClip]]) {
      sc.add(obj); const mx = new THREE.AnimationMixer(obj), a = mx.clipAction(c); a.play();
      for (let i = 0; i < cols; i++) { a.time = c.duration * i / (cols - 1); mx.update(0); obj.updateMatrixWorld(true); box.setFromObject(obj); const ctr = box.getCenter(V()), h = box.max.y - box.min.y || 1;
        cam.position.set(ctr.x + h * 1.6, ctr.y + h * 0.35, ctr.z + h * 1.9); cam.lookAt(ctr); r.render(sc, cam); g.drawImage(r.domElement, i * W, row * H);
        g.fillStyle = '#222'; g.font = '12px sans-serif'; g.fillText(`${row ? 'source' : 'game'} ${(a.time).toFixed(2)}s`, i * W + 6, row * H + 16); }
      sc.remove(obj); }
    r.dispose(); return cv.toDataURL('image/png');
  }
  return { loadSource, setRef, bake, sheet, toClip, setup };
})();
