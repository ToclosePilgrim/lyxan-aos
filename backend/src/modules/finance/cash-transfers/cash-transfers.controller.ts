import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CashTransfersService } from './cash-transfers.service';
import { PairMarketplacePayoutDto } from './dto/pair-marketplace-payout.dto';
import { ListCashTransfersDto } from './dto/list-cash-transfers.dto';
import { VoidCashTransferDto } from './dto/void-cash-transfer.dto';

@ApiTags('finance/cash-transfers')
@Controller('finance')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class CashTransfersController {
  constructor(private readonly cashTransfers: CashTransfersService) {}

  @Post('cash-transfers/marketplace/pair')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Pair marketplace wallet payout (wallet OUT + bank IN) into a CashTransfer',
  })
  async pairMarketplace(@Body() dto: PairMarketplacePayoutDto) {
    const transfer = await this.cashTransfers.pairMarketplacePayout({
      walletStatementLineId: dto.walletStatementLineId,
      bankStatementLineId: dto.bankStatementLineId,
      provider: dto.provider ?? null,
      externalRef: dto.externalRef ?? null,
    });
    return { transferId: (transfer as any).id, transfer };
  }

  @Post('cash-transfers/:id/post')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Post cash transfer (creates accounting entries + cash links)',
  })
  post(@Param('id') id: string) {
    return this.cashTransfers.postTransfer(id);
  }

  @Post('cash-transfers/:id/void')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Void cash transfer posting via PostingRun (reversal entries)',
  })
  void(@Param('id') id: string, @Body() dto: VoidCashTransferDto) {
    return this.cashTransfers.voidTransfer(id, dto.reason);
  }

  @Get('cash-transfers')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'List cash transfers' })
  list(@Query() q: ListCashTransfersDto) {
    return this.cashTransfers.list({
      legalEntityId: q.legalEntityId,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      status: q.status as any,
      provider: q.provider,
    });
  }
}
