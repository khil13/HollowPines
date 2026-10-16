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
      this.loadExtras();
      const sc = this.gltf.scene; const rootNode = sc.getObjectByName('Scene'); if (rootNode) rootNode.position.set(0, rootNode.position.y, 0);
      this.measure(); this.ready = true; return true;
    } catch (e) { console.warn('Character model failed to load, using procedural characters', e); return false; }
  },
  // retargeted clips embedded by build.py (assets/anim/*.json, made by tools/retarget.py): sampled local quaternion
  // and position tracks keyed by bone name. Where a clip exists, it replaces the original in CLIPMAP.
  loadExtras() {
    for (const pack of Object.values(window.EXTRA_ANIMS || {})) for (const n in pack.clips) { const d = pack.clips[n], times = Array.from({ length: d.frames }, (_, i) => i / d.fps), tr = [];
      for (const b in d.tracks) { tr.push(new THREE.QuaternionKeyframeTrack(b + '.quaternion', times, d.tracks[b].q)); if (d.tracks[b].p) tr.push(new THREE.VectorKeyframeTrack(b + '.position', times, d.tracks[b].p)); }
      this.clips[n] = new THREE.AnimationClip(n, d.duration, tr); }
    for (const a in CLIP_UPGRADES) { const u = CLIP_UPGRADES[a]; if (this.clips[u[0]]) { CLIPMAP[a] = u; if (u[4] && ACTIONS[a]) ACTIONS[a].dur = u[4]; } }
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

/* clip mapping for gameplay actions: [clip, from, to, pingpong]; dur/events still come from ACTIONS so gameplay timing is unchanged */
const CLIPMAP = { pickup: ['PickUp', 0, 1], search: ['PickUp', 0.25, 0.6], kneel: ['PickUp', 0.3, 0.55], dig: ['PickUp', 0.2, 0.6], punch: ['Punch', 0, 1], hook: ['Punch', 0, 1], uppercut: ['SwordSlash', 0.1, 0.9], dodge: ['Roll', 0, 1], hit: ['RecieveHit', 0, 1], hitB: ['RecieveHit', 0, 1], climb: ['Jump', 0.1, 0.75], mount: ['Jump', 0.05, 0.5], jumpPrep: ['Jump', 0, 0.16], land: ['Jump', 0.78, 1], standup: ['StandUp', 0, 1] };
// retargeted Universal Animation Library clips used instead when loaded: [clip, from, to, pingpong, new action duration]
const CLIP_UPGRADES = { eat: ['Consume', 0, 1], search: ['Chest_Open', 0.12, 0.5, true], standup: ['LayToIdle', 0.08, 1, false, 1.4], climb: ['ClimbUp_1m_RM', 0, 1],
  jumpPrep: ['NinjaJump_Start', 0, 0.12], land: ['NinjaJump_Land', 0.18, 0.5] };
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

// scratch objects reused every frame (no per-frame allocation in the animator hot path)
const _AX = { p: new THREE.Vector3(-1, 0, 0), r: new THREE.Vector3(0, 0, 1), y: new THREE.Vector3(0, 1, 0) };
const _cv = [...Array(10)].map(() => new THREE.Vector3()), _cq = [...Array(5)].map(() => new THREE.Quaternion());
const BASE_CLIPS = ['Idle', 'Walk', 'Run', 'Walk_Carry', 'Run_Carry', 'Jump', 'SitDown', 'Death', 'PickUp'];

class ClipAnimator {
  constructor(rig, owner) {
    this.rig = rig; this.owner = owner; this.mixer = new THREE.AnimationMixer(rig.model); this.acts = {}; this.phase = 0; this.t = 0; this.actions = []; this.layers = { aim: 0, carry: 0, block: 0, rifle: 0 }; this.lw = { aim: 0, carry: 0, block: 0, rifle: 0, handsup: 0, crouch: 0, ride: 0 };
    this.sq = 1; this.sqv = 0; this.expr = 'calm'; this.look = 0; this.lookPitch = 0; this.lookAt = null; this.idleT = 0; this.runW = 0; this.lastSpeed = 0; this.accel = 0; this.turnRate = 0; this.prevYaw = owner.yaw || 0; this.base = {}; this.cur = zeroPose(); this.hatS = new Spring(90, 9); this.hatZ = new Spring(90, 9); this.drop = 0;
    this.fsm = new LocoFSM(); this.bw = {}; this.W = {}; this.clipT = {}; this.baseSet = new Set(BASE_CLIPS); // base-layer weights (smoothed), final weights, clip times
    this.bone = {}; rig.model.traverse(o => { if (o.isBone) this.bone[o.name] = o; }); // name -> bone, built once
    for (const n of BASE_CLIPS.concat('Defeat')) this.act(n);
    this.tg = [new THREE.Vector3(), new THREE.Vector3()]; this.rq = new THREE.Quaternion(); this.feet = [[rig.LL, 1], [rig.RL, -1]];
  }
  act(name) { if (!this.acts[name]) { const a = this.mixer.clipAction(Assets.clips[name]); a.play(); a.paused = true; a.setEffectiveWeight(0); this.acts[name] = a; } return this.acts[name]; }
  play(name, o = {}) { const def = ACTIONS[name]; if (!def) return null; if (o.replace !== false) this.actions = this.actions.filter(a => a.def.mask !== def.mask && !(def.mask === 'full')); const a = { name, def, t: 0, age: 0, dur: o.dur || def.dur, cb: o.on || {}, fired: new Set(), loop: o.loop || def.loop, done: false, speed: o.speed || 1, k: o.k ?? 1 }; this.actions.push(a); return a; }
  stop(name) { for (const a of this.actions) if (!name || a.name === name) { a.loop = false; a.t = Math.max(a.t, a.dur - 0.15); a.age = Math.max(a.age, 1); } }
  playing(name) { return this.actions.some(a => a.name === name && !a.done); }
  busy() { return this.actions.some(a => a.def.mask === 'full' && !a.done && !a.def.nobusy); }
  squash(v) { this.sqv += v; }
  setW(name, w, time) { const a = this.act(name); a.setEffectiveWeight(w); if (time !== undefined) a.time = time; }
  dispose() { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.rig.model); this.acts = {}; this.actions = []; this.disposed = true; }
  get state() { return this.fsm.state; }
  // target clip weights for the base layer; clip times are written to this.clipT
  baseTargets(st, T) {
    const R = this.rig, state = st.state, carry = this.lw.carry > 0.5, walkN = carry ? 'Walk_Carry' : 'Walk', runN = carry ? 'Run_Carry' : 'Run', CT = this.clipT, dur = n => Assets.clips[n].duration;
    const idleT = (this.t % dur('Idle')) / dur('Idle');
    if (state === 'ground' || state === 'chat' || state === 'work' || state === 'handsup') {
      const L = st.loco || this.fsm, ls = state === 'ground' ? L.state : 'idle', sp = state === 'ground' ? st.speed : 0, crouch = ls === 'crouchIdle' || ls === 'crouchWalk';
      // gait phase follows distance travelled; stride from the clips (measured at load), shortened when crouched
      const rw = this.runW = ls === 'sprint' ? 1 : ls === 'jog' ? clamp((sp - 1.7) / 3.7, 0.25, 0.85) : ls === 'walk' || ls === 'startWalk' || ls === 'crouchWalk' ? 0 : this.runW;
      const sw = Assets.speeds[walkN], sr = Assets.speeds[runN], sc = R.scale; let stride = lerp(sw.stride * sc * (crouch ? 0.75 : 1), sr.stride * sc, rw); stride = Math.max(stride, sp / (rw > 0.5 ? 2.3 : 1.7));
      const turnStep = Math.abs(this.turnRate) > 1.2 && sp < 0.6 ? Math.abs(this.turnRate) * 0.12 : 0, prev = this.phase; this.phase += (sp / Math.max(0.3, stride) + turnStep) * this.dt;
      if (Math.floor(prev * 2) !== Math.floor(this.phase * 2) && state === 'ground' && this.owner.onStep && (sp > 0.3 || turnStep)) this.owner.onStep();
      const ph = ((this.phase % 1) + 1) % 1; CT[walkN] = CT[runN] = ph; CT.Idle = idleT;
      const pose = st.poseClip && Assets.clips[st.poseClip] ? st.poseClip : null; // a place-specific loop (harvesting, arms folded)
      if (pose && (state === 'work' || (state === 'ground' && ls === 'idle' && !turnStep))) { this.baseSet.add(pose); T[pose] = 1; CT[pose] = (this.t % dur(pose)) / dur(pose); }
      else if (state === 'work') { T.PickUp = 1; CT.PickUp = 0.35 + 0.08 * Math.sin(this.t * 3); }
      else if (ls === 'jumpStart') { T.Jump = 1; CT.Jump = lerp(0, 0.16, clamp(L.t / 0.1, 0, 1)); }
      else if (ls === 'landing') { T.Jump = 1; CT.Jump = lerp(0.78, 1, clamp(L.t / 0.25, 0, 1)); }
      else if (ls === 'idle' || ls === 'crouchIdle') { if (turnStep) { T.Idle = 0.5; T[walkN] = 0.5; } else T.Idle = 1; }
      else if (ls === 'startWalk') { const k = clamp(sp / 1.2, 0, 1); T.Idle = 1 - k; T[walkN] = k; }
      else if (ls === 'dodge') T[runN] = 1; // the Roll clip plays on the action layer on top of this
      else { T[walkN] = 1 - rw; T[runN] = rw; } // walk / jog / sprint / crouchWalk
      this.lw.crouch = damp(this.lw.crouch, crouch ? 1 : 0, 10, this.dt); this.lw.handsup = damp(this.lw.handsup, state === 'handsup' ? 1 : 0, 10, this.dt);
    } else if (state === 'air') { T.Jump = 1; CT.Jump = st.vy > 0 ? lerp(0.42, 0.3, clamp(st.vy / 7, 0, 1)) : lerp(0.48, 0.62, clamp(-st.vy / 10, 0, 1)); this.lw.crouch = damp(this.lw.crouch, 0, 10, this.dt); }
    else if (state === 'swim') { this.phase += this.dt * (st.speed > 0.3 ? 1.4 : 0.5); T[runN] = 1; CT[runN] = (this.phase % 1 + 1) % 1; }
    else if (state === 'ride' || state === 'sit') { T.SitDown = 1; CT.SitDown = 1; }
    else if (state === 'lie' || state === 'down') { T.Death = 1; CT.Death = 1; }
  }
  update(dt, st) {
    const r = this.owner, R = this.rig; this.t += dt; this.dt = dt; if (this.disposed) return;
    if (r.pos && !r.carried) { R.root.position.copy(r.pos); R.root.rotation.set(0, r.yaw || 0, 0); } R.root.updateMatrixWorld(true);
    this.turnRate = damp(this.turnRate, angDiff(this.prevYaw, r.yaw) / Math.max(dt, 1e-4), 10, dt); this.prevYaw = r.yaw;
    this.accel = damp(this.accel, (st.speed - this.lastSpeed) / Math.max(dt, 1e-4), 8, dt); this.lastSpeed = st.speed;
    for (const k in this.layers) this.lw[k] = damp(this.lw[k], this.layers[k], 12, dt);
    const state = st.state;
    // characters without their own controller (NPCs) get a state machine fed from what they report
    if (!st.loco) this.fsm.update(dt, { grounded: state !== 'air', vy: st.vy || 0, speed: state === 'ground' ? st.speed : 0, moving: st.speed > 0.3, crouch: !!st.crouch && state === 'ground', jumpPrep: false, dodge: false });
    else { this.fsm.state = st.loco.state; this.fsm.t = st.loco.t; }
    // ---- base layer: crossfade every clip toward the current state's target weights over LOCO.FADE[state]
    const T = this._T || (this._T = {}); for (const n in T) T[n] = 0; this.baseTargets(st, T);
    const fade = state === 'ground' ? (LOCO.FADE[this.fsm.state] || 0.2) : state === 'air' ? 0.1 : 0.2, k = 1 - Math.exp(-dt * 3 / fade);
    const bw = this.bw, BS = this.baseSet; let sum = 0; for (const n of BS) { bw[n] = (bw[n] || 0) + ((T[n] || 0) - (bw[n] || 0)) * k; if (bw[n] < 1e-3 && !T[n]) bw[n] = 0; sum += bw[n]; }
    const W = this.W; for (const n in W) W[n] = 0; for (const n of BS) W[n] = sum > 0 ? bw[n] / sum : 0; // normalized: no blend toward the bind pose
    for (const n of BS) if (W[n] > 0 && this.clipT[n] !== undefined) this.act(n).time = this.clipT[n] * Assets.clips[n].duration;
    // ---- one-shot actions (clip-mapped ones take over the whole body while they play)
    let actW = 0, actClip = null; const gestures = this._gest || (this._gest = []); gestures.length = 0;
    for (const a of this.actions) {
      if (a.done) continue; a.t += dt * a.speed; a.age += dt * a.speed; let u = a.t / a.dur;
      if (u >= 1) { if (a.loop) { a.t -= a.dur; a.fired.clear(); u = a.t / a.dur; } else { a.done = true; if (a.cb.end) a.cb.end(); continue; } }
      for (const ev in a.def.ev || {}) if (!a.fired.has(ev) && u >= a.def.ev[ev]) { a.fired.add(ev); if (a.cb[ev]) a.cb[ev](); }
      const bi = a.def.bi ?? 0.12, bo = a.def.bo ?? 0.15; const w = ease(clamp(a.loop ? Math.min(1, a.age / bi) : Math.min(1, a.age / bi, (a.dur - a.t) / bo), 0, 1));
      // full-body clips only for full-body actions, or upper-body ones (eating) while standing still, so legs never freeze mid-stride
      const cm = CLIPMAP[a.name]; if (cm && (state === 'ground' || state === 'air') && (a.def.mask !== 'upper' || st.speed < 0.3)) { const f = lerp(cm[1], cm[2], a.loop && (cm[3] || cm[0] === 'PickUp') ? 0.5 + 0.5 * Math.sin(u * TAU) : u); const ww = a.name === 'hit' || a.name === 'hitB' ? w * 0.7 : w; this.act(cm[0]).time = f * Assets.clips[cm[0]].duration; if (ww > actW) { actW = ww; actClip = cm[0]; } W[cm[0]] = Math.max(W[cm[0]] || 0, ww); }
      else if (GESTURES[a.name]) gestures.push([GESTURES[a.name](u), w]);
    }
    this.actions = this.actions.filter(a => !a.done);
    for (const n in this.acts) { let w = W[n] || 0; if (actW > 0 && n !== actClip) w *= 1 - actW; this.acts[n].setEffectiveWeight(w); }
    if (this.base.q) this.rig.skBones.forEach((b, i) => { b.quaternion.copy(this.base.q[i]); b.position.copy(this.base.p[i]); });
    this.mixer.update(0);
    if (!this.base.q) { this.base.q = this.rig.skBones.map(b => b.quaternion.clone()); this.base.p = this.rig.skBones.map(b => b.position.clone()); } else this.rig.skBones.forEach((b, i) => { this.base.q[i].copy(b.quaternion); this.base.p[i].copy(b.position); });
    // ---- post-process: posture, overrides, gestures, look-at, IK
    R.model.updateMatrixWorld(true);
    const rq = this.rq; R.root.getWorldQuaternion(rq); const BN = this.bone;
    const rot = (bone, ax, ang) => { if (!bone || !ang) return; const wa = _cv[0].copy(_AX[ax]).applyQuaternion(rq), pq = bone.parent.getWorldQuaternion(_cq[0]); const q = _cq[1].copy(pq).invert().multiply(_cq[2].setFromAxisAngle(wa, ang)).multiply(pq); bone.quaternion.premultiply(q); bone.updateMatrixWorld(true); };
    const snapTo = (name, w) => { if (w < 0.01) return; const s = Assets.snaps[name]; for (const b in s) { const o = BN[b]; if (o) o.quaternion.slerp(s[b], w); } R.model.updateMatrixWorld(true); };
    this.lowerHips(0.24 * this.lw.crouch * R.scale + 0.05 * this.lw.ride); rot(R.spine, 'p', 0.35 * this.lw.crouch);
    snapTo('carry', this.lw.carry * (1 - actW)); snapTo('handsup', this.lw.handsup); snapTo('reins', this.lw.ride * (1 - this.lw.aim)); snapTo('aim', this.lw.aim);
    if (this.lw.aim > 0.01) { rot(R.chest, 'p', -this.lookPitch * 0.8 * this.lw.aim); if (this.lw.rifle > 0.5) { rot(BN.UpperArmL, 'p', 1.2 * this.lw.aim); rot(BN.LowerArmL, 'r', 0.6 * this.lw.aim); } }
    if (this.lw.block > 0.01) { const w = this.lw.block; rot(BN.UpperArmL, 'p', 1.6 * w); rot(BN.UpperArmR, 'p', 1.6 * w); rot(BN.LowerArmL, 'p', 1.4 * w); rot(BN.LowerArmR, 'p', 1.4 * w); }
    for (const [list, w] of gestures) for (const [b, ax, ang] of list) rot(BN[b], ax, ang * w);
    if (state === 'chat') { rot(BN.UpperArmR, 'p', 0.5 + 0.3 * Math.sin(this.t * 3)); rot(BN.LowerArmR, 'p', 0.8); rot(BN.Head, 'y', 0.1 * Math.sin(this.t * 1.7)); }
    // lean into acceleration (start-walk and sprint starts lean further forward)
    if (state === 'ground' && !st.crouch) rot(R.spine, 'p', clamp(this.accel * 0.02, -0.2, 0.2) + (this.fsm.state === 'startWalk' ? 0.06 : this.fsm.state === 'sprint' ? 0.08 : 0));
    if (this.lookAt && state !== 'swim' && state !== 'down' && state !== 'lie') { const a = angDiff(r.yaw, Math.atan2(this.lookAt.x - r.pos.x, this.lookAt.z - r.pos.z)); if (Math.abs(a) < 1.9) { const k2 = clamp(a, -1.0, 1.0); rot(R.neck, 'y', k2 * 0.35); rot(R.headBone, 'y', k2 * 0.5); } }
    // ---- legs: two-bone IK to the (animated) feet, re-planted on the ground; stirrups when riding
    if ((state === 'ground' || state === 'ride' || state === 'chat' || state === 'work' || state === 'handsup') && actW < 0.6) this.legIK(st, state, dt);
    // ---- squash & stretch, secondary motion
    const acc = -160 * (this.sq - 1) - 14 * this.sqv; this.sqv += acc * dt; this.sq += this.sqv * dt; this.sq = clamp(this.sq, 0.75, 1.25);
    R.vis.scale.set(R.scale / Math.sqrt(this.sq), R.scale * this.sq, R.scale / Math.sqrt(this.sq)); R.vis.rotation.z = clamp(-this.turnRate * 0.03 * st.speed, -0.2, 0.2); R.vis.rotation.x = state === 'swim' ? 1.1 : 0; R.vis.position.y = state === 'swim' ? -0.4 : 0;
    R.hat.rotation.x = this.hatS.step(clamp(-this.accel * 0.012 + (st.vy || 0) * -0.01, -0.3, 0.3), dt); R.hat.rotation.z = R.baseHatZ + this.hatZ.step(clamp(this.turnRate * 0.03, -0.2, 0.2), dt);
  }
  lowerHips(m) { if (!m) return; const b = this.rig.hips, p = b.getWorldPosition(_cv[1]); p.y -= m; b.position.copy(b.parent.worldToLocal(p)); this.rig.model.updateMatrixWorld(true); }
  legIK(st, state, dt) {
    const R = this.rig, r = this.owner, root = R.root;
    const aim = (bone, from, to) => { const q = _cq[2].setFromUnitVectors(from.normalize(), to.normalize()); const wq = bone.getWorldQuaternion(_cq[3]); const pq = bone.parent.getWorldQuaternion(_cq[4]); bone.quaternion.copy(pq.invert().multiply(q.multiply(wq))); bone.updateMatrixWorld(true); };
    const solve = (A, Bn, E, target, pole) => {
      const pa = A.getWorldPosition(_cv[2]), pb = Bn.getWorldPosition(_cv[3]), pe = E.getWorldPosition(_cv[4]);
      const a = pa.distanceTo(pb), b = pb.distanceTo(pe), toT = _cv[5].copy(target).sub(pa); const c = clamp(toT.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3); toT.normalize();
      const ang = Math.acos(clamp((a * a + c * c - b * b) / (2 * a * c), -1, 1)); const n = _cv[6].crossVectors(toT, pole); if (n.lengthSq() < 1e-6) return; n.normalize();
      const kd = _cv[7].copy(toT).applyAxisAngle(n, -ang).multiplyScalar(a); if (kd.dot(pole) < 0) kd.copy(toT).applyAxisAngle(n, ang).multiplyScalar(a);
      aim(A, _cv[8].copy(pb).sub(pa), _cv[9].copy(kd)); const pb2 = Bn.getWorldPosition(_cv[3]), pe2 = E.getWorldPosition(_cv[4]); aim(Bn, _cv[8].copy(pe2).sub(pb2), _cv[9].copy(target).sub(pb2));
    };
    root.getWorldQuaternion(_cq[0]); const fwdW = this._fw || (this._fw = new THREE.Vector3()), right = this._rt || (this._rt = new THREE.Vector3()); fwdW.set(0, 0, 1).applyQuaternion(_cq[0]); right.set(-fwdW.z, 0, fwdW.x);
    const tgts = this.tg;
    this.feet.forEach(([L, side], i) => { const p = L.ft.getWorldPosition(tgts[i]);
      if (state === 'ride') { R.hips.getWorldPosition(p).addScaledVector(right, -side * 0.42 * R.scale).addScaledVector(fwdW, 0.1); p.y -= 0.55 * R.scale; }
      else if (st.ground) { const lift = p.y - r.pos.y; const g = st.ground(p.x, p.z, r.pos.y + 0.6); p.y = g + Math.max(0, lift); } });
    if (state !== 'ride' && st.ground) { const dl = tgts[0].y - r.pos.y, dr = tgts[1].y - r.pos.y; const drop = clamp(-Math.min(dl, dr, 0), 0, 0.3); this.drop = damp(this.drop, drop, 12, dt); this.lowerHips(this.drop); }
    this.feet.forEach(([L], i) => { L.ft.position.copy(L.ft.parent.worldToLocal(_cv[1].copy(tgts[i]))); L.ft.updateMatrixWorld(true); solve(L.hp, L.kn, L.ft, tgts[i], fwdW); });
  }
}
const _makeHumanoidProc = makeHumanoid, _AnimatorProc = Animator;
function makeCharacter(o) { return Assets.ready && Settings.v.models !== false ? makeModelHumanoid(o) : _makeHumanoidProc(o); }
function makeAnimator(rig, owner) { return rig.isModel ? new ClipAnimator(rig, owner) : new _AnimatorProc(rig, owner); }
