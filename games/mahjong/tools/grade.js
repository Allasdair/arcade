// node tools/grade.js  →  src/levels.js
// Grades seeds with the blind bot and writes the 45 campaign recipes (with their puzzle positions and par times)
// and the Daily seed lists by grade. Everything is seeded, so running it again gives the same file.
const fs=require('fs'), path=require('path');
const {load}=require('../tests/lib.js'); const X=load(['layouts.js','engine.js','solver.js']);
const t0=Date.now();
// Find a seed for layout L whose grade is `grade` (bot plays without shuffles; in Fog it sees only free tiles).
function findSeed(L,diff,grade,tag,opts){ opts=opts||{}; let best=null;
  const want=X.GRADES.indexOf(grade);
  for(let k=0;k<400;k++){ const trap=Math.max(0,Math.min(1,X.GRADE_TRAP[grade]+((k%5)-2)*.08)); const seed=`${tag}|${k}`;
    const g=X.generate(L,diff,seed,trap); if(!g) continue; const gr=X.gradeBoard(L,g.faces,seed);
    if(opts.minRate&&gr.rate<opts.minRate) continue;
    const d=Math.abs(X.GRADES.indexOf(gr.grade)-want);
    if(d===0) return {seed,trap:Math.round(trap*100)/100,rate:gr.rate,grade:gr.grade,tries:k+1};
    if(!best||d<best.d) best={seed,trap:Math.round(trap*100)/100,rate:gr.rate,grade:gr.grade,d,tries:k+1}; }
  return best; }

const CAMPS=[{id:'garden',name:'Garden',xp:6,bonus:75},{id:'temple',name:'Temple',xp:10,bonus:150},{id:'summit',name:'Summit',xp:15,bonus:225}];
// [name, layout, grade, type, twist]   types: std, shaped, twist, puzzle, finale
const PLAN=[
 [['First Bloom','terrace','easy'],['Stepping Stones','steps','easy'],['Paper Lantern','lantern','easy'],['Heart','heart','easy','shaped'],['Morning Dew','pebble','easy'],
  ['Brick Path','brickwork','easy'],['Against the Clock','terrace','easy','twist',{ta:1}],['Diamond','diamond','easy','shaped'],['Courtyard Gate','courtyard','easy'],['Halfway','lantern','','puzzle'],
  ['Open Fan','fan','normal'],['Ring','ring','normal','shaped'],['Arbour','arches','normal'],['No Second Chances','stagger','easy','twist',{shuffles:0}],['The Bridge','bridge','normal','finale']],
 [['Quiet Hall','courtyard','normal'],['Temple Fan','fan','normal'],['Cloister','arches','normal'],['Cross','cross','normal','shaped'],['Bell Tower','stagger','normal'],
  ['Long Bridge','bridge','normal'],['No Going Back','arches','normal','twist',{undo:false}],['Hourglass','hourglass','normal','shaped'],['Gatehouse','fortress','normal'],['Deadlock','hourglass','','puzzle'],
  ['Cascade','cascade','normal'],['Twin Islands','islands','hard','shaped'],['Mosaic Floor','mosaic','hard'],['Incense Clock','courtyard','normal','twist',{ta:1}],['Temple Spire','spire','hard','finale']],
 [['High Pass','fortress','hard'],['Scree','mosaic','hard'],['Waterfall','cascade','hard'],['Great Ring','bigring','hard','shaped'],['Needle','spire','hard'],
  ['Citadel','citadel','hard'],['Cloud Line','fortress','normal','twist',{fog:1}],['Grand Cross','bigcross','hard','shaped'],['Pinnacle','pinnacle','hard'],['Gordian','citadel','','puzzle'],
  ['Twin Peaks','islands','hard'],['Great Heart','bigheart','expert','shaped'],['Thin Air','pinnacle','expert'],['Whiteout','cascade','normal','twist',{fog:1,shuffles:0}],['The Turtle','turtle','expert','finale']]];

// A puzzle: a board part-cleared along a winning line, at the point where the blind bot most often goes wrong.
function makePuzzle(L,diff,tag){ let best=null;
  for(let c=0;c<14;c++){ const seed=`${tag}|p${c}`, g=X.generate(L,diff,seed,.6); const rng=X.seedRng(seed+'|line');
    const gone=new Array(L.n).fill(0); let ref=g.order; const stop=Math.round(L.n/2*(.4+rng()*.2));
    for(let k=0;k<stop;k++){ // random free pair that keeps the board winnable (checked by the solver)
      const pr=X.shuffleArr(X.freePairs(L,gone,g.faces),rng); let done=false;
      for(const [a,b] of pr){ gone[a]=gone[b]=1; const r=X.solve(L,g.faces,gone,{limit:40000,ref}); if(r.win){ ref=r.line; done=true; break; } gone[a]=gone[b]=0; }
      if(!done) break; }
    const r=X.solve(L,g.faces,gone,{limit:200000,ref}); if(!r.win) continue;
    let w=0; const br=X.seedRng(seed+'|bot'); for(let t=0;t<20;t++) if(X.botPlay(L,g.faces,gone,br).win) w++;
    const rate=w/20; if(rate<.1) continue; // still fair for a careful player
    if(!best||rate<best.rate) best={seed,trap:.6,gone:gone.slice(),rate,left:gone.filter(x=>!x).length}; }
  return best; }
const bits=a=>{ let s=''; for(let i=0;i<a.length;i+=6){ let v=0; for(let j=0;j<6;j++) if(a[i+j]) v|=1<<j; s+=X.B64[v]; } return s; };

const LEVELS=[];
PLAN.forEach((list,ci)=>list.forEach(([name,lid,grade,type,tw],k)=>{ const L=X.layoutById(lid), diff=L.diff, n=k+1, id='GTS'[ci]+n;
  const twist=Object.assign({shuffles:'inf',undo:true,ta:0,fog:0},tw||{});
  let rec;
  if(type==='puzzle'){ const p=makePuzzle(L,diff,`MJL|${id}`); if(!p) throw new Error('no puzzle for '+id);
    rec={id,camp:ci,n,name,type,lid,diff,seed:p.seed,trap:p.trap,grade:'hard',rate:p.rate,gone:bits(p.gone),par:X.parTime(L,'hard',p.left),shuffles:0,undo:true,ta:0,fog:0};
    console.log(`${id.padEnd(4)} ${name.padEnd(20)} puzzle ${lid}, ${p.left} tiles left, bot ${Math.round(p.rate*100)}%`); }
  else { const f=findSeed(L,diff,grade,`MJL|${id}`,{minRate:twist.shuffles===0?.25:0});
    rec={id,camp:ci,n,name,type:type||'std',lid,diff,seed:f.seed,trap:f.trap,grade:f.grade,rate:f.rate,par:X.parTime(L,f.grade),...twist};
    console.log(`${id.padEnd(4)} ${name.padEnd(20)} ${lid.padEnd(10)} want ${grade.padEnd(6)} got ${f.grade.padEnd(6)} ${Math.round(f.rate*100)}% (${f.tries} tries) par ${rec.par}s`); }
  LEVELS.push(rec); }));

// Daily lists: [layout index, seed number, trap ×100], 60 per list
const DAILY_DAYS=[['easy','easy'],['normal','easy'],['normal','normal'],['hard','normal'],['hard','hard'],['hard','hard'],['expert','expert']]; // Monday first
const DAILY={};
for(const [diff,grade] of [...new Set(DAILY_DAYS.map(d=>d.join('|')))].map(s=>s.split('|'))){ const key=diff+'|'+grade, list=[]; const Ls=X.layoutsFor(diff);
  let miss=0; for(let k=0;list.length<60;k++){ const L=Ls[k%Ls.length], seed=`MJD|${key}|${k}`; const trap=X.GRADE_TRAP[grade];
    const g=X.generate(L,diff,seed,trap), gr=X.gradeBoard(L,g.faces,seed); if(gr.grade!==grade){ miss++; continue; }
    list.push([X.LAYOUTS.indexOf(L),k,Math.round(trap*100)]); }
  DAILY[key]=list; console.log(`daily ${key}: 60 boards (${miss} rejected)`); }

const js=`// Generated by tools/grade.js — do not edit by hand. Grades come from the blind bot (20 plays, no shuffles).
const CAMPS=${JSON.stringify(CAMPS)};
const LEVELS=${JSON.stringify(LEVELS).replace(/\},\{/g,'},\n{')};
// Daily: weekday (Monday first) → [size, grade]; lists of [layout index, seed number, trap×100]
const DAILY_DAYS=${JSON.stringify(DAILY_DAYS)};
const DAILY_LISTS=${JSON.stringify(DAILY)};
`;
fs.writeFileSync(path.join(__dirname,'..','src','levels.js'),js);
console.log('wrote src/levels.js',js.length,'bytes in',Math.round((Date.now()-t0)/1000),'s');
