// node tests/layout.js   (Playwright + Chrome; run python3 build.py first)   DUMP=1 lists every untranslated German text
// No sideways scroll at 360 and 390 px in English and German on every screen, sheet and game state; German shows no
// untranslated text; tiles ≥ 40 px on 8×8 at 360 px; every element distinguishable in grayscale in every skin; swipe and
// tap swaps under touch emulation, an invalid swap slides back; 60 fps during a big cascade; Android back opens the
// pause menu; the Arcade build follows the contract.
const path=require('path'), fs=require('fs');
let pw; try{ pw=require('playwright'); }catch(e){ pw=require('/opt/npm-tools/node_modules/playwright'); }
const DIST=path.join(__dirname,'..','dist'), FILE='file://'+path.join(DIST,'standalone.html'), DUMP=!!process.env.DUMP;
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  FAIL: '+m); } };
(async()=>{ const exe=['/usr/bin/google-chrome','/usr/bin/chromium'].find(f=>fs.existsSync(f));
  const b=await pw.chromium.launch(exe?{executablePath:exe}:{}); const t0=Date.now(); const missAll=new Set();
  async function page(w,lang,h,url){ const ctx=await b.newContext({viewport:{width:w,height:h||740},hasTouch:true,locale:lang==='de'?'de-DE':'en-US'});
    await ctx.addInitScript(l=>{ window.__i18nMiss=new Set(); if(!localStorage.getItem('quintessence.v1')) localStorage.setItem('quintessence.v1',JSON.stringify({v:1,xp:0,lang:l||'en',seenVer:'0.1.0'})); },lang==='de'?'de':'');
    const p=await ctx.newPage(); p.errs=[]; p.reqs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('request',r=>{ if(!r.url().startsWith('file:')&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:')) p.reqs.push(r.url()); });
    await p.goto(url||FILE); await p.waitForTimeout(250); return p; }
  const noSide=async(p,what)=>{ const r=await p.evaluate(()=>{ const bad=[]; const chk=el=>{ if(el&&el.scrollWidth>el.clientWidth+1) bad.push((el.id||el.className)+' '+el.scrollWidth+'>'+el.clientWidth); };
      chk(document.documentElement); $$('.screen.on .scroll').forEach(chk); if(sheetOn) chk($('#sheet')); if(cur==='game'){ chk($('.gcol')); chk($('.gbar')); }
      $$('.screen.on .card, #sheet .srow, #sheet .goal, .screen.on .tcard, #tools button, .gl').forEach(e=>{ if(e.scrollWidth>e.clientWidth+1) bad.push('el '+e.textContent.slice(0,30)); }); return bad; });
    ok(!r.length,`${what}: no sideways scroll ${r.join(', ')}`); };
  const settle=p=>p.waitForFunction(()=>!AN.cur&&!AN.q.length,null,{timeout:20000}).catch(()=>{});
  for(const w of [360,390]) for(const lang of ['en','de']){ const p=await page(w,lang), tag=`${w}px ${lang}`;
    const screens=[['home',()=>goHome()],['classic sheet',()=>openSetup()],['classic zen',()=>{ S.setup.mode='zen'; closeSheet(); openSetup(); }],['campaign',()=>{ closeSheet(); S.setup.mode='moves'; openCamp(0); }],['campaign 2',()=>{ S.campTab=1; renderCamp(); }],['campaign 3',()=>{ S.campTab=2; renderCamp(); }],
      ['level sheet',()=>openLevel(LEVELS[0])],['level sheet timed',()=>{ closeSheet(); openLevel(LEVELS[6]); }],['level sheet two goals',()=>{ closeSheet(); openLevel(LEVELS[44]); }],['level sheet puzzle',()=>{ closeSheet(); openLevel(LEVELS[9]); }],['daily sheet',()=>{ closeSheet(); openDaily(); }],
      ['progress levels',()=>{ closeSheet(); openProgress('levels'); }],['progress achievements',()=>openProgress('ach')],['progress records',()=>openProgress('rec')],
      ...['skin','board','fx','sound'].map(k=>['style '+k,`()=>{ styleTab='${k}'; openStyle(); }`]),['settings',()=>openSettings()],['language',()=>openLang()],['backup',async()=>{ closeSheet(); await openBackup(); }],
      ['how to play',()=>{ closeSheet(); openHowto(); }],['what\'s new',()=>{ closeSheet(); openNews(); }],
      ['game classic',()=>{ closeSheet(); S.setup={mode:'moves',board:'8',ne:5,obst:'light'}; startClassic(); }],['pause',()=>openPause()],['game timed',()=>{ resume(); G=null; S.setup={mode:'timed',board:'heart',ne:6,obst:'off'}; startClassic(); }],
      ['game zen',()=>{ G=null; S.setup={mode:'zen',board:'9',ne:4,obst:'off'}; startClassic(); }],['zen pause',()=>openPause()],
      ['game campaign',()=>{ resume(); G=null; startLevel(LEVELS[44]); }],['game campaign 2',()=>{ G=null; startLevel(LEVELS[29]); }],['game campaign timed',()=>{ G=null; startLevel(LEVELS[6]); }],
      ['results',()=>{ G.over=true; showResults({won:true,stars:[1,1,0],fresh:[0],ach:['sp1','cb_pp'],xp:{xp:30,before:1,after:2,rewards:rewardsAt(2),hints:1},camp:{finished:true}}); }],
      ['results lost',()=>{ closeSheet(); G.st.ended='moves'; showResults({won:false,stars:[0,0,0],fresh:[],ach:[]}); }],
      ['results classic',()=>{ closeSheet(); G=null; S.setup={mode:'moves',board:'8',ne:5,obst:'off'}; startClassic(); }],['results classic sheet',()=>{ G.over=true; showResults({won:true,stars:[1,0,1],fresh:[0],ach:[],rec:true,xp:{xp:5,before:1,after:1,rewards:[],hints:0}}); }],
      ['daily game',()=>{ closeSheet(); G=null; const d=todayStr(), cfg=dailyCfg(d); startGame({mode:'daily',date:d,cfg,st:newGame(cfg)}); }],['daily pause',()=>openPause()],
      ['daily results',()=>{ resume(); G.over=true; showResults({won:true,stars:[1,1,1],fresh:[],ach:['dstar1'],xp:{xp:40,before:1,after:1,rewards:[],hints:0}}); }],
      ['home with run',()=>{ closeSheet(); G=null; startLevel(LEVELS[1]); }],['home with run 2',()=>{ leaveGame(); }]];
    for(const [name,fn] of screens){ await p.evaluate(`(${typeof fn==='string'?fn:fn.toString()})()`); await p.waitForTimeout(/game|level/.test(name)?500:120); await noSide(p,`${tag} ${name}`); }
    // toasts and labels that only appear in play
    if(lang==='de'){ const miss=await p.evaluate(()=>{ const out=[]; const chk=t=>{ if(T(t)===t&&/[A-Za-z]{3}/.test(t)) out.push(t); };
        LEVELS.forEach(L=>{ chk(L.tip); }); ACH.forEach(a=>{ chk(a.desc); if(a.reward) chk(a.reward); chk(a.g); }); Object.values(COS_DESC).forEach(chk); COS_KINDS.forEach(([k,n])=>chk(n)); Object.values(TWISTS).forEach(chk); Object.values(MDESC).forEach(chk);
        DAILY_RECIPES.forEach(r=>chk(r.label)); Object.values(REACT).forEach(chk); EL_NAMES.forEach(chk);
        ['No swaps left: reshuffled for free','Frozen: match next to it, or a Fire match, to free it','Chained: match this piece, or a Lightning match in its row or column','Fog hides this piece: match next to it, or an Earth match nearby','Stone: match next to it to break it (Air breaks two layers)','Lava: match next to it (Water quenches, Ice freezes it)',
         'No hints left today. You get +1 for every level-up.','No swap found','+2 seconds','Overflow!','Tap to skip','Turn on Animations to see effects','Turn on Music in Settings to hear it','Clear the level before to unlock this one',"That code isn't a Quintessence backup",'Progress restored','Copied','Copied to the clipboard',
         'Out of time','No moves left','Out of moves','Attempt ended','Level complete!','Zen run ended','Well played!','Game over','Practice cleared','Time left','Moves left','Matches','Best cascade','Time','Score','Moves'].forEach(chk);
        for(let l=2;l<=10;l++) rewardsAt(l).forEach(chk); starUnlocks().forEach(u=>chk(u.text)); chk(STARTER);
        return [...new Set([...window.__i18nMiss,...out])].filter(t=>!/^[\d\s·:/+★☆%–—.,()?!×✓k-]+$/.test(t)); });
      miss.forEach(m=>missAll.add(m)); ok(!miss.length,`German: untranslated text (${miss.length}): ${miss.slice(0,14).join(' | ')}`); }
    ok(!p.errs.length,`${tag}: no page errors ${p.errs.join('; ')}`); await p.context().close(); }
  if(DUMP) fs.writeFileSync('/tmp/qn_miss.json',JSON.stringify([...missAll],null,1));
  // ---- tiles, grayscale readability, input, speed, back button ----
  { const p=await page(360,'en');
    await p.evaluate(()=>{ S.setup={mode:'moves',board:'8',ne:6,obst:'off'}; startClassic(); }); await p.waitForTimeout(500);
    const ts=await p.evaluate(()=>LY.ts); ok(ts>=40,`8×8 tiles at 360 px: ${ts} px (≥ 40)`);
    // grayscale: every pair of elements must look different in every skin, on a light and a dark board. Each picture is
    // turned to grayscale and split at its own mean brightness; the share of the tile where two elements differ must be large
    const gs=await p.evaluate(()=>{ const out=[]; for(const bg of ['#d9d0c1','#14304f']) for(const skin of COS.skin.map(c=>c.id).concat(['hc'])){ const imgs=[0,1,2,3,4,5].map(e=>{ const c=document.createElement('canvas'); c.width=c.height=40; const g=c.getContext('2d'); g.fillStyle=bg; g.fillRect(0,0,40,40); drawElement(g,e,40,skin==='hc'?'orbs':skin,skin==='hc');
          const d=g.getImageData(0,0,40,40).data, y=[]; for(let i=0;i<d.length;i+=4) y.push(.299*d[i]+.587*d[i+1]+.114*d[i+2]); const m=y.reduce((a,b)=>a+b,0)/y.length; return y.map(v=>v>m?1:0); });
        let min=1e9, pair=''; for(let a=0;a<6;a++) for(let b2=a+1;b2<6;b2++){ let x=0; for(let i=0;i<1600;i++) if(imgs[a][i]!==imgs[b2][i]) x++; const r=x/16; if(r<min){ min=r; pair=a+'/'+b2; } } out.push([skin+' on '+bg,min,pair]); } return out; });
    for(const [skin,min,pair] of gs) ok(min>=8,`grayscale: elements distinct in the ${skin} skin (closest pair ${pair}: ${min.toFixed(0)}% of the tile differs)`);
    // swipe and tap under touch emulation
    const sw=await p.evaluate(()=>{ const m=listSwaps(G.st)[0], r=BC.getBoundingClientRect(), W=G.st.W, c=i=>({x:r.left+LY.pad+(i%W+.5)*LY.ts,y:r.top+LY.pad+(((i/W)|0)+.5)*LY.ts}); return {a:c(m[0]),b:c(m[1]),moves:G.st.moves}; });
    await p.touchscreen.tap(sw.a.x,sw.a.y); await p.waitForTimeout(80); await p.touchscreen.tap(sw.b.x,sw.b.y); await settle(p); await p.waitForTimeout(200);
    ok(await p.evaluate(()=>G.st.moves)===sw.moves+1,'tap one piece then its neighbour swaps them');
    const sw2=await p.evaluate(()=>{ const m=listSwaps(G.st)[0], r=BC.getBoundingClientRect(), W=G.st.W, c=i=>({x:r.left+LY.pad+(i%W+.5)*LY.ts,y:r.top+LY.pad+(((i/W)|0)+.5)*LY.ts}); return {a:c(m[0]),b:c(m[1]),moves:G.st.moves}; });
    await p.mouse.move(sw2.a.x,sw2.a.y); await p.mouse.down(); await p.mouse.move((sw2.a.x+sw2.b.x)/2,(sw2.a.y+sw2.b.y)/2,{steps:4}); await p.mouse.move(sw2.b.x,sw2.b.y,{steps:4}); await p.mouse.up(); await settle(p); await p.waitForTimeout(200);
    ok(await p.evaluate(()=>G.st.moves)===sw2.moves+1,'a swipe toward a neighbour swaps them');
    const inv=await p.evaluate(()=>{ const st=G.st; for(let i=0;i<st.N-1;i++){ if(i%st.W<st.W-1&&movable(st,i)&&movable(st,i+1)&&!validSwap(st,i,i+1)){ const fp=fingerprint(st), mv=st.moves; trySwap(i,i+1); return {fp,mv,anim:!!AN.cur}; } } return null; });
    await settle(p); ok(inv&&inv.anim&&await p.evaluate(fp=>fingerprint(G.st)===fp,inv.fp)&&await p.evaluate(()=>G.st.moves)===inv.mv,'an invalid swap slides back and uses no move');
    // 60 fps during a big cascade (Prism + Prism)
    const fps=await p.evaluate(async()=>{ const st=G.st; const a=listSwaps(st)[0]; st.pe[a[0]]=PRISM; st.ps[a[0]]=SPRISM; st.pe[a[1]]=PRISM; st.ps[a[1]]=SPRISM; syncSprites(snap(st)); let n=0, t0=performance.now(); const f=()=>{ n++; if(performance.now()-t0<1200) requestAnimationFrame(f); }; requestAnimationFrame(f); trySwap(a[0],a[1]); await new Promise(r=>setTimeout(r,1300)); return n/1.2; });
    ok(fps>=50,`frame rate during a big cascade: ${fps.toFixed(0)} fps`);
    await settle(p);
    // Android back opens the pause menu
    await p.evaluate(()=>history.back()); await p.waitForTimeout(250); ok(await p.evaluate(()=>coverOn()),'Android back opens the pause menu');
    // save after every move, reload, resume exactly
    await p.evaluate(()=>resume()); const fp=await p.evaluate(()=>{ saveGame(); return fingerprint(G.st); }); await p.reload(); await p.waitForTimeout(300);
    ok(await p.evaluate(fp=>{ resumeRun(S.run); return fingerprint(G.st)===fp; },fp),'after a reload, Continue resumes exactly');
    ok(!p.errs.length,'no page errors '+p.errs.join('; ')); ok(!p.reqs.length,'no outside requests '+p.reqs.join(' ')); await p.context().close(); }
  // ---- the Arcade build ----
  { const ctx=await b.newContext({viewport:{width:360,height:740},hasTouch:true}); const url='file://'+path.join(DIST,'quintessence','index.html');
    await ctx.addInitScript(()=>{ localStorage.setItem('arcade.v1',JSON.stringify({set:{appearance:'dark',motion:true,sfx:false,music:false,haptics:false,fullscreen:false,cb:true,lefty:false,lang:'en'},name:'Alasdair'})); });
    const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto(url+'#game-settings'); await p.waitForTimeout(300);
    ok(await p.evaluate(()=>cur==='set'&&!location.hash),'#game-settings opens settings and clears the hash');
    ok(await p.evaluate(()=>!!$('#arcSet')&&!$('#langBtn')),'inside Arcade: an Arcade settings row; shared settings hidden');
    ok(await p.evaluate(()=>P.cb&&contrastOn()&&document.documentElement.classList.contains('dark')),'shared settings apply (colourblind → high contrast, dark)');
    await p.evaluate(()=>{ goHome(); }); ok(await p.evaluate(()=>!$('#arcadeBtn').hidden&&!!$('#settingsBtn')),'‹ Arcade button shows in Arcade mode');
    await p.evaluate(()=>{ S.setup={mode:'moves',board:'8',ne:5,obst:'off'}; startClassic(); const m=listSwaps(G.st)[0]; trySwap(m[0],m[1]); }); await p.waitForTimeout(3000); await p.evaluate(()=>{ persist(); writeSummary(); });
    const keys=await p.evaluate(()=>Object.keys(localStorage)); ok(keys.every(k=>k.startsWith('quintessence.')||k==='arcade.v1'||k==='arcade.summary.quintessence'),'only quintessence.* keys (plus the summary): '+keys.join(','));
    const sum=await p.evaluate(()=>JSON.parse(localStorage.getItem('arcade.summary.quintessence'))); ok(sum&&sum.game==='quintessence'&&sum.ach.length===55,'summary written');
    ok(!errs.length,'Arcade build: no page errors '+errs.join('; ')); await ctx.close(); }
  await b.close(); console.log(`\n${pass} passed, ${fail} failed in ${((Date.now()-t0)/1000).toFixed(0)} s`); process.exit(fail?1:0); })();
