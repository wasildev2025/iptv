import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePasscodeDto {
  @ApiProperty({ example: '1234', description: 'Current passcode' })
  @IsString()
  old_passcode: string;

  @ApiProperty({ example: '5678', description: 'New passcode (4-10 characters)' })
  @IsString()
  @MinLength(4, { message: 'New passcode must be at least 4 characters' })
  @MaxLength(10, { message: 'New passcode must be at most 10 characters' })
  new_passcode: string;
}
