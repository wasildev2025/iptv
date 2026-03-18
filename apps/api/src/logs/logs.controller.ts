import { Controller, Get, Query, UseGuards, Param, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LogsService } from './logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@Controller('api/logs')
export class LogsController {
  constructor(private logsService: LogsService) {}

  // ─── User endpoints ───────────────────────────────────────────────

  @Get('activity')
  @ApiOperation({ summary: 'My activity logs' })
  getActivityLogs(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('action') action?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.logsService.getActivityLogs(userId, role, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      action,
      dateFrom,
      dateTo,
    });
  }

  @Get('credits')
  @ApiOperation({ summary: 'My credit transaction logs' })
  getCreditLogs(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.logsService.getCreditLogs(userId, role, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      type,
      dateFrom,
      dateTo,
    });
  }

  @Get('logins')
  @ApiOperation({ summary: 'My login logs' })
  getLoginLogs(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('success') success?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.logsService.getLoginLogs(userId, role, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      success,
      dateFrom,
      dateTo,
    });
  }

  // ─── Export endpoints ────────────────────────────────────────────

  @Get('export/credits-range')
  @ApiOperation({ summary: 'Export credit logs as CSV for date range' })
  async exportCreditLogsRange(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
    @Res() res: any,
  ) {
    const logs = await this.logsService.exportCreditLogsRange(userId, role, startDate, endDate);
    const csv = ['Date,Type,Description,Amount,Balance After']
      .concat(
        logs.map(
          (l) =>
            `"${l.createdAt.toISOString()}","${l.type}","${(l.description || '').replace(/"/g, '""')}","${l.amount}","${l.balanceAfter}"`,
        ),
      )
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=credit-logs-${startDate}-${endDate}.csv`);
    res.send(csv);
  }

  @Get('export/activity')
  @ApiOperation({ summary: 'Export activity logs as CSV' })
  async exportActivityLogs(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Res() res: any,
  ) {
    const logs = await this.logsService.exportActivityLogs(userId, role);
    const csv = ['Date,Action,Details,IP Address']
      .concat(
        logs.map(
          (l) =>
            `"${l.createdAt.toISOString()}","${l.action}","${JSON.stringify(l.details ?? {}).replace(/"/g, '""')}","${l.ipAddress || ''}"`,
        ),
      )
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=activity-logs.csv',
    );
    res.send(csv);
  }

  @Get('export/credits')
  @ApiOperation({ summary: 'Export credit logs as CSV' })
  async exportCreditLogs(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Res() res: any,
  ) {
    const logs = await this.logsService.exportCreditLogs(userId, role);
    const csv = ['Date,Type,Description,Amount,Balance After']
      .concat(
        logs.map(
          (l) =>
            `"${l.createdAt.toISOString()}","${l.type}","${(l.description || '').replace(/"/g, '""')}","${l.amount}","${l.balanceAfter}"`,
        ),
      )
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=credit-logs.csv',
    );
    res.send(csv);
  }

  @Get('export/logins')
  @ApiOperation({ summary: 'Export login logs as CSV' })
  async exportLoginLogs(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Res() res: any,
  ) {
    const logs = await this.logsService.exportLoginLogs(userId, role);
    const csv = ['Date,Status,IP Address,User Agent']
      .concat(
        logs.map(
          (l) =>
            `"${l.createdAt.toISOString()}","${l.success ? 'Success' : 'Failed'}","${l.ipAddress || ''}","${(l.userAgent || '').replace(/"/g, '""')}"`,
        ),
      )
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=login-logs.csv',
    );
    res.send(csv);
  }

  // ─── Admin endpoints ──────────────────────────────────────────────

  @Get('admin/summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Admin: Log summary (last 24h/7d stats)' })
  getLogSummary() {
    return this.logsService.getLogSummary();
  }

  @Get('admin/activity/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Admin: View any user activity logs' })
  adminGetActivityLogs(
    @CurrentUser('id') adminId: string,
    @CurrentUser('role') role: UserRole,
    @Param('userId') targetUserId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('action') action?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.logsService.getActivityLogs(
      adminId,
      role,
      { page: Number(page) || 1, limit: Number(limit) || 20, action, dateFrom, dateTo },
      targetUserId,
    );
  }

  @Get('admin/credits/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Admin: View any user credit logs' })
  adminGetCreditLogs(
    @CurrentUser('id') adminId: string,
    @CurrentUser('role') role: UserRole,
    @Param('userId') targetUserId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
  ) {
    return this.logsService.getCreditLogs(
      adminId,
      role,
      { page: Number(page) || 1, limit: Number(limit) || 20, type },
      targetUserId,
    );
  }

  @Get('admin/logins/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Admin: View any user login logs' })
  adminGetLoginLogs(
    @CurrentUser('id') adminId: string,
    @CurrentUser('role') role: UserRole,
    @Param('userId') targetUserId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('success') success?: string,
  ) {
    return this.logsService.getLoginLogs(
      adminId,
      role,
      { page: Number(page) || 1, limit: Number(limit) || 20, success },
      targetUserId,
    );
  }
}
