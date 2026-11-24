// Greedy shortest-path bot shared by the tests
const E=require('../src/engine.js');
// ---------- greedy bot (BFS to food, else most room) ----------
function bfs(g,from,to){ const prev=new Int32Array(g.W*g.H).fill(-2), q=[from]; prev[from]=-1; const tail=g.body[g.body.length-1];
  for(let h=0;h<q.length;h++){ const c=q[h]; if(c===to){ let p=c; while(prev[p]!==from&&prev[p]!==-1) p=prev[p]; return p; }
    for(let d=0;d<4;d++){ g.body[0]=c; const r=E.nextCell(g,d); g.body[0]=from; if(r.i<0||prev[r.i]!==-2) continue; if(g.occ[r.i]&&!(r.i===tail&&!g.grow)) continue; prev[r.i]=c; q.push(r.i); } }
  return -1; }
function room(g,from){ const seen=new Uint8Array(g.W*g.H), q=[from]; seen[from]=1; let n=0; const h=g.body[0];
  for(let k=0;k<q.length;k++){ n++; for(let d=0;d<4;d++){ g.body[0]=q[k]; const r=E.nextCell(g,d); g.body[0]=h; if(r.i>=0&&!seen[r.i]&&!g.occ[r.i]){ seen[r.i]=1; q.push(r.i); } } } return n; }
function botMove(g){ const h=g.body[0], tgt=g.bonus?g.bonus.i:g.food; const firstStep=tgt>=0?bfs(g,h,tgt):-1;
  let best=-1, bestRoom=-1, pick=-1;
  for(let d=0;d<4;d++){ if(d===E.opp(g.dir)) continue; const r=E.nextCell(g,d); if(r.i<0) continue; const tail=g.body[g.body.length-1]; if(g.occ[r.i]&&!(r.i===tail&&!g.grow)) continue;
    if(r.i===firstStep) pick=d; const rm=room(g,r.i); if(rm>bestRoom){ bestRoom=rm; best=d; } }
  if(pick>=0){ const r=E.nextCell(g,pick); if(room(g,r.i)>=g.body.length*.5||room(g,r.i)>=bestRoom) return pick; }
  return best>=0?best:g.dir; }
const botPlay=(cfg,maxTicks=6000)=>{ const g=E.newGame(cfg); E.enqueue(g,g.dir); let t=0;
  while(!g.over&&t<maxTicks){ const d=botMove(g); if(d!==g.dir) E.enqueue(g,d); E.step(g); t++;
    if(g.food>=0&&(!g.mask[g.food]||g.occ[g.food])) throw new Error('bad food'); }
  return g; };

module.exports={botMove,botPlay};
