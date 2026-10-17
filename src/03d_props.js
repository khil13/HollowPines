/* ===== Imported props (optional): assets/props/rifle.glb, if present, replaces the code-built rifle in Wren's hands and
   in armed NPCs' hands. The model is turned so its muzzle (the slimmer end) points down the hand's +z, scaled to a real
   rifle's length, and shifted so the hand closes around the wrist of the stock. Without the file the box rifle stays. */
const PROP_SIZE = { rifle: 1.12 }; // overall length (m)
const PropAssets = {
  models: {},
  async init() {
    const src = window.PROP_GLB || {}; if (!THREE.GLTFLoader) return;
    for (const k in src) {
      try {
        const bin = atob(src[k]), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        const gltf = await new Promise((res, rej) => new THREE.GLTFLoader().parse(u.buffer, '', res, rej));
        const g = gltf.scene; g.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(g), sz = box.getSize(new THREE.Vector3());
        // its long axis is the barrel line, the middle axis is up-down (stock to sights), the shortest is across
        const ax = ['x', 'y', 'z'].sort((p, q) => sz[q] - sz[p]), L = ax[0], H = ax[1], len = sz[L], c = box.getCenter(new THREE.Vector3());
        // the muzzle is the end whose last tenth is slimmest; the barrel runs along the top, so the muzzle sits on the "up" side
        const v = new THREE.Vector3(), ends = [[1e9, -1e9], [1e9, -1e9]];
        g.traverse(m => { if (!m.isMesh) return; const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); const f = (v[L] - box.min[L]) / len;
          const e = f < 0.1 ? ends[0] : f > 0.9 ? ends[1] : null; if (e) { e[0] = Math.min(e[0], v[H]); e[1] = Math.max(e[1], v[H]); } } });
        const hiEnd = ends[1][1] - ends[1][0] < ends[0][1] - ends[0][0], mz = hiEnd ? ends[1] : ends[0];
        const l = new THREE.Vector3(), h = new THREE.Vector3(); l[L] = hiEnd ? 1 : -1; h[H] = (mz[0] + mz[1]) / 2 >= c[H] ? 1 : -1;
        const t = h.clone().cross(l), rot = new THREE.Matrix4().set(t.x, t.y, t.z, 0, h.x, h.y, h.z, 0, l.x, l.y, l.z, 0, 0, 0, 0, 1);
        this.models[k] = { scene: g, center: c, quat: new THREE.Quaternion().setFromRotationMatrix(rot), scale: PROP_SIZE[k] / len };
      } catch (e) { console.warn(`Prop ${k}.glb failed to load, using the built-in one`, e); }
    }
  },
  /* a ready-to-hold copy: muzzle along +z, the stock's wrist (about a third of the way up from the butt) at the origin */
  make(k) {
    const A = this.models[k]; if (!A) return null; const outer = new THREE.Group(), inner = new THREE.Group(), model = A.scene.clone(true); outer.add(inner); inner.add(model);
    model.position.copy(A.center).multiplyScalar(-1); inner.quaternion.copy(A.quat); // centre it, then turn it muzzle-forward and sights-up
    inner.scale.setScalar(A.scale); inner.position.set(0, 0.02, PROP_SIZE[k] * (0.5 - 0.34));
    model.traverse(m => { if (!m.isMesh) return; m.castShadow = true; const src = m.material; if (src.map) { src.map.encoding = THREE.LinearEncoding; src.map.needsUpdate = true; } /* the game renders without sRGB output, so read the palette texture as authored */ m.material = new THREE.MeshToonMaterial({ color: src.color ? src.color.clone() : 0xffffff, map: src.map || null, gradientMap: GRAD8 || (animalMat('#ffffff'), GRAD8) }); });
    return outer;
  },
};
