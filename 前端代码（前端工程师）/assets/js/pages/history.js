/* ============================================================
 * 历史明细页逻辑（PRD F-003 / F-008 / F-010）
 *   补录与修改都在本页完成；首页只记当天。
 * ============================================================ */
(function () {
  'use strict';

  var Core = window.Core;
  var UI = window.UI;
  var store = window.Store.createStore();
  var api = window.Api.createApi({ store: store });
  var auth = window.Auth.createAuth({
    store: store, api: api, loginPage: 'login.html',
    onStateChange: function (state) { UI.refreshShell(state); }
  });

  var page = 'history.html';
  var state = {
    month: Core.currentMonth(),
    keyword: '',
    from: '',
    to: '',
    editingDate: null
  };

  function $id(id) { return document.getElementById(id); }

  function unitPrice() { return store.getSettings().unitPrice; }
  function records() { return store.getRecords(); }

  function escapeHTML(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------------- 渲染 ---------------- */

  function visibleRecords() {
    return Core.filterRecords(records(), {
      ym: state.month,
      from: state.from || null,
      to: state.to || null,
      keyword: state.keyword || null
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }

  function renderKpi() {
    var price = unitPrice();
    var stats = Core.computeMonthStats(records(), state.month, price, Core.todayKey());

    UI.setText('kpi-month', Core.monthLabel(state.month));
    UI.setText('kpi-days', '自然日 ' + Core.daysInMonth(state.month) + ' 天');
    UI.setText('kpi-workdays', String(stats.recordedDays));
    UI.setText('kpi-missing', '未记录 ' + stats.missingDays + ' 天');
    UI.setText('kpi-count', Core.formatCount(stats.totalCount));
    UI.setText('kpi-income', Core.formatMoney(stats.totalIncome));
    UI.setText('kpi-avg', Core.formatCount(stats.avgCount));
    UI.setText('kpi-avg-income', '日均 ' + Core.formatMoney(stats.avgIncome));

    var list = visibleRecords();
    UI.setText('kpi-range', list.length ? '当前筛选 ' + list.length + ' 条' : '当前筛选无记录');
    UI.setText('hist-month', Core.monthLabel(state.month));
  }

  function renderLedger() {
    var price = unitPrice();
    var list = visibleRecords();
    var body = $id('ledger-body');

    UI.setText('ledger-title', Core.monthLabel(state.month) + ' 打包流水账本');
    UI.setText('ledger-count', '共 ' + list.length + ' 条');

    body.innerHTML = list.map(function (r) {
      var isToday = r.date === Core.todayKey();
      var editing = state.editingDate === r.date;
      var actions = editing
        ? '<button type="button" class="c-row-btn c-row-btn--primary" data-action="save">存</button>' +
          '<button type="button" class="c-row-btn" data-action="cancel">×</button>'
        : '<button type="button" class="c-row-btn" data-action="edit">改</button>' +
          '<button type="button" class="c-row-btn c-row-btn--danger" data-action="delete">删</button>';

      return '<tr data-date="' + escapeHTML(r.date) + '"' + (editing ? ' data-editing="true"' : '') + '>' +
        '<td><span class="mono u-strong">' + escapeHTML(r.date) + '</span> ' +
          '<span class="u-sm u-muted">（周' + Core.weekdayCN(r.date) + '）</span>' +
          (isToday ? ' <span class="c-badge c-badge--success">今日</span>' : '') + '</td>' +
        (editing
          ? '<td class="num"><input type="number" class="c-input c-input--sm mono" style="width:96px" min="0" step="1" value="' + r.count + '"></td>'
          : '<td class="num u-strong">' + Core.formatCount(r.count) + ' <span class="u-sm u-muted">件</span></td>') +
        '<td class="num u-muted">¥' + price.toFixed(2) + '</td>' +
        '<td class="num u-strong" style="color:var(--c-income-deep)">' + Core.formatMoney(r.income) + '</td>' +
        (editing
          ? '<td><input type="text" class="c-input c-input--sm" maxlength="100" value="' + escapeHTML(r.note || '') + '" placeholder="备注（可选）"></td>'
          : '<td class="u-muted">' + (r.note ? escapeHTML(r.note) : '—') + '</td>') +
        '<td style="text-align:center"><span class="c-row-actions">' + actions + '</span></td>' +
      '</tr>';
    }).join('');

    $id('ledger-empty').hidden = list.length > 0;
  }

  function renderBackfill() {
    var price = unitPrice();
    UI.setText('bf-price', '¥' + price.toFixed(2));
    var count = Core.isValidCount($id('bf-count').value) ? Number($id('bf-count').value) : 0;
    UI.setText('bf-income', Core.formatMoney(count * price));

    var dateInput = $id('bf-date');
    if (!dateInput.value) dateInput.value = Core.todayKey();
    dateInput.max = Core.todayKey();
  }

  function renderAll() {
    renderKpi();
    renderLedger();
    renderBackfill();
    UI.setRate(unitPrice());
  }

  /* ---------------- 操作 ---------------- */

  function submitBackfill(event) {
    event.preventDefault();
    var date = $id('bf-date').value;
    var raw = $id('bf-count').value;
    var note = Core.clampNote($id('bf-note').value);

    if (!date) { UI.toast('请选择补录日期', 'error'); return; }
    if (Core.isFutureDate(date)) { UI.toast('不能补录未来日期', 'error'); return; }
    if (!Core.isValidCount(raw)) { UI.toast('件数需为 0 或正整数', 'error'); return; }

    var result = store.upsertRecord(date, Number(raw), note);
    state.month = Core.monthOf(date);
    $id('bf-count').value = '';
    $id('bf-note').value = '';
    renderAll();
    UI.toast(result.isNew
      ? '已补录 ' + date + '：' + Core.formatCount(raw) + ' 件'
      : '已覆盖 ' + date + ' 的记录', 'ok');
  }

  function onLedgerClick(event) {
    var btn = event.target.closest('[data-action]');
    if (!btn) return;
    var row = btn.closest('tr[data-date]');
    var date = row.getAttribute('data-date');
    var action = btn.getAttribute('data-action');
    var record = Core.findRecord(records(), date);

    if (action === 'edit') { state.editingDate = date; renderLedger(); return; }
    if (action === 'cancel') { state.editingDate = null; renderLedger(); return; }
    if (action === 'delete') {
      if (!window.confirm('确定删除 ' + date + ' 的记录吗？此操作不可撤销。')) return;
      store.removeRecord(date);
      state.editingDate = null;
      renderAll();
      UI.toast('已删除 ' + date + ' 的记录', 'ok');
      return;
    }
    if (action === 'save') {
      var countInput = row.querySelector('input[type="number"]');
      var noteInput = row.querySelector('input[type="text"]');
      if (!Core.isValidCount(countInput.value)) { UI.toast('件数需为 0 或正整数', 'error'); return; }
      store.upsertRecord(date, Number(countInput.value), Core.clampNote(noteInput.value));
      state.editingDate = null;
      renderAll();
      UI.toast('已更新 ' + date + ' 的记录', 'ok');
    }
  }

  /* ---------------- 事件 ---------------- */

  function bindEvents() {
    $id('hist-prev').addEventListener('click', function () { state.month = Core.shiftMonth(state.month, -1); state.editingDate = null; renderAll(); });
    $id('hist-next').addEventListener('click', function () { state.month = Core.shiftMonth(state.month, 1); state.editingDate = null; renderAll(); });
    $id('hist-this-month').addEventListener('click', function () { state.month = Core.currentMonth(); state.editingDate = null; renderAll(); });

    $id('hist-search').addEventListener('input', UI.debounce(function () {
      state.keyword = $id('hist-search').value;
      renderLedger();
      renderKpi();
    }, 180));

    $id('hist-from').addEventListener('change', function () { state.from = $id('hist-from').value; renderAll(); });
    $id('hist-to').addEventListener('change', function () { state.to = $id('hist-to').value; renderAll(); });
    $id('hist-reset').addEventListener('click', function () {
      state.keyword = ''; state.from = ''; state.to = ''; state.editingDate = null;
      $id('hist-search').value = ''; $id('hist-from').value = ''; $id('hist-to').value = '';
      renderAll();
    });

    $id('backfill-form').addEventListener('submit', submitBackfill);
    $id('bf-count').addEventListener('input', renderBackfill);
    UI.on('[data-bf-step]', 'click', function () {
      var step = Number(this.getAttribute('data-bf-step'));
      var current = Core.isValidCount($id('bf-count').value) ? Number($id('bf-count').value) : 0;
      $id('bf-count').value = String(Math.max(0, current + step));
      renderBackfill();
    });

    $id('ledger-body').addEventListener('click', onLedgerClick);
  }

  /* ---------------- 初始化 ---------------- */

  function init() {
    UI.mountShell(page);
    bindEvents();
    renderAll();

    auth.requireAuth(page).then(function (user) {
      UI.refreshShell({ user: user, offline: auth.isOffline() });
      UI.setText('bf-operator', user ? user.username : '离线使用');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
