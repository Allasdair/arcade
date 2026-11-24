// ===================== Drift campaign and Endless =====================
// Three campaigns (Easy, Normal, Hard), 15 levels each. Every level is a recipe (world size, incoming count and mix,
// rock speed, rock types, wrap, drones, power-ups, any twist) with a fixed seed, so its rock order is the same on
// every attempt. The mix follows the kickoff: 1-3 basics, 4 introduces wrap, 5 and 9 a new rock type, 7 and 14
// twists, 8 drone-heavy (Easy 8 introduces the Shield), 12 a storm of fast Smalls, 15 a boss.
// Par times (the third star) come from the casual bot: median clear time × ~1.15 (tests/sim.js), rounded to 5 s.
const fmtTime=s=>{ s=Math.max(0,Math.floor(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
const fmtNum=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,',');
const CAMPAIGNS=[{id:'easy',name:'Easy',boss:'titan'},{id:'normal',name:'Normal',boss:'bastion'},{id:'hard',name:'Hard',boss:'leviathan'}];
const LEVEL_NAMES={
 easy:['First Light','Loose Gravel','Slow Tumble','Side Door','Hard Shell','Crosswind','Coast','Bubble','Gold Vein','Tumbler','Shale','Hailstorm','Long Way Round','Last Breath','Titan'],
 normal:['Outer Belt','Scatter','Pressure Front','Every Door','Short Fuse','Hunting Ground','Low Visibility','Swarm','Cold Front','Splinters','Crossfire','Meteor Shower','Drifters','Weightless','Bastion'],
 hard:['Deep Field','Rubble Run','Crush Depth','Fault Lines','Lodestone','Gauntlet','Event Horizon','Kill Box','Everything','Breakwater','Tidal Lock','Firestorm','Iron Sky','Blackout','Leviathan']};
const TWIST_NAMES={nobrake:'No brake',onelife:'One life',fog:'Fog',space:'True space',well:'Gravity well',storm:'Storm',drones:'Drone swarm',boss:'Boss',shield:'New: Shield'};
const TYPE_NAMES={stone:'Stone',armour:'Armoured',volatile:'Volatile',ice:'Ice',magnet:'Magnetic',gold:'Gold'};
const PUP_NAMES={spread:'Spread',rapid:'Rapid',pierce:'Pierce',shield:'Shield',shock:'Shockwave'};
// Measured par times in seconds (casual-bot median × 1.15, 8 runs per level, 2026-11-24); see tests/sim.js.
const PAR={e1:40,e2:65,e3:45,e4:45,e5:70,e6:65,e7:120,e8:85,e9:100,e10:90,e11:100,e12:45,e13:115,e14:115,e15:90,n1:140,n2:140,n3:140,n4:170,n5:165,n6:205,n7:270,n8:335,n9:265,n10:225,n11:235,n12:120,n13:275,n14:595,n15:240,h1:365,h2:375,h3:435,h4:480,h5:515,h6:400,h7:390,h8:655,h9:615,h10:565,h11:500,h12:270,h13:535,h14:675,h15:305};
const NORMAL_PAR={easy:125,normal:330,hard:605}; // Normal mode at Normal density; scaled by density

function recipe(ci,n){ const C=CAMPAIGNS[ci], D=DIFFS[C.id], id=C.id[0]+n;
  const range=[[8,20],[20,40],[40,60]][ci], count=n>=15?[6,10,8][ci]:Math.round(range[0]+(range[1]-range[0])*Math.min(1,(n-1)/13));
  const sp=D.spd*([0.85,0.87,0.82][ci]+0.2*(n-1)/14);
  // rock types: each campaign keeps what came before and adds two
  const T=[['stone',60]], add=(t,w)=>T.push([t,w]);
  if(ci===0){ if(n>=5) add('armour',12); if(n>=9) add('gold',5); }
  if(ci===1){ add('armour',8); add('gold',4); if(n>=5) add('volatile',12); if(n>=9) add('ice',12); }
  if(ci===2){ add('armour',8); add('gold',4); add('volatile',8); add('ice',8); if(n>=5) add('magnet',12); if(n>=9){ T.length=0; [['stone',30],['armour',12],['volatile',12],['ice',12],['magnet',12],['gold',5]].forEach(x=>T.push(x)); } }
  // wrap: introduced at level 4, then on some later levels
  const WR=[{4:'lr',6:'lr',10:'lr',13:'lr'},{4:'all',6:'lr',10:'all',11:'all',13:'lr'},{4:'lr',6:'all',10:'lr',11:'all',13:'all'}][ci];
  // power-ups: Spread and Rapid from the start, Shield from Easy 8, Pierce from Easy 10, Shockwave from Easy 13
  let pk=['spread','rapid']; if(ci>0||n>=8) pk.push('shield'); if(ci>0||n>=10) pk.push('pierce'); if(ci>0||n>=13) pk.push('shock');
  const cfg={mode:'campaign',diff:C.id,W:D.W,H:D.H,count,mix:D.mix.slice(),types:T,spd:sp,wrap:WR[n]||'none',
    drones:ci>0&&(ci===2||n>=6),droneEvery:ci===2?[2400,3000]:[2700,3600],droneFast:ci===2&&n>=10,pups:true,pupKinds:pk,
    space:false,nobrake:false,well:false,ricochet:false,lives:3,fog:false,group:D.group,calm:D.calm,groupT:D.groupT,boss:null,mult:D.mult,seed:`DRC1|${id}`};
  if(n<=3) cfg.mix=[[30,40,30],[45,35,20],[60,30,10]][ci];
  let twist=null;
  if(n===7) twist=['nobrake','fog','well'][ci];
  if(n===14) twist=['onelife','space','onelife'][ci];
  if(n===8) twist=ci===0?'shield':'drones';
  if(n===12) twist='storm';
  if(n===15) twist='boss';
  if(twist==='nobrake'){ cfg.nobrake=true; cfg.glide=true; }
  if(twist==='fog') cfg.fog=true;
  if(twist==='well'){ cfg.well=true; cfg.count=Math.round(count*0.8); }
  if(twist==='space'){ cfg.space=true; cfg.nobrake=true; }
  if(twist==='onelife'){ cfg.lives=1; if(ci===2) cfg.fog=true; }
  if(twist==='drones'){ cfg.drones=true; cfg.droneEvery=ci===2?[1200,1500]:[1500,1900]; }
  if(twist==='storm'){ cfg.count=Math.round(count*1.4); cfg.mix=[0,10,90]; cfg.spd=sp*1.4; cfg.group=D.group+2; cfg.groupT=Math.round(D.groupT*0.6); cfg.calm=D.calm+4; }
  if(twist==='boss'){ cfg.boss=C.boss; cfg.count=count; cfg.groupT=D.groupT*2; }
  const par=PAR[id]||Math.round(20+count*4.5);
  return {id,ci,n,camp:C.id,name:LEVEL_NAMES[C.id][n-1],cfg,twist,par,boss:twist==='boss'?C.boss:null}; }
const LEVELS=[]; for(let ci=0;ci<3;ci++) for(let n=1;n<=15;n++) LEVELS.push(recipe(ci,n));
const LEVEL_BY={}; for(const L of LEVELS) LEVEL_BY[L.id]=L;
const levelCfg=(L,extra)=>Object.assign(JSON.parse(JSON.stringify(L.cfg)),extra||{});
function levelLabel(L){ const c=L.cfg, x=[`${c.count} rocks`]; if(c.wrap!=='none') x.push(c.wrap==='all'?'Wrap: all sides':'Wrap: left/right');
  if(L.twist&&L.twist!=='boss') x.push(TWIST_NAMES[L.twist]); if(c.drones&&L.twist!=='drones') x.push('Drones'); return x.join(' · '); }
function levelTypes(L){ return L.cfg.types.map(t=>TYPE_NAMES[t[0]]).join(' · '); }
const LEVEL_TIPS={
 e1:'Thrust, turn and fire. Clear every incoming rock to win.',e4:'New: wrap. Fly off the left edge and you come back on the right.',e5:'New: Armoured rocks. The first hit only cracks the shell.',
 e7:'Twist: no brake, and the ship glides further. Plan your stops.',e8:'New: the Shield power-up absorbs one hit.',e9:'New: Gold rocks are rare and worth five times the score.',
 e12:'A storm: lots of fast Smalls. Keep moving.',e14:'Twist: one life.',e15:'Boss: Titan. It sheds Larges as it weakens.',
 n4:'Wrap on all sides.',n5:'New: Volatile rocks explode and damage what is around them.',n6:'Hunter drones arrive from the edges and fire aimed shots.',
 n7:'Twist: fog. You only see around your ship; the radar still works.',n8:'Drone swarm: drones come twice as often.',n9:'New: Ice rocks break into fast shards.',n12:'A storm of fast Smalls.',
 n14:'Twist: true space. No drag and no brake.',n15:'Boss: Bastion. Only its glowing cracks take damage, and they move.',
 h1:'Hard space: big field, fast rocks, drones from the start.',h5:'New: Magnetic rocks pull your ship in when you get close.',h7:'Twist: a gravity well in the centre pulls ship and rocks.',
 h8:'Drone swarm.',h9:'Every rock type at once.',h12:'Firestorm: fast Smalls everywhere.',h14:'Twist: one life, in fog.',h15:'Boss: Leviathan. Break the orbiting ring, then the core. Watch for its shockwaves.'};
const levelTip=L=>LEVEL_TIPS[L.id]||'Clear every incoming rock.';
function normalPar(diff,density){ return Math.round(NORMAL_PAR[diff]*DENSITY[density||'normal']/5)*5; }

// ---------- Endless: each wave is a group of incoming rocks; more, faster and stranger as it goes ----------
const ENDLESS_W=1200, ENDLESS_H=1500;
function waveSpec(n){ const T=[['stone',60]];
  if(n>=3){ T.push(['armour',Math.min(14,2*n)]); T.push(['gold',4]); } if(n>=4) T.push(['volatile',Math.min(12,2*n-4)]);
  if(n>=5) T.push(['ice',Math.min(12,2*n-6)]); if(n>=7) T.push(['magnet',Math.min(10,2*n-10)]);
  const L=Math.min(70,30+3*n), M=30;
  return {count:Math.min(44,5+3*n),mix:[L,M,Math.max(0,100-L-M)],types:T,spd:Math.min(2,1+0.09*(n-1)),drones:n>=6,
    droneEvery:[Math.max(1200,3000-100*n),Math.max(1800,3900-100*n)],droneFast:n>=12,group:Math.min(5,2+Math.floor(n/4)),
    calm:Math.min(9,3+Math.floor(n/2)),groupT:Math.max(240,500-20*n)}; }
function endlessCfg(mods){ const m=Object.assign({wrap:'none',well:'off'},mods||{});
  return {mode:'endless',diff:'normal',W:ENDLESS_W,H:ENDLESS_H,wrap:m.wrap,well:m.well==='on',pups:true,pupKinds:PUP_KINDS.slice(),lives:3,
    mult:1*(m.well==='on'?1.2:1),mods:m,seed:randSeed()}; }
const MILESTONE_EVERY=5;
