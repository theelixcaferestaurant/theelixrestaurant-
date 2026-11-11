#!/usr/bin/env bash
# Usage:  bash tools/optimize-media.sh <folder-with-originals>
# Converts originals into web-ready files (needs ffmpeg installed).
#   photos (jpg/png/tiff) -> src/assets/images/<name>.webp   (max 1600 px wide, quality 80)
#   clips  (mov/mp4/mkv)  -> src/assets/videos/<name>.mp4    (H.264, max 720 px wide, no audio, fast-start, ~1-2 MB)
#                         -> src/assets/videos/<name>.webm   (VP9, smaller alternative)
# Name your originals after the item id (for example masala-dosa.jpg, masala-dosa.mov).
set -euo pipefail
IN="${1:?give the folder that holds your original photos and clips}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/src/assets/images" "$ROOT/src/assets/videos"
shopt -s nullglob nocaseglob
for f in "$IN"/*.{jpg,jpeg,png,tif,tiff}; do
  n="$(basename "${f%.*}" | tr 'A-Z' 'a-z')"
  ffmpeg -v error -y -i "$f" -vf "scale='min(1600,iw)':-2" -q:v 80 "$ROOT/src/assets/images/$n.webp"
  echo "photo  $n.webp"
done
for f in "$IN"/*.{mov,mp4,mkv,m4v}; do
  n="$(basename "${f%.*}" | tr 'A-Z' 'a-z')"
  if [ "$n" = "hero-food" ]; then
    # Home hero clip: 1080 px wide portrait, max 12 s, no audio, plus a poster frame. Goes to public/video/.
    mkdir -p "$ROOT/public/video"
    ffmpeg -v error -y -i "$f" -an -t 12 -vf "scale='min(1080,iw)':-2,fps=30" -c:v libx264 -crf 27 -preset slow -pix_fmt yuv420p -movflags +faststart "$ROOT/public/video/hero-food.mp4"
    ffmpeg -v error -y -i "$f" -an -t 12 -vf "scale='min(1080,iw)':-2,fps=30" -c:v libvpx-vp9 -crf 38 -b:v 0 "$ROOT/public/video/hero-food.webm"
    ffmpeg -v error -y -i "$f" -frames:v 1 -vf "scale='min(1080,iw)':-2" -q:v 4 "$ROOT/public/video/hero-food-poster.jpg"
    echo "hero   hero-food.mp4 + .webm + poster (public/video)"
    continue
  fi
  ffmpeg -v error -y -i "$f" -an -t 8 -vf "scale='min(720,iw)':-2,fps=30" -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -movflags +faststart "$ROOT/src/assets/videos/$n.mp4"
  ffmpeg -v error -y -i "$f" -an -t 8 -vf "scale='min(720,iw)':-2,fps=30" -c:v libvpx-vp9 -crf 38 -b:v 0 "$ROOT/src/assets/videos/$n.webm"
  echo "clip   $n.mp4 + .webm"
done
