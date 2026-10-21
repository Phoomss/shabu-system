import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
const source = fs.readFileSync(new URL('../src/lib/payment-display.ts',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}});
vm.runInNewContext(outputText,{exports});
const {formatStoredMoney,legacyInvoiceDocument}=exports;
test('stored decimals are identical in UI and receipt, without floating arithmetic or silently rounding old data',()=>{
  for(const [value,expected] of [['0.30','0.30'],['1000.100000','1,000.10'],['9007199254740993.01','9,007,199,254,740,993.01'],['1.005','1.005'],[0,'0.00'],['-0.01','-0.01']]) assert.equal(formatStoredMoney(value),expected);
  const invoice={invoiceNumber:1,createdAt:'2026-10-21',totalAmount:'0.50',discount:'0.20',netAmount:'0.30',session:{table:{number:'A1'},tier:{priceAdult:'99999.99'}}};
  const html=legacyInvoiceDocument(invoice);
  assert.ok(html.includes('฿'+formatStoredMoney(invoice.netAmount)));assert.ok(html.includes('฿0.50'));assert.ok(!html.includes('99999.99'));
});
test('receipt escapes staff-provided text and never contains raw recipient as a payment QR',()=>{
  const html=legacyInvoiceDocument({invoiceNumber:1,createdAt:'<script>alert(1)</script>',totalAmount:'10',discount:'0',netAmount:'10',promptPayNumber:'SECRET_REFERENCE',session:{table:{number:'<img onerror=alert(1)>'}}});
  assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('SECRET_REFERENCE'));assert.ok(html.includes('ยังไม่ใช่หลักฐานยืนยันรับเงินจริง'));assert.ok(!html.includes('<svg'));
});
test('malformed monetary values are shown as unavailable, not as a guessed charge',()=>{
  for(const value of [null,undefined,NaN,Infinity,'1e99','<b>1</b>']) assert.equal(formatStoredMoney(value),'ไม่ระบุ');
});
