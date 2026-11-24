/* ============================================================
 * 每日包裹打包统计助手 — 应用层
 * ============================================================ */
(function () {
  'use strict';

  var Core = window.Core;

  /* ---------------- 存储后端（localStorage 不可用时降级为内存） ---------------- */

  var memoryBackend = (function () {
    var map = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
      setItem: function (k, v) { map[k] = String(v); },
      removeItem: function (k) { delete map[k]; }
    };
  })();

  var backend = (function () {
    try {
      var probe = '__pkgstat_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch (e) {
      return memoryBackend;
    }
  })();

  var store = Core.createStore(backend);

  /* ---------------- 账号与会话（v1.0.1） ---------------- */

  var AUTH_KEY = 'pkgstat.auth.v1';
  var SERVER_KEY = 'pkgstat.server.v1';
  var API_BASE = '';
  var auth = { token: null, user: null };

  /** 接口基址：用户设置优先；file:// 下回退到绝对地址 */
  function loadServerAddress() {
    var saved = '';
    try { saved = window.localStorage.getItem(SERVER_KEY) || ''; } catch (e) { saved = ''; }
    API_BASE = Core.resolveApiBase({ saved: saved, protocol: location.protocol });
  }

  function targetLabel() {
    return API_BASE || (location.protocol === 'file:' ? Core.DEFAULT_FILE_API_BASE : location.origin);
  }

  function displayServerAddress() {
    return targetLabel();
  }

  function loadAuth() {
    try {
      var raw = window.localStorage.getItem(AUTH_KEY);
      var saved = raw ? JSON.parse(raw) : null;
      auth = (saved && saved.token) ? saved : { token: null, user: null };
    } catch (e) {
      auth = { token: null, user: null };
    }
  }

  function saveAuth() {
    try { window.localStorage.setItem(AUTH_KEY, JSON.stringify(auth)); } catch (e) { /* 隐私模式忽略 */ }
  }

  function clearAuth() {
    try { window.localStorage.removeItem(AUTH_KEY); } catch (e) { /* ignore */ }
    auth = { token: null, user: null };
  }

  /** 统一的接口调用，返回 { ok, status, data, network }；网络层失败不抛异常 */
  function api(pathname, options) {
    options = options || {};
    var headers = {};
    if (options.body) headers['Content-Type'] = 'application/json';
    if (auth.token) headers['Authorization'] = 'Bearer ' + auth.token;
    return fetch(API_BASE + pathname, {
      method: options.method || (options.body ? 'POST' : 'GET'),
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = {};
        try { data = text ? JSON.parse(text) : {}; } catch (e) { data = {}; }
        return { ok: res.ok, status: res.status, data: data, network: false };
      });
    }).catch(function () {
      return {
        ok: false, status: 0, network: true,
        data: { message: networkErrorMessage() }
      };
    });
  }

  function networkErrorMessage() {
    if (location.protocol === 'file:') {
      return '浏览器拦截了本地文件访问服务器，请点「在服务器上打开页面」';
    }
    return '无法连接服务器 ' + targetLabel() + '，请确认已运行 node server.js';
  }

  /* ---------------- 状态 ---------------- */

  var state = {
    view: 'record',
    histMonth: Core.monthOf(Core.toDateKey(new Date())),
    statsMonth: Core.monthOf(Core.toDateKey(new Date())),
    chartRange: 7,
    chartMetric: 'count',
    tableOpen: false,
    formDate: '',
    editingDate: null,
    authMode: 'login'
  };

  /* ---------------- DOM 工具 ---------------- */

  function $(id) { return document.getElementById(id); }
  function todayKey() { return Core.toDateKey(new Date()); }
  function currentMonth() { return Core.monthOf(todayKey()); }

  var toastTimer = null;
  function toast(message, isError) {
    var el = $('toast');
    el.textContent = message;
    el.classList.toggle('error', !!isError);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  function escapeHTML(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ============================================================
   * 记录页
   * ============================================================ */

  function renderRecord() {
    var settings = store.getSettings();
    var records = store.getRecords();
    var today = todayKey();
    var unitPrice = settings.unitPrice;

    var todayRecord = Core.findRecord(records, today);
    var todayCount = todayRecord ? Number(todayRecord.count) || 0 : 0;
    var todayIncome = Core.round2(todayCount * unitPrice);

    $('header-date').textContent = Core.formatDateCN(today);
    $('header-rate-value').textContent = unitPrice.toFixed(2);

    $('today-income').textContent = Core.formatMoney(todayIncome);
    $('today-sub').textContent = '今日 ' + Core.formatCount(todayCount) + ' 件 · 单价 ¥' + unitPrice.toFixed(2);
    $('stat-today-count').textContent = Core.formatCount(todayCount);

    var stats = Core.computeMonthStats(records, currentMonth(), unitPrice, today);
    $('stat-month-count').textContent = Core.formatCount(stats.totalCount);
    $('stat-month-income').textContent = Core.formatMoney(stats.totalIncome);

    // 侧边栏「今日概览」（PC 端）
    $('side-today-count').textContent = Core.formatCount(todayCount);
    $('side-today-income').textContent = Core.formatMoney(todayIncome);
    $('side-month-count').textContent = Core.formatCount(stats.totalCount);
    $('side-month-income').textContent = Core.formatMoney(stats.totalIncome);

    // 日期固定为当天（只读），记录始终写进今天
    $('date-display-text').textContent = Core.formatDateCN(today);
    var dateInput = $('input-date');
    if (dateInput.value !== today) dateInput.value = today;
    if (dateInput.value !== state.formDate) syncFormWithDate();

    updatePreview();
  }

  function syncFormWithDate() {
    var date = $('input-date').value;
    if (!date) return;
    var record = Core.findRecord(store.getRecords(), date);
    state.formDate = date;

    if (record) {
      $('input-count').value = String(record.count);
      $('input-note').value = record.note || '';
      $('btn-delete').hidden = false;
      $('form-hint').textContent = '今天已有记录，保存将覆盖（最后更新 ' + record.updatedAt.slice(0, 10) + '）。要改往日的记录请到历史页。';
    } else {
      $('input-count').value = '';
      $('input-note').value = '';
      $('btn-delete').hidden = true;
      $('form-hint').textContent = '这里记录的是今天；补录或修改往日记录请到历史页。';
    }
    updatePreview();
  }

  function updatePreview() {
    var unitPrice = store.getSettings().unitPrice;
    var raw = $('input-count').value;
    var count = Core.isValidCount(raw) ? Number(raw) : 0;
    $('preview-income').textContent = Core.formatMoney(count * unitPrice);
  }

  function saveRecord() {
    var date = $('input-date').value || todayKey();
    var raw = $('input-count').value;

    if (!Core.isValidCount(raw)) { toast('件数需为 0 或正整数', true); return; }

    var result = store.upsert(date, Math.floor(Number(raw)), $('input-note').value);
    renderAll();
    toast(result.isNew ? '已保存今天：' + Core.formatCount(result.record.count) + ' 件' : '已更新今天的记录');
  }

  function deleteRecordForDate() {
    var date = $('input-date').value;
    if (!date) return;
    if (!Core.findRecord(store.getRecords(), date)) { toast('该日期没有记录', true); return; }
    if (!window.confirm('确定删除 ' + date + ' 的记录吗？此操作不可撤销。')) return;
    store.remove(date);
    renderAll();
    toast('已删除该日记录');
  }

  /* ============================================================
   * 历史页
   * ============================================================ */

  function renderHistory() {
    var settings = store.getSettings();
    var records = store.getRecords();
    var ym = state.histMonth;

    $('hist-month').textContent = Core.monthLabel(ym);

    var monthRecords = records.filter(function (r) { return Core.monthOf(r.date) === ym; });
    var monthCount = monthRecords.reduce(function (sum, r) { return sum + (Number(r.count) || 0); }, 0);
    $('hist-summary').textContent = monthRecords.length
      ? '本月 ' + Core.formatCount(monthRecords.length) + ' 天有记录 · 合计 ' + Core.formatCount(monthCount) +
        ' 件 · 收入 ' + Core.formatMoney(Core.round2(monthCount * settings.unitPrice))
      : '本月暂无记录';

    var filtered = Core.filterRecords(records, {
      from: $('hist-from').value || null,
      to: $('hist-to').value || null,
      keyword: $('hist-search').value || null
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    var editing = state.editingDate;
    var html = '';
    if (editing) html += editRowHTML(editing, Core.findRecord(records, editing));

    html += filtered.filter(function (r) { return r.date !== editing; }).map(function (r) {
      var income = Core.round2((Number(r.count) || 0) * settings.unitPrice);
      return '<li class="record-item" data-date="' + escapeHTML(r.date) + '">' +
        '<div class="record-date">' + escapeHTML(Core.formatDateCN(r.date)) + '</div>' +
        '<div class="record-count">' + Core.formatCount(r.count) + ' 件</div>' +
        '<div class="record-income">' + Core.formatMoney(income) + '</div>' +
        '<div class="record-note">' + (r.note ? escapeHTML(r.note) : '无备注') + '</div>' +
        '<div class="record-actions">' +
          '<button type="button" class="mini-btn" data-action="edit" title="编辑" aria-label="编辑 ' + escapeHTML(r.date) + '">改</button>' +
          '<button type="button" class="mini-btn danger" data-action="delete" title="删除" aria-label="删除 ' + escapeHTML(r.date) + '">删</button>' +
        '</div>' +
      '</li>';
    }).join('');

    var list = $('hist-list');
    list.innerHTML = html;
    var empty = filtered.length === 0 && !editing;
    $('hist-empty').hidden = !empty;
    list.hidden = empty;
  }

  /** 历史页行内编辑行：补录或修改某一天的件数与备注 */
  function editRowHTML(date, record) {
    var isNew = !record;
    return '<li class="record-item record-edit" data-date="' + escapeHTML(date) + '">' +
      '<div class="record-date">' + escapeHTML(Core.formatDateCN(date)) +
        '<span class="badge">' + (isNew ? '补录' : '编辑中') + '</span></div>' +
      '<div class="record-fields">' +
        '<input type="number" class="control edit-count" data-role="count" inputmode="numeric" min="0" step="1" placeholder="件数"' +
          (record ? ' value="' + (Number(record.count) || 0) + '"' : '') + '>' +
        '<input type="text" class="control edit-note" data-role="note" maxlength="100" placeholder="备注（可选）"' +
          (record && record.note ? ' value="' + escapeHTML(record.note) + '"' : '') + '>' +
      '</div>' +
      '<div class="record-actions">' +
        '<button type="button" class="mini-btn save" data-action="save" title="保存">存</button>' +
        '<button type="button" class="mini-btn" data-action="cancel" title="取消">×</button>' +
      '</div>' +
    '</li>';
  }

  /** 开始行内编辑；补录时日期所在的月份会自动切换过来 */
  function startEdit(date) {
    state.editingDate = date;
    if (Core.monthOf(date) !== state.histMonth) state.histMonth = Core.monthOf(date);
    renderHistory();
  }

  function saveEdit(date) {
    var row = document.querySelector('.record-edit[data-date="' + date + '"]');
    if (!row) return;
    var countRaw = row.querySelector('[data-role="count"]').value;
    var note = row.querySelector('[data-role="note"]').value;

    if (!Core.isValidCount(countRaw)) { toast('件数需为 0 或正整数', true); return; }
    var isNew = !Core.findRecord(store.getRecords(), date);
    store.upsert(date, Math.floor(Number(countRaw)), note);
    state.editingDate = null;
    renderAll();
    toast(isNew ? '已补录 ' + date + '：' + Core.formatCount(countRaw) + ' 件' : '已更新 ' + date + ' 的记录');
  }

  function cancelEdit() {
    state.editingDate = null;
    renderHistory();
  }

  /** 历史页「补录这天」 */
  function backfillDate() {
    var date = $('hist-backfill').value;
    if (!date) { toast('请先选择要补录的日期', true); return; }
    if (date > todayKey()) { toast('不能补录未来日期', true); return; }
    startEdit(date);
    toast('填写件数后点「存」');
  }

  function deleteRecordByDate(date) {
    if (!window.confirm('确定删除 ' + date + ' 的记录吗？此操作不可撤销。')) return;
    store.remove(date);
    renderAll();
    toast('已删除 ' + date + ' 的记录');
  }

  /* ============================================================
   * 统计页
   * ============================================================ */

  function renderStats() {
    var settings = store.getSettings();
    var records = store.getRecords();
    var ym = state.statsMonth;
    var today = todayKey();

    $('stats-month').textContent = Core.monthLabel(ym);

    var s = Core.computeMonthStats(records, ym, settings.unitPrice, today);

    var tiles = [
      { label: '总件数', value: Core.formatCount(s.totalCount), unit: '件' },
      { label: '总收入', value: Core.formatMoney(s.totalIncome), unit: '' },
      { label: '工作天数', value: String(s.recordedDays), unit: '天有记录' },
      { label: '日均件数', value: s.avgCount ? Core.formatCount(s.avgCount) : '0', unit: '件/天' },
      { label: '日均收入', value: Core.formatMoney(s.avgIncome), unit: '' },
      { label: '未记录天数', value: String(s.missingDays), unit: '天' },
      { label: '最高单日', value: Core.formatCount(s.bestCount) + ' 件', unit: s.bestDate ? s.bestDate.slice(5) + ' 达成' : '暂无' },
      { label: '最高单日收入', value: Core.formatMoney(s.bestIncome), unit: s.bestDate ? s.bestDate.slice(5) : '暂无' }
    ];

    $('stats-tiles').innerHTML = tiles.map(function (t) {
      return '<div class="stat-tile">' +
        '<span class="stat-label">' + escapeHTML(t.label) + '</span>' +
        '<span class="stat-value">' + escapeHTML(t.value) + '</span>' +
        '<span class="stat-unit">' + escapeHTML(t.unit) + '</span>' +
      '</div>';
    }).join('');

    renderChart();
  }

  /* ---------------- 图表 ---------------- */

  function currentSeries() {
    var endKey;
    if (state.statsMonth === currentMonth()) {
      endKey = todayKey();
    } else {
      var y = Number(state.statsMonth.split('-')[0]);
      var m = Number(state.statsMonth.split('-')[1]);
      endKey = Core.toDateKey(new Date(y, m, 0));
    }
    return Core.recentSeries(store.getRecords(), endKey, state.chartRange, store.getSettings().unitPrice);
  }

  function niceCeil(v) {
    if (!isFinite(v) || v <= 0) return 1;
    var mag = Math.pow(10, Math.floor(Math.log10(v)));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) {
      var candidate = steps[i] * mag;
      if (candidate >= v) return candidate;
    }
    return 10 * mag;
  }

  function formatAxis(value, metric) {
    if (metric === 'income') {
      if (value >= 10000) return (value / 10000).toFixed(1) + '万';
      if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
      return String(Math.round(value));
    }
    return String(Math.round(value));
  }

  function barPath(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h));
    return 'M' + x + ',' + (y + h) +
      ' L' + x + ',' + (y + r) +
      ' Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
      ' L' + (x + w - r) + ',' + y +
      ' Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) +
      ' L' + (x + w) + ',' + (y + h) + ' Z';
  }

  function renderChart() {
    var wrap = $('chart-wrap');
    var svg = $('chart');
    var tip = $('chart-tip');
    if (!wrap || !svg) return;

    var data = currentSeries();
    var metric = state.chartMetric;
    var unitPrice = store.getSettings().unitPrice;

    var width = Math.max(280, Math.round(wrap.getBoundingClientRect().width || 320));
    var height = width < 380 ? 210 : (width >= 720 ? 300 : 240);
    var padL = 44, padR = 12, padT = 24, padB = 26;
    var plotW = Math.max(40, width - padL - padR);
    var plotH = Math.max(60, height - padT - padB);

    var values = data.map(function (d) { return d[metric]; }).filter(function (v) { return v !== null; });
    var maxValue = values.length ? Math.max.apply(null, values) : 0;
    var axisMax = niceCeil(maxValue || 1);

    // 宽屏上限制绘图区宽度并居中，避免柱子被拉得过散（dataviz：柱宽上限 24px）
    var MAX_PLOT = 900;
    if (plotW > MAX_PLOT) {
      plotW = MAX_PLOT;
      var shift = Math.round((width - padL - padR - plotW) / 2);
      padL += shift;
    }
    var x0 = padL;

    var band = plotW / data.length;
    var barW = Math.max(2, Math.min(24, band - Math.max(2, band * 0.28)));

    var parts = [];
    parts.push('<svg id="chart" viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height + '" ' +
      'role="img" aria-labelledby="chart-title" xmlns="http://www.w3.org/2000/svg">');

    // 单位说明
    parts.push('<text x="0" y="12" fill="var(--text-muted)" font-size="11" font-family="system-ui, sans-serif">' +
      (metric === 'income' ? '收入（元）' : '打包件数（件）') + '</text>');

    // 网格线 + Y 轴刻度（细实线，克制）
    [0, 0.5, 1].forEach(function (ratio) {
      var y = padT + plotH - ratio * plotH;
      parts.push('<line x1="' + x0 + '" y1="' + y.toFixed(1) + '" x2="' + (x0 + plotW) + '" y2="' + y.toFixed(1) +
        '" stroke="' + (ratio === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)') + '" stroke-width="1" shape-rendering="crispEdges"/>');
      parts.push('<text x="' + (x0 - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" fill="var(--text-muted)" font-size="11" ' +
        'style="font-variant-numeric: tabular-nums" font-family="system-ui, sans-serif">' + formatAxis(axisMax * ratio, metric) + '</text>');
    });

    // 柱体
    var maxIndex = -1;
    var maxBarValue = -1;
    data.forEach(function (d, i) {
      var v = d[metric];
      if (v === null) return;
      if (v > maxBarValue) { maxBarValue = v; maxIndex = i; }
      if (v <= 0) return;
      var h = (v / axisMax) * plotH;
      var x = x0 + i * band + (band - barW) / 2;
      var y = padT + plotH - h;
      parts.push('<path d="' + barPath(x, y, barW, h, 4) + '" fill="var(--chart-1)"/>');
    });

    // X 轴标签
    var labelStep = data.length <= 8 ? 1 : Math.ceil(data.length / 7);
    data.forEach(function (d, i) {
      if (i % labelStep !== 0 && i !== data.length - 1) return;
      var x = x0 + i * band + band / 2;
      parts.push('<text x="' + x.toFixed(1) + '" y="' + (padT + plotH + 16) + '" text-anchor="middle" fill="var(--text-muted)" ' +
        'font-size="11" style="font-variant-numeric: tabular-nums" font-family="system-ui, sans-serif">' + Core.shortDate(d.date) + '</text>');
    });

    // 直接标注：只标极值（最大值），必要时补标末点
    var labelled = {};
    function labelBar(i, v) {
      if (labelled[i]) return;
      labelled[i] = true;
      var h = (v / axisMax) * plotH;
      var x = x0 + i * band + band / 2;
      var y = padT + plotH - h - 6;
      parts.push('<text x="' + x.toFixed(1) + '" y="' + Math.max(padT - 2, y).toFixed(1) + '" text-anchor="middle" ' +
        'fill="var(--text-body)" font-size="11" font-weight="600" style="font-variant-numeric: tabular-nums" font-family="system-ui, sans-serif">' +
        (metric === 'income' ? Core.formatMoney(v) : Core.formatCount(v)) + '</text>');
    }
    if (maxIndex >= 0 && maxBarValue > 0) labelBar(maxIndex, maxBarValue);
    if (data.length <= 8) {
      var last = data.length - 1;
      if (data[last][metric] !== null && data[last][metric] > 0 && last !== maxIndex) labelBar(last, data[last][metric]);
    }

    // 交互热区（覆盖整个band，便于悬停/触摸）
    data.forEach(function (d, i) {
      var x = x0 + i * band;
      parts.push('<rect x="' + x.toFixed(1) + '" y="' + padT + '" width="' + band.toFixed(1) + '" height="' + plotH +
        '" fill="transparent" data-i="' + i + '" class="hit"></rect>');
    });

    parts.push('</svg>');
    svg.outerHTML = parts.join('');

    // 重新绑定（outerHTML 会替换节点）
    var newSvg = $('chart');
    var hits = newSvg.querySelectorAll('.hit');
    Array.prototype.forEach.call(hits, function (rect) {
      var i = Number(rect.getAttribute('data-i'));
      var d = data[i];
      function showTip() {
        var countText = d.count === null ? '未记录' : Core.formatCount(d.count) + ' 件';
        var incomeText = d.count === null ? '—' : Core.formatMoney(d.income);
        tip.innerHTML = '<div class="tip-date">' + Core.formatDateCN(d.date) + '</div>' +
          '<div class="tip-row"><span>件数</span><span>' + countText + '</span></div>' +
          '<div class="tip-row"><span>收入</span><span>' + incomeText + '</span></div>' +
          (d.note ? '<div class="tip-row tip-empty"><span>备注</span><span>' + escapeHTML(d.note) + '</span></div>' : '');
        tip.hidden = false;
        var tw = tip.offsetWidth;
        var bandX = x0 + i * band;
        var left = bandX + band / 2 - tw / 2;
        left = Math.max(0, Math.min(left, width - tw));
        tip.style.left = left + 'px';
        tip.style.top = '4px';
      }
      function hideTip() { tip.hidden = true; }
      rect.addEventListener('mouseenter', showTip);
      rect.addEventListener('mouseleave', hideTip);
      rect.addEventListener('pointerdown', showTip);
    });

    // 表格视图（每个图表都有等价的表格）
    $('chart-table-body').innerHTML = data.slice().reverse().map(function (d) {
      return '<tr><td>' + d.date + '</td>' +
        '<td class="num">' + (d.count === null ? '—' : Core.formatCount(d.count)) + '</td>' +
        '<td class="num">' + (d.income === null ? '—' : Core.formatMoney(d.income)) + '</td></tr>';
    }).join('');

    $('chart-title').textContent = '近 ' + state.chartRange + ' 天' + (metric === 'income' ? '收入' : '打包件数');
    $('chart-note').textContent = '单价 ¥' + unitPrice.toFixed(2) + '/件';
  }

  /* ============================================================
   * 设置页
   * ============================================================ */

  function renderSettings() {
    var s = store.getSettings();
    if (document.activeElement !== $('input-price')) $('input-price').value = s.unitPrice.toFixed(2);
    $('input-reminder-enabled').checked = !!s.reminderEnabled;
    $('input-reminder-time').value = s.reminderTime || '21:00';
    $('input-reminder-text').value = s.reminderText || '';
  }

  function saveUnitPrice() {
    var raw = $('input-price').value;
    if (!Core.isValidUnitPrice(raw)) { toast('单价需在 0.01 – 100 元之间', true); return; }
    var price = store.setUnitPrice(raw);
    if (price === null) { toast('单价设置失败', true); return; }
    renderAll();
    toast('单价已更新为 ¥' + price.toFixed(2) + '，历史收入已重算');
  }

  function saveReminder() {
    var enabled = $('input-reminder-enabled').checked;
    var time = $('input-reminder-time').value || '21:00';
    var text = $('input-reminder-text').value.trim() || '今天还没记录打包数量，别忘了哦～';

    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(function (perm) {
        if (perm === 'granted') {
          store.saveSettings({ reminderEnabled: true, reminderTime: time, reminderText: text });
          renderAll();
          toast('提醒已开启');
        } else {
          store.saveSettings({ reminderEnabled: false, reminderTime: time, reminderText: text });
          renderAll();
          toast('未授予通知权限，提醒仅在页面内提示', true);
        }
      });
      return;
    }

    store.saveSettings({ reminderEnabled: enabled, reminderTime: time, reminderText: text });
    renderAll();
    toast(enabled ? '提醒已开启' : '提醒已关闭');
  }

  function exportCSV(ym) {
    var records = store.getRecords();
    var rows = ym ? records.filter(function (r) { return Core.monthOf(r.date) === ym; }) : records;
    if (!rows.length) { toast('没有可导出的数据', true); return; }
    var name = ym ? '打包统计-' + ym + '.csv' : '打包统计-全部.csv';
    download(name, Core.toCSV(rows, store.getSettings().unitPrice), 'text/csv');
    toast('已导出 ' + rows.length + ' 条记录');
  }

  function exportBackup() {
    download('打包统计备份-' + todayKey() + '.json', store.exportBackup(), 'application/json');
    toast('备份已下载');
  }

  function restoreBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var count = store.importBackup(String(reader.result));
        renderAll();
        toast('已恢复 ' + count + ' 条记录');
      } catch (e) {
        toast('备份文件解析失败', true);
      }
    };
    reader.readAsText(file);
  }

  function loadDemoData() {
    if (!window.confirm('载入示例数据会覆盖当前全部记录，确定继续吗？')) return;
    var unitPrice = store.getSettings().unitPrice;
    var records = [];
    var today = new Date();
    for (var i = 29; i >= 0; i--) {
      var d = new Date(today);
      d.setDate(d.getDate() - i);
      if (i % 9 === 3) continue;                       // 制造若干未记录日期
      var base = 95 + ((i * 37) % 70);
      var count = i % 11 === 5 ? 0 : base;             // 制造一条零产出记录
      var key = Core.toDateKey(d);
      records = Core.upsertRecord(records, { date: key, count: count, note: i % 7 === 0 ? '加班' : '' }, unitPrice).records;
    }
    store.saveRecords(records);
    renderAll();
    toast('已载入 27 条示例记录');
  }

  function clearAll() {
    if (!window.confirm('确定清空全部记录与设置吗？此操作不可撤销。')) return;
    if (!window.confirm('再次确认：所有历史数据将被删除，请先做好备份。')) return;
    store.clearAll();
    renderAll();
    toast('已清空全部数据');
  }

  /* ============================================================
   * 登录 / 注册 / 退出
   * ============================================================ */

  function setAuthMode(mode) {
    state.authMode = mode === 'register' ? 'register' : 'login';
    var isRegister = state.authMode === 'register';

    Array.prototype.forEach.call($('auth-tabs').querySelectorAll('button'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-mode') === state.authMode);
    });
    $('field-password2').hidden = !isRegister;
    $('auth-submit').textContent = isRegister ? '注册并登录' : '登录';
    $('auth-password').setAttribute('autocomplete', isRegister ? 'new-password' : 'current-password');
    $('auth-subtitle').textContent = isRegister
      ? '注册一个账号，开始记录每日打包数量'
      : '登录后开始记录每日打包数量';
    hideAuthError();
  }

  function showAuthError(message) {
    var el = $('auth-error');
    el.textContent = message;
    el.hidden = false;
  }

  function hideAuthError() {
    $('auth-error').hidden = true;
  }

  /** 探测服务器是否可达 */
  function checkServer() {
    var foot = $('auth-server');
    var offlineBtn = $('btn-offline');
    var openBtn = $('btn-open-server');
    var target = targetLabel();
    var isFile = location.protocol === 'file:';

    foot.classList.remove('offline');
    foot.innerHTML = '<span class="dot"></span>正在连接 ' + escapeHTML(target) + ' …';
    offlineBtn.hidden = true;
    openBtn.hidden = true;

    return api('api/me').then(function (r) {
      if (r.network) {
        foot.classList.add('offline');
        if (isFile) {
          foot.innerHTML = '<span class="dot"></span>浏览器拦截了本地文件访问服务器';
          openBtn.hidden = false;
          offlineBtn.hidden = false;
        } else {
          foot.innerHTML = '<span class="dot"></span>无法连接 ' + escapeHTML(target) + '，可先离线使用';
          offlineBtn.hidden = false;
        }
        return false;
      }
      foot.classList.remove('offline');
      foot.innerHTML = '<span class="dot"></span>已连接 ' + escapeHTML(target);
      return true;
    });
  }

  /** 从本地文件跳到服务器上的同一页面（顶层跳转不受浏览器本地网络策略限制） */
  function openOnServer() {
    var base = (API_BASE || (location.protocol === 'file:' ? Core.DEFAULT_FILE_API_BASE : location.origin)).replace(/\/+$/, '');
    location.href = base + '/index.html';
  }

  /** 应用登录页填写的服务器地址 */
  function applyServerAddress() {
    var el = $('auth-server-url');
    var v = String(el.value || '').trim();
    if (v) v = v.replace(/\/+$/, '');
    if (v && location.protocol !== 'file:' && v === location.origin) v = '';   // 填的就是当前来源 → 同源
    try { window.localStorage.setItem(SERVER_KEY, v); } catch (e) { /* ignore */ }
    API_BASE = Core.resolveApiBase({ saved: v, protocol: location.protocol });
    el.value = displayServerAddress();
    checkServer();
  }

  function submitAuth(event) {
    event.preventDefault();
    var username = $('auth-username').value.trim();
    var password = $('auth-password').value;
    var password2 = $('auth-password2').value;
    var isRegister = state.authMode === 'register';

    if (!username) { showAuthError('请输入用户名'); return; }
    if (!password) { showAuthError('请输入密码'); return; }
    if (isRegister && password !== password2) { showAuthError('两次输入的密码不一致'); return; }

    var btn = $('auth-submit');
    var originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = isRegister ? '注册中…' : '登录中…';
    hideAuthError();

    api(isRegister ? 'api/register' : 'api/login', { body: { username: username, password: password } })
      .then(function (r) {
        if (!r.ok) {
          showAuthError(r.data.message || (isRegister ? '注册失败' : '登录失败'));
          return;
        }
        auth.token = r.data.token;
        auth.user = r.data.user;
        saveAuth();
        $('auth-password').value = '';
        $('auth-password2').value = '';
        enterApp(false);
        toast(isRegister ? '注册成功，欢迎 ' + auth.user.username : '欢迎回来，' + auth.user.username);
      })
      .catch(function () {
        showAuthError(networkErrorMessage());
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = originalText;
      });
  }

  function updateAccountCard(offline) {
    var nameEl = $('account-name');
    var statusEl = $('account-status');
    var avatarEl = $('account-avatar');
    var logoutBtn = $('btn-logout');

    if (auth.user) {
      nameEl.textContent = auth.user.username;
      avatarEl.textContent = auth.user.username.slice(0, 1).toUpperCase();
      statusEl.textContent = offline ? '已登录 · 离线模式（未向服务器校验）' : '已登录 · 账号已验证';
      logoutBtn.hidden = false;
    } else {
      nameEl.textContent = '离线使用中';
      avatarEl.textContent = '—';
      statusEl.textContent = '未连接账号，数据仅保存在本机';
      logoutBtn.hidden = true;
    }

    // 侧边栏账号条（PC 端）
    $('sidebar-username').textContent = auth.user ? auth.user.username : '离线使用';
    $('sidebar-avatar').textContent = auth.user ? auth.user.username.slice(0, 1).toUpperCase() : '—';
    $('sidebar-userstatus').textContent = auth.user ? (offline ? '离线模式' : '已登录') : '未连接账号';
  }

  function logout() {
    if (!window.confirm('确定退出登录吗？本机的记录会保留，重新登录同一个账号即可继续使用。')) return;
    var token = auth.token;
    clearAuth();
    state.view = 'record';
    enterAuth('已退出登录');
    if (token) api('api/logout', { method: 'POST' }).catch(function () { /* 忽略 */ });
  }

  function enterApp(offline) {
    document.body.classList.remove('auth-mode');
    $('view-auth').hidden = true;
    $('offline-banner').hidden = !offline;
    renderAll();
    switchView(state.view === 'auth' ? 'record' : state.view);
    updateAccountCard(offline);
  }

  function enterAuth(message) {
    document.body.classList.add('auth-mode');
    ['record', 'history', 'stats', 'settings'].forEach(function (v) { $('view-' + v).hidden = true; });
    $('view-auth').hidden = false;
    $('offline-banner').hidden = true;
    setAuthMode(state.authMode);
    updateAccountCard(false);
    $('auth-server-url').value = displayServerAddress();
    checkServer();
    if (message) showAuthError(message);
  }

  /* ============================================================
   * 视图切换与提醒
   * ============================================================ */

  var VIEW_TITLES = { record: '记录', history: '历史记录', stats: '统计', settings: '设置' };

  function switchView(view) {
    state.view = view;
    ['record', 'history', 'stats', 'settings'].forEach(function (v) {
      $('view-' + v).hidden = v !== view;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (tab) {
      var active = tab.getAttribute('data-view') === view;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $('page-title').textContent = VIEW_TITLES[view] || '记录';
    document.title = (VIEW_TITLES[view] ? VIEW_TITLES[view] + ' · ' : '') + '每日包裹打包统计助手';
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (view === 'stats') renderChart();
    if (view === 'settings') renderSettings();
    if (view === 'history') renderHistory();
  }

  function checkReminder() {
    var s = store.getSettings();
    if (!s.reminderEnabled) return;
    var today = todayKey();
    if (s.lastNotifiedDate === today) return;
    if (Core.findRecord(store.getRecords(), today)) return;

    var parts = String(s.reminderTime || '21:00').split(':');
    var target = new Date();
    target.setHours(Number(parts[0]) || 0, Number(parts[1]) || 0, 0, 0);
    if (new Date() < target) return;

    store.saveSettings({ lastNotifiedDate: today });
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('包裹打包统计', { body: s.reminderText });
        return;
      } catch (e) { /* 继续用页内提示 */ }
    }
    toast(s.reminderText);
  }

  /* ============================================================
   * 渲染与事件
   * ============================================================ */

  function renderAll() {
    renderRecord();
    renderHistory();
    renderStats();
    renderSettings();
  }

  function bindEvents() {
    // 登录 / 注册
    $('auth-tabs').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-mode]');
      if (!btn) return;
      setAuthMode(btn.getAttribute('data-mode'));
    });
    $('auth-form').addEventListener('submit', submitAuth);
    $('btn-offline').addEventListener('click', function () {
      hideAuthError();
      enterApp(true);
      toast('离线模式：本机数据照常使用，但账号未校验');
    });
    $('btn-test-server').addEventListener('click', applyServerAddress);
    $('btn-open-server').addEventListener('click', openOnServer);
    $('sidebar-user').addEventListener('click', function () { switchView('settings'); });
    $('auth-server-url').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); applyServerAddress(); }
    });
    $('btn-logout').addEventListener('click', logout);

    // 导航
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (tab) {
      tab.addEventListener('click', function () { switchView(tab.getAttribute('data-view')); });
    });

    // 记录（日期固定为当天，无选择控件）
    $('input-count').addEventListener('input', updatePreview);
    $('btn-save').addEventListener('click', saveRecord);
    $('btn-delete').addEventListener('click', deleteRecordForDate);

    Array.prototype.forEach.call(document.querySelectorAll('[data-step]'), function (btn) {
      btn.addEventListener('click', function () {
        var step = Number(btn.getAttribute('data-step'));
        var current = Core.isValidCount($('input-count').value) ? Number($('input-count').value) : 0;
        var next = Math.max(0, Math.min(Core.MAX_COUNT, current + step));
        $('input-count').value = String(next);
        updatePreview();
      });
    });

    // 历史
    $('hist-prev').addEventListener('click', function () { shiftMonth('histMonth', -1); });
    $('hist-next').addEventListener('click', function () { shiftMonth('histMonth', 1); });
    $('hist-search').addEventListener('input', renderHistory);
    $('hist-from').addEventListener('change', renderHistory);
    $('hist-to').addEventListener('change', renderHistory);
    $('hist-reset').addEventListener('click', function () {
      $('hist-search').value = '';
      $('hist-from').value = '';
      $('hist-to').value = '';
      renderHistory();
    });

    $('hist-list').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var date = btn.closest('.record-item').getAttribute('data-date');
      var action = btn.getAttribute('data-action');
      if (action === 'edit') startEdit(date);
      else if (action === 'save') saveEdit(date);
      else if (action === 'cancel') cancelEdit();
      else deleteRecordByDate(date);
    });
    $('btn-backfill').addEventListener('click', backfillDate);

    // 统计
    $('stats-prev').addEventListener('click', function () { shiftMonth('statsMonth', -1); });
    $('stats-next').addEventListener('click', function () { shiftMonth('statsMonth', 1); });

    $('chart-range').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-range]');
      if (!btn) return;
      state.chartRange = Number(btn.getAttribute('data-range'));
      markActive(this, btn);
      renderChart();
    });

    $('chart-metric').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-metric]');
      if (!btn) return;
      state.chartMetric = btn.getAttribute('data-metric');
      markActive(this, btn);
      renderChart();
    });

    $('btn-table').addEventListener('click', function () {
      state.tableOpen = !state.tableOpen;
      $('chart-table-wrap').hidden = !state.tableOpen;
      this.setAttribute('aria-expanded', state.tableOpen ? 'true' : 'false');
      this.textContent = state.tableOpen ? '隐藏表格' : '表格视图';
    });

    // 设置
    $('btn-save-price').addEventListener('click', saveUnitPrice);
    $('btn-save-reminder').addEventListener('click', saveReminder);
    $('btn-export-month').addEventListener('click', function () { exportCSV(currentMonth()); });
    $('btn-export-all').addEventListener('click', function () { exportCSV(null); });
    $('btn-backup').addEventListener('click', exportBackup);
    $('btn-restore').addEventListener('click', function () { $('file-restore').click(); });
    $('file-restore').addEventListener('change', function () {
      if (this.files && this.files[0]) restoreBackup(this.files[0]);
      this.value = '';
    });
    $('btn-demo').addEventListener('click', loadDemoData);
    $('btn-clear').addEventListener('click', clearAll);

    // 响应式重绘
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { if (state.view === 'stats') renderChart(); }, 150);
    });

    // 键盘快捷键（PC 端）：N 聚焦件数、Ctrl+Enter 保存、1~4 切换视图
    document.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && state.view === 'record') {
        e.preventDefault();
        saveRecord();
        return;
      }
      if (typing) return;

      if (e.key === 'n' || e.key === 'N') {
        if (state.view !== 'record') switchView('record');   // 否则会聚焦到隐藏视图里的输入框
        $('input-count').focus();
        $('input-count').select();
        return;
      }
      var order = { '1': 'record', '2': 'history', '3': 'stats', '4': 'settings' };
      if (order[e.key]) switchView(order[e.key]);
    });
  }

  function markActive(group, activeBtn) {
    Array.prototype.forEach.call(group.querySelectorAll('button'), function (b) {
      b.classList.toggle('active', b === activeBtn);
    });
  }

  function shiftMonth(key, delta) {
    var ym = state[key];
    var y = Number(ym.split('-')[0]);
    var m = Number(ym.split('-')[1]) + delta;
    var d = new Date(y, m - 1, 1);
    state[key] = Core.toDateKey(d).slice(0, 7);
    if (key === 'histMonth') { state.editingDate = null; renderHistory(); } else renderStats();
  }

  /* ============================================================
   * 启动
   * ============================================================ */

  function init() {
    if (!store.isPersistent()) {
      setTimeout(function () { toast('当前浏览器无法保存本地数据，关闭页面后记录会丢失', true); }, 600);
    }
    loadServerAddress();
    loadAuth();
    bindEvents();

    // 支持 #history / #stats / #settings 直接进入对应页面
    var hash = String(location.hash || '').replace('#', '');
    if (['record', 'history', 'stats', 'settings'].indexOf(hash) >= 0) state.view = hash;

    if (auth.token) {
      api('api/me').then(function (r) {
        if (r.ok && r.data.user) {
          auth.user = r.data.user;
          saveAuth();
          enterApp(false);
        } else if (r.status === 401) {
          clearAuth();
          enterAuth('登录已失效，请重新登录');
        } else {
          enterApp(true);   // 服务器异常：本地数据照常可用
        }
      }).catch(function () {
        enterApp(true);     // 服务器连不上：离线模式
      });
    } else {
      enterAuth();
    }

    checkReminder();
    setInterval(checkReminder, 60000);

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 离线能力可选 */ });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
