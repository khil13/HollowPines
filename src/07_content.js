/* ===== Sky, time & weather ===== */
const Sky = {
  RATE: 1 / 50, weather: 'clear', wet: 0, cloud: 0,
  init(scene) {
    this.hemi = new THREE.HemisphereLight(0xcfe3f0, 0x6b5a3a, 0.6); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 1.0); this.sun.castShadow = true; const sc = this.sun.shadow.camera; sc.left = sc.bottom = -38; sc.right = sc.top = 38; sc.near = 1; sc.far = 160; this.sun.shadow.mapSize.set(1024, 1024); this.sun.shadow.bias = -0.0006; scene.add(this.sun); scene.add(this.sun.target);
    this.amb = new THREE.AmbientLight(0xffffff, 0.15); scene.add(this.amb);
    this.sunM = new THREE.Mesh(GEO.sph, new THREE.MeshBasicMaterial({ color: 0xffe6a8, fog: false })); this.sunM.scale.setScalar(9); scene.add(this.sunM);
    this.moonM = new THREE.Mesh(GEO.sph, new THREE.MeshBasicMaterial({ color: 0xe8eef5, fog: false })); this.moonM.scale.setScalar(6); scene.add(this.moonM);
    const sg = new THREE.BufferGeometry(), sp = []; for (let i = 0; i < 700; i++) { const a = rand(0, TAU), b = rand(0.08, 1.4); sp.push(Math.cos(a) * Math.cos(b) * 400, Math.sin(b) * 400, Math.sin(a) * Math.cos(b) * 400); } sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, fog: false })); scene.add(this.stars);
    this.clouds = new THREE.Group(); scene.add(this.clouds); const cm = toon('#ffffff', { transparent: true, opacity: 0.92 });
    for (let i = 0; i < 26; i++) { const g = new THREE.Group(); for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(GEO.sphLo, cm); m.scale.set(rand(6, 11), rand(4, 6), rand(6, 9)); m.position.set(k * 7 - 14 + rand(-2, 2), rand(-1, 2), rand(-3, 3)); g.add(m); } g.position.set(rand(-260, 260), rand(70, 95), rand(-260, 260)); this.clouds.add(g); }
    this.cloudMat = cm;
    const rn = 900, rg = new THREE.BufferGeometry(), rp = new Float32Array(rn * 6); for (let i = 0; i < rn; i++) { const x = rand(-25, 25), y = rand(0, 22), z = rand(-25, 25); rp.set([x, y, z, x + 0.05, y - 0.7, z], i * 6); } rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaecde0, transparent: true, opacity: 0.5 })); this.rain.visible = false; this.rain.frustumCulled = false; scene.add(this.rain);
    scene.fog = new THREE.FogExp2(0xa9cfe0, 0.0034); this.weather = S.weather.kind;
    this.domeU = { top: { value: new THREE.Color('#5fa7d9') }, hor: { value: new THREE.Color('#cfe5ee') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color('#fff2cc') } };
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({ uniforms: this.domeU, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vD; void main(){ float h = clamp(vD.y,-0.2,1.0); vec3 c = mix(hor, top, pow(max(h,0.0),0.55)); float s = max(dot(vD, normalize(sunDir)),0.0); c += sunCol * (pow(s,8.0)*0.25 + pow(s,64.0)*0.5); if (h < 0.0) c = mix(hor, hor*0.85, -h*5.0); gl_FragColor = vec4(c,1.0); }' }));
    this.dome.renderOrder = -1; scene.add(this.dome);
    // low valley mist: a soft noise sheet at a fixed height, so hills rise out of it and hollows fill with it at dawn
    this.mistU = { uOp: { value: 0 }, uCol: { value: new THREE.Color('#e6e8e4') }, uCam: { value: new THREE.Vector3() }, uT: { value: 0 } };
    this.mist = new THREE.Mesh(new THREE.PlaneGeometry(700, 700, 1, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: this.mistU, transparent: true, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform float uOp; uniform vec3 uCol; uniform vec3 uCam; uniform float uT; varying vec3 vW; float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); } float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); } void main(){ vec2 p = vW.xz * 0.018 + vec2(uT * 0.01, uT * 0.004); float m = n(p) * 0.6 + n(p * 2.3) * 0.4; float d = distance(vW.xz, uCam.xz); float a = uOp * smoothstep(0.25, 0.75, m) * smoothstep(14.0, 55.0, d) * (1.0 - smoothstep(260.0, 340.0, d)); gl_FragColor = vec4(uCol, a); }' }));
    this.mist.renderOrder = 2; this.mist.frustumCulled = false; scene.add(this.mist);
    // sun glare: a soft additive halo that blooms when you look toward a low sun
    const gc = document.createElement('canvas'); gc.width = gc.height = 128; const gg = gc.getContext('2d'), gr = gg.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,240,210,1)'); gr.addColorStop(0.25, 'rgba(255,200,140,0.45)'); gr.addColorStop(1, 'rgba(255,170,90,0)'); gg.fillStyle = gr; gg.fillRect(0, 0, 128, 128);
    this.glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false })); this.glare.scale.setScalar(140); scene.add(this.glare);
  },
  night() { const h = S.time.hour; return h < 5.5 || h > 20.5; },
  raining() { return this.weather === 'rain' || this.weather === 'storm'; },
  visMul() { return { fog: 0.45, storm: 0.6, rain: 0.75, cloudy: 0.95 }[this.weather] || 1; }, // how far people can see in this weather
  advance(hours) { S.time.hour += hours; while (S.time.hour >= 24) { S.time.hour -= 24; S.time.day++; Game.newDay(); } },
  update(dt) {
    this.advance(dt * this.RATE);
    // weather
    S.weather.next -= dt * this.RATE; if (S.weather.next <= 0) { const r = Math.random(), h0 = S.time.hour; const k = r < 0.45 ? 'clear' : r < 0.67 ? 'cloudy' : r < 0.81 ? 'rain' : r < 0.9 ? 'storm' : (h0 > 3 && h0 < 11 ? 'fog' : 'cloudy'); S.weather.kind = k; S.weather.next = rand(3, 8); }
    this.weather = S.weather.kind; const tc = this.weather === 'clear' ? 0 : this.weather === 'cloudy' ? 0.6 : this.weather === 'fog' ? 0.7 : 1; this.cloud = damp(this.cloud, tc, 0.4, dt);
    const raining = this.raining(), storm = this.weather === 'storm', fog = this.weather === 'fog'; this.wet = clamp(this.wet + (raining ? dt * 0.03 : -dt * 0.008), 0, 1);
    if (Math.abs(this.wet - (this._lw || 0)) > 0.04) { this._lw = this.wet; Terrain.setWet(this.wet); }
    const h = S.time.hour; const th = (h - 5.5) / 14.5 * Math.PI; const sy = Math.sin(th), sx = Math.cos(th); // sunrise ~5:30, sunset ~20:00 (night() and the street lamps agree)
    const day = smoothstep(-0.1, 0.22, sy); const dusk = (sy > -0.08 ? 1 - smoothstep(0.02, 0.45, sy) : 0) * (1 - this.cloud * 0.7); this.golden = dusk; // a long golden hour, RDR2-style
    const mist = (smoothstep(4.6, 5.8, h) * (1 - smoothstep(7.4, 9.6, h)) + (raining ? 0.5 : 0) + (fog ? 1.1 : 0)) * (fog ? 1 : 1 - this.cloud * 0.3); this.mistAmt = mist;
    const P = Game.player.pos; this.sun.position.set(P.x + sx * 80, P.y + Math.max(8, sy * 90), P.z + 35); this.sun.target.position.copy(P);
    this.sunM.position.set(Game.cam.pos.x + sx * 350, Game.cam.pos.y + sy * 350, Game.cam.pos.z + 140); this.sunM.visible = sy > -0.1;
    this.moonM.position.set(Game.cam.pos.x - sx * 350, Game.cam.pos.y - sy * 350, Game.cam.pos.z - 120); this.moonM.visible = sy < 0.1;
    this.stars.position.copy(Game.cam.pos); this.stars.material.opacity = (1 - day) * (1 - this.cloud * 0.8);
    const cDay = new THREE.Color('#8fcbea').lerp(new THREE.Color('#9aa7b0'), this.cloud * 0.8), cNight = new THREE.Color('#0a1024'), cDusk = new THREE.Color('#f4a35c');
    const sky = cNight.clone().lerp(cDay, day).lerp(cDusk, dusk * 0.8); const top = new THREE.Color('#0a1024').lerp(new THREE.Color('#4f9ad2').lerp(new THREE.Color('#7f8b94'), this.cloud * 0.8), day).lerp(new THREE.Color('#6a7fb0'), dusk * 0.35);
    const hor = sky.clone().lerp(new THREE.Color('#ffffff'), 0.25 * day * (1 - this.cloud * 0.5)); this.domeU.top.value.copy(top); this.domeU.hor.value.copy(hor); this.domeU.sunDir.value.set(sx, sy, 0.4); this.domeU.sunCol.value.set(dusk > 0.3 ? '#ffb070' : '#fff2cc').multiplyScalar(day * (1 - this.cloud * 0.8));
    this.dome.position.copy(Game.cam.pos); Game.scene.background = hor; Game.scene.fog.color.copy(hor).lerp(new THREE.Color('#9fb6a0'), 0.12 * day).lerp(new THREE.Color('#f0b07a'), dusk * 0.3).lerp(new THREE.Color('#e3e6e2'), mist * 0.5);
    Game.scene.fog.density = (fog ? 0.014 : storm ? 0.011 : raining ? 0.0085 : this.cloud > 0.4 ? 0.0045 : 0.003) + mist * 0.0045 + dusk * 0.0008;
    // thunderstorms: lightning lights up the valley, thunder rolls in a moment later
    this.flash = Math.max(0, (this.flash || 0) - dt * 5); if (storm) { this.boltT = (this.boltT ?? rand(3, 8)) - dt; if (this.boltT <= 0) { this.boltT = rand(6, 14); this.flash = 1; this.bolts = (this.bolts || 0) + 1; setTimeout(() => Sfx.burst(70, 1.8, 0.5, 'lowpass'), rand(400, 1800)); } }
    this.mist.position.set(Game.cam.pos.x, 4.2, Game.cam.pos.z); this.mistU.uCam.value.copy(Game.cam.pos); this.mistU.uT.value += dt; this.mistU.uOp.value = Math.min(0.85, mist * 0.75 + (1 - day) * 0.12); this.mistU.uCol.value.copy(Game.scene.fog.color).lerp(new THREE.Color('#ffffff'), 0.25 * day);
    this.glare.position.copy(this.sunM.position); this.glare.material.opacity = sy > -0.05 ? (0.08 + dusk * 0.4) * (1 - this.cloud * 0.8) : 0; this.glare.scale.setScalar(70 + dusk * 90); WIND.uTime.value += dt; WIND.uStrength.value = damp(WIND.uStrength.value, storm ? 2.8 : raining ? 2.0 : this.cloud > 0.4 ? 1.4 : 1, 0.3, dt);
    // warm low sun and long shadows at golden hour; at night the 'sun' becomes a dim blue moonlight and the world goes properly dark
    this.sun.intensity = day * (1 - this.cloud * 0.55) * (0.95 + dusk * 0.2) + (1 - day) * 0.16; this.sun.color.set('#fff1d6').lerp(new THREE.Color('#ff8a3a'), dusk).lerp(new THREE.Color('#8fa8e0'), 1 - day); if (day < 0.2) this.sun.position.set(P.x - sx * 80, P.y + 60, P.z - 30);
    this.hemi.intensity = 0.13 + day * 0.47; this.hemi.color.set('#3a4a78').lerp(new THREE.Color('#cfe3f0').lerp(new THREE.Color('#ffd2a0'), dusk * 0.55), day); this.hemi.groundColor.set('#1e1a14').lerp(new THREE.Color('#6b5a3a'), day); this.amb.intensity = 0.05 + day * 0.07 + this.flash * 1.4; if (this.flash > 0.05) Game.scene.background = hor.clone().lerp(new THREE.Color('#e8eeff'), this.flash * 0.8);
    this.cloudMat.color.set(raining ? '#8e979e' : '#ffffff'); for (const c of this.clouds.children) { c.position.x += dt * 1.5; if (c.position.x > 280) c.position.x = -280; c.visible = Math.random() < 2 && (c.id % 3 < 1 + this.cloud * 2); }
    this.rain.visible = raining; if (raining) { this.rain.position.set(Game.cam.pos.x, Game.cam.pos.y - 8, Game.cam.pos.z); const a = this.rain.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 6) { a[i + 1] -= dt * 26; a[i + 4] -= dt * 26; if (a[i + 1] < 0) { a[i + 1] += 22; a[i + 4] += 22; } } this.rain.geometry.attributes.position.needsUpdate = true; }
    const lampOn = h > 19 || h < 6.2; for (const l of Game.lamps) l.intensity = lampOn ? 1.15 + (1 - day) * 0.6 : 0; // lanterns matter once it's dark
    // ambience
    Sfx.bed('wind', 0.05 + clamp((P.y - 10) / 30, 0, 0.12) + this.cloud * 0.04); Sfx.bed('rain', storm ? 0.28 : raining ? 0.18 : 0);
    const rd = Math.abs(P.x - riverX(P.z)); Sfx.bed('river', clamp(1 - rd / 30, 0, 1) * 0.12);
    if (this.night() && Math.random() < dt * 1.2 && !raining) Sfx.tone(rand(4200, 4800), 0.04, 0.012, 'sine');
  }
};

/* ===== World population: places, buildings, props, vegetation, containers ===== */
const Containers = []; const Clues = []; const Gather = []; const Pickups = [];
function container(o) {
  // o: id,label,x,z,y,owner,loot:[[id,n]],money,parent mesh (drawer), building
  o.y = o.y ?? Col.ground(o.x, o.z, 99);
  const empty = () => S.containers[o.id] && S.time.day < S.containers[o.id] + (o.restock || 3);
  Interact.add({ pos: () => ({ x: o.x, y: o.y, z: o.z }), r: 1.7, pri: 0.3, opts: p => [{ label: empty() ? `${o.label} (empty)` : `Search ${o.label}`, disabled: empty(), crime: !!o.owner, fn: () => {
    if (empty()) { UI.toast('Nothing left.'); return; } p.yaw = Math.atan2(o.x - p.pos.x, o.z - p.pos.z); if (o.drawer) o.drawer.position.z += 0.25;
    p.anim.play('search', { loop: true }); Sfx.burst(250, 0.4, 0.06);
    setTimeout(() => { p.anim.stop('search'); if (o.drawer) o.drawer.position.z -= 0.25; S.containers[o.id] = S.time.day; let got = 0;
      for (const [id, n] of (o.loot || [])) { if (o.once && S.flags['got_' + id]) continue; Inv.add(id, n); got++; if (o.once) S.flags['got_' + id] = true; }
      if (o.money) { Inv.money(o.money, 'found'); got++; } if (!got) UI.toast('Nothing of use.');
      if (o.owner) Law.crime('theft', p.pos, { value: (o.money || 0) + 2 }); if (o.onLoot) o.onLoot(); Missions.emit('search', { id: o.id }); }, 1300); } }] });
  Containers.push(o); return o;
}
function clue(o) { // investigation clue: examine → evidence + journal
  o.y = o.y ?? Col.ground(o.x, o.z, 99); Clues.push(o);
  if (o.mesh) { o.mesh.position.set(o.x, o.y + (o.my || 0), o.z); Game.scene.add(o.mesh); }
  Interact.add({ pos: () => ({ x: o.x, y: o.y, z: o.z }), r: 1.9, pri: 0.6, on: true, opts: p => (o.when && !o.when()) || S.evidence[o.id] ? [] : [{ label: `Examine ${o.label}`, fn: () => { p.yaw = Math.atan2(o.x - p.pos.x, o.z - p.pos.z); p.anim.play('kneel', { loop: true }); setTimeout(() => { p.anim.stop('kneel'); S.evidence[o.id] = true; journal(o.note, 'evidence'); UI.banner('Clue found', o.label, o.note); if (o.give) Inv.add(o.give); Missions.emit('clue', { id: o.id }); }, 1500); } }] });
  return o;
}
function pickup(o) { // world item pickup with animation; owned items are theft
  const m = o.mesh || M(GEO.box, ITEMS[o.item].col, 0.18, 0.12, 0.25); o.y = o.y ?? Col.ground(o.x, o.z, 99); m.position.set(o.x, o.y + 0.06, o.z); Game.scene.add(m); o.m = m; Pickups.push(o);
  o.it = Interact.add({ pos: () => ({ x: o.x, y: o.y, z: o.z }), r: 1.7, pri: 0.5, opts: p => (o.when && !o.when()) || S.flags['took_' + o.id] ? [] : [{ label: `${o.owner ? 'Steal' : 'Pick up'} ${ITEMS[o.item].name}`, crime: !!o.owner, fn: () => {
    p.yaw = Math.atan2(o.x - p.pos.x, o.z - p.pos.z); p.anim.play('pickup', { on: { grab: () => { p.held.add(m); m.position.set(0, -0.05, 0); m.rotation.set(0, 0, 0); }, end: () => { p.held.remove(m); m.visible = false; S.flags['took_' + o.id] = true; Inv.add(o.item, o.n || 1); Sfx.pickup(); if (o.owner) Law.crime('theft', p.pos, { value: ITEMS[o.item].sell || 2 }); if (o.on) o.on(); } } }); } }] });
  return o;
}
function gatherable(kind, x, z) {
  const y = Terrain.height(x, z); const g = new THREE.Group(); g.position.set(x, y, z); Game.scene.add(g); const id = `${kind}_${Math.round(x)}_${Math.round(z)}`;
  let fruit; if (kind === 'berries') { g.add(M(GEO.ico, '#4f8a3c', 0.7, 0.55, 0.7, 0, 0.45, 0)); fruit = new THREE.Group(); for (let i = 0; i < 9; i++) { const a = i * 2.4; fruit.add(M(GEO.sphLo, '#5b4a9c', 0.07, 0.07, 0.07, Math.cos(a) * 0.55, 0.45 + Math.sin(i) * 0.3, Math.sin(a) * 0.55)); } g.add(fruit); Col.circle(x, z, 0.5, y, y + 1, { block: false }); }
  else { fruit = new THREE.Group(); for (let i = 0; i < 6; i++) { const l = M(GEO.cone, '#7fa7a0', 0.06, 0.5, 0.06, Math.cos(i) * 0.12, 0.25, Math.sin(i) * 0.12); l.rotation.z = Math.cos(i) * 0.3; fruit.add(l); } fruit.add(M(GEO.sphLo, '#6a7fd0', 0.05, 0.05, 0.05, 0, 0.5, 0)); g.add(fruit); }
  const o = { id, kind, x, z, y, fruit }; Gather.push(o);
  Interact.add({ pos: () => ({ x, y, z }), r: 1.6, pri: 0.2, opts: p => (S.gathered[id] && S.time.day < S.gathered[id] + 2) ? [] : [{ label: kind === 'berries' ? 'Pick huckleberries' : 'Pick blue sage', fn: () => { p.yaw = Math.atan2(x - p.pos.x, z - p.pos.z); p.anim.play('pickup', { on: { end: () => { S.gathered[id] = S.time.day; Inv.add(kind, kind === 'berries' ? 2 : 1); Sfx.pickup(); Missions.emit('gather', { kind }); } } }); } }] });
  return o;
}
const DoorSys = {
  update(dt) {
    const P = Game.player;
    for (const d of Doors) { let want = d.open; const near = NPC.all.some(n => n.alive && !n.downed && Math.hypot(n.pos.x - d.x, n.pos.z - d.z) < 1.9); if (near) { want = true; d.autoT = 3; } else if (d.autoT > 0) { d.autoT -= dt; if (d.autoT <= 0 && Math.hypot(P.pos.x - d.x, P.pos.z - d.z) > 2) want = false; }
      d.open = want; d.ang = damp(d.ang, d.open ? (d.side === 'S' ? -1.6 : 1.6) : 0, 8, dt); d.hinge.rotation.y = d.ang; d.col.on = Math.abs(d.ang) < 0.5; }
    // hide roofs when inside
    const inB = inBuilding(P.pos.x, P.pos.z, P.pos.y); for (const b of Buildings) for (const r of b.roofs) r.visible = b !== inB;
    this.inside = inB;
    // trespass in private buildings
    if (inB && inB.private && inB.private()) { this.trT = (this.trT || 0) + dt; const owner = NPC.all.find(n => n.key === inB.owner && n.alive && !n.downed); if (owner && owner.seesPlayer && owner.distP < 14) { if (!this.warned) { this.warned = true; owner.say('Hey! You can\'t be in here. Get out!', 4); owner.anim.expr = 'angry'; this.warnT = 6; } else { this.warnT -= dt; if (this.warnT <= 0) { this.warned = false; Law.crime('trespass', P.pos, { victim: owner }); } } } } else { this.warned = false; }
  },
};
function doorInteract(d) {
  Interact.add({ pos: () => ({ x: d.x, y: d.b.floor, z: d.z }), r: 1.8, pri: 0.1, opts: p => { const locked = d.locked() && !d.open; if (locked) return [{ label: `${d.b.name}: locked`, disabled: true, fn: () => {} }, { label: 'Break in', crime: true, fn: () => { p.anim.play('shove', { on: { hit: () => { Sfx.punch(); d.open = true; d.autoT = 0; Law.crime('breakin', p.pos, { noise: 20 }); } } }); } }];
    return [{ label: d.open ? 'Close door' : 'Open door', fn: () => { p.anim.play('door', { on: { push: () => { d.open = !d.open; d.autoT = 0; Sfx.burst(200, 0.25, 0.08); } } }); } }]; } });
}
function node(id, x, z, adj, vis) { TOWN_NODES[id] = { x, z, adj: adj || [], vis }; }
function link(a, b) { TOWN_NODES[a].adj.push(b); TOWN_NODES[b].adj.push(a); }
function place(id, x, z, yaw, act, o = {}) { PLACES[id] = Object.assign({ x, z, yaw, act }, o); }

const World = {
  build() {
    const sc = Game.scene;
    /* --- Juniper Gap --- */
    const store = building({ x: -58, z: 8, w: 10, d: 8, door: 'S', wall: '#d79a5b', roof: '#8a4b33', sign: 'GENERAL STORE', facade: true, name: 'General store' });
    const saloon = building({ x: -40, z: 7, w: 12, d: 10, door: 'S', wall: '#b9644a', roof: '#5d3a2a', sign: 'THE PINE KNOT', facade: true, name: 'Saloon' });
    const sheriff = building({ x: -22, z: 8, w: 8, d: 7, door: 'S', wall: '#c9b18b', roof: '#4a5a6a', sign: 'SHERIFF', facade: true, name: "Sheriff's office" });
    const maeH = building({ x: -58, z: 34, w: 7, d: 6, door: 'N', wall: '#a8c3a0', roof: '#6b4a3a', name: "Mae's house" });
    const docH = building({ x: -40, z: 34, w: 8, d: 7, door: 'N', wall: '#e6dcc5', roof: '#a33a2e', sign: 'DOCTOR', name: "Doc Pell's" });
    const board = building({ x: -22, z: 34, w: 8, d: 6, door: 'N', wall: '#9fb6c9', roof: '#5a4a3a', name: 'Boarding house' });
    store.door.locked = () => (S.time.hour >= 20 || S.time.hour < 7); store.owner = 'mae'; store.private = () => store.door.locked();
    maeH.owner = 'mae'; maeH.private = () => true; docH.owner = 'doc'; docH.private = () => S.time.hour >= 21 || S.time.hour < 7; board.owner = 'hank'; board.private = () => true;
    for (const b of [store, saloon, sheriff, maeH, docH, board]) doorInteract(b.door);
    const G = (b) => b.g;
    // store interior
    prop(G(store), M(GEO.box, '#7a5232', 6, 1.0, 0.9, 0, 0.85, -1.2), 0, 0, 0); Col.box(-61, -55, 6.35, 7.25, store.y, store.y + 1.35, { block: true });
    for (let i = 0; i < 4; i++) { G(store).add(M(GEO.box, '#6b4226', 2.0, 2.4, 0.5, -3.5 + i * 2.3, 1.55, -3.4)); for (let k = 0; k < 6; k++) G(store).add(M(GEO.cyl, pick(['#c8443a', '#e9c46a', '#4f7ca8', '#9dbf8a']), 0.1, 0.2, 0.1, -4.2 + i * 2.3 + k * 0.28, 1.65 + (k % 2) * 0.6, -3.25)); }
    Col.box(-63, -53, 3.9, 4.9, store.y, store.y + 3.4, { block: true });
    for (const [bx, bz] of [[4.2, 2.6], [-4.2, 2.6]]) prop(G(store), M(GEO.cyl, '#8b5a2b', 0.4, 0.9, 0.4, bx, 0.8, bz), 0, 0, 0.45, 1.3);
    const till = M(GEO.box, '#5a3a20', 0.6, 0.12, 0.4, 1.5, 1.42, -1.2); G(store).add(till);
    container({ id: 'store_till', label: 'cash register', x: -56.5, z: 6.8, y: store.floor, owner: 'mae', money: 14, drawer: till, restock: 2 });
    // saloon
    prop(G(saloon), M(GEO.box, '#5d3a2a', 8, 1.1, 0.9, 0, 0.9, -2.6), 0, 0, 0); Col.box(-44, -36, 4.0, 4.9, saloon.y, saloon.y + 1.45, { block: true });
    G(saloon).add(M(GEO.box, '#3c2a1e', 9, 2.5, 0.4, 0, 1.6, -4.5)); for (let i = 0; i < 10; i++) G(saloon).add(M(GEO.cyl, pick(['#6b8e23', '#8b4513', '#b0c4de']), 0.08, 0.3, 0.08, -3.6 + i * 0.8, 2.05, -4.25));
    for (const tx of [-3, 3]) { prop(G(saloon), M(GEO.cyl, '#7a5232', 0.7, 0.08, 0.7, tx, 1.1, 2), 0, 0, 0.75, 1.2); G(saloon).add(M(GEO.cyl, '#5a3a20', 0.08, 0.75, 0.08, tx, 0.72, 2)); for (const s of [-1, 1]) G(saloon).add(M(GEO.box, '#6b4226', 0.45, 0.45, 0.45, tx + s * 1.0, 0.6, 2)); }
    G(saloon).add(M(GEO.box, '#2b1d14', 1.6, 1.3, 0.6, -5, 1.0, 1)); // piano
    container({ id: 'saloon_till', label: 'bar till', x: -38, z: 3.6, y: saloon.floor, owner: 'cora', money: 11, restock: 2 });
    // sheriff office
    prop(G(sheriff), M(GEO.box, '#6b4226', 2.2, 0.9, 1.0, 0, 0.8, -1.2), 0, 0, 0); Col.box(-23.1, -20.9, 6.3, 7.3, sheriff.y, sheriff.y + 1.25, { block: true });
    for (let i = 0; i < 7; i++) G(sheriff).add(M(GEO.cyl, '#555', 0.03, 2.6, 0.03, 1.4 + i * 0.35, 1.65, -1.8)); Col.box(-20.7, -18.2, 4.6, 6.4, sheriff.y, sheriff.y + 3, { block: true });
    const boardM = M(GEO.box, '#8b6a47', 1.6, 1.1, 0.08, -3.8, 1.9, 0.6); boardM.rotation.y = Math.PI / 2; G(sheriff).add(boardM); for (let i = 0; i < 3; i++) { const pp = M(GEO.box, '#f4ead3', 0.04, 0.4, 0.3, -3.75, 1.9 + (i % 2) * 0.2, 0.2 + i * 0.4); G(sheriff).add(pp); }
    Interact.add({ pos: () => ({ x: -25.5, y: sheriff.floor, z: 8.6 }), r: 1.8, pri: 0.4, opts: p => { const o = []; if (S.bounty > 0) o.push({ label: `Pay bounty ($${S.bounty.toFixed(2)})`, fn: () => Law.payAtOffice() }); const bm = Missions.st('bounty_rook'); if (bm.status === 'available') o.push({ label: 'Read poster: Rook Malloy', fn: () => Dialog.start(null, STORY.posterRook()) }); const so = SIDE.boardOpts(p); o.unshift(...so.filter(x => x.label.startsWith('Turn in'))); o.push(...so.filter(x => !x.label.startsWith("Turn in"))); /* turn-ins first, the story poster before the rotating ones (only three prompts show) */ if (!o.length) o.push({ label: 'Wanted posters (none open)', disabled: true, fn: () => {} }); return o; } });
    container({ id: 'sheriff_cab', label: 'gun cabinet', x: -25, z: 5.2, y: sheriff.floor, owner: 'pike', loot: [['ammo_rev', 12]], restock: 4 });
    // homes
    const bed = (b, lx, lz) => { b.g.add(M(GEO.box, '#6b4226', 1.1, 0.5, 2.1, lx, 0.6, lz)); b.g.add(M(GEO.box, '#c8443a', 1.05, 0.15, 1.5, lx, 0.92, lz + 0.25)); b.g.add(M(GEO.box, '#f4ead3', 0.8, 0.15, 0.4, lx, 0.95, lz - 0.75)); };
    bed(maeH, -2, 1.2); const maeDr = M(GEO.box, '#7a5232', 1.2, 0.9, 0.6, 2.2, 0.8, 2.1); maeH.g.add(maeDr); container({ id: 'mae_drawer', label: 'dresser', x: -55.8, z: 35.6, y: maeH.floor, owner: 'mae', loot: [['watch', 1]], money: 4, restock: 6 });
    bed(docH, -2.5, 1.5); bed(docH, 2.5, 1.5); docH.g.add(M(GEO.box, '#e6e6e6', 1.2, 1.6, 0.5, 0, 1.15, 3)); container({ id: 'doc_cab', label: 'medicine cabinet', x: -40, z: 36.5, y: docH.floor, owner: 'doc', loot: [['tonic', 1]], restock: 3 });
    bed(board, -2.5, 1.2); bed(board, 2.5, 1.2); container({ id: 'board_trunk', label: 'trunk', x: -22, z: 36.2, y: board.floor, owner: 'hank', loot: [['coffee', 1], ['ring', 1]], restock: 8 });
    pickup({ id: 'saloon_watch', item: 'watch', x: -43.3, z: 9.2, y: saloon.floor + 0.75, owner: 'cora' });
    // street dressing
    const well = new THREE.Group(); well.position.set(-40, Terrain.height(-40, 20), 20); sc.add(well); well.add(M(GEO.cyl, '#8d8a83', 1.0, 0.9, 1.0, 0, 0.45, 0)); well.add(M(GEO.cyl, '#4fa8d8', 0.85, 0.05, 0.85, 0, 0.85, 0)); for (const s of [-1, 1]) well.add(M(GEO.box, '#6b4a2f', 0.12, 2.2, 0.12, s * 0.9, 1.1, 0)); well.add(M(GEO.box, '#8a4b33', 2.4, 0.15, 1.4, 0, 2.25, 0)); Col.circle(-40, 20, 1.05, -9, 99, { block: true });
    for (const [x, z] of [[-30, 15], [-50, 25], [-66, 15]]) { const tg = new THREE.Group(); tg.position.set(x, Terrain.height(x, z), z); sc.add(tg); tg.add(M(GEO.box, '#6b4a2f', 2.4, 0.08, 0.1, 0, 1.0, 0)); for (const s of [-1, 1]) tg.add(M(GEO.box, '#6b4a2f', 0.1, 1.0, 0.1, s * 1.1, 0.5, 0)); Col.box(x - 1.2, x + 1.2, z - 0.1, z + 0.1, Terrain.height(x, z) - 1, Terrain.height(x, z) + 1.05, { walk: true, block: true }); }
    for (const [x, z] of [[-28, 26], [-52, 14]]) { const tr = new THREE.Group(); tr.position.set(x, Terrain.height(x, z), z); sc.add(tr); tr.add(M(GEO.box, '#6b4a2f', 2, 0.6, 0.8, 0, 0.3, 0)); tr.add(M(GEO.box, '#4fa8d8', 1.8, 0.05, 0.6, 0, 0.55, 0)); Col.box(x - 1, x + 1, z - 0.4, z + 0.4, Terrain.height(x, z) - 1, Terrain.height(x, z) + 0.62, { walk: true, block: true, cover: true }); }
    for (const x of [-70, -50, -30, -10]) { const lp = new THREE.Group(); lp.position.set(x, Terrain.height(x, 17), 17); sc.add(lp); lp.add(M(GEO.cyl, '#2b2b2b', 0.06, 3, 0.06, 0, 1.5, 0)); lp.add(M(GEO.box, '#ffd27a', 0.3, 0.4, 0.3, 0, 3.1, 0, { emissive: '#ffb84a', emissiveIntensity: 0.6 })); const l = new THREE.PointLight(0xffb867, 0, 12, 2); l.position.set(x, Terrain.height(x, 17) + 3, 17); sc.add(l); Game.lamps.push(l); Col.circle(x, 17, 0.1, Terrain.height(x, 17) - 1, Terrain.height(x, 17) + 3, { block: true }); }
    for (let i = 0; i < 6; i++) { const x = -70 + i * 11, z = i % 2 ? 24 : 16; const cr = new THREE.Group(); cr.position.set(x + 3, Terrain.height(x + 3, z), z); sc.add(cr); cr.add(M(GEO.box, '#a0794f', 0.9, 0.9, 0.9, 0, 0.45, 0)); Col.box(x + 2.55, x + 3.45, z - 0.45, z + 0.45, Terrain.height(x + 3, z) - 1, Terrain.height(x + 3, z) + 0.9, { walk: true, block: true, cover: true }); }
    // town graph
    const sx = [-74, -62, -52, -40, -30, -20, -8, 4]; sx.forEach((x, i) => { node('s' + i, x, x === -40 ? 22.8 : 20); if (i) link('s' + i, 's' + (i - 1)); });
    const doorNodes = (b, tag, streetNode) => { const d = b.door; node(tag + '_o', d.outer.x, d.outer.z, [], (x, z) => !inBuilding(x, z, 99) || true); node(tag + '_i', d.inner.x, d.inner.z, [], (x, z) => inBuilding(x, z, b.y + 0.5) === b); TOWN_NODES[tag + '_o'].vis = (x, z) => inBuilding(x, z, b.y + 0.5) === null; link(tag + '_o', tag + '_i'); link(tag + '_o', streetNode); };
    doorNodes(store, 'store', 's1'); doorNodes(saloon, 'saloon', 's3'); doorNodes(sheriff, 'sheriff', 's5'); doorNodes(maeH, 'maeH', 's1'); doorNodes(docH, 'docH', 's3'); doorNodes(board, 'board', 's5');
    const back = (id, b, x, z) => { node(id, x, z, [], (px, pz) => inBuilding(px, pz, b.y + 0.5) === b); link(id, id.split('_')[0] + '_i'); };
    back('store_back', store, -54.3, 6.2); back('saloon_back', saloon, -35.2, 4.4); back('sheriff_back', sheriff, -24.8, 5.6);
    for (const id in TOWN_NODES) if (!TOWN_NODES[id].vis) TOWN_NODES[id].vis = (x, z) => inBuilding(x, z, 99) === null;
    // places (x,z,yaw,activity)
    place('storeCounter', -58, 5.4, 0, 'work'); place('storeShelf', -60, 5.3, Math.PI, 'work'); place('saloonBar', -40, 3.2, 0, 'work'); place('saloonSeatA', -44, 9, Math.PI / 2, 'sit'); place('saloonSeatB', -36, 9, -Math.PI / 2, 'sit', { clip: 'Sitting_Talking_Loop' }); place('saloonStand', -41.5, 6, Math.PI, 'chat'); place('saloonStand2', -39, 6.2, Math.PI, 'chat');
    place('sheriffDesk', -22, 5.6, 0, 'sit'); place('sheriffPorch', -22, 13.2, 0, 'idle'); place('maeBed', -60, 35.2, Math.PI, 'sleep'); place('docBed', -42.5, 35.5, Math.PI, 'sleep'); place('docDesk', -40, 33, Math.PI, 'work'); place('boardBedA', -24.5, 35.2, Math.PI, 'sleep'); place('boardBedB', -19.5, 35.2, Math.PI, 'sleep');
    place('well', -38.6, 21.5, -Math.PI / 2, 'chat'); place('well2', -41.4, 18.6, Math.PI / 2, 'chat'); place('street', -52, 21, 0, 'idle', { wander: 6 }); place('streetE', -14, 20, 0, 'idle', { wander: 5 }); place('storePorch', -61, 13.4, 0, 'sit'); place('patrolW', -66, 20, 0, 'idle', { wander: 8 }); place('patrolE', -12, 21, 0, 'idle', { wander: 8 });
    store.g.add(M(GEO.box, '#6b4226', 1.6, 0.45, 0.45, -3, 0.55, 5.3)); // porch bench
    /* --- Greer farm --- */
    const farmH = building({ x: -125, z: 88, w: 8, d: 7, door: 'S', wall: '#e0c590', roof: '#7a3b2e', name: 'Greer farmhouse' }); doorInteract(farmH.door); farmH.owner = 'ezra'; farmH.private = () => S.locations.farm === 'occupied' && (S.time.hour >= 21 || S.time.hour < 6) && (S.rel.ezra || 0) < 30;
    bed(farmH, -2, 1.5); container({ id: 'farm_chest', label: 'hope chest', x: -122.5, z: 89.8, y: farmH.floor, owner: null, loot: [['deed', 1]], once: true, restock: 999 });
    const barn = building({ x: -106, z: 82, w: 10, d: 9, door: 'S', wall: '#a3392e', roof: '#5a3a2a', trim: '#f4ead3', name: 'Greer barn', porch: false, lamp: false }); doorInteract(barn.door); this.barn = barn; this.farmH = farmH;
    for (let i = 0; i < 4; i++) { barn.g.add(M(GEO.box, '#e0c068', 1.2, 0.8, 0.9, -3.5 + i * 2.2, 0.75, -3)); Col.box(-106 - 3.5 + i * 2.2 - 0.6, -106 - 3.5 + i * 2.2 + 0.6, 78.6, 79.5, barn.y - 1, barn.y + 1.15, { walk: true, block: true }); }
    for (let r = 0; r < 6; r++) for (let c = 0; c < 10; c++) { const x = -145 + c * 2.2, z = 100 + r * 2.4; const st = new THREE.Group(); st.position.set(x, Terrain.height(x, z), z); sc.add(st); st.add(M(GEO.cyl, '#7fae3e', 0.06, 1.6, 0.06, 0, 0.8, 0)); st.add(M(GEO.cone, '#9bc853', 0.25, 0.9, 0.25, 0, 1.5, 0)); if ((r + c) % 4 === 0) st.add(M(GEO.sph, '#e8833a', 0.32, 0.26, 0.32, 0.5, 0.25, 0)); }
    this.fence(-150, 75, -95, 75); this.fence(-150, 75, -150, 120); this.fence(-150, 120, -95, 120); this.fence(-95, 120, -95, 97); this.fence(-95, 75, -95, 89);
    this.farmBoards = new THREE.Group(); for (const s of [-1, 1]) { const p = M(GEO.box, '#6b4a2f', 1.4, 0.18, 0.1, s * 2.2, 2.0, 3.55); p.rotation.z = s * 0.4; this.farmBoards.add(p); } farmH.g.add(this.farmBoards);
    place('field', -135, 106, 0, 'work', { wander: 8, clip: 'Farm_Harvest' }); place('farmPorch', -127, 92.6, 0, 'sit'); place('farmBed', -127, 89.3, Math.PI, 'sleep'); place('barnWork', -106, 84.5, Math.PI, 'work'); place('farmYard', -115, 95, 0, 'idle', { wander: 6 }); place('farmBed2', -123, 89.3, Math.PI, 'sleep');
    /* --- Coyote Mill (Crane gang) --- */
    const mill = building({ x: 135, z: -85, w: 12, d: 9, door: 'S', wall: '#8d7a63', roof: '#4b3f35', name: 'Coyote Mill', porch: false, lamp: false }); doorInteract(mill.door); this.mill = mill;
    for (const [x, z] of [[124, -73], [147, -72]]) { const t = new THREE.Group(); t.position.set(x, Terrain.height(x, z), z); sc.add(t); const c = M(GEO.cone, '#d9c58f', 2, 2.2, 2, 0, 1.1, 0); c.geometry = new THREE.ConeGeometry(1, 1, 4); t.add(c); Col.circle(x, z, 1.4, Terrain.height(x, z) - 1, Terrain.height(x, z) + 2.2, { block: true, cover: true }); }
    this.campfire(135, -71, true);
    for (const [x, z] of [[128, -68], [142, -67], [131, -78.5], [140, -78], [118, -86]]) { const cr = new THREE.Group(); cr.position.set(x, Terrain.height(x, z), z); sc.add(cr); cr.add(M(GEO.box, '#8b6a47', 1.4, 1.2, 1.0, 0, 0.6, 0)); cr.add(M(GEO.box, '#a0794f', 1.0, 0.8, 0.8, 0.2, 1.6, 0)); Col.box(x - 0.7, x + 0.7, z - 0.5, z + 0.5, Terrain.height(x, z) - 1, Terrain.height(x, z) + 1.2, { walk: true, block: true, cover: true }); }
    const wagon = new THREE.Group(); wagon.position.set(150, Terrain.height(150, -88), -88); sc.add(wagon); wagon.add(M(GEO.box, '#7a5232', 2, 0.9, 3.6, 0, 1.1, 0)); for (const [wx, wz] of [[-1.1, -1.2], [1.1, -1.2], [-1.1, 1.2], [1.1, 1.2]]) { const w = M(GEO.cyl, '#4b3a2a', 0.6, 0.12, 0.6, wx, 0.6, wz); w.rotation.z = Math.PI / 2; wagon.add(w); } Col.box(149, 151, -89.8, -86.2, Terrain.height(150, -88) - 1, Terrain.height(150, -88) + 1.6, { walk: true, block: true, cover: true });
    container({ id: 'mill_crate', label: 'supply crate', x: 141, z: -76.8, loot: [['ammo_rev', 8], ['beans', 1]], restock: 4 });
    container({ id: 'mill_bunk', label: 'bedroll', x: 125.5, z: -74.5, loot: [['coffee', 1]], money: 3, restock: 4 });
    /* --- Hollow Cabin (Eli's camp) --- */
    const cabin = building({ x: -150, z: -85, w: 6, d: 5, door: 'S', wall: '#7d6650', roof: '#4a3b30', name: 'Hollow Cabin', porch: false, lamp: false }); doorInteract(cabin.door);
    cabin.g.add(M(GEO.box, '#6b4226', 1.4, 0.1, 0.9, 1, 0.55, -1)).rotation.z = 1.2; cabin.g.add(M(GEO.box, '#6b4226', 1.0, 0.6, 1.6, -1.6, 0.65, -1.2));
    /* --- Bluecap Cave --- */
    this.cave();
    /* --- Lookout Ridge --- */
    const rx = 150, rz = 140, ry = Terrain.height(rx, rz); const bench = new THREE.Group(); bench.position.set(rx, ry, rz); sc.add(bench); bench.add(M(GEO.box, '#7a5232', 2, 0.12, 0.5, 0, 0.5, 0)); bench.add(M(GEO.box, '#6b4226', 0.12, 0.5, 0.5, -0.9, 0.25, 0)); bench.add(M(GEO.box, '#6b4226', 0.12, 0.5, 0.5, 0.9, 0.25, 0)); bench.add(M(GEO.cyl, '#b0b0b0', 0.08, 0.6, 0.08, 1.8, 1.3, 0)).rotation.x = 1.2; bench.add(M(GEO.cyl, '#6b4226', 0.04, 1.2, 0.04, 1.8, 0.6, 0));
    /* --- Willow Bridge --- */
    const bx = riverX(0); const br = new THREE.Group(); br.position.set(bx, 0, 0); sc.add(br);
    br.add(M(GEO.box, '#8b6a47', 30, 0.3, 4.8, 0, 0.7, 0)); for (let i = -14; i <= 14; i += 2) { br.add(M(GEO.cyl, '#5a3a20', 0.15, 3, 0.15, i, -0.8, 2.3)); br.add(M(GEO.cyl, '#5a3a20', 0.15, 3, 0.15, i, -0.8, -2.3)); br.add(M(GEO.box, '#6b4a2f', 0.12, 1.0, 0.12, i, 1.35, 2.35)); br.add(M(GEO.box, '#6b4a2f', 0.12, 1.0, 0.12, i, 1.35, -2.35)); }
    br.add(M(GEO.box, '#6b4a2f', 30, 0.12, 0.12, 0, 1.8, 2.35)); br.add(M(GEO.box, '#6b4a2f', 30, 0.12, 0.12, 0, 1.8, -2.35));
    Col.box(bx - 15, bx + 15, -2.4, 2.4, -5, 0.85, { walk: true }); Col.box(bx - 15, bx + 15, 2.3, 2.5, 0.85, 2.0, { block: true }); Col.box(bx - 15, bx + 15, -2.5, -2.3, 0.85, 2.0, { block: true });
    /* --- Rook's hideout at the ford (bounty) --- */
    const fx = riverX(-120) + 22, fz = -128; this.campfire(fx, fz, false); const tt = new THREE.Group(); tt.position.set(fx + 3, Terrain.height(fx + 3, fz - 3), fz - 3); sc.add(tt); const tc = M(GEO.cone, '#a0794f', 1.6, 1.8, 1.6, 0, 0.9, 0); tc.geometry = new THREE.ConeGeometry(1, 1, 4); tt.add(tc); Col.circle(fx + 3, fz - 3, 1.1, Terrain.height(fx + 3, fz - 3) - 1, Terrain.height(fx + 3, fz - 3) + 2, { block: true, cover: true });
    /* --- vegetation, rocks, gatherables --- */
    Interiors.build(); this.vegetation(); this.horizon(); this.decor(); Camps.build(); CH5.build(); SIDE.build();
    /* --- graves near the cabin: environmental story --- */
    for (let i = 0; i < 2; i++) { const gx = -158 + i * 1.6, gz = -78; const g = new THREE.Group(); g.position.set(gx, Terrain.height(gx, gz), gz); sc.add(g); g.add(M(GEO.box, '#8b6a47', 0.1, 1.0, 0.1, 0, 0.5, 0)); g.add(M(GEO.box, '#8b6a47', 0.6, 0.1, 0.1, 0, 0.75, 0)); g.add(M(GEO.box, '#7a6a52', 0.7, 0.15, 1.6, 0, 0.07, 0.9)); }
    Interact.add({ pos: () => ({ x: -157.2, y: Terrain.height(-157, -78), z: -78 }), r: 1.8, opts: () => [{ label: 'Read grave markers', fn: () => { UI.banner('Hollow Cabin', 'Two markers', '"T. Ashby, homesteader. Sold to the railroad, never left." The ground is older than Eli\'s visit. Someone else lost this land first.'); if (!S.evidence.graves) { S.evidence.graves = true; journal('Two graves by Hollow Cabin. The Ashbys "sold to the railroad" and never left. Same story as the Greers, years earlier.', 'evidence'); } } }] });
  },
  fence(x0, z0, x1, z1) { const len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len / 2.4), a = Math.atan2(x1 - x0, z1 - z0); for (let i = 0; i <= n; i++) { const x = lerp(x0, x1, i / n), z = lerp(z0, z1, i / n), y = Terrain.height(x, z); Game.scene.add(M(GEO.box, '#7a5232', 0.14, 1.2, 0.14, x, y + 0.6, z)); if (i < n) { const x2 = lerp(x0, x1, (i + 0.5) / n), z2 = lerp(z0, z1, (i + 0.5) / n), y2 = Terrain.height(x2, z2); for (const h of [0.5, 0.95]) { const r = M(GEO.box, '#8b6a47', 0.08, 0.1, len / n, x2, y2 + h, z2); r.rotation.y = a; Game.scene.add(r); } } }
    const minX = Math.min(x0, x1) - 0.15, maxX = Math.max(x0, x1) + 0.15, minZ = Math.min(z0, z1) - 0.15, maxZ = Math.max(z0, z1) + 0.15; const y = Terrain.height((x0 + x1) / 2, (z0 + z1) / 2); Col.box(minX, maxX, minZ, maxZ, y - 2, y + 1.15, { walk: true, block: false }); },
  campfire(x, z, big) { const y = Terrain.height(x, z); const g = new THREE.Group(); g.position.set(x, y, z); Game.scene.add(g); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; g.add(M(GEO.dod, '#8d8a83', 0.22, 0.16, 0.22, Math.cos(a) * 0.6, 0.08, Math.sin(a) * 0.6)); } for (let i = 0; i < 3; i++) { const l = M(GEO.cyl, '#5a3a20', 0.08, 0.9, 0.08, 0, 0.2, 0); l.rotation.set(1.2, i * 2.1, 0); g.add(l); }
    const fl = M(GEO.cone, '#ffb347', 0.3, 0.7, 0.3, 0, 0.45, 0, { emissive: '#ff8a2a', emissiveIntensity: 0.8 }); g.add(fl); const light = new THREE.PointLight(0xff9a40, 1.4, 12, 2); light.position.set(0, 1, 0); g.add(light); Game.fires.push({ g, fl, light, x, z }); Col.circle(x, z, 0.6, y, y + 0.5, { block: false }); return g; },
  cave() {
    const cx = -55, cz = -146, y = Terrain.height(cx, cz); const g = new THREE.Group(); g.position.set(cx, y, cz); Game.scene.add(g); this.caveG = g;
    const rock = '#7d7a76', dark = '#3a3836';
    const wall = (x0, x1, z0, z1, h = 4.5) => { const m = M(GEO.box, rock, x1 - x0, h, z1 - z0, (x0 + x1) / 2, h / 2, (z0 + z1) / 2); g.add(m); WallMeshes.push(m); Col.box(cx + x0, cx + x1, cz + z0, cz + z1, y - 1, y + h, { block: true }); };
    wall(-6, -4.5, -7, 6); wall(4.5, 6, -7, 6); wall(-6, 6, -8, -6.5); wall(-6, -1.6, 5, 6.5); wall(1.6, 6, 5, 6.5);
    const roof = new THREE.Group(); roof.position.y = 4.5; g.add(roof); roof.add(M(GEO.box, rock, 12.5, 1.2, 15, 0, 0.5, -0.5)); for (let i = 0; i < 8; i++) roof.add(M(GEO.dod, rock, rand(2.5, 4), rand(1.8, 3), rand(2.5, 4), rand(-5, 5), rand(1, 2.4), rand(-7, 6)));
    for (let i = 0; i < 6; i++) g.add(M(GEO.dod, rock, rand(1.8, 3), rand(2, 4), rand(1.8, 3), (i % 2 ? 1 : -1) * rand(6, 8), rand(0.5, 2), rand(-7, 5)));
    g.add(M(GEO.box, dark, 9, 0.05, 11, 0, 0.03, -1)); for (let i = 0; i < 5; i++) g.add(M(GEO.cone, '#5aa0d8', 0.15, 0.6, 0.15, rand(-4, 4), 0.3, rand(-6, 3), { emissive: '#2f7fbf', emissiveIntensity: 0.6 }));
    const lan = new THREE.PointLight(0x9ad0ff, 0.9, 12, 2); lan.position.set(0, 2.5, -3); g.add(lan);
    Buildings.push({ g, roofs: [roof], minX: cx - 4.5, maxX: cx + 4.5, minZ: cz - 6.5, maxZ: cz + 5, y, name: 'Bluecap Cave', floor: y });
    g.add(M(GEO.box, '#5a7a5a', 0.9, 0.12, 2.0, 2.5, 0.06, -4)); g.add(M(GEO.box, '#ffd27a', 0.18, 0.28, 0.18, 1.5, 0.15, -5, { emissive: '#ffb84a', emissiveIntensity: 0.7 }));
  },
  vegetation() {
    const sc = Game.scene, R = mulberry(99), dummy = new THREE.Object3D();
    const avoid = (x, z, pad = 0) => { if (trailDist(x, z) < 4.5 + pad) return true; for (const c of CAMPS) if (Math.hypot(x - c.x, z - c.z) < c.r + 3 + pad) return true; for (const f of FLATS) if (Math.hypot(x - f.x, z - f.z) < f.r + 5 + pad) return true; if (Math.abs(x - riverX(z)) < 12) return true; for (const p of PONDS) if (Math.hypot(x - p.x, z - p.z) < p.r + 3) return true; if (Math.hypot(x - riverX(-120) - 22, z + 128) < 10) return true; return false; };
    const forestD = (x, z) => fbm(x * 0.012 + 50, z * 0.012, 3) + (z < -100 ? 0.22 : 0) + fbm(x * 0.05, z * 0.05, 2) * 0.25;
    const inst = (geo, mat, list, fn, shadow = true) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); m.count = list.length; list.forEach((t, i) => { fn(dummy, t, i); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }); m.castShadow = shadow; m.receiveShadow = true; m.frustumCulled = false; sc.add(m); if (shadow) Game.treeCasters.push(m); return m; };
    const coneUp = new THREE.ConeGeometry(1, 1, 12, 3); coneUp.translate(0, 0.5, 0); const cylUp = new THREE.CylinderGeometry(0.7, 1, 1, 7); cylUp.translate(0, 0.5, 0); const blob = new THREE.IcosahedronGeometry(1, 2);
    // --- trees: pine, fir, oak, aspen, dead snag; clustered by a forest density field with clearings
    const T = { pine: [], fir: [], oak: [], aspen: [], snag: [] };
    for (let i = 0; i < 9000 && Object.values(T).reduce((a, l) => a + l.length, 0) < 1700; i++) {
      const x = (R() - 0.5) * 462, z = (R() - 0.5) * 462, d = forestD(x, z); if (d < 0.02 + R() * 0.1 || avoid(x, z)) continue; const h = Terrain.height(x, z); if (h < WORLD.waterY + 0.7 || h > 36) continue;
      const sl = Math.abs(Terrain.height(x + 1, z) - Terrain.height(x - 1, z)) + Math.abs(Terrain.height(x, z + 1) - Terrain.height(x, z - 1)); if (sl > 2.2) continue;
      const s = 0.7 + R() * 0.75, r = R(); const kind = h > 16 ? (r < 0.6 ? 'fir' : r < 0.93 ? 'pine' : 'snag') : d > 0.25 ? (r < 0.45 ? 'pine' : r < 0.7 ? 'fir' : r < 0.97 ? 'oak' : 'snag') : (r < 0.35 ? 'oak' : r < 0.65 ? 'aspen' : r < 0.9 ? 'pine' : 'snag');
      T[kind].push([x, h, z, s, R() * TAU, R()]); Col.circle(x, z, (kind === 'oak' ? 0.42 : 0.32) * s + 0.08, h - 1, h + 6, { block: true, cover: true });
    }
    for (const [x, z] of [[-14, 40], [-70, 44], [-28, -6], [-80, 0], [-5, 34]]) { const h = Terrain.height(x, z); T.oak.push([x, h, z, 1.25, R() * TAU, R()]); Col.circle(x, z, 0.6, h - 1, h + 6, { block: true, cover: true }); }
    const bark = toon('#6b4a2f'), barkL = toon('#e7e2d6'), barkD = toon('#857b70');
    const W = (c, amp, leaf = 0) => windMat(c, amp, leaf);
    inst(cylUp, bark, T.pine, (d, [x, h, z, s]) => { d.position.set(x, h - 0.2, z); d.scale.set(0.24 * s, 2.2 * s, 0.24 * s); d.rotation.set(0, 0, 0); });
    [['#2f6b45', 0], ['#3a7d4f', 1], ['#4b9160', 2]].forEach(([c, k]) => inst(coneUp, W(c, 0.05, 0.14), T.pine, (d, [x, h, z, s, r, v]) => { d.position.set(x, h + (1.3 + k * 1.25) * s, z); d.scale.set((2.1 - k * 0.55) * s * (0.9 + v * 0.2), (2.5 - k * 0.3) * s, (2.1 - k * 0.55) * s); d.rotation.set(0, r + k, 0); }));
    inst(cylUp, bark, T.fir, (d, [x, h, z, s]) => { d.position.set(x, h - 0.2, z); d.scale.set(0.2 * s, 2.5 * s, 0.2 * s); d.rotation.set(0, 0, 0); });
    [['#24563a', 0], ['#2c6542', 1], ['#356f4a', 2], ['#3e7a52', 3]].forEach(([c, k]) => inst(coneUp, W(c, 0.04, 0.12), T.fir, (d, [x, h, z, s, r]) => { d.position.set(x, h + (1.1 + k * 1.5) * s, z); d.scale.set((1.45 - k * 0.3) * s, (2.6 - k * 0.25) * s, (1.45 - k * 0.3) * s); d.rotation.set(0, r + k, 0); }));
    inst(cylUp, bark, T.oak, (d, [x, h, z, s]) => { d.position.set(x, h - 0.2, z); d.scale.set(0.28 * s, 2.6 * s, 0.28 * s); d.rotation.set(0, 0, 0); });
    [['#5f9a3e', 0, 0, 3.6, 2.0], ['#74ad4b', 0.8, -0.4, 4.3, 1.4], ['#6aa244', -0.9, 0.5, 4.0, 1.3], ['#86b95a', 0.1, 0.3, 4.9, 1.1]].forEach(([c, ox, oz, oy, r0]) => inst(blob, W(c, 0.06, 0.32), T.oak, (d, [x, h, z, s, r, v]) => { d.position.set(x + (ox * Math.cos(r) - oz * Math.sin(r)) * s, h + oy * s, z + (ox * Math.sin(r) + oz * Math.cos(r)) * s); d.scale.set(r0 * s, r0 * 0.82 * s, r0 * s); d.rotation.set(v, r, 0); }));
    inst(cylUp, barkL, T.aspen, (d, [x, h, z, s]) => { d.position.set(x, h - 0.2, z); d.scale.set(0.16 * s, 3.6 * s, 0.16 * s); d.rotation.set(0, 0, 0); });
    [['#b9c95a', 3.4, 1.15], ['#d4c75a', 4.4, 0.9]].forEach(([c, oy, r0]) => inst(blob, W(c, 0.08, 0.28), T.aspen, (d, [x, h, z, s, r]) => { d.position.set(x, h + oy * s, z); d.scale.set(r0 * s, r0 * 1.5 * s, r0 * s); d.rotation.set(0, r, 0); }));
    inst(cylUp, barkD, T.snag, (d, [x, h, z, s]) => { d.position.set(x, h - 0.2, z); d.scale.set(0.2 * s, 3.6 * s, 0.2 * s); d.rotation.set(0, 0, 0.06); });
    inst(cylUp, barkD, T.snag, (d, [x, h, z, s, r]) => { d.position.set(x, h + 2.2 * s, z); d.scale.set(0.07 * s, 1.4 * s, 0.07 * s); d.rotation.set(0.9, r, 0); });
    // --- fallen logs and stumps (climbable cover)
    const logs = [], stumps = []; for (let i = 0; i < 600 && logs.length < 70; i++) { const x = (R() - 0.5) * 440, z = (R() - 0.5) * 440; if (avoid(x, z, 1) || forestD(x, z) < 0.05) continue; const h = Terrain.height(x, z); if (h < WORLD.waterY + 0.6 || h > 30) continue; const a = R() * Math.PI, L = 3 + R() * 3; logs.push([x, h, z, a, L]); const ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a)); Col.box(x - (sa * L / 2 + 0.3), x + (sa * L / 2 + 0.3), z - (ca * L / 2 + 0.3), z + (ca * L / 2 + 0.3), h - 1, h + 0.6, { walk: true, block: true, cover: true }); if (R() < 0.6) stumps.push([x + Math.cos(a) * 3, Terrain.height(x + Math.cos(a) * 3, z + Math.sin(a) * 3), z + Math.sin(a) * 3]); }
    const logG = new THREE.CylinderGeometry(1, 1, 1, 8); logG.rotateZ(Math.PI / 2);
    inst(logG, toon('#7a5a3c'), logs, (d, [x, h, z, a, L]) => { d.position.set(x, h + 0.3, z); d.scale.set(L, 0.32, 0.32); d.rotation.set(0, a, 0); });
    inst(cylUp, toon('#7a5a3c'), stumps, (d, [x, h, z]) => { d.position.set(x, h - 0.1, z); d.scale.set(0.4, 0.6, 0.4); d.rotation.set(0, 0, 0); });
    // --- boulders: big ones are climbable; mossy caps
    const rocks = []; for (let i = 0; i < 220 && rocks.length < 110; i++) { const x = (R() - 0.5) * 440, z = (R() - 0.5) * 440; if (avoid(x, z)) continue; const h = Terrain.height(x, z); if (h < WORLD.waterY + 0.3) continue; const cl = 1 + Math.floor(R() * 3); for (let k = 0; k < cl; k++) { const s = (k ? 0.4 : 0.6) + R() * (k ? 0.7 : 1.6), xx = x + (k ? (R() - 0.5) * 3 : 0), zz = z + (k ? (R() - 0.5) * 3 : 0), hh = Terrain.height(xx, zz); rocks.push([xx, hh, zz, s, R() * TAU]); if (s > 1.1) Col.box(xx - s * 0.8, xx + s * 0.8, zz - s * 0.8, zz + s * 0.8, hh - 1, hh + s * 1.15, { walk: true, block: true, cover: true }); else Col.circle(xx, zz, s * 0.85, hh - 1, hh + s, { block: true, cover: true }); } }
    for (const [x, z, s] of [[120, -95, 1.4], [152, -96, 1.3], [112, -76, 1.5], [158, -80, 1.2]]) { const h = Terrain.height(x, z); rocks.push([x, h, z, s, 0]); Col.box(x - s * 0.8, x + s * 0.8, z - s * 0.8, z + s * 0.8, h - 1, h + s * 1.15, { walk: true, block: true, cover: true }); }
    inst(GEO.dod, toon('#8d8a83'), rocks, (d, [x, h, z, s, r]) => { d.position.set(x, h + s * 0.45, z); d.scale.set(s, s * 0.8, s * 1.1); d.rotation.set(0, r, 0); });
    inst(GEO.dod, toon('#7d9254'), rocks.filter(r => r[3] > 0.9), (d, [x, h, z, s, r]) => { d.position.set(x, h + s * 0.86, z); d.scale.set(s * 0.72, s * 0.22, s * 0.8); d.rotation.set(0, r, 0); }, false);
    // --- bushes
    const bushes = []; for (let i = 0; i < 3000 && bushes.length < 650; i++) { const x = (R() - 0.5) * 450, z = (R() - 0.5) * 450; if (avoid(x, z, -1.5)) continue; const fd = forestD(x, z); if (R() > 0.25 + fd) continue; const h = Terrain.height(x, z); if (h < WORLD.waterY + 0.5 || h > 26) continue; bushes.push([x, h, z, 0.5 + R() * 0.7, R() * TAU, R()]); }
    inst(blob, W('#5c8a3c', 0.08, 0.3), bushes, (d, [x, h, z, s, r]) => { d.position.set(x, h + 0.35 * s, z); d.scale.set(s, s * 0.7, s); d.rotation.set(0, r, 0); });
    inst(new THREE.IcosahedronGeometry(1, 0), W('#78a64e', 0.1), bushes, (d, [x, h, z, s, r, v]) => { d.position.set(x + 0.35 * s, h + 0.55 * s, z - 0.2 * s); d.scale.set(s * 0.6, s * 0.5, s * 0.6); d.rotation.set(v, r, 0); }, false);
    // --- grass & flowers in chunks (distance-culled, wind-animated)
    const tuftG = new THREE.ConeGeometry(0.16, 1, 3, 1, true); tuftG.translate(0, 0.5, 0); const blades = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.12, 0, 0.05), new THREE.Vector3(-0.08, 0, 0.1)];
    const merged = mergeTufts(tuftG, blades); const CH = 40; this.grassChunks = [];
    const density = { low: 0.35, medium: 0.65, high: 1 }[Game.quality] || 1;
    for (let cx = -WORLD.half; cx < WORLD.half; cx += CH) for (let cz = -WORLD.half; cz < WORLD.half; cz += CH) {
      const tufts = [], flowers = [], reeds = [];
      for (let i = 0; i < 420 * density; i++) { const x = cx + R() * CH, z = cz + R() * CH; const h = Terrain.height(x, z); if (h > 24) continue; if (Math.hypot(x + 40, z - 20) < 30) { if (R() > 0.15) continue; }
        const nearW = WORLD.waterY - Terrain.height(x, z) > -0.5 && WORLD.waterY - Terrain.height(x, z) < 0.4; if (nearW && R() < 0.6) { reeds.push([x, h, z, 0.8 + R() * 0.6, R() * TAU]); continue; } if (h < WORLD.waterY + 0.3) continue;
        const td = trailDist(x, z); if (td < 1.6) continue; const meadow = fbm(x * 0.03 + 7, z * 0.03, 2); if (meadow > 0.18 && R() < 0.16) flowers.push([x, h, z, 0.6 + R() * 0.6, R()]); else tufts.push([x, h, z, 0.3 + R() * 0.32 + (td < 3 ? -0.1 : 0), R() * TAU, R()]); }
      const grp = new THREE.Group(); grp.userData.c = { x: cx + CH / 2, z: cz + CH / 2 }; sc.add(grp); this.grassChunks.push(grp);
      const add = m => { m.frustumCulled = false; grp.add(m); };
      if (tufts.length) { const m = new THREE.InstancedMesh(merged, windMat('#ffffff', 0.25), tufts.length); tufts.forEach(([x, h, z, s, r, v], i) => { dummy.position.set(x, h - 0.02, z); dummy.scale.set(s * 1.3, s * (0.55 + v * 0.45), s * 1.3); dummy.rotation.set(0, r, 0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, new THREE.Color().setHSL(0.2 + v * 0.07, 0.32, 0.3 + v * 0.1)); }); add(m); }
      if (flowers.length) { const m = new THREE.InstancedMesh(GEO.sphLo, windMat('#ffffff', 0.2), flowers.length); flowers.forEach(([x, h, z, s, c], i) => { dummy.position.set(x, h + 0.28 * s, z); dummy.scale.setScalar(0.09 * s); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, new THREE.Color(c < 0.3 ? '#f2d14a' : c < 0.55 ? '#e86a8a' : c < 0.8 ? '#a6c8ff' : '#f4f0e6')); }); add(m); this.flowerSpots = (this.flowerSpots || []).concat(flowers.filter((f, i) => i % 15 === 0)); }
      if (reeds.length) { const m = new THREE.InstancedMesh(merged, windMat('#6f8a3c', 0.35), reeds.length); reeds.forEach(([x, h, z, s, r], i) => { dummy.position.set(x, h, z); dummy.scale.set(0.8, s * 2.2, 0.8); dummy.rotation.set(0, r, 0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }); add(m); }
    }
    // lily pads on ponds
    const pads = []; for (const p of PONDS) for (let i = 0; i < 14; i++) { const a = R() * TAU, r = R() * p.r * 0.75; pads.push([p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, 0.3 + R() * 0.35]); }
    const padG = new THREE.CircleGeometry(1, 10, 0.3, TAU - 0.4); padG.rotateX(-Math.PI / 2); inst(padG, toon('#4f8a3c', { side: THREE.DoubleSide }), pads, (d, [x, z, s]) => { d.position.set(x, WORLD.waterY + 0.03, z); d.scale.setScalar(s); d.rotation.set(0, s * 20, 0); }, false);
    // gatherables
    const RG = mulberry(5); let nb = 0, ns = 0; for (let i = 0; i < 600 && (nb < 34 || ns < 30); i++) { const x = (RG() - 0.5) * 420, z = (RG() - 0.5) * 420; if (avoid(x, z)) continue; const h = Terrain.height(x, z); if (h < WORLD.waterY + 0.6 || h > 20) continue; if (nb < 34 && RG() < 0.5) { gatherable('berries', x, z); nb++; } else if (ns < 30) { gatherable('sage', x, z); ns++; } }
    for (const [x, z] of [[-30, 48], [-80, 0], [-20, -10], [-160, -70], [-60, -128], [-110, 60]]) gatherable(x % 20 ? 'berries' : 'sage', x, z);
  },
  cullChunks() { const P = Game.cam.pos, f = Game.cam.dir(), r = { low: 55, medium: 70, high: 90 }[Game.quality] || 80; for (const g of this.grassChunks || []) { const dx = g.userData.c.x - P.x, dz = g.userData.c.z - P.z, d = Math.hypot(dx, dz); g.visible = d < r + 28 && (d < 40 || (dx * f.x + dz * f.z) / d > -0.2); } },
  horizon() {
    const sc = Game.scene, R = mulberry(77), g = new THREE.Group(); sc.add(g);
    const ring = new THREE.Mesh(new THREE.RingGeometry(245, 1100, 64, 1), new THREE.MeshLambertMaterial({ color: '#6b8650' })); ring.rotation.x = -Math.PI / 2; ring.position.y = 16; g.add(ring);
    const cone = new THREE.ConeGeometry(1, 1, 7); cone.translate(0, 0.5, 0); const dummy = new THREE.Object3D(); const list = [];
    for (let i = 0; i < 70; i++) { const a = i / 70 * TAU + R() * 0.05, rr = 340 + R() * 160, north = Math.sin(a) < -0.3 ? 1.6 : 1; list.push([Math.cos(a) * rr, Math.sin(a) * rr, (50 + R() * 70) * north, 60 + R() * 70, R()]); }
    const mk = (col, fn) => { const m = new THREE.InstancedMesh(cone, new THREE.MeshLambertMaterial({ color: col, flatShading: true }), list.length); list.forEach((t, i) => { fn(dummy, t); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }); m.frustumCulled = false; g.add(m); };
    mk('#5f7a6a', (d, [x, z, h, r, v]) => { d.position.set(x, 8, z); d.scale.set(r, h, r * (0.8 + v * 0.4)); d.rotation.set(0, v * 6, 0); });
    mk('#eef2f4', (d, [x, z, h, r, v]) => { const k = h > 95 ? 0.28 : 0.001; d.position.set(x, 8 + h * (1 - k) - 0.5, z); d.scale.set(r * k * 1.05, h * k, r * k * (0.8 + v * 0.4) * 1.05); d.rotation.set(0, v * 6, 0); });
  },
  decor() { // hand-placed details that make the region feel lived in
    const sc = Game.scene, G = (x, z) => { const g = new THREE.Group(); g.position.set(x, Terrain.height(x, z), z); sc.add(g); return g; };
    // water tower
    { const g = G(-3, 31); for (const [lx, lz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) g.add(M(GEO.box, '#6b4a2f', 0.22, 6, 0.22, lx, 3, lz)); g.add(M(GEO.cyl, '#8a5a3a', 2.1, 2.6, 2.1, 0, 7.2, 0)); const roof = M(GEO.cone, '#5d3a2a', 2.4, 1.4, 2.4, 0, 9.2, 0); g.add(roof); for (let i = 0; i < 3; i++) g.add(M(GEO.cyl, '#3b2a1e', 2.13, 0.08, 2.13, 0, 6.2 + i * 0.9, 0)); Col.box(-4.5, -1.5, 29.5, 32.5, g.position.y - 1, g.position.y + 9, { block: true }); }
    // stable & corral with two grazing horses
    { const g = G(-62, 45); for (const [lx, lz] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) g.add(M(GEO.box, '#6b4a2f', 0.2, 2.8, 0.2, lx, 1.4, lz)); const rf = M(GEO.box, '#7a4b3a', 7, 0.15, 5, 0, 2.9, 0); rf.rotation.x = 0.12; g.add(rf); for (let i = 0; i < 3; i++) g.add(M(GEO.box, '#e0c068', 1.2, 0.8, 0.9, -2 + i * 1.8, 0.4, -1.4)); Col.box(-65.3, -58.7, 43.1, 44, g.position.y - 1, g.position.y + 0.85, { walk: true, block: true });
      this.fence(-72, 49, -52, 49); this.fence(-72, 49, -72, 63); this.fence(-72, 63, -52, 63); this.fence(-52, 63, -52, 54);
      this.decoHorses = []; for (const [x, z, c] of [[-66, 56, '#4b3a2a'], [-58, 59, '#e2d3b0']]) { const rig = makeQuad({ type: 'horse', color: c, mane: '#2b1d14', tail: '#2b1d14', dark: '#2b1d14', scale: 0.95 }); rig.saddle.visible = false; rig.root.position.set(x, Terrain.height(x, z), z); rig.root.rotation.y = Math.random() * TAU; sc.add(rig.root); const h = { rig, anim: null, pos: rig.root.position, yaw: rig.root.rotation.y, t: rand(0, 6), home: { x, z } }; h.anim = new QuadAnimator(rig, h); this.decoHorses.push(h); } }
    // signposts at trail junctions
    const sign = (x, z, yaw, lines) => { const g = G(x, z); g.rotation.y = yaw; g.add(M(GEO.box, '#6b4a2f', 0.14, 2.6, 0.14, 0, 1.3, 0)); lines.forEach(([t, dir], i) => { const b = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.38), labelTex(t, '#8b6a47', '#f4ead3', 320, 64)); b.position.set(dir * 0.75, 2.2 - i * 0.48, 0.09); g.add(b); const bb = b.clone(); bb.rotation.y = Math.PI; bb.position.z = -0.09; g.add(bb); }); Col.circle(x, z, 0.15, g.position.y - 1, g.position.y + 2.6, { block: true }); };
    sign(-6, 13.5, 0, [['Willow Bridge →', 1], ['← Juniper Gap', -1]]); sign(-97, -14, 0.6, [['Hollow Cabin', -1], ['Bluecap Cave', 1]]); sign(-86, 45, 0.8, [['Greer Farm', 1]]); sign(riverX(0) + 19, 4, 0, [['Coyote Mill', 1], ['Lookout Ridge', -1]]);
    // barrels, crates, a parked wagon
    for (const [x, z] of [[-63.5, 13.2], [-64.3, 12.7], [-46.7, 13], [-33.8, 13.4], [-16.8, 13.1], [-24.8, 28.4]]) { const g = G(x, z); g.add(M(GEO.cyl, '#8b5a2b', 0.4, 0.95, 0.4, 0, 0.48, 0)); g.add(M(GEO.cyl, '#3b2a1e', 0.42, 0.05, 0.42, 0, 0.75, 0)); g.add(M(GEO.cyl, '#3b2a1e', 0.42, 0.05, 0.42, 0, 0.2, 0)); Col.circle(x, z, 0.42, g.position.y - 1, g.position.y + 0.95, { block: true, cover: true }); }
    { const g = G(-70, 10); g.rotation.y = 0.3; g.add(M(GEO.box, '#7a5232', 1.8, 0.7, 3.2, 0, 1.0, 0)); for (const [wx, wz] of [[-1, -1.1], [1, -1.1], [-1, 1.1], [1, 1.1]]) { const w = M(GEO.cyl, '#4b3a2a', 0.55, 0.1, 0.55, wx, 0.55, wz); w.rotation.z = Math.PI / 2; g.add(w); } const cv = M(GEO.cyl, '#efe6d0', 1.0, 3.0, 1.0, 0, 1.6, 0); cv.geometry = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true, 0, Math.PI); cv.rotation.set(Math.PI / 2, 0, Math.PI / 2); cv.scale.set(0.95, 3.0, 0.95); g.add(cv); Col.box(-71.2, -68.8, 8.2, 11.8, g.position.y - 1, g.position.y + 1.4, { walk: true, block: true, cover: true }); }
    // picket fences, outhouses, laundry line behind the south-side homes
    for (const x0 of [-63, -45, -27]) { for (let i = 0; i < 12; i++) { const x = x0 + i * 0.75, z = 39.5; const g = G(x, z); g.add(M(GEO.box, '#f1eadb', 0.12, 0.95, 0.06, 0, 0.47, 0)); } const g = G(x0 + 4, 39.5); g.add(M(GEO.box, '#f1eadb', 8.5, 0.07, 0.04, 0, 0.7, 0.04)); Col.box(x0, x0 + 8.5, 39.4, 39.6, Terrain.height(x0, 39.5) - 1, Terrain.height(x0, 39.5) + 1, { walk: true, block: true }); }
    for (const x of [-52, -18]) { const g = G(x, 43); g.add(M(GEO.box, '#8b6a47', 1.3, 2.1, 1.3, 0, 1.05, 0)); g.add(M(GEO.box, '#6b4226', 1.5, 0.12, 1.5, 0, 2.15, 0)); g.add(M(GEO.box, '#f4ead3', 0.15, 0.25, 0.02, 0, 1.6, 0.66)); Col.box(x - 0.65, x + 0.65, 42.35, 43.65, Terrain.height(x, 43) - 1, Terrain.height(x, 43) + 2.2, { block: true }); }
    { const g = G(-34, 42); for (const lx of [-3, 3]) g.add(M(GEO.box, '#6b4a2f', 0.1, 2.0, 0.1, lx, 1, 0)); g.add(M(GEO.box, '#e8e0cc', 6, 0.02, 0.02, 0, 1.95, 0)); [['#c8443a', -2], ['#4f7ca8', -0.6], ['#f4ead3', 0.8], ['#9dbf8a', 2]].forEach(([c, x]) => { const cl = M(GEO.box, c, 0.8, 0.7, 0.03, x, 1.55, 0); this.laundry = (this.laundry || []).concat(cl); g.add(cl); }); }
    // farm windmill (blades turn with the wind)
    { const g = G(-141, 80); for (const [lx, lz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) { const l = M(GEO.box, '#8b6a47', 0.12, 8, 0.12, lx * 0.6, 4, lz * 0.6); l.rotation.set(lz * 0.08, 0, -lx * 0.08); g.add(l); } const hub = new THREE.Group(); hub.position.set(0, 8.3, 0.6); g.add(hub); for (let i = 0; i < 8; i++) { const b = M(GEO.box, '#e6dcc5', 0.3, 2.2, 0.04, 0, 1.2, 0); const p = new THREE.Group(); p.rotation.z = i / 8 * TAU; p.add(b); hub.add(p); } g.add(M(GEO.box, '#b23a2e', 0.1, 0.9, 1.6, 0, 8.3, -0.9)); this.windmill = hub; Col.box(-142, -140, 79, 81, g.position.y - 1, g.position.y + 8, { block: true }); }
    // campsite remains near the ford trail
    { const g = G(-68, -96); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.add(M(GEO.dod, '#77736c', 0.22, 0.15, 0.22, Math.cos(a) * 0.5, 0.06, Math.sin(a) * 0.5)); } g.add(M(GEO.cyl, '#2b2b2b', 0.35, 0.05, 0.35, 0, 0.03, 0)); }
    this.chimneys = [[-58, 34, 4.6], [-40, 34, 4.6], [-22, 34, 4.6], [-125, 88, 4.6], [-40, 7, 5.2]].map(([x, z, h]) => { const y = Terrain.height(x, z) + h; const c = M(GEO.box, '#7d6a5a', 0.6, 1.6, 0.6, x + 1.6, y + 0.4, z); sc.add(c); return { x: x + 1.6, y: y + 1.3, z }; });
  },
  /* Apply persistent story state to the world: who is where, what changed */
  apply() {
    const farmOcc = S.locations.farm === 'occupied'; if (this.farmBoards) this.farmBoards.visible = !farmOcc;
    for (const n of NPC.all.slice()) if (n.cond && !n.cond()) NPC.despawn(n);
    STORY.spawnWorldNPCs(); Camps.apply(); SIDE.percival();
    for (const n of NPC.all) if (n.key && S.chars[n.key] === 'dead' && n.alive) n.setDead(true);
  },
};

/* ===== Ambient life: birds, butterflies, fireflies, chimney smoke, jumping fish, decorative horses ===== */
const Ambient = {
  init() {
    const sc = Game.scene; this.birds = [];
    const birdG = new THREE.BufferGeometry(); birdG.setAttribute('position', new THREE.Float32BufferAttribute([-0.6, 0, -0.1, 0, 0, 0.2, 0, 0.05, -0.1, 0.6, 0, -0.1, 0, 0, 0.2, 0, 0.05, -0.1], 3)); birdG.computeVertexNormals();
    for (let f = 0; f < 3; f++) { const c = { x: rand(-150, 150), z: rand(-150, 150), r: rand(25, 45), h: rand(28, 45), sp: rand(0.15, 0.3) * (f % 2 ? 1 : -1), list: [] }; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(birdG, new THREE.MeshBasicMaterial({ color: '#2b2b2b', side: THREE.DoubleSide })); sc.add(m); c.list.push({ m, off: i * 0.12 + rand(0, 0.05), dy: rand(-2, 2) }); } this.birds.push(c); }
    this.flies = []; for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), new THREE.MeshBasicMaterial({ color: pick(['#f2d14a', '#f4f0e6', '#e8833a']), side: THREE.DoubleSide })); m.visible = false; sc.add(m); this.flies.push({ m, base: null, t: rand(0, 10) }); }
    const fg = new THREE.BufferGeometry(), fp = new Float32Array(60 * 3); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); const dot = document.createElement('canvas'); dot.width = dot.height = 32; const dg = dot.getContext('2d'), gr = dg.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,245,170,1)'); gr.addColorStop(0.3, 'rgba(246,226,122,0.8)'); gr.addColorStop(1, 'rgba(246,226,122,0)'); dg.fillStyle = gr; dg.fillRect(0, 0, 32, 32);
    this.ff = new THREE.Points(fg, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(dot), size: 0.22, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); this.ff.frustumCulled = false; sc.add(this.ff); this.ffSeed = [...Array(60)].map(() => [rand(-25, 25), rand(0.4, 2.2), rand(-25, 25), rand(0, 10)]);
    this.smoke = []; this.smokeT = 0; this.fishT = 5;
  },
  update(dt) {
    const t = Game.time, P = Game.player.pos, night = Sky.night();
    for (const c of this.birds) { c.x += Math.sin(t * 0.03 + c.r) * dt * 2; for (const b of c.list) { const a = t * c.sp + b.off; b.m.position.set(c.x + Math.cos(a) * c.r, c.h + b.dy + Math.sin(t * 2 + b.off * 9) * 0.6, c.z + Math.sin(a) * c.r); b.m.rotation.set(0, -a + (c.sp > 0 ? 0 : Math.PI), 0); b.m.scale.set(1, 1 + Math.sin(t * 9 + b.off * 30) * 0.8, 1); b.m.visible = !night; } }
    const spots = World.flowerSpots || []; for (const f of this.flies) { f.t += dt; if (!f.base || Math.hypot(f.base[0] - P.x, f.base[2] - P.z) > 40) { const near = spots.filter(s => Math.hypot(s[0] - P.x, s[2] - P.z) < 35); f.base = near.length ? pick(near) : null; } f.m.visible = !!f.base && !night && Sky.weather !== 'rain'; if (!f.m.visible) continue; f.m.position.set(f.base[0] + Math.sin(f.t * 0.7) * 1.5, f.base[1] + 0.6 + Math.abs(Math.sin(f.t * 3)) * 0.5, f.base[2] + Math.cos(f.t * 0.9) * 1.5); f.m.rotation.set(0, f.t, Math.sin(f.t * 25) * 0.9); }
    this.ff.visible = night && !Sky.raining(); if (this.ff.visible) { const a = this.ff.geometry.attributes.position.array; this.ffSeed.forEach(([x, y, z, ph], i) => { a[i * 3] = P.x + x + Math.sin(t * 0.4 + ph) * 1.5; a[i * 3 + 1] = Terrain.height(P.x + x, P.z + z) + y + Math.sin(t + ph) * 0.3; a[i * 3 + 2] = P.z + z + Math.cos(t * 0.3 + ph) * 1.5; }); this.ff.geometry.attributes.position.needsUpdate = true; this.ff.material.opacity = 0.5 + Math.sin(t * 3) * 0.4; }
    // chimney smoke
    this.smokeT -= dt; if (this.smokeT <= 0 && World.chimneys) { this.smokeT = 0.35; for (const c of World.chimneys) if (Math.hypot(c.x - P.x, c.z - P.z) < 90) { const m = new THREE.Mesh(GEO.sphLo, toon('#d8d4cc', { transparent: true, opacity: 0.55 })); m.position.set(c.x, c.y, c.z); m.scale.setScalar(0.3); Game.scene.add(m); this.smoke.push({ m, life: 4 }); } }
    this.smoke = this.smoke.filter(p => { p.life -= dt; p.m.position.y += dt * 0.9; p.m.position.x += dt * 0.4 * WIND.uStrength.value; p.m.scale.setScalar(0.3 + (4 - p.life) * 0.25); p.m.material.opacity = p.life / 8; if (p.life <= 0) { Game.scene.remove(p.m); return false; } return true; });
    // a trout jumps now and then when you are near water
    this.fishT -= dt; if (this.fishT <= 0) { this.fishT = rand(6, 14); for (let k = 0; k < 8; k++) { const x = P.x + rand(-25, 25), z = P.z + rand(-25, 25); if (WORLD.waterY - Terrain.height(x, z) > 0.8) { FX.splash(x, WORLD.waterY, z); break; } } }
    // decorative horses in the corral
    for (const h of World.decoHorses || []) { h.t -= dt; if (h.t < 0) { h.t = rand(5, 12); h.walk = Math.random() < 0.4; h.rig.root.rotation.y += rand(-1, 1); } const f = fwd(h.rig.root.rotation.y); let sp = h.walk ? 1 : 0; const nx = h.pos.x + f.x * sp * dt, nz = h.pos.z + f.z * sp * dt; if (nx > -70.5 && nx < -53.5 && nz > 50.5 && nz < 61.5) { h.pos.x = nx; h.pos.z = nz; } else { h.rig.root.rotation.y += dt * 2; sp = 0.5; } h.pos.y = Terrain.height(h.pos.x, h.pos.z); h.yaw = h.rig.root.rotation.y; h.anim.update(dt, { speed: sp, gait: 'walk', graze: h.walk ? 0 : 1 }); }
    if (World.windmill) World.windmill.rotation.z -= dt * (0.6 + WIND.uStrength.value * 0.6);
    for (const [i, l] of (World.laundry || []).entries()) l.rotation.x = Math.sin(t * 2 + i) * 0.25 * WIND.uStrength.value;
  },
};
