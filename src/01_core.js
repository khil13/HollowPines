'use strict';
/* ===== Core utilities, noise, input, audio ===== */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const ease = t => t * t * (3 - 2 * t);
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function dampAngle(a, b, l, dt) { return a + angDiff(a, b) * (1 - Math.exp(-l * dt)); }
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
function mulberry(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const RNG = mulberry(1337);
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const NOISE = (() => {
  const p = new Uint8Array(512); const r = mulberry(7); const a = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  for (let i = 0; i < 512; i++) p[i] = a[i & 255];
  const g = (h, x, y) => { h &= 7; const u = h < 4 ? x : y, v = h < 4 ? y : x; return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v); };
  return function (x, y) {
    const fx = Math.floor(x), fy = Math.floor(y); const X = fx & 255, Y = fy & 255; x -= fx; y -= fy;
    const u = x * x * (3 - 2 * x), v = y * y * (3 - 2 * y); const A = p[X] + Y, B = p[X + 1] + Y;
    return lerp(lerp(g(p[A], x, y), g(p[B], x - 1, y), u), lerp(g(p[A + 1], x, y - 1), g(p[B + 1], x - 1, y - 1), u), v) * 0.4;
  };
})();
function fbm(x, y, oct = 4) { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += NOISE(x * f, y * f) * a; n += a; a *= 0.5; f *= 2.03; } return s / n; }

/* setTimeout for game logic: the callback is dropped if the game was loaded or a mission retried in the meantime */
function later(fn, ms) { const g = Game.gen; return setTimeout(() => { if (g === Game.gen) fn(); }, ms); }

/* ---------- Input ---------- */
const Input = {
  keys: new Set(), pressed: new Set(), mouse: { dx: 0, dy: 0, l: false, r: false, lp: false }, wheel: 0,
  touch: false, move: { x: 0, y: 0, mag: 0 }, autoSprint: false, rimT: 0, look: { dx: 0, dy: 0 }, pinch: 0, btn: {}, btnP: new Set(), sprintToggle: false, aimToggle: false,
  locked: false, uiOpen: false,
  init(canvas) {
    const keyOf = e => /^Digit\d$/.test(e.code) ? e.code.slice(5) : e.key.toLowerCase(); // digits by position, so Shift+2 still draws the revolver
    addEventListener('keydown', e => { if (e.repeat) return; const k = keyOf(e); this.keys.add(k); this.pressed.add(k); if (['tab', ' ', 'alt'].includes(k)) e.preventDefault(); });
    addEventListener('keyup', e => { this.keys.delete(keyOf(e)); this.keys.delete(e.key.toLowerCase()); });
    canvas.addEventListener('mousedown', e => {
      if (this.touch) return;
      if (!this.locked && !this.uiOpen && Settings.v.mouseLock !== false && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) {} }
      if (e.button === 0) { this.mouse.l = true; this.mouse.lp = true; } if (e.button === 2) this.mouse.r = true;
    });
    addEventListener('mouseup', e => { if (e.button === 0) this.mouse.l = false; if (e.button === 2) this.mouse.r = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    addEventListener('mousemove', e => { if (this.touch) return; if (this.locked || this.mouse.l || this.mouse.r) { this.mouse.dx += e.movementX || 0; this.mouse.dy += e.movementY || 0; } });
    canvas.addEventListener('wheel', e => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    // touch
    const stick = document.getElementById('stick'), knob = document.getElementById('knob'), lzone = document.getElementById('lzone');
    let stickId = null, sx = 0, sy = 0; const lookIds = new Map(); stick.classList.add('idle');
    stick.addEventListener('pointerdown', e => { stickId = e.pointerId; const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; try { stick.setPointerCapture(e.pointerId); } catch (err) {} stick.classList.remove('idle'); upd(e); e.preventDefault(); });
    // floating stick: wherever the thumb lands on the left side of the screen becomes the centre of the stick
    lzone.addEventListener('pointerdown', e => { if (stickId !== null) return; this.setTouch(true); stickId = e.pointerId; sx = e.clientX; sy = e.clientY; stick.classList.add('float'); stick.classList.remove('idle'); stick.style.left = (sx - 66) + 'px'; stick.style.top = (sy - 66) + 'px'; stick.style.bottom = 'auto'; stick.style.right = 'auto'; try { lzone.setPointerCapture(e.pointerId); } catch (err) {} upd(e); e.preventDefault(); });
    const upd = e => { let dx = e.clientX - sx, dy = e.clientY - sy; const m = Math.hypot(dx, dy), R = 55; if (m > R) { dx *= R / m; dy *= R / m; } knob.style.transform = `translate(${dx}px,${dy}px)`; this.move.x = dx / R; this.move.y = -dy / R; this.move.mag = Math.min(1, m / R); };
    const mv = e => { if (e.pointerId === stickId) upd(e); }; stick.addEventListener('pointermove', mv); lzone.addEventListener('pointermove', mv);
    const end = e => { if (e.pointerId === stickId) { stickId = null; knob.style.transform = ''; this.move.x = this.move.y = this.move.mag = 0; stick.classList.remove('float'); stick.classList.add('idle'); stick.style.left = stick.style.top = stick.style.bottom = stick.style.right = ''; } };
    for (const el of [stick, lzone]) { el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end); }
    canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; this.setTouch(true); lookIds.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
    const pinchD = () => { const a = [...lookIds.values()]; return a.length >= 2 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0; };
    canvas.addEventListener('pointermove', e => { const p = lookIds.get(e.pointerId); if (!p) return; const d0 = pinchD(); const nx = e.clientX, ny = e.clientY; if (lookIds.size >= 2) { p.x = nx; p.y = ny; this.pinch += pinchD() - d0; return; } this.look.dx += (nx - p.x); this.look.dy += (ny - p.y); p.x = nx; p.y = ny; });
    const lend = e => lookIds.delete(e.pointerId); canvas.addEventListener('pointerup', lend); canvas.addEventListener('pointercancel', lend);
    document.querySelectorAll('#touch .tb').forEach(b => {
      const n = b.dataset.b;
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.btn[n] = true; this.btnP.add(n);
        if (n === 'sprint') { this.sprintToggle = !this.sprintToggle; b.classList.toggle('on', this.sprintToggle); }
        if (n === 'aim') { this.aimToggle = !this.aimToggle; b.classList.toggle('on', this.aimToggle); }
        if (n === 'crouch') b.classList.toggle('on');
      });
      const up = () => { this.btn[n] = false; }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });
    addEventListener('touchstart', () => this.setTouch(true), { passive: true });
    // anything held when the page loses focus, is hidden, or a menu opens is released, so nothing stays stuck on
    this.reset = () => { this.keys.clear(); this.mouse.l = this.mouse.r = false; this.mouse.dx = this.mouse.dy = 0; stickId = null; knob.style.transform = ''; this.move.x = this.move.y = this.move.mag = 0; lookIds.clear(); this.look.dx = this.look.dy = 0; for (const k in this.btn) this.btn[k] = false; };
    addEventListener('blur', this.reset); document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
  },
  setTouch(v) { this.touch = v; document.body.classList.toggle('touch', v); document.getElementById('touch').hidden = !v || !Game.running; },
  down(k) { return this.keys.has(k); }, hit(k) { return this.pressed.has(k); }, tb(n) { return this.btnP.has(n); },
  setBtnState(n, on) { const b = document.querySelector(`#touch .tb[data-b="${n}"]`); if (b) b.classList.toggle('on', on); },
  tick(dt) { // push the stick to the rim and hold it there to break into a run (let it back in to slow down)
    if (this.move.mag > 0.95) this.rimT += dt; else { this.rimT = 0; if (this.move.mag < 0.7) this.autoSprint = false; } if (this.rimT > 0.3 && this.touch && Settings.v.autoRun !== false) this.autoSprint = true;
    const k = document.getElementById('knob'); if (k && k.classList.contains('run') !== this.autoSprint) k.classList.toggle('run', this.autoSprint); },
  applyLayout() { document.body.classList.toggle('lefty', !!Settings.v.lefty); const t = document.getElementById('touch'); if (t) t.style.setProperty('--tbs', Settings.v.btnScale || 1); },
  endFrame() { this.pressed.clear(); this.btnP.clear(); this.mouse.dx = this.mouse.dy = 0; this.mouse.lp = false; this.look.dx = this.look.dy = 0; this.wheel = 0; this.pinch = 0; }
};

/* ---------- Audio (synthesized, no assets) ---------- */
const Sfx = {
  ctx: null, master: null, beds: {}, musicT: 0,
  init() {
    if (this.ctx) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const c = this.ctx; this.master = c.createGain(); this.master.gain.value = Settings.v.sound ?? 0.6; this.master.connect(c.destination);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.noise = buf;
    const bed = (type, f, q) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.master); s.start(); return g; };
    this.beds.wind = bed('lowpass', 420, 0.6); this.beds.rain = bed('highpass', 1800, 0.3); this.beds.river = bed('bandpass', 700, 0.4); this.beds.fire = bed('bandpass', 2500, 2);
  },
  bed(name, v) { if (!this.ctx) return; const g = this.beds[name]; g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.4); },
  burst(f0, dur, vol, type = 'lowpass', q = 1) { if (!this.ctx) return; const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f0; fl.Q.value = q; const g = c.createGain(); const t = c.currentTime; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(fl); fl.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05); },
  tone(f, dur, vol, type = 'sine', slide = 0) { if (!this.ctx) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime; o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05); },
  pluck(f, vol = 0.12) { if (!this.ctx) return; const c = this.ctx, n = Math.round(c.sampleRate / f), len = Math.round(c.sampleRate * 1.2), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; for (let i = n; i < len; i++) d[i] = (d[i - n] + d[i - n + 1]) * 0.497; const s = c.createBufferSource(); s.buffer = b; const g = c.createGain(); g.gain.value = vol; s.connect(g); g.connect(this.master); s.start(); },
  step(v = 0.06, soft) { this.burst(soft ? 500 : 900, 0.07, v); },
  hoof(v = 0.09) { this.burst(380, 0.06, v, 'bandpass', 3); this.tone(140, 0.05, v * 0.6, 'triangle'); },
  shot(rifle) { this.burst(rifle ? 1400 : 1900, rifle ? 0.5 : 0.35, 0.7); this.tone(rifle ? 70 : 90, 0.25, 0.5, 'sine', -40); },
  punch() { this.burst(300, 0.12, 0.35); this.tone(110, 0.1, 0.25, 'triangle', -50); },
  whistle() { this.tone(1300, 0.18, 0.12, 'sine', 500); setTimeout(() => this.tone(1500, 0.3, 0.12, 'sine', -300), 200); },
  coin() { this.tone(1320, 0.09, 0.1, 'square'); setTimeout(() => this.tone(1760, 0.14, 0.08, 'square'), 80); },
  pickup() { this.tone(660, 0.08, 0.1, 'triangle'); setTimeout(() => this.tone(990, 0.1, 0.08, 'triangle'), 60); },
  bad() { this.tone(220, 0.25, 0.12, 'sawtooth', -80); },
  splash() { this.burst(1200, 0.3, 0.25, 'bandpass', 0.8); },
  neigh() { this.tone(700, 0.5, 0.08, 'sawtooth', -350); },
  // simple pentatonic banjo noodling in town
  music(dt, inTown, night) {
    if (!this.ctx || !inTown) return; this.musicT -= dt; if (this.musicT > 0) return;
    const scale = night ? [196, 220, 261.6, 293.7, 329.6] : [261.6, 293.7, 329.6, 392, 440, 523.3];
    this.pluck(pick(scale), 0.07); if (Math.random() < 0.35) setTimeout(() => this.pluck(pick(scale) / 2, 0.06), 120);
    this.musicT = pick([0.25, 0.25, 0.5, 0.75]) * (night ? 1.6 : 1);
  }
};

/* ---------- Player settings (per browser) ---------- */
const Settings = {
  KEY: 'hollowpines_settings', v: { mouseLock: true, sens: 1, tsens: 1, invertY: false, zoom: 4.6, quality: 'auto', autoCam: true, sound: 0.6, hints: true, haptics: true, autoRun: true, btnScale: 1, lefty: false },
  load() { try { Object.assign(this.v, JSON.parse(localStorage.getItem(this.KEY) || '{}')); } catch (e) {} },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.v)); } catch (e) {} },
  set(k, val) { this.v[k] = val; this.save(); if (k === 'quality' && typeof Game !== 'undefined' && Game.renderer) Game.applyQuality(); if (k === 'sound' && Sfx.master) Sfx.master.gain.value = val; },
};
Settings.load();
