/* ===== Interiors: furnishing every building so stepping inside feels like stepping into a lived-in room =====
   Local coordinates are relative to each building's centre (door 'S' = +z, 'N' = -z). The floor top is at y 0.35.
   Big pieces along the walls get colliders; anything near an NPC's place (desk chairs, beds, bar spots) stays clear. */
const Interiors = {
  F: 0.35,
  build() {
    const B = n => Buildings.find(b => b.name === n);
    this.sheriff(B("Sheriff's office")); this.store(B('General store')); this.saloon(B('Saloon')); this.mae(B("Mae's house")); this.doc(B("Doc Pell's"));
    this.boarding(B('Boarding house')); this.farmhouse(B('Greer farmhouse')); this.barn(B('Greer barn')); this.mill(B('Coyote Mill')); this.cabin(B('Hollow Cabin'));
  },
  put(b, geo, col, sx, sy, sz, lx, ly, lz, o = {}) { // ly is the bottom of the piece above the floor
    const m = M(geo, col, sx, sy, sz, lx, this.F + ly + sy / 2, lz, o.mat); if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz; b.g.add(m);
    if (o.col) { const turn = o.ry && Math.abs(Math.sin(o.ry)) > 0.7, hx = (turn ? sz : sx) / 2 + 0.04, hz = (turn ? sx : sz) / 2 + 0.04; Col.box(b.x + lx - hx, b.x + lx + hx, b.z + lz - hz, b.z + lz + hz, b.y - 1, b.floor + ly + sy, { block: true, cover: !!o.cover }); }
    return m;
  },
  glow: { emissive: '#ffb84a', emissiveIntensity: 0.9 },
  lamp(b, x, z, h = 3.0) { this.put(b, GEO.cyl, '#2b2b2b', 0.02, 3.35 - h, 0.02, x, h + 0.25, z); this.put(b, GEO.cyl, '#3b2a1e', 0.18, 0.06, 0.18, x, h + 0.2, z); this.put(b, GEO.box, '#ffd27a', 0.16, 0.22, 0.16, x, h - 0.05, z, { mat: this.glow }); },
  candle(b, x, y, z) { this.put(b, GEO.cyl, '#f4ead3', 0.03, 0.12, 0.03, x, y, z); this.put(b, GEO.sphLo, '#ffd27a', 0.03, 0.05, 0.03, x, y + 0.13, z, { mat: this.glow }); },
  rug(b, x, z, w, d, col, edge = '#e9c46a') { this.put(b, GEO.box, edge, w, 0.012, d, x, 0.01, z); this.put(b, GEO.box, col, w - 0.2, 0.014, d - 0.2, x, 0.012, z); },
  chair(b, x, z, ry = 0, col = '#6b4226') { const g = new THREE.Group(); g.position.set(x, this.F, z); g.rotation.y = ry; g.add(M(GEO.box, col, 0.45, 0.06, 0.45, 0, 0.45, 0)); for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) g.add(M(GEO.box, col, 0.05, 0.45, 0.05, lx, 0.22, lz)); g.add(M(GEO.box, col, 0.45, 0.5, 0.05, 0, 0.72, -0.2)); b.g.add(g); },
  table(b, x, z, w, d, col = '#7a5232', h = 0.75) { this.put(b, GEO.box, col, w, 0.06, d, x, h - 0.06, z); for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.put(b, GEO.box, '#5a3a22', 0.07, h - 0.06, 0.07, x + lx * (w / 2 - 0.08), 0, z + lz * (d / 2 - 0.08)); },
  stove(b, x, z) { this.put(b, GEO.box, '#2b2b2b', 0.7, 0.8, 0.6, x, 0.05, z, { col: true }); this.put(b, GEO.box, '#1b1b1b', 0.74, 0.05, 0.64, x, 0.85, z); this.put(b, GEO.box, '#ff8a3a', 0.3, 0.12, 0.02, x, 0.35, z + 0.31, { mat: { emissive: '#ff6a1a', emissiveIntensity: 0.7 } }); this.put(b, GEO.cyl, '#3b3b3b', 0.09, 2.3, 0.09, x, 0.9, z - 0.1); for (const s of [-1, 1]) this.put(b, GEO.box, '#2b2b2b', 0.06, 0.05, 0.06, x + s * 0.3, 0, z + s * 0.25); },
  shelf(b, x, z, ry, w, items = ['#c8443a', '#e9c46a', '#4f7ca8', '#9dbf8a', '#f4ead3'], rows = 2, y0 = 1.1) { // wall shelf with goods
    const g = new THREE.Group(); g.position.set(x, this.F, z); g.rotation.y = ry; b.g.add(g);
    for (let r = 0; r < rows; r++) { const y = y0 + r * 0.55; g.add(M(GEO.box, '#6b4226', w, 0.05, 0.28, 0, y, 0)); for (let k = 0; k < Math.floor(w / 0.22); k++) { const c = items[(k * 7 + r * 3) % items.length]; if ((k + r) % 4 === 3) continue; g.add(k % 3 === 0 ? M(GEO.box, c, 0.16, 0.2, 0.14, -w / 2 + 0.15 + k * 0.22, y + 0.125, 0) : M(GEO.cyl, c, 0.06, 0.24, 0.06, -w / 2 + 0.15 + k * 0.22, y + 0.15, 0)); } }
  },
  frame(b, x, y, z, ry, w, h, col) { const g = new THREE.Group(); g.position.set(x, this.F + y, z); g.rotation.y = ry; g.add(M(GEO.box, '#5a3a22', w + 0.1, h + 0.1, 0.04)); g.add(M(GEO.box, col, w, h, 0.05)); b.g.add(g); },
  crate(b, x, z, s = 0.6, ly = 0, col = true) { this.put(b, GEO.box, '#8b6a47', s, s, s, x, ly, z, { col, cover: true }); this.put(b, GEO.box, '#6b4a2f', s + 0.02, 0.06, s + 0.02, x, ly + s * 0.5, z); },
  barrel(b, x, z, col = true) { this.put(b, GEO.cyl, '#8b5a2b', 0.38, 0.9, 0.38, x, 0, z, { col }); for (const y of [0.15, 0.75]) this.put(b, GEO.cyl, '#3b2a1e', 0.4, 0.05, 0.4, x, y, z); },
  sack(b, x, z, ly = 0) { this.put(b, GEO.sphLo, '#d9c58f', 0.32, 0.4, 0.28, x, ly, z); },
  bed(b, x, z, ry = 0, col = '#4f7ca8') { const g = new THREE.Group(); g.position.set(x, this.F, z); g.rotation.y = ry; g.add(M(GEO.box, '#6b4226', 1.1, 0.35, 2.1, 0, 0.27, 0)); g.add(M(GEO.box, col, 1.06, 0.14, 1.5, 0, 0.5, 0.25)); g.add(M(GEO.box, '#f4ead3', 0.8, 0.14, 0.4, 0, 0.52, -0.75)); g.add(M(GEO.box, '#5a3a22', 1.15, 0.8, 0.08, 0, 0.45, -1.06)); b.g.add(g); },
  window(b) { /* inner frames come from building() */ },
  /* ---- parlor pieces (decor only: none of these block movement, so NPC routes are unchanged) ---- */
  // cloth curtains either side of every window, hung from a rod
  curtains(b, col = '#8a3b3b') {
    const o = b.o, ix = o.w / 2 - 0.4, iz = o.d / 2 - 0.4, front = o.door === 'N' ? -iz : iz;
    for (const s of [-1, 1]) { for (const e of [-1, 1]) this.put(b, GEO.box, col, 0.05, 1.35, 0.3, s * ix, 0.7, e * 0.72); this.put(b, GEO.cyl, '#3b2a1e', 0.02, 1.9, 0.02, s * ix, 2.06 - 0.95, 0, { rx: Math.PI / 2 }); /* put() measures from the piece's bottom before it is turned */ this.put(b, GEO.box, col, 0.06, 0.16, 1.5, s * ix, 1.92, 0); }
    if (o.w > 6) for (const s of [-1, 1]) { const wx = s * o.w / 2 * 0.55; for (const e of [-1, 1]) this.put(b, GEO.box, col, 0.3, 1.35, 0.05, wx + e * 0.72, 0.7, front); this.put(b, GEO.box, col, 1.5, 0.16, 0.06, wx, 1.92, front); }
  },
  // a stone fireplace against a wall, facing local +z before ry: hearth, glowing fire, logs, mantel with a clock
  fireplace(b, x, z, ry = 0) {
    const g = new THREE.Group(); g.position.set(x, this.F, z); g.rotation.y = ry; b.g.add(g); const stone = '#8d8a83';
    g.add(M(GEO.box, stone, 1.5, 3.05, 0.4, 0, 1.52, 0)); g.add(M(GEO.box, '#7d7a73', 1.8, 0.08, 0.8, 0, 0.04, 0.25)); g.add(M(GEO.box, '#1b1512', 0.85, 0.8, 0.1, 0, 0.48, 0.17));
    for (const [sx, sy, px, py] of [[0.22, 0.2, -0.52, 0.3], [0.22, 0.2, 0.52, 0.7], [0.3, 0.18, -0.5, 1.9], [0.26, 0.2, 0.45, 2.4], [0.24, 0.18, 0.1, 2.75]]) g.add(M(GEO.box, '#a19d94', sx, sy, 0.02, px, py, 0.21)); // a few proud stones
    for (const s of [-1, 1]) { const lg = M(GEO.cyl, '#4a3020', 0.06, 0.6, 0.06, s * 0.05, 0.14 + (s > 0 ? 0.08 : 0), 0.3); lg.rotation.z = Math.PI / 2 + s * 0.2; g.add(lg); }
    const fl = M(GEO.cone, '#ff9a3a', 0.2, 0.45, 0.12, 0, 0.42, 0.28, { emissive: '#ff6a1a', emissiveIntensity: 1.0 }); g.add(fl); g.add(M(GEO.cone, '#ffd27a', 0.1, 0.28, 0.08, 0.05, 0.36, 0.3, this.glow)); this.flames.push(fl);
    g.add(M(GEO.box, '#5a3a22', 1.75, 0.09, 0.55, 0, 1.3, 0.1)); g.add(M(GEO.box, '#5a3a22', 0.3, 0.42, 0.14, 0, 1.56, 0.12)); g.add(M(GEO.cyl, '#f4ead3', 0.1, 0.02, 0.1, 0, 1.62, 0.2).rotateX(Math.PI / 2)); // mantel and clock
    for (const s of [-1, 1]) { g.add(M(GEO.cyl, '#f4ead3', 0.03, 0.14, 0.03, s * 0.62, 1.42, 0.14)); g.add(M(GEO.sphLo, '#ffd27a', 0.03, 0.05, 0.03, s * 0.62, 1.52, 0.14, this.glow)); }
  },
  flames: [],
  bookcase(b, x, z, ry = 0, w = 1.0, h = 1.9) {
    const g = new THREE.Group(); g.position.set(x, this.F, z); g.rotation.y = ry; b.g.add(g); const R = mulberry(Math.round(x * 31 + z * 17) + 99), cols = ['#8a3b3b', '#3c5a6e', '#5f7a4a', '#b08a3a', '#5a3a50', '#d9c58f'];
    g.add(M(GEO.box, '#5a3a22', w, h, 0.05, 0, h / 2, -0.13)); for (const s of [-1, 1]) g.add(M(GEO.box, '#6b4226', 0.05, h, 0.3, s * w / 2, h / 2, 0)); g.add(M(GEO.box, '#6b4226', w + 0.08, 0.06, 0.34, 0, h, 0));
    for (let r = 0; r < 4; r++) { const y = 0.08 + r * (h - 0.1) / 4; g.add(M(GEO.box, '#6b4226', w, 0.04, 0.3, 0, y, 0)); let bx = -w / 2 + 0.08; while (bx < w / 2 - 0.12) { const bw = 0.05 + R() * 0.05, bh = 0.24 + R() * 0.12; if (R() > 0.15) g.add(M(GEO.box, cols[Math.floor(R() * cols.length)], bw, bh, 0.2, bx + bw / 2, y + 0.02 + bh / 2, 0)); bx += bw + 0.008; } }
  },
  armchair(b, x, z, ry = 0, col = '#7a3b3b') {
    const g = new THREE.Group(); g.position.set(x, this.F, z); g.rotation.y = ry; b.g.add(g);
    g.add(M(GEO.box, col, 0.75, 0.3, 0.7, 0, 0.3, 0)); g.add(M(GEO.box, col, 0.75, 0.75, 0.16, 0, 0.72, -0.3)); for (const s of [-1, 1]) { g.add(M(GEO.box, col, 0.14, 0.34, 0.7, s * 0.36, 0.55, 0)); g.add(M(GEO.box, '#3b2a1e', 0.07, 0.15, 0.07, s * 0.3, 0.075, 0.28)); g.add(M(GEO.box, '#3b2a1e', 0.07, 0.15, 0.07, s * 0.3, 0.075, -0.28)); }
    g.add(M(GEO.box, '#e6dcc5', 0.5, 0.05, 0.5, 0, 0.47, 0.04));
  },
  clock(b, x, y, z, ry = 0) { const g = new THREE.Group(); g.position.set(x, this.F + y, z); g.rotation.y = ry; b.g.add(g); g.add(M(GEO.box, '#5a3a22', 0.34, 0.7, 0.1, 0, 0, 0)); g.add(M(GEO.cyl, '#f4ead3', 0.12, 0.02, 0.12, 0, 0.16, 0.06).rotateX(Math.PI / 2)); g.add(M(GEO.box, '#2b2b2b', 0.015, 0.09, 0.01, 0, 0.19, 0.075)); g.add(M(GEO.cyl, '#c9a23a', 0.04, 0.02, 0.04, 0, -0.2, 0.06).rotateX(Math.PI / 2)); },
  sideTable(b, x, z) { this.put(b, GEO.box, '#6b4226', 0.45, 0.05, 0.4, x, 0.5, z); for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.put(b, GEO.box, '#5a3a22', 0.04, 0.5, 0.04, x + lx * 0.18, 0, z + lz * 0.15); this.candle(b, x, 0.55, z); },
  sconce(b, x, y, z) { this.put(b, GEO.box, '#c9a23a', 0.08, 0.16, 0.08, x, y - 0.12, z); this.put(b, GEO.sphLo, '#ffd27a', 0.07, 0.1, 0.07, x, y, z, { mat: this.glow }); },
  plant(b, x, z) { this.put(b, GEO.cyl, '#a0603a', 0.16, 0.28, 0.16, x, 0, z); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; this.put(b, GEO.sphLo, '#4f8a4a', 0.07, 0.34, 0.16, x + Math.cos(a) * 0.12, 0.28, z + Math.sin(a) * 0.12, { rz: Math.cos(a) * 0.5, rx: -Math.sin(a) * 0.5 }); } },

  sheriff(b) { if (!b) return;
    this.rug(b, 0, -0.3, 3.2, 2.2, '#8a3b3b');
    this.chair(b, 0, -2.6, 0); this.put(b, GEO.box, '#f4ead3', 0.5, 0.01, 0.35, -0.5, 0.92, -1.25, { ry: 0.2 }); this.put(b, GEO.box, '#f4ead3', 0.3, 0.01, 0.4, 0.6, 0.92, -1.1, { ry: -0.3 }); this.put(b, GEO.cyl, '#e6dcc5', 0.06, 0.1, 0.06, 0.2, 0.9, -1.4); this.candle(b, -0.9, 0.9, -1.55);
    // jail cell: cot, bucket, cross bars and a side wall of bars
    this.put(b, GEO.box, '#5a3a22', 0.8, 0.3, 1.25, 3.2, 0.1, -2.5); this.put(b, GEO.box, '#9a8f7a', 0.75, 0.08, 1.15, 3.2, 0.4, -2.5); this.put(b, GEO.cyl, '#6b6b6b', 0.15, 0.25, 0.15, 1.75, 0, -3.0);
    for (const y of [0.15, 1.2, 2.85]) this.put(b, GEO.box, '#555', 2.5, 0.05, 0.05, 2.5, y, -1.8);
    for (let i = 0; i < 5; i++) this.put(b, GEO.cyl, '#555', 0.03, 2.6, 0.03, 1.3, 0.25, -2.0 - i * 0.3);
    // gun rack with two rifles, wanted board, gun cabinet, filing cabinet, map, stove, coat rack
    this.put(b, GEO.box, '#6b4226', 1.4, 0.9, 0.08, -2.3, 1.2, -3.15); for (const k of [-0.4, 0.1]) { this.put(b, GEO.box, '#3b2a1e', 0.06, 1.0, 0.08, -2.3 + k, 1.15, -3.08, { rz: 0.06 }); this.put(b, GEO.box, '#4a4a4a', 0.03, 0.55, 0.05, -2.3 + k, 1.55, -3.04); }
    this.put(b, GEO.box, '#5a3a22', 0.9, 1.8, 0.5, -3.0, 0, -2.85, { col: true }); this.put(b, GEO.box, '#3c5a6e', 0.7, 1.2, 0.02, -3.0, 0.45, -2.59);
    this.put(b, GEO.box, '#6b6b5a', 0.6, 1.3, 0.55, -1.6, 0, -2.88, { col: true }); for (const y of [0.25, 0.65, 1.05]) this.put(b, GEO.box, '#cfc4a0', 0.15, 0.04, 0.02, -1.6, y, -2.6);
    this.frame(b, 3.64, 1.8, 0.9, -Math.PI / 2, 1.3, 0.9, '#d9c58f'); this.stove(b, 3.15, 1.9); this.lamp(b, 0, -0.8);
    { const x = -3.3, z = 2.6; this.put(b, GEO.cyl, '#5a3a22', 0.04, 1.75, 0.04, x, 0, z); this.put(b, GEO.cyl, '#5a3a22', 0.22, 0.04, 0.22, x, 0, z); this.put(b, GEO.cyl, '#2b2b2b', 0.24, 0.05, 0.24, x, 1.72, z); this.put(b, GEO.cyl, '#2b2b2b', 0.13, 0.12, 0.13, x, 1.76, z); }
  },
  store(b) { if (!b) return;
    this.rug(b, 0, 1.4, 4, 2.2, '#4f6b8a');
    for (const [x, z] of [[-4.3, 0.2], [-4.3, 0.7], [-3.85, 0.45]]) this.sack(b, x, z); this.sack(b, -4.1, 0.45, 0.35);
    this.crate(b, 4.3, -0.4, 0.7, 0, false); this.crate(b, 4.3, -0.4, 0.5, 0.7, false); this.crate(b, 3.6, -0.7, 0.6, 0, false); // no collision: Mae's way out from behind the counter runs past here
    this.table(b, 2.4, 1.6, 1.4, 0.8); for (let k = 0; k < 5; k++) this.put(b, k % 2 ? GEO.cyl : GEO.box, ['#c8443a', '#e9c46a', '#4f7ca8', '#9dbf8a', '#f4ead3'][k], 0.14, 0.18, 0.14, 1.9 + k * 0.25, 0.75, 1.6);
    for (let k = 0; k < 3; k++) this.put(b, GEO.cyl, '#cfe6ef', 0.1, 0.24, 0.1, -2.2 + k * 0.3, 0.88, -1.2, { mat: { transparent: true, opacity: 0.75 } }); // candy jars on the counter
    this.put(b, GEO.cyl, '#b0a070', 0.18, 0.04, 0.18, 2.6, 0.88, -1.2); this.put(b, GEO.box, '#8b5a2b', 0.12, 0.25, 0.12, 2.6, 0.92, -1.2); // scale
    for (let k = 0; k < 4; k++) this.put(b, GEO.cyl, '#3b3b3b', 0.22, 0.03, 0.22, -4.62, 1.8 + (k % 2) * 0.35, -1.6 + k * 0.6, { rz: Math.PI / 2 }); // pans on the wall
    this.shelf(b, 4.5, 1.2, -Math.PI / 2, 2.2); this.lamp(b, -1.5, 0.6); this.lamp(b, 1.8, 0.6);
    this.frame(b, 0, 2.55, -3.62, 0, 2.2, 0.45, '#e9c46a');
  },
  saloon(b) { if (!b) return;
    this.put(b, GEO.box, '#b8c8d0', 3.2, 0.8, 0.02, 0, 2.55, -4.66); this.put(b, GEO.box, '#5a3a22', 3.4, 0.08, 0.04, 0, 3.37, -4.65); // mirror over the back bar
    for (let k = 0; k < 5; k++) { const x = -3 + k * 1.5; this.put(b, GEO.cyl, '#5a3a22', 0.04, 0.7, 0.04, x, 0, -1.85); this.put(b, GEO.cyl, '#8b3b3b', 0.2, 0.07, 0.2, x, 0.7, -1.85); }
    for (const tx of [-3, 3]) { for (let k = 0; k < 4; k++) this.put(b, GEO.box, '#f4ead3', 0.08, 0.005, 0.12, tx - 0.25 + k * 0.17, 0.83, 2 + (k % 2) * 0.1, { ry: k * 0.4 }); for (let k = 0; k < 3; k++) this.put(b, GEO.cyl, ['#c8443a', '#f4ead3', '#2b2b2b'][k], 0.05, 0.03 + k * 0.02, 0.05, tx + 0.25, 0.82, 1.85 + k * 0.08); this.put(b, GEO.cyl, '#cfa040', 0.05, 0.14, 0.05, tx - 0.35, 0.82, 2.25, { mat: { transparent: true, opacity: 0.8 } }); }
    { const x = 0, z = 0.8, y = 2.9; this.put(b, GEO.cyl, '#2b2b2b', 0.02, 0.45, 0.02, x, y + 0.4, z); this.put(b, GEO.cyl, '#3b2a1e', 0.75, 0.06, 0.75, x, y, z); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; this.candle(b, x + Math.cos(a) * 0.62, y + 0.06, z + Math.sin(a) * 0.62); } }
    this.put(b, GEO.box, '#5a3a22', 0.6, 0.45, 0.35, -5, 0, 2.0); // piano stool
    // parlor dressing: felt card tables, a brass foot rail, a back bar stacked with bottles under a long mirror, glasses and
    // a beer pull on the bar, piano keys and sheet music, wall sconces and heavy curtains
    for (const tx of [-3, 3]) this.put(b, GEO.cyl, '#2f6b3f', 0.63, 0.012, 0.63, tx, 0.792, 2);
    this.put(b, GEO.cyl, '#c9a23a', 0.03, 7.6, 0.03, 0, 0.2 - 3.8, -2.02, { rz: Math.PI / 2 }); for (const x of [-3.6, -1.2, 1.2, 3.6]) this.put(b, GEO.box, '#c9a23a', 0.04, 0.2, 0.12, x, 0.02, -2.08);
    { const cols = ['#6b8e23', '#8b4513', '#b0c4de', '#a33a2e', '#d9a441', '#2f4f3f', '#e6dcc5'], R = mulberry(77);
      for (const [y, n] of [[1.05, 22], [1.6, 22]]) { this.put(b, GEO.box, '#5a3a22', 8.6, 0.05, 0.22, 0, y, -4.2); for (let k = 0; k < n; k++) { if (Math.abs(k - (n - 1) / 2) < 4.2 && y > 1.5) continue; const hgt = 0.2 + R() * 0.14; this.put(b, GEO.cyl, cols[Math.floor(R() * cols.length)], 0.045, hgt, 0.045, -4.1 + k * 8.2 / (n - 1), y + 0.05, -4.2); this.put(b, GEO.cyl, '#2b2b2b', 0.018, 0.07, 0.018, -4.1 + k * 8.2 / (n - 1), y + 0.05 + hgt, -4.2); } }
      this.put(b, GEO.box, '#c9a23a', 3.3, 0.86, 0.03, 0, 1.68, -4.29); this.put(b, GEO.box, '#bcd0d8', 3.1, 0.7, 0.03, 0, 1.76, -4.27, { mat: { emissive: '#9ab0b8', emissiveIntensity: 0.25 } });
      for (let k = 0; k < 7; k++) this.put(b, GEO.cyl, '#dfeef2', 0.04, 0.1, 0.04, -3.3 + k * 1.1 + R() * 0.3, 1.1, -2.75 + R() * 0.25, { mat: { transparent: true, opacity: 0.6 } }); }
    this.put(b, GEO.box, '#c9a23a', 0.1, 0.3, 0.1, 2.2, 1.1, -2.8); this.put(b, GEO.cyl, '#2b2b2b', 0.02, 0.2, 0.02, 2.2, 1.36, -2.76, { rx: 0.5 });
    this.put(b, GEO.box, '#f4ead3', 1.3, 0.05, 0.2, -5, 0.7, 1.4); this.put(b, GEO.box, '#1b1b1b', 1.24, 0.03, 0.09, -5, 0.75, 1.35); this.put(b, GEO.box, '#2b1d14', 1.5, 0.06, 0.26, -5, 0.63, 1.4); this.put(b, GEO.box, '#f4ead3', 0.4, 0.3, 0.02, -5, 1.0, 1.31, { rx: -0.2 }); this.candle(b, -5.6, 1.3, 1.0); this.candle(b, -4.4, 1.3, 1.0);
    for (const s of [-1, 1]) for (const z of [-2.9, 2.9]) this.sconce(b, s * 5.6, 2.2, z);
    this.curtains(b, '#6e2430'); this.plant(b, 5.2, 4.2); this.plant(b, -5.2, 4.2); this.rug(b, 0, 2.2, 3.2, 2.0, '#6e2430', '#c9a23a');
    for (const [x, z] of [[-5.3, -1.5], [2.0, 3.6], [-1.6, 3.6]]) this.put(b, GEO.cyl, '#b08a3a', 0.18, 0.25, 0.18, x, 0, z);
    { const x = -5.64, y = 2.4, z = -1.0; this.put(b, GEO.box, '#5a3a22', 0.05, 0.4, 0.3, x, y, z); for (const s of [-1, 1]) { this.put(b, GEO.box, '#e6dcc5', 0.05, 0.5, 0.05, x + 0.05, y + 0.35, z + s * 0.25, { rx: s * 0.6 }); this.put(b, GEO.box, '#e6dcc5', 0.05, 0.3, 0.05, x + 0.05, y + 0.55, z + s * 0.45, { rx: s * 1.1 }); } } // antlers
    this.frame(b, 5.64, 1.9, 1.2, -Math.PI / 2, 1.4, 0.9, '#c97b5a'); this.frame(b, 5.64, 1.9, -2.0, -Math.PI / 2, 0.8, 1.0, '#6a7fb0');
    this.barrel(b, 4.9, -3.6, false); this.barrel(b, 5.3, -2.9, false); /* decorative: Cora walks round the end of the bar */ this.lamp(b, -3.5, -2.6, 2.95); this.lamp(b, 3.5, -2.6, 2.95);
  },
  mae(b) { if (!b) return; // door N: the back wall is +z
    this.rug(b, 0.3, 0.3, 2.4, 1.8, '#9dbf8a', '#c97b5a'); this.table(b, 1.6, -0.6, 1.2, 0.8); this.chair(b, 1.0, -0.6, Math.PI / 2); this.chair(b, 2.25, -0.6, -Math.PI / 2);
    this.put(b, GEO.cyl, '#4f7ca8', 0.08, 0.18, 0.08, 1.6, 0.75, -0.6); this.put(b, GEO.sphLo, '#e9c46a', 0.12, 0.1, 0.12, 1.6, 0.93, -0.6); this.stove(b, -2.75, -2.1);
    this.shelf(b, 3.0, 0.6, -Math.PI / 2, 1.4, ['#f4ead3', '#cfe6ef', '#f4ead3', '#c8443a'], 2, 1.3); this.frame(b, -1.0, 1.75, 2.64, Math.PI, 0.7, 0.9, '#d9a07a'); this.lamp(b, 0, 0);
    this.curtains(b, '#c97b5a'); this.fireplace(b, 0.3, 2.47, Math.PI); this.armchair(b, 0.9, 1.25, Math.PI + 0.5, '#5f7a6a'); this.bookcase(b, -3.0, -0.6, Math.PI / 2, 1.0); this.plant(b, 2.8, -2.3);
  },
  doc(b) { if (!b) return; // door N
    this.shelf(b, -3.5, -1.6, Math.PI / 2, 1.6, ['#cfe6ef', '#9b1c1c', '#4f7ca8', '#e9c46a', '#cfe6ef'], 3, 0.9);
    this.put(b, GEO.box, '#f4ead3', 0.6, 0.85, 0.45, 3.3, 0, -1.6, { col: true }); this.put(b, GEO.cyl, '#e6e6e6', 0.22, 0.08, 0.22, 3.3, 0.85, -1.6); this.frame(b, 3.62, 1.7, -1.6, -Math.PI / 2, 0.5, 0.7, '#cfe6ef');
    for (let k = 0; k < 3; k++) this.put(b, GEO.box, '#e6dcc5', 0.75, 1.5, 0.03, -0.05 + (k - 1) * 0.0, 0, 1.0 + (k - 1) * 0.72, { ry: Math.PI / 2 + (k % 2 ? 0.35 : -0.35) }); // folding screen between the cots
    this.frame(b, 0, 1.9, 3.14, Math.PI, 1.0, 0.7, '#f4ead3'); this.put(b, GEO.cyl, '#b0a070', 0.06, 0.04, 0.06, -3.3, 1.05, 2.2); this.lamp(b, 0, -0.5);
    this.curtains(b, '#f4ead3'); this.clock(b, 1.6, 1.9, 3.12, Math.PI); this.bookcase(b, 3.5, 0.9, -Math.PI / 2, 0.9, 1.7); this.rug(b, 0, -0.9, 2.4, 1.5, '#5f7a8a', '#e6dcc5');
  },
  boarding(b) { if (!b) return; // door N
    for (const x of [-2.5, 2.5]) this.put(b, GEO.box, '#6b4226', 0.45, 0.55, 0.4, x + (x < 0 ? 0.95 : -0.95), 0, 2.4);
    this.candle(b, -1.55, 0.55, 2.4); this.put(b, GEO.box, '#7a5232', 0.6, 0.8, 0.45, 3.3, 0, -1.7, { col: true }); this.put(b, GEO.cyl, '#cfe6ef', 0.22, 0.08, 0.22, 3.3, 0.8, -1.7);
    this.chair(b, -3.2, -1.7, Math.PI / 2); this.rug(b, 0, 0, 2, 1.4, '#8a6a4a'); for (let k = 0; k < 3; k++) this.put(b, GEO.box, '#3b2a1e', 0.05, 0.05, 0.12, -1 + k * 0.5, 1.75, 2.62); this.lamp(b, 0, 0.2);
    this.curtains(b, '#3c5a6e'); this.clock(b, 3.62, 1.9, -1.0, -Math.PI / 2); this.armchair(b, -1.2, -1.9, 0.5, '#3c5a6e'); this.plant(b, 3.3, -2.3);
  },
  farmhouse(b) { if (!b) return; // door S
    this.bed(b, 2, 1.5, 0, '#c97b5a'); // the second bed (Nell's)
    this.table(b, -0.2, -0.8, 1.4, 0.9); this.chair(b, -0.9, -0.8, Math.PI / 2); this.chair(b, 0.5, -0.8, -Math.PI / 2); this.stove(b, 3.1, -2.4); this.rug(b, 0, 0.5, 2.2, 1.6, '#c8443a');
    this.shelf(b, -3.5, -1.5, Math.PI / 2, 1.4, ['#f4ead3', '#e9c46a', '#d9c58f'], 2, 1.2); this.barrel(b, -3.2, 2.7); this.lamp(b, 0, -0.5);
    this.curtains(b, '#5f7a4a'); this.fireplace(b, -1.3, -2.97, 0); this.clock(b, 0.8, 1.9, -3.12, 0); this.armchair(b, -2.7, -1.2, 0.9, '#8a6a3a'); this.sideTable(b, 3.15, 1.2);
  },
  barn(b) { if (!b) return; // rough: hay, stalls, tools
    for (const [x, z, ly] of [[-4, -3.2, 0], [-3, -3.4, 0], [-3.5, -3.3, 0.6], [4, -3.4, 0]]) this.put(b, GEO.box, '#e0c068', 1.0, 0.6, 0.6, x, ly, z, { col: ly === 0, cover: true });
    for (let k = 0; k < 3; k++) this.put(b, GEO.box, '#6b4226', 0.1, 1.2, 2.2, 1.0 + k * 1.4, 0, -2.6);
    this.put(b, GEO.box, '#6b4226', 0.05, 1.4, 0.05, -4.5, 0, 1.0, { rz: 0.2 }); this.put(b, GEO.box, '#888', 0.3, 0.05, 0.02, -4.35, 1.4, 1.0); this.barrel(b, 4.2, 2.6);
  },
  mill(b) { if (!b) return;
    this.crate(b, -4.5, -3.0, 0.8); this.crate(b, -3.6, -3.2, 0.7); this.crate(b, -4.1, -3.1, 0.6, 0.8, false); for (const [x, z] of [[4.6, -3.2], [4.1, -3.4], [4.4, -2.6]]) this.sack(b, x, z);
    this.put(b, GEO.cyl, '#7d6650', 1.1, 0.2, 1.1, 0, 0, -2.6, { col: true }); this.put(b, GEO.cyl, '#5a3a22', 0.12, 1.6, 0.12, 0, 0.2, -2.6); this.table(b, 3.5, 1.5, 1.2, 0.7, '#5a3a22'); this.lamp(b, 0, 0.5, 2.9);
  },
  cabin(b) { if (!b) return; // Eli's cabin: keep the clue spots (overturned table, floorboard) clear
    this.bed(b, -1.6, 1.3, Math.PI / 2, '#6b5a4a'); this.stove(b, 2.1, -1.5); this.shelf(b, 2.45, 0.5, -Math.PI / 2, 1.0, ['#d9c58f', '#f4ead3', '#8b6a47'], 1, 1.3); this.put(b, GEO.box, '#e6dcc5', 0.6, 0.01, 0.45, 0.4, 0.012, 1.0, { ry: 0.5 });
  },
};
