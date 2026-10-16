/* ===== World: terrain, colliders, structures, vegetation ===== */
const WORLD = { size: 480, half: 240, res: 2, waterY: -1.0 };
const POIS = [
  { id: 'town', name: 'Juniper Gap', x: -40, z: 20, r: 40, icon: 'town' },
  { id: 'farm', name: 'Greer Farm', x: -120, z: 95, r: 26, icon: 'farm' },
  { id: 'mill', name: 'Coyote Mill', x: 135, z: -85, r: 30, icon: 'camp' },
  { id: 'bridge', name: 'Willow Bridge', x: 0, z: 0, r: 14, icon: 'bridge' },
  { id: 'cabin', name: 'Hollow Cabin', x: -150, z: -85, r: 16, icon: 'cabin' },
  { id: 'cave', name: 'Bluecap Cave', x: -55, z: -146, r: 14, icon: 'cave' },
  { id: 'ford', name: 'Shallow Ford', x: 0, z: -120, r: 14, icon: 'ford' },
  { id: 'ridge', name: 'Lookout Ridge', x: 150, z: 140, r: 16, icon: 'view' },
  { id: 'camp_teague', name: "Teague's Camp", x: -170, z: 62, r: 18, icon: 'camp' },
  { id: 'camp_holt', name: 'Holt Hunting Camp', x: 148, z: 14, r: 18, icon: 'camp' },
  { id: 'camp_rattlesnake', name: 'Rattlesnake Hollow', x: 184, z: -112, r: 22, icon: 'camp' },
  { id: 'tamarack', name: 'Tamarack Pass (Survey Camp 3)', x: 92, z: -166, r: 22, icon: 'camp' },
];
// traveler camps and outlaw hideouts (layouts and behaviour in 07b_camps.js); r keeps trees out of the clearing
const CAMPS = [{ id: 'camp_teague', x: -170, z: 62, r: 9 }, { id: 'camp_holt', x: 148, z: 14, r: 9 }, { id: 'camp_rattlesnake', x: 184, z: -112, r: 12 }];
function riverX(z) { return 55 + 22 * Math.sin(z * 0.014) + 8 * Math.sin(z * 0.041 + 1); }
function riverDepth(z) { return lerp(0.5, 3.4, smoothstep(10, 34, Math.abs(z + 120))); }
POIS.find(p => p.id === 'bridge').x = riverX(0); POIS.find(p => p.id === 'ford').x = riverX(-120);
const FLATS = [
  { x: -40, z: 20, r: 44, h: 2 }, { x: -120, z: 95, r: 30, h: 2.5 }, { x: 135, z: -85, r: 24, h: 3 },
  { x: -150, z: -85, r: 13, h: 4 }, { x: -55, z: -146, r: 14, h: 5 }, { x: 150, z: 140, r: 9, h: 15.5 },
  { x: riverX(0) - 15, z: 0, r: 4, h: 0.8 }, { x: riverX(0) + 15, z: 0, r: 4, h: 0.8 },
  { x: 92, z: -166, r: 20, h: 17 }, // Survey Camp 3, a railroad camp on a shelf above the river
];
const TRAILS = [
  [[-40, 20], [-5, 18], [riverX(0) - 16, 0], [riverX(0) + 16, 0], [95, -30], [120, -70], [135, -85]],
  [[-60, 22], [-90, 50], [-120, 95]],
  [[-60, 18], [-100, -20], [-150, -85]],
  [[-100, -20], [-70, -110], [-55, -140]],
  [[-70, -110], [riverX(-120) - 10, -120], [riverX(-120) + 12, -120], [110, -100], [135, -85]],
  [[riverX(0) + 16, 0], [110, 60], [150, 140]],
  [[110, -100], [101, -126], [95, -146], [92, -158]], // up to Tamarack Pass
];
function segDist(px, pz, ax, az, bx, bz) { const vx = bx - ax, vz = bz - az, wx = px - ax, wz = pz - az; const t = clamp((wx * vx + wz * vz) / (vx * vx + vz * vz), 0, 1); return Math.hypot(px - (ax + vx * t), pz - (az + vz * t)); }
function trailDist(x, z) { let m = 1e9; for (const tr of TRAILS) for (let i = 0; i < tr.length - 1; i++) m = Math.min(m, segDist(x, z, tr[i][0], tr[i][1], tr[i + 1][0], tr[i + 1][1])); return m; }

const PONDS = [{ x: 0, z: 85, r: 11 }, { x: -122, z: -2, r: 9 }, { x: 96, z: 96, r: 10 }, { x: 178, z: -32, r: 9 }, { x: -185, z: 150, r: 12 }];
function ridged(x, z) { return 1 - Math.abs(NOISE(x, z) * 2.2); }
function rawHeight(x, z) {
  // rolling hills + ridged uplands + small-scale detail; mountains to the north, rising rim at the edges
  const hill = fbm(x * 0.0065, z * 0.0065, 4) * 15, upl = smoothstep(-0.05, 0.35, fbm(x * 0.004 + 31, z * 0.004 - 7, 2)) * ridged(x * 0.014, z * 0.014) * 7;
  let h = 3.2 + hill + upl + fbm(x * 0.04, z * 0.04, 2) * 1.1;
  const m = smoothstep(-120, -205, z); h += m * (28 + fbm(x * 0.02, z * 0.02, 3) * 24 + ridged(x * 0.03, z * 0.03) * 8);
  const e = Math.max(Math.abs(x), Math.abs(z)); h += smoothstep(190, 236, e) * (26 + ridged(x * 0.02, z * 0.02) * 10);
  h += Math.pow(Math.max(0, 1 - Math.hypot(x - 150, z - 140) / 52), 2) * 16;
  const td = trailDist(x, z); if (td < 7) { const ht = (h + 2.2 * 2) / 3; h = lerp(h, ht, smoothstep(7, 1.5, td) * 0.55); }
  for (const f of FLATS) { const d = Math.hypot(x - f.x, z - f.z); const t = smoothstep(f.r + 18, f.r, d); if (t > 0) h = lerp(h, f.h, t); }
  for (const p of PONDS) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r + 10) { const bed = WORLD.waterY - 1.7 * Math.max(0, 1 - (d / p.r) ** 2) + (d > p.r ? (d - p.r) * 0.12 + 0.3 : 0); h = lerp(h, Math.min(h, bed), smoothstep(p.r + 10, p.r, d)); } }
  const rx = riverX(z), d = Math.abs(x - rx), w = 9, dep = riverDepth(z);
  if (d < w + 7) { const bed = d < w ? WORLD.waterY - dep * Math.max(0.05, 1 - (d / w) ** 2) : WORLD.waterY + 0.25; const t = smoothstep(w + 7, w, d); h = lerp(h, Math.min(h, bed), t); }
  return h;
}
function groundTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, 256, 256);
  const R = mulberry(3); for (let i = 0; i < 2600; i++) { const x = R() * 256, y = R() * 256, l = 3 + R() * 7, a = -Math.PI / 2 + (R() - 0.5) * 0.9, v = 200 + R() * 55; g.strokeStyle = `rgba(${v},${v},${v},${0.35 + R() * 0.4})`; g.lineWidth = 1 + R() * 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  for (let i = 0; i < 900; i++) { const v = 170 + R() * 60; g.fillStyle = `rgba(${v},${v},${v},0.5)`; g.beginPath(); g.arc(R() * 256, R() * 256, 0.6 + R() * 1.6, 0, TAU); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(140, 140); t.anisotropy = 4; return t;
}
const Terrain = {
  n: 0, H: null,
  build(scene) {
    const n = WORLD.size / WORLD.res + 1; this.n = n; const H = new Float32Array(n * n); this.H = H;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) H[j * n + i] = rawHeight(-WORLD.half + i * WORLD.res, -WORLD.half + j * WORLD.res);
    const g = new THREE.PlaneGeometry(WORLD.size, WORLD.size, n - 1, n - 1); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3); this.baseCol = col;
    const C = (h) => new THREE.Color(h);
    const grassA = C('#8db25a'), grassB = C('#6e9a47'), meadow = C('#b3b467'), forest = C('#5f7f3f'), dirt = C('#b89a6c'), rut = C('#9a7c55'), sand = C('#cdbd8f'), rock = C('#8b8880'), moss = C('#76875a'), snow = C('#f2f4f5'), mud = C('#7d6646'), tmp = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const i = k % n, j = Math.floor(k / n); const h = H[j * n + i]; pos.setY(k, h);
      const x = -WORLD.half + i * WORLD.res, z = -WORLD.half + j * WORLD.res;
      const hx = H[j * n + Math.min(n - 1, i + 1)] - h, hz = H[Math.min(n - 1, j + 1) * n + i] - h; const slope = Math.hypot(hx, hz) / WORLD.res;
      const nz = fbm(x * 0.05, z * 0.05, 2);
      tmp.copy(grassA).lerp(grassB, clamp(nz * 2 + 0.5, 0, 1)); tmp.lerp(meadow, clamp(fbm(x * 0.012 + 9, z * 0.012, 2) * 2.2, 0, 0.7));
      tmp.lerp(forest, clamp((fbm(x * 0.012 + 50, z * 0.012, 3) + (z < -100 ? 0.25 : 0)) * 3, 0, 0.75));
      tmp.offsetHSL(0, 0, (h - 4) * 0.004);
      const td = trailDist(x, z); if (td < 3.6) { tmp.lerp(dirt, smoothstep(3.6, 1.4, td)); if (td > 0.5 && td < 1.3) tmp.lerp(rut, 0.35); }
      for (const p of PONDS) { const pd = Math.hypot(x - p.x, z - p.z); if (pd < p.r + 4) tmp.lerp(pd < p.r ? mud : moss, smoothstep(p.r + 4, p.r - 1, pd) * 0.7); }
      const rd = Math.abs(x - riverX(z)); if (rd < 14 && h < WORLD.waterY + 1.4) tmp.lerp(sand, smoothstep(14, 9, rd));
      if (h < WORLD.waterY + 0.1) tmp.lerp(mud, 0.6);
      for (const f of FLATS.slice(0, 3)) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r * 0.75) tmp.lerp(dirt, 0.35 * smoothstep(f.r * 0.75, f.r * 0.3, d)); }
      if (slope > 0.5) tmp.lerp(rock, smoothstep(0.5, 0.95, slope) * (0.75 + nz * 0.5));
      if (h > 30) tmp.lerp(snow, smoothstep(30, 36, h + nz * 4));
      col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col.slice(), 3)); g.computeVertexNormals();
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: groundTexture() });
    const mesh = new THREE.Mesh(g, this.mat); mesh.receiveShadow = true; scene.add(mesh); this.mesh = mesh;
    // water: a height texture tells every pixel how deep it is (clear shallows, dark depths, foam lapping the shore);
    // ripple normals reflect the sky with a fresnel falloff and catch a hard sun glint; rain roughens the surface
    const hd = new Float32Array(n * n * 4); for (let k = 0; k < n * n; k++) hd[k * 4] = H[k];
    this.tH = new THREE.DataTexture(hd, n, n, THREE.RGBAFormat, THREE.FloatType); this.tH.needsUpdate = true;
    const wg = new THREE.PlaneGeometry(WORLD.size, WORLD.size, 1, 1); wg.rotateX(-Math.PI / 2);
    this.waterU = Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { uTime: { value: 0 }, uRain: { value: 0 }, uLight: { value: 1 }, tH: { value: this.tH }, uN: { value: n }, uHalf: { value: WORLD.half }, uRes: { value: WORLD.res }, uWY: { value: WORLD.waterY },
      uTop: { value: new THREE.Color('#5fa7d9') }, uHor: { value: new THREE.Color('#cfe5ee') }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color('#fff2cc') }, uCamPos: { value: new THREE.Vector3() },
      uShallow: { value: new THREE.Color('#79b8a6') }, uDeep: { value: new THREE.Color('#1f5e78') } });
    const wm = new THREE.ShaderMaterial({ uniforms: this.waterU, transparent: true, fog: true,
      vertexShader: 'varying vec3 vWp;\n#include <fog_pars_vertex>\nvoid main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWp = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}',
      fragmentShader: `uniform float uTime; uniform float uRain; uniform float uLight; uniform sampler2D tH; uniform float uN; uniform float uHalf; uniform float uRes; uniform float uWY;
        uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uCamPos; uniform vec3 uShallow; uniform vec3 uDeep; varying vec3 vWp;
        #include <fog_pars_fragment>
        float hAt(vec2 g){ vec2 i = floor(g), f = g - i; float a = texture2D(tH, (i + 0.5) / uN).r, b = texture2D(tH, (i + vec2(1.5, 0.5)) / uN).r, c = texture2D(tH, (i + vec2(0.5, 1.5)) / uN).r, d = texture2D(tH, (i + 1.5) / uN).r; return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
        vec2 wv(vec2 p, vec2 d, float f, float sp, float a){ return d * f * a * cos(dot(p, d) * f + uTime * sp); }
        void main(){
          vec2 p = vWp.xz; float depth = uWY - hAt((p + uHalf) / uRes);
          vec2 gr = wv(p, vec2(0.958, 0.287), 0.9, 1.3, 0.05) + wv(p, vec2(-0.371, 0.928), 1.5, 1.8, 0.035) + wv(p, vec2(0.659, -0.753), 2.7, 2.5, 0.02) + wv(p, vec2(-0.977, -0.217), 4.6, 3.3, 0.012)
                  + (wv(p, vec2(0.6, 0.8), 9.0, 7.0, 0.012) + wv(p, vec2(-0.8, 0.6), 11.0, 8.5, 0.01) + wv(p, vec2(0.28, -0.96), 14.0, 10.0, 0.008)) * (0.3 + uRain * 2.2);
          vec3 N = normalize(vec3(-gr.x, 1.0, -gr.y)), V = normalize(uCamPos - vWp), Rf = reflect(-V, N); Rf.y = abs(Rf.y);
          float fres = 0.12 + 0.88 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
          vec3 refl = mix(uHor, uTop, pow(clamp(Rf.y, 0.0, 1.0), 0.55));
          vec3 base = mix(uShallow, uDeep, smoothstep(0.05, 2.6, depth)) * uLight;
          vec3 col = mix(base, refl, fres * 0.85);
          vec3 L = normalize(uSunDir); float sd = max(dot(Rf, L), 0.0); col += uSunCol * (pow(sd, 220.0) * 4.0 + pow(sd, 28.0) * 0.22) * (1.0 - uRain * 0.7);
          float n1 = sin(p.x * 2.3 + uTime * 0.7) * sin(p.y * 1.9 - uTime * 0.55) * 0.5 + 0.5, n2 = sin(p.x * 5.1 - p.y * 4.3 + uTime * 1.3) * 0.5 + 0.5;
          float lap = 0.18 + 0.12 * sin(uTime * 1.1 + p.x * 0.4 + p.y * 0.3);
          float foam = (1.0 - smoothstep(0.0, 0.12 + n1 * 0.22, depth)) + smoothstep(0.06, 0.0, abs(depth - lap - n2 * 0.08)) * 0.55 * step(depth, 0.6);
          foam = clamp(foam * (0.65 + n2 * 0.5), 0.0, 1.0);
          col = mix(col, vec3(0.92, 0.95, 0.94) * uLight, foam * 0.8);
          float alpha = mix(0.5, 0.93, smoothstep(0.0, 1.6, depth)); alpha = max(alpha, foam * 0.85);
          gl_FragColor = vec4(col, alpha);
          #include <fog_fragment>
        }` });
    this.water = new THREE.Mesh(wg, wm); this.water.position.y = WORLD.waterY; scene.add(this.water);
  },
  waterUpdate(t) {
    const u = this.waterU, d = Sky.domeU; u.uTime.value = t; u.uCamPos.value.copy(Game.camera.position);
    if (d) { u.uTop.value.copy(d.top.value); u.uHor.value.copy(d.hor.value); u.uSunDir.value.copy(d.sunDir.value); u.uSunCol.value.copy(d.sunCol.value); const h = d.hor.value; u.uLight.value = clamp(0.2 + (h.r * 0.3 + h.g * 0.59 + h.b * 0.11) * 0.95, 0.25, 1.1); }
    u.uRain.value = damp(u.uRain.value, Sky.raining && Sky.raining() ? 1 : 0, 0.5, 1 / 60);
  },
  height(x, z) {
    const n = this.n, fx = (x + WORLD.half) / WORLD.res, fz = (z + WORLD.half) / WORLD.res;
    const i = clamp(Math.floor(fx), 0, n - 2), j = clamp(Math.floor(fz), 0, n - 2), u = clamp(fx - i, 0, 1), v = clamp(fz - j, 0, 1), H = this.H;
    // match PlaneGeometry triangle split (a=i,j b=i,j+1 c=i+1,j+1 d=i+1,j : triangles abd, bcd)
    const h00 = H[j * n + i], h10 = H[j * n + i + 1], h01 = H[(j + 1) * n + i], h11 = H[(j + 1) * n + i + 1];
    if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
    return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  },
  setWet(w) { const c = this.mesh.geometry.attributes.color, b = this.baseCol, k = 1 - w * 0.28; for (let i = 0; i < b.length; i++) c.array[i] = b[i] * k; c.needsUpdate = true; }
};

/* ---------- Colliders (spatial hash) ---------- */
const Col = {
  cell: 8, map: new Map(), all: [],
  key(i, j) { return i * 10007 + j; },
  add(c) {
    if (c.type === 'circle') { c.minX = c.x - c.r; c.maxX = c.x + c.r; c.minZ = c.z - c.r; c.maxZ = c.z + c.r; }
    c.on = c.on !== false; this.all.push(c);
    for (let i = Math.floor(c.minX / this.cell); i <= Math.floor(c.maxX / this.cell); i++) for (let j = Math.floor(c.minZ / this.cell); j <= Math.floor(c.maxZ / this.cell); j++) { const k = this.key(i, j); if (!this.map.has(k)) this.map.set(k, []); this.map.get(k).push(c); }
    return c;
  },
  box(minX, maxX, minZ, maxZ, y0, y1, o = {}) { return this.add(Object.assign({ type: 'box', minX, maxX, minZ, maxZ, y0, y1 }, o)); },
  circle(x, z, r, y0, y1, o = {}) { return this.add(Object.assign({ type: 'circle', x, z, r, y0, y1 }, o)); },
  near(x, z, r, out) { out.length = 0; const seen = this._seen || (this._seen = new Set()); seen.clear();
    for (let i = Math.floor((x - r) / this.cell); i <= Math.floor((x + r) / this.cell); i++) for (let j = Math.floor((z - r) / this.cell); j <= Math.floor((z + r) / this.cell); j++) { const a = this.map.get(this.key(i, j)); if (a) for (const c of a) if (c.on && !seen.has(c)) { seen.add(c); out.push(c); } }
    return out; },
  _tmp: [],
  ground(x, z, yRef) {
    let g = Terrain.height(x, z); const list = this.near(x, z, 0.1, this._tmp);
    for (const c of list) if (c.walk && x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ && c.y1 <= yRef + 0.55 && c.y1 > g) g = c.y1;
    return g;
  },
  // push a circle (x,z,r) at height [y, y+h] out of colliders; returns {x,z,hit}
  resolve(p, r, y, h) {
    let hit = null; const list = this.near(p.x, p.z, r + 1, this._tmp);
    for (const c of list) {
      if (y >= c.y1 - 0.56 || y + h <= c.y0) continue;
      if (c.type === 'circle') { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = r + c.r; if (d < m && d > 1e-5) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; hit = c; } }
      else { const cx = clamp(p.x, c.minX, c.maxX), cz = clamp(p.z, c.minZ, c.maxZ); let dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
        if (d < r) { if (d < 1e-5) { const l = p.x - c.minX, rr = c.maxX - p.x, t = p.z - c.minZ, b = c.maxZ - p.z, m = Math.min(l, rr, t, b); if (m === l) p.x = c.minX - r; else if (m === rr) p.x = c.maxX + r; else if (m === t) p.z = c.minZ - r; else p.z = c.maxZ + r; } else { p.x = cx + dx / d * r; p.z = cz + dz / d * r; } hit = c; } }
    }
    return hit;
  },
  // line of sight test in XZ with height; true if clear
  los(ax, ay, az, bx, by, bz) {
    const d = Math.hypot(bx - ax, bz - az), steps = Math.ceil(d / 1.2);
    for (let s = 1; s < steps; s++) { const t = s / steps, x = lerp(ax, bx, t), z = lerp(az, bz, t), y = lerp(ay, by, t);
      if (Terrain.height(x, z) > y + 0.2) return false;
      const list = this.near(x, z, 0.05, this._tmp2 || (this._tmp2 = []));
      for (const c of list) { if (!c.block || y < c.y0 || y > c.y1) continue; if (c.type === 'box' ? (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) : Math.hypot(x - c.x, z - c.z) < c.r) return false; }
    }
    return true;
  }
};

/* ---------- Materials & mesh helpers (asset layer: swap these for real models later) ---------- */
const MAT = {}; let GRAD;
function toon(color, o = {}) {
  const k = color + JSON.stringify(o); if (MAT[k]) return MAT[k];
  if (!GRAD) { GRAD = new THREE.DataTexture(new Uint8Array([135, 180, 222, 255]), 4, 1, THREE.LuminanceFormat); GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true; }
  return MAT[k] = new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: GRAD }, o));
}
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(1, 16, 12), sphLo: new THREE.SphereGeometry(1, 10, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12), cone: new THREE.ConeGeometry(1, 1, 10), ico: new THREE.IcosahedronGeometry(1, 1), dod: new THREE.DodecahedronGeometry(1, 0),
};
function M(geo, color, sx = 1, sy = 1, sz = 1, x = 0, y = 0, z = 0, o) { const m = new THREE.Mesh(geo, typeof color === 'string' || typeof color === 'number' ? toon(color, o) : color); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
function labelTex(text, bg = '#6b3e1f', fg = '#f4ead3', w = 256, h = 64) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = fg; g.font = `bold ${Math.floor(h * 0.42)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); return new THREE.MeshBasicMaterial({ map: t });
}

/* ---------- Structures ---------- */
const Buildings = []; const Doors = []; const WallMeshes = [];
/* ---------- procedural surface textures (generated on canvas; tinted by each material's colour) ---------- */
const TEX = {}, TEXMAT = {};
function canvasTex(name, size, draw) { if (TEX[name]) return TEX[name]; const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); const R = mulberry(name.length * 7919 + size); draw(g, size, R); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return TEX[name] = t; }
const SURF = {
  siding: () => canvasTex('siding', 256, (g, S, R) => { const n = 8, bh = S / n; for (let i = 0; i < n; i++) { const v = 205 + R() * 40; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, i * bh, S, bh); for (let k = 0; k < 9; k++) { const y = i * bh + 3 + R() * (bh - 6), a = 0.06 + R() * 0.1; g.strokeStyle = `rgba(60,40,20,${a})`; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= S; x += 32) g.lineTo(x, y + Math.sin(x * 0.04 + k) * 1.2); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(0, i * bh + bh - 3, S, 3); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, i * bh, S, 1.5); for (let x = 20 + R() * 40; x < S; x += 90 + R() * 60) { g.fillStyle = 'rgba(40,30,20,0.5)'; g.fillRect(x, i * bh + bh * 0.5, 2, 2); } } }),
  panel: () => canvasTex('panel', 256, (g, S, R) => { const n = 6, bw = S / n; for (let i = 0; i < n; i++) { const v = 200 + R() * 45; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i * bw, 0, bw, S); for (let k = 0; k < 7; k++) { const x = i * bw + 3 + R() * (bw - 6); g.strokeStyle = `rgba(60,40,20,${0.05 + R() * 0.1})`; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= S; y += 32) g.lineTo(x + Math.sin(y * 0.05 + k) * 1.3, y); g.stroke(); } g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(i * bw + bw - 2.5, 0, 2.5, S); } }),
  floor: () => canvasTex('floor', 256, (g, S, R) => { const n = 5, bw = S / n; for (let i = 0; i < n; i++) { const v = 195 + R() * 45; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i * bw, 0, bw, S); for (let k = 0; k < 8; k++) { const x = i * bw + 2 + R() * (bw - 4); g.strokeStyle = `rgba(50,30,15,${0.06 + R() * 0.12})`; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= S; y += 32) g.lineTo(x + Math.sin(y * 0.06 + k) * 1.5, y); g.stroke(); }
      const cut = R() * S; g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(i * bw, cut, bw, 2); g.fillRect(i * bw + bw - 2, 0, 2, S); if (R() < 0.6) { g.fillStyle = 'rgba(70,45,25,0.45)'; g.beginPath(); g.ellipse(i * bw + bw * 0.5, R() * S, 4, 6, 0, 0, 6.3); g.fill(); } } }),
  shingle: () => canvasTex('shingle', 256, (g, S, R) => { const n = 8, rw = S / n; // rows run down the slope's u axis, so courses lie along the ridge
      for (let i = 0; i < n; i++) { const off = (i % 2) * 16; for (let y = -16; y < S; y += 32) { const v = 170 + R() * 60; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i * rw, y + off, rw, 30); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(i * rw, y + off + 30, rw, 2); }
        g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(i * rw + rw - 5, 0, 5, S); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(i * rw, 0, 2, S); } }),
  stone: () => canvasTex('stone', 256, (g, S, R) => { g.fillStyle = '#6e6a63'; g.fillRect(0, 0, S, S); for (let y = 0; y < S; y += 32) for (let x = -(y % 64 ? 24 : 0); x < S; x += 48) { const v = 150 + R() * 70; g.fillStyle = `rgb(${v},${v - 4},${v - 10})`; g.beginPath(); g.roundRect ? g.roundRect(x + 2, y + 2, 44, 28, 6) : g.rect(x + 2, y + 2, 44, 28); g.fill(); } }),
};
function texMat(name, color, o = {}) { const k = name + color + (o.side || ''); if (TEXMAT[k]) return TEXMAT[k]; if (!GRAD) toon('#fff'); return TEXMAT[k] = new THREE.MeshToonMaterial(Object.assign({ color, map: SURF[name](), gradientMap: GRAD }, o)); }
function uvBox(w, h, d, tile) { // a box whose texture coordinates are in metres/tile, so boards stay the same size on every wall
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
  return g;
}
function building(o) {
  // o: x,z,w,d,door:'S'|'N'|'W',wall,roof,name,sign
  const g = new THREE.Group(); const gy = Terrain.height(o.x, o.z); g.position.set(o.x, gy, o.z); Game.scene.add(g);
  const W = o.w, D = o.d, H = o.h || 3.4, t = 0.3, fy = 0.35, dw = 1.7;
  const b = { o, g, x: o.x, z: o.z, y: gy, minX: o.x - W / 2, maxX: o.x + W / 2, minZ: o.z - D / 2, maxZ: o.z + D / 2, roofs: [], name: o.name, floor: gy + fy };
  Col.box(b.minX, b.maxX, b.minZ, b.maxZ, gy - 2, gy + fy, { walk: true });
  g.add(M(GEO.box, '#8b6a47', W, fy, D, 0, fy / 2, 0));
  const plank = new THREE.Mesh(uvBox(W - 0.4, 0.02, D - 0.4, 2.4), texMat('floor', '#b08a60')); plank.position.set(0, fy + 0.01, 0); plank.receiveShadow = true; g.add(plank);
  const wallMat = texMat(o.surface || 'siding', o.wall || '#c98f5a');
  const addWall = (lx0, lx1, lz0, lz1) => { const m = new THREE.Mesh(uvBox(lx1 - lx0, H, lz1 - lz0, 2.2), wallMat); m.position.set((lx0 + lx1) / 2, fy + H / 2, (lz0 + lz1) / 2); m.castShadow = m.receiveShadow = true; g.add(m); WallMeshes.push(m);
    Col.box(o.x + lx0, o.x + lx1, o.z + lz0, o.z + lz1, gy, gy + fy + H, { block: true }); };
  const hw = W / 2, hd = D / 2, side = o.door || 'S';
  // front/back walls along x, side walls along z, door gap in the door wall
  const dz = side === 'S' ? hd : -hd;
  const wallX = (zc, door) => { if (door) { addWall(-hw, -dw / 2, zc - t / 2, zc + t / 2); addWall(dw / 2, hw, zc - t / 2, zc + t / 2); const lint = M(GEO.box, o.wall || '#c98f5a', dw, H - 2.4, t, 0, fy + 2.4 + (H - 2.4) / 2, zc); g.add(lint); } else addWall(-hw, hw, zc - t / 2, zc + t / 2); };
  wallX(hd - t / 2, side === 'S'); wallX(-hd + t / 2, side === 'N');
  addWall(-hw, -hw + t, -hd, hd); addWall(hw - t, hw, -hd, hd);
  // trim + windows
  const trim = o.trim || '#f4ead3';
  for (const s of [-1, 1]) { const wx = s * hw * 0.55; if (W > 6) { g.add(M(GEO.box, '#3c5a6e', 1.1, 1.0, 0.06, wx, fy + 1.7, dz + (side === 'S' ? 0.02 : -0.02) * 1)); g.add(M(GEO.box, trim, 1.3, 0.12, 0.1, wx, fy + 1.15, dz)); } }
  g.add(M(GEO.box, '#3c5a6e', 0.06, 1.0, 1.1, hw + 0.02, fy + 1.7, 0)); g.add(M(GEO.box, '#3c5a6e', 0.06, 1.0, 1.1, -hw - 0.02, fy + 1.7, 0));
  // interior shell: plank walls with darker wainscoting and a skirting board, inside window frames, floorboards, beams and a
  // ceiling (it casts shadow, so rooms are shaded like real rooms once the roof hides when you step inside)
  if (o.interior !== false) {
    const iw = o.inside || '#b98f65', wain = o.wainscot || '#7a5232', inT = 0.02, ix = hw - t - inT, iz = hd - t - inT;
    const pm = texMat('panel', iw), wm2 = texMat('panel', wain), panel = (lx0, lx1, lz0, lz1) => { const w = Math.max(lx1 - lx0, 0.04), d = Math.max(lz1 - lz0, 0.04), cx = (lx0 + lx1) / 2, cz = (lz0 + lz1) / 2; const up = new THREE.Mesh(uvBox(w, H - 1.05, d, 1.6), pm); up.position.set(cx, fy + 1.05 + (H - 1.05) / 2, cz); up.receiveShadow = true; g.add(up); const lo = new THREE.Mesh(uvBox(w, 1.0, d, 0.9), wm2); lo.position.set(cx, fy + 0.5, cz); lo.receiveShadow = true; g.add(lo); g.add(M(GEO.box, '#3b2a1e', w + 0.01, 0.06, d + 0.01, cx, fy + 1.03, cz)); g.add(M(GEO.box, '#3b2a1e', w + 0.01, 0.12, d + 0.01, cx, fy + 0.06, cz)); };
    const doorZ = side === 'S' ? iz : -iz;
    for (const zc of [iz, -iz]) { const dzc = zc + (zc > 0 ? -inT : inT); if ((zc > 0) === (side === 'S') && side !== 'W') { panel(-ix, -dw / 2, dzc - inT, dzc + inT); panel(dw / 2, ix, dzc - inT, dzc + inT); } else panel(-ix, ix, dzc - inT, dzc + inT); }
    for (const xc of [ix, -ix]) panel(xc - inT, xc + inT, -iz, iz);
    const win = (x, z, ry) => { const f = new THREE.Group(); f.position.set(x, fy + 1.7, z); f.rotation.y = ry; f.add(M(GEO.box, '#9fc3d8', 1.0, 0.9, 0.02)); for (const [w, h, px, py] of [[1.16, 0.08, 0, 0.49], [1.16, 0.08, 0, -0.49], [0.08, 1.0, 0.54, 0], [0.08, 1.0, -0.54, 0], [0.05, 0.9, 0, 0], [1.0, 0.05, 0, 0]]) f.add(M(GEO.box, trim, w, h, 0.05, px, py, 0.02)); f.add(M(GEO.box, trim, 1.3, 0.08, 0.16, 0, -0.54, 0.06)); g.add(f); };
    win(ix - 0.03, 0, -Math.PI / 2); win(-ix + 0.03, 0, Math.PI / 2); if (W > 6) for (const sx of [-1, 1]) win(sx * hw * 0.55, doorZ + (side === 'S' ? -0.03 : 0.03), side === 'S' ? Math.PI : 0);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W - 2 * t, D - 2 * t), toon(o.ceiling || '#8b6a47')); ceil.rotation.x = Math.PI / 2; ceil.position.y = fy + H - 0.02; ceil.castShadow = true; ceil.receiveShadow = true; g.add(ceil);
    for (let k = -W / 2 + 1.2; k < W / 2 - 0.8; k += 1.8) g.add(M(GEO.box, '#5a3a22', 0.18, 0.2, D - 2 * t, k, fy + H - 0.12, 0));
  }
  // false front (western facade) & roof
  const roof = new THREE.Group(); roof.position.y = fy + H; g.add(roof); b.roofs.push(roof);
  const rc = o.roof || '#7a4b3a', ang = 0.42, rl = (W / 2 + 0.4) / Math.cos(ang);
  for (const s of [-1, 1]) { const r = new THREE.Mesh(uvBox(rl, 0.15, D + 0.8, 1.8), texMat('shingle', rc)); r.position.set(s * (W / 4 + 0.1), Math.tan(ang) * W / 4, 0); r.castShadow = r.receiveShadow = true; r.rotation.z = -s * ang; roof.add(r); }
  const gable = new THREE.Shape(); gable.moveTo(-hw, 0); gable.lineTo(hw, 0); gable.lineTo(0, Math.tan(ang) * hw); gable.lineTo(-hw, 0);
  const gg = new THREE.ShapeGeometry(gable); for (const s of [-1, 1]) { const m = new THREE.Mesh(gg, toon(o.wall || '#c98f5a', { side: THREE.DoubleSide })); m.position.z = s * (hd - 0.05); roof.add(m); }
  if (o.facade) { const f = M(GEO.box, o.wall || '#c98f5a', W + 0.2, 2.2, 0.25, 0, fy + H + 0.9, dz + (side === 'S' ? 0.1 : -0.1)); g.add(f); }
  if (o.sign) { const s = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(W - 1, 6), 1.1), labelTex(o.sign)); s.position.set(0, fy + H + 0.9, dz + (side === 'S' ? 0.25 : -0.25)); if (side === 'N') s.rotation.y = Math.PI; g.add(s); }
  // porch
  if (o.porch !== false) {
    const pd = 2.2, pz = side === 'S' ? hd + pd / 2 : -hd - pd / 2; g.add(M(GEO.box, '#9c7650', W, 0.3, pd, 0, 0.15, pz));
    Col.box(o.x - W / 2, o.x + W / 2, o.z + pz - pd / 2, o.z + pz + pd / 2, gy - 2, gy + 0.3, { walk: true });
    const aw = M(GEO.box, rc, W + 0.2, 0.12, pd + 0.3, 0, fy + 2.75, pz); aw.rotation.x = side === 'S' ? 0.18 : -0.18; g.add(aw);
    for (const px of [-hw + 0.2, hw - 0.2]) { g.add(M(GEO.cyl, '#6b4a2f', 0.09, 2.8, 0.09, px, 1.5, pz + (side === 'S' ? pd / 2 - 0.15 : -pd / 2 + 0.15))); Col.circle(o.x + px, o.z + pz + (side === 'S' ? pd / 2 - 0.15 : -pd / 2 + 0.15), 0.12, gy, gy + 3, { block: true }); }
  }
  // door
  const door = { b, open: false, locked: () => false, ang: 0, x: o.x, z: o.z + dz, side };
  const hinge = new THREE.Group(); hinge.position.set(-dw / 2, fy, dz); g.add(hinge);
  const dm = M(GEO.box, '#6b4226', dw - 0.05, 2.35, 0.1, dw / 2, 1.18, 0); hinge.add(dm); hinge.add(M(GEO.sph, '#e9c46a', 0.06, 0.06, 0.06, dw - 0.2, 1.1, side === 'S' ? 0.08 : -0.08));
  door.hinge = hinge; door.col = Col.box(o.x - dw / 2, o.x + dw / 2, o.z + dz - 0.15, o.z + dz + 0.15, gy, gy + 3, { block: true });
  door.outer = { x: o.x, z: o.z + dz + (side === 'S' ? 1.4 : -1.4) }; door.inner = { x: o.x, z: o.z + dz + (side === 'S' ? -1.3 : 1.3) };
  b.door = door; Doors.push(door); Buildings.push(b);
  if (o.lamp !== false) { const lp = new THREE.PointLight(0xffb867, 0, 9, 2); lp.position.set(o.x, gy + fy + 2.6, o.z); Game.scene.add(lp); Game.lamps.push(lp); }
  return b;
}
function inBuilding(x, z, y) { for (const b of Buildings) if (x > b.minX + 0.1 && x < b.maxX - 0.1 && z > b.minZ + 0.1 && z < b.maxZ - 0.1 && y > b.y - 0.5 && y < b.y + 4) return b; return null; }
function prop(parent, mesh, x, z, colR, h = 1, walk = false) { parent.add(mesh); parent.updateMatrixWorld(true); const wp = new THREE.Vector3(); mesh.getWorldPosition(wp); if (colR) { if (walk) Col.box(wp.x - colR, wp.x + colR, wp.z - colR, wp.z + colR, wp.y - 1, wp.y + h, { walk: true, block: true, cover: true }); else Col.circle(wp.x, wp.z, colR, wp.y - 1, wp.y + h, { block: true }); } return mesh; }

/* ---------- wind-animated materials for foliage & grass ---------- */
const WIND = { uTime: { value: 0 }, uStrength: { value: 1 } }; const _windMats = {};
function windMat(color, amp) {
  const k = color + amp; if (_windMats[k]) return _windMats[k]; if (!GRAD) toon('#fff');
  const m = new THREE.MeshToonMaterial({ color, gradientMap: GRAD });
  m.onBeforeCompile = sh => { sh.uniforms.uTime = WIND.uTime; sh.uniforms.uStr = WIND.uStrength; sh.uniforms.uAmp = { value: amp };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uAmp; uniform float uStr;').replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 ip = vec3(0.0);
      #endif
      float hw = max(position.y + 0.5, 0.0);
      float ph = uTime * 1.6 + ip.x * 0.21 + ip.z * 0.17;
      transformed.x += (sin(ph) + 0.4 * sin(ph * 2.3)) * hw * uAmp * uStr * 0.6;
      transformed.z += cos(ph * 0.8 + 1.3) * hw * uAmp * uStr * 0.4;`); };
  m.customProgramCacheKey = () => 'wind';
  return _windMats[k] = m;
}
function mergeTufts(geo, offsets) { // merge a few tilted blades into one tuft geometry
  const parts = offsets.map((o, i) => { const g = geo.clone(); g.rotateZ((i - 1) * 0.35); g.rotateY(i * 2.1); g.translate(o.x, 0, o.z); return g.index ? g.toNonIndexed() : g; });
  const n = parts.reduce((a, g) => a + g.attributes.position.count, 0), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let off = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, off * 3); nor.set(g.attributes.normal.array, off * 3); off += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return out;
}
