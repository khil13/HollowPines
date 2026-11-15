/* ===== Dead Eye (Red Dead Redemption 2's signature): while aiming a gun, trigger it and the world slows to a crawl and
   turns amber. Each trigger pull paints a mark on whoever is under the reticle (as many as there are rounds loaded);
   trigger Dead Eye again, fill the cylinder with marks or let the meter run dry, and Wren fires every marked shot in a
   blur, each one landing where it was painted. The meter refills with kills (more for headshots), a little over time,
   and with a whiskey at the bar. Q or the Dead Eye button while aiming. */
const DeadEye = {
  on: false, firing: false, marks: [], scale: 1, fireT: 0, markT: 0, SLOW: 0.22, MIN: 15, DRAIN: 11,
  meter() { if (S.p.de === undefined) S.p.de = 100; return S.p.de; },
  add(n) { S.p.de = clamp(this.meter() + n, 0, 100); },
  can(P) { return !this.on && P.aiming && P.weapon !== 'fists' && !P.reloading && !Duel.on && S.ammoClip[P.weapon] > 0 && this.meter() >= this.MIN; },
  start(P) { if (!this.can(P)) { if (P.aiming && !this.on && this.meter() < this.MIN) UI.toast('Dead Eye is spent', 'bad'); return false; }
    this.on = true; this.firing = false; this.marks = []; this.markT = 0.12; Sfx.tone(110, 0.9, 0.09, 'sine', -50); Sfx.burst(300, 0.5, 0.05); Haptic.buzz(25); return true; },
  stop() { this.on = false; this.firing = false; this.marks = []; },
  /* a trigger pull while Dead Eye is on: paint whoever is under the reticle */
  mark(P) {
    if (this.firing || this.markT > 0) return; const h = P.hover; if (!h || !h.h || !h.h.alive) return;
    if (this.marks.length >= S.ammoClip[P.weapon]) return;
    const pt = Game.cam.pos.clone().addScaledVector(Game.cam.dir(), h.t); this.marks.push({ h: h.h, zone: h.zone, off: pt.sub(h.h.pos) }); this.markT = 0.14;
    Sfx.tone(1400, 0.05, 0.05, 'square'); Haptic.buzz(8); if (this.marks.length >= S.ammoClip[P.weapon]) this.release(P);
  },
  release(P) { if (!this.on || this.firing) return; if (!this.marks.length) return this.stop(); this.firing = true; this.fireT = 0.1; },
  /* called first thing each frame with the real frame time; returns the (slowed) time the world should advance */
  tick(dt, P) {
    this.meter(); this.markT = Math.max(0, this.markT - dt);
    if (this.on && (!P.aiming && !this.firing || P.weapon === 'fists' || !P.alive || P.downed || UI.panelOpen || Dialog.open)) this.stop();
    if ((Input.hit('q') || Input.tb('deadeye')) && P.aiming && P.weapon !== 'fists') { if (this.on) this.release(P); else this.start(P); }
    if (this.on && !this.firing) { S.p.de = Math.max(0, S.p.de - this.DRAIN * dt); if (S.p.de <= 0) this.release(P); }
    else if (!this.on) S.p.de = Math.min(100, S.p.de + 0.8 * dt);
    if (this.on && this.firing) { this.fireT -= dt;
      if (this.fireT <= 0) { const m = this.marks.shift(); this.fireT = 0.13;
        if (m && m.h.alive && S.ammoClip[P.weapon] > 0) { P.cool = 0; P.reloading = false; P.forceHit = m; Game.cam.snapTo(m.h); P.shoot(true); P.forceHit = null; }
        if (!this.marks.length) { this.stop(); P.cool = 0.25; } } }
    this.scale = damp(this.scale, this.on ? this.SLOW : 1, this.on ? 14 : 6, dt); if (!this.on && this.scale > 0.98) this.scale = 1;
    this.draw(); return dt * this.scale;
  },
  /* a kill made by Wren's gun tops the meter up */
  onHit(h, zone) { if (!h.alive || h.downed) this.add(zone === 'head' ? 30 : 22); },
  draw() { // amber wash over the screen and an X on every painted mark
    const tint = $('deTint'); if (!tint) return; const k = clamp((1 - this.scale) / (1 - this.SLOW), 0, 1); tint.style.opacity = k.toFixed(2); if (tint.hidden === (k > 0.01)) tint.hidden = !(k > 0.01);
    const box = $('deMarks'); while (box.children.length < this.marks.length) { const d = document.createElement('div'); d.className = 'demark'; d.textContent = '✕'; box.appendChild(d); }
    const v = this._v || (this._v = new THREE.Vector3());
    for (let i = 0; i < box.children.length; i++) { const d = box.children[i], m = this.marks[i]; if (!m) { if (!d.hidden) d.hidden = true; continue; }
      v.copy(m.h.pos).add(m.off).project(Game.camera); const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1; if (d.hidden === vis) d.hidden = !vis;
      if (vis) d.style.transform = `translate(${((v.x + 1) / 2 * innerWidth).toFixed(1)}px, ${((1 - v.y) / 2 * innerHeight).toFixed(1)}px) translate(-50%, -50%)`; }
  },
};
