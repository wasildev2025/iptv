import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidatePasscodeDto {
  @ApiProperty({ example: '1234' })
  @IsString()
  passcode: string;
}
