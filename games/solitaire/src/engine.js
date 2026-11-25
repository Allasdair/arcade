// ===================== Solitaire engine (Klondike) =====================
// Pure: no DOM, no timers. The game state is plain JSON, so saves resume exactly and the solver and bots run it fast.
// Cards are 0..51: suit = c/13|0 (0 ♠, 1 ♥, 2 ♦, 3 ♣), rank = c%13 (0 = Ace … 12 = King). Hearts and diamonds are red.
// Stock and waste are one array, `deck`, in drawing order, with `wp` cards turned onto the waste:
//   waste = deck[0..wp) (top = deck[wp-1]); stock = deck[wp..) (next card drawn = deck[wp]).
//   A pass reset just sets wp = 0, which keeps the stock order exactly as a real reset does.
const SUITS=['♠','♥','♦','♣'], RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const suitOf=c=>(c/13)|0, rankOf=c=>c%13, isRed=c=>{ const s=(c/13)|0; return s===1||s===2; };
const cardName=c=>RANKS[c%13]+SUITS[(c/13)|0];

// ---------- seeded RNG (as in Sweep): cyrb128 → sfc32 ----------
function cyrb128(str){ let h1=1779033703,h2=3144134277,h3=1013904242,h4=2773480762;
  for(let i=0,k;i<str.length;i++){ k=str.charCodeAt(i); h1=h2^Math.imul(h1^k,597399067); h2=h3^Math.imul(h2^k,2869860233); h3=h4^Math.imul(h3^k,951274213); h4=h1^Math.imul(h4^k,2716044179); }
  h1=Math.imul(h3^(h1>>>18),597399067); h2=Math.imul(h4^(h2>>>22),2869860233); h3=Math.imul(h1^(h3>>>17),951274213); h4=Math.imul(h2^(h4>>>19),2716044179);
  return [(h1^h2^h3^h4)>>>0,(h2^h1)>>>0,(h3^h1)>>>0,(h4^h1)>>>0]; }
function sfc32(a,b,c,d){ return function(){ a>>>=0;b>>>=0;c>>>=0;d>>>=0; let t=(a+b)|0; a=b^(b>>>9); b=(c+(c<<3))|0; c=(c<<21)|(c>>>11); d=(d+1)|0; t=(t+d)|0; c=(c+t)|0; return (t>>>0)/4294967296; }; }
const rngFor=str=>{ const s=cyrb128(String(str)); return sfc32(s[0],s[1],s[2],s[3]); };
const dealSeed=n=>'SOL1|'+n; // bank deals are numbered; the seed string is the deal's identity

// ---------- config ----------
// draw: 1 or 3. passes: 0 = unlimited, or the number of times you may go through the stock (3 or 1).
// open: every card is dealt face up (the face-down ones are still blocked until uncovered: only the look changes).
// undo: null = unlimited, otherwise the number of undos allowed (0 = off). moveLimit: null or a number of moves.
const defCfg=o=>Object.assign({draw:1,passes:0,open:false,undo:null,moveLimit:null},o||{});

// ---------- deal ----------
function shuffled(seed){ const r=rngFor(seed), a=[]; for(let i=0;i<52;i++) a.push(i);
  for(let i=51;i>0;i--){ const j=Math.floor(r()*(i+1)); const t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
// Deal row by row: column i gets i+1 cards; the last card of each column is face up. The 24 left over form the stock.
function newGame(seed,cfg){ const d=shuffled(seed), cols=[[],[],[],[],[],[],[]]; let k=0;
  for(let row=0;row<7;row++) for(let c=row;c<7;c++) cols[c].push(d[k++]);
  return {v:1,seed:String(seed),cfg:defCfg(cfg),cols,down:[0,1,2,3,4,5,6],deck:d.slice(28),wp:0,f:[0,0,0,0],resets:0,
    moves:0,undos:0,hist:[],won:false,time:0,hints:0,autoUsed:false}; }
const cloneSt=st=>JSON.parse(JSON.stringify(st));

// ---------- snapshots (undo) ----------
const encC=a=>a.map(c=>String.fromCharCode(65+c)).join(''), decC=s=>[...s].map(ch=>ch.charCodeAt(0)-65);
function snap(st){ return st.f.join(',')+';'+st.wp+';'+st.resets+';'+st.down.join(',')+';'+st.cols.map(encC).join(',')+';'+encC(st.deck); }
function restore(st,s){ const p=s.split(';'); st.f=p[0].split(',').map(Number); st.wp=+p[1]; st.resets=+p[2]; st.down=p[3].split(',').map(Number);
  st.cols=p[4].split(',').map(decC); st.deck=decC(p[5]); st.won=st.f.every(n=>n===13); }
const UNDO_KEEP=2000;
function push(st){ st.hist.push(snap(st)); if(st.hist.length>UNDO_KEEP) st.hist.shift(); }

// ---------- reading the table ----------
const wasteTop=st=>st.wp>0?st.deck[st.wp-1]:-1;
const stockLeft=st=>st.deck.length-st.wp;
const canReset=st=>st.deck.length>0&&st.wp>=st.deck.length&&(st.cfg.passes===0||st.resets<st.cfg.passes-1);
const passesLeft=st=>st.cfg.passes===0?Infinity:st.cfg.passes-1-st.resets;
const fits=(card,onto)=>rankOf(onto)===rankOf(card)+1&&isRed(onto)!==isRed(card);
const toFound=(st,card)=>st.f[suitOf(card)]===rankOf(card);
// a valid run: alternating colours, ranks going down by one
function isRun(a,j){ for(let i=j+1;i<a.length;i++) if(!fits(a[i],a[i-1])) return false; return true; }
// the cards a source would move. from: {k:'t',i,j} | {k:'w'} | {k:'f',i}
function cardsOf(st,from){ if(from.k==='w') return st.wp>0?[st.deck[st.wp-1]]:[];
  if(from.k==='f'){ const n=st.f[from.i]; return n>0?[from.i*13+n-1]:[]; }
  const col=st.cols[from.i]; if(from.j==null||from.j<st.down[from.i]||from.j>=col.length||!isRun(col,from.j)) return []; return col.slice(from.j); }
function canPlace(st,cards,to){ if(!cards.length) return false; const c=cards[0];
  if(to.k==='f') return cards.length===1&&to.i===suitOf(c)&&toFound(st,c);
  const col=st.cols[to.i]; if(!col.length) return rankOf(c)===12; return fits(c,col[col.length-1]); }
function legal(st,from,to){ if(st.won) return false; if(from.k==='t'&&to.k==='t'&&from.i===to.i) return false; if(from.k==='f'&&to.k==='f') return false;
  return canPlace(st,cardsOf(st,from),to); }
const topSrc=(st,i)=>({k:'t',i,j:st.cols[i].length-1});

// Tap order: foundation → a non-empty tableau column (left to right) → an empty column.
function tapTargets(st,from){ const cards=cardsOf(st,from), out=[]; if(!cards.length) return out;
  if(from.k!=='f'){ const t={k:'f',i:suitOf(cards[0])}; if(canPlace(st,cards,t)) out.push(t); }
  const empty=[]; for(let i=0;i<7;i++){ if(from.k==='t'&&from.i===i) continue; const t={k:'t',i}; if(!canPlace(st,cards,t)) continue;
    // a King already at the bottom of its column gains nothing by moving to another empty column
    if(!st.cols[i].length){ if(from.k==='t'&&from.j===0) continue; empty.push(t); } else out.push(t); }
  return out.concat(empty.slice(0,1)); }

// Every legal move (sources: each face-up run start, the waste top, foundation tops). Used for highlights and stuck checks.
function legalMoves(st){ const out=[]; if(st.won) return out; const srcs=[];
  for(let i=0;i<7;i++){ const col=st.cols[i]; for(let j=st.down[i];j<col.length;j++) if(isRun(col,j)) srcs.push({k:'t',i,j}); }
  if(st.wp>0) srcs.push({k:'w'}); for(let i=0;i<4;i++) if(st.f[i]>0) srcs.push({k:'f',i});
  for(const s of srcs) for(const t of tapTargets(st,s)){ if(s.k==='f'&&t.k==='f') continue; out.push({from:s,to:t}); }
  return out; }

// ---------- making moves ----------
function flipAll(st){ const fl=[]; for(let i=0;i<7;i++) if(st.down[i]>0&&st.cols[i].length===st.down[i]){ st.down[i]--; fl.push(i); } return fl; }
function rawMove(st,from,to){ let cards;
  if(from.k==='w'){ cards=[st.deck[st.wp-1]]; st.deck.splice(st.wp-1,1); st.wp--; }
  else if(from.k==='f'){ cards=[from.i*13+st.f[from.i]-1]; st.f[from.i]--; }
  else { cards=st.cols[from.i].splice(from.j); }
  if(to.k==='f') st.f[to.i]++; else st.cols[to.i].push(...cards);
  return cards; }
// A player's move: counts 1. Returns {cards, flipped} or null if illegal. opts.free: an automatic move (counts 0, no undo step).
function move(st,from,to,opts){ opts=opts||{}; if(!legal(st,from,to)) return null;
  if(!opts.free) push(st);
  const cards=rawMove(st,from,to), flipped=flipAll(st);
  if(!opts.free) st.moves++;
  st.won=st.f.every(n=>n===13); return {cards,flipped}; }
// Tap the stock: turn 1 or 3 cards, or (stock empty) turn the waste back over if passes remain. Counts 1.
function draw(st){ if(st.won) return null; const L=st.deck.length;
  if(st.wp<L){ push(st); const from=st.wp; st.wp=Math.min(L,st.wp+st.cfg.draw); st.moves++; return {k:'draw',cards:st.deck.slice(from,st.wp)}; }
  if(canReset(st)){ push(st); st.wp=0; st.resets++; st.moves++; return {k:'reset'}; }
  return null; }
const undoLeft=st=>st.cfg.undo==null?Infinity:Math.max(0,st.cfg.undo-st.undos);
const canUndo=st=>st.hist.length>0&&undoLeft(st)>0&&!st.won;
// Undo restores the exact previous state (flips, stock position, passes) and itself counts as a move.
function undo(st){ if(!canUndo(st)) return false; restore(st,st.hist.pop()); st.undos++; st.moves++; return true; }

// ---------- automatic moves ----------
// Safe auto-move: a card goes up only when it can never be needed on the tableau again. The kickoff's rule (both
// opposite-colour cards one rank lower already up) is tightened to the provably safe form: Aces and 2s always; otherwise
// both opposite-colour suits must hold rank-1 and the other suit of the same colour rank-2.
function isSafe(st,c){ const r=rankOf(c), s=suitOf(c); if(!toFound(st,c)) return false; if(r<=1) return true;
  const red=s===1||s===2, opp=red?[0,3]:[1,2], same=red?(s===1?2:1):(s===0?3:0);
  return st.f[opp[0]]>=r&&st.f[opp[1]]>=r&&st.f[same]>=r-1; }
// The next safe card to send up (tableau tops, then the waste top), or null.
function nextSafe(st){ for(let i=0;i<7;i++){ const col=st.cols[i]; if(col.length>st.down[i]){ const c=col[col.length-1]; if(isSafe(st,c)) return {from:topSrc(st,i),to:{k:'f',i:suitOf(c)}}; } }
  const w=wasteTop(st); if(w>=0&&isSafe(st,w)) return {from:{k:'w'},to:{k:'f',i:suitOf(w)}}; return null; }
// Auto-complete: once the stock and waste are empty and every card is face up, the rest always goes up.
const canAutoComplete=st=>!st.won&&st.deck.length===0&&st.down.every(n=>n===0);
function autoStep(st){ let best=null;
  for(let i=0;i<7;i++){ const col=st.cols[i]; if(!col.length) continue; const c=col[col.length-1]; if(toFound(st,c)&&(!best||rankOf(c)<rankOf(best.c))) best={c,from:topSrc(st,i)}; }
  if(!best) return null; const to={k:'f',i:suitOf(best.c)}; const r=move(st,best.from,to,{free:true}); st.autoUsed=true; return r&&{from:best.from,to,cards:r.cards}; }

// ---------- encoding moves (puzzle positions and the stored solutions) ----------
// One character per action: 'd' draw/reset; 'u' undo is never stored. Moves: source + target, e.g. 'w3', 't2.4f', …
// Format: d | w<to> | f<i><to> | t<i>.<j><to>, where <to> is 'F' or a column digit 0-6.
function encMove(m){ const to=m.to.k==='f'?'F':String(m.to.i);
  if(m.from.k==='w') return 'w'+to; if(m.from.k==='f') return 'f'+m.from.i+to; return 't'+m.from.i+'.'+m.from.j+to; }
function decMove(s){ const to=s[s.length-1]==='F'?null:+s[s.length-1];
  let from; if(s[0]==='w') from={k:'w'}; else if(s[0]==='f') from={k:'f',i:+s[1]}; else { const [a,b]=s.slice(1,-1).split('.'); from={k:'t',i:+a,j:+b}; }
  return {from,to:to==null?{k:'f',i:-1}:{k:'t',i:to}}; }
// Apply an encoded action list ('d' or a move) to a state; foundation targets take the moving card's suit.
function playActions(st,list){ for(const a of list){ if(a==='d'){ if(!draw(st)) throw new Error('bad draw'); continue; }
    const m=decMove(a); if(m.to.i===-1){ const cs=cardsOf(st,m.from); m.to.i=suitOf(cs[0]); }
    if(!move(st,m.from,m.to)) throw new Error('bad move '+a); }
  return st; }
