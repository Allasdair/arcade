// node tests/layout.js   (needs Playwright + Chrome). Screenshots go to tests/shots/.
const path=require('path'), fs=require('fs');
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require(path.join(require('child_process').execSync('npm root -g').toString().trim(),'playwright'))); }
const DIST=path.join(__dirname,'..','dist'), SHOTS=path.join(__dirname,'shots'); fs.mkdirSync(SHOTS,{recursive:true});
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('✗ '+m); } };
(async()=>{
  const b=await chromium.launch({executablePath:fs.existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':undefined});
  const errs=[];
  async function page(w,opts={}){ const ctx=await b.newContext({viewport:{width:w,height:opts.h||780},hasTouch:!!opts.touch,isMobile:!!opts.touch,colorScheme:opts.dark?'dark':'light'});
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error'&&!(opts.file&&/ERR_FILE_NOT_FOUND/.test(m.text()))) errs.push(m.text()); }); // Arcade supplies ../fonts.css
    if(opts.init) await p.addInitScript(opts.init); await p.goto('file://'+path.join(DIST,opts.file||'standalone.html')); await p.waitForTimeout(500);
    await p.evaluate(()=>{ try{ closeSheet(); }catch(e){} }); return p; }
  const noSideScroll=async(p,tag)=>{ const r=await p.evaluate(()=>[...document.querySelectorAll('.screen.on .scroll, .screen.on, #sheetOv:not(.hidden) .sheet')].map(e=>e.scrollWidth-e.clientWidth)); ok(r.every(v=>v<=1),tag+' sideways scroll '+r); };

  for(const w of [360,390]){ const p=await page(w);
    await noSideScroll(p,'home '+w); await p.screenshot({path:`${SHOTS}/home-${w}.png`});
    await p.click('#playCard'); await p.waitForTimeout(250); await noSideScroll(p,'setup '+w); await p.evaluate(()=>closeSheet());
    for(const s of ['openStyle','openSettings']){ await p.click('#'+s); await p.waitForTimeout(250); await noSideScroll(p,s+' '+w); await p.screenshot({path:`${SHOTS}/${s}-${w}.png`,fullPage:false}); await p.evaluate(()=>goHome()); }
    await p.click('#lvlCard'); for(const t of ['lv','ac','st']){ await p.click(`#progTabs [data-p=${t}]`); await noSideScroll(p,'prog '+t+' '+w); } await p.evaluate(()=>goHome());
    await p.context().close(); }

  // keyboard play, double turn, wrap on a shaped arena
  { const p=await page(390);
    await p.evaluate(()=>startRun({arena:'ring',size:'m',speed:'normal',walls:'wrap',seed:'lay'}));
    await p.waitForTimeout(200); const h0=await p.evaluate(()=>G.body[0]);
    await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowLeft'); const q=await p.evaluate(()=>G.queue.length+(G.dir!==1?1:0)); ok(q>=1,'double turn queued');
    await p.waitForTimeout(400); ok(await p.evaluate(()=>G.dir===3||G.over),'double turn registered'); ok((await p.evaluate(()=>G.body[0]))!==h0,'snake moved');
    await p.screenshot({path:`${SHOTS}/ring-wrap.png`});
    // pause saves, resume counts down
    await p.keyboard.press('Space'); ok(await p.evaluate(()=>R.mode==='paused'&&!!S.run),'pause saves the run'); await p.screenshot({path:`${SHOTS}/paused.png`});
    await p.click('#homeBtn'); ok(await p.evaluate(()=>!document.querySelector('#contCard').hidden),'continue card shown');
    await p.click('#contCard'); ok(await p.evaluate(()=>R.mode==='count'),'resume counts down'); await p.waitForTimeout(2400); ok(await p.evaluate(()=>R.mode==='run'||R.mode==='dying'||R.mode==='over'),'running after countdown');
    // force a crash and capture the death animation + results
    await p.evaluate(()=>{ const W=G.W, i=G.body[0]; G.queue=[]; for(let d=0;d<4;d++){ const r=nextCell(G,d); if(r.i<0&&d!==(G.dir+2)%4){ G.queue=[d]; break; } } });
    await p.waitForTimeout(700); await p.screenshot({path:`${SHOTS}/death.png`}); await p.waitForTimeout(1400);
    ok(await p.evaluate(()=>!document.querySelector('#resOv').classList.contains('hidden')),'results shown'); await p.screenshot({path:`${SHOTS}/results.png`});
    await p.context().close(); }

  // touch: swipe and D-pad
  { const p=await page(360,{touch:true});
    await p.evaluate(()=>startRun({arena:'open',size:'m',seed:'touch'})); await p.waitForTimeout(150);
    const box=await p.locator('#wrapbox').boundingBox(), cx=box.x+box.width/2, cy=box.y+box.height/2;
    const swipe=async(dx,dy)=>{ await p.dispatchEvent('#wrapbox','pointerdown',{pointerId:1,clientX:cx,clientY:cy,pointerType:'touch'}); await p.dispatchEvent('#wrapbox','pointermove',{pointerId:1,clientX:cx+dx,clientY:cy+dy,pointerType:'touch'}); await p.dispatchEvent('#wrapbox','pointerup',{pointerId:1,pointerType:'touch'}); };
    await swipe(0,-30); ok(await p.evaluate(()=>G.started&&(G.queue[0]===0||G.dir===0)),'swipe up starts and turns');
    await p.evaluate(()=>{ S.set.controls='dpad'; startRun({arena:'open',size:'m',seed:'dpad'}); }); await p.waitForTimeout(150);
    ok(await p.locator('#dpad').isVisible(),'d-pad visible'); await p.dispatchEvent('.dpad .d','pointerdown',{pointerType:'touch'}); ok(await p.evaluate(()=>G.started&&(G.queue[0]===2||G.dir===2)),'d-pad down works');
    await p.screenshot({path:`${SHOTS}/dpad-360.png`}); await p.context().close(); }

  // dark mode + themes, and a long run to check frame rate at Large Fast
  { const p=await page(390,{dark:true});
    await p.evaluate(()=>{ S.xp=4000; S.ach.shape_shifter=1; S.cos.theme='midnight'; S.cos.skin='royal'; startRun({arena:'open',size:'l',speed:'fast',walls:'wrap',seed:'fps'}); });
    await p.waitForTimeout(150); await p.keyboard.press('ArrowUp');
    const fps=await p.evaluate(()=>new Promise(res=>{ let n=0; const t0=performance.now(); const f=()=>{ n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else res(n/2); }; requestAnimationFrame(f); }));
    console.log('  frames/s at Large Fast (headless):',fps.toFixed(0)); ok(fps>=50,'fps '+fps);
    await p.screenshot({path:`${SHOTS}/dark-midnight.png`}); await p.evaluate(()=>{ pause(); goHome(); }); await p.screenshot({path:`${SHOTS}/home-dark.png`}); await p.context().close(); }

  // Arcade build contract
  { const p=await page(390,{file:'snake/index.html',init:()=>{ localStorage.setItem('arcade.v1',JSON.stringify({v:1,name:'Al',set:{sfx:false,appearance:'dark',motion:false}})); }});
    ok(await p.evaluate(()=>ARCADE===true&&SET.sfx===false&&SET.appearance==='dark'&&S.set.sfx===true),'arcade settings in memory only');
    ok(await p.locator('#toArcade').isVisible(),'‹ Arcade visible');
    await p.evaluate(()=>{ persist(); }); await p.waitForTimeout(400);
    const sum=await p.evaluate(()=>JSON.parse(localStorage.getItem('arcade.summary.snake')||'null')); ok(sum&&sum.game==='snake'&&'xpNext' in sum,'summary written');
    const keys=await p.evaluate(()=>Object.keys(localStorage)); ok(keys.every(k=>k.startsWith('snake.')||k==='arcade.summary.snake'||k==='arcade.v1'),'only snake.* keys written: '+keys);
    ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('arcade.v1')).set.sfx===false),'arcade.v1 untouched');
    await p.click('#openSettings'); ok(await p.locator('#arcPrefs').isVisible(),'Arcade settings row'); ok(!(await p.locator('[data-t=sfx]').count()),'shared settings hidden');
    await p.context().close(); }
  // standalone file has a CSP; demo does not
  const sa=fs.readFileSync(path.join(DIST,'standalone.html'),'utf8'), dm=fs.readFileSync(path.join(DIST,'demo.html'),'utf8');
  ok(sa.includes('Content-Security-Policy')&&!dm.includes('Content-Security-Policy'),'CSP only in standalone/arcade');
  ok(!/https?:\/\/(?!www\.w3)/.test(sa.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g,'')),'no outside URLs');

  ok(!errs.length,'page errors: '+errs.join(' | '));
  console.log(`layout: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail?1:0);
})();
