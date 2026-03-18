import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ example: 'abc123-verification-token' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
