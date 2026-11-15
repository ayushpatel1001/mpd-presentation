# Living Forest Duel, the rules explained

This is a Vox-style motion-graphics explainer of the rules of *Living Forest Duel*. It runs about 7 m 45 s at 1920×1080 and 30 fps.

It teaches the game from scratch:
- the four instant wins;
- the table;
- how to read a card;
- what happens on a turn;
- how an action token counts elements;
- the four actions;
- your forest and Onibi;
- the end-of-round fire check.

The build writes these files:

| Output | |
|---|---|
| `out/living-forest-duel-explained.mp4` | the video (H.264 + AAC, loudness-normalized to −16 LUFS) |
| `out/living-forest-duel-explained.srt` | captions, one cue per narration line |

`*.mp4` is git-ignored, so rebuild the video with the steps below.

Every rule comes from the rulebook PDF supplied with this project (pages 2–12).

This is an unofficial fan explainer, and the visuals come from two sources:
- The photos of cards, boards and components in `assets/` are cropped from the rulebook PDF. Its pages are phone photos, rotated and lightly sharpened.
- The diagrams (lines, counting, the clearing, the forest grid, the fire check) are drawn in code.

The narration is synthetic (Kokoro TTS), and the music and sound effects are synthesized in code.

## Chapters

| # | Section | What it covers |
|---|---|---|
| – | Cold open | Onibi, Summer vs Winter |
| 01 | Four ways to win | 8 fire tokens; a recruitment line of only your season; a 3×3 forest; Onibi reaches an opponent who holds the Onibi card |
| 02 | The table | clearing, tree piles, recruitment line, help line, draw pile, personal forest and tokens; decks, varans, common animals; the opening cost-12 check |
| 03 | Reading a card | elements and the four actions; solitary, gregarious and neutral symbols; season and cost |
| 04 | A round | reveal or spend a token; where revealed cards go; the third and fourth solitary symbol; gregarious cancelling |
| 05 | Spending a token | counting to the last element; used-up elements; personal line + forest; the second token |
| 06 | The four actions | water takes fire tokens; sun recruits and refills from your deck; sprouts plant trees; spirals move Onibi |
| 07 | Your forest | river back to the lake, covering, matching bonus actions, 9 trees |
| 08 | Onibi | moving, bonus actions, running off the edge, the Onibi card, Sanki cards |
| 09 | End of the round | fire vs water, fire varans, fire spreading, reset |
| 10 | Putting it together | the three tensions of the game |

## How it's built

| File | Role |
|---|---|
| `script.py` | narration beats: text, scene, and for collage scenes the rulebook crops, labels, rings, arrows and stamps, each timed to a spoken word |
| `voice.py` | Kokoro TTS per beat (cached) → `build/vo/*.wav` + `build/timeline.json` |
| `src/lib.js` | drawing kit: paper, highlighter, stamps, scribble arrows, cards, element icons, rulebook-photo cut-outs |
| `src/scenes.js` | one draw function per scene; `collage` lays out the items from `script.py` |
| `src/app.js` | timeline, transitions, section tag, image and font preload; `renderFrame(t)` is a pure function of time |
| `render.mjs` | headless Chromium renders every frame to `build/frames/` (resumable, parallel workers) |
| `audio.py` | synthesized lo-fi score + whooshes/pops, ducked under the voice → `build/mix_raw.wav`, `build/captions.srt` |
| `encode.sh` | FFmpeg two-pass loudnorm and H.264 encode → `out/` |

## Rebuild

The build needs:
- `kokoro-onnx` with its model files in `/home/user/tts`;
- `numpy`, `scipy` and Pillow;
- Node with Playwright and Chromium;
- FFmpeg.

```bash
python3 voice.py
```

```bash
NODE_PATH=$(npm root -g) node render.mjs --workers 4
```

```bash
python3 audio.py
```

```bash
./encode.sh
```

To check a layout quickly, render single frames at chosen times in seconds:

```bash
NODE_PATH=$(npm root -g) node render.mjs --stills 12.5,140,301
```

Fonts: Oswald and Manrope (SIL Open Font License, in `fonts/`).
