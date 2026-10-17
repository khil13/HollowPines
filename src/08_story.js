/* ===== Story: cast, reactive dialogue, missions, encounters =====
   Hollow Pines — five chapters. Wren Calloway comes home to Juniper Gap because her brother Eli, a railroad
   surveyor, stopped writing. Eli found out the Halvorsen Railroad's land agent, Silas Vane, is using the Crane
   gang to scare homesteaders off land the new line will cross, and that someone in town is helping.
   All five chapters are playable (Chapter 4 lives in 08b_ch4.js, Chapter 5 in 08c_ch5.js). */
const CAST = {
  wren: { name: 'Wren Calloway', role: 'Protagonist', bio: 'Former railroad survey hand, eight years gone from the valley. Steady, dry, and too proud to ask for help. Wants her brother home, and wants to know who sold him out.' },
  eli: { name: 'Eli Calloway', role: 'The missing brother', bio: 'Wren\'s younger brother, surveying for the Halvorsen line. Stubborn and honest to a fault. He wrote everything down.' },
  mae: { name: 'Mae Holloway', role: 'Storekeeper · ally', bio: 'Runs the general store. Eli trusted her with his papers. Practical, warm, and unforgiving of liars. Wants Eli back and the town left alone.' },
  pike: { name: 'Sheriff Amos Pike', role: 'Lawman · hidden betrayer', bio: 'Twenty years wearing the star and tired of it. Takes Vane\'s money to look away, and tells himself it keeps the peace. Wants to retire before it catches up with him.' },
  ezra: { name: 'Ezra Greer', role: 'Homesteader', bio: 'Farms the east meadow with his wife Nell. Hard-headed, proud, behind on everything. Wants to keep the land his father broke.' },
  nell: { name: 'Nell Greer', role: 'Homesteader', bio: 'Ezra\'s wife. Keeps the books, and knows exactly how bad things are. Wants her family safe more than the land.' },
  fenwick: { name: 'Fenwick Crane', role: 'Outlaw boss (rival faction)', bio: 'Leads the Crane gang. Hired muscle for the railroad, and resents being treated like it. Wants a bigger cut, or to cut Vane out entirely.' },
  dutchy: { name: 'Dutchy Moss', role: 'Gang lookout · possible ally', bio: 'Nineteen and in over his head. Joined the Cranes for meals, stayed out of fear. Wants a way out that won\'t get him shot.' },
  vane: { name: 'Silas Vane', role: 'Railroad land agent (antagonist)', bio: 'Soft-spoken and always smiling. Buys land cheap after the Cranes make owners desperate. Wants the line built on his maps, and the profit in his name. (First seen in person at Willow Bridge.)' },
  brock: { name: 'Brock Harlan', role: 'Vane\'s foreman', bio: 'Collects "debts" for the railroad with a ledger and two hired guns.' },
  cora: { name: 'Cora Vance', role: 'Saloon keeper', bio: 'Hears everything said over her bar and sells some of it. Fond of people who tip and people who tell the truth.' },
  hank: { name: 'Hank Dorsey', role: 'Old prospector', bio: 'Forty years looking for the big strike. Talks to his mule, who is not present.' },
  doc: { name: 'Doc Pell', role: 'Town doctor', bio: 'Patches up anyone who pays and most who can\'t.' },
};
const CHAPTERS = [
  { n: 1, title: 'The Long Way Home', playable: true, text: 'Wren rides into Juniper Gap. Mae\'s strongbox, holding Eli\'s papers, has been stolen by the Crane gang.' },
  { n: 2, title: 'Cold Trail', playable: true, text: 'Eli\'s survey page points to Hollow Cabin. His tracks lead to Bluecap Cave and his field journal, and the Cranes want it too.' },
  { n: 3, title: "Greer's Stand", playable: true, text: 'Eli\'s journal lists the Greers as Vane\'s next mark. Railroad men arrive at their farm with a "debt" to collect.' },
  { n: 4, title: 'Night at Willow Bridge', playable: true, text: 'Sheriff Pike walks out of town at midnight. Follow him unseen to Willow Bridge and hear what he and Silas Vane have to say. What you gave Pike in Chapter 2 decides what he brings to it.' },
  { n: 5, title: 'The Ledger', playable: true, text: 'Eli is held at Survey Camp 3, Tamarack Pass. Ride in with the territorial marshal (if you kept evidence, or Pike turned), with the Cranes (if Dutchy is your ally), or alone. Vane can be arrested, shot, or paid off.' },
];

const STORY = {
  hint(t) { if (Settings.v.hints) UI.toast('Tip: ' + t, 'good'); },
  /* ---------- people in the world (spawned according to persistent state) ---------- */
  roster() {
    const town = (k, o) => Object.assign({ key: k, name: NPCNAMES[k] || o.name, region: 'town', cond: () => S.chars[k] !== 'left' }, o);
    return [
      town('mae', { x: -58, z: 5.4, look: { skin: '#f0c4a0', shirt: '#7a4a8a', apron: '#f4ead3', hair: '#3b2618', longHair: true, hat: false, scarf: '#e9c46a' }, brave: 0.7, schedule: [[7, 20, 'storeCounter'], [20, 22, 'saloonStand'], [22, 7, 'maeBed']], talk: n => STORY.talkMae(n), greetLine: (m) => S.decisions.m1_box === 'skimmed' ? 'Wren.' : null }),
      town('pike', { x: -22, z: 5.6, look: { skin: '#d9a07a', shirt: '#6b6b6b', vest: '#2b2b2b', hair: '#9a9a9a', mustache: '#cfcfcf', hatColor: '#222', stout: 1.15, scarf: '#2b2b2b' }, lawman: true, brave: 0.9, gun: 'revolver', hp: 140, maxHp: 140, accuracy: 0.5, schedule: [[7, 10, 'sheriffDesk'], [10, 13, 'patrolE'], [13, 16, 'sheriffPorch'], [16, 19, 'patrolW'], [19, 23, 'saloonSeatA'], [23, 7, 'sheriffDesk']], talk: n => STORY.talkPike(n) }),
      town('lyle', { name: 'Deputy Bramble', x: -12, z: 21, look: { skin: '#f0c4a0', shirt: '#9a7b4f', hair: '#c9a227', hatColor: '#8b6a47', scale: 0.98 }, lawman: true, brave: 0.7, gun: 'revolver', hp: 110, maxHp: 110, schedule: [[8, 12, 'patrolW'], [12, 18, 'sheriffPorch'], [18, 22, 'patrolE'], [22, 8, 'sheriffPorch']], tags: ['generic'] }),
      town('cora', { x: -40, z: 3.2, look: { skin: '#c98a62', shirt: '#2f4f6f', hair: '#1b1b1b', longHair: true, hat: false, scarf: '#c8443a' }, brave: 0.6, schedule: [[10, 2, 'saloonBar'], [2, 10, 'boardBedA']], talk: n => STORY.talkCora(n) }),
      town('doc', { x: -40, z: 33, look: { skin: '#e8b48c', shirt: '#f4ead3', vest: '#3b3b5b', hair: '#ddd', hatColor: '#333', beard: '#ddd', scale: 0.95 }, brave: 0.3, schedule: [[7, 12, 'docDesk'], [12, 14, 'saloonSeatB'], [14, 20, 'docDesk'], [20, 22, 'well'], [22, 7, 'docBed']], talk: n => STORY.talkDoc(n) }),
      town('hank', { x: -38, z: 21, look: { skin: '#d9a07a', shirt: '#8a6a4a', hair: '#bbb', beard: '#ccc', hatColor: '#8b7d6b', hatTilt: 0.25, stout: 1.1 }, brave: 0.4, schedule: [[6, 11, 'well2'], [11, 16, 'storePorch'], [16, 24, 'saloonStand2'], [0, 6, 'boardBedB']], talk: n => STORY.talkHank(n) }),
      town('abe', { name: 'Abe Tull', x: -50, z: 21, look: { skin: '#8d5a3c', shirt: '#c8443a', pants: '#3b3b5b', hair: '#1b1b1b', hatColor: '#d9c58f' }, brave: 0.6, tags: ['generic'], schedule: [[7, 12, 'street'], [12, 14, 'well'], [14, 19, 'streetE'], [19, 23, 'saloonSeatB'], [23, 7, 'boardBedA']] }),
      town('lou', { name: 'Lou Haskins', x: -30, z: 19, look: { skin: '#f0c4a0', shirt: '#9dbf8a', apron: '#d9c58f', hair: '#a0522d', longHair: true, hat: false }, brave: 0.25, tags: ['generic'], schedule: [[7, 11, 'well'], [11, 17, 'streetE'], [17, 21, 'street'], [21, 7, 'docBed']] }),
      town('eli', { name: 'Eli Calloway', x: -50, z: 8, look: { skin: '#f0c4a0', shirt: '#4a6a8a', pants: '#5a4a3a', hair: '#c97b3a', hatColor: '#4a6a8a', beard: '#b5763a' }, brave: 0.6, schedule: [[7, 12, 'storePorch'], [12, 18, 'well'], [18, 23, 'saloonSeatB'], [23, 7, 'boardBedB']], talk: n => STORY.talkEli(n), cond: () => S.chars.eli === 'home' }),
      { key: 'ezra', name: 'Ezra Greer', x: -135, z: 106, wild: true, region: 'farm', look: { skin: '#e2a57c', shirt: '#4f7ca8', pants: '#5a4a3a', hair: '#8b5a2b', beard: '#8b5a2b', hatColor: '#c9a46b' }, brave: 0.75, schedule: [[6, 12, 'field'], [12, 13, 'farmPorch'], [13, 19, 'field'], [19, 21, 'farmPorch'], [21, 6, 'farmBed']], talk: n => STORY.talkEzra(n), cond: () => S.locations.farm === 'occupied' && S.chars.ezra !== 'dead' },
      { key: 'nell', name: 'Nell Greer', x: -115, z: 95, wild: true, region: 'farm', look: { skin: '#f0c4a0', shirt: '#c97b5a', apron: '#f4ead3', hair: '#d9a441', longHair: true, hat: false }, brave: 0.5, schedule: [[6, 9, 'farmYard'], [9, 18, 'barnWork'], [18, 21, 'farmPorch'], [21, 6, 'farmBed2']], talk: n => STORY.talkNell(n), cond: () => S.locations.farm === 'occupied' && S.chars.nell !== 'dead' },
    ];
  },
  gang() {
    const g = (k, o) => Object.assign({ key: k, name: NPCNAMES[k] || o.name, lawful: false, group: 'crane', state: 'patrol', gun: 'revolver', hp: 90, maxHp: 90, tags: ['crane', 'story'], wild: true, accuracy: 0.4, cond: () => S.locations.mill === 'gang' && S.chars[k] !== 'dead' && S.chars[k] !== 'deserted' }, o);
    return [
      g('fenwick', { x: 136, z: -88, look: { skin: '#d9a07a', shirt: '#3b3b3b', coat: '#5a3a2a', hair: '#2b1d14', mustache: '#2b1d14', hatColor: '#1b1b1b', stout: 1.1 }, gun: 'rifle', hp: 140, maxHp: 140, accuracy: 0.5, dmg: 18, route: [{ x: 136, z: -88, wait: 12 }, { x: 134, z: -72, wait: 8 }] }),
      g('dutchy', { x: 118, z: -80, look: { skin: '#f0c4a0', shirt: '#b5a17a', hair: '#e2c06a', hatColor: '#8b7d6b', scale: 0.95 }, hp: 70, maxHp: 70, accuracy: 0.3, route: [{ x: 116, z: -78, wait: 5 }, { x: 116, z: -94, wait: 5 }], onPatrol: (dt, me) => STORY.dutchyWatch(dt, me) }),
      g('sal', { name: 'Sal', x: 133, z: -70, look: { skin: '#b07a55', shirt: '#7a3b3b', hair: '#1b1b1b', hatColor: '#4a3b30' }, route: [{ x: 133, z: -70, wait: 15 }, { x: 146, z: -78, wait: 6 }] }),
      g('jeb', { key: 'jeb', name: 'Jeb', x: 141, z: -72, look: { skin: '#e8b48c', shirt: '#4a6a4a', hair: '#6b4a2f', hatColor: '#3b2a1e', stout: 1.2 }, route: [{ x: 141, z: -72, wait: 10 }, { x: 152, z: -92, wait: 6 }, { x: 128, z: -95, wait: 6 }] }),
    ];
  },
  spawnWorldNPCs() {
    for (const c of this.roster().concat(this.gang())) { if (c.cond && !c.cond()) continue; if (NPC.byKey(c.key)) continue; if (S.chars[c.key] === 'dead' || S.chars[c.key] === 'jailed') continue; NPC.spawn(c); }
    if (S.flags.ida_helped && !NPC.byKey('ida')) NPC.spawn({ key: 'ida', name: 'Ida Fairweather', x: -36, z: 9, look: IDA_LOOK, brave: 0.4, schedule: [[0, 24, 'saloonSeatB']], talk: n => STORY.talkIda(n), tags: ['generic'] });
  },

  /* ---------- reactive small talk: what everyone knows about you ---------- */
  gossip(who) {
    const L = [];
    if (S.bounty > 0) L.push(`There's ${S.bounty > 20 ? 'serious ' : ''}paper on you at the sheriff's, $${S.bounty.toFixed(0)}.`);
    if (S.decisions.m1_box === 'skimmed') L.push(who === 'mae' ? null : 'Mae says her strongbox came back lighter than it left. Folks talk.');
    if (S.decisions.m1_box === 'returned') L.push('Heard you brought Mae\'s strongbox back whole. Not many would.');
    if (S.decisions.m3 === 'railroad') L.push('The Greers packed up and left. Folks say you helped the railroad run them off.');
    else if (S.missions.m3?.status === 'done') L.push('Ezra Greer\'s telling everybody you stood up for him.');
    if (S.chars.fenwick === 'dead') L.push('Fenwick Crane\'s dead, they say. His boys won\'t take that quiet.');
    if (S.chars.rook === 'jailed') L.push('Rook Malloy\'s cooling his heels in the cell. Nice work.');
    if (S.chars.pike === 'turned') L.push('They say Sheriff Pike sits up all night with a shotgun across his knees. Waiting on somebody.');
    if (S.chars.pike === 'left') L.push('Sheriff Pike rode out after some shooting at Willow Bridge. Deputy Bramble\'s wearing the star now.');
    if (S.flags.ida_helped) L.push('A traveler named Ida keeps telling folks you saved her bacon on the trail.');
    if (S.honor >= 40) L.push('You\'ve got a good name around here.'); if (S.honor <= -40) L.push('Folks lock their doors when you ride in.');
    return L.filter(Boolean);
  },
  smalltalk(n, lines) { const g = this.gossip(n.key); const all = lines.concat(g); return all.length ? pick(all) : 'Quiet day.'; },

  talkMae(n) {
    const m1 = Missions.st('m1'), m2 = Missions.st('m2'); const P = Game.player; const carryingBox = P.carry && P.carry.id === 'strongbox';
    const open = n.act === 'work' && S.time.hour >= 7 && S.time.hour < 20; const mood = Rep.mood('mae');
    const T = {
      start: { on: () => { if (!S.flags.met_mae) { S.flags.met_mae = true; if (Missions.active === 'intro') Missions.complete(); Missions.refresh(); } }, text: () => {
        if (m1.status === 'available') return 'Wren Calloway. Eli said you\'d come if his letters stopped. Three nights ago the Crane gang walked in here and took my strongbox. Eli\'s papers were in it. He trusted me with them.';
        if (m1.status === 'active' && carryingBox) return 'Is that... my strongbox? Set it down here, let me look.';
        if (m1.status === 'active') return 'The Cranes hole up at Coyote Mill, east across Willow Bridge. Please be careful.';
        if (m2.status === 'available') return mood === 'cold' || mood === 'hostile' ? 'You want to know about Eli now? After you helped yourself to my money?' : 'I\'ve been staring at that survey page all night. Eli marked Hollow Cabin, northwest of here. I have his last letter, too. It was never sent.';
        if (m2.status === 'active' && S.decisions.journal === 'mae' && !S.flags.m2_copied) return 'You brought it to me. Give me an hour with it and I\'ll copy every page that matters.';
        if (S.decisions.journal === 'pike') return 'You handed Eli\'s journal to Amos Pike. I hope you know what you did.';
        return STORY.smalltalk(n, mood === 'friend' ? ['Eli would\'ve liked having you back.', 'Coffee\'s on the house today. Don\'t tell anyone.'] : mood === 'cold' ? ['Buying something?', 'I keep a close count of my till these days.'] : ['What can I do for you?', 'Store\'s open till eight.']);
      },
      choices: [
        { text: 'I\'ll get your strongbox back.', hide: () => m1.status !== 'available', do: () => Missions.start('m1'), next: 'm1go' },
        { text: 'Not yet. I need to get my bearings.', hide: () => m1.status !== 'available', next: null },
        { text: 'Here. Every cent, just as they left it.', hide: () => !(m1.status === 'active' && carryingBox), do: () => STORY.deliverBox('returned'), next: 'returned' },
        { text: '"It was light when I found it." (Keep $30)', hide: () => !(m1.status === 'active' && carryingBox), do: () => STORY.deliverBox('skimmed'), next: 'skimmed' },
        { text: 'Tell me about the cabin.', hide: () => m2.status !== 'available', do: () => Missions.start('m2'), next: () => (Rep.mood('mae') === 'cold' || Rep.mood('mae') === 'hostile') ? 'm2cold' : 'm2warm' },
        { text: 'Here\'s Eli\'s journal. Copy what matters.', hide: () => !(m2.status === 'active' && S.decisions.journal === 'mae' && !S.flags.m2_copied), do: () => { S.flags.m2_copied = true; Inv.add('journal_copy'); Sky.advance(1); Rep.rel('mae', 8, 'grateful you trusted her'); }, next: 'copied' },
        { text: 'Give Eli\'s journal to you for safekeeping', hide: () => !(m2.status === 'active' && !S.decisions.journal && Inv.count('journal')), do: () => { S.decisions.journal = 'mae'; }, next: 'start' },
        { text: 'Let\'s trade.', hide: () => !open, do: () => UI.open('shop'), next: null },
        { text: 'Who is Silas Vane?', hide: () => !S.evidence.journal_read, next: 'vane' },
        { text: 'Has the sheriff been acting strange?', hide: () => !(S.chars.cora === 'dead' && Missions.st('ch4').status === 'available'), do: () => Missions.start('ch4'), next: 'ch4' },
        { text: 'Goodbye.', next: null },
      ] },
      m1go: { text: 'Coyote Mill, past the bridge. Fenwick Crane runs that bunch. His lookout is a jumpy kid named Dutchy. Bring back that box, Wren. The money matters less than the papers.', on: () => { S.flags.met_mae = true; } },
      returned: { text: 'All of it. Thank you. And here, this is what they were really after. A page of Eli\'s survey, in his own hand. Take it. Maybe it tells you where he went.' },
      skimmed: { text: '...Light. Of course it was. Take Eli\'s page, then. It\'s what you came for.' },
      m2warm: { text: 'Here\'s his letter. He wrote about "the blue cave above the cabin." If he left the cabin in a hurry, his tracks may still be there. Go soon, before the rain takes them.', on: () => { if (!Inv.count('letter')) Inv.add('letter'); S.flags.m2_trusted = true; } },
      m2cold: { text: 'I\'m not handing Eli\'s last letter to someone who skims a widow\'s till. Hollow Cabin. Find your own way.', on: () => { S.flags.m2_trusted = false; } },
      copied: { text: 'Done. Every name and every figure. If anything happens to that journal, we still have this. Silas Vane... I\'ve sold that man coffee.' },
      ch4: { text: 'Amos bought lamp oil and a flask of whiskey this afternoon and asked if I\'d be up past midnight. Somebody\'s meeting him tonight. Watch the jail after eleven.' },
      vane: { text: 'Land agent for the Halvorsen Railroad. Smiles too much. Buys homesteads cheap from folks who\'ve just had a run of terrible luck. I always thought it was luck.' },
    };
    return T;
  },
  deliverBox(how) {
    const P = Game.player; const box = P.carry; P.carry = null; if (box) Carry.remove(box);
    S.decisions.m1_box = how; S.flags.m1_delivered = true; S.evidence.survey_page = true; Inv.add('eli_page');
    if (how === 'returned') { Inv.money(15, 'Mae\'s thanks'); Rep.rel('mae', 25, 'trusts you'); Rep.honor(8, 'returned it all'); Rep.faction('town', 10); }
    else { Inv.money(30, 'skimmed'); Rep.rel('mae', -30, 'knows you skimmed'); Rep.honor(-10, 'lied to Mae'); Rep.faction('town', -10); }
    journal(how === 'returned' ? 'Gave Mae back her strongbox, all of it. Eli\'s survey page was inside.' : 'Took $30 out of Mae\'s box and called it light. She didn\'t believe me. Eli\'s survey page was inside.', 'decision');
  },
  talkPike(n) {
    const bm = Missions.st('bounty_rook'); const P = Game.player; const hasRook = P.carry && P.carry.npc && P.carry.npc.key === 'rook';
    return {
      start: { text: () => { if (hasRook) return 'Well, I\'ll be. Rook Malloy, trussed like a Sunday ham.'; if (S.wanted) return 'You\'ve got a nerve, talking to me with paper on you.'; if (S.chars.pike === 'turned') return 'I\'ll say it all to the marshal, Calloway. If Vane lets me live that long.'; if (S.decisions.ch4 === 'bought') return 'Vane says you\'re leaving by Sunday. Good.'; if (S.decisions.journal === 'pike') return 'That journal\'s safe with me, Miss Calloway. Safer than with you.'; if (S.decisions.journal && S.decisions.journal !== 'pike') return 'Withholding evidence from the law. I won\'t forget it.'; return STORY.smalltalk(n, ['Keep your iron holstered in my town.', 'Eli? Folks wander off. Doesn\'t always mean something.', 'The railroad\'s good for this valley, whatever folks say.']); },
        choices: [
          { text: 'Turn in Rook Malloy (alive)', hide: () => !hasRook, do: () => STORY.turnInRook(true), next: 'paid' },
          { text: 'Rook Malloy is dead. Here\'s his gun belt.', hide: () => !(bm.status === 'active' && S.flags.rook_proof && !hasRook), do: () => STORY.turnInRook(false), next: 'paid' },
          { text: 'Ask about Eli', next: 'eli' },
          { text: 'Pay off my bounty', hide: () => S.bounty <= 0, do: () => Law.payAtOffice(), next: null },
          { text: 'Goodbye', next: null },
        ] },
      eli: { text: () => S.evidence.journal_read ? 'Eli wrote some wild stories. Railroad men and outlaws. You ought to let that lie.' : 'Last I saw him he was riding northwest with his tripod. Man liked his own company.' },
      paid: { text: 'Bounty\'s paid. The valley\'s a little quieter for it.' },
    };
  },
  talkCora(n) { return { start: { text: () => STORY.smalltalk(n, S.chapter >= 2 ? ['Brock Harlan\'s been in, buying rounds and asking about the Greer place.', 'Sheriff Pike drinks alone lately. Pays with new bills.'] : ['First drink\'s fifty cents. Gossip costs extra.', 'Eli used to sit right there and write in that little book of his.']), choices: [{ text: 'Buy a drink ($0.50)', cond: () => S.money >= 0.5, do: () => { Inv.money(-0.5); S.p.stCore = Math.min(100, S.p.stCore + 20); Rep.rel('cora', 2); }, next: 'drink' }, { text: 'Anything about the sheriff?', hide: () => Missions.st('ch4').status !== 'available', do: () => Missions.start('ch4'), next: 'ch4' }, { text: 'Wait here with you until eleven', hide: () => !(CH4.stage() === 'night' && !CH4.inWindow()), do: () => CH4.waitForMidnight(), next: 'waited' }, { text: 'Heard anything about Eli? ($2)', cond: () => S.money >= 2, do: () => { Inv.money(-2); S.flags.cora_tip = true; }, next: 'tip' }, { text: 'Goodbye', next: null }] }, ch4: { text: 'Funny you ask. Amos had me fill his flask and asked for a cold supper at eleven. He never eats late. He\'s meeting somebody tonight, after midnight, and he didn\'t want me knowing who. Watch the jail.' }, waited: { text: 'Eleven. His lamp\'s still lit across the street. Go on.' }, drink: { text: 'There you go. On the house next time if you keep your boots off my tables.' }, tip: { text: 'He came in the night before he vanished, white as milk. Said "the sheriff\'s in on it" and asked me if I trusted Amos Pike. I said I trust nobody. He left at dawn.', on: () => { if (!S.evidence.cora_tip) { S.evidence.cora_tip = true; journal('Cora says Eli suspected Sheriff Pike before he disappeared.', 'evidence'); } } } }; },
  talkDoc(n) { return { start: { text: () => S.p.hp < S.p.maxHp * 0.7 ? 'You\'re bleeding on my floor. Sit.' : STORY.smalltalk(n, ['Eat something warm. You look peaky.', 'Stay out of the saloon brawls and we\'ll get along.']), choices: [{ text: 'Here\'s your medicine, Doc.', hide: () => !(Missions.active === 'stranger_doc' && Game.player.carry && Game.player.carry.id === 'medcrate'), do: () => SIDE.deliverMed(Game.player), next: 'med' }, { text: 'Need help with anything?', hide: () => Missions.st('stranger_doc').status !== 'available', do: () => Missions.start('stranger_doc'), next: 'docjob' }, { text: () => S.flags.doc_free ? 'Patch me up (free)' : 'Patch me up ($3)', cond: () => S.flags.doc_free || S.money >= 3, do: () => { if (!S.flags.doc_free) Inv.money(-3, 'doctor'); S.p.hp = S.p.maxHp; S.p.hpCore = 100; }, next: null }, { text: 'Buy a tonic ($6)', cond: () => S.money >= 6, do: () => { Inv.money(-6); Inv.add('tonic'); }, next: null }, { text: 'Goodbye', next: null }] }, docjob: { text: 'My supply wagon from Fort Harlan never arrived. The driver staggered in at dawn with a lump on his head. Laudanum, quinine, everything I need for the winter. It was on the cabin road, past the Hollow Cabin turnoff.' }, med: { text: 'Every bottle! Bless you, Wren. You\'ll never pay for a stitch in this office again.' } }; },
  talkHank(n) { const hm = Missions.st('stranger_hank'), back = Missions.active === 'stranger_hank' && hm.stage === 3;
    return { start: { text: () => back ? 'Well? WELL? Don\'t keep an old man waiting!' : hm.status === 'done' ? (S.decisions.hank === 'shared' ? 'Bought my mule a new hat. Well, I would if I had a mule.' : 'Empty, you said. Hm.') : STORY.smalltalk(n, ['Bluecap Cave! Glows at night. Spirits, or ore. Either way I ain\'t going in.', 'My mule says the railroad\'s gonna run right through Greer\'s corn. My mule\'s usually right.', 'Gold in them hills. Probably. Some.']), choices: [
      { text: 'Tell me about this gold of yours.', hide: () => hm.status !== 'available', do: () => Missions.start('stranger_hank'), next: 'strike' },
      { text: 'Here\'s your share. (Give him 2 gold)', hide: () => !back || Inv.count('gold') < 2, do: () => { Inv.take('gold', 2); S.decisions.hank = 'shared'; S.flags.hank_paid = true; Rep.rel('hank', 30, 'will never forget it'); Rep.honor(6, 'shared Hank\'s strike'); Inv.money(5, 'from Hank'); }, next: 'shared' },
      { text: '"The claim was empty, Hank."', hide: () => !back, do: () => { S.decisions.hank = 'kept'; S.flags.hank_paid = true; Rep.honor(-6, 'lied to Hank'); }, next: 'kept' },
      { text: 'Goodbye', next: null }] },
      strike: { text: 'Forty years I\'ve been looking, and I found it, Wren. Below Lookout Ridge, under a split rock. Then my back gave out. Here\'s the map. Dig it up and we split it down the middle. You\'ll want a shovel from Mae\'s.' },
      shared: { text: 'GOLD! Real gold! Forty years! Here, here, take this, and tell my mule. Oh. Right. No mule.' },
      kept: { text: '...Empty. Well. Figures. Thanks for looking, anyhow.' } }; },
  talkEzra(n) {
    const m3 = Missions.st('m3'), sp = Missions.st('side_pelts');
    return {
      start: { on: () => { if (!S.flags.met_ezra) { S.flags.met_ezra = true; Missions.refresh(); } }, text: () => { if (m3.status === 'available') return 'Calloway. Mae says you\'re Eli\'s sister. Railroad man named Brock Harlan rode by. Says we owe Halvorsen eighty dollars for "survey costs", or we sign. He\'s coming back at sundown and Nell went to the barn an hour ago and... she ain\'t come back.'; if (sp.status === 'active' && Inv.count('pelt_deer') >= 2 && Inv.count('pelt_rabbit') >= 1) return 'That\'s a fine stack of hides.'; if (S.decisions.m3 === 'railroad') return 'Get off my land.'; if (m3.status === 'done') return STORY.smalltalk(n, ['Bed\'s always made for you here, Wren.', 'Nell\'s baking. You\'re staying for supper.']); return STORY.smalltalk(n, ['Corn\'s late this year.', 'Railroad men keep surveying my fence line. I keep moving their stakes.']); },
        choices: [
          { text: 'I\'ll find Nell and deal with Harlan.', hide: () => m3.status !== 'available', do: () => Missions.start('m3'), next: 'm3go' },
          { text: 'Need any help around here?', hide: () => sp.status !== 'available', do: () => Missions.start('side_pelts'), next: 'pelts' },
          { text: 'Hand over the pelts', hide: () => !(sp.status === 'active' && Inv.count('pelt_deer') >= 2 && Inv.count('pelt_rabbit') >= 1), do: () => { Inv.take('pelt_deer', 2); Inv.take('pelt_rabbit', 1); S.flags.pelts_given = true; }, next: 'thanks' },
          { text: 'Tell him to sign the land over to the railroad', hide: () => !(S.decisions.m3 === 'railroad' && !S.flags.m3_told && m3.status === 'active'), do: () => { S.flags.m3_told = true; }, next: 'spit' },
          { text: 'Rest here tonight', hide: () => !(m3.status === 'done' && S.decisions.m3 !== 'railroad'), do: () => Camp.rest(true), next: null },
          { text: 'About that forty dollars…', hide: () => !(S.flags.greer_owes && S.time.day >= (S.flags.greer_owes_day || 0)), do: () => { Inv.money(S.flags.greer_owes, 'repaid by Ezra'); S.flags.greer_owes = 0; Rep.rel('ezra', 5); journal('Ezra paid back the forty dollars, every cent.'); }, next: 'repaid' },
          { text: 'Goodbye', next: null },
        ] },
      m3go: { text: () => S.flags.pelts_done ? 'Thank you. Listen: the one guarding the barn is Gil. He drinks. If he\'s at it, he\'ll be half asleep. And our deed\'s in the hope chest inside, if paper counts for anything.' : 'Thank you. Harlan\'s got two men with him. Be careful.' },
      pelts: { text: 'Winter\'s coming and we\'re short. Two deer hides and a rabbit pelt would see us through. Deer graze the meadows west of here at dawn and dusk.' },
      spit: { text: 'You... Eli\'s own sister. Get off my land. We\'ll be gone by morning, and I hope you choke on Vane\'s fifty dollars.' },
      repaid: { text: 'Every cent, like I said I would. The corn came in good. And Wren: the hay barn\'s yours if the law ever comes sniffing. Nobody searches a Greer barn.' },
      thanks: { text: 'You\'re a good shot. Here\'s for your trouble. And Wren, if you ever need anything, you come here first.' },
    };
  },
  talkEli(n) { return { start: { text: () => STORY.smalltalk(n, S.decisions.ending === 'law' ? ['They want me in Cheyenne for the trial. I\'ve never worn a tie.', 'Calder says my maps were the best evidence she\'d ever seen. Vane would hate that.'] : S.decisions.ending === 'cranes' ? ['Fenwick Crane bought me a drink yesterday. I didn\'t know what to say.', 'I keep thinking about Vane at that gate.'] : ['You came for me, Wren. Eight years, and you still came.', 'I\'m surveying the Greer line again. Properly, this time.']), choices: [{ text: 'Goodbye', next: null }] } }; },
  talkNell(n) { return { start: { text: () => S.flags.nell_hurt ? 'I\'m alright. Bruised. Ezra won\'t stop fussing.' : Missions.st('m3').status === 'done' ? 'Thank you, Wren. Truly.' : 'Ezra worries about the books. I worry about Ezra.', choices: [{ text: 'Goodbye', next: null }] } }; },
  talkIda(n) { return { start: { text: 'Wren! The woman who saved me on the east trail. Sit, I owe you a story. Saw the sheriff\'s horse tied outside the railroad survey tent two nights ago. Thought you\'d want to know.', on: () => { if (!S.evidence.ida_tip) { S.evidence.ida_tip = true; journal('Ida saw Sheriff Pike\'s horse at the railroad survey tent at night.', 'evidence'); } }, choices: [{ text: 'Thanks, Ida.', next: null }] } }; },
  posterRook() { return { start: { who: 'Wanted poster', text: 'WANTED: ROOK MALLOY. Crane gang. Horse theft, robbery. $40 ALIVE, $15 DEAD. Last seen camped by the Shallow Ford.', choices: [{ text: 'Take the bounty', do: () => Missions.start('bounty_rook'), next: null }, { text: 'Leave it', next: null }] } }; },
  turnInRook(alive) {
    const P = Game.player; if (alive && P.carry && P.carry.npc) { const r = P.carry.npc; P.carry = null; NPC.despawn(r); }
    S.decisions.rook = alive ? 'alive' : 'dead'; S.chars.rook = alive ? 'jailed' : 'dead'; S.flags.rook_done = true;
    Inv.money(alive ? 40 : 15, 'bounty reward'); Rep.rel('pike', alive ? 10 : 3); Rep.faction('crane', -15); Rep.honor(alive ? 5 : 1);
  },

  /* ---------- Dutchy, the lookout (M1 approach choices) ---------- */
  dutchyWatch(dt, me) {
    const m = Missions.st('m1'); if (m.status !== 'active' || m.c.alarm || m.c.dutchy || Dialog.open) return; const P = Game.player;
    if (me.seesPlayer && me.distP < 13 && !P.crouch) { m.c.dutchy = 1; me.face(P.pos); me.say('Hold it right there!'); Dialog.start(me, STORY.dutchyTree(me)); }
  },
  dutchyTree(me) {
    const m = Missions.st('m1');
    return {
      start: { text: 'This here\'s private property. Crane property. You lost, lady?', choices: [
        { text: 'Bribe him ($15)', cond: () => S.money >= 15, why: 'Need $15', do: () => { Inv.money(-15, 'to Dutchy'); S.decisions.m1_dutchy = 'bribed'; Rep.rel('dutchy', 25); STORY.distractGang(me); }, next: 'bribed' },
        { text: 'Threaten him (gun drawn)', cond: () => Game.player.weapon !== 'fists', why: 'Draw a gun first', do: () => { S.decisions.m1_dutchy = 'threatened'; Rep.rel('dutchy', -20); me.fled = true; me.state = 'scripted'; me.say('Don\'t shoot! I\'m gone!'); me.script = (dt, n) => { n.moveTo(170, -40, 5, dt); }; later(() => { const f = NPC.byKey('fenwick') || NPC.byKey('sal'); if (f && f.alive && !m.c.boxTaken) { f.say('Dutchy? What\'s he yelling about?'); f.alertGroup(Game.player.pos); } }, 7000); }, next: 'threat' },
        { text: '"Fenwick sent for me." (bluff)', cond: () => S.honor > -20, why: 'Your reputation precedes you', do: () => { S.decisions.m1_dutchy = 'bluffed'; Rep.rel('dutchy', -5); }, next: 'bluff' },
        { text: 'Back off', do: () => { m.c.dutchy = 0; m.c.dutchyWarned = (m.c.dutchyWarned || 0) + 1; if (m.c.dutchyWarned > 1) { me.say('I warned you!'); me.alertGroup(Game.player.pos); } }, next: null },
        { text: 'Attack', do: () => { S.decisions.m1_dutchy = 'fought'; me.alertGroup(Game.player.pos); }, next: null },
      ] },
      bribed: { text: '...Fifteen dollars is more than Fenwick pays me in a month. Box is in the mill. I\'ll call the boys down to the creek. You get a minute. Don\'t make me regret it.' },
      threat: { text: 'Okay! Okay! I ain\'t dying for Fenwick Crane!' },
      bluff: { text: 'Fenwick sent for... huh. He did say somebody was coming about the money. Go on, then. He\'s by the fire. Don\'t touch nothing.', on: () => { const f = NPC.byKey('fenwick'); if (f) f.sense = 0.4; me.sense = 0.2; m.c.bluffed = 1; } },
    };
  },
  distractGang(me) {
    for (const n of NPC.all) if (n.group === 'crane' && n.alive) { n.state = 'scripted'; n.distract = 70; n.script = (dt, x) => { x.moveTo(168 + rand(-2, 2), -52, 1.6, dt, 1.5); x.distract -= dt; if (x.distract <= 0) { x.state = 'patrol'; x.script = null; } }; }
    me.say('Boys! Fish are jumpin\' at the creek! Come look!'); journal('Paid Dutchy Moss $15 to lure the Crane gang to the creek. He said he wanted out.', 'decision');
  },
};
const IDA_LOOK = { skin: '#e8b48c', shirt: '#4a6a8a', hair: '#c97b3a', longHair: true, hatColor: '#d9c58f', scarf: '#9dbf8a' };

/* ===================== MISSIONS ===================== */
const MILL = { x: 135, z: -85 }, CAVE = { x: -55, z: -139.5 }, CABIN = { x: -150, z: -85 }, FARM = { x: -118, z: 94 };
const ELI_TRAIL = [[-150, -80], [-141, -88], [-131, -97], [-120, -106], [-108, -114], [-96, -120], [-84, -127], [-72, -132], [-62, -136], [-55, -139]];

Missions.def({ id: 'intro', type: 'main', chapter: 1, title: 'Homecoming', giver: 'none', summary: 'Ride into Juniper Gap and find Mae Holloway, the last person Eli wrote to.',
  stages: [
    { id: 'ride', text: 'Juniper Gap is west, past the creek.', enter: () => STORY.hint(Input.touch ? 'Tap the cream "Mount" bubble next to Biscuit, then push the stick. Tap Run to speed up.' : 'Press E next to Biscuit to mount. W to ride, hold Shift to canter, keep holding to gallop.'),
      objectives: [O.goto('town', 'Ride into Juniper Gap', -18, 19, 14), O.check('mounted', 'Optional: ride in on Biscuit', ctx => ctx.m.c.mounted, null, { optional: true })], on: { mount: (d, ctx) => { ctx.m.c.mounted = 1; } } },
    { id: 'town', text: 'Find Mae Holloway at the general store.', enter: () => STORY.hint(Input.touch ? 'Walk up to people and tap the prompt bubbles to greet or talk.' : 'Walk up to people: E talks, G greets, T antagonizes.'),
      objectives: [O.talk('mae', 'Find Mae Holloway at the general store', 'mae', 'met_mae'), O.check('greet', 'Optional: greet a townsperson', ctx => ctx.m.c.greeted, null, { optional: true }), O.check('care', 'Optional: feed or brush Biscuit', ctx => ctx.m.c.care, null, { optional: true })],
      on: { greet: (d, ctx) => { ctx.m.c.greeted = 1; }, horsecare: (d, ctx) => { ctx.m.c.care = 1; } } },
  ],
  complete: ctx => { ctx.m.outcome = 'Back in Juniper Gap after eight years'; if (ctx.m.c.greeted) Rep.faction('town', 3); STORY.hint(Input.touch ? 'The ☰ button opens your journal, map, satchel and save slots.' : 'Tab opens your satchel and journal. M opens the map. Esc pauses.'); },
});
Missions.def({ id: 'm1', type: 'main', chapter: 1, title: 'The Strongbox', giver: 'mae',
  prereq: () => !!S.flags.met_mae || Missions.st('intro').status === 'done', summary: 'The Crane gang stole Mae\'s strongbox, and Eli\'s papers were inside.',
  start: () => { const n = NPC.byKey('mae'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; },
  blocked: () => S.chars.mae === 'dead' ? 'Mae is dead. Her strongbox was never recovered.' : null,
  stages: [
    { id: 'ride', text: 'Ride east across Willow Bridge to Coyote Mill.', objectives: [O.goto('mill', 'Ride to Coyote Mill', MILL.x, MILL.z, 48), O.check('horse', 'Ride there on horseback', () => Game.player.state === 'ride' && Math.hypot(Game.player.pos.x - MILL.x, Game.player.pos.z - MILL.z) < 70, null, { optional: true })], enter: () => { S.locations.mill = 'gang'; World.apply(); } },
    { id: 'recover', text: 'Find the strongbox. Sneak in, talk your way past, or fight.', objectives: [O.check('box', 'Take the strongbox from the mill', ctx => ctx.m.c.boxTaken, () => ({ x: 138, z: -87, y: 4 })), O.check('unseen', 'Optional: take it without raising the alarm', ctx => ctx.m.c.boxTaken && !ctx.m.c.alarm, null, { optional: true })],
      enter: ctx => { if (!ctx.box) { const b = Carry.make('strongbox', 138, -87.5); b.mesh.position.y = Col.ground(138, -87.5, 5) + 0.2; ctx.box = b; b.onPick = () => { ctx.m.c.boxTaken = 1; }; } },
      on: { alarm: (d, ctx) => { if (d.group === 'crane') ctx.m.c.alarm = 1; } },
      next: ctx => ctx.m.c.alarm && NPC.all.some(n => n.group === 'crane' && n.alive && !n.downed && !n.fled) ? 'escape' : 'return' },
    { id: 'escape', text: 'The Cranes are on you. Lose them or put them down.', enter: () => STORY.ensureBox(), objectives: [O.check('lose', 'Lose the Crane gang or defeat them', () => NPC.all.filter(n => n.group === 'crane' && n.alive && !n.downed && !n.fled && n.state === 'combat').every(n => n.distP > 85))] },
    { id: 'return', text: 'Bring the strongbox back to Mae in Juniper Gap.', enter: () => STORY.ensureBox(), objectives: [O.check('deliver', 'Bring the strongbox to Mae (carry it in)', () => S.flags.m1_delivered, () => { const n = NPC.byKey('mae'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; })] },
  ],
  fail: [],
  complete: ctx => {
    const m = ctx.m; S.decisions.m1_approach = m.c.alarm ? 'loud' : S.decisions.m1_dutchy === 'bribed' ? 'bribe' : S.decisions.m1_dutchy === 'bluffed' ? 'bluff' : 'stealth';
    if (!m.c.alarm) { S.flags.crane_unaware = true; } else Rep.faction('crane', -30);
    if (S.decisions.m1_dutchy === 'bribed' || S.decisions.m1_dutchy === 'threatened') S.chars.dutchy = 'deserted';
    S.locations.mill = 'abandoned'; S.chapter = Math.max(S.chapter, 2);
    m.outcome = `${S.decisions.m1_box === 'returned' ? 'Returned every cent to Mae' : 'Skimmed $30 from Mae'} · approach: ${S.decisions.m1_approach}${S.chars.fenwick === 'dead' ? ' · Fenwick Crane killed' : ''}`;
    for (const n of NPC.all.slice()) if (n.group === 'crane') NPC.despawn(n);
  },
  cleanup: () => { for (const c of Carry.list.slice()) if (c.id === 'strongbox') Carry.remove(c); },
  failOutcome: () => 'The strongbox was lost.',
});
// Mission stage fail rules added after def (shared helper)
Missions.defs.m1.stages.forEach(s => s.fail = [{ check: () => S.chars.mae === 'dead', why: 'Mae Holloway is dead.' }]);

Missions.def({ id: 'm2', type: 'main', chapter: 2, title: 'Cold Trail', giver: 'mae', summary: 'Eli\'s survey page marks Hollow Cabin. Find out what happened there.',
  prereq: () => Missions.st('m1').status === 'done',
  blocked: () => S.chars.mae === 'dead' ? 'With Mae gone, nobody can read Eli\'s marks.' : null,
  start: () => { const n = NPC.byKey('mae'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; },
  stages: [
    { id: 'cabin', text: 'Search Hollow Cabin, northwest of town.', objectives: [
        O.goto('arrive', 'Ride to Hollow Cabin', CABIN.x, CABIN.z, 20),
        O.clues('clues', 'Examine the cabin for clues', ['stake', 'scuffle', 'table'], null),
        O.check('letter', 'Find Eli\'s unsent letter (Mae wouldn\'t share it)', () => !!S.evidence.letter_clue, () => ({ x: -151.5, z: -86.2, y: 5.5 }), { hide: () => S.flags.m2_trusted }),
      ], enter: () => STORY.cabinClues() },
    { id: 'track', text: 'Eli left on foot. Follow his boot prints.', objectives: [O.check('track', 'Follow Eli\'s tracks', () => Math.hypot(Game.player.pos.x - CAVE.x, Game.player.pos.z - CAVE.z) < 10, () => S.flags.m2_trusted || Inv.count('letter') ? { x: CAVE.x, z: CAVE.z, y: 6 } : null)], enter: () => STORY.layTrail() },
    { id: 'cave', text: 'Search Bluecap Cave.', objectives: [O.item('journal', 'Find Eli\'s journal', 'journal', 1, () => ({ x: -53, z: -151, y: 6 })), O.check('hat', 'Optional: find what else Eli left', () => S.evidence.eli_hat, () => ({ x: -57.5, z: -149, y: 6 }), { optional: true })], enter: () => STORY.caveItems() },
    { id: 'ambush', objectives: [], enter: ctx => STORY.ambush(ctx), update: (dt, ctx) => STORY.ambushUpdate(dt, ctx) },
    { id: 'decide', text: 'Head back to Juniper Gap with the journal.', objectives: [
        O.check('decide', 'Decide who gets Eli\'s journal', () => !!S.decisions.journal, () => ({ x: -40, z: 20 })),
        O.flag('copy', 'Bring the journal to Mae', 'm2_copied', () => { const n = NPC.byKey('mae'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; }, { hide: () => S.decisions.journal !== 'mae' }),
      ], update: (dt, ctx) => STORY.pikeIntercept(dt, ctx) },
  ],
  complete: ctx => {
    S.evidence.journal_read = true; S.chapter = Math.max(S.chapter, 3); Rep.faction('crane', -20);
    journal('Eli\'s journal: Silas Vane pays the Cranes to frighten settlers, then buys their land for the new line. Next on his list: the Greer homestead. "Someone at the jail takes Vane\'s money," Eli wrote. He didn\'t write who.', 'evidence');
    const j = S.decisions.journal; ctx.m.outcome = j === 'pike' ? 'Gave Eli\'s journal to Sheriff Pike' : j === 'mae' ? 'Mae copied the journal; you kept the original' : 'Kept Eli\'s journal yourself';
    if (ctx.m.c.dutchyHelped) ctx.m.outcome += ' · Dutchy led you past the ambush'; else if (ctx.m.c.fought) ctx.m.outcome += ' · fought off a Crane ambush';
  },
  cleanup: () => { for (const n of NPC.all.slice()) if (n.tags.includes('ambush') || n.key === 'dutchy') NPC.despawn(n); },
  failOutcome: () => 'Eli\'s trail went cold.',
});
Missions.defs.m2.stages.forEach(s => s.fail = [{ check: () => S.chars.mae === 'dead' && S.decisions.journal === 'mae', why: 'Mae Holloway is dead.' }]);

Missions.def({ id: 'm3', type: 'main', chapter: 3, title: "Greer's Stand", giver: 'ezra', summary: 'Eli\'s journal says the Greers are next. Railroad men have come to collect.',
  prereq: () => ['done', 'failed'].includes(Missions.st('m2').status),
  blocked: () => S.chars.ezra === 'dead' ? 'Ezra Greer is dead. There is no one left to stand.' : S.locations.farm !== 'occupied' ? 'The Greer farm is empty.' : null,
  start: () => { const n = NPC.byKey('ezra'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : { x: FARM.x, z: FARM.z }; },
  stages: [
    { id: 'standoff', text: 'Brock Harlan\'s men are in the yard. Nell is somewhere in the barn.', objectives: [
        O.flag('nell', 'Free Nell from the barn', 'm3_nell_free', () => ({ x: -106, z: 79.5, y: 4 })),
        O.talk('brock', 'Confront Brock Harlan', 'brock', 'm3_confronted'),
        O.item('deed', 'Optional: find the Greers\' deed in the farmhouse', 'deed', 1, () => ({ x: -122.5, z: 89.8, y: 5 }), { optional: true }),
      ], enter: ctx => STORY.m3Spawn(ctx), update: (dt, ctx) => STORY.m3Update(dt, ctx),
      next: () => S.decisions.m3 === 'fight' ? 'fight' : S.decisions.m3 === 'railroad' ? 'betray' : 'wrap' },
    { id: 'fight', text: 'Run Harlan\'s men off the Greer place.', objectives: [O.defeat('rail', 'Defeat or drive off the railroad men', 'rail'), O.flag('nell2', 'Make sure Nell is safe', 'm3_nell_free', () => ({ x: -106, z: 79.5, y: 4 }))], next: () => 'wrap' },
    { id: 'betray', text: 'You took Vane\'s money. Tell Ezra to sign.', objectives: [O.flag('tell', 'Tell Ezra to sign the land over', 'm3_told', () => { const n = NPC.byKey('ezra'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; })], next: () => 'complete' },
    { id: 'wrap', text: 'Check on the Greers.', objectives: [O.flag('ezra', 'Talk to Ezra', 'm3_wrapped', () => { const n = NPC.byKey('ezra'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; })], enter: () => { const e = NPC.byKey('ezra'); if (e) { e.state = 'routine'; e.talk = n => STORY.m3Wrap(n); } } },
  ],
  complete: ctx => STORY.m3Complete(ctx),
  cleanup: () => { for (const n of NPC.all.slice()) if (n.group === 'rail') NPC.despawn(n); const nl = NPC.byKey('nell'); if (nl) { nl.state = 'routine'; nl.talk = n => STORY.talkNell(n); } const e = NPC.byKey('ezra'); if (e) e.talk = n => STORY.talkEzra(n); },
  failOutcome: () => { S.locations.farm = 'abandoned'; S.chars.ezra = S.chars.ezra === 'dead' ? 'dead' : 'left'; S.chars.nell = S.chars.nell === 'dead' ? 'dead' : 'left'; return 'The Greers lost their land.'; },
});
Missions.defs.m3.stages.forEach(s => s.fail = [{ check: () => S.chars.ezra === 'dead' || S.chars.nell === 'dead', why: 'One of the Greers was killed.' }]);

Missions.def({ id: 'side_pelts', type: 'hunt', title: 'Pelts for Pa Greer', giver: 'ezra', summary: 'Ezra needs hides to see his family through the winter.',
  prereq: () => !!S.flags.met_ezra, blocked: () => S.locations.farm !== 'occupied' ? 'The Greers are gone.' : S.chars.ezra === 'dead' ? 'Ezra is dead.' : null,
  start: () => { const n = NPC.byKey('ezra'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; },
  stages: [{ id: 'hunt', text: 'Hunt two deer and a rabbit, then skin them.', objectives: [O.item('deer', 'Deer pelts', 'pelt_deer', 2), O.item('rab', 'Rabbit pelt', 'pelt_rabbit', 1), O.check('perfect', 'Optional: drop a deer with one rifle shot', ctx => ctx.m.c.perfect, null, { optional: true })], on: { skin: (d, ctx) => { if (d.sp === 'deer' && d.quality === 'perfect') ctx.m.c.perfect = 1; } } },
           { id: 'deliver', text: 'Bring the pelts to Ezra.', objectives: [O.flag('give', 'Give the pelts to Ezra', 'pelts_given', () => { const n = NPC.byKey('ezra'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; })] }],
  complete: ctx => { S.flags.pelts_done = true; Inv.money(15, 'from Ezra'); Rep.rel('ezra', 20, 'is in your debt'); Rep.faction('greer', 20); if (ctx.m.opt.perfect) { Inv.add('oats', 2); } ctx.m.outcome = 'The Greers will eat this winter' + (ctx.m.opt.perfect ? ' · Ezra noticed your clean shot' : ''); },
});

Missions.def({ id: 'bounty_rook', type: 'bounty', title: 'Wanted: Rook Malloy', giver: 'board', summary: 'A Crane gang horse thief is camped by the Shallow Ford. $40 alive, $15 dead.',
  prereq: () => Missions.st('m1').status === 'done', blocked: () => S.chars.rook !== 'alive' && !S.flags.rook_done ? 'Rook Malloy is no longer at large.' : null,
  start: () => ({ x: -25.5, z: 8.6, y: 5 }),
  stages: [
    { id: 'find', text: 'Find Rook\'s camp near the Shallow Ford.', objectives: [O.goto('camp', 'Find Rook\'s camp', riverX(-120) + 22, -128, 22)], enter: () => STORY.spawnRook() },
    { id: 'take', text: 'Bring him in. Knock him out and hogtie him for the full $40.', enter: ctx => { if (ctx.resumed) STORY.spawnRook(); }, objectives: [O.check('sub', 'Subdue Rook Malloy', () => { const r = NPC.byKey('rook'); return !r || !r.alive || r.hogtied; }, () => { const r = NPC.byKey('rook'); return r && r.alive ? { x: r.pos.x, z: r.pos.z, y: r.pos.y + 2.4, enemy: true } : null; })],
      on: { kill: (d, ctx) => { if (d.npc.key === 'rook') { d.npc.loot = () => { S.flags.rook_proof = true; UI.toast('Took Rook\'s gun belt as proof'); }; } } } },
    { id: 'deliver', text: 'Bring Rook (or proof) to Sheriff Pike.', enter: ctx => { if (ctx.resumed && !NPC.byKey('rook') && S.chars.rook === 'dead') S.flags.rook_proof = true; }, objectives: [O.flag('turn', () => NPC.byKey('rook') && NPC.byKey('rook').alive ? 'Carry Rook into the sheriff\'s office (your horse can haul him most of the way)' : 'Search Rook\'s body, then see the sheriff', 'rook_done', () => { const n = NPC.byKey('pike'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : { x: -22, z: 8 }; })] },
  ],
  complete: ctx => { ctx.m.outcome = S.decisions.rook === 'alive' ? 'Brought Rook Malloy in alive ($40)' : 'Brought proof of Rook\'s death ($15)'; },
  cleanup: () => { const r = NPC.byKey('rook'); if (r) NPC.despawn(r); },
  failOutcome: () => 'Rook Malloy got away.',
});
Missions.defs.bounty_rook.stages.forEach(s => s.fail = [{ check: () => S.chars.pike === 'dead' || S.chars.pike === 'left', why: 'There is no sheriff to pay the bounty.' }]);


/* ---------- Mission helpers ---------- */
Object.assign(STORY, {
  essential(n) { return n.key === 'mae' || (n.key === 'ezra' && !['done', 'failed'].includes(Missions.st('m3').status)); }, // story givers can be knocked down, never killed (like RDR2's essential characters)
  ensureBox() { const P = Game.player; if (S.flags.m1_delivered || S.horseCarry || (P.carry && P.carry.id === 'strongbox') || Carry.list.some(c => c.id === 'strongbox')) return; const f = fwd(P.yaw); Carry.make('strongbox', P.pos.x + f.x, P.pos.z + f.z); },
  cabinClues() {
    if (this._cab) return; this._cab = true;
    clue({ id: 'stake', label: 'survey stake', x: -145, z: -79, mesh: (() => { const g = new THREE.Group(); g.add(M(GEO.box, '#d9c58f', 0.08, 1.0, 0.08, 0, 0.5, 0)); g.add(M(GEO.box, '#c8443a', 0.3, 0.2, 0.02, 0.15, 0.9, 0)); return g; })(), note: 'A Halvorsen Railroad stake, driven straight through the Greers\' boundary line on Eli\'s map. Eli circled it twice.', when: () => Missions.active === 'm2' || S.evidence.stake });
    clue({ id: 'scuffle', label: 'spent cartridges', x: -155, z: -80.5, mesh: (() => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) g.add(M(GEO.cyl, '#c9a227', 0.03, 0.09, 0.03, rand(-.3, .3), 0.05, rand(-.3, .3))); return g; })(), note: 'Rifle cartridges and churned dirt. Three riders came in from the east. One set of boots ran north.', when: () => Missions.active === 'm2' || S.evidence.scuffle });
    clue({ id: 'table', label: 'overturned table', x: -149, z: -86, y: Col.ground(-149, -86, 9), note: 'Eli\'s tripod is snapped in two and his instruments are gone. Whoever came wanted his measurements, not his money.', when: () => Missions.active === 'm2' || S.evidence.table });
    clue({ id: 'letter_clue', label: 'loose floorboard', x: -151.5, z: -86.2, y: Col.ground(-151.5, -86.2, 9), give: 'letter', note: 'Under a loose board: Eli\'s unsent letter to Mae. "If I don\'t come back, the blue cave above the cabin. I hid the rest there."', when: () => Missions.active === 'm2' && !S.flags.m2_trusted });
  },
  layTrail() { if (this._trail) return; this._trail = []; for (let i = 0; i < ELI_TRAIL.length - 1; i++) { const [ax, az] = ELI_TRAIL[i], [bx, bz] = ELI_TRAIL[i + 1], d = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az); for (let s = 0; s < d; s += 2.0) { const x = lerp(ax, bx, s / d) + Math.sin(s * 0.7) * 0.6, z = lerp(az, bz, s / d); const side = (s / 2) % 2 ? 1 : -1; this._trail.push(FX.track(x + Math.cos(yaw) * 0.15 * side, z - Math.sin(yaw) * 0.15 * side, yaw, 'clue')); } } },
  caveItems() { if (this._cave) return; this._cave = true; pickup({ id: 'eli_journal', item: 'journal', x: -53, z: -151, y: Terrain.height(-55, -146) + 0.15, mesh: M(GEO.box, '#6b3e1f', 0.25, 0.06, 0.32), on: () => { journal('Found Eli\'s field journal in Bluecap Cave, wrapped in oilcloth.', 'evidence'); S.evidence.journal = true; }, when: () => Missions.active === 'm2' });
    clue({ id: 'eli_hat', label: 'Eli\'s hat', x: -57.5, z: -149, y: Terrain.height(-55, -146), mesh: M(GEO.cyl, '#4a6a8a', 0.3, 0.15, 0.3), my: 0.08, note: 'Eli\'s hat, with a Halvorsen camp ticket in the band: "Survey Camp 3, Tamarack Pass." He was taken there, or he went.', when: () => Missions.active === 'm2' }); },
  ambush(ctx) {
    const m = ctx.m; m.c.phase = 'wait';
    UI.toast('Riders on the trail below the cave…', 'bad');
    const dutchyAlly = S.decisions.m1_dutchy === 'bribed' && S.chars.dutchy !== 'dead';
    const lead = S.chars.fenwick === 'alive' ? 'fenwick' : 'sal'; const members = [lead, 'jeb']; if (S.chars.rook === 'alive' && !S.flags.rook_done) members.push('rook');
    const spot = [[-76, -118], [-80, -122], [-72, -114]];
    members.forEach((k, i) => { const look = k === 'fenwick' ? { skin: '#d9a07a', shirt: '#3b3b3b', coat: '#5a3a2a', hair: '#2b1d14', mustache: '#2b1d14', hatColor: '#1b1b1b', stout: 1.1 } : k === 'rook' ? { skin: '#e2a57c', shirt: '#5a2a2a', hair: '#1b1b1b', hatColor: '#2b2b2b', mustache: '#1b1b1b' } : { skin: '#e8b48c', shirt: '#4a6a4a', hair: '#6b4a2f', hatColor: '#3b2a1e', stout: 1.2 };
      if (NPC.byKey(k)) NPC.despawn(NPC.byKey(k)); const n = NPC.spawn({ key: k, name: NPCNAMES[k] || (k === 'jeb' ? 'Jeb' : 'Sal'), x: spot[i][0], z: spot[i][1], look, lawful: false, group: 'crane', state: 'patrol', gun: k === 'fenwick' ? 'rifle' : 'revolver', hp: k === 'fenwick' ? 140 : 90, maxHp: 140, tags: ['crane', 'ambush', 'story'], wild: true, accuracy: 0.42, fleeHp: k === 'fenwick' ? 0 : 25, route: [{ x: -62 + i * 2, z: -136, wait: 30 }] }); if (S.decisions.m1_dutchy === 'bribed' && S.chars.dutchy !== 'dead') n.sense = 0.45; });
    if (dutchyAlly) { const d = NPC.spawn({ key: 'dutchy', name: 'Dutchy Moss', x: -58, z: -134, look: { skin: '#f0c4a0', shirt: '#b5a17a', hair: '#e2c06a', hatColor: '#8b7d6b', scale: 0.95 }, lawful: false, state: 'scripted', wild: true, tags: ['story'] }); d.say('Psst! Calloway! They\'re coming for that book. Follow me, there\'s a goat path!', 5); m.c.phase = 'follow'; m.c.followT = 0; m.c.lost = 0;
      const path = [[-48, -134], [-38, -128], [-30, -116], [-28, -100], [-34, -84]]; d.ri = 0; d.script = (dt, me) => { const p = path[me.ri]; if (!p) { me.sp = 0; return; } const dP = me.distP || 0; if (dP > 9) { me.sp = 0; me.face(Game.player.pos); return; } if (me.moveTo(p[0], p[1], 2.6, dt, 1)) me.ri++; }; }
    else { m.c.phase = 'fight'; m.c.fought = 1; for (const n of NPC.all) if (n.tags.includes('ambush')) { n.fightPlayer(); } UI.toast(S.flags.crane_unaware ? 'They followed the journal\'s trail, not you. Too late now.' : '"That\'s her! Calloway!"', 'bad'); }
    ctx.d.stages[3].objectives = dutchyAlly ? [O.check('follow', 'Follow Dutchy down the goat path', c => c.m.c.followDone, () => { const d = NPC.byKey('dutchy'); return d ? { x: d.pos.x, z: d.pos.z, y: d.pos.y + 2.4 } : null; }), O.check('quiet', 'Optional: don\'t fire a shot', c => c.m.c.followDone && !c.m.c.shot, null, { optional: true })] : [O.defeat('amb', 'Survive the Crane ambush', 'ambush')];
    ctx.d.stages[3].on = { alarm: (d, c) => { if (c.m.c.phase === 'follow') { c.m.c.phase = 'fight'; c.m.c.fought = 1; c.d.stages[3].objectives = [O.defeat('amb', 'Survive the Crane ambush', 'ambush')]; } } };
  },
  ambushUpdate(dt, ctx) {
    const m = ctx.m; if (m.c.phase === 'follow') { const d = NPC.byKey('dutchy'); if (!d || !d.alive || d.downed || d.state !== 'scripted') { // no guide left: it's a fight now
      m.c.phase = 'fight'; m.c.fought = 1; ctx.d.stages[3].objectives = [O.defeat('amb', 'Survive the Crane ambush', 'ambush')]; for (const n of NPC.all) if (n.tags.includes('ambush') && n.alive && !n.downed) n.fightPlayer(); UI.toast('"There she is!" The Cranes have spotted you.', 'bad'); return; } if (Game.player.cool > 0.2 && Game.player.weapon !== 'fists') m.c.shot = 1;
      if (d.ri >= 5) { m.c.followDone = 1; m.c.dutchyHelped = 1; d.say('Go on. Tell Mae I\'m sorry about the box.', 5); Rep.rel('dutchy', 20); S.chars.dutchy = 'ally'; for (const n of NPC.all.slice()) if (n.tags.includes('ambush')) NPC.despawn(n); journal('Dutchy Moss led me down a goat path past the Crane ambush. He\'s done with the gang.', 'decision'); } }
  },
  pikeIntercept(dt, ctx) {
    const m = ctx.m; if (m.c.pikeMet || S.decisions.journal) return; const P = Game.player, pk = NPC.byKey('pike');
    if (!pk || !pk.alive || pk.downed) { return; }
    if (Math.hypot(P.pos.x + 40, P.pos.z - 20) < 55 && !Dialog.open) { if (pk.state !== 'scripted') { pk.state = 'scripted'; pk.say('Miss Calloway! A word.', 4); pk.script = (dt2, me) => { if (me.moveTo(P.pos.x, P.pos.z, 3.8, dt2, 2.6) && !Dialog.open && P.state !== 'ride') { m.c.pikeMet = 1; Dialog.start(me, STORY.pikeJournalTree(me)); } else if (P.state === 'ride' && me.distP < 4 && !Dialog.open) { me.say('Get off that horse and talk to me.', 3); } }; } }
  },
  pikeJournalTree(pk) {
    return {
      start: { text: 'Heard you found something of your brother\'s up at Bluecap. That\'s evidence in a missing-man case. Hand it here and I\'ll see it gets to the right people.', choices: [
        { text: 'Hand Eli\'s journal to Pike', do: () => { Inv.take('journal'); S.decisions.journal = 'pike'; S.evidence.journal_lost = true; Rep.rel('pike', 15); Rep.rel('mae', -20); Rep.faction('railroad', 10); journal('Gave Eli\'s journal to Sheriff Pike. He tucked it in his coat without opening it.', 'decision'); }, next: 'gave' },
        { text: '"It\'s going to Mae."', do: () => { S.decisions.journal = 'mae'; Rep.rel('pike', -12); journal('Told Pike the journal goes to Mae. He didn\'t like that.', 'decision'); }, next: 'mae' },
        { text: '"I\'ll hold on to it."', do: () => { S.decisions.journal = 'kept'; Rep.rel('pike', -8); journal('Kept Eli\'s journal for myself. Pike watched me a long time.', 'decision'); }, next: 'kept' },
        { text: 'Ask why he wants it so badly', next: 'why' },
      ] },
      why: { text: 'Because I\'m the law in this valley, and I\'m asking nicely. Don\'t make me stop asking nicely.', next: 'start' },
      gave: { text: 'Smart woman. Leave the rest to me.', on: () => { pk.state = 'routine'; } },
      mae: { text: 'Mae Holloway runs a store, not an investigation. Suit yourself.', on: () => { pk.state = 'routine'; } },
      kept: { text: 'Then you\'re responsible for what happens to it. And to you.', on: () => { pk.state = 'routine'; } },
    };
  },
  spawnRook() { if (NPC.byKey('rook') || S.chars.rook !== 'alive') return; const x = riverX(-120) + 22, z = -126; const r = NPC.spawn({ key: 'rook', name: 'Rook Malloy', x, z, look: { skin: '#e2a57c', shirt: '#5a2a2a', hair: '#1b1b1b', hatColor: '#2b2b2b', mustache: '#1b1b1b' }, lawful: false, group: 'rook', state: 'patrol', gun: 'revolver', hp: 70, maxHp: 70, tags: ['bounty', 'story'], wild: true, accuracy: 0.35, route: [{ x, z, wait: 20 }, { x: x - 6, z: z - 4, wait: 8 }] }); r.loot = () => { S.flags.rook_proof = true; UI.toast('Took Rook\'s gun belt as proof'); }; }, // proof however and wherever he falls
  m3Spawn(ctx) {
    if (ctx.m.c.spawned && NPC.byKey('brock')) return; ctx.m.c.spawned = 1;
    const thug = (k, nm, x, z, o) => { if (NPC.byKey(k)) NPC.despawn(NPC.byKey(k)); return NPC.spawn(Object.assign({ key: k, name: nm, x, z, lawful: false, group: 'rail', gun: 'revolver', hp: 90, maxHp: 90, tags: ['rail', 'story'], wild: true, fleeHp: 30, accuracy: 0.4, state: 'scripted', look: { skin: '#e8b48c', shirt: '#3b3b5b', vest: '#5a5a5a', hair: '#3b2a1e', hatColor: '#2b2b2b' } }, o)); };
    const brock = thug('brock', 'Brock Harlan', -114, 96, { look: { skin: '#d9a07a', shirt: '#e6dcc5', vest: '#3b3b3b', hair: '#5a3a20', mustache: '#5a3a20', hatColor: '#1b1b1b', stout: 1.25 }, hp: 130, maxHp: 130, fleeHp: 45 });
    brock.talk = n => STORY.brockTree(n); brock.script = (dt, me) => { me.sp = 0; if (me.distP < 30) me.face(Game.player.pos); if (me.distP < 9 && !S.flags.m3_confronted && !Dialog.open && Game.player.state !== 'ride') Dialog.start(me, STORY.brockTree(me)); };
    const hoyt = thug('hoyt', 'Hoyt', -111, 98, {}); hoyt.script = (dt, me) => { me.sp = 0; me.face(Game.player.pos); };
    const sleepy = !!S.flags.pelts_done; const gil = thug('gil', 'Gil', -104, 80.5, { hp: 30, maxHp: 30, fleeHp: 0, state: sleepy ? 'scripted' : 'patrol', sense: sleepy ? 0.25 : 0.9, route: [{ x: -104, z: 80.5, wait: 8 }, { x: -108, z: 84, wait: 6 }] }); gil.sleepy = sleepy; if (sleepy) { gil.script = (dt, me) => { me.sp = 0; me.say_t = 0; me.anim.expr = 'calm'; }; }
    const nell = NPC.byKey('nell'); if (nell) { nell.pos.set(-108, Col.ground(-108, 79.6, 9), 79.6); nell.state = 'tied'; nell.yaw = 0; nell.talk = null; nell.opts = p => nell.state === 'tied' ? [{ label: 'Untie Nell', fn: () => STORY.freeNell(p, nell) }] : Person.prototype.opts.call(nell, p); }
    const ez = NPC.byKey('ezra'); if (ez) { ez.state = 'scripted'; ez.script = (dt, me) => { me.moveTo(-126, 93, 1.4, dt); me.face(Game.player.pos); }; }
  },
  freeNell(p, nell) { p.anim.play('kneel', { loop: true }); later(() => { p.anim.stop('kneel'); nell.state = 'scripted'; nell.script = (dt, me) => me.moveTo(-126, 92, 4, dt); nell.say('Thank God. Ezra!', 3); S.flags.m3_nell_free = true; Rep.rel('ezra', 10); Rep.faction('greer', 10); journal('Untied Nell Greer in the barn.', 'decision'); }, 1500); },
  m3Update(dt, ctx) {
    const gil = NPC.byKey('gil'), nell = NPC.byKey('nell');
    if (S.flags.m3_confronted && !S.flags.m3_nell_free && S.decisions.m3 === 'fight' && !ctx.m.c.nellHurtChk) { ctx.m.c.nellHurtChk = 1; if (gil && gil.alive && !gil.downed) { S.flags.nell_hurt = true; journal('Gil struck Nell when the shooting started. She\'ll heal, but Ezra won\'t forget I went in shooting first.', 'decision'); UI.toast('Gil struck Nell!', 'bad'); } }
    if (ctx.m.c.alarmed && !S.decisions.m3 && !Dialog.open) { S.decisions.m3 = 'fight'; S.flags.m3_confronted = true; }
  },
  brockTree(me) {
    const nellFree = () => !!S.flags.m3_nell_free;
    const peaceful = (how) => { S.decisions.m3 = how; S.flags.m3_confronted = true; for (const n of NPC.all) if (n.group === 'rail' && n.alive && !n.downed) { n.state = 'scripted'; n.fled = true; n.script = (dt, x) => x.moveTo(40, 70, 3.2, dt); } later(() => { for (const n of NPC.all.slice()) if (n.group === 'rail') NPC.despawn(n); }, 25000); if (!nellFree()) { S.flags.m3_nell_free = true; const nl = NPC.byKey('nell'); if (nl) { nl.state = 'scripted'; nl.script = (dt, x) => x.moveTo(-126, 92, 3, dt); } } };
    return {
      start: { text: () => nellFree() ? 'You the Calloway woman? Funny. Mrs. Greer just walked out of that barn on her own. Mr. Vane\'s got a note here says this family owes eighty dollars.' : 'Calloway. Thought you\'d turn up. Mrs. Greer\'s resting in the barn with my associate. Nobody needs to get hurt. This family owes Halvorsen eighty dollars or a signature.', on: () => { S.flags.m3_confronted_seen = true; }, choices: [
        { text: 'Show him Eli\'s journal: "A marshal will want to read this."', cond: () => Inv.count('journal') || Inv.count('journal_copy'), why: 'You don\'t have Eli\'s journal or a copy', do: () => { peaceful('evidence'); Rep.faction('railroad', -30); S.flags.vane_warned = true; }, next: 'ev' },
        { text: 'Show him the Greers\' deed.', cond: () => Inv.count('deed'), why: 'You haven\'t found the deed', do: () => { peaceful('deed'); Rep.faction('railroad', -10); }, next: 'deed' },
        { text: 'Pay the "debt" yourself ($40, he\'ll take half)', cond: () => S.money >= 40, why: 'Need $40', do: () => { Inv.money(-40, 'to Harlan'); peaceful('paid'); Rep.faction('railroad', 5); }, next: 'paid' },
        { text: '"What\'s it worth to you if they sign?"', next: 'offer' },
        { text: '"Get off their land."', do: () => { S.decisions.m3 = 'fight'; S.flags.m3_confronted = true; for (const n of NPC.all) if (n.group === 'rail' && n.alive) { n.fightPlayer(); } }, next: null },
      ] },
      ev: { text: '...Where did you get that? Fine. FINE. But Mr. Vane is going to hear your name tonight, Calloway. Boys, we\'re leaving.' },
      deed: { text: 'Bought free and clear in \'61. Huh. Well. The railroad has lawyers too. This isn\'t over.' },
      paid: { text: 'Pleasure doing business. Tell Ezra the account\'s settled. For now.' },
      offer: { text: 'Mr. Vane pays fifty dollars to whoever gets that signature. Talk sense into Ezra and it\'s yours.', choices: [
        { text: 'Take Vane\'s money (betray the Greers)', do: () => { S.decisions.m3 = 'railroad'; S.flags.m3_confronted = true; Inv.money(50, 'from Brock Harlan'); Rep.honor(-20, 'sold out the Greers'); Rep.faction('railroad', 30); Rep.faction('greer', -100); Rep.rel('ezra', -60); Rep.rel('mae', -25); journal('Took fifty dollars of Vane\'s money to get the Greers to sign.', 'decision'); for (const n of NPC.all) if (n.group === 'rail') { n.state = 'scripted'; n.script = (dt, x) => { x.sp = 0; }; } if (!nellFree()) { S.flags.m3_nell_free = true; const nl = NPC.byKey('nell'); if (nl) { nl.state = 'scripted'; nl.script = (dt, x) => x.moveTo(-126, 92, 3, dt); } } }, next: 'deal' },
        { text: 'Refuse', next: 'start' },
      ] },
      deal: { text: 'Knew you were a sensible woman. Go tell him.' },
    };
  },
  m3Wrap(n) { return { start: { text: () => { const d = S.decisions.m3; if (d === 'evidence') return 'Harlan went white as a sheet. What was in that book, Wren?'; if (d === 'deed') return 'My father\'s deed. I forgot it was even in there.'; if (d === 'paid') return 'You paid them? Wren, we\'ll pay you back. Every cent. I swear it.'; return S.flags.nell_hurt ? 'They\'re gone. Nell\'s hurt, but she\'s alive. You went in shooting, Wren. With her in there.' : 'They ran like rabbits. Nell\'s safe. I don\'t know how to thank you.'; }, choices: [{ text: 'You\'re safe now.', do: () => { S.flags.m3_wrapped = true; }, next: null }] } }; },
  m3Complete(ctx) {
    const d = S.decisions.m3, m = ctx.m;
    if (d === 'railroad') { S.flags.m3_told = true; S.locations.farm = 'abandoned'; S.chars.ezra = 'left'; S.chars.nell = 'left'; m.outcome = 'Sold out the Greers for $50. The farm is empty.'; journal('Ezra spat at my feet. By morning the Greers were gone. Their land belongs to the railroad now.', 'fate'); }
    else {
      Rep.rel('ezra', S.flags.nell_hurt ? 10 : 30, 'grateful'); Rep.faction('greer', 40); Rep.honor(S.flags.nell_hurt ? 3 : 10); S.flags.greer_safehouse = true;
      if (!S.weapons.rifle && !S.flags.nell_hurt) { S.weapons.rifle = 1; Inv.add('ammo_rifle', 10); UI.toast('Ezra gave you his bolt rifle', 'good'); } else Inv.money(S.flags.nell_hurt ? 5 : 20, 'from the Greers');
      if (d === 'paid') { S.flags.greer_owes = 40; S.flags.greer_owes_day = S.time.day + 2; } // Ezra pays it back once the harvest is in
      m.outcome = { evidence: 'Faced Harlan down with Eli\'s journal. Vane knows your name now.', deed: 'Proved the Greers own their land.', paid: 'Paid off Harlan. The Greers owe you $40.', fight: S.flags.nell_hurt ? 'Drove the railroad men off, but Nell was hurt.' : 'Drove the railroad men off. Nell is safe.' }[d] || 'The Greers kept their land.';
      if (ctx.m.opt.deed) m.outcome += ' · found the deed';
    }
    S.chapter = 4; for (const n of NPC.all.slice()) if (n.group === 'rail') NPC.despawn(n);
    const nl = NPC.byKey('nell'); if (nl) { nl.state = 'routine'; nl.talk = x => STORY.talkNell(x); nl.opts = Person.prototype.opts; } const e = NPC.byKey('ezra'); if (e) e.talk = x => STORY.talkEzra(x);
    if (S.locations.farm !== 'occupied') { for (const k of ['ezra', 'nell']) { const p = NPC.byKey(k); if (p) NPC.despawn(p); } }
  },
});
// Freeing Nell / alarms during M3: treat any rail alarm as the fight starting
Missions.defs.m3.stages[0].on = { alarm: (d, ctx) => { if (d.group === 'rail') ctx.m.c.alarmed = 1; } };
// Deed lives in the farmhouse hope chest during M3


/* ---------- Random & story-triggered encounters ---------- */
const Encounters = {
  t: 20, active: null,
  update(dt) {
    this.t -= dt; const P = Game.player; if (this.t > 0 || Missions.active || S.wanted) return; this.t = 25;
    const r = Math.random();
    const inTown = Math.hypot(P.pos.x + 40, P.pos.z - 20) < 45;
    if (inTown) { if (S.flags.brawlDay !== S.time.day && S.time.hour > 10 && S.time.hour < 19 && r < 0.3) return this.brawl(); return; }
    if (trailDist(P.pos.x, P.pos.z) < 12 && r < 0.7 && SIDE.encounter(r)) return;
    if (trailDist(P.pos.x, P.pos.z) < 12 && Town.roadEvent(Math.random())) return;
    if (trailDist(P.pos.x, P.pos.z) > 10 && S.flags.snareDay !== S.time.day && r < 0.3) return this.snare();
    if (!S.flags.ida_met && r < 0.35) return this.ida();
    if (S.chapter >= 3 && S.factions.crane < -40 && S.chars.fenwick !== 'dead' && S.flags.lastAmbushDay !== S.time.day && r < 0.25) return this.craneAmbush();
  },
  snare() { // a deer caught in a poacher's snare: free it, or put it down for the hide
    S.flags.snareDay = S.time.day; const s = this.spot(22); const deer = Animal.spawn('deer', s.x, s.z); deer.state = 'snared'; deer.scare = () => {}; deer.cfg = Object.assign({}, deer.cfg, { sense: 0 });
    const stake = M(GEO.box, '#6b4a2f', 0.08, 0.6, 0.08, s.x + 0.6, Terrain.height(s.x, s.z) + 0.3, s.z); Game.scene.add(stake); UI.toast('You hear a deer thrashing in the brush', '');
    const it = Interact.add({ pos: () => deer.pos, r: 2.2, pri: 0.8, opts: p => !deer.alive || deer.freed ? [] : [{ label: 'Free the deer from the snare', fn: () => { p.anim.play('kneel', { loop: true }); later(() => { p.anim.stop('kneel'); deer.freed = true; deer.state = 'flee'; deer.fleeFrom = { x: p.pos.x, z: p.pos.z }; deer.fleeT = 10; deer.scare = Beast.prototype.scare; Rep.honor(3, 'freed a snared deer'); journal('Cut a deer loose from a poacher\'s snare.'); Game.scene.remove(stake); Interact.remove(it); Missions.emit('snare', { freed: true }); }, 1400); } }] });
    this.lastSnare = deer; const orig = deer.update.bind(deer); deer.update = (dt, far) => { if (deer.state === 'snared' && deer.alive && !deer.freed) { deer.speed = 0; deer.rear = Math.sin(Game.time * 6) > 0.6 ? 0.5 : 0; deer.anim.update(dt, { speed: 0, alert: true, rear: deer.rear }); deer.rig.root.position.copy(deer.pos); return; } orig(dt, far); };
  },
  brawl() { // two men squaring off outside the saloon; step in, place a bet, or let the deputy sort it
    S.flags.brawlDay = S.time.day; const abe = NPC.byKey('abe'); if (!abe || !abe.alive) return;
    const cy = NPC.spawn({ key: 'cyrus', name: 'Cyrus Webb', x: -38, z: 15, look: { skin: '#e2a57c', shirt: '#8a3b3b', hair: '#3b2a1e', hatColor: '#5a4a3a', beard: '#3b2a1e', stout: 1.15 }, brave: 0.8, state: 'scripted', tags: ['generic'], wild: true });
    abe.state = 'scripted'; abe.pos.set(-41, abe.pos.y, 15); const face = (a, b) => { a.yaw = Math.atan2(b.pos.x - a.pos.x, b.pos.z - a.pos.z); };
    let t = 0, phase = 'argue'; const end = (msg) => { phase = 'done'; cy.say(msg || 'Fine. FINE.', 3); abe.state = 'routine'; abe.goal = null; cy.state = 'scripted'; cy.script = (dt, me) => me.moveTo(10, 20, 1.6, dt); later(() => NPC.all.includes(cy) && NPC.despawn(cy), 40000); };
    const lines = [[abe, 'You marked that deck, Webb!'], [cy, 'Say that again, Tull.'], [abe, 'I\'ll say it louder!'], [cy, 'Then step into the street.']]; let li = 0;
    const scr = (dt, me) => { if (phase === 'done') return; me.sp = 0; face(abe, cy); face(cy, abe); t += dt / 2; if (phase === 'argue') { if (t > 2.5 * (li + 1) && li < lines.length) { lines[li][0].say(lines[li][1], 3); lines[li][0].anim.play('taunt'); li++; } if (t > 13) { phase = 'fight'; } } else if (phase === 'fight') { if (Math.random() < dt) { const [a, b] = Math.random() < 0.5 ? [abe, cy] : [cy, abe]; a.anim.play(pick(['punch', 'hook'])); later(() => { b.anim.play('hit'); Sfx.punch(); }, 180); } if (t > 26) { const dep = NPC.byKey('lyle'); if (dep) dep.say('Break it up, you two!', 3); end('Alright, alright, Deputy.'); } } };
    abe.script = scr; cy.script = scr; UI.toast('Shouting outside the Pine Knot', '');
    cy.talk = () => phase === 'done' ? null : { start: { text: 'Stay out of this, stranger. This is between me and Tull.', choices: [
      { text: 'Break it up. Nobody needs a black eye today.', do: () => { Rep.rel('lyle', 0); Rep.honor(2, 'kept the peace'); Rep.faction('town', 3); S.npcMem.abe = Object.assign(S.npcMem.abe || {}, { helped: true }); end('...Not worth it.'); abe.say('Thanks, Miss Calloway.', 3); }, next: null },
      { text: 'Two dollars says Tull knocks you flat. (Bet $2)', cond: () => S.money >= 2, do: () => { Inv.money(-2, 'bet'); phase = 'fight'; t = 13; later(() => { const win = Math.random() < 0.55; if (win) { Inv.money(4, 'won the bet'); abe.say('Ha!', 2); } else { cy.say('Pay up!', 2); } end(); }, 9000); }, next: null },
      { text: 'Carry on.', next: null } ] } };
  },
  spot(dist) { const P = Game.player, f = fwd(P.yaw); const x = P.pos.x + f.x * dist, z = P.pos.z + f.z * dist; return { x, z }; },
  ida() { S.flags.ida_met = true; const s = this.spot(30); const cart = new THREE.Group(); cart.position.set(s.x + 2, Terrain.height(s.x + 2, s.z), s.z); cart.add(M(GEO.box, '#7a5232', 1.6, 0.7, 2.6, 0, 0.6, 0)); const w = M(GEO.cyl, '#4b3a2a', 0.5, 0.1, 0.5, 0.9, 0.3, 1); w.rotation.z = 1.2; cart.add(w); Game.scene.add(cart);
    const ida = NPC.spawn({ key: 'ida', name: 'Ida Fairweather', x: s.x, z: s.z, look: IDA_LOOK, brave: 0.4, wild: true, state: 'scripted', tags: ['generic'], talk: n => this.idaTree(n, cart) }); ida.script = (dt, me) => { me.sp = 0; if (me.distP < 25) { me.face(Game.player.pos); if (!me._called) { me._called = 1; me.say('Hello? Please! My wheel\'s busted!', 4); } } };
    UI.toast('Someone is calling for help nearby', ''); },
  idaTree(n, cart) {
    const done = (helped) => { S.flags.ida_helped = helped; n.state = 'scripted'; n.script = (dt, me) => me.moveTo(-40, 20, 1.8, dt); later(() => { NPC.despawn(n); Game.scene.remove(cart); if (helped) World.apply(); }, 30000); };
    return { start: { text: 'Bless you for stopping. Ida Fairweather. My cart threw a wheel and I haven\'t eaten since yesterday. I\'m headed for Juniper Gap.', choices: [
      { text: 'Give her canned beans', cond: () => Inv.count('beans'), why: 'No beans', do: () => { Inv.take('beans'); Rep.honor(4, 'helped a stranger'); done(true); }, next: 'thanks' },
      { text: 'Give her a sage tonic', cond: () => Inv.count('tonic'), why: 'No tonic', do: () => { Inv.take('tonic'); Rep.honor(5, 'helped a stranger'); Inv.money(5, 'from Ida'); done(true); }, next: 'thanks' },
      { text: 'Fix the wheel (takes an hour)', do: () => { Sky.advance(1); Rep.honor(5, 'helped a stranger'); done(true); }, next: 'thanks' },
      { text: '"Can\'t help you."', do: () => done(false), next: 'bye' },
    ] }, thanks: { text: 'I won\'t forget this. If you\'re ever in the saloon, the first drink is mine. And I keep my eyes open.' }, bye: { text: 'I... see. Well. Good day.' } };
  },
  craneAmbush() { S.flags.lastAmbushDay = S.time.day; const P = Game.player; UI.toast('"There\'s Calloway!" Crane riders!', 'bad');
    for (let i = 0; i < 2; i++) { const a = P.yaw + (i ? 0.6 : -0.6), x = P.pos.x + Math.sin(a) * 32, z = P.pos.z + Math.cos(a) * 32; const n = Riders.spawnRider({ key: 'crane_amb' + i, name: 'Crane gunman', look: { skin: '#e8b48c', shirt: '#5a3a2a', hair: '#3b2a1e', hatColor: '#1b1b1b' }, lawful: false, group: 'crane_r', gun: 'revolver', hp: 80, maxHp: 80, tags: ['generic', 'random'], fleeHp: 20, accuracy: 0.35 }, 'chase', x, z, a + Math.PI); n.hostileToPlayer = true; n.anim.expr = 'angry'; /* they ride in */ later(() => { if (NPC.all.includes(n)) NPC.despawn(n); }, 180000); } },
};
