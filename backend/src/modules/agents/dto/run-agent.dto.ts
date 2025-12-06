import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';

export class RunAgentDto {
  @IsString()
  @IsNotEmpty()
  agent: string;

  @IsObject()
  @IsOptional()
  params?: Record<string, unknown>;
}



