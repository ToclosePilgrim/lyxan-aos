import { IsString, IsNotEmpty, IsIn } from 'class-validator';

// LEGACY DTO: legacy Supply/SupplyItem model. Deprecated, do not use in new code.

export class UpdateSupplyStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['PENDING', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'])
  status: string;
}
