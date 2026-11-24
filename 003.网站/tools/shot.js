/* ============================================================
 * CDP 截图工具（仅用于本地验证）
 *   node .tmp/shot.js <url> <out.png> <width> <height> [jsBeforeShot]
 * 需要先启动浏览器：msedge --headless=new --remote-debugging-port=9222
 * ============================================================ */
'use strict';

const fs = require('fs');

async function main() {
  const [url, out, width, height, script, portArg] = process.argv.slice(2);
  const w = Number(width) || 390;
  const h = Number(height) || 844;
  const PORT = Number(portArg) || 9222;

  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();

  const send = (method, params) => new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params: params || {} }));
  });

  await new Promise((r) => { ws.onopen = r; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message));
      else p.resolve(msg.result);
    }
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: w, height: h, deviceScaleFactor: 2, mobile: true
  });

  await send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 2500));

  if (script) {
    const outEval = await send('Runtime.evaluate', {
      expression: script, awaitPromise: true, returnByValue: true
    });
    console.log('eval =>', JSON.stringify(outEval.result && outEval.result.value));
    await new Promise((r) => setTimeout(r, 1200));
  }

  const shot = await send('Page.captureScreenshot', { captureBeyondViewport: true, format: 'png' });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('saved', out);

  await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`);
  ws.close();
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
