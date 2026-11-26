"""Build the Arcade: the shell plus every game, as one site.

  python3 build.py   -> docs/   (served by GitHub Pages: main branch, /docs folder)

Every game's source is in games/. Needs only Python 3.
Offline: docs/sw.js caches the shell and each game separately, named by a hash of their files (see web/sw.template.js).
Each game passes the import check (see import_check below and the project doc arcade-integration.md).
"""
import os, re, shutil, hashlib, json
root = os.path.dirname(os.path.abspath(__file__))
sweep = os.path.join(root, 'games', 'sweep')
out = os.path.join(root, 'docs')
rd = lambda *p: open(os.path.join(*p), encoding='utf-8').read()

CSP = ('<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\'; '
       'style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; font-src \'self\'; connect-src \'self\'; '
       'manifest-src \'self\'; worker-src \'self\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'">')

HEAD = ('<link rel="manifest" href="{r}manifest.webmanifest">\n<link rel="icon" type="image/png" sizes="32x32" href="{r}icons/favicon-32.png">\n'
        '<link rel="apple-touch-icon" href="{r}icons/apple-touch-icon.png">\n'
        '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">\n'
        '<meta name="apple-mobile-web-app-title" content="Arcade"><meta name="apple-mobile-web-app-status-bar-style" content="default">\n'
        '<link rel="stylesheet" href="{r}fonts.css">\n<script src="{r}avatars.js"></script>\n' + CSP)
# Every page registers the one Arcade service worker, so opening a game directly still makes the whole app offline-ready.
REG = """<script>
if('serviceWorker' in navigator) addEventListener('load',()=>navigator.serviceWorker.register('{r}sw.js',{{scope:'{r}'}}).then(reg=>{{
  const c=navigator.serviceWorker.controller; if(c&&navigator.onLine) c.postMessage('arcade-repair');
  // Installed apps can stay open for days: re-check for updates when brought back, at most every 30 min.
  let last=Date.now(); document.addEventListener('visibilitychange',()=>{{ if(!document.hidden&&Date.now()-last>18e5){{ last=Date.now(); reg.update().catch(()=>{{}}); }} }});
}}).catch(()=>{{}}));
if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{{}});
</script>
</body>"""

def build_sweep():
    src = os.path.join(sweep, 'src')
    i18n = ''.join(rd(src, f) + '\n' for f in sorted(os.listdir(src)) if f.startswith('i18n') and f.endswith('.js'))
    html = rd(src, 'app.html').replace('/*ENGINE*/', rd(src, 'engine.js') + '\n' + rd(src, 'camp.js') + '\n' + i18n)
    gf = re.search(r'<link rel="preconnect" href="https://fonts.googleapis.com">.*?rel="stylesheet">', html, re.S)
    assert gf
    # Arcade mode on, fonts shared with the Arcade, same privacy policy as the standalone build.
    html = html.replace(gf.group(0), '<script>window.__ARCADE__=1</script>\n' + HEAD.format(r='../'))
    assert html.count('</body>') == 1
    html = html.replace('</body>', REG.format(r='../'))
    assert 'googleapis' not in html and 'gstatic' not in html
    return html

HEAD_LINKS = ('<link rel="manifest" href="../manifest.webmanifest">\n<link rel="icon" type="image/png" sizes="32x32" href="../icons/favicon-32.png">\n'
              '<link rel="apple-touch-icon" href="../icons/apple-touch-icon.png">\n'
              '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">\n'
              '<meta name="apple-mobile-web-app-title" content="Arcade">\n<script src="../avatars.js"></script>\n')

IMPORT_LOG = []

def import_check(html, game, settings_btn):
    """The import check every game gets. Two Arcade conventions games have so far left out:
      1. Leaving for the Arcade must replace the page in history (location.replace), or Back bounces between the two.
      2. #game-settings (Arcade → Settings → <game>) must open the game's settings screen.
    Each is checked; if the game's source doesn't do it, the build applies the fix and says so.
    Anything unexpected (a navigation it can't find) stops the build. Then the Arcade's service worker is added."""
    notes = []
    import re
    for k in ('ARCADE_HOME', 'ARCADE_PREFS'):
        assert re.search(rf'\b{k}\b', html), f"{game}: no {k} (how does it get back to the Arcade?)"
        pushes = re.findall(rf'location\.href\s*=\s*{k}\b|location\.assign\(\s*{k}\s*\)', html)
        if pushes:   # leaves by adding a history step: switch to replace
            html = re.sub(rf'location\.href\s*=\s*{k}\b|location\.assign\(\s*{k}\s*\)', f'location.replace({k})', html)
            notes.append(f'{k} navigation → location.replace')
        else:        # fine only if it reaches the Arcade with replace (directly or through a helper)
            assert 'location.replace(' in html and not re.search(r'location\.href\s*=\s*(url|u|to|target)\b', html), \
                f"{game}: can't confirm it leaves for {k} with location.replace"
    assert not re.search(r'location\.href\s*=\s*[\'"]\.\./index\.html', html), f"{game}: leaves for the Arcade with location.href"

    assert html.count('</body>') == 1 and f'id="{settings_btn}"' in html, f'{game}: no #{settings_btn} settings button'
    shim = ''
    if '#game-settings' not in html:
        shim = ("<script>addEventListener('load',()=>{ if(location.hash==='#game-settings'){ "
                "try{ history.replaceState(history.state,'',location.pathname+location.search); }catch(e){} "
                f"const b=document.getElementById('{settings_btn}'); if(b) b.click(); }} }});</script>\n")
        notes.append(f'#game-settings → opens #{settings_btn}')
    IMPORT_LOG.append(f'  import check  {game:<10} ' + ('fixed: ' + '; '.join(notes) if notes else 'ok, nothing to fix'))
    return html.replace('</body>', shim + REG.format(r='../'))

def build_from_source(game, folder, out_rel, settings_btn):
    """A game whose source lives in games/<folder>: build it with its own build.py, then add the Arcade's head links."""
    import subprocess
    d = os.path.join(root, 'games', folder)
    subprocess.run(['python3', os.path.join(d, 'build.py')], check=True, capture_output=True)
    html = rd(d, 'dist', out_rel)
    link = '<link rel="stylesheet" href="../fonts.css">'
    assert html.count(link) == 1 and 'window.__ARCADE__=1' in html, f'{game}: not an Arcade build'
    return import_check(html.replace(link, link + '\n' + HEAD_LINKS), game, settings_btn)

GAME_PAGES = ['sweep', 'shipfight', 'snake', 't2048', 'linefall', 'drift', 'tilecraft', 'solitaire', 'mahjong', 'sudoku']

def build_shell():
    """The Arcade home, assembled from src/parts: the page and styles, the translation table, the script and the card art.
    Each game's page hash goes in GAME_BUILDS, which drives the "Updated" badge, so the games are built first."""
    import importlib.util
    parts = os.path.join(root, 'src', 'parts')
    spec = importlib.util.spec_from_file_location('tr', os.path.join(parts, 'tr.py')); tr = importlib.util.module_from_spec(spec); spec.loader.exec_module(tr)
    script = rd(parts, 'b_script.js')
    keys = set(k.replace("\\'", "'") for k in re.findall(r"\bt\('((?:[^'\\]|\\.)*)'", script))
    missing = sorted(k for k in keys if k not in tr.T)
    assert not missing, f'Arcade strings with no translation row in src/parts/tr.py: {missing}'
    builds = {g: hashlib.sha1(open(os.path.join(out, g, 'index.html'), 'rb').read()).hexdigest()[:10] for g in GAME_PAGES}
    script = script.replace('/*GAME_BUILDS*/{}', json.dumps(builds)).replace('/*ART*/', rd(parts, 'c_art.js'))
    assert '/*ART*/' not in script and '/*GAME_BUILDS*/' not in script
    page = rd(parts, 'a_head.html').replace('<!--HEAD-->', HEAD.format(r=''))
    return page + '<script>\n' + tr.js() + '\n' + script + '</script>\n' + REG.format(r='') + '</html>\n'

def main():
    if os.path.exists(out): shutil.rmtree(out)
    os.makedirs(os.path.join(out, 'sweep'))
    open(os.path.join(out, 'sweep', 'index.html'), 'w', encoding='utf-8').write(build_sweep())
    # Games built from source: (id, folder in games/, its Arcade build, its settings button)
    for gid, folder, rel, btn in [('shipfight', 'ship-fight', 'shipfight/index.html', 'homeSet'),
                                  ('snake', 'snake', 'snake/index.html', 'openSettings'),
                                  ('t2048', '2048', 't2048/index.html', 'homeSet'),
                                  ('linefall', 'linefall', 'linefall/index.html', 'settingsBtn'),
                                  ('drift', 'drift', 'drift/index.html', 'settingsBtn'),
                                  ('tilecraft', 'tilecraft', 'tilecraft/index.html', 'settingsBtn'),
                                  ('solitaire', 'solitaire', 'solitaire/index.html', 'settingsBtn'),
                                  ('mahjong', 'mahjong', 'mahjong/index.html', 'settingsBtn'),
                                  ('sudoku', 'sudoku', 'sudoku/index.html', 'settingsBtn')]:
        os.makedirs(os.path.join(out, gid))
        open(os.path.join(out, gid, 'index.html'), 'w', encoding='utf-8').write(build_from_source(gid, folder, rel, btn))
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(build_shell())
    shutil.copy(os.path.join(sweep, 'web', 'fonts.css'), out)
    shutil.copytree(os.path.join(sweep, 'web', 'fonts'), os.path.join(out, 'fonts'))
    shutil.copy(os.path.join(root, 'web', 'manifest.webmanifest'), out)
    shutil.copy(os.path.join(root, 'web', 'avatars.js'), out)
    shutil.copytree(os.path.join(root, 'web', 'icons'), os.path.join(out, 'icons'))
    open(os.path.join(out, '.nojekyll'), 'w').write('')
    # One cache per part, named by a hash of its files: an update only re-downloads the parts that changed.
    ls = lambda d, ext: sorted(d + '/' + f for f in os.listdir(os.path.join(out, d)) if f.endswith(ext))
    parts = {'shell': ['index.html', 'fonts.css', 'manifest.webmanifest', 'avatars.js'] + ls('fonts', '.woff2') + ls('icons', '.png'),
             'sweep': ['sweep/index.html'], 'shipfight': ['shipfight/index.html'], 'snake': ['snake/index.html'], 't2048': ['t2048/index.html'], 'linefall': ['linefall/index.html'], 'drift': ['drift/index.html'], 'tilecraft': ['tilecraft/index.html'], 'solitaire': ['solitaire/index.html'], 'mahjong': ['mahjong/index.html'], 'sudoku': ['sudoku/index.html']}
    named = {}
    for part, files in parts.items():
        h = hashlib.sha1(b''.join(open(os.path.join(out, f), 'rb').read() for f in files)).hexdigest()[:10]
        named[f'arcade-{part}-{h}'] = files
    build = hashlib.sha1(json.dumps(named, sort_keys=True).encode()).hexdigest()[:8]
    sw = rd(root, 'web', 'sw.template.js').replace('__BUILD__', build).replace('__PARTS__', json.dumps(named, indent=1))
    open(os.path.join(out, 'sw.js'), 'w', encoding='utf-8').write(sw)
    print(f'built docs/ (Arcade + Sweep + Ship Fight + Snake + 2048 + Linefall + Drift + Tilecraft + Solitaire + Mahjong + Sudoku, build {build})')
    print('\n'.join(IMPORT_LOG))
    for n in named: print('  cache', n)

main()
