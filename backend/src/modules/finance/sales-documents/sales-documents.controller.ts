import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Patch,
  Post,
  Body,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SalesDocumentsService } from './sales-documents.service';
import { ListSalesDocumentsDto } from './dto/list-sales-documents.dto';
import { VoidSalesDocumentDto } from './dto/void-sales-document.dto';
import { CreateSalesDocumentDto } from './dto/create-sales-document.dto';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('finance/sales-documents')
@Controller('finance/sales-documents')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class SalesDocumentsController {
  constructor(private readonly salesDocs: SalesDocumentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Create sales document (MVP; Admin only)' })
  @ApiResponse({ status: 201, description: 'Created' })
  async create(@Body() dto: CreateSalesDocumentDto) {
    return this.salesDocs.create({
      brandId: dto.brandId ?? null,
      countryId: dto.countryId ?? null,
      marketplaceId: dto.marketplaceId ?? null,
      warehouseId: dto.warehouseId ?? null,
      sourceType: dto.sourceType,
      externalId: dto.externalId ?? null,
      periodFrom: new Date(dto.periodFrom),
      periodTo: new Date(dto.periodTo),
      status: dto.status as any,
      lines: (dto.lines ?? []).map((l) => ({
        itemId: l.itemId,
        warehouseId: l.warehouseId ?? null,
        date: new Date(l.date),
        quantity: l.quantity,
        revenue: l.revenue,
        commission: l.commission,
        refunds: l.refunds ?? null,
        cogsAmount: l.cogsAmount ?? null,
        meta: l.meta ?? null,
      })),
    } as any);
  }

  @Get()
  @ApiOperation({ summary: 'List sales documents' })
  @ApiQuery({ name: 'countryId', required: true })
  @ApiQuery({ name: 'brandId', required: true })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status',
  })
  @ApiQuery({ name: 'marketplaceId', required: false })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'periodFrom', required: false })
  @ApiQuery({ name: 'periodTo', required: false })
  async list(@Query() query: ListSalesDocumentsDto) {
    return this.salesDocs.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sales document by id with lines' })
  @ApiResponse({ status: 200, description: 'Sales document' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getById(@Param('id') id: string) {
    return this.salesDocs.getById(id);
  }

  @Patch(':id/post')
  @ApiOperation({ summary: 'Post sales document (FIFO outcome / COGS)' })
  @ApiResponse({ status: 200, description: 'Document posted' })
  async post(@Param('id') id: string) {
    return this.salesDocs.postSalesDocument(id);
  }

  @Post(':id/post')
  @ApiOperation({ summary: 'Post sales document (alias)' })
  @ApiResponse({ status: 200, description: 'Document posted' })
  async postAlias(@Param('id') id: string) {
    return this.salesDocs.postSalesDocument(id);
  }

  @Post(':id/void')
  @ApiOperation({ summary: 'Void sales document posting (reversal entries)' })
  async void(@Param('id') id: string, @Body() dto: VoidSalesDocumentDto) {
    return this.salesDocs.voidSalesDocument({ id, reason: dto.reason });
  }

  @Post(':id/repost')
  @ApiOperation({
    summary: 'Repost sales document (void current + post new version)',
  })
  async repost(@Param('id') id: string, @Body() dto: VoidSalesDocumentDto) {
    return this.salesDocs.repostSalesDocument({ id, reason: dto.reason });
  }
}
