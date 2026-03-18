import {
  IsArray,
  IsString,
  IsUUID,
  IsIn,
  IsOptional,
  IsUrl,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PackageType } from '@prisma/client';

export class BulkDeviceEntry {
  @ApiProperty({ example: 'AA:BB:CC:DD:EE:FF' })
  @IsString()
  macAddress: string;

  @ApiProperty({ example: 'app-uuid-here' })
  @IsUUID()
  appId: string;

  @ApiProperty({ enum: ['yearly', 'lifetime'] })
  @IsIn(['yearly', 'lifetime'])
  packageType: PackageType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  playlistUrl?: string;
}

export class BulkActivateDto {
  @ApiProperty({ type: [BulkDeviceEntry] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkDeviceEntry)
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  devices: BulkDeviceEntry[];
}
