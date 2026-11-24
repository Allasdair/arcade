// Browser checks (needs Playwright + Chrome): no sideways scroll at 360 and 390 px in English and German, on every screen and sheet;
// plus the Arcade build reads arcade.v1 and writes the summary record.  Usage: node tests/layout.js   (run `python3 build.py` first)
const {chromium}=require('playwright'), path=require('path');
const FILE='file://'+path.join(__dirname,'..','dist','standalone.html'), ARC='file://'+path.join(__dirname,'..','dist','shipfight','index.html');
let fails=0, passes=0; const ok=(c,m)=>{ if(c) passes++; else { fails++; console.log('  ✗ '+m); } };
const STEPS=[['home',"show('home')"],['place',"openPlace('hard')"],['place empty',"P.ships=[];prender()"],['battle',"startMatch('hard',randomFleet(),CLASSIC_RULES);tapCell(0);aiShoot()"],
 ['pause',"pauseGame()"],['results',"resumeGame();(()=>{ const m=G.m; for(const i of m.foe.ships.flatMap(s=>cellsOf(s,m.R.W))){ if(m.turn==='ai') aiShoot(); tapCell(i);} })();endMatch()"],
 ['share',"openShare(shareLine({level:'hard',won:true,shots:41,stars:2}))"],['hunt',"hideOv2();startHunt();tapCell(3)"],['style',"show('style')"],['style hits',"styleTab='hits';renderStyle()"],
 ['settings',"show('set')"],['progress',"show('awards')"],['achievements',"progTab='ach';renderAwards()"],['stats',"progTab='stats';renderAwards()"],
 ['how to play',"openHowTo()"],['backup',"openBackup()"],['language',"openLang()"],['abandon',"hideOv2();startMatch('easy',randomFleet(),CLASSIC_RULES);show('home');pickLevel('hard')"],
 ['battle menu',"hideOv2();S.mods={sea:'isles',fleet:'armada',touch:false};openBattle()"],['campaign',"hideOv2();show('camp')"],['campaign locked tab',"campTab='hard';renderCamp()"],
 ['level intro',"campTab='easy';renderCamp();openLevel('easy',0)"],
 ['ocean armada',"hideOv2();openPlace('hard',{sea:'ocean',fleet:'armada',touch:false})"],['ocean battle',"document.querySelector('#pStart').click();tapCell(0);aiShoot()"],
 ['narrows battle',"openPlace('normal',{sea:'narrows'});document.querySelector('#pStart').click();tapCell(0);aiShoot()"],
 ['campaign results',"openPlace('easy',{sea:'strait',fleet:'light'},{c:'easy',i:0});document.querySelector('#pStart').click();(()=>{ const m=G.m; for(const i of m.foe.ships.flatMap(s=>cellsOf(s,m.R.W))){ if(m.turn==='ai') aiShoot(); tapCell(i);} })();endMatch()"]];
(async()=>{ const t0=Date.now(); const b=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});
  for(const lang of ['en','de']) for(const W of [360,390]){
    const ctx=await b.newContext({viewport:{width:W,height:740},hasTouch:true}); const errs=[];
    await ctx.addInitScript(l=>{ try{ if(!localStorage.getItem('shipfight.v1')) localStorage.setItem('shipfight.v1',JSON.stringify({lang:l,seenVer:'0.1.0',xp:120,wins:3,bk:{last:0,nudged:0}})); }catch(e){} },lang);
    const pg=await ctx.newPage(); pg.on('pageerror',e=>errs.push(String(e))); await pg.goto(FILE); await pg.waitForTimeout(300);
    for(const [name,js] of STEPS){ await pg.evaluate(js); await pg.waitForTimeout(120);
      const r=await pg.evaluate(()=>{ const W=innerWidth, bad=[]; const vis=el=>{ const s=getComputedStyle(el); return s.display!=='none'&&s.visibility!=='hidden'&&el.offsetParent!==null; };
        if(document.documentElement.scrollWidth>W) bad.push('page '+document.documentElement.scrollWidth);
        document.querySelectorAll('.screen.on .scroll, .sheet').forEach(el=>{ if(vis(el)&&el.scrollWidth>el.clientWidth+1) bad.push((el.id||el.className)+' '+el.scrollWidth+'>'+el.clientWidth); });
        document.querySelectorAll('.screen.on *, #ov2:not(.hidden) *').forEach(el=>{ if(!vis(el)||el.closest('#toast')) return; const r=el.getBoundingClientRect(); if(r.width&&(r.right>W+1||r.left<-1)) bad.push(el.tagName+'.'+el.className+' '+Math.round(r.left)+'..'+Math.round(r.right)); });
        return bad.slice(0,4); });
      ok(!r.length,`${lang} ${W}px ${name}: ${r.join(', ')}`); }
    ok(!errs.length,`${lang} ${W}px page errors: ${errs.join('; ')}`); await ctx.close(); }
  // Placement by real pointer: drag a ship from the dock onto the sea, tap it to turn it, drag it back off
  for(const [W,H] of [[390,800],[1280,760]]){ const ctx=await b.newContext({viewport:{width:W,height:H}}); const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
    await pg.goto(FILE); await pg.evaluate(()=>{ openPlace('easy'); P.ships=[]; prender(); }); await pg.waitForTimeout(150);
    const D=await pg.evaluate(()=>{ const r=pcv.getBoundingClientRect(); return {l:r.left,t:r.top,d:DOCK.carrier,b:PB}; });
    const sx=D.l+D.d.x+D.d.s*.5, sy=D.t+D.d.y+D.d.s*.5, tx=D.l+D.b.x+4.5*D.b.s, ty=D.t+D.b.y+4.5*D.b.s;
    await pg.mouse.move(sx,sy); await pg.mouse.down(); for(let k=1;k<=10;k++){ await pg.mouse.move(sx+(tx-sx)*k/10,sy+(ty-sy)*k/10); } await pg.mouse.up();
    let f=await pg.evaluate(()=>JSON.stringify(P.ships)); ok(f==='[{"id":"carrier","x":4,"y":4,"v":0}]',`${W}px drag from dock: ${f}`);
    await pg.mouse.click(tx,ty); f=await pg.evaluate(()=>JSON.stringify(P.ships)); ok(f==='[{"id":"carrier","x":4,"y":4,"v":1}]',`${W}px tap to turn: ${f}`);
    await pg.mouse.move(tx,ty); await pg.mouse.down(); for(let k=1;k<=10;k++) await pg.mouse.move(tx+(sx-tx)*k/10,ty+(sy-ty)*k/10); await pg.mouse.up();
    ok(await pg.evaluate(()=>P.ships.length===0),`${W}px drag back to the dock`);
    ok(await pg.evaluate(()=>document.querySelector('#pStart').disabled),'Start allowed with an incomplete fleet');
    await pg.click('#pRand'); ok(await pg.evaluate(()=>!document.querySelector('#pStart').disabled&&checkFleet(P.ships).ok),'Random fleet not accepted');
    ok(!errs.length,`${W}px placement errors: ${errs.join('; ')}`); await ctx.close(); }
  // Arcade build: shared settings from arcade.v1, summary written, arcade.v1 never written
  { const ctx=await b.newContext({viewport:{width:390,height:800}}); const A=JSON.stringify({set:{appearance:'dark',motion:false,sfx:false,music:false,haptics:false,fullscreen:false,cb:true,lefty:false,lang:'fr'},name:'Alasdair'});
    await ctx.addInitScript(a=>{ if(!sessionStorage.getItem('seeded')){ localStorage.clear(); localStorage.setItem('arcade.v1',a); sessionStorage.setItem('seeded','1'); } },A);
    const pg=await ctx.newPage(); await pg.goto(ARC); await pg.waitForTimeout(500);
    const r=await pg.evaluate(()=>({arc:ARCADE,sfx:S.sfx,cb:S.cb,lang:LANG,name:S.name,btn:!document.querySelector('#toArcade').classList.contains('hidden'),bg:getComputedStyle(document.body).backgroundColor}));
    ok(r.arc&&r.sfx===false&&r.cb===true&&r.lang==='fr'&&r.name==='Alasdair','Arcade build did not take shared settings: '+JSON.stringify(r)); ok(r.btn,'‹ Arcade button hidden in Arcade mode');
    await pg.evaluate(()=>{ startMatch('easy',randomFleet()); tapCell(0); }); await pg.waitForTimeout(450);
    const s=await pg.evaluate(()=>({sum:JSON.parse(localStorage.getItem('arcade.summary.shipfight')||'null'),arc:localStorage.getItem('arcade.v1'),own:JSON.parse(localStorage.getItem('shipfight.v1')),keys:Object.keys(localStorage)}));
    ok(s.sum&&s.sum.game==='shipfight'&&s.sum.v===1&&Array.isArray(s.sum.ach)&&s.sum.hi.length===3,'summary record missing or incomplete');
    ok(s.arc===A,'arcade.v1 was modified'); ok(s.own.sfx===true&&s.own.lang==='auto','standalone copies of shared settings were overwritten');
    ok(s.keys.every(k=>k.startsWith('shipfight.')||k==='arcade.v1'||k==='arcade.summary.shipfight'),'unexpected storage key: '+s.keys.join());
    const sb=await pg.evaluate(()=>{ show('set'); return [...document.querySelectorAll('#settings .srow')].map(e=>e.textContent.trim()); });
    ok(!sb.some(t=>/Apparence|Musique|Langue/.test(t))&&sb.some(t=>/Arcade/.test(t)),'Arcade settings should show game options only: '+sb.join(' | '));
    const st=await pg.evaluate(()=>{ show('home'); return document.querySelector('#toArcade').offsetParent!==null; }); ok(st,'‹ Arcade button not visible');
    await ctx.close(); }
  { const ctx=await b.newContext({viewport:{width:390,height:800}}); const pg=await ctx.newPage(); await pg.goto(FILE); await pg.waitForTimeout(200);
    ok(await pg.evaluate(()=>document.querySelector('#toArcade').classList.contains('hidden')),'‹ Arcade button shown when standalone'); await ctx.close(); }
  await b.close(); console.log(`layout.js: ${passes} checks passed, ${fails} failed (${((Date.now()-t0)/1000).toFixed(1)} s)`); process.exit(fails?1:0); })();
