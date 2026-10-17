/* ===== Stylized skinned characters + animation controller =====
   Humanoids are real skeletons (THREE.Bone hierarchy) driving smoothly skinned meshes, so elbows, knees,
   hips and the waist bend without gaps. Locomotion is a speed-driven blend tree over three authored gait
   cycles (walk / jog / run) sampled with Catmull-Rom curves; stride length is derived from leg geometry so
   feet do not slide. Layers: upper-body overlays (aim, carry, block), one-shot clips with blend in/out and
   events, two-bone leg IK for uneven ground (standing and moving), look-at, and spring-driven secondary
   motion (hat, coat, squash & stretch). */
const POSE_KEYS = ['hipY', 'tilt', 'roll', 'hipX', 'hipZ', 'hipYaw', 'spX', 'spY', 'spZ', 'hdX', 'hdY', 'lShX', 'lShZ', 'lElX', 'rShX', 'rShZ', 'rElX', 'lHipX', 'lHipZ', 'lKnX', 'rHipX', 'rHipZ', 'rKnX', 'lFtX', 'rFtX'];
const zeroPose = () => { const p = {}; for (const k of POSE_KEYS) p[k] = 0; return p; };

/* ---------- skinned mesh helpers ---------- */
function latheProfile(pts, seg = 14) { return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), seg); }
function skinGeo(geo, weightFn) {
  // weightFn(x,y,z) -> [[boneIndex, w], ...] (up to 4); normalized here
  const pos = geo.attributes.position, n = pos.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { const ws = weightFn(pos.getX(i), pos.getY(i), pos.getZ(i)).filter(w => w[1] > 0.001).sort((a, b) => b[1] - a[1]).slice(0, 4); let t = 0; for (const w of ws) t += w[1]; ws.forEach((w, k) => { si[i * 4 + k] = w[0]; sw[i * 4 + k] = w[1] / t; }); }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); return geo;
}
// weights along a vertical limb running down from yTop through a mid joint to yBot: [parent, upper, lower, end]
function limbWeights(ix, yTop, yMid, yBot, blend = 0.06) {
  return (x, y) => { const out = []; const add = (b, w) => { if (w > 0) out.push([b, w]); };
    if (y > yTop - blend) { const t = clamp((y - (yTop - blend)) / (blend * 2), 0, 1); add(ix[0], t * 0.5); add(ix[1], 1 - t * 0.5); return out; }
    if (y > yMid + blend) { add(ix[1], 1); return out; }
    if (y > yMid - blend) { const t = (y - (yMid - blend)) / (blend * 2); add(ix[1], t); add(ix[2], 1 - t); return out; }
    if (y > yBot + blend) { add(ix[2], 1); return out; }
    const t = clamp((y - (yBot - blend)) / (blend * 2), 0, 1); add(ix[2], 0.5 + t * 0.5); add(ix[3], 0.5 - t * 0.5); return out; };
}
function latheProfile20(pts) { return latheProfile(pts, 20); }
function smat(color) { return toon(color, { skinning: true }); }

function makeHumanoid(o = {}) {
  const s = o.scale || 1, st = o.stout || 1, skin = o.skin || '#e8b48c', shirt = o.shirt || '#4f7ca8', pants = o.pants || '#5a4a3a', boot = o.boot || '#3b2a1e', sleeve = o.sleeve || shirt;
  const root = new THREE.Group(); const vis = new THREE.Group(); root.add(vis); vis.scale.setScalar(s);
  const bones = [], idx = {};
  const B = (name, parent, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); if (parent) parent.add(b); idx[name] = bones.length; bones.push(b); return b; };
  const hips = B('hips', null, 0, 0.64, 0), spine = B('spine', hips, 0, 0.1, 0), chest = B('chest', spine, 0, 0.24, 0), neck = B('neck', chest, 0, 0.27, 0), head = B('head', neck, 0, 0.05, 0);
  const shL = B('shL', chest, 0.25 * st, 0.15, 0), elL = B('elL', shL, 0, -0.25, 0), haL = B('haL', elL, 0, -0.24, 0);
  const shR = B('shR', chest, -0.25 * st, 0.15, 0), elR = B('elR', shR, 0, -0.25, 0), haR = B('haR', elR, 0, -0.24, 0);
  const hpL = B('hpL', hips, 0.115 * st, -0.03, 0), knL = B('knL', hpL, 0, -0.27, 0), ftL = B('ftL', knL, 0, -0.27, 0);
  const hpR = B('hpR', hips, -0.115 * st, -0.03, 0), knR = B('knR', hpR, 0, -0.27, 0), ftR = B('ftR', knR, 0, -0.27, 0);
  vis.add(hips); vis.updateMatrixWorld(true); const skel = new THREE.Skeleton(bones);
  const parts = [];
  const add = (geo, color) => { geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.6; const m = new THREE.SkinnedMesh(geo, smat(color)); m.castShadow = true; vis.add(m); m.bind(skel); parts.push(m); return m; };
  // Y levels in rest pose (vis space)
  const Yh = 0.64, Ysp = 0.74, Ych = 0.98, Ynk = 1.25, Ysh = 1.13;
  // torso (shirt) with waist→chest blending
  const torso = latheProfile20([[0, 0.72], [0.2, 0.73], [0.205, 0.82], [0.215, 0.92], [0.245, 1.03], [0.255, 1.12], [0.22, 1.21], [0.13, 1.27], [0.07, 1.31], [0, 1.315]].map(([r, y]) => [r * st, y]));
  torso.scale(1, 1, 0.82);
  skinGeo(torso, (x, y) => { const w = []; if (y < 0.78) w.push([idx.hips, 1 - (y - 0.72) / 0.06 * 0.5], [idx.spine, (y - 0.72) / 0.06 * 0.5]); else if (y < 0.94) w.push([idx.spine, 1]); else if (y < 1.04) { const t = (y - 0.94) / 0.1; w.push([idx.spine, 1 - t], [idx.chest, t]); } else if (y < 1.25) { w.push([idx.chest, 1]); if (Math.abs(x) > 0.16 && y > 1.05) w.push([x > 0 ? idx.shL : idx.shR, 0.35 * smoothstep(0.16, 0.25, Math.abs(x))]); } else w.push([idx.chest, 0.4], [idx.neck, 0.6]); return w; });
  add(torso, shirt);
  // pelvis (pants), blended into thighs
  const pelvis = latheProfile([[0, 0.5], [0.12, 0.52], [0.2, 0.58], [0.215, 0.66], [0.205, 0.76], [0, 0.77]].map(([r, y]) => [r * st, y])); pelvis.scale(1, 1, 0.85);
  skinGeo(pelvis, (x, y) => y > 0.6 ? [[idx.hips, 1]] : [[idx.hips, 0.5 + (y - 0.5) * 5 * 0.5], [x > 0 ? idx.hpL : idx.hpR, 0.5 - (y - 0.5) * 5 * 0.5]]);
  add(pelvis, pants);
  // arms: one continuous skinned tube shoulder→elbow→wrist
  const armGeo = (sx, sh, el, ha) => { const g = latheProfile([[0, 0.0], [0.07, 0.02], [0.082, 0.07], [0.074, 0.25], [0.066, 0.3], [0.06, 0.47], [0.052, 0.5], [0, 0.51]], 10); g.rotateX(Math.PI); g.translate(sx, Ysh + 0.03, 0); return skinGeo(g, limbWeights([idx.chest, sh, el, ha], Ysh + 0.02, Ysh - 0.25, Ysh - 0.48, 0.05)); };
  add(armGeo(0.25 * st, idx.shL, idx.elL, idx.haL), sleeve); add(armGeo(-0.25 * st, idx.shR, idx.elR, idx.haR), sleeve);
  // legs: hip→knee→ankle
  const legGeo = (sx, hp, kn, ft) => { const g = latheProfile([[0, 0], [0.09, 0.02], [0.1, 0.08], [0.088, 0.27], [0.08, 0.31], [0.068, 0.5], [0.06, 0.55], [0, 0.56]], 10); g.rotateX(Math.PI); g.translate(sx, Yh - 0.01, 0); return skinGeo(g, limbWeights([idx.hips, hp, kn, ft], Yh - 0.04, Yh - 0.3, Yh - 0.57, 0.05)); };
  add(legGeo(0.115 * st, idx.hpL, idx.knL, idx.ftL), pants); add(legGeo(-0.115 * st, idx.hpR, idx.knR, idx.ftR), pants);
  // coat skirt follows the legs
  if (o.coat) { const g = latheProfile([[0.255 * st, 1.02], [0.262 * st, 0.86], [0.275 * st, 0.7], [0.3 * st, 0.56], [0.302 * st, 0.545]], 20); g.scale(1, 1, 0.9); const gi = g.index; skinGeo(g, (x, y, z) => { const d = smoothstep(0.76, 0.55, y); const leg = Math.abs(x) > 0.05 ? (x > 0 ? idx.hpL : idx.hpR) : null; const w = [[y > 0.9 ? idx.spine : idx.hips, 1 - d * 0.6]]; if (leg !== null) w.push([leg, d * 0.6 * smoothstep(0.05, 0.2, Math.abs(x))]); return w; }); const cm = add(g, o.coat); cm.material = toon(o.coat, { skinning: true, side: THREE.DoubleSide }); }
  // rigid attachments
  const att = (bone, mesh) => { bone.add(mesh); mesh.castShadow = true; return mesh; };
  for (const [ha, side] of [[haL, 1], [haR, -1]]) { att(ha, M(GEO.sphLo, o.glove || skin, 0.075, 0.085, 0.07, 0, -0.04, 0.01)); att(ha, M(GEO.sphLo, o.glove || skin, 0.03, 0.05, 0.03, side * 0.06, -0.02, 0.04)); }
  for (const ft of [ftL, ftR]) { att(ft, M(GEO.sph, boot, 0.085, 0.07, 0.15, 0, -0.03, 0.055)); att(ft, M(GEO.cyl, boot, 0.072, 0.16, 0.075, 0, 0.06, 0)); att(ft, M(GEO.box, '#2b1d14', 0.16, 0.03, 0.27, 0, -0.085, 0.05)); }
  if (o.vest) att(chest, M(GEO.sph, o.vest, 0.255 * st, 0.21, 0.215, 0, 0.07, 0.006));
  if (o.apron) att(spine, M(GEO.box, o.apron, 0.34, 0.5, 0.05, 0, 0.0, 0.19));
  att(chest, M(GEO.sph, o.scarf || '#c8443a', 0.16, 0.06, 0.15, 0, 0.27, 0.03));
  const holster = att(hips, M(GEO.box, '#4a2e1c', 0.08, 0.18, 0.12, -0.24 * st, -0.07, 0.02));
  if (o.badge) att(chest, M(GEO.cyl, '#e9c46a', 0.04, 0.02, 0.04, 0.12, 0.1, 0.2, { emissive: '#7a5a10' })).rotation.x = Math.PI / 2;
  // head
  const hd = new THREE.Group(); head.add(hd);
  hd.add(M(GEO.sph, skin, 0.3, 0.29, 0.28, 0, 0.24, 0));
  const eyes = []; for (const ex of [-0.1, 0.1]) { const e = new THREE.Group(); e.position.set(ex, 0.28, 0.25); e.add(M(GEO.sphLo, '#1b1b1b', 0.045, 0.06, 0.03)); e.add(M(GEO.sphLo, '#ffffff', 0.015, 0.015, 0.01, 0.015, 0.02, 0.025)); hd.add(e); eyes.push(e); }
  const brows = []; for (const ex of [-0.1, 0.1]) { const b = M(GEO.box, o.hair || '#5b3b26', 0.09, 0.022, 0.02, ex, 0.37, 0.27); hd.add(b); brows.push(b); }
  hd.add(M(GEO.sphLo, o.nose || skin, 0.055, 0.05, 0.05, 0, 0.21, 0.28));
  for (const ex of [-1, 1]) hd.add(M(GEO.sphLo, skin, 0.04, 0.06, 0.03, ex * 0.29, 0.24, 0));
  const mouth = M(GEO.box, '#7a3b2a', 0.07, 0.014, 0.01, 0, 0.12, 0.275); hd.add(mouth);
  if (o.beard) hd.add(M(GEO.sph, o.beard, 0.24, 0.14, 0.18, 0, 0.08, 0.12));
  if (o.mustache) hd.add(M(GEO.box, o.mustache, 0.16, 0.035, 0.04, 0, 0.16, 0.28));
  let hair = null; if (o.hair) { hd.add(M(GEO.sph, o.hair, 0.31, 0.2, 0.29, 0, 0.36, -0.03)); if (o.longHair) { hair = new THREE.Group(); hair.position.set(0, 0.36, -0.06); hair.add(M(GEO.sph, o.hair, 0.315, 0.27, 0.27, 0, -0.12, -0.03)); hair.add(M(GEO.sph, o.hair, 0.12, 0.16, 0.11, 0, -0.33, -0.2)); hd.add(hair); } }
  const hat = new THREE.Group(); hat.position.y = 0.46; hd.add(hat);
  if (o.hat !== false) { const hc = o.hatColor || '#6b4a2f'; hat.add(M(GEO.cyl, hc, 0.48, 0.035, 0.46, 0, 0, 0)); const cr = M(GEO.cyl, hc, 0.24, 0.22, 0.22, 0, 0.11, 0); cr.geometry = new THREE.CylinderGeometry(0.8, 1, 1, 14); hat.add(cr); hat.add(M(GEO.cyl, o.band || '#2b1d14', 0.245, 0.05, 0.225, 0, 0.03, 0)); if (o.hatTilt) hat.rotation.z = o.hatTilt; }
  return { root, vis, skel, parts, hips, spine, chest, neck, head: hd, headBone: head, hat, hair, mouth, eyes, brows, L: { sh: shL, el: elL, hand: haL }, R: { sh: shR, el: elR, hand: haR }, LL: { hp: hpL, kn: knL, ft: ftL }, RL: { hp: hpR, kn: knR, ft: ftR }, scale: s, legLen: 0.6 * s, baseHatZ: o.hatTilt || 0 };
}

/* ---------- authored gait cycles (phase 0 = left heel strike; values for the LEFT leg) ---------- */
const GAIT = {
  walk: { th: [-0.42, -0.3, -0.02, 0.22, 0.36, 0.12, -0.22, -0.44], kn: [0.06, 0.28, 0.1, 0.12, 0.5, 1.0, 0.7, 0.12], ft: [-0.24, 0.04, 0.05, -0.08, 0.42, 0.22, -0.05, -0.2], bob: 0.022, bobOff: 0.25, arm: 0.52, el: 0.32, lean: 0.05, twist: 0.12, sway: 0.035, flight: 1.0 },
  jog: { th: [-0.55, -0.38, -0.05, 0.32, 0.48, 0.1, -0.4, -0.62], kn: [0.2, 0.55, 0.35, 0.3, 0.95, 1.65, 1.2, 0.35], ft: [-0.12, 0.1, 0.08, 0.0, 0.55, 0.35, -0.05, -0.15], bob: 0.045, bobOff: 0.4, arm: 0.72, el: 1.25, lean: 0.14, twist: 0.18, sway: 0.02, flight: 1.55 },
  run: { th: [-0.78, -0.52, -0.05, 0.45, 0.62, 0.1, -0.62, -0.88], kn: [0.25, 0.65, 0.45, 0.4, 1.2, 2.05, 1.6, 0.45], ft: [-0.06, 0.12, 0.1, 0.05, 0.65, 0.4, -0.05, -0.1], bob: 0.06, bobOff: 0.42, arm: 1.0, el: 1.45, lean: 0.3, twist: 0.22, sway: 0.012, flight: 2.0 },
  sneak: { th: [-0.35, -0.25, -0.02, 0.15, 0.28, 0.1, -0.18, -0.36], kn: [0.25, 0.4, 0.3, 0.28, 0.6, 1.1, 0.8, 0.3], ft: [-0.2, 0.0, 0.05, -0.05, 0.35, 0.2, -0.05, -0.18], bob: 0.012, bobOff: 0.25, arm: 0.2, el: 0.6, lean: 0.1, twist: 0.06, sway: 0.03, flight: 1.0 },
};
function cyc(keys, ph) { // Catmull-Rom over a cyclic key list
  const n = keys.length, f = ((ph % 1) + 1) % 1 * n, i = Math.floor(f), t = f - i; const p0 = keys[(i - 1 + n) % n], p1 = keys[i], p2 = keys[(i + 1) % n], p3 = keys[(i + 2) % n];
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}
for (const g of Object.values(GAIT)) { const mn = Math.min(...g.th), mx = Math.max(...g.th); g.stride = 2 * 0.58 * (Math.sin(-mn) + Math.sin(mx)) * g.flight; }
function gaitWeights(speed, crouch) {
  if (crouch) return [['sneak', 1]];
  if (speed <= 1.7) return [['walk', 1]]; if (speed <= 3.9) { const t = (speed - 1.7) / 2.2; return [['walk', 1 - t], ['jog', t]]; }
  const t = clamp((speed - 3.9) / 2.9, 0, 1); return [['jog', 1 - t], ['run', t]];
}
class Spring { constructor(k = 120, c = 12) { this.k = k; this.c = c; this.x = 0; this.v = 0; } step(target, dt) { this.v += (-(this.x - target) * this.k - this.v * this.c) * dt; this.x += this.v * dt; return this.x; } }

/* Animator: base state + layered overlays + one-shot clips, all blended toward a target pose */
class Animator {
  constructor(rig, owner) { this.rig = rig; this.owner = owner; this.cur = zeroPose(); this.tgt = zeroPose(); this.phase = 0; this.t = 0; this.actions = []; this.layers = { aim: 0, carry: 0, block: 0, rifle: 0 }; this.lw = { aim: 0, carry: 0, block: 0, rifle: 0 }; this.sq = 1; this.sqv = 0; this.blink = 2; this.expr = 'calm'; this.look = 0; this.lookPitch = 0; this.lookAt = null; this.idleT = 0; this.lastSpeed = 0; this.accel = 0; this.moveW = 0; this.hatS = new Spring(90, 9); this.hatZ = new Spring(90, 9); this.hairS = new Spring(60, 6); this.prevYaw = owner.yaw || 0; this.turnRate = 0; this.talkT = 0; }
  play(name, o = {}) { const def = ACTIONS[name]; if (!def) return null; if (o.replace !== false) this.actions = this.actions.filter(a => a.def.mask !== def.mask && !(def.mask === 'full')); const a = { name, def, t: 0, age: 0, dur: o.dur || def.dur, cb: o.on || {}, fired: new Set(), loop: o.loop || def.loop, done: false, speed: o.speed || 1, k: o.k ?? 1 }; this.actions.push(a); return a; }
  stop(name) { for (const a of this.actions) if (!name || a.name === name) { a.loop = false; a.t = Math.max(a.t, a.dur - 0.15); a.age = Math.max(a.age, 1); } }
  playing(name) { return this.actions.some(a => a.name === name && !a.done); }
  busy() { return this.actions.some(a => a.def.mask === 'full' && !a.done && !a.def.nobusy); }
  squash(v) { this.sqv += v; }
  locomotion(T, st, dt) {
    const sp = st.speed, ws = gaitWeights(sp, st.crouch); let stride = 0; for (const [g, w] of ws) stride += GAIT[g].stride * w; stride *= this.rig.scale;
    // phase advances with distance travelled (stride-matched => no foot sliding); turning in place also steps the feet
    const turnStep = Math.abs(this.turnRate) > 1.2 && sp < 0.6 ? Math.abs(this.turnRate) * 0.12 : 0;
    const prev = this.phase; this.phase += (sp / Math.max(0.3, stride) + turnStep) * dt;
    if (Math.floor(prev * 2) !== Math.floor(this.phase * 2) && st.state === 'ground' && this.owner.onStep && (sp > 0.3 || turnStep)) this.owner.onStep();
    const mw = this.moveW = damp(this.moveW, clamp(Math.max(sp / 1.2, turnStep * 3), 0, 1), 10, dt), ph = this.phase;
    const P = (key, off) => { let v = 0; for (const [g, w] of ws) v += cyc(GAIT[g][key], ph + off) * w; return v; }, Q = key => { let v = 0; for (const [g, w] of ws) v += GAIT[g][key] * w; return v; };
    const thL = P('th', 0), thR = P('th', 0.5);
    T.lHipX = lerp(T.lHipX, thL, mw); T.rHipX = lerp(T.rHipX, thR, mw);
    T.lKnX = lerp(T.lKnX, P('kn', 0), mw); T.rKnX = lerp(T.rKnX, P('kn', 0.5), mw);
    T.lFtX = lerp(T.lFtX, P('ft', 0), mw); T.rFtX = lerp(T.rFtX, P('ft', 0.5), mw);
    const arm = Q('arm'), el = Q('el');
    T.lShX = lerp(T.lShX, -thR * arm * 1.3, mw); T.rShX = lerp(T.rShX, -thL * arm * 1.3, mw);
    T.lElX = lerp(T.lElX, -el - Math.max(0, thR) * 0.4, mw); T.rElX = lerp(T.rElX, -el - Math.max(0, thL) * 0.4, mw);
    T.lShZ = lerp(T.lShZ, 0.12, mw); T.rShZ = lerp(T.rShZ, 0.12, mw);
    const bob = Q('bob') * Math.cos(TAU * 2 * (ph - Q('bobOff'))); T.hipY += bob * mw - (st.crouch ? 0 : 0.012 * mw);
    const tw = Math.sin(TAU * (ph + 0.25)) * Q('twist'); T.hipYaw = lerp(T.hipYaw, tw, mw); T.spY = lerp(T.spY, -tw * 1.1, mw);
    T.hipZ = lerp(T.hipZ, Math.sin(TAU * ph) * Q('sway'), mw);
    T.spX += Q('lean') * mw + clamp(this.accel * 0.025, -0.25, 0.25); T.hdX -= Q('lean') * 0.6 * mw;
    T.roll = clamp(-(this.turnRate) * 0.035 * sp, -0.24, 0.24);
    return { thL, thR, mw };
  }
  update(dt, st) {
    // st: {state, speed, k, vy, crouch, ground fn, ride, turn}
    this.t += dt; const T = this.tgt; for (const k of POSE_KEYS) T[k] = 0; const t = this.t; const r = this.owner;
    this.turnRate = damp(this.turnRate, angDiff(this.prevYaw, r.yaw) / Math.max(dt, 1e-4), 10, dt); this.prevYaw = r.yaw;
    this.accel = damp(this.accel, (st.speed - this.lastSpeed) / Math.max(dt, 1e-4), 8, dt); this.lastSpeed = st.speed;
    let loco = null;
    switch (st.state) {
      case 'ground': {
        // idle: breathing, slow weight shift, occasional glance
        const shift = Math.sin(t * 0.55); T.hipY = 0.006 * Math.sin(t * 2.1) - 0.01; T.spX = 0.03 + 0.015 * Math.sin(t * 2.1); T.hipZ = 0.03 * shift; T.spZ = -0.02 * shift;
        T.lKnX = 0.08 + Math.max(0, -shift) * 0.12; T.rKnX = 0.08 + Math.max(0, shift) * 0.12; T.lHipX = -0.04 - Math.max(0, -shift) * 0.05; T.rHipX = -0.04 - Math.max(0, shift) * 0.05; T.lHipZ = T.rHipZ = 0.04;
        T.lShZ = T.rShZ = 0.11; T.lElX = T.rElX = -0.18; T.lShX = T.rShX = 0.03; T.hdY = 0.18 * Math.sin(t * 0.37);
        loco = this.locomotion(T, st, dt);
        if (st.crouch) { T.hipY -= 0.2; T.lHipX -= 0.6; T.rHipX -= 0.6; T.lKnX += 1.0; T.rKnX += 1.0; T.spX += 0.4; T.hdX -= 0.3; T.lShX -= 0.35; T.rShX -= 0.35; T.lElX -= 0.5; T.rElX -= 0.5; }
        if (st.tired) { T.spX += 0.2; T.hdX += 0.12; T.lShX = lerp(T.lShX, 0.1, 0.5); }
        // idle fidget
        if (st.speed < 0.1 && !st.crouch && !this.busy()) { this.idleT += dt; if (this.idleT > 9 && this.owner.isPlayer) { this.idleT = 0; this.play(pick(['tip', 'stretch', 'lookAround'])); } } else this.idleT = 0;
        break; }
      case 'air': { const up = st.vy > 0, near = st.vy < -2 && st.fallH !== undefined && st.fallH < 1.2; T.lHipX = up ? -0.75 : near ? -0.45 : -0.3; T.lKnX = up ? 1.25 : near ? 0.35 : 0.55; T.rHipX = up ? 0.3 : near ? -0.2 : 0.15; T.rKnX = up ? 0.55 : 0.3; T.lFtX = 0.3; T.rFtX = 0.4;
        T.lShZ = T.rShZ = up ? 0.45 : 0.85 + 0.25 * Math.sin(t * 16); T.lShX = T.rShX = up ? -0.7 : -0.25; T.lElX = T.rElX = -0.5; T.spX = up ? 0.15 : -0.08; T.hdX = up ? -0.18 : 0.08; break; }
      case 'swim': { T.tilt = 1.25; const sp = this.t * (st.speed > 0.3 ? 5 : 2); T.lShX = -2.2 + Math.sin(sp) * 1.1; T.rShX = -2.2 + Math.sin(sp) * 1.1; T.lShZ = T.rShZ = 0.6 + Math.cos(sp) * 0.6; T.lHipX = 0.2 + Math.sin(sp * 1.5) * 0.35; T.rHipX = 0.2 - Math.sin(sp * 1.5) * 0.35; T.lKnX = T.rKnX = 0.4; T.lFtX = T.rFtX = 0.6; T.hdX = -1.05; break; }
      case 'ride': { const R2 = st.ride || {}; T.hipY = -0.05 + (R2.bounce || 0) * 0.5; T.lHipX = T.rHipX = -1.35; T.lHipZ = T.rHipZ = 0.42; T.lKnX = T.rKnX = 1.45; T.lFtX = T.rFtX = -0.25; T.spX = 0.08 + (R2.lean || 0) * 0.25 - (R2.bounce || 0) * 0.3; T.lShX = T.rShX = -0.6 - (R2.lean || 0) * 0.2; T.lElX = T.rElX = -1.0; T.lShZ = T.rShZ = 0.12; T.hdX = -T.spX * 0.6; T.roll = (R2.roll || 0); T.hipYaw = 0; break; }
      case 'sit': T.hipY = -0.24; T.lHipX = T.rHipX = -1.5; T.lKnX = T.rKnX = 1.5; T.lShX = T.rShX = -0.35; T.lElX = T.rElX = -0.9; T.spX = 0.05 + 0.03 * Math.sin(t * 1.3); T.hdY = 0.3 * Math.sin(t * 0.3); break;
      case 'lie': T.tilt = -1.5; T.hipY = -0.42; T.lShZ = T.rShZ = 0.25; T.hdY = 0.4; T.spX = 0.02 * Math.sin(t); break;
      case 'down': T.tilt = -1.52; T.hipY = -0.48; T.lShZ = 1.2; T.rShZ = 0.9; T.lHipZ = 0.3; T.rKnX = 0.6; T.hdY = 0.6; T.lFtX = T.rFtX = 0.4; break;
      case 'handsup': T.lShX = T.rShX = -2.75; T.lShZ = T.rShZ = 0.35; T.lElX = T.rElX = -0.5; T.spX = -0.05; T.hdX = 0.05; T.lKnX = T.rKnX = 0.12 + 0.03 * Math.sin(t * 9); break;
      case 'work': T.spX = 0.35 + 0.05 * Math.sin(t * 3); T.lShX = -0.9 + 0.3 * Math.sin(t * 5); T.rShX = -0.9 + 0.3 * Math.sin(t * 5 + 2); T.lElX = T.rElX = -0.6; T.hdX = 0.2; T.lKnX = T.rKnX = 0.12; break;
      case 'chat': { this.talkT += dt; T.rShX = -0.5 + 0.3 * Math.sin(t * 3); T.rElX = -1.1; T.rShZ = 0.3 + 0.2 * Math.sin(t * 2.3); T.hdY = 0.1 * Math.sin(t * 1.7); T.hdX = 0.05 * Math.sin(t * 2.9); T.spY = 0.05 * Math.sin(t); T.lShZ = 0.12; T.lElX = -0.2; T.lKnX = 0.1; T.rKnX = 0.06; break; }
    }
    // overlay layers (upper body), smoothly weighted
    for (const k in this.layers) this.lw[k] = damp(this.lw[k], this.layers[k], 12, dt);
    const ov = (w, f) => { if (w < 0.01) return; const P = f(); for (const k in P) T[k] = lerp(T[k], P[k], w); };
    ov(this.lw.carry, () => ({ lShX: -0.95, rShX: -0.95, lElX: -0.75, rElX: -0.75, lShZ: 0.12, rShZ: 0.12, spX: T.spX * 0.4 - 0.1, spY: T.spY * 0.3 }));
    ov(this.lw.block, () => ({ lShX: -1.6, rShX: -1.6, lElX: -1.8, rElX: -1.8, lShZ: -0.25, rShZ: -0.25, spX: 0.18, hdX: 0.12, spY: 0 }));
    ov(this.lw.aim, () => { const p = -this.lookPitch; if (this.lw.rifle > 0.5) return { rShX: -1.5 + p, rElX: -0.7, rShZ: 0.15, lShX: -1.35 + p, lElX: -0.35, lShZ: -0.35, spY: 0.35 + T.spY * 0.2, hdY: -0.3, hdX: -p * 0.6 }; return { rShX: -1.55 + p, rElX: -0.05, rShZ: -0.05, lShX: -0.3, lElX: -0.6, lShZ: 0.15, spY: 0.1 + T.spY * 0.2, hdX: -p * 0.6 }; });
    // one-shot clips
    for (const a of this.actions) {
      if (a.done) continue; a.t += dt * a.speed; a.age += dt * a.speed; let u = a.t / a.dur;
      if (u >= 1) { if (a.loop) { a.t -= a.dur; a.fired.clear(); u = a.t / a.dur; } else { a.done = true; if (a.cb.end) a.cb.end(); continue; } }
      for (const ev in a.def.ev || {}) { if (!a.fired.has(ev) && u >= a.def.ev[ev]) { a.fired.add(ev); if (a.cb[ev]) a.cb[ev](); } }
      const bi = a.def.bi ?? 0.12, bo = a.def.bo ?? 0.15; const w = a.loop ? Math.min(1, a.age / bi) : Math.min(1, a.age / bi, (a.dur - a.t) / bo);
      const P = a.def.fn(u, T, this, a.k); const ww = ease(clamp(w, 0, 1));
      for (const k in P) T[k] = a.def.add ? T[k] + P[k] * ww : lerp(T[k], P[k], ww);
    }
    this.actions = this.actions.filter(a => !a.done);
    // two-bone leg IK on uneven ground: stance feet stay on the terrain, pelvis drops to reach the lower foot
    if (st.state === 'ground' && st.ground && !st.crouch) {
      const yaw = r.yaw, cs = Math.cos(yaw), sn = Math.sin(yaw), base = r.pos.y, sc = this.rig.scale, L = 0.58 * sc, f = fwd(yaw);
      const footAt = (side, th) => { const off = Math.sin(-th) * L; return { x: r.pos.x + cs * 0.115 * sc * side + f.x * off, z: r.pos.z - sn * 0.115 * sc * side + f.z * off }; };
      const pl = footAt(1, T.lHipX), pr = footAt(-1, T.rHipX);
      const gl = st.ground(pl.x, pl.z, base + 0.5) - base, gr = st.ground(pr.x, pr.z, base + 0.5) - base;
      const stance = p => { p = ((p % 1) + 1) % 1; return p < 0.5 ? 1 - smoothstep(0.42, 0.56, p) : smoothstep(0.9, 1.0, p); }; const moving = loco ? loco.mw : 0; const stL = lerp(1, stance(this.phase), moving), stR = lerp(1, stance(this.phase + 0.5), moving);
      const drop = clamp(-Math.min(gl * stL + (1 - stL) * 0.2, gr * stR + (1 - stR) * 0.2, 0), 0, 0.32); T.hipY -= drop;
      const a = 0.27, b = 0.31, ik = sh => { const Ln = clamp(a + b - sh, 0.25, a + b - 0.001); const kn = Math.PI - Math.acos(clamp((a * a + b * b - Ln * Ln) / (2 * a * b), -1, 1)); const hp = Math.acos(clamp((a * a + Ln * Ln - b * b) / (2 * a * Ln), -1, 1)); return [kn, hp]; };
      const [kl, hl] = ik(clamp(gl + drop, 0, 0.35) / sc), [kr, hr] = ik(clamp(gr + drop, 0, 0.35) / sc);
      T.lKnX += kl * stL; T.lHipX -= hl * stL; T.rKnX += kr * stR; T.rHipX -= hr * stR;
      // align stance feet with the slope
      const slope = Math.atan2(st.ground(r.pos.x + f.x * 0.4, r.pos.z + f.z * 0.4, base + 0.5) - st.ground(r.pos.x - f.x * 0.4, r.pos.z - f.z * 0.4, base + 0.5), 0.8);
      T.lFtX -= slope * stL; T.rFtX -= slope * stR;
    }
    // look-at (head turns toward a point of interest, clamped)
    if (this.lookAt && st.state !== 'swim') { const a = angDiff(r.yaw, Math.atan2(this.lookAt.x - r.pos.x, this.lookAt.z - r.pos.z)); if (Math.abs(a) < 1.9) { T.hdY += clamp(a, -1.0, 1.0) * 0.8; T.spY += clamp(a, -1, 1) * 0.2; } }
    // smooth toward target (state transitions blend)
    const rate = st.blendRate || 14; const C = this.cur; for (const k of POSE_KEYS) C[k] = damp(C[k], T[k], rate, dt);
    // squash & stretch spring
    const acc = -160 * (this.sq - 1) - 14 * this.sqv; this.sqv += acc * dt; this.sq += this.sqv * dt; this.sq = clamp(this.sq, 0.72, 1.28);
    // secondary motion: hat & hair lag behind acceleration and turning
    const R = this.rig; R.hat.rotation.x = this.hatS.step(clamp(-this.accel * 0.012 + (st.vy || 0) * -0.01, -0.3, 0.3), dt); R.hat.rotation.z = R.baseHatZ + this.hatZ.step(clamp(this.turnRate * 0.03, -0.2, 0.2), dt);
    if (R.hair) R.hair.rotation.x = this.hairS.step(clamp(st.speed * 0.06 + (st.vy || 0) * -0.02, -0.2, 0.6), dt);
    // face: blink, expressions, talking mouth
    this.blink -= dt; let ey = 1; if (this.blink < 0) { ey = 0.12; if (this.blink < -0.12) this.blink = rand(1.8, 4.5); }
    const big = this.expr === 'alarm' ? 1.35 : 1; for (const e of R.eyes) e.scale.set(big, ey * big, 1);
    const brow = this.expr === 'angry' ? 0.35 : this.expr === 'alarm' ? -0.1 : this.expr === 'sad' ? -0.3 : 0; R.brows[0].rotation.z = brow; R.brows[1].rotation.z = -brow; R.brows[0].position.y = R.brows[1].position.y = 0.37 + (this.expr === 'alarm' ? 0.03 : 0);
    R.mouth.scale.y = (this.owner.speech || st.state === 'chat') ? 1 + Math.abs(Math.sin(t * 14)) * 4 : this.expr === 'alarm' ? 3 : 1;
    this.apply();
  }
  apply() {
    const R = this.rig, C = this.cur;
    R.hips.position.y = 0.64 + C.hipY; R.hips.rotation.set(C.tilt + C.hipX, C.hipYaw, C.hipZ); R.vis.rotation.z = C.roll;
    R.vis.scale.set(R.scale / Math.sqrt(this.sq), R.scale * this.sq, R.scale / Math.sqrt(this.sq));
    R.spine.rotation.set(C.spX * 0.55, C.spY * 0.5, C.spZ * 0.5); R.chest.rotation.set(C.spX * 0.45, C.spY * 0.5, C.spZ * 0.5);
    R.neck.rotation.set(C.hdX * 0.4, (C.hdY + this.look) * 0.4, 0); R.headBone.rotation.set(C.hdX * 0.6, (C.hdY + this.look) * 0.6, 0);
    R.L.sh.rotation.set(C.lShX, 0, C.lShZ); R.L.el.rotation.x = C.lElX; R.R.sh.rotation.set(C.rShX, 0, -C.rShZ); R.R.el.rotation.x = C.rElX;
    R.LL.hp.rotation.set(C.lHipX - C.hipX * 0.6, 0, C.lHipZ); R.LL.kn.rotation.x = C.lKnX; R.LL.ft.rotation.x = C.lFtX - (C.hipX * 0.4 + C.lHipX + C.lKnX); R.RL.hp.rotation.set(C.rHipX - C.hipX * 0.6, 0, -C.rHipZ); R.RL.kn.rotation.x = C.rKnX; R.RL.ft.rotation.x = C.rFtX - (C.hipX * 0.4 + C.rHipX + C.rKnX);
  }
}

/* One-shot / looped actions: fn(u) returns partial pose (u in 0..1). ev: normalized event times. */
const ACTIONS = {
  jumpPrep: { dur: 0.1, mask: 'full', bi: 0.02, bo: 0.02, nobusy: true, fn: u => ({ hipY: -0.12, lKnX: 0.7, rKnX: 0.7, lHipX: -0.45, rHipX: -0.45, spX: 0.3, lShX: 0.4, rShX: 0.4, lShZ: 0.3, rShZ: 0.3 }) },
  land: { dur: 0.32, mask: 'full', bi: 0.02, bo: 0.2, nobusy: true, fn: (u, T, an, k) => { const d = Math.sin(Math.min(1, u * 1.6) * Math.PI) * k; return { hipY: T.hipY - 0.16 * d, lKnX: T.lKnX + 0.8 * d, rKnX: T.rKnX + 0.8 * d, lHipX: T.lHipX - 0.45 * d, rHipX: T.rHipX - 0.45 * d, spX: T.spX + 0.35 * d, lShZ: 0.35 * d + 0.1, rShZ: 0.35 * d + 0.1, hdX: -0.2 * d }; } },
  skid: { dur: 0.4, mask: 'full', bi: 0.05, nobusy: true, add: true, fn: u => { const d = Math.sin(u * Math.PI); return { spX: -0.3 * d, lHipX: -0.35 * d, rHipX: 0.1 * d, lKnX: 0.25 * d, rKnX: 0.4 * d, lShZ: 0.3 * d, rShZ: 0.3 * d, hipY: -0.05 * d }; } },
  hitB: { dur: 0.42, mask: 'full', bi: 0.03, add: true, fn: u => { const k = Math.sin(u * Math.PI); return { spX: 0.5 * k, hdX: 0.3 * k, lShX: -0.4 * k, rShX: -0.4 * k, hipY: -0.04 * k }; } },
  stretch: { dur: 2.0, mask: 'upper', fn: u => { const k = Math.sin(u * Math.PI); return { lShX: -2.6 * k, rShX: -2.6 * k, lElX: -0.4, rElX: -0.4, lShZ: 0.3 * k, rShZ: 0.3 * k, spX: -0.15 * k, hdX: -0.25 * k }; } },
  lookAround: { dur: 2.4, mask: 'upper', fn: u => ({ hdY: Math.sin(u * TAU) * 0.9, spY: Math.sin(u * TAU) * 0.25, hdX: -0.05 }) },
  pickup: { dur: 0.9, mask: 'full', ev: { grab: 0.45 }, fn: u => { const k = Math.sin(u * Math.PI); return { hipY: -0.3 * k, spX: 0.9 * k, lHipX: -0.7 * k, rHipX: -0.5 * k, lKnX: 1.1 * k, rKnX: 0.9 * k, rShX: -1.4 * k, rElX: -0.2, hdX: 0.2 * k }; } },
  search: { dur: 0.8, mask: 'full', loop: true, fn: u => ({ spX: 0.55, hipY: -0.08, lShX: -1.2 + 0.35 * Math.sin(u * TAU * 2), rShX: -1.2 + 0.35 * Math.sin(u * TAU * 2 + 2), lElX: -0.7, rElX: -0.7, hdX: 0.35, lKnX: 0.25, rKnX: 0.25, lHipX: -0.2, rHipX: -0.2 }) },
  kneel: { dur: 0.8, mask: 'full', loop: true, fn: u => ({ hipY: -0.32, lHipX: -1.3, lKnX: 1.5, rHipX: 0.3, rKnX: 1.7, spX: 0.6, lShX: -1.1 + 0.4 * Math.sin(u * TAU * 2), rShX: -1.1 + 0.4 * Math.sin(u * TAU * 2 + 1.5), lElX: -0.5, rElX: -0.5, hdX: 0.4 }) },
  eat: { dur: 1.4, mask: 'upper', ev: { bite: 0.5 }, fn: u => { const k = Math.min(1, Math.sin(u * Math.PI) * 1.6); return { rShX: -1.4 * k, rElX: -2.2 * k, rShZ: -0.35 * k, hdX: -0.1 * k + 0.08 * Math.sin(u * 30) * k }; } },
  door: { dur: 0.55, mask: 'upper', ev: { push: 0.4 }, fn: u => { const k = Math.sin(u * Math.PI); return { rShX: -1.45 * k, rElX: -0.3, spX: 0.15 * k }; } },
  punch: { dur: 0.45, mask: 'full', ev: { hit: 0.38 }, bi: 0.05, fn: u => { const w = u < 0.3 ? u / 0.3 : 1 - (u - 0.3) / 0.7; const st = u < 0.3 ? -1 : 1; return { rShX: st < 0 ? -0.5 : -1.6, rElX: st < 0 ? -2.0 : -0.1, spY: st < 0 ? 0.45 * w : -0.55 * w, spX: 0.2, lShX: -1.2, lElX: -1.6, lHipX: -0.35, rHipX: 0.3, lKnX: 0.3, hipY: -0.06 }; } },
  hook: { dur: 0.5, mask: 'full', ev: { hit: 0.4 }, bi: 0.05, fn: u => { const st = u < 0.33; return { lShX: st ? -0.6 : -1.5, lShZ: st ? 0.9 : 0.1, lElX: -1.4, spY: st ? -0.5 : 0.6, spX: 0.2, rShX: -1.2, rElX: -1.6, rHipX: -0.35, lHipX: 0.3, hipY: -0.05 }; } },
  uppercut: { dur: 0.6, mask: 'full', ev: { hit: 0.45 }, bi: 0.05, fn: u => { const st = u < 0.38; return { rShX: st ? 0.2 : -2.3, rElX: st ? -1.8 : -1.2, hipY: st ? -0.18 : 0.04, spX: st ? 0.5 : -0.2, lKnX: st ? 0.8 : 0.1, rKnX: st ? 0.8 : 0.1, lHipX: st ? -0.6 : 0, lShX: -1.2, lElX: -1.6 }; } },
  dodge: { dur: 0.55, mask: 'full', bi: 0.04, fn: u => ({ tilt: u * TAU * 0.98, hipY: -0.3 * Math.sin(u * Math.PI), lHipX: -1.6, rHipX: -1.6, lKnX: 2, rKnX: 2, lShX: -1.4, rShX: -1.4, lElX: -1.5, rElX: -1.5, spX: 0.6 }), },
  hit: { dur: 0.42, mask: 'full', bi: 0.03, add: true, fn: u => { const k = Math.sin(u * Math.PI); return { spX: -0.55 * k, hdX: -0.4 * k, lShZ: 0.5 * k, rShZ: 0.5 * k, hipY: -0.05 * k }; } },
  recoil: { dur: 0.25, mask: 'upper', bi: 0.02, add: true, fn: u => { const k = Math.sin(u * Math.PI); return { rShX: -0.45 * k, lShX: -0.2 * k, spX: -0.08 * k }; } },
  reload: { dur: 1.2, mask: 'upper', ev: { done: 0.85 }, fn: u => ({ rShX: -0.7, rElX: -1.3, lShX: -0.8 + 0.2 * Math.sin(u * 20), lElX: -1.4, hdX: 0.4, rShZ: -0.2, lShZ: -0.2 }) },
  mount: { dur: 0.8, mask: 'full', ev: { up: 0.5 }, fn: u => ({ lHipX: u < 0.5 ? -1.6 : -1.3, lKnX: 1.5, rHipX: u < 0.5 ? 0.2 : -1.3, rHipZ: u > 0.4 ? 0.5 : 0, rKnX: 1.2, lShX: -1.8, rShX: -1.6, lElX: -0.6, rElX: -0.6, spX: 0.3 }) },
  greet: { dur: 1.2, mask: 'upper', fn: u => ({ rShX: -2.6, rShZ: 0.5 + 0.35 * Math.sin(u * 22), rElX: -0.5, hdY: 0.0, hdX: -0.05 }) },
  tip: { dur: 0.9, mask: 'upper', fn: u => ({ rShX: -2.4, rElX: -2.0, rShZ: 0.3, hdX: 0.15 * Math.sin(u * Math.PI) }) },
  taunt: { dur: 1.1, mask: 'upper', fn: u => ({ rShX: -1.6, rElX: -0.2 - 0.6 * Math.abs(Math.sin(u * 16)), lShX: 0.1, lShZ: 0.5, lElX: -1.8, spX: 0.2, hdX: -0.15 }) },
  brush: { dur: 0.7, mask: 'upper', loop: true, fn: u => ({ rShX: -1.3 + 0.4 * Math.sin(u * TAU), rElX: -0.6, rShZ: 0.2 + 0.35 * Math.sin(u * TAU), spX: 0.15 }) },
  feed: { dur: 1.3, mask: 'upper', ev: { give: 0.55 }, fn: u => { const k = Math.sin(u * Math.PI); return { rShX: -1.3 * k, rElX: -0.3, spX: 0.25 * k, hdX: 0.2 * k }; } },
  pat: { dur: 1.0, mask: 'upper', fn: u => ({ rShX: -1.6, rElX: -0.6 + 0.25 * Math.sin(u * 18), spX: 0.1 }) },
  whistle: { dur: 0.9, mask: 'upper', fn: u => ({ rShX: -2.2, rElX: -2.3, rShZ: -0.4, hdX: -0.15 }) },
  cast: { dur: 1.0, mask: 'upper', ev: { out: 0.55 }, fn: u => ({ rShX: u < 0.45 ? -2.8 : -1.2, rElX: -0.5, lShX: -1.0, lElX: -0.8, spX: u < 0.45 ? -0.2 : 0.25 }) },
  reel: { dur: 0.5, mask: 'upper', loop: true, fn: u => ({ rShX: -1.1, rElX: -0.8, lShX: -1.2 + 0.25 * Math.sin(u * TAU), lElX: -1.2, spX: 0.1 }) },
  climb: { dur: 0.75, mask: 'full', ev: { top: 0.7 }, fn: u => { const a = u < 0.4; return { lShX: a ? -2.8 : -1.0, rShX: a ? -2.8 : -1.0, lElX: a ? -0.4 : -1.6, rElX: a ? -0.4 : -1.6, lHipX: a ? -0.2 : -1.6, lKnX: a ? 0.3 : 1.9, rHipX: a ? 0.1 : -0.8, rKnX: a ? 0.6 : 1.3, spX: a ? -0.1 : 0.7, hipY: a ? 0 : -0.15 }; } },
  dig: { dur: 0.9, mask: 'full', loop: true, ev: { scoop: 0.6 }, fn: u => ({ spX: 0.5 + 0.3 * Math.sin(u * TAU), rShX: -1.5 + 0.6 * Math.sin(u * TAU), lShX: -1.3 + 0.6 * Math.sin(u * TAU), rElX: -0.4, lElX: -0.4, lKnX: 0.4, rKnX: 0.4, lHipX: -0.3, rHipX: -0.3, hipY: -0.06 }) },
  standup: { dur: 1.0, mask: 'full', fn: u => ({ tilt: -1.5 * (1 - u), hipY: -0.45 * (1 - u), lKnX: 1.2 * Math.sin(u * Math.PI), rKnX: 1.2 * Math.sin(u * Math.PI), spX: 0.6 * Math.sin(u * Math.PI) }) },
  shove: { dur: 0.5, mask: 'upper', ev: { hit: 0.4 }, fn: u => { const k = Math.sin(u * Math.PI); return { lShX: -1.5 * k, rShX: -1.5 * k, lElX: -0.3, rElX: -0.3, spX: 0.3 * k }; } },
};

/* ---------- Quadrupeds (horse, deer, wolf, rabbit) ---------- */
// sculpted quadrupeds: overlapping rounded forms on the same joint hierarchy the animator drives (body, neck, head,
// tail, two-part legs), so gaits, grazing, rearing and lying down all still work
const QGEO = {
  taperUp: new THREE.CylinderGeometry(0.6, 1, 1, 14),          // narrow top: necks, tails' docks
  taperDown: new THREE.CylinderGeometry(1, 0.55, 1, 12),        // wide top: upper legs
  hair: new THREE.CylinderGeometry(0.3, 1, 1, 10),              // flared tail hair
  hoof: new THREE.CylinderGeometry(0.78, 1, 1, 10),
  snout: new THREE.CylinderGeometry(0.62, 1, 1, 14).rotateX(Math.PI / 2), // along +z, narrowing toward the muzzle
  ear: new THREE.ConeGeometry(1, 1, 8),
  lock: new THREE.BoxGeometry(1, 1, 1).translate(0, -0.5, 0),     // a lock of mane hair hanging from its top
};
let GRAD8 = null; const _animalMats = {};
function animalMat(c) { if (!GRAD8) { GRAD8 = new THREE.DataTexture(new Uint8Array([105, 140, 170, 195, 215, 232, 246, 255]), 8, 1, THREE.LuminanceFormat); GRAD8.minFilter = GRAD8.magFilter = THREE.LinearFilter; GRAD8.needsUpdate = true; }
  return _animalMats[c] || (_animalMats[c] = new THREE.MeshToonMaterial({ color: c, gradientMap: GRAD8 })); }
/* a smooth lofted tube: elliptical rings along a centreline in the y-z plane, capped at both ends. Each section is
   [y, z, rx, ry] with rx the half-width (x) and ry the half-depth across the centreline. One continuous surface reads as
   an animal's body far better than overlapping balls. */
function loftGeo(secs, seg = 18) {
  const pos = [], idx = [], n = secs.length, tan = new THREE.Vector3(), up = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i < n; i++) {
    const a = secs[Math.max(0, i - 1)], b = secs[Math.min(n - 1, i + 1)]; tan.set(0, b[0] - a[0], b[1] - a[1]).normalize(); up.crossVectors(tan, X);
    const [y, z, rx, ry] = secs[i];
    for (let k = 0; k < seg; k++) { const th = k / seg * TAU, c = Math.cos(th), sn = Math.sin(th); pos.push(c * rx, y + up.y * sn * ry, z + up.z * sn * ry); }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < seg; k++) { const a = i * seg + k, b = i * seg + (k + 1) % seg, c2 = a + seg, d = b + seg; idx.push(a, c2, b, b, c2, d); }
  const c0 = pos.length / 3; pos.push(0, secs[0][0], secs[0][1]); const c1 = c0 + 1; pos.push(0, secs[n - 1][0], secs[n - 1][1]);
  for (let k = 0; k < seg; k++) { const k1 = (k + 1) % seg; idx.push(c0, k1, k); idx.push(c1, (n - 1) * seg + k, (n - 1) * seg + k1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  // keep the winding outward whichever way the centreline runs
  const m = Math.floor(n / 2) * seg, nr = g.attributes.normal;
  if (pos[m * 3] * nr.getX(m) < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  return g;
}
/* body plans per species, in units of the rig's dims (z along the body in bl, half-width in bw, half-depth in bh) */
const QSHAPE = {
  horse: { torso: [[-1.02, 0.12, 0.1, 0.12], [-0.94, 0.16, 0.62, 0.62], [-0.72, 0.12, 0.98, 0.95], [-0.42, 0.04, 1.0, 0.98], [0, -0.02, 1.0, 1.02], [0.4, 0.04, 0.92, 1.0], [0.74, 0.12, 0.76, 0.92], [0.96, 0.08, 0.5, 0.66], [1.06, 0.02, 0.1, 0.14]],
    neck: [[-0.18, 0.08, 0.5, 0.95], [0.1, 0, 0.44, 0.78], [0.45, -0.04, 0.34, 0.55], [0.85, -0.04, 0.27, 0.4], [1.02, -0.02, 0.22, 0.3], [1.1, -0.02, 0.05, 0.08]],
    head: [[-0.3, 0.06, 0.12, 0.14], [-0.2, 0.02, 0.27, 0.3], [-0.02, -0.06, 0.32, 0.4], [0.25, -0.02, 0.26, 0.3], [0.62, -0.06, 0.2, 0.22], [0.95, -0.1, 0.19, 0.21], [1.1, -0.12, 0.14, 0.15], [1.16, -0.12, 0.04, 0.05]] },
  deer: { torso: [[-1.02, 0.12, 0.1, 0.12], [-0.92, 0.12, 0.7, 0.72], [-0.6, 0.08, 1.0, 0.96], [-0.2, 0, 0.98, 0.92], [0.2, -0.04, 0.96, 1.0], [0.6, 0.04, 0.86, 0.96], [0.92, 0.08, 0.56, 0.7], [1.04, 0.04, 0.1, 0.14]],
    neck: [[-0.15, 0.06, 0.48, 0.7], [0.2, 0, 0.4, 0.55], [0.6, -0.02, 0.32, 0.42], [0.95, 0, 0.28, 0.34], [1.06, 0, 0.06, 0.08]],
    head: [[-0.28, 0.06, 0.14, 0.16], [-0.18, 0.04, 0.34, 0.36], [0.05, 0, 0.36, 0.38], [0.4, -0.04, 0.26, 0.26], [0.78, -0.08, 0.17, 0.17], [0.94, -0.08, 0.12, 0.12], [1.0, -0.08, 0.03, 0.03]] },
  wolf: { torso: [[-1.02, 0.1, 0.1, 0.12], [-0.92, 0.1, 0.66, 0.66], [-0.6, 0.06, 0.88, 0.8], [-0.2, 0.04, 0.84, 0.78], [0.2, 0, 0.94, 0.98], [0.56, -0.04, 1.02, 1.12], [0.86, 0.02, 0.88, 1.0], [1.04, 0.06, 0.5, 0.6], [1.12, 0.06, 0.1, 0.12]],
    neck: [[-0.3, 0.04, 0.9, 1.1], [0.2, 0, 0.82, 0.95], [0.7, 0, 0.66, 0.74], [1.05, 0, 0.5, 0.56], [1.15, 0, 0.1, 0.12]],
    head: [[-0.3, 0.04, 0.16, 0.18], [-0.2, 0.06, 0.42, 0.38], [0.05, 0.04, 0.46, 0.4], [0.32, -0.02, 0.3, 0.26], [0.65, -0.06, 0.18, 0.16], [0.92, -0.06, 0.13, 0.12], [1.0, -0.06, 0.04, 0.04]] },
};
const _loftCache = {};
function quadLoft(t, part, dims) { const k = t + part; if (_loftCache[k]) return _loftCache[k];
  const sh = QSHAPE[t][part], { bl, bw, bh } = dims, h = dims.head;
  const secs = part === 'torso' ? sh.map(([z, y, rx, ry]) => [y * bh, z * bl, rx * bw, ry * bh])
    : part === 'neck' ? sh.map(([y, z, rx, ry]) => { const f = bw * (t === 'horse' ? 0.95 : t === 'deer' ? 0.75 : 0.62); return [y * dims.neck, z * dims.neck, rx * f * 0.8, ry * f]; })
    : sh.map(([z, y, rx, ry]) => [y * h, z * h, rx * h, ry * h]);
  return _loftCache[k] = loftGeo(secs, part === 'neck' ? 18 : 20); }
function legLoft(t, dims, front, part) { const k = t + 'leg' + front + part; if (_loftCache[k]) return _loftCache[k];
  const { bw, bh } = dims, ul = dims.leg * 0.5 + bh * 0.25, ll = dims.leg * 0.5, w = t === 'wolf' ? 1.15 : 1;
  const secs = part === 'up' ? (front ? [[0.2 * bw, 0, 0.3 * bw, 0.5 * bw], [0, 0.02, 0.32 * bw, 0.5 * bw], [-ul * 0.45, 0.02, 0.24 * bw, 0.34 * bw], [-ul * 0.85, 0, 0.15 * bw * w, 0.19 * bw * w], [-ul * 1.02, 0, 0.12 * bw * w, 0.14 * bw * w]]
                                      : [[0.25 * bw, 0, 0.36 * bw, 0.62 * bw], [0, -0.02, 0.38 * bw, 0.62 * bw], [-ul * 0.45, -0.04, 0.27 * bw, 0.42 * bw], [-ul * 0.85, -0.02, 0.14 * bw * w, 0.22 * bw * w], [-ul * 1.02, -0.03, 0.11 * bw * w, 0.16 * bw * w]])
    : [[0.04, 0, 0.12 * bw * w, 0.15 * bw * w], [-ll * 0.12, 0, 0.1 * bw * w, 0.13 * bw * w], [-ll * 0.5, 0, 0.08 * bw * w, 0.1 * bw * w], [-ll * 0.82, 0.01, 0.1 * bw * w, 0.12 * bw * w], [-ll * 0.92, 0.015, 0.085 * bw * w, 0.1 * bw * w], [-ll * 0.98, 0.02, 0.06 * bw, 0.07 * bw]];
  return _loftCache[k] = loftGeo(secs, 14); }
function makeQuad(o) {
  if (AnimalAssets.has(o.type)) return makeModelQuad(o); // an uploaded model replaces the code-built body (03c_animals.js)
  const t = o.type, s = o.scale || 1; const col = o.color, dark = o.dark || '#3a2a20';
  const dims = { horse: { bl: 1.0, bw: 0.42, bh: 0.48, leg: 0.95, neck: 0.8, head: 0.52 }, deer: { bl: 0.7, bw: 0.28, bh: 0.32, leg: 0.82, neck: 0.6, head: 0.32 }, wolf: { bl: 0.62, bw: 0.24, bh: 0.28, leg: 0.52, neck: 0.32, head: 0.3 }, rabbit: { bl: 0.2, bw: 0.15, bh: 0.15, leg: 0.12, neck: 0.05, head: 0.14 } }[t];
  const { bl, bw, bh } = dims, h = dims.head, R = mulberry((col.charCodeAt(1) || 7) * 31 + bl * 100);
  const shade = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
  const Q = c => animalMat(c); // soft shading so the smooth bodies read as rounded, not faceted
  const L = (geo, c) => new THREE.Mesh(geo, Q(c));
  const root = new THREE.Group(); const vis = new THREE.Group(); vis.scale.setScalar(s); root.add(vis);
  const body = new THREE.Group(); body.position.y = dims.leg + bh * 0.6; vis.add(body);
  // torso: one smooth lofted body, rump to chest, with a pale belly and a ruff on the wolf
  if (t === 'rabbit') body.add(M(GEO.sph, Q(col), bw, bh, bl));
  else {
    body.add(L(quadLoft(t, 'torso', dims), col));
    if (o.belly) body.add(M(GEO.sph, Q(o.belly), bw * 0.8, bh * 0.5, bl * 0.62, 0, -bh * 0.55, 0.05 * bl));
    if (t === 'wolf') body.add(M(GEO.sph, Q(o.belly || shade(col, 1.15)), bw * 0.8, bh * 0.85, bl * 0.28, 0, -bh * 0.12, bl * 0.86)); // chest ruff
  }
  // neck: deep at the base, slim at the throat
  const neck = new THREE.Group(); neck.position.set(0, bh * 0.42, bl * 0.74); body.add(neck); const pose = { horse: [0.62, 0.38, 1.45, -0.7], deer: [0.32, 0.62, 1.65, -0.8], wolf: [1.15, -0.95, 0.85, 0.6], rabbit: [-0.55, 1.15, 1.6, 0.2] }[t]; neck.rotation.x = pose[0]; /* the neck rises forward from the chest */
  if (t !== 'rabbit') neck.add(L(quadLoft(t, 'neck', dims), col));
  // head: a lofted skull, broad at the jowl and tapering to the muzzle, with nostrils, eyes and ears
  const head = new THREE.Group(); head.position.y = dims.neck; neck.add(head); head.rotation.x = pose[1];
  if (t === 'rabbit') { head.add(M(GEO.sph, Q(col), h * 0.5, h * 0.55, h * 0.6, 0, 0, h * 0.2)); }
  else {
    head.add(L(quadLoft(t, 'head', dims), col));
    const tip = QSHAPE[t].head[QSHAPE[t].head.length - 2], tz = tip[0] * h, ty = tip[1] * h;
    head.add(M(GEO.sph, Q(o.muzzle || shade(col, 0.82)), tip[2] * h * 1.05, tip[3] * h * 1.05, h * 0.14, 0, ty, tz - h * 0.04));
    if (t === 'wolf') head.add(M(GEO.sph, Q('#151515'), h * 0.09, h * 0.08, h * 0.08, 0, ty + h * 0.03, tz + h * 0.06)); // nose
    else for (const ex of [-1, 1]) head.add(M(GEO.sphLo, Q('#1a1410'), h * 0.04, h * 0.05, h * 0.04, ex * h * 0.11, ty + h * 0.02, tz + h * 0.06)); // nostrils
  }
  for (const ex of [-1, 1]) {
    const ew = t === 'rabbit' ? 0.34 : t === 'wolf' ? 0.36 : t === 'deer' ? 0.3 : 0.27;
    head.add(M(GEO.sphLo, Q('#151515'), h * 0.07, h * 0.08, h * 0.07, ex * h * ew, h * 0.1, h * 0.08)); head.add(M(GEO.sphLo, Q('#ffffff'), h * 0.025, h * 0.025, h * 0.02, ex * h * (ew + 0.04), h * 0.13, h * 0.12)); // eye and glint
    const ear = M(QGEO.ear, Q(col), h * (t === 'rabbit' ? 0.14 : t === 'wolf' ? 0.13 : 0.1), h * (t === 'rabbit' ? 1.3 : t === 'wolf' ? 0.4 : t === 'deer' ? 0.5 : 0.36), h * 0.06, ex * h * (t === 'deer' ? 0.3 : 0.17), h * (t === 'rabbit' ? 0.9 : t === 'deer' ? 0.36 : 0.42), -h * 0.2);
    ear.rotation.z = -ex * (t === 'deer' ? 0.9 : 0.2); ear.rotation.x = -0.25; head.add(ear);
  }
  if (o.antlers) for (const ex of [-1, 1]) { const beam = new THREE.Group(); beam.position.set(ex * h * 0.16, h * 0.36, -h * 0.12); beam.rotation.z = -ex * 0.45; beam.rotation.x = -0.35; head.add(beam);
    beam.add(M(GEO.cyl, Q('#e2d3b0'), 0.022, 0.42, 0.022, 0, 0.21, 0)); for (const [y, a] of [[0.14, 0.9], [0.27, 0.7], [0.38, 0.5]]) { const tine = M(GEO.cone, Q('#e8dcc0'), 0.016, 0.16, 0.016, 0, y + 0.06, 0.05); tine.rotation.x = a; beam.add(tine); } }
  if (o.mane) { // a crest of hair locks down the back of the neck, and a forelock
    for (let i = 0; i < 11; i++) { const f = i / 10, l = M(QGEO.lock, Q(o.mane), 0.06, 0.14 + R() * 0.1, 0.12, (R() - 0.5) * 0.03, f * dims.neck * 1.02 - 0.02, -bw * 0.62 * (0.85 - f * 0.55) * 0.95); l.rotation.set(-0.35 + R() * 0.2, 0, (R() - 0.5) * 0.5); neck.add(l); }
    const fl = M(QGEO.lock, Q(o.mane), 0.09, 0.16, 0.05, 0, h * 0.34, h * 0.0); fl.rotation.x = 0.5; head.add(fl);
  }
  if (o.blaze) { const bz = M(GEO.box, Q('#f4f0e6'), h * 0.1, h * 0.03, h * 0.9, 0, h * 0.2, h * 0.5); bz.rotation.x = 0.12; head.add(bz); }
  // tail
  const tail = new THREE.Group(); tail.position.set(0, bh * 0.38, -bl * 0.95); body.add(tail);
  const tlen = t === 'horse' ? 0.85 : t === 'wolf' ? 0.55 : t === 'deer' ? 0.16 : 0.08;
  if (t === 'rabbit') tail.add(M(GEO.sph, Q(o.tail || col), 0.07, 0.07, 0.07, 0, -0.04, 0));
  else if (t === 'horse') { tail.add(M(QGEO.taperUp, Q(o.tail || col), 0.07, 0.2, 0.08, 0, -0.08, 0)); tail.add(M(QGEO.hair, Q(o.tail || col), 0.12, tlen, 0.09, 0, -tlen / 2 - 0.12, -0.02)); }
  else if (t === 'wolf') { tail.add(M(QGEO.hair, Q(o.tail || col), 0.11, tlen, 0.11, 0, -tlen / 2, 0)); tail.add(M(GEO.sph, Q('#2a2622'), 0.07, 0.1, 0.07, 0, -tlen + 0.02, 0)); }
  else { tail.add(M(GEO.sph, Q(o.tail || col), 0.07, tlen * 0.6, 0.05, 0, -tlen / 2, 0)); }
  tail.rotation.x = t === 'wolf' ? 0.55 : t === 'horse' ? 0.3 : -0.6;
  // legs: muscled upper leg, knee, slim cannon, fetlock, hoof (paws for the wolf)
  const legs = [];
  for (const [lx, lz, front] of [[1, 1, 1], [-1, 1, 1], [1, -1, 0], [-1, -1, 0]]) {
    const up = new THREE.Group(); up.position.set(lx * bw * 0.56, -bh * 0.35, lz * bl * 0.62); body.add(up);
    const ul = dims.leg * 0.5 + bh * 0.25, ll = dims.leg * 0.5, lower = o.sock || col;
    if (t === 'rabbit') { up.add(M(GEO.cyl, Q(col), bw * 0.3, ul, bw * 0.3, 0, -ul / 2, 0)); } else up.add(L(legLoft(t, dims, front, 'up'), col));
    const lo = new THREE.Group(); lo.position.y = -ul; up.add(lo);
    if (t === 'rabbit') lo.add(M(GEO.cyl, Q(lower), bw * 0.12, ll, bw * 0.12, 0, -ll / 2, 0)); else lo.add(L(legLoft(t, dims, front, 'lo'), lower));
    if (t === 'wolf') lo.add(M(GEO.sph, Q(shade(lower, 0.8)), bw * 0.15, bw * 0.09, bw * 0.22, 0, -ll, 0.03)); // paw
    else if (t !== 'rabbit') lo.add(M(QGEO.hoof, Q(dark), bw * 0.13, 0.09 * (t === 'deer' ? 0.7 : 1), bw * 0.15, 0, -ll - 0.01, 0.02));
    legs.push({ up, lo, front, side: lx });
  }
  let saddle = null, seat = new THREE.Object3D(); seat.position.set(0, bh + 0.02, 0.05); body.add(seat);
  if (t === 'horse') { saddle = new THREE.Group();
    saddle.add(M(GEO.box, Q('#b23a2e'), 0.92, 0.04, 0.62, 0, bh * 0.83, 0)); saddle.add(M(GEO.box, Q('#e8d9b0'), 0.94, 0.02, 0.64, 0, bh * 0.81, 0)); // blanket with a pale edge
    saddle.add(M(GEO.sph, Q('#6b3b1f'), 0.34, 0.1, 0.4, 0, bh * 0.93, 0)); saddle.add(M(GEO.sph, Q('#5a3218'), 0.24, 0.1, 0.08, 0, bh * 1.0, -0.3)); // seat and cantle
    saddle.add(M(GEO.cyl, Q('#4a2a14'), 0.035, 0.12, 0.035, 0, bh * 1.05, 0.3)); // horn
    for (const ex of [-1, 1]) { saddle.add(M(GEO.box, Q('#5a361c'), 0.03, 0.42, 0.05, ex * 0.4, bh * 0.55, 0.05)); saddle.add(M(GEO.box, Q('#3a2a1a'), 0.1, 0.03, 0.12, ex * 0.42, bh * 0.33, 0.05)); saddle.add(M(GEO.box, Q('#5a361c'), 0.12, 0.26, 0.28, ex * 0.46, bh * 0.4, -0.36)); } // stirrups and saddlebags
    body.add(saddle); }
  root.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; } });
  return { root, vis, body, neck, head, tail, legs, seat, saddle, dims, type: t, scale: s, baseNeck: neck.rotation.x, baseHead: head.rotation.x, grazeNeck: pose[2], grazeHead: pose[3], baseTail: tail.rotation.x };
}
const GAITS = { // phase offsets LF, RF, LH, RH ; stride (m per cycle); amp; bob
  walk: { off: [0.25, 0.75, 0, 0.5], stride: 1.5, amp: 0.38, bob: 0.025, bend: 0.6 },
  trot: { off: [0, 0.5, 0.5, 0], stride: 2.3, amp: 0.5, bob: 0.06, bend: 0.9 },
  canter: { off: [0.35, 0.5, 0, 0.35], stride: 3.4, amp: 0.7, bob: 0.09, bend: 1.1 },
  gallop: { off: [0.5, 0.6, 0, 0.1], stride: 5.2, amp: 0.95, bob: 0.12, bend: 1.3 },
  hop: { off: [0, 0, 0.1, 0.1], stride: 0.9, amp: 0.8, bob: 0.12, bend: 1.2 },
};
class QuadAnimator {
  constructor(rig, owner) { this.rig = rig; this.owner = owner; this.phase = 0; this.t = 0; this.legA = [0, 0, 0, 0]; this.legB = [0, 0, 0, 0]; this.bob = 0; this.pitch = 0; this.neckX = rig.baseNeck; this.headX = rig.baseHead; this.lie = 0; this.rear = 0; this.dead = 0; this.lastBeat = 0; }
  update(dt, st) {
    if (this.rig.isModel) return quadModelUpdate(this, dt, st);
    // st: {speed, gait, graze(0..1), lie(0..1), rear(0..1), dead(0..1), slope, alert}
    this.t += dt; const R = this.rig, g = GAITS[st.gait || 'walk'], sp = st.speed;
    const moveW = clamp(sp / 0.8, 0, 1); const prev = this.phase; this.phase += sp * dt / (g.stride * R.scale);
    if (Math.floor(prev * 2) !== Math.floor(this.phase * 2) && this.owner.onStep && moveW > 0.3) this.owner.onStep();
    for (let i = 0; i < 4; i++) {
      const ph = (this.phase + g.off[i]) * TAU, l = R.legs[i];
      const a = -Math.sin(ph) * g.amp * moveW, b = (l.front ? 1 : -1) * g.bend * Math.max(0, Math.cos(ph)) * moveW;
      this.legA[i] = damp(this.legA[i], lerp(a, l.front ? -1.4 : 1.4, this.lie) + this.rear * (l.front ? -1.2 : 0.3), 14, dt); this.legB[i] = damp(this.legB[i], lerp(b, l.front ? 2.4 : -2.4, this.lie) + this.rear * (l.front ? 1.4 : 0), 14, dt);
      l.up.rotation.x = this.legA[i]; l.lo.rotation.x = this.legB[i];
    }
    this.lie = damp(this.lie, st.lie || 0, 3, dt); this.rear = damp(this.rear, st.rear || 0, 6, dt); this.dead = damp(this.dead, st.dead || 0, 4, dt);
    const bobT = (g === GAITS.trot ? Math.abs(Math.sin(this.phase * TAU * 2)) : Math.sin(this.phase * TAU)) * g.bob * moveW;
    R.body.position.y = R.dims.leg * (1 - this.lie * 0.75) + R.dims.bh * 0.6 + bobT - this.dead * R.dims.leg * 0.6;
    const rock = (st.gait === 'canter' || st.gait === 'gallop' || st.gait === 'hop') ? Math.sin(this.phase * TAU) * 0.08 * moveW : 0;
    this.pitch = damp(this.pitch, (st.slope || 0) - this.rear * 0.9 + rock, 8, dt); R.body.rotation.x = this.pitch;
    R.vis.rotation.z = damp(R.vis.rotation.z, this.dead * 1.45 + (st.roll || 0), 5, dt);
    const nodd = Math.sin(this.phase * TAU * (g === GAITS.walk ? 2 : 1)) * 0.08 * moveW;
    this.neckX = damp(this.neckX, R.baseNeck + (st.graze || 0) * R.grazeNeck - (st.alert ? 0.35 : 0) + nodd + this.rear * -0.5, 6, dt); R.neck.rotation.x = this.neckX;
    this.headX = damp(this.headX, R.baseHead + (st.graze || 0) * R.grazeHead + 0.04 * Math.sin(this.t * 1.7), 6, dt); R.head.rotation.x = this.headX;
    R.neck.rotation.y = damp(R.neck.rotation.y, st.lookYaw || 0, 4, dt);
    R.tail.rotation.x = R.baseTail + 0.25 * moveW + 0.06 * Math.sin(this.t * 3); R.tail.rotation.z = 0.15 * Math.sin(this.t * 2.3);
  }
}
