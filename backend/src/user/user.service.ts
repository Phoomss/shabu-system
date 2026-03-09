import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        isActive: true,
        role: { select: { id: true, name: true } }
      }
    })
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        isActive: true,
        role: { select: { id: true, name: true } }
      }
    })

    if (!user) throw new NotFoundException(`User #${id} not found`)
    return user
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username }
    })
    if (existing) throw new ConflictException('Username already exists')

    const passwordHash = await bcrypt.hash(dto.password, 10)

    return this.prisma.user.create({
      data: {
        roleId: dto.roleId,
        username: dto.username,
        passwordHash,
        fullName: dto.fullName,
        avatarUrl: dto.avatarUrl,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        isActive: true,
        role: { select: { id: true, name: true } },
      },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id)

    const data: any = { ...dto }

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10)
      delete data.password
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        isActive: true,
        role: { select: { id: true, name: true } },
      },
    })
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.user.delete({ where: { id } });
  }
}
