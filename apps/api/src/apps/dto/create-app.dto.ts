import {
  IsString,
  IsInt,
  Min,
  IsOptional,
  IsUrl,
  IsBoolean,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAppDto {
  @ApiProperty({ example: 'IBO Player' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'ibo-player' })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Slug must be lowercase with hyphens only' })
  slug: string;

  @ApiPropertyOptional({ example: 'https://example.com/icon.png' })
  @IsOptional()
  @IsUrl()
  iconUrl?: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  creditsYearly: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  creditsLifetime: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '123456', description: 'Downloader app code (AFTV)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  downloaderCode?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/app.apk' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl({ require_tld: false }, { message: 'Invalid APK URL' })
  apkUrl?: string;

  @ApiPropertyOptional({ example: '1.4.2' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  apkVersion?: string;

  @ApiPropertyOptional({ example: 'com.iptv.player' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  packageName?: string;
}
