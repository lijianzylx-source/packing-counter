/* ============================================================
 * 账号与会话测试：node test/auth.test.js [名称关键字]
 * 覆盖注册、登录、令牌、退出、错误分支与安全约束
 * ============================================================ */
'use strict';

var assert = require('assert');
var path = require('path');
var auth = require(path.join(__dirname, '..', 'auth.js'));

var FILTER = process.argv[2] || '';
var passed = 0;
var skipped = 0;
function test(name, fn) {
  if (FILTER && name.indexOf(FILTER) === -1) { skipped++; return; }
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    console.error('  ✗ ' + name + '\n      ' + e.message);
    process.exitCode = 1;
  }
}

function newStore() {
  return auth.createAuthStore({ file: null });   // 内存模式，不落盘
}

console.log('\n账号与会话测试\n');

/* --- 用户名校验 --- */

test('用户名：2–20 位，允许中英文数字下划线短横线', function () {
  assert.strictEqual(auth.validateUsername('packer01').ok, true);
  assert.strictEqual(auth.validateUsername('打包员').ok, true);
  assert.strictEqual(auth.validateUsername('a_b-c').ok, true);
  assert.strictEqual(auth.validateUsername('a').ok, false);
  assert.strictEqual(auth.validateUsername('a'.repeat(21)).ok, false);
  assert.strictEqual(auth.validateUsername('').ok, false);
  assert.strictEqual(auth.validateUsername('has space').ok, false);
  assert.strictEqual(auth.validateUsername('a@b').ok, false);
});

test('用户名首尾空格被忽略', function () {
  var r = auth.validateUsername('  packer  ');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.value, 'packer');
});

/* --- 密码校验 --- */

test('密码：至少 6 位，最多 72 位', function () {
  assert.strictEqual(auth.validatePassword('123456').ok, true);
  assert.strictEqual(auth.validatePassword('12345').ok, false);
  assert.strictEqual(auth.validatePassword('x'.repeat(73)).ok, false);
  assert.strictEqual(auth.validatePassword('').ok, false);
});

/* --- 哈希 --- */

test('密码哈希可校验，且不包含明文', function () {
  var hash = auth.hashPassword('secret123');
  assert.ok(hash.indexOf('scrypt$') === 0);
  assert.strictEqual(hash.indexOf('secret123'), -1, '哈希中不得出现明文');
  assert.strictEqual(auth.verifyPassword('secret123', hash), true);
  assert.strictEqual(auth.verifyPassword('secret124', hash), false);
  assert.strictEqual(auth.verifyPassword('', hash), false);
});

test('同一密码两次哈希结果不同（随机盐）', function () {
  var a = auth.hashPassword('samepass');
  var b = auth.hashPassword('samepass');
  assert.notStrictEqual(a, b);
  assert.strictEqual(auth.verifyPassword('samepass', a), true);
  assert.strictEqual(auth.verifyPassword('samepass', b), true);
});

test('非法哈希字符串不会抛异常', function () {
  assert.strictEqual(auth.verifyPassword('x', 'not-a-hash'), false);
  assert.strictEqual(auth.verifyPassword('x', ''), false);
  assert.strictEqual(auth.verifyPassword('x', 'scrypt$1$2$3$aa$bb'), false);
});

/* --- 注册 --- */

test('注册成功返回用户信息（不含密码）', function () {
  var s = newStore();
  var r = s.register('packer01', 'secret123');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.user.username, 'packer01');
  assert.ok(r.user.id);
  assert.strictEqual(r.user.passHash, undefined);
  assert.strictEqual(r.user.password, undefined);
});

test('注册失败：用户名重复', function () {
  var s = newStore();
  s.register('packer01', 'secret123');
  var again = s.register('packer01', 'other123');
  assert.strictEqual(again.ok, false);
  assert.strictEqual(again.code, 'USERNAME_TAKEN');
});

test('注册失败：用户名大小写不敏感判重', function () {
  var s = newStore();
  s.register('Packer01', 'secret123');
  assert.strictEqual(s.register('packer01', 'secret123').code, 'USERNAME_TAKEN');
});

test('注册失败：用户名或密码不合法', function () {
  var s = newStore();
  assert.strictEqual(s.register('a', 'secret123').code, 'INVALID_USERNAME');
  assert.strictEqual(s.register('packer01', '123').code, 'INVALID_PASSWORD');
});

/* --- 登录 --- */

test('登录成功', function () {
  var s = newStore();
  s.register('packer01', 'secret123');
  var r = s.authenticate('packer01', 'secret123');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.user.username, 'packer01');
});

test('登录失败：密码错误与用户不存在都返回同一提示', function () {
  var s = newStore();
  s.register('packer01', 'secret123');
  var wrongPw = s.authenticate('packer01', 'wrongpass');
  var noUser = s.authenticate('nobody', 'secret123');
  assert.strictEqual(wrongPw.ok, false);
  assert.strictEqual(noUser.ok, false);
  assert.strictEqual(wrongPw.message, noUser.message, '不应暴露用户名是否存在');
});

test('连续 5 次密码错误后锁定 15 分钟', function () {
  var s = newStore();
  s.register('packer01', 'secret123');
  var last = null;
  for (var i = 0; i < 5; i++) last = s.authenticate('packer01', 'wrongpass');
  assert.strictEqual(last.code, 'LOCKED');
  var locked = s.authenticate('packer01', 'secret123');
  assert.strictEqual(locked.ok, false, '锁定期间正确密码也不放行');
  assert.strictEqual(locked.code, 'LOCKED');
});

/* --- 会话 --- */

test('会话令牌可用换取用户信息', function () {
  var s = newStore();
  var u = s.register('packer01', 'secret123').user;
  var token = s.createSession(u.id);
  assert.strictEqual(typeof token, 'string');
  assert.ok(token.length >= 32);
  var me = s.getUserByToken(token);
  assert.strictEqual(me.id, u.id);
  assert.strictEqual(me.username, 'packer01');
});

test('无效令牌返回 null', function () {
  var s = newStore();
  assert.strictEqual(s.getUserByToken('nope'), null);
  assert.strictEqual(s.getUserByToken(''), null);
  assert.strictEqual(s.getUserByToken(null), null);
});

test('退出后令牌立即失效', function () {
  var s = newStore();
  var u = s.register('packer01', 'secret123').user;
  var token = s.createSession(u.id);
  assert.ok(s.getUserByToken(token));
  assert.strictEqual(s.revokeSession(token), true);
  assert.strictEqual(s.getUserByToken(token), null);
  assert.strictEqual(s.revokeSession(token), false);
});

test('不同账号的令牌互相独立', function () {
  var s = newStore();
  var a = s.register('packerA', 'secret123').user;
  var b = s.register('packerB', 'secret123').user;
  var tokenA = s.createSession(a.id);
  var tokenB = s.createSession(b.id);
  assert.strictEqual(s.getUserByToken(tokenA).username, 'packerA');
  assert.strictEqual(s.getUserByToken(tokenB).username, 'packerB');
  s.revokeSession(tokenA);
  assert.strictEqual(s.getUserByToken(tokenA), null);
  assert.strictEqual(s.getUserByToken(tokenB).username, 'packerB');
});

test('统计信息包含用户数与会话数', function () {
  var s = newStore();
  s.register('packer01', 'secret123');
  var st = s.stats();
  assert.strictEqual(st.users, 1);
  assert.strictEqual(st.sessions, 0);
});

console.log('\n通过 ' + passed + ' 项' + (skipped ? '，跳过 ' + skipped + ' 项' : '') +
  (process.exitCode ? '，存在失败用例' : '，全部通过 ✓') + '\n');
