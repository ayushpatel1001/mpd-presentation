#!/usr/bin/env bash
# End-to-end build: narration → word timestamps → resolved timeline → audio → validation → frames → MP4.
# Usage: scripts/build.sh [--skip-render]
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== 1/6 narration (TTS or build/vo_override/*.wav)"
python3 scripts/narration.py
echo "== 2/6 word timestamps -> data/whisper_timestamps.json"
python3 scripts/align.py 2>/dev/null
echo "== 3/6 resolve beat grid -> data/timeline.resolved.json"
python3 scripts/resolve_timeline.py
echo "== 4/6 score, SFX and mix"
python3 scripts/audio.py
echo "== 5/6 validation (contrast, legibility, safe area, sync, loudness)"
node scripts/validate.mjs
if [[ "${1:-}" != "--skip-render" ]]; then
  echo "== 6/6 render frames + encode"
  node scripts/render_frames.mjs --workers "${WORKERS:-2}"
  bash scripts/encode.sh
fi
