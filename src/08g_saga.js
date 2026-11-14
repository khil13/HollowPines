/* ===== The new story: "The Last Good Country" (an outlaw saga in the vein of Red Dead Redemption 2) =====
   Wren Calloway rides with the Marlowe outfit. Eleven days ago they hit the Halvorsen payroll train at Bitter Creek and
   it went wrong: two of them dead on the tracks, the money left behind, and Wren's brother Eli carried out with a bullet
   in him. What is left of the outfit is hiding at Hollow Cabin, broke, hungry and hunted. Over six chapters the jobs get
   bigger and Josiah Marlowe gets harder to follow, and Wren has to decide what she owes a family that is coming apart.
   New games start this story (S.story === 'saga'); the original land-grab story stays in the game as the classic story.
   Playable so far: Chapters 1 to 3. Chapters 4 to 6 are outlined in SAGA.CHAPTERS and will be built on this file. */
const SAGA = {
  on() { return S.story === 'saga'; },
  CAMP: { x: -146.5, z: -76.5 }, BED: { x: -151.6, z: -83.7 },
  CAST: {
    wren: { name: 'Wren Calloway', role: 'Protagonist' },
    marlowe: { name: 'Josiah Marlowe', role: 'Leader of the outfit', bio: 'A failed preacher with a voice that makes bad ideas sound like scripture. Took Wren and Eli in when they had nothing. Bitter Creek was his plan.' },
    tess: { name: 'Tess Arden', role: 'Sharpshooter · friend', bio: 'Rode with circus trick-shooters before she rode with Marlowe. Says what she thinks, which is rarer here than it should be.' },
    bill: { name: 'Old Bill Yancey', role: 'Cook, teamster, conscience', bio: 'The oldest of them by twenty years. Drove freight until the railroad took the freight. Keeps the outfit fed and mostly honest.' },
    cole: { name: 'Cole Riker', role: 'Gun hand', bio: 'Fast, vain and tired of being poor. He counted the Bitter Creek money before they had it.' },
    eli: { name: 'Eli Calloway', role: 'Wren\'s brother', bio: 'Nineteen. Held the horses at Bitter Creek and took a bullet meant for nobody in particular.' },
    doc: { name: 'Doc Pell', role: 'Town doctor', bio: 'Patches up anyone who pays and most who can\'t. Asks fewer questions than he should.' },
    pike: { name: 'Sheriff Amos Pike', role: 'The law in Juniper Gap', bio: 'Twenty years wearing the star. Has a telegram on his desk about a train at Bitter Creek.' },
    fenwick: { name: 'Fenwick Crane', role: 'Rival gang boss', bio: 'Runs whiskey and hired muscle out of Coyote Mill. Does not share a valley gladly.' },
  },
  CHAPTERS: [
    { n: 1, title: 'Ashes', playable: true, text: 'Eleven days after Bitter Creek. Eli is gut-shot, the camp is starving, and nobody has said out loud that the job was a mistake.' },
    { n: 2, title: 'Honest Work', playable: true, text: 'Marlowe wants a stake. The Crane gang\'s whiskey money sits at Coyote Mill, and Fenwick Crane does not know the outfit is in his valley yet.' },
    { n: 3, title: 'The Halvorsen Payroll', playable: true, text: 'The same railroad, the same money, a second try: the payroll comes through Tamarack Pass. Scout it, plan it, and choose how loud it gets.' },
    { n: 4, title: 'Thicker Than Water', playable: false, text: 'A railroad detective reaches Juniper Gap with a list of names. Somebody in camp has been talking to her.' },
    { n: 5, title: 'Preacher\'s War', playable: false, text: 'Marlowe means to burn his way out of the valley, starting with the town. Wren can ride with him or ride ahead of him.' },
    { n: 6, title: 'The Last Good Country', playable: false, text: 'What is left, who is left, and where they go. The ending follows Wren\'s honor and the choices made on the way.' },
  ],
  LOOKS: {
    marlowe: { skin: '#d9a07a', shirt: '#2b2b2b', coat: '#3a3a44', hair: '#4a4a4a', beard: '#5a5a5a', hatColor: '#1b1b1b', stout: 1.05 },
    tess: { skin: '#e8b48c', shirt: '#8a3b3b', vest: '#3b2a1e', hair: '#2b1d14', longHair: true, hatColor: '#6b4a2f', scarf: '#e9c46a', scale: 0.97 },
    bill: { skin: '#c98a62', shirt: '#8a7a5a', apron: '#d9c58f', hair: '#ddd', beard: '#eee', hatColor: '#8b7d6b', hatTilt: 0.2, stout: 1.15 },
    cole: { skin: '#f0c4a0', shirt: '#3c5a6e', vest: '#1b1b1b', hair: '#c9a227', mustache: '#c9a227', hatColor: '#2b2b2b', scarf: '#c8443a' },
    eli: { skin: '#f0c4a0', shirt: '#e6dcc5', pants: '#5a4a3a', hair: '#c97b3a', hat: false, scale: 0.96 },
  },
  roster() {
    const g = (k, o) => Object.assign({ key: k, name: this.CAST[k].name, wild: true, region: 'camp', look: this.LOOKS[k], tags: ['saga', 'story'], cond: () => S.chars[k] !== 'dead' && S.chars[k] !== 'left' }, o);
    return [
      g('marlowe', { x: -145.2, z: -75.2, brave: 0.95, gun: 'revolver', hp: 150, maxHp: 150, accuracy: 0.55, schedule: [[6, 23, 'gangFireA'], [23, 6, 'gangPorch']], talk: n => SAGA.talkMarlowe(n) }),
      g('tess', { x: -148.2, z: -76, brave: 0.9, gun: 'rifle', hp: 120, maxHp: 120, accuracy: 0.6, schedule: [[5, 9, 'gangWatch'], [9, 22, 'gangFireB'], [22, 5, 'gangWatch']], talk: n => SAGA.talkTess(n) }),
      g('bill', { x: -146.3, z: -78.4, brave: 0.5, schedule: [[5, 21, 'gangPot'], [21, 5, 'gangFireC']], talk: n => SAGA.talkBill(n) }),
      g('cole', { x: -140.5, z: -78.5, brave: 0.85, gun: 'revolver', hp: 120, maxHp: 120, accuracy: 0.55, schedule: [[7, 12, 'gangHorses'], [12, 20, 'gangFireC'], [20, 7, 'gangHorses']], talk: n => SAGA.talkCole(n) }),
      g('eli', { x: this.BED.x, z: this.BED.z, brave: 0.3, hp: 40, maxHp: 40, schedule: [[0, 24, 'gangBed']], talk: n => SAGA.talkEli(n) }),
    ];
  },
  /* the camp at Hollow Cabin: a fire in the yard, a cook pot, bedrolls, the wagon they got away in */
  build() {
    const C = this.CAMP, T = (x, z) => Terrain.height(x, z); World.campfire(C.x, C.z, true);
    place('gangFireA', C.x + 1.4, C.z + 1.2, Math.atan2(-1.4, -1.2), 'idle'); place('gangFireB', C.x - 1.7, C.z + 0.4, Math.atan2(1.7, -0.4), 'sit'); place('gangFireC', C.x - 1.0, C.z + 2.4, Math.atan2(1.0, -2.4), 'sit');
    place('gangPot', C.x + 0.4, C.z - 2.0, 0, 'work'); place('gangPorch', -150, -81.4, 0, 'idle'); place('gangWatch', -139, -68, 0.6, 'idle', { wander: 3 }); place('gangHorses', -140.2, -79, Math.PI / 2, 'work'); place('gangBed', this.BED.x, this.BED.z, Math.PI / 2, 'sleep');
    const sc = Game.scene, add = (m, x, z, y = 0) => { m.position.x += x; m.position.z += z; m.position.y += T(x, z) + y; sc.add(m); return m; };
    add(M(GEO.cyl, '#2b2b2b', 0.28, 0.26, 0.28, 0, 0.5, 0), C.x + 0.4, C.z - 1.2); for (const s of [-1, 1]) add(M(GEO.cyl, '#3b2a1e', 0.03, 1.1, 0.03, s * 0.45, 0.55, 0), C.x + 0.4, C.z - 1.2); add(M(GEO.cyl, '#3b2a1e', 0.025, 1.0, 0.025, 0, 1.08, 0).rotateZ(Math.PI / 2), C.x + 0.4, C.z - 1.2); // cook pot on a spit
    for (const [x, z, ry, c] of [[C.x - 2.6, C.z + 1.6, 0.5, '#6b5a4a'], [C.x + 2.7, C.z + 2.2, -0.6, '#4f6b8a'], [C.x - 0.6, C.z + 3.1, 1.5, '#8a3b3b']]) { const b = M(GEO.box, c, 0.75, 0.08, 1.8, 0, 0.04, 0); b.rotation.y = ry; add(b, x, z); const p = M(GEO.box, '#e6dcc5', 0.5, 0.1, 0.3, 0, 0.1, 0); p.rotation.y = ry; add(p, x - Math.sin(ry) * 0.7, z - Math.cos(ry) * 0.7); } // bedrolls
    { const x = -141.5, z = -82.5, g = new THREE.Group(); g.position.set(x, T(x, z), z); g.rotation.y = 0.35; sc.add(g); g.add(M(GEO.box, '#7a5232', 1.5, 0.5, 2.8, 0, 0.95, 0)); g.add(M(GEO.box, '#d9c58f', 1.56, 0.9, 2.2, 0, 1.6, -0.2)); for (const [wx, wz] of [[-0.85, -1], [0.85, -1], [-0.85, 1], [0.85, 1]]) { const w = M(GEO.cyl, '#3b2a1e', 0.5, 0.1, 0.5, wx, 0.5, wz); w.rotation.z = Math.PI / 2; g.add(w); } g.add(M(GEO.box, '#5a3a22', 0.1, 0.08, 1.8, 0, 0.75, 2.2)); Col.circle(x, z, 1.5, T(x, z) - 1, T(x, z) + 2, { block: true, cover: true }); } // the freight wagon
    for (const [x, z] of [[C.x + 3.2, C.z - 1.5], [C.x + 3.7, C.z - 0.9]]) add(M(GEO.box, '#8b6a47', 0.6, 0.6, 0.6, 0, 0.3, 0), x, z); // crates
    pickup({ id: 'saga_letter', item: 'rail_letter', x: 88, z: -158, y: Terrain.height(88, -158) + 1.0, when: () => SAGA.on() && ['camp', 'escape'].includes(SAGA.stage('s4')) && !Inv.count('rail_letter'), mesh: M(GEO.box, '#5a3a22', 0.4, 0.12, 0.28) });
    const doc = Buildings.find(b => b.name === "Doc Pell's"); // the doctor's bag, on the washstand: the quiet way to get it
    pickup({ id: 'saga_medkit', item: 'medkit', x: doc.x + 3.3, z: doc.z - 1.6, y: doc.floor + 0.9, owner: 'doc', when: () => SAGA.on() && SAGA.stage('s1') === 'med' && !Inv.count('medkit'), mesh: M(GEO.box, '#3b2a1e', 0.34, 0.22, 0.2) });
  },
  stage(id) { const m = Missions.st(id); return m.status === 'active' ? Missions.defs[id].stages[m.stage].id : null; },
  begin() { // a new game of the saga: wake at the camp, eleven days after Bitter Creek
    Object.assign(S.p, { x: -144.5, z: -73.5, yaw: Math.PI }); Object.assign(S.h, { x: -139.6, z: -76.5, yaw: -Math.PI / 2 }); S.time.hour = 7.2; S.money = 7; S.chapter = 1;
  },
  opening() {
    journal('Eleven days since Bitter Creek. Two of us dead on the tracks, the payroll still on the train, and Eli with a bullet under his ribs. Josiah says the Lord is testing us. Old Bill says the Lord has better things to do.', 'note');
    UI.banner('Chapter 1', 'Ashes', 'Hollow Cabin, eleven days after Bitter Creek.'); Missions.start('s1');
  },
  /* ---------- the doctor's kit: four ways to get it ---------- */
  getKit(how) {
    S.decisions.s1_med = how; if (!Inv.count('medkit')) Inv.add('medkit', 1);
    if (how === 'paid') { Inv.money(-10); Rep.rel && Rep.rel('doc', 5); }
    else if (how === 'favor') { S.flags.owes_doc = true; Rep.honor(3, 'told Doc Pell the truth'); journal('Doc Pell gave me his kit on a promise. I owe him a day\'s work, and he knows where the bullet came from.', 'note'); }
    else if (how === 'threat') { Rep.honor(-8, 'robbed the doctor at gunpoint'); Rep.faction('town', -10); S.flags.doc_robbed = true; journal('I took Doc Pell\'s kit with a gun in my hand. He will tell Pike a woman with a revolver wanted laudanum and needles. Pike can add.', 'note'); }
  },
  docTree(n) {
    const open = !n.isAsleep || !n.isAsleep();
    return {
      start: { text: () => S.flags.saga_doc_asked ? 'Back again. Have you decided how this goes?' : 'I don\'t know your face, and I know every face in the Gap. You walk like somebody who rode all night. What do you need?', on: () => { S.flags.saga_doc_asked = true; },
        choices: [
          { text: 'Your surgical kit. Carbolic, laudanum, needle and gut. I can pay.', next: 'price' },
          { text: 'There\'s a boy up in the hills with a bullet in him. He\'s nineteen.', next: 'truth' },
          { text: '[Draw] The bag, Doc. Now.', cond: () => !!S.weapons.revolver, next: 'threat' },
          { text: 'Nothing. Wrong house.', next: null },
        ] },
      price: { text: 'Ten dollars buys the bag and my not asking who it\'s for. That is a fair price for both.', choices: [
          { text: 'Ten dollars. Here.', cond: () => S.money >= 10, why: 'You need $10', do: () => SAGA.getKit('paid'), next: 'paid' },
          { text: 'I don\'t have ten.', next: 'start' } ] },
      paid: { text: 'Boil the needle. A spoon of the laudanum, no more, or he won\'t wake to thank you. And miss: if he\'s hot to the touch by tomorrow night, you bring him to me, whatever he\'s done.' },
      truth: { text: 'A bullet. Not a hunting accident, then, or you\'d have said so. The telegraph has been busy about a train at Bitter Creek. Were you going to mention the train?', choices: [
          { text: 'He\'s my brother. He held the horses. That\'s all he did, and that\'s all I\'ve got to tell you.', do: () => SAGA.getKit('favor'), next: 'favor' },
          { text: 'Forget I came.', next: null } ] },
      favor: { text: 'I took an oath about the sick, not about the railroad. Take the bag. Boil the needle, a spoon of laudanum and no more. You\'ll owe me a day\'s honest work, and I will collect. Now go, before Amos Pike walks past my window.' },
      threat: { text: 'Thirty years I\'ve patched up men who point guns. None of them were ever sorry until later. It\'s on the washstand.', choices: [
          { text: '[Take it]', do: () => SAGA.getKit('threat'), next: 'robbed' },
          { text: '[Lower the gun] ...I shouldn\'t have done that. Can we start over?', next: 'start' } ] },
      robbed: { text: 'Boil the needle. I hope he lives. I hope you think about that, when you think about this.' },
    };
  },
  /* ---------- camp talk ---------- */
  line(n, lines) { return pick(lines); },
  talkMarlowe(n) {
    const s1 = Missions.st('s1'), s2 = Missions.st('s2'), s3 = Missions.st('s3'), st = this.stage('s1'), st3 = this.stage('s3'), P = Game.player, box = P.carry && P.carry.id === 'strongbox';
    const s4 = Missions.st('s4'), st4 = this.stage('s4');
    if (st4 === 'return' && box) return this.payTree(n);
    if (s4.status === 'available' || s4.status === 'active' || s4.status === 'done') return this.marloweCh3(n, s4, st4);
    if (st3 === 'return' && box) return this.boxTree(n);
    if (s3.status === 'available' || s3.status === 'active' || s3.status === 'done') return this.marloweCh2(n, s3, st3);
    return {
      start: { on: () => { if (st === 'camp' && !S.flags.saga_briefed) S.flags.saga_briefed = true; },
        text: () => st === 'camp' ? 'Wren. Sit a minute. Your brother had a bad night. Bill has done what a teamster can do with whiskey and a bootlace, and it is not enough. There is a doctor in Juniper Gap, southeast, where the two roads meet. I need you to go and get what a doctor has.'
          : st === 'ride' || st === 'med' ? 'You are still here, and Eli is still bleeding. Juniper Gap, southeast. Go on.'
          : st === 'back' ? 'You have it? Then don\'t stand here telling me. Take it to Bill.'
          : s2.status === 'done' ? this.line(n, ['A fed camp is a camp that can think. I have been thinking, Wren. There is money in this valley that is not the railroad\'s, and it is guarded by fools.', 'Fenwick Crane sells bad whiskey out of a mill east of the river. The Lord provides, Wren. Sometimes He provides a mill.', 'Rest. When I have the shape of it, you will be the first I tell.'])
          : this.line(n, ['We lost two good people at Bitter Creek. I count them every morning so I do not forget what the railroad owes us.', 'Eli will mend. I have decided it, and I am rarely wrong about the living.', 'Do not let Cole talk to you about money. He counts it before it is his.']),
        choices: [
          { text: 'I\'ll ride now.', hide: () => st !== 'camp', next: 'go' },
          { text: 'What do I tell the doctor?', hide: () => st !== 'camp', next: 'how' },
          { text: 'What went wrong at Bitter Creek, Josiah?', hide: () => st === 'camp', next: 'creek' },
          { text: 'What happens now?', hide: () => s2.status !== 'done', next: 'next' },
          { text: 'Later.', hide: () => st === 'camp', next: null },
        ] },
      how: { text: 'Tell him whatever opens the bag. Pay him if he will be paid. Lie if he will be lied to. If he will be neither, well. You have a revolver and a brother. But hear me: no law follows you back here. We are four guns and a dying boy, and we cannot stand a posse.', next: 'go' },
      go: { text: 'Take Biscuit. Keep off the main road past the creek if you can. And Wren: he asked for you in the night. Come back.' },
      creek: { text: 'Somebody told the Halvorsen men we were coming. There were rifles on that train where there should have been clerks. I have gone through it every night since, name by name, and I do not like the names I am left with.', choices: [{ text: 'You think it was one of us.', next: 'creek2' }, { text: 'It was a bad plan. That\'s all.', next: 'creek3' }] },
      creek2: { text: 'I think it is a small valley and we are a smaller family. Do not carry that thought around camp for me. Carry it quietly.' },
      creek3: { text: 'It was my plan. So you are saying the dead are mine. They are. I have not asked anyone else to hold them. But mind how you say it in front of the others, Wren. A family that doubts its father does not eat.' },
      next: { text: 'Now we get well, and then we get paid. Fenwick Crane keeps his takings in a strongbox at Coyote Mill, and he does not know we are in his valley. I mean to introduce us. Not today. When Eli can sit a horse.' },
    };
  },
  marloweCh2(n, s3, st3) {
    return {
      start: { text: () => s3.status === 'available' ? 'Eli sat a horse this morning. Twice round the yard and he only cursed once. So. Coyote Mill, east across Willow Bridge. Fenwick Crane sells rotgut to three counties and keeps what he makes in an iron box, because no bank will have him. I want that box, Wren.'
          : st3 === 'return' ? 'Where is it? I do not see an iron box. Bring it here, to my hand.'
          : s3.status === 'active' ? 'East across Willow Bridge. A lookout on the west side, a boy, more frightened than he looks. The box is inside the mill. Quiet, if you can be.'
          : this.line(n, S.decisions.s3_box === 'skim' ? ['I counted that box twice, Wren. Fenwick Crane is a careless man, but he is not that careless. I will say no more. Today.', 'There is a railroad payroll that owes us, and it comes through Tamarack Pass. I am listening for when.'] : ['You did well at the mill. I told the others so. Cole did not enjoy hearing it.', 'There is a railroad payroll that owes us, and it comes through Tamarack Pass. I am listening for when.', S.flags.crane_war ? 'Fenwick Crane knows our faces now. Good. Let him lie awake.' : 'Fenwick Crane is looking for a thief and does not know where to look. I find that restful.']),
        choices: [
          { text: 'I\'ll do it. Tell me what you know.', hide: () => s3.status !== 'available', do: () => Missions.start('s3'), next: 'brief' },
          { text: 'Why the Cranes, and not the railroad?', hide: () => s3.status !== 'available', next: 'why' },
          { text: 'Not yet.', hide: () => s3.status !== 'available', next: null },
          { text: 'What went wrong at Bitter Creek, Josiah?', hide: () => s3.status === 'available', next: 'creek' },
          { text: 'Later.', hide: () => s3.status === 'available', next: null },
        ] },
      why: { text: 'Because the railroad has detectives and Fenwick Crane has cousins. Because a thief cannot go to the law. And because I will not ask this family to face rifles again until it has eaten for a month. Does that satisfy you?', next: 'start' },
      brief: { text: 'Four of them at most. Fenwick, two hands, and the boy on lookout, name of Dutchy. Buy the boy, scare him or go round him, I do not care which. Tess wanted to come and I said no; one rider is a traveler, two is a raid. Take the box and bring it here. Not to Bill, not to Cole. To me.' },
      creek: { text: 'Somebody told the Halvorsen men we were coming. I have gone through it every night since, name by name. Do not ask me again until I have an answer I can live with.' },
    };
  },
  /* ---------- Chapter 3: the payroll at Tamarack Pass ---------- */
  marloweCh3(n, s4, st4) {
    const plan = () => S.decisions.s4_plan;
    return {
      start: { text: () => s4.status === 'available' ? 'Sit, Wren. All of you, sit. The Halvorsen paymaster reached Survey Camp 3 last night, up at Tamarack Pass, with six weeks of wages for the grading crews. It goes out to the crews the day after tomorrow. Until then it sits in a tent, in an iron chest, with four hired guns around it. The same money, Wren. The Lord has sent it round again.'
          : st4 === 'return' ? 'I heard the horse a mile off. Is it on the saddle? Bring it into the light.'
          : s4.status === 'active' ? (plan() === 'quiet' ? 'Tess\'s way, then. In the dark, on your own, with her rifle on the ridge if it sours. Go after nine, when the camp has eaten.' : 'Cole\'s way. Hard and fast, and Tess on the ridge to thin them. Do not stop to argue with anyone.')
          : this.line(n, [S.decisions.s4_letter === 'josiah' ? 'I have read that telegram forty times. "Our friend in the Marlowe party." A friend. I am going to find out who has friends.' : 'We are rich by the standards of a week ago, and I have never slept worse. Somebody sold Bitter Creek. I can feel them at my fire.', 'When the railroad counts its chest and finds it gone, they will send someone cleverer than hired guns. We should be ready to be clever back.']),
        choices: [
          { text: 'How do we take it?', hide: () => s4.status !== 'available', next: 'plans' },
          { text: 'The last time we went after this money, two of us died.', hide: () => s4.status !== 'available', next: 'doubt' },
          { text: 'Not yet.', hide: () => s4.status !== 'available', next: null },
          { text: 'Later.', hide: () => s4.status === 'available', next: null },
        ] },
      doubt: { text: 'And I have counted them every morning since. That is why you are going to hear two plans and choose between them, instead of hearing one from me. I am capable of learning, Wren. It is only that it costs so much.', next: 'plans' },
      plans: { who: 'Tess Arden', text: 'Mine is simple. One person, after dark. The guards walk the same four paths all night; I watched them two evenings running. Wren goes in low, lifts the chest, walks out. I sit on the ridge over the gate with the rifle and nobody ever knows I was there unless it goes wrong.', next: 'plans2' },
      plans2: { who: 'Cole Riker', text: 'And if the chest weighs what six weeks of wages weighs, she\'s crawling out with it on her back past four rifles. I say we ride in at supper, shoot the lamps, shoot anyone holding a gun, and ride out. Ninety seconds. They\'re clerks\' guards, not soldiers.', choices: [
          { text: 'Tess\'s plan. Quiet, after dark.', do: () => { S.decisions.s4_plan = 'quiet'; Missions.start('s4'); }, next: 'quiet' },
          { text: 'Cole\'s plan. Fast and loud.', do: () => { S.decisions.s4_plan = 'loud'; Missions.start('s4'); }, next: 'loud' } ] },
      quiet: { text: 'Quiet, then. Cole, you will hold the horses at the trailhead and you will not improve on the plan. Wren: Tamarack Pass is east over Willow Bridge and then south, up the switchback. Tess will be on the overlook above the gate. Go after nine.' },
      loud: { text: 'Loud. So be it. But it is Wren who goes through the gate, and Tess who covers her from the overlook, and you, Cole, who hold the horses, because I have seen what you do when you are excited. East over Willow Bridge, south up the switchback.' },
    };
  },
  payTree(n) {
    const letter = Inv.count('rail_letter') > 0;
    const give = how => { const P = Game.player, b = P.carry; P.carry = null; if (b) Carry.remove(b); S.flags.s4_delivered = true; if (letter) { S.decisions.s4_letter = how; if (how !== 'kept') Inv.take('rail_letter', 1); }
      if (how === 'josiah') journal('I gave Josiah the paymaster\'s telegram. He read it standing up and then he looked at each of us in turn, the way you look at a hand of cards.', 'decision');
      else if (how === 'tess') { Rep.rel('tess', 20); journal('I showed the telegram to Tess and nobody else. She said: so it\'s true. Then she said: we tell Josiah when we know who, not before. He\'ll shoot the wrong one.', 'decision'); }
      else if (how === 'kept') journal('The telegram is in my boot. I haven\'t told anyone. If one of them sold us, I don\'t know yet which one I\'d be telling.', 'decision'); };
    return {
      start: { text: 'Open it. ...Would you look at that. Would you look at what they pay men to dig a ditch for a railroad. Six weeks of other men\'s sweat, and tonight it belongs to people who bled for it.', choices: [
          { text: '[Hand over the chest]', hide: () => letter, do: () => give('none'), next: 'done' },
          { text: '[Give Josiah the telegram too] This was on the paymaster\'s desk. Read it.', hide: () => !letter, do: () => give('josiah'), next: 'josiah' },
          { text: '[Hand over the chest; show the telegram to Tess later]', hide: () => !letter, do: () => give('tess'), next: 'done' },
          { text: '[Hand over the chest; keep the telegram to yourself]', hide: () => !letter, do: () => give('kept'), next: 'done' } ] },
      josiah: { text: '"...as arranged with our friend in the Marlowe party, who is to be paid the balance of two hundred dollars on delivery." Our friend. ...Nobody leaves this camp tonight. Nobody. Bill, count the money where I can see your hands. All of you, where I can see your hands.' },
      done: { text: 'Shares at sunup. Eat. Sleep. For one night let us be a family that won.' },
    };
  },
  /* the railroad guns at Survey Camp 3, and Tess covering from the overlook */
  s4Spawn() {
    this.s4Despawn(); const look = { skin: '#e8b48c', shirt: '#3b3b5b', vest: '#5a5a5a', hair: '#3b2a1e', hatColor: '#2b2b2b' };
    const gun = (k, nm, x, z, route, o) => NPC.spawn(Object.assign({ key: k, name: nm, x, z, lawful: false, group: 'rail3', state: 'patrol', gun: 'revolver', hp: 90, maxHp: 90, fleeHp: 20, accuracy: 0.4, sense: 0.85, wild: true, tags: ['story', 's4', 's4foe'], route, look }, o));
    gun('pg1', 'Railroad guard', 92, -153, [{ x: 92, z: -153, wait: 10 }, { x: 98, z: -156, wait: 6 }]); gun('pg2', 'Railroad guard', 84, -160, [{ x: 84, z: -160, wait: 8 }, { x: 80, z: -170, wait: 8 }]);
    gun('pg3', 'Railroad guard', 104, -168, [{ x: 104, z: -168, wait: 8 }, { x: 104, z: -158, wait: 8 }]); gun('pg4', 'Paymaster\'s man', 92, -172, [{ x: 92, z: -172, wait: 12 }, { x: 96, z: -168, wait: 5 }], { gun: 'rifle', accuracy: 0.45 });
    const t = NPC.byKey('tess'); if (t && t.alive) { t.pos.set(T_OVERLOOK.x, Col.ground(T_OVERLOOK.x, T_OVERLOOK.z, 99), T_OVERLOOK.z); t.state = 'scripted'; t.path = null; t.coverT = 2; t.script = (dt, me) => this.tessCover(dt, me); }
  },
  s4Despawn() { for (const n of NPC.all.slice()) if (n.tags.includes('s4')) NPC.despawn(n); const t = NPC.byKey('tess'); if (t && t.state === 'scripted') { NPC.despawn(t); } },
  tessCover(dt, me) { // she holds the ridge; once the alarm is up she picks off whoever is shooting at Wren
    me.sp = 0; const m = Missions.st('s4'); if (!m.c.alarm) return; me.coverT -= dt; if (me.coverT > 0) return; me.coverT = 2.6;
    const foe = NPC.all.filter(n => n.tags.includes('s4foe') && n.alive && !n.downed && !n.fled && n.state === 'combat').sort((a, b) => a.distP - b.distP)[0]; if (!foe) return;
    me.yaw = Math.atan2(foe.pos.x - me.pos.x, foe.pos.z - me.pos.z); const a = new THREE.Vector3(me.pos.x, me.pos.y + 1.4, me.pos.z), b = new THREE.Vector3(foe.pos.x, foe.pos.y + 1.1, foe.pos.z);
    Sfx.shot(true); FX.tracer(a, b, 'none'); if (Math.random() < 0.7) { foe.takeHit({ dmg: 55, from: me, gun: 'rifle', dir: fwd(me.yaw) }); m.c.tessHits = (m.c.tessHits || 0) + 1; if (m.c.tessHits === 1) UI.toast('Tess\'s rifle opens up from the ridge', 'good'); }
  },
  /* setting the strongbox down in front of Marlowe: hand it all over, or keep some back first */
  boxTree(n) {
    const give = how => { const P = Game.player, b = P.carry; P.carry = null; if (b) Carry.remove(b); S.decisions.s3_box = how; S.flags.s3_delivered = true;
      if (how === 'all') { Inv.money(18, 'your share'); Rep.honor(4, 'dealt straight with the outfit'); journal('Put Crane\'s box in Josiah\'s hands, every dollar. He counted out shares at the fire like a man dealing cards.', 'decision'); }
      else { Inv.money(45, 'kept back from the box'); Rep.honor(-6, 'stole from your own'); S.flags.skimmed_outfit = true; journal('I took forty-five dollars out of Crane\'s box before Josiah saw it. For Eli and me, for after. I told myself that. Tess watched me do the buckle back up.', 'decision'); } };
    return {
      start: { text: 'There it is. Lord, the weight of it. Set it down, Wren. Is it all there?', choices: [
          { text: '[Hand it over] All of it. I didn\'t open it.', do: () => give('all'), next: 'all' },
          { text: '[Lie] All of it. (You took $45 out on the road.)', do: () => give('skim'), next: 'skim' } ] },
      all: { text: 'Two hundred and twelve dollars. Shares tonight, and the rest goes in the tin for when we ride. You see, all of you? This is what we are when we hold together.' },
      skim: { text: 'One hundred and sixty-seven. ...Fenwick Crane sells whiskey to three counties and this is all he keeps? Well. Shares tonight. We will speak of arithmetic another time.' },
    };
  },
  /* Dutchy Moss on lookout at the mill, saga version: he can be bought, scared off, talked past or offered a way out */
  dutchyWatch(dt, me) {
    const m = Missions.st('s3'); if (m.status !== 'active' || m.c.alarm || m.c.dutchy || Dialog.open) return; const P = Game.player;
    if (me.seesPlayer && me.distP < 13 && !P.crouch) { m.c.dutchy = 1; me.face(P.pos); me.say('Hold it right there!'); Dialog.start(me, this.dutchyTree(me)); }
  },
  dutchyTree(me) {
    const m = Missions.st('s3');
    return {
      start: { text: 'That\'s far enough. This is Crane ground. Who are you, and what do you want with it?', choices: [
        { text: 'Bribe him ($8)', cond: () => S.money >= 8, why: 'Need $8', do: () => { Inv.money(-8, 'to Dutchy'); S.decisions.s3_dutchy = 'bribed'; Rep.rel('dutchy', 25); STORY.distractGang(me); }, next: 'bribed' },
        { text: '"You look hungry. I know an outfit that feeds its people."', do: () => { S.decisions.s3_dutchy = 'offered'; S.flags.dutchy_offer = true; Rep.rel('dutchy', 30); Rep.honor(2, 'offered the boy a way out'); STORY.distractGang(me); }, next: 'offer' },
        { text: 'Threaten him (gun drawn)', cond: () => Game.player.weapon !== 'fists', why: 'Draw a gun first', do: () => { S.decisions.s3_dutchy = 'threatened'; Rep.rel('dutchy', -20); me.fled = true; me.state = 'scripted'; me.say('Don\'t shoot! I\'m gone!'); me.script = (dt, n) => { n.moveTo(170, -40, 5, dt); }; later(() => { const f = NPC.byKey('fenwick') || NPC.byKey('sal'); if (f && f.alive && !m.c.boxTaken) { f.say('Dutchy? What\'s he yelling about?'); f.alertGroup(Game.player.pos); } }, 7000); }, next: 'threat' },
        { text: 'Back off', do: () => { m.c.dutchy = 0; m.c.dutchyWarned = (m.c.dutchyWarned || 0) + 1; if (m.c.dutchyWarned > 1) { me.say('I warned you!'); me.alertGroup(Game.player.pos); } }, next: null },
        { text: 'Attack', do: () => { S.decisions.s3_dutchy = 'fought'; me.alertGroup(Game.player.pos); }, next: null },
      ] },
      bribed: { text: 'Eight dollars. Fenwick owes me nine weeks. ...The box is in the mill. I\'ll call them down to the creek. You get a minute, and you never saw me.' },
      offer: { text: 'Feeds them. Real food? ...I ain\'t had a hot supper since the thaw. Where? No, don\'t say it here. Hollow Cabin way, I\'ve seen the smoke. I\'ll get them down to the creek. If I come looking for that supper, you tell your people not to shoot.' },
      threat: { text: 'Okay! Okay! I ain\'t dying for Fenwick Crane!' },
    };
  },
  talkBill(n) {
    const st = this.stage('s1'), s2 = Missions.st('s2'), st2 = this.stage('s2'), have = Inv.count('medkit') > 0, meat = Inv.count('meat_raw') + Inv.count('meat_cooked');
    return {
      start: { on: () => { S.flags.saga_met_bill = true; },
        text: () => st === 'back' && have ? 'Is that a doctor\'s bag? Lord. Give it here, girl, quick. Hold the lamp. No, don\'t look, hold the lamp.'
          : st ? 'He\'s hot and he\'s stopped complaining, and I liked it better when he complained. I\'ve boiled water. That is the whole of my doctoring. Get me something better.'
          : s2.status === 'available' ? 'He\'s sleeping easy. First time in a week. Now. You want to hear the other trouble? We have coffee, a half sack of beans and four people looking at me like I\'m hiding a ham.'
          : st2 === 'hunt' ? 'Deer come down to the creek south of here, mornings and evenings. Stay downwind and don\'t rush the shot. Two good cuts of venison will do us.'
          : st2 === 'deliver' && meat >= 2 ? 'That\'s venison. That\'s real venison. Hand it over before Cole smells it.'
          : s2.status === 'done' ? this.line(n, ['Eli ate. Sat up and ate, and asked for more. I told him more is a thing other people have.', 'Josiah is planning again. I can tell by how polite he gets.', 'I drove freight thirty years, Wren. Honest loads. Then the railroad came and there were no loads. I am not saying it excuses us. I am saying it\'s how a man gets here.'])
          : this.line(n, ['I\'ve fed this outfit on less. Not much less.', 'Mind Josiah. He is grieving, and he does it loudly, and it looks like plans.']),
        choices: [
          { text: '[Give him the kit]', hide: () => !(st === 'back' && have), do: () => { Inv.take('medkit', 1); S.flags.s1_given = true; }, next: 'given' },
          { text: 'I\'ll hunt. What do we need?', hide: () => s2.status !== 'available', do: () => Missions.start('s2'), next: 'hunt' },
          { text: '[Give him the venison]', hide: () => !(st2 === 'deliver' && meat >= 2), do: () => { let n = 2; const r = Math.min(n, Inv.count('meat_raw')); Inv.take('meat_raw', r); n -= r; if (n) Inv.take('meat_cooked', n); S.flags.s2_fed = true; }, next: 'fed' },
          { text: 'How bad is Eli, truly?', hide: () => !st, next: 'eli' },
          { text: 'Later, Bill.', next: null },
        ] },
      eli: { text: 'The ball went in under the ribs and did not come out. It isn\'t in the gut, or he\'d be dead and we\'d know why. But it has to come out, and I have a pocket knife and a strong opinion. Go get the doctor\'s things.' },
      given: { text: () => 'There. There it is, the little devil. Hear that in the pan? That\'s what a railroad pays for a nineteen-year-old.' + (S.decisions.s1_med === 'threat' ? ' ...I won\'t ask how you came by a doctor\'s whole bag before breakfast. I can see by your face not to.' : S.decisions.s1_med === 'stole' ? ' ...There\'s no receipt in this bag, I notice. Well. He\'s breathing.' : ' He\'ll sleep now. You did right by him.') },
      hunt: { text: 'Two cuts of venison. Deer water at the creek south of the cabin at dawn and dusk. Walk the last of it, crouch when you see them, and take the shot when they drop their heads. And Wren? A clean kill. We don\'t waste what we take.' },
      fed: { text: 'Now that is a supper. Sit down, all of you, sit. Josiah, say your grace and make it short.' },
    };
  },
  talkTess(n) {
    const st = this.stage('s1'), s2 = Missions.st('s2');
    return {
      start: { text: () => st ? 'You\'re going for the doctor? Good. Go for the doctor\'s things, not the doctor. A man who has seen this camp is a man Josiah has to think about, and I don\'t like how Josiah thinks lately.'
          : s2.status === 'done' ? this.line(n, ['I watched you bring that deer in. One shot. Somebody taught you right.', 'Cole\'s been riding out alone at night. Says he\'s scouting. Scouting what, in the dark?', 'When Eli\'s on his feet, you and me should talk about where a person goes after this. Not here. Not by the fire.'])
          : this.line(n, ['I had the brakeman in my sights at Bitter Creek and I didn\'t take it. He was a kid. Then the shooting started from the mail car and it didn\'t matter what I\'d decided.', 'I keep the watch because I can\'t sleep anyway. Don\'t thank me.', 'Your brother talks in his sleep. Mostly about a dog you two had.']),
        choices: [
          { text: 'You don\'t trust Josiah?', next: 'trust' },
          { text: 'How did you end up with this outfit?', next: 'past' },
          { text: 'Keep your eyes open, Tess.', next: null },
        ] },
      trust: { text: 'I trust him to love us. I\'ve stopped trusting what he\'ll do about it. There\'s a difference, and Bitter Creek was the difference.' },
      past: { text: 'Colonel Tibbet\'s Travelling Exhibition. I shot cards out of a man\'s hand twice a day for six years. Then the Colonel sold the horses to the railroad and the tents to a bank. Josiah found me shooting bottles behind a saloon for drinks. He said I was wasted on bottles.' },
    };
  },
  talkCole(n) {
    const st = this.stage('s1'), s2 = Missions.st('s2');
    return {
      start: { text: () => st ? 'All this for the kid. No offence, Calloway, he\'s your blood. But we left eleven thousand dollars on that train, and nobody\'s riding anywhere for that.'
          : s2.status === 'done' ? this.line(n, ['Venison. We robbed a train and I\'m grateful for venison. Tell me that\'s not a joke on somebody.', 'Marlowe\'s got a new sermon coming. You can smell it. I just want to know my share before the amen this time.'])
          : this.line(n, ['I\'m minding the horses. Somebody has to have a way out of here.', 'You ever think what eleven thousand dollars looks like? I do. I think about it till it\'s got a face.']),
        choices: [
          { text: 'He held the horses for you too, Cole.', hide: () => !st, next: 'eli' },
          { text: 'Who told the railroad we were coming?', next: 'who' },
          { text: 'Mind the horses, then.', next: null },
        ] },
      eli: { text: 'And I\'d have held his. I\'m not saying let him die. I\'m saying when he\'s well, let\'s remember what we came out here for. It wasn\'t our health.' },
      who: { text: 'Is that what the old man\'s saying? That one of us sold it? Convenient. Then it wasn\'t his plan that got Hale and Marguerite killed, it was a Judas. Ask yourself who that story helps.' },
    };
  },
  talkEli(n) { const done = Missions.st('s1').status === 'done';
    return { start: { text: () => done ? pick(['Wren. Bill says you got a doctor\'s bag out of a town full of people who\'d hang us. Don\'t tell me how. I want to imagine it.', 'I dreamed about Pepper. Remember Pepper? He\'d have bit that brakeman.', 'It doesn\'t hurt like it did. It hurts like something that\'s going to stop.']) : '...Wren? Is it morning? Tell Josiah I held them. I held all four horses. I didn\'t let go.',
        choices: [{ text: done ? 'Rest. I\'m not going anywhere.' : 'You held them. Lie still. I\'m going to get you a doctor\'s things.', next: null }] } };
  },
};
ITEMS.medkit = { name: 'Doc Pell\'s surgical kit', cat: 'quest', col: '#3b2a1e', d: 'Carbolic, laudanum, needle and gut. For Eli.' };
Object.assign(NPCNAMES, { marlowe: 'Josiah Marlowe', tess: 'Tess Arden', bill: 'Old Bill Yancey', cole: 'Cole Riker' });

Missions.def({ id: 's1', saga: true, type: 'main', chapter: 1, title: 'A Bullet in the Boy', giver: 'none', summary: 'Eli is dying of a railroad bullet. Juniper Gap has a doctor.',
  prereq: () => false, // started by SAGA.opening()
  stages: [
    { id: 'camp', text: 'Speak with Josiah Marlowe at the fire.', enter: () => STORY.hint(Input.touch ? 'Walk up to people and tap the prompt bubbles to talk.' : 'Walk up to people and press E to talk.'),
      objectives: [O.talk('josiah', 'Speak with Josiah Marlowe at the fire', 'marlowe', 'saga_briefed'), O.flag('bill', 'Optional: ask Old Bill about Eli', 'saga_met_bill', () => { const n = NPC.byKey('bill'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; }, { optional: true })] },
    { id: 'ride', text: 'Ride southeast to Juniper Gap.', enter: () => STORY.hint(Input.touch ? 'Tap the "Mount" bubble next to Biscuit, then push the stick. Tap Run to speed up.' : 'Press E next to Biscuit to mount. W to ride, hold Shift to canter, keep holding to gallop.'),
      objectives: [O.goto('town', 'Ride to Juniper Gap', -40, 24, 30)] },
    { id: 'med', text: 'Doc Pell lives across the street from the saloon. Pay him, tell him the truth, take it at gunpoint, or lift it quietly.',
      objectives: [O.item('kit', 'Get Doc Pell\'s surgical kit', 'medkit', 1, () => { const n = NPC.byKey('doc'); return n && n.alive ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : { x: -40, z: 34 }; })],
      exit: () => { if (!S.decisions.s1_med) { S.decisions.s1_med = 'stole'; Rep.honor(-3, 'stole from the doctor'); } } },
    { id: 'back', text: 'Bring the kit to Old Bill at Hollow Cabin.', objectives: [O.flag('give', 'Give the kit to Old Bill at the camp', 's1_given', () => { const n = NPC.byKey('bill'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : { x: SAGA.CAMP.x, z: SAGA.CAMP.z }; })] },
  ],
  fail: [],
  complete: ctx => { const how = S.decisions.s1_med; S.chars.eli = 'mending'; S.h.called = false;
    ctx.m.outcome = { paid: 'Paid Doc Pell his ten dollars', favor: 'Told Doc Pell the truth, and owe him a day\'s work', threat: 'Robbed Doc Pell at gunpoint', stole: 'Stole the kit from Doc Pell\'s washstand' }[how] + ' · the bullet is out';
    journal('Bill got the ball out. Eli is sleeping. Nobody said thank you and nobody needed to.', 'note'); },
  cleanup: () => {}, failOutcome: () => 'Eli died at Hollow Cabin.',
});
Missions.defs.s1.stages.forEach(s => s.fail = [{ check: () => S.chars.bill === 'dead' || (NPC.byKey('eli') && !NPC.byKey('eli').alive), why: 'Without Bill and Eli there is no one left to save.' }]);
Missions.def({ id: 's2', saga: true, type: 'main', chapter: 1, title: 'Empty Bellies', giver: 'bill', summary: 'The camp has coffee and half a sack of beans. Deer water at the creek south of the cabin.',
  prereq: () => SAGA.on() && Missions.st('s1').status === 'done',
  start: () => { const n = NPC.byKey('bill'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; },
  stages: [
    { id: 'hunt', text: 'Hunt deer near the creek south of Hollow Cabin. Crouch and stay downwind.', enter: () => STORY.hint(Input.touch ? 'Tap Crouch to stalk, Aim then Fire to shoot. Tap the carcass to skin it.' : 'C crouches. Hold right mouse to aim, click to shoot. Skin the carcass with E.'),
      objectives: [O.check('meat', () => `Bring down a deer and take the venison (${Math.min(2, Inv.count('meat_raw') + Inv.count('meat_cooked'))}/2)`, () => Inv.count('meat_raw') + Inv.count('meat_cooked') >= 2, () => ({ x: -128, z: -52 })), O.check('clean', 'Optional: a clean kill, one shot', ctx => ctx.m.c.clean, null, { optional: true })],
      on: { hunt: (d, ctx) => { if (d.sp === 'deer' && d.quality === 3) ctx.m.c.clean = 1; } } },
    { id: 'deliver', text: 'Take the venison back to Old Bill.', objectives: [O.flag('fed', 'Give the venison to Old Bill', 's2_fed', () => { const n = NPC.byKey('bill'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : { x: SAGA.CAMP.x, z: SAGA.CAMP.z }; })] },
  ],
  fail: [],
  complete: ctx => { S.chapter = Math.max(S.chapter, 2); Inv.money(3, 'your share of the camp tin'); if (ctx.m.opt.clean || ctx.m.c.clean) Rep.honor(2, 'a clean kill'); ctx.m.outcome = 'The outfit ate' + (ctx.m.c.clean ? ' · one clean shot' : '');
    journal('We ate like people tonight. Josiah said grace for four minutes and then told us about a mill east of the river where Fenwick Crane keeps his money. Tess looked at me across the fire. I looked at the fire.', 'note');
    later(() => UI.banner('Chapter 2', 'Honest Work', 'Josiah has a job. Speak with him at the fire.'), 4500); },
  cleanup: () => {}, failOutcome: () => 'The camp went hungry.',
});

Missions.def({ id: 's3', saga: true, type: 'main', chapter: 2, title: 'Crane Money', giver: 'marlowe', summary: 'Fenwick Crane keeps his whiskey money in an iron box at Coyote Mill. Josiah wants it.',
  prereq: () => SAGA.on() && Missions.st('s2').status === 'done',
  start: () => { const n = NPC.byKey('marlowe'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; },
  stages: [
    { id: 'ride', text: 'Ride east across Willow Bridge to Coyote Mill.', objectives: [O.goto('mill', 'Ride to Coyote Mill', MILL.x, MILL.z, 48)], enter: () => { S.locations.mill = 'gang'; World.apply(); } },
    { id: 'take', text: 'Take the Cranes\' strongbox. Buy the lookout, scare him, go round him, or fight.', objectives: [O.check('box', 'Take the strongbox from the mill', ctx => ctx.m.c.boxTaken, () => ({ x: 138, z: -87, y: 4 })), O.check('unseen', 'Optional: take it without raising the alarm', ctx => ctx.m.c.boxTaken && !ctx.m.c.alarm, null, { optional: true })],
      enter: ctx => { if (!ctx.box) { const b = Carry.make('strongbox', 138, -87.5); b.mesh.position.y = Col.ground(138, -87.5, 5) + 0.2; ctx.box = b; b.onPick = () => { ctx.m.c.boxTaken = 1; }; } },
      on: { alarm: (d, ctx) => { if (d.group === 'crane') ctx.m.c.alarm = 1; } },
      next: ctx => ctx.m.c.alarm && NPC.all.some(n => n.group === 'crane' && n.alive && !n.downed && !n.fled) ? 'escape' : 'return' },
    { id: 'escape', text: 'The Cranes are on you. Lose them or put them down.', enter: () => SAGA.ensureBox(), on: { alarm: (d, ctx) => { if (d.group === 'crane') ctx.m.c.alarm = 1; } }, objectives: [O.check('lose', 'Lose the Crane gang or defeat them', () => NPC.all.filter(n => n.group === 'crane' && n.alive && !n.downed && !n.fled && n.state === 'combat').every(n => n.distP > 85))] },
    { id: 'return', text: 'Carry the strongbox to Josiah Marlowe at Hollow Cabin. Stow it on Biscuit for the ride.', enter: () => SAGA.ensureBox(), on: { alarm: (d, ctx) => { if (d.group === 'crane') ctx.m.c.alarm = 1; } },
      objectives: [O.flag('deliver', 'Bring the strongbox to Josiah (carry it to him)', 's3_delivered', () => { const n = NPC.byKey('marlowe'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : { x: SAGA.CAMP.x, z: SAGA.CAMP.z }; })] },
  ],
  fail: [],
  complete: ctx => { const m = ctx.m; S.decisions.s3_approach = m.c.alarm ? 'loud' : S.decisions.s3_dutchy === 'bribed' ? 'bribe' : S.decisions.s3_dutchy === 'offered' ? 'offer' : 'stealth';
    if (m.c.alarm) { S.flags.crane_war = true; Rep.faction('crane', -30); } else S.flags.crane_unaware = true;
    if (S.decisions.s3_dutchy === 'bribed' || S.decisions.s3_dutchy === 'threatened' || S.decisions.s3_dutchy === 'offered') S.chars.dutchy = 'deserted';
    S.locations.mill = 'abandoned'; for (const n of NPC.all.slice()) if (n.group === 'crane') NPC.despawn(n); S.chapter = Math.max(S.chapter, 3);
    m.outcome = `${S.decisions.s3_box === 'all' ? 'Gave Josiah every dollar' : 'Kept $45 back from the outfit'} · ${{ loud: 'the Cranes saw who robbed them', bribe: 'bought the lookout', offer: 'offered Dutchy Moss a way out', stealth: 'in and out unseen' }[S.decisions.s3_approach]}${S.chars.fenwick === 'dead' ? ' · Fenwick Crane killed' : ''}`;
    journal(m.c.alarm ? 'The Cranes know who took their money. Josiah calls that a message. Bill calls it a second set of people who want us dead.' : 'Fenwick Crane is turning his mill over looking for a thief. Nobody there saw my face.', 'note');
    later(() => UI.banner('Chapter 3', 'The Halvorsen Payroll', 'Josiah has heard when the railroad money moves. Speak with him.'), 4500); },
  cleanup: () => { for (const c of Carry.list.slice()) if (c.id === 'strongbox') Carry.remove(c); },
  failOutcome: () => 'The Cranes kept their money.',
});
SAGA.ensureBox = () => { const P = Game.player; if (S.flags.s3_delivered || S.horseCarry || (P.carry && P.carry.id === 'strongbox') || Carry.list.some(c => c.id === 'strongbox')) return; const f = fwd(P.yaw); Carry.make('strongbox', P.pos.x + f.x, P.pos.z + f.z); };

ITEMS.rail_letter = { name: 'Paymaster\'s telegram', cat: 'quest', col: '#f4ead3', d: '"...as arranged with our friend in the Marlowe party, who is to be paid the balance of two hundred dollars on delivery. — R. Calder, Halvorsen Detective Service."' };
Missions.def({ id: 's4', saga: true, type: 'main', chapter: 3, title: 'The Halvorsen Payroll', giver: 'marlowe', summary: 'Six weeks of railroad wages sit in an iron chest at Survey Camp 3, Tamarack Pass. The same money that got two of the outfit killed.',
  prereq: () => SAGA.on() && Missions.st('s3').status === 'done',
  start: () => { const n = NPC.byKey('marlowe'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : null; },
  stages: [
    { id: 'ride', text: 'Ride to Tamarack Pass: east over Willow Bridge, then south up the switchback to the overlook.', enter: () => SAGA.s4Spawn(),
      objectives: [O.goto('overlook', 'Meet Tess at the overlook above the camp', T_OVERLOOK.x, T_OVERLOOK.z, 12), O.check('dark', 'Optional: go in after dark (9 at night to 4 in the morning)', ctx => ctx.m.c.dark, null, { optional: true, hide: () => S.decisions.s4_plan !== 'quiet' })] },
    { id: 'camp', text: 'Take the pay chest from outside the paymaster\'s tent at Survey Camp 3.',
      objectives: [O.check('chest', 'Take the pay chest', ctx => ctx.m.c.boxTaken, () => ({ x: T_OFFICE.x + 1, z: T_OFFICE.z + 3.2, y: 4 })), O.item('desk', 'Optional: search the paymaster\'s dispatch case', 'rail_letter', 1, () => ({ x: 88, z: -158, y: 3 }), { optional: true }), O.check('unseen', 'Optional: take it without raising the alarm', ctx => ctx.m.c.boxTaken && !ctx.m.c.alarm, null, { optional: true })],
      enter: ctx => { const h = S.time.hour; if (h >= 21 || h < 4) ctx.m.c.dark = 1; if (!NPC.all.some(n => n.tags.includes('s4foe'))) SAGA.s4Spawn(); if (!Carry.list.some(c => c.id === 'strongbox') && !ctx.m.c.boxTaken) { const b = Carry.make('strongbox', T_OFFICE.x + 1, T_OFFICE.z + 3.2); b.onPick = () => { ctx.m.c.boxTaken = 1; }; }
        if (S.decisions.s4_plan === 'loud') { const g = NPC.all.find(n => n.tags.includes('s4foe') && n.alive); if (g) later(() => { if (Missions.active === 's4' && g.alive) g.alertGroup(Game.player.pos); }, 1500); } },
      on: { alarm: (d, ctx) => { if (d.group === 'rail3') ctx.m.c.alarm = 1; } },
      next: ctx => ctx.m.c.alarm && NPC.all.some(n => n.tags.includes('s4foe') && n.alive && !n.downed && !n.fled) ? 'escape' : 'return' },
    { id: 'escape', text: 'The camp is awake. Lose the railroad guns or put them down.', enter: () => SAGA.ensurePay(), on: { alarm: (d, ctx) => { if (d.group === 'rail3') ctx.m.c.alarm = 1; } }, objectives: [O.check('lose', 'Lose the railroad guns or defeat them', () => NPC.all.filter(n => n.tags.includes('s4foe') && n.alive && !n.downed && !n.fled && n.state === 'combat').every(n => n.distP > 85))] },
    { id: 'return', text: 'Carry the pay chest back to Josiah at Hollow Cabin.', enter: () => SAGA.ensurePay(), on: { alarm: (d, ctx) => { if (d.group === 'rail3') ctx.m.c.alarm = 1; } },
      objectives: [O.flag('deliver', 'Bring the pay chest to Josiah (carry it to him)', 's4_delivered', () => { const n = NPC.byKey('marlowe'); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y + 2.4 } : { x: SAGA.CAMP.x, z: SAGA.CAMP.z }; })] },
  ],
  fail: [],
  complete: ctx => { const m = ctx.m, killed = ['pg1', 'pg2', 'pg3', 'pg4'].filter(k => S.chars[k] === 'dead' || (NPC.byKey(k) && !NPC.byKey(k).alive)).length;
    SAGA.s4Despawn(); World.apply(); S.chapter = Math.max(S.chapter, 4); Inv.money(60, 'your share of the payroll');
    if (m.c.alarm) { S.flags.rail_knows = true; S.bounty = Math.round((S.bounty + 25) * 100) / 100; UI.toast('The Halvorsen Railroad has put $25 on the woman who hit Camp 3', 'bad'); } else if (!killed) Rep.honor(5, 'nobody died for it');
    m.outcome = `${S.decisions.s4_plan === 'quiet' ? 'Tess\'s plan' : 'Cole\'s plan'} · ${m.c.alarm ? 'the camp was woken' : 'in and out unseen'}${S.decisions.s4_letter ? { josiah: ' · gave Josiah the telegram', tess: ' · showed Tess the telegram', kept: ' · kept the telegram secret', none: '' }[S.decisions.s4_letter] : ' · never saw the telegram'}`;
    journal('We have the payroll. We also have, somewhere in this camp, a person the railroad calls "our friend".' + (S.decisions.s4_letter ? '' : ' I only know that because Josiah keeps saying somebody sold Bitter Creek.'), 'note');
    later(() => UI.banner('End of Chapter 3', 'The Halvorsen Payroll', 'Chapter 4, "Thicker Than Water", is still being written. The valley is open: bounties, strangers, hunting and the saloon.'), 4500); },
  cleanup: () => { for (const c of Carry.list.slice()) if (c.id === 'strongbox') Carry.remove(c); SAGA.s4Despawn(); World.apply(); },
  failOutcome: () => 'The railroad kept its payroll.',
});
Missions.defs.s4.stages.forEach(s => { const u = s.update; s.update = (dt, ctx) => { const h = S.time.hour; if (ctx.m.stage < 2 && (h >= 21 || h < 4)) ctx.m.c.dark = 1; if (u) u(dt, ctx); }; });
SAGA.ensurePay = () => { const P = Game.player; if (S.flags.s4_delivered || S.horseCarry || (P.carry && P.carry.id === 'strongbox') || Carry.list.some(c => c.id === 'strongbox')) return; const f = fwd(P.yaw); Carry.make('strongbox', P.pos.x + f.x, P.pos.z + f.z); };

/* ---------- wiring: the saga and the classic story share one world ---------- */
{ // classic main missions only run in the classic story
  for (const id of Missions.order) { const d = Missions.defs[id]; if (d.saga || d.type !== 'main') continue;
    const pr = d.prereq, tk = d.tick; d.prereq = () => !SAGA.on() && (!pr || pr()); if (tk) d.tick = (dt, m) => { if (!SAGA.on()) tk(dt, m); }; }
  const spawn = STORY.spawnWorldNPCs.bind(STORY); STORY.spawnWorldNPCs = function () { spawn(); if (!SAGA.on()) return; for (const c of SAGA.roster()) { if ((c.cond && !c.cond()) || NPC.byKey(c.key)) continue; NPC.spawn(c); } };
  const dw = STORY.dutchyWatch.bind(STORY); STORY.dutchyWatch = (dt, me) => SAGA.on() ? SAGA.dutchyWatch(dt, me) : dw(dt, me);
  const doc = STORY.talkDoc.bind(STORY); STORY.talkDoc = n => SAGA.on() && SAGA.stage('s1') === 'med' && !Inv.count('medkit') ? SAGA.docTree(n) : doc(n);
}
