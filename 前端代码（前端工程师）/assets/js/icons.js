/* ============================================================
 * 图标精灵（内联 SVG，零外部依赖）
 * 原稿用 Material Symbols 图标字体（依赖 Google Fonts，离线即失效），
 * 这里改为一次性注入的 SVG symbol，页面用 <use href="#i-xxx"> 引用。
 * ============================================================ */
(function (root) {
  'use strict';

  var PATHS = {
    analytics: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    assignment_turned_in: '<path d="M9 3h6v3H9zM8 5H6v16h12V5h-2"/><path d="m9 13 2 2 4-4"/>',
    badge: '<path d="M7 4h10v6l-2 3v6l-3-2-3 2v-6L7 10z"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/>',
    calendar_month: '<path d="M3 5h18v16H3zM3 10h18M8 3v4M16 3v4"/><path d="M8 14h.01M12 14h.01M16 14h.01"/>',
    calendar_today: '<path d="M3 5h18v16H3zM3 10h18M8 3v4M16 3v4"/>',
    campaign: '<path d="M4 10v4h3l7 4V6l-7 4H4z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
    cloud_done: '<path d="M7 18h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.4 2A3.8 3.8 0 0 0 7 18z"/><path d="m9 13 2 2 4-4"/>',
    cloud_off: '<path d="M7 18h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.4 2A3.8 3.8 0 0 0 7 18z"/><path d="m3 3 18 18"/>',
    error: '<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/><path d="M12 8v5M12 16h.01"/>',
    event: '<path d="M3 5h18v16H3zM3 10h18M8 3v4M16 3v4"/>',
    event_available: '<path d="M3 5h18v16H3zM3 10h18M8 3v4M16 3v4"/><path d="m9 15 2 2 4-4"/>',
    expand_more: '<path d="m6 9 6 6 6-6"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4"/><path d="M12 7v5l3 2"/>',
    how_to_reg: '<path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 20a6 6 0 0 1 12 0"/><path d="m16 14 2 2 4-4"/>',
    info: '<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/><path d="M12 11v5M12 8h.01"/>',
    inventory: '<path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"/>',
    inventory_2: '<path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"/>',
    keyboard: '<path d="M3 6h18v12H3z"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>',
    local_shipping: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><path d="M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>',
    login: '<path d="M10 4H5v16h5M14 12h7M18 9l3 3-3 3"/>',
    package_2: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9"/>',
    payments: '<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/><path d="m9 7 3 4 3-4M12 11v6M9.5 13h5M9.5 15h5"/>',
    person_add: '<path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 20a6 6 0 0 1 12 0"/><path d="M17 12v6M14 15h6"/>',
    post_add: '<path d="M4 7h16v13H4zM4 7l8-4 8 4"/><path d="M9 15h6M12 12v6"/>',
    receipt_long: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
    search: '<path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z"/><path d="m16 16 5 5"/>',
    settings: '<path d="M4 6h8M16 6h4M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="14" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    settings_ethernet: '<path d="M3 5h18v11H3zM8 20h8M12 16v4"/><path d="M7 9h10"/>',
    speed: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="m12 18 4-5"/>',
    sync: '<path d="M20 11a8 8 0 0 0-14-4L4 9M4 5v4h4"/><path d="M4 13a8 8 0 0 0 14 4l2-2M20 19v-4h-4"/>',
    terminal: '<path d="m5 7 4 5-4 5M12 17h7"/>',
    trending_up: '<path d="m3 17 6-6 4 4 7-7"/><path d="M14 8h6v6"/>',
    verified: '<path d="m12 3 7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="m9 12 2 2 4-4"/>',
    verified_user: '<path d="m12 3 7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM10 17a2 2 0 0 1 4 0"/>',
    visibility: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>',
    visibility_off: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="m3 3 18 18"/>',
    workspace_premium: '<path d="M8 3h8l-2 5h-4z"/><path d="M12 12a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/>'
  };

  function sprite() {
    var symbols = Object.keys(PATHS).map(function (name) {
      return '<symbol id="i-' + name + '" viewBox="0 0 24 24">' + PATHS[name] + '</symbol>';
    }).join('');
    return '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">' + symbols + '</svg>';
  }

  function markup(name) {
    return '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  /** 注入精灵（只注入一次） */
  function mount() {
    if (document.getElementById('icon-sprite')) return;
    var holder = document.createElement('div');
    holder.id = 'icon-sprite';
    holder.innerHTML = sprite();
    document.body.insertBefore(holder, document.body.firstChild);
  }

  root.Icons = { sprite: sprite, markup: markup, mount: mount, names: Object.keys(PATHS) };

  // 自动注入精灵（所有页面共用，无需逐页调用）
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})(typeof globalThis !== 'undefined' ? globalThis : this);
