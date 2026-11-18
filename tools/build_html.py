"""Erzeugt app/index.html aus den Quellen in src/ (Aufruf: python3 tools/build_html.py)."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = root / 'src'
def strip_export(t): return t[:t.index("if (typeof module !== 'undefined')")]
s = (src / 'shell.html').read_text(encoding='utf-8')
core = strip_export((src / 'core.js').read_text(encoding='utf-8'))
ex = strip_export((src / 'example.js').read_text(encoding='utf-8'))
ui = (src / 'ui.js').read_text(encoding='utf-8')
assert '</script' not in core + ex + ui
s = s.replace('/*CORE*/', core).replace('/*EXAMPLE*/', ex).replace('/*UI*/', ui)
s = re.sub(r'<link rel="preconnect"[^>]*>\n', '', s)
s = re.sub(r'<link href="https://fonts.googleapis.com[^>]*>\n', '', s)
csp = ('<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\'; '
       'style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; font-src \'self\' data:">\n')
s = s.replace('<meta charset="utf-8">\n', '<meta charset="utf-8">\n' + csp, 1)
s = s.replace("font:14px/1.4 'IBM Plex Sans',system-ui,sans-serif", "font:14px/1.4 'IBM Plex Sans','Segoe UI',system-ui,-apple-system,'Helvetica Neue',sans-serif")
s = s.replace("--mono:'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace", "--mono:'IBM Plex Mono',Consolas,'Cascadia Mono',Menlo,'DejaVu Sans Mono',ui-monospace,monospace")
(root / 'app' / 'index.html').write_text(s, encoding='utf-8')
print('app/index.html erzeugt:', len(s), 'Zeichen')
