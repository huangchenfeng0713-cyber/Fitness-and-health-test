/* 7.1 认识证明 · 第3课时 定理与证明 */
(function (M) {
  'use strict';
  var S = M.svg, G = M.geo, GF = M.GF;
  var L = '第3课时 定理与证明';
  var m = function (s) { return '<span class="m">' + s + '</span>'; };

  /* ---------------- 公理、定理与证明 ---------------- */
  M.slide({
    id: 's713-euclid', sec: '7.1', lesson: L, kind: '阅读·思考', title: '证明的起点在哪里？', layout: 'split',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p class="small ink2">举一个反例就可以说明一个命题是假命题，那么如何证实一个命题是真命题呢？</p>' +
        '  <div class="talk">' +
        '    <div class="say"><b>小明</b><span>用以前学过的观察、实验、验证特例等方法。</span></div>' +
        '    <div class="say"><b>小颖</b><span>这些方法往往不可靠。</span></div>' +
        '    <div class="say"><b>小亮</b><span>能不能根据已经知道的真命题来证实呢？</span></div>' +
        '    <div class="say q"><b>小丽</b><span>那已经知道的真命题，又是如何证实的？</span></div>' +
        '  </div>' +
        '  <div class="box read" data-step="1"><span class="tag">欧几里得的办法</span><p class="small">公元前 3 世纪，古希腊数学家欧几里得编写《原本》时，挑选了一部分数学名词和一部分公认的真命题作为证实其他命题的出发点和依据：其中的数学名词称为<b>原名</b>，公认的真命题称为<b>公理</b>。除了公理外，其他命题的真假都要通过<b>演绎推理</b>来判断。</p></div>' +
        '  <div class="box def" data-step="2"><span class="tag">证明与定理</span><p>演绎推理的过程称为<span class="hl">证明</span>（proof），经过证明的真命题称为<span class="hl">定理</span>（theorem）。</p><p class="small">每个定理都只能用公理、定义和已经证明为真的命题来证明。本书中的“基本事实”就是公理，不需要证明。</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab"><div class="panel-title">数学大厦是这样盖起来的<span class="hint">从地基一层层往上</span></div><div class="fig" id="bldFig"></div></div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var svg = M.canvas(M.$('#bldFig', body), 640, 430);
      var layers = [
        { y: 350, h: 62, w: 600, fill: 'var(--amber-tint)', stroke: 'var(--amber)', title: '地基：原名 · 定义 · 基本事实（公理）', items: ['两点确定一条直线', '两点之间线段最短', '同位角相等，两直线平行', '……'] },
        { y: 270, h: 62, w: 500, fill: 'var(--accent-tint)', stroke: 'var(--accent)', title: '定理', items: ['同角的补角相等', '三角形两边之和大于第三边'] },
        { y: 190, h: 62, w: 400, fill: 'var(--accent-tint)', stroke: 'var(--accent)', title: '定理', items: ['对顶角相等'] },
        { y: 110, h: 62, w: 300, fill: 'var(--accent-tint)', stroke: 'var(--accent)', title: '定理', items: ['内错角相等，两直线平行'] }
      ];
      var gs = layers.map(function (ly, i) {
        var g = S('g', { opacity: 0 }, svg);
        var r = S('rect', { x: 320 - ly.w / 2, y: ly.y - ly.h / 2, width: ly.w, height: ly.h, rx: 10, 'stroke-width': 2 }, g);
        r.style.fill = ly.fill; r.style.stroke = ly.stroke;
        var t = S('text', { x: 320, y: ly.y - 8, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, text: ly.title }, g);
        t.style.fill = ly.stroke;
        S('text', { x: 320, y: ly.y + 18, 'text-anchor': 'middle', 'font-size': 15, 'class': 't-ink', text: ly.items.join('　') }, g);
        return g;
      });
      var roof = S('path', { d: 'M150 78 L320 22 L490 78 Z', opacity: 0 }, svg);
      roof.style.fill = 'var(--accent)';
      var rt = S('text', { x: 320, y: 64, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, opacity: 0, text: '更多定理……' }, svg);
      rt.style.fill = 'var(--on-accent)';
      function play() {
        gs.forEach(function (g, i) {
          A.tween({ dur: 600, delay: 200 + i * 380, ease: 'outBack', update: function (e) { g.setAttribute('opacity', Math.min(1, e)); g.setAttribute('transform', 'translate(0,' + (-40 * (1 - e)) + ')'); } });
        });
        A.tween({ dur: 600, delay: 200 + 4 * 380, update: function (e) { roof.setAttribute('opacity', e); rt.setAttribute('opacity', e); } });
      }
      return { enter: play };
    }
  });

  /* ---------------- 九条基本事实 ---------------- */
  function icon(k) {
    var s = '<svg viewBox="0 0 84 56" aria-hidden="true">';
    var ln = 'stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"';
    var dot = function (x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="3" fill="currentColor"/>'; };
    switch (k) {
      case 1: s += '<line x1="4" y1="44" x2="80" y2="12" ' + ln + '/>' + dot(22, 36) + dot(60, 20); break;
      case 2: s += '<path d="M14 40 Q42 -6 70 40" ' + ln + ' stroke-dasharray="4 4"/><line x1="14" y1="40" x2="70" y2="40" ' + ln + '/>' + dot(14, 40) + dot(70, 40); break;
      case 3: s += '<line x1="4" y1="44" x2="80" y2="44" ' + ln + '/><line x1="42" y1="44" x2="42" y2="6" ' + ln + '/><path d="M42 36 h8 v8" ' + ln + '/>' + dot(42, 14); break;
      case 4: s += '<line x1="4" y1="18" x2="80" y2="18" ' + ln + '/><line x1="4" y1="42" x2="80" y2="42" ' + ln + '/><line x1="26" y1="54" x2="58" y2="4" ' + ln + '/><path d="M47 18 a10 10 0 0 0 -4 -8" ' + ln + '/><path d="M32 42 a10 10 0 0 0 -4 -8" ' + ln + '/>'; break;
      case 5: s += '<line x1="4" y1="42" x2="80" y2="42" ' + ln + '/><line x1="4" y1="16" x2="80" y2="16" ' + ln + ' stroke-dasharray="5 4"/>' + dot(42, 16); break;
      case 6: s += '<path d="M4 48 L34 48 L14 14 Z" ' + ln + '/><path d="M46 48 L76 48 L56 14 Z" ' + ln + '/><path d="M12 48 a8 8 0 0 0 -3 -7" ' + ln + '/><path d="M54 48 a8 8 0 0 0 -3 -7" ' + ln + '/>'; break;
      case 7: s += '<path d="M4 48 L34 48 L14 14 Z" ' + ln + '/><path d="M46 48 L76 48 L56 14 Z" ' + ln + '/><path d="M12 48 a8 8 0 0 0 -3 -7" ' + ln + '/><path d="M27 48 a7 7 0 0 1 2 -6" ' + ln + '/><path d="M54 48 a8 8 0 0 0 -3 -7" ' + ln + '/><path d="M69 48 a7 7 0 0 1 2 -6" ' + ln + '/>'; break;
      case 8: s += '<path d="M4 48 L34 48 L14 14 Z" ' + ln + '/><path d="M46 48 L76 48 L56 14 Z" ' + ln + '/><line x1="17" y1="45" x2="19" y2="51" ' + ln + '/><line x1="59" y1="45" x2="61" y2="51" ' + ln + '/>'; break;
    }
    return s + '</svg>';
  }
  M.slide({
    id: 's713-facts', sec: '7.1', lesson: L, kind: '概念', title: '作为证明起点的基本事实', layout: 'full',
    html: function () {
      var facts = [
        '两点确定一条直线。',
        '两点之间线段最短。',
        '同一平面内，过一点有且只有一条直线与已知直线垂直。',
        '两条直线被第三条直线所截，如果同位角相等，那么这两条直线平行（简述为：同位角相等，两直线平行）。',
        '过直线外一点有且只有一条直线与这条直线平行。',
        '两边及其夹角分别相等的两个三角形全等。',
        '两角及其夹边分别相等的两个三角形全等。',
        '三边分别相等的两个三角形全等。'
      ];
      return '<p>本套教科书选用<b>九条基本事实</b>作为证明的出发点和依据，我们已经认识了其中的八条（另外一条以后再认识）：</p>' +
        '<ol class="fact-list">' + facts.map(function (f, i) { return '<li style="--i:' + i + '">' + icon(i + 1) + '<span><b class="num">' + (i + 1) + '.</b> ' + f + '</span></li>'; }).join('') + '</ol>' +
        '<div class="box fact"><span class="tag">也可以作为依据</span><p class="small">数与式的运算律和运算法则、等式的有关性质，以及反映大小关系的有关性质都可以作为证明的依据。例如：如果 <i class="v">a</i> = <i class="v">b</i>，<i class="v">b</i> = <i class="v">c</i>，那么 <i class="v">a</i> = <i class="v">c</i>，称为“<b>等量代换</b>”；如果 <i class="v">a</i> &gt; <i class="v">b</i>，<i class="v">b</i> &gt; <i class="v">c</i>，那么 <i class="v">a</i> &gt; <i class="v">c</i>。</p></div>';
    }
  });

  /* ---------------- 定理：同角（等角）的补角/余角相等 ---------------- */
  M.slide({
    id: 's713-thm', sec: '7.1', lesson: L, kind: '定理', title: '从基本事实出发，证明已探索过的结论', layout: 'split', steps: 3,
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <div class="box thm"><span class="tag">定理</span><p>同角（或等角）的补角相等。</p></div>' +
        '  <div class="box thm"><span class="tag">定理</span><p>同角（或等角）的余角相等。</p></div>' +
        '  <div class="box thm"><span class="tag">定理</span><p>三角形的任意两边之和大于第三边。</p></div>' +
        '  <div id="suppProof"></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab"><div class="panel-title">同角的补角相等<span class="hint">拖动 ∠3 的边，∠1 与 ∠2 始终相等</span></div>' +
        '    <div class="fig drag-zone" id="suppFig"></div><div id="suppStats"></div></div>' +
        '</div>';
    },
    mount: function (body, api) {
      var proof = M.W.proof(M.$('#suppProof', body), {
        given: '∠1 与 ∠3 互补，∠2 与 ∠3 互补。', prove: '∠1 = ∠2。',
        lines: [
          { sym: '∵', text: '∠1 + ∠3 = 180°，∠2 + ∠3 = 180°', why: '补角的定义' },
          { sym: '∴', text: '∠1 = 180° − ∠3，∠2 = 180° − ∠3', why: '等式的性质' },
          { sym: '∴', text: '∠1 = ∠2', why: '等量代换' }
        ]
      });
      var svg = M.canvas(M.$('#suppFig', body), 660, 280);
      var O1 = { x: 175, y: 220 }, O2 = { x: 490, y: 220 };
      var a3 = 55;
      /* 左：∠3 与 ∠1 组成平角；右：∠3′（等于∠3）与 ∠2 组成平角 —— 为了看清“同角”，右边是∠3 的复制 */
      var g = S('g', {}, svg);
      function draw() {
        while (g.firstChild) g.removeChild(g.firstChild);
        [O1, O2].forEach(function (O, i) {
          var L1 = G.polar(O, 140, 180), R1 = G.polar(O, 140, 0), T = G.polar(O, 150, a3);
          S('line', { x1: L1.x, y1: L1.y, x2: R1.x, y2: R1.y, 'class': 'line' }, g);
          S('line', { x1: O.x, y1: O.y, x2: T.x, y2: T.y, 'class': 'line' }, g);
          GF.angle(g, O, 0, a3, { color: 'var(--a3)', label: '3', r: 36 });
          GF.angle(g, O, a3, 180, { color: i ? 'var(--a2)' : 'var(--a1)', label: i ? '2' : '1', r: 46 });
        });
        h.move(G.polar(O1, 130, a3).x, G.polar(O1, 130, a3).y);
        st.set('a3', a3); st.set('a1', 180 - a3); st.set('a2', 180 - a3);
      }
      var st = M.W.stats(M.$('#suppStats', body), [
        { key: 'a3', label: '∠3', unit: '°', d: 0 }, { key: 'a1', label: '∠1 = 180° − ∠3', unit: '°', d: 0, cls: 'acc' }, { key: 'a2', label: '∠2 = 180° − ∠3', unit: '°', d: 0, cls: 'acc' }
      ]);
      var h = M.handle(svg, 0, 0, { r: 10 });
      M.drag(h, { svg: svg, move: function (p) { a3 = M.clamp(Math.round(G.dir(O1, p)), 15, 165); draw(); } });
      draw();
      return { onStep: function (n) { proof.show(n); } };
    }
  });

  /* ---------------- 例：对顶角相等 ---------------- */
  M.slide({
    id: 's713-vertical', sec: '7.1', lesson: L, kind: '例题', title: '证明：对顶角相等', layout: 'split', steps: 5,
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <div class="row between"><span class="small ink2">分析：在基本事实和已证定理中，哪些结论可以断定两个角相等？</span><label class="blank-toggle"><input type="checkbox" id="blankT"> 理由挖空</label></div>' +
        '  <div id="vProof"></div>' +
        '  <div class="box thm" data-step="5"><span class="tag">定理</span><p>对顶角相等。</p></div>' +
        '  <p class="tiny muted">符号“∵”读作“因为”，“∴”读作“所以”。</p>' +
        '</div>' +
        '<div class="col"><div class="panel lab"><div class="panel-title">图形随证明步骤高亮</div><div class="fig" id="vFig"></div></div></div>';
    },
    mount: function (body, api) {
      var proof = M.W.proof(M.$('#vProof', body), {
        given: '如图，直线 ' + m('AB') + ' 与直线 ' + m('CD') + ' 相交于点 ' + m('O') + '，∠' + m('AOC') + ' 与 ∠' + m('BOD') + ' 是对顶角。',
        prove: '∠' + m('AOC') + ' = ∠' + m('BOD') + '。',
        lines: [
          { sym: '∵', text: '直线 ' + m('AB') + ' 与直线 ' + m('CD') + ' 相交于点 ' + m('O') + '，', why: '' },
          { sym: '∴', text: '∠' + m('AOB') + ' 和 ∠' + m('COD') + ' 都是平角', why: '平角的定义' },
          { sym: '∴', text: '∠' + m('AOC') + ' 和 ∠' + m('BOD') + ' 都是 ∠' + m('AOD') + ' 的补角', why: '补角的定义' },
          { sym: '∴', text: '∠' + m('AOC') + ' = ∠' + m('BOD'), why: '同角的补角相等' }
        ]
      });
      M.$('#blankT', body).addEventListener('change', function () { proof.setBlanks(this.checked); });
      var svg = M.canvas(M.$('#vFig', body), 620, 400);
      var O = { x: 310, y: 200 };
      var dA = 160, dB = 340, dC = 215, dD = 35;
      var P = function (d) { return G.polar(O, 230, d); };
      var gA = S('g', {}, svg);
      S('line', { x1: P(dA).x, y1: P(dA).y, x2: P(dB).x, y2: P(dB).y, 'class': 'line' }, svg);
      S('line', { x1: P(dC).x, y1: P(dC).y, x2: P(dD).x, y2: P(dD).y, 'class': 'line' }, svg);
      S('circle', { cx: O.x, cy: O.y, r: 4.5, 'class': 'pt' }, svg);
      [['A', dA], ['B', dB], ['C', dC], ['D', dD]].forEach(function (p) { var q = G.polar(O, 205, p[1] + (p[0] === 'A' || p[0] === 'B' ? 7 : -7)); M.label(svg, q.x, q.y + 7, '{' + p[0] + '}', { 'font-size': 22, 'text-anchor': 'middle' }); });
      M.label(svg, O.x, O.y + 34, '{O}', { 'font-size': 20, 'text-anchor': 'middle' });
      var mAOC = GF.angle(gA, O, dA, dC, { color: 'var(--a1)', r: 46, label: '∠{AOC}', labelOff: 30 });
      var mBOD = GF.angle(gA, O, dB, dD + 360, { color: 'var(--a2)', r: 46, label: '∠{BOD}', labelOff: 30 });
      var mAOD = GF.angle(gA, O, dD, dA, { color: 'var(--a3)', r: 58, label: '∠{AOD}', fillOpacity: 0.12 });
      var flatAB = GF.angle(gA, O, dB, dA + 360, { color: 'var(--amber)', r: 92, fillOpacity: 0.06, label: '平角 ∠{AOB}', labelOff: 18 });
      var flatCD = GF.angle(gA, O, dC, dD + 360, { color: 'var(--s4)', r: 92, fillOpacity: 0.06, label: '平角 ∠{COD}', labelOff: 18 });
      function vis(el, on) { el.style.transition = 'opacity .4s'; el.style.opacity = on ? 1 : 0; }
      function apply(n) {
        proof.show(n);
        vis(mAOC, n >= 1); vis(mBOD, n >= 1);
        vis(flatAB, n === 2); vis(flatCD, n === 2);
        vis(mAOD, n >= 3);
        [mAOC, mBOD].forEach(function (x) { x.classList.toggle('pulse', n >= 4); });
      }
      apply(0);
      return { onStep: apply };
    }
  });

  /* ---------------- 随堂练习：补全证明 ---------------- */
  M.slide({
    id: 's713-practice', sec: '7.1', lesson: L, kind: '随堂练习', kindCls: 'k-practice', title: '请你完成下面定理的证明', layout: 'split even',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <div class="box practice"><span class="tag">1</span><p>三角形的任意两边之和大于第三边。</p>' +
        '    <div class="fig fixed" id="triFig" style="min-height:9rem"></div>' +
        '    <button type="button" class="btn sm reveal-btn" data-reveal="pr1"></button>' +
        '    <div class="answer" id="pr1"><b>已知：</b>△' + m('ABC') + '。<b>求证：</b>' + m('AB') + ' + ' + m('AC') + ' &gt; ' + m('BC') + '，' + m('AB') + ' + ' + m('BC') + ' &gt; ' + m('AC') + '，' + m('AC') + ' + ' + m('BC') + ' &gt; ' + m('AB') + '。<br>' +
        '      <b>证明：</b>∵ 两点之间线段最短（基本事实），<br>∴ 连接点 ' + m('B') + '，' + m('C') + ' 的线段 ' + m('BC') + ' 比折线 ' + m('B') + '—' + m('A') + '—' + m('C') + ' 短，即 ' + m('AB') + ' + ' + m('AC') + ' &gt; ' + m('BC') + '。<br>同理，' + m('AB') + ' + ' + m('BC') + ' &gt; ' + m('AC') + '，' + m('AC') + ' + ' + m('BC') + ' &gt; ' + m('AB') + '。</div></div>' +
        '</div>' +
        '<div class="col scroll">' +
        '  <div class="box practice"><span class="tag">2</span><p>同角（或等角）的余角相等。</p>' +
        '    <button type="button" class="btn sm reveal-btn" data-reveal="pr2"></button>' +
        '    <div class="answer" id="pr2"><b>已知：</b>∠1 + ∠3 = 90°，∠2 + ∠3 = 90°。<b>求证：</b>∠1 = ∠2。<br>' +
        '      <b>证明：</b>∵ ∠1 + ∠3 = 90°，∠2 + ∠3 = 90°（已知），<br>∴ ∠1 = 90° − ∠3，∠2 = 90° − ∠3（等式的性质），<br>∴ ∠1 = ∠2（等量代换）。<br>' +
        '      <span class="small ink2">等角的情形：若 ∠1 + ∠3 = 90°，∠2 + ∠4 = 90°，且 ∠3 = ∠4，同样可证 ∠1 = ∠2。</span></div></div>' +
        '  <div class="box note"><span class="tag">证明的书写</span><p class="small">先写“已知”“求证”，再写“证明”。每一步都要有依据：已知条件、定义、基本事实或已经证明的定理，把依据写在括号里。</p></div>' +
        '</div>';
    },
    mount: function (body) {
      M.$$('[data-reveal]', body).forEach(function (b) { M.W.reveal(b, M.$('#' + b.getAttribute('data-reveal'), body)); });
      var svg = M.canvas(M.$('#triFig', body), 420, 170);
      var A = { x: 160, y: 24 }, B = { x: 40, y: 150 }, C = { x: 380, y: 150 };
      S('path', { d: 'M' + A.x + ' ' + A.y + ' L' + B.x + ' ' + B.y + ' L' + C.x + ' ' + C.y + ' Z', fill: 'var(--surface)', stroke: 'var(--ink)', 'stroke-width': 2.4 }, svg);
      S('path', { d: 'M' + B.x + ' ' + B.y + ' L' + A.x + ' ' + A.y + ' L' + C.x + ' ' + C.y, fill: 'none', stroke: 'var(--red)', 'stroke-width': 3, 'stroke-dasharray': '7 5' }, svg);
      S('line', { x1: B.x, y1: B.y, x2: C.x, y2: C.y, stroke: 'var(--s1)', 'stroke-width': 4 }, svg);
      M.label(svg, A.x, A.y - 6, '{A}', { 'font-size': 18, 'text-anchor': 'middle' });
      M.label(svg, B.x - 14, B.y + 6, '{B}', { 'font-size': 18, 'text-anchor': 'middle' });
      M.label(svg, C.x + 14, C.y + 6, '{C}', { 'font-size': 18, 'text-anchor': 'middle' });
      return {};
    }
  });

  /* ---------------- 阅读·欣赏：《原本》 ---------------- */
  M.slide({
    id: 's713-read', sec: '7.1', lesson: L, kind: '阅读·欣赏', kindCls: 'k-read', title: '《原本》：流传最广的数学名著', layout: 'split',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <ol class="timeline">' +
        '    <li><span class="yr">约公元前 300 年</span>古希腊数学家欧几里得著成《原本》（Elements），以公理和原始概念为基础推演出大量结论。</li>' +
        '    <li><span class="yr">1607 年</span>明代数学家徐光启与意大利人利玛窦合作，把前 6 卷（平面几何部分）译成中文，定名为《几何原本》。</li>' +
        '    <li><span class="yr">1857 年</span>清代数学家李善兰与英国人伟烈亚力合作，译出后 9 卷。</li>' +
        '  </ol>' +
        '  <div class="box read"><span class="tag">公理化方法</span><p class="small">从少数公理和原始概念出发，用演绎推理得到其他结论，这种研究问题的方法称为<b>公理化方法</b>。它标志着人类思维的一场革命，对数学及其他科学乃至人类的思想都产生了巨大的推动作用，牛顿写《自然哲学的数学原理》时就曾受到《原本》的启迪。</p></div>' +
        '  <div class="box think"><span class="tag">联系生活</span><p class="small">下棋、比赛、交流，也要先选定一些大家认可的规则作为出发点——这正是《原本》的思想。你还能举出这样的例子吗？</p></div>' +
        '</div>' +
        '<div class="col"><div class="panel lab"><div class="panel-title">《原本》第一卷命题 1<span class="hint">在已知线段上作等边三角形</span></div><div class="fig" id="eucFig"></div>' +
        '  <div class="btn-row"><button type="button" class="btn sm" id="eucPlay">' + M.icon('play') + '重新作图</button></div></div></div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var svg = M.canvas(M.$('#eucFig', body), 600, 380);
      var root = S('g', {}, svg);
      function play() {
        A.cancelAll();
        while (root.firstChild) root.removeChild(root.firstChild);
        var Pa = { x: 235, y: 250 }, Pb = { x: 365, y: 250 }, r = 130;
        var Pc = { x: 300, y: 240 - r * Math.sqrt(3) / 2 };
        var ab = S('line', { x1: Pa.x, y1: Pa.y, x2: Pa.x, y2: Pa.y, 'class': 'line' }, root);
        M.label(root, Pa.x - 18, Pa.y + 8, '{A}', { 'font-size': 20 });
        M.label(root, Pb.x + 8, Pb.y + 8, '{B}', { 'font-size': 20 });
        function circle(c, color, delay) {
          var p = S('path', { fill: 'none', 'stroke-width': 1.8, 'stroke-dasharray': '6 5' }, root);
          p.style.stroke = color;
          A.tween({ dur: 1400, delay: delay, ease: 'inOutSine', update: function (e) {
            var ang = 360 * e;
            p.setAttribute('d', ang >= 359.9 ? 'M' + (c.x + r) + ' ' + c.y + ' A' + r + ' ' + r + ' 0 1 0 ' + (c.x - r) + ' ' + c.y + ' A' + r + ' ' + r + ' 0 1 0 ' + (c.x + r) + ' ' + c.y : G.arcPath(c, r, 0, Math.max(0.1, ang)));
          } });
        }
        A.tween({ dur: 600, update: function (e) { M.attr(ab, { x2: M.lerp(Pa.x, Pb.x, e) }); } });
        circle(Pa, 'var(--s1)', 700);
        circle(Pb, 'var(--s2)', 2200);
        var cl = M.label(root, Pc.x, Pc.y - 12, '{C}', { 'font-size': 20, 'text-anchor': 'middle', opacity: 0 });
        var dot = S('circle', { cx: Pc.x, cy: Pc.y, r: 5, fill: 'var(--red)', opacity: 0 }, root);
        var tri = S('path', { d: 'M' + Pa.x + ' ' + Pa.y + ' L' + Pc.x + ' ' + Pc.y + ' L' + Pb.x + ' ' + Pb.y, fill: 'none', stroke: 'var(--red)', 'stroke-width': 3, 'stroke-linejoin': 'round' }, root);
        var len = 2 * r + 2;
        tri.setAttribute('stroke-dasharray', len); tri.setAttribute('stroke-dashoffset', len);
        A.tween({ dur: 400, delay: 3700, update: function (e) { dot.setAttribute('opacity', e); cl.setAttribute('opacity', e); } });
        A.tween({ dur: 900, delay: 4100, ease: 'inOutCubic', update: function (e) { tri.setAttribute('stroke-dashoffset', len * (1 - e)); } });
        var cap = S('text', { x: 300, y: 28, 'text-anchor': 'middle', 'font-size': 16, 'class': 't-ink', opacity: 0, text: 'AC = AB，BC = BA（同圆的半径相等），所以 AB = BC = CA' }, root);
        A.tween({ dur: 500, delay: 5000, update: function (e) { cap.setAttribute('opacity', e); } });
      }
      M.$('#eucPlay', body).addEventListener('click', play);
      return { enter: play };
    }
  });
})(window.M);
