// DESIGN TEST ONLY. Synthetic policies below are not business approval and are not imported by runtime services.
import { Prisma } from '@prisma/client';

type Policy = {
  basis: 'OPEN' | 'CHECKOUT';
  tax: string;
  service: string;
  rounding: Prisma.Decimal.Rounding;
};
function proposedQuote(
  policy: Policy,
  input: {
    opening: string;
    checkout: string;
    child: string;
    adults: number;
    children: number;
    discount: string;
  },
) {
  const unit = new Prisma.Decimal(
    policy.basis === 'OPEN' ? input.opening : input.checkout,
  );
  const subtotal = unit
    .mul(input.adults)
    .plus(new Prisma.Decimal(input.child).mul(input.children));
  const discount = new Prisma.Decimal(input.discount);
  if (discount.isNegative() || discount.gt(subtotal))
    throw new Error('Discount exceeds subtotal');
  const base = subtotal.minus(discount);
  // A fixture-only proposal: exclusive service then tax, final rounding only. Not an approved restaurant rule.
  return base
    .mul(new Prisma.Decimal(1).plus(policy.service))
    .mul(new Prisma.Decimal(1).plus(policy.tax))
    .toDecimalPlaces(2, policy.rounding)
    .toFixed(2);
}
const input = {
  opening: '0.10',
  checkout: '0.20',
  child: '0.20',
  adults: 3,
  children: 1,
  discount: '0.00',
};
describe('UNAPPROVED pricing design fixtures; not checkout acceptance', () => {
  it('opening-price hypothesis produces 0.50 exactly', () => {
    expect(
      proposedQuote(
        {
          basis: 'OPEN',
          tax: '0',
          service: '0',
          rounding: Prisma.Decimal.ROUND_HALF_UP,
        },
        input,
      ),
    ).toBe('0.50');
  });
  it('checkout-price hypothesis differs deliberately: 0.80', () => {
    expect(
      proposedQuote(
        {
          basis: 'CHECKOUT',
          tax: '0',
          service: '0',
          rounding: Prisma.Decimal.ROUND_HALF_UP,
        },
        input,
      ),
    ).toBe('0.80');
  });
  it('discount above the authoritative hypothesis is rejected and full discount has zero net', () => {
    const policy: Policy = {
      basis: 'OPEN',
      tax: '0',
      service: '0',
      rounding: Prisma.Decimal.ROUND_HALF_UP,
    };
    expect(() =>
      proposedQuote(policy, { ...input, discount: '0.51' }),
    ).toThrow();
    expect(proposedQuote(policy, { ...input, discount: '0.50' })).toBe('0.00');
  });
  it('rounding choice is observable and must be approved', () => {
    const example = { ...input, opening: '1.005', adults: 1, children: 0 };
    expect(
      proposedQuote(
        {
          basis: 'OPEN',
          tax: '0',
          service: '0',
          rounding: Prisma.Decimal.ROUND_HALF_UP,
        },
        example,
      ),
    ).toBe('1.01');
    expect(
      proposedQuote(
        {
          basis: 'OPEN',
          tax: '0',
          service: '0',
          rounding: Prisma.Decimal.ROUND_HALF_EVEN,
        },
        example,
      ),
    ).toBe('1.00');
  });
  it('synthetic service/tax order uses exact decimals, without declaring actual tax rates', () => {
    expect(
      proposedQuote(
        {
          basis: 'OPEN',
          tax: '0.07',
          service: '0.10',
          rounding: Prisma.Decimal.ROUND_HALF_UP,
        },
        {
          ...input,
          opening: '100.00',
          adults: 1,
          children: 0,
          discount: '10.00',
        },
      ),
    ).toBe('105.93');
  });
});
