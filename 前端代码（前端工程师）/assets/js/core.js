/* ============================================================
 * 业务纯逻辑（零 DOM 依赖，可在 Node 中单测）
 * 对应 PRD：001.产品PRD/跨境包裹打包统计-PRD-v1.0.1.md
 *   §5.1~5.5 记录类规则 · §5.12 首页日期恒为当天
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Core = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var WEEKDAYS = '日一二三四五六';

  /* ---------------- 日期 ---------------- */

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function toDateKey(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function fromDateKey(key) {
    var p = String(key).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function todayKey() { return toDateKey(new Date()); }

  function monthOf(dateKey) { return String(dateKey).slice(0, 7); }

  function currentMonth() { return monthOf(todayKey()); }

  function monthLabel(ym) {
    var p = String(ym).split('-');
    return Number(p[0]) + ' 年 ' + Number(p[1]) + ' 月';
  }

  function daysInMonth(ym) {
    var p = String(ym).split('-');
    return new Date(Number(p[0]), Number(p[1]), 0).getDate();
  }

  function shiftDate(dateKey, days) {
    var d = fromDateKey(dateKey);
    d.setDate(d.getDate() + days);
    return toDateKey(d);
  }

  function shiftMonth(ym, delta) {
    var p = String(ym).split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1 + delta, 1);
    return toDateKey(d).slice(0, 7);
  }

  function weekdayCN(dateKey) { return WEEKDAYS[fromDateKey(dateKey).getDay()]; }

  function formatDateCN(dateKey) {
    var d = fromDateKey(dateKey);
    return (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 星期' + weekdayCN(dateKey);
  }

  function shortDate(dateKey) {
    var p = String(dateKey).split('-');
    return Number(p[1]) + '/' + Number(p[2]);
  }

  function isFutureDate(dateKey) { return dateKey > todayKey(); }

  /* ---------------- 格式化 ---------------- */

  function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

  function groupInt(intStr) { return String(intStr).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function formatMoney(n) {
    var v = round2(Number(n) || 0);
    var neg = v < 0;
    var parts = Math.abs(v).toFixed(2).split('.');
    return (neg ? '-¥' : '¥') + groupInt(parts[0]) + '.' + parts[1];
  }

  function formatCount(n) {
    var v = Math.max(0, Math.round(Number(n) || 0));
    return groupInt(String(v));
  }

  /* ---------------- 校验 ---------------- */

  function isValidCount(n) {
    if (n === '' || n === null || n === undefined) return false;
    var v = Number(n);
    return isFinite(v) && Math.floor(v) === v && v >= 0 && v <= 999999;
  }

  function isValidUnitPrice(n) {
    var v = Number(n);
    return isFinite(v) && v >= 0.01 && v <= 100;
  }

  function isValidUsername(name) {
    var u = String(name == null ? '' : name).trim();
    if (u.length < 2 || u.length > 20) return false;
    return /^[A-Za-z0-9_一-龥-]+$/.test(u);
  }

  function isValidPassword(pw) {
    var p = String(pw == null ? '' : pw);
    return p.length >= 6 && p.length <= 72;
  }

  function clampNote(note) { return String(note == null ? '' : note).slice(0, 100); }

  /* ---------------- 接口基址解析 ---------------- */

  /**
   * 解析账号接口的基址（PRD F-019）
   *
   * 优先级：
   *   1. 用户在登录页手动设置的地址（saved）
   *   2. 页面与接口同端口 → 同源，用相对路径（''）
   *   3. 其余情况 → **当前主机名 + 接口端口**
   *
   * 第 3 条是手机能用的关键：手机上打开 http://192.168.x.x:5174 时，
   * 若写死 http://localhost:5173，请求会打到「手机自己」而永远连不上；
   * 按当前主机名推导才能打到运行服务的那台电脑。
   */
  function resolveApiBase(options) {
    options = options || {};
    var saved = String(options.saved == null ? '' : options.saved).trim();
    var apiPort = options.apiPort || 5173;
    var protocol = options.protocol || 'http:';
    var hostname = options.hostname || 'localhost';
    var pagePort = options.port == null ? '' : String(options.port);

    // 自愈：页面上跑在局域网地址上时，之前保存的 localhost/127.0.0.1 是无效的
    //（在手机上它指的是手机自己），直接忽略并按当前主机名推导。
    var onLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
    var savedIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(saved);

    if (saved && !(savedIsLocal && !onLocalHost)) {
      return saved.replace(/\/+$/, '');
    }

    if (protocol === 'file:') {
      return options.defaultApiBase || ('http://localhost:' + apiPort);
    }
    if (pagePort === String(apiPort)) return '';   // 同源
    return protocol + '//' + hostname + ':' + apiPort;
  }

  /* ---------------- 记录操作（纯函数） ---------------- */

  function incomeOf(record, unitPrice) {
    return round2((Number(record.count) || 0) * unitPrice);
  }

  function sortByDateDesc(records) {
    return records.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  }

  function findRecord(records, date) {
    for (var i = 0; i < records.length; i++) { if (records[i].date === date) return records[i]; }
    return null;
  }

  /**
   * 同一天只保留一条记录：已存在则覆盖（保留 createdAt，更新 updatedAt）。
   * PRD §5.3 记录唯一性 · 首页保存与历史补录共用此逻辑。
   */
  function upsertRecord(records, input, unitPrice) {
    var date = input.date;
    var count = Math.floor(Number(input.count));
    var note = clampNote(input.note);
    var now = new Date().toISOString();
    var list = records.slice();
    var idx = -1;
    for (var i = 0; i < list.length; i++) { if (list[i].date === date) { idx = i; break; } }

    var record;
    if (idx >= 0) {
      record = list[idx];
      record.count = count;
      record.note = note;
      record.unitPrice = unitPrice;
      record.income = round2(count * unitPrice);
      record.updatedAt = now;
    } else {
      record = {
        id: 'r_' + date + '_' + Math.random().toString(36).slice(2, 8),
        date: date,
        count: count,
        unitPrice: unitPrice,
        income: round2(count * unitPrice),
        note: note,
        createdAt: now,
        updatedAt: now
      };
      list.push(record);
    }
    return { records: sortByDateDesc(list), record: record, isNew: idx < 0 };
  }

  function removeRecord(records, date) {
    return records.filter(function (r) { return r.date !== date; });
  }

  /** 修改单价后重算所有历史收入（PRD §5.5） */
  function repriceRecords(records, unitPrice) {
    return records.map(function (r) {
      var copy = Object.assign({}, r);
      copy.unitPrice = unitPrice;
      copy.income = round2((Number(r.count) || 0) * unitPrice);
      return copy;
    });
  }

  /* ---------------- 统计（PRD §5.4 统计口径） ---------------- */

  function computeMonthStats(records, ym, unitPrice, today) {
    var inMonth = records.filter(function (r) { return monthOf(r.date) === ym; });
    var totalCount = 0;
    inMonth.forEach(function (r) { totalCount += Number(r.count) || 0; });
    totalCount = Math.round(totalCount);

    var totalIncome = round2(totalCount * unitPrice);
    var recordedDays = inMonth.length;
    var zeroDays = inMonth.filter(function (r) { return (Number(r.count) || 0) === 0; }).length;

    var current = monthOf(today);
    var daysElapsed;
    if (ym === current) daysElapsed = Number(String(today).slice(8));
    else if (ym < current) daysElapsed = daysInMonth(ym);
    else daysElapsed = 0;

    var missingDays = Math.max(0, daysElapsed - recordedDays);
    var avgCount = recordedDays ? round2(totalCount / recordedDays) : 0;
    var avgIncome = recordedDays ? round2(totalIncome / recordedDays) : 0;

    var best = null;
    inMonth.forEach(function (r) {
      if (!best || (Number(r.count) || 0) > (Number(best.count) || 0)) best = r;
    });

    return {
      ym: ym,
      totalCount: totalCount,
      totalIncome: totalIncome,
      recordedDays: recordedDays,     // 工作天数（有记录的天数）
      zeroDays: zeroDays,             // 记录为 0 的天数
      missingDays: missingDays,       // 未记录天数
      daysElapsed: daysElapsed,
      avgCount: avgCount,
      avgIncome: avgIncome,
      bestDate: best ? best.date : '',
      bestCount: best ? Number(best.count) || 0 : 0,
      bestIncome: best ? round2((Number(best.count) || 0) * unitPrice) : 0
    };
  }

  /** 最近 N 天序列（截止 endKey），未记录的日期 count 为 null（不画柱） */
  function recentSeries(records, endKey, days, unitPrice) {
    var out = [];
    for (var i = days - 1; i >= 0; i--) {
      var date = shiftDate(endKey, -i);
      var rec = findRecord(records, date);
      out.push({
        date: date,
        recorded: !!rec,
        count: rec ? Number(rec.count) || 0 : null,
        income: rec ? round2((Number(rec.count) || 0) * unitPrice) : null,
        note: rec ? rec.note : ''
      });
    }
    return out;
  }

  function filterRecords(records, opts) {
    opts = opts || {};
    return records.filter(function (r) {
      if (opts.ym && monthOf(r.date) !== opts.ym) return false;
      if (opts.from && r.date < opts.from) return false;
      if (opts.to && r.date > opts.to) return false;
      if (opts.keyword) {
        var kw = String(opts.keyword).trim().toLowerCase();
        if (!kw) return true;
        if ((r.date + ' ' + (r.note || '')).toLowerCase().indexOf(kw) === -1) return false;
      }
      return true;
    });
  }

  /* ---------------- 导出（PRD F-011） ---------------- */

  function csvCell(value) {
    var s = String(value == null ? '' : value);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /** 带 BOM，Excel 打开中文不乱码 */
  function toCSV(records, unitPrice) {
    var rows = [['日期', '件数', '单价(元)', '收入(元)', '备注']];
    records.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (r) {
      rows.push([
        r.date,
        Number(r.count) || 0,
        Number(unitPrice).toFixed(2),
        round2((Number(r.count) || 0) * unitPrice).toFixed(2),
        r.note || ''
      ]);
    });
    return '﻿' + rows.map(function (row) {
      return row.map(csvCell).join(',');
    }).join('\r\n');
  }

  return {
    toDateKey: toDateKey,
    fromDateKey: fromDateKey,
    todayKey: todayKey,
    monthOf: monthOf,
    currentMonth: currentMonth,
    monthLabel: monthLabel,
    daysInMonth: daysInMonth,
    shiftDate: shiftDate,
    shiftMonth: shiftMonth,
    weekdayCN: weekdayCN,
    formatDateCN: formatDateCN,
    shortDate: shortDate,
    isFutureDate: isFutureDate,
    round2: round2,
    formatMoney: formatMoney,
    formatCount: formatCount,
    isValidCount: isValidCount,
    isValidUnitPrice: isValidUnitPrice,
    isValidUsername: isValidUsername,
    isValidPassword: isValidPassword,
    clampNote: clampNote,
    resolveApiBase: resolveApiBase,
    incomeOf: incomeOf,
    sortByDateDesc: sortByDateDesc,
    findRecord: findRecord,
    upsertRecord: upsertRecord,
    removeRecord: removeRecord,
    repriceRecords: repriceRecords,
    computeMonthStats: computeMonthStats,
    recentSeries: recentSeries,
    filterRecords: filterRecords,
    toCSV: toCSV
  };
});
