import { BadRequestException } from '@nestjs/common';
import { IdPrefix, IdTransformer } from './id-transformer.util';

describe('ID boundary contract', () => {
  const ids = new IdTransformer();
  const uuid = 'aabbccdd-0000-4000-8000-000000000001';
  it('roundtrips raw and prefixed UUIDs without using display numbers', () => {
    const encoded = ids.encode(uuid, IdPrefix.SESSION);
    expect(encoded).toBe('ses_aabbccdd000040008000000000000001');
    expect(ids.decode(encoded, IdPrefix.SESSION)).toBe(uuid);
    expect(ids.decode(uuid, IdPrefix.SESSION)).toBe(uuid);
  });
  it.each([
    '',
    'SES-000001',
    '123',
    'ses_bad',
    'ses_0000',
    'unknown_' + uuid.replace(/-/g, ''),
  ])('rejects malformed UUID/display number %s with HTTP 400', (value) => {
    expect(() => ids.decode(value, IdPrefix.SESSION)).toThrow(
      BadRequestException,
    );
  });
  it('rejects a valid UUID encoded as the wrong entity', () => {
    expect(() =>
      ids.decode(ids.encode(uuid, IdPrefix.INVOICE), IdPrefix.SESSION),
    ).toThrow(BadRequestException);
  });
  it.each([1, '1', 'tbl_000001'])('decodes integer alias %s', (value) => {
    expect(ids.decodeInt(value, IdPrefix.TABLE)).toBe(1);
  });
  it.each([
    'tbl_1junk',
    'tier_000001',
    '1.5',
    '',
    ' 1',
    -1,
    0,
    1.5,
    2147483648,
  ])('rejects invalid integer ID %s', (value) => {
    expect(() => ids.decodeInt(value, IdPrefix.TABLE)).toThrow(
      BadRequestException,
    );
  });
});
