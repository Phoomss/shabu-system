import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import ts from 'typescript';
function load() {
  const requests = [];
  const source = fs.readFileSync(new URL('../src/lib/workflow-client.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: () => ({ get: async path => { requests.push(path); return { data: { data: [{ id: 1, name: 'Kitchen' }] } }; } }) });
  return { ...exports, requests };
}
test('kitchen client loads the canonical route and returns dropdown entries', async () => {
  const client = load(); const kitchens = await client.listKitchens();
  assert.equal(kitchens[0].id, 1); assert.deepEqual(client.requests, ['/kitchens']);
});
test('QR joins on every connection; history sync waits for authorization; cleanup preserves other consumers', () => {
  const { bindRoomSync } = load(); const socket = new EventEmitter(); socket.connected = false;
  let joined = 0, synced = 0, other = 0;
  socket.on('order:status_changed', () => { other++; });
  const cleanup = bindRoomSync(socket, () => { joined++; }, 'session:joined', () => { synced++; }, ['order:status_changed', 'order:item_status_changed']);
  socket.emit('connect'); assert.equal(joined, 1); assert.equal(synced, 0);
  socket.emit('session:joined'); assert.equal(synced, 1);
  socket.emit('order:item_status_changed'); assert.equal(synced, 2);
  socket.emit('connect'); assert.equal(joined, 2);
  socket.emit('session:joined'); assert.equal(synced, 3);
  cleanup(); socket.emit('connect'); socket.emit('order:status_changed');
  assert.equal(joined, 2); assert.equal(synced, 3); assert.equal(other, 1);
});
test('KDS already-connected mount rejoins; remount has one handler and uses kitchen status event', () => {
  const { bindRoomSync } = load(); const socket = new EventEmitter(); socket.connected = true;
  let joins = 0, syncs = 0;
  const bind = () => bindRoomSync(socket, () => { joins++; }, 'kitchen:joined', () => { syncs++; }, ['kitchen:new_order', 'kitchen:item_status_changed', 'kitchen:void_order']);
  const first = bind(); assert.equal(joins, 1); first();
  const second = bind(); socket.emit('kitchen:item_status_changed'); assert.equal(joins, 2); assert.equal(syncs, 1); second();
  assert.equal(socket.listenerCount('connect'), 0); assert.equal(socket.listenerCount('kitchen:item_status_changed'), 0);
});
test('latest request rejects stale response and invalidates in-flight work at closure/unmount', () => {
  const { latestRequest } = load(); const gate = latestRequest(); const old = gate.begin(), recent = gate.begin();
  assert.equal(gate.isCurrent(old), false); assert.equal(gate.isCurrent(recent), true);
  gate.invalidate(); assert.equal(gate.isCurrent(recent), false);
  const next = gate.begin(); assert.equal(gate.isCurrent(next), true); assert.equal(gate.isCurrent(old), false);
});
