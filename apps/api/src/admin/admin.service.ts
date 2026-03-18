import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AdminUpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  async findAllUsers(query: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
  }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.role) {
      where.role = query.role as any;
    }

    if (query.status === 'active') where.isActive = true;
    if (query.status === 'disabled') where.isActive = false;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          creditBalance: true,
          profitMargin: true,
          isActive: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          parentId: true,
          parent: { select: { name: true, email: true } },
          _count: { select: { devices: true, subResellers: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data.map((u) => ({
        ...u,
        creditBalance: Number(u.creditBalance),
        profitMargin: Number(u.profitMargin),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOneUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        creditBalance: true,
        profitMargin: true,
        isActive: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        parentId: true,
        parent: { select: { id: true, name: true, email: true } },
        _count: { select: { devices: true, subResellers: true, creditTransactions: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    // Get recent activity
    const recentActivity = await this.prisma.activityLog.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      ...user,
      creditBalance: Number(user.creditBalance),
      profitMargin: Number(user.profitMargin),
      recentActivity,
    };
  }

  async updateUser(id: string, dto: AdminUpdateUserDto, adminId: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    // Prevent disabling yourself
    if (id === adminId && dto.isActive === false) {
      throw new BadRequestException('Cannot disable your own account');
    }

    // Prevent changing your own role
    if (id === adminId && dto.role && dto.role !== user.role) {
      throw new BadRequestException('Cannot change your own role');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.emailVerified !== undefined && { emailVerified: dto.emailVerified }),
        ...(dto.profitMargin !== undefined && { profitMargin: dto.profitMargin }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        emailVerified: true,
        profitMargin: true,
        creditBalance: true,
      },
    });

    // Activity log
    await this.prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'admin.user.update',
        ipAddress: ipAddress || '',
        details: {
          targetUserId: id,
          targetEmail: user.email,
          changes: JSON.parse(JSON.stringify(dto)),
        },
      },
    });

    this.logger.log(`Admin ${adminId} updated user ${user.email}: ${JSON.stringify(dto)}`);

    return {
      ...updated,
      creditBalance: Number(updated.creditBalance),
      profitMargin: Number(updated.profitMargin),
    };
  }

  async toggleUserActive(id: string, adminId: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (id === adminId) {
      throw new BadRequestException('Cannot disable your own account');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: adminId,
        action: updated.isActive ? 'admin.user.enable' : 'admin.user.disable',
        ipAddress: ipAddress || '',
        details: { targetUserId: id, targetEmail: user.email },
      },
    });

    return { id: updated.id, isActive: updated.isActive };
  }

  async resetUserPassword(id: string, newPassword: string, adminId: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: hash,
        refreshToken: null, // Force re-login
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'admin.user.reset_password',
        ipAddress: ipAddress || '',
        details: { targetUserId: id, targetEmail: user.email },
      },
    });

    return { message: 'Password reset successfully' };
  }

  async getUserStats() {
    const [total, active, admins, resellers, subResellers] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { role: 'admin' } }),
      this.prisma.user.count({ where: { role: 'reseller' } }),
      this.prisma.user.count({ where: { role: 'sub_reseller' } }),
    ]);

    return { total, active, disabled: total - active, admins, resellers, subResellers };
  }
}
