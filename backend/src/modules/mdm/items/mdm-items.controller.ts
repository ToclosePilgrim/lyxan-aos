import {
  Body,
  Controller,
  Get,
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
import { MdmItemsService } from './mdm-items.service';
import { EnsureMdmItemDto } from './dto/ensure-mdm-item.dto';

@ApiTags('mdm/items')
@Controller('mdm/items')
@UseGuards(JwtAuthGuard)
export class MdmItemsController {
  constructor(private readonly mdmItems: MdmItemsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get MDM item by id' })
  @ApiParam({ name: 'id' })
  @ApiCookieAuth()
  async getById(@Param('id') id: string) {
    return this.mdmItems.getById(id);
  }

  @Post('ensure')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ensure MDM item exists (idempotent by type+code)' })
  async ensure(@Body() dto: EnsureMdmItemDto) {
    const item = await this.mdmItems.ensureItem({
      type: dto.type as any,
      name: dto.name,
      code: dto.code,
      unit: dto.unit ?? undefined,
    });
    return item;
  }
}
