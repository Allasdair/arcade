// node tests/layout.js   (Playwright + Chrome; run python3 build.py first)
const {chromium}=require('playwright'); const path=require('path');
const DIST=path.join(__dirname,'..','dist'); let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  FAIL: '+m); } };
const url=f=>'file://'+path.join(DIST,f);
async function page(b,o){ o=o||{}; const vp=o.vp||{width:390,height:844}; const p=await b.newPage({viewport:vp,hasTouch:true,isMobile:vp.width<600,deviceScaleFactor:2});
  p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') p.errs.push(m.text()); });
  p.reqs=[]; p.on('request',r=>p.reqs.push(r.url()));
  await p.addInitScript(o=>{ window.__i18nMiss=new Set(); if(window.name==='seeded') return; window.name='seeded'; if(o.save) localStorage.setItem('drift.v1',JSON.stringify(o.save)); if(o.arcade) localStorage.setItem('arcade.v1',JSON.stringify(o.arcade)); },{save:o.save||null,arcade:o.arcade||null});
  await p.goto(url(o.file||'standalone.html')+(o.hash||'')); await p.waitForTimeout(250); return p; }
const noSide=async(p,what)=>{ const w=await p.evaluate(()=>{ const els=[document.documentElement,...document.querySelectorAll('.screen.on .scroll,#sheet')]; return Math.max(...els.map(e=>e.scrollWidth-e.clientWidth)); }); ok(w<=1,`${what}: no sideways scroll (${w}px)`); };
async function screens(p,tag){ const vis=async(name,fn)=>{ await p.evaluate(fn); await p.waitForTimeout(110); await noSide(p,`${tag} ${name}`); };
  for(const [n,fn] of [['home','renderHome()'],['normal sheet','openSetup()'],['campaign','closeSheet();openCamp(0)'],['level sheet','openLevel(LEVEL_BY.n15)'],['campaign hard','closeSheet();openCamp(2)'],['endless sheet','closeSheet();goHome();openEndless()'],
    ['records','closeSheet();openRecords()'],['progress','openProgress("levels")'],['achievements','openProgress("ach")'],['style','openStyle()'],['style sounds','styleTab="sound";renderStyle()'],['settings','openSettings()'],['how to play','openHowto()'],['what\'s new','closeSheet();openNews()'],['backup','closeSheet();openBackup()'],
    ['game','closeSheet();goHome();startGame("normal",{})']]) await vis(n,fn);
  await p.waitForTimeout(2100); await vis('pause','pauseGame()');
  await p.evaluate(()=>{ closeSheet(); G.state='play'; G.st.rocks=[]; G.st.queue=[]; G.st.pending=[]; }); await p.waitForTimeout(4200);
  await noSide(p,`${tag} results`); ok(await p.evaluate(()=>sheetOn&&!!document.querySelector('#rHome')),`${tag}: a cleared field shows results`); await p.evaluate(()=>goHome()); }

(async()=>{ const b=await chromium.launch(); const t0=Date.now();
  for(const w of [360,390]) for(const lang of ['en','de']){ const p=await page(b,{vp:{width:w,height:780},save:{lang,seenVer:'0.1.0',howto:true,xp:900}}); await screens(p,`${w}px ${lang}`);
    ok(!p.errs.length,`${w}px ${lang}: no page errors ${p.errs.join(' | ')}`);
    if(lang==='de'&&w===390){ const miss=await p.evaluate(()=>[...window.__i18nMiss].filter(t=>!/^[\d\s.,:/×·—★☆+%-]+$/.test(t)&&!/^(SELECT|START)$/.test(t)));
      const en=miss.filter(t=>/\b(the|and|rocks?|level|wave|clear|your)\b/i.test(t)&&!/[äöüß]|Felsen|Welle|Level \d/.test(t)); console.log(`  (German: ${en.length} English strings seen${en.length?': '+en.join(' | '):''})`); ok(!en.length,'German shows no untranslated English'); }
    await p.close(); }

  // HUD and radar keep clear of the ship's area at 360 px, on every difficulty
  for(const d of ['easy','normal','hard']){ const p=await page(b,{vp:{width:360,height:740},save:{seenVer:'0.1.0',setup:{diff:d,mods:null}}});
    await p.evaluate(d=>{ S.setup={diff:d,mods:defMods(d)}; startGame('normal',{}); },d); await p.waitForTimeout(2300);
    const r=await p.evaluate(()=>{ const [sx,sy]=scr(G.st,G.st.ship.x,G.st.ship.y); return {sx,sy,w:LY.w,h:LY.h}; });
    ok(r.sx>70&&r.sx<r.w-70&&r.sy>60&&r.sy<r.h-110,`${d}: the ship starts clear of the HUD and radar (${r.sx|0},${r.sy|0} in ${r.w|0}×${r.h|0})`); await p.close(); }

  // controls
  { const p=await page(b,{save:{seenVer:'0.1.0'}}); await p.evaluate(()=>startGame('normal',{})); await p.waitForTimeout(2200);
    const before=await p.evaluate(()=>[G.st.stats.shots,G.st.ship.a]); const sb=await p.$eval('#scr',e=>{ const r=e.getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2]; });
    await p.touchscreen.tap(sb[0],sb[1]); await p.waitForTimeout(150); ok(await p.evaluate(b=>G.st.stats.shots===b[0]&&G.state==='play',before),'screen touches are ignored during play');
    // multi-touch: hold ▲ on the D-pad while pressing A
    const cdp=await p.context().newCDPSession(p); const at=async(sel,dx,dy)=>p.$eval(sel,(e,d)=>{ const r=e.getBoundingClientRect(); return [r.left+r.width/2+d[0]*r.width,r.top+r.height/2+d[1]*r.height]; },[dx||0,dy||0]);
    const up=await at('#dpad',0,-0.35), A=await at('.ab .a');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:up[0],y:up[1],id:1}]}); await p.waitForTimeout(80);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:up[0],y:up[1],id:1},{x:A[0],y:A[1],id:2}]}); await p.waitForTimeout(500);
    const both=await p.evaluate(()=>[G.st.in.up,G.st.in.fire,G.st.stats.shots]); ok(both[0]===1&&both[1]===1&&both[2]>0,`holding ▲ while pressing A both register (${both})`);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await p.waitForTimeout(80); ok(await p.evaluate(()=>!G.st.in.up&&!G.st.in.fire),'releasing lets go of both');
    // a diagonal with one thumb
    const dg=await at('#dpad',0.33,0.33); await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:dg[0],y:dg[1],id:3}]}); await p.waitForTimeout(80);
    ok(await p.evaluate(()=>G.st.in.down&&G.st.in.right),'one thumb holds a diagonal on the D-pad'); await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    // B dashes, Select uses the power-up, Start pauses
    await p.evaluate(()=>{ G.st.ship.dashCd=0; G.st.power.held='shield'; }); await p.tap('.ab .b'); await p.waitForTimeout(80); ok(await p.evaluate(()=>G.st.stats.dashes===1),'B dashes');
    await p.tap('[data-b="select"]'); await p.waitForTimeout(80); ok(await p.evaluate(()=>G.st.ship.shield),'Select uses the power-up');
    await p.tap('[data-b="start"]'); await p.waitForTimeout(120); ok(await p.evaluate(()=>G.state==='pause'),'Start pauses');
    // Android back pauses; reload → Continue → resume
    await p.evaluate(()=>{ closeSheet(); resumeGame(); }); await p.waitForTimeout(2200); await p.goBack(); await p.waitForTimeout(200); ok(await p.evaluate(()=>G&&G.state==='pause'),'Android back pauses the game');
    const sc=await p.evaluate(()=>G.st.tick); await p.reload(); await p.waitForTimeout(300); ok(await p.evaluate(()=>!!document.querySelector('#hCont')),'after a reload, Continue is on home');
    await p.click('#hCont'); await p.waitForTimeout(2300); ok(await p.evaluate(t=>G&&G.st.tick>=t,sc),'Continue resumes the run with a countdown');
    // keyboard
    await p.keyboard.down('ArrowUp'); await p.keyboard.down(' '); await p.waitForTimeout(400); ok(await p.evaluate(()=>G.st.in.up&&G.st.in.fire),'keyboard: arrows and Space'); await p.keyboard.up('ArrowUp'); await p.keyboard.up(' ');
    await p.evaluate(()=>{ G.st.ship.dashCd=0; }); await p.keyboard.press('Shift'); await p.waitForTimeout(80); ok(await p.evaluate(()=>G.st.stats.dashes>=1),'keyboard: Shift dashes'); await p.keyboard.press('p'); await p.waitForTimeout(80); ok(await p.evaluate(()=>G.state==='pause'),'keyboard: P pauses');
    ok(!p.errs.length,'controls: no page errors '+p.errs.join(' | ')); await p.close(); }
  // the three layouts and both steering styles
  for(const [layout,steer] of [['dpad','direct'],['dpad','classic'],['donly','direct'],['stick','direct']]){ const p=await page(b,{save:{seenVer:'0.1.0',ctl:{layout,steer,autofire:'hold',size:'normal',lead:true,radar:'normal'}}});
    await p.evaluate(()=>startGame('normal',{})); await p.waitForTimeout(2200); const a0=await p.evaluate(()=>G.st.ship.a);
    if(layout==='stick'){ const box=await p.$eval('#steerPad',e=>{ const r=e.getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2]; }); const cdp=await p.context().newCDPSession(p);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box[0],y:box[1],id:1}]}); for(let i=1;i<=6;i++){ await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box[0]+i*10,y:box[1],id:1}]}); await p.waitForTimeout(30); }
      await p.waitForTimeout(500); ok(await p.evaluate(()=>Math.abs(angDiff(G.st.ship.a,64))<6&&Math.hypot(G.st.ship.vx,G.st.ship.vy)>1),'thumbstick: drag right turns and thrusts right');
      const fp=await p.$eval('#firePad',e=>{ const r=e.getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2]; }); await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box[0]+60,y:box[1],id:1},{x:fp[0],y:fp[1],id:2}]}); await p.waitForTimeout(300);
      ok(await p.evaluate(()=>G.st.stats.shots>0),'thumbstick: holding the right half fires'); await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); }
    else { const r=await p.$eval('#dpad',e=>{ const r=e.getBoundingClientRect(); return [r.right-8,r.top+r.height/2]; }); await p.touchscreen.tap(r[0],r[1]);
      await p.evaluate(()=>{ send('p','right'); }); await p.waitForTimeout(400); await p.evaluate(()=>send('r','right'));
      ok(await p.evaluate(a0=>G.st.ship.a!==a0,a0),`${layout}/${steer}: ▶ turns the ship`);
      if(layout==='donly'){ ok(await p.evaluate(()=>getComputedStyle(document.querySelector('.ab .a')).visibility==='hidden'&&G.st.cfg.fire==='range'),'D-pad only: no A button, fire is automatic'); } }
    await p.close(); }
  // left-handed swap
  { const p=await page(b,{save:{seenVer:'0.1.0',lefty:true}}); await p.evaluate(()=>startGame('normal',{})); await p.waitForTimeout(300);
    const [dx,ax]=await p.evaluate(()=>[document.querySelector('#dpad').getBoundingClientRect().left,document.querySelector('.ab').getBoundingClientRect().left]); ok(dx>ax,'left-handed swaps the D-pad and A/B'); await p.close(); }
  // 60 fps: Hard, More density, with the Leviathan on screen
  { const p=await page(b,{save:{seenVer:'0.1.0'}}); await p.evaluate(()=>startGame('campaign',{lid:'h15'})); await p.waitForTimeout(2200);
    await p.evaluate(()=>{ const st=G.st; for(let i=0;i<40;i++) st.rocks.push(makeRock(st,1+i%3,G.cam.x+(i%8-4)*90,G.cam.y+((i/8|0)-2)*90,0.4,0.3)); for(let i=0;i<60;i++) G.fx.parts.push({x:st.ship.x,y:st.ship.y,vx:Math.random()-.5,vy:Math.random()-.5,life:1,dec:.1,col:'#fff',z:2}); });
    const ms=await p.evaluate(async()=>{ const t=[]; for(let i=0;i<60;i++){ const a=performance.now(); draw(a); t.push(performance.now()-a); await new Promise(r=>requestAnimationFrame(r)); } t.sort((a,b)=>a-b); return t[Math.floor(t.length*.9)]; });
    ok(ms<10,`Hard with 40+ rocks and the boss: draw under 10 ms a frame (90th pct ${ms.toFixed(1)} ms)`); await p.close(); }
  // standalone: CSP, no outside requests
  { const p=await page(b); const html=await p.content(); ok(html.includes("Content-Security-Policy")&&html.includes("default-src 'self'"),'standalone has the strict CSP'); ok(p.reqs.every(u=>u.startsWith('file:')||u.startsWith('data:')),'no outside requests'); await p.close(); }
  // the Arcade build contract
  { const arc={set:{appearance:'dark',sfx:false,music:false,haptics:false,motion:false,cb:true,lefty:true,lang:'en',fullscreen:false},name:'Al'};
    const p=await page(b,{file:'drift/index.html',arcade:arc,save:{seenVer:'0.1.0',sfx:true,appearance:'light'}});
    ok(await p.evaluate(()=>window.__ARCADE__===1&&ARCADE),'__ARCADE__ is set'); ok(await p.evaluate(()=>!!document.querySelector('link[href="../fonts.css"]')),'links ../fonts.css');
    ok(await p.evaluate(()=>P.appearance==='dark'&&P.cb===true&&P.lefty===true&&P.sfx===false),'shared settings come from arcade.v1'); ok(await p.evaluate(()=>S.sfx===true&&S.appearance==='light'),'standalone values are kept in drift.v1');
    ok(await p.evaluate(()=>!document.querySelector('#arcadeBtn').hidden),'"‹ Arcade" on home');
    await p.evaluate(()=>{ S.xp=60; persist(); writeSummary(); }); const sm=await p.evaluate(()=>JSON.parse(localStorage.getItem('arcade.summary.drift')));
    ok(sm&&sm.game==='drift'&&sm.xp===60&&sm.hi.length===3&&sm.ach.length===22,'summary written');
    const keys=await p.evaluate(()=>Object.keys(localStorage)); ok(keys.every(k=>k.startsWith('drift.')||k==='arcade.v1'||k==='arcade.summary.drift'),`only drift.* keys are written (${keys})`);
    ok(await p.evaluate(a=>localStorage.getItem('arcade.v1')===JSON.stringify(a),arc),'arcade.v1 untouched');
    await p.evaluate(()=>openSettings()); ok(await p.evaluate(()=>!!document.querySelector('#arcSet')&&!document.querySelector('[data-sw="sfx"]')&&!document.querySelector('[data-sw="lefty"]')),'Arcade settings row; shared settings hidden');
    const src=await p.content(); ok(/location\.replace\(url\)/.test(src)&&!/location\.href\s*=/.test(src),'leaves with location.replace'); ok(await p.evaluate(()=>!!document.querySelector('#settingsBtn')),'#settingsBtn'); ok(!src.includes('serviceWorker'),'no service worker');
    await p.evaluate(()=>{ localStorage.setItem('arcade.v1',JSON.stringify({set:{appearance:'light'}})); dispatchEvent(new PageTransitionEvent('pageshow')); }); ok(await p.evaluate(()=>P.appearance==='light'),'pageshow re-reads arcade.v1');
    const errs=p.errs.filter(e=>!/ERR_FILE_NOT_FOUND/.test(e)); ok(!errs.length,'Arcade: no page errors (../fonts.css lives in the Arcade) '+errs.join(' | ')); await p.close();
    const q=await page(b,{file:'drift/index.html',hash:'#game-settings',save:{seenVer:'0.1.0'}}); ok(await q.evaluate(()=>cur==='set'&&!location.hash),'#game-settings opens settings and clears the hash'); await q.close(); }
  console.log(`\n${pass} passed, ${fail} failed (${((Date.now()-t0)/1000).toFixed(0)} s)`); await b.close(); process.exit(fail?1:0); })();
