import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ApprovalPoliciesService } from './approval-policies.service';
import { CreateApprovalPolicyDto } from './dto/create-approval-policy.dto';

@ApiTags('finance/approval-policies')
@Controller('finance/approval-policies')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class ApprovalPoliciesController {
  constructor(private readonly policies: ApprovalPoliciesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create finance approval policy' })
  create(@Body() dto: CreateApprovalPolicyDto) {
    return this.policies.create(dto);
  }
}

