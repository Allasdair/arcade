const E=require('../src/engine.js'), {botPlay}=require('./bot.js');
const PIN={'2026-11-23':'243b6aa9','2027-01-01':'fd759326'};
const dates=Array.from({length:120},(_,i)=>{ const d=new Date(Date.UTC(2026,10,1)+i*864e5); return d.toISOString().slice(0,10); });
test('same date gives the same arena, settings and food sequence (120 days)',()=>{ for(const d of dates){
  const a=E.dailyConfig(d), b=E.dailyConfig(d); eq(a,b,d); eq(E.dailyPrint(d),E.dailyPrint(d),d);
  const g1=botPlay(a,800), g2=botPlay(E.dailyConfig(d),800); eq(E.snapshot(g1),E.snapshot(g2),d); } });
test('daily settings vary across days',()=>{ const seen=new Set(dates.map(d=>{ const c=E.dailyConfig(d); return c.arena+c.size; })); ok(seen.size>=7,'only '+seen.size+' arenas'); });
test('daily seed format',()=>{ eq(E.dailyConfig('2026-11-23').seed,'SNDR1|2026-11-23'); });
test('two dates pinned by fingerprint',()=>{ eq(E.dailyPrint('2026-11-23'),PIN['2026-11-23']); eq(E.dailyPrint('2027-01-01'),PIN['2027-01-01']); });
if(process.env.PRINT_PINS) console.log(E.dailyPrint('2026-11-23'),E.dailyPrint('2027-01-01'),E.dailyConfig('2026-11-23'),E.dailyConfig('2027-01-01'));
