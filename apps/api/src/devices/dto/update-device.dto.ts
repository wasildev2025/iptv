import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

export class UpdateDeviceDto {
  @ApiProperty({ example: 'AA:BB:CC:DD:EE:FF', required: false })
  @IsOptional()
  @IsString()
  @Matches(MAC_REGEX, { message: 'Invalid MAC address format (expected XX:XX:XX:XX:XX:XX)' })
  @Transform(({ value }) => value?.toUpperCase().replace(/-/g, ':'))
  macAddress?: string;

  @ApiProperty({ example: 'AA:BB:CC:DD:EE:00', required: false })
  @IsOptional()
  @IsString()
  @Matches(MAC_REGEX, { message: 'Invalid alternate MAC address format' })
  @Transform(({ value }) => value?.toUpperCase().replace(/-/g, ':'))
  macAddressAlt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
