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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { PostInternalTransferDto } from './dto/post-internal-transfer.dto';
import { VoidInternalTransferDto } from './dto/void-internal-transfer.dto';
import { InternalTransfersService } from './internal-transfers.service';

@ApiTags('finance/internal-transfers')
@Controller('finance/internal-transfers')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class InternalTransfersController {
  constructor(private readonly service: InternalTransfersService) {}

  @Post('post')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Post internal transfer (create ledger entry + links)',
  })
  @ApiResponse({ status: 200 })
  post(@Body() dto: PostInternalTransferDto) {
    return this.service.postInternalTransfer({
      outMoneyTransactionId: dto.outMoneyTransactionId,
      inMoneyTransactionId: dto.inMoneyTransactionId,
    });
  }

  @Post(':groupId/void')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Void internal transfer group (void both legs + create reversal entries)',
  })
  void(
    @Param('groupId') groupId: string,
    @Body() dto: VoidInternalTransferDto,
  ) {
    return this.service.voidInternalTransfer({
      transferGroupId: groupId,
      reason: dto.reason,
    });
  }
}
