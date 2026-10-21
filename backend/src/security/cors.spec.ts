import { allowedOrigin, validateCorsOrigins } from './cors';
describe('Exact CORS environment contract', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });
  it('requires explicit origins in production and rejects wildcard/path origins', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ORIGINS;
    expect(() => validateCorsOrigins()).toThrow('required');
    for (const origin of [
      '*',
      'http://192.168.1.87:3001/order',
      'ftp://host',
    ]) {
      process.env.CORS_ORIGINS = origin;
      expect(() => validateCorsOrigins()).toThrow();
    }
  });
  it('allows configured LAN origins only, while retaining non-browser credential checks', () => {
    process.env.CORS_ORIGINS =
      'http://192.168.1.87:3001,https://app.example.com';
    expect(allowedOrigin('http://192.168.1.87:3001')).toBe(true);
    expect(allowedOrigin('http://192.168.1.88:3001')).toBe(false);
    expect(allowedOrigin('https://untrusted.example')).toBe(false);
    expect(allowedOrigin(undefined)).toBe(true);
  });
});
