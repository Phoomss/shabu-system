import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventsGateway } from 'src/events/events.gateway';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionStatusDto } from './dto/update-session-status.dto';
import {
  SessionStatus,
  TableStatus,
  Prisma,
  Session,
  Table,
  Tier,
} from '@prisma/client';
import { randomUUID, createHash } from 'node:crypto';
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

  private async atomic<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(work);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      )
        throw new ConflictException(
          'Concurrent session change; reload before retrying',
        );
      throw error;
    }
  }

  async create(
    dto: CreateSessionDto,
    idempotencyKey?: string,
    actorId?: string,
  ) {
    for (const count of [dto.adultCount, dto.childCount]) {
      if (!Number.isSafeInteger(count) || count < 0 || count > 2147483647)
        throw new BadRequestException(
          'Guest counts must be non-negative database integers',
        );
    }
    if (idempotencyKey !== undefined) {
      if (!/^[A-Za-z0-9._:-]{1,128}$/.test(idempotencyKey) || !actorId)
        throw new BadRequestException('Invalid Idempotency-Key');
      actorId = this.idTransformer.decode(actorId, IdPrefix.USER);
    }
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          tableId: dto.tableId,
          tierId: dto.tierId,
          adultCount: dto.adultCount,
          childCount: dto.childCount,
        }),
      )
      .digest('hex');
    const result = await this.atomic(async (tx) => {
      if (idempotencyKey && actorId) {
        const lock = `session-open:${actorId}:${idempotencyKey}`;
        // Project an integer; PostgreSQL's void return type cannot be deserialized by Prisma.
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${lock}, 0))`;
        const prior = await tx.sessionOpenRequest.findUnique({
          where: { actorId_key: { actorId, key: idempotencyKey } },
        });
        if (prior) {
          if (prior.requestHash !== requestHash)
            throw new ConflictException(
              'Idempotency-Key was used with different input',
            );
          return {
            session: await tx.session.findUniqueOrThrow({
              where: { id: prior.sessionId },
              include: { table: true, tier: true },
            }),
            replay: true,
          };
        }
      }
      await tx.$queryRaw`SELECT id FROM "Table" WHERE id = ${dto.tableId} FOR UPDATE`;
      const table = await tx.table.findUnique({ where: { id: dto.tableId } });
      if (!table) throw new NotFoundException('Table not found');
      if (table.status !== TableStatus.AVAILABLE)
        throw new ConflictException('Table is not available');
      // Neither CLOSED nor an existing legacy invoice proves payment. While checkout is disabled,
      // every previous session requires settlement review before reusing a table. Do not infer PAID.
      const unresolved = await tx.session.findFirst({
        where: {
          tableId: dto.tableId,
        },
        select: { id: true },
      });
      if (unresolved)
        throw new ConflictException(
          'Table has a previous session requiring approved settlement review',
        );
      const tier = await tx.tier.findUnique({ where: { id: dto.tierId } });
      if (!tier) throw new NotFoundException('Tier not found');
      const claimed = await tx.table.updateMany({
        where: { id: dto.tableId, status: TableStatus.AVAILABLE },
        data: { status: TableStatus.OCCUPIED },
      });
      if (claimed.count !== 1)
        throw new ConflictException('Table was claimed concurrently');
      const startTime = new Date();
      const session = await tx.session.create({
        data: {
          tableId: dto.tableId,
          tierId: dto.tierId,
          adultCount: dto.adultCount,
          childCount: dto.childCount,
          qrToken: randomUUID(),
          startTime,
          endTime: new Date(startTime.getTime() + tier.timeLimit * 60000),
        },
        include: { table: true, tier: true },
      });
      if (idempotencyKey && actorId)
        await tx.sessionOpenRequest.create({
          data: {
            actorId,
            key: idempotencyKey,
            requestHash,
            sessionId: session.id,
          },
        });
      return { session, replay: false };
    });
    if (!result.replay)
      await this.events.emitTableStatus(dto.tableId, TableStatus.OCCUPIED);
    return this.transformResponse(result.session);
  }

  async updateStatus(id: string, dto: UpdateSessionStatusDto) {
    const rawId = this.idTransformer.decode(id, IdPrefix.SESSION);
    const closesTable =
      dto.status === SessionStatus.CLOSED ||
      dto.status === SessionStatus.EXPIRED;
    // Keep records raw until commit; never use a response DTO for DB queries.
    const updated = await this.atomic(async (tx) => {
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
    await this.events.emitSessionStatus(rawId, dto.status);
    if (closesTable)
      await this.events.emitTableStatus(updated.tableId, TableStatus.CLEANING);

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
        await this.events.emitSessionWarning(session.id, minutesLeft);
      }
    }
  }

  /**
   * Transform session response to use prefixed IDs
   */
  private transformResponse<T extends Session & { table: Table; tier: Tier }>(
    session: T,
  ) {
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
