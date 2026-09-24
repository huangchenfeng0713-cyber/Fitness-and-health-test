/* ============================================================
   数据与证明互动课堂 · 统计图组件
   比例尺、坐标轴、箱线图、扇形图等，均按同一比例尺落点。
   ============================================================ */
(function (M) {
  'use strict';
  var C = M.charts = {};
  var S = M.svg;

  C.scale = function (d0, d1, r0, r1) {
    var f = function (v) { return r0 + (v - d0) / (d1 - d0) * (r1 - r0); };
    f.inv = function (p) { return d0 + (p - r0) / (r1 - r0) * (d1 - d0); };
    f.d0 = d0; f.d1 = d1; f.r0 = r0; f.r1 = r1;
    return f;
  };

  C.niceStep = function (span, count) {
    var raw = span / Math.max(1, count), mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  };
  C.ticks = function (min, max, step) {
    var out = [], s = Math.ceil(min / step - 1e-9) * step;
    for (var v = s; v <= max + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  };

  /* 坐标轴。o: {orient:'x'|'y', scale, at, ticks, fmt, grid:[from,to], label, tickLen, cls} */
  C.axis = function (parent, o) {
    var g = S('g', { 'class': 'axis-g' + (o.cls ? ' ' + o.cls : '') }, parent);
    var sc = o.scale, fmt = o.fmt || function (v) { return M.fmt(v, 2); };
    var tl = o.tickLen == null ? 6 : o.tickLen;
    var fs = o.fontSize || 14;
    if (o.orient === 'x') {
      if (o.line !== false) S('line', { 'class': 'axis', x1: sc.r0, x2: sc.r1, y1: o.at, y2: o.at }, g);
      (o.ticks || []).forEach(function (v) {
        var x = sc(v);
        if (o.grid) S('line', { 'class': 'gridline' + (o.gridDash ? ' dash' : ''), x1: x, x2: x, y1: o.grid[0], y2: o.grid[1] }, g);
        if (tl) S('line', { 'class': 'axis', x1: x, x2: x, y1: o.at, y2: o.at + tl }, g);
        S('text', { x: x, y: o.at + tl + fs + 2, 'text-anchor': 'middle', 'font-size': fs, 'class': 't-num', text: fmt(v) }, g);
      });
      if (o.label) M.label(g, sc.r1 + (o.labelDx || 10), o.at + 5, o.label, { 'font-size': fs, 'text-anchor': 'start' });
    } else {
      if (o.line !== false) S('line', { 'class': 'axis', y1: sc.r0, y2: sc.r1, x1: o.at, x2: o.at }, g);
      (o.ticks || []).forEach(function (v) {
        var y = sc(v);
        if (o.grid) S('line', { 'class': 'gridline' + (o.gridDash ? ' dash' : ''), y1: y, y2: y, x1: o.grid[0], x2: o.grid[1] }, g);
        if (tl) S('line', { 'class': 'axis', y1: y, y2: y, x1: o.at - tl, x2: o.at }, g);
        S('text', { x: o.at - tl - 5, y: y + fs * 0.35, 'text-anchor': 'end', 'font-size': fs, 'class': 't-num', text: fmt(v) }, g);
      });
      if (o.label) M.label(g, o.at + (o.labelDx || 0), Math.min(sc.r0, sc.r1) - 14, o.label, { 'font-size': fs, 'text-anchor': o.labelAnchor || 'middle' });
    }
    return g;
  };

  /* 箱线图。o: {scale, orient:'h'|'v', pos, size, color, tint, labels:bool, fontSize}
     返回 {g, set(five, animate)}，five = {min,q1,q2,q3,max} */
  C.box = function (parent, o) {
    var g = S('g', { 'class': 'boxplot' }, parent);
    var col = o.color || 'var(--accent)', tint = o.tint || 'var(--accent-tint)';
    var wl = S('line', { stroke: col, 'stroke-width': 2, 'stroke-dasharray': '5 5' }, g);
    var wr = S('line', { stroke: col, 'stroke-width': 2, 'stroke-dasharray': '5 5' }, g);
    var c1 = S('line', { stroke: col, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, g);
    var c2 = S('line', { stroke: col, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, g);
    var rect = S('rect', { fill: tint, stroke: col, 'stroke-width': 2.2, rx: 3 }, g);
    var med = S('line', { stroke: col, 'stroke-width': 3.2, 'stroke-linecap': 'round' }, g);
    var labs = [];
    var fs = o.fontSize || 13;
    if (o.labels) for (var i = 0; i < 5; i++) labs.push(S('text', { 'font-size': fs, 'class': 't-num', 'text-anchor': 'middle' }, g));
    var cur = null, anim = o.anim || M.anim, tw = null;
    function draw(f) {
      var sc = o.scale, p = o.pos, h = o.size / 2, cap = h * 0.55;
      var a = sc(f.min), b = sc(f.q1), m = sc(f.q2), c = sc(f.q3), d = sc(f.max);
      if (o.orient === 'v') {
        M.attr(wl, { x1: p, x2: p, y1: a, y2: b }); M.attr(wr, { x1: p, x2: p, y1: c, y2: d });
        M.attr(c1, { x1: p - cap, x2: p + cap, y1: a, y2: a }); M.attr(c2, { x1: p - cap, x2: p + cap, y1: d, y2: d });
        M.attr(rect, { x: p - h, width: 2 * h, y: Math.min(b, c), height: Math.abs(c - b) });
        M.attr(med, { x1: p - h, x2: p + h, y1: m, y2: m });
        if (labs.length) {
          var vals = [f.min, f.q1, f.q2, f.q3, f.max], ys = [a, b, m, c, d];
          labs.forEach(function (t, i) { M.attr(t, { x: p + h + 8, y: ys[i] + fs * 0.35, 'text-anchor': 'start', text: M.fmt(vals[i], 2) }); });
        }
      } else {
        M.attr(wl, { y1: p, y2: p, x1: a, x2: b }); M.attr(wr, { y1: p, y2: p, x1: c, x2: d });
        M.attr(c1, { y1: p - cap, y2: p + cap, x1: a, x2: a }); M.attr(c2, { y1: p - cap, y2: p + cap, x1: d, x2: d });
        M.attr(rect, { y: p - h, height: 2 * h, x: Math.min(b, c), width: Math.abs(c - b) });
        M.attr(med, { y1: p - h, y2: p + h, x1: m, x2: m });
        if (labs.length) {
          var v2 = [f.min, f.q1, f.q2, f.q3, f.max], xs = [a, b, m, c, d];
          labs.forEach(function (t, i) {
            var above = i % 2 === 0;
            M.attr(t, { x: xs[i], y: above ? p - h - 9 : p + h + fs + 5, text: M.fmt(v2[i], 2) });
          });
        }
      }
    }
    function set(f, animate) {
      if (tw) tw.cancel();
      if (!cur || !animate) { cur = f; draw(f); return; }
      var from = cur;
      cur = f;
      tw = anim.tween({
        dur: 700, ease: 'inOutCubic',
        update: function (e) {
          draw({
            min: M.lerp(from.min, f.min, e), q1: M.lerp(from.q1, f.q1, e), q2: M.lerp(from.q2, f.q2, e),
            q3: M.lerp(from.q3, f.q3, e), max: M.lerp(from.max, f.max, e)
          });
        }
      });
    }
    return { g: g, set: set, redraw: function () { if (cur) draw(cur); } };
  };

  /* 扇形统计图。parts:[{v, color, label}]，从正上方开始顺时针 */
  C.pie = function (parent, o) {
    var g = S('g', { 'class': 'pie' }, parent);
    var total = o.parts.reduce(function (s, p) { return s + p.v; }, 0);
    var c = { x: o.cx, y: o.cy }, r = o.r;
    var ang = 90, paths = [];
    o.parts.forEach(function (p, i) {
      var sweep = p.v / total * 360;
      var a1 = ang, a0 = ang - sweep;
      var path = S('path', { fill: p.color, stroke: 'var(--surface)', 'stroke-width': 2, d: M.geo.sectorPath(c, r, a0, a1) }, g);
      paths.push({ el: path, a0: a0, a1: a1, p: p });
      if (p.label) {
        var midA = (a0 + a1) / 2;
        var inside = sweep > 28;
        var lp = M.geo.polar(c, inside ? r * 0.62 : r + 30, midA);
        if (!inside) {
          var e1 = M.geo.polar(c, r + 2, midA), e2 = M.geo.polar(c, r + 18, midA);
          S('line', { x1: e1.x, y1: e1.y, x2: e2.x, y2: e2.y, stroke: 'var(--ink-3)', 'stroke-width': 1.2 }, g);
        }
        var t = S('text', { x: lp.x, y: lp.y + 5, 'text-anchor': 'middle', 'font-size': o.fontSize || 15, 'class': inside ? '' : 't-ink' }, g);
        t.textContent = p.label;
        if (inside) { t.style.fill = p.labelColor || '#fff'; t.style.fontWeight = '700'; }
      }
      ang = a0;
    });
    g.paths = paths;
    return g;
  };

  /* 频数条形图（离散取值）。o:{x,y,w,h, values, counts, color, max, fontSize, xLabel, yLabel}
     返回 {g, bars, sx, sy, set(counts, animate)} */
  C.freqBars = function (parent, o) {
    var g = S('g', { 'class': 'freqbars' }, parent);
    var n = o.values.length, fs = o.fontSize || 14;
    var maxC = o.max || Math.max.apply(null, o.counts.concat([1]));
    var sy = C.scale(0, maxC, o.y + o.h, o.y);
    var band = o.w / n, bw = Math.min(band * (o.barRatio || 0.52), o.maxBar || 60);
    var yt = C.ticks(0, maxC, o.yStep || C.niceStep(maxC, 5));
    C.axis(g, { orient: 'y', scale: sy, at: o.x, ticks: yt, grid: [o.x, o.x + o.w], gridDash: true, fmt: function (v) { return M.fmt(v, 0); }, fontSize: fs, label: o.yLabel, labelAnchor: 'start', labelDx: -8 });
    S('line', { 'class': 'axis', x1: o.x, x2: o.x + o.w, y1: o.y + o.h, y2: o.y + o.h }, g);
    var bars = [];
    o.values.forEach(function (v, i) {
      var cx = o.x + band * (i + 0.5);
      var r = S('rect', { x: cx - bw / 2, width: bw, y: o.y + o.h, height: 0, rx: 3, fill: o.color || 'var(--accent)' }, g);
      var lab = S('text', { x: cx, y: o.y + o.h + fs + 6, 'text-anchor': 'middle', 'font-size': fs, 'class': 't-num', text: o.fmtX ? o.fmtX(v) : M.fmt(v, 2) }, g);
      var cnt = S('text', { x: cx, y: o.y + o.h - 6, 'text-anchor': 'middle', 'font-size': fs - 1, 'class': 't-num t-ink', text: '' }, g);
      bars.push({ rect: r, lab: lab, cnt: cnt, cx: cx, v: v, c: 0 });
    });
    if (o.xLabel) M.label(g, o.x + o.w + 8, o.y + o.h + fs + 6, o.xLabel, { 'font-size': fs - 1 });
    var anim = o.anim || M.anim;
    function place(b, c) {
      var top = sy(c);
      M.attr(b.rect, { y: top, height: Math.max(0, o.y + o.h - top) });
      M.attr(b.cnt, { y: top - 7, text: o.showCounts === false ? '' : (Math.round(c) > 0 ? M.fmt(c, 0) : '') });
    }
    function set(counts, animate) {
      bars.forEach(function (b, i) {
        var from = b.c, to = counts[i];
        b.c = to;
        if (!animate) { place(b, to); return; }
        anim.tween({ dur: 650, delay: i * 50, ease: 'outBack', update: function (e) { place(b, from + (to - from) * e); }, done: function () { place(b, to); } });
      });
    }
    set(o.counts, o.animate !== false);
    return { g: g, bars: bars, sx: function (i) { return o.x + band * (i + 0.5); }, sy: sy, band: band, bw: bw, set: set };
  };
})(window.M);
