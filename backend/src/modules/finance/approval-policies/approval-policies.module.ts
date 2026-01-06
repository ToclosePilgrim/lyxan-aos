import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { ApprovalPoliciesController } from './approval-policies.controller';
import { ApprovalPoliciesService } from './approval-policies.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ApprovalPoliciesController],
  providers: [ApprovalPoliciesService],
  exports: [ApprovalPoliciesService],
})
export class ApprovalPoliciesModule {}




