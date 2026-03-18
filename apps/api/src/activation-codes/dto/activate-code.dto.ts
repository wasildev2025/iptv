import { IsEnum, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PackageType } from '@prisma/client';
import { Transform } from 'class-transformer';

const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

export class ActivateCodeDto {
  @ApiProperty({ enum: PackageType, example: 'yearly' })
  @IsEnum(PackageType)
  subscriptionType: PackageType;

  @ApiProperty({ example: 'AA:BB:CC:DD:EE:FF' })
  @IsString()
  @Matches(MAC_REGEX, { message: 'Invalid MAC address format (expected XX:XX:XX:XX:XX:XX)' })
  @Transform(({ value }) => value?.toUpperCase().replace(/-/g, ':'))
  macAddress: string;
}
