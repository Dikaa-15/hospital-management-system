const { verifyCredentials } = require('../src/modules/auth/auth.service');

describe('auth.service verifyCredentials (AUTH_MODE=demo)', () => {
  beforeEach(() => {
    process.env.AUTH_MODE = 'demo';
  });

  test('accepts correct demo credentials and returns the mapped user', async () => {
    const user = await verifyCredentials('admin@gmail.com', 'password');
    expect(user).toMatchObject({ username: 'admin@gmail.com', role: 'admin' });
  });

  test('rejects a wrong password', async () => {
    const user = await verifyCredentials('admin@gmail.com', 'wrong-password');
    expect(user).toBeNull();
  });

  test('rejects an unknown identifier', async () => {
    const user = await verifyCredentials('nobody@example.com', 'password');
    expect(user).toBeNull();
  });

  test('matches identifier case-insensitively', async () => {
    const user = await verifyCredentials('ADMIN@GMAIL.COM', 'password');
    expect(user).toMatchObject({ role: 'admin' });
  });

  test('does not leak the password hash on the returned user', async () => {
    const user = await verifyCredentials('admin@gmail.com', 'password');
    expect(user.passwordHash).toBeUndefined();
  });
});
