import {
  IsString,
  IsBoolean,
  IsOptional,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePlaylistDto {
  @ApiProperty({ required: false, example: 'http://example.com/playlist.m3u' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl({ require_tld: false }, { message: 'Invalid playlist URL' })
  playlistUrl?: string;

  @ApiProperty({ required: false, example: 'My Playlist' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  playlistName?: string;

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

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  isProtected?: boolean;
}
