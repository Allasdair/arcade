"""Build Drift.

  python3 build.py   -> dist/drift/index.html  Arcade build: window.__ARCADE__=1, links ../fonts.css, strict CSP
                        dist/standalone.html       one self-contained file, fonts inlined, strict CSP
                        dist/demo.html             standalone without the CSP meta, for the claude.ai artifact preview

app.html's /*ENGINE*/ placeholder is filled with engine.js, levels.js, core.js, then the i18n tables (as the
other Arcade games do). Needs only Python 3.
"""
import os, re, base64
root=os.path.dirname(os.path.abspath(__file__)); src=os.path.join(root,'src'); dist=os.path.join(root,'dist')
rd=lambda *p: open(os.path.join(*p),encoding='utf-8').read()
i18n=''.join(rd(src,f)+'\n' for f in sorted(os.listdir(src)) if f.startswith('i18n') and f.endswith('.js'))
html=rd(src,'app.html').replace('/*ENGINE*/',rd(src,'engine.js')+'\n'+rd(src,'levels.js')+'\n'+rd(src,'core.js')+'\n'+i18n)
assert html.count('<!--FONTS-->')==1 and '/*ENGINE*/' not in html
ver=re.search(r"VERSION='([\d.]+)'",html).group(1)
CSP='''<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'">'''
def font_face(fam,weight,f):
    b=base64.b64encode(open(os.path.join(root,'fonts',f),'rb').read()).decode()
    return f'@font-face{{font-family:{fam};font-style:normal;font-weight:{weight};font-display:swap;src:url(data:font/woff2;base64,{b}) format("woff2")}}'
inline='<style>'+font_face('Inter','100 900','inter.woff2')+font_face('"JetBrains Mono"','700','jetbrains-mono-700.woff2')+'</style>'
os.makedirs(os.path.join(dist,'drift'),exist_ok=True)
arcade=html.replace('<!--FONTS-->',CSP+'\n<link rel="stylesheet" href="../fonts.css">\n<script>window.__ARCADE__=1</script>')
open(os.path.join(dist,'drift','index.html'),'w',encoding='utf-8').write(arcade)
open(os.path.join(dist,'standalone.html'),'w',encoding='utf-8').write(html.replace('<!--FONTS-->',CSP+'\n'+inline))
open(os.path.join(dist,'demo.html'),'w',encoding='utf-8').write(html.replace('<!--FONTS-->',inline))
for f in ['drift/index.html','standalone.html','demo.html']:
    t=open(os.path.join(dist,f),encoding='utf-8').read()
    assert 'googleapis' not in t and 'http://' not in t.replace('http://www.w3.org','') , f
    assert 'serviceWorker' not in t, f
print(f'built dist/ (v{ver}): drift/index.html {len(arcade)//1024} KB, standalone.html, demo.html')
