'use strict';

const queues = new Map(); // providerId -> { active, max, waiters }

function getSlot(providerId, max = 3) {
  let q = queues.get(providerId);
  if (!q) {
    q = { active: 0, max, waiters: [] };
    queues.set(providerId, q);
  }
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (q.active < q.max) {
        q.active++;
        resolve(() => {
          q.active--;
          const next = q.waiters.shift();
          if (next) next();
        });
        return true;
      }
      return false;
    };
    if (!tryAcquire()) q.waiters.push(tryAcquire);
  });
}

async function withLimit(providerId, max, fn) {
  const release = await getSlot(providerId, max);
  try {
    return await fn();
  } finally {
    release();
  }
}

module.exports = { withLimit };
