/* ============================================================
 * 极简静态服务器 + 账号 API（零依赖）
 *   node server.js [port]
 *   静态：/            → 003.网站/
 *   接口：/api/register /api/login /api/logout /api/me
 * 账号数据存于 003.网站/data/users.json（不可通过 HTTP 访问）
 * ============================================================ */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');
var auth = require('./auth.js');

var ROOT = __dirname;
var PORT = Number(process.argv[2]) || 5173;
var DATA_DIR = path.join(ROOT, 'data');
var USERS_FILE = path.join(DATA_DIR, 'users.json');

var authStore = auth.createAuthStore({ file: USERS_FILE });

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.csv': 'text/csv; charset=utf-8'
};

/* 静态资源白名单黑名单：账号数据、服务端代码与临时目录不对外暴露 */
var BLOCKED = ['/data', '/.tmp', '/__verify', '/node_modules', '/test', '/tools', '/.git',
  '/auth.js', '/server.js'];

var CSP = "default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; " +
  "connect-src 'self'; " +
  "form-action 'self'; " +
  "base-uri 'none'; " +
  "frame-ancestors 'none'";

function baseHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': CSP
  };
}

/* 跨源访问：页面可能以 file:// 打开，或从另一台设备访问局域网地址。
   接口用 Bearer 令牌而非 Cookie，跨源无法读取他人数据。 */
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    // 允许从 file:// 或公网页面访问本机服务（Chrome Private Network Access）
    'Access-Control-Allow-Private-Network': 'true'
  };
}

function sendJSON(res, status, obj) {
  var body = JSON.stringify(obj);
  var headers = baseHeaders();
  headers['Content-Type'] = 'application/json; charset=utf-8';
  headers['Content-Length'] = Buffer.byteLength(body);
  headers['Cache-Control'] = 'no-store';
  Object.keys(corsHeaders()).forEach(function (k) { headers[k] = corsHeaders()[k]; });
  res.writeHead(status, headers);
  res.end(body);
}

function readBody(req, limit) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    var size = 0;
    req.on('data', function (c) {
      size += c.length;
      if (size > limit) { reject(new Error('BODY_TOO_LARGE')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', reject);
  });
}

function bearerToken(req) {
  var h = req.headers['authorization'] || '';
  var m = /^Bearer\s+(.+)$/i.exec(String(h).trim());
  return m ? m[1].trim() : null;
}

/* ---------------- API ---------------- */

async function handleAPI(req, res, pathname) {
  if (req.method === 'POST' && pathname === '/api/register') {
    var raw;
    try { raw = await readBody(req, 8192); } catch (e) { return sendJSON(res, 413, { ok: false, message: '请求体过大' }); }
    var data;
    try { data = JSON.parse(raw || '{}'); } catch (e) { return sendJSON(res, 400, { ok: false, message: '请求格式错误' }); }

    var result = authStore.register(data.username, data.password);
    if (!result.ok) return sendJSON(res, 400, { ok: false, code: result.code, message: result.message });

    var token = authStore.createSession(result.user.id);
    return sendJSON(res, 201, { ok: true, token: token, user: result.user });
  }

  if (req.method === 'POST' && pathname === '/api/login') {
    var raw2;
    try { raw2 = await readBody(req, 8192); } catch (e) { return sendJSON(res, 413, { ok: false, message: '请求体过大' }); }
    var data2;
    try { data2 = JSON.parse(raw2 || '{}'); } catch (e) { return sendJSON(res, 400, { ok: false, message: '请求格式错误' }); }

    var res2 = authStore.authenticate(data2.username, data2.password);
    if (!res2.ok) {
      var status = res2.code === 'LOCKED' ? 429 : 401;
      return sendJSON(res, status, { ok: false, code: res2.code, message: res2.message });
    }
    var token2 = authStore.createSession(res2.user.id);
    return sendJSON(res, 200, { ok: true, token: token2, user: res2.user });
  }

  if (req.method === 'POST' && pathname === '/api/logout') {
    var t = bearerToken(req);
    authStore.revokeSession(t);
    return sendJSON(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/me') {
    var t2 = bearerToken(req);
    var user = authStore.getUserByToken(t2);
    if (!user) return sendJSON(res, 401, { ok: false, code: 'UNAUTHORIZED', message: '登录已失效，请重新登录' });
    return sendJSON(res, 200, { ok: true, user: user });
  }

  return sendJSON(res, 404, { ok: false, message: '接口不存在' });
}

/* ---------------- 静态文件 ---------------- */

function serveStatic(res, pathname) {
  if (pathname === '/') pathname = '/index.html';

  var blocked = BLOCKED.some(function (p) {
    return pathname === p || pathname.indexOf(p + '/') === 0;
  });
  if (blocked) {
    res.writeHead(403, Object.assign(baseHeaders(), { 'Content-Type': 'text/plain; charset=utf-8' }));
    res.end('403 Forbidden');
    return;
  }

  var filePath = path.join(ROOT, path.normalize(pathname).replace(/^(\.\.[/\\])+/, ''));
  if (filePath.indexOf(ROOT) !== 0) {
    res.writeHead(403, Object.assign(baseHeaders(), { 'Content-Type': 'text/plain; charset=utf-8' }));
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, function (err, stat) {
    if (err || !stat.isFile()) {
      res.writeHead(404, Object.assign(baseHeaders(), { 'Content-Type': 'text/plain; charset=utf-8' }));
      res.end('404 Not Found: ' + pathname);
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    var headers = baseHeaders();
    headers['Content-Type'] = MIME[ext] || 'application/octet-stream';
    headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
}

var server = http.createServer(function (req, res) {
  var pathname = decodeURIComponent(url.parse(req.url).pathname);

  if (pathname.indexOf('/api/') === 0) {
    // CORS 预检
    if (req.method === 'OPTIONS') {
      var ph = baseHeaders();
      Object.keys(corsHeaders()).forEach(function (k) { ph[k] = corsHeaders()[k]; });
      ph['Content-Length'] = '0';
      res.writeHead(204, ph);
      res.end();
      return;
    }
    handleAPI(req, res, pathname).catch(function (err) {
      sendJSON(res, 500, { ok: false, message: '服务器内部错误：' + err.message });
    });
    return;
  }
  serveStatic(res, pathname);
});

function lanAddresses() {
  var os = require('os');
  var list = [];
  var ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach(function (name) {
    (ifaces[name] || []).forEach(function (i) {
      if (i.family === 'IPv4' && !i.internal) list.push(i.address);
    });
  });
  return list;
}

server.on('error', function (err) {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error('  ERROR: port ' + PORT + ' is already in use.  [端口 ' + PORT + ' 已被占用]');
    console.error('  Close the program using it, or start on another port:');
    console.error('      node server.js ' + (PORT + 1));
    console.error('');
  } else {
    console.error('  Server error: ' + err.message);
  }
  process.exit(1);
});

function openBrowser(url) {
  var cmd = process.platform === 'win32' ? 'start "" "' + url + '"'
    : process.platform === 'darwin' ? 'open "' + url + '"'
      : 'xdg-open "' + url + '"';
  try {
    require('child_process').exec(cmd, function () { /* 打不开也不影响服务 */ });
  } catch (e) { /* ignore */ }
}

server.listen(PORT, function () {
  var lines = [
    '',
    '  Pack Counting Assistant  v1.1.0',
    '  ---------------------------------------------',
    '  Local:      http://localhost:' + PORT
  ];
  lanAddresses().forEach(function (ip) {
    lines.push('  LAN:        http://' + ip + ':' + PORT + '   <- open this on your phone');
  });
  lines.push('  Users file: ./data/users.json');
  lines.push('  ---------------------------------------------');
  lines.push('  Keep this window OPEN - closing it stops the server.');
  lines.push('  If the page will not open:');
  lines.push('    1) check the server is still running (no error above)');
  lines.push('    2) if a proxy/VPN is on, add localhost & 127.0.0.1 to its bypass list');
  lines.push('    3) try http://127.0.0.1:' + PORT + ' instead of localhost');
  lines.push('  Press Ctrl+C to stop');
  lines.push('');
  // 控制台默认代码页可能不是 UTF-8，用 ASCII 输出避免乱码
  console.log(lines.join('\n'));

  if (process.argv.indexOf('--open') >= 0) openBrowser('http://localhost:' + PORT);
});
