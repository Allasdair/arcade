"""The Arcade home (0.11): identity card, profile and play time, avatars, favourites and sorting, New/Updated badges,
milestones and themes, What's new, and the Arcade's own translations. Needs tests/server.py serving docs/ at /arcade/."""
import asyncio
from playwright.async_api import async_playwright
U='http://localhost:8771/arcade/'
ok_all=True
def check(n,c,x=''):
    global ok_all; ok_all&=bool(c); print(('✓ ' if c else '✗ ')+n+(f'  ({x})' if x else ''))
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        ctx=await br.new_context(viewport={'width':390,'height':844},device_scale_factor=2,locale='en-US'); pg=await ctx.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        # a returning 0.10 player: arcade.v1 without the new fields, Sweep played
        await pg.goto(U+'fonts.css')
        await pg.evaluate("""localStorage.setItem('arcade.v1',JSON.stringify({v:1,name:'Alasdair',askedName:true,set:{lang:'auto'},created:Date.now()-40*864e5,bk:{last:Date.now(),later:0}}));
          localStorage.setItem('arcade.summary.sweep',JSON.stringify({v:1,game:'sweep',ver:'1.2.1',level:6,maxLevel:20,xp:700,xpLevel:600,xpNext:900,ach:[['First Sweep','Win any board',true],['Veteran','Win 25',false]],hi:[],last:Date.now()-3600e3}));""")
        await pg.goto(U); await pg.wait_for_timeout(900)
        check("returning player sees What's new once", 'Version 0.11' in await pg.evaluate("document.querySelector('#sheet').textContent") and await pg.is_visible('#sheet'))
        await pg.screenshot(path='tests/shots/h0_news.png')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='tests/shots/h1_home.png')
        idc=' '.join((await pg.evaluate("document.querySelector('#idCard').textContent")).split())
        check('identity card: name and achievements across games', 'Alasdair' in idc and '1 of 2 achievements' in idc, idc)
        check('identity card: avatar drawn', await pg.evaluate("!!document.querySelector('#idCard .av svg rect')"))
        check('no "Arcade level" anywhere on home', 'Arcade level' not in await pg.evaluate("document.querySelector('#home').textContent"))
        check('no New badges for games that existed before 0.11', await pg.evaluate("document.querySelectorAll('.tag').length")==0)
        check('Coming soon is its own row, not a card', await pg.evaluate("!document.querySelector('.game[data-g=nonogram]')&&document.querySelector('#soon').textContent.includes('Nonograms')"))
        first=await pg.evaluate("document.querySelector('.game').dataset.g"); check('Recent sort: last played first', first=='sweep', first)
        # favourite
        await pg.click('[data-fav=sudoku]'); await pg.wait_for_timeout(200)
        first=await pg.evaluate("document.querySelector('.game').dataset.g"); check('favourite pins Sudoku to the top', first=='sudoku', first)
        await pg.click('[data-sort=az]'); await pg.wait_for_timeout(200)
        order=await pg.evaluate("[...document.querySelectorAll('.game')].map(g=>g.dataset.g)")
        check('A–Z keeps favourites first, then alphabetical', order[0]=='sudoku' and order[1]=='t2048' and order[2]=='chess', ','.join(order[:4]))
        check('tapping the star did not open the game', 'sudoku' not in pg.url)
        # play a game: session counted, then profile
        await pg.click('.game[data-g=snake]'); await pg.wait_for_selector('#toArcade',timeout=8000); await pg.wait_for_timeout(1500)
        got=pg.get_by_role('button',name='Got it')
        if await got.count() and await got.first.is_visible(): await got.first.click(); await pg.wait_for_timeout(400)
        await pg.click('#toArcade'); await pg.wait_for_selector('#idCard'); await pg.wait_for_timeout(500)
        st=await pg.evaluate("A.stats.snake"); check('play time recorded for Snake', st and st['sessions']==1 and st['time']>500, str(st))
        check('a day played counted', await pg.evaluate("A.days")==1)
        await pg.click('#idCard'); await pg.wait_for_timeout(300)
        pb=' '.join((await pg.evaluate("document.querySelector('#profBody').textContent")).split())
        check('profile: play time, games played, most played, milestones', 'Play time' in pb and 'Most played' in pb and 'Snake' in pb and 'Explorer' in pb, pb[:140])
        await pg.screenshot(path='tests/shots/h2_profile.png', full_page=True)
        # avatars: Sweep's unlocked (played), Linefall's locked
        await pg.click('#avBtn'); await pg.wait_for_timeout(300)
        check('avatar picker: played game unlocked, unplayed locked', await pg.evaluate("!document.querySelector('[data-av=mine]').classList.contains('lock')&&document.querySelector('[data-av=blocks]').classList.contains('lock')"))
        await pg.screenshot(path='tests/shots/h3_avatars.png')
        await pg.click('[data-av=blocks]'); await pg.wait_for_timeout(200)
        check('locked avatar can\'t be picked', await pg.evaluate("A.avatar")=='pad')
        await pg.click('[data-av=mine]'); await pg.wait_for_timeout(200)
        check('unlocked avatar picked', await pg.evaluate("A.avatar")=='mine')
        await pg.click('#sheet [data-close]'); await pg.click('#prof .topbar .iconbtn'); await pg.wait_for_timeout(200)
        # milestone: 3 games played unlocks Mint
        await pg.evaluate("localStorage.setItem('arcade.summary.t2048',JSON.stringify({v:1,game:'t2048',ver:'0.1.0',level:1,maxLevel:10,xp:0,xpLevel:0,xpNext:50,ach:[['x','y',false]],hi:[],last:Date.now()}))")
        await pg.reload(); await pg.wait_for_timeout(1200)
        check('Explorer milestone reached (3 games)', 'explorer' in await pg.evaluate("A.ms"))
        await pg.click('#icoS'); await pg.click('#themeBtn'); await pg.wait_for_timeout(200)
        await pg.click('[data-th=ocean]'); await pg.wait_for_timeout(100); check('locked theme refused', await pg.evaluate("A.theme")=='classic')
        await pg.click('[data-th=mint]'); await pg.wait_for_timeout(100)
        check('Mint theme applied', await pg.evaluate("A.theme")=='mint' and await pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()")=='#1f8a6d')
        await pg.screenshot(path='tests/shots/h4_theme.png')
        await pg.click('#sheet [data-close]')
        # Updated badge: pretend Sweep's page changed since it was last opened
        await pg.evaluate("A.seenBuild.sweep='old'; persist()"); await pg.click('#set .topbar .iconbtn'); await pg.wait_for_timeout(200)
        check('Updated badge on a changed game', 'Updated' in await pg.evaluate("document.querySelector('.game[data-g=sweep]').textContent"))
        await pg.evaluate("A.known=A.known.filter(x=>x!=='mahjong'); persist(); renderHome()")
        check('New badge on a game added since the last visit', 'New' in await pg.evaluate("document.querySelector('.game[data-g=mahjong] .tag').textContent"))
        # translations
        for lang,word in [('es','Juegos'),('fr','Jeux'),('de','Spiele'),('pt','Jogos')]:
            await pg.evaluate(f"A.set.lang='{lang}'; persist(); show('home')")
            lbl=await pg.evaluate("document.querySelector('#home .label span').textContent")
            check(f'Arcade menus in {lang}', lbl==word, lbl)
        await pg.screenshot(path='tests/shots/h5_pt.png')
        await pg.evaluate("show('set')"); await pg.screenshot(path='tests/shots/h6_settings_pt.png', full_page=True)
        await pg.evaluate("show('prof')"); await pg.screenshot(path='tests/shots/h7_profile_pt.png', full_page=True)
        await pg.evaluate("A.set.lang='auto'; persist()")
        # no sideways scroll on any screen at 360 px
        await pg.set_viewport_size({'width':360,'height':780})
        for sc in ['home','prof','ach','set']:
            await pg.evaluate(f"show('{sc}')"); w=await pg.evaluate("Math.max(...[...document.querySelectorAll('.screen.on, .screen.on *')].map(e=>e.getBoundingClientRect().right))")
            check(f'{sc}: fits 360 px', w<=361, f'{w:.0f}')
        # a brand-new player: no What's new, no badges
        c2=await br.new_context(viewport={'width':390,'height':844}); p2=await c2.new_page(); p2.on('pageerror',lambda e:errs.append(str(e)))
        await p2.goto(U); await p2.wait_for_timeout(700)
        check('new player: username sheet, not What\'s new', 'Pick a username' in await p2.evaluate("document.querySelector('#sheet').textContent"))
        check('new player: no badges', await p2.evaluate("document.querySelectorAll('.tag').length")==0)
        check('no page errors', not errs, '; '.join(errs)[:200])
        await br.close()
    print('\nall passed' if ok_all else '\nSOME FAILED')
asyncio.run(main())
