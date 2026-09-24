/* 7.1 认识证明 · 第2课时 定义与命题 */
(function (M) {
  'use strict';
  var S = M.svg, G = M.geo;
  var L = '第2课时 定义与命题';

  /* ---------------- 定义 ---------------- */
  M.slide({
    id: 's712-def', sec: '7.1', lesson: L, kind: '概念', title: '定义：对名称和术语作出明确的规定', layout: 'split',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p>证明时，为了交流的方便，必须对某些名称和术语形成共同的认识。</p>' +
        '  <div class="box def"><span class="tag">定义</span><p>对名称和术语的含义加以描述，作出明确的规定，也就是给出它们的<span class="hl">定义</span>（definition）。</p></div>' +
        '  <ul class="dots small">' +
        '    <li>“两点之间线段的长度，叫作这两点之间的距离”是“两点之间的距离”的定义。</li>' +
        '    <li>定义常用“……叫作……”“……称为……”的句式。</li>' +
        '  </ul>' +
        '  <div class="box think" data-step="1"><span class="tag">随堂练习</span><p>你能列举出一些学过的定义吗？第六章中有哪些定义？</p></div>' +
        '</div>' +
        '<div class="col"><div class="panel lab"><div class="panel-title">翻开卡片，说出定义<span class="hint">点卡片翻面</span></div><div id="defCards" class="scroll-y"></div></div></div>';
    },
    mount: function (body) {
      M.W.flips(M.$('#defCards', body), [
        { front: '两点之间的距离', back: '两点之间线段的长度，叫作这两点之间的距离。' },
        { front: '无理数', back: '无限不循环小数称为无理数。' },
        { front: '等腰三角形', back: '有两边相等的三角形叫作等腰三角形。' },
        { front: '平行线', back: '在同一平面内，不相交的两条直线叫作平行线。' },
        { front: '补角', back: '如果两个角的和等于 180°，那么这两个角互为补角。' },
        { front: '对顶角', back: '一个角的两边分别是另一个角两边的反向延长线，这两个角叫作对顶角。' },
        { front: '众数', hint: '第六章', back: '一组数据中出现次数最多的那个数据叫作这组数据的众数。' },
        { front: '方差', hint: '第六章', back: '各个数据与平均数之差的平方的平均数叫作方差。' }
      ]);
      return {};
    }
  });

  /* ---------------- 命题（分类游戏） ---------------- */
  M.slide({
    id: 's712-prop', sec: '7.1', lesson: L, kind: '尝试·思考', title: '哪些句子对事情作出了判断？', layout: 'split text-wide',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <div id="propGame"></div>' +
        '</div>' +
        '<div class="col scroll">' +
        '  <div class="box def"><span class="tag">命题</span><p>判断一件事情的句子，叫作<span class="hl">命题</span>（proposition）。</p><p class="small">如果一个句子没有对某一件事情作出任何判断，那么它就不是命题。</p></div>' +
        '  <div class="box note"><span class="tag">注意</span><p class="small">疑问句、祈使句（如“作……”）、感叹或描述性的短语都没有作出判断，不是命题。<br>命题的判断可以是对的，也可以是错的。</p></div>' +
        '  <button type="button" class="btn sm" id="propReset">' + M.icon('reset') + '重新分类</button>' +
        '</div>';
    },
    mount: function (body) {
      var game = M.W.sorter(M.$('#propGame', body), {
        hint: '判断它是否对一件事情作出了判断。',
        seed: 11,
        bins: [{ id: 'y', title: '是命题' }, { id: 'n', title: '不是命题' }],
        items: [
          { html: '任何一个三角形一定有一个角是直角', bin: 'y', why: '作出了判断（虽然是错的），是命题。' },
          { html: '对顶角相等', bin: 'y', why: '判断了对顶角的大小关系。' },
          { html: '无论 <i class="v">n</i> 为怎样的自然数，<i class="v">n</i><sup>2</sup> − <i class="v">n</i> + 11 的值都是质数', bin: 'y', why: '作出了判断（它是错的，<i class="v">n</i> = 11 是反例）。' },
          { html: '如果两条直线都和第三条直线平行，那么这两条直线也互相平行', bin: 'y', why: '“如果……那么……”形式的判断。' },
          { html: '你喜欢数学吗？', bin: 'n', why: '疑问句，没有作出判断。', hint: '疑问句有没有作出判断？' },
          { html: '作线段 <span class="m">AB</span> = <span class="m">CD</span>', bin: 'n', why: '作图语句，只是要求做一件事。', hint: '“作……”是在判断吗？' },
          { html: '负数都小于零', bin: 'y', why: '判断了负数与零的大小关系。' },
          { html: '美丽的天空', bin: 'n', why: '只是一个短语，没有判断。', hint: '这句话判断了什么？' },
          { html: '所有的质数都是奇数', bin: 'y', why: '作出了判断（错的，2 是反例）。' },
          { html: '过直线 <i class="v">l</i> 外一点作 <i class="v">l</i> 的平行线', bin: 'n', why: '作图语句。', hint: '“作……”是在判断吗？' }
        ]
      });
      M.$('#propReset', body).addEventListener('click', function () { game.reset(); });
      return {};
    }
  });

  /* ---------------- 条件与结论 ---------------- */
  var PROPS = [
    { s: ['<span class="cond">对顶角</span><span class="conc">相等</span>'], c: '两个角是对顶角', r: '这两个角相等' },
    { s: ['<span class="cond">同角的补角</span><span class="conc">相等</span>'], c: '两个角是同一个角的补角', r: '这两个角相等' },
    { s: ['<span class="cond">等腰三角形的</span><span class="conc">两个底角相等</span>'], c: '一个三角形是等腰三角形', r: '这个三角形的两个底角相等' },
    { s: ['<span class="cond">两直线平行，</span><span class="conc">内错角相等</span>'], c: '两条平行直线被第三条直线所截', r: '内错角相等' },
    { s: ['<span class="cond">直角三角形的</span><span class="conc">两个锐角互余</span>'], c: '一个三角形是直角三角形', r: '它的两个锐角互余' },
    { s: ['<span class="cond">平行于同一条直线的两条直线</span><span class="conc">平行</span>'], c: '两条直线都与同一条直线平行', r: '这两条直线平行' },
    { s: ['<span class="cond">全等三角形的</span><span class="conc">面积相等</span>'], c: '两个三角形全等', r: '它们的面积相等' }
  ];
  M.slide({
    id: 's712-ifthen', sec: '7.1', lesson: L, kind: '思考·交流', title: '命题的结构：条件和结论', layout: 'split',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p>观察下列命题，你能发现它们有什么共同的结构特征？</p>' +
        '  <ol class="qlist small">' +
        '    <li>如果一个三角形是等腰三角形，那么这个三角形的两个底角相等；</li>' +
        '    <li>如果 <i class="v">a</i> = <i class="v">b</i>，那么 <i class="v">a</i><sup>2</sup> = <i class="v">b</i><sup>2</sup>；</li>' +
        '    <li>如果两个三角形中有两边和一个角分别相等，那么这两个三角形全等。</li>' +
        '  </ol>' +
        '  <div class="box def" data-step="1"><span class="tag">条件与结论</span><p>一般地，每个命题都由<span class="cond">条件</span>（condition）和<span class="conc">结论</span>（conclusion）两部分组成。条件是已知的事项，结论是由已知事项推断出的事项。</p>' +
        '    <p class="small">命题通常可以写成“<b>如果</b>……，<b>那么</b>……”的形式，“如果”引出的部分是条件，“那么”引出的部分是结论。</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">改写成“如果……，那么……”<span class="hint">点一个命题</span></div>' +
        '    <div class="prop-picks" id="propPicks"></div>' +
        '    <div class="rewrite" id="rewrite"></div>' +
        '    <div class="legend"><span><i style="--c:var(--s1)"></i>条件</span><span><i style="--c:var(--s2)"></i>结论</span></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body) {
      var host = M.$('#rewrite', body);
      function show(i) {
        var p = PROPS[i];
        M.$$('#propPicks button', body).forEach(function (b, j) { b.classList.toggle('on', i === j); });
        host.innerHTML = '<div class="rw-src prop-line">' + p.s.join('') + '</div>' +
          '<div class="rw-arrow">' + M.icon('arrow') + '</div>' +
          '<div class="rw-dst prop-line"><span class="if-word">如果</span><span class="cond">' + p.c + '</span>，<span class="then-word">那么</span><span class="conc">' + p.r + '</span>。</div>';
        M.$$('.rw-src, .rw-arrow, .rw-dst', host).forEach(function (e, k) {
          if (e.animate) e.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 450 * M.motion, delay: k * 220 * M.motion, fill: 'backwards', easing: 'cubic-bezier(.2,.8,.2,1)' });
        });
      }
      PROPS.forEach(function (p, i) {
        var b = M.el('button', { type: 'button', 'class': 'btn sm', html: p.s.join('').replace(/<[^>]+>/g, '') });
        b.addEventListener('click', function () { show(i); });
        M.$('#propPicks', body).appendChild(b);
      });
      show(0);
      return {};
    }
  });

  /* ---------------- 真命题、假命题与反例 ---------------- */
  var FALSE = [
    { t: '如果两个角相等，那么它们是对顶角', draw: 'angles' },
    { t: '如果 <i class="v">a</i> ≠ <i class="v">b</i>，<i class="v">b</i> ≠ <i class="v">c</i>，那么 <i class="v">a</i> ≠ <i class="v">c</i>', text: '取 <i class="v">a</i> = 1，<i class="v">b</i> = 2，<i class="v">c</i> = 1：满足 <i class="v">a</i> ≠ <i class="v">b</i>，<i class="v">b</i> ≠ <i class="v">c</i>，但 <i class="v">a</i> = <i class="v">c</i>。' },
    { t: '如果 <i class="v">x</i><sup>2</sup> &gt; 0，那么 <i class="v">x</i> &gt; 0', text: '取 <i class="v">x</i> = −1：(−1)<sup>2</sup> = 1 &gt; 0，但 −1 &lt; 0。' },
    { t: '两个锐角之和一定是钝角', draw: 'acute' },
    { t: '两边分别相等且其中一组等边的对角相等的两个三角形全等', draw: 'ssa' }
  ];
  M.slide({
    id: 's712-truth', sec: '7.1', lesson: L, kind: '概念', title: '真命题、假命题与反例', layout: 'split',
    html: function () {
      return '' +
        '<div class="col scroll">' +
        '  <p class="small">指出下列命题的条件和结论，其中哪些命题是错误的？你是如何判断的？</p>' +
        '  <ol class="qlist small">' +
        '    <li>如果两个角相等，那么它们是对顶角；<span class="chip bad" data-step="1">假</span></li>' +
        '    <li>如果 <i class="v">a</i> ≠ <i class="v">b</i>，<i class="v">b</i> ≠ <i class="v">c</i>，那么 <i class="v">a</i> ≠ <i class="v">c</i>；<span class="chip bad" data-step="1">假</span></li>' +
        '    <li>全等三角形的面积相等；<span class="chip ok" data-step="1">真</span></li>' +
        '    <li>三角形三个内角的和等于 180°。<span class="chip ok" data-step="1">真</span></li>' +
        '  </ol>' +
        '  <div class="box def"><span class="tag">真命题与假命题</span><p>正确的命题称为<span class="hl">真命题</span>，不正确的命题称为<span class="hl">假命题</span>。</p></div>' +
        '  <div class="box def"><span class="tag">反例</span><p>要说明一个命题是假命题，常常可以举出一个例子，使它<b>具备命题的条件</b>，而<b>不具有命题的结论</b>，这种例子称为<span class="hl">反例</span>。</p></div>' +
        '</div>' +
        '<div class="col">' +
        '  <div class="panel lab">' +
        '    <div class="panel-title">给假命题找反例</div>' +
        '    <div class="prop-picks" id="falsePicks"></div>' +
        '    <div class="claim" id="falseClaim"></div>' +
        '    <div class="fig" id="ceFig"></div>' +
        '    <div class="answer" id="ceText" hidden></div>' +
        '    <button type="button" class="btn primary" id="ceBtn">' + M.icon('spark') + '举出反例</button>' +
        '  </div>' +
        '</div>';
    },
    mount: function (body, api) {
      var A = api.anim;
      var fig = M.$('#ceFig', body), txt = M.$('#ceText', body), cur = 0;
      var svg = M.canvas(fig, 660, 300);
      function clear() {
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        S('text', { x: 330, y: 150, 'text-anchor': 'middle', 'font-size': 18, 'class': 't-ink', text: '先想一想：什么样的例子满足条件，却不满足结论？' }, svg).setAttribute('opacity', 0.55);
      }
      function angle(v, a0, a1, color, label) {
        var p0 = G.polar(v, 150, a0), p1 = G.polar(v, 150, a1);
        S('path', { d: 'M' + p0.x + ' ' + p0.y + ' L' + v.x + ' ' + v.y + ' L' + p1.x + ' ' + p1.y, fill: 'none', 'class': 'line' }, svg);
        M.GF.angle(svg, v, a0, a1, { color: color, label: label, r: 40 });
      }
      function drawAngles() {
        angle({ x: 70, y: 230 }, 0, 40, 'var(--a1)', '40°');
        angle({ x: 380, y: 250 }, 25, 65, 'var(--a2)', '40°');
        S('text', { x: 330, y: 40, 'text-anchor': 'middle', 'font-size': 17, 'class': 't-ink', text: '两个角都是 40°，相等，但不是对顶角' }, svg);
      }
      function drawAcute() {
        var v = { x: 200, y: 250 };
        angle(v, 0, 30, 'var(--a1)', '30°');
        var p = G.polar(v, 150, 70);
        S('line', { x1: v.x, y1: v.y, x2: p.x, y2: p.y, 'class': 'line' }, svg);
        M.GF.angle(svg, v, 30, 70, { color: 'var(--a2)', label: '40°', r: 58 });
        M.GF.angle(svg, v, 0, 70, { color: 'var(--red)', label: '70°', r: 100, fillOpacity: 0.06 });
        S('text', { x: 470, y: 150, 'text-anchor': 'middle', 'font-size': 18, 'class': 't-ink', text: '30° + 40° = 70°，是锐角' }, svg);
      }
      function drawSSA() {
        var Ap = { x: 60, y: 240 }, Bp = { x: 230, y: 70 };
        var dirAC = 0;
        var r = 200;
        // 以 B 为圆心、r 为半径的圆与射线 AC 的两个交点
        var dx = Bp.x - Ap.x, dy = Ap.y - Bp.y;
        var t1 = dx - Math.sqrt(r * r - dy * dy), t2 = dx + Math.sqrt(r * r - dy * dy);
        var C1 = { x: Ap.x + t1, y: Ap.y }, C2 = { x: Ap.x + t2, y: Ap.y };
        S('line', { x1: Ap.x - 20, y1: Ap.y, x2: 640, y2: Ap.y, 'class': 'line thin muted' }, svg);
        var circ = S('circle', { cx: Bp.x, cy: Bp.y, r: r, fill: 'none', stroke: 'var(--ink-3)', 'stroke-width': 1.4, 'stroke-dasharray': '5 6', opacity: 0 }, svg);
        var t1p = S('path', { d: 'M' + Ap.x + ' ' + Ap.y + ' L' + Bp.x + ' ' + Bp.y + ' L' + C1.x + ' ' + C1.y + ' Z', 'stroke-width': 2.6, 'stroke-linejoin': 'round' }, svg);
        t1p.style.fill = 'var(--s1-tint)'; t1p.style.stroke = 'var(--s1)';
        var t2p = S('path', { d: 'M' + Ap.x + ' ' + Ap.y + ' L' + Bp.x + ' ' + Bp.y + ' L' + C2.x + ' ' + C2.y + ' Z', 'stroke-width': 2.6, 'stroke-linejoin': 'round', opacity: 0 }, svg);
        t2p.style.fill = 'var(--s2-tint)'; t2p.style.stroke = 'var(--s2)';
        M.GF.angle(svg, Ap, 0, G.dir(Ap, Bp), { color: 'var(--a4)', r: 30 });
        M.label(svg, Ap.x - 16, Ap.y + 22, '{A}', { 'font-size': 20 });
        M.label(svg, Bp.x - 6, Bp.y - 14, '{B}', { 'font-size': 20 });
        M.label(svg, C1.x - 6, C1.y + 24, '{C}', { 'font-size': 20 });
        var c2l = M.label(svg, C2.x - 6, C2.y + 24, '{C′}', { 'font-size': 20, opacity: 0 });
        S('text', { x: 400, y: 40, 'font-size': 15, 'class': 't-ink', text: '△ABC 与 △ABC′：AB 公共，BC = BC′，∠A 公共' }, svg);
        S('text', { x: 400, y: 64, 'font-size': 15, 'class': 't-ink', text: '满足条件，但两个三角形显然不全等' }, svg);
        A.tween({ dur: 900, delay: 300, update: function (e) { circ.setAttribute('opacity', e); } });
        A.tween({ dur: 900, delay: 1100, update: function (e) { t2p.setAttribute('opacity', e); c2l.setAttribute('opacity', e); } });
      }
      function pick(i) {
        cur = i;
        M.$$('#falsePicks button', body).forEach(function (b, j) { b.classList.toggle('on', i === j); });
        M.$('#falseClaim', body).innerHTML = '假命题：' + FALSE[i].t;
        clear(); txt.hidden = true; fig.style.display = FALSE[i].draw ? '' : 'none';
        M.$('#ceBtn', body).disabled = false;
      }
      FALSE.forEach(function (f, i) {
        var b = M.el('button', { type: 'button', 'class': 'btn sm', html: '反例 ' + (i + 1) });
        b.addEventListener('click', function () { pick(i); });
        M.$('#falsePicks', body).appendChild(b);
      });
      M.$('#ceBtn', body).addEventListener('click', function () {
        var f = FALSE[cur];
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        if (f.draw === 'angles') drawAngles();
        else if (f.draw === 'acute') drawAcute();
        else if (f.draw === 'ssa') drawSSA();
        if (f.text) { txt.innerHTML = f.text; txt.hidden = false; }
        M.$('#ceBtn', body).disabled = true;
      });
      pick(0);
      return {};
    }
  });

  /* ---------------- 随堂练习 ---------------- */
  var ROWS = [
    ['如果 <i class="v">a</i> &gt; <i class="v">b</i>，那么 <i class="v">a</i><sup>2</sup> &gt; <i class="v">b</i><sup>2</sup>', '<i class="v">a</i> &gt; <i class="v">b</i>', '<i class="v">a</i><sup>2</sup> &gt; <i class="v">b</i><sup>2</sup>', false, '<i class="v">a</i> = 1，<i class="v">b</i> = −2'],
    ['如果今天是星期三，那么 10 天后是星期六', '今天是星期三', '10 天后是星期六', true, ''],
    ['同旁内角互补', '两个角是同旁内角', '这两个角互补', false, '两条直线不平行时，同旁内角不互补'],
    ['如果 |<i class="v">a</i>| = |<i class="v">b</i>|，那么 <i class="v">a</i> = <i class="v">b</i>', '|<i class="v">a</i>| = |<i class="v">b</i>|', '<i class="v">a</i> = <i class="v">b</i>', false, '<i class="v">a</i> = 2，<i class="v">b</i> = −2'],
    ['三个角都相等的三角形是等边三角形', '一个三角形的三个角都相等', '它是等边三角形', true, ''],
    ['如果 (<i class="v">x</i> − 3) ÷ 2 = (5 − <i class="v">x</i>) ÷ 4，那么 <i class="v">x</i> = 4', '(<i class="v">x</i> − 3) ÷ 2 = (5 − <i class="v">x</i>) ÷ 4', '<i class="v">x</i> = 4', false, '解方程得 <i class="v">x</i> = ' + M.frac('11', '3') + '，不是 4']
  ];
  M.slide({
    id: 's712-practice', sec: '7.1', lesson: L, kind: '随堂练习', kindCls: 'k-practice', title: '指出条件和结论，判断真假', layout: 'full',
    html: function () {
      var rows = ROWS.map(function (r, i) {
        return '<tr><td class="q-cell">' + (i + 1) + '. ' + r[0] + '</td>' +
          '<td><span class="cond hide-a" data-a>' + r[1] + '</span></td><td><span class="conc hide-a" data-a>' + r[2] + '</span></td>' +
          '<td><span class="chip ' + (r[3] ? 'ok' : 'bad') + ' hide-a" data-a>' + (r[3] ? '真' : '假') + '</span></td><td class="small hide-a" data-a>' + (r[4] || '—') + '</td></tr>';
      }).join('');
      return '<div class="table-wrap practice-table"><table class="data"><tr><th>命题</th><th>条件</th><th>结论</th><th>真假</th><th>反例</th></tr>' + rows + '</table></div>' +
        '<div class="btn-row"><button type="button" class="btn primary" id="showRow">' + M.icon('eye') + '逐行显示答案</button><button type="button" class="btn" id="showAll">全部显示</button><button type="button" class="btn ghost" id="hideAll">' + M.icon('reset') + '隐藏答案</button></div>';
    },
    mount: function (body) {
      var trs = M.$$('tr', body).slice(1), k = 0;
      function showRow(i) { M.$$('[data-a]', trs[i]).forEach(function (e) { e.classList.remove('hide-a'); }); }
      M.$('#showRow', body).addEventListener('click', function () { if (k < trs.length) showRow(k++); });
      M.$('#showAll', body).addEventListener('click', function () { trs.forEach(function (t, i) { showRow(i); }); k = trs.length; });
      M.$('#hideAll', body).addEventListener('click', function () { M.$$('[data-a]', body).forEach(function (e) { e.classList.add('hide-a'); }); k = 0; });
      return {};
    }
  });
})(window.M);
