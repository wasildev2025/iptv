import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PlaylistsService } from './playlists.service';
import { SavePlaylistDto } from './dto/save-playlist.dto';
import { ResetPlaylistDto } from './dto/reset-playlist.dto';
import { ChangeDomainDto } from './dto/change-domain.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Playlists')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@Controller('api/playlists')
export class PlaylistsController {
  constructor(private playlistsService: PlaylistsService) {}

  @Post('save')
  save(
    @CurrentUser('id') userId: string,
    @Body() dto: SavePlaylistDto,
  ) {
    return this.playlistsService.save(userId, dto);
  }

  @Post('reset')
  reset(
    @CurrentUser('id') userId: string,
    @Body() dto: ResetPlaylistDto,
    @Req() req: any,
  ) {
    return this.playlistsService.reset(userId, dto, req.ip);
  }

  @Post('change-domain')
  changeDomain(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangeDomainDto,
  ) {
    return this.playlistsService.changeDomain(userId, dto);
  }

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Query('mac_address') macAddress?: string,
    @Query('app_id') appId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.playlistsService.findAll(userId, {
      mac_address: macAddress,
      app_id: appId,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Post('check-status')
  checkStatus(
    @CurrentUser('id') userId: string,
    @Body('macAddress') macAddress: string,
    @Body('appId') appId: string,
  ) {
    return this.playlistsService.checkStatus(userId, macAddress, appId);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.playlistsService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.playlistsService.remove(userId, id);
  }
}
