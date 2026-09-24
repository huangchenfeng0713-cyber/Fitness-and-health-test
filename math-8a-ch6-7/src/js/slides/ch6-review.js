/* 第六章 回顾与思考：知识结构 + 综合练习 */
(function (M) {
  'use strict';
  var S = M.svg;

  /* 知识地图：根节点 + 分支卡片，连线在挂载后按位置绘制 */
  M.kmap = function (host, root, branches) {
    var wrap = M.el('div', { 'class': 'kmap' });
    wrap.innerHTML = '<svg class="kmap-lines" aria-hidden="true"></svg><div class="kroot">' + root + '</div><div class="kbranches"></div>';
    var bh = wrap.querySelector('.kbranches');
    branches.forEach(function (b) {
      var card = M.el('div', { 'class': 'kb' });
      card.innerHTML = '<h4><i style="--c:' + b.c + '"></i>' + b.title + '</h4><p class="kb-sub">' + (b.sub || '') + '</p>';
      var list = M.el('div', { 'class': 'kleaves' });
      b.leaves.forEach(function (lf) {
        var a = M.el('button', { type: 'button', 'class': 'kleaf', html: lf[0], 'data-goto': lf[1], title: '跳到这一页' });
        list.appendChild(a);
      });
      card.appendChild(list);
      bh.appendChild(card);
    });
    host.appendChild(wrap);
    var svg = wrap.querySelector('.kmap-lines');
    function draw() {
      var box = wrap.getBoundingClientRect();
      if (!box.width) return;
      svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
      svg.setAttribute('width', box.width); svg.setAttribute('height', box.height);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var r = wrap.querySelector('.kroot').getBoundingClientRect();
      var x0 = r.left + r.width / 2 - box.left, y0 = r.bottom - box.top;
      M.$$('.kb', wrap).forEach(function (kb, i) {
        var h = kb.querySelector('h4').getBoundingClientRect();
        var x1 = h.left + h.width / 2 - box.left, y1 = kb.getBoundingClientRect().top - box.top;
        var my = (y0 + y1) / 2;
        var p = S('path', { d: 'M' + x0 + ' ' + y0 + ' C' + x0 + ' ' + my + ' ' + x1 + ' ' + my + ' ' + x1 + ' ' + y1, fill: 'none', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
        p.style.stroke = branches[i].c;
        var len = p.getTotalLength ? p.getTotalLength() : 300;
        p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
        p.style.transition = 'stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1) ' + (0.1 + i * 0.12) + 's';
        requestAnimationFrame(function () { requestAnimationFrame(function () { p.style.strokeDashoffset = 0; }); });
      });
    }
    window.addEventListener('resize', function () { if (wrap.offsetParent) draw(); });
    return { draw: draw, el: wrap };
  };

  M.slide({
    id: 's6r-map', sec: '6.R', kind: '回顾与思考', title: '第六章知识结构', layout: 'full',
    html: function () {
      return '<div id="map6" class="map-host"></div>' +
        '<div class="review-qs">' +
        '  <details><summary>加权平均数与算术平均数有什么区别和联系？</summary><p>各数据的权相等时，加权平均数就是算术平均数；权反映了各数据的“重要程度”或所占的比例。</p></details>' +
        '  <details><summary>刻画集中趋势的统计量有哪些？各有什么特点？</summary><p>众数：重复多时尤受关注；平均数：利用全部数据，但受极端值影响大；中位数：受极端值影响小。</p></details>' +
        '  <details><summary>刻画离散程度的统计量有哪些？</summary><p>离差平方和、方差、标准差。一般而言，方差或标准差越小，数据越稳定。</p></details>' +
        '  <details><summary>箱线图有什么特点？</summary><p>用最小值、四分位数和最大值反映数据的整体分布，特别适合比较多组数据。</p></details>' +
        '</div>';
    },
    mount: function (body) {
      var map = M.kmap(M.$('#map6', body), '数据的分析', [
        { title: '集中趋势', sub: '数据的“中心”在哪里', c: 'var(--s1)', leaves: [['众数', 's611-def'], ['算术平均数', 's611-level'], ['加权平均数', 's612-def'], ['中位数', 's621-median'], ['百分位数', 's621-percentile'], ['四分位数', 's622-quartile']] },
        { title: '离散程度', sub: '数据有多“分散”', c: 'var(--s2)', leaves: [['离差', 's613-stable'], ['离差平方和', 's613-var'], ['方差', 's613-var'], ['标准差', 's613-example']] },
        { title: '整体分布', sub: '一张图看全貌', c: 'var(--s3)', leaves: [['箱线图的画法', 's622-box'], ['读箱线图', 's622-read'], ['统计图中读统计量', 's611-charts']] },
        { title: '决策与应用', sub: '根据目标选方法', c: 'var(--s4)', leaves: [['选择合适的统计量', 's621-compare'], ['方差与选拔', 's614-jump'], ['组内离差平方和最小', 's614-group'], ['比较两组数据', 's63-case'], ['哪个城市夏天更热', 's63-project']] }
      ]);
      return { enter: function () { setTimeout(map.draw, 60); } };
    }
  });

  function boxFig(host) {
    var svg = M.canvas(host, 560, 190, 'q-svg');
    var sx = M.charts.scale(45, 95, 80, 540);
    M.charts.axis(svg, { orient: 'x', scale: sx, at: 170, ticks: M.range(45, 95, 5), fmt: function (v) { return v; }, fontSize: 13 });
    [['甲组', { min: 50, q1: 62, q2: 70, q3: 76, max: 90 }, 'var(--s1)', 'var(--s1-tint)', 50], ['乙组', { min: 58, q1: 66, q2: 72, q3: 75, max: 82 }, 'var(--s2)', 'var(--s2-tint)', 115]].forEach(function (d) {
      var bp = M.charts.box(svg, { scale: sx, orient: 'h', pos: d[4], size: 40, color: d[2], tint: d[3], labels: true });
      bp.set(d[1]);
      S('text', { x: 20, y: d[4] + 5, 'font-size': 15, 'font-weight': 700, text: d[0] }, svg).style.fill = d[2];
    });
  }

  var QS = [
    { stem: '一组数据 3，5，5，6，9 的众数、中位数、平均数依次是（　）', opts: ['5，5，5.6', '5，6，5.6', '5，5，5', '9，5，5.6'], ans: 0, explain: '5 出现 2 次最多，众数是 5；排序后第 3 个数是 5，中位数是 5；平均数 = 28 ÷ 5 = <b>5.6</b>。' },
    { stem: '数据 2，4，4，6，9 的方差是（　）', opts: ['5.6', '28', '2.37', '7'], ans: 0, explain: '平均数是 5，离差平方和 = 9 + 1 + 1 + 1 + 16 = 28，方差 = 28 ÷ 5 = <b>5.6</b>。28 是离差平方和，不是方差。' },
    { stem: '某校学期总评成绩中，平时、期中、期末分别占 30%，30%，40%。小华三项成绩依次为 90 分、84 分、88 分，他的总评成绩是（　）', opts: ['87.4 分', '87.3 分', '88 分', '86.8 分'], ans: 0, explain: '90×30% + 84×30% + 88×40% = 27 + 25.2 + 35.2 = <b>87.4</b>（分）。按三项简单平均得 87.3 分是错的。' },
    { stem: '鞋店老板统计了一周各尺码鞋的销量，决定下周进货时，他最关心的统计量是（　）', opts: ['平均数', '中位数', '众数', '方差'], ans: 2, explain: '卖得最多的尺码就是销量数据的<b>众数</b>，应多进这个尺码的货。' },
    { stem: '一组数据中出现了一个特别大的数据，下列统计量中受它影响最大的是（　）', opts: ['众数', '中位数', '平均数', '下四分位数'], ans: 2, explain: '所有数据都参加平均数的运算，所以<b>平均数</b>最容易受极端值影响。' },
    { stem: '甲、乙两人各射击 10 次，平均成绩都是 8.5 环，方差分别是 <i class="v">s</i><sub>甲</sub><sup>2</sup> = 0.6，<i class="v">s</i><sub>乙</sub><sup>2</sup> = 1.4，则（　）', opts: ['甲的成绩更稳定', '乙的成绩更稳定', '两人一样稳定', '无法判断'], ans: 0, explain: '方差越小，数据越稳定。0.6 &lt; 1.4，所以<b>甲</b>更稳定。' },
    { stem: '数据 1，3，4，6，7，8，10，12 的四分位数 <i class="v">m</i><sub>25</sub>，<i class="v">m</i><sub>50</sub>，<i class="v">m</i><sub>75</sub> 依次是（　）', opts: ['3.5，6.5，9', '3，6.5，10', '4，6.5，8', '3.5，7，9'], ans: 0, explain: '中位数 (6 + 7) ÷ 2 = 6.5；前一半 1，3，4，6 的中位数是 3.5；后一半 7，8，10，12 的中位数是 9。' },
    { stem: '把一组数据中的每个数都加上 5，那么这组数据的（　）', opts: ['平均数加 5，方差不变', '平均数不变，方差加 5', '平均数、方差都加 5', '平均数、方差都不变'], ans: 0, explain: '每个数都加 5，数据整体平移，“中心”右移 5，波动情况不变，所以<b>平均数加 5，方差不变</b>。' },
    { stem: '两组数据的箱线图如下，根据箱线图，下列说法正确的是（　）', fig: boxFig, opts: ['乙组的中位数比甲组大', '甲组数据的波动比乙组小', '甲组约有一半的数据不超过 62', '乙组的最大值比甲组大'], ans: 0, explain: '乙组中位数 72 &gt; 甲组 70；甲组的箱子和须都更长，波动更大；62 是甲组的下四分位数，约四分之一的数据不超过它；甲组最大值 90 更大。' },
    { stem: '把数据 2，3，4，9，10，11 分成两组，使组内离差平方和最小，应分为（　）', opts: ['{2，3，4}，{9，10，11}', '{2，3}，{4，9，10，11}', '{2，3，4，9}，{10，11}', '{2}，{3，4，9，10，11}'], ans: 0, explain: '{2，3，4} 与 {9，10，11} 的离差平方和都是 2，合计 4，是所有分法中最小的。' },
    { stem: '在一次测试中，小明的成绩是全班成绩的 90% 分位数，这说明（　）', opts: ['大约 90% 的同学成绩不超过小明', '小明考了 90 分', '小明比 90 名同学考得好', '小明的成绩是平均分的 90%'], ans: 0, explain: '<i class="v">p</i>% 分位数的意义：大约有 <i class="v">p</i>% 的数据不超过它。' },
    { stem: '3 kg 单价 20 元/kg 的糖与 2 kg 单价 30 元/kg 的糖混合，混合后每千克的价格是（　）', opts: ['24 元', '25 元', '26 元', '50 元'], ans: 0, explain: '(20×3 + 30×2) ÷ (3 + 2) = 120 ÷ 5 = <b>24</b>（元），质量是“权”。' }
  ];

  M.slide({
    id: 's6r-quiz', sec: '6.R', kind: '综合练习', kindCls: 'k-practice', title: '第六章综合练习', layout: 'full',
    html: '<div class="quiz-wrap" id="quiz6"></div>',
    mount: function (body) { M.W.quiz(M.$('#quiz6', body), QS); return {}; }
  });
})(window.M);
