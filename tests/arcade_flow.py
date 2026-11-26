"""Arcade shell flow: username, Sweep in Arcade mode, shared settings, achievements, backup round trip, migrating an existing Sweep save.
Needs tests/server.py serving docs/ at /arcade/ (see README)."""
import asyncio, json
from playwright.async_api import async_playwright
B='http://localhost:8771/arcade/'
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        ctx=await br.new_context(viewport={'width':390,'height':844},device_scale_factor=2)
        pg=await ctx.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
        await pg.goto(B); await pg.wait_for_timeout(800)
        await pg.screenshot(path='tests/shots/1_name.png')
        await pg.fill('#nm','Alasdair'); await pg.click('#nmGo'); await pg.wait_for_timeout(400)
        await pg.screenshot(path='tests/shots/2_home_new.png')
        await pg.click('.game[data-g=sweep]'); await pg.wait_for_load_state('load'); await pg.wait_for_timeout(1200)
        await pg.screenshot(path='tests/shots/3_sweep_home.png')
        print('arcBack visible', await pg.is_visible('#arcBack'))
        await pg.click('#homeSet'); await pg.wait_for_timeout(400)
        await pg.screenshot(path='tests/shots/4_sweep_settings.png')
        # give some XP + an achievement to see the totals move
        await pg.evaluate("S.xp=180; S.ach.first=Date.now(); S.wins=4; persist(); writeSummary();")
        await pg.click('#arcSet'); await pg.wait_for_load_state('load'); await pg.wait_for_timeout(600)
        await pg.screenshot(path='tests/shots/5_arcade_settings.png', full_page=True)
        await pg.click('[data-ap=dark]'); await pg.wait_for_timeout(200)
        await pg.click('#set .topbar .iconbtn'); await pg.wait_for_timeout(400)
        await pg.screenshot(path='tests/shots/6_home_dark.png')
        await pg.click('#icoA'); await pg.wait_for_timeout(400)
        await pg.click('[data-a=sweep] .hd'); await pg.wait_for_timeout(200)
        await pg.screenshot(path='tests/shots/7_ach.png')
        await pg.click('[data-play=sweep]'); await pg.wait_for_load_state('load'); await pg.wait_for_timeout(1000)
        print('sweep dark?', await pg.evaluate("isDark()"), 'name', await pg.evaluate("S.name"))
        await pg.screenshot(path='tests/shots/8_sweep_dark.png')
        await pg.click('#arcBack'); await pg.wait_for_timeout(1000)
        print('back at', pg.url)
        # backup round trip
        code=await pg.evaluate("makeCode()"); print('code len', len(code), code[:12])
        o=await pg.evaluate("c=>readCode(c).then(o=>Object.keys(o.keys))", code); print('keys', o)
        await pg.evaluate("localStorage.removeItem('sweep.v1'); localStorage.removeItem('arcade.summary.sweep')")
        await pg.evaluate("c=>readCode(c).then(o=>doRestore(o.keys,'sweep'))", code); await pg.wait_for_timeout(300)
        print('after restore sweep xp', await pg.evaluate("JSON.parse(localStorage.getItem('sweep.v1')).xp"))
        await pg.click('#icoS'); await pg.click('#bkBtn'); await pg.wait_for_timeout(500)
        await pg.screenshot(path='tests/shots/9_backup.png')
        print('errors', errs)
        # migration: existing Sweep player, no Arcade save yet
        c2=await br.new_context(viewport={'width':390,'height':844},device_scale_factor=2); p2=await c2.new_page(); e2=[]
        p2.on('pageerror',lambda e:e2.append(str(e)))
        await p2.goto(B+'fonts.css')
        await p2.evaluate("""localStorage.setItem('sweep.v1',JSON.stringify({xp:900,name:'Ally',appearance:'dark',lefty:true,ach:{first:1,inter:1}}))""")
        await p2.goto(B); await p2.wait_for_timeout(900)
        print('migrated', await p2.evaluate("[A.name,A.set.appearance,A.set.lefty]"))
        await p2.screenshot(path='tests/shots/10_migrated.png')
        await p2.click('.game[data-g=sweep]'); await p2.wait_for_load_state('load'); await p2.wait_for_timeout(1000)
        await p2.goto(B); await p2.wait_for_timeout(500)
        await p2.screenshot(path='tests/shots/11_migrated_synced.png')
        print('errors2', e2)
        await br.close()
asyncio.run(main())
