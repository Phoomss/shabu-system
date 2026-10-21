import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const RESOURCES = [
  'users',
  'roles',
  'tables',
  'sessions',
  'orders',
  'menu',
  'tiers',
  'categories',
  'kitchens',
  'ingredients',
  'invoices',
  'payment-settings',
] as const;
export const PERMISSIONS = [
  ...RESOURCES.flatMap((resource) => [`${resource}.read`, `${resource}.write`]),
  'orders.void',
  'void-logs.read',
  'kitchen.orders.read',
  'kitchen.orders.write',
] as const;
export type PolicyUser = { id: string; role: { name: string } };

function objectConfig(
  value: string | undefined,
  name: string,
): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error(`Invalid ${name}`);
  return parsed as Record<string, unknown>;
}

@Injectable()
export class PermissionPolicy {
  private readonly grants = new Map<string, Set<string>>();
  private readonly assignments = new Map<string, Set<number>>();

  constructor(config: ConfigService) {
    // No inferred OWNER/MANAGER privileges while business rules await approval.
    for (const [role, permissions] of Object.entries(
      objectConfig(
        config.get<string>('STAFF_PERMISSION_GRANTS'),
        'STAFF_PERMISSION_GRANTS',
      ),
    )) {
      if (
        !Array.isArray(permissions) ||
        !permissions.every(
          (p: unknown) => typeof p === 'string' && PERMISSIONS.includes(p),
        )
      ) {
        throw new Error('Invalid STAFF_PERMISSION_GRANTS permission');
      }
      this.grants.set(role, new Set(permissions as string[]));
    }
    for (const [userId, kitchens] of Object.entries(
      objectConfig(
        config.get<string>('KITCHEN_USER_ASSIGNMENTS'),
        'KITCHEN_USER_ASSIGNMENTS',
      ),
    )) {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
          userId,
        ) ||
        !Array.isArray(kitchens) ||
        !kitchens.every(
          (id: unknown) =>
            typeof id === 'number' &&
            Number.isSafeInteger(id) &&
            id > 0 &&
            id <= 2147483647,
        )
      ) {
        throw new Error('Invalid KITCHEN_USER_ASSIGNMENTS');
      }
      this.assignments.set(userId, new Set(kitchens as number[]));
    }
  }
  permissions(user: PolicyUser): string[] {
    return [...(this.grants.get(user.role.name) || [])];
  }
  kitchenIds(user: PolicyUser): number[] {
    return [...(this.assignments.get(user.id) || [])];
  }
  allows(user: PolicyUser, permission: string): boolean {
    return this.grants.get(user.role.name)?.has(permission) === true;
  }
  assert(user: PolicyUser, permission?: string): void {
    if (permission === 'auth.self') return;
    if (!permission || !this.allows(user, permission))
      throw new ForbiddenException('Permission denied');
  }
  assertKitchen(user: PolicyUser, kitchenId: number, permission: string): void {
    this.assert(user, permission);
    if (!this.assignments.get(user.id)?.has(kitchenId))
      throw new ForbiddenException('Kitchen access denied');
  }
}
