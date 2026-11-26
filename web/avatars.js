// Arcade avatars, shared by the Arcade and every game (served as /arcade/avatars.js; games load ../avatars.js).
// Share codes carry an avatar as its number: its position in LIST plus 1 (0 = none, shown as a letter badge).
// So NEVER reorder or remove entries; only add new ones at the end.
(function(){
const LIST=[
  {id:'pad',name:'Controller',bg:'#cde3ff',pal:{k:'#2b2d42',w:'#ffffff',r:'#ef476f',g:'#06d6a0'},px:['..........','..........','.kkkkkkkk.','kkwkkkkrkk','kwwwkkgkrk','kkwkkkkgkk','kkkkkkkkkk','kkk....kkk','..........','..........']},
  {id:'heart',name:'Heart',bg:'#ffe1e6',pal:{r:'#e63946',w:'#ffffff'},px:['..........','.rrr..rrr.','rrrrrrrrrr','rwwrrrrrrr','rwrrrrrrrr','rrrrrrrrrr','.rrrrrrrr.','..rrrrrr..','...rrrr...','....rr....']},
  {id:'mine',game:'sweep',name:'Mine',bg:'#e9ecef',pal:{k:'#1d1d1f',w:'#ffffff'},px:['....k.....','.k..k..k..','..kkkkk...','..kwkkk...','kkkwkkkkk.','..kkkkk...','..kkkkk...','.k..k..k..','....k.....','..........']},
  {id:'ship',game:'shipfight',name:'Ship',bg:'#bde0fe',pal:{g:'#6c757d',d:'#343a40',w:'#ffffff',b:'#3a86ff',r:'#e63946'},px:['....r.....','....rr....','....d.....','...ggg....','..gwgwg...','.ddddddd..','dddddddddd','.dddddddd.','bbbbbbbbbb','.b..b..b..']},
  {id:'snake',game:'snake',name:'Snake',bg:'#d8f3dc',pal:{g:'#2d6a4f',l:'#52b788',w:'#ffffff',k:'#1d1d1f',r:'#e63946'},px:['..........','..gggggg..','.gllllllg.','.glwllwlg.','.glkllklg.','.gllllllg.','..gllllg..','...gggg...','....rr....','...r..r...']},
  {id:'tile2',game:'t2048',name:'Tile',bg:'#fde2a7',pal:{o:'#f4a261',w:'#ffffff'},px:['oooooooooo','oooooooooo','ooowwwwooo','oooooowooo','oooooowooo','ooowwwwooo','ooowoooooo','ooowwwwooo','oooooooooo','oooooooooo']},
  {id:'blocks',game:'linefall',name:'Blocks',bg:'#e0e1ff',pal:{p:'#7b2cbf',c:'#00b4d8',y:'#ffb703'},px:['..........','...ppp....','....p.....','..........','..........','c.........','cc.....yy.','cc.y...yy.','cccyyy.yyy','cccyyyyyyy']},
  {id:'rocket',game:'drift',name:'Rocket',bg:'#1b263b',pal:{w:'#e0e1dd',r:'#e63946',o:'#ffb703',b:'#4cc9f0'},px:['....ww....','...wwww...','...wbbw...','...wbbw...','...wwww...','..rwwwwr..','.rrwwwwrr.','....oo....','...o..o...','....oo....']},
  {id:'letter',game:'tilecraft',name:'Letter',bg:'#f1e3d3',pal:{t:'#c9a27e',k:'#3e2723'},px:['..........','.tttttttt.','.tttkkttt.','.ttkttktt.','.ttkttktt.','.ttkkkktt.','.ttkttktt.','.ttkttktt.','.tttttttt.','..........']},
  {id:'ace',game:'solitaire',name:'Ace',bg:'#d8f3dc',pal:{w:'#ffffff',k:'#1d1d1f',g:'#adb5bd'},px:['.gggggggg.','.gwwwwwwg.','.gwwkkwwg.','.gwkkkkwg.','.gkkkkkkg.','.gkkkkkkg.','.gwwkkwwg.','.gwkkkkwg.','.gwwwwwwg.','.gggggggg.']},
  {id:'dots',game:'mahjong',name:'Dots',bg:'#fef3c7',pal:{i:'#fffaf0',e:'#c9b68a',g:'#2a9d8f',r:'#e63946'},px:['.eeeeeeee.','.eiiiiiie.','.eigiigie.','.eiiiiiie.','.eiirriie.','.eiirriie.','.eiiiiiie.','.eigiigie.','.eiiiiiie.','.eeeeeeee.']},
  {id:'grid',game:'sudoku',name:'Grid',bg:'#dbeafe',pal:{l:'#94a3b8',b:'#2563eb',w:'#ffffff'},px:['llllllllll','lwwlwwlbbl','lwwlwwlbbl','llllllllll','lbblwwlwwl','lbblwwlwwl','llllllllll','lwwlbblwwl','lwwlbblwwl','llllllllll']},
];
const byId=id=>LIST.find(a=>a.id===id)||null;
const byIdx=n=>LIST[(n|0)-1]||null;
const idx=id=>LIST.findIndex(a=>a.id===id)+1;
// Unlocked: free avatars always; a game's avatar once that game has been played (its Arcade summary exists).
const open=a=>{ if(!a.game) return true; try{ return !!localStorage.getItem('arcade.summary.'+a.game); }catch(e){ return false; } };
function svg(a,size){ let r='';
  a.px.forEach((row,y)=>{ let x=0; while(x<10){ const c=row[x]; let n=1; while(x+n<10&&row[x+n]===c) n++;
    if(c!=='.') r+='<rect x="'+(x+1)+'" y="'+(y+1)+'" width="'+n+'" height="1" fill="'+a.pal[c]+'"/>'; x+=n; } });
  return '<span class="av" style="display:inline-block;flex:none;vertical-align:middle;overflow:hidden;width:'+size+'px;height:'+size+'px;border-radius:'+Math.round(size*.28)+'px"><svg viewBox="0 0 12 12" width="'+size+'" height="'+size+'" style="display:block" shape-rendering="crispEdges"><rect width="12" height="12" fill="'+a.bg+'"/>'+r+'</svg></span>'; }
// A player's badge: their avatar, or the first letter of their name on a grey tile.
function html(n,name,size){ const a=byIdx(n); if(a) return svg(a,size);
  const ch=[...String(name||'?').trim()][0]||'?', e=ch.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  return '<span class="av" style="display:inline-flex;flex:none;vertical-align:middle;align-items:center;justify-content:center;width:'+size+'px;height:'+size+'px;border-radius:'+Math.round(size*.28)+'px;background:#9aa0a6;color:#fff;font-weight:800;font-size:'+Math.round(size*.55)+'px;line-height:1;text-transform:uppercase">'+e+'</span>'; }
// The player's own avatar number, from the Arcade save.
function mine(){ try{ const A=JSON.parse(localStorage.getItem('arcade.v1')); return A&&A.avatar?idx(A.avatar):idx('pad'); }catch(e){ return 0; } }
window.ArcadeAvatars={list:LIST,byId,byIdx,idx,open,svg,html,mine};
})();
