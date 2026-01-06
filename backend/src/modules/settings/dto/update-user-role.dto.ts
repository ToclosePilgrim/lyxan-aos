import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserRoleDto {
  @ApiProperty({
    description: 'Role ID to assign to the user',
    example: 'role-id',
  })
  @IsString()
  @IsNotEmpty()
  roleId: string;
}




