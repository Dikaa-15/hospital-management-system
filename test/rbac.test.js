const { allowRoles } = require('../src/middlewares/rbac');

function makeRes() {
  return {
    statusCode: null,
    rendered: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    render(view, locals) {
      this.rendered = { view, locals };
      return this;
    }
  };
}

describe('allowRoles middleware', () => {
  test('calls next() when session role matches', () => {
    const req = { session: { user: { role: 'admin' } } };
    const res = makeRes();
    const next = jest.fn();

    allowRoles('admin')(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });

  test('renders 403 forbidden when role does not match', () => {
    const req = { session: { user: { role: 'patient' } } };
    const res = makeRes();
    const next = jest.fn();

    allowRoles('admin')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.rendered.view).toBe('partials/forbidden');
  });

  test('matches roles case-insensitively and trims whitespace', () => {
    const req = { session: { user: { role: '  Admin  ' } } };
    const res = makeRes();
    const next = jest.fn();

    allowRoles('admin')(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('rejects when there is no session user', () => {
    const req = { session: {} };
    const res = makeRes();
    const next = jest.fn();

    allowRoles('admin')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  test('accepts any of multiple allowed roles', () => {
    const req = { session: { user: { role: 'pharmacist' } } };
    const res = makeRes();
    const next = jest.fn();

    allowRoles('admin', 'pharmacist')(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
