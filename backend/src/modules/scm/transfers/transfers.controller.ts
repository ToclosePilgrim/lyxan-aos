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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ScmTransferStatus } from '@prisma/client';

@ApiTags('scm/transfers')
@Controller('scm/transfers')
@UseGuards(JwtAuthGuard)
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'List transfers with filters' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'fromWarehouseId', required: false })
  @ApiQuery({ name: 'toWarehouseId', required: false })
  @ApiQuery({ name: 'itemId', required: false })
  @ApiCookieAuth()
  async findAll(
    @Query('status') status?: string,
    @Query('fromWarehouseId') fromWarehouseId?: string,
    @Query('toWarehouseId') toWarehouseId?: string,
    @Query('itemId') itemId?: string,
  ) {
    return this.transfersService.findAll({
      status: status as any,
      fromWarehouseId,
      toWarehouseId,
      itemId,
    });
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get transfer by ID' })
  @ApiParam({ name: 'id', description: 'Transfer ID' })
  @ApiCookieAuth()
  async findOne(@Param('id') id: string) {
    return this.transfersService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create transfer (draft)' })
  @ApiResponse({ status: 201, description: 'Transfer created' })
  @ApiCookieAuth()
  async create(@Body() dto: CreateTransferDto) {
    return this.transfersService.create(dto);
  }

  @Post(':id/request')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set transfer status to REQUESTED' })
  @ApiParam({ name: 'id', description: 'Transfer ID' })
  @ApiCookieAuth()
  async request(@Param('id') id: string) {
    return this.transfersService.setRequested(id);
  }

  @Post(':id/start')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start transfer (IN_TRANSIT) and create OUT movements',
  })
  @ApiParam({ name: 'id', description: 'Transfer ID' })
  @ApiCookieAuth()
  async start(@Param('id') id: string) {
    return this.transfersService.start(id);
  }

  @Post(':id/receive')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive transfer, create IN movements, close transfer',
  })
  @ApiParam({ name: 'id', description: 'Transfer ID' })
  @ApiCookieAuth()
  async receive(@Param('id') id: string) {
    return this.transfersService.receive(id);
  }

  @Post(':id/transition')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transition transfer status via state machine' })
  @ApiParam({ name: 'id', description: 'Transfer ID' })
  @ApiCookieAuth()
  async transition(
    @Param('id') id: string,
    @Body() body: { targetStatus: ScmTransferStatus; reason?: string },
  ) {
    return this.transfersService.transitionStatus({
      transferId: id,
      targetStatus: body.targetStatus,
      reason: body.reason,
    });
  }
}
