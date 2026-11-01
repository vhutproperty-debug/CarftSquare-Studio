/**
 * One Mongo connection promise per isolate.
 * Always store the cache on globalThis: a re-evaluated module must join the
 * in-flight connect instead of opening another client for the same request.
 */
export function createMongoConnectionCache() {
  const state = {
    client: null,
    db: null,
    promise: null,
  };

  function clear() {
    state.client = null;
    state.db = null;
    state.promise = null;
  }

  return {
    /**
     * @param {() => Promise<{ client: any, db: any }>} connect
     * @returns {Promise<any>}
     */
    getDb(connect) {
      if (state.client && state.db) {
        return Promise.resolve(state.db);
      }
      if (!state.promise) {
        state.promise = Promise.resolve()
          .then(() => connect())
          .then((connected) => {
            if (!connected?.client || !connected?.db) {
              throw new Error('Mongo connect did not return a client and database.');
            }
            state.client = connected.client;
            state.db = connected.db;
            return state.db;
          })
          .catch((error) => {
            clear();
            throw error;
          });
      }
      return state.promise;
    },
    hasClient() {
      return Boolean(state.client && state.db);
    },
    clear,
  };
}

const GLOBAL_KEY = '__craftsquareMongo';

export function getMongoConnectionCache() {
  const root = globalThis;
  if (!root[GLOBAL_KEY]) {
    root[GLOBAL_KEY] = createMongoConnectionCache();
  }
  return root[GLOBAL_KEY];
}
