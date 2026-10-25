import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventsGateway } from 'src/events/events.gateway';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { SessionStatus, TableStatus } from '@prisma/client';
import { IdTransformer, IdPrefix } from 'src/common/utils/id-transformer.util';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
    private idTransformer: IdTransformer,
  ) { }

  findAll() {
    return this.prisma.invoice.findMany({
      include: {
        session: { include: { table: true, tier: true } },
        user: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }).then(invoices => invoices.map(invoice => this.transformResponse(invoice)));
  }

  async findOne(id: string) {
    // Decode the prefixed ID to raw UUID
    const rawId = this.idTransformer.decode(id);
    
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

  async create(dto: CreateInvoiceDto, staffId: string) {
    // Decode session ID if it's prefixed
    const rawSessionId = this.idTransformer.decode(dto.sessionId);
    
    // เช็ค session
    const session = await this.prisma.session.findUnique({
      where: { id: rawSessionId },
      include: { table: true },
    });
    if (!session) throw new NotFoundException(`Session #${dto.sessionId} not found`);
    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException('Session is not active');
    }

    const discount = dto.discount ?? 0;
    const netAmount = dto.totalAmount - discount;

    // create invoice, close session, update table together
    const [invoice] = await this.prisma.$transaction([
      this.prisma.invoice.create({
        data: {
          sessionId: rawSessionId,
          totalAmount: dto.totalAmount,
          discount,
          netAmount,
          paymentMethod: dto.paymentMethod,
          promptPayNumber: dto.promptPayNumber,
          createdBy: staffId,
        },
        include: {
          session: { include: { table: true, tier: true } },
          user: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.session.update({
        where: { id: rawSessionId },
        data: { status: SessionStatus.CLOSED },
      }),
      this.prisma.table.update({
        where: { id: session.tableId },
        data: { status: TableStatus.CLEANING },
      }),
    ]);

    // [Socket] noti dashboard owner new amount
    this.events.emitNewInvoice({
      invoiceId: invoice.id,
      netAmount,
      paymentMethod: dto.paymentMethod,
      tableNumber: session.table.number,
      createdAt: invoice.createdAt,
    });

    // [Socket] noti table status
    this.events.emitTableStatus(session.tableId, TableStatus.CLEANING);

    // [Socket] noti session clonse
    this.events.emitSessionStatus(rawSessionId, SessionStatus.CLOSED);

    return this.transformResponse(invoice);
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
  private transformResponse(invoice: any) {
    return {
      ...invoice,
      id: this.idTransformer.encode(invoice.id, IdPrefix.INVOICE),
      sessionId: this.idTransformer.encode(invoice.sessionId, IdPrefix.SESSION),
      createdBy: this.idTransformer.encode(invoice.createdBy, IdPrefix.USER),
      tableNumber: invoice.session.table.number,
      session: {
        ...invoice.session,
        id: this.idTransformer.encode(invoice.session.id, IdPrefix.SESSION),
        tableId: this.idTransformer.encodeInt(invoice.session.tableId, IdPrefix.TABLE),
        tierId: this.idTransformer.encodeInt(invoice.session.tierId, IdPrefix.TIER),
        tableNumber: invoice.session.table.number,
        table: {
          ...invoice.session.table,
          id: this.idTransformer.encodeInt(invoice.session.table.id, IdPrefix.TABLE),
        },
        tier: {
          ...invoice.session.tier,
          id: this.idTransformer.encodeInt(invoice.session.tier.id, IdPrefix.TIER),
        },
      },
    };
  }
}
