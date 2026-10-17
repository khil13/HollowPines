/* ===== UI: HUD, prompts, dialogue, panels, map, shop, camp, fishing ===== */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const UI = {
  panelOpen: false, tab: 'items', choices: [], tagPool: [],
  init() {
    $('pClose').onclick = () => this.close(); $('menuBtn').onclick = () => this.panelOpen ? this.close() : this.open('system');
    $('prings').innerHTML = this.ring('hp', '#c8443a', '♥') + this.ring('st', '#e9c46a', '⚡');
    $('hrings').innerHTML = this.ring('hhp', '#9dbf8a', 'H') + this.ring('hst', '#8fc7e8', '»');
    const fish = $('fish'); fish.addEventListener('pointerdown', e => { Fishing.hold = true; e.preventDefault(); }); addEventListener('pointerup', () => Fishing.hold = false);
    this.mapImg = this.buildMapImage();
    const keys = $('keys'); keys.innerHTML = '<b>Keyboard:</b> WASD move · Shift run · Space jump/climb · C crouch · E/G/T prompts · F or click attack · Right-click aim · Q block · X roll · 1/2/3 weapons · R reload · H call horse · B make camp · Tab menu · M map<br><b>Touch:</b> left stick moves, drag right side to look, tap the cream prompts to interact.';
  },
  threat() { return NPC.all.some(n => n.alive && !n.downed && (n.state === 'combat' || n.state === 'pursue') && n.distP < 30) || Animal.all.some(a => a.alive && a.state === 'attack' && a.distP < 25); },
  ring(id, col, ic) { return `<div class="ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="rgba(0,0,0,.35)" stroke="rgba(255,255,255,.15)" stroke-width="4"/><circle id="r_${id}" cx="18" cy="18" r="15" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" stroke-dasharray="94.2" stroke-dashoffset="0"/><circle id="c_${id}" cx="18" cy="18" r="9" fill="${col}" opacity=".35"/></svg><div class="ic">${ic}</div></div>`; },
  setRing(id, v, core) { const r = $('r_' + id); if (r) r.setAttribute('stroke-dashoffset', 94.2 * (1 - clamp(v, 0, 1))); const c = $('c_' + id); if (c && core !== undefined) c.setAttribute('r', 2 + 7 * clamp(core, 0, 1)); },
  toast(t, kind = '') { const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = t; $('toasts').prepend(d); setTimeout(() => d.remove(), 4200); while ($('toasts').children.length > 5) $('toasts').lastChild.remove(); },
  prompts(opts) {
    const sig = opts.map(o => o.label + (o.disabled ? 1 : 0)).join('|'); if (sig === this._ps) return; this._ps = sig; const keys = ['E', 'G', 'T'];
    $('chips').innerHTML = opts.map((o, i) => `<button class="chip${o.crime ? ' crime' : ''}" data-i="${i}" ${o.disabled ? 'disabled style="opacity:.55"' : ''}><kbd>${Input.touch ? '●' : keys[i]}</kbd>${esc(o.label)}</button>`).join('');
    $('chips').querySelectorAll('.chip').forEach(b => b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); Interact.trigger(+b.dataset.i); }));
  },
  dialog(name, txt, choices) {
    const d = $('dlg'); if (!name && name !== '') { d.hidden = true; this.choices = []; return; }
    d.hidden = false; $('dlgName').textContent = name; $('dlgText').textContent = txt; this.choices = choices;
    $('dlgCh').innerHTML = choices.map((c, i) => `<button ${c.disabled ? 'disabled' : ''} data-i="${i}">${i + 1}. ${esc(c.text)}${c.disabled && c.why ? ` <small>(${esc(c.why)})</small>` : ''}</button>`).join('');
    $('dlgCh').querySelectorAll('button').forEach(b => b.onclick = () => this.pickChoice(+b.dataset.i));
  },
  pickChoice(i) { const c = this.choices[i]; if (c && !c.disabled) { Sfx.tone(520, 0.05, 0.05, 'triangle'); c.fn(); } },
  banner(k, t, sub = '') { const now = performance.now(); this._bq = Math.max(this._bq || 0, now); const delay = this._bq - now; this._bq += 3200; setTimeout(() => this._banner(k, t, sub), delay); },
  _banner(k, t, sub = '') { const b = document.createElement('div'); b.className = 'hud'; b.style.cssText = 'left:50%;top:26%;transform:translateX(-50%);text-align:center;width:min(560px,90vw);z-index:15;animation:tin .4s ease-out'; b.innerHTML = `<div style="font:400 13px var(--display);letter-spacing:.12em;color:var(--ember);text-transform:uppercase">${esc(k)}</div><div style="font:400 clamp(26px,6vw,42px)/1.05 var(--display);color:var(--paper);text-shadow:0 3px 0 #0006,0 6px 20px #0008;text-wrap:balance">${esc(t)}</div>${sub ? `<div style="font-weight:800;margin-top:6px;text-shadow:0 1px 4px #000;font-size:14px">${esc(sub)}</div>` : ''}`; document.body.appendChild(b); setTimeout(() => { b.style.transition = 'opacity .5s'; b.style.opacity = 0; }, 2700); setTimeout(() => b.remove(), 3200); },
  failScreen(title, why) { Input.uiOpen = true; this.panelOpen = true; if (document.pointerLockElement) document.exitPointerLock(); $('panel').hidden = false; $('pTitle').textContent = 'Mission failed'; $('pTabs').innerHTML = ''; $('pClose').hidden = true;
    $('pBody').innerHTML = `<div class="sec">${esc(title)}</div><p style="font-weight:800;font-size:16px">${esc(why)}</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn alt" id="fRetry">Retry from mission start</button><button class="btn" id="fAccept">Accept the outcome</button></div><p style="font-size:12.5px;color:#5b5a48;font-weight:700;margin-top:12px">Accepting keeps the failure in your story. Other missions and characters will react to it.</p>`;
    $('fRetry').onclick = () => { this.close(true); Missions.retry(); }; $('fAccept').onclick = () => { this.close(true); Missions.acceptFail(); }; },
  hitmark(head) { const c = $('cross'); c.classList.add('hit'); c.classList.toggle('head', !!head); clearTimeout(this._hm); this._hm = setTimeout(() => c.classList.remove('hit', 'head'), head ? 220 : 120); Sfx.tone(head ? 1500 : 1100, 0.04, 0.05, 'triangle'); },
  flash() { $('vignette').style.boxShadow = 'inset 0 0 140px 50px rgba(200,40,40,.55)'; setTimeout(() => $('vignette').style.boxShadow = '', 250); },
  /* ---------- panels ---------- */
  open(kind) { if (Missions.failing) return; this.panelOpen = true; Input.uiOpen = true; if (document.pointerLockElement) document.exitPointerLock(); $('panel').hidden = false; $('pClose').hidden = false; if (['items', 'wren', 'journal', 'story', 'map', 'horse', 'system'].includes(kind)) this.tab = kind; this.kind = kind; this.render(); },
  close(force) { if (Missions.failing && !force) return; this.panelOpen = false; Input.uiOpen = Dialog.open; $('panel').hidden = true; },
  render() {
    const k = this.kind; const tabs = { system: 'Game', items: 'Satchel', wren: 'Wren', journal: 'Journal', story: 'Story', map: 'Map', horse: 'Horse' };
    if (k === 'shop' || k === 'camp') { $('pTabs').innerHTML = ''; } else { $('pTabs').innerHTML = Object.entries(tabs).map(([t, n]) => `<button class="${this.tab === t ? 'on' : ''}" data-t="${t}">${n}</button>`).join(''); $('pTabs').querySelectorAll('button').forEach(b => b.onclick = () => { this.tab = b.dataset.t; this.kind = this.tab; this.render(); }); }
    const body = $('pBody'); const fn = { shop: 'renderShop', camp: 'renderCamp' }[k] || 'render_' + this.tab; $('pTitle').textContent = k === 'shop' ? 'Holloway General Store' : k === 'camp' ? 'Camp' : tabs[this.tab]; body.innerHTML = this[fn](); this.bind(body);
    if (this.tab === 'map' && k === 'map') this.drawBigMap(); if (this.tab === 'system' && k === 'system') this.bindSettings();
  },
  bind(body) { body.querySelectorAll('[data-act]').forEach(b => b.onclick = () => { const [a, id] = b.dataset.act.split(':'); this.act(a, id); this.render(); }); },
  itemRow(id, n, btns) { const it = ITEMS[id] || { name: id, col: '#888', d: '' }; return `<div class="item"><div class="sw" style="background:${it.col}">${n > 1 ? n : ''}</div><div class="grow"><div class="nm">${esc(it.name)}</div><div class="ds">${esc(it.d || '')}</div></div>${btns || ''}</div>`; },
  render_items() {
    const by = {}; for (const [id, n] of Object.entries(S.inv)) { const c = (ITEMS[id] || {}).cat || 'misc'; (by[c] = by[c] || []).push([id, n]); }
    const names = { food: 'Provisions', herb: 'Herbs', pelt: 'Pelts', ammo: 'Ammunition', valuable: 'Valuables', tool: 'Tools', quest: 'Story items', horse: 'Horse supplies' };
    const P = Game.player, wpn = [['fists', 'Fists', 'Punch, block and roll.', '#8a6a4a', true], ['revolver', 'Revolver', `${S.ammoClip.revolver}/6 loaded · ${Inv.count('ammo_rev')} spare${S.upgrades.barrel ? ' · long barrel' : ''}`, '#3b3b3b', S.weapons.revolver], ['rifle', 'Bolt rifle', `${S.ammoClip.rifle}/5 loaded · ${Inv.count('ammo_rifle')} spare`, '#5a3a20', S.weapons.rifle]];
    let h = `<div class="stat"><span>Money</span><span>$${S.money.toFixed(2)}</span></div><div class="sec">Equipment</div><div class="list">` + wpn.filter(w => w[4]).map(([id, nm, d, c]) => `<div class="item"><div class="sw" style="background:${c}">${id === P.weapon ? '✓' : ''}</div><div class="grow"><div class="nm">${nm}</div><div class="ds">${d}</div></div><button data-act="equip:${id}" ${id === P.weapon ? 'disabled' : ''}>${id === P.weapon ? 'Equipped' : 'Equip'}</button></div>`).join('') + `<div class="item"><div class="sw" style="background:#6b3b1f">♞</div><div class="grow"><div class="nm">${S.upgrades.saddle ? 'Cartwright saddle' : 'Rancher saddle'}</div><div class="ds">${esc(S.h.name)}'s stamina ${Game.horse.maxSt()}</div></div></div></div>`;
    for (const c of Object.keys(names)) { if (!by[c]) continue; h += `<div class="sec">${names[c]}</div><div class="list">` + by[c].map(([id, n]) => this.itemRow(id, n, ITEMS[id].eat ? `<button data-act="eat:${id}">Use</button>` : '')).join('') + '</div>'; }
    h += `<div class="sec">Outfits</div><div class="list">` + Object.entries(OUTFITS).filter(([k]) => S.owned[k]).map(([k, o]) => `<div class="item"><div class="sw" style="background:${o.coat || o.shirt}"></div><div class="grow"><div class="nm">${o.name}</div></div><button data-act="wear:${k}" ${S.outfit === k ? 'disabled' : ''}>${S.outfit === k ? 'Wearing' : 'Wear'}</button></div>`).join('') + '</div>';
    return h;
  },
  render_journal() {
    let h = ''; const act = Missions.active; if (act) { const d = Missions.defs[act]; h += `<div class="sec">Active · ${esc(d.title)}</div><div class="journal">` + Missions.objectives().map(o => { const done = o.check(Missions.ctx) || (o.optional && Missions.ctx.m.opt[o.id]); return `<p class="${done ? 'done' : ''}">${o.optional ? '◇' : '◆'} ${esc(typeof o.text === 'function' ? o.text(Missions.ctx) : o.text)}</p>`; }).join('') + `<button class="btn" data-act="abandon:">Pause this mission</button></div>`; }
    const groups = { available: 'Available', done: 'Completed', failed: 'Failed', unavailable: 'Closed off by your choices' };
    for (const [st, nm] of Object.entries(groups)) { const ids = Missions.order.filter(id => Missions.st(id).status === st && Missions.defs[id].giver !== 'none'); if (!ids.length) continue; h += `<div class="sec">${nm}</div><div class="journal">` + ids.map(id => { const d = Missions.defs[id], m = Missions.st(id); return `<p><b>${esc(d.title)}</b> <small>(${d.type}${d.chapter ? ', ch. ' + d.chapter : ''})</small><br>${esc(m.outcome || d.summary)}</p>`; }).join('') + '</div>'; }
    h += `<div class="sec">Journal</div><div class="journal">` + S.log.slice(0, 30).map(l => `<p><small>Day ${l.d}, ${String(l.h).padStart(2, '0')}:00</small><br>${esc(l.text)}</p>`).join('') + '</div>';
    return h;
  },
  render_story() {
    let h = '<div class="sec">Chapters</div><div class="journal">' + CHAPTERS.map(c => `<p class="${c.n < S.chapter ? 'done' : ''}"><b>${c.n}. ${esc(c.title)}</b>${c.playable ? '' : ' <small>(designed, not yet playable)</small>'}<br>${esc(c.text)}</p>`).join('') + '</div>';
    h += '<div class="sec">People</div>'; for (const [k, c] of Object.entries(CAST)) { if (k === 'wren') continue; const r = S.rel[k]; const st = S.chars[k]; h += `<div class="stat"><span>${esc(c.name)} <small style="color:#7b7a68">${esc(c.role)}</small></span><span>${st && st !== 'alive' && st !== 'home' ? esc(st) + ' · ' : ''}${r !== undefined ? Rep.mood(k) : ''}</span></div>`; }
    h += '<div class="sec">Factions</div>' + Object.entries(S.factions).map(([f, v]) => `<div class="stat"><span>${{ town: 'Juniper Gap', crane: 'Crane gang', railroad: 'Halvorsen Railroad', greer: 'Greer family' }[f]}</span><span>${v > 30 ? 'allied' : v > 0 ? 'friendly' : v > -30 ? 'wary' : 'hostile'} (${v})</span></div>`).join('');
    h += `<div class="sec">Reputation</div><div class="stat"><span>Honor</span><span>${S.honor.toFixed(0)}</span></div><div class="stat"><span>Bounty</span><span>$${S.bounty.toFixed(2)}${S.wanted ? ' · WANTED' : ''}</span></div>`;
    const ev = Object.keys(S.evidence); h += `<div class="sec">Evidence (${ev.length})</div><div class="journal">` + (ev.length ? S.log.filter(l => l.kind === 'evidence').map(l => `<p>${esc(l.text)}</p>`).join('') : '<p>Nothing yet.</p>') + '</div>';
    const dec = Object.entries(S.decisions); if (dec.length) h += `<div class="sec">Decisions</div>` + dec.map(([k, v]) => `<div class="stat"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('');
    return h;
  },
  render_map() { return '<canvas id="bigmap" width="520" height="520"></canvas><p style="font-weight:700;font-size:12.5px;text-align:center;color:#5b5a48">Orange diamonds are objectives. Places appear once you\'ve found them.</p>'; },
  render_horse() {
    const H = Game.horse; let h = `<div class="stat"><span>Name</span><span>${esc(S.h.name)}</span></div><div class="stat"><span>Bond</span><span>Level ${H.bondLevel()} (${S.h.bond.toFixed(0)})</span></div><div class="stat"><span>Stamina</span><span>${S.h.st.toFixed(0)}/${H.maxSt()}</span></div><div class="stat"><span>Coat</span><span>${S.h.dirt > 0.5 ? 'filthy' : S.h.dirt > 0.15 ? 'dusty' : 'clean'}</span></div><div class="stat"><span>Saddle</span><span>${S.upgrades.saddle ? 'Cartwright' : 'Rancher'}</span></div>`;
    h += '<div class="sec">Saddlebags</div><div class="list">' + (Object.entries(S.h.bags).map(([id, n]) => this.itemRow(id, n, `<button data-act="takebag:${id}">Take</button>`)).join('') || '<p>Empty.</p>') + '</div>';
    h += '<div class="sec">Store in saddlebags</div><div class="list">' + Object.entries(S.inv).filter(([id]) => ['food', 'pelt', 'valuable', 'horse', 'herb'].includes(ITEMS[id]?.cat)).map(([id, n]) => this.itemRow(id, n, `<button data-act="putbag:${id}" ${H.distP > 5 ? 'disabled' : ''}>Store</button>`)).join('') + '</div>';
    if (H.distP > 5) h += '<p style="font-weight:700;color:#7b7a68">Stand next to your horse to use the saddlebags.</p>'; return h;
  },
  render_wren() { // character page: standing, cores, skills and perks, record
    const h = S.honor, sk = Object.entries(SKILLS).map(([k, d]) => { const l = Skills.lv(k), x = Skills.st()[k] || 0, nx = Skills.next(k), lo = Skills.XP[l - 1], pct = nx ? (x - lo) / (nx - lo) * 100 : 100;
      return `<div class="skill"><b>${d.name} ${ROMAN[l - 1]}</b> <small>· from ${d.how}${nx ? ` · ${Math.floor(x)}/${nx} xp` : ' · mastered'}</small><div class="bar"><b style="width:${pct.toFixed(0)}%"></b></div>${d.perks.map((p, i) => `<div class="perk ${l >= i + 2 ? '' : 'off'}">${l >= i + 2 ? '★' : '☆'} ${ROMAN[i + 1]}: ${esc(p)}</div>`).join('')}</div>`; }).join('');
    const st = S.stats, row = (a, b) => `<div class="stat"><span>${a}</span><span>${b}</span></div>`;
    return `<div class="sec">Standing</div><b>${Skills.honorRank()}</b> <small>(honor ${h > 0 ? '+' : ''}${h})</small><div class="honor"><i style="left:calc(${(h + 100) / 2}% - 2px)"></i></div><small style="color:#5b5a48">${esc(Skills.honorNote())}</small>
      ${S.bounty > 0 ? row('Bounty on your head', '$' + S.bounty.toFixed(2)) : ''}
      <div class="sec">Body</div>${row('Health', `${S.p.hp.toFixed(0)}/${S.p.maxHp} · core ${S.p.hpCore.toFixed(0)}%`)}${row('Stamina', `${S.p.st.toFixed(0)}/${S.p.maxSt} · core ${S.p.stCore.toFixed(0)}%`)}
      <div class="sec">Skills</div>${sk}
      <div class="sec">Record</div>${row('Duels won', st.duels || 0)}${row('Counters', st.counters || 0)}${row('Disarming shots', st.disarms || 0)}${row('Kills', st.kills)}${row('Pelts', st.pelts)}${row('Fish', st.fish)}${row('Crimes', st.crimes)}`;
  },
  render_system() {
    const V = Settings.v, slots = Save.slots();
    const slotRow = sl => `<div class="slot"><div class="grow">${sl.id === 'auto' ? 'Autosave' : 'Slot ' + sl.id}${sl.meta ? `<br><small style="color:#5b5a48">Day ${sl.meta.day} · Chapter ${sl.meta.ch} · $${sl.meta.money.toFixed(2)} · ${new Date(sl.meta.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small>` : '<br><small style="color:#7b7a68">Empty</small>'}</div>${sl.id !== 'auto' ? `<button class="btn alt" data-act="saveslot:${sl.id}">Save here</button>` : ''}<button class="btn" data-act="loadslot:${sl.id}" ${sl.meta ? '' : 'disabled'}>Load</button></div>`;
    return `<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn alt" data-act="resume:">Resume</button>${Camp.canMake() ? '<button class="btn" data-act="camp:">Make camp here</button>' : ''}</div>
    <div class="sec">Save & load</div>${slots.map(slotRow).join('')}
    <div class="sec">Camera & controls</div>
    <label class="range">Look sensitivity<input type="range" id="setSens" min="0.4" max="2" step="0.05" value="${V.sens}"><span>${V.sens.toFixed(2)}</span></label>
    <label class="range">Camera distance<input type="range" id="setZoom" min="2.4" max="9" step="0.1" value="${Game.cam.zoom}"><span>${Game.cam.zoom.toFixed(1)}</span></label>
    <label class="range"><input type="checkbox" id="setInv" ${V.invertY ? 'checked' : ''}> Invert vertical look</label>
    <label class="range"><input type="checkbox" id="setAuto" ${V.autoCam ? 'checked' : ''}> Camera follows behind you while moving</label>
    <label class="range"><input type="checkbox" id="setLock" ${V.mouseLock !== false ? 'checked' : ''}> Lock the mouse to the game on click (Esc releases it; dragging works either way)</label>
    <div class="sec">Touch controls</div>
    <label class="range">Touch look speed<input type="range" id="setTsens" min="0.4" max="2.5" step="0.05" value="${V.tsens || 1}"><span>${(V.tsens || 1).toFixed(2)}</span></label>
    <label class="range">Button size <select id="setBtn">${[[0.85, 'Small'], [1, 'Medium'], [1.2, 'Large']].map(([v, n]) => `<option value="${v}" ${+V.btnScale === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="range"><input type="checkbox" id="setLefty" ${V.lefty ? 'checked' : ''}> Left-handed layout (stick on the right, buttons on the left)</label>
    <label class="range"><input type="checkbox" id="setRun" ${V.autoRun !== false ? 'checked' : ''}> Push the stick to the edge to run</label>
    <label class="range"><input type="checkbox" id="setHap" ${V.haptics !== false ? 'checked' : ''}> Vibration on hits, counters and level-ups</label>
    <div class="sec">Graphics & sound</div>
    <label class="range">Quality <select id="setQ">${['auto', 'low', 'medium', 'high'].map(q => `<option value="${q}" ${V.quality === q ? 'selected' : ''}>${q[0].toUpperCase() + q.slice(1)}${q === 'auto' ? ` (${Game.quality})` : ''}</option>`).join('')}</select></label>
    <label class="range">Volume<input type="range" id="setVol" min="0" max="1" step="0.05" value="${V.sound}"><span>${Math.round(V.sound * 100)}%</span></label>
    <div class="sec">Character</div><div class="stat"><span>Health</span><span>${S.p.hp.toFixed(0)}/${S.p.maxHp} · core ${S.p.hpCore.toFixed(0)}%</span></div><div class="stat"><span>Stamina</span><span>${S.p.st.toFixed(0)}/${S.p.maxSt.toFixed(0)} · core ${S.p.stCore.toFixed(0)}%</span></div><div class="stat"><span>Day</span><span>${S.time.day}</span></div><div class="stat"><span>Pelts skinned</span><span>${S.stats.pelts}</span></div><div class="stat"><span>Fish caught</span><span>${S.stats.fish}</span></div>
    <div class="sec">Controls</div><p style="font-weight:700;font-size:13px;line-height:1.6">${$('keys').innerHTML}</p>`; },
  bindSettings() {
    const on = (id, ev, fn) => { const e = $(id); if (e) e.addEventListener(ev, fn); };
    on('setSens', 'input', e => { Settings.set('sens', +e.target.value); e.target.nextElementSibling.textContent = (+e.target.value).toFixed(2); });
    on('setZoom', 'input', e => { Game.cam.zoom = +e.target.value; Settings.set('zoom', +e.target.value); e.target.nextElementSibling.textContent = (+e.target.value).toFixed(1); });
    on('setTsens', 'input', e => { Settings.set('tsens', +e.target.value); e.target.nextElementSibling.textContent = (+e.target.value).toFixed(2); });
    on('setBtn', 'change', e => { Settings.set('btnScale', +e.target.value); Input.applyLayout(); }); on('setLefty', 'change', e => { Settings.set('lefty', e.target.checked); Input.applyLayout(); });
    on('setRun', 'change', e => Settings.set('autoRun', e.target.checked)); on('setHap', 'change', e => Settings.set('haptics', e.target.checked));
    on('setInv', 'change', e => Settings.set('invertY', e.target.checked)); on('setAuto', 'change', e => Settings.set('autoCam', e.target.checked));
    on('setLock', 'change', e => { Settings.set('mouseLock', e.target.checked); if (!e.target.checked && document.pointerLockElement) document.exitPointerLock(); });
    on('setQ', 'change', e => Settings.set('quality', e.target.value)); on('setVol', 'input', e => { Settings.set('sound', +e.target.value); e.target.nextElementSibling.textContent = Math.round(e.target.value * 100) + '%'; });
  },
  renderShop() {
    const mul = Inv.priceMul(); const open = S.time.hour >= 7 && S.time.hour < 20; const buy = ['beans', 'coffee', 'apple', 'carrot', 'oats', 'ammo_rev', 'ammo_rifle', 'tonic', 'rod', 'shovel'];
    let h = `<div class="stat"><span>Your money</span><span>$${S.money.toFixed(2)}</span></div>${mul !== 1 ? `<p style="font-weight:800;color:${mul > 1 ? '#c8443a' : '#3a7d4f'}">${mul > 1 ? 'Mae is charging you more than she charges others.' : 'Mae gives you a friendly discount.'}</p>` : ''}`;
    h += '<div class="sec">Buy</div><div class="list">' + buy.map(id => { const p = ITEMS[id].price * mul; return this.itemRow(id, 0, `<button data-act="buy:${id}" ${S.money < p || !open ? 'disabled' : ''}>$${p.toFixed(2)}</button>`); }).join('') + '</div>';
    h += '<div class="sec">Outfits & upgrades</div><div class="list">' + Object.entries(OUTFITS).filter(([k, o]) => o.price && !S.owned[k]).map(([k, o]) => `<div class="item"><div class="sw" style="background:${o.coat || o.shirt}"></div><div class="grow"><div class="nm">${o.name}</div></div><button data-act="outfit:${k}" ${S.money < o.price * mul ? 'disabled' : ''}>$${(o.price * mul).toFixed(2)}</button></div>`).join('') + Object.entries(UPGRADES).filter(([k]) => !S.upgrades[k] && !(k === 'rifle' && S.weapons.rifle)).map(([k, u]) => `<div class="item"><div class="sw" style="background:#5a4a3a">★</div><div class="grow"><div class="nm">${u.name}</div><div class="ds">${u.d}</div></div><button data-act="upg:${k}" ${S.money < u.price * mul ? 'disabled' : ''}>$${(u.price * mul).toFixed(2)}</button></div>`).join('') + '</div>';
    const sell = Object.entries(S.inv).filter(([id]) => ITEMS[id]?.sell); h += '<div class="sec">Sell</div><div class="list">' + (sell.map(([id, n]) => this.itemRow(id, n, `<button data-act="sell:${id}">$${(ITEMS[id].sell * (2 - mul)).toFixed(2)}</button>`)).join('') || '<p>Nothing to sell. Pelts, valuables and fish fetch a price.</p>') + '</div>'; return h;
  },
  renderCamp() {
    const raw = Object.keys(S.inv).filter(id => ITEMS[id]?.cook); const canTonic = Inv.count('sage') >= 1 && Inv.count('berries') >= 2;
    return `<p style="font-weight:700">The fire crackles. ${Sky.night() ? 'Stars overhead.' : 'A quiet spot.'}</p><div class="sec">Cook</div><div class="list">${raw.map(id => this.itemRow(id, S.inv[id], `<button data-act="cook:${id}">Cook all</button>`)).join('') || '<p>No raw meat or fish.</p>'}</div>
    <div class="sec">Craft</div><div class="list">${this.itemRow('tonic', 0, `<button data-act="craft:tonic" ${canTonic ? '' : 'disabled'}>Craft</button>`)}</div>
    <div class="sec">Rest</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn alt" data-act="rest:3">Rest 3 hours</button><button class="btn alt" data-act="rest:morning">Sleep until morning</button><button class="btn" data-act="save:">Save game</button><button class="btn" data-act="pack:">Pack up camp</button></div>`;
  },
  act(a, id) {
    const mul = Inv.priceMul();
    switch (a) {
      case 'eat': { const it = ITEMS[id]; if (!Inv.take(id)) return; const e = it.eat; Game.player.anim.play('eat'); Sfx.tone(300, 0.15, 0.05, 'triangle'); S.p.hp = Math.min(S.p.maxHp, S.p.hp + (e.hp || 0)); S.p.st = Math.min(S.p.maxSt, S.p.st + (e.st || 0)); S.p.hpCore = Math.min(100, S.p.hpCore + (e.core || 0)); S.p.stCore = Math.min(100, S.p.stCore + (e.core || 0) * 0.7); S.p.xpHp += 1; if (e.sick) { UI.toast('That didn\'t sit right. Cook meat first.', 'bad'); S.p.stCore = Math.max(0, S.p.stCore - 15); } this.levelCheck(); break; }
      case 'wear': S.outfit = id; Game.player.buildRig(); break;
      case 'equip': Game.player.setWeapon(id); break;
      case 'buy': { const it = ITEMS[id], p = it.price * mul; if (S.money < p) return; Inv.money(-p); if (it.pack) Inv.add(id, it.pack); else Inv.add(id, 1); break; }
      case 'sell': { const p = ITEMS[id].sell * (2 - mul); Inv.take(id); Inv.money(p, 'sold'); break; }
      case 'outfit': { const o = OUTFITS[id]; Inv.money(-o.price * mul); S.owned[id] = 1; S.outfit = id; Game.player.buildRig(); UI.toast(`Bought ${o.name}`, 'good'); break; }
      case 'upg': { const u = UPGRADES[id]; Inv.money(-u.price * mul); if (id === 'rifle') { S.weapons.rifle = 1; Inv.add('ammo_rifle', 10); } else S.upgrades[id] = 1; UI.toast(`Bought ${u.name}`, 'good'); break; }
      case 'takebag': S.h.bags[id]--; if (!S.h.bags[id]) delete S.h.bags[id]; Inv.add(id, 1, true); break;
      case 'putbag': if (Inv.take(id)) S.h.bags[id] = (S.h.bags[id] || 0) + 1; break;
      case 'save': Save.save(); break; case 'load': this.close(); Save.load(); break;
      case 'saveslot': Save.save(false, id); break; case 'loadslot': this.close(); Save.load(id); break; case 'resume': this.close(); return; case 'camp': this.close(); Camp.make(); return;
      case 'mute': if (Sfx.master) Sfx.master.gain.value = Sfx.master.gain.value ? 0 : (Settings.v.sound || 0.6); break;
      case 'cook': { const n = S.inv[id]; Inv.take(id, n); Inv.add(ITEMS[id].cook, n); Sfx.burst(3000, 0.6, 0.08); break; }
      case 'craft': Inv.take('sage'); Inv.take('berries', 2); Inv.add('tonic'); break;
      case 'rest': this.close(); Camp.rest(false, id === 'morning'); break;
      case 'pack': this.close(); Camp.pack(); break;
      case 'abandon': Missions.abandon(); break;
    }
  },
  levelCheck() { const lv = Math.floor(S.p.xpHp / 12); const nm = 100 + lv * 10; if (nm > S.p.maxHp) { S.p.maxHp = nm; UI.banner('Health improved', `Max health ${nm}`); } const ls = Math.floor(S.p.xpSt / 40); const ns = 100 + ls * 10; if (ns > S.p.maxSt) { S.p.maxSt = ns; UI.banner('Stamina improved', `Max stamina ${ns}`); } },
  /* ---------- maps ---------- */
  buildMapImage() { const N = 240, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), img = g.createImageData(N, N), col = Terrain.baseCol, n = Terrain.n;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const ti = Math.floor(i / N * (n - 1)), tj = Math.floor(j / N * (n - 1)), k = tj * n + ti, h = Terrain.H[k], o = (j * N + i) * 4; const water = h < WORLD.waterY; img.data[o] = water ? 79 : col[k * 3] * 255; img.data[o + 1] = water ? 168 : col[k * 3 + 1] * 255; img.data[o + 2] = water ? 216 : col[k * 3 + 2] * 255; img.data[o + 3] = 255; }
    g.putImageData(img, 0, 0); g.fillStyle = '#6b4226'; for (const b of Buildings) { const x = (b.minX + WORLD.half) / WORLD.size * N, z = (b.minZ + WORLD.half) / WORLD.size * N; g.fillRect(x, z, (b.maxX - b.minX) / WORLD.size * N, (b.maxZ - b.minZ) / WORLD.size * N); } return c; },
  drawMarks(g, toX, toZ, s) {
    const P = Game.player, H = Game.horse;
    if (Law.searchC && S.wanted) { g.strokeStyle = 'rgba(200,68,58,.9)'; g.fillStyle = 'rgba(200,68,58,.18)'; g.lineWidth = 2; g.beginPath(); g.arc(toX(Law.searchC.x), toZ(Law.searchC.z), Law.searchR * s, 0, TAU); g.fill(); g.stroke(); }
    g.font = '900 11px Nunito, sans-serif'; g.textAlign = 'center';
    for (const p of POIS) if (S.discovered[p.id]) { g.fillStyle = '#1d2a25'; g.beginPath(); g.arc(toX(p.x), toZ(p.z), 4, 0, TAU); g.fill(); if (s < 1.2) { g.fillStyle = '#f4ead3'; g.strokeStyle = '#1d2a25'; g.lineWidth = 3; g.strokeText(p.name, toX(p.x), toZ(p.z) - 8); g.fillText(p.name, toX(p.x), toZ(p.z) - 8); } }
    for (const m of Missions.markers()) { const x = toX(m.x), z = toZ(m.z); g.fillStyle = m.giver ? '#e9c46a' : m.enemy ? '#c8443a' : '#e8833a'; g.beginPath(); g.moveTo(x, z - 6); g.lineTo(x + 5, z); g.lineTo(x, z + 6); g.lineTo(x - 5, z); g.fill(); }
    for (const n of NPC.all) if (n.alive && !n.downed && (n.state === 'combat' || n.state === 'pursue') && n.distP < 90) { g.fillStyle = '#c8443a'; g.beginPath(); g.arc(toX(n.pos.x), toZ(n.pos.z), 3, 0, TAU); g.fill(); }
    g.fillStyle = '#8fc7e8'; g.beginPath(); g.arc(toX(H.pos.x), toZ(H.pos.z), 4, 0, TAU); g.fill();
    g.save(); g.translate(toX(P.pos.x), toZ(P.pos.z)); g.rotate(-P.yaw + Math.PI); g.fillStyle = '#fff'; g.strokeStyle = '#1d2a25'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
  },
  drawMini() { const c = $('mini'), g = c.getContext('2d'), W = c.width, P = Game.player.pos, R = 90, s = W / (2 * R); g.save(); g.clearRect(0, 0, W, W); g.beginPath(); g.arc(W / 2, W / 2, W / 2, 0, TAU); g.clip();
    const rot = Game.cam.yaw - Math.PI; g.translate(W / 2, W / 2); g.rotate(rot); g.translate(-W / 2, -W / 2); this._miniRot = rot;
    const N = this.mapImg.width, px = (P.x + WORLD.half) / WORLD.size * N, pz = (P.z + WORLD.half) / WORLD.size * N, r = R / WORLD.size * N; g.imageSmoothingEnabled = false; g.drawImage(this.mapImg, px - r, pz - r, 2 * r, 2 * r, 0, 0, W, W);
    const toX = x => W / 2 + (x - P.x) * s, toZ = z => W / 2 + (z - P.z) * s; this.drawMarks(g, toX, toZ, s);
    g.restore(); g.save(); g.beginPath(); g.arc(W / 2, W / 2, W / 2, 0, TAU); g.clip();
    // off-screen objective arrows (rotated with the map) and the north marker
    const rt = this._miniRot; for (const m of Missions.markers()) { const dx = m.x - P.x, dz = m.z - P.z, d = Math.hypot(dx, dz); if (d < R * 0.9) continue; const a = Math.atan2(dz, dx) + rt; const x = W / 2 + Math.cos(a) * (W / 2 - 10), z = W / 2 + Math.sin(a) * (W / 2 - 10); g.fillStyle = m.giver ? '#e9c46a' : '#e8833a'; g.beginPath(); g.arc(x, z, 6, 0, TAU); g.fill(); }
    const na = -Math.PI / 2 + rt, nx = W / 2 + Math.cos(na) * (W / 2 - 13), nz = W / 2 + Math.sin(na) * (W / 2 - 13); g.fillStyle = '#1d2a25'; g.beginPath(); g.arc(nx, nz, 11, 0, TAU); g.fill(); g.fillStyle = '#f4ead3'; g.font = '900 13px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', nx, nz + 1);
    g.restore(); },
  drawBigMap() { const c = $('bigmap'); if (!c) return; const g = c.getContext('2d'), W = c.width, s = W / WORLD.size; g.imageSmoothingEnabled = true; g.drawImage(this.mapImg, 0, 0, W, W); this.drawMarks(g, x => (x + WORLD.half) * s, z => (z + WORLD.half) * s, s); },
  /* ---------- per-frame HUD ---------- */
  update(dt) {
    const P = Game.player, H = Game.horse; this.setRing('hp', S.p.hp / S.p.maxHp, S.p.hpCore / 100); this.setRing('st', S.p.st / S.p.maxSt, S.p.stCore / 100);
    $('hrings').hidden = P.state !== 'ride' && H.distP > 12; this.setRing('hhp', 1, S.h.fed / 100); this.setRing('hst', S.h.st / H.maxSt(), H.bondLevel() / 4);
    $('cash').textContent = '$' + S.money.toFixed(2);
    const h = S.time.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 15) * 15; $('clock').textContent = `Day ${S.time.day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${{ clear: 'Clear', cloudy: 'Overcast', rain: 'Rain', storm: 'Thunderstorm', fog: 'Fog' }[Sky.weather]}`;
    const ob = $('objective'); if (Missions.active) { const objs = Missions.objectives().filter(o => !o.check(Missions.ctx) && !(o.optional && Missions.ctx.m.opt[o.id])); const main = objs.find(o => !o.optional) || objs[0]; ob.hidden = !main; if (main) ob.innerHTML = `<small>${esc(Missions.defs[Missions.active].title)}</small>${esc(typeof main.text === 'function' ? main.text(Missions.ctx) : main.text)}`; } else ob.hidden = true;
    const w = $('wanted'); w.hidden = !(S.wanted || S.bounty > 0); if (!w.hidden) w.textContent = S.wanted ? `WANTED · $${S.bounty.toFixed(2)}` : `Bounty $${S.bounty.toFixed(2)}`; w.style.background = S.wanted ? 'var(--brick)' : 'rgba(29,42,37,.7)';
    $('cross').hidden = !P.aiming; $('cross').classList.toggle('lock', !!(P.hover && P.hover.h)); if (P.aiming) $('cross').style.setProperty('--s', (1 + P.spread() * 45).toFixed(3)); /* red over a target, wider while the spread blooms */ const am = $('ammo'); am.hidden = P.weapon === 'fists'; if (!am.hidden) am.textContent = P.weapon === 'revolver' ? `${S.ammoClip.revolver} | ${Inv.count('ammo_rev')}` : `${S.ammoClip.rifle} | ${Inv.count('ammo_rifle')}`;
    const wind = P.weapon === 'fists' && P.state === 'ground' && !P.grab && NPC.all.some(n => n.windT > 0 && n.alive && !n.downed && n.distP < 3); // an enemy is winding up a punch: block now to counter
    const cue = $('cue'); if (cue) { const show = wind && !P.blocking && Settings.v.hints !== false; if (cue.hidden === show) cue.hidden = !show; } const bb = document.querySelector('#tctx [data-b="block"]'); if (bb && bb.classList.contains('cue') !== wind) bb.classList.toggle('cue', wind);
    if (Input.touch) { const ctx = { reload: P.weapon !== 'fists' && S.ammoClip[P.weapon] < (P.weapon === 'rifle' ? 5 : 6) && Inv.count(P.weapon === 'rifle' ? 'ammo_rifle' : 'ammo_rev') > 0, weapon: !!(S.weapons.revolver || S.weapons.rifle), block: P.state === 'ground' && P.weapon === 'fists' && (this.threat() || P.blocking), grab: P.state === 'ground' && P.weapon === 'fists' && !P.grab && NPC.all.some(n => Brawl.canGrab(n) && n.distP < 1.9 && (n.hostileToPlayer || n.state === 'combat')), shove: !!P.grab, dodge: P.state === 'ground' && this.threat(), whistle: P.state !== 'ride' && H.distP > 14 };
      for (const [k, v] of Object.entries(ctx)) { const b = document.querySelector(`#tctx [data-b="${k}"]`); if (b && b.hidden === v) b.hidden = !v; }
      const aimB = $('tAim'); if (aimB.hidden !== (P.weapon === 'fists')) aimB.hidden = P.weapon === 'fists'; if (P.weapon === 'fists' && Input.aimToggle) { Input.aimToggle = false; aimB.classList.remove('on'); }
      $('tCrouch').hidden = P.state === 'ride'; $('tJump').textContent = P.state === 'ride' ? 'Hop' : 'Jump'; const atk = document.querySelector('#tcluster [data-b="attack"]'), at = P.grab ? 'Punch' : P.weapon === 'fists' ? 'Attack' : `Shoot<br><small>${S.ammoClip[P.weapon]} | ${Inv.count(P.weapon === 'rifle' ? 'ammo_rifle' : 'ammo_rev')}</small>`; if (atk._t !== at) { atk._t = at; atk.innerHTML = at; } const wb = document.querySelector('#tctx [data-b="weapon"]'); if (wb) wb.textContent = P.weapon === 'fists' ? 'Draw gun' : P.weapon === 'revolver' ? (S.weapons.rifle ? 'Rifle' : 'Fists') : 'Fists'; }
    const hc = $('horseCard'), nearH = P.state === 'ride' || (H.distP < 5 && !Dialog.open && !this.panelOpen); hc.hidden = !nearH; if (nearH) { const html = `${esc(S.h.name)} · bond ${H.bondLevel()} <span>Stamina<i><b style="width:${(S.h.st / H.maxSt() * 100).toFixed(0)}%"></b></i></span>${S.h.fed < 30 ? ' · hungry' : ''}${S.h.dirt > 0.15 ? ' · dusty' : ''}`; if (hc._h !== html) { hc._h = html; hc.innerHTML = html; } }
    this.miniT = (this.miniT || 0) - dt; if (this.miniT <= 0) { this.miniT = 0.1; this.drawMini(); }
    this.tags();
  },
  tags() { // world-space labels: speech, alert meters, mission markers
    const out = [], cam = Game.camera, v = new THREE.Vector3(), W = innerWidth, Hh = innerHeight;
    const add = (x, y, z, txt, cls) => { v.set(x, y, z).project(cam); if (v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2) return; out.push([(v.x + 1) / 2 * W, (1 - v.y) / 2 * Hh, txt, cls]); };
    for (const n of NPC.all) { if (!n.alive || n.distP > 40) continue; const y = n.pos.y + 2.3 * (n.rig.scale || 1); if (n.speech) add(n.pos.x, y + 0.2, n.pos.z, n.speech, 'n'); else if (n.state === 'patrol' && n.alert > 0.05) add(n.pos.x, y, n.pos.z, n.alert > 0.6 ? '?!' : '?', 'q'); else if (n.state === 'combat' && n.distP < 30) add(n.pos.x, y, n.pos.z, '!', 'x'); else if (n.witness && (n.state === 'report' || n.state === 'confront')) add(n.pos.x, y, n.pos.z, '!', 'x'); else if (n.distP < 9 && !n.downed) add(n.pos.x, y, n.pos.z, n.name, 'n'); }
    for (const m of Missions.markers()) add(m.x, (m.y ?? Terrain.height(m.x, m.z) + 3), m.z, '▼', 'm');
    while (this.tagPool.length < out.length) { const d = document.createElement('div'); $('tags').appendChild(d); this.tagPool.push(d); }
    this.tagPool.forEach((d, i) => { const o = out[i]; if (!o) { d.hidden = true; return; } d.hidden = false; d.className = 'tag ' + o[3]; d.style.left = o[0] + 'px'; d.style.top = o[1] + 'px'; if (d.textContent !== o[2]) d.textContent = o[2]; });
  },
};

/* ---------- Camp ---------- */
const Camp = {
  fire: null,
  canMake() { const P = Game.player; return !this.fire && !this.pending && Inv.count('kit') && Math.hypot(P.pos.x + 40, P.pos.z - 20) >= 60 && Math.hypot(P.pos.x + 118, P.pos.z - 94) >= 30 && !S.wanted; },
  make() { const P = Game.player; if (this.pending) return; if (this.fire) { UI.toast('Your camp is already set up.'); return; } if (!Inv.count('kit')) { UI.toast('You need a camp kit.', 'bad'); return; } if (Math.hypot(P.pos.x + 40, P.pos.z - 20) < 60 || Math.hypot(P.pos.x + 118, P.pos.z - 94) < 30) { UI.toast('Too close to town to make camp.', 'bad'); return; } if (S.wanted) { UI.toast('Can\'t make camp while the law is after you.', 'bad'); return; } if (NPC.all.some(n => n.state === 'combat' && n.alive && !n.downed) || P.state !== 'ground') { UI.toast('Not now.', 'bad'); return; }
    const f = fwd(P.yaw); const x = P.pos.x + f.x * 2, z = P.pos.z + f.z * 2; P.anim.play('kneel', { loop: true }); this.pending = true; const gen = Game.gen; setTimeout(() => { this.pending = false; P.anim.stop('kneel'); if (gen !== Game.gen || this.fire) return; this.spawn(x, z); S.camp = { x, z }; Missions.emit('camp', {}); }, 1200); },
  spawn(x, z) { const g = World.campfire(x, z, false); const bed = M(GEO.box, '#4f7ca8', 0.9, 0.15, 2, 1.8, 0.08, 0); g.add(bed); const tent = M(GEO.cone, '#d9c58f', 1.5, 1.6, 1.5, -1.8, 0.8, 1.6); tent.geometry = new THREE.ConeGeometry(1, 1, 4); g.add(tent); this.fire = { g, x, z }; this.it = Interact.add({ pos: () => ({ x, y: Terrain.height(x, z), z }), r: 2.6, pri: 0.3, opts: () => [{ label: 'Use campfire', fn: () => UI.open('camp') }] }); },
  pack() { if (!this.fire) return; Game.scene.remove(this.fire.g); Game.fires = Game.fires.filter(f => f.g !== this.fire.g); Interact.remove(this.it); this.fire = null; S.camp = null; },
  rest(safehouse, morning) { const P = Game.player; if (NPC.all.some(n => n.state === 'combat' && n.alive && !n.downed)) { UI.toast('You can\'t rest with enemies nearby.', 'bad'); return; } let hrs = 3; if (morning || safehouse) { hrs = ((24 - S.time.hour) + 7) % 24 || 24; } UI.banner(safehouse ? 'The Greer farm' : 'Camp', `Rested ${Math.round(hrs)} hours`); Sky.advance(hrs); S.p.hp = S.p.maxHp; S.p.st = S.p.maxSt; S.p.hpCore = Math.max(S.p.hpCore, 70); S.h.st = Game.horse.maxSt(); if (safehouse) { S.p.hpCore = 100; if (!S.h.bags.oats) S.h.bags.oats = 1; } Save.save(true); },
};

/* ---------- Fishing ---------- */
const Fishing = {
  on: false, hold: false, phase: '', t: 0, prog: 0, tension: 0,
  nearWater() { const P = Game.player, f = fwd(P.yaw); for (const d of [1.5, 2.5, 3.5, 4.5, 5.5]) { const x = P.pos.x + f.x * d, z = P.pos.z + f.z * d; if (WORLD.waterY - Terrain.height(x, z) > 0.7) return true; } return false; },
  init() { Interact.add({ pos: () => Game.player.pos, r: 1, pri: -1, opts: p => Inv.count('rod') && p.state === 'ground' && !p.carry && this.nearWater() && !this.on ? [{ label: 'Fish', fn: () => this.start() }] : [] }); },
  start() { const P = Game.player; this.on = true; this.phase = 'cast'; this.t = rand(3, 7); this.prog = 0; this.tension = 0; P.anim.play('cast'); P.state = 'fish'; $('fish').hidden = false; $('fishTxt').textContent = 'Waiting for a bite… (E / tap to stop)'; $('fishBar').style.width = '0%'; this.bob = M(GEO.sph, '#c8443a', 0.08, 0.08, 0.08); const f = fwd(P.yaw); this.bob.position.set(P.pos.x + f.x * 6, WORLD.waterY + 0.05, P.pos.z + f.z * 6); Game.scene.add(this.bob); },
  stop(msg) { this.on = false; $('fish').hidden = true; Game.player.state = 'ground'; Game.player.anim.stop(); if (this.bob) Game.scene.remove(this.bob); if (msg) UI.toast(msg); },
  update(dt) {
    if (!this.on) return; const P = Game.player; const reel = this.hold || Input.down('e') || Input.mouse.l || Input.btn.attack; this.t -= dt;
    P.anim.update(dt, { state: 'ground', speed: 0 }); P.place();
    if (this.phase === 'cast') { this.bob.position.y = WORLD.waterY + 0.05 + Math.sin(Game.time * 3.3) * 0.02; if (Input.hit('e') || Input.hit('escape')) return this.stop('Reeled in empty.'); if (this.t <= 0) { this.phase = 'bite'; this.t = 1.2; $('fishTxt').textContent = 'Bite! Hold to reel!'; Sfx.splash(); this.bob.position.y -= 0.15; } }
    else if (this.phase === 'bite') { if (reel) { this.phase = 'reel'; P.anim.play('reel', { loop: true }); } else if (this.t <= 0) { this.stop('It got away.'); } }
    else if (this.phase === 'reel') { const pull = 0.5 + Math.sin(Game.time * 2.5) * 0.5; if (reel) { this.prog += dt * 0.22; this.tension += dt * (0.25 + pull * 0.45); } else { this.tension -= dt * 0.6; this.prog -= dt * 0.04; } this.tension = clamp(this.tension, 0, 1.01); this.prog = clamp(this.prog, 0, 1);
      $('fishBar').style.width = (this.prog * 100) + '%'; $('fishBar').style.background = this.tension > 0.8 ? '#c8443a' : '#9dbf8a'; $('fishTxt').textContent = this.tension > 0.8 ? 'Line\'s straining! Ease off!' : 'Reel it in…';
      if (this.tension > 1) return this.stop('The line snapped.'); if (this.prog >= 1) { Inv.add('fish_raw'); S.stats.fish++; Missions.emit('fish', {}); this.stop('Caught a trout!'); } }
  }
};
