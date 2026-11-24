/* ============================================================
 * 核心逻辑测试：node test/core.test.js [名称关键字]
 * 覆盖 PRD 第 11 章「快速验收清单」及业务规则
 * 可选参数为子串过滤，只运行名称匹配的用例
 * ============================================================ */
'use strict';

var assert = require('assert');
var path = require('path');
var Core = require(path.join(__dirname, '..', 'assets', 'core.js'));

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

function memoryBackend() {
  var map = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
    setItem: function (k, v) { map[k] = String(v); },
    removeItem: function (k) { delete map[k]; }
  };
}

console.log('\n核心逻辑测试\n');

/* --- 业务规则 1：收入公式 --- */
test('收入 = 件数 × 单价（100 件 → ¥150.00）', function () {
  var store = Core.createStore(memoryBackend());
  var r = store.upsert('2026-10-01', 100, '');
  assert.strictEqual(r.record.income, 150);
  assert.strictEqual(Core.formatMoney(r.record.income), '¥150.00');
});

test('单价 2.0 元时 100 件 → ¥200.00', function () {
  var store = Core.createStore(memoryBackend());
  store.setUnitPrice(2);
  var r = store.upsert('2026-10-01', 100, '');
  assert.strictEqual(r.record.income, 200);
});

/* --- 业务规则 5：改单价重算历史 --- */
test('修改单价后历史记录收入同步重算', function () {
  var store = Core.createStore(memoryBackend());
  store.upsert('2026-10-01', 100, '');
  store.upsert('2026-10-02', 50, '');
  store.setUnitPrice(2);
  var records = store.getRecords();
  var total = records.reduce(function (s, r) { return s + r.income; }, 0);
  assert.strictEqual(total, 300); // 100×2 + 50×2
  assert.strictEqual(store.getSettings().unitPrice, 2);
});

/* --- 业务规则 3：一天一条记录 --- */
test('同一天重复保存覆盖原记录，不产生重复', function () {
  var store = Core.createStore(memoryBackend());
  store.upsert('2026-10-01', 10, '第一次');
  var res = store.upsert('2026-10-01', 30, '第二次');
  assert.strictEqual(store.getRecords().length, 1);
  assert.strictEqual(res.isNew, false);
  assert.strictEqual(res.record.count, 30);
  assert.strictEqual(res.record.note, '第二次');
  assert.strictEqual(res.record.income, 45);
});

test('删除记录后月统计实时减少', function () {
  var store = Core.createStore(memoryBackend());
  store.upsert('2026-10-01', 10, '');
  store.upsert('2026-10-02', 20, '');
  var before = Core.computeMonthStats(store.getRecords(), '2026-10', 1.5, '2026-10-05');
  assert.strictEqual(before.totalCount, 30);
  store.remove('2026-10-01');
  var after = Core.computeMonthStats(store.getRecords(), '2026-10', 1.5, '2026-10-05');
  assert.strictEqual(after.totalCount, 20);
  assert.strictEqual(after.totalIncome, 30);
  assert.strictEqual(after.recordedDays, 1);
});

/* --- 业务规则 2 / 4：件数与统计口径 --- */
test('件数校验：负数、小数、非数字均不合法', function () {
  assert.strictEqual(Core.isValidCount(0), true);
  assert.strictEqual(Core.isValidCount(120), true);
  assert.strictEqual(Core.isValidCount(-1), false);
  assert.strictEqual(Core.isValidCount(1.5), false);
  assert.strictEqual(Core.isValidCount('abc'), false);
  assert.strictEqual(Core.isValidCount(''), false);
});

test('未记录日期不计入工作天数，但计入未记录天数', function () {
  var store = Core.createStore(memoryBackend());
  store.upsert('2026-10-01', 10, '');
  store.upsert('2026-10-03', 0, '请假');   // 0 件仍算作「有记录」
  var s = Core.computeMonthStats(store.getRecords(), '2026-10', 1.5, '2026-10-05');
  assert.strictEqual(s.recordedDays, 2);
  assert.strictEqual(s.zeroDays, 1);
  assert.strictEqual(s.daysElapsed, 5);
  assert.strictEqual(s.missingDays, 3);
  assert.strictEqual(s.totalCount, 10);
  assert.strictEqual(s.totalIncome, 15);
  assert.strictEqual(s.avgCount, 5);
});

test('日均按有记录天数计算，最高单日可追溯到日期', function () {
  var store = Core.createStore(memoryBackend());
  store.upsert('2026-10-01', 10, '');
  store.upsert('2026-10-02', 40, '');
  var s = Core.computeMonthStats(store.getRecords(), '2026-10', 1.5, '2026-10-05');
  assert.strictEqual(s.avgCount, 25);
  assert.strictEqual(s.bestCount, 40);
  assert.strictEqual(s.bestDate, '2026-10-02');
  assert.strictEqual(s.bestIncome, 60);
});

test('过去月份按整月天数计算未记录天数', function () {
  var s = Core.computeMonthStats([], '2026-09', 1.5, '2026-10-05');
  assert.strictEqual(s.daysElapsed, 30);
  assert.strictEqual(s.missingDays, 30);
});

/* --- 单价校验 --- */
test('单价范围校验 0.01 – 100', function () {
  var store = Core.createStore(memoryBackend());
  assert.strictEqual(Core.isValidUnitPrice(0), false);
  assert.strictEqual(Core.isValidUnitPrice(0.01), true);
  assert.strictEqual(Core.isValidUnitPrice(1.5), true);
  assert.strictEqual(Core.isValidUnitPrice(100), true);
  assert.strictEqual(Core.isValidUnitPrice(100.01), false);
  assert.strictEqual(store.setUnitPrice(0), null);
  assert.strictEqual(store.getSettings().unitPrice, 1.5);
});

/* --- 备注长度 --- */
test('备注超过 100 字被截断', function () {
  var store = Core.createStore(memoryBackend());
  var r = store.upsert('2026-10-01', 1, 'x'.repeat(150));
  assert.strictEqual(r.record.note.length, 100);
});

/* --- 导出 --- */
test('CSV 导出含 BOM、表头与正确金额', function () {
  var store = Core.createStore(memoryBackend());
  store.upsert('2026-10-01', 100, '加班, 加急');
  var csv = Core.toCSV(store.getRecords(), 1.5);
  assert.ok(csv.charCodeAt(0) === 0xFEFF, '应包含 BOM');
  assert.ok(csv.indexOf('日期,件数,单价(元),收入(元),备注') >= 0);
  assert.ok(csv.indexOf('2026-10-01,100,1.50,150.00') >= 0);
  assert.ok(csv.indexOf('"加班, 加急"') >= 0, '含逗号的备注需转义');
});

/* --- 备份与恢复 --- */
test('备份可完整恢复记录与设置', function () {
  var a = Core.createStore(memoryBackend());
  a.setUnitPrice(2);
  a.upsert('2026-10-01', 10, '甲');
  a.upsert('2026-10-02', 20, '乙');
  var json = a.exportBackup();

  var b = Core.createStore(memoryBackend());
  var count = b.importBackup(json);
  assert.strictEqual(count, 2);
  assert.strictEqual(b.getSettings().unitPrice, 2);
  var records = b.getRecords();
  assert.strictEqual(records.length, 2);
  // 记录按日期倒序存放（历史列表默认倒序）
  assert.strictEqual(records[0].date, '2026-10-02');
  assert.strictEqual(records[0].income, 40);
  assert.strictEqual(records[1].date, '2026-10-01');
  assert.strictEqual(records[1].income, 20);
  assert.strictEqual(records[1].note, '甲');
});

test('恢复损坏的备份文件抛错', function () {
  var store = Core.createStore(memoryBackend());
  assert.throws(function () { store.importBackup('{"foo":1}'); });
});

/* --- 最近 N 天序列 --- */
test('最近 N 天序列中未记录日期 count 为 null', function () {
  var store = Core.createStore(memoryBackend());
  store.upsert('2026-10-04', 10, '');
  var series = Core.recentSeries(store.getRecords(), '2026-10-05', 3, 1.5);
  assert.strictEqual(series.length, 3);
  assert.strictEqual(series[0].date, '2026-10-03');
  assert.strictEqual(series[0].count, null);
  assert.strictEqual(series[1].count, 10);
  assert.strictEqual(series[1].income, 15);
  assert.strictEqual(series[2].count, null);
});

/* --- 筛选 --- */
test('按关键词与日期范围筛选历史记录', function () {
  var store = Core.createStore(memoryBackend());
  store.upsert('2026-10-01', 10, '加班');
  store.upsert('2026-10-05', 20, '请假');
  store.upsert('2026-10-09', 30, '正常');
  var byKeyword = Core.filterRecords(store.getRecords(), { keyword: '加班' });
  assert.strictEqual(byKeyword.length, 1);
  var byRange = Core.filterRecords(store.getRecords(), { from: '2026-10-02', to: '2026-10-08' });
  assert.strictEqual(byRange.length, 1);
  assert.strictEqual(byRange[0].date, '2026-10-05');
});

/* --- 存储持久化 --- */
test('设置与记录写入同一后端并可重新读取', function () {
  var backend = memoryBackend();
  var a = Core.createStore(backend);
  a.upsert('2026-10-01', 8, '测试');
  var b = Core.createStore(backend);
  assert.strictEqual(b.getRecords().length, 1);
  assert.strictEqual(b.getRecords()[0].count, 8);
  assert.strictEqual(b.getSettings().unitPrice, 1.5);
});

/* --- 接口地址解析（v1.0.1 修：file:// 下相对路径不可用） --- */

test('接口基址：用户设置优先，去掉结尾斜杠', function () {
  assert.strictEqual(Core.resolveApiBase({ saved: 'http://192.168.1.8:5173' }), 'http://192.168.1.8:5173');
  assert.strictEqual(Core.resolveApiBase({ saved: 'http://192.168.1.8:5173/' }), 'http://192.168.1.8:5173');
  assert.strictEqual(Core.resolveApiBase({ saved: '  http://a.com  ' }), 'http://a.com');
});

test('接口基址：file:// 下回退到绝对地址，同源时为空串', function () {
  assert.strictEqual(Core.resolveApiBase({ protocol: 'file:' }), 'http://localhost:5173');
  assert.strictEqual(Core.resolveApiBase({ protocol: 'http:' }), '');
  assert.strictEqual(Core.resolveApiBase({ protocol: 'https:' }), '');
  assert.strictEqual(Core.resolveApiBase({ protocol: 'file:', defaultBase: 'http://x:1' }), 'http://x:1');
});

console.log('\n通过 ' + passed + ' 项' + (skipped ? '，跳过 ' + skipped + ' 项' : '') +
  (process.exitCode ? '，存在失败用例' : '，全部通过 ✓') + '\n');
