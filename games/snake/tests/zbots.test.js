// Greedy shortest-path bot. QUICK=1 plays 20 runs per arena per speed; the full run plays 200.
const E=require('../src/engine.js'), {botPlay}=require('./bot.js');
const N=QUICK?20:200, rows=[];
test('greedy bot sims run cleanly on every arena',()=>{
  for(const a of E.ARENAS) for(const size of (a==='open'?['s','m','l']:['m'])){ const fills=[], stars=[0,0,0,0];
    for(let k=0;k<N;k++){ const g=botPlay({arena:a,size,seed:'bot'+k,speed:'normal'}); const len=E.lengthOf(g); fills.push(len/g.cells); stars[E.starsFor(len,g.cells,g.perfect)]++; }
    fills.sort((x,y)=>x-y); rows.push([a+'-'+size,(fills[N>>1]*100).toFixed(0)+'%',...stars.map(s=>(s/N*100).toFixed(0)+'%')]); }
  if(process.env.SHOW_BOTS){ console.log('arena        median fill   0★   1★   2★   3★'); for(const r of rows) console.log(r[0].padEnd(14)+r[1].padStart(8)+r.slice(2).map(x=>x.padStart(5)).join('')); }
});
