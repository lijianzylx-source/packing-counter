/* ============================================================
 * 通用 UI 层：共享外壳（侧边栏 / 顶栏）与轻量交互
 * 所有页面共用一套导航 → 页面之间可相互跳转
 * ============================================================ */
(function (root) {
  'use strict';

  var CFG = root.APP_CONFIG;

  function el(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function icon(name) {
    return root.Icons ? root.Icons.markup(name) : '';
  }

  /** 当前页面相对 pages/ 的前缀：pages/xxx.html → ''，根路径 → 'pages/' */
  function basePrefix() {
    return /\/pages\//.test(location.pathname) ? '' : 'pages/';
  }

  function routeHref(route) {
    return basePrefix() + route.href;
  }

  /* ---------------- 共享外壳 ---------------- */

  /**
   * 渲染侧边栏与顶栏
   * @param {string} pageId 当前页面 id（对应 APP_CONFIG.routes）
   */
  function mountShell(pageId) {
    var shell = document.getElementById('app-shell') || document.getElementById('shell-anchor');
    if (!shell) return;

    // 图标精灵注入一次（替代原 Material Symbols 图标字体）
    if (root.Icons && root.Icons.mount) root.Icons.mount();

    // 页面标识可能是 'history' 或 'history.html'，统一成路由 id
    var currentId = String(pageId || '').replace(/\.html$/i, '');
    var route = CFG.routes.filter(function (r) { return r.id === currentId; })[0] || CFG.routes[0];

    /* ---- 侧边栏 ---- */
    var nav = el('nav', 'l-nav');
    nav.setAttribute('aria-label', '主导航');
    CFG.routes.forEach(function (r) {
      var item = el('a', 'l-nav__item');
      item.href = routeHref(r);
      if (r.id === currentId) item.setAttribute('aria-current', 'page');
      item.innerHTML =
        '<span class="l-nav__icon">' + icon(r.icon, r.id === currentId) + '</span>' +
        '<span class="l-nav__text">' + r.label + '</span>';
      nav.appendChild(item);
    });

    var brand = el('div', 'l-sidenav__brand');
    brand.innerHTML =
      '<div class="u-flex u-items-center u-gap-sm" style="margin-bottom:4px">' +
        '<span class="l-sidenav__mark">' + icon('inventory_2') + '</span>' +
        '<div><div class="l-sidenav__title">速达跨境计件</div>' +
        '<div class="l-sidenav__sub">每日打包统计</div></div>' +
      '</div>';

    var userBox = el('div', 'l-sidenav__user');
    userBox.type = 'button';
    userBox.innerHTML =
      '<span class="l-sidenav__avatar" id="shell-avatar">—</span>' +
      '<span class="u-grow" style="min-width:0">' +
        '<span class="l-sidenav__username" id="shell-username">未登录</span><br>' +
        '<span class="l-sidenav__userstate" id="shell-userstate">离线使用</span>' +
      '</span>';
    userBox.addEventListener('click', function () { location.href = routeHref(CFG.routes[3]); });

    var status = el('div', 'c-kv');
    status.innerHTML = '<span class="c-kv__k">服务状态</span><span class="c-kv__v" id="shell-server-status">检测中…</span>';

    var foot = el('div', 'l-sidenav__foot');
    foot.appendChild(userBox);
    foot.appendChild(status);

    var sidenav = el('aside', 'l-sidenav');
    var sidenavTop = el('div');
    sidenavTop.appendChild(brand);
    sidenavTop.appendChild(nav);
    sidenav.appendChild(sidenavTop);
    sidenav.appendChild(foot);

    /* ---- 顶栏 ---- */
    var crumb = el('div', 'l-topbar__crumb');
    crumb.innerHTML =
      '<h1 class="l-topbar__title" id="page-title">' + route.label + '</h1>' +
      '<span class="l-topbar__chip"><span class="c-dot c-dot--ok" id="shell-dot"></span>' + route.desc + '</span>';

    var actions = el('div', 'l-topbar__actions');
    actions.innerHTML =
      '<span class="l-rate">单价 <span id="shell-rate">¥1.50</span>/件</span>' +
      '<a class="c-btn c-btn--secondary c-btn--sm" href="' + routeHref(CFG.routes[3]) + '#export">' +
        icon('file_download') + '数据导出</a>';

    var topbar = el('header', 'l-topbar');
    var inner = el('div', 'l-topbar__inner');
    inner.appendChild(crumb);
    inner.appendChild(actions);
    topbar.appendChild(inner);

    // 注入到外壳锚点（display:contents → 顶栏 sticky 的包含块是整页）
    var anchor = document.getElementById('shell-anchor');
    if (anchor) {
      anchor.innerHTML = '';
      anchor.appendChild(sidenav);
      anchor.appendChild(topbar);
    } else {
      shell.appendChild(sidenav);
      shell.appendChild(topbar);
    }
  }

  /** 读取本机保存的头像（无后端时也能显示） */
  function storedAvatar() {
    try {
      return root.Store ? root.Store.createStore().getAvatar() : '';
    } catch (e) {
      return '';
    }
  }

  /** 刷新外壳上的会话/单价/服务器状态显示 */
  function refreshShell(state) {
    var user = (state && state.user) || null;
    var offline = !!(state && state.offline);

    var avatar = document.getElementById('shell-avatar');
    var username = document.getElementById('shell-username');
    var userstate = document.getElementById('shell-userstate');
    if (avatar) {
      var dataUrl = (state && state.avatar) || storedAvatar();
      if (root.Avatar) {
        root.Avatar.render(avatar, dataUrl, root.Avatar.initialOf(user ? user.username : ''));
      } else {
        avatar.textContent = user ? user.username.slice(0, 1).toUpperCase() : '—';
      }
    }
    if (username) username.textContent = user ? user.username : '离线使用';
    if (userstate) userstate.textContent = user ? (offline ? '离线模式' : '已登录') : '未连接账号';
  }

  function setRate(unitPrice) {
    var node = document.getElementById('shell-rate');
    if (node) node.textContent = '¥' + Number(unitPrice).toFixed(2);
  }

  /** 服务器连通状态：绿点=已连接 / 黄点=不可达 */
  function setServerStatus(ok, text) {
    var dot = document.getElementById('shell-dot');
    var label = document.getElementById('shell-server-status');
    if (dot) dot.className = 'c-dot ' + (ok ? 'c-dot--ok' : 'c-dot--warn');
    if (label) label.textContent = text || (ok ? '已连接' : '不可达');
  }

  /* ---------------- 轻量交互 ---------------- */

  var toastTimer = null;
  function toast(message, tone) {
    var node = document.getElementById('toast');
    if (!node) {
      node = el('div', 'c-toast');
      node.id = 'toast';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.dataset.tone = tone || 'info';
    node.dataset.show = 'true';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.dataset.show = 'false'; }, 2600);
  }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = el('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /** 把文本写入指定 id 的节点（安全：走 textContent） */
  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = value;
    return node;
  }

  function setHtml(id, value) {
    var node = document.getElementById(id);
    if (node) node.innerHTML = value;
    return node;
  }

  function on(selector, event, handler, scope) {
    var nodes = (scope || document).querySelectorAll(selector);
    Array.prototype.forEach.call(nodes, function (node) { node.addEventListener(event, handler); });
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, wait || 200);
    };
  }

  root.UI = {
    mountShell: mountShell,
    refreshShell: refreshShell,
    setRate: setRate,
    setServerStatus: setServerStatus,
    toast: toast,
    download: download,
    setText: setText,
    setHtml: setHtml,
    on: on,
    debounce: debounce,
    icon: icon,
    el: el,
    routeHref: routeHref
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
