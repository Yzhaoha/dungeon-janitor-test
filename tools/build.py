#!/usr/bin/env python3
"""Build Dungeon Janitor from src/.

Output:
  index.html                              test build, no SDK, FPS counter on  -> GitHub Pages root
  poki/, crazygames/                       platform builds (also served on Pages)
  dist/dungeon-janitor-poki.zip, dist/dungeon-janitor-crazygames.zip  (index.html at the zip root)
Run: python3 tools/build.py
"""
import os, shutil, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
rd = lambda *p: open(os.path.join(SRC, *p), encoding='utf-8').read()
# single self-contained index.html: plain canvas 2D, no libraries, no external requests but the platform SDK
LOADER = '''<script>
(function(){ var s=document.createElement('script'); s.textContent=document.getElementById('gamesrc').textContent; document.body.appendChild(s); })();
</script>'''

def html(platform):
    head = rd('head.html')
    assert head.count('<!--PLATFORM_HEAD-->') == 1
    sdk = rd('platform', platform + '.head.html').rstrip('\n') if platform else ''
    head = head.replace('<!--PLATFORM_HEAD-->\n', sdk + '\n' if sdk else '')
    game = rd('sim.js').replace("if (typeof module!=='undefined') module.exports=DJ;", '') + '\n' + rd('i18n.js') + '\n' + rd('game.js')
    return head + '<script id="gamesrc" type="text/plain">\n' + game + '\n</script>\n' + LOADER + '\n</body>\n</html>\n'

def write(dirpath, text):
    os.makedirs(dirpath, exist_ok=True)
    open(os.path.join(dirpath, 'index.html'), 'w', encoding='utf-8').write(text)

write(ROOT, html(None)); print('index.html (test)')
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
for p in ['poki', 'crazygames']:
    out = os.path.join(ROOT, p); write(out, html(p))
    z = os.path.join(ROOT, 'dist', 'dungeon-janitor-%s.zip' % p)
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in ['index.html']:
            zf.write(os.path.join(out, f), f)
    print(p, os.path.getsize(z) // 1024, 'KB ->', os.path.relpath(z, ROOT))
