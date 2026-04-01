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
import { v4 as uuidv4 } from 'uuid';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SessionsService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  async findAll() {
    return this.prisma.session.findMany({
      include: {
        table: true,
        tier: true,
        _count: { select: { orders: true } },
      },
      orderBy: { startTime: 'desc' },
    });
  }

  async findOne(id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: { table: true, tier: true, orders: true },
    });
    if (!session) throw new NotFoundException(`Session #${id} not found`);
    return session;
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
    return session;
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
    const tier = await this.prisma.tier.findUnique({ where: { id: dto.tierId } });
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
          qrToken: uuidv4(),
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

    return session;
  }

  async updateStatus(id: string, dto: UpdateSessionStatusDto) {
    const session = await this.findOne(id);

    const updated = await this.prisma.session.update({
      where: { id },
      data: { status: dto.status },
      include: { table: true, tier: true },
    });

    // [Socket] แจ้ง session เมื่อสถานะเปลี่ยน (ปิดโต๊ะ/เรียกเช็คบิล)
    this.events.emitSessionStatus(id, dto.status);

    // ถ้าปิด session → อัปเดตโต๊ะเป็น CLEANING
    if (dto.status === SessionStatus.CLOSED || dto.status === SessionStatus.EXPIRED) {
      await this.prisma.table.update({
        where: { id: session.tableId },
        data: { status: TableStatus.CLEANING },
      });

      // [Socket] แจ้งอัปเดต table status
      this.events.emitTableStatus(session.tableId, TableStatus.CLEANING);
    }

    return updated;
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
        this.events.emitSessionStatus(session.id, SessionStatus.EXPIRED);
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
}