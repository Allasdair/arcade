"""Build Ship Fight.

  python3 build.py   ->  dist/shipfight/index.html   Arcade build (window.__ARCADE__=1, links ../fonts.css)
                         dist/standalone.html        one self-contained file for testing on its own (fonts inlined)
                         dist/demo.html              the standalone build without its CSP meta, for a claude.ai artifact preview
                                                     (claude.ai applies its own strict policy to artifacts)
Needs only Python 3. No dependencies. Fonts for the standalone build are read from ../sweep/web/fonts (SIL OFL) if present.
"""
import re, os, base64
root=os.path.dirname(os.path.abspath(__file__)); src=os.path.join(root,'src'); dist=os.path.join(root,'dist')
rd=lambda *p: open(os.path.join(*p),encoding='utf-8').read()
i18n=''.join(rd(src,f)+'\n' for f in sorted(os.listdir(src)) if f.startswith('i18n') and f.endswith('.js'))
html=rd(src,'app.html').replace('/*ENGINE*/',rd(src,'engine.js')+'\n'+rd(src,'core.js')+'\n'+i18n)
ver=re.search(r"VERSION='([\d.]+)'",html).group(1)
# The same strict policy Arcade uses: nothing outside the game's own origin, no outside requests of any kind.
CSP='''<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">'''
DESC='<meta name="description" content="Ship Fight: an ad-free naval battle game against the computer, with a Daily Hunt.">'
assert html.count('<!--HEAD-->')==1 and 'http://' not in html and 'https://' not in html.replace('https://claude','')
arcade=html.replace('<!--HEAD-->',DESC+'\n'+CSP+'\n<link rel="stylesheet" href="../fonts.css">\n<script>window.__ARCADE__=1</script>')
fonts=''
fd=os.path.join(root,'..','sweep','web','fonts')
for fam,f,w in [('Inter','inter.woff2','100 900'),('JetBrains Mono','jetbrains-mono-700.woff2','700')]:
  p=os.path.join(fd,f)
  if os.path.exists(p): fonts+='@font-face{font-family:"%s";font-style:normal;font-weight:%s;font-display:swap;src:url(data:font/woff2;base64,%s) format("woff2")}\n'%(fam,w,base64.b64encode(open(p,'rb').read()).decode())
style=f'<style>/* Inter and JetBrains Mono, SIL Open Font License */\n{fonts}</style>' if fonts else ''
single=html.replace('<!--HEAD-->',DESC+'\n'+CSP+'\n'+style)
demo=html.replace('<!--HEAD-->',DESC+'\n'+style)
os.makedirs(os.path.join(dist,'shipfight'),exist_ok=True)
for name,txt in [('shipfight/index.html',arcade),('standalone.html',single),('demo.html',demo)]:
  open(os.path.join(dist,name),'w',encoding='utf-8').write(txt)
print(f'built dist/ (v{ver}): shipfight/index.html {len(arcade)//1024} KB, standalone.html {len(single)//1024} KB{"" if fonts else " (system fonts)"}')
