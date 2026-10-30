#!/usr/bin/env bash
# Build the Mehidpurwala logo stings end to end.
#   ./build.sh                        landscape: out/mehidpurwala_logo_sting.mp4 (5 s, 1920×1080)
#   ./build.sh timeline_reel.json     reel end card: out/mehidpurwala_reel_end.mp4 (4.5 s, 1080×1920)
# Each also writes its score alone as the timeline's "audio" file (used by index.html for live playback).
# 60 fps, H.264 + AAC, loudness-normalised to −14 LUFS / −1 dBTP.
# Needs Python 3 (numpy, scipy, Pillow, shapely), potrace, Node 22 + Playwright's Chromium, FFmpeg.
set -euo pipefail
cd "$(dirname "$0")"
TL=${1:-timeline.json}
NAME=$(basename "$TL" .json)
case "$NAME" in
  timeline) OUT=out/mehidpurwala_logo_sting.mp4 ;;
  timeline_reel) OUT=out/mehidpurwala_reel_end.mp4 ;;
  *) OUT=out/mehidpurwala_$NAME.mp4 ;;
esac
AUDIO=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['audio'])" "$TL")
LOGO=${LOGO:-assets/mehidpurwala_logo.jpg}
mkdir -p "build/$NAME" out

# 1. vector artwork from the logo (committed; re-run only if the source logo changes)
if [[ ${RETRACE:-0} == 1 ]]; then
  python3 trace/build_mark.py "$LOGO" trace/mark.json
  python3 trace/trace_text.py "$LOGO" trace/text.json
fi

# 2. music, 3. frames
python3 audio/score.py "$TL" "build/$NAME/score.wav"
rm -rf "build/$NAME/frames"
node render.mjs --tl "$TL"

# 4. loudness-normalise and mux
ffmpeg -hide_banner -loglevel error -y -i "build/$NAME/score.wav" -af loudnorm=I=-14:TP=-1.0:LRA=11 -ar 48000 "build/$NAME/score_norm.wav"
ffmpeg -hide_banner -loglevel error -y -i "build/$NAME/score_norm.wav" -c:a aac -b:a 256k "$AUDIO"
ffmpeg -hide_banner -loglevel error -y \
  -framerate 60 -i "build/$NAME/frames/f_%05d.png" -i "build/$NAME/score_norm.wav" \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 15 -tune animation -pix_fmt yuv420p -profile:v high -level 4.2 \
  -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart \
  -metadata title="Mehidpurwala — हम फर्नीचर बनाते हैं... दिल से." \
  "$OUT"
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of compact "$OUT"
