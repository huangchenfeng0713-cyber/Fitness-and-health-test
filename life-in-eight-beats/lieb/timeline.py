"""The single source of truth.

Every time value used by the picture (key poses, costume puffs, camera moves,
onomatopoeia) and by the sound (counts, drums, sound effects, music sections)
is derived from the Timeline built here.  Nothing else in the project is
allowed to invent a time in seconds: it asks a segment for `seg.t(beat)` or
looks up a cue.
"""
from dataclasses import dataclass, field

FPS = 30
W, H = 1920, 1080

PRE_ROLL = 0.5          # s of mat-and-music-box before the first count
STOP_SILENCE = 0.6      # S9 -> S10: everything stops dead for this long
LAST_COUNT_LEN = 0.5    # the old man's drawn-out "七……" is cut to this length
FINAL_SILENCE = 1.75      # "七……" (0.5 s) dies away, then ~1.5 s of true silence before "八！"
MORPH_LEN = 0.35        # old man -> baby morph, then the kick + "八！"
END_HOLD = 0.9          # baby holds the pose after "八！"
TITLE_LEN = 3.0         # black card with the title

DIGITS = '一二三四五六七八'


@dataclass
class Cue:
    t: float
    kind: str                 # count | sfx | puff | text | voice | mark
    name: str
    seg: str = ''
    beat: float = 0.0
    data: dict = field(default_factory=dict)


@dataclass
class Seg:
    key: str                  # S1..S10
    stage: str                # costume / scene id of this life stage
    title: str
    bpm: float
    beats: list               # absolute time of every beat, plus the end time as the last entry
    voice: str                # count voice
    music: str
    fast: tuple = ()          # (b_from, b_to) beats that are played at double speed
    rest: tuple = ()          # (b, length_s): a silent gap inserted *before* beat b

    @property
    def t0(self):
        return self.beats[0]

    @property
    def t1(self):
        return self.beats[-1]

    @property
    def n(self):
        return len(self.beats) - 1

    @property
    def spb(self):
        return 60.0 / self.bpm

    def t(self, b):
        """Time of (fractional) beat b of this segment."""
        n = self.n
        if b <= 0:
            return self.beats[0] + b * (self.beats[1] - self.beats[0])
        if b >= n:
            return self.beats[n] + (b - n) * (self.beats[n] - self.beats[n - 1])
        i = int(b)
        f = b - i
        a, c = self.beats[i], self.beats[i + 1]
        if self.rest and i + 1 == self.rest[0]:
            # the beat just before the rest keeps its own length; the rest is not part of it
            c = c - self.rest[1]
        return a + f * (c - a)

    def beat_at(self, t):
        """Inverse of t(): fractional beat of absolute time t (rests map to the end of the previous beat)."""
        if t <= self.beats[0]:
            return (t - self.beats[0]) / (self.beats[1] - self.beats[0])
        for i in range(self.n):
            a, c = self.beats[i], self.beats[i + 1]
            if t < c:
                if self.rest and i + 1 == self.rest[0]:
                    c2 = c - self.rest[1]
                    if t >= c2:
                        return float(i + 1) - 1e-6
                    return i + (t - a) / (c2 - a)
                return i + (t - a) / (c - a)
        n = self.n
        return n + (t - self.beats[n]) / (self.beats[n] - self.beats[n - 1])

    def beat_len(self, b):
        i = int(min(max(b, 0), self.n - 1))
        L = self.beats[i + 1] - self.beats[i]
        if self.rest and i + 1 == self.rest[0]:
            L -= self.rest[1]
        return L

    def count_text(self, b):
        """“一二三四，五六七八”; from the second eight on the first word is the eight's number."""
        b = int(round(b))
        e, k = divmod(b, 8)
        if k == 0 and e > 0:
            return DIGITS[e]
        return DIGITS[k]


def _even(t0, bpm, n):
    spb = 60.0 / bpm
    return [t0 + i * spb for i in range(n + 1)]


class Timeline:
    def __init__(self):
        self.segs = []
        self.cues = []
        t = PRE_ROLL

        def add(key, stage, title, bpm, n, voice, music, **kw):
            nonlocal t
            s = Seg(key, stage, title, bpm, _even(t, bpm, n), voice, music, **kw)
            self.segs.append(s)
            t = s.t1
            return s

        S1 = add('S1', 'baby', '婴儿', 100, 16, 'baby', 'musicbox')
        S2 = add('S2', 'kid', '幼儿园', 110, 16, 'kid', 'toypiano')
        S3 = add('S3', 'school', '小学', 120, 24, 'broadcast', 'march')
        S4 = add('S4', 'army', '军训', 120, 8, 'instructor', 'snare')
        S5 = add('S5', 'teen', '青春期', 128, 16, 'dj', 'edm')
        S6 = add('S6', 'office', '打工人', 100, 16, 'office', 'lofi')
        S7 = add('S7', 'plaza', '中年', 132, 16, 'auntie', 'plaza')

        # S8: 66 BPM tai chi.  Beats 8-11 are the "fast-forward" half-eight at 2x
        # (132 BPM, music sped up an octave); then the tape stops, the old man
        # coughs during one silent slow beat, and the second half of the eight
        # resumes at 66 as if nothing happened.
        slow = 60.0 / 66
        fast = slow / 2
        b8 = [t + i * slow for i in range(9)]                       # beats 0..8
        b8 += [b8[-1] + i * fast for i in range(1, 4)]              # beats 9..11 (fast)
        rest_len = slow
        t12 = b8[-1] + fast + rest_len                              # beat 12, after the rest
        b8 += [t12 + i * slow for i in range(5)]                    # beats 12..16 (16 = end)
        S8 = Seg('S8', 'old', '老年', 66, b8, 'oldman', 'guzheng', fast=(8, 12), rest=(12, rest_len))
        self.segs.append(S8)
        t = S8.t1

        S9 = add('S9', 'flash', '走马灯', 140, 8, 'flash', 'collage')

        # S10: everything stops dead, then the slow count 一……七…… while he lies down.
        t += STOP_SILENCE
        b10 = _even(t, 66, 7)                                       # beats 0..7 (7 = where 八 should be)
        S10 = Seg('S10', 'end', '结尾', 66, b10, 'oldman', 'none')
        self.segs.append(S10)
        self.t_stop = S9.t1
        self.t_seven_end = S10.t(6) + LAST_COUNT_LEN
        self.t_morph = self.t_seven_end + FINAL_SILENCE
        self.t_eight = self.t_morph + MORPH_LEN
        self.t_black = self.t_eight + END_HOLD
        self.duration = self.t_black + TITLE_LEN

        self.S = {s.key: s for s in self.segs}
        self._build_cues()

    # ------------------------------------------------------------------ cues
    def cue(self, kind, name, seg, beat, **data):
        s = self.S[seg]
        c = Cue(s.t(beat), kind, name, seg, beat, data)
        self.cues.append(c)
        return c

    def cue_t(self, kind, name, t, **data):
        c = Cue(t, kind, name, '', 0.0, data)
        self.cues.append(c)
        return c

    def _build_cues(self):
        S = self.S
        # ---- counts: one word per beat, onset exactly on the beat
        for s in self.segs:
            if s.key in ('S9', 'S10'):
                continue
            for b in range(s.n):
                voice = s.voice
                if s.fast and s.fast[0] <= b < s.fast[1]:
                    voice = 'oldman_fast'
                self.cue('count', s.count_text(b), s.key, b, voice=voice)
        flash_voices = ['baby', 'kid', 'broadcast', 'instructor', 'dj', 'office', 'auntie', 'oldman']
        for b in range(8):
            self.cue('count', S['S9'].count_text(b), 'S9', b, voice=flash_voices[b])
        for b in range(7):
            self.cue('count', S['S10'].count_text(b), 'S10', b, voice='oldman_slow',
                     cut=(LAST_COUNT_LEN if b == 6 else None))
        self.cue_t('count', '八', self.t_eight, voice='baby_final')

        # ---- costume changes, each on a strong beat with a "噗" puff
        for key, costume in [('S2', 'kid'), ('S3', 'school'), ('S4', 'army'), ('S5', 'teen'),
                             ('S6', 'office'), ('S7', 'plaza'), ('S8', 'old')]:
            self.cue('puff', costume, key, 0)
        flash = ['baby', 'kid', 'school', 'army', 'teen', 'office', 'plaza', 'old']
        for b, st in enumerate(flash):
            self.cue('puff', st, 'S9', b, small=True)
        self.cue_t('puff', 'baby', self.t_morph, small=True, quiet=True)

        # ---- sound effects / gags (beats are the authority; choreography reads these)
        c = self.cue
        c('voice', '咿', 'S1', -0.6, voice='baby')
        c('voice', '呀', 'S1', 5.5, voice='baby')
        c('voice', '咿', 'S1', 11.5, voice='baby')
        c('sfx', 'plop', 'S1', 6)                 # sits down on the mat
        c('sfx', 'boing', 'S1', 10)               # wobbly stand
        for b in (0, 1, 2, 3):
            c('sfx', 'clap', 'S2', b)
        for b in (4, 5, 6, 7):
            c('sfx', 'twinkle', 'S2', b)
        c('sfx', 'spin', 'S2', 8)
        c('sfx', 'tweet', 'S2', 12)
        c('sfx', 'whistle', 'S2', 14, short=True)
        c('text', '哔！', 'S2', 14, pos='right')
        for b in (16, 17, 18, 19, 20, 21, 22, 23):
            c('sfx', 'stomp', 'S3', b, soft=True)
        c('sfx', 'snore', 'S4', 1.5)
        c('sfx', 'snore', 'S4', 3.0)
        c('sfx', 'whistle', 'S4', 4, short=False)
        c('text', '哔——！', 'S4', 4, pos='right')
        c('mark', 'shake', 'S4', 4)
        for b in (5, 6, 7):
            c('sfx', 'stomp', 'S4', b)
        for b in (0, 1, 1.5, 2, 3, 3.25, 3.5, 4, 5):     # robot hits: always audible, always on the grid
            c('sfx', 'servo', 'S5', b)
        c('sfx', 'scratch', 'S5', 6)
        c('sfx', 'glide', 'S5', 10)
        c('mark', 'tapestop', 'S5', 14)          # music and hands slow down together
        c('sfx', 'slide', 'S5', 14.5)            # keyboard + desk slide in
        c('sfx', 'keys', 'S6', 0)
        for b in (2, 3, 4, 4.5):
            c('sfx', 'crack', 'S6', b)
            c('text', '咔', 'S6', b, pos='neck')
        c('voice', '唉', 'S6', 6.5, voice='office')
        c('sfx', 'chair', 'S6', 8.5)
        c('sfx', 'pa', 'S7', 0)
        c('text', '啪！', 'S7', 0, pos='hands')
        c('sfx', 'whoosh', 'S7', 12)
        c('sfx', 'tsk', 'S8', 1.5)
        for b, w in zip((8, 9, 10, 11), ('嘿', '哈', '嘿', '哈')):
            c('voice', w, 'S8', b, voice='kungfu')
            c('sfx', 'whoosh', 'S8', b - 0.25, fast=True)
            c('text', w + '！', 'S8', b, pos='hands')
        self.t_cough = S['S8'].t(12) - 0.62 * S['S8'].rest[1]
        self.cue_t('sfx', 'cough', self.t_cough)
        self.cue_t('text', '咳', self.t_cough, pos='head')
        c('sfx', 'wind', 'S8', 13.5)
        self.cue_t('mark', 'stop', self.t_stop)
        self.cue_t('mark', 'title', self.t_black)
        self.cues.sort(key=lambda q: q.t)

    # --------------------------------------------------------------- lookups
    def seg_at(self, t):
        for s in self.segs:
            if t < s.t1:
                return s
        return self.segs[-1]

    def find(self, kind, name=None, seg=None):
        return [q for q in self.cues if q.kind == kind and (name is None or q.name == name)
                and (seg is None or q.seg == seg)]

    def beat_info(self, t):
        """(segment, fractional beat) of the segment whose grid governs time t."""
        s = self.seg_at(t)
        return s, s.beat_at(t)

    def table(self):
        rows = []
        for s in self.segs:
            rows.append((s.key, s.title, s.bpm, s.n, s.t0, s.t1, s.t1 - s.t0))
        return rows


TL = Timeline()
