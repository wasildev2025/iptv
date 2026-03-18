import { IsString, IsNumber, IsUUID, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminAdjustCreditsDto {
  @ApiProperty({ example: 'uuid-of-user' })
  @IsString()
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 50, description: 'Positive to add, negative to deduct' })
  @IsNumber()
  @Min(-100000)
  @Max(100000)
  amount: number;

  @ApiProperty({ example: 'Bonus for onboarding' })
  @IsString()
  @MaxLength(500)
  reason: string;
}
