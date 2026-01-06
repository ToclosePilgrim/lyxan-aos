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
import { CreateMarketplaceDto } from './dto/create-marketplace.dto';
import { MarketplacesService } from './marketplaces.service';

@ApiTags('mdm/marketplaces')
@Controller('mdm/marketplaces')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class MarketplacesController {
  constructor(private readonly marketplaces: MarketplacesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create marketplace (idempotent by code)' })
  create(@Body() dto: CreateMarketplaceDto) {
    return this.marketplaces.create(dto);
  }
}




