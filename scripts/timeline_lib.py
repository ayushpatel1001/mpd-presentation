"""Shared helpers for the narration / alignment / timeline-resolve steps."""
import json
import math
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
BUILD = os.path.join(ROOT, "build")

BRACE = re.compile(r"\{([^{}|]+)\|([^{}]+)\}")


def load_json(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


def save_json(name, obj):
    path = os.path.join(DATA, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")
    return path


def norm_word(w):
    """Normalise a token for matching: lowercase, strip surrounding punctuation."""
    return re.sub(r"^[^\w&]+|[^\w&]+$", "", w.lower().replace("’", "'"))


def spoken_words(text):
    """Split spoken text into dictionary words (hyphens split, punctuation dropped)."""
    out = []
    for raw in re.split(r"[\s\-–—]+", text):
        w = raw.lower().replace("’", "'")
        w = re.sub(r"[^a-z']", "", w).strip("'")
        if w.endswith("s'"):
            w = w[:-1]
        if w:
            out.append(w)
    return out


def parse_line(text):
    """Parse '{display|spoken}' markup.

    Returns (display_text, tts_text, tokens) where each token is
    {"display": str, "spoken": [words...]} in reading order. Display tokens keep
    their punctuation (for captions); spoken words are what the aligner sees.
    """
    tokens = []
    display_parts, tts_parts = [], []
    pos = 0
    for m in BRACE.finditer(text):
        _plain(text[pos:m.start()], tokens, display_parts, tts_parts)
        disp, spoken = m.group(1), m.group(2)
        # punctuation glued to the closing brace belongs to this display token
        tail = re.match(r"[^\s{]*", text[m.end():]).group(0)
        tokens.append({"display": disp + tail, "spoken": spoken_words(spoken)})
        display_parts.append(disp + tail)
        tts_parts.append(spoken + tail)
        pos = m.end() + len(tail)
    _plain(text[pos:], tokens, display_parts, tts_parts)
    display = re.sub(r"\s+", " ", " ".join(display_parts)).strip()
    tts = re.sub(r"\s+", " ", " ".join(tts_parts)).strip()
    return display, tts, tokens


def _plain(chunk, tokens, display_parts, tts_parts):
    for raw in chunk.split():
        tokens.append({"display": raw, "spoken": spoken_words(raw)})
        display_parts.append(raw)
        tts_parts.append(raw)


def snap_up(t, grid):
    return math.ceil(t / grid - 1e-9) * grid
