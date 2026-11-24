// node tests/run.js   (Node only; QUICK=1 for short sims: 40 brute-force positions and 20 games a pairing)
const fs=require('fs'), path=require('path'), {execFileSync}=require('child_process');
const {load,ok,eq,res}=require('./lib.js'); const L=load(); const QUICK=!!process.env.QUICK; const t0=Date.now();
const ROOT=path.join(__dirname,'..'), sec=n=>console.log('\n# '+n);
const PIN={'2026-11-24':'95fb9c1f','2027-01-01':'5b7a5c83'}; // Daily fingerprints (board + bag order), pinned
const enable=fs.readFileSync(path.join(ROOT,'data','enable1.txt'),'utf8').split(/\r?\n/).map(w=>w.trim().toUpperCase()).filter(Boolean);
// The banned list is private (not in the public repo). With it (src/banned.js, or TILECRAFT_BANNED=<path>) the tests check
// every banned word directly; without it they check the shipped dictionary against pinned fingerprints instead.
const BANNED_FILE=process.env.TILECRAFT_BANNED||path.join(ROOT,'src','banned.js');
const BANNED=fs.existsSync(BANNED_FILE)?require(path.resolve(BANNED_FILE)).BANNED:null;
const REMOVED={count:257, sha256:'8d8aeea9b5297e540239ca13b60beb94bc2fbfdd78edf7f9ac639da1535fc70d'}; // ENABLE words (2-19 letters) left out by the filter
const play=cfg=>{ const st=L.newGame(cfg); while(!st.over) L.aiTurn(st,st.cfg.players[st.turn].ai); return st; };
const T=(i,ch,bl)=>[i,ch,bl?1:0];
// a small test game: Medium square board with a known seed; put words on the board directly
function setup(o){ const st=L.newGame(Object.assign({size:'medium',boardSeed:42,bagSeed:42,players:[{name:'A',ai:null},{name:'B',ai:null}],first:0},o||{})); return st; }
const B42=L.makeBoard('medium','square',42), C=7*15+7; // the start square
const row=(st,i,w)=>w.split('').forEach((c,k)=>{ st.cells[i+k]=c; }), col=(st,i,w)=>w.split('').forEach((c,k)=>{ st.cells[i+k*15]=c; });
const giveRack=(st,p,r)=>{ st.racks[p]=r.split(''); };

sec('dictionary');
{ const fit=enable.filter(w=>w.length>=2&&w.length<=19), removed=fit.filter(w=>BANNED?BANNED.has(w):!L.isWord(w)).sort();
  const want=new Set(fit.filter(w=>!removed.includes(w)));
  eq(L.DICT_WORDS,want.size,'word count = ENABLE − banned − words over 19 letters');
  eq(removed.length,REMOVED.count,'the filter leaves out 257 ENABLE words');
  eq(require('crypto').createHash('sha256').update(removed.join('\n')).digest('hex'),REMOVED.sha256,'the words left out match the pinned fingerprint');
  if(!BANNED) console.log('  (private banned list not present: checked by fingerprint)');
  ok(enable.length===172823,'ENABLE has 172,823 words');
  let miss=0; for(const w of want) if(!L.isWord(w)) miss++; ok(miss===0,`the DAWG holds every word (${miss} missing)`);
  if(BANNED){ let bad=0; for(const w of BANNED) if(L.isWord(w)) bad++; ok(bad===0,'no banned word is valid'); }
  for(const w of ['GRAPE','SPICE','SPICY','CUMIN','HOMOGENEOUS','FAGOTING','PISSOIR','SCRAPE','DRAPES','COCKTAIL','TITMOUSE','ASSASSIN','SHITTAH','DICKENS','KIKOI','RAPESEED'].filter(w=>enable.includes(w.toUpperCase())))
    ok(L.isWord(w),`${w} stays valid (it only contains a banned word)`);
  const rng=L.seedRng('nonwords'); let n=0, wrong=0; while(n<100000){ const len=2+Math.floor(rng()*9); let w=''; for(let i=0;i<len;i++) w+=L.ALPHA[Math.floor(rng()*26)]; n++; if(L.isWord(w)!==want.has(w)) wrong++; }
  ok(wrong===0,`the DAWG agrees with a Set on 100,000 random strings (${wrong} wrong)`);
  ok(!L.isWord('A')&&!L.isWord(''),'one-letter words and empty strings are not words');
  const js=fs.readFileSync(path.join(ROOT,'src','dict.js'),'utf8'); ok(js.length<700*1024,`dict.js under 700 KB (${Math.round(js.length/1024)} KB)`); }

sec('letters');
{ const py=JSON.parse(execFileSync('python3',[path.join(ROOT,'tools','letters.py'),'--json'],{encoding:'utf8'}));
  for(const c of L.ALPHA){ eq(L.LETTERS[c],[py.values[c],py.small[c],py.medium[c],py.large[c]],`${c}: engine table = tools/letters.py from ENABLE`); }
  const KICKOFF={E:[1,9,12,19],A:[1,6,9,13],I:[1,5,8,12],R:[1,5,7,11],O:[1,4,7,10],S:[1,3,5,7],N:[1,4,5,9],T:[1,4,5,8],L:[1,4,5,8],D:[2,3,4,6],U:[2,2,4,6],C:[2,2,3,5],G:[3,2,3,4],P:[3,2,3,4],M:[3,2,3,4],H:[3,1,2,4],B:[3,1,2,3],Y:[4,1,2,3],F:[4,1,2,2],K:[4,1,1,2],W:[5,1,1,2],V:[5,1,1,1],Z:[7,1,1,1],X:[7,1,1,1],J:[8,1,1,1],Q:[10,1,1,1]};
  eq(L.LETTERS,KICKOFF,'the table matches kickoff section 4 exactly');
  ok(L.ALPHA.split('').every(c=>L.LETTERS[c][1]>=1&&L.LETTERS[c][2]>=1&&L.LETTERS[c][3]>=1),'every letter has at least 1 tile in every bag');
  eq(L.SIZE_IDS.map(s=>L.bagTiles(s,L.DEF_MODS).length),[70,100,150],'bags hold 70 / 100 / 150 tiles');
  eq(L.SIZE_IDS.map(s=>L.bagTiles(s,L.DEF_MODS).filter(t=>t==='?').length),[2,2,3],'blanks 2 / 2 / 3 by default');
  const vow=['A','E','I','O','U'].reduce((a,c)=>a+L.LETTERS[c][2],0)/98; ok(vow>.39&&vow<.43,`vowels ${(vow*100).toFixed(1)}% of Medium letters (about 41%)`);
  eq(L.ALPHA.split('').reduce((a,c)=>a+L.LETTERS[c][0]*L.LETTERS[c][2],0),186,'the Medium bag holds 186 points');
  // the original game's English table (value, count), for the difference check only
  const ORIG={A:[1,9],B:[3,2],C:[3,2],D:[2,4],E:[1,12],F:[4,2],G:[2,3],H:[4,2],I:[1,9],J:[8,1],K:[5,1],L:[1,4],M:[3,2],N:[1,6],O:[1,8],P:[3,2],Q:[10,1],R:[1,6],S:[1,4],T:[1,6],U:[1,4],V:[4,2],W:[4,2],X:[8,1],Y:[4,2],Z:[10,1]};
  const diff=L.ALPHA.split('').filter(c=>L.LETTERS[c][0]!==ORIG[c][0]||L.LETTERS[c][2]!==ORIG[c][1]).length;
  ok(diff>=10,`${diff} of 26 letters differ from the original game's table (at least 10)`); eq(diff,18,'18 letters differ, as planned');
  const rare=L.bagTiles('medium',Object.assign({},L.DEF_MODS,{rare:true})); eq(['J','Q','X','Z'].map(c=>rare.filter(t=>t===c).length),[2,2,2,2],'More rare letters adds a J, Q, X and Z');
  eq([0,2,4].map(b=>L.bagTiles('medium',Object.assign({},L.DEF_MODS,{blanks:b})).filter(t=>t==='?').length),[0,2,4],'the Blanks modifier sets 0 / 2 / 4'); }

sec('boards');
{ let checked=0;
  for(const size of L.SIZE_IDS) for(const shape of L.SHAPE_IDS) for(let s=1;s<=(QUICK?8:25);s++){ const B=L.makeBoard(size,shape,s*977), n=B.n, c=(n-1)/2, tag=`${size} ${shape} #${s}`; checked++;
    const rot=i=>{ const x=i%n-c, y=((i/n)|0)-c; return (x+c)*n+(-y+c); };
    let sym=true; for(let i=0;i<B.N;i++) if(B.prem[i]!==B.prem[rot(i)]||B.mask[i]!==B.mask[rot(i)]) sym=false; ok(sym,`${tag}: symmetric under 90° rotation`);
    ok(B.mask[B.start]&&B.prem[B.start]===0&&B.start===c*n+c,`${tag}: the start square is the centre, playable, no multiplier`);
    // all playable squares connected
    const seen=new Set([B.start]), q=[B.start]; while(q.length){ const i=q.pop(), x=i%n, y=(i/n)|0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const X=x+dx, Y=y+dy, j=Y*n+X; if(X>=0&&Y>=0&&X<n&&Y<n&&B.mask[j]&&!seen.has(j)){ seen.add(j); q.push(j); } } }
    ok(seen.size===B.playable,`${tag}: every playable square is connected`);
    const cnt=[0,0,0,0,0], at={}; for(let i=0;i<B.N;i++){ const p=B.prem[i]; cnt[p]++; (at[p]=at[p]||[]).push(i); if(p) ok(B.mask[i],`${tag}: premiums only on playable squares`); }
    for(const t of [1,2,3,4]){ const al=L.premAllowed(t,B.playable); ok(al.includes(cnt[t])||(shape!=='square'&&cnt[t]%4===0&&cnt[t]<Math.max(...al)),`${tag}: ${L.PREM_SHORT[t]} count ${cnt[t]} (allowed ${al.join('/')})`); }
    if(shape==='square'&&size==='medium') ok(cnt[4]>=6&&cnt[4]<=8&&cnt[3]>=14&&cnt[3]<=18&&cnt[2]>=10&&cnt[2]<=14&&cnt[1]>=20&&cnt[1]<=26,`${tag}: Medium counts 3W 6–8, 2W 14–18, 3L 10–14, 2L 20–26`);
    const ch=(a,b)=>L.cheb(n,a,b);
    ok((at[4]||[]).every(i=>ch(i,B.start)>4),`${tag}: no 3× Word within 4 squares of the centre`);
    ok((at[4]||[]).every(a=>(at[4]||[]).every(b=>a===b||ch(a,b)>=4)),`${tag}: no two 3× Word squares closer than 4`);
    const W=[...(at[3]||[]),...(at[4]||[])]; ok(W.every(a=>W.every(b=>a===b||ch(a,b)>1)),`${tag}: no two Word squares next to each other`);
    ok([2,3,4].every(t=>(at[t]||[]).every(i=>ch(i,B.start)>1)),`${tag}: only 2× Letter next to the start square`); }
  const a=L.makeBoard('large','ring',555), b=(L.BOARDS.clear(),L.makeBoard('large','ring',555)); ok(a!==b&&a.prem.join()===b.prem.join()&&a.mask.join()===b.mask.join(),'the same seed rebuilds the same board');
  ok(L.makeBoard('medium','square',1).prem.join()!==L.makeBoard('medium','square',2).prem.join(),'different seeds give different boards'); }

sec('rules: placement and words');
{ let st=setup(); giveRack(st,0,'CATSDOG');
  let R=L.evalPlay(st,[T(C,'C'),T(C+15+1,'A')]); eq(R.err,'Place tiles in one row or column','tiles must share a row or column');
  R=L.evalPlay(st,[T(C,'C'),T(C+2,'T')]); eq(R.err,'Leave no gaps','no gaps between placed tiles');
  R=L.evalPlay(st,[T(C+1,'C'),T(C+2,'A'),T(C+3,'T')]); eq(R.err,'The first word must cover the star','the first move covers the start square');
  R=L.evalPlay(st,[T(C,'A')]); eq(R.err,'Words need at least 2 letters','a single tile on an empty board is not a word');
  R=L.evalPlay(st,[T(C-1,'C'),T(C,'A'),T(C+1,'T')]); ok(R.ok&&R.main.w==='CAT','CAT across the star is legal');
  R=L.evalPlay(st,[T(C-15,'C'),T(C,'A'),T(C+15,'T')]); ok(R.ok&&R.main.w==='CAT','CAT down through the star is legal');
  R=L.evalPlay(st,[T(C-1,'X'),T(C,'Q'),T(C+1,'Z')]); ok(!R.ok&&R.err.startsWith('Not in the word list')&&R.words[0].ok===false,'an invalid word is refused and marked ✗');
  row(st,C-1,'CAT'); giveRack(st,0,'SDOGEAR');
  R=L.evalPlay(st,[T(C+30,'D'),T(C+31,'O')]); eq(R.err,'Connect to the tiles on the board','later moves must touch the board');
  R=L.evalPlay(st,[T(C+2,'S')]); ok(R.ok&&R.main.w==='CATS','one tile extends a word');
  R=L.evalPlay(st,[T(C-1-15,'S'),T(C-1+15,'O')]); ok(!R.ok&&R.main&&R.main.w==='SCO','tiles either side of an existing tile make one word through it (SCO)');
  R=L.evalPlay(st,[T(C+15,'D'),T(C+16,'O')]); ok(R.ok&&R.words.length===3&&R.words.every(w=>w.ok),`DO under AT forms DO, AD and TO (${R.words.map(w=>w.w).join(',')})`);
  R=L.evalPlay(st,[T(C+14,'O'),T(C+15,'D')]); ok(!R.ok&&R.words.find(w=>w.w==='CO').ok===false,'a bad crossing word (CO) fails the move and is marked ✗');
  R=L.evalPlay(st,[T(C-15,'G'),T(C+15,'D')]); ok(R.ok&&R.main.w==='GAD','existing tiles fill gaps (G_D through A)');
  R=L.evalPlay(st,[T(C,'Z')]); eq(R.err,'Place tiles on empty squares','an occupied square is refused'); }

sec('rules: scoring');
{ const B=B42, n=15; let st=setup(), sc=w=>w.split('').reduce((a,c)=>a+L.valOf(c),0);
  // find squares of each kind on row 7..12 to test multipliers
  const find=t=>{ for(let i=0;i<B.N;i++) if(B.prem[i]===t&&L.cheb(n,i,B.start)>1) return i; return -1; };
  const tw=find(4), dw=find(3), tl=find(2), dl=find(1);
  // a lone word placed straight onto a premium square: build a one-off board where the start rule is satisfied by a tile already there
  const lone=(cell,word,dir)=>{ const s=setup(); s.cells[0]='Z'; return {s,R:L.evalPlay(s,word.split('').map((c,k)=>T(cell+k*(dir?15:1),c))) }; };
  // place AT with A on the premium: find a free square next to it
  const at=(cell)=>{ const x=cell%n, d=x<n-1?0:1, s=setup(); s.cells[B.start]='E'; s.cells[cell+(d?n:1)]='T'; s.cells[cell+2*(d?n:1)]='E'; // _TE: placing A makes ATE
    return {s,d}; };
  for(const [cell,name,mult] of [[dl,'2× Letter','L2'],[tl,'3× Letter','L3'],[dw,'2× Word','W2'],[tw,'3× Word','W3']]){ if(cell<0) continue;
    const {s,d}=at(cell); s.cells[B.start]=''; s.cells[0]='Z'; // connect via existing tiles only
    const R=L.evalPlay(s,[T(cell,'A')]); const base=L.valOf('A'), rest=L.valOf('T')+L.valOf('E');
    const want=mult==='L2'?base*2+rest:mult==='L3'?base*3+rest:mult==='W2'?(base+rest)*2:(base+rest)*3;
    ok(R.ok&&R.score===want,`${name}: ATE scores ${R.score} (want ${want})`);
    // premiums only count on the turn a tile is placed: with A already on the square, adding S scores plain
    s.cells[cell]='A'; const end=cell+3*(d?n:1); if(end<B.N&&!s.cells[end]&&B.mask[end]&&B.prem[end]===0){ const R2=L.evalPlay(s,[T(end,'S')]); ok(R2.ok&&R2.score===sc('ATES'),`${name}: premiums count only on the turn a tile is placed (${R2.score})`); } }
  // two Word squares multiply together
  { let found=false; for(let a=0;a<B.N&&!found;a++){ if(B.prem[a]<3) continue; for(const d of [1,15]){ for(let len=3;len<=8&&!found;len++){ const cells=[]; for(let k=0;k<len;k++) cells.push(a+k*d);
          if(d===1&&((cells[len-1]/n)|0)!==((a/n)|0)) break; if(cells[len-1]>=B.N) break; const ws=cells.filter(c=>B.prem[c]>=3); if(ws.length!==2||B.prem[cells[len-1]]<3) continue;
          const s=setup(); s.cells[0]='Z'; const word='ABCDEFGH'.slice(0,len); s.cells[cells[1]]=word[1]; // connect with an existing middle tile, so it's not counted as placed
          if(B.prem[cells[1]]>=3) continue; const tiles=cells.filter((c,k)=>k!==1).map((c,k2)=>[c,word[cells.indexOf(c)],0]);
          const R=L.evalPlay(s,tiles); const m=ws.reduce((x,c)=>x*L.WM[B.prem[c]],1); let lsum=0; cells.forEach((c,k)=>{ const v=L.valOf(word[k]); lsum+=k===1?v:v*L.LM[B.prem[c]]; });
          ok(R.words[0].sc===lsum*m,`two Word squares multiply together (×${m}: ${R.words[0].sc})`); found=true; } } } ok(found,'found a line through two Word squares'); }
  // blanks score 0
  { const s=setup(); const R=L.evalPlay(s,[T(C-1,'C'),T(C,'A',1),T(C+1,'T')]); ok(R.ok&&R.score===(L.valOf('C')+L.valOf('T'))*L.WM[B.prem[C]],`a blank scores 0 (${R.score})`); }
  // Full Rack +40
  { const s=setup(); giveRack(s,0,'RETAINS'); const tiles='RETAINS'.split('').map((c,k)=>T(C-3+k,c)); const R=L.evalPlay(s,tiles); let base=0, wm=1; tiles.forEach(([i,c])=>{ base+=L.valOf(c)*L.LM[B.prem[i]]; wm*=L.WM[B.prem[i]]; });
    ok(R.ok&&R.full&&R.score===base*wm+40,`Full Rack adds +40 (${R.score})`); }
  // apply a move: rack, refill, score, turn
  { const s=setup(); giveRack(s,0,'CATQQQQ'); const bag=s.bag.length; const r=L.applyMove(s,{t:'p',tiles:[T(C-1,'C'),T(C,'A'),T(C+1,'T')]}); ok(r.ok&&s.racks[0].length===7&&s.bag.length===bag-3&&s.turn===1&&s.scores[0]===r.score,'a play scores, refills the rack and passes the turn');
    s.racks[1]=['Q','Q','Q','Q','Q','Q','Q']; const r2=L.applyMove(s,{t:'p',tiles:[T(C+2,'S')]}); ok(!r2.ok&&/rack/.test(r2.err),'tiles not on the rack are refused'); } }

sec('rules: swap, pass and the end of the game');
{ let s=setup(); const r0=s.racks[0].slice(); let r=L.applyMove(s,{t:'x',tiles:r0.slice(0,3)}); ok(r.ok&&s.racks[0].length===7&&s.bag.length===100-14&&s.scores[0]===0,'swap returns tiles and draws the same number, scoring 0');
  s=setup(); s.bag=s.bag.slice(0,6); r=L.applyMove(s,{t:'x',tiles:[s.racks[0][0]]}); ok(!r.ok&&/7 tiles/.test(r.err),'swap needs 7+ tiles in the bag');
  s=setup({mods:{swaps:false}}); r=L.applyMove(s,{t:'x',tiles:[s.racks[0][0]]}); ok(!r.ok&&/off/.test(r.err),'Swaps: not allowed');
  s=setup(); for(let i=0;i<6;i++) L.applyMove(s,{t:'-'}); ok(s.over&&s.result.reason==='scoreless','six scoreless turns in a row end the game');
  s=setup(); for(let i=0;i<5;i++) L.applyMove(s,i===2?{t:'x',tiles:[s.racks[s.turn][0]]}:{t:'-'}); ok(!s.over,'five scoreless turns don\'t'); L.applyMove(s,{t:'-'}); ok(s.over,'swaps count as scoreless turns');
  // going out: bag empty, player 0 plays their last tiles
  s=setup(); s.bag=[]; s.racks[0]=['C','A','T']; s.racks[1]=['Q','Z']; L.applyMove(s,{t:'p',tiles:[T(C-1,'C'),T(C,'A'),T(C+1,'T')]});
  ok(s.over&&s.result.out===0,'the game ends when the bag is empty and a player uses all their tiles');
  eq(s.result.adj,[17,-17],'leftover tiles: the other player loses their rack value and the player who went out gains it');
  s=setup(); for(let i=0;i<6;i++) L.applyMove(s,{t:'-'}); const lv=s.racks.map(L.rackSum); eq(s.result.adj,lv.map(v=>-v),'with nobody out, each player loses their own leftover value');
  s=setup(); s.scores=[50,50]; for(let i=0;i<6;i++) L.applyMove(s,{t:'-'}); s.racks; ok(s.result.winner===(s.result.final[0]>s.result.final[1]?0:s.result.final[1]>s.result.final[0]?1:-1),'highest final score wins; a tie is a draw');
  s=setup({players:[{name:'A'}],solo:true,turns:3}); for(let i=0;i<3;i++) L.applyMove(s,{t:'-'}); ok(s.over&&s.result.reason!=='out','a solo game ends after its turns'); }

sec('modifiers');
{ let s=setup({mods:{minLen:4}}); let R=L.evalPlay(s,[T(C-1,'C'),T(C,'A'),T(C+1,'T')]); ok(!R.ok&&/at least/.test(R.err),'minimum length 4 refuses a 3-letter main word');
  R=L.evalPlay(s,[T(C-1,'C'),T(C,'A'),T(C+1,'T'),T(C+2,'S')]); ok(R.ok,'…and allows a 4-letter one');
  row(s,C-1,'CATS'); R=L.evalPlay(s,[T(C+15,'D'),T(C+16,'O')]); ok(!R.ok&&/at least/.test(R.err),'the minimum applies to the main word (DO is 2)');
  { const w4=L.ALPHA.split('').flatMap(a=>L.ALPHA.split('').map(b=>a+b)).filter(x=>L.isWord('A'+x[0])&&L.isWord('T'+x[1])).flatMap(x=>L.ALPHA.split('').flatMap(c=>L.ALPHA.split('').map(d=>x+c+d))).find(w=>L.isWord(w)&&L.isWord('S'+w[2])&&w[3]);
    R=L.evalPlay(s,w4.split('').map((c,k)=>T(C+15+k,c))); ok(R.ok&&R.words.filter(w=>w.w.length===2).length>=2,`crossing words can still be 2 letters (main word ${w4})`); }
  s=setup({mods:{maxLen:5}}); row(s,C-2,'TRAIN'); R=L.evalPlay(s,[T(C+3,'S')]); ok(!R.ok&&/at most/.test(R.err),'maximum 5 refuses a 6-letter word');
  s=setup({mods:{maxLen:5}}); row(s,C,'AB'); col(s,C+2-75,'BREAD'); R=L.evalPlay(s,[T(C+2,'S')]); ok(!R.ok&&R.main.w==='ABS'&&R.words.some(w=>!w.ok&&w.w==='BREADS'),'maximum length applies to every word formed (crossing BREADS is 6)');
  ok(!L.allMoves(s,['S','E','R']).some(m=>L.evalPlay(s,L.moveTiles(s,m)).words.some(w=>w.w.length>5)),'the move generator respects the maximum on crossing words');
  const s2=setup({mods:{norepeat:true}}); giveRack(s2,0,'CATEEEE'); L.applyMove(s2,{t:'p',tiles:[T(C-1,'C'),T(C,'A'),T(C+1,'T')]}); s2.racks[1]=['C','T','S','E','E','E','E'];
  R=L.evalPlay(s2,[T(C-15,'C'),T(C+15,'T')]); ok(!R.ok&&/Already played/.test(R.err),'no repeat words: CAT can\'t be played again as a main word');
  { const s3=setup({mods:{norepeat:true}}); s3.cells[C]='A'; s3.played=['CAT','AT']; R=L.evalPlay(s3,[T(C-15,'C'),T(C+15,'T'),T(C+30,'S')]); ok(R.ok&&R.main.w==='CATS','a longer main word is fine');
    s3.cells.fill(''); col(s3,C-15,'CA'); s3.played=['CAT']; s3.cells[C+15]=''; const R3=L.evalPlay(s3,[T(C+15,'T')]); ok(!R3.ok,'one tile making a repeated main word is refused'); }
  { const s4=setup({mods:{norepeat:true}}); row(s4,C-1,'CAT'); s4.played=['CAT','TA']; const R4=L.evalPlay(s4,[T(C+16,'A'),T(C+17,'X')]); ok(!R4.ok||R4.words.slice(1).every(w=>!/Already/.test(R4.err)),'crossing words are exempt from No repeats'); }
  const gen=L.allMoves(s2,s2.racks[1]); ok(!gen.some(m=>m.w==='CAT'),'the move generator never repeats a main word under No repeats');
  s=setup({shape:'cross',size:'small'}); const B=L.boardOf(s.cfg); const hole=B.mask.indexOf(0); R=L.evalPlay(s,[T(hole,'A')]); ok(!R.ok,'shaped boards refuse tiles on missing squares');
  ok(L.allMoves(L.newGame({size:'small',shape:'ring',boardSeed:3,bagSeed:3}),['R','E','T','A','I','N','S']).every(m=>L.moveTiles({cfg:{size:'small',shape:'ring',boardSeed:3}},m).every(t=>B.mask!==null)),'moves on shaped boards');
  for(const shape of L.SHAPE_IDS){ const g=play({size:'small',shape,boardSeed:11,bagSeed:12,players:[{name:'A',ai:'hard'},{name:'B',ai:'hard'}]}); const BB=L.boardOf(g.cfg);
    ok(g.over&&g.cells.every((c,i)=>!c||BB.mask[i]),`a full ${shape} game only uses playable squares`); }
  // timer: the interface passes with why:'time' after recalling tiles; the engine records it as a pass
  s=setup({mods:{timer:30}}); const r=L.applyMove(s,{t:'-',why:'time'}); ok(r.ok&&s.moves[0].t==='-'&&s.moves[0].why==='time'&&s.turn===1,'timer: a timed-out turn is a pass'); }

sec('move generator');
{ const brute=(st,rack)=>{ const B=L.boardOf(st.cfg), n=B.n, out=new Map(), empty=L.boardEmpty(st);
    const perms=(arr,k)=>{ const res=[], used=new Array(arr.length).fill(false), cur=[]; const go=()=>{ if(cur.length===k){ res.push(cur.slice()); return; } const seen=new Set(); for(let i=0;i<arr.length;i++){ if(used[i]||seen.has(arr[i])) continue; seen.add(arr[i]); used[i]=true; cur.push(arr[i]); go(); cur.pop(); used[i]=false; } }; go(); return res; };
    for(let k=1;k<=rack.length;k++){ const ps=perms(rack,k);
      for(const d of (k===1?[0]:[0,1])) for(let s=0;s<B.N;s++){ if(st.cells[s]||!B.mask[s]) continue; const cells=[]; let i=s, good=true; const step=d?n:1;
        while(cells.length<k){ if(i>=B.N||(d===0&&((i/n)|0)!==((s/n)|0))||(!B.mask[i]&&!st.cells[i])){ good=false; break; } if(!st.cells[i]) cells.push(i); i+=step; }
        if(!good) continue;
        const near=cells.some(c=>{ const x=c%n,y=(c/n)|0; return (x>0&&st.cells[c-1])||(x<n-1&&st.cells[c+1])||(y>0&&st.cells[c-n])||(y<n-1&&st.cells[c+n]); })||cells.some((c,j)=>j&&c-cells[j-1]!==step);
        if(empty?!cells.includes(B.start):!near) continue;
        for(const p of ps){ const bi=p.map((t,j)=>t==='?'?j:-1).filter(j=>j>=0);
          const fills=bi.length===0?[[]]:bi.length===1?L.ALPHA.split('').map(a=>[a]):L.ALPHA.split('').flatMap(a=>L.ALPHA.split('').map(b=>[a,b]));
          for(const f of fills){ const tiles=cells.map((c,j)=>{ const q=bi.indexOf(j); return q>=0?[c,f[q],1]:[c,p[j],0]; }); const R=L.evalPlay(st,tiles); if(R.ok) out.set(tiles.map(t=>t.join(':')).sort().join(' '),R.score); } } } }
    return out; };
  const NP=QUICK?40:200; let bad=0, extra=0, missing=0, dups=0, checked=0;
  for(let g=0;g<NP;g++){ const shape=L.SHAPE_IDS[g%4], mods=g%5===1?{minLen:3}:g%5===2?{maxLen:5}:g%5===3?{norepeat:true}:{};
    const st=L.newGame({size:'small',shape,boardSeed:g+1,bagSeed:1000+g,mods,players:[{name:'A',ai:'normal'},{name:'B',ai:'normal'}]});
    for(let m=0;m<g%6&&!st.over;m++) L.aiTurn(st,'normal'); if(st.over) continue;
    const rng=L.seedRng('br'+g), pool='AEIOURSTLNDCGPMBHYKEAOI', rack=[]; for(let j=0;j<(g%7===0?4:3);j++) rack.push(pool[Math.floor(rng()*pool.length)]); if(g%4===0) rack[0]='?';
    const gm=new Map(); for(const mv of L.allMoves(st,rack)){ const tiles=L.moveTiles(st,mv), key=tiles.map(t=>t.join(':')).sort().join(' '); if(gm.has(key)) dups++; gm.set(key,mv.sc);
      const R=L.evalPlay(st,tiles); if(!R.ok||R.score!==mv.sc) bad++; }
    const bf=brute(st,rack); for(const k of bf.keys()) if(!gm.has(k)) missing++; for(const k of gm.keys()) if(!bf.has(k)) extra++; checked++; }
  ok(missing===0&&extra===0,`complete: matches a brute-force search on ${checked} random small positions, blanks included (${missing} missing, ${extra} extra)`);
  ok(bad===0,'valid: every generated move is legal and scored the same by the rules checker'); ok(dups===0,'no move is listed twice');
  // speed (Node; headless Chrome with 4× throttling is in tests/layout.js)
  const st=L.newGame({size:'large',boardSeed:5,bagSeed:55,players:[{name:'A',ai:'hard'},{name:'B',ai:'hard'}]}); for(let m=0;m<12;m++) L.aiTurn(st,'hard');
  let worst=0; for(const r of ['EARSTIN','QUEZIOT','BDGLMNO','AEEIOUR']){ const t=performance.now(); L.allMoves(st,r.split('')); worst=Math.max(worst,performance.now()-t); }
  ok(worst<75,`all moves on a Large board in ${worst.toFixed(1)} ms (Node, typical racks)`);
  const sliceTimes=rack=>{ const gen=L.moveGen(st,rack.split(''),{slice:true}), t=[]; for(;;){ const a=performance.now(); const r=gen.next(); t.push(performance.now()-a); if(r.done) break; } return t.sort((a,b)=>a-b); };
  const t1=sliceTimes('EARSTIN'), q1=t1[Math.floor(t1.length*.99)]; ok(q1<3,`each unit of work between yields is short: 99% under ${q1.toFixed(2)} ms, worst ${t1[t1.length-1].toFixed(1)} ms (typical rack)`);
  const t2=sliceTimes('??ESRAT'), p99=t2[Math.floor(t2.length*.99)]; ok(p99<5,`two blanks: 99% of units under ${p99.toFixed(2)} ms (worst ${t2[t2.length-1].toFixed(1)} ms, ${t2.length} units)`); }

sec('computer opponent');
{ const G=QUICK?20:200, lv=['easy','normal','hard','expert'], wins={}; let banned=0, invalid=0;
  for(let a=0;a<3;a++){ const b=a+1; let wb=0;
    for(let g=0;g<G;g++){ const sw=g%2, P=[{name:lv[a],ai:lv[a]},{name:lv[b],ai:lv[b]}]; if(sw) P.reverse(); const st=play({size:'medium',boardSeed:100+g,bagSeed:5000+g+a*1000,players:P});
      if(st.result.winner===(sw?0:1)) wb++; for(const m of st.moves) if(m.t==='p') for(const w of [m.w,...m.ws]){ if(BANNED&&BANNED.has(w)) banned++; if(!L.isWord(w)) invalid++; } }
    wins[lv[b]]=wb; ok(wb>G/2,`${lv[b]} beats ${lv[a]} in ${wb}/${G} games on Medium`); }
  ok(banned===0&&invalid===0,'the computer never plays a banned or invalid word');
  // fairness: two different hidden racks with the same visible state give the same choice
  for(const level of lv){ let same=true;
    for(let g=0;g<6;g++){ const s1=L.newGame({size:'medium',boardSeed:70+g,bagSeed:80+g,players:[{name:'A',ai:'hard'},{name:'B',ai:'hard'}]}); for(let m=0;m<4+g;m++) L.aiTurn(s1,'hard'); if(s1.over) continue;
      const p=s1.turn, q=1-p, s2=L.cloneState(s1); // swap the other player's rack with tiles from the bag
      const k=Math.min(s2.racks[q].length,s2.bag.length); const tmp=s2.racks[q].splice(0,k); s2.racks[q].push(...s2.bag.splice(0,k)); s2.bag.push(...tmp); s2.bag.sort();
      const c1=L.aiChoose(s1,p,level,L.allMoves(s1,s1.racks[p])), c2=L.aiChoose(s2,p,level,L.allMoves(s2,s2.racks[p]));
      if(JSON.stringify(c1.tiles)!==JSON.stringify(c2.tiles)||c1.t!==c2.t) same=false; }
    ok(same,`${level}: hidden racks and bag order don't change its choice`); }
  // the Expert's endgame blocking with the bag empty
  { const st=L.newGame({size:'medium',boardSeed:3,bagSeed:4,players:[{name:'A',ai:'expert'},{name:'B',ai:'expert'}]}); while(!st.over&&st.bag.length) L.aiTurn(st,'expert');
    if(!st.over){ const t=performance.now(); const mv=L.aiChoose(st,st.turn,'expert',L.allMoves(st,st.racks[st.turn])); ok(mv&&(mv.t==='p'||mv.t==='-'||mv.t==='x'),`Expert looks a reply ahead in the endgame (${(performance.now()-t).toFixed(0)} ms)`); } } }

sec('Daily');
{ const fp=d=>L.gameFingerprint(L.newGame(L.dailyCfg(d))); let same=true; const d0=Date.UTC(2026,10,24); const prints=new Set();
  for(let i=0;i<120;i++){ const d=new Date(d0+i*864e5).toISOString().slice(0,10); const a=fp(d); L.BOARDS.clear(); if(fp(d)!==a) same=false; prints.add(a); }
  ok(same,'the same date gives the same board and bag order (120 days)'); ok(prints.size===120,'every day is different');
  for(const [d,f] of Object.entries(PIN)) eq(fp(d),f,`${d} pinned by fingerprint`);
  const c=L.dailyCfg('2026-11-24'); ok(c.size==='medium'&&c.solo&&c.turns===10,'Daily: Medium, solo, 10 turns');
  const par=L.dailyPar('2026-11-24'); L.BOARDS.clear(); eq(L.dailyPar('2026-11-24'),par,`par is repeatable (${par})`); ok(par>150&&par<700,'par is in a sensible range');
  eq([L.parStars(Math.ceil(par*.6),par),L.parStars(Math.ceil(par*.85),par),L.parStars(par,par),L.parStars(Math.ceil(par*.6)-1,par)],[1,2,3,0],'stars at 60 / 85 / 100% of par');
  const S=L.defSave(); L.setPar(S,'2026-11-24',par); const r=L.dailyResult(S,'2026-11-24',300,'2026-11-24'); ok(r&&r.xp===40,'release-day XP doubled (40)');
  ok(L.dailyResult(S,'2026-11-24',999,'2026-11-24')===null,'one scored attempt'); eq(S.daily.score,300,'the first score stands');
  const S2=L.defSave(); L.setPar(S2,'2026-11-23',par); eq(L.dailyResult(S2,'2026-11-23',100,'2026-11-24').xp,20,'a Daily finished after its day gets 20 XP');
  const line=L.shareLine('2026-11-24',312,371,2); eq(line,'Tilecraft Daily · 24 Nov · 312 (84% of par) · ★★☆','share line');
  const st=L.newGame(c); while(!st.over) L.aiTurn(st,'hard'); const words=st.moves.filter(m=>m.t==='p').flatMap(m=>[m.w,...m.ws]);
  ok(!words.some(w=>L.shareLine('2026-11-24',st.scores[0],par,2).includes(w)),'the share line never shows a word');
  // streak and records
  const S3=L.defSave(); for(const [d,t] of [['2026-11-20','2026-11-20'],['2026-11-21','2026-11-21'],['2026-11-22','2026-11-22']]){ L.setPar(S3,d,300); L.dailyResult(S3,d,310,t); }
  eq([S3.dstreak.cur,S3.dbest],[3,103],'Daily streak and best % of par'); ok(L.checkAch(S3,{mode:'daily'}).includes('dspark'),'★★★ on a Daily gives Daily Spark');
  ok(Object.keys(S3.dhist).length<=7,'keeps the last 7 Dailies'); }

sec('2-Player codes');
{ const mk=(size,moves)=>{ const cfg=L.twoPlayerCfg({size,shape:'square',boardSeed:1234,bagSeed:5678,mods:{}},['Alasdair','Robin']); const st=L.newGame(cfg);
    let k=0; while(!st.over&&k<moves){ L.aiTurn(Object.assign(st,{}),'hard'); k++; } return {cfg,st}; };
  // aiTurn uses the players' ai field; give both seats an AI just for building test games
  const build=(size,moves,mods)=>{ const cfg=L.twoPlayerCfg({size,shape:'square',boardSeed:1234,bagSeed:5678,mods:mods||{}},['Alasdair','Robin']); const st=L.newGame(cfg);
    let k=0; while(!st.over&&k<moves){ const mv=L.aiChoose(st,st.turn,'hard',L.allMoves(st,st.racks[st.turn])); L.applyMove(st,mv.t==='p'?{t:'p',tiles:mv.tiles}:mv); k++; } return {cfg,st}; };
  const id=[1,2,3,4,5,6];
  { const {cfg,st}=build('medium',9,{norepeat:true,minLen:3,maxLen:7,blanks:4,rare:true}); const code=L.encodeGame({id,cfg,names:['Alasdair','Robin'],moves:L.codeMoves(st)}); const g=L.decodeGame(code);
    ok(code.startsWith('TCF1.')&&/^[A-Za-z0-9_-]+$/.test(code.slice(5)),'code: TCF1. + base64url'); eq(g.id,'010203040506','the game id survives');
    const st2=L.replay(g.cfg,g.moves); eq(L.gameFingerprint(st2)+JSON.stringify(st2.scores)+st2.cells.join(''),L.gameFingerprint(st)+JSON.stringify(st.scores)+st.cells.join(''),'a round trip gives the same game');
    eq(g.names,['Alasdair','Robin'],'both names'); eq([g.cfg.mods.norepeat,g.cfg.mods.minLen,g.cfg.mods.maxLen,g.cfg.mods.blanks,g.cfg.mods.rare,g.cfg.mods.timer],[true,3,7,4,true,0],'modifiers survive (and there is no timer)');
    const msg=`Tilecraft · your move!\nPaste this whole message into Tilecraft:\n${code}\nthanks`; eq(L.decodeGame(msg).moves.length,st.moves.length,'a pasted message with extra text still works');
    // rejections
    const local=(n,me,del)=>({games:[{id:g.id,me,n}],deleted:del||[]});
    const raw=L.fromB64U(code.slice(5)); raw[raw.length-6]^=0x55; const bad='TCF1.'+L.toB64U(raw);
    ok(!L.importCheck(bad,local(5,st.turn)).ok,'a tampered code is rejected');
    const {st:stx}=build('medium',3); const codeT=L.encodeGame({id,cfg,names:['A','B'],moves:L.codeMoves(stx).map((m,k)=>k===2&&m.t==='p'?{t:'p',tiles:m.tiles.map(t=>[t[0],t[1]==='Q'?'Z':'Q',t[2]])}:m)});
    eq(L.importCheck(codeT,local(1,1)).why,'invalid','a code with an impossible move is rejected (replay)');
    eq(L.importCheck(code,local(8,1-st.turn)).why,'notyours','it must be this player\'s turn');
    eq(L.importCheck(code,local(10,st.turn)).why,'older','an older code than the saved game is rejected');
    eq(L.importCheck(code,local(9,st.turn)).why,'same','the same code twice is ignored');
    eq(L.importCheck(code,{games:[],deleted:[g.id]}).why,'deleted','a deleted game\'s code is rejected');
    ok(L.importCheck(code,local(8,st.turn)).ok,'a newer code for this player is accepted');
    eq(L.importCheck('hello there',{games:[],deleted:[]}).why,'nocode','text without a code'); }
  { const {cfg,st}=build('large',200); const code=L.encodeGame({id,cfg,names:['Alasdair Longname','Robin Q. Player'],moves:L.codeMoves(st)});
    ok(st.over,'a full Large game was played'); ok(code.length<1100,`a full Large game's code is ${code.length} characters (max 1,100)`);
    const {st:sm}=build('medium',200); const cm=L.encodeGame({id,cfg:sm.cfg,names:['Alasdair','Robin'],moves:L.codeMoves(sm)}); ok(cm.length<800,`a full Medium game's code is ${cm.length} characters`); }
  // achievements: share-code wins count, pass-and-play counts nothing
  { const S=L.defSave(); const {cfg,st}=build('small',200); const win=st.result.winner; const gl={id:'aa',mode:'local',me:null}, gc={id:'bb',mode:'code',me:win};
    L.tpCount(S,gl,st); ok(S.tp.wins===0,'pass-and-play games count nothing'); ok(L.checkAch(S,{mode:'tp',local:true}).length===0,'pass-and-play gives no achievements');
    L.tpCount(S,gc,st); L.tpCount(S,gc,st); eq(S.tp.wins,1,'a share-code win counts once');
    S.tp.wins=4; L.tpCount(S,{id:'cc',mode:'code',me:win},st); ok(L.checkAch(S,{mode:'tp'}).includes('riv1'),'5 share-code wins: Rivals I');
    eq(L.checkAch(S,{mode:'tp',st}).filter(a=>!/^riv/.test(a)).length,0,'2-Player earns only Rivals achievements'); } }

sec('campaign');
{ eq(L.LEVELS.length,45,'45 levels'); eq(L.CAMPS.map((c,i)=>L.LEVELS.filter(l=>l.camp===i).length),[15,15,15],'15 per campaign');
  const types=i=>L.LEVELS.filter(l=>l.camp===i).map(l=>l.type[0]).join(''); for(let i=0;i<3;i++) eq(types(i),'ddddtdddtpddddd','level mix: score targets at 5 and 9, a puzzle at 10');
  for(let i=0;i<3;i++){ const ls=L.LEVELS.filter(l=>l.camp===i); eq([4,8,12].map(n=>ls[n-1].shape),['ring','cross','diamond'],`${L.CAMPS[i].name}: shaped boards at 4, 8, 12`);
    eq(ls[14].ai,['normal','hard','expert'][i],`${L.CAMPS[i].name} finale opponent`); eq([1,2,3].map(n=>ls[n-1].ai),Array(3).fill(['easy','normal','hard'][i]),`${L.CAMPS[i].name}: levels 1–3 opponent`);
    ok([7,14].every(n=>Object.keys(ls[n-1].mods).length),`${L.CAMPS[i].name}: twist levels 7 and 14 have modifiers`); }
  ok(L.LEVELS.filter(l=>l.camp===0&&l.type!=='puzzle').filter(l=>l.size==='small').length>=10,'Apprentice is mostly Small boards');
  ok(L.LEVELS.filter(l=>l.camp===1&&l.type!=='puzzle').every(l=>l.size==='medium'),'Journeyman: Medium boards');
  ok(L.LEVELS.filter(l=>l.camp===2&&l.type!=='puzzle').every(l=>l.size!=='small')&&L.LEVELS.some(l=>l.camp===2&&l.size==='large'),'Master: Medium and Large boards');
  let done=0, twist=0; for(const Lv of L.LEVELS){ const c=L.levelCfg(Lv); const st=L.newGame(c); ok(st.racks[0].length===7||Lv.type==='puzzle','level '+Lv.id+' loads');
    if(Lv.type==='puzzle'){ const ms=L.sortMoves(L.allMoves(st,st.racks[0])); const Z=L.PUZZLES[Lv.puzzle]; eq(ms[0].sc,Z.best,`${Lv.id}: the puzzle's best move matches the solver (${Z.answer})`);
      L.applyMove(st,{t:'p',tiles:L.moveTiles(st,ms[0])}); const o=L.levelOutcome(Lv,st); ok(o.goal&&o.twist,`${Lv.id}: the best move earns the goal and twist stars`); done++; twist++; continue; }
    c.players[0].ai='expert'; const o=L.levelOutcome(Lv,play(c)); if(o.goal) done++; if(o.twist) twist++; ok(o.goal,`${Lv.id} ${Lv.name}: a strong bot meets the goal`); }
  eq(done,45,'all 45 levels completed by a strong bot'); ok(twist>=40,`and ${twist} of 45 twists`);
  // stars, unlocks, XP
  const S=L.defSave(); const A1=L.levelById('A1'), A2=L.levelById('A2');
  ok(L.unlocked(S,A1)&&!L.unlocked(S,A2),'only level 1 is open at first'); ok(!L.campOpen(S,1),'Journeyman starts locked');
  let r=L.campaignResult(S,A1,{goal:true,twist:false,score:200},1); eq([r.fresh,r.xp],[[0],6],'goal star with a hint: 6 XP, no no-hints star');
  r=L.campaignResult(S,A1,{goal:true,twist:true,score:220},0); eq([r.fresh,r.xp],[[1,2],12],'stars build up across attempts');
  r=L.campaignResult(S,A1,{goal:true,twist:true,score:220},0); eq(r.xp,0,'each star is earned once');
  ok(L.unlocked(S,A2),'clearing a level unlocks the next');
  for(const Lv of L.LEVELS.filter(l=>l.camp===0)) L.campaignResult(S,Lv,{goal:true,twist:true,score:1},0); ok(L.campOpen(S,1),'clearing level 15 unlocks the next campaign');
  ok(L.checkAch(S,{mode:'campaign'}).includes('camp1')&&L.checkAch(S,{mode:'campaign'}).length===0||S.ach.camp1&&S.ach.perf1,'Apprentice and Perfect Apprentice');
  eq(L.totalStars(S),45,'stars total'); const S4=L.defSave(); let xp=0; for(const Lv of L.LEVELS.filter(l=>l.camp===0)) xp+=L.campaignResult(S4,Lv,{goal:true,twist:false,score:1},1).xp; eq(xp,15*6+75,'finishing Apprentice adds 75 XP');
  const S5=L.defSave(); for(const Lv of L.LEVELS) L.campaignResult(S5,Lv,{goal:true,twist:true,score:1},0); ok(L.owned(S5,L.findCos('board','retro'))&&L.owned(S5,L.findCos('tile','wood'))&&L.owned(S5,L.findCos('board','garden')),'30 / 75 / 135 stars unlock cosmetics');
  ok(L.checkAch(S5,{mode:'campaign'}).includes('puzzle')||S5.ach.puzzle,'Puzzle Master'); }

sec('core');
{ const S=L.loadSave(JSON.stringify({xp:60,ach:{first:1},look:{tile:'slate'}})); ok(S.setup&&S.tp&&S.prefs&&S.look.board==='workshop'&&S.look.tile==='slate'&&S.xp===60,'an old save missing new fields loads through defSave()');
  ok(L.loadSave('garbage').xp===0,'a broken save starts fresh');
  // a game mid-move restores exactly
  const st=L.newGame({size:'medium',boardSeed:8,bagSeed:9,players:[{name:'A',ai:'hard'},{name:'B',ai:'expert'}]}); for(let i=0;i<7;i++) L.aiTurn(st,st.cfg.players[st.turn].ai);
  const saved=JSON.parse(JSON.stringify(L.loadSave(JSON.stringify(Object.assign(L.defSave(),{run:{mode:'classic',st}}))).run.st));
  while(!st.over) L.aiTurn(st,st.cfg.players[st.turn].ai); while(!saved.over) L.aiTurn(saved,saved.cfg.players[saved.turn].ai);
  eq(saved.result.final,st.result.final,'a saved game resumes exactly (same finish)');
  // XP and levels
  const X=L.defSave(); eq(L.levelOf(0),1,'level 1 at 0 XP'); eq(L.levelOf(3175),10,'level 10 at 3,175 XP'); eq(L.LVXP,[0,50,150,300,525,825,1225,1725,2375,3175],'Sweep\'s first 10 steps');
  for(let l=2;l<=10;l++) ok(L.rewardsAt(l).length>0,`level ${l} has a reward (${L.rewardsAt(l).join(', ')})`);
  const h0=X.hints; const up=L.addXP(X,160); eq([up.before,up.after,X.hints],[1,3,h0+2],'each level-up gives +1 hint');
  X.hints=0; X.hintDate='2026-11-23'; L.refreshHints(X,'2026-11-24'); eq(X.hints,3,'hints refill daily to 3'); X.hints=7; X.hintDate='2026-11-24'; L.refreshHints(X,'2026-11-25'); eq(X.hints,7,'earned extras stack above the daily 3');
  X.hints=98; L.addXP(X,3175); eq(X.hints,99,'hints cap at 99'); ok(L.useHint(X)&&X.hints===98,'using a hint');
  // Classic XP and records
  const g=L.newGame({size:'medium',boardSeed:2,bagSeed:2,mods:{minLen:4,norepeat:true},shape:'square',players:[{name:'A',ai:'expert'},{name:'B',ai:'easy'}]}); while(!g.over) L.aiTurn(g,g.cfg.players[g.turn].ai);
  eq(L.classicXP(g,0,'easy'),Math.round((5+(g.result.winner===0?10:0))*1.2),'Classic XP: 5 + win bonus, +10% per hard modifier');
  const cfgShape={shape:'ring',mods:{minLen:4,maxLen:5,norepeat:true,swaps:false,timer:30}}; eq(L.modBonus(cfgShape),.4,'the modifier bonus caps at +40%');
  const R=L.defSave(); const fr=L.addRecords(R,g,0,'easy',false,'2026-11-24'); ok(fr.includes('Best game')&&R.rec.bestGame.sc===g.result.final[0],'records: best game');
  const R2=L.defSave(); L.addRecords(R2,g,0,'easy',true,'2026-11-24'); ok(!R2.rec.bestGame&&R2.rec.games===1,'an assisted game sets no best-score records');
  // achievements from a game
  const A=L.defSave(); const got=L.checkAch(A,{mode:'classic',st:g,p:0,ai:'easy',hints:0}); ok(got.includes('first'),'First Word');
  if(g.result.winner===0) ok(got.includes('ws_easy'),'Wordsmith: Easy');
  ok(L.ACH.length===30,'30 achievements'); ok(L.checkAch(L.defSave(),{mode:'classic',st:g,p:0,practice:true}).length===0,'practice earns nothing');
  // cosmetics
  const all=L.COS_KINDS.flatMap(([k])=>L.COS[k]); eq(all.length,25,'25 cosmetics'); const C0=L.defSave(); eq(all.filter(it=>L.owned(C0,it)).length,6,'6 owned at the start');
  ok(L.COS.tile.length===7&&L.COS.board.length===6&&L.COS.font.length===3&&L.COS.fx.length===4&&L.COS.track.length===3&&L.COS.sound.length===2,'tile styles, board themes, fonts, effects, soundtracks and sound packs');
  ok(all.every(it=>!it.req||L.ACH.some(a=>a.id===it.req)),'every achievement unlock exists');
  // backup
  const B=L.defSave(); B.xp=777; B.tp.games.push({id:'abc',moves:[]}); const o=L.parseBackup('my backup: '+L.backupPlain(B)+' end'); ok(o&&o.xp===777&&o.tp.games.length===1,'backup round trip (TILECRAFT1., with the 2-Player list)');
  ok(L.parseBackup('LINEFALL1.abc')===null,'other games\' backups are refused');
  // Arcade
  const store={d:{},get(k){ return this.d[k]===undefined?null:this.d[k]; },set(k,v){ this.d[k]=v; }};
  store.set('arcade.v1',JSON.stringify({v:1,set:{appearance:'dark',motion:false,sfx:false,music:false,haptics:false,fullscreen:true,cb:true,lefty:true,lang:'de'},name:'Alasdair'}));
  const base=L.defSave(), Pz=L.applyShared(base,L.readArcade(store));
  eq(['appearance','motion','sfx','music','haptics','fullscreen','cb','lefty','lang','name'].map(k=>Pz[k]),['dark',false,false,false,false,true,true,true,'de','Alasdair'],'shared settings and the name come from arcade.v1');
  eq([base.appearance,base.lang,base.name],['system','auto',''],'the save keeps its own standalone values');
  const sm=L.summary(Object.assign(L.defSave(),{xp:200})); eq(Object.keys(sm),['v','game','ver','level','maxLevel','xp','xpLevel','xpNext','ach','hi','last'],'summary has every field');
  eq([sm.game,sm.maxLevel,sm.level,sm.ach.length,sm.hi.map(h=>h[0])],['tilecraft',10,3,30,['Best move','Campaign stars','Daily best']],'summary values');
  eq([L.KEY,L.SUMKEY],['tilecraft.v1','arcade.summary.tilecraft'],'storage keys'); }

sec('sources');
{ const app=fs.readFileSync(path.join(ROOT,'src','app.html'),'utf8');
  ok(app.includes("ARCADE_HOME='../index.html', ARCADE_PREFS='../index.html#prefs';"),'ARCADE_HOME and ARCADE_PREFS');
  ok(!/location\.href\s*=/.test(app)&&!/location\.assign/.test(app)&&/location\.replace\(url\)/.test(app),'leaves only with location.replace');
  ok(app.includes("location.hash==='#game-settings'")&&app.includes('history.replaceState')&&app.includes('id="settingsBtn"'),'#game-settings opens settings; #settingsBtn exists');
  ok(!/serviceWorker/.test(app),'no service worker');
  const keys=[...app.matchAll(/store\.set\('([^']+)'/g)].map(m=>m[1]); ok(keys.every(k=>k.startsWith('tilecraft.')),'writes only tilecraft.* keys directly ('+keys.join(', ')+')');
  ok(!/Scrabble|SCRABBLE|Hasbro|Mattel/.test(app+fs.readFileSync(path.join(ROOT,'src','engine.js'),'utf8')+fs.readFileSync(path.join(ROOT,'src','core.js'),'utf8')),'the original game\'s name appears nowhere in the shipped sources'); }

const r=res(); console.log(`\n${r.pass} passed, ${r.fail} failed (${((Date.now()-t0)/1000).toFixed(0)} s)`); process.exit(r.fail?1:0);
