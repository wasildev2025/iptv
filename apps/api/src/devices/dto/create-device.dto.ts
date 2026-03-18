import {
  IsString,
  IsEnum,
  IsOptional,
  Matches,
  MaxLength,
  IsUrl,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PackageType } from '@prisma/client';
import { Transform } from 'class-transformer';

const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

export class CreateDeviceDto {
  @ApiProperty({ example: 'app-uuid-here' })
  @IsString()
  appId: string;

  @ApiProperty({ example: 'AA:BB:CC:DD:EE:FF' })
  @IsString()
  @Matches(MAC_REGEX, { message: 'Invalid MAC address format (expected XX:XX:XX:XX:XX:XX)' })
  @Transform(({ value }) => value?.toUpperCase().replace(/-/g, ':'))
  macAddress: string;

  @ApiProperty({ example: 'AA:BB:CC:DD:EE:00', required: false })
  @IsOptional()
  @IsString()
  @Matches(MAC_REGEX, { message: 'Invalid alternate MAC address format' })
  @Transform(({ value }) => value?.toUpperCase().replace(/-/g, ':'))
  macAddressAlt?: string;

  @ApiProperty({ enum: PackageType })
  @IsEnum(PackageType)
  packageType: PackageType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'Invalid playlist URL' })
  playlistUrl?: string;
}
