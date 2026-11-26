"""Offline tests for the Arcade. Needs Python Playwright and Chrome.

  python3 tests/server.py <dir containing arcade/> 8771 &   # serves docs/ at /arcade/, like GitHub Pages
  python3 tests/offline_test.py

Covers: airplane mode, a hanging connection (wifi up, internet down), a game never opened online,
an update (only changed parts download, saves untouched, player told), a broken update (old version kept),
and wiped caches (repaired on next online launch). Rebuilds docs/ for the update tests and restores it after.
"""
import asyncio, os, re, subprocess, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
U = 'http://localhost:8771/arcade/'
SRC = os.path.join(ROOT, 'src', 'parts', 'b_script.js')
ok_all = True

def mode(m): open('/tmp/mode', 'w').write(m)
def reqs(): return open('/tmp/req.log').read().split('\n') if os.path.exists('/tmp/req.log') else []
def check(name, cond, extra=''):
    global ok_all; ok_all &= bool(cond); print(('✓ ' if cond else '✗ ') + name + (f'  ({extra})' if extra else ''))
def build(version=None):
    src = open(SRC, encoding='utf-8').read()
    if version: open(SRC, 'w', encoding='utf-8').write(re.sub(r"const VERSION='[\d.]+'", f"const VERSION='{version}'", src))
    try: subprocess.run(['python3', os.path.join(ROOT, 'build.py')], check=True, capture_output=True)
    finally: open(SRC, 'w', encoding='utf-8').write(src)

async def caches(pg): return sorted(await pg.evaluate("caches.keys()"))
async def timed_goto(pg, url, sel):
    t = time.time()
    try: await pg.goto(url, timeout=60000); await pg.wait_for_selector(sel, timeout=60000); return time.time() - t
    except Exception: return None

async def main():
    mode('up'); build()
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        ctx = await br.new_context(viewport={'width': 390, 'height': 844}); pg = await ctx.new_page()
        errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))

        # First visit online: the whole app, including games never opened, is saved for offline.
        await pg.goto(U); await pg.evaluate("navigator.serviceWorker.ready"); await pg.reload(); await pg.wait_for_timeout(500)
        check('service worker controls the Arcade', await pg.evaluate("!!navigator.serviceWorker.controller"))
        first = await caches(pg); check('shell and each game have their own cache', len(first) == 12, ', '.join(first))
        await pg.evaluate("localStorage.setItem('sweep.v1', JSON.stringify({xp:500, name:'Tester'})); localStorage.setItem('arcade.v1', JSON.stringify({name:'Tester', askedName:true}))")

        # Update: only the changed part downloads, old cache is removed, saves untouched, player is told.
        build('9.9'); open('/tmp/req.log', 'w').close()
        await pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update())")
        told = False
        for _ in range(30):   # plain polling: Playwright's per-frame wait_for_function starves the installing worker in headless Chrome
            if 'Arcade updated' in await pg.evaluate("document.querySelector('#toast').textContent"): told = True; break
            await pg.wait_for_timeout(500)
        after = await caches(pg)
        check('update: player sees "Arcade updated · Reload"', told)
        check('update: Sweep cache kept, not re-downloaded', [c for c in after if 'sweep' in c] == [c for c in first if 'sweep' in c] and not any('sweep/index.html' in r for r in reqs()))
        check('update: old shell cache deleted, new one in place', len(after) == 12 and after != first, ', '.join(after))
        await pg.reload(); await pg.wait_for_timeout(300)
        check('update: new version is served', '9.9' in await pg.evaluate("VERSION"))
        check('update: saves untouched', await pg.evaluate("JSON.parse(localStorage.getItem('sweep.v1')).xp") == 500)

        # A broken update (a file fails halfway): the old version keeps working, offline too.
        good = await caches(pg); build('10.0'); mode('fail:fonts.css')
        await pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update()).catch(()=>{})"); await pg.wait_for_timeout(2500)
        mode('up'); await ctx.set_offline(True); await pg.reload(); await pg.wait_for_timeout(300)
        check('failed update: previous version still served', await pg.evaluate("VERSION") == '9.9' and await caches(pg) == good)
        await ctx.set_offline(False); build('9.9')

        # Caches wiped (browser cleanup, or another app on this site): repaired on the next online launch.
        await pg.evaluate("caches.keys().then(ks=>Promise.all(ks.map(k=>caches.delete(k))))")
        await pg.reload(); await pg.wait_for_timeout(2500)
        check('wiped caches: rebuilt on next online launch', await caches(pg) == good)
        await ctx.set_offline(True)
        t = await timed_goto(pg, U + 'sweep/', '#arcBack'); check('wiped caches: offline again after repair', t is not None and t < 3)
        await ctx.set_offline(False)

        # Airplane mode.
        await ctx.set_offline(True)
        t = await timed_goto(pg, U, '#home h1'); check('airplane mode: Arcade opens', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 'sweep/', '#arcBack'); check('airplane mode: Sweep opens though it was never opened online', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        await pg.click('#arcBack'); await pg.wait_for_timeout(600)
        check('airplane mode: Sweep → Arcade works', await pg.is_visible('#home h1'))
        t = await timed_goto(pg, U + 'shipfight/', '#toArcade'); check('airplane mode: Ship Fight opens though it was never opened online', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 'snake/', '#openSettings'); check('airplane mode: Snake opens though it was never opened online', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 't2048/', '#homeSet'); check('airplane mode: 2048 opens though it was never opened online', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 'linefall/', '#settingsBtn'); check('airplane mode: Linefall opens though it was never opened online', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 'drift/', '#settingsBtn'); check('airplane mode: Drift opens though it was never opened online', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 'tilecraft/', '#settingsBtn'); check('airplane mode: Tilecraft opens though it was never opened online', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 'solitaire/', '#settingsBtn'); check('airplane mode: Solitaire opens though it was never opened online', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 'mahjong/', '#settingsBtn'); check('airplane mode: Mahjong opens though it was never opened online', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 'sudoku/', '#settingsBtn'); check('airplane mode: Sudoku opens though it was never opened online', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 'chess/', '#settingsBtn'); check('airplane mode: Chess opens though it was never opened online', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        await ctx.set_offline(False)

        # Wifi connected, internet down: every request hangs. The app must not wait for it.
        mode('hang')
        t = await timed_goto(pg, U, '#home h1'); check('hanging connection: Arcade opens without waiting', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 'sweep/', '#arcBack'); check('hanging connection: Sweep opens without waiting', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 'shipfight/', '#toArcade'); check('hanging connection: Ship Fight opens without waiting', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 'snake/', '#openSettings'); check('hanging connection: Snake opens without waiting', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 't2048/', '#homeSet'); check('hanging connection: 2048 opens without waiting', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 'linefall/', '#settingsBtn'); check('hanging connection: Linefall opens without waiting', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 'drift/', '#settingsBtn'); check('hanging connection: Drift opens without waiting', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 'tilecraft/', '#settingsBtn'); check('hanging connection: Tilecraft opens without waiting', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 'solitaire/', '#settingsBtn'); check('hanging connection: Solitaire opens without waiting', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 'mahjong/', '#settingsBtn'); check('hanging connection: Mahjong opens without waiting', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 'sudoku/', '#settingsBtn'); check('hanging connection: Sudoku opens without waiting', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        t = await timed_goto(pg, U + 'chess/', '#settingsBtn'); check('hanging connection: Chess opens without waiting', t is not None and t < 3, f'{t:.2f}s' if t else 'failed')
        mode('up')

        check('no page errors', not errors, '; '.join(errors)[:200])
        await br.close()
    build()
    print('\nall passed' if ok_all else '\nSOME FAILED')

asyncio.run(main())
