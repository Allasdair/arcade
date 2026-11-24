// node tests/layout.js   (Playwright + Chrome; run python3 build.py first)
const {chromium}=require('playwright'); const path=require('path'), fs=require('fs');
const DIST=path.join(__dirname,'..','dist'); let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  FAIL: '+m); } };
const url=f=>'file://'+path.join(DIST,f);
async function page(b,o){ const p=await b.newPage(Object.assign({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2},o&&o.vp?{viewport:o.vp,isMobile:o.vp.width<600}:{}));
  p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') p.errs.push(m.text()); });
  p.reqs=[]; p.on('request',r=>p.reqs.push(r.url()));
  await p.addInitScript(o=>{ window.__i18nMiss=new Set(); if(sessionStorage.getItem('__init')) return; sessionStorage.setItem('__init','1'); if(o.save) localStorage.setItem('linefall.v1',JSON.stringify(o.save)); if(o.arcade) localStorage.setItem('arcade.v1',JSON.stringify(o.arcade)); },{save:o&&o.save||null,arcade:o&&o.arcade||null});
  await p.goto(url((o&&o.file)||'standalone.html')+((o&&o.hash)||'')); await p.waitForTimeout(250); return p; }
const noSide=async(p,what)=>{ const w=await p.evaluate(()=>{ const els=[document.documentElement,...document.querySelectorAll('.screen.on .scroll,#sheet')]; return Math.max(...els.map(e=>e.scrollWidth-e.clientWidth)); }); ok(w<=1,`${what}: no sideways scroll (${w}px)`); };
async function screens(p,tag){ const vis=async(name,fn)=>{ await fn(); await p.waitForTimeout(120); await noSide(p,`${tag} ${name}`); };
  await vis('home',async()=>{}); await vis('classic sheet',()=>p.click('#hClassic')); await p.evaluate(()=>closeSheet());
  await vis('campaign',()=>p.click('#hCamp')); for(const ch of [2,3,1]) await vis('chapter '+ch,()=>p.click(`[data-ch="${ch}"]`));
  await vis('level sheet',()=>p.click('[data-lv="1"]')); await p.evaluate(()=>goHome());
  await vis('daily sheet',()=>p.click('#hDaily')); await p.evaluate(()=>closeSheet());
  for(const [n,fn] of [['records',()=>openRecords()],['progress',()=>openProgress('levels')],['achievements',()=>openProgress('ach')],['style',()=>openStyle()],['settings',()=>openSettings()],['how to play',()=>openHowto()],['what\'s new',()=>openNews()]]){ await vis(n,()=>p.evaluate(fn)); await p.evaluate(()=>closeSheet()); }
  await vis('backup',()=>p.evaluate(()=>openBackup())); await p.evaluate(()=>goHome());
  await vis('game',()=>p.evaluate(()=>startGame('classic',{}))); await p.waitForTimeout(2200);
  await vis('pause',()=>p.evaluate(()=>pauseGame()));
  await p.evaluate(()=>{ G.state='play'; closeSheet(); G.st.phase='play'; }); await p.evaluate(()=>{ for(let y=0;y<6;y++) for(let x=1;x<G.st.W;x++) G.st.b[y*G.st.W+x]=1; }); await p.waitForTimeout(3500);
  await noSide(p,`${tag} results`); ok(await p.evaluate(()=>sheetOn&&!!document.querySelector('#rHome')),`${tag}: game over shows results`); }

(async()=>{ const b=await chromium.launch(); const t0=Date.now();
  for(const w of [360,390]) for(const lang of ['en','de']){ const p=await page(b,{vp:{width:w,height:780},save:{lang,seenVer:'0.1.0',howto:true}}); await screens(p,`${w}px ${lang}`);
    ok(!p.errs.length,`${w}px ${lang}: no page errors ${p.errs.join(' | ')}`);
    if(lang==='de'&&w===390){ const miss=await p.evaluate(()=>[...window.__i18nMiss].filter(t=>!/^[\d\s.,:/×·—★☆+%-]+$/.test(t))); console.log(`  (German: ${miss.length} untranslated strings seen${miss.length?': '+miss.join(' | '):''})`); }
    await p.close(); }

  // the board and side panel fit the console screen on every board at 360 px
  for(const board of ['small','medium','large']){ const p=await page(b,{vp:{width:360,height:740},save:{setup:{board,speed:'1',set:'classic',hold:true,next:5,ghost:true,garbage:false,fading:false},seenVer:'0.1.0'}});
    await p.evaluate(()=>startGame('classic',{})); await p.waitForTimeout(300);
    const f=await p.evaluate(()=>({L:LY,r:document.getElementById('scr').getBoundingClientRect()}));
    ok(f.L.bx>=0&&f.L.px+f.L.pw<=f.r.width+1&&f.L.by+f.L.bh<=f.r.height+1&&f.L.cs>=10,`${board} at 360px: board (${f.L.cs}px cells) and panel fit the screen`); await p.close(); }

  // controls
  { const p=await page(b,{save:{seenVer:'0.1.0'}}); await p.evaluate(()=>startGame('classic',{})); await p.waitForTimeout(2300);
    const st=()=>p.evaluate(()=>({x:G.st.cur&&G.st.cur.x,r:G.st.cur&&G.st.cur.r,t:G.st.cur&&G.st.cur.t,state:G.state,pieces:G.st.stats.pieces,hold:G.st.hold}));
    const a=await st(); const box=await p.locator('#scr').boundingBox(); await p.touchscreen.tap(box.x+box.width/2,box.y+box.height/2); await p.waitForTimeout(150);
    const a2=await st(); ok(a2.state==='play'&&a2.r===a.r&&a2.pieces===a.pieces,'touches on the screen are ignored during play');
    const ptr=(sel,type,id)=>p.evaluate(([sel,type,id])=>{ const el=document.querySelector(sel), r=el.getBoundingClientRect(); el.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',isPrimary:id===1,clientX:r.x+r.width/2,clientY:r.y+r.height/2,bubbles:true,cancelable:true})); },[sel,type,id]);
    await p.evaluate(()=>{ G.st.cur.x=5; }); const b0=await st();
    await ptr('[data-b="left"]','pointerdown',1); await p.waitForTimeout(60); await ptr('[data-b="A"]','pointerdown',2); await p.waitForTimeout(60); await ptr('[data-b="A"]','pointerup',2);
    await p.waitForTimeout(400); const b1=await st(); await ptr('[data-b="left"]','pointerup',1);
    ok(b1.x<b0.x&&b1.r!==b0.r||b1.t==='O','multi-touch: holding ◀ while tapping A both register'); ok(b1.x<b0.x-1,'holding ◀ repeats (DAS)');
    await ptr('[data-b="up"]','pointerdown',3); await ptr('[data-b="up"]','pointerup',3); await p.waitForTimeout(250); ok((await st()).pieces>b1.pieces,'▲ hard drops (D-pad + A/B)');
    const hb=await st(); await ptr('[data-b="select"]','pointerdown',4); await ptr('[data-b="select"]','pointerup',4); await p.waitForTimeout(100); ok((await st()).hold!=null,'Select holds');
    await ptr('[data-b="start"]','pointerdown',5); await ptr('[data-b="start"]','pointerup',5); await p.waitForTimeout(100); ok((await st()).state==='pause','Start pauses');
    await p.evaluate(()=>resumeGame()); await p.waitForTimeout(2200);
    // keyboard
    let k0=await st(); await p.keyboard.press('ArrowRight'); await p.keyboard.press('x'); await p.waitForTimeout(80); let k1=await st(); ok(k1.x===k0.x+1||k1.t!==k0.t,'keyboard → moves'); ok(k1.r!==k0.r||k1.t==='O','keyboard X rotates');
    await p.keyboard.press('Space'); await p.waitForTimeout(250); ok((await st()).pieces>k1.pieces,'keyboard Space hard drops'); await p.keyboard.press('c'); await p.waitForTimeout(80);
    await p.keyboard.press('p'); await p.waitForTimeout(80); ok((await st()).state==='pause','keyboard P pauses'); await p.keyboard.press('Escape'); await p.waitForTimeout(80); ok((await st()).state==='count','Esc resumes with a countdown');
    await p.waitForTimeout(2200); await p.goBack(); await p.waitForTimeout(200); ok((await st()).state==='pause','Android back pauses a game first');
    ok(await p.evaluate(()=>!!S.run),'pausing saves the game in progress');
    await p.reload(); await p.waitForTimeout(300); ok(await p.evaluate(()=>!!document.querySelector('#hCont')),'a reload offers Continue');
    await p.click('#hCont'); await p.waitForTimeout(2300); ok(await p.evaluate(()=>G&&G.state==='play'&&G.st.stats.pieces>0),'Continue resumes the saved game after 3-2-1');
    // D-pad only
    await p.evaluate(()=>{ S.ctl.layout='donly'; applyLook(); }); const d0=await st(); await ptr('[data-b="up"]','pointerdown',6); await ptr('[data-b="up"]','pointerup',6); await p.waitForTimeout(80); const d1=await st();
    ok(d1.r!==d0.r||d1.t==='O','D-pad only: ▲ rotates'); for(const i of [7,8]){ await ptr('[data-b="down"]','pointerdown',i); await ptr('[data-b="down"]','pointerup',i); await p.waitForTimeout(60); } await p.waitForTimeout(200);
    ok((await st()).pieces>d1.pieces,'D-pad only: double-tap ▼ hard drops'); ok(await p.evaluate(()=>getComputedStyle(document.querySelector('.ab')).visibility==='hidden'),'D-pad only hides A/B');
    // swipe pad
    await p.evaluate(()=>{ S.ctl.layout='swipe'; applyLook(); }); ok(await p.evaluate(()=>getComputedStyle(document.querySelector('.dpad')).display==='none'),'Swipe pad hides the buttons');
    await p.evaluate(()=>{ G.st.cur.x=5; }); const s0=await st(); const hz=await p.locator('#swipehint').boundingBox(); const cx=hz.x+hz.width/2, cy=hz.y+hz.height/2;
    const sw=async(id,pts)=>{ for(let i=0;i<pts.length;i++){ const [x,y,t]=pts[i]; await p.evaluate(([type,id,x,y])=>document.querySelector('#swipehint').dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true})),[i===0?'pointerdown':i===pts.length-1?'pointerup':'pointermove',id,x,y]); if(t) await p.waitForTimeout(t); } };
    await sw(11,[[cx,cy,20],[cx-30,cy,20],[cx-60,cy,20],[cx-60,cy,0]]); await p.waitForTimeout(60); const s1=await st(); ok(s1.x===s0.x-2,`swipe: drag 60 px left moves 2 cells (${s0.x}→${s1.x})`);
    await sw(12,[[cx,cy,30],[cx,cy,0]]); await p.waitForTimeout(60); const s2=await st(); ok(s2.r!==s1.r||s2.t==='O','swipe: tap rotates');
    await sw(13,[[cx,cy,10],[cx,cy+40,10],[cx,cy+90,0]]); await p.waitForTimeout(250); ok((await st()).pieces>s2.pieces,'swipe: flick down hard drops');
    const h0=await st(); await sw(14,[[cx,cy,10],[cx,cy-50,10],[cx,cy-90,0]]); await p.waitForTimeout(80); ok(await p.evaluate(()=>G.st.held||G.st.stats.holds>0),'swipe: flick up holds');
    ok(!p.errs.length,'controls: no page errors '+p.errs.join(' | ')); await p.close(); }

  // left-handed swaps sides
  { const p=await page(b,{save:{lefty:true,seenVer:'0.1.0'}}); await p.evaluate(()=>startGame('classic',{})); await p.waitForTimeout(200);
    const [d,a]=await p.evaluate(()=>[document.querySelector('.dpad').getBoundingClientRect().x,document.querySelector('.ab').getBoundingClientRect().x]); ok(d>a,'left-handed: D-pad on the right, A/B on the left'); await p.close(); }

  // 60 fps on Large at 2×
  { const p=await page(b,{save:{setup:{board:'large',speed:'2',set:'chaos',hold:true,next:5,ghost:true,garbage:true,fading:false},seenVer:'0.1.0'}}); await p.evaluate(()=>startGame('classic',{})); await p.waitForTimeout(2200);
    const fps=await p.evaluate(()=>new Promise(res=>{ let n=0; const t0=performance.now(); const f=()=>{ n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else res(n/((performance.now()-t0)/1000)); }; requestAnimationFrame(f); }));
    const frameMs=await p.evaluate(()=>{ const t=performance.now(); for(let i=0;i<60;i++) draw(performance.now()); return (performance.now()-t)/60; });
    ok(fps>=55,`Large 2×: ${fps.toFixed(1)} fps`); ok(frameMs<8,`draw takes ${frameMs.toFixed(2)} ms per frame`); await p.close(); }

  // standalone: CSP, no outside requests
  { const p=await page(b,{save:{seenVer:'0.1.0'}}); ok(await p.evaluate(()=>!!document.querySelector('meta[http-equiv="Content-Security-Policy"]')),'standalone has a CSP');
    await p.evaluate(()=>startGame('classic',{})); await p.waitForTimeout(800); ok(p.reqs.every(u=>u.startsWith('file:')||u.startsWith('data:')||u.startsWith('blob:')),'no outside requests: '+p.reqs.filter(u=>!u.startsWith('file:')&&!u.startsWith('data:')).join(','));
    ok(!(await p.evaluate(()=>!document.getElementById('arcadeBtn').hidden)),'"‹ Arcade" hidden when standalone'); await p.close(); }

  // Arcade build: contract
  fs.writeFileSync(path.join(DIST,'index.html'),'<!doctype html><title>Arcade</title>');
  { const arcade={set:{sfx:false,music:false,haptics:false,lefty:true,lang:'en',appearance:'dark',motion:true,cb:false,fullscreen:false},name:'Alasdair'};
    const p=await page(b,{file:'linefall/index.html',arcade,save:{sfx:true,lefty:false,seenVer:'0.1.0'}});
    ok(await p.evaluate(()=>window.__ARCADE__===1&&ARCADE),'Arcade build sets window.__ARCADE__=1'); ok(await p.evaluate(()=>!!document.querySelector('link[href="../fonts.css"]')),'links ../fonts.css');
    ok(await p.evaluate(()=>!document.getElementById('arcadeBtn').hidden),'"‹ Arcade" shown on home'); ok(await p.evaluate(()=>P.lefty===true&&P.sfx===false&&document.documentElement.classList.contains('dark')),'shared settings applied from arcade.v1');
    await p.evaluate(()=>{ S.xp=60; persist(); }); await p.waitForTimeout(450);
    const st=await p.evaluate(()=>({save:JSON.parse(localStorage.getItem('linefall.v1')),sum:JSON.parse(localStorage.getItem('arcade.summary.linefall')),arc:localStorage.getItem('arcade.v1'),keys:Object.keys(localStorage)}));
    ok(st.save.sfx===true&&st.save.lefty===false,'linefall.v1 keeps the standalone values'); ok(st.arc===JSON.stringify(arcade),'arcade.v1 is never written');
    ok(st.sum&&['v','game','ver','level','maxLevel','xp','xpLevel','xpNext','ach','hi','last'].every(k=>k in st.sum)&&st.sum.level===2,'summary written 300 ms after a save, with every field');
    ok(st.keys.every(k=>k.startsWith('linefall.')||k==='arcade.summary.linefall'||k==='arcade.v1'),'only linefall.* keys (plus the summary) are written: '+st.keys.join(','));
    await p.evaluate(()=>openSettings()); ok(await p.evaluate(()=>!!document.getElementById('arcSet')&&!document.querySelector('[data-sw="sfx"]')&&!document.querySelector('[data-sw="lefty"]')),'Arcade settings row shown; shared settings hidden');
    await p.evaluate(()=>{ localStorage.setItem('arcade.v1',JSON.stringify({set:{lefty:false,appearance:'light'}})); dispatchEvent(new PageTransitionEvent('pageshow')); }); ok(await p.evaluate(()=>P.lefty===false),'shared settings re-read on pageshow');
    await p.goto('about:blank'); await p.goto(url('linefall/index.html#game-settings')); await p.waitForTimeout(250); ok(await p.evaluate(()=>cur==='set'&&location.hash===''),'#game-settings opens settings and clears the hash');
    const src=fs.readFileSync(path.join(DIST,'linefall','index.html'),'utf8'); ok(!/location\.href\s*=/.test(src)&&/location\.replace\(url\)/.test(src)&&src.includes("ARCADE_HOME='../index.html', ARCADE_PREFS='../index.html#prefs'"),'navigation uses location.replace');
    ok(src.includes('id="settingsBtn"'),'settings button id #settingsBtn'); ok(!src.includes('serviceWorker'),'no service worker');
    await p.evaluate(()=>goHome()); const h0=await p.evaluate(()=>history.length); await p.click('#arcadeBtn'); await p.waitForTimeout(300); const u=p.url(); ok(u.endsWith('/dist/index.html'),'"‹ Arcade" goes to ../index.html');
    await p.close(); fs.unlinkSync(path.join(DIST,'index.html')); }

  await b.close(); console.log(`\n${fail?'FAILED':'ok'}: ${pass} passed, ${fail} failed (${((Date.now()-t0)/1000).toFixed(1)} s)`); process.exit(fail?1:0); })();
