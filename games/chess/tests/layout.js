// node tests/layout.js   (Playwright + Chrome; run python3 build.py first)   DUMP=1 lists every untranslated German text
// No sideways scroll at 360 and 390 px in English and German on every screen and sheet; German shows no untranslated
// text; squares ≥ 44 px at 360 px; pieces distinguishable in every set (also in grayscale); tap-tap and drag; the
// promotion sheet; move-list navigation; flip; player bars with avatars and long names fit at 360 px; Android back
// opens the pause menu; the Arcade build (avatars, #game-settings, shared settings, only chess.* keys, summary).
const path=require('path'), fs=require('fs');
let pw; try{ pw=require('playwright'); }catch(e){ pw=require('/opt/npm-tools/node_modules/playwright'); }
const DIST=path.join(__dirname,'..','dist'), FILE='file://'+path.join(DIST,'standalone.html'), DUMP=!!process.env.DUMP;
const AVATARS=['/home/claude/ref/arcade/web/avatars.js',path.join(__dirname,'..','..','arcade','web','avatars.js'),path.join(__dirname,'..','..','..','web','avatars.js'),process.env.AVATARS||''].find(f=>f&&fs.existsSync(f));
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  FAIL: '+m); } };
(async()=>{ const exe=['/usr/bin/google-chrome','/usr/bin/chromium'].find(f=>fs.existsSync(f));
  const b=await pw.chromium.launch(exe?{executablePath:exe}:{}); const t0=Date.now(); const missAll=new Set();
  async function page(w,lang,h,url){ const ctx=await b.newContext({viewport:{width:w,height:h||740},hasTouch:true,locale:lang==='de'?'de-DE':'en-US'});
    await ctx.addInitScript(l=>{ window.__i18nMiss=new Set(); if(l) localStorage.setItem('chess.v1',JSON.stringify({v:1,xp:0,lang:l,seenVer:'0.1.0'})); },lang==='de'?'de':'');
    const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); await p.goto(url||FILE); await p.waitForTimeout(250); return p; }
  const noSide=async(p,what)=>{ const r=await p.evaluate(()=>{ const bad=[]; const chk=el=>{ if(el&&el.scrollWidth>el.clientWidth+1) bad.push((el.id||el.className)+' '+el.scrollWidth+'>'+el.clientWidth); };
      chk(document.documentElement); $$('.screen.on .scroll').forEach(chk); if(sheetOn) chk($('#sheet')); if(cur==='game'){ chk($('.gcol')); chk($('#side')); $$('.pbar').forEach(chk); }
      $$('.screen.on .card, #sheet .srow, #sheet .goal, .screen.on .tcard, #tools button, .pbar .nm').forEach(e=>{ if(e.scrollWidth>e.clientWidth+1&&!e.classList.contains('nm')) bad.push('el '+e.textContent.slice(0,30)); }); return bad; });
    ok(!r.length,`${what}: no sideways scroll ${r.join(', ')}`); };
  for(const w of [360,390]) for(const lang of ['en','de']){ const p=await page(w,lang), tag=`${w}px ${lang}`;
    const screens=[['home',()=>goHome()],['play sheet',()=>openSetup()],['puzzle sheet',()=>{ closeSheet(); openPuzSetup(); }],['puzzle sheet theme',()=>{ closeSheet(); S.puz.by='theme'; openPuzSetup(); }],['puzzle sheet streak',()=>{ closeSheet(); S.puz.by='streak'; openPuzSetup(); }],
      ['campaign',()=>{ closeSheet(); openCamp(0); }],['campaign 2',()=>{ S.campTab=1; renderCamp(); }],['campaign 3',()=>{ S.campTab=2; renderCamp(); }],
      ['level sheet set',()=>openLevel(LEVELS[0])],['level sheet drill',()=>{ closeSheet(); openLevel(LEVELS[3]); }],['level sheet tech',()=>{ closeSheet(); openLevel(LEVELS[24]); }],['level sheet hold',()=>{ closeSheet(); openLevel(levelById('q12')); }],['level sheet twist',()=>{ closeSheet(); openLevel(levelById('q14')); }],
      ['daily sheet',()=>{ closeSheet(); openDaily(); }],['2-player',()=>{ closeSheet(); openTp(); }],['2-player new',()=>tpSetup('code')],['2-player local',()=>{ closeSheet(); tpSetup('local'); }],['paste code',()=>{ closeSheet(); tpPaste(); }],
      ['progress levels',()=>{ closeSheet(); openProgress('levels'); }],['progress achievements',()=>openProgress('ach')],['progress records',()=>openProgress('rec')],
      ...['pieces','board','fx','sound'].map(k=>['style '+k,`()=>{ styleTab='${k}'; openStyle(); }`]),['settings',()=>openSettings()],['language',()=>openLang()],['backup',async()=>{ closeSheet(); await openBackup(); }],
      ['how to play',()=>{ closeSheet(); openHowto(); }],['what\'s new',()=>{ closeSheet(); openNews(); }],['about',()=>{ closeSheet(); openAbout(); }],
      ['game',()=>{ closeSheet(); S.setup={level:4,colour:'white',clock:'5+3',start:'standard'}; startClassic(); }],['pause',()=>openPause()],
      ['promotion sheet',()=>{ resume(); G.g=gameNew({fen:'8/4P1k1/8/8/8/8/8/4K3 w - - 0 1'}); G.pos=posAt(G.g); G.sans=[]; G.st0=null; render(); tryMove(parseSq('e7'),parseSq('e8')); }],
      ['hint banner',()=>{ closeSheet(); showBanner('<b>'+esc(TF('Best move: {0}','Nxf7+'))+'</b><button class="ok2">OK</button>'); }],
      ['results',()=>{ hideBanner(); showResults({won:true,outcome:'win',reason:'checkmate',stars:[1,1,0],fresh:[0],pendingAcc:true,ach:['beat4','smother'],recs:['Longest win streak'],xp:{xp:25,before:1,after:2,rewards:rewardsAt(2),hints:1}}); }],
      ['results lost',()=>{ closeSheet(); showResults({won:false,draw:false,reason:'time',stars:[0,0,0],fresh:[],ach:[],recs:[]}); }],
      ['puzzle game',()=>{ closeSheet(); G=null; S.run=null; S.puz={by:'band',band:'normal'}; startPuzzle(); }],['puzzle results',()=>{ showPuzzleResults({solved:true,stars:[1,1,1],fresh:[],ach:['p10'],xp:{xp:2,before:1,after:1,rewards:[],hints:0}}); }],
      ['campaign set',()=>{ closeSheet(); G=null; startLevel(LEVELS[1]); }],['campaign drill',()=>{ leaveGame(); startLevel(levelById('q4')); }],
      ['daily game',()=>{ leaveGame(); openDaily(); $('#dGo').click(); }],['daily pause',()=>openPause()],
      ['2-player game',()=>{ resume(); leaveGame(); tpSetup('code'); $('#n1').value='Alexandrina Montgomery'; $('#tGo').click(); }],['send code',()=>{ humanMove(fromUci(G.pos,'e2e4')); }],
      ['pass-and-play',()=>{ closeSheet(); G=null; tpSetup('local'); $('#n1').value='Bartholomew Featherstonehaugh'; $('#n2').value='Wilhelmina Ottoline'; $('#tGo').click(); }],
      ['analysis',()=>{ $('#cover').classList.remove('on'); leaveGame(); const e={id:'t1',mode:'classic',colour:0,g:{start:START_FEN,moves:['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6'],c960:-1},won:false,evals:[],done:false}; queueAnalysis(S,e); openAnalysis('t1'); }],
      ['home with run',()=>{ leaveGame(); }]];
    for(const [name,fn] of screens){ await p.evaluate(`(${typeof fn==='string'?fn:fn.toString()})()`); await p.waitForTimeout(/game|level|analysis|play/.test(name)?600:120); await noSide(p,`${tag} ${name}`); }
    if(lang==='de'){ await p.waitForTimeout(3500); await p.evaluate(()=>{ if(G&&G.review){ goPly(3); } }); await p.waitForTimeout(200);
      const miss=await p.evaluate(()=>[...window.__i18nMiss].filter(t=>!/^[\d\s·:/+★☆%–—.,()?!×#\-…]+$/.test(t)&&!/^[KQRBN]?[a-h]?x?[a-h][1-8]|^O-O/.test(t))); miss.forEach(m=>missAll.add(m)); ok(!miss.length,`German: untranslated text (${miss.length}): ${miss.slice(0,12).join(' | ')}`); }
    ok(!p.errs.length,`${tag}: no page errors ${p.errs.join('; ')}`); await p.context().close(); }
  // ---- every level tip, achievement, cosmetic, toast, result and twist has a German row ----
  { const p=await page(360,'de'); const r=await p.evaluate(()=>{ const miss=[], chk=t=>{ if(t&&!DICT.has(t)&&T(t)===t&&!known(t)&&/[A-Za-z]{3}/.test(t)) miss.push(t); };
      LEVELS.forEach(L=>{ chk(L.tip); levelStarText(L).forEach(chk); }); ACH.forEach(a=>{ chk(a.desc); if(a.reward) chk(a.reward); }); Object.values(COS_DESC).forEach(chk); COS_KINDS.forEach(([k,n])=>chk(n));
      Object.values(TWISTS).forEach(chk); Object.values(TYPE_NAME).forEach(chk); Object.values(RESULT_TEXT).forEach(chk); PUZ_THEME_UI.forEach(t=>chk(t[1])); PUZ_BANDS.forEach(b=>chk(b[1])); CAMPS.forEach(c=>chk(c.name));
      ['Move taken back (an assist)','No hints left today. You get +1 for every level-up.','The computer declines the draw','You offer a draw…','Not the best move: try again','This piece moves','Waiting for your friend\'s move','Tap again to delete this game','Game deleted','Copied','Your next move will offer a draw','Clear the level before to unlock this one','Turn on Animations to see effects','Turn on Music in Settings to hear it','No puzzles in that group','Progress restored','That code isn\'t a Chess backup','Copied: paste it to your friend','Copied to the clipboard','Not a legal move: {0}','Analysis ready: {0}% accuracy','Analysing your last game… {0}%',
       'No Chess code found in that text','That code is damaged. Ask for it again.','You deleted that game','That code has a move that isn\'t allowed','That code is older than your game','You already have that move','It isn\'t your turn in that game yet','That code didn\'t work'].forEach(chk);
      for(let l=2;l<=10;l++) rewardsAt(l).forEach(chk); starUnlocks().forEach(u=>chk(u.text)); chk(STARTER);
      ['best','good','inaccuracy','mistake','blunder'].forEach(c=>chk(c[0].toUpperCase()+c.slice(1))); return miss; });
    r.forEach(m=>missAll.add(m)); ok(!r.length,`German rows for every tip, achievement, cosmetic and message (${r.length} missing): ${r.slice(0,8).join(' | ')}`); await p.context().close(); }
  if(DUMP) fs.writeFileSync('/tmp/i18n_missing.json',JSON.stringify([...missAll],null,1));

  // ---- the board: square size, readable pieces, input ----
  { const p=await page(360,'en');
    await p.evaluate(()=>{ S.setup={level:1,colour:'white',clock:'none',start:'standard'}; S.prefs.delay=false; startClassic(); }); await p.waitForTimeout(500);
    const cs=await p.evaluate(()=>LY.cs); ok(cs>=44,`squares ${cs} px at 360 px (≥ 44)`);
    // every piece set: pieces distinguishable, also in grayscale (rendered and compared pixel by pixel)
    for(const set of PSETS_LIST){ const d=await p.evaluate(async set=>{ const sz=48, cv=document.createElement('canvas'); cv.width=sz; cv.height=sz; const g=cv.getContext('2d'); const out={};
        for(const c of [0,1]) for(const t of 'KQRBNP'){ const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 100 100">${set==='glass'?GLASS_DEFS:''}${pieceBody(set,t,c===1)}</svg>`;
          const im=new Image(); im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg); await im.decode(); g.fillStyle='#a97a52'; g.fillRect(0,0,sz,sz); g.drawImage(im,0,0); const px=g.getImageData(0,0,sz,sz).data, gray=[];
          for(let i=0;i<px.length;i+=4) gray.push(Math.round(px[i]*.3+px[i+1]*.59+px[i+2]*.11)); out[(c?'b':'w')+t]=gray; }
        const keys=Object.keys(out); let minD=1e9, pair=''; for(let i=0;i<keys.length;i++) for(let j=i+1;j<keys.length;j++){ let s=0; const A=out[keys[i]], B=out[keys[j]]; for(let k=0;k<A.length;k++) s+=Math.abs(A[k]-B[k]); const dd=s/A.length; if(dd<minD){ minD=dd; pair=keys[i]+'/'+keys[j]; } }
        return {minD,pair}; },set); ok(d.minD>=3,`${set} pieces distinguishable in grayscale (closest ${d.pair}: ${d.minD.toFixed(1)})`); }
    const at=async(sq)=>p.evaluate(s=>{ const r=$('#boardWrap').getBoundingClientRect(), [x,y]=sqXY(parseSq(s)); return {x:r.left+x+LY.cs/2,y:r.top+y+LY.cs/2}; },sq);
    let a=await at('e2'), z=await at('e4'); await p.mouse.click(a.x,a.y); await p.waitForTimeout(80);
    ok(await p.evaluate(()=>$$('.sq.tgt').length===2),'tap shows two legal targets for e2'); await p.mouse.click(z.x,z.y); await p.waitForTimeout(1600);
    ok(await p.evaluate(()=>G.g.moves[0]==='e2e4'&&G.g.moves.length===2),'tap-tap plays e4 and the computer replies');
    a=await at('g1'); z=await at('f3'); await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(a.x+10,a.y-10,{steps:3}); await p.mouse.move(z.x,z.y,{steps:6}); await p.mouse.up(); await p.waitForTimeout(1600);
    ok(await p.evaluate(()=>G.g.moves[2]==='g1f3'),'drag plays Nf3');
    await p.evaluate(()=>goPly(1)); ok(await p.evaluate(()=>viewPly===1&&!$('#banner').hidden),'move list: tap a move to view it'); await p.evaluate(()=>$('#bkGame').click()); ok(await p.evaluate(()=>viewPly===null),'back to game');
    await p.evaluate(()=>$('#bPrev').click()); ok(await p.evaluate(()=>viewPly===G.g.moves.length-1),'◀ steps back'); await p.evaluate(()=>{ $('#bNext').click(); });
    const f0=await p.evaluate(()=>flip); await p.evaluate(()=>$('#bFlip').click()); ok(await p.evaluate(f=>flip!==f,f0),'flip board');
    await p.evaluate(()=>$('#bFlip').click());
    await p.evaluate(()=>{ G.g=gameNew({fen:'8/4P1k1/8/8/8/8/8/4K3 w - - 0 1'}); G.pos=posAt(G.g); G.sans=[]; G.st0=null; render(); tryMove(parseSq('e7'),parseSq('e8')); });
    ok(await p.evaluate(()=>$$('#sheet .prom button').length===4),'promotion sheet offers four pieces'); await p.evaluate(()=>$$('#sheet .prom button')[3].click()); await p.waitForTimeout(200);
    ok(await p.evaluate(()=>G.g.moves[0]==='e7e8n'),'promote to a knight');
    await p.evaluate(()=>{ cancelFg(); G.thinking=false; G.over=false; G.g=gameNew(); G.pos=posAt(G.g); G.sans=[]; G.st0=null; render(); }); await p.keyboard.type('Nf3'); await p.keyboard.press('Enter'); await p.waitForTimeout(150); ok(await p.evaluate(()=>G.g.moves[0]==='g1f3'),'keyboard: type Nf3 and Enter');
    await p.goBack().catch(()=>{}); await p.waitForTimeout(200); ok(await p.evaluate(()=>coverOn()&&cur==='game'),'Android back opens the pause menu in a game');
    ok(!p.errs.length,`board page: no errors ${p.errs.join('; ')}`); await p.context().close(); }

  // ---- the Arcade build: avatars, shared settings, keys, summary, #game-settings ----
  if(AVATARS){ const arc=path.join(DIST,'arcade-test'); fs.mkdirSync(path.join(arc,'chess'),{recursive:true}); fs.copyFileSync(path.join(DIST,'chess','index.html'),path.join(arc,'chess','index.html')); fs.copyFileSync(AVATARS,path.join(arc,'avatars.js')); fs.writeFileSync(path.join(arc,'fonts.css'),'');
    let html=fs.readFileSync(path.join(arc,'chess','index.html'),'utf8'); html=html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,''); /* file:// pages can't satisfy 'self' for the extra script; CSP is checked in tests/run.js */ if(!html.includes('<script src="../avatars.js">')) html=html.replace('<script>window.__ARCADE__=1</script>','<script>window.__ARCADE__=1</script><script src="../avatars.js"></script>'); fs.writeFileSync(path.join(arc,'chess','index.html'),html);
    const ctx=await b.newContext({viewport:{width:360,height:740},hasTouch:true}); const reqs=[];
    await ctx.addInitScript(()=>{ localStorage.setItem('arcade.v1',JSON.stringify({v:1,set:{appearance:'dark',sfx:false,music:false,cb:true,lang:'en',motion:false},name:'Zoe',avatar:'mine'})); });
    const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('request',r=>{ if(!r.url().startsWith('file:')) reqs.push(r.url()); });
    await p.goto('file://'+path.join(arc,'chess','index.html')+'#game-settings'); await p.waitForTimeout(400);
    ok(await p.evaluate(()=>cur==='set'&&location.hash===''),'#game-settings opens settings and clears the hash'); ok(await p.evaluate(()=>!!$('#arcSet')),'Arcade settings row'); ok(await p.evaluate(()=>!$('#langBtn')),'shared settings hidden inside the Arcade');
    ok(await p.evaluate(()=>P.appearance==='dark'&&P.cb===true&&P.name==='Zoe'&&contrastOn()),'shared settings from arcade.v1 (colourblind turns on high contrast)');
    ok(await p.evaluate(()=>!!window.ArcadeAvatars&&avOn()&&myAv()===3),'ArcadeAvatars loaded; my avatar 3');
    await p.evaluate(()=>{ goHome(); }); ok(await p.evaluate(()=>!$('#arcadeBtn').hidden),'‹ Arcade button shown');
    // a code from another player shows their avatar; the reply carries both
    const code=await p.evaluate(()=>encodeGame({id:[9,9,9,9,9,9],c960:-1,p0black:false,names:['Kai',''],avs:[5,0],moves:['d2d4'],end:0,offer:false}));
    await p.evaluate(c=>{ openTp(); tpImport(c); },code); await p.waitForTimeout(150); ok(await p.evaluate(()=>$$('#sheet .av').length>=1),'"Join Kai\'s game" sheet shows Kai\'s avatar');
    await p.evaluate(()=>{ $('#n2').value='Zoe'; $('#jGo').click(); }); await p.waitForTimeout(300);
    ok(await p.evaluate(()=>$$('#pbTop .av, #pbBot .av').length===2),'both player bars show avatars');
    await p.evaluate(()=>humanMove(fromUci(G.pos,'d7d5'))); await p.waitForTimeout(300); const reply=await p.evaluate(()=>$('#tpCode').value);
    ok(await p.evaluate(c=>JSON.stringify(decodeGame(c).avs)==='[5,3]',reply),'the reply carries both avatars (5, 3)');
    await p.evaluate(()=>{ closeSheet(); G=null; openTp(); }); ok(await p.evaluate(()=>$$('#tpBody .av').length>=1),'games list shows the opponent\'s avatar');
    await p.evaluate(()=>{ tpSetup('local'); }); ok(await p.evaluate(()=>$$('#sheet .avpick button').length>1),'pass-and-play: Player 2\'s avatar picker');
    await p.evaluate(()=>{ $$('#sheet [data-av2]')[2].click(); $('#tGo').click(); humanMove(fromUci(G.pos,'e2e4')); saveGame(); leaveGame(); openTpGame(S.tp.games.find(g=>g.mode==='local')); }); await p.waitForTimeout(300);
    ok(await p.evaluate(()=>coverOn()&&$$('#cover .av').length===1),'"Pass to…" cover shows the avatar');
    await p.evaluate(()=>{ $('#cover').classList.remove('on'); leaveGame(); persist(); writeSummary(); });
    const keys=await p.evaluate(()=>Object.keys(localStorage)); ok(keys.every(k=>k.startsWith('chess.')||k==='arcade.v1'||k==='arcade.summary.chess'),`only chess.* keys written (${keys.join(', ')})`);
    const sm=await p.evaluate(()=>JSON.parse(localStorage.getItem('arcade.summary.chess'))); ok(sm&&sm.game==='chess'&&sm.maxLevel===10&&sm.hi.length===3,'summary written');
    ok(await p.evaluate(()=>localStorage.getItem('arcade.v1').includes('"Zoe"')&&!localStorage.getItem('arcade.v1').includes('chess')),'arcade.v1 never written');
    ok(!reqs.length,`no outside requests ${reqs.join(', ')}`); ok(!p.errs.length,`Arcade page: no errors ${p.errs.join('; ')}`); await ctx.close();
    // standalone: no avatars, nothing breaks
    const q=await page(360,'en'); await q.evaluate(c=>{ openTp(); tpImport(c); },code); await q.waitForTimeout(150); ok(await q.evaluate(()=>!$$('#sheet .av').length),'standalone: no avatars');
    ok(!q.errs.length,'standalone avatars: no errors'); await q.context().close(); fs.rmSync(arc,{recursive:true}); }
  else console.log('  (avatars.js not found: Arcade avatar checks skipped; set AVATARS=/path/to/arcade/web/avatars.js)');
  console.log(`\n${pass} passed, ${fail} failed (${((Date.now()-t0)/1000).toFixed(1)} s)`); await b.close(); if(fail) process.exit(1); })();
const PSETS_LIST=['classic','minimal','flat','pixel','glass','medieval','letter'];
