/* ============================================================
 * 本地存储层：记录 / 设置 / 服务器地址
 * 后端是注入的（浏览器 localStorage，测试用内存 Map），
 * 与 assets/js/core.js 的纯逻辑解耦。
 * ============================================================ */
(function (root) {
  'use strict';

  var CFG = root.APP_CONFIG;

  function memoryBackend() {
    var map = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
      setItem: function (k, v) { map[k] = String(v); },
      removeItem: function (k) { delete map[k]; }
    };
  }

  function defaultBackend() {
    try {
      var probe = '__psc_probe__';
      root.localStorage.setItem(probe, '1');
      root.localStorage.removeItem(probe);
      return root.localStorage;
    } catch (e) {
      return memoryBackend();
    }
  }

  function createStore(backend, options) {
    options = options || {};
    var keys = options.keys || (root.APP_CONFIG && root.APP_CONFIG.storageKeys) || {
      records: 'psc.records.v1',
      settings: 'psc.settings.v1',
      auth: 'psc.auth.v1',
      server: 'psc.server.v1',
      avatar: 'psc.avatar.v1'
    };
    var defaults = (root.APP_CONFIG && root.APP_CONFIG.defaults) || {
      unitPrice: 1.5,
      reminderEnabled: false,
      reminderTime: '21:00',
      reminderText: ''
    };
    var backendImpl = backend || defaultBackend();
    var memory = memoryBackend();
    var persistent = true;

    function readRaw(key) {
      try {
        var v = backendImpl.getItem(key);
        return v === null || v === undefined ? null : v;
      } catch (e) {
        persistent = false;
        return memory.getItem(key);
      }
    }

    function writeRaw(key, value) {
      try {
        backendImpl.setItem(key, value);
      } catch (e) {
        persistent = false;
        memory.setItem(key, value);
      }
    }

    function removeRaw(key) {
      try { backendImpl.removeItem(key); } catch (e) { persistent = false; }
      memory.removeItem(key);
    }

    function readJSON(key, fallback) {
      var raw = readRaw(key);
      if (raw == null) return fallback;
      try { return JSON.parse(raw); } catch (e) { return fallback; }
    }

    return {
      isPersistent: function () { return persistent; },

      /* ---- 记录 ---- */
      getRecords: function () {
        var list = readJSON(keys.records, []);
        return Array.isArray(list) ? list : [];
      },
      saveRecords: function (records) {
        writeRaw(keys.records, JSON.stringify(records));
        return records;
      },
      /** 保存当天/补录记录：同一天覆盖 */
      upsertRecord: function (date, count, note) {
        var settings = this.getSettings();
        var Core = root.Core;
        var result = Core.upsertRecord(this.getRecords(), { date: date, count: count, note: note }, settings.unitPrice);
        this.saveRecords(result.records);
        return result;
      },
      removeRecord: function (date) {
        var next = root.Core.removeRecord(this.getRecords(), date);
        this.saveRecords(next);
        return next;
      },

      /* ---- 设置 ---- */
      getSettings: function () {
        var saved = readJSON(keys.settings, {}) || {};
        return Object.assign({}, defaults, saved);
      },
      saveSettings: function (patch) {
        var next = Object.assign({}, this.getSettings(), patch || {});
        writeRaw(keys.settings, JSON.stringify(next));
        return next;
      },
      /** 改单价：历史记录收入同步重算（PRD §5.5） */
      setUnitPrice: function (price) {
        if (!root.Core.isValidUnitPrice(price)) return null;
        var p = root.Core.round2(price);
        this.saveSettings({ unitPrice: p });
        this.saveRecords(root.Core.repriceRecords(this.getRecords(), p));
        return p;
      },

      /* ---- 会话 ---- */
      getAuth: function () { return readJSON(keys.auth, null); },
      saveAuth: function (auth) { writeRaw(keys.auth, JSON.stringify(auth)); return auth; },
      clearAuth: function () { removeRaw(keys.auth); },

      /* ---- 服务器地址（F-019）----
         默认按**当前主机名 + 接口端口**推导：手机上打开 192.168.x.x:5174 时，
         接口地址会推导成 192.168.x.x:5173（而不是手机自己的 localhost）。
         用户在登录页改写后以保存值为准。 */
      getServerBase: function () {
        var saved = (readRaw(keys.server) || '').trim();
        var cfg = root.APP_CONFIG || {};
        var loc = root.location || {};
        if (root.Core && root.Core.resolveApiBase) {
          return root.Core.resolveApiBase({
            saved: saved,
            protocol: loc.protocol,
            hostname: loc.hostname,
            port: loc.port,
            apiPort: cfg.apiPort,
            defaultApiBase: cfg.defaultApiBase
          });
        }
        return saved || cfg.defaultApiBase || 'http://localhost:5173';
      },
      setServerBase: function (base) {
        var v = String(base || '').trim().replace(/\/+$/, '');
        if (v && root.location && root.location.protocol !== 'file:' && v === root.location.origin) v = '';
        writeRaw(keys.server, v);
        return v;
      },

      /* ---- 头像（后端未就绪时先存本机） ---- */
      getAvatar: function () {
        return readRaw(keys.avatar) || '';
      },
      setAvatar: function (dataUrl) {
        writeRaw(keys.avatar, dataUrl || '');
        return dataUrl || '';
      },
      clearAvatar: function () {
        removeRaw(keys.avatar);
      }
    };
  }

  root.Store = { createStore: createStore, memoryBackend: memoryBackend, defaultBackend: defaultBackend };
})(typeof globalThis !== 'undefined' ? globalThis : this);
