import {
  Body,
  Controller,
  Delete,
  Get,
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
import { OverheadRulesService } from './overhead-rules.service';
import { CreateOverheadRuleDto } from './dto/create-overhead-rule.dto';
import { UpdateOverheadRuleDto } from './dto/update-overhead-rule.dto';
import { FilterOverheadRulesDto } from './dto/filter-overhead-rules.dto';

@ApiTags('finance/overhead-rules')
@Controller('finance/overhead-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OverheadRulesController {
  constructor(private readonly service: OverheadRulesService) {}

  @Post()
  @Roles('Admin', 'FinanceManager')
  @ApiOperation({ summary: 'Create overhead allocation rule' })
  @ApiCookieAuth()
  create(@Body() dto: CreateOverheadRuleDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles('Admin', 'FinanceManager')
  @ApiOperation({ summary: 'List overhead allocation rules' })
  @ApiCookieAuth()
  list(@Query() filters: FilterOverheadRulesDto) {
    return this.service.list(filters);
  }

  @Get(':id')
  @Roles('Admin', 'FinanceManager')
  @ApiOperation({ summary: 'Get overhead allocation rule by ID' })
  @ApiCookieAuth()
  get(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Patch(':id')
  @Roles('Admin', 'FinanceManager')
  @ApiOperation({ summary: 'Update overhead allocation rule' })
  @ApiCookieAuth()
  update(@Param('id') id: string, @Body() dto: UpdateOverheadRuleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('Admin', 'FinanceManager')
  @ApiOperation({ summary: 'Deactivate overhead allocation rule' })
  @ApiCookieAuth()
  remove(@Param('id') id: string) {
    return this.service.deactivate(id);
  }
}

