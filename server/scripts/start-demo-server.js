'use strict';

// The launcher supplies a new local database and blank provider credentials.
const { assertLocalOnly } = require('../prisma/seedDemo');
assertLocalOnly();
require('../src/server').listen(Number(process.env.PORT), '127.0.0.1');
