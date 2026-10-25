'use strict';
const { isPrivateIp } = require('../../src/security/ssrfProtection');
describe('ssrf isPrivateIp', () => {
  test('private v4', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('169.254.169.254')).toBe(true);
  });
  test('public v4', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
  });
  test('reserved and multicast v4', () => {
    expect(isPrivateIp('198.18.0.1')).toBe(true);
    expect(isPrivateIp('224.0.0.1')).toBe(true);
  });
  test('private v6', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('fe80::1')).toBe(true);
    expect(isPrivateIp('ff02::1')).toBe(true);
    expect(isPrivateIp('2001:db8::1')).toBe(true);
    expect(isPrivateIp('0:0:0:0:0:ffff:7f00:1')).toBe(true);
  });
});
