import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateIntegrationDto } from './dto/update-integration.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  // ============ Users ============

  async getUsers() {
    return this.prisma.user.findMany({
      include: {
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateUserRole(userId: string, dto: UpdateUserRoleDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${dto.roleId} not found`);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { roleId: dto.roleId },
      include: {
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  // ============ Roles ============

  async getRoles() {
    const roles = await this.prisma.role.findMany({
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      usersCount: role._count.users,
    }));
  }

  // ============ Integrations ============

  async getIntegrations() {
    return this.prisma.integration.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async getIntegrationByKey(key: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { key },
    });

    if (!integration) {
      throw new NotFoundException(`Integration with key ${key} not found`);
    }

    return integration;
  }

  async upsertIntegration(key: string, dto: UpdateIntegrationDto) {
    const updateData: Prisma.IntegrationUpdateInput = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }

    if (dto.config !== undefined) {
      updateData.config = dto.config
        ? (dto.config as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }

    return this.prisma.integration.upsert({
      where: { key },
      update: updateData,
      create: {
        key,
        name: dto.name || key,
        config: dto.config
          ? (dto.config as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }

  // ============ Agent Scenarios ============

  async getAgentScenarios() {
    return this.prisma.agentScenario.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async updateAgentScenario(id: string, dto: { name?: string; endpoint?: string }) {
    const scenario = await this.prisma.agentScenario.findUnique({
      where: { id },
    });

    if (!scenario) {
      throw new NotFoundException(`Agent scenario with ID ${id} not found`);
    }

    const updateData: any = {};
    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }
    if (dto.endpoint !== undefined) {
      updateData.endpoint = dto.endpoint;
    }

    return this.prisma.agentScenario.update({
      where: { id },
      data: updateData,
    });
  }
}
