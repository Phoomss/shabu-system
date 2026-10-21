import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function setup() {
  let staffToken = 'staff-one';
  const creations = [];
  const connections = [];
  const axios = { create(config) {
    const handlers = { request: [], response: [] };
    const client = { config, handlers, interceptors: {
      request: { use(handler) { handlers.request.push(handler); } },
      response: { use(...handler) { handlers.response.push(handler); } },
    } };
    creations.push(client); return client;
  } };
  const io = (url, config) => {
    const handlers = {};
    const socket = { config, url, onAny() {}, on(name, handler) { handlers[name] = handler; } };
    connections.push(socket); return socket;
  };
  const cache = {};
  function load(name) {
    if (cache[name]) return cache[name];
    const exports = {};
    const source = fs.readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
    vm.runInNewContext(outputText, {
      exports, require(id) {
        if (id === 'axios') return axios;
        if (id === 'socket.io-client') return { io };
        if (id.startsWith('./')) return load(id.slice(2));
        throw new Error(`Unexpected dependency ${id}`);
      },
      process: { env: { NEXT_PUBLIC_API_URL: 'http://localhost:3000', NEXT_PUBLIC_SOCKET_URL: 'http://localhost:3000' } },
      localStorage: { getItem: () => staffToken },
      console: { log() {}, error() {} },
    });
    cache[name] = exports; return exports;
  }
  return { load, creations, connections, rotate: (value) => { staffToken = value; } };
}

test('QR exchange does not send staff cookies; customer client sends only its scoped bearer', () => {
  const context = setup(); const api = context.load('api');
  api.createCustomerApi('customer-A'); api.createCustomerApi('customer-B');
  assert.equal(context.creations[0].config.withCredentials, true);
  assert.equal(context.creations[1].config.withCredentials, false);
  assert.equal(context.creations[2].config.withCredentials, false);
  assert.equal(context.creations[2].config.headers.Authorization, 'Bearer customer-A');
  assert.equal(context.creations[3].config.headers.Authorization, 'Bearer customer-B');
  assert.equal(context.creations[2].handlers.request.length, 0); // never uses staff localStorage interceptor
});

test('customer sockets are isolated and never carry the staff token', () => {
  const context = setup(); const sockets = context.load('socket');
  sockets.createCustomerSocket('customer-A'); sockets.createCustomerSocket('customer-B');
  assert.equal(context.connections[0].config.auth.customerToken, 'customer-A');
  assert.equal(context.connections[1].config.auth.customerToken, 'customer-B');
  assert.equal(context.connections[0].config.auth.accessToken, undefined);
  assert.equal(context.connections[0].config.autoConnect, false);
  assert.notEqual(context.connections[0], context.connections[1]);
});

test('staff reconnect handshake retrieves the current access token, not a cached login token', () => {
  const context = setup(); const sockets = context.load('socket');
  sockets.getSocket(); const auth = context.connections[0].config.auth;
  let supplied;
  auth((payload) => { supplied = payload.accessToken; }); assert.equal(supplied, 'staff-one');
  context.rotate('staff-refreshed');
  auth((payload) => { supplied = payload.accessToken; }); assert.equal(supplied, 'staff-refreshed');
});
