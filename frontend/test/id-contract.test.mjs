import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exportsObject = {};
const source = fs.readFileSync(new URL('../src/lib/id-contract.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
vm.runInNewContext(outputText, { exports: exportsObject });
const { normalizeIds } = exportsObject;
test('REST and Socket session IDs resolve to the same frontend identity', () => {
  const raw = '00000000-0000-4000-8000-000000000001';
  const wire = { id: 'ses_00000000000040008000000000000001', tableId: 'tbl_000001', tier: { id: 'tier_000002' } };
  const rest = normalizeIds(wire);
  const socket = normalizeIds({ sessionId: raw, tableId: 1 });
  assert.equal(rest.id, socket.sessionId);
  assert.equal(rest.tableId, socket.tableId);
  assert.equal(rest.tier.id, 2);
  assert.equal(wire.tableId, 'tbl_000001'); // no mutation of cached source responses
});
test('normalizes nested order and invoice references without treating display numbers as PKs', () => {
  const result = normalizeIds({ data: [{ invoiceNumber: 23, id: 'inv_00000000000040008000000000000001', session: { table: { id: 'tbl_000001' } } }] });
  assert.equal(typeof result.data[0].id, 'string');
  assert.equal(result.data[0].session.table.id, 1);
  assert.equal(result.data[0].invoiceNumber, 23);
});
test('does not decode names, QR credentials or malformed/unknown ID strings', () => {
  const result = normalizeIds({ name: 'tbl_000001', qrToken: 'ses_00000000000040008000000000000001', id: 'tbl_1junk', tableId: 'other_1' });
  assert.equal(result.name, 'tbl_000001');
  assert.equal(result.qrToken, 'ses_00000000000040008000000000000001');
  assert.equal(result.id, 'tbl_1junk');
  assert.equal(result.tableId, 'other_1');
});
