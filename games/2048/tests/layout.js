// Browser checks (needs Playwright + Chrome):  node tests/layout.js
// No sideways scroll at 360/390 px in English and German · 5- and 6-digit tiles fit on 6×6 · touch swipes ·
// a quick double swipe registers both moves · standalone has no CSP errors · Arcade build follows the contract.
const path=require('path'), fs=require('fs');
let pw; for(const p of ['playwright','/opt/npm-tools/node_modules/playwright']){ try{ pw=require(p); break; }catch(e){} }
if(!pw){ console.log('Playwright not found: skipping layout tests'); process.exit(0); }
const exe=['/usr/bin/google-chrome','/usr/bin/chromium'].find(f=>fs.existsSync(f));
const dist=path.join(__dirname,'..','dist'), url=f=>'file://'+path.join(dist,f);
let fails=0, passes=0; const ok=(c,m)=>{ if(c) passes++; else { fails++; console.log('  ✗ '+m); } };

(async()=>{ const B=await pw.chromium.launch(exe?{executablePath:exe}:{});
  async function page(file,{w=390,h=844,lang='en',touch=false,init}={}){
    const ctx=await B.newContext({viewport:{width:w,height:h},hasTouch:touch,isMobile:touch,deviceScaleFactor:2});
    await ctx.addInitScript(([lang,init])=>{ try{ const s=JSON.parse(localStorage.getItem('t2048.v1')||'{}'); s.lang=lang; s.seenVer='0.1.0'; localStorage.setItem('t2048.v1',JSON.stringify(s)); if(init) eval(init); }catch(e){} },[lang,init||'']);
    const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error'&&!/fonts\.css/.test(m.text())) p.errs.push(m.text()); });
    await p.goto(url(file)); await p.waitForTimeout(350); return p; }
  const noSideScroll=async(p,where)=>{ const r=await p.evaluate(()=>{ const bad=[]; for(const el of document.querySelectorAll('.screen.on, .screen.on *, #ov2 .sheet, #ov2 .sheet *')){ const b=el.getBoundingClientRect(); if(b.width&&b.right>innerWidth+1&&getComputedStyle(el).position!=='fixed') bad.push((el.id||el.className||el.nodeName)+' '+Math.round(b.right)); }
      const sc=document.querySelector('.screen.on .scroll'); return {bad:bad.slice(0,4),sw:sc?sc.scrollWidth-sc.clientWidth:0,doc:document.documentElement.scrollWidth-innerWidth}; });
    ok(!r.bad.length&&r.sw<=0&&r.doc<=0,`${where}: sideways overflow ${JSON.stringify(r)}`); };

  console.log('layout: no sideways scroll at 360 and 390 px, English and German');
  for(const lang of ['en','de']) for(const w of [360,390]){ const p=await page('demo.html',{w,lang,init:"const s=JSON.parse(localStorage.getItem('t2048.v1')); s.xp=900; s.ach={a2048:1,first:1,small:1}; s.bestTile={'4':2048,'6':16384,ring:1024}; s.best={'4':23000,'6':260000,ring:9000}; s.stars={'4':3,'6':3}; localStorage.setItem('t2048.v1',JSON.stringify(s));"});
    const at=`${lang} ${w}px`;
    await noSideScroll(p,`${at} home`); await p.evaluate(()=>openNew()); await p.waitForTimeout(150); await noSideScroll(p,`${at} new game sheet`);
    await p.evaluate(()=>{ hideOv2(); startGame('6'); }); await p.waitForTimeout(200); await noSideScroll(p,`${at} game 6×6`);
    for(const [s,t] of [['style','pal'],['style','bt'],['awards','levels'],['awards','ach'],['awards','stats'],['set','']]){
      await p.evaluate(([s,t])=>{ if(s==='style') styleTab=t; if(s==='awards') progTab=t; show(s); },[s,t]); await p.waitForTimeout(120); await noSideScroll(p,`${at} ${s} ${t}`); }
    await p.evaluate(()=>openHow()); await p.waitForTimeout(100); await noSideScroll(p,`${at} how to play`);
    await p.evaluate(()=>{ hideOv2(); show('game'); G.max=2048; finalize(); }); await p.waitForTimeout(300);
    const sh=await p.evaluate(()=>{ const s=document.querySelector('#sheet').getBoundingClientRect(); return s.right<=innerWidth&&s.left>=0; }); ok(sh,`${at} results sheet fits`);
    ok(!p.errs.length,`${at} no page errors: ${p.errs}`); await p.context().close(); }

  console.log('layout: 5- and 6-digit tiles fit their cell on 6×6 at 360 px');
  for(const font of ['inter','mono','caveat']){ const p=await page('demo.html',{w:360,h:740,init:`const s=JSON.parse(localStorage.getItem('t2048.v1')); s.font='${font}'; s.xp=4000; s.ach={corner:1}; localStorage.setItem('t2048.v1',JSON.stringify(s));`});
    const r=await p.evaluate(()=>{ startGame('6'); G.b=G.b.map((_,i)=>[16384,131072,65536,99999][i%4]*(i<8?1:0)); G.ids=G.b.map((v,i)=>v?i+1:0); layoutBoard();
      return [...document.querySelectorAll('.tile')].map(t=>{ const i=t.firstChild; return {v:+i.textContent,iw:i.getBoundingClientRect().width,tw:t.getBoundingClientRect().width,fs:parseFloat(getComputedStyle(t).fontSize)}; }); });
    for(const t of r) ok(t.iw<=t.tw*.92&&t.fs>=9,`${font}: ${t.v} text ${t.iw.toFixed(1)}px in ${t.tw.toFixed(1)}px tile (font ${t.fs}px)`);
    await p.context().close(); }

  console.log('input: touch swipes, and a quick double swipe registers both moves');
  { const p=await page('demo.html',{w:390,touch:true}); const cdp=await p.context().newCDPSession(p);
    await p.evaluate(()=>{ startGame('4'); });
    await p.waitForTimeout(200);
    const box=await p.evaluate(()=>{ const r=document.querySelector('#board').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
    const swipe=async(dx,dy,steps=4)=>{ await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x,y:box.y}]});
      for(let k=1;k<=steps;k++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+dx*k/steps,y:box.y+dy*k/steps}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); };
    const set=async vals=>p.evaluate(v=>{ G.b=v.slice(); let id=1; G.ids=G.b.map(x=>x?id++:0); G.nid=id; G.moves=0; G.over=false; G.prev=null; layoutBoard(); hud(); },vals);
    await set([0,0,0,2, 0,0,0,0, 0,0,0,0, 0,0,0,0]); await swipe(-60,0); await p.waitForTimeout(250);
    ok(await p.evaluate(()=>G.moves===1&&G.b[0]===2),'swipe left moved the tile');
    await set([2,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]); await swipe(0,60); await p.waitForTimeout(250);
    ok(await p.evaluate(()=>G.moves===1&&G.b[12]===2),'swipe down moved the tile');
    await set([2,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]); await swipe(30,28); await p.waitForTimeout(200);
    ok(await p.evaluate(()=>G.moves===0),'a diagonal swipe is ignored');
    await set([2,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]); await swipe(14,0); await p.waitForTimeout(200);
    ok(await p.evaluate(()=>G.moves===0),'a short drag (under 24 px) is ignored');
    await set([0,0,0,2, 0,0,0,0, 0,0,0,0, 0,0,0,0]); await swipe(-50,0,2); await swipe(0,50,2); await p.waitForTimeout(300);
    const r=await p.evaluate(()=>({m:G.moves,tiles:document.querySelectorAll('.tile').length,n:G.b.filter(x=>x).length}));
    ok(r.m===2,`quick double swipe → 2 moves (got ${r.m})`); ok(r.tiles===r.n,`tiles on screen match the board (${r.tiles}/${r.n})`);
    // 12 key presses with no waiting: every move lands and the DOM ends in sync
    await p.evaluate(()=>{ startGame('4'); }); await p.waitForTimeout(150);
    for(let i=0;i<12;i++) await p.keyboard.press(['ArrowLeft','ArrowDown','ArrowRight','ArrowDown'][i%4]);
    await p.waitForTimeout(400); const k=await p.evaluate(()=>({tiles:document.querySelectorAll('.tile').length,n:G.b.filter(x=>x).length,pos:[...document.querySelectorAll('.tile')].length}));
    ok(k.tiles===k.n,`fast keys: DOM tiles match the board (${k.tiles}/${k.n})`);
    ok(!p.errs.length,`touch page errors: ${p.errs}`); await p.context().close(); }

  console.log('saving: a game in progress survives a reload');
  { const p=await page('demo.html'); await p.evaluate(()=>startGame('ring')); for(let i=0;i<20;i++) await p.keyboard.press(['ArrowLeft','ArrowUp'][i%2]);
    await p.waitForTimeout(300); const before=await p.evaluate(()=>JSON.stringify({b:G.b,s:G.score,m:G.moves,rs:G.rs}));
    await p.reload(); await p.waitForTimeout(300); await p.evaluate(()=>resumeGame()); await p.waitForTimeout(200);
    const after=await p.evaluate(()=>JSON.stringify({b:G.b,s:G.score,m:G.moves,rs:G.rs})); ok(before===after,'identical after reload');
    await p.context().close(); }

  console.log('standalone: strict CSP, no errors, no outside requests');
  { const ctx=await B.newContext(); const p=await ctx.newPage(); const errs=[], ext=[];
    p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); }); p.on('pageerror',e=>errs.push(e.message)); p.on('request',r=>{ if(!/^(file|data|blob):/.test(r.url())) ext.push(r.url()); });
    await p.goto(url('standalone.html')); await p.waitForTimeout(300); await p.evaluate(()=>startGame('4')); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(200);
    ok(!errs.length,`no console errors: ${errs}`); ok(!ext.length,`no outside requests: ${ext}`);
    ok(await p.evaluate(()=>!!document.querySelector('meta[http-equiv="Content-Security-Policy"]')),'CSP meta present');
    ok(await p.evaluate(()=>document.fonts.check('700 20px Inter')),'Inter font is bundled'); await ctx.close(); }

  console.log('Arcade build: contract');
  { const ctx=await B.newContext({viewport:{width:390,height:844}}); await ctx.addInitScript(()=>{ if(!sessionStorage.getItem('seeded')){ sessionStorage.setItem('seeded','1');
      localStorage.setItem('arcade.v1',JSON.stringify({set:{appearance:'dark',motion:false,sfx:false,music:false,haptics:false,cb:true,lefty:true,lang:'de'},name:'Ali'})); } });
    const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url('t2048/index.html')); await p.waitForTimeout(400);
    const a=await p.evaluate(()=>({ARCADE,bar:getComputedStyle(document.querySelector('.arcbar')).display,dark:isDark(),lang:LANG,cb:document.body.classList.contains('cb'),lefty:document.body.classList.contains('lefty'),
      own:S.appearance,ownLang:S.lang,home:ARCADE_HOME,prefs:ARCADE_PREFS,font:!!document.querySelector('link[href="../fonts.css"]')}));
    ok(a.ARCADE&&a.bar!=='none','Arcade mode on and ‹ Arcade shown'); ok(a.dark&&a.lang==='de'&&a.cb&&a.lefty,'shared settings applied from arcade.v1');
    ok(a.own==='system'&&a.ownLang==='auto','standalone values kept in t2048.v1'); ok(a.home==='../index.html'&&a.prefs==='../index.html#prefs','navigation targets'); ok(a.font,'links ../fonts.css');
    const arc0=await p.evaluate(()=>localStorage.getItem('arcade.v1'));
    await p.evaluate(()=>startGame('4')); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(500);
    const sm=await p.evaluate(()=>JSON.parse(localStorage.getItem('arcade.summary.t2048')||'null'));
    ok(sm&&sm.game==='t2048'&&sm.v===1&&sm.maxLevel===10&&Array.isArray(sm.ach)&&sm.hi.length===3&&'xpNext' in sm&&'xpLevel' in sm&&sm.last,'summary written with every field');
    const keys=await p.evaluate(()=>Object.keys(localStorage)); ok(keys.every(k=>k.startsWith('t2048.')||k==='arcade.summary.t2048'||k==='arcade.v1'),`only t2048.* and the summary are written: ${keys}`);
    ok(await p.evaluate(()=>localStorage.getItem('arcade.v1'))===arc0,'arcade.v1 never written');
    await p.evaluate(()=>show('set')); const st=await p.evaluate(()=>({rows:document.querySelector('#setBody').textContent,arc:!!document.querySelector('#arcSet')}));
    ok(st.arc,'settings: Arcade settings row');
    ok(await p.evaluate(()=>!document.querySelector('[data-sw="sfx"]')&&!document.querySelector('[data-seg="appearance"]')),'shared toggles hidden in Arcade');
    // back/forward cache return re-reads arcade.v1
    await p.evaluate(()=>{ localStorage.setItem('arcade.v1',JSON.stringify({set:{appearance:'light',lang:'de'}})); dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})); });
    ok(await p.evaluate(()=>!isDark()),'pageshow re-reads Arcade settings');
    ok(!errs.length,`arcade page errors: ${errs}`); await ctx.close(); }

  await B.close(); console.log(`\n${passes} layout checks passed, ${fails} failed`); process.exit(fails?1:0);
})();
