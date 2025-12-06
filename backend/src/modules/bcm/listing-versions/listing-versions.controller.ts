import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ListingVersionsService } from './listing-versions.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('bcm')
@Controller('bcm')
@UseGuards(JwtAuthGuard)
export class ListingVersionsController {
  constructor(
    private readonly listingVersionsService: ListingVersionsService,
  ) {}

  @Get('products/:id/versions')
  @ApiOperation({ summary: 'Get content version history for a listing' })
  @ApiParam({ name: 'id', description: 'Listing (Product) ID' })
  @ApiResponse({ status: 200, description: 'List of content versions' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  @ApiCookieAuth()
  async getListingVersions(@Param('id') id: string) {
    return this.listingVersionsService.getVersionsForListing(id);
  }

  @Get('products/:id/versions/:versionId')
  @ApiOperation({ summary: 'Get a specific content version' })
  @ApiParam({ name: 'id', description: 'Listing (Product) ID' })
  @ApiParam({ name: 'versionId', description: 'Version ID' })
  @ApiResponse({ status: 200, description: 'Content version details' })
  @ApiResponse({ status: 404, description: 'Version not found' })
  @ApiCookieAuth()
  async getVersionById(
    @Param('id') listingId: string,
    @Param('versionId') versionId: string,
  ) {
    const version = await this.listingVersionsService.getVersionById(versionId);
    
    if (!version) {
      throw new NotFoundException('Version not found');
    }

    if (version.listingId !== listingId) {
      throw new NotFoundException('Version does not belong to this listing');
    }

    return version;
  }
}

