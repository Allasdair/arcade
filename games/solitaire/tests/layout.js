// node tests/layout.js   (Playwright + Chrome; run python3 build.py first)
// No sideways scroll at 360 and 390 px in English and German on every screen and sheet; German shows no untranslated
// text; card corners readable in every court art and frame (4-colour and high-contrast too); the longest column fits;
// drag, tap, double-tap and stock tap; left-handed swaps the top row; Android back opens the pause menu.
const path=require('path');
let pw; try{ pw=require('playwright'); }catch(e){ pw=require('/opt/npm-tools/node_modules/playwright'); }
const FILE='file://'+path.join(__dirname,'..','dist','standalone.html');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  FAIL: '+m); } };
(async()=>{ const exe=['/usr/bin/google-chrome','/usr/bin/chromium'].find(f=>require('fs').existsSync(f));
  const b=await pw.chromium.launch(exe?{executablePath:exe}:{}); const t0=Date.now();
  async function page(w,lang){ const ctx=await b.newContext({viewport:{width:w,height:740},hasTouch:true,locale:lang==='de'?'de-DE':'en-US'});
    await ctx.addInitScript(l=>{ window.__i18nMiss=new Set(); if(l) localStorage.setItem('solitaire.v1',JSON.stringify({v:1,xp:0,lang:l,seenVer:'0.1.0'})); },lang==='de'?'de':'');
    const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); await p.goto(FILE); await p.waitForTimeout(250); return p; }
  const noSide=async(p,what)=>{ const r=await p.evaluate(()=>{ const bad=[]; const chk=el=>{ if(el&&el.scrollWidth>el.clientWidth+1) bad.push((el.id||el.className)+' '+el.scrollWidth+'>'+el.clientWidth); };
      chk(document.documentElement); $$('.screen.on .scroll').forEach(chk); if(sheetOn) chk($('#sheet')); $$('.screen.on .card, #sheet .srow, #sheet .goal, .screen.on .tcard').forEach(e=>{ if(e.scrollWidth>e.clientWidth+1) bad.push('el '+e.textContent.slice(0,30)); }); return bad; });
    ok(!r.length,`${what}: no sideways scroll ${r.join(', ')}`); };
  for(const w of [360,390]) for(const lang of ['en','de']){ const p=await page(w,lang), tag=`${w}px ${lang}`;
    const screens=[['home',()=>goHome()],['classic sheet',()=>openSetup()],['campaign',()=>{ closeSheet(); openCamp(0); }],['campaign 3',()=>{ S.campTab=2; renderCamp(); }],
      ['level sheet',()=>openLevel(LEVELS[9])],['daily sheet',()=>{ closeSheet(); openDaily(); }],['progress levels',()=>{ closeSheet(); openProgress('levels'); }],
      ['progress achievements',()=>openProgress('ach')],['progress records',()=>openProgress('rec')],
      ...['back','table','cards','piles','motion','sound'].map(k=>['style '+k,`()=>{ styleTab='${k}'; openStyle(); }`]),['settings',()=>openSettings()],['language',()=>openLang()],['backup',async()=>{ closeSheet(); await openBackup(); }],
      ['how to play',()=>{ closeSheet(); openHowto(); }],['what\'s new',()=>{ closeSheet(); openNews(); }],
      ['game',()=>{ closeSheet(); S.setup={draw:3,passes:3,open:true,grade:'any'}; startClassic(); }],['pause',()=>openPause()],['game campaign',()=>{ resume(); startLevel(LEVELS[6]); }],
      ['stuck sheet',()=>showStuck()],['banner',()=>{ closeSheet(); showBanner(`<b>${'This deal can\'t be won from here.'}</b><button>Undo</button>`); }],
      ['results',()=>{ hideBanner(); const st=G.st; G.over=false; showResults({won:true,stars:[1,1,0],fresh:[0],ach:['c1','s3'],recs:['Best time'],xp:{xp:30,before:1,after:2,rewards:rewardsAt(2),hints:1},camp:{finished:true}}); }],
      ['daily game',()=>{ closeSheet(); G=null; const d=todayStr(), dl=dailyDeal(d); startGame({mode:'daily',date:d,deal:dl,st:newGame(dealSeed(dl.n),{draw:dl.draw}),assisted:false,hints:0}); }]];
    for(const [name,fn] of screens){ await p.evaluate(`(${typeof fn==='string'?fn:fn.toString()})()`); await p.waitForTimeout(name.startsWith('game')||name==='daily game'?900:120); await noSide(p,`${tag} ${name}`); }
    if(lang==='de'){ const miss=await p.evaluate(()=>[...window.__i18nMiss].filter(t=>!/^[\d\s·:/+★☆%–—.,()?!-]+$/.test(t))); ok(!miss.length,`German: untranslated text: ${miss.slice(0,12).join(' | ')}`); }
    ok(!p.errs.length,`${tag}: no page errors ${p.errs.join('; ')}`); await p.context().close(); }
  // ---- card readability ----
  { const p=await page(360,'');
    for(const court of ['classic','minimal','botanical','pixel','constellation']) for(const frame of ['rounded','gilt','ink','shadow']) for(const [four,hc] of [[false,false],[true,false],[false,true]]){
      const r=await p.evaluate(([court,frame,four,hc])=>{ S.xp=99999; S.ach.c100=1; S.ach.puzzle=1; S.look.court=court; S.look.frame=frame; S.prefs.four=four; S.prefs.contrast=hc; S.prefs.large=false;
        if(!G){ S.setup={draw:1,passes:0,open:false,grade:'any'}; startClassic(); } else { buildTable(); layoutTable(); render(false); }
        let minH=99, cw=0; for(const c of [0,9,10,11,12,25,38,51]){ const el=EL.cards[c], b=el.querySelector('.cr b').getBoundingClientRect(), i=el.querySelector('.cr i').getBoundingClientRect(); minH=Math.min(minH,b.height,i.height); cw=el.getBoundingClientRect().width; }
        // the colours of the suits differ as required
        const col=s=>getComputedStyle(EL.cards[s*13+5].querySelector('.cr')).color; const cols=[0,1,2,3].map(col);
        return {minH,cw,cols}; },[court,frame,four,hc]);
      ok(r.minH>=11,`corner ≥ 11 px: ${court}/${frame}/${four?'4-colour':''}${hc?'contrast':''} (${r.minH.toFixed(1)} px)`);
      if(four) ok(new Set(r.cols).size===4,'4-colour suits: four colours'); else ok(r.cols[0]===r.cols[3]&&r.cols[1]===r.cols[2]&&r.cols[0]!==r.cols[1],'red and black'); }
    const cw=await p.evaluate(()=>EL.cards[0].getBoundingClientRect().width); ok(cw>=44&&cw<=52,`cards about 48 px wide at 360 px (${cw})`);
    // the longest possible column fits the screen height (6 face-down + K…A)
    const fit=await p.evaluate(()=>{ const st=G.st, run=[]; for(let r=12;r>=0;r--) run.push((r%2?1:0)*13+r); const used=new Set(run), rest=[]; for(let c=0;c<52;c++) if(!used.has(c)) rest.push(c);
      st.cols=[rest.slice(0,6).concat(run),[rest[6]],[rest[7]],[rest[8]],[rest[9]],[rest[10]],[rest[11]]]; st.down=[6,0,0,0,0,0,0]; st.deck=rest.slice(12); st.wp=0; st.f=[0,0,0,0]; render(false);
      const last=EL.cards[0].getBoundingClientRect(), w=$('#tableWrap').getBoundingClientRect(); return last.bottom<=w.bottom; });
    ok(fit,'the longest column fits the screen height'); await p.context().close(); }
  // ---- input ----
  { const p=await page(360,'');
    await p.evaluate(()=>{ S.setup={draw:1,passes:0,open:false,grade:'any'}; startClassic(); }); await p.waitForTimeout(1800);
    // a known position: a run to drag, a single card to tap, an Ace to double-tap, a stock to tap
    await p.evaluate(()=>{ const st=G.st; st.cols=[[12],[5*1+0*13+5,4+13],[10+26,9+13],[0+39],[6+26],[5+39],[]]; // [K♠],[6♠,5♥],[J♦,10♥],[A♣],[7♦],[6♣],[]
      st.cols=[[12],[5,17],[36,22],[39],[32],[44],[]]; st.down=[0,0,0,0,0,0,0]; const used=new Set(st.cols.flat()); st.deck=[...Array(52).keys()].filter(c=>!used.has(c)); st.wp=0; st.f=[0,0,0,0]; st.hist=[]; st.moves=0; render(false); });
    const box=async c=>p.evaluate(c=>{ const r=EL.cards[c].getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+6,w:r.width,h:r.height}; },c);
    const pile=async to=>p.evaluate(to=>{ const r=pileEl(to).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; },to);
    const drag=async(c,to)=>{ const a=await box(c), t=await pile(to); await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(a.x+8,a.y+8,{steps:2}); await p.mouse.move(t.x,t.y,{steps:8}); await p.mouse.up(); await p.waitForTimeout(350); };
    // single card: 6♣ (44) onto 7♦ (column 4)
    await drag(44,{k:'t',i:4}); ok(await p.evaluate(()=>G.st.cols[4].includes(44)),'drag a single card');
    // run: 6♠,5♥ (column 1) onto 7♦? 7♦ now covered; drag the 10♥… run J♦,10♥ (column 2) to the empty column is illegal (not a King)
    await drag(36,{k:'t',i:6}); ok(await p.evaluate(()=>G.st.cols[2].length===2&&G.st.cols[6].length===0),'an illegal drop slides back');
    // run drag: 6♠ 5♥ onto 7♦? use a fresh setup: put 7♥ on column 6
    await p.evaluate(()=>{ const st=G.st; st.cols[6]=[19]; render(false); }); // 7♥
    await drag(5,{k:'t',i:6}); ok(await p.evaluate(()=>G.st.cols[6].join()==='19,5,17'),'drag a run');
    // tap: the A♣ goes to its foundation
    const a=await box(39); await p.mouse.click(a.x,a.y); await p.waitForTimeout(400); ok(await p.evaluate(()=>G.st.f[3]===1),'tap sends an Ace up');
    // double-tap to foundation: 2♣? put 2♣ on top of column 3 (now empty) — use the waste instead: tap the stock
    const st0=await p.evaluate(()=>G.st.wp); const sr=await p.evaluate(()=>{ const r=EL.cards[G.st.deck[G.st.wp]].getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; });
    await p.mouse.click(sr.x,sr.y); await p.waitForTimeout(300); ok(await p.evaluate(w=>G.st.wp===w+1,st0),'stock tap');
    await p.evaluate(()=>{ const st=G.st; st.cols[3]=[40]; render(false); }); // 2♣
    const d2=await box(40); await p.mouse.dblclick(d2.x,d2.y); await p.waitForTimeout(400); ok(await p.evaluate(()=>G.st.f[3]===2&&G.st.cols[3].length===0),'double-tap sends to the foundation');
    // keyboard: U undoes
    const mv=await p.evaluate(()=>G.st.moves); await p.keyboard.press('u'); await p.waitForTimeout(200); ok(await p.evaluate(m=>G.st.moves===m+1&&G.st.f[3]===1,mv),'U undoes (and counts a move)');
    // left-handed swaps the top row
    const xs=await p.evaluate(()=>{ const a=EL.slots.stock.getBoundingClientRect().x, f=EL.slots.f0.getBoundingClientRect().x; S.lefty=true; refreshShared(); layoutTable(); render(false); const a2=EL.slots.stock.getBoundingClientRect().x, f2=EL.slots.f0.getBoundingClientRect().x; S.lefty=false; refreshShared(); layoutTable(); render(false); return [a<f,a2>f2]; });
    ok(xs[0]&&xs[1],'left-handed swaps the top row');
    // Android back opens the pause menu in a game
    await p.evaluate(()=>history.back()); await p.waitForTimeout(300); ok(await p.evaluate(()=>coverOn()),'Android back opens the pause menu');
    ok(!p.errs.length,'input: no page errors '+p.errs.join('; ')); await p.context().close(); }
  await b.close(); console.log(`\n${fail?'FAILED':'ok'}: ${pass} passed, ${fail} failed · ${((Date.now()-t0)/1000).toFixed(1)} s`); process.exit(fail?1:0); })();
