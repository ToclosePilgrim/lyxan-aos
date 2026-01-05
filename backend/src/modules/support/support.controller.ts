import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
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
import { SupportService } from './support.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('support')
@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  // ============ Reviews ============

  @Get('reviews')
  @ApiOperation({ summary: 'Get list of reviews' })
  @ApiQuery({
    name: 'rating',
    required: false,
    description: 'Filter by exact rating',
    type: Number,
  })
  @ApiQuery({
    name: 'minRating',
    required: false,
    description: 'Filter by minimum rating',
    type: Number,
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    description: 'Filter from date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    description: 'Filter to date (YYYY-MM-DD)',
  })
  @ApiResponse({ status: 200, description: 'List of reviews' })
  @ApiCookieAuth()
  getReviews(
    @Query('rating') rating?: string,
    @Query('minRating') minRating?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const filters: any = {};
    if (rating) filters.rating = parseInt(rating, 10);
    if (minRating) filters.minRating = parseInt(minRating, 10);
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    return this.supportService.getReviews(filters);
  }

  @Post('reviews')
  @ApiOperation({ summary: 'Create a review (for testing)' })
  @ApiResponse({ status: 201, description: 'Review created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid date format' })
  @ApiCookieAuth()
  createReview(@Body() createReviewDto: CreateReviewDto) {
    return this.supportService.createReview(createReviewDto);
  }

  // ============ Support Tickets ============

  @Get('tickets')
  @ApiOperation({ summary: 'Get list of support tickets' })
  @ApiResponse({ status: 200, description: 'List of support tickets' })
  @ApiCookieAuth()
  getTickets() {
    return this.supportService.getTickets();
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get support ticket by ID' })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Support ticket details' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiCookieAuth()
  getTicketById(@Param('id') id: string) {
    const ticket = this.supportService.getTicketById(id);
    // Add title extraction for response
    return ticket.then((t) => {
      const title = this.supportService.extractTitle(t.text);
      const body = this.supportService.extractBody(t.text);
      return {
        ...t,
        title,
        body,
      };
    });
  }

  @Post('tickets')
  @ApiOperation({ summary: 'Create a support ticket' })
  @ApiResponse({
    status: 201,
    description: 'Support ticket created successfully',
  })
  @ApiCookieAuth()
  createTicket(@Body() createTicketDto: CreateTicketDto) {
    return this.supportService.createTicket(createTicketDto);
  }

  @Patch('tickets/:id/status')
  @ApiOperation({ summary: 'Update support ticket status' })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiResponse({
    status: 200,
    description: 'Ticket status updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiCookieAuth()
  updateTicketStatus(
    @Param('id') id: string,
    @Body() updateTicketStatusDto: UpdateTicketStatusDto,
  ) {
    return this.supportService.updateTicketStatus(id, updateTicketStatusDto);
  }
}
