type Doc = Record<string, any>;

type IndexSpec = { keys: string[]; unique: boolean; sparse: boolean };

function getPath(doc: Doc, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Doc)) return (acc as Doc)[key];
    return undefined;
  }, doc);
}

function matchScalar(actual: unknown, expected: unknown): boolean {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    const ops = expected as Record<string, unknown>;
    if ('$in' in ops) return (ops.$in as unknown[]).some((item) => item === actual);
    if ('$nin' in ops) return !(ops.$nin as unknown[]).includes(actual);
    if ('$ne' in ops) return actual !== ops.$ne;
    if ('$lte' in ops) return actual != null && String(actual) <= String(ops.$lte);
    if ('$gte' in ops) return actual != null && String(actual) >= String(ops.$gte);
    if ('$gt' in ops) return actual != null && String(actual) > String(ops.$gt);
    if ('$lt' in ops) return actual != null && String(actual) < String(ops.$lt);
    if ('$exists' in ops) return ops.$exists ? actual !== undefined : actual === undefined;
    if ('$regex' in ops) {
      const flags = String(ops.$options || '');
      return new RegExp(String(ops.$regex), flags).test(String(actual || ''));
    }
  }
  return actual === expected;
}

function matchValue(actual: unknown, expected: unknown): boolean {
  if (!Array.isArray(actual)) return matchScalar(actual, expected);
  if (Array.isArray(expected)) {
    return actual.length === expected.length && actual.every((item, index) => item === expected[index]);
  }
  if (expected && typeof expected === 'object') {
    const ops = expected as Record<string, unknown>;
    const keys = Object.keys(ops);
    if (keys.length && keys.every((key) => key.startsWith('$'))) {
      if ('$in' in ops) return actual.some((item) => (ops.$in as unknown[]).includes(item));
      if ('$nin' in ops) return actual.every((item) => !(ops.$nin as unknown[]).includes(item));
      if ('$ne' in ops) return actual.every((item) => item !== ops.$ne);
      if ('$exists' in ops) return Boolean(ops.$exists);
      if ('$regex' in ops) {
        const flags = String(ops.$options || '');
        const pattern = new RegExp(String(ops.$regex), flags);
        return actual.some((item) => pattern.test(String(item ?? '')));
      }
    }
  }
  return actual.some((item) => item === expected);
}

function matches(doc: Doc, query: Doc | undefined): boolean {
  if (!query || !Object.keys(query).length) return true;
  if (Array.isArray(query.$or)) {
    return (query.$or as Doc[]).some((part) => matches(doc, part));
  }
  if (Array.isArray(query.$and)) {
    return (query.$and as Doc[]).every((part) => matches(doc, part));
  }
  return Object.entries(query).every(([key, expected]) => {
    if (key === '$or' || key === '$and') return true;
    return matchValue(getPath(doc, key), expected);
  });
}

function indexTuples(doc: Doc, keys: string[]): unknown[][] {
  let tuples: unknown[][] = [[]];
  for (const key of keys) {
    const value = getPath(doc, key);
    const variants = Array.isArray(value) ? value : [value];
    if (Array.isArray(value) && value.length === 0) return [];
    const next: unknown[][] = [];
    for (const tuple of tuples) {
      for (const variant of variants) next.push([...tuple, variant]);
    }
    tuples = next;
  }
  return tuples;
}

function applyUpdate(doc: Doc, update: Doc, isInsert: boolean) {
  if (update.$set) Object.assign(doc, update.$set);
  if (isInsert && update.$setOnInsert) Object.assign(doc, update.$setOnInsert);
  if (update.$inc) {
    for (const [key, amount] of Object.entries(update.$inc as Doc)) {
      doc[key] = Number(doc[key] || 0) + Number(amount);
    }
  }
  if (update.$unset) {
    for (const key of Object.keys(update.$unset as Doc)) delete doc[key];
  }
}

class Cursor {
  constructor(private rows: Doc[]) {}
  sort(spec: Record<string, number>) {
    const entries = Object.entries(spec);
    this.rows.sort((a, b) => {
      for (const [key, dir] of entries) {
        const av = getPath(a, key);
        const bv = getPath(b, key);
        if (av === bv) continue;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (av > bv) return dir;
        if (av < bv) return -dir;
      }
      return 0;
    });
    return this;
  }
  limit(n: number) {
    this.rows = this.rows.slice(0, n);
    return this;
  }
  async toArray() {
    return this.rows.map((row) => ({ ...row }));
  }
}

class Collection {
  docs: Doc[] = [];
  indexes: IndexSpec[] = [];

  async createIndex(spec: Record<string, number>, opts: { unique?: boolean; sparse?: boolean } = {}) {
    this.indexes.push({
      keys: Object.keys(spec),
      unique: Boolean(opts.unique),
      sparse: Boolean(opts.sparse),
    });
  }

  private assertUnique(doc: Doc, ignore?: Doc) {
    const duplicate = () => {
      const error = new Error('E11000 duplicate key') as Error & { code?: number };
      error.code = 11000;
      return error;
    };
    for (const index of this.indexes) {
      if (!index.unique) continue;
      const tuples = indexTuples(doc, index.keys);
      if (!tuples.length && index.sparse) continue;
      const seen = new Set<string>();
      for (const tuple of tuples) {
        if (index.sparse && tuple.every((value) => value == null || value === '')) continue;
        const signature = JSON.stringify(tuple);
        if (seen.has(signature)) throw duplicate();
        seen.add(signature);
        const clash = this.docs.find((existing) => {
          if (ignore && existing === ignore) return false;
          return indexTuples(existing, index.keys).some((other) => JSON.stringify(other) === signature);
        });
        if (clash) throw duplicate();
      }
    }
  }

  async insertOne(doc: Doc) {
    const copy = { ...doc, _id: doc._id || `mem_${this.docs.length}_${Math.random()}` };
    this.assertUnique(copy);
    this.docs.push(copy);
    return { insertedId: copy._id };
  }

  async findOne(query: Doc, _opts?: Doc) {
    const found = this.docs.find((doc) => matches(doc, query));
    return found ? { ...found } : null;
  }

  find(query: Doc = {}, _opts?: Doc) {
    return new Cursor(this.docs.filter((doc) => matches(doc, query)).map((doc) => ({ ...doc })));
  }

  async updateOne(query: Doc, update: Doc, opts: { upsert?: boolean } = {}) {
    const found = this.docs.find((doc) => matches(doc, query));
    if (!found) {
      if (!opts.upsert) return { matchedCount: 0, modifiedCount: 0 };
      const doc: Doc = {};
      applyUpdate(doc, update, true);
      if (update.$setOnInsert) Object.assign(doc, update.$setOnInsert);
      await this.insertOne(doc);
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
    }
    const snapshot = { ...found };
    applyUpdate(found, update, false);
    try {
      this.assertUnique(found, found);
    } catch (error) {
      for (const key of Object.keys(found)) delete found[key];
      Object.assign(found, snapshot);
      throw error;
    }
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async updateMany(query: Doc, update: Doc) {
    let modifiedCount = 0;
    for (const doc of this.docs) {
      if (!matches(doc, query)) continue;
      applyUpdate(doc, update, false);
      modifiedCount += 1;
    }
    return { modifiedCount };
  }

  async deleteOne(query: Doc) {
    const index = this.docs.findIndex((doc) => matches(doc, query));
    if (index < 0) return { deletedCount: 0 };
    this.docs.splice(index, 1);
    return { deletedCount: 1 };
  }

  async deleteMany(query: Doc) {
    const before = this.docs.length;
    this.docs = this.docs.filter((doc) => !matches(doc, query));
    return { deletedCount: before - this.docs.length };
  }

  async countDocuments(query: Doc = {}) {
    return this.docs.filter((doc) => matches(doc, query)).length;
  }

  async findOneAndUpdate(query: Doc, update: Doc, _opts?: Doc) {
    const found = this.docs.find((doc) => matches(doc, query));
    if (!found) return null;
    applyUpdate(found, update, false);
    return { ...found };
  }

  async insertMany(docs: Doc[]) {
    for (const doc of docs) await this.insertOne(doc);
  }

  async distinct(field: string, query: Doc = {}) {
    const values = new Set<unknown>();
    for (const doc of this.docs) {
      if (!matches(doc, query)) continue;
      const value = getPath(doc, field);
      if (Array.isArray(value)) value.forEach((item) => values.add(item));
      else if (value !== undefined) values.add(value);
    }
    return [...values];
  }
}

export function createMemoryDb() {
  const collections = new Map<string, Collection>();
  return {
    collection(name: string) {
      let col = collections.get(name);
      if (!col) {
        col = new Collection();
        collections.set(name, col);
      }
      return col;
    },
  };
}
