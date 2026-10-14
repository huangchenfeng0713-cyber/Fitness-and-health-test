"""On-screen text, locked to the 120 BPM grid (bar(b) = 0.122 + 2b seconds).

Each cue: (start, end, kind, payload). Reading budget: <= ~3.5 chars/s for
main lines; quotes and notes are short and sit beside the main line.
"""
from .core import bar

B = bar

# kind: 'main'  -> lines (list), centered, lower third unless pos given
#       'title' -> big title
#       'quote' -> vertical classical quote, payload (text, source, side)
#       'note'  -> small knowledge note under the main line
CUES = [
    # ── 序 · 寻常 ───────────────────────────────────────────────
    dict(t0=2.3, t1=7.7, kind='main', lines=['起初，石头只是石头。']),
    dict(t0=B(4) + 0.3, t1=B(8) - 0.5, kind='main', lines=['木头只是木头，火只是火，', '一碗饭，只是一碗饭。']),
    # ── 显 ─────────────────────────────────────────────────────
    dict(t0=B(8) + 0.9, t1=B(11) + 1.2, kind='main', lines=['直到某一刻——']),
    dict(t0=B(12) + 0.1, t1=B(15) - 0.15, kind='main', lines=['有什么，从它里面显现了出来。']),
    # ── 圣显 · 天地 ────────────────────────────────────────────
    dict(t0=B(16), t1=B(20) - 0.3, kind='title'),
    dict(t0=B(20) + 0.2, t1=B(24) - 0.3, kind='main', lines=['神圣，借一件寻常之物显现自身。', '石头仍是石头，却已不只是石头。'],
         stagger_lines=1.9),
    dict(t0=B(24) + 0.3, t1=B(28) - 0.35, kind='main', lines=['上古，天与地之间有一棵树。'],
         note='建木 · 众帝所自上下 ——《淮南子·地形训》'),
    dict(t0=B(28) + 0.3, t1=B(32) - 0.3, kind='main', lines=['后来，天与地被分开了。'],
         note='乃命重、黎，绝地天通 ——《尚书·吕刑》'),
    # ── 卜 ─────────────────────────────────────────────────────
    dict(t0=B(32) + 0.45, t1=B(36) - 0.4, kind='main', lines=['天远了。', '人心里，从此有了一种乡愁。'], stagger_lines=1.6),
    dict(t0=B(36) + 0.45, t1=B(40) - 0.4, kind='main', lines=['商人在龟甲上钻凿，以火灼烧，向天发问。']),
    dict(t0=B(40) + 0.25, t1=B(44) - 0.4, kind='main', lines=['“卜”——它裂开了。'],
         note='《说文》：卜，象龟兆之纵横也'),
    dict(t0=B(44) + 0.3, t1=B(48) - 0.2, kind='main', lines=['龟甲仍是龟甲，', '却成了天开口说话的地方。'], stagger_lines=1.5),
    # ── 坛 ─────────────────────────────────────────────────────
    dict(t0=B(49) + 0.3, t1=B(53) - 0.3, kind='main', lines=['天不再下来，人便为天筑一座坛。']),
    dict(t0=B(53) + 0.25, t1=B(57) - 0.3, kind='main', lines=['中心一块天心石，', '四周九块，逐环加九，直至八十一。'],
         note='北京天坛 · 圜丘', stagger_lines=1.4),
    dict(t0=B(57) + 0.25, t1=B(61) - 0.3, kind='main', lines=['冬至，一年中夜最长的那天，', '天子登坛，奏乐祭天。'], stagger_lines=1.5),
    dict(t0=B(57) + 1.2, t1=B(61) - 0.2, kind='quote', text='若乐六变|则天神皆降', source='《周礼·春官》', side='right'),
    dict(t0=B(61) + 0.25, t1=B(65) - 0.45, kind='main', lines=['坛的中心，就是天地的中心。']),
    # ── 烟 · 主 ────────────────────────────────────────────────
    dict(t0=B(65) + 0.4, t1=B(69) - 0.35, kind='main', lines=['燔柴于坛，烟一直升到天上。']),
    dict(t0=B(65) + 1.4, t1=B(69) - 0.25, kind='quote', text='其香始升|上帝居歆', source='《诗经·大雅·生民》', side='right'),
    dict(t0=B(69) + 0.3, t1=B(73) - 0.35, kind='main', lines=['天太远了，人也祭祀最近的神灵——祖先。'],
         note='万物本乎天，人本乎祖 ——《礼记》'),
    dict(t0=B(73) + 0.3, t1=B(75) - 0.1, kind='main', lines=['新做的牌位上，先写着“神王”。']),
    dict(t0=B(75) + 0.35, t1=B(78) - 0.3, kind='main', lines=['朱笔一点，“王”便成了“主”。'],
         note='点主：为牌位补上最后一笔'),
    dict(t0=B(78) + 0.1, t1=B(81) - 0.15, kind='main', lines=['木牌仍是木牌，却成了先人的居所。']),
    # pre-drop: 祭 · 如 · 在 handled by scene typography (B(81)..B(83))
    # ── 如在 ───────────────────────────────────────────────────
    dict(t0=B(83), t1=B(87) - 0.3, kind='bigquote', lines=['祭如在，祭神如神在。'], source='——《论语·八佾》'),
    dict(t0=B(87) + 0.3, t1=B(91) - 0.3, kind='main', lines=['清明，细雨落在碑前的花上。']),
    dict(t0=B(91) + 0.3, t1=B(95) - 0.3, kind='main', lines=['除夕，桌上多摆一副碗筷，', '留给不在场的人。'], stagger_lines=1.6),
    dict(t0=B(95) + 0.3, t1=B(99) - 0.25, kind='main', lines=['七月半，河灯一盏一盏，', '漂向他们在的地方。'], stagger_lines=1.6),
    # ── 城 ─────────────────────────────────────────────────────
    dict(t0=B(99) + 0.45, t1=B(102) - 0.1, kind='main', lines=['后来，城市越来越亮，']),
    dict(t0=B(102) + 0.15, t1=B(104) + 1.1, kind='main', lines=['天，好像越来越远了。']),
    dict(t0=B(105) + 0.2, t1=B(109) - 0.3, kind='main', lines=['可总有一个夜晚，有人在阳台上，', '为远方的亲人点一炷香。'], stagger_lines=1.7),
    # ── 显 ─────────────────────────────────────────────────────
    dict(t0=B(109) + 0.3, t1=B(112) - 0.25, kind='main', lines=['那一刻，一扇小小的窗，', '就是天地的中心。'], stagger_lines=1.4),
    dict(t0=B(112) + 0.1, t1=B(115) + 0.2, kind='bigquote', lines=['吾不与祭，如不祭。'], source='神圣借物显现，也借人显现。'),
    # ── 回 ─────────────────────────────────────────────────────
    dict(t0=B(116) + 0.4, t1=B(119) - 0.2, kind='main', lines=['石头仍是石头，烟仍是烟，', '神圣，从未远离。'], stagger_lines=1.6),
    dict(t0=B(119) + 0.3, t1=B(122) - 0.1, kind='main', lines=['而天与人，', '就在这一缕烟里，重新相连。'], stagger_lines=1.3),
    dict(t0=B(122) + 0.3, t1=253.6, kind='credits'),
]
