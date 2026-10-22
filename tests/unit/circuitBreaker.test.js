'use strict';
const { classifyHealth, successRate } = require('../../src/database/repositories/metrics');
describe('health classification', () => {
  const env = { HEALTHY_SUCCESS_RATE: 0.85, DEGRADED_SUCCESS_RATE: 0.5 };
  test('healthy', () => {
    expect(classifyHealth({ total_requests: 100, successful_requests: 90, circuit_state: 'closed' }, env)).toBe('HEALTHY');
  });
  test('degraded', () => {
    expect(classifyHealth({ total_requests: 100, successful_requests: 60, circuit_state: 'closed' }, env)).toBe('DEGRADED');
  });
  test('down on open circuit', () => {
    expect(classifyHealth({ total_requests: 100, successful_requests: 95, circuit_state: 'open' }, env)).toBe('DOWN');
  });
  test('successRate', () => {
    expect(successRate({ total_requests: 10, successful_requests: 7 })).toBeCloseTo(0.7);
    expect(successRate(null)).toBe(0);
  });
});
