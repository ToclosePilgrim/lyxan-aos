import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class MovePaymentPlanDto {
  @ApiProperty({ description: 'New planned date (ISO)' })
  @IsDateString()
  newPlannedDate: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  newFromAccountId?: string;
}




