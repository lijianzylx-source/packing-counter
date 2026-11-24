/* ============================================================
 * 会话与路由守卫（PRD F-015 ~ F-018）
 *   登录态 ──► 校验令牌 ──► 放行 / 回落登录页
 *   服务器不可达 ──► 离线模式放行（不校验）
 * ============================================================ */
(function (root) {
  'use strict';

  function createAuth(options) {
    options = options || {};
    var store = options.store;
    var api = options.api;
    var loginPage = options.loginPage || 'login.html';
    var onStateChange = options.onStateChange || function () {};

    function currentUser() {
      var auth = store.getAuth();
      return auth && auth.user ? auth.user : null;
    }

    function isOffline() {
      return !!(store.getAuth() && store.getAuth().offline);
    }

    /** 页面进入时的守卫：需要登录的页面在无有效会话时跳转登录页 */
    function requireAuth(currentPage) {
      var auth = store.getAuth();
      if (!auth || !auth.token) {
        location.replace(loginPage + '?redirect=' + encodeURIComponent(currentPage || ''));
        return Promise.resolve(null);
      }
      return api.me().then(function (res) {
        if (res.ok && res.data && res.data.user) {
          auth.user = res.data.user;
          auth.offline = false;
          store.saveAuth(auth);
          onStateChange({ user: auth.user, offline: false });
          return auth.user;
        }
        if (res.status === 401) {
          store.clearAuth();
          location.replace(loginPage + '?redirect=' + encodeURIComponent(currentPage || '') + '&reason=expired');
          return null;
        }
        // 服务器异常：离线模式放行
        auth.offline = true;
        store.saveAuth(auth);
        onStateChange({ user: auth.user, offline: true });
        return auth.user;
      });
    }

    function saveSession(token, user) {
      store.saveAuth({ token: token, user: user, offline: false, savedAt: new Date().toISOString() });
      onStateChange({ user: user, offline: false });
    }

    function logout() {
      var token = (store.getAuth() || {}).token;
      store.clearAuth();
      onStateChange({ user: null, offline: false });
      return api.logout().catch(function () { /* 令牌已在本地清除 */ });
    }

    /** 不登录直接进入（离线模式，F-018） */
    function enterOffline() {
      store.saveAuth({ token: null, user: null, offline: true, savedAt: new Date().toISOString() });
      onStateChange({ user: null, offline: true });
    }

    return {
      currentUser: currentUser,
      isOffline: isOffline,
      requireAuth: requireAuth,
      saveSession: saveSession,
      logout: logout,
      enterOffline: enterOffline
    };
  }

  root.Auth = { createAuth: createAuth };
})(typeof globalThis !== 'undefined' ? globalThis : this);
