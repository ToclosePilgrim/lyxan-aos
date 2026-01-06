import {
  Body,
  Controller,
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
import { ProductionConsumptionService } from '../production-orders/production-consumption.service';
import { VoidProductionConsumptionDto } from './dto/void-production-consumption.dto';
import { RepostProductionConsumptionDto } from './dto/repost-production-consumption.dto';

@ApiTags('scm/production-consumptions')
@Controller('scm/production-consumptions')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class ProductionConsumptionsController {
  constructor(private readonly consumptions: ProductionConsumptionService) {}

  @Post(':inventoryTransactionId/void')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Void production consumption posting via PostingRun (reversal entries)',
  })
  @ApiParam({
    name: 'inventoryTransactionId',
    description: 'InventoryTransaction.id for PRODUCTION_INPUT outcome',
  })
  void(
    @Param('inventoryTransactionId') id: string,
    @Body() dto: VoidProductionConsumptionDto,
  ) {
    return this.consumptions.voidConsumptionPosting(id, dto.reason);
  }

  @Post(':inventoryTransactionId/repost')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Repost production consumption (void current run if needed, then post as next version)',
  })
  @ApiParam({
    name: 'inventoryTransactionId',
    description: 'InventoryTransaction.id for PRODUCTION_INPUT outcome',
  })
  repost(
    @Param('inventoryTransactionId') id: string,
    @Body() dto: RepostProductionConsumptionDto,
  ) {
    return this.consumptions.repostConsumptionPosting(id, dto.reason);
  }
}




