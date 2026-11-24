// node tests/layout.js   (Playwright + Chrome; run python3 build.py first)
const {chromium}=require('playwright'); const path=require('path'), fs=require('fs');
const DIST=path.join(__dirname,'..','dist'); let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  FAIL: '+m); } };
const url=f=>'file://'+path.join(DIST,f);
const exe=['/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>fs.existsSync(p));
const SEEN={seenVer:'0.1.0',howto:true,prefs:{place:'both',zoom:false,think:false,confirm:false,history:false}};
async function page(b,o){ o=o||{}; const vp=o.vp||{width:390,height:844}; const ctx=await b.newContext({viewport:vp,hasTouch:o.touch!==false,isMobile:o.touch!==false&&vp.width<600,deviceScaleFactor:2});
  const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error'&&!(/ERR_FILE_NOT_FOUND/.test(m.text())&&(o.file||'').startsWith('tilecraft/'))) p.errs.push(m.text()); }); // ../fonts.css only exists inside the Arcade
  p.reqs=[]; p.on('request',r=>p.reqs.push(r.url())); p.on('requestfailed',r=>{ if(/fonts\.css$/.test(r.url())) p.fontsMissing=true; });
  // seed storage once per context (a localStorage marker: Chrome can drop sessionStorage across file:// reloads)
  await p.addInitScript(o=>{ window.__i18nMiss=new Set(); if(localStorage.getItem('__seeded')) return; localStorage.clear(); localStorage.setItem('__seeded','1'); if(o.save) localStorage.setItem('tilecraft.v1',JSON.stringify(o.save)); if(o.arcade) localStorage.setItem('arcade.v1',JSON.stringify(o.arcade)); },{save:o.save===undefined?SEEN:o.save,arcade:o.arcade||null});
  await p.goto(url(o.file||'standalone.html')+(o.hash||'')); await p.waitForTimeout(250); return p; }
const noSide=async(p,what)=>{ const w=await p.evaluate(()=>{ const els=[document.documentElement,document.body,...document.querySelectorAll('.screen.on .scroll,#sheet,.screen.on')]; return Math.max(...els.map(e=>e.scrollWidth-e.clientWidth)); }); ok(w<=1,`${what}: no sideways scroll (${w}px)`); };
const ev=(p,fn,arg)=>p.evaluate(fn,arg);
async function screens(p,tag){ const vis=async(name,fn)=>{ await fn(); await p.waitForTimeout(140); await noSide(p,`${tag} ${name}`); };
  await vis('home',async()=>{});
  await vis('classic sheet',()=>p.click('#hClassic')); await ev(p,()=>closeSheet());
  await vis('campaign',()=>p.click('#hCamp')); for(const c of [1,2,0]) await vis('campaign tab '+c,()=>p.click(`[data-ct="${c}"]`));
  await vis('level sheet',()=>p.click('[data-lv="A1"]')); await ev(p,()=>goHome());
  await vis('daily sheet',()=>p.click('#hDaily')); await ev(p,()=>closeSheet());
  await vis('2-player list',()=>p.click('#hTp')); await vis('new 2-player game',()=>p.click('#tNew')); await ev(p,()=>closeSheet());
  await vis('pass-and-play sheet',()=>p.click('#tLocal')); await ev(p,()=>closeSheet()); await vis('paste sheet',()=>p.click('#tPaste')); await ev(p,()=>goHome());
  for(const t of ['levels','ach','rec']) await vis('progress '+t,()=>ev(p,t=>openProgress(t),t));
  await ev(p,()=>openStyle()); for(const t of ['tile','board','font','fx','sound']) await vis('style '+t,()=>p.click(`[data-tab="${t}"]`));
  for(const [n,fn] of [['settings',()=>openSettings()],['how to play',()=>openHowto()],['what\'s new',()=>openNews()],['about',()=>openAbout()],['language',()=>openLang()],['name',()=>openName()]]){ await vis(n,()=>ev(p,fn)); await ev(p,()=>closeSheet()); }
  await vis('backup',()=>ev(p,()=>openBackup())); await ev(p,()=>goHome());
  await vis('game',()=>ev(p,()=>startGame({mode:'classic'},newGame({size:'large',boardSeed:3,bagSeed:4,mods:{timer:60},players:[{name:'You',ai:null},{name:'Expert',ai:'expert'}],first:0}))));
  await vis('pause',()=>ev(p,()=>openPause())); await vis('history',()=>ev(p,()=>openHistory())); await ev(p,()=>closeSheet());
  await vis('swap mode',()=>p.click('#bSwap')); await p.click('#bSwap');
  await vis('blank sheet',()=>ev(p,()=>{ G.view[0]='?'; render(); placeTile(0,G.st.cfg?boardOf(G.st.cfg).start:0); })); await ev(p,()=>{ closeSheet(); });
  await vis('results',()=>ev(p,()=>{ recallAll(true); const st=G.st; for(let i=0;i<6;i++) applyMove(st,{t:'-'}); finishGame(); })); await ev(p,()=>{ sheetClose=null; closeSheet(); goHome(); }); }

(async()=>{ const b=await chromium.launch({executablePath:exe}); const t0=Date.now();
  for(const w of [360,390]) for(const lang of ['en','de']){ const p=await page(b,{vp:{width:w,height:780},save:Object.assign({},SEEN,{lang})}); await screens(p,`${w}px ${lang}`);
    ok(!p.errs.length,`${w}px ${lang}: no page errors ${p.errs.join(' | ')}`);
    if(lang==='de'&&w===390){ const miss=await ev(p,()=>[...window.__i18nMiss].filter(t=>!/^[\d\s.,:/×·—★☆+%()…–-]+$/.test(t)&&!/^[A-Z?]$/.test(t))); console.log(`  (German: ${miss.length} untranslated strings seen${miss.length?': '+miss.slice(0,60).join(' | '):''})`); ok(miss.length===0,'German: every string seen is translated'); }
    await p.close(); }

  // placing tiles: tap, drag, blank sheet, Recall, Shuffle (touch)
  { const p=await page(b); await ev(p,()=>startGame({mode:'classic'},newGame({size:'medium',boardSeed:7,bagSeed:9,players:[{name:'You',ai:null},{name:'Easy',ai:'easy'}],first:0}))); await p.waitForTimeout(200);
    const cellXY=i=>ev(p,i=>{ const r=G.cellEls[i].getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; },i);
    const rackXY=k=>ev(p,k=>{ const r=document.querySelector(`.rt[data-k="${k}"]`).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; },k);
    const best=await ev(p,()=>{ const m=sortMoves(allMoves(G.st,G.st.racks[0]))[0]; return moveTiles(G.st,m); });
    // tap a rack tile, then a square
    const k0=await ev(p,ch=>G.view.indexOf(ch),best[0][1]); let a=await rackXY(k0); await p.touchscreen.tap(a.x,a.y); await p.waitForTimeout(60);
    ok(await ev(p,k=>G.sel===k,k0),'tap selects a rack tile'); let c=await cellXY(best[0][0]); await p.touchscreen.tap(c.x,c.y); await p.waitForTimeout(80);
    ok(await ev(p,i=>G.pend.has(i),best[0][0]),'tap a square places the selected tile');
    // drag the next tile from the rack (pointer events, as a finger would)
    const drag=async(from,to)=>{ await ev(p,([f,t])=>{ const el=document.elementFromPoint(f.x,f.y); const mk=(type,x,y)=>el.dispatchEvent(new PointerEvent(type,{pointerId:7,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,bubbles:true,cancelable:true}));
      mk('pointerdown',f.x,f.y); for(let i=1;i<=8;i++) window.dispatchEvent(new PointerEvent('pointermove',{pointerId:7,pointerType:'touch',clientX:f.x+(t.x-f.x)*i/8,clientY:f.y+(t.y-f.y)*i/8,bubbles:true}));
      window.dispatchEvent(new PointerEvent('pointerup',{pointerId:7,pointerType:'touch',clientX:t.x,clientY:t.y,bubbles:true})); },[from,to]); await p.waitForTimeout(80); };
    for(const [i,ch] of best.slice(1)){ const k=await ev(p,ch=>{ const used=new Set([...G.pend.values()].map(v=>v.k)); return G.view.findIndex((t,k)=>!used.has(k)&&t===ch); },ch); await drag(await rackXY(k),await cellXY(i)); }
    ok(await ev(p,n=>G.pend.size===n&&G.eval&&G.eval.ok,best.length),'drag from the rack places tiles; the word line shows a valid move');
    ok(await ev(p,()=>!document.querySelector('#bPlay').disabled&&/✓/.test(document.querySelector('#wl').textContent)),'Play is enabled and the word line shows ✓ and the score');
    // drag a placed tile to another square, then back to the rack
    const moved=best[best.length-1][0]; const free=await ev(p,()=>{ const B=boardOf(G.st.cfg); for(let i=0;i<B.N;i++) if(!G.st.cells[i]&&!G.pend.has(i)&&i%15<12&&i>30) return i; },null);
    await drag(await cellXY(moved),await cellXY(free)); ok(await ev(p,([a,b])=>!G.pend.has(a)&&G.pend.has(b),[moved,free]),'a placed tile can be dragged to another square');
    await drag(await cellXY(free),await rackXY(0)); ok(await ev(p,b=>!G.pend.has(b),free),'…and dragged back to the rack');
    // tap a placed tile returns it
    c=await cellXY(best[0][0]); await p.touchscreen.tap(c.x,c.y); await p.waitForTimeout(80); ok(await ev(p,i=>!G.pend.has(i),best[0][0]),'tapping a placed tile takes it back');
    // Recall and Shuffle
    await ev(p,()=>{ G.sel=0; placeTile(0,boardOf(G.st.cfg).start); }); a=await p.locator('#bRecall').boundingBox(); await p.touchscreen.tap(a.x+a.width/2,a.y+a.height/2); await p.waitForTimeout(60); ok(await ev(p,()=>G.pend.size===0),'Recall returns every tile');
    const before=await ev(p,()=>G.view.join('')); let changed=false; for(let i=0;i<5&&!changed;i++){ await p.click('#bShuffle'); await p.waitForTimeout(40); changed=(await ev(p,()=>G.view.join('')))!==before; }
    ok(changed&&(await ev(p,()=>G.view.slice().sort().join('')))===before.split('').sort().join(''),'Shuffle reorders the rack');
    // blank tile: letter sheet
    await ev(p,()=>{ G.view[0]='?'; G.st.racks[0][G.st.racks[0].indexOf(G.view[1])]; render(); }); await ev(p,()=>placeTile(0,boardOf(G.st.cfg).start));
    ok(await ev(p,()=>sheetOn&&document.querySelectorAll('#sheet [data-l]').length===26),'placing a blank opens the A–Z sheet'); await p.click('#sheet [data-l="Q"]'); await p.waitForTimeout(60);
    ok(await ev(p,()=>{ const v=G.pend.get(boardOf(G.st.cfg).start); return v&&v.ch==='Q'&&v.bl&&document.querySelector('.tile.pend.bl'); }),'the blank shows its chosen letter in a different style');
    ok(!p.errs.length,'placing: no page errors '+p.errs.join(' | ')); await p.close(); }

  // a full move and the computer's reply, then Android back opens the pause menu
  { const p=await page(b); await ev(p,()=>startGame({mode:'classic'},newGame({size:'medium',boardSeed:7,bagSeed:9,players:[{name:'You',ai:null},{name:'Easy',ai:'easy'}],first:0})));
    await ev(p,()=>{ const m=sortMoves(allMoves(G.st,G.st.racks[0]))[0]; for(const [i,ch,bl] of moveTiles(G.st,m)){ const k=G.view.findIndex((t,k)=>t===ch&&![...G.pend.values()].some(v=>v.k===k)); placeTile(k,i); } });
    await p.click('#bPlay'); await p.waitForTimeout(3500); ok(await ev(p,()=>G.st.moves.length===2&&G.st.turn===0),'Play, then the computer replies (its tiles animate in)');
    ok(await ev(p,()=>document.querySelectorAll('.tile.last').length>0),'the last move is highlighted');
    await p.goBack(); await p.waitForTimeout(200); ok(await ev(p,()=>sheetOn&&!!document.querySelector('#pauseSheet')),'Android back opens the pause menu in a game');
    await p.goBack(); await p.waitForTimeout(200); ok(await ev(p,()=>!sheetOn&&cur==='game'),'back again closes it');
    ok(await ev(p,()=>!!S.run&&S.run.st.moves.length===2),'the game saves after every move');
    await p.reload(); await p.waitForTimeout(600); ok(await ev(p,()=>!!document.querySelector('#hCont')),'a reload offers Continue');
    await p.click('#hCont'); await p.waitForTimeout(300); ok(await ev(p,()=>G&&G.st.moves.length===2&&G.st.turn===0&&G.view.length===7),'Continue resumes exactly');
    ok(!p.errs.length,'turns: no page errors '+p.errs.join(' | ')); await p.close(); }

  // zoom on a 19×19 board: double-tap and pinch; tiles at least 32 px when zoomed
  { const p=await page(b,{vp:{width:360,height:740}}); await ev(p,()=>startGame({mode:'classic'},newGame({size:'large',boardSeed:3,bagSeed:4,players:[{name:'You',ai:null},{name:'Hard',ai:'hard'}],first:0})));
    const bv=await p.locator('#bview').boundingBox(), cx=bv.x+bv.width/2, cy=bv.y+bv.height/2;
    const cs0=await ev(p,()=>G.cellEls[0].getBoundingClientRect().width);
    await p.touchscreen.tap(cx,cy); await p.waitForTimeout(90); await p.touchscreen.tap(cx,cy); await p.waitForTimeout(150);
    const cs1=await ev(p,()=>G.cellEls[0].getBoundingClientRect().width); ok(cs1>=32&&cs1>cs0*1.5,`double-tap zooms in (${cs0.toFixed(1)} → ${cs1.toFixed(1)} px squares)`);
    await p.touchscreen.tap(cx,cy); await p.waitForTimeout(90); await p.touchscreen.tap(cx,cy); await p.waitForTimeout(150); ok(Math.abs(await ev(p,()=>G.cellEls[0].getBoundingClientRect().width)-cs0)<.5,'double-tap again shows the whole board');
    await ev(p,([cx,cy])=>{ const el=document.querySelector('#bview'); const d=(t,id,x,y)=>(t==='pointerdown'?el:window).dispatchEvent(new PointerEvent(t,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));
      d('pointerdown',1,cx-20,cy); d('pointerdown',2,cx+20,cy); for(let i=1;i<=10;i++){ d('pointermove',1,cx-20-i*8,cy); d('pointermove',2,cx+20+i*8,cy); } d('pointerup',1,cx-100,cy); d('pointerup',2,cx+100,cy); },[cx,cy]);
    await p.waitForTimeout(100); const cs2=await ev(p,()=>G.cellEls[0].getBoundingClientRect().width); ok(cs2>cs0*1.8,`pinch zooms in (${cs2.toFixed(1)} px squares)`);
    const tsz=await ev(p,()=>{ G.st.cells[boardOf(G.st.cfg).start]='A'; render(); return document.querySelector('#board .tile').getBoundingClientRect().width; }); ok(tsz>=32,`tiles are ${tsz.toFixed(1)} px when zoomed in (at least 32)`);
    // drag to pan when zoomed
    const tx0=await ev(p,()=>G.tx); await ev(p,([cx,cy])=>{ const el=document.querySelector('#bview'); el.dispatchEvent(new PointerEvent('pointerdown',{pointerId:3,pointerType:'touch',clientX:cx,clientY:cy,bubbles:true}));
      for(let i=1;i<=6;i++) window.dispatchEvent(new PointerEvent('pointermove',{pointerId:3,pointerType:'touch',clientX:cx+i*12,clientY:cy,bubbles:true})); window.dispatchEvent(new PointerEvent('pointerup',{pointerId:3,pointerType:'touch',clientX:cx+72,clientY:cy,bubbles:true})); },[cx,cy]);
    ok(await ev(p,t=>G.tx!==t,tx0),'drag pans the zoomed board');
    // auto-zoom while placing
    await ev(p,()=>{ G.st.cells[boardOf(G.st.cfg).start]=''; setZoom(1); S.prefs.zoom=true; G.sel=0; placeTile(0,boardOf(G.st.cfg).start); }); ok(await ev(p,()=>G.z>1.5),'the board zooms in round the first tile placed');
    // speed: every move on a Large board with 4× CPU throttling
    const cdp=await p.context().newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    const ms=await ev(p,()=>{ const st=newGame({size:'large',boardSeed:5,bagSeed:55,players:[{name:'A',ai:'hard'},{name:'B',ai:'hard'}]}); for(let m=0;m<12;m++) aiTurn(st,'hard'); const out=[];
      for(const r of ['EARSTIN','QUEZIOT','BDGLMNO','?EARSTN']){ const t=performance.now(); allMoves(st,r.split('')); out.push(performance.now()-t); } return out; });
    ok(ms.slice(0,3).every(t=>t<300),`all moves on a Large board under 300 ms at 4× throttling: ${ms.map(t=>t.toFixed(0)).join(', ')} ms (the last with a blank)`);
    const slice=await ev(p,()=>{ const st=newGame({size:'large',boardSeed:5,bagSeed:55,players:[{name:'A',ai:'hard'},{name:'B',ai:'hard'}]}); for(let m=0;m<12;m++) aiTurn(st,'hard'); const g=moveGen(st,'EARSTIN'.split(''),{slice:true}); const t=[]; for(;;){ const a=performance.now(); const r=g.next(); t.push(performance.now()-a); if(r.done) break; } t.sort((a,b)=>a-b); return [t[Math.floor(t.length*.95)],t[t.length-1]]; });
    ok(slice[0]<8,`the computer's search runs in short slices at 4× throttling (95% under ${slice[0].toFixed(1)} ms, worst ${slice[1].toFixed(1)} ms)`);
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
    ok(!p.errs.length,'zoom: no page errors '+p.errs.join(' | ')); await p.close(); }

  // 2-Player by share code between two devices, and pass-and-play
  { const a=await page(b,{save:Object.assign({},SEEN,{name:'Alasdair'})}), c=await page(b,{save:Object.assign({},SEEN,{name:'Robin'})});
    const playBest=async(p)=>ev(p,()=>{ const st=G.st, m=sortMoves(allMoves(st,st.racks[st.turn]))[0]; for(const [i,ch,bl] of moveTiles(st,m)){ const k=G.view.findIndex((t,k)=>t===(bl?'?':ch)&&![...G.pend.values()].some(v=>v.k===k)); placeTile(k,i); if(bl){ G.pend.get(i).ch=ch; closeSheet(); } } evalPend(); render(); document.querySelector('#bPlay').click(); });
    await a.click('#hTp'); await a.click('#tNew'); await a.waitForTimeout(100); await a.click('#tGo'); await a.waitForTimeout(200); await playBest(a); await a.waitForTimeout(800);
    const code1=await ev(a,()=>document.querySelector('#cdOut').value); ok(/TCF1\./.test(code1)&&/Alasdair/.test(code1),'Player 1 plays and gets a code to send');
    await c.click('#hTp'); await c.click('#tPaste'); await c.fill('#pin',code1); await c.click('#pGo'); await c.waitForTimeout(100); await c.click('#jGo'); await c.waitForTimeout(300);
    ok(await ev(c,()=>G&&G.mode==='tp'&&G.st.moves.length===1&&myTurn(G)),'Player 2 pastes the message, enters their name and it\'s their turn');
    await playBest(c); await c.waitForTimeout(800); const code2=await ev(c,()=>document.querySelector('#cdOut').value); ok(/TCF1\./.test(code2)&&/Robin/.test(code2),'Player 2 plays and gets a code back');
    await ev(a,()=>closeSheet()); await ev(a,()=>leaveGame()); await a.click('#tPaste'); await a.fill('#pin',code2); await a.click('#pGo'); await a.waitForTimeout(300);
    ok(await ev(a,()=>G&&G.st.moves.length===2&&myTurn(G)&&G.st.cfg.players[1].name==='Robin'),'Player 1 pastes the reply and continues');
    await ev(a,()=>leaveGame()); ok(await ev(a,()=>/Your turn/.test(document.querySelector('#tpBody').textContent)&&/Robin/.test(document.querySelector('#tpBody').textContent)),'the games list shows the game, the opponent and whose turn');
    await a.click('#tPaste'); await a.fill('#pin',code1); await a.click('#pGo'); await a.waitForTimeout(150); ok(await ev(a,()=>/older/.test(tCur+tq.join('|'))),'an older code is refused');
    await ev(a,()=>closeSheet()); const del=await a.locator('[data-del]').first(); await del.click(); await del.click(); await a.waitForTimeout(100); ok(await ev(a,()=>S.tp.games.length===0),'Delete game takes two taps');
    await a.click('#tPaste'); await a.fill('#pin',code2); await a.click('#pGo'); await a.waitForTimeout(150); ok(await ev(a,()=>/deleted that game/.test(tCur+tq.join('|'))&&!S.tp.games.length),'a deleted game\'s code is refused');
    ok(!a.errs.length&&!c.errs.length,'2-Player: no page errors '+a.errs.concat(c.errs).join(' | ')); await a.close(); await c.close(); }
  { const p=await page(b); await p.click('#hTp'); await p.click('#tLocal'); await p.fill('#n1','Ann'); await p.fill('#n2','Ben'); await p.click('#tGo'); await p.waitForTimeout(200);
    ok(await ev(p,()=>coverOn()&&/Ann/.test(document.querySelector('#cover').textContent)),'pass-and-play: "Pass to Ann" hides the rack first');
    await p.click('#cvGo'); await p.waitForTimeout(100); ok(await ev(p,()=>!coverOn()&&document.querySelectorAll('.rt').length===7),'tapping shows the tiles');
    await ev(p,()=>{ document.querySelector('#bPass').click(); }); await p.click('#psGo'); await p.waitForTimeout(900); ok(await ev(p,()=>coverOn()&&/Ben/.test(document.querySelector('#cover').textContent)),'after a turn: "Pass to Ben"');
    ok(!p.errs.length,'pass-and-play: no page errors '+p.errs.join(' | ')); await p.close(); }

  // Daily: par, one scored attempt, resumes
  { const p=await page(b); await p.click('#hDaily'); await p.waitForFunction(()=>!document.querySelector('#dPlay').disabled,null,{timeout:20000}); ok(await ev(p,()=>S.parCache[todayStr()]>0),'the Daily works out par');
    await p.click('#dPlay'); await p.waitForTimeout(200); ok(await ev(p,()=>G.mode==='daily'&&document.querySelector('#bHint').disabled),'the Daily starts, with no hints');
    await ev(p,()=>{ document.querySelector('#bPass').click(); }); await p.click('#psGo'); await p.waitForTimeout(500); await p.reload(); await p.waitForTimeout(300);
    ok(await ev(p,()=>/Resume/.test(document.querySelector('#hDaily').textContent)),'the Daily saves and resumes');
    await p.click('#hDaily'); await p.waitForTimeout(150); await p.click('#dPlay'); await p.waitForTimeout(200); ok(await ev(p,()=>G.st.moves.length===1),'…exactly where it was');
    await ev(p,()=>{ for(let i=0;i<9;i++) applyMove(G.st,{t:'-'}); finishGame(); }); await p.waitForTimeout(200); ok(await ev(p,()=>S.daily.scored&&!!document.querySelector('#rShare')),'a finished Daily is scored once, with a Share button');
    ok(!p.errs.length,'Daily: no page errors '+p.errs.join(' | ')); await p.close(); }

  // campaign: a level plays and earns its stars
  { const p=await page(b); await p.click('#hCamp'); await p.click('[data-lv="A10"]'); await p.waitForTimeout(80); ok(await ev(p,()=>/Clear level/.test(document.querySelector('#toast').textContent)),'locked levels stay locked');
    await ev(p,()=>{ for(const L of LEVELS.filter(l=>l.camp===0&&l.n<10)) S.camp[L.id]={s:[1,0,0],best:1}; renderCamp(); }); await p.click('[data-lv="A10"]'); await p.click('#goLv'); await p.waitForTimeout(200);
    await ev(p,()=>{ const m=sortMoves(allMoves(G.st,G.st.racks[0]))[0]; for(const [i,ch] of moveTiles(G.st,m)){ const k=G.view.findIndex((t,k)=>t===ch&&![...G.pend.values()].some(v=>v.k===k)); placeTile(k,i); } document.querySelector('#bPlay').click(); });
    await p.waitForTimeout(1500); ok(await ev(p,()=>campStars(S,'A10')===3&&document.querySelectorAll('#sheet .goal.got').length===3),'the puzzle: the best move earns all 3 stars');
    ok(!p.errs.length,'campaign: no page errors '+p.errs.join(' | ')); await p.close(); }

  // standalone: strict CSP, no outside requests
  { const p=await page(b); await ev(p,()=>startClassic()); await p.waitForTimeout(500);
    ok(p.reqs.every(r=>r.startsWith('file:')||r.startsWith('data:')),'standalone makes no outside requests');
    ok(await ev(p,()=>!!document.querySelector('meta[http-equiv="Content-Security-Policy"]')),'standalone has the strict CSP'); await p.close(); }

  // the Arcade build contract
  { fs.writeFileSync(path.join(DIST,'index.html'),'<!DOCTYPE html><title>Arcade stub</title><p>arcade</p>');
    const arc={v:1,set:{appearance:'dark',motion:false,sfx:false,music:false,haptics:false,fullscreen:false,cb:true,lefty:true,lang:'en'},name:'Alasdair'};
    const p=await page(b,{file:'tilecraft/index.html',arcade:arc,save:Object.assign({},SEEN,{appearance:'light',name:'Standalone'})});
    ok(await ev(p,()=>window.__ARCADE__===1&&ARCADE===true),'Arcade build sets window.__ARCADE__=1');
    ok(await ev(p,()=>!!document.querySelector('link[href="../fonts.css"]')&&!/@font-face/.test([...document.styleSheets].map(s=>{ try{ return [...s.cssRules].map(r=>r.cssText).join(''); }catch(e){ return ''; } }).join(''))),'links ../fonts.css, fonts not inlined');
    ok(await ev(p,()=>P.appearance==='dark'&&P.cb===true&&P.lefty===true&&P.name==='Alasdair'&&document.documentElement.classList.contains('dark')),'shared settings and the name come from arcade.v1');
    ok(await ev(p,()=>S.appearance==='light'&&S.name==='Standalone'),'the save keeps its standalone values');
    ok(await ev(p,()=>!document.querySelector('#arcadeBtn').hidden),'"‹ Arcade" shows on home');
    await ev(p,()=>{ persist(); }); await p.waitForTimeout(450);
    const sum=await ev(p,()=>JSON.parse(localStorage.getItem('arcade.summary.tilecraft')||'null')); ok(sum&&['v','game','ver','level','maxLevel','xp','xpLevel','xpNext','ach','hi','last'].every(k=>k in sum)&&sum.game==='tilecraft','the summary is written 300 ms after a save, with every field');
    const keys=await ev(p,()=>Object.keys(localStorage).filter(k=>k!=='__seeded')); ok(keys.every(k=>k.startsWith('tilecraft.')||k==='arcade.summary.tilecraft'||k==='arcade.v1'),'only tilecraft.* keys (and the summary) are written: '+keys.join(', '));
    ok(await ev(p,a=>localStorage.getItem('arcade.v1')===JSON.stringify(a),arc),'arcade.v1 is never written');
    await ev(p,()=>openSettings()); ok(await ev(p,()=>!!document.querySelector('#arcSet')&&!document.querySelector('[data-sw="sfx"]')&&!document.querySelector('#langBtn')),'settings in Arcade: game options plus an Arcade settings row; shared settings hidden');
    await ev(p,()=>{ const a=JSON.parse(localStorage.getItem('arcade.v1')); a.set.appearance='light'; localStorage.setItem('arcade.v1',JSON.stringify(a)); dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})); });
    ok(await ev(p,()=>P.appearance==='light'),'shared settings are re-read on pageshow');
    await ev(p,()=>goHome()); const h0=await ev(p,()=>history.length); await p.click('#arcadeBtn'); await p.waitForTimeout(400);
    ok(/dist\/index\.html$/.test(p.url()),'‹ Arcade goes to ../index.html'); ok(await ev(p,()=>history.length)<=h0,'…with location.replace (no new history entry)');
    await p.close();
    const q=await page(b,{file:'tilecraft/index.html',hash:'#game-settings',arcade:arc}); ok(await ev(q,()=>cur==='set'&&location.hash===''),'#game-settings opens settings and clears the hash');
    ok(await ev(q,()=>!!document.querySelector('#settingsBtn')),'the settings button is #settingsBtn');
    await q.goBack(); await q.waitForTimeout(150); ok(await ev(q,()=>cur==='home'),'back from settings goes home');
    await q.goBack(); await q.waitForTimeout(400); ok(/dist\/index\.html$/.test(q.url()),'back on home in Arcade goes to Arcade');
    ok(!q.errs.length,'Arcade: no page errors '+q.errs.join(' | ')); await q.close(); fs.unlinkSync(path.join(DIST,'index.html')); }

  await b.close(); console.log(`\n${pass} passed, ${fail} failed (${((Date.now()-t0)/1000).toFixed(0)} s)`); process.exit(fail?1:0); })();
