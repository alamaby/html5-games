#!/usr/bin/env python3
"""Build single-file index.html for Tol Rush 3D (inline logic + game).
Three.js stays on CDN (same pattern as the Helix Drop 3D dev build);
a portal submit build would inline three.min.js instead."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
tpl = (ROOT / 'template.html').read_text(encoding='utf-8')
logic = (ROOT / 'logic.js').read_text(encoding='utf-8')
game = (ROOT / 'game.js').read_text(encoding='utf-8')

out = tpl.replace('<script>/*__LOGIC_INLINE__*/</script>', '<script>\n' + logic + '\n</script>')
out = out.replace('<script>/*__GAME_INLINE__*/</script>', '<script>\n' + game + '\n</script>')
assert '__LOGIC_INLINE__' not in out and '__GAME_INLINE__' not in out, 'placeholder leak'
assert 'Tol Rush 3D' in out and 'TR.createGame' in out, 'inline failed'

dest = ROOT.parent / 'index.html'
dest.write_text(out, encoding='utf-8')
print('wrote %s (%d KB)' % (dest, dest.stat().st_size // 1024))
