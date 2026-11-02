// The API description served at /api/openapi.json and rendered at /api/docs.
// It is written by hand so it stays free of extra dependencies; keep it in step
// with the routers when an endpoint or contract changes.

const errorEnvelope = {
  type: 'object',
  required: ['success', 'errorCode', 'message'],
  properties: {
    success: { type: 'boolean', const: false },
    errorCode: { type: 'string', examples: ['VALIDATION_ERROR'] },
    message: { type: 'string' },
    requestId: { type: 'string' },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        properties: { field: { type: 'string' }, message: { type: 'string' } },
      },
    },
    errorCount: { type: 'integer' },
  },
} as const;

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const okResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: {} } } } },
});

const bearer = [{ bearerAuth: [] }];

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'MuniSolve ZA API',
    version: '3.0.0',
    summary: 'Municipal service reporting, triage, SLA tracking and integration API.',
    description:
      'Reports move PENDING → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED, with REJECTED as an exit. ' +
      'Every failure uses one envelope: { success: false, errorCode, message, requestId, errors? }. ' +
      'Protected routes take a bearer JWT. Webhook payloads are signed with HMAC-SHA256.',
    license: { name: 'ISC' },
  },
  servers: [{ url: '/', description: 'This API origin' }],
  tags: [
    { name: 'Health', description: 'Liveness and readiness probes.' },
    { name: 'Auth', description: 'Registration, login and sessions.' },
    { name: 'Reports', description: 'Citizen reports, status changes and duplicates.' },
    { name: 'AI', description: 'Report assistant.' },
    { name: 'Supervisor', description: 'Triage, assignment and teams.' },
    { name: 'Admin', description: 'Municipal administration, webhooks and audit.' },
    { name: 'Public', description: 'Keyless public data widgets.' },
    { name: 'Geo', description: 'Place search and reverse geocoding (OpenStreetMap).' },
    { name: 'Internal', description: 'Scheduled jobs.' },
    { name: 'Docs', description: 'This document.' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      tickSecret: { type: 'apiKey', in: 'header', name: 'x-tick-secret' },
    },
    schemas: {
      Error: errorEnvelope,
      Status: {
        type: 'string',
        enum: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'],
      },
      Report: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          status: { $ref: '#/components/schemas/Status' },
          municipality: { type: 'string' },
          latitude: { type: 'number', nullable: true },
          longitude: { type: 'number', nullable: true },
          responseDueAt: { type: 'string', format: 'date-time', nullable: true },
          resolutionDueAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness probe (no database access)',
        responses: { '200': { description: 'Process is alive.' } },
      },
    },
    '/ready': {
      get: {
        tags: ['Health'],
        summary: 'Readiness probe',
        description: 'Checks database connectivity and that migrations are current.',
        responses: {
          '200': { description: 'Database up and migrations current.' },
          '503': { description: 'Database or migrations not ready.' },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a citizen account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'firstName', 'lastName'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': okResponse('Account created; verification email sent.'),
          '400': errorResponse('Validation failed.'),
          '409': errorResponse('Email already registered.'),
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Email and password login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string' }, password: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': okResponse('Returns the user and a bearer token.'),
          '401': errorResponse('Invalid credentials.'),
          '403': errorResponse('Account inactive or unverified.'),
        },
      },
    },
    '/api/auth/google': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in with a Google ID token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['credential'],
                properties: { credential: { type: 'string', description: 'Google ID token.' } },
              },
            },
          },
        },
        responses: {
          '200': okResponse('Returns the user and a bearer token.'),
          '401': errorResponse('The Google token could not be verified.'),
        },
      },
    },
    '/api/auth/verify-email': {
      post: {
        tags: ['Auth'],
        summary: 'Verify an email address with the emailed code',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'code'],
                properties: { email: { type: 'string' }, code: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': okResponse('Email verified.'),
          '400': errorResponse('Invalid or expired code.'),
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user',
        security: bearer,
        responses: { '200': okResponse('The authenticated user.'), '401': errorResponse('Missing or invalid token.') },
      },
    },
    '/api/reports': {
      get: {
        tags: ['Reports'],
        summary: 'List visible reports',
        description: 'Citizens see their own reports; municipal roles see the reports they may act on.',
        security: bearer,
        parameters: [
          { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/Status' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
        ],
        responses: { '200': okResponse('A page of reports.'), '401': errorResponse('Missing or invalid token.') },
      },
      post: {
        tags: ['Reports'],
        summary: 'Create a report',
        description:
          'Returns duplicate suggestions; a same-reporter match of 0.9 or higher is merged automatically. ' +
          'A weather snapshot is attached when the location is available.',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'description', 'category', 'municipality'],
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  category: { type: 'string' },
                  municipality: { type: 'string' },
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                  address: { type: 'string' },
                  imageUrl: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': okResponse('The report, duplicate suggestions and SLA targets.'),
          '400': errorResponse('Validation failed.'),
          '401': errorResponse('Missing or invalid token.'),
        },
      },
    },
    '/api/reports/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      get: {
        tags: ['Reports'],
        summary: 'Report detail',
        security: bearer,
        responses: {
          '200': okResponse('The report with history.'),
          '404': errorResponse('Report not found or not visible to this user.'),
        },
      },
      put: {
        tags: ['Reports'],
        summary: 'Edit a report that is still open',
        security: bearer,
        responses: {
          '200': okResponse('The updated report.'),
          '403': errorResponse('Not the owner or not permitted.'),
          '409': errorResponse('The report can no longer be edited.'),
        },
      },
      delete: {
        tags: ['Reports'],
        summary: 'Delete a report',
        security: bearer,
        responses: { '200': okResponse('Report deleted.'), '403': errorResponse('Not permitted.') },
      },
    },
    '/api/reports/{id}/status': {
      patch: {
        tags: ['Reports'],
        summary: 'Change report status',
        description:
          'Allowed transitions are enforced; invalid ones return 409 INVALID_TRANSITION. ' +
          'A supervisor resolution needs an after-photo URL; a SUPER_ADMIN override needs a reason.',
        security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { $ref: '#/components/schemas/Status' },
                  note: { type: 'string' },
                  afterPhotoUrl: { type: 'string' },
                  reason: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': okResponse('The updated report.'),
          '400': errorResponse('Assignment must go through the assign endpoint.'),
          '403': errorResponse('Not permitted.'),
          '409': errorResponse('Invalid transition or stale status.'),
        },
      },
    },
    '/api/reports/{id}/duplicates': {
      get: {
        tags: ['Reports'],
        summary: 'Duplicate candidates for a report',
        security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': okResponse('Candidate reports with scores.'), '404': errorResponse('Report not found.') },
      },
    },
    '/api/reports/{id}/duplicates/{candidateId}/confirm': {
      post: {
        tags: ['Reports'],
        summary: 'Merge two reports',
        security: bearer,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'candidateId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          '200': okResponse('The duplicate was merged into the canonical report.'),
          '409': errorResponse('Already resolved or not open.'),
        },
      },
    },
    '/api/reports/{id}/duplicates/{candidateId}/dismiss': {
      post: {
        tags: ['Reports'],
        summary: 'Keep two reports separate',
        security: bearer,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'candidateId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: { '200': okResponse('The suggestion was dismissed.'), '404': errorResponse('Suggestion not found.') },
      },
    },
    '/api/ai/chat': {
      post: {
        tags: ['AI'],
        summary: 'Ask the reporting assistant',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message'],
                properties: {
                  message: { type: 'string' },
                  history: {
                    type: 'array',
                    maxItems: 20,
                    items: {
                      type: 'object',
                      properties: { role: { type: 'string', enum: ['user', 'assistant'] }, content: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': okResponse('The assistant reply.'),
          '503': errorResponse('The model is not configured or unavailable.'),
        },
      },
    },
    '/api/supervisor/dashboard': {
      get: {
        tags: ['Supervisor'],
        summary: 'Supervisor counters',
        security: bearer,
        responses: { '200': okResponse('Triage and workload figures.'), '403': errorResponse('Requires a supervisor role.') },
      },
    },
    '/api/supervisor/reports/triage': {
      get: {
        tags: ['Supervisor'],
        summary: 'Unassigned reports waiting for triage',
        security: bearer,
        responses: { '200': okResponse('Reports and team suggestions.'), '403': errorResponse('Requires a supervisor role.') },
      },
    },
    '/api/supervisor/reports/{id}/assign': {
      patch: {
        tags: ['Supervisor'],
        summary: 'Assign or reassign a report',
        security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['teamId'],
                properties: { teamId: { type: 'integer' }, note: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': okResponse('The assigned report.'),
          '400': errorResponse('The team is inactive.'),
          '409': errorResponse('The report cannot be assigned in its current state.'),
        },
      },
    },
    '/api/supervisor/reports/{id}/suggestions': {
      get: {
        tags: ['Supervisor'],
        summary: 'Ranked teams for a report',
        security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': okResponse('Teams with match scores and reasons.') },
      },
    },
    '/api/supervisor/teams': {
      get: {
        tags: ['Supervisor'],
        summary: 'List teams',
        security: bearer,
        responses: { '200': okResponse('Teams and workloads.') },
      },
      post: {
        tags: ['Supervisor'],
        summary: 'Create a team',
        security: bearer,
        responses: { '201': okResponse('The new team.'), '400': errorResponse('Validation failed.') },
      },
    },
    '/api/admin/dashboard': {
      get: {
        tags: ['Admin'],
        summary: 'Municipal dashboard',
        security: bearer,
        responses: { '200': okResponse('Aggregates and recent activity.'), '403': errorResponse('Requires an admin role.') },
      },
    },
    '/api/admin/reports': {
      get: {
        tags: ['Admin'],
        summary: 'All reports with filters',
        security: bearer,
        responses: { '200': okResponse('A page of reports.'), '403': errorResponse('Requires an admin role.') },
      },
    },
    '/api/admin/reports/{id}/unmerge': {
      post: {
        tags: ['Admin'],
        summary: 'Undo a duplicate merge',
        security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': okResponse('The link was removed.'), '404': errorResponse('No merge to undo.') },
      },
    },
    '/api/admin/webhooks': {
      get: {
        tags: ['Admin'],
        summary: 'List webhook subscriptions',
        security: bearer,
        responses: { '200': okResponse('Subscriptions without secrets.'), '403': errorResponse('Requires an admin role.') },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create a webhook subscription',
        description:
          'Only public HTTPS URLs are accepted. The signing secret is returned once, on creation. ' +
          'Events: report.created, report.assigned, report.status_changed, report.merged, report.unmerged.',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['url', 'events'],
                properties: {
                  url: { type: 'string', format: 'uri', description: 'Public HTTPS endpoint.' },
                  events: { type: 'array', items: { type: 'string' }, minItems: 1 },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': okResponse('Subscription and its one-time secret.'),
          '400': errorResponse('URL rejected or validation failed.'),
        },
      },
    },
    '/api/admin/webhooks/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      patch: {
        tags: ['Admin'],
        summary: 'Update a subscription',
        security: bearer,
        responses: { '200': okResponse('The updated subscription.'), '404': errorResponse('Subscription not found.') },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Delete a subscription and its deliveries',
        security: bearer,
        responses: { '200': okResponse('Subscription deleted.'), '404': errorResponse('Subscription not found.') },
      },
    },
    '/api/admin/webhooks/{id}/rotate-secret': {
      post: {
        tags: ['Admin'],
        summary: 'Rotate the signing secret',
        security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': okResponse('The new one-time secret.'), '404': errorResponse('Subscription not found.') },
      },
    },
    '/api/admin/webhooks/{id}/deliveries': {
      get: {
        tags: ['Admin'],
        summary: 'Recent deliveries for a subscription',
        security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': okResponse('Delivery status, attempts and last error.'), '404': errorResponse('Subscription not found.') },
      },
    },
    '/api/public/stats': {
      get: {
        tags: ['Public'],
        summary: 'Anonymised platform statistics',
        responses: { '200': okResponse('Counts by status, category and municipality.') },
      },
    },
    '/api/public/air-quality': {
      get: {
        tags: ['Public'],
        summary: 'Live air quality (Open-Meteo, keyless)',
        parameters: [
          { name: 'lat', in: 'query', required: true, schema: { type: 'number', minimum: -90, maximum: 90 } },
          { name: 'lon', in: 'query', required: true, schema: { type: 'number', minimum: -180, maximum: 180 } },
        ],
        responses: { '200': okResponse('European and US AQI with pollutant readings.'), '502': errorResponse('Upstream unavailable.') },
      },
    },
    '/api/public/holidays': {
      get: {
        tags: ['Public'],
        summary: 'South African public holidays (Nager.Date, keyless)',
        responses: { '200': okResponse('This year’s holidays and the next one.'), '502': errorResponse('Upstream unavailable.') },
      },
    },
    '/api/geo/search': {
      get: {
        tags: ['Geo'],
        summary: 'Place search through Nominatim',
        description: 'Cached for a day and limited to one upstream request per second. Credit OpenStreetMap contributors.',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2, maxLength: 200 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 10, default: 5 } },
        ],
        responses: {
          '200': okResponse('Matches with coordinates and OSM attribution.'),
          '400': errorResponse('Query too short or too long.'),
          '502': errorResponse('Nominatim unavailable.'),
        },
      },
    },
    '/api/geo/reverse': {
      get: {
        tags: ['Geo'],
        summary: 'Address for a coordinate pair',
        parameters: [
          { name: 'lat', in: 'query', required: true, schema: { type: 'number', minimum: -90, maximum: 90 } },
          { name: 'lon', in: 'query', required: true, schema: { type: 'number', minimum: -180, maximum: 180 } },
        ],
        responses: {
          '200': okResponse('Address components and OSM attribution.'),
          '400': errorResponse('Coordinates out of range.'),
          '502': errorResponse('Nominatim unavailable.'),
        },
      },
    },
    '/api/internal/tick': {
      post: {
        tags: ['Internal'],
        summary: 'Run the hourly SLA and delivery tick',
        description:
          'Writes SLA notifications to the outbox, sends due email and webhook deliveries. ' +
          'Called by the scheduled workflow, not by clients.',
        security: [{ tickSecret: [] }],
        responses: {
          '200': okResponse('Counts for SLA checks, email and webhook delivery.'),
          '401': errorResponse('Missing or wrong tick secret.'),
        },
      },
    },
    '/api/openapi.json': {
      get: {
        tags: ['Docs'],
        summary: 'This OpenAPI document',
        responses: { '200': { description: 'The OpenAPI 3.1 document.' } },
      },
    },
    '/api/docs': {
      get: {
        tags: ['Docs'],
        summary: 'Human-readable endpoint index',
        responses: { '200': { description: 'An HTML page generated from this document.' } },
      },
    },
  },
} as const;

export type OpenApiDocument = typeof openApiDocument;
