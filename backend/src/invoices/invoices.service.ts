import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventsGateway } from 'src/events/events.gateway';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { SessionStatus, TableStatus } from '@prisma/client';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) { }

  findAll() {
    return this.prisma.invoice.findMany({
      include: {
        session: { include: { table: true, tier: true } },
        user: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        session: { include: { table: true, tier: true } },
        user: { select: { id: true, fullName: true } },
      },
    });
    if (!invoice) throw new NotFoundException(`Invoice #${id} not found`);
    return invoice;
  }

  async create(dto: CreateInvoiceDto, staffId: string) {
    // เช็ค session
    const session = await this.prisma.session.findUnique({
      where: { id: dto.sessionId },
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
          sessionId: dto.sessionId,
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
        where: { id: dto.sessionId },
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
    this.events.emitSessionStatus(dto.sessionId, SessionStatus.CLOSED);

    return invoice;
  }
}