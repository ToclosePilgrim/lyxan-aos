import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { FinanceCategoriesService } from './finance-categories.service';
import { CreateCashflowCategoryDto } from './dto/create-cashflow-category.dto';

@ApiTags('finance/cashflow-categories')
@Controller('finance/cashflow-categories')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class CashflowCategoriesController {
  constructor(private readonly categories: FinanceCategoriesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create cashflow category (idempotent by code)' })
  create(@Body() dto: CreateCashflowCategoryDto) {
    return this.categories.ensureCashflowCategory(dto);
  }
}

