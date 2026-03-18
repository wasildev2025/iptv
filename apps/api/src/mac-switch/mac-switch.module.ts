import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MacSwitchController } from './mac-switch.controller';
import { MacSwitchService } from './mac-switch.service';

@Module({
  imports: [PrismaModule],
  controllers: [MacSwitchController],
  providers: [MacSwitchService],
  exports: [MacSwitchService],
})
export class MacSwitchModule {}
