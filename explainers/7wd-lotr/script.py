"""Narration script for the Duel for Middle-earth explainer.

Every line is one beat: `text` is what the narrator says (and what the captions file shows), `say`
is an optional phonetic spelling for the TTS, and `scene`/`step` tell the renderer what to draw.
A scene stays on screen for consecutive beats; `step` advances its state on each beat.

Rules sources are listed in README.md. Details that could not be confirmed from the rulebook
(who starts chapters 2 and 3, exact quest-track length, individual card costs) are deliberately
left out of the narration.
"""

BEATS = [
    # ---------------------------------------------------------------- cold open
    dict(id='open1', scene='pyramid', step=0,
         text="If you've played 7 Wonders Duel, you already know most of this game."),
    dict(id='open2', scene='pyramid', step=1,
         text="You still draft from a pyramid of overlapping cards. You still play three rounds. "
              "And you can still win suddenly, before the last card is gone."),
    dict(id='open3', scene='pyramid', step=2,
         text="But in 2024, designers Antoine Bauza and Bruno Cathala took that engine to Middle-earth, "
              "and changed what you're actually fighting over.",
         say="But in twenty twenty-four, designers Antwan Bo-zah and Bruno Ka-tah-lah took that engine to Middle-earth, "
             "and changed what you're actually fighting over."),
    dict(id='open4', scene='title', step=0,
         text="This is The Lord of the Rings: Duel for Middle-earth. "
              "And to understand it, the best place to start is with what it took away."),

    # ---------------------------------------------------------------- 01 no points
    dict(id='pts1', scene='chapter', step=0, args=dict(num='01', title='No more points'),
         text="In 7 Wonders Duel, most games end at a scoreboard."),
    dict(id='pts2', scene='score', step=0,
         text="You add up your blue cards, your wonders, your guilds and your coins, and the highest total wins."),
    dict(id='pts3', scene='score', step=1,
         text="Duel for Middle-earth has no victory points at all."),
    dict(id='pts4', scene='three', step=0,
         text="Every way to win is a race. There are three of them, and each one ends the game "
              "the instant someone gets there."),
    dict(id='pts5', scene='three', step=1,
         text="That one change ripples through everything else. So let's build the game up, piece by piece."),

    # ---------------------------------------------------------------- 02 two sides
    dict(id='side1', scene='chapter', step=0, args=dict(num='02', title='Two sides'),
         text="First, the players aren't mirror images."),
    dict(id='side2', scene='sides', step=0,
         text="One of you plays the Fellowship. The other plays Sauron."),
    dict(id='side3', scene='sides', step=1,
         text="Sauron takes the first turn. To balance that, the Fellowship starts with three coins, and Sauron with two."),
    dict(id='side4', scene='sides', step=2,
         text="Both sides draft from the same cards. The difference is in what the Ring does for each of you, "
              "and we'll get to that."),

    # ---------------------------------------------------------------- 03 the turn
    dict(id='turn1', scene='chapter', step=0, args=dict(num='03', title='The turn'),
         text="The turn will feel familiar."),
    dict(id='turn2', scene='pyramid', step=3,
         text="Each chapter, the cards are laid out in a structure, "
              "and you can only take a card that nothing else is covering."),
    dict(id='turn3', scene='turn', step=0,
         text="On your turn, you have three options."),
    dict(id='turn4', scene='turn', step=1,
         text="You can take a card and play it, paying its cost."),
    dict(id='turn5', scene='turn', step=2,
         text="You can take a card and discard it for coins: one coin in chapter one, two in chapter two, "
              "and three in chapter three."),
    dict(id='turn6', scene='turn', step=3,
         text="Or you can leave the cards alone and take a Landmark instead. "
              "That's this game's version of a wonder, and it's one of the biggest changes. So, hold that thought."),

    # ---------------------------------------------------------------- 04 skills
    dict(id='sk1', scene='chapter', step=0, args=dict(num='04', title='Skills, not resources'),
         text="Now, the cost."),
    dict(id='sk2', scene='skills', step=0,
         text="In 7 Wonders Duel, cards cost resources: wood, clay, stone, glass and papyrus."),
    dict(id='sk3', scene='skills', step=1,
         text="Here, the brown and grey cards collapse into a single grey colour, and they give you skills instead."),
    dict(id='sk4', scene='skills', step=2,
         text="There are five: Ruse, Strength, Courage, Knowledge and Leadership.",
         say="There are five: Ruse. Strength. Courage. Knowledge. And Leadership."),
    dict(id='sk5', scene='price', step=0,
         text="And here's the part that will change your habits. If you're missing a skill, you pay one coin for it."),
    dict(id='sk6', scene='price', step=1,
         text="In 7 Wonders Duel, a missing resource cost two coins, plus one more for every copy your opponent produced. "
              "That's what made hate-drafting brown cards so strong."),
    dict(id='sk7', scene='price', step=2,
         text="Here the price is flat. One coin per missing skill, no matter what your opponent has built."),
    dict(id='sk8', scene='price', step=3,
         text="So grey cards are about making your own turns cheaper, not about squeezing the other player. "
              "And coins are simple: yellow cards hand them to you straight away."),

    # ---------------------------------------------------------------- 05 colours
    dict(id='col1', scene='chapter', step=0, args=dict(num='05', title='The colour map'),
         text="Here's the full colour map, next to the game you know."),
    dict(id='col2', scene='colours', step=0,
         text="Grey is skills. Yellow is coins."),
    dict(id='col3', scene='colours', step=1,
         text="Blue cards no longer give points. They move you along the Quest of the Ring."),
    dict(id='col4', scene='colours', step=2,
         text="Green still means collecting symbols, but now they're the races of Middle-earth."),
    dict(id='col5', scene='colours', step=3,
         text="Red cards no longer push a conflict pawn. They put armies on a map."),
    dict(id='col6', scene='colours', step=4,
         text="And purple cards, like the guilds, only show up in the final chapter. "
              "They let you move your units, make your opponent lose coins, or remove an enemy unit."),
    dict(id='col7', scene='chain', step=0,
         text="Chaining is back, too. From chapter two on, if you already have a card with a matching chain symbol, "
              "you can play the new card for free."),

    # ---------------------------------------------------------------- 06 the quest
    dict(id='q1', scene='chapter', step=0, args=dict(num='06', title='Win #1: the Quest'),
         text="Now, the three ways to win. The first is the story itself: the Quest of the Ring."),
    dict(id='q2', scene='quest', step=0,
         text="Above the cards runs a track toward Mount Doom. On it are two pieces: "
              "Frodo and Sam, and the Nazgûl chasing them.",
         say="Above the cards runs a track toward Mount Doom. On it are two pieces: "
             "Frodo and Sam, and the Nazgool chasing them."),
    dict(id='q3', scene='quest', step=1,
         text="Blue cards carry Ring symbols, and each symbol moves your piece one space."),
    dict(id='q4', scene='quest', step=2,
         text="When the Fellowship plays them, Frodo and Sam head for Mount Doom. "
              "If they get there, the Fellowship wins on the spot."),
    dict(id='q5', scene='quest', step=3,
         text="When Sauron plays them, the Nazgûl move instead, closing in. "
              "If they catch Frodo and Sam, Sauron takes the Ring, and wins.",
         say="When Sauron plays them, the Nazgool move instead, closing in. "
             "If they catch Frodo and Sam, Sauron takes the Ring, and wins."),
    dict(id='q6', scene='quest', step=4,
         text="And here's the clever part. The Nazgûl ride on top of the hobbits' piece. "
              "So whenever Frodo and Sam move, the Nazgûl come with them.",
         say="And here's the clever part. The Nazgool ride on top of the hobbits' piece. "
             "So whenever Frodo and Sam move, the Nazgool come with them."),
    dict(id='q7', scene='quest', step=5,
         text="The Fellowship can never pull away. The gap only ever shrinks. "
              "It's a race for one player, and a hunt for the other, on the same track."),
    dict(id='q8', scene='quest', step=6,
         text="Some spaces along the way also hold a one-time bonus, which you take the moment you reach or pass it."),

    # ---------------------------------------------------------------- 07 the races
    dict(id='r1', scene='chapter', step=0, args=dict(num='07', title='Win #2: the Races'),
         text="The second way to win will feel like home to science players."),
    dict(id='r2', scene='races', step=0,
         text="In 7 Wonders Duel, six different science symbols win you the game."),
    dict(id='r3', scene='races', step=1,
         text="Here, green cards carry the symbols of six races: "
              "Elves, Dwarves, Hobbits, Humans, Ents and Wizards."),
    dict(id='r4', scene='races', step=2,
         text="Gather all six different races, and you win by the Support of the Races."),
    dict(id='r5', scene='alliance', step=0,
         text="Pairs still matter, too. In the original, a matching pair of science symbols earned you a progress token."),
    dict(id='r6', scene='alliance', step=1,
         text="Here, the moment you have two matching race symbols, you reveal the top two Alliance tokens of that race. "
              "You keep one, and put the other back."),
    dict(id='r7', scene='alliance', step=2,
         text="Most Alliance tokens give a lasting ability, so every pair is an engine piece, "
              "as well as a step toward victory."),
    dict(id='r8', scene='alliance', step=3,
         text="There's also a once-per-game bonus. When you first hold three different races, "
              "you reveal the top token of each of those three races, and keep one."),
    dict(id='r9', scene='alliance', step=4,
         text="And watch out for the Eagle. It appears on one Alliance token, "
              "and it counts as one of the six symbols you need."),

    # ---------------------------------------------------------------- 08 the map
    dict(id='m1', scene='chapter', step=0, args=dict(num='08', title='Win #3: Conquest'),
         text="The third way to win replaces the military track with something much bigger: a map of Middle-earth."),
    dict(id='m2', scene='map', step=0,
         text="It has seven regions: Lindon, Arnor, Rhovanion, Enedwaith, Rohan, Gondor and Mordor.",
         say="It has seven regions: Lindon. Arnor. Rhovanion. Enedwaith. Rohan. Gondor. And Mordor."),
    dict(id='m3', scene='map', step=1,
         text="The Fellowship starts with two units in Arnor. Sauron starts with two in Mordor."),
    dict(id='m4', scene='map', step=2,
         text="When you play a red card, you pick one of the two regions on its banners, "
              "and place all of its units there."),
    dict(id='m5', scene='map', step=3,
         text="If enemy units are already there, a conflict breaks out. It's simple: each player removes one of their units, "
              "and you repeat until one side has none left in that region."),
    dict(id='m6', scene='map', step=4,
         text="So numbers matter. Arrive with three units against two, and you hold the region with one left standing."),
    dict(id='m7', scene='map', step=5,
         text="You're present in a region if you have at least one unit or a fortress there. "
              "Be present in all seven at once, and you've conquered Middle-earth."),
    dict(id='m8', scene='map', step=6,
         text="It's the military victory, stretched across a whole map. "
              "Instead of pushing one pawn, you're keeping seven plates spinning."),

    # ---------------------------------------------------------------- 09 landmarks
    dict(id='l1', scene='chapter', step=0, args=dict(num='09', title='Landmarks'),
         text="Which brings us back to Landmarks, this game's wonders."),
    dict(id='l2', scene='landmarks', step=0,
         text="There are seven, one for each region, and three of them are face up at a time."),
    dict(id='l3', scene='landmarks', step=1,
         text="Instead of taking a card, you can spend your turn on one. Each has a coin cost, "
              "plus one extra coin for every fortress you already have on the board."),
    dict(id='l4', scene='landmarks', step=2,
         text="When you build it, you place a fortress in its region. Conflicts only remove units, "
              "so a fortress is a foothold your opponent can't win back by fighting."),
    dict(id='l5', scene='landmarks', step=3,
         text="Every Landmark also has a one-time effect. Helm's Deep adds three units in Rohan. "
              "Minas Tirith adds a unit in Gondor and moves you two spaces on the quest. "
              "And Barad-dûr lets you search the discard pile and play a card from it for free.",
         say="Every Landmark also has a one-time effect. Helm's Deep adds three units in Rohan. "
             "Minas Tirith adds a unit in Gondor and moves you two spaces on the quest. "
             "And Barad-door lets you search the discard pile and play a card from it for free."),
    dict(id='l6', scene='landmarks', step=4,
         text="So a Landmark is a fortress, a bonus, and sometimes a step on another front, all in one turn."),

    # ---------------------------------------------------------------- 10 end of game
    dict(id='e1', scene='chapter', step=0, args=dict(num='10', title='If nobody wins'),
         text="If nobody has won by the end of chapter three, there's still no scoring."),
    dict(id='e2', scene='endgame', step=0,
         text="Instead, you count regions. Whoever is present in the most regions of Middle-earth wins."),
    dict(id='e3', scene='endgame', step=1,
         text="And if you're tied, you share the victory."),

    # ---------------------------------------------------------------- 11 why it matters
    dict(id='w1', scene='chapter', step=0, args=dict(num='11', title='Why it plays differently'),
         text="So what does all of this add up to?"),
    dict(id='w2', scene='fronts', step=0,
         text="In 7 Wonders Duel, you could quietly build points for most of the game, "
              "and the sudden wins were threats you mostly defended against."),
    dict(id='w3', scene='fronts', step=1,
         text="Here, there are only sudden wins. Every card you take either pushes you toward one of three finish lines, "
              "or keeps your opponent away from theirs."),
    dict(id='w4', scene='fronts', step=2,
         text="And the fronts feed each other. Landmarks put fortresses on the map, and can push the quest. "
              "Quest spaces hand out bonuses. Races unlock alliances that bend the rules."),
    dict(id='w5', scene='fronts', step=3,
         text="So the real skill is reading three races at once, and knowing which one your opponent is about to win."),
    dict(id='w6', scene='outro', step=0,
         text="Same pyramid of cards you know. A completely different game sitting on top of it."),
]
