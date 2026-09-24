/* 第六章 章首页 */
(function (M) {
  'use strict';

  M.slide({
    id: 'c6-intro', sec: '6.0', title: '第六章 数据的分析', noHead: true, layout: 'center',
    html: function () {
      return '' +
        '<div class="chapter-hero">' +
        '  <div>' +
        '    <div class="big-no">第 六 章</div>' +
        '    <h1>数据的分析</h1>' +
        '    <p class="intro">比赛成绩、考试分数、每天的气温……面对一大堆原始数据，只看数字很难作出判断。本章要学习挑选一些有“代表性”的统计量：有的反映数据的<b>集中趋势</b>，有的反映数据的<b>离散程度</b>，箱线图则把数据的整体<b>分布</b>画出来。</p>' +
        '    <div class="qs"><b>本章可以持续思考</b><ul class="dots">' +
        '      <li>统计图和统计量都能反映数据的信息，它们有什么区别和联系？</li>' +
        '      <li>分析数据有哪些不同的方式？各有什么优势与不足？</li>' +
        '    </ul></div>' +
        '    <div class="sec-cards">' +
        '      <button type="button" class="sec-card" data-goto="s611-shoot"><b>6.1</b><span>平均数与方差</span><small>众数 · 平均数 · 加权平均数 · 方差 · 标准差 · 分组</small></button>' +
        '      <button type="button" class="sec-card" data-goto="s621-salary"><b>6.2</b><span>中位数与箱线图</span><small>中位数 · 百分位数 · 四分位数 · 箱线图</small></button>' +
        '      <button type="button" class="sec-card" data-goto="s63-case"><b>6.3</b><span>哪个团队收益大</span><small>用多种方法比较两组数据</small></button>' +
        '    </div>' +
        '  </div>' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">两名选手各射击 12 次<span class="hint">平均都是 8 环，谁更稳定？</span></div>' +
        '    <div class="fig" id="c6Targets"></div>' +
        '    <div class="legend"><span><i class="round" style="--c:var(--s1)"></i>甲</span><span><i class="round" style="--c:var(--s4)"></i>丁</span><span class="muted">环数越高，弹孔越靠近靶心</span></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim, S = M.svg;
      var svg = M.canvas(M.$('#c6Targets', body), 720, 380);
      var shots = {
        jia: [8, 7, 8, 9, 8, 6, 8, 10, 7, 8, 9, 8],
        ding: [10, 6, 8, 10, 6, 7, 10, 6, 9, 10, 8, 6]
      };
      var k = 27;
      function target(cx, cy, name, color, list, seed) {
        var g = S('g', {}, svg);
        for (var s = 5; s <= 10; s++) {
          var r = (11 - s) * k;
          S('circle', { cx: cx, cy: cy, r: r, fill: s >= 8 ? 'var(--surface-3)' : 'var(--surface)', stroke: 'var(--line-2)', 'stroke-width': 1.5 }, g);
        }
        S('circle', { cx: cx, cy: cy, r: 3, fill: 'var(--ink-3)' }, g);
        for (var t = 5; t <= 9; t++) {
          S('text', { x: cx + (10 - t) * k + k * 0.5, y: cy + 5, 'text-anchor': 'middle', 'font-size': 13, 'class': 't-num', fill: 'var(--ink-3)', text: t }, g);
        }
        S('text', { x: cx, y: cy - 6 * k - 14, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 700, 'class': 't-ink', text: name }, g);
        var rnd = seed;
        function rand() { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; }
        var holes = list.map(function (sc, i) {
          var rr = ((10 - sc) + 0.2 + rand() * 0.6) * k, ang = rand() * 360;
          var p = M.geo.polar({ x: cx, y: cy }, rr, ang);
          var h = S('g', { transform: 'translate(' + p.x + ',' + p.y + ') scale(0)' }, g);
          S('circle', { r: 7.5, fill: color, stroke: 'var(--surface)', 'stroke-width': 2 }, h);
          return { h: h, p: p, i: i };
        });
        return holes;
      }
      var hj = target(185, 200, '甲', 'var(--s1)', shots.jia, 11);
      var hd = target(535, 200, '丁', 'var(--s4)', shots.ding, 29);
      function play() {
        hj.concat(hd).forEach(function (o, idx) {
          var d = (o.i * 2 + (idx >= hj.length ? 1 : 0)) * 90;
          M.attr(o.h, { transform: 'translate(' + o.p.x + ',' + o.p.y + ') scale(0)' });
          A.tween({ dur: 420, delay: 200 + d, ease: 'outBack', update: function (e) {
            o.h.setAttribute('transform', 'translate(' + o.p.x + ',' + o.p.y + ') scale(' + e + ')');
          } });
        });
      }
      return { enter: play };
    }
  });
})(window.M);
