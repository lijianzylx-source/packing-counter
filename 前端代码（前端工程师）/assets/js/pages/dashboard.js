/* ============================================================
 * 统计看板页逻辑（PRD F-006 ~ F-008、F-011）
 * 图表遵循 dataviz 规范：单序列不放图例、只标注极值、未记录不画柱。
 * ============================================================ */
(function () {
  'use strict';

  var Core = window.Core;
  var UI = window.UI;
  var Chart = window.Chart;
  var store = window.Store.createStore();
  var api = window.Api.createApi({ store: store });
  var auth = window.Auth.createAuth({
    store: store, api: api, loginPage: 'login.html',
    onStateChange: function (state) { UI.refreshShell(state); }
  });

  var page = 'dashboard.html';
  var state = { range: 7, metric: 'count', tableOpen: false };

  function $id(id) { return document.getElementById(id); }
  function unitPrice() { return store.getSettings().unitPrice; }
  function records() { return store.getRecords(); }
  function currentMonth() { return Core.currentMonth(); }

  function escapeHTML(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------------- KPI ---------------- */

  function renderKpi() {
    var price = unitPrice();
    var stats = Core.computeMonthStats(records(), currentMonth(), price, Core.todayKey());

    UI.setText('kpi-month-count', Core.formatCount(stats.totalCount));
    UI.setText('kpi-month-income', Core.formatMoney(stats.totalIncome));
    UI.setText('kpi-rate', '¥' + price.toFixed(2));
    UI.setText('kpi-month-label', Core.monthLabel(currentMonth()) + ' · 出勤 ' + stats.recordedDays + ' 天');
    UI.setText('kpi-workdays', String(stats.recordedDays));
    UI.setText('kpi-missing', String(stats.missingDays));
    UI.setText('kpi-workdays-note', stats.zeroDays > 0 ? ('其中 ' + stats.zeroDays + ' 天记录为 0 件') : '无零产出记录');
    UI.setText('kpi-avg', Core.formatCount(stats.avgCount));
    UI.setText('kpi-avg-income', Core.formatMoney(stats.avgIncome));
    UI.setText('dash-rate', '¥' + price.toFixed(2));
    UI.setRate(price);

    // 最高单日
    UI.setText('best-date', stats.bestDate || '—');
    UI.setText('best-count', Core.formatCount(stats.bestCount));
    UI.setText('best-income', Core.formatMoney(stats.bestIncome));

    // 效能明细
    var rows = [
      { label: '最高单日件数', value: Core.formatCount(stats.bestCount) + ' 件', ratio: stats.recordedDays ? Math.min(100, stats.bestCount / (stats.avgCount || 1) * 50) : 0 },
      { label: '日均件数', value: Core.formatCount(stats.avgCount) + ' 件', ratio: Math.min(100, stats.avgCount / 300 * 100) },
      { label: '出勤覆盖率', value: stats.daysElapsed ? Math.round(stats.recordedDays / stats.daysElapsed * 100) + '%' : '—', ratio: stats.daysElapsed ? stats.recordedDays / stats.daysElapsed * 100 : 0 },
      { label: '未记录天数', value: stats.missingDays + ' 天', ratio: stats.daysElapsed ? stats.missingDays / stats.daysElapsed * 100 : 0, tone: 'muted' }
    ];
    $id('eff-list').innerHTML = rows.map(function (row) {
      return '<div>' +
        '<div class="u-flex u-items-center u-justify-between u-sm">' +
          '<span class="u-muted">' + row.label + '</span>' +
          '<span class="mono u-strong">' + row.value + '</span>' +
        '</div>' +
        '<div style="height:8px;margin-top:6px;border-radius:9999px;background:var(--c-surface-elevated);overflow:hidden">' +
          '<div style="height:100%;width:' + Math.max(0, Math.min(100, row.ratio)).toFixed(1) + '%;border-radius:9999px;background:' +
            (row.tone === 'muted' ? 'var(--c-border-strong)' : 'var(--c-primary)') + '"></div>' +
        '</div>' +
      '</div>';
    }).join('');

    var badge = $id('eff-badge');
    if (badge) {
      var rate = stats.daysElapsed ? stats.recordedDays / stats.daysElapsed : 0;
      badge.textContent = rate >= 0.9 ? '出勤优良' : rate >= 0.6 ? '出勤正常' : '出勤偏低';
      badge.className = 'c-badge ' + (rate >= 0.9 ? 'c-badge--success' : rate >= 0.6 ? 'c-badge--primary' : 'c-badge--warning');
    }
  }

  /* ---------------- 图表 ---------------- */

  function seriesEnd() {
    var ym = currentMonth();
    if (ym === Core.monthOf(Core.todayKey())) return Core.todayKey();
    var p = ym.split('-');
    return Core.toDateKey(new Date(Number(p[0]), Number(p[1]), 0));
  }

  function renderChart() {
    var price = unitPrice();
    var series = Core.recentSeries(records(), seriesEnd(), state.range, price);
    var isIncome = state.metric === 'income';

    var data = series.map(function (d) {
      return {
        date: d.date,
        label: Core.shortDate(d.date),
        fullLabel: Core.formatDateCN(d.date),
        value: isIncome ? d.income : d.count,
        note: d.note
      };
    });

    Chart.bars($id('chart-wrap'), {
      data: data,
      height: 280,
      unitLabel: isIncome ? '每日收入（元）' : '每日打包件数（件）',
      ariaLabel: isIncome ? '每日收入柱状图' : '每日打包件数柱状图',
      format: isIncome ? function (v) { return Core.formatMoney(v); } : function (v) { return Core.formatCount(v); }
    });

    UI.setText('chart-heading', isIncome ? '每日计件收入走势' : '每日打包件数走势');
    UI.setText('chart-month-badge', Core.monthLabel(currentMonth()));
    var recorded = data.filter(function (d) { return d.value !== null; }).length;
    UI.setText('chart-note', '区间 ' + state.range + ' 天 · 有记录 ' + recorded + ' 天 · 未记录 ' + (state.range - recorded) + ' 天');

    // 表格视图（颜色之外的等价读数通道）
    $id('chart-table-body').innerHTML = data.slice().reverse().map(function (d) {
      return '<tr>' +
        '<td class="mono">' + d.date + '</td>' +
        '<td class="num">' + (d.value === null ? '—' : (isIncome ? '—' : Core.formatCount(d.value))) + '</td>' +
        '<td class="num">' + (d.income === null ? '—' : Core.formatMoney(d.income)) + '</td>' +
        '<td class="u-muted">' + (d.note ? escapeHTML(d.note) : '—') + '</td>' +
      '</tr>';
    }).join('');
  }

  /* ---------------- 对账明细 ---------------- */

  function renderSettlement() {
    var price = unitPrice();
    var stats = Core.computeMonthStats(records(), currentMonth(), price, Core.todayKey());

    $id('settle-body').innerHTML =
      '<tr>' +
        '<td class="u-strong">标准件计件结算</td>' +
        '<td class="num">' + Core.formatCount(stats.totalCount) + ' 件</td>' +
        '<td class="num u-muted">¥' + price.toFixed(2) + ' /件</td>' +
        '<td class="num u-strong" style="color:var(--c-income-deep)">' + Core.formatMoney(stats.totalIncome) + '</td>' +
        '<td class="u-sm u-muted mono">本机 localStorage</td>' +
        '<td style="text-align:right"><span class="c-badge c-badge--success">系统已封存</span></td>' +
      '</tr>' +
      '<tr style="background:var(--c-surface-container)">' +
        '<td class="u-strong" style="color:var(--c-primary)">应发计件合计（税前预估）</td>' +
        '<td class="num u-strong" style="color:var(--c-primary)">' + Core.formatCount(stats.totalCount) + ' 件</td>' +
        '<td class="num u-muted">-</td>' +
        '<td class="num mono" style="font-size:22px;font-weight:700;color:var(--c-income-deep)">' + Core.formatMoney(stats.totalIncome) + '</td>' +
        '<td colspan="2" class="u-sm u-muted">数据仅存本机浏览器，结算以实际发放为准</td>' +
      '</tr>';
  }

  function renderAll() {
    renderKpi();
    renderChart();
    renderSettlement();
  }

  /* ---------------- 事件 ---------------- */

  function bindEvents() {
    $id('chart-range').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-range]');
      if (!btn) return;
      state.range = Number(btn.getAttribute('data-range'));
      markActive(this, btn);
      renderChart();
    });

    $id('chart-metric').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-metric]');
      if (!btn) return;
      state.metric = btn.getAttribute('data-metric');
      markActive(this, btn);
      renderChart();
    });

    $id('btn-table').addEventListener('click', function () {
      state.tableOpen = !state.tableOpen;
      $id('chart-table-wrap').hidden = !state.tableOpen;
      this.setAttribute('aria-expanded', state.tableOpen ? 'true' : 'false');
      this.textContent = state.tableOpen ? '隐藏表格' : '表格视图';
    });

    $id('btn-export').addEventListener('click', function () {
      var price = unitPrice();
      var rows = records().filter(function (r) { return Core.monthOf(r.date) === currentMonth(); });
      if (!rows.length) { UI.toast('本月还没有记录', 'error'); return; }
      UI.download('打包统计-' + currentMonth() + '.csv', Core.toCSV(rows, price), 'text/csv');
      UI.toast('已导出本月 ' + rows.length + ' 条记录', 'ok');
    });

    window.addEventListener('resize', UI.debounce(function () {
      if (state.metric) renderChart();
    }, 200));
  }

  function markActive(group, activeBtn) {
    Array.prototype.forEach.call(group.querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', b === activeBtn ? 'true' : 'false');
    });
  }

  /* ---------------- 初始化 ---------------- */

  function init() {
    UI.mountShell(page);
    bindEvents();
    renderAll();

    var updated = records().map(function (r) { return r.updatedAt; }).sort().pop();
    UI.setText('dash-updated', updated ? '最近更新 ' + updated.slice(0, 16).replace('T', ' ') : '尚无记录');

    auth.requireAuth(page).then(function (user) {
      UI.refreshShell({ user: user, offline: auth.isOffline() });
      UI.setText('dash-connection', user ? ('账号 ' + user.username) : '离线使用');
      UI.setText('dash-status-badge', auth.isOffline() ? '离线模式' : '已核算');
    });

    api.ping().then(function (res) {
      UI.setServerStatus(!res.network, res.network ? '服务器不可达' : '已连接');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
