import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AppsService } from './apps.service';
import { CreateAppDto } from './dto/create-app.dto';
import { UpdateAppDto } from './dto/update-app.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Apps')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@Controller('api/apps')
export class AppsController {
  constructor(private appsService: AppsService) {}

  @Get()
  @ApiOperation({ summary: 'List all active apps' })
  findAll() {
    return this.appsService.findAll(false);
  }

  @Get('allowed')
  @ApiOperation({ summary: 'List apps allowed for current user' })
  findAllowed(@CurrentUser('id') userId: string) {
    return this.appsService.findAllowedApps(userId);
  }

  @Get('apk-plans')
  @ApiOperation({ summary: 'Get APK download plans (app list with download info)' })
  getApkPlans() {
    return this.appsService.getApkPlans();
  }

  // ─── Admin Endpoints ─────────────────────────────────────────────

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Admin: List all apps including inactive' })
  adminFindAll() {
    return this.appsService.findAll(true);
  }

  @Get('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Admin: Get app details' })
  adminFindOne(@Param('id') id: string) {
    return this.appsService.findOne(id);
  }

  @Post('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Admin: Create a new app' })
  create(@Body() dto: CreateAppDto) {
    return this.appsService.create(dto);
  }

  @Put('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Admin: Update an app' })
  update(@Param('id') id: string, @Body() dto: UpdateAppDto) {
    return this.appsService.update(id, dto);
  }

  @Patch('admin/:id/toggle')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Admin: Toggle app active/inactive' })
  toggleActive(@Param('id') id: string) {
    return this.appsService.toggleActive(id);
  }

  @Delete('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Admin: Delete an app (only if no devices)' })
  remove(@Param('id') id: string) {
    return this.appsService.remove(id);
  }
}
