import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetPasscodeDto {
  @ApiProperty({ example: '1234', description: 'Credit share passcode (4-10 characters)' })
  @IsString()
  @MinLength(4, { message: 'Passcode must be at least 4 characters' })
  @MaxLength(10, { message: 'Passcode must be at most 10 characters' })
  passcode: string;
}
