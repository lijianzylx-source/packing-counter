/* ============================================================
 * 业务纯逻辑测试：node test/core.test.js [名称关键字]
 * 覆盖 PRD v1.0.1 §5 业务规则与 §11 验收清单
 * ============================================================ */
'use strict';

var assert = require('assert');
var path = require('path');
var Core = require(path.join(__dirname, '..', 'assets', 'js', 'core.js'));

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

console.log('\n业务逻辑测试\n');

/* ---------- 收入计算（PRD §5.1） ---------- */

test('收入 = 件数 × 单价（100 件 → ¥150.00）', function () {
  assert.strictEqual(Core.round2(100 * 1.5), 150);
  assert.strictEqual(Core.formatMoney(150), '¥150.00');
});

test('单价 2.0 元时 100 件 → ¥200.00', function () {
  assert.strictEqual(Core.formatMoney(Core.round2(100 * 2)), '¥200.00');
});

test('金额格式化保留两位小数并加千分位', function () {
  assert.strictEqual(Core.formatMoney(1234.5), '¥1,234.50');
  assert.strictEqual(Core.formatMoney(0), '¥0.00');
  assert.strictEqual(Core.formatCount(4320), '4,320');
});

/* ---------- 件数校验（PRD §5.2） ---------- */

test('件数：0 与正整数合法，负数/小数/非数字非法', function () {
  assert.strictEqual(Core.isValidCount(0), true);
  assert.strictEqual(Core.isValidCount(280), true);
  assert.strictEqual(Core.isValidCount(-1), false);
  assert.strictEqual(Core.isValidCount(1.5), false);
  assert.strictEqual(Core.isValidCount(''), false);
  assert.strictEqual(Core.isValidCount('abc'), false);
});

/* ---------- 记录唯一性（PRD §5.3） ---------- */

test('同一天重复保存覆盖原记录，不产生重复', function () {
  var r1 = Core.upsertRecord([], { date: '2026-10-30', count: 280, note: '加班' }, 1.5);
  assert.strictEqual(r1.isNew, true);
  assert.strictEqual(r1.records.length, 1);

  var r2 = Core.upsertRecord(r1.records, { date: '2026-10-30', count: 300, note: '' }, 1.5);
  assert.strictEqual(r2.isNew, false);
  assert.strictEqual(r2.records.length, 1);
  assert.strictEqual(r2.record.count, 300);
  assert.strictEqual(r2.record.note, '');
  assert.strictEqual(r2.record.income, 450);
  assert.strictEqual(r2.record.createdAt, r1.record.createdAt, '覆盖时保留创建时间');
});

test('删除记录后月统计实时减少', function () {
  var recs = Core.upsertRecord([], { date: '2026-10-01', count: 10 }, 1.5).records;
  recs = Core.upsertRecord(recs, { date: '2026-10-02', count: 20 }, 1.5).records;
  var before = Core.computeMonthStats(recs, '2026-10', 1.5, '2026-10-05');
  assert.strictEqual(before.totalCount, 30);

  recs = Core.removeRecord(recs, '2026-10-01');
  var after = Core.computeMonthStats(recs, '2026-10', 1.5, '2026-10-05');
  assert.strictEqual(after.totalCount, 20);
  assert.strictEqual(after.totalIncome, 30);
  assert.strictEqual(after.recordedDays, 1);
});

test('备注超过 100 字被截断', function () {
  var r = Core.upsertRecord([], { date: '2026-10-01', count: 1, note: 'x'.repeat(150) }, 1.5);
  assert.strictEqual(r.record.note.length, 100);
});

/* ---------- 单价调整重算（PRD §5.5） ---------- */

test('改单价后所有历史记录收入同步重算', function () {
  var recs = Core.upsertRecord([], { date: '2026-10-01', count: 100 }, 1.5).records;
  recs = Core.upsertRecord(recs, { date: '2026-10-02', count: 50 }, 1.5).records;
  recs = Core.repriceRecords(recs, 2);
  var total = recs.reduce(function (s, r) { return s + r.income; }, 0);
  assert.strictEqual(total, 300);
});

/* ---------- 统计口径（PRD §5.4） ---------- */

test('未记录日期不计入工作天数，但计入未记录天数', function () {
  var recs = Core.upsertRecord([], { date: '2026-10-01', count: 10 }, 1.5).records;
  recs = Core.upsertRecord(recs, { date: '2026-10-03', count: 0 }, 1.5).records;
  var s = Core.computeMonthStats(recs, '2026-10', 1.5, '2026-10-05');
  assert.strictEqual(s.recordedDays, 2);
  assert.strictEqual(s.zeroDays, 1);
  assert.strictEqual(s.missingDays, 3);
  assert.strictEqual(s.totalCount, 10);
  assert.strictEqual(s.totalIncome, 15);
  assert.strictEqual(s.avgCount, 5);
});

test('日均按有记录天数计算，最高单日可追溯到日期', function () {
  var recs = Core.upsertRecord([], { date: '2026-10-01', count: 10 }, 1.5).records;
  recs = Core.upsertRecord(recs, { date: '2026-10-02', count: 40 }, 1.5).records;
  var s = Core.computeMonthStats(recs, '2026-10', 1.5, '2026-10-05');
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

/* ---------- 首页日期恒为当天（PRD §5.12） ---------- */

test('首页日期恒为当天，不可选择', function () {
  assert.strictEqual(Core.todayKey(), Core.toDateKey(new Date()));
  assert.strictEqual(Core.isFutureDate(Core.shiftDate(Core.todayKey(), 1)), true);
  assert.strictEqual(Core.isFutureDate(Core.todayKey()), false);
  assert.strictEqual(Core.isFutureDate(Core.shiftDate(Core.todayKey(), -1)), false);
});

/* ---------- 补录序列（PRD F-003） ---------- */

test('最近 N 天序列中未记录日期 count 为 null（不画柱）', function () {
  var recs = Core.upsertRecord([], { date: '2026-10-04', count: 10 }, 1.5).records;
  var series = Core.recentSeries(recs, '2026-10-05', 3, 1.5);
  assert.strictEqual(series.length, 3);
  assert.strictEqual(series[0].date, '2026-10-03');
  assert.strictEqual(series[0].count, null);
  assert.strictEqual(series[1].count, 10);
  assert.strictEqual(series[1].income, 15);
  assert.strictEqual(series[2].count, null);
});

/* ---------- 筛选（PRD F-010） ---------- */

test('按关键词与日期范围筛选历史记录', function () {
  var recs = Core.upsertRecord([], { date: '2026-10-01', count: 10, note: '加班' }, 1.5).records;
  recs = Core.upsertRecord(recs, { date: '2026-10-05', count: 20, note: '请假' }, 1.5).records;
  recs = Core.upsertRecord(recs, { date: '2026-10-09', count: 30, note: '' }, 1.5).records;
  assert.strictEqual(Core.filterRecords(recs, { keyword: '加班' }).length, 1);
  var ranged = Core.filterRecords(recs, { from: '2026-10-02', to: '2026-10-08' });
  assert.strictEqual(ranged.length, 1);
  assert.strictEqual(ranged[0].date, '2026-10-05');
});

/* ---------- 导出（PRD F-011） ---------- */

test('CSV 导出含 BOM、表头与正确金额', function () {
  var recs = Core.upsertRecord([], { date: '2026-10-01', count: 100, note: '加班, 加急' }, 1.5).records;
  var csv = Core.toCSV(recs, 1.5);
  assert.ok(csv.charCodeAt(0) === 0xFEFF, '应包含 BOM');
  assert.ok(csv.indexOf('日期,件数,单价(元),收入(元),备注') >= 0);
  assert.ok(csv.indexOf('2026-10-01,100,1.50,150.00') >= 0);
  assert.ok(csv.indexOf('"加班, 加急"') >= 0, '含逗号的备注需转义');
});

/* ---------- 账号规则（PRD §5.6 ~ §5.7） ---------- */

test('用户名：2–20 位，允许中英文数字下划线短横线', function () {
  assert.strictEqual(Core.isValidUsername('packer01'), true);
  assert.strictEqual(Core.isValidUsername('打包员'), true);
  assert.strictEqual(Core.isValidUsername('a_b-c'), true);
  assert.strictEqual(Core.isValidUsername('a'), false);
  assert.strictEqual(Core.isValidUsername('a'.repeat(21)), false);
  assert.strictEqual(Core.isValidUsername('has space'), false);
  assert.strictEqual(Core.isValidUsername(''), false);
});

test('密码：6–72 位', function () {
  assert.strictEqual(Core.isValidPassword('123456'), true);
  assert.strictEqual(Core.isValidPassword('12345'), false);
  assert.strictEqual(Core.isValidPassword('x'.repeat(73)), false);
});

/* ---------- 接口基址推导（F-019，手机访问关键） ---------- */

test('接口基址：用户设置优先', function () {
  assert.strictEqual(Core.resolveApiBase({ saved: 'http://192.168.43.87:5173' }), 'http://192.168.43.87:5173');
  assert.strictEqual(Core.resolveApiBase({ saved: 'http://a.com:8080/' }), 'http://a.com:8080');
});

test('接口基址：手机访问时按当前主机名推导，而不是 localhost', function () {
  // 手机打开 http://192.168.43.87:5174 → 接口必须是 192.168.43.87:5173
  assert.strictEqual(
    Core.resolveApiBase({ protocol: 'http:', hostname: '192.168.43.87', port: '5174', apiPort: 5173 }),
    'http://192.168.43.87:5173'
  );
  // 电脑上打开 http://localhost:5174 → 同理
  assert.strictEqual(
    Core.resolveApiBase({ protocol: 'http:', hostname: 'localhost', port: '5174', apiPort: 5173 }),
    'http://localhost:5173'
  );
});

test('接口基址：与接口同端口时用同源相对路径', function () {
  assert.strictEqual(
    Core.resolveApiBase({ protocol: 'http:', hostname: '192.168.43.87', port: '5173', apiPort: 5173 }),
    ''
  );
});

test('接口基址：file:// 打开时回退到默认绝对地址', function () {
  assert.strictEqual(
    Core.resolveApiBase({ protocol: 'file:', hostname: '', port: '', apiPort: 5173, defaultApiBase: 'http://localhost:5173' }),
    'http://localhost:5173'
  );
});

test('接口基址：手机上遗留的 localhost 保存值会被忽略（自愈）', function () {
  // 手机上打开 192.168.43.87:5174，之前误存了 localhost:5173 → 应按当前主机名推导
  assert.strictEqual(
    Core.resolveApiBase({ saved: 'http://localhost:5173', protocol: 'http:', hostname: '192.168.43.87', port: '5174', apiPort: 5173 }),
    'http://192.168.43.87:5173'
  );
  // 电脑上访问时，保存的 localhost 仍然有效
  assert.strictEqual(
    Core.resolveApiBase({ saved: 'http://localhost:5173', protocol: 'http:', hostname: 'localhost', port: '5174', apiPort: 5173 }),
    'http://localhost:5173'
  );
  // 明确指向别的地址时照用
  assert.strictEqual(
    Core.resolveApiBase({ saved: 'http://192.168.9.9:5173', protocol: 'http:', hostname: '192.168.43.87', port: '5174', apiPort: 5173 }),
    'http://192.168.9.9:5173'
  );
});

/* ---------- 月份切换 ---------- */

test('月份加减跨年正确', function () {
  assert.strictEqual(Core.shiftMonth('2026-01', -1), '2025-12');
  assert.strictEqual(Core.shiftMonth('2026-12', 1), '2027-01');
  assert.strictEqual(Core.shiftMonth('2026-10', 1), '2026-11');
});

console.log('\n通过 ' + passed + ' 项' + (skipped ? '，跳过 ' + skipped + ' 项' : '') +
  (process.exitCode ? '，存在失败用例' : '，全部通过 ✓') + '\n');
