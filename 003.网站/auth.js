
/* ============================================================
 * 账号与会话逻辑（服务端）—— 纯逻辑，不依赖 HTTP，可直接单测
 * 密码只存 scrypt 哈希 + 随机盐，永不存明文
 * ============================================================ */
'use strict';

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var USERNAME_RE = /^[A-Za-z0-9_一-龥-]{2,20}$/;
var MIN_PASSWORD = 6;
var MAX_PASSWORD = 72;
var MAX_ATTEMPTS = 5;          // 同名账号连续失败上限
var LOCK_MINUTES = 15;

function validateUsername(name) {
  var u = String(name == null ? '' : name).trim();
  if (!u) return { ok: false, message: '请输入用户名' };
  if (u.length < 2 || u.length > 20) return { ok: false, message: '用户名长度需为 2–20 个字符' };
  if (!USERNAME_RE.test(u)) return { ok: false, message: '用户名只能包含中英文、数字、下划线和短横线' };
  return { ok: true, value: u };
}

function validatePassword(pw) {
  var p = String(pw == null ? '' : pw);
  if (!p) return { ok: false, message: '请输入密码' };
  if (p.length < MIN_PASSWORD) return { ok: false, message: '密码至少 ' + MIN_PASSWORD + ' 位' };
  if (p.length > MAX_PASSWORD) return { ok: false, message: '密码不能超过 ' + MAX_PASSWORD + ' 位' };
  return { ok: true, value: p };
}

/** 密码哈希：scrypt$N$r$p$salt$hash */
function hashPassword(password) {
  var N = 16384, r = 8, p = 1;
  var salt = crypto.randomBytes(16);
  var key = crypto.scryptSync(String(password), salt, 64, { N: N, r: r, p: p });
  return ['scrypt', N, r, p, salt.toString('hex'), key.toString('hex')].join('$');
}

/** 校验密码，常数时间比较 */
function verifyPassword(password, stored) {
  try {
    var parts = String(stored || '').split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    var N = Number(parts[1]), r = Number(parts[2]), p = Number(parts[3]);
    var salt = Buffer.from(parts[4], 'hex');
    var expected = Buffer.from(parts[5], 'hex');
    if (!expected.length) return false;
    var actual = crypto.scryptSync(String(password), salt, expected.length, { N: N, r: r, p: p });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch (e) {
    return false;
  }
}

function publicUser(user) {
  return { id: user.id, username: user.username, createdAt: user.createdAt };
}

/**
 * 账号库。file 为空时用内存存储（测试用），否则读写 JSON 文件。
 */
function createAuthStore(options) {
  options = options || {};
  var file = options.file || null;
  var db = { users: [], sessions: {} };
  var attempts = {};   // username -> { count, until }

  if (file && fs.existsSync(file)) {
    try {
      db = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      db = { users: [], sessions: {} };
    }
  }
  if (!Array.isArray(db.users)) db.users = [];
  if (!db.sessions || typeof db.sessions !== 'object') db.sessions = {};

  function save() {
    if (!file) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(db, null, 2), 'utf8');
  }

  function findUser(username) {
    var key = String(username || '').trim().toLowerCase();
    for (var i = 0; i < db.users.length; i++) {
      if (db.users[i].username.toLowerCase() === key) return db.users[i];
    }
    return null;
  }

  function pruneSessions() {
    var now = Date.now();
    var maxAge = 30 * 24 * 3600 * 1000;
    Object.keys(db.sessions).forEach(function (token) {
      var s = db.sessions[token];
      if (!s || !s.createdAt || now - s.createdAt > maxAge) delete db.sessions[token];
    });
  }

  function lockState(username) {
    var key = String(username || '').trim().toLowerCase();
    var rec = attempts[key];
    if (!rec) return null;
    if (rec.until && rec.until > Date.now()) return rec;  // 仍在锁定期
    if (rec.until) delete attempts[key];                  // 锁定期已过，清理
    return null;                                          // until===0 表示仅在累计失败次数
  }

  return {
    /** 注册：返回 { ok, user } 或 { ok:false, code, message } */
    register: function (username, password) {
      var nameCheck = validateUsername(username);
      if (!nameCheck.ok) return { ok: false, code: 'INVALID_USERNAME', message: nameCheck.message };
      var pwCheck = validatePassword(password);
      if (!pwCheck.ok) return { ok: false, code: 'INVALID_PASSWORD', message: pwCheck.message };
      if (findUser(nameCheck.value)) {
        return { ok: false, code: 'USERNAME_TAKEN', message: '该用户名已被注册，换一个试试' };
      }
      var user = {
        id: 'u_' + crypto.randomBytes(8).toString('hex'),
        username: nameCheck.value,
        passHash: hashPassword(pwCheck.value),
        createdAt: new Date().toISOString(),
        lastLoginAt: null
      };
      db.users.push(user);
      save();
      return { ok: true, user: publicUser(user) };
    },

    /** 登录校验：成功返回 { ok, user } */
    authenticate: function (username, password) {
      var name = String(username || '').trim();
      var locked = lockState(name);
      if (locked) {
        var mins = Math.ceil((locked.until - Date.now()) / 60000);
        return { ok: false, code: 'LOCKED', message: '密码错误次数过多，请 ' + mins + ' 分钟后再试' };
      }
      var user = findUser(name);
      if (!user) {
        // 用户不存在时也做一次哈希运算，避免通过响应时间探测用户名是否存在
        hashPassword(String(password == null ? '' : password));
        return { ok: false, code: 'BAD_CREDENTIALS', message: '用户名或密码不正确' };
      }
      if (!verifyPassword(password, user.passHash)) {
        var key = name.toLowerCase();
        var rec = attempts[key] || { count: 0, until: 0 };
        rec.count += 1;
        if (rec.count >= MAX_ATTEMPTS) {
          rec.until = Date.now() + LOCK_MINUTES * 60000;
          rec.count = 0;
          attempts[key] = rec;
          return { ok: false, code: 'LOCKED', message: '密码错误次数过多，请 ' + LOCK_MINUTES + ' 分钟后再试' };
        }
        attempts[key] = rec;
        return { ok: false, code: 'BAD_CREDENTIALS', message: '用户名或密码不正确' };
      }
      delete attempts[name.toLowerCase()];
      user.lastLoginAt = new Date().toISOString();
      save();
      return { ok: true, user: publicUser(user) };
    },

    createSession: function (userId) {
      var token = crypto.randomBytes(32).toString('hex');
      pruneSessions();
      db.sessions[token] = { userId: userId, createdAt: Date.now() };
      save();
      return token;
    },

    getUserByToken: function (token) {
      if (!token) return null;
      var s = db.sessions[token];
      if (!s) return null;
      for (var i = 0; i < db.users.length; i++) {
        if (db.users[i].id === s.userId) return publicUser(db.users[i]);
      }
      delete db.sessions[token];
      save();
      return null;
    },

    revokeSession: function (token) {
      if (token && db.sessions[token]) { delete db.sessions[token]; save(); return true; }
      return false;
    },

    listUsers: function () {
      return db.users.map(publicUser);
    },

    /** 供测试/运维查看 */
    stats: function () {
      return { users: db.users.length, sessions: Object.keys(db.sessions).length };
    }
  };
}

module.exports = {
  USERNAME_RE: USERNAME_RE,
  MIN_PASSWORD: MIN_PASSWORD,
  MAX_PASSWORD: MAX_PASSWORD,
  validateUsername: validateUsername,
  validatePassword: validatePassword,
  hashPassword: hashPassword,
  verifyPassword: verifyPassword,
  publicUser: publicUser,
  createAuthStore: createAuthStore
};
