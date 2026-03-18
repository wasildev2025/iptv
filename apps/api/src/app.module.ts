import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { SentryModule } from '@sentry/nestjs/setup';
import { PrismaModule } from './prisma/prisma.module';
import { MailerModule } from './mailer/mailer.module';
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { CreditsModule } from './credits/credits.module';
import { AppsModule } from './apps/apps.module';
import { ResellersModule } from './resellers/resellers.module';
import { LogsModule } from './logs/logs.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { AdminModule } from './admin/admin.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MacSwitchModule } from './mac-switch/mac-switch.module';
import { PlaylistsModule } from './playlists/playlists.module';
import { RechargeRequestsModule } from './recharge-requests/recharge-requests.module';
import { ParentChangeModule } from './parent-change/parent-change.module';
import { ActivationCodesModule } from './activation-codes/activation-codes.module';
import { CreditPasscodeModule } from './credit-passcode/credit-passcode.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 60,
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    MailerModule,
    AuthModule,
    DevicesModule,
    CreditsModule,
    AppsModule,
    ResellersModule,
    LogsModule,
    DashboardModule,
    HealthModule,
    AnnouncementsModule,
    AdminModule,
    PaymentsModule,
    NotificationsModule,
    MacSwitchModule,
    PlaylistsModule,
    RechargeRequestsModule,
    ParentChangeModule,
    ActivationCodesModule,
    CreditPasscodeModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
