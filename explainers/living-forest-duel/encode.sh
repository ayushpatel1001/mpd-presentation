#!/usr/bin/env bash
# Mux build/frames + build/mix_raw.wav into out/living-forest-duel-explained.mp4 (two-pass loudnorm to -16 LUFS).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
J=$(ffmpeg -hide_banner -nostats -i build/mix_raw.wav -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$J" | python3 -c "import sys,json; print(json.load(sys.stdin)['$1'])"; }
ffmpeg -hide_banner -v error -y -i build/mix_raw.wav \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true,aresample=48000" \
  build/mix.wav
ffmpeg -hide_banner -v error -stats -y -framerate 30 -i build/frames/f_%05d.jpg -i build/mix.wav \
  -c:v libx264 -preset slow -crf "${CRF:-27}" -tune animation -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 192k -shortest out/living-forest-duel-explained.mp4
cp build/captions.srt out/living-forest-duel-explained.srt
ls -la out
