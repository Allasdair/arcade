// ===================== Quintessence engine =====================
// Pure: no DOM. The whole game state is plain JSON (arrays of small numbers), so it saves after every move and
// resumes exactly. The same seed + the same moves always give the same board: every column has its own seeded
// stream of new pieces, and reshuffles, lava, Wisp targets, relics and Overflow draw from their own streams.

// ---------- seeded RNG (as in Sweep): cyrb128 → sfc32 ----------
function cyrb128(str){ let h1=1779033703,h2=3144134277,h3=1013904242,h4=2773480762;
  for(let i=0,k;i<str.length;i++){ k=str.charCodeAt(i); h1=h2^Math.imul(h1^k,597399067); h2=h3^Math.imul(h2^k,2869860233); h3=h4^Math.imul(h3^k,951274213); h4=h1^Math.imul(h4^k,2716044179); }
  h1=Math.imul(h3^(h1>>>18),597399067); h2=Math.imul(h4^(h2>>>22),2869860233); h3=Math.imul(h1^(h3>>>17),951274213); h4=Math.imul(h2^(h4>>>19),2716044179);
  return [(h1^h2^h3^h4)>>>0,(h2^h1)>>>0,(h3^h1)>>>0,(h4^h1)>>>0]; }
function sfc32(a,b,c,d){ return function(){ a>>>=0;b>>>=0;c>>>=0;d>>>=0; let t=(a+b)|0; a=b^(b>>>9); b=(c+(c<<3))|0; c=(c<<21)|(c>>>11); d=(d+1)|0; t=(t+d)|0; c=(c+t)|0; return (t>>>0)/4294967296; }; }
const rngFor=str=>{ const s=cyrb128(String(str)); return sfc32(s[0],s[1],s[2],s[3]); };
// a counter-based stream: the n-th draw of stream k depends only on (seed, k, n)
function mix3(a,b,c){ let h=(a^0x9e3779b9)>>>0; h=Math.imul(h^(b+0x7f4a7c15|0),0x85ebca6b); h^=h>>>13; h=Math.imul(h^(c+0x165667b1|0),0xc2b2ae35); h^=h>>>16; h=Math.imul(h,0x27d4eb2f); h^=h>>>15; return h>>>0; }
const ST_SHUF=1, ST_LAVA=2, ST_WISP=3, ST_OVER=4, ST_RELIC=5, ST_SURGE=6;
const draw=(st,k)=>mix3(st.si,k*7919+31,st.ctr[k]++)/4294967296;

// ---------- elements and specials ----------
const FIRE=0, WATER=1, EARTH=2, AIR=3, LIGHT=4, ICE=5, PRISM=6, RELIC=7;
const ELEMENTS=[{id:'fire',name:'Fire'},{id:'water',name:'Water'},{id:'earth',name:'Earth'},{id:'air',name:'Air'},{id:'lightning',name:'Lightning'},{id:'ice',name:'Ice'}];
const SURGE_H=1, SURGE_V=2, BURST=3, WISP=4, SPRISM=5, PRIMED=6;
const SPECIAL_NAMES=['','Surge','Surge','Burst','Wisp','Prism'];
const REACT={thaw:'Thaw!',quench:'Quench!',erode:'Erode!',clear:'Clear!',shatter:'Shatter!',freeze:'Freeze!'};
const SCORE_MATCH=[0,0,0,60,120,200], SCORE_HIT=20, SCORE_OB=30;
const isSpecial=s=>s>=1&&s<=5;

// ---------- board shapes: Sweep's masks ----------
const SHAPES=['heart','diamond','ring','cross','hourglass','islands'];
const SHAPE_NAMES={square:'Square',heart:'Heart',diamond:'Diamond',ring:'Ring',cross:'Cross',hourglass:'Hourglass',islands:'Twin Islands'};
function shapeMask(name,W,H){ const m=new Array(W*H).fill(1); if(!name||name==='square') return m;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const u=(x+.5)/W*2-1, v=(y+.5)/H*2-1; let on=1;
    if(name==='ring'){ const r=Math.hypot(u,v); on=r<=1.08&&r>=.42; }
    else if(name==='heart'){ const X=u*1.12, Y=-v*1.18+.2, a=X*X+Y*Y-1; on=a*a*a-X*X*Y*Y*Y<=0; }
    else if(name==='diamond') on=Math.abs(u)+Math.abs(v)<=1.2;
    else if(name==='cross') on=Math.abs(u)<=.46||Math.abs(v)<=.46;
    else if(name==='hourglass') on=Math.abs(u)<=Math.abs(v)*.95+.3;
    else if(name==='islands'){ const r1=Math.hypot((u+.5)*1.05,v*.9), r2=Math.hypot((u-.5)*1.05,v*.9); on=r1<=.58||r2<=.58||(Math.abs(v)<=.2&&Math.abs(u)<=.6); }
    m[y*W+x]=on?1:0; }
  // keep only the largest 4-connected region
  const seen=new Array(W*H).fill(-1); let best=-1, bestN=0, id=0;
  for(let i=0;i<W*H;i++){ if(!m[i]||seen[i]>=0) continue; let n=0; const q=[i]; seen[i]=id;
    while(q.length){ const c=q.pop(); n++; const cx=c%W, cy=(c/W)|0;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=cx+dx, ny=cy+dy; if(nx<0||ny<0||nx>=W||ny>=H) continue; const j=ny*W+nx; if(m[j]&&seen[j]<0){ seen[j]=id; q.push(j); } } }
    if(n>bestN){ bestN=n; best=id; } id++; }
  for(let i=0;i<W*H;i++) if(m[i]&&seen[i]!==best) m[i]=0;
  return m; }

// ---------- a new game ----------
// cfg: {W,H,ne,seed,shape,map (rows: '#' no cell, '.' piece, f/F frost 1/2, c chain, g fog, s/S/T stone 1-3, l lava, r relic),
//       pieces (rows of element digits, puzzle levels), goals:[{t,n,e}], limit (moves, 0 = none), relics:{total,max},
//       twist ('lava' | 'combos' | 'timed' | 'tight'), refill (default true)}
// Goal types: score · collect (e) · frost · stone · lava · fog · relic
function newGame(cfg){ const W=cfg.W||8, H=cfg.H||8, N=W*H, seed=String(cfg.seed||'x');
  const st={v:1,W,H,N,ne:cfg.ne||5,seed,si:cyrb128('QN|'+seed)[0],
    mask:shapeMask(cfg.shape,W,H),pe:new Array(N).fill(-1),ps:new Array(N).fill(0),pid:new Array(N).fill(0),
    fr:new Array(N).fill(0),ch:new Array(N).fill(0),fg:new Array(N).fill(0),stn:new Array(N).fill(0),lv:new Array(N).fill(0),
    colN:new Array(W).fill(0),colE:new Array(W).fill(0),ctr:[0,0,0,0,0,0,0,0],nid:1,
    score:0,gscore:0,moves:0,limit:cfg.limit||0,goals:(cfg.goals||[]).map(g=>Object.assign({},g)),got:[0,0,0,0,0,0],relicsOut:0,
    relic:{total:(cfg.relics&&cfg.relics.total)||0,max:(cfg.relics&&cfg.relics.max)||2,spawned:0},
    twist:cfg.twist||'',refill:cfg.refill!==false,over:false,won:false,stuck:false,ended:'',overflowed:false,
    shuffles:0,last:{cascade:0,specials:0,score:0,label:''},
    stats:{made:[0,0,0,0,0,0],combos:{},react:{},best:0,mostSp:0,matches:[0,0,0,0,0,0]}};
  const mapRow=(y,x)=>cfg.map&&cfg.map[y]?cfg.map[y][x]||'.':'.';
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const i=y*W+x, c=mapRow(y,x); if(c==='#') st.mask[i]=0; if(!st.mask[i]) continue;
    if(c==='f') st.fr[i]=1; else if(c==='F') st.fr[i]=2; else if(c==='c') st.ch[i]=1; else if(c==='g') st.fg[i]=1;
    else if(c==='s') st.stn[i]=1; else if(c==='S') st.stn[i]=2; else if(c==='T') st.stn[i]=3; else if(c==='l') st.lv[i]=1;
    else if(c==='r'){ st.pe[i]=RELIC; st.pid[i]=st.nid++; st.relic.spawned++; } }
  if(cfg.pieces){ // a fixed board (puzzle levels)
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const i=y*W+x, c=cfg.pieces[y]&&cfg.pieces[y][x]; if(!st.mask[i]||st.stn[i]||st.lv[i]||st.pe[i]===RELIC) continue;
      if(c>='0'&&c<='5'){ st.pe[i]=+c; st.pid[i]=st.nid++; } } }
  else fillFresh(st,'fill');
  st.init={frost:countOb(st,'fr'),stone:countOb(st,'stn'),lava:countOb(st,'lv'),fog:countOb(st,'fg'),chain:countOb(st,'ch')};
  return st; }
const countOb=(st,k)=>{ let n=0; for(let i=0;i<st.N;i++) if(st.mask[i]) n+=st[k][i]; return n; };
const pieceCell=(st,i)=>st.mask[i]&&!st.stn[i]&&!st.lv[i];
// Fill every piece cell so the board starts with no match and at least one swap (seeded; tries again if needed)
function fillFresh(st,tag){ for(let att=0;att<400;att++){ const r=rngFor(st.seed+'|'+tag+'|'+att);
    for(let i=0;i<st.N;i++) if(pieceCell(st,i)&&st.pe[i]!==RELIC){ st.pe[i]=-1; st.ps[i]=0; }
    for(let i=0;i<st.N;i++){ if(!pieceCell(st,i)||st.pe[i]===RELIC) continue; const ban=banned(st,i), ok=[];
      for(let e=0;e<st.ne;e++) if(!ban.includes(e)) ok.push(e);
      st.pe[i]=ok[Math.floor(r()*ok.length)]; }
    if(!findGroups(st).length&&hasSwap(st)){ for(let i=0;i<st.N;i++) if(st.pe[i]>=0&&st.pe[i]<6&&!st.pid[i]) st.pid[i]=st.nid++; return true; } }
  return false; }
// elements that would make a match (3 in a row or a 2×2 square) with the cells already filled above and to the left
function banned(st,i){ const W=st.W, x=i%W, y=(i/W)|0, pe=st.pe, b=[], m=j=>j>=0&&st.mask[j]&&pe[j]>=0&&pe[j]<6;
  if(x>=2&&m(i-1)&&m(i-2)&&pe[i-1]===pe[i-2]) b.push(pe[i-1]);
  if(y>=2&&m(i-W)&&m(i-2*W)&&pe[i-W]===pe[i-2*W]) b.push(pe[i-W]);
  if(x>=1&&y>=1&&m(i-1)&&m(i-W)&&m(i-W-1)&&pe[i-1]===pe[i-W]&&pe[i-1]===pe[i-W-1]) b.push(pe[i-1]);
  // pieces already placed to the right/below (relics only) can't clash
  return b; }

// ---------- building maps from recipes (campaign tools and the Daily) ----------
// Obstacle patterns are placed mirrored left/right. box x y w h · rows y0 y1 · bottom n · top n (relics) · scatter n ·
// *frost / *lava / *fog (seeded Daily patterns). Later entries overwrite earlier ones.
function buildMap(W,H,mask,ob,rnd){ const m=[]; for(let y=0;y<H;y++){ const row=[]; for(let x=0;x<W;x++) row.push(mask[y*W+x]?'.':'#'); m.push(row); }
  const put=(x,y,c)=>{ if(x<0||y<0||x>=W||y>=H||m[y][x]==='#') return; m[y][x]=c; const mx=W-1-x; if(m[y][mx]!=='#') m[y][mx]=c; };
  const colTop=x=>{ for(let y=0;y<H;y++) if(m[y][x]!=='#') return y; return -1; };
  const colBot=x=>{ for(let y=H-1;y>=0;y--) if(m[y][x]!=='#') return y; return -1; };
  for(const [c,p,...a] of ob||[]){
    if(p==='box'){ const [x0,y0,w,h]=a; for(let y=y0;y<y0+h;y++) for(let x=x0;x<x0+w;x++) put(x,y,c); }
    else if(p==='rows'){ for(let y=a[0];y<=a[1];y++) for(let x=0;x<W;x++) put(x,y,c); }
    else if(p==='bottom'){ for(let x=0;x<W;x++){ const b=colBot(x); for(let k=0;k<a[0];k++) if(b-k>=0) put(x,b-k,c); } }
    else if(p==='top'){ // relics: n on the top row, spread out
      const xs=[]; for(let x=0;x<W;x++) if(colTop(x)>=0) xs.push(x); const n=a[0]; for(let k=0;k<n;k++){ const x=xs[Math.floor((k+1)*xs.length/(n+1))]; m[colTop(x)][x]=c; } }
    else if(p==='scatter'){ for(let k=0;k<a[0];k++){ const x=Math.floor(rnd()*Math.ceil(W/2)), y=Math.floor(rnd()*H); put(x,y,c); } }
    else if(p==='*frost'){ const y0=3+Math.floor(rnd()*3); for(let y=y0;y<Math.min(H,y0+3);y++) for(let x=0;x<W;x++) if(rnd()<.6) put(x,y,rnd()<.25?'F':'f'); }
    else if(p==='*lava'){ const x=Math.floor(rnd()*3), y=H-2-Math.floor(rnd()*2); for(const [dx,dy] of [[0,0],[1,0],[0,1],[1,1]]) put(x+dx,y+dy,c); }
    else if(p==='*fog'){ const y0=2+Math.floor(rnd()*3), x0=Math.floor(rnd()*2); for(let y=y0;y<y0+3;y++) for(let x=x0;x<W-x0;x++) put(x,y,c); } }
  return m.map(r=>r.join('')); }

// ---------- cell rules ----------
// fixed: doesn't fall and can't be swapped (stone, lava, frost, chains, fog, or no cell)
const fixedCell=(st,i)=>!st.mask[i]||st.stn[i]>0||st.lv[i]>0||st.fr[i]>0||st.ch[i]>0||st.fg[i]>0;
const movable=(st,i)=>st.mask[i]&&st.pe[i]>=0&&!fixedCell(st,i);
// frost and chains can still be matched; fog hides its piece, so it can't
const matchable=(st,i)=>st.mask[i]&&st.pe[i]>=0&&st.pe[i]<6&&!st.fg[i]&&st.ps[i]!==PRIMED&&!st.stn[i]&&!st.lv[i];
const locked=(st,i)=>st.fr[i]>0||st.ch[i]>0||st.fg[i]>0;
const neighbours=(st,i)=>{ const W=st.W, x=i%W, o=[]; if(x>0) o.push(i-1); if(x<W-1) o.push(i+1); if(i>=W) o.push(i-W); if(i+W<st.N) o.push(i+W); return o; };
const adjacent=(st,a,b)=>neighbours(st,a).includes(b);

// ---------- matching ----------
// Groups of 3+ in a row or column, or 2×2 squares, joined when they touch and share an element.
// The special a group makes: 5 in a line (Prism) > L or T (Burst) > 4 in a line (Surge) > 2×2 (Wisp) > 3 (none).
function findGroups(st){ const W=st.W, H=st.H, N=st.N, pe=st.pe, inM=new Uint8Array(N), hL=new Uint8Array(N), vL=new Uint8Array(N), hS=new Int16Array(N), vS=new Int16Array(N), sq=new Int16Array(N).fill(-1);
  const m=new Uint8Array(N); let any=0; for(let i=0;i<N;i++) m[i]=matchable(st,i)?1:0;
  for(let y=0;y<H;y++){ let x=0; while(x<W){ const i=y*W+x; if(!m[i]){ x++; continue; } let x2=x; while(x2+1<W&&m[i+x2+1-x]&&pe[i+x2+1-x]===pe[i]) x2++; const len=x2-x+1;
      if(len>=3){ any=1; for(let k=x;k<=x2;k++){ const j=y*W+k; inM[j]=1; hL[j]=len; hS[j]=i; } } x=x2+1; } }
  for(let x=0;x<W;x++){ let y=0; while(y<H){ const i=y*W+x; if(!m[i]){ y++; continue; } let y2=y; while(y2+1<H&&m[(y2+1)*W+x]&&pe[(y2+1)*W+x]===pe[i]) y2++; const len=y2-y+1;
      if(len>=3){ any=1; for(let k=y;k<=y2;k++){ const j=k*W+x; inM[j]=1; vL[j]=len; vS[j]=i; } } y=y2+1; } }
  for(let y=0;y<H-1;y++) for(let x=0;x<W-1;x++){ const i=y*W+x, e=pe[i]; if(m[i]&&m[i+1]&&m[i+W]&&m[i+W+1]&&pe[i+1]===e&&pe[i+W]===e&&pe[i+W+1]===e){ any=1; for(const j of [i,i+1,i+W,i+W+1]){ inM[j]=1; if(sq[j]<0) sq[j]=i; } } }
  if(!any) return [];
  const seen=new Uint8Array(N), groups=[];
  for(let i=0;i<N;i++){ if(!inM[i]||seen[i]) continue; const e=pe[i], cells=[], q=[i]; seen[i]=1;
    while(q.length){ const c=q.pop(); cells.push(c); for(const j of neighbours(st,c)) if(inM[j]&&!seen[j]&&pe[j]===e){ seen[j]=1; q.push(j); } }
    cells.sort((a,b)=>a-b);
    let maxRun=0, runCell=-1, runH=1, cross=-1, sqc=-1;
    for(const c of cells){ if(hL[c]>maxRun){ maxRun=hL[c]; runCell=c; runH=1; } if(vL[c]>maxRun){ maxRun=vL[c]; runCell=c; runH=0; }
      if(hL[c]>=3&&vL[c]>=3&&cross<0) cross=c; if(sq[c]>=0&&sqc<0) sqc=sq[c]; }
    let sp=0, anchor=cells[0];
    const mid=(start,len,h)=>start+(h?1:W)*Math.floor((len-1)/2);
    if(maxRun>=5){ sp=SPRISM; anchor=mid(runH?hS[runCell]:vS[runCell],maxRun,runH); }
    else if(cross>=0){ sp=BURST; anchor=cross; }
    else if(maxRun===4){ sp=runH?SURGE_H:SURGE_V; anchor=mid(runH?hS[runCell]:vS[runCell],4,runH); }
    else if(sqc>=0){ sp=WISP; anchor=sqc; }
    else if(maxRun>=3) anchor=mid(runH?hS[runCell]:vS[runCell],maxRun,runH);
    groups.push({e,cells,sp,anchor,size:cells.length}); }
  return groups; }
// does the piece at i make a match where it stands?
function matchAt(st,i){ if(!matchable(st,i)) return false; const W=st.W, H=st.H, x=i%W, y=(i/W)|0, e=st.pe[i], same=j=>matchable(st,j)&&st.pe[j]===e;
  let h=1; for(let k=x-1;k>=0&&same(y*W+k);k--) h++; for(let k=x+1;k<W&&same(y*W+k);k++) h++; if(h>=3) return true;
  let v=1; for(let k=y-1;k>=0&&same(k*W+x);k--) v++; for(let k=y+1;k<H&&same(k*W+x);k++) v++; if(v>=3) return true;
  for(const [dx,dy] of [[-1,-1],[0,-1],[-1,0],[0,0]]){ const x0=x+dx, y0=y+dy; if(x0<0||y0<0||x0>=W-1||y0>=H-1) continue; const j=y0*W+x0;
    if(same(j)&&same(j+1)&&same(j+W)&&same(j+W+1)) return true; }
  return false; }
function swapCells(st,a,b){ for(const k of ['pe','ps','pid']){ const t=st[k][a]; st[k][a]=st[k][b]; st[k][b]=t; } }
// a swap is valid if it makes a match, or involves a Prism (with any element piece or special), or joins two specials
function validSwap(st,a,b){ if(!adjacent(st,a,b)||!movable(st,a)||!movable(st,b)) return false;
  const ea=st.pe[a], eb=st.pe[b], sa=st.ps[a], sb=st.ps[b];
  if(ea===RELIC&&eb===RELIC) return false;
  if(sa===SPRISM||sb===SPRISM) return !(ea===RELIC||eb===RELIC);
  if(isSpecial(sa)&&isSpecial(sb)) return true;
  swapCells(st,a,b); const ok=matchAt(st,a)||matchAt(st,b); swapCells(st,a,b); return ok; }
function listSwaps(st){ const o=[]; for(let i=0;i<st.N;i++){ if(!movable(st,i)) continue; const x=i%st.W;
    if(x<st.W-1&&validSwap(st,i,i+1)) o.push([i,i+1]); if(i+st.W<st.N&&validSwap(st,i,i+st.W)) o.push([i,i+st.W]); } return o; }
function hasSwap(st){ for(let i=0;i<st.N;i++){ if(!movable(st,i)) continue; if(i%st.W<st.W-1&&validSwap(st,i,i+1)) return true; if(i+st.W<st.N&&validSwap(st,i,i+st.W)) return true; } return false; }

// ---------- the recorder (animation frames for the app; off for bots) ----------
let REC=null, CUR=null;
const snap=st=>({pe:st.pe.slice(),ps:st.ps.slice(),pid:st.pid.slice(),fr:st.fr.slice(),ch:st.ch.slice(),fg:st.fg.slice(),stn:st.stn.slice(),lv:st.lv.slice()});
function frame(st,kind,extra){ if(REC) REC.push(Object.assign({kind,b:snap(st),score:st.score},extra||{})); }

// ---------- clearing ----------
// A step: everything that clears at once (match groups, the specials they set off, a combo, primed Bursts).
function newStep(st,k){ return {k,hit:new Uint8Array(st.N),q:[],rm:[],fx:[],react:[],ob:[],groups:[],newSp:[],lavaCleared:false,specials:0}; }
function addReact(st,i,kind){ CUR.react.push({c:i,kind}); st.stats.react[kind]=(st.stats.react[kind]||0)+1; }
// hit a cell once: obstacles lose a layer; a free piece is removed (setting off its special); a Burst primes instead
function hitCell(st,i,byMatch){ const C=CUR; if(i<0||i>=st.N||!st.mask[i]||C.hit[i]) return; C.hit[i]=1;
  if(st.stn[i]>0){ st.stn[i]--; C.ob.push({c:i,t:'stone'}); obScore(st); return; }
  if(st.lv[i]){ st.lv[i]=0; C.lavaCleared=true; C.ob.push({c:i,t:'lava'}); obScore(st); return; }
  if(st.fg[i]){ st.fg[i]=0; C.ob.push({c:i,t:'fog'}); obScore(st); return; }
  if(st.pe[i]<0) return;
  // frost and chains: a match takes a layer and clears the piece once it's free; a blast only takes the layer
  if(st.fr[i]>0){ st.fr[i]--; C.ob.push({c:i,t:'frost'}); obScore(st); if(!byMatch||st.fr[i]>0) return; }
  else if(st.ch[i]){ st.ch[i]=0; C.ob.push({c:i,t:'chain'}); obScore(st); if(!byMatch) return; }
  const e=st.pe[i], s=st.ps[i]; if(e===RELIC) return;
  if(s===BURST){ st.ps[i]=PRIMED; C.q.push({t:'box',c:i,r:1}); C.specials++; return; }
  C.rm.push({c:i,e,s,id:st.pid[i]}); st.pe[i]=-1; st.ps[i]=0; st.pid[i]=0;
  if(e<6) st.got[e]++;
  if(!byMatch){ st.score+=SCORE_HIT*C.k; st.gscore+=SCORE_HIT*C.k; }
  if(s===SURGE_H){ C.q.push({t:'row',c:i}); C.specials++; } else if(s===SURGE_V){ C.q.push({t:'col',c:i}); C.specials++; }
  else if(s===WISP){ C.q.push({t:'wisp',c:i}); C.specials++; } else if(s===SPRISM){ C.q.push({t:'prism',c:i,e:commonElement(st)}); C.specials++; }
  else if(s===PRIMED) C.q.push({t:'box',c:i,r:1}); }
const obScore=st=>{ st.score+=SCORE_OB; st.gscore+=SCORE_OB; };
// remove a piece without setting off its special (the two pieces of a combo)
function consume(st,i){ const C=CUR; C.hit[i]=1; if(st.pe[i]<0) return; C.rm.push({c:i,e:st.pe[i],s:st.ps[i],id:st.pid[i]}); if(st.pe[i]<6) st.got[st.pe[i]]++; st.pe[i]=-1; st.ps[i]=0; st.pid[i]=0; }
function commonElement(st){ const n=[0,0,0,0,0,0]; for(let i=0;i<st.N;i++) if(matchable(st,i)) n[st.pe[i]]++; let b=0; for(let e=1;e<st.ne;e++) if(n[e]>n[b]) b=e; return b; }
const cellsRow=(st,y)=>{ const o=[]; if(y<0||y>=st.H) return o; for(let x=0;x<st.W;x++) o.push(y*st.W+x); return o; };
const cellsCol=(st,x)=>{ const o=[]; if(x<0||x>=st.W) return o; for(let y=0;y<st.H;y++) o.push(y*st.W+x); return o; };
function cellsBox(st,c,r){ const W=st.W, x0=c%W, y0=(c/W)|0, o=[]; for(let y=y0-r;y<=y0+r;y++) for(let x=x0-r;x<=x0+r;x++) if(x>=0&&y>=0&&x<W&&y<st.H) o.push(y*W+x); return o; }
function hitAll(st,cells){ for(const j of cells) hitCell(st,j,false); }
// The Wisp's target: a goal obstacle first, then the cell under the lowest relic, then a piece of the element
// the goal wants (or the most common one). Ties are broken by the Wisp stream.
function wispTarget(st){ const C=CUR, ok=i=>st.mask[i]&&!C.hit[i], pick=a=>a.length?a[Math.floor(draw(st,ST_WISP)*a.length)]:-1, gs=st.goals.map(g=>g.t);
  const obs=[]; for(let i=0;i<st.N;i++){ if(!ok(i)) continue;
    if((gs.includes('frost')&&st.fr[i])||(gs.includes('stone')&&st.stn[i])||(gs.includes('lava')&&st.lv[i])||(gs.includes('fog')&&st.fg[i])) obs.push(i); }
  if(obs.length) return pick(obs);
  if(gs.includes('relic')){ let best=-1; for(let i=0;i<st.N;i++) if(st.pe[i]===RELIC&&i+st.W<st.N&&ok(i+st.W)&&st.pe[i+st.W]>=0&&(best<0||i>best)) best=i; if(best>=0) return best+st.W; }
  const anyOb=[]; for(let i=0;i<st.N;i++) if(ok(i)&&(st.fr[i]||st.stn[i]||st.lv[i]||st.fg[i]||st.ch[i])) anyOb.push(i);
  if(anyOb.length) return pick(anyOb);
  const col=st.goals.find(g=>g.t==='collect'&&st.got[g.e]<g.n), e=col?col.e:commonElement(st), same=[];
  for(let i=0;i<st.N;i++) if(ok(i)&&st.pe[i]===e&&!st.ps[i]) same.push(i);
  if(same.length) return pick(same);
  const any=[]; for(let i=0;i<st.N;i++) if(ok(i)&&st.pe[i]>=0&&st.pe[i]<6) any.push(i); return pick(any); }
// Run the step's queue: every special that went off adds its area, which can set off more.
function runQueue(st){ const C=CUR; let guard=0;
  while(C.q.length&&guard++<500){ const a=C.q.shift(), W=st.W, x=a.c%W, y=(a.c/W)|0;
    if(a.t==='row'){ C.fx.push({t:'row',y,c:a.c}); hitAll(st,cellsRow(st,y)); }
    else if(a.t==='col'){ C.fx.push({t:'col',x,c:a.c}); hitAll(st,cellsCol(st,x)); }
    else if(a.t==='box'){ C.fx.push({t:'box',c:a.c,r:a.r}); hitAll(st,cellsBox(st,a.c,a.r)); }
    else if(a.t==='cross'){ C.fx.push({t:'row',y,c:a.c}); C.fx.push({t:'col',x,c:a.c}); hitAll(st,cellsRow(st,y)); hitAll(st,cellsCol(st,x)); }
    else if(a.t==='band'){ C.fx.push({t:'band',c:a.c}); for(let d=-1;d<=1;d++){ hitAll(st,cellsRow(st,y+d)); hitAll(st,cellsCol(st,x+d)); } }
    else if(a.t==='wisp'){ hitAll(st,neighbours(st,a.c)); const n=a.n||1;
      for(let k=0;k<n;k++){ const t=wispTarget(st); if(t<0) break; C.fx.push({t:'wisp',from:a.c,to:t,carry:a.carry||0});
        if(a.carry===SURGE_H||a.carry===SURGE_V) C.q.push({t:a.carry===SURGE_H?'row':'col',c:t});
        else if(a.carry===BURST){ C.q.push({t:'box',c:t,r:1}); st._later=(st._later||[]).concat([{c:t,r:1}]); }
        hitCell(st,t,false); } }
    else if(a.t==='prism'){ C.fx.push({t:'prism',c:a.c,e:a.e}); for(let i=0;i<st.N;i++) if(st.pe[i]===a.e&&!st.fg[i]) hitCell(st,i,false); } } }

// match groups clear together, damage obstacles next to them, and leave their specials behind
function clearGroups(st,groups,k,moved){ const C=CUR; C.groups=groups.map(g=>({e:g.e,cells:g.cells.slice(),sp:g.sp}));
  for(const g of groups){ const base=SCORE_MATCH[Math.min(5,g.size)]*k; st.score+=base; if(st.twist!=='combos') st.gscore+=base; st.stats.matches[g.e]++;
    const inG=new Set(g.cells);
    // reactions on pieces inside the match: Fire thaws all frost; Lightning breaks chains in the row and column
    for(const c of g.cells){ if(g.e===FIRE&&st.fr[c]>1){ st.fr[c]=1; addReact(st,c,'thaw'); }
      if(g.e===LIGHT&&st.ch[c]) shatter(st,c); }
    for(const c of g.cells) hitCell(st,c,true);
    const adj=new Set(); for(const c of g.cells) for(const j of neighbours(st,c)) if(!inG.has(j)) adj.add(j);
    for(const j of adj) reactAdj(st,j,g.e); }
  runQueue(st);
  // specials appear on the piece the player moved if it's in the match, otherwise in the middle of the match
  for(const g of groups){ if(!g.sp) continue; const free=c=>st.mask[c]&&st.pe[c]<0&&!st.stn[c]&&!st.lv[c]&&!locked(st,c);
    let at=-1; for(const m of moved||[]) if(g.cells.includes(m)&&free(m)){ at=m; break; }
    if(at<0&&free(g.anchor)) at=g.anchor; if(at<0) at=g.cells.find(free); if(at==null||at<0) continue;
    st.pe[at]=g.sp===SPRISM?PRISM:g.e; st.ps[at]=g.sp; st.pid[at]=st.nid++; st.stats.made[g.sp]++; C.newSp.push(at); } }
function shatter(st,c){ const W=st.W, x=c%W, y=(c/W)|0; let any=0;
  for(const j of cellsRow(st,y).concat(cellsCol(st,x))) if(st.ch[j]&&!CUR.hit[j]){ st.ch[j]=0; CUR.hit[j]=1; CUR.ob.push({c:j,t:'chain'}); obScore(st); any=1; }
  if(any) addReact(st,c,'shatter'); }
// a match next to an obstacle: −1 layer; the reacting element does more
function reactAdj(st,j,e){ const C=CUR; if(!st.mask[j]||C.hit[j]) return;
  if(st.stn[j]>0){ C.hit[j]=1; const d=e===AIR?2:1; st.stn[j]=Math.max(0,st.stn[j]-d); C.ob.push({c:j,t:'stone'}); obScore(st); if(e===AIR) addReact(st,j,'erode'); return; }
  if(st.lv[j]){ C.hit[j]=1;
    if(e===ICE){ st.lv[j]=0; st.stn[j]=1; C.lavaCleared=true; C.ob.push({c:j,t:'lava'}); obScore(st); addReact(st,j,'freeze'); return; }
    st.lv[j]=0; C.lavaCleared=true; C.ob.push({c:j,t:'lava'}); obScore(st);
    if(e===WATER){ for(const n of neighbours(st,j)) if(st.lv[n]&&!C.hit[n]){ C.hit[n]=1; st.lv[n]=0; C.ob.push({c:n,t:'lava'}); obScore(st); } addReact(st,j,'quench'); } return; }
  if(st.fg[j]){ C.hit[j]=1; st.fg[j]=0; C.ob.push({c:j,t:'fog'}); obScore(st);
    if(e===EARTH){ for(const n of cellsBox(st,j,1)) if(st.fg[n]&&!C.hit[n]){ C.hit[n]=1; st.fg[n]=0; C.ob.push({c:n,t:'fog'}); obScore(st); } addReact(st,j,'clear'); } return; }
  if(st.fr[j]>0){ C.hit[j]=1; if(e===FIRE){ st.fr[j]=0; addReact(st,j,'thaw'); } else st.fr[j]--; C.ob.push({c:j,t:'frost'}); obScore(st); return; }
  if(st.ch[j]&&e===LIGHT) shatter(st,j); }

// ---------- gravity and seeded refills ----------
// Each column splits into segments at gaps and fixed cells; pieces fall to the bottom of their segment and new
// pieces enter at its top. The next new piece in a column depends only on how many have fallen into it so far.
function spawn(st,x){ const R=st.relic;
  if(R.total&&R.spawned<R.total){ let on=0; for(let i=0;i<st.N;i++) if(st.pe[i]===RELIC) on++;
    if(on<R.max&&(on===0||draw(st,ST_RELIC)<.12)){ R.spawned++; return RELIC; } }
  const n=st.colN[x]++, e=n===0?mix3(st.si,1000+x,0)%st.ne:(st.colE[x]+1+mix3(st.si,1000+x,n)%(st.ne-1))%st.ne; st.colE[x]=e; return e; }
// The n-th piece of a column is never the same element as the one before it in that column's stream (this keeps
// cascades from running away, mostly on 4 elements). It is still a function of (seed, column, n) only.
function gravity(st){ const W=st.W, H=st.H, drops=[]; let moved=false;
  for(let x=0;x<W;x++){ let y=H-1;
    while(y>=0){ const i=y*W+x; if(fixedCell(st,i)){ y--; continue; }
      let top=y; while(top-1>=0&&!fixedCell(st,(top-1)*W+x)) top--;
      // segment rows top..y: compact pieces to the bottom
      let w=y; for(let r=y;r>=top;r--){ const c=r*W+x; if(st.pe[c]>=0){ if(r!==w){ const d=w*W+x; st.pe[d]=st.pe[c]; st.ps[d]=st.ps[c]; st.pid[d]=st.pid[c]; st.pe[c]=-1; st.ps[c]=0; st.pid[c]=0; drops.push({id:st.pid[d],x,fy:r,ty:w}); moved=true; } w--; } }
      const empty=w-top+1;
      if(st.refill) for(let r=w,k=0;r>=top;r--,k++){ const c=r*W+x; st.pe[c]=spawn(st,x); st.ps[c]=0; st.pid[c]=st.nid++; drops.push({id:st.pid[c],x,fy:top-1-k,ty:r,top,nw:1}); moved=true; }
      void empty; y=top-1; } }
  return {drops,moved}; }
// relics leave through the bottom of a column segment that ends at the board's edge
function relicExits(st){ const W=st.W, out=[]; for(let i=0;i<st.N;i++){ if(st.pe[i]!==RELIC) continue; const b=i+W;
    if(b>=st.N||!st.mask[b]){ out.push({c:i,e:RELIC,s:0,id:st.pid[i]}); st.pe[i]=-1; st.ps[i]=0; st.pid[i]=0; st.relicsOut++; } } return out; }
function settle(st,k){ for(let guard=0;guard<20;guard++){ const g=gravity(st); if(g.moved) frame(st,'fall',{drops:g.drops,k}); const out=relicExits(st); if(!out.length) return; frame(st,'relic',{rm:out,k}); st.score+=500; st.gscore+=500; } }

// ---------- a move ----------
// Returns {ok, frames (when recording)}. An invalid swap changes nothing and uses no move.
function doSwap(st,a,b,record){ if(st.over||!validSwap(st,a,b)) return {ok:false};
  REC=record?[]:null; const sc0=st.score; let k=1, cascade=0, specials=0, combo='', bigCascadeLabel='';
  frame(st,'swap',{ca:a,cb:b});
  swapCells(st,a,b); st.moves++; frame(st,'swapped',{ca:a,cb:b});
  const sa=st.ps[b], sb=st.ps[a]; // the moved piece now sits at b
  if(sa===SPRISM||sb===SPRISM||(isSpecial(sa)&&isSpecial(sb))){ CUR=newStep(st,k); combo=doCombo(st,b,a); specials+=CUR.specials; endStep(st); settle(st,k); k++; cascade++; }
  let first=!combo;
  for(let guard=0;guard<200;guard++){ const groups=findGroups(st);
    if(groups.length){ CUR=newStep(st,k); clearGroups(st,groups,k,first?[b,a]:null); first=false; specials+=CUR.specials; endStep(st); settle(st,k); k++; cascade++; continue; }
    // primed Bursts (and second blasts) go off once the board settles
    const primed=[]; for(let i=0;i<st.N;i++) if(st.ps[i]===PRIMED) primed.push(i);
    const later=st._later||[]; st._later=null;
    if(primed.length||later.length){ CUR=newStep(st,k); for(const c of primed) hitCell(st,c,false); for(const L of later){ CUR.fx.push({t:'box',c:L.c,r:L.r}); hitAll(st,cellsBox(st,L.c,L.r)); }
      runQueue(st); specials+=CUR.specials; endStep(st); settle(st,k); k++; cascade++; continue; }
    break; }
  afterMove(st,cascade,specials,combo,sc0);
  const fr=REC; REC=null; CUR=null; return {ok:true,frames:fr,cascade,specials,combo,label:st.last.label}; }
function endStep(st){ const C=CUR; if(C.lavaCleared) st._lavaCleared=true;
  frame(st,'clear',{rm:C.rm,fx:C.fx,react:C.react,ob:C.ob,groups:C.groups,newSp:C.newSp,k:C.k}); }
// combos: two specials swapped together (or a Prism with anything)
function doCombo(st,at,other){ const C=CUR, s1=st.ps[at], s2=st.ps[other], e1=st.pe[at], e2=st.pe[other];
  const kind=(x,y)=>(s1===x&&s2===y)||(s1===y&&s2===x), surge=s=>s===SURGE_H||s===SURGE_V;
  let name='';
  if(s1===SPRISM&&s2===SPRISM){ name='prism+prism'; consume(st,at); consume(st,other); C.fx.push({t:'all',c:at}); for(let i=0;i<st.N;i++) hitCell(st,i,false); }
  else if(s1===SPRISM||s2===SPRISM){ const pc=s1===SPRISM?at:other, oc=pc===at?other:at, os=st.ps[oc], oe=st.pe[oc];
    if(isSpecial(os)){ name='prism+'+(surge(os)?'surge':os===BURST?'burst':'wisp'); const e=commonElement(st); consume(st,pc); consume(st,oc); C.fx.push({t:'prism',c:pc,e});
      const conv=[]; for(let i=0;i<st.N;i++) if(st.pe[i]===e&&!st.ps[i]&&!st.fg[i]){ st.ps[i]=surge(os)?(draw(st,ST_SURGE)<.5?SURGE_H:SURGE_V):os; conv.push(i); }
      C.fx.push({t:'convert',cells:conv,s:os}); for(const i of conv) hitCell(st,i,false); }
    else { name='prism'; consume(st,pc); C.fx.push({t:'prism',c:pc,e:oe}); for(let i=0;i<st.N;i++) if(st.pe[i]===oe&&!st.fg[i]) hitCell(st,i,false); } }
  else { consume(st,at); consume(st,other);
    if(surge(s1)&&surge(s2)){ name='surge+surge'; C.q.push({t:'cross',c:at}); }
    else if(kind(BURST,SURGE_H)||kind(BURST,SURGE_V)){ name='surge+burst'; C.q.push({t:'band',c:at}); }
    else if(s1===BURST&&s2===BURST){ name='burst+burst'; C.q.push({t:'box',c:at,r:2}); st._later=(st._later||[]).concat([{c:at,r:2}]); }
    else if(s1===WISP&&s2===WISP){ name='wisp+wisp'; C.q.push({t:'wisp',c:at,n:3}); }
    else { const carry=s1===WISP?s2:s1; name='wisp+'+(surge(carry)?'surge':'burst'); C.q.push({t:'wisp',c:at,carry}); } }
  C.specials+=2; st.stats.combos[name]=(st.stats.combos[name]||0)+1;
  runQueue(st); return name; }
// after the board settles: lava spreads, goals are checked, and a dead board reshuffles for free
function afterMove(st,cascade,specials,combo,sc0){
  if(countOb(st,'lv')&&(!st._lavaCleared||st.twist==='lava')) spreadLava(st);
  st._lavaCleared=false;
  st.last={cascade,specials,score:st.score-sc0,combo,label:announceWord(cascade,combo)};
  st.stats.best=Math.max(st.stats.best,cascade); st.stats.mostSp=Math.max(st.stats.mostSp,specials);
  if(goalsMet(st)&&st.goals.length){ st.won=true; st.over=true; st.ended='goal'; return; }
  if(st.limit&&st.moves>=st.limit){ st.over=true; st.ended='moves'; st.won=!st.goals.length; return; }
  if(st.sim) return; // a bot's look at a swap: no reshuffle, no end
  if(!hasSwap(st)){ if(!st.refill||!reshuffle(st)){ st.over=true; st.stuck=true; st.ended='stuck'; st.won=!st.goals.length; } } }
const announceWord=(c,combo)=>combo==='prism+prism'||c>=12?'Quintessence!':c>=9?'Elemental!':c>=7||(combo&&combo.startsWith('prism+'))?'Storm!':c>=5||combo?'Surge!':c>=3?'Flow!':'';
function spreadLava(st){ const cand=[]; for(let i=0;i<st.N;i++){ if(!st.lv[i]) continue; for(const j of neighbours(st,i)) if(st.mask[j]&&st.pe[j]>=0&&st.pe[j]<7&&!st.lv[j]&&!st.stn[j]&&!cand.includes(j)) cand.push(j); }
  if(!cand.length) return; cand.sort((a,b)=>a-b); const j=cand[Math.floor(draw(st,ST_LAVA)*cand.length)];
  st.pe[j]=-1; st.ps[j]=0; st.pid[j]=0; st.fr[j]=0; st.ch[j]=0; st.fg[j]=0; st.lv[j]=1; frame(st,'lava',{c:j}); }
// a free, seeded reshuffle: movable pieces trade places until there's a swap and no match; obstacles stay put
function reshuffle(st){ const cells=[]; for(let i=0;i<st.N;i++) if(movable(st,i)&&st.pe[i]!==RELIC) cells.push(i);
  if(cells.length<3) return false; const orig=cells.map(i=>[st.pe[i],st.ps[i],st.pid[i]]);
  for(let att=0;att<120;att++){ const vals=orig.map(v=>v.slice());
    if(att>=60){ for(const v of vals) if(!v[1]) v[0]=Math.floor(draw(st,ST_SHUF)*st.ne); } // still stuck: new elements from the stream
    for(let i=vals.length-1;i>0;i--){ const j=Math.floor(draw(st,ST_SHUF)*(i+1)); const t=vals[i]; vals[i]=vals[j]; vals[j]=t; }
    cells.forEach((c,k)=>{ st.pe[c]=vals[k][0]; st.ps[c]=vals[k][1]; st.pid[c]=vals[k][2]; });
    if(!findGroups(st).length&&hasSwap(st)){ st.shuffles++; frame(st,'shuffle'); return true; } }
  cells.forEach((c,k)=>{ st.pe[c]=orig[k][0]; st.ps[c]=orig[k][1]; st.pid[c]=orig[k][2]; }); return false; }

// ---------- goals ----------
const GOAL_OB={frost:'fr',stone:'stn',lava:'lv',fog:'fg'};
function goalProgress(st,g){ if(g.t==='score') return [Math.min(st.gscore,g.n),g.n];
  if(g.t==='collect') return [Math.min(st.got[g.e],g.n),g.n];
  if(g.t==='relic') return [Math.min(st.relicsOut,g.n),g.n];
  const k=GOAL_OB[g.t]; if(k){ const init=g.n||st.init[g.t]||0, left=countOb(st,k); return [Math.max(0,init-left),init]; }
  return [0,1]; }
const goalDone=(st,g)=>{ const [a,b]=goalProgress(st,g); return a>=b; };
const goalsMet=st=>st.goals.every(g=>goalDone(st,g));
const movesLeft=st=>st.limit?Math.max(0,st.limit-st.moves):0;

// ---------- Overflow: the level-end light show ----------
// Each move left turns a random piece into a Surge and sets it off; then every special still on the board goes off.
// The score is the same whether the animation plays or is skipped.
function overflow(st,record){ if(!st.won||st.overflowed) return {frames:[],bonus:0}; st.overflowed=true; REC=record?[]:null; const sc0=st.score;
  const left=movesLeft(st);
  for(let n=0;n<left;n++){ const cand=[]; for(let i=0;i<st.N;i++) if(st.mask[i]&&st.pe[i]>=0&&st.pe[i]<6&&!st.ps[i]&&!locked(st,i)) cand.push(i); if(!cand.length) break;
    const c=cand[Math.floor(draw(st,ST_OVER)*cand.length)]; st.ps[c]=draw(st,ST_OVER)<.5?SURGE_H:SURGE_V; frame(st,'mark',{c});
    CUR=newStep(st,1); hitCell(st,c,false); runQueue(st); endStep(st); settle(st,1); cascadeOut(st); }
  for(let guard=0;guard<30;guard++){ const sp=[]; for(let i=0;i<st.N;i++) if(isSpecial(st.ps[i])||st.ps[i]===PRIMED) sp.push(i); if(!sp.length) break;
    CUR=newStep(st,1); for(const c of sp) if(st.ps[c]===SPRISM){ consume(st,c); CUR.q.push({t:'prism',c,e:commonElement(st)}); } else hitCell(st,c,false); runQueue(st); endStep(st); settle(st,1); cascadeOut(st); }
  const fr=REC; REC=null; CUR=null; return {frames:fr,bonus:st.score-sc0}; }
function cascadeOut(st){ let k=2; for(let g=0;g<60;g++){ const groups=findGroups(st);
    if(groups.length){ CUR=newStep(st,k); clearGroups(st,groups,k,null); endStep(st); settle(st,k); k++; continue; }
    const primed=[]; for(let i=0;i<st.N;i++) if(st.ps[i]===PRIMED) primed.push(i); const later=st._later||[]; st._later=null;
    if(primed.length||later.length){ CUR=newStep(st,k); for(const c of primed) hitCell(st,c,false); for(const L of later) hitAll(st,cellsBox(st,L.c,L.r)); runQueue(st); endStep(st); settle(st,k); k++; continue; }
    break; } }

// ---------- helpers ----------
function cloneSt(st){ const o=Object.assign({},st); for(const k of ['mask','pe','ps','pid','fr','ch','fg','stn','lv','colN','colE','ctr','got']) o[k]=st[k].slice();
  o.goals=st.goals.map(g=>Object.assign({},g)); o.relic=Object.assign({},st.relic); o.init=Object.assign({},st.init); o.last=Object.assign({},st.last);
  o.stats={made:st.stats.made.slice(),combos:Object.assign({},st.stats.combos),react:Object.assign({},st.stats.react),best:st.stats.best,mostSp:st.stats.mostSp,matches:st.stats.matches.slice()};
  o._later=null; o._lavaCleared=false; return o; }
// a short fingerprint of the board, for tests (same seed + same moves → same fingerprint)
function fingerprint(st){ let h=2166136261; const add=v=>{ h^=(v+3)&255; h=Math.imul(h,16777619); };
  for(let i=0;i<st.N;i++){ add(st.pe[i]); add(st.ps[i]); add(st.fr[i]*4+st.ch[i]*2+st.fg[i]); add(st.stn[i]*2+st.lv[i]); } add(st.score&255); add(st.score>>8&255); add(st.score>>16&255);
  return (h>>>0).toString(16).padStart(8,'0'); }
function boardText(st){ const ch='FWEALI*R'; let s=''; for(let y=0;y<st.H;y++){ for(let x=0;x<st.W;x++){ const i=y*st.W+x;
      s+=!st.mask[i]?' ':st.stn[i]?'#':st.lv[i]?'~':st.pe[i]<0?'.':(st.ps[i]?'hvbwpx'[st.ps[i]-1]:ch[st.pe[i]]); } s+='\n'; } return s; }
// a board from text (tests): F W E A L I are elements, * a Prism, R a relic, . empty, space no cell.
// sp: {cell: special} puts a Surge, Burst or Wisp on a piece.
function boardFrom(rows,o,sp){ const H=rows.length, W=rows[0].length, st=newGame(Object.assign({W,H,ne:6,seed:'test',pieces:rows.map(r=>r.replace(/./g,'.'))},o||{})), map={F:0,W:1,E:2,A:3,L:4,I:5};
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const i=y*W+x, c=rows[y][x]; st.ps[i]=0; st.pid[i]=0; st.pe[i]=-1;
    if(c===' '){ st.mask[i]=0; continue; } if(c==='.') continue; st.pid[i]=st.nid++;
    if(c==='*'){ st.pe[i]=PRISM; st.ps[i]=SPRISM; } else if(c==='R') st.pe[i]=RELIC; else st.pe[i]=map[c]; }
  for(const k in sp||{}) st.ps[k]=sp[k];
  st.init={frost:countOb(st,'fr'),stone:countOb(st,'stn'),lava:countOb(st,'lv'),fog:countOb(st,'fg'),chain:countOb(st,'ch')};
  return st; }
// test hooks: open and close a clearing step by hand
function __step(st,k){ CUR=newStep(st,k||1); return CUR; }
function __end(){ const c=CUR; CUR=null; return c; }
