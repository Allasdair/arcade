// ===================== Mahjong engine (pure: no DOM, no timers) =====================
// Tiles, layouts and the free-tile rule, matching, the reverse-built generator, fair Shuffle, undo, assists,
// the combo score, Time Attack and Fog. The game state is plain JSON, so saves resume exactly and bots run fast.

// ---------- randomness: cyrb128 → sfc32, as in Sweep ----------
function seedRng(str){
  let h1=1779033703,h2=3144134277,h3=1013904242,h4=2773480762; str=String(str);
  for(let i=0;i<str.length;i++){ const k=str.charCodeAt(i); h1=h2^Math.imul(h1^k,597399067); h2=h3^Math.imul(h2^k,2869860233); h3=h4^Math.imul(h3^k,951274213); h4=h1^Math.imul(h4^k,2716044813); }
  h1=Math.imul(h3^(h1>>>18),597399067); h2=Math.imul(h4^(h2>>>22),2869860233); h3=Math.imul(h1^(h3>>>17),951274213); h4=Math.imul(h2^(h4>>>19),2716044813);
  let a=(h1^h2^h3^h4)>>>0, b=(h2^h1)>>>0, c=(h3^h1)>>>0, d=(h4^h1)>>>0;
  const r=()=>{ a>>>=0; b>>>=0; c>>>=0; d>>>=0; let t=(a+b)|0; a=b^(b>>>9); b=(c+(c<<3))|0; c=(c<<21)|(c>>>11); d=(d+1)|0; t=(t+d)|0; c=(c+t)|0; return (t>>>0)/4294967296; };
  for(let i=0;i<15;i++) r(); return r; }
const shuffleArr=(a,rng)=>{ for(let i=a.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); const t=a[i]; a[i]=a[j]; a[j]=t; } return a; };

// ---------- tiles ----------
// Faces 0–8 Dots 1–9, 9–17 Bamboo 1–9, 18–26 Characters 1–9, 27–30 Winds E S W N, 31–33 Dragons red green white,
// 34–37 Flowers 1–4, 38–41 Seasons 1–4. Kinds 0–33 match identical tiles; any flower matches any flower, any season any season.
const NFACES=42, NKINDS=34, FLOWER=34, SEASON=35;
const matchKey=f=>f<34?f:f<38?FLOWER:SEASON;
const SUITS=['dots','bam','char'];
function faceInfo(f){ if(f<27) return {suit:SUITS[(f/9)|0],n:f%9+1};
  if(f<31) return {suit:'wind',n:f-27}; if(f<34) return {suit:'dragon',n:f-31}; if(f<38) return {suit:'flower',n:f-33}; return {suit:'season',n:f-37}; }
const WIND_L=['E','S','W','N'], DRAGON_L=['R','G','W'];
// short corner labels for the High-contrast set: B5 (bamboo), C3 (characters), D7 (dots), EW (East Wind), RD (Red Dragon), F2, S3
function faceLabel(f){ const i=faceInfo(f); if(i.suit==='dots') return 'D'+i.n; if(i.suit==='bam') return 'B'+i.n; if(i.suit==='char') return 'C'+i.n;
  if(i.suit==='wind') return WIND_L[i.n]+'W'; if(i.suit==='dragon') return DRAGON_L[i.n]+'D'; if(i.suit==='flower') return 'F'+i.n; return 'S'+i.n; }
const FACE_NAMES_SUIT={dots:'Dots',bam:'Bamboo',char:'Characters'};
function faceName(f){ const i=faceInfo(f); if(i.suit in FACE_NAMES_SUIT) return FACE_NAMES_SUIT[i.suit]+' '+i.n;
  if(i.suit==='wind') return ['East','South','West','North'][i.n]+' Wind'; if(i.suit==='dragon') return ['Red','Green','White'][i.n]+' Dragon';
  return (i.suit==='flower'?'Flower ':'Season ')+i.n; }

// ---------- difficulties ----------
const DIFF_IDS=['easy','normal','hard','expert'];
const DIFFS={easy:{name:'Easy',tiles:72,kinds:16},normal:{name:'Normal',tiles:108,kinds:25},hard:{name:'Hard',tiles:144,kinds:34},expert:{name:'Expert',tiles:144,kinds:34}};
const GRADES=['easy','normal','hard','expert']; // the blind bot's win rate: ≥75%, 50–75%, 25–50%, under 25%
const GRADE_NAMES={easy:'Easy',normal:'Normal',hard:'Hard',expert:'Expert'};
const gradeOf=rate=>rate>=.75?'easy':rate>=.5?'normal':rate>=.25?'hard':'expert';

// ---------- layouts ----------
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LAYOUTS=[], LAYOUT_BY={};
function geom(pos){ // precomputed neighbours: above (z+1 overlapping), below, left and right (same layer, touching)
  const n=pos.length, above=[], below=[], left=[], right=[];
  for(let i=0;i<n;i++){ above.push([]); below.push([]); left.push([]); right.push([]); }
  for(let i=0;i<n;i++){ const [x,y,z]=pos[i];
    for(let j=0;j<n;j++){ if(i===j) continue; const [X,Y,Z]=pos[j], dx=X-x, dy=Y-y; if(Math.abs(dy)>=2) continue;
      if(Z===z+1&&Math.abs(dx)<2) { above[i].push(j); below[j].push(i); }
      if(Z===z&&dx===-2) left[i].push(j); if(Z===z&&dx===2) right[i].push(j); } }
  return {above,below,left,right}; }
for(const d of (typeof LAYOUT_DATA!=='undefined'?LAYOUT_DATA:[])){ const pos=[];
  for(let i=0;i<d.p.length;i+=3) pos.push([B64.indexOf(d.p[i]),B64.indexOf(d.p[i+1]),B64.indexOf(d.p[i+2])]);
  const L=Object.assign({},d,{pos,n:pos.length},geom(pos)); delete L.p; LAYOUTS.push(L); LAYOUT_BY[L.id]=L; }
const layoutById=id=>LAYOUT_BY[id];
// sizes: Easy 72, Normal 108, Hard and Expert 144. Random boards use the difficulty's own layouts; the layout picker
// offers any unlocked layout with the same number of tiles (so Expert can use a Hard layout, and the other way round).
const layoutsFor=diff=>LAYOUTS.filter(L=>L.diff===diff&&!L.special);
const layoutsOfSize=diff=>LAYOUTS.filter(L=>DIFFS[L.diff].tiles===DIFFS[diff].tiles);
// the trap level the generator starts from when looking for a board of a grade
const GRADE_TRAP={easy:0,normal:.25,hard:.5,expert:.85};

// ---------- free-tile rule ----------
// A tile is free when no tile on the layer above overlaps it, and its left or its right side is open.
function isFree(L,gone,i){ if(gone[i]) return false;
  for(const j of L.above[i]) if(!gone[j]) return false;
  let lb=false; for(const j of L.left[i]) if(!gone[j]){ lb=true; break; } if(!lb) return true;
  for(const j of L.right[i]) if(!gone[j]) return false; return true; }
function freeList(L,gone){ const o=[]; for(let i=0;i<L.n;i++) if(isFree(L,gone,i)) o.push(i); return o; }
function freePairs(L,gone,faces){ const by=new Map(), out=[]; for(const i of freeList(L,gone)){ const k=matchKey(faces[i]); if(!by.has(k)) by.set(k,[]); by.get(k).push(i); }
  for(const g of by.values()) for(let a=0;a<g.length;a++) for(let b=a+1;b<g.length;b++) out.push([g[a],g[b]]); return out; }

// ---------- generator: reverse building ----------
// Start full; repeatedly remove two positions that are free, as a pair. Each kind's 4 tiles become 2 pairs (a "couple");
// the bonus groups become pairs of flowers and pairs of seasons. Played forward in this order the board always clears.
// opts.trap (0–1): how often a couple is made of two pairs where one blocks the other (harder for a player who can't
// see under the stack). Grading by the blind bot decides what a board is really like.
function buildOrder(L,gone0,rng){ // returns [[a,b],…] in removal order, or null if it ran out of free tiles
  const gone=gone0.slice(); let left=0; for(let i=0;i<L.n;i++) if(!gone[i]) left++;
  const order=[];
  while(left>0){ const free=freeList(L,gone); if(free.length<2) return null;
    const w=free.map(i=>{ const z=L.pos[i][2]; return (z+1)*(z+1)*(1+L.below[i].length*.5); });
    const pick=(ex)=>{ let tot=0; for(let k=0;k<free.length;k++) if(free[k]!==ex) tot+=w[k]; let r=rng()*tot; for(let k=0;k<free.length;k++){ if(free[k]===ex) continue; r-=w[k]; if(r<=0) return free[k]; } return free.find(x=>x!==ex); };
    let a,b,okk=false;
    for(let t=0;t<24&&!okk;t++){ a=pick(-1); b=pick(a); gone[a]=gone[b]=1; const rest=left-2;
      okk=rest===0||freeList(L,gone).length>=2; if(!okk){ gone[a]=gone[b]=0; } }
    if(!okk) return null; order.push([a,b]); left-=2; }
  return order; }
function blocks(L,p,q){ // does a tile of pair p cover or side-block a tile of pair q?
  for(const a of p) for(const b of q) if(L.above[b].includes(a)||L.left[b].includes(a)||L.right[b].includes(a)) return true; return false; }
function chooseKinds(diff,rng){ const n=DIFFS[diff].kinds; if(n>=NKINDS) return [...Array(NKINDS).keys()];
  if(diff==='easy') return shuffleArr([...Array(27).keys()],rng).slice(0,n).sort((a,b)=>a-b); // Easy prefers the numbered suits
  return shuffleArr([...Array(NKINDS).keys()],rng).slice(0,n).sort((a,b)=>a-b); }
function generate(L,diff,seed,trap){ trap=trap||0;
  for(let attempt=0;attempt<60;attempt++){ const rng=seedRng(seed+'#'+attempt);
    const order=buildOrder(L,new Array(L.n).fill(0),rng); if(!order) continue;
    // couples: two pairs share a kind
    const P=order.length, mate=new Array(P).fill(-1), idx=shuffleArr([...Array(P).keys()],rng);
    for(const k of idx){ if(mate[k]>=0) continue; const open=idx.filter(j=>j!==k&&mate[j]<0); if(!open.length) break;
      let j; if(rng()<trap){ const dep=open.filter(j=>blocks(L,order[j],order[k])||blocks(L,order[k],order[j])); j=dep.length?dep[Math.floor(rng()*dep.length)]:open[Math.floor(rng()*open.length)]; }
      else j=open[Math.floor(rng()*open.length)];
      mate[k]=j; mate[j]=k; }
    const kinds=[...chooseKinds(diff,rng),FLOWER,SEASON]; shuffleArr(kinds,rng);
    const faces=new Array(L.n).fill(-1); let ki=0;
    for(let k=0;k<P;k++){ if(mate[k]<k) continue; const K=kinds[ki++], pa=order[k], pb=order[mate[k]];
      let f4; if(K===FLOWER) f4=shuffleArr([34,35,36,37],rng); else if(K===SEASON) f4=shuffleArr([38,39,40,41],rng); else f4=[K,K,K,K];
      faces[pa[0]]=f4[0]; faces[pa[1]]=f4[1]; faces[pb[0]]=f4[2]; faces[pb[1]]=f4[3]; }
    return {faces,order,attempt}; }
  return null; }

// ---------- game state ----------
// cfg: {lid, diff, seed, trap, shuffles ('inf'|3|0), undo (true|false), ta (Time Attack), fog}
const TA_START={easy:110,normal:160,hard:215,expert:215}; // seconds: about 1.5 s per tile
const TA_PAIR=3, COMBO_WIN=3000, COMBO_MUL=[1,1.5,2,2.5,3];
function newGame(cfg,pre){ const L=layoutById(cfg.lid); const g=pre||generate(L,cfg.diff,cfg.seed,cfg.trap); if(!g) throw new Error('generate');
  const st={v:1,cfg:Object.assign({},cfg),faces:g.faces.slice(),gone:new Array(L.n).fill(0),sel:-1,undo:[],moves:0,shuffles:0,
    assists:{hint:0,undo:0,shuffle:0,show:0},t:0,score:0,combo:0,lastPair:-1e9,bestCombo:0,quads:0,lastKey:-1,lastKeyRun:0,
    ta:cfg.ta?{left:TA_START[cfg.diff]*1000}:null,seen:null,over:false,won:false,lost:false,order:g.order||null};
  if(cfg.fog){ st.seen=new Array(L.n).fill(0); revealFree(st); }
  if(cfg.gone) cfg.gone.forEach((v,i)=>{ if(v) st.gone[i]=1; }); // puzzle levels start part-cleared
  if(cfg.gone&&st.seen) revealFree(st);
  return st; }
const cloneState=st=>JSON.parse(JSON.stringify(st));
const layoutOf=st=>layoutById(st.cfg.lid);
const tilesLeft=st=>st.gone.reduce((a,g)=>a+(g?0:1),0);
const assisted=st=>!!(st.assists.hint||st.assists.undo||st.assists.shuffle||st.assists.show);
function revealFree(st){ if(!st.seen) return []; const L=layoutOf(st), o=[]; for(let i=0;i<L.n;i++) if(!st.seen[i]&&isFree(L,st.gone,i)){ st.seen[i]=1; o.push(i); } return o; }
const faceUp=(st,i)=>!st.seen||!!st.seen[i];
const stFree=(st,i)=>isFree(layoutOf(st),st.gone,i);
function matchable(st){ return freePairs(layoutOf(st),st.gone,st.faces); }
const stuck=st=>!st.over&&tilesLeft(st)>0&&matchable(st).length===0;
const canShuffle=st=>st.cfg.shuffles==='inf'||st.shuffles<st.cfg.shuffles;
const canUndo=st=>st.cfg.undo!==false&&st.undo.length>0;

// Tap a tile. now = game clock (ms). Returns what happened, for the UI.
function tap(st,i,now){ if(st.over) return {k:'over'}; if(st.gone[i]) return {k:'none'};
  if(now!=null) st.t=now;
  if(!stFree(st,i)) return {k:'blocked',i};
  if(st.sel===i){ st.sel=-1; return {k:'deselect',i}; }
  if(st.sel<0){ st.sel=i; return {k:'select',i}; }
  const a=st.sel;
  if(matchKey(st.faces[a])!==matchKey(st.faces[i])){ st.sel=i; return {k:'switch',i,from:a}; }
  return Object.assign({k:'match'},removePair(st,a,i)); }
function removePair(st,a,b){ const L=layoutOf(st), key=matchKey(st.faces[a]);
  const snap={a,b,sel:st.sel,score:st.score,combo:st.combo,lastPair:st.lastPair,ta:st.ta?st.ta.left:null,quads:st.quads,lastKey:st.lastKey,lastKeyRun:st.lastKeyRun};
  st.gone[a]=st.gone[b]=1; st.sel=-1; st.moves++;
  // combo: pairs within 3 s of the last pair build ×1.5, ×2, ×2.5, capped at ×3
  st.combo=st.t-st.lastPair<=COMBO_WIN?Math.min(COMBO_MUL.length-1,st.combo+1):0; st.lastPair=st.t; st.bestCombo=Math.max(st.bestCombo,st.combo);
  const base=key>=FLOWER?20:10, pts=Math.round(base*COMBO_MUL[st.combo]); st.score+=pts;
  let bonus=0; if(st.ta){ bonus=(TA_PAIR+st.combo)*1000; st.ta.left+=bonus; } snap.bonus=bonus;
  // Four of a Kind: all 4 of a kind removed in two back-to-back moves
  let quad=false; if(st.lastKey===key&&st.lastKeyRun===1&&key<FLOWER){ quad=true; st.quads++; st.lastKeyRun=0; st.lastKey=-1; } else { st.lastKey=key; st.lastKeyRun=1; }
  st.undo.push(snap); if(st.undo.length>400) st.undo.shift();
  const revealed=revealFree(st);
  if(tilesLeft(st)===0){ st.over=true; st.won=true; }
  return {a,b,pts,combo:st.combo,bonus,quad,revealed}; }
function undoMove(st){ if(!canUndo(st)) return null; const s=st.undo.pop();
  if(s.shuffle){ st.faces=s.faces; st.order=s.order||null; st.shuffles--; if(st.seen) st.seen=s.seen; st.sel=-1; st.assists.undo++; return {shuffle:true}; }
  st.gone[s.a]=st.gone[s.b]=0; st.sel=-1; st.score=s.score; st.combo=s.combo; st.lastPair=s.lastPair; st.quads=s.quads; st.lastKey=s.lastKey; st.lastKeyRun=s.lastKeyRun;
  if(st.ta) st.ta.left=Math.max(1000,st.ta.left-(s.bonus||0)); // time already spent stays spent; the pair's bonus is taken back
  st.moves++; st.assists.undo++; st.over=false; st.won=false; return {a:s.a,b:s.b}; }
// Shuffle: rearrange the remaining faces across the remaining positions with the generator's own method, so the
// result is always winnable. Returns false if the remaining shape can't be cleared whatever the faces (very rare).
function shuffleBoard(st,seed){ const L=layoutOf(st);
  const rest=[]; for(let i=0;i<L.n;i++) if(!st.gone[i]) rest.push(i);
  for(let attempt=0;attempt<40;attempt++){ const rng=seedRng(seed+'#'+attempt); const order=buildOrder(L,st.gone,rng); if(!order) continue;
    const by=new Map(); for(const i of rest){ const k=matchKey(st.faces[i]); if(!by.has(k)) by.set(k,[]); by.get(k).push(st.faces[i]); }
    const slots=[]; for(const fs of by.values()){ shuffleArr(fs,rng); for(let k=0;k+1<fs.length;k+=2) slots.push([fs[k],fs[k+1]]); }
    shuffleArr(slots,rng); const faces=st.faces.slice();
    order.forEach(([a,b],k)=>{ faces[a]=slots[k][0]; faces[b]=slots[k][1]; });
    st.undo.push({shuffle:true,faces:st.faces.slice(),seen:st.seen?st.seen.slice():null,order:st.order});
    st.faces=faces; st.order=order; /* the new build order is a winning line for the shuffled board */ st.shuffles++; st.assists.shuffle++; st.sel=-1; st.moves++; st.combo=0;
    if(st.seen){ st.seen=new Array(L.n).fill(0); revealFree(st); }
    return true; }
  return false; }
// Time Attack: the app advances the clock; at 0 the game is lost.
function tickClock(st,ms){ if(st.over) return false; st.t+=ms; if(st.ta){ st.ta.left-=ms; if(st.ta.left<=0){ st.ta.left=0; st.over=true; st.lost=true; return true; } } return false; }

// fingerprint of a board (layout + faces), for tests and the Daily
function boardPrint(lid,faces){ let h=2166136261; const add=v=>{ h^=v&255; h=Math.imul(h,16777619); };
  for(const c of lid) add(c.charCodeAt(0)); for(const f of faces) add(f+1); return (h>>>0).toString(16).padStart(8,'0'); }

// ---------- par time: about 1.1 s per pair for a casual player, adjusted by grade and layer depth ----------
const GRADE_PAR={easy:1,normal:1.1,hard:1.2,expert:1.3};
function parTime(L,grade,tiles){ const pairs=(tiles||L.n)/2; const depth=1+.05*Math.max(0,L.layers-2);
  return Math.ceil(pairs*1.1*GRADE_PAR[grade||'normal']*depth/5)*5; }
