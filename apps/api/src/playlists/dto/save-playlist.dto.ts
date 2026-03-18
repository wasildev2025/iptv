import {
  IsString,
  IsBoolean,
  IsOptional,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const MAC_REGEX = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

export class SavePlaylistDto {
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

  @ApiProperty({ example: 'http://example.com/playlist.m3u' })
  @IsString()
  @MaxLength(2048)
  playlist_url: string;

  @ApiProperty({ example: 'My Playlist' })
  @IsString()
  @MaxLength(255)
  playlist_name: string;

  @ApiProperty({ example: 'android' })
  @IsString()
  app_platform: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  protect: boolean;

  @ApiProperty({ required: false, example: 'http://example.com/epg.xml' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  xml_url?: string;

  @ApiProperty({ required: false, example: '1234' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  pin?: string;
}
