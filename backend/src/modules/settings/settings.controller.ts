import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateIntegrationDto } from './dto/update-integration.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ============ Users ============

  @Get('users')
  @ApiOperation({ summary: 'Get list of users' })
  @ApiResponse({ status: 200, description: 'List of users with roles' })
  @ApiCookieAuth()
  getUsers() {
    return this.settingsService.getUsers();
  }

  @Patch('users/:id/role')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Update user role (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User role updated successfully' })
  @ApiResponse({ status: 404, description: 'User or Role not found' })
  @ApiCookieAuth()
  updateUserRole(
    @Param('id') userId: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
  ) {
    return this.settingsService.updateUserRole(userId, updateUserRoleDto);
  }

  // ============ Roles ============

  @Get('roles')
  @ApiOperation({ summary: 'Get list of roles' })
  @ApiResponse({ status: 200, description: 'List of roles with user counts' })
  @ApiCookieAuth()
  getRoles() {
    return this.settingsService.getRoles();
  }

  // ============ Integrations ============

  @Get('integrations')
  @ApiOperation({ summary: 'Get list of integrations' })
  @ApiResponse({ status: 200, description: 'List of integrations' })
  @ApiCookieAuth()
  getIntegrations() {
    return this.settingsService.getIntegrations();
  }

  @Get('integrations/:key')
  @ApiOperation({ summary: 'Get integration by key' })
  @ApiParam({ name: 'key', description: 'Integration key (e.g., "n8n")' })
  @ApiResponse({ status: 200, description: 'Integration details' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  @ApiCookieAuth()
  getIntegrationByKey(@Param('key') key: string) {
    return this.settingsService.getIntegrationByKey(key);
  }

  @Patch('integrations/:key')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Create or update integration (Admin only)' })
  @ApiParam({ name: 'key', description: 'Integration key (e.g., "n8n")' })
  @ApiResponse({ status: 200, description: 'Integration upserted successfully' })
  @ApiCookieAuth()
  upsertIntegration(
    @Param('key') key: string,
    @Body() updateIntegrationDto: UpdateIntegrationDto,
  ) {
    return this.settingsService.upsertIntegration(key, updateIntegrationDto);
  }

  // ============ Agent Scenarios ============

  @Get('agents')
  @ApiOperation({ summary: 'Get list of agent scenarios' })
  @ApiResponse({ status: 200, description: 'List of agent scenarios' })
  @ApiCookieAuth()
  getAgentScenarios() {
    return this.settingsService.getAgentScenarios();
  }

  @Patch('agents/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Update agent scenario (Admin only)' })
  @ApiParam({ name: 'id', description: 'Agent scenario ID' })
  @ApiResponse({ status: 200, description: 'Agent scenario updated successfully' })
  @ApiResponse({ status: 404, description: 'Agent scenario not found' })
  @ApiCookieAuth()
  updateAgentScenario(
    @Param('id') id: string,
    @Body() dto: { name?: string; endpoint?: string },
  ) {
    return this.settingsService.updateAgentScenario(id, dto);
  }
}
