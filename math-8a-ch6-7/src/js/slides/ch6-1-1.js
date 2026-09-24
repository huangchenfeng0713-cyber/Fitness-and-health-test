/* 6.1 平均数与方差 · 第1课时 众数与算术平均数 */
(function (M) {
  'use strict';
  var S = M.svg, st = M.stats;
  var L = '第1课时 众数与算术平均数';

  /* 四名选手 12 次射击的成绩频数（6~10 环） */
  var SHOOTERS = [
    { nm: '甲', c: 'var(--s1)', f: [1, 2, 6, 2, 1] },
    { nm: '乙', c: 'var(--s2)', f: [2, 5, 3, 1, 1] },
    { nm: '丙', c: 'var(--s3)', f: [1, 1, 3, 5, 2] },
    { nm: '丁', c: 'var(--s4)', f: [4, 1, 2, 1, 4] }
  ];
  var RINGS = [6, 7, 8, 9, 10];
  M.data = M.data || {};
  M.data.shooters = SHOOTERS;

  /* ---------------- 情境：谁的射击成绩最好 ---------------- */
  M.slide({
    id: 's611-shoot', sec: '6.1', lesson: L, kind: '情境引入', title: '谁的射击成绩最好？', layout: 'split lab-wide',
    html: function () {
      var rows = SHOOTERS.map(function (p) {
        var a = st.expand(RINGS, p.f), md = st.modes(a).values.join(' 和 ');
        return '<tr><td><b style="color:' + p.c + '">' + p.nm + '</b></td><td class="num">' + md + '</td><td class="num">' + st.sum(a) + '</td><td class="num"><b>' + M.fmt(st.mean(a), 2) + '</b></td></tr>';
      }).join('');
      return '' +
        '<div class="col scroll">' +
        '  <p class="lead">在某次射击训练中，甲、乙、丙、丁四人各射击 12 次，成绩如右图所示。</p>' +
        '  <ol class="qlist">' +
        '    <li>观察统计图，甲的哪个射击成绩出现的次数最多？其他选手呢？</li>' +
        '    <li>不计算，请你先猜一猜：谁的射击成绩最好？你是怎么判断的？</li>' +
        '    <li>算一算，验证你的判断是否正确。</li>' +
        '  </ol>' +
        '  <div class="box think" data-step="1"><span class="tag">观察</span><p>出现次数最多的成绩：甲 <b>8</b> 环，乙 <b>7</b> 环，丙 <b>9</b> 环；丁的 <b>6</b> 环和 <b>10</b> 环都出现了 4 次，一样多。</p></div>' +
        '  <div class="table-wrap" data-step="2"><table class="data"><tr><th>选手</th><th>出现最多的成绩/环</th><th>总环数</th><th>平均成绩/环</th></tr>' + rows + '</table></div>' +
        '  <p class="small ink2" data-step="2">丙的平均成绩最高。甲和丁的平均成绩都是 8 环，两人的表现一样吗？我们在第 3 课时再来研究。</p>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">四人射击成绩统计图<span class="hint">横轴：成绩/环　纵轴：次数</span></div>' +
        '    <div class="shoot-grid" id="shootGrid"></div>' +
        '    <div class="btn-row"><button type="button" class="btn sm" id="btnMode">' + M.icon('eye') + '标出出现最多的成绩</button><button type="button" class="btn sm" id="btnMean">' + M.icon('ruler') + '画出平均成绩</button></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim, grid = M.$('#shootGrid', body);
      var charts = SHOOTERS.map(function (p) {
        var cell = M.el('div', { 'class': 'shoot-cell' });
        cell.innerHTML = '<div class="nm"><span style="color:' + p.c + '">' + p.nm + '</span><span class="tag-s" data-t></span></div><div class="fig"></div>';
        grid.appendChild(cell);
        var svg = M.canvas(M.$('.fig', cell), 400, 222);
        var ch = M.charts.freqBars(svg, { x: 40, y: 24, w: 350, h: 130, values: RINGS, counts: p.f, max: 6, yStep: 2, color: p.c, fontSize: 16, anim: A, animate: false, maxBar: 52 });
        ch.bars.forEach(function (b) { b.rect.setAttribute('opacity', 0.55); });
        var arr = st.expand(RINGS, p.f), mean = st.mean(arr), modes = st.modes(arr).values;
        var X = function (v) { return 40 + ch.band * (v - 6 + 0.5); };
        var gMean = S('g', { opacity: 0 }, svg);
        var ml = S('line', { x1: X(mean), x2: X(mean), y1: 154, y2: 154, stroke: 'var(--ink)', 'stroke-width': 2.2, 'stroke-dasharray': '6 4' }, gMean);
        S('path', { d: 'M' + X(mean) + ' 176 l-6 10 h12 z', fill: 'var(--ink)' }, gMean);
        var mlab = S('text', { x: X(mean), y: 210, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, 'class': 't-ink', text: '平均 ' + M.fmt(mean, 2) }, gMean);
        var modeLabs = modes.map(function (v) {
          var b = ch.bars[RINGS.indexOf(v)];
          var t = S('text', { x: b.cx, y: ch.sy(p.f[RINGS.indexOf(v)]) + 22, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, opacity: 0, text: '最多' }, svg);
          t.style.fill = '#fff';
          return t;
        });
        return { p: p, ch: ch, cell: cell, mean: mean, modes: modes, gMean: gMean, ml: ml, mlab: mlab, modeLabs: modeLabs };
      });
      var showMode = false, showMean = false;
      function setMode(v) {
        showMode = v;
        M.$('#btnMode', body).classList.toggle('on', v);
        charts.forEach(function (c) {
          c.ch.bars.forEach(function (b, i) {
            var isMode = c.modes.indexOf(RINGS[i]) >= 0;
            A.tween({ dur: 400, update: function (e) { b.rect.setAttribute('opacity', v ? (isMode ? 0.55 + 0.45 * e : 0.55 - 0.3 * e) : 0.55); } });
          });
          c.modeLabs.forEach(function (t) { A.tween({ dur: 400, update: function (e) { t.setAttribute('opacity', v ? e : 0); } }); });
          updateTag(c);
        });
      }
      function setMean(v) {
        showMean = v;
        M.$('#btnMean', body).classList.toggle('on', v);
        charts.forEach(function (c, i) {
          if (!v) { c.gMean.setAttribute('opacity', 0); updateTag(c); return; }
          c.gMean.setAttribute('opacity', 1);
          A.tween({ dur: 650, delay: i * 120, ease: 'outCubic', update: function (e) { c.ml.setAttribute('y1', 154 - 130 * e); c.mlab.setAttribute('opacity', e); } });
          updateTag(c);
        });
      }
      function updateTag(c) {
        var t = [];
        if (showMode) t.push('最多：<b>' + c.modes.join('、') + '</b>');
        if (showMean) t.push('平均：<b>' + M.fmt(c.mean, 2) + '</b>');
        M.$('[data-t]', c.cell).innerHTML = t.join('　');
      }
      M.$('#btnMode', body).addEventListener('click', function () { setMode(!showMode); });
      M.$('#btnMean', body).addEventListener('click', function () { setMean(!showMean); });
      return {
        onStep: function (n) { if ((n >= 1) !== showMode) setMode(n >= 1); if ((n >= 2) !== showMean) setMean(n >= 2); },
        enter: function () { charts.forEach(function (c, i) { c.ch.set(c.p.f.map(function () { return 0; }), false); c.ch.set(c.p.f, true); }); }
      };
    }
  });

  /* ---------------- 概念：众数与算术平均数 ---------------- */
  M.slide({
    id: 's611-def', sec: '6.1', lesson: L, kind: '概念', title: '众数与算术平均数',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <div class="box def"><span class="tag">众数</span><p>一组数据中出现次数最多的那个数据叫作这组数据的<span class="hl">众数</span>。</p>' +
        '    <p class="small ink2">众数可以不止一个。例如，丁的射击成绩的众数是 6 环和 10 环。</p></div>' +
        '  <div class="box def"><span class="tag">算术平均数</span><p>一组数据中所有数据之和除以这组数据的个数，就得到这组数据的<span class="hl">算术平均数</span>，简称平均数。</p>' +
        '    <div class="formula">' + M.xbar() + '<span class="eq">=</span>' + M.frac('<i class="v">x</i><sub>1</sub> + <i class="v">x</i><sub>2</sub> + … + <i class="v">x<sub>n</sub></i>', '<i class="v">n</i>') + '</div>' +
        '    <p class="small ink2">' + M.xbar() + ' 读作“<span class="v">x</span> 拔”。平均数是刻画一组数据<b>集中趋势</b>的一项指标，反映了一组数据的“中心”。</p></div>' +
        '  <div class="box note" data-step="1"><span class="tag">小技巧</span><p>数据重复较多时，可以用“数据 × 次数”求总和：<br>甲的总环数 = 6×1 + 7×2 + 8×6 + 9×2 + 10×1 = 96。</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">动手算一算<span class="hint">先点一个数据块，再用 −1 / +1 修改</span></div>' +
        '    <div class="row between"><div id="presetSeg"></div><div class="btn-row">' +
        '      <button type="button" class="btn sm" id="tMinus">−1</button><button type="button" class="btn sm" id="tPlus">+1</button>' +
        '      <button type="button" class="btn sm" id="tAdd">' + M.icon('plus') + '添加</button><button type="button" class="btn sm" id="tDel">' + M.icon('minus') + '删除</button></div></div>' +
        '    <div class="tiles" id="tiles"></div>' +
        '    <div id="defStats"></div>' +
        '    <div class="formula-card"><div class="live-formula" id="lfMean"></div><div class="live-formula small" id="lfMode"></div></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var presets = {
        jia: [8, 7, 8, 9, 8, 6, 8, 10, 7, 8, 9, 8],
        ding: [10, 6, 8, 10, 6, 7, 10, 6, 9, 10, 8, 6]
      };
      var data = presets.jia.slice(), sel = 0;
      var tilesEl = M.$('#tiles', body);
      var stats = M.W.stats(M.$('#defStats', body), [
        { key: 'n', label: '个数 <i class="v">n</i>', d: 0 },
        { key: 'sum', label: '总和', d: 2 },
        { key: 'mean', label: '平均数 ' + M.xbar(), cls: 'acc', d: 2 },
        { key: 'mode', label: '众数', d: 2 }
      ]);
      M.W.seg(M.$('#presetSeg', body), ['甲的成绩', '丁的成绩'], function (i) {
        data = (i ? presets.ding : presets.jia).slice(); sel = 0; render(true);
      });
      function render(anim) {
        tilesEl.innerHTML = '';
        var md = st.modes(data);
        data.forEach(function (v, i) {
          var b = M.el('button', { type: 'button', 'class': 'tile' + (i === sel ? ' sel' : '') + (md.values.indexOf(v) >= 0 && !md.all ? ' mode' : ''), text: M.fmt(v, 1), 'aria-label': '第' + (i + 1) + '个数据 ' + v });
          b.addEventListener('click', function () { sel = i; render(false); });
          if (anim && b.animate) b.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: i * 25, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
          tilesEl.appendChild(b);
        });
        var n = data.length, sum = st.sum(data), mean = st.mean(data);
        stats.set('n', n);
        stats.set('sum', sum);
        stats.set('mean', mean);
        stats.set('mode', md.all ? '无明显众数' : md.values.map(function (v) { return M.fmt(v, 1); }).join('、'));
        var shown = data.length > 8 ? data.slice(0, 3).join(' + ') + ' + … + ' + data[data.length - 1] : data.join(' + ');
        M.$('#lfMean', body).innerHTML = n ? M.xbar() + ' = ' + M.frac(shown, n) + ' = ' + M.frac(M.fmt(sum, 2), n) + ' = <b>' + (Math.abs(mean * 100 - Math.round(mean * 100)) > 1e-9 ? '≈ ' : '') + M.fmt(mean, 2) + '</b>' : '';
        var f = st.freq(data), keys = Object.keys(f).map(Number).sort(function (a, b) { return a - b; });
        M.$('#lfMode', body).innerHTML = '<span class="cn">出现次数：</span>' + keys.map(function (k) {
          var on = md.values.indexOf(k) >= 0 && !md.all;
          return '<span class="' + (on ? 'hl on' : '') + '">' + M.fmt(k, 1) + '<span class="cn">（' + f[k] + '次）</span></span>';
        }).join('　');
      }
      function change(dv) { if (!data.length) return; data[sel] = M.clamp(Math.round((data[sel] + dv) * 10) / 10, 0, 10); render(false); }
      M.$('#tMinus', body).addEventListener('click', function () { change(-1); });
      M.$('#tPlus', body).addEventListener('click', function () { change(1); });
      M.$('#tAdd', body).addEventListener('click', function () { if (data.length >= 20) return M.toast('最多 20 个数据'); data.push(data[sel] != null ? data[sel] : 8); sel = data.length - 1; render(false); });
      M.$('#tDel', body).addEventListener('click', function () { if (data.length <= 1) return; data.splice(sel, 1); sel = Math.min(sel, data.length - 1); render(false); });
      render(false);
      return {};
    }
  });

  /* ---------------- 探究：移多补少 ---------------- */
  M.slide({
    id: 's611-level', sec: '6.1', lesson: L, kind: '探究', title: '移多补少：平均数是“拉平”后的高度', layout: 'split lab-wide',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p class="lead">5 名同学上周的课外阅读时间（单位：h）分别是 4，7，5，8，6。把多的“移”给少的，使每人一样多，每人是多少小时？</p>' +
        '  <div class="box def"><span class="tag">理解</span><p>平均数就是把各个数据“<span class="hl">移多补少</span>”之后，每份所得的大小：<br>多出的部分恰好补足缺少的部分。</p></div>' +
        '  <div class="box think" data-step="1"><span class="tag">思考·交流</span><p>一组数据的平均数一定是这组数据中的某个数吗？</p>' +
        '    <p class="small" data-step="2"><b class="green">不一定。</b>拖动柱子把数据改成 4，7，5，8，7，平均数变成 6.2，它不在这组数据中。</p></div>' +
        '  <p class="small muted">拖动柱子顶端的圆点可以修改数据。</p>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">课外阅读时间<span class="hint" id="lvHint">虚线为平均数</span></div>' +
        '    <div class="fig drag-zone" id="levelFig"></div>' +
        '    <div class="row between">' +
        '      <div class="btn-row"><button type="button" class="btn primary" id="btnLevel">' + M.icon('play') + '移多补少</button><button type="button" class="btn" id="btnReset">' + M.icon('reset') + '复原</button></div>' +
        '      <div id="lvStats" class="grow" style="max-width:22rem"></div>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var names = ['小明', '小红', '小刚', '小丽', '小华'];
      var init = [4, 7, 5, 8, 6];
      var data = init.slice();
      var W = 760, H = 420, x0 = 70, x1 = 640, y0 = 360, yTop = 52, maxV = 10;
      var svg = M.canvas(M.$('#levelFig', body), W, H);
      var sy = M.charts.scale(0, maxV, y0, yTop);
      M.charts.axis(svg, { orient: 'y', scale: sy, at: x0, ticks: M.range(0, 10, 2), grid: [x0, x1], gridDash: true, fmt: function (v) { return v; }, fontSize: 15, label: '时间/h', labelAnchor: 'start', labelDx: -24 });
      S('line', { 'class': 'axis', x1: x0, x2: x1, y1: y0, y2: y0 }, svg);
      var band = (x1 - x0) / data.length, bw = 78;
      var gBars = S('g', {}, svg), gPieces = S('g', {}, svg), gTop = S('g', {}, svg);
      var meanLine = S('line', { x1: x0, x2: x1, stroke: 'var(--red)', 'stroke-width': 2.5, 'stroke-dasharray': '10 7' }, gTop);
      var meanTxt = S('text', { x: x1 + 12, 'font-size': 17, 'font-weight': 700 }, gTop);
      meanTxt.style.fill = 'var(--red)';
      var meanT1 = S('tspan', { x: x1 + 12, dy: 0, text: '平均数' }, meanTxt), meanT2 = S('tspan', { x: x1 + 12, dy: 22 }, meanTxt);
      var bars = data.map(function (v, i) {
        var cx = x0 + band * (i + 0.5);
        var r = S('rect', { x: cx - bw / 2, width: bw, rx: 5, fill: 'var(--accent)', opacity: 0.88 }, gBars);
        var val = S('text', { x: cx, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 700, 'class': 't-num t-ink' }, gBars);
        S('text', { x: cx, y: y0 + 26, 'text-anchor': 'middle', 'font-size': 16, 'class': 't-ink', text: names[i] }, gBars);
        var h = M.handle(gTop, cx, sy(v), { label: names[i] + '的阅读时间' });
        var o = { i: i, cx: cx, rect: r, val: val, h: h, cur: v };
        M.drag(h, {
          svg: svg,
          start: function () { if (busy) return false; },
          move: function (p) {
            var nv = M.clamp(Math.round(sy.inv(p.y)), 1, maxV);
            if (nv !== data[i]) { data[i] = nv; o.cur = nv; draw(); }
          }
        });
        h.addEventListener('keydown', function (e) {
          if (busy) return;
          if (e.key === 'ArrowUp') { data[i] = Math.min(maxV, data[i] + 1); }
          else if (e.key === 'ArrowDown') { data[i] = Math.max(1, data[i] - 1); }
          else return;
          e.preventDefault(); e.stopPropagation(); o.cur = data[i]; draw();
        });
        return o;
      });
      var stats = M.W.stats(M.$('#lvStats', body), [
        { key: 'sum', label: '总时间', unit: 'h', d: 1 },
        { key: 'mean', label: '平均数 ' + M.xbar(), unit: 'h', cls: 'acc', d: 2 }
      ]);
      var busy = false, leveled = false;
      function draw() {
        var m = st.mean(data);
        bars.forEach(function (b) {
          var v = b.cur;
          M.attr(b.rect, { y: sy(v), height: y0 - sy(v) });
          M.attr(b.val, { y: sy(v) - 32, text: M.fmt(v, 2) });
          b.h.move(b.cx, sy(v));
        });
        M.attr(meanLine, { y1: sy(m), y2: sy(m) });
        meanTxt.setAttribute('y', sy(m) - 4);
        meanT2.textContent = '= ' + M.fmt(m, 2) + ' h';
        stats.set('sum', st.sum(data));
        stats.set('mean', m);
      }
      draw();
      function clearPieces() { while (gPieces.firstChild) gPieces.removeChild(gPieces.firstChild); }
      function level() {
        if (busy || leveled) return;
        busy = true;
        bars.forEach(function (b) { b.h.style.display = 'none'; });
        var m = st.mean(data);
        var surplus = [], deficit = [];
        bars.forEach(function (b) {
          if (data[b.i] > m + 1e-9) surplus.push({ b: b, left: data[b.i] - m, used: 0 });
          else if (data[b.i] < m - 1e-9) deficit.push({ b: b, left: m - data[b.i], filled: 0 });
        });
        var moves = [];
        var si = 0, di = 0;
        while (si < surplus.length && di < deficit.length) {
          var s = surplus[si], d = deficit[di];
          var t = Math.min(s.left, d.left);
          moves.push({ from: s.b, to: d.b, lo: m + s.used, amt: t, dst: data[d.b.i] + d.filled });
          s.used += t; s.left -= t; d.filled += t; d.left -= t;
          if (s.left < 1e-9) si++;
          if (d.left < 1e-9) di++;
        }
        // 先把高出部分“切”下来
        var pieces = moves.map(function (mv) {
          var r = S('rect', { x: mv.from.cx - bw / 2, width: bw, y: sy(mv.lo + mv.amt), height: sy(mv.lo) - sy(mv.lo + mv.amt), rx: 4, fill: 'var(--marker)', stroke: 'var(--amber)', 'stroke-width': 1.5 }, gPieces);
          return { r: r, mv: mv };
        });
        surplus.forEach(function (s) {
          var b = s.b, from = data[b.i];
          A.tween({ dur: 300, update: function (e) { b.cur = from + (m - from) * e; M.attr(b.rect, { y: sy(b.cur), height: y0 - sy(b.cur) }); } });
          M.attr(b.val, { opacity: 0 });
        });
        deficit.forEach(function (d) { M.attr(d.b.val, { opacity: 0 }); });
        var chain = A.wait(420);
        pieces.forEach(function (p, k) {
          chain = chain.then(function (ok) {
            if (ok === false) return false;
            var mv = p.mv;
            var sx0 = mv.from.cx - bw / 2, sy0 = sy(mv.lo + mv.amt);
            var tx = mv.to.cx - bw / 2, ty = sy(mv.dst + mv.amt);
            var arcH = 70 + 20 * k;
            return A.tween({ dur: 900, ease: 'inOutCubic', update: function (e) {
              var x = M.lerp(sx0, tx, e), y = M.lerp(sy0, ty, e) - arcH * Math.sin(Math.PI * e);
              M.attr(p.r, { x: x, y: y });
            } }).promise;
          });
        });
        chain.then(function (ok) {
          if (ok === false) return;
          bars.forEach(function (b) { b.cur = m; M.attr(b.val, { opacity: 1, y: sy(m) - 12, text: M.fmt(m, 2) }); });
          leveled = true;
          busy = false;
          M.$('#lvHint', body).textContent = '每人都是 ' + M.fmt(m, 2) + ' h，正好等于平均数';
          A.tween({ dur: 700, update: function (e) { meanLine.setAttribute('stroke-width', 2.5 + 3 * Math.sin(Math.PI * e)); } });
        });
      }
      function reset(instant) {
        A.cancelAll();
        clearPieces();
        busy = false; leveled = false;
        bars.forEach(function (b) { b.cur = data[b.i]; b.h.style.display = ''; M.attr(b.val, { opacity: 1 }); });
        M.$('#lvHint', body).textContent = '虚线为平均数';
        draw();
      }
      M.$('#btnLevel', body).addEventListener('click', level);
      M.$('#btnReset', body).addEventListener('click', function () { reset(); });
      return {
        onStep: function (n) {
          if (n >= 2 && data.join() === init.join()) { data = [4, 7, 5, 8, 7]; reset(); }
          if (n < 2 && data.join() === '4,7,5,8,7') { data = init.slice(); reset(); }
        },
        leave: function () { if (busy) reset(); }
      };
    }
  });

  /* ---------------- 思考·交流：极端值 ---------------- */
  M.slide({
    id: 's611-extreme', sec: '6.1', lesson: L, kind: '思考·交流', title: '一个“意外”会怎样影响平均数？', layout: 'split even',
    html: function () {
      return '' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">（1）甲又射击一次，意外脱靶，成绩为 0 环</div>' +
        '    <div class="fig" id="exFig"></div>' +
        '    <div class="row between"><button type="button" class="btn" id="btnMiss">' + M.icon('plus') + '加入这次 0 环</button><div id="exStats" class="grow" style="max-width:17rem"></div></div>' +
        '    <p class="small ink2" data-step="1">平均数从 8 环降到约 7.38 环。一个远离其他数据的<b>极端值</b>就能把平均数“拉”过去：平均数容易受极端值的影响。</p>' +
        '  </div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">（2）7 位评委给一名选手打分（满分 10 分）</div>' +
        '    <div class="tiles judges" id="judges"></div>' +
        '    <div class="row between"><button type="button" class="btn" id="btnTrim">' + M.icon('minus') + '去掉一个最高分和一个最低分</button><div id="trimStats" class="grow" style="max-width:17rem"></div></div>' +
        '    <div class="box think"><span class="tag">思考·交流</span><p>比赛评分时，常常去掉一个最高分和一个最低分，再计算平均成绩。这样做有什么好处？</p>' +
        '      <p class="small" data-step="2"><b class="green">好处：</b>个别评委打分过高或过低（极端值）时，对最后成绩的影响被排除了，结果更公平、更能代表大多数评委的意见。</p></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      /* (1) 点图 + 平衡支点 */
      var jia = [8, 7, 8, 9, 8, 6, 8, 10, 7, 8, 9, 8];
      var svg = M.canvas(M.$('#exFig', body), 560, 300);
      var sx = M.charts.scale(0, 10, 40, 520), base = 196;
      S('line', { x1: 30, x2: 530, y1: base + 12, y2: base + 12, stroke: 'var(--ink)', 'stroke-width': 3, 'stroke-linecap': 'round' }, svg);
      M.range(0, 10, 1).forEach(function (v) {
        S('text', { x: sx(v), y: base + 64, 'text-anchor': 'middle', 'font-size': 15, 'class': 't-num', text: v }, svg);
      });
      S('text', { x: 540, y: base + 64, 'text-anchor': 'start', 'font-size': 13, text: '环' }, svg);
      var cnt = {};
      jia.forEach(function (v) {
        var k = cnt[v] = (cnt[v] || 0) + 1;
        S('circle', { cx: sx(v), cy: base - (k - 1) * 23, r: 10, fill: 'var(--s1)', opacity: 0.9 }, svg);
      });
      var miss = S('circle', { cx: sx(0), cy: -30, r: 10, fill: 'var(--red)', opacity: 0 }, svg);
      var ful = S('g', {}, svg);
      S('path', { d: 'M0 2 L-12 30 L12 30 Z', fill: 'var(--ink)' }, ful);
      var fulTxt = S('text', { x: 0, y: 86, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, 'class': 't-ink' }, ful);
      var exStats = M.W.stats(M.$('#exStats', body), [{ key: 'm', label: '平均数', unit: '环', cls: 'acc', d: 2 }]);
      var hasMiss = false, fx = st.mean(jia);
      function placeFul(m) { fx = m; ful.setAttribute('transform', 'translate(' + sx(m) + ',' + (base + 12) + ')'); fulTxt.textContent = '平均 ' + M.fmt(m, 2); }
      placeFul(8);
      exStats.set('m', 8);
      function setMiss(v) {
        hasMiss = v;
        M.$('#btnMiss', body).classList.toggle('on', v);
        M.$('#btnMiss', body).lastChild.textContent = v ? '撤回这次 0 环' : '加入这次 0 环';
        var arr = v ? jia.concat([0]) : jia;
        var m = st.mean(arr), from = fx;
        A.tween({ dur: 700, ease: 'outBack', update: function (e) { M.attr(miss, { cy: v ? M.lerp(-30, base, e) : M.lerp(base, -30, e), opacity: v ? Math.min(1, e * 2) : 1 - e }); } });
        A.tween({ dur: 900, delay: v ? 500 : 0, ease: 'outElastic', update: function (e) { placeFul(from + (m - from) * e); } });
        exStats.set('m', m, { flash: true });
      }
      M.$('#btnMiss', body).addEventListener('click', function () { setMiss(!hasMiss); });

      /* (2) 评委打分 */
      var scores = [9.1, 9.4, 9.3, 9.5, 9.6, 8.2, 9.9];
      var jEl = M.$('#judges', body);
      var tiles = scores.map(function (v, i) {
        var t = M.el('div', { 'class': 'tile judge', html: '<small>评委' + '一二三四五六七'[i] + '</small><span>' + M.fix(v, 1) + '</span>' });
        jEl.appendChild(t);
        return t;
      });
      var trimStats = M.W.stats(M.$('#trimStats', body), [{ key: 'm', label: '平均成绩', unit: '分', cls: 'acc', d: 2 }]);
      var trimmed = false;
      var maxI = scores.indexOf(Math.max.apply(null, scores)), minI = scores.indexOf(Math.min.apply(null, scores));
      function setTrim(v) {
        trimmed = v;
        M.$('#btnTrim', body).classList.toggle('on', v);
        tiles.forEach(function (t, i) {
          var out = v && (i === maxI || i === minI);
          t.classList.toggle('out', out);
          t.classList.toggle('extreme', i === maxI || i === minI);
        });
        var arr = v ? scores.filter(function (x, i) { return i !== maxI && i !== minI; }) : scores;
        trimStats.set('m', st.mean(arr), { flash: true });
      }
      setTrim(false);
      M.$('#btnTrim', body).addEventListener('click', function () { setTrim(!trimmed); });
      return {
        onStep: function (n) {
          if ((n >= 1) !== hasMiss) setMiss(n >= 1);
          if ((n >= 2) !== trimmed) setTrim(n >= 2);
        }
      };
    }
  });

  /* ---------------- 操作·思考：从统计图中读众数与平均数 ---------------- */
  M.slide({
    id: 's611-charts', sec: '6.1', lesson: L, kind: '操作·思考', title: '从统计图中获取众数和平均数', layout: 'split even',
    html: function () {
      return '' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">某文具店一种笔记本 10 天的销售量<span class="hint">拖动红色虚线，估计平均数</span></div>' +
        '    <div class="fig drag-zone" id="lineFig"></div>' +
        '    <div class="row between"><button type="button" class="btn sm" id="btnShowMean">' + M.icon('eye') + '显示平均数</button><span class="small ink2" id="guessTxt"></span></div>' +
        '    <p class="small" data-step="1">平均销售量 = (118 + 132 + 150 + 141 + 146 + 129 + 124 + 135 + 128 + 117) ÷ 10 = 1 320 ÷ 10 = <b>132</b>（件）。平均线以上多出的部分正好补足以下缺少的部分。</p>' +
        '  </div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">1 000 位顾客对店铺的评分</div>' +
        '    <div class="fig" id="pieFig"></div>' +
        '    <p class="small">评分的众数是多少？平均数呢？</p>' +
        '    <div class="formula-card" data-step="2"><p class="small">众数：<b>5 分</b>（占 80%，人数最多）</p>' +
        '      <p class="small">平均数 = 5×80% + 4×12% + 3×5% + 2×2% + 1×1% = <b>4.68</b>（分）</p>' +
        '      <p class="tiny muted">各评分所占的百分比，起到了“权”的作用 —— 下一课时学习加权平均数。</p></div>' +
        '  </div>' +
        '  <div class="box think" data-step="3"><span class="tag">回顾·反思</span><p class="small">条形统计图：最高的“条”对应众数；平均数 =（数据×次数）之和 ÷ 总次数。<br>扇形统计图：最大的扇形对应众数；平均数 = 各数据×所占百分比之和。<br>折线统计图：平均数可以看成把折线“移多补少”拉平后的高度。</p></div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var sales = [118, 132, 150, 141, 146, 129, 124, 135, 128, 117];
      var mean = st.mean(sales);
      var svg = M.canvas(M.$('#lineFig', body), 600, 330);
      var x0 = 64, x1 = 580, y0 = 280, y1 = 24;
      var sx = function (i) { return x0 + 22 + i * (x1 - x0 - 44) / 9; };
      var sy = M.charts.scale(100, 160, y0, y1);
      M.charts.axis(svg, { orient: 'y', scale: sy, at: x0, ticks: [100, 110, 120, 130, 140, 150, 160], grid: [x0, x1], gridDash: true, fmt: function (v) { return v; }, fontSize: 14, label: '销售量/件', labelAnchor: 'start', labelDx: -30 });
      S('line', { 'class': 'axis', x1: x0, x2: x1, y1: y0, y2: y0 }, svg);
      sales.forEach(function (v, i) { S('text', { x: sx(i), y: y0 + 22, 'text-anchor': 'middle', 'font-size': 13, text: '第' + (i + 1) + '天' }, svg); });
      var areaUp = S('path', { fill: 'var(--s2-tint)' }, svg), areaDn = S('path', { fill: 'var(--s1-tint)' }, svg);
      var pts = sales.map(function (v, i) { return [sx(i), sy(v)]; });
      var poly = S('polyline', { points: pts.map(function (p) { return p.join(','); }).join(' '), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3, 'stroke-linejoin': 'round' }, svg);
      pts.forEach(function (p, i) {
        S('circle', { cx: p[0], cy: p[1], r: 5.5, fill: 'var(--surface)', stroke: 'var(--accent)', 'stroke-width': 2.5 }, svg);
        S('text', { x: p[0], y: p[1] - 12, 'text-anchor': 'middle', 'font-size': 13, 'class': 't-num t-ink', text: sales[i] }, svg);
      });
      var gl = S('g', {}, svg);
      var guessLine = S('line', { x1: x0, x2: x1, stroke: 'var(--red)', 'stroke-width': 2.2, 'stroke-dasharray': '8 6' }, gl);
      var guessLab = S('text', { x: x1 - 4, 'text-anchor': 'end', 'font-size': 14, fill: 'var(--red)', 'font-weight': 700 }, gl);
      var gh = M.handle(gl, x0 + 16, 0, { color: 'var(--red)', r: 10 });
      var meanG = S('g', { opacity: 0 }, svg);
      var meanLine = S('line', { x1: x0, x2: x1, y1: sy(mean), y2: sy(mean), stroke: 'var(--ink)', 'stroke-width': 2.6 }, meanG);
      S('text', { x: x1 - 4, y: sy(mean) - 8, 'text-anchor': 'end', 'font-size': 15, 'font-weight': 700, 'class': 't-ink', text: '平均数 132' }, meanG);
      var guess = 108;
      function placeGuess(v) {
        guess = M.clamp(v, 100, 160);
        var y = sy(guess);
        M.attr(guessLine, { y1: y, y2: y });
        M.attr(guessLab, { y: y - 8, text: '估计 ' + Math.round(guess) });
        gh.move(x0 + 16, y);
        M.$('#guessTxt', body).textContent = '你的估计：' + Math.round(guess) + ' 件';
      }
      placeGuess(108);
      M.drag(gh, { svg: svg, move: function (p) { placeGuess(Math.round(sy.inv(p.y))); } });
      function areaPaths() {
        var ym = sy(mean);
        // 以平均线为界，分别填充上方与下方
        var up = 'M' + x0 + ' ' + ym, dn = up;
        var pp = pts.map(function (p) { return { x: p[0], y: p[1] }; });
        var segs = [];
        for (var i = 0; i < pp.length - 1; i++) {
          var a = pp[i], b = pp[i + 1];
          segs.push(a);
          if ((a.y - ym) * (b.y - ym) < 0) { var t = (ym - a.y) / (b.y - a.y); segs.push({ x: a.x + t * (b.x - a.x), y: ym }); }
        }
        segs.push(pp[pp.length - 1]);
        up = 'M' + segs[0].x + ' ' + ym + ' ' + segs.map(function (q) { return 'L' + q.x + ' ' + Math.min(q.y, ym); }).join(' ') + ' L' + segs[segs.length - 1].x + ' ' + ym + ' Z';
        dn = 'M' + segs[0].x + ' ' + ym + ' ' + segs.map(function (q) { return 'L' + q.x + ' ' + Math.max(q.y, ym); }).join(' ') + ' L' + segs[segs.length - 1].x + ' ' + ym + ' Z';
        return { up: up, dn: dn };
      }
      var ap = areaPaths();
      var shown = false;
      function showMean(v) {
        shown = v;
        M.$('#btnShowMean', body).classList.toggle('on', v);
        if (v) { areaUp.setAttribute('d', ap.up); areaDn.setAttribute('d', ap.dn); }
        A.tween({ dur: 500, update: function (e) { var o = v ? e : 1 - e; meanG.setAttribute('opacity', o); areaUp.setAttribute('opacity', o); areaDn.setAttribute('opacity', o); } });
        if (v) M.$('#guessTxt', body).textContent = '你的估计：' + Math.round(guess) + ' 件，实际平均数：132 件';
      }
      areaUp.setAttribute('opacity', 0); areaDn.setAttribute('opacity', 0);
      M.$('#btnShowMean', body).addEventListener('click', function () { showMean(!shown); });

      /* 扇形图 */
      var psvg = M.canvas(M.$('#pieFig', body), 520, 270);
      var parts = [
        { v: 80, color: 'var(--s1)', label: '5分 80%', legend: '5 分：800 人，80%' },
        { v: 12, color: 'var(--s3)', label: '12%', legend: '4 分：120 人，12%' },
        { v: 5, color: 'var(--s2)', legend: '3 分：50 人，5%' },
        { v: 2, color: 'var(--s4)', legend: '2 分：20 人，2%' },
        { v: 1, color: 'var(--red)', legend: '1 分：10 人，1%' }
      ];
      var pie = M.charts.pie(psvg, { cx: 190, cy: 135, r: 110, parts: parts, fontSize: 15 });
      var lg = S('g', {}, psvg);
      parts.forEach(function (p, i) {
        S('rect', { x: 330, y: 60 + i * 30, width: 16, height: 16, rx: 3, fill: p.color }, lg);
        S('text', { x: 354, y: 73 + i * 30, 'font-size': 15, 'class': 't-ink', text: p.legend }, lg);
      });
      return {
        onStep: function (n) { if ((n >= 1) !== shown) showMean(n >= 1); },
        enter: function () {
          pie.paths.forEach(function (pp, i) {
            A.tween({ dur: 700, delay: i * 90, ease: 'outCubic', update: function (e) {
              pp.el.setAttribute('d', M.geo.sectorPath({ x: 190, y: 135 }, 110 * (0.6 + 0.4 * e), pp.a0, pp.a1));
              pp.el.setAttribute('opacity', e);
            } });
          });
        }
      };
    }
  });
})(window.M);
