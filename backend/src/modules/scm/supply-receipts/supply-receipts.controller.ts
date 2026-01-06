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
import { ScmSuppliesService } from '../supplies/scm-supplies.service';
import { VoidSupplyReceiptDto } from './dto/void-supply-receipt.dto';

@ApiTags('scm/supply-receipts')
@Controller('scm/supply-receipts')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class SupplyReceiptsController {
  constructor(private readonly supplies: ScmSuppliesService) {}

  @Post(':id/void')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Void supply receipt posting via PostingRun (reversal entries)',
  })
  @ApiParam({ name: 'id', description: 'Supply receipt ID' })
  void(@Param('id') id: string, @Body() dto: VoidSupplyReceiptDto) {
    return this.supplies.voidSupplyReceipt(id, dto.reason);
  }
}




