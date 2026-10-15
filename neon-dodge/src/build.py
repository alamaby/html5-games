#!/usr/bin/env python3
"""Build single-file index.html for Neon Dodge (inline logic + game)."""
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
tpl = (ROOT / 'template.html').read_text(encoding='utf-8')
logic = (ROOT / 'logic.js').read_text(encoding='utf-8')
game = (ROOT / 'game.js').read_text(encoding='utf-8')

logic_inline = '<script>\n' + logic + '\n</script>'
game_inline = '<script>\n' + game + '\n</script>'

out = tpl.replace('<script>/*__LOGIC_INLINE__*/</script>', logic_inline)
out = out.replace('<script>/*__GAME_INLINE__*/</script>', game_inline)
assert '__LOGIC_INLINE__' not in out and '__GAME_INLINE__' not in out, 'placeholder leak'
assert out.count('<script>') == 2, 'expected exactly 2 script blocks, got %d' % out.count('<script>')

dest = ROOT.parent / 'index.html'
dest.write_text(out, encoding='utf-8')
print('wrote %s (%d KB)' % (dest, dest.stat().st_size // 1024))
