import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { MdmOffersService } from './mdm-offers.service';

@ApiTags('mdm/offers')
@Controller('mdm/offers')
@UseGuards(JwtAuthGuard)
export class MdmOffersController {
  constructor(private readonly mdmOffers: MdmOffersService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get MDM offer by id' })
  @ApiParam({ name: 'id' })
  @ApiCookieAuth()
  async getById(@Param('id') id: string) {
    return this.mdmOffers.getById(id);
  }
}




