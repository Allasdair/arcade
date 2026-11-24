const E=require('../src/engine.js');
const xy=(st,i)=>[i%st.W,(i/st.W)|0], at=(st,x,y)=>y*st.W+x;
function place(st,cells,dir,food){ // cells head-first as [x,y]
  st.body=cells.map(([x,y])=>at(st,x,y)); st.dir=dir; st.queue=[]; st.grow=0; st.bonus=null; st.started=true; st.over=false;
  st.occ=new Uint16Array(st.W*st.H); for(const c of st.body) st.occ[c]++; st.food=food!=null?food:at(st,st.W-1,st.H-1); return st; }

test('starts still until the first input',()=>{ const g=E.newGame({seed:'a'}); const b=g.body.slice(); eq(E.step(g),[]); eq(g.body,b); });
test('no reverse onto the neck',()=>{ const g=E.newGame({seed:'a'}); E.enqueue(g,1); eq(E.enqueue(g,3),false); const h=g.body[0]; E.step(g); eq(g.body[0],h+1); });
test('reverse as the very first input still starts forwards',()=>{ const g=E.newGame({seed:'a'}); E.enqueue(g,3); ok(g.started); const h=g.body[0]; E.step(g); eq(g.body[0],h+1); });
test('two turns are buffered and play on consecutive ticks',()=>{ const g=E.newGame({seed:'a'}); E.enqueue(g,1);
  ok(E.enqueue(g,0)); ok(E.enqueue(g,3)); eq(E.enqueue(g,2),false,'third turn'); E.step(g); eq(g.dir,0); E.step(g); eq(g.dir,3); });
test('buffered turn cannot reverse the previous buffered turn',()=>{ const g=E.newGame({seed:'a'}); E.enqueue(g,1); ok(E.enqueue(g,0)); eq(E.enqueue(g,2),false); });
test('relative turning',()=>{ const g=E.newGame({seed:'a'}); E.turnRel(g,-1); eq(g.queue,[0]); E.turnRel(g,-1); eq(g.queue,[0,3]); });
test('solid wall kills',()=>{ const g=E.newGame({seed:'a',size:'s'}); const x0=g.body[0]%g.W; E.enqueue(g,1); let n=0; while(!g.over&&n<100){ E.step(g); n++; } eq(g.cause,'wall'); eq(n,g.W-x0); });
test('self collision kills',()=>{ const g=place(E.newGame({seed:'a'}),[[5,5],[6,5],[6,6],[5,6],[4,6]],2); const ev=E.step(g); ok(g.over); eq(g.cause,'self'); eq(ev[0].t,'die'); });
test('tail cell is legal when not growing',()=>{ const g=place(E.newGame({seed:'a'}),[[5,5],[6,5],[6,6],[5,6]],2); E.step(g); ok(!g.over,'should survive'); eq(g.body[0],at(g,5,6)); eq(g.body.length,4); });
test('tail cell kills while growing',()=>{ const g=place(E.newGame({seed:'a'}),[[5,5],[6,5],[6,6],[5,6]],2); g.grow=1; E.step(g); ok(g.over); eq(g.cause,'self'); });
test('eating grows by one (tail stays that tick)',()=>{ const g=place(E.newGame({seed:'a'}),[[5,5],[4,5],[3,5]],1,null); g.food=at(g,6,5); const tail=g.body[2];
  const ev=E.step(g); ok(ev.some(e=>e.t==='eat')); eq(g.body.length,4); eq(g.body[3],tail); eq(g.foods,1); ok(g.food>=0&&!g.occ[g.food]); });
test('bonus grows 5 over 5 ticks',()=>{ const g=place(E.newGame({seed:'a'}),[[2,5],[1,5],[0,5]],1); g.bonus={i:at(g,3,5),ttl:40,max:40};
  const lens=[]; for(let k=0;k<7;k++){ E.step(g); lens.push(g.body.length); } eq(lens,[4,5,6,7,8,8,8]); eq(g.bonusEaten,1); eq(E.scoreOf(g),5); });
test('bonus fades after its ticks',()=>{ const g=place(E.newGame({seed:'a'}),[[2,5],[1,5],[0,5]],1); g.bonus={i:at(g,2,12),ttl:3,max:3};
  E.step(g); E.step(g); ok(g.bonus); const ev=E.step(g); ok(!g.bonus); ok(ev.some(e=>e.t==='bonus_gone')); });
test('bonus appears after 8-12 foods',()=>{ for(const seed of ['a','b','c','d','e']){ const g=E.newGame({seed}); ok(g.nextBonus>=8&&g.nextBonus<=12); } });
test('filling the arena ends as a perfect game',()=>{ const g=E.newGame({seed:'a',size:'s'}), W=g.W, path=[];
  for(let y=0;y<g.H;y++) for(let x=0;x<W;x++) path.push(y%2?[W-1-x,y]:[x,y]);
  place(g,path.slice(0,-1).reverse(),1,0); const last=path[path.length-1], prev=path[path.length-2]; g.dir=last[0]>prev[0]?1:last[0]<prev[0]?3:2; g.food=at(g,...last);
  const ev=E.step(g); ok(g.over&&g.perfect,'perfect'); ok(ev.some(e=>e.t==='perfect')); eq(g.body.length,g.cells); eq(E.starsFor(g.body.length,g.cells,true),3); });
test('wrap on open arenas',()=>{ for(const size of ['s','m','l']){ const g=E.newGame({seed:'a',size,walls:'wrap'}); place(g,[[g.W-1,3],[g.W-2,3],[g.W-3,3]],1);
  const ev=E.step(g); ok(!g.over); eq(g.body[0],at(g,0,3)); eq(g.wraps,1); ok(ev.some(e=>e.t==='wrap'));
  place(g,[[4,0],[4,1],[4,2]],0); E.step(g); eq(g.body[0],at(g,4,g.H-1)); } });
test('wrap on shaped arenas only into playable cells',()=>{ for(const a of E.SHAPED) for(const size of ['s','m','l']){ const g=E.newGame({seed:'w',arena:a,size,walls:'wrap'});
  for(let i=0;i<g.mask.length;i++){ if(!g.mask[i]) continue; const [x,y]=xy(g,i);
    for(const d of [0,1,2,3]){ const nx=x+E.DIRS[d][0], ny=y+E.DIRS[d][1]; if(nx>=0&&ny>=0&&nx<g.W&&ny<g.H) continue;
      g.body=[i]; const r=E.nextCell(g,d), oi=((ny+g.H)%g.H)*g.W+((nx+g.W)%g.W);
      if(g.mask[oi]) eq(r.i,oi,a+size); else eq(r.i,-1,a+size+' should be wall'); } } } });

const sizes=['s','m','l'];
test('every arena at every size is one 4-way region',()=>{ for(const a of E.ARENAS) for(const s of sizes) for(const seed of ['x','y','z']){ const A=E.makeArena(a,s,seed);
  const first=A.mask.indexOf(1), seen=new Uint8Array(A.mask.length), st=[first]; seen[first]=1; let n=0;
  while(st.length){ const c=st.pop(); n++; const x=c%A.W, y=(c/A.W)|0; for(const [dx,dy] of E.DIRS){ const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=A.W||ny>=A.H) continue; const j=ny*A.W+nx; if(A.mask[j]&&!seen[j]){ seen[j]=1; st.push(j); } } }
  eq(n,A.cells,a+s+seed); ok(A.cells>=100,a+s+' has '+A.cells+' cells'); } });
test('start position is valid with 4 clear cells ahead',()=>{ for(const a of E.ARENAS) for(const s of sizes) for(const seed of ['x','y','z']){ const g=E.newGame({arena:a,size:s,seed});
  eq(g.body.length,3); for(const c of g.body) ok(g.mask[c]); for(let k=1;k<3;k++){ const [x0,y0]=xy(g,g.body[k-1]), [x1,y1]=xy(g,g.body[k]); eq(Math.abs(x0-x1)+Math.abs(y0-y1),1); }
  const [dx,dy]=E.DIRS[g.dir]; let [x,y]=xy(g,g.body[0]); eq([x,y],[xy(g,g.body[1])[0]+dx,xy(g,g.body[1])[1]+dy],'faces along the body');
  for(let k=0;k<4;k++){ x+=dx; y+=dy; ok(x>=0&&y>=0&&x<g.W&&y<g.H&&g.mask[y*g.W+x],a+s+' ahead '+k); } } });
test('food never spawns on the snake or outside the mask (10,000 per arena)',()=>{ for(const a of E.ARENAS){ const g=E.newGame({arena:a,size:'m',seed:'f'});
  for(let k=0;k<10000;k++){ E.spawnFood(g); ok(g.food>=0&&g.mask[g.food]&&!g.occ[g.food],a); } } });

test('a long frame never moves more than 2 ticks',()=>{ const g=E.newGame({seed:'a',size:'l'}); E.enqueue(g,1); const r=E.frame(g,0,5,false); ok(r.ticks<=2); eq(r.ticks,2); ok(r.acc<1/E.tps(g)); });
test('a normal frame ticks at the tick rate',()=>{ const g=E.newGame({seed:'a',size:'l',speed:'normal'}); E.enqueue(g,1); let acc=0, ticks=0; for(let k=0;k<60;k++){ const r=E.frame(g,acc,1/60,false); acc=r.acc; ticks+=r.ticks; } ok(ticks>=8&&ticks<=9,'ticks '+ticks); });
test('a hidden page does not advance the game',()=>{ const g=E.newGame({seed:'a'}); E.enqueue(g,1); const b=g.body.slice(); const r=E.frame(g,.5,1,true); eq(r.ticks,0); eq(g.body,b); });
test('speed up as you grow',()=>{ const g=E.newGame({seed:'a',speed:'normal',speedup:true}); eq(E.tps(g),9); g.foods=10; ok(Math.abs(E.tps(g)-10)<1e-9); g.foods=500; eq(E.tps(g),16); g.speedup=false; eq(E.tps(g),9); });

const {botMove}=require('./bot.js');

test('snapshot mid-run restores exactly',()=>{ const g=E.newGame({seed:'snap',arena:'ring',size:'m',walls:'wrap'}); E.enqueue(g,g.dir);
  for(let k=0;k<120&&!g.over;k++){ const d=botMove(g); if(d!==g.dir) E.enqueue(g,d); E.step(g); }
  g.bonus=g.bonus||{i:E.randomEmpty(g,g.food),ttl:17,max:40}; g.queue=[(g.dir+1)%4]; g.grow=2;
  const s=E.snapshot(g), h=E.restore(JSON.parse(JSON.stringify(s)));
  eq(E.snapshot(h),s); for(let k=0;k<300&&!g.over;k++){ const d=botMove(g); if(d!==g.dir){ E.enqueue(g,d); E.enqueue(h,d); } E.step(g); E.step(h); eq(E.snapshot(h),E.snapshot(g),'tick '+k); } });

