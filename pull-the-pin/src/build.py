#!/usr/bin/env python3
"""Build pull-the-pin/index.html by inlining src/logic.js + src/game.js into template."""
import sys, pathlib

HERE = pathlib.Path(__file__).resolve().parent
INLINE = '--inline' in sys.argv  # (no CDN deps; flag kept for parity)

tpl = (HERE / 'template.html').read_text(encoding='utf-8')
logic = (HERE / 'logic.js').read_text(encoding='utf-8')
game = (HERE / 'game.js').read_text(encoding='utf-8')

def sub(placeholder, code):
    global tpl
    if placeholder not in tpl:
        sys.exit(f'placeholder {placeholder} missing in template.html')
    tpl = tpl.replace(placeholder, code, 1)

sub('/*__LOGIC_INLINE__*/', logic)
sub('/*__GAME_INLINE__*/', game)

out = HERE.parent / 'index.html'
out.write_text(tpl, encoding='utf-8')
print(f'wrote {out} ({out.stat().st_size // 1024} KB)')
