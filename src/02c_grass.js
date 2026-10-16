/* ===== Dense grass field: tens of thousands of single blades drawn in one call. Each blade has a fixed spot in the
   world; the patch wraps around the camera so blades never swim, and the vertex shader reads the terrain height, the
   ground colour and a "grass grows here" mask (no trails, water, buildings, porches, rocks, steep slopes or snow) from two
   small textures. Wind gusts roll across it in waves, and the player and horse push the blades aside as they pass. */
const Grass = {
  mesh: null, U: null,
  counts: { low: 0, medium: 26000, high: 70000 }, sizes: { low: 0, medium: 34, high: 46 },
  build(scene) {
    const n = Terrain.n, H = Terrain.H, res = WORLD.res, half = WORLD.half, b = Terrain.baseCol;
    const tH = Terrain.tH;
    const cd = new Uint8Array(n * n * 4), cell = (x, z) => [Math.round((x + half) / res), Math.round((z + half) / res)];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i, x = -half + i * res, z = -half + j * res, h = H[k];
      const hx = H[j * n + Math.min(n - 1, i + 1)] - h, hz = H[Math.min(n - 1, j + 1) * n + i] - h, slope = Math.hypot(hx, hz) / res;
      let d = smoothstep(1.3, 2.8, trailDist(x, z)) * (1 - smoothstep(0.4, 0.75, slope)) * (1 - smoothstep(20, 24, h)) * smoothstep(WORLD.waterY + 0.25, WORLD.waterY + 0.7, h);
      for (const p of PONDS) d *= smoothstep(p.r, p.r + 2, Math.hypot(x - p.x, z - p.z));
      for (const f of FLATS) { const fd = Math.hypot(x - f.x, z - f.z); if (fd < f.r) d *= 0.35 + 0.65 * smoothstep(f.r * 0.4, f.r, fd); }
      if (Math.hypot(x + 40, z - 20) < 30) d *= 0.3; // the town is trampled
      cd[k * 4] = b[k * 3] * 255; cd[k * 4 + 1] = b[k * 3 + 1] * 255; cd[k * 4 + 2] = b[k * 3 + 2] * 255; cd[k * 4 + 3] = clamp(d, 0, 1) * 255;
    }
    const clear = (x0, x1, z0, z1) => { const [i0, j0] = cell(x0, z0), [i1, j1] = cell(x1, z1); for (let j = Math.max(0, j0); j <= Math.min(n - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(n - 1, i1); i++) cd[(j * n + i) * 4 + 3] = 0; };
    for (const B of Buildings) clear(B.minX - 1, B.maxX + 1, B.minZ - 1, B.maxZ + 1);
    for (const c of Col.all) if (c.maxX - c.minX < 30 && c.maxZ - c.minZ < 30) clear(c.minX - 0.3, c.maxX + 0.3, c.minZ - 0.3, c.maxZ + 0.3); // porches, rocks, logs, fences, trees
    const tC = new THREE.DataTexture(cd, n, n, THREE.RGBAFormat); tC.magFilter = tC.minFilter = THREE.LinearFilter; tC.needsUpdate = true; this.tC = tC; this.cd = cd;
    this.U = { tH: { value: tH }, tC: { value: tC }, uN: { value: n }, uHalf: { value: half }, uRes: { value: res }, uS: { value: 46 }, uC: { value: new THREE.Vector2() }, uCam: { value: new THREE.Vector2() },
      uPushA: { value: new THREE.Vector3(1e4, 0, 1e4) }, uPushB: { value: new THREE.Vector3(1e4, 0, 1e4) }, uWet: { value: 0 } };
    const m = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }); const U = this.U;
    m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, { uTime: WIND.uTime, uStr: WIND.uStrength });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
        uniform sampler2D tH; uniform sampler2D tC; uniform float uN; uniform float uHalf; uniform float uRes; uniform float uS; uniform vec2 uC; uniform vec2 uCam; uniform vec3 uPushA; uniform vec3 uPushB; uniform float uTime; uniform float uStr; uniform float uWet;
        attribute vec4 aI; varying vec3 vGC;
        float hAt(vec2 g){ vec2 i = floor(g), f = g - i; float a = texture2D(tH, (i + 0.5) / uN).r, b = texture2D(tH, (i + vec2(1.5, 0.5)) / uN).r, c = texture2D(tH, (i + vec2(0.5, 1.5)) / uN).r, d = texture2D(tH, (i + 1.5) / uN).r; return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
        vec2 push(vec3 P, vec2 w, float gy){ vec2 dp = w - P.xz; float pd = length(dp) + 1e-3; return dp / pd * (1.0 - smoothstep(0.25, 1.25, pd)) * step(P.y - gy, 1.6) * 1.1; }`)
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);') // lit like the ground, so blades melt into it
        .replace('#include <begin_vertex>', `
        vec2 w = uC - uS * 0.5 + mod(aI.xy - (uC - uS * 0.5), uS);
        vec2 g = (w + uHalf) / uRes; vec4 gc = texture2D(tC, (g + 0.5) / uN); float gy = hAt(g);
        float fade = 1.0 - smoothstep(uS * 0.3, uS * 0.48, length(w - uC)), near = smoothstep(0.6, 2.2, length(w - uCam));
        float s = (0.2 + aI.z * 0.3) * mix(0.55, 1.0, gc.a) * step(aI.w, gc.a * 1.05 - 0.05) * fade * mix(0.35, 1.0, near);
        float yaw = fract(aI.z * 91.7 + aI.w * 13.1) * 6.2831; vec2 cs = vec2(cos(yaw), sin(yaw));
        vec3 p = vec3(position.x * cs.x, position.y * s, position.x * cs.y) * step(0.001, s);
        float k = position.y * position.y; vec2 wd = vec2(0.94, 0.34);
        float gust = sin(dot(w, wd) * 0.11 - uTime * 1.6) * 0.5 + 0.5, flut = sin(uTime * 3.3 + aI.x * 1.7 + aI.y * 1.3) * 0.3;
        vec2 bend = wd * (0.15 + gust * gust * 0.85 + flut) * uStr * 0.32 + push(uPushA, w, gy) + push(uPushB, w, gy);
        float bl = min(length(bend), 1.2); bend = bend / max(length(bend), 1e-3) * bl;
        vec3 transformed = vec3(w.x + p.x + bend.x * k * s, gy - 0.04 + p.y * (1.0 - 0.35 * bl * k), w.y + p.z + bend.y * k * s);
        vGC = gc.rgb * mix(0.58, 1.08, position.y) * (0.88 + 0.24 * fract(aI.w * 7.3)) * (1.0 - uWet * 0.28) * (1.0 + gust * 0.08 * position.y);`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGC;').replace('#include <color_fragment>', 'diffuseColor.rgb *= vGC;').replace(/gl_FrontFacing/g, 'true');
    };
    m.customProgramCacheKey = () => 'grass'; this.mat = m; this.scene = scene;
  },
  setQuality(q) {
    if (!this.U) return; const N = this.counts[q] || 0, S = this.sizes[q] || 0; if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh = null; } this.count = N; if (!N) return;
    const w = 0.035, base = new THREE.BufferGeometry(); // one tapered blade, two segments so it can bend
    base.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, -w * 0.7, 0.5, 0, w * 0.7, 0.5, 0, 0, 1, 0], 3)); base.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3)); base.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
    const g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('normal', base.attributes.normal);
    const R = mulberry(11), a = new Float32Array(N * 4); for (let i = 0; i < N; i++) { a[i * 4] = R() * S; a[i * 4 + 1] = R() * S; a[i * 4 + 2] = R(); a[i * 4 + 3] = R(); }
    g.setAttribute('aI', new THREE.InstancedBufferAttribute(a, 4)); g.instanceCount = N;
    this.U.uS.value = S; this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.receiveShadow = true; this.scene.add(this.mesh);
  },
  update() {
    if (!this.mesh) return; const P = Game.cam.pos, f = Game.cam.dir(), l = Math.hypot(f.x, f.z) || 1, S = this.U.uS.value;
    this.U.uCam.value.set(P.x, P.z); this.U.uC.value.set(P.x + f.x / l * S * 0.22, P.z + f.z / l * S * 0.22); this.U.uWet.value = Sky.wet || 0;
    if (Game.player) this.U.uPushA.value.copy(Game.player.pos); if (Game.horse) this.U.uPushB.value.copy(Game.horse.pos);
  },
  at(x, z) { const n = Terrain.n, i = Math.round((x + WORLD.half) / WORLD.res), j = Math.round((z + WORLD.half) / WORLD.res); return i < 0 || j < 0 || i >= n || j >= n ? 0 : this.cd[(j * n + i) * 4 + 3] / 255; }, // grass density 0..1 (for tests)
};
