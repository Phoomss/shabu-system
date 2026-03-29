import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MenuItemService } from './menu-item.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { JwtGuard } from 'src/auth/guards/jwt.guard';

@ApiTags('menu-items')
@Controller('menu-items')
export class MenuItemController {
  constructor(private readonly menuItemService: MenuItemService) {}

  @Post()
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create menu item' })
  create(@Body() dto: CreateMenuItemDto) {
    return this.menuItemService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all menu items (public)' })
  findAll() {
    return this.menuItemService.findAll();
  }

  @Get('by-tier/:tierId')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get menu items by tier' })
  findByTier(@Param('tierId', ParseIntPipe) tierId: number) {
    return this.menuItemService.findByTier(tierId);
  }

  @Get(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get menu item by id' })
  findOne(@Param('id') id: string) {
    return this.menuItemService.findOne(id);
  }

  @Patch(':id/availability')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Toggle menu availability [Socket]' })
  toggleAvailability(@Param('id') id: string) {
    return this.menuItemService.toggleAvailability(id);
  }

  @Patch(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update menu item' })
  update(@Param('id') id: string, @Body() dto: UpdateMenuItemDto) {
    return this.menuItemService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Delete menu item' })
  remove(@Param('id') id: string) {
    return this.menuItemService.remove(id);
  }
}