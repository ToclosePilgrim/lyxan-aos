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
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CategoryDefaultMappingsService } from './category-default-mappings.service';
import { CreateCategoryDefaultMappingDto } from './dto/create-category-default-mapping.dto';
import { UpdateCategoryDefaultMappingDto } from './dto/update-category-default-mapping.dto';
import { ListCategoryDefaultMappingsDto } from './dto/list-category-default-mappings.dto';

@ApiTags('finance/category-default-mappings')
@Controller('finance/category-default-mappings')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class CategoryDefaultMappingsController {
  constructor(private readonly mappings: CategoryDefaultMappingsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'List category default mappings' })
  list(@Query() q: ListCategoryDefaultMappingsDto) {
    const includeInactive =
      String(q.includeInactive ?? 'false').toLowerCase() === 'true';
    return this.mappings.list({
      legalEntityId: q.legalEntityId,
      sourceType: q.sourceType,
      sourceCode: q.sourceCode,
      includeInactive,
    });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create category default mapping' })
  create(@Body() dto: CreateCategoryDefaultMappingDto) {
    return this.mappings.create(dto as any);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Patch category default mapping' })
  patch(@Param('id') id: string, @Body() dto: UpdateCategoryDefaultMappingDto) {
    return this.mappings.update(id, dto as any);
  }

  @Post(':id/archive')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive (deactivate) mapping' })
  archive(@Param('id') id: string) {
    return this.mappings.archive(id);
  }
}

