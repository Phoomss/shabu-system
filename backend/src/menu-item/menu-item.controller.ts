import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MenuItemService } from './menu-item.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { JwtGuard } from 'src/auth/guards/jwt.guard';

@ApiTags('menu-items')
@ApiBearerAuth('JWT')
@UseGuards(JwtGuard)
@Controller('menu-items')
export class MenuItemController {
  constructor(private readonly menuItemService: MenuItemService) {}

  @Post()
  @ApiOperation({ summary: 'Create menu item' })
  create(@Body() dto: CreateMenuItemDto) {
    return this.menuItemService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all menu items' })
  findAll() {
    return this.menuItemService.findAll();
  }

  @Get('by-tier/:tierId')
  @ApiOperation({ summary: 'Get menu items by tier' })
  findByTier(@Param('tierId', ParseIntPipe) tierId: number) {
    return this.menuItemService.findByTier(tierId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get menu item by id' })
  findOne(@Param('id') id: string) {
    return this.menuItemService.findOne(id);
  }

  @Patch(':id/availability')
  @ApiOperation({ summary: 'Toggle menu availability [Socket]' })
  toggleAvailability(@Param('id') id: string) {
    return this.menuItemService.toggleAvailability(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update menu item' })
  update(@Param('id') id: string, @Body() dto: UpdateMenuItemDto) {
    return this.menuItemService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete menu item' })
  remove(@Param('id') id: string) {
    return this.menuItemService.remove(id);
  }
}