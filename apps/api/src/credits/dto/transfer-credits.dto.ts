import { IsString, IsNumber, IsUUID, Min, Max, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransferCreditsDto {
  @ApiProperty({ example: 'uuid-of-sub-reseller' })
  @IsString()
  @IsUUID()
  toUserId: string;

  @ApiProperty({ example: 10, description: 'Whole number of credits to transfer' })
  @IsNumber()
  @IsInt({ message: 'Credits must be a whole number' })
  @Min(1, { message: 'Minimum transfer is 1 credit' })
  @Max(100000, { message: 'Maximum transfer is 100,000 credits' })
  amount: number;
}
