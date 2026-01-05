import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CountriesService } from './countries.service';
import { CreateCountryDto } from './dto/create-country.dto';

@ApiTags('mdm/countries')
@Controller('mdm/countries')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class CountriesController {
  constructor(private readonly countries: CountriesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create country (idempotent by code)' })
  create(@Body() dto: CreateCountryDto) {
    return this.countries.create(dto);
  }

  @Get(':code')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiParam({ name: 'code' })
  @ApiOperation({ summary: 'Get country by code' })
  getByCode(@Param('code') code: string) {
    return this.countries.findOneByCode(code);
  }
}

