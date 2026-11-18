"""Erzeugt app/index.html (Desktop, offline) und web/index.html (Web-Version) aus src/.
Aufruf: python3 tools/build_html.py"""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = root / 'src'
FILES = ['core.js', 'instr.js', 'awl.js', 'example.js', 'editor.js', 'ui.js']

def strip_export(t):
    i = t.find("if (typeof module !== 'undefined')")
    return t[:i] if i >= 0 else t

js = '\n;\n'.join(strip_export((src / f).read_text(encoding='utf-8')) for f in FILES)
js = "'use strict';\n" + re.sub(r"^'use strict';\s*$", '', js, flags=re.M)
assert '</script' not in js
shell = (src / 'shell.html').read_text(encoding='utf-8')
web = shell.replace('/*JS*/', js)
(root / 'web').mkdir(exist_ok=True)
(root / 'web' / 'index.html').write_text(web, encoding='utf-8')

d = web
d = re.sub(r'<link rel="preconnect"[^>]*>\n', '', d)
d = re.sub(r'<link href="https://fonts.googleapis.com[^>]*>\n', '', d)
csp = ('<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\'; '
       'style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; font-src \'self\' data:">\n')
d = d.replace('<meta charset="utf-8">\n', '<meta charset="utf-8">\n' + csp, 1)
d = d.replace("font:14px/1.4 'IBM Plex Sans',system-ui,sans-serif", "font:14px/1.4 'IBM Plex Sans','Segoe UI',system-ui,-apple-system,'Helvetica Neue',sans-serif")
d = d.replace("--mono:'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace", "--mono:'IBM Plex Mono',Consolas,'Cascadia Mono',Menlo,'DejaVu Sans Mono',ui-monospace,monospace")
assert 'googleapis' not in d
(root / 'app' / 'index.html').write_text(d, encoding='utf-8')
print('app/index.html und web/index.html erzeugt:', len(d), 'Zeichen')
