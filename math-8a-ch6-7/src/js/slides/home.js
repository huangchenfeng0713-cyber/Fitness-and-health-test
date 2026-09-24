/* 封面 */
(function (M) {
  'use strict';

  M.slide({
    id: 'home', sec: 'home', title: '数据与证明', noHead: true, layout: 'full', cls: 'slide-cover',
    html: function () {
      return '' +
        '<div class="cover">' +
        '  <div class="cover-main">' +
        '    <p class="cover-kicker">北师大版（2024）· 八年级上册 · 数学</p>' +
        '    <h1 class="cover-h1"><span>数据</span><span class="amp">与</span><span>证明</span></h1>' +
        '    <p class="cover-sub"><b class="c6t">第六章</b> 数据的分析<i></i><b class="c7t">第七章</b> 命题与证明</p>' +
        '    <p class="cover-lead">拖一拖数据点，看平均数和方差怎样变化；一步步点开证明，看每个结论从哪条依据推出。</p>' +
        '    <div class="btn-row cover-actions">' +
        '      <button type="button" class="btn primary big" data-goto="c6-intro">从第六章开始' + M.icon('arrow') + '</button>' +
        '      <button type="button" class="btn big" data-goto="c7-intro">从第七章开始</button>' +
        '      <button type="button" class="btn ghost" id="btnResume" hidden>' + M.icon('reset') + '<span>继续上次</span></button>' +
        '    </div>' +
        '    <div class="fig cover-hero" id="coverHero" aria-hidden="true"></div>' +
        '  </div>' +
        '  <div class="cover-side">' +
        '    <article class="ch-card ch-6" data-no="6">' +
        '      <header><span class="ch-no">第六章</span><h3>数据的分析</h3></header>' +
        '      <ol class="sec-list">' +
        '        <li><button type="button" data-goto="s611-shoot"><b>6.1</b><span>平均数与方差</span><small>4 课时</small></button></li>' +
        '        <li><button type="button" data-goto="s621-salary"><b>6.2</b><span>中位数与箱线图</span><small>2 课时</small></button></li>' +
        '        <li><button type="button" data-goto="s63-case"><b>6.3</b><span>哪个团队收益大</span><small>综合</small></button></li>' +
        '        <li><button type="button" data-goto="s6r-map"><b>回顾</b><span>知识结构与综合练习</span><small></small></button></li>' +
        '      </ol>' +
        '      <p class="ch-keys">众数 · 算术平均数 · 加权平均数 · 离差平方和 · 方差 · 标准差 · 中位数 · 百分位数 · 四分位数 · 箱线图</p>' +
        '    </article>' +
        '    <article class="ch-card ch-7" data-no="7">' +
        '      <header><span class="ch-no">第七章</span><h3>命题与证明</h3></header>' +
        '      <ol class="sec-list">' +
        '        <li><button type="button" data-goto="s711-illusion"><b>7.1</b><span>认识证明</span><small>3 课时</small></button></li>' +
        '        <li><button type="button" data-goto="s721-angles"><b>7.2</b><span>平行线的证明</span><small>2 课时</small></button></li>' +
        '        <li><button type="button" data-goto="s7r-tree"><b>回顾</b><span>证明之树与综合练习</span><small></small></button></li>' +
        '      </ol>' +
        '      <p class="ch-keys">定义 · 命题 · 条件与结论 · 真假命题 · 反例 · 基本事实 · 定理 · 证明 · 平行线的判定与性质</p>' +
        '    </article>' +
        '    <div class="cover-tips">' +
        '      <div><kbd>→</kbd><kbd>空格</kbd><span>下一步（翻页笔可直接用）</span></div>' +
        '      <div><kbd>T</kbd><span>目录</span><kbd>P</kbd><span>画笔批注</span><kbd>F</kbd><span>全屏</span></div>' +
        '      <div class="muted">单个文件，断网也能用；图中带光晕的圆点都可以拖动。</div>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var host = M.$('#coverHero', body);
      var W = 660, H = 300;
      var svg = M.canvas(host, W, H);
      var S = M.svg;

      /* 左：数据点落下、平衡支点滑到平均数、箱线图浮现 */
      var data = [3, 4, 4, 5, 5, 5, 6, 6, 7, 9];
      var sx = M.charts.scale(2, 10, 30, 300), baseY = 208;
      var gL = S('g', {}, svg);
      S('line', { 'class': 'axis', x1: 22, x2: 308, y1: baseY + 12, y2: baseY + 12 }, gL);
      [2, 4, 6, 8, 10].forEach(function (v) {
        S('line', { 'class': 'axis', x1: sx(v), x2: sx(v), y1: baseY + 12, y2: baseY + 18 }, gL);
        S('text', { x: sx(v), y: baseY + 36, 'text-anchor': 'middle', 'font-size': 14, 'class': 't-num', text: v }, gL);
      });
      var stackCount = {}, dots = [];
      data.forEach(function (v, i) {
        var k = stackCount[v] = (stackCount[v] || 0) + 1;
        var c = S('circle', { cx: sx(v), cy: -20, r: 9.5, fill: 'var(--c6)', opacity: 0 }, gL);
        dots.push({ c: c, y: baseY - (k - 1) * 21, i: i });
      });
      var mean = M.stats.mean(data);
      var fulcrum = S('path', { d: 'M0 0 L-13 22 L13 22 Z', fill: 'var(--ink)', opacity: 0, transform: 'translate(' + sx(2) + ',' + (baseY + 12) + ')' }, gL);
      var meanLab = M.label(gL, sx(mean), baseY + 70, '{x̄} = ' + M.fmt(mean, 1), { 'text-anchor': 'middle', 'font-size': 17, 'class': 't-ink', opacity: 0 });
      var q = M.stats.quartiles(data);
      var bp = M.charts.box(gL, { scale: sx, orient: 'h', pos: 82, size: 30, color: 'var(--c6)', tint: 'var(--c6-tint)' });
      bp.g.setAttribute('opacity', 0);

      /* 右：两条平行线被截，同位角同时亮起 */
      var gR = S('g', { transform: 'translate(360,0)' }, svg);
      var l1 = { a: { x: 10, y: 92 }, b: { x: 290, y: 92 } }, l2 = { a: { x: 10, y: 214 }, b: { x: 290, y: 214 } };
      var tA = { x: 90, y: 280 }, tB = { x: 230, y: 20 };
      function drawLine(p, q2, cls) {
        var len = M.geo.dist(p, q2);
        return S('line', { 'class': cls, x1: p.x, y1: p.y, x2: q2.x, y2: q2.y, 'stroke-dasharray': len, 'stroke-dashoffset': len }, gR);
      }
      var L1 = drawLine(l1.a, l1.b, 'line'), L2 = drawLine(l2.a, l2.b, 'line'), T = drawLine(tA, tB, 'line acc');
      var X1 = M.geo.lineX(l1.a, l1.b, tA, tB), X2 = M.geo.lineX(l2.a, l2.b, tA, tB);
      var tdir = M.geo.dir(tA, tB);
      var arc1 = S('path', { d: M.geo.sectorPath(X1, 30, 0, tdir), fill: 'var(--c7)', opacity: 0 }, gR);
      var arc2 = S('path', { d: M.geo.sectorPath(X2, 30, 0, tdir), fill: 'var(--c7)', opacity: 0 }, gR);
      var eq1 = M.label(gR, X1.x + 42, X1.y - 12, '∠1', { 'font-size': 17, 'class': 't-ink', opacity: 0 });
      var eq2 = M.label(gR, X2.x + 42, X2.y - 12, '∠2', { 'font-size': 17, 'class': 't-ink', opacity: 0 });
      var par = S('text', { x: 150, y: 296, 'text-anchor': 'middle', 'font-size': 17, 'class': 't-ink', opacity: 0, text: '∠1 = ∠2  ⇒  a ∥ b' }, gR);
      M.label(gR, 296, 97, '{a}', { 'font-size': 18 });
      M.label(gR, 296, 219, '{b}', { 'font-size': 18 });

      var played = false;
      function play() {
        if (played) return;
        played = true;
        dots.forEach(function (d) {
          A.tween({ dur: 700, delay: 120 + d.i * 70, ease: 'outBack', update: function (e) {
            M.attr(d.c, { cy: -20 + (d.y + 20) * e, opacity: Math.min(1, e * 3) });
          } });
        });
        A.tween({ dur: 900, delay: 1100, ease: 'outElastic', update: function (e) {
          M.attr(fulcrum, { opacity: Math.min(1, e * 2), transform: 'translate(' + M.lerp(sx(2), sx(mean), e) + ',' + (baseY + 12) + ')' });
        } });
        A.tween({ dur: 500, delay: 1700, update: function (e) { meanLab.setAttribute('opacity', e); } });
        bp.set({ min: q.min, q1: q.q1, q2: q.q2, q3: q.q3, max: q.max });
        A.tween({ dur: 600, delay: 2000, update: function (e) { bp.g.setAttribute('opacity', e); } });
        [L1, L2, T].forEach(function (ln, i) {
          var len = +ln.getAttribute('stroke-dasharray');
          A.tween({ dur: 800, delay: 500 + i * 260, ease: 'inOutCubic', update: function (e) { ln.setAttribute('stroke-dashoffset', len * (1 - e)); } });
        });
        A.tween({ dur: 600, delay: 1700, ease: 'outCubic', update: function (e) {
          arc1.setAttribute('opacity', 0.85 * e); arc2.setAttribute('opacity', 0.85 * e);
          arc1.setAttribute('d', M.geo.sectorPath(X1, 12 + 18 * e, 0, tdir)); arc2.setAttribute('d', M.geo.sectorPath(X2, 12 + 18 * e, 0, tdir));
          eq1.setAttribute('opacity', e); eq2.setAttribute('opacity', e);
        } });
        A.tween({ dur: 500, delay: 2300, update: function (e) { par.setAttribute('opacity', e); } });
      }

      var last = M.lastVisited;
      var resume = M.$('#btnResume', body);
      if (last && last !== 'home' && M.slides.some(function (s) { return s.id === last; })) {
        var d = M.slides.filter(function (s) { return s.id === last; })[0];
        resume.hidden = false;
        resume.querySelector('span').textContent = '继续上次：' + d.title.replace(/<[^>]+>/g, '');
        resume.addEventListener('click', function () { M.go(last); });
      }
      return { enter: play };
    }
  });
})(window.M);
