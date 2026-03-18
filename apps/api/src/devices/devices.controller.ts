import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { BulkActivateDto } from './dto/bulk-activate.dto';
import { CheckDeviceDto, CheckDeviceMultiAppDto, MultiAppActivateDto } from './dto/check-device.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@Controller('api/devices')
export class DevicesController {
  constructor(private devicesService: DevicesService) {}

  @Post('check-status')
  checkDeviceStatus(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: CheckDeviceDto,
  ) {
    return this.devicesService.checkDeviceStatus(userId, dto.macAddress, dto.appId, role as any);
  }

  @Post('check-status-multi')
  checkDeviceStatusMultiApp(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: CheckDeviceMultiAppDto,
  ) {
    return this.devicesService.checkDeviceStatusMultiApp(userId, dto.macAddress, dto.appIds, role as any);
  }

  @Post('multi-activate')
  multiAppActivate(
    @CurrentUser('id') userId: string,
    @Body() dto: MultiAppActivateDto,
    @Req() req: any,
  ) {
    return this.devicesService.multiAppActivate(userId, dto, req.ip);
  }

  @Post('bulk-activate')
  bulkActivate(
    @CurrentUser('id') userId: string,
    @Body() dto: BulkActivateDto,
    @Req() req: any,
  ) {
    return this.devicesService.bulkActivate(userId, dto, req.ip);
  }

  @Post('trial')
  createTrial(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDeviceDto,
    @Req() req: any,
  ) {
    return this.devicesService.createTrial(userId, dto, req.ip);
  }

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDeviceDto,
    @Req() req: any,
  ) {
    return this.devicesService.create(userId, dto, req.ip);
  }

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('appId') appId?: string,
    @Query('search') search?: string,
  ) {
    return this.devicesService.findAll(userId, role as any, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      status,
      appId,
      search,
    });
  }

  @Get(':id')
  findOne(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
  ) {
    return this.devicesService.findOne(userId, id, role as any);
  }

  @Post(':id/renew')
  renew(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.devicesService.renew(userId, id, req.ip);
  }

  @Post(':id/disable')
  disable(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.devicesService.toggleStatus(userId, id, true, req.ip, role as any);
  }

  @Post(':id/enable')
  enable(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.devicesService.toggleStatus(userId, id, false, req.ip, role as any);
  }

  @Delete(':id')
  remove(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.devicesService.remove(userId, id, req.ip, role as any);
  }
}
