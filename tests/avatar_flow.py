"""Avatars in multiplayer (Arcade 0.12): a Tilecraft 2-Player code and a Sweep League code carry the sender's avatar,
and the receiving device shows it. Needs tests/server.py serving docs/ at /arcade/."""
import asyncio
from playwright.async_api import async_playwright
U='http://localhost:8771/arcade/'
ok_all=True
def check(n,c,x=''):
    global ok_all; ok_all&=bool(c); print(('✓ ' if c else '✗ ')+n+(f'  ({x})' if x else ''))
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome'); errs=[]
        ctx=await br.new_context(viewport={'width':390,'height':844},device_scale_factor=2); pg=await ctx.new_page()
        pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(U+'fonts.css')
        await pg.evaluate("localStorage.setItem('arcade.v1',JSON.stringify({v:1,name:'Alasdair',askedName:true,avatar:'heart',seenVer:'0.12',set:{lang:'en'},known:['sweep','shipfight','snake','t2048','linefall','drift','tilecraft','solitaire','mahjong','sudoku','chess']}))")
        # --- Tilecraft: Robin (rocket) started a game and made the first move; Alasdair pastes the code
        await pg.goto(U+'tilecraft/'); await pg.wait_for_timeout(900)
        code=await pg.evaluate("""(()=>{ const av=ArcadeAvatars.idx('rocket'), cfg=twoPlayerCfg({size:'medium',shape:'square',boardSeed:77,bagSeed:88,mods:{}},['Robin',''],[av,0]), st=newGame(cfg);
          const mv=aiChoose(st,0,'hard',allMoves(st,st.racks[0])); applyMove(st,{t:'p',tiles:mv.tiles});
          return 'Your move! '+encodeGame({id:[9,8,7,6,5,4],cfg,names:['Robin',''],avs:[av,0],moves:codeMoves(st)}); })()""")
        await pg.evaluate("tpPaste()"); await pg.fill('#pin',code); await pg.click('#pGo'); await pg.wait_for_timeout(300)
        check("join sheet shows the sender's avatar", await pg.evaluate("!!document.querySelector('#sheet .av svg rect[fill=\"#1b263b\"]')"))
        await pg.screenshot(path='tests/shots/a1_join.png')
        await pg.click('#jGo'); await pg.wait_for_timeout(900)
        n=await pg.evaluate("document.querySelectorAll('#sb .pl .av').length")
        check('scoreboard shows both avatars', n==2, str(n))
        check('their avatar is the rocket, mine is the heart', await pg.evaluate("!!document.querySelector('#sb .pl:first-child .av rect[fill=\"#1b263b\"]')&&!!document.querySelector('#sb .pl:nth-child(3) .av rect[fill=\"#ffe1e6\"],#sb .pl:last-child .av rect[fill=\"#ffe1e6\"]')"))
        await pg.screenshot(path='tests/shots/a2_scoreboard.png')
        g=await pg.evaluate("S.tp.games[0].avs"); check('the game remembers both avatars', g==[await pg.evaluate("ArcadeAvatars.idx('rocket')"),await pg.evaluate("ArcadeAvatars.idx('heart')")], str(g))
        reply=await pg.evaluate("tpCodeText(S.tp.games[0],replay(S.tp.games[0].cfg,S.tp.games[0].moves))")
        back=await pg.evaluate("t=>decodeGame(t).avs",reply); check('my reply code carries both avatars', back==g, str(back))
        # --- Sweep League: Robin (ship) shares a season code
        await pg.goto(U+'sweep/'); await pg.wait_for_timeout(900)
        await pg.evaluate("""(()=>{ const n=lgCur(), Z=sea(n), L=lgS(); Z.joined=true; Z.name='Alasdair'; if(!Z.m[L.pid]) Z.m[L.pid]={n:'Alasdair',d:{}}; persist(); const c=encodeSeason({season:n,pid:[7,7,7,7,7,7],prev:0,fpDay:0,fp:'',days:{[new Date().getDate()]:{won:true,h:0,t:80,p:100}},name:'Robin',av:ArcadeAvatars.idx('ship')}); lgImport(c,true); openLeague('table'); })()""")
        await pg.wait_for_timeout(500)
        check('League table shows Robin with the ship avatar', await pg.evaluate("!!document.querySelector('.lbr .av rect[fill=\"#bde0fe\"]')"))
        await pg.screenshot(path='tests/shots/a3_league.png')
        mine=await pg.evaluate("decodeSeason(myCode()).av"); check('my League code carries my avatar', mine==await pg.evaluate("ArcadeAvatars.idx('heart')"), str(mine))
        # --- Chess: Kai (knight) opened with d4; Alasdair joins and replies
        await pg.goto(U+'chess/'); await pg.wait_for_timeout(1200)
        got=pg.get_by_role('button',name='Got it')
        if await got.count() and await got.first.is_visible(): await got.first.click(); await pg.wait_for_timeout(300)
        kn=await pg.evaluate("ArcadeAvatars.idx('knight')"); me=await pg.evaluate("ArcadeAvatars.idx('heart')")
        check('the knight avatar is the 13th (appended, nothing reordered)', kn==13 and me==2, f'{kn}, {me}')
        code=await pg.evaluate("av=>'Your move! '+encodeGame({id:[4,4,4,4,4,4],c960:-1,p0black:false,names:['Kai',''],avs:[av,0],moves:['d2d4'],end:0,offer:false})",kn)
        await pg.evaluate("c=>{ openTp(); tpImport(c); }",code); await pg.wait_for_timeout(300)
        check("Chess join sheet shows Kai's knight", await pg.evaluate("!!document.querySelector('#sheet .av rect[fill=\"#e9dcc9\"]')"))
        await pg.screenshot(path='tests/shots/a4_chess_join.png')
        await pg.evaluate("()=>{ const n=document.getElementById('n2'); if(n&&!n.value) n.value='Alasdair'; document.getElementById('jGo').click(); }"); await pg.wait_for_timeout(500)
        check('both Chess player bars show avatars', await pg.evaluate("document.querySelectorAll('#pbTop .av, #pbBot .av').length")==2)
        await pg.evaluate("humanMove(fromUci(G.pos,'d7d5'))"); await pg.wait_for_timeout(400)
        await pg.screenshot(path='tests/shots/a5_chess_board.png')
        reply=await pg.evaluate("document.getElementById('tpCode').value")
        avs=await pg.evaluate("c=>decodeGame(c).avs",reply); check('my Chess reply carries both avatars', avs==[kn,me], str(avs))
        check('no page errors', not errs, '; '.join(errs)[:200])
        await br.close()
    print('\nall passed' if ok_all else '\nSOME FAILED')
asyncio.run(main())
