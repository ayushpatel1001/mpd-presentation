# Duel for Middle-earth, explained for 7 Wonders Duel players

A Vox-style motion-graphics explainer (about 7 m 46 s, 1920×1080, 30 fps) of *The Lord of the Rings: Duel for
Middle-earth* (Repos Production, 2024, by Antoine Bauza and Bruno Cathala), written for people who already play
*7 Wonders Duel*. It walks through what changed, step by step, comparing each new rule with the one they know.

| Output | |
|---|---|
| `out/duel-for-middle-earth-explained.mp4` | the video (H.264 + AAC, loudness-normalized to −16 LUFS) |
| `out/duel-for-middle-earth-explained.srt` | captions, one cue per narration line |

This is an unofficial fan explainer. All illustrations are original diagrams drawn in code; no game artwork,
logos or photos are used. The narration is synthetic (Kokoro TTS), and the music and sound effects are
synthesized in code.

## Chapters

| # | Section | What it covers |
|---|---|---|
| – | Cold open | same pyramid draft, three rounds, sudden wins; new setting |
| 01 | No more points | no victory points; three instant-win races |
| 02 | Two sides | Fellowship vs Sauron; Sauron goes first; 3 vs 2 starting coins |
| 03 | The turn | uncovered cards only; play it, discard it (1/2/3 coins by chapter), or take a Landmark |
| 04 | Skills, not resources | brown + grey become grey skills (Ruse, Strength, Courage, Knowledge, Leadership); a missing skill always costs 1 coin |
| 05 | The colour map | grey, yellow, blue, green, red and chapter-3 purple, side by side with 7 Wonders Duel; chaining from chapter 2 |
| 06 | Win #1: the Quest | Ring symbols, Frodo & Sam vs the Nazgûl, the Nazgûl riding on the hobbits' piece, bonus spaces |
| 07 | Win #2: the Races | six races, six different symbols; pairs and the once-per-game three-race bonus give Alliance tokens; the Eagle |
| 08 | Win #3: Conquest | the seven regions, starting units, red cards, one-for-one conflicts, presence, conquest |
| 09 | Landmarks | seven tiles, three face up, cost + 1 per fortress, fortresses, one-time effects |
| 10 | If nobody wins | most regions wins; ties share the victory |
| 11 | Why it plays differently | three races at once, and how the fronts feed each other |

## Rules sources and accuracy

The script uses only rules that were confirmed from rulebook-based summaries and reviews, including:
[officialgamerules.org](https://officialgamerules.org/game-rules/the-lord-of-the-rings-duel-for-middle-earth/),
[Skip the Rulebook](https://www.skiptherulebook.com/games/lord-of-the-rings-duel-for-middle-earth),
[BoardGame Archive](https://boardgamearchive.com/games/duel-for-middle-earth/),
[Repos Production](https://www.rprod.com/en/games/duel-for-middle-earth),
[Misut Meeple](https://misutmeeple.com/en/2024/10/review-the-lord-of-the-rings-duel-for-middle-earth/),
[GeekDad](https://geekdad.com/2025/01/the-lord-of-the-rings-duel-duel-for-middle-earth-tom-bombadil-not-included/),
[Wargamer](https://www.wargamer.com/lord-of-the-rings-duel-for-middle-earth/flaws) and
[Board Game Quest](https://www.boardgamequest.com/the-lord-of-the-rings-duel-for-middle-earth-review/).

Left out on purpose because they could not be confirmed: who starts chapters 2 and 3, the length of the quest
track and what each bonus space gives, individual card and Landmark costs, and the text of specific Alliance
tokens. The diagrams use generic examples for those (marked as examples on screen where it matters), and the map
is a stylised layout of the seven regions, not the board's exact shapes.

## Rebuilding

```bash
pip install kokoro-onnx soundfile numpy scipy pillow   # plus Node 22 with Playwright's Chromium, and FFmpeg
python3 voice.py        # narration (Kokoro, voice af_heart) -> build/vo/, build/timeline.json
node render.mjs         # frames -> build/frames/   (node render.mjs --stills 12,40 for single frames)
python3 audio.py        # score + SFX + voice -> build/mix_raw.wav, build/captions.srt
./encode.sh             # -> out/duel-for-middle-earth-explained.mp4
```

`voice.py` needs the Kokoro model files (`kokoro-v1.0.onnx`, `voices-v1.0.bin` from the
[kokoro-onnx releases](https://github.com/thewh1teagle/kokoro-onnx/releases)) in `$KOKORO_DIR`.

| File | Role |
|---|---|
| `script.py` | the narration, one beat per line, with the scene and step each beat drives |
| `src/app.js` | timeline engine: scenes, voice-synced timing helpers, transitions, `renderFrame(t)` |
| `src/scenes.js` | one drawing function per scene |
| `src/lib.js` | palette, paper texture, highlighter/arrow/stamp marks, cards, units, icons |
| `fonts/` | Oswald and Manrope (SIL Open Font Licence) |
