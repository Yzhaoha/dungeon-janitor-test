#!/usr/bin/env python3
"""Build Potion Sort Knight from src/ and art/.

Output:
  index.html + img/                        test build, no SDK -> GitHub Pages root
  poki/, crazygames/ (each with img/)      platform builds (also served on Pages)
  dist/potion-sort-knight-poki.zip, dist/potion-sort-knight-crazygames.zip  (index.html and img/ at the zip root)
art/*.png (ChatGPT drawings, 1024x1024 characters / 1920x1080 scenes) are shrunk to img/*.webp, and each character's
opaque box is measured so the game can stand it on its feet; that table is written into the game as ART_META.
Run: python3 tools/build.py
"""
import os, json, shutil, zipfile
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src'); ART = os.path.join(ROOT, 'art'); IMG = os.path.join(ROOT, 'img')
rd = lambda *p: open(os.path.join(SRC, *p), encoding='utf-8').read()
LOADER = '''<script>
(function(){ var s=document.createElement('script'); s.textContent=document.getElementById('gamesrc').textContent; document.body.appendChild(s); })();
</script>'''

def build_art():
    meta = {}
    os.makedirs(IMG, exist_ok=True)
    if not os.path.isdir(ART): return meta
    for f in sorted(os.listdir(ART)):
        if not f.endswith('.png'): continue
        name = f[:-4]; src = os.path.join(ART, f); dst = os.path.join(IMG, name + '.webp')
        im = Image.open(src)
        if im.mode == 'RGBA':
            bb = im.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox() or (0, 0, im.width, im.height)
            meta[name] = {'w': im.width, 'h': im.height, 'bb': list(bb)}
            if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
                im.resize((512, 512), Image.LANCZOS).save(dst, 'WEBP', quality=86, method=6)
        else:
            meta[name] = {'w': im.width, 'h': im.height}
            if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
                im.convert('RGB').resize((1280, 720), Image.LANCZOS).save(dst, 'WEBP', quality=80, method=6)
    return meta

def html(platform, meta):
    head = rd('head.html')
    assert head.count('<!--PLATFORM_HEAD-->') == 1
    sdk = rd('platform', platform + '.head.html').rstrip('\n') if platform else ''
    head = head.replace('<!--PLATFORM_HEAD-->\n', sdk + '\n' if sdk else '')
    g = rd('game.js'); assert g.count('/*ART_META*/null') == 1
    g = g.replace('/*ART_META*/null', json.dumps(meta, separators=(',', ':')))
    game = rd('sim.js').replace("if (typeof module!=='undefined') module.exports=DJ;", '') + '\n' + rd('i18n.js') + '\n' + g
    return head + '<script id="gamesrc" type="text/plain">\n' + game + '\n</script>\n' + LOADER + '\n</body>\n</html>\n'

def write(dirpath, text):
    os.makedirs(dirpath, exist_ok=True)
    open(os.path.join(dirpath, 'index.html'), 'w', encoding='utf-8').write(text)
    if os.path.abspath(dirpath) != os.path.abspath(ROOT):
        d = os.path.join(dirpath, 'img'); shutil.rmtree(d, ignore_errors=True); shutil.copytree(IMG, d)

meta = build_art()
write(ROOT, html(None, meta)); print('index.html (test),', len(meta), 'images,', sum(os.path.getsize(os.path.join(IMG, f)) for f in os.listdir(IMG)) // 1024, 'KB of img/')
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
for p in ['poki', 'crazygames']:
    out = os.path.join(ROOT, p); write(out, html(p, meta))
    z = os.path.join(ROOT, 'dist', 'potion-sort-knight-%s.zip' % p)
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.write(os.path.join(out, 'index.html'), 'index.html')
        for f in sorted(os.listdir(os.path.join(out, 'img'))): zf.write(os.path.join(out, 'img', f), 'img/' + f)
    print(p, os.path.getsize(z) // 1024, 'KB ->', os.path.relpath(z, ROOT))
