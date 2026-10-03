'use strict';

const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { startApp, TEST_PASSWORD } = require('./helpers/harness');

describe('authentication', () => {
  let h;

  before(async () => {
    h = await startApp();
  });
  after(() => h.close());
  beforeEach(() => h.reset());

  const login = (email, password, ip) => h.api('POST', '/api/auth/login', { body: { email, password }, ip });

  describe('login', () => {
    test('returns a signed token and a user without password or OTP fields', async () => {
      const user = h.makeUser({ email: 'citizen.one@example.com' });

      const res = await login('citizen.one@example.com', h.password);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const { token, user: returned } = res.body.data;
      assert.equal(jwt.verify(token, h.secret).userId, user.id);
      assert.equal(returned.email, 'citizen.one@example.com');
      for (const field of ['password', 'emailVerifToken', 'emailVerifExpiry']) {
        assert.ok(!(field in returned), `${field} must not be returned`);
      }
      assert.ok(h.db.tables.user[0].lastLogin instanceof Date);
      assert.ok(h.db.tables.activityLog.some((log) => log.action === 'LOGIN' && log.userId === user.id));
    });

    test('matches the email case-insensitively', async () => {
      h.makeUser({ email: 'citizen.one@example.com' });

      const res = await login('Citizen.One@EXAMPLE.com', h.password);

      assert.equal(res.status, 200);
    });

    test('answers a wrong password and an unknown email identically', async () => {
      const user = h.makeUser();

      const wrongPassword = await login(user.email, h.wrongPassword);
      const unknownEmail = await login('nobody@example.com', h.password);

      assert.equal(wrongPassword.status, 401);
      assert.equal(wrongPassword.body.errorCode, 'INVALID_CREDENTIALS');
      assert.deepEqual(unknownEmail.body, wrongPassword.body);
      assert.ok(h.db.tables.activityLog.some((log) => log.action === 'LOGIN_FAILED' && log.userId === user.id));
    });

    test('refuses a deactivated account', async () => {
      const user = h.makeUser({ isActive: false });

      const res = await login(user.email, h.password);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'ACCOUNT_DEACTIVATED');
    });

    test('rejects a malformed body with VALIDATION_ERROR', async () => {
      const badEmail = await login('not-an-email', 'whatever');
      const noPassword = await h.api('POST', '/api/auth/login', { body: { email: 'a@example.com' } });

      for (const res of [badEmail, noPassword]) {
        assert.equal(res.status, 400);
        assert.equal(res.body.errorCode, 'VALIDATION_ERROR');
      }
    });

    test('blocks the sixth failed attempt from one address, even with the right password', async () => {
      const user = h.makeUser();
      const ip = '203.0.113.7'; // documentation address (TEST-NET-3)

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        assert.equal((await login(user.email, h.wrongPassword, ip)).status, 401);
      }

      assert.equal((await login(user.email, h.wrongPassword, ip)).status, 429);
      assert.equal((await login(user.email, h.password, ip)).status, 429);
    });

    test('does not count successful logins against that limit', async () => {
      const user = h.makeUser();
      const ip = '203.0.113.8';

      for (let attempt = 1; attempt <= 7; attempt += 1) {
        assert.equal((await login(user.email, h.password, ip)).status, 200);
      }
    });
  });

  describe('registration', () => {
    const newPerson = {
      firstName: 'Thandi',
      lastName: 'Demo',
      email: 'new.person@example.com',
      password: TEST_PASSWORD,
      phone: '0821234567',
    };

    test('creates an unverified CITIZEN even if the body asks for more', async () => {
      const res = await h.api('POST', '/api/auth/register', {
        body: { ...newPerson, role: 'SUPER_ADMIN', isVerified: true, isActive: false },
      });

      assert.equal(res.status, 201);
      const { user, token } = res.body.data;
      assert.equal(user.role, 'CITIZEN');
      assert.equal(user.isVerified, false);
      assert.equal(user.isActive, true);
      assert.equal(jwt.verify(token, h.secret).userId, user.id);

      const stored = h.db.tables.user.find((row) => row.id === user.id);
      assert.equal(stored.role, 'CITIZEN');
      assert.match(stored.password, /^\$2[aby]\$/, 'the password is stored as a bcrypt hash');
      assert.notEqual(stored.password, newPerson.password);
    });

    test('emails a six-digit code and stores only its SHA-256 hash, valid for 15 minutes', async () => {
      await h.api('POST', '/api/auth/register', { body: newPerson });

      assert.equal(h.email.sent.length, 1);
      const [to, firstName, otp] = h.email.sent[0];
      assert.equal(to, 'new.person@example.com');
      assert.equal(firstName, 'Thandi');
      assert.match(otp, /^\d{6}$/);

      const stored = h.db.tables.user[0];
      assert.equal(stored.emailVerifToken, crypto.createHash('sha256').update(otp).digest('hex'));
      const minutesLeft = (stored.emailVerifExpiry - Date.now()) / 60000;
      assert.ok(minutesLeft > 14 && minutesLeft <= 15, `expected about 15 minutes, got ${minutesLeft}`);
    });

    test('refuses a second account for the same email, whatever its case', async () => {
      await h.api('POST', '/api/auth/register', { body: newPerson });

      const res = await h.api('POST', '/api/auth/register', {
        body: { ...newPerson, email: 'New.Person@Example.com' },
      });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'EMAIL_EXISTS');
      assert.equal(h.db.tables.user.length, 1);
    });

    test('rejects weak passwords, bad emails and one-letter names with VALIDATION_ERROR', async () => {
      const cases = [
        { ...newPerson, password: 'password' },
        { ...newPerson, email: 'not-an-email' },
        { ...newPerson, firstName: 'T' },
      ];

      for (const body of cases) {
        const res = await h.api('POST', '/api/auth/register', { body });
        assert.equal(res.status, 400);
        assert.equal(res.body.errorCode, 'VALIDATION_ERROR');
        assert.ok(res.body.errorCount >= 1);
      }
      assert.equal(h.db.tables.user.length, 0);
    });
  });

  describe('email verification', () => {
    async function registerAndGetCode() {
      await h.api('POST', '/api/auth/register', {
        body: {
          firstName: 'Thandi',
          lastName: 'Demo',
          email: 'verify.me@example.com',
          password: TEST_PASSWORD,
        },
      });
      return h.email.sent[0][2];
    }

    test('accepts the emailed code once and clears it', async () => {
      const otp = await registerAndGetCode();

      const res = await h.api('POST', '/api/auth/verify-email', { body: { email: 'verify.me@example.com', otp } });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.user.isVerified, true);
      const stored = h.db.tables.user[0];
      assert.equal(stored.emailVerifToken, null);
      assert.equal(stored.emailVerifExpiry, null);

      const again = await h.api('POST', '/api/auth/verify-email', { body: { email: 'verify.me@example.com', otp } });
      assert.equal(again.status, 400);
      assert.equal(again.body.errorCode, 'ALREADY_VERIFIED');
    });

    test('rejects a wrong code and leaves the account unverified', async () => {
      const otp = await registerAndGetCode();
      const wrong = otp === '000000' ? '000001' : '000000';

      const res = await h.api('POST', '/api/auth/verify-email', { body: { email: 'verify.me@example.com', otp: wrong } });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'INVALID_CODE');
      assert.equal(h.db.tables.user[0].isVerified, false);
    });

    test('rejects an expired code', async () => {
      const otp = await registerAndGetCode();
      h.db.tables.user[0].emailVerifExpiry = new Date(Date.now() - 1000);

      const res = await h.api('POST', '/api/auth/verify-email', { body: { email: 'verify.me@example.com', otp } });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'CODE_EXPIRED');
    });

    test('does not reveal whether an email has an account when asking for a new code', async () => {
      const res = await h.api('POST', '/api/auth/send-verification', { body: { email: 'nobody@example.com' } });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(h.email.sent.length, 0);
    });
  });

  describe('bearer tokens', () => {
    test('/me returns the caller and nothing secret', async () => {
      const user = h.makeUser();

      const res = await h.api('GET', '/api/auth/me', { token: h.tokenFor(user) });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.id, user.id);
      assert.ok(!('password' in res.body.data));
    });

    test('are required, well formed and signed with the server secret', async () => {
      const user = h.makeUser();
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ userId: user.id, role: 'CITIZEN' })).toString('base64url');

      const cases = [
        ['no header', {}, 'NO_TOKEN'],
        ['wrong scheme', { headers: { authorization: 'Token abc' } }, 'INVALID_TOKEN_FORMAT'],
        ['garbage', { token: 'not.a.jwt' }, 'INVALID_TOKEN'],
        ['another secret', { token: h.tokenFor(user, { secret: crypto.randomBytes(32).toString('hex') }) }, 'INVALID_TOKEN'],
        ['unsigned (alg none)', { token: `${header}.${payload}.` }, 'INVALID_TOKEN'],
        ['expired', { token: h.tokenFor(user, { expiresIn: -60 }) }, 'TOKEN_EXPIRED'],
      ];

      for (const [label, options, errorCode] of cases) {
        const res = await h.api('GET', '/api/auth/me', options);
        assert.equal(res.status, 401, label);
        assert.equal(res.body.errorCode, errorCode, label);
      }
    });

    test('stop working when the account is deleted or deactivated', async () => {
      const gone = h.makeUser();
      const deactivated = h.makeUser();
      const goneToken = h.tokenFor(gone);
      const deactivatedToken = h.tokenFor(deactivated);
      h.db.tables.user = h.db.tables.user.filter((row) => row.id !== gone.id);
      h.db.tables.user.find((row) => row.id === deactivated.id).isActive = false;

      const goneRes = await h.api('GET', '/api/auth/me', { token: goneToken });
      const deactivatedRes = await h.api('GET', '/api/auth/me', { token: deactivatedToken });

      assert.equal(goneRes.status, 401);
      assert.equal(goneRes.body.errorCode, 'USER_NOT_FOUND');
      assert.equal(deactivatedRes.status, 403);
      assert.equal(deactivatedRes.body.errorCode, 'ACCOUNT_DEACTIVATED');
    });

    test('carry a role claim that is ignored: the role is read from the database', async () => {
      const citizen = h.makeUser();
      const forged = h.tokenFor(citizen, { claims: { role: 'SUPER_ADMIN' } });

      const me = await h.api('GET', '/api/auth/me', { token: forged });
      const admin = await h.api('GET', '/api/admin/dashboard', { token: forged });

      assert.equal(me.body.data.role, 'CITIZEN');
      assert.equal(admin.status, 403);
      assert.equal(admin.body.errorCode, 'ADMIN_ONLY');
    });

    test('lose admin access as soon as the role is changed in the database', async () => {
      const admin = h.makeUser({ role: 'MUNICIPAL_ADMIN' });
      const token = h.tokenFor(admin);
      assert.equal((await h.api('GET', '/api/admin/dashboard', { token })).status, 200);

      h.db.tables.user.find((row) => row.id === admin.id).role = 'CITIZEN';

      assert.equal((await h.api('GET', '/api/admin/dashboard', { token })).status, 403);
    });
  });

  test('password reset is not implemented yet and says so', async () => {
    const forgot = await h.api('POST', '/api/auth/forgot-password', { body: { email: 'a@example.com' } });
    const reset = await h.api('POST', '/api/auth/reset-password', { body: {} });

    for (const res of [forgot, reset]) {
      assert.equal(res.status, 501);
      assert.equal(res.body.errorCode, 'NOT_IMPLEMENTED');
    }
  });
});
