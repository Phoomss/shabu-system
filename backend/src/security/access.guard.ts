import {
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomerAuthService,
  CustomerIdentity,
} from '../customer/customer-auth.service';
import { IdPrefix, IdTransformer } from '../common/utils/id-transformer.util';
import { ACCESS, PERMISSION, RESOURCE } from './access.decorators';
import { PermissionPolicy, PolicyUser } from './policy';
export type CustomerRequest = Request & { customer: CustomerIdentity };
@Injectable()
export class AccessGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly policy: PermissionPolicy,
    private readonly customer: CustomerAuthService,
    private readonly prisma: PrismaService,
    private readonly ids: IdTransformer,
  ) {
    super();
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const mode = this.reflector.getAllAndOverride<string>(ACCESS, targets);
    if (mode === 'public') return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (mode === 'customer') {
      const match = /^Bearer (\S+)$/i.exec(req.headers.authorization || '');
      if (!match)
        throw new UnauthorizedException('Customer credential required');
      (req as CustomerRequest).customer = await this.customer.verify(match[1]);
      return true;
    }
    await super.canActivate(context);
    const user = req.user as PolicyUser;
    const resource = this.reflector.getAllAndOverride<string>(
      RESOURCE,
      targets,
    );
    const permission =
      this.reflector.getAllAndOverride<string>(PERMISSION, targets) ||
      (resource
        ? `${resource}.${['GET', 'HEAD'].includes(req.method) ? 'read' : 'write'}`
        : undefined);
    this.policy.assert(user, permission);
    if (permission?.startsWith('kitchen.orders.')) {
      let kitchenId: number;
      if (req.params.kitchenId !== undefined)
        kitchenId = this.ids.decodeInt(
          req.params.kitchenId as string,
          IdPrefix.KITCHEN,
        );
      else {
        const id = this.ids.decode(
          req.params.itemId as string,
          IdPrefix.ORDER_ITEM,
        );
        const item = await this.prisma.orderItem.findUnique({
          where: { id },
          select: { kitchenId: true },
        });
        if (!item) throw new NotFoundException('Order item not found');
        kitchenId = item.kitchenId;
      }
      this.policy.assertKitchen(user, kitchenId, permission);
    }
    return true;
  }
}
