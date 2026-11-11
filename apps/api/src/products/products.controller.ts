import { ApiTags, ApiQuery } from '@nestjs/swagger';
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { DrinkLevel } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service.js';
import { isUuid } from '../rewards/reward-transactions.js';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly inventory: InventoryService,
  ) {}

  @ApiQuery({ name: 'sweetness', required: false, enum: DrinkLevel })
  @ApiQuery({ name: 'ice', required: false, enum: DrinkLevel })
  @Get('sizes/:id/availability')
  availability(
    @Param('id') id: string,
    @Query('sweetness') sweetness: string = 'HUNDRED',
    @Query('ice') ice: string = 'HUNDRED',
  ) {
    if (
      !isUuid(id) ||
      !Object.values(DrinkLevel).includes(sweetness as DrinkLevel) ||
      !Object.values(DrinkLevel).includes(ice as DrinkLevel)
    )
      throw new BadRequestException('Cấu hình món không hợp lệ');
    return this.inventory
      .availability(id, sweetness as DrinkLevel, ice as DrinkLevel)
      .then((stockQuantity) => ({ stockQuantity }));
  }

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }
}
