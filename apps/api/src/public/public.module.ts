import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { DeviceTokenService } from './device-token.service';
import { PlaylistPinService } from './playlist-pin.service';
import { DeviceStateBuilder } from './device-state.builder';
import { DeviceTokenGuard } from './guards/device-token.guard';
import { XtreamService } from './xtream.service';

@Module({
  controllers: [PublicController],
  providers: [
    DeviceTokenService,
    PlaylistPinService,
    DeviceStateBuilder,
    DeviceTokenGuard,
    XtreamService,
  ],
  exports: [DeviceTokenService, PlaylistPinService],
})
export class PublicModule {}
