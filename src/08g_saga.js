/* ===== The new story: "The Last Good Country" (an outlaw saga in the vein of Red Dead Redemption 2) =====
   Wren Calloway rides with the Marlowe outfit. Eleven days ago they hit the Halvorsen payroll train at Bitter Creek and
   it went wrong: two of them dead on the tracks, the money left behind, and Wren's brother Eli carried out with a bullet
   in him. What is left of the outfit is hiding at Hollow Cabin, broke, hungry and hunted. Over six chapters the jobs get
   bigger and Josiah Marlowe gets harder to follow, and Wren has to decide what she owes a family that is coming apart.
   New games start this story (S.story === 'saga'); the original land-grab story stays in the game as the classic story.
   Playable so far: Chapter 1. Chapters 2 to 6 are outlined in SAGA.CHAPTERS and will be built on this file. */
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
    { n: 2, title: 'Honest Work', playable: false, text: 'Marlowe wants a stake. The Crane gang\'s whiskey money sits at Coyote Mill, and Fenwick Crane does not know the outfit is in his valley yet.' },
    { n: 3, title: 'The Halvorsen Payroll', playable: false, text: 'The same railroad, the same money, a second try: the payroll comes through Tamarack Pass. Scout it, plan it, and choose how loud it gets.' },
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
    place('gangFireA', C.x + 1.4, C.z + 1.2, Math.atan2(-1.4, -1.2), 'idle'); place('gangFireB', C.x - 1.7, C.z + 0.4, Math.atan2(1.7, -0.4), 'sit'); place('gangFireC', C.x + 0.3, C.z + 1.9, Math.PI, 'sit');
    place('gangPot', C.x + 0.4, C.z - 2.0, 0, 'work'); place('gangPorch', -150, -81.4, 0, 'idle'); place('gangWatch', -139, -68, 0.6, 'idle', { wander: 3 }); place('gangHorses', -140.2, -79, Math.PI / 2, 'work'); place('gangBed', this.BED.x, this.BED.z, Math.PI / 2, 'sleep');
    const sc = Game.scene, add = (m, x, z, y = 0) => { m.position.x += x; m.position.z += z; m.position.y += T(x, z) + y; sc.add(m); return m; };
    add(M(GEO.cyl, '#2b2b2b', 0.28, 0.26, 0.28, 0, 0.5, 0), C.x + 0.4, C.z - 1.2); for (const s of [-1, 1]) add(M(GEO.cyl, '#3b2a1e', 0.03, 1.1, 0.03, s * 0.45, 0.55, 0), C.x + 0.4, C.z - 1.2); add(M(GEO.cyl, '#3b2a1e', 0.025, 1.0, 0.025, 0, 1.08, 0).rotateZ(Math.PI / 2), C.x + 0.4, C.z - 1.2); // cook pot on a spit
    for (const [x, z, ry, c] of [[C.x - 2.6, C.z + 1.6, 0.5, '#6b5a4a'], [C.x + 2.7, C.z + 2.2, -0.6, '#4f6b8a'], [C.x - 0.6, C.z + 3.1, 1.5, '#8a3b3b']]) { const b = M(GEO.box, c, 0.75, 0.08, 1.8, 0, 0.04, 0); b.rotation.y = ry; add(b, x, z); const p = M(GEO.box, '#e6dcc5', 0.5, 0.1, 0.3, 0, 0.1, 0); p.rotation.y = ry; add(p, x - Math.sin(ry) * 0.7, z - Math.cos(ry) * 0.7); } // bedrolls
    { const x = -141.5, z = -82.5, g = new THREE.Group(); g.position.set(x, T(x, z), z); g.rotation.y = 0.35; sc.add(g); g.add(M(GEO.box, '#7a5232', 1.5, 0.5, 2.8, 0, 0.95, 0)); g.add(M(GEO.box, '#d9c58f', 1.56, 0.9, 2.2, 0, 1.6, -0.2)); for (const [wx, wz] of [[-0.85, -1], [0.85, -1], [-0.85, 1], [0.85, 1]]) { const w = M(GEO.cyl, '#3b2a1e', 0.5, 0.1, 0.5, wx, 0.5, wz); w.rotation.z = Math.PI / 2; g.add(w); } g.add(M(GEO.box, '#5a3a22', 0.1, 0.08, 1.8, 0, 0.75, 2.2)); Col.circle(x, z, 1.5, T(x, z) - 1, T(x, z) + 2, { block: true, cover: true }); } // the freight wagon
    for (const [x, z] of [[C.x + 3.2, C.z - 1.5], [C.x + 3.7, C.z - 0.9]]) add(M(GEO.box, '#8b6a47', 0.6, 0.6, 0.6, 0, 0.3, 0), x, z); // crates
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
    const s1 = Missions.st('s1'), s2 = Missions.st('s2'), st = this.stage('s1');
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
    later(() => UI.banner('End of Chapter 1', 'Ashes', 'Chapter 2, "Honest Work", is still being written. The valley is open: bounties, strangers, hunting and the saloon are all there.'), 4500); },
  cleanup: () => {}, failOutcome: () => 'The camp went hungry.',
});

/* ---------- wiring: the saga and the classic story share one world ---------- */
{ // classic main missions only run in the classic story
  for (const id of Missions.order) { const d = Missions.defs[id]; if (d.saga || d.type !== 'main') continue;
    const pr = d.prereq, tk = d.tick; d.prereq = () => !SAGA.on() && (!pr || pr()); if (tk) d.tick = (dt, m) => { if (!SAGA.on()) tk(dt, m); }; }
  const spawn = STORY.spawnWorldNPCs.bind(STORY); STORY.spawnWorldNPCs = function () { spawn(); if (!SAGA.on()) return; for (const c of SAGA.roster()) { if ((c.cond && !c.cond()) || NPC.byKey(c.key)) continue; NPC.spawn(c); } };
  const doc = STORY.talkDoc.bind(STORY); STORY.talkDoc = n => SAGA.on() && SAGA.stage('s1') === 'med' && !Inv.count('medkit') ? SAGA.docTree(n) : doc(n);
}
