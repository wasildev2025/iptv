import {
  IsNumber,
  IsBoolean,
  IsEmail,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRechargeRequestDto {
  @ApiProperty({ example: 50, description: 'Amount of credits to request' })
  @IsNumber()
  @Min(1, { message: 'Requested amount must be greater than 0' })
  requested_amount: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Request credits from parent reseller',
  })
  @IsOptional()
  @IsBoolean()
  request_from_parent?: boolean;

  @ApiPropertyOptional({
    example: 'reseller@example.com',
    description: 'Email of the user to request credits from',
  })
  @IsOptional()
  @IsEmail()
  target_email?: string;
}
