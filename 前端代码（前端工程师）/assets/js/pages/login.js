/* ============================================================
 * 登录页逻辑（PRD F-014 ~ F-019）
 * ============================================================ */
(function () {
  'use strict';

  var Core = window.Core;
  var store = window.Store.createStore();
  var api = window.Api.createApi({ store: store });
  var UI = window.UI;

  var mode = 'login';
  var submitting = false;

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- 模式切换 ---------------- */

  function setMode(next) {
    mode = next === 'register' ? 'register' : 'login';
    var isRegister = mode === 'register';

    ['login', 'register'].forEach(function (m) {
      var btn = $('tab-' + m);
      btn.setAttribute('aria-pressed', m === mode ? 'true' : 'false');
      btn.className = 'c-btn c-btn--sm' + (m === mode ? ' c-btn--primary' : ' c-btn--ghost');
    });

    $('confirm-group').hidden = !isRegister;
    $('password2').required = isRegister;
    $('password').setAttribute('autocomplete', isRegister ? 'new-password' : 'current-password');
    $('auth-submit-text').textContent = isRegister ? '注册并进入包装工作台' : '登录并进入包装工作台';
    hideError();
  }

  function showError(title, text) {
    $('auth-alert-title').textContent = title;
    $('auth-alert-text').textContent = text;
    $('auth-alert').hidden = false;
  }

  function hideError() { $('auth-alert').hidden = true; }

  /* ---------------- 服务器地址（F-019） ---------------- */

  function applyServerAddress() {
    var value = $('api-endpoint').value.trim();
    store.setServerBase(value);
    $('api-endpoint').value = store.getServerBase() || window.APP_CONFIG.defaultApiBase;
    checkServer();
  }

  function checkServer() {
    var dot = $('server-dot');
    var label = $('server-label');
    dot.className = 'c-dot c-dot--warn';
    label.textContent = '正在检测服务器…';
    return api.ping().then(function (res) {
      if (res.network) {
        dot.className = 'c-dot c-dot--warn';
        label.textContent = '无法连接服务器（可改地址或离线使用）';
        return false;
      }
      dot.className = 'c-dot c-dot--ok';
      label.textContent = '服务器已连接 · ' + (store.getServerBase() || location.origin);
      return true;
    });
  }

  /* ---------------- 提交 ---------------- */

  function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    var username = $('username').value.trim();
    var password = $('password').value;
    var password2 = $('password2').value;

    if (!Core.isValidUsername(username)) {
      showError('用户名格式不正确', '用户名需为 2–20 位，仅含中文、英文、数字、下划线或短横线。');
      return;
    }
    if (!Core.isValidPassword(password)) {
      showError('密码格式不正确', '密码长度需为 6–72 位。');
      return;
    }
    if (mode === 'register' && password !== password2) {
      showError('两次输入的密码不一致', '请确认密码后再提交。');
      return;
    }

    hideError();
    submitting = true;
    var btn = $('auth-submit');
    var text = $('auth-submit-text');
    var original = text.textContent;
    btn.disabled = true;
    text.textContent = mode === 'register' ? '正在创建账号…' : '正在校验身份…';

    var req = mode === 'register'
      ? api.register(username, password)
      : api.login(username, password);

    req.then(function (res) {
      if (!res.ok) {
        showError(
          res.status === 429 ? '账号已临时锁定' : '鉴权失败',
          res.data.message || '用户名或密码不正确。'
        );
        return;
      }
      store.saveAuth({
        token: res.data.token,
        user: res.data.user,
        offline: false,
        remember: $('remember').checked,
        savedAt: new Date().toISOString()
      });
      var redirect = new URLSearchParams(location.search).get('redirect');
      location.href = redirect || 'workbench.html';
    }).catch(function () {
      showError('无法连接服务器', '请确认服务已启动（node server.js），或在下方设置服务器地址。');
    }).then(function () {
      submitting = false;
      btn.disabled = false;
      text.textContent = original;
    });
  }

  /* ---------------- 初始化 ---------------- */

  function updateClock() {
    var now = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    $('live-clock').textContent = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
      ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
  }

  function init() {
    setMode('login');
    updateClock();
    setInterval(updateClock, 1000);

    $('api-endpoint').value = store.getServerBase() || window.APP_CONFIG.defaultApiBase;

    $('tab-login').addEventListener('click', function () { setMode('login'); });
    $('tab-register').addEventListener('click', function () { setMode('register'); });
    $('auth-form').addEventListener('submit', handleSubmit);

    $('toggle-pwd').addEventListener('click', function () {
      var input = $('password');
      var btn = $('toggle-pwd');
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      var use = btn.querySelector('use');
      if (use) use.setAttribute('href', show ? '#i-visibility' : '#i-visibility_off');
      btn.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
    });

    $('password').addEventListener('keyup', function (e) {
      var caps = e.getModifierState && e.getModifierState('CapsLock');
      $('caps-warning').hidden = !caps;
    });

    $('btn-forgot').addEventListener('click', function () {
      showError('找回密码', '当前版本尚未接入邮箱验证，请联系服务器管理员在 data/users.json 中重置该账号的密码哈希。');
    });

    $('btn-offline').addEventListener('click', function () {
      store.saveAuth({ token: null, user: null, offline: true, savedAt: new Date().toISOString() });
      location.href = 'workbench.html';
    });

    $('btn-server-config').addEventListener('click', function () {
      var panel = $('server-config');
      panel.hidden = !panel.hidden;
    });
    $('btn-test-server').addEventListener('click', applyServerAddress);
    $('btn-reset-server').addEventListener('click', function () {
      $('api-endpoint').value = window.APP_CONFIG.defaultApiBase;
      applyServerAddress();
    });

    // 已登录则直接进入工作台
    var auth = store.getAuth();
    if (auth && auth.token) {
      api.me().then(function (res) {
        if (res.ok && res.data.user) {
          store.saveAuth(Object.assign({}, auth, { user: res.data.user, offline: false }));
          location.replace('workbench.html');
        } else if (res.status === 401) {
          store.clearAuth();
        }
      });
    }

    checkServer();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
