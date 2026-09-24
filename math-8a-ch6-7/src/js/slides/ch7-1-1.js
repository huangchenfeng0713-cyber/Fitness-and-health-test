/* 7.1 认识证明 · 第1课时 为什么要证明 */
(function (M) {
  'use strict';
  var S = M.svg, G = M.geo, st = M.stats;
  var L = '第1课时 为什么要证明';

  /* ---------------- 眼见一定为实吗 ---------------- */
  M.slide({
    id: 's711-illusion', sec: '7.1', lesson: L, kind: '观察·思考', title: '眼见一定为实吗？', layout: 'full', cls: 'slide-illus',
    html: function () {
      var card = function (id, q) {
        return '<div class="illus"><div class="q">' + q + '</div><div class="fig" id="' + id + '"></div>' +
          '<div class="row between"><span class="ans" id="' + id + 'Ans"></span><button type="button" class="btn sm" id="' + id + 'Btn">' + M.icon('ruler') + '量一量</button></div></div>';
      };
      return '<div class="illus-grid four">' +
        card('il1', '（1）线段 <i class="v">a</i> 与 <i class="v">b</i> 一样长吗？') +
        card('il2', '（2）图中的四边形是正方形吗？') +
        card('il3', '（3）两条横线段一样长吗？') +
        card('il4', '（4）<i class="v">a</i>，<i class="v">b</i>，<i class="v">c</i> 中哪一条和 <i class="v">d</i> 在同一条直线上？') +
        '</div>' +
        '<div class="row"><div class="bubble">眼睛与直觉有时也会欺骗你哟！先观察，再动手检验。</div></div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var reveals = [];
      function btn(id, fn) {
        var b = M.$('#' + id + 'Btn', body), done = false;
        b.addEventListener('click', function () { if (done) return; done = true; b.disabled = true; fn(); });
        reveals.push(function () { if (!done) { done = true; b.disabled = true; fn(); } });
      }
      /* (1) 竖直线段与水平线段 */
      (function () {
        var svg = M.canvas(M.$('#il1', body), 300, 220);
        S('line', { x1: 70, x2: 230, y1: 190, y2: 190, 'class': 'line' }, svg);
        S('line', { x1: 150, x2: 150, y1: 190, y2: 30, 'class': 'line' }, svg);
        M.label(svg, 160, 44, '{a}', { 'font-size': 20 });
        M.label(svg, 66, 180, '{b}', { 'font-size': 20 });
        var copy = S('line', { x1: 150, x2: 150, y1: 190, y2: 30, stroke: 'var(--red)', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0 }, svg);
        btn('il1', function () {
          A.tween({ dur: 1300, ease: 'inOutCubic', update: function (e) {
            var cx = 150, cy = M.lerp(110, 190, e), ang = 90 * (1 - e);
            var p1 = G.polar({ x: cx, y: cy }, 80, ang), p2 = G.polar({ x: cx, y: cy }, 80, ang + 180);
            M.attr(copy, { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, opacity: Math.min(1, e * 4) });
          } }).promise.then(function (ok) { if (ok !== false) M.$('#il1Ans', body).innerHTML = '一样长！竖直的线段看起来更长。'; });
        });
      })();
      /* (2) 同心圆上的正方形 */
      (function () {
        var svg = M.canvas(M.$('#il2', body), 300, 220);
        var gc = S('g', {}, svg);
        for (var r = 10; r <= 105; r += 9.5) S('circle', { cx: 150, cy: 110, r: r, fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 1.6 }, gc);
        var sq = S('rect', { x: 90, y: 50, width: 120, height: 120, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 3 }, svg);
        var chk = S('g', { opacity: 0 }, svg);
        [[90, 50, 0], [210, 50, 90], [210, 170, 180], [90, 170, 270]].forEach(function (c) {
          var v = { x: c[0], y: c[1] };
          var a0 = { 0: 270, 90: 180, 180: 90, 270: 0 }[c[2]];
          var p = S('path', { d: G.rightMark(v, a0, a0 + 90, 13), fill: 'none', stroke: 'var(--red)', 'stroke-width': 2.2 }, chk);
        });
        btn('il2', function () {
          A.tween({ dur: 900, update: function (e) { gc.setAttribute('opacity', 1 - 0.85 * e); chk.setAttribute('opacity', e); sq.style.stroke = 'var(--red)'; } }).promise.then(function (ok) {
            if (ok !== false) M.$('#il2Ans', body).innerHTML = '是正方形！四条边都是直的，四个角都是直角。';
          });
        });
      })();
      /* (3) 缪勒-莱尔错觉 */
      (function () {
        var svg = M.canvas(M.$('#il3', body), 300, 220);
        function seg(y, outward) {
          var g = S('g', {}, svg);
          S('line', { x1: 80, x2: 220, y1: y, y2: y, 'class': 'line' }, g);
          var fins = S('g', {}, g);
          [[80, 1], [220, -1]].forEach(function (e) {
            var dx = outward ? -e[1] * 22 : e[1] * 22;
            S('path', { d: 'M' + (e[0] + dx) + ' ' + (y - 20) + ' L' + e[0] + ' ' + y + ' L' + (e[0] + dx) + ' ' + (y + 20), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, fins);
          });
          return fins;
        }
        var f1 = seg(65, true), f2 = seg(160, false);
        var guides = S('g', { opacity: 0 }, svg);
        [80, 220].forEach(function (x) { S('line', { x1: x, x2: x, y1: 30, y2: 195, stroke: 'var(--red)', 'stroke-width': 2, 'stroke-dasharray': '6 5' }, guides); });
        btn('il3', function () {
          A.tween({ dur: 900, update: function (e) { f1.setAttribute('opacity', 1 - 0.8 * e); f2.setAttribute('opacity', 1 - 0.8 * e); guides.setAttribute('opacity', e); } }).promise.then(function (ok) {
            if (ok !== false) M.$('#il3Ans', body).innerHTML = '一样长！两端的“箭头”干扰了我们的判断。';
          });
        });
      })();
      /* (4) 波根多夫错觉 */
      (function () {
        var svg = M.canvas(M.$('#il4', body), 300, 220);
        var slope = -0.5;
        var y = function (x, x0, y0) { return y0 + slope * (x - x0); };
        S('line', { x1: 20, x2: 128, y1: y(20, 128, 132), y2: 132, 'class': 'line' }, svg);
        S('rect', { x: 128, y: 14, width: 62, height: 196, fill: 'var(--surface-3)', stroke: 'var(--ink-2)', 'stroke-width': 2 }, svg);
        M.label(svg, 26, y(20, 128, 132) - 12, '{d}', { 'font-size': 20 });
        var cands = [{ nm: 'a', y0: 74 }, { nm: 'b', y0: 101 }, { nm: 'c', y0: 128 }];
        cands.forEach(function (c) {
          S('line', { x1: 190, x2: 272, y1: c.y0, y2: y(272, 190, c.y0), 'class': 'line' }, svg);
          M.label(svg, 280, y(272, 190, c.y0) + 6, '{' + c.nm + '}', { 'font-size': 19 });
        });
        var ruler = S('line', { x1: 20, y1: y(20, 128, 132), x2: 20, y2: y(20, 128, 132), stroke: 'var(--red)', 'stroke-width': 3, 'stroke-dasharray': '8 6', 'stroke-linecap': 'round' }, svg);
        btn('il4', function () {
          var x0 = 20, y0 = y(20, 128, 132), x1 = 280, y1 = y(280, 128, 132);
          A.tween({ dur: 1300, ease: 'inOutCubic', update: function (e) { M.attr(ruler, { x2: M.lerp(x0, x1, e), y2: M.lerp(y0, y1, e) }); } }).promise.then(function (ok) {
            if (ok !== false) M.$('#il4Ans', body).innerHTML = '是 <i class="v">b</i>！用直尺一比就清楚了。';
          });
        });
      })();
      return {
        steps: 4,
        onStep: function (n) { for (var i = 0; i < n; i++) reveals[i](); }
      };
    },
    steps: 4
  });

  /* ---------------- 地球赤道的铁丝 ---------------- */
  M.slide({
    id: 's711-earth', sec: '7.1', lesson: L, kind: '观察·思考', title: '铁丝比赤道长 1 m，间隙有多大？', layout: 'split',
    html: function () {
      var R = '<i class="v">R</i>';
      return '' +
        '<div class="col scroll">' +
        '  <p class="lead">把地球看成球形，假如用一根比地球赤道长 1 m 的铁丝将地球赤道围起来，铁丝与地球赤道之间的间隙能有多大？能放进一个拳头吗？</p>' +
        '  <p class="small ink2">先凭感觉想象一下，再具体算一算，看看与你的感觉是否一致。</p>' +
        '  <div class="proof" style="gap:.2rem">' +
        '    <div class="pline" data-step="1"><span class="sym">设</span><span class="st">地球半径为 ' + R + ' m，则赤道长 2π' + R + ' m，铁丝长 (2π' + R + ' + 1) m。</span><span></span></div>' +
        '    <div class="pline" data-step="2"><span class="sym"></span><span class="st">铁丝围成的圆的半径为 ' + M.frac('2π' + R + ' + 1', '2π') + ' = ' + R + ' + ' + M.frac('1', '2π') + '（m）。</span><span></span></div>' +
        '    <div class="pline" data-step="3"><span class="sym"></span><span class="st">间隙 = ' + M.frac('1', '2π') + ' ≈ <b>0.16 m</b>，约 16 cm，<b>能放进一个拳头</b>！</span><span></span></div>' +
        '  </div>' +
        '  <div class="box note" data-step="4"><span class="tag">更惊奇</span><p>间隙 ' + M.frac('1', '2π') + ' m 与半径 ' + R + ' 无关！把地球换成篮球、乒乓球，间隙都一样。直觉在这里完全失灵了。</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">换一个球试试<span class="hint">铁丝都比球的“赤道”长 1 m</span></div>' +
        '    <div class="btn-row" id="ballBtns"></div>' +
        '    <div class="fig" id="earthFig"></div>' +
        '    <div id="earthStats" class="textual-stats"></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var balls = [
        { nm: '乒乓球', R: 0.02 }, { nm: '篮球', R: 0.12 }, { nm: '摩天轮', R: 60 }, { nm: '地球', R: 6371000 }
      ];
      var gap = 1 / (2 * Math.PI);
      var svg = M.canvas(M.$('#earthFig', body), 720, 330);
      var c = { x: 175, y: 170 }, Rout = 140;
      var wire = S('circle', { cx: c.x, cy: c.y, r: Rout, fill: 'none', stroke: 'var(--amber)', 'stroke-width': 3, 'stroke-dasharray': '2 0' }, svg);
      var ball = S('circle', { cx: c.x, cy: c.y, r: 60 }, svg);
      ball.style.fill = 'var(--s1-tint)'; ball.style.stroke = 'var(--s1)'; ball.style.strokeWidth = 2.5;
      var ballT = S('text', { x: c.x, y: c.y + 6, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, 'class': 't-ink' }, svg);
      S('text', { x: c.x, y: 326, 'text-anchor': 'middle', 'font-size': 14, text: '整体（按比例画）' }, svg);
      /* 放大镜：间隙与拳头 */
      var zx = 380, zy = 30;
      S('rect', { x: zx, y: zy, width: 320, height: 270, rx: 16, fill: 'var(--surface-2)', stroke: 'var(--line-2)', 'stroke-width': 1.5 }, svg);
      S('text', { x: zx + 160, y: zy + 26, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, 'class': 't-ink', text: '放大看间隙（1 cm = 8 px）' }, svg);
      var ground = zy + 236, px = 8;
      S('path', { d: 'M' + (zx + 20) + ' ' + ground + ' h280', stroke: 'var(--s1)', 'stroke-width': 5 }, svg);
      S('text', { x: zx + 30, y: ground + 22, 'font-size': 13, text: '球面（赤道）' }, svg).style.fill = 'var(--s1)';
      var wireY = ground - gap * 100 * px;
      S('path', { d: 'M' + (zx + 20) + ' ' + wireY + ' h280', stroke: 'var(--amber)', 'stroke-width': 4 }, svg);
      S('text', { x: zx + 30, y: wireY - 10, 'font-size': 13, text: '铁丝' }, svg).style.fill = 'var(--amber)';
      S('line', { x1: zx + 250, x2: zx + 250, y1: wireY, y2: ground, stroke: 'var(--red)', 'stroke-width': 2, 'marker-start': '' }, svg);
      S('text', { x: zx + 258, y: (wireY + ground) / 2 + 5, 'font-size': 15, 'font-weight': 700, text: '≈ 15.9 cm' }, svg).style.fill = 'var(--red)';
      /* 拳头（约 10 cm 高） */
      var fist = S('g', { transform: 'translate(' + (zx + 150) + ',' + ground + ')' }, svg);
      var fh = 10 * px, fw = 9 * px;
      S('rect', { x: -fw / 2, y: -fh, width: fw, height: fh, rx: 16, fill: '#E9B78F', stroke: '#B97A4E', 'stroke-width': 2 }, fist);
      for (var k = 0; k < 4; k++) S('path', { d: 'M' + (-fw / 2 + 4 + k * (fw - 8) / 4) + ' ' + (-fh + 18) + ' q' + ((fw - 8) / 8) + ' -14 ' + ((fw - 8) / 4) + ' 0', fill: 'none', stroke: '#B97A4E', 'stroke-width': 2 }, fist);
      S('text', { x: 0, y: -fh / 2 + 6, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, text: '拳头' }, fist).style.fill = '#6B3F22';
      S('text', { x: zx + 150 - fw / 2 - 8, y: ground - fh / 2 + 5, 'text-anchor': 'end', 'font-size': 13, 'class': 't-ink', text: '约 10 cm' }, svg);
      var stats = M.W.stats(M.$('#earthStats', body), [
        { key: 'r', label: '球的半径 <i class="v">R</i>' },
        { key: 'c', label: '赤道长 2π<i class="v">R</i>' },
        { key: 'g', label: '间隙', cls: 'acc' }
      ]);
      function human(m) {
        if (m >= 1000) return M.fmt(m / 1000, 1) + ' km';
        if (m >= 1) return M.fmt(m, 2) + ' m';
        return M.fmt(m * 100, 1) + ' cm';
      }
      var cur = null;
      function pick(i, animate) {
        var b = balls[i];
        M.$$('#ballBtns .btn', body).forEach(function (x, j) { x.classList.toggle('on', j === i); });
        var target = Rout * b.R / (b.R + gap);
        var from = cur == null ? target : cur;
        cur = target;
        ballT.textContent = b.nm;
        A.tween({ dur: animate ? 900 : 0, ease: 'inOutCubic', update: function (e) { ball.setAttribute('r', Math.max(3, M.lerp(from, target, e))); } });
        ballT.setAttribute('y', target < 30 ? c.y - target - 14 : c.y + 6);
        stats.set('r', human(b.R)); stats.set('c', human(2 * Math.PI * b.R)); stats.set('g', '1 ÷ 2π ≈ 0.159 m');
      }
      balls.forEach(function (b, i) {
        var x = M.el('button', { type: 'button', 'class': 'btn sm', text: b.nm });
        x.addEventListener('click', function () { pick(i, true); });
        M.$('#ballBtns', body).appendChild(x);
      });
      pick(3, false);
      return { onStep: function (n) { if (n >= 4) pick(1, true); else pick(3, true); } };
    }
  });

  /* ---------------- 归纳的陷阱 ---------------- */
  var EXPRS = [
    { key: 'a', tex: '<i class="v">n</i><sup>2</sup> − <i class="v">n</i> + 11', claim: '都是质数', f: function (n) { return n * n - n + 11; }, ok: st.isPrime, start: 0, note: '取 <i class="v">n</i> = 0，1，2，3，4，5 试一试' },
    { key: 'b', tex: '<i class="v">n</i><sup>2</sup> + 3<i class="v">n</i> + 1', claim: '都是质数', f: function (n) { return n * n + 3 * n + 1; }, ok: st.isPrime, start: 1, note: '<i class="v">n</i> 为正整数' },
    { key: 'c', tex: '<i class="v">n</i><sup>2</sup> + <i class="v">n</i> + 41', claim: '都是质数', f: function (n) { return n * n + n + 41; }, ok: st.isPrime, start: 0, note: '前 40 个值全是质数' },
    { key: 'd', tex: '<i class="v">n</i><sup>4</sup> − 6<i class="v">n</i><sup>3</sup> + 11<i class="v">n</i><sup>2</sup> − 6<i class="v">n</i>', claim: '都等于 0', f: function (n) { return Math.pow(n, 4) - 6 * Math.pow(n, 3) + 11 * n * n - 6 * n; }, ok: function (v) { return v === 0; }, start: 0, note: '代入 0，1，2 都得 0' }
  ];
  M.slide({
    id: 's711-induce', sec: '7.1', lesson: L, kind: '尝试·思考', title: '试了很多次都对，就一定对吗？', layout: 'split lab-wide',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p>代数式 <i class="v">n</i><sup>2</sup> − <i class="v">n</i> + 11 的值是质数吗？取 <i class="v">n</i> = 0，1，2，3，4，5 试一试，你能否由此得到结论“对于所有自然数 <i class="v">n</i>，<i class="v">n</i><sup>2</sup> − <i class="v">n</i> + 11 的值都是质数”？</p>' +
        '  <div class="box note" data-step="1"><span class="tag">反例</span><p><i class="v">n</i> = 11 时，11<sup>2</sup> − 11 + 11 = 121 = 11 × 11，不是质数。</p><p class="small">前面试过的都对，也不能保证后面都对。</p></div>' +
        '  <div class="box think" data-step="2"><span class="tag">再试试</span><p class="small">右边还有三个式子：<br>· 当 <i class="v">n</i> 为正整数时，<i class="v">n</i><sup>2</sup> + 3<i class="v">n</i> + 1 的值一定是质数吗？<br>· 有同学把 <i class="v">n</i> = 1，2，…，39 代入 <i class="v">n</i><sup>2</sup> + <i class="v">n</i> + 41，发现都是质数。<br>· 把 <i class="v">n</i> = 0，1，2 代入 <i class="v">n</i><sup>4</sup> − 6<i class="v">n</i><sup>3</sup> + 11<i class="v">n</i><sup>2</sup> − 6<i class="v">n</i>，结果都是 0。</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="row between"><div id="exprSeg"></div></div>' +
        '    <div class="claim" id="claim"></div>' +
        '    <div class="ntiles" id="ntiles"></div>' +
        '    <div class="row between"><div class="btn-row"><button type="button" class="btn primary" id="runN">' + M.icon('play') + '逐个检验</button><button type="button" class="btn" id="stepN">' + M.icon('plus') + '再试一个</button><button type="button" class="btn ghost" id="resetN">' + M.icon('reset') + '重来</button></div><span class="small ink2" id="nMsg"></span></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var cur = 0, n = 0, timer = 0, found = false;
      var tiles = M.$('#ntiles', body), msg = M.$('#nMsg', body);
      function reset() {
        clearInterval(timer); timer = 0;
        var e = EXPRS[cur];
        n = e.start; found = false;
        tiles.innerHTML = '';
        M.$('#claim', body).innerHTML = '猜想：当 <i class="v">n</i> = ' + e.start + '，' + (e.start + 1) + '，' + (e.start + 2) + '，… 时，' + e.tex + ' 的值' + e.claim + '<span class="muted small">（' + e.note + '）</span>';
        msg.textContent = '';
        M.$('#runN', body).disabled = false; M.$('#stepN', body).disabled = false;
      }
      function one() {
        if (found) return false;
        var e = EXPRS[cur], v = e.f(n), ok = e.ok(v);
        var t = M.el('div', { 'class': 'ntile ' + (ok ? 'ok' : 'bad'), html: '<small>n = ' + n + '</small><b>' + v + '</b>' + (ok ? '' : '<em>' + (e.key === 'd' ? '≠ 0' : '= ' + st.factor(v).join(' × ')) + '</em>') });
        tiles.appendChild(t);
        if (t.animate) t.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
        tiles.scrollTop = tiles.scrollHeight;
        if (!ok) {
          found = true;
          msg.innerHTML = '<b class="red">反例：n = ' + n + '</b>，猜想不成立！';
          M.$('#runN', body).disabled = true; M.$('#stepN', body).disabled = true;
          clearInterval(timer); timer = 0;
        } else {
          msg.textContent = '已检验 ' + (n - e.start + 1) + ' 个，都符合……';
        }
        n++;
        return !found;
      }
      function run() {
        if (timer || found) return;
        var speed = cur === 2 ? 90 : 260;
        timer = setInterval(function () { if (!one()) { clearInterval(timer); timer = 0; } }, speed * M.motion);
      }
      M.W.seg(M.$('#exprSeg', body), EXPRS.map(function (e) { return e.tex; }), function (i) { cur = i; reset(); });
      M.$('#runN', body).addEventListener('click', run);
      M.$('#stepN', body).addEventListener('click', one);
      M.$('#resetN', body).addEventListener('click', reset);
      reset();
      return {
        onStep: function (k) { if (k >= 1 && cur === 0 && !found) { if (!timer) run(); } },
        leave: function () { clearInterval(timer); timer = 0; }
      };
    }
  });

  /* ---------------- 量了很多三角形，能肯定吗 ---------------- */
  M.slide({
    id: 's711-midline', sec: '7.1', lesson: L, kind: '尝试·思考', title: '量了很多个三角形，就能肯定吗？', layout: 'split',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p>如图，在 △<span class="m">ABC</span> 中，点 <span class="m">D</span>，<span class="m">E</span> 分别是 <span class="m">AB</span>，<span class="m">AC</span> 的中点，连接 <span class="m">DE</span>。</p>' +
        '  <p><span class="m">DE</span> 与 <span class="m">BC</span> 有怎样的位置关系和数量关系？请先猜一猜，再拖动顶点检验你的猜想。</p>' +
        '  <div class="box think" data-step="1"><span class="tag">猜想</span><p><span class="m">DE</span> ∥ <span class="m">BC</span>，<span class="m">DE</span> = ' + M.frac('1', '2') + '<span class="m">BC</span>。</p></div>' +
        '  <div class="box note" data-step="2"><span class="tag">追问</span><p>你能肯定这个结论对<b>所有的</b>△<span class="m">ABC</span> 都成立吗？</p>' +
        '    <p class="small">三角形有无数个，再多的测量也只检验了有限个；测量还有误差。要确认它对所有三角形都成立，必须进行证明（这个结论以后我们会证明）。</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">拖动三个顶点<span class="hint" id="triCount">已检验 1 个三角形</span></div>' +
        '    <div class="fig drag-zone" id="midFig"></div>' +
        '    <div class="row between"><button type="button" class="btn" id="rand20">' + M.icon('shuffle') + '随机检验 20 个</button><div id="midStats" class="grow" style="max-width:36rem"></div></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var svg = M.canvas(M.$('#midFig', body), 660, 380);
      var P = { A: { x: 250, y: 50 }, B: { x: 90, y: 330 }, C: { x: 560, y: 330 } };
      var tri = S('path', { fill: 'var(--accent-tint)', stroke: 'var(--ink)', 'stroke-width': 2.6, 'stroke-linejoin': 'round' }, svg);
      var de = S('line', { stroke: 'var(--red)', 'stroke-width': 3.2 }, svg);
      var bc = S('line', { stroke: 'var(--s1)', 'stroke-width': 4.5, 'stroke-linecap': 'round', opacity: 0.6 }, svg);
      var dots = {}, labs = {};
      ['D', 'E'].forEach(function (k) { dots[k] = S('circle', { r: 5.5, fill: 'var(--red)' }, svg); labs[k] = M.label(svg, 0, 0, '{' + k + '}', { 'font-size': 20, 'text-anchor': 'middle' }); });
      var ticks = S('g', {}, svg);
      var handles = {};
      ['A', 'B', 'C'].forEach(function (k) {
        labs[k] = M.label(svg, 0, 0, '{' + k + '}', { 'font-size': 21, 'text-anchor': 'middle' });
        handles[k] = M.handle(svg, P[k].x, P[k].y, { r: 10 });
        M.drag(handles[k], { svg: svg, move: function (p) { P[k] = { x: M.clamp(p.x, 20, 640), y: M.clamp(p.y, 20, 360) }; draw(); }, end: function () { count++; draw(); } });
      });
      var stats = M.W.stats(M.$('#midStats', body), [
        { key: 'de', label: '<span class="m">DE</span>', d: 1 },
        { key: 'bc', label: '<span class="m">BC</span>', d: 1 },
        { key: 'r', label: '<span class="m">DE</span> : <span class="m">BC</span>', d: 3, cls: 'acc' },
        { key: 'a', label: '<span class="m">DE</span> 与 <span class="m">BC</span> 夹角', d: 1 }
      ]);
      var count = 1;
      function tick(p, q) {
        var m = G.mid(p, q), d = G.dir(p, q);
        var a = G.polar(m, 7, d + 90), b = G.polar(m, 7, d - 90);
        S('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: 'var(--ink)', 'stroke-width': 2 }, ticks);
      }
      function draw() {
        var D = G.mid(P.A, P.B), E = G.mid(P.A, P.C);
        tri.setAttribute('d', 'M' + P.A.x + ' ' + P.A.y + ' L' + P.B.x + ' ' + P.B.y + ' L' + P.C.x + ' ' + P.C.y + ' Z');
        M.attr(de, { x1: D.x, y1: D.y, x2: E.x, y2: E.y });
        M.attr(bc, { x1: P.B.x, y1: P.B.y, x2: P.C.x, y2: P.C.y });
        M.attr(dots.D, { cx: D.x, cy: D.y }); M.attr(dots.E, { cx: E.x, cy: E.y });
        var cen = { x: (P.A.x + P.B.x + P.C.x) / 3, y: (P.A.y + P.B.y + P.C.y) / 3 };
        function out(p, k, dist) { var d = G.dir(cen, p); var q = G.polar(p, dist, d); M.attr(labs[k], { x: q.x, y: q.y + 7 }); }
        out(P.A, 'A', 26); out(P.B, 'B', 26); out(P.C, 'C', 26); out(D, 'D', 22); out(E, 'E', 22);
        ['A', 'B', 'C'].forEach(function (k) { handles[k].move(P[k].x, P[k].y); });
        while (ticks.firstChild) ticks.removeChild(ticks.firstChild);
        tick(P.A, D); tick(D, P.B); tick(P.A, E); tick(E, P.C);
        var dl = G.dist(D, E) / 10, bl = G.dist(P.B, P.C) / 10;
        var ang = Math.abs(G.norm(G.dir(D, E) - G.dir(P.B, P.C)));
        if (ang > 180) ang = 360 - ang;
        stats.set('de', dl); stats.set('bc', bl); stats.set('r', bl ? dl / bl : 0); stats.set('a', Math.min(ang, 180 - ang));
        M.$('#triCount', body).textContent = '已检验 ' + count + ' 个三角形';
      }
      M.$('#rand20', body).addEventListener('click', function () {
        var k = 0;
        var go = function () {
          if (k >= 20 || !api.isActive()) return;
          var from = { A: P.A, B: P.B, C: P.C };
          var to = { A: { x: 60 + Math.random() * 540, y: 30 + Math.random() * 140 }, B: { x: 30 + Math.random() * 250, y: 220 + Math.random() * 130 }, C: { x: 380 + Math.random() * 250, y: 200 + Math.random() * 150 } };
          A.tween({ dur: 220, ease: 'inOutCubic', update: function (e) {
            ['A', 'B', 'C'].forEach(function (q) { P[q] = { x: M.lerp(from[q].x, to[q].x, e), y: M.lerp(from[q].y, to[q].y, e) }; });
            draw();
          }, done: function () { count++; k++; draw(); go(); } });
        };
        go();
      });
      draw();
      return {};
    }
  });

  /* ---------------- 思考·交流：为什么要证明 ---------------- */
  M.slide({
    id: 's711-why', sec: '7.1', lesson: L, kind: '思考·交流', title: '观察、实验、归纳得到的结论都正确吗？', layout: 'full',
    html: function () {
      var c = function (t, d, tag, cls) { return '<div class="why-card ' + (cls || '') + '"><b>' + t + '</b><p>' + d + '</p><span class="chip ' + (cls === 'bad' ? 'bad' : 'ok') + '">' + tag + '</span></div>'; };
      return '' +
        '<div class="why-flow">' +
        '  <div class="why-col">' +
        '    <h3>观察 · 实验 · 归纳</h3>' +
        c('看错觉图', '竖线看起来更长，其实一样长', '眼见不一定为实', 'bad') +
        c('铁丝与赤道', '直觉说间隙很小，其实约 16 cm', '直觉可能出错', 'bad') +
        c('代入 <i class="v">n</i> 检验', '前面几个都成立，<i class="v">n</i> = 11 时就不成立', '有限次验证不够', 'bad') +
        c('测量三角形', '量再多也是有限个，还有测量误差', '测不完', 'bad') +
        '  </div>' +
        '  <div class="why-arrow" aria-hidden="true">' + M.icon('arrow') + '</div>' +
        '  <div class="why-col main">' +
        '    <h3>有理有据的证明</h3>' +
        '    <div class="box thm"><span class="tag">结论</span><p>观察、实验、归纳得到的结论可能正确，也可能不正确。因此，要判断一个数学结论是否正确，仅仅依靠观察、实验、归纳是不够的，必须进行<span class="hl">有理有据的证明</span>。</p></div>' +
        '    <div class="box think" data-step="1"><span class="tag">怎样说明一个结论不正确</span><p>举出一个<b>反例</b>就够了，例如 <i class="v">n</i> = 11。</p></div>' +
        '    <div class="box think" data-step="2"><span class="tag">怎样说明一个结论正确</span><p>观察、实验、归纳可以帮我们<b>发现</b>结论，但要<b>确认</b>结论对所有情况都成立，必须证明。</p></div>' +
        '  </div>' +
        '</div>';
    }
  });
})(window.M);
