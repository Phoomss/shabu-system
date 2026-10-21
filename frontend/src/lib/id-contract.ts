/** Legacy HTTP prefixes are serialization aliases. Application IDs stay UUID/Int. */
const uuidPrefixes = new Set(['ses', 'inv', 'ord', 'usr', 'menu', 'oi']);
const intPrefixes = new Set(['tbl', 'tier', 'cat', 'kit', 'ing']);
const idFields = new Set([
  'id', 'sessionId', 'invoiceId', 'orderId', 'orderItemId', 'menuItemId',
  'tableId', 'tierId', 'categoryId', 'kitchenId', 'ingredientId',
  'userId', 'createdBy', 'approvedBy',
]);

export function normalizeIds<T>(input: T): T {
  if (Array.isArray(input)) return input.map((item) => normalizeIds(item)) as T;
  if (input === null || typeof input !== 'object') return input;
  return Object.fromEntries(Object.entries(input).map(([key, value]) => {
    if (idFields.has(key) && typeof value === 'string') {
      const uuid = /^([a-z]+)_([0-9a-f]{32})$/i.exec(value);
      if (uuid && uuidPrefixes.has(uuid[1])) {
        const hex = uuid[2].toLowerCase();
        return [key, `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`];
      }
      const integer = /^([a-z]+)_([0-9]+)$/.exec(value);
      if (integer && intPrefixes.has(integer[1])) {
        const id = Number(integer[2]);
        if (Number.isSafeInteger(id) && id > 0 && id <= 2147483647) return [key, id];
      }
    }
    return [key, normalizeIds(value)];
  })) as T;
}
