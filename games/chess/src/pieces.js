// ===================== Piece sets (our own drawings) =====================
// Every set draws K Q R B N P in a 100×100 box. White and black always differ by more than colour: white pieces are
// light with a dark outline; black pieces are dark with light inner details and a light rim, so they read on any square
// (and in grayscale). The Letter set (K Q R B N P on discs) is always free, for accessibility.
// Shape kinds: [path], ['c', x, y, r] circle. Details are drawn as lines only, in the detail colour.
const PIECE_FAM={
 // Staunton-style silhouettes, shared by Classic, Flat and Glass
 classic:{
  P:{s:[['M28 89Q28 77 41 75L59 75Q72 77 72 89Z'],['M42 47Q44 62 37 75L63 75Q56 62 58 47Z'],['M37 44Q37 39 43 39L57 39Q63 39 63 44Q63 48 57 48L43 48Q37 48 37 44Z'],['c',50,27,12.5]],d:[]},
  R:{s:[['M23 89L77 89L77 82Q77 77 71 77L29 77Q23 77 23 82Z'],['M33 77L36 43L64 43L67 77Z'],['M29 43L71 43L71 36L29 36Z'],['M29 36L29 16L39 16L39 24L45 24L45 16L55 16L55 24L61 24L61 16L71 16L71 36Z']],d:['M36 50L64 50','M35 70L65 70']},
  N:{s:[['M25 89Q25 79 36 78L68 78Q79 79 79 89Z'],['M33 78Q31 68 40 60Q47 54 48 46Q44 51 37 51L31 57Q26 61 21 58Q16 54 20 48L30 31Q34 24 42 22L46 12L52 21Q64 28 68 46Q72 62 69 78Z']],d:['M54 28Q62 40 62 60','M23 51L27 49'],e:['c',39,33,3]},
  B:{s:[['M25 89Q25 79 36 78L64 78Q75 79 75 89Z'],['M41 78Q43 67 38 59L62 59Q57 67 59 78Z'],['M34 56Q34 52 38 52L62 52Q66 52 66 56Q66 60 62 60L38 60Q34 60 34 56Z'],['M50 15Q32 30 35 43Q37 52 42 52L58 52Q63 52 65 43Q68 30 50 15Z'],['c',50,12,5]],d:['M55 27L46 41','M44 70L56 70']},
  Q:{s:[['M23 89Q23 79 34 78L66 78Q77 79 77 89Z'],['M32 78Q35 62 19 34L34 50L36 28L44 48L50 24L56 48L64 28L66 50L81 34Q65 62 68 78Z'],['c',19,31,4.5],['c',36,25,4.5],['c',50,20,4.5],['c',64,25,4.5],['c',81,31,4.5]],d:['M34 69Q50 64 66 69']},
  K:{s:[['M23 89Q23 79 34 78L66 78Q77 79 77 89Z'],['M34 78Q37 61 27 46Q23 37 32 34Q42 32 50 42Q58 32 68 34Q77 37 73 46Q63 61 66 78Z'],['M46.5 9L53.5 9L53.5 16L60 16L60 22.5L53.5 22.5L53.5 37L46.5 37L46.5 22.5L40 22.5L40 16L46.5 16Z']],d:['M35 69Q50 64 65 69','M50 42L50 62']}},
 // Medieval: carved, rounder outlines; a crowned king and queen, a tower with a door
 medieval:{
  P:{s:[['M30 89L70 89L66 80L34 80Z'],['M40 80Q42 64 38 54Q36 48 44 46L56 46Q64 48 62 54Q58 64 60 80Z'],['c',50,32,13]],d:['M42 62L58 62']},
  R:{s:[['M26 89L74 89L72 80L28 80Z'],['M32 80Q34 54 30 34L70 34Q66 54 68 80Z'],['M26 34L26 18L36 18L36 26L44 26L44 14L56 14L56 26L64 26L64 18L74 18L74 34Z']],d:['M44 80L44 64Q50 56 56 64L56 80','M30 42L70 42']},
  N:{s:[['M28 89L76 89L72 80L32 80Z'],['M36 80Q34 66 44 58Q50 52 50 44L40 50Q32 56 24 54Q18 50 22 44L34 28Q40 18 50 18L54 10L58 20Q70 30 70 50Q70 66 66 80Z']],d:['M56 24Q66 34 64 58','M58 30L64 28','M60 40L66 38','M60 50L66 50'],e:['c',41,32,3]},
  B:{s:[['M28 89L72 89L68 80L32 80Z'],['M40 80Q44 66 40 58L60 58Q56 66 60 80Z'],['M50 12Q30 28 33 44Q36 58 50 58Q64 58 67 44Q70 28 50 12Z'],['c',50,9,4.5]],d:['M43 32L57 46','M57 32L43 46']},
  Q:{s:[['M26 89L74 89L70 80L30 80Z'],['M34 80Q36 62 28 48Q24 40 32 38L68 38Q76 40 72 48Q64 62 66 80Z'],['M28 38L24 18L37 28L44 12L50 26L56 12L63 28L76 18L72 38Z']],d:['M36 60L64 60','c',50,30,3.5]},
  K:{s:[['M26 89L74 89L70 80L30 80Z'],['M34 80Q36 62 28 50Q24 42 32 40L68 40Q76 42 72 50Q64 62 66 80Z'],['M29 40L29 24L38 30L50 22L62 30L71 24L71 40Z'],['c',50,15,6.5]],d:['M50 11L50 19','M46 15L54 15','M36 60L64 60']}},
 // Minimal: simple geometry
 minimal:{
  P:{s:[['M33 86L67 86L58 56L42 56Z'],['c',50,42,13]],d:[]},
  R:{s:[['M30 86L70 86L70 30L62 30L62 40L55 40L55 30L45 30L45 40L38 40L38 30L30 30Z']],d:[]},
  N:{s:[['M30 86L72 86L72 46L56 22L46 22L46 32L26 50L32 60L48 52L34 86Z']],d:[],e:['c',52,38,3.5]},
  B:{s:[['M32 86L68 86L62 72Q74 56 50 16Q26 56 38 72Z']],d:['M56 36L46 52']},
  Q:{s:[['M28 86L72 86L64 46L50 66L36 46Z'],['c',50,30,11]],d:[]},
  K:{s:[['M28 86L72 86L66 40L34 40Z'],['M44 12L56 12L56 22L66 22L66 34L56 34L56 40L44 40L44 34L34 34L34 22L44 22Z']],d:[]}}};
// Pixel set: 12×12 grids. # outline, o fill, + detail.
const PIXEL={
 P:['............','............','.....##.....','....#oo#....','....#oo#....','.....##.....','....#oo#....','....#oo#....','...#oooo#...','..#oooooo#..','..########..','............'],
 R:['............','.##..##..##.','.#o##oo##o#.','.#oooooooo#.','..#oooooo#..','..#o+oo+o#..','..#oooooo#..','..#oooooo#..','.#oooooooo#.','.##########.','............','............'],
 N:['............','....##......','...#o###....','..#oooooo#..','.#o+ooooo#..','#oooooooo#..','.####oooo#..','....#oooo#..','...#oooooo#.','..#########.','............','............'],
 B:['.....##.....','....#oo#....','...#oo+o#...','...#o+oo#...','...#oooo#...','....#oo#....','...######...','....#oo#....','...#oooo#...','..########..','............','............'],
 Q:['............','.#...##...#.','.##..##..##.','.#o##oo##o#.','.#oooooooo#.','..#oooooo#..','...#o++o#...','...#oooo#...','..#oooooo#..','.##########.','............','............'],
 K:['.....##.....','....####....','.....##.....','.###.##.###.','#ooo#oo#ooo#','#oooooooooo#','.#oooooooo#.','..#o+oo+o#..','..#oooooo#..','.##########.','............','............']};
const PSETS=['classic','minimal','flat','pixel','glass','medieval','letter'];
const LETTERS={K:'K',Q:'Q',R:'R',B:'B',N:'N',P:'P'};
// colours per set and side: fill, outline, detail, rim (black only)
function pieceInks(set,black){ if(set==='flat') return black?{f:'#34343a',o:'#16161a',d:'#f2efe8',rim:'#f6f3ec'}:{f:'#f6f2e9',o:'#3a3a40',d:'#3a3a40'};
  if(set==='glass') return black?{f:'url(#pgB)',o:'#0b0b10',d:'#e9ecf5',rim:'#eef1f8'}:{f:'url(#pgW)',o:'#2a2f3a',d:'#2a2f3a'};
  return black?{f:'#1f1f24',o:'#101014',d:'#ecebe6',rim:'#f4f3ee'}:{f:'#fbfaf6',o:'#17171b',d:'#17171b'}; }
const shapeSvg=(s,attr)=>s[0]==='c'?`<circle cx="${s[1]}" cy="${s[2]}" r="${s[3]}"${attr||''}/>`:`<path d="${s[0]}"${attr||''}/>`;
// SVG body for one piece (no <svg> wrapper): set, type letter K Q R B N P, black?
function pieceBody(set,t,black){ const ink=pieceInks(set,black);
  if(set==='letter') return `<circle cx="50" cy="50" r="40" fill="${black?'#1d1d22':'#fbfaf6'}" stroke="${black?'#f2f2f2':'#17171b'}" stroke-width="${black?6:5}"/>${black?'<circle cx="50" cy="50" r="33" fill="none" stroke="#1d1d22" stroke-width="2"/>':''}<text x="50" y="69" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-weight="800" font-size="52" fill="${black?'#ffffff':'#111'}">${LETTERS[t]}</text>`;
  if(set==='pixel'){ const g=PIXEL[t]; let r=''; const px=100/12, oy=6;
    const col={'#':black?'#f0efe9':'#17171b','o':black?'#26262c':'#fbfaf6','+':black?'#f0efe9':'#17171b'};
    for(let y=0;y<12;y++) for(let x=0;x<12;x++){ const ch=g[y][x]; if(ch==='.') continue; r+=`<rect x="${(x*px).toFixed(2)}" y="${(y*px+oy).toFixed(2)}" width="${(px+.2).toFixed(2)}" height="${(px+.2).toFixed(2)}" fill="${col[ch]}"/>`; }
    return `<g shape-rendering="crispEdges" transform="translate(6 2) scale(.88)">`+(black?`<g fill="#17171b">${g.map((row,y)=>[...row].map((ch,x)=>ch==='#'?`<rect x="${(x*px-1.2).toFixed(2)}" y="${(y*px+oy-1.2).toFixed(2)}" width="${(px+2.4).toFixed(2)}" height="${(px+2.4).toFixed(2)}"/>`:'').join('')).join('')}</g>`:'')+r+'</g>'; }
  const fam=PIECE_FAM[set==='flat'||set==='glass'?'classic':set]||PIECE_FAM.classic, P=fam[t];
  const sw=set==='flat'?4:set==='minimal'?4:3.2;
  let h='';
  if(black) h+=`<g fill="${ink.rim}" stroke="${ink.rim}" stroke-width="${sw+5}" stroke-linejoin="round">${P.s.map(s=>shapeSvg(s)).join('')}</g>`;
  h+=`<g fill="${ink.f}" stroke="${ink.o}" stroke-width="${sw}" stroke-linejoin="round">${P.s.map(s=>shapeSvg(s)).join('')}</g>`;
  const det=[]; for(let i=0;i<P.d.length;i++){ const d=P.d[i]; if(d==='c'){ det.push(`<circle cx="${P.d[i+1]}" cy="${P.d[i+2]}" r="${P.d[i+3]}" fill="${ink.d}"/>`); i+=3; } else det.push(`<path d="${d}"/>`); }
  if(set!=='flat'||black) h+=`<g fill="none" stroke="${ink.d}" stroke-width="${set==='minimal'?3:2.6}" stroke-linecap="round" stroke-linejoin="round">${det.join('')}</g>`;
  if(P.e) h+=shapeSvg(P.e,` fill="${ink.d}"`);
  if(set==='glass') h+=`<g fill="none" stroke="#fff" stroke-opacity="${black?.35:.8}" stroke-width="2.2" stroke-linecap="round">${t==='P'?'<path d="M43 22Q46 18 51 17"/>':'<path d="M38 82L46 82"/>'}</g>`;
  return h; }
const GLASS_DEFS='<defs><linearGradient id="pgW" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e3e9f2"/><stop offset="1" stop-color="#b9c4d4"/></linearGradient><linearGradient id="pgB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b6170"/><stop offset=".5" stop-color="#262a33"/><stop offset="1" stop-color="#0c0d12"/></linearGradient></defs>';
// symbols for one set: <symbol id="pc-wK"> … for use with <use href="#pc-wK">
function pieceSymbols(set){ let h=set==='glass'?GLASS_DEFS:''; for(const c of 'wb') for(const t of 'KQRBNP') h+=`<symbol id="pc-${c}${t}" viewBox="0 0 100 100">${pieceBody(set,t,c==='b')}</symbol>`; return h; }
// a stand-alone piece (previews, captured bars)
function pieceSvg(set,t,black,size){ return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${set==='glass'?GLASS_DEFS:''}${pieceBody(set,t,black)}</svg>`; }
const pcLetter=pc=>'PNBRQK'[(pc&7)-1];
