/* ===== Locomotion state machine =====
   One explicit state per movement phase, chosen from what the body is actually doing: grounded or not, vertical
   speed, measured horizontal speed, input, crouch and dodge. Animators read `state` and `t` (seconds in state) and
   blend toward that state's clips over LOCO.FADE[state]. Pure logic: no Three.js, no DOM, no gameplay side effects. */
const LOCO = {
  STILL: 0.25,              // below this horizontal speed (m/s) the body counts as standing
  WALK_MAX: 2.6, JOG_MAX: 5.4, HYST: 0.25, // speed bands with hysteresis so a speed on a boundary doesn't flicker
  START_T: 0.3,             // longest a start-walk lasts before settling into the walk cycle
  LAND_T: 0.2, LAND_T_MOVING: 0.1,
  FADE: { idle: 0.25, startWalk: 0.12, walk: 0.18, jog: 0.2, sprint: 0.22, jumpStart: 0.05, rising: 0.1, falling: 0.2, landing: 0.06, crouchIdle: 0.2, crouchWalk: 0.18, dodge: 0.06 },
  STATES: ['idle', 'startWalk', 'walk', 'jog', 'sprint', 'jumpStart', 'rising', 'falling', 'landing', 'crouchIdle', 'crouchWalk', 'dodge'],
};
class LocoFSM {
  constructor() { this.state = 'idle'; this.prev = 'idle'; this.t = 0; this.log = null; }
  set(s) { if (s === this.state) return; this.prev = this.state; this.state = s; this.t = 0; if (this.log) { this.log.push(s); if (this.log.length > 200) this.log.shift(); } }
  // i: { grounded, vy, speed, moving, crouch, jumpPrep, dodge }
  update(dt, i) {
    this.t += dt; const s = this.state, sp = i.speed;
    if (i.dodge) return this.set('dodge');
    if (i.jumpPrep) return this.set('jumpStart');
    if (!i.grounded) { // apex hysteresis: once falling, only a new upward push (another jump) counts as rising again
      if (s === 'falling') { if (i.vy > 2) this.set('rising'); return; }
      return this.set(i.vy > 0 ? 'rising' : 'falling');
    }
    if (s === 'rising' || s === 'falling') return this.set('landing');
    if (s === 'landing' && this.t < (i.moving ? LOCO.LAND_T_MOVING : LOCO.LAND_T)) return;
    if (i.crouch) return this.set(sp > LOCO.STILL ? 'crouchWalk' : 'crouchIdle');
    if (sp < LOCO.STILL) return this.set('idle');
    if ((s === 'idle' || s === 'crouchIdle' || s === 'landing' || s === 'dodge') && sp < LOCO.WALK_MAX) return this.set('startWalk');
    if (s === 'startWalk' && this.t < LOCO.START_T && i.moving && sp < LOCO.WALK_MAX) return;
    const h = LOCO.HYST, cur = s === 'jog' ? 1 : s === 'sprint' ? 2 : 0;
    const band = sp > LOCO.JOG_MAX + (cur === 2 ? -h : h) ? 2 : sp > LOCO.WALK_MAX + (cur >= 1 ? -h : h) ? 1 : 0;
    this.set(['walk', 'jog', 'sprint'][band]);
  }
}
