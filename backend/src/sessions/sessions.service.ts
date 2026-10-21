import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventsGateway } from 'src/events/events.gateway';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionStatusDto } from './dto/update-session-status.dto';
import { SessionStatus, TableStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IdTransformer, IdPrefix } from 'src/common/utils/id-transformer.util';

@Injectable()
export class SessionsService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
    private idTransformer: IdTransformer,
  ) {}

  async findAll() {
    return this.prisma.session
      .findMany({
        include: {
          table: true,
          tier: true,
          _count: { select: { orders: true } },
        },
        orderBy: { startTime: 'desc' },
      })
      .then((sessions) =>
        sessions.map((session) => this.transformResponse(session)),
      );
  }

  async findOne(id: string) {
    // Decode the prefixed ID to raw UUID
    const rawId = this.idTransformer.decode(id, IdPrefix.SESSION);

    const session = await this.prisma.session.findUnique({
      where: { id: rawId },
      include: { table: true, tier: true, orders: true },
    });
    if (!session) throw new NotFoundException(`Session #${id} not found`);
    return this.transformResponse(session);
  }

  async findByQrToken(qrToken: string) {
    const session = await this.prisma.session.findUnique({
      where: { qrToken },
      include: {
        table: true,
        tier: {
          include: {
            tierMenuItems: {
              include: {
                menuItem: { include: { category: true, kitchen: true } },
              },
            },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Invalid QR Token');
    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException('Session is no longer active');
    }
    return this.transformResponse(session);
  }

  async create(dto: CreateSessionDto) {
    // เช็คว่าโต๊ะมีอยู่และว่างอยู่มั้ย
    const table = await this.prisma.table.findUnique({
      where: { id: dto.tableId },
    });
    if (!table) throw new NotFoundException(`Table #${dto.tableId} not found`);
    if (table.status !== TableStatus.AVAILABLE) {
      throw new BadRequestException(`Table #${table.number} is not available`);
    }

    // เช็ค tier
    const tier = await this.prisma.tier.findUnique({
      where: { id: dto.tierId },
    });
    if (!tier) throw new NotFoundException(`Tier #${dto.tierId} not found`);

    // คำนวณเวลาสิ้นสุด
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + tier.timeLimit * 60 * 1000);

    // สร้าง session และอัปเดต table status พร้อมกัน
    const [session] = await this.prisma.$transaction([
      this.prisma.session.create({
        data: {
          tableId: dto.tableId,
          tierId: dto.tierId,
          adultCount: dto.adultCount,
          childCount: dto.childCount,
          qrToken: randomUUID(),
          startTime,
          endTime,
        },
        include: { table: true, tier: true },
      }),
      this.prisma.table.update({
        where: { id: dto.tableId },
        data: { status: TableStatus.OCCUPIED },
      }),
    ]);

    // [Socket] แจ้งอัปเดต table status
    this.events.emitTableStatus(dto.tableId, TableStatus.OCCUPIED);

    return this.transformResponse(session);
  }

  async updateStatus(id: string, dto: UpdateSessionStatusDto) {
    const rawId = this.idTransformer.decode(id, IdPrefix.SESSION);
    const closesTable =
      dto.status === SessionStatus.CLOSED ||
      dto.status === SessionStatus.EXPIRED;
    // Keep records raw until commit; never use a response DTO for DB queries.
    const updated = await this.prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({ where: { id: rawId } });
      if (!session) throw new NotFoundException(`Session #${id} not found`);
      if (closesTable) {
        await tx.table.update({
          where: { id: session.tableId },
          data: { status: TableStatus.CLEANING },
        });
      }
      return tx.session.update({
        where: { id: rawId },
        data: { status: dto.status },
        include: { table: true, tier: true },
      });
    });
    this.events.emitSessionStatus(rawId, dto.status);
    if (closesTable)
      this.events.emitTableStatus(updated.tableId, TableStatus.CLEANING);

    return this.transformResponse(updated);
  }

  // [Socket] Cron job ตรวจสอบทุก 1 นาที
  @Cron(CronExpression.EVERY_MINUTE)
  async checkSessionTime() {
    const now = new Date();
    const warningTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 นาทีข้างหน้า

    const activeSessions = await this.prisma.session.findMany({
      where: { status: SessionStatus.ACTIVE },
    });

    for (const session of activeSessions) {
      // หมดเวลาแล้ว
      if (session.endTime <= now) {
        await this.updateStatus(session.id, { status: SessionStatus.EXPIRED });
      }
      // เหลือ 15 นาที
      else if (session.endTime <= warningTime) {
        const minutesLeft = Math.ceil(
          (session.endTime.getTime() - now.getTime()) / 60000,
        );
        this.events.emitSessionWarning(session.id, minutesLeft);
      }
    }
  }

  /**
   * Transform session response to use prefixed IDs
   */
  private transformResponse(session: any) {
    return {
      ...session,
      id: this.idTransformer.encode(session.id, IdPrefix.SESSION),
      tableId: this.idTransformer.encodeInt(session.tableId, IdPrefix.TABLE),
      tierId: this.idTransformer.encodeInt(session.tierId, IdPrefix.TIER),
      table: {
        ...session.table,
        id: this.idTransformer.encodeInt(session.table.id, IdPrefix.TABLE),
      },
      tier: {
        ...session.tier,
        id: this.idTransformer.encodeInt(session.tier.id, IdPrefix.TIER),
      },
    };
  }
}
