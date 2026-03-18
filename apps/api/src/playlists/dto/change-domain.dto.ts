import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangeDomainDto {
  @ApiProperty({ example: 'http://old-domain.com/playlist.m3u' })
  @IsString()
  @MaxLength(2048)
  current_playlist_url: string;

  @ApiProperty({ example: 'http://new-domain.com' })
  @IsString()
  @MaxLength(2048)
  new_domain: string;

  @ApiProperty({ example: 'android' })
  @IsString()
  app_platform: string;

  @ApiProperty({ example: 'app-uuid-here' })
  @IsString()
  app_id: string;
}
