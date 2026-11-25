// node tools/show.js [id…] — prints layouts as text (the digit is the top layer at each half cell)
const fs=require('fs'); eval(fs.readFileSync(__dirname+'/../src/layouts.js','utf8').replace('const LAYOUT_DATA','global.LAYOUT_DATA'));
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
for(const L of LAYOUT_DATA){ if(process.argv.length>2&&!process.argv.slice(2).includes(L.id)) continue;
  const g=[...Array(L.h)].map(()=>Array(L.w).fill(' '));
  for(let i=0;i<L.p.length;i+=3){ const x=B64.indexOf(L.p[i]),y=B64.indexOf(L.p[i+1]),z=B64.indexOf(L.p[i+2]); for(const [dx,dy] of [[0,0],[1,0],[0,1],[1,1]]){ const c=g[y+dy][x+dx]; if(c===' '||+c<z+1) g[y+dy][x+dx]=String(z+1); } }
  console.log(`${L.id} (${L.diff}, ${L.layers} layers)`); for(const r of g) console.log('  '+r.join('')); }
