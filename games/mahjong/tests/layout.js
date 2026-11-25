// node tests/layout.js   (Playwright + Chrome; run python3 build.py first)
let PW; try{ PW=require('playwright'); }catch(e){ PW=require('/opt/npm-tools/node_modules/playwright'); }
const {chromium}=PW; const path=require('path'), fs=require('fs');
const DIST=path.join(__dirname,'..','dist'); let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  FAIL: '+m); } };
const url=f=>'file://'+path.join(DIST,f);
const exe=['/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>fs.existsSync(p));
const SEEN={seenVer:'0.1.0',howto:true};
async function page(b,o){ o=o||{}; const vp=o.vp||{width:390,height:844}; const ctx=await b.newContext({viewport:vp,hasTouch:o.touch!==false,isMobile:o.touch!==false&&vp.width<600,deviceScaleFactor:2});
  const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error'&&!(/ERR_FILE_NOT_FOUND/.test(m.text())&&(o.file||'').startsWith('mahjong/'))) p.errs.push(m.text()); });
  p.reqs=[]; p.on('request',r=>p.reqs.push(r.url()));
  await p.addInitScript(o=>{ window.__i18nMiss=new Set(); if(localStorage.getItem('__seeded')) return; localStorage.clear(); localStorage.setItem('__seeded','1'); if(o.save) localStorage.setItem('mahjong.v1',JSON.stringify(o.save)); if(o.arcade) localStorage.setItem('arcade.v1',JSON.stringify(o.arcade)); },{save:o.save===undefined?SEEN:o.save,arcade:o.arcade||null});
  await p.goto(url(o.file||'standalone.html')+(o.hash||'')); await p.waitForTimeout(250); return p; }
const noSide=async(p,what)=>{ const w=await p.evaluate(()=>{ const els=[document.documentElement,document.body,...document.querySelectorAll('.screen.on .scroll,#sheet,.screen.on')]; return Math.max(...els.map(e=>e.scrollWidth-e.clientWidth)); }); ok(w<=1,`${what}: no sideways scroll (${w}px)`); };
const ev=(p,fn,arg)=>p.evaluate(fn,arg);
async function screens(p,tag){ const vis=async(name,fn)=>{ await fn(); await p.waitForTimeout(140); await noSide(p,`${tag} ${name}`); };
  await vis('home',async()=>{});
  await vis('classic sheet',()=>p.click('#hClassic')); await vis('classic sheet hard',()=>ev(p,()=>{ S.setup.diff='hard'; openSetup(); })); await ev(p,()=>{ S.setup.diff='normal'; closeSheet(); });
  await vis('campaign',()=>p.click('#hCamp')); for(const c of [1,2,0]) await vis('campaign tab '+c,()=>p.click(`[data-ct="${c}"]`));
  await vis('level sheet',()=>p.click('[data-lv="G1"]')); await ev(p,()=>goHome());
  await vis('daily sheet',()=>p.click('#hDaily')); await ev(p,()=>closeSheet());
  for(const t of ['levels','ach','rec']) await vis('progress '+t,()=>ev(p,t=>openProgress(t),t));
  await ev(p,()=>openStyle()); for(const t of ['face','body','board','layout','fx','sound']) await vis('style '+t,()=>p.click(`[data-tab="${t}"]`));
  for(const [n,fn] of [['settings',()=>openSettings()],['how to play',()=>openHowto()],['what\'s new',()=>openNews()],['about',()=>openAbout()],['language',()=>openLang()]]){ await vis(n,()=>ev(p,fn)); await ev(p,()=>closeSheet()); }
  await vis('backup',()=>ev(p,()=>openBackup())); await ev(p,()=>goHome());
  await vis('game',()=>ev(p,()=>startGame({mode:'classic'},newGame({lid:'fortress',diff:'hard',seed:'L',trap:.5,shuffles:3,undo:true,ta:true,fog:true,grade:'hard'}))));
  await vis('pause',()=>ev(p,()=>openPause())); await ev(p,()=>closeSheet());
  await vis('stuck banner',()=>ev(p,()=>showStuck())); await vis('warn banner',()=>ev(p,()=>{ hideBanner(); banner(`<b>${T('This position can\'t be won without a shuffle.')}</b><button>${T('Undo')}</button><button class="g">${T('OK')}</button>`); }));
  await ev(p,()=>hideBanner());
  await vis('results',()=>ev(p,()=>{ const st=G.st; const line=solveState(st,{ref:st.order}).line; for(const [a,b] of line) removePair(st,a,b); finishGame(); })); await p.waitForTimeout(1600); await noSide(p,tag+' results sheet');
  await ev(p,()=>{ sheetClose=null; closeSheet(); G=null; goHome(); });
  await vis('campaign game',()=>ev(p,()=>startLevel(LEVELS[9]))); await vis('daily game',()=>ev(p,()=>startGame({mode:'daily',date:todayStr()},newGame(dailyBoard(todayStr())))));
  await vis('daily results',()=>ev(p,()=>{ G.st.over=true; G.st.lost=true; finishGame(); })); await ev(p,()=>{ sheetClose=null; closeSheet(); G=null; goHome(); }); }

(async()=>{ const b=await chromium.launch({executablePath:exe}); const t0=Date.now();
  for(const w of [360,390]) for(const lang of ['en','de']){ const p=await page(b,{vp:{width:w,height:780},save:Object.assign({},SEEN,{lang})}); await screens(p,`${w}px ${lang}`);
    ok(!p.errs.length,`${w}px ${lang}: no page errors ${p.errs.join(' | ')}`);
    if(lang==='de'&&w===390){ const miss=await ev(p,()=>[...window.__i18nMiss].filter(t=>!/^[\d\s.,:/×·—★☆+%()…–-]+$/.test(t)&&!/^[A-Z]\d?$/.test(t))); if(process.env.MISS) fs.writeFileSync('/tmp/miss.json',JSON.stringify(miss,null,0));
      console.log(`  (German: ${miss.length} untranslated strings seen${miss.length?': '+miss.slice(0,40).join(' | '):''})`); ok(miss.length===0,'German: every string seen is translated'); }
    await p.close(); }

  // tile size: at least 30 px wide at fit-to-screen on Easy and Normal at 360 px
  { const p=await page(b,{vp:{width:360,height:780}}); const r=await ev(p,()=>LAYOUTS.filter(L=>L.diff==='easy'||L.diff==='normal').map(L=>{ startGame({mode:'classic'},newGame({lid:L.id,diff:L.diff,seed:'s',trap:0,shuffles:'inf',undo:true})); return [L.id,G.cam.s*TW]; }));
    for(const [id,w] of r) ok(w>=30,`${id}: tiles ${w.toFixed(1)} px wide at 360 px`); await p.close(); }

  // readability: every face in every set (and High-contrast) renders differently from every other face in that set
  { const p=await page(b); const r=await ev(p,async()=>{ const sets=[...Object.keys(FACESETS).map(s=>[s,false]),['classic',true],['minimal',true]], out=[];
      for(const [set,hc] of sets) for(const body of ['ivory','obsidian']){ const B=BODIES[body], seen=new Map(); let dup=[];
        for(let f=0;f<42;f++){ const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80" width="60" height="80"><rect width="60" height="80" fill="${B.face}"/>${faceSvg(f,set,{hc,dark:!!B.dark,bg:B.face})}</svg>`;
          const img=new Image(); img.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg))); await img.decode(); const c=document.createElement('canvas'); c.width=30; c.height=40; const x=c.getContext('2d'); x.drawImage(img,0,0,30,40);
          const d=x.getImageData(0,0,30,40).data; let h=0; for(let i=0;i<d.length;i+=4) h=(h*31+(d[i]>>4)*7+(d[i+1]>>4)*3+(d[i+2]>>4))>>>0;
          if(seen.has(h)) dup.push(f+'='+seen.get(h)); else seen.set(h,f); }
        out.push([set+(hc?'+hc':'')+'/'+body,dup]); } return out; });
    for(const [k,dup] of r) ok(!dup.length,`${k}: all 42 faces distinct at 30×40 px ${dup.join(' ')}`); await p.close(); }

  // play by touch: select, blocked shake, match; zoom on a Hard layout; taps hit the right tile when zoomed
  { const p=await page(b,{vp:{width:360,height:780}}); await ev(p,()=>startGame({mode:'classic'},newGame({lid:'bigcross',diff:'hard',seed:'z',trap:.5,shuffles:'inf',undo:true,grade:'hard'})));
    const xy=i=>ev(p,i=>tileScreen(i),i); const tapT=async i=>{ const [x,y]=await xy(i); await p.touchscreen.tap(x,y); await p.waitForTimeout(300); };
    const s0=await ev(p,()=>G.cam.s);
    // double-tap the table (outside the tiles) zooms
    const r=await ev(p,()=>{ const r=document.querySelector('#bview').getBoundingClientRect(); return {x:r.left+6,y:r.top+6}; }); await p.touchscreen.tap(r.x,r.y); await p.waitForTimeout(80); await p.touchscreen.tap(r.x,r.y); await p.waitForTimeout(200);
    const s1=await ev(p,()=>G.cam.s); ok(s1>s0*1.3,`double-tap zooms (${(s0*60).toFixed(0)} → ${(s1*60).toFixed(0)} px tiles)`);
    // pinch with two touch points
    await ev(p,()=>fitBoard()); const s2=await ev(p,()=>G.cam.s);
    await ev(p,()=>{ const v=document.querySelector('#bview'), r=v.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2; const ev=(t,id,x,y)=>v.dispatchEvent(new PointerEvent(t,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));
      ev('pointerdown',1,cx-30,cy); ev('pointerdown',2,cx+30,cy); for(let k=1;k<=8;k++){ ev('pointermove',1,cx-30-k*12,cy); ev('pointermove',2,cx+30+k*12,cy); } ev('pointerup',1,cx-126,cy); ev('pointerup',2,cx+126,cy); });
    const s3=await ev(p,()=>G.cam.s); ok(s3>s2*1.8,`pinch zooms (×${(s3/s2).toFixed(2)})`);
    // zoomed: tap a free tile that's on screen; it must be the one selected
    const pick=await ev(p,()=>{ const r=document.querySelector('#bview').getBoundingClientRect(); return freeList(layoutOf(G.st),G.st.gone).find(i=>{ const [x,y]=tileScreen(i); return x>r.left+20&&x<r.right-20&&y>r.top+20&&y<r.bottom-20&&hitTile(x-r.left,y-r.top)===i; }); });
    ok(pick!=null,'a free tile is on screen when zoomed'); if(pick!=null){ await tapT(pick); ok(await ev(p,i=>G.st.sel===i,pick),'a tap hits the right tile when zoomed'); }
    await ev(p,()=>{ G.st.sel=-1; fitBoard(); render(); });
    const blk=await ev(p,()=>{ const L=layoutOf(G.st), r=document.querySelector('#bview').getBoundingClientRect(); for(let i=0;i<L.n;i++){ if(stFree(G.st,i)) continue; const [x,y]=tileScreen(i); if(hitTile(x-r.left,y-r.top)===i) return i; } return -1; });
    await tapT(blk); ok(await ev(p,()=>G.st.sel===-1),'tapping a blocked tile selects nothing');
    const [a,c]=await ev(p,()=>solveState(G.st,{ref:G.ref}).line[0]); await tapT(a); await tapT(c); ok(await ev(p,([a,c])=>G.st.gone[a]&&G.st.gone[c],[a,c]),'tapping a free pair removes it');
    // Android back opens the pause menu in a game
    await p.goBack(); await p.waitForTimeout(200); ok(await ev(p,()=>sheetOn&&/Paused/.test(document.querySelector('#sheet').textContent)),'back opens the pause menu');
    // saved after every move; reload resumes exactly
    const before=await ev(p,()=>JSON.stringify(G.st.gone)); if(process.env.DBG) console.log('DBG',await ev(p,()=>[location.href,!!S.run,!!G,cur,history.length])); await p.reload(); await p.waitForTimeout(300); if(process.env.DBG) console.log('DBG2',await ev(p,()=>[location.href,!!S.run,(localStorage.getItem('mahjong.v1')||'').length])); ok(await ev(p,b=>!!S.run&&JSON.stringify(S.run.st.gone)===b,before),'the game is saved after every move and survives a reload');
    await p.click('#hCont'); await p.waitForTimeout(200); ok(await ev(p,b=>G&&JSON.stringify(G.st.gone)===b,before),'Continue resumes exactly');
    ok(!p.errs.length,'play: no page errors '+p.errs.join(' | ')); await p.close(); }

  // standalone: CSP and no outside requests; the Arcade build
  { const p=await page(b); ok(p.reqs.every(u=>u.startsWith('file:')||u.startsWith('data:')),'standalone: no outside requests'); ok(await ev(p,()=>!!document.querySelector('meta[http-equiv="Content-Security-Policy"]')),'standalone: CSP meta'); await p.close(); }
  { const p=await page(b,{file:'mahjong/index.html',arcade:{set:{appearance:'dark',lefty:true,music:false,sfx:false},name:'Ali'}});
    ok(await ev(p,()=>ARCADE&&!document.querySelector('#arcadeBtn').hidden),'Arcade: the ‹ Arcade button shows'); ok(await ev(p,()=>P.appearance==='dark'&&document.body.classList.contains('dark')),'Arcade: shared appearance applies');
    ok(await ev(p,()=>!document.querySelector('#langBtn')&&(openSettings(),!!document.querySelector('#arcSet'))),'Arcade: shared settings hidden, Arcade settings row shown');
    await ev(p,()=>{ goHome(); persist(); writeSummary(); }); const keys=await ev(p,()=>Object.keys(localStorage).filter(k=>k!=='__seeded'));
    ok(keys.every(k=>k.startsWith('mahjong.')||k==='arcade.summary.mahjong'||k==='arcade.v1'),'Arcade: only mahjong.* and the summary are written: '+keys.join(','));
    ok(await ev(p,()=>JSON.parse(localStorage.getItem('arcade.v1')).name==='Ali'),'Arcade: arcade.v1 untouched'); await p.close(); }
  { const p=await page(b,{file:'mahjong/index.html',hash:'#game-settings'}); ok(await ev(p,()=>cur==='set'&&location.hash===''),'#game-settings opens settings and clears the hash'); await p.close(); }

  await b.close(); console.log(`\n${pass} passed, ${fail} failed in ${Math.round((Date.now()-t0)/1000)} s`); process.exit(fail?1:0); })();
