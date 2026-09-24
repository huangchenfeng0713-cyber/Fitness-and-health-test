/* ============================================================
   数据与证明互动课堂 · 应用主控
   幻灯片路由、分步显示、目录、进度、画笔批注、计时器、全屏与主题
   ============================================================ */
(function (M) {
  'use strict';
  var $ = M.$, $$ = M.$$;
  var app = $('#app'), stage = $('#stage');
  M.lastVisited = M.store.get('last', null);
  var slides = M.slides;
  var inst = {};          // id → {el, body, def, api, hooks, steps, step, anim}
  var cur = -1;
  var byId = {};
  slides.forEach(function (d, i) { d.index = i; byId[d.id] = d; });

  /* ---------- 渲染 ---------- */
  function layoutCls(l) {
    if (!l) return 'layout-split';
    return l.split(' ').map(function (p) { return p === 'split' ? 'layout-split' : (p === 'full' ? 'layout-full' : (p === 'center' ? 'layout-center' : p)); }).join(' ');
  }
  function headHTML(d, sec) {
    var eb = '';
    if (sec.ch) {
      eb = (sec.no && sec.no !== '回顾' ? '<span class="sec-no">' + sec.no + '</span>' : '') + '<span>' + sec.title + '</span>';
      if (d.lesson) eb += '<span aria-hidden="true">·</span><span>' + d.lesson + '</span>';
    }
    return '<header class="slide-head"><div class="eyebrow">' + eb + '</div>' +
      '<div class="title-row">' + (d.kind ? '<span class="kind ' + (d.kindCls || '') + '">' + d.kind + '</span>' : '') +
      '<h2>' + d.title + '</h2></div></header>';
  }
  function build(d) {
    if (inst[d.id]) return inst[d.id];
    var sec = M.SECTIONS[d.sec] || M.SECTIONS.home;
    var el = M.el('section', { 'class': 'slide ch-' + sec.ch + (d.cls ? ' ' + d.cls : ''), 'data-id': d.id, 'aria-label': d.title });
    var inner = M.el('div', { 'class': 'slide-inner' });
    if (!d.noHead) inner.innerHTML = headHTML(d, sec);
    var body = M.el('div', { 'class': 'slide-body ' + layoutCls(d.layout) });
    body.innerHTML = typeof d.html === 'function' ? d.html() : (d.html || '');
    inner.appendChild(body);
    el.appendChild(inner);
    stage.appendChild(el);
    M.hydrateIcons(el);
    var rec = { el: el, body: body, def: d, step: 0, steps: 0, anim: new M.Anim(), hooks: {} };
    inst[d.id] = rec;
    rec.api = {
      root: el, body: body, anim: rec.anim,
      step: function () { return rec.step; },
      setSteps: function (n) { rec.steps = n; updateDock(); },
      goStep: function (n) { setStep(rec, n); },
      next: next, prev: prev,
      isActive: function () { return slides[cur] === d; }
    };
    if (d.mount) {
      try { rec.hooks = d.mount(body, rec.api) || {}; }
      catch (err) { console.error('幻灯片挂载失败：' + d.id, err); body.insertAdjacentHTML('beforeend', '<p class="red">本页互动加载失败：' + err.message + '</p>'); }
    }
    M.hydrateIcons(el);
    var maxStep = 0;
    $$('[data-step]', el).forEach(function (s) { maxStep = Math.max(maxStep, +s.getAttribute('data-step') || 0); });
    rec.steps = Math.max(d.steps || 0, maxStep, rec.steps || 0);
    $$('[data-goto]', el).forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); goId(a.getAttribute('data-goto')); });
    });
    $$('[data-next]', el).forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); next(); }); });
    return rec;
  }

  function setStep(rec, n, quiet) {
    n = M.clamp(n, 0, rec.steps);
    var prevStep = rec.step;
    rec.step = n;
    var fresh = null;
    $$('[data-step]', rec.el).forEach(function (s) {
      var k = +s.getAttribute('data-step');
      var hide = k > n;
      s.classList.toggle('step-hidden', hide);
      if (!hide && k === n && n > prevStep && !quiet) {
        s.classList.remove('step-now'); void s.offsetWidth;
        if (s.hasAttribute('data-glow')) s.classList.add('step-now');
        fresh = s;
      }
    });
    if (rec.hooks.onStep) {
      try { rec.hooks.onStep(n, prevStep); } catch (err) { console.error(err); }
    }
    if (!quiet && n > prevStep) {
      var now = rec.el.querySelector('.pline.now') || fresh;
      if (now) M.ensureVisible(now);
    }
    if (slides[cur] === rec.def) updateDock();
  }

  /* ---------- 导航 ---------- */
  function go(i, opt) {
    opt = opt || {};
    i = M.clamp(i, 0, slides.length - 1);
    var d = slides[i];
    var rec = build(d);
    if (i === cur) { if (opt.step != null) setStep(rec, opt.step); return; }
    var old = cur >= 0 ? inst[slides[cur].id] : null;
    var dir = opt.dir || (i > cur ? 1 : -1);
    cur = i;
    // 进入前确定步骤
    var startStep = opt.step != null ? opt.step : (opt.fromBack ? rec.steps : 0);
    setStep(rec, startStep, true);
    if (old) {
      if (old.hooks.leave) { try { old.hooks.leave(); } catch (e) { console.error(e); } }
      old.el.classList.remove('is-active');
      old.el.classList.add('is-leaving');
      var oa = old.el.animate ? old.el.animate(
        [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(' + (-2.5 * dir) + '%)' }],
        { duration: 260 * M.motion, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' }) : null;
      var clear = function () { old.el.classList.remove('is-leaving'); if (oa) oa.cancel(); };
      if (oa) oa.onfinish = clear; else clear();
    }
    rec.el.classList.add('is-active');
    rec.el.scrollTop = 0;
    if (rec.el.animate && old) {
      rec.el.animate(
        [{ opacity: 0, transform: 'translateX(' + (3 * dir) + '%)' }, { opacity: 1, transform: 'none' }],
        { duration: 440 * M.motion, delay: 70 * M.motion, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    }
    // 荧光划线重新播放
    $$('.hl', rec.el).forEach(function (h) { h.style.transition = 'none'; h.style.backgroundSize = '0% 100%'; });
    void rec.el.offsetWidth;
    $$('.hl', rec.el).forEach(function (h) { h.style.transition = ''; h.style.backgroundSize = ''; });
    if (rec.hooks.enter) { try { rec.hooks.enter(); } catch (e) { console.error(e); } }
    var sec = M.SECTIONS[d.sec] || M.SECTIONS.home;
    app.className = 'app ch-' + sec.ch;
    if (!opt.noHash) {
      try { history.replaceState(null, '', '#' + d.id); } catch (e) { location.hash = d.id; }
    }
    updateCrumbs(d, sec);
    updateDock();
    updateToc();
    Pen.onSlide(d.id);
    M.store.set('last', d.id);
  }
  function goId(id, opt) { if (byId[id]) go(byId[id].index, opt); }
  function next() {
    var rec = inst[slides[cur].id];
    if (rec.step < rec.steps) { setStep(rec, rec.step + 1); return; }
    if (cur < slides.length - 1) go(cur + 1, { dir: 1 });
  }
  function prev() {
    var rec = inst[slides[cur].id];
    if (rec.step > 0) { setStep(rec, rec.step - 1); return; }
    if (cur > 0) go(cur - 1, { dir: -1, fromBack: true });
  }
  M.go = goId;
  M.next = next;
  M.prev = prev;

  /* ---------- 面包屑、底栏、进度 ---------- */
  function updateCrumbs(d, sec) {
    var c = $('#crumbs');
    if (!sec.ch) { c.innerHTML = '<span>北师大版（2024）八年级上册 · 第六章 数据的分析 · 第七章 命题与证明</span>'; return; }
    var html = '<span class="ch-tag">' + (sec.ch === 6 ? '第六章' : '第七章') + '</span><span>' + M.CHAPTERS[sec.ch].title + '</span>';
    if (sec.no && sec.no.indexOf('章') < 0) html += '<span class="sep">›</span><span>' + (sec.no === '回顾' ? '' : sec.no + ' ') + sec.title + '</span>';
    if (d.lesson) html += '<span class="sep">›</span><span>' + d.lesson + '</span>';
    c.innerHTML = html;
  }
  var btnPrev = $('#btnPrev'), btnNext = $('#btnNext');
  function updateDock() {
    if (cur < 0) return;
    var rec = inst[slides[cur].id];
    $('#pageInfo').textContent = (cur + 1) + ' / ' + slides.length;
    $('#stepInfo').textContent = rec.steps ? '步骤 ' + rec.step + '/' + rec.steps : '';
    btnPrev.disabled = cur === 0 && rec.step === 0;
    var lastPage = cur === slides.length - 1;
    btnNext.disabled = lastPage && rec.step >= rec.steps;
    btnNext.querySelector('span').textContent = rec.step < rec.steps ? '下一步' : '下一页';
    btnPrev.querySelector('span').textContent = rec.step > 0 ? '上一步' : '上一页';
    updateProgress();
  }
  var segs = [];
  function buildProgress() {
    var host = $('#progress');
    var order = [], count = {};
    slides.forEach(function (d) { if (!count[d.sec]) { count[d.sec] = 0; order.push(d.sec); } count[d.sec]++; });
    order.forEach(function (s) {
      var sec = M.SECTIONS[s];
      var b = M.el('button', { type: 'button', 'class': 'seg c' + sec.ch, title: (sec.no ? sec.no + ' ' : '') + sec.title, 'aria-label': '跳到 ' + sec.title });
      b.style.flexGrow = String(count[s]);
      b.innerHTML = '<i></i>';
      b.addEventListener('click', function () {
        var first = slides.filter(function (d) { return d.sec === s; })[0];
        goId(first.id);
      });
      host.appendChild(b);
      segs.push({ sec: s, el: b, n: count[s] });
    });
  }
  function updateProgress() {
    var d = slides[cur];
    var passed = true;
    segs.forEach(function (sg) {
      var fill;
      if (sg.sec === d.sec) {
        var idx = slides.filter(function (x) { return x.sec === sg.sec; }).indexOf(d);
        fill = (idx + 1) / sg.n; passed = false;
      } else fill = passed ? 1 : 0;
      sg.el.firstChild.style.width = (fill * 100) + '%';
    });
  }

  /* ---------- 目录 ---------- */
  var toc = $('#toc'), scrim = $('#scrim');
  function buildToc() {
    var body = $('#tocBody');
    var html = '', lastCh = null, lastSec = null, lastLesson = null;
    slides.forEach(function (d) {
      var sec = M.SECTIONS[d.sec];
      if (sec.ch !== lastCh) {
        if (lastCh !== null) html += '</div></div>';
        html += '<div class="toc-ch" style="--dot:' + (sec.ch === 6 ? 'var(--c6)' : sec.ch === 7 ? 'var(--c7)' : 'var(--ink-3)') + '"><h3><i></i>' + (sec.ch ? M.CHAPTERS[sec.ch].full : '开始') + '</h3><div>';
        lastCh = sec.ch; lastSec = null;
      }
      if (d.sec !== lastSec) {
        if (sec.ch) html += '<div class="toc-sec-title"><span class="no">' + (sec.no.indexOf('章') >= 0 || sec.no === '回顾' ? '' : sec.no) + '</span><span>' + (sec.no.indexOf('章') >= 0 ? '章首页' : sec.title) + '</span></div>';
        lastSec = d.sec; lastLesson = null;
      }
      if (d.lesson && d.lesson !== lastLesson) { html += '<div class="toc-lesson">' + d.lesson + '</div>'; lastLesson = d.lesson; }
      html += '<button type="button" class="toc-link" data-id="' + d.id + '">' + (d.kind ? '<span class="k">' + d.kind + '</span>' : '') + '<span>' + d.title.replace(/<[^>]+>/g, '') + '</span></button>';
    });
    html += '</div></div>';
    body.innerHTML = html;
    $$('.toc-link', body).forEach(function (b) {
      b.addEventListener('click', function () { goId(b.getAttribute('data-id')); openToc(false); });
    });
  }
  function updateToc() {
    var id = slides[cur].id;
    $$('.toc-link', toc).forEach(function (b) {
      var on = b.getAttribute('data-id') === id;
      b.classList.toggle('cur', on);
      if (on && toc.classList.contains('open')) b.scrollIntoView({ block: 'nearest' });
    });
  }
  function openToc(open) {
    if (open == null) open = !toc.classList.contains('open');
    toc.classList.toggle('open', open);
    toc.setAttribute('aria-hidden', open ? 'false' : 'true');
    scrim.hidden = !open;
    if (open) {
      closePops();
      var c = $('.toc-link.cur', toc);
      if (c) c.scrollIntoView({ block: 'center' });
      setTimeout(function () { var cc = $('.toc-link.cur', toc) || $('.toc-link', toc); if (cc) cc.focus({ preventScroll: true }); }, 60);
    }
  }
  $('#btnToc').addEventListener('click', function () { openToc(); });
  $('#btnTocClose').addEventListener('click', function () { openToc(false); });
  scrim.addEventListener('click', function () { openToc(false); });

  /* ---------- 弹出面板 ---------- */
  var pops = { font: $('#fontPop'), timer: $('#timerPop') };
  function closePops(except) {
    Object.keys(pops).forEach(function (k) { if (k !== except) pops[k].hidden = true; });
    $('#btnFont').classList.toggle('on', !pops.font.hidden);
    $('#btnTimer').classList.toggle('on', !pops.timer.hidden || Timer.running);
  }
  function togglePop(k, btn) {
    var p = pops[k];
    var show = p.hidden;
    closePops(k);
    p.hidden = !show;
    if (show) {
      var r = btn.getBoundingClientRect();
      p.style.top = (r.bottom + 8) + 'px';
      p.style.right = Math.max(12, window.innerWidth - r.right) + 'px';
    }
    btn.classList.toggle('on', show || (k === 'timer' && Timer.running));
  }
  document.addEventListener('pointerdown', function (e) {
    var inside = e.target.closest && (e.target.closest('.popover') || e.target.closest('#btnFont') || e.target.closest('#btnTimer'));
    if (!inside) closePops();
  });

  /* 字号 */
  function setFs(v) {
    document.documentElement.style.setProperty('--fs', v);
    $$('#fontPop [data-fs]').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-fs') === +v); });
    M.store.set('fs', v);
  }
  $('#btnFont').addEventListener('click', function () { togglePop('font', this); });
  $$('#fontPop [data-fs]').forEach(function (b) { b.addEventListener('click', function () { setFs(+b.getAttribute('data-fs')); }); });
  setFs(M.store.get('fs', 1));

  /* 主题 */
  function effectiveDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  $('#btnTheme').addEventListener('click', function () {
    var dark = !effectiveDark();
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    M.store.set('theme', dark ? 'dark' : 'light');
    M.toast(dark ? '已切换为深色主题' : '已切换为浅色主题', 1400);
  });
  var savedTheme = M.store.get('theme', null);
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

  /* 全屏 */
  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function toggleFull() {
    try {
      if (isFull()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      var el = document.documentElement;
      var req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!req) { M.toast('当前浏览器不支持全屏，可按 F11'); return; }
      var r = req.call(el);
      if (r && r.catch) r.catch(function () { M.toast('当前环境不允许全屏，可按 F11'); });
    } catch (e) { M.toast('当前环境不允许全屏，可按 F11'); }
  }
  function syncFull() {
    var b = $('#btnFull');
    b.querySelector('svg').outerHTML = M.icon(isFull() ? 'exitfull' : 'full');
    b.querySelector('span').textContent = isFull() ? '退出全屏' : '全屏';
  }
  $('#btnFull').addEventListener('click', toggleFull);
  document.addEventListener('fullscreenchange', syncFull);
  document.addEventListener('webkitfullscreenchange', syncFull);

  /* ---------- 计时器 ---------- */
  var Timer = { total: 180, left: 180, running: false, id: 0 };
  function fmtT(s) { var m = Math.floor(s / 60), r = s % 60; return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r; }
  function renderTimer() {
    $('#timerBig').textContent = fmtT(Timer.left);
    $('#timerText').textContent = fmtT(Timer.left);
    $('#timerStart').textContent = Timer.running ? '暂停' : (Timer.left < Timer.total && Timer.left > 0 ? '继续' : '开始');
    $('#timerChip').hidden = !(Timer.running || (Timer.left < Timer.total));
    $('#timerChip').classList.toggle('done', Timer.left === 0);
    $$('#timerPresets [data-min]').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-min') * 60 === Timer.total); });
  }
  function tick() {
    Timer.left = Math.max(0, Timer.left - 1);
    if (Timer.left === 0) { stopTimer(); M.toast('⏰ 时间到！', 3000); }
    renderTimer();
  }
  function stopTimer() { Timer.running = false; clearInterval(Timer.id); $('#btnTimer').classList.remove('on'); }
  $('#btnTimer').addEventListener('click', function () { togglePop('timer', this); });
  $$('#timerPresets [data-min]').forEach(function (b) {
    b.addEventListener('click', function () { stopTimer(); Timer.total = Timer.left = +b.getAttribute('data-min') * 60; renderTimer(); });
  });
  $('#timerStart').addEventListener('click', function () {
    if (Timer.running) { stopTimer(); renderTimer(); return; }
    if (Timer.left === 0) Timer.left = Timer.total;
    Timer.running = true;
    Timer.id = setInterval(tick, 1000);
    $('#btnTimer').classList.add('on');
    renderTimer();
  });
  $('#timerReset').addEventListener('click', function () { stopTimer(); Timer.left = Timer.total; renderTimer(); });
  $('#timerChip').addEventListener('click', function () { togglePop('timer', $('#btnTimer')); });
  renderTimer();

  /* ---------- 画笔批注 ---------- */
  var Pen = (function () {
    var cv = $('#penCanvas'), bar = $('#penBar'), ctx = cv.getContext('2d');
    var strokes = {}, slideId = null, active = false, erasing = false;
    var color = '#E5402F', size = 6, hl = false, drawing = null;
    function list() { return strokes[slideId] || (strokes[slideId] = []); }
    function resize() {
      var dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(window.innerWidth * dpr);
      cv.height = Math.round(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    }
    function inkColor(c) { return c === 'ink' ? getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#17202B' : c; }
    function drawStroke(s) {
      var W = window.innerWidth, H = window.innerHeight, p = s.pts;
      if (!p.length) return;
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = inkColor(s.color);
      ctx.globalAlpha = s.hl ? 0.38 : 1;
      ctx.lineWidth = s.hl ? s.size * 3.2 : s.size;
      ctx.beginPath();
      ctx.moveTo(p[0][0] * W, p[0][1] * H);
      if (p.length === 1) ctx.lineTo(p[0][0] * W + 0.1, p[0][1] * H + 0.1);
      for (var i = 1; i < p.length - 1; i++) {
        var mx = (p[i][0] + p[i + 1][0]) / 2 * W, my = (p[i][1] + p[i + 1][1]) / 2 * H;
        ctx.quadraticCurveTo(p[i][0] * W, p[i][1] * H, mx, my);
      }
      if (p.length > 1) ctx.lineTo(p[p.length - 1][0] * W, p[p.length - 1][1] * H);
      ctx.stroke();
      ctx.restore();
    }
    function redraw() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (!slideId) return;
      list().forEach(drawStroke);
      if (drawing) drawStroke(drawing);
    }
    function sync() {
      var has = slideId && list().length > 0;
      cv.hidden = !(active || has);
      cv.classList.toggle('passive', !active);
      cv.classList.toggle('erasing', active && erasing);
      bar.hidden = !active;
      $('#btnPen').classList.toggle('on', active);
    }
    function eraseAt(x, y) {
      var W = window.innerWidth, H = window.innerHeight, L = list(), r = 18;
      for (var i = L.length - 1; i >= 0; i--) {
        var hit = L[i].pts.some(function (q) { return Math.hypot(q[0] * W - x, q[1] * H - y) < r + L[i].size; });
        if (hit) L.splice(i, 1);
      }
      redraw();
    }
    cv.addEventListener('pointerdown', function (e) {
      if (!active) return;
      e.preventDefault();
      cv.setPointerCapture(e.pointerId);
      if (erasing) { eraseAt(e.clientX, e.clientY); cv._erasing = true; return; }
      drawing = { color: color, size: size, hl: hl, pts: [[e.clientX / window.innerWidth, e.clientY / window.innerHeight]] };
      redraw();
    });
    cv.addEventListener('pointermove', function (e) {
      if (!active) return;
      if (cv._erasing) { eraseAt(e.clientX, e.clientY); return; }
      if (!drawing) return;
      var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      evs.forEach(function (ev) { drawing.pts.push([ev.clientX / window.innerWidth, ev.clientY / window.innerHeight]); });
      redraw();
    });
    function end() {
      cv._erasing = false;
      if (drawing) { list().push(drawing); drawing = null; redraw(); }
      sync();
    }
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    $$('#penColors .swatch').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('#penColors .swatch').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        color = b.getAttribute('data-color');
        hl = b.hasAttribute('data-hl');
        setErase(false);
      });
    });
    $$('#penSizes button').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('#penSizes button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        size = +b.getAttribute('data-size');
      });
    });
    function setErase(v) { erasing = v; $('#penEraser').classList.toggle('on', v); sync(); }
    $('#penEraser').addEventListener('click', function () { setErase(!erasing); });
    $('#penUndo').addEventListener('click', function () { list().pop(); redraw(); sync(); });
    $('#penClear').addEventListener('click', function () { strokes[slideId] = []; redraw(); sync(); });
    $('#penClose').addEventListener('click', function () { toggle(false); });
    function toggle(v) {
      active = v == null ? !active : v;
      if (active) { closePops(); openToc(false); }
      if (!active) setErase(false);
      sync();
      if (active) M.toast('画笔已开启：可在任意位置书写，按 Esc 或“收起”退出', 2400);
    }
    $('#btnPen').addEventListener('click', function () { toggle(); });
    window.addEventListener('resize', resize);
    resize();
    return {
      toggle: toggle,
      isActive: function () { return active; },
      onSlide: function (id) { slideId = id; drawing = null; redraw(); sync(); }
    };
  })();

  /* ---------- 键盘 ---------- */
  document.addEventListener('keydown', function (e) {
    var t = e.target, tag = (t && t.tagName) || '';
    if (/INPUT|SELECT|TEXTAREA/.test(tag) || (t && t.isContentEditable)) {
      if (e.key === 'Escape') t.blur();
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var k = e.key;
    if (k === 'Escape') {
      if (Pen.isActive()) Pen.toggle(false);
      openToc(false); closePops();
      return;
    }
    if (toc.classList.contains('open')) return;
    if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && tag !== 'BUTTON')) { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); prev(); }
    else if (k === 'Home') { e.preventDefault(); go(0, { dir: -1 }); }
    else if (k === 'End') { e.preventDefault(); go(slides.length - 1, { dir: 1 }); }
    else if (k === 't' || k === 'T') openToc();
    else if (k === 'p' || k === 'P') Pen.toggle();
    else if (k === 'f' || k === 'F') toggleFull();
  });
  btnNext.addEventListener('click', next);
  btnPrev.addEventListener('click', prev);

  /* ---------- 启动 ---------- */
  M.hydrateIcons(document);
  buildProgress();
  buildToc();
  function fromHash() {
    var id = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    return byId[id] ? id : null;
  }
  window.addEventListener('hashchange', function () {
    var id = fromHash();
    if (id && slides[cur] && slides[cur].id !== id) goId(id, { noHash: true });
  });
  var start = fromHash() || 'home';
  go(byId[start] ? byId[start].index : 0, { noHash: !fromHash() });
  // 空闲时预先构建下一页，翻页更顺
  var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 300); };
  idle(function () { if (slides[cur + 1]) build(slides[cur + 1]); });
  var lastBuilt = cur;
  setInterval(function () {
    if (cur !== lastBuilt) { lastBuilt = cur; idle(function () { if (slides[cur + 1]) build(slides[cur + 1]); }); }
  }, 700);
})(window.M);
