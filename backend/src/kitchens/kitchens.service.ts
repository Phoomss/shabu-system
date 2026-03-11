import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateKitchenDto } from './dto/create-kitchen.dto';
import { UpdateKitchenDto } from './dto/update-kitchen.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { KitchenSection } from '@prisma/client';

@Injectable()
export class KitchensService {
  constructor(private prisma: PrismaService) { }

  async findAll(): Promise<KitchenSection[]> {
    return this.prisma.kitchenSection.findMany()
  }

  async findOne(id: number): Promise<KitchenSection> {
    const kitchen = await this.prisma.kitchenSection.findUnique({
      where: { id }
    })
    if (!kitchen) throw new NotFoundException(`Kitchen #${id} not found`)

    return kitchen
  }

  async create(dto: CreateKitchenDto): Promise<KitchenSection> {
    const existing = await this.prisma.kitchenSection.findUnique({ where: { name: dto.name } })
    if (existing) throw new ConflictException('Name already exists')

    return this.prisma.kitchenSection.create({ data: dto })
  }

  async update(id: number, dto: UpdateKitchenDto): Promise<KitchenSection> {
    await this.findOne(id)

    if (dto.name) {
      const existing = await this.prisma.kitchenSection.findUnique({ where: { name: dto.name } })
      if (existing && existing.id !== id) {
        throw new ConflictException('Name already exists')
      }
    }

    return this.prisma.kitchenSection.update({
      where: { id },
      data: dto
    })
  }

  async remove(id: number): Promise<KitchenSection> {
    await this.findOne(id)

    return this.prisma.kitchenSection.delete({ where: { id } })
  }
}
