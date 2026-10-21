import {
  ServiceUnavailableException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventsGateway } from 'src/events/events.gateway';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { Invoice, Session, Table, Tier } from '@prisma/client';
import { PAYMENT_READINESS } from './payment-readiness';
import { IdTransformer, IdPrefix } from 'src/common/utils/id-transformer.util';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
    private idTransformer: IdTransformer,
  ) {}

  findAll() {
    return this.prisma.invoice
      .findMany({
        include: {
          session: { include: { table: true, tier: true } },
          user: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      .then((invoices) =>
        invoices.map((invoice) => this.transformResponse(invoice)),
      );
  }

  async findOne(id: string) {
    // Decode the prefixed ID to raw UUID
    const rawId = this.idTransformer.decode(id, IdPrefix.INVOICE);

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: rawId },
      include: {
        session: { include: { table: true, tier: true } },
        user: { select: { id: true, fullName: true } },
      },
    });
    if (!invoice) throw new NotFoundException(`Invoice #${id} not found`);
    return this.transformResponse(invoice);
  }

  create(dto: CreateInvoiceDto, staffId: string): never {
    this.idTransformer.decode(dto.sessionId, IdPrefix.SESSION);
    this.idTransformer.decode(staffId, IdPrefix.USER);
    // Fail closed: no client-controlled amount may create a financial record or release a table.
    // Implement approved quotes/settlement/idempotency together after the business decisions are signed off.
    throw new ServiceUnavailableException(PAYMENT_READINESS);
  }

  async getTotalRevenue() {
    const result = await this.prisma.invoice.aggregate({
      _sum: {
        netAmount: true,
      },
    });
    return {
      totalRevenue: result._sum.netAmount || 0,
    };
  }

  /**
   * Transform invoice response to use prefixed IDs
   */
  private transformResponse<
    T extends Invoice & { session: Session & { table: Table; tier: Tier } },
  >(invoice: T) {
    return {
      ...invoice,
      id: this.idTransformer.encode(invoice.id, IdPrefix.INVOICE),
      sessionId: this.idTransformer.encode(invoice.sessionId, IdPrefix.SESSION),
      createdBy: this.idTransformer.encode(invoice.createdBy, IdPrefix.USER),
      session: {
        ...invoice.session,
        id: this.idTransformer.encode(invoice.session.id, IdPrefix.SESSION),
        tableId: this.idTransformer.encodeInt(
          invoice.session.tableId,
          IdPrefix.TABLE,
        ),
        tierId: this.idTransformer.encodeInt(
          invoice.session.tierId,
          IdPrefix.TIER,
        ),
        table: {
          ...invoice.session.table,
          id: this.idTransformer.encodeInt(
            invoice.session.table.id,
            IdPrefix.TABLE,
          ),
        },
        tier: {
          ...invoice.session.tier,
          id: this.idTransformer.encodeInt(
            invoice.session.tier.id,
            IdPrefix.TIER,
          ),
        },
      },
    };
  }
}
