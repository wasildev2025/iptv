import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(userId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalDevices,
      activeDevices,
      expiredDevices,
      user,
      recentActivations,
      totalSubResellers,
    ] = await Promise.all([
      this.prisma.device.count({ where: { userId } }),
      this.prisma.device.count({ where: { userId, status: 'active' } }),
      this.prisma.device.count({ where: { userId, status: 'expired' } }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true },
      }),
      this.prisma.device.count({
        where: { userId, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.user.count({ where: { parentId: userId } }),
    ]);

    return {
      totalDevices,
      activeDevices,
      expiredDevices,
      creditBalance: Number(user?.creditBalance ?? 0),
      recentActivations,
      totalSubResellers,
    };
  }

  async getAnnouncements() {
    return this.prisma.announcement.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  }

  async getDeviceTrends(userId: string, role: string) {
    if (role === 'admin') {
      return this.prisma.$queryRawUnsafe<{ date: string; activations: number }[]>(
        `SELECT DATE(created_at) as date, COUNT(*)::int as activations
         FROM devices
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at)
         ORDER BY date`,
      );
    }

    return this.prisma.$queryRawUnsafe<{ date: string; activations: number }[]>(
      `SELECT DATE(created_at) as date, COUNT(*)::int as activations
       FROM devices
       WHERE created_at >= NOW() - INTERVAL '30 days' AND user_id = $1
       GROUP BY DATE(created_at)
       ORDER BY date`,
      userId,
    );
  }

  // App-wise activation stats for last month (IBOSOL: activation-log-dashboard)
  async getActivationLogDashboard(userId: string, role: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const userFilter = role === 'admin' ? '' : `AND d.user_id = '${userId}'`;

    const result = await this.prisma.$queryRawUnsafe<{ app_name: string; count: number }[]>(
      `SELECT a.name as app_name, COUNT(d.id)::int as count
       FROM devices d
       JOIN apps a ON d.app_id = a.id
       WHERE d.created_at >= $1 ${userFilter}
       GROUP BY a.name
       ORDER BY count DESC`,
      thirtyDaysAgo,
    );

    return result;
  }

  // Social widget data
  getSocialWidget() {
    return {
      whatsapp_number: process.env.WHATSAPP_NUMBER || '+1234567890',
      telegram_number: process.env.TELEGRAM_HANDLE || 'iptvsupport',
    };
  }

  async getCreditUsage(userId: string, role: string) {
    if (role === 'admin') {
      return this.prisma.$queryRawUnsafe<{ type: string; total: number }[]>(
        `SELECT type, SUM(ABS(amount))::float as total
         FROM credit_transactions
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY type`,
      );
    }

    return this.prisma.$queryRawUnsafe<{ type: string; total: number }[]>(
      `SELECT type, SUM(ABS(amount))::float as total
       FROM credit_transactions
       WHERE created_at >= NOW() - INTERVAL '30 days' AND user_id = $1
       GROUP BY type`,
      userId,
    );
  }
}
