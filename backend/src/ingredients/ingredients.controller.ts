import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IngredientsService } from './ingredients.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { JwtGuard } from 'src/auth/guards/jwt.guard';

@ApiTags('ingredients')
@ApiBearerAuth('JWT')
@UseGuards(JwtGuard)
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Post()
  @ApiOperation({ summary: 'Create ingredient' })
  create(@Body() dto: CreateIngredientDto) {
    return this.ingredientsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all ingredients' })
  findAll() {
    return this.ingredientsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ingredient by id' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ingredientsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update ingredient' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIngredientDto) {
    return this.ingredientsService.update(id, dto);
  }

  @Patch(':id/stock')
  @ApiOperation({ summary: 'Adjust stock [Socket]' })
  adjustStock(@Param('id', ParseIntPipe) id: number, @Body() dto: AdjustStockDto) {
    return this.ingredientsService.adjustStock(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete ingredient' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.ingredientsService.remove(id);
  }
}