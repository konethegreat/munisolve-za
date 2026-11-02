// The launcher supplies a new local database and blank provider credentials.
import { assertLocalOnly } from '../prisma/seedDemo';

assertLocalOnly();
require('../src/server').listen(Number(process.env.PORT), '127.0.0.1');
