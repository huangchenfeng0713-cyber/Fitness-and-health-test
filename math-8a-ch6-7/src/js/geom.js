/* ============================================================
   数据与证明互动课堂 · 几何作图
   角标记、直角标记、“两条直线被第三条直线所截”图形
   角的编号（本课件统一约定）：
     直线 a 与截线 c 的交点处：∠1 右上，∠2 左上，∠3 左下，∠4 右下
     直线 b 与截线 c 的交点处：∠5 右上，∠6 左上，∠7 左下，∠8 右下
   ============================================================ */
(function (M) {
  'use strict';
  var S = M.svg, G = M.geo;
  var GF = M.GF = {};

  /* 角标记：顶点 v，从方向 a0 逆时针转到 a1 */
  GF.angle = function (parent, v, a0, a1, o) {
    o = o || {};
    var g = S('g', { 'class': 'ang' }, parent);
    var sec = S('path', {}, g);
    var arc = S('path', { fill: 'none', 'stroke-width': o.width || 2.6, 'stroke-linecap': 'round' }, g);
    var lab = o.label ? S('text', { 'text-anchor': 'middle', 'font-size': o.fontSize || 19, 'font-weight': 700 }, g) : null;
    var arc2 = o.double ? S('path', { fill: 'none', 'stroke-width': 2, 'stroke-linecap': 'round' }, g) : null;
    if (o.noArc) { sec.style.display = 'none'; arc.style.display = 'none'; }
    g.setColor = function (c) {
      sec.style.fill = c; sec.style.fillOpacity = o.fillOpacity == null ? 0.2 : o.fillOpacity;
      arc.style.stroke = c;
      if (arc2) arc2.style.stroke = c;
      if (lab) lab.style.fill = c;
    };
    g.update = function (vv, b0, b1, r) {
      r = r || o.r || 30;
      sec.setAttribute('d', G.sectorPath(vv, r, b0, b1));
      arc.setAttribute('d', G.arcPath(vv, r, b0, b1));
      if (arc2) arc2.setAttribute('d', G.arcPath(vv, r - 6, b0, b1));
      if (lab) {
        var mid = b0 + G.norm(b1 - b0) / 2;
        var size = G.norm(b1 - b0);
        var lp = G.polar(vv, r + (o.labelOff != null ? o.labelOff : (size < 35 ? 22 : 14)), mid);
        M.attr(lab, { x: lp.x, y: lp.y + 7 });
        M.setLabel(lab, o.label);
      }
    };
    g.setLabel = function (t) { o.label = t; if (lab) M.setLabel(lab, t); };
    g.setColor(o.color || 'var(--accent)');
    g.update(v, a0, a1);
    return g;
  };

  /* 直角标记 */
  GF.right = function (parent, v, dir, size, color) {
    var p = S('path', { d: G.rightMark(v, dir, dir + 90, size || 14), fill: 'none', 'stroke-width': 2 }, parent);
    p.style.stroke = color || 'var(--ink-2)';
    return p;
  };

  /* 平行记号：在线段中部画一个小箭头 */
  GF.chevron = function (parent, p, dir, color, n) {
    var g = S('g', {}, parent);
    n = n || 1;
    for (var k = 0; k < n; k++) {
      var c = G.polar(p, k * 9, dir);
      var t1 = G.polar(c, 9, dir + 150), t2 = G.polar(c, 9, dir - 150);
      var pth = S('path', { d: 'M' + t1.x + ' ' + t1.y + ' L' + c.x + ' ' + c.y + ' L' + t2.x + ' ' + t2.y, fill: 'none', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      pth.style.stroke = color || 'var(--accent)';
    }
    return g;
  };

  /* 两条直线 a，b 被直线 c 所截
     o = { box:[x0,y0,x1,y1], a:{p,dir}, b:{p,dir}, c:{p,dir}, names:{a,b,c}, pts:{P,Q, aL,aR,bL,bR,cT,cB} } */
  GF.transversal = function (parent, o) {
    var g = S('g', { 'class': 'tfig' }, parent);
    var gA = S('g', {}, g), gL = S('g', {}, g), gT = S('g', {}, g);
    var L = { a: S('line', { 'class': 'line' }, gL), b: S('line', { 'class': 'line' }, gL), c: S('line', { 'class': 'line acc' }, gL) };
    var names = o.names || { a: 'a', b: 'b', c: 'c' };
    var nameT = {};
    Object.keys(L).forEach(function (k) { if (names[k]) nameT[k] = S('text', { 'font-size': 21, 'class': 't-m' }, gT); });
    var ptT = {};
    var pts = o.pts || {};
    Object.keys(pts).forEach(function (k) { ptT[k] = S('text', { 'font-size': 20, 'class': 't-m', 'text-anchor': 'middle' }, gT); });
    var dots = { P: S('circle', { r: 4, 'class': 'pt' }, gT), Q: S('circle', { r: 4, 'class': 'pt' }, gT) };
    var st = { a: Object.assign({}, o.a), b: Object.assign({}, o.b), c: Object.assign({}, o.c) };
    var marks = {};
    var chev = null;
    var fig = { g: g, lines: L, st: st };
    function right(d) { d = G.norm(d); return Math.cos(d * G.RAD) < 0 ? G.norm(d + 180) : d; }
    function up(d) { d = G.norm(d); return Math.sin(d * G.RAD) < 0 ? G.norm(d + 180) : d; }
    function far(p, d) { return G.polar(p, 100, d); }
    fig.P = function () { return G.lineX(st.a.p, far(st.a.p, st.a.dir), st.c.p, far(st.c.p, st.c.dir)); };
    fig.Q = function () { return G.lineX(st.b.p, far(st.b.p, st.b.dir), st.c.p, far(st.c.p, st.c.dir)); };
    /* 角的起止方向 */
    fig.span = function (key) {
      var at = key.charAt(0) === 'P' ? 'a' : 'b', k = +key.slice(1);
      var v = at === 'a' ? fig.P() : fig.Q();
      var r = right(st[at].dir), u = up(st.c.dir);
      var sp = { 1: [r, u], 2: [u, r + 180], 3: [r + 180, u + 180], 4: [u + 180, r + 360] }[k];
      return { v: v, a0: sp[0], a1: sp[1], size: G.norm(sp[1] - sp[0]) };
    };
    fig.value = function (key) { return fig.span(key).size; };
    fig.mark = function (key, mo) {
      if (marks[key]) { marks[key].remove(); }
      var s = fig.span(key);
      var m = GF.angle(gA, s.v, s.a0, s.a1, mo || {});
      m._key = key; m._o = mo || {};
      marks[key] = m;
      return m;
    };
    fig.unmark = function (key) { if (marks[key]) { marks[key].remove(); delete marks[key]; } };
    fig.clear = function () { Object.keys(marks).forEach(fig.unmark); };
    fig.marks = marks;
    fig.focus = function (keys) {
      Object.keys(marks).forEach(function (k) {
        var on = !keys || keys.indexOf(k) >= 0;
        marks[k].style.transition = 'opacity .35s';
        marks[k].style.opacity = on ? 1 : 0.18;
      });
    };
    fig.draw = function () {
      var box = o.box;
      ['a', 'b', 'c'].forEach(function (k) {
        var e = G.clipLine(st[k].p, st[k].dir, box);
        M.attr(L[k], { x1: e[0].x, y1: e[0].y, x2: e[1].x, y2: e[1].y });
        if (nameT[k]) {
          var end = k === 'c' ? (e[0].y < e[1].y ? e[0] : e[1]) : (e[0].x > e[1].x ? e[0] : e[1]);
          var d = k === 'c' ? up(st.c.dir) : right(st[k].dir);
          var lp = G.polar(end, -16, d);
          var off = k === 'c' ? { x: 14, y: 6 } : { x: -4, y: -14 };
          M.attr(nameT[k], { x: lp.x + off.x, y: lp.y + off.y });
          M.setLabel(nameT[k], names[k].indexOf('{') >= 0 ? names[k] : '{' + names[k] + '}');
        }
      });
      var P = fig.P(), Q = fig.Q();
      if (P && Q) {
        M.attr(dots.P, { cx: P.x, cy: P.y }); M.attr(dots.Q, { cx: Q.x, cy: Q.y });
        var place = function (key, base, dir, dist, dx, dy) {
          if (!ptT[key]) return;
          var q = G.polar(base, dist, dir);
          M.attr(ptT[key], { x: q.x + (dx || 0), y: q.y + 7 + (dy || 0) });
          M.setLabel(ptT[key], '{' + pts[key] + '}');
        };
        var ra = right(st.a.dir), rb = right(st.b.dir), u = up(st.c.dir);
        var at = o.ptAt || { P: 'P2', Q: 'Q3' };
        var bis = function (key) { var s = fig.span(key); return s.a0 + s.size / 2; };
        place('P', P, bis(at.P), 22);
        place('Q', Q, bis(at.Q), 22);
        var ea = G.clipLine(st.a.p, st.a.dir, o.box), eb = G.clipLine(st.b.p, st.b.dir, o.box), ec = G.clipLine(st.c.p, st.c.dir, o.box);
        var lft = function (e) { return e[0].x < e[1].x ? e[0] : e[1]; }, rgt = function (e) { return e[0].x < e[1].x ? e[1] : e[0]; };
        var top = function (e) { return e[0].y < e[1].y ? e[0] : e[1]; }, bot = function (e) { return e[0].y < e[1].y ? e[1] : e[0]; };
        place('aL', G.polar(lft(ea), 26, ra), ra + 90, 18);
        place('aR', G.polar(rgt(ea), -40, ra), ra + 90, 18);
        place('bL', G.polar(lft(eb), 26, rb), rb - 90, 20);
        place('bR', G.polar(rgt(eb), -40, rb), rb - 90, 20);
        place('cT', G.polar(top(ec), 22, u + 180), u - 90, 16);
        place('cB', G.polar(bot(ec), 22, u), u - 90, 16);
      }
      Object.keys(marks).forEach(function (k) { var s = fig.span(k); marks[k].update(s.v, s.a0, s.a1); });
      if (chev) fig.parallel(true);
    };
    fig.parallel = function (on) {
      if (chev) { chev.remove(); chev = null; }
      if (!on) return;
      chev = S('g', {}, gT);
      var ea = G.clipLine(st.a.p, st.a.dir, o.box), eb = G.clipLine(st.b.p, st.b.dir, o.box);
      var ma = G.lerpPt(ea[0], ea[1], 0.18), mb = G.lerpPt(eb[0], eb[1], 0.18);
      if (ma.x > G.lerpPt(ea[0], ea[1], 0.82).x) { ma = G.lerpPt(ea[0], ea[1], 0.82); mb = G.lerpPt(eb[0], eb[1], 0.82); }
      GF.chevron(chev, ma, right(st.a.dir), 'var(--accent)');
      GF.chevron(chev, mb, right(st.b.dir), 'var(--accent)');
    };
    fig.set = function (patch) {
      Object.keys(patch).forEach(function (k) { Object.assign(st[k], patch[k]); });
      fig.draw();
    };
    fig.draw();
    return fig;
  };
})(window.M);
