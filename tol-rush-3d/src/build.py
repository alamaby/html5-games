#!/usr/bin/env python3
"""Build single-file index.html for Tol Rush 3D (inline logic + game).

Default: Three.js r149 loads from CDN, default language Indonesian
(the GitHub Pages build).

--portal: the CrazyGames submission build, written to portal/index.html
  (NOT the Pages index.html, and never pushed to Pages by itself):
  - Three.js r149 inlined from src/three.min.js (same file the Pages
    build loads from unpkg) -> no external dependency except the SDK
  - CrazyGames SDK v3 script tag added in <head>, loaded from the
    CrazyGames CDN as required (the SDK itself must NOT be self-hosted)
  - Default language English (Indonesian stays available via toggle)
  Game code is identical in both builds; the SDK calls in game.js are
  guarded, so the portal file still plays with no SDK present.
"""
import base64
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CDN_TAG = '<script src="https://unpkg.com/three@0.149.0/build/three.min.js"></script>'
SDK_TAG = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>'
portal = '--portal' in sys.argv

tpl = (ROOT / 'template.html').read_text(encoding='utf-8')
logic = (ROOT / 'logic.js').read_text(encoding='utf-8')
game = (ROOT / 'game.js').read_text(encoding='utf-8')

# GLTF player cars (Quaternius Cars Bundle, CC0): one model per kind,
# base64-inlined so the single-file build stays self-contained (the .glb
# itself is never pushed — binary files cannot go through the push tool).
# Each placeholder appears exactly once in game.js (in GLB_CARS_B64);
# the makeCar guard builds the placeholder name dynamically, so it
# never contains a literal placeholder.
GLB_FILES = {
    '__GLB_SEDAN_B64__': 'quaternius-car-1.glb',
    '__GLB_HATCH_B64__': 'quaternius-car-2.glb',
    '__GLB_SUV_B64__': 'quaternius-suv.glb',
    '__GLB_SPORT_B64__': 'quaternius-sports-1.glb',
}
for ph, fname in GLB_FILES.items():
    assert game.count(ph) == 1, 'GLB placeholder count changed: ' + ph
    game = game.replace(ph, base64.b64encode((ROOT / fname).read_bytes()).decode('ascii'), 1)
    assert ph not in game, 'GLB placeholder not replaced: ' + ph

if portal:
    three = (ROOT / 'three.min.js').read_text(encoding='utf-8')
    assert CDN_TAG in tpl, 'CDN three tag missing from template'
    tpl = tpl.replace(CDN_TAG,
                      '<script>\n' + three + '\n</script>\n' + SDK_TAG, 1)
    assert '<html lang="id">' in tpl, 'html lang tag missing'
    tpl = tpl.replace('<html lang="id">', '<html lang="en">', 1)
    # Default language: English for the portal build only. Each
    # replacement must hit exactly once, or the build is wrong.
    for old, new in [("let lang = 'id';", "let lang = 'en';"),
                     ("localStorage.getItem('tr_lang') || 'id'",
                      "localStorage.getItem('tr_lang') || 'en'")]:
        assert game.count(old) == 1, 'lang default pattern not unique: ' + old
        game = game.replace(old, new, 1)
    assert 'unpkg.com' not in tpl, 'CDN reference leaked into portal build'
    assert SDK_TAG in tpl, 'SDK tag missing from portal build'

out = tpl.replace('<script>/*__LOGIC_INLINE__*/</script>', '<script>\n' + logic + '\n</script>')
out = out.replace('<script>/*__GAME_INLINE__*/</script>', '<script>\n' + game + '\n</script>')
assert '__LOGIC_INLINE__' not in out and '__GAME_INLINE__' not in out, 'placeholder leak'
assert 'Tol Rush 3D' in out and 'TR.createGame' in out, 'inline failed'

if portal:
    dest = ROOT.parent / 'portal' / 'index.html'
    dest.parent.mkdir(exist_ok=True)
else:
    dest = ROOT.parent / 'index.html'
dest.write_text(out, encoding='utf-8')
print('wrote %s (%d KB)%s' % (dest, dest.stat().st_size // 1024,
                              ' [portal: inline three + CG SDK v3 + EN default]' if portal else ''))
