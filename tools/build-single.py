#!/usr/bin/env python3
"""Gera um HTML único (todo o JS embutido) — usado para publicar como artefato.
uso: python3 tools/build-single.py saida.html"""
import sys, os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
js = ''.join(open(os.path.join(root, 'js', f + '.js'), encoding='utf8').read() + '\n'
             for f in ['font', 'audio', 'camp', 'map', 'game', 'render', 'lobby', 'main'])
html = f"""<title>Dead Pixel</title>
<style>
  :root {{ --bg: #0b0b10; --fg: #e8e6ef; color-scheme: dark; }}
  html, body {{ height: 100%; }}
  body {{ margin: 0; background: var(--bg); color: var(--fg); overflow: hidden; position: relative;
    -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }}
  #stage {{ position: absolute; inset: 0; }}
  canvas {{ display: block; image-rendering: pixelated; image-rendering: crisp-edges; touch-action: none; }}
</style>
<div id="stage"><canvas id="c"></canvas></div>
<script>
{js}
</script>
"""
open(sys.argv[1], 'w', encoding='utf8').write(html)
