/* 7.2 平行线的证明 · 第2课时 平行线的性质定理 */
(function (M) {
  'use strict';
  var S = M.svg, G = M.geo, GF = M.GF;
  var L = '第2课时 平行线的性质定理';
  var m = M.m;
  var v = function (s) { return '<i class="v">' + s + '</i>'; };
  var l1 = v('l') + '<sub>1</sub>', l2 = v('l') + '<sub>2</sub>';

  /* 圆角标签（SVG） */
  function pill(parent, cx, cy, text, fill, ink) {
    var g = S('g', { 'class': 'pill' }, parent);
    var w = 0;
    for (var i = 0; i < text.length; i++) w += /[\x00-\xff]/.test(text[i]) ? 9.5 : 17;
    w += 34;
    var r = S('rect', { x: cx - w / 2, y: cy - 19, width: w, height: 38, rx: 19 }, g);
    r.style.fill = fill;
    var t = S('text', { x: cx, y: cy + 6, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 700, text: text }, g);
    t.style.fill = ink || 'var(--on-accent)';
    g.style.transition = 'opacity .45s';
    return g;
  }
  /* 可随图形移动、转动的平行记号 */
  function chevronAt(parent, color, n) {
    var g = S('g', {}, parent);
    GF.chevron(g, { x: 0, y: 0 }, 0, color, n);
    g.place = function (p, dir) { g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ') rotate(' + (-dir) + ')'); };
    return g;
  }
  function fade(el, on) { el.style.transition = 'opacity .45s'; el.style.opacity = on ? 1 : 0; }

  /* ---------------- 定理：两直线平行，同位角相等（*证明） ---------------- */
  M.slide({
    id: 's722-corr', sec: '7.2', lesson: L, kind: '定理', title: '两直线平行，同位角相等', layout: 'split', steps: 5,
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p class="small ink2">我们已经探索过平行线的性质，下面证明它们。</p>' +
        '  <div class="box thm"><span class="tag">定理</span><p>两条平行直线被第三条直线所截，同位角相等。</p><p class="short">简述为：两直线平行，同位角相等。</p></div>' +
        '  <div class="proof-head"><b>已知：</b><div>如图，直线 ' + m('AB') + ' ∥ ' + m('CD') + '，∠1 和 ∠2 是直线 ' + m('AB') + '，' + m('CD') + ' 被直线 ' + m('EF') + ' 截出的同位角。</div><b>求证：</b><div>∠1 = ∠2。</div></div>' +
        '  <div class="contra">' +
        '    <div class="proof-label">*证明：</div>' +
        '    <p data-step="1"><span class="no">①</span>假设 ∠1 ≠ ∠2，那么我们可以过点 ' + m('M') + ' 作直线 ' + m('GH') + '，使 ∠' + m('EMH') + ' = ∠2。</p>' +
        '    <p data-step="2"><span class="no">②</span>根据“同位角相等，两直线平行”，可知 ' + m('GH') + ' ∥ ' + m('CD') + '。</p>' +
        '    <p data-step="3"><span class="no">③</span>又因为 ' + m('AB') + ' ∥ ' + m('CD') + '，这样经过点 ' + m('M') + ' 存在两条直线 ' + m('AB') + ' 和 ' + m('GH') + ' 都与直线 ' + m('CD') + ' 平行。</p>' +
        '    <p data-step="4" class="bad"><span class="no">④</span>这与基本事实“过直线外一点有且只有一条直线与这条直线平行”相矛盾。</p>' +
        '    <p data-step="5" class="good"><span class="no">⑤</span>这说明 ∠1 ≠ ∠2 的假设不成立，所以 <b>∠1 = ∠2</b>。</p>' +
        '  </div>' +
        '  <p class="small muted" data-step="5">像这样先假设结论不成立，再推出矛盾的证明方法，叫作反证法。</p>' +
        '</div>' +
        '<div class="col"><div class="panel lab">' +
        '  <div class="panel-title">如果 ∠1 ≠ ∠2 呢？<span class="hint">拖动圆点转动直线 ' + m('EF') + '</span></div>' +
        '  <div class="fig drag-zone" id="corrFig"></div>' +
        '  <div id="corrStats"></div>' +
        '</div></div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var svg = M.canvas(M.$('#corrFig', body), 660, 420);
      var yA = 150, yC = 300, M0 = { x: 290, y: yA };
      var th = 62, phi = -8, ghK = 0, step = 0;
      var gGH = S('g', {}, svg), gL = S('g', {}, svg), gAng = S('g', {}, svg), gDec = S('g', {}, svg), gT = S('g', {}, svg), gUI = S('g', {}, svg);
      var line = function (parent, cls) { return S('line', { 'class': 'line' + (cls ? ' ' + cls : '') }, parent); };
      var lAB = line(gL), lCD = line(gL), lEF = line(gL, 'acc');
      var lGH = line(gGH); lGH.setAttribute('stroke-dasharray', '11 7'); lGH.style.stroke = 'var(--red)';
      var angH = GF.angle(gGH, M0, phi, th, { color: 'var(--a1)', r: 60, fillOpacity: 0.12, double: true });
      var ang1 = GF.angle(gAng, M0, 0, th, { color: 'var(--a2)', label: '1', r: 34 });
      var ang2 = GF.angle(gAng, M0, 0, th, { color: 'var(--a1)', label: '2', r: 34, double: true });
      var T = {};
      ['A', 'B', 'C', 'D', 'E', 'F', 'M', 'N'].forEach(function (k) { T[k] = M.label(gT, 0, 0, '{' + k + '}', { 'font-size': 20, 'text-anchor': 'middle' }); });
      ['G', 'H'].forEach(function (k) { T[k] = M.label(gGH, 0, 0, '{' + k + '}', { 'font-size': 20, 'text-anchor': 'middle' }); T[k].style.fill = 'var(--red)'; });
      var dM = S('circle', { r: 4.5, 'class': 'pt' }, gT), dN = S('circle', { r: 4.5, 'class': 'pt' }, gT);
      /* 平行记号：AB ∥ CD（已知）、GH ∥ CD（推出） */
      var cAB = chevronAt(gDec, 'var(--accent)'), cCD = chevronAt(gDec, 'var(--accent)');
      var gRed = S('g', {}, gDec), cGH = chevronAt(gRed, 'var(--red)', 2), cCD2 = chevronAt(gRed, 'var(--red)', 2);
      var ring = S('circle', { cx: M0.x, cy: M0.y, r: 16, fill: 'none', 'stroke-width': 3, 'class': 'pulse-ring' }, gDec);
      ring.style.stroke = 'var(--red)';
      /* 气泡、标签 */
      var bub = S('g', { transform: 'translate(12,-284)' }, gUI);
      S('path', { d: 'M430 346 q0 -30 34 -32 q18 -26 58 -18 q30 -20 64 2 q34 4 34 34 q10 30 -24 40 q-16 22 -58 16 q-30 16 -66 -2 q-40 -2 -42 -40 z', 'stroke-width': 2, 'class': 'bubble-shape' }, bub);
      S('circle', { cx: 404, cy: 350, r: 8, 'class': 'bubble-shape', 'stroke-width': 2 }, bub);
      S('circle', { cx: 386, cy: 336, r: 5, 'class': 'bubble-shape', 'stroke-width': 2 }, bub);
      [['如果 ∠1 ≠ ∠2，', 340], ['{AB} 与 {CD} 的位置', 364], ['关系会怎样呢？', 388]].forEach(function (r) {
        M.label(bub, 532, r[1], r[0], { 'font-size': 16, 'text-anchor': 'middle', 'class': 't-kai' });
      });
      var bAssume = pill(gUI, 118, 34, '假设 ∠1 ≠ ∠2', 'var(--ink-2)');
      var bContra = pill(gUI, 440, 34, '矛盾！过点 M 有两条直线与 CD 平行', 'var(--red)');
      var bOk = pill(gUI, 118, 34, '∠1 = ∠2 ✓', 'var(--green)');
      var stats = M.W.stats(M.$('#corrStats', body), [
        { key: 'a1', label: '测量 ∠1', unit: '°', d: 0, color: 'var(--a2)' },
        { key: 'a2', label: '测量 ∠2', unit: '°', d: 0, color: 'var(--a1)' }
      ]);
      var hE = M.handle(svg, 0, 0, { r: 10 });

      function N() { return { x: M0.x - (yC - yA) / Math.tan(th * G.RAD), y: yC }; }
      function draw() {
        var n = N();
        M.attr(lAB, { x1: 24, y1: yA, x2: 636, y2: yA });
        M.attr(lCD, { x1: 24, y1: yC, x2: 636, y2: yC });
        var e = G.polar(M0, 118, th), f = G.polar(n, 100, th + 180);
        M.attr(lEF, { x1: f.x, y1: f.y, x2: e.x, y2: e.y });
        var g = G.polar(M0, 262 * ghK, 180 + phi), h = G.polar(M0, 330 * ghK, phi);
        M.attr(lGH, { x1: g.x, y1: g.y, x2: h.x, y2: h.y });
        ang1.update(M0, 0, th); ang2.update(n, 0, th); angH.update(M0, phi, th);
        M.attr(dM, { cx: M0.x, cy: M0.y }); M.attr(dN, { cx: n.x, cy: n.y });
        var put = function (k, p, dx, dy) { M.attr(T[k], { x: p.x + (dx || 0), y: p.y + (dy || 0) }); };
        put('A', { x: 34, y: yA }, 0, -12); put('B', { x: 626, y: yA }, 0, -12);
        put('C', { x: 34, y: yC }, 0, -12); put('D', { x: 626, y: yC }, 0, -12);
        put('E', G.polar(e, 16, th), 0, 7); put('F', G.polar(f, 16, th + 180), 0, 7);
        put('M', G.polar(M0, 26, 180 + th / 2), 0, 7); put('N', G.polar(n, 26, 180 + th / 2), 0, 7);
        put('G', g, 10, -12); put('H', h, -6, 26);
        cAB.place({ x: 120, y: yA }, 0); cCD.place({ x: 120, y: yC }, 0);
        cGH.place(G.polar(M0, 250, phi), phi); cCD2.place({ x: 540, y: yC }, 0);
        var ph = G.polar(M0, 82, th); hE.move(ph.x, ph.y);
        stats.set('a1', th); stats.set('a2', th);
      }
      function render(n, prev) {
        step = n;
        A.cancelAll();
        fade(bub, n === 0);
        fade(bAssume, n >= 1 && n <= 4);
        fade(bContra, n === 4);
        fade(bOk, n >= 5);
        fade(gRed, n >= 2 && n <= 4);
        fade(ring, n === 3 || n === 4);
        lAB.style.stroke = n === 3 || n === 4 ? 'var(--accent)' : '';
        lCD.style.stroke = n >= 2 && n <= 4 ? 'var(--red)' : '';
        var ok = n >= 5;
        ang1.setColor(ok ? 'var(--green)' : 'var(--a2)');
        ang2.setColor(ok ? 'var(--green)' : 'var(--a1)');
        if (n === 0) { ghK = 0; phi = -8; fade(gGH, false); draw(); return; }
        if (n <= 4) {
          phi = -8; fade(gGH, true);
          if (ghK < 1) A.tween({ dur: 800, ease: 'outCubic', update: function (e) { ghK = e; draw(); } });
          else draw();
          return;
        }
        ghK = 1;
        if (prev === 4) {
          fade(gGH, true);
          A.tween({ dur: 1000, ease: 'inOutCubic', update: function (e) { phi = -8 * (1 - e); draw(); } }).promise.then(function (done) { if (done) fade(gGH, false); });
        } else { phi = 0; fade(gGH, false); draw(); }
      }
      M.drag(hE, { svg: svg, move: function (p) { th = M.clamp(G.dir(M0, p), 38, 142); draw(); } });
      render(0);
      return { onStep: function (n, prev) { render(n, prev); } };
    }
  });

  /* ---------------- 定理：两直线平行，内错角相等 ---------------- */
  M.proofSlide({
    id: 's722-alt', lesson: L, title: '证明：两直线平行，内错角相等',
    thm: '两条平行直线被第三条直线所截，内错角相等。', short: '两直线平行，内错角相等',
    hint: '分析：由 ' + l1 + ' ∥ ' + l2 + ' 可以得到哪些角相等？这些角与 ∠1，∠2 有什么联系？',
    given: '如图，直线 ' + l1 + ' ∥ ' + l2 + '，∠1 和 ∠2 是直线 ' + l1 + '，' + l2 + ' 被直线 ' + v('l') + ' 截出的内错角。',
    prove: '∠1 = ∠2。',
    lines: [
      ['∵', l1 + ' ∥ ' + l2, '已知'],
      ['∴', '∠1 = ∠3', '两直线平行，同位角相等'],
      ['又∵', '∠2 = ∠3', '对顶角相等'],
      ['∴', '∠1 = ∠2', '等量代换']
    ],
    figOpts: { names: { a: '{l}_1', b: '{l}_2', c: 'l' } }, cName: 'l',
    marks: { P3: { color: 'var(--a1)', label: '1' }, Q1: { color: 'var(--a2)', label: '2' }, Q3: { color: 'var(--a3)', label: '3' } },
    focus: { 0: null, 1: null, 2: ['P3', 'Q3'], 3: ['Q1', 'Q3'], 4: ['P3', 'Q1'] },
    parallelAt: 0,
    readout: [['P3', '1'], ['Q1', '2']]
  });

  /* ---------------- 随堂练习：两直线平行，同旁内角互补 ---------------- */
  M.proofSlide({
    id: 's722-same', lesson: L, kind: '随堂练习', kindCls: 'k-practice', title: '请你完成：两直线平行，同旁内角互补',
    thm: '两条平行直线被第三条直线所截，同旁内角互补。', short: '两直线平行，同旁内角互补',
    hint: '先独立写一写，再逐步对照。',
    blanks: true,
    given: '如图，直线 ' + v('a') + ' ∥ ' + v('b') + '，∠1 和 ∠2 是直线 ' + v('a') + '，' + v('b') + ' 被直线 ' + v('c') + ' 截出的同旁内角。',
    prove: '∠1 与 ∠2 互补。',
    lines: [
      ['∵', v('a') + ' ∥ ' + v('b'), '已知'],
      ['∴', '∠1 = ∠3', '两直线平行，同位角相等'],
      ['∵', '∠2 + ∠3 = 180°', '平角的定义'],
      ['∴', '∠2 + ∠1 = 180°', '等量代换'],
      ['∴', '∠1 与 ∠2 互补', '互补的定义']
    ],
    marks: { P3: { color: 'var(--a1)', label: '1' }, Q2: { color: 'var(--a2)', label: '2' }, Q3: { color: 'var(--a3)', label: '3' } },
    focus: { 0: null, 1: null, 2: ['P3', 'Q3'], 3: ['Q2', 'Q3'], 4: ['P3', 'Q2'], 5: ['P3', 'Q2'] },
    parallelAt: 0,
    readout: [['P3', '1'], ['Q2', '2']],
    extra: '<details class="alt-proof"><summary>还有其他证法吗？</summary><p class="small">记 ∠2 右侧的邻补角为 ∠4。∵ ' + v('a') + ' ∥ ' + v('b') + '，∴ ∠1 = ∠4（两直线平行，内错角相等）。∵ ∠2 + ∠4 = 180°（平角的定义），∴ ∠1 + ∠2 = 180°（等量代换），即 ∠1 与 ∠2 互补。</p></details>'
  });

  /* ---------------- 例：平行于同一条直线的两条直线平行 ---------------- */
  M.slide({
    id: 's722-trans', sec: '7.2', lesson: L, kind: '例题', title: '平行于同一条直线的两条直线平行', layout: 'split', steps: 7,
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <div class="box ex"><span class="tag">例</span><div class="proof-host"></div>' +
        '    <p class="small ink2 analysis">分析：由条件 ' + v('b') + ' ∥ ' + v('a') + '，' + v('c') + ' ∥ ' + v('a') + ' 可以得到哪些等量关系？为了证明 ' + v('b') + ' ∥ ' + v('c') + '，需要怎样的等量关系？</p></div>' +
        '  <div class="box thm" data-step="7"><span class="tag">定理</span><p>平行于同一条直线的两条直线平行。</p></div>' +
        '</div>' +
        '<div class="col"><div class="panel lab">' +
        '  <div class="panel-title">三条直线与截线 ' + v('d') + '<span class="hint">拖动圆点：上下移动 ' + v('b') + '，' + v('c') + '；转动 ' + v('d') + '</span></div>' +
        '  <div class="fig drag-zone" id="transFig"></div>' +
        '  <div id="transStats"></div>' +
        '</div></div>';
    },
    mount: function (body, api) {
      var host = M.$('.proof-host', body);
      var proof = M.W.proof(host, {
        given: '如图，' + v('b') + ' ∥ ' + v('a') + '，' + v('c') + ' ∥ ' + v('a') + '，∠1，∠2，∠3 是直线 ' + v('a') + '，' + v('b') + '，' + v('c') + ' 被直线 ' + v('d') + ' 截出的同位角。',
        prove: v('b') + ' ∥ ' + v('c') + '。',
        lines: [
          { sym: '∵', text: v('b') + ' ∥ ' + v('a'), why: '已知' },
          { sym: '∴', text: '∠2 = ∠1', why: '两直线平行，同位角相等' },
          { sym: '∵', text: v('c') + ' ∥ ' + v('a'), why: '已知' },
          { sym: '∴', text: '∠3 = ∠1', why: '两直线平行，同位角相等' },
          { sym: '∴', text: '∠2 = ∠3', why: '等量代换' },
          { sym: '∴', text: v('b') + ' ∥ ' + v('c'), why: '同位角相等，两直线平行' }
        ]
      });
      /* 分析放在已知、求证之后 */
      var head = M.$('.proof-head', host), an = M.$('.analysis', body);
      if (head && an) head.parentNode.insertBefore(an, head.nextSibling);

      var svg = M.canvas(M.$('#transFig', body), 660, 420);
      var box = [20, 16, 640, 404];
      var Y = { a: 96, b: 210, c: 324 }, D0 = { x: 330, y: 210 }, dd = 116;
      var COL = { a: 'var(--a2)', b: 'var(--a1)', c: 'var(--a3)' };
      var gL = S('g', {}, svg), gAng = S('g', {}, svg), gDec = S('g', {}, svg), gT = S('g', {}, svg);
      var L3 = {}, NM = {}, ANG = {}, CH = {};
      ['a', 'b', 'c'].forEach(function (k, i) {
        L3[k] = S('line', { 'class': 'line' }, gL);
        NM[k] = M.label(gT, 0, 0, '{' + k + '}', { 'font-size': 21, 'text-anchor': 'middle' });
        ANG[k] = GF.angle(gAng, D0, 0, 1, { color: COL[k], label: String(i + 1), r: 32 });
        CH[k] = chevronAt(gDec, 'var(--accent)');
      });
      var lD = S('line', { 'class': 'line acc' }, gL);
      var nD = M.label(gT, 0, 0, '{d}', { 'font-size': 21, 'text-anchor': 'middle' });
      var hB = M.handle(svg, 0, 0, { r: 10, color: 'var(--a1)' }), hC = M.handle(svg, 0, 0, { r: 10, color: 'var(--a3)' }), hD = M.handle(svg, 0, 0, { r: 10 });
      var stats = M.W.stats(M.$('#transStats', body), [
        { key: 'a', label: '∠1', unit: '°', d: 0, color: COL.a }, { key: 'b', label: '∠2', unit: '°', d: 0, color: COL.b }, { key: 'c', label: '∠3', unit: '°', d: 0, color: COL.c }
      ]);
      var step = 0;
      var LINES = { 1: ['a', 'b'], 2: ['a', 'b'], 3: ['a', 'c'], 4: ['a', 'c'], 5: [], 6: ['b', 'c'], 7: ['a', 'b', 'c'] };
      var ANGS = { 1: ['a', 'b'], 2: ['a', 'b'], 3: ['a', 'c'], 4: ['a', 'c'], 5: ['b', 'c'], 6: ['b', 'c'] };
      function X(y) { return D0.x + (D0.y - y) / Math.tan(dd * G.RAD); }
      function draw() {
        var ed = G.clipLine(D0, dd, box);
        M.attr(lD, { x1: ed[0].x, y1: ed[0].y, x2: ed[1].x, y2: ed[1].y });
        var top = ed[0].y < ed[1].y ? ed[0] : ed[1];
        var up = Math.sin(dd * G.RAD) > 0 ? dd : dd + 180;
        M.attr(nD, { x: G.polar(top, -18, up).x - 14, y: G.polar(top, -18, up).y + 8 });
        var hl = LINES[step] || [], ha = ANGS[step] || null;
        ['a', 'b', 'c'].forEach(function (k) {
          M.attr(L3[k], { x1: 24, y1: Y[k], x2: 636, y2: Y[k] });
          M.attr(NM[k], { x: 626, y: Y[k] - 11 });
          var p = { x: X(Y[k]), y: Y[k] };
          ANG[k].update(p, up, 180);
          ANG[k].style.transition = 'opacity .35s';
          ANG[k].style.opacity = !ha || ha.indexOf(k) >= 0 ? 1 : 0.18;
          var on = hl.indexOf(k) >= 0;
          L3[k].style.stroke = on ? (step === 6 ? 'var(--green)' : 'var(--accent)') : '';
          L3[k].style.strokeWidth = on ? 3.4 : '';
          CH[k].place({ x: 96, y: Y[k] }, 0);
          CH[k].style.transition = 'opacity .35s';
          CH[k].style.opacity = on ? 1 : 0;
        });
        hB.move(560, Y.b); hC.move(560, Y.c);
        var ph = G.polar(D0, 162, up + 180); hD.move(ph.x, ph.y);
        var val = G.norm(180 - up);
        ['a', 'b', 'c'].forEach(function (k) { stats.set(k, val); });
      }
      function dragY(k) {
        return function (p) {
          var y = M.clamp(p.y, 72, 380);
          var others = ['a', 'b', 'c'].filter(function (o) { return o !== k; });
          var clash = others.some(function (o) { return Math.abs(Y[o] - y) < 34; });
          if (!clash) { Y[k] = y; draw(); }
        };
      }
      M.drag(hB, { svg: svg, move: dragY('b') });
      M.drag(hC, { svg: svg, move: dragY('c') });
      M.drag(hD, { svg: svg, move: function (p) { var d = G.dir(D0, p); d = G.norm(d); if (d > 180) d -= 180; dd = M.clamp(d, 36, 144); draw(); } });
      draw();
      return { onStep: function (n) { step = n; proof.show(Math.min(n, 6)); draw(); } };
    }
  });

  /* ---------------- 回顾·反思：证明的主要环节 ---------------- */
  M.slide({
    id: 's722-steps', sec: '7.2', lesson: L, kind: '回顾·反思', title: '完成一个命题的证明，需要哪些主要环节？', layout: 'full', steps: 6,
    html: function () {
      var cards = [
        ['分清条件和结论', '条件：两条平行直线被第三条直线所截；<br>结论：内错角相等。', 'cond'],
        ['画出图形', '<svg viewBox="0 0 160 84" class="mini"><line x1="8" y1="24" x2="152" y2="24"/><line x1="8" y1="62" x2="152" y2="62"/><line x1="52" y1="82" x2="104" y2="4" class="acc"/><path d="M78.7 24 A12 12 0 0 0 84.04 33.98" class="a1"/><path d="M77.3 62 A12 12 0 0 0 71.96 52.02" class="a2"/><text x="67" y="40">1</text><text x="82" y="56">2</text><text x="140" y="18" class="v">l₁</text><text x="140" y="56" class="v">l₂</text></svg>', 'draw'],
        ['写出已知、求证', '已知：' + l1 + ' ∥ ' + l2 + '，∠1，∠2 是内错角。<br>求证：∠1 = ∠2。', 'given'],
        ['分析证明思路', '由 ' + l1 + ' ∥ ' + l2 + ' 能推出什么？<br>要证 ∠1 = ∠2 需要什么？找到“桥梁” ∠3。', 'think'],
        ['写出证明过程', '从已知出发，每一步都写出依据：已知、定义、基本事实或已证定理。', 'write']
      ];
      return '' +
        '<p class="small ink2">回顾前面的证明过程，以“两直线平行，内错角相等”为例：</p>' +
        '<ol class="proof-flow">' + cards.map(function (c, i) {
          return '<li data-step="' + (i + 1) + '" class="pf-' + c[2] + '"><span class="pf-no">' + (i + 1) + '</span><b>' + c[0] + '</b><div class="pf-body">' + c[1] + '</div></li>';
        }).join('') + '</ol>' +
        '<div class="flow-think" data-step="6">' +
        '  <div class="box note"><span class="tag">分析的经验</span><p class="small"><b>从已知出发</b>，看能推出什么（由因导果）；<b>从求证出发</b>，看需要什么（执果索因）。两头一起想，在中间“会合”，证明的思路就找到了。</p></div>' +
        '  <div class="fig" id="meetFig"></div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var svg = M.canvas(M.$('#meetFig', body), 760, 118);
      var nodes = [
        { x: 90, lab: '已知 {l}_1 ∥ {l}_2', kind: 'given' },
        { x: 380, lab: '∠1 = ∠3 = ∠2', kind: 'bridge' },
        { x: 670, lab: '求证 ∠1 = ∠2', kind: 'goal' }
      ];
      var gE = S('g', {}, svg);
      var arrL = S('path', { d: 'M160 40 L300 40', 'class': 'meet-arrow' }, gE);
      var arrR = S('path', { d: 'M600 40 L460 40', 'class': 'meet-arrow' }, gE);
      var tl = M.label(gE, 230, 22, '能推出 ∠1 = ∠3', { 'font-size': 15, 'text-anchor': 'middle' });
      var tr = M.label(gE, 530, 22, '需要 ∠3 = ∠2', { 'font-size': 15, 'text-anchor': 'middle' });
      var tb = M.label(gE, 380, 100, '对顶角相等：∠2 = ∠3 —— 会合！', { 'font-size': 15, 'text-anchor': 'middle', 'font-weight': 700 });
      tb.style.fill = 'var(--green)';
      var boxes = nodes.map(function (n) {
        var g = S('g', { 'class': 'meet-node ' + n.kind }, svg);
        var w = n.kind === 'bridge' ? 150 : 140;
        S('rect', { x: n.x - w / 2, y: 18, width: w, height: 44, rx: 12 }, g);
        M.label(g, n.x, 46, n.lab, { 'font-size': 16, 'text-anchor': 'middle', 'font-weight': 700 });
        return g;
      });
      [arrL, arrR].forEach(function (p) { p.style.strokeDasharray = 140; });
      function play() {
        A.cancelAll();
        [arrL, arrR].forEach(function (p) { p.style.strokeDashoffset = 140; });
        [tl, tr, tb, boxes[1]].forEach(function (e) { e.style.opacity = 0; });
        A.tween({ dur: 900, delay: 200, update: function (e) { arrL.style.strokeDashoffset = 140 * (1 - e); arrR.style.strokeDashoffset = 140 * (1 - e); tl.style.opacity = e; tr.style.opacity = e; } });
        A.tween({ dur: 600, delay: 1100, ease: 'outBack', update: function (e) {
          boxes[1].style.opacity = Math.min(1, e); tb.style.opacity = Math.min(1, e);
          boxes[1].setAttribute('transform', 'translate(380 40) scale(' + (0.6 + 0.4 * e) + ') translate(-380 -40)');
        } });
      }
      return { onStep: function (n, prev) { if (n === 6 && prev < 6) play(); } };
    }
  });

  /* ---------------- 判定与性质的比较 ---------------- */
  M.slide({
    id: 's722-compare', sec: '7.2', lesson: L, kind: '议一议', title: '判定定理与性质定理：条件和结论互换', layout: 'split even',
    html: function () {
      var rows = [['同位角相等', '同位角'], ['内错角相等', '内错角'], ['同旁内角互补', '同旁内角']];
      return '' +
        '<div class="col scroll">' +
        '  <div class="row between"><div id="cmpSeg"></div><button type="button" class="btn sm" id="cmpSwap">' + M.icon('swap') + '条件与结论互换</button></div>' +
        '  <div class="swap-board" id="swapBoard">' + rows.map(function (r) {
          return '<div class="swap-row"><span class="chip ang"><span>' + r[0] + '</span></span><span class="arrow">⇒</span><span class="chip par"><span>两直线平行</span></span></div>';
        }).join('') + '</div>' +
        '  <div class="cmp-note" id="cmpNote"></div>' +
        '  <div class="box note"><span class="tag">怎样选用</span><p class="small">要<b>证明两直线平行</b>，用<b>判定</b>；已知<b>两直线平行</b>，要得到角的关系，用<b>性质</b>。两类定理的条件和结论正好互换。</p></div>' +
        '</div>' +
        '<div class="col scroll">' +
        '  <div class="panel"><div class="panel-title">分一分：下面的推理用的是判定还是性质？</div><div id="cmpSort"></div></div>' +
        '</div>';
    },
    mount: function (body, api) {
      var mode = 0;
      var board = M.$('#swapBoard', body), note = M.$('#cmpNote', body);
      var NOTES = [
        '<b class="c-judge">判定</b>：由<span class="cond">角的关系</span>，得到<span class="conc">两直线平行</span>。（数量关系 ⇒ 位置关系）',
        '<b class="c-prop">性质</b>：由<span class="cond">两直线平行</span>，得到<span class="conc">角的关系</span>。（位置关系 ⇒ 数量关系）'
      ];
      function apply(animate) {
        var rows = M.$$('.swap-row', board);
        var first = rows.map(function (r) { return M.$$('.chip', r).map(function (c) { return c.getBoundingClientRect(); }); });
        board.classList.toggle('prop', mode === 1);
        rows.forEach(function (r, i) {
          M.$$('.chip', r).forEach(function (c, j) {
            var isAng = c.classList.contains('ang');
            c.classList.toggle('is-cond', mode === 0 ? isAng : !isAng);
            c.classList.toggle('is-conc', mode === 0 ? !isAng : isAng);
            if (!animate || !c.animate) return;
            var last = c.getBoundingClientRect(), f = first[i][j];
            var dx = f.left - last.left;
            if (Math.abs(dx) < 1) return;
            c.animate([{ transform: 'translate(' + dx + 'px,0)' }, { transform: 'translate(' + (dx / 2) + 'px,' + (j ? -18 : 18) + 'px)', offset: 0.5 }, { transform: 'none' }],
              { duration: 700 * M.motion, delay: i * 90 * M.motion, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'backwards' });
          });
        });
        note.innerHTML = NOTES[mode];
      }
      var seg = M.W.seg(M.$('#cmpSeg', body), ['判定定理', '性质定理'], function (i) { mode = i; apply(true); });
      M.$('#cmpSwap', body).addEventListener('click', function () { mode = 1 - mode; seg.pick(mode); apply(true); });
      apply(false);
      M.W.sorter(M.$('#cmpSort', body), {
        seed: 11,
        hint: '看“∵”后面是什么：由角的关系得到平行，用的是判定；由平行得到角的关系，用的是性质。',
        bins: [{ id: 'j', title: '判定' }, { id: 'p', title: '性质' }],
        items: [
          { html: '∵ ∠1 = ∠2（同位角），<br>∴ ' + v('a') + ' ∥ ' + v('b'), bin: 'j' },
          { html: '∵ ' + v('a') + ' ∥ ' + v('b') + '，<br>∴ ∠1 = ∠2（同位角）', bin: 'p' },
          { html: '∵ ' + v('a') + ' ∥ ' + v('b') + '，<br>∴ ∠3 + ∠4 = 180°（同旁内角）', bin: 'p' },
          { html: '∵ ∠3 + ∠4 = 180°（同旁内角），<br>∴ ' + v('a') + ' ∥ ' + v('b'), bin: 'j' },
          { html: '∵ ' + v('a') + ' ∥ ' + v('c') + '，' + v('b') + ' ∥ ' + v('c') + '，<br>∴ ' + v('a') + ' ∥ ' + v('b'), bin: 'j' },
          { html: '∵ ' + m('AB') + ' ∥ ' + m('CD') + '，<br>∴ ∠' + m('BAC') + ' = ∠' + m('DCA') + '（内错角）', bin: 'p' }
        ]
      });
      return {};
    }
  });

  /* ---------------- 习题：判断推理是否正确 ---------------- */
  M.slide({
    id: 's722-judge', sec: '7.2', lesson: L, kind: '随堂练习', kindCls: 'k-practice', title: '下列推理是否正确？为什么？', layout: 'split',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p class="small ink2">先找“三线”：是哪两条直线被哪一条直线所截？再看角的关系能推出什么。</p>' +
        '  <div class="judge-list" id="judgeList"></div>' +
        '</div>' +
        '<div class="col"><div class="panel lab"><div class="panel-title">图形<span class="hint">点一道题，图中高亮相关的“三线”和角</span></div><div class="fig" id="judgeFig"></div>' +
        '  <div class="legend-row"><span><i class="sw" style="background:var(--accent)"></i>被截的两条直线</span><span><i class="sw" style="background:var(--a1)"></i>截线</span></div></div></div>';
    },
    mount: function (body) {
      var svg = M.canvas(M.$('#judgeFig', body), 660, 380);
      var box = [20, 14, 640, 366];
      var LN = {
        l1: { p: { x: 330, y: 110 }, dir: 0, name: '{l}_1' },
        l2: { p: { x: 330, y: 280 }, dir: 0, name: '{l}_2' },
        l3: { p: { x: 190, y: 195 }, dir: 70, name: '{l}_3' },
        l4: { p: { x: 470, y: 195 }, dir: 125, name: '{l}_4' }
      };
      var gL = S('g', {}, svg), gA = S('g', {}, svg), gT = S('g', {}, svg);
      Object.keys(LN).forEach(function (k) {
        var o = LN[k], e = G.clipLine(o.p, o.dir, box);
        o.el = S('line', { 'class': 'line', x1: e[0].x, y1: e[0].y, x2: e[1].x, y2: e[1].y }, gL);
        var end = o.dir === 0 ? (e[0].x > e[1].x ? e[0] : e[1]) : (e[0].y < e[1].y ? e[0] : e[1]);
        var off = o.dir === 0 ? { x: -8, y: -12 } : { x: o.dir < 90 ? 16 : -16, y: 16 };
        M.label(gT, end.x + off.x, end.y + off.y, o.name, { 'font-size': 20, 'text-anchor': 'middle' });
      });
      function X(a, b) { return G.lineX(LN[a].p, G.polar(LN[a].p, 100, LN[a].dir), LN[b].p, G.polar(LN[b].p, 100, LN[b].dir)); }
      var PA = X('l3', 'l1'), PC = X('l3', 'l2'), PB = X('l4', 'l1'), PD = X('l4', 'l2');
      [PA, PB, PC, PD].forEach(function (p) { S('circle', { cx: p.x, cy: p.y, r: 4, 'class': 'pt' }, gT); });
      /* 角：[顶点, 起始方向, 终止方向] */
      var ANG = {
        1: [PA, 250, 360], 2: [PC, 70, 180], 3: [PA, 0, 70],
        4: [PB, 0, 125], 5: [PB, 180, 305], 6: [PD, 125, 180]
      };
      var marks = {};
      Object.keys(ANG).forEach(function (k) {
        var a = ANG[k];
        marks[k] = GF.angle(gA, a[0], a[1], a[2], { color: 'var(--ink-3)', label: k, r: 26, fillOpacity: 0.08, fontSize: 17 });
      });
      var ITEMS = [
        { q: '∵ ∠1 = ∠2，∴ ' + l1 + ' ∥ ' + l2 + '。', ok: true, lines: ['l1', 'l2'], cut: 'l3', angs: ['1', '2'],
          why: '∠1 与 ∠2 是直线 ' + l1 + '，' + l2 + ' 被直线 ' + v('l') + '<sub>3</sub> 所截得的<b>内错角</b>，内错角相等，两直线平行。' },
        { q: '∵ ∠3 = ∠4，∴ ' + l1 + ' ∥ ' + l2 + '。', ok: false, lines: ['l3', 'l4'], cut: 'l1', angs: ['3', '4'],
          why: '∠3 与 ∠4 是直线 ' + v('l') + '<sub>3</sub>，' + v('l') + '<sub>4</sub> 被直线 ' + l1 + ' 所截得的同位角，由 ∠3 = ∠4 只能得到 ' + v('l') + '<sub>3</sub> ∥ ' + v('l') + '<sub>4</sub>，不能得到 ' + l1 + ' ∥ ' + l2 + '。' },
        { q: '∵ ∠5 + ∠6 = 180°，∴ ' + l1 + ' ∥ ' + l2 + '。', ok: true, lines: ['l1', 'l2'], cut: 'l4', angs: ['5', '6'],
          why: '∠5 与 ∠6 是直线 ' + l1 + '，' + l2 + ' 被直线 ' + v('l') + '<sub>4</sub> 所截得的<b>同旁内角</b>，同旁内角互补，两直线平行。' },
        { q: '∵ ∠1 = ∠5，∴ ' + v('l') + '<sub>3</sub> ∥ ' + v('l') + '<sub>4</sub>。', ok: false, lines: ['l3', 'l4'], cut: 'l1', angs: ['1', '5'],
          why: '∠1 与 ∠5 是直线 ' + v('l') + '<sub>3</sub>，' + v('l') + '<sub>4</sub> 被直线 ' + l1 + ' 所截得的同旁内角。同旁内角<b>互补</b>才能判定两直线平行，由“相等”推不出。' }
      ];
      function focus(it) {
        Object.keys(LN).forEach(function (k) {
          var o = LN[k];
          o.el.style.transition = 'stroke .3s, stroke-width .3s';
          o.el.style.stroke = !it ? '' : (it.lines.indexOf(k) >= 0 ? 'var(--accent)' : (it.cut === k ? 'var(--a1)' : 'var(--ink-3)'));
          o.el.style.strokeWidth = it && (it.lines.indexOf(k) >= 0 || it.cut === k) ? 3.4 : '';
        });
        Object.keys(marks).forEach(function (k) {
          var on = it && it.angs.indexOf(k) >= 0;
          marks[k].setColor(on ? (k === it.angs[0] ? 'var(--a2)' : 'var(--a3)') : 'var(--ink-3)');
          marks[k].style.transition = 'opacity .3s';
          marks[k].style.opacity = !it || on ? 1 : 0.3;
        });
      }
      var list = M.$('#judgeList', body);
      ITEMS.forEach(function (it, i) {
        var card = M.el('div', { 'class': 'judge-card', tabindex: '0' });
        card.innerHTML = '<div class="jq"><span class="jn">（' + (i + 1) + '）</span><span>如图，' + it.q + '</span></div>' +
          '<div class="jbtns"><button type="button" class="btn sm" data-a="1">正确</button><button type="button" class="btn sm" data-a="0">错误</button></div>' +
          '<div class="jwhy" hidden></div>';
        var why = M.$('.jwhy', card);
        M.$$('[data-a]', card).forEach(function (b) {
          b.addEventListener('click', function (e) {
            e.stopPropagation();
            var pick = b.getAttribute('data-a') === '1';
            var right = pick === it.ok;
            M.$$('[data-a]', card).forEach(function (x) { x.classList.remove('good', 'bad'); });
            b.classList.add(right ? 'good' : 'bad');
            why.hidden = false;
            why.innerHTML = '<b class="' + (it.ok ? 'green' : 'red') + '">' + (it.ok ? '正确。' : '错误。') + '</b>' + it.why;
            card.classList.add('done');
            select();
          });
        });
        function select() {
          M.$$('.judge-card', list).forEach(function (c) { c.classList.remove('on'); });
          card.classList.add('on');
          focus(it);
        }
        card.addEventListener('click', select);
        card.addEventListener('keydown', function (e) { if (e.key === 'Enter') select(); });
        list.appendChild(card);
      });
      focus(null);
      return {};
    }
  });

  /* ---------------- 随堂练习：判定与性质综合 ---------------- */
  M.slide({
    id: 's722-practice', sec: '7.2', lesson: L, kind: '随堂练习', kindCls: 'k-practice', title: '判定与性质，一起用', layout: 'split even',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <div class="box practice"><span class="tag">1</span><p>如图，直线 ' + v('a') + '，' + v('b') + ' 被直线 ' + v('c') + '，' + v('d') + ' 所截。若 ∠1 = ∠2，∠3 = 112°，求 ∠4 的度数。</p>' +
        '    <div class="fig fixed" id="pr1Fig"></div>' +
        '    <button type="button" class="btn sm reveal-btn" data-reveal="pr1"></button>' +
        '    <div class="answer" id="pr1"><span class="chip-tag">先判定，后性质</span><br>∵ ∠1 = ∠2（已知），<br>∴ ' + v('a') + ' ∥ ' + v('b') + '（同位角相等，两直线平行）。<br>∴ ∠3 + ∠4 = 180°（两直线平行，同旁内角互补）。<br>∴ ∠4 = 180° − 112° = <b>68°</b>。</div></div>' +
        '</div>' +
        '<div class="col scroll">' +
        '  <div class="box practice"><span class="tag">2</span><p>已知：如图，' + m('AB') + ' ∥ ' + m('CD') + '，∠' + m('B') + ' = ∠' + m('D') + '。<br>求证：' + m('AD') + ' ∥ ' + m('BC') + '。</p>' +
        '    <div class="fig fixed" id="pr2Fig"></div>' +
        '    <button type="button" class="btn sm reveal-btn" data-reveal="pr2"></button>' +
        '    <div class="answer" id="pr2"><span class="chip-tag">先性质，后判定</span><br>证明：∵ ' + m('AB') + ' ∥ ' + m('CD') + '（已知），<br>∴ ∠' + m('B') + ' + ∠' + m('C') + ' = 180°（两直线平行，同旁内角互补）。<br>∵ ∠' + m('B') + ' = ∠' + m('D') + '（已知），<br>∴ ∠' + m('D') + ' + ∠' + m('C') + ' = 180°（等量代换）。<br>∴ ' + m('AD') + ' ∥ ' + m('BC') + '（同旁内角互补，两直线平行）。</div></div>' +
        '</div>';
    },
    mount: function (body) {
      M.$$('[data-reveal]', body).forEach(function (b) { M.W.reveal(b, M.$('#' + b.getAttribute('data-reveal'), body)); });
      /* 第 1 题 */
      var s1 = M.canvas(M.$('#pr1Fig', body), 460, 220);
      var box = [14, 12, 446, 208];
      var LN = { a: { p: { x: 230, y: 62 }, dir: 0 }, b: { p: { x: 230, y: 160 }, dir: 0 }, c: { p: { x: 130, y: 111 }, dir: 72 }, d: { p: { x: 330, y: 111 }, dir: 112 } };
      Object.keys(LN).forEach(function (k) {
        var o = LN[k], e = G.clipLine(o.p, o.dir, box);
        S('line', { 'class': 'line' + (k === 'c' || k === 'd' ? ' acc' : ''), x1: e[0].x, y1: e[0].y, x2: e[1].x, y2: e[1].y }, s1);
        var end = o.dir === 0 ? (e[0].x > e[1].x ? e[0] : e[1]) : (e[0].y < e[1].y ? e[0] : e[1]);
        M.label(s1, end.x + (o.dir === 0 ? -8 : (o.dir < 90 ? 14 : -14)), end.y + (o.dir === 0 ? -10 : 16), '{' + k + '}', { 'font-size': 19, 'text-anchor': 'middle' });
      });
      var X = function (a, b) { return G.lineX(LN[a].p, G.polar(LN[a].p, 100, LN[a].dir), LN[b].p, G.polar(LN[b].p, 100, LN[b].dir)); };
      GF.angle(s1, X('c', 'a'), 0, 72, { color: 'var(--a2)', label: '1', r: 24, fontSize: 16 });
      GF.angle(s1, X('c', 'b'), 0, 72, { color: 'var(--a2)', label: '2', r: 24, fontSize: 16 });
      GF.angle(s1, X('d', 'a'), 180, 292, { color: 'var(--a1)', label: '3', r: 22, fontSize: 16 });
      GF.angle(s1, X('d', 'b'), 112, 180, { color: 'var(--a3)', label: '4', r: 24, fontSize: 16 });
      /* 第 2 题 */
      var s2 = M.canvas(M.$('#pr2Fig', body), 460, 220);
      var P = { A: { x: 170, y: 40 }, B: { x: 90, y: 190 }, C: { x: 370, y: 190 }, D: { x: 450, y: 40 } };
      S('path', { d: 'M' + P.A.x + ' ' + P.A.y + ' L' + P.B.x + ' ' + P.B.y + ' L' + P.C.x + ' ' + P.C.y + ' L' + P.D.x + ' ' + P.D.y + ' Z', fill: 'var(--surface)', stroke: 'var(--ink)', 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, s2);
      var sp = G.innerSpan(P.B, P.A, P.C); GF.angle(s2, P.B, sp.a0, sp.a1, { color: 'var(--a2)', r: 26 });
      sp = G.innerSpan(P.D, P.C, P.A); GF.angle(s2, P.D, sp.a0, sp.a1, { color: 'var(--a2)', r: 26 });
      sp = G.innerSpan(P.C, P.B, P.D); GF.angle(s2, P.C, sp.a0, sp.a1, { color: 'var(--a1)', r: 22 });
      [['A', -4, -10], ['B', -14, 10], ['C', 12, 12], ['D', 12, -6]].forEach(function (q) { M.label(s2, P[q[0]].x + q[1], P[q[0]].y + q[2], '{' + q[0] + '}', { 'font-size': 19, 'text-anchor': 'middle' }); });
      return {};
    }
  });

  /* ---------------- 应用：潜望镜 ---------------- */
  M.slide({
    id: 's722-mirror', sec: '7.2', lesson: L, kind: '联系实际', title: '潜望镜中的平行线', layout: 'split', steps: 7,
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p>潜望镜中有两块<b>互相平行</b>的平面镜。光线射到镜面上反射时，入射光线、反射光线与镜面所成的角相等。进入潜望镜的光线和离开潜望镜的光线平行吗？</p>' +
        '  <div class="proof-host"></div>' +
        '</div>' +
        '<div class="col"><div class="panel lab">' +
        '  <div class="row between"><div id="mirSeg"></div><span class="mir-state" id="mirState"></span></div>' +
        '  <div class="fig" id="mirFig"></div>' +
        '  <div class="sliders" id="mirSl"></div>' +
        '</div></div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var proof = M.W.proof(M.$('.proof-host', body), {
        given: '如图，' + m('AB') + ' ∥ ' + m('CD') + '，∠1 = ∠2，∠3 = ∠4。',
        prove: m('EP') + ' ∥ ' + m('QF') + '。',
        lines: [
          { sym: '∵', text: m('AB') + ' ∥ ' + m('CD'), why: '已知' },
          { sym: '∴', text: '∠2 = ∠3', why: '两直线平行，内错角相等' },
          { sym: '∵', text: '∠1 = ∠2，∠3 = ∠4', why: '已知' },
          { sym: '∴', text: '∠1 + ∠2 = ∠3 + ∠4', why: '等量代换' },
          { sym: '∵', text: '∠' + m('EPQ') + ' = 180° − (∠1 + ∠2)，∠' + m('PQF') + ' = 180° − (∠3 + ∠4)', why: '平角的定义' },
          { sym: '∴', text: '∠' + m('EPQ') + ' = ∠' + m('PQF'), why: '等式的性质' },
          { sym: '∴', text: m('EP') + ' ∥ ' + m('QF'), why: '内错角相等，两直线平行' }
        ]
      });
      var svg = M.canvas(M.$('#mirFig', body), 660, 430);
      var P = { x: 350, y: 96 }, yQ = 330;
      var th1 = 45, th2 = 45, mode = 0, step = 0;
      var gM = S('g', {}, svg), gR = S('g', {}, svg), gA = S('g', {}, svg), gPh = S('g', {}, svg), gT = S('g', {}, svg);
      /* 镜子：镜面 + 背面斜线 */
      function mirror() {
        var g = S('g', { 'class': 'mirror' }, gM);
        var back = S('path', { 'class': 'mirror-back' }, g);
        var face = S('line', { 'class': 'mirror-face' }, g);
        g.set = function (c, dir, side) {
          var a = G.polar(c, 120, dir + 180), b = G.polar(c, 120, dir);
          M.attr(face, { x1: a.x, y1: a.y, x2: b.x, y2: b.y });
          var d = '';
          for (var i = 0; i <= 12; i++) {
            var q = G.lerpPt(a, b, i / 12), q2 = G.polar(q, 12, dir + side * 90 + side * 35);
            d += 'M' + q.x.toFixed(1) + ' ' + q.y.toFixed(1) + ' L' + q2.x.toFixed(1) + ' ' + q2.y.toFixed(1);
          }
          back.setAttribute('d', d);
          return { a: a, b: b };
        };
        return g;
      }
      var m1 = mirror(), m2 = mirror();
      var rIn = S('line', { 'class': 'ray' }, gR), rMid = S('line', { 'class': 'ray' }, gR), rOut = S('line', { 'class': 'ray' }, gR);
      var rRef = S('line', { 'class': 'ray-ref' }, gR);
      var sun = S('g', {}, gT);
      S('circle', { cx: 0, cy: 0, r: 13, 'class': 'sun' }, sun);
      for (var k = 0; k < 8; k++) { var p1 = G.polar({ x: 0, y: 0 }, 18, k * 45), p2 = G.polar({ x: 0, y: 0 }, 25, k * 45); S('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, 'class': 'sun-ray' }, sun); }
      var eye = S('g', {}, gT);
      S('path', { d: 'M-22 0 Q0 -16 22 0 Q0 16 -22 0 Z', 'class': 'eye' }, eye);
      S('circle', { cx: 0, cy: 0, r: 6, 'class': 'eye-pupil' }, eye);
      var ang = {};
      [['1', 'var(--a2)'], ['2', 'var(--a2)'], ['3', 'var(--a3)'], ['4', 'var(--a3)'], ['5', 'var(--a1)'], ['6', 'var(--a1)']].forEach(function (a) {
        ang[a[0]] = GF.angle(gA, P, 0, 10, { color: a[1], label: +a[0] > 4 ? '' : a[0], r: +a[0] > 4 ? 40 : 30, fontSize: 16, fillOpacity: +a[0] > 4 ? 0.1 : 0.22 });
      });
      var T = {};
      'ABCDEFPQ'.split('').forEach(function (c) { T[c] = M.label(gT, 0, 0, '{' + c + '}', { 'font-size': 19, 'text-anchor': 'middle' }); });
      var dots = [0, 1, 2].map(function () { return S('circle', { r: 5, 'class': 'photon' }, gPh); });
      var geo = null;
      function compute() {
        var d1 = 2 * th1 - 180;                       // P 处反射后的方向
        var far = G.polar(P, 100, d1);
        var Q = G.lineX(P, far, { x: 0, y: yQ }, { x: 100, y: yQ });
        var d2 = 2 * th2 - d1;                        // Q 处反射后的方向
        var Fp = G.clipLine(Q, d2, [20, 20, 640, 420]);
        var ux = Math.cos(d2 * G.RAD), uy = -Math.sin(d2 * G.RAD);
        var F = (Fp[0].x - Q.x) * ux + (Fp[0].y - Q.y) * uy > (Fp[1].x - Q.x) * ux + (Fp[1].y - Q.y) * uy ? Fp[0] : Fp[1];
        return { d1: G.norm(d1), d2: G.norm(d2), Q: Q, F: F, E: { x: 630, y: P.y } };
      }
      function draw() {
        geo = compute();
        var Q = geo.Q;
        var e1 = m1.set(P, th1, 1), e2 = m2.set(Q, th2, -1);
        M.attr(rIn, { x1: geo.E.x, y1: geo.E.y, x2: P.x, y2: P.y });
        M.attr(rMid, { x1: P.x, y1: P.y, x2: Q.x, y2: Q.y });
        M.attr(rOut, { x1: Q.x, y1: Q.y, x2: geo.F.x, y2: geo.F.y });
        /* 参照：与入射光线平行的虚线 */
        var par = Math.abs(G.norm(geo.d2 - 180)) < 0.05 || Math.abs(G.norm(geo.d2 - 180) - 360) < 0.05;
        M.attr(rRef, { x1: Q.x, y1: Q.y, x2: 30, y2: Q.y });
        rRef.style.opacity = par ? 0 : 0.8;
        sun.setAttribute('transform', 'translate(' + (geo.E.x - 6) + ',' + geo.E.y + ')');
        var ep = G.polar(geo.F, -24, geo.d2);
        eye.setAttribute('transform', 'translate(' + ep.x + ',' + ep.y + ') rotate(' + (-(geo.d2 - 180)) + ')');
        /* 角 */
        ang['1'].update(P, 0, th1);
        ang['2'].update(P, th1 + 180, geo.d1);
        ang['5'].update(P, geo.d1, 360);
        var back = G.norm(geo.d1 + 180);             // 从 Q 指向 P
        ang['3'].update(Q, th2, back);
        ang['4'].update(Q, geo.d2, th2 + 180);
        ang['6'].update(Q, back, geo.d2);
        var put = function (c, p, dx, dy) { M.attr(T[c], { x: p.x + dx, y: p.y + dy }); };
        put('A', e1.a, -12, 16); put('B', e1.b, 12, -4); put('C', e2.a, -12, 16); put('D', e2.b, 12, 0);
        var lp = G.polar(P, 60, 315), lq = G.polar(Q, 60, 135);
        put('E', geo.E, -42, -14); put('P', lp, 0, 7); put('Q', lq, 0, 7);
        var lf = G.polar(geo.F, -40, geo.d2); put('F', lf, 0, -16);
        var dev = G.norm(geo.d2 - 180); if (dev > 180) dev -= 360;
        var st = M.$('#mirState', body);
        st.className = 'mir-state ' + (par ? 'ok' : 'no');
        st.innerHTML = par ? '出射光线 ∥ 入射光线 ✓' : '不平行：两光线夹角 ' + M.fmt(Math.abs(dev), 0) + '°';
      }
      /* 光点沿光路流动 */
      var running = false;
      function flow() {
        if (running) return;
        running = true;
        (function loop() {
          if (!api.isActive()) { running = false; return; }
          A.tween({ dur: 2600, ease: 'linear', update: function (e) {
            if (!geo) return;
            var pts = [geo.E, P, geo.Q, geo.F];
            var segs = [G.dist(pts[0], pts[1]), G.dist(pts[1], pts[2]), G.dist(pts[2], pts[3])];
            var tot = segs[0] + segs[1] + segs[2];
            dots.forEach(function (d, i) {
              var s = ((e + i / 3) % 1) * tot, j = 0;
              while (j < 2 && s > segs[j]) { s -= segs[j]; j++; }
              var q = G.lerpPt(pts[j], pts[j + 1], segs[j] ? s / segs[j] : 0);
              M.attr(d, { cx: q.x, cy: q.y });
            });
          } }).promise.then(function (ok) { if (ok) loop(); else running = false; });
        })();
      }
      var sl = M.W.slider(M.$('#mirSl', body), { label: '镜面倾斜', min: 35, max: 55, step: 1, value: 45, fmt: function (x) { return x + '°'; }, input: function (x) {
        if (mode === 0) { th1 = x; th2 = x; } else th2 = x;
        draw();
      } });
      M.W.seg(M.$('#mirSeg', body), ['两镜同时转动（保持平行）', '只转动下面的镜子'], function (i) {
        mode = i;
        if (i === 0) { th2 = th1; sl.set(th1); } else sl.set(th2);
        draw();
      });
      var FOCUS = { 1: [], 2: ['2', '3'], 3: ['1', '2', '3', '4'], 4: ['1', '2', '3', '4'], 5: ['5', '6'], 6: ['5', '6'], 7: ['5', '6'] };
      function showStep() {
        var f = FOCUS[step];
        Object.keys(ang).forEach(function (k) {
          var on = +k <= 4 ? (!f || !f.length || f.indexOf(k) >= 0) : (f && f.indexOf(k) >= 0);
          ang[k].style.transition = 'opacity .35s';
          ang[k].style.opacity = on ? 1 : (+k <= 4 ? 0.2 : 0);
        });
        m1.classList.toggle('hot', step === 1 || step === 2);
        m2.classList.toggle('hot', step === 1 || step === 2);
        rMid.classList.toggle('hot', step === 2 || step >= 5);
        [rIn, rOut].forEach(function (r) { r.classList.toggle('good', step >= 7); });
      }
      draw(); showStep();
      return {
        enter: function () { flow(); },
        leave: function () { A.cancelAll(); running = false; },
        onStep: function (n) { step = n; proof.show(n); showStep(); }
      };
    }
  });

  /* ---------------- 拓展：平行线间的“拐角” ---------------- */
  M.slide({
    id: 's722-bend', sec: '7.2', lesson: L, kind: '拓展', title: '平行线间的“拐角”', layout: 'split', steps: 6,
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <div class="box ex"><span class="tag">例</span><div class="proof-host"></div></div>' +
        '  <div class="box think" data-step="6"><span class="tag">想一想</span><p>把点 ' + m('E') + ' 拖到直线 ' + m('BD') + ' 的右侧，结论还成立吗？</p><p class="small ink2">此时 ∠' + m('B') + ' + ∠' + m('D') + ' + ∠' + m('BED') + ' = 360°。同样过点 ' + m('E') + ' 作 ' + m('EF') + ' ∥ ' + m('AB') + '，用“两直线平行，同旁内角互补”来证明。</p></div>' +
        '</div>' +
        '<div class="col"><div class="panel lab">' +
        '  <div class="panel-title">拖动点 ' + m('E') + '<span class="hint">观察三个角的关系</span></div>' +
        '  <div class="fig drag-zone" id="bendFig"></div>' +
        '  <div class="row between"><div id="bendStats" class="grow"></div></div>' +
        '  <div class="bend-rel" id="bendRel"></div>' +
        '</div></div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var proof = M.W.proof(M.$('.proof-host', body), {
        given: '如图，' + m('AB') + ' ∥ ' + m('CD') + '，点 ' + m('E') + ' 在直线 ' + m('AB') + '，' + m('CD') + ' 之间。',
        prove: '∠' + m('BED') + ' = ∠' + m('B') + ' + ∠' + m('D') + '。',
        lines: [
          { sym: '', text: '过点 ' + m('E') + ' 作 ' + m('EF') + ' ∥ ' + m('AB'), why: '' },
          { sym: '∵', text: m('AB') + ' ∥ ' + m('CD') + '，' + m('EF') + ' ∥ ' + m('AB'), why: '已知、作图' },
          { sym: '∴', text: m('EF') + ' ∥ ' + m('CD'), why: '平行于同一条直线的两条直线平行' },
          { sym: '∴', text: '∠' + m('B') + ' = ∠' + m('BEF') + '，∠' + m('D') + ' = ∠' + m('DEF'), why: '两直线平行，内错角相等' },
          { sym: '∴', text: '∠' + m('BED') + ' = ∠' + m('BEF') + ' + ∠' + m('DEF') + ' = ∠' + m('B') + ' + ∠' + m('D'), why: '等量代换' }
        ]
      });
      var svg = M.canvas(M.$('#bendFig', body), 660, 420);
      var yT = 80, yB = 340, B = { x: 470, y: yT }, D = { x: 470, y: yB };
      var E = { x: 250, y: 205 }, step = 0;
      var gL = S('g', {}, svg), gAux = S('g', {}, svg), gA = S('g', {}, svg), gT = S('g', {}, svg);
      S('line', { 'class': 'line', x1: 30, y1: yT, x2: 630, y2: yT }, gL);
      S('line', { 'class': 'line', x1: 30, y1: yB, x2: 630, y2: yB }, gL);
      var cT = chevronAt(gL, 'var(--accent)'), cB = chevronAt(gL, 'var(--accent)');
      cT.place({ x: 120, y: yT }, 0); cB.place({ x: 120, y: yB }, 0);
      var sBE = S('line', { 'class': 'line acc' }, gL), sDE = S('line', { 'class': 'line acc' }, gL);
      var aux = S('line', { 'class': 'line', 'stroke-dasharray': '9 7' }, gAux);
      aux.style.stroke = 'var(--red)';
      var cAux = chevronAt(gAux, 'var(--red)');
      var tF = M.label(gAux, 0, 0, '{F}', { 'font-size': 19, 'text-anchor': 'middle' });
      tF.style.fill = 'var(--red)';
      var aB = GF.angle(gA, B, 0, 1, { color: 'var(--a2)', r: 34 });
      var aD = GF.angle(gA, D, 0, 1, { color: 'var(--a3)', r: 34 });
      var aE = GF.angle(gA, E, 0, 1, { color: 'var(--a1)', r: 46, fillOpacity: 0.1 });
      var aE1 = GF.angle(gA, E, 0, 1, { color: 'var(--a2)', r: 30 });
      var aE2 = GF.angle(gA, E, 0, 1, { color: 'var(--a3)', r: 30 });
      var T = {};
      [['A', 40, yT - 12], ['B', B.x, yT - 12], ['C', 40, yB + 26], ['D', D.x, yB + 26]].forEach(function (q) { T[q[0]] = M.label(gT, q[1], q[2], '{' + q[0] + '}', { 'font-size': 20, 'text-anchor': 'middle' }); });
      T.E = M.label(gT, 0, 0, '{E}', { 'font-size': 20, 'text-anchor': 'middle' });
      [B, D].forEach(function (p) { S('circle', { cx: p.x, cy: p.y, r: 4, 'class': 'pt' }, gT); });
      var hE = M.handle(svg, E.x, E.y, { r: 11 });
      var stats = M.W.stats(M.$('#bendStats', body), [
        { key: 'b', label: '∠' + m('B'), unit: '°', d: 0, color: 'var(--a2)' },
        { key: 'd', label: '∠' + m('D'), unit: '°', d: 0, color: 'var(--a3)' },
        { key: 'e', label: '∠' + m('BED'), unit: '°', d: 0, color: 'var(--a1)' }
      ]);
      var auxK = 0;
      function draw() {
        M.attr(sBE, { x1: B.x, y1: B.y, x2: E.x, y2: E.y });
        M.attr(sDE, { x1: D.x, y1: D.y, x2: E.x, y2: E.y });
        var left = E.x < B.x;
        var dBE = G.dir(B, E), dDE = G.dir(D, E), dEB = G.dir(E, B), dED = G.dir(E, D);
        /* ∠B = ∠ABE（BA 朝左），∠D = ∠CDE（DC 朝左） */
        var sb = G.innerSpan(B, { x: 0, y: yT }, E), sd = G.innerSpan(D, { x: 0, y: yB }, E), se = G.innerSpan(E, B, D);
        aB.update(B, sb.a0, sb.a1); aD.update(D, sd.a0, sd.a1); aE.update(E, se.a0, se.a1);
        var fDir = left ? 0 : 180;
        var s1 = G.innerSpan(E, B, G.polar(E, 50, fDir)), s2 = G.innerSpan(E, D, G.polar(E, 50, fDir));
        aE1.update(E, s1.a0, s1.a1); aE2.update(E, s2.a0, s2.a1);
        var fEnd = G.polar(E, 200 * auxK, fDir);
        M.attr(aux, { x1: E.x, y1: E.y, x2: fEnd.x, y2: fEnd.y });
        cAux.place(G.polar(E, 120 * auxK, fDir), 0);
        M.attr(tF, { x: fEnd.x + (left ? 4 : -4), y: fEnd.y - 12 });
        tF.style.opacity = auxK > 0.6 ? 1 : 0;
        var eLab = G.polar(E, 26, left ? 180 : 0);
        M.attr(T.E, { x: eLab.x, y: eLab.y + 7 });
        hE.move(E.x, E.y);
        /* 取整后由关系式得出第三个角，保证显示的数字自洽 */
        var b = Math.round(sb.size), d = Math.round(sd.size), e = left ? b + d : 360 - b - d;
        stats.set('b', b); stats.set('d', d); stats.set('e', e);
        var rel = M.$('#bendRel', body);
        rel.innerHTML = left ?
          '∠' + m('B') + ' + ∠' + m('D') + ' = ' + b + '° + ' + d + '° = <b>' + (b + d) + '°</b> = ∠' + m('BED') :
          '∠' + m('B') + ' + ∠' + m('D') + ' + ∠' + m('BED') + ' = ' + b + '° + ' + d + '° + ' + e + '° = <b>' + (b + d + e) + '°</b>';
        rel.className = 'bend-rel ' + (left ? 'k1' : 'k2');
        var showSplit = step >= 4 && auxK > 0.99;
        [aE1, aE2].forEach(function (a) { a.style.transition = 'opacity .35s'; a.style.opacity = showSplit ? 1 : 0; });
        cAux.style.opacity = step >= 2 && step <= 3 ? 1 : 0;
      }
      function setAux(on) {
        var from = auxK, to = on ? 1 : 0;
        if (from === to) { draw(); return; }
        A.tween({ dur: 700, ease: 'outCubic', update: function (e) { auxK = M.lerp(from, to, e); draw(); } });
      }
      M.drag(hE, { svg: svg, move: function (p) {
        E = { x: M.clamp(p.x, 70, 620), y: M.clamp(p.y, yT + 30, yB - 30) };
        if (Math.abs(E.x - B.x) < 8) E.x = B.x + (p.x < B.x ? -8 : 8);
        draw();
      } });
      draw();
      return { onStep: function (n) { step = n; proof.show(Math.min(n, 5)); setAux(n >= 1); } };
    }
  });
})(window.M);
