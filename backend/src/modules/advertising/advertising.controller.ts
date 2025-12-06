import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
import { AdvertisingService } from './advertising.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CreateAdStatsDto } from './dto/create-adstats.dto';
import { UpdateAdStatsDto } from './dto/update-adstats.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('advertising')
@Controller('advertising')
@UseGuards(JwtAuthGuard)
export class AdvertisingController {
  constructor(private readonly advertisingService: AdvertisingService) {}

  // ============ AdCampaign ============

  @Get('campaigns')
  @ApiOperation({ summary: 'Get list of advertising campaigns' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name' })
  @ApiResponse({ status: 200, description: 'List of campaigns' })
  @ApiCookieAuth()
  getCampaigns(
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.advertisingService.getCampaigns({ status, search });
  }

  @Get('campaigns/:id')
  @ApiOperation({ summary: 'Get campaign by ID' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'End date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Campaign details with stats' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  @ApiCookieAuth()
  getCampaignById(
    @Param('id') id: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.advertisingService.getCampaignById(id, dateFrom, dateTo);
  }

  @Post('campaigns')
  @ApiOperation({ summary: 'Create a new campaign' })
  @ApiResponse({ status: 201, description: 'Campaign created successfully' })
  @ApiResponse({ status: 404, description: 'Marketplace not found' })
  @ApiCookieAuth()
  createCampaign(@Body() createCampaignDto: CreateCampaignDto) {
    return this.advertisingService.createCampaign(createCampaignDto);
  }

  @Patch('campaigns/:id')
  @ApiOperation({ summary: 'Update campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({ status: 200, description: 'Campaign updated successfully' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  @ApiCookieAuth()
  updateCampaign(
    @Param('id') id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
  ) {
    return this.advertisingService.updateCampaign(id, updateCampaignDto);
  }

  @Delete('campaigns/:id')
  @ApiOperation({ summary: 'Delete campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({ status: 200, description: 'Campaign deleted successfully' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  @ApiCookieAuth()
  deleteCampaign(@Param('id') id: string) {
    return this.advertisingService.deleteCampaign(id);
  }

  // ============ AdStats ============

  @Post('stats')
  @ApiOperation({ summary: 'Create ad statistics' })
  @ApiResponse({ status: 201, description: 'AdStats created successfully' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  @ApiResponse({ status: 409, description: 'Statistics for this date already exist' })
  @ApiCookieAuth()
  createAdStats(@Body() createAdStatsDto: CreateAdStatsDto) {
    return this.advertisingService.createAdStats(createAdStatsDto);
  }

  @Patch('stats/:id')
  @ApiOperation({ summary: 'Update ad statistics' })
  @ApiParam({ name: 'id', description: 'AdStats ID' })
  @ApiResponse({ status: 200, description: 'AdStats updated successfully' })
  @ApiResponse({ status: 404, description: 'AdStats not found' })
  @ApiCookieAuth()
  updateAdStats(
    @Param('id') id: string,
    @Body() updateAdStatsDto: UpdateAdStatsDto,
  ) {
    return this.advertisingService.updateAdStats(id, updateAdStatsDto);
  }

  @Delete('stats/:id')
  @ApiOperation({ summary: 'Delete ad statistics' })
  @ApiParam({ name: 'id', description: 'AdStats ID' })
  @ApiResponse({ status: 200, description: 'AdStats deleted successfully' })
  @ApiResponse({ status: 404, description: 'AdStats not found' })
  @ApiCookieAuth()
  deleteAdStats(@Param('id') id: string) {
    return this.advertisingService.deleteAdStats(id);
  }
}
