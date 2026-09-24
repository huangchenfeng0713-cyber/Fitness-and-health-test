/* 6.1 平均数与方差 · 第2课时 加权平均数 */
(function (M) {
  'use strict';
  var S = M.svg, st = M.stats;
  var L = '第2课时 加权平均数';

  var CANDY = [
    { nm: '奶糖', price: 30, kg: 2, c: 'var(--amber)' },
    { nm: '水果糖', price: 20, kg: 3, c: 'var(--a4)' },
    { nm: '巧克力糖', price: 60, kg: 1, c: '#8B5A3C' }
  ];

  /* ---------------- 情境：什锦糖定价 ---------------- */
  M.slide({
    id: 's612-candy', sec: '6.1', lesson: L, kind: '情境引入', title: '什锦糖每千克该卖多少元？', layout: 'split',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p class="lead">某糖果店把奶糖、水果糖和巧克力糖混合成“什锦糖”出售。现把 2 kg 奶糖、3 kg 水果糖和 1 kg 巧克力糖混合，什锦糖每千克定价多少元比较合理？</p>' +
        '  <div class="table-wrap"><table class="data"><tr><th>糖果</th><th>奶糖</th><th>水果糖</th><th>巧克力糖</th></tr>' +
        '    <tr><td>单价/(元/kg)</td><td class="num">30</td><td class="num">20</td><td class="num">60</td></tr>' +
        '    <tr><td>质量/kg</td><td class="num" data-kg="0">2</td><td class="num" data-kg="1">3</td><td class="num" data-kg="2">1</td></tr></table></div>' +
        '  <div class="box think" data-step="1"><span class="tag">尝试·交流</span><p>小亮认为：(30 + 20 + 60) ÷ 3 ≈ 36.67（元/kg）。他的算法合理吗？</p></div>' +
        '  <div class="box def" data-step="2"><span class="tag">分析</span><p>不合理。三种糖的质量不同，对价格的“影响力”也不同。应该用总价除以总质量：</p>' +
        '    <div class="formula">' + M.frac('30×2 + 20×3 + 60×1', '2 + 3 + 1') + '<span class="eq">=</span>' + M.frac('180', '6') + '<span>= 30（元/kg）</span></div></div>' +
        '  <p class="small" data-step="3">什锦糖的定价不仅与三种糖的单价有关，还与<span class="hl">每种糖所占的份量</span>有关。拖动右边的滑块改变配比试一试。</p>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">配一罐什锦糖<span class="hint">每颗糖代表 0.25 kg</span></div>' +
        '    <div class="grow-fig fig" id="jarFig"></div>' +
        '    <div id="candySliders" class="sliders"></div>' +
        '    <div class="row between"><div id="candyStats" class="grow"></div></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var kg = CANDY.map(function (c) { return c.kg; });
      var svg = M.canvas(M.$('#jarFig', body), 640, 330);
      /* 罐子 */
      var jx = 60, jy = 40, jw = 300, jh = 270;
      S('path', { d: 'M' + (jx + 40) + ' ' + jy + ' h' + (jw - 80) + ' v18 q0 10 20 18 q20 8 20 30 v' + (jh - 80) + ' q0 14 -14 14 h' + (-(jw - 28)) + ' q-14 0 -14 -14 v' + (-(jh - 80)) + ' q0 -22 20 -30 q20 -8 20 -18 z', fill: 'var(--surface-2)', stroke: 'var(--line-2)', 'stroke-width': 3 }, svg);
      S('rect', { x: jx + 30, y: jy - 18, width: jw - 60, height: 20, rx: 6, fill: 'var(--ink-3)' }, svg);
      var cols = 11, rows = 7, r = 11;
      var slots = [];
      for (var rr = 0; rr < rows; rr++) {
        for (var cc = 0; cc < cols; cc++) {
          var off = (rr % 2) * 11;
          slots.push({ x: jx + 36 + cc * 23.5 + off - (rr % 2 && cc === cols - 1 ? 23.5 : 0), y: jy + jh - 26 - rr * 26 });
        }
      }
      var gC = S('g', {}, svg);
      var candies = slots.map(function (sl, i) {
        var g = S('g', { transform: 'translate(' + sl.x + ',' + sl.y + ') scale(0)' }, gC);
        var body = S('ellipse', { rx: r, ry: r * 0.78, stroke: 'var(--surface)', 'stroke-width': 1.5 }, g);
        S('path', { d: 'M' + (-r) + ' 0 l-6 -5 v10 z M' + r + ' 0 l6 -5 v10 z', 'class': 'wrap' }, g);
        return { g: g, body: body, sl: sl, type: -1, shown: false, rot: (i * 47) % 50 - 25 };
      });
      /* 价格牌 */
      var tag = S('g', { transform: 'translate(410,70)' }, svg);
      S('path', { d: 'M0 0 h190 a10 10 0 0 1 10 10 v120 a10 10 0 0 1 -10 10 h-190 l-22 -70 z', fill: 'var(--accent)' }, tag);
      S('circle', { cx: -4, cy: 70, r: 6, fill: 'var(--surface)' }, tag);
      var tagT1 = S('text', { x: 100, y: 38, 'text-anchor': 'middle', 'font-size': 18, text: '什锦糖' }, tag);
      var tagT2 = S('text', { x: 100, y: 92, 'text-anchor': 'middle', 'font-size': 46, 'font-weight': 700, 'class': 't-num' }, tag);
      var tagT3 = S('text', { x: 100, y: 122, 'text-anchor': 'middle', 'font-size': 16, text: '元 / kg' }, tag);
      [tagT1, tagT2, tagT3].forEach(function (t) { t.style.fill = 'var(--on-accent)'; });
      var naive = S('g', { transform: 'translate(410,240)' }, svg);
      S('text', { x: 100, y: 0, 'text-anchor': 'middle', 'font-size': 16, text: '直接平均单价' }, naive);
      var nv = S('text', { x: 100, y: 34, 'text-anchor': 'middle', 'font-size': 26, 'class': 't-num', text: '36.67' }, naive);
      S('line', { x1: 50, x2: 150, y1: 24, y2: 24, stroke: 'var(--red)', 'stroke-width': 3 }, naive);
      var stats = M.W.stats(M.$('#candyStats', body), [
        { key: 'kg', label: '总质量', unit: 'kg', d: 2 },
        { key: 'cost', label: '总价', unit: '元', d: 2 },
        { key: 'p', label: '每千克定价', unit: '元', cls: 'acc', d: 2 }
      ]);
      var sliders = CANDY.map(function (c, i) {
        return M.W.slider(M.$('#candySliders', body), {
          label: '<i class="dot-c" style="--c:' + c.c + '"></i>' + c.nm + '（' + c.price + ' 元/kg）', min: 0, max: 5, step: 0.5, value: c.kg,
          fmt: function (v) { return M.fmt(v, 1) + ' kg'; },
          input: function (v) { kg[i] = v; update(); }
        });
      });
      /* 按比例把颗数交错排列，看上去是“混合”的 */
      function layout() {
        var counts = kg.map(function (k) { return Math.round(k * 4); });
        var total = counts.reduce(function (a, b) { return a + b; }, 0);
        var seq = [], acc = counts.map(function () { return 0; });
        for (var k = 0; k < total; k++) {
          var best = -1, bestScore = -1;
          for (var t = 0; t < counts.length; t++) {
            if (acc[t] >= counts[t]) continue;
            var score = (counts[t] - acc[t]) / counts[t];
            if (score > bestScore) { bestScore = score; best = t; }
          }
          acc[best]++; seq.push(best);
        }
        candies.forEach(function (c, i) {
          var want = i < seq.length ? seq[i] : -1;
          if (want === c.type) return;
          var wasShown = c.type >= 0;
          c.type = want;
          if (want >= 0) {
            c.body.style.fill = CANDY[want].c;
            c.g.querySelector('.wrap').style.fill = CANDY[want].c;
            var sl = c.sl;
            A.tween({ dur: wasShown ? 300 : 520, delay: wasShown ? 0 : (i % 11) * 18, ease: 'outBack', update: function (e) {
              var y = wasShown ? sl.y : sl.y - 60 * (1 - e);
              c.g.setAttribute('transform', 'translate(' + sl.x + ',' + y + ') rotate(' + c.rot + ') scale(' + (wasShown ? 0.8 + 0.2 * e : e) + ')');
            } });
          } else {
            A.tween({ dur: 260, update: function (e) { c.g.setAttribute('transform', 'translate(' + c.sl.x + ',' + c.sl.y + ') scale(' + (1 - e) + ')'); } });
          }
        });
      }
      function update() {
        var tw = st.sum(kg);
        var cost = CANDY.reduce(function (s, c, i) { return s + c.price * kg[i]; }, 0);
        var p = tw ? cost / tw : NaN;
        stats.set('kg', tw); stats.set('cost', cost); stats.set('p', p);
        M.countTo(tagT2, p, { d: 2, anim: A });
        M.$$('[data-kg]', body).forEach(function (td) { td.textContent = M.fmt(kg[+td.getAttribute('data-kg')], 1); });
        layout();
      }
      update();
      return {};
    }
  });

  /* ---------------- 概念：加权平均数（面积模型） ---------------- */
  M.slide({
    id: 's612-def', sec: '6.1', lesson: L, kind: '概念', title: '加权平均数', layout: 'split',
    html: function () {
      var xw = function (k) { return '<i class="v">x</i><sub>' + k + '</sub><i class="v">w</i><sub>' + k + '</sub>'; };
      var w = function (k) { return '<i class="v">w</i><sub>' + k + '</sub>'; };
      return '' +
        '<div class="col scroll">' +
        '  <p>在很多实际问题中，一组数据里各个数据的“重要程度”未必相同。计算这组数据的平均数时，往往根据各个数据的“重要程度”给它赋一个<b>权</b>。</p>' +
        '  <div class="box def"><span class="tag">加权平均数</span><p>若 <i class="v">n</i> 个数 <i class="v">x</i><sub>1</sub>，<i class="v">x</i><sub>2</sub>，…，<i class="v">x<sub>n</sub></i> 的权分别是 ' + w(1) + '，' + w(2) + '，…，<i class="v">w<sub>n</sub></i>，则</p>' +
        '    <div class="formula">' + M.frac(xw(1) + ' + ' + xw(2) + ' + … + <i class="v">x<sub>n</sub>w<sub>n</sub></i>', w(1) + ' + ' + w(2) + ' + … + <i class="v">w<sub>n</sub></i>') + '</div>' +
        '    <p>叫作这 <i class="v">n</i> 个数的<span class="hl">加权平均数</span>。</p></div>' +
        '  <ul class="dots small">' +
        '    <li>什锦糖中，单价 30，20，60 的权就是质量 2，3，1。</li>' +
        '    <li>权可以是数据出现的次数，也可以是所占的百分比或比例（此时权的和为 1，分母可省略）。</li>' +
        '  </ul>' +
        '  <div class="box think" data-step="1"><span class="tag">想一想</span><p>加权平均数和算术平均数有什么区别和联系？</p>' +
        '    <p class="small" data-step="2">当各个数据的权都相等时，加权平均数就是算术平均数；算术平均数可以看作每个数据的权都是 1 的加权平均数。权越大的数据，对平均数的“拉力”越大。</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">面积模型：宽 = 权，高 = 数据<span class="hint">面积之和不变，“推平”后的高度就是加权平均数</span></div>' +
        '    <div class="fig" id="areaFig"></div>' +
        '    <div id="areaSliders" class="sliders"></div>' +
        '    <div class="row between"><div class="btn-row"><button type="button" class="btn primary" id="btnFlat">' + M.icon('play') + '推平</button><button type="button" class="btn" id="btnFlatReset">' + M.icon('reset') + '复原</button><button type="button" class="btn" id="btnEq">权都相等</button></div><div id="areaStats" class="grow" style="max-width:20rem"></div></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var vals = [30, 20, 60], ws = [2, 3, 1];
      var cols = ['var(--amber)', 'var(--a4)', '#8B5A3C'];
      var names = ['奶糖', '水果糖', '巧克力糖'];
      var W = 720, H = 350, x0 = 70, x1 = 590, y0 = 310, yT = 30;
      var svg = M.canvas(M.$('#areaFig', body), W, H);
      var sy = M.charts.scale(0, 70, y0, yT);
      M.charts.axis(svg, { orient: 'y', scale: sy, at: x0, ticks: [0, 10, 20, 30, 40, 50, 60, 70], grid: [x0, x1], gridDash: true, fmt: function (v) { return v; }, fontSize: 14, label: '单价/(元/kg)', labelAnchor: 'start', labelDx: -30 });
      S('line', { 'class': 'axis', x1: x0, x2: x1, y1: y0, y2: y0 }, svg);
      var gB = S('g', {}, svg), gP = S('g', {}, svg), gT = S('g', {}, svg);
      var rects = vals.map(function (v, i) {
        var r = S('rect', { fill: cols[i], opacity: 0.85, stroke: 'var(--surface)', 'stroke-width': 2 }, gB);
        var t = S('text', { 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, gB);
        t.style.fill = '#fff';
        var t2 = S('text', { 'text-anchor': 'middle', 'font-size': 14, 'class': 't-ink' }, gB);
        return { r: r, t: t, t2: t2 };
      });
      var mLine = S('line', { stroke: 'var(--red)', 'stroke-width': 2.6, 'stroke-dasharray': '10 6' }, gT);
      var mTxt = S('text', { 'font-size': 16, 'font-weight': 700 }, gT);
      mTxt.style.fill = 'var(--red)';
      var mT1 = S('tspan', { x: x1 + 10, dy: 0, text: '加权平均数' }, mTxt), mT2 = S('tspan', { x: x1 + 10, dy: 21 }, mTxt);
      var stats = M.W.stats(M.$('#areaStats', body), [
        { key: 'am', label: '算术平均数', d: 2 },
        { key: 'wm', label: '加权平均数', cls: 'acc', d: 2 }
      ]);
      var sliders = ws.map(function (w0, i) {
        return M.W.slider(M.$('#areaSliders', body), {
          label: names[i] + '的权（质量/kg）', min: 0.5, max: 6, step: 0.5, value: w0,
          fmt: function (v) { return M.fmt(v, 1); },
          input: function (v) { ws[i] = v; reset(); draw(); }
        });
      });
      var geo = [];
      function draw() {
        var tw = st.sum(ws), unit = (x1 - x0 - 20) / Math.max(tw, 1e-9);
        var m = st.wmean(vals, ws);
        var x = x0 + 10;
        geo = vals.map(function (v, i) {
          var w = ws[i] * unit;
          M.attr(rects[i].r, { x: x, width: w, y: sy(v), height: y0 - sy(v) });
          M.attr(rects[i].t, { x: x + w / 2, y: y0 - 14, text: w > 46 ? names[i] : '' });
          M.attr(rects[i].t2, { x: x + w / 2, y: sy(v) - 8, text: v });
          var g = { x: x, w: w, v: v };
          x += w;
          return g;
        });
        M.attr(mLine, { x1: x0, x2: x1, y1: sy(m), y2: sy(m) });
        M.attr(mTxt, { y: sy(m) - 4 });
        mT2.textContent = '= ' + M.fmt(m, 2);
        stats.set('am', st.mean(vals));
        stats.set('wm', m);
      }
      var busy = false, flat = false;
      function reset() {
        A.cancelAll();
        while (gP.firstChild) gP.removeChild(gP.firstChild);
        busy = false; flat = false;
        rects.forEach(function (o) { o.r.setAttribute('opacity', 0.85); });
      }
      function flatten() {
        if (busy || flat) return;
        busy = true;
        var m = st.wmean(vals, ws);
        var ex = [], de = [];
        geo.forEach(function (g, i) {
          if (g.v > m + 1e-9) ex.push({ g: g, i: i, left: (g.v - m) * g.w, used: 0 });
          else if (g.v < m - 1e-9) de.push({ g: g, i: i, left: (m - g.v) * g.w, filled: 0 });
        });
        var moves = [], a = 0, b = 0;
        while (a < ex.length && b < de.length) {
          var t = Math.min(ex[a].left, de[b].left);
          moves.push({ s: ex[a], d: de[b], area: t, sOff: ex[a].used, dOff: de[b].filled });
          ex[a].used += t; ex[a].left -= t; de[b].filled += t; de[b].left -= t;
          if (ex[a].left < 1e-6) a++;
          if (de[b].left < 1e-6) b++;
        }
        var pieces = moves.map(function (mv) {
          var sw = mv.s.g.w, hS = mv.area / sw, dw = mv.d.g.w, hD = mv.area / dw;
          var from = { x: mv.s.g.x, w: sw, yVal: m + (mv.sOff / sw) + hS, h: hS };
          var to = { x: mv.d.g.x, w: dw, yVal: mv.d.g.v + (mv.dOff / dw) + hD, h: hD };
          var r = S('rect', { x: from.x, width: from.w, y: sy(from.yVal), height: sy(0) - sy(from.h), fill: cols[mv.s.i], stroke: 'var(--surface)', 'stroke-width': 1.5 }, gP);
          return { r: r, from: from, to: to };
        });
        // 高出部分“切下”
        ex.forEach(function (e) { var g = e.g; A.tween({ dur: 300, update: function (k) { var v = M.lerp(g.v, m, k); M.attr(rects[e.i].r, { y: sy(v), height: y0 - sy(v) }); } }); });
        var chain = A.wait(380);
        pieces.forEach(function (p, k) {
          chain = chain.then(function (ok) {
            if (ok === false) return false;
            return A.tween({ dur: 950, ease: 'inOutCubic', update: function (e) {
              var x = M.lerp(p.from.x, p.to.x, e), w = M.lerp(p.from.w, p.to.w, e);
              var yv = M.lerp(p.from.yVal, p.to.yVal, e), h = M.lerp(p.from.h, p.to.h, e);
              M.attr(p.r, { x: x, width: w, y: sy(yv) - 60 * Math.sin(Math.PI * e), height: sy(0) - sy(h) });
            } }).promise;
          });
        });
        chain.then(function (ok) { if (ok === false) return; busy = false; flat = true; M.toast('推平后的高度 = 加权平均数 ' + M.fmt(m, 2), 2400); });
      }
      M.$('#btnFlat', body).addEventListener('click', flatten);
      M.$('#btnFlatReset', body).addEventListener('click', function () { reset(); draw(); });
      M.$('#btnEq', body).addEventListener('click', function () {
        reset();
        ws = [2, 2, 2];
        sliders.forEach(function (s) { s.set(2); });
        draw();
        M.toast('权都相等时，加权平均数 = 算术平均数 = ' + M.fmt(st.mean(vals), 2), 2600);
      });
      draw();
      return { leave: function () { if (busy) { reset(); draw(); } } };
    }
  });

  /* ---------------- 例题：合唱比赛评分 ---------------- */
  var ITEMS = ['歌曲难度', '音准节奏', '情感表现', '舞台形象'];
  var CLASSES = [
    { nm: '一班', s: [9, 7, 9, 10], c: 'var(--s1)' },
    { nm: '二班', s: [8, 9, 9, 8], c: 'var(--s2)' },
    { nm: '三班', s: [7, 8, 10, 8], c: 'var(--s3)' }
  ];
  M.slide({
    id: 's612-choir', sec: '6.1', lesson: L, kind: '例题', title: '合唱比赛，哪个班的成绩最高？', layout: 'split even',
    html: function () {
      var head = '<tr><th>班级</th>' + ITEMS.map(function (t) { return '<th>' + t + '</th>'; }).join('') + '</tr>';
      var rows = CLASSES.map(function (c) { return '<tr><td><b>' + c.nm + '</b></td>' + c.s.map(function (v) { return '<td class="num">' + v + '</td>'; }).join('') + '</tr>'; }).join('');
      var line = function (c) { return c.nm + '：' + c.s[0] + '×20% + ' + c.s[1] + '×40% + ' + c.s[2] + '×30% + ' + c.s[3] + '×10% = <b>' + M.fmt(st.wmean(c.s, [2, 4, 3, 1]), 2) + '</b>（分）'; };
      return '' +
        '<div class="col scroll">' +
        '  <div class="box ex"><span class="tag">例 1</span><p>学校举行合唱比赛，评分包括四项（每项满分 10 分），三个班的成绩如下表。如果四项得分依次按 20%，40%，30%，10% 的比例计算各班成绩，那么哪个班的成绩最高？</p></div>' +
        '  <div class="table-wrap"><table class="data">' + head + rows + '</table></div>' +
        '  <div class="proof" style="gap:.3rem">' +
        '    <div class="pline" data-step="1"><span class="sym">解</span><span class="st">' + line(CLASSES[0]) + '</span><span></span></div>' +
        '    <div class="pline" data-step="2"><span class="sym"></span><span class="st">' + line(CLASSES[1]) + '</span><span></span></div>' +
        '    <div class="pline" data-step="3"><span class="sym"></span><span class="st">' + line(CLASSES[2]) + '</span><span></span></div>' +
        '    <div class="pline" data-step="4"><span class="sym"></span><span class="st">所以，<b>二班</b>的成绩最高。</span><span></span></div>' +
        '  </div>' +
        '  <div class="box note" data-step="5"><span class="tag">对比</span><p class="small">如果直接算四项的算术平均数：一班 8.75 分，二班 8.5 分，三班 8.25 分，一班最高。<br>“权”不同，结论就可能不同。你认为哪个评分项更重要？请设计一个评分方案。</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">设计评分方案<span class="hint">拖动滑块改变各项的权</span></div>' +
        '    <div id="wSliders" class="sliders"></div>' +
        '    <div class="weights"><div class="wbar" id="wbar"></div></div>' +
        '    <div class="rank-list" id="rank"></div>' +
        '    <div class="btn-row"><button type="button" class="btn sm" id="wBook">20% : 40% : 30% : 10%</button><button type="button" class="btn sm" id="wEq">四项同等重要</button></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var ws = [2, 4, 3, 1];
      var colors = ['var(--s1)', 'var(--s3)', 'var(--s2)', 'var(--s4)'];
      var sl = ITEMS.map(function (t, i) {
        return M.W.slider(M.$('#wSliders', body), { label: t, min: 0, max: 10, step: 1, value: ws[i], fmt: function (v) { return M.fmt(v, 0); }, input: function (v) { ws[i] = v; update(); } });
      });
      var wbar = M.$('#wbar', body);
      var segs = ITEMS.map(function (t, i) { var s = M.el('span', { style: 'background:' + colors[i] }); wbar.appendChild(s); return s; });
      var rank = M.$('#rank', body);
      var rows = CLASSES.map(function (c) {
        var r = M.el('div', { 'class': 'rank-row', html: '<span class="nm">' + c.nm + '</span><div class="track"><div class="fill" style="background:' + c.c + '"></div></div><span class="sc num">—</span>' });
        rank.appendChild(r);
        return { el: r, fill: r.querySelector('.fill'), sc: r.querySelector('.sc'), c: c };
      });
      function update() {
        var tw = st.sum(ws);
        segs.forEach(function (s, i) {
          var pct = tw ? ws[i] / tw * 100 : 25;
          s.style.flexGrow = String(tw ? ws[i] : 1);
          s.textContent = pct >= 8 ? ITEMS[i].slice(0, 2) + ' ' + M.fmt(pct, 0) + '%' : '';
        });
        var scores = rows.map(function (r) { return tw ? st.wmean(r.c.s, ws) : NaN; });
        var best = Math.max.apply(null, scores);
        rows.forEach(function (r, i) {
          r.fill.style.width = (isFinite(scores[i]) ? (scores[i] - 6) / 4 * 100 : 0) + '%';
          M.countTo(r.sc, scores[i], { d: 2 });
          r.el.classList.toggle('win', isFinite(best) && Math.abs(scores[i] - best) < 1e-9);
        });
      }
      function setW(arr) { ws = arr.slice(); sl.forEach(function (s, i) { s.set(ws[i]); }); update(); }
      M.$('#wBook', body).addEventListener('click', function () { setW([2, 4, 3, 1]); });
      M.$('#wEq', body).addEventListener('click', function () { setW([1, 1, 1, 1]); });
      update();
      return {
        onStep: function (n) { if (n >= 5) setW([1, 1, 1, 1]); else if (n < 5) setW([2, 4, 3, 1]); }
      };
    }
  });

  /* ---------------- 思考·交流：两家网站（跷跷板） ---------------- */
  M.slide({
    id: 's612-web', sec: '6.1', lesson: L, kind: '思考·交流', title: '两家网站用户的日人均上网时间', layout: 'split',
    html: function () {
      var a = '<i class="v">a</i>', b = '<i class="v">b</i>', m = '<i class="v">m</i>', n = '<i class="v">n</i>';
      return '' +
        '<div class="col scroll">' +
        '  <ol class="qlist">' +
        '    <li>已知 A，B 两家网站用户的日人均上网时间分别是 2 h 和 1 h，这两家网站所有用户的日人均上网时间是 (2 + 1) ÷ 2 = 1.5（h）吗？为什么？</li>' +
        '    <li>设 A，B 两家网站用户的日人均上网时间分别是 ' + a + ' h 和 ' + b + ' h，两家网站平均每天的上网用户分别为 ' + m + ' 人和 ' + n + ' 人，你能求出这两家网站所有用户的日人均上网时间吗？</li>' +
        '  </ol>' +
        '  <div class="box def" data-step="1"><span class="tag">分析</span><p>所有用户的总时间 ÷ 总人数：</p>' +
        '    <div class="formula">' + M.frac(m + a + ' + ' + n + b, m + ' + ' + n) + '<span class="eq">=</span>' + M.frac(m, m + ' + ' + n) + a + '<span class="eq">+</span>' + M.frac(n, m + ' + ' + n) + b + '</div>' +
        '    <p class="small">它不是 ' + a + '，' + b + ' 的算术平均数，而是 ' + a + '，' + b + ' 的加权平均数，权 ' + M.frac(m, m + ' + ' + n) + '，' + M.frac(n, m + ' + ' + n) + ' 反映了两家网站用户的分布情况。只有 ' + m + ' = ' + n + ' 时，结果才是 1.5 h。</p></div>' +
        '  <div class="box read" data-step="2"><span class="tag">阅读</span><p class="small">这是“分布式计算”的最简单形式：各部分先分别求出自己的平均数，再按数据量加权汇总。对于更多的网站也可以类似计算。在大数据时代，分布式计算有着广泛的应用。</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">加权平均数是“平衡点”<span class="hint">方块多少表示用户数（万人）</span></div>' +
        '    <div class="fig" id="seesawFig"></div>' +
        '    <div id="webSliders" class="sliders"></div>' +
        '    <div class="row between"><div class="btn-row"><button type="button" class="btn" id="btnHalf">支点放在 ' + M.frac('<i class="v">a</i>+<i class="v">b</i>', '2') + ' 处</button><button type="button" class="btn primary" id="btnBal">支点放在加权平均数处</button></div><div id="webStats" class="grow" style="max-width:20rem"></div></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var P = { a: 2, b: 1, m: 3, n: 6 };
      var W = 700, H = 290;
      var svg = M.canvas(M.$('#seesawFig', body), W, H);
      var sx = M.charts.scale(0, 3, 70, 630), beamY = 186;
      var gBeam = S('g', {}, svg);
      S('rect', { x: 40, y: beamY, width: 620, height: 10, rx: 5, fill: 'var(--ink-2)' }, gBeam);
      [0, 0.5, 1, 1.5, 2, 2.5, 3].forEach(function (v) {
        S('line', { x1: sx(v), x2: sx(v), y1: beamY + 10, y2: beamY + 18, stroke: 'var(--ink-3)', 'stroke-width': 1.5 }, gBeam);
        S('text', { x: sx(v), y: beamY + 38, 'text-anchor': 'middle', 'font-size': 17, 'class': 't-num', text: M.fmt(v, 1) }, gBeam);
      });
      S('text', { x: 664, y: beamY + 38, 'text-anchor': 'end', 'font-size': 15, text: 'h' }, gBeam);
      var stackA = S('g', {}, gBeam), stackB = S('g', {}, gBeam);
      var labA = S('text', { 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700 }, gBeam);
      var labB = S('text', { 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700 }, gBeam);
      labA.style.fill = 'var(--s1)'; labB.style.fill = 'var(--s2)';
      var ful = S('g', {}, svg);
      S('path', { d: 'M0 0 L-20 46 L20 46 Z', fill: 'var(--accent)' }, ful);
      S('rect', { x: -60, y: 46, width: 120, height: 8, rx: 4, fill: 'var(--ink-3)' }, ful);
      var fulTxt = S('text', { x: 0, y: 80, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, 'class': 't-ink' }, ful);
      var stats = M.W.stats(M.$('#webStats', body), [
        { key: 'half', label: '(a+b)÷2', unit: 'h', d: 2 },
        { key: 'wm', label: '加权平均数', unit: 'h', cls: 'acc', d: 3 }
      ]);
      var mode = 'bal', angle = 0, fx = 0;
      function stack(g, x, count, color) {
        while (g.firstChild) g.removeChild(g.firstChild);
        var per = 3, size = 24;
        for (var k = 0; k < count; k++) {
          var col = k % per, row = Math.floor(k / per);
          S('rect', { x: x - 39 + col * 27, y: beamY - 27 - row * 27, width: size, height: size, rx: 5, fill: color, opacity: 0.92 }, g);
        }
      }
      function torque(f) { return P.m * (P.a - f) + P.n * (P.b - f); }
      function render() {
        stack(stackA, sx(P.a), P.m, 'var(--s1)');
        stack(stackB, sx(P.b), P.n, 'var(--s2)');
        var topA = beamY - 27 - Math.floor((P.m - 1) / 3) * 27 - 12, topB = beamY - 27 - Math.floor((P.n - 1) / 3) * 27 - 12;
        M.attr(labA, { x: sx(P.a), y: topA, text: 'A：' + P.m + ' 万人' });
        M.attr(labB, { x: sx(P.b), y: topB, text: 'B：' + P.n + ' 万人' });
        if (Math.abs(sx(P.a) - sx(P.b)) < 90) { labA.setAttribute('y', Math.min(topA, topB) - 20); }
        stats.set('half', (P.a + P.b) / 2);
        stats.set('wm', (P.m * P.a + P.n * P.b) / (P.m + P.n));
      }
      function place(target, animate) {
        var f = target === 'bal' ? (P.m * P.a + P.n * P.b) / (P.m + P.n) : (P.a + P.b) / 2;
        var tq = torque(f);
        var ang = M.clamp(-tq * 3.2, -14, 14);
        var f0 = fx, a0 = angle;
        mode = target;
        M.$('#btnBal', body).classList.toggle('primary', target === 'bal');
        M.$('#btnHalf', body).classList.toggle('primary', target !== 'bal');
        function apply(ff, aa) {
          fx = ff; angle = aa;
          ful.setAttribute('transform', 'translate(' + sx(ff) + ',' + (beamY + 10) + ')');
          gBeam.setAttribute('transform', 'rotate(' + (-aa) + ' ' + sx(ff) + ' ' + (beamY + 10) + ')');
          fulTxt.textContent = '支点 ' + M.fmt(ff, 3) + ' h';
        }
        if (!animate) { apply(f, ang); return; }
        A.tween({ dur: 600, ease: 'inOutCubic', update: function (e) { apply(M.lerp(f0, f, e), M.lerp(a0, 0, e)); } }).promise.then(function (ok) {
          if (ok === false) return;
          A.tween({ dur: 900, ease: ang === 0 ? 'outCubic' : 'outElastic', update: function (e) { apply(f, ang * e); } });
        });
      }
      [['a', 'A 网站人均时间 a', 0.5, 3, 0.1, ' h'], ['b', 'B 网站人均时间 b', 0.5, 3, 0.1, ' h'], ['m', 'A 网站用户数 m', 1, 9, 1, ' 万人'], ['n', 'B 网站用户数 n', 1, 9, 1, ' 万人']].forEach(function (d) {
        M.W.slider(M.$('#webSliders', body), {
          label: d[1], min: d[2], max: d[3], step: d[4], value: P[d[0]],
          fmt: function (v) { return M.fmt(v, 1) + d[5]; },
          input: function (v) { P[d[0]] = v; render(); place(mode, false); }
        });
      });
      M.$('#btnHalf', body).addEventListener('click', function () { place('half', true); });
      M.$('#btnBal', body).addEventListener('click', function () { place('bal', true); });
      render();
      place('half', false);
      return {
        enter: function () { place('half', false); A.wait(500).then(function (ok) { if (ok !== false && api.isActive()) place('half', true); }); },
        onStep: function (n) { if (n >= 1) place('bal', true); }
      };
    }
  });

  /* ---------------- 随堂练习 ---------------- */
  M.slide({
    id: 's612-practice', sec: '6.1', lesson: L, kind: '随堂练习', kindCls: 'k-practice', title: '加权平均数练一练', layout: 'full',
    html: function () {
      return '' +
        '<div class="practice-grid">' +
        '  <div class="box practice"><span class="tag">1</span><p>某校规定学生的体育成绩由三部分组成：早锻炼及体育课外活动表现占 20%，体育理论测试占 30%，体育技能测试占 50%。小明的上述三项成绩依次是 90 分、85 分、88 分，小明的体育成绩是多少？</p>' +
        '    <button type="button" class="btn sm reveal-btn" data-reveal="a1"></button><div class="answer" id="a1">90×20% + 85×30% + 88×50% = 18 + 25.5 + 44 = <b class="ok">87.5（分）</b></div></div>' +
        '  <div class="box practice"><span class="tag">2</span><p>学期总评成绩中，平时作业、期中练习、期末考试分别占 40%，20%，40%。小亮这三项的数学成绩依次是 88 分、90 分、92 分，他这学期的数学总评成绩是多少？</p>' +
        '    <button type="button" class="btn sm reveal-btn" data-reveal="a2"></button><div class="answer" id="a2">88×40% + 90×20% + 92×40% = 35.2 + 18 + 36.8 = <b class="ok">90（分）</b></div></div>' +
        '  <div class="box practice"><span class="tag">3</span><p>某厂从一批节能灯中随机抽查了 200 只，测得使用寿命如下表。为了计算方便，把每组寿命近似看成这一组两端数值的中间值（如 1 000～1 200 h 看成 1 100 h），这 200 只节能灯的平均使用寿命约是多少？</p>' +
        '    <div class="table-wrap"><table class="data"><tr><th>寿命/h</th><th>1 000～1 200</th><th>1 200～1 400</th><th>1 400～1 600</th><th>1 600～1 800</th><th>1 800～2 000</th></tr><tr><td>只数</td><td class="num">30</td><td class="num">50</td><td class="num">70</td><td class="num">40</td><td class="num">10</td></tr></table></div>' +
        '    <button type="button" class="btn sm reveal-btn" data-reveal="a3"></button><div class="answer" id="a3">' + M.frac('1 100×30 + 1 300×50 + 1 500×70 + 1 700×40 + 1 900×10', '200') + ' = ' + M.frac('290 000', '200') + ' = <b class="ok">1 450（h）</b><br><span class="small ink2">各组的只数就是这一组数据的“权”。</span></div></div>' +
        '</div>';
    },
    mount: function (body) {
      M.$$('[data-reveal]', body).forEach(function (b) { M.W.reveal(b, M.$('#' + b.getAttribute('data-reveal'), body)); });
      return {};
    }
  });
})(window.M);
