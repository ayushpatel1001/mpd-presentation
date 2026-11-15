"""Narration script for the Living Forest Duel rules explainer.

Each beat is one narration line. `scene` picks the drawing function; `new=True` starts a fresh scene of the
same type; steps are numbered automatically within a scene. Collage beats carry `items`: cropped rulebook
images (`img`), labels, arrows, highlight rings, stamps and icons, each appearing on a spoken word (`at`).

Every rule here comes from the Living Forest Duel rulebook supplied with this project (rulebook pages 2-12).
"""


def img(src, x, y, w, **o): return dict(k='img', src=src, x=x, y=y, w=w, **o)
def txt(s, x, y, **o): return dict(k='text', s=s, x=x, y=y, **o)
def stamp(s, x, y, **o): return dict(k='stamp', s=s, x=x, y=y, **o)
def arrow(x1, y1, x2, y2, **o): return dict(k='arrow', x1=x1, y1=y1, x2=x2, y2=y2, **o)
def ring(x, y, w, h, **o): return dict(k='ring', x=x, y=y, w=w, h=h, **o)
def circ(x, y, rx, ry=None, **o): return dict(k='circle', x=x, y=y, rx=rx, ry=ry or rx, **o)
def icon(name, x, y, s, **o): return dict(k='icon', name=name, x=x, y=y, s=s, **o)


# setup photo placement and helper to map rulebook-photo regions onto the screen
SX, SY, SW = 520, 150, 860          # setup.png drawn at (SX, SY), width SW
_SS = SW / 1629 * 1.5               # page-200dpi px -> screen px


def S(px, py):                       # rulebook setup-page coords (200 dpi) -> screen
    return SX + (px - 28) * _SS, SY + (py - 236) * _SS


def Sring(x1, y1, x2, y2, **o):
    a, b = S(x1, y1), S(x2, y2)
    return ring(round(a[0]), round(a[1]), round(b[0] - a[0]), round(b[1] - a[1]), **o)


BEATS = [
    # ---------------------------------------------------------------- cold open
    dict(id='o1', scene='collage', text="A fire spirit has set a forest alight.",
         items=[img('onibi_standee', 760, 230, 400, rot=-3), txt('ONIBI', 960, 760, size=72, align='center', at='fire spirit', hl=True)]),
    dict(id='o2', scene='collage',
         text="And two nature spirits, Summer and Winter, are racing to be the one who saves it.",
         items=[img('seasons', 1170, 300, 620, rot=3, at='summer'), txt('SUMMER  vs  WINTER', 1480, 820, size=60, align='center', at='winter', hl=True)]),
    dict(id='o3', scene='title',
         text="This is Living Forest Duel: a two-player game of recruiting animal spirits, planting trees and fighting fire. "
              "Here's how to play."),

    # ---------------------------------------------------------------- 01 how to win
    dict(id='w1', scene='chapter', args=dict(num='01', title='Four ways to win'),
         text="There are no points in this game."),
    dict(id='w2', scene='collage', new=True,
         text="Instead, there are four ways to win, and the first player to reach any one of them wins on the spot.",
         items=[img('goal', 110, 120, 560, rot=-2), txt('4 WAYS TO WIN', 1240, 170, size=76, align='center', hl=True, at='four ways'),
                stamp('INSTANT WIN', 1240, 270, size=54, at='on the spot')]),
    dict(id='w3', scene='collage', text="One: collect eight fire tokens.",
         items=[img('fire_tokens', 770, 330, 190, rot=-4), txt('1', 740, 400, size=64, color='ink2'),
                txt('8 FIRE TOKENS', 1000, 410, size=58, at='eight')]),
    dict(id='w4', scene='collage', text="Two: fill the recruitment line with nothing but animals of your season.",
         items=[img('season_animals', 785, 495, 160, rot=3), txt('2', 740, 600, size=64, color='ink2'),
                txt('RECRUITMENT LINE = ONLY YOUR SEASON', 1000, 610, size=44, at='nothing but')]),
    dict(id='w5', scene='collage', text="Three: plant nine protective trees in a three-by-three grid.",
         items=[img('tree', 770, 700, 200, rot=-3), txt('3', 740, 770, size=64, color='ink2'),
                txt('9 TREES IN A 3 × 3 GRID', 1000, 780, size=54, at='nine')]),
    dict(id='w6', scene='collage',
         text="And four: push the fire spirit, Onibi, all the way to your opponent while they're already holding the Onibi card.",
         items=[img('onibi_card', 790, 860, 150, rot=4), txt('4', 740, 950, size=64, color='ink2'),
                txt('ONIBI REACHES YOUR OPPONENT', 1000, 945, size=48, at='all the way'),
                txt('…while they already hold the Onibi card', 1000, 995, size=34, family='body', color='ink2', at='holding')]),
    dict(id='w7', scene='collage',
         text="Keep those four in mind, because everything you do feeds one of them.",
         items=[ring(700, 320, 1170, 700, color='yellow', at='keep')]),

    # ---------------------------------------------------------------- 02 the table
    dict(id='t1', scene='chapter', args=dict(num='02', title='The table'),
         text="Here's how the table is set up."),
    dict(id='t2', scene='collage', new=True, text="It looks busy, so let's take it row by row.",
         items=[img('setup', SX, SY, SW, frame=True)]),
    dict(id='t3', scene='collage',
         text="In the middle is the clearing: seven cards in a row. Each one shows a fire value of two, three or four, and a bonus action.",
         items=[Sring(100, 400, 1080, 520, color='yellow', at='clearing'),
                txt('THE CLEARING', 40, 470, size=52, at='clearing', hl=True),
                txt('7 cards · fire value 2–4', 40, 525, size=30, family='body', at='fire value'),
                txt('+ a bonus action each', 40, 568, size=30, family='body', at='bonus action')]),
    dict(id='t4', scene='collage',
         text="Onibi starts on the middle card, and the two cards beside it start with a fire token.",
         items=[circ(*S(597, 452), 46, at='onibi'), arrow(400, 640, S(560, 470)[0] - 20, S(560, 470)[1] + 30, at='onibi', bend=-40),
                txt('Onibi + 2 fire tokens', 40, 660, size=30, family='body', at='fire token')]),
    dict(id='t5', scene='collage',
         text="Above the clearing are four piles of protective trees.",
         items=[Sring(195, 282, 775, 362, color='yellow', at='four piles'),
                txt('4 PILES OF TREES', 1880, 230, size=46, align='right', at='protective', hl=True)]),
    dict(id='t6', scene='collage',
         text="Below it is the recruitment line: the stag in the middle, with three animals from each player's own deck on either side.",
         items=[Sring(45, 565, 1125, 695, color='yellow', at='recruitment line'),
                txt('RECRUITMENT LINE', 40, 760, size=46, at='recruitment', hl=True),
                txt('the stag + 3 animals', 40, 810, size=30, family='body', at='three animals'), txt('from each player', 40, 850, size=30, family='body', at='three animals')]),
    dict(id='t7', scene='collage',
         text="Then comes an empty space called the shared help line, which fills up during play, and the shared draw pile.",
         items=[Sring(415, 720, 1085, 860, color='yellow', at='help line'), Sring(255, 710, 400, 860, color='yellow', at='draw pile', d=0.2),
                txt('SHARED HELP LINE', 1880, 760, size=46, align='right', at='help line', hl=True),
                txt('+ shared draw pile', 1880, 810, size=30, family='body', align='right', at='draw pile')]),
    dict(id='t8', scene='collage',
         text="At the front, each player has a starting tree, which is their personal forest, and two action tokens.",
         items=[Sring(540, 860, 1070, 1110, color='yellow', at='starting tree'),
                txt('YOUR FOREST + 2 ACTION TOKENS', 960, 1030, size=44, align='center', at='starting tree', hl=True)]),
    dict(id='t9', scene='collage', new=True,
         text="Each player also gets their own deck of fifteen guardian animals in their season, and seven fire varan cards.",
         items=[img('season_animals', 230, 230, 360, rot=-3, at='fifteen'), txt('15 GUARDIAN ANIMALS', 410, 720, size=46, align='center', at='fifteen'),
                txt('your season only', 410, 770, size=32, family='body', align='center', color='ink2', at='season'),
                img('varans', 780, 230, 340, rot=3, at='fire varan'), txt('7 FIRE VARANS', 950, 720, size=46, align='center', at='fire varan'),
                txt('the cards you don’t want', 950, 770, size=32, family='body', align='center', color='ink2', at='fire varan', d=0.4)]),
    dict(id='t10', scene='collage',
         text="The shared draw pile holds eighteen common animals that belong to nobody.",
         items=[img('common_animals', 1270, 300, 560, rot=-2, at='eighteen'), txt('18 COMMON ANIMALS', 1550, 600, size=46, align='center', at='eighteen'),
                txt('belong to nobody', 1550, 650, size=32, family='body', align='center', color='ink2', at='nobody')]),
    dict(id='t11', scene='collage',
         text="Before you start, if your three cards in the recruitment line cost twelve or less in total, "
              "swap the cheapest one for a new card, until the total is more than twelve.",
         items=[txt('3 + 4 + 5 = 12', 960, 900, size=64, align='center', at='twelve or less'),
                txt('too cheap → swap the cheapest', 960, 965, size=40, family='body', align='center', color='red', at='swap'),
                txt('until the total is more than 12', 960, 1020, size=34, family='body', align='center', color='ink2', at='until')]),
    dict(id='t12', scene='collage', new=True,
         text="Summer and Winter play exactly the same way. The only difference is which cards are yours.",
         items=[img('seasons', 610, 260, 700, rot=-2), stamp('SAME RULES', 960, 860, size=64, at='same way', color='ink')]),

    # ---------------------------------------------------------------- 03 anatomy
    dict(id='a1', scene='chapter', args=dict(num='03', title='Reading a card'),
         text="Everything runs on guardian animal cards, so let's read one."),
    dict(id='a2', scene='anatomy', text="Down the left side are elements. There are four of them, and each one powers an action."),
    dict(id='a3', scene='anatomy',
         text="Sun recruits animals. Water puts out fire. Sprouts plant trees. And spirals move Onibi."),
    dict(id='a4', scene='anatomy',
         text="At the top, some animals show a symbol. A black one means the animal is solitary. "
              "A white one means it's gregarious. No symbol means it's neutral."),
    dict(id='a5', scene='anatomy', text="At the bottom is the season symbol, and, on animals you can recruit, a cost."),

    # ---------------------------------------------------------------- 04 the round
    dict(id='r1', scene='chapter', args=dict(num='04', title='A round'),
         text="Now, how a round works."),
    dict(id='r2', scene='lines',
         text="Each player has two action tokens. Summer goes first, and in later rounds, whoever didn't play last goes first."),
    dict(id='r3', scene='lines',
         text="On your go, you do one of two things: reveal the top card of the shared draw pile, or spend an action token."),
    dict(id='r4', scene='lines',
         text="Revealing doesn't use up a token, so you can keep revealing, card after card."),
    dict(id='r5', scene='lines',
         text="A common animal or the stag goes into the shared help line, where both players can use it."),
    dict(id='r6', scene='lines',
         text="An animal or fire varan of your season goes into your personal line, and only you can use it. "
              "One of your opponent's season goes into theirs."),
    dict(id='r7', scene='solitary',
         text="But there's a catch. Every solitary symbol you can see counts against you: the ones in the help line, plus your own line."),
    dict(id='r8', scene='solitary',
         text="The moment you can see a third one, you lose one of your unused action tokens. A fourth costs you another."),
    dict(id='r9', scene='solitary',
         text="Each gregarious symbol cancels one solitary symbol. So the same reveal can cost one player a token, and not the other."),
    dict(id='r10', scene='solitary',
         text="Players take turns like this until both have used up their tokens. That ends the round."),

    # ---------------------------------------------------------------- 05 spending a token
    dict(id='k1', scene='chapter', args=dict(num='05', title='Spending a token'),
         text="Spending a token is the clever part of the game."),
    dict(id='k2', scene='count',
         text="You place it so it points at the last element of one type in the help line. Let's say, the last water drop."),
    dict(id='k3', scene='count',
         text="Count every water drop from the start of the line up to your token. That total is the strength of your action."),
    dict(id='k4', scene='count',
         text="Those drops are now used up, for both players, for the rest of the round."),
    dict(id='k5', scene='count',
         text="Then add the water in your own personal line and on your trees. Those are only yours, and you can count them again later."),
    dict(id='k6', scene='count',
         text="If a token already points at water, the next count starts after it. "
              "And to do the same action twice, you need at least one fresh drop between your two tokens."),
    dict(id='k7', scene='count',
         text="So the help line is a shared well, and every action you take drains it for your opponent."),

    # ---------------------------------------------------------------- 06 the actions
    dict(id='x1', scene='chapter', args=dict(num='06', title='The four actions'),
         text="Here's what each element lets you do."),
    dict(id='x2', scene='collage', new=True,
         text="Water puts out fire. Take fire tokens off the clearing, with a total value up to your water.",
         items=[icon('water', 170, 180, 60), txt('PUT OUT FIRE', 260, 200, size=64, at='puts out', hl=True),
                img('clearing', 130, 330, 1660, at='clearing'),
                txt('fire tokens worth up to your water', 260, 260, size=36, family='body', color='ink2', at='total value')]),
    dict(id='x3', scene='collage',
         text="Each token is worth the fire value of the card it sits on. So with five water, you could take a three and a two. "
              "Collect eight tokens, and you win.",
         items=[arrow(560, 650, 470, 390, at='fire value', color='red'), txt('token value = the card’s fire value', 600, 690, size=38, family='body', at='fire value'),
                txt('5 water  →  3 + 2', 600, 790, size=60, at='five water', hl=True), stamp('8 TOKENS = WIN', 1450, 860, size=56, at='eight tokens')]),
    dict(id='x4', scene='collage', new=True,
         text="Sun recruits animals. Take cards from the recruitment line with a total cost up to your sun.",
         items=[icon('sun', 170, 180, 60), txt('RECRUIT ANIMALS', 260, 200, size=64, at='recruits', hl=True),
                txt('total cost up to your sun', 260, 260, size=36, family='body', color='ink2', at='total cost'),
                img('recruit_example', 330, 330, 1260, at='recruitment line')]),
    dict(id='x5', scene='collage',
         text="An animal of your season goes into your personal line. Anything else, including the stag, goes to the discard pile.",
         items=[txt('your season → your personal line', 330, 920, size=40, family='body', at='your season'),
                txt('anything else → discard pile', 330, 975, size=40, family='body', color='ink2', at='anything else')]),
    dict(id='x6', scene='refill',
         text="Then you refill the gaps from your own personal deck. So every time you recruit your opponent's animals, you replace them with yours."),
    dict(id='x7', scene='refill',
         text="Fill the line with only your season, and you win. The stag is neutral, so it has to be recruited too."),
    dict(id='x8', scene='collage', new=True,
         text="Sprouts plant protective trees. Take one to four trees from the tops of different piles, "
              "with a total cost up to your sprouts, and plant them straight away.",
         items=[icon('plant', 170, 180, 60), txt('PLANT TREES', 260, 200, size=64, at='plant', hl=True),
                txt('1 to 4 trees · each from a different pile · total cost up to your sprouts', 260, 260, size=34, family='body', color='ink2', at='one to four'),
                img('tree', 560, 360, 800, at='protective'),
                arrow(1415, 470, 1245, 515, at='total cost', color='red', bend=-30), txt('COST', 1420, 485, size=48, at='total cost', color='red'),
                arrow(440, 330, 595, 390, at='trees from', color='ink'), txt('ELEMENT', 250, 330, size=48, at='trees from'),
                arrow(440, 770, 735, 560, at='straight away', color='ink', bend=20), txt('BONUS ACTION', 120, 800, size=48, at='straight away')]),
    dict(id='x9', scene='collage', new=True,
         text="And spirals move Onibi. We'll come back to that in a moment.",
         items=[icon('spiral', 170, 180, 60), txt('MOVE ONIBI', 260, 200, size=64, at='spirals', hl=True),
                img('onibi_standee', 820, 330, 300, rot=-3, at='onibi')]),

    # ---------------------------------------------------------------- 07 your forest
    dict(id='f1', scene='chapter', args=dict(num='07', title='Your forest'),
         text="Trees go into your personal forest, and they follow a few rules."),
    dict(id='f2', scene='forest',
         text="Every tree card has a river on it. You must always be able to trace that river back to the lake on your starting tree."),
    dict(id='f3', scene='forest',
         text="Trees always stand upright. And you can cover an old tree with a new one, but never your starting tree."),
    dict(id='f4', scene='forest',
         text="Plant a tree next to one with the same bonus action, and you trigger that bonus right away."),
    dict(id='f5', scene='forest',
         text="Best of all, a tree's elements count towards every action you take, every round. "
              "And nine trees in a three-by-three grid wins the game."),
    dict(id='f6', scene='collage', new=True,
         text="Here's what a growing forest looks like in the rulebook.",
         items=[img('forest', 460, 180, 1000, rot=-1)]),

    # ---------------------------------------------------------------- 08 onibi
    dict(id='n1', scene='chapter', args=dict(num='08', title='Onibi'),
         text="Now, Onibi."),
    dict(id='n2', scene='onibi',
         text="Spirals move the fire spirit toward your opponent, up to one card per spiral."),
    dict(id='n3', scene='onibi', text="Wherever it lands, you get that card's bonus action."),
    dict(id='n4', scene='onibi', text="When Onibi runs off the end of the clearing, one of three things happens."),
    dict(id='n5', scene='onibi',
         text="If the Onibi card is still in the supply, your opponent takes it, and Onibi carries on from the far end."),
    dict(id='n6', scene='onibi', text="If you're the one holding the Onibi card, you put it back, and Onibi carries on."),
    dict(id='n7', scene='onibi', text="And if your opponent is already holding it, you win."),
    dict(id='n8', scene='collage', new=True,
         text="Holding the Onibi card hurts, too. Any animal of your season that's revealed goes into the shared help line instead of your personal line.",
         items=[img('onibi_card', 200, 230, 380, rot=-4), txt('THE ONIBI CARD', 690, 330, size=64, at='holding', hl=True),
                txt('your season’s animals → the shared help line', 690, 410, size=40, family='body', at='any animal'),
                txt('(fire varans still go to your line)', 690, 465, size=34, family='body', color='ink2', at='instead')]),
    dict(id='n9', scene='collage',
         text="Some bonus actions give you a Sanki card. Spend it to send a fire varan of your season back as soon as it's revealed, "
              "or to use an action token straight after a reveal.",
         items=[img('sanki', 210, 640, 220, rot=3, at='sanki'), txt('SANKI CARDS', 690, 700, size=60, at='sanki', hl=True),
                txt('send back one of your fire varans as it’s revealed', 690, 775, size=38, family='body', at='send a fire'),
                txt('or use an action token straight after a reveal', 690, 830, size=38, family='body', at='use an action')]),

    # ---------------------------------------------------------------- 09 end of the round
    dict(id='e1', scene='chapter', args=dict(num='09', title='End of the round'),
         text="When both players are out of tokens, the fire fights back."),
    dict(id='e2', scene='fire',
         text="Add up the fire values of every clearing card with Onibi or a fire token on it."),
    dict(id='e3', scene='fire',
         text="Each player compares that with their own water: their personal line, their forest, and whatever is left in the help line."),
    dict(id='e4', scene='fire',
         text="If the fire is strictly higher, you add one fire varan of your season to the discard pile for every burning card. "
              "When the discard pile is shuffled back in, those varans return to haunt you."),
    dict(id='e5', scene='fire',
         text="Then the fire spreads. Each card next to Onibi gets a fire token, if it doesn't have one. At the edge, it spreads to the far end instead."),
    dict(id='e6', scene='fire',
         text="Finally, everyone takes back their tokens, and both personal lines and the help line go to the discard pile. Then the next round begins."),

    # ---------------------------------------------------------------- 10 wrap-up
    dict(id='z1', scene='chapter', args=dict(num='10', title='Putting it together'),
         text="So what makes Living Forest Duel tick?"),
    dict(id='z2', scene='wrap', text="Every reveal is a gamble. More cards mean more elements, but also more solitary symbols."),
    dict(id='z3', scene='wrap', text="Every action drains the shared help line, so taking what you need takes it away from your opponent."),
    dict(id='z4', scene='wrap',
         text="And the four ways to win pull you in different directions: fight the fire, flood the recruitment line, "
              "grow your forest, or chase your rival with Onibi."),
    dict(id='z5', scene='outro', text="Watch your opponent, pick your moment, and save the forest first."),
]

# number the steps inside each scene
_prev, _step = None, 0
for _b in BEATS:
    if _b['scene'] == 'chapter' or _b['scene'] != _prev or _b.get('new'):
        _step = 0
    else:
        _step += 1
    _b['step'] = _step
    _prev = _b['scene']
