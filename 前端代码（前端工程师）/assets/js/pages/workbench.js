/* ============================================================
 * 今日录入页逻辑（PRD F-001 ~ F-006）
 * ============================================================ */
(function () {
  'use strict';

  var Core = window.Core;
  var UI = window.UI;
  var store = window.Store.createStore();
  var api = window.Api.createApi({ store: store });
  var auth = window.Auth.createAuth({
    store: store,
    api: api,
    loginPage: 'login.html',
    onStateChange: function (state) { UI.refreshShell(state); }
  });

  var page = 'workbench.html';

  function $id(id) { return document.getElementById(id); }

  /* ---------------- 数据读取 ---------------- */

  function settings() { return store.getSettings(); }
  function records() { return store.getRecords(); }
  function unitPrice() { return settings().unitPrice; }
  function today() { return Core.todayKey(); }

  function todayRecord() { return Core.findRecord(records(), today()); }

  /* ---------------- 渲染 ---------------- */

  function renderMetrics() {
    var price = unitPrice();
    var rec = todayRecord();
    var todayCount = rec ? Number(rec.count) || 0 : 0;
    var stats = Core.computeMonthStats(records(), Core.currentMonth(), price, today());

    UI.setText('today-date', Core.formatDateCN(today()));
    UI.setText('today-status', rec ? '已记录 ' + Core.formatCount(todayCount) + ' 件' : '待录入');

    UI.setText('metric-today-count', Core.formatCount(todayCount));
    UI.setText('metric-today-income', Core.formatMoney(todayCount * price));
    UI.setText('metric-month-count', Core.formatCount(stats.totalCount));
    UI.setText('metric-month-income', Core.formatMoney(stats.totalIncome));
    UI.setText('metric-workdays', String(stats.recordedDays));
    UI.setText('metric-missing', '未记录 ' + stats.missingDays + ' 天');
    UI.setText('metric-avg', Core.formatCount(stats.avgCount));
    UI.setText('metric-avg-income', Core.formatMoney(stats.avgIncome));

    UI.setRate(price);
    UI.setText('unit-price-text', '¥' + price.toFixed(2));
    UI.setText('formula-price', price.toFixed(2));
  }

  function renderRecent() {
    var list = $id('recent-list');
    if (!list) return;
    var price = unitPrice();
    var last3 = Core.recentSeries(records(), today(), 3, price);
    var todayKeyStr = today();

    list.innerHTML = last3.map(function (d) {
      if (!d.recorded) {
        return '<div class="u-flex u-items-center u-justify-between" style="padding:10px 0;border-bottom:1px solid var(--c-border-subtle)">' +
          '<span class="u-flex u-items-center u-gap-sm u-sm u-muted">' +
            '<span class="c-dot"></span>' + d.date.slice(5) + ' 未记录</span>' +
          '<span class="u-sm u-muted">—</span></div>';
      }
      var isToday = d.date === todayKeyStr;
      var label = Core.shortDate(d.date) + (isToday ? '（今日）' : '');
      return '<div style="padding:10px 0;border-bottom:1px solid var(--c-border-subtle)" data-date="' + d.date + '">' +
        '<div class="u-flex u-items-center u-justify-between u-gap-sm">' +
          '<span class="u-flex u-items-center u-gap-sm">' +
            '<span class="c-dot ' + (isToday ? 'c-dot--ok' : '') + '"></span>' +
            '<span class="mono u-strong u-sm">' + label + '</span>' +
          '</span>' +
          '<span class="u-flex u-items-center u-gap-sm">' +
            '<span class="mono u-strong u-sm">' + Core.formatCount(d.count) + ' 件</span>' +
            '<span class="mono u-sm u-strong" style="color:var(--c-income-deep)">' + Core.formatMoney(d.income) + '</span>' +
            '<button type="button" class="c-row-btn" data-action="edit">改</button>' +
          '</span>' +
        '</div>' +
        (d.note ? '<p class="u-xs u-muted" style="margin:4px 0 0 16px">' + escapeHTML(d.note) + '</p>' : '') +
        '<div class="c-row-edit" hidden style="margin-top:8px;padding:10px;background:var(--c-surface-elevated);border:1px solid var(--c-border-subtle);border-radius:var(--radius-md);display:flex;align-items:center;gap:8px">' +
          '<span class="u-sm u-muted">件数</span>' +
          '<input type="number" class="c-input c-input--sm mono" style="width:100px" min="0" step="1" value="' + d.count + '">' +
          '<button type="button" class="c-row-btn c-row-btn--primary" data-action="save">存</button>' +
          '<button type="button" class="c-row-btn" data-action="cancel">×</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function escapeHTML(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------------- 录入交互 ---------------- */

  function currentCount() {
    var raw = $id('count-input').value;
    return Core.isValidCount(raw) ? Number(raw) : 0;
  }

  function updatePreview() {
    var count = currentCount();
    UI.setText('formula-count', Core.formatCount(count));
    UI.setText('total-amount', Core.formatMoney(count * unitPrice()));
  }

  function fillFormFromRecord(record) {
    $id('count-input').value = record ? String(record.count) : '';
    $id('note-input').value = record ? (record.note || '') : '';
    updatePreview();
  }

  function saveRecord() {
    var count = currentCount();
    var raw = $id('count-input').value;
    if (!Core.isValidCount(raw)) { UI.toast('件数需为 0 或正整数', 'error'); return; }

    var date = today();
    var note = Core.clampNote($id('note-input').value);
    var result = store.upsertRecord(date, count, note);
    renderAll();
    UI.toast(result.isNew
      ? '已保存今日：' + Core.formatCount(count) + ' 件 · ' + Core.formatMoney(count * unitPrice())
      : '已更新今日记录：' + Core.formatCount(count) + ' 件', 'ok');
  }

  function adjustCount(delta) {
    var next = Math.max(0, Math.min(window.APP_CONFIG.maxCount, currentCount() + delta));
    $id('count-input').value = String(next);
    updatePreview();
  }

  /* ---------------- 事件 ---------------- */

  function bindEvents() {
    $id('count-input').addEventListener('input', updatePreview);

    UI.on('.c-step[data-step]', 'click', function () { adjustCount(Number(this.getAttribute('data-step'))); });
    $id('btn-clear-count').addEventListener('click', function () {
      $id('count-input').value = '0';
      updatePreview();
      $id('count-input').focus();
    });
    $id('btn-save').addEventListener('click', saveRecord);

    // 最近记录：行内编辑（改 / 存 / 取消），零弹窗
    $id('recent-list').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var row = btn.closest('[data-date]');
      var date = row.getAttribute('data-date');
      var action = btn.getAttribute('data-action');
      var editor = row.querySelector('.c-row-edit');

      if (action === 'edit') { editor.hidden = false; editor.querySelector('input').focus(); return; }
      if (action === 'cancel') { editor.hidden = true; return; }
      if (action === 'save') {
        var value = editor.querySelector('input').value;
        if (!Core.isValidCount(value)) { UI.toast('件数需为 0 或正整数', 'error'); return; }
        store.upsertRecord(date, Number(value), Core.findRecord(records(), date).note || '');
        renderAll();
        UI.toast('已更新 ' + date + ' 的记录', 'ok');
      }
    });

    // 快捷键
    document.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveRecord(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveRecord(); return; }
      if (!typing && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        $id('count-input').focus();
        $id('count-input').select();
      }
    });
  }

  /* ---------------- 初始化 ---------------- */

  function renderAll() {
    renderMetrics();
    renderRecent();
  }

  function init() {
    UI.mountShell(page);
    bindEvents();

    var rec = todayRecord();
    fillFormFromRecord(rec);
    renderAll();

    auth.requireAuth(page).then(function (user) {
      UI.refreshShell({ user: user, offline: auth.isOffline() });
      if (auth.isOffline()) {
        UI.toast('离线模式：未向服务器校验账号，本机数据照常使用');
      }
    });

    api.ping().then(function (res) {
      // 顶栏的状态点（服务端状态由 ui.js 统一渲染）
      UI.setServerStatus(!res.network, res.network ? '不可达' : '已连接');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
