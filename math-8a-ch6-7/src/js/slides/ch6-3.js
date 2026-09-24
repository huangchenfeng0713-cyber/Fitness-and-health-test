/* 6.3 哪个团队收益大 + 综合与实践 */
(function (M) {
  'use strict';
  var S = M.svg, st = M.stats;

  var TEAM_A = [5.21, 3.46, 6.72, 4.83, 1.89, 3.95, 2.74, 4.60, 3.12, 1.65, 4.38, 3.87];
  var TEAM_B = [3.52, 3.95, 4.08, 3.71, 3.64, 3.83, 4.26, 3.98, 4.12, 4.35, 3.79, 3.88];
  M.data = M.data || {};
  M.data.teams = { A: TEAM_A, B: TEAM_B };

  function sub(n) { return '<i class="v">m</i><sub>' + n + '</sub>'; }

  /* ---------------- 案例：两个理财团队 ---------------- */
  M.slide({
    id: 's63-case', sec: '6.3', kind: '综合运用', title: '哪个团队的收益大？', layout: 'split', steps: 3,
    html: function () {
      var qa = st.quartiles(TEAM_A), qb = st.quartiles(TEAM_B);
      var row = function (nm, q) { return '<tr><td><b>' + nm + '</b></td>' + [q.min, q.q1, q.q2, q.q3, q.max].map(function (v) { return '<td class="num">' + M.fmt(v, 3) + '</td>'; }).join('') + '</tr>'; };
      return '' +
        '<div class="col scroll">' +
        '  <p>某银行有 A，B 两个理财经营团队，三年内各负责经营 12 项理财产品，收益率（单位：%）如下：</p>' +
        '  <p class="num small"><b class="s1t">A：</b>' + TEAM_A.map(function (v) { return M.fix(v, 2); }).join('　') + '<br><b class="s2t">B：</b>' + TEAM_B.map(function (v) { return M.fix(v, 2); }).join('　') + '</p>' +
        '  <p>试用本章学习的知识，评价 A，B 两个团队的经营水平。</p>' +
        '  <div class="box think" data-step="1"><span class="tag">小明：平均数与方差</span><p class="small">' + M.xbar() + '<sub>A</sub> ≈ ' + M.fmt(st.mean(TEAM_A), 4) + '，' + M.xbar() + '<sub>B</sub> ≈ ' + M.fmt(st.mean(TEAM_B), 4) + '，B 团队的平均收益率略高；<br><i class="v">s</i><sub>A</sub><sup>2</sup> ≈ ' + M.fmt(st.variance(TEAM_A), 4) + '，<i class="v">s</i><sub>B</sub><sup>2</sup> ≈ ' + M.fmt(st.variance(TEAM_B), 4) + '，B 团队收益率的波动小得多。<br>结论：B 团队经营得略好一些，而且更稳健。</p></div>' +
        '  <div class="box think" data-step="2"><span class="tag">小颖：四分位数与箱线图</span>' +
        '    <div class="table-wrap"><table class="data small-t"><tr><th>团队</th><th>最小值</th><th>' + sub(25) + '</th><th>' + sub(50) + '</th><th>' + sub(75) + '</th><th>最大值</th></tr>' + row('A', qa) + row('B', qb) + '</table></div>' +
        '    <p class="small">两个团队收益率的中位数相差不大，但 A 团队的箱子和须都长得多，收益率波动明显更大。两个团队经营效益基本一样，但 B 团队更平稳。</p></div>' +
        '  <div class="box thm" data-step="3"><span class="tag">归纳</span><p>比较两组数据的整体情况，方法多样：可以借助<span class="hl">平均数和方差</span>反映数据的集中趋势和离散程度，也可以借助<span class="hl">四分位数和箱线图</span>直观反映数据的分布情况。</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="row between"><div id="teamSeg"></div><span class="hint small muted">收益率/%</span></div>' +
        '    <div class="fig" id="teamFig"></div>' +
        '    <div id="teamStats"></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var W = 720, H = 360;
      var svg = M.canvas(M.$('#teamFig', body), W, H);
      var sx = M.charts.scale(1, 7.5, 80, 690);
      var root = S('g', {}, svg);
      var teams = [{ nm: 'A 团队', d: TEAM_A, c: 'var(--s1)', t: 'var(--s1-tint)', y: 110 }, { nm: 'B 团队', d: TEAM_B, c: 'var(--s2)', t: 'var(--s2-tint)', y: 250 }];
      var view = 0;
      var stats = M.W.stats(M.$('#teamStats', body), [
        { key: 'ma', label: 'A 平均数', d: 4, cls: 's1' }, { key: 'mb', label: 'B 平均数', d: 4, cls: 's2' },
        { key: 'va', label: 'A 方差', d: 4, cls: 's1' }, { key: 'vb', label: 'B 方差', d: 4, cls: 's2' }
      ]);
      function axis() { M.charts.axis(root, { orient: 'x', scale: sx, at: 330, ticks: M.range(1, 7, 1), grid: [20, 330], gridDash: true, fmt: function (v) { return v; }, fontSize: 14 }); }
      function meanView() {
        while (root.firstChild) root.removeChild(root.firstChild);
        axis();
        teams.forEach(function (tm) {
          var m = st.mean(tm.d), s = st.sd(tm.d);
          var band = S('rect', { x: sx(m - s), width: sx(m + s) - sx(m - s), y: tm.y - 48, height: 96, rx: 8, opacity: 0 }, root);
          band.style.fill = tm.t;
          S('line', { x1: sx(1), x2: sx(7.5), y1: tm.y, y2: tm.y, stroke: 'var(--line)', 'stroke-width': 1 }, root);
          tm.d.forEach(function (v, i) {
            var c = S('circle', { cx: sx(v), cy: tm.y + ((i % 3) - 1) * 16, r: 8, opacity: 0.9 }, root);
            c.style.fill = tm.c;
          });
          var ml = S('line', { x1: sx(m), x2: sx(m), y1: tm.y - 56, y2: tm.y + 56, stroke: 'var(--ink)', 'stroke-width': 2.5 }, root);
          var lab = S('text', { x: 24, y: tm.y + 6, 'font-size': 17, 'font-weight': 800, text: tm.nm.replace(' 团队', '') }, root);
          lab.style.fill = tm.c;
          S('text', { x: sx(m) + 6, y: tm.y - 60, 'font-size': 13, 'class': 't-ink', text: '平均数 ' + M.fmt(m, 2) + '，标准差 ' + M.fmt(s, 2) }, root);
          A.tween({ dur: 600, update: function (e) { band.setAttribute('opacity', e); } });
        });
        S('text', { x: 690, y: 352, 'text-anchor': 'end', 'font-size': 12, text: '浅色带：平均数 ± 标准差' }, root);
      }
      function boxView() {
        while (root.firstChild) root.removeChild(root.firstChild);
        axis();
        teams.forEach(function (tm) {
          var q = st.quartiles(tm.d);
          var bp = M.charts.box(root, { scale: sx, orient: 'h', pos: tm.y, size: 64, color: tm.c, tint: tm.t, labels: true, anim: A });
          bp.set({ min: q.q2, q1: q.q2, q2: q.q2, q3: q.q2, max: q.q2 });
          bp.set(q, true);
          var lab = S('text', { x: 24, y: tm.y + 6, 'font-size': 17, 'font-weight': 800, text: tm.nm.replace(' 团队', '') }, root);
          lab.style.fill = tm.c;
        });
      }
      var seg = M.W.seg(M.$('#teamSeg', body), ['平均数与方差', '四分位数与箱线图'], function (i) { view = i; (i ? boxView : meanView)(); });
      stats.set('ma', st.mean(TEAM_A)); stats.set('mb', st.mean(TEAM_B));
      stats.set('va', st.variance(TEAM_A)); stats.set('vb', st.variance(TEAM_B));
      meanView();
      return { onStep: function (n) { var v = n >= 2 ? 1 : 0; if (v !== view) { view = v; seg.pick(v); (v ? boxView : meanView)(); } } };
    }
  });

  /* ---------------- 随堂练习：上学用时 ---------------- */
  var COM_J = [15, 13, 14, 16, 14, 13, 15, 14];
  var COM_Y = [12, 18, 11, 20, 13, 17, 12, 19];
  M.slide({
    id: 's63-think', sec: '6.3', kind: '随堂练习', kindCls: 'k-practice', title: '用多种方法比较两个人的上学用时', layout: 'split',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <div class="box practice"><span class="tag">练习</span><p>甲、乙两人各自记录了 8 天从家到学校所用的时间（单位：min）：</p>' +
        '    <p class="num">甲：' + COM_J.join('　') + '<br>乙：' + COM_Y.join('　') + '</p>' +
        '    <p>（1）用多种方法比较两人从家到学校所用的时间；（2）根据这些数据，你还能作出什么判断或猜想？</p></div>' +
        '  <div class="answer" data-step="1"><b>平均数</b>：甲 14.25 min，乙 15.25 min，乙平均多用 1 min；<b>中位数</b>：甲 14 min，乙 15 min。</div>' +
        '  <div class="answer" data-step="2"><b>方差</b>：甲 ≈ 0.94，乙 ≈ 11.44；<b>箱线图</b>：乙的箱子和须都长得多。乙每天用时波动很大。</div>' +
        '  <div class="answer" data-step="3"><b>猜想</b>：甲可能步行，用时稳定；乙可能乘车，受红绿灯、堵车等影响，有时很快、有时很慢。乙要想不迟到，应该按“最长用时”提前出门。</div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab"><div class="panel-title">上学用时（min）<span class="hint">点图下按钮切换</span></div>' +
        '    <div class="fig" id="comFig"></div>' +
        '    <div class="btn-row" id="comBtns"></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var svg = M.canvas(M.$('#comFig', body), 700, 330);
      var root = S('g', {}, svg);
      var sx = M.charts.scale(10, 21, 90, 670);
      var ppl = [{ nm: '甲', d: COM_J, c: 'var(--s3)', t: 'var(--s3-tint)', y: 100 }, { nm: '乙', d: COM_Y, c: 'var(--s4)', t: 'var(--s4-tint)', y: 230 }];
      var mode = 'dots';
      function draw() {
        while (root.firstChild) root.removeChild(root.firstChild);
        M.charts.axis(root, { orient: 'x', scale: sx, at: 300, ticks: M.range(10, 21, 1), grid: [30, 300], gridDash: true, fmt: function (v) { return v; }, fontSize: 14 });
        ppl.forEach(function (p) {
          var lab = S('text', { x: 40, y: p.y + 7, 'font-size': 20, 'font-weight': 800, text: p.nm }, root);
          lab.style.fill = p.c;
          if (mode === 'box') {
            var bp = M.charts.box(root, { scale: sx, orient: 'h', pos: p.y, size: 60, color: p.c, tint: p.t, labels: true, anim: A });
            bp.set(st.quartiles(p.d));
            return;
          }
          var cnt = {};
          p.d.forEach(function (v) {
            var k = cnt[v] = (cnt[v] || 0) + 1;
            var c = S('circle', { cx: sx(v), cy: p.y + 20 - (k - 1) * 22, r: 9 }, root);
            c.style.fill = p.c;
          });
          if (mode === 'mean') {
            var m = st.mean(p.d), md = st.median(p.d);
            S('path', { d: 'M' + sx(m) + ' ' + (p.y + 34) + ' l-8 13 h16 z', fill: 'var(--red)' }, root);
            S('text', { x: sx(m), y: p.y + 64, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, text: '平均 ' + M.fmt(m, 2) + '，方差 ' + M.fmt(st.variance(p.d), 2) }, root).style.fill = 'var(--red)';
          }
        });
      }
      [['dots', '点图'], ['mean', '平均数与方差'], ['box', '箱线图']].forEach(function (b) {
        var btn = M.el('button', { type: 'button', 'class': 'btn sm' + (b[0] === mode ? ' on' : ''), text: b[1] });
        btn.addEventListener('click', function () { mode = b[0]; M.$$('#comBtns .btn', body).forEach(function (x) { x.classList.toggle('on', x === btn); }); draw(); });
        M.$('#comBtns', body).appendChild(btn);
      });
      draw();
      function setMode(m) { mode = m; M.$$('#comBtns .btn', body).forEach(function (x, i) { x.classList.toggle('on', ['dots', 'mean', 'box'][i] === m); }); draw(); }
      return { onStep: function (n) { setMode(n >= 2 ? 'box' : n >= 1 ? 'mean' : 'dots'); } };
    }
  });

  /* ---------------- 综合与实践：哪个城市夏天更热 ---------------- */
  var CITY_A = [34, 35, 34, 36, 35, 34, 33, 35, 36, 35, 34, 35, 36, 37, 35, 34, 35, 36, 35, 34, 33, 34, 35, 36, 35, 34, 35, 36, 35, 34, 35];
  var CITY_B = [31, 33, 36, 38, 39, 37, 32, 30, 29, 33, 37, 39, 40, 36, 31, 30, 32, 35, 38, 39, 37, 33, 31, 30, 34, 36, 38, 37, 32, 31, 33];
  M.slide({
    id: 's63-project', sec: '6.3', kind: '综合与实践', kindCls: 'k-extend', title: '哪个城市夏天更热？', layout: 'split lab-wide',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p>组成合作小组，选择两个夏天炎热的城市，用本章知识比较哪个城市夏天更热。右边是两个城市 7 月份 31 天的日最高气温（虚构的示例数据）。</p>' +
        '  <div class="box ex"><span class="tag">设计方案</span><ul class="dots small">' +
        '    <li>影响人体冷热感觉的主要因素有哪些？（气温、湿度、风速……）</li>' +
        '    <li>用什么标准比较两个城市的炎热程度？收集哪些数据？</li>' +
        '    <li>小组怎样分工？如何整理、分析数据？</li></ul></div>' +
        '  <div class="box think"><span class="tag">试一试</span><p class="small">切换右边的“标准”，结论一样吗？</p>' +
        '    <p class="small" data-step="1">按平均数、中位数比，甲城更热；按“≥ 37 ℃ 的高温天数”比，乙城多得多。<b>标准不同，结论可能不同</b>，研究报告中要写清楚所用的标准和理由。</p></div>' +
        '  <div class="box read"><span class="tag">评估反思</span><p class="small">回顾研究方案和过程，还有哪些地方可以完善？生活中还有哪些问题可以用“制订标准—收集数据—分析数据”的方法解决？</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="row between"><div id="citySeg"></div></div>' +
        '    <div class="fig" id="cityFig"></div>' +
        '    <div id="cityStats" class="textual-stats"></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var svg = M.canvas(M.$('#cityFig', body), 740, 330);
      var root = S('g', {}, svg);
      var cities = [{ nm: '甲城', d: CITY_A, c: 'var(--s2)', t: 'var(--s2-tint)' }, { nm: '乙城', d: CITY_B, c: 'var(--s1)', t: 'var(--s1-tint)' }];
      var stats = M.W.stats(M.$('#cityStats', body), [
        { key: 'a', label: '甲城', d: 2, cls: 's2' }, { key: 'b', label: '乙城', d: 2, cls: 's1' }
      ]);
      var views = ['逐日折线', '平均数与中位数', '方差', '箱线图', '≥37 ℃ 天数'];
      var view = 0;
      function line() {
        var sy = M.charts.scale(28, 41, 290, 20), sx = function (i) { return 60 + i * 21.5; };
        M.charts.axis(root, { orient: 'y', scale: sy, at: 50, ticks: [28, 31, 34, 37, 40], grid: [50, 720], gridDash: true, fmt: function (v) { return v + '℃'; }, fontSize: 13 });
        [1, 5, 10, 15, 20, 25, 31].forEach(function (d) { S('text', { x: sx(d - 1), y: 312, 'text-anchor': 'middle', 'font-size': 12, text: d + '日' }, root); });
        cities.forEach(function (c) {
          var pl = S('polyline', { points: c.d.map(function (v, i) { return sx(i) + ',' + sy(v); }).join(' '), fill: 'none', 'stroke-width': 2.6, 'stroke-linejoin': 'round' }, root);
          pl.style.stroke = c.c;
          var len = pl.getTotalLength ? pl.getTotalLength() + 2 : 3000; pl.setAttribute('stroke-dasharray', len); pl.setAttribute('stroke-dashoffset', len);
          A.tween({ dur: 1200, ease: 'inOutCubic', update: function (e) { pl.setAttribute('stroke-dashoffset', len * (1 - e)); } });
        });
        cities.forEach(function (c, i) { S('text', { x: 700, y: 40 + i * 22, 'text-anchor': 'end', 'font-size': 15, 'font-weight': 700, text: c.nm }, root).style.fill = c.c; });
      }
      function bars(vals, unit, d) {
        var max = Math.max.apply(null, vals) * 1.15;
        var sy = M.charts.scale(0, max, 280, 40);
        S('line', { 'class': 'axis', x1: 120, x2: 620, y1: 280, y2: 280 }, root);
        cities.forEach(function (c, i) {
          var x = 220 + i * 200, top = sy(vals[i]);
          var r = S('rect', { x: x - 55, width: 110, y: 280, height: 0, rx: 6 }, root);
          r.style.fill = c.c;
          A.tween({ dur: 700, delay: i * 120, ease: 'outBack', update: function (e) { M.attr(r, { y: M.lerp(280, top, e), height: (280 - top) * e }); } });
          S('text', { x: x, y: top - 10, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700, 'class': 't-num t-ink', text: M.fmt(vals[i], d) + unit }, root);
          S('text', { x: x, y: 304, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, text: c.nm }, root).style.fill = c.c;
        });
      }
      function draw() {
        while (root.firstChild) root.removeChild(root.firstChild);
        if (view === 0) { line(); stats.set('a', '最高 ' + Math.max.apply(null, CITY_A) + ' ℃'); stats.set('b', '最高 ' + Math.max.apply(null, CITY_B) + ' ℃'); }
        if (view === 1) {
          var ma = st.mean(CITY_A), mb = st.mean(CITY_B);
          bars([ma, mb], ' ℃', 2);
          stats.set('a', '平均 ' + M.fmt(ma, 2) + '，中位数 ' + st.median(CITY_A)); stats.set('b', '平均 ' + M.fmt(mb, 2) + '，中位数 ' + st.median(CITY_B));
        }
        if (view === 2) {
          var va = st.variance(CITY_A), vb = st.variance(CITY_B);
          bars([va, vb], '', 2);
          stats.set('a', '方差 ' + M.fmt(va, 2) + '（稳定）'); stats.set('b', '方差 ' + M.fmt(vb, 2) + '（忽冷忽热）');
        }
        if (view === 3) {
          var sx = M.charts.scale(28, 41, 80, 700);
          M.charts.axis(root, { orient: 'x', scale: sx, at: 300, ticks: M.range(28, 41, 1), grid: [30, 300], gridDash: true, fmt: function (v) { return v; }, fontSize: 13 });
          cities.forEach(function (c, i) {
            var bp = M.charts.box(root, { scale: sx, orient: 'h', pos: 90 + i * 130, size: 60, color: c.c, tint: c.t, labels: true, anim: A });
            bp.set(st.quartiles(c.d));
            S('text', { x: 20, y: 96 + i * 130, 'font-size': 16, 'font-weight': 700, text: c.nm }, root).style.fill = c.c;
          });
          var qa = st.quartiles(CITY_A), qb = st.quartiles(CITY_B);
          stats.set('a', '箱子窄：' + qa.q1 + '～' + qa.q3 + ' ℃'); stats.set('b', '箱子宽：' + qb.q1 + '～' + qb.q3 + ' ℃');
        }
        if (view === 4) {
          var ca = CITY_A.filter(function (v) { return v >= 37; }).length, cb = CITY_B.filter(function (v) { return v >= 37; }).length;
          bars([ca, cb], ' 天', 0);
          stats.set('a', ca + ' 天'); stats.set('b', cb + ' 天');
        }
      }
      var seg = M.W.seg(M.$('#citySeg', body), views, function (i) { view = i; draw(); });
      draw();
      return { onStep: function (n) { if (n >= 1 && view !== 4) { view = 4; seg.pick(4); draw(); } } };
    }
  });
})(window.M);
