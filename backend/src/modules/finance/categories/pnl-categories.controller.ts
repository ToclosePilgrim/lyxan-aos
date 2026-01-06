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
import { CreatePnlCategoryDto } from './dto/create-pnl-category.dto';

@ApiTags('finance/pnl-categories')
@Controller('finance/pnl-categories')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class PnlCategoriesController {
  constructor(private readonly categories: FinanceCategoriesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create pnl category (idempotent by code)' })
  create(@Body() dto: CreatePnlCategoryDto) {
    return this.categories.ensurePnlCategory(dto);
  }
}




