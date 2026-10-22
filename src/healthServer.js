'use strict';

const http = require('http');

function startHealthServer() {
  let ready = false;
  const startedAt = Date.now();
  const server = http.createServer((req, res) => {
    const path = new URL(req.url || '/', 'http://localhost').pathname;
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

  const port = Number.parseInt(process.env.PORT || '3000', 10);
  server.listen(port, '0.0.0.0');
  return {
    server,
    setReady(value = true) { ready = Boolean(value); },
    stop() { server.close(); }
  };
}

module.exports = { startHealthServer };
