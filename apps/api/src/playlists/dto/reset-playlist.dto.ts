import { IsString, IsEnum, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const MAC_REGEX = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

export class ResetPlaylistDto {
  @ApiProperty({ example: 'AA:BB:CC:DD:EE:FF' })
  @IsString()
  @Matches(MAC_REGEX, {
    message: 'Invalid MAC address format (expected XX:XX:XX:XX:XX:XX)',
  })
  @Transform(({ value }) => value?.toUpperCase().replace(/-/g, ':'))
  mac_address: string;

  @ApiProperty({ example: 'app-uuid-here' })
  @IsString()
  app_id: string;

  @ApiProperty({ example: 'playlists' })
  @IsString()
  module: string;

  @ApiProperty({ enum: ['general', 'xc'], example: 'general' })
  @IsEnum(['general', 'xc'], {
    message: 'playlist_type must be either "general" or "xc"',
  })
  playlist_type: 'general' | 'xc';

  @ApiProperty({ example: 'device-key-here' })
  @IsString()
  device_key: string;
}
