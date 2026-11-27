// Campaign recipes: the 45 levels before grading. tools/grade.js builds each map, plays it with the bots and stamps
// the move limit, par and (for score goals) the target into src/levels.js.
// Obstacle patterns are placed mirrored left/right so boards look designed. Later entries overwrite earlier ones.
//   box x y w h · rows y0 y1 · cols [x…] · border · ring · checker x y w h · scatter n · diag · top · bottom n
// Map chars: f/F frost 1/2 · c chain · g fog · s/S/T stone 1/2/3 · l lava · r relic (start) · # no cell
// Goals: score (n from the bot: its median after `scoreMoves`), collect (e, n), frost, stone, lava, fog, relic (n)
// Twists: timed · tight (lower target) · lava (spreads every move) · combos (normal matches don't count)
const F=0, Wt=1, Ea=2, Ai=3, Li=4, Ic=5;
const R=[
// ---------- Origins: 4 elements ----------
{camp:0,n:1,name:'First Spark',ne:4,goals:[{t:'score'}],scoreMoves:10,tip:'Swap two neighbouring pieces to line up 3 or more. Line up 4 to make a Surge: it clears its whole row or column.'},
{camp:0,n:2,name:'Kindling',ne:4,goals:[{t:'collect',e:F,n:70}],tip:'Match in an L or T shape to make a Burst. It clears the pieces around it, then goes off once more.'},
{camp:0,n:3,name:'Square One',ne:4,goals:[{t:'score'}],scoreMoves:14,tip:'A 2×2 square makes a Wisp, which flies to a useful spot. Five in a line makes a Prism: swap it with a piece to clear that whole element.'},
{camp:0,n:4,name:'Heartwood',ne:4,shape:'heart',W:9,H:8,goals:[{t:'collect',e:Wt,n:60}],tip:'A shaped board. Pieces fall within their own column, and new ones enter at the top of each column.'},
{camp:0,n:5,name:'First Frost',ne:4,ob:[['f','box',0,3,8,5],['F','box',1,5,6,2]],goals:[{t:'frost'}],tip:'Frost holds a piece in place. Match next to it, or match the frozen piece itself. A Fire match thaws every layer at once.'},
{camp:0,n:6,name:'Standing Stones',ne:4,ob:[['S','box',1,4,6,1],['T','box',2,6,4,1],['s','box',2,7,4,1]],goals:[{t:'stone'}],tip:'Stone blocks a cell. Matches next to it chip a layer off; an Air match erodes two.'},
{camp:0,n:7,name:'Quickfire',ne:4,twist:'timed',goals:[{t:'score'}],scoreMoves:16,tip:'Against the clock. The clock stops while cascades play out, and a cascade of 5 or more adds 2 seconds.'},
{camp:0,n:8,name:'Diamond Dust',ne:4,shape:'diamond',W:9,H:9,ob:[['f','box',1,4,7,4],['F','box',3,5,3,2]],goals:[{t:'frost'}],tip:'Frost on a diamond. Surges reach right across the board.'},
{camp:0,n:9,name:'Relic Run',ne:4,relics:{total:3,max:2},ob:[['r','top',2]],goals:[{t:'relic',n:3}],tip:'Relics fall like pieces. Clear the pieces under them to bring them down and out through the bottom.'},
{camp:0,n:10,name:'Thin Ice',ne:4,type:'puzzle',tip:'A puzzle: no new pieces fall. Clear all the Frost. It can be done in 3 moves; do it in 3 for the second star.'},
{camp:0,n:11,name:'Frost and Stone',ne:4,ob:[['F','bottom',2],['S','box',1,4,6,1]],goals:[{t:'frost'},{t:'stone'}],tip:'Two goals. Fire for the frost, Air for the stone.'},
{camp:0,n:12,name:'Ring of Ash',ne:4,shape:'ring',W:9,H:9,relics:{total:3,max:2},ob:[['r','top',1]],goals:[{t:'relic',n:3}],tip:'Relics leave wherever a column ends at the edge of the board: look for the glowing exits.'},
{camp:0,n:13,name:'Deep Freeze',ne:4,relics:{total:2,max:1},ob:[['F','bottom',2],['f','rows',5,5],['r','top',1]],goals:[{t:'frost'},{t:'relic',n:2}],tip:'Double frost needs two hits, or one Fire match.'},
{camp:0,n:14,name:'Tight Spot',ne:4,twist:'tight',ob:[['S','box',0,6,8,1],['f','box',1,7,6,1]],goals:[{t:'stone'},{t:'frost'}],tip:'Fewer moves than usual. Make every swap count.'},
{camp:0,n:15,name:'Wellspring',ne:4,W:9,H:9,relics:{total:3,max:2},ob:[['f','bottom',2],['S','box',0,5,2,1],['s','box',3,5,3,1],['r','top',1]],goals:[{t:'frost'},{t:'relic',n:3}],tip:'The Origins finale: frost, stone and relics on a large board.'},
// ---------- Stormfront: 5 elements, bringing in Lightning ----------
{camp:1,n:1,name:'Static',ne:5,goals:[{t:'score'}],scoreMoves:12,tip:'Lightning joins the board. Five elements mean fewer free matches: look for specials.'},
{camp:1,n:2,name:'Conductor',ne:5,goals:[{t:'collect',e:Li,n:36}],tip:'Collect Lightning. Specials count every piece they clear.'},
{camp:1,n:3,name:'Crossfire',ne:5,goals:[{t:'score'}],scoreMoves:15,tip:'Swap two specials together for a combo: two Surges clear a cross, a Surge and a Burst clear three rows and three columns.'},
{camp:1,n:4,name:'Crossroads',ne:5,shape:'cross',W:9,H:9,goals:[{t:'collect',e:Wt,n:28},{t:'score'}],scoreMoves:16,tip:'A cross-shaped board. Surges along the arms reach a long way.'},
{camp:1,n:5,name:'Magma',ne:5,ob:[['l','box',1,5,6,3]],goals:[{t:'lava'}],tip:'Lava spreads into a neighbouring piece after any move that clears no lava. A Water match quenches lava and all the lava touching it.'},
{camp:1,n:6,name:'Chained',ne:5,ob:[['c','box',1,3,6,3]],goals:[{t:'collect',e:Li,n:24}],tip:'Chains hold pieces in place. Matching a chained piece breaks its chain; a Lightning match breaks every chain in its row and column.'},
{camp:1,n:7,name:'Eruption',ne:5,twist:'lava',ob:[['l','box',3,7,2,1]],goals:[{t:'lava'}],tip:'This lava spreads after every move, even when you clear some. Stay ahead of it.'},
{camp:1,n:8,name:'Hourglass',ne:5,shape:'hourglass',W:9,H:9,ob:[['f','box',2,6,5,2]],goals:[{t:'frost'}],tip:'The board narrows in the middle. Wisps can fly to frost you can\'t reach.'},
{camp:1,n:9,name:'Flow Control',ne:5,ob:[['l','box',0,7,2,1],['l','box',3,4,2,1]],goals:[{t:'lava'},{t:'score'}],scoreMoves:16,tip:'Keep the lava in check while you build your score.'},
{camp:1,n:10,name:'Live Wire',ne:5,type:'puzzle',tip:'A puzzle: no new pieces fall. Clear all the Frost. It can be done in 3 moves; do it in 3 for the second star.'},
{camp:1,n:11,name:'Chain Reaction',ne:5,ob:[['f','bottom',2],['c','rows',4,4]],goals:[{t:'frost'}],tip:'Chains guard the way to the frost. Lightning clears a path.'},
{camp:1,n:12,name:'Twin Islands',ne:5,shape:'islands',W:9,H:8,relics:{total:3,max:2},ob:[['r','top',1]],goals:[{t:'relic',n:3}],tip:'Two islands joined by a bridge. Each has its own exits.'},
{camp:1,n:13,name:'Molten Relics',ne:5,relics:{total:3,max:2},ob:[['l','box',0,6,2,2],['r','top',1]],goals:[{t:'relic',n:3},{t:'lava'}],tip:'Bring the relics down before the lava closes their path.'},
{camp:1,n:14,name:'Combo Theory',ne:5,twist:'combos',goals:[{t:'score'}],scoreMoves:20,tip:'Only specials and combos score toward the goal here: normal matches count for nothing.'},
{camp:1,n:15,name:'Eye of the Storm',ne:5,W:9,H:9,relics:{total:3,max:2},ob:[['f','bottom',1],['l','box',0,6,1,2],['c','rows',4,4],['s','box',3,3,3,1],['r','top',1]],goals:[{t:'relic',n:3},{t:'lava'}],tip:'The Stormfront finale: every obstacle so far, two goals.'},
// ---------- Frostfall: 6 elements, bringing in Ice ----------
{camp:2,n:1,name:'First Snow',ne:6,goals:[{t:'score'}],scoreMoves:12,tip:'Ice joins the board: six elements. Free matches are rarer, so specials matter more.'},
{camp:2,n:2,name:'Crystal Count',ne:6,goals:[{t:'collect',e:Ic,n:24}],tip:'Collect Ice. A Prism swapped with an Ice piece clears every one on the board.'},
{camp:2,n:3,name:'Hearth',ne:6,ob:[['f','bottom',3]],goals:[{t:'frost'}],tip:'A lot of frost. Fire thaws it in one go.'},
{camp:2,n:4,name:'Great Heart',ne:6,shape:'heart',W:9,H:9,goals:[{t:'collect',e:F,n:26},{t:'score'}],scoreMoves:16,tip:'A large heart. Watch where each column ends.'},
{camp:2,n:5,name:'Whiteout',ne:6,ob:[['g','box',1,3,6,4]],goals:[{t:'fog'}],tip:'Fog hides the piece underneath, and fogged pieces can\'t match. Match next to fog to clear it; an Earth match clears the fog all around.'},
{camp:2,n:6,name:'Cold Front',ne:6,ob:[['l','box',3,7,2,1]],goals:[{t:'lava'}],tip:'An Ice match next to lava freezes it into stone, which stops it spreading. Water still quenches it.'},
{camp:2,n:7,name:'Blizzard Clock',ne:6,twist:'timed',ob:[['g','box',2,0,4,2]],goals:[{t:'score'}],scoreMoves:16,tip:'Against the clock again, now with six elements.'},
{camp:2,n:8,name:'Great Ring',ne:6,shape:'ring',W:9,H:9,ob:[['f','rows',7,8]],goals:[{t:'frost'}],tip:'Frost around a ring. Bursts and Wisps reach where lines can\'t.'},
{camp:2,n:9,name:'Hidden Links',ne:6,ob:[['g','box',0,3,8,3],['c','box',1,6,6,1]],goals:[{t:'fog'}],tip:'Fog over chains. Earth for the fog, Lightning for the chains.'},
{camp:2,n:10,name:'Glacier',ne:6,type:'puzzle',tip:'A puzzle: no new pieces fall. Clear all the Frost. It can be done in 3 moves; do it in 3 for the second star.'},
{camp:2,n:11,name:'Permafrost',ne:6,ob:[['F','bottom',1],['f','bottom',2],['S','box',1,5,1,1],['T','box',3,5,1,1]],goals:[{t:'frost'},{t:'stone'}],tip:'Thick frost and thick stone. Fire and Air are your friends.'},
{camp:2,n:12,name:'Great Islands',ne:6,shape:'islands',W:9,H:9,relics:{total:3,max:2},ob:[['f','bottom',1],['r','top',1]],goals:[{t:'relic',n:3}],tip:'Two large islands and their relics.'},
{camp:2,n:13,name:'Everything Melts',ne:6,ob:[['g','box',0,1,8,2],['l','box',3,7,2,1],['c','rows',4,4]],goals:[{t:'lava'},{t:'fog'}],tip:'Fog, lava and chains together. Use each reaction where it counts.'},
{camp:2,n:14,name:'Narrow Pass',ne:6,twist:'tight',ob:[['f','bottom',2],['g','box',2,4,4,1]],goals:[{t:'frost'},{t:'fog'}],tip:'Fewer moves than usual, and fog in the way.'},
{camp:2,n:15,name:'Quintessence',ne:6,W:9,H:10,relics:{total:3,max:2},ob:[['f','bottom',1],['g','box',0,4,2,1],['l','box',4,5,1,1],['c','rows',3,3],['s','box',2,6,1,1],['r','top',1]],goals:[{t:'relic',n:3},{t:'frost'}],tip:'The finale. Every element, every obstacle, two goals.'}];

if(typeof module!=='undefined') module.exports={RECIPES:R};
