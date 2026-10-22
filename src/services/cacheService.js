'use strict';
const cacheRepo = require('../database/repositories/cache');
async function clearAll() { await cacheRepo.clearCache(); }
async function purgeExpired() { await cacheRepo.purgeExpired(); }
module.exports = { clearAll, purgeExpired };
