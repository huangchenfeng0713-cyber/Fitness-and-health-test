/* 6.2 中位数与箱线图 · 第2课时 四分位数与箱线图 */
(function (M) {
  'use strict';
  var S = M.svg, st = M.stats;
  var L = '第2课时 四分位数与箱线图';

  var TEMPS = [3, 1, 0, -2, 4, 5, 2, 2, -1, 3, 6, 2, 0, 1, 4, 7];
  var PULLUPS = [3, 8, 5, 12, 6, 9, 4, 7, 10, 6, 2];
  var ROPE1 = [141, 128, 152, 135, 160, 118, 143, 136, 149, 131, 178, 145, 138, 125, 156, 133, 142, 165, 140, 147];
  var ROPE2 = [154, 146, 162, 139, 176, 150, 158, 128, 167, 153, 135, 160, 148, 156, 142, 170, 151, 159, 164, 155];
  M.data = M.data || {};
  M.data.rope1 = ROPE1; M.data.rope2 = ROPE2;

  function sub(n) { return '<i class="v">m</i><sub>' + n + '</sub>'; }

  /* ---------------- 概念：四分位数 ---------------- */
  M.slide({
    id: 's622-quartile', sec: '6.2', lesson: L, kind: '概念', title: '四分位数：把数据分成个数相等的四部分', layout: 'split lab-wide', steps: 4,
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p>在百分位数中，除了最小值与最大值外，我们尤为关注 25% 分位数、50% 分位数、75% 分位数。</p>' +
        '  <div class="box def"><span class="tag">四分位数</span><p>它们把一组数据分为个数相等的四部分，因此分别称为<b>下四分位数</b>、<b>中位数</b>和<b>上四分位数</b>，记为 ' + sub(25) + '，' + sub(50) + '，' + sub(75) + '，统称<span class="hl">四分位数</span>。</p></div>' +
        '  <div class="box ex"><span class="tag">求法</span><ol class="qlist small">' +
        '    <li>把数据从小到大排序；</li>' +
        '    <li>中位数就是 ' + sub(50) + '，它把数据分成前、后两半；</li>' +
        '    <li>前一半数据的中位数是 ' + sub(25) + '，后一半数据的中位数是 ' + sub(75) + '。</li></ol></div>' +
        '  <div class="box note"><span class="tag">注意</span><p class="small">数据个数为奇数时，中位数是正中间那个数据，“前一半”“后一半”都<b>不含</b>这个中位数。切换到“11 个数据”试一试。</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title"><span id="qTitle">某市 16 天的日最低气温（℃）</span><span class="hint">按“下一步”逐步求四分位数</span></div>' +
        '    <div id="qSeg"></div>' +
        '    <div class="fig" id="qFig"></div>' +
        '    <div id="qStats"></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var W = 780, H = 300;
      var svg = M.canvas(M.$('#qFig', body), W, H);
      var gCards = S('g', {}, svg), gMarks = S('g', {}, svg);
      var sets = [
        { title: '某市 16 天的日最低气温（℃）', data: TEMPS },
        { title: '11 名同学的引体向上个数', data: PULLUPS }
      ];
      var cur = 0, cards = [], step = 0;
      var stats = M.W.stats(M.$('#qStats', body), [
        { key: 'q1', label: '下四分位数 ' + sub(25), d: 2, cls: 's1' },
        { key: 'q2', label: '中位数 ' + sub(50), d: 2, cls: 'acc' },
        { key: 'q3', label: '上四分位数 ' + sub(75), d: 2, cls: 's2' }
      ]);
      var geo;
      function layout(n) {
        var gap = 6, cw = Math.min(40, (W - 40 - gap * (n - 1)) / n);
        var total = n * cw + (n - 1) * gap, x0 = (W - total) / 2;
        return { cw: cw, gap: gap, x: function (i) { return x0 + i * (cw + gap); }, y: 96 };
      }
      function build() {
        while (gCards.firstChild) gCards.removeChild(gCards.firstChild);
        while (gMarks.firstChild) gMarks.removeChild(gMarks.firstChild);
        var d = sets[cur].data;
        geo = layout(d.length);
        var sortedIdx = d.map(function (v, i) { return i; }).sort(function (a, b) { return d[a] - d[b] || a - b; });
        cards = d.map(function (v, i) {
          var g = S('g', { transform: 'translate(' + geo.x(i) + ',' + geo.y + ')' }, gCards);
          var r = S('rect', { width: geo.cw, height: 52, rx: 8, fill: 'var(--surface)', stroke: 'var(--line-2)', 'stroke-width': 1.5 }, g);
          S('text', { x: geo.cw / 2, y: 33, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 600, 'class': 't-num t-ink', text: M.fmt(v, 1) }, g);
          return { g: g, r: r, v: v, i: i, pos: sortedIdx.indexOf(i), x: geo.x(i) };
        });
        M.$('#qTitle', body).textContent = sets[cur].title;
        ['q1', 'q2', 'q3'].forEach(function (k) { stats.set(k, '—'); });
      }
      function place(sorted, animate) {
        cards.forEach(function (c) {
          var tx = geo.x(sorted ? c.pos : c.i), fx = c.x;
          c.x = tx;
          if (!animate) { c.g.setAttribute('transform', 'translate(' + tx + ',' + geo.y + ')'); return; }
          A.tween({ dur: 800, delay: c.pos * 25, ease: 'inOutCubic', update: function (e) {
            c.g.setAttribute('transform', 'translate(' + M.lerp(fx, tx, e) + ',' + (geo.y - 50 * Math.sin(Math.PI * e)) + ')');
          } });
        });
      }
      /* 在“排序后第 a、b 个之间”或“正好第 a 个”处画标记 */
      function markAt(slot, label, color, row, value) {
        var x;
        if (slot.single != null) x = geo.x(slot.single) + geo.cw / 2;
        else x = (geo.x(slot.a) + geo.cw + geo.x(slot.b)) / 2;
        var g = S('g', { opacity: 0 }, gMarks);
        var ln = S('line', { x1: x, x2: x, y1: 78 - row * 26, y2: 160, 'stroke-width': 2.5, 'stroke-dasharray': '6 4' }, g);
        ln.style.stroke = color;
        var t = S('text', { x: x, y: 70 - row * 26, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 700 }, g);
        t.style.fill = color;
        M.setLabel(t, label + ' = ' + M.fmt(value, 2));
        A.tween({ dur: 450, update: function (e) { g.setAttribute('opacity', e); } });
        return g;
      }
      function bracket(from, to, label, color, y) {
        var x1 = geo.x(from), x2 = geo.x(to) + geo.cw;
        var g = S('g', { opacity: 0 }, gMarks);
        var p = S('path', { d: 'M' + x1 + ' ' + y + ' v10 H' + x2 + ' v-10', fill: 'none', 'stroke-width': 2.2 }, g);
        p.style.stroke = color;
        var t = S('text', { x: (x1 + x2) / 2, y: y + 32, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, text: label }, g);
        t.style.fill = color;
        A.tween({ dur: 450, update: function (e) { g.setAttribute('opacity', e); } });
      }
      function paint(pred, fill, stroke) {
        cards.forEach(function (c) { if (pred(c.pos)) { c.r.style.fill = fill; c.r.style.stroke = stroke; } });
      }
      var token = 0;
      function later(ms, fn) { var t = token; setTimeout(function () { if (t === token) fn(); }, ms * M.motion); }
      function apply(n) {
        step = n;
        token++;
        while (gMarks.firstChild) gMarks.removeChild(gMarks.firstChild);
        cards.forEach(function (c) { c.r.style.fill = ''; c.r.style.stroke = ''; });
        var d = sets[cur].data, len = d.length, q = st.quartiles(d), h = Math.floor(len / 2), odd = len % 2 === 1;
        place(n >= 1, true);
        ['q1', 'q2', 'q3'].forEach(function (k) { stats.set(k, '—'); });
        if (n >= 2) {
          var s50 = odd ? { single: h } : { a: h - 1, b: h };
          later(n === 2 ? 850 : 0, function () {
            markAt(s50, '{m}_50', 'var(--red)', 0, q.q2);
            if (odd) paint(function (p) { return p === h; }, 'var(--red-tint)', 'var(--red)');
            bracket(0, h - 1, '前一半（' + h + ' 个）', 'var(--s1)', 172);
            bracket(odd ? h + 1 : h, len - 1, '后一半（' + h + ' 个）', 'var(--s2)', 172);
            stats.set('q2', q.q2, { flash: true });
          });
        }
        if (n >= 3) {
          var hl = h, s25 = hl % 2 ? { single: (hl - 1) / 2 } : { a: hl / 2 - 1, b: hl / 2 };
          later(n === 3 ? 150 : 0, function () {
            paint(function (p) { return p < h; }, 'var(--s1-tint)', 'var(--s1)');
            markAt(s25, '{m}_25', 'var(--s1)', 1, q.q1);
            stats.set('q1', q.q1, { flash: true });
          });
        }
        if (n >= 4) {
          var off = odd ? h + 1 : h, s75 = h % 2 ? { single: off + (h - 1) / 2 } : { a: off + h / 2 - 1, b: off + h / 2 };
          later(n === 4 ? 150 : 0, function () {
            paint(function (p) { return p >= off; }, 'var(--s2-tint)', 'var(--s2)');
            markAt(s75, '{m}_75', 'var(--s2)', 1, q.q3);
            stats.set('q3', q.q3, { flash: true });
          });
        }
      }
      M.W.seg(M.$('#qSeg', body), ['16 个数据（偶数个）', '11 个数据（奇数个）'], function (i) { cur = i; build(); apply(step); });
      build();
      return { onStep: function (n) { apply(n); } };
    }
  });

  /* ---------------- 箱线图的画法 ---------------- */
  M.slide({
    id: 's622-box', sec: '6.2', lesson: L, kind: '尝试·思考', title: '箱线图：用五个数画出数据的分布', layout: 'split', steps: 4,
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p>老师记录了某班 20 名学生 1 min 跳绳的次数：</p>' +
        '  <p class="num small ink2">' + ROPE1.join('，') + '</p>' +
        '  <ol class="qlist small">' +
        '    <li>求这组数据的最小值、下四分位数、中位数、上四分位数和最大值。<span class="ans" data-step="1">排序后：最小值 118，' + sub(25) + ' = 134，' + sub(50) + ' = 141.5，' + sub(75) + ' = 150.5，最大值 178。</span></li>' +
        '    <li>用这五个数画出右边的统计图。<span class="ans" data-step="3">“箱子”从 ' + sub(25) + ' 到 ' + sub(75) + '，箱中横线是中位数；两根“须”分别伸到最小值和最大值。</span></li>' +
        '    <li>中间的“箱子”被中位数分成两部分，“下半截”比较短，这说明什么？<span class="ans" data-step="4">中位数以下的四分之一数据更集中；而最大值一侧的“须”很长，说明有少数同学跳得特别多。</span></li>' +
        '  </ol>' +
        '  <div class="box def" data-step="3"><span class="tag">箱线图</span><p>用一组数据的<span class="hl">最小值、下四分位数、中位数、上四分位数和最大值</span>画出的这种统计图，叫作箱线图。箱线图也可以横着画。</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">1 min 跳绳次数<span class="hint">每一段大约包含四分之一的数据</span></div>' +
        '    <div class="row gap-s"><div id="boxOrient"></div></div>' +
        '    <div class="fig" id="boxFig"></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var W = 720, H = 420;
      var svg = M.canvas(M.$('#boxFig', body), W, H);
      var q = st.quartiles(ROPE1), sorted = q.sorted;
      var orient = 'v';
      var root = S('g', {}, svg);
      var step = 0;
      function draw(from) {
        while (root.firstChild) root.removeChild(root.firstChild);
        var vert = orient === 'v';
        var sc = vert ? M.charts.scale(110, 180, 390, 30) : M.charts.scale(110, 180, 70, 680);
        // 坐标轴
        if (vert) M.charts.axis(root, { orient: 'y', scale: sc, at: 90, ticks: [110, 120, 130, 140, 150, 160, 170, 180], fmt: function (v) { return v; }, fontSize: 14 });
        else M.charts.axis(root, { orient: 'x', scale: sc, at: 360, ticks: [110, 120, 130, 140, 150, 160, 170, 180], fmt: function (v) { return v; }, fontSize: 14 });
        // 数据点（每 5 个一组着色）
        var cols = ['var(--s1)', 'var(--s3)', 'var(--s2)', 'var(--s4)'];
        var seen = {};
        sorted.forEach(function (v, i) {
          var k = seen[v] = (seen[v] || 0) + 1;
          var c = vert ? S('circle', { cx: 150 + (k - 1) * 14, cy: sc(v), r: 6 }, root) : S('circle', { cx: sc(v), cy: 300 - (k - 1) * 14, r: 6 }, root);
          c.style.fill = step >= 4 ? cols[Math.floor(i / 5)] : 'var(--ink-3)';
          c.style.opacity = 0.85;
        });
        var five = [q.min, q.q1, q.q2, q.q3, q.max];
        var names = ['最小值', '下四分位数', '中位数', '上四分位数', '最大值'];
        if (step >= 1) {
          five.forEach(function (v, i) {
            if (vert) {
              S('line', { x1: 220, x2: 520, y1: sc(v), y2: sc(v), 'class': 'guide' }, root);
              var t = S('text', { x: 530, y: sc(v) + 5 + (i === 2 ? -7 : i === 1 ? 9 : 0), 'font-size': 15, 'class': 't-ink', text: names[i] + ' ' + M.fmt(v, 2) }, root);
            } else {
              S('line', { x1: sc(v), x2: sc(v), y1: 110, y2: 330, 'class': 'guide' }, root);
              var t2 = S('text', { x: sc(v), y: i % 2 ? 72 : 96, 'text-anchor': 'middle', 'font-size': 14, 'class': 't-ink', text: names[i] + ' ' + M.fmt(v, 2) }, root);
            }
          });
        }
        if (step >= 2) {
          var bp = M.charts.box(root, { scale: sc, orient: vert ? 'v' : 'h', pos: vert ? 330 : 200, size: 90, color: 'var(--accent)', tint: 'var(--accent-tint)', anim: A });
          var target = { min: step >= 3 ? q.min : q.q1, q1: q.q1, q2: q.q2, q3: q.q3, max: step >= 3 ? q.max : q.q3 };
          if (from) { bp.set(from); bp.set(target, true); } else bp.set(target);
        }
        if (step >= 4) {
          [[q.min, q.q1], [q.q1, q.q2], [q.q2, q.q3], [q.q3, q.max]].forEach(function (seg, i) {
            var t = vert
              ? S('text', { x: 405, y: (sc(seg[0]) + sc(seg[1])) / 2 + 5, 'font-size': 13, 'font-weight': 700, text: '5 个' }, root)
              : S('text', { x: (sc(seg[0]) + sc(seg[1])) / 2, y: 262, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, text: '5 个' }, root);
            t.style.fill = cols[i];
          });
        }
      }
      M.W.seg(M.$('#boxOrient', body), ['竖着画', '横着画'], function (i) { orient = i ? 'h' : 'v'; draw(null); });
      draw(null);
      return {
        onStep: function (n, prev) {
          step = n;
          var from = null;
          if (n === 2 && prev === 1) from = { min: q.q2, q1: q.q2, q2: q.q2, q3: q.q2, max: q.q2 };
          else if (n === 3 && prev === 2) from = { min: q.q1, q1: q.q1, q2: q.q2, q3: q.q3, max: q.q3 };
          draw(from);
        }
      };
    }
  });

  /* ---------------- 读箱线图 ---------------- */
  M.slide({
    id: 's622-read', sec: '6.2', lesson: L, kind: '观察·思考', title: '读箱线图：比较数据的整体分布', layout: 'split',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <ol class="qlist small">' +
        '    <li>对照直方图：这组数据的分布有什么特点？箱线图是否也反映了这种特征？<span class="ans" data-step="1">数据集中在 130～150 次，少数同学跳得特别多，右侧“拖尾”较长；箱线图中右边的“须”明显更长，反映了同样的特征。</span></li>' +
        '    <li>同一个班两次测试的箱线图如“两组比较”所示，第二次成绩有什么变化？<span class="ans" data-step="2">第二次的中位数、四分位数都明显提高，箱子整体上移：大多数同学进步了；两次的箱子长度差不多，离散程度变化不大。</span></li>' +
        '    <li>你认为箱线图在表示数据方面有什么特点？</li>' +
        '  </ol>' +
        '  <div class="box thm" data-step="3"><span class="tag">归纳</span><p>箱线图中包含了最小值、最大值和四分位数信息，可以用来反映一组数据的<span class="hl">整体分布情况</span>，特别适用于<span class="hl">多组数据</span>整体分布情况的比较。</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="row between"><div id="readSeg"></div></div>' +
        '    <div class="fig" id="readFig"></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var W = 720, H = 420;
      var svg = M.canvas(M.$('#readFig', body), W, H);
      var root = S('g', {}, svg);
      var view = 0;
      function hist() {
        while (root.firstChild) root.removeChild(root.firstChild);
        var sx = M.charts.scale(110, 180, 70, 680);
        var bins = M.range(115, 175, 5).map(function (a) { return { a: a, b: a + 5, n: 0 }; });
        ROPE1.forEach(function (v) { bins.forEach(function (b) { if (v >= b.a && v < b.b) b.n++; }); });
        var sy = M.charts.scale(0, 5, 250, 40);
        M.charts.axis(root, { orient: 'y', scale: sy, at: 70, ticks: [0, 1, 2, 3, 4, 5], grid: [70, 680], gridDash: true, fmt: function (v) { return v; }, fontSize: 13, label: '人数', labelAnchor: 'start', labelDx: -20 });
        bins.forEach(function (b, i) {
          var r = S('rect', { x: sx(b.a), width: sx(b.b) - sx(b.a), y: 250, height: 0, fill: 'var(--accent)', opacity: 0.75, stroke: 'var(--surface)', 'stroke-width': 1.5 }, root);
          A.tween({ dur: 600, delay: i * 40, ease: 'outCubic', update: function (e) { M.attr(r, { y: M.lerp(250, sy(b.n), e), height: (250 - sy(b.n)) * e }); } });
          if (b.n) S('text', { x: (sx(b.a) + sx(b.b)) / 2, y: sy(b.n) - 6, 'text-anchor': 'middle', 'font-size': 13, 'class': 't-num t-ink', text: b.n }, root);
        });
        M.charts.axis(root, { orient: 'x', scale: sx, at: 250, ticks: M.range(110, 180, 10), fmt: function (v) { return v; }, fontSize: 13 });
        var q = st.quartiles(ROPE1);
        var bp = M.charts.box(root, { scale: sx, orient: 'h', pos: 340, size: 50, color: 'var(--s1)', tint: 'var(--s1-tint)', labels: true, anim: A });
        bp.set(q);
        S('text', { x: 70, y: 405, 'font-size': 13, text: '同一组数据：上为频数直方图，下为箱线图（横轴对齐）' }, root);
      }
      function compare() {
        while (root.firstChild) root.removeChild(root.firstChild);
        var sy = M.charts.scale(110, 190, 380, 30);
        M.charts.axis(root, { orient: 'y', scale: sy, at: 100, ticks: M.range(110, 190, 10), grid: [100, 660], gridDash: true, fmt: function (v) { return v; }, fontSize: 13, label: '1 min 跳绳次数', labelAnchor: 'start', labelDx: -30 });
        [[ROPE1, '第一次测试', 'var(--s1)', 'var(--s1-tint)', 260], [ROPE2, '第二次测试', 'var(--s2)', 'var(--s2-tint)', 500]].forEach(function (d) {
          var q = st.quartiles(d[0]);
          var bp = M.charts.box(root, { scale: sy, orient: 'v', pos: d[4], size: 110, color: d[2], tint: d[3], labels: true, anim: A });
          bp.set({ min: q.q2, q1: q.q2, q2: q.q2, q3: q.q2, max: q.q2 });
          bp.set(q, true);
          var t = S('text', { x: d[4], y: 408, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, text: d[1] }, root);
          t.style.fill = d[2];
        });
      }
      var seg = M.W.seg(M.$('#readSeg', body), ['直方图与箱线图', '两组比较'], function (i) { view = i; (i ? compare : hist)(); });
      hist();
      return {
        onStep: function (n) { var v = n >= 2 ? 1 : 0; if (v !== view) { view = v; seg.pick(v); (v ? compare : hist)(); } }
      };
    }
  });

  /* ---------------- 随堂练习 ---------------- */
  M.slide({
    id: 's622-practice', sec: '6.2', lesson: L, kind: '随堂练习', kindCls: 'k-practice', title: '四分位数与箱线图练一练', layout: 'split even',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <div class="box practice"><span class="tag">1</span><p>求下列数据的四分位数：5，8，6，9，7，7，10，6，8，9，11，7。</p>' +
        '    <button type="button" class="btn sm reveal-btn" data-reveal="r1"></button>' +
        '    <div class="answer" id="r1">排序：5，6，6，7，7，7 ┊ 8，8，9，9，10，11。<br>' + sub(50) + ' = (7 + 8) ÷ 2 = <b class="ok">7.5</b>；' + sub(25) + ' = (6 + 7) ÷ 2 = <b class="ok">6.5</b>；' + sub(75) + ' = (9 + 9) ÷ 2 = <b class="ok">9</b>。</div></div>' +
        '  <div class="box practice"><span class="tag">2</span><p>在某场排球决赛中，A 队战胜 B 队获得冠军。右图反映了两队队员的拦网高度，请比较两队的拦网高度情况。</p>' +
        '    <button type="button" class="btn sm reveal-btn" data-reveal="r2"></button>' +
        '    <div class="answer" id="r2">A 队的中位数（302 cm）和两个四分位数都高于 B 队，整体拦网更高；A 队的箱子更短、须也更短，队员拦网高度更整齐。B 队的最高者（310 cm）与 A 队相当，但整体偏低、差异较大。</div></div>' +
        '  <div class="box read"><span class="tag">阅读·思考</span><p class="small">利用计算机软件可以方便地求出平均数（AVERAGE）、众数（MODE）、中位数（MEDIAN）、方差（VARP）、标准差（STDEVP）、离差平方和（DEVSQ）和四分位数（QUARTILE），还能画箱线图。注意：软件求四分位数的算法与课本的手算方法可能略有不同，个别结果会有差异。</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab"><div class="panel-title">两队队员的拦网高度（cm）</div><div class="fig" id="netFig"></div></div>' +
        '</div>';
    },
    mount: function (body, api) {
      M.$$('[data-reveal]', body).forEach(function (b) { M.W.reveal(b, M.$('#' + b.getAttribute('data-reveal'), body)); });
      var svg = M.canvas(M.$('#netFig', body), 520, 400);
      var sy = M.charts.scale(275, 315, 360, 30);
      M.charts.axis(svg, { orient: 'y', scale: sy, at: 80, ticks: [275, 285, 295, 305, 315], grid: [80, 480], gridDash: true, fmt: function (v) { return v; }, fontSize: 14, label: '拦网高度/cm', labelAnchor: 'start', labelDx: -30 });
      var teams = [
        { nm: 'A 队', f: { min: 294, q1: 300, q2: 302, q3: 306, max: 311 }, c: 'var(--s4)', t: 'var(--s4-tint)', x: 200 },
        { nm: 'B 队', f: { min: 282, q1: 289, q2: 294, q3: 302, max: 310 }, c: 'var(--s2)', t: 'var(--s2-tint)', x: 370 }
      ];
      teams.forEach(function (tm) {
        var bp = M.charts.box(svg, { scale: sy, orient: 'v', pos: tm.x, size: 90, color: tm.c, tint: tm.t, labels: true, anim: api.anim });
        bp.set(tm.f);
        var t = S('text', { x: tm.x, y: 390, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, text: tm.nm }, svg);
        t.style.fill = tm.c;
      });
      return {};
    }
  });
})(window.M);
