import { IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

const MAC_REGEX = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

export class SwitchMacDto {
  @ApiProperty({ example: 'ibo-player' })
  @IsString()
  application: string;

  @ApiProperty({ example: '00:1A:2B:3C:4D:5E' })
  @IsString()
  @Matches(MAC_REGEX, { message: 'old_mac must be a valid MAC address (XX:XX:XX:XX:XX:XX)' })
  @Transform(({ value }) => value?.toUpperCase())
  old_mac: string;

  @ApiProperty({ example: '00:1A:2B:3C:4D:5F' })
  @IsString()
  @Matches(MAC_REGEX, { message: 'new_mac must be a valid MAC address (XX:XX:XX:XX:XX:XX)' })
  @Transform(({ value }) => value?.toUpperCase())
  new_mac: string;
}
