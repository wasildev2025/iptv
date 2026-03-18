import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResellerDto } from './dto/create-reseller.dto';
import { UpdateResellerDto } from './dto/update-reseller.dto';
import { UserRole, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Reusable select shape for sub-reseller responses
const RESELLER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  creditBalance: true,
  profitMargin: true,
  isActive: true,
  createdAt: true,
  _count: { select: { devices: true, subResellers: true } },
} satisfies Prisma.UserSelect;

type ResellerRow = Prisma.UserGetPayload<{ select: typeof RESELLER_SELECT }>;

function formatReseller(r: ResellerRow) {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    creditBalance: Number(r.creditBalance),
    profitMargin: Number(r.profitMargin),
    isActive: r.isActive,
    createdAt: r.createdAt,
    deviceCount: r._count.devices,
    subResellerCount: r._count.subResellers,
  };
}

@Injectable()
export class ResellersService {
  constructor(private prisma: PrismaService) {}

  // ─── Ownership verification ───────────────────────────────────────

  /**
   * Verify that `callerId` is the direct parent of `targetId`,
   * OR that callerRole is admin (admins see everything).
   * Returns the target user record.
   */
  private async verifyOwnership(
    callerId: string,
    callerRole: UserRole,
    targetId: string,
  ) {
    const where: Prisma.UserWhereInput = { id: targetId };

    // Non-admins can only access their direct children
    if (callerRole !== UserRole.admin) {
      where.parentId = callerId;
    }

    const user = await this.prisma.user.findFirst({
      where,
      select: RESELLER_SELECT,
    });

    if (!user) {
      throw new NotFoundException('Sub-reseller not found');
    }

    return user;
  }

  // ─── List sub-resellers ───────────────────────────────────────────

  async findAll(
    callerId: string,
    callerRole: UserRole,
    query: {
      page?: number;
      limit?: number;
      search?: string;
      isActive?: string;
    },
  ) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (callerRole === UserRole.admin) {
      // Admin sees all non-admin users
      where.role = { in: [UserRole.reseller, UserRole.sub_reseller] };
    } else {
      // Reseller sees only direct children
      where.parentId = callerId;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          ...RESELLER_SELECT,
          parent: { select: { id: true, name: true, email: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data.map((r) => ({
        ...formatReseller(r),
        parent: r.parent,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Create sub-reseller ──────────────────────────────────────────

  async create(
    parentId: string,
    callerRole: UserRole,
    dto: CreateResellerDto,
    ipAddress?: string,
  ) {
    // Check email uniqueness
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    // Determine child role based on parent role
    const childRole =
      callerRole === UserRole.admin ? UserRole.reseller : UserRole.sub_reseller;

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: childRole,
        parentId,
        profitMargin: dto.profitMargin || 0,
        emailVerified: true, // Parent-created accounts are pre-verified
      },
      select: RESELLER_SELECT,
    });

    // Log the creation
    await this.prisma.activityLog.create({
      data: {
        userId: parentId,
        action: 'reseller.create',
        ipAddress: ipAddress || '',
        details: {
          createdUserId: user.id,
          createdUserEmail: dto.email,
          createdUserRole: childRole,
          profitMargin: dto.profitMargin || 0,
        },
      },
    });

    return formatReseller(user);
  }

  // ─── Get single sub-reseller with full details ────────────────────

  async findOne(callerId: string, callerRole: UserRole, targetId: string) {
    const user = await this.verifyOwnership(callerId, callerRole, targetId);

    // Get enriched stats
    const [deviceStats, recentActivity, creditSummary] = await Promise.all([
      this.prisma.device.groupBy({
        by: ['status'],
        where: { userId: targetId },
        _count: true,
      }),
      this.prisma.activityLog.findMany({
        where: { userId: targetId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { action: true, createdAt: true, details: true },
      }),
      this.prisma.creditTransaction.aggregate({
        where: { userId: targetId },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const s of deviceStats) {
      statusMap[s.status] = s._count;
    }

    return {
      ...formatReseller(user),
      stats: {
        devicesByStatus: statusMap,
        totalTransactions: creditSummary._count,
        netCredits: Number(creditSummary._sum.amount || 0),
      },
      recentActivity,
    };
  }

  // ─── Update sub-reseller ──────────────────────────────────────────

  async update(
    callerId: string,
    callerRole: UserRole,
    targetId: string,
    dto: UpdateResellerDto,
    ipAddress?: string,
  ) {
    const existing = await this.verifyOwnership(callerId, callerRole, targetId);

    // Build update data — only include fields that were explicitly sent
    const updateData: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.profitMargin !== undefined) updateData.profitMargin = dto.profitMargin;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      select: RESELLER_SELECT,
    data: updateData,
    });

    // Log changes
    await this.prisma.activityLog.create({
      data: {
        userId: callerId,
        action: 'reseller.update',
        ipAddress: ipAddress || '',
        details: {
          targetUserId: targetId,
          targetUserName: existing.name,
          changes: JSON.parse(JSON.stringify(dto)),
        },
      },
    });

    return formatReseller(updated);
  }

  // ─── Delete sub-reseller (safe) ───────────────────────────────────

  async remove(
    callerId: string,
    callerRole: UserRole,
    targetId: string,
    ipAddress?: string,
  ) {
    const user = await this.verifyOwnership(callerId, callerRole, targetId);

    // Prevent deleting if they have active devices
    const activeDevices = await this.prisma.device.count({
      where: { userId: targetId, status: { in: ['active', 'trial'] } },
    });
    if (activeDevices > 0) {
      throw new BadRequestException(
        `Cannot delete: user has ${activeDevices} active device(s). Disable or delete them first.`,
      );
    }

    // Prevent deleting if they have sub-resellers
    const childCount = await this.prisma.user.count({
      where: { parentId: targetId },
    });
    if (childCount > 0) {
      throw new BadRequestException(
        `Cannot delete: user has ${childCount} sub-reseller(s). Remove them first.`,
      );
    }

    // Warn if they have credit balance (but allow it)
    const balance = Number(user.creditBalance);

    await this.prisma.$transaction([
      // Delete all their expired/disabled devices
      this.prisma.device.deleteMany({ where: { userId: targetId } }),
      // Delete activity logs
      this.prisma.activityLog.deleteMany({ where: { userId: targetId } }),
      // Delete login logs
      this.prisma.loginLog.deleteMany({ where: { userId: targetId } }),
      // Delete credit transactions
      this.prisma.creditTransaction.deleteMany({ where: { userId: targetId } }),
      // Delete payments
      this.prisma.payment.deleteMany({ where: { userId: targetId } }),
      // Delete the user
      this.prisma.user.delete({ where: { id: targetId } }),
      // Log the deletion on the parent
      this.prisma.activityLog.create({
        data: {
          userId: callerId,
          action: 'reseller.delete',
          ipAddress: ipAddress || '',
          details: {
            deletedUserId: targetId,
            deletedUserEmail: user.email,
            deletedUserName: user.name,
            remainingBalance: balance,
          },
        },
      }),
    ]);

    return {
      message: 'Sub-reseller deleted successfully',
      deletedUser: { id: targetId, name: user.name, email: user.email },
      creditBalanceLost: balance,
    };
  }

  // ─── View sub-reseller's devices (parent visibility) ──────────────

  async getSubResellerDevices(
    callerId: string,
    callerRole: UserRole,
    targetId: string,
    query: { page?: number; limit?: number; status?: string },
  ) {
    await this.verifyOwnership(callerId, callerRole, targetId);

    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.DeviceWhereInput = { userId: targetId };
    if (query.status) where.status = query.status as any;

    const [data, total] = await Promise.all([
      this.prisma.device.findMany({
        where,
        include: {
          app: { select: { id: true, name: true, slug: true, iconUrl: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.device.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Dashboard stats for parent about their hierarchy ─────────────

  async getHierarchyStats(callerId: string, callerRole: UserRole) {
    const childFilter: Prisma.UserWhereInput =
      callerRole === UserRole.admin
        ? { role: { in: [UserRole.reseller, UserRole.sub_reseller] } }
        : { parentId: callerId };

    const children = await this.prisma.user.findMany({
      where: childFilter,
      select: {
        id: true,
        name: true,
        creditBalance: true,
        isActive: true,
        _count: { select: { devices: true } },
      },
    });

    const childIds = children.map((c) => c.id);

    const [totalDevices, activeDevices, expiredDevices] = await Promise.all([
      this.prisma.device.count({ where: { userId: { in: childIds } } }),
      this.prisma.device.count({
        where: { userId: { in: childIds }, status: 'active' },
      }),
      this.prisma.device.count({
        where: { userId: { in: childIds }, status: 'expired' },
      }),
    ]);

    const totalChildBalance = children.reduce(
      (sum, c) => sum + Number(c.creditBalance),
      0,
    );

    return {
      totalSubResellers: children.length,
      activeSubResellers: children.filter((c) => c.isActive).length,
      totalChildCredits: totalChildBalance,
      totalChildDevices: totalDevices,
      activeChildDevices: activeDevices,
      expiredChildDevices: expiredDevices,
      topResellers: children
        .map((c) => ({
          id: c.id,
          name: c.name,
          deviceCount: c._count.devices,
          creditBalance: Number(c.creditBalance),
        }))
        .sort((a, b) => b.deviceCount - a.deviceCount)
        .slice(0, 5),
    };
  }

  // ─── Profit Margin Calculation ────────────────────────────────────

  /**
   * Calculate the effective credit cost for a user based on their
   * profit margin in the hierarchy.
   *
   * Base cost = app.creditsYearly or app.creditsLifetime
   * If user has a parent with profitMargin > 0:
   *   effectiveCost = baseCost * (1 + parentMargin/100)
   *
   * This means the parent earns the margin on every activation
   * by their sub-reseller.
   */
  async calculateEffectiveCost(
    userId: string,
    baseCost: number,
  ): Promise<{ effectiveCost: number; marginApplied: number }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { profitMargin: true, role: true },
    });

    const margin = Number(user.profitMargin);

    // Margin applies to sub-resellers — their cost is higher than base
    // The difference is the parent's profit
    if (user.role === UserRole.sub_reseller && margin > 0) {
      const effectiveCost = Math.ceil(baseCost * (1 + margin / 100));
      return { effectiveCost, marginApplied: margin };
    }

    return { effectiveCost: baseCost, marginApplied: 0 };
  }
}
