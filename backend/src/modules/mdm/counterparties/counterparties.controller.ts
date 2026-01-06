import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CounterpartiesService } from './counterparties.service';
import { CreateCounterpartyDto } from './dto/create-counterparty.dto';

@ApiTags('mdm/counterparties')
@Controller('mdm/counterparties')
@UseGuards(JwtAuthGuard)
export class CounterpartiesController {
  constructor(private readonly counterparties: CounterpartiesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create counterparty (MDM SoT)' })
  @ApiResponse({ status: 201 })
  @ApiCookieAuth()
  async create(@Body() dto: CreateCounterpartyDto) {
    return this.counterparties.create(dto);
  }
}




