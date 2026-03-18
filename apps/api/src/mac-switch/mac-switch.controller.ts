import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MacSwitchService } from './mac-switch.service';
import { SwitchMacDto } from './dto/switch-mac.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('MAC Switch')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@Controller('api/mac-switch')
export class MacSwitchController {
  constructor(private macSwitchService: MacSwitchService) {}

  @Post('switch')
  switch(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: SwitchMacDto,
    @Req() req: any,
  ) {
    return this.macSwitchService.switchMac(userId, role, dto, req.ip);
  }

  @Get('info')
  getInfo(@CurrentUser('id') userId: string) {
    return this.macSwitchService.getInfo(userId);
  }

  @Get('history')
  getHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('per_page') perPage?: number,
  ) {
    return this.macSwitchService.getHistory(
      userId,
      Number(page) || 1,
      Number(perPage) || 10,
    );
  }
}
