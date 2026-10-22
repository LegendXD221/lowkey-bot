'use strict';

const http = require('http');
const { startHealthServer } = require('../../src/healthServer');

function request(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    }).on('error', reject);
  });
}

describe('health server', () => {
  let health;
  beforeEach(async () => {
    process.env.PORT = '0';
    health = startHealthServer();
    await new Promise(resolve => health.server.once('listening', resolve));
  });
  afterEach(async () => {
    if (health?.server.listening) await new Promise(resolve => health.server.close(resolve));
  });
  test('serves liveness and readiness states', async () => {
    const port = health.server.address().port;
    expect((await request(port, '/health')).status).toBe(200);
    expect((await request(port, '/ready')).status).toBe(503);
    health.setReady();
    expect((await request(port, '/ready')).status).toBe(200);
  });
  test('returns 404 for unknown routes', async () => {
    const response = await request(health.server.address().port, '/unknown');
    expect(response.status).toBe(404);
    expect(response.body.ok).toBe(false);
  });
});
