import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { CreateKitchenDto } from './dto/create-kitchen.dto';
import { UpdateKitchenDto } from './dto/update-kitchen.dto';
import { KitchensService } from './kitchens.service';

@ApiTags('kitchens')
@ApiBearerAuth('JWT')
@UseGuards(JwtGuard)
@Controller('kitchens')
@Controller('kitchens')
export class KitchensController {
   constructor(private readonly kitchensService: KitchensService) { }
  
    @Post()
    @ApiOperation({ summary: 'Create kitchen section' })
    create(@Body() dto: CreateKitchenDto) {
      return this.kitchensService.create(dto);
    }
  
    @Get()
    @ApiOperation({ summary: 'Get all kitchen sections' })
    findAll() {
      return this.kitchensService.findAll();
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Get kitchen by id' })
    findOne(@Param('id') id: string) {
      return this.kitchensService.findOne(+id);
    }
  
    @Patch(':id')
    @ApiOperation({ summary: 'Update kitchen' })
    update(@Param('id') id: string, @Body() dto: UpdateKitchenDto) {
      return this.kitchensService.update(+id, dto);
    }
  
    @Delete(':id')
    @ApiOperation({ summary: 'Delete kitchen' })
    remove(@Param('id') id: string) {
      return this.kitchensService.remove(+id);
    }
}
