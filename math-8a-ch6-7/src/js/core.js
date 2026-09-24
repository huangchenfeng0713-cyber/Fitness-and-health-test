/* ============================================================
   数据与证明互动课堂 · 核心工具
   DOM / SVG 构建、拖拽、补间动画、统计与几何计算、课程结构
   ============================================================ */
(function (global) {
  'use strict';
  var M = global.M = global.M || {};

  /* ---------- 课程结构 ---------- */
  M.CHAPTERS = {
    0: { title: '封面', full: '封面' },
    6: { title: '数据的分析', full: '第六章 数据的分析' },
    7: { title: '命题与证明', full: '第七章 命题与证明' }
  };
  M.SECTIONS = {
    'home': { ch: 0, no: '', title: '封面' },
    '6.0': { ch: 6, no: '第六章', title: '数据的分析' },
    '6.1': { ch: 6, no: '6.1', title: '平均数与方差' },
    '6.2': { ch: 6, no: '6.2', title: '中位数与箱线图' },
    '6.3': { ch: 6, no: '6.3', title: '哪个团队收益大' },
    '6.R': { ch: 6, no: '回顾', title: '回顾与思考' },
    '7.0': { ch: 7, no: '第七章', title: '命题与证明' },
    '7.1': { ch: 7, no: '7.1', title: '认识证明' },
    '7.2': { ch: 7, no: '7.2', title: '平行线的证明' },
    '7.R': { ch: 7, no: '回顾', title: '回顾与思考' }
  };
  M.slides = [];
  M.slide = function (def) { M.slides.push(def); return def; };

  /* ---------- 运动偏好 ---------- */
  M.reduced = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  M.motion = M.reduced ? 0.35 : 1;

  /* ---------- DOM ---------- */
  M.$ = function (sel, root) { return (root || document).querySelector(sel); };
  M.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  M.el = function (tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    if (html != null) e.innerHTML = html;
    return e;
  };
  M.frag = function (html) {
    var t = document.createElement('template');
    t.innerHTML = String(html).trim();
    return t.content;
  };
  M.on = function (el, type, fn, opts) {
    el.addEventListener(type, fn, opts);
    return function () { el.removeEventListener(type, fn, opts); };
  };
  M.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  M.lerp = function (a, b, t) { return a + (b - a) * t; };
  M.range = function (a, b, step) {
    var out = []; step = step || 1;
    for (var v = a; step > 0 ? v <= b + 1e-9 : v >= b - 1e-9; v += step) out.push(Math.round(v * 1e9) / 1e9);
    return out;
  };
  M.shuffle = function (arr, seed) {
    var a = arr.slice(), s = seed == null ? Math.random() * 1e9 : seed;
    function rnd() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };

  /* ---------- 数字格式 ---------- */
  function minus(s) { return s.replace(/^-/, '−'); }
  M.fmt = function (x, d) {
    if (d == null) d = 2;
    if (x == null || !isFinite(x)) return '—';
    var p = Math.pow(10, d);
    var r = Math.round(Math.abs(x) * p) / p * (x < 0 ? -1 : 1);
    var s = r.toFixed(d);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0') s = '0';
    return minus(s);
  };
  M.fix = function (x, d) {
    if (x == null || !isFinite(x)) return '—';
    var p = Math.pow(10, d);
    var r = Math.round(Math.abs(x) * p) / p * (x < 0 ? -1 : 1);
    var s = r.toFixed(d);
    if (/^-0(\.0+)?$/.test(s)) s = s.slice(1);
    return minus(s);
  };
  M.signed = function (x, d) {
    var s = M.fmt(x, d);
    return x > 0 ? '+' + s : s;
  };
  /* 分数 HTML：M.frac('分子', '分母') */
  M.frac = function (a, b) { return '<span class="frac"><span>' + a + '</span><span>' + b + '</span></span>'; };
  M.xbar = function (v) { return '<span class="ov v">' + (v || 'x') + '</span>'; };

  /* ---------- 图标 ---------- */
  var ICONS = {
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    pen: '<path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20z"/><path d="M14 7l3 3"/>',
    timer: '<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V10M9.5 3h5M12 3v3.5"/>',
    text: '<path d="M3.5 19l5-14 5 14M5.6 14h5.8M14.5 19l3-8 3 8M15.6 16.3h3.8"/>',
    theme: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    exitfull: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    eraser: '<path d="M9 20h11"/><path d="M5.2 15.2l8.3-8.3a2 2 0 0 1 2.8 0l2.3 2.3a2 2 0 0 1 0 2.8L12 18.6H8.6z"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"/><path d="M4.5 4.5V9H9"/>',
    shuffle: '<path d="M4 7h3.2l9.6 10H20M4 17h3.2l2.9-3M14 10l2.8-3H20M18 5l2 2-2 2M18 15l2 2-2 2"/>',
    sort: '<path d="M6 18V6M3 9l3-3 3 3M11 7h9M11 12h6M11 17h3"/>',
    eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    arrow: '<path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5"/>',
    ruler: '<path d="M3.5 16.5L16.5 3.5l4 4-13 13z"/><path d="M7.5 12.5l2 2M10.5 9.5l2 2M13.5 6.5l2 2"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>'
  };
  M.icon = function (name, cls) {
    return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  };
  M.hydrateIcons = function (root) {
    M.$$('[data-icon]', root).forEach(function (b) {
      if (b.querySelector('svg.ico')) return;
      b.insertAdjacentHTML(b.hasAttribute('data-icon-after') ? 'beforeend' : 'afterbegin', M.icon(b.getAttribute('data-icon')));
    });
  };

  /* ---------- SVG ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  M.NS = NS;
  M.attr = function (e, attrs) {
    for (var k in attrs) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) { e.removeAttribute(k); continue; }
      if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v);
    }
    return e;
  };
  M.svg = function (tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) M.attr(e, attrs);
    if (parent) parent.appendChild(e);
    return e;
  };
  /* 创建一个铺满容器的 svg 画布 */
  M.canvas = function (host, w, h, cls) {
    var s = M.svg('svg', { viewBox: '0 0 ' + w + ' ' + h, preserveAspectRatio: 'xMidYMid meet', 'class': cls || '' });
    host.appendChild(s);
    return s;
  };
  /* 标签文字：花括号内为斜体字母，如 '∠{AOC}'、'{x}_1' */
  M.label = function (parent, x, y, str, attrs) {
    var t = M.svg('text', Object.assign({ x: x, y: y }, attrs || {}), parent);
    M.setLabel(t, str);
    return t;
  };
  M.setLabel = function (t, str) {
    while (t.firstChild) t.removeChild(t.firstChild);
    var re = /\{([^}]*)\}|_(\w)|\^(\w)|([^{_^]+)/g, m;
    str = String(str);
    while ((m = re.exec(str))) {
      var sp = document.createElementNS(NS, 'tspan');
      if (m[1] != null) { sp.textContent = m[1]; sp.setAttribute('class', 't-m'); }
      else if (m[2] != null) { sp.textContent = m[2]; sp.setAttribute('baseline-shift', 'sub'); sp.setAttribute('font-size', '70%'); }
      else if (m[3] != null) { sp.textContent = m[3]; sp.setAttribute('baseline-shift', 'super'); sp.setAttribute('font-size', '70%'); }
      else sp.textContent = m[4];
      t.appendChild(sp);
    }
    return t;
  };
  /* HTML 中的点名、线名：自动把 ABC 之类字母变斜体 */
  M.m = function (s) { return '<span class="m">' + s + '</span>'; };

  /* ---------- 缓动与补间 ---------- */
  M.ease = {
    linear: function (t) { return t; },
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    inCubic: function (t) { return t * t * t; },
    inOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    outQuint: function (t) { return 1 - Math.pow(1 - t, 5); },
    inOutSine: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
    outBack: function (t) { var c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: function (t) {
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3.2) + 1;
    }
  };
  /* 动画组：每张幻灯片一组，离开时可整体取消 */
  function Anim() { this.list = []; }
  Anim.prototype.tween = function (o) {
    var self = this;
    var ease = typeof o.ease === 'function' ? o.ease : (M.ease[o.ease] || M.ease.inOutCubic);
    var dur = (o.dur == null ? 600 : o.dur) * M.motion;
    var delay = (o.delay || 0) * M.motion;
    var start = null, raf = 0, dead = false, resolve;
    var h = { cancel: function () { dead = true; cancelAnimationFrame(raf); self._rm(h); if (resolve) resolve(false); } };
    h.promise = new Promise(function (r) { resolve = r; });
    function frame(now) {
      if (dead) return;
      if (start === null) start = now + delay;
      if (now < start) { raf = requestAnimationFrame(frame); return; }
      var t = dur <= 0 ? 1 : Math.min(1, (now - start) / dur);
      o.update(ease(t), t);
      if (t < 1) raf = requestAnimationFrame(frame);
      else { self._rm(h); if (o.done) o.done(); resolve(true); }
    }
    raf = requestAnimationFrame(frame);
    this.list.push(h);
    return h;
  };
  Anim.prototype.wait = function (ms) {
    return this.tween({ dur: ms, update: function () {} }).promise;
  };
  Anim.prototype._rm = function (h) { var i = this.list.indexOf(h); if (i >= 0) this.list.splice(i, 1); };
  Anim.prototype.cancelAll = function () { this.list.slice().forEach(function (h) { h.cancel(); }); this.list = []; };
  Anim.prototype.busy = function () { return this.list.length > 0; };
  M.Anim = Anim;
  M.anim = new Anim();

  /* 数字滚动 */
  M.countTo = function (el, to, opts) {
    opts = opts || {};
    var d = opts.d == null ? 2 : opts.d;
    var format = opts.format || function (v) { return opts.fixed ? M.fix(v, d) : M.fmt(v, d); };
    var from = el._v == null ? to : el._v;
    el._v = to;
    if (el._tw) el._tw.cancel();
    if (from === to || !isFinite(from) || !isFinite(to)) { el.textContent = format(to); return; }
    el._tw = (opts.anim || M.anim).tween({
      dur: opts.dur || 520, ease: 'outCubic',
      update: function (e) { el.textContent = format(from + (to - from) * e); }
    });
  };
  M.flash = function (el) {
    if (!el) return;
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  };

  /* ---------- 拖拽（SVG 坐标） ---------- */
  M.svgPoint = function (svg, e) {
    var p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    var m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    p = p.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  M.drag = function (target, o) {
    function down(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var svg = o.svg || target.ownerSVGElement || target;
      var p0 = M.svgPoint(svg, e);
      if (o.start && o.start(p0, e) === false) return;
      e.preventDefault();
      e.stopPropagation();
      try { target.setPointerCapture(e.pointerId); } catch (err) { /* 旧浏览器忽略 */ }
      target.classList.add('dragging');
      var id = e.pointerId;
      function mv(ev) {
        if (ev.pointerId !== id) return;
        ev.preventDefault();
        if (o.move) o.move(M.svgPoint(svg, ev), ev);
      }
      function up(ev) {
        if (ev.pointerId !== id) return;
        target.removeEventListener('pointermove', mv);
        target.removeEventListener('pointerup', up);
        target.removeEventListener('pointercancel', up);
        target.classList.remove('dragging');
        if (o.end) o.end(M.svgPoint(svg, ev), ev);
      }
      target.addEventListener('pointermove', mv);
      target.addEventListener('pointerup', up);
      target.addEventListener('pointercancel', up);
    }
    target.addEventListener('pointerdown', down);
    return function () { target.removeEventListener('pointerdown', down); };
  };
  /* 标准拖动手柄：光晕 + 圆钮 */
  M.handle = function (parent, x, y, opts) {
    opts = opts || {};
    var g = M.svg('g', { 'class': 'handle' + (opts.cls ? ' ' + opts.cls : ''), transform: 'translate(' + x + ',' + y + ')' }, parent);
    var r = opts.r || 11;
    M.svg('circle', { 'class': 'halo', r: r * 2.1, cx: 0, cy: 0 }, g);
    M.svg('circle', { 'class': 'knob', r: r, cx: 0, cy: 0 }, g);
    M.svg('circle', { 'class': 'core', r: r * 0.38, cx: 0, cy: 0 }, g);
    if (opts.color) g.style.setProperty('--accent', opts.color);
    g.setAttribute('tabindex', '0');
    if (opts.label) g.setAttribute('aria-label', opts.label);
    g.move = function (nx, ny) { g.setAttribute('transform', 'translate(' + nx + ',' + ny + ')'); };
    return g;
  };

  /* ---------- 统计 ---------- */
  var S = M.stats = {};
  S.sum = function (a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; };
  S.mean = function (a) { return a.length ? S.sum(a) / a.length : NaN; };
  S.wmean = function (xs, ws) {
    var t = 0, w = 0;
    for (var i = 0; i < xs.length; i++) { t += xs[i] * ws[i]; w += ws[i]; }
    return w ? t / w : NaN;
  };
  S.sorted = function (a) { return a.slice().sort(function (x, y) { return x - y; }); };
  S.freq = function (a) {
    var m = {};
    a.forEach(function (v) { m[v] = (m[v] || 0) + 1; });
    return m;
  };
  /* 众数：出现次数最多的数据（可以不止一个）；各数据次数都相同时返回 all:true */
  S.modes = function (a) {
    var f = S.freq(a), max = 0, keys = Object.keys(f);
    keys.forEach(function (k) { if (f[k] > max) max = f[k]; });
    var vals = keys.filter(function (k) { return f[k] === max; }).map(Number).sort(function (x, y) { return x - y; });
    return { values: vals, count: max, all: vals.length === keys.length && keys.length > 1 };
  };
  S.median = function (a) {
    var s = S.sorted(a), n = s.length;
    if (!n) return NaN;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  };
  /* 四分位数（教材算法）：排序后以中位数分成前后两半，n 为奇数时两半都不含中位数；
     前一半的中位数为 m25，后一半的中位数为 m75。 */
  S.quartiles = function (a) {
    var s = S.sorted(a), n = s.length, h = Math.floor(n / 2);
    var lower = s.slice(0, h), upper = n % 2 ? s.slice(h + 1) : s.slice(h);
    return {
      min: s[0], max: s[n - 1],
      q1: S.median(lower.length ? lower : s), q2: S.median(s), q3: S.median(upper.length ? upper : s),
      lower: lower, upper: upper, sorted: s
    };
  };
  /* 离差平方和 S = Σ(x - x̄)² */
  S.ss = function (a) {
    var m = S.mean(a), t = 0;
    for (var i = 0; i < a.length; i++) t += (a[i] - m) * (a[i] - m);
    return t;
  };
  S.variance = function (a) { return a.length ? S.ss(a) / a.length : NaN; };
  S.sd = function (a) { return Math.sqrt(S.variance(a)); };
  S.range = function (a) { return Math.max.apply(null, a) - Math.min.apply(null, a); };
  /* p% 分位数（n·p% 为整数时取第 i 与 i+1 项平均，否则取向上取整项） */
  S.percentile = function (a, p) {
    var s = S.sorted(a), n = s.length, i = n * p / 100;
    if (Math.abs(i - Math.round(i)) < 1e-9) {
      i = Math.round(i);
      if (i <= 0) return s[0];
      if (i >= n) return s[n - 1];
      return (s[i - 1] + s[i]) / 2;
    }
    return s[Math.ceil(i) - 1];
  };
  S.expand = function (values, counts) {
    var out = [];
    values.forEach(function (v, i) { for (var k = 0; k < counts[i]; k++) out.push(v); });
    return out;
  };
  S.isPrime = function (n) {
    if (n < 2 || n % 1) return false;
    if (n < 4) return true;
    if (n % 2 === 0) return false;
    for (var d = 3; d * d <= n; d += 2) if (n % d === 0) return false;
    return true;
  };
  S.factor = function (n) {
    var out = [], d = 2;
    while (n > 1 && d * d <= n) { while (n % d === 0) { out.push(d); n /= d; } d++; }
    if (n > 1) out.push(n);
    return out;
  };

  /* ---------- 几何（屏幕坐标，角度按"向上为正"的视觉方向） ---------- */
  var G = M.geo = {};
  var RAD = Math.PI / 180;
  G.RAD = RAD;
  G.dist = function (a, b) { return Math.hypot(b.x - a.x, b.y - a.y); };
  G.mid = function (a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
  G.add = function (a, b) { return { x: a.x + b.x, y: a.y + b.y }; };
  G.sub = function (a, b) { return { x: a.x - b.x, y: a.y - b.y }; };
  G.scale = function (a, k) { return { x: a.x * k, y: a.y * k }; };
  /* 方向角：从 a 指向 b，0° 向右，90° 向上 */
  G.dir = function (a, b) { return Math.atan2(a.y - b.y, b.x - a.x) / RAD; };
  G.norm = function (deg) { deg = deg % 360; return deg < 0 ? deg + 360 : deg; };
  G.polar = function (c, r, deg) { return { x: c.x + r * Math.cos(deg * RAD), y: c.y - r * Math.sin(deg * RAD) }; };
  /* 顶点 v 处，射线 v→p 与 v→q 所成角（0~180） */
  G.angleAt = function (v, p, q) {
    var d = Math.abs(G.norm(G.dir(v, q) - G.dir(v, p)));
    return d > 180 ? 360 - d : d;
  };
  /* 从 a0 逆时针转到 a1 的圆弧 */
  G.arcPath = function (c, r, a0, a1) {
    var d = G.norm(a1 - a0);
    var p0 = G.polar(c, r, a0), p1 = G.polar(c, r, a0 + d);
    return 'M' + p0.x.toFixed(2) + ' ' + p0.y.toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + (d > 180 ? 1 : 0) + ' 0 ' + p1.x.toFixed(2) + ' ' + p1.y.toFixed(2);
  };
  G.sectorPath = function (c, r, a0, a1) {
    return 'M' + c.x.toFixed(2) + ' ' + c.y.toFixed(2) + ' L' + G.arcPath(c, r, a0, a1).slice(1) + ' Z';
  };
  /* 角 ∠pvq 的内角（<180°）起止方向 */
  G.innerSpan = function (v, p, q) {
    var a = G.dir(v, p), b = G.dir(v, q);
    var d = G.norm(b - a);
    return d <= 180 ? { a0: a, a1: a + d, size: d } : { a0: b, a1: b + (360 - d), size: 360 - d };
  };
  G.lineX = function (p1, p2, p3, p4) {
    var d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(d) < 1e-9) return null;
    var t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
    return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
  };
  /* 过点 p、方向角 deg 的直线，裁到矩形 [x0,y0,x1,y1] 内的两端点 */
  G.clipLine = function (p, deg, box) {
    var dx = Math.cos(deg * RAD), dy = -Math.sin(deg * RAD);
    var ts = [];
    if (Math.abs(dx) > 1e-9) { ts.push((box[0] - p.x) / dx, (box[2] - p.x) / dx); }
    if (Math.abs(dy) > 1e-9) { ts.push((box[1] - p.y) / dy, (box[3] - p.y) / dy); }
    var pts = ts.map(function (t) { return { x: p.x + t * dx, y: p.y + t * dy, t: t }; }).filter(function (q) {
      return q.x >= box[0] - 1e-6 && q.x <= box[2] + 1e-6 && q.y >= box[1] - 1e-6 && q.y <= box[3] + 1e-6;
    }).sort(function (a, b) { return a.t - b.t; });
    if (pts.length < 2) return [p, p];
    return [pts[0], pts[pts.length - 1]];
  };
  G.lerpPt = function (a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
  G.rotate = function (p, c, deg) {
    var r = -deg * RAD, dx = p.x - c.x, dy = p.y - c.y;
    return { x: c.x + dx * Math.cos(r) - dy * Math.sin(r), y: c.y + dx * Math.sin(r) + dy * Math.cos(r) };
  };
  /* 直角标记 */
  G.rightMark = function (v, a1, a2, s) {
    var p1 = G.polar(v, s, a1), p2 = G.polar(v, s, a2);
    var p3 = { x: p1.x + p2.x - v.x, y: p1.y + p2.y - v.y };
    return 'M' + p1.x + ' ' + p1.y + ' L' + p3.x + ' ' + p3.y + ' L' + p2.x + ' ' + p2.y;
  };
  /* 角度转"度分"：109.4667 → 109°28′ */
  G.dms = function (deg) {
    var d = Math.floor(deg + 1e-9), m = Math.round((deg - d) * 60);
    if (m === 60) { d += 1; m = 0; }
    return d + '°' + (m ? m + '′' : '');
  };

  /* ---------- 杂项 ---------- */
  M.store = {
    get: function (k, dflt) { try { var v = global.localStorage.getItem('shuju-zhengming:' + k); return v == null ? dflt : JSON.parse(v); } catch (e) { return dflt; } },
    set: function (k, v) { try { global.localStorage.setItem('shuju-zhengming:' + k, JSON.stringify(v)); } catch (e) { /* 存储不可用时忽略 */ } }
  };
  var toastTimer = 0;
  M.toast = function (msg, ms) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, ms || 2200);
  };
  /* 为 range 滑块同步填充色 */
  M.syncRange = function (inp) {
    var min = +inp.min || 0, max = +inp.max || 100, v = +inp.value;
    inp.style.setProperty('--p', ((v - min) / (max - min) * 100) + '%');
  };
})(window);
