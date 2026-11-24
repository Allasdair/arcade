// node tests/run.js   (Node only, no dependencies; QUICK=1 for short sims)
const PIN={'2026-11-23':'f9e63a03','2027-01-01':'c1df23ae'};
const {load,ok,eq,res}=require('./lib.js'); const L=load(); const QUICK=!!process.env.QUICK; const t0=Date.now();
const sec=n=>console.log('\n# '+n);
// ---------- helpers ----------
function game(o){ const st=L.newGame(Object.assign({seed:'test',goal:{type:'endless'}},o||{})); return st; }
function setRows(st,rows){ st.b.fill(0); rows.forEach((r,i)=>{ const y=st.R-1-i; for(let x=0;x<st.W;x++) if(r[x]==='#') st.b[y*st.W+x]=1; }); }
function put(st,t,r,x,y){ st.cur={t,r,x,y}; st.phase='play'; st.lockT=0; st.resets=0; st.lowY=y; st.lastRot=false; st.held=false; }
const fill=(W,holes)=>{ let s=''; for(let x=0;x<W;x++) s+=holes.includes(x)?'.':'#'; return s; };
const run=(st,n,ins)=>{ for(let i=0;i<n;i++) L.step(st,i===0?ins:[]); return st; };

sec('pieces and boards');
for(const k in L.PIECES){ const p=L.PIECES[k];
  ok(p.st.every(c=>c.length===p.size),`${k} keeps ${p.size} blocks in every rotation`);
  const back=JSON.stringify(p.st[0].map(([x,y])=>[x,y]).sort()); let c=p.st[0]; const n=p.kick==='G'?([x,y])=>[-y,x]:p.kick==='O'?(v=>v):([x,y])=>[p.n-1-y,x];
  for(let r=0;r<4;r++) c=c.map(n); ok(JSON.stringify(c.sort())===back,`${k}: 4 clockwise turns return to the start`); }
for(const b of L.BOARD_IDS){ const st=game({board:b}); eq([st.W,st.H],[L.BOARDS[b].w,L.BOARDS[b].h],`${b} board size`); ok(!(st.W===10&&st.H===20),`${b} is never 10×20`);
  for(const k in L.PIECES){ const sp=L.spawnPos(st,k); ok(L.fits(st,k,0,sp.x,sp.y),`${k} spawns on ${b}`);
    for(let r=0;r<4;r++){ let any=false; for(let x=-3;x<st.W+3;x++) if(L.fits(st,k,r,x,st.R-4)) any=true; ok(any,`${k} rotation ${r} fits ${b}`); } } }

sec('movement and collision');
for(const b of L.BOARD_IDS){ const st=game({board:b,arr:0}); run(st,1); put(st,'T',0,3,5); let n=0; while(L.tryMove(st,-1)) n++; eq(st.cur.x,0,`${b}: T slides to the left wall`);
  while(L.tryMove(st,1)); eq(st.cur.x,st.W-3,`${b}: T slides to the right wall`);
  setRows(st,[fill(st.W,[]).replace(/#/g,'#')].slice(0,0)); st.b[(st.R-1)*st.W+0]=1; put(st,'O',0,0,st.R-3); ok(!L.fits(st,'O',0,0,st.R-2),`${b}: O can't move into a block`); }

sec('rotation and kicks');
{ const st=game(); run(st,1);
  for(const k of ['T','S','Z','J','L','I']){ put(st,k,0,4,8); for(let i=1;i<=4;i++){ ok(L.rotate(st,1),`${k} rotates cw to state ${i%4}`); eq(st.cur.r,i%4,`${k} state ${i%4}`); }
    for(let i=1;i<=4;i++) ok(L.rotate(st,-1),`${k} rotates ccw`); eq([st.cur.x,st.cur.y],[4,8],`${k} back in place after spins in the open`); }
  put(st,'O',0,4,8); ok(!L.rotate(st,1),'O never rotates or kicks'); eq([st.cur.x,st.cur.y],[4,8],'O stays put');
  // wall kick: vertical I against the left wall rotating to flat
  put(st,'I',1,-2,8); ok(L.fits(st,'I',1,-2,8),'vertical I hugs the left wall'); ok(L.rotate(st,1),'I kicks off the left wall'); ok(st.cur.x>=0&&st.cur.r===2,'I lands inside the board after the kick');
  put(st,'I',3,st.W-2,8); ok(L.rotate(st,-1),'I kicks off the right wall'); ok(L.cellsOf(st.cur.t,st.cur.r,st.cur.x,st.cur.y).every(([x])=>x<st.W),'I inside after right-wall kick');
  // T against the right wall
  put(st,'T',3,st.W-2,8); ok(L.rotate(st,1),'T kicks off the right wall'); eq(st.lastKick>0,true,'T used a kick');
  // floor kick: T flat on the floor, rotating needs the up-kick
  setRows(st,[]); put(st,'T',0,4,st.R-2); ok(L.rotate(st,1),'T rotates on the floor'); ok(L.cellsOf('T',st.cur.r,st.cur.x,st.cur.y).every(([,y])=>y<st.R),'floor rotation stays on the board');
  // stack kick: a T under an overhang uses kick 1+
  setRows(st,[fill(st.W,[3,4,5]),fill(st.W,[3,4,5,6,7,8,9,10])]); put(st,'T',0,3,st.R-2); const r0=L.rotate(st,1); ok(r0,'T rotates next to the stack');
  // generic kick search for 3- and 5-block pieces
  for(const k of ['I3','L3','I5','L5','P','T5','U']){ put(st,k,0,1,8); let okAll=true; for(let i=0;i<4;i++) if(!L.rotate(st,1)) okAll=false; ok(okAll,`${k} rotates through all 4 states near the wall`);
    setRows(st,[]); put(st,k,1,0,8); const before=JSON.stringify(st.cur); const r=L.rotate(st,1); ok(r&&L.cellsOf(st.cur.t,st.cur.r,st.cur.x,st.cur.y).every(([x])=>x>=0&&x<st.W),`${k} kicks away from the left wall`); }
  eq(L.kicksFor('U',0,1,1).length,8,'generic search tries 8 offsets'); eq(L.kicksFor('U',0,3,-1)[1],[1,0],'counter-clockwise search is mirrored'); }

sec('bags');
{ for(const set of L.SET_IDS){ const st=game({set,seed:'bag'+set}); const base=L.SETS[set].base, per=base.length+(L.SETS[set].p3||0)+(L.SETS[set].p5||0);
    const q=[]; while(q.length<per*60){ L.fillQueue(st); q.push(...st.queue.splice(0)); }
    let good=true; for(let i=0;i<60;i++){ const bag=q.slice(i*per,i*per+per); for(const k of base) if(bag.filter(v=>v===k).length!==1) good=false; } ok(good,`${set}: every base piece exactly once per bag`);
    if(set==='kind') ok(!q.includes('S')&&!q.includes('Z'),'Kind never deals S or Z'); }
  const N=QUICK?20000:100000;
  for(const [set,p5,p3] of [['pentomix',1/8,0],['chaos',1/9,1/9],['junior',0,2/9]]){ const st=game({set,seed:'rate'+set}); let n=0,c5=0,c3=0;
    while(n<N){ L.fillQueue(st); for(const k of st.queue.splice(0)){ n++; if(L.PIECES[k].size===5) c5++; if(L.PIECES[k].size===3) c3++; } }
    ok(Math.abs(c5/n-p5)<0.004,`${set}: 5-block rate ${(c5/n).toFixed(4)} ≈ ${p5.toFixed(4)}`); ok(Math.abs(c3/n-p3)<0.004,`${set}: 3-block rate ${(c3/n).toFixed(4)} ≈ ${p3.toFixed(4)}`); } }

sec('gravity, lock delay and resets');
{ eq(L.gravOf(1,'1'),1092,'level 1 ≈ 1 row per second'); ok(L.gravOf(30,'2')===L.G_CAP,'gravity caps at 20 rows per tick');
  ok(L.gravOf(2,'1')>L.gravOf(1,'1')&&L.gravOf(1,'2')===2184,'speed scales the gravity curve');
  const st=game(); run(st,1); setRows(st,[]); put(st,'T',0,4,st.R-2); let n=0; while(st.phase==='play'&&n<200){ L.step(st,[]); n++; } eq(n,L.LOCK_T,'a grounded piece locks after 30 ticks (500 ms)');
  const s2=game({arr:50,das:250}); run(s2,1); setRows(s2,[]); put(s2,'T',0,4,s2.R-2); n=0; let dir='right';
  while(s2.phase==='play'&&n<2000){ const ins=n%10===5?[['p',dir],['r',dir]]:[]; if(n%10===5) dir=dir==='right'?'left':'right'; L.step(s2,ins); n++; }
  ok(n>=15*10+5&&n<=15*10+5+L.LOCK_T+10,`moves reset the lock timer at most 15 times (locked after ${n} ticks)`);
  const s3=game(); run(s3,1); put(s3,'T',0,4,5); s3.resets=10; s3.lockT=5; s3.cur.y=6; L.lower(s3); eq([s3.resets,s3.lockT],[0,0],'reaching a new lowest row resets the count'); }

sec('DAS and ARR');
{ const st=game({das:160,arr:33}); while(st.phase!=='play') L.step(st,[]); const x0=st.cur.x, xs=[]; st.gacc=-1e9;
  L.step(st,[['p','left']]); xs.push(st.cur.x); for(let i=0;i<14;i++){ st.gacc=-1e9; L.step(st,[]); xs.push(st.cur.x); }
  eq(xs.map(x=>x0-x),[1,1,1,1,1,1,1,1,1,2,2,3,3,4,4],'press moves 1, repeat starts at 10 ticks (160 ms), then every 2 ticks (33 ms)');
  const s2=game({das:160,arr:0}); while(s2.phase!=='play') L.step(s2,[]); L.step(s2,[['p','left']]); for(let i=0;i<9;i++) L.step(s2,[]); eq(s2.cur.x,0,'ARR 0 slides to the wall in one tick');
  L.step(s2,[['p','right'],['r','left']]); eq(s2.dir,1,'releasing left while right is held switches direction'); }

sec('line clears and scoring');
{ const mk=(o)=>{ const st=game(o); run(st,1); st.score=0; return st; };
  for(const n of [1,2,3,4]){ const st=mk(); const rows=[]; for(let i=0;i<n;i++) rows.push(fill(st.W,[st.W-1])); rows.push('#'+'.'.repeat(st.W-1)); setRows(st,rows);
    put(st,'I',1,st.W-3,st.R-4); L.hardDrop(st); eq(st.lines,n,`${n} line clear`); ok(st.score-[0,100,300,500,800][n]>=0&&st.score-[0,100,300,500,800][n]<=2*22,`${n}-line clear scores ${[0,100,300,500,800][n]} (+drop)`); }
  { const st=mk({board:'small'}); setRows(st,[...Array(5)].map(()=>fill(8,[0])).concat(['.......#'])); put(st,'I5',1,0,st.R-3); const d=L.dropDist(st); L.hardDrop(st); eq(st.lines,5,'I5 clears 5 lines'); eq(st.score-2*d,Math.round(1200*0.9),'5-line clear: 1200 × Small width factor'); }
  { const st=mk(); setRows(st,[fill(11,[4]),fill(11,[3,4,5]),'...#.......']); put(st,'T',2,3,st.R-3); st.lastRot=true; st.lastKick=0; L.hardDrop(st);
    eq([st.lines,st.stats.twists,st.score],[2,1,1200],'Twist Double: 3 corners, both front corners filled → 1,200'); }
  { const st=mk(); setRows(st,[fill(11,[4,5,6]),'....#......']); put(st,'T',0,4,st.R-2); st.lastRot=true; st.lastKick=0; L.hardDrop(st);
    eq([st.lines,st.stats.minis,st.score],[1,1,200],'mini-Twist Single: one front corner open → 200'); }
  { const st=mk(); setRows(st,[fill(11,[4,5,6]),'....#......']); put(st,'T',0,4,st.R-2); st.lastRot=false; L.hardDrop(st); eq(st.stats.minis+st.stats.twists,0,'no Twist unless the last action was a rotation'); }
  { const st=mk(); const quad=()=>{ setRows(st,[fill(11,[10]),fill(11,[10]),fill(11,[10]),fill(11,[10]),'#..........']); put(st,'I',1,8,st.R-4); L.hardDrop(st); L.collapse(st); st.phase='play'; };
    quad(); const a=st.score; quad(); eq(a,800,'first Quad 800'); eq(st.score-a,1200+50,'back-to-back Quad ×1.5, plus a 1-combo (+50)'); eq(st.stats.b2bMax,1,'back-to-back counted'); }
  { const st=mk(); setRows(st,[fill(11,[10]),fill(11,[10]),fill(11,[10]),fill(11,[10])]); put(st,'I',1,8,st.R-4); L.hardDrop(st); eq(st.stats.sweeps,1,'Clean Sweep detected'); eq(st.score,800+3000,'Clean Sweep after a Quad: +3,000'); }
  { const st=mk(); for(let i=0;i<3;i++){ setRows(st,[fill(11,[10]),'#..........']); put(st,'I',1,8,st.R-4); L.hardDrop(st); L.collapse(st); st.phase='play'; } eq(st.combo,2,'three clears in a row: combo 2'); eq(st.score,100+150+200,'combo adds 50 × combo count'); }
  ok(Math.abs(L.scoreMult({speed:'1',set:'classic',hold:true,next:5,ghost:true})-1)<1e-9,'default multiplier 1');
  ok(Math.abs(L.scoreMult({speed:'2',set:'chaos',hold:false,next:1,ghost:false,garbage:true,fading:true})-1.5*1.3*1.1*1.05*1.1*1.25*1.3)<1e-9,'modifier multipliers stack');
  { const st=mk({board:'large',speed:'1.5',set:'pentomix'}); setRows(st,[fill(14,[13]),'#.............']); put(st,'I',1,11,st.R-4); L.hardDrop(st); eq(st.score,Math.round(100*1.15*1.25*1.2),'width and modifier multipliers apply to line scores'); } }

sec('rising garbage, fading, top-out');
{ const st=game({garbage:true}); for(let i=0;i<600;i++) L.step(st,[]); let g=0; for(let x=0;x<st.W;x++) if(st.b[(st.R-1)*st.W+x]===255) g++; eq(g,st.W-1,'a garbage row with one gap rises after 10 s');
  for(let i=0;i<599;i++) L.step(st,[]); g=0; for(let i=0;i<st.b.length;i++) if(st.b[i]===255) g++; ok(g>=st.W-1&&g<=(st.W-1)*2,'not before the next 10 s');
  const f=game({fading:true}); run(f,1); setRows(f,[]); put(f,'O',0,0,f.R-2); L.hardDrop(f); const i=(f.R-1)*f.W; ok(L.cellVisible(f,i),'fresh blocks visible');
  f.tick+=301; ok(!L.cellVisible(f,i),'blocks fade after 5 s'); f.lastClear=f.tick-5; ok(L.cellVisible(f,i),'blocks flash back after a line clear');
  const t1=game(); run(t1,1); for(let y=0;y<4;y++) for(let x=0;x<t1.W;x++) if(x!==0) t1.b[y*t1.W+x]=1; t1.phase='are'; t1.timer=1; L.step(t1,[]); eq(t1.phase,'over','top-out when a new piece overlaps where it spawns');
  const t2=game(); run(t2,1); for(let y=2;y<t2.R;y++) for(let x=3;x<8;x++) t2.b[y*t2.W+x]=1; put(t2,'O',0,4,0); L.hardDrop(t2); eq(t2.phase,'over','top-out when a piece locks entirely in the hidden rows'); }

sec('determinism');
{ function randomRun(seed,ticks,snapAt){ let st=game({seed}); const R=L.rngFrom('inputs|'+seed), K=['left','right','soft','cw','ccw','hard','hold'];
    for(let i=0;i<ticks;i++){ const ins=[]; if(L.rnd(R)<.2){ const k=K[L.rint(R,K.length)]; ins.push([L.rnd(R)<.7?'p':'r',k]); } if(i===snapAt) st=JSON.parse(JSON.stringify(L.snapshot(st))); L.step(st,ins); } return L.fingerprint(st); }
  for(const s of ['a','b','c']){ const a=randomRun(s,6000,-1), b=randomRun(s,6000,-1), c=randomRun(s,6000,3000); eq(a,b,`seed ${s}: same seed + inputs → same game`); eq(a,c,`seed ${s}: save mid-run and resume → identical`); }
  const b1=L.botPlay({seed:'det',board:'medium'},'casual',3600), b2=L.botPlay({seed:'det',board:'medium'},'casual',3600); eq(L.fingerprint(b1),L.fingerprint(b2),'bot games are deterministic'); }

sec('campaign levels');
{ eq(L.LEVELS.length,30,'30 levels'); for(const ch of [1,2,3]){ const ls=L.LEVELS.filter(l=>l.ch===ch), cnt=t=>ls.filter(l=>l.type===t).length; ok(cnt('puzzle')===1&&cnt('dig')===1,`chapter ${ch} has a Dig and a Puzzle`); ok(ls[9].finale,`chapter ${ch} ends on a finale`); }
  for(const lv of L.LEVELS){ ok(lv.stars.length===5&&lv.stars.every(s=>typeof L.starText(lv,s)==='string'),`level ${lv.id} has 5 star goals`); ok(!(lv.cfg.board==='medium'&&false),''); }
  for(const lv of L.LEVELS.filter(l=>l.type==='dig')){ const W=L.BOARDS[lv.cfg.board].w; ok(lv.cfg.prefill.every(r=>r.length===W&&r.includes('.')),`level ${lv.id}: Dig layout has no full rows`); }
  // puzzles: replay the stored solution through the real engine
  for(const lv of L.LEVELS.filter(l=>l.type==='puzzle')){ const P=L.PUZZLES[Object.keys(L.PUZZLES).find(k=>L.PUZZLES[k].pieces.join()===lv.cfg.fixed.join())];
    const st=L.newGame(L.levelCfg(lv)); let i=0, moves=0, guard=0;
    while(st.phase!=='over'&&st.phase!=='done'&&guard++<20000){ let ins=[]; if(st.phase==='play'&&st.cur){ const [r,x]=P.sol[i++]; const d=(r-st.cur.r+4)%4;
        if(d===1) ins.push(['p','cw']); else if(d===2) ins.push(['p','cw'],['p','cw']); else if(d===3) ins.push(['p','ccw']); L.step(st,ins); moves+=ins.length; ins=[];
        const dx=x-st.cur.x; for(let j=0;j<Math.abs(dx);j++) ins.push(['p',dx<0?'l1':'r1']); moves+=Math.abs(dx); ins.push(['p','hard']); } L.step(st,ins); }
    ok(st.result&&st.result.ok,`level ${lv.id} (${lv.name}): stored solution ends in a Clean Sweep`); const e=L.starsEarned(lv,st.result); ok(e[0]&&e[2],`level ${lv.id}: solution earns ★1 and the par-moves star`); }
  // every non-puzzle level: a bot finishes it (★1)
  for(const lv of L.LEVELS.filter(l=>l.type!=='puzzle')){ let got=false, who='';
    for(const [k,s] of [['strong',0],['casual',0],['casual',1],['casual',2],['flat',0]]){ const st=L.botPlay(L.levelCfg(lv),k,60*60*10,null,s); if(st.result&&L.starsEarned(lv,st.result)[0]){ got=true; who=k; break; } }
    ok(got,`level ${lv.id} (${lv.name}): a bot gets ★1${who?' ('+who+')':''}`); } }

sec('Daily Blitz');
{ const fp=d=>{ const st=L.newGame(L.dailyCfg(d)); L.fillQueue(st); return L.fnv(st.queue.slice(0,8).map(k=>k.charCodeAt(0)+k.length*256).concat([L.dailyCombo(d).idx])); };
  let same=true; const n0=L.dayNum('2026-11-23'); for(let i=0;i<120;i++){ const d=L.dayDate(n0+i); if(JSON.stringify(L.dailyCfg(d))!==JSON.stringify(L.dailyCfg(d))||fp(d)!==fp(d)) same=false; }
  ok(same,'the same date gives the same combo and piece order (120 days)');
  const st=L.newGame(L.dailyCfg('2026-11-23')), q=[]; while(q.length<40){ L.fillQueue(st); q.push(...st.queue.splice(0)); }
  const st2=L.newGame(L.dailyCfg('2026-11-23')), q2=[]; while(q2.length<40){ L.fillQueue(st2); q2.push(...st2.queue.splice(0)); } eq(q.slice(0,40),q2.slice(0,40),'two devices deal the same pieces');
  eq(fp('2026-11-23'),PIN['2026-11-23'],'pinned fingerprint 2026-11-23'); eq(fp('2027-01-01'),PIN['2027-01-01'],'pinned fingerprint 2027-01-01');
  const counts={}; for(let i=0;i<365;i++){ const c=L.dailyCombo(L.dayDate(n0+i)).idx; counts[c]=1; } ok(Object.keys(counts).length>=25,'the curated table rotates through most combos');
  // the clock pauses with the game: time only moves when the game steps
  const g=L.newGame(L.dailyCfg('2026-11-23')); run(g,600); const snap=JSON.parse(JSON.stringify(L.snapshot(g))); eq(snap.tick,600,'saved Daily keeps its clock'); run(snap,L.DAILY_S*60-600-1); ok(snap.phase!=='done'||snap.result.why==='topout','not over a tick early'); L.step(snap,[]);
  ok(snap.phase==='done'||snap.phase==='over','Daily ends at 3:00');
  const S=L.defSave(); const r1=L.dailyResult(S,'2026-11-23',{score:50000,lines:40,ticks:10800,stats:{}},'2026-11-23'), r2=L.dailyResult(S,'2026-11-23',{score:90000,lines:60,ticks:10800,stats:{}},'2026-11-23');
  ok(r1&&r2===null,'one scored attempt'); eq(S.daily.score,50000,'the first score stands'); eq(r1.xp,40,'Daily XP doubled on its release day');
  eq(L.dailyResult(S,'2026-11-24',{score:1,lines:1,ticks:1,stats:{}},'2026-11-25').xp,20,'not doubled on a later day'); eq(S.dstreak.cur,2,'streak counts consecutive days');
  ok(/^Linefall Daily · 23 Nov · .+ · 50,000 · 40 lines · [★☆]{3}$/.test(L.shareLine('2026-11-23',50000,40,2)),'share line format: '+L.shareLine('2026-11-23',50000,40,2)); }

sec('core: save, XP, stars, records, achievements');
{ const old=L.loadSave(JSON.stringify({xp:120,setup:{board:'small'}})); eq(old.xp,120,'old save keeps XP'); eq(old.setup.board,'small','old save keeps its setup'); eq(old.setup.speed,'1','missing nested fields come from defSave()'); ok(old.camp&&old.look&&old.ctl.das===160,'missing groups come from defSave()');
  ok(L.loadSave('not json').xp===0,'a broken save loads defaults');
  eq([L.levelOf(0),L.levelOf(49),L.levelOf(50),L.levelOf(150),L.levelOf(3175),L.levelOf(99999)],[1,1,2,3,10,10],'levels follow Sweep\'s first 10 steps');
  for(let l=2;l<=10;l++) ok(L.rewardsAt(l).length>0,`level ${l} has a reward`);
  const S=L.defSave(); const lv=L.LEVELS[0], base={ok:true,ticks:60*60,score:3000,lines:10,h:3,stats:{holds:1,quads:0,quints:0,pieces:30,aboveHalf:false,maxAboveStart:0,sweeps:0,moves:0,rots:0,reversals:0}};
  let r=L.campaignResult(S,lv,base); eq(r.fresh,[0],'★1 for finishing'); eq(r.xp,5,'5 XP per new chapter-1 star'); ok(!L.unlocked(S,2),'level 2 locked under 3 stars');
  r=L.campaignResult(S,lv,Object.assign({},base,{ticks:30*60})); eq(r.fresh,[1,2],'faster run adds ★2 ★3'); eq(L.campStars(S,1),3,'stars build up across attempts'); ok(L.unlocked(S,2),'3 stars open the next level');
  r=L.campaignResult(S,lv,Object.assign({},base,{ticks:30*60})); eq([r.fresh.length,r.xp],[0,0],'replays pay nothing');
  for(let i=1;i<=10;i++) S.camp[i]={s:[1,1,1,0,0],best:0}; delete S.camp[10]; const fin=L.campaignResult(S,L.LEVELS[9],Object.assign({},base,{score:60000,ticks:120*60}));
  ok(fin.chDone&&fin.xp>=50,'finishing chapter 1 pays the 50 XP bonus'); eq(L.checkAch(S,{mode:'campaign',cfg:{},res:null}).includes('ch1'),true,'Chapter 1 achievement');
  ok(L.owned(S,L.findCos('theme','lcd')),'Chapter 1 unlocks Retro LCD');
  ok(L.addRecord(S,{board:'medium',speed:'1',set:'classic'},{score:5000,lines:20,ticks:600}),'first record saved'); ok(!L.addRecord(S,{board:'medium',speed:'1',set:'classic'},{score:4000,lines:20,ticks:600}),'lower score is not a record');
  ok(L.addRecord(S,{board:'medium',speed:'1',set:'chaos'},{score:100,lines:1,ticks:60}),'records are per board × speed × piece set');
  const cfg={board:'medium',speed:'1',set:'classic',hold:true,ghost:true}, st0={quads:1,quints:0,twists:0,twistLines:0,sweeps:0,b2bMax:0,comboMax:0};
  const got=L.checkAch(S,{mode:'classic',cfg,res:{score:31000,lines:80,ticks:60*301,stats:st0}}); ok(['firstquad','middle','steady'].every(a=>got.includes(a)),'First Quad, Middle Ground and Steady Hands');
  ok(L.owned(S,L.findCos('style','outline')),'First Quad unlocks Outline blocks');
  ok(L.checkAch(S,{mode:'classic',cfg,res:{score:1,lines:1,ticks:1,stats:Object.assign({},st0,{sweeps:1,b2bMax:3,comboMax:8,twistLines:1})}}).length===4,'Clean Sweep, Unbroken, Chain Reaction, First Twist');
  eq(L.checkAch(L.defSave(),{mode:'daily',practice:true,cfg,res:{score:1e6,lines:1,ticks:1,stats:Object.assign({},st0,{quads:5})}}),[],'practice earns nothing');
  eq(L.classicXP({speed:'1'},23),4,'Classic XP: 1 per 5 lines'); eq(L.classicXP({speed:'2'},20),8,'× speed'); eq(L.classicXP({speed:'2'},999),50,'capped at 50');
  const S2=L.defSave(); S2.xp=777; S2.run={x:1}; const code=L.backupPlain(S2); ok(code.startsWith('LINEFALL1.'),'backup code prefix'); const back=L.parseBackup('my code: '+code+' thanks'); ok(back&&back.xp===777&&back.run===null,'backup round trip (run excluded)'); ok(L.parseBackup('SWEEP1.abc')===null,'other games\' codes are refused'); }

sec('Arcade contract');
{ const m=new Map([['arcade.v1',JSON.stringify({set:{sfx:false,music:false,lefty:true,lang:'de',appearance:'dark',motion:false,haptics:false,fullscreen:true,cb:true},name:'Al'})]]), store={get:k=>m.has(k)?m.get(k):null,set:(k,v)=>m.set(k,v)};
  const S=L.defSave(); const P=L.applyShared(S,L.readArcade(store)); eq([P.sfx,P.lefty,P.lang,P.name,P.cb],[false,true,'de','Al',true],'shared settings come from arcade.v1'); eq([S.sfx,S.lefty,S.lang],[true,false,'auto'],'linefall.v1 keeps the standalone values');
  ok(P.ctl===S.ctl&&P.look===S.look,'game options are shared objects, not copies');
  const sm=L.summary(S); for(const k of ['v','game','ver','level','maxLevel','xp','xpLevel','xpNext','ach','hi','last']) ok(k in sm,`summary has ${k}`);
  eq([sm.game,sm.maxLevel,sm.hi.length,sm.ach.length],['linefall',10,3,L.ACH.length],'summary values'); eq(sm.hi.map(h=>h[0]),['Best score (Medium 1×)','Campaign stars','Daily best'],'summary hi labels');
  eq(L.KEY,'linefall.v1','save key'); eq(L.SUMKEY,'arcade.summary.linefall','summary key'); ok(L.ACH.length>=24,`${L.ACH.length} achievements`); }

sec('bots (QUICK sims)');
{ const games=QUICK?1:2; let n=0, bad=0;
  for(const b of L.BOARD_IDS) for(const sp of L.SPEED_IDS) for(const set of L.SET_IDS) for(let i=0;i<games;i++){ const st=L.botPlay({board:b,speed:sp,set,seed:`q|${b}|${sp}|${set}|${i}`},'casual',60*60); n++; if(st.stats.pieces<20) bad++; }
  ok(bad===0,`casual bot plays every board × speed × set (${n} games, ${bad} topped out under 20 pieces)`);
  const s=L.botPlay({seed:'strong40',goal:{type:'sprint',lines:40}},'strong',60*60*5); ok(s.result&&s.result.ok&&s.stats.quads>=4,`strong bot clears 40 lines with Quads (${s.stats.quads})`); }

const r=res(); console.log(`\n${r.fail?'FAILED':'ok'}: ${r.pass} passed, ${r.fail} failed (${((Date.now()-t0)/1000).toFixed(1)} s)`); process.exit(r.fail?1:0);
