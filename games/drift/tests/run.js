// node tests/run.js   (Node only, no dependencies; QUICK=1 for short sims)
const {load,ok,eq,res}=require('./lib.js'); const L=load(); const QUICK=!!process.env.QUICK; const t0=Date.now();
const sec=n=>console.log('\n# '+n);
// ---------- helpers ----------
// an empty field: no queue, nothing spawning, the ship parked in the middle and unprotected
function field(o){ const st=L.newGame(Object.assign({seed:'test',count:0,steer:'classic',fire:'hold',drones:false,W:3000,H:3000},o||{})); st.queue=[PARK]; st.spawnT=1e9; st.cfg.calm=-1; st.total=1; st.ship.prot=0; return st; }
const PARK={size:1,type:'stone',park:1}; // one rock parked in the queue so an empty test field never counts as cleared
const unpark=st=>{ st.queue=st.queue.filter(q=>!q.park); return st; };
const run=(st,n,ins)=>{ for(let i=0;i<n;i++) L.step(st,i===0?ins||[]:[]); return st; };
const hold=(st,n,keys)=>{ L.step(st,keys.map(k=>['p',k])); for(let i=1;i<n;i++) L.step(st,[]); L.step(st,keys.map(k=>['r',k])); return st; };
function rock(st,size,x,y,vx,vy,type){ const r=L.makeRock(st,size,type||'stone',x,y,vx||0,vy||0); st.rocks.push(r); return r; }
const speed=sh=>Math.hypot(sh.vx,sh.vy);
const near=(a,b,e)=>Math.abs(a-b)<=(e||1e-6);

sec('angles');
eq([L.dirX(0),L.dirY(0)],[0,-1],'angle 0 points up'); ok(near(L.dirX(64),1)&&near(L.dirY(64),0,1e-6),'64 points right');
for(let a=0;a<256;a+=7) eq(L.angOf(L.dirX(a)*50,L.dirY(a)*50),a,`angOf inverts direction ${a}`);
eq(L.angDiff(250,10),16,'short way across 0 (+)'); eq(L.angDiff(10,250),-16,'short way across 0 (-)');

sec('ship: thrust, drag, true space, brake, turning');
{ const st=field(); hold(st,30,['up']); ok(st.ship.vy<-4,'thrust accelerates the ship the way it faces (up)'); ok(near(st.ship.vx,0,1e-9),'no sideways drift from thrusting straight');
  const st2=field({W:9000,H:9000}); hold(st2,200,['up']); ok(speed(st2.ship)<=L.MAXV&&speed(st2.ship)>=L.MAXV*L.DRAG-1e-9,'speed is capped at MAXV'); let t=0; while(speed(st2.ship)>0&&t<600){ L.step(st2,[]); t++; }
  ok(t>=90&&t<=150,`with drag the ship slides to a stop in about 2 s (${(t/60).toFixed(2)} s)`);
  const sp=field({space:true,nobrake:true}); hold(sp,40,['up']); const v0=speed(sp.ship); run(sp,120); ok(near(speed(sp.ship),v0,1e-9),'true space: no drag at all');
  hold(sp,300,['up']); ok(speed(sp.ship)<=L.MAXV+1e-9,'true space still caps speed'); const v1=speed(sp.ship); hold(sp,20,['down']); ok(near(speed(sp.ship),v1,1e-9),'true space: no brake');
  const br=field(); hold(br,40,['up']); const vb=speed(br.ship); hold(br,10,['down']); ok(speed(br.ship)<vb*0.4,'brake decelerates strongly (Classic ▼)');
  const tr=field(); hold(tr,54,['right']); ok(Math.abs(L.angDiff(tr.ship.a,0))<=L.TURN+1e-9,`about one full turn per 0.9 s (a=${tr.ship.a.toFixed(1)})`);
  const d=field({steer:'direct'}); d.ship.a=10; hold(d,4,['left']); ok(d.ship.a<10||d.ship.a>200,'Direct: pointing left from 10 turns the short way (counter-clockwise)');
  const d2=field({steer:'direct'}); d2.ship.a=0; L.step(d2,[['p','right'],['p','down']]); run(d2,40); eq(Math.round(d2.ship.a),96,'Direct: diagonals (down-right = 96)');
  const d3=field({steer:'direct'}); L.step(d3,[['p','up']]); run(d3,5); ok(speed(d3.ship)===0,'Direct: a quick tap aims without thrusting'); run(d3,20); ok(speed(d3.ship)>1,'Direct: holding the direction thrusts');
  const sk=field(); L.step(sk,[['stick',64,0]]); run(sk,40); eq(Math.round(sk.ship.a),64,'thumbstick: the ship faces the drag direction'); ok(speed(sk.ship)>2,'thumbstick: a long drag thrusts');
  const sk2=field(); L.step(sk2,[['stick',0,16]]); run(sk2,60); ok(speed(sk2.ship)===0&&Math.round(sk2.ship.a)===128,'thumbstick: a short drag only aims'); }

sec('fire: rate, cap, range, inherited speed');
{ const st=field(); L.step(st,[['p','fire']]); run(st,59); const shots=st.stats.shots; ok(shots>=6&&shots<=6,`about 6 shots a second (${shots})`);
  ok(st.bullets.length<=L.BUL_MAX,'at most 6 bullets on screen');
  const st2=field({W:4000,H:4000}); st2.ship.x=2000; st2.ship.y=2000; L.step(st2,[['p','fire']]); L.step(st2,[['r','fire']]); const b=st2.bullets[0], y0=b.y; let n=0; while(st2.bullets.includes(b)){ L.step(st2,[]); n++; }
  const dist=L.BUL_V*L.BUL_LIFE; ok(dist>=0.65*L.VIEW_W&&dist<=0.75*L.VIEW_W,`a bullet flies about 70% of the view (${dist} of ${L.VIEW_W})`);
  const st3=field({W:4000,H:4000}); st3.ship.x=2000; st3.ship.y=2000; st3.ship.vy=-5; L.step(st3,[['p','fire']]); ok(near(st3.bullets[0].vy,-L.BUL_V-5*L.DRAG,0.3),'the ship\'s speed is added to the bullet');
  const tp=field({fire:'tap'}); L.step(tp,[['p','fire']]); L.step(tp,[['r','fire']]); run(tp,60); eq(tp.stats.shots,1,'Off (tap): one shot per press');
  const on=field({fire:'on'}); run(on,60); ok(on.stats.shots>=5,'auto-fire on: fires at the normal rate'); const rg=field({fire:'range'}); run(rg,60); eq(rg.stats.shots,0,'D-pad only: no fire with no rock in range');
  rock(rg,3,rg.ship.x,rg.ship.y-300); run(rg,30); ok(rg.stats.shots>0,'D-pad only: fires while a rock is in range'); }

sec('dash');
{ const st=field({W:3000,H:3000}); st.ship.x=1500; st.ship.y=1500; L.step(st,[['p','dash']]); ok(st.ship.inv===L.DASH_INV-0||st.ship.inv===L.DASH_INV,'dash gives 0.3 s of invincibility'); eq(L.DASH_INV,18,'0.3 s = 18 ticks');
  const y0=st.ship.y; run(st,18); ok(y0-st.ship.y>150,`dash carries the ship (${Math.round(y0-st.ship.y)} units)`); L.step(st,[['p','dash']]); eq(st.stats.dashes,1,'dash has a cooldown'); run(st,L.DASH_CD); L.step(st,[['p','dash']]); eq(st.stats.dashes,2,'3 s cooldown ends'); eq(L.DASH_CD,180,'cooldown 3 s');
  const c=field(); rock(c,2,c.ship.x,c.ship.y-60,0,0); L.step(c,[['p','dash']]); run(c,6); eq(c.lives,3,'dashing through a rock costs no life'); eq(c.stats.closeCall,1,'Close Call is counted'); }

sec('rocks: hits, splits, scores, combo, speeds');
{ for(const [size,hits] of [[3,3],[2,2],[1,1]]) eq(L.ROCK_HP[size],hits,`size ${size} takes ${hits} hits`);
  const st=field(); const r=rock(st,3,400,200); let k=0; while(st.rocks.includes(r)&&k<5){ L.damage(st,r,1,'bullet',[0,1]); k++; } eq(k,3,'a Large takes 3 hits');
  eq(st.rocks.filter(x=>x.size===2).length,2,'Large → 2 Mediums'); eq(st.score,60,'Large scores 60 (Easy ×1)');
  const counts=new Set(); for(let i=0;i<40;i++){ const s=field({seed:'m'+i}); const m=rock(s,2,400,300); L.damage(s,m,2,'bullet',null); counts.add(s.rocks.filter(x=>x.size===1).length); }
  ok(counts.has(2)&&counts.has(3)&&counts.size===2,'Medium → 2 or 3 Smalls (seeded)');
  const s1=field(); const sm=rock(s1,1,400,300); L.damage(s1,sm,1,'bullet',null); eq(s1.rocks.length,0,'Small → dust'); eq(s1.score,20,'Small scores 20');
  const s2=field(); const m2=rock(s2,2,400,300,1,0); L.damage(s2,m2,1,'bullet',[0,1]); ok(m2.flash>0&&m2.vy>0,'a hit flashes and pushes the rock back');
  const s3=field(); const p=rock(s3,3,400,300,0,-1); L.damage(s3,p,3,'bullet',null); for(const c of s3.rocks){ ok(Math.hypot(c.vx,c.vy)>=1-1e-9,'pieces are at least as fast as the parent'); ok(c.vy<0,'pieces fly on from the parent\'s direction'); }
  // combo
  const cb=field(); for(let i=0;i<14;i++){ const r=rock(cb,1,100+i*30,300); L.damage(cb,r,1,'bullet',null); L.step(cb,[]); }
  eq(cb.stats.comboMax,13,'kills within 1.5 s build the combo'); ok(cb.score===Math.round(20)+[...Array(13)].reduce((a,_,i)=>a+Math.round(20*Math.min(2,1+0.1*(i+1))),0),'+10% per step, capped at ×2');
  run(cb,L.COMBO_T); eq(cb.combo.n,0,'combo resets 1.5 s after the last kill');
  for(const d of L.DIFF_IDS){ const c=L.normalCfg(d,{}); eq(c.spd,{easy:1,normal:1.5,hard:2}[d],`${d} rock speed ×${c.spd}`); eq(c.mult,L.DIFFS[d].mult*L.modMult(L.defMods(d)),`${d} score multiplier = difficulty × its default modifiers`); }
  eq([L.DIFFS.easy.W,L.DIFFS.easy.H,L.DIFFS.normal.W,L.DIFFS.hard.H],[800,1000,1200,2000],'world sizes grow with difficulty'); }

sec('wrap and soft walls');
{ for(const w of ['none','lr','all']){ const st=field({wrap:w}); st.ship.x=st.W-20; st.ship.vx=6; run(st,w==='none'?1:5);
    if(w==='none') ok(st.ship.x<=st.W-L.SHIP_R&&st.ship.vx===0&&st.ship.wall===1,'none: the ship stops at the soft wall and glows');
    else ok(st.ship.x<50,`${w}: the ship wraps left/right`);
    const s2=field({wrap:w}); s2.ship.y=20; s2.ship.vy=-6; run(s2,5); if(w==='all') ok(s2.ship.y>s2.H-60,'all: the ship wraps top/bottom'); else ok(s2.ship.y>=L.SHIP_R&&s2.ship.vy===0,`${w}: top is a soft wall`);
    const b=field({wrap:w}); b.ship.x=b.W-30; b.ship.a=64; L.step(b,[['p','fire']]); L.step(b,[['r','fire']]); run(b,10); if(w==='none') eq(b.bullets.length,0,'bullets disappear at a soft wall'); else ok(b.bullets.length===1&&b.bullets[0].x<200,`${w}: bullets wrap`);
    const r=field({wrap:w}); const q=rock(r,2,r.W-10,300,3,0); run(r,30);
    if(w==='none'){ ok(!r.rocks.includes(q),'a rock exits through a soft wall'); eq(r.queue.length,2,'…and goes back to the incoming queue'); }
    else ok(r.rocks.includes(q)&&q.x<200,`${w}: rocks wrap`); }
  const sx=field({wrap:'lr'}); const r=rock(sx,2,5,300,0,0); sx.ship.x=sx.W-10; sx.ship.y=300; sx.ship.prot=0; L.step(sx,[]); eq(sx.lives,2,'collisions work across a wrapped seam');
  const rc=field({ricochet:true}); rc.ship.x=rc.W-30; rc.ship.a=64; L.step(rc,[['p','fire']]); L.step(rc,[['r','fire']]); run(rc,8); ok(rc.bullets.length===1&&rc.bullets[0].vx<0,'ricochet: bullets bounce once off a soft wall'); }

sec('incoming rocks, progress, the win');
{ const cfg=L.normalCfg('easy',{},{seed:'win'}); const st=L.newGame(cfg); eq(st.queue.length,20,'Easy: 20 incoming'); eq(L.newGame(L.normalCfg('normal',{})).queue.length,40,'Normal: 40'); eq(L.newGame(L.normalCfg('hard',{})).queue.length,60,'Hard: 60');
  eq(L.newGame(L.normalCfg('normal',{density:'more'})).queue.length,60,'More density ×1.5'); eq(L.newGame(L.normalCfg('normal',{density:'few'})).queue.length,30,'Fewer ×0.75');
  const mix={1:0,2:0,3:0}; for(let i=0;i<30;i++) for(const q of L.newGame(L.normalCfg('hard',{},{seed:'mx'+i})).queue) mix[q.size]++; const n=mix[1]+mix[2]+mix[3];
  ok(Math.abs(mix[3]/n-0.7)<0.04&&Math.abs(mix[1]/n-0.05)<0.03,`Hard mix leans Large (${Math.round(mix[3]/n*100)}/${Math.round(mix[2]/n*100)}/${Math.round(mix[1]/n*100)})`);
  eq(L.progress(st),0,'progress starts at 0'); const tot=L.remaining(st); ok(tot>0,'the total counts the queue');
  run(st,200); ok(st.pending.length+st.rocks.length>0,'rocks spawn in groups'); ok(L.remaining(st)===tot,'rocks in play still count (a Large as its full set of pieces)');
  const w=L.newGame(Object.assign({},cfg,{seed:'warn'})); let warned=0, entered=0; for(let i=0;i<300;i++){ L.step(w,[]); for(const e of w.ev){ if(e.e==='warn') warned++; if(e.e==='enter') entered++; } } ok(warned>0&&entered>0&&warned>=entered,'every rock is announced before it enters');
  const fw=L.newGame(Object.assign({},cfg,{seed:'warn'})); let tw=0, te=0; for(let i=0;i<300&&!te;i++){ L.step(fw,[]); for(const e of fw.ev){ if(e.e==='warn'&&!tw) tw=fw.tick; if(e.e==='enter'&&!te) te=fw.tick; } } ok(te-tw>=55&&te-tw<=70,`the warning comes about 1 s before entry (${te-tw} ticks)`);
  // spawn protection: never aimed straight at the ship
  let aimed=0, total=0; for(let i=0;i<200;i++){ const s=L.newGame(Object.assign({},cfg,{seed:'aim'+i})); s.ship.prot=999; const e=L.entry(s,3); const sx=s.ship.x-e.x, sy=s.ship.y-e.y; total++; if((e.vx*sx+e.vy*sy)/Math.hypot(e.vx,e.vy)/Math.hypot(sx,sy)>0.97) aimed++; }
  eq(aimed,0,`no rock is aimed straight at a protected ship (${total} entries)`);
  const c=field(); run(c,5); ok(c.phase==='play','not cleared while the queue has rocks');
  const c2=unpark(field()); const r=rock(c2,1,100,100); L.step(c2,[]); ok(c2.phase==='play','not cleared while a piece is left'); L.damage(c2,r,1,'bullet',null); L.step(c2,[]); eq(c2.phase,'clearing','cleared when the queue is empty and no piece is left'); run(c2,60); eq(c2.phase,'done','…then done'); ok(c2.result.ok,'result ok'); }

sec('lives');
{ const st=field(); rock(st,2,st.ship.x,st.ship.y); L.step(st,[]); eq(st.lives,2,'a hit costs a life'); ok(st.ship.dead>0,'the ship explodes'); st.rocks=[]; rock(st,3,200,200,0,0); rock(st,3,600,800,0,0);
  run(st,L.DIE_T+1); ok(!st.ship.dead,'it respawns after 1.5 s'); ok(Math.hypot(st.ship.x-200,st.ship.y-200)>200&&Math.hypot(st.ship.x-600,st.ship.y-800)>200,'in a safe open spot'); eq(st.ship.prot,L.PROT_T-1,'with 2 s of protection');
  hold(st,8,['up']); eq(st.ship.prot,0,'thrusting ends protection early'); const s2=field(); s2.ship.prot=100; L.step(s2,[['p','fire']]); eq(s2.ship.prot,0,'firing ends it too');
  const p=field(); p.ship.prot=60; rock(p,2,p.ship.x,p.ship.y); L.step(p,[]); eq(p.lives,3,'no hit while protected');
  const x=field(); x.score=9990; const r=rock(x,1,100,100); L.damage(x,r,1,'bullet',null); eq(x.lives,4,'extra life at 10,000'); x.lives=5; x.score=19990; const r2=rock(x,1,100,100); L.damage(x,r2,1,'bullet',null); eq(x.lives,5,'up to 5 lives');
  const o=field({lives:1}); rock(o,2,o.ship.x,o.ship.y); L.step(o,[]); eq(o.phase,'dying','no lives left: the game ends'); run(o,L.DIE_T); eq(o.phase,'over','game over'); ok(!o.result.ok,'lost'); }

sec('power-ups');
{ let drops=0; const st=field({seed:'drops'}); for(let i=0;i<10000;i++){ const r=rock(st,2,400,300); L.damage(st,r,2,'bullet',null); st.rocks=[]; } drops=st.pups.length;
  ok(Math.abs(drops/10000-0.04)<0.008,`Medium drop rate about 4% over 10,000 kills (${(drops/100).toFixed(2)}%)`);
  const sl=field({seed:'drops2'}); let lg=0; for(let i=0;i<5000;i++){ const r=rock(sl,3,400,300); L.destroy(sl,r,'bullet'); sl.rocks=[]; } ok(sl.pups.length/5000>0.055,'more often from Larges');
  const g=field(); g.pups=[]; const gr=rock(g,1,300,300,0,0,'gold'); L.damage(g,gr,1,'bullet',null); eq(g.pups.length,1,'gold always drops one');
  const pk=field(); pk.pups=[{x:pk.ship.x,y:pk.ship.y,k:'spread',life:100}]; L.step(pk,[]); eq(pk.power.held,'spread','fly over a power-up to collect it');
  pk.pups=[{x:pk.ship.x,y:pk.ship.y,k:'rapid',life:100}]; L.step(pk,[]); ok(pk.power.held==='rapid'&&pk.ev.some(e=>e.e==='pickup'&&e.swap==='spread'),'one slot: a new pickup replaces the held one');
  const lf=field(); lf.pups=[{x:50,y:50,k:'shield',life:L.PUP_LIFE}]; run(lf,L.PUP_LIFE-1); eq(lf.pups.length,1,'a drop lasts 8 s'); L.step(lf,[]); eq(lf.pups.length,0,'then goes');
  const sp=field(); sp.power.held='spread'; L.step(sp,[['p','use']]); eq(sp.power.active,'spread','Select uses it'); L.step(sp,[['p','fire']]); eq(sp.bullets.length,3,'Spread: 3-way shots'); run(sp,L.PUP_T); eq(sp.power.active,null,'timed ones run 10 s');
  const rp=field(); rp.power.held='rapid'; L.step(rp,[['p','use'],['p','fire']]); run(rp,59); ok(rp.stats.shots>=11,`Rapid doubles the fire rate (${rp.stats.shots})`);
  const pi=field(); pi.power.held='pierce'; L.step(pi,[['p','use']]); rock(pi,1,pi.ship.x,pi.ship.y-80); rock(pi,1,pi.ship.x,pi.ship.y-160); L.step(pi,[['p','fire']]); L.step(pi,[['r','fire']]); run(pi,20); eq(pi.rocks.length,0,'Pierce: shots pass through rocks');
  const sh=field(); sh.power.held='shield'; L.step(sh,[['p','use']]); ok(sh.ship.shield,'Shield is up'); run(sh,2000); ok(sh.ship.shield,'Shield has no time limit'); rock(sh,2,sh.ship.x,sh.ship.y); L.step(sh,[]); ok(sh.lives===3&&!sh.ship.shield,'Shield absorbs one hit');
  const sk=field(); sk.power.held='shock'; const a=rock(sk,1,sk.ship.x+100,sk.ship.y), b=rock(sk,3,sk.ship.x-150,sk.ship.y), far=rock(sk,1,sk.ship.x,sk.ship.y+900>sk.H?20:sk.ship.y+900); L.step(sk,[['p','use']]);
  ok(!sk.rocks.includes(a)&&b.hp===2&&sk.rocks.includes(far),'Shockwave: destroys Smalls, damages everything nearby'); }

sec('rock types');
{ const st=field(); const a=rock(st,2,400,300,0,0,'armour'); L.hitRock(st,a,{x:400,y:250},0,1); ok(!a.arm&&a.hp===2,'Armoured: the first hit only cracks it'); L.hitRock(st,a,{x:400,y:250},0,1); eq(a.hp,1,'then it takes damage');
  const v=field(); const c=rock(v,1,300,300,0,0,'volatile'); const n1=rock(v,1,360,300), n2=rock(v,2,330,370), f=rock(v,1,700,700); L.damage(v,c,1,'bullet',null); ok(!v.rocks.includes(n1)&&n2.hp<2&&v.rocks.includes(f),'Volatile: explodes and damages rocks around it');
  const ch=field(); const v0=rock(ch,1,200,300,0,0,'volatile'); for(let i=1;i<=5;i++) rock(ch,1,200+i*90,300,0,0,'volatile'); L.damage(ch,v0,1,'bullet',null); eq(ch.rocks.length,0,'volatile chain reactions'); ok(ch.stats.chainMax>=5,`a chain counts its kills (${ch.stats.chainMax})`);
  const ic=field(); const i1=rock(ic,2,400,300,1,0,'ice'), s1=field(); const i2=rock(s1,2,400,300,1,0,'stone'); L.damage(ic,i1,2,'bullet',null); L.damage(s1,i2,2,'bullet',null);
  ok(Math.hypot(ic.rocks[0].vx,ic.rocks[0].vy)>1.5*Math.hypot(s1.rocks[0].vx,s1.rocks[0].vy),'Ice: breaks into fast shards');
  const mg=field(); rock(mg,2,mg.ship.x+150,mg.ship.y,0,0,'magnet'); run(mg,20); ok(mg.ship.vx>0,'Magnetic: pulls the ship gently toward it'); const mf=field(); rock(mf,2,mf.ship.x+400,mf.ship.y,0,0,'magnet'); run(mf,20); eq(mf.ship.vx,0,'…only when close');
  const gd=field(); const gr=rock(gd,1,300,300,0,0,'gold'); L.damage(gd,gr,1,'bullet',null); eq(gd.score,100,'Gold: worth 5× score'); }

sec('hunter drones');
{ const st=field({drones:true,droneEvery:[2400,3600],W:1200,H:1500}); st.queue=[{size:3,type:'stone'}]; st.spawnT=99999; st.pending=[]; let t=0; while(!st.drones.length&&t<4000){ L.step(st,[]); t++; }
  ok(t>=2400&&t<=3600,`a drone enters every 40-60 s (${(t/60).toFixed(1)} s)`); const d=st.drones[0]; const p0=[d.x,d.y]; run(st,100); ok(Math.hypot(d.x-p0[0],d.y-p0[1])>50,'it flies a path'); ok(st.ev.length>=0,'');
  let shots=0; for(let i=0;i<300;i++){ L.step(st,[]); shots+=st.ev.filter(e=>e.e==='dshot').length; } ok(shots>=2,'it fires slow aimed shots');
  const h=field(); h.drones=[{id:99,x:300,y:300,vx:0,vy:0,hp:2,t:0,life:1000,fireT:999,orb:0,dir:1,flash:0}]; L.hitDrone(h,h.drones[0],1,true); eq(h.drones[0].hp,1,'2 hits'); L.hitDrone(h,h.drones[0],1,true); eq(h.score,200,'a drone is worth 200');
  const q=field(); q.dshots=[{x:400,y:300,vx:0,vy:0,life:50}]; const r=rock(q,1,400,300); L.step(q,[]); ok(!q.rocks.includes(r),'drone shots destroy rocks'); eq(q.score,0,'…without scoring');
  eq(L.normalCfg('easy',{}).drones,false,'drones off by default on Easy'); eq(L.normalCfg('normal',{}).drones,true,'on from Normal'); }

sec('bosses');
{ const t=field({boss:'titan'}); L.spawnBoss(t,'titan'); const B=t.rocks.find(r=>r.boss); eq(B.hp,30,'Titan: 30 hits'); for(let i=0;i<10;i++) L.damage(t,B,1,'bullet',null); eq(t.rocks.filter(r=>r.size===3).length,2,'sheds 2 Larges at 2/3');
  for(let i=0;i<10;i++) L.damage(t,B,1,'bullet',null); eq(t.rocks.filter(r=>r.size===3).length,4,'and 2 more at 1/3'); for(let i=0;i<10;i++) L.damage(t,B,1,'bullet',null); ok(!t.rocks.includes(B)&&t.rocks.filter(r=>r.size===3).length===7,'breaks into 3 Larges at 0');
  const b=field(); L.spawnBoss(b,'bastion'); const BB=b.rocks.find(r=>r.boss); const ca=BB.cracks[0]+BB.a; const on={x:BB.x+L.dirX(ca)*BB.r,y:BB.y+L.dirY(ca)*BB.r}, off={x:BB.x+L.dirX(ca+42)*BB.r,y:BB.y+L.dirY(ca+42)*BB.r};
  eq(L.hitRock(b,BB,off,0,1),'clank','Bastion: the shell bounces shots'); eq(L.hitRock(b,BB,on,0,1),'hit','only the glowing cracks take damage'); const a0=BB.a; run(b,10); ok(BB.a!==a0,'and the cracks move');
  for(let i=0;i<17;i++) L.damage(b,BB,1,'bullet',null); ok(b.rocks.some(r=>r.size===2),'sheds Mediums'); ok(b.drones.length>=1,'calls a drone at half health');
  const l=field(); L.spawnBoss(l,'leviathan'); const LV=l.rocks.find(r=>r.boss); eq(l.rocks.filter(r=>r.orb).length,8,'Leviathan: a ring of 8 orbiting rocks'); eq(l.drones.length,2,'two drones escort it');
  eq(L.hitRock(l,LV,{x:LV.x,y:LV.y-10},0,1),'clank','the core is shielded while the ring stands'); for(const o of l.rocks.filter(r=>r.orb)) L.damage(l,o,3,'bullet',null);
  eq(L.hitRock(l,LV,{x:LV.x,y:LV.y-10},0,1),'hit','break the ring to expose the core'); LV.age=200; LV.pulseT=1; L.step(l,[]); ok(l.pulses.length===1,'it pulses shockwaves'); ok(l.ship.vx!==0||l.ship.vy!==0||Math.hypot(l.ship.x-LV.x,l.ship.y-LV.y)>500,'and pulls the ship in');
  const lv=L.LEVEL_BY.e15; const s=L.newGame(L.levelCfg(lv)); const bs=s.rocks.find(r=>r.boss); for(let i=0;i<30;i++) L.damage(s,bs,1,'bullet',null); s.queue=[]; s.pending=[]; L.step(s,[]); ok(s.phase==='play','the level is not clear while the boss\'s pieces remain'); }

sec('determinism, saves and resume');
{ const cfg=L.levelCfg(L.LEVEL_BY.n15); const fp=[]; for(let k=0;k<2;k++){ const st=L.botPlay(cfg,'casual',60*40,null,1); fp.push(L.fingerprint(st)); } eq(fp[0],fp[1],'same seed + inputs → same run (fingerprint)');
  const A=L.newGame(L.levelCfg(L.LEVEL_BY.h15)), mem={wait:0}, o=Object.assign({R:L.rngFrom('det')},L.BOT_KINDS.strong); const log=[];
  for(let i=0;i<1800;i++){ const ins=L.botThink(A,o,mem); log.push(ins); L.step(A,ins); }
  const snap=JSON.stringify(L.snapshot(A)); const Bs=JSON.parse(snap); const tail=[]; const o2=Object.assign({},o,{R:Object.assign({},o.R)}), mem2=Object.assign({},mem);
  for(let i=0;i<1200;i++){ const ins=L.botThink(A,o,mem); tail.push(ins); L.step(A,ins); } for(const ins of tail) L.step(Bs,JSON.parse(JSON.stringify(ins)));
  eq(L.fingerprint(Bs),L.fingerprint(A),'a save mid-boss resumes exactly'); ok(snap.length<300000,`saves stay small (${Math.round(snap.length/1024)} KB)`); }

sec('campaign recipes and the bots');
{ eq(L.LEVELS.length,45,'45 levels'); for(const ci of [0,1,2]){ const ls=L.LEVELS.filter(x=>x.ci===ci); eq(ls.length,15,`campaign ${ci} has 15`); ok(ls[14].boss,`level 15 is a boss`); ok(ls[3].cfg.wrap!=='none','level 4 introduces wrap'); }
  eq(L.LEVEL_BY.e1.cfg.count,8,'Easy starts at 8 incoming'); eq(L.LEVEL_BY.e14.cfg.count,20,'and reaches 20 by level 14'); eq(L.LEVEL_BY.n14.cfg.count,40,'Normal reaches 40'); eq(L.LEVEL_BY.h14.cfg.count,60,'Hard reaches 60');
  ok(L.LEVEL_BY.e5.cfg.types.some(t=>t[0]==='armour')&&!L.LEVEL_BY.e4.cfg.types.some(t=>t[0]==='armour'),'Easy 5 introduces Armoured'); ok(L.LEVEL_BY.n9.cfg.types.some(t=>t[0]==='ice'),'Normal 9 introduces Ice'); ok(L.LEVEL_BY.h5.cfg.types.some(t=>t[0]==='magnet'),'Hard 5 introduces Magnetic');
  eq([L.LEVEL_BY.e7.twist,L.LEVEL_BY.n7.twist,L.LEVEL_BY.h7.twist,L.LEVEL_BY.e14.twist,L.LEVEL_BY.n14.twist,L.LEVEL_BY.h14.twist],['nobrake','fog','well','onelife','space','onelife'],'twist levels');
  ok(L.LEVEL_BY.h14.cfg.fog&&L.LEVEL_BY.h14.cfg.lives===1,'Hard 14: one life + fog'); ok(L.LEVEL_BY.e8.cfg.pupKinds.includes('shield')&&!L.LEVEL_BY.e7.cfg.pupKinds.includes('shield'),'Easy 8 introduces the Shield');
  ok(L.LEVEL_BY.n12.cfg.mix[2]===90,'level 12 is a storm of Smalls'); eq(new Set(L.LEVELS.map(x=>x.cfg.seed)).size,45,'each level has its own fixed seed');
  const q1=L.newGame(L.levelCfg(L.LEVEL_BY.n3)).queue, q2=L.newGame(L.levelCfg(L.LEVEL_BY.n3)).queue; eq(q1,q2,'the same rock order every attempt');
  const ids=QUICK?['e1','e8','e15','n15','h15']:L.LEVELS.map(x=>x.id); let cleared=0;
  for(const id of ids){ const lv=L.LEVEL_BY[id]; let okc=false; for(let s=0;s<3&&!okc;s++){ const st=L.botPlay(L.levelCfg(lv),'strong',60*60*12,null,s); okc=st.result.ok; } ok(okc,`the bot clears ${id} ${lv.name}`); if(okc) cleared++; }
  console.log(`  (bot cleared ${cleared}/${ids.length})`); }

sec('Endless');
{ const w1=L.waveSpec(1), w3=L.waveSpec(3), w6=L.waveSpec(6), w12=L.waveSpec(12), w40=L.waveSpec(40);
  ok(w3.count>w1.count&&w12.spd>w1.spd,'waves get bigger and faster'); ok(w1.types.length===1&&w3.types.length>1,'rock types from wave 3'); ok(!L.waveSpec(5).drones&&w6.drones,'drones from wave 6'); ok(!L.waveSpec(11).droneFast&&w12.droneFast,'faster drones from wave 12');
  eq(w40.spd,2,'speed is capped at Hard\'s');
  const st=L.newGame(Object.assign(L.endlessCfg({}),{seed:'end'})); eq(st.wave,1,'Endless starts at wave 1'); st.queue=[]; st.rocks=[]; st.pending=[]; L.step(st,[]); eq(st.phase,'break','a cleared wave gives a break'); eq(st.score,100,'wave-clear bonus 100 × wave'); run(st,180); eq([st.phase,st.wave],['play',2],'then the next wave');
  const n=QUICK?1:3; const waves=[]; for(let i=0;i<n;i++) waves.push(L.botPlay(Object.assign(L.endlessCfg({}),{seed:'endbot'+i}),'casual',60*60*20,null,i).wave);
  console.log(`  (casual bot reached waves ${waves.join(', ')})`); ok(Math.max(...waves)>=5,'the casual bot gets several waves in'); }

sec('core: saves, XP, stars, records, expeditions, achievements');
{ const old=L.loadSave(JSON.stringify({xp:120,ach:{first:1}})); ok(old.xp===120&&old.ctl.layout==='dpad'&&old.endless.bestWave===0&&old.look.ship==='arrow','an old save missing new fields loads through defSave()');
  ok(L.loadSave('garbage').xp===0,'a broken save gives a fresh one'); eq([L.levelOf(0),L.levelOf(49),L.levelOf(50),L.levelOf(3175),L.levelOf(99999)],[1,1,2,10,10],'levels on Sweep\'s first 10 steps');
  for(let l=2;l<=10;l++) ok(L.rewardsAt(l).length>0,`a reward at level ${l}`);
  const S=L.defSave(); const ok1={ok:true,score:1000,ticks:60*60,livesLost:0,shots:100,hits:50,acc:.5,comboMax:2,wave:0,stats:{chainMax:0,comboMax:2,closeCall:0,kills:10,gold:0,shots:100,hits:50},lives:3};
  ok(L.unlocked(S,'e1')&&!L.unlocked(S,'e2')&&!L.unlocked(S,'n1'),'only Easy 1 is open at first');
  let r=L.campaignResult(S,L.LEVEL_BY.e1,Object.assign({},ok1,{livesLost:1,ticks:60*999})); eq(r.fresh,[0],'clearing earns the first star'); eq(r.xp,6,'6 XP per new Easy star'); ok(L.unlocked(S,'e2'),'clearing a level unlocks the next');
  r=L.campaignResult(S,L.LEVEL_BY.e1,Object.assign({},ok1,{ticks:60*10})); eq(r.fresh,[1,2],'stars build up across attempts'); eq(L.campStars(S,'e1'),3,'3 stars'); r=L.campaignResult(S,L.LEVEL_BY.e1,ok1); eq(r.xp,0,'each star is earned once');
  for(const lv of L.LEVELS.filter(x=>x.ci===0)) L.campaignResult(S,lv,Object.assign({},ok1,{livesLost:1,ticks:1e9}));
  ok(L.unlocked(S,'n1'),'clearing level 15 unlocks the next campaign'); const S2=L.defSave(); for(const lv of L.LEVELS.filter(x=>x.ci===0)){ const x=L.campaignResult(S2,lv,Object.assign({},ok1,{livesLost:1,ticks:1e9})); if(lv.n===15) ok(x.campDone&&x.xp===6+75,'finishing a campaign pays 75 XP (Easy)'); }
  const ach=L.checkAch(S,{mode:'campaign',cfg:L.LEVEL_BY.e15.cfg,res:ok1}); ok(ach.includes('titan')&&ach.includes('first'),'Titan Breaker and First Light');
  const N=L.defSave(), cfg=L.normalCfg('hard',{fog:'on'}); const nr=L.normalResult(N,cfg,ok1,'2026-11-24'); ok(nr.newBest&&nr.stars[0]&&nr.stars[1]&&nr.stars[2],'Normal: 3 win stars'); eq(nr.xp,L.normalXP(cfg)+15,'win XP plus +5 per new win star');
  eq(L.normalXP(L.normalCfg('hard',{})),Math.round(45*(1+(L.modMult(L.defMods('hard'))-1)/2)),'Hard win XP = 45 × (1 + half the modifier bonus)'); eq(L.normalResult(N,cfg,ok1,'').xp,L.normalXP(cfg),'win stars pay once per difficulty × wrap');
  ok(N.rec['hard|none|mod']&&!N.rec['hard|none|std'],'runs with modifiers keep a separate best'); eq(L.recKey(L.normalCfg('normal',{})),'normal|none|std','Normal\'s default mods count as standard');
  eq([L.endlessXP(4),L.endlessXP(5),L.endlessXP(10),L.endlessXP(100)],[0,25,55,200],'Endless milestones: 25 rising by 5, capped at 200 a run'); eq(L.milestoneXP(10),50,'capped at 50 per milestone');
  const E=L.defSave(); const est={wave:20,score:5000,cfg:{wrap:'all'},stats:{dashes:0}}; const er=L.endlessResult(E,est); eq(er.exps.map(x=>x.id),['x10','x20','x15w'],'expeditions'); eq(er.xp,200,'expedition XP'); ok(L.owned(E,L.findCos('trail','comet')),'Comet trail unlocked');
  const lost={ok:false,score:10,ticks:60,livesLost:3,shots:0,hits:0,acc:0,comboMax:0,stats:{chainMax:0,comboMax:0,closeCall:0,kills:0,gold:0,shots:0,hits:0}}; eq(L.campaignResult(L.defSave(),L.LEVEL_BY.e1,lost).xp,0,'losses earn no XP');
  const code=L.backupPlain(S); ok(code.startsWith('DRIFT1.'),'backup code'); eq(L.parseBackup(code).xp,S.xp,'backup round trip'); eq(L.parseBackup('LINEFALL1.abc'),null,'other games\' codes are refused');
  eq(L.ACH.length,22,'22 achievements'); }

sec('Arcade contract');
{ const store={m:{},get(k){ return this.m[k]??null; },set(k,v){ this.m[k]=v; }}; store.set('arcade.v1',JSON.stringify({set:{appearance:'dark',sfx:false,music:false,haptics:false,motion:false,cb:true,lefty:true,lang:'de',fullscreen:false},name:'Al'}));
  const S=L.defSave(); const P=L.applyShared(S,L.readArcade(store)); ok(P.appearance==='dark'&&P.sfx===false&&P.cb===true&&P.lang==='de'&&P.name==='Al','shared settings come from arcade.v1'); ok(S.appearance==='system'&&S.sfx===true,'drift.v1 keeps the standalone values');
  const sm=L.summary(S); for(const k of ['v','game','ver','level','maxLevel','xp','xpLevel','xpNext','ach','hi','last']) ok(k in sm,`summary has ${k}`); eq(sm.game,'drift','summary game id'); eq(sm.hi.map(x=>x[0]),['Best Endless wave','Campaign stars','Best score (Hard)'],'summary highlights'); eq(sm.ach.length,22,'summary achievements');
  eq([L.KEY,L.SUMKEY],['drift.v1','arcade.summary.drift'],'storage keys'); }

const R=res(); console.log(`\n${R.pass} passed, ${R.fail} failed (${((Date.now()-t0)/1000).toFixed(1)} s)`); process.exit(R.fail?1:0);
