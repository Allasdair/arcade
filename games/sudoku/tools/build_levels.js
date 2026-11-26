// node tools/build_levels.js  → src/levels.js
// The three campaigns (Novice, Adept, Master), 15 levels each, Sweep's design: basics at 1–3, variant levels at 4/8/12,
// standard puzzles of rising grade at 5/6/9/11/13, twists at 7/14, a technique puzzle at 10 and a finale at 15.
// Every level is a fixed puzzle from the bank. Technique puzzles are part-solved grids cut from a logic-solver trace,
// stopped exactly where the next step needs the campaign's key technique.
const fs=require('fs'), path=require('path');
const {load}=require('../tests/lib.js');
const X=load(['engine.js','solver.js','bank.js','core.js']);
const ROOT=path.join(__dirname,'..');

// puzzles of a variant × grade, easiest first (by the work beyond singles, then by par)
const sorted={};
function pool(v,gr){ const k=v+'|'+gr; if(sorted[k]) return sorted[k];
  return sorted[k]=X.bankList(v,gr).map(p=>{ const i=X.puzzleInfo(p); return Object.assign({},p,{par:i.par,counts:i.counts,score:score(i.counts)*10000+i.par}); }).sort((a,b)=>a.score-b.score); }
const score=c=>{ let s=0; for(const id in c){ const t=X.TECH_BY[id]; if(t.lv) s+=c[id]*t.w; } return s; };
const taken=new Set();
// q: 0 = the easiest of the pool … 1 = the hardest; the nearest puzzle not already used
// need: technique ids, one of which the puzzle must use (levels named after a technique)
function pick(v,gr,q,need){ const P=need?pool(v,gr).filter(p=>need.some(t=>p.counts[t])):pool(v,gr); let i=Math.round(q*(P.length-1));
  for(let d=0;d<P.length;d++) for(const j of [i+d,i-d]) if(j>=0&&j<P.length&&!taken.has(v+gr+P[j].k)){ taken.add(v+gr+P[j].k); return P[j]; }
  throw new Error('pool empty '+v+gr); }
const tight=par=>Math.max(60,Math.ceil(par*0.7/30)*30);

// ---------- technique puzzles ----------
// Walk each puzzle's logic trace; take the first state 30–70% solved where the easiest step is the technique
// (for a hidden single, also no naked single anywhere). The solved cells become givens; the notes are the solver's
// candidates at that point, so the next step really is the technique.
function techPuzzle(sources,tech,maxRest){ for(const [v,gr] of sources) for(const p of pool(v,gr)){ if(taken.has(v+gr+p.k)) continue;
    const g=X.geom(v,p.regions), r=X.logicSolve(g,X.toVals(p.givens),3,{trace:true});
    for(const T of r.trace){ const filled=T.vals.filter(x=>x).length/g.NN; if(filled<.3||filled>.7) continue; if(T.s.t!==tech) continue;
      const cand=Uint16Array.from(T.cand); if(tech==='hs'&&X.tNaked(g,T.vals,cand)) continue;
      // check from the player's side: legal candidates narrowed by the pre-filled notes give the same first step
      // the hidden-single level ships without notes (Novice), so it is checked from the legal candidates alone
      const noNotes=tech==='hs', notes=noNotes?new Array(g.NN).fill(0):T.cand.map((m,c)=>T.vals[c]?0:m);
      const st={variant:v,regions:p.regions,givens:X.toStr(T.vals),sol:X.puzzleInfo(p).sol,vals:T.vals.slice(),notes};
      const h=X.hintStep(st); if(!h||h.t!==tech) continue;
      const rest=X.logicSolve(g,T.vals,3,noNotes?{}:{cand:T.cand}); if(!rest.solved||rest.grade>maxRest) continue;
      taken.add(v+gr+p.k);
      return Object.assign({},p,{grade:X.GRADES[Math.max(rest.grade,X.TECH_BY[tech].lv)],givens:X.toStr(T.vals),notes:noNotes?null:notes,par:Math.max(60,X.parSeconds(v,rest.counts)),filled:Math.round(filled*100)}); } }
  throw new Error('no technique puzzle for '+tech); }

const CAMPS=[{id:'novice',name:'Novice',xp:6,bonus:75},{id:'adept',name:'Adept',xp:10,bonus:150},{id:'master',name:'Master',xp:15,bonus:225}];
// [name, type, variant, grade, quantile, twist, tip]
const PLAN=[
 [['First Steps','std','mini','easy',.1,null,'Each row, column and box holds 1 to 6 once. Look for the only spot a digit can go.'],
  ['Six by Six','std','mini','easy',.5,null,'Pick a digit and find the box where it can only go in one cell.'],
  ['Full Size','std','classic','easy',.05,null,'The full 9×9 grid: rows, columns and 3×3 boxes each hold 1 to 9 once.'],
  ['Small Print','variant','mini','normal',.2,null,'A Mini that needs one step beyond singles. Notes help here.'],
  ['Open Rows','std','classic','easy',.35,null,'Scan a digit across three boxes in a band to find where it must go.'],
  ['Box Clever','std','classic','easy',.6,null,'When a cell has only one digit left, place it. Fill notes can show you.'],
  ['Careful Now','twist','classic','easy',.75,'limit','Twist: a 4th mistake ends the level. Take your time.'],
  ['Crossroads','variant','diag','easy',.4,null,'New: both long diagonals also hold 1 to 9 once.'],
  ['Pointing the Way','std','classic','normal',.05,null,'Normal puzzles need notes. Look for a digit stuck in one row of a box.'],
  ['Only Here','tech','classic','easy',0,null,'Technique: hidden single. One digit has only one possible cell in a box, row or column.',['hs']],
  ['Pairs','std','classic','normal',.3,null,'Two cells in a house that share the same two notes lock those digits in.'],
  ['Pocket Puzzle','variant','mini','normal',.7,null,'A trickier Mini. Pointing works in 2×3 boxes too.'],
  ['Steady','std','classic','normal',.55,null,'Fill notes, then clear them as you place digits.'],
  ['Pen Only','twist','classic','easy',.95,'nonotes','Twist: no notes on this level. Keep the candidates in your head.'],
  ['Graduation','final','classic','normal',1,null,'The hardest Normal puzzle in Novice. Clear it to graduate.']],
 [['Next Step','std','classic','normal',.4,null,'Welcome to Adept: Normal and Hard puzzles, with Diagonal and Jigsaw.'],
  ['Pointers','std','classic','normal',.65,null,'Pointing and claiming: a digit locked into one line of a box, or one box of a line.'],
  ['Pair Up','std','classic','normal',.8,null,'Hidden pairs: two digits that can only go in the same two cells.'],
  ['Diagonal Lines','variant','diag','normal',.4,null,'Diagonals are houses too: pairs and pointing work along them.'],
  ['Triples','std','classic','hard',.05,null,'Hard puzzles need bigger patterns: triples, X-Wings and XY-Wings.'],
  ['Wings','std','classic','hard',.2,null,'XY-Wing: a cell with two notes and two cells it sees, sharing a third digit.'],
  ['No Safety Net','twist','classic','normal',.9,'nocheck','Twist: mistake check is off. Wrong digits only show as clashes.'],
  ['Odd Shapes','variant','jigsaw','normal',.4,null,'New: Jigsaw. The regions are irregular, outlined in bold.'],
  ['Corner to Corner','std','classic','hard',.35,null,'X-Wing: in two rows, a digit sits only in the same two columns.'],
  ['Pointing','tech','classic','normal',0,null,'Technique: pointing. In one box, a digit sits only in one row or column, so it comes out of the rest of that line.',['pt']],
  ['Hard Graft','std','classic','hard',.5,null,'When singles run out, scan for pairs, then triples, then wings.'],
  ['Patchwork','variant','jigsaw','hard',.4,null,'A Hard Jigsaw. Odd regions make pointing and claiming more common.'],
  ['Deep Water','std','classic','hard',.7,null,'Keep your notes tidy: one stray note can hide a pattern.'],
  ['Against the Clock','twist','classic','hard',.6,'tight','Twist: a tight par time for the second star.'],
  ['Adept\'s Trial','final','classic','hard',1,null,'The hardest Hard puzzle in Adept. Clear it to finish the campaign.']],
 [['Master Class','std','classic','hard',.8,null,'Master: Hard and Expert across every variant.'],
  ['Into the Deep','std','classic','expert',.05,null,'Expert puzzles need Swordfish, XYZ-Wings or colouring.'],
  ['Long Chains','std','classic','expert',.15,null,'Simple colouring: follow a digit through cells where it has only two spots.'],
  ['Jigsaw Master','variant','jigsaw','hard',.85,null,'A tough Jigsaw. Check every region for locked digits.'],
  ['Swordfish','std','classic','expert',.3,null,'A Swordfish is an X-Wing across three rows and three columns.'],
  ['Three Corners','std','classic','expert',.42,null,'XYZ-Wing: a three-note cell and two two-note cells it sees.'],
  ['Three Strikes','twist','classic','hard',.92,'limit','Twist: a 4th mistake ends the level.'],
  ['Double Cross','variant','diag','expert',.5,null,'An Expert Diagonal. The diagonals add colouring chains.'],
  ['Pattern Hunter','std','classic','expert',.55,null,'If you\'re stuck, colour a digit with only two spots in many houses.'],
  ['X Marks','tech','classic','hard',0,null,'Technique: X-Wing. In two rows a digit sits only in the same two columns, so it comes out of the rest of those columns.',['xw']],
  ['Endgame','std','classic','expert',.68,null,'Expert patterns can show up late. Keep looking.'],
  ['Shattered','variant','jigsaw','expert',.6,null,'An Expert Jigsaw. The hardest shapes in the game.'],
  ['Summit','std','classic','expert',.82,null,'Nearly there. One of the toughest puzzles in the bank.'],
  ['Blindfold','twist','classic','expert',.45,'nocheck','Twist: mistake check is off.'],
  ['Grandmaster','final','*','expert',1,null,'The hardest Expert puzzle in the bank. Clear it to master Sudoku.']]];

const LEVELS=[];
// the technique puzzles and finales first, so the standard levels don't take their puzzles
// the hidden single comes from Normal puzzles (Easy ones always offer a naked single too); what's left must stay within reach
const techSrc={hs:[['classic','normal']],pt:[['classic','normal']],xw:[['classic','hard'],['jigsaw','hard'],['diag','hard']]}, techMax={hs:0,pt:1,xw:2};
const pre={};
PLAN.forEach((camp,ci)=>camp.forEach((row,i)=>{ if(row[1]==='tech') pre[ci+'|'+i]=techPuzzle(techSrc[row[7][0]],row[7][0],techMax[row[7][0]]); }));
PLAN.forEach((camp,ci)=>camp.forEach((row,i)=>{ if(row[1]!=='final') return;
  if(row[2]==='*'){ const all=['classic','diag','jigsaw'].flatMap(v=>pool(v,'expert').map(p=>({v,p}))).sort((a,b)=>b.p.score-a.p.score); const best=all[0].p; taken.add(all[0].v+'expert'+best.k); pre[ci+'|'+i]=best; }
  else pre[ci+'|'+i]=pick(row[2],row[3],1); }));
const NEED={'Pairs':['np'],'Pair Up':['hp'],'Triples':['nt','ht'],'Wings':['xy'],'Corner to Corner':['xw'],'Long Chains':['sc'],'Swordfish':['sf'],'Three Corners':['xyz'],'Pointing the Way':['pt']};
PLAN.forEach((camp,ci)=>camp.forEach((row,i)=>{ const [name,type,v0,gr,q,twist,tip,tech]=row; const p=pre[ci+'|'+i]||pick(v0,gr,q,NEED[name]);
  const L={id:'nam'[ci]+(i+1),camp:ci,n:i+1,name,type,variant:p.variant,grade:p.grade,k:p.k,givens:p.givens,regions:p.regions||null,par:twist==='tight'?tight(p.par):p.par,twist:twist||null,tech:tech?tech[0]:null,tip};
  if(p.notes) L.notes=p.notes; if(p.filled) L.filled=p.filled; LEVELS.push(L); }));
const js=`// Generated by tools/build_levels.js from src/bank.js. Do not edit by hand.
// The three campaigns: 15 levels each. type: std, variant, twist, tech (technique puzzle) or final.
// twist: nonotes (Notes off), limit (a 4th mistake fails), nocheck (mistake check off) or tight (a tight par time).
const CAMPS=${JSON.stringify(CAMPS)};
const LEVELS=[
${LEVELS.map(L=>' '+JSON.stringify(L)).join(',\n')}];
`;
fs.writeFileSync(path.join(ROOT,'src','levels.js'),js);
console.log(`src/levels.js: ${LEVELS.length} levels, ${(js.length/1024).toFixed(1)} KB`);
for(const L of LEVELS) console.log(`  ${L.id.padEnd(4)} ${L.name.padEnd(18)} ${L.type.padEnd(7)} ${X.VARIANTS[L.variant].name.padEnd(9)} ${L.grade.padEnd(7)} par ${Math.floor(L.par/60)}:${String(L.par%60).padStart(2,'0')}${L.twist?' · '+L.twist:''}${L.tech?' · '+L.tech+' at '+L.filled+'%':''}`);
