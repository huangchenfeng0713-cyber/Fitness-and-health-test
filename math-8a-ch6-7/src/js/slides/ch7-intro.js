/* 第七章 章首页 */
(function (M) {
  'use strict';
  var S = M.svg;

  M.slide({
    id: 'c7-intro', sec: '7.0', title: '第七章 命题与证明', noHead: true, layout: 'center',
    html: function () {
      return '' +
        '<div class="chapter-hero">' +
        '  <div>' +
        '    <div class="big-no">第 七 章</div>' +
        '    <h1>命题与证明</h1>' +
        '    <p class="intro">通过观察、测量、猜测得到的结论都正确吗？证明时我们常说“因为 A 正确，所以 B 正确”，可 A 又为什么正确？这样追问下去，证明的源头在哪里？本章以学过的部分<b>基本事实</b>作为证明的起点，一步步推出与平行线的判定和性质有关的结论，体会数学的严谨。</p>' +
        '    <div class="qs"><b>本章可以持续思考</b><ul class="dots">' +
        '      <li>在什么情况下需要进行证明？证明有什么意义？</li>' +
        '      <li>怎样才能保证证明是严谨的？</li>' +
        '    </ul></div>' +
        '    <div class="sec-cards">' +
        '      <button type="button" class="sec-card" data-goto="s711-illusion"><b>7.1</b><span>认识证明</span><small>为什么要证明 · 定义与命题 · 定理与证明</small></button>' +
        '      <button type="button" class="sec-card" data-goto="s721-angles"><b>7.2</b><span>平行线的证明</span><small>判定定理 · 性质定理 · 平行的传递</small></button>' +
        '      <button type="button" class="sec-card" data-goto="s7r-tree"><b>回顾</b><span>证明之树</span><small>每个定理从哪里来</small></button>' +
        '    </div>' +
        '  </div>' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">一条推理链<span class="hint">从定义和基本事实出发</span></div>' +
        '    <div class="fig" id="c7Chain"></div>' +
        '    <p class="small ink2">每一个定理，都只能用基本事实、定义和已经证明的定理来证明。</p>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var svg = M.canvas(M.$('#c7Chain', body), 660, 420);
      var nodes = {
        flat: { x: 100, y: 368, t: ['平角的定义'], kind: 'base' },
        supp: { x: 300, y: 368, t: ['补角的定义'], kind: 'base' },
        fact: { x: 530, y: 368, t: ['基本事实', '同位角相等，两直线平行'], kind: 'fact' },
        same: { x: 300, y: 262, t: ['同角的补角相等'], kind: 'thm' },
        vert: { x: 180, y: 160, t: ['对顶角相等'], kind: 'thm' },
        alt: { x: 430, y: 56, t: ['内错角相等，', '两直线平行'], kind: 'top' }
      };
      var edges = [['supp', 'same'], ['flat', 'vert'], ['same', 'vert'], ['vert', 'alt'], ['fact', 'alt']];
      var gE = S('g', {}, svg), gN = S('g', {}, svg), gP = S('g', {}, svg);
      var paths = edges.map(function (e) {
        var a = nodes[e[0]], b = nodes[e[1]];
        var y1 = a.y - 26, y2 = b.y + 28, my = (y1 + y2) / 2;
        var p = S('path', { d: 'M' + a.x + ' ' + y1 + ' C' + a.x + ' ' + my + ' ' + b.x + ' ' + my + ' ' + b.x + ' ' + y2, fill: 'none', stroke: 'var(--line-2)', 'stroke-width': 2.5 }, gE);
        return { p: p, e: e };
      });
      var nodeEls = Object.keys(nodes).map(function (k) {
        var n = nodes[k];
        var w = Math.max.apply(null, n.t.map(function (s) { return s.length; })) * 17 + 34, h = n.t.length * 22 + 20;
        var g = S('g', { transform: 'translate(' + n.x + ',' + n.y + ') scale(0)' }, gN);
        var r = S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 12, 'stroke-width': 2 }, g);
        var fill = { base: 'var(--surface)', fact: 'var(--amber-tint)', thm: 'var(--accent-tint)', top: 'var(--accent)' }[n.kind];
        var stroke = { base: 'var(--line-2)', fact: 'var(--amber)', thm: 'var(--accent)', top: 'var(--accent)' }[n.kind];
        r.style.fill = fill; r.style.stroke = stroke;
        n.t.forEach(function (line, i) {
          var t = S('text', { x: 0, y: (i - (n.t.length - 1) / 2) * 22 + 6, 'text-anchor': 'middle', 'font-size': i === 0 && n.kind === 'fact' ? 13 : 16, 'font-weight': 700, text: line }, g);
          t.style.fill = n.kind === 'top' ? 'var(--on-accent)' : (n.kind === 'fact' && i === 0 ? 'var(--amber)' : 'var(--ink)');
        });
        return { g: g, n: n, k: k };
      });
      function play() {
        var order = ['flat', 'supp', 'fact', 'same', 'vert', 'alt'];
        order.forEach(function (k, i) {
          var ne = nodeEls.filter(function (x) { return x.k === k; })[0];
          A.tween({ dur: 520, delay: 150 + i * 330, ease: 'outBack', update: function (e) {
            ne.g.setAttribute('transform', 'translate(' + ne.n.x + ',' + ne.n.y + ') scale(' + e + ')');
          } });
        });
        paths.forEach(function (pe, i) {
          var len = pe.p.getTotalLength ? pe.p.getTotalLength() : 200;
          pe.p.setAttribute('stroke-dasharray', len); pe.p.setAttribute('stroke-dashoffset', len);
          var tIdx = order.indexOf(pe.e[1]);
          A.tween({ dur: 600, delay: 150 + tIdx * 330 - 200, ease: 'inOutCubic', update: function (e) { pe.p.setAttribute('stroke-dashoffset', len * (1 - e)); pe.p.style.stroke = 'var(--accent)'; } });
        });
        // 光点沿边向上流动
        A.wait(2400).then(function (ok) {
          if (ok === false) return;
          paths.forEach(function (pe, i) {
            var dot = S('circle', { r: 5, fill: 'var(--marker)' }, gP);
            var len = pe.p.getTotalLength();
            A.tween({ dur: 1100, delay: i * 120, ease: 'inOutSine', update: function (e) {
              var q = pe.p.getPointAtLength(len * e);
              M.attr(dot, { cx: q.x, cy: q.y, opacity: Math.sin(Math.PI * e) });
            }, done: function () { dot.remove(); } });
          });
        });
      }
      return { enter: play };
    }
  });
})(window.M);
