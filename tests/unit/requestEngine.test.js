'use strict';
process.env.DISCORD_TOKEN = 'test';
process.env.CLIENT_ID = '123';
process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
process.env.BOT_OWNER_IDS = '111';
process.env.NODE_ENV = 'test';
process.env.MAX_RETRIES = '0';
process.env.MAX_REDIRECTS = '2';
const nock = require('nock');
const { buildUrl, buildBody, extractResult, applyEncoding, executeRequest } = require('../../src/services/requestEngine');
afterEach(() => nock.cleanAll());
describe('requestEngine helpers', () => {
  const baseProvider = {
    name: 'test', endpoint: 'https://api.example.com/bypass', http_method: 'GET',
    url_parameter: 'url', encoding_type: 'none', authentication_type: 'none',
    response_format: 'json', response_path: 'data.url', custom_headers: {}
  };
  test('buildUrl GET', () => {
    expect(buildUrl(baseProvider, 'https://target.com')).toContain('url=');
  });
  test('buildBody POST template', () => {
    const p = { ...baseProvider, http_method: 'POST', request_body_template: '{"link":"{{url}}"}' };
    expect(buildBody(p, 'https://t.com').link).toBe('https://t.com');
  });
  test('buildUrl adds query API keys to POST endpoints', () => {
    process.env.TEST_PROVIDER_KEY = 'secret-value';
    const p = { ...baseProvider, http_method: 'POST', authentication_type: 'api_key_query', secret_env_key: 'TEST_PROVIDER_KEY' };
    expect(buildUrl(p, 'https://target.com')).toContain('api_key=secret-value');
  });
  test('extractResult path', () => {
    expect(extractResult(baseProvider, { data: { url: 'https://out.com' } }, 200)).toBe('https://out.com');
  });
  test('extractResult rejects error payload', () => {
    expect(() => extractResult(baseProvider, { error: 'fail', success: false }, 200)).toThrow();
  });
  test('extractResult rejects non-2xx', () => {
    expect(() => extractResult(baseProvider, {}, 500)).toThrow();
  });
  test('extractResult rejects malformed URL-format output', () => {
    expect(() => extractResult({ ...baseProvider, response_format: 'url' }, 'http://', 200)).toThrow();
    expect(() => extractResult({ ...baseProvider, response_format: 'url' }, 'https://user:pass@example.com', 200)).toThrow();
  });
  test('applyEncoding base64url', () => {
    expect(applyEncoding('ab+', 'base64url')).toBe(Buffer.from('ab+', 'utf8').toString('base64url'));
  });
  test('follows a safe redirect and extracts the final result', async () => {
    nock('https://example.com').get('/bypass').query(true).reply(302, '', { Location: 'https://example.org/final' });
    nock('https://example.org').get('/final').reply(200, { data: { url: 'https://out.com' } });
    const outcome = await executeRequest({ ...baseProvider, endpoint: 'https://example.com/bypass' }, 'https://target.com');
    expect(outcome.result).toBe('https://out.com');
  });
  test('blocks a redirect to a private host', async () => {
    nock('https://example.com').get('/bypass').query(true).reply(302, '', { Location: 'http://127.0.0.1/internal' });
    await expect(executeRequest({ ...baseProvider, endpoint: 'https://example.com/bypass' }, 'https://target.com'))
      .rejects.toMatchObject({ name: 'ProviderError' });
  });
});
