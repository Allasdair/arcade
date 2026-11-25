// node tools/build_levels.js  →  src/levels.js (+ tests/level_solutions.json, the winning lines the tests replay)
// Needs src/bank.js (tools/build_bank.js) and tests/bank_solutions.json.gz.
// Each level is a recipe with a fixed deal, picked from the graded bank, so players can learn a level.
// Par moves = the shortest proven win under the level's own rules (solver runs or the bot's best) + 15%, rounded up.
// Par time = par × the bank's seconds-per-move for that draw mode and grade, rounded up to 5 s.
const path=require('path'), fs=require('fs'), zlib=require('zlib');
const ROOT=path.join(__dirname,'..'), X=require(path.join(ROOT,'tests','lib.js')).load(['engine.js','solver.js','bank.js','core.js']);
const SOLS=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT,'tests','bank_solutions.json.gz'))));
const SLACK=1.15;
const CAMPS=[{name:'Draw 1 Basics',xp:6,bonus:75},{name:'Mixed',xp:10,bonus:150},{name:'Draw 3 Masters',xp:15,bonus:225}];
// [n, name, type, draw, grade(s), extra]. type: std | open | twist | puzzle | final. extra: passes, undo, moveLimit, pick
const R=[
 // Draw 1 Basics: Easy deals, unlimited passes, rising to Medium. Open deck on early levels to teach planning.
 [0,1,'First Deal','std',1,'easy',{pick:'easiest'}],[0,2,'Building Down','std',1,'easy'],[0,3,'Clear Columns','std',1,'easy'],
 [0,4,'Cards on the Table','open',1,'easy',{pick:'easiest'}],[0,5,'Patience','std',1,'easy'],[0,6,'Steady Hands','std',1,'easy',{pick:'hardest'}],
 [0,7,'Three Takebacks','twist',1,'easy',{undo:3}],[0,8,'Glass House','open',1,'medium'],[0,9,'Long Stock','std',1,'medium',{pick:'easiest'}],
 [0,10,'Halfway There','puzzle',1,'medium'],[0,11,'Kings Row','std',1,'medium'],[0,12,'Clear View','open',1,'hard'],
 [0,13,'Deep Columns','std',1,'medium'],[0,14,'No Going Back','twist',1,'medium',{undo:0,pick:'easiest'}],[0,15,'Graduation','final',1,'medium',{pick:'hardest'}],
 // Mixed: Medium to Hard, Draw 3 from halfway, limited passes.
 [1,1,'Shuffle Up','std',1,'medium'],[1,2,'Red and Black','std',1,'medium'],[1,3,'Second Wind','std',1,'hard',{pick:'easiest'}],
 [1,4,'Full Sight','open',1,'hard'],[1,5,'Three Passes','std',1,'medium',{passes:3}],[1,6,'Tight Corners','std',1,'hard',{passes:3}],
 [1,7,'Count Your Moves','twist',1,'medium',{moveLimit:1.25,pick:'easiest'}],[1,8,'Three at a Time','open',3,['easy','medium','hard','expert'],{pick:'easiest'}],[1,9,'Card Counter','std',3,'medium'],
 [1,10,'Crossroads','puzzle',3,['medium','hard']],[1,11,'Narrow Margins','std',3,['medium','hard'],{passes:3}],[1,12,'Open Hand','open',3,['hard','expert'],{pick:'easiest'}],
 [1,13,'Slow Burn','std',1,'hard',{passes:3}],[1,14,'One Pass','twist',1,['medium','hard'],{passes:1}],[1,15,'The Gauntlet','final',3,'hard',{pick:'hardest'}],
 // Draw 3 Masters: Hard to Expert, Draw 3, 3 passes then 1 pass. The final level is the hardest deal in the bank.
 [2,1,'High Stakes','std',3,'hard'],[2,2,'Cold Deck','std',3,'hard'],[2,3,'Hidden Depths','std',3,'hard',{passes:3}],
 [2,4,'Clear Sky','open',3,'expert',{passes:3,pick:'easiest'}],[2,5,'Thin Ice','std',3,['hard','expert'],{passes:3}],[2,6,'Iron Nerve','std',3,'expert',{passes:3}],
 [2,7,'Three Lifelines','twist',3,'hard',{undo:3,passes:3,pick:'easiest'}],[2,8,'Crystal Ball','open',3,'expert',{passes:1,pick:'easiest'}],[2,9,'Last Orders','std',3,'expert',{passes:1}],
 [2,10,'Endgame','puzzle',3,'expert'],[2,11,'Single File','std',3,'expert',{passes:1}],[2,12,'Eagle Eye','open',3,'expert',{passes:1}],
 [2,13,'Knife Edge','std',3,'expert',{passes:1}],[2,14,'Bare Hands','twist',3,['hard','expert'],{undo:0,passes:1,pick:'easiest'}],[2,15,'Grand Finale','final',3,'expert',{passes:3,pick:'hardest',all:true}]];

const used=new Set(), rateCache={};
const rateOf=(d,cfg)=>{ const k=d.draw+'|'+d.n+'|'+JSON.stringify(cfg); if(rateCache[k]==null) rateCache[k]=X.gradeRate(X.dealSeed(d.n),cfg,20).rate; return rateCache[k]; };
// the shortest proven win under the given rules, from a starting state builder
function bestLine(mk,cfg,limit){ let best=null; const a=X.solveAll(mk(),{limit:limit||80000}); if(a.status==='win') best=a.solution;
  for(let r=0;r<8;r++){ const b=X.solveAll(mk(),{limit:10000,jitter:1,seed:'L'+r}); if(b.status==='win'&&(!best||b.cost<best.length)) best=b.solution; }
  for(let k=0;k<20;k++){ const rec=[], st=mk(); const res=X.botPlay(st,cfg,X.rngFor('lvbot|'+k),{rec}); if(res.won&&(!best||rec.length<best.length)) best=rec; }
  return best; }
const LEVELS=[], LSOL={};
for(const [camp,n,name,type,draw,gr,ex0] of R){ const ex=ex0||{}, grades=[].concat(gr), passes=ex.passes||0, open=type==='open';
  const id=`c${camp+1}-${String(n).padStart(2,'0')}`;
  let pool=(open?X.openList(draw):X.bankList(draw)).filter(d=>!used.has(draw+'|'+d.n)&&grades.includes(d.grade)&&X.passesOk(d,passes));
  if(!pool.length){ console.log('WARNING',id,'no deal matches; relaxing the grade'); pool=(open?X.openList(draw):X.bankList(draw)).filter(d=>!used.has(draw+'|'+d.n)&&X.passesOk(d,passes)); }
  const cfg={draw,passes,open}; let d;
  // easiest: the bot's highest win rate, then the shortest par. hardest: the lowest win rate, then the most solver effort
  // (nodes searched to prove it), among deals with a sensible par. The Masters finale searches the whole pool.
  if(ex.pick==='easiest'){ const c=pool.slice(0,60).map(x=>({x,r:rateOf(x,cfg)})); c.sort((a,b)=>b.r-a.r||a.x.par-b.x.par); d=c[0].x; }
  else if(ex.pick==='hardest'){ const c=pool.filter(x=>x.par<=200).slice(0,ex.all?100000:60).map(x=>({x,r:rateOf(x,cfg)})); const low=Math.min(...c.map(q=>q.r));
    const hard=c.filter(q=>q.r===low).map(q=>({x:q.x,nodes:X.solveAll(X.newGame(X.dealSeed(q.x.n),{draw,passes}),{limit:80000}).nodes}));
    hard.sort((a,b)=>b.nodes-a.nodes); d=hard[0].x; if(ex.all) console.log('  hardest of',c.length,'deals: bot wins',low,'solver nodes',hard[0].nodes); }
  else { const r=X.rngFor('LVL|'+id); d=pool[Math.floor(r()*Math.min(pool.length,200))]; }
  used.add(draw+'|'+d.n);
  const seed=X.dealSeed(d.n); let puzzle=null, mk=()=>X.newGame(seed,{draw,passes});
  if(type==='puzzle'){ // a game already in progress, chosen where the bot (a casual player) most often goes wrong
    const sol=SOLS[draw+'|'+d.n].split(' '); let bestK=null, bestR=2;
    for(let f=.35;f<=.62;f+=.03){ const k=Math.floor(sol.length*f); if(sol[k-1]==='d') continue;
      const base=X.playActions(X.newGame(seed,{draw,passes}),sol.slice(0,k)); if(X.canAutoComplete(base)) continue;
      let w=0; for(let q=0;q<12;q++){ const st=X.cloneSt(base); if(X.botPlay(st,{draw},X.rngFor('pz|'+q+'|'+k)).won) w++; }
      if(w/12<bestR){ bestR=w/12; bestK=k; } }
    puzzle=sol.slice(0,bestK); const base=X.playActions(X.newGame(seed,{draw,passes}),puzzle); base.moves=0; base.hist=[];
    mk=()=>X.cloneSt(base); }
  const line=bestLine(mk,{draw,passes},80000); if(!line) throw new Error('no winning line for '+id);
  const par=Math.ceil(line.length*SLACK), grade=X.bankList(draw).find(b=>b.n===d.n).grade;
  const L={id,camp,n,name,type,draw,passes,open,undo:ex.undo==null?null:ex.undo,moveLimit:ex.moveLimit?Math.ceil(par*ex.moveLimit):null,
    deal:d.n,grade:d.grade,par,parTime:X.parTimeOf(draw,grade,par)};
  if(puzzle) L.puzzle=puzzle.join(' ');
  LEVELS.push(L); LSOL[id]=line.join(' ');
  console.log(id,name.padEnd(18),type.padEnd(6),'D'+draw,(passes?passes+'p':'∞').padEnd(3),d.grade.padEnd(7),'deal',d.n,'par',par,'time',L.parTime+'s'+(L.moveLimit?' limit '+L.moveLimit:'')+(L.undo!=null?' undo '+L.undo:'')+(puzzle?' puzzle at '+puzzle.length:'')); }
const js=`// Generated by tools/build_levels.js — do not edit by hand (change the recipes there and rerun).
// Three campaigns of 15 levels (Sweep's design). Each level has a fixed deal from the graded bank (seed SOL1|deal).
// type: std | open (every card face up) | twist (an extra rule: undo limit, move limit or 1 pass) | puzzle (a game in
// progress: \`puzzle\` lists the actions already played) | final (the campaign's hardest deal).
// par: the shortest proven win under the level's rules + 15%, rounded up. parTime: par × seconds per move, rounded up to 5 s.
const CAMPS=${JSON.stringify(CAMPS)};
const LEVELS=[
${LEVELS.map(L=>' '+JSON.stringify(L)).join(',\n')}];
// the game's starting state for a level (a puzzle level starts part-way through, with its move count at 0)
function levelGame(L){ const st=newGame(dealSeed(L.deal),{draw:L.draw,passes:L.passes,open:L.open,undo:L.undo,moveLimit:L.moveLimit});
  if(L.puzzle){ playActions(st,L.puzzle.split(' ')); st.moves=0; st.hist=[]; st.undos=0; } return st; }
`;
fs.writeFileSync(path.join(ROOT,'src','levels.js'),js); fs.writeFileSync(path.join(ROOT,'tests','level_solutions.json'),JSON.stringify(LSOL));
console.log('levels.js written',LEVELS.length);
