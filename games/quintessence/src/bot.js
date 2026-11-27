// ===================== Quintessence bots =====================
// Two strengths, both playing through the real engine with real swaps.
//  Casual: looks only at the match it makes, like a relaxed player: its size, the special it makes, specials it sets
//          off and the goal it helps (obstacles beside it, the element it needs, a relic above it), with noise.
//  Strong: plans toward the goal (obstacles, relics, the element it needs), builds specials, saves combos, and
//          looks one move ahead on its best few candidates. Hints use the strong bot without noise.
const BOT={casualNoise:1.6,lookTop:4};
// goal units: 20 for each whole goal, so a swap that finishes a third of a goal is worth about 7
function goalUnits(st){ let u=0; for(const g of st.goals){ const [a,b]=goalProgress(st,g); u+=20*Math.min(1,a/Math.max(1,b)); } return u; }
function relicDepth(st){ let d=0; for(let i=0;i<st.N;i++) if(st.pe[i]===RELIC) d+=((i/st.W)|0)/st.H; return d; }
function specialValue(st){ let v=0, sp=[]; for(let i=0;i<st.N;i++){ const s=st.ps[i]; if(isSpecial(s)){ v+=s===SPRISM?6:s===BURST?3.5:s===WISP?2.5:2.5; sp.push(i); } }
  for(const i of sp) for(const j of neighbours(st,i)) if(j>i&&isSpecial(st.ps[j])&&movable(st,i)&&movable(st,j)) v+=4; // a combo ready to go
  return v; }
// Bots see what a player sees: the board, not the seeded pieces still to fall. So a swap is judged with refills off
// (pieces already on the board still fall and can cascade), never by peeking at the future.
function simulate(st,a,b){ const c=cloneSt(st); c.refill=false; c.sim=true; doSwap(c,a,b,false); return c; }
function casualValue(st,a,b){ const sa=st.ps[a], sb=st.ps[b];
  if(sa===SPRISM||sb===SPRISM){ if(sa===SPRISM&&sb===SPRISM) return 30; const o=sa===SPRISM?sb:sa; return isSpecial(o)?20:10; }
  if(isSpecial(sa)&&isSpecial(sb)) return 14;
  const gt=st.goals.map(g=>g.t), obGoal=gt.some(t=>t in GOAL_OB), want=st.goals.filter(g=>g.t==='collect'&&st.got[g.e]<g.n).map(g=>g.e);
  swapCells(st,a,b); const gs=findGroups(st); let v=0;
  for(const g of gs){ v+=g.size+([0,3,3,4,3,6][g.sp]||0); if(want.includes(g.e)) v+=g.size*.8; const seen=new Set();
    for(const c of g.cells){ if(isSpecial(st.ps[c])) v+=3; if(st.fr[c]||st.ch[c]) seen.add(c); if(c>=st.W&&st.pe[c-st.W]===RELIC) v+=gt.includes('relic')?3:.5;
      for(const j of neighbours(st,c)) if(st.fr[j]||st.stn[j]||st.lv[j]||st.fg[j]) seen.add(j); }
    v+=seen.size*(obGoal?3:.4); }
  swapCells(st,a,b); return v; }
function strongValue(st,c){ let v=(c.gscore-st.gscore)/250+(goalUnits(c)-goalUnits(st))*3+Math.max(0,specialValue(c)-specialValue(st))*0.6+(relicDepth(c)-relicDepth(st))*6;
  if(st.goals.some(g=>g.t==='lava')) v-=(countOb(c,'lv')-countOb(st,'lv'))*3;
  if(c.won) v+=200; if(c.over&&!c.won) v-=50; return v; }
// returns [a,b] or null
function botMove(st,kind,rnd){ const sw=listSwaps(st); if(!sw.length) return null;
  if(kind==='casual'){ let best=null, bv=-1e9; for(const [a,b] of sw){ const v=casualValue(st,a,b)+gauss(rnd)*BOT.casualNoise; if(v>bv){ bv=v; best=[a,b]; } } return best; }
  const scored=sw.map(([a,b])=>{ const cv=casualValue(st,a,b), c=simulate(st,a,b); return {a,b,c,v:strongValue(st,c)+cv*0.5}; }).sort((x,y)=>y.v-x.v);
  // look one move ahead on the best few: the value of the best follow-up counts too
  const top=scored.slice(0,BOT.lookTop);
  for(const m of top){ if(m.c.over){ m.t=m.v; continue; } const nx=listSwaps(m.c); let bestN=0;
    for(const [a,b] of nx){ const c2=simulate(m.c,a,b); const v=strongValue(m.c,c2); if(v>bestN) bestN=v; } m.t=m.v+bestN*0.6; }
  top.sort((x,y)=>y.t-x.t||x.a-y.a); const pick=rnd&&top.length>1&&rnd()<0.06?top[1]:top[0]; return [pick.a,pick.b]; }
function gauss(rnd){ if(!rnd) return 0; let u=0, v=0; while(!u) u=rnd(); v=rnd(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }
// the hint: the strong bot's best swap
function hintMove(st){ return botMove(st,'strong',null); }
// Play one game. Without a move limit, plays until the goals are met (or cap moves) and reports the moves used.
function botPlay(cfg,kind,noiseSeed,cap){ const st=newGame(Object.assign({},cfg,{limit:cfg.limit||0})), rnd=rngFor('bot|'+kind+'|'+noiseSeed); cap=cap||150;
  while(!st.over&&st.moves<cap){ const m=botMove(st,kind,rnd); if(!m) break; doSwap(st,m[0],m[1],false); }
  const done=st.goals.length?goalsMet(st):true;
  return {won:done,moves:st.moves,score:st.score,gscore:st.gscore,left:st.limit?movesLeft(st):0,st}; }
