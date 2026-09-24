/* ============================================================
   数据与证明互动课堂 · 通用互动组件
   测验、证明书写、分类游戏、翻转卡、读数面板、滑块
   ============================================================ */
(function (M) {
  'use strict';
  var W = M.W = {};

  /* ---------- 读数面板 ----------
     items: [{key, label(html), unit, cls, d}] → 返回 {el, set(key, value, flash)} */
  W.stats = function (host, items) {
    var wrap = M.el('div', { 'class': 'stats' });
    var map = {};
    items.forEach(function (it) {
      var s = M.el('div', { 'class': 'stat ' + (it.cls || '') });
      s.innerHTML = '<div class="k">' + it.label + '</div><div class="val"><span class="v-num">—</span>' + (it.unit ? '<small>' + it.unit + '</small>' : '') + '</div>';
      if (it.color) s.querySelector('.val').style.color = it.color;
      wrap.appendChild(s);
      map[it.key] = { box: s, num: s.querySelector('.v-num'), d: it.d == null ? 2 : it.d, fixed: it.fixed };
    });
    host.appendChild(wrap);
    return {
      el: wrap,
      set: function (key, v, opt) {
        var m = map[key];
        if (!m) return;
        if (typeof v === 'string') { m.num.textContent = v; m.num._v = null; }
        else M.countTo(m.num, v, { d: m.d, fixed: m.fixed, anim: opt && opt.anim });
        if (opt && opt.flash) M.flash(m.box);
      },
      box: function (key) { return map[key] && map[key].box; }
    };
  };

  /* ---------- 滑块 ---------- */
  W.slider = function (host, o) {
    var row = M.el('div', { 'class': 'slider' });
    var id = o.id || ('sl-' + Math.random().toString(36).slice(2, 8));
    row.innerHTML = '<label for="' + id + '">' + o.label + '</label>' +
      '<input type="range" id="' + id + '" min="' + o.min + '" max="' + o.max + '" step="' + (o.step || 1) + '" value="' + o.value + '">' +
      '<output for="' + id + '"></output>';
    host.appendChild(row);
    var inp = row.querySelector('input'), out = row.querySelector('output');
    var fmt = o.fmt || function (v) { return M.fmt(v, 2); };
    function sync(fire) {
      M.syncRange(inp);
      out.innerHTML = fmt(+inp.value);
      if (fire && o.input) o.input(+inp.value);
    }
    inp.addEventListener('input', function () { sync(true); });
    if (o.change) inp.addEventListener('change', function () { o.change(+inp.value); });
    sync(false);
    return {
      el: row, input: inp,
      get: function () { return +inp.value; },
      set: function (v, fire) { inp.value = v; sync(fire); }
    };
  };

  /* ---------- 答案揭示 ---------- */
  W.reveal = function (btn, target, labels) {
    labels = labels || ['显示答案', '收起答案'];
    target.hidden = true;
    btn.innerHTML = M.icon('eye') + '<span>' + labels[0] + '</span>';
    btn.addEventListener('click', function () {
      var show = target.hidden;
      target.hidden = !show;
      btn.querySelector('span').textContent = show ? labels[1] : labels[0];
      if (show) {
        target.animate && target.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 380 * M.motion, easing: 'cubic-bezier(.2,.8,.2,1)' });
        M.$$('.hl', target).forEach(function (h) { h.classList.remove('on'); void h.offsetWidth; h.classList.add('on'); });
      }
    });
  };

  /* ---------- 证明书写 ----------
     o: {given, prove, lines:[{sym, text, why}], blanks:false}
     返回 {el, show(n), setBlanks(bool)}；show(n) 显示前 n 行，第 n 行高亮 */
  W.proof = function (host, o) {
    var el = M.el('div', { 'class': 'proof' + (o.blanks ? ' blanks' : '') });
    var head = '';
    if (o.given) head += '<b>已知：</b><div>' + o.given + '</div>';
    if (o.prove) head += '<b>求证：</b><div>' + o.prove + '</div>';
    if (head) el.innerHTML = '<div class="proof-head">' + head + '</div>';
    if (o.label !== false) el.insertAdjacentHTML('beforeend', '<div class="proof-label">' + (o.label || '证明：') + '</div>');
    var rows = o.lines.map(function (ln) {
      var r = M.el('div', { 'class': 'pline step-hidden' });
      r.innerHTML = '<span class="sym">' + (ln.sym || '') + '</span><span class="st">' + ln.text + '</span>' +
        (ln.why ? '<span class="why"><span class="w">' + ln.why + '</span></span>' : '<span></span>');
      var w = r.querySelector('.w');
      if (w) w.addEventListener('click', function () { w.classList.toggle('show'); });
      el.appendChild(r);
      return r;
    });
    host.appendChild(el);
    return {
      el: el,
      rows: rows,
      show: function (n) {
        rows.forEach(function (r, i) {
          r.classList.toggle('step-hidden', i >= n);
          r.classList.toggle('now', i === n - 1);
          r.classList.toggle('done', i < n - 1);
        });
      },
      setBlanks: function (b) {
        el.classList.toggle('blanks', !!b);
        M.$$('.w', el).forEach(function (w) { w.classList.remove('show'); });
      }
    };
  };

  /* ---------- 测验 ----------
     qs: [{stem, opts:[...], ans, explain, fig(host)}] */
  W.quiz = function (host, qs, o) {
    o = o || {};
    var el = M.el('div', { 'class': 'quiz' });
    var nav = M.el('div', { 'class': 'q-nav' });
    var dots = M.el('div', { 'class': 'q-dots' });
    var score = M.el('span', { 'class': 'muted small' });
    nav.appendChild(dots);
    nav.appendChild(M.el('span', { 'class': 'grow' }));
    nav.appendChild(score);
    var card = M.el('div', { 'class': 'q-card' });
    el.appendChild(nav);
    el.appendChild(card);
    host.appendChild(el);
    var state = qs.map(function () { return null; });
    var cur = 0;
    qs.forEach(function (q, i) {
      var b = M.el('button', { type: 'button', text: String(i + 1), 'aria-label': '第' + (i + 1) + '题' });
      b.addEventListener('click', function () { go(i); });
      dots.appendChild(b);
    });
    function refreshNav() {
      M.$$('button', dots).forEach(function (b, i) {
        b.className = (i === cur ? 'cur ' : '') + (state[i] === true ? 'ok' : state[i] === false ? 'no' : '');
      });
      var done = state.filter(function (s) { return s !== null; }).length;
      var right = state.filter(function (s) { return s === true; }).length;
      score.innerHTML = '已答 <span class="score">' + done + '/' + qs.length + '</span>　答对 <span class="score green">' + right + '</span>';
    }
    function go(i) {
      cur = M.clamp(i, 0, qs.length - 1);
      var q = qs[cur];
      card.innerHTML = '';
      card.classList.toggle('has-fig', !!q.fig);
      var stem = M.el('div', { 'class': 'q-stem', html: '<span class="qn">' + (cur + 1) + '</span>' + q.stem });
      card.appendChild(stem);
      if (q.fig) { var fh = M.el('div', { 'class': 'q-fig' }); card.appendChild(fh); q.fig(fh); }
      var opts = M.el('div', { 'class': 'q-opts' });
      var letters = 'ABCD';
      var btns = q.opts.map(function (t, k) {
        var b = M.el('button', { type: 'button', 'class': 'q-opt', html: '<span class="lt">' + letters[k] + '</span><span>' + t + '</span>' });
        b.addEventListener('click', function () { answer(k); });
        opts.appendChild(b);
        return b;
      });
      card.appendChild(opts);
      var ex = M.el('div', { 'class': 'q-explain', html: q.explain });
      ex.hidden = true;
      card.appendChild(ex);
      var row = M.el('div', { 'class': 'btn-row' });
      var prev = M.el('button', { type: 'button', 'class': 'btn sm', html: M.icon('left') + '上一题' });
      var next = M.el('button', { type: 'button', 'class': 'btn sm primary', html: '下一题' + M.icon('right') });
      var again = M.el('button', { type: 'button', 'class': 'btn sm ghost', html: M.icon('reset') + '重做本题' });
      prev.disabled = cur === 0; next.disabled = cur === qs.length - 1;
      prev.addEventListener('click', function () { go(cur - 1); });
      next.addEventListener('click', function () { go(cur + 1); });
      again.addEventListener('click', function () { state[cur] = null; go(cur); });
      row.appendChild(prev); row.appendChild(next); row.appendChild(again);
      card.appendChild(row);
      function answer(k) {
        if (state[cur] !== null) return;
        var ok = k === q.ans;
        state[cur] = ok;
        btns.forEach(function (b, j) {
          b.disabled = true;
          if (j === q.ans) b.classList.add('right');
          if (j === k && !ok) b.classList.add('wrong');
        });
        ex.hidden = false;
        ex.animate && ex.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 380 * M.motion, easing: 'cubic-bezier(.2,.8,.2,1)' });
        refreshNav();
      }
      if (state[cur] !== null) {
        btns.forEach(function (b, j) { b.disabled = true; if (j === q.ans) b.classList.add('right'); });
        ex.hidden = false;
      }
      refreshNav();
      card.animate && card.animate([{ opacity: 0, transform: 'translateX(12px)' }, { opacity: 1, transform: 'none' }], { duration: 320 * M.motion, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    go(0);
    return { go: go, reset: function () { state = qs.map(function () { return null; }); go(0); } };
  };

  /* ---------- 分类游戏 ----------
     o: {items:[{html, bin, why}], bins:[{id, title}]} 先点卡片，再点类别 */
  W.sorter = function (host, o) {
    var el = M.el('div', { 'class': 'sorter' });
    var pool = M.el('div', { 'class': 'sort-pool' });
    var bins = M.el('div', { 'class': 'sort-bins' });
    var fb = M.el('div', { 'class': 'q-explain', html: '先点一张卡片，再点它应放入的类别。' });
    el.appendChild(pool); el.appendChild(bins); el.appendChild(fb);
    host.appendChild(el);
    var sel = null, done = 0;
    var binEls = {};
    o.bins.forEach(function (b) {
      var be = M.el('div', { 'class': 'sort-bin', role: 'button', tabindex: '0', html: '<b><span>' + b.title + '</span><span class="muted num" data-n>0</span></b>' });
      be.addEventListener('click', function () { drop(b.id); });
      be.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop(b.id); } });
      bins.appendChild(be);
      binEls[b.id] = be;
    });
    var cards = M.shuffle(o.items, o.seed || 7).map(function (it) {
      var c = M.el('button', { type: 'button', 'class': 'sort-card', html: '<span>' + it.html + '</span>' });
      c._it = it;
      c.addEventListener('click', function (e) {
        e.stopPropagation();
        if (c._done) return;
        if (sel) sel.classList.remove('sel');
        sel = sel === c ? null : c;
        if (sel) sel.classList.add('sel');
        M.$$('.sort-bin', bins).forEach(function (b) { b.classList.toggle('hot', !!sel); });
      });
      pool.appendChild(c);
      return c;
    });
    function drop(id) {
      if (!sel) { fb.innerHTML = '请先点选一张卡片。'; return; }
      var c = sel, it = c._it;
      c.classList.remove('sel');
      M.$$('.sort-bin', bins).forEach(function (b) { b.classList.remove('hot'); });
      sel = null;
      if (it.bin === id) {
        var first = c.getBoundingClientRect();
        c._done = true;
        c.classList.add('ok');
        binEls[id].appendChild(c);
        var last = c.getBoundingClientRect();
        if (c.animate) c.animate([{ transform: 'translate(' + (first.left - last.left) + 'px,' + (first.top - last.top) + 'px)' }, { transform: 'none' }], { duration: 480 * M.motion, easing: 'cubic-bezier(.2,.8,.2,1)' });
        var n = binEls[id].querySelector('[data-n]');
        n.textContent = String(+n.textContent + 1);
        done++;
        fb.innerHTML = '<b class="green">✓ 正确。</b>' + (it.why || '');
        if (done === cards.length) fb.innerHTML += '<br><b>全部分类完成！</b>';
      } else {
        c.classList.remove('no'); void c.offsetWidth; c.classList.add('no');
        fb.innerHTML = '<b class="red">再想想。</b>' + (it.hint || o.hint || '');
        setTimeout(function () { c.classList.remove('no'); }, 600);
      }
    }
    return {
      reset: function () {
        done = 0;
        cards.forEach(function (c) { c._done = false; c.className = 'sort-card'; pool.appendChild(c); });
        M.$$('[data-n]', bins).forEach(function (n) { n.textContent = '0'; });
        fb.innerHTML = '先点一张卡片，再点它应放入的类别。';
      }
    };
  };

  /* ---------- 翻转卡 ---------- */
  W.flips = function (host, cards) {
    var grid = M.el('div', { 'class': 'flip-grid' });
    cards.forEach(function (c) {
      var b = M.el('button', { type: 'button', 'class': 'flip', 'aria-label': c.front });
      b.innerHTML = '<div class="flip-in"><div class="flip-face front"><span class="nm">' + c.front + '</span><span class="hint">' + (c.hint || '点击查看定义') + '</span></div>' +
        '<div class="flip-face back"><span>' + c.back + '</span></div></div>';
      b.addEventListener('click', function () { b.classList.toggle('on'); });
      grid.appendChild(b);
    });
    host.appendChild(grid);
    return grid;
  };

  /* ---------- 分段按钮 ---------- */
  W.seg = function (host, labels, onPick, init) {
    var s = M.el('div', { 'class': 'seg', role: 'tablist' });
    var btns = labels.map(function (l, i) {
      var b = M.el('button', { type: 'button', html: l, role: 'tab' });
      b.addEventListener('click', function () { pick(i, true); });
      s.appendChild(b);
      return b;
    });
    function pick(i, fire) {
      btns.forEach(function (b, j) { b.classList.toggle('on', j === i); b.setAttribute('aria-selected', j === i ? 'true' : 'false'); });
      if (fire && onPick) onPick(i);
    }
    pick(init || 0, false);
    host.appendChild(s);
    return { el: s, pick: pick };
  };
})(window.M);
