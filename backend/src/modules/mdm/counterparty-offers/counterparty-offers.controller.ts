import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CounterpartyOfferType } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CounterpartyOffersService } from './counterparty-offers.service';
import { CreateCounterpartyOfferDto } from './dto/create-counterparty-offer.dto';
import { UpdateCounterpartyOfferDto } from './dto/update-counterparty-offer.dto';

@ApiTags('mdm/counterparty-offers')
@Controller('mdm/counterparty-offers')
@UseGuards(JwtAuthGuard)
export class CounterpartyOffersController {
  constructor(private readonly offers: CounterpartyOffersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Create counterparty offer (Admin only)' })
  @ApiResponse({ status: 201, description: 'Created' })
  async create(@Body() dto: CreateCounterpartyOfferDto) {
    return this.offers.create(dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List counterparty offers' })
  @ApiQuery({ name: 'legalEntityId', required: true })
  @ApiQuery({ name: 'counterpartyId', required: false })
  @ApiQuery({ name: 'mdmItemId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: CounterpartyOfferType })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'includeArchived', required: false })
  async findAll(
    @Query('legalEntityId') legalEntityId: string,
    @Query('counterpartyId') counterpartyId?: string,
    @Query('mdmItemId') mdmItemId?: string,
    @Query('type') type?: CounterpartyOfferType,
    @Query('q') q?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.offers.findAll({
      legalEntityId,
      counterpartyId,
      mdmItemId,
      offerType: type,
      q,
      includeArchived: includeArchived === 'true',
    });
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get counterparty offer by id' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'legalEntityId', required: true })
  async findOne(
    @Param('id') id: string,
    @Query('legalEntityId') legalEntityId: string,
  ) {
    return this.offers.findOne(id, legalEntityId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update counterparty offer (Admin only)' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'legalEntityId', required: true })
  async update(
    @Param('id') id: string,
    @Query('legalEntityId') legalEntityId: string,
    @Body() dto: UpdateCounterpartyOfferDto,
  ) {
    return this.offers.update(id, legalEntityId, dto);
  }

  @Post(':id/archive')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Archive counterparty offer (Admin only)' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'legalEntityId', required: true })
  async archive(
    @Param('id') id: string,
    @Query('legalEntityId') legalEntityId: string,
  ) {
    return this.offers.archive(id, legalEntityId);
  }
}

