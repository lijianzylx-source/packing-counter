/* ============================================================
 * 接口层：账号服务端（/api/register|login|logout|me）
 * 契约见 001.产品PRD/跨境包裹打包统计-PRD-v1.0.1.md §4.6
 * ============================================================ */
(function (root) {
  'use strict';

  function createApi(options) {
    options = options || {};
    var store = options.store;
    var fetchImpl = options.fetch || root.fetch.bind(root);

    function base() {
      return store ? store.getServerBase() : '';
    }

    function request(path, config) {
      config = config || {};
      var headers = {};
      if (config.body) headers['Content-Type'] = 'application/json';
      var auth = store ? store.getAuth() : null;
      if (auth && auth.token) headers['Authorization'] = 'Bearer ' + auth.token;

      return fetchImpl(base() + path, {
        method: config.method || (config.body ? 'POST' : 'GET'),
        headers: headers,
        body: config.body ? JSON.stringify(config.body) : undefined
      }).then(function (res) {
        return res.text().then(function (text) {
          var data = {};
          try { data = text ? JSON.parse(text) : {}; } catch (e) { data = {}; }
          return { ok: res.ok, status: res.status, data: data, network: false };
        });
      }).catch(function () {
        return { ok: false, status: 0, network: true, data: { message: '无法连接服务器 ' + (base() || root.location.origin) } };
      });
    }

    return {
      /** 注册（成功即返回令牌，前端自动登录） */
      register: function (username, password) {
        return request('/api/register', { body: { username: username, password: password } });
      },
      /** 登录 */
      login: function (username, password) {
        return request('/api/login', { body: { username: username, password: password } });
      },
      /** 退出（作废服务端令牌） */
      logout: function () {
        return request('/api/logout', { method: 'POST' });
      },
      /** 用本地令牌换取当前用户 */
      me: function () {
        return request('/api/me');
      },
      /**
       * 上传头像（后端接口待补）
       * 约定：POST /api/me/avatar  { avatar: "<dataURL>" }
       *       → 200 { ok:true, avatar:"<可访问的URL或dataURL>" }
       * 后端未就绪时返回 404/501，前端会自动降级为「保存在本机」。
       */
      uploadAvatar: function (dataUrl) {
        return request('/api/me/avatar', { body: { avatar: dataUrl } });
      },
      /** 连通性探测（不携带令牌，返回 401 也说明服务器可达） */
      ping: function () {
        return request('/api/me');
      }
    };
  }

  root.Api = { createApi: createApi };
})(typeof globalThis !== 'undefined' ? globalThis : this);
