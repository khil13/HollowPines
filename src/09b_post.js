/* ===== Post-processing: our own small pipeline (no extra libraries, so the installed app keeps working offline) =====
   scene -> colour + depth target -> bright pass -> two-pass blur (bloom) -> composite: screen-space ambient occlusion
   from depth, bloom, colour grading (contrast, saturation, warm highlights / cool shadows, golden-hour warmth),
   vignette, fine grain and an FXAA-style edge smooth. Low quality skips it all and renders straight to the screen. */
const Post = {
  on: false, ao: false, fxaa: false, bloomK: 0.55, warm: 0,
  init(renderer) {
    this.r = renderer; this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); this.quadScene = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); this.quad.frustumCulled = false; this.quadScene.add(this.quad);
    const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    this.mBright = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, uThr: { value: 0.9 } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: 'uniform sampler2D tSrc; uniform float uThr; varying vec2 vUv; void main(){ vec3 c = texture2D(tSrc, vUv).rgb; float l = dot(c, vec3(0.299,0.587,0.114)); float k = smoothstep(uThr, uThr + 0.12, l); gl_FragColor = vec4(c * k, 1.0); }' });
    this.mBlur = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: 'uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv; void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 0.227; c += (texture2D(tSrc, vUv + uDir * 1.385).rgb + texture2D(tSrc, vUv - uDir * 1.385).rgb) * 0.316; c += (texture2D(tSrc, vUv + uDir * 3.231).rgb + texture2D(tSrc, vUv - uDir * 3.231).rgb) * 0.070; gl_FragColor = vec4(c, 1.0); }' });
    this.mComp = new THREE.ShaderMaterial({ vertexShader: vs, depthTest: false, depthWrite: false,
      uniforms: { tCol: { value: null }, tDepth: { value: null }, tBloom: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uNear: { value: 0.1 }, uFar: { value: 900 }, uAO: { value: 0 }, uFXAA: { value: 0 }, uBloom: { value: 0.55 }, uWarm: { value: 0 }, uNight: { value: 0 }, uT: { value: 0 }, uFlash: { value: 0 }, uTan: { value: new THREE.Vector2(1, 1) } }, extensions: { derivatives: true },
      fragmentShader: `uniform vec2 uTan; uniform sampler2D tCol; uniform sampler2D tDepth; uniform sampler2D tBloom; uniform vec2 uRes; uniform float uNear; uniform float uFar; uniform float uAO; uniform float uFXAA; uniform float uBloom; uniform float uWarm; uniform float uNight; uniform float uT; uniform float uFlash; varying vec2 vUv;
        float lin(float d){ return (uNear * uFar) / (uFar - d * (uFar - uNear)); }
        float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
        vec3 vpos(vec2 uv, float z){ return vec3((uv * 2.0 - 1.0) * uTan * z, -z); } // view-space position from screen uv and linear depth
        vec3 fxaa(vec2 uv){ vec2 px = 1.0 / uRes; vec3 cM = texture2D(tCol, uv).rgb; float lN = luma(texture2D(tCol, uv + vec2(0.0, px.y)).rgb), lS = luma(texture2D(tCol, uv - vec2(0.0, px.y)).rgb), lE = luma(texture2D(tCol, uv + vec2(px.x, 0.0)).rgb), lW = luma(texture2D(tCol, uv - vec2(px.x, 0.0)).rgb), lM = luma(cM);
          float range = max(max(lN, lS), max(max(lE, lW), lM)) - min(min(lN, lS), min(min(lE, lW), lM)); if (range < 0.06) return cM;
          vec2 dir = vec2(-(lN - lS), lE - lW); dir = normalize(dir + 1e-5) * px; // blur along the edge, not across it
          vec3 a = 0.5 * (texture2D(tCol, uv + dir * -0.5).rgb + texture2D(tCol, uv + dir * 0.5).rgb); return mix(cM, a, 0.75); }
        void main(){
          vec3 c = uFXAA > 0.5 ? fxaa(vUv) : texture2D(tCol, vUv).rgb;
          float d = texture2D(tDepth, vUv).r;
          if (uAO > 0.0 && d < 0.9999) { // normal-aware SSAO: only geometry rising above this pixel's surface occludes it (creases, contact), flat ground doesn't
            float z = lin(d); vec3 P = vpos(vUv, z); vec3 N = normalize(cross(dFdx(P), dFdy(P))); if (dot(N, P) > 0.0) N = -N;
            float Rw = 0.55, occ = 0.0, rot = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
            vec2 rs = vec2(Rw) / (z * uTan * 2.0);
            for (int i = 0; i < 8; i++) { float a = float(i) * 0.785398 + rot, k = 0.3 + 0.7 * fract(float(i) * 0.618 + 0.2); vec2 uv2 = vUv + vec2(cos(a), sin(a)) * rs * k;
              vec3 S = vpos(uv2, lin(texture2D(tDepth, uv2).r)); vec3 v = S - P; float dist = length(v) + 1e-4;
              occ += max(0.0, dot(N, v / dist) - 0.2) * (1.0 - smoothstep(Rw * 0.7, Rw * 1.8, dist)); }
            c *= 1.0 - uAO * clamp(occ / 8.0 * 1.6, 0.0, 1.0) * (1.0 - smoothstep(20.0, 60.0, z)); }
          c += texture2D(tBloom, vUv).rgb * uBloom;
          // grade: gentle S-curve contrast, richer colour, cool shadows and warm highlights (warmer at golden hour)
          float l = luma(c); c = mix(vec3(l), c, 1.12 + uWarm * 0.08); c = (c - 0.5) * 1.08 + 0.5;
          vec3 shadowT = mix(vec3(0.96, 0.99, 1.05), vec3(0.92, 0.96, 1.08), uNight), highT = mix(vec3(1.03, 1.0, 0.95), vec3(1.08, 0.98, 0.86), uWarm);
          c *= mix(shadowT, highT, smoothstep(0.15, 0.85, l));
          c = mix(c, vec3(1.0, 0.98, 0.96), uFlash * 0.5);
          vec2 q = vUv - 0.5; c *= 1.0 - smoothstep(0.35, 0.85, length(q * vec2(1.15, 1.0))) * (0.32 + uNight * 0.15); // vignette
          c += (fract(sin(dot(vUv * uRes + uT, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.018; // fine film grain
          gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0); }` });
    this.size = new THREE.Vector2(); this.build();
  },
  build() {
    this.r.getDrawingBufferSize(this.size); const w = Math.max(2, this.size.x), h = Math.max(2, this.size.y);
    for (const k of ['rt', 'ra', 'rb']) if (this[k]) { this[k].dispose(); if (this[k].depthTexture) this[k].depthTexture.dispose(); }
    this.rt = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
    this.rt.depthTexture = new THREE.DepthTexture(w, h); this.rt.depthTexture.type = THREE.UnsignedIntType;
    const bw = Math.max(2, w >> 2), bh = Math.max(2, h >> 2);
    this.ra = new THREE.WebGLRenderTarget(bw, bh, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }); this.rb = this.ra.clone();
    this.mComp.uniforms.uRes.value.set(w, h); this.bw = bw; this.bh = bh;
  },
  setQuality(q) { this.on = q !== 'low'; this.ao = q === 'high'; this.fxaa = q === 'high'; if (this.r) this.build(); },
  resize() { if (this.r) this.build(); },
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.quadScene, this.cam); },
  render(scene, camera) {
    const R = this.r; if (!this.on) { R.setRenderTarget(null); R.render(scene, camera); return; }
    R.setRenderTarget(this.rt); R.render(scene, camera);
    this.mBright.uniforms.tSrc.value = this.rt.texture; this.pass(this.mBright, this.ra);
    this.mBlur.uniforms.tSrc.value = this.ra.texture; this.mBlur.uniforms.uDir.value.set(1 / this.bw, 0); this.pass(this.mBlur, this.rb);
    this.mBlur.uniforms.tSrc.value = this.rb.texture; this.mBlur.uniforms.uDir.value.set(0, 1 / this.bh); this.pass(this.mBlur, this.ra);
    const u = this.mComp.uniforms; u.tCol.value = this.rt.texture; u.tDepth.value = this.rt.depthTexture; u.tBloom.value = this.ra.texture; u.uNear.value = camera.near; u.uFar.value = camera.far; const th = Math.tan(camera.fov * Math.PI / 360); u.uTan.value.set(th * camera.aspect, th);
    u.uAO.value = this.ao ? 0.55 : 0; u.uFXAA.value = this.fxaa ? 1 : 0; u.uBloom.value = Sky.night() ? 0.5 : (Sky.golden || 0) * 0.2; /* subtle by day, stronger for lanterns at night */ u.uWarm.value = Sky.golden || 0; u.uNight.value = Sky.night() ? 1 : 0; u.uT.value = (u.uT.value + 1.7) % 1000; u.uFlash.value = Sky.flash || 0;
    this.pass(this.mComp, null);
  },
};
