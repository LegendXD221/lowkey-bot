'use strict';
process.env.DISCORD_TOKEN = 'test';
process.env.CLIENT_ID = '123';
process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
process.env.BOT_OWNER_IDS = '111,222';
const { isOwner } = require('../../src/security/ownerGuard');
describe('ownerGuard', () => {
  test('recognizes owners', () => {
    expect(isOwner('111')).toBe(true);
    expect(isOwner('222')).toBe(true);
  });
  test('rejects non-owners', () => { expect(isOwner('999')).toBe(false); });
});
