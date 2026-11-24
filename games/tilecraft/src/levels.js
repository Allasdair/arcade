// ===================== Tilecraft campaign =====================
// Three campaigns of 15 levels (Apprentice, Journeyman, Master), following Sweep's design. Each level is a fixed recipe:
// board, bag order, opponent and goal come from the level's own seed, so a level plays the same way every time and
// players can learn it. Stars build up across attempts: ★ the goal, ★ no hints, ★ the level's twist.
// Targets come from the bots (node tests/sim.js levels): see HANDOFF.md.
const CAMPS=[{id:'apprentice',name:'Apprentice',xp:6,bonus:75,ach:'camp1'},{id:'journeyman',name:'Journeyman',xp:10,bonus:150,ach:'camp2'},{id:'master',name:'Master',xp:15,bonus:225,ach:'camp3'}];
// type: duel (beat the computer) · target (solo: reach N points in T turns) · puzzle (best move from a given board and rack)
// twist k: margin (win by v+) · full (play a Full Rack) · score (finish on v+) · long (a word of v+ letters) · noswap · move (v+ in one move) · best (find the best move)
const LV=(c,n,name,type,o)=>Object.assign({id:'AJM'[c]+n,camp:c,n,name,type,size:'small',shape:'square',mods:{}},o);
const LEVELS=[
 // ---------- Apprentice: Small boards, generous targets ----------
 LV(0,1,'First Words','duel',{ai:'easy',twist:{k:'score',v:150},tip:'Your first word must cover the star in the middle. Every word after that joins onto the board.'}),
 LV(0,2,'Warm Up','duel',{ai:'easy',twist:{k:'long',v:5},tip:'Longer words reach the premium squares. Try for five letters.'}),
 LV(0,3,'Getting Going','duel',{ai:'easy',twist:{k:'margin',v:40},tip:'Play through the 3× Word squares when you can: they triple the whole word.'}),
 LV(0,4,'Round Table','duel',{ai:'easy',shape:'ring',twist:{k:'move',v:25},tip:'A wheel: a ring round the edge, a hub in the middle and four spokes between them.'}),
 LV(0,5,'Practice Run','target',{turns:8,goal:{k:'score',v:100},twist:{k:'move',v:30},tip:'Just you and the board. Score as much as you can in 8 turns.'}),
 LV(0,6,'Step Up','duel',{ai:'normal',twist:{k:'noswap'},tip:'A Normal opponent this time. Keep good letters like S and E for later turns.'}),
 LV(0,7,'Short and Sweet','duel',{ai:'easy',mods:{maxLen:5},twist:{k:'margin',v:60},tip:'Every word, crossing words too, can be at most 5 letters.'}),
 LV(0,8,'Crossroads','duel',{ai:'normal',shape:'cross',twist:{k:'score',v:130},tip:'A cross: the corners are missing, so the arms get crowded.'}),
 LV(0,9,'Steady Hand','target',{turns:10,goal:{k:'score',v:135},twist:{k:'long',v:6},tip:'Ten turns on your own. Plan two moves ahead.'}),
 LV(0,10,'First Puzzle','puzzle',{puzzle:0,goal:{k:'pct',v:60},twist:{k:'best'},tip:'One move. Score at least 60% of the best move to pass; find the best move for the third star.'}),
 LV(0,11,'Stretch','duel',{ai:'normal',size:'medium',twist:{k:'long',v:6},tip:'A Medium board, 15×15, with more room and more premium squares.'}),
 LV(0,12,'Gem','duel',{ai:'normal',shape:'diamond',twist:{k:'margin',v:30},tip:'A diamond: the points are narrow, the middle is wide.'}),
 LV(0,13,'Pressure','duel',{ai:'normal',twist:{k:'margin',v:50},tip:'Win, and win well.'}),
 LV(0,14,'Long Words Only','duel',{ai:'normal',mods:{minLen:4},twist:{k:'noswap'},tip:'Your main word needs at least 4 letters. Crossing words can still be short.'}),
 LV(0,15,'Apprentice Finale','duel',{ai:'normal',size:'medium',twist:{k:'score',v:200},tip:'The Apprentice finale. Beat the Normal computer on a Medium board.'}),
 // ---------- Journeyman: Medium boards ----------
 LV(1,1,'New Ground','duel',{ai:'normal',size:'medium',twist:{k:'score',v:220},tip:'Journeyman starts on Medium boards against the Normal computer.'}),
 LV(1,2,'Even Match','duel',{ai:'normal',size:'medium',twist:{k:'margin',v:60},tip:'Look for spots where one tile makes two words.'}),
 LV(1,3,'Sharpening','duel',{ai:'normal',size:'medium',twist:{k:'move',v:40},tip:'The Normal computer picks good moves, but rarely the very best.'}),
 LV(1,4,'Wheel','duel',{ai:'normal',size:'medium',shape:'ring',twist:{k:'long',v:6},tip:'A bigger wheel. The spokes are the only way between the hub and the ring.'}),
 LV(1,5,'Points Race','target',{size:'medium',turns:10,goal:{k:'score',v:205},twist:{k:'move',v:45},tip:'Ten turns to reach the target. Premium squares only count on the turn you cover them.'}),
 LV(1,6,'Tough Crowd','duel',{ai:'hard',size:'medium',twist:{k:'noswap'},tip:'Hard again. Don\'t open a 3× Word square for it.'}),
 LV(1,7,'No Repeats','duel',{ai:'normal',size:'medium',mods:{norepeat:true,swaps:false},twist:{k:'margin',v:40},tip:'A main word can\'t be played twice, and there are no swaps.'}),
 LV(1,8,'Crossing','duel',{ai:'hard',size:'medium',shape:'cross',twist:{k:'move',v:50},tip:'The cross on a Medium board: wide arms, no corners.'}),
 LV(1,9,'Big Scorer','target',{size:'medium',turns:10,goal:{k:'score',v:230},twist:{k:'full'},tip:'Ten turns. A Full Rack, all 7 tiles in one move, is worth +40.'}),
 LV(1,10,'Second Puzzle','puzzle',{puzzle:1,goal:{k:'pct',v:60},twist:{k:'best'},tip:'One move from a game in progress. Find the best one.'}),
 LV(1,11,'Hard Line','duel',{ai:'hard',size:'medium',twist:{k:'long',v:7},tip:'Seven-letter words often mean a Full Rack.'}),
 LV(1,12,'Diamond Cut','duel',{ai:'hard',size:'medium',shape:'diamond',twist:{k:'move',v:45},tip:'A diamond board: the long lines run through the middle.'}),
 LV(1,13,'Iron Will','duel',{ai:'hard',size:'medium',twist:{k:'margin',v:30},tip:'Beat Hard by 30 for the third star.'}),
 LV(1,14,'Against the Clock','duel',{ai:'normal',size:'medium',mods:{timer:60,minLen:3},twist:{k:'score',v:220},tip:'60 seconds a turn, and main words of 3 letters or more.'}),
 LV(1,15,'Journeyman Finale','duel',{ai:'hard',size:'medium',twist:{k:'score',v:280},tip:'The Journeyman finale: beat the Hard computer.'}),
 // ---------- Master: Medium and Large boards, tight targets, Expert duels ----------
 LV(2,1,'Mastery','duel',{ai:'hard',size:'medium',twist:{k:'long',v:7},tip:'The Master campaign. No easy games from here.'}),
 LV(2,2,'Wide Open','duel',{ai:'hard',size:'large',twist:{k:'score',v:330},tip:'A Large board, 19×19, with 150 tiles in the bag.'}),
 LV(2,3,'Hard Bargain','duel',{ai:'hard',size:'medium',twist:{k:'noswap'},tip:'Hard picks its best-scoring move most turns. Keep your good tiles for the big spots.'}),
 LV(2,4,'Great Wheel','duel',{ai:'hard',size:'large',shape:'ring',twist:{k:'move',v:50},tip:'The Large wheel. The ring round the edge holds the 3× Word squares.'}),
 LV(2,5,'Precision','target',{size:'medium',turns:10,goal:{k:'score',v:305},twist:{k:'move',v:60},tip:'A tight target. Every turn counts.'}),
 LV(2,6,'Grandmaster','duel',{ai:'expert',size:'medium',twist:{k:'move',v:60},tip:'The Expert weighs the tiles it keeps as well as its score.'}),
 LV(2,7,'Purist','duel',{ai:'hard',size:'medium',mods:{swaps:false,minLen:4},twist:{k:'long',v:7},tip:'No swaps, and main words of 4 letters or more.'}),
 LV(2,8,'Grand Cross','duel',{ai:'expert',size:'large',shape:'cross',twist:{k:'score',v:320},tip:'Expert on the Large cross.'}),
 LV(2,9,'High Roller','target',{size:'large',turns:12,goal:{k:'score',v:330},twist:{k:'full'},tip:'Twelve turns on a Large board.'}),
 LV(2,10,'Master Puzzle','puzzle',{puzzle:2,goal:{k:'pct',v:60},twist:{k:'best'},tip:'The hardest puzzle. The best move isn\'t the obvious one.'}),
 LV(2,11,'Expert Again','duel',{ai:'expert',size:'large',twist:{k:'long',v:7},tip:'Expert on a Large board.'}),
 LV(2,12,'Diamond Mine','duel',{ai:'expert',size:'large',shape:'diamond',twist:{k:'move',v:50},tip:'The Large diamond.'}),
 LV(2,13,'Final Test','duel',{ai:'expert',size:'medium',twist:{k:'full'},tip:'Beat Expert, with a Full Rack for the third star.'}),
 LV(2,14,'Lightning','duel',{ai:'expert',size:'medium',mods:{timer:30,maxLen:6},twist:{k:'score',v:260},tip:'30 seconds a turn, and no word longer than 6 letters.'}),
 LV(2,15,'Master Finale','duel',{ai:'expert',size:'large',twist:{k:'score',v:350},tip:'The last level: Expert on a Large board.'})];
for(const L of LEVELS) if(L.type==='duel') L.goal={k:'win'};
// Each level's seed is picked from candidates so that a strong bot (the Expert in your seat) meets the goal on it, and
// the twist where it can (node tests/sim.js pick). Like Sweep's solver-graded boards: every level is known winnable.
const LEVEL_SEEDS={J8:1,J12:1,J15:1,M1:1,M4:3,M6:2,M8:2,M11:2,M12:6,M13:1,M14:1,M15:1};
for(const L of LEVELS) L.v=LEVEL_SEEDS[L.id]||0;
// The three best-move puzzles: a board from a seeded game part-way through, and the rack to move with.
// Generated and checked by tests/gen_puzzles.js; best is the solver's best score for that rack.
const PUZZLES=[
 {size:'medium',shape:'square',boardSeed:231574421,rack:'HRIIPNE',best:48,answer:'PHONIER',
  cells:[[48,"G"],[49,"E"],[50,"M"],[51,"O"],[52,"T"],[63,"o"],[67,"A"],[78,"R"],[82,"L"],[93,"G"],[97,"U"],[108,"E"],[112,"K"],[113,"I"],[114,"D"],[115,"D"],[116,"O"],[123,"D"],[138,"L"],[153,"y"]]},
 {size:'medium',shape:'square',boardSeed:2840983420,rack:'LHAOYXR',best:51,answer:'FLAXY',
  cells:[[17,"C"],[18,"O"],[19,"R"],[20,"R"],[21,"A"],[22,"L"],[32,"R"],[47,"U"],[62,"R"],[76,"T"],[77,"A"],[78,"J"],[90,"A"],[91,"R"],[93,"U"],[99,"E"],[100,"M"],[101,"E"],[105,"M"],[106,"Y"],[108,"L"],[112,"D"],[113,"O"],[114,"M"],[115,"i"],[116,"N"],[117,"G"],[120,"I"],[121,"S"],[123,"E"],[126,"N"],[127,"E"],[128,"N"],[129,"E"],[136,"T"],[137,"I"],[138,"P"],[139,"T"],[140,"O"],[141,"E"],[150,"F"],[151,"E"],[152,"N"],[153,"S"]]},
 {size:'medium',shape:'square',boardSeed:939339237,rack:'HLIYANA',best:72,answer:'YA',
  cells:[[2,"J"],[6,"P"],[7,"I"],[8,"N"],[9,"C"],[10,"H"],[11,"E"],[12,"R"],[16,"R"],[17,"A"],[18,"P"],[19,"I"],[20,"N"],[21,"E"],[24,"R"],[32,"U"],[39,"I"],[42,"Q"],[47,"K"],[54,"M"],[57,"U"],[61,"B"],[62,"E"],[69,"P"],[70,"I"],[71,"X"],[72,"E"],[73,"L"],[74,"s"],[76,"O"],[77,"D"],[80,"O"],[84,"E"],[87,"U"],[89,"O"],[91,"W"],[94,"C"],[95,"R"],[96,"A"],[97,"Z"],[98,"E"],[99,"D"],[102,"E"],[104,"D"],[106,"l"],[110,"G"],[112,"E"],[116,"T"],[117,"R"],[118,"I"],[119,"O"],[121,"E"],[125,"I"],[127,"E"],[134,"M"],[136,"G"],[140,"C"],[151,"S"]]}];
const levelById=id=>LEVELS.find(L=>L.id===id);
function levelCfg(Lv,variant){ if(variant==null) variant=Lv.v; const seed='TCL1|'+Lv.id+(variant?'|'+variant:'');
  if(Lv.type==='puzzle'){ const Z=PUZZLES[Lv.puzzle];
    return {size:Z.size,shape:Z.shape,boardSeed:Z.boardSeed,bagSeed:h32(seed+'|g'),mods:{},players:[{name:'You',ai:null}],solo:true,turns:1,first:0,preset:{cells:Z.cells,racks:[Z.rack]}}; }
  const duel=Lv.type==='duel';
  return {size:Lv.size,shape:Lv.shape,boardSeed:h32(seed+'|b'),bagSeed:h32(seed+'|g'),mods:Object.assign({},Lv.mods),
    players:duel?[{name:'You',ai:null},{name:AI_NAMES[Lv.ai],ai:Lv.ai}]:[{name:'You',ai:null}],solo:!duel,turns:duel?0:Lv.turns,first:duel?'toss':0}; }
// How player 0 did, for stars and for the bots
function levelOutcome(Lv,st){ const g=gameStats(st,0), fin=st.result?st.result.final:st.scores, score=fin[0];
  const o={score,win:Lv.type==='duel'?st.result&&st.result.winner===0:false,margin:fin.length>1?fin[0]-fin[1]:0,full:g.fullRacks>0,long:g.longest.length,
    move:g.best?g.best.sc:0,swaps:g.swaps};
  if(Lv.type==='duel') o.goal=o.win; else if(Lv.type==='target') o.goal=score>=Lv.goal.v; else o.goal=score>=Math.ceil(PUZZLES[Lv.puzzle].best*Lv.goal.v/100);
  const t=Lv.twist; o.twist=t.k==='margin'?o.win&&o.margin>=t.v:t.k==='full'?o.full:t.k==='score'?score>=t.v&&(Lv.type!=='duel'||o.win):t.k==='long'?o.long>=t.v:
    t.k==='noswap'?o.goal&&!o.swaps:t.k==='move'?o.move>=t.v:t.k==='best'?score>=PUZZLES[Lv.puzzle].best:false;
  return o; }
function goalText(Lv){ if(Lv.type==='duel') return `Beat the ${AI_NAMES[Lv.ai]} computer`; if(Lv.type==='target') return `Score ${Lv.goal.v} in ${Lv.turns} turns`;
  return `Score at least ${Math.ceil(PUZZLES[Lv.puzzle].best*Lv.goal.v/100)} in one move`; }
function twistText(Lv){ const t=Lv.twist; return t.k==='margin'?`Win by ${t.v} or more`:t.k==='full'?'Play a Full Rack (all 7 tiles)':t.k==='score'?(Lv.type==='duel'?`Win with ${t.v}+ points`:`Score ${t.v}+`):
  t.k==='long'?`Play a word of ${t.v}+ letters`:t.k==='noswap'?(Lv.type==='duel'?'Win without swapping':'Never swap'):t.k==='move'?`Score ${t.v}+ in one move`:`Find the best move (${PUZZLES[Lv.puzzle].best})`; }
const TYPE_NAMES={duel:'Duel',target:'Score target',puzzle:'Best move puzzle'};
