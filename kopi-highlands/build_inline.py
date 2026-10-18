#!/usr/bin/env python3
"""Build the single-file deliverable for Kopi Highlands (stdlib only).

Inlines vendor/three.module.min.js + src/game.js into ONE <script type="module">.
three's top-level `export{...}` stays valid in the module; its exported bindings
are in scope for the game code, which is wrapped in an IIFE so three's minified
single-letter internals can never collide with game identifiers.
Usage:  python3 build_inline.py   -> writes dist/index.html AND index.html
(the repo-rooted index.html is the GitHub Pages published artifact).
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent


def read(p):
    return p.read_text(encoding="utf-8")


def main():
    three = read(ROOT / "vendor" / "three.module.min.js")
    game = read(ROOT / "src" / "game.js")
    css = read(ROOT / "src" / "style.css")
    tpl = read(ROOT / "src" / "template.html")

    # Safety: never allow the inlined sources to break out of their tags.
    game = game.replace("</script", "<\\/script").replace("<!--", "<\\!--")
    css = css.replace("</style", "<\\/style").replace("<!--", "<\\!--")
    if "<!--INLINE:" in game or "<!--INLINE:" in css:
        sys.exit("placeholder leak in sources")

    module = three + "\n;(function(){\n'use strict';\n" + game + "\n})();\n"
    html = tpl.replace("<!--INLINE:CSS-->", "<style>\n" + css + "\n</style>")
    html = html.replace("<!--INLINE:MODULE-->", "<script type=\"module\">\n" + module + "\n</script>")
    if "<!--INLINE:" in html:
        sys.exit("unreplaced placeholder in template")

    out = ROOT / "dist" / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    kb = out.stat().st_size / 1024
    print(f"wrote {out} ({kb:.0f} KB)")
    if out.stat().st_size >= 1024 * 1024:
        print("WARNING: deliverable >= 1 MB")

    # Publish artifact for GitHub Pages (repo-rooted, committed).
    pub = ROOT / "index.html"
    pub.write_text(html, encoding="utf-8")
    print(f"wrote {pub} ({kb:.0f} KB) [published]")


if __name__ == "__main__":
    main()
