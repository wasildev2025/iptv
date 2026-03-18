import { IsString, Matches, IsArray, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

export class CheckDeviceDto {
  @ApiProperty({ example: 'AA:BB:CC:DD:EE:FF' })
  @IsString()
  @Matches(MAC_REGEX, { message: 'Invalid MAC address format' })
  @Transform(({ value }) => value?.toUpperCase().replace(/-/g, ':'))
  macAddress: string;

  @ApiProperty({ example: 'app-uuid' })
  @IsString()
  appId: string;
}

export class CheckDeviceMultiAppDto {
  @ApiProperty({ example: 'AA:BB:CC:DD:EE:FF' })
  @IsString()
  @Matches(MAC_REGEX, { message: 'Invalid MAC address format' })
  @Transform(({ value }) => value?.toUpperCase().replace(/-/g, ':'))
  macAddress: string;

  @ApiProperty({ example: ['app-uuid-1', 'app-uuid-2'] })
  @IsArray()
  @IsString({ each: true })
  appIds: string[];
}

export class MultiAppActivateDto {
  @ApiProperty({ example: 'AA:BB:CC:DD:EE:FF' })
  @IsString()
  @Matches(MAC_REGEX, { message: 'Invalid MAC address format' })
  @Transform(({ value }) => value?.toUpperCase().replace(/-/g, ':'))
  macAddress: string;

  @ApiProperty({ example: ['app-uuid-1', 'app-uuid-2'] })
  @IsArray()
  @IsString({ each: true })
  appIds: string[];

  @ApiProperty({ enum: ['yearly', 'lifetime'] })
  @IsString()
  packageType: 'yearly' | 'lifetime';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}
