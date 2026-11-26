// ===================== Chess engine: board, rules, notation =====================
// 0x88 board. Pure (no DOM): Node tests and the page share it. Positions are plain objects with typed arrays;
// games are saved as {start FEN, moves (UCI)} and rebuilt by replaying, so a resumed game is exact.

// ---------- seeded randomness (Sweep's cyrb128 → sfc32) ----------
function cyrb128(str){ let h1=1779033703,h2=3144134277,h3=1013904242,h4=2773480762;
  for(let i=0,k;i<str.length;i++){ k=str.charCodeAt(i); h1=h2^Math.imul(h1^k,597399067); h2=h3^Math.imul(h2^k,2869860233); h3=h4^Math.imul(h3^k,951274213); h4=h1^Math.imul(h4^k,2716044179); }
  h1=Math.imul(h3^(h1>>>18),597399067); h2=Math.imul(h4^(h2>>>22),2869860233); h3=Math.imul(h1^(h3>>>17),951274213); h4=Math.imul(h2^(h4>>>19),2716044179);
  return [(h1^h2^h3^h4)>>>0,(h2^h1)>>>0,(h3^h1)>>>0,(h4^h1)>>>0]; }
function sfc32(a,b,c,d){ return function(){ a>>>=0;b>>>=0;c>>>=0;d>>>=0; let t=(a+b)|0; a=b^(b>>>9); b=(c+(c<<3))|0; c=(c<<21)|(c>>>11); d=(d+1)|0; t=(t+d)|0; c=(c+t)|0; return (t>>>0)/4294967296; }; }
const rngFor=str=>{ const s=cyrb128(String(str)); return sfc32(s[0],s[1],s[2],s[3]); };

// ---------- pieces and squares ----------
// A piece is type | colour<<3: white 1–6, black 9–14 (P N B R Q K). Square = rank*16 + file, a1 = 0, h8 = 119.
const WHITE=0, BLACK=1, PAWN=1, KNIGHT=2, BISHOP=3, ROOK=4, QUEEN=5, KING=6;
const PCH=' PNBRQK  pnbrqk';
const sqName=s=>'abcdefgh'[s&7]+((s>>4)+1);
const parseSq=t=>{ const m=/^([a-h])([1-8])$/.exec(t||''); return m?(m[2]-1)*16+'abcdefgh'.indexOf(m[1]):-1; };
const sq64=s=>(s>>4)*8+(s&7), sq88=i=>(i>>3)*16+(i&7);
const ND=[33,31,18,14,-33,-31,-18,-14], KD=[1,-1,16,-16,17,15,-17,-15], BD=[17,15,-17,-15], RD=[1,-1,16,-16];
// move = from | to<<7 | promo<<14 | flags<<17. Castling is encoded king → its own rook (works for Chess960).
const F_CAP=1, F_EP=2, F_CASTLE=4, F_DOUBLE=8;
const mFrom=m=>m&127, mTo=m=>(m>>7)&127, mPromo=m=>(m>>14)&7, mFlags=m=>m>>17;
const mk=(f,t,pr,fl)=>f|(t<<7)|(pr<<14)|(fl<<17);

// ---------- Zobrist keys (two 32-bit halves) and incremental evaluation tables ----------
const ZL=new Int32Array(16*128), ZH=new Int32Array(16*128), ZCL=new Int32Array(16), ZCH=new Int32Array(16), ZEL=new Int32Array(8), ZEH=new Int32Array(8);
let ZSL=0, ZSH=0;
(function(){ const r=rngFor('chess-zobrist-v1'), u=()=>(r()*4294967296)|0;
  for(let i=0;i<ZL.length;i++){ ZL[i]=u(); ZH[i]=u(); } for(let i=0;i<16;i++){ ZCL[i]=u(); ZCH[i]=u(); } for(let i=0;i<8;i++){ ZEL[i]=u(); ZEH[i]=u(); } ZSL=u(); ZSH=u(); })();
// Material and piece-square values, our own: written as formulas, middlegame / endgame, white's view (black mirrored).
const VAL_MG=[0,100,320,335,480,960,0], VAL_EG=[0,125,300,320,540,1010,0], PHASE=[0,0,1,1,2,4,0];
const PST_MG=new Int16Array(16*128), PST_EG=new Int16Array(16*128);
(function(){ const cd=(f,r)=>Math.max(Math.abs(f-3.5),Math.abs(r-3.5)), md=(f,r)=>Math.abs(f-3.5)+Math.abs(r-3.5);
  const T={ // f file 0–7, r rank 0–7 from the owner's side
    1:[(f,r)=>r===0||r===7?0:(r-1)*6+(f>=2&&f<=5?[0,0,-6,4,14,10,6][r-1]*(f===3||f===4?1.6:0.8):0)+(r===1&&(f===3||f===4)?-12:0)-(f===0||f===7?4:0),
       (f,r)=>r===0||r===7?0:[0,0,6,16,32,58,92][r-1]],
    2:[(f,r)=>Math.round(22-cd(f,r)*11-(r===0?6:0)), (f,r)=>Math.round(18-cd(f,r)*10)],
    3:[(f,r)=>Math.round(10-cd(f,r)*4-(r===0?8:0)+((f===r||f+r===7)?6:0)), (f,r)=>Math.round(10-cd(f,r)*5)],
    4:[(f,r)=>(r===6?16:0)+(f===3||f===4?6:f===2||f===5?2:-2)+(r===0&&(f===0||f===7)?-4:0), (f,r)=>(r===6?10:0)],
    5:[(f,r)=>Math.round(6-cd(f,r)*2-(r===0?0:r<3?0:2)), (f,r)=>Math.round(16-md(f,r)*4)],
    6:[(f,r)=>r===0?[18,28,12,-4,0,-4,30,20][f]:r===1?[2,4,-10,-18,-18,-10,6,4][f]:-30-r*6, (f,r)=>Math.round(26-md(f,r)*7-(r===0||r===7?6:0))]};
  for(let c=0;c<2;c++) for(let t=1;t<=6;t++) for(let s=0;s<128;s++){ if(s&0x88) continue; const f=s&7, r=c?7-(s>>4):(s>>4), p=t|(c<<3), sg=c?-1:1;
    PST_MG[p*128+s]=sg*(VAL_MG[t]+Math.round(T[t][0](f,r))); PST_EG[p*128+s]=sg*(VAL_EG[t]+Math.round(T[t][1](f,r))); } })();

// ---------- positions ----------
function newPos(){ return {b:new Int8Array(128),side:WHITE,cm:0,rf:[[7,0],[7,0]],ep:-1,half:0,full:1,k:[-1,-1],hl:0,hh:0,mg:0,eg:0,ph:0,cnt:new Int8Array(16),
  undo:[],hist:[],c960:false}; }
function put(p,s,pc){ p.b[s]=pc; const i=pc*128+s; p.hl^=ZL[i]; p.hh^=ZH[i]; p.mg+=PST_MG[i]; p.eg+=PST_EG[i]; p.ph+=PHASE[pc&7]; p.cnt[pc]++; if((pc&7)===KING) p.k[pc>>3]=s; }
function take(p,s){ const pc=p.b[s]; p.b[s]=0; const i=pc*128+s; p.hl^=ZL[i]; p.hh^=ZH[i]; p.mg-=PST_MG[i]; p.eg-=PST_EG[i]; p.ph-=PHASE[pc&7]; p.cnt[pc]--; return pc; }
const setCastle=(p,cm)=>{ p.hl^=ZCL[p.cm]^ZCL[cm]; p.hh^=ZCH[p.cm]^ZCH[cm]; p.cm=cm; };
const setEp=(p,ep)=>{ if(p.ep>=0){ p.hl^=ZEL[p.ep&7]; p.hh^=ZEH[p.ep&7]; } p.ep=ep; if(ep>=0){ p.hl^=ZEL[ep&7]; p.hh^=ZEH[ep&7]; } };
const rookSq=(p,c,s)=>(c?112:0)+p.rf[c][s]; // castling right bit = c*2+s, s 0 kingside, 1 queenside

const START_FEN='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
function fromFEN(fen){ const p=newPos(), f=String(fen||'').trim().split(/\s+/); if(f.length<2) throw new Error('bad FEN');
  const rows=f[0].split('/'); if(rows.length!==8) throw new Error('bad FEN');
  for(let r=0;r<8;r++){ let fi=0; for(const ch of rows[r]){ if(/\d/.test(ch)){ fi+=+ch; continue; } const i=PCH.indexOf(ch); if(i<1||ch===' ') throw new Error('bad FEN'); if(fi>7) throw new Error('bad FEN'); put(p,(7-r)*16+fi,i); fi++; }
    if(fi!==8) throw new Error('bad FEN'); }
  if(p.cnt[KING]!==1||p.cnt[KING|8]!==1) throw new Error('bad FEN: kings');
  p.side=f[1]==='b'?BLACK:WHITE; if(p.side){ p.hl^=ZSL; p.hh^=ZSH; }
  let cm=0; const cf=f[2]||'-';
  if(cf!=='-') for(const ch of cf){ const c=ch===ch.toUpperCase()?0:1, kf=p.k[c]&7, rank=c?112:0, U=ch.toUpperCase();
    let file=-1, s;
    if(U==='K'){ for(let x=7;x>kf;x--) if(p.b[rank+x]===(ROOK|c<<3)){ file=x; break; } s=0; }
    else if(U==='Q'){ for(let x=0;x<kf;x++) if(p.b[rank+x]===(ROOK|c<<3)){ file=x; break; } s=1; }
    else if(U>='A'&&U<='H'){ file=U.charCodeAt(0)-65; s=file>kf?0:1; }
    if(file<0||p.b[rank+file]!==(ROOK|c<<3)||(p.k[c]>>4)!==(c?7:0)) continue;
    p.rf[c][s]=file; cm|=1<<(c*2+s); }
  setCastle(p,cm);
  // a castling right with the king off e1/e8 or a rook off a/h means Chess960 rules
  p.c960=[0,1].some(c=>[0,1].some(s=>(cm&(1<<(c*2+s)))&&((p.k[c]&7)!==4||p.rf[c][s]!==(s?0:7))));
  const ep=parseSq(f[3]); if(ep>=0){ // keep the en passant square only if a capture is possible (cleaner repetition keys)
    const c=p.side, pw=PAWN|c<<3, from=c?[ep+15,ep+17]:[ep-15,ep-17]; if(from.some(s=>!(s&0x88)&&p.b[s]===pw)) setEp(p,ep); }
  p.half=+f[4]||0; p.full=Math.max(1,+f[5]||1);
  return p; }
function toFEN(p){ let s='';
  for(let r=7;r>=0;r--){ let e=0; for(let f=0;f<8;f++){ const pc=p.b[r*16+f]; if(!pc){ e++; continue; } if(e){ s+=e; e=0; } s+=PCH[pc]; } if(e) s+=e; if(r) s+='/'; }
  let c=''; for(const col of [0,1]) for(const sd of [0,1]) if(p.cm&(1<<(col*2+sd))){ const f=p.rf[col][sd]; let ch=p.c960?'ABCDEFGH'[f]:sd?'Q':'K'; c+=col?ch.toLowerCase():ch; }
  return `${s} ${p.side?'b':'w'} ${c||'-'} ${p.ep>=0?sqName(p.ep):'-'} ${p.half} ${p.full}`; }
function clonePos(p){ const q=newPos(); q.b.set(p.b); q.cnt.set(p.cnt); Object.assign(q,{side:p.side,cm:p.cm,rf:[p.rf[0].slice(),p.rf[1].slice()],ep:p.ep,half:p.half,full:p.full,k:p.k.slice(),hl:p.hl,hh:p.hh,mg:p.mg,eg:p.eg,ph:p.ph,c960:p.c960}); q.hist=p.hist.slice(); return q; }

// ---------- Chess960 ----------
// Back rank n (0–959) in the standard numbering: 518 is the normal start. Both sides get the same arrangement.
const KN960=[[0,1],[0,2],[0,3],[0,4],[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]];
function back960(n){ const a=Array(8).fill(''); a[(n%4)*2+1]='B'; n=Math.floor(n/4); a[(n%4)*2]='B'; n=Math.floor(n/4);
  const empty=()=>a.map((x,i)=>x?-1:i).filter(i=>i>=0);
  a[empty()[n%6]]='Q'; n=Math.floor(n/6); const e=empty(), kn=KN960[n]; a[e[kn[0]]]='N'; a[e[kn[1]]]='N';
  const r=empty(); a[r[0]]='R'; a[r[1]]='K'; a[r[2]]='R'; return a.join(''); }
function fen960(n){ const w=back960(n), f=[...w].map((ch,i)=>ch==='R'?'ABCDEFGH'[i]:'').filter(Boolean);
  return `${w.toLowerCase()}/pppppppp/8/8/8/8/PPPPPPPP/${w} w ${f[1]}${f[0]}${f[1].toLowerCase()}${f[0].toLowerCase()} - 0 1`; }
const index960=seed=>Math.floor(rngFor('CH960|'+seed)()*960);

// ---------- attacks ----------
function attacked(p,s,by){ const b=p.b, pb=by<<3;
  if(by===WHITE){ if(!((s-15)&0x88)&&b[s-15]===PAWN) return true; if(!((s-17)&0x88)&&b[s-17]===PAWN) return true; }
  else { if(!((s+15)&0x88)&&b[s+15]===(PAWN|8)) return true; if(!((s+17)&0x88)&&b[s+17]===(PAWN|8)) return true; }
  for(let i=0;i<8;i++){ const t=s+ND[i]; if(!(t&0x88)&&b[t]===(KNIGHT|pb)) return true; }
  for(let i=0;i<8;i++){ const t=s+KD[i]; if(!(t&0x88)&&b[t]===(KING|pb)) return true; }
  for(let i=0;i<4;i++){ const d=BD[i]; let t=s+d; while(!(t&0x88)){ const q=b[t]; if(q){ if(q===(BISHOP|pb)||q===(QUEEN|pb)) return true; break; } t+=d; } }
  for(let i=0;i<4;i++){ const d=RD[i]; let t=s+d; while(!(t&0x88)){ const q=b[t]; if(q){ if(q===(ROOK|pb)||q===(QUEEN|pb)) return true; break; } t+=d; } }
  return false; }
const inCheck=(p,c)=>attacked(p,p.k[c==null?p.side:c],(c==null?p.side:c)^1);

// ---------- move generation (pseudo-legal; legality is checked by making the move) ----------
function genMoves(p,out,capsOnly){ const b=p.b, c=p.side, them=c^1, up=c?-16:16, start=c?6:1, last=c?0:7;
  for(let r=0;r<8;r++) for(let f=0;f<8;f++){ const s=r*16+f, pc=b[s]; if(!pc||(pc>>3)!==c) continue; const t=pc&7;
    if(t===PAWN){ const one=s+up;
      if(!capsOnly||(one>>4)===last){ if(!(one&0x88)&&!b[one]){ if((one>>4)===last){ for(let pr=QUEEN;pr>=KNIGHT;pr--) out.push(mk(s,one,pr,0)); }
          else { out.push(mk(s,one,0,0)); if(r===start&&!b[one+up]&&!capsOnly) out.push(mk(s,one+up,0,F_DOUBLE)); } } }
      for(let j=0;j<2;j++){ const x=s+up+(j?1:-1); if(x&0x88) continue; const q=b[x];
        if(q&&(q>>3)===them){ if((x>>4)===last){ for(let pr=QUEEN;pr>=KNIGHT;pr--) out.push(mk(s,x,pr,F_CAP)); } else out.push(mk(s,x,0,F_CAP)); }
        else if(x===p.ep) out.push(mk(s,x,0,F_CAP|F_EP)); }
      continue; }
    if(t===KNIGHT||t===KING){ const D=t===KNIGHT?ND:KD; for(let i=0;i<8;i++){ const x=s+D[i]; if(x&0x88) continue; const q=b[x];
        if(!q){ if(!capsOnly) out.push(mk(s,x,0,0)); } else if((q>>3)===them) out.push(mk(s,x,0,F_CAP)); }
      if(t===KING&&!capsOnly) genCastles(p,out); continue; }
    const D=t===BISHOP?BD:t===ROOK?RD:KD, n=t===QUEEN?8:4;
    for(let i=0;i<n;i++){ const d=D[i]; let x=s+d; while(!(x&0x88)){ const q=b[x];
        if(!q){ if(!capsOnly) out.push(mk(s,x,0,0)); } else { if((q>>3)===them) out.push(mk(s,x,0,F_CAP)); break; } x+=d; } } }
  return out; }
// Castling, Chess960 rules: king ends on g/c, rook on f/d; every square both cross (and land on) must be empty apart from
// the two pieces themselves, and the king may not be in check, pass through or land on an attacked square.
function genCastles(p,out){ const c=p.side, rank=c?112:0, ks=p.k[c];
  for(let sd=0;sd<2;sd++){ if(!(p.cm&(1<<(c*2+sd)))) continue; const rs=rank+p.rf[c][sd], kt=rank+(sd?2:6), rt=rank+(sd?3:5);
    if(p.b[rs]!==(ROOK|c<<3)) continue; let okk=true;
    const lo=Math.min(ks,rs,kt,rt), hi=Math.max(ks,rs,kt,rt);
    for(let x=lo;x<=hi;x++){ if(x===ks||x===rs) continue; const inK=(x>=Math.min(ks,kt)&&x<=Math.max(ks,kt)), inR=(x>=Math.min(rs,rt)&&x<=Math.max(rs,rt)); if((inK||inR)&&p.b[x]){ okk=false; break; } }
    if(!okk) continue;
    for(let x=Math.min(ks,kt);x<=Math.max(ks,kt);x++) if(attacked(p,x,c^1)){ okk=false; break; }
    if(okk) out.push(mk(ks,rs,0,F_CASTLE)); } }

// ---------- make / unmake ----------
function makeMove(p,m){ const from=mFrom(m), to=mTo(m), fl=mFlags(m), c=p.side, b=p.b;
  p.undo.push([m,0,p.cm,p.ep,p.half,p.hl,p.hh]); p.hist.push(p.hl,p.hh); const u=p.undo[p.undo.length-1];
  let cm=p.cm; p.half++;
  if(fl&F_CASTLE){ const rank=c?112:0, sd=(to&7)>(from&7)?0:1; take(p,from); const rk=take(p,to); put(p,rank+(sd?2:6),KING|c<<3); put(p,rank+(sd?3:5),rk); cm&=~(3<<(c*2)); setEp(p,-1); }
  else { const pc=b[from];
    if(fl&F_EP){ const cs=to+(c?16:-16); u[1]=take(p,cs); }
    else if(b[to]){ u[1]=take(p,to); }
    take(p,from); const pr=mPromo(m); put(p,to,pr?(pr|c<<3):pc);
    if((pc&7)===PAWN||u[1]) p.half=0;
    if((pc&7)===KING) cm&=~(3<<(c*2));
    if(cm) for(let col=0;col<2;col++) for(let sd=0;sd<2;sd++){ const bit=1<<(col*2+sd); if(cm&bit){ const rs=rookSq(p,col,sd); if(from===rs||to===rs) cm&=~bit; } }
    setEp(p,fl&F_DOUBLE?(from+to)>>1:-1); }
  setCastle(p,cm);
  if(c) p.full++; p.side^=1; p.hl^=ZSL; p.hh^=ZSH; }
function unmakeMove(p){ const u=p.undo.pop(); p.hist.length-=2; const m=u[0], from=mFrom(m), to=mTo(m), fl=mFlags(m); p.side^=1; const c=p.side;
  if(c) p.full--;
  if(fl&F_CASTLE){ const rank=c?112:0, sd=(to&7)>(from&7)?0:1; const rk=take(p,rank+(sd?3:5)); take(p,rank+(sd?2:6)); put(p,from,KING|c<<3); put(p,to,rk); }
  else { const pc=take(p,to); put(p,from,mPromo(m)?(PAWN|c<<3):pc); if(u[1]) put(p,fl&F_EP?to+(c?16:-16):to,u[1]); }
  p.cm=u[2]; p.ep=u[3]; p.half=u[4]; p.hl=u[5]; p.hh=u[6]; }
function makeNull(p){ p.undo.push([0,0,p.cm,p.ep,p.half,p.hl,p.hh]); p.hist.push(p.hl,p.hh); setEp(p,-1); p.half++; p.side^=1; p.hl^=ZSL; p.hh^=ZSH; }
function unmakeNull(p){ const u=p.undo.pop(); p.hist.length-=2; p.side^=1; p.ep=u[3]; p.half=u[4]; p.hl=u[5]; p.hh=u[6]; }
// legal = doesn't leave your own king in check
function legalMoves(p,capsOnly){ const all=genMoves(p,[],capsOnly), out=[], c=p.side;
  for(const m of all){ makeMove(p,m); if(!attacked(p,p.k[c],c^1)) out.push(m); unmakeMove(p); } return out; }
function isLegal(p,m){ return legalMoves(p).includes(m); }
function perft(p,d){ if(d===0) return 1; const ms=genMoves(p,[]), c=p.side; let n=0;
  for(const m of ms){ makeMove(p,m); if(!attacked(p,p.k[c],c^1)) n+=d===1?1:perft(p,d-1); unmakeMove(p); } return n; }

// ---------- draws and results ----------
function repCount(p){ let n=1; const h=p.hist, L=h.length, lim=Math.max(0,L-2*p.half-2);
  for(let i=L-4;i>=lim;i-=4) if(h[i]===p.hl&&h[i+1]===p.hh) n++; return n; }
// insufficient material: no side can ever mate (K v K, K+minor v K, bishops all on one square colour)
function insufficient(p){ const n=p.cnt; if(n[PAWN]||n[PAWN|8]||n[ROOK]||n[ROOK|8]||n[QUEEN]||n[QUEEN|8]) return false;
  const minors=n[KNIGHT]+n[KNIGHT|8]+n[BISHOP]+n[BISHOP|8]; if(minors<=1) return true;
  if(n[KNIGHT]||n[KNIGHT|8]) return false; let col=-1;
  for(let s=0;s<128;s++){ if(s&0x88) continue; const t=p.b[s]&7; if(t===BISHOP){ const sc=((s>>4)+(s&7))&1; if(col<0) col=sc; else if(col!==sc) return false; } }
  return true; }
// {over, result '1-0'|'0-1'|'1/2-1/2', reason} — mate and stalemate come before the draw rules
function gameStatus(p){ const ms=legalMoves(p);
  if(!ms.length){ if(inCheck(p)) return {over:true,result:p.side?'1-0':'0-1',reason:'checkmate',winner:p.side^1}; return {over:true,result:'1/2-1/2',reason:'stalemate'}; }
  if(insufficient(p)) return {over:true,result:'1/2-1/2',reason:'material'};
  if(p.half>=100) return {over:true,result:'1/2-1/2',reason:'fifty'};
  if(repCount(p)>=3) return {over:true,result:'1/2-1/2',reason:'repetition'};
  return {over:false,moves:ms}; }

// ---------- notation ----------
const castleSide=m=>(mTo(m)&7)>(mFrom(m)&7)?0:1;
function toUci(p,m){ const f=mFrom(m), t=mTo(m); if(mFlags(m)&F_CASTLE&&!p.c960) return sqName(f)+sqName((f&0x70)+(castleSide(m)?2:6));
  return sqName(f)+sqName(t)+(mPromo(m)?' pnbrqk'[mPromo(m)]:''); }
function fromUci(p,u,legal){ const t=String(u||'').trim().toLowerCase(), f=parseSq(t.slice(0,2)), d=parseSq(t.slice(2,4)), pr=' pnbrqk'.indexOf(t[4]||' ');
  if(f<0||d<0) return 0; const ms=legal||legalMoves(p);
  for(const m of ms) if(mFrom(m)===f&&!(mFlags(m)&F_CASTLE)&&mTo(m)===d&&mPromo(m)===(pr>1?pr:0)) return m;
  // castling: king to its own rook (Chess960 style) or king to g/c (standard style)
  for(const m of ms) if(mFrom(m)===f&&mFlags(m)&F_CASTLE&&(mTo(m)===d||d===(f&0x70)+(castleSide(m)?2:6))) return m;
  return 0; }
const PL=' PNBRQK';
function toSan(p,m,legal){ const ms=legal||legalMoves(p), f=mFrom(m), t=mTo(m), pc=p.b[f], ty=pc&7; let s;
  if(mFlags(m)&F_CASTLE) s=castleSide(m)?'O-O-O':'O-O';
  else { const cap=mFlags(m)&F_CAP;
    if(ty===PAWN) s=(cap?'abcdefgh'[f&7]+'x':'')+sqName(t)+(mPromo(m)?'='+PL[mPromo(m)]:'');
    else { const rivals=ms.filter(x=>x!==m&&mTo(x)===t&&(p.b[mFrom(x)]&7)===ty&&!(mFlags(x)&F_CASTLE)); let dis='';
      if(rivals.length){ const sf=rivals.some(x=>(mFrom(x)&7)===(f&7)), sr=rivals.some(x=>(mFrom(x)>>4)===(f>>4));
        dis=!sf?'abcdefgh'[f&7]:!sr?String((f>>4)+1):sqName(f); }
      s=PL[ty]+dis+(cap?'x':'')+sqName(t); } }
  makeMove(p,m); if(inCheck(p)) s+=legalMoves(p).length?'+':'#'; unmakeMove(p); return s; }
// Typed moves: SAN (any case for the piece letter when unambiguous, x and + optional, 0-0 too) or UCI.
function fromSan(p,text,legal){ let t=String(text||'').trim().replace(/[!?]+$/,'').replace(/[+#]$/,''); if(!t) return 0; const ms=legal||legalMoves(p);
  if(/^[0o]-?[0o](-?[0o])?$/i.test(t)) t=t.replace(/[0o]/gi,'O').replace(/^OO$/,'O-O').replace(/^OOO$/,'O-O-O').replace(/^O-OO$|^OO-O$/,'O-O-O');
  const norm=x=>x.replace(/[x+#=:]/g,'');
  const sans=ms.map(m=>[m,toSan(p,m,ms)]);
  let hit=sans.filter(([,s])=>norm(s)===norm(t)); if(hit.length===1) return hit[0][0];
  // promotion without "=" (e8Q), lowercase piece letters (nf3), and UCI (e2e4)
  const u=fromUci(p,t,ms); if(u) return u;
  if(/^[a-h][1-8][qrbn]$/i.test(t)||/^[a-h]x?[a-h][1-8][qrbn]$/i.test(t)){ const tt=t.slice(0,-1)+'='+t.slice(-1).toUpperCase(); hit=sans.filter(([,s])=>norm(s)===norm(tt)); if(hit.length===1) return hit[0][0]; }
  hit=sans.filter(([,s])=>norm(s).toLowerCase()===norm(t).toLowerCase()); if(hit.length===1) return hit[0][0];
  if(/^[nbrqk]/.test(t)){ const tt=t[0].toUpperCase()+t.slice(1); hit=sans.filter(([,s])=>norm(s)===norm(tt)); if(hit.length===1) return hit[0][0]; }
  return 0; }

// ---------- games (pure JSON) ----------
// {start: FEN, moves: [uci], c960: back-rank index or -1}. posAt rebuilds any position by replaying.
function gameNew(o){ o=o||{}; const n=o.c960!=null&&o.c960>=0?o.c960:-1; return {start:o.fen||(n>=0?fen960(n):START_FEN),moves:[],c960:n}; }
function posAt(g,ply){ const p=fromFEN(g.start); if(g.c960>=0) p.c960=true; const n=ply==null?g.moves.length:ply;
  for(let i=0;i<n;i++){ const m=fromUci(p,g.moves[i]); if(!m) throw new Error('illegal move in game: '+g.moves[i]); makeMove(p,m); } return p; }
function gameSans(g){ const p=fromFEN(g.start); if(g.c960>=0) p.c960=true; const out=[];
  for(const u of g.moves){ const ms=legalMoves(p), m=fromUci(p,u,ms); out.push(toSan(p,m,ms)); makeMove(p,m); } return out; }
// material on the board (for captured-piece bars and the Comeback achievement)
function material(p,c){ const v=[0,1,3,3,5,9,0]; let n=0; for(let t=1;t<6;t++) n+=p.cnt[t|c<<3]*v[t]; return n; }
const START_CNT=[0,8,2,2,2,1,1];
function captured(p,c){ const o=[]; for(let t=QUEEN;t>=PAWN;t--){ const miss=START_CNT[t]-p.cnt[t|c<<3]; for(let i=0;i<miss;i++) o.push(t); } return o; } // pieces of colour c that are gone
