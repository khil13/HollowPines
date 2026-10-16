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
];
const TRAILS = [
  [[-40, 20], [-5, 18], [riverX(0) - 16, 0], [riverX(0) + 16, 0], [95, -30], [120, -70], [135, -85]],
  [[-60, 22], [-90, 50], [-120, 95]],
  [[-60, 18], [-100, -20], [-150, -85]],
  [[-100, -20], [-70, -110], [-55, -140]],
  [[-70, -110], [riverX(-120) - 10, -120], [riverX(-120) + 12, -120], [110, -100], [135, -85]],
  [[riverX(0) + 16, 0], [110, 60], [150, 140]],
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
    // water
    const wg = new THREE.PlaneGeometry(WORLD.size, WORLD.size, 1, 1); wg.rotateX(-Math.PI / 2);
    const wm = new THREE.MeshLambertMaterial({ color: 0x4f9fc8, transparent: true, opacity: 0.82 }); this.waterU = { uTime: { value: 0 } };
    wm.onBeforeCompile = sh => { sh.uniforms.uTime = this.waterU.uTime; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vWp;').replace('#include <dithering_fragment>', 'float w = sin(vWp.x*0.9+uTime*1.3)*sin(vWp.z*0.7-uTime*1.1)+sin((vWp.x+vWp.z)*0.35+uTime*0.7)*0.6; gl_FragColor.rgb += vec3(0.07,0.09,0.1)*smoothstep(0.75,1.4,w); gl_FragColor.rgb -= vec3(0.02,0.015,0.0)*smoothstep(0.3,-0.8,w);\n#include <dithering_fragment>'); };
    this.water = new THREE.Mesh(wg, wm); this.water.position.y = WORLD.waterY; scene.add(this.water);
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
function building(o) {
  // o: x,z,w,d,door:'S'|'N'|'W',wall,roof,name,sign
  const g = new THREE.Group(); const gy = Terrain.height(o.x, o.z); g.position.set(o.x, gy, o.z); Game.scene.add(g);
  const W = o.w, D = o.d, H = o.h || 3.4, t = 0.3, fy = 0.35, dw = 1.7;
  const b = { o, g, x: o.x, z: o.z, y: gy, minX: o.x - W / 2, maxX: o.x + W / 2, minZ: o.z - D / 2, maxZ: o.z + D / 2, roofs: [], name: o.name, floor: gy + fy };
  Col.box(b.minX, b.maxX, b.minZ, b.maxZ, gy - 2, gy + fy, { walk: true });
  g.add(M(GEO.box, '#8b6a47', W, fy, D, 0, fy / 2, 0));
  const plank = M(GEO.box, '#a7825a', W - 0.4, 0.02, D - 0.4, 0, fy + 0.01, 0); g.add(plank);
  const wallMat = toon(o.wall || '#c98f5a');
  const addWall = (lx0, lx1, lz0, lz1) => { const m = new THREE.Mesh(GEO.box, wallMat); m.scale.set(lx1 - lx0, H, lz1 - lz0); m.position.set((lx0 + lx1) / 2, fy + H / 2, (lz0 + lz1) / 2); m.castShadow = m.receiveShadow = true; g.add(m); WallMeshes.push(m);
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
  // false front (western facade) & roof
  const roof = new THREE.Group(); roof.position.y = fy + H; g.add(roof); b.roofs.push(roof);
  const rc = o.roof || '#7a4b3a', ang = 0.42, rl = (W / 2 + 0.4) / Math.cos(ang);
  for (const s of [-1, 1]) { const r = M(GEO.box, rc, rl, 0.15, D + 0.8, s * (W / 4 + 0.1), Math.tan(ang) * W / 4, 0); r.rotation.z = -s * ang; roof.add(r); }
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
