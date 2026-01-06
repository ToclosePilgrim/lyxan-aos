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
import { CreateLegalEntityDto } from './dto/create-legal-entity.dto';
import { LegalEntitiesService } from './legal-entities.service';

@ApiTags('mdm/legal-entities')
@Controller('mdm/legal-entities')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class LegalEntitiesController {
  constructor(private readonly service: LegalEntitiesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create legal entity (idempotent by code)' })
  create(@Body() dto: CreateLegalEntityDto) {
    return this.service.create(dto);
  }
}




