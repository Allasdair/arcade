// Arcade service worker: lets the Arcade and every game open with no internet.
//
// Rules, so an update can never lock players out or touch their saves:
// - Launch from the saved copy, always. Pages are never held up waiting for the network, so a connection
//   that's "up" but not answering (wifi on, internet down) can't stall the app.
// - Each part (the shell, each game) has its own cache, named by a hash of its files. A new version is
//   downloaded completely before it's used; if any file fails, the install fails and the old version keeps running.
// - Cleanup only deletes this app's own old caches (prefix "arcade-"). Saves live in localStorage, which
//   service workers can't touch at all.
// - Self-repair: if a cache goes missing (cleared by the browser or another app on this site), it's
//   refilled the next time the app is opened online.
const BUILD='bd4f1464';
const PARTS={
 "arcade-shell-790c1da2e0": [
  "index.html",
  "fonts.css",
  "manifest.webmanifest",
  "avatars.js",
  "fonts/caveat-700.woff2",
  "fonts/inter.woff2",
  "fonts/jetbrains-mono-700.woff2",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png"
 ],
 "arcade-sweep-034bccbb38": [
  "sweep/index.html"
 ],
 "arcade-shipfight-08e2e00177": [
  "shipfight/index.html"
 ],
 "arcade-snake-391b505eb6": [
  "snake/index.html"
 ],
 "arcade-t2048-343cb1224f": [
  "t2048/index.html"
 ],
 "arcade-linefall-31ac042fc1": [
  "linefall/index.html"
 ],
 "arcade-drift-65c9045563": [
  "drift/index.html"
 ],
 "arcade-tilecraft-2527a79f67": [
  "tilecraft/index.html"
 ],
 "arcade-solitaire-61fa892adf": [
  "solitaire/index.html"
 ],
 "arcade-mahjong-3155dbe268": [
  "mahjong/index.html"
 ],
 "arcade-sudoku-ef2aad49bf": [
  "sudoku/index.html"
 ],
 "arcade-chess-aa811dfb69": [
  "chess/index.html"
 ],
 "arcade-quintessence-a1e4d1ca8a": [
  "quintessence/index.html"
 ]
};            // {cacheName: [files relative to this script]}
const PREFIX='arcade-';
const NAMES=Object.keys(PARTS);

const fresh=u=>new Request(u,{cache:'reload'});   // skip the HTTP cache so a new hash never stores an old file

async function fill(name,{onlyMissing}={}){
  const c=await caches.open(name), want=PARTS[name];
  const have=onlyMissing?new Set((await c.keys()).map(r=>new URL(r.url).href)):new Set();
  const todo=want.filter(f=>!have.has(new URL(f,self.registration.scope).href));
  if(!todo.length) return;
  // Download everything first, then store: a half-finished download never ends up in the cache.
  const res=await Promise.all(todo.map(async f=>{ const r=await fetch(fresh(f)); if(!r.ok) throw new Error(f+' '+r.status); return [f,r]; }));
  await Promise.all(res.map(([f,r])=>c.put(f,r)));
}

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    for(const n of NAMES){ if(await caches.has(n)) await fill(n,{onlyMissing:true}); else{
      try{ await fill(n); }catch(err){ await caches.delete(n); throw err; } } }   // any failure: abandon this update
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const old=(await caches.keys()).filter(k=>k.startsWith(PREFIX)&&!NAMES.includes(k));
    const wasUpdate=old.length>0;
    await Promise.all(old.map(k=>caches.delete(k)));
    await self.clients.claim();
    if(wasUpdate) (await self.clients.matchAll({type:'window'})).forEach(c=>c.postMessage({type:'arcade-updated',build:BUILD}));
  })());
});

// Pages ask for a repair check on every launch; it only downloads files that are missing.
self.addEventListener('message',e=>{
  if(e.data==='arcade-repair') e.waitUntil(Promise.all(NAMES.map(n=>fill(n,{onlyMissing:true}).catch(()=>{}))));
});

// "sweep/" and "sweep/index.html" are the same page; so are "" and "index.html".
function pageKey(url){ const rel=url.href.slice(self.registration.scope.length).split('#')[0].split('?')[0];
  return rel===''||rel.endsWith('/')?rel+'index.html':rel; }

function withTimeout(p,ms){ return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms))]); }

self.addEventListener('fetch',e=>{
  const req=e.request, url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==location.origin||!url.href.startsWith(self.registration.scope)) return;
  if(url.pathname.endsWith('/sw.js')) return;
  e.respondWith((async()=>{
    const key=req.mode==='navigate'?pageKey(url):url.href;
    const hit=await caches.match(new URL(key,self.registration.scope).href);
    if(hit) return hit;
    // Not saved yet (first visit, or the cache was cleared): try the network briefly, keep a copy.
    try{
      const r=await withTimeout(fetch(req),8000);
      if(r.ok){ const owner=NAMES.find(n=>PARTS[n].some(f=>new URL(f,self.registration.scope).href===new URL(key,self.registration.scope).href))||NAMES[0];
        const cp=r.clone(); caches.open(owner).then(c=>c.put(key,cp)); }
      return r;
    }catch(err){
      if(req.mode==='navigate') return new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:16px system-ui;padding:40px 24px;color:#444">
        <h2 style="margin:0 0 8px">You're offline</h2><p>This page hasn't been saved to this device yet. Open the Arcade once while you're online and every game will work offline after that.</p>
        <p><a href="${self.registration.scope}">Back to the Arcade</a></p>`,{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
      return Response.error();
    }
  })());
});
