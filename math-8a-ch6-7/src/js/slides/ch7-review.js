/* 第七章 回顾与思考：证明之树 + 回顾与思考 + 综合练习 */
(function (M) {
  'use strict';
  var S = M.svg, G = M.geo, GF = M.GF;
  var m = M.m;
  var v = function (s) { return '<i class="v">' + s + '</i>'; };

  /* ---------------- 证明之树 ---------------- */
  var KIND = {
    def: { name: '定义', color: 'var(--ink-3)' },
    fact: { name: '基本事实', color: 'var(--amber)' },
    thm: { name: '定理（7.1）', color: 'var(--accent)' },
    judge: { name: '平行线的判定', color: 'var(--a2)' },
    prop: { name: '平行线的性质', color: 'var(--a3)' },
    more: { name: '更多结论', color: 'var(--a4)' }
  };
  var NODES = {
    D2: { x: 75, y: 545, t: ['补角的定义'], k: 'def', full: '如果两个角的和等于 180°，那么这两个角互为补角（互补）。', go: 's712-def' },
    D3: { x: 210, y: 545, t: ['余角的定义'], k: 'def', full: '如果两个角的和等于 90°，那么这两个角互为余角（互余）。', go: 's712-def' },
    F1: { x: 345, y: 545, t: ['两点之间', '线段最短'], k: 'fact', full: '两点之间线段最短。', go: 's713-facts' },
    D1: { x: 490, y: 545, t: ['平角的定义'], k: 'def', full: '一条射线绕它的端点旋转，当终边和始边成一条直线时，所成的角叫作平角。平角等于 180°。', go: 's712-def' },
    F2: { x: 660, y: 545, t: ['同位角相等，', '两直线平行'], k: 'fact', full: '两条直线被第三条直线所截，如果同位角相等，那么这两条直线平行。', go: 's721-fact' },
    F3: { x: 900, y: 545, t: ['过直线外一点有且只有', '一条直线与这条直线平行'], k: 'fact', full: '过直线外一点有且只有一条直线与这条直线平行。', go: 's713-facts' },
    T1: { x: 75, y: 430, t: ['同角（等角）的', '补角相等'], k: 'thm', full: '同角（或等角）的补角相等。', go: 's713-thm', by: ['D2'], extra: '等式的性质' },
    T2: { x: 210, y: 430, t: ['同角（等角）的', '余角相等'], k: 'thm', full: '同角（或等角）的余角相等。', go: 's713-thm', by: ['D3'], extra: '等式的性质' },
    T3: { x: 345, y: 430, t: ['三角形两边之和', '大于第三边'], k: 'thm', full: '三角形的任意两边之和大于第三边。', go: 's713-practice', by: ['F1'] },
    P1: { x: 820, y: 430, t: ['两直线平行，', '同位角相等'], k: 'prop', full: '两条平行直线被第三条直线所截，同位角相等。', go: 's722-corr', by: ['F2', 'F3'], extra: '*假设 ∠1 ≠ ∠2，推出矛盾' },
    T4: { x: 165, y: 315, t: ['对顶角相等'], k: 'thm', full: '对顶角相等。', go: 's713-vertical', by: ['D1', 'D2', 'T1'] },
    J2: { x: 500, y: 315, t: ['同旁内角互补，', '两直线平行'], k: 'judge', full: '两条直线被第三条直线所截，如果同旁内角互补，那么这两条直线平行。', go: 's721-same', by: ['D1', 'D2', 'F2'], extra: '等式的性质、等量代换' },
    P4: { x: 700, y: 315, t: ['平行于同一条直线的', '两条直线平行'], k: 'prop', full: '平行于同一条直线的两条直线平行。', go: 's722-trans', by: ['P1', 'F2'], extra: '等量代换' },
    P3: { x: 930, y: 315, t: ['两直线平行，', '同旁内角互补'], k: 'prop', full: '两条平行直线被第三条直线所截，同旁内角互补。', go: 's722-same', by: ['P1', 'D1', 'D2'], extra: '等量代换' },
    J1: { x: 330, y: 200, t: ['内错角相等，', '两直线平行'], k: 'judge', full: '两条直线被第三条直线所截，如果内错角相等，那么这两条直线平行。', go: 's721-alt', by: ['T4', 'F2'], extra: '等量代换' },
    P2: { x: 640, y: 200, t: ['两直线平行，', '内错角相等'], k: 'prop', full: '两条平行直线被第三条直线所截，内错角相等。', go: 's722-alt', by: ['P1', 'T4'], extra: '等量代换' },
    X: { x: 490, y: 85, t: ['平行线间的“拐角”', '∠BED = ∠B + ∠D'], k: 'more', full: '如果 AB ∥ CD，点 E 在两条平行线之间，那么 ∠BED = ∠B + ∠D。', go: 's722-bend', by: ['P4', 'P2'] }
  };
  var ROWS = [545, 430, 315, 200, 85];

  M.slide({
    id: 's7r-tree', sec: '7.R', kind: '回顾与思考', title: '证明之树：每个定理从哪里来？', layout: 'split lab-wide',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p>每一个定理，都只能用<b>定义</b>、<b>基本事实</b>和<b>已经证明的定理</b>来证明。以它们为根，定理一层一层“长”上去，就是一棵证明之树。</p>' +
        '  <div class="tree-legend" id="treeLegend"></div>' +
        '  <div class="tree-card" id="treeCard"></div>' +
        '  <p class="small muted">等式的性质、等量代换等也常作为证明的依据，图中没有画出。</p>' +
        '</div>' +
        '<div class="col"><div class="panel lab">' +
        '  <div class="row between"><span class="panel-title" style="margin:0">点一点树上的结论</span><button type="button" class="btn sm" id="treeGrow">' + M.icon('tree') + '重新生长</button></div>' +
        '  <div class="fig" id="treeFig"></div>' +
        '</div></div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var svg = M.canvas(M.$('#treeFig', body), 1040, 600);
      var gE = S('g', {}, svg), gN = S('g', {}, svg);
      var keys = Object.keys(NODES);
      /* 图例 */
      M.$('#treeLegend', body).innerHTML = ['def', 'fact', 'thm', 'judge', 'prop'].map(function (k) {
        return '<span><i style="--c:' + KIND[k].color + '"></i>' + KIND[k].name + '</span>';
      }).join('');
      /* 结点 */
      keys.forEach(function (k) {
        var n = NODES[k];
        var len = Math.max.apply(null, n.t.map(function (s) { var w = 0; for (var i = 0; i < s.length; i++) w += /[\x00-\xff]/.test(s[i]) ? 8.6 : 15; return w; }));
        n.w = len + 26; n.h = n.t.length * 20 + 18;
        var g = S('g', { 'class': 'tnode k-' + n.k, tabindex: '0', role: 'button' }, gN);
        g.setAttribute('aria-label', n.full);
        var r = S('rect', { x: -n.w / 2, y: -n.h / 2, width: n.w, height: n.h, rx: 11 }, g);
        r.style.stroke = KIND[n.k].color;
        n.t.forEach(function (line, i) {
          var t = S('text', { x: 0, y: (i - (n.t.length - 1) / 2) * 20 + 5, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, g);
          M.setLabel(t, line.replace(/([A-Z]{1,3})/g, '{$1}'));
        });
        n.g = g; n.r = r;
        g.addEventListener('click', function (e) { e.stopPropagation(); select(k); });
        g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(k); } });
      });
      /* 连线：从依据（下方）连到结论（上方） */
      var edges = [];
      keys.forEach(function (k) {
        (NODES[k].by || []).forEach(function (p) {
          var a = NODES[p], b = NODES[k];
          var y1 = a.y - a.h / 2, y2 = b.y + b.h / 2, my = (y1 + y2) / 2;
          var path = S('path', { d: 'M' + a.x + ' ' + y1 + ' C' + a.x + ' ' + my + ' ' + b.x + ' ' + my + ' ' + b.x + ' ' + y2, 'class': 'tedge' }, gE);
          edges.push({ from: p, to: k, el: path, len: path.getTotalLength ? path.getTotalLength() : 200 });
        });
      });
      function place(n, s) { n.g.setAttribute('transform', 'translate(' + n.x + ',' + n.y + ') scale(' + s + ')'); }
      function ancestors(k, acc) {
        acc = acc || {};
        (NODES[k].by || []).forEach(function (p) { if (!acc[p]) { acc[p] = 1; ancestors(p, acc); } });
        return acc;
      }
      function children(k) { return keys.filter(function (c) { return (NODES[c].by || []).indexOf(k) >= 0; }); }
      var card = M.$('#treeCard', body);
      var sel = null;
      function name(k) { return NODES[k].t.join('').replace(/，$/, ''); }
      function chips(list, cls) {
        return list.map(function (k) { return '<button type="button" class="tchip ' + cls + '" data-k="' + k + '" style="--c:' + KIND[NODES[k].k].color + '">' + name(k) + '</button>'; }).join('');
      }
      function showCard(k) {
        if (!k) {
          card.innerHTML = '<div class="tc-empty">' + M.icon('tree') + '<p>点击右边树上的任意一个结论，<br>看看它的证明用到了哪些依据。</p></div>';
          return;
        }
        var n = NODES[k], kids = children(k);
        var html = '<span class="tc-kind" style="--c:' + KIND[n.k].color + '">' + KIND[n.k].name + '</span>' +
          '<p class="tc-full">' + n.full.replace(/([A-Z]{2,3}|[A-Z](?=[ ，。∥=+]))/g, function (s) { return m(s); }) + '</p>';
        if (n.by) html += '<div class="tc-row"><b>证明的依据</b><div>' + chips(n.by, 'up') + (n.extra ? '<span class="tchip plain">' + n.extra + '</span>' : '') + '</div></div>';
        else html += '<div class="tc-row"><b>地位</b><div><span class="tchip plain">' + (n.k === 'fact' ? '基本事实，不需要证明，直接作为依据' : '定义，是证明的出发点') + '</span></div></div>';
        if (kids.length) html += '<div class="tc-row"><b>它又支撑了</b><div>' + chips(kids, 'down') + '</div></div>';
        html += '<button type="button" class="btn sm primary tc-go">' + (n.by ? '去看它的证明' : '回到这一页') + M.icon('arrow') + '</button>';
        card.innerHTML = html;
        M.$$('.tchip[data-k]', card).forEach(function (c) { c.addEventListener('click', function () { select(c.getAttribute('data-k')); }); });
        M.$('.tc-go', card).addEventListener('click', function () { M.go(n.go); });
        card.animate && card.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 320 * M.motion, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
      function paint() {
        var anc = sel ? ancestors(sel) : null, kids = sel ? children(sel) : [];
        keys.forEach(function (k) {
          var n = NODES[k];
          var on = !sel || k === sel || anc[k] || kids.indexOf(k) >= 0;
          n.g.classList.toggle('dim', !on);
          n.g.classList.toggle('sel', k === sel);
          n.g.classList.toggle('anc', !!(anc && anc[k]));
          n.g.classList.toggle('kid', kids.indexOf(k) >= 0);
        });
        edges.forEach(function (e) {
          var up = sel && (e.to === sel || anc[e.to]) && (anc[e.from]);
          var down = sel && e.from === sel;
          e.el.classList.toggle('up', !!up);
          e.el.classList.toggle('down', !!down);
          e.el.classList.toggle('dim', !!sel && !up && !down);
        });
      }
      function select(k) { sel = sel === k ? null : k; paint(); showCard(sel); if (sel) flowUp(sel); }
      svg.addEventListener('click', function () { if (sel) select(sel); });
      /* 光点沿依据链向上流动 */
      function flowUp(k) {
        var anc = ancestors(k);
        edges.filter(function (e) { return (e.to === k || anc[e.to]) && anc[e.from]; }).forEach(function (e, i) {
          var dot = S('circle', { r: 5, 'class': 'tflow' }, gE);
          A.tween({ dur: 900, delay: i * 70, ease: 'inOutSine', update: function (t) {
            var q = e.el.getPointAtLength(e.len * t);
            M.attr(dot, { cx: q.x, cy: q.y, opacity: Math.sin(Math.PI * t) });
          }, done: function () { dot.remove(); } });
        });
      }
      /* 生长动画：从根部一层层向上 */
      function grow() {
        A.cancelAll();
        sel = null; paint(); showCard(null);
        keys.forEach(function (k) { place(NODES[k], 0); });
        edges.forEach(function (e) { e.el.style.strokeDasharray = e.len; e.el.style.strokeDashoffset = e.len; });
        keys.forEach(function (k) {
          var n = NODES[k], row = ROWS.indexOf(n.y);
          A.tween({ dur: 480, delay: 120 + row * 420 + (n.x / 1040) * 160, ease: 'outBack', update: function (e) { place(n, Math.max(0, e)); } });
        });
        edges.forEach(function (e) {
          var row = ROWS.indexOf(NODES[e.to].y);
          A.tween({ dur: 520, delay: row * 420 - 180, ease: 'inOutCubic', update: function (t) { e.el.style.strokeDashoffset = e.len * (1 - t); } });
        });
      }
      M.$('#treeGrow', body).addEventListener('click', grow);
      keys.forEach(function (k) { place(NODES[k], 1); });
      showCard(null);
      return { enter: grow };
    }
  });

  /* ---------------- 回顾与思考 ---------------- */
  M.slide({
    id: 's7r-think', sec: '7.R', kind: '回顾与思考', title: '第七章 回顾与思考', layout: 'full',
    html: function () {
      var Q = [
        ['直观是重要的，但它有时也会欺骗人，你能找出这样的例子吗？',
          '例如：两条一样长的线段，两端画上方向不同的箭头后，看起来一长一短；把 ' + v('n') + ' = 0，1，…，10 代入 ' + v('n') + '<sup>2</sup> − ' + v('n') + ' + 11 都得到质数，但 ' + v('n') + ' = 11 时，值为 121 = 11 × 11。观察、实验、归纳得到的结论可能正确，也可能不正确，必须进行有理有据的证明。', 's711-illusion'],
        ['请用自己的语言说说什么是定义、命题，并举例说明。',
          '对名称和术语的含义加以描述，作出明确的规定，就是给出它们的<b>定义</b>，如“两点之间线段的长度，叫作这两点之间的距离”。判断一件事情的句子叫作<b>命题</b>，如“对顶角相等”。命题由条件和结论组成，常写成“如果……那么……”的形式。', 's712-def'],
        ['本书中作为证明出发点的基本事实有哪些？',
          '两点确定一条直线；两点之间线段最短；同一平面内，过一点有且只有一条直线与已知直线垂直；同位角相等，两直线平行；过直线外一点有且只有一条直线与这条直线平行；三角形全等的“边角边”“角边角”“边边边”。（共九条，已认识八条。）', 's713-facts'],
        ['为什么需要证明？证明的一般步骤是怎样的？如何分析证明的思路？',
          '证明能保证结论正确。一般步骤：分清条件和结论 → 画出图形 → 写出已知、求证 → 分析思路 → 写出证明过程。分析时，可以从已知出发看能推出什么，也可以从求证出发看需要什么，两头凑。', 's722-steps'],
        ['什么条件下两条直线平行？两条直线平行又会有怎样的结论？这两类命题的条件和结论有什么关系？',
          '同位角相等、内错角相等或同旁内角互补，两直线平行；平行于同一条直线的两条直线平行。两直线平行，同位角相等、内错角相等、同旁内角互补。判定与性质的条件和结论正好互换。', 's722-compare'],
        ['梳理本章内容，用适当的方式呈现全章的知识结构。',
          '可以画成“证明之树”：以定义和基本事实为根，定理一层层向上生长；每个结论都能沿着树枝找到它的依据。', 's7r-tree']
      ];
      return '<div class="think-grid">' + Q.map(function (q, i) {
        return '<div class="think-card" style="--i:' + i + '"><span class="tk-no">' + (i + 1) + '</span><p class="tk-q">' + q[0] + '</p>' +
          '<button type="button" class="btn sm ghost tk-btn">' + M.icon('eye') + '参考要点</button>' +
          '<div class="tk-a" hidden><p>' + q[1] + '</p><button type="button" class="linkish" data-goto="' + q[2] + '">回到相关内容' + M.icon('arrow') + '</button></div></div>';
      }).join('') + '</div>';
    },
    mount: function (body) {
      M.$$('.think-card', body).forEach(function (c) {
        var b = M.$('.tk-btn', c), a = M.$('.tk-a', c);
        b.addEventListener('click', function () {
          a.hidden = !a.hidden;
          c.classList.toggle('open', !a.hidden);
          b.innerHTML = M.icon('eye') + (a.hidden ? '参考要点' : '收起');
          if (!a.hidden && a.animate) a.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 320 * M.motion, easing: 'cubic-bezier(.2,.8,.2,1)' });
        });
      });
      return {};
    }
  });

  /* ---------------- 综合练习 ---------------- */
  function figTrans(marks, names) {
    return function (host) {
      var svg = M.canvas(host, 420, 220);
      var fig = GF.transversal(svg, {
        box: [10, 10, 410, 210], names: names,
        a: { p: { x: 210, y: 72 }, dir: 0 }, b: { p: { x: 210, y: 158 }, dir: 0 }, c: { p: { x: 210, y: 115 }, dir: 70 }
      });
      Object.keys(marks).forEach(function (k) { fig.mark(k, { color: marks[k][1], label: marks[k][0], r: 22, fontSize: 16 }); });
      fig.parallel(true);
    };
  }
  function figQuad(host) {
    var svg = M.canvas(host, 420, 200);
    var P = { A: { x: 80, y: 40 }, B: { x: 340, y: 40 }, C: { x: 380, y: 165 }, D: { x: 40, y: 165 } };
    S('path', { d: 'M' + P.A.x + ' ' + P.A.y + ' L' + P.B.x + ' ' + P.B.y + ' L' + P.C.x + ' ' + P.C.y + ' L' + P.D.x + ' ' + P.D.y + ' Z', fill: 'var(--surface)', stroke: 'var(--ink)', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, svg);
    S('line', { x1: P.A.x, y1: P.A.y, x2: P.C.x, y2: P.C.y, stroke: 'var(--ink)', 'stroke-width': 2 }, svg);
    var sp = G.innerSpan(P.A, P.C, P.B); GF.angle(svg, P.A, sp.a0, sp.a1, { color: 'var(--a2)', label: '1', r: 30, fontSize: 16 });
    sp = G.innerSpan(P.C, P.A, P.D); GF.angle(svg, P.C, sp.a0, sp.a1, { color: 'var(--a2)', label: '2', r: 30, fontSize: 16 });
    [['A', -8, -8], ['B', 10, -8], ['C', 14, 12], ['D', -14, 12]].forEach(function (q) { M.label(svg, P[q[0]].x + q[1], P[q[0]].y + q[2], '{' + q[0] + '}', { 'font-size': 18, 'text-anchor': 'middle' }); });
  }
  function figBend(host) {
    var svg = M.canvas(host, 420, 210);
    var B = { x: 360, y: 30 }, D = { x: 360, y: 180 };
    /* 由 ∠B = 40°，∠D = 30° 求点 E：E = B + t(−cos40°, sin40°)，E = D + s(−cos30°, −sin30°) */
    var c40 = Math.cos(40 * G.RAD), s40 = Math.sin(40 * G.RAD), c30 = Math.cos(30 * G.RAD), s30 = Math.sin(30 * G.RAD);
    var k = c40 / c30, t = 150 / (s40 + k * s30);
    var E = { x: B.x - c40 * t, y: B.y + s40 * t };
    S('line', { 'class': 'line', x1: 30, y1: B.y, x2: 400, y2: B.y }, svg);
    S('line', { 'class': 'line', x1: 30, y1: D.y, x2: 400, y2: D.y }, svg);
    S('line', { 'class': 'line acc', x1: B.x, y1: B.y, x2: E.x, y2: E.y }, svg);
    S('line', { 'class': 'line acc', x1: D.x, y1: D.y, x2: E.x, y2: E.y }, svg);
    var sp = G.innerSpan(B, { x: 0, y: B.y }, E); GF.angle(svg, B, sp.a0, sp.a1, { color: 'var(--a2)', label: '40°', r: 30, fontSize: 14, labelOff: 20 });
    sp = G.innerSpan(D, { x: 0, y: D.y }, E); GF.angle(svg, D, sp.a0, sp.a1, { color: 'var(--a3)', label: '30°', r: 30, fontSize: 14, labelOff: 20 });
    sp = G.innerSpan(E, B, D); GF.angle(svg, E, sp.a0, sp.a1, { color: 'var(--a1)', label: '?', r: 22, fontSize: 15 });
    [['A', 40, B.y - 10], ['B', B.x, B.y - 10], ['C', 40, D.y + 22], ['D', D.x, D.y + 22], ['E', E.x - 18, E.y + 6]].forEach(function (q) { M.label(svg, q[1], q[2], '{' + q[0] + '}', { 'font-size': 18, 'text-anchor': 'middle' }); });
  }
  var QS = [
    { stem: '下列语句中，是命题的是（　　）', opts: ['画线段 ' + m('AB') + ' = 3 cm', '你喜欢数学吗？', '同位角相等', '过点 ' + m('P') + ' 作直线 ' + v('l') + ' 的垂线'], ans: 2,
      explain: '判断一件事情的句子叫作命题。“同位角相等”对事情作出了判断（虽然它是假命题），是命题；A、D 是作图语句，B 是问句，都没有作出判断。' },
    { stem: '命题“对顶角相等”的条件是（　　）', opts: ['两个角相等', '两个角是对顶角', '对顶角', '相等'], ans: 1,
      explain: '改写成“如果两个角是对顶角，那么这两个角相等”，“如果”引出的部分是条件。' },
    { stem: '下列命题中，是假命题的是（　　）', opts: ['两点确定一条直线', '同角的余角相等', '相等的角是对顶角', '两直线平行，内错角相等'], ans: 2,
      explain: '相等的角不一定是对顶角，例如三角尺上两个 45° 的角相等，但不是对顶角。' },
    { stem: '能说明命题“若 ' + v('a') + '<sup>2</sup> &gt; ' + v('b') + '<sup>2</sup>，则 ' + v('a') + ' &gt; ' + v('b') + '”是假命题的反例是（　　）', opts: [v('a') + ' = 3，' + v('b') + ' = 2', v('a') + ' = −3，' + v('b') + ' = 2', v('a') + ' = 2，' + v('b') + ' = −1', v('a') + ' = −2，' + v('b') + ' = −3'], ans: 1,
      explain: '反例要满足条件、不满足结论：(−3)<sup>2</sup> = 9 &gt; 4 = 2<sup>2</sup>，但 −3 &lt; 2。选项 D 中 4 &lt; 9，连条件都不满足。' },
    { stem: '下列结论中，属于基本事实的是（　　）', opts: ['对顶角相等', '两点之间线段最短', '同角的补角相等', '两直线平行，内错角相等'], ans: 1,
      explain: 'A、C、D 都是本章用定义和基本事实证明过的定理，B 是基本事实。' },
    { stem: '如图，直线 ' + v('a') + ' ∥ ' + v('b') + '，∠1 = 70°，则 ∠2 的度数是（　　）', fig: figTrans({ P3: ['1', 'var(--a2)'], Q2: ['2', 'var(--a1)'] }), opts: ['70°', '110°', '20°', '140°'], ans: 1,
      explain: '∠1 与 ∠2 是同旁内角。两直线平行，同旁内角互补，所以 ∠2 = 180° − 70° = 110°。' },
    { stem: '如图，在四边形 ' + m('ABCD') + ' 中，连接 ' + m('AC') + '，若 ∠1 = ∠2，则一定成立的是（　　）', fig: figQuad, opts: [m('AD') + ' ∥ ' + m('BC'), m('AB') + ' ∥ ' + m('CD'), '∠' + m('B') + ' = ∠' + m('D'), m('AC') + ' 平分 ∠' + m('BAD')], ans: 1,
      explain: '∠1，∠2 是直线 ' + m('AB') + '，' + m('CD') + ' 被直线 ' + m('AC') + ' 所截得的内错角。内错角相等，两直线平行，所以 ' + m('AB') + ' ∥ ' + m('CD') + '。' },
    { stem: '直线 ' + v('a') + '，' + v('b') + ' 被直线 ' + v('c') + ' 所截，∠1 与 ∠2 是同位角，∠3 与 ∠4 是内错角，∠5 与 ∠6 是同旁内角。下列推理及括号中的依据，正确的是（　　）',
      opts: ['∵ ∠1 = ∠2，∴ ' + v('a') + ' ∥ ' + v('b') + '（两直线平行，同位角相等）', '∵ ' + v('a') + ' ∥ ' + v('b') + '，∴ ∠1 = ∠2（同位角相等，两直线平行）', '∵ ' + v('a') + ' ∥ ' + v('b') + '，∴ ∠3 = ∠4（两直线平行，内错角相等）', '∵ ∠5 = ∠6，∴ ' + v('a') + ' ∥ ' + v('b') + '（同旁内角互补，两直线平行）'], ans: 2,
      explain: '由角的关系推出平行，用判定；由平行推出角的关系，用性质。A 把性质当成了判定，B 把判定当成了性质；D 的条件是“相等”，而判定需要同旁内角“互补”。' },
    { stem: '如图，' + m('AB') + ' ∥ ' + m('CD') + '，∠' + m('B') + ' = 40°，∠' + m('D') + ' = 30°，则 ∠' + m('BED') + ' 的度数是（　　）', fig: figBend, opts: ['60°', '70°', '110°', '140°'], ans: 1,
      explain: '过点 ' + m('E') + ' 作 ' + m('EF') + ' ∥ ' + m('AB') + '，则 ' + m('EF') + ' ∥ ' + m('CD') + '（平行于同一条直线的两条直线平行）。∠' + m('BEF') + ' = ∠' + m('B') + ' = 40°，∠' + m('DEF') + ' = ∠' + m('D') + ' = 30°（两直线平行，内错角相等），所以 ∠' + m('BED') + ' = 70°。' },
    { stem: '在同一平面内，如果 ' + v('a') + ' ∥ ' + v('b') + '，' + v('b') + ' ∥ ' + v('c') + '，那么 ' + v('a') + ' 与 ' + v('c') + ' 的位置关系是（　　）', opts: ['平行', '相交', '垂直', '不能确定'], ans: 0,
      explain: '平行于同一条直线的两条直线平行，所以 ' + v('a') + ' ∥ ' + v('c') + '。' },
    { stem: '证明“两直线平行，内错角相等”时（如图，' + v('l') + '<sub>1</sub> ∥ ' + v('l') + '<sub>2</sub>），先由已知得到 ∠1 = ∠3，依据是（　　）', fig: figTrans({ P3: ['1', 'var(--a1)'], Q1: ['2', 'var(--a2)'], Q3: ['3', 'var(--a3)'] }, { a: '{l}_1', b: '{l}_2', c: 'l' }),
      opts: ['对顶角相等', '两直线平行，同位角相等', '同位角相等，两直线平行', '等量代换'], ans: 1,
      explain: '∠1 与 ∠3 是同位角，由 ' + v('l') + '<sub>1</sub> ∥ ' + v('l') + '<sub>2</sub> 得 ∠1 = ∠3，依据是“两直线平行，同位角相等”；再由“对顶角相等”得 ∠2 = ∠3，最后等量代换。' },
    { stem: '关于“同旁内角互补”这句话，下列说法正确的是（　　）', opts: ['它是真命题', '它是假命题', '它是定义', '它是基本事实'], ans: 1,
      explain: '只有两直线平行时，同旁内角才互补。两条不平行的直线被第三条直线所截，同旁内角并不互补，所以它是假命题。' }
  ];
  M.slide({
    id: 's7r-quiz', sec: '7.R', kind: '综合练习', kindCls: 'k-practice', title: '第七章综合练习', layout: 'full',
    html: '<div class="quiz-wrap" id="quiz7"></div>',
    mount: function (body) { M.W.quiz(M.$('#quiz7', body), QS); return {}; }
  });
})(window.M);
