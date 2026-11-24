"""Build 2048.

  python3 build.py   -> dist/t2048/index.html   Arcade build: window.__ARCADE__=1, links ../fonts.css, strict CSP
                        dist/standalone.html    one file, fonts inlined, strict CSP
                        dist/demo.html          standalone without the CSP meta, for the claude.ai artifact preview

Needs only Python 3. app.html's /*ENGINE*/ placeholder is filled with engine.js, then core.js, then the i18n tables.
"""
import os, re, base64
root=os.path.dirname(os.path.abspath(__file__)); src=os.path.join(root,'src'); dist=os.path.join(root,'dist')
rd=lambda *p: open(os.path.join(*p),encoding='utf-8').read()
i18n=''.join(rd(src,f)+'\n' for f in sorted(os.listdir(src)) if f.startswith('i18n') and f.endswith('.js'))
html=rd(src,'app.html').replace('/*ENGINE*/',rd(src,'engine.js')+'\n'+rd(src,'core.js')+'\n'+i18n)
ver=re.search(r"VERSION='([\d.]+)'",rd(src,'core.js')).group(1)
assert html.count('<!--CSP-->')==1 and html.count('<!--FONTS-->')==1

CSP=('<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\'; '
     'style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; font-src \'self\' data:; connect-src \'self\'; '
     'object-src \'none\'; base-uri \'none\'; form-action \'none\'">')
# Fonts are bundled (SIL Open Font License, see fonts/LICENSE-*.txt), so the game never contacts a font service.
FONTS=[('Inter','100 900','inter.woff2'),('"JetBrains Mono"','700','jetbrains-mono-700.woff2'),('Caveat','700','caveat-700.woff2')]
fdir=os.path.join(root,'fonts')
def inline_fonts():
    css=''.join("@font-face{font-family:%s;font-style:normal;font-weight:%s;font-display:swap;src:url(data:font/woff2;base64,%s) format('woff2')}"
                % (fam,w,base64.b64encode(open(os.path.join(fdir,f),'rb').read()).decode()) for fam,w,f in FONTS)
    return '<style>'+css+'</style>'

def out(path,text):
    p=os.path.join(dist,path); os.makedirs(os.path.dirname(p),exist_ok=True); open(p,'w',encoding='utf-8').write(text)
    for bad in ('googleapis','gstatic','http://','https://'):
        assert bad not in re.sub(r'<!--.*?-->','',text,flags=re.S).replace('http://www.w3.org/2000/svg',''), (path,bad)
    print(f'built dist/{path} ({len(text)//1024} KB)')

arc=html.replace('<!--CSP-->',CSP+'\n<script>window.__ARCADE__=1</script>').replace('<!--FONTS-->','<link rel="stylesheet" href="../fonts.css">')
out('t2048/index.html',arc)
fonts=inline_fonts()
out('standalone.html',html.replace('<!--CSP-->',CSP).replace('<!--FONTS-->',fonts))
out('demo.html',html.replace('<!--CSP-->','').replace('<!--FONTS-->',fonts))
print(f'2048 v{ver}')
