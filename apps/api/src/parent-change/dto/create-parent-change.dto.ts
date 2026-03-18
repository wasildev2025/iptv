import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateParentChangeDto {
  @ApiProperty({
    example: 'new-parent@example.com',
    description: 'Email of the desired new parent reseller',
  })
  @IsEmail()
  new_parent_email: string;
}
