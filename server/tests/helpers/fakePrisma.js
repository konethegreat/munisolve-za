'use strict';

// A small in-memory stand-in for the Prisma client, so the API tests never need a database.
//
// It supports only the query shapes the controllers use today and throws on anything else,
// so a controller change that needs a new shape fails loudly here instead of passing silently.
// The behaviours the tests lean on mirror Prisma's: unique violations (P2002), missing rows on
// update/delete (P2025), foreign-key violations (P2003), required-field and NaN-id validation errors,
// the RESTRICT on deleting a user who still has reports, the cascade of a deleted user's activity
// logs, and the cascade of a deleted report's status history. These were checked against Prisma 6.19
// and PostgreSQL while writing the tests.

const MODELS = [
  'user',
  'report',
  'team',
  'activityLog',
  'reportStatusHistory',
  'slaPolicy',
  'notificationOutbox',
  'duplicateCandidate',
  'reportFollower',
  'mergeRecord',
  'assignmentDecision',
  'webhookSubscription',
  'webhookDelivery',
];

const REQUIRED = {
  user: ['email', 'password', 'firstName', 'lastName'],
  report: ['title', 'description', 'category', 'municipality', 'userId'],
  team: ['name', 'specialization'],
  activityLog: ['userId', 'action', 'entity', 'entityId'],
  reportStatusHistory: ['reportId', 'toStatus'],
  slaPolicy: ['category', 'responseMinutes', 'resolutionMinutes'],
  notificationOutbox: ['dedupeKey', 'kind', 'recipientEmail', 'subject', 'body'],
  duplicateCandidate: ['reportId', 'candidateId', 'score'],
  reportFollower: ['reportId', 'userId'],
  mergeRecord: ['duplicateId', 'canonicalId'],
  assignmentDecision: ['reportId', 'mode'],
  webhookSubscription: ['url', 'events', 'secret'],
  webhookDelivery: ['subscriptionId', 'dedupeKey', 'event', 'payload'],
};

const RELATIONS = {
  user: {
    reports: { model: 'report', fk: 'userId', many: true },
    followers: { model: 'reportFollower', fk: 'userId', many: true },
  },
  team: {
    reports: { model: 'report', fk: 'assignedTeamId', many: true },
    assignments: { model: 'assignmentDecision', fk: 'teamId', many: true },
  },
  report: {
    user: { model: 'user', fk: 'userId', many: false },
    team: { model: 'team', fk: 'assignedTeamId', many: false },
    history: { model: 'reportStatusHistory', fk: 'reportId', many: true },
    notifications: { model: 'notificationOutbox', fk: 'reportId', many: true },
    duplicateOf: { model: 'report', fk: 'duplicateOfId', many: false },
    duplicates: { model: 'report', fk: 'duplicateOfId', many: true },
    duplicateCandidates: { model: 'duplicateCandidate', fk: 'reportId', many: true },
    candidateFor: { model: 'duplicateCandidate', fk: 'candidateId', many: true },
    followers: { model: 'reportFollower', fk: 'reportId', many: true },
    mergeRecords: { model: 'mergeRecord', fk: 'duplicateId', many: true },
    mergedIntoRecords: { model: 'mergeRecord', fk: 'canonicalId', many: true },
    assignmentDecisions: { model: 'assignmentDecision', fk: 'reportId', many: true },
  },
  activityLog: { user: { model: 'user', fk: 'userId', many: false } },
  reportStatusHistory: { report: { model: 'report', fk: 'reportId', many: false } },
  notificationOutbox: { report: { model: 'report', fk: 'reportId', many: false } },
  slaPolicy: {},
  duplicateCandidate: {
    report: { model: 'report', fk: 'reportId', many: false },
    candidate: { model: 'report', fk: 'candidateId', many: false },
  },
  reportFollower: {
    report: { model: 'report', fk: 'reportId', many: false },
    user: { model: 'user', fk: 'userId', many: false },
  },
  mergeRecord: {
    duplicate: { model: 'report', fk: 'duplicateId', many: false },
    canonical: { model: 'report', fk: 'canonicalId', many: false },
  },
  assignmentDecision: {
    report: { model: 'report', fk: 'reportId', many: false },
    team: { model: 'team', fk: 'teamId', many: false },
  },
  webhookSubscription: {
    deliveries: { model: 'webhookDelivery', fk: 'subscriptionId', many: true },
  },
  webhookDelivery: {
    subscription: { model: 'webhookSubscription', fk: 'subscriptionId', many: false },
  },
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
    resolvedAt: null,
    closedAt: null,
    closureReason: null,
    reopenCount: 0,
    responseDueAt: null,
    resolutionDueAt: null,
    slaCycleStartedAt: null,
    duplicateOfId: null,
  }),
  team: () => ({
    municipality: null,
    latitude: null,
    longitude: null,
    isActive: true,
    capacity: 10,
    maxRadiusKm: 20,
    autoAssignEnabled: false,
  }),
  activityLog: () => ({ description: null, ipAddress: null, userAgent: null, requestId: null }),
  reportStatusHistory: () => ({
    fromStatus: null,
    actorId: null,
    actorRole: null,
    note: null,
    requestId: null,
  }),
  slaPolicy: () => ({ isActive: true }),
  notificationOutbox: () => ({
    reportId: null,
    status: 'PENDING',
    attempts: 0,
    maxAttempts: 5,
    nextAttemptAt: null,
    sentAt: null,
    lastError: null,
  }),
  duplicateCandidate: () => ({ distanceM: null, status: 'SUGGESTED', resolvedAt: null }),
  reportFollower: () => ({}),
  mergeRecord: () => ({ mergedById: null, undoneById: null, undoneAt: null }),
  assignmentDecision: () => ({ teamId: null, score: null, runnerUpScore: null, reasons: null }),
  webhookSubscription: () => ({ description: null, isActive: true }),
  webhookDelivery: () => ({
    status: 'PENDING',
    attempts: 0,
    maxAttempts: 5,
    nextAttemptAt: new Date(0),
    lastError: null,
    responseStatus: null,
    deliveredAt: null,
  }),
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
      if (Array.isArray(condition.notIn)) return !condition.notIn.includes(value);
      if ('lt' in condition) return value != null && value < condition.lt;
      if ('lte' in condition) return value != null && value <= condition.lte;
      if ('gt' in condition) return value != null && value > condition.gt;
      if ('gte' in condition) return value != null && value >= condition.gte;
      if ('not' in condition) return value !== condition.not;
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

// The unique key of a row, or null when the model has none beyond its id. Used by createMany's
// skipDuplicates, which must respect every @@unique in the schema.
function uniqueKey(model, row) {
  switch (model) {
    case 'user':
      return `email:${row.email}`;
    case 'slaPolicy':
      return `category:${row.category}`;
    case 'notificationOutbox':
      return `dedupe:${row.dedupeKey}`;
    case 'duplicateCandidate':
      return `pair:${row.reportId}:${row.candidateId}`;
    case 'reportFollower':
      return `pair:${row.reportId}:${row.userId}`;
    case 'mergeRecord':
      return `duplicate:${row.duplicateId}`;
    case 'webhookDelivery':
      return `dedupe:${row.dedupeKey}`;
    default:
      return null;
  }
}

function duplicateRowIn(rows, model, data) {
  const key = uniqueKey(model, data);
  return key !== null && rows.some((row) => uniqueKey(model, row) === key);
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
    if (duplicateRowIn(tables[model], model, data)) {
      throw prismaError('P2002', `Unique constraint failed on ${model}`);
    }
    if (model === 'notificationOutbox' && data.reportId != null) {
      if (!tables.report.some((r) => r.id === data.reportId)) {
        throw prismaError('P2003', 'Foreign key constraint violated on `reportId`');
      }
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
    if (model === 'report' && data.duplicateOfId != null) {
      if (!tables.report.some((r) => r.id === data.duplicateOfId)) {
        throw prismaError('P2003', 'Foreign key constraint violated on `duplicateOfId`');
      }
    }
    if (model === 'reportStatusHistory' && !tables.report.some((r) => r.id === data.reportId)) {
      throw prismaError('P2003', 'Foreign key constraint violated on `reportId`');
    }
    if (model === 'duplicateCandidate') {
      if (!tables.report.some((r) => r.id === data.reportId)) {
        throw prismaError('P2003', 'Foreign key constraint violated on `reportId`');
      }
      if (!tables.report.some((r) => r.id === data.candidateId)) {
        throw prismaError('P2003', 'Foreign key constraint violated on `candidateId`');
      }
    }
    if (model === 'reportFollower') {
      if (!tables.report.some((r) => r.id === data.reportId)) {
        throw prismaError('P2003', 'Foreign key constraint violated on `reportId`');
      }
      if (!tables.user.some((u) => u.id === data.userId)) {
        throw prismaError('P2003', 'Foreign key constraint violated on `userId`');
      }
    }
    if (model === 'mergeRecord') {
      if (!tables.report.some((r) => r.id === data.duplicateId)) {
        throw prismaError('P2003', 'Foreign key constraint violated on `duplicateId`');
      }
      if (!tables.report.some((r) => r.id === data.canonicalId)) {
        throw prismaError('P2003', 'Foreign key constraint violated on `canonicalId`');
      }
    }
    if (model === 'assignmentDecision') {
      if (!tables.report.some((r) => r.id === data.reportId)) {
        throw prismaError('P2003', 'Foreign key constraint violated on `reportId`');
      }
      if (data.teamId != null && !tables.team.some((t) => t.id === data.teamId)) {
        throw prismaError('P2003', 'Foreign key constraint violated on `teamId`');
      }
    }
    if (model === 'webhookDelivery' && !tables.webhookSubscription.some((s) => s.id === data.subscriptionId)) {
      throw prismaError('P2003', 'Foreign key constraint violated on `subscriptionId`');
    }

    counters[model] += 1;
    const timestamp = now();
    const row = {
      id: counters[model],
      ...DEFAULTS[model](),
      createdAt: timestamp,
      ...(model === 'report' && { updatedAt: timestamp }),
      ...(model === 'mergeRecord' && { updatedAt: timestamp }),
      ...((model === 'webhookSubscription' || model === 'webhookDelivery') && { updatedAt: timestamp }),
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

  function find(model, where = {}) {
    if (Array.isArray(where.OR)) {
      const { OR, ...rest } = where;
      const branches = OR.flatMap((branch) => find(model, branch));
      const base = Object.keys(rest).length > 0 ? new Set(find(model, rest)) : null;
      const unique = new Map(branches.map((row) => [row.id, row]));
      return [...unique.values()].filter((row) => !base || base.has(row));
    }
    return tables[model].filter((row) => matches(row, where));
  }

  function requireOne(model, where) {
    const row = find(model, where)[0];
    if (!row) throw prismaError('P2025', `An operation failed because it depends on one or more records that were required but not found. (${model})`);
    return row;
  }

  // Shared by update and updateMany: one data document applied to one row, with Prisma's
  // numeric increment/decrement support.
  function applyData(model, row, data) {
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      if (value && typeof value === 'object' && typeof value.increment === 'number') {
        row[key] = (row[key] ?? 0) + value.increment;
      } else if (value && typeof value === 'object' && typeof value.decrement === 'number') {
        row[key] = (row[key] ?? 0) - value.decrement;
      } else {
        row[key] = value;
      }
    }
    if (['report', 'mergeRecord', 'webhookSubscription', 'webhookDelivery'].includes(model)) row.updatedAt = now();
    return row;
  }

  // updateMany only filters on scalar fields. Relations in `where` are left to the caller,
  // exactly as the single-row `update` above treats them.
  function scalarWhere(model, where = {}) {
    return Object.fromEntries(
      Object.entries(where).filter(([key, condition]) => condition !== undefined && !RELATIONS[model][key]),
    );
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
      async createMany({ data, skipDuplicates = false } = {}) {
        let count = 0;
        const keys = new Set(tables[model].map((row) => uniqueKey(model, row)).filter(Boolean));
        for (const item of data) {
          const key = uniqueKey(model, item);
          if (skipDuplicates && key !== null && keys.has(key)) continue;
          insert(model, item);
          count += 1;
          if (key !== null) keys.add(key);
        }
        return { count };
      },
      async update({ where, data, ...projection }) {
        const row = requireOne(model, where);
        applyData(model, row, data);
        return project(model, row, projection);
      },
      // Conditional bulk write: every row whose scalar fields equal the filter values is updated
      // and counted, so a service can write "only if the status is still what I read".
      async updateMany({ where, data } = {}) {
        const condition = scalarWhere(model, where);
        const rows = tables[model].filter((row) => matches(row, condition));
        for (const row of rows) applyData(model, row, data || {});
        return { count: rows.length };
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
          tables.reportFollower = tables.reportFollower.filter((follower) => follower.userId !== row.id);
        }
        if (model === 'webhookSubscription') {
          tables.webhookDelivery = tables.webhookDelivery.filter((delivery) => delivery.subscriptionId !== row.id);
        }
        if (model === 'report') {
          tables.reportStatusHistory = tables.reportStatusHistory.filter((history) => history.reportId !== row.id);
          tables.notificationOutbox = tables.notificationOutbox.filter((notice) => notice.reportId !== row.id);
          tables.duplicateCandidate = tables.duplicateCandidate.filter(
            (link) => link.reportId !== row.id && link.candidateId !== row.id,
          );
          tables.reportFollower = tables.reportFollower.filter((follower) => follower.reportId !== row.id);
          tables.mergeRecord = tables.mergeRecord.filter(
            (merge) => merge.duplicateId !== row.id && merge.canonicalId !== row.id,
          );
          tables.assignmentDecision = tables.assignmentDecision.filter((decision) => decision.reportId !== row.id);
          for (const other of tables.report) {
            if (other.duplicateOfId === row.id) other.duplicateOfId = null;
          }
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

  // Runs the callback against this client (or resolves the promises) inside one "transaction".
  // There is no rollback: tests assert on committed state, not on aborted work.
  db.$transaction = async (arg) => (typeof arg === 'function' ? arg(db) : Promise.all(arg));

  // Raw SQL never touches a database; tests can set `queryRawOverride` to inspect the query.
  db.$queryRaw = async (strings) => {
    if (db.queryRawOverride) return db.queryRawOverride(strings);
    const sql = Array.isArray(strings) ? strings.join('?') : String(strings);
    if (sql.includes('_prisma_migrations')) return [{ failed: 0 }];
    return [{ ok: 1 }];
  };

  // Test helpers (not part of the Prisma API).
  db.reset = reset;
  db.add = (model, data) => ({ ...insert(model, data) });
  db.snapshot = () => JSON.parse(JSON.stringify(tables));

  reset();
  return db;
}

module.exports = { createFakePrisma };
