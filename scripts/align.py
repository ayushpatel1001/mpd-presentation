"""Step 2: word-level timestamps for the narration -> data/whisper_timestamps.json.

The file follows the schema of Whisper's `word_timestamps=True` output
(segments[].words[] with word/start/end/probability). Whisper weights are not
reachable from this build environment (huggingface.co / openaipublic are
blocked), so timings come from PocketSphinx *forced alignment* against the known
script, which is more precise than free ASR for text we already have. Any
Whisper-format JSON with the same segment ids can be dropped in instead.

Display tokens such as "6,900" are spoken as several words ("sixty nine
hundred"); their timestamp spans the first to the last spoken word.
"""
import os
import subprocess
import sys

from pocketsphinx import Decoder

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from timeline_lib import BUILD, load_json, norm_word, save_json  # noqa: E402

# CMU-phoneset pronunciations for words missing from cmudict-en-us.
EXTRA_PRON = {
    "alkyds": "AE L K IH D Z",
    "flakers": "F L EY K ER Z",
    "kilocalorie": "K IH L OW K AE L ER IY",
    "kiloliter": "K IH L OW L IY T ER",
    "kiloliters": "K IH L OW L IY T ER Z",
    "oo": "UW",
    "pelletizers": "P EH L AH T AY Z ER Z",
    "phenolics": "F AH N AA L IH K S",
    "polyols": "P AA L IY AO L Z",
    "thermic": "TH ER M IH K",
}
FRAME = 0.01


def pcm16k(path):
    return subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                          check=True, capture_output=True).stdout


def align_line(dec, wav, words):
    dec.set_align_text(" ".join(words))
    dec.start_utt()
    dec.process_raw(pcm16k(wav), full_utt=True)
    dec.end_utt()
    out = []
    for s in dec.seg():
        w = s.word.split("(")[0]
        if w in ("<s>", "</s>", "<sil>", "[NOISE]"):
            continue
        out.append({"w": w, "start": s.start_frame * FRAME, "end": (s.end_frame + 1) * FRAME, "p": float(s.prob)})
    got = [o["w"] for o in out]
    if got != words:
        raise SystemExit(f"alignment mismatch for {wav}:\n expected {words}\n got      {got}")
    return out


def main():
    layout = load_json("narration_layout.json")
    dec = Decoder(samprate=16000, bestpath=False)
    for w, pron in EXTRA_PRON.items():
        dec.add_word(w, pron, True)

    segments, full_text = [], []
    for i, line in enumerate(layout["lines"]):
        spoken = [w for tok in line["tokens"] for w in tok["spoken"]]
        wav = os.path.join(BUILD, "vo", line["id"] + ".wav")
        aligned = align_line(dec, wav, spoken)
        t0 = line["start"]
        words, k = [], 0
        for tok in line["tokens"]:
            n = len(tok["spoken"])
            part = aligned[k:k + n]
            k += n
            words.append({
                "word": " " + tok["display"],
                "start": round(t0 + part[0]["start"], 3),
                "end": round(t0 + part[-1]["end"], 3),
                "probability": round(min(p["p"] for p in part), 3),
                "key": norm_word(tok["display"]),
                "spoken": [{"word": p["w"], "start": round(t0 + p["start"], 3), "end": round(t0 + p["end"], 3)}
                           for p in part],
            })
        segments.append({"id": i, "line_id": line["id"], "start": words[0]["start"], "end": words[-1]["end"],
                         "text": " " + line["display"], "words": words})
        full_text.append(line["display"])
        print(f"{line['id']}: {len(words)} words, {words[0]['start']:.2f}–{words[-1]['end']:.2f}s, "
              f"min p={min(w['probability'] for w in words):.2f}")

    save_json("whisper_timestamps.json", {
        "engine": "pocketsphinx-5 forced alignment (Whisper-compatible schema; Whisper weights unreachable in build env)",
        "language": "en",
        "text": " ".join(full_text),
        "segments": segments,
    })


if __name__ == "__main__":
    main()
