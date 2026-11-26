// ===================== Opening book =====================
// Written by hand: main lines of common openings (opening theory is facts; nothing copied). Every prefix of every line
// is a book position; a position's moves are weighted by how many lines continue with them, so games vary.
const BOOK_LINES=[
// Open games
'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3',
'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5',
'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4 d4 b5 Bb3 d5 dxe5 Be6',
'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5',
'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8',
'e4 e5 Nf3 Nc6 Bb5 Nf6 d3 Bc5 c3 O-O O-O d6',
'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O a6 a4 O-O',
'e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6 d3 d6 c3 O-O',
'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O Re1 d6',
'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6 Be2 h6',
'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5',
'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3 Nge7',
'e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Bb4 O-O O-O d3 d6',
'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O Be7',
'e4 e5 Nf3 d6 d4 Nf6 Nc3 Nbd7 Bc4 Be7 O-O O-O',
'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3 Be7',
'e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5 Nf6',
// Sicilian
'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7',
'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6 f4 Be7 Qf3 Qc7',
'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O O-O',
'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6',
'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6 Bg5 e6 Qd2 a6 O-O-O Bd7',
'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5',
'e4 c5 Nf3 Nc6 Bb5 g6 O-O Bg7 Re1 Nf6 c3 O-O',
'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6 Nc3 Qc7 Be3 a6 Bd3 Nf6',
'e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6 Bd3 Nf6 O-O Qc7 Qe2 d6',
'e4 c5 Nf3 d6 Bb5+ Bd7 Bxd7+ Qxd7 O-O Nc6 c3 Nf6',
'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6',
'e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6 Be3 e5',
// French, Caro-Kann, Scandinavian, Pirc, Alekhine
'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4 O-O',
'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7 Qg4 O-O',
'e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7 Bd3 c5 c3 Nc6 Ne2 cxd4 cxd4 f6',
'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 c4',
'e4 e6 d4 d5 exd5 exd5 Nf3 Nf6 Bd3 Bd6 O-O O-O',
'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7',
'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3 Nd7',
'e4 c6 d4 d5 exd5 cxd5 c4 Nf6 Nc3 e6 Nf3 Be7',
'e4 c6 Nc3 d5 Nf3 Bg4 h3 Bxf3 Qxf3 e6',
'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5',
'e4 d5 exd5 Nf6 d4 Nxd5 Nf3 g6 Be2 Bg7 O-O O-O',
'e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O c6',
'e4 g6 d4 Bg7 Nc3 d6 Be3 a6 Qd2 Nd7',
'e4 Nf6 e5 Nd5 d4 d6 Nf3 Bg4 Be2 e6 O-O Be7',
// Queen's pawn: QGD, Slav, QGA, Indian defences
'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6',
'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 c6 Bd3 Nbd7 Qc2 O-O',
'd4 d5 c4 e6 Nf3 Nf6 g3 Be7 Bg2 O-O O-O dxc4 Qc2 a6',
'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4 O-O O-O',
'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3 dxc4 Bxc4 b5 Bd3 Bb7',
'd4 d5 c4 c6 Nf3 Nf6 e3 Bf5 Nc3 e6 Nh4 Bg6',
'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6 dxc5 Qxd1 Rxd1 Bxc5',
'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O Nc6',
'd4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3 b6 Bg5 Bb7',
'd4 Nf6 c4 e6 Nf3 b6 g3 Ba6 b3 Bb4+ Bd2 Be7 Bg2 c6',
'd4 Nf6 c4 e6 Nf3 d5 Nc3 Be7 Bf4 O-O e3 c5',
'd4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O O-O dxc4 Qc2 a6',
'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7',
'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3 O-O Be3 e5 d5 Nh5',
'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7 Nf3 c5 Rb1 O-O',
'd4 Nf6 c4 g6 Nf3 Bg7 g3 O-O Bg2 d6 O-O Nbd7 Nc3 e5',
'd4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 e4 g6 Nf3 Bg7 Be2 O-O',
'd4 Nf6 c4 c5 d5 b5 cxb5 a6 bxa6 Bxa6 Nc3 d6',
'd4 Nf6 Nf3 e6 Bg5 c5 e3 h6 Bh4 Qb6',
'd4 Nf6 Nf3 g6 Bf4 Bg7 e3 O-O Be2 d6 h3 c5',
'd4 Nf6 Bf4 d5 e3 c5 Nd2 Nc6 c3 e6 Ngf3 Bd6',
'd4 d5 Bf4 Nf6 e3 c5 c3 Nc6 Nd2 e6 Ngf3 Bd6 Bg3 O-O',
'd4 d5 Nf3 Nf6 e3 e6 Bd3 c5 b3 Nc6 O-O Bd6 Bb2 O-O',
'd4 f5 g3 Nf6 Bg2 g6 Nf3 Bg7 O-O O-O c4 d6',
'd4 e6 c4 b6 e4 Bb7 Nc3 Bb4',
// Flank openings
'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6 O-O Be7',
'c4 e5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6 e4 f5',
'c4 Nf6 Nc3 e6 Nf3 d5 d4 Be7',
'c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 Nf3 Nf6 O-O O-O',
'c4 e6 Nf3 d5 g3 Nf6 Bg2 Be7 O-O O-O b3 c5',
'Nf3 d5 g3 Nf6 Bg2 g6 O-O Bg7 d3 O-O Nbd2 c5',
'Nf3 Nf6 c4 g6 Nc3 Bg7 e4 d6 d4 O-O',
'Nf3 d5 c4 c6 b3 Nf6 g3 Bf5 Bg2 e6',
'g3 d5 Bg2 Nf6 Nf3 c6 O-O Bg4',
'b3 e5 Bb2 Nc6 e3 Nf6 Bb5 d6',
'f4 d5 Nf3 Nf6 e3 g6 Be2 Bg7 O-O O-O'];
let BOOK=null;
function bookBuild(){ if(BOOK) return BOOK; BOOK=new Map(); const bad=[];
  for(const line of BOOK_LINES){ const p=fromFEN(START_FEN);
    for(const t of line.split(' ')){ const m=fromSan(p,t); if(!m){ bad.push(line+' @ '+t); break; }
      const key=p.hl+':'+p.hh, u=toUci(p,m); let e=BOOK.get(key); if(!e) BOOK.set(key,e=new Map()); e.set(u,(e.get(u)||0)+1); makeMove(p,m); } }
  BOOK.bad=bad; return BOOK; }
// book moves here: [[uci, weight]…]
function bookMoves(p){ const e=bookBuild().get(p.hl+':'+p.hh); return e?[...e.entries()]:[]; }
function bookPick(p,rnd){ const ms=bookMoves(p); if(!ms.length) return 0; let tot=0; for(const [,w] of ms) tot+=w; let x=rnd()*tot;
  for(const [u,w] of ms){ x-=w; if(x<0) return fromUci(p,u); } return fromUci(p,ms[0][0]); }
