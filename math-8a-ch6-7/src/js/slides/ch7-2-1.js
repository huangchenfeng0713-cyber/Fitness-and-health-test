/* 7.2 平行线的证明 · 第1课时 平行线的判定定理 */
(function (M) {
  'use strict';
  var S = M.svg, G = M.geo, GF = M.GF;
  var L = '第1课时 平行线的判定定理';
  var m = function (s) { return '<span class="m">' + s + '</span>'; };
  var BOX = [20, 20, 640, 390];
  var NUM = { P1: '1', P2: '2', P3: '3', P4: '4', Q1: '5', Q2: '6', Q3: '7', Q4: '8' };
  var PAIRS = {
    corr: [['P1', 'Q1'], ['P2', 'Q2'], ['P3', 'Q3'], ['P4', 'Q4']],
    alt: [['P3', 'Q1'], ['P4', 'Q2']],
    same: [['P3', 'Q2'], ['P4', 'Q1']]
  };
  var TYPE_NAME = { corr: '同位角', alt: '内错角', same: '同旁内角' };
  var TYPE_COLOR = { corr: 'var(--a2)', alt: 'var(--a1)', same: 'var(--a3)' };
  M.GF.PAIRS = PAIRS;

  function baseFig(svg, extra) {
    return GF.transversal(svg, Object.assign({
      box: BOX,
      a: { p: { x: 330, y: 135 }, dir: 0 },
      b: { p: { x: 330, y: 285 }, dir: 0 },
      c: { p: { x: 330, y: 210 }, dir: 65 }
    }, extra || {}));
  }
  /* 画 F / Z / U 形轮廓 */
  function pairShape(fig, g, pair, color) {
    while (g.firstChild) g.removeChild(g.firstChild);
    var P = fig.P(), Q = fig.Q();
    var st = fig.st;
    var ra = Math.cos(st.a.dir * G.RAD) < 0 ? st.a.dir + 180 : st.a.dir;
    var rb = Math.cos(st.b.dir * G.RAD) < 0 ? st.b.dir + 180 : st.b.dir;
    var cu = Math.sin(st.c.dir * G.RAD) < 0 ? st.c.dir + 180 : st.c.dir;
    var side = function (key) { return ({ 1: 'R', 2: 'L', 3: 'L', 4: 'R' })[key.slice(1)]; };
    var vert = function (key) { return ({ 1: 'U', 2: 'U', 3: 'D', 4: 'D' })[key.slice(1)]; };
    var k1 = pair[0], k2 = pair[1];
    var armA = G.polar(P, 110, side(k1) === 'R' ? ra : ra + 180);
    var armB = G.polar(Q, 110, side(k2) === 'R' ? rb : rb + 180);
    var d;
    if (vert(k1) === vert(k2)) {
      /* 同位角：截线穿过两个交点再伸出去 */
      var ext = vert(k1) === 'U' ? G.polar(P, 70, cu) : G.polar(Q, 70, cu + 180);
      var start = vert(k1) === 'U' ? Q : P;
      d = 'M' + armB.x + ' ' + armB.y + ' L' + Q.x + ' ' + Q.y + ' M' + start.x + ' ' + start.y + ' L' + ext.x + ' ' + ext.y + ' M' + P.x + ' ' + P.y + ' L' + armA.x + ' ' + armA.y;
    } else {
      d = 'M' + armA.x + ' ' + armA.y + ' L' + P.x + ' ' + P.y + ' L' + Q.x + ' ' + Q.y + ' L' + armB.x + ' ' + armB.y;
    }
    var p = S('path', { d: d, fill: 'none', 'stroke-width': 14, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.28 }, g);
    p.style.stroke = color;
    var len = p.getTotalLength ? p.getTotalLength() : 600;
    p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
    p.style.transition = 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)';
    requestAnimationFrame(function () { requestAnimationFrame(function () { p.style.strokeDashoffset = 0; }); });
  }

  /* ---------------- 三线八角 ---------------- */
  M.slide({
    id: 's721-angles', sec: '7.2', lesson: L, kind: '复习', title: '两条直线被第三条直线所截：三类角', layout: 'split lab-wide',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p>直线 <i class="v">a</i>，<i class="v">b</i> 被直线 <i class="v">c</i> 所截，构成 8 个角。按位置关系可以分成三类：</p>' +
        '  <div class="type-card" style="--c:var(--a2)"><b>同位角</b><span>在 <i class="v">a</i>，<i class="v">b</i> 的同一方，在 <i class="v">c</i> 的同侧，像字母 <em class="shape">F</em></span><small>∠1 与 ∠5，∠2 与 ∠6，∠3 与 ∠7，∠4 与 ∠8</small></div>' +
        '  <div class="type-card" style="--c:var(--a1)"><b>内错角</b><span>在 <i class="v">a</i>，<i class="v">b</i> 之间，在 <i class="v">c</i> 的两侧，像字母 <em class="shape">Z</em></span><small>∠3 与 ∠5，∠4 与 ∠6</small></div>' +
        '  <div class="type-card" style="--c:var(--a3)"><b>同旁内角</b><span>在 <i class="v">a</i>，<i class="v">b</i> 之间，在 <i class="v">c</i> 的同侧，像字母 <em class="shape">U</em></span><small>∠3 与 ∠6，∠4 与 ∠5</small></div>' +
        '  <p class="small muted">拖动圆点可以改变直线 <i class="v">b</i> 与截线 <i class="v">c</i> 的位置，角的类别不变。</p>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="row between"><div id="typeSeg"></div><button type="button" class="btn sm" id="nextPair">下一对' + M.icon('right') + '</button></div>' +
        '    <div class="fig drag-zone" id="angFig"></div>' +
        '    <div class="row between"><div class="quiz-inline" id="angQuiz"></div><button type="button" class="btn sm" id="angTest">' + M.icon('spark') + '考考你</button></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var svg = M.canvas(M.$('#angFig', body), 660, 410);
      var gShape = S('g', {}, svg);
      var fig = baseFig(svg);
      svg.appendChild(gShape); svg.insertBefore(gShape, fig.g);
      var keys = ['P1', 'P2', 'P3', 'P4', 'Q1', 'Q2', 'Q3', 'Q4'];
      function drawAll(hl, color) {
        keys.forEach(function (k) {
          var on = hl && hl.indexOf(k) >= 0;
          fig.mark(k, { color: on ? color : 'var(--ink-3)', label: NUM[k], r: on ? 34 : 24, fillOpacity: 0.28, fontSize: on ? 21 : 17, noArc: !on });
        });
      }
      var type = 'corr', idx = 0;
      function show() {
        var pair = PAIRS[type][idx % PAIRS[type].length];
        drawAll(pair, TYPE_COLOR[type]);
        pairShape(fig, gShape, pair, TYPE_COLOR[type]);
      }
      M.W.seg(M.$('#typeSeg', body), ['同位角', '内错角', '同旁内角'], function (i) { type = ['corr', 'alt', 'same'][i]; idx = 0; quiz = null; M.$('#angQuiz', body).innerHTML = ''; show(); });
      M.$('#nextPair', body).addEventListener('click', function () { idx++; quiz = null; M.$('#angQuiz', body).innerHTML = ''; show(); });
      /* 拖动：b 绕交点转、c 绕中点转 */
      var hb = M.handle(svg, 0, 0, { r: 10, color: 'var(--ink-2)' });
      var hc = M.handle(svg, 0, 0, { r: 10 });
      function placeHandles() {
        var Q = fig.Q(), P = fig.P();
        var pb = G.polar(Q, 250, fig.st.b.dir), pc = G.polar(P, 90, fig.st.c.dir);
        hb.move(pb.x, pb.y); hc.move(pc.x, pc.y);
      }
      M.drag(hb, { svg: svg, move: function (p) { var Q = fig.Q(); var d = M.clamp(G.dir(Q, p), -30, 30); fig.set({ b: { p: Q, dir: d } }); placeHandles(); show(); } });
      M.drag(hc, { svg: svg, move: function (p) { var c0 = fig.st.c.p; var d = M.clamp(G.dir(c0, p), 35, 145); fig.set({ c: { dir: d } }); placeHandles(); show(); } });
      /* 考考你 */
      var quiz = null;
      M.$('#angTest', body).addEventListener('click', function () {
        var all = [];
        Object.keys(PAIRS).forEach(function (t) { PAIRS[t].forEach(function (p) { all.push({ t: t, p: p }); }); });
        quiz = all[Math.floor(Math.random() * all.length)];
        drawAll(quiz.p, 'var(--red)');
        while (gShape.firstChild) gShape.removeChild(gShape.firstChild);
        var q = M.$('#angQuiz', body);
        q.innerHTML = '<span>∠' + NUM[quiz.p[0]] + ' 与 ∠' + NUM[quiz.p[1]] + ' 是：</span>';
        ['corr', 'alt', 'same'].forEach(function (t) {
          var b = M.el('button', { type: 'button', 'class': 'btn sm', text: TYPE_NAME[t] });
          b.addEventListener('click', function () {
            if (!quiz) return;
            if (t === quiz.t) { b.classList.add('on'); pairShape(fig, gShape, quiz.p, TYPE_COLOR[t]); drawAll(quiz.p, TYPE_COLOR[t]); M.toast('✓ 正确！是' + TYPE_NAME[t], 1500); quiz = null; }
            else { b.style.borderColor = 'var(--red)'; b.style.color = 'var(--red)'; }
          });
          q.appendChild(b);
        });
      });
      placeHandles();
      show();
      return {};
    }
  });

  /* ---------------- 基本事实：同位角相等，两直线平行 ---------------- */
  M.slide({
    id: 's721-fact', sec: '7.2', lesson: L, kind: '基本事实', title: '同位角相等，两直线平行', layout: 'split',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p>前面我们探索过两条直线平行的哪些判定条件？</p>' +
        '  <div class="box fact"><span class="tag">基本事实</span><p>两条直线被第三条直线所截，如果同位角相等，那么这两条直线平行。</p><p class="short">简述为：同位角相等，两直线平行。</p></div>' +
        '  <p>它是本书选用的基本事实之一，可以直接作为证明的依据。</p>' +
        '  <div class="box think" data-step="1"><span class="tag">想一想</span><p>“内错角相等，两直线平行”“同旁内角互补，两直线平行”也是我们探索过的判定条件。利用“同位角相等，两直线平行”这个基本事实，你能<b>证明</b>它们吗？</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">转动直线 <i class="v">b</i><span class="hint">拖动 <i class="v">b</i> 右端的圆点</span></div>' +
        '    <div class="fig drag-zone" id="factFig"></div>' +
        '    <div class="row between"><button type="button" class="btn" id="toPar">' + M.icon('play') + '转到 ∠1 = ∠5</button><div id="factStats" class="grow" style="max-width:26rem"></div></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var svg = M.canvas(M.$('#factFig', body), 660, 410);
      var fig = baseFig(svg);
      var Q0 = fig.Q();
      fig.set({ b: { p: Q0, dir: -14 } });
      var badge = S('g', { opacity: 0 }, svg);
      S('rect', { x: 490, y: 26, width: 140, height: 44, rx: 22, fill: 'var(--accent)' }, badge);
      var bt = S('text', { x: 560, y: 55, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 700, 'class': 't-m' }, badge);
      bt.style.fill = 'var(--on-accent)'; bt.textContent = 'a ∥ b';
      var h = M.handle(svg, 0, 0, { r: 11 });
      var stats = M.W.stats(M.$('#factStats', body), [
        { key: 'a1', label: '∠1', unit: '°', d: 1, color: 'var(--a2)' }, { key: 'a5', label: '∠5', unit: '°', d: 1, color: 'var(--a1)' }
      ]);
      function update() {
        var d = fig.st.b.dir;
        fig.mark('P1', { color: 'var(--a2)', label: '1', r: 34 });
        fig.mark('Q1', { color: Math.abs(d) < 0.05 ? 'var(--a2)' : 'var(--a1)', label: '5', r: 34 });
        var par = Math.abs(d) < 0.05;
        fig.parallel(par);
        fig.lines.a.style.stroke = par ? 'var(--accent)' : ''; fig.lines.b.style.stroke = par ? 'var(--accent)' : '';
        badge.style.transition = 'opacity .35s'; badge.style.opacity = par ? 1 : 0;
        var p = G.polar(Q0, 240, d); h.move(p.x, p.y);
        stats.set('a1', fig.value('P1')); stats.set('a5', fig.value('Q1'));
      }
      M.drag(h, { svg: svg, move: function (p) {
        var d = M.clamp(G.dir(Q0, p), -28, 28);
        if (Math.abs(d) < 1.2) d = 0;
        fig.set({ b: { dir: d } }); update();
      } });
      function toPar() {
        var from = fig.st.b.dir;
        A.tween({ dur: 900, ease: 'inOutCubic', update: function (e) { fig.set({ b: { dir: from * (1 - e) } }); update(); } });
      }
      M.$('#toPar', body).addEventListener('click', toPar);
      update();
      return { onStep: function (n) { if (n >= 1 && fig.st.b.dir !== 0) toPar(); } };
    }
  });

  /* 证明页通用：左侧证明，右侧图形随步骤高亮，可转动截线 */
  function proofSlide(def) {
    M.slide({
      id: def.id, sec: '7.2', lesson: def.lesson || L, kind: def.kind || '定理', kindCls: def.kindCls, title: def.title, layout: 'split', steps: def.lines.length,
      html: function () {
        return '' +
          '<div class="col scroll">' +
          '  <div class="box thm"><span class="tag">定理</span><p>' + def.thm + '</p><p class="short">简述为：' + def.short + '。</p></div>' +
          '  <div class="row between"><span class="small ink2">' + (def.hint || '') + '</span><label class="blank-toggle"><input type="checkbox" class="blankT"' + (def.blanks ? ' checked' : '') + '> 理由挖空</label></div>' +
          '  <div class="proof-host"></div>' +
          (def.extra || '') +
          '</div>' +
          '<div class="col"><div class="panel lab"><div class="panel-title">' + (def.figTitle || '图形随步骤高亮') + '<span class="hint">拖动圆点转动截线 <i class="v">' + (def.cName || 'c') + '</i></span></div><div class="fig drag-zone fig-host"></div>' + (def.readout ? '<div class="readout-host"></div>' : '') + (def.figFoot || '') + '</div></div>';
      },
      mount: function (body, api) {
        var proof = M.W.proof(M.$('.proof-host', body), { given: def.given, prove: def.prove, blanks: def.blanks, lines: def.lines.map(function (l) { return { sym: l[0], text: l[1], why: l[2] }; }) });
        M.$('.blankT', body).addEventListener('change', function () { proof.setBlanks(this.checked); });
        var stats = def.readout ? M.W.stats(M.$('.readout-host', body), def.readout.map(function (r, i) {
          return { key: r[0], label: '∠' + r[1], unit: '°', d: 0, color: def.marks[r[0]] && def.marks[r[0]].color };
        })) : null;
        var svg = M.canvas(M.$('.fig-host', body), 660, 410);
        var fig = baseFig(svg, def.figOpts);
        var hc = M.handle(svg, 0, 0, { r: 10 });
        var step = 0;
        function draw() {
          Object.keys(def.marks).forEach(function (k) {
            var mk = def.marks[k];
            fig.mark(k, { color: mk.color, label: mk.label, r: mk.r || 34 });
          });
          var focus = def.focus[step] || null;
          fig.focus(focus);
          fig.parallel(def.parallelAt != null ? step >= def.parallelAt : true);
          var pc = G.polar(fig.P(), 95, fig.st.c.dir); hc.move(pc.x, pc.y);
          if (stats) def.readout.forEach(function (r) { stats.set(r[0], fig.value(r[0])); });
        }
        M.drag(hc, { svg: svg, move: function (p) { var d = M.clamp(G.dir(fig.st.c.p, p), 35, 145); fig.set({ c: { dir: d } }); draw(); } });
        draw();
        return { onStep: function (n) { step = n; proof.show(n); draw(); } };
      }
    });
  }
  M.proofSlide = proofSlide;

  /* ---------------- 定理：内错角相等，两直线平行 ---------------- */
  proofSlide({
    id: 's721-alt', title: '证明：内错角相等，两直线平行',
    thm: '两条直线被第三条直线所截，如果内错角相等，那么这两条直线平行。', short: '内错角相等，两直线平行',
    hint: '分析：能利用“同位角相等，两直线平行”这一基本事实吗？',
    given: '如图，∠1 和 ∠2 是直线 <i class="v">a</i>，<i class="v">b</i> 被直线 <i class="v">c</i> 截出的内错角，且 ∠1 = ∠2。',
    prove: '<i class="v">a</i> ∥ <i class="v">b</i>。',
    lines: [
      ['∵', '∠1 = ∠2', '已知'],
      ['', '∠1 = ∠3', '对顶角相等'],
      ['∴', '∠3 = ∠2', '等量代换'],
      ['∴', '<i class="v">a</i> ∥ <i class="v">b</i>', '同位角相等，两直线平行']
    ],
    marks: { P3: { color: 'var(--a1)', label: '1' }, Q1: { color: 'var(--a2)', label: '2' }, P1: { color: 'var(--a3)', label: '3' } },
    focus: { 0: null, 1: ['P3', 'Q1'], 2: ['P3', 'P1'], 3: ['P1', 'Q1'], 4: ['P1', 'Q1'] },
    parallelAt: 4
  });

  /* ---------------- 定理：同旁内角互补，两直线平行 ---------------- */
  proofSlide({
    id: 's721-same', title: '证明：同旁内角互补，两直线平行',
    thm: '两条直线被第三条直线所截，如果同旁内角互补，那么这两条直线平行。', short: '同旁内角互补，两直线平行',
    hint: '分析：∠1 与哪个角是同位角？它和 ∠2 有什么关系？',
    given: '如图，∠1 和 ∠2 是直线 <i class="v">a</i>，<i class="v">b</i> 被直线 <i class="v">c</i> 截出的同旁内角，且 ∠1 与 ∠2 互补。',
    prove: '<i class="v">a</i> ∥ <i class="v">b</i>。',
    lines: [
      ['∵', '∠1 与 ∠2 互补', '已知'],
      ['∴', '∠1 + ∠2 = 180°', '互补的定义'],
      ['∴', '∠1 = 180° − ∠2', '等式的性质'],
      ['∵', '∠3 + ∠2 = 180°', '平角的定义'],
      ['∴', '∠3 = 180° − ∠2', '等式的性质'],
      ['∴', '∠1 = ∠3', '等量代换'],
      ['∴', '<i class="v">a</i> ∥ <i class="v">b</i>', '同位角相等，两直线平行']
    ],
    marks: { P3: { color: 'var(--a1)', label: '1' }, Q2: { color: 'var(--a2)', label: '2' }, Q3: { color: 'var(--a3)', label: '3' } },
    focus: { 0: null, 1: ['P3', 'Q2'], 2: ['P3', 'Q2'], 3: ['P3', 'Q2'], 4: ['Q2', 'Q3'], 5: ['Q2', 'Q3'], 6: ['P3', 'Q3'], 7: ['P3', 'Q3'] },
    parallelAt: 7,
    extra: '<details class="alt-proof"><summary>还有其他证法吗？</summary><p class="small">记 ∠2 右侧的邻补角为 ∠4，则 ∠4 + ∠2 = 180°（平角的定义）。又 ∠1 + ∠2 = 180°，所以 ∠1 = ∠4（同角的补角相等）。∠1 与 ∠4 是内错角，所以 <i class="v">a</i> ∥ <i class="v">b</i>（内错角相等，两直线平行）。</p></details>' +
      '<div class="box note"><span class="tag">记住</span><p class="small">已给的基本事实、定义和已经证明的定理，以后都可以作为依据，用来证明新的结论。</p></div>'
  });

  /* ---------------- 思考·交流：推平行线、折平行线 ---------------- */
  M.slide({
    id: 's721-draw', sec: '7.2', lesson: L, kind: '思考·交流', title: '用三角尺和直尺画平行线，道理是什么？', layout: 'split',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <ol class="qlist">' +
        '    <li>我们常用右图的方法画平行线：直尺不动，三角尺紧靠直尺平移，沿三角尺的同一条边画线。你能说说其中的道理吗？' +
        '      <span class="ans" data-step="1">平移时，三角尺的边与直尺所成的角始终不变，画出的两条直线被直尺所截的<b>同位角相等</b>，所以两直线平行（同位角相等，两直线平行）。</span></li>' +
        '    <li>在一张不规则的四边形纸片上折出平行线，并予以证明；与同伴交流各自的折纸方法与证明过程。' +
        '      <span class="ans" data-step="2">先折出一条折痕 <i class="v">l</i>；再沿与 <i class="v">l</i> 垂直的方向（把 <i class="v">l</i> 对折重合）折两次，得折痕 <i class="v">m</i>，<i class="v">n</i>。<i class="v">m</i>，<i class="v">n</i> 与 <i class="v">l</i> 所成的同位角都是 90°，所以 <i class="v">m</i> ∥ <i class="v">n</i>。</span></li>' +
        '  </ol>' +
        '  <p class="small ink2" data-step="2">木工师傅用直角尺画平行线，道理也一样。</p>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab"><div class="row between"><div id="drawSeg"></div><button type="button" class="btn sm" id="drawPlay">' + M.icon('play') + '演示</button></div><div class="fig" id="drawFig"></div></div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var svg = M.canvas(M.$('#drawFig', body), 660, 400);
      var root = S('g', {}, svg);
      var view = 0;
      function slide() {
        A.cancelAll();
        while (root.firstChild) root.removeChild(root.firstChild);
        /* 直尺 */
        var ry = 300;
        S('rect', { x: 30, y: ry, width: 600, height: 44, rx: 6, fill: 'var(--amber-tint)', stroke: 'var(--amber)', 'stroke-width': 2 }, root);
        for (var i = 0; i <= 30; i++) S('line', { x1: 40 + i * 19, x2: 40 + i * 19, y1: ry, y2: ry + (i % 5 ? 9 : 16), stroke: 'var(--amber)', 'stroke-width': 1.5 }, root);
        S('text', { x: 600, y: ry + 34, 'text-anchor': 'end', 'font-size': 13, text: '直尺（不动）' }, root).style.fill = 'var(--amber)';
        var lines = S('g', {}, root);
        /* 三角尺：直角在左下，斜边在右上 */
        var tri = S('g', {}, root);
        var tp = S('path', { d: 'M0 0 L0 -200 L150 0 Z', 'stroke-width': 2, opacity: 0.85 }, tri);
        tp.style.fill = 'var(--s1-tint)'; tp.style.stroke = 'var(--s1)';
        S('path', { d: 'M0 -14 h14 v14', fill: 'none', stroke: 'var(--s1)', 'stroke-width': 1.6 }, tri);
        var edgeDir = G.dir({ x: 150, y: 0 }, { x: 0, y: -200 });
        function place(x) { tri.setAttribute('transform', 'translate(' + x + ',' + ry + ')'); }
        function drawLine(x, delay) {
          var p1 = { x: x + 150 + 40 * Math.cos(edgeDir * G.RAD) * -1, y: ry + 0 }, top = { x: x, y: ry - 200 };
          var a = { x: x + 150 + 45 * (150 / 250), y: ry + 45 * (200 / 250) }, b = { x: x - 45 * (150 / 250), y: ry - 200 - 45 * (200 / 250) };
          var ln = S('line', { x1: a.x, y1: a.y, x2: a.x, y2: a.y, stroke: 'var(--red)', 'stroke-width': 3, 'stroke-linecap': 'round' }, lines);
          return A.tween({ dur: 700, delay: delay, ease: 'inOutCubic', update: function (e) { M.attr(ln, { x2: M.lerp(a.x, b.x, e), y2: M.lerp(a.y, b.y, e) }); } }).promise.then(function () {
            M.GF.angle(lines, { x: x + 150, y: ry }, 0, edgeDir, { color: 'var(--a2)', r: 30, label: '∠' + (x < 200 ? '1' : '2'), fontSize: 17 });
          });
        }
        place(90);
        drawLine(90, 300).then(function (ok) {
          if (ok === false) return;
          return A.tween({ dur: 1300, ease: 'inOutCubic', update: function (e) { place(M.lerp(90, 330, e)); } }).promise;
        }).then(function (ok) {
          if (ok === false) return;
          return drawLine(330, 100);
        }).then(function () {
          S('text', { x: 330, y: 40, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, 'class': 't-ink', text: '∠1 = ∠2（同位角） ⇒ 两条红线平行' }, root);
        });
      }
      function fold() {
        A.cancelAll();
        while (root.firstChild) root.removeChild(root.firstChild);
        S('path', { d: 'M60 70 L560 40 L610 330 L90 360 Z', fill: 'var(--surface-2)', stroke: 'var(--line-2)', 'stroke-width': 2 }, root);
        var l = S('line', { x1: 70, y1: 250, x2: 600, y2: 190, stroke: 'var(--ink)', 'stroke-width': 2.5, 'stroke-dasharray': '10 6' }, root);
        var ld = G.dir({ x: 70, y: 250 }, { x: 600, y: 190 });
        M.label(root, 604, 184, '{l}', { 'font-size': 20 });
        [[220, 'm'], [430, 'n']].forEach(function (c, i) {
          var base = G.lerpPt({ x: 70, y: 250 }, { x: 600, y: 190 }, (c[0] - 70) / 530);
          var up = G.polar(base, 170, ld + 90), dn = G.polar(base, 110, ld - 90);
          var ln = S('line', { x1: base.x, y1: base.y, x2: base.x, y2: base.y, stroke: 'var(--red)', 'stroke-width': 2.5, 'stroke-dasharray': '10 6' }, root);
          A.tween({ dur: 800, delay: 400 + i * 900, ease: 'inOutCubic', update: function (e) {
            M.attr(ln, { x1: M.lerp(base.x, dn.x, e), y1: M.lerp(base.y, dn.y, e), x2: M.lerp(base.x, up.x, e), y2: M.lerp(base.y, up.y, e) });
          }, done: function () {
            M.GF.right(root, base, ld, 14, 'var(--red)');
            M.label(root, up.x + 8, up.y + 4, '{' + c[1] + '}', { 'font-size': 20 });
          } });
        });
        var t = S('text', { x: 330, y: 385, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 700, 'class': 't-ink', opacity: 0, text: 'm ⊥ l，n ⊥ l，同位角都是 90° ⇒ m ∥ n' }, root);
        A.tween({ dur: 500, delay: 2400, update: function (e) { t.setAttribute('opacity', e); } });
      }
      var seg = M.W.seg(M.$('#drawSeg', body), ['推平行线', '折平行线'], function (i) { view = i; (i ? fold : slide)(); });
      M.$('#drawPlay', body).addEventListener('click', function () { (view ? fold : slide)(); });
      return {
        enter: function () { view = 0; seg.pick(0); slide(); },
        onStep: function (n) { var v = n >= 2 ? 1 : 0; if (v !== view) { view = v; seg.pick(v); (v ? fold : slide)(); } }
      };
    }
  });

  /* ---------------- 随堂练习 ---------------- */
  M.slide({
    id: 's721-practice', sec: '7.2', lesson: L, kind: '随堂练习', kindCls: 'k-practice', title: '判定定理练一练', layout: 'split even',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <div class="box practice"><span class="tag">1</span><p>蜂房的顶部由三个全等的四边形围成，每个四边形的形状如图，其中 ∠α = 109°28′，∠β = 70°32′。试确定这个四边形对边的位置关系，并证明你的结论。</p>' +
        '    <div class="fig fixed" id="honeyFig" style="min-height:10rem"></div>' +
        '    <button type="button" class="btn sm reveal-btn" data-reveal="h1"></button>' +
        '    <div class="answer" id="h1">对边分别平行。∵ ∠α + ∠β = 109°28′ + 70°32′ = 180°，<br>相邻两个顶点处的 ∠α，∠β 是一组对边被另一边所截得的<b>同旁内角</b>，<br>∴ 这组对边平行（同旁内角互补，两直线平行）。同理，另一组对边也平行。</div></div>' +
        '</div>' +
        '<div class="col scroll">' +
        '  <div class="box practice"><span class="tag">2</span><p>如图，四边形 ' + m('ABCD') + ' 中，连接 ' + m('AC') + '。<br>（1）如果 ∠1 = ∠2，可以判定哪两条直线平行？<br>（2）如果 ∠3 = ∠4 呢？</p>' +
        '    <div class="fig fixed" id="quadFig" style="min-height:10rem"></div>' +
        '    <button type="button" class="btn sm reveal-btn" data-reveal="h2"></button>' +
        '    <div class="answer" id="h2">（1）∠1，∠2 是直线 ' + m('AD') + '，' + m('BC') + ' 被 ' + m('AC') + ' 所截得的内错角，所以 <b>' + m('AD') + ' ∥ ' + m('BC') + '</b>（内错角相等，两直线平行）。<br>（2）∠3，∠4 是直线 ' + m('AB') + '，' + m('DC') + ' 被 ' + m('AC') + ' 所截得的内错角，所以 <b>' + m('AB') + ' ∥ ' + m('DC') + '</b>。<br><span class="small red">易错：不要把 (1) 判断成 ' + m('AB') + ' ∥ ' + m('DC') + '，要先看清“三线”。</span></div></div>' +
        '</div>';
    },
    mount: function (body) {
      M.$$('[data-reveal]', body).forEach(function (b) { M.W.reveal(b, M.$('#' + b.getAttribute('data-reveal'), body)); });
      /* 蜂房四边形 */
      var s1 = M.canvas(M.$('#honeyFig', body), 440, 190);
      var a = 70.533, side = 150;
      var P0 = { x: 90, y: 160 }, P1 = { x: 90 + side, y: 160 };
      var P3 = G.polar(P0, side, a), P2 = { x: P3.x + side, y: P3.y };
      S('path', { d: 'M' + P0.x + ' ' + P0.y + ' L' + P1.x + ' ' + P1.y + ' L' + P2.x + ' ' + P2.y + ' L' + P3.x + ' ' + P3.y + ' Z', fill: 'var(--amber-tint)', stroke: 'var(--amber)', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, s1);
      GF.angle(s1, P0, 0, a, { color: 'var(--a2)', label: 'β', r: 26 });
      GF.angle(s1, P1, a, 180, { color: 'var(--a1)', label: 'α', r: 26 });
      GF.angle(s1, P2, 180, 180 + a, { color: 'var(--a2)', label: 'β', r: 26 });
      GF.angle(s1, P3, 180 + a, 360, { color: 'var(--a1)', label: 'α', r: 26 });
      /* 四边形 ABCD 与对角线 AC */
      var s2 = M.canvas(M.$('#quadFig', body), 440, 190);
      var A = { x: 110, y: 30 }, B = { x: 330, y: 30 }, C = { x: 390, y: 170 }, D = { x: 50, y: 170 };
      S('path', { d: 'M' + A.x + ' ' + A.y + ' L' + B.x + ' ' + B.y + ' L' + C.x + ' ' + C.y + ' L' + D.x + ' ' + D.y + ' Z', fill: 'var(--surface)', stroke: 'var(--ink)', 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, s2);
      S('line', { x1: A.x, y1: A.y, x2: C.x, y2: C.y, stroke: 'var(--ink)', 'stroke-width': 2 }, s2);
      var sp = G.innerSpan(A, D, C); GF.angle(s2, A, sp.a0, sp.a1, { color: 'var(--a1)', label: '1', r: 30, fontSize: 16 });
      sp = G.innerSpan(C, B, A); GF.angle(s2, C, sp.a0, sp.a1, { color: 'var(--a1)', label: '2', r: 30, fontSize: 16 });
      sp = G.innerSpan(A, C, B); GF.angle(s2, A, sp.a0, sp.a1, { color: 'var(--a2)', label: '3', r: 42, fontSize: 16 });
      sp = G.innerSpan(C, A, D); GF.angle(s2, C, sp.a0, sp.a1, { color: 'var(--a2)', label: '4', r: 42, fontSize: 16 });
      [['A', A, -10, -8], ['B', B, 12, -8], ['C', C, 14, 12], ['D', D, -16, 12]].forEach(function (q) { M.label(s2, q[1].x + q[2], q[1].y + q[3], '{' + q[0] + '}', { 'font-size': 18, 'text-anchor': 'middle' }); });
      return {};
    }
  });
})(window.M);
