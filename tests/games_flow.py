"""Each contract game inside the Arcade: launch, shared settings, summary, achievements, settings link,
backup and restore of just that game, Back to Arcade. Needs tests/server.py serving docs/ at /arcade/."""
import asyncio
from playwright.async_api import async_playwright
U='http://localhost:8771/arcade/'
GAMES=[  # id, name, Arcade button, settings button, settings screen, how to give it some XP
  ('shipfight','Ship Fight','#toArcade','#homeSet','#set',"S.xp=200; saveGame(); writeSummary();"),
  ('snake','Snake','#toArcade','#openSettings','#settings',"S.xp=200; persist(); writeSummary();"),
  ('t2048','2048','#toArcade','#homeSet','#set',"S.xp=200; persist(); writeSummary();"),
  ('linefall','Linefall','#arcadeBtn','#settingsBtn','#set',"S.xp=200; persist(); writeSummary();"),
  ('drift','Drift','#arcadeBtn','#settingsBtn','#set',"S.xp=200; persist(); writeSummary();"),
  ('tilecraft','Tilecraft','#arcadeBtn','#settingsBtn','#set',"S.xp=200; persist(); writeSummary();"),
  ('solitaire','Solitaire','#arcadeBtn','#settingsBtn','#set',"S.xp=200; persist(); writeSummary();"),
  ('mahjong','Mahjong','#arcadeBtn','#settingsBtn','#set',"S.xp=200; persist(); writeSummary();"),
  ('sudoku','Sudoku','#arcadeBtn','#settingsBtn','#set',"S.xp=200; persist(); writeSummary();"),
]
ok_all=True
def check(n,c,x=''):
    global ok_all; ok_all&=bool(c); print(('✓ ' if c else '✗ ')+n+(f'  ({x})' if x else ''))
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        ctx=await br.new_context(viewport={'width':390,'height':844},device_scale_factor=2); pg=await ctx.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(500)
        await pg.fill('#nm','Alasdair'); await pg.click('#nmGo')
        await pg.click('#icoS'); await pg.click('[data-ap=dark]'); await pg.click('#set .topbar .iconbtn'); await pg.wait_for_timeout(300)
        for gid,name,back,setb,setscr,xp in GAMES:
            print(f'— {name}')
            check('card on the Arcade home', await pg.is_visible(f'.game[data-g={gid}]'))
            await pg.click(f'.game[data-g={gid}]'); await pg.wait_for_selector(back,timeout=8000); await pg.wait_for_timeout(800)
            got=pg.get_by_role('button',name='Got it')   # a first-run "How to play" sheet
            if await got.count() and await got.first.is_visible(): await got.first.click(); await pg.wait_for_timeout(400)
            await pg.screenshot(path=f'tests/shots/{gid}_home.png')
            check('"‹ Arcade" shown', await pg.is_visible(back))
            bg=await pg.evaluate("getComputedStyle(document.body).backgroundColor")
            check('Arcade dark mode reaches the game', sum(int(x) for x in bg[bg.index('(')+1:bg.index(')')].split(',')[:3])<200, bg)
            await pg.evaluate(xp)
            s=await pg.evaluate(f"JSON.parse(localStorage.getItem('arcade.summary.{gid}'))")
            check('summary written', s and s['game']==gid, f"level {s and s['level']}/{s and s['maxLevel']}, {s and len(s['ach'])} achievements")
            await pg.click(back); await pg.wait_for_selector('#home h1'); await pg.wait_for_timeout(400)
            check('"‹ Arcade" returns to the Arcade', 'arcade' in pg.url and await pg.is_visible('#idCard'), pg.url)
            hl=await pg.evaluate("history.length")
            await pg.click('#idCard'); await pg.wait_for_timeout(300)
            check('profile lists it, with a session counted', name in await pg.evaluate("document.querySelector('#profBody').textContent") and await pg.evaluate(f"(A.stats['{gid}']||{{}}).sessions>=1"))
            await pg.click('#prof .topbar .iconbtn')
            await pg.click('#icoA'); await pg.wait_for_timeout(300)
            check('section on Achievements', name in await pg.evaluate("document.querySelector('#achBody').textContent"))
            await pg.click('#ach .topbar .iconbtn')
            code=await pg.evaluate("makeCode()"); keys=await pg.evaluate("c=>readCode(c).then(o=>Object.keys(o.keys))",code)
            check('combined backup includes it', f'{gid}.v1' in keys and f'arcade.summary.{gid}' in keys)
            await pg.evaluate(f"localStorage.removeItem('{gid}.v1')"); await pg.evaluate(f"c=>readCode(c).then(o=>doRestore(o.keys,'{gid}'))",code); await pg.wait_for_timeout(200)
            check('restore only this game', await pg.evaluate(f"JSON.parse(localStorage.getItem('{gid}.v1')).xp")==200)
            await pg.goto(U+'#prefs'); await pg.wait_for_timeout(300)
            await pg.click(f'#gs_{gid}'); await pg.wait_for_selector(back,state='attached',timeout=8000); await pg.wait_for_timeout(700)
            check('Arcade Settings → game opens its settings', await pg.evaluate(f"document.querySelector('{setscr}').classList.contains('on')"))
            await pg.screenshot(path=f'tests/shots/{gid}_settings.png')
            await pg.goto(U); await pg.wait_for_timeout(300)
        lv=await pg.evaluate("document.querySelector('#idCard').textContent"); print('— Arcade:', ' '.join(lv.split())[:120])
        await pg.screenshot(path='tests/shots/arcade_home.png')
        check('no page errors', not errs, '; '.join(errs)[:200])
        await br.close()
    print('\nall passed' if ok_all else '\nSOME FAILED')
asyncio.run(main())
