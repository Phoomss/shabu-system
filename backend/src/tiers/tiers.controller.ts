import { EmployeeResource } from '../security/access.decorators';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TiersService } from './tiers.service';
import { CreateTierDto } from './dto/create-tier.dto';
import { UpdateTierDto } from './dto/update-tier.dto';
import { JwtGuard } from 'src/auth/guards/jwt.guard';

@ApiTags('tiers')
@ApiBearerAuth('JWT')
@UseGuards(JwtGuard)
@EmployeeResource('tiers')
@Controller('tiers')
export class TiersController {
  constructor(private readonly tiersService: TiersService) {}

  @Post()
  @ApiOperation({ summary: 'Create tier' })
  create(@Body() dto: CreateTierDto) {
    return this.tiersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tiers' })
  findAll() {
    return this.tiersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tier by id' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tiersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tier' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTierDto) {
    return this.tiersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete tier' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tiersService.remove(id);
  }
}
