import { Injectable } from '@nestjs/common';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { PrismaService } from 'src/prisma/prisma.service';

const menuItemSelect = {
  id: true,
  name: true,
  imageUrl: true,
  isAvailable: true,
  category: { select: { id: true, name: true } },
  kitchen: { select: { id: true, name: true } },
  tierItems: { include: { tier: true } },
};

@Injectable()
export class MenuItemService {
  constructor(
    private prisma: PrismaService,
   
  ){}
}
