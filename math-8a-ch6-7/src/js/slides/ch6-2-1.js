/* 6.2 中位数与箱线图 · 第1课时 中位数与百分位数 */
(function (M) {
  'use strict';
  var S = M.svg, st = M.stats;
  var L = '第1课时 中位数与百分位数';

  var STAFF = [
    { nm: '经理', v: 15000 }, { nm: '副经理', v: 7800 }, { nm: '职员A', v: 5200 }, { nm: '职员B', v: 5000 },
    { nm: '职员C', v: 4800 }, { nm: '职员D', v: 4600 }, { nm: '职员E', v: 4600 }, { nm: '职员F', v: 4600 }, { nm: '杂工', v: 2400 }
  ];

  /* ---------------- 情境：公司员工的工资 ---------------- */
  M.slide({
    id: 's621-salary', sec: '6.2', lesson: L, kind: '情境引入', title: '这家公司员工的收入到底怎么样？', layout: 'split',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p>某公司 9 名员工的月工资如下（单位：元）：</p>' +
        '  <div class="table-wrap"><table class="data small-t"><tr>' + STAFF.map(function (p) { return '<th>' + p.nm + '</th>'; }).join('') + '</tr><tr>' + STAFF.map(function (p, i) { return '<td class="num" data-sal="' + i + '">' + p.v + '</td>'; }).join('') + '</tr></table></div>' +
        '  <div class="talk">' +
        '    <div class="say"><b>经理</b><span>“我们公司员工收入很高，月平均工资 6 000 元。”</span></div>' +
        '    <div class="say"><b>职员C</b><span>“我的工资是 4 800 元，在公司算中等收入。”</span></div>' +
        '    <div class="say"><b>职员D</b><span>“我们好几个人的工资都是 4 600 元。”</span></div>' +
        '    <div class="say q"><b>应聘者</b><span>“这个公司员工的收入到底怎么样？”</span></div>' +
        '  </div>' +
        '  <div class="box think" data-step="4"><span class="tag">尝试·思考</span><p class="small">（1）用哪个数据描述该公司员工的收入更合适？<br>（2）为什么平均数比中位数高得多？</p>' +
        '    <p class="small" data-step="5"><b class="green">分析：</b>9 人中有 7 人的工资低于平均数 6 000 元，平均数被经理、副经理的高工资“拉高”了；中位数 4 800 元、众数 4 600 元更能代表多数员工的收入水平。</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">三个人，三种说法<span class="hint">拖动滑块改变经理的工资</span></div>' +
        '    <div class="fig" id="salFig"></div>' +
        '    <div id="salSl" class="sliders"></div>' +
        '    <div id="salStats"></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var sal = STAFF.map(function (p) { return p.v; });
      var W = 720, H = 360, x0 = 80, x1 = 600, y0 = 310, yT = 20;
      var svg = M.canvas(M.$('#salFig', body), W, H);
      var sy = M.charts.scale(0, 16000, y0, yT);
      M.charts.axis(svg, { orient: 'y', scale: sy, at: x0, ticks: [0, 4000, 8000, 12000, 16000], grid: [x0, x1], gridDash: true, fmt: function (v) { return v; }, fontSize: 13, label: '月工资/元', labelAnchor: 'start', labelDx: -34 });
      S('line', { 'class': 'axis', x1: x0, x2: x1, y1: y0, y2: y0 }, svg);
      var order = STAFF.map(function (p, i) { return i; }).sort(function (a, b) { return sal[a] - sal[b]; });
      var band = (x1 - x0) / 9, bw = band * 0.62;
      var bars = STAFF.map(function (p, i) {
        var pos = order.indexOf(i), cx = x0 + band * (pos + 0.5);
        var r = S('rect', { x: cx - bw / 2, width: bw, rx: 4, fill: 'var(--line-2)' }, svg);
        var t = S('text', { x: cx, y: y0 + 20, 'text-anchor': 'middle', 'font-size': 12, 'class': 't-ink', text: p.nm }, svg);
        return { r: r, t: t, cx: cx, i: i };
      });
      function hline(color, label, dy) {
        var g = S('g', { opacity: 0 }, svg);
        var ln = S('line', { x1: x0, x2: x1 + 6, 'stroke-width': 2.4, 'stroke-dasharray': '8 5' }, g);
        ln.style.stroke = color;
        var tx = S('text', { x: x1 + 12, 'font-size': 15, 'font-weight': 700 }, g);
        tx.style.fill = color;
        return { g: g, ln: ln, tx: tx, label: label, dy: dy || 0 };
      }
      var Lmean = hline('var(--red)', '平均数'), Lmed = hline('var(--s1)', '中位数'), Lmode = hline('var(--s3)', '众数', 18);
      var shown = { mean: false, med: false, mode: false };
      var stats = M.W.stats(M.$('#salStats', body), [
        { key: 'mean', label: '平均数', unit: '元', d: 0 },
        { key: 'med', label: '中位数', unit: '元', d: 0, cls: 's1' },
        { key: 'mode', label: '众数', unit: '元', d: 0, cls: 's3' },
        { key: 'below', label: '低于平均数', unit: '人', d: 0 }
      ]);
      function draw() {
        var m = st.mean(sal), md = st.median(sal), mo = st.modes(sal).values[0];
        bars.forEach(function (b) {
          var v = sal[b.i], top = sy(Math.min(v, 16000));
          M.attr(b.r, { y: top, height: y0 - top });
          var col = 'var(--line-2)';
          if (shown.mode && v === mo) col = 'var(--s3)';
          if (shown.med && b === bars[order[4]]) col = 'var(--s1)';
          b.r.style.fill = col;
        });
        [[Lmean, m], [Lmed, md], [Lmode, mo]].forEach(function (a) {
          var L2 = a[0], y = sy(a[1]);
          M.attr(L2.ln, { y1: y, y2: y });
          M.attr(L2.tx, { y: y + 5 + L2.dy, text: L2.label + ' ' + M.fmt(a[1], 0) });
        });
        stats.set('mean', m); stats.set('med', md); stats.set('mode', mo);
        stats.set('below', sal.filter(function (v) { return v < m; }).length);
        M.$('[data-sal="0"]', body).textContent = sal[0];
      }
      function show(key, L2, v) {
        shown[key] = v;
        A.tween({ dur: 450, update: function (e) { L2.g.setAttribute('opacity', v ? e : 1 - e); } });
        draw();
      }
      M.W.slider(M.$('#salSl', body), { label: '经理的月工资', min: 8000, max: 40000, step: 200, value: 15000, fmt: function (v) { return v + ' 元'; }, input: function (v) { sal[0] = v; draw(); } });
      draw();
      return {
        onStep: function (n) {
          if ((n >= 1) !== shown.mean) show('mean', Lmean, n >= 1);
          if ((n >= 2) !== shown.med) show('med', Lmed, n >= 2);
          if ((n >= 3) !== shown.mode) show('mode', Lmode, n >= 3);
        },
        steps: 5
      };
    },
    steps: 5
  });

  /* ---------------- 概念：中位数（排序找中间） ---------------- */
  M.slide({
    id: 's621-median', sec: '6.2', lesson: L, kind: '概念', title: '中位数：排好队，找中间', layout: 'split',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p>职员C 的工资 4 800 元恰好居于所有员工工资的“正中间”：有 4 人的工资比他高，有 4 人的工资比他低。我们称它为中位数。</p>' +
        '  <div class="box def"><span class="tag">中位数</span><p>一般地，<i class="v">n</i> 个数据按大小顺序排列，处于<span class="hl">最中间位置</span>的一个数据（或最中间两个数据的平均数）叫作这组数据的中位数。</p></div>' +
        '  <ul class="dots">' +
        '    <li>先<b>排序</b>，再找中间。</li>' +
        '    <li><i class="v">n</i> 为奇数：中位数是第 ' + M.frac('<i class="v">n</i> + 1', '2') + ' 个数据。</li>' +
        '    <li><i class="v">n</i> 为偶数：中位数是第 ' + M.frac('<i class="v">n</i>', '2') + ' 个与第 ' + M.frac('<i class="v">n</i>', '2') + ' + 1 个数据的平均数。</li>' +
        '  </ul>' +
        '  <div class="box ex" data-step="1"><span class="tag">例</span><p class="small">8 名同学的身高（单位：m）：1.52，1.55，1.58，1.60，1.63，1.66，1.70，1.72。<br>中位数是 ' + M.frac('1', '2') + '(1.60 + 1.63) = <b>1.615</b>（m）。</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">数据卡片<span class="hint" id="medHint">先排序，再找中间</span></div>' +
        '    <div class="cards-row" id="medCards"></div>' +
        '    <div class="med-note" id="medNote"></div>' +
        '    <div class="btn-row"><button type="button" class="btn primary" id="mSort">' + M.icon('sort') + '排序</button><button type="button" class="btn" id="mFind">' + M.icon('eye') + '找中间</button>' +
        '      <button type="button" class="btn" id="mAdd">' + M.icon('plus') + '添加一个</button><button type="button" class="btn" id="mDel">' + M.icon('minus') + '去掉一个</button><button type="button" class="btn ghost" id="mShuffle">' + M.icon('shuffle') + '打乱</button></div>' +
        '    <div id="medStats"></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var pool = [5200, 4800, 15000, 4600, 2400, 7800, 4600, 5000, 4600, 3900, 6300, 5500];
      var vals = pool.slice(0, 9);
      var host = M.$('#medCards', body), note = M.$('#medNote', body);
      var cards = [];
      var sorted = false, found = false;
      var stats = M.W.stats(M.$('#medStats', body), [
        { key: 'n', label: '数据个数 <i class="v">n</i>', d: 0 },
        { key: 'pos', label: '中间位置', d: 0 },
        { key: 'med', label: '中位数', cls: 'acc', d: 1 }
      ]);
      function build() {
        host.innerHTML = '';
        cards = vals.map(function (v, i) {
          var c = M.el('div', { 'class': 'dcard', html: '<span class="num">' + v + '</span>' });
          c._v = v;
          host.appendChild(c);
          return c;
        });
      }
      function flip(orderFn) {
        var first = cards.map(function (c) { return c.getBoundingClientRect(); });
        var order = orderFn(cards.slice());
        order.forEach(function (c) { host.appendChild(c); });
        cards.forEach(function (c, i) {
          var last = c.getBoundingClientRect();
          var dx = first[i].left - last.left, dy = first[i].top - last.top;
          if (c.animate && (dx || dy)) c.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'translate(' + dx / 2 + 'px,' + (dy / 2 - 30) + 'px)', offset: 0.5 }, { transform: 'none' }], { duration: 700 * M.motion, easing: 'cubic-bezier(.4,0,.2,1)' });
        });
        cards = order;
      }
      function doSort() {
        if (sorted) return;
        flip(function (arr) { return arr.sort(function (a, b) { return a._v - b._v; }); });
        sorted = true;
        M.$('#medHint', body).textContent = '已按从小到大排序';
      }
      function clearMarks() {
        cards.forEach(function (c) { c.classList.remove('mid', 'side-l', 'side-r'); });
        note.innerHTML = '';
        found = false;
      }
      function find() {
        if (!sorted) doSort();
        var n = cards.length;
        setTimeout(function () {
          cards.forEach(function (c, i) {
            var mid = n % 2 ? i === (n - 1) / 2 : (i === n / 2 - 1 || i === n / 2);
            c.classList.toggle('mid', mid);
            c.classList.toggle('side-l', !mid && i < n / 2);
            c.classList.toggle('side-r', !mid && i >= n / 2);
          });
          var v = cards.map(function (c) { return c._v; });
          var med = st.median(v);
          var half = Math.floor(n / 2);
          note.innerHTML = n % 2
            ? '共 ' + n + ' 个（奇数）：前面 ' + half + ' 个，后面 ' + half + ' 个，中间第 ' + (half + 1) + ' 个就是中位数 <b>' + M.fmt(med, 1) + '</b>'
            : '共 ' + n + ' 个（偶数）：中间两个是第 ' + half + ' 个和第 ' + (half + 1) + ' 个，中位数 = (' + v[half - 1] + ' + ' + v[half] + ') ÷ 2 = <b>' + M.fmt(med, 1) + '</b>';
          found = true;
          stats.set('pos', n % 2 ? '第 ' + (n + 1) / 2 + ' 个' : '第 ' + n / 2 + '、' + (n / 2 + 1) + ' 个');
          stats.set('med', med, { flash: true });
        }, sorted ? 0 : 720 * M.motion);
      }
      function refresh() {
        stats.set('n', cards.length);
        stats.set('pos', '—'); stats.set('med', '—');
      }
      M.$('#mSort', body).addEventListener('click', doSort);
      M.$('#mFind', body).addEventListener('click', find);
      M.$('#mShuffle', body).addEventListener('click', function () {
        clearMarks();
        flip(function (arr) { return M.shuffle(arr); });
        sorted = false; refresh();
        M.$('#medHint', body).textContent = '先排序，再找中间';
      });
      M.$('#mAdd', body).addEventListener('click', function () {
        if (cards.length >= 12) return M.toast('最多 12 个数据');
        var v = pool[cards.length] || 5000;
        var c = M.el('div', { 'class': 'dcard new', html: '<span class="num">' + v + '</span>' });
        c._v = v; host.appendChild(c); cards.push(c);
        if (c.animate) c.animate([{ opacity: 0, transform: 'translateY(-30px) scale(.7)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
        sorted = false; clearMarks(); refresh();
        M.$('#medHint', body).textContent = '数据个数变了，重新排序、找中间';
      });
      M.$('#mDel', body).addEventListener('click', function () {
        if (cards.length <= 3) return;
        var c = cards.pop();
        clearMarks();
        if (c.animate) { var a = c.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(20px) scale(.8)' }], { duration: 300 }); a.onfinish = function () { c.remove(); }; }
        else c.remove();
        refresh();
      });
      build(); refresh();
      return {
        onStep: function (n) { if (n >= 1) { vals = [1.63, 1.52, 1.70, 1.58, 1.72, 1.55, 1.66, 1.60]; build(); sorted = false; clearMarks(); refresh(); setTimeout(find, 300); } },
        enter: function () { if (api.step() === 0) { vals = pool.slice(0, 9); build(); sorted = false; clearMarks(); refresh(); } }
      };
    }
  });

  /* ---------------- 思考·交流：三个统计量的特点 ---------------- */
  M.slide({
    id: 's621-compare', sec: '6.2', lesson: L, kind: '思考·交流', title: '众数、平均数和中位数各有什么特点？', layout: 'split',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <ol class="qlist small">' +
        '    <li>小军是篮球队员，身高 1.84 m。如果球队队员身高的中位数是 1.82 m，能说小军的身高在队里中等偏上吗？如果是平均数为 1.82 m 呢？<span class="ans" data-step="1">中位数 1.82 m：能，至少一半队员不比 1.82 m 高。平均数 1.82 m：不一定，平均数可能被个别特别高或特别矮的队员“拉”偏。</span></li>' +
        '    <li>一组数据中，把最大的一个数换成一个更大的数，中位数会变吗？平均数呢？<span class="ans" data-step="2">中位数不变，平均数变大。拖动右图中最右边的点试一试。</span></li>' +
        '  </ol>' +
        '  <div class="trio" data-step="3">' +
        '    <div class="trio-card"><b>众数</b><p>某些数据多次重复出现时，众数往往是人们<span class="hl">尤为关心</span>的量（如选举、进货）。各数据重复次数大致相等时，众数往往没有特别意义。</p></div>' +
        '    <div class="trio-card"><b>平均数</b><p>所有数据都参加运算，能<span class="hl">充分利用</span>数据提供的信息，生活中较为常用；但容易受<span class="hl">极端值</span>的影响。</p></div>' +
        '    <div class="trio-card"><b>中位数</b><p>计算简单，受极端值<span class="hl">影响较小</span>；但仅有中位数，还不能完整地反映数据的分布。</p></div>' +
        '  </div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">9 名同学一个月的课外阅读量（本）<span class="hint">拖动最右边的点，制造一个极端值</span></div>' +
        '    <div class="fig drag-zone" id="cmpFig"></div>' +
        '    <div id="cmpStats"></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var data = [2, 3, 3, 3, 4, 5, 6, 7, 12];
      var W = 720, H = 280;
      var svg = M.canvas(M.$('#cmpFig', body), W, H);
      var sx = M.charts.scale(0, 32, 40, 690), base = 140;
      S('line', { 'class': 'axis', x1: 30, x2: 700, y1: base + 14, y2: base + 14 }, svg);
      M.range(0, 32, 2).forEach(function (v) {
        S('line', { 'class': 'axis', x1: sx(v), x2: sx(v), y1: base + 14, y2: base + 20 }, svg);
        S('text', { x: sx(v), y: base + 38, 'text-anchor': 'middle', 'font-size': 13, 'class': 't-num', text: v }, svg);
      });
      var gD = S('g', {}, svg);
      function marker(color, name, row) {
        var g = S('g', {}, svg);
        S('path', { d: 'M0 0 l-9 15 h18 z' }, g).style.fill = color;
        var t = S('text', { x: 0, y: 34 + row * 22, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, g);
        t.style.fill = color;
        return { g: g, t: t, name: name, x: null };
      }
      var mk = { mean: marker('var(--red)', '平均数', 2), med: marker('var(--s1)', '中位数', 1), mode: marker('var(--s3)', '众数', 0) };
      var h = M.handle(svg, 0, 0, { r: 12, color: 'var(--red)' });
      var stats = M.W.stats(M.$('#cmpStats', body), [
        { key: 'mode', label: '众数', cls: 's3', d: 2 },
        { key: 'med', label: '中位数', cls: 's1', d: 2 },
        { key: 'mean', label: '平均数', cls: 'acc', d: 2 }
      ]);
      function draw() {
        while (gD.firstChild) gD.removeChild(gD.firstChild);
        var cnt = {};
        data.forEach(function (v, i) {
          var k = cnt[v] = (cnt[v] || 0) + 1;
          if (i === data.length - 1) { h.move(sx(v), base - (k - 1) * 26); return; }
          S('circle', { cx: sx(v), cy: base - (k - 1) * 26, r: 11, fill: 'var(--accent)', opacity: 0.85 }, gD);
        });
        var vals = { mean: st.mean(data), med: st.median(data), mode: st.modes(data).values[0] };
        Object.keys(mk).forEach(function (k) {
          var o = mk[k], x = sx(vals[k]);
          o.g.setAttribute('transform', 'translate(' + x + ',' + (base + 46) + ')');
          o.t.textContent = o.name + ' ' + M.fmt(vals[k], 2);
        });
        stats.set('mode', vals.mode); stats.set('med', vals.med); stats.set('mean', vals.mean);
      }
      M.drag(h, { svg: svg, move: function (p) { var nv = M.clamp(Math.round(sx.inv(p.x)), 7, 32); if (nv !== data[8]) { data[8] = nv; draw(); } } });
      draw();
      return {
        onStep: function (n) {
          if (n === 2) { var from = data[8]; A.tween({ dur: 1200, ease: 'inOutCubic', update: function (e) { data[8] = Math.round(M.lerp(from, 30, e)); draw(); } }); }
          if (n < 2 && data[8] !== 12) { data[8] = 12; draw(); }
        }
      };
    }
  });

  /* ---------------- 概念：百分位数 ---------------- */
  var HEIGHTS = [148, 151, 153, 154, 156, 157, 158, 159, 160, 160, 161, 162, 163, 164, 165, 167, 168, 170, 172, 176];
  M.slide({
    id: 's621-percentile', sec: '6.2', lesson: L, kind: '概念', title: '百分位数：中位数的推广', layout: 'split',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p>中位数是一组由小到大排列的数据里 <b>50%</b> 位置上的数据。但仅有中位数，还不能完整地反映数据的分布。为此，通常还可以找出其他百分位置上的数据。</p>' +
        '  <div class="box def"><span class="tag">百分位数</span><p>一组数据从小到大排列后，处于 <i class="v">p</i>% 位置的数据称为第 <i class="v">p</i> 百分位数，记为 <span class="hl"><i class="v">p</i>% 分位数</span>。</p>' +
        '    <p class="small ink2">例如：中位数就是 50% 分位数；如果你的身高是某个年龄段的 90% 分位数，说明大约 90% 的同龄人身高不超过你。</p></div>' +
        '  <p class="small ink2">右图是某班 20 名同学的身高（已排序）。拖动滑块，看看 <i class="v">p</i>% 分位数把数据分成了怎样的两部分。</p>' +
        '  <div class="box note" data-step="1"><span class="tag">注意</span><p class="small">20 × <i class="v">p</i>% 恰好是整数 <i class="v">i</i> 时，<i class="v">p</i>% 分位数取第 <i class="v">i</i> 个与第 <i class="v">i</i> + 1 个数据的平均数 —— 和求偶数个数据的中位数一样。</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">20 名同学的身高（cm）</div>' +
        '    <div class="fig" id="pctFig"></div>' +
        '    <div id="pctSl" class="sliders"></div>' +
        '    <div id="pctStats"></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var W = 740, H = 330;
      var svg = M.canvas(M.$('#pctFig', body), W, H);
      var n = HEIGHTS.length, x0 = 40, x1 = 720, band = (x1 - x0) / n, y0 = 280;
      var sy = M.charts.scale(140, 180, y0, 40);
      [140, 150, 160, 170, 180].forEach(function (v) {
        S('line', { 'class': 'gridline dash', x1: x0, x2: x1, y1: sy(v), y2: sy(v) }, svg);
        S('text', { x: x0 - 6, y: sy(v) + 5, 'text-anchor': 'end', 'font-size': 12, 'class': 't-num', text: v }, svg);
      });
      var bars = HEIGHTS.map(function (v, i) {
        var cx = x0 + band * (i + 0.5);
        var r = S('rect', { x: cx - band * 0.36, width: band * 0.72, y: sy(v), height: y0 - sy(v), rx: 3 }, svg);
        S('text', { x: cx, y: y0 + 16, 'text-anchor': 'middle', 'font-size': 11, 'class': 't-num', text: i + 1 }, svg);
        return r;
      });
      S('text', { x: x1, y: y0 + 34, 'text-anchor': 'end', 'font-size': 12, text: '第 1～20 名（从矮到高）' }, svg);
      var divG = S('g', {}, svg);
      S('line', { x1: 0, x2: 0, y1: 26, y2: y0, stroke: 'var(--red)', 'stroke-width': 2.5, 'stroke-dasharray': '7 5' }, divG);
      var divT = S('text', { x: 0, y: 18, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, divG);
      divT.style.fill = 'var(--red)';
      var hLine = S('line', { x1: x0, x2: x1, stroke: 'var(--red)', 'stroke-width': 1.5, opacity: 0.6 }, svg);
      var stats = M.W.stats(M.$('#pctStats', body), [
        { key: 'below', label: '分界线左边', unit: '人', d: 0 },
        { key: 'above', label: '分界线右边', unit: '人', d: 0 },
        { key: 'val', label: '<i class="v">p</i>% 分位数', unit: 'cm', cls: 'acc', d: 2 }
      ]);
      var cur = 50;
      function draw(p) {
        cur = p;
        var i = n * p / 100;
        var val = st.percentile(HEIGHTS, p);
        bars.forEach(function (r, k) { r.style.fill = k < i ? 'var(--accent)' : 'var(--line-2)'; });
        var x = x0 + band * i;
        divG.setAttribute('transform', 'translate(' + x + ',0)');
        divT.textContent = p + '% 分位数 = ' + M.fmt(val, 2);
        M.attr(hLine, { y1: sy(val), y2: sy(val) });
        stats.set('below', i); stats.set('above', n - i); stats.set('val', val);
      }
      var sl = M.W.slider(M.$('#pctSl', body), { label: '<i class="v">p</i>%', min: 5, max: 95, step: 5, value: 50, fmt: function (v) { return v + '%'; }, input: draw });
      draw(50);
      return { onStep: function (n2) { if (n2 >= 1) { sl.set(25); draw(25); } } };
    }
  });

  /* ---------------- 观察·思考：身高百分位数值表 ---------------- */
  var PCT = [3, 10, 25, 50, 75, 90, 97];
  var TABLE = {
    boy: [152.3, 156.7, 161.0, 165.9, 170.7, 175.1, 179.4],
    girl: [147.9, 151.3, 154.8, 158.6, 162.4, 165.9, 169.3]
  };
  M.slide({
    id: 's621-table', sec: '6.2', lesson: L, kind: '观察·思考', title: '我的身高在同龄人中处于什么位置？', layout: 'split text-wide',
    html: function () {
      var row = function (k, nm) { return '<tr data-row="' + k + '"><td><b>' + nm + '</b></td>' + TABLE[k].map(function (v) { return '<td class="num">' + M.fix(v, 1) + '</td>'; }).join('') + '</tr>'; };
      return '' +
        '<div class="col scroll">' +
        '  <p>下表是根据世界卫生组织相关数据制作的 14 岁学生身高百分位数值表（单位：cm），你能读懂这张表吗？</p>' +
        '  <div class="table-wrap"><table class="data" id="pctTable"><tr><th>性别</th>' + PCT.map(function (p) { return '<th>' + p + '%<br>分位数</th>'; }).join('') + '</tr>' + row('boy', '男') + row('girl', '女') + '</table></div>' +
        '  <div class="box think"><span class="tag">读表</span><p class="small">“男生 50% 分位数是 165.9 cm”表示：大约一半的 14 岁男生身高不超过 165.9 cm。<br>“女生 90% 分位数是 165.9 cm”表示：大约 90% 的 14 岁女生身高不超过 165.9 cm。</p></div>' +
        '  <p class="small ink2" data-step="1">百分位数值表在儿童生长发育评价、服装尺码设计、公共设施设计中都很常用。</p>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">输入身高，看看大致位置</div>' +
        '    <div id="sexSeg"></div>' +
        '    <div id="hSl" class="sliders"></div>' +
        '    <div class="fig" id="rulerFig"></div>' +
        '    <div class="formula-card"><p class="small" id="posTxt"></p></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var sex = 'boy', h = 163;
      var svg = M.canvas(M.$('#rulerFig', body), 520, 190);
      var sx = M.charts.scale(140, 185, 30, 500);
      S('rect', { x: 30, y: 70, width: 470, height: 26, rx: 13, fill: 'var(--surface-3)' }, svg);
      var gTicks = S('g', {}, svg);
      var you = S('g', {}, svg);
      S('path', { d: 'M0 0 l-10 -16 h20 z', fill: 'var(--red)' }, you);
      var youT = S('text', { x: 0, y: -24, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, you);
      youT.style.fill = 'var(--red)';
      [140, 150, 160, 170, 180].forEach(function (v) { S('text', { x: sx(v), y: 180, 'text-anchor': 'middle', 'font-size': 13, 'class': 't-num', text: v }, svg); });
      function draw() {
        while (gTicks.firstChild) gTicks.removeChild(gTicks.firstChild);
        var t = TABLE[sex];
        t.forEach(function (v, i) {
          S('line', { x1: sx(v), x2: sx(v), y1: 66, y2: 100, stroke: 'var(--accent)', 'stroke-width': 2.5 }, gTicks);
          S('text', { x: sx(v), y: 120, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, 'class': 't-acc', text: PCT[i] + '%' }, gTicks);
          S('text', { x: sx(v), y: 140, 'text-anchor': 'middle', 'font-size': 11, 'class': 't-num', text: M.fix(v, 1) }, gTicks);
        });
        you.setAttribute('transform', 'translate(' + sx(h) + ',66)');
        youT.textContent = h + ' cm';
        var k = 0;
        while (k < t.length && t[k] <= h) k++;
        var who = sex === 'boy' ? '男生' : '女生';
        var txt;
        if (k === 0) txt = '低于 3% 分位数：比约 97% 的同龄' + who + '矮。';
        else if (k === t.length) txt = '高于 97% 分位数：比约 97% 的同龄' + who + '高。';
        else txt = '介于 <b>' + PCT[k - 1] + '% 分位数</b>（' + M.fix(t[k - 1], 1) + '）与 <b>' + PCT[k] + '% 分位数</b>（' + M.fix(t[k], 1) + '）之间：大约有 ' + PCT[k - 1] + '%～' + PCT[k] + '% 的 14 岁' + who + '身高不超过 ' + h + ' cm。';
        M.$('#posTxt', body).innerHTML = txt;
        M.$$('#pctTable tr[data-row]', body).forEach(function (tr) { tr.classList.toggle('win', tr.getAttribute('data-row') === sex); });
      }
      M.W.seg(M.$('#sexSeg', body), ['男生', '女生'], function (i) { sex = i ? 'girl' : 'boy'; draw(); });
      M.W.slider(M.$('#hSl', body), { label: '身高', min: 140, max: 185, step: 1, value: h, fmt: function (v) { return v + ' cm'; }, input: function (v) { h = v; draw(); } });
      draw();
      return {};
    }
  });

  /* ---------------- 随堂练习 ---------------- */
  M.slide({
    id: 's621-practice', sec: '6.2', lesson: L, kind: '随堂练习', kindCls: 'k-practice', title: '中位数练一练', layout: 'full',
    html: function () {
      return '' +
        '<div class="practice-grid">' +
        '  <div class="box practice"><span class="tag">1</span><p>某班 15 名同学一周的课外阅读时间（单位：h）如下：</p><p class="num">3，4，2，5，3，3，6，4，3，12，5，4，3，2，6</p>' +
        '    <p>（1）求这组数据的众数、中位数和平均数；（2）用哪个数据描述这组数据的集中趋势比较合适？</p>' +
        '    <button type="button" class="btn sm reveal-btn" data-reveal="q1"></button>' +
        '    <div class="answer" id="q1">排序：2，2，3，3，3，3，3，4，4，4，5，5，6，6，12。<br>众数 <b class="ok">3</b> h；中位数是第 8 个数据 <b class="ok">4</b> h；平均数 = 65 ÷ 15 ≈ <b class="ok">4.33</b> h。<br>平均数受极端值 12 的影响偏大，用中位数（或众数）描述更合适。</div></div>' +
        '  <div class="box practice"><span class="tag">2</span><p>某鞋店一周内卖出某款男式运动鞋 36 双，各尺码的销售量如下：</p>' +
        '    <div class="table-wrap"><table class="data"><tr><th>尺码</th><th>24</th><th>24.5</th><th>25</th><th>25.5</th><th>26</th><th>26.5</th><th>27</th></tr><tr><td>销量/双</td><td class="num">2</td><td class="num">4</td><td class="num">7</td><td class="num">12</td><td class="num">6</td><td class="num">4</td><td class="num">1</td></tr></table></div>' +
        '    <p>（1）求尺码的平均数（精确到 0.01）、中位数和众数；（2）鞋店老板最关心哪一个？</p>' +
        '    <button type="button" class="btn sm reveal-btn" data-reveal="q2"></button>' +
        '    <div class="answer" id="q2">（1）平均数 = 916 ÷ 36 ≈ <b class="ok">25.44</b>；第 18、19 个数据都是 25.5，中位数 <b class="ok">25.5</b>；众数 <b class="ok">25.5</b>。<br>（2）老板最关心<b class="ok">众数</b>：卖得最多的尺码应该多进货。</div></div>' +
        '</div>';
    },
    mount: function (body) {
      M.$$('[data-reveal]', body).forEach(function (b) { M.W.reveal(b, M.$('#' + b.getAttribute('data-reveal'), body)); });
      return {};
    }
  });
})(window.M);
