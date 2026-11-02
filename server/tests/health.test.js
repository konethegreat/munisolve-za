'use strict';

const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers/harness');

describe('health and readiness', () => {
  let h;
  before(async () => { h = await startApp(); });
  after(() => h.close());
  beforeEach(() => { h.reset(); delete h.db.queryRawOverride; });

  test('/health is liveness only and never touches the database', async () => {
    h.db.queryRawOverride = () => { throw new Error('database must not be queried'); };

    const res = await h.api('GET', '/health');

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'Success');
    assert.equal(typeof res.body.uptime, 'number');
    assert.equal(typeof res.body.version, 'string');
  });

  test('/ready reports the database and migrations as current', async () => {
    const res = await h.api('GET', '/ready');

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ready');
    assert.deepEqual(res.body.checks, { database: 'up', migrations: 'current' });
  });

  test('/ready returns 503 when the database is down', async () => {
    h.db.queryRawOverride = () => { throw new Error('connection refused'); };

    const res = await h.api('GET', '/ready');

    assert.equal(res.status, 503);
    assert.equal(res.body.checks.database, 'down');
  });

  test('/ready returns 503 when a migration is unfinished', async () => {
    h.db.queryRawOverride = (strings) => {
      const sql = strings.join('');
      return sql.includes('_prisma_migrations') ? [{ failed: 1 }] : [{ ok: 1 }];
    };

    const res = await h.api('GET', '/ready');

    assert.equal(res.status, 503);
    assert.equal(res.body.checks.database, 'up');
    assert.equal(res.body.checks.migrations, 'pending');
  });
});
