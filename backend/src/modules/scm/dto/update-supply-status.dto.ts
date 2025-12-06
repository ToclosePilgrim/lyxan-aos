import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class UpdateSupplyStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['PENDING', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'])
  status: string;
}







