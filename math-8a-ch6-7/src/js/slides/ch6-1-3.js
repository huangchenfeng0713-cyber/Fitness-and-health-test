/* 6.1 平均数与方差 · 第3课时 方差与标准差 */
(function (M) {
  'use strict';
  var S = M.svg, st = M.stats;
  var L = '第3课时 离差平方和、方差与标准差';
  var JIA = [8, 7, 8, 9, 8, 6, 8, 10, 7, 8, 9, 8];
  var DING = [10, 6, 8, 10, 6, 7, 10, 6, 9, 10, 8, 6];

  /* ---------------- 情境：谁更稳定 ---------------- */
  M.slide({
    id: 's613-stable', sec: '6.1', lesson: L, kind: '情境引入', title: '平均成绩都是 8 环，谁发挥得更稳定？', layout: 'split lab-wide',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p class="lead">回到本节开始的射击问题：甲与丁每次的射击成绩如右图，他们的平均成绩都是 8 环。两人的射击表现一样吗？</p>' +
        '  <ol class="qlist">' +
        '    <li>你觉得谁发挥得更稳定？理由是什么？</li>' +
        '    <li>能不能设法通过计算说明两人成绩的稳定程度？</li>' +
        '  </ol>' +
        '  <div class="box think" data-step="1"><span class="tag">观察</span><p>甲的成绩都在平均线附近，丁的成绩忽高忽低。每个数据与平均数的差 ' + '<i class="v">x</i> − ' + M.xbar() + ' 叫作这个数据的<b>离差</b>，离差的大小反映了它偏离“中心”的程度。</p></div>' +
        '  <div class="box note" data-step="2"><span class="tag">发现</span><p>把离差直接相加，甲、丁的结果都是 <b>0</b>：正、负离差互相抵消了！</p><p class="small">想办法去掉正负号：把每个离差平方后再相加。</p></div>' +
        '  <div class="box def" data-step="3"><span class="tag">离差平方和</span><p>甲：<i class="v">S</i><sub>甲</sub> = 12；丁：<i class="v">S</i><sub>丁</sub> = 34。离差平方和越大，数据越分散。</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">两人各 12 次射击的成绩<span class="hint" id="stHint">横轴：次序　纵轴：成绩/环</span></div>' +
        '    <div class="fig" id="stableFig"></div>' +
        '    <div class="row between"><div class="btn-row">' +
        '      <button type="button" class="btn sm" id="bMean">' + M.icon('minus') + '平均线</button>' +
        '      <button type="button" class="btn sm" id="bDev">' + M.icon('sort') + '画出离差</button>' +
        '      <button type="button" class="btn sm" id="bSq">' + M.icon('grid') + '离差平方</button></div>' +
        '      <div id="stableStats" class="grow" style="max-width:26rem"></div></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var W = 760, H = 400;
      var svg = M.canvas(M.$('#stableFig', body), W, H);
      var panels = [{ nm: '甲', d: JIA, c: 'var(--s1)', y0: 20 }, { nm: '丁', d: DING, c: 'var(--s4)', y0: 210 }];
      var sx = function (i) { return 110 + i * 52; };
      var gridY;
      panels.forEach(function (p) {
        var sy = M.charts.scale(5, 11, p.y0 + 170, p.y0);
        p.sy = sy;
        var g = S('g', {}, svg);
        [6, 7, 8, 9, 10].forEach(function (v) {
          S('line', { 'class': 'gridline dash', x1: 80, x2: 730, y1: sy(v), y2: sy(v) }, g);
          S('text', { x: 72, y: sy(v) + 5, 'text-anchor': 'end', 'font-size': 14, 'class': 't-num', text: v }, g);
        });
        var nmT = S('text', { x: 24, y: sy(8) + 7, 'font-size': 24, 'font-weight': 800, text: p.nm }, g);
        nmT.style.fill = p.c;
        p.gDev = S('g', {}, svg);
        p.gSq = S('g', {}, svg);
        p.meanLine = S('line', { x1: 80, x2: 730, y1: sy(8), y2: sy(8), stroke: 'var(--red)', 'stroke-width': 2.4, 'stroke-dasharray': '9 6', opacity: 0 }, svg);
        p.dots = p.d.map(function (v, i) {
          return S('circle', { cx: sx(i), cy: sy(v), r: 8, fill: p.c, stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
        });
        p.devs = p.d.map(function (v, i) {
          var dv = v - 8;
          var ln = S('line', { x1: sx(i), x2: sx(i), y1: sy(8), y2: sy(8), 'stroke-width': 4, 'stroke-linecap': 'round' }, p.gDev);
          ln.style.stroke = dv > 0 ? 'var(--green)' : 'var(--red)';
          var t = S('text', { x: sx(i) + 13, y: (sy(v) + sy(8)) / 2 + 5, 'font-size': 13, 'font-weight': 700, opacity: 0, text: dv ? M.signed(dv, 0) : '' }, p.gDev);
          t.style.fill = dv > 0 ? 'var(--green)' : 'var(--red)';
          return { ln: ln, t: t, v: v, dv: dv };
        });
        p.sqs = p.d.map(function (v, i) {
          var dv = v - 8, side = Math.abs(sy(v) - sy(8));
          var r = S('rect', { x: sx(i), y: Math.min(sy(v), sy(8)), width: 0, height: side, fill: p.c, opacity: 0.18, stroke: p.c, 'stroke-width': 1.2 }, p.gSq);
          return { r: r, side: side };
        });
      });
      S('text', { x: 730, y: 396, 'text-anchor': 'end', 'font-size': 13, text: '次序 1～12' }, svg);
      var stats = M.W.stats(M.$('#stableStats', body), [
        { key: 'dj', label: '甲 离差之和', d: 2 },
        { key: 'dd', label: '丁 离差之和', d: 2 },
        { key: 'sj', label: '甲 离差平方和', d: 2, cls: 's1' },
        { key: 'sd', label: '丁 离差平方和', d: 2, cls: 's4' }
      ]);
      var state = { mean: false, dev: false, sq: false };
      function setMean(v) {
        state.mean = v; M.$('#bMean', body).classList.toggle('on', v);
        panels.forEach(function (p) { A.tween({ dur: 400, update: function (e) { p.meanLine.setAttribute('opacity', v ? e : 1 - e); } }); });
      }
      function setDev(v) {
        state.dev = v; M.$('#bDev', body).classList.toggle('on', v);
        if (v && !state.mean) setMean(true);
        panels.forEach(function (p) {
          p.devs.forEach(function (o, i) {
            A.tween({ dur: 450, delay: v ? i * 40 : 0, ease: 'outCubic', update: function (e) {
              var k = v ? e : 1 - e;
              o.ln.setAttribute('y2', M.lerp(p.sy(8), p.sy(o.v), k));
              o.t.setAttribute('opacity', k);
            } });
          });
        });
        stats.set('dj', v ? st.sum(JIA.map(function (x) { return x - 8; })) : '—');
        stats.set('dd', v ? st.sum(DING.map(function (x) { return x - 8; })) : '—');
      }
      function setSq(v) {
        state.sq = v; M.$('#bSq', body).classList.toggle('on', v);
        if (v && !state.dev) setDev(true);
        panels.forEach(function (p) {
          p.sqs.forEach(function (o, i) {
            A.tween({ dur: 500, delay: v ? i * 50 : 0, ease: 'outBack', update: function (e) { o.r.setAttribute('width', Math.max(0, o.side * (v ? e : 1 - e))); } });
          });
        });
        stats.set('sj', v ? st.ss(JIA) : '—');
        stats.set('sd', v ? st.ss(DING) : '—');
        M.$('#stHint', body).textContent = v ? '每个小正方形的面积 = 离差的平方' : '横轴：次序　纵轴：成绩/环';
      }
      ['dj', 'dd', 'sj', 'sd'].forEach(function (k) { stats.set(k, '—'); });
      M.$('#bMean', body).addEventListener('click', function () { setMean(!state.mean); });
      M.$('#bDev', body).addEventListener('click', function () { setDev(!state.dev); });
      M.$('#bSq', body).addEventListener('click', function () { setSq(!state.sq); });
      return {
        onStep: function (n) {
          if ((n >= 1) !== state.mean) setMean(n >= 1);
          if ((n >= 2) !== state.dev) setDev(n >= 2);
          if ((n >= 3) !== state.sq) setSq(n >= 3);
        }
      };
    }
  });

  /* ---------------- 概念：方差与标准差（正方形模型） ---------------- */
  M.slide({
    id: 's613-var', sec: '6.1', lesson: L, kind: '概念', title: '离差平方和、方差与标准差', layout: 'split',
    html: function () {
      var d = function (k) { return '(<i class="v">x</i><sub>' + k + '</sub> − ' + M.xbar() + ')<sup>2</sup>'; };
      var dn = '(<i class="v">x<sub>n</sub></i> − ' + M.xbar() + ')<sup>2</sup>';
      return '' +
        '<div class="col scroll">' +
        '  <p>数据的<b>离散程度</b>，即数据相对于集中趋势的偏离情况，可以用离差平方和、方差或标准差来刻画。</p>' +
        '  <div class="box def"><span class="tag">离差平方和</span><p>各个数据与它们平均数之差的平方和：</p><div class="formula"><i class="v">S</i> = ' + d(1) + ' + ' + d(2) + ' + … + ' + dn + '</div></div>' +
        '  <div class="box def"><span class="tag">方差</span><p>各个数据与平均数之差的平方的<span class="hl">平均数</span>：</p><div class="formula"><i class="v">s</i><sup>2</sup> = ' + M.frac('1', '<i class="v">n</i>') + '[' + d(1) + ' + ' + d(2) + ' + … + ' + dn + ']</div></div>' +
        '  <div class="box def"><span class="tag">标准差</span><p>方差的<span class="hl">算术平方根</span>：<i class="v">s</i> = <span class="sqrt"><span><i class="v">s</i><sup>2</sup></span></span>。标准差与原数据的单位相同。</p></div>' +
        '  <div class="box thm" data-step="1"><span class="tag">结论</span><p>一般而言，一组数据的方差或标准差越<span class="hl">小</span>，这组数据就越<span class="hl">稳定</span>。</p></div>' +
        '  <p class="small ink2" data-step="2">为什么除以 <i class="v">n</i>？数据个数越多，离差平方和往往越大；除以个数取平均，才能比较个数不同的两组数据。</p>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">把离差画成正方形<span class="hint">拖动数据点，观察正方形与方差的变化</span></div>' +
        '    <div class="row gap-s"><div id="varSeg"></div></div>' +
        '    <div class="fig drag-zone" id="sqFig"></div>' +
        '    <div id="varStats"></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var presets = [[7, 8, 8, 8, 9, 8], [6, 10, 6, 10, 8, 8], [4, 6, 7, 9, 10, 12]];
      var data = presets[0].slice();
      var W = 760, H = 370;
      var svg = M.canvas(M.$('#sqFig', body), W, H);
      var sx = M.charts.scale(2, 14, 60, 700), lineY = 136;
      S('line', { 'class': 'axis', x1: 50, x2: 710, y1: lineY, y2: lineY }, svg);
      M.range(2, 14, 1).forEach(function (v) {
        S('line', { 'class': 'axis', x1: sx(v), x2: sx(v), y1: lineY, y2: lineY + 6 }, svg);
        S('text', { x: sx(v), y: lineY + 24, 'text-anchor': 'middle', 'font-size': 14, 'class': 't-num', text: v }, svg);
      });
      var meanG = S('g', {}, svg);
      S('line', { x1: 0, x2: 0, y1: -130, y2: 0, stroke: 'var(--red)', 'stroke-width': 2, 'stroke-dasharray': '6 5' }, meanG);
      S('path', { d: 'M0 30 l-8 14 h16 z', fill: 'var(--red)' }, meanG);
      var meanT = S('text', { x: 0, y: 62, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, meanG);
      meanT.style.fill = 'var(--red)';
      var gDev = S('g', {}, svg);
      var gPts = S('g', {}, svg);
      var gSq = S('g', {}, svg);
      S('text', { x: 30, y: 226, 'font-size': 15, 'class': 't-ink', text: '每个离差画成一个正方形，面积 = 离差的平方：' }, svg);
      var eqG = S('g', {}, svg);
      var avgSq = S('rect', { fill: 'var(--accent)', 'fill-opacity': 0.2, stroke: 'var(--accent)', 'stroke-width': 2.5 }, eqG);
      var avgT = S('text', { 'font-size': 15, 'font-weight': 700, 'class': 't-acc' }, eqG);
      var avgT2 = S('text', { 'font-size': 14, 'class': 't-ink' }, eqG);
      var colors = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--a1)', 'var(--a4)'];
      var stats = M.W.stats(M.$('#varStats', body), [
        { key: 'm', label: '平均数 ' + M.xbar(), d: 2 },
        { key: 'S', label: '离差平方和 <i class="v">S</i>', d: 2 },
        { key: 'v', label: '方差 <i class="v">s</i>²', cls: 'acc', d: 2 },
        { key: 'sd', label: '标准差 <i class="v">s</i>', d: 2 }
      ]);
      var pts = data.map(function (v, i) {
        var h = M.handle(gPts, sx(v), lineY - 16, { r: 11, color: colors[i] });
        M.drag(h, { svg: svg, move: function (p) { var nv = M.clamp(Math.round(sx.inv(p.x) * 2) / 2, 2, 14); if (nv !== data[i]) { data[i] = nv; draw(); } } });
        return h;
      });
      function draw() {
        var m = st.mean(data), n = data.length;
        var seen = {};
        while (gDev.firstChild) gDev.removeChild(gDev.firstChild);
        pts.forEach(function (h, i) {
          var k = seen[data[i]] = (seen[data[i]] || 0) + 1;
          var y = lineY - 16 - (k - 1) * 25;
          h.move(sx(data[i]), y);
          if (Math.abs(data[i] - m) > 1e-9) {
            var ln = S('line', { x1: sx(m), x2: sx(data[i]), y1: y, y2: y, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-opacity': 0.55 }, gDev);
            ln.style.stroke = colors[i];
          }
        });
        meanG.setAttribute('transform', 'translate(' + sx(m) + ',' + lineY + ')');
        meanT.textContent = '平均数 ' + M.fmt(m, 2);
        while (gSq.firstChild) gSq.removeChild(gSq.firstChild);
        var devs = data.map(function (v) { return v - m; });
        var sumAbs = devs.reduce(function (s2, d) { return s2 + Math.abs(d); }, 0);
        var maxAbs = Math.max.apply(null, devs.map(Math.abs).concat([0.01]));
        var unit = Math.min(30, 430 / Math.max(sumAbs, 0.01), 100 / maxAbs);
        var x = 30, base = 340, total = 0;
        devs.forEach(function (dv, i) {
          var side = Math.abs(dv) * unit;
          total += dv * dv;
          var r = S('rect', { x: x, y: base - side, width: side, height: side, rx: 2, 'stroke-width': 2, 'fill-opacity': 0.25 }, gSq);
          r.style.fill = colors[i]; r.style.stroke = colors[i];
          S('text', { x: x + Math.max(side, 22) / 2, y: base + 20, 'text-anchor': 'middle', 'font-size': 13, 'class': 't-num t-ink', text: M.fmt(dv * dv, 2) }, gSq);
          x += Math.max(side, 22) + 10;
        });
        var S2 = total / n, sd = Math.sqrt(S2), side2 = sd * unit;
        S('text', { x: x + 2, y: base - 6, 'font-size': 18, 'class': 't-ink', text: '→ 平均' }, gSq);
        var ex = x + 64;
        M.attr(avgSq, { x: ex, y: base - side2, width: side2, height: side2 });
        M.attr(avgT, { x: ex, y: base - Math.max(side2, 20) - 30, text: '平均面积 = 方差 ' + M.fmt(S2, 2) });
        M.attr(avgT2, { x: ex, y: base - Math.max(side2, 20) - 10, text: '边长 = 标准差 ' + M.fmt(sd, 2) });
        stats.set('m', m); stats.set('S', total); stats.set('v', S2); stats.set('sd', sd);
      }
      M.W.seg(M.$('#varSeg', body), ['数据较集中', '数据较分散', '数据很分散'], function (i) { data = presets[i].slice(); draw(); });
      draw();
      return {};
    }
  });

  /* ---------------- 例题：计算标准差 ---------------- */
  M.slide({
    id: 's613-example', sec: '6.1', lesson: L, kind: '例题', title: '计算甲、丁射击成绩的方差和标准差', layout: 'split even',
    html: function () {
      var tbl = function (id) {
        return '<div class="table-wrap"><table class="data calc-table" id="' + id + '"><tr><th>成绩 <i class="v">x</i>/环</th><th>次数</th><th><i class="v">x</i> − ' + M.xbar() + '</th><th>(<i class="v">x</i> − ' + M.xbar() + ')²</th><th>次数 × (<i class="v">x</i> − ' + M.xbar() + ')²</th></tr></table></div>';
      };
      return '' +
        '<div class="col scroll">' +
        '  <div class="box ex"><span class="tag">例 2</span><p>分别计算甲、丁射击成绩的方差和标准差（结果精确到 0.01 环），并比较谁的成绩更稳定。</p></div>' +
        '  <div class="proof" style="gap:.25rem">' +
        '    <div class="pline" data-step="1"><span class="sym">解</span><span class="st">' + M.xbar('x') + '<sub>甲</sub> = ' + M.frac('6×1 + 7×2 + 8×6 + 9×2 + 10×1', '12') + ' = 8（环），</span><span></span></div>' +
        '    <div class="pline" data-step="2"><span class="sym"></span><span class="st"><i class="v">s</i><sub>甲</sub><sup>2</sup> = ' + M.frac('1', '12') + '[(6−8)²×1 + (7−8)²×2 + (8−8)²×6 + (9−8)²×2 + (10−8)²×1] = ' + M.frac('12', '12') + ' = 1，<i class="v">s</i><sub>甲</sub> = 1（环）；</span><span></span></div>' +
        '    <div class="pline" data-step="3"><span class="sym"></span><span class="st">' + M.xbar('x') + '<sub>丁</sub> = 8（环），<i class="v">s</i><sub>丁</sub><sup>2</sup> = ' + M.frac('1', '12') + '[(6−8)²×4 + (7−8)²×1 + (8−8)²×2 + (9−8)²×1 + (10−8)²×4] = ' + M.frac('34', '12') + ' ≈ 2.83，</span><span></span></div>' +
        '    <div class="pline" data-step="4"><span class="sym"></span><span class="st"><i class="v">s</i><sub>丁</sub> = <span class="sqrt"><span>' + M.frac('34', '12') + '</span></span> ≈ 1.68（环）。</span><span></span></div>' +
        '    <div class="pline" data-step="5"><span class="sym">∵</span><span class="st"><i class="v">s</i><sub>甲</sub><sup>2</sup> &lt; <i class="v">s</i><sub>丁</sub><sup>2</sup>，∴ 甲的射击成绩更稳定。</span><span></span></div>' +
        '  </div>' +
        '  <div class="box read" data-step="6"><span class="tag">计算器</span><p class="small">使用科学计算器可以方便地求标准差：进入统计计算状态 → 输入数据 → 按键得出标准差。请在你的计算器上试一试。</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">列表计算<span class="hint">数据重复时，用“次数”作权</span></div>' +
        '    <div class="tabs" id="exTabs"><button type="button" class="on" data-t="0">甲</button><button type="button" data-t="1">丁</button></div>' +
        tbl('calcT') +
        '    <div id="exStats"></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var sets = [{ nm: '甲', f: [1, 2, 6, 2, 1] }, { nm: '丁', f: [4, 1, 2, 1, 4] }];
      var table = M.$('#calcT', body);
      var stats = M.W.stats(M.$('#exStats', body), [
        { key: 'S', label: '离差平方和', d: 2 },
        { key: 'v', label: '方差', cls: 'acc', d: 2 },
        { key: 'sd', label: '标准差', d: 2 }
      ]);
      function show(k) {
        M.$$('#exTabs button', body).forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-t') === k); });
        M.$$('tr.r', table).forEach(function (r) { r.parentNode.removeChild(r); });
        var f = sets[k].f, total = 0;
        [6, 7, 8, 9, 10].forEach(function (x, i) {
          var dv = x - 8, p = f[i] * dv * dv;
          total += p;
          var tr = M.el('tr', { 'class': 'r', html: '<td class="num">' + x + '</td><td class="num">' + f[i] + '</td><td class="num">' + M.signed(dv, 0) + '</td><td class="num">' + dv * dv + '</td><td class="num"><b>' + p + '</b></td>' });
          (table.tBodies[0] || table).appendChild(tr);
          if (tr.animate) tr.animate([{ opacity: 0, transform: 'translateX(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 350, delay: i * 70, fill: 'backwards', easing: 'cubic-bezier(.2,.8,.2,1)' });
        });
        var sum = M.el('tr', { 'class': 'r', html: '<td><b>合计</b></td><td class="num">12</td><td></td><td></td><td class="num hi">' + total + '</td>' });
        (table.tBodies[0] || table).appendChild(sum);
        stats.set('S', total); stats.set('v', total / 12); stats.set('sd', Math.sqrt(total / 12));
      }
      M.$$('#exTabs button', body).forEach(function (b) { b.addEventListener('click', function () { show(+b.getAttribute('data-t')); }); });
      show(0);
      return { onStep: function (n) { show(n >= 3 ? 1 : 0); } };
    }
  });

  /* ---------------- 思考·交流：方差怎样变化 ---------------- */
  M.slide({
    id: 's613-props', sec: '6.1', lesson: L, kind: '思考·交流', title: '方差会怎样变化？', layout: 'split even',
    html: function () {
      return '' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">（1）丁又射击了几次：平均数没变，方差变小了</div>' +
        '    <p class="small ink2">点按钮给丁“再射一次”，观察平均数与方差。丁后面几次射击的成绩有什么特点？</p>' +
        '    <div class="btn-row" id="shotBtns"></div>' +
        '    <div class="fig" id="dingFig"></div>' +
        '    <div class="row between"><div id="dingStats" class="grow"></div><button type="button" class="btn sm" id="dingReset">' + M.icon('reset') + '重来</button></div>' +
        '    <p class="small" data-step="1"><b class="green">特点：</b>新增的成绩要紧靠平均数 8 环（或者高低成对出现），离差小，才能使平均数不变而方差变小。</p>' +
        '  </div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">（2）<span class="chip acc">拓展</span>把一组数据都加上或都乘同一个数</div>' +
        '    <div class="fig" id="shiftFig"></div>' +
        '    <div id="shiftSliders" class="sliders"></div>' +
        '    <div id="shiftStats"></div>' +
        '    <p class="small" data-step="2">每个数据都加上 <i class="v">a</i>：平均数也加上 <i class="v">a</i>，方差不变（波动情况不变）；每个数据都乘 <i class="v">k</i>：平均数乘 <i class="v">k</i>，方差乘 <i class="v">k</i><sup>2</sup>，标准差乘 |<i class="v">k</i>|。</p>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      /* (1) 丁再射几次 */
      var shots = DING.slice();
      var svg = M.canvas(M.$('#dingFig', body), 600, 220);
      var sy = M.charts.scale(5, 11, 190, 20);
      [6, 7, 8, 9, 10].forEach(function (v) {
        S('line', { 'class': 'gridline dash', x1: 40, x2: 590, y1: sy(v), y2: sy(v) }, svg);
        S('text', { x: 32, y: sy(v) + 5, 'text-anchor': 'end', 'font-size': 14, 'class': 't-num', text: v }, svg);
      });
      S('line', { x1: 40, x2: 590, y1: sy(8), y2: sy(8), stroke: 'var(--red)', 'stroke-width': 2, 'stroke-dasharray': '8 6' }, svg);
      var gD = S('g', {}, svg);
      var dStats = M.W.stats(M.$('#dingStats', body), [
        { key: 'n', label: '次数', d: 0 },
        { key: 'm', label: '平均数', d: 2 },
        { key: 'v', label: '方差', cls: 'acc', d: 3 }
      ]);
      function drawD(anim) {
        while (gD.firstChild) gD.removeChild(gD.firstChild);
        var step = Math.min(40, 540 / shots.length);
        shots.forEach(function (v, i) {
          var c = S('circle', { cx: 56 + i * step, cy: sy(v), r: 7, fill: i < 12 ? 'var(--s4)' : 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': 2 }, gD);
          if (anim && i === shots.length - 1) A.tween({ dur: 500, ease: 'outBack', update: function (e) { c.setAttribute('r', 7 * e); } });
        });
        dStats.set('n', shots.length); dStats.set('m', st.mean(shots)); dStats.set('v', st.variance(shots), { flash: anim });
      }
      [6, 7, 8, 9, 10].forEach(function (v) {
        var b = M.el('button', { type: 'button', 'class': 'btn sm', text: '再射 ' + v + ' 环' });
        b.addEventListener('click', function () { if (shots.length >= 24) return M.toast('最多再射 12 次'); shots.push(v); drawD(true); });
        M.$('#shotBtns', body).appendChild(b);
      });
      M.$('#dingReset', body).addEventListener('click', function () { shots = DING.slice(); drawD(false); });
      drawD(false);

      /* (2) 平移与伸缩 */
      var base = [2, 3, 3, 4, 5, 7];
      var P = { a: 0, k: 1 };
      var ssvg = M.canvas(M.$('#shiftFig', body), 600, 170);
      var sx = M.charts.scale(-6, 26, 30, 580);
      S('line', { 'class': 'axis', x1: 20, x2: 590, y1: 120, y2: 120 }, ssvg);
      M.range(-5, 25, 5).forEach(function (v) {
        S('line', { 'class': 'axis', x1: sx(v), x2: sx(v), y1: 120, y2: 126 }, ssvg);
        S('text', { x: sx(v), y: 144, 'text-anchor': 'middle', 'font-size': 14, 'class': 't-num', text: M.fmt(v, 0) }, ssvg);
      });
      var ghost = base.map(function (v) { return S('circle', { cx: sx(v), cy: 70, r: 6, fill: 'none', stroke: 'var(--ink-3)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }, ssvg); });
      var dots = base.map(function (v, i) { return S('circle', { cx: sx(v), cy: 104 - (i % 2) * 14, r: 8, fill: 'var(--accent)', opacity: 0.85 }, ssvg); });
      S('text', { x: 24, y: 74, 'font-size': 13, text: '原数据' }, ssvg);
      var mk = S('path', { d: 'M0 0 l-7 12 h14 z', fill: 'var(--red)' }, ssvg);
      var shStats = M.W.stats(M.$('#shiftStats', body), [
        { key: 'm', label: '平均数', d: 2 },
        { key: 'v', label: '方差', cls: 'acc', d: 2 },
        { key: 'sd', label: '标准差', d: 2 }
      ]);
      function drawS() {
        var arr = base.map(function (v) { return P.k * v + P.a; });
        arr.forEach(function (v, i) { dots[i].setAttribute('cx', sx(v)); });
        var m = st.mean(arr);
        mk.setAttribute('transform', 'translate(' + sx(m) + ',122)');
        shStats.set('m', m); shStats.set('v', st.variance(arr)); shStats.set('sd', st.sd(arr));
      }
      M.W.slider(M.$('#shiftSliders', body), { label: '每个数都加 <i class="v">a</i>', min: -5, max: 10, step: 1, value: 0, fmt: function (v) { return M.signed(v, 0); }, input: function (v) { P.a = v; drawS(); } });
      M.W.slider(M.$('#shiftSliders', body), { label: '每个数都乘 <i class="v">k</i>', min: 0.5, max: 3, step: 0.5, value: 1, fmt: function (v) { return '×' + M.fmt(v, 1); }, input: function (v) { P.k = v; drawS(); } });
      drawS();
      return {};
    }
  });
})(window.M);
