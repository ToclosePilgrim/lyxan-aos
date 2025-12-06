import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { FinancialDocumentsService } from './financial-documents.service';
import { CreateFinancialDocumentDto } from './dto/create-financial-document.dto';
import { UpdateFinancialDocumentDto } from './dto/update-financial-document.dto';
import { FinancialDocumentFiltersDto } from './dto/financial-document-filters.dto';
import { AttachServiceDto } from './dto/attach-service.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('finance/documents')
@Controller('finance/documents')
@UseGuards(JwtAuthGuard)
export class FinancialDocumentsController {
  constructor(
    private readonly financialDocumentsService: FinancialDocumentsService,
  ) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get list of financial documents with filters and pagination' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of financial documents with total count',
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array' },
        total: { type: 'number' },
      },
    },
  })
  @ApiCookieAuth()
  async findAll(@Query() filters?: FinancialDocumentFiltersDto) {
    return this.financialDocumentsService.findAll(filters);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get financial document details' })
  @ApiParam({ name: 'id', description: 'Financial Document ID' })
  @ApiResponse({
    status: 200,
    description: 'Financial document details with services',
  })
  @ApiResponse({ status: 404, description: 'Financial document not found' })
  @ApiCookieAuth()
  async findOne(@Param('id') id: string) {
    return this.financialDocumentsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new financial document (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'The financial document has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Related entity not found' })
  @ApiCookieAuth()
  async create(@Body() createDto: CreateFinancialDocumentDto) {
    return this.financialDocumentsService.create(createDto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Update financial document (Admin only)' })
  @ApiParam({ name: 'id', description: 'Financial Document ID' })
  @ApiResponse({
    status: 200,
    description: 'The financial document has been successfully updated.',
  })
  @ApiResponse({ status: 404, description: 'Financial document not found' })
  @ApiCookieAuth()
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateFinancialDocumentDto,
  ) {
    return this.financialDocumentsService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete financial document (Admin only)' })
  @ApiParam({ name: 'id', description: 'Financial Document ID' })
  @ApiResponse({
    status: 200,
    description: 'The financial document has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Financial document not found' })
  @ApiCookieAuth()
  async remove(@Param('id') id: string) {
    return this.financialDocumentsService.remove(id);
  }

  @Post(':id/attach-service')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Attach service operations to document (Admin only)',
  })
  @ApiParam({ name: 'id', description: 'Financial Document ID' })
  @ApiResponse({
    status: 200,
    description: 'Services have been successfully attached.',
  })
  @ApiResponse({ status: 404, description: 'Document or service not found' })
  @ApiCookieAuth()
  async attachService(
    @Param('id') id: string,
    @Body() attachDto: AttachServiceDto,
  ) {
    return this.financialDocumentsService.attachService(id, attachDto);
  }
}

