'use strict';

const http = require('http');

function startHealthServer() {
  let ready = false;
  const startedAt = Date.now();
  const server = http.createServer((req, res) => {
    let path;
    try { path = new URL(req.url || '/', 'http://localhost').pathname; } catch (_) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Invalid request target' }));
      return;
    }
    if (path !== '/health' && path !== '/ready') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Not found' }));
      return;
    }

    const isReady = ready;
    const payload = {
      ok: path === '/health' ? true : isReady,
      service: 'lowkey',
      status: isReady ? 'ready' : 'starting',
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000)
    };
    res.writeHead(path === '/ready' && !isReady ? 503 : 200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify(payload));
  });
  server.on('error', (err) => {
    console.error('Health server failed:', err.message);
    process.exitCode = 1;
    setImmediate(() => process.exit(1));
  });

  const port = Number.parseInt(process.env.PORT || '3000', 10);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }
  server.listen(port, '0.0.0.0');
  return {
    server,
    setReady(value = true) { ready = Boolean(value); },
    stop() { server.close(); }
  };
}

module.exports = { startHealthServer };
