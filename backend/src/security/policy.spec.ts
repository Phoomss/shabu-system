import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { PermissionPolicy } from './policy';
import { assertSigningConfiguration } from './signing-config';
const id = '00000000-0000-4000-8000-000000000001';
function policy(grants = {}, assignments = {}) {
  return new PermissionPolicy(
    new ConfigService({
      STAFF_PERMISSION_GRANTS: JSON.stringify(grants),
      KITCHEN_USER_ASSIGNMENTS: JSON.stringify(assignments),
    }),
  );
}
describe('Explicit permission policy', () => {
  it.each(['OWNER', 'MANAGER', 'STAFF', 'KITCHEN', 'CUSTOM'])(
    'denies unapproved %s grants without inferring privileges',
    (name) => {
      expect(() =>
        policy().assert({ id, role: { name } }, 'users.write'),
      ).toThrow(ForbiddenException);
    },
  );
  it('allows only the configured action and the assigned kitchen', () => {
    const p = policy({ KITCHEN: ['kitchen.orders.read'] }, { [id]: [1] });
    const user = { id, role: { name: 'KITCHEN' } };
    expect(() => p.assertKitchen(user, 1, 'kitchen.orders.read')).not.toThrow();
    expect(() => p.assertKitchen(user, 2, 'kitchen.orders.read')).toThrow(
      ForbiddenException,
    );
    expect(() => p.assert(user, 'kitchen.orders.write')).toThrow(
      ForbiddenException,
    );
  });
  it('rejects misspelled/wildcard grants and unsafe assignments at startup', () => {
    expect(() =>
      assertSigningConfiguration(
        new ConfigService({
          JWT_SECRET: 'your_secret_key',
          JWT_REFRESH_SECRET: 'test-refresh-key',
        }),
      ),
    ).toThrow();
    expect(() =>
      assertSigningConfiguration(
        new ConfigService({
          JWT_SECRET: 'test-staff-key',
          JWT_REFRESH_SECRET: 'test-refresh-key',
        }),
      ),
    ).not.toThrow();
    expect(() => policy({ OWNER: ['*'] })).toThrow();
    expect(() => policy({ OWNER: ['users.wirte'] })).toThrow();
    expect(() => policy({}, { [id]: ['1'] })).toThrow();
  });
  it('does not require a business grant to access the authenticated self profile', () => {
    expect(() =>
      policy().assert({ id, role: { name: 'CUSTOM' } }, 'auth.self'),
    ).not.toThrow();
  });
});
