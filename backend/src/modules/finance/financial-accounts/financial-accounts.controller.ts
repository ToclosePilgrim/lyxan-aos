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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { FinancialAccountsService } from './financial-accounts.service';
import { CreateFinancialAccountDto } from './dto/create-financial-account.dto';
import { UpdateFinancialAccountDto } from './dto/update-financial-account.dto';
import { ListFinancialAccountsDto } from './dto/list-financial-accounts.dto';

@ApiTags('finance/financial-accounts')
@Controller('finance/financial-accounts')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class FinancialAccountsController {
  constructor(private readonly service: FinancialAccountsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create financial account' })
  @ApiResponse({ status: 201, description: 'Created' })
  create(@Body() dto: CreateFinancialAccountDto) {
    return this.service.create(dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'List financial accounts by legalEntityId' })
  list(@Query() query: ListFinancialAccountsDto) {
    const includeArchived =
      String(query.includeArchived ?? 'false').toLowerCase() === 'true';
    return this.service.list({
      legalEntityId: query.legalEntityId,
      includeArchived,
    });
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get financial account by id' })
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Update financial account' })
  update(@Param('id') id: string, @Body() dto: UpdateFinancialAccountDto) {
    return this.service.update(id, dto);
  }
}
