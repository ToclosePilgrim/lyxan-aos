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
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { CreateBrandCountryDto } from './dto/create-brand-country.dto';

@ApiTags('mdm/brands')
@Controller('mdm/brands')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create brand (idempotent by code)' })
  create(@Body() dto: CreateBrandDto) {
    return this.brands.create(dto);
  }

  @Post('brand-countries')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create/update BrandCountry mapping (idempotent)' })
  linkBrandCountry(@Body() dto: CreateBrandCountryDto) {
    return this.brands.linkBrandCountry(dto);
  }
}




