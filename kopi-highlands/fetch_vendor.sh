#!/bin/bash
# Re-download the pinned three.js build (vendor/ is gitignored; never commit).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p vendor
curl -sL --max-time 120 -o vendor/three.module.min.js \
  https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js
ls -la vendor/three.module.min.js
grep -q "outputColorSpace" vendor/three.module.min.js && echo "r160 sanity OK (outputColorSpace found)"
grep -q 'const t="160"' vendor/three.module.min.js && echo "version pin OK (160)"
