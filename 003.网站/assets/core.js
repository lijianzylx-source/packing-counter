/* ============================================================
 * 每日包裹打包统计助手 — 核心数据层
 * 纯逻辑，无 DOM 依赖，可在浏览器与 Node 中运行（便于测试）
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Core = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STORAGE_PREFIX = 'pkgstat.';
  var KEYS = { records: 'records.v1', settings: 'settings.v1' };

  var DEFAULT_SETTINGS = {
    unitPrice: 1.5,                                  // 单件收入（元）
    reminderEnabled: false,                          // 是否开启每日提醒
    reminderTime: '21:00',                           // 提醒时间
    reminderText: '今天还没记录打包数量，别忘了哦～',   // 提醒文案
    lastNotifiedDate: ''                             // 上次提醒的日期，避免重复
  };

  var MAX_COUNT = 999999;
  var MAX_NOTE = 100;

  /* ---------------- 日期与格式化 ---------------- */

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function toDateKey(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function fromDateKey(key) {
    var p = String(key).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function monthOf(dateKey) { return String(dateKey).slice(0, 7); }

  function monthLabel(ym) {
    var p = ym.split('-');
    return Number(p[0]) + ' 年 ' + Number(p[1]) + ' 月';
  }

  function daysInMonth(ym) {
    var p = ym.split('-');
    return new Date(Number(p[0]), Number(p[1]), 0).getDate();
  }

  function shiftDate(dateKey, days) {
    var d = fromDateKey(dateKey);
    d.setDate(d.getDate() + days);
    return toDateKey(d);
  }

  function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

  function groupInt(intStr) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

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

  function weekdayCN(dateKey) { return '日一二三四五六'[fromDateKey(dateKey).getDay()]; }

  function formatDateCN(dateKey) {
    var d = fromDateKey(dateKey);
    return (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 星期' + weekdayCN(dateKey);
  }

  function shortDate(dateKey) {
    var p = String(dateKey).split('-');
    return Number(p[1]) + '/' + Number(p[2]);
  }

  /* ---------------- 校验 ---------------- */

  function isValidCount(n) {
    if (n === '' || n === null || n === undefined) return false;
    var v = Number(n);
    return isFinite(v) && Math.floor(v) === v && v >= 0 && v <= MAX_COUNT;
  }

  function isValidUnitPrice(n) {
    var v = Number(n);
    return isFinite(v) && v >= 0.01 && v <= 100;
  }

  function clampNote(note) { return String(note == null ? '' : note).slice(0, MAX_NOTE); }

  /* ---------------- 接口地址解析 ---------------- */

  var DEFAULT_FILE_API_BASE = 'http://localhost:5173';

  /**
   * 解析接口基址：
   *  - 用户在登录页手动填写的地址优先（去掉结尾斜杠）
   *  - 页面以 file:// 直接打开时回退到绝对地址（相对路径在 file:// 下会被浏览器拦截）
   *  - 其余情况返回空串 = 与页面同源
   */
  function resolveApiBase(options) {
    options = options || {};
    var saved = String(options.saved == null ? '' : options.saved).trim();
    if (saved) return saved.replace(/\/+$/, '');
    if (options.protocol === 'file:') {
      return options.defaultBase || DEFAULT_FILE_API_BASE;
    }
    return '';
  }

  /* ---------------- 记录操作（纯函数） ---------------- */

  function incomeOf(record, unitPrice) { return round2((Number(record.count) || 0) * unitPrice); }

  function sortRecords(records) {
    return records.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  }

  /**
   * 同一天只保留一条记录：已存在则覆盖（保留 createdAt，更新 updatedAt）
   * @returns {{records: Array, record: Object, isNew: boolean}}
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
        id: 'r_' + date + '_' + Date.now().toString(36),
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
    return { records: sortRecords(list), record: record, isNew: idx < 0 };
  }

  function removeRecord(records, date) {
    return records.filter(function (r) { return r.date !== date; });
  }

  function findRecord(records, date) {
    for (var i = 0; i < records.length; i++) { if (records[i].date === date) return records[i]; }
    return null;
  }

  /** 单价变更后，重算所有历史记录的单价与收入（业务规则 5） */
  function repriceRecords(records, unitPrice) {
    return records.map(function (r) {
      var copy = Object.assign({}, r);
      copy.unitPrice = unitPrice;
      copy.income = round2((Number(r.count) || 0) * unitPrice);
      return copy;
    });
  }

  /* ---------------- 统计 ---------------- */

  /**
   * 月度统计（业务规则 4）
   * - 未记录的日期不计入工作天数，但计入未记录天数
   */
  function computeMonthStats(records, ym, unitPrice, todayKey) {
    var inMonth = records.filter(function (r) { return monthOf(r.date) === ym; });
    var totalCount = 0;
    for (var i = 0; i < inMonth.length; i++) totalCount += Number(inMonth[i].count) || 0;
    totalCount = Math.round(totalCount);

    var totalIncome = round2(totalCount * unitPrice);
    var recordedDays = inMonth.length;
    var zeroDays = inMonth.filter(function (r) { return (Number(r.count) || 0) === 0; }).length;

    var currentMonth = monthOf(todayKey);
    var daysElapsed;
    if (ym === currentMonth) daysElapsed = Number(String(todayKey).slice(8));
    else if (ym < currentMonth) daysElapsed = daysInMonth(ym);
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
      recordedDays: recordedDays,      // 工作天数（有记录的天数）
      zeroDays: zeroDays,              // 记录为 0 的天数（无产出/请假）
      missingDays: missingDays,        // 未记录天数
      daysElapsed: daysElapsed,
      avgCount: avgCount,
      avgIncome: avgIncome,
      bestDate: best ? best.date : '',
      bestCount: best ? Number(best.count) || 0 : 0,
      bestIncome: best ? round2((Number(best.count) || 0) * unitPrice) : 0
    };
  }

  /** 最近 N 天序列（截止 endKey），未记录的日期 count 为 null */
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
        var hay = (r.date + ' ' + (r.note || '')).toLowerCase();
        if (hay.indexOf(kw) === -1) return false;
      }
      return true;
    });
  }

  /* ---------------- 导出 ---------------- */

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  /** 导出 CSV（带 BOM，Excel 打开中文不乱码） */
  function toCSV(records, unitPrice) {
    var rows = [['日期', '件数', '单价(元)', '收入(元)', '备注']];
    records.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (r) {
      rows.push([
        r.date,
        Number(r.count) || 0,
        unitPrice.toFixed(2),
        round2((Number(r.count) || 0) * unitPrice).toFixed(2),
        r.note || ''
      ]);
    });
    return '﻿' + rows.map(function (row) {
      return row.map(csvCell).join(',');
    }).join('\r\n');
  }

  /* ---------------- 存储层 ---------------- */

  function createStore(backend, options) {
    options = options || {};
    var prefix = options.prefix == null ? STORAGE_PREFIX : options.prefix;
    var keys = options.keys || KEYS;
    var memoryFallback = {};
    var usable = true;

    function readRaw(key) {
      try {
        return backend.getItem(prefix + key);
      } catch (e) {
        usable = false;
        return Object.prototype.hasOwnProperty.call(memoryFallback, key) ? memoryFallback[key] : null;
      }
    }

    function writeRaw(key, value) {
      try {
        backend.setItem(prefix + key, value);
      } catch (e) {
        usable = false;
        memoryFallback[key] = value;
      }
    }

    function readJSON(key, fallback) {
      var raw = readRaw(key);
      if (raw == null) return fallback;
      try { return JSON.parse(raw); } catch (e) { return fallback; }
    }

    return {
      isPersistent: function () { return usable; },

      getSettings: function () {
        var saved = readJSON(keys.settings, {});
        return Object.assign({}, DEFAULT_SETTINGS, saved || {});
      },

      saveSettings: function (patch) {
        var next = Object.assign({}, this.getSettings(), patch || {});
        writeRaw(keys.settings, JSON.stringify(next));
        return next;
      },

      getRecords: function () {
        var list = readJSON(keys.records, []);
        return Array.isArray(list) ? list : [];
      },

      saveRecords: function (records) {
        writeRaw(keys.records, JSON.stringify(records));
        return records;
      },

      /** 保存一条记录（同一天覆盖） */
      upsert: function (date, count, note) {
        var settings = this.getSettings();
        var result = upsertRecord(this.getRecords(), { date: date, count: count, note: note }, settings.unitPrice);
        this.saveRecords(result.records);
        return result;
      },

      remove: function (date) {
        var next = removeRecord(this.getRecords(), date);
        this.saveRecords(next);
        return next;
      },

      /** 修改单价：同步重算历史记录收入 */
      setUnitPrice: function (price) {
        if (!isValidUnitPrice(price)) return null;
        var p = round2(price);
        this.saveSettings({ unitPrice: p });
        var records = repriceRecords(this.getRecords(), p);
        this.saveRecords(records);
        return p;
      },

      clearAll: function () {
        writeRaw(keys.records, '[]');
        writeRaw(keys.settings, JSON.stringify(Object.assign({}, DEFAULT_SETTINGS)));
      },

      exportBackup: function () {
        return JSON.stringify({
          app: 'pkgstat',
          version: 1,
          exportedAt: new Date().toISOString(),
          settings: this.getSettings(),
          records: this.getRecords()
        }, null, 2);
      },

      importBackup: function (json) {
        var data = typeof json === 'string' ? JSON.parse(json) : json;
        if (!data || !Array.isArray(data.records)) throw new Error('备份文件格式不正确');
        var unitPrice = isValidUnitPrice(data.settings && data.settings.unitPrice)
          ? round2(data.settings.unitPrice)
          : this.getSettings().unitPrice;
        var records = data.records
          .filter(function (r) { return r && r.date && isValidCount(r.count); })
          .map(function (r) {
            return {
              id: r.id || ('r_' + r.date + '_' + Math.random().toString(36).slice(2, 8)),
              date: r.date,
              count: Math.floor(Number(r.count)),
              unitPrice: unitPrice,
              income: round2(Math.floor(Number(r.count)) * unitPrice),
              note: clampNote(r.note),
              createdAt: r.createdAt || new Date().toISOString(),
              updatedAt: r.updatedAt || new Date().toISOString()
            };
          });
        this.saveRecords(records);
        var patch = {};
        if (data.settings) {
          Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
            if (data.settings[k] !== undefined) patch[k] = data.settings[k];
          });
        }
        this.saveSettings(patch);
        return records.length;
      }
    };
  }

  return {
    STORAGE_PREFIX: STORAGE_PREFIX,
    KEYS: KEYS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    MAX_COUNT: MAX_COUNT,
    MAX_NOTE: MAX_NOTE,
    pad2: pad2,
    toDateKey: toDateKey,
    fromDateKey: fromDateKey,
    monthOf: monthOf,
    monthLabel: monthLabel,
    daysInMonth: daysInMonth,
    shiftDate: shiftDate,
    round2: round2,
    formatMoney: formatMoney,
    formatCount: formatCount,
    formatDateCN: formatDateCN,
    shortDate: shortDate,
    weekdayCN: weekdayCN,
    isValidCount: isValidCount,
    isValidUnitPrice: isValidUnitPrice,
    resolveApiBase: resolveApiBase,
    DEFAULT_FILE_API_BASE: DEFAULT_FILE_API_BASE,
    incomeOf: incomeOf,
    sortRecords: sortRecords,
    upsertRecord: upsertRecord,
    removeRecord: removeRecord,
    findRecord: findRecord,
    repriceRecords: repriceRecords,
    computeMonthStats: computeMonthStats,
    recentSeries: recentSeries,
    filterRecords: filterRecords,
    toCSV: toCSV,
    createStore: createStore
  };
});
