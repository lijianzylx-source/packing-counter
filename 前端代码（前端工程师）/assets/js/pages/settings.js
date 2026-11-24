/* ============================================================
 * 系统设置页逻辑（PRD F-011 ~ F-013、F-017、F-019）
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

  var page = 'settings.html';
  function $id(id) { return document.getElementById(id); }
  function records() { return store.getRecords(); }
  function settings() { return store.getSettings(); }

  /* ---------------- 渲染 ---------------- */

  function render() {
    var s = settings();

    $id('unit-price').value = Number(s.unitPrice).toFixed(2);
    $id('reminder-enabled').checked = !!s.reminderEnabled;
    $id('reminder-time').value = s.reminderTime || '21:00';
    $id('reminder-text').value = s.reminderText || '';
    $id('api-endpoint').value = store.getServerBase() || window.APP_CONFIG.defaultApiBase;

    var user = auth.currentUser();
    var offline = auth.isOffline();
    $id('account-name').textContent = user ? user.username : '离线使用中';
    $id('account-status').textContent = user
      ? (offline ? '已登录 · 离线模式（未向服务器校验）' : '已登录 · 账号已验证')
      : '未连接账号，数据仅保存在本机';
    var badge = $id('account-badge');
    badge.textContent = user ? (offline ? '离线模式' : '已登录') : '离线';
    badge.className = 'c-badge ' + (user && !offline ? 'c-badge--success' : 'c-badge--warning');
    $id('btn-logout').hidden = !user;

    // 头像：本机保存优先（后端接口未就绪时也能正常显示）
    var avatar = store.getAvatar();
    window.Avatar.render($id('account-avatar'), avatar, window.Avatar.initialOf(user ? user.username : ''));
    $id('btn-reset-avatar').hidden = !avatar;

    $id('about-storage').textContent = store.isPersistent() ? '本机浏览器（localStorage）' : '仅内存（刷新即失）';
    $id('about-count').textContent = Core.formatCount(records().length) + ' 条';
    UI.setRate(s.unitPrice);
  }

  /* ---------------- 头像上传（前端部分；后端接口未就绪时降级为本机存储） ---------------- */

  function pickAvatar() {
    var input = $id('file-avatar');
    input.value = '';          // 允许连续选择同一个文件也能触发 change
    input.click();
  }

  function handleAvatarFile(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;

    UI.toast('正在处理图片…');
    window.Avatar.process(file).then(function (result) {
      // ① 先落本机，立刻可见
      store.setAvatar(result.dataUrl);
      render();
      UI.refreshShell({ user: auth.currentUser(), offline: auth.isOffline() });
      UI.toast('头像已更新（' + result.width + '×' + result.height + ' → 256×256）', 'ok');

      // ② 再尝试上传后端：接口未就绪时保持本机存储
      api.uploadAvatar(result.dataUrl).then(function (res) {
        if (res.ok && res.data && res.data.avatar) {
          store.setAvatar(res.data.avatar);
          render();
          UI.refreshShell({ user: auth.currentUser(), offline: auth.isOffline() });
          UI.toast('头像已同步到服务器', 'ok');
        } else {
          UI.toast('后端头像接口未就绪，头像暂存在本机', 'error');
        }
      }).catch(function () {
        UI.toast('后端不可达，头像暂存在本机', 'error');
      });
    }).catch(function (err) {
      UI.toast(err.message || '图片处理失败', 'error');
    });
  }

  function resetAvatar() {
    store.clearAvatar();
    render();
    UI.refreshShell({ user: auth.currentUser(), offline: auth.isOffline() });
    UI.toast('已恢复默认头像', 'ok');
  }

  /* ---------------- 操作 ---------------- */

  function savePrice() {
    var raw = $id('unit-price').value;
    if (!Core.isValidUnitPrice(raw)) { UI.toast('单价需在 0.01 – 100 元之间', 'error'); return; }
    var price = store.setUnitPrice(raw);
    if (price === null) { UI.toast('单价设置失败', 'error'); return; }
    render();
    UI.toast('单价已更新为 ¥' + price.toFixed(2) + '，历史收入已重算', 'ok');
  }

  function saveReminder() {
    var enabled = $id('reminder-enabled').checked;
    var time = $id('reminder-time').value || '21:00';
    var text = $id('reminder-text').value.trim() || window.APP_CONFIG.defaults.reminderText;

    function persist() {
      store.saveSettings({ reminderEnabled: enabled, reminderTime: time, reminderText: text });
      render();
      UI.toast(enabled ? '提醒已开启' : '提醒已关闭', 'ok');
    }

    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(function (perm) {
        if (perm === 'granted') { persist(); }
        else {
          store.saveSettings({ reminderEnabled: false, reminderTime: time, reminderText: text });
          render();
          UI.toast('未授予通知权限，提醒仅在页面内提示', 'error');
        }
      });
      return;
    }
    persist();
  }

  function exportCSV(ym) {
    var rows = ym ? records().filter(function (r) { return Core.monthOf(r.date) === ym; }) : records();
    if (!rows.length) { UI.toast('没有可导出的数据', 'error'); return; }
    var name = ym ? ('打包统计-' + ym + '.csv') : '打包统计-全部.csv';
    UI.download(name, Core.toCSV(rows, settings().unitPrice), 'text/csv');
    UI.toast('已导出 ' + rows.length + ' 条记录', 'ok');
  }

  function exportBackup() {
    var payload = JSON.stringify({
      app: 'psc',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: settings(),
      records: records()
    }, null, 2);
    UI.download('打包统计备份-' + Core.todayKey() + '.json', payload, 'application/json');
    UI.toast('备份已下载', 'ok');
  }

  function restoreBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        if (!data || !Array.isArray(data.records)) throw new Error('格式不正确');
        var price = Core.isValidUnitPrice(data.settings && data.settings.unitPrice)
          ? Core.round2(data.settings.unitPrice) : settings().unitPrice;
        var restored = data.records
          .filter(function (r) { return r && r.date && Core.isValidCount(r.count); })
          .map(function (r) {
            return {
              id: r.id || ('r_' + r.date + '_' + Math.random().toString(36).slice(2, 8)),
              date: r.date,
              count: Math.floor(Number(r.count)),
              unitPrice: price,
              income: Core.round2(Math.floor(Number(r.count)) * price),
              note: Core.clampNote(r.note),
              createdAt: r.createdAt || new Date().toISOString(),
              updatedAt: r.updatedAt || new Date().toISOString()
            };
          });
        store.saveRecords(restored);
        if (data.settings) {
          var patch = {};
          Object.keys(window.APP_CONFIG.defaults).forEach(function (k) {
            if (data.settings[k] !== undefined) patch[k] = data.settings[k];
          });
          store.saveSettings(patch);
        }
        render();
        UI.toast('已恢复 ' + restored.length + ' 条记录', 'ok');
      } catch (e) {
        UI.toast('备份文件解析失败', 'error');
      }
    };
    reader.readAsText(file);
  }

  function clearAll() {
    if (!window.confirm('确定清空全部记录与设置吗？此操作不可撤销。')) return;
    if (!window.confirm('再次确认：所有历史数据将被删除，请先做好备份。')) return;
    store.saveRecords([]);
    store.saveSettings({});
    render();
    UI.toast('已清空全部数据', 'ok');
  }

  function checkServer() {
    var dot = $id('server-dot');
    var label = $id('server-label');
    dot.className = 'c-dot c-dot--warn';
    label.textContent = '检测中…';
    return api.ping().then(function (res) {
      if (res.network) {
        dot.className = 'c-dot c-dot--warn';
        label.textContent = '不可达';
        return false;
      }
      dot.className = 'c-dot c-dot--ok';
      label.textContent = '已连接';
      return true;
    });
  }

  function applyServerAddress() {
    store.setServerBase($id('api-endpoint').value.trim());
    $id('api-endpoint').value = store.getServerBase() || window.APP_CONFIG.defaultApiBase;
    checkServer();
  }

  /* ---------------- 事件 ---------------- */

  function bindEvents() {
    $id('btn-save-price').addEventListener('click', savePrice);
    $id('btn-avatar').addEventListener('click', pickAvatar);
    $id('btn-pick-avatar').addEventListener('click', pickAvatar);
    $id('file-avatar').addEventListener('change', handleAvatarFile);
    $id('btn-reset-avatar').addEventListener('click', resetAvatar);
    $id('btn-save-reminder').addEventListener('click', saveReminder);
    $id('btn-export-month').addEventListener('click', function () { exportCSV(Core.currentMonth()); });
    $id('btn-export-all').addEventListener('click', function () { exportCSV(null); });
    $id('btn-backup').addEventListener('click', exportBackup);
    $id('btn-restore').addEventListener('click', function () { $id('file-restore').click(); });
    $id('file-restore').addEventListener('change', function () {
      if (this.files && this.files[0]) restoreBackup(this.files[0]);
      this.value = '';
    });
    $id('btn-clear').addEventListener('click', clearAll);

    $id('btn-test-server').addEventListener('click', applyServerAddress);
    $id('btn-reset-server').addEventListener('click', function () {
      $id('api-endpoint').value = window.APP_CONFIG.defaultApiBase;
      applyServerAddress();
    });

    $id('btn-logout').addEventListener('click', function () {
      if (!window.confirm('确定退出登录吗？本机的记录会保留，重新登录同一账号即可继续使用。')) return;
      auth.logout().then(function () { location.replace('login.html'); });
    });

    // 跨页跳转：设置页带 #export 时自动滚动到数据区
    if (location.hash === '#export') {
      setTimeout(function () {
        var target = $id('export');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }

  /* ---------------- 初始化 ---------------- */

  function init() {
    UI.mountShell(page);
    bindEvents();
    render();

    auth.requireAuth(page).then(function (user) {
      UI.refreshShell({ user: user, offline: auth.isOffline() });
      render();
    });
    checkServer();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
