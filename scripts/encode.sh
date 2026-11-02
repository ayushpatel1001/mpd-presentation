#!/usr/bin/env bash
# Mux rendered frames with the final mixes.
#   out/mpd_ujain_3min_3d2d_showcase.mp4             narrated master
#   out/mpd_ujain_3min_3d2d_showcase_music_only.mp4  same picture, music + SFX only
# FILM=<name> encodes build/<name>/ to out/mpd_ujain_<name>[_music_only].mp4
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out
FPS=30
FILM=${FILM:-}
STEM=out/mpd_ujain_${FILM:-3min_3d2d_showcase}
B=build${FILM:+/$FILM}
TITLE=${TITLE:-"MPD Industries – Ujjain Plant Jobwork Capabilities"}
MAIN=$STEM.mp4
ALT=${STEM}_music_only.mp4
CRF=${CRF:-20}

ffmpeg -hide_banner -loglevel warning -stats -y \
  -framerate "$FPS" -i "$B/frames/f_%05d.jpg" \
  -i "$B/audio/mix_narrated.wav" \
  -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf "$CRF" -tune animation -pix_fmt yuv420p -profile:v high -level 4.1 -g 60 \
  -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart -t 180 \
  -metadata title="$TITLE" \
  "$MAIN"

ffmpeg -hide_banner -loglevel warning -y \
  -i "$MAIN" -i "$B/audio/mix_music_only.wav" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart -t 180 \
  -metadata title="$TITLE (music only)" \
  "$ALT"

for f in "$MAIN" "$ALT"; do
  ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate,nb_frames -of compact "$f"
done
