import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import axios from 'axios';
const require = createRequire(import.meta.url);
const user = { id: '00000000-0000-4000-8000-000000000001', username: 'fixture', fullName: 'Test Fixture', role: 'OWNER' };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const turn = () => new Promise(resolve => setImmediate(resolve));
function harness(handler, initialToken = 'old-token', env = {}) {
  const storage = new Map(initialToken ? [['auth-storage', JSON.stringify({ state: { user, accessToken: initialToken }, version: 0 })]] : []);
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const document = { cookie: '' };
  const calls = [], cache = {};
  const mockedAxios = { ...axios, create(config) { return axios.create({ ...config, adapter: async request => {
    calls.push(request);
    const result = await handler(request, calls);
    return { status: 200, statusText: 'OK', headers: {}, config: request, data: { data: result } };
  } }); } };
  function load(name) {
    if (cache[name]) return cache[name];
    const exports = {}; cache[name] = exports;
    const source = fs.readFileSync(new URL(`../src/${name}.ts`, import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
    vm.runInNewContext(outputText, { exports, require(id) {
      if (id === 'axios') return mockedAxios;
      if (id.startsWith('zustand')) return require(id);
      if (id === '@/stores/authStore') return load('stores/authStore');
      if (id.startsWith('./')) return load(`lib/${id.slice(2)}`);
      throw Error(`Unexpected import ${id}`);
    }, localStorage, document, window: { location: { origin: 'http://192.168.50.10:3001' } }, URL, process: { env }, console });
    return exports;
  }
  const api = load('lib/api'), store = load('stores/authStore').useAuthStore;
  return { api, store, storage, calls, document, load };
}
function unauthorized(config, status = 401) {
  throw new axios.AxiosError('Rejected fixture', 'ERR_BAD_REQUEST', config, null, { status, config, data: {}, headers: {}, statusText: 'Denied' });
}
const me = { ...user, role: { name: 'MANAGER' }, permissions: ['orders.read'], kitchenIds: [2] };

test('Zustand uses one JSON envelope; legacy accessToken/cookie copies are removed; cached user is revalidated', async () => {
  const h = harness(() => me);
  h.storage.set('accessToken', 'obsolete-token');
  await h.api.hydrateAuth();
  assert.equal(h.storage.has('accessToken'), false);
  assert.match(h.document.cookie, /Max-Age=0/);
  assert.equal(h.store.getState().user, null);
  await h.api.initializeAuth();
  assert.equal(h.store.getState().user.role, 'MANAGER');
  assert.equal(h.store.getState().status, 'authenticated');
  const envelope = JSON.parse(h.storage.get('auth-storage'));
  assert.equal(typeof envelope.state, 'object');
  assert.equal(envelope.state.accessToken, 'old-token');
  assert.equal(envelope.state.status, undefined);
  h.store.getState().clearAuth();
  assert.equal(JSON.parse(h.storage.get('auth-storage')).state.accessToken, null);
});
test('eight simultaneous 401s use one refresh; a late old-token 401 reuses the new token', async () => {
  const refresh = deferred(), late = deferred();
  const h = harness(async config => {
    if (config.url === '/auth/refresh') { await refresh.promise; return { accessToken: 'new-token' }; }
    if (config.headers.Authorization === 'Bearer old-token') {
      if (config.url === '/late') await late.promise;
      return unauthorized(config);
    }
    return { ok: true };
  });
  await h.api.hydrateAuth();
  const requests = Array.from({ length: 8 }, (_, i) => h.api.default.get(`/data-${i}`));
  const delayed = h.api.default.get('/late');
  await turn();
  assert.equal(h.calls.filter(c => c.url === '/auth/refresh').length, 1);
  refresh.resolve(); await Promise.all(requests);
  late.resolve(); await delayed;
  assert.equal(h.calls.filter(c => c.url === '/auth/refresh').length, 1);
  assert.equal(h.store.getState().accessToken, 'new-token');
});
test('expired refresh invalidates everyone once; no infinite retry or redirect from customer/login errors', async () => {
  const refresh = deferred();
  const h = harness(async config => { if (config.url === '/auth/refresh') await refresh.promise; return unauthorized(config); });
  await h.api.hydrateAuth();
  const pending = Promise.allSettled(Array.from({ length: 5 }, () => h.api.default.get('/private')));
  await turn(); refresh.resolve();
  assert.equal((await pending).filter(r => r.status === 'rejected').length, 5);
  assert.equal(h.store.getState().status, 'anonymous');
  assert.equal(h.store.getState().user, null);
  await assert.rejects(h.api.default.post('/auth/login', {}));
  await assert.rejects(h.api.createCustomerApi('customer-only').get('/private'));
  assert.equal(h.calls.filter(c => c.url === '/auth/refresh').length, 1);
});
test('second 401 stops after one retry; 403 does not trigger staff refresh', async () => {
  const h = harness(config => config.url === '/auth/refresh' ? { accessToken: 'new-token' } : unauthorized(config));
  await h.api.hydrateAuth();
  await assert.rejects(h.api.default.get('/private'));
  assert.equal(h.calls.filter(c => c.url === '/private').length, 2);
  assert.equal(h.store.getState().status, 'anonymous');
  const denied = harness(config => unauthorized(config, 403));
  await denied.api.hydrateAuth(); await assert.rejects(denied.api.default.get('/private'));
  assert.equal(denied.calls.length, 1);
});
test('hydrate /auth/me is single-flight and restores user after expired access refresh', async () => {
  const h = harness(config => {
    if (config.url === '/auth/refresh') return { accessToken: 'renewed' };
    if (config.headers.Authorization === 'Bearer old-token') return unauthorized(config);
    return me;
  });
  await Promise.all([h.api.initializeAuth(), h.api.initializeAuth(), h.api.initializeAuth()]);
  assert.equal(h.calls.filter(c => c.url === '/auth/refresh').length, 1);
  assert.equal(h.calls.filter(c => c.url === '/auth/me').length, 2);
  assert.equal(h.store.getState().user.fullName, user.fullName);
  assert.equal(h.store.getState().user.role, 'MANAGER');
});
test('logout/session invalidation cannot be undone by delayed refresh or /auth/me', async () => {
  const wait = deferred();
  const h = harness(async config => { await wait.promise; return config.url === '/auth/refresh' ? { accessToken: 'too-late' } : me; });
  await h.api.hydrateAuth();
  const refresh = h.api.refreshAccessToken();
  h.store.getState().clearAuth(); wait.resolve();
  await assert.rejects(refresh);
  assert.equal(h.store.getState().accessToken, null);
  const waitMe = deferred(), second = harness(async () => { await waitMe.promise; return me; });
  const initialize = second.api.initializeAuth(); await turn();
  second.store.getState().clearAuth(); waitMe.resolve(); await assert.rejects(initialize);
  assert.equal(second.store.getState().user, null);
});
test('logout waits for rotation then revokes server session; clears locally even on network failure', async () => {
  const wait = deferred();
  const h = harness(async config => {
    if (config.url === '/auth/refresh') { await wait.promise; return { accessToken: 'renewed' }; }
    assert.equal(config.headers.Authorization, 'Bearer renewed'); return null;
  });
  await h.api.hydrateAuth();
  const refresh = h.api.refreshAccessToken(), logout = h.api.logoutStaff();
  assert.equal(h.store.getState().status, 'logging-out');
  await turn(); assert.equal(h.calls.length, 1);
  wait.resolve(); await Promise.all([refresh, logout]);
  assert.equal(h.calls.at(-1).url, '/auth/logout');
  assert.equal(h.store.getState().status, 'anonymous');
  const offline = harness(() => { throw Error('Network unavailable'); });
  await offline.api.hydrateAuth(); await assert.rejects(offline.api.logoutStaff());
  assert.equal(offline.store.getState().accessToken, null);
});
test('transient errors keep credentials and let hydration retry; no cached user grants UI access', async () => {
  let offline = true;
  const h = harness(() => { if (offline) throw Error('Network unavailable'); return me; });
  await assert.rejects(h.api.initializeAuth());
  assert.equal(h.store.getState().status, 'error');
  assert.equal(h.store.getState().accessToken, 'old-token');
  offline = false; await h.api.initializeAuth();
  assert.equal(h.store.getState().status, 'authenticated');
});
test('blank browser endpoint config follows LAN host and QR origin; explicit build values win', () => {
  const h = harness(() => null), endpoints = h.load('lib/endpoints');
  assert.equal(endpoints.apiUrl(), 'http://192.168.50.10:3000');
  assert.equal(endpoints.socketUrl(), 'http://192.168.50.10:3000');
  assert.equal(endpoints.appUrl(), 'http://192.168.50.10:3001');
  const explicit = harness(() => null, null, { NEXT_PUBLIC_API_URL: 'https://api.example.com/', NEXT_PUBLIC_APP_URL: 'https://app.example.com/' }).load('lib/endpoints');
  assert.equal(explicit.apiUrl(), 'https://api.example.com');
  assert.equal(explicit.socketUrl(), 'https://api.example.com');
});

test('an explicit local logout survives reload even when the server cookie could not be revoked', async () => {
  const first = harness(() => { throw Error('Network unavailable'); });
  await first.api.hydrateAuth(); await assert.rejects(first.api.logoutStaff());
  const second = harness(() => ({ accessToken: 'would-resurrect-session' }));
  second.storage.set('auth-storage', first.storage.get('auth-storage'));
  await second.api.initializeAuth();
  assert.equal(second.calls.length, 0);
  assert.equal(second.store.getState().status, 'anonymous');
  assert.equal(second.store.getState().signedOut, true);
});
