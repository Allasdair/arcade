// node tests/layout.js   (Playwright + Chrome; run python3 build.py first)   DUMP=1 lists every untranslated German text
// No sideways scroll at 360 and 390 px in English and German on every screen and sheet; German shows no untranslated
// text; cells ≥ 36 px on 9×9 at 360 px; every digit font distinct and givens distinct from player digits; notes
// readable; pad, digit-first, notes and keyboard input; Jigsaw borders visible in every theme; Android back opens the
// pause menu in a game.
const path=require('path'), fs=require('fs');
let pw; try{ pw=require('playwright'); }catch(e){ pw=require('/opt/npm-tools/node_modules/playwright'); }
const FILE='file://'+path.join(__dirname,'..','dist','standalone.html'), DUMP=!!process.env.DUMP;
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  FAIL: '+m); } };
(async()=>{ const exe=['/usr/bin/google-chrome','/usr/bin/chromium'].find(f=>fs.existsSync(f));
  const b=await pw.chromium.launch(exe?{executablePath:exe}:{}); const t0=Date.now(); const missAll=new Set();
  async function page(w,lang,h){ const ctx=await b.newContext({viewport:{width:w,height:h||740},hasTouch:true,locale:lang==='de'?'de-DE':'en-US'});
    await ctx.addInitScript(l=>{ window.__i18nMiss=new Set(); if(l) localStorage.setItem('sudoku.v1',JSON.stringify({v:1,xp:0,lang:l,seenVer:'0.1.0'})); },lang==='de'?'de':'');
    const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); await p.goto(FILE); await p.waitForTimeout(250); return p; }
  const noSide=async(p,what)=>{ const r=await p.evaluate(()=>{ const bad=[]; const chk=el=>{ if(el&&el.scrollWidth>el.clientWidth+1) bad.push((el.id||el.className)+' '+el.scrollWidth+'>'+el.clientWidth); };
      chk(document.documentElement); $$('.screen.on .scroll').forEach(chk); if(sheetOn) chk($('#sheet')); if(cur==='game'){ chk($('.gcol')); chk($('#pad')); }
      $$('.screen.on .card, #sheet .srow, #sheet .goal, .screen.on .tcard, #tools button').forEach(e=>{ if(e.scrollWidth>e.clientWidth+1) bad.push('el '+e.textContent.slice(0,30)); }); return bad; });
    ok(!r.length,`${what}: no sideways scroll ${r.join(', ')}`); };
  for(const w of [360,390]) for(const lang of ['en','de']){ const p=await page(w,lang), tag=`${w}px ${lang}`;
    const screens=[['home',()=>goHome()],['classic sheet',()=>openSetup()],['classic sheet mini',()=>{ S.setup.variant='mini'; closeSheet(); openSetup(); }],['campaign',()=>{ closeSheet(); openCamp(0); }],['campaign 2',()=>{ S.campTab=1; renderCamp(); }],['campaign 3',()=>{ S.campTab=2; renderCamp(); }],
      ['level sheet',()=>openLevel(LEVELS[9])],['level sheet twist',()=>{ closeSheet(); openLevel(LEVELS[6]); }],['level sheet X-Wing',()=>{ closeSheet(); openLevel(LEVELS[39]); }],['daily sheet',()=>{ closeSheet(); openDaily(); }],
      ['progress levels',()=>{ closeSheet(); openProgress('levels'); }],['progress achievements',()=>openProgress('ach')],['progress records',()=>openProgress('rec')],
      ...['theme','digits','hl','fx','sound'].map(k=>['style '+k,`()=>{ styleTab='${k}'; openStyle(); }`]),['settings',()=>openSettings()],['language',()=>openLang()],['backup',async()=>{ closeSheet(); await openBackup(); }],
      ['how to play',()=>{ closeSheet(); openHowto(); }],['what\'s new',()=>{ closeSheet(); openNews(); }],
      ['game',()=>{ closeSheet(); S.setup={variant:'jigsaw',grade:'expert'}; startClassic(); }],['pause',()=>openPause()],['game campaign',()=>{ resume(); startLevel(LEVELS[6]); }],
      ['hint banner',()=>{ S.hints=9; doHint(); }],['hint banner long',()=>{ clearHint(); showBanner('<b>'+esc('X-Wing on 4: in these 2 columns, 4 can only go in the same 2 rows, so it comes out of the rest of those rows.')+'</b><button>Apply</button><button class="ok2">OK</button>'); }],
      ['results',()=>{ clearHint(); G.over=false; showResults({won:true,stars:[1,1,0],fresh:[0],ach:['g_easy','wing'],recs:['Best time'],xp:{xp:30,before:1,after:2,rewards:rewardsAt(2),hints:1},camp:{finished:true}}); }],
      ['results lost',()=>{ closeSheet(); showResults({won:false,why:'limit',stars:[0,0,0],fresh:[],ach:[],recs:[]}); }],
      ['daily game',()=>{ closeSheet(); G=null; $('#hDaily')||goHome(); const d=todayStr(), dp=dailyPuzzle(d), info=puzzleInfo(dp); startGame({mode:'daily',date:d,p:Object.assign({},dp,{counts:info.counts}),st:newGame(Object.assign({},dp,{sol:info.sol}))}); }],
      ['daily pause',()=>openPause()],['mini game',()=>{ resume(); G=null; S.setup={variant:'mini',grade:'normal'}; startClassic(); }],['tech level',()=>{ G=null; startLevel(LEVELS[39]); }],['tech hint',()=>{ S.hints=9; doHint(); }],
      ['home with run',()=>{ clearHint(); leaveGame(); }]];
    for(const [name,fn] of screens){ await p.evaluate(`(${typeof fn==='string'?fn:fn.toString()})()`); await p.waitForTimeout(/game|level/.test(name)?700:120); await noSide(p,`${tag} ${name}`); }
    if(lang==='de'){ const miss=await p.evaluate(()=>[...window.__i18nMiss].filter(t=>!/^[\d\s·:/+★☆%–—.,()?!×-]+$/.test(t))); miss.forEach(m=>missAll.add(m)); ok(!miss.length,`German: untranslated text (${miss.length}): ${miss.slice(0,12).join(' | ')}`); }
    ok(!p.errs.length,`${tag}: no page errors ${p.errs.join('; ')}`); await p.context().close(); }
  // ---- every level tip, achievement, cosmetic description, toast and hint pattern has a German row ----
  { const p=await page(360,'de'); const r=await p.evaluate(()=>{ const miss=[], chk=t=>{ if(!DICT.has(t)&&T(t)===t&&/[A-Za-z]{3}/.test(t)) miss.push(t); };
      LEVELS.forEach(L=>chk(L.tip)); ACH.forEach(a=>{ chk(a.desc); if(a.reward) chk(a.reward); }); Object.values(COS_DESC).forEach(chk); COS_KINDS.forEach(([k,n])=>chk(n));
      Object.values(TWISTS).forEach(chk); Object.values(TECH_NAME).forEach(chk); Object.values(GRADE_DESC).forEach(chk); Object.values(VDESC).forEach(chk); VOPTS.forEach(o=>chk(o[1]));
      ['Tap a cell first','Notes are off on this level','Erase the digit first to add notes','Not quite: some digits clash. Look for the outlined cells.','Notes filled with every legal candidate','No hints left today. You get +1 for every level-up.','No hint needed: the grid is complete.','Digit locked: tap cells to place it. Tap it again to unlock.','Turn on Animations to see effects','Turn on Music in Settings to hear it','Clear the level before to unlock this one',"That code isn't a Sudoku backup",'Progress restored','Copied'].forEach(chk);
      for(let l=2;l<=10;l++) rewardsAt(l).forEach(chk); starUnlocks().forEach(u=>chk(u.text)); chk(STARTER);
      // hint texts from solving bank puzzles step by step: every technique and house wording
      const seen=new Set(); for(const v of VKEYS) for(const gr of gradesFor(v)){ const L=bankList(v,gr); for(let i=0;i<L.length;i+=15){ const p=L[i], st=newGame(Object.assign({},p,{sol:puzzleInfo(p).sol}));
        for(let k=0;k<200&&!st.won;k++){ const h=hintStep(st); if(!h) break; const key=h.text.replace(/\d/g,'#'); if(!seen.has(key)){ seen.add(key); chk(h.text); }
          if(h.place) place(st,h.place[0],h.place[1]); else setNotes(st,h.elim.map(([c,m])=>[c,(st.notes[c]||h.cand[c])&~m])); } } }
      const w=newGame(Object.assign({},bankList('classic','easy')[0],{sol:puzzleInfo(bankList('classic','easy')[0]).sol})), c=w.vals.indexOf(0); place(w,c,+w.sol[c]%9+1); chk(hintStep(w).text);
      return {miss,n:seen.size}; });
    ok(!r.miss.length,`German rows for every tip, achievement, cosmetic, toast and hint (${r.n} hint wordings): missing ${r.miss.slice(0,8).join(' | ')}`); await p.context().close(); }
  if(DUMP) fs.writeFileSync(path.join(require('os').tmpdir(),'sudoku_missing.json'),JSON.stringify([...missAll],null,1));
  // ---- cell size and readability ----
  { const p=await page(360,'');
    const r=await p.evaluate(()=>{ S.xp=99999; for(const id of ['wing','pencil']) S.ach[id]=1; S.setup={variant:'classic',grade:'easy'}; startClassic(); return 1; }); await p.waitForTimeout(900);
    const cs=await p.evaluate(()=>EL.cells[0].getBoundingClientRect().width); ok(cs>=36,`cells ≥ 36 px on 9×9 at 360 px (${cs})`);
    // every digit font draws a different 8, and givens differ from player digits in weight or colour (and cell tint)
    const shots=[], gp=[];
    for(const f of ['inter','mono','serif','rounded','hand']){ const info=await p.evaluate(f=>{ S.look.font=f; applyLook(); const st=G.st, c=st.vals.indexOf(0); st.vals[c]=8; buildBoard(); layoutBoard(); render(); sel=-1;
        const gc=st.givens.split('').findIndex(x=>x!=='0'), g=EL.cells[gc], pl=EL.cells[c], gs=getComputedStyle(g.querySelector('.v')), ps=getComputedStyle(pl.querySelector('.v'));
        const gsw=g.querySelector('svg')?getComputedStyle(g.querySelector('svg')).strokeWidth:'', psw=pl.querySelector('svg')?getComputedStyle(pl.querySelector('svg')).strokeWidth:'';
        const r=pl.querySelector('.v').getBoundingClientRect(); return {c,diff:gs.color!==ps.color&&(gs.fontWeight!==ps.fontWeight||gsw!==psw||getComputedStyle(g).backgroundColor!==getComputedStyle(pl).backgroundColor),h:r.height}; },f);
      await p.waitForTimeout(150); const el=await p.$(`.c[data-i="${info.c}"]`); shots.push((await el.screenshot()).toString('base64'));
      ok(info.diff,`${f}: givens and player digits look different`); ok(info.h>=16,`${f}: digits ≥ 16 px tall in a 37 px cell (${info.h.toFixed(1)})`); }
    ok(new Set(shots).size===5,'every digit font is distinct at this size');
    for(const ns of ['grid','corner','centre']){ const fs2=await p.evaluate(ns=>{ S.look.notes=ns; S.xp=99999; applyLook(); fillAll(); render(); const i=document.querySelector('.nt i'); return parseFloat(getComputedStyle(i).fontSize); },ns); ok(fs2>=8.5,`${ns} notes readable (${fs2.toFixed(1)} px)`); }
    // Jigsaw borders: thick lines contrast with the cells in every theme (and high contrast)
    const lum=hex=>{ if(hex.length===4) hex='#'+[...hex.slice(1)].map(x=>x+x).join(''); const n=parseInt(hex.slice(1),16), ch=[n>>16&255,n>>8&255,n&255].map(v=>{ v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); }); return .2126*ch[0]+.7152*ch[1]+.0722*ch[2]; };
    const th=await p.evaluate(()=>Object.assign({},THEMES,{contrast:CONTRAST}));
    for(const k in th){ const cell=th[k].cell.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi).pop(), a=lum(th[k].thick), bb=lum(cell), cr=(Math.max(a,bb)+.05)/(Math.min(a,bb)+.05); ok(cr>=3,`${k}: region borders contrast ${cr.toFixed(1)}:1 with the cells`); }
    const sw=await p.evaluate(()=>{ S.setup={variant:'jigsaw',grade:'easy'}; startClassic(); return 1; }); await p.waitForTimeout(900);
    const stroke=await p.evaluate(()=>+$('#bsvg path').getAttribute('stroke-width')); ok(stroke>=2.4,`Jigsaw borders are drawn ${stroke} px thick`);
    ok(!p.errs.length,'readability: no page errors '+p.errs.join('; ')); await p.context().close(); }
  // ---- input ----
  { const p=await page(360,'');
    await p.evaluate(()=>{ S.setup={variant:'classic',grade:'easy'}; S.prefs.check=true; startClassic(); }); await p.waitForTimeout(900);
    const em=await p.evaluate(()=>G.st.vals.indexOf(0)), sol=await p.evaluate(c=>+G.st.sol[c],em);
    const tapCell=async c=>{ const r=await p.evaluate(c=>{ const b=EL.cells[c].getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2}; },c); await p.mouse.click(r.x,r.y); };
    const tapPad=async d=>{ await p.click(`#digits button[data-d="${d}"]`); };
    // cell-first: tap a cell, then a digit
    await tapCell(em); await tapPad(sol); ok(await p.evaluate(c=>G.st.vals[c],em)===sol,'pad: tap a cell, then a digit');
    await p.click('#bUndo'); ok(await p.evaluate(c=>G.st.vals[c]===0,em),'Undo');
    // notes
    await p.click('#bNotes'); await tapCell(em); await tapPad(3); await tapPad(5); ok(await p.evaluate(c=>G.st.notes[c]===(4|16),em),'Notes mode adds pencil marks'); await p.click('#bNotes');
    await p.click('#bErase'); ok(await p.evaluate(c=>G.st.notes[c]===0,em),'Erase clears notes');
    // digit-first: long-press a digit to lock it, then tap cells
    const others=await p.evaluate(()=>{ const st=G.st, out=[]; for(let c=0;c<81&&out.length<2;c++) if(!st.vals[c]) out.push([c,+st.sol[c]]); return out; });
    const d0=others[0][1]; const pb=await (await p.$(`#digits button[data-d="${d0}"]`)).boundingBox();
    await p.mouse.move(pb.x+pb.width/2,pb.y+pb.height/2); await p.mouse.down(); await p.waitForTimeout(520); await p.mouse.up();
    ok(await p.evaluate(d=>lockD===d,d0),'long-press locks a digit');
    await tapCell(others[0][0]); ok(await p.evaluate(([c,d])=>G.st.vals[c]===d,others[0]),'digit-first: tapping a cell places the locked digit');
    await tapPad(d0); ok(await p.evaluate(()=>lockD===0),'tapping the locked digit unlocks it');
    await p.evaluate(()=>{ S.prefs.digitFirst=true; }); await tapPad(2); ok(await p.evaluate(()=>lockD===2),'digit-first setting: a short tap locks'); await tapPad(2); await p.evaluate(()=>{ S.prefs.digitFirst=false; });
    // keyboard: arrows move, digits place, Shift+digit notes, N toggles, Backspace erases, U undoes
    const c2=others[1][0]; await p.evaluate(c=>{ sel=c; render(); },c2); await p.keyboard.press('ArrowRight'); ok(await p.evaluate(c=>sel===(c%9===8?c-8:c+1),c2),'arrow keys move');
    await p.keyboard.press('ArrowLeft'); await p.keyboard.press(String(others[1][1])); ok(await p.evaluate(([c,d])=>G.st.vals[c]===d,others[1]),'a digit key places');
    await p.keyboard.press('Backspace'); ok(await p.evaluate(c=>G.st.vals[c]===0,c2),'Backspace erases');
    await p.keyboard.press('Shift+Digit7'); ok(await p.evaluate(c=>!!(G.st.notes[c]&64),c2),'Shift + digit adds a note');
    await p.keyboard.press('n'); ok(await p.evaluate(()=>notesMode),'N toggles notes'); await p.keyboard.press('n');
    await p.keyboard.press('u'); ok(await p.evaluate(c=>!(G.st.notes[c]&64),c2),'U undoes');
    // a wrong digit with mistake check on turns red and counts a mistake
    const wd=await p.evaluate(c=>+G.st.sol[c]%9+1,c2); await p.keyboard.press(String(wd)); ok(await p.evaluate(c=>EL.cells[c].classList.contains('bad')&&G.st.mistakes===1,c2),'a wrong digit turns red and counts');
    // landscape: the pad moves beside the board
    await p.setViewportSize({width:844,height:390}); await p.waitForTimeout(300);
    const land=await p.evaluate(()=>{ const b=$('#board').getBoundingClientRect(), pd=$('#pad').getBoundingClientRect(); return pd.left>=b.right-1&&b.bottom<=innerHeight; }); ok(land,'landscape: the pad sits beside the board');
    await p.setViewportSize({width:360,height:740}); await p.waitForTimeout(300);
    // Android back opens the pause menu in a game
    await p.evaluate(()=>history.back()); await p.waitForTimeout(300); ok(await p.evaluate(()=>coverOn()),'Android back opens the pause menu');
    ok(!p.errs.length,'input: no page errors '+p.errs.join('; ')); await p.context().close(); }
  // ---- Arcade build: settings hash, shared settings, summary ----
  { const ctx=await b.newContext({viewport:{width:360,height:740}}); const reqs=[];
    await ctx.addInitScript(()=>{ localStorage.setItem('arcade.v1',JSON.stringify({v:1,name:'Tester',set:{appearance:'dark',lang:'en',cb:true,music:false,sfx:false}})); window.__ARCADE__=1; });
    const p=await ctx.newPage(); p.on('request',r=>reqs.push(r.url())); await p.goto(FILE+'#game-settings'); await p.waitForTimeout(400);
    ok(await p.evaluate(()=>cur==='set'&&location.hash===''),'#game-settings opens settings and clears the hash');
    ok(await p.evaluate(()=>!!$('#arcSet')&&!$('#langBtn')),'inside Arcade: an Arcade settings row; shared settings hidden');
    ok(await p.evaluate(()=>document.body.classList.contains('dark')&&contrastOn()),'shared appearance and colourblind (high contrast) applied');
    await p.evaluate(()=>{ goHome(); }); ok(await p.evaluate(()=>!$('#arcadeBtn').hidden),'the ‹ Arcade button shows inside Arcade');
    const keys=await p.evaluate(()=>{ persist(); writeSummary(); return Object.keys(localStorage); }); ok(keys.every(k=>k.startsWith('sudoku.')||k==='arcade.v1'||k==='arcade.summary.sudoku'),'only sudoku.* keys (plus the summary) are written: '+keys.join(', '));
    const sum=await p.evaluate(()=>JSON.parse(localStorage.getItem('arcade.summary.sudoku'))); ok(sum&&sum.game==='sudoku'&&sum.maxLevel===10,'the summary is written');
    ok(reqs.every(u=>u.startsWith('file:')||u.startsWith('data:')),'no outside requests');
    await ctx.close(); }
  await b.close(); console.log(`\n${fail?'FAILED':'ok'}: ${pass} passed, ${fail} failed · ${((Date.now()-t0)/1000).toFixed(1)} s`); process.exit(fail?1:0); })();
