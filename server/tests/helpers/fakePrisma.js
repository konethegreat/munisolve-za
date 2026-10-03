'use strict';

// A small in-memory stand-in for the Prisma client, so the API tests never need a database.
//
// It supports only the query shapes the controllers use today and throws on anything else,
// so a controller change that needs a new shape fails loudly here instead of passing silently.
// The behaviours the tests lean on mirror Prisma's: unique violations (P2002), missing rows on
// update/delete (P2025), foreign-key violations (P2003), required-field and NaN-id validation errors,
// the RESTRICT on deleting a user who still has reports, and the cascade of a deleted user's activity
// logs. These were checked against Prisma 6.19 and PostgreSQL while writing the tests.

const MODELS = ['user', 'report', 'team', 'activityLog'];

const REQUIRED = {
  user: ['email', 'password', 'firstName', 'lastName'],
  report: ['title', 'description', 'category', 'municipality', 'userId'],
  team: ['name', 'specialization'],
  activityLog: ['userId', 'action', 'entity', 'entityId'],
};

const RELATIONS = {
  user: { reports: { model: 'report', fk: 'userId', many: true } },
  team: { reports: { model: 'report', fk: 'assignedTeamId', many: true } },
  report: {
    user: { model: 'user', fk: 'userId', many: false },
    team: { model: 'team', fk: 'assignedTeamId', many: false },
  },
  activityLog: { user: { model: 'user', fk: 'userId', many: false } },
};

const DEFAULTS = {
  user: () => ({
    role: 'CITIZEN',
    isActive: true,
    isVerified: false,
    phone: null,
    googleId: null,
    lastLogin: null,
    emailVerifToken: null,
    emailVerifExpiry: null,
  }),
  report: () => ({
    status: 'PENDING',
    address: null,
    latitude: null,
    longitude: null,
    weatherTemp: null,
    weatherCondition: null,
    weatherRainfall: null,
    weatherWind: null,
    weatherHumidity: null,
    assignedTeamId: null,
    assignedAt: null,
    afterPhotoUrl: null,
  }),
  team: () => ({ municipality: null, latitude: null, longitude: null, isActive: true }),
  activityLog: () => ({ description: null, ipAddress: null, userAgent: null }),
};

function prismaError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.name = 'PrismaClientKnownRequestError';
  return error;
}

function validationError(message) {
  const error = new Error(message);
  error.name = 'PrismaClientValidationError';
  return error;
}

const clone = (value) => (value instanceof Date ? new Date(value) : value);

function matches(row, where = {}) {
  return Object.entries(where).every(([key, condition]) => {
    if (condition === undefined) return true;
    const value = row[key];

    if (typeof condition === 'number' && Number.isNaN(condition)) {
      throw validationError(`Argument \`${key}\`: Invalid value provided. Expected Int, provided NaN.`);
    }
    if (condition !== null && typeof condition === 'object' && !(condition instanceof Date)) {
      if (Array.isArray(condition.in)) return condition.in.includes(value);
      if (typeof condition.contains === 'string') {
        const haystack = String(value ?? '');
        return condition.mode === 'insensitive'
          ? haystack.toLowerCase().includes(condition.contains.toLowerCase())
          : haystack.includes(condition.contains);
      }
      throw new Error(`fakePrisma: unsupported where operator on "${key}": ${JSON.stringify(condition)}`);
    }
    return value === condition;
  });
}

function compare(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  return a < b ? -1 : 1;
}

function sortRows(rows, orderBy) {
  if (!orderBy) return rows;
  const entries = Object.entries(orderBy);
  if (entries.length !== 1) throw new Error('fakePrisma: only single-field orderBy is supported');
  const [field, direction] = entries[0];
  const factor = direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => factor * compare(a[field], b[field]));
}

function paginate(rows, { skip = 0, take } = {}) {
  if (Number.isNaN(skip) || Number.isNaN(take)) {
    throw validationError('Argument `skip` or `take`: Invalid value provided. Expected Int, provided NaN.');
  }
  const start = Math.max(skip, 0);
  return take === undefined ? rows.slice(start) : rows.slice(start, start + take);
}

function createFakePrisma() {
  const tables = {};
  const counters = {};
  // Strictly increasing timestamps keep "newest first" ordering deterministic.
  let clock = Date.UTC(2026, 0, 1, 8, 0, 0);

  const db = { tables };

  // Empties the tables. Ids and timestamps keep counting up, like a real database's sequences, so a
  // row id is never reused within one test file (the per-user rate limiter keys on user ids).
  function reset() {
    for (const model of MODELS) {
      tables[model] = [];
      counters[model] = counters[model] || 0;
    }
  }

  const now = () => {
    clock += 1000;
    return new Date(clock);
  };

  function insert(model, input) {
    // Prisma ignores undefined values, so drop them before applying defaults.
    const data = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));

    for (const field of REQUIRED[model]) {
      if (data[field] === undefined || data[field] === null) {
        throw validationError(`Argument \`${field}\` is missing.`);
      }
    }
    if (model === 'user' && tables.user.some((u) => u.email === data.email)) {
      throw prismaError('P2002', 'Unique constraint failed on the fields: (`email`)');
    }
    if (model === 'report' || model === 'activityLog') {
      if (!tables.user.some((u) => u.id === data.userId)) {
        throw prismaError('P2003', 'Foreign key constraint violated on `userId`');
      }
    }
    if (model === 'report' && data.assignedTeamId != null) {
      if (!tables.team.some((t) => t.id === data.assignedTeamId)) {
        throw prismaError('P2003', 'Foreign key constraint violated on `assignedTeamId`');
      }
    }

    counters[model] += 1;
    const timestamp = now();
    const row = {
      id: counters[model],
      ...DEFAULTS[model](),
      createdAt: timestamp,
      ...(model === 'report' && { updatedAt: timestamp }),
      ...data,
    };
    tables[model].push(row);
    return row;
  }

  function relationRows(model, row, name, spec) {
    const relation = RELATIONS[model][name];
    const options = spec === true ? {} : spec;
    if (!relation.many) {
      const target = tables[relation.model].find((r) => r.id === row[relation.fk]);
      return target ? project(relation.model, target, options) : null;
    }
    let rows = tables[relation.model].filter((r) => r[relation.fk] === row.id);
    rows = rows.filter((r) => matches(r, options.where));
    rows = paginate(sortRows(rows, options.orderBy), { take: options.take });
    return rows.map((r) => project(relation.model, r, options));
  }

  function countRelations(model, row, select) {
    const counts = {};
    for (const [name, spec] of Object.entries(select)) {
      if (!spec) continue;
      const relation = RELATIONS[model][name];
      if (!relation || !relation.many) throw new Error(`fakePrisma: cannot count "${name}"`);
      const where = spec === true ? {} : spec.where;
      counts[name] = tables[relation.model].filter((r) => r[relation.fk] === row.id && matches(r, where)).length;
    }
    return counts;
  }

  function project(model, row, { select, include } = {}) {
    const out = {};
    const relations = RELATIONS[model];
    const addExtra = (key, spec) => {
      if (key === '_count') out._count = countRelations(model, row, spec.select);
      else if (relations[key]) out[key] = relationRows(model, row, key, spec);
      else throw new Error(`fakePrisma: unknown field or relation "${key}" on ${model}`);
    };

    if (select) {
      for (const [key, spec] of Object.entries(select)) {
        if (!spec) continue;
        if (key === '_count' || relations[key]) addExtra(key, spec);
        else out[key] = clone(row[key]);
      }
      return out;
    }

    for (const [key, value] of Object.entries(row)) out[key] = clone(value);
    for (const [key, spec] of Object.entries(include || {})) {
      if (spec) addExtra(key, spec);
    }
    return out;
  }

  function find(model, where) {
    return tables[model].filter((row) => matches(row, where));
  }

  function requireOne(model, where) {
    const row = find(model, where)[0];
    if (!row) throw prismaError('P2025', `An operation failed because it depends on one or more records that were required but not found. (${model})`);
    return row;
  }

  function delegate(model) {
    return {
      async findUnique({ where, ...projection }) {
        const row = find(model, where)[0];
        return row ? project(model, row, projection) : null;
      },
      async findFirst({ where, orderBy, ...projection } = {}) {
        const row = sortRows(find(model, where), orderBy)[0];
        return row ? project(model, row, projection) : null;
      },
      async findMany({ where, orderBy, skip, take, ...projection } = {}) {
        const rows = paginate(sortRows(find(model, where), orderBy), { skip, take });
        return rows.map((row) => project(model, row, projection));
      },
      async count({ where } = {}) {
        return find(model, where).length;
      },
      async create({ data, ...projection }) {
        return project(model, insert(model, data), projection);
      },
      async update({ where, data, ...projection }) {
        const row = requireOne(model, where);
        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined) row[key] = value;
        }
        if (model === 'report') row.updatedAt = now();
        return project(model, row, projection);
      },
      async delete({ where }) {
        const row = requireOne(model, where);
        if (model === 'user') {
          if (tables.report.some((r) => r.userId === row.id)) {
            // Postgres refuses (RESTRICT); Prisma reports it without an error code.
            const error = new Error('update or delete on table "User" violates RESTRICT setting of foreign key constraint "Report_userId_fkey"');
            error.name = 'PrismaClientUnknownRequestError';
            throw error;
          }
          tables.activityLog = tables.activityLog.filter((log) => log.userId !== row.id);
        }
        tables[model] = tables[model].filter((r) => r !== row);
        return project(model, row);
      },
      async groupBy({ by, _count }) {
        const [field] = by;
        const groups = new Map();
        for (const row of tables[model]) groups.set(row[field], (groups.get(row[field]) || 0) + 1);
        return [...groups].map(([value, n]) => ({ [field]: value, _count: { [Object.keys(_count)[0]]: n } }));
      },
    };
  }

  for (const model of MODELS) db[model] = delegate(model);

  db.$connect = async () => {};
  db.$disconnect = async () => {};

  // Test helpers (not part of the Prisma API).
  db.reset = reset;
  db.add = (model, data) => ({ ...insert(model, data) });
  db.snapshot = () => JSON.parse(JSON.stringify(tables));

  reset();
  return db;
}

module.exports = { createFakePrisma };
