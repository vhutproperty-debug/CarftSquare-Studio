/**
 * Auth/Mongo cold-start guards. No database required.
 * Run: yarn test:auth-db
 */
import assert from 'node:assert/strict';
import { AsyncTimeoutError } from '../lib/auth/async-timeout';
import {
  AUTH_DB_TIMEOUT_MS,
  AUTH_ROUTE_TIMEOUT_MS,
  isTransientAuthDbError,
  withAuthDbRetry,
} from '../lib/auth/auth-db-retry';
import { AUTH_STATUS_CODES } from '../lib/auth/auth-status-types';
import {
  fetchAuthStatusWithRetry,
  unavailableAuthStatus,
} from '../lib/auth/fetch-auth-status';
import { MONGO_CLIENT_OPTIONS } from '../lib/mongodb';
import {
  createMongoConnectionCache,
  getMongoConnectionCache,
} from '../lib/mongo-client-cache';

function silenceErrors<T>(run: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = () => undefined;
  return run().finally(() => {
    console.error = original;
  });
}

async function main() {
  assert.equal(MONGO_CLIENT_OPTIONS.serverSelectionTimeoutMS, 5000);
  assert.ok(MONGO_CLIENT_OPTIONS.connectTimeoutMS >= 5000);
  assert.ok(MONGO_CLIENT_OPTIONS.maxIdleTimeMS >= 60_000);
  assert.ok(MONGO_CLIENT_OPTIONS.maxPoolSize > 0 && MONGO_CLIENT_OPTIONS.maxPoolSize <= 20);
  assert.equal(AUTH_DB_TIMEOUT_MS, 12_000);
  assert.ok(
    AUTH_DB_TIMEOUT_MS > MONGO_CLIENT_OPTIONS.serverSelectionTimeoutMS,
    'auth timeout must outlast server selection',
  );
  assert.ok(AUTH_ROUTE_TIMEOUT_MS > AUTH_DB_TIMEOUT_MS * 2);
  assert.ok(AUTH_ROUTE_TIMEOUT_MS < 30_000, 'auth HTTP handlers must return before 30s');

  assert.equal(isTransientAuthDbError(new AsyncTimeoutError('getDb timed out after 12000ms')), true);
  assert.equal(isTransientAuthDbError(new Error('connect ECONNREFUSED 10.0.0.1:27017')), true);
  assert.equal(isTransientAuthDbError(new Error('MongoServerSelectionError: server selection timed out')), true);
  assert.equal(isTransientAuthDbError(new Error('Invalid admin credentials.')), false);
  assert.equal(isTransientAuthDbError(new Error('authentication failed')), false);

  {
    let calls = 0;
    const value = await withAuthDbRetry(async () => {
      calls += 1;
      return 'ready';
    }, 'once', 200);
    assert.equal(value, 'ready');
    assert.equal(calls, 1);
  }

  await silenceErrors(async () => {
    let calls = 0;
    const value = await withAuthDbRetry(async () => {
      calls += 1;
      if (calls === 1) throw new AsyncTimeoutError('getDb timed out after 12000ms');
      return 'warm';
    }, 'retry-timeout', 200);
    assert.equal(value, 'warm');
    assert.equal(calls, 2);
  });

  await silenceErrors(async () => {
    let calls = 0;
    const value = await withAuthDbRetry(async () => {
      calls += 1;
      if (calls === 1) throw new Error('MongoNetworkError: connection closed');
      return 'reconnected';
    }, 'retry-network', 200);
    assert.equal(value, 'reconnected');
    assert.equal(calls, 2);
  });

  await assert.rejects(
    () => withAuthDbRetry(async () => {
      throw new Error('Invalid admin credentials.');
    }, 'no-retry', 200),
    /Invalid admin credentials/,
  );

  await silenceErrors(async () => {
    let calls = 0;
    const started = Date.now();
    await assert.rejects(
      () => withAuthDbRetry(() => {
        calls += 1;
        return new Promise(() => undefined);
      }, 'hang', 40),
      /timed out/,
    );
    assert.equal(calls, 2);
    const elapsed = Date.now() - started;
    assert.ok(elapsed >= 70, `expected two timeouts, took ${elapsed}ms`);
    assert.ok(elapsed < 1000, `retry hung for ${elapsed}ms`);
  });

  const sharedClient = { id: 'client-1' };
  const sharedDb = { name: 'brushandbloom', client: sharedClient };
  let connects = 0;
  const cache = createMongoConnectionCache();
  const connect = (): Promise<{ client: typeof sharedClient; db: typeof sharedDb }> => {
    connects += 1;
    return new Promise((resolve) => {
      setTimeout(() => resolve({ client: sharedClient, db: sharedDb }), 25);
    });
  };
  const [first, second] = await Promise.all([cache.getDb(connect), cache.getDb(connect)]);
  assert.equal(first, sharedDb);
  assert.equal(second, sharedDb);
  assert.equal(connects, 1);
  const third = await cache.getDb(async () => {
    connects += 1;
    return { client: { id: 'other' }, db: { name: 'other' } };
  });
  assert.equal(third, sharedDb);
  assert.equal(connects, 1, 'a warm cache must not open another client');
  assert.equal(cache.hasClient(), true);

  const failing = createMongoConnectionCache();
  let failures = 0;
  await assert.rejects(() => failing.getDb(async () => {
    failures += 1;
    throw new Error('down');
  }));
  await assert.rejects(() => Promise.all([
    failing.getDb(async () => {
      failures += 1;
      throw new Error('still down');
    }),
    failing.getDb(async () => {
      failures += 1;
      throw new Error('still down');
    }),
  ]));
  assert.equal(failures, 2, 'in-flight callers share one connect attempt');
  const recovered = await failing.getDb(async () => ({ client: { id: 'new' }, db: { ok: true } }));
  assert.equal(recovered.ok, true);

  delete (globalThis as { __craftsquareMongo?: unknown }).__craftsquareMongo;
  const globalA = getMongoConnectionCache();
  const globalB = getMongoConnectionCache();
  assert.equal(globalA, globalB);
  let globalConnects = 0;
  const pending = globalA.getDb(async () => {
    globalConnects += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return { client: { id: 'g' }, db: { id: 'g' } };
  });
  const joined = globalB.getDb(async () => {
    globalConnects += 1;
    return { client: { id: 'other' }, db: { id: 'other' } };
  });
  const [left, right] = await Promise.all([pending, joined]);
  assert.equal(left, right);
  assert.equal(globalConnects, 1);

  const authed = {
    ...unavailableAuthStatus(),
    authenticated: true,
    opsAccess: true,
    code: undefined,
    message: undefined,
  };
  let statusCalls = 0;
  const retried = await fetchAuthStatusWithRetry({
    delaysMs: [0, 0, 0],
    timeoutMs: 500,
    sleepImpl: async () => undefined,
    fetchImpl: async () => {
      statusCalls += 1;
      if (statusCalls < 3) {
        return { json: async () => unavailableAuthStatus() };
      }
      return { json: async () => authed };
    },
  });
  assert.equal(statusCalls, 3);
  assert.equal(retried.authenticated, true);
  assert.notEqual(retried.code, AUTH_STATUS_CODES.DB_TIMEOUT);

  let aborted = 0;
  const attempts: number[] = [];
  const afterAbort = await fetchAuthStatusWithRetry({
    delaysMs: [0, 0],
    timeoutMs: 40,
    sleepImpl: async () => undefined,
    onAttempt: (attempt) => {
      attempts.push(attempt);
    },
    fetchImpl: (_url, init) => new Promise((resolve, reject) => {
      aborted += 1;
      if (aborted === 1) {
        const onAbort = () => reject(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }));
        if (init.signal.aborted) onAbort();
        else init.signal.addEventListener('abort', onAbort);
        return;
      }
      resolve({ json: async () => authed });
    }),
  });
  assert.equal(afterAbort.authenticated, true);
  assert.deepEqual(attempts, [0, 1]);
  assert.equal(aborted, 2);

  const slept: number[] = [];
  const exhausted = await fetchAuthStatusWithRetry({
    delaysMs: [0, 15, 15],
    timeoutMs: 200,
    sleepImpl: async (ms) => {
      slept.push(ms);
    },
    fetchImpl: async () => ({ json: async () => unavailableAuthStatus() }),
  });
  assert.equal(exhausted.code, AUTH_STATUS_CODES.DB_TIMEOUT);
  assert.deepEqual(slept, [15, 15]);

  console.log('auth-db-resilience: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
