// ===================== Mahjong tile art (our own vector drawings) =====================
// faceSvg(face, setId, opts) returns SVG markup for one face in a 60×80 box. No emoji, no Unicode mahjong characters:
// pips, sticks, brush-stroke numerals, compass letters, dragon emblems, flowers and seasons are all drawn as paths.
// Five face sets share the drawings and change how they're painted: Classic, Minimal, Ink Brush, Pixel, Neon.
// High-contrast (always free) adds strong colours and a corner label such as B5, C3, D7, EW or RD.

const FACESETS={
 classic:{name:'Classic',red:'#c62f3a',green:'#1d8048',blue:'#1d5aa3',ink:'#1f2a44',gold:'#c58a12',pink:'#d9577a',purple:'#7a4fb3',pip:'ring',sw:1},
 minimal:{name:'Minimal',red:'#e0393e',green:'#13924f',blue:'#2463d1',ink:'#111827',gold:'#e09b0c',pink:'#e5537d',purple:'#7c4dd6',pip:'solid',sw:1.35},
 ink:{name:'Ink Brush',red:'#b3261e',green:'#2a2a2a',blue:'#2a2a2a',ink:'#1a1a1a',gold:'#b3261e',pink:'#b3261e',purple:'#2a2a2a',pip:'inkring',sw:1.15,brush:1},
 pixel:{name:'Pixel',red:'#d6283b',green:'#10a35a',blue:'#2a6ae0',ink:'#1b1b2e',gold:'#e6a100',pink:'#e04f86',purple:'#8a4fe0',pip:'square',sw:1.2,px:1},
 neon:{name:'Neon',red:'#ff4d6d',green:'#2bff88',blue:'#3fc8ff',ink:'#e9f1ff',gold:'#ffd23f',pink:'#ff6ad5',purple:'#b48cff',pip:'neon',sw:1,glow:1},
};
const HC={red:'#c00018',green:'#006b2e',blue:'#0033a8',ink:'#000000',gold:'#8a5a00',pink:'#b0005a',purple:'#5a1fa8'};
// tile bodies: face colour, side colour, edge
const BODIES={
 ivory:{name:'Ivory',face:'#fbf7ec',face2:'#efe7d3',side:'#d8cba9',side2:'#3e7f62',edge:'#c9bd9c'},
 jade:{name:'Jade',face:'#f1f8f2',face2:'#dcefe1',side:'#5aa580',side2:'#2f6b52',edge:'#8cc4a6'},
 bamboo:{name:'Bamboo',face:'#fbf3dc',face2:'#efe0b8',side:'#c79a4e',side2:'#8a6428',edge:'#d6b273'},
 glass:{name:'Glass',face:'#f4fbff',face2:'#d9ecf6',side:'#9cc6dc',side2:'#6c9fba',edge:'#bfe0ef',glass:1},
 obsidian:{name:'Obsidian',face:'#2b2e37',face2:'#1d1f26',side:'#0f1014',side2:'#000000',edge:'#40444f',dark:1},
};

// ---- shapes ----
const PIP_POS={1:[[30,40]],2:[[30,22],[30,58]],3:[[16,18],[30,40],[44,62]],4:[[18,22],[42,22],[18,58],[42,58]],5:[[17,19],[43,19],[30,40],[17,61],[43,61]],
 6:[[19,17],[41,17],[19,40],[41,40],[19,63],[41,63]],7:[[13,13],[30,22],[47,31],[19,50],[41,50],[19,67],[41,67]],
 8:[[19,13],[41,13],[19,31],[41,31],[19,49],[41,49],[19,67],[41,67]],9:[[14,17],[30,17],[46,17],[14,40],[30,40],[46,40],[14,63],[30,63],[46,63]]};
const PIP_R={1:17,2:11,3:9,4:10,5:9,6:8.5,7:7.5,8:7.5,9:7.5};
function pipCol(n,k,C){ if(n===1) return C.red; if(n===2) return [C.green,C.blue][k]; if(n===3) return [C.blue,C.red,C.green][k];
  if(n===4) return [C.blue,C.green,C.green,C.blue][k]; if(n===5) return k===2?C.red:[C.blue,C.green,0,C.green,C.blue][k];
  if(n===6) return k<2?C.green:C.red; if(n===7) return k<3?C.green:C.red; if(n===8) return C.blue; return [C.blue,C.blue,C.blue,C.red,C.red,C.red,C.green,C.green,C.green][k]; }
function pip(x,y,r,col,S,C){
  if(S.pip==='square'){ const s=Math.round(r*1.6); return `<rect x="${x-s/2}" y="${y-s/2}" width="${s}" height="${s}" fill="${col}"/><rect x="${x-s/5}" y="${y-s/5}" width="${s/2.5}" height="${s/2.5}" fill="${C.bg}"/>`; }
  if(S.pip==='solid') return `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}"/>`;
  if(S.pip==='neon') return `<circle cx="${x}" cy="${y}" r="${r*.82}" fill="none" stroke="${col}" stroke-width="${r*.5}" opacity=".35"/><circle cx="${x}" cy="${y}" r="${r*.82}" fill="none" stroke="${col}" stroke-width="${r*.22}"/>`;
  if(S.pip==='inkring') return `<circle cx="${x}" cy="${y}" r="${r*.8}" fill="none" stroke="${col}" stroke-width="${r*.38}"/><circle cx="${x}" cy="${y}" r="${r*.18}" fill="${col}"/>`;
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}"/><circle cx="${x}" cy="${y}" r="${r*.62}" fill="${C.bg}"/><circle cx="${x}" cy="${y}" r="${r*.36}" fill="${col}"/>`; }
function dots(n,S,C){ const r=PIP_R[n]; let o=''; PIP_POS[n].forEach(([x,y],k)=>o+=pip(x,y,r,pipCol(n,k,C),S,C)); if(n===1&&S.pip==='ring') o+=`<circle cx="30" cy="40" r="22" fill="none" stroke="${C.green}" stroke-width="2.2"/>`; return o; }
// a bamboo stick, centred on x, from y to y+h
function stick(x,y,h,col,S){ const w=S.px?6:5.4*S.sw;
  if(S.px) return `<rect x="${x-w/2}" y="${y}" width="${w}" height="${h}" fill="${col}"/><rect x="${x-w/2-1}" y="${y+h/2-1}" width="${w+2}" height="2" fill="${col}"/>`;
  if(S.glow) return `<path d="M${x} ${y+2}V${y+h-2}" stroke="${col}" stroke-width="${w+4}" stroke-linecap="round" opacity=".3"/><path d="M${x} ${y+2}V${y+h-2}" stroke="${col}" stroke-width="${w*.5}" stroke-linecap="round"/><path d="M${x-3} ${y+h/2}h6" stroke="${col}" stroke-width="1.6"/>`;
  return `<rect x="${x-w/2}" y="${y}" width="${w}" height="${h}" rx="${w/2}" fill="${col}"/><path d="M${x-w/2} ${y+h/2}h${w}M${x} ${y+3}v${h/2-6}" stroke="${S.brush?'#fff':'rgba(255,255,255,.55)'}" stroke-width="1.1"/>`; }
const BAM={2:[[30,8,30],[30,42,30]],3:[[30,8,30],[18,42,30],[42,42,30]],4:[[19,8,30],[41,8,30],[19,42,30],[41,42,30]],5:[[14,8,30],[46,8,30],[30,25,30],[14,42,30],[46,42,30]],
 6:[[14,8,30],[30,8,30],[46,8,30],[14,42,30],[30,42,30],[46,42,30]],7:[[30,5,20],[14,28,22],[30,28,22],[46,28,22],[14,54,22],[30,54,22],[46,54,22]],
 8:[[11,8,30],[24,8,30],[37,8,30],[50,8,30],[11,42,30],[24,42,30],[37,42,30],[50,42,30]],9:[[14,5,21],[30,5,21],[46,5,21],[14,30,21],[30,30,21],[46,30,21],[14,55,21],[30,55,21],[46,55,21]]};
function bamboo(n,S,C){ if(n===1){ // our own: a single stalk with two leaves and a bud
    const st=S.sw*4; return `<path d="M30 70V16" stroke="${C.green}" stroke-width="${st+2}" stroke-linecap="${S.px?'square':'round'}"/><path d="M26 34h8M26 52h8" stroke="${C.bg}" stroke-width="1.6"/>`+
      `<path d="M30 30C20 26 14 18 12 10C22 12 28 18 30 30Z" fill="${C.green}"/><path d="M30 44C40 40 47 33 49 24C39 26 32 33 30 44Z" fill="${C.green}"/><circle cx="30" cy="12" r="${S.px?5:5.5}" fill="${C.red}"/>`; }
  let o=''; BAM[n].forEach(([x,y,h],k)=>{ const red=(n===5&&k===2)||(n===7&&k===0)||(n===9&&(k===1||k===4||k===7)); o+=stick(x,y,h,red?C.red:n===8&&k%3===0?C.blue:C.green,S); }); return o; }
// brush-stroke numerals 一 … 九, drawn as our own strokes in a 40×30 box
const NUM_STROKES={1:['M5 15H35'],2:['M9 9H31','M5 21H35'],3:['M8 5H32','M10 15H30','M5 25H35'],
 4:['M6 5V27H34V5Z','M15 5C15 14 13 18 10 21','M24 5V17Q24 20 28 20'],5:['M8 5H32','M19 5L15 26','M10 15H28V26','M4 26H36'],
 6:['M19 2L22 7','M5 11H35','M16 15L8 27','M24 15L32 27'],7:['M4 15L36 10','M16 3V22Q16 27 22 27H34'],8:['M15 5Q14 20 5 27','M25 5Q27 20 36 26'],
 9:['M6 11H25Q31 11 29 20Q28 27 34 27L36 22','M17 3Q17 20 7 27']};
function chars(n,S,C){ const sw=(S.brush?4.2:3.2)*S.sw, cap=S.px?'square':'round', join=S.px?'miter':'round';
  const strokes=NUM_STROKES[n].map(d=>S.glow?`<path d="${d}" stroke="${C.ink}" stroke-width="${sw+4}" opacity=".25"/><path d="${d}" stroke="${C.ink}" stroke-width="${sw*.6}"/>`:`<path d="${d}" stroke="${C.ink}" stroke-width="${sw}"/>`).join('');
  // under the numeral: our own red seal (a square with a coiled mark), standing for the suit
  const seal=S.glow?`<rect x="15" y="45" width="30" height="27" rx="5" fill="none" stroke="${C.red}" stroke-width="2.4"/><path d="M22 52H38V65H26V57H33" fill="none" stroke="${C.red}" stroke-width="2.4"/>`
    :`<rect x="15" y="45" width="30" height="27" rx="${S.px?0:5}" fill="${C.red}"/><path d="M22 52H38V65H26V57H33" fill="none" stroke="${C.bg}" stroke-width="2.6" stroke-linecap="${cap}"/>`;
  return `<g transform="translate(10 7)" fill="none" stroke-linecap="${cap}" stroke-linejoin="${join}">${strokes}</g>${seal}`; }
// winds: a compass letter with a pointer showing the direction
const WIND_PATHS={0:'M24 4H8V32H24M8 18H21',1:'M24 8Q20 3 15 3Q7 3 7 10Q7 16 15 18Q24 20 24 26Q24 33 15 33Q9 33 6 28',2:'M3 4L9 32L15 12L21 32L27 4',3:'M7 32V4L23 32V4'};
function wind(n,S,C){ const sw=4.2*S.sw, cap=S.px?'square':'round';
  const ang=[90,180,270,0][n], ptr=`<g transform="rotate(${ang} 30 64)"><path d="M30 54L36 70H24Z" fill="${C.red}"/></g><circle cx="30" cy="64" r="11" fill="none" stroke="${C.ink}" stroke-width="1.6" opacity=".55"/>`;
  const letter=S.glow?`<path d="${WIND_PATHS[n]}" stroke="${C.blue}" stroke-width="${sw+5}" opacity=".3"/><path d="${WIND_PATHS[n]}" stroke="${C.blue}" stroke-width="${sw*.6}"/>`:`<path d="${WIND_PATHS[n]}" stroke="${C.ink}" stroke-width="${sw}"/>`;
  return `<g transform="translate(15 6)" fill="none" stroke-linecap="${cap}" stroke-linejoin="${S.px?'miter':'round'}">${letter}</g>${ptr}`; }
// dragons: red flame pearl, green jade peaks, white frame
function dragon(n,S,C){ const g=S.glow;
  if(n===0) return `<circle cx="30" cy="40" r="21" fill="none" stroke="${C.red}" stroke-width="${3*S.sw}"/><path d="M30 20C38 30 44 36 41 47C39 55 33 59 30 59C24 59 18 54 18 46C18 39 23 35 25 29C27 35 30 37 32 38C33 32 32 26 30 20Z" fill="${g?'none':C.red}" stroke="${C.red}" stroke-width="2"/>${g?'':`<path d="M28 44C28 50 31 53 33 53C30 48 33 45 31 41Z" fill="${C.bg}"/>`}`;
  if(n===1) return `<path d="M6 64L20 30L28 46L36 22L54 64Z" fill="${g?'none':C.green}" stroke="${C.green}" stroke-width="2.4" stroke-linejoin="round"/><path d="M32 32L36 22L40 32Z" fill="${C.bg}"/><path d="M17 38L20 30L23 38Z" fill="${C.bg}"/><path d="M6 70H54" stroke="${C.green}" stroke-width="3"/>`;
  return `<rect x="9" y="10" width="42" height="60" rx="${S.px?0:6}" fill="none" stroke="${C.blue}" stroke-width="${3.4*S.sw}"/><rect x="16" y="17" width="28" height="46" rx="${S.px?0:3}" fill="none" stroke="${C.blue}" stroke-width="1.6"/>`; }
// flowers: plum, orchid, chrysanthemum, peony; seasons: sprout, sun, leaf, snowflake. The small number is 1–4.
function petals(cx,cy,n,r,w,col,rot){ let o=''; for(let k=0;k<n;k++){ const a=(k/n)*360+(rot||0); o+=`<ellipse cx="${cx}" cy="${cy-r}" rx="${w}" ry="${r}" transform="rotate(${a} ${cx} ${cy})" fill="${col}"/>`; } return o; }
function flower(n,S,C){ const stem=`<path d="M30 70C30 60 31 52 30 44" stroke="${C.green}" stroke-width="2.4" fill="none"/><path d="M30 60C24 58 20 54 19 50C25 51 29 55 30 60Z" fill="${C.green}"/>`;
  let head;
  if(n===1) head=petals(30,32,5,9,7,C.pink)+`<circle cx="30" cy="32" r="4" fill="${C.gold}"/>`;
  else if(n===2) head=petals(30,32,3,12,5,C.purple,0)+petals(30,32,3,8,3.5,C.pink,60)+`<circle cx="30" cy="32" r="3" fill="${C.gold}"/>`;
  else if(n===3) head=petals(30,32,14,11,2.2,C.gold)+`<circle cx="30" cy="32" r="5" fill="${C.red}"/>`;
  else head=petals(30,32,6,11,7,C.red,15)+petals(30,32,6,7,5,C.pink,45)+`<circle cx="30" cy="32" r="3.5" fill="${C.gold}"/>`;
  return stem+head+numBadge(n,C.red,C); }
function season(n,S,C){ let o;
  if(n===1) o=`<path d="M30 68V38" stroke="${C.green}" stroke-width="3"/><path d="M30 44C20 42 14 34 14 24C24 26 30 34 30 44Z" fill="${C.green}"/><path d="M30 40C40 38 46 30 46 20C36 22 30 30 30 40Z" fill="${C.green}"/><path d="M16 70H44" stroke="${C.gold}" stroke-width="3"/>`;
  else if(n===2){ let rays=''; for(let k=0;k<12;k++) rays+=`<path d="M30 ${16}V${9}" transform="rotate(${k*30} 30 38)" stroke="${C.gold}" stroke-width="3" stroke-linecap="round"/>`; o=rays+`<circle cx="30" cy="38" r="14" fill="${C.gold}"/><circle cx="30" cy="38" r="8" fill="${C.red}" opacity=".7"/>`; }
  else if(n===3) o=`<path d="M30 14L34 26L44 20L41 32L52 34L42 41L48 50L36 48L34 60L30 52L26 60L24 48L12 50L18 41L8 34L19 32L16 20L26 26Z" fill="${C.red}"/><path d="M30 26V70" stroke="${C.gold}" stroke-width="2.4"/>`;
  else { let a=''; for(let k=0;k<6;k++) a+=`<g transform="rotate(${k*60} 30 38)"><path d="M30 38V16M30 22L25 17M30 22L35 17M30 29L24 24M30 29L36 24" stroke="${C.blue}" stroke-width="2.6" stroke-linecap="round" fill="none"/></g>`; o=a; }
  return o+numBadge(n,C.blue,C); }
function numBadge(n,col,C){ return `<circle cx="49" cy="70" r="7" fill="${col}"/><text x="49" y="73.6" text-anchor="middle" font-family="Inter,sans-serif" font-weight="800" font-size="10" fill="${C.bg}">${n}</text>`; }

// opts: {hc (High-contrast), dark (the body is dark: ink colours turn light)}
function faceSvg(f,setId,opts){ opts=opts||{}; const S=FACESETS[setId]||FACESETS.classic;
  const C=Object.assign({},S,opts.hc?HC:{}); C.bg=opts.bg||'#fbf7ec';
  if(opts.dark&&!S.glow){ C.ink='#f1f1f4'; if(!opts.hc){ C.blue='#7fb4ff'; C.green='#4fd28c'; C.red='#ff6b6b'; } else { C.ink='#ffffff'; C.blue='#9cc8ff'; C.green='#5ef59a'; C.red='#ff7b86'; C.gold='#ffd34d'; } }
  if(S.glow&&!opts.dark){ // Neon on a light body: deepen the colours so they read
    Object.assign(C,{red:'#e0144a',green:'#00a85a',blue:'#0a7fd0',ink:'#14203a',gold:'#d49a00',pink:'#d4239a',purple:'#7a3fe0'}); }
  const i=faceInfo(f); let o;
  if(i.suit==='dots') o=dots(i.n,S,C); else if(i.suit==='bam') o=bamboo(i.n,S,C); else if(i.suit==='char') o=chars(i.n,S,C);
  else if(i.suit==='wind') o=wind(i.n,S,C); else if(i.suit==='dragon') o=dragon(i.n,S,C); else if(i.suit==='flower') o=flower(i.n,S,C); else o=season(i.n,S,C);
  if(opts.hc){ // corner label, and the drawing pulled in a little to make room
    o=`<g transform="translate(9 10) scale(.82)">${o}</g><rect x="1" y="1" width="27" height="15" rx="4" fill="${opts.dark?'#ffffff':'#000000'}"/><text x="14.5" y="13" text-anchor="middle" font-family="Inter,sans-serif" font-weight="800" font-size="12" fill="${opts.dark?'#000000':'#ffffff'}">${faceLabel(f)}</text>`; }
  if(S.px) o=`<g shape-rendering="crispEdges">${o}</g>`;
  return o; }
// the back of a tile (Fog)
function backSvg(body){ const B=BODIES[body]||BODIES.ivory; return `<rect x="6" y="6" width="48" height="68" rx="6" fill="${B.side2}" opacity=".9"/><path d="M14 40L30 18L46 40L30 62Z" fill="none" stroke="${B.face}" stroke-width="2.4" opacity=".7"/><circle cx="30" cy="40" r="5" fill="${B.face}" opacity=".7"/>`; }
