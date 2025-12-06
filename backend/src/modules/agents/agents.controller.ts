import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { RunAgentDto } from './dto/run-agent.dto';
import type { AgentCallbackPayload } from './types/agent-callback-payload.interface';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('run')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Run an agent scenario' })
  @ApiResponse({
    status: 201,
    description: 'Agent run started successfully',
  })
  @ApiResponse({ status: 404, description: 'Agent scenario not found' })
  @ApiResponse({ status: 400, description: 'Failed to start agent' })
  @ApiCookieAuth()
  async runAgent(@Body() dto: RunAgentDto) {
    const run = await this.agentsService.runAgent(dto);
    return {
      id: run.id,
      agentKey: run.agentKey,
      status: run.status,
      startedAt: run.startedAt,
    };
  }

  @Post('callback/:runId')
  @ApiOperation({ summary: 'Callback endpoint for n8n to report agent results' })
  @ApiParam({
    name: 'runId',
    description: 'Agent run ID',
    example: 'clxxx...',
  })
  @ApiResponse({
    status: 200,
    description: 'Callback processed successfully',
  })
  @ApiResponse({ status: 404, description: 'Agent run not found' })
  async handleCallback(
    @Param('runId') runId: string,
    @Body() payload: AgentCallbackPayload,
  ) {
    const run = await this.agentsService.handleCallback(runId, payload);
    return {
      id: run.id,
      status: run.status,
      finishedAt: run.finishedAt,
    };
  }

  @Get('runs')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get list of agent runs' })
  @ApiQuery({
    name: 'agentKey',
    required: false,
    description: 'Filter by agent key',
    example: 'import_sales',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (RUNNING, SUCCESS, ERROR)',
    example: 'SUCCESS',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Limit number of results (max 100)',
    example: 50,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'List of agent runs',
  })
  @ApiCookieAuth()
  async getRuns(
    @Query('agentKey') agentKey?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: {
      agentKey?: string;
      status?: string;
      limit?: number;
    } = {};

    if (agentKey) {
      filters.agentKey = agentKey;
    }

    if (status) {
      filters.status = status;
    }

    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        filters.limit = limitNum;
      }
    }

    return this.agentsService.getRuns(filters);
  }
}
