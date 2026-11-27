// Small drawings for the game tiles, in the theme's colours.
function art(kind){ const a='var(--accent)', s='var(--sub)';
  if(kind==='sweep'){ const n=[['','1','',''],['1','2','⚑',''],['','2','3','1'],['','1','⚑','1']]; let c='';
    n.forEach((r,y)=>r.forEach((v,x)=>{ const X=4+x*15,Y=4+y*14, open=v!=='⚑'&&!(x===3&&y<2);
      c+=`<rect x="${X}" y="${Y}" width="13" height="12" rx="2.5" fill="${open?'var(--panel)':a}" opacity="${open?1:.85}"/>`;
      if(v&&v!=='⚑') c+=`<text x="${X+6.5}" y="${Y+9.3}" font-size="8.5" font-weight="800" text-anchor="middle" fill="${a}" font-family="Inter,sans-serif">${v}</text>`;
      if(v==='⚑') c+=`<path d="M${X+5} ${Y+9.5}V${Y+2.5}l4.5 2-4.5 2" fill="var(--accentInk)" stroke="var(--accentInk)" stroke-width="1"/>`; }));
    return `<svg viewBox="0 0 66 62" width="70" height="60">${c}</svg>`; }
  if(kind==='snake') return `<svg viewBox="0 0 70 50" width="74" height="54"><path d="M8 38h18V14h18v22h14" fill="none" stroke="${s}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="58" cy="36" r="2" fill="var(--bg)"/><circle cx="60" cy="14" r="4" fill="${s}"/></svg>`;
  if(kind==='tiles'){ const v=[['2','4','8'],['','16','32'],['','','64']]; let c='';
    v.forEach((r,y)=>r.forEach((n,x)=>{ const X=6+x*20,Y=2+y*18, on=n!=='', big=n.length>1;
      c+=`<rect x="${X}" y="${Y}" width="18" height="16" rx="3" fill="${on?a:'var(--panel)'}" opacity="${on?(0.45+n.length*.2):1}"/>`;
      if(on) c+=`<text x="${X+9}" y="${Y+11.3}" font-size="${big?7.5:9}" font-weight="800" text-anchor="middle" fill="var(--accentInk)" font-family="Inter,sans-serif">${n}</text>`; }));
    return `<svg viewBox="0 0 72 56" width="76" height="58">${c}</svg>`; }
  if(kind==='linefall'){ // a narrow well: a settled stack with one row about to clear, and a piece falling in
    const C=7, cell=7.2, X0=36-C*cell/2, Y0=4, rows=['.......','...##..','.......','.......','#..#...','##.####','#######'], on=new Set(['1,3','1,4','2,4']);
    let c=`<rect x="${X0-2}" y="${Y0-2}" width="${C*cell+4}" height="${rows.length*cell+4}" rx="3" fill="var(--panel)"/>`;
    rows.forEach((r,y)=>[...r].forEach((v,x)=>{ const fall=y<3; if(v!=='#'&&!(fall&&on.has(y+','+x))) return;
      c+=`<rect x="${X0+x*cell+.6}" y="${Y0+y*cell+.6}" width="${cell-1.2}" height="${cell-1.2}" rx="1.4" fill="${a}" opacity="${fall?1:y===6?.95:.55}"/>`; }));
    return `<svg viewBox="0 0 72 60" width="76" height="62">${c}</svg>`; }
  if(kind==='drift'){ // a ship with a thruster trail, firing at a cracked rock, with two small rocks drifting
    const rock=(cx,cy,r,o)=>{ let d=''; for(let i=0;i<9;i++){ const ang=i/9*6.283, k=r*(.78+.22*((i*7+3)%5)/4); d+=(i?'L':'M')+(cx+Math.cos(ang)*k).toFixed(1)+' '+(cy+Math.sin(ang)*k).toFixed(1); }
      return `<path d="${d}Z" fill="none" stroke="${s}" stroke-width="2" stroke-linejoin="round" opacity="${o}"/>`; };
    return `<svg viewBox="0 0 72 56" width="76" height="58">${rock(52,18,12,1)}<path d="M48 14l4 5-2 4" fill="none" stroke="${s}" stroke-width="1.3"/>${rock(60,42,5,.8)}${rock(36,8,4,.7)}
      <path d="M8 46l10-3" stroke="${s}" stroke-width="2" stroke-linecap="round" opacity=".35"/><path d="M12 49l7-2.5" stroke="${s}" stroke-width="1.5" stroke-linecap="round" opacity=".25"/>
      <path d="M30 36L17 40l4-6-4-7z" fill="${a}" transform="rotate(-8 24 36)"/>
      <circle cx="35" cy="31" r="1.6" fill="${a}"/><circle cx="40" cy="27.5" r="1.6" fill="${a}"/></svg>`; }
  if(kind==='tilecraft'){ // letter tiles crossing on a board, with their point values
    const T=(x,y,ch,v)=>`<rect x="${x}" y="${y}" width="13" height="13" rx="2.5" fill="${a}"/><text x="${x+6.2}" y="${y+10}" font-size="9" font-weight="800" text-anchor="middle" fill="var(--accentInk)" font-family="Inter,sans-serif">${ch}</text><text x="${x+11.2}" y="${y+11.6}" font-size="3.6" font-weight="700" text-anchor="end" fill="var(--accentInk)" font-family="Inter,sans-serif">${v}</text>`;
    let g=''; for(let y=0;y<4;y++) for(let x=0;x<5;x++) g+=`<rect x="${4+x*14}" y="${2+y*14}" width="13" height="13" rx="2" fill="var(--panel)"/>`;
    return `<svg viewBox="0 0 74 58" width="76" height="60">${g}<rect x="46" y="44" width="13" height="13" rx="2" fill="${s}" opacity=".35"/>${T(4,16,'W',5)}${T(18,16,'O',1)}${T(32,16,'R',1)}${T(46,16,'D',2)}${T(32,2,'A',1)}${T(32,30,'Y',4)}</svg>`; }
  if(kind==='solitaire'){ // a fanned column of cards
    const card=(x,y,r,lbl,red)=>`<g transform="rotate(${r} ${x+11} ${y+30})"><rect x="${x}" y="${y}" width="22" height="30" rx="3" fill="var(--panel)" stroke="${s}" stroke-width="1.2"/><text x="${x+4}" y="${y+10}" font-size="8" font-weight="800" fill="${red?'#c8463d':a}" font-family="Inter,sans-serif">${lbl}</text></g>`;
    return `<svg viewBox="0 0 74 58" width="76" height="60">${card(14,16,-14,'K',0)}${card(26,12,0,'Q',1)}${card(38,16,14,'A',0)}</svg>`; }
  if(kind==='mahjong'){ // stacked tiles with offset shadows
    const tile=(x,y,o,m)=>`<rect x="${x+2}" y="${y+2}" width="14" height="18" rx="2.5" fill="${s}" opacity=".35"/><rect x="${x}" y="${y}" width="14" height="18" rx="2.5" fill="var(--panel)" stroke="${s}" stroke-width="1"/>${m}`;
    const dots=(x,y,n)=>[...Array(n)].map((_,i)=>`<circle cx="${x+4+(i%2)*6}" cy="${y+5+Math.floor(i/2)*4.5}" r="1.6" fill="${a}"/>`).join('');
    const bars=(x,y)=>`<rect x="${x+4}" y="${y+4}" width="2" height="10" rx="1" fill="${a}"/><rect x="${x+8}" y="${y+4}" width="2" height="10" rx="1" fill="${a}"/>`;
    return `<svg viewBox="0 0 74 58" width="76" height="60">${tile(8,30,1,dots(8,30,4))}${tile(23,30,1,bars(23,30))}${tile(38,30,1,dots(38,30,2))}${tile(53,30,1,bars(53,30))}${tile(16,10,1,dots(16,10,6))}${tile(31,10,1,bars(31,10))}${tile(46,10,1,dots(46,10,3))}</svg>`; }
  if(kind==='sudoku'){ // a 3x3 box of a grid, part filled, with heavier box lines
    const v=['5','','8','','3','','1','','9']; let c='';
    v.forEach((n,i)=>{ const x=17+(i%3)*13, y=6+Math.floor(i/3)*15; c+=`<rect x="${x}" y="${y}" width="12" height="14" rx="1.5" fill="var(--panel)"/>`;
      if(n) c+=`<text x="${x+6}" y="${y+10.5}" font-size="9" font-weight="800" text-anchor="middle" fill="${i===4?a:s}" font-family="Inter,sans-serif">${n}</text>`; });
    return `<svg viewBox="0 0 74 58" width="76" height="60"><rect x="15" y="4" width="43" height="50" rx="3" fill="none" stroke="${a}" stroke-width="1.6"/>${c}</svg>`; }
  if(kind==='chess'){ // a corner of the board with a knight standing on it
    let c=''; for(let y=0;y<4;y++) for(let x=0;x<5;x++) c+=`<rect x="${4+x*13}" y="${4+y*12.5}" width="13" height="12.5" fill="${(x+y)%2?s:'var(--panel)'}" opacity="${(x+y)%2?.35:1}"/>`;
    return `<svg viewBox="0 0 74 58" width="76" height="60"><g>${c}</g><path d="M30 50h22l-1.5-5h-2.5c-1-6 1-10 4-15l-1-9c-1-3-4-6-9-7l-1.5-3-2 3.5-1.5-2-1 3.5c-4 3-6 7-7 12l3 2.5 3-2.5 4-1c-2 4-6 7-8 11v3h-2z" fill="${a}" stroke="var(--bg)" stroke-width="1.4" stroke-linejoin="round"/><circle cx="37" cy="21" r="1.3" fill="var(--accentInk)"/></svg>`; }
  if(kind==='quintessence'){ // a small board of element gems with a Prism star in the middle
    const g=(x,y,k)=>{ const o=[1,.55,.3][k]; return k===0?`<path d="M${x} ${y-6}l6 6-6 6-6-6z" fill="${a}" opacity="${o}"/>`:k===1?`<circle cx="${x}" cy="${y}" r="5.5" fill="${a}" opacity="${o}"/>`:`<rect x="${x-5}" y="${y-5}" width="10" height="10" rx="2.5" fill="${a}" opacity="${o+.15}"/>`; };
    let c=''; const pat=[[0,1,2,1,0],[2,0,-1,2,1],[1,2,0,1,2]];
    pat.forEach((r,y)=>r.forEach((k,x)=>{ if(k>=0) c+=g(9+x*14,10+y*15,k); }));
    return `<svg viewBox="0 0 74 48" width="80" height="52">${c}<path d="M37 16l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="${a}" stroke="var(--bg)" stroke-width="1.2" stroke-linejoin="round"/></svg>`; }
  if(kind==='nono'){ let c=''; const g=['01110','11011','11111','01010','01110']; g.forEach((r,y)=>[...r].forEach((v,x)=>{ c+=`<rect x="${10+x*10}" y="${3+y*10}" width="9" height="9" rx="1.5" fill="${v==='1'?s:'var(--panel)'}"/>`; })); return `<svg viewBox="0 0 70 56" width="74" height="58">${c}</svg>`; }
  return `<svg viewBox="0 0 70 50" width="74" height="54"><path d="M10 30h50l-7 10H17z" fill="${s}"/><path d="M26 30V16h16v14M33 16V8" fill="none" stroke="${s}" stroke-width="3"/><path d="M6 44q6-4 12 0t12 0 12 0 12 0 12 0" fill="none" stroke="${s}" stroke-width="2"/></svg>`; }

