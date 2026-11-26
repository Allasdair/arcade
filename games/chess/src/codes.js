// ===================== 2-Player share codes (CHF1.) =====================
// CHF1.<base64url>: version, a random 6-byte game id, flags, the Chess960 back rank (or none), both names and the full
// move list (each move as its index among the legal moves, sorted by UCI). Then 0xA1 + both players' Arcade avatar
// numbers (0 = none), then a 16-bit checksum. A code without the avatar bytes reads as 0, 0. Every device rebuilds the
// game by replaying every move, so an illegal or impossible move is caught.
// Seats: 0 = the player who made the game, 1 = the player who joined. Flags: bit 0 seat 0 plays Black; bits 1–2 the end
// (0 playing, 1 White resigned, 2 Black resigned, 3 draw agreed); bit 3 the last mover offers a draw.
const B64U='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const toB64U=b=>{ let s=''; for(let i=0;i<b.length;i+=3){ const n=(b[i]<<16)|((b[i+1]||0)<<8)|(b[i+2]||0);
  s+=B64U[n>>18&63]+B64U[n>>12&63]+(i+1<b.length?B64U[n>>6&63]:'')+(i+2<b.length?B64U[n&63]:''); } return s; };
const fromB64U=s=>{ const out=[]; let buf=0,bits=0; for(const ch of s){ const v=B64U.indexOf(ch); if(v<0) throw new Error('char'); buf=(buf<<6)|v; bits+=6; if(bits>=8){ bits-=8; out.push((buf>>bits)&255); } } return Uint8Array.from(out); };
const cleanName=t=>[...String(t||'').replace(/[\u0000-\u001f\u007f<>&"'`]/g,'')].slice(0,16).join('').trim();
const fnv16=b=>{ let h=2166136261; for(const v of b){ h^=v; h=Math.imul(h,16777619); } return (h^(h>>>16))&0xffff; };
const AV_MARK=0xA1;
// moves as indexes among the legal moves, sorted by their UCI text (the same on every device)
function sortedLegal(p){ return legalMoves(p).map(m=>[toUci(p,m),m]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0); }
function encodeGame(g){ // g: {id:[6 bytes], c960 (-1 or 0–959), p0black, names:[a,b], avs:[a,b], moves:[uci], end, offer}
  const b=[1,...g.id];
  b.push((g.p0black?1:0)|((g.end||0)<<1)|(g.offer?8:0));
  const n=g.c960>=0?g.c960+1:0; b.push(n>>8,n&255);
  for(const nm of g.names){ const u=new TextEncoder().encode(cleanName(nm)); b.push(u.length,...u); }
  const p=fromFEN(g.c960>=0?fen960(g.c960):START_FEN); if(g.c960>=0) p.c960=true;
  b.push(g.moves.length>>8,g.moves.length&255);
  for(const u of g.moves){ const L=sortedLegal(p), k=L.findIndex(x=>x[0]===u); if(k<0) throw new Error('illegal'); b.push(k); makeMove(p,L[k][1]); }
  const av=g.avs||[0,0]; if(av[0]||av[1]) b.push(AV_MARK,av[0]&255,av[1]&255);
  const ck=fnv16(b); b.push(ck>>8,ck&255);
  return 'CHF1.'+toB64U(Uint8Array.from(b)); }
const findCode=text=>{ const m=String(text||'').match(/CHF1\.([A-Za-z0-9_-]{16,})/); return m?m[0]:null; };
function decodeGame(text){ const code=findCode(text); if(!code) throw new Error('nocode');
  const all=fromB64U(code.slice(5)); if(all.length<14) throw new Error('short');
  const b=all.slice(0,-2); if(fnv16(b)!==((all[all.length-2]<<8)|all[all.length-1])) throw new Error('checksum');
  let i=0; if(b[i++]!==1) throw new Error('version');
  const id=[...b.slice(i,i+6)]; i+=6; const fl=b[i++], c9=(b[i]<<8)|b[i+1]; i+=2; if(c9>960) throw new Error('bad');
  const names=[]; for(let k=0;k<2;k++){ const l=b[i++]; if(l===undefined||l>64||i+l>b.length) throw new Error('names'); names.push(cleanName(new TextDecoder().decode(b.slice(i,i+l)))); i+=l; }
  const cnt=(b[i]<<8)|b[i+1]; i+=2; if(i+cnt>b.length) throw new Error('short');
  const g={id:idHex(id),idBytes:id,c960:c9?c9-1:-1,p0black:!!(fl&1),end:(fl>>1)&3,offer:!!(fl&8),names,moves:[],avs:[0,0]};
  const p=fromFEN(g.c960>=0?fen960(g.c960):START_FEN); if(g.c960>=0) p.c960=true;
  for(let k=0;k<cnt;k++){ const L=sortedLegal(p), x=b[i++]; if(x>=L.length) throw new Error('invalid'); g.moves.push(L[x][0]); makeMove(p,L[x][1]); }
  if(b[i]===AV_MARK) g.avs=[b[i+1]|0,b[i+2]|0];
  return g; }
const idHex=b=>b.map(v=>v.toString(16).padStart(2,'0')).join('');
const newGameId=()=>{ const b=new Uint8Array(6); try{ crypto.getRandomValues(b); }catch(e){ for(let i=0;i<6;i++) b[i]=Math.floor(Math.random()*256); } return [...b]; };
// seat of a colour: seat 0 plays White unless p0black
const seatOf=(g,colour)=>(colour===WHITE)!==!!g.p0black?0:1;
const colourOf=(g,seat)=>(seat===0)!==!!g.p0black?WHITE:BLACK;
// a game's result, from its moves and end flag: {over, result, reason, winner (colour)}
function codeStatus(g){ const p=posAt({start:g.c960>=0?fen960(g.c960):START_FEN,moves:g.moves,c960:g.c960});
  if(g.end===1) return {over:true,result:'0-1',reason:'resign',winner:BLACK,p};
  if(g.end===2) return {over:true,result:'1-0',reason:'resign',winner:WHITE,p};
  if(g.end===3) return {over:true,result:'1/2-1/2',reason:'agreed',p};
  return Object.assign(gameStatus(p),{p}); }
// importing: replays every move; refused if damaged, deleted, illegal, older than the saved game, the same, or not this
// device's turn yet
function importCheck(text,local){ let g; try{ g=decodeGame(text); }catch(e){ return {ok:false,why:e.message==='nocode'?'nocode':e.message==='invalid'?'invalid':'bad'}; }
  if(local&&local.deleted&&local.deleted.includes(g.id)) return {ok:false,why:'deleted',g};
  const have=local&&local.games?local.games.find(x=>x.id===g.id):null, st=codeStatus(g);
  const me=have?have.me:1, len=n=>n+(g.end?1:0);
  if(have){ const hn=have.moves.length+(have.end?1:0), gn=len(g.moves.length); if(gn<hn) return {ok:false,why:'older',g}; if(gn===hn&&!!g.offer===!!have.offer) return {ok:false,why:'same',g}; }
  if(!st.over&&seatOf(g,st.p.side)!==me) return {ok:false,why:'notyours',g};
  return {ok:true,g,st,me,isNew:!have}; }
