/* 6.1 平均数与方差 · 第4课时 方差的应用 */
(function (M) {
  'use strict';
  var S = M.svg, st = M.stats;
  var L = '第4课时 方差的应用';

  var JUMP = {
    jia: [603, 598, 606, 601, 597, 604, 600, 602, 599, 600],
    yi: [614, 588, 620, 580, 611, 592, 618, 585, 606, 596]
  };

  /* ---------------- 选拔运动员 ---------------- */
  M.slide({
    id: 's614-jump', sec: '6.1', lesson: L, kind: '尝试·思考', title: '选谁去参加跳远比赛？', layout: 'split',
    html: function () {
      var row = function (nm, a) { return '<tr><td><b>' + nm + '</b></td>' + a.map(function (v) { return '<td class="num">' + v + '</td>'; }).join('') + '</tr>'; };
      return '' +
        '<div class="col scroll">' +
        '  <p>某校要从甲、乙两名跳远运动员中挑选一人参加比赛。在最近 10 次选拔赛中，他们的成绩（单位：cm）如下：</p>' +
        '  <div class="table-wrap"><table class="data small-t"><tr><th>次序</th>' + M.range(1, 10).map(function (i) { return '<th>' + i + '</th>'; }).join('') + '</tr>' + row('甲', JUMP.jia) + row('乙', JUMP.yi) + '</table></div>' +
        '  <ol class="qlist">' +
        '    <li>甲、乙的平均成绩分别是多少？<span class="ans" data-step="1">甲、乙都是 <b>601 cm</b>。</span></li>' +
        '    <li>甲、乙这 10 次成绩的方差分别是多少？<span class="ans" data-step="2"><i class="v">s</i><sub>甲</sub><sup>2</sup> = <b>7</b>，<i class="v">s</i><sub>乙</sub><sup>2</sup> = <b>191.6</b>。</span></li>' +
        '    <li>这两名运动员的成绩各有什么特点？<span class="ans" data-step="3">平均水平相同；甲的成绩很稳定，乙的成绩忽高忽低，但最好成绩更高。</span></li>' +
        '    <li>历届比赛表明，成绩达到 5.96 m 就很可能夺冠，为了夺冠应选谁？如果成绩达到 6.15 m 才能打破纪录，为了打破纪录应选谁？<span class="ans" data-step="4">夺冠选<b>甲</b>（10 次都超过 5.96 m）；破纪录选<b>乙</b>（只有乙跳出过 6.15 m 以上）。</span></li>' +
        '  </ol>' +
        '  <p class="small ink2" data-step="4">方差小说明稳定，但“稳定”并不总是唯一标准：要结合具体目标作决策。</p>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">10 次选拔赛成绩<span class="hint">拖动横线，数一数谁达标的次数多</span></div>' +
        '    <div class="fig drag-zone" id="jumpFig"></div>' +
        '    <div class="row between"><div class="btn-row"><button type="button" class="btn sm" id="bWin">夺冠线 5.96 m</button><button type="button" class="btn sm" id="bRec">纪录线 6.15 m</button></div><div id="jumpStats" class="grow" style="max-width:24rem"></div></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var W = 720, H = 380, x0 = 70, x1 = 690;
      var svg = M.canvas(M.$('#jumpFig', body), W, H);
      var sy = M.charts.scale(575, 625, 330, 30);
      var sx = function (i) { return x0 + 40 + i * (x1 - x0 - 80) / 9; };
      M.charts.axis(svg, { orient: 'y', scale: sy, at: x0, ticks: [575, 585, 595, 605, 615, 625], grid: [x0, x1], gridDash: true, fmt: function (v) { return v; }, fontSize: 14, label: '成绩/cm', labelAnchor: 'start', labelDx: -30 });
      S('line', { 'class': 'axis', x1: x0, x2: x1, y1: 330, y2: 330 }, svg);
      M.range(0, 9).forEach(function (i) { S('text', { x: sx(i), y: 352, 'text-anchor': 'middle', 'font-size': 13, text: '第' + (i + 1) + '次' }, svg); });
      var series = [{ k: 'jia', nm: '甲', c: 'var(--s1)' }, { k: 'yi', nm: '乙', c: 'var(--s2)' }];
      series.forEach(function (s) {
        var pts = JUMP[s.k].map(function (v, i) { return sx(i) + ',' + sy(v); }).join(' ');
        var pl = S('polyline', { points: pts, fill: 'none', 'stroke-width': 3, 'stroke-linejoin': 'round' }, svg);
        pl.style.stroke = s.c;
        s.dots = JUMP[s.k].map(function (v, i) {
          var c = S('circle', { cx: sx(i), cy: sy(v), r: 6.5, 'stroke-width': 2.5 }, svg);
          c.style.stroke = s.c; c.style.fill = 'var(--surface)';
          return { c: c, v: v };
        });
        var last = JUMP[s.k][9];
        var t = S('text', { x: x1 - 6, y: sy(last) + (s.k === 'jia' ? -12 : 20), 'text-anchor': 'end', 'font-size': 16, 'font-weight': 800, text: s.nm }, svg);
        t.style.fill = s.c;
      });
      var gl = S('g', {}, svg);
      var tl = S('line', { x1: x0, x2: x1, stroke: 'var(--red)', 'stroke-width': 2.4, 'stroke-dasharray': '9 6' }, gl);
      var tlab = S('text', { x: x0 + 34, 'font-size': 15, 'font-weight': 700 }, gl);
      tlab.style.fill = 'var(--red)';
      var th = M.handle(gl, x0 + 16, 0, { color: 'var(--red)', r: 10 });
      var stats = M.W.stats(M.$('#jumpStats', body), [
        { key: 'j', label: '甲 达标次数', d: 0, cls: 's1' },
        { key: 'y', label: '乙 达标次数', d: 0, cls: 's2' }
      ]);
      var thr = 596;
      function place(v) {
        thr = M.clamp(Math.round(v), 576, 624);
        var y = sy(thr);
        M.attr(tl, { y1: y, y2: y });
        M.attr(tlab, { y: y - 8, text: '达标线 ' + thr + ' cm' });
        th.move(x0 + 16, y);
        var cnt = {};
        series.forEach(function (s) {
          cnt[s.k] = 0;
          s.dots.forEach(function (d) {
            var ok = d.v >= thr;
            if (ok) cnt[s.k]++;
            d.c.style.fill = ok ? s.c : 'var(--surface)';
          });
        });
        stats.set('j', cnt.jia); stats.set('y', cnt.yi);
      }
      function animateTo(v) { var from = thr; A.tween({ dur: 600, ease: 'inOutCubic', update: function (e) { place(M.lerp(from, v, e)); } }); }
      M.drag(th, { svg: svg, move: function (p) { place(sy.inv(p.y)); } });
      M.$('#bWin', body).addEventListener('click', function () { animateTo(596); });
      M.$('#bRec', body).addEventListener('click', function () { animateTo(615); });
      place(596);
      return { onStep: function (n) { if (n === 4) animateTo(615); } };
    }
  });

  /* ---------------- 分组：组内离差平方和最小 ---------------- */
  var ORANGES = [73, 62, 79, 66, 75, 81, 65, 78, 67, 76];
  M.slide({
    id: 's614-group', sec: '6.1', lesson: L, kind: '思考·交流', title: '怎样把橙子按大小分成两组？', layout: 'split',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p>10 个橙子的直径（单位：mm）如下：<br><span class="num">73，62，79，66，75，81，65，78，67，76</span></p>' +
        '  <ol class="qlist">' +
        '    <li>若想把这 10 个橙子分成两组，使每组橙子的“个头”差不多，你想怎么分？说说理由。</li>' +
        '    <li>一般地，要把一组数据分成若干组，使每组组内的数据差距不大，而组与组之间差别明显，应该遵循怎样的原则？</li>' +
        '  </ol>' +
        '  <div class="box def" data-step="1"><span class="tag">分组原则</span><p>在统计学里，分组的方法有很多，其中较常用的方法是使“<span class="hl">组内离差平方和达到最小</span>”。</p><p class="small">多组数据的组内离差平方和，是指每组数据的离差平方和的和：<i class="v">S</i> = <i class="v">S</i><sub>1</sub> + <i class="v">S</i><sub>2</sub>。</p></div>' +
        '  <div class="box ex" data-step="2"><span class="tag">解</span><p class="small">① 把 10 个数据从小到大排序；② 分成两组共有 9 种情况，逐一计算组内离差平方和；③ 取最小的一种。</p>' +
        '    <p class="small" data-step="3">第一组 4 个、第二组 6 个时，<i class="v">S</i> = 14 + 42 = <b>56</b> 最小。两组为 {62，65，66，67}，{73，75，76，78，79，81}。</p></div>' +
        '  <p class="tiny muted" data-step="3">解决实际问题时，组内离差平方和可以利用计算机软件求得，从而更快捷地完成分组。</p>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">拖动分隔线试一试<span class="hint">分隔线只能放在相邻两个数据之间</span></div>' +
        '    <div class="tiles" id="orTiles"></div>' +
        '    <div class="fig drag-zone" id="groupFig"></div>' +
        '    <div class="row between"><div class="btn-row"><button type="button" class="btn sm" id="bSort">' + M.icon('sort') + '从小到大排序</button><button type="button" class="btn sm" id="bAll">' + M.icon('grid') + '算出全部 9 种情况</button></div><div id="grStats" class="grow" style="max-width:25rem"></div></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var sorted = st.sorted(ORANGES);
      var tilesEl = M.$('#orTiles', body);
      var tiles = ORANGES.map(function (v) { var t = M.el('div', { 'class': 'tile', text: v }); tilesEl.appendChild(t); return t; });
      var isSorted = false;
      function sortTiles(v) {
        if (v === isSorted) return;
        isSorted = v;
        var first = tiles.map(function (t) { return t.getBoundingClientRect(); });
        var order = v ? tiles.slice().sort(function (a, b) { return +a.textContent - +b.textContent; }) : tiles.slice();
        order.forEach(function (t) { tilesEl.appendChild(t); });
        tiles.forEach(function (t, i) {
          var last = t.getBoundingClientRect();
          if (t.animate) t.animate([{ transform: 'translate(' + (first[i].left - last.left) + 'px,' + (first[i].top - last.top) + 'px)' }, { transform: 'none' }], { duration: 650 * M.motion, easing: 'cubic-bezier(.2,.8,.2,1)' });
        });
        M.$('#bSort', body).classList.toggle('on', v);
      }
      M.$('#bSort', body).addEventListener('click', function () { sortTiles(!isSorted); });

      var W = 720, H = 360;
      var svg = M.canvas(M.$('#groupFig', body), W, H);
      var sx = M.charts.scale(60, 84, 40, 690), lineY = 110;
      S('line', { 'class': 'axis', x1: 30, x2: 700, y1: lineY, y2: lineY }, svg);
      M.range(60, 84, 2).forEach(function (v) {
        S('line', { 'class': 'axis', x1: sx(v), x2: sx(v), y1: lineY, y2: lineY + 6 }, svg);
        S('text', { x: sx(v), y: lineY + 24, 'text-anchor': 'middle', 'font-size': 13, 'class': 't-num', text: v }, svg);
      });
      S('text', { x: 700, y: lineY + 44, 'text-anchor': 'end', 'font-size': 13, text: '直径/mm' }, svg);
      var dots = sorted.map(function (v) {
        var c = S('circle', { cx: sx(v), cy: lineY - 22, r: 13, 'stroke-width': 2 }, svg);
        var t = S('text', { x: sx(v), y: lineY - 48, 'text-anchor': 'middle', 'font-size': 14, 'class': 't-num t-ink', text: v }, svg);
        return { c: c, t: t, v: v };
      });
      var m1 = S('path', { d: 'M0 0 l-7 12 h14 z' }, svg), m2 = S('path', { d: 'M0 0 l-7 12 h14 z' }, svg);
      m1.style.fill = 'var(--s1)'; m2.style.fill = 'var(--s2)';
      var gDiv = S('g', {}, svg);
      S('line', { x1: 0, x2: 0, y1: 8, y2: lineY + 10, stroke: 'var(--ink)', 'stroke-width': 3, 'stroke-dasharray': '6 5' }, gDiv);
      var dh = M.handle(gDiv, 0, 8, { r: 11 });
      /* 9 种情况的柱状图 */
      var bx0 = 70, bx1 = 690, by0 = 330, by1 = 190;
      var ssAll = M.range(1, 9).map(function (k) { return st.ss(sorted.slice(0, k)) + st.ss(sorted.slice(k)); });
      var maxS = Math.max.apply(null, ssAll);
      var bsy = M.charts.scale(0, 350, by0, by1);
      S('text', { x: bx0 - 10, y: by1 - 12, 'font-size': 13, text: '组内离差平方和 S' }, svg);
      S('line', { 'class': 'axis', x1: bx0 - 10, x2: bx1, y1: by0, y2: by0 }, svg);
      var band = (bx1 - bx0) / 9;
      var bars = ssAll.map(function (v, i) {
        var cx = bx0 + band * (i + 0.5);
        var r = S('rect', { x: cx - band * 0.32, width: band * 0.64, y: by0, height: 0, rx: 3, fill: 'var(--line-2)' }, svg);
        var t = S('text', { x: cx, y: by0 - 6, 'text-anchor': 'middle', 'font-size': 13, 'class': 't-num t-ink', text: '' }, svg);
        S('text', { x: cx, y: by0 + 18, 'text-anchor': 'middle', 'font-size': 12, text: (i + 1) + '|' + (9 - i) }, svg);
        return { r: r, t: t, v: v, shown: false };
      });
      S('text', { x: bx1, y: by0 + 36, 'text-anchor': 'end', 'font-size': 12, text: '第一组个数 | 第二组个数' }, svg);
      var stats = M.W.stats(M.$('#grStats', body), [
        { key: 's1', label: '<i class="v">S</i><sub>1</sub>（第一组）', d: 2, cls: 's1' },
        { key: 's2', label: '<i class="v">S</i><sub>2</sub>（第二组）', d: 2, cls: 's2' },
        { key: 's', label: '<i class="v">S</i> = <i class="v">S</i><sub>1</sub> + <i class="v">S</i><sub>2</sub>', d: 2, cls: 'acc' }
      ]);
      var k = 2;
      var best = ssAll.indexOf(Math.min.apply(null, ssAll)) + 1;
      function showBar(i, animate) {
        var b = bars[i];
        var top = bsy(b.v);
        if (!b.shown) {
          b.shown = true;
          if (animate) A.tween({ dur: 500, ease: 'outBack', update: function (e) { M.attr(b.r, { y: M.lerp(by0, top, e), height: (by0 - top) * e }); } });
          else M.attr(b.r, { y: top, height: by0 - top });
          b.t.textContent = M.fmt(b.v, 2);
        }
        var allShown = bars.every(function (x) { return x.shown; });
        bars.forEach(function (x, j) { x.r.style.fill = j === k - 1 ? 'var(--accent)' : (allShown && j === best - 1 ? 'var(--marker)' : 'var(--line-2)'); });
      }
      function setK(nk, animate) {
        k = M.clamp(nk, 1, 9);
        var g1 = sorted.slice(0, k), g2 = sorted.slice(k);
        dots.forEach(function (d, i) {
          var inFirst = i < k;
          d.c.style.fill = inFirst ? 'var(--s1-tint)' : 'var(--s2-tint)';
          d.c.style.stroke = inFirst ? 'var(--s1)' : 'var(--s2)';
        });
        var xDiv = (sx(sorted[k - 1]) + sx(sorted[k])) / 2;
        gDiv.setAttribute('transform', 'translate(' + xDiv + ',0)');
        m1.setAttribute('transform', 'translate(' + sx(st.mean(g1)) + ',' + (lineY + 30) + ')');
        m2.setAttribute('transform', 'translate(' + sx(st.mean(g2)) + ',' + (lineY + 30) + ')');
        stats.set('s1', st.ss(g1)); stats.set('s2', st.ss(g2)); stats.set('s', st.ss(g1) + st.ss(g2));
        showBar(k - 1, animate);
      }
      M.drag(dh, { svg: svg, move: function (p) {
        var nk = 1;
        for (var i = 1; i < sorted.length; i++) { if (p.x > (sx(sorted[i - 1]) + sx(sorted[i])) / 2) nk = i; }
        if (nk !== k) setK(nk, true);
      } });
      M.$('#bAll', body).addEventListener('click', function () {
        bars.forEach(function (b, i) { setTimeout(function () { showBar(i, true); }, i * 90); });
        setTimeout(function () { setK(best, true); M.toast('第一组 ' + best + ' 个时，组内离差平方和最小：' + M.fmt(ssAll[best - 1], 2), 2600); }, 900);
      });
      setK(2, false);
      return {
        onStep: function (n) {
          if (n >= 2) sortTiles(true);
          if (n >= 3) { bars.forEach(function (b, i) { showBar(i, true); }); setK(best, true); }
        }
      };
    }
  });

  /* ---------------- 随堂练习 ---------------- */
  M.slide({
    id: 's614-practice', sec: '6.1', lesson: L, kind: '随堂练习', kindCls: 'k-practice', title: '方差练一练', layout: 'full',
    html: function () {
      return '' +
        '<div class="practice-grid">' +
        '  <div class="box practice"><span class="tag">1</span><p>甲、乙两支仪仗队队员的身高（单位：cm）如下：</p>' +
        '    <p class="num small">甲队：177，178，178，179，178，177，178，179，178，178<br>乙队：178，176，180，177，179，178，181，175，178，178</p>' +
        '    <p>哪支仪仗队队员的身高更为整齐？你是怎么判断的？</p>' +
        '    <button type="button" class="btn sm reveal-btn" data-reveal="p1"></button>' +
        '    <div class="answer" id="p1">两队的平均身高都是 178 cm。<br><i class="v">s</i><sub>甲</sub><sup>2</sup> = ' + M.frac('1+0+0+1+0+1+0+1+0+0', '10') + ' = 0.4，<i class="v">s</i><sub>乙</sub><sup>2</sup> = ' + M.frac('0+4+4+1+1+0+9+9+0+0', '10') + ' = 2.8。<br>∵ <i class="v">s</i><sub>甲</sub><sup>2</sup> &lt; <i class="v">s</i><sub>乙</sub><sup>2</sup>，∴ <b class="ok">甲队队员的身高更整齐</b>。</div></div>' +
        '  <div class="box practice"><span class="tag">2</span><p>学校要选派一名跳高运动员参赛，甲、乙两人 6 次选拔赛成绩（单位：m）如下：</p>' +
        '    <p class="num small">甲：1.70，1.68，1.72，1.69，1.71，1.70<br>乙：1.62，1.75，1.66，1.78，1.64，1.75</p>' +
        '    <p>（1）两人的平均成绩分别是多少？谁更稳定？（2）若跳过 1.65 m 就很可能夺冠，选谁？若要跳过 1.75 m 才能夺冠呢？</p>' +
        '    <button type="button" class="btn sm reveal-btn" data-reveal="p2"></button>' +
        '    <div class="answer" id="p2">（1）平均成绩都是 1.70 m；<i class="v">s</i><sub>甲</sub><sup>2</sup> ≈ 0.000 17，<i class="v">s</i><sub>乙</sub><sup>2</sup> ≈ 0.003 8，<b class="ok">甲更稳定</b>。<br>（2）1.65 m 就能夺冠时选<b class="ok">甲</b>（6 次都超过）；要 1.75 m 才能夺冠时选<b class="ok">乙</b>（乙有 3 次达到，甲一次也没有）。</div></div>' +
        '</div>';
    },
    mount: function (body) {
      M.$$('[data-reveal]', body).forEach(function (b) { M.W.reveal(b, M.$('#' + b.getAttribute('data-reveal'), body)); });
      return {};
    }
  });
})(window.M);
