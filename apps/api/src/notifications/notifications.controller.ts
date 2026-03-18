import { Controller, Get, Post, Sse, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('api/notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @ApiOperation({ summary: 'Get all notifications for current user' })
  getNotifications(@CurrentUser('id') userId: string) {
    return this.notificationsService.getForUser(userId);
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @ApiOperation({ summary: 'Get unread notification count' })
  getUnreadCount(@CurrentUser('id') userId: string) {
    return { count: this.notificationsService.getUnreadCount(userId) };
  }

  @Post('mark-read')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Sse('stream')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'SSE stream for real-time notifications' })
  stream(@CurrentUser('id') userId: string): Observable<MessageEvent> {
    return this.notificationsService.subscribe(userId);
  }
}
