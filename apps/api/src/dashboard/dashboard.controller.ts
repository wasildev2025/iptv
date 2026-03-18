import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('stats')
  getStats(@CurrentUser('id') userId: string) {
    return this.dashboardService.getStats(userId);
  }

  @Get('announcements')
  getAnnouncements() {
    return this.dashboardService.getAnnouncements();
  }

  @Get('device-trends')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  getDeviceTrends(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.dashboardService.getDeviceTrends(userId, role);
  }

  @Get('credit-usage')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  getCreditUsage(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.dashboardService.getCreditUsage(userId, role);
  }

  @Get('activation-log')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  getActivationLog(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.dashboardService.getActivationLogDashboard(userId, role);
  }

  @Get('social-widget')
  getSocialWidget() {
    return this.dashboardService.getSocialWidget();
  }
}
