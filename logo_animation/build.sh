#!/usr/bin/env bash
# Build the Mehidpurwala logo sting end to end.
#   out/mehidpurwala_logo_sting.mp4    5 s, 1920×1080, 60 fps, H.264 + AAC, −14 LUFS
#   out/mehidpurwala_logo_score.m4a    the score alone (also used by index.html for live playback)
# Needs Python 3 (numpy, scipy, Pillow, shapely), potrace, Node 22 + Playwright's Chromium, FFmpeg.
set -euo pipefail
cd "$(dirname "$0")"
LOGO=${LOGO:-assets/mehidpurwala_logo.jpg}
mkdir -p build out

# 1. vector artwork from the logo (committed; re-run only if the source logo changes)
if [[ ${RETRACE:-0} == 1 ]]; then
  python3 trace/build_mark.py "$LOGO" trace/mark.json
  python3 trace/trace_text.py "$LOGO" trace/text.json
fi

# 2. music, 3. frames
python3 audio/score.py build/score.wav
rm -rf build/frames
node render.mjs

# 4. loudness-normalise and mux
ffmpeg -hide_banner -loglevel error -y -i build/score.wav -af loudnorm=I=-14:TP=-1.0:LRA=11 -ar 48000 build/score_norm.wav
ffmpeg -hide_banner -loglevel error -y -i build/score_norm.wav -c:a aac -b:a 256k out/mehidpurwala_logo_score.m4a
ffmpeg -hide_banner -loglevel warning -stats -y \
  -framerate 60 -i build/frames/f_%05d.png -i build/score_norm.wav \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 15 -tune animation -pix_fmt yuv420p -profile:v high -level 4.2 \
  -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart \
  -metadata title="Mehidpurwala — हम फर्नीचर बनाते हैं... दिल से." \
  out/mehidpurwala_logo_sting.mp4
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of compact out/mehidpurwala_logo_sting.mp4
