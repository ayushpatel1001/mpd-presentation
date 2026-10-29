#!/usr/bin/env bash
# Mux rendered frames with the final mixes.
#   out/mpd_ujain_3min_3d2d_showcase.mp4             narrated master
#   out/mpd_ujain_3min_3d2d_showcase_music_only.mp4  same picture, music + SFX only
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out
FPS=30
MAIN=out/mpd_ujain_3min_3d2d_showcase.mp4
ALT=out/mpd_ujain_3min_3d2d_showcase_music_only.mp4
# CRF 23 keeps the 3-minute 1080p master under GitHub's 100 MB file limit; CRF=20 for a higher-quality local copy
CRF=${CRF:-23}

ffmpeg -hide_banner -loglevel warning -stats -y \
  -framerate "$FPS" -i build/frames/f_%05d.jpg \
  -i build/audio/mix_narrated.wav \
  -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf "$CRF" -tune animation -pix_fmt yuv420p -profile:v high -level 4.1 -g 60 \
  -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart -t 180 \
  -metadata title="MPD Industries – Ujjain Plant Jobwork Capabilities" \
  "$MAIN"

ffmpeg -hide_banner -loglevel warning -y \
  -i "$MAIN" -i build/audio/mix_music_only.wav \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart -t 180 \
  -metadata title="MPD Industries – Ujjain Plant Jobwork Capabilities (music only)" \
  "$ALT"

for f in "$MAIN" "$ALT"; do
  ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate,nb_frames -of compact "$f"
done
