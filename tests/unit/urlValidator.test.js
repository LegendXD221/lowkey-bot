'use strict';
const { validateUrl, isValidPublicUrl, isPrivateHost } = require('../../src/security/urlValidator');
const { InvalidUrlError } = require('../../src/utils/errors');
const { normalizeUrl, extractUrls } = require('../../src/utils/formatters');
const { applyEncoding: enc } = require('../../src/services/requestEngine');

describe('urlValidator', () => {
  test('accepts valid https URL', () => {
    const { url } = validateUrl('https://example.com/path?q=1');
    expect(url).toMatch(/^https:\/\/example\.com/);
  });
  test('rejects malformed', () => { expect(() => validateUrl('not-a-url')).toThrow(InvalidUrlError); });
  test('rejects credentials in URL', () => { expect(() => validateUrl('https://user:pass@example.com/')).toThrow(InvalidUrlError); });
  test('rejects private hosts', () => {
    expect(() => validateUrl('http://127.0.0.1/')).toThrow(InvalidUrlError);
    expect(() => validateUrl('http://192.168.1.1/')).toThrow(InvalidUrlError);
    expect(() => validateUrl('http://localhost/')).toThrow(InvalidUrlError);
    expect(() => validateUrl('http://169.254.169.254/latest/meta-data')).toThrow(InvalidUrlError);
    expect(() => validateUrl('http://0.1.2.3/')).toThrow(InvalidUrlError);
    expect(() => validateUrl('http://[::ffff:127.0.0.1]/')).toThrow(InvalidUrlError);
  });
  test('rejects non-http schemes', () => {
    expect(() => validateUrl('ftp://example.com')).toThrow(InvalidUrlError);
  });
  test('isValidPublicUrl', () => {
    expect(isValidPublicUrl('https://google.com')).toBe(true);
    expect(isValidPublicUrl('http://10.0.0.1')).toBe(false);
  });
  test('isPrivateHost', () => {
    expect(isPrivateHost('127.0.0.1')).toBe(true);
    expect(isPrivateHost('example.com')).toBe(false);
  });
});
describe('formatters', () => {
  test('normalizeUrl lowercases host', () => {
    expect(normalizeUrl('HTTPS://Example.COM/Path')).toBe('https://example.com/Path');
  });
  test('extractUrls', () => {
    expect(extractUrls('see https://a.com and https://b.com/x').length).toBe(2);
  });
});
describe('encoding', () => {
  test('url encode', () => { expect(enc('https://a.com?x=1', 'url')).toBe(encodeURIComponent('https://a.com?x=1')); });
  test('base64', () => { expect(enc('hello', 'base64')).toBe(Buffer.from('hello').toString('base64')); });
  test('none', () => { expect(enc('hello', 'none')).toBe('hello'); });
});
describe('routing boundaries', () => {
  const { hostMatchesPatterns } = require('../../src/utils/serviceDetect');
  const { buildUrl } = require('../../src/services/requestEngine');
  test('does not match lookalike domains', () => {
    expect(hostMatchesPatterns('https://notexample.com/a', ['example.com'])).toBe(false);
    expect(hostMatchesPatterns('https://sub.example.com/a', ['example.com'])).toBe(true);
  });
  test('does not double-encode URL encoded GET values', () => {
    const p = { endpoint: 'https://api.example.com/bypass', http_method: 'GET', url_parameter: 'url', encoding_type: 'url', authentication_type: 'none' };
    const built = buildUrl(p, 'https://target.com/a?x=1');
    expect(built).toContain('url=https%3A%2F%2Ftarget.com%2Fa%3Fx%3D1');
    expect(built).not.toContain('%252F');
  });
});
