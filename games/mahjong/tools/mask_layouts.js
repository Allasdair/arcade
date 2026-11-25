// node tools/mask_layouts.js  →  src/layouts.js
// Builds every bundled layout from a shape mask on a whole-tile grid plus a height map (stacked by distance from the
// edge), then trims or raises it, keeping left–right symmetry, to the exact tile count of its difficulty.
// Shaped layouts use Sweep's masks (shapeMask below is copied from games/sweep/src/engine.js, v1.2.1).
// Positions are on the half-tile grid: a tile at (x,y,z) covers x..x+1, y..y+1 on layer z. All layouts are portrait.
// The output is hand-checked in the game and by tests/run.js (no overlaps, every upper tile fully supported).
const fs=require('fs'), path=require('path');

// ---- Sweep's shape masks (verbatim maths, without the random Swiss Cheese) ----
function shapeMask(name,W,H){
  const m=new Uint8Array(W*H);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const u=(x+.5)/W*2-1, v=(y+.5)/H*2-1; let on=1;
    if(name==='ring'){ const r=Math.hypot(u,v); on=r<=1.02&&r>=.5; }
    else if(name==='heart'){ const X=u*1.22, Y=-v*1.25+.22, a=X*X+Y*Y-1; on=a*a*a-X*X*Y*Y*Y<=0; }
    else if(name==='diamond') on=Math.abs(u)+Math.abs(v)<=1.04;
    else if(name==='cross') on=Math.abs(u)<=.37||Math.abs(v)<=.37;
    else if(name==='hourglass') on=Math.abs(u)<=Math.abs(v)*.95+.24;
    else if(name==='islands'){ const r1=Math.hypot((u+.5)*1.05,v), r2=Math.hypot((u-.5)*1.05,v); on=r1<=.52||r2<=.52||(Math.abs(v)<=.16&&Math.abs(u)<=.55); }
    m[y*W+x]=on?1:0; }
  return m; }

// ---- our own masks for the standard layouts ----
const MASKS={
  rect:()=>1,
  rounded:(u,v)=>Math.pow(Math.abs(u),4)+Math.pow(Math.abs(v),4)<=1.05,
  oval:(u,v)=>u*u+v*v<=1.08,
  octagon:(u,v)=>Math.abs(u)+Math.abs(v)<=1.45,
  lantern:(u,v)=>Math.abs(u)<=.95-.45*v*v||Math.abs(v)>.82&&Math.abs(u)<.45,
  arches:(u,v)=>!(Math.abs(u)<.3&&v>.15),
  bridge:(u,v)=>Math.abs(u)>=.32||Math.abs(v)<=.42,
  fan:(u,v)=>{ const r=Math.hypot(u,(v+1)*.78); return r<=1.45&&v<.98; },
  steps:(u,v)=>v>=Math.abs(u)*1.3-1.05,
  spire:(u,v)=>Math.abs(u)<=.35+.65*(v+1)/2,
  columns:(u,v)=>Math.abs(u)<.22||Math.abs(u)>.58||Math.abs(v)>.7,
  fortress:(u,v)=>!(Math.abs(u)<.24&&Math.abs(v)<.26),
  dragon:(u,v)=>{ const w=Math.sin((v+1)*3.1)*.45; return Math.abs(u-w)<=.42||(v<-.72&&Math.abs(u-w)<.62); },
  pagoda:(u,v)=>{ const t=Math.min(3,Math.floor((v+1)/2*4)), band=((v+1)/2*4)%1; return Math.abs(u)<=.3+.2*t+(band<.3?.12:0); },
  constellation:(u,v)=>{ const P=[[0,-.72],[-.62,-.3],[.62,-.3],[0,.08],[-.5,.66],[.5,.66]], E=[[0,1],[0,2],[1,3],[2,3],[3,4],[3,5]];
    const seg=(a,b)=>{ const [x1,y1]=P[a],[x2,y2]=P[b], dx=x2-x1, dy=y2-y1, t=Math.max(0,Math.min(1,((u-x1)*dx+(v-y1)*dy)/(dx*dx+dy*dy))); return Math.hypot(u-x1-t*dx,v-y1-t*dy); };
    return P.some(([a,b])=>Math.hypot(u-a,v-b)<.27)||E.some(([a,b])=>seg(a,b)<.1); },
  lotus:(u,v)=>{ const a=Math.atan2(v,u), r=Math.hypot(u,v); return r<=.62+.38*Math.abs(Math.cos(a*2.5)); },
};

// distance from the edge of the mask (whole tiles, 4-neighbour), used for stacking
function edgeDist(m,W,H){ const d=new Int16Array(W*H).fill(0), INF=999;
  for(let i=0;i<W*H;i++) d[i]=m[i]?INF:0;
  let changed=true; while(changed){ changed=false;
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const i=y*W+x; if(!m[i]) continue;
      let best=INF; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const X=x+dx, Y=y+dy; const n=(X<0||Y<0||X>=W||Y>=H)?0:d[Y*W+X]; best=Math.min(best,n+1); }
      if(best<d[i]){ d[i]=best; changed=true; } } }
  return d; }
function largestRegion(m,W,H){ const seen=new Int32Array(W*H).fill(-1); let best=-1,bestN=0,id=0;
  for(let i=0;i<W*H;i++){ if(!m[i]||seen[i]>=0) continue; let n=0; const st=[i]; seen[i]=id;
    while(st.length){ const c=st.pop(); n++; const cx=c%W, cy=(c/W)|0;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=cx+dx, ny=cy+dy; if(nx<0||ny<0||nx>=W||ny>=H) continue; const j=ny*W+nx; if(m[j]&&seen[j]<0){ seen[j]=id; st.push(j); } } }
    if(n>bestN){ bestN=n; best=id; } id++; }
  for(let i=0;i<W*H;i++) if(m[i]&&seen[i]!==best) m[i]=0; return m; }

// Build one layout. spec: {id,name,diff,W,H,mask (name),sweep (true: Sweep mask),levels,rate,brick,stagger,cap,target}
function build(spec){
  const {W,H}=spec, levels=spec.levels, rate=spec.rate||1;
  let m;
  if(spec.sweep) m=shapeMask(spec.mask,W,H);
  else { m=new Uint8Array(W*H); const f=MASKS[spec.mask]; for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const u=(x+.5)/W*2-1, v=(y+.5)/H*2-1; m[y*W+x]=f(u,v)?1:0; } }
  // keep it left–right symmetric
  if(!spec.asym) for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const a=y*W+x, b=y*W+(W-1-x); const on=m[a]&&m[b]; m[a]=m[b]=on?1:0; }
  largestRegion(m,W,H);
  const d=edgeDist(m,W,H), h=new Int16Array(W*H);
  for(let i=0;i<W*H;i++) if(m[i]) h[i]=Math.min(levels,1+Math.floor((d[i]-1)*rate));
  const cx=(W-1)/2, cy=(H-1)/2, dist=i=>Math.hypot((i%W-cx)/W,(((i/W)|0)-cy)/H);
  const capOn=()=>spec.cap&&W%2===0&&H%2===0&&[0,1].every(dx=>[0,1].every(dy=>h[(cy-.5+dy)*W+(cx-.5+dx)]===levels));
  const count=()=>{ let n=0; for(let i=0;i<W*H;i++) n+=h[i]; return n+(capOn()?1:0); };
  const mir=i=>spec.asym?i:((i/W)|0)*W+(W-1-i%W);
  const order=[...Array(W*H).keys()].sort((a,b)=>dist(b)-dist(a)||a-b);
  const natural=count(); if(process.env.NAT) console.log('  natural',spec.id,natural,'→',spec.target);
  let guard=0;
  while(count()!==spec.target&&guard++<5000){ const n=count(), diff=spec.target-n;
    if(diff<0){ // remove: from the top of the outermost stacks first (keeps footprint), then footprint corners
      let done=false;
      const tops=order.filter(i=>h[i]>1&&!(spec.cap&&h[i]===levels&&dist(i)<.08)).sort((a,b)=>h[b]-h[a]||dist(b)-dist(a)||a-b);
      const cand=diff===-1?[...tops,...order].filter(i=>mir(i)===i&&h[i]>0):[...order.filter(i=>h[i]===1),...tops];
      for(const i of cand){ if(h[i]<=0) continue; const j=mir(i); if(diff===-1&&j!==i) continue;
        if(j!==i&&(h[j]<=0||diff>-2)) continue;
        if(h[i]===1){ h[i]=0; if(j!==i) h[j]=0; if(!connected(h,W,H)){ h[i]=1; if(j!==i) h[j]=1; continue; } }
        else { h[i]--; if(j!==i) h[j]--; }
        done=true; break; }
      if(!done){ // parity fix: a centre-column tile
        const c=order.filter(i=>mir(i)===i&&h[i]>0).sort((a,b)=>h[b]-h[a])[0]; if(c==null) throw new Error(spec.id+': cannot trim'); h[c]--; }
    } else { // add: raise the innermost stacks
      let done=false;
      const nbMin=i=>{ const x=i%W, y=(i/W)|0; let mn=99; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const X=x+dx, Y=y+dy; mn=Math.min(mn,(X<0||Y<0||X>=W||Y>=H)?0:h[Y*W+X]); } return mn; };
      // raise the cell that sits lowest against its neighbours (keeps slopes of one layer), innermost first
      for(let slack=1;slack<=levels&&!done;slack++){
        const cand=order.slice().reverse().filter(i=>m[i]&&h[i]<levels&&h[i]+1<=nbMin(i)+slack).sort((a,b)=>(h[a]-nbMin(a))-(h[b]-nbMin(b))||dist(a)-dist(b)||a-b);
        for(const i of cand){ const j=mir(i); if(diff===1&&j!==i) continue; if(j!==i&&diff<2) continue; if(j!==i&&h[j]!==h[i]) continue; h[i]++; if(j!==i) h[j]++; done=true; break; } }
      if(!done){ const c=order.slice().reverse().find(i=>mir(i)===i&&m[i]&&h[i]<levels); if(c==null) throw new Error(`${spec.id}: cannot raise (natural ${natural}, want ${spec.target})`); h[c]++; } } }
  if(count()!==spec.target) throw new Error(`${spec.id}: ${count()} tiles, want ${spec.target}`);
  const pos=[];
  for(let z=0;z<=levels+3;z++) for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const i=y*W+x; if(h[i]>z){
    const px=2*x+(spec.brick&&y%2?1:0), py=2*y+(spec.stagger&&x%2?1:0); pos.push([px,py,z]); } }
  if(capOn()){ const top=Math.max(...pos.map(p=>p[2])); pos.push([2*(cx-.5)+1,2*(cy-.5)+1,top+1]); }
  return pos; }
function connected(h,W,H){ const m=new Uint8Array(W*H); let s=-1; for(let i=0;i<W*H;i++){ m[i]=h[i]>0?1:0; if(m[i]&&s<0) s=i; }
  if(s<0) return false; let n=0; const seen=new Uint8Array(W*H), st=[s]; seen[s]=1;
  while(st.length){ const c=st.pop(); n++; const x=c%W, y=(c/W)|0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const X=x+dx, Y=y+dy; if(X<0||Y<0||X>=W||Y>=H) continue; const j=Y*W+X; if(m[j]&&!seen[j]){ seen[j]=1; st.push(j); } } }
  return n===m.reduce((a,b)=>a+b,0); }

// The traditional Turtle (public domain shape), stored turned 90° so it reads in portrait. 144 tiles, 5 layers.
function turtle(){ const P=[];
  // landscape: 12 columns wide; rows of the bottom layer
  const rows=[[1,12],[3,8],[2,10],[1,12],[1,12],[2,10],[3,8],[1,12]]; // [first column, count]
  rows.forEach(([c0,n],r)=>{ for(let c=c0;c<c0+n;c++) P.push([2*c,2*r,0]); });
  P.push([0,7,0],[26,7,0],[28,7,0]); // the three end tiles sit half a row down, between rows 3 and 4
  for(let r=1;r<7;r++) for(let c=4;c<10;c++) P.push([2*c,2*r,1]);
  for(let r=2;r<6;r++) for(let c=5;c<9;c++) P.push([2*c,2*r,2]);
  for(let r=3;r<5;r++) for(let c=6;c<8;c++) P.push([2*c,2*r,3]);
  P.push([13,7,4]);
  // turn 90°: landscape (x,y) → portrait (Ymax−y, x)
  const ymax=Math.max(...P.map(p=>p[1]));
  return P.map(([x,y,z])=>[ymax-y,x,z]); }

const N={easy:72,normal:108,hard:144,expert:144};
const SPECS=[
 // ---- Easy: 72 tiles, 2–3 layers ----
 {id:'terrace',name:'Terrace',diff:'easy',W:7,H:8,mask:'rect',levels:3,rate:.7},
 {id:'pebble',name:'Pebble',diff:'easy',W:8,H:8,mask:'rounded',levels:3,rate:.8},
 {id:'lantern',name:'Lantern',diff:'easy',W:8,H:9,mask:'lantern',levels:3,rate:.9},
 {id:'steps',name:'Steps',diff:'easy',W:8,H:9,mask:'steps',levels:3},
 {id:'brickwork',name:'Brickwork',diff:'easy',W:7,H:8,mask:'rect',levels:2,brick:1},
 {id:'heart',name:'Heart',diff:'easy',W:8,H:8,mask:'heart',sweep:1,levels:3,rate:1.2,shaped:1},
 {id:'diamond',name:'Diamond',diff:'easy',W:8,H:9,mask:'diamond',sweep:1,levels:3,rate:1.2,shaped:1},
 // ---- Normal: 108 tiles, 3–4 layers ----
 {id:'courtyard',name:'Courtyard',diff:'normal',W:8,H:9,mask:'rect',levels:4,rate:.75},
 {id:'bridge',name:'Bridge',diff:'normal',W:9,H:10,mask:'bridge',levels:4,rate:1.3},
 {id:'fan',name:'Fan',diff:'normal',W:9,H:8,mask:'fan',levels:3},
 {id:'stagger',name:'Stagger Hall',diff:'normal',W:8,H:8,mask:'rounded',levels:3,stagger:1},
 {id:'arches',name:'Arches',diff:'normal',W:9,H:9,mask:'arches',levels:3},
 {id:'ring',name:'Ring',diff:'normal',W:10,H:11,mask:'ring',sweep:1,levels:4,rate:2.5,shaped:1},
 {id:'cross',name:'Cross',diff:'normal',W:9,H:11,mask:'cross',sweep:1,levels:4,shaped:1},
 {id:'hourglass',name:'Hourglass',diff:'normal',W:9,H:11,mask:'hourglass',sweep:1,levels:4,shaped:1},
 // ---- Hard: 144 tiles, 4–5 layers ----
 {id:'fortress',name:'Fortress',diff:'hard',W:9,H:10,mask:'fortress',levels:5,rate:2.2},
 {id:'islands',name:'Twin Islands',diff:'hard',W:12,H:11,mask:'islands',sweep:1,levels:5,rate:1.6,shaped:1},
 {id:'spire',name:'Spire',diff:'hard',W:9,H:12,mask:'spire',levels:5},
 {id:'cascade',name:'Cascade',diff:'hard',W:8,H:10,mask:'octagon',levels:5,stagger:1},
 {id:'mosaic',name:'Mosaic',diff:'hard',W:9,H:10,mask:'rect',levels:4,brick:1,rate:.8},
 {id:'bigring',name:'Great Ring',diff:'hard',W:12,H:13,mask:'ring',sweep:1,levels:5,rate:2,shaped:1},
 {id:'bigcross',name:'Grand Cross',diff:'hard',W:10,H:11,mask:'cross',sweep:1,levels:5,shaped:1},
 // ---- Expert: 144 tiles, 5+ layers ----
 {id:'turtle',name:'Turtle',diff:'expert',fixed:turtle},
 {id:'bigheart',name:'Great Heart',diff:'expert',W:11,H:11,mask:'heart',sweep:1,levels:6,shaped:1,cap:1},
 {id:'citadel',name:'Citadel',diff:'expert',W:8,H:9,mask:'rounded',levels:6,cap:1},
 {id:'pinnacle',name:'Pinnacle',diff:'expert',W:7,H:9,mask:'oval',levels:6,rate:1.4,stagger:1},
 // ---- special (unlockable) ----
 {id:'dragon',name:'Dragon',diff:'hard',W:10,H:14,mask:'dragon',levels:5,rate:1.6,special:1,asym:1},
 {id:'pagoda',name:'Pagoda',diff:'hard',W:9,H:11,mask:'pagoda',levels:5,special:1},
 {id:'constellation',name:'Constellation',diff:'normal',W:11,H:12,mask:'constellation',levels:4,rate:2,special:1},
 {id:'lotus',name:'Lotus',diff:'normal',W:10,H:10,mask:'lotus',levels:4,rate:1.2,special:1},
];
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const enc=pos=>pos.map(p=>p.map(v=>B64[v]).join('')).join('');
const out=[];
for(const s of SPECS){ const target=N[s.diff]; let pos; try{ pos=s.fixed?s.fixed():build(Object.assign({target},s)); }catch(e){ console.log('ERROR',e.message); continue; }
  if(pos.length!==target) throw new Error(s.id+' has '+pos.length);
  const maxZ=Math.max(...pos.map(p=>p[2]))+1, W=Math.max(...pos.map(p=>p[0]))+2, H=Math.max(...pos.map(p=>p[1]))+2;
  out.push({id:s.id,name:s.name,diff:s.diff,layers:maxZ,w:W,h:H,shaped:!!s.shaped,special:!!s.special,p:enc(pos)});
  console.log(`${s.id.padEnd(14)} ${s.diff.padEnd(7)} ${pos.length} tiles, ${maxZ} layers, ${W/2}×${H/2} tiles`); }
const js=`// Generated by tools/mask_layouts.js — do not edit by hand.
// Each layout: positions on the half-tile grid, 3 characters per tile (x, y, z in base 64). All are portrait.
const LAYOUT_DATA=${JSON.stringify(out).replace(/\},\{/g,'},\n{')};
`;
fs.writeFileSync(path.join(__dirname,'..','src','layouts.js'),js);
console.log('wrote src/layouts.js', js.length,'bytes');
