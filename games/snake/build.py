#!/usr/bin/env python3
"""python3 build.py -> dist/  (snake/index.html for Arcade, standalone.html, demo.html)"""
import base64, glob, os

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
DIST = os.path.join(ROOT, 'dist')
CSP = ("<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'self' 'unsafe-inline'; "
       "style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:\">")

def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()

def font_css():
    p = os.path.join(ROOT, 'web', 'fonts', 'inter.woff2')
    if not os.path.exists(p):
        return ''
    b = base64.b64encode(open(p, 'rb').read()).decode()
    return "@font-face{font-family:Inter;src:url(data:font/woff2;base64,%s) format('woff2');font-weight:100 900;font-display:swap}" % b

def build(arcade=False, csp=True, fonts=True):
    html = read(os.path.join(SRC, 'app.html'))
    js = [read(os.path.join(SRC, 'engine.js')), read(os.path.join(SRC, 'core.js'))]
    js += [read(p) for p in sorted(glob.glob(os.path.join(SRC, 'i18n_*.js')))]
    html = html.replace('/*ENGINE*/', '\n'.join(js))
    html = html.replace('<!--CSP-->', CSP if csp else '')
    html = html.replace('/*FONTS*/', font_css() if fonts else '')
    html = html.replace('<!--FONTLINK-->', '<link rel="stylesheet" href="../fonts.css">' if arcade else '')
    html = html.replace('<!--ARCADEFLAG-->', '<script>window.__ARCADE__=1</script>' if arcade else '')
    return html

def write(rel, text):
    p = os.path.join(DIST, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(text)
    print('  %-22s %6.1f KB' % (rel, len(text.encode()) / 1024))

if __name__ == '__main__':
    print('Snake build')
    write('snake/index.html', build(arcade=True, csp=True, fonts=False))
    write('standalone.html', build(arcade=False, csp=True, fonts=True))
    write('demo.html', build(arcade=False, csp=False, fonts=True))
