import {
  IsString,
  IsBoolean,
  IsOptional,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;

export class SavePlaylistDto {
  @ApiProperty({ example: 'AA:BB:CC:DD:EE:FF' })
  @IsString()
  @Matches(MAC_REGEX, {
    message: 'Invalid MAC address format (expected XX:XX:XX:XX:XX:XX)',
  })
  @Transform(({ value }) => value?.toUpperCase().replace(/-/g, ':'))
  macAddress: string;

  @ApiProperty({ example: 'app-uuid-here' })
  @IsString()
  appId: string;

  @ApiProperty({ example: 'http://example.com/playlist.m3u' })
  @IsString()
  @MaxLength(2048)
  @IsUrl({ require_tld: false }, { message: 'Invalid playlist URL' })
  playlistUrl: string;

  @ApiProperty({ example: 'My Playlist' })
  @IsString()
  @MaxLength(255)
  playlistName: string;

  @ApiProperty({ example: 'web', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  appPlatform?: string;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  isProtected?: boolean;

  @ApiProperty({ required: false, example: 'http://example.com/epg.xml' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  xmlUrl?: string;

  @ApiProperty({ required: false, example: '1234' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  pin?: string;
}
