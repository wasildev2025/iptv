import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, UserRole } from '@prisma/client';

export interface LogQueryParams {
  page?: number;
  limit?: number;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class LogsService {
  constructor(private prisma: PrismaService) {}

  // ─── Activity Logs ────────────────────────────────────────────────

  async getActivityLogs(
    userId: string,
    role: UserRole,
    query: LogQueryParams,
    targetUserId?: string,
  ) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ActivityLogWhereInput = {};

    // Admin can view any user's logs; others see only their own
    if (role === UserRole.admin && targetUserId) {
      where.userId = targetUserId;
    } else if (role !== UserRole.admin) {
      where.userId = userId;
    }
    // Admin with no targetUserId sees all logs

    if (query.action) {
      where.action = { contains: query.action, mode: 'insensitive' };
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const end = new Date(query.dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Credit Transaction Logs ──────────────────────────────────────

  async getCreditLogs(
    userId: string,
    role: UserRole,
    query: LogQueryParams & { type?: string },
    targetUserId?: string,
  ) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.CreditTransactionWhereInput = {};

    if (role === UserRole.admin && targetUserId) {
      where.userId = targetUserId;
    } else if (role !== UserRole.admin) {
      where.userId = userId;
    }

    if (query.type) {
      where.type = query.type as any;
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const end = new Date(query.dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.creditTransaction.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.creditTransaction.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Login Logs ───────────────────────────────────────────────────

  async getLoginLogs(
    userId: string,
    role: UserRole,
    query: LogQueryParams & { success?: string },
    targetUserId?: string,
  ) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.LoginLogWhereInput = {};

    if (role === UserRole.admin && targetUserId) {
      where.userId = targetUserId;
    } else if (role !== UserRole.admin) {
      where.userId = userId;
    }

    if (query.success !== undefined) {
      where.success = query.success === 'true';
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const end = new Date(query.dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.loginLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.loginLog.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Export Methods (no pagination, max 5000) ───────────────────────

  async exportActivityLogs(userId: string, role: UserRole) {
    const where: Prisma.ActivityLogWhereInput = {};
    if (role !== UserRole.admin) {
      where.userId = userId;
    }

    return this.prisma.activityLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      take: 5000,
      orderBy: { createdAt: 'desc' },
    });
  }

  async exportCreditLogs(userId: string, role: UserRole) {
    const where: Prisma.CreditTransactionWhereInput = {};
    if (role !== UserRole.admin) {
      where.userId = userId;
    }

    return this.prisma.creditTransaction.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      take: 5000,
      orderBy: { createdAt: 'desc' },
    });
  }

  async exportLoginLogs(userId: string, role: UserRole) {
    const where: Prisma.LoginLogWhereInput = {};
    if (role !== UserRole.admin) {
      where.userId = userId;
    }

    return this.prisma.loginLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      take: 5000,
      orderBy: { createdAt: 'desc' },
    });
  }

  async exportCreditLogsRange(userId: string, role: UserRole, startDate: string, endDate: string) {
    const where: Prisma.CreditTransactionWhereInput = {};
    if (role !== UserRole.admin) {
      where.userId = userId;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    return this.prisma.creditTransaction.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      take: 10000,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Admin: Log summary/overview ──────────────────────────────────

  async getLogSummary() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      activityToday,
      activityWeek,
      failedLoginsToday,
      failedLoginsWeek,
      creditTxToday,
      topActions,
    ] = await Promise.all([
      this.prisma.activityLog.count({
        where: { createdAt: { gte: oneDayAgo } },
      }),
      this.prisma.activityLog.count({
        where: { createdAt: { gte: oneWeekAgo } },
      }),
      this.prisma.loginLog.count({
        where: { success: false, createdAt: { gte: oneDayAgo } },
      }),
      this.prisma.loginLog.count({
        where: { success: false, createdAt: { gte: oneWeekAgo } },
      }),
      this.prisma.creditTransaction.count({
        where: { createdAt: { gte: oneDayAgo } },
      }),
      this.prisma.activityLog.groupBy({
        by: ['action'],
        _count: true,
        where: { createdAt: { gte: oneWeekAgo } },
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      activity: { last24h: activityToday, last7d: activityWeek },
      failedLogins: { last24h: failedLoginsToday, last7d: failedLoginsWeek },
      creditTransactions: { last24h: creditTxToday },
      topActions: topActions.map((a) => ({
        action: a.action,
        count: a._count,
      })),
    };
  }
}
