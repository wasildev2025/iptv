import { IsEnum, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PackageType } from '@prisma/client';

export class CreateCodeDto {
  @ApiProperty({ enum: PackageType, example: 'yearly' })
  @IsEnum(PackageType)
  subscriptionType: PackageType;

  @ApiProperty({ example: 5, description: 'Number of codes to generate (max 10)' })
  @IsInt()
  @Min(1, { message: 'Minimum 1 code' })
  @Max(10, { message: 'Maximum 10 codes at once' })
  codeCount: number;
}
