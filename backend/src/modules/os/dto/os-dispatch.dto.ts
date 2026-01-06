import { IsObject, IsOptional, IsString } from 'class-validator';

export class OsDispatchRequestDto {
  @IsString()
  object: string;

  @IsString()
  action: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;

  @IsOptional()
  @IsObject()
  context?: {
    userId?: string;
    role?: string;
    source?: string;
  };
}




