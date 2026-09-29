(function () {
  'use strict';
  var lastFocus = null;

  /* ---- Tabs: ARIA + remember last tab ---- */
  var tabBtns = document.querySelectorAll('.tab-btn');
  var tablist = document.querySelector('.tabs');
  if (tablist) tablist.setAttribute('role', 'tablist');

  function paintTabs() {
    tabBtns.forEach(function (b) {
      var m = (b.getAttribute('onclick') || '').match(/'(tab-[^']+)'/);
      var id = m && m[1];
      b.setAttribute('role', 'tab');
      if (id) b.setAttribute('aria-controls', id);
      b.setAttribute('aria-selected', b.classList.contains('active') ? 'true' : 'false');
      b.tabIndex = b.classList.contains('active') ? 0 : -1;
      var panel = id && document.getElementById(id);
      if (panel) panel.setAttribute('role', 'tabpanel');
    });
  }
  paintTabs();
  tabBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      setTimeout(paintTabs, 0);
      try { sessionStorage.setItem('dash-tab', b.getAttribute('onclick')); } catch (e) {}
    });
  });
  tablist && tablist.addEventListener('keydown', function (e) {      // arrow keys (RTL-aware)
    var i = Array.prototype.indexOf.call(tabBtns, document.activeElement);
    if (i < 0) return;
    var next = e.key === 'ArrowLeft' ? i + 1 : e.key === 'ArrowRight' ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    var t = tabBtns[(next + tabBtns.length) % tabBtns.length];
    t.focus(); t.click();
  });

  /* ---- Modals: dialog semantics, Esc, backdrop click, focus return ---- */
  var modals = document.querySelectorAll('.modal-backdrop');
  modals.forEach(function (bd) {
    var m = bd.querySelector('.modal'), h = bd.querySelector('h2');
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    if (h) { h.id = h.id || bd.id + '-title'; m.setAttribute('aria-labelledby', h.id); }
    bd.querySelectorAll('.modal-close').forEach(function (c) { c.setAttribute('aria-label', 'إغلاق'); });
    bd.addEventListener('mousedown', function (e) { if (e.target === bd) closeIt(bd); });
    new MutationObserver(function () {
      if (!bd.classList.contains('hidden')) {
        lastFocus = document.activeElement;
        document.body.style.overflow = 'hidden';
        var f = bd.querySelector('input,select,button:not(.modal-close)');
        f && setTimeout(function () { f.focus(); }, 50);
      } else if (!document.querySelector('.modal-backdrop:not(.hidden)')) {
        document.body.style.overflow = '';
        document.body.classList.remove('qr-fullscreen');
        lastFocus && lastFocus.focus && lastFocus.focus();
      }
    }).observe(bd, { attributes: true, attributeFilter: ['class'] });
  });
  function closeIt(bd) { bd.classList.add('hidden'); }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = document.querySelector('.modal-backdrop:not(.hidden)');
    if (open) closeIt(open);
  });
  // Keep focus inside the open dialog
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var open = document.querySelector('.modal-backdrop:not(.hidden) .modal');
    if (!open) return;
    var f = open.querySelectorAll('a[href],button:not(:disabled),input,select,textarea');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---- Login: show/hide password ---- */
  var pw = document.getElementById('login-password');
  if (pw && !document.querySelector('.pw-toggle')) {
    var wrap = document.createElement('div'); wrap.className = 'pw-wrap';
    pw.parentNode.insertBefore(wrap, pw); wrap.appendChild(pw);
    var t = document.createElement('button');
    t.type = 'button'; t.className = 'pw-toggle'; t.textContent = '👁';
    t.setAttribute('aria-label', 'إظهار كلمة المرور');
    t.onclick = function () {
      var show = pw.type === 'password';
      pw.type = show ? 'text' : 'password';
      t.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
    };
    wrap.appendChild(t);
    pw.focus();
  }

  /* ---- Toasts announce to screen readers ---- */
  var tc = document.getElementById('toast-container');
  tc && (tc.setAttribute('role', 'status'), tc.setAttribute('aria-live', 'polite'));

  /* ---- Fullscreen QR: toggle a class the CSS understands + real fullscreen ---- */
  window.fullscreenQR = function () {
    document.body.classList.toggle('qr-fullscreen');
    var el = document.documentElement;
    try {
      if (document.body.classList.contains('qr-fullscreen')) el.requestFullscreen && el.requestFullscreen();
      else document.fullscreenElement && document.exitFullscreen();
    } catch (e) {}
  };
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement) document.body.classList.remove('qr-fullscreen');
  });

  /* ---- Busy state on async action buttons (prevents double-submit) ---- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('#modal-create-lecture .btn-primary');
    if (!b) return;
    b.classList.add('is-busy');
    setTimeout(function () { b.classList.remove('is-busy'); }, 2500);
  });
})();
