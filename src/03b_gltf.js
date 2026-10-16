/* ===== Imported character model (glTF) + clip-driven animator =====
   The uploaded character (23-bone rig, 17 animation clips) is embedded in the page and cloned for every
   person. ClipAnimator keeps the same interface as the procedural Animator, so gameplay code is unchanged:
   - locomotion blends Idle / Walk / Run (or the carry versions); clip time is driven by distance travelled,
     so stride matches ground speed
   - one-shot actions map to real clips (Punch, PickUp, Roll, RecieveHit, Jump, StandUp…) with blend in/out
     and gameplay events at fixed points; gestures without a clip are layered onto the arms
   - upper-body overrides (aim, carry, hands up, block) are pose snapshots taken from the clips
   - two-bone leg IK re-solves the legs every frame: feet stay planted on slopes, crouching lowers the hips,
     and riding puts the feet in the stirrups */
const Assets = {
  gltf: null, ready: false, clips: {}, snaps: {}, speeds: {},
  async init() {
    if (!window.CHARACTER_GLB || !THREE.GLTFLoader || !THREE.SkeletonUtils) return false;
    try {
      const bin = atob(window.CHARACTER_GLB), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      this.gltf = await new Promise((res, rej) => new THREE.GLTFLoader().parse(u.buffer, '', res, rej));
      for (const c of this.gltf.animations) this.clips[c.name] = c;
      const sc = this.gltf.scene; const rootNode = sc.getObjectByName('Scene'); if (rootNode) rootNode.position.set(0, rootNode.position.y, 0);
      this.measure(); this.ready = true; return true;
    } catch (e) { console.warn('Character model failed to load, using procedural characters', e); return false; }
  },
  measure() { // stride per cycle for locomotion clips, and upper-body pose snapshots
    const tmp = THREE.SkeletonUtils.clone(this.gltf.scene), mixer = new THREE.AnimationMixer(tmp), foot = tmp.getObjectByName('FootL'), hips = tmp.getObjectByName('Hips');
    const sample = (name, f) => { mixer.stopAllAction(); const a = mixer.clipAction(this.clips[name]); a.reset().play(); a.paused = true; a.time = this.clips[name].duration * f; mixer.update(0); tmp.updateMatrixWorld(true); };
    for (const n of ['Walk', 'Run', 'Walk_Carry', 'Run_Carry']) { let mn = 1e9, mx = -1e9; for (let i = 0; i <= 40; i++) { sample(n, i / 40); const fp = new THREE.Vector3(), hp = new THREE.Vector3(); foot.getWorldPosition(fp); hips.getWorldPosition(hp); mn = Math.min(mn, fp.z - hp.z); mx = Math.max(mx, fp.z - hp.z); } this.speeds[n] = { stride: (mx - mn) * 2 / 1.0, dur: this.clips[n].duration }; }
    const UPPER = ['Abdomen', 'Torso', 'Neck', 'Head', 'ShoulderL', 'UpperArmL', 'LowerArmL', 'FistL', 'ShoulderR', 'UpperArmR', 'LowerArmR', 'FistR'];
    const snap = (key, clip, f, bones = UPPER) => { sample(clip, f); const m = {}; for (const b of bones) { const o = tmp.getObjectByName(b); if (o) m[b] = o.quaternion.clone(); } this.snaps[key] = m; };
    snap('aim', 'Shoot_OneHanded', 0.3); snap('carry', 'Walk_Carry', 0.25); snap('handsup', 'Victory', 0.45); snap('reins', 'Walk_Carry', 0.25, ['ShoulderL', 'UpperArmL', 'LowerArmL', 'FistL', 'ShoulderR', 'UpperArmR', 'LowerArmR', 'FistR']);
    mixer.stopAllAction();
  },
};

const LOOK_PALETTE = (o) => ({ Skin: o.skin || '#e8b48c', Main: o.coat || o.vest || o.shirt || '#4f7ca8', Black: o.boot || '#3b2a1e', Grey: o.pants || '#5a4a3a', Face: '#ffffff' });
function makeModelHumanoid(o = {}) {
  const s = (o.scale || 1) * 0.95, root = new THREE.Group(), vis = new THREE.Group(); root.add(vis); vis.scale.setScalar(s);
  const model = THREE.SkeletonUtils.clone(Assets.gltf.scene); vis.add(model);
  const pal = LOOK_PALETTE(o), parts = []; let skel = null;
  model.traverse(m => { if (!m.isMesh) return; const nm = m.material.name; if (nm === 'Helmet') { m.visible = false; return; } m.material = toon(pal[nm] || '#888', { skinning: true }); if (nm === 'Face') m.material = new THREE.MeshBasicMaterial({ color: '#1b1b1b', skinning: true }); m.castShadow = true; m.frustumCulled = false; parts.push(m); if (!skel && m.skeleton) skel = m.skeleton; });
  const B = n => model.getObjectByName(n); const skBones = []; model.traverse(o => { if (o.isBone) skBones.push(o); });
  const rig = { skBones, root, vis, model, skel, parts, scale: s, isModel: true, eyes: [], brows: [], mouth: { scale: new THREE.Vector3() }, legLen: 0.55 * s,
    hips: B('Body_1'), pelvis: B('Hips'), spine: B('Abdomen'), chest: B('Torso'), neck: B('Neck'), headBone: B('Head'),
    L: { sh: B('UpperArmL'), el: B('LowerArmL'), hand: null }, R: { sh: B('UpperArmR'), el: B('LowerArmR'), hand: null },
    LL: { hp: B('UpperLegL'), kn: B('LowerLegL'), ft: B('FootL') }, RL: { hp: B('UpperLegR'), kn: B('LowerLegR'), ft: B('FootR') }, rootBone: B('Bone') };
  root.updateMatrixWorld(true);
  // attach a child to a bone with its orientation aligned to the character (so props point forward)
  const aligned = (bone, offset) => { const g = new THREE.Group(); const bq = new THREE.Quaternion(); bone.getWorldQuaternion(bq); const rq = new THREE.Quaternion(); root.getWorldQuaternion(rq); g.quaternion.copy(bq.invert().multiply(rq)); const ws = new THREE.Vector3(); bone.getWorldScale(ws); g.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z).multiplyScalar(s); const wp = new THREE.Vector3(); bone.getWorldPosition(wp); const p = new THREE.Vector3(...offset).multiplyScalar(s).add(new THREE.Vector3(0, 0, 0)); bone.add(g); g.position.copy(bone.worldToLocal(wp.clone().add(p))); return g; };
  rig.R.hand = aligned(B('FistR'), [0, -0.02, 0.03]); rig.L.hand = aligned(B('FistL'), [0, -0.02, 0.03]);
  const headTop = aligned(B('Head'), [0, 0.62, 0.02]); rig.head = headTop;
  const hat = new THREE.Group(); headTop.add(hat); rig.hat = hat; rig.baseHatZ = o.hatTilt || 0;
  if (o.hat !== false) { const hc = o.hatColor || '#6b4a2f'; hat.add(M(GEO.cyl, hc, 0.5, 0.04, 0.48, 0, 0, 0)); const cr = M(GEO.cyl, hc, 0.26, 0.24, 0.24, 0, 0.12, 0); cr.geometry = new THREE.CylinderGeometry(0.8, 1, 1, 14); hat.add(cr); hat.add(M(GEO.cyl, o.band || '#2b1d14', 0.265, 0.05, 0.245, 0, 0.03, 0)); if (o.hatTilt) hat.rotation.z = o.hatTilt; }
  else if (o.hair) { hat.add(M(GEO.sph, o.hair, 0.33, 0.16, 0.32, 0, -0.04, -0.03)); if (o.longHair) hat.add(M(GEO.sph, o.hair, 0.28, 0.26, 0.16, 0, -0.26, -0.24)); }
  if (o.hair && o.hat !== false && o.longHair) { const hr = M(GEO.sph, o.hair, 0.27, 0.24, 0.15, 0, -0.27, -0.25); headTop.add(hr); rig.hair = hr; }
  if (o.beard) headTop.add(M(GEO.sph, o.beard, 0.25, 0.15, 0.17, 0, -0.5, 0.17));
  if (o.mustache) headTop.add(M(GEO.box, o.mustache, 0.18, 0.04, 0.05, 0, -0.43, 0.29));
  if (o.scarf || o.badge || o.apron) { const ch = aligned(B('Torso'), [0, 0, 0]); if (o.scarf) ch.add(M(GEO.sph, o.scarf, 0.2, 0.07, 0.17, 0, 0.27, 0.04)); if (o.apron) ch.add(M(GEO.box, o.apron, 0.36, 0.42, 0.04, 0, -0.18, 0.2)); if (o.badge) ch.add(M(GEO.cyl, '#e9c46a', 0.045, 0.02, 0.045, 0.12, 0.08, 0.2)).rotation.x = Math.PI / 2; }
  return rig;
}

/* clip mapping for gameplay actions; dur/events still come from ACTIONS so gameplay timing is unchanged */
const CLIPMAP = { pickup: ['PickUp', 0, 1], search: ['PickUp', 0.25, 0.6], kneel: ['PickUp', 0.3, 0.55], dig: ['PickUp', 0.2, 0.6], punch: ['Punch', 0, 1], hook: ['Punch', 0, 1], uppercut: ['SwordSlash', 0.1, 0.9], dodge: ['Roll', 0, 1], hit: ['RecieveHit', 0, 1], hitB: ['RecieveHit', 0, 1], climb: ['Jump', 0.1, 0.75], mount: ['Jump', 0.05, 0.5], jumpPrep: ['Jump', 0, 0.16], land: ['Jump', 0.78, 1], standup: ['StandUp', 0, 1] };
// gestures for actions without a clip: [bone, axis, angle(u)] in character space; axis p = pitch (+ forward/up), r = roll (+ toward character's left), y = yaw
const GESTURES = {
  eat: u => { const k = Math.min(1, Math.sin(u * Math.PI) * 1.6); return [['UpperArmR', 'p', 1.3 * k], ['LowerArmR', 'p', 1.7 * k]]; },
  whistle: u => [['UpperArmR', 'p', 1.6], ['LowerArmR', 'p', 1.9]],
  tip: u => [['UpperArmR', 'p', 2.4], ['LowerArmR', 'p', 1.6], ['Head', 'p', -0.2 * Math.sin(u * Math.PI)]],
  greet: u => [['UpperArmR', 'r', -2.4], ['LowerArmR', 'r', -0.6 * Math.sin(u * 22)]],
  taunt: u => [['UpperArmR', 'p', 1.5], ['LowerArmR', 'p', 0.4 + 0.5 * Math.abs(Math.sin(u * 16))], ['Torso', 'p', 0.15]],
  door: u => { const k = Math.sin(u * Math.PI); return [['UpperArmR', 'p', 1.45 * k], ['Torso', 'p', 0.15 * k]]; },
  shove: u => { const k = Math.sin(u * Math.PI); return [['UpperArmR', 'p', 1.5 * k], ['UpperArmL', 'p', 1.5 * k], ['Torso', 'p', 0.3 * k]]; },
  feed: u => { const k = Math.sin(u * Math.PI); return [['UpperArmR', 'p', 1.3 * k], ['Torso', 'p', 0.25 * k]]; },
  pat: u => [['UpperArmR', 'p', 1.5], ['LowerArmR', 'p', 0.6 + 0.25 * Math.sin(u * 18)]],
  brush: u => [['UpperArmR', 'p', 1.2 + 0.4 * Math.sin(u * TAU)], ['UpperArmR', 'r', -0.3 * Math.sin(u * TAU)]],
  reload: u => [['UpperArmR', 'p', 0.6], ['LowerArmR', 'p', 1.2], ['UpperArmL', 'p', 0.7 + 0.15 * Math.sin(u * 20)], ['LowerArmL', 'p', 1.3], ['Head', 'p', 0.35]],
  recoil: u => [['UpperArmR', 'p', 0.4 * Math.sin(u * Math.PI)], ['Torso', 'p', -0.08 * Math.sin(u * Math.PI)]],
  cast: u => [['UpperArmR', 'p', u < 0.45 ? 2.7 : 1.1]],
  reel: u => [['UpperArmR', 'p', 1.1], ['UpperArmL', 'p', 1.1 + 0.25 * Math.sin(u * TAU)], ['LowerArmL', 'p', 1.1]],
  stretch: u => { const k = Math.sin(u * Math.PI); return [['UpperArmR', 'p', 2.6 * k], ['UpperArmL', 'p', 2.6 * k], ['Head', 'p', -0.25 * k]]; },
  lookAround: u => [['Head', 'y', Math.sin(u * TAU) * 0.9], ['Torso', 'y', Math.sin(u * TAU) * 0.25]],
  skid: u => { const k = Math.sin(u * Math.PI); return [['Torso', 'p', -0.3 * k]]; },
};

class ClipAnimator {
  constructor(rig, owner) {
    this.rig = rig; this.owner = owner; this.mixer = new THREE.AnimationMixer(rig.model); this.acts = {}; this.phase = 0; this.t = 0; this.actions = []; this.layers = { aim: 0, carry: 0, block: 0, rifle: 0 }; this.lw = { aim: 0, carry: 0, block: 0, rifle: 0, handsup: 0, crouch: 0, ride: 0 };
    this.sq = 1; this.sqv = 0; this.expr = 'calm'; this.look = 0; this.lookPitch = 0; this.lookAt = null; this.idleT = 0; this.moveW = 0; this.runW = 0; this.lastSpeed = 0; this.accel = 0; this.turnRate = 0; this.prevYaw = owner.yaw || 0; this.base = {}; this.cur = zeroPose(); this.hatS = new Spring(90, 9); this.hatZ = new Spring(90, 9); this.stateW = {}; this.drop = 0;
    for (const n of ['Idle', 'Walk', 'Run', 'Walk_Carry', 'Run_Carry', 'Jump', 'SitDown', 'Death', 'PickUp', 'Defeat']) { const a = this.mixer.clipAction(Assets.clips[n]); a.play(); a.paused = true; a.setEffectiveWeight(0); this.acts[n] = a; }
    this.q = new THREE.Quaternion(); this.v = new THREE.Vector3();
  }
  act(name) { if (!this.acts[name]) { const a = this.mixer.clipAction(Assets.clips[name]); a.play(); a.paused = true; a.setEffectiveWeight(0); this.acts[name] = a; } return this.acts[name]; }
  play(name, o = {}) { const def = ACTIONS[name]; if (!def) return null; if (o.replace !== false) this.actions = this.actions.filter(a => a.def.mask !== def.mask && !(def.mask === 'full')); const a = { name, def, t: 0, age: 0, dur: o.dur || def.dur, cb: o.on || {}, fired: new Set(), loop: o.loop || def.loop, done: false, speed: o.speed || 1, k: o.k ?? 1 }; this.actions.push(a); return a; }
  stop(name) { for (const a of this.actions) if (!name || a.name === name) { a.loop = false; a.t = Math.max(a.t, a.dur - 0.15); a.age = Math.max(a.age, 1); } }
  playing(name) { return this.actions.some(a => a.name === name && !a.done); }
  busy() { return this.actions.some(a => a.def.mask === 'full' && !a.done && !a.def.nobusy); }
  squash(v) { this.sqv += v; }
  setW(name, w, time) { const a = this.act(name); a.setEffectiveWeight(w); if (time !== undefined) a.time = time; }
  update(dt, st) {
    const r = this.owner, R = this.rig; this.t += dt;
    if (r.pos && !r.carried) { R.root.position.copy(r.pos); R.root.rotation.set(0, r.yaw || 0, 0); } R.root.updateMatrixWorld(true);
    this.turnRate = damp(this.turnRate, angDiff(this.prevYaw, r.yaw) / Math.max(dt, 1e-4), 10, dt); this.prevYaw = r.yaw;
    this.accel = damp(this.accel, (st.speed - this.lastSpeed) / Math.max(dt, 1e-4), 8, dt); this.lastSpeed = st.speed;
    for (const k in this.layers) this.lw[k] = damp(this.lw[k], this.layers[k], 12, dt);
    const state = st.state; const W = {}; const add = (n, w, f) => { W[n] = (W[n] || 0) + w; if (f !== undefined) this.act(n).time = f * Assets.clips[n].duration; };
    // ---- base layer
    const carry = this.lw.carry > 0.5, walkN = carry ? 'Walk_Carry' : 'Walk', runN = carry ? 'Run_Carry' : 'Run';
    if (state === 'ground' || state === 'chat' || state === 'work' || state === 'handsup') {
      const sp = state === 'ground' ? st.speed : 0; const crouch = !!st.crouch && state === 'ground';
      const mw = this.moveW = damp(this.moveW, clamp(sp / 0.9, 0, 1), 9, dt); const rw = this.runW = damp(this.runW, clamp((sp - 2.2) / 2.6, 0, 1), 6, dt);
      const sw = Assets.speeds[walkN], sr = Assets.speeds[runN], sc = R.scale;
      let stride = lerp(sw.stride * sc * (crouch ? 0.75 : 1), sr.stride * sc, rw); stride = Math.max(stride, sp / (rw > 0.5 ? 2.3 : 1.7));
      const turnStep = Math.abs(this.turnRate) > 1.2 && sp < 0.6 ? Math.abs(this.turnRate) * 0.12 : 0; const prev = this.phase; this.phase += (sp / Math.max(0.3, stride) + turnStep) * dt;
      if (Math.floor(prev * 2) !== Math.floor(this.phase * 2) && state === 'ground' && r.onStep && (sp > 0.3 || turnStep)) r.onStep();
      const ph = ((this.phase % 1) + 1) % 1, mwT = Math.max(mw, turnStep ? 0.5 : 0);
      if (state === 'work') { add('PickUp', 1, 0.35 + 0.08 * Math.sin(this.t * 3)); }
      else { add('Idle', 1 - mwT, (this.t % Assets.clips.Idle.duration) / Assets.clips.Idle.duration); add(walkN, mwT * (1 - rw), ph); add(runN, mwT * rw, ph); }
      this.lw.crouch = damp(this.lw.crouch, crouch ? 1 : 0, 10, dt); this.lw.handsup = damp(this.lw.handsup, state === 'handsup' ? 1 : 0, 10, dt);
    } else if (state === 'air') { const f = st.vy > 0 ? lerp(0.42, 0.3, clamp(st.vy / 7, 0, 1)) : lerp(0.48, 0.62, clamp(-st.vy / 10, 0, 1)); add('Jump', 1, f); this.lw.crouch = damp(this.lw.crouch, 0, 10, dt); }
    else if (state === 'swim') { this.phase += dt * (st.speed > 0.3 ? 1.4 : 0.5); add(runN, 1, (this.phase % 1 + 1) % 1); }
    else if (state === 'ride' || state === 'sit') add('SitDown', 1, 1);
    else if (state === 'lie' || state === 'down') add('Death', 1, 1);
    this.lw.ride = damp(this.lw.ride, state === 'ride' ? 1 : 0, 12, dt);
    // ---- one-shot actions (clip-mapped ones take over the whole body while they play)
    let actW = 0; const gestures = [];
    for (const a of this.actions) {
      if (a.done) continue; a.t += dt * a.speed; a.age += dt * a.speed; let u = a.t / a.dur;
      if (u >= 1) { if (a.loop) { a.t -= a.dur; a.fired.clear(); u = a.t / a.dur; } else { a.done = true; if (a.cb.end) a.cb.end(); continue; } }
      for (const ev in a.def.ev || {}) if (!a.fired.has(ev) && u >= a.def.ev[ev]) { a.fired.add(ev); if (a.cb[ev]) a.cb[ev](); }
      const bi = a.def.bi ?? 0.12, bo = a.def.bo ?? 0.15; const w = ease(clamp(a.loop ? Math.min(1, a.age / bi) : Math.min(1, a.age / bi, (a.dur - a.t) / bo), 0, 1));
      const cm = CLIPMAP[a.name]; if (cm && (state === 'ground' || state === 'air')) { const f = lerp(cm[1], cm[2], a.loop && cm[0] === 'PickUp' ? 0.5 + 0.5 * Math.sin(u * TAU) : u); const ww = a.name === 'hit' || a.name === 'hitB' ? w * 0.7 : w; add(cm[0], 0, f); W[cm[0]] = Math.max(W[cm[0]] || 0, ww); actW = Math.max(actW, ww); }
      else if (GESTURES[a.name]) gestures.push([GESTURES[a.name](u), w]);
    }
    // normalize: actions push the base layer down
    const names = Object.keys(this.acts); for (const n of names) { let w = W[n] || 0; if (actW > 0 && !this.actions.some(a => a.def && CLIPMAP[a.name] && CLIPMAP[a.name][0] === n)) w *= 1 - actW; this.acts[n].setEffectiveWeight(w); }
    if (this.base.q) this.rig.skBones.forEach((b, i) => { b.quaternion.copy(this.base.q[i]); b.position.copy(this.base.p[i]); });
    this.mixer.update(0);
    if (!this.base.q) { this.base.q = this.rig.skBones.map(b => b.quaternion.clone()); this.base.p = this.rig.skBones.map(b => b.position.clone()); } else this.rig.skBones.forEach((b, i) => { this.base.q[i].copy(b.quaternion); this.base.p[i].copy(b.position); });
    // ---- post-process: posture, overrides, gestures, look-at, IK
    R.model.updateMatrixWorld(true);
    const rq = new THREE.Quaternion(); R.root.getWorldQuaternion(rq);
    const axis = { p: new THREE.Vector3(-1, 0, 0), r: new THREE.Vector3(0, 0, 1), y: new THREE.Vector3(0, 1, 0) };
    const rot = (bone, ax, ang) => { if (!bone || !ang) return; const wa = axis[ax].clone().applyQuaternion(rq); const pq = new THREE.Quaternion(); bone.parent.getWorldQuaternion(pq); const qr = new THREE.Quaternion().setFromAxisAngle(wa, ang); const inv = pq.clone().invert(); bone.quaternion.premultiply(inv.multiply(qr).multiply(pq)); bone.updateMatrixWorld(true); };
    const B = n => R.model.getObjectByName(n), snapTo = (name, w) => { if (w < 0.01) return; const s = Assets.snaps[name]; for (const b in s) { const o = B(b); if (o) o.quaternion.slerp(s[b], w); } R.model.updateMatrixWorld(true); };
    // crouch & ride lower the hips; landing/hit squash lowers too
    this.lowerHips(0.24 * this.lw.crouch * R.scale + 0.05 * this.lw.ride); rot(R.spine, 'p', 0.35 * this.lw.crouch);
    snapTo('carry', this.lw.carry * (1 - actW)); snapTo('handsup', this.lw.handsup); snapTo('reins', this.lw.ride * (1 - this.lw.aim)); snapTo('aim', this.lw.aim);
    if (this.lw.aim > 0.01) { rot(R.chest, 'p', -this.lookPitch * 0.8 * this.lw.aim); if (this.lw.rifle > 0.5) { rot(B('UpperArmL'), 'p', 1.2 * this.lw.aim); rot(B('LowerArmL'), 'r', 0.6 * this.lw.aim); } }
    if (this.lw.block > 0.01) { const w = this.lw.block; rot(B('UpperArmL'), 'p', 1.6 * w); rot(B('UpperArmR'), 'p', 1.6 * w); rot(B('LowerArmL'), 'p', 1.4 * w); rot(B('LowerArmR'), 'p', 1.4 * w); }
    for (const [list, w] of gestures) for (const [b, ax, ang] of list) rot(B(b), ax, ang * w);
    if (state === 'chat') { rot(B('UpperArmR'), 'p', 0.5 + 0.3 * Math.sin(this.t * 3)); rot(B('LowerArmR'), 'p', 0.8); rot(B('Head'), 'y', 0.1 * Math.sin(this.t * 1.7)); }
    if (state === 'ground' && !st.crouch) rot(R.spine, 'p', clamp(this.accel * 0.02, -0.2, 0.2));
    if (this.lookAt && state !== 'swim' && state !== 'down' && state !== 'lie') { const a = angDiff(r.yaw, Math.atan2(this.lookAt.x - r.pos.x, this.lookAt.z - r.pos.z)); if (Math.abs(a) < 1.9) { const k = clamp(a, -1.0, 1.0); rot(R.neck, 'y', k * 0.35); rot(R.headBone, 'y', k * 0.5); } }
    // ---- legs: two-bone IK to the (animated) feet, re-planted on the ground; stirrups when riding
    if ((state === 'ground' || state === 'ride' || state === 'chat' || state === 'work' || state === 'handsup') && actW < 0.6) this.legIK(st, state);
    // ---- squash & stretch, secondary motion
    const acc = -160 * (this.sq - 1) - 14 * this.sqv; this.sqv += acc * dt; this.sq += this.sqv * dt; this.sq = clamp(this.sq, 0.75, 1.25);
    R.vis.scale.set(R.scale / Math.sqrt(this.sq), R.scale * this.sq, R.scale / Math.sqrt(this.sq)); R.vis.rotation.z = clamp(-this.turnRate * 0.03 * st.speed, -0.2, 0.2); R.vis.rotation.x = state === 'swim' ? 1.1 : 0; R.vis.position.y = state === 'swim' ? -0.4 : 0;
    R.hat.rotation.x = this.hatS.step(clamp(-this.accel * 0.012 + (st.vy || 0) * -0.01, -0.3, 0.3), dt); R.hat.rotation.z = R.baseHatZ + this.hatZ.step(clamp(this.turnRate * 0.03, -0.2, 0.2), dt);
  }
  lowerHips(m) { if (!m) return; const b = this.rig.hips, p = b.getWorldPosition(new THREE.Vector3()); p.y -= m; b.position.copy(b.parent.worldToLocal(p)); this.rig.model.updateMatrixWorld(true); }
  legIK(st, state) {
    const R = this.rig, r = this.owner, root = R.root; const solve = (A, Bn, E, target, pole) => {
      const pa = A.getWorldPosition(new THREE.Vector3()), pb = Bn.getWorldPosition(new THREE.Vector3()), pe = E.getWorldPosition(new THREE.Vector3());
      const a = pa.distanceTo(pb), b = pb.distanceTo(pe), toT = target.clone().sub(pa); const c = clamp(toT.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3); toT.normalize();
      const cosA = clamp((a * a + c * c - b * b) / (2 * a * c), -1, 1), ang = Math.acos(cosA); let n = new THREE.Vector3().crossVectors(toT, pole); if (n.lengthSq() < 1e-6) return; n.normalize();
      const knee = pa.clone().add(toT.clone().applyAxisAngle(n, -ang).multiplyScalar(a)); if (knee.clone().sub(pa).dot(pole) < 0) knee.copy(pa.clone().add(toT.clone().applyAxisAngle(n, ang).multiplyScalar(a)));
      const aim = (bone, from, to) => { const cur = to.clone(); const q = new THREE.Quaternion().setFromUnitVectors(from.normalize(), cur.normalize()); const wq = bone.getWorldQuaternion(new THREE.Quaternion()); const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion()); bone.quaternion.copy(pq.invert().multiply(q.multiply(wq))); bone.updateMatrixWorld(true); };
      aim(A, pb.clone().sub(pa), knee.clone().sub(pa)); const pb2 = Bn.getWorldPosition(new THREE.Vector3()), pe2 = E.getWorldPosition(new THREE.Vector3()); aim(Bn, pe2.clone().sub(pb2), target.clone().sub(pb2));
    };
    const fwdW = new THREE.Vector3(0, 0, 1).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())), right = new THREE.Vector3(-fwdW.z, 0, fwdW.x);
    const feet = [[R.LL, 1], [R.RL, -1]]; const tgts = [];
    for (const [L, side] of feet) { const p = L.ft.getWorldPosition(new THREE.Vector3());
      if (state === 'ride') { const hp = R.hips.getWorldPosition(new THREE.Vector3()); p.copy(hp).addScaledVector(right, -side * 0.42 * R.scale).addScaledVector(fwdW, 0.1).add(new THREE.Vector3(0, -0.55 * R.scale, 0)); }
      else if (st.ground) { const lift = p.y - r.pos.y; const g = st.ground(p.x, p.z, r.pos.y + 0.6); p.y = g + Math.max(0, lift); }
      tgts.push(p); }
    if (state !== 'ride' && st.ground) { const dl = tgts[0].y - r.pos.y, dr = tgts[1].y - r.pos.y; const drop = clamp(-Math.min(dl, dr, 0), 0, 0.3); this.drop = damp(this.drop, drop, 12, 1 / 60); this.lowerHips(this.drop); }
    feet.forEach(([L], i) => { L.ft.position.copy(L.ft.parent.worldToLocal(tgts[i].clone())); L.ft.updateMatrixWorld(true); solve(L.hp, L.kn, L.ft, tgts[i], fwdW); });
  }
}
const _makeHumanoidProc = makeHumanoid, _AnimatorProc = Animator;
function makeCharacter(o) { return Assets.ready && Settings.v.models !== false ? makeModelHumanoid(o) : _makeHumanoidProc(o); }
function makeAnimator(rig, owner) { return rig.isModel ? new ClipAnimator(rig, owner) : new _AnimatorProc(rig, owner); }
