// ===================== Linefall campaign and Daily Blitz =====================
// 30 levels in 3 chapters. Each level has a goal, its settings, a fixed seed (the same piece order on every
// attempt, so par targets are fair and learnable) and 5 star targets. Star targets come from the bot sims
// (tests/sim.js): ★1-3 reachable for the casual bot, ★4-5 for the strong one. Retune after playtesting.
// Star specs: ['goal'] complete · ['time',s] finish within s seconds · ['nohold'] · ['quads',n] · ['score',n]
// · ['stack',n] end with the stack at most n rows high · ['half'] never above half height · ['pieces',n]
// · ['dig',n] never more than n rows above the starting height · ['sweep'] a Clean Sweep · ['moves',n]
// · ['norev'] no rotation reversals · ['lines',n]
// Puzzles: built backwards from full rows and verified by replaying the stored solution (tests/gen_puzzles.js).
const PUZZLES={"p1":{"prefill":["##..##.#","#...#..#","#......#","#......#"],"pieces":["S","J","I","L","T"],"sol":[[3,1],[1,2],[1,4],[3,4],[2,1]],"par":12},"p2":{"prefill":["#.....#.","#.....#.","#.....#.","#.....#."],"pieces":["I3","I3","L3","I","T","J","L3"],"sol":[[2,4],[1,1],[0,4],[3,6],[1,1],[2,1],[2,5]],"par":21},"p3":{"prefill":[".#.....#",".#.....#",".#.....#",".#.....#",".#.....#"],"pieces":["L","I5","I","Z","J","I","I5"],"sol":[[0,4],[3,0],[3,2],[1,4],[1,3],[2,3],[1,2]],"par":17}};
// Dig layouts: rows of garbage from the bottom, one or two gaps each, never a full row. Built from a fixed seed.
function digRows(id,W,n,gaps,cluster){ const R=rngFrom('LFDIG1|'+id), out=[]; let g=rint(R,W);
  for(let i=0;i<n;i++){ if(i&&rnd(R)>=cluster){ let ng; do ng=rint(R,W); while(Math.abs(ng-g)<2); g=ng; }
    const row=new Array(W).fill('#'); row[g]='.';
    if(gaps>1){ let g2; do g2=rint(R,W); while(Math.abs(g2-g)<2); row[g2]='.'; } out.push(row.join('')); }
  return out; }
const CHAPTERS=[{n:1,name:'Basics'},{n:2,name:'Pressure'},{n:3,name:'Mastery'}];
const LV_RAW=[
 // ---- Chapter 1: Basics ----
 [1,'First Drop','sprint',{lines:10},{},[['goal'],['time',40],['time',32],['nohold'],['quads',2]],'Clear 10 lines. Fill a row from wall to wall and it disappears.'],
 [2,'Keep Afloat','survive',{s:60},{},[['goal'],['stack',8],['score',7000],['nohold'],['half']],'Last one minute. Keep the stack low and the middle open.'],
 [3,'Points on the Board','score',{s:90},{},[['goal'],['score',8000],['score',14000],['score',28000],['sweep']],'Score as much as you can in 90 seconds. Clearing several lines at once pays far more.'],
 [4,'Twenty','sprint',{lines:20},{},[['goal'],['time',65],['time',52],['nohold'],['quads',3]],'Twenty lines. Leave a gap down one side for the long piece.'],
 [5,'Dig In','dig',{rows:5,gaps:1,cl:0.3},{},[['goal'],['pieces',14],['time',30],['nohold'],['dig',2]],'Clear every grey block. Find the gaps and open them up.'],
 [6,'Tight Squeeze','sprint',{lines:15},{board:'small'},[['goal'],['time',35],['time',28],['nohold'],['quads',2]],'A narrow board. Fewer blocks fill a row, but there\'s less room to think.'],
 [7,'Fitting In','puzzle',{p:'p1'},{board:'small'},[['goal'],['moves',17],['moves',12],['norev'],['time',25]],'Use every piece and leave the board empty.'],
 [8,'No Pockets','sprint',{lines:20},{hold:false},[['goal'],['time',70],['time',55],['time',40],['quads',3]],'No hold on this one. Plan with the previews.'],
 [9,'Holding Steady','survive',{s:120},{startLevel:3},[['goal'],['stack',10],['score',29500],['nohold'],['half']],'Two minutes, starting a little faster.'],
 [10,'Rush Hour','score',{s:120},{speed:'1.5'},[['goal'],['score',18000],['score',27500],['score',55000],['sweep']],'Chapter finale. Everything falls 1.5× faster.'],
 // ---- Chapter 2: Pressure ----
 [11,'Up Tempo','sprint',{lines:20},{speed:'1.5'},[['goal'],['time',65],['time',52],['nohold'],['quads',3]],'Twenty lines at 1.5×.'],
 [12,'Rising Tide','survive',{s:90},{garbage:true},[['goal'],['stack',12],['score',16000],['nohold'],['half']],'A grey row rises from the bottom every 10 seconds. Clear the gaps to push it back.'],
 [13,'Five Alive','score',{s:120},{set:'pentomix'},[['goal'],['score',15500],['score',26000],['score',52000],['sweep']],'Five-block pieces join the mix. Give them room.'],
 [14,'Deep Dig','dig',{rows:8,gaps:1,cl:0},{},[['goal'],['pieces',70],['time',90],['nohold'],['dig',2]],'Eight rows of grey. Dig down one gap at a time.'],
 [15,'Wide Open','sprint',{lines:30},{board:'large'},[['goal'],['time',115],['time',90],['nohold'],['quads',5]],'A wide board takes more blocks per line.'],
 [16,'Small Parts','puzzle',{p:'p2'},{board:'small',set:'junior'},[['goal'],['moves',28],['moves',21],['norev'],['time',35]],'Small pieces too. Use every piece and leave the board empty.'],
 [17,'Double Time','survive',{s:90},{speed:'2'},[['goal'],['stack',7],['score',18000],['nohold'],['half']],'Ninety seconds at double speed.'],
 [18,'Tied Hands','sprint',{lines:20},{set:'pentomix',hold:false},[['goal'],['time',65],['time',52],['time',35],['quads',3]],'Pentomix with no hold.'],
 [19,'Cash In','score',{s:150},{speed:'1.5',set:'junior'},[['goal'],['score',18000],['score',28500],['score',57000],['sweep']],'Small pieces make Clean Sweeps easier. Go for one.'],
 [20,'Pressure Cooker','survive',{s:120},{speed:'1.5',garbage:true},[['goal'],['stack',10],['score',39000],['nohold'],['half']],'Chapter finale. Faster, with rising rows.'],
 // ---- Chapter 3: Mastery ----
 [21,'Redline','sprint',{lines:30},{speed:'2'},[['goal'],['time',95],['time',75],['nohold'],['quads',5]],'Thirty lines at 2×.'],
 [22,'Fade Out','survive',{s:120},{fading:true},[['goal'],['stack',9],['score',24000],['nohold'],['half']],'Locked blocks fade after 5 seconds and flash back when you clear a line.'],
 [23,'Chaos Theory','score',{s:120},{set:'chaos',board:'large'},[['goal'],['score',14500],['score',22000],['score',44000],['sweep']],'Every piece set at once.'],
 [24,'Bedrock','dig',{rows:8,gaps:2,cl:0.2},{board:'large'},[['goal'],['pieces',80],['time',120],['nohold'],['dig',3]],'Eight rows of grey, two gaps each, on a wide board.'],
 [25,'Pocket Rocket','sprint',{lines:20},{board:'small',speed:'1.5'},[['goal'],['time',45],['time',36],['nohold'],['quads',2]],'Small board, 1.5× speed.'],
 [26,'Endgame','puzzle',{p:'p3'},{board:'small',set:'pentomix'},[['goal'],['moves',24],['moves',17],['norev'],['time',35]],'Five-block pieces. Use every piece and leave the board empty.'],
 [27,'Blindfold','sprint',{lines:30},{hold:false,ghost:false},[['goal'],['time',95],['time',75],['time',55],['quads',4]],'No hold and no ghost piece.'],
 [28,'Long Haul','survive',{s:180},{startLevel:4},[['goal'],['stack',12],['score',67500],['nohold'],['score',170000]],'Three minutes, starting at level 4.'],
 [29,'High Roller','score',{s:180},{speed:'2'},[['goal'],['score',44500],['score',66000],['score',132000],['sweep']],'Three minutes at 2×. Big clears, big points.'],
 [30,'Last Line','sprint',{lines:40},{board:'large',speed:'2',garbage:true},[['goal'],['time',130],['time',105],['nohold'],['quads',5]],'The final level. Forty lines on a wide board, at 2×, with rising rows.']];
const LEVELS=LV_RAW.map(([id,name,type,g,set,stars,tip])=>{ const ch=Math.ceil(id/10); const cfg=Object.assign({board:'medium',speed:'1',set:'classic'},set);
  const goal={type}; if(type==='sprint') goal.lines=g.lines; if(type==='survive'||type==='score') goal.ticks=g.s*LF_HZ;
  if(type==='dig') cfg.prefill=digRows(id,BOARDS[cfg.board].w,g.rows,g.gaps,g.cl);
  if(type==='puzzle'){ const P=PUZZLES[g.p]; cfg.prefill=P.prefill; cfg.fixed=P.pieces; cfg.hold=false; goal.par=P.par; }
  return {id,ch,name,type,goal,cfg,stars,tip,finale:id%10===0}; });
const GOAL_NAMES={sprint:'Sprint',survive:'Survive',score:'Score Attack',dig:'Dig',puzzle:'Puzzle'};
function levelCfg(L,opts){ return Object.assign({},L.cfg,opts||{},{goal:L.goal,seed:'LFC1|'+L.id}); }
const fmtTime=s=>{ s=Math.max(0,Math.floor(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
const fmtNum=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,',');
function starText(L,s){ const [k,v]=s;
  if(k==='goal') return L.type==='sprint'?`Clear ${L.goal.lines} lines`:L.type==='survive'?`Survive ${fmtTime(L.goal.ticks/LF_HZ)}`:L.type==='score'?`Last ${fmtTime(L.goal.ticks/LF_HZ)}`:L.type==='dig'?'Clear all the grey blocks':'Clean Sweep: leave the board empty';
  return {time:`Finish in ${fmtTime(v)}`,nohold:'Never use hold',quads:`${v} Quads`,score:`Score ${fmtNum(v)}`,stack:`End with the stack ${v} rows or lower`,
    half:'Never go above half height',pieces:`Use ${v} pieces or fewer`,dig:`Never stack more than ${v} rows above the start`,sweep:'A Clean Sweep',
    moves:`${v} moves or fewer`,norev:'No rotation reversals',lines:`Clear ${v} lines`}[k]; }
// Which stars a finished game earned (not cumulative; core.js keeps the best of every attempt)
function starsEarned(L,res){ const s=res.stats; return L.stars.map(([k,v])=>{ if(!res.ok) return false;
  switch(k){ case 'goal': return true; case 'time': return res.ticks<=v*LF_HZ; case 'nohold': return s.holds===0; case 'quads': return s.quads+s.quints>=v;
    case 'score': return res.score>=v; case 'stack': return res.h<=v; case 'half': return !s.aboveHalf; case 'pieces': return s.pieces<=v;
    case 'dig': return s.maxAboveStart<=v; case 'sweep': return s.sweeps>0; case 'moves': return s.moves+s.rots<=v; case 'norev': return s.reversals===0;
    case 'lines': return res.lines>=v; } return false; }); }

// ---------- Daily Blitz: a 3-minute score attack, the same game for everyone ----------
// The seed LFD1|YYYY-MM-DD picks one combination from this curated table and deals the piece order.
// Thresholds [★1, ★2, ★3] by score come from the bot sims (tests/sim.js daily, 10 casual + 3 strong games each):
// ★1 = 0.6 × casual 30th percentile, ★2 = casual 80th percentile, ★3 = twice that.
const DAILY_S=180;
const DAILY=[
 ['medium','1','classic',{},[24000,45000,90000]],
 ['medium','1.5','classic',{},[28000,54000,108000]],
 ['medium','2','classic',{},[35000,66500,133000]],
 ['small','1','classic',{},[6500,66000,132000]],
 ['small','1.5','classic',{},[5500,30500,61000]],
 ['large','1','classic',{},[19000,37000,74000]],
 ['large','1.5','classic',{},[23500,43500,87000]],
 ['medium','1','kind',{},[21500,38500,77000]],
 ['large','1','kind',{},[17500,31500,63000]],
 ['medium','1','junior',{},[18000,33500,67000]],
 ['large','1.5','junior',{},[17500,32500,65000]],
 ['medium','1','pentomix',{},[22000,55500,111000]],
 ['large','1','pentomix',{},[23000,45000,90000]],
 ['large','1.5','pentomix',{},[23000,50000,100000]],
 ['medium','1','chaos',{},[24000,54500,109000]],
 ['large','1','chaos',{},[22000,42500,85000]],
 ['medium','1','classic',{garbage:true},[12500,75000,150000]],
 ['large','1','classic',{garbage:true},[16500,57000,114000]],
 ['medium','1.5','classic',{garbage:true},[11500,63500,127000]],
 ['medium','1','classic',{hold:false},[27000,50000,100000]],
 ['medium','1.5','classic',{hold:false},[31500,60500,121000]],
 ['medium','1','classic',{ghost:false},[23500,48500,97000]],
 ['medium','1','classic',{next:1},[22000,45000,90000]],
 ['medium','1','classic',{fading:true},[26000,56500,113000]],
 ['large','1','classic',{fading:true},[23000,48500,97000]],
 ['medium','1','kind',{garbage:true},[16000,48500,97000]],
 ['medium','1.5','pentomix',{},[33500,64500,129000]],
 ['small','1','junior',{},[18500,45000,90000]],
 ['medium','2','kind',{},[30500,53500,107000]],
 ['large','2','classic',{},[26000,51000,102000]]];
const DAILY_EPOCH=Date.UTC(2026,10,1);
const dayNum=date=>{ const [y,m,d]=date.split('-').map(Number); return Math.round((Date.UTC(y,m-1,d)-DAILY_EPOCH)/864e5); };
const dayDate=n=>{ const t=new Date(DAILY_EPOCH+n*864e5); return t.getUTCFullYear()+'-'+String(t.getUTCMonth()+1).padStart(2,'0')+'-'+String(t.getUTCDate()).padStart(2,'0'); };
function dailyCombo(date){ const R=rngFrom('LFD1|'+date); const i=rint(R,DAILY.length), d=DAILY[i];
  return {idx:i,board:d[0],speed:d[1],set:d[2],extras:d[3],stars:d[4]}; }
function dailyCfg(date,opts){ const d=dailyCombo(date); return Object.assign({board:d.board,speed:d.speed,set:d.set},d.extras,opts||{},{goal:{type:'blitz',ticks:DAILY_S*LF_HZ},seed:'LFD1|'+date}); }
const dailyStars=(date,score)=>{ const t=dailyCombo(date).stars; return t.filter(v=>score>=v).length; };
function comboLabel(c){ const p=[BOARDS[c.board].name,SPEEDS[c.speed].name,SETS[c.set].name], e=c.extras||c;
  if(e.garbage) p.push('Rising'); if(e.fading) p.push('Fading'); if(e.hold===false) p.push('No hold'); if(e.ghost===false) p.push('No ghost'); if(e.next===1) p.push('1 preview'); return p.join(' · '); }
