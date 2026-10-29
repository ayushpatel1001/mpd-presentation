"""Tile rendered stills into contact sheets: python3 scripts/contact_sheet.py <in_dir> <out_prefix> [cols] [rows]"""
import glob
import os
import sys

from PIL import Image, ImageDraw, ImageFont

src, prefix = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 3
rows = int(sys.argv[4]) if len(sys.argv) > 4 else 3
files = sorted(glob.glob(os.path.join(src, "*.jpg")))
tw, th = 1920 // cols, 1080 // cols * 1
th = tw * 9 // 16
font = ImageFont.truetype(os.path.join(os.path.dirname(__file__), "..", "assets", "fonts", "Inter-700.ttf"), 22)
per = cols * rows
for s in range(0, len(files), per):
    sheet = Image.new("RGB", (cols * tw, rows * th), (0, 0, 0))
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(files[s:s + per]):
        im = Image.open(f).resize((tw, th), Image.LANCZOS)
        x, y = (i % cols) * tw, (i // cols) * th
        sheet.paste(im, (x, y))
        label = os.path.basename(f)[1:-4].lstrip("0") + "s"
        d.rectangle([x + 6, y + 6, x + 110, y + 36], fill=(0, 0, 0))
        d.text((x + 12, y + 8), label, fill=(255, 210, 0), font=font)
    out = f"{prefix}_{s // per + 1:02d}.jpg"
    sheet.save(out, quality=88)
    print(out)
