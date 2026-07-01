const { requireAuth, requireGuest } = require('../src/middlewares/auth');

function makeRes() {
  return {
    redirectedTo: null,
    redirect(url) {
      this.redirectedTo = url;
    }
  };
}

describe('requireAuth', () => {
  test('redirects to /login when not authenticated', () => {
    const req = { session: {} };
    const res = makeRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirectedTo).toMatch(/^\/login/);
  });

  test('calls next() when session user exists', () => {
    const req = { session: { user: { id: '1' } } };
    const res = makeRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.redirectedTo).toBeNull();
  });
});

describe('requireGuest', () => {
  test('redirects to /dashboard when already authenticated', () => {
    const req = { session: { user: { id: '1' } } };
    const res = makeRes();
    const next = jest.fn();

    requireGuest(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirectedTo).toBe('/dashboard');
  });

  test('calls next() when not authenticated', () => {
    const req = { session: {} };
    const res = makeRes();
    const next = jest.fn();

    requireGuest(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.redirectedTo).toBeNull();
  });
});
