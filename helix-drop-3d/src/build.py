#!/usr/bin/env python3
"""Assemble helix-drop-3d/index.html from src/.

Default: Three.js r149 loads from CDN (keeps index.html small).
--inline: Three.js is inlined -> fully self-contained single file
          (use this build for CrazyGames submission).

Game code (logic.js + game.js) is identical in both builds.
"""
import pathlib, sys

CDN_TAG = '<script src="https://unpkg.com/three@0.149.0/build/three.min.js"></script>'

root = pathlib.Path(__file__).parent
inline = '--inline' in sys.argv
three = (root / 'three.min.js').read_text(encoding='utf-8')
logic = (root / 'logic.js').read_text(encoding='utf-8')
game = (root / 'game.js').read_text(encoding='utf-8')
tpl = (root / 'template.html').read_text(encoding='utf-8')

# Strip the Node export shim from logic.js when inlining for the browser.
logic = logic.replace("if (typeof module !== 'undefined') module.exports = HDLogic;", '')

def sub(placeholder, code):
    global tpl
    if placeholder not in tpl:
        sys.exit(f'placeholder {placeholder} missing in template.html')
    tpl = tpl.replace(placeholder, code, 1)

sub('/*__THREE_INLINE__*/', three if inline else CDN_TAG)
sub('/*__LOGIC_INLINE__*/', logic)
sub('/*__GAME_INLINE__*/', game)

out = root.parent / ('index.html' if not inline else 'helix-drop-3d-submit.html')
out.write_text(tpl, encoding='utf-8')
print(f'wrote {out} ({out.stat().st_size/1024:.0f} KB) {"[self-contained]" if inline else "[CDN three.js]"}')
